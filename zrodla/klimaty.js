// Klimaty map 1v1 – tylko grafika. Kolizje, spawny, drabiny i wszystko, co liczy serwer meczów, zostają bez zmian.
//  • Baza → „Salon”: salon luksusowych aut wieczorem (zachód słońca, ulica z ruchem, kamienice z neonami, palmy, reflektory na niebie)
//  • Oaza → „Bagno”: mokradła w upale (mętna woda z wysepkami, cyprysy z mchem, trzciny, lilie wodne, aligatory, łódź ślizgowa)
// Styl fasolki: low poly, płaskie kolory, cieniowanie płaskie. Dekoracje leżą poza polem gry (albo płasko na ziemi), kule ich nie widzą.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { YACHT, halfAt as yachtHalf } from './magazyn-data.js';   // wymiary jachtów (piana przy burtach)
import { HALL } from './baza-data.js';                              // wymiary hali salonu (ulica i zabudowa wokół)

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V3(0, 1, 0);
const rng = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;
const _c = new THREE.Color(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = V3(), _p = V3();
// macierz: pozycja, obrót (najpierw yaw, potem pochylenie) i skala
const M4 = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) =>
  new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(sx, sy, sz));
// walec/stożek rozpięty między dwoma punktami
function between(a, b) {
  const d = V3().subVectors(b, a), len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize());
  return [new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, V3(1, 1, 1)), len];
}
// poszarpanie brył (kamienie, korony drzew) – te same wierzchołki przesuwają się razem, więc bez szczelin
function jitter(geo, amt, rand) {
  const P = geo.attributes.position, mp = new Map();
  for (let i = 0; i < P.count; i++) {
    const k = P.getX(i).toFixed(3) + ',' + P.getY(i).toFixed(3) + ',' + P.getZ(i).toFixed(3);
    let o = mp.get(k); if (!o) mp.set(k, (o = [(rand() - 0.5) * amt, (rand() - 0.5) * amt, (rand() - 0.5) * amt]));
    P.setXYZ(i, P.getX(i) + o[0], P.getY(i) + o[1], P.getZ(i) + o[2]);
  }
  return geo;
}

// ---------------- zestaw dekoracji: wszystko sklejone w kilka siatek z kolorami w wierzchołkach ----------------
let SOLID = null, GLOW = null;
const mats = () => {
  if (!SOLID) {
    SOLID = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
    GLOW = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  }
  return { SOLID, GLOW };
};
class Kit {
  constructor() { this.L = { solid: [], glow: [] }; }
  add(geo, color, m, kind = 'solid') {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
    g.morphAttributes = {}; g.clearGroups();
    if (m) g.applyMatrix4(m);
    const n = g.attributes.position.count, c = _c.set(color), a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    this.L[kind].push(g);
    return g;
  }
  tris(pts, color, kind) {                     // płaska lista punktów (po 3 na trójkąt)
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap((p) => [p.x, p.y, p.z]), 3));
    return this.add(g, color, null, kind);
  }
  box(w, h, d, color, m, kind) { return this.add(new THREE.BoxGeometry(w, h, d), color, m, kind); }
  geometry(kind) {
    const l = this.L[kind]; if (!l.length) return null;
    const g = mergeGeometries(l, false); g.computeVertexNormals(); g.computeBoundingSphere(); return g;
  }
  meshes(shadow = true) {
    const { SOLID, GLOW } = mats(), out = [];
    const s = this.geometry('solid'), gl = this.geometry('glow');
    if (s) { const m = new THREE.Mesh(s, SOLID); m.castShadow = shadow; m.receiveShadow = true; out.push(m); }
    if (gl) out.push(new THREE.Mesh(gl, GLOW));
    return out;
  }
}

// ---------------- niebo: panorama (equirect) malowana na canvasie ----------------
function skyTexture({ stops, sun, paint, W = 2048, H = 1024 }) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H);
  for (const [el, col] of stops) g.addColorStop((90 - el) / 180, col);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // kierunek świata -> piksel (jak equirectUv w three.js)
  const px = (dir) => [(Math.atan2(dir.z, dir.x) / (2 * Math.PI) + 0.5) * W, (0.5 - Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)) / Math.PI) * H];
  const wrap = (fn) => { for (const o of [-W, 0, W]) fn(o); };
  if (sun) {
    const [sx, sy] = px(sun.dir);
    wrap((o) => {
      for (const [r, col] of sun.glow) {
        const rg = x.createRadialGradient(sx + o, sy, 0, sx + o, sy, r);
        rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = rg; x.fillRect(sx + o - r, sy - r, r * 2, r * 2);
      }
      if (sun.disc) { x.fillStyle = sun.disc; x.beginPath(); x.arc(sx + o, sy, sun.r, 0, Math.PI * 2); x.fill(); }
    });
  }
  if (paint) paint(x, W, H, px, wrap);
  const t = new THREE.CanvasTexture(cv);
  t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const elevY = (H, deg) => (0.5 - (deg * Math.PI / 180) / Math.PI) * H;

// ---------------- woda: duża płaszczyzna z falami w shaderze (płaskie cieniowanie = fasetki low poly) ----------------
function makeWater({ size = 900, seg = 150, y, color, rough = 0.2, metal = 0.3, env, envI = 1, amp = 0.12, freq = 0.12, speed = 1, opacity = 1 }) {
  const geo = new THREE.PlaneGeometry(size, size, seg, seg); geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, flatShading: true, envMap: env || null, envMapIntensity: envI, transparent: opacity < 1, opacity });
  const uT = { value: 0 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uT = uT;
    sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 wq = (modelMatrix * vec4(transformed, 1.0)).xyz;
      transformed.y += ${amp.toFixed(3)} * (sin(wq.x * ${freq.toFixed(3)} + uT * ${(1.1 * speed).toFixed(3)}) * cos(wq.z * ${(freq * 0.8).toFixed(3)} + uT * ${(1.3 * speed).toFixed(3)})
        + 0.5 * sin((wq.x + wq.z) * ${(freq * 2.1).toFixed(3)} - uT * ${(1.7 * speed).toFixed(3)}));`);
  };
  mat.customProgramCacheKey = () => 'bean-water-' + amp + '-' + freq + '-' + speed;
  const m = new THREE.Mesh(geo, mat); m.position.y = y; m.receiveShadow = true; m.renderOrder = -1;
  return { mesh: m, tick: (t) => { uT.value = t; } };
}

// ---------------- teren: zmiana wysokości i kolory w wierzchołkach (tylko wygląd – ziemia gracza to kolizje) ----------------
function reshapeGround(mesh, fnY, fnCol) {
  const geo = mesh.geometry, P = geo.attributes.position; mesh.updateWorldMatrix(true, false);
  const inv = mesh.matrixWorld.clone().invert(), w = V3(), col = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) {
    w.fromBufferAttribute(P, i).applyMatrix4(mesh.matrixWorld);
    w.y = fnY(w.x, w.z, w.y);
    const c = _c.set(fnCol(w.x, w.z, w.y, i)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    w.applyMatrix4(inv); P.setXYZ(i, w.x, w.y, w.z);
  }
  P.needsUpdate = true;
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals(); geo.computeBoundingBox(); geo.computeBoundingSphere();
  const m = mesh.material; m.vertexColors = true; m.color.set('#ffffff'); m.flatShading = true; m.needsUpdate = true;
}

// ściany chat na bagnie: pionowe deski i ślad wysokiej wody (omszały pas przy ziemi) – liczone w shaderze z pozycji w świecie
function floodWalls(meshes, names) {
  const seen = new Set();
  for (const o of meshes) for (const m of [].concat(o.material)) {
    if (!m || seen.has(m) || !names.includes(m.name)) continue; seen.add(m);
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nfloat bh(float n){ return fract(sin(n) * 43758.5453); }')
        .replace('#include <color_fragment>', `#include <color_fragment>
          float bs = (vWP.x + vWP.z) * 2.6, bid = floor(bs), bf = fract(bs);
          diffuseColor.rgb *= 0.88 + 0.18 * bh(bid * 7.13 + floor(vWP.y / 2.4) * 3.7);
          diffuseColor.rgb *= mix(0.7, 1.0, smoothstep(0.0, 0.08, bf) * smoothstep(1.0, 0.92, bf));
          float wl = 0.8 + 0.16 * sin(vWP.x * 1.7 + vWP.z * 0.9) + 0.08 * sin(vWP.x * 4.3 - vWP.z * 3.1);
          float st = 1.0 - smoothstep(wl - 0.05, wl + 0.05, vWP.y);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.5, 0.58, 0.36), st * 0.9);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.22, 0.27, 0.15), smoothstep(0.06, 0.0, abs(vWP.y - wl)) * 0.55);`);
    };
    m.customProgramCacheKey = () => 'bean-flood-wall';
    m.needsUpdate = true;
  }
}

// ---------------- mapa zajętości (gdzie stoją budynki i rzeczy) – do rozstawiania dekoracji ----------------
function occupancy(meshes, ground, R = 220, C = 1) {
  const N = Math.ceil((2 * R) / C), H = new Float32Array(N * N), v = V3();
  for (const o of meshes) {
    if (o === ground || !o.geometry || !o.geometry.attributes.position) continue;
    o.updateWorldMatrix(true, false);
    const P = o.geometry.attributes.position, idx = o.geometry.index, W = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); W[i * 3] = v.x; W[i * 3 + 1] = v.y; W[i * 3 + 2] = v.z; }
    const nt = idx ? idx.count / 3 : P.count / 3;
    for (let t = 0; t < nt; t++) {
      const a = idx ? idx.getX(t * 3) : t * 3, b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      const my = Math.max(W[a * 3 + 1], W[b * 3 + 1], W[c * 3 + 1]); if (my < 0.25) continue;
      const x0 = Math.min(W[a * 3], W[b * 3], W[c * 3]), x1 = Math.max(W[a * 3], W[b * 3], W[c * 3]);
      const z0 = Math.min(W[a * 3 + 2], W[b * 3 + 2], W[c * 3 + 2]), z1 = Math.max(W[a * 3 + 2], W[b * 3 + 2], W[c * 3 + 2]);
      const gx0 = Math.max(0, Math.floor((x0 + R) / C)), gx1 = Math.min(N - 1, Math.floor((x1 + R) / C));
      const gz0 = Math.max(0, Math.floor((z0 + R) / C)), gz1 = Math.min(N - 1, Math.floor((z1 + R) / C));
      for (let gx = gx0; gx <= gx1; gx++) for (let gz = gz0; gz <= gz1; gz++) { const k = gx * N + gz; if (H[k] < my) H[k] = my; }
    }
  }
  const at = (x, z) => { const gx = Math.floor((x + R) / C), gz = Math.floor((z + R) / C); return gx < 0 || gz < 0 || gx >= N || gz >= N ? 0 : H[gx * N + gz]; };
  const free = (x, z, r) => { for (let dx = -r; dx <= r; dx += C) for (let dz = -r; dz <= r; dz += C) if (at(x + dx, z + dz) > 0) return false; return true; };
  return { at, free };
}
// wysokość terenu w siatce 1 m (trójkąty terenu wpisane w siatkę – szybciej niż promień na każde zapytanie)
function groundProbe(ground, R = 200, C = 1) {
  const N = Math.ceil((2 * R) / C), H = new Float32Array(N * N).fill(NaN), v = V3();
  ground.updateWorldMatrix(true, false);
  const P = ground.geometry.attributes.position, idx = ground.geometry.index, W = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(ground.matrixWorld); W[i * 3] = v.x; W[i * 3 + 1] = v.y; W[i * 3 + 2] = v.z; }
  const nt = idx ? idx.count / 3 : P.count / 3;
  for (let t = 0; t < nt; t++) {
    const a = idx ? idx.getX(t * 3) : t * 3, b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    const ax = W[a * 3], az = W[a * 3 + 2], bx = W[b * 3], bz = W[b * 3 + 2], cx = W[c * 3], cz = W[c * 3 + 2];
    const den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(den) < 1e-9) continue;
    const gx0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) + R) / C)), gx1 = Math.min(N - 1, Math.floor((Math.max(ax, bx, cx) + R) / C));
    const gz0 = Math.max(0, Math.floor((Math.min(az, bz, cz) + R) / C)), gz1 = Math.min(N - 1, Math.floor((Math.max(az, bz, cz) + R) / C));
    for (let gx = gx0; gx <= gx1; gx++) for (let gz = gz0; gz <= gz1; gz++) {
      const px = gx * C - R + C / 2, pz = gz * C - R + C / 2;
      const l1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / den, l2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / den, l3 = 1 - l1 - l2;
      if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) continue;
      H[gx * N + gz] = l1 * W[a * 3 + 1] + l2 * W[b * 3 + 1] + l3 * W[c * 3 + 1];
    }
  }
  return (x, z) => { const gx = Math.floor((x + R) / C), gz = Math.floor((z + R) / C); const h = gx < 0 || gz < 0 || gx >= N || gz >= N ? NaN : H[gx * N + gz]; return Number.isNaN(h) ? 0 : h; };
}

function recolor(meshes, table) {
  const seen = new Set();
  for (const o of meshes) for (const m of [].concat(o.material)) {
    if (!m || seen.has(m)) continue; seen.add(m);
    const r = table[m.name]; if (!r) continue;
    if (typeof r === 'string') { m.color.set(r); continue; }
    if (r.c) m.color.set(r.c);
    if (r.e) { m.emissive.set(r.e); m.emissiveIntensity = r.ei ?? 1; }
    if (r.r != null) m.roughness = r.r;
    if (r.m != null) m.metalness = r.m;
    m.needsUpdate = true;
  }
}

// ======================================================================================================
//                                       elementy low poly
// ======================================================================================================
function addPalm(K, x, y, z, h, rand, C) {
  const lean = rand() * Math.PI * 2, bend = 0.12 + rand() * 0.22, segs = 6, pts = [];
  for (let i = 0; i <= segs; i++) { const t = i / segs; pts.push(V3(x + Math.cos(lean) * bend * h * t * t, y + h * t, z + Math.sin(lean) * bend * h * t * t)); }
  for (let i = 0; i < segs; i++) {
    const [m, len] = between(pts[i], pts[i + 1]), r0 = 0.3 * (1 - (i / segs) * 0.45), r1 = 0.3 * (1 - ((i + 1) / segs) * 0.45);
    K.add(new THREE.CylinderGeometry(r1, r0 * 1.06, len * 1.04, 6, 1), i % 2 ? C.trunk : C.trunk2, m);
  }
  const top = pts[segs], n = 7 + Math.floor(rand() * 3);
  for (let k = 0; k < n; k++) {
    const az = (k / n) * Math.PI * 2 + rand() * 0.4, L = h * (0.38 + rand() * 0.14), lift = 0.2 + rand() * 0.25;
    const dir = V3(Math.cos(az), 0, Math.sin(az)), side = V3(-Math.sin(az), 0, Math.cos(az)), st = [];
    for (let i = 0; i <= 6; i++) {
      const s = i / 6, p = top.clone().addScaledVector(dir, L * s).addScaledVector(UP, L * (lift * s * 2 - 0.85 * s * s));
      const w = L * 0.15 * Math.sin(Math.PI * Math.min(1, s * 1.08 + 0.02));
      st.push([p, p.clone().addScaledVector(side, w).addScaledVector(UP, -w * 0.4), p.clone().addScaledVector(side, -w).addScaledVector(UP, -w * 0.4)]);
    }
    const tri = [];
    for (let i = 0; i < 6; i++) { const [c0, l0, r0] = st[i], [c1, l1, r1] = st[i + 1]; tri.push(c0, l0, c1, l0, l1, c1, c0, c1, r0, r0, c1, r1); }
    K.tris(tri, k % 2 ? C.leaf : C.leaf2);
  }
  for (let k = 0; k < 3; k++) K.add(new THREE.IcosahedronGeometry(0.22, 0), C.nut, M4(top.x + Math.cos(k * 2.1) * 0.3, top.y - 0.3, top.z + Math.sin(k * 2.1) * 0.3));
}

function addCypress(K, x, y, z, h, rand) {
  const T = ['#5b4a3a', '#4e4032'][rand() < 0.5 ? 0 : 1];
  K.add(new THREE.CylinderGeometry(0.3, 0.75, h * 0.8, 7, 1), T, M4(x, y + h * 0.4 - 0.4, z));
  K.add(new THREE.CylinderGeometry(0.7, 1.5, 1.6, 7, 1), T, M4(x, y + 0.2, z, 0, rand() * 3));
  for (let k = 0; k < 3; k++) {                                   // „kolana” cyprysów wystające z wody
    const a = rand() * Math.PI * 2, d = 1.6 + rand() * 1.4;
    K.add(new THREE.ConeGeometry(0.18 + rand() * 0.12, 0.6 + rand() * 0.6, 5), T, M4(x + Math.cos(a) * d, y + 0.15, z + Math.sin(a) * d));
  }
  const blobs = 3 + Math.floor(rand() * 2), G = ['#4f5f2c', '#425226', '#5b6c33', '#3a4a22'];
  for (let b = 0; b < blobs; b++) {
    const by = y + h * (0.62 + (b / blobs) * 0.38), bx = x + (rand() - 0.5) * 2.6, bz = z + (rand() - 0.5) * 2.6;
    const sx = 2.4 + rand() * 1.4, sy = 0.9 + rand() * 0.5, sz = 2.4 + rand() * 1.4;
    K.add(jitter(new THREE.IcosahedronGeometry(1, 0), 0.35, rand), G[Math.floor(rand() * G.length)], M4(bx, by, bz, 0, rand() * 6, 0, sx, sy, sz));
    if (b < 2) K.add(new THREE.CylinderGeometry(0.08, 0.14, Math.hypot(bx - x, bz - z) + 0.5, 4), T, between(V3(x, by - 1.2, z), V3(bx, by - 0.2, bz))[0]);
    for (let s = 0; s < 5; s++) {                                 // hiszpański mech zwisający z gałęzi
      const a = rand() * Math.PI * 2, r = sx * (0.4 + rand() * 0.5), mx = bx + Math.cos(a) * r, mz = bz + Math.sin(a) * r, top = by - sy * 0.5;
      const len = 1.2 + rand() * 1.8, w = 0.22 + rand() * 0.18, t = V3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(w);
      K.tris([V3(mx - t.x, top, mz - t.z), V3(mx + t.x, top, mz + t.z), V3(mx + (rand() - 0.5) * 0.3, top - len, mz + (rand() - 0.5) * 0.3)], rand() < 0.5 ? '#8f9a78' : '#7d8a68');
    }
  }
}

function addReeds(K, x, y, z, rand, n = 9, hmax = 1.9) {
  const G = ['#6f8a3a', '#7f9a44', '#9aa456', '#5f7a30'];
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2, r = rand() * 0.7, bx = x + Math.cos(a) * r, bz = z + Math.sin(a) * r, h = hmax * (0.45 + rand() * 0.55);
    const la = rand() * Math.PI * 2, lean = 0.1 + rand() * 0.35, tip = V3(bx + Math.cos(la) * lean, y + h, bz + Math.sin(la) * lean);
    const s = V3(-Math.sin(la), 0, Math.cos(la)).multiplyScalar(0.05);
    K.tris([V3(bx - s.x, y - 0.1, bz - s.z), V3(bx + s.x, y - 0.1, bz + s.z), tip], G[Math.floor(rand() * G.length)]);
    if (rand() < 0.35) K.add(new THREE.CylinderGeometry(0.055, 0.055, 0.3, 5), '#5a3a22', M4(bx + (tip.x - bx) * 0.82, y + h * 0.82, bz + (tip.z - bz) * 0.82, 0, 0, lean * 0.8));
  }
}

function addLily(K, x, y, z, rand) {
  const r = 0.35 + rand() * 0.45, cut = 0.5;
  K.add(new THREE.CircleGeometry(r, 8, cut / 2, Math.PI * 2 - cut), rand() < 0.5 ? '#4f7a2e' : '#5f8a36', M4(x, y, z, -Math.PI / 2, rand() * 6, 0));
  if (rand() < 0.22) K.add(new THREE.ConeGeometry(0.13, 0.18, 6), rand() < 0.5 ? '#f4a6c8' : '#f6f1e6', M4(x, y + 0.08, z, Math.PI));
}

function addRock(K, x, y, z, s, rand, col = '#6d6a58') {
  K.add(jitter(new THREE.IcosahedronGeometry(1, 0), 0.45, rand), col, M4(x, y, z, 0, rand() * 6, 0, s * (1 + rand() * 0.5), s * (0.5 + rand() * 0.3), s * (1 + rand() * 0.5)));
}

// aligator: osobna siatka (pływa), wynurzone tylko grzbiet, łeb i oczy
function gatorGeometry(scale = 1) {
  const K = new Kit(), B = '#3e4a2c', D = '#2f3a22';
  K.box(0.85, 0.3, 1.9, B, M4(0, 0, 0));
  for (let i = 0; i < 5; i++) K.box(0.5, 0.12, 0.22, D, M4(0, 0.18, -0.7 + i * 0.35));
  K.box(0.58, 0.24, 0.6, B, M4(0, 0.02, 1.2));
  K.box(0.42, 0.15, 0.75, B, M4(0, -0.03, 1.8));
  K.box(0.13, 0.11, 0.13, '#c8b040', M4(0.17, 0.15, 1.12)); K.box(0.13, 0.11, 0.13, '#c8b040', M4(-0.17, 0.15, 1.12));
  K.box(0.55, 0.24, 0.85, B, M4(0, 0, -1.3)); K.box(0.36, 0.2, 0.85, D, M4(0, 0, -2.1)); K.box(0.2, 0.16, 0.85, B, M4(0, 0, -2.9));
  for (const [sx, sz] of [[1, 0.6], [-1, 0.6], [1, -0.6], [-1, -0.6]]) K.box(0.3, 0.14, 0.42, D, M4(sx * 0.52, -0.1, sz, 0, sx * 0.4));
  const g = K.geometry('solid'); g.scale(scale, scale, scale); return g;
}

function airboat(K, x, y, z, yaw) {
  const m = (lx, ly, lz) => { const c = Math.cos(yaw), s = Math.sin(yaw); return [x + lx * c + lz * s, y + ly, z - lx * s + lz * c]; };
  const P = (lx, ly, lz, rx = 0, ry = 0, rz = 0) => { const [a, b, c] = m(lx, ly, lz); return M4(a, b, c, rx, yaw + ry, rz); };
  K.box(2.1, 0.35, 4.4, '#d9d4c4', P(0, 0.1, 0));
  K.box(2.12, 0.12, 4.42, '#2f6f8a', P(0, 0.2, 0));
  K.box(2.0, 0.3, 1.0, '#d9d4c4', P(0, 0.22, 2.4, -0.45));
  K.box(0.9, 0.12, 0.9, '#3a3a3a', P(0, 1.2, -0.6)); K.box(0.12, 1.0, 0.12, '#555', P(-0.35, 0.75, -0.6)); K.box(0.12, 1.0, 0.12, '#555', P(0.35, 0.75, -0.6));
  K.box(0.7, 0.5, 0.6, '#444', P(0, 0.6, -1.4));
  K.add(new THREE.TorusGeometry(1.05, 0.06, 4, 12), '#333333', P(0, 1.35, -1.85));
  K.box(2.0, 0.18, 0.05, '#7a5a3c', P(0, 1.35, -1.8, 0, 0, 0.6)); K.box(2.0, 0.18, 0.05, '#7a5a3c', P(0, 1.35, -1.8, 0, 0, -0.95));
  K.box(0.08, 1.1, 0.7, '#2f6f8a', P(0, 1.2, -2.15));
}

function car(K, x, y, z, yaw, body, body2, { pickup = false, muddy = '#6b5a3c' } = {}) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const P = (lx, ly, lz, rx = 0, rz = 0) => M4(x + lx * c + lz * s, y + ly, z - lx * s + lz * c, rx, yaw, rz);
  K.box(1.9, 0.75, 4.6, body, P(0, 0.75, 0));
  K.box(1.92, 0.3, 4.62, muddy, P(0, 0.45, 0));
  if (pickup) { K.box(1.8, 0.75, 1.9, body2, P(0, 1.45, 0.7)); K.box(1.7, 0.45, 0.06, '#1a1d22', P(0, 1.55, 1.66)); K.box(1.8, 0.4, 2.0, body, P(0, 1.3, -1.25)); K.box(1.5, 0.1, 1.8, '#2c2c2c', P(0, 1.12, -1.25)); }
  else { K.box(1.8, 0.7, 2.6, body2, P(0, 1.45, -0.3)); K.box(1.7, 0.42, 0.06, '#1a1d22', P(0, 1.5, 1.0)); }
  for (const [wx, wz] of [[0.95, 1.5], [-0.95, 1.5], [0.95, -1.5], [-0.95, -1.5]]) K.add(new THREE.CylinderGeometry(0.42, 0.42, 0.32, 8), '#1d1d1f', P(wx, 0.42, wz, 0, Math.PI / 2));
}

// helikopter: kadłub + wirniki (kręcą się) + migające światło
function helicopter(body, stripe) {
  const K = new Kit(), g = new THREE.Group();
  K.box(1.5, 1.3, 3.0, body, M4(0, 0, 0)); K.box(1.3, 0.9, 1.0, '#1b2230', M4(0, 0.05, 1.55)); K.box(1.52, 0.25, 3.02, stripe, M4(0, -0.2, 0));
  K.box(0.32, 0.32, 3.4, body, M4(0, 0.25, -3.0)); K.box(0.12, 1.0, 0.6, stripe, M4(0, 0.6, -4.5));
  K.box(0.1, 0.1, 2.6, '#222', M4(0.6, -0.9, 0.1)); K.box(0.1, 0.1, 2.6, '#222', M4(-0.6, -0.9, 0.1));
  K.box(0.08, 0.5, 0.08, '#222', M4(0.6, -0.7, 0.8)); K.box(0.08, 0.5, 0.08, '#222', M4(-0.6, -0.7, 0.8)); K.box(0.08, 0.5, 0.08, '#222', M4(0.6, -0.7, -0.6)); K.box(0.08, 0.5, 0.08, '#222', M4(-0.6, -0.7, -0.6));
  K.box(0.2, 0.3, 0.2, '#333', M4(0, 0.8, 0));
  K.meshes(false).forEach((m) => g.add(m));
  const { SOLID, GLOW } = mats();
  const rk = new Kit(); rk.box(7.5, 0.05, 0.28, '#2a2a2a', M4(0, 0, 0)); rk.box(0.28, 0.05, 7.5, '#2a2a2a', M4(0, 0, 0));
  const rotor = new THREE.Mesh(rk.geometry('solid'), SOLID); rotor.position.y = 0.98; g.add(rotor);
  const tk = new Kit(); tk.box(0.05, 1.2, 0.16, '#2a2a2a', M4(0, 0, 0));
  const tail = new THREE.Mesh(tk.geometry('solid'), SOLID); tail.position.set(0.12, 0.6, -4.6); g.add(tail);
  const lk = new Kit(); lk.box(0.22, 0.14, 0.22, '#ff2a2a', M4(0, 0, 0), 'glow');
  const light = new THREE.Mesh(lk.geometry('glow'), GLOW); light.position.set(0, -0.72, -0.4); g.add(light);
  return { g, rotor, tail, light };
}

function birds(n, rand, col) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.25, -0.9, 0.35, -0.1, 0, 0, -0.2, 0, 0, 0.25, 0.9, 0.35, -0.1, 0, 0, -0.2], 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide });
  const list = [];
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(geo, mat); m.userData = { a: rand() * 6.28, r: 0.7 + rand() * 0.6, h: (rand() - 0.5) * 6, ph: rand() * 6.28, s: 0.9 + rand() * 0.3 }; list.push(m); }
  return list;
}

// napis neonowy (canvas z poświatą) na ścianie
function neonSign(text, col, { h = 1.6, font = 'italic 900 92px Impact, "Arial Black", sans-serif', frame = true } = {}) {
  const cv = document.createElement('canvas'), x = cv.getContext('2d'); x.font = font;
  const tw = Math.ceil(x.measureText(text).width), W = tw + 110, H = 170; cv.width = W; cv.height = H;
  x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = col; x.lineJoin = 'round';
  if (frame) { x.shadowBlur = 22; x.strokeStyle = col; x.lineWidth = 7; x.beginPath(); x.roundRect(14, 14, W - 28, H - 28, 26); x.stroke(); x.stroke(); }
  x.shadowBlur = 28; x.strokeStyle = col; x.lineWidth = 9; x.strokeText(text, W / 2, H / 2 + 4); x.strokeText(text, W / 2, H / 2 + 4);
  x.shadowBlur = 8; x.fillStyle = '#fff4fb'; x.fillText(text, W / 2, H / 2 + 4);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry((h * W) / H, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, side: THREE.FrontSide }));
  m.renderOrder = 2;
  return m;
}

// okna wieżowców: kafelek 8×8 okien, część zapalona
function windowsTexture(rand) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d');
  x.fillStyle = '#07050f'; x.fillRect(0, 0, 256, 256);
  const L = ['#ffd48a', '#ffe9c4', '#fff2d8', '#ffd48a', '#7fffe0', '#ff9ad8', '#ffc070', '#ffe9c4'];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const on = rand() < 0.55; x.fillStyle = on ? L[Math.floor(rand() * L.length)] : '#1a1634';
    x.fillRect(i * 32 + 6, j * 32 + 6, 20, 22);
  }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function towerBox(w, h, d, x, y, z, ry, rand) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, CELL = 25.6, ou = Math.floor(rand() * 8) / 8, ov = Math.floor(rand() * 8) / 8;
  for (let i = 0; i < uv.count; i++) {
    const f = Math.floor(i / 4);
    if (f === 2 || f === 3) { uv.setXY(i, 0.005, 0.005); continue; }
    const fw = f < 2 ? d : w; uv.setXY(i, uv.getX(i) * (fw / CELL) + ou, uv.getY(i) * (h / CELL) + ov);
  }
  g.rotateY(ry); g.translate(x, y + h / 2, z);
  return g;
}

// ======================================================================================================
//                    BAZA → SALON (salon luksusowych aut, wieczór w Vice City)
// ======================================================================================================
// Hala, parking z autami, flagi i szyldy są w baza-data.js. Tu otoczenie widoczne przez witrynę i na miniaturze:
// zachód słońca nad ulicą, ruch aut, pastelowe kamienice art déco z neonami, palmy i latarnie, panorama wieżowców,
// dwa reflektory omiatające niebo (jak przy otwarciu salonu) i helikopter. Wszystko poza halą – kule tego nie widzą.
function themeDealer(M, root) {
  const rand = rng(20261121), { X1, Z: ZE } = HALL;
  const sunOff = V3(26, 30, 9);                            // światło: z boku witryny, wpada do salonu przez szybę
  const sunDir = V3(1, 0.07, 0.2).normalize();             // tarcza słońca nisko nad ulicą (widać ją przez witrynę)
  const FOG = '#c46a94';
  const sky = skyTexture({
    stops: [[90, '#140d36'], [55, '#2b1960'], [32, '#5a2584'], [17, '#a03a8e'], [8, '#e0588c'], [3, '#ff8a72'], [0.6, '#ffb070'], [0, '#e8829a'], [-2, FOG], [-12, '#6a3070'], [-90, '#1d1030']],
    sun: { dir: sunDir, r: 34, disc: '#fff0b8', glow: [[520, 'rgba(255,150,90,.55)'], [230, 'rgba(255,190,110,.7)'], [80, 'rgba(255,236,170,.95)']] },
    paint: (x, W, H) => {
      const r = rng(77);
      for (let i = 0; i < 46; i++) {
        const el = 3 + r() * 26, y = elevY(H, el), cx = r() * W, w = 140 + r() * 520, h = 4 + r() * 12;
        x.fillStyle = el < 13 ? `rgba(255,${150 + r() * 60 | 0},${150 + r() * 40 | 0},${0.25 + r() * 0.3})` : `rgba(${120 + r() * 60 | 0},${50 + r() * 30 | 0},${120 + r() * 40 | 0},${0.3 + r() * 0.3})`;
        for (const o of [-W, 0, W]) { x.beginPath(); x.ellipse(cx + o, y, w / 2, h / 2, 0, 0, Math.PI * 2); x.fill(); }
      }
      x.fillStyle = 'rgba(255,255,255,.75)';
      for (let i = 0; i < 70; i++) x.fillRect(r() * W, elevY(H, 40 + r() * 48), 2, 2);
    },
  });
  const K = new Kit();
  const PAST = ['#f4b8c8', '#9fe0d0', '#ffcf9f', '#c9b6f2', '#9fd0f4', '#f6ecd2', '#ff9ec4', '#b8f0e0'];
  const PC = { trunk: '#8a6a4c', trunk2: '#7a5a40', leaf: '#2f9a52', leaf2: '#24804a', nut: '#5a3a24' };

  // ---- ziemia, ulica z pasami, chodniki ----
  K.add(new THREE.PlaneGeometry(900, 900), '#2c2733', M4(0, -0.03, 0, -Math.PI / 2));
  const SX0 = 39, SX1 = 53;                                // jezdnia za parkingiem
  K.box(SX1 - SX0, 0.02, 800, '#24202c', M4((SX0 + SX1) / 2, -0.01, 0));
  for (const dx of [-0.16, 0.16]) K.box(0.12, 0.02, 800, '#f2c33a', M4((SX0 + SX1) / 2 + dx, 0.005, 0));
  for (const lx of [SX0 + 3.5, SX1 - 3.5]) for (let z = -390; z < 390; z += 9) K.box(0.14, 0.02, 4, '#e8e4ee', M4(lx, 0.006, z));
  for (let x = SX0 + 0.6; x < SX1 - 0.4; x += 1.1) K.box(0.6, 0.02, 3.2, '#e8e4ee', M4(x, 0.007, -44));   // przejście dla pieszych
  K.box(4, 0.15, 800, '#bdb6c9', M4(SX1 + 2, 0.075, 0));
  K.box(0.15, 0.17, 800, '#f4f2f6', M4(SX1 + 0.08, 0.085, 0));
  K.box(3, 0.15, 800, '#bdb6c9', M4(37.5, 0.075, 0));      // chodnik po stronie salonu poza parkingiem (pod parkingiem schowany)

  // ---- kamienice art déco po drugiej stronie ulicy: pastele, białe gzymsy, okna (część zapalona), neony ----
  const signs = [], SIGNS = [['MOTEL', '#ff4fd8'], ['DINER', '#3ff0e0'], ['ARCADE', '#b06bff'], ['TACOS', '#ffd23f'], ['HOTEL', '#ff4fd8'], ['DISCO', '#3ff0e0'], ['SURF SHOP', '#ff7a5a'], ['BEAN CLUB', '#b06bff'], ['PAWN', '#ffd23f'], ['GYM', '#3ff0e0'], ['TATTOO', '#ff4fd8'], ['PIZZA', '#ff7a5a']];
  const facade = (x0, z0, z1, h, d, col, face, si) => {      // face = -1: front w stronę -X (do ulicy), +1: w stronę +X
    const fx = face < 0 ? x0 : x0 + d;
    K.box(d, h, z1 - z0, col, M4(x0 + d / 2, h / 2, (z0 + z1) / 2));
    const fxo = fx + face * 0.06;
    for (let y = 3.6; y < h - 1; y += 3.2) K.box(0.12, 0.22, z1 - z0 + 0.2, '#fbf7f2', M4(fxo, y, (z0 + z1) / 2));
    K.box(0.4, 0.5, z1 - z0 + 0.4, '#fbf7f2', M4(fx, h + 0.25, (z0 + z1) / 2));
    K.box(0.14, 3.0, z1 - z0 - 1, '#1b1636', M4(fxo, 1.6, (z0 + z1) / 2));                       // witryna parteru
    K.box(0.16, 0.5, z1 - z0 - 0.6, PAST[(si + 3) % PAST.length], M4(fxo + face * 0.05, 3.3, (z0 + z1) / 2));   // markiza
    for (let y = 4.4; y < h - 1.6; y += 3.2) for (let z = z0 + 1.4; z < z1 - 1; z += 2.2) {
      const lit = rand() < 0.45;
      K.box(0.1, 1.3, 1.0, lit ? (rand() < 0.75 ? '#ffd48a' : '#7fffe0') : '#2a2340', M4(fxo, y + 0.7, z), lit ? 'glow' : 'solid');
    }
    if (h > 12 && rand() < 0.7) K.box(0.5, h * 0.35, 1.2, '#fbf7f2', M4(fxo + face * 0.1, h - h * 0.175 + 1.2, (z0 + z1) / 2));   // pionowa „płetwa” art déco
    if (si >= 0) {
      const [txt, c] = SIGNS[si % SIGNS.length], sg = neonSign(txt, c, { h: 1.3 + rand() * 0.5 });
      sg.position.set(fx + face * 0.25, 5.2 + rand() * 1.5, (z0 + z1) / 2 + (rand() - 0.5) * 3); sg.rotation.y = face < 0 ? -Math.PI / 2 : Math.PI / 2; root.add(sg); signs.push(sg);
    }
  };
  let si = 0;
  for (let z = -160; z < 160;) {                           // pierzeja naprzeciwko witryny
    const w = 14 + rand() * 12, h = 8 + rand() * 14, d = 12 + rand() * 8;
    facade(SX1 + 4.2, z, z + w - 0.6, h, d, PAST[Math.floor(rand() * PAST.length)], -1, Math.abs(z + w / 2) < 90 ? si++ : -1);
    z += w;
  }
  for (const s of [-1, 1]) for (let x = -60; x < 34;) {     // zabudowa za końcami hali (od strony serwisów)
    const w = 12 + rand() * 10, h = 7 + rand() * 9, d = 14;
    const z0 = s * (ZE + 12), col = PAST[Math.floor(rand() * PAST.length)];
    K.box(w - 0.6, h, d, col, M4(x + w / 2, h / 2, z0 + s * d / 2)); K.box(w - 0.4, 0.4, d + 0.4, '#fbf7f2', M4(x + w / 2, h + 0.2, z0 + s * d / 2));
    for (let y = 2.4; y < h - 1; y += 3.2) for (let xx = x + 1.2; xx < x + w - 1.2; xx += 2.2) { const lit = rand() < 0.4; K.box(1.0, 1.2, 0.1, lit ? '#ffd48a' : '#2a2340', M4(xx, y + 0.6, z0 - s * 0.05), lit ? 'glow' : 'solid'); }
    x += w;
  }
  for (let z = -70; z < 70;) {                             // magazyny za halą (zachód)
    const w = 16 + rand() * 14, h = 9 + rand() * 6;
    K.box(18, h, w - 0.8, PAST[Math.floor(rand() * PAST.length)], M4(-40, h / 2, z + w / 2)); K.box(18.4, 0.4, w - 0.4, '#fbf7f2', M4(-40, h + 0.2, z + w / 2));
    z += w;
  }

  // ---- palmy i latarnie ----
  for (let z = -150; z < 150; z += 12 + rand() * 4) addPalm(K, SX1 + 2.6, 0.15, z, 8 + rand() * 4, rand, PC);
  for (const z of [-56, -44, 40, 52, 64, -68]) addPalm(K, 37.6, 0.15, z, 8 + rand() * 4, rand, PC);
  for (const [x, z] of [[-26, -36], [-26, 36], [-27, -10], [-27, 14], [30, -38], [30, 38], [-10, -37], [12, 37]]) addPalm(K, x, 0, z, 7 + rand() * 4, rand, PC);
  for (let z = -150; z < 150; z += 24) for (const [x, dir] of [[37.7, 1], [SX1 + 0.6, -1]]) {
    K.add(new THREE.CylinderGeometry(0.09, 0.13, 7, 6), '#2e2a40', M4(x, 3.5, z));
    K.box(2.4, 0.12, 0.12, '#2e2a40', M4(x + dir * 1.1, 7, z));
    K.box(0.7, 0.14, 0.34, '#ffe9c0', M4(x + dir * 2.2, 6.9, z), 'glow');
  }

  // ---- panorama miasta: wieżowce z oknami i neonowymi koronami ----
  const city = [], wt = windowsTexture(rng(5)), NEON = ['#3ff0e0', '#ff4fd8', '#b06bff', '#fff0f8', '#ff7a5a'];
  for (let i = 0; i < 70; i++) {
    const main = i < 44, az = main ? (rand() - 0.5) * 2.4 : rand() * Math.PI * 2;
    const dist = (main ? 150 : 175) + rand() * 70, x = Math.cos(az) * dist, z = Math.sin(az) * dist;
    const w = 10 + rand() * 14, d = 10 + rand() * 14, h = (main ? 34 : 20) + rand() * (main ? 80 : 36), ry = rand() * 0.5;
    city.push(towerBox(w, h, d, x, -1, z, ry, rand));
    let top = h - 1;
    if (rand() < 0.6) { const h2 = h * (0.15 + rand() * 0.25); city.push(towerBox(w * 0.7, h2, d * 0.7, x, top, z, ry, rand)); top += h2; }
    if (rand() < 0.5) {
      const c = NEON[Math.floor(rand() * NEON.length)], ww = w * (top > h ? 0.7 : 1), dd = d * (top > h ? 0.7 : 1);
      for (const [lx, lz, bw, bd] of [[0, dd / 2, ww, 0.4], [0, -dd / 2, ww, 0.4], [ww / 2, 0, 0.4, dd], [-ww / 2, 0, 0.4, dd]]) {
        const cx = Math.cos(ry), sx = Math.sin(ry);
        K.box(bw + 0.2, 0.6, bd + 0.2, c, M4(x + lx * cx + lz * sx, top + 0.2, z - lx * sx + lz * cx, 0, ry), 'glow');
      }
    }
    if (rand() < 0.35) { K.box(0.5, 8 + rand() * 8, 0.5, '#3a2f4a', M4(x, top + 5, z)); K.box(0.8, 0.8, 0.8, '#ff3a3a', M4(x, top + 10, z), 'glow'); }
  }
  root.add(new THREE.Mesh(mergeGeometries(city, false), new THREE.MeshStandardMaterial({ color: '#3a2c56', roughness: 0.75, metalness: 0.1, emissive: '#ffffff', emissiveMap: wt, emissiveIntensity: 1 })));
  K.meshes(true).forEach((m) => root.add(m));

  // ---- reflektory na parkingu: snopy światła omiatają niebo ----
  const fade = (() => {                                    // snop jasny przy lampie i zanikający ku górze
    const cv = document.createElement('canvas'); cv.width = 4; cv.height = 128; const x = cv.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#7a7a7a'); g.addColorStop(1, '#000000');
    x.fillStyle = g; x.fillRect(0, 0, 4, 128); return new THREE.CanvasTexture(cv);
  })();
  const beams = [], beamMat = new THREE.MeshBasicMaterial({ color: '#fff0d8', alphaMap: fade, transparent: true, opacity: 0.11, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  for (const [x, z, ph] of [[31.5, -31.5, 0], [31.5, 31.5, 2.2]]) {
    const bk = new Kit(); bk.box(1.6, 0.6, 1.2, '#2e2a40', M4(x, 0.5, z)); for (const dz of [-0.5, 0.5]) bk.add(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 10), '#16141c', M4(x - 0.5, 0.3, z + dz, Math.PI / 2));
    bk.add(new THREE.CylinderGeometry(0.45, 0.4, 0.7, 12), '#c9c6d4', M4(x, 1.2, z)); bk.add(new THREE.CircleGeometry(0.4, 12), '#fff6e0', M4(x, 1.56, z, -Math.PI / 2), 'glow');
    bk.meshes(true).forEach((m) => root.add(m));
    const g = new THREE.Group(); g.position.set(x, 1.55, z); g.rotation.order = 'YXZ';
    const geo = new THREE.ConeGeometry(5, 150, 20, 1, true); geo.rotateX(Math.PI); geo.translate(0, 75, 0);
    const beam = new THREE.Mesh(geo, beamMat); beam.renderOrder = 3; g.add(beam); root.add(g); beams.push({ g, beam, ph });
  }

  // ---- ruch na ulicy, helikopter ----
  const traffic = [], TC = ['#ff3f9a', '#19c3d6', '#f4f2f6', '#ffc82e', '#7a3cff', '#e3233a'];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group(), tk = new Kit(), col = TC[i % TC.length];
    car(tk, 0, 0, 0, 0, col, '#2a2340', { muddy: '#2a2633' });
    for (const sx of [-0.6, 0.6]) { tk.box(0.36, 0.16, 0.06, '#fff6e0', M4(sx, 0.72, 2.32), 'glow'); tk.box(0.36, 0.14, 0.06, '#ff2a3a', M4(sx, 0.78, -2.32), 'glow'); }
    tk.meshes(false).forEach((m) => g.add(m));
    const dir = i % 2 ? 1 : -1; g.userData = { lane: dir > 0 ? SX0 + 3.5 / 2 + 0.2 : SX1 - 3.5 / 2 - 0.2, dir, sp: 9 + rand() * 6, off: rand() * 600 };
    g.rotation.y = dir > 0 ? 0 : Math.PI; root.add(g); traffic.push(g);
  }
  const heli = helicopter('#f4efea', '#ff3f7a'); heli.g.scale.setScalar(1.3); root.add(heli.g);
  const flock = birds(8, rand, '#2a1a3a'); flock.forEach((b) => root.add(b));
  // neony w hali, które migoczą (oznaczone w baza-data.js)
  const flick = []; (root.parent || root).traverse((o) => { if (o.userData && o.userData.flicker && o.material) flick.push(o); });

  return {
    sky, fog: FOG, near: 80, far: 430,
    hemi: ['#ffd9ec', '#6a4a7a', 1.35], sun: ['#ffbf8f', 2.5], sunOff, env: sky, envI: 0.6,
    update(t) {
      for (const b of beams) { const a = t * 0.35 + b.ph; b.g.rotation.x = 0.42 + Math.sin(t * 0.5 + b.ph) * 0.12; b.g.rotation.y = Math.sin(a) * 1.1 + Math.PI * 0.3; }
      for (const g of traffic) { const u = g.userData, p = ((t * u.sp + u.off) % 600) - 300; g.position.set(u.lane, 0, u.dir * p); }
      const ha = t * 0.08; heli.g.position.set(70 + Math.cos(ha) * 70, 36 + Math.sin(t * 0.4) * 3, Math.sin(ha) * 80); heli.g.rotation.set(0.08, -ha - Math.PI, 0.12);
      heli.rotor.rotation.y = t * 28; heli.tail.rotation.x = t * 40; heli.light.visible = Math.sin(t * 6) > 0.6;
      flock.forEach((b) => { const u = b.userData, a = u.a + t * 0.18 * u.s; b.position.set(80 + Math.cos(a) * 30 * u.r, 26 + u.h, Math.sin(a) * 40 * u.r); b.rotation.y = -a; b.scale.set(1, Math.sin(t * 9 + u.ph), 1); });
      signs.forEach((s, i) => { if (i % 4 === 1) s.material.opacity = Math.sin(t * 23 + i) > -0.92 && (t % 7 > 0.35) ? 1 : 0.25; });
      flick.forEach((s, i) => { s.material.opacity = (t + i * 2.3) % 9 < 0.5 && Math.sin(t * 31) > 0 ? 0.3 : 1; });
    },
  };
}

// ======================================================================================================
//                                    OAZA → BAGNO (mokradła w upale)
// ======================================================================================================
function themeSwamp(M, root, meshes, ground) {
  const rand = rng(1977), WL = -0.15;
  const sunOff = V3(-20, 30, 13);
  const FOG = '#c9d0b4';
  const sky = skyTexture({
    stops: [[90, '#4f8fcf'], [45, '#73a8da'], [20, '#a6c8e2'], [7, '#d4e0dc'], [0, FOG], [-8, '#8f9a76'], [-90, '#3c4630']],
    sun: { dir: sunOff.clone().normalize(), r: 26, disc: '#fffbe8', glow: [[420, 'rgba(255,250,220,.35)'], [130, 'rgba(255,252,236,.85)']] },
    paint: (x, W, H, px, wrap) => {
      const r = rng(31);
      for (let i = 0; i < 60; i++) {                         // kłębiaste chmury z płaskim spodem
        const el = 3 + r() * 16, cy = elevY(H, el), cx = r() * W, s = (0.5 + r() * 0.9) * (1 - el / 50), puffs = [];
        for (let k = 0; k < 7; k++) { const br = (10 + r() * 13) * s; puffs.push([(k - 3) * 12 * s + (r() - 0.5) * 8 * s, br, cy - br * 0.25 - r() * 5 * s, 0.75 + r() * 0.2]); }
        wrap((o) => {
          x.save(); x.beginPath(); x.rect(cx + o - 120 * s, 0, 240 * s, cy); x.clip();
          for (const [dx, br, by, al] of puffs) { x.fillStyle = `rgba(255,255,255,${al})`; x.beginPath(); x.arc(cx + o + dx, by, br, 0, Math.PI * 2); x.fill(); }
          x.restore();
        });
      }
    },
  });

  recolor(meshes, {
    M_plaster: '#7f9a8c', M_plaster2: '#9b8461', M_plaster3: '#a49c8a', M_trim: '#5e4e3a',
    M_brick: '#5a4e3c', M_brick2: '#4a4032', M_blueTrim: '#3f6f6a',
    M_terracotta: '#7c5a3e', M_terracotta2: '#6a4630', M_cloth: '#8a3b2c',
    M_tarp: '#6a7044', M_tarpDark: '#525834',
    M_tileLight: '#7d7a5e', M_tileMid: '#66654c', M_tileDark: '#3d4234', M_stone: '#6e6b58',
    M_grass: '#5d7a2e', M_bush: '#3f5d24', M_cactus: '#35522a', M_agave: '#4e6a2c',
    M_leaf: '#5b7f2a', M_leafDark: '#34561c', M_soil: '#3b2e1e',
    M_wood: '#5a4030', M_woodLight: '#6e5038', M_woodDark: '#3a2a1e', M_beam: '#3e2c20', M_shutter: '#33403a',
  });

  floodWalls(meshes, ['M_plaster', 'M_plaster2', 'M_plaster3']);

  // ---- teren: miasteczko na grząskiej wyspie, wydmy → porośnięte wysepki w płytkiej wodzie ----
  const inTown = (x, z) => Math.abs(x) <= 31 && Math.abs(z) <= 45;
  const gcol = (x, z, y, i) => {
    const v = ((i * 2654435761) >>> 0) % 100 / 100;
    if (inTown(x, z)) return v < 0.5 ? '#76674a' : '#6e6044';
    if (y < -0.25) return '#3a3a24';
    if (y < 0.5) return v < 0.5 ? '#5d5436' : '#665c3a';
    if (y < 2) return v < 0.5 ? '#6f8a3c' : '#62803a';
    return v < 0.33 ? '#557a2e' : v < 0.66 ? '#4c6e2a' : '#5f8434';
  };
  reshapeGround(ground, (x, z, y) => (inTown(x, z) ? y : y * 0.22 - 0.9), gcol);
  const water = makeWater({ y: WL, color: '#3b4a24', rough: 0.2, metal: 0.18, env: sky, envI: 0.5, amp: 0.035, freq: 0.3, speed: 0.6, opacity: 0.95 });
  root.add(water.mesh);

  const occ = occupancy(meshes, ground), gy = groundProbe(ground), K = new Kit();
  const PC = { trunk: '#5b4a3a', trunk2: '#4e4032', leaf: '#4f7a2a', leaf2: '#3c6222', nut: '#4a3a24' };
  const farTown = (x, z, m) => Math.abs(x) > 31 + m || Math.abs(z) > 45 + m;

  // ---- cyprysy z mchem i palmy sabałowe na brzegach ----
  let n = 0;
  for (let i = 0; i < 1400 && n < 60; i++) {
    const a = rand() * Math.PI * 2, d = 40 + rand() * 120, x = Math.cos(a) * d, z = Math.sin(a) * d * 1.15;
    if (!farTown(x, z, 4) || !occ.free(x, z, 3)) continue;
    const h = gy(x, z); if (h < -1.2 || h > 3.5) continue;
    if (rand() < 0.78) addCypress(K, x, Math.max(h, WL), z, 9 + rand() * 7, rand); else addPalm(K, x, Math.max(h, WL), z, 6 + rand() * 4, rand, PC);
    n++;
  }
  // ---- trzciny przy brzegu i pod murami ----
  let r = 0;
  for (let i = 0; i < 4000 && r < 190; i++) {
    const a = rand() * Math.PI * 2, d = 30 + rand() * 75, x = Math.cos(a) * d, z = Math.sin(a) * d * 1.2;
    if (!farTown(x, z, 0.5) || !occ.free(x, z, 1)) continue;
    const h = gy(x, z); if (h < -0.75 || h > 0.9) continue;
    addReeds(K, x, Math.max(h, WL), z, rand, 6 + Math.floor(rand() * 8)); r++;
  }
  // ---- lilie wodne, rzęsa i kamienie ----
  let l = 0;
  for (let i = 0; i < 4000 && l < 260; i++) {
    const a = rand() * Math.PI * 2, d = 33 + rand() * 80, x = Math.cos(a) * d, z = Math.sin(a) * d * 1.2;
    if (!farTown(x, z, 1)) continue; if (gy(x, z) > WL - 0.15) continue;
    if (rand() < 0.8) addLily(K, x, WL + 0.04, z, rand);
    else { const rr = 0.7 + rand() * 1.1; K.add(jitter(new THREE.CircleGeometry(rr, 9), rr * 0.5, rand), '#6a8a34', M4(x, WL + 0.03, z, -Math.PI / 2, rand() * 6, 0, 1, 0.6 + rand() * 0.6, 1)); }
    l++;
  }
  for (let i = 0; i < 40; i++) { const a = rand() * 6.28, d = 36 + rand() * 60, x = Math.cos(a) * d, z = Math.sin(a) * d * 1.2; if (farTown(x, z, 1) && occ.free(x, z, 2)) addRock(K, x, gy(x, z), z, 0.5 + rand() * 0.9, rand, rand() < 0.5 ? '#6d6a58' : '#5a5f48'); }

  // ---- kałuże na placach miasteczka (płasko na ziemi – nic nie zasłaniają) ----
  const pud = new Kit();
  let p = 0;
  for (let i = 0; i < 3000 && p < 42; i++) {
    const x = (rand() * 2 - 1) * 26, z = (rand() * 2 - 1) * 40, rr = 0.6 + rand() * 1.1;
    if (!occ.free(x, z, 1)) continue;
    if (Math.abs(gy(x, z)) > 0.05) continue;
    const g = new THREE.CircleGeometry(rr, 14), gp = g.attributes.position;           // brzeg lekko nieregularny, środek płaski
    const ph = rand() * 6; for (let k = 1; k < gp.count; k++) { const j = ((k - 1) % 14) * (Math.PI * 2 / 14), f = 1 + 0.13 * Math.sin(j * 2 + ph) + 0.08 * Math.sin(j * 3 + ph * 2); gp.setXY(k, gp.getX(k) * f, gp.getY(k) * f); }
    pud.add(g, '#2f3826', M4(x, 0.028, z, -Math.PI / 2, rand() * 6, 0, 1, 0.55 + rand() * 0.5, 1)); p++;
  }
  // kępki trawy pod murami (niskie, nic nie zasłaniają)
  let tf = 0;
  for (let i = 0; i < 6000 && tf < 160; i++) {
    const x = (rand() * 2 - 1) * 27, z = (rand() * 2 - 1) * 41;
    if (occ.at(x, z) > 0 || occ.free(x, z, 1) || Math.abs(gy(x, z)) > 0.05) continue;
    addReeds(K, x, 0.1, z, rand, 4 + Math.floor(rand() * 4), 0.42); tf++;
  }
  const pudGeo = pud.geometry('solid');
  if (pudGeo) {
    const pm = new THREE.Mesh(pudGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.1, metalness: 0.2, envMap: sky, envMapIntensity: 0.55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    pm.receiveShadow = true; root.add(pm);
  }

  // ---- łódź ślizgowa, pickup i radiowóz na brzegu ----
  const spot = (minD, maxD, lo, hi, seed) => {
    const rr = rng(seed);
    for (let i = 0; i < 3000; i++) { const a = rr() * 6.28, d = minD + rr() * (maxD - minD), x = Math.cos(a) * d, z = Math.sin(a) * d * 1.2; if (!farTown(x, z, 3) || !occ.free(x, z, 4)) continue; const h = gy(x, z); if (h >= lo && h <= hi) return [x, h, z, a]; }
    return null;
  };
  const ab = spot(36, 60, -3, WL - 0.4, 3); if (ab) airboat(K, ab[0], WL + 0.05, ab[2], ab[3] + 1.4);
  const pk = spot(34, 70, -0.1, 0.7, 8); if (pk) car(K, pk[0], pk[1], pk[2], pk[3] + 2.2, '#6b6a52', '#5c5b46', { pickup: true });
  const pc = spot(34, 70, -0.1, 0.7, 21); let bar = null;
  if (pc) {
    car(K, pc[0], pc[1], pc[2], pc[3] - 0.6, '#e8e8e4', '#24262c');
    const bk = new Kit(); bk.box(0.6, 0.18, 0.35, '#ff2a2a', M4(-0.35, 0, 0), 'glow'); const bk2 = new Kit(); bk2.box(0.6, 0.18, 0.35, '#2a5cff', M4(0.35, 0, 0), 'glow');
    const { GLOW } = mats(); bar = [new THREE.Mesh(bk.geometry('glow'), GLOW), new THREE.Mesh(bk2.geometry('glow'), GLOW)];
    bar.forEach((b) => { b.position.set(pc[0], pc[1] + 1.9, pc[2]); b.rotation.y = pc[3] - 0.6; root.add(b); });
  }

  // ---- aligatory: pływają po kółku (te na brzegu się wygrzewają) ----
  const gGeo = gatorGeometry(1.25), { SOLID } = mats(), gators = [];
  for (let i = 0; i < 6; i++) {
    const s = spot(38, 90, -3, -0.7, 100 + i * 7); if (!s) continue;
    const m = new THREE.Mesh(gGeo, SOLID); m.castShadow = true; m.userData = { cx: s[0], cz: s[2], r: 2.5 + rand() * 3.5, a: rand() * 6.28, sp: (rand() < 0.5 ? -1 : 1) * (0.05 + rand() * 0.06) };
    root.add(m); gators.push(m);
  }
  for (let i = 0; i < 3; i++) { const s = spot(36, 80, 0, 0.8, 300 + i * 13); if (!s) continue; const m = new THREE.Mesh(gGeo, SOLID); m.castShadow = true; m.position.set(s[0], s[1] + 0.12, s[2]); m.rotation.y = s[3]; root.add(m); }

  K.meshes(true).forEach((m) => root.add(m));

  const heli = helicopter('#2c3a2a', '#d8d2b0'); heli.g.scale.setScalar(1.25); root.add(heli.g);
  const flock = birds(14, rand, '#f2f0e8'); flock.forEach((b) => root.add(b));
  return {
    sky, fog: FOG, near: 32, far: 230,
    hemi: ['#dbe8f2', '#56603a', 1.25], sun: ['#fff0cc', 2.45], sunOff, env: sky, envI: 0.45,
    update(t, dt) {
      water.tick(t);
      for (const g of gators) { const u = g.userData, a = u.a + t * u.sp; g.position.set(u.cx + Math.cos(a) * u.r, WL - 0.05 + Math.sin(t * 0.8 + u.a) * 0.03, u.cz + Math.sin(a) * u.r); g.rotation.y = -a + (u.sp > 0 ? Math.PI : 0); }
      const ha = t * 0.05; heli.g.position.set(-60 + Math.cos(ha) * 90, 38 + Math.sin(t * 0.5) * 2, 80 + Math.sin(ha) * 60); heli.g.rotation.set(0.1, -ha - Math.PI, 0.1);
      heli.rotor.rotation.y = t * 28; heli.tail.rotation.x = t * 40; heli.light.visible = Math.sin(t * 6) > 0.6;
      if (bar) { const k = Math.floor(t * 4) % 2; bar[0].visible = !!k; bar[1].visible = !k; }
      flock.forEach((b) => { const u = b.userData, a = u.a + t * 0.13 * u.s; b.position.set(-40 + Math.cos(a) * 34 * u.r, 22 + u.h, -50 + Math.sin(a) * 24 * u.r); b.rotation.y = -a; b.scale.set(1.3, 1.3 * Math.sin(t * 7 + u.ph), 1.3); });
    },
  };
}

// ======================================================================================================
//                    MAGAZYN → JACHTY (dwa jachty na otwartym morzu w słoneczny dzień)
// ======================================================================================================
// Mapa i kolizje: magazyn-data.js. Tu tylko otoczenie: niebo z kłębiastymi chmurami, głębokie morze z falami,
// piana wokół kadłubów, boje, wysepki z palmami, miasto na horyzoncie, przepływający jacht i mewy.
function themeYachts(M, root) {
  const rand = rng(20261120), { CX, HALF, STERN, BOW, WL, GATE_BOAT } = YACHT;
  const sunOff = V3(16, 30, -12);
  const sunDir = sunOff.clone().normalize();
  const FOG = '#cfe6f4';
  const sky = skyTexture({
    stops: [[90, '#1f63c4'], [60, '#2f7ad6'], [35, '#549dea'], [18, '#86bff2'], [8, '#b5daf7'], [2, '#dcefff'], [0, '#e9f5fc'], [-2, FOG], [-15, '#3d7fb5'], [-90, '#163a66']],
    sun: { dir: sunDir, r: 22, disc: '#fffdf2', glow: [[420, 'rgba(255,255,240,.28)'], [160, 'rgba(255,252,230,.55)'], [60, 'rgba(255,255,248,.95)']] },
    paint: (x, W, H, px, wrap) => {
      const r = rng(311);
      // kłębiaste cumulusy nisko nad horyzontem (jak na zdjęciu) i rzadkie pierzaste smugi wyżej
      for (let i = 0; i < 26; i++) {
        const cx = r() * W, el = 2 + r() * 9, cy = elevY(H, el), w = 60 + r() * 170, n = 5 + Math.floor(r() * 6);
        for (let k = 0; k < n; k++) {
          const ox = (k / (n - 1) - 0.5) * w, rr = (14 + r() * 26) * (1 - Math.abs(k / (n - 1) - 0.5)), oy = -rr * (0.3 + r() * 0.5);
          wrap((o) => {
            x.fillStyle = 'rgba(190,210,230,.55)'; x.beginPath(); x.arc(cx + ox + o, cy + oy + rr * 0.25, rr, 0, Math.PI * 2); x.fill();   // cień pod spodem
            x.fillStyle = 'rgba(255,255,255,.92)'; x.beginPath(); x.arc(cx + ox + o, cy + oy, rr, 0, Math.PI * 2); x.fill();
          });
        }
        wrap((o) => { x.fillStyle = 'rgba(220,234,246,.9)'; x.fillRect(cx - w / 2 - 20 + o, cy - 2, w + 40, 6); });
      }
      for (let i = 0; i < 18; i++) {
        const el = 25 + r() * 40, y = elevY(H, el), cx = r() * W, w = 200 + r() * 420;
        x.fillStyle = `rgba(255,255,255,${0.12 + r() * 0.18})`; wrap((o) => { x.beginPath(); x.ellipse(cx + o, y, w / 2, 3 + r() * 6, -0.05, 0, Math.PI * 2); x.fill(); });
      }
    },
  });

  // ---- morze ----
  const water = makeWater({ y: WL, color: '#1d5a9a', rough: 0.22, metal: 0.35, env: sky, envI: 0.95, amp: 0.13, freq: 0.16, speed: 0.9 });
  root.add(water.mesh);
  const K = new Kit();
  // piana wzdłuż kadłubów (biały postrzępiony pas przy linii wody) i przy motorówce
  const foam = (pts, w) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bz - az, dz = -(bx - ax), l = Math.hypot(dx, dz) || 1, wa = w * (0.6 + rand() * 0.8), wb = w * (0.6 + rand() * 0.8);
      const A = V3(ax, WL + 0.12, az), B = V3(bx, WL + 0.12, bz), A2 = V3(ax + dx / l * wa, WL + 0.1, az + dz / l * wa), B2 = V3(bx + dx / l * wb, WL + 0.1, bz + dz / l * wb);
      K.tris([A, B, B2, A, B2, A2], i % 3 ? '#f4fbff' : '#d9eefb');
    }
  };
  for (const c of [-CX, CX]) for (const sx of [-1, 1]) {
    const pts = []; for (let z = STERN; z <= BOW - 1; z += 0.5) pts.push([c + sx * yachtHalf(z) * 0.95, z]);
    foam(sx > 0 ? pts : pts.reverse(), 0.8);
  }
  for (const c of [-CX, CX]) foam([[c + HALF * 0.95, STERN - 0.1], [c - HALF * 0.95, STERN - 0.1]], 1.2);
  const bx = CX - HALF; foam([[-bx, GATE_BOAT[0] - 0.05], [bx, GATE_BOAT[0] - 0.05]], 0.5); foam([[bx, GATE_BOAT[1] + 0.05], [-bx, GATE_BOAT[1] + 0.05]], 0.5);
  // boje dookoła (czerwone i białe) – daleko od pokładów, kule ich nie widzą
  const buoys = [];
  for (const [x, z, col] of [[-30, -34, '#e2343c'], [30, -34, '#f4f4f0'], [-32, 34, '#f4f4f0'], [32, 34, '#e2343c'], [0, -40, '#ff8a3d'], [0, 40, '#ff8a3d']]) {
    const b = new THREE.Group(), bk = new Kit();
    bk.add(new THREE.CylinderGeometry(0.5, 0.75, 1.1, 8), col, M4(0, 0.2, 0)); bk.add(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 6), '#333a44', M4(0, 1.3, 0));
    bk.add(new THREE.ConeGeometry(0.28, 0.45, 6), col, M4(0, 2.1, 0)); bk.meshes(true).forEach((m) => b.add(m));
    b.position.set(x, WL, z); b.userData = { ph: rand() * 6.28 }; root.add(b); buoys.push(b);
  }
  // ---- wysepki z palmami i plażą (daleko, za mgiełką) ----
  const PC = { trunk: '#8a6a4c', trunk2: '#7a5a40', leaf: '#2f9a52', leaf2: '#24804a', nut: '#5a3a24' };
  for (const [x, z, r] of [[-150, 120, 26], [-210, -60, 18], [170, 160, 34], [230, -140, 22], [60, 260, 40], [-90, -230, 28]]) {
    const sand = jitter(new THREE.IcosahedronGeometry(1, 2), 0.18, rand); sand.scale(r, r * 0.16, r * 0.8);
    K.add(sand, '#f1dfb0', M4(x, WL - 0.6, z));
    const hill = jitter(new THREE.IcosahedronGeometry(1, 1), 0.25, rand); hill.scale(r * 0.6, r * 0.32, r * 0.45);
    K.add(hill, '#4fa45a', M4(x + r * 0.1, WL + 0.6, z));
    const n = Math.round(r / 4);
    for (let i = 0; i < n; i++) { const a = rand() * 6.28, d = r * (0.25 + rand() * 0.5); addPalm(K, x + Math.cos(a) * d, WL + r * 0.12, z + Math.sin(a) * d * 0.8, 6 + rand() * 6, rand, PC); }
  }
  // latarnia morska na jednej z wysp
  K.add(new THREE.CylinderGeometry(1.4, 2.0, 16, 10), '#f6f2ea', M4(-150, WL + 10, 120)); K.add(new THREE.CylinderGeometry(1.45, 1.45, 3, 10), '#e2343c', M4(-150, WL + 6, 120));
  K.add(new THREE.CylinderGeometry(1.45, 1.45, 3, 10), '#e2343c', M4(-150, WL + 12, 120)); K.add(new THREE.CylinderGeometry(1.1, 1.1, 1.6, 10), '#ffe8a0', M4(-150, WL + 18.8, 120), 'glow');
  K.add(new THREE.ConeGeometry(1.6, 1.8, 10), '#e2343c', M4(-150, WL + 20.5, 120));
  // ---- miasto na horyzoncie (pastelowe wieżowce, jak Vice City z daleka) ----
  const TOW = ['#f3e3cf', '#d9ecf2', '#f6d2dc', '#cfe5e0', '#e8e2f4', '#fdf2df', '#bcd6ea'];
  for (let i = 0; i < 46; i++) {
    const a = -0.55 + (i / 45) * 1.1 + (rand() - 0.5) * 0.02, d = 420 + rand() * 60, w = 10 + rand() * 18, h = 20 + rand() * 70 * (1 - Math.abs(a) * 0.9);
    K.box(w, h, w, TOW[Math.floor(rand() * TOW.length)], M4(Math.sin(a) * d, WL + h / 2, Math.cos(a) * d, a));
    if (rand() < 0.3) K.box(w * 0.5, h * 0.25, w * 0.5, TOW[Math.floor(rand() * TOW.length)], M4(Math.sin(a) * d, WL + h + h * 0.12, Math.cos(a) * d, a));
  }
  K.meshes(false).forEach((m) => root.add(m));
  // ---- przepływający w oddali jacht i skuter z kilwaterem ----
  const far = new THREE.Group(); {
    const fk = new Kit();
    fk.box(4, 1.6, 18, '#f4f6f8', M4(0, 0.6, 0)); fk.box(3.2, 1.4, 9, '#f4f6f8', M4(0, 2.1, -1)); fk.box(3.25, 0.6, 7, '#0e1622', M4(0, 2.2, -0.5));
    fk.box(2.6, 1.0, 4, '#f4f6f8', M4(0, 3.3, -2)); fk.add(new THREE.ConeGeometry(2, 5, 4), '#f4f6f8', M4(0, 0.6, 11, Math.PI / 4, Math.PI / 2, 0, 1, 1, 0.55));
    fk.tris([V3(-2, 0.05, -9), V3(2, 0.05, -9), V3(9, 0.03, -45), V3(-2, 0.05, -9), V3(9, 0.03, -45), V3(-9, 0.03, -45)], '#e4f2fb');
    fk.meshes(false).forEach((m) => far.add(m));
  }
  root.add(far);
  const ski = new THREE.Group(); {
    const sk = new Kit(); sk.box(0.9, 0.5, 2.6, '#ff2e93', M4(0, 0.25, 0)); sk.box(0.5, 0.5, 0.8, '#1b1f26', M4(0, 0.7, -0.3));
    sk.tris([V3(-0.4, 0.04, -1.3), V3(0.4, 0.04, -1.3), V3(2.2, 0.02, -12), V3(-0.4, 0.04, -1.3), V3(2.2, 0.02, -12), V3(-2.2, 0.02, -12)], '#eef7fd');
    sk.meshes(false).forEach((m) => ski.add(m));
  }
  root.add(ski);
  const flock = birds(10, rand, '#f2f4f6'); flock.forEach((b) => root.add(b));
  return {
    sky, fog: FOG, near: 90, far: 560,
    hemi: ['#e6f3ff', '#9cbdd6', 1.35], sun: ['#fff6e6', 3.2], sunOff, env: sky, envI: 0.75,
    update(t) {
      water.tick(t);
      buoys.forEach((b) => { const p = b.userData.ph; b.position.y = WL + Math.sin(t * 1.3 + p) * 0.15; b.rotation.set(Math.sin(t * 1.1 + p) * 0.12, 0, Math.cos(t * 0.9 + p) * 0.12); });
      const fa = t * 0.012; far.position.set(Math.cos(fa) * 190, WL + Math.sin(t * 0.8) * 0.1, Math.sin(fa) * 190); far.rotation.y = -fa + Math.PI;
      const sa = t * 0.09; ski.position.set(Math.cos(sa) * 60, WL + 0.1 + Math.sin(t * 3) * 0.06, 4 + Math.sin(sa) * 46); ski.rotation.set(0, -sa + Math.PI, Math.sin(t * 2) * 0.08);
      flock.forEach((b) => { const u = b.userData, a = u.a + t * 0.22 * u.s; b.position.set(Math.cos(a) * 38 * u.r, 20 + u.h, Math.sin(a) * 34 * u.r); b.rotation.y = -a; b.scale.set(1, Math.sin(t * 8 + u.ph), 1); });
    },
  };
}
const THEMES = { Baza: themeDealer, Oaza: themeSwamp, Magazyn: themeYachts };

// ======================================================================================================
//   createClimates: dekorowanie map po wczytaniu + przełączanie nieba, mgły i świateł przy zmianie mapy
// ======================================================================================================
export function createClimates({ scene, hemi, sun }) {
  const base = {
    sky: scene.background, fog: scene.fog.color.clone(), near: scene.fog.near, far: scene.fog.far,
    hemi: [hemi.color.clone(), hemi.groundColor.clone(), hemi.intensity], sun: [sun.color.clone(), sun.intensity],
    sunOff: V3(14, 26, 10), env: scene.environment, envI: scene.environmentIntensity, update() {},
  };
  const themes = {};
  const sunOff = base.sunOff.clone();
  let cur = null, curName = null, t = 0;
  return {
    sunOff,
    get current() { return curName; },
    decorate(M, root) {
      const fn = THEMES[M.name]; if (!fn) return;
      const ground = M.meshes.find((o) => /^(M_sand|M_groundOut)$/.test(o.material && o.material.name)) || M.ground;
      const deco = new THREE.Group(); deco.name = 'Klimat'; root.add(deco);
      themes[M.name] = fn(M, deco, M.meshes, ground);
    },
    use(name) {
      const T = (name && themes[name]) || null;
      if (T === cur && name === curName) return;
      cur = T; curName = T ? name : null;
      const A = T || base;
      scene.background = A.sky;
      scene.fog.color.set(A.fog); scene.fog.near = A.near; scene.fog.far = A.far;
      hemi.color.set(A.hemi[0]); hemi.groundColor.set(A.hemi[1]); hemi.intensity = A.hemi[2];
      sun.color.set(A.sun[0]); sun.intensity = A.sun[1]; sunOff.copy(A.sunOff);
      scene.environment = A.env; scene.environmentIntensity = A.envI;
    },
    // pełny stan nieba i świateł (miniatury map renderują się w klimacie mapy, a potem wszystko wraca – też niebo Strzelnicy)
    save() {
      return { bg: scene.background, fog: [scene.fog.color.clone(), scene.fog.near, scene.fog.far], hemi: [hemi.color.clone(), hemi.groundColor.clone(), hemi.intensity],
        sun: [sun.color.clone(), sun.intensity], off: sunOff.clone(), env: scene.environment, envI: scene.environmentIntensity, cur, curName };
    },
    restore(s) {
      scene.background = s.bg; scene.fog.color.copy(s.fog[0]); scene.fog.near = s.fog[1]; scene.fog.far = s.fog[2];
      hemi.color.copy(s.hemi[0]); hemi.groundColor.copy(s.hemi[1]); hemi.intensity = s.hemi[2];
      sun.color.copy(s.sun[0]); sun.intensity = s.sun[1]; sunOff.copy(s.off);
      scene.environment = s.env; scene.environmentIntensity = s.envI; cur = s.cur; curName = s.curName;
    },
    update(dt) { t += dt; if (cur) cur.update(t, dt); },
  };
}
