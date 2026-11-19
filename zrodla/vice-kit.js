// Zestaw do budowy map Deathmatch w stylu Vice (Miami lat 80., low-poly, zachód słońca i neony).
// CZYSTY JS: bez three.js i bez DOM. Ten sam kod liczy kolizje na serwerze (node, dm.mjs / mecz.mjs)
// i geometrię w przeglądarce (vice-render.js zamienia bufory na siatki three.js), więc klient i serwer mają identyczne dane.
//
// Mapa to plik zrodla/<nazwa>-data.js:
//   import { defineMap } from './vice-kit.js';
//   export const VICE = defineMap({ name, seed, bounds, env, layout(B) { ... } });
//   export const MAP = VICE.data;        // { name, spawns, colliders, clips, ladders } – format jak w oaza-data.js
//
// Układ współrzędnych jak w grze: 1 j. = 1 m, Y w górę, podłoga zawsze na y = 0 (serwer ma podłogę na 0),
// gracz: promień 0,3 m, wysokość 1,75 m, sam wchodzi na stopień do 0,5 m, skok ok. 1,09 m.
// yaw gracza: patrzy w (-sin yaw, 0, -cos yaw), czyli yaw = 0 to patrzenie w stronę -Z.
//
// Bryły kolizji to wyłącznie prostopadłościany AABB [x0,y0,z0,x1,y1,z1] (fizyka gracza i serwer znają tylko takie).
// Geometria jest sklejana w sektory (SECTOR m) – osobna siatka na sektor, żeby to, czego nie widać, nie było rysowane.

export const SECTOR = 24;            // bok sektora geometrii nieprzezroczystej (m)
export const CUT_SECTOR = 48;        // bok sektora geometrii z wycinaniem alfa (liście, siatki)
export const PI = Math.PI, HALF = Math.PI / 2;

// ---------------- losowość (deterministyczna) ----------------
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// ---------------- kolory: hex sRGB -> liniowe RGB (kolory wierzchołków są liniowe) ----------------
const s2l = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
export const lin = (hex, k = 1) => [s2l(((hex >> 16) & 255) / 255) * k, s2l(((hex >> 8) & 255) / 255) * k, s2l((hex & 255) / 255) * k];

// ---------------- paleta ----------------
export const PAL = {
  pink: 0xf7a8c4, peach: 0xffc8a2, mint: 0xa8e6cf, aqua: 0x8fd8e0, lavender: 0xc9b2ec, lemon: 0xfff0a8, cream: 0xf6efe2,
  coral: 0xff9a8a, sky: 0x9cc8f0, salmon: 0xf4a582, lilac: 0xd8b8e8, teal: 0x3fb7b0, white: 0xf5f3ee,
  neonPink: 0xff2d95, neonCyan: 0x22e6ff, neonPurple: 0xb44dff, neonOrange: 0xff9a3c, neonGreen: 0x39ff88, neonYellow: 0xffe14a,
  asphalt: 0x6a6470, concrete: 0xb9b2ae, sand: 0xf2d6a2, wood: 0xb07a52, metal: 0x9aa0a8, dark: 0x2a2433,
};
// kolory aut (lata 80.)
export const CAR_COLORS = [0xe8e4dc, 0x1c1a22, 0xc0283a, 0x2f5fb8, 0x3fb7b0, 0xf2c14e, 0xff7aa8, 0x7a3fb0, 0xd9d4ca, 0x5e8c4a, 0xff8c42, 0x9aa7b8];

// ---------------- atlas tekstur: 8×8 kafli po 256 px (2048 px), rysowany w przeglądarce przez vice-render.js ----------------
// kafle oznaczone * mają też świecącą część w atlasie emisji (okna, neony, napisy, reflektory)
export const TILE_NAMES = [
  'asphalt', 'asphalt_wet', 'sidewalk', 'plaza', 'sand', 'sand_wet', 'boardwalk', 'grass',
  'concrete', 'roof', 'parking', 'tile_check', 'tile_terra', 'wood_floor', 'pool', 'carpet',
  'stucco', 'plaster', 'brick', 'concrete_wall', 'corrugated', 'wood_wall', 'glassblock', 'tiles_wall',
  'win_deco', 'win_deco_lit', 'win_office', 'win_office_lit', 'win_brick', 'win_brick_lit', 'shopfront', 'shopfront_lit',
  'door', 'shutter', 'garage_door', 'vent', 'metal', 'diamond', 'container', 'stripes_red',
  'signs_a', 'signs_b', 'signs_c', 'signs_v', 'neon', 'billboard_a', 'billboard_b', 'billboard_c',
  'palm_frond', 'bark', 'foliage', 'umbrella', 'fabric', 'car_body', 'car_parts', 'tire',
  'white', 'dark', 'glow', 'water', 'chainlink', 'graffiti', 'skyline', 'lightpanel',
];
export const TILE = Object.fromEntries(TILE_NAMES.map((n, i) => [n, i]));
export const ATLAS = { px: 2048, n: 8, pad: 12 };
// domyślny rozmiar jednego powtórzenia kafla na powierzchni (m) [poziomo, pionowo]; brak = rozciągnięty na całą ścianę
export const TILE_SIZE = {
  asphalt: [4, 4], asphalt_wet: [4, 4], sidewalk: [2, 2], plaza: [3, 3], sand: [4, 4], sand_wet: [4, 4], boardwalk: [2.4, 2.4], grass: [3, 3],
  concrete: [3, 3], roof: [3, 3], parking: [2.6, 5.2], tile_check: [1.6, 1.6], tile_terra: [2, 2], wood_floor: [2.4, 2.4], pool: [2, 2], carpet: [3, 3],
  stucco: [3, 3], plaster: [3, 3], brick: [2.4, 2.4], concrete_wall: [3, 3], corrugated: [2, 2], wood_wall: [2, 2], glassblock: [1.6, 1.6], tiles_wall: [1.5, 1.5],
  win_deco: [3, 3.2], win_deco_lit: [3, 3.2], win_office: [3, 3.6], win_office_lit: [3, 3.6], win_brick: [2.8, 3.2], win_brick_lit: [2.8, 3.2], shopfront: [4.5, 3.6], shopfront_lit: [4.5, 3.6],
  corrugated_: [2, 2], diamond: [1.5, 1.5], container: [2.4, 2.6], stripes_red: [1.2, 1.2], graffiti: [6, 3], chainlink: [2.5, 2.5], skyline: [24, 24], white: null, dark: null,
};
// część kafla: [x0, y0, x1, y1] w ułamkach kafla, y od góry (jak na canvasie)
export const SUB = {
  signRow: (i) => [0, i / 4, 1, (i + 1) / 4],                  // signs_a/b/c: 4 napisy poziome w kaflu
  signCol: (i) => [i / 4, 0, (i + 1) / 4, 1],                  // signs_v: 4 napisy pionowe
  neon: (i) => [0, i / 8 + 0.02, 1, (i + 1) / 8 - 0.02],     // neon: 8 kolorów rur (0 róż, 1 cyjan, 2 fiolet, 3 pomarańcz, 4 zieleń, 5 żółty, 6 biały, 7 czerwony)
  car: { glass: [0, 0, 0.5, 0.5], head: [0.5, 0, 1, 0.25], tail: [0.5, 0.25, 1, 0.5], grille: [0, 0.5, 0.5, 0.75], chrome: [0.5, 0.5, 1, 0.75], plate: [0, 0.75, 0.5, 1], dark: [0.5, 0.75, 1, 1] },
  tire: { side: [0, 0, 0.5, 1], tread: [0.5, 0, 1, 1] },
  palm: { frond: [0, 0, 1, 1] },
};
// napisy w kaflach (indeks wiersza) – vice-render.js rysuje dokładnie te teksty
export const SIGNS = {
  signs_a: ['OCEAN HOTEL', 'FLAMINGO', 'CORAL CLUB', 'SUNSET'],
  signs_b: ['DINER', 'MOTEL', 'SURF SHOP', 'OPEN 24H'],
  signs_c: ['PIZZA', 'LIQUOR', 'ARCADE', 'TACOS'],
  signs_v: ['HOTEL', 'BAR', 'CLUB', 'PARK'],
};
export const NEON = { pink: 0, cyan: 1, purple: 2, orange: 3, green: 4, yellow: 5, white: 6, red: 7 };
// paski markiz i parasoli (kafel 'umbrella' ma 4 pionowe ćwiartki): 0 róż/biel, 1 turkus/biel, 2 żółć/biel, 3 fiolet/biel
export const STRIPE = { pink: 0, teal: 1, yellow: 2, purple: 3 };
SUB.stripe = (i) => [i / 4 + 0.01, 0, (i + 1) / 4 - 0.01, 1];
const stripeMat = (s) => (typeof s === 'number' && s >= 0 && s < 4 ? { t: 'umbrella', sub: SUB.stripe(s) } : typeof s === 'object' ? s : { t: 'umbrella', sub: SUB.stripe(0) });

// ---------------- materiały: opis kafla na powierzchni ----------------
// 'stucco' | 0xRRGGBB (sam kolor) | { t: kafel, c: odcień 0xRRGGBB, k: jasność, s: [m, m] rozmiar powtórzenia, sub, rot: 0..3, flip, g: [dół, góra] gradient }
export function mat(m) {
  if (m == null) return { t: 'white', c: 0xffffff };
  if (typeof m === 'string') return { t: m };
  if (typeof m === 'number') return { t: 'white', c: m };
  return m;
}
const FACE_KEYS = ['all', 'side', 'top', 'bottom', 'px', 'nx', 'py', 'ny', 'pz', 'nz'];
function faceSpec(m) {
  if (m && typeof m === 'object' && FACE_KEYS.some((k) => k in m)) {
    const d = 'all' in m ? m.all : undefined, s = 'side' in m ? m.side : d;
    const pick = (k, fb) => (k in m ? m[k] : fb);
    return { px: pick('px', s), nx: pick('nx', s), pz: pick('pz', s), nz: pick('nz', s), py: pick('py', pick('top', d)), ny: pick('ny', pick('bottom', d)) };
  }
  return { px: m, nx: m, pz: m, nz: m, py: m, ny: m };
}
function tileRect(m) {
  const i = TILE[m.t]; if (i === undefined) throw new Error('vice-kit: nieznany kafel ' + m.t);
  const n = ATLAS.n, pd = ATLAS.pad / ATLAS.px, col = i % n, row = (i / n) | 0;
  let u0 = col / n + pd, u1 = (col + 1) / n - pd, vt = 1 - row / n - pd, vb = 1 - (row + 1) / n + pd;
  if (m.sub) { const [a, b, c, d] = m.sub, du = u1 - u0, dv = vt - vb; const nu0 = u0 + a * du, nu1 = u0 + c * du, nvt = vt - b * dv, nvb = vt - d * dv; u0 = nu0; u1 = nu1; vt = nvt; vb = nvb; }
  return [u0, vb, u1, vt];
}
function tuv(R, fu, fv, rot, flip) {
  if (flip) fu = 1 - fu;
  let a = fu, b = fv;
  if (rot === 1) { a = fv; b = 1 - fu; } else if (rot === 2) { a = 1 - fu; b = 1 - fv; } else if (rot === 3) { a = 1 - fv; b = fu; }
  return [R[0] + a * (R[2] - R[0]), R[1] + b * (R[3] - R[1])];
}

// ---------------- bufor geometrii (indeksowany) ----------------
class Buf {
  constructor(chan, key) { this.chan = chan; this.key = key; this.p = []; this.n = []; this.uv = []; this.c = []; this.ix = []; this.v = 0; this.tris = 0; }
}

// ---------------- budowniczy mapy ----------------
const r3 = (v) => Math.round(v * 1000) / 1000;
class Builder {
  constructor(def, visual) {
    this.def = def; this.visual = visual;
    this.r = rng(def.seed || 1);                  // losowość układu (kolizje mogą od niej zależeć)
    this.vr = rng((def.seed || 1) * 7919 + 13);   // losowość wyłącznie wizualna (nigdy nie zmienia kolizji)
    this.colliders = []; this.noHit = []; this.noShadow = []; this.clips = []; this.ladders = []; this.spawns = [];
    this.casters = []; this.bufs = new Map(); this.paints = []; this.lights = []; this.notes = [];
    this.T = [{ x: 0, y: 0, z: 0, c: 1, s: 0 }];
  }
  // --- losowanie ---
  rand(a = 0, b = 1) { return a + (b - a) * this.r(); }
  vrand(a = 0, b = 1) { return a + (b - a) * this.vr(); }
  pick(a) { return a[(this.r() * a.length) | 0]; }
  vpick(a) { return a[(this.vr() * a.length) | 0]; }

  // --- transformacje (przesunięcie + obrót wokół Y) ---
  get t() { return this.T[this.T.length - 1]; }
  at(x, y, z, yaw, fn) {
    const p = this.t, c = Math.cos(yaw || 0), s = Math.sin(yaw || 0);
    const w = this.tp(x, y, z);
    this.T.push({ x: w[0], y: w[1], z: w[2], c: p.c * c - p.s * s, s: p.s * c + p.c * s });
    try { fn(this); } finally { this.T.pop(); }
    return this;
  }
  tp(x, y, z) { const t = this.t; return [t.x + t.c * x + t.s * z, t.y + y, t.z - t.s * x + t.c * z]; }       // punkt lokalny -> świat
  tn(x, y, z) { const t = this.t; return [t.c * x + t.s * z, y, -t.s * x + t.c * z]; }                        // kierunek lokalny -> świat
  get yaw() { return Math.atan2(this.t.s, this.t.c); }
  // AABB w świecie z lokalnego prostopadłościanu
  waabb(x0, y0, z0, x1, y1, z1) {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) { const w = this.tp(x, 0, z); a = Math.min(a, w[0]); b = Math.min(b, w[2]); c = Math.max(c, w[0]); d = Math.max(d, w[2]); }
    const t = this.t; return [a, t.y + Math.min(y0, y1), b, c, t.y + Math.max(y0, y1), d];
  }

  // ================= kolizje i dane rozgrywki =================
  // bryła kolizji (fizyka gracza, kule, widoczność na serwerze). o.hit=false: kule klienta jej nie widzą (np. granica w wodzie); o.shadow=false: nie rzuca cienia
  solid(x0, y0, z0, x1, y1, z1, o = {}) {
    const b = this.waabb(x0, y0, z0, x1, y1, z1).map(r3);
    if (b[3] - b[0] < 1e-3 || b[4] - b[1] < 1e-3 || b[5] - b[2] < 1e-3) return this;
    const i = this.colliders.length; this.colliders.push(b);
    if (o.hit === false) this.noHit.push(i);
    if (o.shadow === false) this.noShadow.push(i);
    return this;
  }
  // blokada ruchu gracza bez zatrzymywania kul (siatki ogrodzeń, barierki nad wodą). Serwer jej nie zna.
  clip(x0, y0, z0, x1, y1, z1) { this.clips.push(this.waabb(x0, y0, z0, x1, y1, z1).map(r3)); return this; }
  // punkt odrodzenia (świat lub lokalnie w at()): patrzy w stronę yaw
  spawn(x, z, yaw, name) { const w = this.tp(x, 0, z); this.spawns.push({ name: name || 'S' + String(this.spawns.length + 1).padStart(2, '0'), x: r3(w[0]), y: r3(w[1]), z: r3(w[2]), yaw: r3(yaw + this.yaw) }); return this; }
  // cień rzucany przez coś bez kolizji (liście palm, markizy, latarnie): prostopadłościan obrócony wokół Y
  caster(cx, cy, cz, hx, hy, hz, yaw = 0) { const w = this.tp(cx, cy, cz); this.casters.push([w[0], w[1], w[2], hx, hy, hz, yaw + this.yaw]); return this; }
  note(s) { this.notes.push(s); return this; }

  // ================= geometria =================
  buf(chan, wx, wz) {
    const one = chan === 'far' || chan === 'glow', S = chan === 'cut' ? CUT_SECTOR : SECTOR;
    const sx = one ? 0 : Math.floor(wx / S), sz = one ? 0 : Math.floor(wz / S), key = chan + ':' + sx + ',' + sz;
    let b = this.bufs.get(key); if (!b) { b = new Buf(chan, key); b.sx = sx; b.sz = sz; this.bufs.set(key, b); }
    return b;
  }
  // czworokąt w świecie: P = 4 narożniki (przeciwnie do wskazówek zegara patrząc od frontu), N normalna, UV 4×[u,v], C 4×[r,g,b]
  wquad(chan, P, N, UV, C) {
    if (!this.visual) return;
    const b = this.buf(chan, (P[0][0] + P[2][0]) / 2, (P[0][2] + P[2][2]) / 2), v = b.v;
    for (let k = 0; k < 4; k++) { b.p.push(P[k][0], P[k][1], P[k][2]); b.n.push(N[0], N[1], N[2]); b.uv.push(UV[k][0], UV[k][1]); b.c.push(C[k][0], C[k][1], C[k][2]); }
    b.ix.push(v, v + 1, v + 2, v, v + 2, v + 3); b.v += 4; b.tris += 2;
  }
  wtri(chan, P, N, UV, C) {
    if (!this.visual) return;
    const b = this.buf(chan, (P[0][0] + P[1][0] + P[2][0]) / 3, (P[0][2] + P[1][2] + P[2][2]) / 3), v = b.v;
    for (let k = 0; k < 3; k++) { b.p.push(P[k][0], P[k][1], P[k][2]); b.n.push(N[0], N[1], N[2]); b.uv.push(UV[k][0], UV[k][1]); b.c.push(C[k][0], C[k][1], C[k][2]); }
    b.ix.push(v, v + 1, v + 2); b.v += 3; b.tris += 1;
  }
  // ściana: o = lewy dolny róg (lokalnie), U = do prawego dolnego, V = do lewego górnego; kafle dopasowane do rozmiaru (fit)
  face(o, U, V, m, opt = {}) {
    if (m === null || m === false) return this;
    m = mat(m);
    const chan = opt.chan || m.chan || 'op';
    const W = Math.hypot(U[0], U[1], U[2]), Hh = Math.hypot(V[0], V[1], V[2]); if (W < 1e-4 || Hh < 1e-4) return this;
    let n = [U[1] * V[2] - U[2] * V[1], U[2] * V[0] - U[0] * V[2], U[0] * V[1] - U[1] * V[0]]; const nl = Math.hypot(...n) || 1; n = n.map((q) => q / nl);
    const size = m.s === 0 ? null : m.s || TILE_SIZE[m.t] || null;
    const nu = size && size[0] ? Math.max(1, Math.round(W / size[0])) : 1, nv = size && size[1] ? Math.max(1, Math.round(Hh / size[1])) : 1;
    const R = tileRect(m), base = lin(m.c === undefined ? 0xffffff : m.c, m.k === undefined ? 1 : m.k), g = m.g;
    const N = this.tn(n[0], n[1], n[2]), vertical = Math.abs(N[1]) < 0.5;
    const ao = m.ao === undefined ? 1 : m.ao;
    const col = (fv, wy) => { let k = ao; if (g) k *= g[0] + (g[1] - g[0]) * fv; if (vertical && wy < 0.06 && m.noao !== true) k *= 0.78; return [base[0] * k, base[1] * k, base[2] * k]; };
    const fu0 = m.u0 || 0, fu1 = m.u1 === undefined ? 1 : m.u1;          // tylko fragment kafla w poziomie (np. jedna kolumna)
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const a = i / nu, b = (i + 1) / nu, c = j / nv, d = (j + 1) / nv;
      const L = (u, v) => this.tp(o[0] + U[0] * u + V[0] * v, o[1] + U[1] * u + V[1] * v, o[2] + U[2] * u + V[2] * v);
      const P = [L(a, c), L(b, c), L(b, d), L(a, d)];
      const UV = [tuv(R, fu0, 0, m.rot, m.flip), tuv(R, fu1, 0, m.rot, m.flip), tuv(R, fu1, 1, m.rot, m.flip), tuv(R, fu0, 1, m.rot, m.flip)];
      const C = [col(c, P[0][1]), col(c, P[1][1]), col(d, P[2][1]), col(d, P[3][1])];
      this.wquad(chan, P, N, UV, C);
    }
    return this;
  }
  // prostopadłościan (lokalnie). m: opis materiału albo {all, side, top, bottom, px, nx, py, ny, pz, nz} (null = bez tej ściany)
  // o.skip: 'ny,pz' – pomija ściany; dół przy ziemi (y0 <= 0.01) jest pomijany zawsze
  box(x0, y0, z0, x1, y1, z1, m, o = {}) {
    if (x1 < x0) [x0, x1] = [x1, x0]; if (y1 < y0) [y0, y1] = [y1, y0]; if (z1 < z0) [z0, z1] = [z1, z0];
    const F = faceSpec(m), skip = o.skip || '', chan = o.chan;
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, op = { chan };
    if (!skip.includes('px')) this.face([x1, y0, z1], [0, 0, -dz], [0, dy, 0], F.px, op);
    if (!skip.includes('nx')) this.face([x0, y0, z0], [0, 0, dz], [0, dy, 0], F.nx, op);
    if (!skip.includes('pz')) this.face([x0, y0, z1], [dx, 0, 0], [0, dy, 0], F.pz, op);
    if (!skip.includes('nz')) this.face([x1, y0, z0], [-dx, 0, 0], [0, dy, 0], F.nz, op);
    if (!skip.includes('py')) this.face([x0, y1, z1], [dx, 0, 0], [0, 0, -dz], F.py, op);
    if (!skip.includes('ny') && y0 > 0.01) this.face([x0, y0, z0], [dx, 0, 0], [0, 0, dz], F.ny, op);
    if (o.cast) this.caster((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, dx / 2, dy / 2, dz / 2);
    return this;
  }
  // prostopadłościan widoczny + kolizja (najczęstszy przypadek)
  block(x0, y0, z0, x1, y1, z1, m, o = {}) { this.box(x0, y0, z0, x1, y1, z1, m, o); return this.solid(x0, y0, z0, x1, y1, z1, o); }
  // walec/graniastosłup (lokalnie): środek podstawy (x, y, z), promień r (r2 na górze), wysokość h
  cyl(x, y, z, r, h, m, o = {}) {
    const n = o.sides || 8, r2 = o.r2 === undefined ? r : o.r2, a0 = o.a0 || 0, arc = o.arc || Math.PI * 2, full = arc >= Math.PI * 2 - 1e-6;
    m = mat(m); const R = tileRect(m), base = lin(m.c === undefined ? 0xffffff : m.c, m.k === undefined ? 1 : m.k), chan = o.chan || m.chan || 'op';
    const pts = []; for (let i = 0; i <= n; i++) { const a = a0 + arc * i / n; pts.push([Math.cos(a), Math.sin(a)]); }
    const slope = (r - r2) / h;
    for (let i = 0; i < n; i++) {
      const [c0, s0] = pts[i], [c1, s1] = pts[i + 1], cm = (c0 + c1) / 2, sm = (s0 + s1) / 2;
      const P = [this.tp(x + c0 * r, y, z + s0 * r), this.tp(x + c1 * r, y, z + s1 * r), this.tp(x + c1 * r2, y + h, z + s1 * r2), this.tp(x + c0 * r2, y + h, z + s0 * r2)];
      const nl = Math.hypot(cm, slope, sm) || 1, N = this.tn(cm / nl, slope / nl, sm / nl);
      const k0 = y < 0.06 && !o.noao ? 0.8 : 1, cb = [base[0] * k0, base[1] * k0, base[2] * k0];
      const u0 = o.wrap ? i / n : 0, u1 = o.wrap ? (i + 1) / n : 1;
      // kolejność narożników: patrząc z zewnątrz (normalna na zewnątrz) – zamiana, by trójkąty były zwrócone na zewnątrz
      this.wquad(chan, [P[1], P[0], P[3], P[2]], N, [tuv(R, u1, 0), tuv(R, u0, 0), tuv(R, u0, 1), tuv(R, u1, 1)], [cb, cb, base, base]);
    }
    const cap = (yy, rr, up) => {
      if (rr < 1e-4) return;
      const N = this.tn(0, up ? 1 : -1, 0), C = this.tp(x, yy, z), mid = tuv(R, 0.5, 0.5);
      for (let i = 0; i < n; i++) {
        const [c0, s0] = pts[i], [c1, s1] = pts[i + 1];
        const A = this.tp(x + c0 * rr, yy, z + s0 * rr), B = this.tp(x + c1 * rr, yy, z + s1 * rr);
        const uA = tuv(R, 0.5 + c0 * 0.5, 0.5 + s0 * 0.5), uB = tuv(R, 0.5 + c1 * 0.5, 0.5 + s1 * 0.5);
        if (up) this.wtri(chan, [C, B, A], N, [mid, uB, uA], [base, base, base]); else this.wtri(chan, [C, A, B], N, [mid, uA, uB], [base, base, base]);
      }
    };
    if (o.top !== false) cap(y + h, r2, true);
    if (o.bottom === true && y > 0.01) cap(y, r, false);
    if (!full && o.ends !== false) { /* otwarte łuki: bez ścian bocznych (używane jako zaokrąglone narożniki przy ścianach) */ }
    if (o.cast) this.caster(x, y + h / 2, z, Math.max(r, r2) * 0.8, h / 2, Math.max(r, r2) * 0.8);
    return this;
  }
  // wielokąt wypukły w XZ wyciągnięty od y0 do y1 (lokalnie), np. ścięte narożniki, trójkątne daszki
  prism(poly, y0, y1, m, o = {}) {
    const F = faceSpec(m), n = poly.length;
    let area = 0; for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
    if (area > 0) poly = poly.slice().reverse();          // ściany boczne mają normalne na zewnątrz dla tej kolejności
    for (let i = 0; i < n; i++) {
      const a = poly[i], b = poly[(i + 1) % n];
      this.face([a[0], y0, a[1]], [b[0] - a[0], 0, b[1] - a[1]], [0, y1 - y0, 0], F.px, { chan: o.chan });
    }
    const top = mat(F.py); if (top !== null && F.py !== null) {
      const R = tileRect(top), base = lin(top.c === undefined ? 0xffffff : top.c, top.k || 1), N = this.tn(0, 1, 0);
      let mnx = Infinity, mxx = -Infinity, mnz = Infinity, mxz = -Infinity; for (const p of poly) { mnx = Math.min(mnx, p[0]); mxx = Math.max(mxx, p[0]); mnz = Math.min(mnz, p[1]); mxz = Math.max(mxz, p[1]); }
      const uv = (p) => tuv(R, (p[0] - mnx) / (mxx - mnx || 1), (mxz - p[1]) / (mxz - mnz || 1));
      for (let i = 1; i < n - 1; i++) { const A = poly[0], B = poly[i], C = poly[i + 1]; this.wtri(o.chan || 'op', [this.tp(A[0], y1, A[1]), this.tp(B[0], y1, B[1]), this.tp(C[0], y1, C[1])], N, [uv(A), uv(B), uv(C)], [base, base, base]); }
    }
    return this;
  }
  // dowolny płaski czworokąt (lokalnie): narożniki a,b,c,d przeciwnie do wskazówek zegara od frontu
  quad4(a, b, c, d, m, o = {}) {
    m = mat(m); const R = tileRect(m), base = lin(m.c === undefined ? 0xffffff : m.c, m.k === undefined ? 1 : m.k);
    const U = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], V = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    let n = [U[1] * V[2] - U[2] * V[1], U[2] * V[0] - U[0] * V[2], U[0] * V[1] - U[1] * V[0]]; const l = Math.hypot(...n) || 1; n = n.map((q) => q / l);
    const fu0 = m.u0 || 0, fu1 = m.u1 === undefined ? 1 : m.u1, fv0 = m.v0 || 0, fv1 = m.v1 === undefined ? 1 : m.v1;
    const cols = o.cols ? o.cols.map((c) => lin(c, m.k || 1)) : [base, base, base, base];
    this.wquad(o.chan || m.chan || 'op', [this.tp(...a), this.tp(...b), this.tp(...c), this.tp(...d)], this.tn(...n),
      [tuv(R, fu0, fv0, m.rot, m.flip), tuv(R, fu1, fv0, m.rot, m.flip), tuv(R, fu1, fv1, m.rot, m.flip), tuv(R, fu0, fv1, m.rot, m.flip)], cols);
    if (o.double) this.wquad(o.chan || m.chan || 'op', [this.tp(...b), this.tp(...a), this.tp(...d), this.tp(...c)], this.tn(-n[0], -n[1], -n[2]),
      [tuv(R, fu1, fv0, m.rot, m.flip), tuv(R, fu0, fv0, m.rot, m.flip), tuv(R, fu0, fv1, m.rot, m.flip), tuv(R, fu1, fv1, m.rot, m.flip)], cols);
    return this;
  }
  // pionowa tablica / szyld (lokalnie): środek (x,y,z), szerokość w, wysokość h, patrzy w stronę +Z obróconego o yaw
  panel(x, y, z, w, h, yaw, m, o = {}) {
    return this.at(x, y, z, yaw, () => this.quad4([-w / 2, -h / 2, 0], [w / 2, -h / 2, 0], [w / 2, h / 2, 0], [-w / 2, h / 2, 0], m, o));
  }
  // poziomy prostokąt (decal na ziemi / dachu) – lekko nad powierzchnią, żeby nie migotał
  decal(x0, z0, x1, z1, y, m, o = {}) {
    if (x1 < x0) [x0, x1] = [x1, x0]; if (z1 < z0) [z0, z1] = [z1, z0];
    return this.face([x0, y, z1], [x1 - x0, 0, 0], [0, 0, z0 - z1], m, o);
  }
  // linia malowana na jezdni od (x0,z0) do (x1,z1), szerokość w; dash = [kreska, przerwa]
  line(x0, z0, x1, z1, w, color = 0xf2efe6, dash = null, y = 0.022) {
    const L = Math.hypot(x1 - x0, z1 - z0); if (L < 1e-3) return this;
    const ux = (x1 - x0) / L, uz = (z1 - z0) / L, px = -uz * w / 2, pz = ux * w / 2;
    const seg = (a, b) => {
      const A = [x0 + ux * a, z0 + uz * a], Bp = [x0 + ux * b, z0 + uz * b];
      this.quad4([A[0] - px, y, A[1] - pz], [A[0] + px, y, A[1] + pz], [Bp[0] + px, y, Bp[1] + pz], [Bp[0] - px, y, Bp[1] - pz], { t: 'white', c: color, k: 0.92 });
    };
    if (!dash) seg(0, L); else for (let a = 0; a < L; a += dash[0] + dash[1]) seg(a, Math.min(L, a + dash[0]));
    return this;
  }
  // przejście dla pieszych: pasy w poprzek osi 'x' albo 'z' (pasy idą wzdłuż osi ruchu pieszych)
  crosswalk(x0, z0, x1, z1, axis = 'x') {
    if (axis === 'x') { for (let z = z0 + 0.3; z < z1 - 0.3; z += 1.1) this.decal(x0, z, x1, Math.min(z + 0.55, z1), 0.022, { t: 'white', c: 0xf2efe6, k: 0.9 }); }
    else { for (let x = x0 + 0.3; x < x1 - 0.3; x += 1.1) this.decal(x, z0, Math.min(x + 0.55, x1), z1, 0.022, { t: 'white', c: 0xf2efe6, k: 0.9 }); }
    return this;
  }

  // ================= podłoże (y = 0) =================
  // malowanie podłoża prostokątami; późniejsze przykrywają wcześniejsze. Kafle są wyrównane do siatki świata (bez szwów).
  paint(x0, z0, x1, z1, m) { if (x1 < x0) [x0, x1] = [x1, x0]; if (z1 < z0) [z0, z1] = [z1, z0]; const w = this.waabb(x0, 0, z0, x1, 0, z1); this.paints.push([w[0], w[2], w[3], w[5], mat(m)]); return this; }

  // ================= światło (sztuczne, wypalone) =================
  // plama światła na ziemi (dodawana do obrazu): neon odbity w mokrym asfalcie, latarnia, okno. r = promień, k = siła
  glow(x, z, r, color, k = 1, o = {}) {
    const y = o.y === undefined ? 0.03 : o.y, sx = o.sx || 1, sz = o.sz || 1;
    return this.at(x, y, z, o.yaw || 0, () => this.quad4([-r * sx, 0, r * sz], [r * sx, 0, r * sz], [r * sx, 0, -r * sz], [-r * sx, 0, -r * sz], { t: 'glow', c: color, k }, { chan: 'glow' }));
  }
  // pionowa poświata (aura wokół neonu, stożek latarni widziany z boku) – kwadrat skierowany w stronę +Z po obrocie yaw
  halo(x, y, z, w, h, yaw, color, k = 1, o = {}) { return this.panel(x, y, z, w, h, yaw, { t: 'glow', c: color, k }, { chan: 'glow', double: o.double !== false }); }

  // ================= gotowe elementy (prefabrykaty) =================
  // drabina: (x, z) punkt na ścianie (środek drabiny), (nx, nz) normalna ściany w stronę gracza, od y0 do lądowania na wysokości top
  ladder(x, z, nx, nz, y0, top, w = 0.7) {
    const d = 0.55, tx = -nz, tz = nx;    // kierunek wzdłuż ściany
    const ax = x + tx * w / 2, az = z + tz * w / 2, bx = x - tx * w / 2, bz = z - tz * w / 2;
    const x0 = Math.min(ax, bx, ax + nx * d, bx + nx * d), x1 = Math.max(ax, bx, ax + nx * d, bx + nx * d);
    const z0 = Math.min(az, bz, az + nz * d, bz + nz * d), z1 = Math.max(az, bz, az + nz * d, bz + nz * d);
    const w0 = this.tp(x0, y0, z0), w1 = this.tp(x1, top + 0.35, z1), tN = this.tn(nx, 0, nz);
    this.ladders.push([r3(Math.min(w0[0], w1[0])), r3(this.t.y + y0), r3(Math.min(w0[2], w1[2])), r3(Math.max(w0[0], w1[0])), r3(this.t.y + top + 0.35), r3(Math.max(w0[2], w1[2])), Math.round(tN[0]), Math.round(tN[2])]);
    // wygląd: dwie poręcze wystające nad dach i szczeble
    const M = { t: 'metal', c: 0x8a8f99 }, off = 0.12;
    for (const s of [-1, 1]) { const px = x + tx * s * w / 2 + nx * off, pz = z + tz * s * w / 2 + nz * off; this.box(px - 0.035, y0, pz - 0.035, px + 0.035, top + 1.0, pz + 0.035, M); }
    for (let y = y0 + 0.3; y < top + 0.1; y += 0.3) {
      const px = x + nx * off, pz = z + nz * off, hx = Math.abs(tx) * w / 2 + 0.02, hz = Math.abs(tz) * w / 2 + 0.02;
      this.box(px - hx, y - 0.025, pz - hz, px + hx, y + 0.025, pz + hz, M);
    }
    return this;
  }
  // schody: start (x, z) na osi biegu, kierunek dir (0: +Z, 1: +X, 2: -Z, 3: -X), szerokość w, z wysokości y0 na y1.
  // Każdy stopień to pełna bryła od y0 (pod schodami nic nie ma). Stopień ma najwyżej `rise` m (domyślnie 0,25 – gracz wchodzi sam do 0,5).
  stairs(x, z, dir, w, y0, y1, m = { t: 'concrete', c: 0xd9d2cc }, o = {}) {
    const rise = o.rise || 0.25, run = o.run || 0.32, n = Math.max(1, Math.ceil((y1 - y0) / rise - 1e-6)), hstep = (y1 - y0) / n;
    const yaw = [0, HALF, PI, -HALF][dir & 3];
    const side = o.side === undefined ? { t: 'concrete', c: 0xc9c2bc } : o.side;
    this.at(x, 0, z, yaw, () => {
      for (let i = 0; i < n; i++) {
        const top = y0 + hstep * (i + 1), zA = i * run, zB = (i + 1) * run;
        const bottom = o.open ? Math.max(y0, top - 0.3) : y0;
        this.block(-w / 2, bottom, zA, w / 2, top, i === n - 1 && o.landing ? zB + o.landing : zB, { top: m, side }, { skip: i < n - 1 && !o.open ? 'pz' : '' });
      }
      if (o.rail !== false) {        // poręcze (bez kolizji)
        const L = n * run, M = { t: 'metal', c: o.railColor || 0xe8e4dc };
        for (const s of o.railSides || [-1, 1]) {
          const xx = s * (w / 2 - 0.05);
          for (let k = 0; k <= Math.max(1, Math.floor(L / 1.2)); k++) { const zz = Math.min(L - 0.05, k * 1.2 + 0.1), yy = y0 + (zz / L) * (y1 - y0); this.box(xx - 0.03, yy, zz - 0.03, xx + 0.03, yy + 0.95, zz + 0.03, M); }
          const a = [xx, y0 + 0.95, 0.1], b = [xx, y1 + 0.95, L];
          this.quad4([xx, a[1] - 0.05, a[2]], [xx, b[1] - 0.05, b[2]], [xx, b[1] + 0.04, b[2]], [xx, a[1] + 0.04, a[2]], M, { double: true });
        }
      }
    });
    return this;
  }
  // ściana z otworami (drzwi/okna) wzdłuż osi X (z = const) lub Z (x = const), od (x0,z0) do (x1,z1), grubość t, od y0 do y1.
  // open: [{ at: odległość od początku do środka otworu, w: szerokość, y0: dół (względem ściany), y1: góra }]
  // m: materiał zewnętrzny (strona +normalnej: dla osi X to +Z, dla osi Z to +X), mi: wewnętrzny, me: krawędzie otworów i górna
  wall(x0, z0, x1, z1, y0, y1, t, m, mi, open = [], o = {}) {
    const alongX = Math.abs(z1 - z0) < 1e-6, L = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0), H = y1 - y0;
    const sgn = alongX ? Math.sign(x1 - x0) || 1 : Math.sign(z1 - z0) || 1;
    const ops = open.map((q) => ({ a: Math.max(0, q.at - q.w / 2), b: Math.min(L, q.at + q.w / 2), lo: Math.max(0, q.y0 || 0), hi: Math.min(H, q.y1 === undefined ? H : q.y1), frame: q.frame })).filter((q) => q.b > q.a + 1e-3 && q.hi > q.lo + 1e-3);
    // kolumny między krawędziami otworów
    const cuts = [0, L, ...ops.flatMap((q) => [q.a, q.b])].sort((p, q) => p - q).filter((v, i, A) => i === 0 || v - A[i - 1] > 1e-4);
    const pieces = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i], b = cuts[i + 1], mid = (a + b) / 2;
      const holes = ops.filter((q) => q.a <= mid && q.b >= mid).map((q) => [q.lo, q.hi]).sort((p, q) => p[0] - q[0]);
      let y = 0; const iv = [];
      for (const [lo, hi] of holes) { if (lo > y + 1e-3) iv.push([y, lo]); y = Math.max(y, hi); }
      if (H > y + 1e-3) iv.push([y, H]);
      for (const v of iv) {
        const prev = pieces.find((p) => Math.abs(p.b - a) < 1e-4 && Math.abs(p.lo - v[0]) < 1e-4 && Math.abs(p.hi - v[1]) < 1e-4);
        if (prev) prev.b = b; else pieces.push({ a, b, lo: v[0], hi: v[1] });
      }
    }
    const me = o.edge || m;
    for (const p of pieces) {
      const A = alongX ? x0 + sgn * p.a : x0, B = alongX ? x0 + sgn * p.b : x0, C = alongX ? z0 : z0 + sgn * p.a, D = alongX ? z0 : z0 + sgn * p.b;
      const bx0 = alongX ? Math.min(A, B) : x0 - t / 2, bx1 = alongX ? Math.max(A, B) : x0 + t / 2;
      const bz0 = alongX ? z0 - t / 2 : Math.min(C, D), bz1 = alongX ? z0 + t / 2 : Math.max(C, D);
      const faces = alongX ? { pz: m, nz: mi, px: me, nx: me, py: me, ny: me } : { px: m, nx: mi, pz: me, nz: me, py: me, ny: me };
      if (o.visual !== false) this.box(bx0, y0 + p.lo, bz0, bx1, y0 + p.hi, bz1, faces);
      if (o.solid !== false) this.solid(bx0, y0 + p.lo, bz0, bx1, y0 + p.hi, bz1, o);
    }
    // ramy okien i drzwi (bez kolizji)
    for (const q of ops) {
      if (q.frame === false || o.frames === false) continue;
      const fm = q.frame || o.frame || { t: 'white', c: 0xf4f1ea }, fw = 0.1, fo = t / 2 + 0.03;
      const pos = (u) => (alongX ? [x0 + sgn * u, z0] : [x0, z0 + sgn * u]);
      const [ax, az] = pos(q.a), [bx, bz] = pos(q.b);
      for (const side of [1, -1]) {
        const ox = alongX ? 0 : side * fo, oz = alongX ? side * fo : 0;
        const lx0 = Math.min(ax, bx) + ox, lx1 = Math.max(ax, bx) + ox, lz0 = Math.min(az, bz) + oz, lz1 = Math.max(az, bz) + oz;
        const th = 0.03;
        if (alongX) {
          this.box(lx0 - fw, y0 + q.hi, lz0 - th, lx1 + fw, y0 + q.hi + fw, lz0 + th, fm);
          if (q.lo > 0.05) this.box(lx0 - fw, y0 + q.lo - fw, lz0 - th, lx1 + fw, y0 + q.lo, lz0 + th, fm);
          this.box(lx0 - fw, y0 + q.lo, lz0 - th, lx0, y0 + q.hi, lz0 + th, fm); this.box(lx1, y0 + q.lo, lz0 - th, lx1 + fw, y0 + q.hi, lz0 + th, fm);
        } else {
          this.box(lx0 - th, y0 + q.hi, lz0 - fw, lx0 + th, y0 + q.hi + fw, lz1 + fw, fm);
          if (q.lo > 0.05) this.box(lx0 - th, y0 + q.lo - fw, lz0 - fw, lx0 + th, y0 + q.lo, lz1 + fw, fm);
          this.box(lx0 - th, y0 + q.lo, lz0 - fw, lx0 + th, y0 + q.hi, lz0, fm); this.box(lx0 - th, y0 + q.lo, lz1, lx0 + th, y0 + q.hi, lz1 + fw, fm);
        }
      }
    }
    return this;
  }
  // płyta stropu/podłogi (od y-th do y) z prostokątnymi otworami (klatki schodowe): holes [[x0,z0,x1,z1], ...]
  slab(x0, z0, x1, z1, y, th, top, bottom, holes = [], o = {}) {
    let rects = [[x0, z0, x1, z1]];
    for (const h of holes) {
      const next = [];
      for (const r of rects) {
        if (h[0] >= r[2] || h[2] <= r[0] || h[1] >= r[3] || h[3] <= r[1]) { next.push(r); continue; }
        const cx0 = Math.max(r[0], h[0]), cx1 = Math.min(r[2], h[2]), cz0 = Math.max(r[1], h[1]), cz1 = Math.min(r[3], h[3]);
        if (r[1] < cz0) next.push([r[0], r[1], r[2], cz0]);
        if (cz1 < r[3]) next.push([r[0], cz1, r[2], r[3]]);
        if (r[0] < cx0) next.push([r[0], cz0, cx0, cz1]);
        if (cx1 < r[2]) next.push([cx1, cz0, r[2], cz1]);
      }
      rects = next;
    }
    for (const r of rects) this.block(r[0], y - th, r[1], r[2], y, r[3], { top, bottom, side: o.side || bottom }, o);
    return this;
  }
  // parapet wokół dachu (prostokąt), z przerwami gaps: [{side:'nx'|'px'|'nz'|'pz', at, w}] (np. na drabinę)
  parapet(x0, z0, x1, z1, y, h, t, m, gaps = []) {
    const G = (side) => gaps.filter((g) => g.side === side).map((g) => ({ at: g.at, w: g.w }));
    this.wall(x0, z1 - t / 2, x1, z1 - t / 2, y, y + h, t, m, m, G('pz'), { frames: false });
    this.wall(x0, z0 + t / 2, x1, z0 + t / 2, y, y + h, t, m, m, G('nz'), { frames: false });
    this.wall(x1 - t / 2, z0 + t, x1 - t / 2, z1 - t, y, y + h, t, m, m, G('px').map((g) => ({ ...g, at: g.at - t })), { frames: false });
    this.wall(x0 + t / 2, z0 + t, x0 + t / 2, z1 - t, y, y + h, t, m, m, G('nx').map((g) => ({ ...g, at: g.at - t })), { frames: false });
    return this;
  }

  // ---------------- palma ----------------
  // h: wysokość, lean: wychylenie korony (m), yaw: kierunek wychylenia. Kolizja: pień (0,45 m) do 4 m.
  palm(x, z, h = 8, lean = 1, yaw = 0, o = {}) {
    const vr = () => this.vr();
    const seg = 7, sides = 6, base = o.trunk || 0xa07a5e;
    const pts = []; for (let i = 0; i <= seg; i++) { const t = i / seg; pts.push([lean * t * t, t * h]); }
    const dir = [Math.sin(yaw), Math.cos(yaw)];
    const W = (i) => { const [l, y] = pts[i]; return [x + dir[0] * l, y, z + dir[1] * l]; };
    for (let i = 0; i < seg; i++) {
      const A = W(i), B = W(i + 1), ra = 0.24 - 0.1 * (i / seg), rb = 0.24 - 0.1 * ((i + 1) / seg);
      this.at(0, 0, 0, 0, () => this.frustum(A, B, ra * (i % 2 ? 1.08 : 1), rb, sides, { t: 'bark', c: base, k: i % 2 ? 0.92 : 1 }));
    }
    const top = W(seg);
    // korona: ciemniejsza kula liści u nasady + 9 opadających liści (wycinane alfa)
    this.at(top[0], top[1], top[2], 0, () => {
      this.cyl(0, -0.35, 0, 0.32, 0.5, { t: 'foliage', c: 0x6d7f3a }, { sides: 6, r2: 0.12 });
      const n = o.fronds || 9, L = o.frondL || h * 0.42 + 1.4;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + vr() * 0.5, droop = 0.35 + vr() * 0.5, len = L * (0.8 + vr() * 0.35);
        this.frond(a, droop, len, o.leaf || 0x4f8a3a);
        this.caster(Math.sin(a) * len * 0.45, -len * 0.18 * droop, Math.cos(a) * len * 0.45, 0.45, 0.05, len * 0.45, a);
      }
      if (o.coconuts !== false) for (let k = 0; k < 3; k++) { const a = k * 2.1; this.cyl(Math.sin(a) * 0.22, -0.55, Math.cos(a) * 0.22, 0.12, 0.22, 0x5a4a2a, { sides: 5, r2: 0.08 }); }
    });
    for (let i = 0; i < seg; i += 2) { const A = W(i), B = W(Math.min(seg, i + 2)); this.caster((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2, 0.2, (B[1] - A[1]) / 2, 0.2); }
    if (o.solid !== false) this.solid(x - 0.22, 0, z - 0.22, x + 0.22, Math.min(h, 4.5), z + 0.22, { shadow: false });
    if (o.planter) this.block(x - 0.7, 0, z - 0.7, x + 0.7, 0.45, z + 0.7, { top: { t: 'grass', c: 0x8a7a5a }, side: { t: 'stucco', c: o.planter } });
    return this;
  }
  // stożek ścięty między dwoma punktami świata A i B (do pni) – w lokalnym układzie bez obrotu
  frustum(A, B, ra, rb, sides, m) {
    m = mat(m); const R = tileRect(m), base = lin(m.c === undefined ? 0xffffff : m.c, m.k || 1);
    const ax = B[0] - A[0], ay = B[1] - A[1], az = B[2] - A[2], L = Math.hypot(ax, ay, az) || 1, d = [ax / L, ay / L, az / L];
    const up = Math.abs(d[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
    let u = [d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0]]; const ul = Math.hypot(...u); u = u.map((q) => q / ul);
    const v = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2, a1 = ((i + 1) / sides) * Math.PI * 2;
      const r = (P, rr, a) => [P[0] + (u[0] * Math.cos(a) + v[0] * Math.sin(a)) * rr, P[1] + (u[1] * Math.cos(a) + v[1] * Math.sin(a)) * rr, P[2] + (u[2] * Math.cos(a) + v[2] * Math.sin(a)) * rr];
      const am = (a0 + a1) / 2, N = [u[0] * Math.cos(am) + v[0] * Math.sin(am), u[1] * Math.cos(am) + v[1] * Math.sin(am), u[2] * Math.cos(am) + v[2] * Math.sin(am)];
      const P = [r(A, ra, a1), r(A, ra, a0), r(B, rb, a0), r(B, rb, a1)].map((p) => this.tp(...p));
      const k = A[1] < 0.06 ? 0.8 : 1, cb = base.map((q) => q * k);
      this.wquad('op', P, this.tn(...N), [tuv(R, (i + 1) / sides, 0), tuv(R, i / sides, 0), tuv(R, i / sides, 1), tuv(R, (i + 1) / sides, 1)], [cb, cb, base, base]);
    }
    return this;
  }
  // jeden liść palmy: kierunek a (wokół Y), opadanie droop, długość len – pas 4 segmentów, wycinany alfa, dwustronny
  frond(a, droop, len, color) {
    const n = 4, w = 1.05, ca = Math.cos(a), sa = Math.sin(a), R = tileRect({ t: 'palm_frond' }), col = lin(color), colD = lin(color, 0.7);
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const t = i / n, d = len * t, y = 0.25 * Math.sin(t * Math.PI) * len * 0.3 - droop * d * d / len * 0.6;
      const half = w * Math.sin(Math.min(1, t * 1.6 + 0.15) * Math.PI) * 0.5 + 0.04;
      const cx = sa * d, cz = ca * d, px = ca * half, pz = -sa * half;
      const L = this.tp(cx - px, y, cz - pz), Rr = this.tp(cx + px, y - 0.05 * len * t, cz + pz), mid = this.tp(cx, y + 0.08, cz);
      const cur = { L, R: Rr, mid, t };
      if (prev) {
        const Nn = this.tn(0, 1, 0), c0 = t < 0.6 ? colD : col;
        const uvL = (q) => tuv(R, 0, q), uvR = (q) => tuv(R, 1, q);
        this.wquad('cut', [prev.R, prev.L, cur.L, cur.R], Nn, [uvR(prev.t), uvL(prev.t), uvL(t), uvR(t)], [c0, c0, col, col]);
      }
      prev = cur;
    }
    return this;
  }
  // krzak / żywopłot (lokalnie): prostopadłościan z liśćmi + opcjonalna kolizja
  bush(x0, z0, x1, z1, h, o = {}) {
    const c = o.c || 0x4a7a3a;
    this.box(x0, 0, z0, x1, h, z1, { top: { t: 'foliage', c, k: 1.1 }, side: { t: 'foliage', c, g: [0.7, 1.05] } });
    if (o.solid !== false) this.solid(x0, 0, z0, x1, h, z1);
    return this;
  }

  // ---------------- auto (lata 80.) ----------------
  // dir: 0..3 (przód auta w stronę +Z obróconego o dir·90°). model: sedan | coupe | wagon | van | pickup | taxi | police | convertible
  car(x, z, dir = 0, model = 'sedan', color = null, o = {}) {
    color = color === null ? this.vpick(CAR_COLORS) : color;
    const yaw = [0, HALF, PI, -HALF][dir & 3] + (o.yawJitter || 0);
    const D = {
      sedan: { L: 4.7, W: 1.85, bh: 0.95, ch: 1.42, c0: -1.15, c1: 0.85, rake: 0.35 },
      coupe: { L: 4.4, W: 1.95, bh: 0.82, ch: 1.18, c0: -1.0, c1: 0.55, rake: 0.6 },
      wagon: { L: 4.9, W: 1.85, bh: 0.95, ch: 1.45, c0: -1.9, c1: 0.9, rake: 0.25 },
      van: { L: 5.0, W: 2.0, bh: 1.1, ch: 2.05, c0: -2.3, c1: 1.6, rake: 0.4 },
      pickup: { L: 5.2, W: 1.95, bh: 1.05, ch: 1.75, c0: -0.35, c1: 1.15, rake: 0.25, bed: true },
      taxi: { L: 4.7, W: 1.85, bh: 0.95, ch: 1.42, c0: -1.15, c1: 0.85, rake: 0.35, roofSign: 0xffe14a },
      police: { L: 4.8, W: 1.88, bh: 0.95, ch: 1.42, c0: -1.15, c1: 0.85, rake: 0.35, bar: true },
      convertible: { L: 4.5, W: 1.85, bh: 0.9, ch: 0.9, c0: -0.6, c1: 0.6, rake: 0.5, open: true },
    }[model] || null;
    if (!D) throw new Error('vice-kit: nieznany model auta ' + model);
    if (model === 'taxi') color = 0xf2c14e;
    const body = { t: 'car_body', c: color }, glass = { t: 'car_parts', sub: SUB.car.glass }, dark = { t: 'car_parts', sub: SUB.car.dark };
    const chrome = { t: 'car_parts', sub: SUB.car.chrome }, head = { t: 'car_parts', sub: SUB.car.head }, tail = { t: 'car_parts', sub: SUB.car.tail };
    this.at(x, 0, z, yaw, () => {
      const hl = D.L / 2, hw = D.W / 2, bh = D.bh, cl = 0.24;
      // podwozie, nadwozie, zderzaki
      this.box(-hw + 0.1, cl, -hl + 0.15, hw - 0.1, cl + 0.25, hl - 0.15, dark);
      this.box(-hw, cl + 0.18, -hl, hw, bh, hl, { top: body, side: { ...body, g: [0.72, 1.05] }, pz: { ...body, g: [0.7, 1] }, nz: { ...body, g: [0.7, 1] } });
      this.box(-hw - 0.02, cl + 0.12, hl - 0.05, hw + 0.02, cl + 0.32, hl + 0.08, chrome);
      this.box(-hw - 0.02, cl + 0.12, -hl - 0.08, hw + 0.02, cl + 0.32, -hl + 0.05, chrome);
      // światła (świecą w atlasie emisji)
      this.panel(-hw + 0.38, bh - 0.22, hl + 0.005, 0.46, 0.16, 0, head); this.panel(hw - 0.38, bh - 0.22, hl + 0.005, 0.46, 0.16, 0, head);
      this.panel(-hw + 0.36, bh - 0.2, -hl - 0.005, 0.5, 0.14, PI, tail); this.panel(hw - 0.36, bh - 0.2, -hl - 0.005, 0.5, 0.14, PI, tail);
      this.panel(0, cl + 0.42, hl + 0.005, 0.9, 0.18, 0, { t: 'car_parts', sub: SUB.car.grille });
      this.panel(0, cl + 0.38, -hl - 0.09, 0.52, 0.13, PI, { t: 'car_parts', sub: SUB.car.plate });
      // kabina: ścięta bryła (przednia i tylna szyba pochylone)
      if (!D.open) {
        const r = D.rake, z0 = D.c0, z1 = D.c1, y0 = bh, y1 = D.ch, iw = hw - 0.12;
        const P = (xx, yy, zz) => [xx, yy, zz];
        // dach
        this.quad4(P(-iw + 0.06, y1, z1 - r), P(iw - 0.06, y1, z1 - r), P(iw - 0.06, y1, z0 + r * 0.6), P(-iw + 0.06, y1, z0 + r * 0.6), body);
        // przednia i tylna szyba
        this.quad4(P(-iw, y0, z1), P(iw, y0, z1), P(iw - 0.06, y1, z1 - r), P(-iw + 0.06, y1, z1 - r), glass);
        this.quad4(P(iw, y0, z0), P(-iw, y0, z0), P(-iw + 0.06, y1, z0 + r * 0.6), P(iw - 0.06, y1, z0 + r * 0.6), glass);
        // boczne szyby
        this.quad4(P(iw, y0, z1), P(iw, y0, z0), P(iw - 0.06, y1, z0 + r * 0.6), P(iw - 0.06, y1, z1 - r), glass);
        this.quad4(P(-iw, y0, z0), P(-iw, y0, z1), P(-iw + 0.06, y1, z1 - r), P(-iw + 0.06, y1, z0 + r * 0.6), glass);
        if (D.roofSign) { this.box(-0.35, y1, -0.15, 0.35, y1 + 0.22, 0.15, { t: 'white', c: D.roofSign, k: 1.2 }); }
        if (D.bar) { this.box(-0.6, y1, -0.12, -0.02, y1 + 0.12, 0.12, { t: 'neon', sub: SUB.neon(7) }); this.box(0.02, y1, -0.12, 0.6, y1 + 0.12, 0.12, { t: 'neon', sub: SUB.neon(1) }); }
      } else {
        this.quad4([-hw + 0.12, bh, D.c1], [hw - 0.12, bh, D.c1], [hw - 0.16, bh + 0.35, D.c1 - 0.25], [-hw + 0.16, bh + 0.35, D.c1 - 0.25], glass, { double: true });
        this.box(-hw + 0.25, bh - 0.05, -0.5, -0.1, bh + 0.35, -0.2, { t: 'fabric', c: 0xd8c8b0 }); this.box(0.1, bh - 0.05, -0.5, hw - 0.25, bh + 0.35, -0.2, { t: 'fabric', c: 0xd8c8b0 });
      }
      if (D.bed) { this.box(-hw + 0.08, bh - 0.02, -hl + 0.1, hw - 0.08, bh + 0.01, D.c0 - 0.1, dark); }
      // koła
      for (const [wx, wz] of [[-hw + 0.05, hl - 0.85], [hw - 0.05, hl - 0.85], [-hw + 0.05, -hl + 0.85], [hw - 0.05, -hl + 0.85]]) {
        this.at(wx, 0.34, wz, 0, () => this.wheel(Math.sign(wx)));
      }
    });
    const hl = D.L / 2, hw = D.W / 2;
    this.at(x, 0, z, [0, HALF, PI, -HALF][dir & 3], () => {
      // kolizja: dolna bryła (maska/bagażnik ~1 m – da się wskoczyć) + kabina (z maski wchodzi się na dach); cień rzucają bryły trochę mniejsze
      // od karoserii, żeby pochyłe szyby nie zacieniały same siebie
      if (o.solid !== false) {
        this.solid(-hw, 0.2, -hl, hw, D.bh, hl, { shadow: false });
        if (!D.open) this.solid(-hw + 0.12, D.bh, D.c0 + 0.1, hw - 0.12, D.ch, D.c1 - 0.1, { shadow: false });
      }
      this.caster(0, (0.3 + D.bh - 0.08) / 2, 0, hw - 0.08, (D.bh - 0.08 - 0.3) / 2, hl - 0.12);
      if (!D.open) this.caster(0, (D.bh + D.ch - 0.1) / 2, (D.c0 + D.rake * 0.6 + D.c1 - D.rake) / 2, hw - 0.3, (D.ch - 0.1 - D.bh) / 2, Math.max(0.2, (D.c1 - D.rake - D.c0 - D.rake * 0.6) / 2 - 0.12));
    });
    return this;
  }
  wheel(side) {
    const R = 0.34, w = 0.24, n = 8, tire = { t: 'tire', sub: SUB.tire.side }, tread = { t: 'tire', sub: SUB.tire.tread };
    const Rt = tileRect(tread), Rs = tileRect(tire), c = lin(0xffffff), c2 = lin(0xffffff, 0.8);
    const x0 = side > 0 ? -w : 0, x1 = side > 0 ? 0 : w;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      const p = (a, x) => this.tp(x, Math.sin(a) * R, Math.cos(a) * R), am = (a0 + a1) / 2;
      this.wquad('op', [p(a1, x0), p(a0, x0), p(a0, x1), p(a1, x1)], this.tn(0, Math.sin(am), Math.cos(am)), [tuv(Rt, 0, 0), tuv(Rt, 1, 0), tuv(Rt, 1, 1), tuv(Rt, 0, 1)], [c2, c2, c2, c2]);
      const xo = side > 0 ? x1 : x0, C = this.tp(xo, 0, 0), sn = side > 0 ? 1 : -1;
      const uv = (a) => tuv(Rs, 0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
      if (sn > 0) this.wtri('op', [C, p(a1, xo), p(a0, xo)], this.tn(1, 0, 0), [tuv(Rs, 0.5, 0.5), uv(a1), uv(a0)], [c, c, c]);
      else this.wtri('op', [C, p(a0, xo), p(a1, xo)], this.tn(-1, 0, 0), [tuv(Rs, 0.5, 0.5), uv(a0), uv(a1)], [c, c, c]);
    }
  }

  // ---------------- latarnia uliczna ----------------
  // kind: 'cobra' (wysięgnik nad jezdnię w stronę yaw) | 'deco' (słup z kulą) | 'double'. Bez kolizji (świadomie, jak w wymaganiach).
  lamp(x, z, yaw = 0, kind = 'cobra', o = {}) {
    const pole = { t: 'metal', c: o.pole || 0x3a3a48 }, light = o.light || 0xffc46b, h = o.h || (kind === 'deco' ? 4.2 : 7.5);
    this.at(x, 0, z, yaw, () => {
      this.cyl(0, 0, 0, 0.12, 0.5, pole, { sides: 6, r2: 0.09 });
      this.cyl(0, 0.5, 0, 0.08, h - 0.5, pole, { sides: 6, r2: 0.06 });
      if (kind === 'deco') {
        this.cyl(0, h, 0, 0.26, 0.5, { t: 'neon', sub: SUB.neon(6) }, { sides: 6, r2: 0.18 });
        this.glow(0, 0, 4.2, light, (o.k || 1) * 0.55);
        this.halo(0, h + 0.25, 0, 1.6, 1.6, 0, light, 0.35);
      } else {
        const arms = kind === 'double' ? [1, -1] : [1];
        for (const s of arms) {
          this.at(0, 0, 0, s > 0 ? 0 : PI, () => {
            this.box(-0.05, h - 0.08, 0, 0.05, h, 2.2, pole);
            this.box(-0.22, h - 0.22, 1.8, 0.22, h - 0.04, 2.6, pole);
            this.face([-0.18, h - 0.225, 1.85], [0.36, 0, 0], [0, 0, 0.7], { t: 'lightpanel' });
            this.glow(0, 2.6, 5.2, light, (o.k || 1) * 0.6);
            this.caster(0, h - 0.13, 1.3, 0.2, 0.08, 1.2);
          });
        }
      }
    });
    this.caster(x, h / 2, z, 0.09, h / 2, 0.09);
    this.lights.push([x, z, light]);
    return this;
  }
  // słup energetyczny z poprzeczką; łączy się kablami z następnym (wires: [[x,z], ...] kolejne słupy)
  utilityPoles(pts, h = 9, o = {}) {
    const wood = { t: 'wood_wall', c: 0x5a4636 }, wire = { t: 'dark', c: 0x1a1620 };
    for (const [x, z] of pts) {
      this.cyl(x, 0, z, 0.16, h, wood, { sides: 6, r2: 0.12 });
      this.caster(x, h / 2, z, 0.12, h / 2, 0.12);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, px = -uz, pz = ux;
      for (const off of [-0.9, 0, 0.9]) for (const dh of [0, -0.6]) {
        const segs = 6, sag = 0.9;
        for (let k = 0; k < segs; k++) {
          const t0 = k / segs, t1 = (k + 1) / segs, y0 = h - 0.3 + dh - sag * 4 * t0 * (1 - t0), y1 = h - 0.3 + dh - sag * 4 * t1 * (1 - t1);
          const A = [ax + (bx - ax) * t0 + px * off, y0, az + (bz - az) * t0 + pz * off], Bq = [ax + (bx - ax) * t1 + px * off, y1, az + (bz - az) * t1 + pz * off];
          this.quad4([A[0], A[1] - 0.02, A[2]], [Bq[0], Bq[1] - 0.02, Bq[2]], [Bq[0], Bq[1] + 0.02, Bq[2]], [A[0], A[1] + 0.02, A[2]], wire, { double: true });
        }
      }
    }
    for (let i = 0; i < pts.length; i++) {
      const [x, z] = pts[i], n = pts[Math.min(pts.length - 1, i + 1)], p = pts[Math.max(0, i - 1)], dx = n[0] - p[0], dz = n[1] - p[1], L = Math.hypot(dx, dz) || 1;
      this.at(x, 0, z, Math.atan2(dx / L, dz / L), () => { this.box(-1.15, h - 0.42, -0.06, 1.15, h - 0.28, 0.06, wood); this.box(-0.5, h - 1.02, -0.06, 0.5, h - 0.9, 0.06, wood); this.cyl(0.55, h - 1.6, 0.25, 0.22, 0.6, { t: 'metal', c: 0x7a7a80 }, { sides: 6 }); });
    }
    return this;
  }
  // sygnalizator nad skrzyżowaniem: słup w (x,z), wysięgnik długości arm w stronę yaw, światło (red/green/amber)
  trafficLight(x, z, yaw, arm = 4, state = 'red') {
    const pole = { t: 'metal', c: 0x2e2e38 }, col = { red: 7, green: 4, amber: 3 }[state] ?? 7, glowC = { red: 0xff3040, green: 0x39ff88, amber: 0xffa030 }[state] || 0xff3040;
    this.at(x, 0, z, yaw, () => {
      this.cyl(0, 0, 0, 0.12, 6.2, pole, { sides: 6, r2: 0.1 });
      this.box(-0.06, 5.9, 0, 0.06, 6.05, arm, pole);
      this.box(-0.22, 4.9, arm - 0.4, 0.22, 5.9, arm - 0.05, { t: 'dark', c: 0x1e1e26 });
      const yy = state === 'red' ? 5.65 : state === 'amber' ? 5.4 : 5.15;
      this.panel(0, yy, arm - 0.4 - 0.005, 0.2, 0.2, PI, { t: 'neon', sub: SUB.neon(col) });
      this.panel(0, yy, arm - 0.05 + 0.005, 0.2, 0.2, 0, { t: 'neon', sub: SUB.neon(col) });
      this.halo(0, yy, arm - 0.42, 1.2, 1.2, PI, glowC, 0.5); this.halo(0, yy, arm - 0.03, 1.2, 1.2, 0, glowC, 0.5);
      this.glow(0, arm - 0.2, 3.5, glowC, 0.35);
    });
    this.solid(x - 0.12, 0, z - 0.12, x + 0.12, 3, z + 0.12, { shadow: false });
    this.caster(x, 3.1, z, 0.1, 3.1, 0.1);
    return this;
  }
  // neon: świecąca rura/pas (lokalnie od a do b na wysokości y, przy ścianie zwróconej w yaw), kolor: indeks z NEON
  neonBar(x0, y0, z0, x1, y1, z1, color = 0, o = {}) {
    this.box(x0, y0, z0, x1, y1, z1, { t: 'neon', sub: SUB.neon(color) }, { skip: o.skip || '' });
    return this;
  }
  // szyld z napisem z atlasu (signs_a/b/c/v + indeks), świecący, z aurą w kolorze glowC; patrzy w stronę yaw (+Z lokalnie)
  sign(x, y, z, w, h, yaw, tile, idx, glowC = 0xff2d95, o = {}) {
    const sub = tile === 'signs_v' ? SUB.signCol(idx) : SUB.signRow(idx);
    this.at(x, y, z, yaw, () => {
      if (o.board !== false) this.box(-w / 2 - 0.08, -h / 2 - 0.08, -0.14, w / 2 + 0.08, h / 2 + 0.08, -0.01, { t: 'dark', c: o.boardC || 0x241c30 });
      this.panel(0, 0, 0.002, w, h, 0, { t: tile, sub });
      if (o.halo !== false) this.halo(0, 0, 0.1, w * 1.5, h * 2.2, 0, glowC, o.k || 0.5, { double: false });
      if (o.ground !== false) this.glow(0, Math.max(1.2, y * 0.35), Math.max(w, 2.2) * 0.9, glowC, (o.k || 0.5) * 0.9, { y: 0.03 - y, sx: 1, sz: 0.8 });
    });
    if (o.cast) this.caster(x, y, z, w / 2, h / 2, 0.1, yaw);
    return this;
  }
  // markiza nad wejściem (lokalnie w ścianie zwróconej w yaw): szerokość w, wysięg d, wysokość y; stripe: indeks STRIPE (0..3)
  awning(x, y, z, w, d, yaw, stripe = 0, o = {}) {
    this.at(x, y, z, yaw, () => {
      const drop = o.drop || 0.5, m = stripeMat(stripe);
      this.quad4([-w / 2, 0, 0], [w / 2, 0, 0], [w / 2, -drop, d], [-w / 2, -drop, d], m, { double: true });
      this.quad4([-w / 2, -drop, d], [w / 2, -drop, d], [w / 2, -drop - 0.3, d], [-w / 2, -drop - 0.3, d], m, { double: true });
      this.caster(0, -drop / 2, d / 2, w / 2, drop / 2 + 0.05, d / 2);
    });
    return this;
  }
  // ławka (bez kolizji przy niskiej wysokości – gracz przechodzi), kosz na śmieci, hydrant, skrzynka
  bench(x, z, yaw = 0, color = 0xb07a52) {
    const w = { t: 'wood_wall', c: color }, m = { t: 'metal', c: 0x3a3a48 };
    this.at(x, 0, z, yaw, () => { this.box(-0.9, 0.42, -0.22, 0.9, 0.48, 0.22, w); this.box(-0.9, 0.55, -0.26, 0.9, 0.85, -0.2, w); for (const s of [-0.75, 0.75]) this.box(s - 0.04, 0, -0.22, s + 0.04, 0.45, 0.2, m); });
    this.at(x, 0, z, yaw, () => this.solid(-0.9, 0, -0.26, 0.9, 0.5, 0.22));
    return this;
  }
  trash(x, z, color = 0x3fb7b0) { this.cyl(x, 0, z, 0.3, 0.95, { t: 'metal', c: color }, { sides: 8 }); this.cyl(x, 0.95, z, 0.33, 0.06, { t: 'metal', c: 0x2a2a30 }, { sides: 8 }); return this; }
  hydrant(x, z) { this.cyl(x, 0, z, 0.16, 0.6, { t: 'metal', c: 0xd83a3a }, { sides: 6 }); this.cyl(x, 0.6, z, 0.12, 0.18, { t: 'metal', c: 0xf2c14e }, { sides: 6, r2: 0.04 }); return this; }
  // kontener morski 6 m (dir 0: długość wzdłuż Z), stackable: y = poziom podstawy
  container(x, z, dir = 0, color = 0xc0503a, y = 0, o = {}) {
    const L = o.long ? 12.2 : 6.1, W = 2.44, H = 2.6;
    this.at(x, y, z, dir & 1 ? HALF : 0, () => {
      this.block(-W / 2, 0, -L / 2, W / 2, H, L / 2, { side: { t: 'container', c: color, s: [2.4, 2.6] }, pz: { t: 'container', c: color, k: 0.85, s: [2.44, 2.6] }, nz: { t: 'container', c: color, k: 0.85, s: [2.44, 2.6] }, top: { t: 'corrugated', c: color, k: 0.9 } });
    });
    return this;
  }
  // kontener na śmieci (1,3 m – osłona)
  dumpster(x, z, dir = 0, color = 0x3f7a4a) {
    this.at(x, 0, z, dir & 1 ? HALF : 0, () => {
      this.block(-0.95, 0, -0.75, 0.95, 1.25, 0.75, { side: { t: 'metal', c: color, g: [0.7, 1] }, top: { t: 'metal', c: color, k: 0.7 } });
      this.box(-1.0, 1.25, -0.8, 1.0, 1.32, 0.8, { t: 'dark', c: 0x22262a });
    });
    return this;
  }
  // betonowa zapora drogowa (0,9 m) długości len, wzdłuż osi dir 0: Z, 1: X
  barrier(x, z, dir = 0, len = 3, color = 0xd9d2cc) {
    this.at(x, 0, z, dir & 1 ? HALF : 0, () => {
      this.block(-0.32, 0, -len / 2, 0.32, 0.35, len / 2, { t: 'concrete', c: color });
      this.block(-0.15, 0.35, -len / 2, 0.15, 0.95, len / 2, { side: { t: 'stripes_red', s: [1.2, 0.6] }, top: { t: 'concrete', c: color } });
    });
    return this;
  }
  // donica z krzewem / palemką (osłona 0,6 m)
  planter(x0, z0, x1, z1, color = 0xf6efe2, plant = true) {
    this.block(x0, 0, z0, x1, 0.6, z1, { top: { t: 'grass', c: 0x6a5a40 }, side: { t: 'stucco', c: color } });
    if (plant) { const w = Math.min(x1 - x0, z1 - z0); this.box(x0 + 0.15, 0.6, z0 + 0.15, x1 - 0.15, 0.6 + Math.min(1.1, w * 0.9), z1 - 0.15, { top: { t: 'foliage', c: 0x4f8a3a, k: 1.1 }, side: { t: 'foliage', c: 0x4f8a3a, g: [0.7, 1.05] } }, { cast: true }); }
    return this;
  }
  // parasol plażowy (bez kolizji) i leżak
  umbrella(x, z, stripe = 0) {
    this.cyl(x, 0, z, 0.03, 2.3, { t: 'white', c: 0xf4f1ea }, { sides: 4 });
    this.cyl(x, 2.0, z, 1.25, 0.45, stripeMat(stripe), { sides: 8, r2: 0.05 });
    this.caster(x, 2.15, z, 0.95, 0.15, 0.95);
    return this;
  }
  lounger(x, z, yaw = 0, color = 0x3fb7b0) {
    this.at(x, 0, z, yaw, () => {
      this.box(-0.32, 0.25, -0.9, 0.32, 0.32, 0.5, { t: 'fabric', c: color });
      this.quad4([-0.32, 0.32, 0.5], [0.32, 0.32, 0.5], [0.32, 0.8, 0.95], [-0.32, 0.8, 0.95], { t: 'fabric', c: color }, { double: true });
      for (const [a, b] of [[-0.3, -0.85], [0.3, -0.85], [-0.3, 0.45], [0.3, 0.45]]) this.box(a - 0.02, 0, b - 0.02, a + 0.02, 0.26, b + 0.02, { t: 'white', c: 0xe8e4dc });
    });
    return this;
  }
  // kiosk / budka (np. lody, surf, bilety): kolizja całej budki, okienko od strony yaw (+Z lokalnie)
  kiosk(x, z, yaw, w, d, color = 0x8fd8e0, o = {}) {
    const h = o.h || 2.6;
    this.at(x, 0, z, yaw, () => {
      this.block(-w / 2, 0, -d / 2, w / 2, h, d / 2, { side: { t: 'stucco', c: color, g: [0.85, 1.05] }, top: { t: 'roof', c: 0xd8d0c8 } });
      this.panel(0, 1.55, d / 2 + 0.01, w * 0.7, 0.9, 0, { t: 'shopfront_lit', u0: 0.1, u1: 0.9 });
      this.box(-w / 2 - 0.1, 1.0, d / 2, w / 2 + 0.1, 1.08, d / 2 + 0.45, { t: 'white', c: 0xf4f1ea });
      this.awning(0, h - 0.05, d / 2, w + 0.3, 0.9, 0, o.awning === undefined ? 0 : o.awning, { drop: 0.35 });
      if (o.sign !== undefined) this.sign(0, h + 0.45, d / 2 - 0.2, w * 0.9, w * 0.22, 0, o.signTile || 'signs_b', o.sign, o.glow || 0xff2d95, { ground: false, k: 0.4 });
      this.glow(0, d / 2 + 1.2, 2.2, 0xffd9a0, 0.35);
    });
    return this;
  }
  // wieża ratowników: platforma 1,8 m na palach, budka, rampa/schodki od strony back (yaw: budka patrzy w +Z lokalnie, na morze)
  lifeguard(x, z, yaw, color = 0xff8fb0, o = {}) {
    const H = 1.8;
    this.at(x, 0, z, yaw, () => {
      for (const [a, b] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) this.box(a - 0.1, 0, b - 0.1, a + 0.1, H, b + 0.1, { t: 'wood_wall', c: 0xd8c8b0 });
      this.solid(-1.5, H - 0.25, -1.5, 1.5, H, 1.6);
      this.box(-1.5, H - 0.25, -1.5, 1.5, H, 1.6, { top: { t: 'boardwalk', c: 0xe0c8a0, s: 0 }, side: { t: 'wood_wall', c: 0xd8c8b0 } });
      // budka: ściany 1,1 m (osłona) z otworem z przodu, dach
      this.wall(-1.2, -1.2, 1.2, -1.2, H, H + 2.2, 0.12, { t: 'wood_wall', c: color }, { t: 'wood_wall', c: color, k: 0.8 }, [{ at: 1.2, w: 1.0, y0: 0, y1: 2.0 }], { frames: false });
      this.wall(-1.2, -1.2, -1.2, 1.2, H, H + 2.2, 0.12, { t: 'wood_wall', c: color, k: 0.9 }, { t: 'wood_wall', c: color, k: 0.8 }, [{ at: 1.2, w: 1.4, y0: 1.0, y1: 1.9 }], { frames: false });
      this.wall(1.2, -1.2, 1.2, 1.2, H, H + 2.2, 0.12, { t: 'wood_wall', c: color, k: 0.9 }, { t: 'wood_wall', c: color, k: 0.8 }, [{ at: 1.2, w: 1.4, y0: 1.0, y1: 1.9 }], { frames: false });
      this.wall(-1.2, 1.2, 1.2, 1.2, H, H + 1.1, 0.12, { t: 'wood_wall', c: color }, { t: 'wood_wall', c: color, k: 0.8 }, [], { frames: false });
      this.block(-1.55, H + 2.2, -1.55, 1.55, H + 2.4, 1.75, { top: { t: 'roof', c: 0xf4f1ea }, side: { t: 'stripes_red', s: [1.2, 0.2] } });
      this.box(-1.25, H + 1.1, 1.14, 1.25, H + 1.22, 1.26, { t: 'white', c: 0xf4f1ea });
      // schodki z tyłu (z = -1.5 w dół)
      this.stairs(0, -1.5 - 0.32 * 8, 0, 1.0, 0, H, { t: 'boardwalk', c: 0xe0c8a0, s: 0 }, { rise: 0.225, side: { t: 'wood_wall', c: 0xd8c8b0 }, open: true, railColor: 0xf4f1ea });
      if (o.flag !== false) { this.box(1.3, H + 2.4, 1.5, 1.35, H + 4.4, 1.55, { t: 'white', c: 0xf4f1ea }); this.panel(1.65, H + 4.0, 1.525, 0.6, 0.4, HALF, { t: 'white', c: 0xff3a3a }, { double: true }); }
    });
    return this;
  }
  // ogrodzenie z siatki (przezroczyste, wycinane alfa): kule przelatują (blokada tylko dla ruchu – clip)
  chainFence(x0, z0, x1, z1, h = 2.4) {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 2.5)), pole = { t: 'metal', c: 0x7a808a };
    for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; this.cyl(x, 0, z, 0.05, h, pole, { sides: 5 }); }
    const m = { t: 'chainlink', s: [2.5, h] };
    const dx = x1 - x0, dz = z1 - z0;
    this.face([x0, 0, z0], [dx, 0, dz], [0, h, 0], { ...m, chan: 'cut' });
    this.face([x1, 0, z1], [-dx, 0, -dz], [0, h, 0], { ...m, chan: 'cut' });
    this.clip(Math.min(x0, x1) - 0.05, 0, Math.min(z0, z1) - 0.05, Math.max(x0, x1) + 0.05, h, Math.max(z0, z1) + 0.05);
    return this;
  }
  // niski murek / balustrada (kolizja), np. przy plaży
  lowWall(x0, z0, x1, z1, h = 1.0, m = { t: 'stucco', c: 0xf6efe2 }, cap = { t: 'concrete', c: 0xeae4dc }) {
    this.block(x0, 0, z0, x1, h, z1, { top: cap, side: { ...mat(m), g: [0.82, 1.02] } });
    return this;
  }
  // billboard na dwóch słupach: środek (x,z), patrzy w stronę yaw, art: billboard_a|b|c
  billboard(x, z, yaw, art = 'billboard_a', o = {}) {
    const w = o.w || 9, h = o.h || 4.2, y = o.y || 6;
    this.at(x, 0, z, yaw, () => {
      for (const s of [-w * 0.3, w * 0.3]) this.box(s - 0.18, 0, -0.18, s + 0.18, y, 0.18, { t: 'metal', c: 0x4a4a58 });
      this.box(-w / 2 - 0.15, y - 0.15, -0.35, w / 2 + 0.15, y + h + 0.15, -0.05, { t: 'metal', c: 0x2a2a34 });
      this.panel(0, y + h / 2, -0.04, w, h, 0, { t: art });
      this.box(-w / 2, y - 0.5, 0, w / 2, y - 0.4, 0.7, { t: 'metal', c: 0x3a3a46 });
      this.halo(0, y + h / 2, 0.4, w * 1.1, h * 1.4, 0, o.glow || 0xffb0d0, 0.18, { double: false });
      this.caster(0, y + h / 2, -0.2, w / 2, h / 2, 0.15);
    });
    for (const s of [-w * 0.3, w * 0.3]) this.at(x, 0, z, yaw, () => this.solid(s - 0.18, 0, -0.18, s + 0.18, y, 0.18));
    return this;
  }
  // łódka na piasku / przy kei (dir 0: dziób w +Z): kolizja kadłuba 0,9 m
  boat(x, z, dir = 0, color = 0xf4f1ea, stripe = 0x3fb7b0) {
    this.at(x, 0, z, [0, HALF, PI, -HALF][dir & 3], () => {
      const hull = { t: 'white', c: color };
      this.prism([[-0.9, -2.2], [0.9, -2.2], [0.9, 1.2], [0, 2.4], [-0.9, 1.2]], 0, 0.9, { side: { ...hull, g: [0.75, 1] }, top: { t: 'boardwalk', c: 0xc8a070, s: 0 } });
      this.prism([[-0.92, -2.22], [0.92, -2.22], [0.92, 1.22], [0, 2.44], [-0.92, 1.22]], 0.62, 0.8, { side: { t: 'white', c: stripe }, top: null });
      this.box(-0.7, 0.9, -1.5, 0.7, 1.0, -1.2, { t: 'wood_wall', c: 0xb07a52 });
      this.solid(-0.9, 0, -2.2, 0.9, 0.9, 1.8);
    });
    return this;
  }

  // ================= tło poza obszarem gry (kanał 'far': jedna siatka, bez kolizji i bez cieni) =================
  // panorama wieżowców na łuku: środek (cx,cz), promienie rMin..rMax, kąty a0..a1 (rad, kierunek (sin a, cos a)), n budynków
  skyline(cx, cz, rMin, rMax, a0, a1, n, hMin, hMax, o = {}) {
    const cols = o.colors || [0x4a3a78, 0x3a3068, 0x5a4488, 0x2e2a5a, 0x6a4a8a];
    for (let i = 0; i < n; i++) {
      const a = a0 + (a1 - a0) * (i + this.vr() * 0.8) / n, r = rMin + this.vr() * (rMax - rMin);
      const x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r, w = 8 + this.vr() * 14, d = 8 + this.vr() * 12;
      const h = hMin + Math.pow(this.vr(), 1.6) * (hMax - hMin), c = this.vpick(cols), lit = o.lit === undefined ? 0.85 : o.lit;
      this.at(x, 0, z, a, () => {
        const m = { t: 'skyline', c, s: [12, 12], k: lit };
        this.box(-w / 2, 0, -d / 2, w / 2, h, d / 2, { side: m, top: { t: 'dark', c } }, { chan: 'far' });
        const kind = this.vr();
        if (kind < 0.25) { this.box(-w / 3, h, -d / 3, w / 3, h + h * 0.12, d / 3, { side: m, top: { t: 'dark', c } }, { chan: 'far' }); this.cyl(0, h * 1.12, 0, 0.4, h * 0.18, { t: 'metal', c: 0x8a8aa0 }, { sides: 4, r2: 0.05, chan: 'far' }); }
        else if (kind < 0.45) { this.cyl(0, h, 0, Math.min(w, d) * 0.45, h * 0.15, { t: 'skyline', c, k: lit }, { sides: 6, r2: Math.min(w, d) * 0.12, chan: 'far' }); }
        if (this.vr() < (o.neon === undefined ? 0.35 : o.neon)) this.box(-w / 2 - 0.2, h - 1.2, -d / 2 - 0.2, w / 2 + 0.2, h - 0.6, d / 2 + 0.2, { side: { t: 'neon', sub: SUB.neon(this.vpick([0, 1, 2, 1, 0, 3])) }, top: null }, { chan: 'far' });
        if (this.vr() < 0.3) this.cyl(w * 0.2, h, d * 0.1, 0.15, 6, { t: 'metal', c: 0x6a6a80 }, { sides: 4, chan: 'far' });
      });
    }
    return this;
  }
  // diabelski młyn w tle (kanał far): środek osi (x, y, z), promień r, płaszczyzna koła obrócona o yaw
  ferris(x, y, z, r, yaw = 0, o = {}) {
    const n = 16, steel = { t: 'metal', c: 0xe8e4f0 }, lights = { t: 'neon', sub: SUB.neon(o.neon === undefined ? 0 : o.neon) };
    this.at(x, 0, z, yaw, () => {
      for (const s of [-1, 1]) this.quad4([-r * 0.55, 0, s * 1.2], [0, y, s * 0.3], [0.25, y, s * 0.3], [-r * 0.55 + 0.4, 0, s * 1.2], steel, { chan: 'far', double: true });
      for (const s of [-1, 1]) this.quad4([r * 0.55, 0, s * 1.2], [r * 0.55 - 0.4, 0, s * 1.2], [-0.25, y, s * 0.3], [0, y, s * 0.3], steel, { chan: 'far', double: true });
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
        const P = (a, rr) => [Math.cos(a) * rr, y + Math.sin(a) * rr];
        const [ax, ay] = P(a0, r), [bx, by] = P(a1, r), [cx, cy] = P(a1, r - 0.35), [dx, dy] = P(a0, r - 0.35);
        this.quad4([ax, ay, 0], [bx, by, 0], [cx, cy, 0], [dx, dy, 0], lights, { chan: 'far', double: true });
        this.quad4([0, y - 0.1, 0], [ax, ay - 0.08, 0], [ax, ay + 0.08, 0], [0, y + 0.1, 0], steel, { chan: 'far', double: true });
        this.box(ax - 0.5, ay - 1.2, -0.6, ax + 0.5, ay - 0.3, 0.6, { t: 'white', c: this.vpick([0xff6fa0, 0x3fb7b0, 0xffe14a, 0xb44dff]) }, { chan: 'far' });
      }
    });
    return this;
  }
  // most w tle: pomost od (x0,z0) do (x1,z1) na wysokości h, z pylonami i świecącymi linami
  farBridge(x0, z0, x1, z1, h = 14, o = {}) {
    const L = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0), w = o.w || 16, c = o.c || 0x3a3058;
    this.at(x0, 0, z0, yaw, () => {
      this.box(-w / 2, h - 1.6, 0, w / 2, h, L, { side: { t: 'concrete_wall', c, s: [12, 1.6] }, top: { t: 'dark', c: 0x2a2440 }, bottom: { t: 'dark', c } }, { chan: 'far' });
      this.box(-w / 2, h, 0, -w / 2 + 0.3, h + 0.8, L, { t: 'neon', sub: SUB.neon(o.neon === undefined ? 1 : o.neon) }, { chan: 'far' });
      const nP = o.pylons || 2;
      for (let i = 1; i <= nP; i++) {
        const zz = (L * i) / (nP + 1), ph = h * 2.6;
        for (const s of [-1, 1]) this.box(s * w / 2 - 1, 0, zz - 1, s * w / 2 + 1, ph, zz + 1, { side: { t: 'concrete_wall', c, s: [2, 6] }, top: { t: 'dark', c } }, { chan: 'far' });
        this.box(-w / 2 - 1, ph - 3, zz - 0.8, w / 2 + 1, ph - 1.5, zz + 0.8, { t: 'concrete_wall', c }, { chan: 'far' });
        for (const s of [-1, 1]) for (const dz of [-1, 1]) {
          const to = zz + dz * L / (nP + 1) * 0.5;
          this.quad4([s * w / 2, ph - 2, zz], [s * w / 2, ph - 1.6, zz], [s * w / 2, h + 0.4, to], [s * w / 2, h, to], { t: 'neon', sub: SUB.neon(6) }, { chan: 'far', double: true });
        }
      }
      const nPier = Math.max(2, Math.floor(L / 40));
      for (let i = 0; i <= nPier; i++) { const zz = (L * i) / nPier; this.box(-w / 3, 0, zz - 1.5, w / 3, h - 1.6, zz + 1.5, { t: 'concrete_wall', c, s: [4, 6] }, { chan: 'far' }); }
    });
    return this;
  }
  // niskie wzgórza / wyspa w tle: wypukły wielokąt pts [[x,z]...], wysokość h
  hill(pts, h, c = 0x3a2a4a) {
    let cx = 0, cz = 0; for (const p of pts) { cx += p[0]; cz += p[1]; } cx /= pts.length; cz /= pts.length;
    const top = pts.map(([x, z]) => [cx + (x - cx) * 0.45, cz + (z - cz) * 0.45]), m = { t: 'grass', c, k: 0.9 };
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], A = top[i], Bt = top[(i + 1) % pts.length], hh = h * (0.75 + 0.5 * this.vr());
      this.quad4([b[0], 0, b[1]], [a[0], 0, a[1]], [A[0], hh, A[1]], [Bt[0], hh, Bt[1]], m, { chan: 'far', double: true });
    }
    return this;
  }

  // ---------------- budynek zamknięty (bez wnętrza) z elewacją ----------------
  // st: { c: kolor ścian, wall: kafel ścian ('stucco'), win: kafel okien ('win_deco'), lit: ułamek okien świecących (0..1),
  //       ground: kafel parteru ('shopfront' | 'shopfront_lit' | kafel okien | null = jak piętra), groundH: wysokość parteru,
  //       floorH: wysokość piętra, bands: gzymsy między piętrami (kolor | false), cornice: kolor gzymsu na górze,
  //       roof: kolor dachu, parapet: wysokość attyki, hide: 'nx,pz' ściany ukryte (przy sąsiednim budynku), sides: { px: {...st} } }
  // Kolizja: jeden prostopadłościan (x0,0,z0)-(x1,h,z1) + attyka, jeśli dach ma być dostępny (st.roofSolid).
  tower(x0, z0, x1, z1, h, st = {}) {
    const c = st.c === undefined ? 0xf6efe2 : st.c, floorH = st.floorH || 3.2, gH = st.groundH || Math.max(3.6, floorH), hide = st.hide || '';
    const winT = st.win || 'win_deco', litT = winT.endsWith('_lit') ? winT : winT + '_lit', wallT = st.wall || 'stucco';
    const sides = { px: [x1, z1, 0, 0, -(z1 - z0)], nx: [x0, z0, 0, 0, z1 - z0], pz: [x0, z1, x1 - x0, 0, 0], nz: [x1, z0, -(x1 - x0), 0, 0] };
    const lit = st.lit || 0;
    for (const [k, [ox, oz, ux, , uz]] of Object.entries(sides)) {
      if (hide.includes(k)) continue;
      const S = { ...st, ...((st.sides || {})[k] || {}) }, W = Math.hypot(ux, uz), U = [ux, 0, uz];
      const sc = S.c === undefined ? c : S.c, wT = S.win || winT, lT = wT.endsWith('_lit') ? wT : wT + '_lit';
      // parter
      const gT = S.ground === undefined ? wT : S.ground;
      if (gT === null || S.blank) this.face([ox, 0, oz], U, [0, gH, 0], { t: S.wall || wallT, c: sc, g: [0.8, 1] });
      else this.face([ox, 0, oz], U, [0, gH, 0], { t: gT, c: gT.startsWith('shop') ? 0xffffff : sc, g: [0.85, 1] });
      // piętra: kolumny okien, część świeci (losowo, deterministycznie po vr)
      const nFloors = Math.max(0, Math.round((h - gH - (S.top || 0.8)) / floorH));
      const yTop = gH + nFloors * floorH;
      if (S.blank) this.face([ox, gH, oz], U, [0, h - gH, 0], { t: S.wall || wallT, c: sc, g: [0.95, 1.05] });
      else {
        const nb = Math.max(1, Math.round(W / (S.bay || 3)));
        for (let f = 0; f < nFloors; f++) for (let b = 0; b < nb; b++) {
          const o = [ox + ux * b / nb, gH + f * floorH, oz + uz * b / nb], UU = [ux / nb, 0, uz / nb];
          const on = this.vr() < (S.lit === undefined ? lit : S.lit);
          this.face(o, UU, [0, floorH, 0], { t: on ? lT : wT, c: sc, s: 0, g: [0.96, 1.03] });
        }
        if (h - yTop > 0.05) this.face([ox, yTop, oz], U, [0, h - yTop, 0], { t: S.wall || wallT, c: sc });
      }
      // gzymsy (wizualne)
      const bandC = S.bands === undefined ? 0xffffff : S.bands, nxn = -uz / (W || 1), nzn = ux / (W || 1);   // normalna ściany na zewnątrz
      if (bandC !== false) for (let f = 0; f <= nFloors; f++) {
        const y = gH + f * floorH, d = f === 0 ? 0.35 : 0.1, th = f === 0 ? 0.12 : 0.06;
        const ax = ox, az = oz, bx = ox + ux, bz = oz + uz;
        this.box(Math.min(ax, bx, ax + nxn * d, bx + nxn * d), y - th, Math.min(az, bz, az + nzn * d, bz + nzn * d),
          Math.max(ax, bx, ax + nxn * d, bx + nxn * d), y + th, Math.max(az, bz, az + nzn * d, bz + nzn * d), { t: 'white', c: bandC }, { cast: f === 0 });
      }
    }
    // dach + attyka + gzyms
    const par = st.parapet === undefined ? 0.9 : st.parapet, corn = st.cornice === undefined ? 0xffffff : st.cornice;
    this.box(x0, h - 0.01, z0, x1, h, z1, { top: { t: 'roof', c: st.roof || 0xcfc6bc }, side: null });
    if (par > 0) this.parapetVis(x0, z0, x1, z1, h, par, 0.3, { t: wallT, c }, corn);
    if (st.roofSolid) { this.solid(x0, 0, z0, x1, h, z1); if (par > 0) this.parapetSolid(x0, z0, x1, z1, h, par, 0.3); }
    else this.solid(x0, 0, z0, x1, h + par, z1);
    // dach: maszynownia, klimatyzatory, zbiornik wody (wizualne, z cieniem)
    if (st.roofProps !== false) {
      const w = x1 - x0, d = z1 - z0, n = Math.max(1, Math.round((w * d) / 120));
      for (let i = 0; i < n; i++) {
        const px = x0 + 1.2 + this.vr() * Math.max(0.1, w - 3.6), pz = z0 + 1.2 + this.vr() * Math.max(0.1, d - 3.6);
        this.box(px, h, pz, px + 1.4, h + 1.0, pz + 1.0, { side: { t: 'vent', c: 0xd8d4d0 }, top: { t: 'metal', c: 0xb8b4b0 } }, { cast: true });
      }
      if (st.tank) { const tx = x0 + w * 0.7, tz = z0 + d * 0.3; for (const [a, b] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) this.box(tx + a - 0.06, h, tz + b - 0.06, tx + a + 0.06, h + 2, tz + b + 0.06, { t: 'wood_wall', c: 0x5a4636 }); this.cyl(tx, h + 2, tz, 1.2, 2.2, { t: 'wood_wall', c: 0x8a6a4a }, { sides: 10, cast: true }); this.cyl(tx, h + 4.2, tz, 1.25, 0.6, { t: 'roof', c: 0x4a3a2a }, { sides: 10, r2: 0.1 }); }
    }
    return this;
  }
  parapetVis(x0, z0, x1, z1, y, h, t, m, cap) {
    for (const [a, b, c, d] of [[x0, z0, x1, z0 + t], [x0, z1 - t, x1, z1], [x0, z0 + t, x0 + t, z1 - t], [x1 - t, z0 + t, x1, z1 - t]]) {
      this.box(a, y, b, c, y + h, d, { side: m, top: { t: 'concrete', c: 0xeae4dc } });
      if (cap) this.box(a - 0.06, y + h, b - 0.06, c + 0.06, y + h + 0.12, d + 0.06, { t: 'white', c: cap });
    }
    return this;
  }
  parapetSolid(x0, z0, x1, z1, y, h, t) {
    for (const [a, b, c, d] of [[x0, z0, x1, z0 + t], [x0, z1 - t, x1, z1], [x0, z0 + t, x0 + t, z1 - t], [x1 - t, z0 + t, x1, z1 - t]]) this.solid(a, y, b, c, y + h, d);
    return this;
  }

  // ---------------- budynek z wnętrzem ----------------
  // x0,z0,x1,z1: obrys zewnętrzny; o: {
  //   floors: [3.6, 3.4] wysokości kondygnacji (parter pierwszy), t: grubość ścian (0,3), slab: grubość stropu (0,25),
  //   wall: materiał zewnętrzny, inner: materiał wewnętrzny, floor: [mat parteru, mat 1. piętra, ...], ceil: materiał sufitu, roof: materiał dachu,
  //   open: { nz: [{ at, w, y0, y1, f }], px: [...] } otwory w ścianach (at: od narożnika x0/z0 do środka, y0/y1 względem kondygnacji f, f domyślnie 0),
  //   holes: [[x0,z0,x1,z1,f]] otwory w stropie NAD kondygnacją f (klatka schodowa), roofHoles: [[x0,z0,x1,z1]],
  //   parapet: wysokość attyki (0 = brak), parapetGaps: [{ side, at, w }], roofAccess: true (dach jest grywalny) }
  // Zwraca { top: wysokość dachu, levels: [y podłogi każdej kondygnacji] }
  shell(x0, z0, x1, z1, o = {}) {
    const fl = o.floors || [3.6], t = o.t || 0.3, sl = o.slab || 0.25, H = fl.reduce((a, b) => a + b, 0);
    const W = o.wall || { t: 'stucco', c: 0xf6efe2 }, I = o.inner || { t: 'plaster', c: 0xeee6dc, k: 1.1 }, E = o.edge || W;
    const levels = []; { let y = 0; for (const h of fl) { levels.push(y); y += h; } }
    const ops = (side) => (o.open && o.open[side] ? o.open[side] : []).map((q) => ({ ...q, y0: levels[q.f || 0] + (q.y0 || 0), y1: levels[q.f || 0] + (q.y1 === undefined ? 2.4 : q.y1) }));
    // ściany wzdłuż X (pełna długość) i wzdłuż Z (między nimi)
    this.wall(x0, z1 - t / 2, x1, z1 - t / 2, 0, H, t, W, I, ops('pz'), { edge: E, frame: o.frame });
    this.wall(x0, z0 + t / 2, x1, z0 + t / 2, 0, H, t, I, W, ops('nz'), { edge: E, frame: o.frame });
    this.wall(x1 - t / 2, z0 + t, x1 - t / 2, z1 - t, 0, H, t, W, I, ops('px').map((q) => ({ ...q, at: q.at - t })), { edge: E, frame: o.frame });
    this.wall(x0 + t / 2, z0 + t, x0 + t / 2, z1 - t, 0, H, t, I, W, ops('nx').map((q) => ({ ...q, at: q.at - t })), { edge: E, frame: o.frame });
    // podłogi: parter malowany na ziemi, wyższe kondygnacje jako stropy z otworami
    const fm = (i) => (o.floor && o.floor[i]) || o.floor?.[0] || { t: 'tile_terra' }, cm = o.ceil || { t: 'plaster', c: 0xf2ece4, k: 1.05 };
    this.paint(x0 + t * 0.5, z0 + t * 0.5, x1 - t * 0.5, z1 - t * 0.5, fm(0));
    for (let i = 1; i < fl.length; i++) {
      const holes = (o.holes || []).filter((h) => (h[4] === undefined ? 0 : h[4]) === i - 1);
      this.slab(x0 + t, z0 + t, x1 - t, z1 - t, levels[i], sl, fm(i), cm, holes);
    }
    // dach
    const roofM = o.roof || { t: 'roof', c: 0xd6cec4 };
    this.slab(x0 + t, z0 + t, x1 - t, z1 - t, H, sl, roofM, cm, o.roofHoles || []);
    const par = o.parapet === undefined ? 1.0 : o.parapet;
    if (par > 0) {
      const gaps = o.parapetGaps || [];
      this.parapet(x0, z0, x1, z1, H, par, t, W, gaps);
      const cap = o.cap === undefined ? 0xffffff : o.cap;
      if (cap !== false) for (const [s, a, b, c, d] of [['nz', x0, z0, x1, z0 + t], ['pz', x0, z1 - t, x1, z1], ['nx', x0, z0, x0 + t, z1], ['px', x1 - t, z0, x1, z1]]) if (!gaps.some((g) => g.side === s)) this.box(a - 0.05, H + par, b - 0.05, c + 0.05, H + par + 0.1, d + 0.05, { t: 'white', c: cap });
    }
    return { top: H, levels };
  }
}

// ---------------- podłoże: rasteryzacja malowania i scalanie w kafle wyrównane do siatki świata ----------------
function buildGround(B, bounds, step = 0.5) {
  const [X0, Z0, X1, Z1] = bounds, nx = Math.ceil((X1 - X0) / step), nz = Math.ceil((Z1 - Z0) / step);
  const grid = new Int32Array(nx * nz).fill(-1);
  B.paints.forEach(([a, b, c, d], i) => {
    const i0 = Math.max(0, Math.round((a - X0) / step)), i1 = Math.min(nx, Math.round((c - X0) / step));
    const j0 = Math.max(0, Math.round((b - Z0) / step)), j1 = Math.min(nz, Math.round((d - Z0) / step));
    for (let j = j0; j < j1; j++) for (let k = i0; k < i1; k++) grid[j * nx + k] = i;
  });
  // klucz materiału: ten sam kafel/odcień/obrót = jedna grupa (łączenie prostokątów)
  const keyOf = (i) => { const m = B.paints[i][4]; return JSON.stringify([m.t, m.c, m.k, m.rot, m.s]); };
  const keys = new Map(), kid = new Int32Array(nx * nz).fill(-1);
  for (let q = 0; q < grid.length; q++) if (grid[q] >= 0) { const k = keyOf(grid[q]); if (!keys.has(k)) keys.set(k, { id: keys.size, m: B.paints[grid[q]][4] }); kid[q] = keys.get(k).id; }
  const mats = [...keys.values()].sort((a, b) => a.id - b.id).map((v) => v.m);
  const used = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const q = j * nx + i; if (used[q] || kid[q] < 0) continue;
    const id = kid[q]; let w = 1; while (i + w < nx && !used[q + w] && kid[q + w] === id) w++;
    let h = 1; outer: while (j + h < nz) { for (let k = 0; k < w; k++) { const qq = (j + h) * nx + i + k; if (used[qq] || kid[qq] !== id) break outer; } h++; }
    for (let a = 0; a < h; a++) for (let k = 0; k < w; k++) used[(j + a) * nx + i + k] = 1;
    groundRect(B, X0 + i * step, Z0 + j * step, X0 + (i + w) * step, Z0 + (j + h) * step, mats[id]);
  }
}
function groundRect(B, x0, z0, x1, z1, m) {
  const size = m.s || TILE_SIZE[m.t] || [4, 4], su = size[0], sv = size[1] || su, R = tileRect(m), base = lin(m.c === undefined ? 0xffffff : m.c, m.k === undefined ? 1 : m.k);
  const C = [base, base, base, base], N = [0, 1, 0], y = m.y || 0;
  // rot 1/3: oś u kafla biegnie wzdłuż Z świata, więc powtórzenia w X i Z zamieniają się miejscami
  const rot = m.rot || 0, odd = rot === 1 || rot === 3, ru = odd ? sv : su, rv = odd ? su : sv;
  for (let a = Math.floor(x0 / ru) * ru; a < x1 - 1e-6; a += ru) for (let b = Math.floor(z0 / rv) * rv; b < z1 - 1e-6; b += rv) {
    const qa = Math.max(a, x0), qb = Math.min(a + ru, x1), qc = Math.max(b, z0), qd = Math.min(b + rv, z1);
    if (qb - qa < 1e-6 || qd - qc < 1e-6) continue;
    const P = [[qa, y, qd], [qb, y, qd], [qb, y, qc], [qa, y, qc]];
    const UV = P.map((p) => tuv(R, (p[0] - a) / ru, 1 - (p[2] - b) / rv, rot, m.flip));     // tekstura „do góry" = -Z
    B.wquad(m.chan || 'op', P, N, UV, C);
  }
}

// ---------------- definicja mapy ----------------
// spec: { name, seed, bounds: [x0, z0, x1, z1] (obszar grywalny), ground: [x0,z0,x1,z1] (malowane podłoże, domyślnie bounds+40), env, layout(B) }
export function defineMap(spec) {
  const def = { ...spec };
  def.run = (visual) => {
    const B = new Builder(def, visual);
    spec.layout(B);
    if (visual) buildGround(B, spec.ground || [spec.bounds[0] - 40, spec.bounds[1] - 40, spec.bounds[2] + 40, spec.bounds[3] + 40]);
    return B;
  };
  // dane rozgrywki (serwer i fizyka klienta): to samo co w oaza-data.js
  const B = def.run(false);
  def.data = { name: spec.name, spawns: B.spawns, colliders: B.colliders, clips: B.clips, ladders: B.ladders };
  def.meta = { noHit: B.noHit, noShadow: B.noShadow, notes: B.notes };
  // geometria do rysowania (tylko w przeglądarce / w narzędziach): bufory sektorów + rzucający cień
  def.geometry = () => {
    const V = def.run(true);
    const bufs = [...V.bufs.values()].filter((b) => b.v > 0).map((b) => ({
      chan: b.chan, key: b.key, sx: b.sx, sz: b.sz, tris: b.tris,
      position: new Float32Array(b.p), normal: new Float32Array(b.n), uv: new Float32Array(b.uv), color: new Float32Array(b.c),
      index: b.v < 65536 ? new Uint16Array(b.ix) : new Uint32Array(b.ix),
    }));
    // kontrola zgodności: kolizje z przebiegu z geometrią muszą być identyczne jak dane serwera
    if (V.colliders.length !== B.colliders.length) throw new Error(`vice-kit: ${spec.name}: liczba kolizji różni się między przebiegami (${V.colliders.length} vs ${B.colliders.length}) – układ zależy od trybu`);
    const shadow = B.colliders.filter((_, i) => !def.meta.noShadow.includes(i));
    return { bufs, casters: V.casters, shadowBoxes: shadow, lights: V.lights, tris: bufs.reduce((a, b) => a + b.tris, 0) };
  };
  return def;
}
