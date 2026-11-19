// Wspólne narzędzia do modelowania broni (patrz SPEC.md). Układ: metry, −Z do przodu, +Y w górę, +X w prawo.
// Zawiera: bryły (profile, toczenie, przeciąganie), scalanie z UV „pudełkowymi” (w metrach), wygładzanie normalnych z progiem
// załamania oraz bibliotekę materiałów PBR z proceduralnymi teksturami wysokiej rozdzielczości (stal, aluminium, polimer,
// drewno, guma, kropkowanie chwytu) – mapy koloru, chropowatości i normalnych generowane raz i współdzielone.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export { THREE, mergeGeometries };

const V2 = (a, b) => new THREE.Vector2(a, b);

// Zaokrągla narożniki wielokąta [[a,b],...]: radii = liczba lub tablica (0 = ostry narożnik), seg = podział łuku.
export function roundPoly(pts, radii = 0.002, seg = 4) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n], r = Array.isArray(radii) ? radii[i] : radii;
    if (!r) { out.push(p1); continue; }
    const d1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), d2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), t1 = Math.min(r, d1 / 2), t2 = Math.min(r, d2 / 2);
    const a = [p1[0] + (p0[0] - p1[0]) * t1 / d1, p1[1] + (p0[1] - p1[1]) * t1 / d1], b = [p1[0] + (p2[0] - p1[0]) * t2 / d2, p1[1] + (p2[1] - p1[1]) * t2 / d2];
    for (let k = 0; k <= seg; k++) { const u = k / seg, v = 1 - u; out.push([v * v * a[0] + 2 * u * v * p1[0] + u * u * b[0], v * v * a[1] + 2 * u * v * p1[1] + u * u * b[1]]); }
  }
  return out;
}

// Profil boczny: punkty [z, y] (jak patrzysz z prawej strony), wyciągnięty wzdłuż X, wyśrodkowany w x = 0.
// holes: tablice punktów [z,y] otworów. bevel: promień fazki (całkowita szerokość = width). Fazka ma 3 segmenty –
// po wygładzeniu normalnych (crease) wygląda jak zaokrąglona krawędź i łapie odblaski.
export function side(pts, width, bevel = 0.0015, holes = [], curveSeg = 10) {
  const sh = new THREE.Shape(pts.map(p => V2(p[0], p[1])));
  for (const h of holes) sh.holes.push(new THREE.Path(h.map(p => V2(p[0], p[1]))));
  const bt = Math.min(bevel, width / 2 - 1e-4), depth = Math.max(1e-4, width - 2 * bt);
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bt > 0, bevelThickness: bt, bevelSize: bt, bevelSegments: 3, curveSegments: curveSeg });
  g.rotateY(-Math.PI / 2); g.translate(depth / 2, 0, 0); g.computeVertexNormals();
  return g;
}

// Profil czołowy: punkty [x, y] wyciągnięte wzdłuż Z na długość len, wyśrodkowane w z = 0.
export function front(pts, len, bevel = 0.0012, holes = [], curveSeg = 12) {
  const sh = new THREE.Shape(pts.map(p => V2(p[0], p[1])));
  for (const h of holes) sh.holes.push(new THREE.Path(h.map(p => V2(p[0], p[1]))));
  const bt = Math.min(bevel, len / 2 - 1e-4), depth = Math.max(1e-4, len - 2 * bt);
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bt > 0, bevelThickness: bt, bevelSize: bt, bevelSegments: 3, curveSegments: curveSeg });
  g.translate(0, 0, -depth / 2); g.computeVertexNormals();
  return g;
}

// Bryła obrotowa wokół osi Z. Profil: [r, z] od TYŁU do PRZODU (z malejące). Zamyka końce, jeśli r > 0.
export function lathe(profile, segs = 40) {
  const pts = profile.map(p => V2(p[0], -p[1]));
  const g = new THREE.LatheGeometry(pts, segs);
  g.rotateX(-Math.PI / 2); g.computeVertexNormals();
  return g;
}

// Walec wzdłuż Z od z0 do z1 (promień r, opcjonalnie r1 na końcu z1), z zaślepkami.
export function cyl(r, z0, z1, segs = 32, r1 = r) {
  const len = Math.abs(z1 - z0), g = new THREE.CylinderGeometry(r1, r, len, segs);   // góra = r1 (przód), dół = r (tył)
  g.rotateX(-Math.PI / 2); g.translate(0, 0, (z0 + z1) / 2); return g;
}

// Rura (pierścień) wzdłuż Z: zewnętrzny rOut, wewnętrzny rIn – do otworów lufy / tłumika.
export function tube(rOut, rIn, z0, z1, segs = 40) {
  const g = lathe([[rIn, z0], [rOut, z0], [rOut, z1], [rIn, z1]], segs); return g;
}

export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
// Zaokrąglona skrzynka (wymiary w, h, d; promień zaokrąglenia r)
export function rbox(w, h, d, r = 0.002, seg = 3) { return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-5, h / 2 - 1e-5, d / 2 - 1e-5)); }

// Pręt (walec) między punktami a i b
export function rod(a, b, r, segs = 16) {
  const d = new THREE.Vector3().subVectors(b, a), g = new THREE.CylinderGeometry(r, r, d.length(), segs);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); return g;
}

// Przeciągnięcie prostokątnego przekroju wzdłuż krzywej w płaszczyźnie YZ (magazynek łukowy, kabłąk itp.).
// path: tablica punktów [y, z] od góry; wid(i, t) i dep(i, t) → szerokość (x) i głębokość (wzdłuż normalnej) w kroku i.
// round: promień zaokrąglenia narożników przekroju (0 = ostre), rs = podział łuku.
export function sweep(path, steps, wid, dep, capEnds = true, round = 0, rs = 3) {
  const curve = new THREE.CatmullRomCurve3(path.map(p => new THREE.Vector3(0, p[0], p[1])));
  const ring = (w, d) => {                                       // przekrój [x, n] obiegany zgodnie z kolejnością -x-n → +x-n → +x+n → -x+n
    if (!round) return [[-w, -d], [w, -d], [w, d], [-w, d]];
    const r = Math.min(round, w * 0.95, d * 0.95), out = [];
    for (const [cx, cn, a0] of [[-w + r, -d + r, Math.PI], [w - r, -d + r, 1.5 * Math.PI], [w - r, d - r, 0], [-w + r, d - r, 0.5 * Math.PI]])
      for (let k = 0; k <= rs; k++) { const a = a0 + k / rs * Math.PI / 2; out.push([cx + Math.cos(a) * r, cn + Math.sin(a) * r]); }
    return out;
  };
  const rings = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, c = curve.getPoint(t), tg = curve.getTangent(t), n = new THREE.Vector3(1, 0, 0).cross(tg).normalize();   // n leży w płaszczyźnie YZ
    rings.push(ring(wid(i, t) / 2, dep(i, t) / 2).map(([x, k]) => new THREE.Vector3(x, 0, 0).addScaledVector(n, k).add(c)));
  }
  const pos = [], tri = (a, b, c) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z), K = rings[0].length;
  for (let i = 0; i < steps; i++) for (let k = 0; k < K; k++) {
    const a = rings[i][k], b = rings[i][(k + 1) % K], c = rings[i + 1][(k + 1) % K], d = rings[i + 1][k];
    tri(a, c, b); tri(a, d, c);
  }
  if (capEnds) for (const [rg, flip] of [[rings[0], false], [rings[steps], true]]) {
    for (let k = 1; k < K - 1; k++) { if (!flip) tri(rg[0], rg[k], rg[k + 1]); else tri(rg[0], rg[k + 1], rg[k]); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}

// ---------------- normalne i UV ----------------
// Normalne z progiem załamania: łuki i fazki gładkie, ostre krawędzie ostre. Wierzchołki łączone po pozycji (siatka 0,01 mm).
export function crease(g, deg = 50) {
  g = g.index ? g.toNonIndexed() : g;
  const P = g.attributes.position.array, cnt = P.length / 3, nf = cnt / 3, lim = Math.cos(deg * Math.PI / 180);
  const FN = new Float32Array(nf * 3), FA = new Float32Array(nf), bucket = new Map(), ids = new Int32Array(cnt);
  for (let f = 0; f < nf; f++) {
    const o = f * 9, ax = P[o + 3] - P[o], ay = P[o + 4] - P[o + 1], az = P[o + 5] - P[o + 2], bx = P[o + 6] - P[o], by = P[o + 7] - P[o + 1], bz = P[o + 8] - P[o + 2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const l = Math.hypot(nx, ny, nz);
    FA[f] = l; if (l > 0) { nx /= l; ny /= l; nz /= l; } FN[f * 3] = nx; FN[f * 3 + 1] = ny; FN[f * 3 + 2] = nz;
  }
  for (let i = 0; i < cnt; i++) {
    const k = Math.round(P[i * 3] * 1e5) * 73856093 ^ Math.round(P[i * 3 + 1] * 1e5) * 19349663 ^ Math.round(P[i * 3 + 2] * 1e5) * 83492791;
    let id = bucket.get(k); if (id === undefined) { id = bucket.size; bucket.set(k, id); } ids[i] = id;
  }
  const start = new Int32Array(bucket.size + 1); for (let i = 0; i < cnt; i++) start[ids[i] + 1]++;
  for (let i = 0; i < bucket.size; i++) start[i + 1] += start[i];
  const fill = start.slice(0, bucket.size), list = new Int32Array(cnt); for (let i = 0; i < cnt; i++) list[fill[ids[i]]++] = (i / 3) | 0;
  const N = new Float32Array(cnt * 3);
  for (let i = 0; i < cnt; i++) {
    const f = (i / 3) | 0, ux = FN[f * 3], uy = FN[f * 3 + 1], uz = FN[f * 3 + 2], id = ids[i]; let sx = 0, sy = 0, sz = 0;
    for (let j = start[id]; j < start[id + 1]; j++) {
      const o = list[j], wx = FN[o * 3], wy = FN[o * 3 + 1], wz = FN[o * 3 + 2];
      if (wx * ux + wy * uy + wz * uz >= lim) { const a = FA[o]; sx += wx * a; sy += wy * a; sz += wz * a; }
    }
    const l = Math.hypot(sx, sy, sz) || 1; if (l === 1 && sx === 0 && sy === 0 && sz === 0) { sx = ux; sy = uy; sz = uz; }
    N[i * 3] = sx / l; N[i * 3 + 1] = sy / l; N[i * 3 + 2] = sz / l;
  }
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); return g;
}

// UV „pudełkowe” w metrach: każdy trójkąt rzutowany na płaszczyznę prostopadłą do dominującej osi swojej normalnej.
// Boki (±X): u = z, v = y; góra/dół (±Y): u = z, v = x; czoła (±Z): u = x, v = y – słoje / szlif biegną wzdłuż broni.
export function boxUV(g) {
  if (g.userData.uvBox) return g;
  const P = g.attributes.position, n = P.count, uv = new Float32Array(n * 2), p = P.array;
  const put = (i, ax) => {
    const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
    if (ax === 0) { uv[i * 2] = z; uv[i * 2 + 1] = y; } else if (ax === 1) { uv[i * 2] = z + 0.37; uv[i * 2 + 1] = x + 0.21; } else { uv[i * 2] = x + 0.53; uv[i * 2 + 1] = y + 0.11; }
  };
  const dom = (x, y, z) => { x = Math.abs(x); y = Math.abs(y); z = Math.abs(z); return x >= y && x >= z ? 0 : y >= z ? 1 : 2; };
  if (!g.index) {
    for (let f = 0; f < n / 3; f++) {
      const o = f * 9, ax = p[o + 3] - p[o], ay = p[o + 4] - p[o + 1], az = p[o + 5] - p[o + 2], bx = p[o + 6] - p[o], by = p[o + 7] - p[o + 1], bz = p[o + 8] - p[o + 2];
      const d = dom(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx); put(f * 3, d); put(f * 3 + 1, d); put(f * 3 + 2, d);
    }
  } else {
    if (!g.attributes.normal) g.computeVertexNormals();
    const N = g.attributes.normal; for (let i = 0; i < n; i++) put(i, dom(N.getX(i), N.getY(i), N.getZ(i)));
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.userData.uvBox = true; return g;
}

// Scal wiele geometrii w jedną (jedna siatka, jeden materiał), z UV pudełkowymi (tekstury w skali metrycznej).
// Drugi argument zostaje dla zgodności (dawniej keepUv) – UV są teraz zawsze generowane.
export function merged(list) {
  const out = list.map(g => {
    g = g.index ? g.toNonIndexed() : g.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    g.userData = {}; return boxUV(g);
  });
  const m = mergeGeometries(out); m.userData.uvBox = true; return m;
}
// Pomocniki ułożenia
export function placed(g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  g = g.clone(); const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(m); return g;
}
export function mesh(g, m, parent, shadow = true) { boxUV(g); const o = new THREE.Mesh(g, m); o.castShadow = shadow; if (parent) parent.add(o); return o; }
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---------------- proceduralne tekstury (bezszwowe) ----------------
const rng = seed => { let s = (seed >>> 0) % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
// szum wartości z okresem px × py komórek na teksturę (zawija się na krawędziach) – dodaje amp·szum do out
function vnoise(S, px, py, r, out, amp) {
  const L = new Float32Array(px * py); for (let i = 0; i < L.length; i++) L[i] = r();
  const kx = px / S, ky = py / S;
  for (let y = 0; y < S; y++) {
    const fy = y * ky, iy = fy | 0; let ty = fy - iy; ty = ty * ty * (3 - 2 * ty);
    const r0 = (iy % py) * px, r1 = ((iy + 1) % py) * px, row = y * S;
    for (let x = 0; x < S; x++) {
      const fx = x * kx, ix = fx | 0; let tx = fx - ix; tx = tx * tx * (3 - 2 * tx);
      const x0 = ix % px, x1 = (ix + 1) % px, a = L[r0 + x0] + (L[r0 + x1] - L[r0 + x0]) * tx, b = L[r1 + x0] + (L[r1 + x1] - L[r1 + x0]) * tx;
      out[row + x] += (a + (b - a) * ty) * amp;
    }
  }
}
function fbm(S, px, py, oct, gain, r) {
  const out = new Float32Array(S * S); let amp = 1, tot = 0;
  for (let o = 0; o < oct; o++) { vnoise(S, Math.min(S, px << o), Math.min(S, py << o), r, out, amp); tot += amp; amp *= gain; }
  for (let i = 0; i < out.length; i++) out[i] /= tot; return out;
}
// warstwa rys: krótkie, cienkie, lekko łukowate kreski (głównie wzdłuż u), 0..1
function scratches(S, r, n, ang, spread, len, wmax = 1.2, amax = .7) {
  const c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, S, S); x.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = ang + (r() - .5) * spread, l = len * (.15 + r() * r() * 1.6), px = r() * S, py = r() * S, bend = (r() - .5) * l * .25;
    const ex = px + Math.cos(a) * l, ey = py + Math.sin(a) * l, mx = (px + ex) / 2 - Math.sin(a) * bend, my = (py + ey) / 2 + Math.cos(a) * bend;
    x.strokeStyle = `rgba(255,255,255,${.12 + r() * amax})`; x.lineWidth = .35 + r() * wmax;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { x.beginPath(); x.moveTo(px + ox, py + oy); x.quadraticCurveTo(mx + ox, my + oy, ex + ox, ey + oy); x.stroke(); }
  }
  return readRed(x, S);
}
// kropki / wgłębienia (kropkowanie chwytu, faktura gumy), 0..1
function dimples(S, r, n, rmin, rmax, soft = .2) {
  const c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < n; i++) {
    const rad = rmin + r() * (rmax - rmin), px = r() * S, py = r() * S;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      const cx = px + ox, cy = py + oy; if (cx < -rad || cy < -rad || cx > S + rad || cy > S + rad) continue;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1 - soft, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, rad, 0, Math.PI * 2); x.fill();
    }
  }
  return readRed(x, S);
}
function readRed(x, S) { const d = x.getImageData(0, 0, S, S).data, o = new Float32Array(S * S); for (let i = 0; i < o.length; i++) o[i] = d[i * 4] / 255; return o; }
function toCanvas(S, fill) {
  const c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), im = x.createImageData(S, S); fill(im.data); x.putImageData(im, 0, 0); return c;
}
const grayCanvas = (S, f) => toCanvas(S, d => { for (let i = 0; i < f.length; i++) { const v = Math.max(0, Math.min(255, f[i] * 255)); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; } });
// mapa normalnych (OpenGL, +Y w górę) z mapy wysokości; k = siła
function normalCanvas(S, h, k) {
  return toCanvas(S, d => {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x, xl = y * S + (x + S - 1) % S, xr = y * S + (x + 1) % S, yu = ((y + S - 1) % S) * S + x, yd = ((y + 1) % S) * S + x;
      const nx = -(h[xr] - h[xl]) * k, ny = (h[yd] - h[yu]) * k, l = Math.hypot(nx, ny, 1);
      d[i * 4] = (nx / l * .5 + .5) * 255; d[i * 4 + 1] = (ny / l * .5 + .5) * 255; d[i * 4 + 2] = (1 / l * .5 + .5) * 255; d[i * 4 + 3] = 255;
    }
  });
}
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const ROUGH_MEAN = 0.8;                                         // średnia map chropowatości (material.roughness = docelowa / ROUGH_MEAN)

// Zestawy tekstur: { map, rough, normal } jako canvasy, generowane leniwie i współdzielone
const SETS = {
  // stal / aluminium: drobne ziarno, szlif wzdłuż broni, plamy zużycia i rysy (jaśniejsze i gładsze – goły metal)
  metal() {
    const S = 512, r = rng(11), grain = fbm(S, 128, 128, 2, .55, r), brush = fbm(S, 6, 192, 3, .5, r), blotch = fbm(S, 3, 3, 4, .55, r);
    const scr = scratches(S, r, 320, 0, .7, 60, 1.1, .55), fine = scratches(S, r, 500, 0, .25, 18, .5, .35);
    const h = new Float32Array(S * S), ro = new Float32Array(S * S), al = new Float32Array(S * S);
    for (let i = 0; i < h.length; i++) {
      const s = Math.min(1, scr[i] + fine[i] * .6);
      h[i] = grain[i] * .45 + brush[i] * .35 - s * 1.1;
      ro[i] = clamp01(ROUGH_MEAN + (blotch[i] - .5) * .5 + (grain[i] - .5) * .18 + (brush[i] - .5) * .12 - s * .42);
      al[i] = clamp01(.84 + (blotch[i] - .5) * .2 + (grain[i] - .5) * .06 + s * .5);
    }
    return { map: grayCanvas(S, al), rough: grayCanvas(S, ro), normal: normalCanvas(S, h, 2.6) };
  },
  // polimer: drobna, matowa faktura odlewu i delikatne przetarcia
  polymer() {
    const S = 512, r = rng(23), bump = fbm(S, 40, 40, 3, .5, r), micro = fbm(S, 256, 256, 1, .5, r), blotch = fbm(S, 4, 4, 3, .55, r);
    const scuff = scratches(S, r, 140, 0, 2.4, 40, 1.4, .3);
    const h = new Float32Array(S * S), ro = new Float32Array(S * S), al = new Float32Array(S * S);
    for (let i = 0; i < h.length; i++) {
      h[i] = bump[i] * .55 + micro[i] * .45 - scuff[i] * .3;
      ro[i] = clamp01(ROUGH_MEAN + (blotch[i] - .5) * .25 + (micro[i] - .5) * .12 - scuff[i] * .3);
      al[i] = clamp01(.9 + (blotch[i] - .5) * .12 + scuff[i] * .25);
    }
    return { map: grayCanvas(S, al), rough: grayCanvas(S, ro), normal: normalCanvas(S, h, 1.6) };
  },
  // kropkowanie chwytu (stipple) – gęste wgłębienia
  stipple() {
    const S = 512, r = rng(37), d = dimples(S, r, 3200, 2.2, 4.6, .35), micro = fbm(S, 256, 256, 1, .5, r), blotch = fbm(S, 4, 4, 3, .55, r);
    const h = new Float32Array(S * S), ro = new Float32Array(S * S), al = new Float32Array(S * S);
    for (let i = 0; i < h.length; i++) {
      h[i] = -d[i] + micro[i] * .25;
      ro[i] = clamp01(ROUGH_MEAN + d[i] * .12 + (blotch[i] - .5) * .2 - .05);
      al[i] = clamp01(.92 - d[i] * .14 + (blotch[i] - .5) * .1);
    }
    return { map: grayCanvas(S, al), rough: grayCanvas(S, ro), normal: normalCanvas(S, h, 3.2) };
  },
  // guma (stopka): drobne pory
  rubber() {
    const S = 256, r = rng(41), d = dimples(S, r, 900, .8, 1.8, .5), n = fbm(S, 64, 64, 2, .5, r);
    const h = new Float32Array(S * S), ro = new Float32Array(S * S), al = new Float32Array(S * S);
    for (let i = 0; i < h.length; i++) { h[i] = n[i] * .6 - d[i] * .5; ro[i] = clamp01(ROUGH_MEAN + (n[i] - .5) * .1); al[i] = clamp01(.92 + (n[i] - .5) * .1); }
    return { map: grayCanvas(S, al), rough: grayCanvas(S, ro), normal: normalCanvas(S, h, 2) };
  },
};
// drewno: słoje wzdłuż u (kolor w mapie), pory jako ciemne kreski, lakier gładszy na słojach
function woodSet(light, dark, seed) {
  const S = 1024, r = rng(seed), warp = fbm(S, 2, 4, 3, .5, r), fine = fbm(S, 6, 160, 2, .5, r), pore = fbm(S, 32, 640, 1, .5, r), fig = fbm(S, 2, 3, 3, .5, r);
  const h = new Float32Array(S * S), ro = new Float32Array(S * S), col = new Float32Array(S * S * 3);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x, u = x / S;
    // proste, długie słoje (tarcica promieniowa): lekko faliste linie wzdłuż u, gęsto w poprzek
    const g = (y / S) * 46 + warp[i] * .9 + .12 * Math.sin((u + warp[i] * .5) * Math.PI * 2), ring = g - Math.floor(g);
    const late = Math.pow(Math.max(0, Math.sin(ring * Math.PI)), 9);                         // cienkie, ciemniejsze pasmo drewna późnego
    const p = Math.max(0, (pore[i] - .64) * 3);                                                 // pory
    const t = clamp01(late * .26 + (fine[i] - .5) * .3 + .32 + (fig[i] - .5) * .55 + p * .3);
    for (let k = 0; k < 3; k++) col[i * 3 + k] = (light[k] + (dark[k] - light[k]) * t) / 255;
    h[i] = -late * .35 - p * .8 + fine[i] * .2;
    ro[i] = clamp01(ROUGH_MEAN - .12 + p * .35 + late * .05);
  }
  const map = toCanvas(S, d => { for (let i = 0; i < S * S; i++) { d[i * 4] = col[i * 3] * 255; d[i * 4 + 1] = col[i * 3 + 1] * 255; d[i * 4 + 2] = col[i * 3 + 2] * 255; d[i * 4 + 3] = 255; } });
  return { map, rough: grayCanvas(S, ro), normal: normalCanvas(S, h, 2.2) };
}
const _sets = {}, _tex = {};
function setFor(kind, o) {
  const key = kind === 'wood' ? `wood:${o.light}:${o.dark}` : kind;
  return _sets[key] || (_sets[key] = kind === 'wood' ? woodSet(o.light, o.dark, 53 + o.light[0]) : SETS[kind]());
}
// tekstury dla zestawu i skali (tile = ile metrów zajmuje jedna kopia tekstury)
function texFor(kind, tile, o) {
  const key = `${kind}:${tile}:${o.light || ''}:${o.dark || ''}`; if (_tex[key]) return _tex[key];
  const s = setFor(kind, o), mk = (c, srgb) => {
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / tile, 1 / tile); t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  return _tex[key] = { map: mk(s.map, true), rough: mk(s.rough, false), normal: mk(s.normal, false) };
}

// Biblioteka materiałów broni. tex = zestaw tekstur, tile = skala [m], nrm = siła mapy normalnych.
const KINDS = {
  // metale: kolor = odbicie zwierciadlane (oksyda ~0.12–0.2 liniowo, goła stal ~0.55); powłoki anodowe zachowują się jak ciemny lakier
  steel:   { tex: 'metal', color: 0x8b8f95, metal: 1,   rough: .38, tile: .09, nrm: .22 },     // stal oksydowana (lufa, zamek, komora)
  parker:  { tex: 'metal', color: 0x7b7e81, metal: .75, rough: .58, tile: .07, nrm: .4 },    // stal parkeryzowana (matowa)
  bare:    { tex: 'metal', color: 0xd2d6db, metal: 1,   rough: .24, tile: .08, nrm: .15 },    // goła, polerowana stal (zamek, kołki, suwadło)
  alu:     { tex: 'metal', color: 0x34373b, metal: .4,  rough: .42, tile: .08, nrm: .2 },    // aluminium anodowane na czarno
  dark:    { tex: 'metal', color: 0x5c5f63, metal: .7,  rough: .45, tile: .06, nrm: .4 },     // drobne ciemne części (śruby, zatrzaski)
  scope:   { tex: 'metal', color: 0x26282b, metal: .35, rough: .36, tile: .1,  nrm: .25 },    // tubus lunety (anodowany, satynowy)
  poly:    { tex: 'polymer', color: 0x26272a, metal: 0, rough: .64, tile: .05, nrm: .55 },    // polimer
  grip:    { tex: 'stipple', color: 0x26272a, metal: 0, rough: .78, tile: .035, nrm: .9 },   // polimer kropkowany (chwyty)
  olive:   { tex: 'stipple', color: 0x5b6743, metal: 0, rough: .8,  tile: .06, nrm: .55 },   // oliwkowy polimer kolby snajperskiej
  oliveFine: { tex: 'polymer', color: 0x5b6743, metal: 0, rough: .72, tile: .05, nrm: .5 },
  rubber:  { tex: 'rubber', color: 0x18191b, metal: 0, rough: .8,  tile: .03, nrm: .7 },
  black:   { tex: 'polymer', color: 0x16171a, metal: .25, rough: .6, tile: .04, nrm: .3 },   // czerń w szczelinach i otworach
  bake:    { tex: 'polymer', color: 0x52220f, metal: 0, rough: .36, tile: .06, nrm: .35, clearcoat: .55, ccRough: .3 },   // bakelit (magazynek AK)
  wood:    { tex: 'wood', color: 0xffffff, metal: 0, rough: .5, tile: .3, nrm: .45, clearcoat: .35, ccRough: .38, light: [132, 56, 26], dark: [74, 28, 11] },   // brzoza lakierowana (AK)
  walnut:  { tex: 'wood', color: 0xffffff, metal: 0, rough: .46, tile: .3, nrm: .45, clearcoat: .45, ccRough: .3, light: [128, 76, 42], dark: [62, 34, 17] },    // orzech (strzelba)
  brass:   { tex: 'metal', color: 0xd6ab52, metal: 1,   rough: .3,  tile: .05, nrm: .15 },
  hull:    { tex: 'polymer', color: 0xa11e17, metal: 0, rough: .45, tile: .04, nrm: .25 },     // łuska śrutowa (plastik)
};
export function gunMat(kind, over = {}) {
  const k = Object.assign({}, KINDS[kind] || KINDS.steel, over);
  const T = texFor(k.tex, k.tile, k), Ctor = k.clearcoat ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const m = new Ctor({
    color: k.color, metalness: k.metal, roughness: Math.min(1, k.rough / ROUGH_MEAN), map: T.map, roughnessMap: T.rough,
    normalMap: T.normal, normalScale: new THREE.Vector2(k.nrm, k.nrm),
  });
  if (k.clearcoat) { m.clearcoat = k.clearcoat; m.clearcoatRoughness = k.ccRough; }
  m.name = 'gun:' + kind; return m;
}
// materiały specjalne
export function lensMat() {                                       // szkło z powłoką antyrefleksyjną (fioletowo-zielony połysk)
  return new THREE.MeshPhysicalMaterial({ name: 'gun:lens', color: 0x05080c, metalness: 0, roughness: .04, clearcoat: 1, clearcoatRoughness: .02,
    iridescence: .9, iridescenceIOR: 1.6, iridescenceThicknessRange: [220, 520], envMapIntensity: 1.6, specularIntensity: 1 });
}
export function paintMat(color = 0xf2f1ea, glow = 0x2a2a28) { return new THREE.MeshStandardMaterial({ name: 'gun:paint', color, roughness: .55, metalness: 0, emissive: glow }); }
export function glowMat(color) { return new THREE.MeshBasicMaterial({ name: 'gun:glow', color, toneMapped: false }); }   // włókno światłowodowe / tryt

// ---------------- zgodność ze starymi modelami ----------------
export function canvasTex(w, h, draw, repeat = [1, 1], srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}
// (dawne proste tekstury – teraz zwracają tekstury z biblioteki w podobnej skali)
export function woodTexture(base = [122, 74, 38], dark = [74, 40, 18]) { return texFor('wood', .3, { light: base, dark }).map; }
export function stippleBump() { return texFor('stipple', .035, {}).normal; }
export function metalNoise() { return texFor('metal', .09, {}).rough; }
