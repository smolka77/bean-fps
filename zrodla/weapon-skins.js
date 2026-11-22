// Skiny broni (GTASSAULT): wzory nakładane w czasie gry na materiały modeli broni (shader – bez dodatkowych tekstur).
// Trzy progi jak w Ekwipunku za trzymanie tokena (serwer: serwer/wskins.mjs i arsenal.mjs → wskin.mid / wskin.legend):
//   free   – każdy (0 tokenów): proste kamuflaże,
//   mid    – od 5 mln tokenów: wzory z detalem (tygrys, karbon, neon Miami, chrom…),
//   legend – od 10 mln tokenów: metale szlachetne i animowane, świecące wzory (złoto, damast, lawa, galaktyka, hologram).
// Wzór idzie tylko na metal i plastik (części o niskim nasyceniu koloru) – drewno zostaje drewnem; jasność oryginalnej tekstury
// zostaje jako detal (krawędzie, zarysowania, nity), więc skin wygląda jak lakier na broni, a nie jak płaska naklejka.
// Wybór gracza (skin dla każdej broni osobno) – localStorage 'fasolka-wskins'; serwer sprawdza próg przy wejściu do meczu.
import * as THREE from 'three';

// id (stałe – zapisywane u graczy i na serwerze), tier, nazwa, wzór (pat), kolory (sRGB), metaliczność/szorstkość lakieru, świecenie, sw = próbka w Ekwipunku (CSS)
export const WSKINS = [
  { id: '', tier: 'free', name: 'Factory', pat: 0, sw: 'linear-gradient(135deg,#4a4d52,#1d1f23)' },
  { id: 'desert', tier: 'free', name: 'Desert Storm', pat: 2, c: ['#c9ae7c', '#9c7f50', '#6b5536'], metal: 0.1, rough: 0.8,
    sw: 'radial-gradient(circle at 30% 30%,#9c7f50 0 22%,transparent 23%),radial-gradient(circle at 70% 65%,#6b5536 0 20%,transparent 21%),#c9ae7c' },
  { id: 'woodland', tier: 'free', name: 'Woodland', pat: 2, c: ['#56603a', '#2e3822', '#7a6e48'], metal: 0.1, rough: 0.8,
    sw: 'radial-gradient(circle at 35% 35%,#2e3822 0 24%,transparent 25%),radial-gradient(circle at 70% 70%,#7a6e48 0 18%,transparent 19%),#56603a' },
  { id: 'urban', tier: 'free', name: 'Urban Digital', pat: 3, c: ['#9a9ea6', '#5d6169', '#2c2f35'], metal: 0.15, rough: 0.7,
    sw: 'conic-gradient(#9a9ea6 0 25%,#5d6169 0 50%,#2c2f35 0 75%,#9a9ea6 0) 0 0/12px 12px' },
  { id: 'tiger', tier: 'mid', name: 'Tiger', pat: 4, c: ['#f08a24', '#140f0c'], metal: 0.25, rough: 0.42,
    sw: 'repeating-linear-gradient(115deg,#f08a24 0 7px,#140f0c 7px 11px)' },
  { id: 'carbon', tier: 'mid', name: 'Carbon', pat: 5, c: ['#0b0c0f', '#3e434c'], metal: 0.4, rough: 0.22,
    sw: 'repeating-linear-gradient(45deg,#0d0e11 0 3px,#30343b 3px 6px),#0d0e11' },
  { id: 'miami', tier: 'mid', name: 'Miami Neon', pat: 6, c: ['#ff3fa4', '#2ad6ff'], metal: 0.3, rough: 0.3, emit: 0.18,
    sw: 'linear-gradient(90deg,#ff3fa4,#9b5cff,#2ad6ff)' },
  { id: 'vicecamo', tier: 'mid', name: 'Vice Camo', pat: 2, c: ['#ff5aae', '#22c3be', '#3b1d52'], metal: 0.2, rough: 0.5,
    sw: 'radial-gradient(circle at 30% 35%,#22c3be 0 22%,transparent 23%),radial-gradient(circle at 72% 68%,#3b1d52 0 20%,transparent 21%),#ff5aae' },
  { id: 'chrome', tier: 'mid', name: 'Chrome', pat: 7, c: ['#eef2f8'], metal: 1, rough: 0.07,
    sw: 'linear-gradient(160deg,#ffffff,#9aa3ad 45%,#f4f7fb 55%,#6d757f)' },
  { id: 'gold', tier: 'legend', name: 'Gold 24K', pat: 8, c: ['#ffd05a', '#9c6a14'], metal: 1, rough: 0.2,
    sw: 'linear-gradient(160deg,#fff1b8,#ffcf4a 40%,#b37d18 60%,#ffe08a)' },
  { id: 'damascus', tier: 'legend', name: 'Damascus', pat: 9, c: ['#dfe3ea', '#6a707b'], metal: 0.95, rough: 0.28,
    sw: 'repeating-radial-gradient(ellipse at 20% 50%,#d4d9e0 0 3px,#454a53 3px 6px)' },
  { id: 'lava', tier: 'legend', name: 'Lava', pat: 10, c: ['#1b1210', '#ff5a12'], metal: 0.15, rough: 0.65, emit: 2.4, anim: true,
    sw: 'radial-gradient(circle at 40% 45%,#ffb020 0 6%,#ff5a12 14%,transparent 26%),radial-gradient(circle at 75% 70%,#ff5a12 0 8%,transparent 18%),#1b1210' },
  { id: 'galaxy', tier: 'legend', name: 'Galaxy', pat: 11, c: ['#070a26', '#6a2cff', '#ff4fd2'], metal: 0.3, rough: 0.3, emit: 1.6, anim: true,
    sw: 'radial-gradient(circle at 30% 40%,#ff4fd2 0 10%,transparent 32%),radial-gradient(circle at 70% 60%,#6a2cff 0 14%,transparent 40%),#070a26' },
  { id: 'hologram', tier: 'legend', name: 'Hologram', pat: 12, metal: 0.55, rough: 0.18, emit: 0.7, anim: true,
    sw: 'linear-gradient(120deg,#ff5ad8,#ffd75a,#5affb4,#5ac8ff,#b45aff)' },
];
export const WSKIN = Object.fromEntries(WSKINS.map((s) => [s.id, s]));
export const TIER_RANK = { free: 0, mid: 1, legend: 2 };
// skin z mapy gracza (osobno dla każdej broni; '*' = wszystkie bronie – boty)
export const skinFor = (map, gun) => (map && (map[gun] ?? map['*'])) || '';

// ---------------- shader ----------------
const NOISE = `
float wsH(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float wsN(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(mix(wsH(i), wsH(i + vec3(1,0,0)), f.x), mix(wsH(i + vec3(0,1,0)), wsH(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(wsH(i + vec3(0,0,1)), wsH(i + vec3(1,0,1)), f.x), mix(wsH(i + vec3(0,1,1)), wsH(i + vec3(1,1,1)), f.x), f.y), f.z); }
float wsF(vec3 p){ return wsN(p) * .5 + wsN(p * 2.03 + 7.1) * .3 + wsN(p * 4.1 + 3.7) * .2; }
vec3 wsHsv(float h, float s, float v){ vec3 k = clamp(abs(mod(h * 6. + vec3(0., 4., 2.), 6.) - 3.) - 1., 0., 1.); return v * mix(vec3(1.), k, s); }`;
// kolor wzoru w punkcie p (układ modelu broni, metry); e = świecenie wzoru.
// Animacje: zwykłe (uTier 0) stoją, średnie (1) mają subtelny ruch i delikatny błysk co kilka sekund,
// legendarne (2) – mocne efekty: przebiegające błyski, iskry, płynące warstwy, pulsowanie, spadające gwiazdy, skan hologramu.
const PATTERN = `
// błysk przesuwający się wzdłuż broni: speed – ile przejść na sekundę, w – szerokość pasa
float wsSweep(vec3 p, float speed, float w){ float x = fract(p.z * 1.6 + p.y * 1.1 - uTime * speed) - .5; return pow(max(0., 1. - abs(x) / w), 3.); }
vec3 wsPattern(vec3 p, vec3 n, out vec3 e, out float rgh){
  e = vec3(0.); rgh = uRough; vec3 c;
  if (uPat < 1.5) c = uC1;
  else if (uPat < 2.5) {                                                                                           // kamuflaż (Vice Camo: plamy powoli płyną)
    vec3 q = p; if (uTier > .5) q += vec3(sin(uTime * .35) * .006, 0., uTime * .004);
    float v = wsF(q * 16.); c = v < .44 ? uC1 : (v < .58 ? uC2 : uC3); }
  else if (uPat < 3.5) { vec3 q = floor(p * 70.); float v = wsF(q * .23); c = v < .45 ? uC1 : (v < .6 ? uC2 : uC3); }   // cyfrowy
  else if (uPat < 4.5) { float s = sin(p.z * 46. + wsF(p * 9.) * 5.5 + p.y * 12. + sin(uTime * .8) * .35);      // tygrys: pasy lekko falują
    c = mix(uC1, uC2, smoothstep(.35, .55, s)); }
  else if (uPat < 5.5) {                                                                                           // karbon: splot skośny, połysk przesuwa się po włóknach
    vec2 uv = abs(n.x) > .6 ? p.zy : (abs(n.y) > .6 ? p.xz : p.xy); uv *= 140.;
    vec2 cc = floor(uv), f = fract(uv); float dir = mod(cc.x + cc.y, 2.);
    float fib = dir < .5 ? sin(f.x * 3.1416) : sin(f.y * 3.1416);
    float sh = .5 + .5 * sin(uv.x * .08 + uv.y * .05 - uTime * 1.2);
    rgh = mix(.38, .14, fib * (.7 + .3 * sh)); c = mix(uC1, uC2, fib * (.8 + .35 * sh)); }
  else if (uPat < 6.5) { float t = clamp(p.z * 1.6 + .5 + p.y * .8 + sin(uTime * .5) * .18, 0., 1.); c = mix(uC1, uC2, t);   // neon Miami: kolory się przelewają
    float line = smoothstep(.96, 1., sin(p.z * 60. - uTime * 1.5) * .5 + .5) * .7; e = c * (uEmit * (.8 + .2 * sin(uTime * 2.)) + line); }
  else if (uPat < 7.5) { c = uC1; float sw = wsSweep(p, .22, .16); rgh = mix(uRough, .02, sw); e = vec3(.9, .95, 1.) * sw * .35; }   // chrom: przesuwający się odblask
  else if (uPat < 8.5) {                                                                                           // złoto: grawer, mocny przebiegający błysk, migoczące iskry, delikatna poświata
    float g = wsF(p * 38.); float eng = smoothstep(.03, .0, abs(fract(g * 6.) - .5) - .44);
    rgh = mix(uRough, .55, eng); c = mix(uC1, uC2, eng * .85 + wsN(p * 60.) * .12);
    float sw = wsSweep(p, .45, .2); vec3 cell = floor(p * 170.);
    float sp = step(.985, wsH(cell)) * pow(max(0., sin(uTime * 3.5 + wsH(cell + 2.) * 40.)), 10.);
    e = uC1 * (sw * 2.2 + (.25 + .15 * sin(uTime * 1.8)) * .25 * (1. - eng)) + vec3(1., .92, .7) * sp * 5.; rgh = mix(rgh, .05, sw); }
  else if (uPat < 9.5) {                                                                                           // damast: warstwy stali płyną, zimny błysk przebiega po krawędziach
    float b = sin(p.z * 170. + wsF(p * 16. + vec3(0., 0., uTime * .08)) * 10. + p.y * 70. - uTime * 2.5);
    c = mix(uC2, uC1, smoothstep(-.5, .9, b) * .75 + .15);
    float sw = wsSweep(p, .35, .22); e = vec3(.55, .75, 1.) * (sw * 1.6 * smoothstep(.2, .9, b) + .06 * (.5 + .5 * sin(uTime * 2. + p.z * 30.))); rgh = mix(uRough, .08, sw); }
  else if (uPat < 10.5) {                                                                                          // lawa: płynące żyły, mocne pulsowanie, iskry
    float v1 = 1. - abs(wsN(p * 9. + vec3(0., uTime * .22, uTime * .1)) * 2. - 1.), v2 = 1. - abs(wsN(p * 22. + 3.1 + vec3(uTime * .05)) * 2. - 1.);
    float crack = smoothstep(.86, .97, max(v1, v2 * .97)); float pulse = .55 + .45 * sin(uTime * 3.2 + p.z * 24.);
    vec3 ec = floor(p * 110. + vec3(0., uTime * 1.5, 0.)); float ember = step(.993, wsH(ec)) * (.5 + .5 * sin(uTime * 9. + wsH(ec + 3.) * 20.));
    e = uC2 * crack * uEmit * pulse * 1.3 + vec3(1., .55, .15) * ember * 3.; rgh = mix(uRough, .3, crack);
    c = mix(uC1 * (.7 + wsN(p * 40.) * .8), uC2 * .6, crack); }
  else if (uPat < 11.5) {                                                                                          // galaktyka: dryfująca mgławica, migające gwiazdy, spadające gwiazdy
    float neb = wsF(p * 7. + vec3(uTime * .09, uTime * .05, 0.));
    c = mix(uC1, uC2, smoothstep(.35, .7, neb)); c = mix(c, uC3, smoothstep(.62, .85, wsF(p * 11. + 4. + vec3(0., 0., uTime * .06))));
    vec3 cell = floor(p * 260.); float st = step(.992, wsH(cell)); float tw = pow(.5 + .5 * sin(uTime * 6. + wsH(cell + 1.) * 40.), 3.);
    float sy = fract(floor(uTime * .5) * .37) - .5; float streak = smoothstep(.012, .0, abs(p.y - sy * .2)) * wsSweep(p, .5, .07);
    e = vec3(1.) * st * tw * uEmit * 1.4 + c * (.15 + .1 * sin(uTime * 1.3)) + vec3(1., .9, 1.) * streak * 4.; c += st * .6; }
  else {                                                                                                           // hologram: szybka tęcza, linie skanu, zakłócenia
    float h = fract(p.z * 2.4 + p.y * 3. + wsF(p * 6.) * .6 + uTime * .35); c = wsHsv(h, .6, .95);
    float scan = step(.9, fract(p.y * 90. - uTime * 3.)); float glitch = step(.97, wsH(vec3(floor(uTime * 12.), 0., 0.)));
    e = c * uEmit * (.45 + scan * 1.4 + glitch * 1.5); }
  if (uTier > .5 && uTier < 1.5 && abs(uPat - 7.) > .5) e += vec3(1., .96, .9) * wsSweep(p, .16, .08) * .11;   // średnie: delikatny błysk co kilka sekund
  return c;
}`;

const TIME = { value: 0 };                        // wspólny czas animowanych skinów (aktualizowany przy rysowaniu)
const tick = () => { TIME.value = performance.now() / 1000; };
const cache = new WeakMap();                       // materiał bazowy → Map(id skina → materiał ze skinem)

function skinned(base, sk) {
  let m = cache.get(base); if (!m) { m = new Map(); cache.set(base, m); }
  let mat = m.get(sk.id); if (mat) return mat;
  mat = base.clone();
  const col = (i) => new THREE.Color((sk.c && (sk.c[i] || sk.c[0])) || '#ffffff');
  const U = { uPat: { value: sk.pat }, uC1: { value: col(0) }, uC2: { value: col(1) }, uC3: { value: col(2) },
    uMetal: { value: sk.metal ?? 0.3 }, uRough: { value: sk.rough ?? 0.5 }, uEmit: { value: sk.emit || 0 }, uTier: { value: TIER_RANK[sk.tier] || 0 }, uTime: TIME };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'varying vec3 vWsPos;\nvarying vec3 vWsN;\n' + sh.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWsPos = position;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvWsN = objectNormal;');
    sh.fragmentShader = 'uniform float uPat, uMetal, uRough, uEmit, uTier, uTime;\nuniform vec3 uC1, uC2, uC3;\nvarying vec3 vWsPos;\nvarying vec3 vWsN;\n' + NOISE + PATTERN + '\n' + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 wsBase = diffuseColor.rgb;
        float wsMx = max(wsBase.r, max(wsBase.g, wsBase.b)), wsMn = min(wsBase.r, min(wsBase.g, wsBase.b));
        float wsMask = 1. - smoothstep(.32, .6, (wsMx - wsMn) / max(wsMx, .02));          // metal i plastik tak, drewno i kolorowe detale nie
        float wsL = dot(wsBase, vec3(.2126, .7152, .0722));
        float wsDetail = mix(.55, 1.35, clamp(wsL * 7., 0., 1.));                           // krawędzie i zarysowania z oryginalnej tekstury
        vec3 wsEmit; float wsRgh;
        vec3 wsCol = wsPattern(vWsPos, normalize(vWsN), wsEmit, wsRgh);
        diffuseColor.rgb = mix(wsBase, wsCol * wsDetail, wsMask);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, wsRgh, wsMask);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, uMetal, wsMask);')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += wsEmit * wsMask;
        if (uPat > 11.5) { float wsRim = 1. - abs(dot(normalize(normal), normalize(vViewPosition))); totalEmissiveRadiance += wsHsv(fract(wsRim * 1.3 + uTime * .2), .6, 1.) * pow(wsRim, 2.) * uEmit * wsMask; }`);
  };
  mat.customProgramCacheKey = () => 'wskin';   // wzór wybiera uniform uPat – jeden program dla wszystkich skinów (rozgrzany przy wczytywaniu)
  mat.userData.wskin = sk.id;
  m.set(sk.id, mat); return mat;
}
// czy materiał nadaje się pod skin: bez szkła i kolimatorów (przezroczyste), bez płomienia wylotu (MeshBasicMaterial)
const skinnable = (mt) => mt && (mt.isMeshStandardMaterial || mt.isMeshPhysicalMaterial) && !mt.transparent && !/glass|lens|reticle|szk/i.test(mt.name || '');

// nakłada skin na instancję broni z createWeapon (inst.group albo sama grupa); '' = wygląd fabryczny
export function applyWeaponSkin(inst, id) {
  const root = inst && (inst.group || inst); if (!root || !root.traverse) return;
  const sk = WSKIN[id || ''] || WSKIN[''];
  root.traverse((o) => {
    if (!o.isMesh || o.userData.gear) return;
    if (Array.isArray(o.material)) return;
    const base = o.userData.wsBase || o.material;
    if (!skinnable(base)) return;
    o.userData.wsBase = base;
    o.material = sk.pat ? skinned(base, sk) : base;
    o.onBeforeRender = sk.tier !== 'free' ? tick : THREE.Mesh.prototype.onBeforeRender;   // średnie i legendarne są animowane
  });
  root.userData.wskin = sk.id;
}

// ---------------- wybór gracza i dostęp ----------------
const KEY = 'fasolka-wskins';
let sel = {}; try { sel = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { sel = {}; }
let rank = 0;                                       // najwyższy dostępny próg (0 free, 1 mid, 2 legend) – ustawia Ekwipunek z salda gracza
export const allowed = (id) => { const s = WSKIN[id || '']; return !!s && TIER_RANK[s.tier] <= rank; };
export function setWskinRank(r) { const n = Math.max(0, Math.min(2, r | 0)); if (n === rank) return; rank = n; changed(); }
export const wskinRank = () => rank;
// skin, który gracz ma wybrany dla broni (zablokowany = fabryczny)
export const mySkin = (gun) => { const id = sel[gun] || ''; return allowed(id) ? id : ''; };
// mapa do wysłania na serwer (tylko dostępne skiny)
export const mySkins = () => Object.fromEntries(Object.keys(sel).filter((g) => sel[g] && allowed(sel[g])).map((g) => [g, sel[g]]));
export const chosen = (gun) => sel[gun] || '';
export function chooseSkin(gun, id) {
  if (!WSKIN[id || '']) return;
  if (id) sel[gun] = id; else delete sel[gun];
  try { localStorage.setItem(KEY, JSON.stringify(sel)); } catch {}
  changed();
}
function changed() { try { dispatchEvent(new CustomEvent('fasolka:wskin', { detail: mySkins() })); } catch {} }
