// Wspólny warsztat wnętrz map budowanych w kodzie (Jachty, Salon) – tylko grafika, działa w przeglądarce.
//  • Faktury (drewno, marmur, tynk, szczotkowany metal, skóra, tkanina, dywan, tek) są liczone w kodzie do dwóch tekstur
//    danych RGBA (bez plików). Shader nakłada je trójpłaszczyznowo według położenia w świecie, więc geometria nie potrzebuje UV,
//    a cała mapa dalej skleja się w kilka siatek (jedna na materiał = mało wywołań rysowania).
//  • „Lampy” wnętrz: ciepłe światło liczone w tych samych materiałach zamiast prawdziwych świateł three.js (każde takie
//    światło obciążałoby wszystkie materiały sceny). Świecą tylko w pudełkach pomieszczeń, więc nie przechodzą przez ściany.
//  • Bryły: zaokrąglone pudełka z gładkimi normalnymi (poduszki, materace, blaty), normalne z kątem załamania dla brył
//    wyciąganych z profilu (karoserie), gotowe meble (sofa, fotel, stołek barowy, stolik, roślina, lampa, obrazy).
// Plik nie importuje three.js – dostaje THREE z build(THREE) mapy, dzięki czemu serwer meczów nadal wczytuje dane map w Node.

// ---------------------------------------------------------------- faktury ----------------------------------------------------------------
const hash = (x, y, s) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
// szum wartości zawinięty na brzegach (kafelek bez szwów); px, py = liczba oczek w poziomie i pionie
function vnoise(u, v, px, py, s) {
  const x = u * px, y = v * py, xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), x0 = ((xi % px) + px) % px, y0 = ((yi % py) + py) % py, x1 = (x0 + 1) % px, y1 = (y0 + 1) % py;
  const a = hash(x0, y0, s), b = hash(x1, y0, s), c = hash(x0, y1, s), d = hash(x1, y1, s);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
const fbm = (u, v, px, py, oct, s) => { let t = 0, a = 0.5, n = 0; for (let o = 0; o < oct; o++) { t += a * vnoise(u, v, px << o, py << o, s + o * 7); n += a; a *= 0.5; } return t / n; };
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const byte = (x) => Math.round(clamp01(x) * 255);

// tekstura A (512²): R drewno (słoje wzdłuż v), G marmur (żyłki), B tynk/beton (plamy), A szczotkowany metal (rysy wzdłuż u)
function texA(N) {
  const d = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = i / N, v = j / N, k = (j * N + i) * 4;
    const warp = fbm(u, v, 3, 2, 3, 11);
    const ring = 0.5 + 0.5 * Math.sin((u * 18 + warp * 3.2) * Math.PI * 2);
    const streak = vnoise(u, v, 160, 6, 3), fine = vnoise(u, v, 256, 24, 5);
    d[k] = byte(0.56 - 0.2 * Math.pow(ring, 4) + 0.16 * (streak - 0.5) + 0.08 * (fine - 0.5) - 0.06 * (warp - 0.5));
    const mw = fbm(u, v, 4, 4, 5, 21), vein = Math.abs(Math.sin((2 * u + v + mw * 1.7) * Math.PI * 2)), vein2 = Math.abs(Math.sin((u - 3 * v + mw * 2.3) * Math.PI * 2));
    d[k + 1] = byte(0.6 - 0.38 * Math.pow(1 - Math.min(1, vein / 0.07), 1.6) * (vein < 0.07 ? 1 : 0) - 0.18 * (vein2 < 0.035 ? 1 - vein2 / 0.035 : 0) + 0.1 * (mw - 0.5));
    d[k + 2] = byte(0.5 + 0.34 * (fbm(u, v, 6, 6, 5, 31) - 0.5) + 0.1 * (vnoise(u, v, 200, 200, 37) - 0.5));
    d[k + 3] = byte(0.5 + 0.3 * (vnoise(u, v, 4, 320, 41) - 0.5) + 0.2 * (vnoise(u, v, 12, 160, 43) - 0.5));
  }
  return d;
}
// tekstura B (256²): R skóra (drobne pory i zmarszczki), G tkanina (splot), B dywan (runo), A tek (drobne słoje wzdłuż v)
function texB(N) {
  const d = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = i / N, v = j / N, k = (j * N + i) * 4;
    const ridge = 1 - Math.abs(2 * vnoise(u, v, 40, 40, 51) - 1);
    d[k] = byte(0.6 - 0.22 * Math.pow(ridge, 6) + 0.12 * (fbm(u, v, 8, 8, 3, 53) - 0.5) + 0.06 * (vnoise(u, v, 128, 128, 55) - 0.5));
    const wu = Math.sin(u * Math.PI * 2 * 64), wv = Math.sin(v * Math.PI * 2 * 64);
    d[k + 1] = byte(0.52 + 0.16 * (wu * wv > 0 ? Math.abs(wu) : -Math.abs(wv)) + 0.12 * (vnoise(u, v, 128, 128, 61) - 0.5) + 0.06 * (fbm(u, v, 4, 4, 3, 63) - 0.5));
    d[k + 2] = byte(0.5 + 0.34 * (vnoise(u, v, 128, 128, 71) - 0.5) + 0.2 * (vnoise(u, v, 64, 64, 73) - 0.5) + 0.12 * (fbm(u, v, 4, 4, 3, 75) - 0.5));
    const tw = fbm(u, v, 2, 1, 2, 81);
    d[k + 3] = byte(0.55 + 0.22 * (vnoise(u + tw * 0.05, v, 96, 3, 83) - 0.5) + 0.12 * (vnoise(u, v, 220, 12, 85) - 0.5) - 0.14 * Math.pow(0.5 + 0.5 * Math.sin((u * 7 + tw * 1.5) * Math.PI * 2), 8));
  }
  return d;
}
// faktury: id (zapisywany w wierzchołkach), tekstura, maska RGBA, powtórzeń na metr, wpływ na szorstkość
const FAKTURY = {
  wood: [1, 0, [1, 0, 0, 0], 0.85, 0.22], marble: [2, 0, [0, 1, 0, 0], 0.65, 0.4], plaster: [3, 0, [0, 0, 1, 0], 0.3, 0], metal: [4, 0, [0, 0, 0, 1], 2, 0.35],
  leather: [5, 1, [1, 0, 0, 0], 2.2, 0.35], fabric: [6, 1, [0, 1, 0, 0], 2.6, 0], carpet: [7, 1, [0, 0, 1, 0], 1.1, 0], teak: [8, 1, [0, 0, 0, 1], 0.7, 0.25],
};
const cache = new WeakMap();                 // tekstury liczone raz na egzemplarz THREE (obie mapy dzielą te same)
function textures(THREE) {
  let t = cache.get(THREE); if (t) return t;
  const mk = (data, N) => {
    const x = new THREE.DataTexture(data, N, N, THREE.RGBAFormat); x.wrapS = x.wrapT = THREE.RepeatWrapping;
    x.magFilter = THREE.LinearFilter; x.minFilter = THREE.LinearMipmapLinearFilter; x.generateMipmaps = true; x.anisotropy = 4; x.needsUpdate = true; return x;
  };
  t = [mk(texA(512), 512), mk(texB(256), 256)]; cache.set(THREE, t); return t;
}

// ---------------------------------------------------------------- warsztat ----------------------------------------------------------------
export function warsztat(THREE) {
  const TX = textures(THREE), kits = {};
  const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  // macierz: pozycja, obrót (yaw, potem pochylenie, potem przechył), skala
  const M4 = (x, y, z, ry = 0, rx = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(sx, sy, sz));
  const lamps = [], rooms = [];

  // -------- geometria: pozycja + normalna + kolor; wszystko bez indeksów, sklejane na końcu per klucz --------
  function add(key, geo, color, m) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (g === geo && geo.userData.shared) g = geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (m) g.applyMatrix4(m);
    const n = g.attributes.position.count, c = new THREE.Color(color), a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); (kits[key] ||= []).push(g);
    return g;
  }
  // przeniesienie całego zestawu (np. jacht zbudowany w układzie lokalnym -> dwa jachty w świecie)
  function addKit(key, list, m) { for (const g of list) { const c = g.clone(); c.applyMatrix4(m); if (m.determinant() < 0) flipWinding(c); (kits[key] ||= []).push(c); } }
  function flipWinding(g) {
    for (const nm of Object.keys(g.attributes)) {
      const a = g.attributes[nm], s = a.itemSize, arr = a.array;
      for (let t = 0; t < a.count; t += 3) for (let c = 0; c < s; c++) { const i1 = (t + 1) * s + c, i2 = (t + 2) * s + c, tmp = arr[i1]; arr[i1] = arr[i2]; arr[i2] = tmp; }
    }
  }
  const box = (key, col, x0, y0, z0, x1, y1, z1) => {
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1), az = Math.min(z0, z1), bz = Math.max(z0, z1);
    if (bx - ax < 1e-4 || by - ay < 1e-4 || bz - az < 1e-4) return null;
    return add(key, new THREE.BoxGeometry(bx - ax, by - ay, bz - az), col, M4((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2));
  };
  const boxM = (key, col, w, h, d, m) => add(key, new THREE.BoxGeometry(w, h, d), col, m);
  const cyl = (key, col, rt, rb, h, x, y, z, seg = 10, rx = 0, ry = 0, rz = 0, open = false) => add(key, new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), col, M4(x, y, z, ry, rx, rz));
  const tube = (key, col, a, b, r, seg = 6) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length(); if (len < 1e-5) return null;
    return add(key, new THREE.CylinderGeometry(r, r, len, seg, 1, true), col, new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()), new THREE.Vector3(1, 1, 1)));
  };
  // gięta rurka przez punkty (poręcze, łuki lamp); kulki na załamaniach
  const pipe = (key, col, pts, r, seg = 6) => { for (let i = 0; i < pts.length - 1; i++) tube(key, col, pts[i], pts[i + 1], r, seg); for (let i = 1; i < pts.length - 1; i++) add(key, new THREE.SphereGeometry(r, seg, 3), col, M4(...pts[i])); };
  const tris = (key, col, pts) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3)); g.computeVertexNormals(); return add(key, g, col); };
  const quad = (key, col, a, b, c, d) => tris(key, col, [a, b, c, a, c, d]);

  // zaokrąglone pudełko (gładkie normalne na krawędziach); s = liczba segmentów zaokrąglenia
  const rbCache = new Map();
  function rboxGeo(w, h, d, r, s = 2) {
    r = Math.max(0.002, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
    const key = [w, h, d, r, s].map((v) => v.toFixed(4)).join(','); let g = rbCache.get(key);
    if (g) return g;
    const n = 2 * s + 1; g = new THREE.BoxGeometry(1, 1, 1, n, n, n);
    const P = g.attributes.position, N = g.attributes.normal, H = [w / 2, h / 2, d / 2], v = [0, 0, 0], q = [0, 0, 0];
    for (let i = 0; i < P.count; i++) {
      for (let a = 0; a < 3; a++) {
        const c = P.getComponent(i, a), idx = Math.round((c + 0.5) * n), hh = H[a];
        v[a] = idx <= s ? -hh + r * (idx / s) : hh - r * ((n - idx) / s);
        q[a] = Math.max(-hh + r, Math.min(hh - r, v[a]));
      }
      const dx = v[0] - q[0], dy = v[1] - q[1], dz = v[2] - q[2], l = Math.hypot(dx, dy, dz);
      if (l > 1e-6) { P.setXYZ(i, q[0] + (dx / l) * r, q[1] + (dy / l) * r, q[2] + (dz / l) * r); N.setXYZ(i, dx / l, dy / l, dz / l); }
      else P.setXYZ(i, v[0], v[1], v[2]);
    }
    g.deleteAttribute('uv'); g = g.toNonIndexed(); g.userData.shared = true; rbCache.set(key, g); return g;
  }
  const rbox = (key, col, x0, y0, z0, x1, y1, z1, r = 0.04, s = 2) => add(key, rboxGeo(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), r, s), col, M4((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
  const rboxM = (key, col, w, h, d, r, m, s = 2) => add(key, rboxGeo(w, h, d, r, s), col, m);

  // normalne z kątem załamania: wygładza tylko sąsiednie ściany odchylone o mniej niż `deg` (bryły wyciągane z profilu)
  function crease(g, deg = 40) {
    g = g.index ? g.toNonIndexed() : g;
    const P = g.attributes.position, n = P.count, fn = new Float32Array(n * 3), cos = Math.cos((deg * Math.PI) / 180), map = new Map();
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let t = 0; t < n; t += 3) {
      a.fromBufferAttribute(P, t); b.fromBufferAttribute(P, t + 1); c.fromBufferAttribute(P, t + 2);
      const f = b.sub(a).cross(c.sub(a)), l = f.length() || 1; f.divideScalar(l);
      for (let k = 0; k < 3; k++) { fn[(t + k) * 3] = f.x; fn[(t + k) * 3 + 1] = f.y; fn[(t + k) * 3 + 2] = f.z; }
    }
    for (let i = 0; i < n; i++) { const key = Math.round(P.getX(i) * 1e4) + ',' + Math.round(P.getY(i) * 1e4) + ',' + Math.round(P.getZ(i) * 1e4); let l = map.get(key); if (!l) map.set(key, (l = [])); l.push(i); }
    const out = new Float32Array(n * 3);
    for (const l of map.values()) for (const i of l) {
      let x = 0, y = 0, z = 0;
      for (const j of l) { const d = fn[i * 3] * fn[j * 3] + fn[i * 3 + 1] * fn[j * 3 + 1] + fn[i * 3 + 2] * fn[j * 3 + 2]; if (d >= cos) { x += fn[j * 3]; y += fn[j * 3 + 1]; z += fn[j * 3 + 2]; } }
      const L = Math.hypot(x, y, z) || 1; out[i * 3] = x / L; out[i * 3 + 1] = y / L; out[i * 3 + 2] = z / L;
    }
    g.setAttribute('normal', new THREE.BufferAttribute(out, 3)); return g;
  }

  // lampy ułożone pokojami (lampa należy do pierwszego pudełka, w którym stoi; lampy poza pokojami są pomijane)
  let LS = null;
  function lampSet() {
    if (LS && LS.n === lamps.length) return LS;
    const inside = (l, r) => l.x >= r[0] && l.x <= r[3] && l.y >= r[1] && l.y <= r[4] && l.z >= r[2] && l.z <= r[5];
    const list = [], range = [];
    for (const r of rooms) { const s0 = list.length; for (const l of lamps) if (inside(l, r)) list.push(l); range.push([s0, list.length - s0]); }
    if (!rooms.length) range.push([0, 0]);
    return (LS = { n: lamps.length, list, range, max: Math.max(1, ...range.map((q) => q[1])) });
  }

  // -------- jeden materiał na całą mapę: parametry powierzchni są w wierzchołkach --------
  // Każdy klucz (np. 'drewno', 'skora') to zestaw parametrów: szorstkość, metaliczność, faktura (+ jej siła), poświata.
  // Dzięki temu meble z różnych „materiałów” sklejają się w jedną siatkę = jedno wywołanie rysowania (i jedno w cieniu).
  const presets = {};
  // lamps: false = powierzchnia na zewnątrz (pokład, kadłub, dach hali) – shader w ogóle nie liczy lamp (znak vMat.w)
  function preset(key, { tex = null, k = 0.4, rough = 0.6, metal = 0, emis = 0, lamps = true } = {}) { presets[key] = [rough, metal, tex ? FAKTURY[tex][0] + Math.min(0.98, k) : 0, lamps ? emis : -1 - emis]; }
  let UBER = null;
  function uber() {
    if (UBER) return UBER;
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1, metalness: 0 });
    const chP = [new THREE.Vector4()], chM = [new THREE.Vector4()];
    for (const [id, t, mask, sc, rk] of Object.values(FAKTURY)) { chP[id] = new THREE.Vector4(sc, rk, t, 0); chM[id] = new THREE.Vector4(...mask); }
    m.onBeforeCompile = (sh) => {
      const L = lampSet(), NL = L.list.length, NR = Math.max(1, rooms.length);
      Object.assign(sh.uniforms, { uDetA: { value: TX[0] }, uDetB: { value: TX[1] }, uChP: { value: chP }, uChM: { value: chM } });
      if (NL) {
        sh.uniforms.uLP = { value: L.list.map((l) => new THREE.Vector4(l.x, l.y, l.z, 1 / (l.r * l.r))) };   // w = 1/zasięg²
        sh.uniforms.uLC = { value: L.list.map((l) => new THREE.Color(l.c).multiplyScalar(l.i)) };
        // 2 cm zapasu: ściany i sufity leżące dokładnie na granicy pokoju nie migoczą (raz w środku, raz poza)
        sh.uniforms.uRA = { value: rooms.map((r) => new THREE.Vector3(r[0] - 0.02, r[1] - 0.02, r[2] - 0.02)) };
        sh.uniforms.uRB = { value: rooms.map((r) => new THREE.Vector3(r[3] + 0.02, r[4] + 0.02, r[5] + 0.02)) };
        sh.uniforms.uRL = { value: L.range.map(([s0, n]) => new THREE.Vector2(s0, n)) };
      }
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aMat;\nvarying vec4 vMat;\nvarying vec3 vWP;\nvarying vec3 vWN;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvMat = aMat;\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = '#define NLAMP ' + NL + '\n#define NROOM ' + NR + '\n#define MAXL ' + L.max + '\n' + sh.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec4 vMat;
varying vec3 vWP;
varying vec3 vWN;
uniform sampler2D uDetA; uniform sampler2D uDetB; uniform vec4 uChP[9]; uniform vec4 uChM[9];
#if NLAMP > 0
uniform vec4 uLP[NLAMP]; uniform vec3 uLC[NLAMP]; uniform vec3 uRA[NROOM]; uniform vec3 uRB[NROOM]; uniform vec2 uRL[NROOM];
#endif`)
        // faktura: jedna próbka z płaszczyzny najbliższej powierzchni (oś dominująca normalnej)
        .replace('#include <color_fragment>', `#include <color_fragment>
float wDet = 0.5, wRK = 0.0;
float tid = floor(vMat.z + 0.002);
if (tid > 0.5) {
  int ti = int(tid); vec4 cp = uChP[ti]; float tk = clamp(vMat.z - tid, 0.0, 1.0);
  vec3 an = abs(vWN); vec3 q = vWP * cp.x;
  vec2 tp = (an.x > an.y && an.x > an.z) ? q.zy : (an.y > an.z ? q.xz : q.xy);
  vec4 tx = cp.z < 0.5 ? texture2D(uDetA, tp) : texture2D(uDetB, tp);
  wDet = dot(tx, uChM[ti]); wRK = cp.y;
  diffuseColor.rgb *= 1.0 + (wDet - 0.5) * 2.0 * tk;
}`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(vMat.x * (1.0 + (wDet - 0.5) * 2.0 * wRK), 0.03, 1.0);')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vMat.y;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * (vMat.w < 0.0 ? -vMat.w - 1.0 : vMat.w);')
        // lampy: tylko pomieszczenia, w którym leży piksel (lampy są ułożone pokojami: uRL = początek i liczba)
        .replace('#include <opaque_fragment>', `#if NLAMP > 0
{
  int ri = -1;
  for (int r = 0; r < NROOM; r++) { vec3 a = step(uRA[r], vWP) * step(vWP, uRB[r]); if (a.x * a.y * a.z > 0.5) ri = r; }   // pętla o stałej długości (kompilator ją rozwija)
  if (vMat.w < 0.0) ri = -1;                                                                  // powierzchnia bez lamp
  if (ri >= 0) {
    vec3 nn = normalize(vWN) * (gl_FrontFacing ? 1.0 : -1.0); vec3 acc = vec3(0.0);
    int st = int(uRL[ri].x), cnt = int(uRL[ri].y);
    for (int i = 0; i < MAXL; i++) {
      if (i >= cnt) break;
      vec4 lp = uLP[st + i]; vec3 dl = lp.xyz - vWP; float d2 = dot(dl, dl); float f = clamp(1.0 - d2 * lp.w, 0.0, 1.0);   // bez pierwiastka i dzielenia
      acc += uLC[st + i] * (f * f) * (0.3 + 0.7 * max(dot(nn, dl) * inversesqrt(d2 + 1e-4), 0.0));
    }
    outgoingLight += diffuseColor.rgb * acc;
  }
}
#endif
#include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => { const L = lampSet(); return 'wnetrze4-' + L.list.length + '-' + L.max + '-' + rooms.length; };
    return (UBER = m);
  }

  // -------- siatki: jedna na klucz; spec = { materiał, nazwa, trafienia, cień, kolejność } --------
  function merge(list) {
    let n = 0; for (const g of list) n += g.attributes.position.count;
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), K = new Float32Array(n * 3); let o = 0;
    for (const g of list) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); K.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('color', new THREE.BufferAttribute(K, 3));
    out.computeBoundingSphere(); out.computeBoundingBox(); return out;
  }
  // podział kluczy: geometrie spełniające warunek przechodzą do klucza z przyrostkiem (np. osobna siatka bez cienia)
  function split(keys, pred, suffix = '_n') {
    for (const k of keys) { const l = kits[k] || []; kits[k + suffix] = (kits[k + suffix] || []).concat(l.filter(pred)); kits[k] = l.filter((g) => !pred(g)); if (presets[k]) presets[k + suffix] = presets[k]; }
    return keys.map((k) => k + suffix);
  }
  // drobiazg (największy wymiar < lim) albo cienki pręt/listwa (średni wymiar < thin): jego cień i tak ginie, a kosztuje
  const _sz = new THREE.Vector3();
  const small = (lim = 0.3, thin = 0.06) => (g) => { g.computeBoundingBox(); const d = g.boundingBox.getSize(_sz).toArray().sort((a, b) => a - b); return d[2] < lim || d[1] < thin; };

  // siatka z kilku kluczy naraz; atrybut aMat = parametry powierzchni z preset()
  function mergeKeys(keys) {
    const list = [], pm = [];
    for (const k of keys) for (const g of kits[k] || []) { list.push(g); pm.push(presets[k] || [0.6, 0, 0, 0]); }
    if (!list.length) return null;
    const out = merge(list); let n = 0; for (const g of list) n += g.attributes.position.count;
    const A = new Float32Array(n * 4); let o = 0;
    list.forEach((g, i) => { const c = g.attributes.position.count, p = pm[i]; for (let v = 0; v < c; v++) A.set(p, (o + v) * 4); o += c; });
    out.setAttribute('aMat', new THREE.BufferAttribute(A, 4)); return out;
  }
  function mesh(key, material, name, o = {}) {
    const keys = Array.isArray(key) ? key : [key];
    const geo = material === UBER ? mergeKeys(keys) : keys.some((k) => kits[k] && kits[k].length) ? merge(keys.flatMap((k) => kits[k] || [])) : null;
    if (!geo) return null;
    const m = new THREE.Mesh(geo, material); m.name = name;
    m.castShadow = o.cast !== false; m.receiveShadow = o.receive !== false;
    if (o.noHit) m.userData.noHit = true; if (o.deco) m.userData.deco = true; if (o.order) m.renderOrder = o.order;
    if (o.parent) o.parent.add(m); for (const k of keys) kits[k] = []; return m;
  }

  // -------- obrazy na ścianach: atlas płócien malowanych na canvasie (jedna siatka, jedna tekstura) --------
  function artAtlas(paint, cells = 4) {
    if (typeof document === 'undefined') return null;
    const W = 256, cv = document.createElement('canvas'); cv.width = W * cells; cv.height = W; const x = cv.getContext('2d');
    for (let i = 0; i < cells; i++) { x.save(); x.beginPath(); x.rect(i * W, 0, W, W); x.clip(); x.translate(i * W, 0); paint(x, W, i); x.restore(); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const quads = [];
    return {
      // obraz w płaszczyźnie: środek c, wektory połowy szerokości (ux) i wysokości (uy), komórka atlasu i
      put(c, ux, uy, i) { quads.push([c, ux, uy, i]); },
      mesh(name) {
        if (!quads.length) return null;
        const P = [], UV = [], Nn = [];
        for (const [c, ux, uy, i] of quads) {
          const A = [c[0] - ux[0] - uy[0], c[1] - ux[1] - uy[1], c[2] - ux[2] - uy[2]], B = [c[0] + ux[0] - uy[0], c[1] + ux[1] - uy[1], c[2] + ux[2] - uy[2]];
          const C = [c[0] + ux[0] + uy[0], c[1] + ux[1] + uy[1], c[2] + ux[2] + uy[2]], D = [c[0] - ux[0] + uy[0], c[1] - ux[1] + uy[1], c[2] - ux[2] + uy[2]];
          const u0 = (i + 0.02) / cells, u1 = (i + 0.98) / cells, nrm = new THREE.Vector3(...ux).cross(new THREE.Vector3(...uy)).normalize();
          P.push(...A, ...B, ...C, ...A, ...C, ...D); UV.push(u0, 0.02, u1, 0.02, u1, 0.98, u0, 0.02, u1, 0.98, u0, 0.98);
          for (let k = 0; k < 6; k++) Nn.push(nrm.x, nrm.y, nrm.z);
        }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
        const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, side: THREE.DoubleSide })); m.name = name; m.userData.noHit = true; m.castShadow = false; m.receiveShadow = true;
        return m;
      },
    };
  }

  // ================================= meble (układ lokalny: przód = +z, środek w x = 0, podłoga y = 0) =================================
  // wszystkie przyjmują macierz M (położenie i obrót w świecie) i klucze materiałów: k.up (tapicerka), k.wd (drewno), k.mt (metal) itd.
  const T = (m, x, y, z, ry = 0, rx = 0, rz = 0, sx = 1, sy = sx, sz = sx) => m.clone().multiply(M4(x, y, z, ry, rx, rz, sx, sy, sz));
  // sofa/fotel: w × d, oparcie do wysokości h, n poduszek; base = cokół (kolor), feet = nóżki metalowe
  function sofa(M, { w, d, h = 0.85, seat = 0.44, arm = 0.16, armH = 0.62, n = 3, c, c2 = c, pil = null, base = null, feet = null, k = { up: 'skora', mt: 'chrom' }, pillows = 2, back = 0.2 }) {
    const hw = w / 2, hd = d / 2, b0 = base ? 0.1 : 0.12;
    if (base) rboxM(k.base || k.up, base, w - 0.04, b0, d - 0.06, 0.02, T(M, 0, b0 / 2, 0.01), 1);
    else if (feet) for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(k.mt, new THREE.CylinderGeometry(0.018, 0.012, b0, 6), feet, T(M, sx * (hw - 0.08), b0 / 2, sz * (hd - 0.08)));
    rboxM(k.up, c2, w, seat - b0 - 0.1, d, 0.04, T(M, 0, b0 + (seat - b0 - 0.1) / 2, 0), 1);                       // korpus pod poduszkami
    rboxM(k.up, c2, w - 2 * arm + 0.02, h - b0, back, 0.06, T(M, 0, b0 + (h - b0) / 2, -hd + back / 2), 1);          // oparcie
    if (arm > 0) for (const sx of [-1, 1]) rboxM(k.up, c2, arm, armH - b0, d, 0.06, T(M, sx * (hw - arm / 2), b0 + (armH - b0) / 2, 0), 1);
    const iw = w - 2 * arm, cw = iw / n;
    for (let i = 0; i < n; i++) {
      const cx = -iw / 2 + cw * (i + 0.5);
      rboxM(k.up, c, cw - 0.015, 0.13, d - back - 0.02, 0.055, T(M, cx, seat - 0.065, back / 2 + 0.005), 1);       // siedziska
      rboxM(k.up, c, cw - 0.03, h - seat - 0.06, 0.16, 0.07, T(M, cx, (seat + h) / 2 - 0.02, -hd + back + 0.06, 0, -0.12), 1);   // poduszki oparcia
    }
    if (pil) for (let i = 0; i < pillows; i++) { const sx = i % 2 ? 1 : -1; rboxM(k.up, pil[i % pil.length], 0.4, 0.36, 0.12, 0.06, T(M, sx * (iw / 2 - 0.28), seat + 0.2, -hd + back + 0.18, sx * 0.25, -0.25, sx * 0.08), 1); }
  }
  // stołek barowy: podstawa, chromowana noga, okrągłe siedzisko z oparciem
  function stool(M, { h = 0.78, c, mt = '#d8dde6', k = { up: 'skora', mt: 'chrom' }, back = true }) {
    add(k.mt, new THREE.CylinderGeometry(0.2, 0.22, 0.025, 14), mt, T(M, 0, 0.012, 0));
    add(k.mt, new THREE.CylinderGeometry(0.03, 0.035, h - 0.06, 10), mt, T(M, 0, h / 2, 0));
    add(k.mt, new THREE.TorusGeometry(0.17, 0.012, 4, 14), mt, T(M, 0, 0.3, 0, 0, Math.PI / 2));
    add(k.up, new THREE.CylinderGeometry(0.2, 0.18, 0.08, 16), c, T(M, 0, h, 0));
    add(k.up, new THREE.SphereGeometry(0.2, 16, 4, 0, Math.PI * 2, 0, Math.PI / 2.6), c, T(M, 0, h + 0.035, 0, 0, 0, 0, 1, 0.35, 1));
    if (back) { rboxM(k.up, c, 0.34, 0.2, 0.06, 0.03, T(M, 0, h + 0.27, -0.17, 0, 0.12), 1); add(k.mt, new THREE.CylinderGeometry(0.012, 0.012, 0.2, 6), mt, T(M, 0, h + 0.1, -0.17)); }
  }
  // stolik: blat (marmur/drewno) na nodze-kolumnie albo czterech nogach
  function table(M, { w, d, h, top, topK = 'marmur', base, baseK = 'zloto', round = false, legs = false, th = 0.04 }) {
    if (round) add(topK, new THREE.CylinderGeometry(w / 2, w / 2, th, 32), top, T(M, 0, h - th / 2, 0));
    else rboxM(topK, top, w, th, d, Math.min(0.012, th / 2.2), T(M, 0, h - th / 2, 0), 1);
    if (legs) for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(baseK, new THREE.CylinderGeometry(0.02, 0.016, h - th, 8), base, T(M, sx * (w / 2 - 0.06), (h - th) / 2, sz * (d / 2 - 0.06)));
    else {
      add(baseK, new THREE.CylinderGeometry(0.05, 0.05, h - th - 0.03, 12), base, T(M, 0, (h - th) / 2, 0));
      add(baseK, new THREE.CylinderGeometry(Math.min(w, d) * 0.3, Math.min(w, d) * 0.34, 0.03, 24), base, T(M, 0, 0.015, 0));
    }
  }
  // roślina w donicy: liście z trójkątów (kluczem k.lf), donica (k.pot)
  function plant(M, { h = 0.9, r = 0.2, pot, potK = 'lak', lf = ['#2f7a3e', '#3c8f48', '#286a36'], leaves = 9, seed = 1, kind = 'palm', lfK = 'lisc' }) {
    let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    add(potK, new THREE.CylinderGeometry(r, r * 0.78, r * 1.5, 16), pot, T(M, 0, r * 0.75, 0));
    add(potK, new THREE.CylinderGeometry(r * 1.04, r * 1.04, 0.04, 16), pot, T(M, 0, r * 1.5, 0));
    add(lfK, new THREE.CylinderGeometry(r * 0.93, r * 0.93, 0.02, 12), '#3a2a1e', T(M, 0, r * 1.45, 0));
    const top = new THREE.Vector3(0, r * 1.45, 0);
    for (let i = 0; i < leaves; i++) {
      const az = (i / leaves) * Math.PI * 2 + rnd() * 0.5, L = h * (kind === 'orchid' ? 0.35 : 0.55 + rnd() * 0.35), lift = kind === 'palm' ? 1.4 + rnd() * 0.6 : 0.8;
      const dir = new THREE.Vector3(Math.cos(az), 0, Math.sin(az)), side = new THREE.Vector3(-Math.sin(az), 0, Math.cos(az)), st = [];
      for (let j = 0; j <= 5; j++) {
        const t = j / 5, p = top.clone().addScaledVector(dir, L * t * 0.75).addScaledVector(UP, L * (lift * t - 0.9 * t * t));
        const wd = L * (kind === 'palm' ? 0.12 : 0.18) * Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.03));
        st.push([p, p.clone().addScaledVector(side, wd).addScaledVector(UP, -wd * 0.3), p.clone().addScaledVector(side, -wd).addScaledVector(UP, -wd * 0.3)]);
      }
      const pts = []; for (let j = 0; j < 5; j++) { const [c0, l0, r0] = st[j], [c1, l1, r1] = st[j + 1]; pts.push(c0, l0, c1, l0, l1, c1, c0, c1, r0, r0, c1, r1); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap((p) => [p.x, p.y, p.z]), 3)); g.computeVertexNormals();
      add(lfK, g, lf[i % lf.length], M);
    }
  }
  // butelki (np. na półce baru): rząd wzdłuż x
  function bottles(M, { n = 6, step = 0.11, cols = ['#2f6a3a', '#6a2a1c', '#d9b04a', '#1c3a5a', '#e8e4d0', '#4a1c3a'], seed = 3, key = 'szklo_b' }) {
    let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * step, h = 0.24 + rnd() * 0.1, r = 0.035 + rnd() * 0.012, c = cols[Math.floor(rnd() * cols.length)];
      add(key, new THREE.CylinderGeometry(r, r, h, 10), c, T(M, x, h / 2, 0));
      add(key, new THREE.CylinderGeometry(r * 0.35, r, 0.06, 10), c, T(M, x, h + 0.03, 0));
      add(key, new THREE.CylinderGeometry(r * 0.32, r * 0.32, 0.07, 8), c, T(M, x, h + 0.095, 0));
    }
  }
  // kinkiet: płytka + klosz świecący (klucz glow)
  function sconce(M, { mt = '#d9b04a', glow = '#fff1d0', k = { mt: 'zloto', gl: 'glow' } }) {
    rboxM(k.mt, mt, 0.1, 0.22, 0.03, 0.01, T(M, 0, 0, 0.015), 1);
    add(k.mt, new THREE.CylinderGeometry(0.012, 0.012, 0.1, 6), mt, T(M, 0, 0, 0.07, 0, Math.PI / 2));
    add(k.gl, new THREE.CylinderGeometry(0.06, 0.08, 0.16, 14, 1, true), glow, T(M, 0, 0.02, 0.13));
  }
  // lampa stojąca na stole: noga + abażur
  function tableLamp(M, { h = 0.5, mt = '#d9b04a', shade = '#f6ecd8', k = { mt: 'zloto', gl: 'glow', sh: 'tkanina' } }) {
    add(k.mt, new THREE.CylinderGeometry(0.06, 0.08, 0.03, 14), mt, T(M, 0, 0.015, 0));
    add(k.mt, new THREE.CylinderGeometry(0.012, 0.012, h * 0.7, 8), mt, T(M, 0, h * 0.35, 0));
    add(k.sh, new THREE.CylinderGeometry(0.1, 0.15, h * 0.4, 18, 1, true), shade, T(M, 0, h * 0.8, 0));
    add(k.gl, new THREE.CircleGeometry(0.098, 16), '#fff3d6', T(M, 0, h * 0.6, 0, 0, Math.PI / 2));
  }

  return {
    THREE, M4, T, add, addKit, kits, box, boxM, cyl, tube, pipe, tris, quad, rbox, rboxM, rboxGeo, crease, preset, uber, mesh, merge, split, small, artAtlas, flipWinding,
    sofa, stool, table, plant, bottles, sconce, tableLamp,
    // lampy wnętrz: punkt, zasięg (m), kolor, siła; pokoje: pudełka [x0,y0,z0,x1,y1,z1], poza którymi lampy nie świecą
    lamp(x, y, z, r, c = '#ffd9a0', i = 1) { lamps.push({ x, y, z, r, c, i }); },
    room(b) { rooms.push(b); },
    get lamps() { return lamps; },
  };
}
