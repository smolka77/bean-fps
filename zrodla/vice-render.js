// Rysowanie map Vice z danych vice-kit.js: atlas tekstur malowany w canvas (zero pobierania), wypalone cienie słońca
// (mapa wysokości wzdłuż promieni słońca, liczona raz przy wczytaniu), niebo z chmurami, ocean, mokry asfalt odbijający niebo,
// poświaty neonów i niewidoczne siatki kolizji do szybkich trafień kul.
// Plik NIE importuje three.js – dostaje THREE od gry, więc w bundlu i w podglądzie jest jedna kopia biblioteki.
//
//   const R = buildViceMap(THREE, VICE, { renderer });
//   scene.add(R.group);            // grupa mapy (widoczność włącza/wyłącza gra)
//   R.hitMeshes / R.ground         // do raycastów (kule, kamera)
//   R.apply({ scene, sun, hemi })  // światła, mgła i kierunek słońca tej mapy;  R.restore() przywraca poprzednie
//
// Budżet (wymagania mapy): 1 materiał + 1 atlas (2048) + atlas emisji (1024) + mapa cieni (1024), brak świateł poza słońcem
// i niebem, mapa nie rzuca cieni liczonych na żywo (tylko je przyjmuje – cienie postaci), zero pracy na klatkę poza wodą i niebem.
import { ATLAS, TILE_NAMES, SIGNS, rng } from './vice-kit.js';

// ---------------- ustawienia oświetlenia (presety) ----------------
const PRESETS = {
  sunset: {
    sunDir: [0.78, 0.4, -0.48], sunColor: 0xffa860, sunI: 2.7, hemiSky: 0x8f84e0, hemiGround: 0x7a4a5a, hemiI: 1.2, shadowMin: 0.0, wet: 0.22, envI: 0.3,
    fog: [0xc77a9c, 60, 255], farFog: [130, 500, 0.7], emissive: 1.2,
    glass: [0xa898e0, 0xffa884], farGround: 0x5a3a5a,
    sky: { stops: [[-12, 0xc77a9c], [0, 0xffa070], [3, 0xff8a6e], [9, 0xe8648a], [20, 0xa04a90], [38, 0x5a3488], [60, 0x33246e], [90, 0x1c1650]], sunEl: 6, sunSize: 26,
      glow: 0xffc070, clouds: 34, cloudLit: 0xffb070, cloudLit2: 0xff6f9a, cloudBody: 0x7a3e86, cloudDark: 0x4a2a6a, stars: 0, anti: 0x6a5ac8, antiK: 0.6 },
  },
  dusk: {
    sunDir: [-0.62, 0.55, 0.56], sunColor: 0xa898ff, sunI: 1.35, hemiSky: 0x7a76d8, hemiGround: 0x4a3458, hemiI: 1.55, shadowMin: 0.18, wet: 0.42, envI: 0.25,
    fog: [0x4a2e6e, 55, 240], farFog: [120, 480, 0.6], emissive: 1.35,
    glass: [0x3c3a7a, 0xd0609a], farGround: 0x2a2038,
    sky: { stops: [[-12, 0x4a2e6e], [0, 0xd8507e], [5, 0xa8407e], [14, 0x6a2e82], [30, 0x3a226e], [55, 0x1c1650], [90, 0x0b0c2a]], sunEl: -4, sunSize: 0,
      glow: 0xff6a6a, clouds: 26, cloudLit: 0xff7a9a, cloudLit2: 0xc060b0, cloudBody: 0x4a2c6a, cloudDark: 0x2c1c4a, stars: 520, moon: { az: 0.9, el: 32 }, anti: 0x3a3a9a, antiK: 0.45 },
  },
};
function resolveEnv(e = {}) {
  const P = PRESETS[e.preset || 'sunset'], o = { ...P, ...e, sky: { ...P.sky, ...(e.sky || {}) } };
  const l = Math.hypot(...o.sunDir); o.sunDir = o.sunDir.map((v) => v / l);
  return o;
}
const hex = (c) => '#' + (c >>> 0).toString(16).padStart(6, '0');
const rgba = (c, a) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
const mixc = (a, b, t) => { const r = (x, s) => (x >> s) & 255; const f = (s) => Math.round(r(a, s) + (r(b, s) - r(a, s)) * t); return (f(16) << 16) | (f(8) << 8) | f(0); };

// ================= atlas tekstur =================
const S = 256 - 2 * ATLAS.pad;          // rozmiar części malowanej kafla (px)
function paintAtlas(env) {
  const N = ATLAS.n, T = ATLAS.px / N, pad = ATLAS.pad;
  const cd = document.createElement('canvas'); cd.width = cd.height = ATLAS.px;
  const ce = document.createElement('canvas'); ce.width = ce.height = ATLAS.px;
  const gd = cd.getContext('2d'), ge = ce.getContext('2d');
  ge.fillStyle = '#000'; ge.fillRect(0, 0, ATLAS.px, ATLAS.px);
  TILE_NAMES.forEach((name, i) => {
    const x = (i % N) * T + pad, y = ((i / N) | 0) * T + pad, R = rng(1000 + i * 77);
    for (const g of [gd, ge]) { g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, S, S); g.clip(); }
    const P = PAINT[name]; if (P) P(gd, ge, R, env); else { gd.fillStyle = '#f0f'; gd.fillRect(0, 0, S, S); }
    gd.restore(); ge.restore();
    // margines: przedłużenie krawędzi (bez przeciekania sąsiednich kafli przy mipmapach)
    for (const [g, c] of [[gd, cd], [ge, ce]]) {
      g.drawImage(c, x, y, S, 1, x, y - pad, S, pad); g.drawImage(c, x, y + S - 1, S, 1, x, y + S, S, pad);
      g.drawImage(c, x, y - pad, 1, S + 2 * pad, x - pad, y - pad, pad, S + 2 * pad); g.drawImage(c, x + S - 1, y - pad, 1, S + 2 * pad, x + S, y - pad, pad, S + 2 * pad);
    }
  });
  // atlas emisji w połowie rozdzielczości (wystarcza, 4 MB mniej pamięci GPU)
  const ce2 = document.createElement('canvas'); ce2.width = ce2.height = ATLAS.px / 2;
  const g2 = ce2.getContext('2d'); g2.imageSmoothingQuality = 'high'; g2.drawImage(ce, 0, 0, ATLAS.px / 2, ATLAS.px / 2);
  return { diffuse: cd, emissive: ce2 };
}
// --- pomocnicze malowanie ---
function speck(g, R, cols, n, a = 1, b = 3, w = S, h = S) { for (let i = 0; i < n; i++) { g.fillStyle = cols[(R() * cols.length) | 0]; const s = a + R() * (b - a); g.fillRect(R() * w, R() * h, s, s * (0.6 + R() * 0.8)); } }
function blot(g, R, col, n, r0, r1, alpha) { for (let i = 0; i < n; i++) { const x = R() * S, y = R() * S, r = r0 + R() * (r1 - r0), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(col, alpha)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); } }
function vgrad(g, x, y, w, h, stops) { const gr = g.createLinearGradient(0, y, 0, y + h); stops.forEach(([t, c]) => gr.addColorStop(t, typeof c === 'number' ? hex(c) : c)); g.fillStyle = gr; g.fillRect(x, y, w, h); }
function fill(g, c) { g.fillStyle = typeof c === 'number' ? hex(c) : c; g.fillRect(0, 0, S, S); }
function stuccoBase(g, R, base = 0xf1ece5) { fill(g, base); blot(g, R, 0xffffff, 10, 20, 60, 0.12); blot(g, R, 0xc8bcb0, 10, 20, 70, 0.08); speck(g, R, ['rgba(0,0,0,.05)', 'rgba(255,255,255,.12)'], 900, 1, 2); }
function glassFill(g, x, y, w, h, top, bot, R) {
  vgrad(g, x, y, w, h, [[0, top], [0.55, mixc(top, bot, 0.6)], [1, bot]]);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.moveTo(x + w * 0.15, y + h); g.lineTo(x + w * 0.45, y); g.lineTo(x + w * 0.62, y); g.lineTo(x + w * 0.32, y + h); g.fill();
  g.fillStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.moveTo(x + w * 0.55, y + h); g.lineTo(x + w * 0.8, y); g.lineTo(x + w * 0.86, y); g.lineTo(x + w * 0.61, y + h); g.fill();
  g.restore();
}
function neonText(g, e, text, x, y, w, h, col, font, opt = {}) {
  let size = h * (opt.scale || 0.62); g.font = `${font.replace('$', size)}`;
  while (g.measureText(text).width > w * 0.9 && size > 6) { size -= 1; g.font = font.replace('$', size); }
  for (const [c, glow] of [[g, false], [e, true]]) {
    c.save(); c.font = font.replace('$', size); c.textAlign = 'center'; c.textBaseline = 'middle';
    if (glow) { c.shadowColor = hex(col); c.shadowBlur = h * 0.35; c.fillStyle = hex(mixc(col, 0xffffff, 0.35)); c.fillText(text, x, y); c.shadowBlur = 0; c.fillStyle = hex(mixc(col, 0xffffff, 0.6)); c.fillText(text, x, y); }
    else { c.lineWidth = Math.max(2, size * 0.09); c.strokeStyle = hex(mixc(col, 0x000000, 0.35)); c.strokeText(text, x, y); c.fillStyle = hex(mixc(col, 0xffffff, 0.45)); c.fillText(text, x, y); }
    c.restore();
  }
}
const SANS = '900 $px "Arial Black", "Segoe UI Black", Impact, sans-serif', SCRIPT = 'italic 700 $px "Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive', DECO = '700 $px "Bahnschrift", "Futura", "Century Gothic", "Arial Narrow", sans-serif';
const SIGN_STYLE = {
  'OCEAN HOTEL': [0x22e6ff, DECO], FLAMINGO: [0xff3fa4, SCRIPT], 'CORAL CLUB': [0xff8a5c, DECO], SUNSET: [0xffb43c, SCRIPT],
  DINER: [0xff3a5a, SCRIPT], MOTEL: [0x39ff88, SANS], 'SURF SHOP': [0x22e6ff, SCRIPT], 'OPEN 24H': [0xff2d95, SANS],
  PIZZA: [0xff9a3c, SCRIPT], LIQUOR: [0xff3a5a, SANS], ARCADE: [0xb44dff, SANS], TACOS: [0xffe14a, SCRIPT],
  HOTEL: [0xff2d95, DECO], BAR: [0x22e6ff, DECO], CLUB: [0xb44dff, DECO], PARK: [0x39b8ff, SANS],
};
const NEON_COLS = [0xff2d95, 0x22e6ff, 0xb44dff, 0xff9a3c, 0x39ff88, 0xffe14a, 0xfff6e8, 0xff3040];
function palmSil(g, x, y, s, col) {
  g.fillStyle = col; g.strokeStyle = col; g.lineWidth = s * 0.06;
  g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + s * 0.15, y - s * 0.5, x + s * 0.05, y - s); g.stroke();
  for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.48; g.beginPath(); g.moveTo(x + s * 0.05, y - s); g.quadraticCurveTo(x + s * 0.05 + Math.cos(a) * s * 0.35, y - s + Math.sin(a) * s * 0.35 - s * 0.08, x + s * 0.05 + Math.cos(a) * s * 0.55, y - s + Math.sin(a) * s * 0.3 + s * 0.12); g.lineWidth = s * 0.05; g.stroke(); }
}

const PAINT = {
  // ---- podłoża ----
  asphalt(g, e, R) {
    fill(g, 0x5a5560); speck(g, R, ['#4c4752', '#65606a', '#6e6874', '#46414c', '#585260'], 2600, 1, 3);
    blot(g, R, 0x2a2630, 3, 10, 30, 0.18);
    g.strokeStyle = 'rgba(40,34,46,.55)'; g.lineWidth = 1.3;
    for (let k = 0; k < 3; k++) { g.beginPath(); let x = R() * S, y = R() * S; g.moveTo(x, y); for (let j = 0; j < 6; j++) { x += (R() - 0.5) * 40; y += (R() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
  },
  asphalt_wet(g, e, R) {
    fill(g, 0x3e3a48); speck(g, R, ['#36323f', '#474351', '#4f4a59', '#3a3644'], 2200, 1, 3);
    for (let k = 0; k < 4; k++) { const x = R() * S, y = R() * S, rx = 20 + R() * 45, ry = 10 + R() * 22; g.fillStyle = 'rgba(28,24,38,.75)'; g.beginPath(); g.ellipse(x, y, rx, ry, R() * 3, 0, Math.PI * 2); g.fill(); }
  },
  sidewalk(g, e, R) {
    const n = 2, w = S / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = hex(mixc(0xd2c8c4, R() < 0.5 ? 0xc4b8b4 : 0xdcd2ce, R())); g.fillRect(i * w, j * w, w, w); }
    speck(g, R, ['rgba(0,0,0,.06)', 'rgba(255,255,255,.1)'], 1400, 1, 2);
    g.fillStyle = '#a89c98'; for (let i = 0; i <= n; i++) { g.fillRect(i * w - 1.5, 0, 3, S); g.fillRect(0, i * w - 1.5, S, 3); }
  },
  plaza(g, e, R) {
    fill(g, 0xefe6da); speck(g, R, ['rgba(0,0,0,.05)', 'rgba(255,255,255,.2)', 'rgba(200,120,140,.15)'], 1800, 1, 2.5);
    const c = S / 2;
    g.fillStyle = '#e8a6b8'; g.beginPath(); g.moveTo(c, 18); g.lineTo(S - 18, c); g.lineTo(c, S - 18); g.lineTo(18, c); g.closePath(); g.fill();
    g.fillStyle = '#efe6da'; g.beginPath(); g.moveTo(c, 40); g.lineTo(S - 40, c); g.lineTo(c, S - 40); g.lineTo(40, c); g.closePath(); g.fill();
    g.fillStyle = '#7fcac4'; g.beginPath(); g.moveTo(c, 62); g.lineTo(S - 62, c); g.lineTo(c, S - 62); g.lineTo(62, c); g.closePath(); g.fill();
    for (const [x, y] of [[0, 0], [S, 0], [0, S], [S, S]]) { g.fillStyle = '#e8a6b8'; g.beginPath(); g.moveTo(x, y - 30); g.lineTo(x + 30, y); g.lineTo(x, y + 30); g.lineTo(x - 30, y); g.fill(); }
    g.strokeStyle = 'rgba(160,140,130,.5)'; g.lineWidth = 2; g.strokeRect(1, 1, S - 2, S - 2);
  },
  sand(g, e, R) {
    fill(g, 0xeed29e); speck(g, R, ['#e4c48e', '#f6deb0', '#e8ca94', '#d8b882', '#f2d8a6'], 4200, 1, 2.2);
    g.strokeStyle = 'rgba(255,240,210,.45)'; g.lineWidth = 2;
    for (let k = 0; k < 7; k++) { const y0 = R() * S; g.beginPath(); for (let x = -10; x <= S + 10; x += 8) g.lineTo(x, y0 + Math.sin(x * 0.05 + k) * 5); g.stroke(); }
    speck(g, R, ['#fff4e0', '#c8a27a', '#e8b0a0'], 25, 2, 4);
  },
  sand_wet(g, e, R) {
    fill(g, 0xc9a678); speck(g, R, ['#bf9c6e', '#d2b084', '#b89466', '#d8bc90'], 3000, 1, 2);
    g.strokeStyle = 'rgba(255,250,240,.25)'; g.lineWidth = 3; for (let k = 0; k < 4; k++) { const y0 = R() * S; g.beginPath(); for (let x = -10; x <= S + 10; x += 10) g.lineTo(x, y0 + Math.sin(x * 0.03 + k * 2) * 8); g.stroke(); }
  },
  boardwalk(g, e, R) {
    const n = 6, h = S / n;
    for (let i = 0; i < n; i++) { g.fillStyle = hex(mixc(0xb98c60, R() < 0.5 ? 0xa37650 : 0xc89a6c, R())); g.fillRect(0, i * h, S, h); g.strokeStyle = 'rgba(80,50,30,.18)'; g.lineWidth = 1; for (let k = 0; k < 4; k++) { const y = i * h + 4 + R() * (h - 8); g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(S * 0.3, y + 2, S * 0.6, y - 2, S, y); g.stroke(); } }
    g.fillStyle = '#4a3424'; for (let i = 0; i <= n; i++) g.fillRect(0, i * h - 1.5, S, 3);
    g.fillStyle = 'rgba(40,30,20,.6)'; for (let i = 0; i < n; i++) for (const x of [10, S - 12]) { g.fillRect(x, i * h + h * 0.3, 3, 3); g.fillRect(x, i * h + h * 0.65, 3, 3); }
  },
  grass(g, e, R) { fill(g, 0x5a9244); for (let i = 0; i < 3200; i++) { g.fillStyle = ['#4c8538', '#68a24e', '#76ae58', '#5a9a44', '#3f7a30'][(R() * 5) | 0]; g.fillRect(R() * S, R() * S, 1.5, 3 + R() * 4); } },
  // ---- podłogi i dachy ----
  concrete(g, e, R) { fill(g, 0xbdb7b1); speck(g, R, ['#b2aca6', '#c6c0ba', '#aaa49e'], 2000, 1, 2.5); blot(g, R, 0x8a8480, 4, 20, 50, 0.08); g.fillStyle = 'rgba(90,84,80,.35)'; g.fillRect(0, 0, S, 2); g.fillRect(0, 0, 2, S); },
  roof(g, e, R) { fill(g, 0xb0a9a1); speck(g, R, ['#9e978f', '#c2bbb3', '#a8a199', '#8e8780', '#cfc8c0'], 5200, 1, 2.5); blot(g, R, 0x6a6460, 4, 15, 40, 0.1); },
  parking(g, e, R) { PAINT.asphalt(g, e, R); g.fillStyle = '#ece8de'; g.fillRect(0, 0, 9, S); g.fillRect(0, 0, S * 0.3, 8); },
  tile_check(g, e, R) { const n = 4, w = S / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? '#26222c' : '#f2efe8'; g.fillRect(i * w, j * w, w, w); } speck(g, R, ['rgba(255,255,255,.08)', 'rgba(0,0,0,.06)'], 600, 1, 2); },
  tile_terra(g, e, R) { const n = 3, w = S / n; fill(g, 0xe6d6c4); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = hex(mixc(0xc66a48, 0xd88a5e, R())); g.fillRect(i * w + 2, j * w + 2, w - 4, w - 4); } speck(g, R, ['rgba(0,0,0,.06)'], 700, 1, 2); },
  wood_floor(g, e, R) { const n = 5, w = S / n; for (let i = 0; i < n; i++) { const off = R() * S; for (let k = -1; k < 2; k++) { g.fillStyle = hex(mixc(0x9a6a44, 0xb8845a, R())); g.fillRect(i * w, off + k * S * 0.6, w, S * 0.6); } } g.fillStyle = 'rgba(50,30,20,.5)'; for (let i = 0; i <= n; i++) g.fillRect(i * w - 1, 0, 2, S); speck(g, R, ['rgba(60,40,20,.12)'], 600, 1, 4); },
  pool(g, e, R) { fill(g, 0x3fc2d6); g.fillStyle = 'rgba(160,240,250,.55)'; for (let i = 0; i <= 8; i++) { g.fillRect(i * S / 8 - 1, 0, 2, S); g.fillRect(0, i * S / 8 - 1, S, 2); } g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; for (let k = 0; k < 9; k++) { g.beginPath(); const y0 = R() * S; for (let x = 0; x <= S; x += 12) g.lineTo(x, y0 + Math.sin(x * 0.08 + k) * 6); g.stroke(); } },
  carpet(g, e, R) { fill(g, 0x5a1f3e); g.strokeStyle = '#d4a84a'; g.lineWidth = 3; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const cx = (i + 0.5) * S / 2, cy = (j + 1) * S / 2; for (let r = 18; r < 60; r += 14) { g.beginPath(); g.arc(cx, cy, r, Math.PI, 0); g.stroke(); } } speck(g, R, ['rgba(0,0,0,.12)'], 800, 1, 2); },
  // ---- ściany (jasne, barwione kolorem wierzchołków) ----
  stucco(g, e, R) { stuccoBase(g, R); },
  plaster(g, e, R) { fill(g, 0xf4efe9); blot(g, R, 0xd8d0c8, 6, 30, 70, 0.06); speck(g, R, ['rgba(0,0,0,.03)'], 500, 1, 2); },
  brick(g, e, R) {
    fill(g, 0xd8cfc4); const rows = 8, h = S / rows, w = S / 4;
    for (let r = 0; r < rows; r++) for (let k = -1; k < 5; k++) { const x = k * w + (r % 2 ? w / 2 : 0); g.fillStyle = hex([0xa4523c, 0xb05e44, 0x94493a, 0xb86a4c, 0x9c5040][(R() * 5) | 0]); g.fillRect(x + 1.5, r * h + 1.5, w - 3, h - 3); }
    speck(g, R, ['rgba(0,0,0,.1)', 'rgba(255,220,200,.08)'], 1200, 1, 2);
  },
  concrete_wall(g, e, R) { fill(g, 0xaaa6a4); speck(g, R, ['#a09c9a', '#b4b0ae', '#98948f'], 1800, 1, 2.5); blot(g, R, 0x6a6662, 5, 20, 60, 0.08); g.fillStyle = 'rgba(70,66,64,.4)'; g.fillRect(0, S / 2 - 1, S, 2); g.fillRect(0, 0, S, 2); g.fillRect(0, 0, 2, S); for (const x of [S * 0.25, S * 0.75]) for (const y of [S * 0.25, S * 0.75]) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); } },
  corrugated(g, e, R) { const n = 16, w = S / n; for (let i = 0; i < n; i++) { const gr = g.createLinearGradient(i * w, 0, (i + 1) * w, 0); gr.addColorStop(0, '#d4d8dc'); gr.addColorStop(0.5, '#a8aeb4'); gr.addColorStop(1, '#8e949a'); g.fillStyle = gr; g.fillRect(i * w, 0, w, S); } blot(g, R, 0x8a5a3a, 3, 10, 30, 0.12); },
  wood_wall(g, e, R) { const n = 6, w = S / n; for (let i = 0; i < n; i++) { g.fillStyle = hex(mixc(0xe0d2bc, 0xc8b89e, R())); g.fillRect(i * w, 0, w, S); g.strokeStyle = 'rgba(90,70,50,.15)'; for (let k = 0; k < 3; k++) { const x = i * w + 4 + R() * (w - 8); g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 3, S * 0.3, x - 3, S * 0.6, x, S); g.stroke(); } } g.fillStyle = 'rgba(60,44,30,.55)'; for (let i = 0; i <= n; i++) g.fillRect(i * w - 1.5, 0, 3, S); },
  glassblock(g, e, R) { fill(g, 0xeef2f2); const n = 4, w = S / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const x = i * w + 4, y = j * w + 4; vgrad(g, x, y, w - 8, w - 8, [[0, '#e6f6fc'], [1, '#9ccde4']]); g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(x + 4, y + 4, (w - 8) * 0.35, 4); } },
  tiles_wall(g, e, R) { fill(g, 0xc8c8c2); const n = 6, w = S / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = hex(mixc(0xf6f6f0, 0xe8ece8, R())); g.fillRect(i * w + 1.5, j * w + 1.5, w - 3, w - 3); } },
  // ---- okna i witryny (jedno przęsło elewacji na kafel) ----
  win_deco(g, e, R, env) { winDeco(g, e, R, env, false); },
  win_deco_lit(g, e, R, env) { winDeco(g, e, R, env, true); },
  win_office(g, e, R, env) { winOffice(g, e, R, env, false); },
  win_office_lit(g, e, R, env) { winOffice(g, e, R, env, true); },
  win_brick(g, e, R, env) { winBrick(g, e, R, env, false); },
  win_brick_lit(g, e, R, env) { winBrick(g, e, R, env, true); },
  shopfront(g, e, R, env) { shop(g, e, R, env, false); },
  shopfront_lit(g, e, R, env) { shop(g, e, R, env, true); },
  // ---- detale ----
  door(g, e, R) { fill(g, 0xf0ebe4); g.fillStyle = '#2f6f7a'; g.fillRect(S * 0.12, S * 0.06, S * 0.76, S * 0.94); g.fillStyle = '#e8e0d4'; g.fillRect(S * 0.49, S * 0.06, S * 0.02, S * 0.94); for (const x of [0.18, 0.55]) { glassFill(g, S * x, S * 0.14, S * 0.27, S * 0.4, 0x9ab8d8, 0xe8b0a8, R); g.fillStyle = '#245a62'; g.fillRect(S * x, S * 0.6, S * 0.27, S * 0.3); } g.fillStyle = '#d8c080'; g.fillRect(S * 0.43, S * 0.58, S * 0.04, S * 0.08); g.fillRect(S * 0.53, S * 0.58, S * 0.04, S * 0.08); },
  shutter(g, e, R) { for (let y = 0; y < S; y += 8) { vgrad(g, 0, y, S, 8, [[0, '#b2b8c0'], [0.6, '#8c929a'], [1, '#6e747c']]); } g.fillStyle = '#4a4e56'; g.fillRect(S * 0.42, S - 16, S * 0.16, 8); blot(g, R, 0x6a4a3a, 2, 10, 30, 0.1); },
  garage_door(g, e, R) { for (let i = 0; i < 4; i++) { vgrad(g, 0, i * S / 4, S, S / 4, [[0, '#f0eeea'], [0.85, '#d8d4ce'], [1, '#9a968f']]); } speck(g, R, ['rgba(0,0,0,.05)'], 400, 1, 2); },
  vent(g, e, R) { fill(g, 0xd6d2ce); g.fillStyle = '#3a3a40'; g.beginPath(); g.arc(S * 0.5, S * 0.5, S * 0.36, 0, 7); g.fill(); g.strokeStyle = '#8a8a90'; g.lineWidth = 4; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(S * 0.5, S * 0.5); g.lineTo(S * 0.5 + Math.cos(k) * S * 0.34, S * 0.5 + Math.sin(k) * S * 0.34); g.stroke(); } g.strokeStyle = '#b8b4b0'; g.lineWidth = 3; for (let r = 0.12; r < 0.36; r += 0.08) { g.beginPath(); g.arc(S * 0.5, S * 0.5, S * r, 0, 7); g.stroke(); } },
  metal(g, e, R) { fill(g, 0xb0b4ba); for (let i = 0; i < 260; i++) { g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.08)'; g.fillRect(0, R() * S, S, 1); } },
  diamond(g, e, R) { fill(g, 0x9aa0a8); g.fillStyle = '#c4cad2'; for (let y = 0; y < S; y += 20) for (let x = (y / 20) % 2 ? 10 : 0; x < S; x += 20) { g.save(); g.translate(x, y); g.rotate(0.7); g.fillRect(-7, -2, 14, 4); g.restore(); } },
  container(g, e, R) { fill(g, 0xd0d0d0); const n = 12, w = S / n; for (let i = 0; i < n; i++) { const gr = g.createLinearGradient(i * w, 0, (i + 1) * w, 0); gr.addColorStop(0, '#e4e4e4'); gr.addColorStop(0.5, '#c0c0c0'); gr.addColorStop(1, '#a4a4a4'); g.fillStyle = gr; g.fillRect(i * w, 10, w, S - 20); } g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, S, 10); g.fillRect(0, S - 10, S, 10); blot(g, R, 0x7a4a2a, 4, 8, 22, 0.25); },
  stripes_red(g, e, R) { fill(g, 0xf4f1ea); g.fillStyle = '#d63a3a'; for (let k = -S; k < S * 2; k += 46) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 23, 0); g.lineTo(k + 23 - S, S); g.lineTo(k - S, S); g.fill(); } },
  // ---- szyldy i neony (świecą) ----
  signs_a(g, e) { signRows(g, e, SIGNS.signs_a); }, signs_b(g, e) { signRows(g, e, SIGNS.signs_b); }, signs_c(g, e) { signRows(g, e, SIGNS.signs_c); },
  signs_v(g, e) {
    fill(g, 0x1a1424);
    SIGNS.signs_v.forEach((t, i) => { const [c, f] = SIGN_STYLE[t] || [0xff2d95, SANS], w = S / 4, n = t.length; for (let k = 0; k < n; k++) neonText(g, e, t[k], i * w + w / 2, (k + 0.5) * S / Math.max(n, 4), w, S / Math.max(n, 4), c, f, { scale: 0.8 }); });
  },
  neon(g, e) { NEON_COLS.forEach((c, i) => { const y = i * S / 8, h = S / 8; for (const [x, k] of [[g, 0.25], [e, 0]]) { vgrad(x, 0, y, S, h, [[0, mixc(c, 0x000000, 0.25)], [0.3, mixc(c, 0xffffff, k + 0.2)], [0.5, mixc(c, 0xffffff, 0.55)], [0.7, mixc(c, 0xffffff, k + 0.2)], [1, mixc(c, 0x000000, 0.25)]]); } }); },
  billboard_a(g, e) {
    for (const [x, a] of [[g, 1], [e, 0.55]]) {
      x.save(); x.globalAlpha = a;
      vgrad(x, 0, 0, S, S * 0.62, [[0, '#2b1055'], [0.55, '#d6246e'], [1, '#ff9e3d']]);
      const gr = x.createLinearGradient(0, S * 0.18, 0, S * 0.6); gr.addColorStop(0, '#ffe25a'); gr.addColorStop(1, '#ff4f8f'); x.fillStyle = gr; x.beginPath(); x.arc(S * 0.5, S * 0.56, S * 0.27, Math.PI, 0); x.fill();
      x.fillStyle = '#d6246e'; for (let k = 0; k < 5; k++) x.fillRect(0, S * (0.42 + k * 0.035), S, 2 + k * 1.2);
      vgrad(x, 0, S * 0.6, S, S * 0.4, [[0, '#2a0a3a'], [1, '#12041e']]);
      x.strokeStyle = '#ff2d95'; x.lineWidth = 1.5; for (let k = 0; k < 9; k++) { x.beginPath(); x.moveTo(S * 0.5, S * 0.6); x.lineTo((k - 4) * S * 0.35 + S * 0.5, S); x.stroke(); } for (let k = 0; k < 6; k++) { const y = S * 0.6 + Math.pow(k / 6, 1.8) * S * 0.4; x.beginPath(); x.moveTo(0, y); x.lineTo(S, y); x.stroke(); }
      palmSil(x, S * 0.12, S * 0.66, S * 0.42, '#14061e'); palmSil(x, S * 0.86, S * 0.66, S * 0.36, '#14061e');
      x.restore();
    }
    neonText(g, e, 'SUNSET FM', S * 0.5, S * 0.14, S * 0.9, S * 0.2, 0x22e6ff, SCRIPT, { scale: 0.85 });
    neonText(g, e, '99.1', S * 0.5, S * 0.84, S * 0.5, S * 0.16, 0xffffff, SANS, { scale: 0.8 });
  },
  billboard_b(g, e) {
    for (const [x, a] of [[g, 1], [e, 0.5]]) {
      x.save(); x.globalAlpha = a; vgrad(x, 0, 0, S, S, [[0, '#3fd8d0'], [1, '#1a8a9a']]);
      x.fillStyle = 'rgba(255,255,255,.35)'; for (let k = 0; k < 26; k++) { x.beginPath(); x.arc((k * 53) % S, (k * 97) % S, 3 + (k % 5) * 2, 0, 7); x.fill(); }
      const cx = S * 0.68; vgrad(x, cx - 34, S * 0.2, 68, S * 0.66, [[0, '#ff7ab0'], [0.5, '#ff2d7a'], [1, '#b8105a']]); x.fillStyle = '#e8e8f0'; x.fillRect(cx - 34, S * 0.17, 68, 12); x.fillRect(cx - 34, S * 0.85, 68, 10);
      x.restore();
    }
    neonText(g, e, 'FIZZ', S * 0.68, S * 0.52, 60, 60, 0xffffff, SANS, { scale: 0.5 });
    neonText(g, e, 'STAY', S * 0.28, S * 0.36, S * 0.5, S * 0.2, 0xffffff, SANS, { scale: 0.8 });
    neonText(g, e, 'COOL', S * 0.28, S * 0.58, S * 0.5, S * 0.2, 0xffe14a, SANS, { scale: 0.8 });
  },
  billboard_c(g, e) {
    for (const [x, a] of [[g, 1], [e, 0.5]]) {
      x.save(); x.globalAlpha = a; vgrad(x, 0, 0, S, S, [[0, '#120a2a'], [0.6, '#3a1458'], [1, '#e04a7a']]);
      x.fillStyle = '#ffd0e8'; for (let k = 0; k < 40; k++) x.fillRect((k * 61) % S, (k * 37) % (S * 0.5), 2, 2);
      x.fillStyle = '#0a0612'; x.beginPath(); x.moveTo(S * 0.12, S * 0.86); x.lineTo(S * 0.3, S * 0.74); x.lineTo(S * 0.62, S * 0.72); x.lineTo(S * 0.86, S * 0.8); x.lineTo(S * 0.9, S * 0.88); x.lineTo(S * 0.12, S * 0.9); x.fill();
      x.fillStyle = '#ff3a5a'; x.fillRect(S * 0.82, S * 0.82, S * 0.06, 5);
      x.restore();
    }
    neonText(g, e, 'NIGHT', S * 0.5, S * 0.26, S * 0.85, S * 0.22, 0xb44dff, SANS, { scale: 0.85 });
    neonText(g, e, 'DRIVE', S * 0.5, S * 0.47, S * 0.85, S * 0.22, 0x22e6ff, SANS, { scale: 0.85 });
  },
  // ---- rośliny, tkaniny, auta ----
  palm_frond(g, e, R) {
    g.clearRect(0, 0, S, S); const c = S / 2;
    for (let i = 0; i < 30; i++) {
      const t = i / 30, y = S - t * S, L = (S / 2 - 4) * Math.sin(Math.min(1, t * 1.25 + 0.12) * Math.PI) * (0.85 + R() * 0.15);
      for (const s of [-1, 1]) {
        g.fillStyle = hex(mixc(0x3a7028, 0x74ae4c, t * 0.5 + R() * 0.4));
        g.beginPath(); g.moveTo(c, y); g.quadraticCurveTo(c + s * L * 0.55, y - L * 0.32, c + s * L, y - L * 0.5); g.quadraticCurveTo(c + s * L * 0.5, y - L * 0.2 + 5, c, y + 6); g.fill();
      }
    }
    g.strokeStyle = '#5a6a30'; g.lineWidth = 5; g.beginPath(); g.moveTo(c, S); g.lineTo(c, 4); g.stroke();
  },
  bark(g, e, R) { for (let y = 0; y < S; y += 14.5) { vgrad(g, 0, y, S, 14.5, [[0, '#9a7a5e'], [0.6, '#7e604a'], [1, '#4e3a2c']]); } speck(g, R, ['rgba(40,30,20,.25)', 'rgba(220,200,170,.15)'], 900, 1, 3); },
  foliage(g, e, R) { fill(g, 0x3f7a30); for (let i = 0; i < 520; i++) { const x = R() * S, y = R() * S, r = 5 + R() * 11; g.fillStyle = ['#2f6a24', '#4f8a3a', '#5f9a48', '#6aa850', '#3a7428'][(R() * 5) | 0]; g.beginPath(); g.ellipse(x, y, r, r * 0.7, R() * 3, 0, 7); g.fill(); } },
  umbrella(g, e) { const C = [0xff6fa0, 0x3fb7b0, 0xffd34e, 0xa070d8], w = S / 4; C.forEach((c, i) => { for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? '#f8f4ee' : hex(c); g.fillRect(i * w + k * w / 6, 0, w / 6 + 0.5, S); } vgrad(g, i * w, S * 0.88, w, S * 0.12, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.25)']]); }); },
  fabric(g, e, R) { fill(g, 0xece4d8); for (let i = 0; i < S; i += 4) { g.fillStyle = 'rgba(0,0,0,.04)'; g.fillRect(i, 0, 2, S); g.fillRect(0, i, S, 2); } },
  car_body(g, e, R) { vgrad(g, 0, 0, S, S, [[0, '#ffffff'], [0.42, '#e8e8e8'], [0.48, '#c4c4c8'], [0.75, '#d0d0d4'], [1, '#9a9aa0']]); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(0, S * 0.12, S, 3); },
  car_parts(g, e, R, env) {
    const h = S / 2, q = S / 4;
    vgrad(g, 0, 0, h, h, [[0, hex(mixc(env.glass[0], 0x101828, 0.45))], [0.5, hex(mixc(env.glass[1], 0x101828, 0.55))], [1, '#141a26']]);
    g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(0, h * 0.18, h, h * 0.08);
    g.fillStyle = '#18161e'; g.fillRect(h, 0, h, q); for (const x of [0.12, 0.62]) { g.fillStyle = '#fff6dc'; g.fillRect(h + h * x, q * 0.2, h * 0.26, q * 0.6); e.fillStyle = '#fff4d0'; e.fillRect(h + h * x, q * 0.2, h * 0.26, q * 0.6); }
    g.fillStyle = '#2a0c12'; g.fillRect(h, q, h, q); g.fillStyle = '#e8203c'; g.fillRect(h + 4, q + 6, h - 8, q - 12); e.fillStyle = '#ff2040'; e.fillRect(h + 4, q + 6, h - 8, q - 12);
    for (let y = h; y < h + q; y += 7) vgrad(g, 0, y, h, 7, [[0, '#e0e0e6'], [0.5, '#5a5a64'], [1, '#2a2a30']]);
    vgrad(g, h, h, h, q, [[0, '#f4f4f8'], [0.5, '#a0a0a8'], [1, '#e0e0e6']]);
    g.fillStyle = '#f4f0e4'; g.fillRect(0, h + q, h, q); g.fillStyle = '#2a4a8a'; g.font = '700 22px "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('OCEAN 86', h / 2, h + q * 1.5);
    g.fillStyle = '#1c1c22'; g.fillRect(h, h + q, h, q);
  },
  tire(g, e) { const h = S / 2; fill(g, 0x1c1c20); g.fillStyle = '#26262a'; g.beginPath(); g.arc(h / 2, S / 2, h * 0.48, 0, 7); g.fill(); g.fillStyle = '#c8ccd2'; g.beginPath(); g.arc(h / 2, S / 2, h * 0.3, 0, 7); g.fill(); g.strokeStyle = '#6a6e76'; g.lineWidth = 6; for (let k = 0; k < 5; k++) { const a = k * 1.2566; g.beginPath(); g.moveTo(h / 2, S / 2); g.lineTo(h / 2 + Math.cos(a) * h * 0.28, S / 2 + Math.sin(a) * h * 0.28); g.stroke(); } g.fillStyle = '#2c2c30'; for (let y = 0; y < S; y += 16) { g.fillRect(h, y, h, 6); } },
  white(g) { fill(g, 0xffffff); }, dark(g) { fill(g, 0x1a1620); },
  glow(g) { const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, '#9a9a9a'); gr.addColorStop(0.6, '#2a2a2a'); gr.addColorStop(1, '#000000'); g.fillStyle = gr; g.fillRect(0, 0, S, S); },
  water(g, e, R) { vgrad(g, 0, 0, S, S, [[0, '#2fb4c8'], [1, '#1a7a9a']]); g.strokeStyle = 'rgba(220,255,255,.4)'; g.lineWidth = 2; for (let k = 0; k < 12; k++) { g.beginPath(); const y0 = R() * S; for (let x = 0; x <= S; x += 10) g.lineTo(x, y0 + Math.sin(x * 0.1 + k) * 4); g.stroke(); } },
  chainlink(g) { g.clearRect(0, 0, S, S); g.strokeStyle = '#a4acb4'; g.lineWidth = 2.2; const d = S / 12; for (let k = -12; k <= 24; k++) { g.beginPath(); g.moveTo(k * d, 0); g.lineTo(k * d + S, S); g.stroke(); g.beginPath(); g.moveTo(k * d, 0); g.lineTo(k * d - S, S); g.stroke(); } g.fillStyle = '#8a929a'; g.fillRect(0, 0, S, 5); g.fillRect(0, S - 5, S, 5); },
  graffiti(g, e, R) {
    fill(g, 0xd8d0c8); speck(g, R, ['rgba(0,0,0,.06)'], 600, 1, 2);
    const C = ['#ff2d95', '#22e6ff', '#ffe14a', '#39ff88', '#b44dff', '#ff9a3c'];
    for (let k = 0; k < 7; k++) { const x = R() * S, y = S * 0.3 + R() * S * 0.5, r = 14 + R() * 26; g.fillStyle = C[k % C.length]; g.strokeStyle = '#1a1424'; g.lineWidth = 4; g.beginPath(); for (let j = 0; j < 7; j++) { const a = (j / 7) * Math.PI * 2; g.lineTo(x + Math.cos(a) * r * (0.7 + R() * 0.5), y + Math.sin(a) * r * 0.6 * (0.7 + R() * 0.5)); } g.closePath(); g.fill(); g.stroke(); g.fillRect(x - 2, y + r * 0.4, 3, 10 + R() * 20); }
  },
  skyline(g, e, R) {
    fill(g, 0x9090a8); const cols = 6, rows = 8, w = S / cols, h = S / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const x = i * w + w * 0.2, y = j * h + h * 0.22, ww = w * 0.6, hh = h * 0.56, on = R() < 0.55; const c = on ? (R() < 0.7 ? '#ffd88a' : '#a8e0ff') : '#3a3a52'; g.fillStyle = c; g.fillRect(x, y, ww, hh); if (on) { e.fillStyle = c; e.globalAlpha = 0.85; e.fillRect(x, y, ww, hh); e.globalAlpha = 1; } }
  },
  lightpanel(g, e) { fill(g, 0xfffaf0); e.fillStyle = '#fff0d0'; e.fillRect(0, 0, S, S); },
};
function winDeco(g, e, R, env, lit) {
  stuccoBase(g, R);
  const x = S * 0.2, y = S * 0.2, w = S * 0.6, h = S * 0.52;
  vgrad(g, x - 10, y - 22, w + 20, 16, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(60,40,60,.28)']]);
  g.fillStyle = '#fbfaf6'; g.fillRect(x - 7, y - 7, w + 14, h + 14);
  if (lit) {
    vgrad(g, x, y, w, h, [[0, '#ffd890'], [1, '#ff9a5c']]); g.fillStyle = 'rgba(120,40,60,.35)'; g.fillRect(x, y, w * 0.22, h); g.fillRect(x + w * 0.78, y, w * 0.22, h);
    vgrad(e, x, y, w, h, [[0, '#ffc870'], [1, '#ff8a48']]); e.fillStyle = 'rgba(0,0,0,.55)'; e.fillRect(x, y, w * 0.22, h); e.fillRect(x + w * 0.78, y, w * 0.22, h);
  } else glassFill(g, x, y, w, h, env.glass[0], env.glass[1], R);
  g.fillStyle = '#fbfaf6'; g.fillRect(x + w / 2 - 3, y, 6, h); g.fillRect(x, y + h * 0.32 - 3, w, 6);
  if (lit) { e.fillStyle = '#000'; e.fillRect(x + w / 2 - 3, y, 6, h); e.fillRect(x, y + h * 0.32 - 3, w, 6); }
  g.fillStyle = '#ffffff'; g.fillRect(x - 12, y + h + 7, w + 24, 8); vgrad(g, x - 12, y + h + 15, w + 24, 12, [[0, 'rgba(60,40,50,.22)'], [1, 'rgba(0,0,0,0)']]);
}
function winOffice(g, e, R, env, lit) {
  fill(g, 0xc8c4c0); speck(g, R, ['rgba(0,0,0,.06)'], 400, 1, 2);
  const y0 = S * 0.04, h = S * 0.76;
  if (lit) {
    for (let k = 0; k < 3; k++) { const on = R() < 0.8, c = on ? (R() < 0.5 ? 0xfff0c8 : 0xe0ecff) : 0x2a3448; vgrad(g, k * S / 3, y0, S / 3, h, [[0, hex(c)], [1, hex(mixc(c, 0x806040, 0.3))]]); if (on) { vgrad(e, k * S / 3, y0, S / 3, h, [[0, hex(mixc(c, 0, 0.1))], [1, hex(mixc(c, 0, 0.45))]]); } }
  } else glassFill(g, 0, y0, S, h, mixc(env.glass[0], 0x203048, 0.35), mixc(env.glass[1], 0x203048, 0.4), R);
  g.fillStyle = '#5a6068'; for (const x of [0, S / 3, 2 * S / 3, S]) g.fillRect(x - 3, 0, 6, S); g.fillRect(0, y0 - 3, S, 6); g.fillRect(0, y0 + h, S, 6);
}
function winBrick(g, e, R, env, lit) {
  PAINT.brick(g, e, R);
  const x = S * 0.24, y = S * 0.22, w = S * 0.52, h = S * 0.5;
  g.fillStyle = '#d8d0c4'; g.fillRect(x - 10, y - 18, w + 20, 14); g.fillRect(x - 8, y + h + 2, w + 16, 10);
  g.fillStyle = '#f4f0ea'; g.fillRect(x - 5, y - 5, w + 10, h + 10);
  if (lit) { vgrad(g, x, y, w, h, [[0, '#ffe0a0'], [1, '#ffa060']]); vgrad(e, x, y, w, h, [[0, '#ffd080'], [1, '#ff9040']]); }
  else vgrad(g, x, y, w, h, [[0, hex(mixc(env.glass[0], 0x202838, 0.5))], [1, hex(mixc(env.glass[1], 0x202838, 0.55))]]);
  g.fillStyle = '#f4f0ea'; g.fillRect(x + w / 2 - 2.5, y, 5, h); g.fillRect(x, y + h / 2 - 2.5, w, 5);
  if (lit) { e.fillStyle = '#000'; e.fillRect(x + w / 2 - 2.5, y, 5, h); e.fillRect(x, y + h / 2 - 2.5, w, 5); }
}
function shop(g, e, R, env, lit) {
  fill(g, 0xe8e2da); g.fillStyle = '#2a2232'; g.fillRect(0, 0, S, S * 0.17);
  const y = S * 0.2, h = S * 0.7;
  g.fillStyle = '#3a3440'; g.fillRect(0, y - 6, S, h + 12);
  if (lit) {
    vgrad(g, 6, y, S - 12, h, [[0, '#fff0d0'], [1, '#ffb070']]); vgrad(e, 6, y, S - 12, h, [[0, '#ffe8c0'], [1, '#ff9a50']]);
    g.fillStyle = 'rgba(120,60,80,.35)'; for (let k = 0; k < 3; k++) { const yy = y + h * (0.3 + k * 0.22); g.fillRect(10, yy, S * 0.36, 5); g.fillRect(S * 0.62, yy, S * 0.34, 5); }
    e.fillStyle = '#ff2d95'; e.fillRect(S * 0.1, S * 0.07, S * 0.8, 4); g.fillStyle = '#ff6fb0'; g.fillRect(S * 0.1, S * 0.07, S * 0.8, 4);
  } else glassFill(g, 6, y, S - 12, h, mixc(env.glass[0], 0x283040, 0.45), mixc(env.glass[1], 0x283040, 0.5), R);
  g.fillStyle = '#3a3440'; g.fillRect(S * 0.38, y, S * 0.24, h); vgrad(g, S * 0.4, y + 4, S * 0.2, h - 4, [[0, lit ? '#ffe0b0' : '#4a5a70'], [1, lit ? '#e09060' : '#2a3040']]);
  if (lit) vgrad(e, S * 0.4, y + 4, S * 0.2, h - 4, [[0, '#ffd8a0'], [1, '#c07040']]);
  g.fillStyle = '#c8c0b8'; g.fillRect(S * 0.555, y + h * 0.5, 4, 18);
  g.fillStyle = '#2a2430'; g.fillRect(0, S * 0.92, S, S * 0.08);
}
function signRows(g, e, list) {
  fill(g, 0x1a1424);
  list.forEach((t, i) => { const [c, f] = SIGN_STYLE[t] || [0xff2d95, SANS], h = S / 4; neonText(g, e, t, S / 2, (i + 0.5) * h, S, h, c, f, { scale: f === SCRIPT ? 0.8 : 0.62 }); });
}

// ================= niebo (equirect na kopule) =================
const SKY_THETA = 0.62;     // kopuła od zenitu do 21,6° pod horyzontem
function paintSky(env) {
  const W = 2048, H = 1024, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), sk = env.sky, R = rng(4242);
  const yOf = (el) => ((90 - el) / (SKY_THETA * 180)) * H;     // elewacja (°) -> wiersz (kopuła obejmuje kąt SKY_THETA·π od zenitu)
  const gr = g.createLinearGradient(0, 0, 0, H);
  const stops = sk.stops.slice().sort((a, b) => b[0] - a[0]);
  for (const [el, col] of stops) gr.addColorStop(Math.min(1, Math.max(0, yOf(el) / H)), hex(col));
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // kierunek słońca: azymut z kierunku światła, elewacja „wizualna" z ustawień nieba
  const d = env.sunDir, phi = Math.atan2(d[2], -d[0]), su = ((phi / (Math.PI * 2)) % 1 + 1) % 1, sx = su * W, sy = yOf(sk.sunEl);
  for (const ox of [-W, 0, W]) {
    let r = g.createRadialGradient(sx + ox, sy, 0, sx + ox, sy, W * 0.32);
    r.addColorStop(0, rgba(sk.glow, 0.85)); r.addColorStop(0.3, rgba(sk.glow, 0.35)); r.addColorStop(1, rgba(sk.glow, 0));
    g.save(); g.translate(sx + ox, sy); g.scale(1, 0.38); g.translate(-(sx + ox), -sy); g.fillStyle = r; g.fillRect(sx + ox - W * 0.32, sy - W * 0.32, W * 0.64, W * 0.64); g.restore();
  }
  // gwiazdy (noc)
  for (let i = 0; i < (sk.stars || 0); i++) { const x = R() * W, y = Math.pow(R(), 1.6) * H * 0.42, a = 0.35 + R() * 0.65; g.fillStyle = `rgba(255,245,255,${a * (1 - y / (H * 0.45))})`; const s = R() < 0.08 ? 2.2 : 1.2; g.fillRect(x, y, s, s); }
  if (sk.moon) { const mx = ((((Math.atan2(d[2], -d[0]) + Math.PI + sk.moon.az) / (Math.PI * 2)) % 1 + 1) % 1) * W, my = yOf(sk.moon.el); const mr = 26; const gl = g.createRadialGradient(mx, my, 0, mx, my, mr * 4); gl.addColorStop(0, 'rgba(255,230,255,.45)'); gl.addColorStop(1, 'rgba(255,230,255,0)'); g.fillStyle = gl; g.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8); g.fillStyle = '#fff4f0'; g.beginPath(); g.arc(mx, my, mr, 0, 7); g.fill(); g.fillStyle = hex(sk.stops.find((s) => s[0] >= sk.moon.el)?.[1] || 0x1c1650); g.beginPath(); g.arc(mx + mr * 0.45, my - mr * 0.15, mr * 0.92, 0, 7); g.fill(); }
  // strona nieba odwrócona od słońca: chłodniejsza i ciemniejsza (fiolet/granat), jak na obrazkach referencyjnych
  if (sk.anti) for (const ox of [-W, 0, W]) {
    const ax = sx + W / 2 + ox, r = g.createRadialGradient(ax, yOf(20), 0, ax, yOf(20), W * 0.42);
    r.addColorStop(0, rgba(sk.anti, sk.antiK || 0.55)); r.addColorStop(1, rgba(sk.anti, 0));
    g.save(); g.globalCompositeOperation = 'multiply'; g.translate(ax, yOf(20)); g.scale(1, 0.6); g.translate(-ax, -yOf(20)); g.fillStyle = r; g.fillRect(ax - W * 0.42, yOf(20) - W * 0.42, W * 0.84, W * 0.84); g.restore();
  }
  // chmury: płaskie od dołu, oświetlone od strony słońca; każda malowana na osobnej warstwie, potem nakładana na niebo
  const cc = document.createElement('canvas'), cg = cc.getContext('2d');
  for (let i = 0; i < sk.clouds; i++) {
    // połowa chmur skupiona wokół słońca (jak na referencjach), reszta rozrzucona; kłębiaste, płaskie od spodu
    const cx = i % 2 ? sx + (R() - 0.5) * W * 0.55 : R() * W, el = 2 + Math.pow(R(), 1.3) * 26, cy = yOf(el);
    const w = (50 + R() * 150) * (1 + (30 - el) / 45), h = (12 + R() * 26) * (1 - el / 60);
    let du = Math.abs(cx - sx); du = Math.min(du, W - du); const near = Math.max(0, 1 - du / (W * 0.3));
    const lit = mixc(sk.cloudLit2, sk.cloudLit, near), body = mixc(sk.cloudDark, sk.cloudBody, 0.35 + near * 0.65);
    const cw = Math.ceil(w * 1.4), ch = Math.ceil(h * 3.4); cc.width = cw; cc.height = ch; cg.clearRect(0, 0, cw, ch);
    cg.save(); cg.translate(cw / 2, ch * 0.86);
    const n = 4 + ((R() * 5) | 0);
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1) - 0.5, px = t * w * 0.9, ph = h * (1.15 - Math.abs(t) * 1.1) * (0.7 + R() * 0.6), pw = w * (0.14 + R() * 0.14);
      cg.fillStyle = hex(body); cg.beginPath(); cg.ellipse(px, 0, pw, Math.max(4, ph), 0, Math.PI, 0); cg.fill();
      cg.beginPath(); cg.ellipse(px + pw * 0.3, -ph * 0.45, pw * 0.7, Math.max(3, ph * 0.75), 0, Math.PI, 0); cg.fill();
    }
    const lg = cg.createLinearGradient(0, -h * 1.5, 0, 1); lg.addColorStop(0, rgba(lit, 0)); lg.addColorStop(0.55, rgba(lit, 0.35 + near * 0.45)); lg.addColorStop(1, rgba(mixc(lit, 0xffffff, 0.35), 0.95));
    cg.globalCompositeOperation = 'source-atop'; cg.fillStyle = lg; cg.fillRect(-cw / 2, -ch, cw, ch * 1.2);
    // jasna krawędź od strony słońca
    const side = Math.sign(((cx - sx + W * 1.5) % W) - W / 2) || 1, eg = cg.createLinearGradient(-side * w * 0.6, 0, side * w * 0.2, 0);
    eg.addColorStop(0, rgba(mixc(lit, 0xffffff, 0.2), 0.55 * near)); eg.addColorStop(1, rgba(lit, 0)); cg.fillStyle = eg; cg.fillRect(-cw / 2, -ch, cw, ch * 1.2);
    cg.restore(); cg.globalCompositeOperation = 'source-over';
    for (const ox of [-W, 0, W]) g.drawImage(cc, cx + ox - cw / 2, cy - ch * 0.86);
  }
  // tarcza słońca (na wierzchu chmur)
  if (sk.sunSize > 0) {
    for (const ox of [-W, 0, W]) {
      const r = g.createRadialGradient(sx + ox, sy, 0, sx + ox, sy, sk.sunSize * 3.2); r.addColorStop(0, 'rgba(255,250,220,1)'); r.addColorStop(0.3, 'rgba(255,236,170,.95)'); r.addColorStop(0.36, rgba(sk.glow, 0.6)); r.addColorStop(1, rgba(sk.glow, 0));
      g.fillStyle = r; g.fillRect(sx + ox - sk.sunSize * 3.2, sy - sk.sunSize * 3.2, sk.sunSize * 6.4, sk.sunSize * 6.4);
    }
  }
  // dolny pas mgły (płynne przejście w mgłę sceny)
  const fg = g.createLinearGradient(0, yOf(3), 0, yOf(-8)); fg.addColorStop(0, rgba(env.fog[0], 0)); fg.addColorStop(1, rgba(env.fog[0], 1));
  g.fillStyle = fg; g.fillRect(0, yOf(3), W, H - yOf(3));
  return c;
}

// ================= wypalone cienie (mapa wysokości wzdłuż promieni słońca) =================
// Teksel (u,v) = punkt na ziemi G; promień G + t·słońce. R = najwyższe wyjście promienia z bryły (m / HS), G = cień na ziemi (rozmyty),
// B = okluzja przy podstawach brył. Punkt P jest w cieniu, gdy P.y < R(G'), gdzie G' = P - P.y·(słońce.xz / słońce.y).
const HS = 0.16;            // m na stopień jasności w kanale R (0..40,8 m)
function bakeShadows(G, env, bounds, N = 1024) {
  const s = env.sunDir, kx = s[0] / s[1], kz = s[2] / s[1], maxH = 32, m = 8;
  let x0 = bounds[0] - m, z0 = bounds[1] - m, x1 = bounds[2] + m, z1 = bounds[3] + m;
  if (kx > 0) x0 -= kx * maxH; else x1 -= kx * maxH; if (kz > 0) z0 -= kz * maxH; else z1 -= kz * maxH;
  const size = Math.max(x1 - x0, z1 - z0), cell = size / N;
  const Hm = new Float32Array(N * N), A = new Float32Array(N * N).fill(1);
  const ray = (gx, gz, b) => {           // b: [x0,y0,z0,x1,y1,z1] w lokalnym układzie promienia
    let t0 = 0, t1 = 1e9;
    for (let k = 0; k < 3; k++) {
      const o = k === 0 ? gx : k === 1 ? 0 : gz, d = s[k], lo = b[k], hi = b[k + 3];
      if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return -1; continue; }
      let a = (lo - o) / d, c = (hi - o) / d; if (a > c) { const q = a; a = c; c = q; }
      if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) return -1;
    }
    return t1 * s[1];
  };
  const rast = (b, rot) => {
    // rzut narożników na ziemię wzdłuż słońca -> zakres tekseli
    let ga = Infinity, gb = Infinity, gc = -Infinity, gd = -Infinity;
    const cs = rot ? Math.cos(rot.yaw) : 1, sn = rot ? Math.sin(rot.yaw) : 0;
    for (const X of [b[0], b[3]]) for (const Y of [b[1], b[4]]) for (const Z of [b[2], b[5]]) {
      let wx = X, wz = Z; if (rot) { const lx = X - rot.cx, lz = Z - rot.cz; wx = rot.cx + cs * lx + sn * lz; wz = rot.cz - sn * lx + cs * lz; }
      const gx = wx - Y * kx, gz = wz - Y * kz; ga = Math.min(ga, gx); gb = Math.min(gb, gz); gc = Math.max(gc, gx); gd = Math.max(gd, gz);
    }
    const i0 = Math.max(0, Math.floor((ga - x0) / cell)), i1 = Math.min(N - 1, Math.ceil((gc - x0) / cell)), j0 = Math.max(0, Math.floor((gb - z0) / cell)), j1 = Math.min(N - 1, Math.ceil((gd - z0) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      let gx = x0 + (i + 0.5) * cell, gz = z0 + (j + 0.5) * cell, h;
      if (rot) {   // promień w układzie bryły (obrót wokół Y): obracamy punkt startu i kierunek
        const lx = gx - rot.cx, lz = gz - rot.cz, px = rot.cx + cs * lx - sn * lz, pz = rot.cz + sn * lx + cs * lz;
        const dx = cs * s[0] - sn * s[2], dz = sn * s[0] + cs * s[2];
        let t0 = 0, t1 = 1e9, ok = true;
        for (const [o, d, lo, hi] of [[px, dx, b[0], b[3]], [0, s[1], b[1], b[4]], [pz, dz, b[2], b[5]]]) {
          if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { ok = false; break; } continue; }
          let a = (lo - o) / d, c = (hi - o) / d; if (a > c) { const q = a; a = c; c = q; } if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) { ok = false; break; }
        }
        h = ok ? t1 * s[1] : -1;
      } else h = ray(gx, gz, b);
      if (h > Hm[j * N + i]) Hm[j * N + i] = h;
    }
  };
  for (const b of G.shadowBoxes) rast(b, null);
  for (const [cx, cy, cz, hx, hy, hz, yaw] of G.casters) rast([cx - hx, cy - hy, cz - hz, cx + hx, cy + hy, cz + hz], Math.abs(yaw) > 1e-3 ? { yaw, cx, cz } : null);
  // okluzja przy podstawach (auta, ściany, murki): ciemniej w promieniu 1 m od obrysu
  const D = 1.1;
  for (const b of G.shadowBoxes) {
    if (b[1] > 0.12 || b[4] < 0.35) continue;
    const i0 = Math.max(0, Math.floor((b[0] - D - x0) / cell)), i1 = Math.min(N - 1, Math.ceil((b[3] + D - x0) / cell)), j0 = Math.max(0, Math.floor((b[2] - D - z0) / cell)), j1 = Math.min(N - 1, Math.ceil((b[5] + D - z0) / cell));
    const k = Math.min(1, (b[4] - 0.2) / 1.5);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const gx = x0 + (i + 0.5) * cell, gz = z0 + (j + 0.5) * cell, dx = Math.max(b[0] - gx, 0, gx - b[3]), dz = Math.max(b[2] - gz, 0, gz - b[5]), dd = Math.hypot(dx, dz);
      const a = 1 - k * 0.55 * Math.max(0, 1 - dd / D) ** 1.5; if (a < A[j * N + i]) A[j * N + i] = a;
    }
  }
  const M = new Float32Array(N * N); for (let q = 0; q < N * N; q++) M[q] = Hm[q] < 0.25 ? 1 : 0;
  blur(M, N, 2); blur(A, N, 3);
  const data = new Uint8Array(N * N * 4);
  for (let q = 0; q < N * N; q++) { data[q * 4] = Math.min(255, Math.round(Hm[q] / HS)); data[q * 4 + 1] = Math.round(M[q] * 255); data[q * 4 + 2] = Math.round(A[q] * 255); data[q * 4 + 3] = 255; }
  return { data, N, x0, z0, size, kx, kz };
}
function blur(a, N, r) {
  const t = new Float32Array(N * N);
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 0; j < N; j++) { let acc = 0; const row = j * N; for (let i = -r; i <= r; i++) acc += a[row + Math.min(N - 1, Math.max(0, i))]; for (let i = 0; i < N; i++) { t[row + i] = acc / (2 * r + 1); acc += a[row + Math.min(N - 1, i + r + 1)] - a[row + Math.max(0, i - r)]; } }
    for (let i = 0; i < N; i++) { let acc = 0; for (let j = -r; j <= r; j++) acc += t[Math.min(N - 1, Math.max(0, j)) * N + i]; for (let j = 0; j < N; j++) { a[j * N + i] = acc / (2 * r + 1); acc += t[Math.min(N - 1, j + r + 1) * N + i] - t[Math.max(0, j - r) * N + i]; } }
  }
}

// ================= materiały =================
const VERT_PARS = 'varying vec3 vViceW;\nvarying float vViceNy;\n';
const VERT_MAIN = `
vec4 viceW4 = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
viceW4 = instanceMatrix * viceW4;
#endif
viceW4 = modelMatrix * viceW4; vViceW = viceW4.xyz;
vViceNy = normalize( mat3( modelMatrix ) * objectNormal ).y;
`;
const FRAG_PARS = `varying vec3 vViceW;
varying float vViceNy;
uniform sampler2D uShMap; uniform vec4 uShXf; uniform vec2 uSunXZ; uniform float uShMin; uniform float uWet;
uniform vec3 uSkyTop; uniform vec3 uSkyHor; uniform vec3 uSunCol; uniform vec3 uSunDirW; uniform vec3 uFarFogCol; uniform vec3 uFarFog;
`;
const FRAG_SHADOW = `
#include <aomap_fragment>
{
  vec2 suv = ( vViceW.xz - vViceW.y * uSunXZ ) * uShXf.xy + uShXf.zw;
  float ao = 1.0;
  if ( suv.x > 0.001 && suv.x < 0.999 && suv.y > 0.001 && suv.y < 0.999 ) {
    vec4 sh = texture2D( uShMap, suv );
    float hgt = sh.r * ${(255 * HS).toFixed(3)};
    float litH = smoothstep( hgt - 0.7, hgt - 0.3, vViceW.y );
    float up = step( 0.7, vViceNy );
    float k = mix( 1.0, smoothstep( 0.12, 0.55, vViceW.y ), up );
    viceLit = mix( sh.g, litH, k );
    ao = mix( 1.0, mix( 0.5, 1.0, sh.b ), up * ( 1.0 - smoothstep( 0.05, 0.45, vViceW.y ) ) );
  }
  reflectedLight.directDiffuse *= mix( uShMin, 1.0, viceLit ) * ao;
  reflectedLight.indirectDiffuse *= ao;
}
`;
const FRAG_WET = `
if ( uWet > 0.0 && vViceNy > 0.9 && vViceW.y < 0.4 ) {
  vec3 V = normalize( vViceW - cameraPosition );
  vec3 Rf = reflect( V, vec3( 0.0, 1.0, 0.0 ) );
  float fres = pow( 1.0 - max( -V.y, 0.0 ), 3.0 );
  float lum = dot( diffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) );
  float mask = clamp( 1.0 - lum * 4.0, 0.0, 1.0 );
  vec3 sky = mix( uSkyHor, uSkyTop, clamp( Rf.y * 1.6, 0.0, 1.0 ) );
  float sun = pow( max( dot( Rf, uSunDirW ), 0.0 ), 28.0 );
  outgoingLight += ( sky * 0.85 + uSunCol * sun * 1.4 ) * fres * mask * uWet;
}
`;
const FRAG_FAR_FOG = `
#ifdef VICE_FAR
{ float d = length( vViceW - cameraPosition ); gl_FragColor.rgb = mix( gl_FragColor.rgb, uFarFogCol, clamp( ( d - uFarFog.x ) / ( uFarFog.y - uFarFog.x ), 0.0, 1.0 ) * uFarFog.z ); }
#else
#include <fog_fragment>
#endif
`;
function patchLambert(THREE, mat, U, far) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    if (far) sh.defines = { ...(sh.defines || {}), VICE_FAR: 1 };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + VERT_PARS).replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n' + VERT_MAIN);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + FRAG_PARS).replace('void main() {', 'void main() {\nfloat viceLit = 1.0;')
      .replace('#include <aomap_fragment>', far ? '#include <aomap_fragment>' : FRAG_SHADOW)
      .replace('#include <opaque_fragment>', (far ? '' : FRAG_WET) + '#include <opaque_fragment>')
      .replace('#include <fog_fragment>', FRAG_FAR_FOG);
  };
  mat.customProgramCacheKey = () => 'vice' + (far ? 'far' : '') + (mat.alphaTest > 0 ? 'cut' : '');
  return mat;
}

// ================= ocean =================
function makeOcean(THREE, env, sunVis) {
  const o = env.ocean; if (!o) return null;
  const [x0, z0, x1, z1] = o.rect, w = x1 - x0, d = z1 - z0;
  const geo = new THREE.PlaneGeometry(w, d, 1, 1); geo.rotateX(-Math.PI / 2); geo.translate((x0 + x1) / 2, o.y === undefined ? 0.06 : o.y, (z0 + z1) / 2);
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), R = rng(99);
  g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { const x = R() * 256, y = R() * 256, r = 4 + R() * 18, v = (R() * 255) | 0; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${v},${v},${v},.5)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`); for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) { g.save(); g.translate(ox, oy); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); g.restore(); } }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.NoColorSpace;
  const col = (h) => new THREE.Color(h);
  const U = { uTime: { value: 0 }, uTex: { value: tex }, uDeep: { value: col(o.deep || 0x1a3a6a) }, uShallow: { value: col(o.shallow || 0x2fb8b8) }, uHor: { value: col(env.fog[0]) },
    uSkyTop: { value: col(env.sky.stops.find((s) => s[0] >= 30)?.[1] || 0x5a3480) }, uSunDir: { value: new THREE.Vector3(...sunVis) }, uSunCol: { value: col(env.sky.glow) },
    uFog: { value: new THREE.Vector2(env.fog[1], env.fog[2]) }, uShore: { value: new THREE.Vector3(...(o.shore || [1, 0, x0])) } };
  const mat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uTime; uniform sampler2D uTex; uniform vec3 uDeep, uShallow, uHor, uSkyTop, uSunDir, uSunCol; uniform vec2 uFog; uniform vec3 uShore; varying vec3 vW;
      void main(){
        vec3 V = normalize(vW - cameraPosition); float dist = length(vW - cameraPosition);
        vec2 a = vW.xz * 0.05 + vec2(uTime * 0.011, uTime * 0.006), b = vW.xz * 0.13 - vec2(uTime * 0.018, -uTime * 0.012);
        float n1 = texture2D(uTex, a).r, n2 = texture2D(uTex, b).r, n3 = texture2D(uTex, a.yx * 1.7 + 0.3).r;
        float fade = 1.0 - smoothstep(40.0, 220.0, dist);
        vec3 N = normalize(vec3((n1 + n2 - 1.0) * 0.32 * fade, 1.0, (n3 + n2 - 1.0) * 0.32 * fade));
        vec3 R = reflect(V, N); R.y = abs(R.y);
        float fres = 0.05 + 0.95 * pow(1.0 - max(dot(-V, N), 0.0), 4.0);
        float depth = dot(vW.xz, uShore.xy) - uShore.z;
        vec3 base = mix(uShallow, uDeep, smoothstep(0.0, 28.0, depth));
        vec3 sky = mix(uHor, uSkyTop, clamp(R.y * 1.3, 0.0, 1.0));
        vec3 col = mix(base, sky, fres);
        float sd = max(dot(R, uSunDir), 0.0);
        col += uSunCol * (pow(sd, 260.0) * 5.0 + pow(sd, 22.0) * 0.45);
        float foam = smoothstep(3.0, 0.0, depth + (n1 - 0.5) * 3.0 + sin(uTime * 0.7 + vW.x * 0.07 + vW.z * 0.05) * 0.8);
        col = mix(col, vec3(0.95, 0.92, 0.9), foam * 0.75);
        col = mix(col, uHor, smoothstep(uFog.x, uFog.y, dist));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.name = 'vice-ocean';
  const t0 = performance.now(); mesh.onBeforeRender = () => { U.uTime.value = (performance.now() - t0) / 1000; };
  return mesh;
}

// ================= budowa mapy =================
export function buildViceMap(THREE, VICE, opt = {}) {
  const T = { start: performance.now() };
  const env = resolveEnv(VICE.env), bounds = VICE.bounds;
  const G = VICE.geometry(); T.geo = performance.now();
  const atlas = paintAtlas(env); T.atlas = performance.now();
  const tex = new THREE.CanvasTexture(atlas.diffuse); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(8, opt.renderer ? opt.renderer.capabilities.getMaxAnisotropy() : 4);
  const etex = new THREE.CanvasTexture(atlas.emissive); etex.colorSpace = THREE.SRGBColorSpace;
  const SH = bakeShadows(G, env, bounds, opt.shadowRes || 1024); T.shadow = performance.now();
  const stex = new THREE.DataTexture(SH.data, SH.N, SH.N, THREE.RGBAFormat); stex.magFilter = stex.minFilter = THREE.LinearFilter; stex.needsUpdate = true;
  const sunVis = (() => { const d = env.sunDir, h = Math.hypot(d[0], d[2]), el = (env.sky.sunEl * Math.PI) / 180; return [d[0] / h * Math.cos(el), Math.sin(el), d[2] / h * Math.cos(el)]; })();
  const col = (h) => new THREE.Color(h);
  const U = {
    uShMap: { value: stex }, uShXf: { value: new THREE.Vector4(1 / SH.size, 1 / SH.size, -SH.x0 / SH.size, -SH.z0 / SH.size) }, uSunXZ: { value: new THREE.Vector2(SH.kx, SH.kz) },
    uShMin: { value: env.shadowMin }, uWet: { value: env.wet }, uSkyTop: { value: col(env.sky.stops.find((s) => s[0] >= 30)?.[1] || 0x5a3480) }, uSkyHor: { value: col(env.fog[0]) },
    uSunCol: { value: col(env.sky.glow) }, uSunDirW: { value: new THREE.Vector3(...sunVis) }, uFarFogCol: { value: col(env.fog[0]) }, uFarFog: { value: new THREE.Vector3(...env.farFog) },
  };
  const base = { map: tex, emissiveMap: etex, emissive: 0xffffff, emissiveIntensity: env.emissive, vertexColors: true };
  const matOp = patchLambert(THREE, new THREE.MeshLambertMaterial(base), U, false);
  const matCut = patchLambert(THREE, new THREE.MeshLambertMaterial({ ...base, alphaTest: 0.5, side: THREE.DoubleSide }), U, false);
  const matFar = patchLambert(THREE, new THREE.MeshLambertMaterial({ ...base, fog: true }), U, true);
  const matGlow = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
  matGlow.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>', '#ifdef USE_FOG\n float fogF = smoothstep( fogNear, fogFar, vFogDepth );\n gl_FragColor.rgb *= 1.0 - fogF;\n#endif'); };
  const group = new THREE.Group(); group.name = 'vice-' + VICE.name;
  const stats = { meshes: 0, tris: 0, byChan: {} };
  for (const b of G.bufs) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(b.position, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(b.normal, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(b.uv, 2)); geo.setAttribute('color', new THREE.BufferAttribute(b.color, 3)); geo.setIndex(new THREE.BufferAttribute(b.index, 1));
    geo.computeBoundingSphere(); geo.computeBoundingBox();
    const m = b.chan === 'cut' ? matCut : b.chan === 'far' ? matFar : b.chan === 'glow' ? matGlow : matOp;
    const mesh = new THREE.Mesh(geo, m); mesh.name = 'vice-' + b.key; mesh.matrixAutoUpdate = false;
    mesh.receiveShadow = b.chan === 'op' || b.chan === 'cut'; mesh.castShadow = false;
    if (b.chan === 'glow') mesh.renderOrder = 2;
    group.add(mesh); stats.meshes++; stats.tris += b.tris; stats.byChan[b.chan] = (stats.byChan[b.chan] || 0) + b.tris;
  }
  // niebo: kopuła podąża za kamerą (kamera ma far = 300 m)
  const skyTex = new THREE.CanvasTexture(paintSky(env)); skyTex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(240, 48, 20, 0, Math.PI * 2, 0, Math.PI * SKY_THETA), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.name = 'vice-sky'; sky.renderOrder = -10; sky.frustumCulled = false;
  sky.onBeforeRender = (r, s, cam) => { sky.position.copy(cam.position); sky.updateMatrixWorld(true); };
  group.add(sky); stats.meshes++;
  const ocean = makeOcean(THREE, env, sunVis); if (ocean) { group.add(ocean); stats.meshes++; }
  // dalekie podłoże pod horyzontem
  const fg = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshBasicMaterial({ color: env.farGround }));
  fg.rotation.x = -Math.PI / 2; fg.position.y = env.farGroundY === undefined ? -0.08 : env.farGroundY; fg.name = 'vice-farground'; fg.updateMatrix(); fg.matrixAutoUpdate = false; group.add(fg); stats.meshes++;
  // niewidoczne bryły kolizji do raycastów (kule, kamera TPS): sektory po SECTOR m, tylko z kolizjami trafianymi przez kule
  const hitMeshes = [], noHit = new Set(VICE.meta.noHit), sectors = new Map(), SEC = 24;
  VICE.data.colliders.forEach((c, i) => { if (noHit.has(i)) return; const k = Math.floor((c[0] + c[3]) / 2 / SEC) + ',' + Math.floor((c[2] + c[5]) / 2 / SEC); if (!sectors.has(k)) sectors.set(k, []); sectors.get(k).push(c); });
  const hitMat = new THREE.MeshBasicMaterial({ side: THREE.FrontSide });
  for (const [k, list] of sectors) {
    const pos = new Float32Array(list.length * 24), idx = new Uint32Array(list.length * 36);
    // 4 wierzchołki na ścianę (6 ścian), trójkąty zwrócone na zewnątrz
    const F = [[[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]];
    const p2 = new Float32Array(list.length * 72); let v = 0, q = 0;
    list.forEach((c) => { for (const f of F) { const v0 = v; for (const [a, b, d] of f) { p2[v * 3] = a ? c[3] : c[0]; p2[v * 3 + 1] = b ? c[4] : c[1]; p2[v * 3 + 2] = d ? c[5] : c[2]; v++; } idx[q++] = v0; idx[q++] = v0 + 1; idx[q++] = v0 + 2; idx[q++] = v0; idx[q++] = v0 + 2; idx[q++] = v0 + 3; } });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(p2, 3)); geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeBoundingSphere(); geo.computeBoundingBox();
    const mesh = new THREE.Mesh(geo, hitMat); mesh.visible = false; mesh.name = 'vice-hit-' + k; mesh.matrixAutoUpdate = false; mesh.userData.viceHit = true;
    hitMeshes.push(mesh); group.add(mesh);
    void pos;
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(bounds[2] - bounds[0] + 80, bounds[3] - bounds[1] + 80), hitMat);
  ground.rotation.x = -Math.PI / 2; ground.position.set((bounds[0] + bounds[2]) / 2, 0, (bounds[1] + bounds[3]) / 2); ground.updateMatrix(); ground.updateMatrixWorld(true); ground.matrixAutoUpdate = false;
  ground.visible = false; ground.userData.ground = true; ground.name = 'vice-ground'; group.add(ground);
  group.updateMatrixWorld(true);
  T.end = performance.now();
  stats.ms = { geometry: Math.round(T.geo - T.start), atlas: Math.round(T.atlas - T.geo), shadows: Math.round(T.shadow - T.atlas), total: Math.round(T.end - T.start) };
  stats.colliders = VICE.data.colliders.length; stats.spawns = VICE.data.spawns.length; stats.ladders = VICE.data.ladders.length; stats.clips = VICE.data.clips.length;

  // ---- światła, mgła, kierunek słońca tej mapy (gra woła apply/restore przy zmianie mapy) ----
  const sunV = new THREE.Vector3(...env.sunDir);
  let saved = null;
  const apply = (ctx) => {
    const { scene, sun, hemi } = ctx; if (saved) return;
    saved = { fog: scene.fog ? [scene.fog.color.clone(), scene.fog.near, scene.fog.far] : null, bg: scene.background, envI: scene.environmentIntensity, obr: scene.onBeforeRender,
      hemi: hemi ? [hemi.color.clone(), hemi.groundColor.clone(), hemi.intensity] : null, sun: sun ? [sun.color.clone(), sun.intensity] : null };
    if (scene.fog) { scene.fog.color.set(env.fog[0]); scene.fog.near = env.fog[1]; scene.fog.far = env.fog[2]; }
    scene.background = new THREE.Color(env.fog[0]); scene.environmentIntensity = env.envI;
    if (hemi) { hemi.color.set(env.hemiSky); hemi.groundColor.set(env.hemiGround); hemi.intensity = env.hemiI; }
    if (sun) {
      sun.color.set(env.sunColor); sun.intensity = env.sunI;
      // kierunek słońca zgodny z wypalonymi cieniami (gra co klatkę ustawia słońce nad graczem – tu tylko poprawiamy kierunek)
      scene.onBeforeRender = () => { sun.position.copy(sun.target.position).addScaledVector(sunV, 45); sun.updateMatrixWorld(); sun.target.updateMatrixWorld(); };
    }
  };
  const restore = (ctx) => {
    if (!saved) return; const { scene, sun, hemi } = ctx;
    if (scene.fog && saved.fog) { scene.fog.color.copy(saved.fog[0]); scene.fog.near = saved.fog[1]; scene.fog.far = saved.fog[2]; }
    scene.background = saved.bg; scene.environmentIntensity = saved.envI; scene.onBeforeRender = saved.obr || (() => {});
    if (hemi && saved.hemi) { hemi.color.copy(saved.hemi[0]); hemi.groundColor.copy(saved.hemi[1]); hemi.intensity = saved.hemi[2]; }
    if (sun && saved.sun) { sun.color.copy(saved.sun[0]); sun.intensity = saved.sun[1]; }
    saved = null;
  };
  const dispose = () => {
    group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const m of [matOp, matCut, matFar, matGlow, hitMat, sky.material, fg.material]) m.dispose();
    if (ocean) { ocean.material.uniforms.uTex.value.dispose(); ocean.material.dispose(); }
    for (const t of [tex, etex, stex, skyTex]) t.dispose();
    if (group.parent) group.parent.remove(group);
  };
  return { group, hitMeshes, ground, env, stats, sunDir: env.sunDir, apply, restore, dispose, view: VICE.view || null, materials: { matOp, matCut, matFar, matGlow }, shadow: SH };
}
