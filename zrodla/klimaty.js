// Klimaty map 1v1 – tylko grafika. Kolizje, spawny, drabiny i wszystko, co liczy serwer meczów, zostają bez zmian.
//  • Baza → „Salon”: salon luksusowych aut wieczorem (zachód słońca, ulica z ruchem, kamienice z neonami, palmy, reflektory na niebie)
//  • Oaza → „Bagno”: złote, wilgotne popołudnie nad przystanią na bagnie (woda, mgiełka, panorama miasta, ptaki, helikopter, aligatory);
//    sama mapa (sklepik na palach, pomosty, hydroplany, drzewa) jest budowana w kodzie: zrodla/bagno-scena.js + dane w zrodla/oaza-data.js
//  • Iglo → „Igloo”: mroźne, słoneczne popołudnie nad zamarzniętym jeziorem (góry, padający śnieg, kruki);
//    mapa (iglo, chaty, łódź w lodzie, grań) jest budowana w kodzie: zrodla/iglo-scena.js + dane w zrodla/iglo-data.js
//  • Kaskady → „Kaskady”: jesienna wyspa-diorama nad morzem chmur w złotym popołudniu (latające wysepki, spadające liście, ptaki);
//    mapa (tarasy z rudej ziemi, wodospad, staw, warownia, krąg kamieni) jest budowana w kodzie: zrodla/kaskady-scena.js + dane w zrodla/kaskady-data.js
//  • Mars → „Mars”: zakurzone marsjańskie popołudnie nad lewitującą wyspą (księżyce, dalekie wyspy, pył, wir pyłowy, dron);
//    mapa (moduł HAB-01, szklarnia, łazik, iglice) jest budowana w kodzie: zrodla/mars-scena.js + dane w zrodla/mars-data.js
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

function addLily(K, x, y, z, rand, G = ['#4f7a2e', '#5f8a36'], F = ['#f4a6c8', '#f6f1e6'], pf = 0.22) {
  const r = 0.35 + rand() * 0.45, cut = 0.5;
  K.add(new THREE.CircleGeometry(r, 8, cut / 2, Math.PI * 2 - cut), G[Math.floor(rand() * G.length)], M4(x, y, z, -Math.PI / 2, rand() * 6, 0));
  if (rand() < pf) K.add(new THREE.ConeGeometry(0.13, 0.18, 6), F[Math.floor(rand() * F.length)], M4(x, y + 0.08, z, Math.PI));
}

// szuwary: gęsta kępa trzcin i pałek wodnych (brązowe kolby), czasem kwitnący kosaciec albo krwawnica
const REED_G = ['#6fae2e', '#86c23a', '#5a9a26', '#9cc84a', '#4e8a22', '#b5c75a'];
function addRushes(K, x, y, z, rand, n = 22, hmax = 2.6, rad = 1.6, flowers = true) {
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * rad, bx = x + Math.cos(a) * r, bz = z + Math.sin(a) * r;
    const h = hmax * (0.5 + rand() * 0.5) * (1 - 0.35 * (r / rad));
    const la = rand() * Math.PI * 2, lean = 0.08 + rand() * 0.3, tip = V3(bx + Math.cos(la) * lean, y + h, bz + Math.sin(la) * lean);
    const s = V3(-Math.sin(la), 0, Math.cos(la)).multiplyScalar(0.045 + rand() * 0.03);
    K.tris([V3(bx - s.x, y - 0.15, bz - s.z), V3(bx + s.x, y - 0.15, bz + s.z), tip], REED_G[Math.floor(rand() * REED_G.length)]);
    if (hmax > 1.2 && rand() < 0.22) {                                                // pałka wodna (tylko w wysokich szuwarach)
      const k = 0.78 + rand() * 0.08, cx = bx + (tip.x - bx) * k, cz = bz + (tip.z - bz) * k, cy = y + h * k;
      K.add(new THREE.CylinderGeometry(0.07, 0.07, 0.38, 4), rand() < 0.5 ? '#6a3a1c' : '#7a4524', M4(cx, cy, cz, 0, 0, lean * 0.6));
    }
  }
  if (flowers && rand() < 0.55) {
    const iris = rand() < 0.55;
    for (let k = 0, m = 2 + Math.floor(rand() * 4); k < m; k++) {
      const a = rand() * Math.PI * 2, r = rad * (0.7 + rand() * 0.5), fx = x + Math.cos(a) * r, fz = z + Math.sin(a) * r, fh = 0.7 + rand() * 0.5;
      K.add(new THREE.CylinderGeometry(0.025, 0.035, fh, 4), '#4e8a22', M4(fx, y + fh / 2 - 0.1, fz));
      if (iris) K.add(new THREE.ConeGeometry(0.16, 0.22, 5), rand() < 0.75 ? '#ffd23a' : '#ffe680', M4(fx, y + fh, fz, Math.PI));          // żółty kosaciec
      else K.add(new THREE.ConeGeometry(0.07, 0.5, 5), rand() < 0.6 ? '#c04ad8' : '#e46ab8', M4(fx, y + fh + 0.1, fz));                  // krwawnica (fioletowy kłos)
    }
  }
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
  const rd = rng(4242);                                     // osobny los dla detali fasad (układ kamienic i szyldów bez zmian)
  const signs = [], SIGNS = [['MOTEL', '#ff4fd8'], ['DINER', '#3ff0e0'], ['ARCADE', '#b06bff'], ['TACOS', '#ffd23f'], ['HOTEL', '#ff4fd8'], ['DISCO', '#3ff0e0'], ['SURF SHOP', '#ff7a5a'], ['BEAN CLUB', '#b06bff'], ['PAWN', '#ffd23f'], ['GYM', '#3ff0e0'], ['TATTOO', '#ff4fd8'], ['PIZZA', '#ff7a5a']];
  const facade = (x0, z0, z1, h, d, col, face, si) => {      // face = -1: front w stronę -X (do ulicy), +1: w stronę +X
    const fx = face < 0 ? x0 : x0 + d;
    K.box(d, h, z1 - z0, col, M4(x0 + d / 2, h / 2, (z0 + z1) / 2));
    const fxo = fx + face * 0.06;
    for (let y = 3.6; y < h - 1; y += 3.2) K.box(0.12, 0.22, z1 - z0 + 0.2, '#fbf7f2', M4(fxo, y, (z0 + z1) / 2));
    K.box(0.4, 0.5, z1 - z0 + 0.4, '#fbf7f2', M4(fx, h + 0.25, (z0 + z1) / 2));
    K.box(0.14, 3.0, z1 - z0 - 1, '#1b1636', M4(fxo, 1.6, (z0 + z1) / 2));                       // witryna parteru
    const zc = (z0 + z1) / 2, L = z1 - z0, aw = PAST[(si + 3 + PAST.length) % PAST.length];
    for (let i = 0, n = Math.max(2, Math.round((L - 0.6) / 0.9)); i < n; i++) {                 // markiza w pasy, skośna
      const a = z0 + 0.3 + (i * (L - 0.6)) / n, b = z0 + 0.3 + ((i + 1) * (L - 0.6)) / n;
      K.box(1.25, 0.06, b - a, i % 2 ? '#fbf7f2' : aw, M4(fxo + face * 0.6, 3.25, (a + b) / 2, 0, 0, -face * 0.38));
    }
    for (let z = z0 + 1.1; z < z1 - 0.9; z += 1.7) K.box(0.2, 3.0, 0.1, '#fbf7f2', M4(fxo + face * 0.03, 1.6, z));   // szprosy witryn
    K.box(0.3, 0.12, L - 0.8, '#fbf7f2', M4(fxo + face * 0.08, 0.06, zc));                                         // cokół witryn
    if (h > 10) for (let y = 3.6 + 3.2; y < h - 2.5; y += 6.4) {                                                    // balkony co drugie piętro
      K.box(0.95, 0.14, L - 2.4, '#fbf7f2', M4(fx + face * 0.48, y, zc));
      K.box(0.05, 0.85, L - 2.4, '#2e2a40', M4(fx + face * 0.93, y + 0.5, zc));
      K.box(0.06, 0.06, L - 2.4, '#fbf7f2', M4(fx + face * 0.93, y + 0.95, zc));
    }
    for (let i = 0, n = 1 + Math.floor(rd() * 3); i < n; i++) K.box(1.3, 0.9, 1.1, '#c9c6d4', M4(x0 + d * (0.25 + rd() * 0.5), h + 0.95, z0 + 1.5 + rd() * (L - 3)));   // klimatyzatory na dachu
    if (rd() < 0.45) { const tx = x0 + d * 0.6, tz = z0 + 1.5 + rd() * (L - 3);                                // drewniany zbiornik na wodę
      K.add(new THREE.CylinderGeometry(1.0, 1.0, 1.8, 10), '#8a6a4c', M4(tx, h + 2.4, tz)); K.add(new THREE.ConeGeometry(1.1, 0.6, 10), '#5a4a5e', M4(tx, h + 3.6, tz));
      for (const [ox, oz] of [[0.6, 0.6], [-0.6, 0.6], [0.6, -0.6], [-0.6, -0.6]]) K.box(0.12, 1.0, 0.12, '#3a3448', M4(tx + ox, h + 1.0, tz + oz)); }
    for (let y = 4.4; y < h - 1.6; y += 3.2) for (let z = z0 + 1.4; z < z1 - 1; z += 2.2) {
      const lit = rand() < 0.45;
      K.box(0.1, 1.3, 1.0, lit ? (rand() < 0.75 ? '#ffd48a' : '#7fffe0') : '#2a2340', M4(fxo, y + 0.7, z), lit ? 'glow' : 'solid');
      K.box(0.22, 0.08, 1.2, '#fbf7f2', M4(fxo + face * 0.06, y + 0.02, z)); K.box(0.12, 0.08, 1.15, '#fbf7f2', M4(fxo, y + 1.4, z));   // parapet i nadproże
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
  // ulica, ziemia, kamienice i miasto rysują się po hali (renderOrder 1): to, co zasłania posadzka i ściany salonu, odrzuca test głębi
  // zamiast liczyć pełne oświetlenie (ziemia 900 × 900 m leży pod całą halą)
  const cityMesh = new THREE.Mesh(mergeGeometries(city, false), new THREE.MeshStandardMaterial({ color: '#3a2c56', roughness: 0.75, metalness: 0.1, emissive: '#ffffff', emissiveMap: wt, emissiveIntensity: 1 }));
  cityMesh.renderOrder = 1; root.add(cityMesh);
  K.meshes(true).forEach((m) => { m.renderOrder = 1; root.add(m); });

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
//              OAZA → BAGNO (przystań na bagnie w złotym, wilgotnym świetle późnego popołudnia)
//   Sama mapa (teren, sklepik, pomosty, hydroplany, drzewa) jest w zrodla/bagno-scena.js; tu niebo, światło, woda i daleki świat.
// ======================================================================================================
function themeBayou(M, root) {
  const rand = rng(1984), WL = 0.32;
  const sunOff = V3(-26, 21, -9);                         // słońce nisko z zachodu – z boku dla obu stron mapy
  const FOG = '#dad8c0';
  const sky = skyTexture({
    stops: [[90, '#3a82d6'], [55, '#5a9ce2'], [30, '#8cbfea'], [14, '#c0dbe9'], [6, '#e2e6d8'], [2, '#f3e4c4'], [0, FOG], [-6, '#a8b08a'], [-90, '#3a4a2a']],
    sun: { dir: sunOff.clone().normalize(), r: 30, disc: '#fff4d2', glow: [[640, 'rgba(255,212,150,.34)'], [260, 'rgba(255,224,168,.5)'], [110, 'rgba(255,244,212,.95)']] },
    paint: (x, W, H, px, wrap) => {
      const r = rng(41);
      for (let i = 0; i < 54; i++) {                         // kłębiaste chmury z płaskim spodem, nisko nad horyzontem
        const el = 4 + r() * 20, cy = elevY(H, el), cx = r() * W, s = (0.5 + r() * 0.9) * (1 - el / 46), puffs = [];
        for (let k = 0; k < 7; k++) { const br = (10 + r() * 13) * s; puffs.push([(k - 3) * 12 * s + (r() - 0.5) * 8 * s, br, cy - br * 0.25 - r() * 5 * s, 0.7 + r() * 0.25]); }
        wrap((o) => {
          x.save(); x.beginPath(); x.rect(cx + o - 120 * s, 0, 240 * s, cy); x.clip();
          for (const [dx, br, by, al] of puffs) { x.fillStyle = `rgba(255,${246 + r() * 9 | 0},${232 + r() * 20 | 0},${al})`; x.beginPath(); x.arc(cx + o + dx, by, br, 0, Math.PI * 2); x.fill(); }
          x.restore();
        });
      }
      const y0 = elevY(H, 9), y1 = elevY(H, -1), g = x.createLinearGradient(0, y0, 0, y1);   // wilgotna, ciepła mgiełka nad horyzontem
      g.addColorStop(0, 'rgba(244,230,200,0)'); g.addColorStop(1, 'rgba(244,230,200,.8)'); x.fillStyle = g; x.fillRect(0, y0, W, y1 - y0);
    },
  });

  // ---- woda rozlewiska: zielonkawa, z odbiciem nieba ----
  const water = makeWater({ y: WL, color: '#3f6a46', rough: 0.08, metal: 0.3, env: sky, envI: 0.85, amp: 0.03, freq: 0.32, speed: 0.5, opacity: 0.92 });
  root.add(water.mesh);

  // ---- daleko: pas lasu na horyzoncie i panorama miasta w mgle (północny wschód) ----
  const far = new Kit();
  for (let i = 0; i < 420; i++) {                           // daleki las: niskie, spłaszczone korony (nie „góry”)
    const a = rand() * Math.PI * 2, d = 128 + rand() * 80, s = 3.5 + rand() * 3.5, y = 1.5 + s * 0.6 + rand() * 2.5;
    far.add(jitter(new THREE.IcosahedronGeometry(1, 0), 0.3, rand), ['#4f7a3a', '#5a8642', '#467236'][i % 3], M4(Math.cos(a) * d, y, Math.sin(a) * d, 0, rand() * 6, 0, s * 1.5, s * 0.75, s * 1.5));
  }
  // panorama miasta: sine, płaskie sylwetki w wilgotnej mgiełce (bez cieniowania i bez mgły sceny – sama jest „za mgłą”)
  const city = new Kit(), HAZE = ['#b4c3c9', '#aabbc3', '#bfcace', '#a5b6bf', '#c6cfcf'];
  for (let i = 0; i < 52; i++) {
    const az = 1.0 + (rand() - 0.5) * 1.15, dist = 232 + rand() * 52, x = Math.cos(az) * dist, z = Math.sin(az) * dist;   // kamera widzi do 300 m
    const w = 6 + rand() * 10, d = 6 + rand() * 10, h = 14 + Math.pow(rand(), 1.8) * 44, ry = rand() * 0.6, c = HAZE[Math.floor(rand() * HAZE.length)];
    city.box(w, h, d, c, M4(x, h / 2 - 2, z, 0, ry));
    if (rand() < 0.45) { const h2 = h * (0.12 + rand() * 0.2); city.box(w * 0.65, h2, d * 0.65, c, M4(x, h - 2 + h2 / 2, z, 0, ry)); }
    if (rand() < 0.2) city.add(new THREE.CylinderGeometry(0.3, 0.6, 8, 5), c, M4(x, h - 2 + 4, z));
  }
  const cityMesh = new THREE.Mesh(city.geometry('solid'), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, transparent: true, opacity: 0.82 }));
  cityMesh.renderOrder = -2; root.add(cityMesh);
  far.meshes(false).forEach((m) => root.add(m));

  // ---- ruch: czaple i pelikany, helikopter nad miastem, aligatory poza polem gry ----
  const egrets = birds(10, rand, '#f6f4ec'), pelicans = birds(5, rand, '#6a6458');
  egrets.forEach((b) => root.add(b)); pelicans.forEach((b) => { b.scale.setScalar(1.8); root.add(b); });
  const heli = helicopter('#24425e', '#ffd23a'); heli.g.scale.setScalar(1.3); root.add(heli.g);
  const gGeo = gatorGeometry(1.2), { SOLID } = mats(), gators = [];
  for (const [cx, cz] of [[34, 2], [46, 6], [-36, -3], [-50, -6], [58, 10]]) {
    const m = new THREE.Mesh(gGeo, SOLID); m.castShadow = true; m.userData = { cx, cz, r: 3 + rand() * 4, a: rand() * 6.28, sp: (rand() < 0.5 ? -1 : 1) * (0.05 + rand() * 0.05) };
    root.add(m); gators.push(m);
  }
  const T = {
    sky, fog: FOG, near: 35, far: 290,
    hemi: ['#d2eaff', '#86784a', 1.05], sun: ['#ffd69a', 2.95], sunOff, env: sky, envI: 0.55,
    update(t) {
      water.tick(t);
      for (const g of gators) { const u = g.userData, a = u.a + t * u.sp; g.position.set(u.cx + Math.cos(a) * u.r, WL - 0.04 + Math.sin(t * 0.8 + u.a) * 0.03, u.cz + Math.sin(a) * u.r); g.rotation.y = -a + (u.sp > 0 ? Math.PI : 0); }
      const ha = t * 0.045; heli.g.position.set(150 + Math.cos(ha) * 70, 55 + Math.sin(t * 0.4) * 3, 190 + Math.sin(ha) * 50); heli.g.rotation.set(0.08, -ha - Math.PI, 0.1);
      heli.rotor.rotation.y = t * 28; heli.tail.rotation.x = t * 40; heli.light.visible = Math.sin(t * 6) > 0.6;
      egrets.forEach((b) => { const u = b.userData, a = u.a + t * 0.12 * u.s; b.position.set(-30 + Math.cos(a) * 40 * u.r, 20 + u.h, 40 + Math.sin(a) * 26 * u.r); b.rotation.y = -a; b.scale.set(1.3, 1.3 * Math.sin(t * 7 + u.ph), 1.3); });
      pelicans.forEach((b, i) => { const u = b.userData, x = ((t * 5 + i * 9 + u.ph * 10) % 260) - 130; b.position.set(x, 26 + u.h + i * 1.4, -45 + i * 2.2); b.rotation.y = -Math.PI / 2; b.scale.set(1.8, 1.8 * (0.35 + 0.65 * Math.abs(Math.sin(t * 2.2 + u.ph))), 1.8); });
    },
  };
  T.update(0);                                              // helikopter, aligatory i ptaki od razu na swoich trasach (nie w środku mapy)
  return T;
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
  const water = makeWater({ y: WL, seg: 110, color: '#1d5a9a', rough: 0.22, metal: 0.35, env: sky, envI: 0.95, amp: 0.13, freq: 0.16, speed: 0.9 });   // 110 segmentów: fale długie, fasetki prawie te same, ~20 tys. trójkątów mniej
  root.add(water.mesh);
  water.mesh.renderOrder = 1;                             // morze po jachtach: piksele zasłonięte pokładem i salonem odrzuca test głębi (było rysowane pierwsze)
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
// ======================================================================================================
//                 ICE → IGLOO (zimowy obóz nad zamarzniętym jeziorem, mroźne słoneczne popołudnie)
// ======================================================================================================
// Mapa i kolizje: iglo-data.js, grafika: iglo-scena.js. Tu otoczenie: zimowe niebo z cienkimi chmurami, słońce z zachodu
// (z boku dla obu stron – nikt nie patrzy w słońce), ośnieżone góry na horyzoncie, padający śnieg i kruki.
function themeSnow(M, root) {
  const rand = rng(2077);
  const sunOff = V3(-26, 21, 0);
  const FOG = '#dce7f2';
  const sky = skyTexture({
    stops: [[90, '#2f6fc4'], [55, '#4b8ad6'], [30, '#82b2e6'], [14, '#b5d0ee'], [6, '#d9e6f2'], [2, '#efe6e0'], [0, FOG], [-6, '#c9d6e2'], [-90, '#8c9cb0']],
    sun: { dir: sunOff.clone().normalize(), r: 24, disc: '#fffaf0', glow: [[560, 'rgba(255,226,190,.26)'], [220, 'rgba(255,236,206,.42)'], [90, 'rgba(255,250,236,.95)']] },
    paint: (x, W, H, px, wrap) => {
      const r = rng(77);
      for (let i = 0; i < 38; i++) {                          // cienkie, rozciągnięte chmury (mroźne niebo)
        const el = 7 + r() * 30, cy = elevY(H, el), cx = r() * W, len = (90 + r() * 220) * (1 - el / 60), th = 3 + r() * 7;
        wrap((o) => { for (let k = 0; k < 4; k++) { x.fillStyle = `rgba(255,255,255,${0.16 + r() * 0.18})`; x.beginPath(); x.ellipse(cx + o + (k - 1.5) * len * 0.35, cy + (r() - 0.5) * th, len * (0.35 + r() * 0.25), th * (0.6 + r() * 0.5), 0, 0, Math.PI * 2); x.fill(); } });
      }
      const y0 = elevY(H, 7), y1 = elevY(H, -1), g = x.createLinearGradient(0, y0, 0, y1);   // mroźna mgiełka nad horyzontem
      g.addColorStop(0, 'rgba(236,242,248,0)'); g.addColorStop(1, 'rgba(236,242,248,.85)'); x.fillStyle = g; x.fillRect(0, y0, W, y1 - y0);
    },
  });
  // ---- góry na horyzoncie: szaroniebieskie stożki ze śnieżnymi czapami (we mgle) ----
  const far = new Kit(), MT = ['#8ea4c0', '#7f96b4', '#97accb', '#869cb9'];
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2 + (rand() - 0.5) * 0.12, d = 205 + rand() * 60, h = 34 + rand() * 58, rr = h * (0.95 + rand() * 0.55), x = Math.cos(a) * d, z = Math.sin(a) * d, ry = rand() * 6;
    far.add(new THREE.ConeGeometry(rr, h, 7, 1), MT[i % MT.length], M4(x, h / 2 - 8, z, 0, ry));
    far.add(new THREE.ConeGeometry(rr * 0.4 * 1.04, h * 0.4, 7, 1), '#f2f6fb', M4(x, h - 8 - h * 0.2 + 0.4, z, 0, ry));
    if (rand() < 0.5) { const h2 = h * (0.5 + rand() * 0.3), a2 = a + (rand() - 0.5) * 0.08, d2 = d - 15 - rand() * 15, x2 = Math.cos(a2) * d2, z2 = Math.sin(a2) * d2;
      far.add(new THREE.ConeGeometry(h2, h2, 6, 1), MT[(i + 1) % MT.length], M4(x2, h2 / 2 - 8, z2, 0, ry + 1)); far.add(new THREE.ConeGeometry(h2 * 0.36, h2 * 0.36, 6, 1), '#eef3f9', M4(x2, h2 - 8 - h2 * 0.18 + 0.3, z2, 0, ry + 1)); }
  }
  far.meshes(false).forEach((m) => { m.userData.deco = true; root.add(m); });
  // ---- padający śnieg: płatki krążą w pudełku nad polem gry (ruch w shaderze, bez pracy procesora) ----
  const N = 5000, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = (rand() * 2 - 1) * 45; pos[i * 3 + 1] = rand() * 28; pos[i * 3 + 2] = (rand() * 2 - 1) * 50; seed[i] = rand() * 6.283; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.boundingSphere = new THREE.Sphere(V3(0, 14, 0), 80);
  const cv = document.createElement('canvas'); cv.width = cv.height = 32; const cx = cv.getContext('2d'), rg = cx.createRadialGradient(16, 16, 0, 16, 16, 16);
  rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.45, 'rgba(255,255,255,.85)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); cx.fillStyle = rg; cx.fillRect(0, 0, 32, 32);
  const flake = new THREE.CanvasTexture(cv); flake.colorSpace = THREE.SRGBColorSpace;
  const uT = { value: 0 };
  const mat = new THREE.PointsMaterial({ color: '#ffffff', size: 0.12, map: flake, transparent: true, opacity: 0.95, depthWrite: false, sizeAttenuation: true });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uT = uT;
    sh.vertexShader = 'uniform float uT;\nattribute float aSeed;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed.y = mod(position.y - uT * (0.8 + 0.6 * fract(aSeed * 3.7)), 28.0);
      transformed.x = mod(position.x + 45.0 + uT * 0.4 + sin(uT * 0.7 + aSeed) * 0.7, 90.0) - 45.0;
      transformed.z += cos(uT * 0.5 + aSeed * 1.3) * 0.6;`);
  };
  mat.customProgramCacheKey = () => 'bean-snowfall';
  const snow = new THREE.Points(geo, mat); snow.frustumCulled = false; snow.renderOrder = 3; root.add(snow);
  // ---- kruki krążące nad lasem ----
  const ravens = birds(7, rand, '#23232a');
  ravens.forEach((b) => { b.scale.setScalar(1.4); root.add(b); });
  const T = {
    sky, fog: FOG, near: 40, far: 320,
    hemi: ['#d8e8ff', '#9db0c6', 1.05], sun: ['#ffe8cc', 2.45], sunOff, env: sky, envI: 0.5,
    update(t) {
      uT.value = t;
      ravens.forEach((b, i) => { const u = b.userData, a = u.a + t * 0.1 * u.s; b.position.set(40 * Math.cos(a) * u.r + (i % 2 ? 30 : -30), 22 + u.h, 50 * Math.sin(a) * u.r); b.rotation.y = -a; b.scale.set(1.4, 1.4 * Math.sin(t * 6 + u.ph), 1.4); });
    },
  };
  T.update(0);
  return T;
}

// ======================================================================================================
//            KASKADY → jesienna wyspa-diorama nad morzem chmur (złote popołudnie)
// ======================================================================================================
// Mapa i kolizje: kaskady-data.js, grafika: kaskady-scena.js (woda i wodospady animuje root.userData.tick – wołane stąd co klatkę).
// Tu otoczenie: ciepłe niebo z niskim słońcem z zachodu (z boku dla obu stron), morze chmur pod wyspą, latające wysepki
// z drzewami i wodospadami, spadające jesienne liście i ptaki.
function themeCascades(M, root) {
  const rand = rng(1122);
  const sunOff = V3(-24, 19, -7);
  const FOG = '#f1dcc3';
  const sky = skyTexture({
    stops: [[90, '#3a74c8'], [60, '#4f8bd6'], [35, '#86b4e6'], [18, '#bcd3ea'], [8, '#f2d9b8'], [3, '#ffd6a0'], [0, FOG], [-8, '#f4e4d2'], [-90, '#e8d6c4']],
    sun: { dir: sunOff.clone().normalize(), r: 26, disc: '#fff4dc', glow: [[620, 'rgba(255,196,130,.30)'], [240, 'rgba(255,214,160,.45)'], [95, 'rgba(255,244,220,.95)']] },
    paint: (x, W, H, px, wrap) => {
      const r = rng(31);
      for (let i = 0; i < 44; i++) {                          // pierzaste chmury w złotym świetle
        const el = 6 + r() * 34, cy = elevY(H, el), cx = r() * W, len = (70 + r() * 200) * (1 - el / 70), th = 4 + r() * 9;
        wrap((o) => {
          for (let k = 0; k < 5; k++) {
            x.fillStyle = `rgba(255,${236 + Math.floor(r() * 19)},${214 + Math.floor(r() * 30)},${0.18 + r() * 0.22})`;
            x.beginPath(); x.ellipse(cx + o + (k - 2) * len * 0.3, cy + (r() - 0.5) * th, len * (0.3 + r() * 0.25), th * (0.6 + r() * 0.5), 0, 0, Math.PI * 2); x.fill();
          }
        });
      }
    },
  });
  // ---- morze chmur pod wyspą: płaszczyzna z miękkimi kłębami + bryły chmur przy brzegach ----
  const cv = document.createElement('canvas'); cv.width = cv.height = 512; const cx = cv.getContext('2d');
  cx.fillStyle = '#f3e3d0'; cx.fillRect(0, 0, 512, 512);
  const cr = rng(5);
  for (let i = 0; i < 160; i++) {
    const x = cr() * 512, y = cr() * 512, rr = 20 + cr() * 70, g = cx.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0, `rgba(255,255,255,${0.35 + cr() * 0.4})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) { cx.save(); cx.translate(ox, oy); cx.fillStyle = g; cx.fillRect(x - rr, y - rr, rr * 2, rr * 2); cx.restore(); }
  }
  const ctex = new THREE.CanvasTexture(cv); ctex.wrapS = ctex.wrapT = THREE.RepeatWrapping; ctex.repeat.set(14, 14); ctex.colorSpace = THREE.SRGBColorSpace;
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), new THREE.MeshBasicMaterial({ map: ctex, color: '#fff1e2' }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -12; sea.userData.deco = true; root.add(sea);
  const puffs = new Kit(), PUFF = ['#fffaf2', '#fbeee0', '#ffffff', '#f6e3cf'];
  for (let i = 0; i < 70; i++) {
    const a = rand() * Math.PI * 2, d = 36 + rand() * 170, x = Math.cos(a) * d * 0.9, z = Math.sin(a) * d * 1.15, s = 4 + rand() * 9;
    for (let k = 0; k < 4; k++) puffs.add(jitter(new THREE.IcosahedronGeometry(s * (0.6 + rand() * 0.5), 1), s * 0.15, rand), PUFF[(i + k) % 4], M4(x + (rand() - 0.5) * s * 2, -11 + rand() * 4, z + (rand() - 0.5) * s * 2, 0, 0, 0, 1, 0.55, 1));
  }
  const pm = new THREE.Mesh(puffs.geometry('solid'), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, emissive: '#f0d6bc', emissiveIntensity: 0.35 }));
  pm.userData.deco = true; root.add(pm);
  // ---- latające wysepki: blok rudej ziemi z trawą, drzewa, skalny stożek pod spodem; niektóre z wodospadem ----
  const isles = [];
  const LV = ['#f0862e', '#d9472b', '#f2b632', '#5f9e35', '#e8742a'], ER = ['#c8693c', '#bd5f36', '#d17545'], PN = ['#2f6b4a', '#357452'];
  const ISL = [[-62, 6, -40, 9], [70, 12, 30, 11], [-48, 18, 72, 7], [55, 2, -78, 8], [-95, 10, 15, 13], [100, 20, -20, 9], [10, 26, 115, 10], [-20, 14, -120, 12]];
  for (const [x, y, z, s] of ISL) {
    const k = new Kit(), h = s * 0.55;
    k.box(s, h, s * 0.8, ER[Math.floor(rand() * 3)], M4(0, -h / 2, 0));
    k.box(s + 0.3, 0.35, s * 0.8 + 0.3, '#86b83f', M4(0, 0.1, 0));
    k.add(jitter(new THREE.ConeGeometry(s * 0.55, s * 1.2, 6, 2), s * 0.08, rand), '#a9522f', M4(0, -h - s * 0.6, 0, Math.PI));
    const n = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const tx = (rand() - 0.5) * s * 0.6, tz = (rand() - 0.5) * s * 0.5, ts = s * (0.12 + rand() * 0.08);
      k.add(new THREE.CylinderGeometry(ts * 0.15, ts * 0.22, ts * 2.2, 5), '#6b4a32', M4(tx, ts * 1.1 + 0.2, tz));
      if (rand() < 0.4) k.add(new THREE.ConeGeometry(ts * 0.9, ts * 3.2, 7), PN[i % 2], M4(tx, ts * 3.2, tz));
      else for (let j = 0; j < 3; j++) k.add(jitter(new THREE.IcosahedronGeometry(ts * (0.8 + rand() * 0.4), 0), ts * 0.15, rand), LV[Math.floor(rand() * LV.length)], M4(tx + (rand() - 0.5) * ts, ts * 2.6 + rand() * ts * 0.6, tz + (rand() - 0.5) * ts));
    }
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rand() * Math.PI * 2;
    for (const m of k.meshes(false)) { m.userData.deco = true; g.add(m); }
    if (rand() < 0.6) {                                                                              // wodospad z krawędzi wysepki
      const fall = new THREE.Mesh(new THREE.PlaneGeometry(s * 0.18, s * 3.2), new THREE.MeshBasicMaterial({ color: '#c9f3f7', transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
      fall.position.set(s * 0.2, -s * 1.5, s * 0.41); fall.userData.deco = true; g.add(fall);
    }
    g.userData = { y, ph: rand() * 6.28, sp: 0.25 + rand() * 0.2 };
    root.add(g); isles.push(g);
  }
  // ---- spadające liście (ruch w shaderze, kolory w wierzchołkach) ----
  const N = 1400, pos = new Float32Array(N * 3), seed = new Float32Array(N), col = new Float32Array(N * 3), C = new THREE.Color();
  const LC = ['#f0862e', '#e8742a', '#d9472b', '#f2b632', '#c93a26'];
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (rand() * 2 - 1) * 30; pos[i * 3 + 1] = rand() * 16; pos[i * 3 + 2] = (rand() * 2 - 1) * 38; seed[i] = rand() * 6.283;
    C.set(LC[i % LC.length]); col[i * 3] = C.r; col[i * 3 + 1] = C.g; col[i * 3 + 2] = C.b;
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.boundingSphere = new THREE.Sphere(V3(0, 8, 0), 60);
  const lc = document.createElement('canvas'); lc.width = lc.height = 32; const lx = lc.getContext('2d');
  lx.fillStyle = '#fff'; lx.beginPath(); lx.ellipse(16, 16, 13, 7, 0.6, 0, Math.PI * 2); lx.fill();
  const leafTex = new THREE.CanvasTexture(lc);
  const uT = { value: 0 };
  const lmat = new THREE.PointsMaterial({ size: 0.16, map: leafTex, vertexColors: true, transparent: true, alphaTest: 0.4, depthWrite: true, sizeAttenuation: true });
  lmat.onBeforeCompile = (sh) => {
    sh.uniforms.uT = uT;
    sh.vertexShader = 'uniform float uT;\nattribute float aSeed;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed.y = mod(position.y - uT * (0.45 + 0.35 * fract(aSeed * 3.7)), 16.0) + 0.3;
      transformed.x = mod(position.x + 30.0 + uT * 0.6 + sin(uT * 1.3 + aSeed) * 1.1, 60.0) - 30.0;
      transformed.z += cos(uT * 0.9 + aSeed * 1.7) * 0.9;`);
  };
  lmat.customProgramCacheKey = () => 'kaskady-leaves';
  const leaves = new THREE.Points(geo, lmat); leaves.frustumCulled = false; leaves.renderOrder = 3; root.add(leaves);
  // ---- ptaki nad wyspą ----
  const flock = birds(9, rand, '#3a2a2a');
  flock.forEach((b) => { b.scale.setScalar(1.2); root.add(b); });
  const T = {
    sky, fog: FOG, near: 60, far: 360,
    hemi: ['#d6e6ff', '#b08a6a', 1.05], sun: ['#ffd9aa', 2.6], sunOff, env: sky, envI: 0.45,
    update(t) {
      uT.value = t; if (root.userData.tick) root.userData.tick(t);
      ctex.offset.set(t * 0.004, t * 0.002);
      for (const g of isles) { const u = g.userData; g.position.y = u.y + Math.sin(t * u.sp + u.ph) * 0.8; g.rotation.y += 0.0004; }
      flock.forEach((b, i) => { const u = b.userData, a = u.a + t * 0.12 * u.s; b.position.set(34 * Math.cos(a) * u.r + (i % 2 ? 18 : -18), 17 + u.h, 44 * Math.sin(a) * u.r); b.rotation.y = -a; b.scale.set(1.2, 1.2 * Math.sin(t * 7 + u.ph), 1.2); });
    },
  };
  T.update(0);
  return T;
}

// ======================================================================================================
//            MARS (baza badawcza na lewitującej wyspie, zakurzone marsjańskie popołudnie)
// ======================================================================================================
// Mapa i kolizje: mars-data.js, grafika: mars-scena.js. Tu otoczenie: maślano-łososiowe niebo z pyłem, małe słońce z niebieską
// poświatą (tak wygląda na Marsie), dwa księżyce, lewitujące wyspy z iglicami w oddali, pył niesiony wiatrem, wir pyłowy, dron nad bazą
// i migające światła mapy (siatki 'mars-blink' ze sceny).
function themeMars(M, root) {
  const rand = rng(1976);
  const sunOff = V3(-24, 21, 0);                                // słońce z zachodu: z boku dla obu stron
  const FOG = '#d6a283';
  const sky = skyTexture({
    stops: [[90, '#6e3d33'], [55, '#8f5243'], [30, '#b46e54'], [14, '#cc8a68'], [6, '#dba07e'], [2, '#e4b393'], [0, FOG], [-8, '#b9765a'], [-90, '#5e3226']],
    sun: { dir: sunOff.clone().normalize(), r: 15, disc: '#fff6e8', glow: [[420, 'rgba(150,190,230,.16)'], [170, 'rgba(170,205,240,.38)'], [60, 'rgba(225,240,255,.9)']] },
    paint: (x, W, H, px, wrap) => {
      const r = rng(41);
      for (let i = 0; i < 46; i++) {                          // pasma pyłu na niebie
        const el = 3 + r() * 24, cy = elevY(H, el), cx = r() * W, len = (120 + r() * 300) * (1 - el / 50), th = 2 + r() * 6;
        const col = `rgba(${230 + r() * 25 | 0},${170 + r() * 40 | 0},${130 + r() * 30 | 0},${0.12 + r() * 0.16})`;
        wrap((o) => { x.fillStyle = col; x.beginPath(); x.ellipse(cx + o, cy, len, th, 0, 0, Math.PI * 2); x.fill(); });
      }
      const y0 = elevY(H, 9), y1 = elevY(H, -2), g = x.createLinearGradient(0, y0, 0, y1);   // gęsty pył nad horyzontem
      g.addColorStop(0, 'rgba(226,170,132,0)'); g.addColorStop(1, 'rgba(226,170,132,.9)'); x.fillStyle = g; x.fillRect(0, y0, W, y1 - y0);
      x.fillStyle = 'rgba(255,240,230,.55)'; for (let i = 0; i < 40; i++) { const y = elevY(H, 50 + r() * 38); x.fillRect(r() * W, y, 2, 2); }
    },
  });
  // ---- księżyce (Fobos i Dejmos): poszarpane, szare bryły wysoko na niebie ----
  const moons = new Kit();
  moons.add(jitter(new THREE.IcosahedronGeometry(9, 1), 2.6, rand), '#8d7e74', M4(-95, 150, -150, 0.3, 0.5, 0, 1.3, 1, 1));
  moons.add(jitter(new THREE.IcosahedronGeometry(4.5, 0), 1.4, rand), '#a3938a', M4(120, 175, 60, 0.2, 1.2, 0, 1.2, 0.9, 1));
  moons.meshes(false).forEach((m) => { m.userData.deco = true; m.material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: false }); root.add(m); });
  // ---- dalekie lewitujące wyspy: płaski wierzch z klocków, iglice, zwisające skały (w mgle pyłu) ----
  const far = new Kit(), RK = ['#a9472b', '#9a3f26', '#b5532f', '#8d3822', '#7c3220', '#6b2b1d'];
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * Math.PI * 2 + (rand() - 0.5) * 0.3, d = 95 + rand() * 150, x0 = Math.cos(a) * d, z0 = Math.sin(a) * d, y0 = -28 + rand() * 60, R = 6 + rand() * 14;
    for (let k = 0; k < 9; k++) {
      const ax = (rand() - 0.5) * R * 1.4, az = (rand() - 0.5) * R * 1.4, w = R * (0.35 + rand() * 0.4), dep = R * (0.5 + rand() * 1.3);
      far.add(new THREE.BoxGeometry(w, 1.6, w), RK[k % 3], M4(x0 + ax, y0, z0 + az));
      far.add(new THREE.BoxGeometry(w * 0.7, dep, w * 0.7), RK[3 + (k % 3)], M4(x0 + ax, y0 - 0.8 - dep / 2, z0 + az));
      if (rand() < 0.35) far.add(new THREE.BoxGeometry(w * 0.3, dep * 0.9, w * 0.3), RK[5], M4(x0 + ax + w * 0.2, y0 - dep - dep * 0.3, z0 + az));
    }
    for (let k = 0; k < 2 + Math.floor(rand() * 3); k++) {
      const h = 4 + rand() * R * 1.1, sx = (rand() - 0.5) * R, sz = (rand() - 0.5) * R;
      far.add(new THREE.BoxGeometry(2 + rand() * 2, h, 2 + rand() * 2), RK[k % 3], M4(x0 + sx, y0 + 0.8 + h / 2, z0 + sz));
      far.add(new THREE.BoxGeometry(1.2, h * 0.4, 1.2), RK[(k + 1) % 3], M4(x0 + sx, y0 + 0.8 + h + h * 0.2, z0 + sz));
    }
    if (rand() < 0.4) { far.add(new THREE.BoxGeometry(4, 2.6, 3), '#e4e8ec', M4(x0, y0 + 2.1, z0)); far.add(new THREE.BoxGeometry(0.3, 0.3, 0.3), '#5ff2e6', M4(x0 + 2, y0 + 3.6, z0), 'glow'); }
  }
  far.meshes(false).forEach((m) => { m.userData.deco = true; root.add(m); });
  // ---- pył niesiony wiatrem (ruch w shaderze) i wir pyłowy na horyzoncie ----
  const dust = (N, size, color, opacity, place, move, key) => {
    const pos = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) { const p = place(i); pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2]; seed[i] = rand() * 6.283; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.boundingSphere = new THREE.Sphere(V3(0, 0, 0), 400);
    const cv = document.createElement('canvas'); cv.width = cv.height = 32; const c2 = cv.getContext('2d'), rg = c2.createRadialGradient(16, 16, 0, 16, 16, 16);
    rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); c2.fillStyle = rg; c2.fillRect(0, 0, 32, 32);
    const tex = new THREE.CanvasTexture(cv), uT = { value: 0 };
    const mat = new THREE.PointsMaterial({ color, size, map: tex, transparent: true, opacity, depthWrite: false, sizeAttenuation: true });
    mat.onBeforeCompile = (sh) => { sh.uniforms.uT = uT; sh.vertexShader = 'uniform float uT;\nattribute float aSeed;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + move); };
    mat.customProgramCacheKey = () => key;
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 3; root.add(pts);
    return uT;
  };
  const uDust = dust(2600, 0.09, '#f1c09a', 0.7, () => [(rand() * 2 - 1) * 50, rand() * 16, (rand() * 2 - 1) * 55],
    'transformed.x = mod(position.x + 50.0 + uT * (1.6 + 0.8 * fract(aSeed * 2.1)), 100.0) - 50.0; transformed.y += sin(uT * 0.6 + aSeed) * 0.5;', 'bean-mars-dust');
  const uDevil = dust(1400, 0.9, '#c98a64', 0.45, (i) => [0, (i / 1400) * 46, 0],
    'float hh = position.y, rr = 1.5 + hh * 0.22 + sin(hh * 0.4 + uT) * 0.6, aa = aSeed * 3.0 + uT * (2.2 - hh * 0.02);\n' +
    'transformed = vec3(150.0 + cos(aa) * rr + sin(uT * 0.13) * 6.0, -6.0 + hh, -70.0 + sin(aa) * rr);', 'bean-mars-devil');
  // ---- dron krążący nad bazą (migające światło) ----
  const drone = new THREE.Group(), dk = new Kit();
  dk.box(0.7, 0.18, 0.7, '#e4e8ec', M4(0, 0, 0)); dk.box(0.3, 0.1, 0.3, '#3b4149', M4(0, -0.12, 0));
  for (const [ax, az] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { dk.box(0.6, 0.05, 0.08, '#3b4149', M4(ax * 0.35, 0.02, az * 0.35, 0, Math.atan2(az, ax))); dk.add(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 10), '#2a2f36', M4(ax * 0.55, 0.08, az * 0.55)); }
  dk.box(0.1, 0.1, 0.1, '#ff3a2a', M4(0, -0.2, 0.3), 'glow');
  dk.meshes(false).forEach((m) => { m.userData.deco = true; drone.add(m); }); drone.scale.setScalar(1.5); root.add(drone);
  // migające światła mapy (maszty, antena, latarnie) – szukane w scenie mapy
  const blink = []; (root.parent || root).traverse((o) => { if (o.name === 'mars-blink') blink.push(o); });
  const T = {
    sky, fog: FOG, near: 30, far: 260,
    hemi: ['#ffd9c2', '#7a3a26', 1.05], sun: ['#fff0dc', 2.6], sunOff, env: sky, envI: 0.5,
    update(t) {
      uDust.value = t; uDevil.value = t;
      blink.forEach((b, i) => { b.visible = Math.sin(t * 3.2 + i * 1.7) > 0.2; });
      const a = t * 0.16; drone.position.set(Math.cos(a) * 13, 12 + Math.sin(t * 0.7) * 1.2, Math.sin(a) * 20); drone.rotation.set(Math.sin(t) * 0.06, -a, 0.12);
    },
  };
  T.update(0);
  return T;
}

const THEMES = { Baza: themeDealer, Oaza: themeBayou, Magazyn: themeYachts, Iglo: themeSnow, Kaskady: themeCascades, Mars: themeMars };

// klocki low poly wspólne z mapami budowanymi w kodzie (zrodla/bagno-scena.js)
export { Kit, M4, V3, between, jitter, rng, mats, addPalm, addRushes, addLily, neonSign };

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
