// Wygląd mapy BAGNO (1v1): przystań na bagnie w złotym, wilgotnym świetle późnego popołudnia. Budowana w kodzie (low poly, płaskie kolory).
// Układ, kolizje i spawny są w zrodla/oaza-data.js – grafika używa tych samych liczb, więc siedzi dokładnie w bryłach kolizji.
// Siatki oznaczone userData.deco (trawa, trzciny, liście, kable, szyldy i wszystko poza polem gry) nie biorą udziału w trafieniach.
// Niebo, mgła, światło, woda, panorama miasta i ptaki: themeBayou w zrodla/klimaty.js.
import * as THREE from 'three';
import { Kit, M4, V3, between, jitter, rng, mats, addPalm, addRushes, addLily, neonSign } from './klimaty.js';
import { HX, HZ, LAND, WL, DECK, PIER, SHACK, WATER, DECK_RECT, GANGWAYS, PIERS, FINGERS, PILES, POSTS, SHACK_WALLS, OBJECTS, baseY, MAP } from './oaza-data.js';

const PI = Math.PI, UP = V3(0, 1, 0);
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];
const inMap = (x, z, m = 0) => Math.abs(x) < HX + m && Math.abs(z) < HZ + m;
// komórka siatki w wodzie (prostokąty WATER, środek komórki nigdy nie leży na krawędzi)
const wetCell = (x, z) => WATER.some(([x0, z0, x1, z1]) => x > x0 && x < x1 && z > z0 && z < z1);
const distWater = (x, z) => Math.min(...WATER.map(([x0, z0, x1, z1]) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1))));

// ---------------- materiały ----------------
let GLOSS = null, TERRAIN = null;
function materials() {
  if (!GLOSS) {
    GLOSS = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.32, metalness: 0.35, side: THREE.DoubleSide });
    TERRAIN = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
  }
  return { GLOSS, TERRAIN };
}

// macierz obiektu z układu (pozycja, podstawa i obrót wokół Y) i pomocnik do części w układzie lokalnym
const objMatrix = (x, y, z, rot = 0) => new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromAxisAngle(UP, rot), V3(1, 1, 1));
function local(OM) {
  const P = (lx, ly, lz, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => OM.clone().multiply(M4(lx, ly, lz, rx, ry, rz, sx, sy, sz));
  P.pt = (lx, ly, lz) => V3(lx, ly, lz).applyMatrix4(OM);
  return P;
}
// walec między dwoma punktami świata
const rod = (K, a, b, r0, r1, col, seg = 6) => { const [m, len] = between(a, b); K.add(new THREE.CylinderGeometry(r1, r0, len, seg, 1), col, m); };
// łuk (korzeń, kabel): krzywa Béziera z a do b przez punkt kontrolny c
function arc(K, a, c, b, r0, r1, col, n = 6, seg = 6) {
  const q = (t) => V3().copy(a).multiplyScalar((1 - t) * (1 - t)).addScaledVector(c, 2 * t * (1 - t)).addScaledVector(b, t * t);
  for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n; rod(K, q(t0), q(t1), r0 + (r1 - r0) * t0, r0 + (r1 - r0) * t1, col, seg); }
}

// ======================================================================================================
//                                               teren
// ======================================================================================================
const GRASS = ['#5fae36', '#68b83c', '#57a332', '#73bd44', '#64ad3a'];
// ścieżki z ubitej ziemi: od spawnu do kładki na taras i do bocznej kładki na pomost (strona A, B = odbicie)
const PATHS_A = [[[0, -24.5], [-3.6, -21.2], [-3.4, -16.5], [-1.4, -11.5], [0, -7.2], [0, -5]], [[-1.4, -11.5], [4.5, -10.4], [9.2, -8.2], [10.2, -5]]];
const PATHS = [...PATHS_A, ...PATHS_A.map((p) => p.map(([x, z]) => [-x, -z]))];
function distPath(x, z) {
  let best = 1e9;
  for (const p of PATHS) for (let i = 0; i < p.length - 1; i++) {
    const [ax, az] = p[i], [bx, bz] = p[i + 1], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}
function landColor(x, z) {
  const n = vnoise(x * 0.35, z * 0.35), n2 = vnoise(x * 1.7 + 9, z * 1.7), dp = distPath(x + (n - 0.5) * 0.8, z), dw = distWater(x, z);
  if (dp < 0.85) return n2 < 0.5 ? '#a27a4a' : '#956f42';                         // ubita ziemia
  if (dp < 1.25) return n2 < 0.5 ? '#86844a' : '#7d8a44';                         // wydeptana trawa przy ścieżce
  if (dw < 0.9) return n2 < 0.5 ? '#6a5534' : '#5f4c2f';                          // błoto przy umocnieniu
  if (dw < 1.7 && n2 < 0.55) return '#6f8a3a';
  if (n > 0.72) return n2 < 0.5 ? '#8fbf4a' : '#9cc452';                          // słoneczne, żółtawe placki trawy
  return GRASS[Math.floor((n * 0.6 + n2 * 0.4) * GRASS.length) % GRASS.length];
}
// siatka terenu z kolorem na trójkąt (płaskie low poly); hFn: wysokość wierzchołka, colFn: kolor trójkąta
function terrainMesh(x0, z0, x1, z1, step, hFn, colFn) {
  const nx = Math.round((x1 - x0) / step), nz = Math.round((z1 - z0) / step), W = nx + 1, H = new Float32Array(W * (nz + 1));
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) H[j * W + i] = hFn(x0 + i * step, z0 + j * step);
  const pos = [], col = [], c = new THREE.Color();
  const tri = (ax, az, bx, bz, cx, cz, ha, hb, hc) => {
    if (ha < -1.5 && hb < -1.5 && hc < -1.5) return;                               // pod terenem pola gry: niewidoczne
    pos.push(ax, ha, az, bx, hb, bz, cx, hc, cz);
    c.set(colFn((ax + bx + cx) / 3, (az + bz + cz) / 3, (ha + hb + hc) / 3));
    for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
  };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const xa = x0 + i * step, za = z0 + j * step, xb = xa + step, zb = za + step;
    const h00 = H[j * W + i], h10 = H[j * W + i + 1], h01 = H[(j + 1) * W + i], h11 = H[(j + 1) * W + i + 1];
    if ((i + j) % 2) { tri(xa, za, xa, zb, xb, za, h00, h01, h10); tri(xb, za, xa, zb, xb, zb, h10, h01, h11); }
    else { tri(xa, za, xa, zb, xb, zb, h00, h01, h11); tri(xa, za, xb, zb, xb, za, h00, h11, h10); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}
// teren pola gry: ląd równo na LAND (fizyka gracza), dno rozlewiska 0,25 m pod zerem; siatka 0,5 m trafia w krawędzie umocnień
function innerTerrain() {
  const S = 0.5, bed = -0.25;
  const h = (x, z) => {
    let wet = true;                                                              // wierzchołek jest w wodzie, gdy wszystkie sąsiednie komórki pola są w wodzie
    for (const dx of [-S / 2, S / 2]) for (const dz of [-S / 2, S / 2]) { const cx = x + dx, cz = z + dz; if (Math.abs(cx) < HX && Math.abs(cz) < HZ && !wetCell(cx, cz)) wet = false; }
    return wet ? bed - 0.12 * vnoise(x * 0.8, z * 0.8) : LAND;
  };
  const col = (x, z, y) => (y < 0.3 ? (vnoise(x * 0.6, z * 0.6) < 0.5 ? '#3d4a2a' : '#46502c') : landColor(x, z));
  const m = new THREE.Mesh(terrainMesh(-HX, -HZ, HX, HZ, S, h, col), materials().TERRAIN);
  m.name = 'teren'; m.receiveShadow = true;
  return m;
}
// teren dookoła (tylko wygląd): rozlewisko ciągnie się na wschód i zachód, dalej łąki, kępy drzew i niskie wzgórza
function outerWet(x, z) {
  const ax = Math.abs(x) - HX, n = (vnoise(x * 0.045, z * 0.045) - 0.5) * 8;
  if (x > 0) { const lo = -5 - ax * 0.32 + n, hi = 11 + ax * 0.45 + n; if (z > lo && z < hi) return true; }
  else { const lo = -11 - ax * 0.45 + n, hi = 5 + ax * 0.32 + n; if (z > lo && z < hi) return true; }
  const d = Math.hypot(x - 64, z + 66), d2 = Math.hypot(x + 70, z - 70);                 // dwa stawy dalej od przystani
  return d < 20 + n || d2 < 18 + n;
}
function outerTerrain() {
  const S = 2;
  const h = (x, z) => {
    if (Math.abs(x) < HX - 0.01 && Math.abs(z) < HZ - 0.01) return -2;              // pod polem gry
    if (Math.abs(x) <= HX + 0.01 && Math.abs(z) <= HZ + 0.01) {                     // krawędź pola: jak teren pola gry
      const cx = Math.max(-HX + 0.25, Math.min(HX - 0.25, x)), cz = Math.max(-HZ + 0.25, Math.min(HZ - 0.25, z));
      return wetCell(cx, cz) ? -0.3 : LAND;
    }
    if (outerWet(x, z)) return -0.6 - 0.4 * vnoise(x * 0.1, z * 0.1);
    const d = Math.max(0, Math.hypot(x, z) - 70);                                 // Floryda: płasko, tylko łagodne fałdy
    return LAND + 0.35 * vnoise(x * 0.12, z * 0.12) + d * 0.012;
  };
  const col = (x, z, y) => {
    if (y < 0.2) return '#3d4a2a';
    if (y < LAND + 0.08 && outerWetNear(x, z)) return '#6a5534';
    const n = vnoise(x * 0.12, z * 0.12), n2 = vnoise(x * 0.9, z * 0.9);
    if (y > 3) return n2 < 0.5 ? '#7fae46' : '#8cb84c';
    if (n > 0.7) return n2 < 0.5 ? '#8fbf4a' : '#9cc452';
    return GRASS[Math.floor((n * 0.5 + n2 * 0.5) * GRASS.length) % GRASS.length];
  };
  const m = new THREE.Mesh(terrainMesh(-112, -122, 112, 122, S, h, col), materials().TERRAIN);
  m.receiveShadow = true; m.userData.deco = true;
  return m;
}
const outerWetNear = (x, z) => outerWet(x + 2.5, z) || outerWet(x - 2.5, z) || outerWet(x, z + 2.5) || outerWet(x, z - 2.5);

// ======================================================================================================
//                                     przystań: umocnienia, taras, pomosty
// ======================================================================================================
const WOOD = ['#a87a4c', '#b5885a', '#9a6c40', '#c09060', '#a07448'];
const OLD = ['#86704f', '#7a6448', '#8d7756', '#6e5a40'];
// umocnienie brzegu z pionowych bali/desek z czapą i palami; (ax,az)->(bx,bz) wzdłuż krawędzi, n = strona wody (+1/−1 wzdłuż normalnej)
function bulkhead(H, D, ax, az, bx, bz, nx, nz, rand) {
  const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, yaw = Math.atan2(ux, uz);
  const n = Math.max(1, Math.round(L / 0.24));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, x = ax + (bx - ax) * t + nx * 0.05, z = az + (bz - az) * t + nz * 0.05, top = LAND + 0.02 - rand() * 0.05;
    H.box(0.08, top + 0.4, L / n - 0.015, pick(rand, OLD), M4(x, (top - 0.4) / 2, z, 0, yaw));
  }
  H.box(0.22, 0.07, L + 0.1, '#6a563c', M4((ax + bx) / 2 + nx * 0.07, LAND + 0.035, (az + bz) / 2 + nz * 0.07, 0, yaw));     // czapa
  D.box(0.03, 0.09, L, '#4f6a2a', M4((ax + bx) / 2 + nx * 0.1, WL + 0.03, (az + bz) / 2 + nz * 0.1, 0, yaw));            // pas glonów na linii wody
  for (let s = 0.9; s < L; s += 1.8) H.add(new THREE.CylinderGeometry(0.11, 0.13, LAND + 0.62, 6), '#5a4632', M4(ax + ux * s + nx * 0.17, (LAND + 0.22 - 0.4) / 2, az + uz * s + nz * 0.17));
}
// pomost z deskami w poprzek, ramą i ciemną zabudową pod spodem (pod pomost nie da się wejść)
function walkway(H, D, x0, z0, x1, z1, top, rand, alongX) {
  const len = alongX ? x1 - x0 : z1 - z0, wid = alongX ? z1 - z0 : x1 - x0, n = Math.round(len / 0.3), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  for (let i = 0; i < n; i++) {
    const t = x0 + (i + 0.5) * (len / n), s = z0 + (i + 0.5) * (len / n);
    const w = wid + (rand() - 0.5) * 0.06, c = pick(rand, WOOD), y = top - 0.035 - rand() * 0.012;
    if (alongX) H.box(len / n - 0.03, 0.07, w, c, M4(t, y, cz + (rand() - 0.5) * 0.03)); else H.box(w, 0.07, len / n - 0.03, c, M4(cx + (rand() - 0.5) * 0.03, y, s));
  }
  // rama (czołownice) i zabudowa
  const fy = top - 0.19, sk = (top - 0.27 + WL - 0.1) / 2, skh = top - 0.27 - WL + 0.1;
  if (alongX) for (const z of [z0, z1]) { H.box(len, 0.24, 0.06, '#7a5636', M4(cx, fy, z)); if (skh > 0.05) H.box(len, skh, 0.05, '#2b3326', M4(cx, sk, z + (z === z0 ? 0.04 : -0.04))); }
  else for (const x of [x0, x1]) { H.box(0.06, 0.24, len, '#7a5636', M4(x, fy, cz)); if (skh > 0.05) H.box(0.05, skh, len, '#2b3326', M4(x + (x === x0 ? 0.04 : -0.04), sk, cz)); }
}
function deck(H, D, rand) {
  const [x0, z0, x1, z1] = DECK_RECT;
  walkway(H, D, x0, z0, x1, z1, DECK, rand, true);
  // ciemna kratka (lattice) pod tarasem i pale w rogach i co ~2,3 m
  for (const z of [z0, z1]) for (let x = x0 + 0.15; x < x1; x += 0.28) H.box(0.07, DECK - 0.35 - WL + 0.1, 0.03, '#5a4a32', M4(x, (DECK - 0.35 + WL - 0.1) / 2, z + (z === z0 ? -0.02 : 0.02)));
  for (const x of [x0, x1]) for (let z = z0 + 0.15; z < z1; z += 0.28) H.box(0.03, DECK - 0.35 - WL + 0.1, 0.07, '#5a4a32', M4(x + (x === x0 ? -0.02 : 0.02), (DECK - 0.35 + WL - 0.1) / 2, z));
  for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [-2.4, z0], [2.4, z0], [-2.4, z1], [2.4, z1], [x0, 0], [x1, 0]])
    H.add(new THREE.CylinderGeometry(0.16, 0.18, DECK + 0.3, 7), '#6a5238', M4(px, (DECK - 0.3) / 2, pz));
}

// ======================================================================================================
//                                     sklepik z przynętą (bait & tackle)
// ======================================================================================================
const SIDING = ['#f2ead8', '#e9dfc8', '#f6f0e2', '#ece3cf'];
const TRIM = '#2f5a44';
function signTexture(lines, W, Hh, bg, draw) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh; const x = cv.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, W, Hh);
  draw(x, W, Hh, lines);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function signMesh(w, h, tex, deco = true) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
  m.userData.deco = deco; m.castShadow = false; m.receiveShadow = true;
  return m;
}
// stary malowany szyld: kremowe deski, czerwone litery z cieniem, mniejszy napis pod spodem
function bigSign(title, sub, col = '#d8352a') {
  return signTexture([title, sub], 1024, 220, '#efe3c4', (x, W, Hh) => {
    for (let i = 0; i < 5; i++) { x.fillStyle = i % 2 ? 'rgba(120,90,50,.08)' : 'rgba(255,255,255,.08)'; x.fillRect(0, i * Hh / 5, W, Hh / 5); }
    x.strokeStyle = '#2f5a44'; x.lineWidth = 14; x.strokeRect(7, 7, W - 14, Hh - 14);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = 'italic 900 112px Georgia, "Times New Roman", serif'; x.fillStyle = '#2b2118'; x.fillText(title, W / 2 + 5, 92 + 5); x.fillStyle = col; x.fillText(title, W / 2, 92);
    x.font = '700 40px "Arial Black", Arial, sans-serif'; x.fillStyle = '#2f5a44'; x.fillText(sub, W / 2, 178);
  });
}
function shack(H, D, G, root, rand) {
  const { x0, x1, z0, wall } = SHACK;
  // ściany: deski poziome ułożone w bryłach kolizji (otwory na drzwi i okna wychodzą same)
  for (const [a, b, c, d, e, f] of SHACK_WALLS) {
    const n = Math.max(1, Math.round((e - b) / 0.22)), hh = (e - b) / n;
    const thinZ = f - c < d - a;
    for (let i = 0; i < n; i++) {
      const y = b + (i + 0.5) * hh, lip = i % 2 ? 0.024 : 0;                         // co druga deska wystaje – cień zakładki
      H.box(thinZ ? d - a : d - a + lip, hh - 0.012, thinZ ? f - c + lip : f - c, pick(rand, SIDING), M4((a + d) / 2, y, (c + f) / 2));
    }
  }
  // listwy narożne, ramy okien i drzwi (ciemnozielone), parapety
  for (const sx of [x0, x1]) for (const sz of [z0, -z0]) D.box(0.16, wall - DECK, 0.16, TRIM, M4(sx, (wall + DECK) / 2, sz));
  const frame = (cx, cz, w, y0, y1, alongX) => {
    const t = 0.09, depth = 0.26;
    const B = (bw, bh, by, off) => (alongX ? D.box(bw, bh, depth, TRIM, M4(cx + off, by, cz)) : D.box(depth, bh, bw, TRIM, M4(cx, by, cz + off)));
    B(w + 2 * t, t, y1 + t / 2, 0); B(t, y1 - y0, (y0 + y1) / 2, -w / 2 - t / 2); B(t, y1 - y0, (y0 + y1) / 2, w / 2 + t / 2);
    if (y0 > DECK + 0.05) (alongX ? D.box(w + 0.3, 0.06, depth + 0.14, '#f6f0e2', M4(cx, y0 - 0.03, cz)) : D.box(depth + 0.14, 0.06, w + 0.3, '#f6f0e2', M4(cx, y0 - 0.03, cz)));
  };
  for (const s of [1, -1]) {
    const zc = s * (z0 + 0.1);
    for (const xc of [-2.5, 2.5]) frame(xc, zc, 1.6, DECK + 1, DECK + 2, true);
    frame(0, zc, 1.2, DECK, DECK + 2.15, true);
    frame(s * (x1 - 0.1), 0, 1.6, DECK + 1, DECK + 2, false);
  }
  // okiennice otwarte przy oknach (na ścianie, poza otworem), skrzynki z kwiatami pod oknami od strony ganków
  const SH = ['#2a9d8f', '#d8572a'];
  for (const s of [1, -1]) for (const xc of [-2.5, 2.5]) for (const k of [-1, 1]) D.box(0.55, 1.05, 0.05, SH[s > 0 ? 0 : 1], M4(xc + k * 1.15, DECK + 1.5, s * (z0 - 0.04)));
  for (const s of [1, -1]) for (const xc of [-2.5, 2.5]) {
    D.box(1.4, 0.22, 0.24, '#7a5636', M4(xc, DECK + 0.84, s * (z0 - 0.14)));
    for (let k = 0; k < 6; k++) D.add(jitter(new THREE.IcosahedronGeometry(0.14, 0), 0.06, rand), pick(rand, ['#ff5a8a', '#ffd23a', '#ff8c3a', '#e84a5f', '#5fae36']), M4(xc - 0.55 + k * 0.22, DECK + 1.0, s * (z0 - 0.14)));
  }
  // podłoga w środku to deski tarasu; sufit, lada, regały, kasa, akwarium z przynętą, wentylator, żarówka
  D.box(x1 - x0 - 0.4, 0.04, -2 * z0 - 0.4, '#5a4030', M4(0, 3.63, 0));
  H.box(2.4, 0.9, 0.7, '#6a4a2e', M4(0, DECK + 0.45, 0)); H.box(2.5, 0.08, 0.8, '#c8a070', M4(0, DECK + 0.96, 0));
  D.box(0.4, 0.28, 0.32, '#3a3a3a', M4(-0.6, DECK + 1.14, 0));
  D.box(0.66, 0.36, 0.36, '#2b2b2b', M4(0.5, DECK + 1.18, 0)); D.box(0.6, 0.28, 0.37, '#2f8aa0', M4(0.5, DECK + 1.2, 0), 'glow');          // akwarium z przynętą
  for (const s of [1, -1]) {
    const sx = s * 3.4, sz = s * -1.45;
    H.box(0.8, 2.0, 1.0, '#7a5636', M4(sx, DECK + 1.0, sz));
    for (let k = 0; k < 4; k++) for (let j = 0; j < 4; j++) D.box(0.16, 0.22, 0.2, pick(rand, ['#ff5a3c', '#ffd23a', '#2ec4b6', '#3a86ff', '#ff4f9e', '#f6f1e6']), M4(sx - s * 0.42, DECK + 0.3 + k * 0.48, sz - 0.36 + j * 0.24));
  }
  D.box(0.06, 0.6, 0.06, '#333', M4(0, 3.3, 0)); for (let k = 0; k < 4; k++) D.box(1.3, 0.02, 0.18, '#7a5636', M4(0, 3.0, 0, 0, k * PI / 4));
  G.box(0.14, 0.18, 0.14, '#ffe2a0', M4(-2.2, 3.3, 0), 'glow'); G.box(0.14, 0.18, 0.14, '#ffe2a0', M4(2.2, 3.3, 0), 'glow');
  // dach dwuspadowy z rdzawej blachy falistej (okap 3,65 m nad gankami, kalenica 5,35 m)
  const eave = 3.65, ridge = wall + 1.3, half = 3.8, ang = Math.atan2(ridge - eave, half), slope = Math.hypot(ridge - eave, half) + 0.08, RUST = ['#9a4a26', '#b0582c', '#8a4224', '#a65530'];
  for (const s of [-1, 1]) for (let k = 0; k < 9; k++) {
    const xx = -4.6 + (k + 0.5) * (9.2 / 9);
    H.box(9.2 / 9 + 0.01, 0.07, slope, RUST[(k + (s > 0 ? 1 : 0)) % RUST.length], M4(xx, (eave + ridge) / 2 + 0.04, s * half / 2, s * ang));
    if (rand() < 0.45) { const f = 0.3 + rand() * 0.4; D.box(9.2 / 9 * 0.6, 0.075, slope * (0.2 + rand() * 0.3), '#6a3218', M4(xx, ridge - (ridge - eave) * f + 0.08, s * half * f, s * ang)); }   // zacieki rdzy
  }
  H.box(9.3, 0.12, 0.3, '#6a3a22', M4(0, ridge + 0.06, 0));
  for (const sx of [-3.99, 3.99]) {                                                  // szczyty (trójkąty z sidingu) i deski czołowe
    H.tris([V3(sx, eave, -half), V3(sx, eave, half), V3(sx, ridge, 0)], '#e9dfc8');
    D.box(0.12, 0.1, slope, TRIM, M4(sx * 1.15, (eave + ridge) / 2 - 0.02, -half / 2, -ang)); D.box(0.12, 0.1, slope, TRIM, M4(sx * 1.15, (eave + ridge) / 2 - 0.02, half / 2, ang));
    D.box(0.08, 0.35, 0.7, '#3a3a3a', M4(sx * 1.003, eave + 0.7, 0));               // kratka wentylacyjna
  }
  for (const s of [-1, 1]) D.box(9.2, 0.16, 0.08, TRIM, M4(0, eave - 0.06, s * (half + 0.02)));
  // słupki ganków i lampki na sznurku pod okapem
  for (const [px, pz] of POSTS) for (const s of [1, -1]) H.box(0.17, eave - DECK, 0.17, '#f2ead8', M4(s * px, (eave + DECK) / 2, s * pz));
  const LIGHT = ['#ffd27a', '#ff8a5a', '#7fe8ff', '#ff6fb0', '#c8ff7a'];
  for (const s of [1, -1]) for (let i = 0; i <= 26; i++) {
    const x = -4.4 + i * (8.8 / 26), sag = 0.16 * Math.sin(((x + 4.4) % 2.8) / 2.8 * PI);
    G.add(new THREE.IcosahedronGeometry(0.055, 0), LIGHT[i % LIGHT.length], M4(x, eave - 0.14 - sag, s * (half - 0.15)), 'glow');
  }
  // szyldy na dachu (od strony A i B), neon OPEN przy drzwiach, koło ratunkowe, antena satelitarna
  const t1 = bigSign('Bayou Bean', 'BAIT  •  TACKLE  •  COLD BEER'), t2 = bigSign('Live Bait', 'BOAT RENTALS  •  ICE  •  FUEL', '#1f8a8a');
  for (const [s, tx] of [[-1, t1], [1, t2]]) {
    const m = signMesh(5.4, 1.16, tx); m.position.set(0, 4.72, s * 2.55); m.rotation.y = s < 0 ? PI : 0; root.add(m);
    D.box(5.6, 0.1, 0.1, '#5a4030', M4(0, 4.1, s * 2.5)); for (const x of [-2.3, 0, 2.3]) D.box(0.1, 1.1, 0.1, '#5a4030', M4(x, 4.6, s * 2.47));
  }
  for (const s of [1, -1]) { const op = neonSign('OPEN', '#ff3f8a', { h: 0.42, font: '900 92px "Arial Black", Arial, sans-serif' }); op.position.set(0, DECK + 2.42, s * (z0 - 0.05)); op.rotation.y = s > 0 ? PI : 0; op.userData.deco = true; root.add(op); }
  D.add(new THREE.TorusGeometry(0.3, 0.08, 6, 14), '#f6f1e6', M4(-3.63, DECK + 1.5, -z0 + 0.06));
  for (let k = 0; k < 4; k++) D.add(new THREE.TorusGeometry(0.3, 0.085, 6, 3, PI / 6), '#e8402a', M4(-3.63, DECK + 1.5, -z0 + 0.06, 0, 0, k * PI / 2));
  D.add(new THREE.CylinderGeometry(0.42, 0.18, 0.12, 10), '#e8e8e8', M4(2.6, ridge - 0.2, 0.9, 0.6, 0.4)); D.box(0.06, 0.5, 0.06, '#888', M4(2.6, ridge - 0.45, 0.9));
  D.add(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 6), '#555', M4(-2.8, ridge - 0.1, -0.6));
}

// ======================================================================================================
//                                      obiekty z układu (OBJECTS)
// ======================================================================================================
const GLASS = '#1b2a3a';
const PLANE_LOOK = {
  yellow: { body: '#ffd23a', stripe: '#d8352a', stripe2: '#2b2118', float: '#f4f1ea', trim: '#d8352a', cowl: '#2b2b2b' },
  white: { body: '#f5f3ee', stripe: '#18a7a0', stripe2: '#ff7a3a', float: '#f4f1ea', trim: '#18a7a0', cowl: '#e8e6e0' },
};
function seaplane(HG, D, P, look) {
  const L = PLANE_LOOK[look] || PLANE_LOOK.white;
  for (const sx of [-1.2, 1.2]) {                                                   // pływaki
    HG.box(0.56, 0.44, 5.2, L.float, P(sx, 0.5, 0.5)); HG.box(0.5, 0.3, 0.95, L.float, P(sx, 0.64, 3.32, -0.38));
    HG.box(0.48, 0.3, 0.7, L.float, P(sx, 0.47, -2.0, 0.18)); HG.box(0.58, 0.07, 5.22, L.trim, P(sx, 0.69, 0.5));
  }
  for (const z of [2.2, -0.9]) HG.box(2.4, 0.07, 0.08, '#a8adb2', P(0, 0.72, z));
  for (const sx of [-1, 1]) for (const z of [2.3, -0.7]) rod(HG, P.pt(sx * 1.2, 0.72, z), P.pt(sx * 0.48, 1.22, z), 0.045, 0.045, '#a8adb2');
  HG.box(1.2, 1.36, 4.2, L.body, P(0, 1.86, 1.6)); HG.box(1.06, 0.22, 4.1, L.body, P(0, 2.62, 1.55));   // kadłub i zaokrąglony dach
  HG.box(1.0, 1.1, 1.3, L.body, P(0, 1.95, -1.1, 0.1)); HG.box(0.55, 0.72, 2.8, L.body, P(0, 2.06, -3.0, 0.05));
  HG.box(1.22, 0.15, 5.6, L.stripe, P(0, 1.6, 0.9)); HG.box(1.22, 0.06, 5.6, L.stripe2, P(0, 1.73, 0.9));
  for (const sx of [-1, 1]) for (const [z, w] of [[2.75, 0.8], [1.8, 0.8], [0.85, 0.6]]) HG.box(0.04, 0.4, w, GLASS, P(sx * 0.605, 2.27, z));
  HG.box(0.98, 0.48, 0.06, GLASS, P(0, 2.47, 3.66, -0.55));
  HG.box(0.9, 0.95, 0.6, L.cowl, P(0, 1.96, 4.2)); HG.add(new THREE.ConeGeometry(0.17, 0.36, 8), L.stripe, P(0, 1.96, 4.66, PI / 2));
  D.box(0.12, 1.9, 0.04, '#2a2a2a', P(0, 1.96, 4.56, 0, 0, 0.5)); D.box(0.13, 0.22, 0.05, '#ffd23a', P(0.84 * Math.sin(0.5), 1.96 - 0.84 * Math.cos(0.5), 4.56, 0, 0, 0.5));
  D.box(0.13, 0.22, 0.05, '#ffd23a', P(-0.84 * Math.sin(0.5), 1.96 + 0.84 * Math.cos(0.5), 4.56, 0, 0, 0.5));
  HG.box(8.4, 0.13, 1.55, L.body, P(0, 2.84, 1.9)); for (const sx of [-1, 1]) HG.box(0.6, 0.14, 1.56, L.stripe, P(sx * 3.9, 2.84, 1.9));
  for (const sx of [-1, 1]) rod(HG, P.pt(sx * 0.6, 1.45, 1.9), P.pt(sx * 2.7, 2.78, 1.9), 0.05, 0.05, '#c8ccd0');
  HG.box(0.08, 1.25, 1.1, L.body, P(0, 3.02, -3.86, -0.28)); HG.box(0.09, 0.28, 1.0, L.stripe, P(0, 3.25, -3.9, -0.28));
  HG.box(3.0, 0.07, 0.8, L.body, P(0, 2.36, -3.9)); for (const sx of [-1, 1]) HG.box(0.4, 0.08, 0.81, L.stripe, P(sx * 1.32, 2.36, -3.9));
  for (const sx of [-1, 1]) HG.box(0.03, 0.75, 0.55, L.stripe2, P(sx * 0.605, 1.98, 0.0));                                 // drzwi kabiny
  D.box(0.36, 0.05, 0.3, '#9aa0a6', P(-1.2, 0.95, 0.1)); rod(D, P.pt(-1.2, 0.72, 0.1), P.pt(-0.7, 1.25, 0.1), 0.03, 0.03, '#9aa0a6');
}
const TRAILER_LOOK = {
  mint: { body: '#9fe6cf', band: '#f6f4ec', awn: ['#ff6f91', '#fff4ea'] },
  peach: { body: '#ffb796', band: '#fff4ea', awn: ['#2ec4b6', '#fff4ea'] },
  sun: { body: '#ffe08a', band: '#fff4ea', awn: ['#3a86ff', '#fff4ea'] },
  rose: { body: '#ff9ec4', band: '#fff4ea', awn: ['#ffd23a', '#fff4ea'] },
};
function trailer(HG, D, P, look, rand) {
  const L = TRAILER_LOOK[look] || TRAILER_LOOK.mint;
  HG.box(5.4, 0.16, 2.0, '#3a3a3a', P(0, 0.52, 0));
  for (const sz of [-1, 1]) { HG.add(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10), '#1d1d1f', P(0.2, 0.34, sz * 1.0, PI / 2)); HG.add(new THREE.CylinderGeometry(0.16, 0.16, 0.26, 8), '#d8dde2', P(0.2, 0.34, sz * 1.0, PI / 2)); }
  HG.box(5.0, 2.0, 2.4, L.body, P(0, 1.65, 0));
  for (const s of [1, -1]) HG.add(new THREE.SphereGeometry(1, 12, 8, PI / 2, PI), L.body, P(s * 2.5, 1.65, 0, 0, s > 0 ? 0 : PI, 0, 0.8, 1.0, 1.2));
  HG.box(5.02, 0.24, 2.42, L.band, P(0, 1.3, 0)); HG.box(5.02, 0.06, 2.42, '#c8ccd0', P(0, 1.48, 0));
  for (const sz of [-1, 1]) for (const x of [-1.6, -0.2]) HG.box(0.9, 0.55, 0.04, GLASS, P(x, 2.0, sz * 1.21));
  HG.box(0.04, 0.32, 1.1, GLASS, P(-3.12, 2.05, 0, 0, 0, -0.5)); HG.box(0.75, 1.7, 0.05, '#e8e6e0', P(1.4, 1.5, 1.22)); HG.box(0.4, 0.4, 0.06, GLASS, P(1.4, 1.95, 1.24));
  HG.box(0.6, 0.12, 0.4, '#9aa0a6', P(-3.05, 0.55, 0)); for (const sz of [-1, 1]) HG.add(new THREE.CylinderGeometry(0.17, 0.17, 0.5, 10), '#f4f1ea', P(-2.95, 0.95, sz * 0.25));
  HG.box(0.7, 0.3, 0.5, '#e8e6e0', P(0.8, 2.85, 0));                                  // klimatyzator na dachu
  // markiza w paski (od strony +Z), na wspornikach – bez słupków, nie zawadza
  const n = 12, sl = 0.22;
  for (let i = 0; i < n; i++) D.box(4.4 / n + 0.005, 0.04, 1.75, L.awn[i % 2], P(-1.6 + 0.2 + (i + 0.5) * (4.4 / n), 2.38, 1.25 + 0.86, sl));
  for (let i = 0; i < n * 2; i++) D.tris([P.pt(-1.4 + i * (4.4 / (2 * n)), 2.18, 3.0), P.pt(-1.4 + (i + 1) * (4.4 / (2 * n)), 2.18, 3.0), P.pt(-1.4 + (i + 0.5) * (4.4 / (2 * n)), 2.04, 3.0)], L.awn[i % 2]);
  for (const x of [-1.3, 2.5]) rod(D, P.pt(x, 1.6, 1.24), P.pt(x, 2.2, 2.95), 0.03, 0.03, '#c8ccd0');
  D.box(0.7, 0.18, 0.45, '#8a8f94', P(1.4, 0.36, 1.5)); D.box(0.7, 0.18, 0.3, '#8a8f94', P(1.4, 0.18, 1.75));
  void rand;
}
// dąb wirginijski: krzywy pień, rozłożyste konary wysoko, wystające korzenie przy ziemi, hiszpański mech
function oak(H, D, R, P, rand, big = 1, far = false) {                             // far: lżejsza wersja dla drzew poza polem gry
  const T = ['#5b4634', '#4e3c2c', '#655040'], pts = [], seg = far ? 3 : 6, rs = far ? 6 : 8;
  for (let i = 0; i <= seg; i++) { const t = i / seg; pts.push(P.pt(Math.sin(t * 2.4) * 0.09 * big, t * 4.4 * big, Math.cos(t * 1.7) * 0.07 * big)); }
  for (let i = 0; i < seg; i++) rod(H, pts[i], pts[i + 1], 0.62 * big * (1 - i * (0.36 / seg)), 0.62 * big * (1 - (i + 1) * (0.36 / seg)), T[i % 3], rs);
  if (!far) H.add(new THREE.CylinderGeometry(0.62 * big, 0.68 * big, 0.5, 8), T[0], P(0, 0.2, 0));
  const ends = [];
  for (let k = 0, nb = far ? 4 : 6; k < nb; k++) {
    const a = (k / nb) * PI * 2 + rand() * 0.6, y0 = (2.8 + rand() * 1.4) * big, r = (3.2 + rand() * 2.3) * big, y1 = y0 + (1.4 + rand() * 1.4) * big;
    const a0 = P.pt(Math.cos(a) * 0.3, y0, Math.sin(a) * 0.3), mid = P.pt(Math.cos(a) * r * 0.55, y0 + (y1 - y0) * 0.8, Math.sin(a) * r * 0.55), e = P.pt(Math.cos(a) * r, y1, Math.sin(a) * r);
    arc(D, a0, mid, e, 0.3 * big, 0.12 * big, T[k % 3], far ? 2 : 4, far ? 5 : 6); ends.push(e);
  }
  const G = ['#4f9a2c', '#5daa34', '#3f8526', '#6bb63c', '#468f2a'];
  for (const e of [...ends, P.pt(0, 6.2 * big, 0)]) for (let b = 0, nb = far ? 2 : 3; b < nb; b++) {
    const s = (1.6 + rand() * 1.2) * big * (far ? 1.15 : 1), x = e.x + (rand() - 0.5) * 2.4 * big, z = e.z + (rand() - 0.5) * 2.4 * big, y = Math.max(e.y + 0.6 + rand() * 1.0, 5.4 * big);
    D.add(jitter(new THREE.IcosahedronGeometry(1, far ? 0 : 1), 0.28, rand), pick(rand, G), M4(x, y, z, 0, rand() * 6, 0, s * 1.15, s * 0.62, s * 1.15));
    if (rand() < 0.6) {                                                              // mech zwisający spod korony (cienkie pasma)
      const mx = x + (rand() - 0.5) * s * 1.4, mz = z + (rand() - 0.5) * s * 1.4, top = y - s * 0.4, len = 0.6 + rand() * 0.9, w = 0.07 + rand() * 0.06, a = rand() * PI;
      const dx = Math.cos(a) * w, dz = Math.sin(a) * w;
      if (top - len > 3.8) R.tris([V3(mx - dx, top, mz - dz), V3(mx + dx, top, mz + dz), V3(mx + (rand() - 0.5) * 0.15, top - len, mz)], rand() < 0.5 ? '#a3b08a' : '#95a47c');
    }
  }
}
// korzenie (łuki) wychodzące z pnia i wbijające się w ziemię – grafika w bryłach kolizji korzeni dębu
function oakRoots(H, P, rand) {
  const T = '#5b4634';
  arc(H, P.pt(-0.5, 0.25, -0.2), P.pt(-1.3, 1.25, -0.2), P.pt(-2.0, -0.05, -0.15), 0.24, 0.12, T, 7, 7);
  arc(H, P.pt(-0.55, 0.15, 0.25), P.pt(-1.2, 0.85, 0.05), P.pt(-1.9, -0.05, -0.75), 0.18, 0.1, '#4e3c2c', 6, 6);
  arc(H, P.pt(0.5, 0.2, 0.55), P.pt(1.15, 1.0, 1.0), P.pt(1.8, -0.05, 1.5), 0.22, 0.11, T, 7, 7);
  arc(H, P.pt(0.05, 0.2, 0.6), P.pt(0.0, 0.85, 1.45), P.pt(0.05, -0.05, 2.2), 0.2, 0.1, '#4e3c2c', 7, 7);
  for (let k = 0; k < 5; k++) {                                                     // płytkie korzenie przy ziemi (dookoła)
    const a = 2.6 + k * 0.75 + rand() * 0.3, r = 1.3 + rand() * 0.8;
    arc(H, P.pt(Math.cos(a) * 0.55, 0.12, Math.sin(a) * 0.55), P.pt(Math.cos(a) * r * 0.5, 0.28, Math.sin(a) * r * 0.5), P.pt(Math.cos(a) * r, -0.04, Math.sin(a) * r), 0.13, 0.06, T, 4, 5);
  }
}
function cypress(H, D, R, P, rand, scale = 1) {
  const T = '#6a5a48';
  H.add(new THREE.CylinderGeometry(0.34 * scale, 0.6 * scale, 1.3 * scale, 8), T, P(0, 0.65 * scale, 0));
  H.add(new THREE.CylinderGeometry(0.2 * scale, 0.34 * scale, 6.2 * scale, 7), '#5e5040', P(0, 4.4 * scale, 0));
  for (let k = 0; k < 6; k++) { const a = rand() * PI * 2, d = 0.9 + rand() * 1.0; R.add(new THREE.ConeGeometry(0.1 + rand() * 0.06, 0.25 + rand() * 0.15, 5), T, P(Math.cos(a) * d, 0.08, Math.sin(a) * d)); }
  const G = ['#4f8a2a', '#5f9a32', '#3f7a24', '#6aa83a'];
  for (let b = 0; b < 4; b++) {
    const y = (6.0 + b * 1.05) * scale, s = (2.6 - b * 0.4) * scale, x = (rand() - 0.5) * 1.4, z = (rand() - 0.5) * 1.4, p = P.pt(x, y, z);
    D.add(jitter(new THREE.IcosahedronGeometry(1, 0), 0.3, rand), pick(rand, G), M4(p.x, p.y, p.z, 0, rand() * 6, 0, s, 0.55 * scale, s));
    if (b < 3) rod(D, P.pt(0, y - 0.6, 0), p, 0.12 * scale, 0.06 * scale, '#5e5040', 5);
    for (let m = 0; m < 4; m++) { const mx = p.x + (rand() - 0.5) * s * 1.4, mz = p.z + (rand() - 0.5) * s * 1.4, len = 0.8 + rand() * 1.4, w = 0.16 + rand() * 0.1; R.tris([V3(mx - w, p.y - 0.35, mz), V3(mx + w, p.y - 0.35, mz), V3(mx, p.y - 0.35 - len, mz)], rand() < 0.5 ? '#b5bca0' : '#a3ad8c'); }
  }
}
function barrel(HG, D, x, y, z, col, rand, rust = false) {
  HG.add(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 12), col, M4(x, y + 0.45, z, 0, rand() * 6));
  for (const h of [0.2, 0.7]) HG.add(new THREE.CylinderGeometry(0.312, 0.312, 0.045, 12), '#2b2b2b', M4(x, y + h, z));
  HG.add(new THREE.CylinderGeometry(0.29, 0.29, 0.03, 12), '#3a3a3a', M4(x, y + 0.905, z));
  if (rust) for (let k = 0; k < 3; k++) { const a = rand() * PI * 2; D.box(0.2, 0.18 + rand() * 0.2, 0.02, '#7a3a1a', M4(x + Math.cos(a) * 0.3, y + 0.25 + rand() * 0.4, z + Math.sin(a) * 0.3, 0, -a + PI / 2)); }
}
const BARREL_COL = ['#2f6fbf', '#d8402f', '#f0b429', '#3f8a4a', '#8a4a2a'];
function buildObject(o, K, root, rand) {
  const { H, HG, D, R, G } = K, y = baseY(o), OM = objMatrix(o.x, y, o.z, o.rot || 0), P = local(OM);
  switch (o.t) {
    case 'plane': seaplane(HG, D, P, o.look); break;
    case 'trailer': {
      trailer(HG, D, P, o.look, rand);
      // podwórko za przyczepą (przy granicy): flamingi, leżaki, grill, sznur z praniem
      for (const [fx, fz] of [[-2.2, -2.2], [-1.4, -2.6], [2.8, -2.4]]) {
        const p = P.pt(fx, 0, fz);
        R.box(0.04, 0.55, 0.04, '#2a2a2a', M4(p.x, LAND + 0.27, p.z));
        R.add(jitter(new THREE.IcosahedronGeometry(0.17, 0), 0.03, rand), '#ff5fa2', M4(p.x, LAND + 0.68, p.z, 0, rand() * 6, 0, 1.3, 0.8, 0.8));
        R.box(0.05, 0.3, 0.05, '#ff5fa2', M4(p.x + 0.12, LAND + 0.88, p.z, 0, 0, -0.3)); R.box(0.12, 0.06, 0.06, '#ff5fa2', M4(p.x + 0.18, LAND + 1.03, p.z));
      }
      for (const fx of [0.6, 1.6]) { const p = P.pt(fx, 0, -2.2), ry = (o.rot || 0) + 0.3; D.box(0.6, 0.05, 1.0, pick(rand, ['#2ec4b6', '#ffd23a', '#ff6f91']), M4(p.x, LAND + 0.32, p.z, -0.35, ry)); }
      break;
    }
    case 'oak': oak(H, D, R, P, rand); oakRoots(H, P, rand); break;
    case 'cypress': cypress(H, D, R, P, rand); break;
    case 'log': {
      H.add(new THREE.CylinderGeometry(0.36, 0.38, 4.8, 9), '#5a4230', P(0, 0.36, 0, 0, 0, PI / 2));
      for (const s of [-1, 1]) H.add(new THREE.CylinderGeometry(0.33, 0.33, 0.04, 9), '#c8a070', P(s * 2.405, 0.36, 0, 0, 0, PI / 2));
      for (let k = 0; k < 4; k++) D.add(jitter(new THREE.IcosahedronGeometry(0.22, 0), 0.08, rand), '#5f9e2a', P(-1.8 + k * 1.1, 0.62, (rand() - 0.5) * 0.3, 0, 0, 0, 1.4, 0.4, 1));
      for (let k = 0; k < 5; k++) R.add(new THREE.ConeGeometry(0.07, 0.06, 6), '#ff8a3a', P(-1.6 + k * 0.7, 0.42, 0.37, PI / 2));
      rod(H, P.pt(0.7, 0.55, 0.1), P.pt(1.0, 0.68, 0.32), 0.07, 0.05, '#5a4230');
      break;
    }
    case 'roots': {
      const T = ['#5b4634', '#4e3c2c'];
      for (let k = 0; k < 5; k++) { const z = -0.55 + k * 0.27, x0 = -0.95 + (k % 2) * 0.2; arc(H, P.pt(x0, -0.05, z), P.pt(0, 0.95 + (k % 2) * 0.15, z + 0.05), P.pt(-x0, -0.05, z + 0.1), 0.11, 0.08, T[k % 2], 7, 6); }
      H.add(new THREE.CylinderGeometry(0.26, 0.34, 2.0, 7), '#6a5a48', P(0, 1.0, 0.05));
      for (let k = 0; k < 5; k++) { const a = k * 1.3; H.add(new THREE.ConeGeometry(0.1, 0.35 + rand() * 0.3, 4), '#7a6a56', P(Math.cos(a) * 0.15, 2.1, 0.05 + Math.sin(a) * 0.15)); }
      for (let k = 0; k < 3; k++) D.add(jitter(new THREE.IcosahedronGeometry(0.2, 0), 0.06, rand), '#6aa83a', P(-0.5 + k * 0.5, 0.95, -0.3 + k * 0.2, 0, 0, 0, 1.4, 0.4, 1));
      break;
    }
    case 'barrels': {
      const C = [[-0.29, -0.2], [0.35, -0.15], [0, 0.4]];
      C.slice(0, o.n || 3).forEach(([lx, lz], i) => { const p = P.pt(lx, 0, lz); barrel(HG, D, p.x, y, p.z, BARREL_COL[(i + (o.side === 'B' ? 2 : 0)) % BARREL_COL.length], rand, i === 1); });
      break;
    }
    case 'deckBarrels': for (const [lx, lz, c] of [[0, 0, '#2f6fbf'], [0.66, 0.61, '#d8402f']]) { const p = P.pt(lx, 0, lz); barrel(HG, D, p.x, y, p.z, c, rand, true); } break;
    case 'crates': {
      for (const [s, cy] of [[0.9, 0.45], [0.7, 1.25]]) {
        H.box(s, s, s, '#b08850', P(0, cy, 0, 0, cy > 1 ? 0.25 : 0));
        for (const k of [-1, 1]) { H.box(s + 0.02, 0.08, s + 0.02, '#8a6436', P(0, cy + k * s * 0.38, 0, 0, cy > 1 ? 0.25 : 0)); }
      }
      break;
    }
    case 'tires': for (let k = 0; k < 4; k++) HG.add(new THREE.TorusGeometry(0.38, 0.15, 6, 12), '#1f1f22', P(0, 0.15 + k * 0.23, 0, PI / 2, 0, k * 0.4)); break;
    case 'picnic': {
      for (let k = 0; k < 5; k++) H.box(1.6, 0.05, 0.15, pick(rand, WOOD), P(0, 0.755, -0.32 + k * 0.16));
      for (const s of [-1, 1]) { H.box(1.6, 0.05, 0.3, '#9a6c40', P(0, 0.425, s * 0.78)); for (const lx of [-0.65, 0.65]) { H.box(0.07, 0.75, 0.07, '#7a5636', P(lx, 0.37, s * 0.3, s * 0.4)); } }
      D.box(0.35, 0.25, 0.28, '#d8402f', P(0.4, 0.9, 0)); D.box(0.36, 0.06, 0.29, '#f6f1e6', P(0.4, 1.04, 0));
      break;
    }
    case 'fence': {
      const w = o.w, n = Math.round(w / 0.16);
      for (let i = 0; i < n; i++) { const h = 1.5 + (i % 2) * 0.05; H.box(w / n - 0.02, h, 0.05, pick(rand, OLD), P(-w / 2 + (i + 0.5) * (w / n), h / 2, 0.06)); }
      for (const ry of [0.35, 1.15]) H.box(w, 0.09, 0.07, '#5a4632', P(0, ry, -0.06));
      for (const lx of [-w / 2, 0, w / 2]) H.box(0.12, 1.6, 0.12, '#5a4632', P(lx, 0.8, -0.06));
      const tex = signTexture([], 512, 160, '#f2ead8', (x, W, Hh) => {
        x.fillStyle = '#d8352a'; x.font = '900 70px "Arial Black", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('LIVE BAIT', W / 2 - 40, Hh / 2);
        x.beginPath(); x.moveTo(W - 120, Hh / 2 - 34); x.lineTo(W - 40, Hh / 2); x.lineTo(W - 120, Hh / 2 + 34); x.fill();
      });
      const m = signMesh(1.6, 0.5, tex); m.applyMatrix4(P(0.9, 1.05, 0.1)); root.add(m);
      break;
    }
    case 'pole': {
      H.add(new THREE.CylinderGeometry(0.13, 0.17, 8.5, 7), '#6a5238', P(0, 4.25, 0));
      H.box(2.2, 0.14, 0.14, '#5a4632', P(0, 7.9, 0)); for (const lx of [-0.9, 0, 0.9]) D.add(new THREE.CylinderGeometry(0.05, 0.07, 0.18, 6), '#cfe6e0', P(lx, 8.05, 0));
      D.add(new THREE.CylinderGeometry(0.3, 0.3, 0.8, 8), '#8a9096', P(0.32, 6.6, 0)); D.box(0.2, 0.1, 1.4, '#5a5a5a', P(0, 6.0, 0.7)); G.box(0.32, 0.08, 0.2, '#fff1c8', P(0, 5.93, 1.35), 'glow');
      break;
    }
  }
}

// ======================================================================================================
//                                 drobiazgi, granice pola i świat dookoła
// ======================================================================================================
// kępka trawy (nisko – nic nie zasłania)
function tuft(K, x, y, z, rand, h = 0.3, n = 5) {
  const G = ['#6fb83e', '#7fc44a', '#5aa232', '#9cc84a'];
  for (let i = 0; i < n; i++) {
    const a = rand() * PI * 2, r = rand() * 0.12, bx = x + Math.cos(a) * r, bz = z + Math.sin(a) * r, la = rand() * PI * 2, hh = h * (0.5 + rand() * 0.5);
    const s = V3(-Math.sin(la), 0, Math.cos(la)).multiplyScalar(0.04);
    K.tris([V3(bx - s.x, y, bz - s.z), V3(bx + s.x, y, bz + s.z), V3(bx + Math.cos(la) * 0.08, y + hh, bz + Math.sin(la) * 0.08)], pick(rand, G));
  }
}
// kabel między słupami (zwisa łukiem)
const wire = (K, a, b, sag = 0.6) => arc(K, a, V3((a.x + b.x) / 2, (a.y + b.y) / 2 - sag * 2, (a.z + b.z) / 2), b, 0.018, 0.018, '#1d1d1d', 8, 3);
// czy punkt koliduje z czymś na mapie (żeby drobiazgi nie stały w obiektach)
let BLOCK = null;
const blocked = (x, z, m = 0.3) => BLOCK.some((b) => b[4] > LAND + 0.02 && b[1] < 2 && x > b[0] - m && x < b[3] + m && z > b[2] - m && z < b[5] + m);

function decorate(K, root, rand) {
  const { H, D, R, G } = K;
  // trawa i kwiatki na lądzie pola gry (poza ścieżkami i obiektami)
  for (let i = 0; i < 1600; i++) {
    const x = (rand() * 2 - 1) * (HX - 0.4), z = (rand() * 2 - 1) * (HZ - 0.4), c = Math.max(-HX + 0.25, Math.min(HX - 0.25, x));
    if (wetCell(c, z) || distWater(x, z) < 0.4 || distPath(x, z) < 1.0 || blocked(x, z, 0.2)) continue;
    if (rand() < 0.88) tuft(R, x, LAND, z, rand, 0.22 + rand() * 0.16);
    else { const fc = pick(rand, ['#ffffff', '#ffd23a', '#ff6fb0', '#c58bff']); R.box(0.02, 0.22, 0.02, '#4e8a22', M4(x, LAND + 0.11, z)); R.add(new THREE.IcosahedronGeometry(0.05, 0), fc, M4(x, LAND + 0.24, z)); }
  }
  // kałuże na ścieżkach
  for (let i = 0; i < 18; i++) {
    const p = pick(rand, PATHS), k = Math.floor(rand() * (p.length - 1)), t = rand(), x = p[k][0] + (p[k + 1][0] - p[k][0]) * t, z = p[k][1] + (p[k + 1][1] - p[k][1]) * t;
    if (Math.abs(z) < 5.6) continue;
    const g = new THREE.CircleGeometry(0.35 + rand() * 0.45, 10), gp = g.attributes.position, ph = rand() * 6;    // brzeg lekko falisty, środek płaski
    for (let k = 1; k < gp.count; k++) { const j = ((k - 1) % 10) * (PI * 2 / 10), f = 1 + 0.12 * Math.sin(j * 2 + ph) + 0.07 * Math.sin(j * 3 + ph * 2); gp.setXY(k, gp.getX(k) * f, gp.getY(k) * f); }
    D.add(g, '#7a6444', M4(x, LAND + 0.012, z, -PI / 2, 0, rand() * 6, 1, 0.6 + rand() * 0.4, 1));                 // mokra, ciemniejsza ziemia
  }
  // niskie trzciny przy umocnieniach (w wodzie, do 0,8 m – nie da się w nich schować) i lilie wodne
  const shoreNear = (x, z, d) => [[d, 0], [-d, 0], [0, d], [0, -d]].some(([dx, dz]) => Math.abs(x + dx) < HX && !wetCell(x + dx, z + dz));
  for (let i = 0; i < 900; i++) {
    const x = (rand() * 2 - 1) * (HX - 0.3), z = (rand() * 2 - 1) * (HZ - 0.3);
    if (!wetCell(x, z) || blocked(x, z, 0.5)) continue;
    if (shoreNear(x, z, 0.7)) { if (rand() < 0.5) addRushes(R, x, WL - 0.05, z, rand, 7, 0.75, 0.5, rand() < 0.3); }
    else if (!shoreNear(x, z, 1.3) && rand() < 0.22) addLily(R, x, WL + 0.02, z, rand, ['#4f9a2a', '#5fae32', '#3f8a26'], ['#ff7ab6', '#fff4f0', '#ffd23a'], 0.35);
  }
  // granice pola: płot z desek na lądzie, na wodzie pale z liną i pomarańczowymi bojami
  const fenceSeg = (ax, az, bx, bz) => {
    const L = Math.hypot(bx - ax, bz - az), n = Math.round(L / 0.2), yaw = Math.atan2(bx - ax, bz - az);
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, h = 2.0 + (i % 3 === 0 ? 0.08 : 0); D.box(0.06, h, L / n - 0.025, pick(rand, OLD), M4(ax + (bx - ax) * t, LAND + h / 2, az + (bz - az) * t, 0, yaw)); }
    for (let s = 0; s <= L; s += 2.4) D.box(0.14, 2.2, 0.14, '#5a4632', M4(ax + (bx - ax) * (s / L), LAND + 1.1, az + (bz - az) * (s / L)));
  };
  const ropeSeg = (ax, az, bx, bz) => {
    const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 2.5));
    for (let i = 0; i <= n; i++) { const x = ax + (bx - ax) * (i / n), z = az + (bz - az) * (i / n); D.add(new THREE.CylinderGeometry(0.12, 0.14, 1.9, 7), '#6a5238', M4(x, 0.55, z)); if (i < n) { const x2 = ax + (bx - ax) * ((i + 1) / n), z2 = az + (bz - az) * ((i + 1) / n); wire(R, V3(x, 1.3, z), V3(x2, 1.3, z2), 0.12); D.add(new THREE.SphereGeometry(0.2, 8, 6), '#ff7a2a', M4((x + x2) / 2, WL + 0.08, (z + z2) / 2)); } }
  };
  const B = 0.12;
  for (const s of [1, -1]) {
    fenceSeg(-HX, s * (HZ + B), HX, s * (HZ + B));
    // boki: ląd A (z < −5 po wschodniej, z < −11 po zachodniej) i ląd B (odbicie); na wodzie lina z bojami
    fenceSeg(s * (HX + B), -s * HZ, s * (HX + B), -s * 5);
    fenceSeg(-s * (HX + B), -s * HZ, -s * (HX + B), -s * 11);
  }
  ropeSeg(HX + B, -5, HX + B, 11); ropeSeg(-HX - B, -11, -HX - B, 5);
  // tablice NO WAKE na palu w wodzie przy granicy
  for (const s of [1, -1]) {
    const tex = signTexture([], 256, 256, '#f6f6f0', (x, W) => { x.strokeStyle = '#ff7a2a'; x.lineWidth = 22; x.beginPath(); x.moveTo(128, 18); x.lineTo(238, 128); x.lineTo(128, 238); x.lineTo(18, 128); x.closePath(); x.stroke(); x.fillStyle = '#1d1d1d'; x.font = '900 46px Arial, sans-serif'; x.textAlign = 'center'; x.fillText('NO', W / 2, 118); x.fillText('WAKE', W / 2, 166); });
    const m = signMesh(0.9, 0.9, tex); m.position.set(s * (HX - 0.6), 1.75, s * 2.6); m.rotation.y = s > 0 ? -PI / 2 : PI / 2; root.add(m);
    D.add(new THREE.CylinderGeometry(0.08, 0.08, 1.7, 6), '#6a5238', M4(s * (HX - 0.55), 0.85, s * 2.6));
  }
  // pomosty: liny między palami, opony-odbijacze, latarnie na końcach
  for (const s of [1, -1]) {
    for (const [px, pz, py] of PILES) { D.add(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 7), '#5a4632', M4(s * px, py + 0.53, s * pz)); }
    for (const [px, pz] of [[9.0, -0.88], [11.8, 0.88], [7.4, 0.88]]) D.add(new THREE.TorusGeometry(0.28, 0.11, 6, 10), '#1f1f22', M4(s * px, PIER - 0.15, s * (pz + Math.sign(pz) * 0.18), 0, PI / 2));
    wire(R, V3(s * 7.4, PIER + 0.4, s * 0.88), V3(s * 11.8, PIER + 0.4, s * 0.88), 0.15);
    // latarnia na palu przy końcu pomostu (nad kolizją pala)
    const lx = s * 11.8, lz = s * -0.88;
    H.add(new THREE.CylinderGeometry(0.05, 0.07, 1.9, 6), '#2b2b2b', M4(lx, PIER + 1.45, lz)); D.box(0.26, 0.34, 0.26, '#2b2b2b', M4(lx, PIER + 2.5, lz)); G.box(0.18, 0.24, 0.18, '#ffd88a', M4(lx, PIER + 2.48, lz), 'glow');
    // cumy hydroplanów do pali pomostu
    wire(R, V3(s * 11.8, PIER + 0.35, s * 0.88), V3(s * 13.0, 0.7, s * 4.1), 0.05);
    wire(R, V3(s * 9.0, PIER + 0.35, s * 0.88), V3(s * 10.6, 0.7, s * 4.1), 0.1);
  }
  // kable: słup → dach sklepiku, słup → poza mapę
  for (const o of OBJECTS.filter((q) => q.t === 'pole')) {
    const s = o.side === 'A' ? 1 : -1, top = V3(o.x + s * 0.9, LAND + 8.05, o.z), top2 = V3(o.x - s * 0.9, LAND + 8.05, o.z);
    wire(R, top, V3(s * -4.2, 4.95, s * -0.8), 1.1); wire(R, top2, V3(o.x - s * 2, LAND + 8.05, o.z - s * 26), 0.8); wire(R, V3(o.x, LAND + 8.05, o.z), V3(o.x + s * 22, LAND + 8.05, o.z - s * 9), 0.9);
  }
}

// świat dookoła: dęby, palmy, cyprysy w wodzie, krzaki przy płocie, przyczepy kempingowe, droga ze słupami, łódki
function outerWorld(K, root, rand) {
  const { D, R } = K;
  const free = (x, z, m) => !inMap(x, z, m);
  // krzaki tuż za płotem (zasłaniają szwy terenu i robią „ścianę zieleni”)
  for (let i = 0; i < 260; i++) {
    const side = Math.floor(rand() * 4), t = rand() * 2 - 1, o = 1.2 + rand() * 3;
    const x = side < 2 ? (side ? 1 : -1) * (HX + o) : t * (HX + o), z = side < 2 ? t * (HZ + o) : (side === 2 ? 1 : -1) * (HZ + o);
    if (outerWet(x, z)) { if (rand() < 0.5) addRushes(R, x, WL - 0.05, z, rand, 22, 2.2 + rand() * 0.8, 1.4); continue; }
    const s = 0.9 + rand() * 1.1; D.add(jitter(new THREE.IcosahedronGeometry(1, 1), 0.25, rand), pick(rand, ['#3f8526', '#4f9a2c', '#2f7a22', '#5daa34']), M4(x, LAND + s * 0.5, z, 0, rand() * 6, 0, s * 1.3, s, s * 1.3));
  }
  // drzewa: im bliżej pola, tym gęściej
  const PC = { trunk: '#7a5a3a', trunk2: '#6a4c32', leaf: '#4fa02a', leaf2: '#3c8a22', nut: '#4a3a24' };
  let n = 0;
  for (let i = 0; i < 4000 && n < 120; i++) {
    const a = rand() * PI * 2, d = 6 + Math.pow(rand(), 1.6) * 75, x = Math.cos(a) * (HX + d), z = Math.sin(a) * (HZ + d);
    if (!free(x, z, 4)) continue;
    const wet = outerWet(x, z), y = wet ? -0.6 : LAND;
    const OM = objMatrix(x, y, z, rand() * PI * 2), P = local(OM), r = rand();
    if (wet) { if (r < 0.5) { cypress(D, D, R, P, rand, 0.9 + rand() * 0.4); n++; } continue; }
    if (r < 0.5) oak(D, D, R, P, rand, 0.9 + rand() * 0.5, true); else if (r < 0.85) addPalm(D, x, LAND, z, 7 + rand() * 6, rand, PC); else cypress(D, D, R, P, rand, 0.9 + rand() * 0.3);
    n++;
  }
  // szuwary na brzegach rozlewiska poza polem
  for (let i = 0; i < 3000; i++) {
    const x = (rand() * 2 - 1) * 90, z = (rand() * 2 - 1) * 60;
    if (!free(x, z, 1.5) || !outerWet(x, z)) continue;
    const shore = !outerWet(x + 2.5, z) || !outerWet(x - 2.5, z) || !outerWet(x, z + 2.5) || !outerWet(x, z - 2.5);
    if (shore && rand() < 0.4) addRushes(R, x, WL - 0.05, z, rand, 20, 2.0 + rand() * 0.9, 1.5);
    else if (!shore && rand() < 0.06) addLily(R, x, WL + 0.02, z, rand, ['#4f9a2a', '#5fae32'], ['#ff7ab6', '#fff4f0'], 0.3);
  }
  // kemping: kilka przyczep za płotem
  for (const [x, z, rot, look] of [[22, -33, 0.3, 'sun'], [-24, -31, -0.2, 'rose'], [-21, 33, 2.9, 'sun'], [25, 31, 3.3, 'mint'], [31, -18, 1.4, 'peach']]) {
    if (outerWet(x, z)) continue;
    const P = local(objMatrix(x, LAND, z, rot)); trailer(K.DG, D, P, look, rand);
  }
  // droga gruntowa za płotem B ze słupami i kablami
  const road = new Kit(), RZ = 41;
  for (let x = -110; x < 110; x += 4) road.box(4.05, 0.03, 4.2, (x / 4) % 2 ? '#a07a4c' : '#987244', M4(x + 2, LAND + 0.02 + 0.35 * vnoise((x + 2) * 0.12, RZ * 0.12), RZ + Math.sin(x * 0.03) * 1.5));
  road.meshes(false).forEach((m) => { m.userData.deco = true; root.add(m); });
  let prev = null;
  for (let x = -100; x <= 100; x += 20) {
    const z = RZ + 3.5 + Math.sin(x * 0.03) * 1.5, P = local(objMatrix(x, LAND, z, 0));
    D.add(new THREE.CylinderGeometry(0.13, 0.17, 8.5, 7), '#6a5238', P(0, 4.25, 0)); D.box(2.2, 0.14, 0.14, '#5a4632', P(0, 7.9, 0));
    const tp = P.pt(0.9, 8.05, 0), tp2 = P.pt(-0.9, 8.05, 0);
    if (prev) { wire(R, prev[0], tp, 0.9); wire(R, prev[1], tp2, 0.9); }
    prev = [tp, tp2];
  }
  // łódki przy brzegu rozlewiska (wschód i zachód) i mały pomost
  for (const [x, z, yaw, c] of [[34, 4, 0.4, '#2f7fa8'], [37, -2, -0.3, '#d8572a'], [-35, -3, 2.6, '#f6f1e6'], [-31, 6, 3.4, '#2ec4b6']]) {
    const P = local(objMatrix(x, WL - 0.1, z, yaw));
    D.box(1.3, 0.4, 3.6, c, P(0, 0.2, 0)); D.box(1.1, 0.06, 3.4, '#8a5a32', P(0, 0.4, 0)); D.box(1.0, 0.3, 0.6, c, P(0, 0.3, 1.9, -0.5)); D.box(1.2, 0.08, 0.3, '#8a5a32', P(0, 0.45, 0.3));
  }
  for (let x = 30; x < 40; x += 0.3) D.box(0.27, 0.07, 1.4, pick(rand, WOOD), M4(x, PIER, 8.5));
  for (let x = 30; x <= 40; x += 2.5) for (const z of [7.9, 9.1]) D.add(new THREE.CylinderGeometry(0.12, 0.14, 1.6, 6), '#6a5238', M4(x, 0.3, z));
}

// ======================================================================================================
export function buildBayou() {
  const rand = rng(20261119);
  const root = new THREE.Group(); root.name = 'Bagno';
  BLOCK = MAP.colliders.filter((b) => !(b[3] - b[0] > 20 || b[5] - b[2] > 20));        // kolizje bez lądu i granic (do rozstawiania drobiazgów)
  {
    const K = { H: new Kit(), HG: new Kit(), D: new Kit(), DG: new Kit(), R: new Kit(), G: new Kit() };
    root.add(innerTerrain());
    root.add(outerTerrain());
    // umocnienia brzegów (strona A, B = odbicie)
    const segs = [[-9, -5, HX, -5, 0, 1], [-9, -11, -9, -5, -1, 0], [-HX, -11, -9, -11, 0, 1]];
    for (const [ax, az, bx, bz, nx, nz] of segs) { bulkhead(K.H, K.D, ax, az, bx, bz, nx, nz, rand); bulkhead(K.H, K.D, -ax, -az, -bx, -bz, -nx, -nz, rand); }
    deck(K.H, K.D, rand);
    for (const [x0, z0, x1, z1] of GANGWAYS) for (const s of [1, -1]) walkway(K.H, K.D, s > 0 ? x0 : -x1, s > 0 ? z0 : -z1, s > 0 ? x1 : -x0, s > 0 ? z1 : -z0, 0.92, rand, false);
    for (const [x0, z0, x1, z1] of PIERS) for (const s of [1, -1]) {
      walkway(K.H, K.D, s > 0 ? x0 : -x1, s > 0 ? z0 : -z1, s > 0 ? x1 : -x0, s > 0 ? z1 : -z0, PIER, rand, true);
      walkway(K.H, K.D, s > 0 ? x1 : -x1 - 0.6, -1, s > 0 ? x1 + 0.6 : -x1, 1, 0.45, rand, true);                 // stopień do wody
    }
    for (const [x0, z0, x1, z1] of FINGERS) for (const s of [1, -1]) walkway(K.H, K.D, s > 0 ? x0 : -x1, s > 0 ? z0 : -z1, s > 0 ? x1 : -x0, s > 0 ? z1 : -z0, PIER, rand, false);
    for (const [px, pz, py] of PILES) for (const s of [1, -1]) K.H.add(new THREE.CylinderGeometry(0.13, 0.15, py + 0.5 + 0.4, 7), '#6a5238', M4(s * px, (py + 0.5 - 0.4) / 2, s * pz));
    shack(K.H, K.D, K.G, root, rand);
    for (const o of OBJECTS) buildObject(o, K, root, rand);
    decorate(K, root, rand);
    outerWorld(K, root, rand);
    // siatki: twarde (trafienia), błyszczące (samoloty, przyczepy, beczki), ozdoby z cieniem, ozdoby bez cienia, świecące
    const { SOLID, GLOW } = mats(), { GLOSS: GL } = materials();
    const add = (geo, mat, deco, shadow) => { if (!geo) return; const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = true; m.userData.deco = deco; root.add(m); };
    add(K.H.geometry('solid'), SOLID, false, true);
    add(K.HG.geometry('solid'), GL, false, true);
    add(K.D.geometry('solid'), SOLID, true, true);
    add(K.DG.geometry('solid'), GL, true, true);
    add(K.R.geometry('solid'), SOLID, true, false);
    for (const k of ['H', 'HG', 'D', 'DG', 'R', 'G']) add(K[k].geometry('glow'), GLOW, true, false);
  }
  return root;
}
