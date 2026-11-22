// Wygląd mapy MARS (1v1): baza badawcza na lewitującej wyspie z czerwonej skały, w zakurzone marsjańskie popołudnie.
// Low poly i „klockowe” skały (jak reszta gry), układ i kolizje z zrodla/mars-data.js – grafika siedzi w tych samych bryłach.
// Strona A jest budowana raz i odbijana na stronę B (z → −z); rzeczy z napisami (szyldy, skrzynie, lądowiska) – osobno dla każdej strony.
// Siatki z userData.deco (drobiazgi, wszystko poza polem gry) nie biorą udziału w trafieniach.
// Niebo, mgła pyłu, światło, księżyce, dalekie wyspy, pył w powietrzu i dron: themeMars w zrodla/klimaty.js.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Kit, M4, V3, between, rng, mats } from './klimaty.js';
import { HX, HZ, HAB, VEST, MESA, STEPS, SPIRES, PROBE, GREEN, TANKS, ROVER, SOLAR, TOWER, PIPE, PADS, HAB_WALLS, LADDERS, OBJECTS, localBoxes } from './mars-data.js';

const PI = Math.PI;
const MZ = new THREE.Matrix4().makeScale(1, 1, -1);                 // odbicie strony A na stronę B
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];
const pickH = (x, z, arr) => arr[Math.floor(hash(x * 3.1, z * 2.7) * arr.length)];

// ---------------- kolory ----------------
const REG = ['#b8502f', '#ad4829', '#c25a34', '#a54327', '#bb5531', '#b04c2c'];       // regolit
const DUST = ['#cf7a4c', '#d4855a', '#c97048', '#d98e62'];                             // jasny pył
const BASALT = ['#6e3022', '#5f281d', '#7a3726', '#66301f'];                           // ciemny bazalt
const TRACK = ['#8a3a22', '#7f3520', '#94402a'];                                       // koleiny łazika
const ROCK = ['#a9472b', '#9a3f26', '#b5532f', '#8d3822', '#c06238'];
const STRATA = ['#b85a35', '#9e4528', '#c46a3e', '#8a3a24', '#a94e2e', '#7c3220'];   // warstwy skał
const DEEP = ['#6b2b1d', '#5a2418', '#4a1e16', '#3d1a14'];
const WHITE = ['#eceff2', '#e4e8ec', '#f2f4f6'];
const GREY = '#9aa3ab', DARK = '#3b4149', DARKER = '#262a30', STEEL = '#7c858e', ORANGE = '#f0872a', CYAN = '#5ff2e6', GOLD = '#d99a32';
const PLANT = ['#5fbf4a', '#4aa83f', '#6fd05a', '#3f9a3a'];

// ---------------- materiały ----------------
let M = null;
function materials() {
  if (M) return M;
  const tex = (draw, w = 256, h = 256) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  // panele modułu: 2×2 płyty z fugami, nitami, jedna z kratką wentylacji
  const panel = tex((x, W) => {
    const P = W / 2;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const g = x.createLinearGradient(0, j * P, 0, j * P + P); g.addColorStop(0, (i + j) % 2 ? '#eef1f3' : '#e6eaed'); g.addColorStop(1, (i + j) % 2 ? '#e2e6ea' : '#dce1e5');
      x.fillStyle = g; x.fillRect(i * P, j * P, P, P);
      x.strokeStyle = '#aab3bb'; x.lineWidth = 3; x.strokeRect(i * P + 1.5, j * P + 1.5, P - 3, P - 3);
      x.fillStyle = '#b4bcc3'; for (const [a, b] of [[9, 9], [P - 9, 9], [9, P - 9], [P - 9, P - 9]]) { x.beginPath(); x.arc(i * P + a, j * P + b, 2.6, 0, PI * 2); x.fill(); }
    }
    x.fillStyle = '#c3cad0'; x.fillRect(P + 30, 34, 68, 40); x.fillStyle = '#8d969e'; for (let k = 0; k < 6; k++) x.fillRect(P + 34, 38 + k * 6, 60, 2.5);
  });
  const roof = tex((x, W) => {
    x.fillStyle = '#c7cdd2'; x.fillRect(0, 0, W, W); x.strokeStyle = '#9aa3ab'; x.lineWidth = 3;
    for (let k = 0; k <= 4; k++) { x.beginPath(); x.moveTo(k * W / 4, 0); x.lineTo(k * W / 4, W); x.stroke(); }
    x.beginPath(); x.moveTo(0, W / 2); x.lineTo(W, W / 2); x.stroke();
    for (let k = 0; k < 9; k++) { x.fillStyle = `rgba(190,90,50,${0.08 + (k % 3) * 0.05})`; x.beginPath(); x.ellipse((k * 71) % W, (k * 113) % W, 30 + (k % 4) * 10, 12 + (k % 3) * 6, k, 0, PI * 2); x.fill(); }
  });
  const skirt = tex((x, W) => {
    x.fillStyle = '#3e444c'; x.fillRect(0, 0, W, W);
    for (let k = 0; k < 8; k++) { x.fillStyle = k % 2 ? '#4a5159' : '#353b42'; x.fillRect(k * W / 8, 0, W / 16, W); }
    x.fillStyle = '#6b737b'; for (let k = 0; k < 8; k++) { x.beginPath(); x.arc(k * W / 8 + 8, 14, 3, 0, PI * 2); x.fill(); x.beginPath(); x.arc(k * W / 8 + 8, W - 14, 3, 0, PI * 2); x.fill(); }
  });
  const grate = tex((x, W) => {
    x.fillStyle = '#5a616a'; x.fillRect(0, 0, W, W); x.fillStyle = '#23272c';
    const n = 8, c = W / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) x.fillRect(i * c + 4, j * c + 4, c - 8, c - 8);
  });
  const solar = tex((x, W, H) => {
    const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#2a4a8c'); g.addColorStop(0.5, '#1a2f63'); g.addColorStop(1, '#22407a');
    x.fillStyle = g; x.fillRect(0, 0, W, H); x.strokeStyle = '#9fb4d8'; x.lineWidth = 2;
    for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * W / 4, 0); x.lineTo(i * W / 4, H); x.stroke(); }
    for (let j = 0; j <= 6; j++) { x.beginPath(); x.moveTo(0, j * H / 6); x.lineTo(W, j * H / 6); x.stroke(); }
    x.strokeStyle = '#d8dde3'; x.lineWidth = 6; x.strokeRect(3, 3, W - 6, H - 6);
    x.fillStyle = 'rgba(255,255,255,.14)'; x.beginPath(); x.moveTo(0, H * 0.2); x.lineTo(W * 0.4, 0); x.lineTo(W * 0.6, 0); x.lineTo(0, H * 0.45); x.fill();
  });
  const hazard = tex((x, W) => {
    x.fillStyle = '#f2b51a'; x.fillRect(0, 0, W, W); x.fillStyle = '#1d1f23';
    for (const o of [-W, 0, W]) { x.beginPath(); x.moveTo(o, W); x.lineTo(o + W / 2, W); x.lineTo(o + W, 0); x.lineTo(o + W / 2, 0); x.closePath(); x.fill(); }
  }, 64, 64);
  const crate = tex((x, W) => {
    x.fillStyle = '#eceff1'; x.fillRect(0, 0, W, W);
    x.fillStyle = ORANGE; x.fillRect(0, W * 0.62, W, W * 0.14);
    x.strokeStyle = '#8f989f'; x.lineWidth = 10; x.strokeRect(5, 5, W - 10, W - 10);
    x.lineWidth = 4; x.beginPath(); x.moveTo(10, 10); x.lineTo(W - 10, W * 0.6); x.stroke();
    x.fillStyle = '#2c3138'; x.font = '900 46px Impact, "Arial Black", sans-serif'; x.textAlign = 'center'; x.fillText('BSA', W / 2, W * 0.42);
    x.font = '700 15px Arial, sans-serif'; x.fillText('BEAN SPACE AGENCY', W / 2, W * 0.55); x.fillStyle = '#fff'; x.font = '800 18px Arial'; x.fillText('ARES · CARGO 07', W / 2, W * 0.715);
  });
  const screen = tex((x, W, H) => {
    x.fillStyle = '#062a2c'; x.fillRect(0, 0, W, H); x.strokeStyle = '#38f2d6'; x.lineWidth = 3;
    x.beginPath(); for (let k = 0; k <= 32; k++) { const px = 12 + k * (W - 24) / 32, py = H * 0.55 - Math.sin(k * 0.6) * H * 0.15 - (k % 5 === 0 ? 14 : 0); k ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke();
    x.fillStyle = '#38f2d6'; for (let k = 0; k < 6; k++) x.fillRect(14, 12 + k * 9, 30 + (k * 37) % 70, 4);
    x.fillStyle = '#ffb347'; x.fillRect(W - 50, 14, 36, 22);
  }, 256, 160);
  const leds = tex((x, W, H) => {
    x.fillStyle = '#16191d'; x.fillRect(0, 0, W, H);
    for (let j = 0; j < 14; j++) { x.fillStyle = '#23282e'; x.fillRect(8, 6 + j * 18, W - 16, 14);
      for (let i = 0; i < 9; i++) { x.fillStyle = ['#3dff8a', '#3dff8a', '#5ff2e6', '#ffb347', '#3dff8a', '#ff4a4a'][(i * 7 + j * 3) % 6]; x.fillRect(16 + i * 12, 10 + j * 18, 5, 5); } }
  }, 128, 256);
  M = {
    TERRAIN: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 }),
    glass: new THREE.MeshStandardMaterial({ color: '#a8f0d8', roughness: 0.05, metalness: 0.15, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }),
    visor: new THREE.MeshStandardMaterial({ color: '#d8902a', roughness: 0.12, metalness: 0.85 }),
    panel: new THREE.MeshStandardMaterial({ map: panel, roughness: 0.6, metalness: 0.08 }),
    roof: new THREE.MeshStandardMaterial({ map: roof, roughness: 0.55, metalness: 0.25 }),
    skirt: new THREE.MeshStandardMaterial({ map: skirt, roughness: 0.6, metalness: 0.35 }),
    grate: new THREE.MeshStandardMaterial({ map: grate, roughness: 0.5, metalness: 0.5 }),
    solar: new THREE.MeshStandardMaterial({ map: solar, roughness: 0.18, metalness: 0.55 }),
    hazard: new THREE.MeshStandardMaterial({ map: hazard, roughness: 0.65 }),
    crate: new THREE.MeshStandardMaterial({ map: crate, roughness: 0.7 }),
    screen: new THREE.MeshBasicMaterial({ map: screen }),
    leds: new THREE.MeshBasicMaterial({ map: leds }),
  };
  return M;
}

// ---------------- pomocniki geometrii ----------------
const rod = (K, a, b, r0, r1, col, seg = 6, kind) => { const [m, len] = between(a, b); K.add(new THREE.CylinderGeometry(r1, r0, len, seg, 1), col, m, kind); };
// prostopadłościan z teksturą w stałej skali (cell = metry na kafelek tekstury)
function tgeo(w, h, d, cell, m) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) { const f = Math.floor(i / 4), [a, b] = f < 2 ? [d, h] : f < 4 ? [w, d] : [w, h]; uv.setXY(i, (uv.getX(i) * a) / cell, (uv.getY(i) * b) / cell); }
  if (m) g.applyMatrix4(m);
  return g;
}
// odbicie z → −z z odwróceniem kolejności wierzchołków (tekstury bez napisów mogą być odbite)
function mirrorGeo(g) {
  const c = g.clone(); c.applyMatrix4(MZ);
  if (c.index) { const a = c.index.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } c.index.needsUpdate = true; }
  return c;
}
// siatki z teksturami: lista geometrii na materiał; side 'A' = dostanie odbicie na stronę B
class TexKit {
  constructor() { this.L = {}; }
  add(key, geo, mirror = false) { (this.L[key] = this.L[key] || []).push(geo); if (mirror) this.L[key].push(mirrorGeo(geo)); }
  box(key, w, h, d, cell, m, mirror = false) { this.add(key, tgeo(w, h, d, cell, m), mirror); }
  meshes(deco, shadow = true) {
    const out = [], MM = materials();
    for (const [k, l] of Object.entries(this.L)) {
      if (!l.length) continue;
      const g = mergeGeometries(l, false); if (!g) continue; g.computeBoundingSphere();
      const m = new THREE.Mesh(g, MM[k]); m.castShadow = shadow && k !== 'screen' && k !== 'leds'; m.receiveShadow = k !== 'screen' && k !== 'leds'; m.userData.deco = deco; out.push(m);
    }
    return out;
  }
}
function signTex(W, H, bg, draw) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, W, H); draw(x, W, H);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function signMesh(w, h, tex, basic = false) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), basic ? new THREE.MeshBasicMaterial({ map: tex }) : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
  m.userData.deco = true; m.castShadow = false; m.receiveShadow = !basic; return m;
}
const habSign = (title, sub) => signTex(1024, 256, '#eef1f3', (x, W, H) => {
  x.fillStyle = ORANGE; x.fillRect(0, H - 46, W, 46); x.fillStyle = '#2c3138'; x.fillRect(0, 0, 26, H - 46);
  x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillStyle = '#23272d';
  x.font = '900 128px Impact, "Arial Black", sans-serif'; x.fillText(title, 64, 92);
  x.font = '800 34px "Arial Black", Arial, sans-serif'; x.fillStyle = '#5b636b'; x.fillText(sub, 66, 172);
  x.fillStyle = '#fff'; x.font = '800 28px Arial, sans-serif'; x.fillText('BEAN SPACE AGENCY  ·  MARS OUTPOST', 66, H - 22);
});
const padTex = (label) => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512; const x = cv.getContext('2d'), C = 256;
  x.fillStyle = '#968e87'; x.beginPath(); x.arc(C, C, 250, 0, PI * 2); x.fill();
  for (let k = 0; k < 40; k++) { x.fillStyle = `rgba(190,90,50,${0.05 + (k % 4) * 0.03})`; x.beginPath(); x.arc(C + Math.cos(k * 2.4) * (k * 5.5), C + Math.sin(k * 2.4) * (k * 5.5), 18 + (k % 5) * 8, 0, PI * 2); x.fill(); }
  x.strokeStyle = '#f2b51a'; x.lineWidth = 22; x.beginPath(); x.arc(C, C, 210, 0, PI * 2); x.stroke();
  x.strokeStyle = '#ffffff'; x.lineWidth = 8; x.beginPath(); x.arc(C, C, 178, 0, PI * 2); x.stroke();
  x.fillStyle = '#ffffff'; x.font = '900 230px Impact, "Arial Black", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(label, C, C + 12);
  x.fillStyle = ORANGE; for (let k = 0; k < 8; k++) { x.save(); x.translate(C, C); x.rotate(k * PI / 4); x.beginPath(); x.moveTo(-14, -236); x.lineTo(14, -236); x.lineTo(0, -222); x.fill(); x.restore(); }
  x.globalCompositeOperation = 'destination-in'; x.beginPath(); x.arc(C, C, 250, 0, PI * 2); x.fill();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
};

// ---------------- teren: wyspa (kafelki gruntu), koleiny, krater ----------------
// kształt wyspy: prostokąt z poszarpaną krawędzią i zaokrąglonymi rogami (pole gry zawsze w środku)
const EX = 19.5, EZ = 30.5;
function edgeDist(x, z) {
  const ax = Math.abs(x), az = Math.abs(z);
  const dx = EX - vnoise(z * 0.28, 7) * 2.2 - ax, dz = EZ - vnoise(x * 0.33, 13) * 2.0 - az;
  let d = Math.min(dx, dz);
  if (ax > 15 && az > 26) d = Math.min(d, 4.6 - vnoise(x * 0.5, z * 0.5) * 1.2 - Math.hypot(ax - 15, az - 26));
  return d;
}
const inField = (x, z, m = 0) => Math.abs(x) < HX + m && Math.abs(z) < HZ + m;
// koleiny łazika strony A (B = odbicie): łamana od łazika przez środek strony do maszta
const TRACKS = [[[8.1, -5.5], [5.9, -8.4], [5.3, -12.6], [7.4, -16.8], [10.8, -19.4], [13.6, -23.8]], [[12.9, -5.5], [14.6, -6.8], [15.2, -8.2]]];
function trackDist(x, z) {
  z = -Math.abs(z); let best = 9;
  for (const L of TRACKS) for (let i = 0; i < L.length - 1; i++) {
    const [ax, az] = L[i], [bx, bz] = L[i + 1], vx = bx - ax, vz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
    best = Math.min(best, Math.hypot(x - ax - vx * t, z - az - vz * t));
  }
  return best;
}
function groundColor(x, z) {
  const tr = trackDist(x, z);
  if (Math.abs(tr - 0.75) < 0.22) return pickH(x, z, TRACK);
  const cr = Math.hypot(x + 11, z);                                                          // krater z sondą
  if (cr < 4.2) return cr > 3.1 ? pickH(x, z, BASALT) : pickH(x, z, DUST);
  const n = vnoise(x * 0.32 + 5, z * 0.32), n2 = vnoise(x * 1.1 + 40, z * 1.1 - 17);
  if (n < 0.24) return pickH(x, z, BASALT);
  if (n2 > 0.74 || (!inField(x, z) && n2 > 0.6)) return pickH(x, z, DUST);
  return pickH(x, z, REG);
}
function quadGrid(x0, z0, x1, z1, y, cell, col, keep) {
  const pos = [], cols = [], c = new THREE.Color();
  for (let x = x0; x < x1 - 1e-6; x += cell) for (let z = z0; z < z1 - 1e-6; z += cell) {
    const cx = x + cell / 2, cz = z + cell / 2; if (keep && !keep(cx, cz)) continue;
    const a = [x, y, z], b = [x + cell, y, z], cc = [x + cell, y, z + cell], d = [x, y, z + cell];
    pos.push(...a, ...cc, ...b, ...a, ...d, ...cc);
    c.set(col(cx, cz)); for (let k = 0; k < 6; k++) cols.push(c.r, c.g, c.b);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.computeVertexNormals(); g.computeBoundingSphere(); return g;
}
function ground() {
  const out = [];
  const g = quadGrid(-EX - 1, -EZ - 1, EX + 1, EZ + 1, 0, 0.5, groundColor, (x, z) => edgeDist(x, z) > 0 && !inMesaTop(x, z));
  const m = new THREE.Mesh(g, materials().TERRAIN); m.name = 'Teren_Mars'; m.receiveShadow = true; out.push(m);
  // wierzch płaskowyżów (1,5 m) – osobna siatka z kafelków
  const tops = [];
  for (const s of [1, -1]) tops.push(quadGrid(MESA.x0, s > 0 ? MESA.z0 : -MESA.z1, MESA.x1, s > 0 ? MESA.z1 : -MESA.z0, MESA.top, 0.5, groundColor));
  for (const [x0, z0, x1, z1] of STEPS) for (const s of [1, -1]) tops.push(quadGrid(x0, s > 0 ? z0 : -z1, x1, s > 0 ? z1 : -z0, 1.0, 0.5, groundColor));
  const mt = new THREE.Mesh(mergeGeometries(tops, false), materials().TERRAIN); mt.receiveShadow = true; mt.name = 'Teren_Plaskowyz'; out.push(mt);
  return out;
}
const inMesaTop = (x, z) => x > MESA.x0 && x < MESA.x1 && Math.abs(z) > -MESA.z1 && Math.abs(z) < -MESA.z0;

// spód wyspy: klockowe słupy skały z warstwami, przy krawędzi poszarpane i długie (jak sople), w środku grubsze i rzadsze
function underside(K, rand) {
  const col = (k, deep) => (deep ? DEEP[Math.min(DEEP.length - 1, k)] : STRATA[k % STRATA.length]);
  for (let x = -EX - 1; x < EX + 1; x += 1.25) for (let z = -EZ - 1; z < EZ + 1; z += 1.25) {
    const cx = x + 0.625, cz = z + 0.625, ed = edgeDist(cx, cz); if (ed <= -0.3) continue;
    if (ed > 5 && ((Math.round(x / 1.25) % 2) || (Math.round(z / 1.25) % 2))) continue;   // środek: co drugi słup (i tak go nie widać)
    const big = ed > 5 ? 2.5 : 1.25, n = vnoise(cx * 0.4, cz * 0.4);
    let depth = 2.4 + Math.min(1, Math.max(0, ed) / 8) * 12 + n * 4;
    if (hash(cx, cz) > 0.93) depth += 2 + hash(cz, cx) * 5;                                  // sople skały
    let y = -0.02, k = Math.floor(hash(cx * 2, cz) * 3), w = big;
    while (y > -depth) {
      const th = Math.min(1.4 + hash(cx + y, cz) * 2.2, depth + y), deep = y < -depth * 0.55;
      K.box(w, th, w, col(deep ? Math.floor((-y / depth) * 4) : k, deep), M4(cx + (big > 1.25 ? 0.625 : 0), y - th / 2, cz + (big > 1.25 ? 0.625 : 0)));
      y -= th; k++; w = Math.max(0.7, w * (ed < 3 ? 0.93 : 0.96));
    }
    // klockowy brzeg na wierzchu (tylko poza polem gry)
    if (ed < 1.4 && !inField(cx, cz, 0.4) && hash(cx * 5, cz * 3) > 0.35) {
      const h = 0.25 + hash(cz, cx * 7) * 1.1; K.box(1.1, h, 1.1, pickH(cx, cz, ROCK), M4(cx, h / 2, cz, 0, hash(cx, cz) * 0.3));
    }
  }
  void rand;
}

// iglica: klockowe piętra z warstwami skał (zawsze w obrysie w × d)
function spire(K, x, z, w, d, h, y0, rand, kind) {
  let y = y0, k = Math.floor(rand() * 6), sw = w, sd = d;
  while (y < y0 + h - 0.05) {
    const th = Math.min(0.6 + rand() * 1.3, y0 + h - y);
    K.box(sw, th, sd, STRATA[k % STRATA.length], M4(x + (rand() - 0.5) * (w - sw) * 0.8, y + th / 2, z + (rand() - 0.5) * (d - sd) * 0.8), kind);
    y += th; k++; sw = Math.max(w * 0.42, sw * (0.84 + rand() * 0.12)); sd = Math.max(d * 0.42, sd * (0.84 + rand() * 0.12));
  }
  // drobne półki i odłamki u podstawy
  for (let i = 0; i < 3; i++) { const s = 0.3 + rand() * 0.35; K.box(s, s * 0.8, s, pick(rand, ROCK), M4(x + (rand() - 0.5) * w * 0.9, y0 + s * 0.4, z + (rand() - 0.5) * d * 0.9, 0, rand() * 2)); }
}
// głaz z klocków w obrysie kolizji
function boulder(K, x, z, w, d, h, rand, y0 = 0) {
  K.box(w, h * 0.62, d, pick(rand, ROCK), M4(x, y0 + h * 0.31, z));
  K.box(w * 0.72, h * 0.38, d * 0.78, pick(rand, STRATA), M4(x + (rand() - 0.5) * w * 0.2, y0 + h * 0.81, z + (rand() - 0.5) * d * 0.15));
  K.box(w * 0.4, h * 0.2, d * 0.4, pick(rand, ROCK), M4(x + w * 0.28, y0 + h * 0.1, z - d * 0.28), 'solid');
}

// ---------------- moduł mieszkalny HAB-01 ----------------
function habitat(K, A, T, root) {
  const { x0, x1, z0, z1, floor: F, t, ceil: CE, roof: RF, door: D, doorTop: DT, win: [w0, w1], winZ: [wz0, wz1], parapet: PP } = HAB;
  // fundament (ciemne poszycie) i podłoga z kratownicy
  T.H.box('skirt', x1 - x0 + 0.8, F - 0.03, z1 - z0 + 0.8, 1.0, M4(0, (F - 0.03) / 2, 0));
  T.H.box('grate', x1 - x0 + 0.8, 0.03, z1 - z0 + 0.8, 0.6, M4(0, F - 0.015, 0));
  // ściany (strona A, odbite na B) i pas środkowy wschód/zachód
  for (const [a, b, c, d, e, f] of HAB_WALLS) T.HA.box('panel', d - a, e - b, f - c, 2.4, M4((a + d) / 2, (b + e) / 2, (c + f) / 2), true);
  for (const [a, b] of [[x0, x0 + t], [x1 - t, x1]]) T.H.box('panel', b - a, CE - F, 2 * wz0, 2.4, M4((a + b) / 2, (F + CE) / 2, 0));
  // dach z attyką
  T.H.box('roof', x1 - x0 + 0.5, RF - CE, z1 - z0 + 0.5, 2.0, M4(0, (CE + RF) / 2, 0));
  T.H.box('panel', x1 - x0 - 2 * t, 0.04, z1 - z0 - 2 * t, 2.4, M4(0, CE - 0.02, 0));                        // sufit w środku (panele)
  T.HA.box('panel', x1 - x0 + 0.5, PP, 0.2, 2.4, M4(0, RF + PP / 2, z0 - 0.15), true);
  for (const xx of [x0 - 0.15, x1 + 0.15]) T.HA.box('panel', 0.2, PP, -0.6 - (z0 - 0.05), 2.4, M4(xx, RF + PP / 2, (z0 - 0.05 - 0.6) / 2), true);
  // pas pomarańczowy, żebra, listwa dachu (ozdoby na zewnątrz ścian)
  for (const s of [1, -1]) {
    for (const sx of [-1, 1]) K.D.box(x1 - 1.85, 0.22, 0.04, ORANGE, M4(sx * (1.85 + (x1 - 1.85) / 2 + 0.015), 3.25, s * (z1 + 0.02)));
    K.D.box(0.04, 0.22, z1 - z0 + 0.06, ORANGE, M4(s * (x1 + 0.02), 3.25, 0));
    for (let i = 0; i < 9; i++) { const xx = x0 + 0.55 + i * 1.11; if (Math.abs(xx) < VEST.x1 + 0.2) continue; K.D.box(0.12, CE - F - 0.1, 0.07, '#c9d0d6', M4(xx, (F + CE) / 2, s * (z1 + 0.035))); }
    for (const zz of [-3.0, 3.0]) K.D.box(0.07, CE - F - 0.1, 0.12, '#c9d0d6', M4(s * (x1 + 0.035), (F + CE) / 2, zz));
    K.D.box(x1 - x0 + 0.62, 0.1, 0.1, STEEL, M4(0, RF + PP + 0.05, s * (z1 + 0.15)));
  }
  // okna: ramy, podświetlony parapet (strona A, odbicie na B)
  for (const sx of [-1, 1]) {
    const xx = sx * (x1 - t / 2);
    const zc = -(wz0 + wz1) / 2, zl = wz1 - wz0;
    A.D.box(0.34, 0.1, zl + 0.2, DARK, M4(xx, w0 - 0.05, zc)); A.D.box(0.34, 0.1, zl + 0.2, DARK, M4(xx, w1 + 0.05, zc));
    A.D.box(0.34, w1 - w0 + 0.2, 0.1, DARK, M4(xx, (w0 + w1) / 2, -wz0 + 0.05)); A.D.box(0.34, w1 - w0 + 0.2, 0.1, DARK, M4(xx, (w0 + w1) / 2, -wz1 - 0.05));
    A.R.box(0.05, 0.04, zl, CYAN, M4(sx * (x1 - t - 0.04), w0 - 0.12, zc), 'glow');
  }
  // drzwi: rama, świecące listwy, pas ostrzegawczy w progu (strona A)
  A.D.box(0.16, DT - F + 0.1, 0.32, DARK, M4(-D - 0.08, (F + DT) / 2, z0 + t / 2)); A.D.box(0.16, DT - F + 0.1, 0.32, DARK, M4(D + 0.08, (F + DT) / 2, z0 + t / 2));
  A.D.box(2 * D + 0.32, 0.16, 0.32, DARK, M4(0, DT + 0.08, z0 + t / 2));
  A.R.box(0.04, DT - F - 0.1, 0.04, CYAN, M4(-D - 0.18, (F + DT) / 2, z0 - 0.02), 'glow'); A.R.box(0.04, DT - F - 0.1, 0.04, CYAN, M4(D + 0.18, (F + DT) / 2, z0 - 0.02), 'glow');
  // w środku: lampy w suficie, regał serwerów z diodami, konsole z ekranami, szafki
  for (const zz of [-2.2, 2.2]) for (const xx of [-3, 0, 3]) K.R.box(1.2, 0.04, 0.5, '#f4fbff', M4(xx, CE - 0.07, zz), 'glow');
  T.H.box('skirt', 1.8, 3.0 - F, 0.9, 1.0, M4(0, (F + 3.0) / 2, 0));
  for (const s of [1, -1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.2), materials().leds); p.position.set(0, F + 1.25, s * 0.452); if (s < 0) p.rotation.y = PI; p.userData.deco = true; root.add(p); }
  for (const sx of [-1, 1]) {
    const xi = sx * (x1 - t - 0.3);
    A.H.box(0.6, 0.9, 1.1, '#5d656e', M4(xi, F + 0.45, -2.05));
    A.R.box(0.04, 0.32, 0.8, '#1b2a2c', M4(xi - sx * 0.31, F + 0.75, -2.05));
    A.H.box(0.6, 2.1, 0.75, '#a9b1b8', M4(sx * (x1 - t - 0.3), F + 1.05, z0 + t + 0.375));
    A.D.box(0.02, 1.9, 0.02, '#6d757d', M4(sx * (x1 - t - 0.6), F + 1.05, z0 + t + 0.375));
  }
  for (const s of [1, -1]) for (const sx of [-1, 1]) {
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.42), materials().screen);
    scr.position.set(sx * (HAB.x1 - HAB.t - 0.62), F + 1.12, s * -2.05); scr.rotation.set(0, -sx * PI / 2, 0); scr.rotateX(-0.35); scr.userData.deco = true; root.add(scr);
  }
  // dach: klimatyzatory z wentylatorami, maszt z anteną i migającym światłem
  for (const s of [1, -1]) for (const sx of [-1, 1]) {
    const cx = sx * 2.85, cz = s * -1.8;
    K.H.box(1.3, 1.0, 1.2, '#b7bec5', M4(cx, RF + 0.5, cz));
    K.D.add(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 12), DARKER, M4(cx, RF + 1.03, cz));
    for (let k = 0; k < 4; k++) K.D.box(0.8, 0.02, 0.07, STEEL, M4(cx, RF + 1.07, cz, 0, k * PI / 4));
    for (let k = 0; k < 5; k++) K.D.box(0.02, 0.6, 1.0, DARK, M4(cx + sx * 0.66, RF + 0.5, cz - 0.4 + k * 0.2 - 0.0));
  }
  rod(K.H, V3(0, RF, 0), V3(0, RF + 2.8, 0), 0.12, 0.08, STEEL);
  K.D.add(new THREE.SphereGeometry(0.75, 10, 4, 0, PI * 2, 0, PI / 2.6), '#e8ecef', M4(0.35, RF + 2.4, 0, 0, 0, -1.0, 1, 0.55, 1));
  rod(K.D, V3(0.2, RF + 2.3, 0), V3(0.75, RF + 2.85, 0), 0.02, 0.02, STEEL);
  const blink = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3a2a' })); blink.position.set(0, RF + 2.9, 0); blink.name = 'mars-blink'; blink.userData.deco = true; root.add(blink);
  // drabiny na dach (poręcze i szczeble)
  for (const [lx0, , lz0, lx1, ly1, lz1, nx] of LADDERS) {
    const lx = (lx0 + lx1) / 2 - nx * 0.05;
    for (const zz of [lz0 + 0.05, lz1 - 0.05]) rod(K.D, V3(lx, 0, zz), V3(lx, RF + PP + 0.6, zz), 0.035, 0.035, STEEL);
    for (let y = 0.35; y < ly1; y += 0.32) K.D.box(0.05, 0.05, lz1 - lz0 - 0.1, '#aab2ba', M4(lx, y, (lz0 + lz1) / 2));
    K.R.box(0.05, 0.05, 0.05, '#f2b51a', M4(lx, RF + PP + 0.62, lz0 + 0.05)); K.R.box(0.05, 0.05, 0.05, '#f2b51a', M4(lx, RF + PP + 0.62, lz1 - 0.05));
  }
  // szyldy HAB-01 na ścianach wschodniej i zachodniej (nad oknami)
  for (const sx of [-1, 1]) {
    const m = signMesh(2.6, 0.65, habSign('HAB-01', 'HABITAT MODULE · CREW 2')); m.position.set(sx * (x1 + 0.03), 2.78, sx > 0 ? -1.75 : 1.75); m.rotation.y = sx * PI / 2; root.add(m);
  }
}
// śluzy (osobno dla stron: napisy AIRLOCK A / B)
function airlocks(K, A, T, root) {
  const { x0, x1, z0, z1, top: TP, roof: RF } = VEST, F = HAB.floor, D = HAB.door, DT = HAB.doorTop, t = 0.25;
  T.HA.box('skirt', x1 - x0, F - 0.03, z1 - z0, 1.0, M4(0, (F - 0.03) / 2, (z0 + z1) / 2), true);
  T.HA.box('grate', x1 - x0, 0.03, z1 - z0, 0.6, M4(0, F - 0.015, (z0 + z1) / 2), true);
  T.HA.box('panel', t, TP - F, z1 - z0, 2.4, M4(x0 + t / 2, (F + TP) / 2, (z0 + z1) / 2), true);
  T.HA.box('panel', t, TP - F, z1 - z0, 2.4, M4(x1 - t / 2, (F + TP) / 2, (z0 + z1) / 2), true);
  T.HA.box('panel', -D - (x0 + t), TP - F, t, 2.4, M4((x0 + t - D) / 2, (F + TP) / 2, z0 + t / 2), true);
  T.HA.box('panel', x1 - t - D, TP - F, t, 2.4, M4((x1 - t + D) / 2, (F + TP) / 2, z0 + t / 2), true);
  T.HA.box('panel', 2 * D, TP - DT, t, 2.4, M4(0, (DT + TP) / 2, z0 + t / 2), true);
  T.HA.box('roof', x1 - x0 + 0.2, RF - TP, z1 - z0 + 0.1, 2.0, M4(0, (TP + RF) / 2, (z0 - 0.1 + z1) / 2), true);
  T.HA.box('hazard', 2.4, 0.25, 0.6, 0.5, M4(0, 0.125, z0 - 0.3), true);
  T.HA.box('hazard', 2 * D, 0.02, 0.25, 0.5, M4(0, F + 0.01, z0 + t / 2), true);
  // rama drzwi, lampka nad drzwiami, panel otwierania
  A.D.box(0.14, DT - F + 0.1, 0.34, DARK, M4(-D - 0.07, (F + DT) / 2, z0 + t / 2)); A.D.box(0.14, DT - F + 0.1, 0.34, DARK, M4(D + 0.07, (F + DT) / 2, z0 + t / 2));
  A.D.box(2 * D + 0.28, 0.14, 0.34, DARK, M4(0, DT + 0.07, z0 + t / 2));
  A.R.box(0.08, 0.3, 0.08, '#3dff8a', M4(-D - 0.42, DT - 0.25, z0 - 0.04), 'glow');
  A.D.box(0.22, 0.32, 0.06, '#2c3138', M4(D + 0.45, 1.45, z0 - 0.03)); A.R.box(0.12, 0.08, 0.02, CYAN, M4(D + 0.45, 1.52, z0 - 0.065), 'glow');
  for (const s of [1, -1]) {
    const m = signMesh(1.5, 0.375, habSign(s > 0 ? 'AIRLOCK A' : 'AIRLOCK B', 'PRESSURIZED · KEEP CLOSED'));
    m.position.set(0, (DT + TP) / 2 + 0.0, s * (z0 - 0.02)); m.rotation.y = s > 0 ? PI : 0; root.add(m);           // strona A patrzy na −Z, B na +Z
  }
}

// ---------------- zachód: płaskowyż, stopnie, iglice, krater z sondą ----------------
function westRocks(K, A, rand) {
  // ściany płaskowyżu: klockowe warstwy (lekko poszarpane), na wierzchu kafelki gruntu (ground())
  const { x0, x1, z0, z1, top } = MESA;
  const seg = (a, b, f) => { for (let p = a; p < b - 0.01; p += 1) f(p + Math.min(1, b - p) / 2, Math.min(1, b - p)); };
  for (let y = 0, k = 0; y < top - 0.01; y += 0.5, k++) {
    const sc = (u) => STRATA[(k + Math.floor(hash(u * 3, k) * 2)) % STRATA.length], j = (u) => (hash(u, y) - 0.5) * 0.06;
    seg(z0, z1, (c, l) => { A.H.box(0.6, 0.5, l, sc(c), M4(x1 - 0.3 + j(c), y + 0.25, c)); A.H.box(0.6, 0.5, l, sc(c + 9), M4(x0 + 0.3 + j(c + 3), y + 0.25, c)); });
    seg(x0 + 0.6, x1 - 0.6, (c, l) => { for (const zz of [z0 + 0.3, z1 - 0.3]) A.H.box(l, 0.5, 0.6, sc(c + zz), M4(c, y + 0.25, zz + j(c + zz))); });
  }
  A.H.box(x1 - x0 - 1.2, top - 0.02, z1 - z0 - 1.2, STRATA[3], M4((x0 + x1) / 2 - 0.3, (top - 0.02) / 2, (z0 + z1) / 2));
  for (const [sx0, sz0, sx1, sz1] of STEPS) {
    A.H.box(sx1 - sx0, 0.98, sz1 - sz0, pick(rand, STRATA), M4((sx0 + sx1) / 2, 0.49, (sz0 + sz1) / 2));
    for (let i = 0; i < 3; i++) A.D.box(0.35, 0.18, 0.35, pick(rand, ROCK), M4(sx0 + rand() * (sx1 - sx0), 0.09, sz0 + rand() * (sz1 - sz0)));
  }
  for (const [x, z, sx, sz, h, y] of SPIRES) spire(A.H, x, z, sx, sz, h, y, rand);
  // głaz przy kanionie (strona A) i krater z sondą (środek, bez odbicia)
  boulder(A.H, -14.6, -2.8, 1.2, 1.0, 1.15, rand);
  const { x0: px0, x1: px1, z0: pz0, z1: pz1, h } = PROBE, pcx = (px0 + px1) / 2;
  K.H.box(px1 - px0, h * 0.45, pz1 - pz0, BASALT[0], M4(pcx, h * 0.225, 0));
  K.H.box((px1 - px0) * 0.78, h * 0.35, (pz1 - pz0) * 0.8, BASALT[2], M4(pcx + 0.1, h * 0.45 + h * 0.175, 0.05));
  K.H.box((px1 - px0) * 0.5, h * 0.2, (pz1 - pz0) * 0.55, ROCK[3], M4(pcx + 0.2, h * 0.9, 0));
  for (let i = 0; i < 14; i++) { const a = (i / 14) * PI * 2, r = 3.2 + rand() * 0.6, s = 0.3 + rand() * 0.3; K.D.box(s, s * 0.55, s, pick(rand, BASALT), M4(-11 + Math.cos(a) * r, s * 0.25, Math.sin(a) * r, 0, rand())); }
  // sonda: złota folia, skrzydła z ogniwami, antena – wbita w kamień pod kątem
  const P = M4(-10.45, h + 0.45, 0, 0, 0.4, 0.35);
  K.H.add(new THREE.BoxGeometry(0.8, 0.8, 0.8), GOLD, P);
  K.D.add(new THREE.BoxGeometry(2.6, 0.04, 0.7), '#22407a', P.clone().multiply(M4(0, 0.1, 0)));
  K.D.add(new THREE.BoxGeometry(0.06, 0.06, 0.06), '#d8dde3', P.clone().multiply(M4(0, 0.5, 0)));
  K.D.add(new THREE.SphereGeometry(0.32, 8, 3, 0, PI * 2, 0, PI / 2.5), '#e8ecef', P.clone().multiply(M4(0, 0.42, 0.25, -0.6)));
  K.R.box(0.08, 0.08, 0.08, '#ff3a2a', P.clone().multiply(M4(0.38, 0.38, -0.38)), 'glow');
}

// ---------------- wschód: szklarnia, zbiorniki, łazik, panele ----------------
function greenhouse(K, A, root, rand) {
  const { x, z, r, h, dome } = GREEN, MM = materials();
  for (const s of [1, -1]) {
    const cz = s * z, grp = new THREE.Group(); grp.position.set(x, 0, cz);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.97, r * 0.97, h - 0.32, 6, 1, true), MM.glass); glass.position.y = 0.32 + (h - 0.32) / 2; glass.rotation.y = PI / 6;
    const roofG = new THREE.Mesh(new THREE.CylinderGeometry(1.55, r * 0.98, 0.3, 6, 1, true), MM.glass); roofG.position.y = h + 0.12; roofG.rotation.y = PI / 6;
    const domeG = new THREE.Mesh(new THREE.SphereGeometry(1.5, 6, 3, 0, PI * 2, 0, PI / 2), MM.glass); domeG.position.y = h + 0.27; domeG.scale.y = (dome - h - 0.27) / 1.5; domeG.rotation.y = PI / 6;
    for (const m of [glass, roofG, domeG]) { m.renderOrder = 2; m.userData.deco = true; grp.add(m); }
    root.add(grp);
  }
  // podstawa, rama, grządki z roślinami, lampy do uprawy (strona A, odbicie na B)
  A.H.add(new THREE.CylinderGeometry(r, r + 0.08, 0.32, 6), '#8f979e', M4(x, 0.16, z, 0, PI / 6));
  for (let i = 0; i < 6; i++) {
    const a = PI / 6 + (i / 6) * PI * 2 + PI / 6, b = a + PI / 3, ca = V3(x + Math.cos(a) * r, 0, z + Math.sin(a) * r), cb = V3(x + Math.cos(b) * r, 0, z + Math.sin(b) * r);
    rod(A.D, V3(ca.x, 0.3, ca.z), V3(ca.x, h, ca.z), 0.06, 0.06, '#e8ecef', 4);
    for (const yy of [0.32, h - 0.02]) rod(A.D, V3(ca.x, yy, ca.z), V3(cb.x, yy, cb.z), 0.05, 0.05, '#e8ecef', 4);
    rod(A.D, V3(ca.x, h, ca.z), V3(x + Math.cos(a) * 1.55, h + 0.27, z + Math.sin(a) * 1.55), 0.04, 0.04, '#e8ecef', 4);
  }
  for (const dz of [-0.75, 0.75]) {
    A.D.box(3.2, 0.5, 0.7, '#7a5a3c', M4(x, 0.55, z + dz)); A.D.box(3.05, 0.04, 0.55, '#3a2a1e', M4(x, 0.81, z + dz));
    for (let i = 0; i < 7; i++) {
      const px = x - 1.35 + i * 0.45, s = 0.18 + rand() * 0.14;
      A.D.add(new THREE.IcosahedronGeometry(s, 0), pick(rand, PLANT), M4(px, 0.95 + s * 0.6, z + dz + (rand() - 0.5) * 0.2, 0, rand() * 3, 0, 1, 1.4, 1));
      if (rand() < 0.45) A.D.add(new THREE.IcosahedronGeometry(0.05, 0), '#e8432e', M4(px + 0.08, 1.0 + s, z + dz + 0.08));
    }
    A.R.box(2.8, 0.05, 0.12, '#ff5fd2', M4(x, 2.3, z + dz), 'glow');
    A.D.box(0.03, 0.4, 0.03, STEEL, M4(x - 1.2, 2.5, z + dz)); A.D.box(0.03, 0.4, 0.03, STEEL, M4(x + 1.2, 2.5, z + dz));
  }
  A.D.box(0.5, 0.9, 0.5, '#3d8fd6', M4(x + 1.7, 0.77, z - 0.1));
  // drzwi szklarni od zachodu (rama) i rura do zbiorników
  { const ap = r * Math.cos(PI / 6) * 0.99, fx = x + Math.cos(PI * 5 / 6) * ap, fz = z + Math.sin(PI * 5 / 6) * ap, tx = -0.5, tz = -0.866;
    for (const k of [-0.55, 0.55]) A.D.box(0.12, 2.1, 0.12, DARK, M4(fx + tx * k, 1.37, fz + tz * k));
    A.D.box(1.22, 0.12, 0.12, DARK, M4(fx, 2.42, fz, 0, PI * 2 / 3)); A.D.box(1.0, 0.02, 0.3, '#f2b51a', M4(fx, 0.33, fz, 0, PI * 2 / 3)); }
  rod(A.D, V3(x + r * 0.9, 0.5, z - 1.2), V3(TANKS[0][0] - 0.8, 0.5, TANKS[0][1] + 0.6), 0.09, 0.09, '#c9d0d6');
  rod(A.D, V3(x + r * 0.9, 0.5, z + 1.2), V3(TANKS[1][0] - 0.8, 0.5, TANKS[1][1] - 0.6), 0.09, 0.09, '#c9d0d6');
}
function tanks(A, root) {
  for (const [x, z] of TANKS) {
    A.H.add(new THREE.CylinderGeometry(0.85, 0.85, 2.4, 14), WHITE[0], M4(x, 1.25, z));
    A.H.add(new THREE.SphereGeometry(0.85, 14, 6, 0, PI * 2, 0, PI / 2), WHITE[1], M4(x, 2.45, z, 0, 0, 0, 1, 0.4, 1));
    A.D.add(new THREE.CylinderGeometry(0.87, 0.87, 0.22, 14), ORANGE, M4(x, 1.7, z));
    A.D.add(new THREE.CylinderGeometry(0.87, 0.87, 0.08, 14), DARK, M4(x, 0.62, z));
    A.H.box(1.4, 0.12, 1.4, '#8f979e', M4(x, 0.06, z));
    for (const dx of [-0.5, 0.5]) A.D.box(0.12, 0.3, 1.5, DARK, M4(x + dx, 0.2, z));
    A.D.add(new THREE.TorusGeometry(0.13, 0.03, 4, 8), '#d63a2a', M4(x - 0.88, 0.85, z + 0.42, 0, PI / 2));
  }
  for (const s of [1, -1]) for (const [i, [x, z]] of TANKS.entries()) {
    const m = signMesh(0.9, 0.45, signTex(256, 128, '#ffffff', (c, W, H) => { c.fillStyle = '#23272d'; c.font = '900 76px Impact, "Arial Black", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(i ? 'H₂O' : 'O₂', W / 2, H / 2 + 4); }));
    m.position.set(x - 0.875, 1.25, s * z); m.rotation.y = -PI / 2; root.add(m);
  }
}
function rover(A) {
  const { x0, x1, z0, z1, h } = ROVER, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, L = x1 - x0, W = z1 - z0;
  const P = (lx, ly, lz, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => M4(cx + lx, ly, cz + lz, rx, ry, rz, sx, sy, sz);
  A.H.box(L, 0.45, W - 0.2, '#d9dee3', P(0, 0.78, 0));                                     // podwozie
  A.H.box(L * 0.62, 0.95, W - 0.25, WHITE[0], P(-L * 0.18, 1.48, 0));                         // moduł załogi
  A.H.box(L * 0.32, 0.9, W - 0.3, WHITE[1], P(L * 0.33, 1.42, 0));                            // kabina
  A.D.box(0.05, 0.5, W - 0.5, '#1c2a36', P(L * 0.49, 1.52, 0));                               // przednia szyba
  for (const s of [1, -1]) A.D.box(L * 0.24, 0.42, 0.04, '#1c2a36', P(L * 0.33, 1.55, s * (W / 2 - 0.14)));
  for (const s of [1, -1]) { A.D.box(L * 0.6, 0.16, 0.04, ORANGE, P(-L * 0.18, 1.2, s * (W / 2 - 0.12))); for (let k = 0; k < 3; k++) A.D.box(0.34, 0.22, 0.04, '#1c2a36', P(-L * 0.38 + k * 0.5, 1.62, s * (W / 2 - 0.12))); }
  for (const wx of [-1.6, 0, 1.6]) for (const s of [1, -1]) {
    A.H.add(new THREE.CylinderGeometry(0.46, 0.46, 0.36, 10), '#2b2b2e', P(wx, 0.46, s * (W / 2 - 0.12), PI / 2));
    A.D.add(new THREE.CylinderGeometry(0.2, 0.2, 0.38, 8), '#9aa3ab', P(wx, 0.46, s * (W / 2 - 0.12), PI / 2));
    A.D.box(0.7, 0.1, 0.12, DARK, P(wx, 0.92, s * (W / 2 - 0.1)));
  }
  A.R.box(0.04, 0.12, 0.3, '#f4fbff', P(L / 2 + 0.01, 0.95, -0.7), 'glow'); A.R.box(0.04, 0.12, 0.3, '#f4fbff', P(L / 2 + 0.01, 0.95, 0.7), 'glow');
  A.R.box(0.04, 0.1, 0.25, '#ff3a2a', P(-L / 2 - 0.01, 1.0, -0.75), 'glow'); A.R.box(0.04, 0.1, 0.25, '#ff3a2a', P(-L / 2 - 0.01, 1.0, 0.75), 'glow');
  // bagażnik na dachu ze skrzynkami, antena i talerz
  for (const s of [1, -1]) rod(A.D, V3(x0 + 0.5, h + 0.05, cz + s * (W / 2 - 0.3)), V3(x0 + 2.0, h + 0.05, cz + s * (W / 2 - 0.3)), 0.035, 0.035, STEEL, 4);
  A.H.box(0.7, 0.4, 0.6, ORANGE, M4(x0 + 0.9, h + 0.22, cz - 0.35)); A.H.box(0.6, 0.38, 0.55, '#eceff1', M4(x0 + 1.6, h + 0.21, cz + 0.3));
  rod(A.D, V3(cx + 1.1, h - 0.05, cz + 0.7), V3(cx + 1.1, h + 1.2, cz + 0.7), 0.02, 0.02, STEEL, 4);
  A.D.add(new THREE.SphereGeometry(0.3, 8, 3, 0, PI * 2, 0, PI / 2.4), '#e8ecef', M4(cx + 0.6, h + 0.25, cz + 0.6, -0.5, 0.6, 0));
}
function solarRows(T, A) {
  const { x0, x1, z0, z1, h } = SOLAR, n = 5, step = (x1 - x0) / n, d = z1 - z0;
  for (let i = 0; i < n; i++) {
    const xa = x0 + i * step, xc = xa + step / 2, tilt = Math.atan2(h - 0.35, step * 0.92);
    const m = new THREE.Matrix4().compose(V3(xc, (h + 0.35) / 2, (z0 + z1) / 2), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, tilt)), V3(1, 1, 1));
    T.HA.add('solar', (() => { const g = new THREE.BoxGeometry(step * 0.98 / Math.cos(tilt), 0.05, d - 0.06); const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) { if (Math.floor(k / 4) !== 2) uv.setXY(k, 0.02, 0.02); } g.applyMatrix4(m); return g; })(), true);
    for (const zz of [z0 + 0.15, z1 - 0.15]) { A.D.box(0.08, h - 0.05, 0.08, STEEL, M4(xa + step * 0.9, (h - 0.05) / 2, zz)); A.D.box(0.08, 0.35, 0.08, STEEL, M4(xa + step * 0.1, 0.175, zz)); }
  }
  A.D.box(x1 - x0, 0.12, 0.12, DARK, M4((x0 + x1) / 2, 0.06, (z0 + z1) / 2));
  A.D.box(0.5, 0.6, 0.4, '#5d656e', M4(x0 - 0.35, 0.3, (z0 + z1) / 2)); A.R.box(0.02, 0.12, 0.2, '#3dff8a', M4(x0 - 0.61, 0.42, (z0 + z1) / 2), 'glow');
}

// ---------------- przy spawnach: maszt, generator, rura, skrzynie, astronauta, głazy, światła ----------------
function tower(A, root, side) {
  const { x, z, w, h } = TOWER, zz = side * z;
  const K = A;                                                                                // (budowane w stronie A i odbijane)
  const c = (t, sx, sz) => V3(x + sx * (w / 2) * (1 - t * 0.55), t * h, z + sz * (w / 2) * (1 - t * 0.55));
  if (side === 1) {
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) rod(K.H, c(0, sx, sz), c(0.97, sx, sz), 0.05, 0.04, '#c9d0d6', 4);
    for (let k = 0; k < 8; k++) {
      const t0 = k / 8, t1 = (k + 1) / 8;
      for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) {
        rod(K.D, c(t1, ...a), c(t1, ...b), 0.025, 0.025, '#c9d0d6', 3);
        rod(K.D, c(t0, ...a), c(t1, ...b), 0.018, 0.018, '#aab2ba', 3);
      }
    }
    K.H.box(w + 0.2, 0.3, w + 0.2, '#8f979e', M4(x, 0.15, z));
    K.D.add(new THREE.SphereGeometry(0.9, 12, 4, 0, PI * 2, 0, PI / 2.3), '#eceff1', M4(x - 0.3, h * 0.78, z, 0, 0, 1.15, 1, 0.5, 1));
    rod(K.D, V3(x, h * 0.74, z), V3(x - 0.55, h * 0.78, z), 0.04, 0.04, STEEL, 4);
    rod(K.D, V3(x, h, z), V3(x, h + 1.4, z), 0.03, 0.02, STEEL, 4);
    K.D.box(0.5, 0.35, 0.3, '#5d656e', M4(x, h * 0.55, z + 0.25));
  }
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3a2a' })); b.position.set(x, h + 1.45, zz); b.name = 'mars-blink'; b.userData.deco = true; root.add(b);
}
function generator(A, o) {
  const { x, z } = o;
  A.H.box(1.8, 1.55, 1.3, '#a9b1b8', M4(x, 0.775, z));
  A.H.box(1.6, 0.25, 1.1, '#8f979e', M4(x, 1.675, z));
  for (let k = 0; k < 6; k++) A.D.box(1.5, 0.05, 0.02, DARK, M4(x, 0.35 + k * 0.17, z - 0.66));
  for (let k = 0; k < 7; k++) A.D.box(0.03, 1.1, 0.04, DARK, M4(x + 0.91, 0.8, z - 0.45 + k * 0.15));
  A.D.box(0.5, 0.32, 0.03, '#062a2c', M4(x - 0.45, 1.15, z + 0.66)); A.R.box(0.42, 0.24, 0.02, '#38f2d6', M4(x - 0.45, 1.15, z + 0.68), 'glow');
  A.R.box(0.08, 0.08, 0.02, '#3dff8a', M4(x + 0.3, 1.3, z + 0.67), 'glow'); A.R.box(0.08, 0.08, 0.02, '#ffb347', M4(x + 0.45, 1.3, z + 0.67), 'glow');
  rod(A.D, V3(x + 0.5, 1.8, z - 0.3), V3(x + 0.5, 2.25, z - 0.3), 0.09, 0.09, DARK);
  A.D.box(0.6, 0.12, 0.6, '#5d656e', M4(x - 0.4, 1.86, z));
}
function pipeLine(A) {
  const { x, z0, z1, h } = PIPE, r = 0.16, y = h - r - 0.02;
  rod(A.H, V3(x, y, z0 - 0.6), V3(x, y, z1), r, r, '#c9d0d6', 10);
  rod(A.D, V3(x, y, z1), V3(x, y, -4.0), r, r, '#c9d0d6', 10);
  rod(A.D, V3(x, y, -4.0), V3(HAB.x0 - 0.42, 0.25, -4.0), r, r, '#c9d0d6', 10);
  for (let zz = z0; zz < z1; zz += 2.2) { A.D.add(new THREE.CylinderGeometry(r + 0.025, r + 0.025, 0.12, 10), ORANGE, M4(x, y, zz + 1, PI / 2)); A.D.box(0.42, y, 0.1, DARK, M4(x, y / 2, zz + 0.4)); }
  A.D.add(new THREE.CylinderGeometry(r + 0.06, r + 0.06, 0.1, 10), DARK, M4(x, y, z1, PI / 2));
  A.D.add(new THREE.TorusGeometry(0.12, 0.03, 4, 8), '#d63a2a', M4(x, y + r + 0.12, -9.5));
}
function crateBox(T, cx, cy, cz, w, h, d) { T.box('crate', w, h, d, Math.max(w, h) * 0.98, M4(cx, cy, cz)); }
function cargo(T, A, o, side) {
  const { x } = o, z = side * Math.abs(o.z);
  if (o.t === 'cargo') {
    for (const dx of [-1.73, 0, 1.73]) crateBox(T, x + dx, 0.675, z, 1.72, 1.35, 1.1);
    crateBox(T, x - 0.6, 1.35 + 0.475, z, 2.0, 0.95, 1.0);
  } else {
    crateBox(T, x, 0.65, z, 2.4, 1.3, 1.6);
    crateBox(T, x + 0.15, 1.3 + 0.45, z, 1.1, 0.9, 1.1);
  }
  void A;
}
// astronauta-fasolka: kombinezon, hełm ze złotą szybą, plecak; s = skala, pose: 'stand' | 'sit' | 'wave'
function astronaut(K, x, y, z, rot, pose = 'stand', s = 1) {
  const P = (lx, ly, lz, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => M4(x, y, z, 0, rot, 0).multiply(M4(lx * s, ly * s, lz * s, rx, ry, rz, sx * s, sy * s, sz * s));
  const sit = pose === 'sit';
  K.add(new THREE.CapsuleGeometry(0.34, 0.78, 4, 10), WHITE[0], P(0, sit ? 0.78 : 1.02, 0));
  K.add(new THREE.SphereGeometry(0.33, 12, 8), WHITE[1], P(0, sit ? 1.5 : 1.74, 0.02));
  K.add(new THREE.SphereGeometry(0.25, 12, 8, -PI * 0.5 - PI * 0.42, PI * 0.84, PI * 0.28, PI * 0.42), GOLD, P(0, sit ? 1.5 : 1.74, -0.12));
  K.box(0.52, 0.62, 0.26, '#d0d5da', P(0, sit ? 0.92 : 1.16, 0.33));
  K.box(0.2, 0.08, 0.02, ORANGE, P(-0.12, sit ? 1.06 : 1.3, -0.33));
  const arm = (sx, up) => K.add(new THREE.CapsuleGeometry(0.1, 0.42, 3, 6), WHITE[2], P(sx * 0.41, (sit ? 0.86 : 1.1) + (up ? 0.38 : 0), up ? -0.05 : 0, up ? 0 : 0.2, 0, sx * (up ? 2.7 : 0.18)));
  arm(-1, false); arm(1, pose === 'wave');
  if (sit) { for (const sx of [-1, 1]) K.add(new THREE.CapsuleGeometry(0.12, 0.42, 3, 6), WHITE[0], P(sx * 0.17, 0.42, -0.28, PI / 2)); }
  else for (const sx of [-1, 1]) { K.add(new THREE.CapsuleGeometry(0.12, 0.3, 3, 6), WHITE[0], P(sx * 0.16, 0.34, 0)); K.box(0.24, 0.12, 0.32, DARK, P(sx * 0.16, 0.06, -0.04)); }
}
function smallObjects(K, A, T, root, rand) {
  for (const o of OBJECTS.filter((q) => q.side === 'A')) {
    if (o.t === 'generator') generator(A, o);
    else if (o.t === 'tower') tower(A, root, 1);
    else if (o.t === 'astro') { astronaut(A.H, o.x, 0, o.z, o.rot || 0); A.D.box(0.22, 0.22, 0.3, '#3d8fd6', M4(o.x + 0.3, 1.0, o.z - 0.25)); }
    else if (o.t === 'rock') { const [[a, , c, d, e, f]] = localBoxes(o); boulder(A.H, o.x, o.z, d - a, f - c, e, rand); }
    else if (o.t === 'beacon') {
      rod(A.H, V3(o.x, 0, o.z), V3(o.x, 2.2, o.z), 0.09, 0.06, '#c9d0d6', 6);
      A.D.add(new THREE.CylinderGeometry(0.25, 0.3, 0.15, 8), DARK, M4(o.x, 0.075, o.z));
      for (let k = 0; k < 3; k++) A.D.add(new THREE.CylinderGeometry(0.095, 0.095, 0.1, 6), k % 2 ? ORANGE : '#eceff1', M4(o.x, 0.5 + k * 0.5, o.z));
    }
  }
  for (const s of [1, -1]) {
    for (const o of OBJECTS.filter((q) => q.side === 'A' && (q.t === 'cargo' || q.t === 'crates'))) cargo(T, A, o, s > 0 ? -1 : 1);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffb347' })); const bo = OBJECTS.find((q) => q.t === 'beacon' && q.side === 'A');
    b.position.set(bo.x, 2.3, -s * Math.abs(bo.z)); b.name = 'mars-blink'; b.userData.deco = true; root.add(b);
    if (s === -1) tower(A, root, -1);
  }
}

// ---------------- lądowiska (napisy osobno dla stron) ----------------
function pads(root) {
  for (const s of [1, -1]) for (const [i, [x, z, r]] of PADS.entries()) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 40), new THREE.MeshStandardMaterial({ map: padTex(i ? 'H' : s > 0 ? 'A' : 'B'), roughness: 0.85, transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.rotation.x = -PI / 2; m.rotation.z = s > 0 ? 0 : PI; m.position.set(x, 0.012, s * z); m.receiveShadow = true; m.userData.deco = true; root.add(m);
  }
}

// ---------------- otoczenie wyspy: iglice w tle, słupki z lampkami na granicy, astronauci na brzegu, flaga ----------------
function islandDeco(K, A, root, rand) {
  // wielkie iglice na zachodnim brzegu (tło, jak na obrazku) i kilka mniejszych na wschodzie
  const BIG = [[-18.4, -24.5, 2.6, 2.2, 15], [-19.2, -16.5, 2.2, 2.6, 9.5], [-18.2, -9.8, 3.0, 2.4, 17.5], [-18.8, -3.6, 2.0, 2.0, 7.5], [17.6, -26.2, 2.0, 1.8, 6.5], [18.4, -14.0, 1.6, 1.6, 4.2]];
  for (const [x, z, w, d, h] of BIG) if (edgeDist(x, z) > 0.4) spire(A.D, x, z, w, d, h, -0.5, rand);
  spire(K.D, -18.6, 0.4, 2.4, 2.8, 12.5, -0.5, rand);
  // granica pola gry: słupki z pomarańczowymi lampkami i linką (strona A, odbicie na B)
  const post = (x, z) => { rod(A.D, V3(x, 0, z), V3(x, 1.05, z), 0.05, 0.05, '#c9d0d6', 5); A.R.box(0.12, 0.1, 0.12, '#ffb347', M4(x, 1.1, z), 'glow'); };
  for (let z = -HZ; z < 0; z += 4.5) { post(-HX - 0.25, z); post(HX + 0.25, z); }
  for (let x = -HX; x <= HX; x += 4) post(x, -HZ - 0.25);
  // astronauci poza polem gry: siedzi na skraju (jak na obrazku), macha przy fladze, ogląda widok
  astronaut(A.D, -17.2, 0, -12.8, PI / 2, 'sit');
  astronaut(K.D, 17.4, 0, 1.2, -PI / 2, 'stand');
  astronaut(A.D, 3.6, 0, -28.0, PI, 'wave');
  rod(A.D, V3(4.6, 0, -28.2), V3(4.6, 3.2, -28.2), 0.04, 0.04, STEEL, 5);
  for (const s of [1, -1]) {
    const flag = signMesh(1.3, 0.8, signTex(256, 160, '#f0872a', (c, W, H) => {
      c.fillStyle = '#eceff1'; c.beginPath(); c.ellipse(W / 2, H / 2, 32, 52, 0, 0, PI * 2); c.fill();
      c.fillStyle = '#23272d'; c.beginPath(); c.arc(W / 2 - 11, H / 2 - 14, 7, 0, PI * 2); c.arc(W / 2 + 11, H / 2 - 14, 7, 0, PI * 2); c.fill();
      c.fillStyle = '#fff'; c.font = '900 22px Arial Black, Arial'; c.textAlign = 'center'; c.fillText('BSA', W / 2, H - 10);
    }));
    flag.material.side = THREE.DoubleSide; flag.position.set(5.27, 2.75, s * -28.2); flag.rotation.y = s > 0 ? 0 : PI; root.add(flag);
  }
  // drobne kamyki i klockowe grudki przy skałach (płaskie – nic nie zasłaniają)
  for (let i = 0; i < 160; i++) {
    const x = (rand() * 2 - 1) * (EX + 0.5), z = -rand() * (EZ + 0.5), sz = 0.12 + rand() * 0.22;
    if (edgeDist(x, z) < 0.3 || (Math.abs(x) < HAB.x1 + 1 && Math.abs(z) < 7)) continue;
    A.R.box(sz, sz * 0.5, sz, pick(rand, rand() < 0.5 ? ROCK : BASALT), M4(x, sz * 0.25, z, 0, rand() * 2));
  }
}

// ======================================================================================================
export function buildMars() {
  const rand = rng(20261122);
  const root = new THREE.Group(); root.name = 'Mars';
  const kit = () => ({ H: new Kit(), D: new Kit(), R: new Kit() });
  const K = kit(), A = kit();                                     // K: środek (bez odbicia), A: strona A (odbijana na B)
  const T = { H: new TexKit(), HA: new TexKit(), D: new TexKit() };
  for (const m of ground()) root.add(m);
  underside(K.R, rand);
  westRocks(K, A, rand);
  habitat(K, A, T, root);
  airlocks(K, A, T, root);
  greenhouse(K, A, root, rand);
  tanks(A, root);
  rover(A);
  solarRows(T, A);
  pipeLine(A);
  smallObjects(K, A, T.D, root, rand);
  pads(root);
  islandDeco(K, A, root, rand);
  // strona A + jej odbicie na stronę B (Kit ma materiały dwustronne – odbicie nie psuje ścian)
  for (const k of Object.keys(A)) for (const kind of ['solid', 'glow']) for (const g of A[k].L[kind]) K[k].L[kind].push(g, g.clone().applyMatrix4(MZ));
  const { SOLID, GLOW } = mats();
  const add = (geo, mat, deco, shadow) => { if (!geo) return; const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = true; m.userData.deco = deco; root.add(m); };
  add(K.H.geometry('solid'), SOLID, false, true);
  add(K.D.geometry('solid'), SOLID, true, true);
  add(K.R.geometry('solid'), SOLID, true, false);
  for (const k of ['H', 'D', 'R']) add(K[k].geometry('glow'), GLOW, true, false);
  for (const m of T.H.meshes(false)) root.add(m);
  for (const m of T.HA.meshes(false)) root.add(m);
  for (const m of T.D.meshes(false)) root.add(m);
  return root;
}
