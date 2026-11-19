// Mapa STRZELNICA – podziemna strzelnica w bunkrze (tryb solo). Budowana w kodzie (low poly), bez pliku GLB.
// Tunel w skale (35 m): stanowiska strzeleckie z przegrodami i daszkiem, tory z żółtymi liniami, znaczniki 10/15/25 m,
// tarcze-fasolki na stojakach, świetlówki na statywach przy ścianach, wał kulochwytu na końcu.
// Dane rozgrywki (spawn, kolizje, punkty celów, tablica ustawień) mają ten sam format co pozostałe mapy.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makePaperTarget } from './tarcze.js';

const HW = 11, Z_BACK = 4.5, Z_END = -31, CEIL = 6.4;        // pół szerokości tunelu, tył stanowisk, koniec tunelu, sufit
const LANES = [-7, -3.5, 0, 3.5, 7];                           // środki torów (linie co 3,5 m)

// ---------------- dane rozgrywki ----------------
const colliders = [
  [-3.3, 0, -0.9, 3.3, 0.15, 3.62],                            // podest stanowiska
  [-3.3, 0, -0.9, 3.3, 1.0, -0.35],                            // lada
  [-3.62, 0, -0.9, -3.3, 3.2, 3.62], [3.3, 0, -0.9, 3.62, 3.2, 3.62],   // przegrody stanowiska
  [-3.62, 0, 3.62, 3.62, 3.2, 4.0],                            // tylna ściana z tablicą
  [-HW - 0.5, 0, Z_END, -HW, CEIL, Z_BACK], [HW, 0, Z_END, HW + 0.5, CEIL, Z_BACK],   // ściany tunelu (granice mapy)
  [-HW - 0.5, 0, Z_END - 0.5, HW + 0.5, CEIL, Z_END], [-HW - 0.5, 0, Z_BACK, HW + 0.5, CEIL, Z_BACK + 0.5],
];
const targets = [];
{
  const rows = [['near', [-5.5, -7.5, -9.5]], ['mid', [-12, -15, -18]], ['far', [-21, -24, -27]]];
  let n = 0;
  for (const [zone, zs] of rows) for (const z of zs) for (const x of LANES) {
    n++; const dist = Math.hypot(x, z - 1.9);
    targets.push({ id: 'T' + String(n).padStart(2, '0'), kind: 'open', zone, x, y: 0, z, dist: +dist.toFixed(1), strafe: zone === 'near' ? 0.7 : zone === 'mid' ? 1.0 : 1.2, note: '' });
  }
}
export const MAP = {
  name: 'Strzelnica', type: 'trening',
  spawns: [{ name: 'Spawn_Gracz', x: 0, y: 0.15, z: 1.9, yaw: 0 }],
  colliders, ladders: [],
  clips: [[-3.3, 1.0, -0.9, 3.3, 4, -0.35]],                    // nad ladą: nie da się przeskoczyć na tor
  panel: { x: 0, y: 1.72, z: 3.6, w: 2.55, h: 1.34, doc: 'tablica ustawień treningu na tylnej ścianie stanowiska (przodem do -Z)' },
  targets,
};

// ---------------- tekstury budki ----------------
function padTexture() {                                  // pianka wygłuszająca: pikowane kwadraty
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
  c.fillStyle = '#23272e'; c.fillRect(0, 0, 128, 128);
  for (const [x, y] of [[0, 0], [64, 0], [0, 64], [64, 64]]) {
    const g = c.createLinearGradient(x, y, x + 64, y + 64); g.addColorStop(0, '#454b55'); g.addColorStop(0.55, '#343941'); g.addColorStop(1, '#262a31');
    c.fillStyle = g; c.beginPath(); c.roundRect(x + 4, y + 4, 56, 56, 12); c.fill();
  }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function hazardTexture() {                               // żółto-czarne ukośne pasy
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d');
  c.fillStyle = '#f0bf1a'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#1c1e22';
  for (const o of [-64, 0, 64]) { c.beginPath(); c.moveTo(o, 64); c.lineTo(o + 32, 64); c.lineTo(o + 64, 0); c.lineTo(o + 32, 0); c.closePath(); c.fill(); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// ---------------- model ----------------
const h1 = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const noise = (a, b) => h1(a * 17.3 + b * 91.7) - 0.5;

export function build() {
  const root = new THREE.Group(); root.name = 'Bunkier';
  const lists = {};
  const mats = {
    floor: new THREE.MeshStandardMaterial({ color: '#30333a', roughness: 0.92 }),
    yellow: new THREE.MeshStandardMaterial({ color: '#e8c21e', roughness: 0.7 }),
    white: new THREE.MeshStandardMaterial({ color: '#d4d7dc', roughness: 0.8 }),
    base: new THREE.MeshStandardMaterial({ color: '#555b65', roughness: 0.9, flatShading: true }),
    ceil: new THREE.MeshStandardMaterial({ color: '#16181d', roughness: 1 }),
    beam: new THREE.MeshStandardMaterial({ color: '#2b2f37', roughness: 0.6, metalness: 0.4 }),
    steel: new THREE.MeshStandardMaterial({ color: '#8a909a', roughness: 0.45, metalness: 0.6 }),
    div: new THREE.MeshStandardMaterial({ color: '#1f2733', roughness: 0.55, metalness: 0.2 }),
    trim: new THREE.MeshStandardMaterial({ color: '#c9ced6', roughness: 0.5, metalness: 0.3 }),
    counter: new THREE.MeshStandardMaterial({ color: '#3b414b', roughness: 0.7 }),
    top: new THREE.MeshStandardMaterial({ color: '#202429', roughness: 0.5 }),
    berm: new THREE.MeshStandardMaterial({ color: '#3a3631', roughness: 1, flatShading: true }),
    glow: new THREE.MeshBasicMaterial({ color: '#eef6ff' }),
    pad: new THREE.MeshStandardMaterial({ map: padTexture(), roughness: 0.95 }),
    hazard: new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: 0.7 }),
  };
  const add = (key, geo, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) => {
    geo.rotateX(rx); geo.rotateZ(rz); geo.rotateY(ry); geo.translate(x, y, z); (lists[key] = lists[key] || []).push(geo);
  };
  const box = (key, w, h, d, x, y, z, ry, rx, rz) => add(key, new THREE.BoxGeometry(w, h, d), x, y, z, ry, rx, rz);
  // prostopadłościan z teksturą w stałej skali (cell = metry na jeden kafelek tekstury), niezależnie od rozmiaru
  const tbox = (key, w, h, d, cell, x, y, z, ry, rx, rz) => {
    const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) { const f = Math.floor(i / 4), [a, b] = f < 2 ? [d, h] : f < 4 ? [w, d] : [w, h]; uv.setXY(i, (uv.getX(i) * a) / cell, (uv.getY(i) * b) / cell); }
    add(key, g, x, y, z, ry, rx, rz);
  };
  const cyl = (key, r0, r1, h, x, y, z, rx = 0, rz = 0, seg = 6) => add(key, new THREE.CylinderGeometry(r0, r1, h, seg), x, y, z, 0, rx, rz);

  // podłoga i linie torów
  const floor = new THREE.Mesh(new THREE.BoxGeometry(HW * 2, 0.1, Z_BACK - Z_END), mats.floor);
  floor.position.set(0, -0.05, (Z_BACK + Z_END) / 2); floor.name = 'Floor'; floor.receiveShadow = true; root.add(floor);
  for (const x of [-8.75, -5.25, -1.75, 1.75, 5.25, 8.75]) box('yellow', 0.12, 0.012, -0.9 - (Z_END + 2), x, 0.006, (-0.9 + Z_END + 2) / 2);
  for (const z of [-8.1, -13.1, -23.1]) for (let x = -HW + 0.6; x < HW - 0.6; x += 1.2) box('white', 0.7, 0.012, 0.14, x + 0.35, 0.007, z);
  // numery odległości na podłodze
  const num = (txt, x, z) => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const c = cv.getContext('2d');
    c.fillStyle = '#d4d7dc'; c.font = '900 104px Impact, "Arial Black", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, 128, 70);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.015, z); m.receiveShadow = true; root.add(m);
  };
  for (const [z, t] of [[-8.9, '10 m'], [-13.9, '15 m'], [-23.9, '25 m']]) { num(t, -9.6, z); num(t, 9.6, z); }

  // ściany z surowej skały (poszarpane, płaskie cieniowanie) i betonowy cokół
  const rock = (side) => {
    const NZ = 24, NY = 7, P = [], C = [], col = new THREE.Color(), pts = [];
    for (let i = 0; i <= NZ; i++) { pts.push([]); for (let j = 0; j <= NY; j++) {
      const z = Z_BACK - (i / NZ) * (Z_BACK - Z_END), y = 0.6 + (j / NY) * (CEIL - 0.6);
      const bulge = Math.sin((j / NY) * Math.PI) * 0.35, x = side * (HW - 0.1 - bulge - (j === 0 || j === NY ? 0 : noise(i, j + side * 9) * 0.55));
      pts[i].push([x, y, z]); } }
    for (let i = 0; i < NZ; i++) for (let j = 0; j < NY; j++) {
      const a = pts[i][j], b = pts[i + 1][j], c = pts[i + 1][j + 1], d = pts[i][j + 1];
      for (const tri of side > 0 ? [[a, b, c], [a, c, d]] : [[a, c, b], [a, d, c]]) {
        const v = 0.85 + h1(i * 31 + j * 7 + side * 3 + P.length) * 0.3; col.set('#7c8593').multiplyScalar(v);
        for (const p of tri) { P.push(...p); C.push(col.r, col.g, col.b); }
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, side: THREE.DoubleSide })); m.receiveShadow = true; m.name = 'Skala'; root.add(m);
    box('base', 0.5, 0.62, Z_BACK - Z_END, side * (HW - 0.2), 0.31, (Z_BACK + Z_END) / 2);
  };
  rock(-1); rock(1);
  // koniec tunelu: skalna ściana i wał kulochwytu
  {
    const P = [], C = [], col = new THREE.Color(), NX = 14, NY = 6;
    for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) {
      const q = (a, b) => [-HW + (a / NX) * HW * 2, (b / NY) * CEIL, Z_END + 0.4 + (a === 0 || a === NX || b === NY ? 0 : noise(a + 50, b) * 0.6)];
      const A = q(i, j), B = q(i + 1, j), Cc = q(i + 1, j + 1), D = q(i, j + 1);
      for (const tri of [[A, B, Cc], [A, Cc, D]]) { col.set('#737b88').multiplyScalar(0.85 + h1(i * 13 + j * 5) * 0.3); for (const p of tri) { P.push(...p); C.push(col.r, col.g, col.b); } }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.computeVertexNormals();
    root.add(Object.assign(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, side: THREE.DoubleSide })), { name: 'SkalaKoniec' }));
    const bg = new THREE.BoxGeometry(HW * 2, 3, 5, 12, 2, 2), bp = bg.attributes.position;
    for (let i = 0; i < bp.count; i++) { const y = bp.getY(i), z = bp.getZ(i); if (y > 0) bp.setZ(i, z < 0 ? z : z - 3.2); bp.setY(i, y + (y > 0 ? noise(i, 3) * 0.3 : 0)); }
    bg.computeVertexNormals(); add('berm', bg, 0, 1.5, Z_END + 2.9);
  }

  // sufit: płyta, poprzeczne dźwigary, podłużne szyny tarcz, lampy
  box('ceil', HW * 2, 0.3, Z_BACK - Z_END, 0, CEIL + 0.15, (Z_BACK + Z_END) / 2);
  for (let z = Z_BACK - 1; z > Z_END; z -= 4.2) { box('beam', HW * 2, 0.42, 0.26, 0, CEIL - 0.21, z); box('beam', HW * 2, 0.06, 0.6, 0, CEIL - 0.42, z); }
  for (const x of [-5.25, 1.75]) for (let z = -3; z > Z_END + 3; z -= 6.3) { box('beam', 1.4, 0.12, 2.2, x + 1.75, CEIL - 0.5, z); box('glow', 1.1, 0.04, 1.9, x + 1.75, CEIL - 0.57, z); }

  // świetlówki na statywach wzdłuż ścian
  for (const side of [-1, 1]) for (let z = -4; z > Z_END + 2; z -= 6.5) {
    const x = side * (HW - 1.1);
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; cyl('beam', 0.025, 0.025, 1.3, x + Math.cos(a) * 0.32, 0.55, z + Math.sin(a) * 0.32, Math.sin(a) * 0.45, -Math.cos(a) * 0.45, 5); }
    cyl('beam', 0.04, 0.04, 0.5, x, 1.2, z, 0, 0, 6);
    cyl('glow', 0.06, 0.06, 1.9, x, 2.35, z, 0, 0, 8);
    cyl('beam', 0.08, 0.08, 0.08, x, 3.33, z, 0, 0, 8); cyl('beam', 0.08, 0.08, 0.08, x, 1.37, z, 0, 0, 8);
  }

  // stanowiska: lada przez całą szerokość, przegrody (skośne panele), daszek z lampami, tylna ściana z tablicą
  box('counter', HW * 2, 0.85, 0.5, 0, 0.42, -0.62); box('top', HW * 2, 0.06, 0.62, 0, 0.88, -0.62);
  box('floor', HW * 2 - 0.1, 0.15, 4.5, 0, 0.075, 1.36);
  // przegrody: stalowa rama, panel z pianki wygłuszającej, pas ostrzegawczy przy podłodze, świecące listwy na przedniej krawędzi
  for (const x of [-10.6, -7.2, -3.46, 3.46, 7.2, 10.6]) {
    for (const z of [-0.84, 1.38, 3.56]) box('trim', 0.12, 3.05, 0.12, x, 1.525, z);
    box('trim', 0.16, 0.1, 4.52, x, 3.0, 1.36); box('trim', 0.15, 0.06, 4.4, x, 0.53, 1.36);
    tbox('pad', 0.13, 2.4, 2.1, 0.45, x, 1.76, 0.27); tbox('pad', 0.13, 2.4, 2.06, 0.45, x, 1.76, 2.47);
    tbox('hazard', 0.15, 0.36, 4.4, 0.4, x, 0.33, 1.36);
    for (const sx of [-0.068, 0.068]) box('glow', 0.025, 2.7, 0.03, x + sx, 1.6, -0.9);
  }
  // tylna ściana z tablicą: pianka, pas ostrzegawczy, listwa
  tbox('pad', HW * 2, 2.65, 0.2, 0.45, 0, 1.83, 3.84);
  tbox('hazard', HW * 2, 0.36, 0.24, 0.4, 0, 0.33, 3.82);
  box('trim', HW * 2, 0.1, 0.32, 0, 3.2, 3.82); box('trim', HW * 2, 0.06, 0.26, 0, 0.53, 3.8);
  box('ceil', HW * 2, 0.18, 4.9, 0, 3.55, 1.45);
  for (const x of [-9, -5.3, -1.6, 1.6, 5.3, 9]) box('glow', 1.6, 0.03, 0.22, x, 3.45, 0.2);
  for (const x of [-9, -5.3, 5.3, 9]) { box('steel', 0.06, 0.06, 0.06, x, 1.0, -0.4); }

  // ---------- sklejenie (jedna siatka na materiał) ----------
  const NO_SHADOW = new Set(['ceil', 'beam', 'glow', 'yellow', 'white', 'floor']);
  for (const [k, l] of Object.entries(lists)) {
    const g = mergeGeometries(l.map((q) => (q.index ? q.toNonIndexed() : q)), false);
    const m = new THREE.Mesh(g, mats[k]); m.name = 'Bunkier_' + k; m.castShadow = !NO_SHADOW.has(k); m.receiveShadow = k !== 'glow'; root.add(m);
  }

  // ---------- tarcze-dekoracje stojące na torach (kule zostawiają w nich dziury) ----------
  const spots = targets.map((t) => [t.x, t.z]);
  const freeOf = (x, z) => spots.every(([a, b]) => Math.hypot(a - x, b - z) > 1.6);
  let k = 0;
  for (const z of [-10.8, -16.6, -19.6, -25.6, -28.4]) for (const x of LANES) {
    k++; if (h1(k * 3.7) < 0.45) continue;
    const xx = x + (h1(k) - 0.5) * 1.2, zz = z + (h1(k + 9) - 0.5) * 1.5; if (!freeOf(xx, zz)) continue;
    const t = makePaperTarget(); t.group.position.set(xx, 0, zz); t.group.rotation.y = (h1(k * 5) - 0.5) * 0.5;
    if (h1(k * 11) < 0.12) { t.group.rotation.x = -Math.PI / 2 + 0.05; t.group.position.y = 0.05; }   // przewrócona
    root.add(t.group);
  }
  return root;
}
