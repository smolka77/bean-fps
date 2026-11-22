// Plener: wspólne wykończenie map budowanych w kodzie na otwartym powietrzu (Bagno, Igloo, Kaskady, Mars) – tylko grafika.
//  • JEDEN materiał na wszystkie cztery mapy (jeden program shadera, jedna rozgrzewka): kolor z wierzchołków, a parametry powierzchni
//    (szorstkość, metaliczność, faktura + jej siła, oś słojów / domieszka drugiej faktury) w atrybucie aSurf.
//  • Faktury liczone w kodzie (bez plików) do tablicy tekstur 2 × 256² RGBA: natura (trawa, ziemia, skała, śnieg) i wyroby
//    (deski, kora, metal, tynk/kamień). Shader nakłada je trójpłaszczyznowo według położenia w świecie (bez UV), dodaje relief
//    (zaburzenie normalnej z pochodnych) i duże plamy, które łamią powtarzalność.
//  • Kity z klimaty.js (geometrie z kolorem) przechodzą przez finishKit: rozpoznanie powierzchni po kolorze (tabela mapy + barwa),
//    gładkie normalne z kątem załamania (pnie, korony, skały, kopuły – bez fasetek; skrzynki i deski zostają ostre),
//    cieniowanie otoczenia w wierzchołkach (ciemniejsze przy ziemi, wnętrza koron, nasady trawy).
// Kolizje i podział na siatki (twarde / ozdoby / bez cienia) zostają takie jak w scenach – zmienia się tylko wygląd.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------- faktury ----------------------------------------------------------------
const N = 256;
function lattice(p, seed) {
  const a = new Float32Array(p * p); let s = seed % 2147483646 + 1;
  for (let i = 0; i < a.length; i++) { s = (s * 16807) % 2147483647; a[i] = s / 2147483647; }
  return a;
}
// szum wartości zawinięty na brzegach kafelka: siatka px × py oczek (dzielniki N – kafelek bez szwów)
function noiseFn(px, py, seed) {
  const L = lattice(Math.max(px, py), seed), W = Math.max(px, py);
  return (u, v) => {
    const x = u * px, y = v * py, xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const x0 = ((xi % px) + px) % px, y0 = ((yi % py) + py) % py, x1 = (x0 + 1) % px, y1 = (y0 + 1) % py;
    const a = L[y0 * W + x0], b = L[y0 * W + x1], c = L[y1 * W + x0], d = L[y1 * W + x1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}
function fbmFn(px, py, oct, seed) {
  const fs = []; for (let o = 0; o < oct; o++) fs.push(noiseFn(px << o, py << o, seed + o * 101));
  return (u, v) => { let t = 0, a = 0.5, n = 0; for (const f of fs) { t += a * f(u, v); n += a; a *= 0.5; } return t / n; };
}
const sat = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sstep = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const byte = (x) => Math.round(sat(x) * 255);

// warstwa 0 (natura): R trawa / liście, G ziemia z kamyczkami, B skała (spękania), A śnieg (zaspy i iskry)
// progi są łagodne, a oczka szumu ≥ 8 tekseli – inaczej po powiększeniu widać „klocki” siatki szumu
function layerNature(d, o) {
  const g1 = noiseFn(32, 32, 11), g2 = noiseFn(64, 64, 12), g3 = noiseFn(128, 128, 14), gClump = fbmFn(4, 4, 4, 13);
  const sF = fbmFn(8, 8, 4, 21), sPeb = noiseFn(32, 32, 22), sPeb2 = noiseFn(16, 16, 23), sDark = fbmFn(4, 4, 3, 24), sFine = noiseFn(128, 128, 25);
  const rF = fbmFn(4, 4, 5, 31), rRid = fbmFn(4, 4, 4, 32), rFine = noiseFn(64, 64, 33);
  const wF = fbmFn(4, 4, 4, 41), wSp = noiseFn(128, 128, 42), wMid = noiseFn(32, 32, 43);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = i / N, v = j / N, k = o + (j * N + i) * 4;
    d[k] = byte(0.5 + 0.22 * (g1(u, v) - 0.5) + 0.2 * (g2(u, v) - 0.5) + 0.16 * (g3(u, v) - 0.5) + 0.32 * (gClump(u, v) - 0.5));
    const peb = sstep(0.62, 0.88, sPeb(u, v)), peb2 = sstep(0.6, 0.9, sPeb2(u, v));
    d[k + 1] = byte(0.47 + 0.36 * (sF(u, v) - 0.5) + 0.14 * peb + 0.1 * peb2 + 0.1 * (sFine(u, v) - 0.5) - 0.14 * sstep(0.55, 0.8, sDark(u, v)));
    const rid = 1 - Math.abs(2 * rRid(u, v) - 1);
    d[k + 2] = byte(0.55 + 0.42 * (rF(u, v) - 0.5) + 0.1 * (rFine(u, v) - 0.5) - 0.22 * Math.pow(rid, 5));
    d[k + 3] = byte(0.52 + 0.3 * (wF(u, v) - 0.5) + 0.12 * (wMid(u, v) - 0.5) + 0.22 * sstep(0.88, 0.97, wSp(u, v)));
  }
}
// warstwa 1 (wyroby): R deski (słoje wzdłuż v), G kora (podłużne bruzdy), B metal/farba (rysy, przetarcia), A tynk/beton/kamień (plamy, pory)
function layerMade(d, o) {
  const wS = noiseFn(32, 4, 51), wFine = noiseFn(64, 8, 52), wWarp = fbmFn(4, 2, 2, 53), wKnot = fbmFn(4, 4, 2, 54);
  const bR = fbmFn(16, 2, 3, 61), bF = fbmFn(8, 8, 3, 62), bX = noiseFn(32, 8, 63);
  const mF = fbmFn(4, 4, 4, 71), mS = noiseFn(4, 64, 72), mSp = fbmFn(8, 8, 2, 73);
  const pF = fbmFn(4, 4, 5, 81), pPore = noiseFn(64, 64, 82), pB = noiseFn(16, 16, 83);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = i / N, v = j / N, k = o + (j * N + i) * 4;
    const ring = 0.5 + 0.5 * Math.sin((u * 10 + wWarp(u, v) * 2.2) * Math.PI * 2);
    d[k] = byte(0.55 + 0.26 * (wS(u, v) - 0.5) + 0.12 * (wFine(u, v) - 0.5) - 0.14 * Math.pow(ring, 5) - 0.12 * sstep(0.72, 0.9, wKnot(u, v)));
    const rid = 1 - Math.abs(2 * bR(u, v) - 1);
    d[k + 1] = byte(0.6 - 0.45 * Math.pow(1 - rid, 2.2) + 0.16 * (bF(u, v) - 0.5) + 0.08 * (bX(u, v) - 0.5));
    d[k + 2] = byte(0.52 + 0.2 * (mF(u, v) - 0.5) + 0.08 * (mS(u, v) - 0.5) - 0.12 * sstep(0.62, 0.85, mSp(u, v)));
    d[k + 3] = byte(0.53 + 0.3 * (pF(u, v) - 0.5) + 0.12 * (pB(u, v) - 0.5) - 0.12 * sstep(0.75, 0.92, pPore(u, v)));
  }
}
let DET = null;
function detailTexture() {
  if (DET) return DET;
  const data = new Uint8Array(N * N * 4 * 2);
  layerNature(data, 0); layerMade(data, N * N * 4);
  const t = new THREE.DataArrayTexture(data, N, N, 2);
  t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 8; t.needsUpdate = true;
  return (DET = t);
}

// ---------------------------------------------------------------- powierzchnie ----------------------------------------------------------------
// faktury (id w aSurf.z): skala (powtórzeń na metr), wpływ na szorstkość, warstwa, relief; maski kanałów A i B; [mieszanie A→B, plamy]
const C = { R: [1, 0, 0, 0], G: [0, 1, 0, 0], B: [0, 0, 1, 0], A: [0, 0, 0, 1], O: [0, 0, 0, 0] };
const TEX = [
  /* 0 brak     */[1, 0, 0, 0, C.O, C.O, 0, 0],
  /* 1 trawa    */[0.55, 0.15, 0, 0.6, C.R, C.R, 0, 0.35],
  /* 2 ziemia   */[0.45, 0.25, 0, 0.9, C.G, C.G, 0, 0.35],
  /* 3 skała    */[0.32, 0.3, 0, 1.4, C.B, C.B, 0, 0.3],
  /* 4 śnieg    */[0.28, 0.25, 0, 0.5, C.A, C.A, 0, 0.25],
  /* 5 deski    */[0.7, 0.3, 1, 0.5, C.R, C.R, 0, 0.12],
  /* 6 kora     */[0.9, 0.2, 1, 1.4, C.G, C.G, 0, 0.1],
  /* 7 metal    */[0.6, 0.5, 1, 0.25, C.B, C.B, 0, 0.12],
  /* 8 tynk     */[0.5, 0.2, 1, 0.6, C.A, C.A, 0, 0.15],
  /* 9 liście   */[0.9, 0.1, 0, 0.9, C.R, C.R, 0, 0.2],
  /* 10 lód (w = udział pęknięć) */[0.18, 0.6, 0, 0.45, C.A, C.B, 1, 0.3],
  /* 11 grunt: trawa → ziemia (w = udział ziemi)      */[0.5, 0.2, 0, 0.75, C.R, C.G, 1, 0.4],
  /* 12 grunt: ziemia → skała                          */[0.4, 0.25, 0, 1.0, C.G, C.B, 1, 0.4],
  /* 13 grunt: śnieg → skała                           */[0.3, 0.25, 0, 0.8, C.A, C.B, 1, 0.3],
  /* 14 kamień ciosany (bloki, mury)                   */[0.55, 0.25, 0, 1.1, C.B, C.B, 0, 0.12],
];
const NS = TEX.length;
// presety: szorstkość, metaliczność, faktura, siła, kąt wygładzania (°, 0 = płaskie ściany), cieniowanie otoczenia
//   ao: 'ground' (ciemniej przy ziemi), 'crown' (korony: spód i wnętrze ciemniej), 'blade' (trawa: nasada ciemna), 'none'
export const PRESETS = {
  wood: [0.78, 0, 5, 0.55, 50, 'ground'], oldwood: [0.88, 0, 5, 0.7, 50, 'ground'], bark: [0.92, 0, 6, 0.75, 70, 'ground'],
  leaf: [0.82, 0, 9, 0.55, 88, 'crown'], needle: [0.85, 0, 9, 0.5, 30, 'crown'], grass: [0.85, 0, 1, 0.35, 0, 'blade'], reed: [0.7, 0, 1, 0.25, 0, 'blade'],
  rock: [0.9, 0, 3, 0.75, 48, 'ground'], boulder: [0.9, 0, 3, 0.75, 75, 'ground'], stone: [0.86, 0, 14, 0.55, 0, 'ground'], soil: [0.95, 0, 2, 0.6, 50, 'ground'],
  sand: [0.95, 0, 2, 0.35, 50, 'ground'], snow: [0.72, 0, 4, 0.45, 60, 'ground'], snowblock: [0.78, 0, 4, 0.4, 0, 'ground'], ice: [0.14, 0.08, 10, 0.4, 40, 'none'],
  metal: [0.38, 0.65, 7, 0.4, 50, 'ground'], steel: [0.3, 0.8, 7, 0.45, 50, 'ground'], rust: [0.82, 0.35, 3, 0.7, 50, 'ground'],
  paint: [0.5, 0.05, 7, 0.22, 50, 'ground'], painted: [0.62, 0, 5, 0.3, 50, 'ground'], plastic: [0.4, 0, 7, 0.12, 60, 'ground'], rubber: [0.9, 0, 8, 0.25, 60, 'ground'],
  glass: [0.06, 0.55, 0, 0, 0, 'none'], plaster: [0.88, 0, 8, 0.45, 0, 'ground'], fabric: [0.95, 0, 8, 0.35, 60, 'ground'], flower: [0.6, 0, 0, 0, 60, 'none'],
  matte: [0.85, 0, 8, 0.2, 50, 'ground'], gloss: [0.3, 0.2, 7, 0.12, 50, 'ground'],
  turf: [0.88, 0, 1, 0.55, 0, 'ground'], straw: [0.9, 0, 1, 0.65, 0, 'ground'], cloud: [1, 0, 0, 0, 89, 'none'],
};

// rozpoznanie powierzchni po barwie (gdy mapa nie podała jej w tabeli)
const _hc = new THREE.Color(), _hsl = {};
export function autoSurface(hex) {
  _hc.set(hex).getHSL(_hsl); const h = _hsl.h * 360, s = _hsl.s, l = _hsl.l;
  if (l < 0.13) return 'rubber';
  if (s < 0.12) return l > 0.8 ? 'paint' : 'metal';
  if (h >= 70 && h < 170) return s > 0.25 ? 'leaf' : 'matte';
  if (h >= 15 && h < 50 && l < 0.55 && s < 0.65) return 'wood';
  if (h >= 190 && h < 230 && l < 0.3) return 'glass';
  return s > 0.5 ? 'plastic' : 'paint';
}

// ---------------------------------------------------------------- materiał ----------------------------------------------------------------
let UBER = null;
export function surfaceMaterial() {
  if (UBER) return UBER;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1, metalness: 0 });
  const uP = TEX.map((t) => new THREE.Vector4(t[0], t[1], t[2], t[3])), uMA = TEX.map((t) => new THREE.Vector4(...t[4])), uMB = TEX.map((t) => new THREE.Vector4(...t[5]));
  const uQ = TEX.map((t) => new THREE.Vector4(t[6], t[7], 0, 0));
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uDet: { value: detailTexture() }, uP: { value: uP }, uMA: { value: uMA }, uMB: { value: uMB }, uQ: { value: uQ } });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aSurf;\nvarying vec4 vSurf;\nvarying vec3 vWP;\nvarying vec3 vWN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvSurf = aSurf;\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
#define PL_NS ${NS}
uniform highp sampler2DArray uDet; uniform vec4 uP[PL_NS]; uniform vec4 uMA[PL_NS]; uniform vec4 uMB[PL_NS]; uniform vec4 uQ[PL_NS];
varying vec4 vSurf; varying vec3 vWP; varying vec3 vWN;
vec3 plPerturb(vec3 sp, vec3 sn, vec2 dh, float fd) {            // relief z pochodnych wysokości (jak bumpMap w three.js, bez UV)
  vec3 sx = dFdx(sp), sy = dFdy(sp), r1 = cross(sy, sn), r2 = cross(sn, sx);
  float det = dot(sx, r1) * fd;
  vec3 g = sign(det) * (dh.x * r1 + dh.y * r2);
  return normalize(abs(det) * sn - g);
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float plId = floor(vSurf.z + 0.002); int plI = int(plId); float plK = clamp(vSurf.z - plId, 0.0, 1.0);
vec4 plP = uP[plI]; vec4 plQ = uQ[plI];
vec3 plW = abs(normalize(vWN)); plW = plW * plW; plW = plW * plW; plW /= (plW.x + plW.y + plW.z + 1e-5);
vec3 plq = vWP * plP.x; float plAx = plQ.x > 0.5 ? -1.0 : floor(vSurf.w + 0.01);
vec2 plTX = plAx > 1.5 ? plq.yz : plq.zy; vec2 plTY = (plAx > -0.5 && plAx < 0.5) ? plq.zx : plq.xz; vec2 plTZ = (plAx > -0.5 && plAx < 0.5) ? plq.yx : plq.xy;
plTY += 0.37; plTZ += 0.71;
// pochodne liczone poza warunkiem (textureGrad), żeby gałąź „jedna próbka” nie psuła mipmap na granicach
vec2 plXx = dFdx(plTX), plXy = dFdy(plTX), plYx = dFdx(plTY), plYy = dFdy(plTY), plZx = dFdx(plTZ), plZy = dFdy(plTZ);
float plMx = max(plW.x, max(plW.y, plW.z));
vec4 plS;
if (plK < 0.001) plS = vec4(0.5);
else if (plMx > 0.9) {                                              // powierzchnia prawie prostopadła do osi: jedna próbka zamiast trzech
  if (plW.y >= plMx) plS = textureGrad(uDet, vec3(plTY, plP.z), plYx, plYy);
  else if (plW.x >= plMx) plS = textureGrad(uDet, vec3(plTX, plP.z), plXx, plXy);
  else plS = textureGrad(uDet, vec3(plTZ, plP.z), plZx, plZy);
} else plS = textureGrad(uDet, vec3(plTX, plP.z), plXx, plXy) * plW.x + textureGrad(uDet, vec3(plTY, plP.z), plYx, plYy) * plW.y + textureGrad(uDet, vec3(plTZ, plP.z), plZx, plZy) * plW.z;
float plH = mix(dot(plS, uMA[plI]), dot(plS, uMB[plI]), plQ.x > 0.5 ? clamp(vSurf.w, 0.0, 1.0) : 0.0);
float plM = texture(uDet, vec3(vWP.xz * 0.031 + vWP.y * 0.013, 0.0)).b;
diffuseColor.rgb *= (1.0 + (plH - 0.5) * 2.0 * plK) * (1.0 + (plM - 0.55) * plQ.y * 1.4 * step(0.001, plK));
float plB = plH * plP.w * plK * 0.06 * (1.0 - smoothstep(5.0, 22.0, length(vViewPosition))) * (0.35 + 0.65 * smoothstep(0.1, 0.45, vSurf.x));   // relief gaśnie z odległością (bez prążków na granicach mipmap) i na gładkich powierzchniach`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(vSurf.x * (1.0 + (plH - 0.5) * 2.0 * plP.y * plK), 0.04, 1.0);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vSurf.y;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = plPerturb(-vViewPosition, normal, vec2(dFdx(plB), dFdy(plB)), faceDirection);');
  };
  m.customProgramCacheKey = () => 'plener-2';
  return (UBER = m);
}

// teren (otwarte płaty skierowane do góry): ten sam program, ale w mapie cieni tylko tylne ściany – inaczej płaszczyzna
// zasłania samą siebie i na gruncie/lodzie widać prążki „trądziku cieni”
let TERR = null;
export function terrainMaterial() {
  if (TERR) return TERR;
  const u = surfaceMaterial(), m = u.clone(); m.onBeforeCompile = u.onBeforeCompile; m.customProgramCacheKey = u.customProgramCacheKey;
  m.shadowSide = THREE.BackSide;
  return (TERR = m);
}

// ---------------------------------------------------------------- normalne z załamaniem ----------------------------------------------------------------
// wygładza tylko sąsiednie ściany odchylone o mniej niż `deg` (walce i kule gładkie, krawędzie pudełek ostre); geometria bez indeksów
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
function crease(g, deg) {
  const P = g.attributes.position.array, n = P.length / 3, fn = new Float32Array(n * 3), cos = Math.cos((deg * Math.PI) / 180);
  for (let t = 0; t < n; t += 3) {
    _a.fromArray(P, t * 3); _b.fromArray(P, t * 3 + 3); _c.fromArray(P, t * 3 + 6);
    _b.sub(_a); _c.sub(_a); _b.cross(_c); const l = _b.length() || 1; _b.divideScalar(l);
    for (let k = 0; k < 3; k++) { fn[(t + k) * 3] = _b.x; fn[(t + k) * 3 + 1] = _b.y; fn[(t + k) * 3 + 2] = _b.z; }
  }
  const out = new Float32Array(n * 3);
  if (deg <= 0) { out.set(fn); }
  else {
    const map = new Map(), key = (i) => Math.round(P[i * 3] * 500) * 73856093 ^ Math.round(P[i * 3 + 1] * 500) * 19349663 ^ Math.round(P[i * 3 + 2] * 500) * 83492791;
    for (let i = 0; i < n; i++) { const k = key(i); let l = map.get(k); if (!l) map.set(k, (l = [])); l.push(i); }
    for (const l of map.values()) for (const i of l) {
      let x = 0, y = 0, z = 0;
      for (const j of l) {
        if (Math.abs(P[i * 3] - P[j * 3]) + Math.abs(P[i * 3 + 1] - P[j * 3 + 1]) + Math.abs(P[i * 3 + 2] - P[j * 3 + 2]) > 0.004) continue;   // kolizja klucza
        const d = fn[i * 3] * fn[j * 3] + fn[i * 3 + 1] * fn[j * 3 + 1] + fn[i * 3 + 2] * fn[j * 3 + 2];
        if (d >= cos) { x += fn[j * 3]; y += fn[j * 3 + 1]; z += fn[j * 3 + 2]; }
      }
      const L = Math.hypot(x, y, z) || 1; out[i * 3] = x / L; out[i * 3 + 1] = y / L; out[i * 3 + 2] = z / L;
    }
  }
  g.setAttribute('normal', new THREE.BufferAttribute(out, 3));
  return g;
}

// ---------------------------------------------------------------- wykończenie kitu ----------------------------------------------------------------
const _col = new THREE.Color();
const hexOf = (g) => { const c = g.attributes.color.array; return '#' + _col.setRGB(c[0], c[1], c[2]).getHexString(); };
// opts.classify(hex, geo) -> klucz presetu (albo nic: rozpoznanie po barwie); opts.ground(x, z) -> wysokość podłoża pod punktem
export function finishKit(kit, opts = {}) {
  const list = kit.L.solid; if (!list.length) return null;
  const classify = opts.classify || (() => null), ground = opts.ground || (() => 0), out = [];
  for (const g0 of list) {
    const hex = hexOf(g0);
    const key = classify(hex, g0) || autoSurface(hex), S = PRESETS[key] || PRESETS.paint;
    const g = g0;                                               // kit trzyma własne kopie geometrii – można je zmieniać
    const P = g.attributes.position.array, n = P.length / 3;
    crease(g, S[4]);
    // obwiednia (oś słojów = najdłuższy wymiar, dół do cieniowania przy ziemi)
    let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
    for (let i = 0; i < n; i++) { const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, axis = dx >= dy && dx >= dz ? 0 : dy >= dz ? 1 : 2;
    const col = g.attributes.color.array, nr = g.attributes.normal.array;
    const gy = ground((x0 + x1) / 2, (z0 + z1) / 2), onGround = y0 - gy < 0.3;
    const ao = S[5], cy = (y0 + y1) / 2, hh = Math.max(0.05, dy);
    for (let i = 0; i < n; i++) {
      const y = P[i * 3 + 1]; let f = 1;
      if (ao === 'crown') f = (0.62 + 0.38 * (0.5 + 0.5 * nr[i * 3 + 1])) * (0.82 + 0.18 * sat((y - y0) / hh + 0.15));
      else if (ao === 'blade') f = 0.5 + 0.5 * sat((y - y0) / hh);
      else if (ao === 'ground' && onGround) f = 0.68 + 0.32 * sstep(0, Math.min(0.9, hh * 0.6 + 0.15), y - Math.max(gy, y0));
      if (ao === 'ground' && !onGround && nr[i * 3 + 1] < -0.6) f *= 0.85;       // spody (okapy, półki) ciemniejsze
      col[i * 3] *= f; col[i * 3 + 1] *= f; col[i * 3 + 2] *= f;
    }
    const A = new Float32Array(n * 4), z = S[2] + Math.min(0.98, S[3]), w = axis;
    for (let i = 0; i < n; i++) { A[i * 4] = S[0]; A[i * 4 + 1] = S[1]; A[i * 4 + 2] = z; A[i * 4 + 3] = w; }
    g.setAttribute('aSurf', new THREE.BufferAttribute(A, 4));
    out.push(g); void cy;
  }
  kit.L.solid = [];
  const m = mergeGeometries(out, false); m.computeBoundingSphere(); m.computeBoundingBox();
  return m;
}
// geometria z gotowymi atrybutami (kolor w wierzchołkach) -> aSurf z presetu (np. siatki terenu)
export function tagGeometry(g, key, w = 0) {
  const S = PRESETS[key], n = g.attributes.position.count, A = new Float32Array(n * 4), z = S[2] + Math.min(0.98, S[3]);
  for (let i = 0; i < n; i++) { A[i * 4] = S[0]; A[i * 4 + 1] = S[1]; A[i * 4 + 2] = z; A[i * 4 + 3] = typeof w === 'function' ? w(i) : w; }
  g.setAttribute('aSurf', new THREE.BufferAttribute(A, 4));
  return g;
}

// ---------------------------------------------------------------- korony, krzaki, zaspy ----------------------------------------------------------------
// guzowata kula (korona drzewa, krzak, kamień): ikosaedr podzielony `detail` razy, wierzchołki odsunięte szumem zależnym od kierunku
// (ta sama pozycja = to samo przesunięcie, więc bez szczelin); amp – głębokość guzów, seed – wzór
const icoCache = new Map();
export function lumpy(detail, amp, seed = 1, flatBottom = 0) {
  let base = icoCache.get(detail); if (!base) icoCache.set(detail, (base = new THREE.IcosahedronGeometry(1, detail)));
  const g = base.clone(); g.deleteAttribute('uv'); g.deleteAttribute('normal');
  const P = g.attributes.position.array, s = seed * 1.618;
  const f = [[2.1, 1.3, 0.7], [-1.1, 2.6, 1.9], [3.7, -2.2, 3.1], [-4.3, 3.9, -2.7]], ph = [s, s * 2.3 + 1, s * 3.7 + 2, s * 5.1 + 3];
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i], y = P[i + 1], z = P[i + 2];
    let d = 0;
    for (let k = 0; k < 4; k++) d += Math.sin(f[k][0] * x + f[k][1] * y + f[k][2] * z + ph[k]) * (k < 2 ? 0.55 : 0.3);
    let r = 1 + amp * d * 0.6;
    let yy = y * r; if (flatBottom > 0 && yy < -flatBottom) yy = -flatBottom + (yy + flatBottom) * 0.25;
    P[i] = x * r; P[i + 1] = yy; P[i + 2] = z * r;
  }
  return g;
}

// blok skalny w obrysie pudełka w × h × d: ścięte, zaokrąglone krawędzie i nieregularna, „wyłupana” powierzchnia –
// wierzchołki przesuwają się tylko do środka, więc skała nigdy nie wystaje poza bryłę kolizji
export function rockSlab(w, h, d, seed = 1, round = 0.35, amp = 0.12) {
  const g = new THREE.BoxGeometry(w, h, d, Math.max(2, Math.round(w * 2)), Math.max(1, Math.round(h * 2)), Math.max(2, Math.round(d * 2)));
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  const P = g.attributes.position.array, hw = w / 2, hh = h / 2, hd = d / 2, s = seed * 7.13, m = Math.min(w, h, d);
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i], y = P[i + 1], z = P[i + 2], ax = Math.abs(x) / hw, ay = Math.abs(y) / hh, az = Math.abs(z) / hd;
    const edge = Math.pow(ax, 6) * Math.pow(ay, 6) + Math.pow(ay, 6) * Math.pow(az, 6) + Math.pow(ax, 6) * Math.pow(az, 6);   // 1 na krawędziach, 0 na środku ścian
    const nz = 0.5 + 0.25 * Math.sin(x * 3.1 + y * 1.7 + s) + 0.25 * Math.sin(z * 2.7 - y * 2.3 + s * 1.9);
    const inset = m * (round * 0.5 * Math.min(1, edge) + amp * nz * 0.5);
    P[i] = x - Math.sign(x) * Math.min(inset * ax, hw * 0.45); P[i + 1] = y - Math.sign(y) * Math.min(inset * ay * 0.6, hh * 0.45); P[i + 2] = z - Math.sign(z) * Math.min(inset * az, hd * 0.45);
  }
  return g;
}

// ---------------------------------------------------------------- teren ----------------------------------------------------------------
// siatka terenu z gładkimi normalnymi i kolorem w wierzchołkach (bez fasetek). fn(x, z) -> { y, c: [r,g,b] (liniowe), t: id faktury, k: siła, w: domieszka, r: szorstkość }
// keep(a, b, c) – czy rysować trójkąt (wierzchołki jako indeksy); kolejność wierzchołków jak w scenach (normalne do góry)
export function terrainGrid(x0, z0, x1, z1, step, fn, keep) {
  const nx = Math.round((x1 - x0) / step), nz = Math.round((z1 - z0) / step), W = nx + 1, n = W * (nz + 1);
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), surf = new Float32Array(n * 4);
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const k = j * W + i, x = x0 + i * step, z = z0 + j * step, v = fn(x, z);
    pos[k * 3] = x; pos[k * 3 + 1] = v.y; pos[k * 3 + 2] = z;
    col[k * 3] = v.c[0]; col[k * 3 + 1] = v.c[1]; col[k * 3 + 2] = v.c[2];
    surf[k * 4] = v.r ?? 0.95; surf[k * 4 + 1] = 0; surf[k * 4 + 2] = v.t + Math.min(0.98, v.k ?? 0.6); surf[k * 4 + 3] = v.w ?? 0;
  }
  const idx = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
    const T = (p, q, r) => { if (!keep || keep(p, q, r, pos)) idx.push(p, q, r); };
    if ((i + j) % 2) { T(a, c, b); T(b, c, d); } else { T(a, c, d); T(a, d, b); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aSurf', new THREE.BufferAttribute(surf, 4));
  g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}
// gotowa siatka bez indeksów (np. teren z kolorem na trójkąt) -> kolor i faktura w wierzchołkach + gładkie normalne (bez fasetek)
// fn(x, y, z) -> { c: [r,g,b], t, k, w, r } jak w terrainGrid
export function recolor(g, fn, angle = 70) {
  if (g.index) g = g.toNonIndexed();
  const P = g.attributes.position.array, n = P.length / 3, col = new Float32Array(n * 3), surf = new Float32Array(n * 4);
  const memo = new Map();
  for (let i = 0; i < n; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], key = Math.round(x * 200) + ',' + Math.round(y * 200) + ',' + Math.round(z * 200);
    let v = memo.get(key); if (!v) memo.set(key, (v = fn(x, y, z)));
    col[i * 3] = v.c[0]; col[i * 3 + 1] = v.c[1]; col[i * 3 + 2] = v.c[2];
    surf[i * 4] = v.r ?? 0.95; surf[i * 4 + 2] = v.t + Math.min(0.98, v.k ?? 0.6); surf[i * 4 + 3] = v.w ?? 0;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aSurf', new THREE.BufferAttribute(surf, 4));
  crease(g, angle); g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}
// odwrócenie kolejności wierzchołków w trójkątach (po odbiciu lustrzanym ściany patrzą znowu na zewnątrz)
export function flipTris(g) {
  if (g.index) { const I = g.index.array; for (let t = 0; t < I.length; t += 3) { const v = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = v; } g.index.needsUpdate = true; return g; }
  for (const nm of Object.keys(g.attributes)) {
    const a = g.attributes[nm], s = a.itemSize, arr = a.array;
    for (let t = 0; t < a.count; t += 3) for (let c = 0; c < s; c++) { const i1 = (t + 1) * s + c, i2 = (t + 2) * s + c, v = arr[i1]; arr[i1] = arr[i2]; arr[i2] = v; }
  }
  return g;
}
// geometria + jej odbicie z → −z (strona B), z poprawioną kolejnością wierzchołków
export function withMirrorZ(g) {
  const m = g.clone(); m.applyMatrix4(new THREE.Matrix4().makeScale(1, 1, -1)); flipTris(m);
  const out = mergeGeometries([g.index ? g.toNonIndexed() : g, m.index ? m.toNonIndexed() : m], false); out.computeBoundingSphere(); out.computeBoundingBox();
  return out;
}
// kolor (hex) -> [r,g,b] liniowe, z opcjonalnym mnożnikiem jasności
export const rgb = (hex, f = 1) => { _col.set(hex); return [_col.r * f, _col.g * f, _col.b * f]; };
export const mixRgb = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
// cieniowanie otoczenia terenu przy bryłach kolizji stojących na ziemi: 0,6 tuż przy ścianie → 1 dalej niż r
export function contactAO(colliders, y0, r = 1.1, min = 0.62) {
  const list = colliders.filter((b) => b[1] <= y0 + 0.15 && b[4] > y0 + 0.25 && b[3] - b[0] < 30 && b[5] - b[2] < 30);
  return (x, z, y) => {
    let d = 1e9;
    for (const b of list) {
      if (y != null && Math.abs(b[1] - y) > 0.3 && !(b[1] < y && b[4] > y)) continue;
      const dx = Math.max(b[0] - x, 0, x - b[3]), dz = Math.max(b[2] - z, 0, z - b[5]);
      const dd = Math.hypot(dx, dz); if (dd < d) d = dd;
    }
    return min + (1 - min) * sstep(0, r, d);
  };
}

// ---------------------------------------------------------------- woda ----------------------------------------------------------------
// tafla z falami (wierzchołki) i drobnymi zmarszczkami (normalna z faktury), odbiciem nieba (Fresnel w MeshStandard) i pianą przy brzegu.
// foam(x, z) -> 0..1 (blisko brzegu), liczone raz do tekstury pokrywającej prostokąt [fx0, fz0, fx1, fz1]
// geo: własna geometria tafli (np. staw, strumień) zamiast dużej płaszczyzny; emissive: woda „świecąca” (turkus Kaskad)
export function makeWater2({ size = 600, seg = 120, geo = null, y, color, deep = color, rough = 0.06, env = null, envI = 1, amp = 0.04, freq = 0.3, speed = 0.6, opacity = 0.9, foam = null, rect = null, ripple = 1, emissive = null, emissiveIntensity = 0 }) {
  if (!geo) { geo = new THREE.PlaneGeometry(size, size, seg, seg); geo.rotateX(-Math.PI / 2); }
  let ftex = null;
  if (foam && rect) {
    const R = 256, d = new Uint8Array(R * R * 4), [fx0, fz0, fx1, fz1] = rect;
    for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) { const v = foam(fx0 + ((i + 0.5) / R) * (fx1 - fx0), fz0 + ((j + 0.5) / R) * (fz1 - fz0)); const k = (j * R + i) * 4; d[k] = d[k + 1] = d[k + 2] = 255; d[k + 3] = byte(v); }
    ftex = new THREE.DataTexture(d, R, R, THREE.RGBAFormat); ftex.magFilter = THREE.LinearFilter; ftex.minFilter = THREE.LinearFilter; ftex.needsUpdate = true;
  }
  const mat = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.05, envMap: env, envMapIntensity: envI, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
  if (emissive) { mat.emissive.set(emissive); mat.emissiveIntensity = emissiveIntensity; }
  const uT = { value: 0 }, uDeep = { value: new THREE.Color(deep) };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uT, uDet: { value: detailTexture() }, uFoam: { value: ftex }, uDeep, uRect: { value: new THREE.Vector4(...(rect || [0, 0, 1, 1])) } });
    sh.vertexShader = 'uniform float uT;\nvarying vec3 vWP;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 wq = (modelMatrix * vec4(transformed, 1.0)).xyz;
      transformed.y += ${amp.toFixed(3)} * (sin(wq.x * ${freq.toFixed(3)} + uT * ${(1.1 * speed).toFixed(3)}) * cos(wq.z * ${(freq * 0.8).toFixed(3)} + uT * ${(1.3 * speed).toFixed(3)})
        + 0.5 * sin((wq.x + wq.z) * ${(freq * 2.1).toFixed(3)} - uT * ${(1.7 * speed).toFixed(3)}));`)
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'uniform float uT;\nuniform highp sampler2DArray uDet;\nuniform vec3 uDeep;\nuniform vec4 uRect;\n' + (ftex ? 'uniform sampler2D uFoam;\n' : '') + 'varying vec3 vWP;\n' + sh.fragmentShader
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      {
        // zmarszczki: dwie przesuwające się faktury, normalna z pochodnych ekranowych (2 próbki zamiast 6)
        vec2 p = vWP.xz;
        float h0 = (texture(uDet, vec3(p * 0.21 + vec2(uT * 0.011, uT * 0.007), 0.0)).b + texture(uDet, vec3(p * 0.47 - vec2(uT * 0.013, -uT * 0.009), 0.0)).b * 0.6) * ${(0.09 * ripple).toFixed(3)};
        vec3 sx = dFdx(vWP), sy = dFdy(vWP), sn = vec3(0.0, 1.0, 0.0), r1 = cross(sy, sn), r2 = cross(sn, sx);
        float det = dot(sx, r1);
        vec3 nW = normalize(abs(det) * sn - sign(det) * (dFdx(h0) * r1 + dFdy(h0) * r2));
        normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
      }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec3 vd = normalize(cameraPosition - vWP);
        float fr = pow(1.0 - clamp(vd.y, 0.0, 1.0), 3.0);
        diffuseColor.rgb = mix(uDeep, diffuseColor.rgb, 0.35 + 0.65 * fr);
        diffuseColor.a = mix(diffuseColor.a * 0.85, 1.0, fr * 0.6);
        ${ftex ? `vec2 fu = (vWP.xz - uRect.xy) / (uRect.zw - uRect.xy);
        float fm = (fu.x > 0.0 && fu.x < 1.0 && fu.y > 0.0 && fu.y < 1.0) ? texture(uFoam, fu).a : 0.0;
        float fn = texture(uDet, vec3(vWP.xz * 0.6 + vec2(uT * 0.03, 0.0), 0.0)).g;
        float foam = smoothstep(0.35, 0.75, fm * (0.65 + 0.7 * fn) + 0.12 * sin(uT * 1.3 + fm * 9.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.95, 0.9), foam * 0.75);
        diffuseColor.a = max(diffuseColor.a, foam * 0.9);` : ''}
      }`);
  };
  mat.customProgramCacheKey = () => 'plener-woda-' + amp + '-' + freq + '-' + speed + '-' + ripple + (ftex ? '-f' : '');
  const m = new THREE.Mesh(geo, mat); m.position.y = y; m.receiveShadow = true; m.renderOrder = -1;
  return { mesh: m, mat, tick: (t) => { uT.value = t; } };
}
