// Naprawa nakładających się powierzchni (z-fighting) na mapach budowanych w kodzie.
//
// Problem: dwie powierzchnie leżą w tej samej płaszczyźnie albo prawie w niej (błoto na terenie, panel na ścianie,
// blacha na dachu, pasy na posadzce, zdublowane ściany). Karta graficzna nie umie rozstrzygnąć, która jest bliżej,
// więc przy ruchu kamery piksele migoczą i obie przenikają się w paski.
//
// Rozwiązanie (tylko grafika – kolizje, trafienia na serwerze i dane map się nie zmieniają):
//  1. zbieramy trójkąty nieprzezroczystych siatek w układzie świata,
//  2. szukamy par zwróconych w tę samą stronę, równoległych, oddalonych o mniej niż `gap`, które się na siebie nakładają,
//  3. w każdej parze wybieramy powierzchnię wierzchnią (ta bardziej z przodu; przy idealnie wspólnej płaszczyźnie – mniejsza,
//     bo to zwykle naklejka/pas/łata), a idealne duplikaty usuwamy,
//  4. wierzchnie trójkąty przenosimy do osobnej siatki z tym samym materiałem i przesunięciem głębi (polygonOffset),
//     więc zawsze wygrywają – z bliska i z daleka – bez przesuwania geometrii i bez szczelin.
// Liczy się w tle (z przerwami na klatki), raz po zbudowaniu mapy.

const EPS_COPLANAR = 0.0003;   // poniżej tego odstępu płaszczyzny traktujemy jako wspólne
// ?nakladki=0 w adresie wyłącza naprawę (porównanie przed/po)
export const NAKLADKI = !/[?&]nakladki=0\b/.test(globalThis.location?.search || '');

// skip: obiekty (np. postać w lobby), których siatek nie ruszamy
export async function naprawNakladki(THREE, root, { gap = 0.02, minA = 0.0004, minTri = 0.00005, maxLevel = 4, skip = [], merge = true } = {}) {
  const t0 = performance.now();
  root.updateMatrixWorld(true);
  const skipSet = new Set(skip);
  const visible = (o) => { for (let p = o; p && p !== root; p = p.parent) if (!p.visible || skipSet.has(p)) return false; return true; };
  const geoUse = new Map();
  root.traverse((o) => { if (o.isMesh && o.geometry) geoUse.set(o.geometry, (geoUse.get(o.geometry) || 0) + 1); });

  // ---------- 1. trójkąty ----------
  const meshes = [], mats = [], matIx = new Map();
  const N = [], D = [], P = [], A = [], MI = [], MAT = [], TI = [], FIX = [];
  const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), M = new THREE.Matrix4(), IM = new THREE.Matrix4();
  root.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || o.userData.nakladka || !visible(o)) return;
    const g = o.geometry; if (!g || !g.attributes.position || (g.morphAttributes && Object.keys(g.morphAttributes).length)) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    const pos = g.attributes.position, idx = g.index, mi = meshes.length; meshes.push(o);
    const inst = o.isInstancedMesh ? o.count : 1, fixable = !o.isInstancedMesh;
    const total = idx ? idx.count : pos.count;
    const groups = g.groups && g.groups.length ? g.groups : [{ start: 0, count: total, materialIndex: 0 }];
    for (let k = 0; k < inst; k++) {
      if (o.isInstancedMesh) { o.getMatrixAt(k, IM); M.multiplyMatrices(o.matrixWorld, IM); } else M.copy(o.matrixWorld);
      for (const gr of groups) {
        const mat = ms[gr.materialIndex] || ms[0];
        if (!mat || mat.visible === false || mat.transparent || mat.depthWrite === false || mat.depthTest === false) continue;
        let mx = matIx.get(mat); if (mx === undefined) { mx = mats.length; mats.push(mat); matIx.set(mat, mx); }
        const end = Math.min(gr.start + gr.count, total);
        for (let t = gr.start; t + 2 < end; t += 3) {
          v0.fromBufferAttribute(pos, idx ? idx.getX(t) : t).applyMatrix4(M);
          v1.fromBufferAttribute(pos, idx ? idx.getX(t + 1) : t + 1).applyMatrix4(M);
          v2.fromBufferAttribute(pos, idx ? idx.getX(t + 2) : t + 2).applyMatrix4(M);
          const ax = v1.x - v0.x, ay = v1.y - v0.y, az = v1.z - v0.z, bx = v2.x - v0.x, by = v2.y - v0.y, bz = v2.z - v0.z;
          let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const l = Math.hypot(nx, ny, nz);
          if (l / 2 < minTri) continue; nx /= l; ny /= l; nz /= l;
          N.push(nx, ny, nz); D.push(nx * v0.x + ny * v0.y + nz * v0.z);
          P.push(v0.x, v0.y, v0.z, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z); A.push(l / 2); MI.push(mi); MAT.push(mx); TI.push(t); FIX.push(fixable ? 1 : 0);
        }
      }
    }
  });
  const n = D.length; if (!n) return { pairs: 0, moved: 0, removed: 0, ms: 0 };

  // ---------- 2. kubełki płaszczyzn i przegląd przedziałami ----------
  const S = new Int8Array(n), CN = new Float32Array(n * 3), CD = new Float64Array(n), B = new Map(), q = (x) => Math.round(x * 40);
  for (let i = 0; i < n; i++) {
    let x = N[i * 3], y = N[i * 3 + 1], z = N[i * 3 + 2], d = D[i], s = 1;
    if (x < -1e-6 || (Math.abs(x) <= 1e-6 && (y < -1e-6 || (Math.abs(y) <= 1e-6 && z < 0)))) { x = -x; y = -y; z = -z; d = -d; s = -1; }
    S[i] = s; CN[i * 3] = x; CN[i * 3 + 1] = y; CN[i * 3 + 2] = z; CD[i] = d;
    const nk = q(x) + ',' + q(y) + ',' + q(z), dk = Math.floor(d / 0.05);
    let m = B.get(nk); if (!m) B.set(nk, (m = new Map())); let l = m.get(dk); if (!l) m.set(dk, (l = [])); l.push(i);
  }
  const PP = new Float64Array(n * 6), BB = new Float64Array(n * 4);
  const polyArea = (poly) => { let s = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; s += a[0] * b[1] - a[1] * b[0]; } return Math.abs(s) / 2; };
  const overlap = (i, j) => {          // pole części wspólnej dwóch trójkątów w płaszczyźnie (obcinanie Sutherland–Hodgman)
    let out = [[PP[i * 6], PP[i * 6 + 1]], [PP[i * 6 + 2], PP[i * 6 + 3]], [PP[i * 6 + 4], PP[i * 6 + 5]]];
    const c = [[PP[j * 6], PP[j * 6 + 1]], [PP[j * 6 + 2], PP[j * 6 + 3]], [PP[j * 6 + 4], PP[j * 6 + 5]]];
    const cw = ((c[1][0] - c[0][0]) * (c[2][1] - c[0][1]) - (c[1][1] - c[0][1]) * (c[2][0] - c[0][0])) < 0;
    for (let e = 0; e < 3 && out.length; e++) {
      const ea = c[e], eb = c[(e + 1) % 3], inp = out; out = [];
      const side = (p) => { const v = (eb[0] - ea[0]) * (p[1] - ea[1]) - (eb[1] - ea[1]) * (p[0] - ea[0]); return cw ? -v : v; };
      for (let k = 0; k < inp.length; k++) {
        const pc = inp[k], pp = inp[(k + inp.length - 1) % inp.length], sc = side(pc), sp = side(pp);
        if (sc >= 0) { if (sp < 0) { const t = sp / (sp - sc); out.push([pp[0] + (pc[0] - pp[0]) * t, pp[1] + (pc[1] - pp[1]) * t]); } out.push(pc); }
        else if (sp >= 0) { const t = sp / (sp - sc); out.push([pp[0] + (pc[0] - pp[0]) * t, pp[1] + (pc[1] - pp[1]) * t]); }
      }
    }
    return out.length > 2 ? polyArea(out) : 0;
  };
  const edges = [], removed = new Uint8Array(n);
  let steps = 0, pairs = 0;
  const pause = () => new Promise((r) => setTimeout(r, 0));
  for (const [nk, m] of B) {
    const [x, y, z] = nk.split(',').map((v) => v / 40), nl = Math.hypot(x, y, z) || 1, nn = [x / nl, y / nl, z / nl];
    const u = Math.abs(nn[0]) < 0.9 ? [0, nn[2], -nn[1]] : [-nn[2], 0, nn[0]], ul = Math.hypot(...u); u[0] /= ul; u[1] /= ul; u[2] /= ul;
    const w = [nn[1] * u[2] - nn[2] * u[1], nn[2] * u[0] - nn[0] * u[2], nn[0] * u[1] - nn[1] * u[0]];
    const project = (i) => {
      for (let j = 0; j < 3; j++) {
        const px = P[i * 9 + j * 3], py = P[i * 9 + j * 3 + 1], pz = P[i * 9 + j * 3 + 2];
        PP[i * 6 + j * 2] = px * u[0] + py * u[1] + pz * u[2]; PP[i * 6 + j * 2 + 1] = px * w[0] + py * w[1] + pz * w[2];
      }
      BB[i * 4] = Math.min(PP[i * 6], PP[i * 6 + 2], PP[i * 6 + 4]); BB[i * 4 + 1] = Math.max(PP[i * 6], PP[i * 6 + 2], PP[i * 6 + 4]);
      BB[i * 4 + 2] = Math.min(PP[i * 6 + 1], PP[i * 6 + 3], PP[i * 6 + 5]); BB[i * 4 + 3] = Math.max(PP[i * 6 + 1], PP[i * 6 + 3], PP[i * 6 + 5]);
    };
    for (const [dk, l] of m) {
      const all = l.concat(m.get(dk + 1) || []); for (const i of all) project(i);
      const nextBucket = new Uint8Array(all.length); for (let k = l.length; k < all.length; k++) nextBucket[k] = 1;
      const order = all.map((_, k) => k).sort((a, b) => BB[all[a] * 4] - BB[all[b] * 4]);
      const active = [];
      for (const ka of order) {
        const i = all[ka];
        for (let z2 = active.length - 1; z2 >= 0; z2--) if (BB[all[active[z2]] * 4 + 1] < BB[i * 4]) active.splice(z2, 1);
        for (const kb of active) {
          if (nextBucket[ka] && nextBucket[kb]) continue;               // ta para zostanie sprawdzona w następnym kubełku
          const j = all[kb];
          if (S[i] !== S[j] || BB[j * 4 + 2] > BB[i * 4 + 3] || BB[j * 4 + 3] < BB[i * 4 + 2]) continue;
          const dd = (CD[i] - CD[j]) * S[i];                             // > 0: i leży przed j (patrząc od strony frontu)
          if (Math.abs(dd) > gap) continue;
          if (Math.abs(CN[i * 3] * CN[j * 3] + CN[i * 3 + 1] * CN[j * 3 + 1] + CN[i * 3 + 2] * CN[j * 3 + 2]) < 0.9995) continue;
          const ov = overlap(i, j); if (ov < minA) continue;
          pairs++;
          if (Math.abs(dd) <= EPS_COPLANAR && ov > 0.98 * Math.max(A[i], A[j])) {   // ten sam trójkąt dwa razy: zostaje jeden
            const r = FIX[j] ? j : FIX[i] ? i : -1; if (r >= 0) removed[r] = 1; continue;
          }
          let top, bot;
          if (Math.abs(dd) > EPS_COPLANAR) { top = dd > 0 ? i : j; bot = top === i ? j : i; }
          else { top = A[i] < A[j] || (A[i] === A[j] && i > j) ? i : j; bot = top === i ? j : i; }
          edges.push(top, bot);
        }
        active.push(ka);
        if (++steps % 25000 === 0) await pause();
      }
    }
  }

  // ---------- 3. poziomy (warstwa na warstwie: każda wyższa dostaje mocniejsze przesunięcie) ----------
  const level = new Uint8Array(n);
  for (let pass = 0; pass < maxLevel; pass++) {
    let changed = false;
    for (let e = 0; e < edges.length; e += 2) {
      const t = edges[e], b = edges[e + 1], want = Math.min(maxLevel, level[b] + 1);
      if (!removed[b] && level[t] < want) { level[t] = want; changed = true; }
    }
    if (!changed) break;
  }

  // ---------- 4. przeniesienie wierzchnich trójkątów do siatek z polygonOffset ----------
  const perMesh = new Map();
  for (let i = 0; i < n; i++) {
    if (!FIX[i] || (!removed[i] && !level[i])) continue;
    let e = perMesh.get(MI[i]); if (!e) perMesh.set(MI[i], (e = { lift: new Map(), drop: new Set() }));
    if (removed[i]) { e.drop.add(TI[i]); continue; }
    const key = MAT[i] * 16 + level[i]; let arr = e.lift.get(key); if (!arr) e.lift.set(key, (arr = []));
    if (!arr.includes(TI[i])) arr.push(TI[i]);
  }
  const matCache = new Map(), added = [];
  const offsetMat = (mat, lv) => {
    const key = mat.uuid + ':' + lv; let m = matCache.get(key); if (m) return m;
    m = mat.clone(); m.onBeforeCompile = mat.onBeforeCompile; if (mat.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey) m.customProgramCacheKey = mat.customProgramCacheKey;
    m.polygonOffset = true; m.polygonOffsetFactor = (mat.polygonOffset ? mat.polygonOffsetFactor : 0) - lv; m.polygonOffsetUnits = (mat.polygonOffset ? mat.polygonOffsetUnits : 0) - 3 * lv;
    matCache.set(key, m); return m;
  };
  // merge: wierzchnie trójkąty siatek o wspólnym rodzicu i materiale idą do jednej siatki (mniej wywołań rysowania).
  // Tylko dla scen statycznych (mapy gry); w lobby część obiektów się rusza, więc tam każda siatka dostaje własną nakładkę.
  let lifted = 0, dropped = 0;
  const buckets = new Map(), nrmM = new THREE.Matrix3(), tv = new THREE.Vector3();
  for (const [mi, e] of perMesh) {
    const o = meshes[mi]; let g = o.geometry;
    if (geoUse.get(g) > 1) { g = g.clone(); o.geometry = g; }      // geometria współdzielona z innymi siatkami: zmiany tylko w tej
    const idx = g.index, pos = g.attributes.position, names = Object.keys(g.attributes).sort();
    const collapse = (t) => {                                          // trójkąt znika z oryginalnej siatki (zdegenerowany)
      if (idx) { const a = idx.getX(t); idx.setX(t + 1, a); idx.setX(t + 2, a); }
      else for (const k of [1, 2]) pos.setXYZ(t + k, pos.getX(t), pos.getY(t), pos.getZ(t));
    };
    for (const t of e.drop) { collapse(t); dropped++; }
    const toParent = merge && o.parent ? o.matrix : null;              // wierzchołki w układ rodzica (siatka łączona)
    if (toParent) { o.updateMatrix(); nrmM.getNormalMatrix(o.matrix); }
    for (const [key, list] of e.lift) {
      const mx = Math.floor(key / 16), lv = key % 16, sig = names.map((nm) => nm + g.attributes[nm].itemSize + g.attributes[nm].array.constructor.name).join('|');
      const bk = merge ? (o.parent ? o.parent.uuid : '') + ':' + key + ':' + sig + ':' + o.castShadow + o.receiveShadow + ':' + !!o.userData.deco + !!o.userData.noHit + ':' + o.renderOrder
        : o.uuid + ':' + key;
      let b = buckets.get(bk);
      if (!b) buckets.set(bk, (b = { o, mx, lv, names, data: Object.fromEntries(names.map((nm) => [nm, []])) }));
      for (const nm of names) {
        const src = g.attributes[nm], isz = src.itemSize, out = b.data[nm];
        for (const t of list) for (let k = 0; k < 3; k++) {
          const vi = idx ? idx.getX(t + k) : t + k;
          if (toParent && (nm === 'position' || nm === 'normal') && isz === 3) {
            tv.set(src.array[vi * 3], src.array[vi * 3 + 1], src.array[vi * 3 + 2]);
            if (nm === 'position') tv.applyMatrix4(toParent); else tv.applyMatrix3(nrmM).normalize();
            out.push(tv.x, tv.y, tv.z);
          } else for (let c = 0; c < isz; c++) out.push(src.array[vi * isz + c]);
        }
      }
      for (const t of list) collapse(t);
      lifted += list.length;
    }
    if (idx) idx.needsUpdate = true; else pos.needsUpdate = true;
    g.computeBoundingSphere(); g.computeBoundingBox();
  }
  for (const b of buckets.values()) {
    const o = b.o, ng = new THREE.BufferGeometry(), g = o.geometry;
    for (const nm of b.names) { const src = g.attributes[nm]; ng.setAttribute(nm, new THREE.BufferAttribute(new (src.array.constructor)(b.data[nm]), src.itemSize, src.normalized)); }
    const nm = new THREE.Mesh(ng, offsetMat(mats[b.mx], b.lv));
    nm.name = (o.name || 'siatka') + '_nakladka'; nm.userData = { ...o.userData, nakladka: true };
    nm.castShadow = o.castShadow; nm.receiveShadow = o.receiveShadow; nm.renderOrder = o.renderOrder; nm.frustumCulled = o.frustumCulled;
    if (merge && o.parent) o.parent.add(nm); else o.add(nm);
    added.push({ src: o, mesh: nm });
  }
  return { tris: n, pairs, lifted, dropped, added, ms: Math.round(performance.now() - t0) };
}
