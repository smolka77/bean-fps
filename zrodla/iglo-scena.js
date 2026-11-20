// Wygląd mapy IGLOO (1v1): zimowy obóz nad zamarzniętym jeziorem w mroźne, słoneczne popołudnie. Budowana w kodzie (low poly, płaskie kolory).
// Układ, kolizje i spawny są w zrodla/iglo-data.js – grafika używa tych samych liczb, więc siedzi dokładnie w bryłach kolizji.
// Strona A jest budowana raz i odbijana na stronę B (scale z = −1); napisy (tekstury) dostają osobną siatkę dla każdej strony.
// Siatki oznaczone userData.deco (płoty, flagi, sople, kępki, wszystko poza polem gry) nie biorą udziału w trafieniach.
// Niebo, mgła, światło, padający śnieg i góry na horyzoncie: themeSnow w zrodla/klimaty.js.
import * as THREE from 'three';
import { Kit, M4, V3, between, jitter, rng, mats } from './klimaty.js';
import { HX, HZ, LAND, LAKE, RIDGE, STEPS, IGLOO, CABIN, CABIN_WALLS, HUT, BOAT, ICE_BLOCKS, OBJECTS, localBoxes, baseY } from './iglo-data.js';

const PI = Math.PI, UP = V3(0, 1, 0);
const MZ = new THREE.Matrix4().makeScale(1, 1, -1);                 // odbicie strony A na stronę B
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];
const inField = (x, z, m = 0) => Math.abs(x) < HX + m && Math.abs(z) < HZ + m;

// ---------------- kolory ----------------
const SNOW = ['#f3f7fb', '#eef3f9', '#f6f9fc', '#e9f0f7', '#f0f5fa'];
const TRAMPLED = ['#dde5ee', '#d6e0ea', '#e2e9f1'];
const BLOCK = ['#f7fafd', '#edf3f9', '#e4edf6', '#f2f7fc', '#e8f0f8', '#dde8f3'];
const MORTAR = '#bfd0e0';
const ICE = ['#cfe9f5', '#c2e3f2', '#d8eef8', '#b6dcef', '#c9e6f4'];
const ROCK = ['#7d8794', '#6f7a88', '#8a95a1', '#66707d', '#939daa'];
const PINE = ['#2f6b4a', '#3a7d55', '#285e40', '#357452'];
const RED = ['#b8392e', '#a9332a', '#c2402f', '#9f2f27'];
const TRIM = '#f2efe8';
const WOOD = ['#a87a4c', '#b5885a', '#9a6c40', '#c09060', '#a07448'];
const BARK = ['#6b4a32', '#5e412c', '#77553a'];
const SLATE = '#3b4250';
const GLASS = '#1b2a3a';
const ICICLE = '#cfeaf7';

// ---------------- materiały ----------------
let GLOSS = null, TERRAIN = null, ICEMAT = null;
function materials() {
  if (!GLOSS) {
    GLOSS = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.25, metalness: 0.25, side: THREE.DoubleSide });
    TERRAIN = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0 });
    ICEMAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.16, metalness: 0.12 });
  }
  return { GLOSS, TERRAIN, ICEMAT };
}

// ---------------- pomocniki geometrii ----------------
const objM = (x, y, z, rot = 0) => new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromAxisAngle(UP, rot), V3(1, 1, 1));
function local(OM) {
  const P = (lx, ly, lz, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => OM.clone().multiply(M4(lx, ly, lz, rx, ry, rz, sx, sy, sz));
  P.pt = (lx, ly, lz) => V3(lx, ly, lz).applyMatrix4(OM);
  return P;
}
const rod = (K, a, b, r0, r1, col, seg = 6) => { const [m, len] = between(a, b); K.add(new THREE.CylinderGeometry(r1, r0, len, seg, 1), col, m); };
function arc(K, a, c, b, r, col, n = 6, seg = 4) {
  const q = (t) => V3().copy(a).multiplyScalar((1 - t) * (1 - t)).addScaledVector(c, 2 * t * (1 - t)).addScaledVector(b, t * t);
  for (let i = 0; i < n; i++) rod(K, q(i / n), q((i + 1) / n), r, r, col, seg);
}
const wire = (K, a, b, sag = 0.4, col = '#2a2a2a', r = 0.018) => arc(K, a, V3((a.x + b.x) / 2, (a.y + b.y) / 2 - sag * 2, (a.z + b.z) / 2), b, r, col, 8, 3);
// bryła z 8 narożników (dół: p[0..3], góra: p[4..7], w tej samej kolejności)
function hexa(K, p, col, kind) {
  const [b0, b1, b2, b3, t0, t1, t2, t3] = p, T = [];
  const q = (a, b, c, d) => T.push(a, b, c, a, c, d);
  q(b0, b1, b2, b3); q(t0, t1, t2, t3); q(b0, b1, t1, t0); q(b1, b2, t2, t1); q(b2, b3, t3, t2); q(b3, b0, t0, t3);
  return K.tris(T, col, kind);
}
// mur z bloków śniegu: bloki z wąskimi szczelinami na ciemniejszym rdzeniu (fugi); along = 'x' albo 'z'
function blockWall(K, x0, y0, z0, x1, y1, z1, rand, { course = 0.4, len = 0.62, gap = 0.03, cols = BLOCK, core = MORTAR } = {}) {
  const alongX = x1 - x0 >= z1 - z0, L = alongX ? x1 - x0 : z1 - z0, nC = Math.max(1, Math.round((y1 - y0) / course)), ch = (y1 - y0) / nC;
  K.box(x1 - x0 - 0.06, y1 - y0 - 0.04, z1 - z0 - 0.06, core, M4((x0 + x1) / 2, (y0 + y1) / 2 - 0.01, (z0 + z1) / 2));
  for (let k = 0; k < nC; k++) {
    const n = Math.max(1, Math.round(L / len)), bl = L / n, off = k % 2 && n > 1 ? bl / 2 : 0, cuts = [0];
    for (let i = 0; i < n; i++) { const c = off + i * bl; if (c > 0.05 && c < L - 0.05) cuts.push(c); }
    cuts.push(L); cuts.sort((a, b) => a - b);
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i], b = cuts[i + 1], m = (a + b) / 2, y = y0 + (k + 0.5) * ch, c = pick(rand, cols);
      if (alongX) K.box(b - a - gap, ch - gap, z1 - z0, c, M4(x0 + m, y, (z0 + z1) / 2));
      else K.box(x1 - x0, ch - gap, b - a - gap, c, M4((x0 + x1) / 2, y, z0 + m));
    }
  }
}
// siatka wysokości z kolorem na trójkąt (płaskie low poly); hFn: wysokość wierzchołka, colFn: kolor trójkąta, skip: pomiń komórkę
function heightGrid(x0, z0, x1, z1, sx, sz, hFn, colFn, skip) {
  const nx = Math.round((x1 - x0) / sx), nz = Math.round((z1 - z0) / sz), W = nx + 1, H = new Float32Array(W * (nz + 1));
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) H[j * W + i] = hFn(x0 + i * sx, z0 + j * sz);
  const pos = [], col = [], c = new THREE.Color();
  const tri = (ax, az, bx, bz, cx, cz, ha, hb, hc) => {
    if (ha < -1.5 && hb < -1.5 && hc < -1.5) return;
    pos.push(ax, ha, az, bx, hb, bz, cx, hc, cz);
    c.set(colFn((ax + bx + cx) / 3, (az + bz + cz) / 3, (ha + hb + hc) / 3));
    for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
  };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const xa = x0 + i * sx, za = z0 + j * sz, xb = xa + sx, zb = za + sz;
    if (skip && skip((xa + xb) / 2, (za + zb) / 2)) continue;
    const h00 = H[j * W + i], h10 = H[j * W + i + 1], h01 = H[(j + 1) * W + i], h11 = H[(j + 1) * W + i + 1];
    if ((i + j) % 2) { tri(xa, za, xa, zb, xb, za, h00, h01, h10); tri(xb, za, xa, zb, xb, zb, h10, h01, h11); }
    else { tri(xa, za, xa, zb, xb, zb, h00, h01, h11); tri(xa, za, xb, zb, xb, za, h00, h11, h10); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
// geometria strony A + jej odbicie na stronę B, sklejone w jedną
// (odbicie odwraca kolejność wierzchołków – zamieniamy 2. i 3. wierzchołek trójkąta, żeby teren nadal był widoczny od góry)
const withMirror = (g) => { const m = g.clone(); m.applyMatrix4(MZ); flipWinding(m); const out = mergeTwo(g, m); out.computeVertexNormals(); out.computeBoundingSphere(); return out; };
function flipWinding(g) {
  for (const k of ['position', 'color']) {
    const A = g.attributes[k].array;
    for (let t = 0; t < A.length; t += 9) for (let c = 0; c < 3; c++) { const v = A[t + 3 + c]; A[t + 3 + c] = A[t + 6 + c]; A[t + 6 + c] = v; }
  }
}
function mergeTwo(a, b) {
  const g = new THREE.BufferGeometry();
  for (const k of ['position', 'color']) {
    const A = a.attributes[k].array, B = b.attributes[k].array, arr = new Float32Array(A.length + B.length);
    arr.set(A, 0); arr.set(B, A.length); g.setAttribute(k, new THREE.BufferAttribute(arr, 3));
  }
  return g;
}

// ---------------- napisy (canvas) ----------------
function signTex(W, H, bg, draw) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, W, H); draw(x, W, H);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function signMesh(w, h, tex) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
  m.userData.deco = true; m.castShadow = false; m.receiveShadow = true;
  return m;
}
// deska z wypalonym napisem (drewno, ciemne litery, biała czapa śniegu na górze)
function plankTex(title, sub, ink = '#2b1d12') {
  return signTex(1024, 300, '#c89a64', (x, W, H) => {
    for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? 'rgba(90,50,20,.13)' : 'rgba(255,240,210,.10)'; x.fillRect(0, i * H / 4, W, H / 4); }
    x.fillStyle = '#f4f8fc'; x.beginPath(); x.moveTo(0, 0); x.lineTo(W, 0); x.lineTo(W, 26);
    for (let k = 20; k >= 0; k--) x.lineTo((k / 20) * W, 20 + 16 * Math.abs(Math.sin(k * 1.7)));
    x.closePath(); x.fill();
    x.strokeStyle = '#6a4424'; x.lineWidth = 12; x.strokeRect(6, 6, W - 12, H - 12);
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = ink;
    x.font = '900 128px Impact, "Arial Black", sans-serif'; x.fillText(title, W / 2, sub ? 138 : 160);
    if (sub) { x.font = '800 44px "Arial Black", Arial, sans-serif'; x.fillText(sub, W / 2, 236); }
  });
}
// szyld stacji: biały z czerwonym napisem i niebieskim paskiem
function stationTex() {
  return signTex(1024, 190, '#f6f4ee', (x, W, H) => {
    x.fillStyle = '#1f5fa8'; x.fillRect(0, H - 34, W, 34);
    x.strokeStyle = '#1f2a36'; x.lineWidth = 10; x.strokeRect(5, 5, W - 10, H - 10);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = 'italic 900 104px Impact, "Arial Black", sans-serif'; x.fillStyle = '#2b1d12'; x.fillText('POLAR BEAN', W / 2 + 4, 76 + 4); x.fillStyle = '#d23a2c'; x.fillText('POLAR BEAN', W / 2, 76);
    x.font = '800 24px "Arial Black", Arial, sans-serif'; x.fillStyle = '#ffffff'; x.fillText('RESEARCH STATION  •  EST. 1977', W / 2, H - 17);
  });
}
// nazwa na burcie łodzi
function hullTex() {
  return signTex(512, 96, '#2f6fbf', (x, W, H) => {
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'italic 900 64px Impact, "Arial Black", sans-serif'; x.fillStyle = '#ffffff'; x.fillText('SNOW BEAN', W / 2, H / 2 + 3);
  });
}

// ======================================================================================================
//                                               teren
// ======================================================================================================
// wydeptane ścieżki strony A (B = odbicie): spawn → przejście w murku, → grań, → chata
const PATHS_A = [
  [[0, -25.5], [-3.4, -21.2], [-1.6, -16.8], [0, -12.4], [0, -8.6], [0, -7]],
  [[-1.6, -16.8], [-6.2, -16.4], [-9.6, -14.8]],
  [[-3.4, -21.2], [-9.2, -22.2], [-13.6, -21.2]],
  [[0, -25.5], [3.2, -22.0], [7.4, -18.8], [11.0, -16.6]],
  [[7.4, -13.6], [5.2, -12.0], [5.4, -9.9], [6.2, -7]],
  [[-13.4, -9.0], [-13.4, -7.0]],
];
function distPath(x, z) {
  const az = -Math.abs(z);                                                        // strona B = odbicie strony A
  let best = 1e9;
  for (const p of PATHS_A) for (let i = 0; i < p.length - 1; i++) {
    const [ax, bz0] = p[i], [bx, bz] = p[i + 1], dx = bx - ax, dz = bz - bz0, t = Math.max(0, Math.min(1, ((x - ax) * dx + (az - bz0) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, az - bz0 - dz * t));
  }
  return best;
}
function snowColor(x, z) {
  const n = vnoise(x * 0.4, z * 0.4), n2 = vnoise(x * 1.9 + 7, z * 1.9), dp = distPath(x + (n - 0.5) * 0.7, z);
  if (dp < 0.75) return TRAMPLED[Math.floor(n2 * TRAMPLED.length) % TRAMPLED.length];
  if (dp < 1.05 && n2 < 0.5) return '#e7edf4';
  if (Math.abs(z) < LAKE + 0.9) return n2 < 0.5 ? '#e6eef6' : '#ecf2f8';         // przy brzegu chłodniej (odbicie lodu)
  return SNOW[Math.floor((n * 0.6 + n2 * 0.4) * SNOW.length) % SNOW.length];
}
// ląd pola gry (strona A, odbita na B): śnieg na LAND z delikatnymi fasetkami; brzeg jeziora schodzi miękkim nawisem na lód
function fieldLand() {
  const h = (x, z) => (z > -LAKE - 0.01 || Math.abs(x) > HX - 0.01 || z < -HZ + 0.01 ? LAND : LAND + (vnoise(x * 1.4, z * 1.4) - 0.5) * 0.035);
  const g = heightGrid(-HX, -HZ, HX, -LAKE, 0.5, 0.5, h, (x, z) => snowColor(x, z));
  // nawis śniegu na brzegu (z LAND na lód, 0,25 m w stronę jeziora)
  const pos = [], col = [], c = new THREE.Color();
  for (let x = -HX; x < HX - 0.01; x += 0.5) {
    const x2 = x + 0.5, j1 = (vnoise(x * 2.1, 3) - 0.5) * 0.06, j2 = (vnoise(x2 * 2.1, 3) - 0.5) * 0.06;
    const rows = [[-LAKE, LAND], [-LAKE + 0.1 + j1, LAND - 0.14], [-LAKE + 0.26 + j1, -0.02]], rows2 = [[-LAKE, LAND], [-LAKE + 0.1 + j2, LAND - 0.14], [-LAKE + 0.26 + j2, -0.02]];
    for (let r = 0; r < 2; r++) {
      const a = [x, rows[r][1], rows[r][0]], b = [x2, rows2[r][1], rows2[r][0]], cc = [x2, rows2[r + 1][1], rows2[r + 1][0]], d = [x, rows[r + 1][1], rows[r + 1][0]];
      pos.push(...a, ...b, ...cc, ...a, ...cc, ...d);
      c.set(r ? '#d9e5f0' : '#e8eff6'); for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
    }
  }
  const sk = new THREE.BufferGeometry(); sk.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sk.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  // wierzch grani (1,5 m)
  const { x0, x1, z0, z1, top } = RIDGE;
  const rg = heightGrid(x0, z0, x1, z1, 0.5, 0.5, (x, z) => (Math.abs(x - x0) < 0.01 || Math.abs(x - x1) < 0.01 || Math.abs(z - z0) < 0.01 || Math.abs(z - z1) < 0.01 ? top : top + (vnoise(x * 1.3, z * 1.3) - 0.5) * 0.04),
    (x, z) => SNOW[Math.floor(vnoise(x * 0.8, z * 0.8) * SNOW.length) % SNOW.length]);
  const all = mergeTwo(mergeTwo(g, sk), rg);
  const m = new THREE.Mesh(withMirror(all), materials().TERRAIN); m.name = 'teren'; m.receiveShadow = true;
  return m;
}
// lód w polu gry (twardy – trafienia) i jezioro poza polem (ozdoba)
function iceColor(x, z) {
  const n = vnoise(x * 0.33, z * 0.33), n2 = vnoise(x * 1.3 + 5, z * 1.3);
  if (n > 0.74) return n2 < 0.5 ? '#e4f2f9' : '#dceef7';                          // przysypane śniegiem placki
  return ICE[Math.floor((n * 0.5 + n2 * 0.5) * ICE.length) % ICE.length];
}
function fieldIce() {
  const g = heightGrid(-HX, -LAKE, HX, LAKE, 1, 1, () => 0.004, iceColor);
  g.computeVertexNormals(); g.computeBoundingSphere();
  const m = new THREE.Mesh(g, materials().ICEMAT); m.name = 'lod'; m.receiveShadow = true;
  return m;
}
// teren poza polem: jezioro ciągnie się na wschód i zachód (rozszerza się), dalej ośnieżone pagórki; grań wychodzi za płot jako wzgórze
function outerLake(x, z) {
  const ax = Math.abs(x); if (ax <= HX) return Math.abs(z) < LAKE;
  const n = (vnoise(x * 0.05, z * 0.05) - 0.5) * 9, hw = LAKE + (ax - HX) * 0.42 + n * Math.min(1, (ax - HX) / 14);
  return Math.abs(z) < hw && ax < 150 + n * 3;
}
function outerH(x, z) {
  const ax = Math.abs(x), az = Math.abs(z);
  if (ax < HX - 0.01 && az < HZ - 0.01) return -2;                                  // pod polem gry
  if (ax <= HX + 0.01 && az <= HZ + 0.01) {                                         // krawędź pola: jak teren pola gry
    if (az < LAKE + 0.01 && ax >= HX - 0.01) return -0.4;
    if (x < 0 && az >= -RIDGE.z1 - 0.01 && az <= -RIDGE.z0 + 0.01 && ax >= HX - 0.01) return RIDGE.top;
    return LAND;
  }
  if (outerLake(x, z)) return -0.4;
  const dx = Math.max(0, ax - HX), dz = Math.max(0, az - HZ), d = Math.hypot(dx, dz);
  let h = LAND;
  if (x < -HX && az > -RIDGE.z1 - 2 && az < -RIDGE.z0 + 2) {                         // grań za płotem rośnie w zbocze
    const f = Math.min(1, Math.min(az - (-RIDGE.z1 - 2), (-RIDGE.z0 + 2) - az) / 2);
    h = Math.max(h, LAND + (RIDGE.top - LAND + dx * 0.22) * f);
  }
  h += Math.max(0, d - 6) * (0.03 + 0.07 * vnoise(x * 0.03, z * 0.03)) + vnoise(x * 0.09, z * 0.09) * Math.min(1, Math.max(0, d - 3) / 10) * 1.6;
  return h;
}
function outerTerrain() {
  const g = heightGrid(-176, -177, 176, 177, 4, 3, outerH, (x, z, y) => {
    const n = vnoise(x * 0.12, z * 0.12);
    if (y < 0) return '#c9dcea';
    return n < 0.3 ? '#e8eff6' : n < 0.65 ? '#f1f5fa' : '#f7fafc';
  });
  g.computeVertexNormals(); g.computeBoundingSphere();
  const m = new THREE.Mesh(g, materials().TERRAIN); m.userData.deco = true; m.receiveShadow = true; m.name = 'snieg-dookola';
  const ice = heightGrid(-180, -182, 180, 182, 4, 7, () => 0, iceColor, (x, z) => Math.abs(x) < HX && Math.abs(z) < LAKE);
  ice.computeVertexNormals(); ice.computeBoundingSphere();
  const mi = new THREE.Mesh(ice, materials().ICEMAT); mi.userData.deco = true; mi.receiveShadow = true;
  return [m, mi];
}

// ======================================================================================================
//                                     grań: skalne ściany i stopnie
// ======================================================================================================
function rockFace(H, D, ax, az, bx, bz, nx, nz, y0, y1, rand) {
  const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, yaw = Math.atan2(ux, uz);
  let s = 0;
  while (s < L - 0.05) {
    const w = Math.min(L - s, 0.55 + rand() * 0.5), m = s + w / 2, out = rand() * 0.05;
    const hh = y1 - y0 - 0.05 - rand() * 0.12, x = ax + ux * m + nx * (out - 0.16), z = az + uz * m + nz * (out - 0.16);
    H.box(0.34, hh, w - 0.02, pick(rand, ROCK), M4(x, y0 + hh / 2, z, 0, yaw));
    if (rand() < 0.55) { const hs = 0.25 + rand() * 0.35; H.box(0.38, hs, w * (0.4 + rand() * 0.4), pick(rand, ROCK), M4(x + nx * 0.02, y0 + 0.2 + rand() * (hh - 0.5), z + nz * 0.02, 0, yaw)); }
    s += w;
  }
  // czapa śniegu z nawisem i śnieg przysypany u stóp ściany
  D.box(0.36, 0.13, L + 0.08, '#f4f8fc', M4((ax + bx) / 2 + nx * 0.03, y1 + 0.03, (az + bz) / 2 + nz * 0.03, 0, yaw));
  for (let t = 0.3; t < L; t += 0.7 + rand() * 0.5) D.add(jitter(new THREE.IcosahedronGeometry(0.3, 0), 0.12, rand), '#eef4fa', M4(ax + ux * t + nx * 0.12, LAND + 0.04, az + uz * t + nz * 0.12, 0, rand() * 6, 0, 1.3, 0.45, 1));
}
function ridge(A, rand) {
  const { H, D } = A, { x0, x1, z0, z1, top } = RIDGE;
  rockFace(H, D, x1, z0, x1, z1, 1, 0, LAND, top, rand);         // ściana od środka mapy
  rockFace(H, D, x0, z0, x1, z0, 0, -1, LAND, top, rand);        // od spawnu
  rockFace(H, D, x0, z1, x1, z1, 0, 1, LAND, top, rand);         // od jeziora
  for (const [a, c, b, d] of STEPS) blockWall(H, a, LAND, c, b, 1.0, d, rand, { course: 0.5, len: 0.8, cols: ['#eef4fa', '#e6eef6', '#f3f7fb'] });
  for (const [a, c, b, d] of STEPS) D.box(b - a + 0.04, 0.05, d - c + 0.04, '#f6f9fc', M4((a + b) / 2, 1.01, (c + d) / 2));
}

// ======================================================================================================
//                                                iglo
// ======================================================================================================
function iglooDome(H, D, G, rand) {
  const { R, T, K, course: h, door, win, winHalf, th } = IGLOO, RI = R - T, HT = K * R, HI = K * RI;
  const rOut = (y) => (y >= HT ? 0 : R * Math.sqrt(1 - (y / HT) ** 2));
  const rIn = (y) => (y >= HI ? 0 : RI * Math.sqrt(1 - (y / HI) ** 2));
  const norm = (a) => { while (a < 0) a += PI * 2; while (a >= PI * 2) a -= PI * 2; return a; };
  // granica bloku: kąt albo płaszczyzna otworu (x = c przy drzwiach, z = c przy strzelnicach) – punkt na promieniu r i wysokości y
  const angB = (a) => ({ a, at: (r, y, ins = 0) => V3(Math.cos(a + ins / Math.max(r, 0.3)) * r, y, Math.sin(a + ins / Math.max(r, 0.3)) * r) });
  // ins > 0 przesuwa punkt w stronę rosnącego kąta (fazowanie zewnętrznej ściany bloku)
  const planeX = (c, zs) => ({ a: norm(Math.atan2(zs * Math.sqrt(Math.max(0, 3.4 ** 2 - c * c)), c)),
    at: (r, y, ins = 0) => { const cc = c - zs * ins; return V3(cc, y, zs * Math.sqrt(Math.max(0.0001, r * r - cc * cc))); } });
  const planeZ = (c, xs) => ({ a: norm(Math.atan2(c, xs * Math.sqrt(Math.max(0, 3.4 ** 2 - c * c)))),
    at: (r, y, ins = 0) => { const cc = c + xs * ins; return V3(xs * Math.sqrt(Math.max(0.0001, r * r - cc * cc)), y, cc); } });
  const bev = 0.03;
  const block = (S, E, ri0, ro0, ri1, ro1, y0, y1, col) => {
    const ib0 = S.at(ri0, y0), ib1 = E.at(ri0, y0), it0 = S.at(ri1, y1), it1 = E.at(ri1, y1);
    const ob0 = S.at(ro0, y0 + bev, bev), ob1 = E.at(ro0, y0 + bev, -bev), ot0 = S.at(ro1, y1 - bev, bev), ot1 = E.at(ro1, y1 - bev, -bev);
    hexa(H, [ib0, ib1, ob1, ob0, it0, it1, ot1, ot0], col);
  };
  const nC = Math.floor(HT / h + 1e-6);
  let capY = HT;
  for (let k = 0; k < nC; k++) {
    const y0 = k * h, y1 = y0 + h, ro0 = rOut(y0), ro1 = rOut(y1), ri0 = rIn(y0), ri1 = rIn(y1);
    if (ro1 < 1.2) { capY = y0; break; }
    const rm = (ro0 + ro1 + ri0 + ri1) / 4;
    // otwory w tej warstwie: [początek, koniec] w kolejności kątów (przeciwnie do wskazówek), z granicami-płaszczyznami
    const holes = [];
    if (y1 <= th + 0.01) for (const zs of [-1, 1]) {                                  // drzwi (tunele): płaszczyzny x = ±door
      const s1 = zs < 0 ? planeX(-door, zs) : planeX(door, zs), s2 = zs < 0 ? planeX(door, zs) : planeX(-door, zs);
      holes.push({ s: s1, e: s2 });
    }
    if (y0 >= win[0] - 0.01 && y1 <= win[1] + 0.01) for (const xs of [1, -1]) {     // strzelnice: płaszczyzny z = ±winHalf
      const s1 = xs > 0 ? planeZ(-winHalf, xs) : planeZ(winHalf, xs), s2 = xs > 0 ? planeZ(winHalf, xs) : planeZ(-winHalf, xs);
      holes.push({ s: s1, e: s2 });
    }
    const arcs = [];
    if (!holes.length) {
      const n = Math.max(6, Math.round((2 * PI * rm) / 0.8)), da = (2 * PI) / n, off = (k % 2) * da / 2;
      for (let i = 0; i < n; i++) arcs.push([angB(off + i * da), angB(off + (i + 1) * da)]);
    } else {
      holes.sort((p, q) => p.s.a - q.s.a);
      for (let i = 0; i < holes.length; i++) {
        const S = holes[i].e, E = holes[(i + 1) % holes.length].s;
        let a0 = S.a, a1 = E.a; if (a1 <= a0) a1 += PI * 2;
        const n = Math.max(1, Math.round(((a1 - a0) * rm) / 0.8)), da = (a1 - a0) / n, off = k % 2 && n > 1 ? da / 2 : 0;
        const cuts = [S]; for (let j = 1; j < n + (off ? 1 : 0); j++) { const a = a0 + j * da - off; if (a > a0 + 0.04 && a < a1 - 0.04) cuts.push(angB(a)); }
        cuts.push(E);
        for (let j = 0; j < cuts.length - 1; j++) arcs.push([cuts[j], cuts[j + 1]]);
      }
    }
    for (const [S, E] of arcs) block(S, E, ri0, ro0, ri1, ro1, y0, y1, pick(rand, BLOCK));
  }
  // czapa na szczycie (od ostatniej warstwy do wierzchołka) – profil elipsy
  const prof = []; for (let i = 0; i < 4; i++) { const y = capY + (HT - capY) * (i / 4); prof.push(new THREE.Vector2(rOut(y), y)); }
  prof.push(new THREE.Vector2(0, HT));
  H.add(new THREE.LatheGeometry(prof.reverse(), 10), '#f4f8fc');
  H.add(new THREE.CircleGeometry(rOut(capY) + 0.02, 10), '#e4edf6', M4(0, capY, 0, PI / 2));
  // wnętrze: podłoga z ubitego śniegu, futra, stos skrzyń z workami i lampion
  D.add(new THREE.CircleGeometry(RI + 0.05, 24), '#e2ecf5', M4(0, 0.012, 0, -PI / 2));
  for (const [x, z, r, c, s] of [[1.7, 1.1, 0.75, '#8a6a4a', 1.3], [-1.6, -1.2, 0.7, '#d9cbb2', 1.25], [-1.5, 1.4, 0.6, '#5f4c3a', 1.4], [1.6, -1.4, 0.55, '#b8a68a', 1.2]])
    D.add(new THREE.CircleGeometry(r, 7), c, M4(x, 0.02, z, -PI / 2, 0, rand() * 6, s, 1, 1));
  H.box(1.0, 0.95, 1.0, '#a87a4c', M4(0, 0.475, 0));
  for (const y of [0.08, 0.87]) D.box(1.02, 0.08, 1.02, '#6a4a2e', M4(0, y, 0));
  H.box(0.86, 0.95, 0.86, '#b5885a', M4(0, 1.425, 0, 0, 0.3));
  for (const y of [1.0, 1.82]) D.box(0.88, 0.07, 0.88, '#6a4a2e', M4(0, y, 0, 0, 0.3));
  for (const [x, z, s] of [[0.62, 0.28, 0.24], [-0.6, -0.34, 0.22], [0.25, -0.62, 0.2], [-0.32, 0.6, 0.23]])
    D.add(jitter(new THREE.IcosahedronGeometry(1, 0), 0.25, rand), '#c9b48a', M4(x, s * 0.9, z, 0, rand() * 6, 0, s, s * 1.2, s));
  D.box(0.24, 0.05, 0.24, '#2b2b2b', M4(0, 1.93, 0)); D.box(0.2, 0.05, 0.2, '#2b2b2b', M4(0, 2.22, 0));
  G.box(0.16, 0.24, 0.16, '#ffd27a', M4(0, 2.07, 0), 'glow');
  for (const [x, z] of [[2.2, 1.4], [-2.2, -1.4], [1.0, 2.5], [-1.0, -2.5]]) { D.add(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 6), '#f4ecd8', M4(x, 0.08, z)); G.box(0.04, 0.07, 0.04, '#ffcf6a', M4(x, 0.19, z), 'glow'); }
}
// tunel strony A (B = odbicie): ściany i strop z bloków, łuk z niebieskich bloków lodu przy wejściu, tabliczka
function iglooTunnel(A, rand) {
  const { H, D } = A, { door: Dr, wall: W, mouth: M, th: TH } = IGLOO;
  for (const s of [1, -1]) blockWall(H, s > 0 ? Dr : -Dr - W, 0, -M, s > 0 ? Dr + W : -Dr, TH, -3.2, rand, { course: IGLOO.course, len: 0.7 });
  blockWall(H, -Dr - W, TH, -M, Dr + W, TH + 0.45, -2.75, rand, { course: 0.45, len: 0.75 });
  // śnieg na stropie i nawis nad wejściem
  D.box(2.6, 0.1, M - 3.0, '#f6f9fc', M4(0, TH + 0.5, -(M + 3.0) / 2));
  D.add(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 6), '#f6f9fc', M4(0, TH + 0.47, -M + 0.02, 0, 0, PI / 2));
  // rama z lodu przy wejściu (lekko przed tunelem)
  const IC = ['#a9dcf0', '#bfe6f6', '#9fd3ec'];
  for (const s of [1, -1]) for (let k = 0; k < 5; k++) D.box(0.5, 0.4, 0.14, pick(rand, IC), M4(s * (Dr + W / 2), 0.21 + k * 0.42, -M - 0.08));
  for (let k = 0; k < 3; k++) D.box(0.84, 0.4, 0.14, pick(rand, IC), M4(-0.86 + k * 0.86, TH + 0.22, -M - 0.08));
  // sople pod nawisem
  for (let x = -1.15; x <= 1.15; x += 0.23) { const len = 0.12 + rand() * 0.28; D.add(new THREE.ConeGeometry(0.035, len, 4), ICICLE, M4(x, TH + 0.35 - len / 2, -M - 0.13, PI)); }
}

// ======================================================================================================
//                                          chata polarna (wschód)
// ======================================================================================================
function cabin(A, root, rand) {
  const { H, D, G } = A, { x0, x1, z0, z1, floor: F, t, eave: E, ridge: RG } = CABIN, zc = (z0 + z1) / 2, hz = (z1 - z0) / 2;
  // podłoga z gankiem: deski w poprzek, cokół z ciemnych desek
  const px0 = 6.2, px1 = x1 + 0.2, pz0 = z0 - 0.4, pz1 = z1 + 0.4, n = Math.round((px1 - px0) / 0.3);
  for (let i = 0; i < n; i++) H.box((px1 - px0) / n - 0.025, 0.07, pz1 - pz0 + (rand() - 0.5) * 0.04, pick(rand, WOOD), M4(px0 + (i + 0.5) * ((px1 - px0) / n), F - 0.035 - rand() * 0.01, (pz0 + pz1) / 2));
  H.box(0.06, F - LAND + 0.05, pz1 - pz0, '#5a4030', M4(px0 + 0.03, (F + LAND) / 2 - 0.05, (pz0 + pz1) / 2));
  for (const z of [pz0, pz1]) H.box(px1 - px0, F - LAND + 0.05, 0.06, '#5a4030', M4((px0 + px1) / 2, (F + LAND) / 2 - 0.05, z));
  D.box(px1 - px0 - 0.6, 0.03, pz1 - pz0 - 0.4, '#5c3f2c', M4((x0 + x1) / 2 + 0.3, F + 0.005, zc));          // ciemniejsza podłoga w środku (bez promieni słońca)
  // ściany z poziomych desek (otwory na drzwi i okna wychodzą z brył kolizji)
  for (const [a, b, c, d, e, f] of CABIN_WALLS) {
    const rows = Math.max(1, Math.round((e - b) / 0.22)), hh = (e - b) / rows, thinZ = f - c < d - a;
    for (let i = 0; i < rows; i++) {
      const y = b + (i + 0.5) * hh, lip = i % 2 ? 0.022 : 0;
      H.box(thinZ ? d - a : d - a + lip, hh - 0.012, thinZ ? f - c + lip : f - c, pick(rand, RED), M4((a + d) / 2, y, (c + f) / 2));
    }
  }
  // białe listwy narożne, ramy otworów, parapety
  for (const sx of [x0, x1]) for (const sz of [z0, z1]) D.box(0.15, E - F, 0.15, TRIM, M4(sx, (E + F) / 2, sz));
  const frameX = (xf, cz, w, y0, y1, sill) => {                                        // otwór w ścianie wzdłuż Z (normalna X)
    D.box(0.08, 0.1, w + 0.2, TRIM, M4(xf, y1 + 0.05, cz)); for (const s of [-1, 1]) D.box(0.08, y1 - y0, 0.1, TRIM, M4(xf, (y0 + y1) / 2, cz + s * (w / 2 + 0.05)));
    if (sill) D.box(0.22, 0.06, w + 0.3, TRIM, M4(xf, y0 - 0.03, cz));
  };
  const frameZ = (zf, cx, w, y0, y1, sill) => {
    D.box(w + 0.2, 0.1, 0.08, TRIM, M4(cx, y1 + 0.05, zf)); for (const s of [-1, 1]) D.box(0.1, y1 - y0, 0.08, TRIM, M4(cx + s * (w / 2 + 0.05), (y0 + y1) / 2, zf));
    if (sill) D.box(w + 0.3, 0.06, 0.22, TRIM, M4(cx, y0 - 0.03, zf));
  };
  frameX(x0 - 0.03, -13.65, 1.3, F, F + 2.15, false); frameX(x0 - 0.03, -12.05, 0.9, F + 1.0, F + 1.9, true);
  frameZ(z1 + 0.03, 11.0, 3.6, F + 1.0, F + 1.9, true); frameZ(z0 - 0.03, 11.05, 1.3, F, F + 2.15, false);
  // okiennice (otwarte, na ścianie) i drzwi otwarte na zewnątrz
  for (const s of [-1, 1]) D.box(0.6, 0.95, 0.05, '#2f4f6f', M4(11.0 + s * 2.15, F + 1.45, z1 + 0.05));
  D.box(0.05, 0.95, 0.5, '#2f4f6f', M4(x0 - 0.05, F + 1.45, -11.35)); D.box(0.05, 0.95, 0.5, '#2f4f6f', M4(x0 - 0.05, F + 1.45, -12.75));
  D.box(0.05, 2.1, 1.25, '#2f4f6f', M4(x0 - 0.07, F + 1.05, -14.95)); D.box(1.25, 2.1, 0.05, '#2f4f6f', M4(12.35, F + 1.05, z0 - 0.07));
  // dach dwuspadowy z ciemnej blachy pod grubą warstwą śniegu, sople, kalenica, szczyty z desek
  const hw = hz + 0.35, rise = RG - E, L = Math.hypot(hw, rise), ang = Math.atan2(rise, hw), xm = (x0 + x1) / 2, xl = x1 - x0 + 0.6;
  for (const s of [-1, 1]) {
    H.box(xl, 0.1, L + 0.04, SLATE, M4(xm, (E + RG) / 2 + 0.05, zc + (s * hw) / 2, s * ang));
    const nx = 0, ny = Math.cos(ang), nz = s * Math.sin(ang);
    D.box(xl - 0.1, 0.16, L - 0.12, '#f4f8fc', M4(xm + nx, (E + RG) / 2 + 0.05 + ny * 0.13, zc + (s * hw) / 2 + nz * 0.13, s * ang));
    D.add(new THREE.CylinderGeometry(0.11, 0.11, xl - 0.1, 6), '#f4f8fc', M4(xm, E + 0.1, zc + s * (hw - 0.02), 0, 0, PI / 2));
    for (let x = x0 - 0.2; x <= x1 + 0.2; x += 0.28) if (rand() < 0.8) { const len = 0.12 + rand() * rand() * 0.6; D.add(new THREE.ConeGeometry(0.04, len, 4), ICICLE, M4(x, E - 0.02 - len / 2, zc + s * (hw - 0.03), PI)); }
  }
  D.add(new THREE.CylinderGeometry(0.14, 0.14, xl - 0.05, 6), '#f4f8fc', M4(xm, RG + 0.17, zc, 0, 0, PI / 2));
  const eS = E + 0.35 * (rise / hw);
  for (const x of [x0, x1]) {
    H.tris([V3(x, E, z0), V3(x, E, z1), V3(x, eS, z1), V3(x, E, z0), V3(x, eS, z1), V3(x, eS, z0), V3(x, eS, z0), V3(x, eS, z1), V3(x, RG, zc)], RED[0]);
    for (const s of [-1, 1]) D.box(0.1, 0.12, L, TRIM, M4(x + (x === x0 ? -0.32 : 0.32), (E + RG) / 2 + 0.02, zc + (s * hw) / 2, s * ang));
  }
  // komin z dymem (nad piecem), antena satelitarna i maszt na dachu
  const chx = 13.85, chz = -15.8;
  H.box(0.55, 1.8, 0.55, '#8a4a3a', M4(chx, 4.6, chz)); D.box(0.68, 0.1, 0.68, '#5a3028', M4(chx, 5.55, chz)); D.box(0.66, 0.12, 0.66, '#f4f8fc', M4(chx, 5.66, chz));
  for (let i = 0; i < 5; i++) { const s = 0.18 + i * 0.09; A.R.add(jitter(new THREE.IcosahedronGeometry(s, 0), s * 0.3, rand), '#e9edf2', M4(chx + i * 0.16, 5.95 + i * 0.42, chz + i * 0.05)); }
  D.add(new THREE.CylinderGeometry(0.5, 0.18, 0.14, 10), '#e8e8e8', M4(8.6, 4.75, -12.6, 0.7, 0.6)); D.box(0.06, 0.55, 0.06, '#888', M4(8.6, 4.5, -12.6));
  D.add(new THREE.CylinderGeometry(0.03, 0.04, 2.2, 5), '#555', M4(9.4, 5.9, zc)); D.box(0.7, 0.03, 0.03, '#555', M4(9.4, 6.6, zc)); A.G.box(0.08, 0.08, 0.08, '#ff3a2a', M4(9.4, 7.02, zc), 'glow');
  // ganek: narty i łopata pod ścianą, lampa przy drzwiach
  for (const k of [0, 1]) D.box(0.06, 1.75, 0.1, k ? '#ff4f6a' : '#2ec4b6', M4(x0 - 0.12, F + 0.88, -15.95 - k * 0.16, 0, 0, -0.12));
  D.box(0.04, 1.3, 0.04, '#7a5636', M4(x0 - 0.1, F + 0.7, -10.85, 0, 0, -0.15)); D.box(0.04, 0.32, 0.26, '#3a6ea5', M4(x0 - 0.18, F + 0.14, -10.85, 0, 0, -0.15));
  D.box(0.12, 0.26, 0.12, '#2b2b2b', M4(x0 - 0.12, F + 2.35, -14.55)); G.box(0.08, 0.16, 0.08, '#ffd88a', M4(x0 - 0.12, F + 2.34, -14.55), 'glow');
  // wnętrze: sufit, biurko z radiostacją, piec z rurą, regał z puszkami, skrzynie, żarówka, mapa na ścianie, dywanik
  D.box(x1 - x0 - 0.4, 0.04, z1 - z0 - 0.4, '#6a4a32', M4(xm, E - 0.03, zc));
  H.box(2.0, F + 0.85 - F, 1.0, '#7a5636', M4(12.4, F + 0.425, -14.4)); D.box(2.06, 0.06, 1.06, '#c8a070', M4(12.4, F + 0.87, -14.4));
  D.box(0.7, 0.36, 0.42, '#3a3f46', M4(12.9, F + 1.08, -14.55)); G.box(0.32, 0.16, 0.02, '#7fffb0', M4(12.85, F + 1.12, -14.33), 'glow');
  for (let k = 0; k < 3; k++) G.box(0.04, 0.04, 0.02, ['#ff4f4f', '#ffd23a', '#4fd8ff'][k], M4(13.12 + k * 0.06, F + 0.98, -14.33), 'glow');
  D.box(0.04, 0.6, 0.04, '#222', M4(13.15, F + 1.55, -14.65)); D.box(0.36, 0.2, 0.3, '#c8c8c8', M4(11.9, F + 0.98, -14.5));
  D.box(0.45, 0.06, 0.45, '#5a4030', M4(12.4, F + 0.48, -13.5)); D.box(0.45, 0.5, 0.05, '#5a4030', M4(12.4, F + 0.75, -13.28));
  H.box(0.7, 1.3, 0.8, '#2b2b2e', M4(13.85, F + 0.65, -15.8)); G.box(0.02, 0.22, 0.3, '#ff8a2a', M4(13.49, F + 0.5, -15.8), 'glow');
  D.add(new THREE.CylinderGeometry(0.08, 0.08, E - F - 1.3, 6), '#2b2b2e', M4(13.85, (F + 1.3 + E) / 2, -15.8));
  H.box(0.35, 2.0, 2.4, '#7a5636', M4(14.025, F + 1.0, -13.4));
  for (let k = 0; k < 4; k++) for (let j = 0; j < 7; j++) if (rand() < 0.8) D.box(0.14, 0.18, 0.12, pick(rand, ['#d23a2c', '#ffd23a', '#2ec4b6', '#3a86ff', '#f6f1e6', '#5fae36']), M4(13.78, F + 0.3 + k * 0.48, -14.4 + j * 0.33));
  H.box(1.2, 0.9, 0.7, '#a87a4c', M4(13.6, F + 0.45, -11.55)); D.box(1.22, 0.06, 0.72, '#6a4a2e', M4(13.6, F + 0.6, -11.55));
  D.add(new THREE.CylinderGeometry(0.008, 0.008, 0.4, 4), '#222', M4(11.2, E - 0.23, zc)); G.box(0.12, 0.14, 0.12, '#fff0c0', M4(11.2, E - 0.48, zc), 'glow');
  D.box(1.1, 0.75, 0.02, '#e9e0c8', M4(9.6, F + 1.6, z0 + t + 0.02)); D.box(0.5, 0.3, 0.025, '#7fb8d8', M4(9.4, F + 1.7, z0 + t + 0.025));
  D.add(new THREE.CircleGeometry(0.85, 8), '#2f5a8a', M4(10.0, F + 0.01, -13.6, -PI / 2, 0, 0, 1.4, 1, 1));
  // zaspa za chatą (do granicy mapy) z kopczykami na wierzchu
  H.add(jitter(new THREE.BoxGeometry(HX - x1, 2.4, z1 - z0 + 0.8, 2, 3, 7), 0.12, rand), '#eef4fa', M4((x1 + HX) / 2, 1.2, zc));
  for (let k = 0; k < 6; k++) D.add(jitter(new THREE.IcosahedronGeometry(0.45, 0), 0.15, rand), '#f4f8fc', M4(x1 + 0.5 + rand() * 1.0, 2.35, z0 + 0.3 + k * 1.0, 0, rand() * 6, 0, 1.2, 0.5, 1));
  // szyldy (osobno dla stron A i B)
  for (const s of [1, -1]) {
    const m = signMesh(3.6, 0.67, stationTex()); m.position.set(11.0, F + 2.33, s * (z1 + 0.06)); m.rotation.y = s > 0 ? 0 : PI; root.add(m);
    const w = signMesh(1.7, 0.5, plankTex('STATION 77', null)); w.position.set(x0 - 0.06, F + 2.42, s * -12.1); w.rotation.y = -PI / 2; root.add(w);
  }
}

// ======================================================================================================
//                                 jezioro: budka rybacka, łódź, bloki lodu
// ======================================================================================================
function fishingHut(K, root, rand) {
  const { H, D, G } = K, { x0, x1, z0, z1, h } = HUT, cx = (x0 + x1) / 2;
  H.box(x1 - x0, h - 0.25, z1 - z0, '#f0b429', M4(cx, 0.25 + (h - 0.25) / 2, 0));
  for (let y = 0.5; y < h - 0.1; y += 0.3) { D.box(x1 - x0 + 0.02, 0.025, z1 - z0 + 0.02, '#c98f1a', M4(cx, y, 0)); }
  for (const z of [-1.2, 1.2]) H.box(x1 - x0 + 0.5, 0.12, 0.14, '#5a4632', M4(cx, 0.06, z));
  for (const x of [x0 + 0.3, cx, x1 - 0.3]) H.box(0.16, 0.14, z1 - z0 - 0.1, '#6a5238', M4(x, 0.19, 0));
  for (const [sx, sz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) D.box(0.1, h - 0.25, 0.1, '#ffffff', M4(sx, 0.25 + (h - 0.25) / 2, sz));
  // dach dwuspadowy (kalenica wzdłuż X) ze śniegiem i soplami
  const hw = (z1 - z0) / 2 + 0.25, rise = 0.38, L = Math.hypot(hw, rise), ang = Math.atan2(rise, hw);
  for (const s of [-1, 1]) {
    H.box(x1 - x0 + 0.45, 0.08, L, '#2f6fbf', M4(cx, h + 0.04 + rise / 2, (s * hw) / 2, s * ang));
    D.box(x1 - x0 + 0.35, 0.12, L - 0.1, '#f4f8fc', M4(cx, h + 0.04 + rise / 2 + 0.1 * Math.cos(ang), (s * hw) / 2 + s * 0.1 * Math.sin(ang), s * ang));
    for (let x = x0 - 0.15; x <= x1 + 0.15; x += 0.26) if (rand() < 0.7) { const len = 0.1 + rand() * 0.25; D.add(new THREE.ConeGeometry(0.035, len, 4), ICICLE, M4(x, h - len / 2, s * (hw - 0.02), PI)); }
  }
  for (const x of [x0, x1]) H.tris([V3(x, h, z0), V3(x, h, z1), V3(x, h + rise + 0.02, 0)], '#f0b429');
  // drzwi od strony granicy, okno z ciepłym światłem od strony iglo, rura od piecyka
  D.box(0.04, 1.85, 0.9, '#2b4a6f', M4(x1 + 0.025, 0.25 + 0.95, 0)); D.box(0.06, 0.06, 0.16, '#d8d8d8', M4(x1 + 0.06, 1.2, 0.3));
  D.box(0.04, 0.7, 0.9, TRIM, M4(x0 - 0.02, 1.6, 0)); G.box(0.03, 0.56, 0.76, '#ffcf7a', M4(x0 - 0.03, 1.6, 0), 'glow'); D.box(0.04, 0.05, 0.8, TRIM, M4(x0 - 0.04, 1.6, 0));
  D.add(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 6), '#3a3a3a', M4(x1 - 0.5, h + 0.65, 0.55)); D.add(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 6), '#3a3a3a', M4(x1 - 0.5, h + 1.12, 0.55));
  for (let i = 0; i < 4; i++) { const s = 0.12 + i * 0.07; K.R.add(jitter(new THREE.IcosahedronGeometry(s, 0), s * 0.3, rand), '#e9edf2', M4(x1 - 0.45 + i * 0.12, h + 1.35 + i * 0.33, 0.6)); }
  // przeręble z wędkami po obu stronach (od A i od B)
  for (const s of [-1, 1]) {
    const hx = cx - 0.2, hz = s * 2.35;
    D.add(new THREE.CircleGeometry(0.32, 9), '#1d4f6e', M4(hx, 0.012, hz, -PI / 2));
    for (let k = 0; k < 7; k++) { const a = (k / 7) * PI * 2; D.add(jitter(new THREE.IcosahedronGeometry(0.1, 0), 0.04, rand), '#e8f4fa', M4(hx + Math.cos(a) * 0.4, 0.03, hz + Math.sin(a) * 0.4, 0, 0, 0, 1.4, 0.5, 1)); }
    rod(D, V3(hx + 0.55, 0.05, hz + s * 0.3), V3(hx + 0.1, 1.15, hz - s * 0.05), 0.015, 0.008, '#3a2a1a', 4);
    wire(D, V3(hx + 0.1, 1.15, hz - s * 0.05), V3(hx, 0.02, hz), 0.05, '#dddddd', 0.004);
    D.add(new THREE.CylinderGeometry(0.16, 0.13, 0.32, 8), '#d8402f', M4(x1 + 0.35, 0.16, s * 2.0));
    const sg = signMesh(1.5, 0.44, plankTex('ICE FISHING', null)); sg.position.set(cx, 2.0, s * (z1 + 0.02)); sg.rotation.y = s > 0 ? 0 : PI; root.add(sg);
  }
}
function boat(K, root, rand) {
  const { H, D, G } = K, { x0, x1, bow, beam, deck, cab, cabH, cabBeam } = BOAT;
  const yb = -0.3, bB = 0.8;                                                      // dno (zamarznięte w lodzie) i szerokość dna
  const halfAt = (y) => bB + (beam - bB) * ((y - yb) / (deck - yb));
  const BANDS = [[yb, 0.2, '#c8372d'], [0.2, 0.68, '#2f6fbf'], [0.68, 0.78, '#f4f6f8'], [0.78, deck, '#2f6fbf']];
  for (const [ya, yc, col] of BANDS) {
    const ha = halfAt(ya), hc = halfAt(yc);
    hexa(H, [V3(x0, ya, -ha), V3(bow, ya, -ha), V3(bow, ya, ha), V3(x0, ya, ha), V3(x0, yc, -hc), V3(bow, yc, -hc), V3(bow, yc, hc), V3(x0, yc, hc)], col);
    const ta = x1 - 0.55 * ((deck - ya) / (deck - yb)), tc = x1 - 0.55 * ((deck - yc) / (deck - yb));   // dziób: stewa lekko pochylona
    hexa(H, [V3(bow, ya, -ha), V3(ta, ya, -0.02), V3(ta, ya, 0.02), V3(bow, ya, ha), V3(bow, yc, -hc), V3(tc, yc, -0.02), V3(tc, yc, 0.02), V3(bow, yc, hc)], col);
  }
  // pokład z desek, burty (reling) i sterówka
  const dk = '#b5885a', i = 0.08;
  hexa(H, [V3(x0 + i, deck, -beam + i), V3(bow, deck, -beam + i), V3(bow, deck, beam - i), V3(x0 + i, deck, beam - i), V3(x0 + i, deck + 0.03, -beam + i), V3(bow, deck + 0.03, -beam + i), V3(bow, deck + 0.03, beam - i), V3(x0 + i, deck + 0.03, beam - i)], dk);
  hexa(H, [V3(bow, deck, -beam + i), V3(x1 - 0.25, deck, -0.03), V3(x1 - 0.25, deck, 0.03), V3(bow, deck, beam - i), V3(bow, deck + 0.03, -beam + i), V3(x1 - 0.25, deck + 0.03, -0.03), V3(x1 - 0.25, deck + 0.03, 0.03), V3(bow, deck + 0.03, beam - i)], dk);
  for (const s of [-1, 1]) {
    D.box(bow - x0, 0.1, 0.07, '#f4f6f8', M4((x0 + bow) / 2, deck + 0.08, s * (beam - 0.03)));
    const [m, len] = between(V3(bow, deck + 0.08, s * (beam - 0.03)), V3(x1 - 0.1, deck + 0.08, 0)); D.add(new THREE.BoxGeometry(0.07, len, 0.1), '#f4f6f8', m);
  }
  D.box(0.07, 0.1, beam * 2, '#f4f6f8', M4(x0 + 0.03, deck + 0.08, 0));
  H.box(cab[1] - cab[0], cabH - 0.1 - deck, cabBeam * 2, '#f2f4f6', M4((cab[0] + cab[1]) / 2, (deck + cabH - 0.1) / 2, 0));
  H.box(cab[1] - cab[0] + 0.3, 0.1, cabBeam * 2 + 0.3, '#2b4a6f', M4((cab[0] + cab[1]) / 2, cabH - 0.05, 0));
  D.box(cab[1] - cab[0] + 0.2, 0.1, cabBeam * 2 + 0.2, '#f4f8fc', M4((cab[0] + cab[1]) / 2, cabH + 0.04, 0));
  D.box(0.03, 0.5, cabBeam * 2 - 0.3, GLASS, M4(cab[1] + 0.01, deck + 1.15, 0)); D.box(0.03, 0.5, cabBeam * 2 - 0.3, GLASS, M4(cab[0] - 0.01, deck + 1.15, 0));
  for (const s of [-1, 1]) { D.box(0.55, 0.45, 0.03, GLASS, M4(cab[0] + 0.5, deck + 1.15, s * (cabBeam + 0.01))); D.box(0.55, 0.45, 0.03, GLASS, M4(cab[1] - 0.5, deck + 1.15, s * (cabBeam + 0.01))); }
  D.add(new THREE.TorusGeometry(0.26, 0.07, 6, 12), '#f4f6f8', M4(cab[1] + 0.05, deck + 0.55, 0.42, 0, PI / 2));
  for (let k = 0; k < 4; k++) D.add(new THREE.TorusGeometry(0.26, 0.075, 6, 3, PI / 6), '#e8402a', M4(cab[1] + 0.05, deck + 0.55, 0.42, 0, PI / 2, k * PI / 2));
  // maszt z flagą i lampą, antena, boje i sieć na pokładzie
  D.add(new THREE.CylinderGeometry(0.05, 0.06, 3.0, 6), '#e8e8e8', M4(-9.9, deck + 1.5, 0)); D.box(0.05, 0.05, 1.2, '#e8e8e8', M4(-9.9, deck + 2.3, 0));
  D.tris([V3(-9.9, deck + 2.95, 0), V3(-9.9, deck + 2.6, 0), V3(-9.1, deck + 2.78, 0.05)], '#ff7a2a'); G.box(0.1, 0.12, 0.1, '#fff2b0', M4(-9.9, deck + 3.06, 0), 'glow');
  D.add(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 4), '#555', M4(cab[0] + 0.4, cabH + 0.6, 0.4));
  for (const [x, z, c] of [[-13.0, 0.75, '#ff7a2a'], [-13.0, -0.7, '#ffd23a'], [-10.2, 0.85, '#ff7a2a']]) D.add(new THREE.IcosahedronGeometry(0.17, 1), c, M4(x, deck + 0.17, z));
  D.add(jitter(new THREE.BoxGeometry(0.9, 0.18, 0.7, 2, 1, 2), 0.06, rand), '#3f6a5a', M4(-10.4, deck + 0.1, -0.35, 0, 0.4));
  for (const [x, z, w, d] of [[-12.0, 0.95, 1.4, 0.16], [-9.6, -0.5, 0.7, 0.4], [-13.2, 0, 0.3, 1.0]]) D.box(w, 0.05, d, '#f4f8fc', M4(x, deck + 0.05, z));
  // spiętrzony lód wokół kadłuba
  for (let k = 0; k < 26; k++) {
    const t = rand(), onSide = rand() < 0.75, x = onSide ? x0 + t * (x1 - 0.4 - x0) : x0 - 0.2, s = rand() < 0.5 ? -1 : 1;
    const z = onSide ? s * (x > bow ? Math.max(0.15, beam * (1 - (x - bow) / (x1 - bow))) + 0.2 : beam + 0.15 + rand() * 0.2) : (rand() - 0.5) * 2;
    K.R.add(jitter(new THREE.BoxGeometry(0.4 + rand() * 0.4, 0.12 + rand() * 0.15, 0.3 + rand() * 0.3), 0.08, rand), pick(rand, ['#d8eef8', '#c2e3f2', '#e8f4fa']), M4(x, 0.05, z, rand() * 0.4, rand() * 6, rand() * 0.4));
  }
  for (const s of [1, -1]) { const m = signMesh(1.5, 0.28, hullTex()); m.position.set(-10.15, 0.5, s * (halfAt(0.5) + 0.012)); m.rotation.set(s * 0.27, s > 0 ? 0 : PI, 0); root.add(m); }
}
function iceBlocks(A, rand) {
  const { HG, D } = A, IC = ['#a9dcf0', '#bfe6f6', '#9fd3ec', '#b4e1f4'];
  for (const [x, z] of ICE_BLOCKS) {
    HG.box(1.74, 0.84, 0.84, '#8cc6e2', M4(x, 0.44, z));
    for (const s of [-1, 1]) HG.box(0.87, 0.88, 0.9, pick(rand, IC), M4(x + s * 0.45, 0.45, z));
    HG.box(0.88, 0.88, 0.84, pick(rand, IC), M4(x, 1.35, z, 0, 0.04));
    D.box(0.8, 0.04, 0.7, '#f4f8fc', M4(x + 0.02, 1.81, z));
    for (const s of [-1, 1]) D.box(0.6, 0.03, 0.5, '#eef6fb', M4(x + s * 0.55, 0.91, z + 0.05));
  }
}

// ======================================================================================================
//                                         obiekty na lądzie
// ======================================================================================================
function pine(H, D, x, y, z, s, rand, deco = false) {
  const T = deco ? D : H, rot = rand() * 6;
  T.add(new THREE.CylinderGeometry(0.16 * s, 0.24 * s, 1.3 * s, 6), pick(rand, BARK), M4(x, y + 0.6 * s, z));
  const tiers = [[1.25, 0.8, 2.0], [1.0, 1.9, 1.8], [0.72, 2.9, 1.6], [0.45, 3.9, 1.55]], g = pick(rand, PINE);
  tiers.forEach(([r, b, hh], i) => {
    T.add(new THREE.ConeGeometry(r * s, hh * s, 7), i % 2 ? g : pick(rand, PINE), M4(x, y + (b + hh / 2) * s, z, 0, rot + i * 0.4));
    D.add(new THREE.ConeGeometry(r * s * 0.62, hh * s * 0.42, 7), '#f3f7fb', M4(x, y + (b + hh - hh * 0.21 + 0.03) * s, z, 0, rot + i * 0.4 + 0.2));
  });
}
function rock(H, D, x, y, z, rand, sc = 1) {
  H.add(jitter(new THREE.DodecahedronGeometry(1, 0), 0.25, rand), pick(rand, ROCK), M4(x, y + 0.45 * sc, z, 0, rand() * 6, 0, 0.82 * sc, 0.58 * sc, 0.66 * sc));
  D.add(jitter(new THREE.IcosahedronGeometry(1, 0), 0.2, rand), '#f4f8fc', M4(x, y + 0.86 * sc, z, 0, rand() * 6, 0, 0.6 * sc, 0.2 * sc, 0.5 * sc));
}
function buildObject(o, A, rand) {
  const { H, D, G } = A, y = baseY(o), x = o.x, z = o.z;
  switch (o.t) {
    case 'woodpile': {
      const w = o.w, rows = 6, rh = 1.5 / rows, n = Math.floor(w / 0.26);
      for (let j = 0; j < rows; j++) for (let i = 0; i < n - (j % 2); i++) {
        const lx = x - w / 2 + 0.13 + i * 0.26 + (j % 2) * 0.13, ly = y + rh / 2 + j * rh, r = 0.115 + rand() * 0.015;
        H.add(new THREE.CylinderGeometry(r, r, 0.98, 6), pick(rand, BARK), M4(lx, ly, z, PI / 2, rand() * 3, 0));
        for (const s of [-1, 1]) D.add(new THREE.CircleGeometry(r * 0.85, 6), pick(rand, ['#e2c294', '#d8b480', '#ecd0a4']), M4(lx, ly, z + s * 0.495, 0, s > 0 ? 0 : PI, 0));
      }
      for (const s of [-1, 1]) for (const dz of [-0.45, 0.45]) D.box(0.09, 1.65, 0.09, '#5a4632', M4(x + s * (w / 2 + 0.05), y + 0.82, z + dz));
      D.add(jitter(new THREE.BoxGeometry(w + 0.1, 0.16, 1.05, 6, 1, 2), 0.06, rand), '#f4f8fc', M4(x, y + 1.56, z));
      break;
    }
    case 'fort': {
      blockWall(H, x - o.w / 2, y, z - 0.3, x + o.w / 2, y + 0.8, z + 0.3, rand, { course: 0.4, len: 0.62 });
      for (const [a, b, c, d, e, f] of localBoxes(o).slice(1)) blockWall(H, x + a, y + b, z + c, x + d, y + e, z + f, rand, { course: 0.45, len: 1 });
      D.box(o.w + 0.04, 0.04, 0.64, '#f6f9fc', M4(x, y + 0.82, z));
      // zapas śnieżek za murkiem (od strony spawnu)
      for (let k = 0; k < 6; k++) { const row = k < 3 ? 0 : k < 5 ? 1 : 2, ix = row === 0 ? k : row === 1 ? k - 3 : 0; D.add(new THREE.IcosahedronGeometry(0.1, 1), '#f6f9fc', M4(x - 0.2 + ix * 0.2 + row * 0.1, y + 0.1 + row * 0.16, z - 0.62)); }
      break;
    }
    case 'snowman': {
      for (const [r, cy] of [[0.62, 0.55], [0.45, 1.45], [0.32, 2.12]]) H.add(jitter(new THREE.IcosahedronGeometry(r, 1), 0.035, rand), '#f6f9fc', M4(x, y + cy, z));
      for (const s of [-1, 1]) D.add(new THREE.IcosahedronGeometry(0.04, 0), '#1d1d1f', M4(x + s * 0.11, y + 2.2, z + 0.28));
      D.add(new THREE.ConeGeometry(0.05, 0.32, 6), '#ff7a1a', M4(x, y + 2.12, z + 0.45, PI / 2));
      for (let k = 0; k < 3; k++) D.add(new THREE.IcosahedronGeometry(0.045, 0), '#1d1d1f', M4(x, y + 1.25 + k * 0.17, z + 0.43 - Math.abs(k - 1) * 0.02));
      D.add(new THREE.TorusGeometry(0.31, 0.07, 5, 10), '#d8402f', M4(x, y + 1.86, z, PI / 2)); D.box(0.14, 0.42, 0.05, '#d8402f', M4(x + 0.18, y + 1.68, z + 0.3, 0.1, 0, 0.15));
      D.add(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 10), '#1d1d1f', M4(x, y + 2.4, z)); D.add(new THREE.CylinderGeometry(0.15, 0.15, 0.28, 10), '#1d1d1f', M4(x, y + 2.55, z)); D.add(new THREE.CylinderGeometry(0.152, 0.152, 0.05, 10), '#d8402f', M4(x, y + 2.45, z));
      for (const s of [-1, 1]) { rod(D, V3(x + s * 0.38, y + 1.5, z), V3(x + s * 0.95, y + 1.95, z + 0.05), 0.025, 0.018, '#5a3a22', 4); rod(D, V3(x + s * 0.8, y + 1.83, z + 0.03), V3(x + s * 0.92, y + 2.05, z + 0.12), 0.015, 0.01, '#5a3a22', 4); }
      break;
    }
    case 'sled': {
      for (const s of [-1, 1]) { H.box(2.1, 0.06, 0.06, '#5a4632', M4(x, y + 0.04, z + s * 0.42)); D.add(new THREE.TorusGeometry(0.16, 0.03, 4, 8, PI), '#5a4632', M4(x + 1.05, y + 0.19, z + s * 0.42, 0, 0, -PI / 2)); for (const dx of [-0.7, 0, 0.7]) H.box(0.06, 0.24, 0.06, '#5a4632', M4(x + dx, y + 0.16, z + s * 0.42)); }
      H.box(2.1, 0.06, 1.0, '#c8372d', M4(x, y + 0.3, z));
      H.box(0.95, 0.65, 0.9, '#a87a4c', M4(x - 0.52, y + 0.65, z)); H.box(0.95, 0.6, 0.86, '#b5885a', M4(x + 0.52, y + 0.63, z, 0, 0.05));
      H.box(0.9, 0.5, 0.8, '#9a6c40', M4(x - 0.45, y + 1.2, z, 0, -0.06));
      for (const [cx, cy, w, d] of [[-0.52, 0.97, 0.97, 0.92], [0.52, 0.93, 0.97, 0.88], [-0.45, 1.45, 0.92, 0.82]]) D.box(w, 0.05, d, '#6a4a2e', M4(x + cx, y + cy, z));
      wire(D, V3(x + 1.0, y + 0.35, z - 0.42), V3(x + 1.0, y + 0.35, z + 0.42), 0.02, '#c8a070', 0.02);
      D.box(0.9, 0.05, 0.8, '#f4f8fc', M4(x - 0.45, y + 1.48, z));
      break;
    }
    case 'pine': pine(H, D, x, y, z, o.s || 1, rand); break;
    case 'rock': rock(H, D, x, y, z, rand); break;
    case 'lamp': {
      H.add(new THREE.CylinderGeometry(0.06, 0.09, 3.0, 6), '#2b2b2e', M4(x, y + 1.5, z)); D.add(new THREE.CylinderGeometry(0.16, 0.2, 0.2, 6), '#2b2b2e', M4(x, y + 0.1, z));
      D.box(0.28, 0.08, 0.28, '#2b2b2e', M4(x, y + 3.02, z)); G.box(0.2, 0.3, 0.2, '#ffe2a0', M4(x, y + 2.83, z), 'glow'); D.box(0.26, 0.05, 0.26, '#2b2b2e', M4(x, y + 2.66, z));
      D.add(new THREE.ConeGeometry(0.2, 0.14, 4), '#f4f8fc', M4(x, y + 3.13, z, 0, PI / 4));
      break;
    }
  }
}

// ======================================================================================================
//                       drobiazgi na śniegu, granice pola, świat dookoła
// ======================================================================================================
let BLOCKS = null;
const blockedXZ = (x, z, m = 0.3) => BLOCKS.some((b) => b[4] > LAND + 0.02 && b[1] < 2 && x > b[0] - m && x < b[3] + m && z > b[2] - m && z < b[5] + m);
function snowDetails(A, rand) {
  const { D, R } = A;
  for (let i = 0; i < 520; i++) {                                                  // kopczyki śniegu i suche źdźbła spod śniegu (strona A)
    const x = (rand() * 2 - 1) * (HX - 0.4), z = -LAKE - 0.6 - rand() * (HZ - LAKE - 1.0);
    if (distPath(x, z) < 1.0 || blockedXZ(x, z, 0.3)) continue;
    const onRidge = x < RIDGE.x1 - 0.3 && z > RIDGE.z0 + 0.3 && z < RIDGE.z1 - 0.3, y = onRidge ? RIDGE.top : LAND;
    if (!onRidge && x < RIDGE.x1 + 0.3 && z > RIDGE.z0 - 0.3 && z < RIDGE.z1 + 0.3) continue;
    if (rand() < 0.6) R.add(jitter(new THREE.IcosahedronGeometry(0.22 + rand() * 0.25, 0), 0.08, rand), pick(rand, ['#f6f9fc', '#eef4fa']), M4(x, y + 0.02, z, 0, rand() * 6, 0, 1.3, 0.32, 1));
    else for (let k = 0; k < 4; k++) { const a = rand() * 6, l = 0.18 + rand() * 0.22; R.tris([V3(x - 0.02, y - 0.02, z), V3(x + 0.02, y - 0.02, z), V3(x + Math.cos(a) * 0.08, y + l, z + Math.sin(a) * 0.08)], pick(rand, ['#b8a070', '#a08a5a', '#c8b07a'])); }
  }
  // ślady sanek od spawnu do sanek ze skrzyniami
  for (let t = 0; t < 1; t += 0.04) for (const s of [-0.42, 0.42]) { const x = 1.0 + t * 2.4, z = -23.5 + t * 7.4; D.box(0.08, 0.008, 0.36, '#cbd8e5', M4(x + s * 0.95, LAND + 0.006, z - s * 0.3, 0, Math.atan2(2.4, 7.4))); }
}
// płot przeciwśnieżny (pomarańczowa siatka na drewnianych słupkach) od (ax, az) do (bx, bz) na wysokości y
function snowFence(K, ax, az, bx, bz, y, rand) {
  const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, yaw = Math.atan2(ux, uz), n = Math.round(L / 0.15);
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; K.D.box(0.03, 1.08, 0.06, i % 2 ? '#ff7a2a' : '#ff8c3a', M4(ax + (bx - ax) * t, y + 0.62, az + (bz - az) * t, 0, yaw)); }
  for (const hy of [0.1, 0.62, 1.15]) K.D.box(0.035, 0.05, L, '#ff6a1a', M4((ax + bx) / 2, y + hy, (az + bz) / 2, 0, yaw));
  for (let s = 0; s <= L + 0.01; s += 2.0) K.D.add(new THREE.CylinderGeometry(0.05, 0.06, 1.45, 5), '#7a5a3a', M4(ax + ux * s, y + 0.62, az + uz * s));
  for (let s = 0.4; s < L; s += 0.9 + rand() * 0.8) K.R.add(jitter(new THREE.IcosahedronGeometry(0.4, 0), 0.15, rand), '#f2f6fa', M4(ax + ux * s, y + 0.05, az + uz * s, 0, rand() * 6, 0, 1.5, 0.45, 0.9));
}
function boundaries(K, A, rand) {
  const B = 0.15;
  snowFence(A, -HX - B, -HZ - B, HX + B, -HZ - B, LAND, rand);
  snowFence(A, HX + B, -HZ - B, HX + B, -LAKE, LAND, rand);
  snowFence(A, -HX - B, -HZ - B, -HX - B, RIDGE.z0, LAND, rand);
  snowFence(A, -HX - B, RIDGE.z0, -HX - B, RIDGE.z1, RIDGE.top, rand);
  snowFence(A, -HX - B, RIDGE.z1, -HX - B, -LAKE, LAND, rand);
  // na lodzie: tyczki z linką i trójkątnymi flagami
  for (const sx of [1, -1]) {
    const x = sx * (HX + B), pts = [];
    for (let z = -LAKE; z <= LAKE + 0.01; z += 2.0) { K.D.add(new THREE.CylinderGeometry(0.05, 0.06, 1.7, 5), '#e8e8e8', M4(x, 0.85, z)); K.D.add(new THREE.CylinderGeometry(0.055, 0.055, 0.25, 5), '#d8402f', M4(x, 1.45, z)); pts.push(z); }
    for (let k = 0; k < pts.length - 1; k++) {
      wire(K.D, V3(x, 1.6, pts[k]), V3(x, 1.6, pts[k + 1]), 0.1, '#333', 0.012);
      for (let f = 0; f < 4; f++) { const z = pts[k] + (f + 0.5) * 0.5, sag = 0.2 * Math.sin(((f + 0.5) / 4) * PI); K.D.tris([V3(x, 1.6 - sag, z - 0.14), V3(x, 1.6 - sag, z + 0.14), V3(x, 1.32 - sag, z)], f % 2 ? '#ffd23a' : '#ff4f3a'); }
    }
  }
}
// za spawnem strony A (B = odbicie): namioty, ognisko, skuter śnieżny; za chatą maszt radiowy
function camp(A, rand) {
  const { D, G, R } = A;
  const tent = (cx, cz, yaw, col, col2) => {
    const P = local(objM(cx, LAND, cz, yaw)), w = 1.1, hh = 1.45, L = 2.4;
    for (const s of [-1, 1]) { const [m, len] = between(P.pt(s * w, 0, 0), P.pt(0, hh, 0)); D.add(new THREE.BoxGeometry(0.04, len, L), col, m); }
    for (const s of [-1, 1]) D.tris([P.pt(-w, 0, s * L / 2), P.pt(w, 0, s * L / 2), P.pt(0, hh, s * L / 2)], col2);
    D.tris([P.pt(-0.35, 0, L / 2 + 0.01), P.pt(0.35, 0, L / 2 + 0.01), P.pt(0, 0.95, L / 2 + 0.01)], '#2b2b2b');
    D.box(0.05, 0.05, L + 0.3, '#555', P(0, hh + 0.02, 0)); D.box(1.3, 0.06, 0.9, '#f4f8fc', P(0.3, hh * 0.55, 0, 0, 0, -0.85));
  };
  tent(-5.6, -31.2, 0.25, '#ff8c2a', '#e06a1a'); tent(4.8, -32.0, -0.35, '#2ec4b6', '#1f9a8f');
  // ognisko: kamienie, polana, płomienie, ławki z bali
  for (let k = 0; k < 9; k++) { const a = (k / 9) * PI * 2; D.add(jitter(new THREE.IcosahedronGeometry(0.16, 0), 0.06, rand), pick(rand, ROCK), M4(Math.cos(a) * 0.55, LAND + 0.08, -31.6 + Math.sin(a) * 0.55)); }
  for (let k = 0; k < 4; k++) { const a = k * PI / 2 + 0.3; rod(D, V3(Math.cos(a) * 0.45, LAND + 0.05, -31.6 + Math.sin(a) * 0.45), V3(0, LAND + 0.45, -31.6), 0.06, 0.04, '#5a3a22', 5); }
  for (const [r, h, c] of [[0.32, 0.8, '#ff7a1a'], [0.2, 0.62, '#ffd23a'], [0.12, 0.42, '#fff2b0']]) G.add(new THREE.ConeGeometry(r, h, 5), c, M4(0, LAND + 0.18 + h / 2, -31.6), 'glow');
  for (const [x, z, yaw] of [[-1.6, -31.3, 0.2], [1.5, -31.9, -0.3], [0.1, -33.2, PI / 2]]) D.add(new THREE.CylinderGeometry(0.2, 0.22, 1.5, 7), pick(rand, BARK), M4(x, LAND + 0.2, z, 0, yaw, PI / 2));
  // skuter śnieżny
  { const P = local(objM(9.6, LAND, -30.6, 0.5));
    D.box(0.8, 0.5, 2.0, '#d8402f', P(0, 0.45, 0)); D.box(0.5, 0.2, 0.9, '#1d1d1f', P(0, 0.78, -0.25)); D.box(0.7, 0.4, 0.05, '#9fd3ec', P(0, 0.85, 0.75, -0.5));
    D.box(0.6, 0.3, 1.2, '#2b2b2b', P(0, 0.22, -0.4)); for (const s of [-1, 1]) D.box(0.12, 0.06, 1.0, '#2b2b2b', P(s * 0.45, 0.04, 1.0)); D.box(0.7, 0.04, 0.05, '#2b2b2b', P(0, 0.95, 0.55)); }
  // maszt radiowy za chatą: kratownica, światła ostrzegawcze, odciągi
  { const mx = 22.5, mz = -14.5, Hm = 17;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) rod(D, V3(mx + sx * 0.6, LAND, mz + sz * 0.6), V3(mx + sx * 0.18, LAND + Hm, mz + sz * 0.18), 0.05, 0.035, '#d8402f', 4);
    for (let y = 1.5; y < Hm; y += 1.5) { const r = 0.6 - (0.42 * y) / Hm; D.box(r * 2, 0.04, 0.04, '#f4f4f4', M4(mx, LAND + y, mz - r)); D.box(r * 2, 0.04, 0.04, '#f4f4f4', M4(mx, LAND + y, mz + r)); D.box(0.04, 0.04, r * 2, '#f4f4f4', M4(mx - r, LAND + y, mz)); D.box(0.04, 0.04, r * 2, '#f4f4f4', M4(mx + r, LAND + y, mz)); }
    for (const y of [Hm * 0.5, Hm]) G.box(0.22, 0.22, 0.22, '#ff2a2a', M4(mx, LAND + y + 0.1, mz), 'glow');
    for (const [dx, dz] of [[6, 4], [-5, 5], [2, -6]]) R.add(new THREE.CylinderGeometry(0.008, 0.008, Math.hypot(dx, dz, Hm * 0.7), 3), '#444', (() => { const [m] = between(V3(mx, LAND + Hm * 0.7, mz), V3(mx + dx, LAND, mz + dz)); return m; })());
    D.add(new THREE.CylinderGeometry(0.9, 0.3, 0.2, 10), '#e8e8e8', M4(mx, LAND + Hm * 0.62, mz + 0.5, 1.1)); }
}
// świat dookoła (bez odbicia): sosny, domki, zaspy; im bliżej pola, tym gęściej
function outerWorld(K, rand) {
  const { D, R } = K;
  let n = 0;
  for (let i = 0; i < 6000 && n < 190; i++) {
    const a = rand() * PI * 2, d = 4 + Math.pow(rand(), 1.5) * 85, x = Math.cos(a) * (HX + d), z = Math.sin(a) * (HZ + d);
    if (inField(x, z, 3.5) || outerLake(x, z) || outerLake(x + 2.5, z) || outerLake(x - 2.5, z) || outerLake(x, z + 2.5) || outerLake(x, z - 2.5)) continue;
    if (Math.hypot(x - 22.5, z + 14.5) < 3 || Math.hypot(x - 22.5, z - 14.5) < 3 || (Math.abs(x) < 12 && Math.abs(z) > HZ && Math.abs(z) < HZ + 8)) continue;   // maszty i obozy za spawnami
    pine(D, D, x, outerH(x, z) - 0.05, z, 0.85 + rand() * 0.75, rand, true); n++;
  }
  // domki w oddali (kolorowe, z dachami w śniegu i ciepłym światłem w oknach)
  for (const [x, z, yaw, col] of [[38, -42, 0.4, '#c8372d'], [46, -30, 1.2, '#f0b429'], [-40, 44, 2.9, '#2f6fbf'], [-48, 30, 2.2, '#c8372d'], [34, 50, 3.6, '#3f8a4a'], [-36, -52, -0.3, '#f0b429']]) {
    if (outerLake(x, z)) continue;
    const y = outerH(x, z) - 0.1, P = local(objM(x, y, z, yaw));
    D.box(4.0, 2.6, 3.2, col, P(0, 1.3, 0));
    for (const s of [-1, 1]) { D.box(4.4, 0.12, 2.15, '#3b4250', P(0, 3.15, s * 0.85, s * 0.62)); D.box(4.3, 0.16, 2.0, '#f4f8fc', P(0, 3.27, s * 0.88, s * 0.62)); }
    for (const s of [-1, 1]) D.tris([P.pt(s * 2.0, 2.6, -1.6), P.pt(s * 2.0, 2.6, 1.6), P.pt(s * 2.0, 3.8, 0)], col);
    K.G.box(0.7, 0.6, 0.03, '#ffcf7a', P(-0.9, 1.5, 1.62), 'glow'); K.G.box(0.7, 0.6, 0.03, '#ffcf7a', P(0.9, 1.5, 1.62), 'glow');
    D.box(0.4, 1.2, 0.4, '#5a4a40', P(1.2, 3.6, -0.6));
  }
}

// ======================================================================================================
export function buildIgloo() {
  const rand = rng(20261120);
  const root = new THREE.Group(); root.name = 'Iglo';
  BLOCKS = [];
  const kit = () => ({ H: new Kit(), HG: new Kit(), D: new Kit(), DG: new Kit(), R: new Kit(), G: new Kit() });
  const K = kit(), A = kit();
  // bryły obiektów (do rozstawiania drobiazgów, tylko strona A)
  for (const o of OBJECTS.filter((q) => q.side === 'A')) for (const [a, b, c, d, e, f] of localBoxes(o)) BLOCKS.push([o.x + a, baseY(o) + b, o.z + c, o.x + d, baseY(o) + e, o.z + f]);
  BLOCKS.push([CABIN.x0 - 1.4, 0, CABIN.z0 - 0.4, HX, 3, CABIN.z1 + 0.4]);
  root.add(fieldLand());
  root.add(fieldIce());
  for (const m of outerTerrain()) root.add(m);
  ridge(A, rand);
  iglooDome(K.H, K.D, K.G, rand);
  iglooTunnel(A, rand);
  cabin(A, root, rand);
  fishingHut(K, root, rand);
  boat(K, root, rand);
  iceBlocks(A, rand);
  for (const o of OBJECTS.filter((q) => q.side === 'A')) buildObject(o, A, rand);
  snowDetails(A, rand);
  boundaries(K, A, rand);
  camp(A, rand);
  outerWorld(K, rand);
  // tabliczki IGLOO przy wejściach (osobno dla stron A i B)
  for (const s of [1, -1]) {
    const P = s * -(IGLOO.mouth + 0.5);
    K.D.add(new THREE.CylinderGeometry(0.05, 0.06, 1.4, 5), '#6a4a2e', M4(1.85, 0.7, P));
    const m = signMesh(1.05, 0.32, plankTex('IGLOO', 'NO SNOWBALLS INSIDE')); m.position.set(1.85, 1.35, P - s * 0.06); m.rotation.y = s > 0 ? PI : 0; root.add(m);
  }
  // strona A + jej odbicie na stronę B
  for (const k of Object.keys(A)) for (const kind of ['solid', 'glow']) for (const g of A[k].L[kind]) K[k].L[kind].push(g, g.clone().applyMatrix4(MZ));
  // siatki: twarde (trafienia), błyszczące (lód), ozdoby z cieniem, ozdoby bez cienia, świecące
  const { SOLID, GLOW } = mats(), { GLOSS: GL } = materials();
  const add = (geo, mat, deco, shadow) => { if (!geo) return; const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = true; m.userData.deco = deco; root.add(m); };
  add(K.H.geometry('solid'), SOLID, false, true);
  add(K.HG.geometry('solid'), GL, false, true);
  add(K.D.geometry('solid'), SOLID, true, true);
  add(K.DG.geometry('solid'), GL, true, true);
  add(K.R.geometry('solid'), SOLID, true, false);
  for (const k of ['H', 'HG', 'D', 'DG', 'R', 'G']) add(K[k].geometry('glow'), GLOW, true, false);
  return root;
}
