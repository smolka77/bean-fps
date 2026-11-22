// Wygląd mapy KASKADY (1v1): jesienna wyspa-diorama w złotym popołudniu. Budowana w kodzie (low poly, płaskie kolory).
// Układ, kolizje i spawny są w zrodla/kaskady-data.js – grafika używa tych samych liczb, więc siedzi dokładnie w bryłach kolizji.
// Styl: tarasy z rudej ziemi pocięte na bloki, z trawiastym okapem na krawędziach; kamienne schody, drewniane kładki i płoty,
// świecąca turkusowa woda, krąg kamieni z kryształem, warownia z dwiema wieżami, jesienne drzewa (pomarańcz, czerwień, złoto) i świerki.
// Strona A jest budowana raz i odbijana na stronę B (scale z = −1). Siatki oznaczone userData.deco nie biorą udziału w trafieniach.
// Niebo, morze chmur, latające wysepki, spadające liście i ptaki: themeCascades w zrodla/klimaty.js.
import * as THREE from 'three';
import { Kit, M4, V3, between, jitter, rng, mats, addRushes, addLily } from './klimaty.js';
import {
  HX, HZ, LAND, WATER, POND, CLIFF, CIRCLE, FALL, TERRACE, TOWERS, GATE, ISLAND, BRIDGES, BRIDGE_TOP, BRIDGE_Z,
  STAIRS, stairSteps, POND_STEP, PARAPETS, MENHIRS, FENCES, FENCE_H, OBJECTS, localBoxes, baseY, MAP,
} from './kaskady-data.js';

const PI = Math.PI;
const MZ = new THREE.Matrix4().makeScale(1, 1, -1);                 // odbicie strony A na stronę B
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];

// ---------------- kolory (jak na dioramach: ruda ziemia, soczysta trawa, jesienne korony) ----------------
const GRASS = ['#86b83f', '#7cae39', '#91c246', '#74a634', '#8bbd42'];
const GRASS_WARM = ['#a3bd3f', '#b0be44', '#9cb83c'];
const GRASS_EDGE = ['#6f9f30', '#679830', '#77a734'];
const EARTH = ['#c8693c', '#bf6237', '#d17545', '#b95b34', '#cc6f40', '#c46a3d'];
const EARTH_DEEP = ['#a9522f', '#9f4b2b', '#b0582f'];
const GROOVE = '#7e3a22';
const DIRT = ['#d6965a', '#cf8e53', '#dba062', '#c9884e'];
const COBBLE = ['#bdb1a0', '#ada190', '#c6bbab', '#a3978a', '#b5aa99'];
const STONE = ['#a99f90', '#9a9082', '#b3a999', '#8f8577', '#a39888'];
const MORTAR = '#6f675d';
const MOSS = ['#6f9a3a', '#5f8c33', '#7aa640'];
const WOOD = ['#9a6a3c', '#a87648', '#8c5e34', '#b5824f', '#96663a'];
const WOOD_DARK = ['#6b4528', '#5e3d24', '#74502e'];
const BARK = ['#6b4a32', '#5e412c', '#77553a'];
const LEAF = {
  orange: ['#f0862e', '#e8742a', '#f59a3a', '#de6a26', '#f7a440'],
  red: ['#d9472b', '#c93a26', '#e2552f', '#cf4a2c', '#b8351f'],
  gold: ['#f2b632', '#e8a42a', '#f5c446', '#e3982a'],
  green: ['#5f9e35', '#6eae3c', '#558f30', '#68a83a'],
};
const PINE = ['#2f6b4a', '#2a5f42', '#357452', '#2c6646'];
const SAND = ['#d9c08a', '#cdb27c', '#e0c894'];
const ROCK = ['#8e9199', '#7f828b', '#999ca3', '#74777f'];
const IRON = '#3a3a40';
const RUNE = '#7ff3ff';
const WARM = '#ffd27a';

// ---------------- pomocniki geometrii ----------------
const quad = (K, a, b, c, d, col, kind) => K.tris([a, b, c, a, c, d], col, kind);
const rod = (K, a, b, r0, r1, col, seg = 6) => { const [m, len] = between(a, b); K.add(new THREE.CylinderGeometry(r1, r0, len, seg, 1), col, m); };
const objM = (x, y, z, rot = 0) => new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), rot), V3(1, 1, 1));
function local(OM) { return (lx, ly, lz, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => OM.clone().multiply(M4(lx, ly, lz, rx, ry, rz, sx, sy, sz)); }

// płaska siatka z kolorem na trójkąt (łąki, wierzchy tarasów, dno stawu); skip: pomiń komórkę
function flatGrid(x0, z0, x1, z1, y, step, colFn, skip) {
  const nx = Math.round((x1 - x0) / step), nz = Math.round((z1 - z0) / step), pos = [], col = [], c = new THREE.Color();
  const tri = (ax, az, bx, bz, cx, cz) => {
    pos.push(ax, y, az, bx, y, bz, cx, y, cz);
    c.set(colFn((ax + bx + cx) / 3, (az + bz + cz) / 3));
    for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
  };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const xa = x0 + i * step, za = z0 + j * step, xb = xa + step, zb = za + step;
    if (skip && skip((xa + xb) / 2, (za + zb) / 2)) continue;
    if ((i + j) % 2) { tri(xa, za, xa, zb, xb, za); tri(xb, za, xa, zb, xb, zb); }
    else { tri(xa, za, xa, zb, xb, zb); tri(xa, za, xb, zb, xb, za); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}

// ściana z rudej ziemi pocięta na bloki (jak sześciany na dioramie): ciemne tło (fugi) + lekko wystające płyty,
// na górze trawiasty okap z „kapiącymi” kępkami. axis 'x': płaszczyzna x = pos (rozciąga się wzdłuż z), 'z': płaszczyzna z = pos.
// out: ±1 – strona, w którą patrzy ściana. visY: poniżej tej wysokości płyty są niewidoczne (pod ziemią/wodą), więc się ich nie stawia.
function earthFace(KH, KD, rand, { axis, pos, out, a0, a1, y0, y1, cell = 1, rowH = 1, visY = -99, lip = true, cols = EARTH }) {
  const P = (a, y, o = 0) => (axis === 'x' ? V3(pos + out * o, y, a) : V3(a, y, pos + out * o));
  quad(KH, P(a0, y0), P(a1, y0), P(a1, y1), P(a0, y1), GROOVE);
  const n = Math.max(1, Math.round((a1 - a0) / cell)), w = (a1 - a0) / n, m = Math.max(1, Math.round((y1 - y0) / rowH)), h = (y1 - y0) / m;
  for (let r = 0; r < m; r++) {
    const ya = y0 + r * h, yb = ya + h; if (yb < visY) continue;
    const deep = r < m - 2 && m > 2;
    for (let i = 0; i < n; i++) {
      const a = a0 + i * w, off = 0.02 + rand() * 0.05, th = 0.04 + off, gap = 0.045;
      const col = deep && rand() < 0.5 ? pick(rand, EARTH_DEEP) : pick(rand, cols);
      const cA = a + w / 2, cY = (ya + yb) / 2 - (r === m - 1 && lip ? 0.06 : 0), hh = h - gap - (r === m - 1 && lip ? 0.12 : 0);
      const c = P(cA, cY, off - th / 2);
      if (axis === 'x') KH.box(th, hh, w - gap, col, M4(c.x, c.y, c.z)); else KH.box(w - gap, hh, th, col, M4(c.x, c.y, c.z));
      if (rand() < 0.12) {                                                // kamyk w ścianie
        const s = 0.12 + rand() * 0.12, q = P(a + 0.2 + rand() * (w - 0.4), ya + 0.15 + rand() * (h - 0.3), off + 0.02);
        KD.add(jitter(new THREE.DodecahedronGeometry(s, 0), s * 0.4, rand), pick(rand, STONE), M4(q.x, q.y, q.z, rand(), rand(), 0, 1, 0.7, 1));
      }
    }
  }
  if (!lip) return;
  const L = a1 - a0, c = P((a0 + a1) / 2, y1 - 0.085, 0.07);                // trawiasty okap (wystaje 12 cm poza ścianę)
  if (axis === 'x') KH.box(0.14, 0.16, L, pick(rand, GRASS_EDGE), M4(c.x, c.y, c.z)); else KH.box(L, 0.16, 0.14, pick(rand, GRASS_EDGE), M4(c.x, c.y, c.z));
  for (let a = a0 + 0.2; a < a1 - 0.2; a += 0.35 + rand() * 0.5) {        // kępki zwisające z okapu
    const hh = 0.08 + rand() * 0.22, q = P(a, y1 - 0.16 - hh / 2, 0.1);
    if (axis === 'x') KD.box(0.07, hh, 0.12 + rand() * 0.2, pick(rand, GRASS_EDGE), M4(q.x, q.y, q.z)); else KD.box(0.12 + rand() * 0.2, hh, 0.07, pick(rand, GRASS_EDGE), M4(q.x, q.y, q.z));
  }
}

// mur z kamiennych bloków na ciemnej zaprawie (bloki wystają 1–3 cm – bez wspólnych płaszczyzn)
function stoneWall(K, x0, y0, z0, x1, y1, z1, rand, { course = 0.42, len = 0.75, cols = STONE } = {}) {
  const alongX = x1 - x0 >= z1 - z0, L = alongX ? x1 - x0 : z1 - z0, nC = Math.max(1, Math.round((y1 - y0) / course)), ch = (y1 - y0) / nC;
  K.box(x1 - x0 - 0.04, y1 - y0, z1 - z0 - 0.04, MORTAR, M4((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
  for (let k = 0; k < nC; k++) {
    const n = Math.max(1, Math.round(L / len)), bl = L / n, off = k % 2 && n > 1 ? bl / 2 : 0, cuts = [0];
    for (let i = 0; i < n; i++) { const c = off + i * bl; if (c > 0.05 && c < L - 0.05) cuts.push(c); }
    cuts.push(L); cuts.sort((a, b) => a - b);
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i], b = cuts[i + 1], mid = (a + b) / 2, y = y0 + (k + 0.5) * ch, c = pick(rand, cols), bump = 0.01 + rand() * 0.025;
      if (alongX) K.box(b - a - 0.05, ch - 0.05, z1 - z0 + bump * 2, c, M4(x0 + mid, y, (z0 + z1) / 2));
      else K.box(x1 - x0 + bump * 2, ch - 0.05, b - a - 0.05, c, M4((x0 + x1) / 2, y, z0 + mid));
    }
  }
}

// okrągła kamienna wieża z blankami (pierścienie bloków w kolorach kamienia)
function roundTower(K, D, G, x, y, z, r, h, rand, { merlons = 10, windows = true, flag = '#d9472b' } = {}) {
  const ring = 0.45, n = Math.round(h / ring);
  for (let i = 0; i < n; i++) {
    const seg = 12, rr = r + (i % 2 ? 0.015 : 0);
    K.add(new THREE.CylinderGeometry(rr, rr, ring - 0.03, seg, 1, false, (i % 2) * (PI / seg)), pick(rand, STONE), M4(x, y + (i + 0.5) * ring, z));
    K.add(new THREE.CylinderGeometry(r - 0.03, r - 0.03, 0.04, 12, 1), MORTAR, M4(x, y + (i + 1) * ring - 0.015, z));
  }
  K.add(new THREE.CylinderGeometry(r + 0.18, r + 0.05, 0.3, 12, 1), pick(rand, STONE), M4(x, y + h + 0.15, z));          // gzyms
  for (let i = 0; i < merlons; i++) {
    const a = (i / merlons) * PI * 2;
    K.box(0.55, 0.65, 0.4, pick(rand, STONE), M4(x + Math.cos(a) * (r + 0.02), y + h + 0.62, z + Math.sin(a) * (r + 0.02), 0, -a + PI / 2));
  }
  D.add(new THREE.CylinderGeometry(r - 0.1, r - 0.1, 0.06, 12, 1), WOOD_DARK[0], M4(x, y + h + 0.29, z));               // podest na szczycie
  if (windows) for (let i = 0; i < 3; i++) {
    const a = rand() * PI * 2, wy = y + 1.6 + i * 1.3;
    const m = M4(x + Math.cos(a) * (r + 0.01), wy, z + Math.sin(a) * (r + 0.01), 0, -a + PI / 2);
    G.box(0.22, 0.55, 0.06, i === 1 ? WARM : '#2a2026', m, i === 1 ? 'glow' : 'solid');
  }
  // maszt z proporcem
  rod(D, V3(x, y + h + 0.3, z), V3(x, y + h + 2.6, z), 0.04, 0.035, WOOD_DARK[1]);
  D.tris([V3(x, y + h + 2.55, z), V3(x + 1.1, y + h + 2.3, z + 0.08), V3(x, y + h + 2.0, z)], flag);
}

// ======================================================================================================
//                                              teren
// ======================================================================================================
// ścieżki strony A (B = odbicie): łamane [x, z]
const PATHS = [
  [[0, -26], [0, -19], [0.4, -14], [0, -9], [0, -6.2]],
  [[0.2, -14.5], [-4.5, -13.2], [-9, -12.2], [-12, -11.6]],
  [[0.2, -14.5], [5, -13.2], [9.5, -14.2], [13.6, -14.6]],
  [[0, -9], [-3, -7.6], [-4.95, -5.6]],
  [[0, -9], [2.6, -7.4], [4.05, -5.6]],
  [[5, -13.2], [7.6, -8], [8.0, -5.2], [7.9, -4.2]],
];
const TOP_PATHS = { cliff: [[-12, -6.4], [-12.3, -3.6], [-12.5, -1.3]], terrace: [[13.6, -9.2], [13.3, -5], [13, -0.6]] };
function segDist(px, pz, [ax, az], [bx, bz]) {
  const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}
const pathDist = (lines, x, z) => { let d = 99; const zz = -Math.abs(z); for (const L of lines) for (let i = 0; i < L.length - 1; i++) d = Math.min(d, segDist(x, zz, L[i], L[i + 1])); return d; };
const grassCol = (x, z) => {
  const n = vnoise(x * 0.35, z * 0.35), n2 = vnoise(x * 1.3 + 9, z * 1.3), k = Math.floor(hash(Math.floor(x * 2), Math.floor(z * 2)) * GRASS.length);
  if (n > 0.72) return GRASS_WARM[k % GRASS_WARM.length];
  return n2 > 0.8 ? GRASS_EDGE[k % GRASS_EDGE.length] : GRASS[k];
};
const dirtOr = (lines, w) => (x, z) => {
  const d = pathDist(lines, x, z) + (vnoise(x * 1.7, z * 1.7) - 0.5) * 0.5;
  return d < w ? DIRT[Math.floor(hash(x * 3.1, z * 2.3) * DIRT.length)] : grassCol(x, z);
};

// wierzchy poziomów (pole gry + kawałek wyspy poza granicą)
const OUT = { x: 23, z: 33 };                                     // brzeg wyspy
const inRect = (x, z, r, m = 0) => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m;
const CLIFF_V = { x0: -OUT.x, x1: CLIFF.x1, z0: CLIFF.z0, z1: CLIFF.z1 };            // płaskowyż sięga do brzegu wyspy
const TERR_V = { x0: TERRACE.x0, x1: OUT.x, z0: TERRACE.z0, z1: TERRACE.z1 };
// obrzeża za granicą pola (strona A; B = odbicie): wyższe bloki jak na dioramie
const RIMS = [
  { x0: -OUT.x, z0: -OUT.z, x1: OUT.x, z1: -28.5, top: 4.2 },                        // tylna ściana (za spawnem)
  { x0: 17.6, z0: -28.5, x1: OUT.x, z1: TERRACE.z0, top: 2.6 },                       // wschód
  { x0: -OUT.x, z0: -28.5, x1: -17.6, z1: -16, top: 1.6 },                            // zachód (niżej)
  { x0: -OUT.x, z0: -16, x1: -17.6, z1: CLIFF.z0, top: 2.4 },
];
const rimAt = (x, z) => { const zz = -Math.abs(z); for (const r of RIMS) if (inRect(x, zz, r)) return r; return null; };
export function topAt(x, z) {
  if (inRect(x, z, CLIFF_V)) return CLIFF.top;
  if (inRect(x, z, TERR_V)) return TERRACE.top;
  const r = rimAt(x, z); if (r) return r.top;
  if (inRect(x, z, POND)) return 0;
  return LAND;
}

function terrain(K, A, rand) {
  const { SOLID } = mats(), meshes = [];
  // łąka (cała wyspa poza stawem, płaskowyżem, tarasem i obrzeżami)
  meshes.push(flatGrid(-OUT.x, -OUT.z, OUT.x, OUT.z, LAND, 1, dirtOr(PATHS, 0.75),
    (x, z) => inRect(x, z, POND) || inRect(x, z, CLIFF_V) || inRect(x, z, TERR_V) || !!rimAt(x, z)));
  meshes.push(flatGrid(-OUT.x, CLIFF.z0, CLIFF.x1, CLIFF.z1, CLIFF.top, 1, (x, z) => {
    if (x > -11.6 && Math.abs(z) < 1.1) return SAND[Math.floor(hash(x, z) * 3)];                       // brzegi strumienia
    return dirtOr([TOP_PATHS.cliff], 0.7)(x, z);
  }));
  meshes.push(flatGrid(TERRACE.x0, TERRACE.z0, OUT.x, TERRACE.z1, TERRACE.top, 1, dirtOr([TOP_PATHS.terrace], 0.85)));
  for (const r of RIMS) for (const s of [1, -1]) meshes.push(flatGrid(r.x0, s > 0 ? r.z0 : -r.z1, r.x1, s > 0 ? r.z1 : -r.z0, r.top, 1, grassCol));
  meshes.push(flatGrid(POND.x0, POND.z0, POND.x1, POND.z1, 0.0, 1, (x, z) => (vnoise(x * 0.8, z * 0.8) > 0.55 ? SAND[1] : '#3f8f86')));   // dno stawu
  for (const g of meshes) { const m = new THREE.Mesh(g, SOLID); m.receiveShadow = true; m.castShadow = false; K.root.add(m); }

  // ---- ściany z ziemi: płaskowyż, taras, brzegi stawu (wspólne; liczone dla całej mapy) ----
  const H = K.H, D = K.D;
  earthFace(H, D, rand, { axis: 'x', pos: CLIFF.x1, out: 1, a0: CLIFF.z0, a1: CLIFF.z1, y0: 0, y1: CLIFF.top, visY: 0.2 });
  for (const s of [-1, 1]) {
    earthFace(H, D, rand, { axis: 'z', pos: s * CLIFF.z1, out: s, a0: -OUT.x, a1: CLIFF.x1, y0: 0, y1: CLIFF.top, visY: LAND });
    earthFace(H, D, rand, { axis: 'z', pos: s * TERRACE.z1, out: s, a0: TERRACE.x0, a1: 17.6, y0: 0, y1: TERRACE.top, visY: LAND, rowH: 0.65 });
    earthFace(H, D, rand, { axis: 'z', pos: s * POND.z1, out: -s, a0: CLIFF.x1, a1: POND.x1, y0: 0, y1: LAND, rowH: 0.5, visY: WATER - 0.1 });
  }
  earthFace(H, D, rand, { axis: 'x', pos: TERRACE.x0, out: -1, a0: TERRACE.z0, a1: TERRACE.z1, y0: 0, y1: TERRACE.top, visY: LAND, rowH: 0.65 });
  earthFace(H, D, rand, { axis: 'x', pos: POND.x1, out: -1, a0: POND.z0, a1: POND.z1, y0: 0, y1: LAND, rowH: 0.5, visY: WATER - 0.1 });

  // ---- obrzeża za granicą (strona A, odbijane): ściany do pola gry ----
  const AD = A.D;
  earthFace(AD, AD, rand, { axis: 'z', pos: -28.5, out: 1, a0: -OUT.x, a1: OUT.x, y0: 0, y1: RIMS[0].top, visY: LAND });
  earthFace(AD, AD, rand, { axis: 'x', pos: 17.6, out: -1, a0: -28.5, a1: TERRACE.z0, y0: 0, y1: RIMS[1].top, visY: LAND, rowH: 0.87 });
  earthFace(AD, AD, rand, { axis: 'x', pos: -17.6, out: 1, a0: -28.5, a1: -16, y0: 0, y1: RIMS[2].top, visY: LAND, rowH: 0.8 });
  earthFace(AD, AD, rand, { axis: 'x', pos: -17.6, out: 1, a0: -16, a1: CLIFF.z0, y0: 0, y1: RIMS[3].top, visY: LAND, rowH: 0.8 });
  earthFace(AD, AD, rand, { axis: 'z', pos: -16, out: -1, a0: -OUT.x, a1: -17.6, y0: RIMS[2].top - 0.02, y1: RIMS[3].top, rowH: 0.8 });
  earthFace(AD, AD, rand, { axis: 'z', pos: TERRACE.z0, out: 1, a0: 17.6, a1: OUT.x, y0: TERRACE.top - 0.02, y1: RIMS[1].top, rowH: 0.8 });

  // ---- brzeg wyspy: ściany w dół do morza chmur (duże bloki) ----
  const R = K.R;
  const edge = (axis, pos, out, a0, a1) => {
    for (let a = a0; a < a1 - 0.01; a += 1) {
      const b = Math.min(a1, a + 1), mid = (a + b) / 2, top = axis === 'x' ? topAt(pos - out * 0.5, mid) : topAt(mid, pos - out * 0.5);
      earthFace(R, R, rand, { axis, pos, out, a0: a, a1: b, y0: -16, y1: top, cell: 1, rowH: 2, lip: true });
    }
  };
  edge('x', -OUT.x, -1, -OUT.z, OUT.z); edge('x', OUT.x, 1, -OUT.z, OUT.z);
  edge('z', -OUT.z, -1, -OUT.x, OUT.x); edge('z', OUT.z, 1, -OUT.x, OUT.x);
  // spód wyspy: skalne stożki w dół (znikają w chmurach)
  for (let i = 0; i < 22; i++) {
    const x = (rand() * 2 - 1) * 19, z = (rand() * 2 - 1) * 29, r = 4 + rand() * 6, h = 10 + rand() * 18;
    R.add(jitter(new THREE.ConeGeometry(r, h, 6, 2), 1.2, rand), pick(rand, EARTH_DEEP), M4(x, -16 - h / 2 + 1, z, PI));
  }
}

// ======================================================================================================
//                                 staw, wodospad, strumień, kładki, wyspa
// ======================================================================================================
function streakTex() {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256; const x = cv.getContext('2d');
  x.fillStyle = '#7fe6ee'; x.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 46; i++) { x.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.55})`; x.fillRect(Math.random() * 64, Math.random() * 256, 1.5 + Math.random() * 3, 18 + Math.random() * 70); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function waterBits(root, K, A, rand) {
  const ticks = [];
  // ---- lustro stawu: turkusowa, lekko świecąca woda z drobną falą ----
  const uT = { value: 0 };
  const wmat = new THREE.MeshStandardMaterial({ color: '#35c2cf', emissive: '#0d7d88', emissiveIntensity: 0.55, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.8, flatShading: true, depthWrite: false });
  wmat.onBeforeCompile = (sh) => {
    sh.uniforms.uT = uT;
    sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed.y += 0.025 * sin(position.x * 1.7 + uT * 1.3) * cos(position.y * 1.3 + uT * 1.1);`);
  };
  wmat.customProgramCacheKey = () => 'kaskady-water';
  const wg = new THREE.PlaneGeometry(POND.x1 - POND.x0, POND.z1 - POND.z0, 30, 20); wg.rotateX(-PI / 2);
  const water = new THREE.Mesh(wg, wmat); water.position.set((POND.x0 + POND.x1) / 2, WATER, 0); water.userData.deco = true; water.renderOrder = 2; root.add(water);
  ticks.push((t) => { uT.value = t; });
  // strumień na płaskowyżu (od ołtarza do krawędzi)
  const sg = new THREE.PlaneGeometry(CLIFF.x1 - (CIRCLE.x + 0.7), FALL.z1 - FALL.z0 - 0.4, 10, 3); sg.rotateX(-PI / 2);
  const stream = new THREE.Mesh(sg, wmat); stream.position.set((CLIFF.x1 + CIRCLE.x + 0.7) / 2, CLIFF.top + 0.045, 0); stream.userData.deco = true; stream.renderOrder = 2; root.add(stream);
  // kamyki na brzegach strumienia
  for (let x = CIRCLE.x + 1; x < CLIFF.x1 - 0.3; x += 0.45 + rand() * 0.4) for (const s of [-1, 1]) {
    const r = 0.1 + rand() * 0.12;
    K.D.add(jitter(new THREE.DodecahedronGeometry(r, 0), r * 0.4, rand), pick(rand, COBBLE), M4(x, CLIFF.top + r * 0.35, s * (FALL.z1 - 0.15 - rand() * 0.15), 0, rand() * 3, 0, 1, 0.6, 1));
  }
  // ---- wodospad z płaskowyżu do stawu ----
  const tex = streakTex(); tex.repeat.set(2, 1.6);
  const fmat = new THREE.MeshBasicMaterial({ map: tex, color: '#bff6fb', transparent: true, opacity: 0.88, side: THREE.DoubleSide, depthWrite: false });
  const fallW = FALL.z1 - FALL.z0 - 0.3;
  const curve = new THREE.CatmullRomCurve3([V3(CLIFF.x1 - 0.3, CLIFF.top + 0.05, 0), V3(CLIFF.x1 + 0.12, CLIFF.top - 0.05, 0), V3(CLIFF.x1 + 0.3, CLIFF.top - 0.6, 0), V3(CLIFF.x1 + 0.38, WATER + 0.05, 0)]);
  const pts = curve.getPoints(16), pos = [], uv = [], idx = [];
  pts.forEach((p, i) => { pos.push(p.x, p.y, -fallW / 2, p.x, p.y, fallW / 2); uv.push(0, 1 - i / 16, 1, 1 - i / 16); if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); fg.setIndex(idx);
  const fall = new THREE.Mesh(fg, fmat); fall.userData.deco = true; fall.renderOrder = 3; root.add(fall);
  ticks.push((t) => { tex.offset.y = t * 1.4; });
  // piana pod wodospadem i mgiełka
  const foam = new THREE.Group(); root.add(foam);
  const fk = new Kit();
  for (let i = 0; i < 26; i++) { const r = 0.18 + rand() * 0.3; fk.add(jitter(new THREE.IcosahedronGeometry(r, 0), r * 0.3, rand), i % 3 ? '#f4fdff' : '#d6f6fa', M4(CLIFF.x1 + 0.5 + rand() * 1.1, WATER + 0.05, (rand() - 0.5) * (fallW + 0.6), 0, rand() * 3, 0, 1, 0.45, 1)); }
  const fm = new THREE.Mesh(fk.geometry('solid'), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6, emissive: '#5fb9c4', emissiveIntensity: 0.25 }));
  fm.userData.deco = true; foam.add(fm);
  ticks.push((t) => { fm.scale.set(1, 1 + 0.25 * Math.sin(t * 6), 1); });
  // ---- świecące kępki w wodzie, lilie, sitowie ----
  const D = K.D;
  for (let i = 0; i < 26; i++) {
    const x = POND.x0 + 1 + rand() * (POND.x1 - POND.x0 - 2), z = (rand() * 2 - 1) * (POND.z1 - 0.6);
    if (Math.abs(x) < 2.4 && Math.abs(z) < 2.4) continue;
    if (BRIDGES.some(([a, b]) => x > a - 0.6 && x < b + 0.6)) continue;
    addLily(D, x, WATER + 0.035, z, rand, ['#4f8a2e', '#5f9a36', '#6aa83c'], ['#ff9ec4', '#fff3d6', '#ffd27a'], 0.3);
  }
  for (const [x, z, n] of [[-6.6, -4.2, 18], [6.2, -1.2, 14], [-2.8, -4.4, 10], [5.9, 4.2, 12], [-6.4, 3.8, 16], [-2.4, 4.4, 9]]) addRushes(D, x, 0, z, rand, n, 1.6, 0.75, true);

  // ---- kładki: deski w poprzek, belki boczne, pale w wodzie, poręcze z liną ----
  for (const [x0, x1] of BRIDGES) {
    const cx = (x0 + x1) / 2, w = x1 - x0;
    K.H.box(w, BRIDGE_TOP - WATER + 0.06, BRIDGE_Z * 2, '#4b3020', M4(cx, (BRIDGE_TOP + WATER) / 2 - 0.05, 0));         // ciemny „rdzeń” pod deskami
    for (let z = -BRIDGE_Z + 0.12; z < BRIDGE_Z; z += 0.26) K.H.box(w + 0.1, 0.07, 0.22, pick(rand, WOOD), M4(cx, BRIDGE_TOP - 0.01 + rand() * 0.012, z + 0.11, 0, (rand() - 0.5) * 0.05));
    for (const s of [x0 - 0.02, x1 + 0.02]) {
      K.H.box(0.12, 0.26, BRIDGE_Z * 2, WOOD_DARK[0], M4(s, BRIDGE_TOP - 0.15, 0));
      for (let z = -BRIDGE_Z + 0.2; z <= BRIDGE_Z; z += 1.8) {
        K.D.box(0.13, 1.0, 0.13, WOOD_DARK[1], M4(s, BRIDGE_TOP + 0.45, z));                                                // słupek poręczy
        K.D.add(new THREE.CylinderGeometry(0.1, 0.12, BRIDGE_TOP + 0.1, 6), WOOD_DARK[2], M4(s, (BRIDGE_TOP - 0.2) / 2, z));   // pal
      }
      for (let z = -BRIDGE_Z + 0.2; z + 1.8 <= BRIDGE_Z + 0.01; z += 1.8) K.D.add(new THREE.CylinderGeometry(0.025, 0.025, 1.8, 4), '#c9a46a', M4(s, BRIDGE_TOP + 0.85, z + 0.9, PI / 2));
    }
  }
  // ---- wyspa: ziemia, trawa, wielki krzak z czerwonymi grzybkami ----
  {
    const I = ISLAND, H = K.H;
    for (const s of [-1, 1]) {
      earthFace(H, D, rand, { axis: 'x', pos: s * I.x1, out: s, a0: I.z0, a1: I.z1, y0: 0, y1: I.top, rowH: 0.4, cell: 0.9, visY: WATER - 0.1 });
      earthFace(H, D, rand, { axis: 'z', pos: s * I.z1, out: s, a0: I.x0, a1: I.x1, y0: 0, y1: I.top, rowH: 0.4, cell: 0.9, visY: WATER - 0.1 });
    }
    const top = flatGrid(I.x0, I.z0, I.x1, I.z1, I.top, 0.6, grassCol);
    const tm = new THREE.Mesh(top, mats().SOLID); tm.receiveShadow = true; K.root.add(tm);
    for (let i = 0; i < 9; i++) {                                                       // krzak: kule liści w obrysie kolizji
      const a = (i / 9) * PI * 2, r = i ? 0.38 + rand() * 0.15 : 0, s = i ? 0.6 + rand() * 0.18 : 0.85;
      H.add(jitter(new THREE.IcosahedronGeometry(s, 1), 0.12, rand), pick(rand, i % 4 ? LEAF.green : LEAF.gold), M4(Math.cos(a) * r, I.top + 0.75 + (i ? rand() * 0.55 : 0.6), Math.sin(a) * r, rand(), rand(), 0, 1, 0.9, 1));
    }
    for (let i = 0; i < 7; i++) mushroom(D, (rand() - 0.5) * 3, I.top, (rand() < 0.5 ? -1 : 1) * (1.3 + rand() * 0.3), rand);
    // kamienie-stopnie z wody (wspólna para A/B)
    for (const s of [-1, 1]) D.add(jitter(new THREE.CylinderGeometry(0.5, 0.58, 0.44, 7, 1), 0.06, rand), pick(rand, COBBLE), M4(0, 0.2, s * 2.2, 0, rand()));
  }
  return ticks;
}

// ======================================================================================================
//                                            obiekty
// ======================================================================================================
function mushroom(K, x, y, z, rand, s = 1) {
  K.add(new THREE.CylinderGeometry(0.035 * s, 0.045 * s, 0.14 * s, 5), '#f3ead8', M4(x, y + 0.07 * s, z));
  K.add(new THREE.SphereGeometry(0.09 * s, 6, 3, 0, PI * 2, 0, PI / 2), rand() < 0.7 ? '#e0402c' : '#f0a830', M4(x, y + 0.13 * s, z));
}
function tree(H, D, x, y, z, s, c, rand) {
  const L = LEAF[c] || LEAF.orange, h = 2.2 * s;
  H.add(new THREE.CylinderGeometry(0.17 * s, 0.26 * s, h + 0.4, 6), pick(rand, BARK), M4(x, y + (h + 0.4) / 2, z));
  for (let i = 0; i < 3; i++) { const a = rand() * PI * 2; rod(D, V3(x, y + h * 0.75, z), V3(x + Math.cos(a) * 0.8 * s, y + h + 0.5 * s, z + Math.sin(a) * 0.8 * s), 0.1 * s, 0.05 * s, BARK[1], 5); }
  const blobs = [[0, 3.35, 0, 1.15], [0.7, 3.0, 0.3, 0.8], [-0.6, 3.1, -0.4, 0.85], [0.2, 3.9, -0.5, 0.75], [-0.3, 3.7, 0.6, 0.75], [0.55, 3.55, -0.65, 0.65]];
  for (const [bx, by, bz, br] of blobs) H.add(jitter(new THREE.IcosahedronGeometry(br * s, 1), 0.14 * s, rand), pick(rand, L), M4(x + bx * s, y + by * s, z + bz * s, rand(), rand(), 0));
}
function pine(H, x, y, z, s, rand) {
  H.add(new THREE.CylinderGeometry(0.12, 0.2, 1.2, 6), pick(rand, BARK), M4(x, y + 0.6, z));
  const tiers = [[1.0, 0.9, 1.9], [0.8, 2.0, 1.7], [0.6, 3.0, 1.5], [0.38, 4.0, 1.4]];
  for (const [r, yy, hh] of tiers) H.add(jitter(new THREE.ConeGeometry(r * s * 1.05, hh * s, 7, 1), 0.06, rand), pick(rand, PINE), M4(x, y + yy * s + hh * s / 2, z, 0, rand() * 3));
}
function rock(H, D, x, y, z, s, rand) {
  H.add(jitter(new THREE.DodecahedronGeometry(0.78 * s, 0), 0.25 * s, rand), pick(rand, ROCK), M4(x, y + 0.45 * s, z, 0, rand() * 3, 0, 1, 0.72, 0.85));
  D.add(jitter(new THREE.DodecahedronGeometry(0.45 * s, 0), 0.12 * s, rand), pick(rand, MOSS), M4(x - 0.1 * s, y + 0.85 * s, z + 0.05 * s, 0, rand() * 3, 0, 1, 0.35, 1));
}
function crate(H, D, P, s, rand, y0 = 0) {
  H.box(s, s, s, pick(rand, WOOD), P(0, y0 + s / 2, 0));
  for (const [dx, dz, w, d] of [[0, s / 2 + 0.01, s + 0.04, 0.04], [0, -s / 2 - 0.01, s + 0.04, 0.04], [s / 2 + 0.01, 0, 0.04, s + 0.04], [-s / 2 - 0.01, 0, 0.04, s + 0.04]]) {
    D.box(w, 0.09, d, WOOD_DARK[0], P(dx, y0 + 0.08, dz)); D.box(w, 0.09, d, WOOD_DARK[0], P(dx, y0 + s - 0.08, dz));
  }
  D.box(s * 0.98, 0.06, 0.04, WOOD_DARK[1], P(0, y0 + s / 2, s / 2 + 0.015, 0, 0, PI / 4)); D.box(s * 0.98, 0.06, 0.04, WOOD_DARK[1], P(0, y0 + s / 2, -s / 2 - 0.015, 0, 0, -PI / 4));
}
function barrel(H, D, P, rand) {
  H.add(new THREE.CylinderGeometry(0.34, 0.34, 0.92, 10, 1), pick(rand, WOOD), P(0, 0.46, 0));
  H.add(new THREE.CylinderGeometry(0.36, 0.36, 0.5, 10, 1), pick(rand, WOOD), P(0, 0.46, 0));
  for (const y of [0.14, 0.46, 0.78]) D.add(new THREE.CylinderGeometry(0.375, 0.375, 0.05, 10, 1), IRON, P(0, y, 0));
}
function lamp(D, G, P, rand) {
  D.box(0.16, 2.6, 0.16, WOOD_DARK[0], P(0, 1.3, 0));
  D.box(0.7, 0.1, 0.1, WOOD_DARK[1], P(0.3, 2.55, 0));
  D.box(0.06, 0.25, 0.06, IRON, P(0.58, 2.4, 0));
  D.box(0.3, 0.06, 0.3, IRON, P(0.58, 2.25, 0)); D.box(0.3, 0.06, 0.3, IRON, P(0.58, 1.86, 0));
  G.box(0.22, 0.34, 0.22, WARM, P(0.58, 2.05, 0), 'glow');
}

function buildObject(o, A, rand) {
  const y = baseY(o), P = local(objM(o.x, y, o.z)), H = A.H, D = A.D, s = o.s || 1;
  switch (o.t) {
    case 'archwall': {
      stoneWall(H, o.x - 4.8, y, o.z - 0.3, o.x - 1.4, y + 1.7, o.z + 0.3, rand);
      stoneWall(H, o.x + 1.4, y, o.z - 0.3, o.x + 4.8, y + 1.7, o.z + 0.3, rand);
      for (const s2 of [-1, 1]) stoneWall(H, o.x + s2 * 1.2 - 0.2, y, o.z - 0.35, o.x + s2 * 1.2 + 0.2, y + 2.3, o.z + 0.35, rand, { course: 0.38, len: 0.4 });
      stoneWall(H, o.x - 1.4, y + 2.3, o.z - 0.3, o.x + 1.4, y + 2.8, o.z + 0.3, rand, { course: 0.5, len: 0.56 });
      H.box(0.5, 0.36, 0.64, '#c9bfae', P(0, 2.62, 0));                                                // zwornik
      for (const s2 of [-1, 1]) D.box(3.6, 0.12, 0.72, pick(rand, STONE), P(s2 * 3.1, 1.76, 0));          // daszek z płyt na murze
      for (let i = 0; i < 9; i++) {                                                                       // bluszcz: kępki listków spływające z korony muru
        const x0 = (rand() * 2 - 1) * 4.3, side = rand() < 0.5 ? -1 : 1, len = 0.5 + rand() * 1.0;
        if (Math.abs(x0) < 1.7) continue;
        for (let k = 0; k < 7; k++) {
          const r = 0.09 + rand() * 0.07, x = x0 + (rand() - 0.5) * 0.45 * (1 + k / 7), yy = 1.72 - (k / 7) * len;
          D.add(jitter(new THREE.IcosahedronGeometry(r, 0), r * 0.35, rand), pick(rand, MOSS), P(x, yy, side * (0.34 + r * 0.35), 0, rand() * 3, 0, 1, 1, 0.55));
        }
      }
      break;
    }
    case 'tower': {
      roundTower(H, D, A.G, o.x, y, o.z, 1.5, 5.4, rand, { merlons: 9, flag: '#e8742a' });
      D.box(0.9, 1.6, 0.08, WOOD_DARK[0], P(0, 0.8, 1.52));                                                 // drzwi od strony pola
      D.box(1.05, 0.12, 0.1, IRON, P(0, 1.6, 1.53));
      break;
    }
    case 'stall': {
      H.box(2.9, 1.05, 0.85, pick(rand, WOOD), P(0, 0.525, -0.025));
      for (let i = 0; i < 6; i++) D.box(2.94, 0.04, 0.02, WOOD_DARK[0], P(0, 0.12 + i * 0.17, 0.41));
      for (const [px, pz] of [[-1.45, -0.9], [1.45, -0.9], [-1.45, 0.9], [1.45, 0.9]]) D.box(0.12, 2.45, 0.12, WOOD_DARK[1], P(px, 1.22, pz));
      for (let i = 0; i < 8; i++) H.box(0.4, 0.06, 1.95, i % 2 ? '#f3e7cf' : '#e8742a', P(-1.4 + i * 0.4, 2.55, 0, 0.12));   // markiza w pasy
      for (let i = 0; i < 6; i++) {                                                                        // dynie i jabłka
        const px = -1.1 + i * 0.44, r = 0.15 + rand() * 0.06;
        D.add(new THREE.SphereGeometry(r, 7, 5), i % 3 ? '#f08a2e' : '#d9472b', P(px, 1.05 + r * 0.8, -0.1, 0, 0, 0, 1, 0.8, 1));
        D.add(new THREE.CylinderGeometry(0.02, 0.025, 0.08, 4), '#4f7a2e', P(px, 1.05 + r * 1.6, -0.1));
      }
      break;
    }
    case 'crate': crate(H, D, P, s, rand); if (o.stack) crate(H, D, P, s * 0.7, rand, s); break;
    case 'hay': {
      H.box(1.5, 0.95, 1.0, '#e2c25a', P(0, 0.475, 0));
      for (const yy of [0.25, 0.7]) D.box(1.52, 0.05, 1.02, '#b48a3a', P(0, yy, 0));
      for (let i = 0; i < 10; i++) D.box(0.02, 0.12, 0.02, '#f0d270', P((rand() - 0.5) * 1.4, 0.98, (rand() - 0.5) * 0.9, rand(), 0, rand()));
      break;
    }
    case 'tree': tree(H, D, o.x, y, o.z, s, o.c, rand); break;
    case 'pine': pine(H, o.x, y, o.z, s, rand); break;
    case 'rock': rock(H, D, o.x, y, o.z, s, rand); break;
    case 'log': {
      H.add(new THREE.CylinderGeometry(0.31, 0.31, 3.0, 8), pick(rand, BARK), P(0, 0.31, 0, 0, 0, PI / 2));
      for (const s2 of [-1, 1]) D.add(new THREE.CircleGeometry(0.29, 8), '#d9b27a', P(s2 * 1.505, 0.31, 0, 0, s2 * PI / 2));
      for (let i = 0; i < 5; i++) D.add(jitter(new THREE.IcosahedronGeometry(0.22, 0), 0.06, rand), pick(rand, MOSS), P(-1.2 + i * 0.6, 0.55, (rand() - 0.5) * 0.2, 0, 0, 0, 1, 0.4, 1));
      for (let i = 0; i < 4; i++) mushroom(D, o.x - 1 + i * 0.7, y + 0.5, o.z + (rand() < 0.5 ? 0.22 : -0.22), rand, 0.8);
      break;
    }
    case 'barrel': barrel(H, D, P, rand); break;
    case 'cart': {
      H.box(1.9, 0.5, 1.15, pick(rand, WOOD), P(0, 0.7, 0));
      for (const s2 of [-1, 1]) {
        H.box(1.95, 0.35, 0.08, WOOD_DARK[0], P(0, 1.0 - 0.175 + 0.15, s2 * 0.58));
        D.add(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 10), WOOD_DARK[1], P(0, 0.42, s2 * 0.66, PI / 2));
        D.add(new THREE.CylinderGeometry(0.08, 0.08, 0.14, 6), IRON, P(0, 0.42, s2 * 0.72, PI / 2));
      }
      D.box(1.3, 0.06, 0.06, WOOD_DARK[0], P(-1.5, 0.55, 0.25, 0, 0, 0.25)); D.box(1.3, 0.06, 0.06, WOOD_DARK[0], P(-1.5, 0.55, -0.25, 0, 0, 0.25));
      for (let i = 0; i < 4; i++) D.add(new THREE.SphereGeometry(0.2, 7, 5), '#f08a2e', P(-0.5 + i * 0.35, 1.05, (rand() - 0.5) * 0.4, 0, 0, 0, 1, 0.8, 1));
      break;
    }
    case 'lamp': lamp(D, A.G, P, rand); break;
    default:
  }
}

// ---------------- płaskowyż: krąg kamieni, ołtarz z kryształem, murki ----------------
function cliffTop(K, A, rand) {
  const T = CLIFF.top;
  for (const p of PARAPETS) {
    stoneWall(A.H, p[0], p[1], p[2], p[3], p[4], p[5], rand, { course: 0.32, len: 0.6 });
    const cx = (p[0] + p[3]) / 2, cz = (p[2] + p[5]) / 2, w = p[3] - p[0] + 0.12, d = p[5] - p[2] + 0.12;
    A.D.box(w, 0.08, d, pick(rand, COBBLE), M4(cx, p[4] + 0.04, cz));                                     // płyty na koronie murka
  }
  for (const m of MENHIRS) {
    const g = jitter(new THREE.BoxGeometry(0.72, m.h, 0.62, 1, 3, 1), 0.07, rand);
    const pos = g.attributes.position; for (let i = 0; i < pos.count; i++) { const yy = pos.getY(i) / m.h + 0.5; pos.setX(i, pos.getX(i) * (1 - 0.25 * yy)); pos.setZ(i, pos.getZ(i) * (1 - 0.2 * yy)); }
    A.H.add(g, pick(rand, ROCK), M4(m.x, T + m.h / 2, m.z, 0, m.rot + PI / 2));
    A.D.add(jitter(new THREE.IcosahedronGeometry(0.3, 0), 0.08, rand), pick(rand, MOSS), M4(m.x, T + m.h - 0.05, m.z, 0, rand() * 3, 0, 1, 0.45, 1));
    for (let k = 0; k < 3; k++) A.G.box(0.16, 0.05, 0.03, RUNE, M4(m.x + Math.cos(m.rot) * 0, T + 0.9 + k * 0.38, m.z, 0, m.rot + PI / 2).multiply(M4(0, 0, 0.33)), 'glow');
  }
  // ołtarz (wspólny) z kryształem
  stoneWall(K.H, CIRCLE.x - 0.7, T, -0.5, CIRCLE.x + 0.7, T + 0.75, 0.5, rand, { course: 0.37, len: 0.7 });
  K.D.box(1.56, 0.1, 1.16, pick(rand, COBBLE), M4(CIRCLE.x, T + 0.8, 0));
  K.G.add(new THREE.OctahedronGeometry(0.32, 0), RUNE, M4(CIRCLE.x, T + 1.35, 0, 0, 0.4, 0, 1, 1.6, 1), 'glow');
  for (let i = 0; i < 5; i++) { const a = (i / 5) * PI * 2; K.G.add(new THREE.OctahedronGeometry(0.08, 0), RUNE, M4(CIRCLE.x + Math.cos(a) * 0.45, T + 0.92, Math.sin(a) * 0.3, 0, a, 0, 1, 1.8, 1), 'glow'); }
  // kamienne płyty wokół kręgu
  for (let i = 0; i < 14; i++) { const a = (i / 14) * PI * 2, r = CIRCLE.r + 0.9; K.D.box(0.7, 0.06, 0.5, pick(rand, COBBLE), M4(CIRCLE.x + Math.cos(a) * r, T + 0.015, Math.sin(a) * r, 0, -a)); }
}

// ---------------- taras: mur z bramą, wieże, proporce, pochodnie ----------------
function gate(K, rand) {
  const y = TERRACE.top, { x0: g0, x1: g1, h, wall, tower, tr, t } = GATE;
  for (const [i, cx] of TOWERS.entries()) roundTower(K.H, K.D, K.G, cx, y, 0, tr - 0.06, tower, rand, { merlons: 8, flag: i ? '#2fb8c4' : '#d9472b' });
  stoneWall(K.H, TOWERS[0] + tr * 0.9, y, -t, g0, y + wall, t, rand);
  stoneWall(K.H, g1, y, -t, TOWERS[1] - tr * 0.9, y + wall, t, rand);
  stoneWall(K.H, g0, y + h, -t, g1, y + wall, t, rand, { course: 0.3, len: 0.4 });
  for (const [a, b] of [[TOWERS[0] + tr * 0.9, g0], [g1, TOWERS[1] - tr * 0.9]]) for (let x = a + 0.15; x < b - 0.2; x += 0.62) K.D.box(0.36, 0.42, t * 2 + 0.06, pick(rand, STONE), M4(x + 0.18, y + wall + 0.21, 0));
  // krata (podniesiona) i proporce na murze
  for (let x = g0 + 0.15; x < g1; x += 0.27) K.D.box(0.05, 0.55, 0.05, IRON, M4(x, y + h + 0.06 - 0.25, 0));
  for (const s of [-1, 1]) {
    for (const cx of [g0 - 0.35, g1 + 0.35]) {
      K.D.box(0.52, 1.5, 0.02, s < 0 ? '#c93a26' : '#2fa2b0', M4(cx, y + wall - 0.95, s * (t + 0.06)));
      K.D.tris([V3(cx - 0.26, y + wall - 1.7, s * (t + 0.06)), V3(cx + 0.26, y + wall - 1.7, s * (t + 0.06)), V3(cx, y + wall - 1.95, s * (t + 0.06))], s < 0 ? '#c93a26' : '#2fa2b0');
      K.D.box(0.22, 0.22, 0.04, '#f2c14e', M4(cx, y + wall - 0.65, s * (t + 0.085)));
    }
    for (const cx of [g0 - 0.18, g1 + 0.18]) {                                                               // pochodnie przy bramie
      K.D.box(0.08, 0.4, 0.08, WOOD_DARK[0], M4(cx, y + 1.85, s * (t + 0.12), s * 0.4));
      K.G.add(new THREE.OctahedronGeometry(0.12, 0), '#ffb347', M4(cx, y + 2.12, s * (t + 0.2), 0, 0, 0, 1, 1.6, 1), 'glow');
    }
  }
  // brukowana droga przez bramę
  for (let z = -2.4; z <= 2.4; z += 0.48) for (let x = g0 + 0.15; x < g1 - 0.1; x += 0.46) K.D.box(0.4, 0.06, 0.42, pick(rand, COBBLE), M4(x + 0.2, y + 0.005, z + (Math.floor(x * 2) % 2) * 0.12));
}

// ---------------- schody ----------------
function stairs(A, rand) {
  for (const s of STAIRS) {
    const steps = stairSteps(s), n = steps.length, wood = s.name === 'terrace';
    steps.forEach(([x0, , z0, x1, y1, z1], k) => {
      // widoczny stopień: od ziemi do wysokości, tylko na swoim odcinku (bez nakładania się ścian sąsiednich stopni)
      let a0 = x0, b0 = z0, a1 = x1, b1 = z1;
      if (k < n - 1) { const nx = steps[k + 1]; if (s.dir === 'z') b1 = nx[2]; else a1 = nx[0]; }
      const cx = (a0 + a1) / 2, cz = (b0 + b1) / 2, w = a1 - a0, d = b1 - b0;
      if (wood) {
        A.H.box(w, y1 - 0.06, d, WOOD_DARK[0], M4(cx, (y1 - 0.06) / 2, cz));
        A.H.box(w + 0.04, 0.08, d + 0.03, pick(rand, WOOD), M4(cx, y1 - 0.04, cz));
      } else {
        A.H.box(w, y1 - 0.07, d, pick(rand, STONE), M4(cx, (y1 - 0.07) / 2, cz));
        A.H.box(w + 0.03, 0.09, d + 0.02, pick(rand, COBBLE), M4(cx, y1 - 0.045, cz));
      }
    });
    // boczne poręcze (drewno) albo kamienne słupki
    const side = s.dir === 'z' ? [[s.x0 - 0.08, s.z0, s.x0 - 0.08, s.z1], [s.x1 + 0.08, s.z0, s.x1 + 0.08, s.z1]] : [[s.x0, s.z0 - 0.08, s.x1, s.z0 - 0.08], [s.x0, s.z1 + 0.08, s.x1, s.z1 + 0.08]];
    for (const [ax, az, bx, bz] of side) {
      const ya = s.from + 0.95, yb = s.to + 0.95;
      if (wood) {
        rod(A.D, V3(ax, ya, az), V3(bx, yb, bz), 0.045, 0.045, WOOD_DARK[1], 5);
        for (let k = 0; k <= 3; k++) { const t = k / 3, px = ax + (bx - ax) * t, pz = az + (bz - az) * t, py = s.from + (s.to - s.from) * t; A.D.box(0.1, 1.0, 0.1, WOOD_DARK[0], M4(px, py + 0.45, pz)); }
      } else {
        for (const t of [0, 1]) { const px = ax + (bx - ax) * t, pz = az + (bz - az) * t, py = s.from + (s.to - s.from) * t; A.D.box(0.34, 0.6, 0.34, pick(rand, STONE), M4(px, py + 0.3, pz)); A.D.box(0.4, 0.08, 0.4, pick(rand, COBBLE), M4(px, py + 0.64, pz)); }
      }
    }
  }
  // stopień z wody pod schodami od stawu
  const [x0, , z0, x1, y1, z1] = POND_STEP;
  A.H.box(x1 - x0, y1, z1 - z0, pick(rand, COBBLE), M4((x0 + x1) / 2, y1 / 2, (z0 + z1) / 2));
}

// ---------------- płot z desek na krawędzi tarasu ----------------
function fences(A, rand) {
  const y = TERRACE.top;
  for (const [ax, az, bx, bz] of FENCES) {
    const alongX = Math.abs(bx - ax) > Math.abs(bz - az), L = alongX ? Math.abs(bx - ax) : Math.abs(bz - az), x0 = Math.min(ax, bx), z0 = Math.min(az, bz);
    for (let u = 0.07; u < L - 0.05; u += 0.2) {
      const hh = FENCE_H - 0.05 - rand() * 0.08, px = alongX ? x0 + u + 0.07 : ax, pz = alongX ? az : z0 + u + 0.07;
      A.H.box(alongX ? 0.17 : 0.1, hh, alongX ? 0.1 : 0.17, pick(rand, WOOD), M4(px, y + hh / 2, pz));
      A.D.add(new THREE.ConeGeometry(0.085, 0.1, 4), WOOD[2], M4(px, y + hh + 0.05, pz, 0, PI / 4));
    }
    for (const yy of [0.28, 0.75]) A.D.box(alongX ? L : 0.06, 0.08, alongX ? 0.06 : L, WOOD_DARK[0], M4(alongX ? x0 + L / 2 : ax - 0.09, y + yy, alongX ? az - 0.09 : z0 + L / 2));   // rygle od zewnątrz
  }
}

// ---------------- drobiazgi na trawie: kępki, kwiaty, grzyby, liście, bruk ----------------
function details(A, rand) {
  const D = A.D, R = A.R;
  const solid = (x, z, y) => MAP.colliders.some(([a, b, c, d, e, f]) => x > a - 0.15 && x < d + 0.15 && z > c - 0.15 && z < f + 0.15 && e > y + 0.04 && b < y + 1.5);
  const spots = (n, x0, z0, x1, z1, y, fn) => { for (let i = 0; i < n; i++) { const x = x0 + rand() * (x1 - x0), z = z0 + rand() * (z1 - z0); if (topAt(x, z) !== y || solid(x, z, y)) continue; fn(x, z, y); } };
  const tuft = (x, z, y) => { const c = pick(rand, GRASS_EDGE); for (let k = 0; k < 4; k++) { const a = rand() * PI * 2, h = 0.18 + rand() * 0.22; R.add(new THREE.ConeGeometry(0.035, h, 3), c, M4(x + Math.cos(a) * 0.08, y + h / 2, z + Math.sin(a) * 0.08, (rand() - 0.5) * 0.5, 0, (rand() - 0.5) * 0.5)); } };
  const flower = (x, z, y) => { const c = pick(rand, ['#f4f1e8', '#ffd447', '#e85a8a', '#9b7fe0', '#ff8a3a']); R.add(new THREE.CylinderGeometry(0.01, 0.012, 0.22, 3), '#4f7a2e', M4(x, y + 0.11, z)); R.add(new THREE.OctahedronGeometry(0.06, 0), c, M4(x, y + 0.24, z)); };
  const leaf = (x, z, y) => R.add(new THREE.CircleGeometry(0.045 + rand() * 0.03, 4), pick(rand, rand() < 0.5 ? LEAF.orange : LEAF.red), M4(x, y + 0.03, z, -PI / 2 + (rand() - 0.5) * 0.4, rand() * 6, 0, 1, 1.6, 1));
  for (const [y, x0, z0, x1, z1] of [[LAND, -17, -27, 17, -5.2], [CLIFF.top, -17, -6, -8.4, -0.2], [TERRACE.top, 9.3, -9, 17, -0.6]]) {
    spots(y === LAND ? 520 : 140, x0, z0, x1, z1, y, (x, z) => { if (pathDist(y === LAND ? PATHS : [TOP_PATHS.cliff, TOP_PATHS.terrace], x, z) < 0.9) return; tuft(x, z, y); });
    spots(y === LAND ? 170 : 50, x0, z0, x1, z1, y, (x, z) => { if (pathDist(y === LAND ? PATHS : [TOP_PATHS.cliff, TOP_PATHS.terrace], x, z) < 0.9) return; flower(x, z, y); });
    spots(y === LAND ? 200 : 60, x0, z0, x1, z1, y, leaf);
    spots(y === LAND ? 22 : 8, x0, z0, x1, z1, y, (x, z) => mushroom(D, x, y, z, rand, 0.8 + rand() * 0.6));
  }
  // bruk na głównej ścieżce (spawn → łuk → staw): kamienie lekko zatopione w ziemi
  const main = PATHS[0];
  for (let i = 0; i < main.length - 1; i++) {
    const [ax, az] = main[i], [bx, bz] = main[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.floor(L / 0.5), ang = Math.atan2(bx - ax, bz - az);
    for (let k = 0; k < n; k++) for (let j = -1; j <= 1; j++) {
      const t = (k + 0.5) / n, px = ax + (bx - ax) * t + Math.cos(ang) * j * 0.48 + (rand() - 0.5) * 0.08, pz = az + (bz - az) * t - Math.sin(ang) * j * 0.48 + (rand() - 0.5) * 0.08;
      if (solid(px, pz, LAND) || Math.abs(pz + 19) < 0.45) continue;
      D.box(0.38 + rand() * 0.06, 0.09, 0.38 + rand() * 0.06, pick(rand, COBBLE), M4(px, LAND - 0.02 + rand() * 0.012, pz, 0, ang + (rand() - 0.5) * 0.3));
    }
  }
}

// ---------------- świat za granicą pola: drzewa na obrzeżach, kopalnia, wodospady z brzegu wyspy ----------------
function outerWorld(K, A, root, rand) {
  const D = A.R;
  // drzewa i świerki na obrzeżach (strona A, odbijane) – poza polem gry, bez kolizji
  for (let i = 0; i < 70; i++) {
    const x = (rand() * 2 - 1) * (OUT.x - 1), z = -(9 + rand() * (OUT.z - 10));
    if (Math.abs(x) < HX + 1.2 && z > -HZ - 1.6) continue;
    const y = topAt(x, z), s = 0.8 + rand() * 0.5;
    if (rand() < 0.45) pine(D, x, y, z, s, rand); else tree(D, D, x, y, z, s * 0.9, pick(rand, ['orange', 'red', 'gold', 'green', 'orange']), rand);
  }
  for (let i = 0; i < 30; i++) { const x = (rand() * 2 - 1) * (OUT.x - 1), z = -(28.8 + rand() * 3.8); rock(D, D, x, topAt(x, z), z, 0.6 + rand() * 0.6, rand); }
  // kopalnia w tylnej ścianie (strona A): ciemne wejście w drewnianej ramie, tory i wózek
  const mx = 8.5, mz = -28.5;
  D.box(2.2, 2.6, 0.06, '#1c1410', M4(mx, LAND + 1.3, mz + 0.03));
  for (const s of [-1, 1]) D.box(0.26, 2.9, 0.3, WOOD_DARK[0], M4(mx + s * 1.2, LAND + 1.45, mz + 0.16));
  D.box(2.9, 0.3, 0.34, WOOD_DARK[1], M4(mx, LAND + 2.95, mz + 0.16));
  for (let z = mz + 0.3; z < -26.6; z += 0.45) D.box(1.2, 0.06, 0.16, WOOD_DARK[2], M4(mx, LAND + 0.0, z));
  for (const s of [-1, 1]) D.box(0.05, 0.06, 2.0, IRON, M4(mx + s * 0.38, LAND + 0.05, -27.5));
  D.box(1.0, 0.6, 0.8, '#6a5a4a', M4(mx, LAND + 0.55, -27.3)); D.box(0.9, 0.12, 0.7, '#3a3028', M4(mx, LAND + 0.86, -27.3));
  for (let i = 0; i < 5; i++) D.add(jitter(new THREE.DodecahedronGeometry(0.16, 0), 0.05, rand), '#2a2a30', M4(mx + (rand() - 0.5) * 0.6, LAND + 0.95, -27.3 + (rand() - 0.5) * 0.4));
  A.G.box(0.16, 0.26, 0.16, WARM, M4(mx - 1.2, LAND + 2.2, mz + 0.38), 'glow');
  // strumienie spływające z obrzeży do brzegu wyspy i wodospady w dół (deko)
  const tex = streakTex(); tex.repeat.set(1, 6);
  const fmat = new THREE.MeshBasicMaterial({ map: tex, color: '#bff6fb', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, fog: true });
  const falls = [[-OUT.x, -21, -1, RIMS[2].top], [OUT.x, -19, 1, RIMS[1].top], [-OUT.x, 21, -1, RIMS[2].top], [OUT.x, 19, 1, RIMS[1].top], [-6, -OUT.z, 0, RIMS[0].top], [-6, OUT.z, 0, RIMS[0].top]];
  for (const [x, z, sx, top] of falls) {
    const along = sx === 0, w = 1.6, g = new THREE.PlaneGeometry(w, top + 16, 1, 1);
    const m = new THREE.Mesh(g, fmat); m.userData.deco = true; m.renderOrder = 3;
    if (along) m.position.set(x, (top - 16) / 2, z + Math.sign(z) * 0.32); else { m.position.set(x + sx * 0.32, (top - 16) / 2, z); m.rotation.y = PI / 2; }
    root.add(m);
    const sg = new THREE.PlaneGeometry(along ? w : 4.5, along ? 4.5 : w); sg.rotateX(-PI / 2);
    const st = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: '#35c2cf', emissive: '#0d7d88', emissiveIntensity: 0.5, roughness: 0.15, transparent: true, opacity: 0.85, depthWrite: false }));
    st.position.set(along ? x : x - sx * 2.2, top + 0.04, along ? z - Math.sign(z) * 2.2 : z); st.userData.deco = true; root.add(st);
  }
  return [(t) => { tex.offset.y = t * 1.2; }];
}

// ======================================================================================================
export function buildKaskady() {
  const rand = rng(20261122);
  const root = new THREE.Group(); root.name = 'Kaskady';
  const kit = () => ({ H: new Kit(), D: new Kit(), R: new Kit(), G: new Kit() });
  const K = kit(), A = kit(); K.root = root;
  terrain(K, A, rand);
  const ticks = waterBits(root, K, A, rand);
  cliffTop(K, A, rand);
  gate(K, rand);
  stairs(A, rand);
  fences(A, rand);
  for (const o of OBJECTS.filter((q) => q.side === 'A')) buildObject(o, A, rand);
  details(A, rand);
  ticks.push(...outerWorld(K, A, root, rand));
  // strona A + jej odbicie na stronę B
  for (const k of Object.keys(A)) for (const kind of ['solid', 'glow']) for (const g of A[k].L[kind]) K[k].L[kind].push(g, g.clone().applyMatrix4(MZ));
  const { SOLID, GLOW } = mats();
  const add = (geo, mat, deco, shadow) => { if (!geo) return; const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = true; m.userData.deco = deco; root.add(m); };
  add(K.H.geometry('solid'), SOLID, false, true);
  add(K.D.geometry('solid'), SOLID, true, true);
  add(K.R.geometry('solid'), SOLID, true, false);
  for (const k of ['H', 'D', 'R', 'G']) add(K[k].geometry('glow'), GLOW, true, false);
  add(K.G.geometry('solid'), SOLID, true, false);
  root.userData.tick = (t) => { for (const f of ticks) f(t); };   // woda, wodospady (wywołuje klimat mapy co klatkę)
  return root;
}
