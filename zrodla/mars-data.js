// Mapa MARS (1v1, nazwa w kodzie: „Mars”): baza badawcza na lewitującej wyspie z czerwonej skały.
// Na środku duży moduł mieszkalny (HAB-01) ze śluzami od strony obu spawnów, oknami na wschód i zachód, regałem w środku
// i drabinami na dach (antena, klimatyzatory). Na zachodzie płaskowyż z iglicami skalnymi, kanion i sonda wbita w krater,
// na wschodzie szklarnia z roślinami, zbiorniki, łazik i rzędy paneli słonecznych; przy spawnach maszt łączności, generator,
// rury i skrzynie z zaopatrzeniem.
// Ten plik ma TYLKO dane rozgrywki (spawny, kolizje AABB, drabiny, układ) – czyta go też serwer meczów (Node, bez three.js).
// Wygląd buduje zrodla/mars-scena.js z tych samych liczb, więc kolizje i grafika zawsze się zgadzają.
// Mapa jest lustrzana: strona B to strona A odbita względem osi X (z → −z).

export const HX = 16, HZ = 27;                 // pół szerokości (X) i pół długości (Z) pola gry; grunt na wysokości 0
// moduł mieszkalny: podłoga 0,5 m (fundament), ściany 0,25 m, sufit 3,9 m, dach 4,3 m z attyką
export const HAB = { x0: -5, x1: 5, z0: -3.6, z1: 3.6, floor: 0.5, t: 0.25, ceil: 3.9, roof: 4.3, door: 0.8, doorTop: 2.8,
  win: [1.45, 2.2], winZ: [0.7, 2.5], parapet: 0.55 };
// śluza (przedsionek) przed drzwiami strony A (B = odbicie)
export const VEST = { x0: -1.7, x1: 1.7, z0: -6.0, z1: -3.6, top: 3.2, roof: 3.5 };
export const MESA = { x0: -HX, x1: -10, z0: -20.5, z1: -9, top: 1.5 };                      // płaskowyż strony A
export const STEPS = [                                                                      // stopnie 1,0 m na płaskowyż (strona A)
  [-10, -16.4, -9.2, -13.2],             // od środka mapy
  [-15.6, -21.3, -11.6, MESA.z0],        // od spawnu
  [-15.4, MESA.z1, -11.4, -8.2],         // od kanionu
];
// iglice skalne strony A: [x, z, szer. X, szer. Z, wysokość, podstawa]
export const SPIRES = [
  [-14.6, -18.0, 1.7, 1.5, 7.6, MESA.top],
  [-11.7, -12.3, 1.2, 1.3, 4.6, MESA.top],
  [-12.9, -5.3, 2.1, 1.7, 6.4, 0],
  [-8.3, -6.6, 1.4, 1.4, 3.1, 0],
];
export const PROBE = { x0: -12.4, x1: -9.6, z0: -1.15, z1: 1.15, h: 1.6 };                  // krater z sondą (na środku, lustrzany sam w sobie)
export const GREEN = { x: 10.6, z: -12.4, r: 2.6, h: 2.6, dome: 3.4 };                      // szklarnia strony A
export const TANKS = [[15.15, -15.2], [15.15, -9.7]];                                       // zbiorniki przy krawędzi (strona A)
export const ROVER = { x0: 8.3, x1: 12.9, z0: -6.6, z1: -4.4, h: 2.1 };                    // łazik strony A (przód na wschód)
export const SOLAR = { x0: 8.2, x1: 15.0, z0: -2.3, z1: -0.9, h: 1.15 };                   // rząd paneli strony A (B = odbicie)
export const TOWER = { x: 14.4, z: -21.6, w: 0.9, h: 9.5 };                                 // maszt łączności strony A
export const PIPE = { x: -6, z0: -15.4, z1: -4.2, w: 0.4, h: 0.35 };                         // rura od generatora do modułu
export const PADS = [[0, -24, 3.2], [-6.2, -24.6, 1.8]];                                     // lądowiska (płaskie, bez kolizji): x, z, promień

const r3 = (v) => Math.round(v * 1000) / 1000;
const C = [];
const box = (x0, y0, z0, x1, y1, z1) => { C.push([r3(x0), r3(y0), r3(z0), r3(x1), r3(y1), r3(z1)]); };
// bryła strony A i jej odbicie na stronę B (z → −z)
const both = (x0, y0, z0, x1, y1, z1) => { box(x0, y0, z0, x1, y1, z1); box(x0, y0, -z1, x1, y1, -z0); };

// ---------------- moduł mieszkalny ----------------
export const HAB_WALLS = [];                                                                 // ściany strony A (grafika kładzie na nich panele)
{
  const { x0, x1, z0, z1, floor: F, t, ceil: CE, roof: RF, door: D, doorTop: DT, win: [w0, w1], winZ: [wz0, wz1], parapet: PP } = HAB;
  const w = (a, b, c, d, e, f) => { both(a, b, c, d, e, f); HAB_WALLS.push([a, b, c, d, e, f]); };
  box(x0 - 0.4, 0, z0 - 0.4, x1 + 0.4, F, z1 + 0.4);                                         // fundament (wchodzi się jednym stopniem 0,5 m)
  // ściana od spawnu: drzwi na środku
  w(x0, F, z0, -D, CE, z0 + t); w(D, F, z0, x1, CE, z0 + t); w(-D, DT, z0, D, CE, z0 + t);
  // ściany wschodnia i zachodnia: okno (od |z| = 0,7 do 2,5) i pełny pas na środku (drabina z zewnątrz)
  for (const [a, b] of [[x0, x0 + t], [x1 - t, x1]]) {
    w(a, F, z0 + t, b, CE, -wz1);
    w(a, F, -wz1, b, w0, -wz0); w(a, w1, -wz1, b, CE, -wz0);
    box(a, F, -wz0, b, CE, wz0);                                                             // pas środkowy (wspólny dla A i B)
  }
  box(x0 - 0.25, CE, z0 - 0.25, x1 + 0.25, RF, z1 + 0.25);                                   // strop / dach
  // attyka na dachu (przerwy przy drabinach na |z| < 0,6)
  both(x0 - 0.25, RF, z0 - 0.25, x1 + 0.25, RF + PP, z0 - 0.05);
  for (const [a, b] of [[x0 - 0.25, x0 - 0.05], [x1 + 0.05, x1 + 0.25]]) both(a, RF, z0 - 0.05, b, RF + PP, -0.6);
  // na dachu: klimatyzatory (osłony) i maszt z anteną
  for (const sx of [-1, 1]) both(sx > 0 ? 2.2 : -3.5, RF, -2.4, sx > 0 ? 3.5 : -2.2, RF + 1.0, -1.2);
  box(-0.2, RF, -0.2, 0.2, RF + 2.8, 0.2);
  // w środku: regał z serwerami (zasłania przelot drzwi–drzwi), konsole pod oknami, szafki przy drzwiach
  box(-0.9, F, -0.45, 0.9, 3.0, 0.45);
  for (const [a, b] of [[x0 + t, x0 + t + 0.6], [x1 - t - 0.6, x1 - t]]) both(a, F, -2.6, b, F + 0.9, -1.5);
  both(x0 + t, F, z0 + t, x0 + t + 0.6, F + 2.1, z0 + t + 0.75);
  both(x1 - t - 0.6, F, z0 + t, x1 - t, F + 2.1, z0 + t + 0.75);
}
// śluza: ściany boczne, ściana zewnętrzna z drzwiami, dach; przed nią stopień
{
  const { x0, x1, z0, z1, top: T, roof: RF } = VEST, F = HAB.floor, D = HAB.door, DT = HAB.doorTop, t = 0.25;
  both(x0, 0, z0, x1, F, z1);                                                                // podłoga śluzy
  both(x0, F, z0, x0 + t, T, z1); both(x1 - t, F, z0, x1, T, z1);
  both(x0 + t, F, z0, -D, T, z0 + t); both(D, F, z0, x1 - t, T, z0 + t); both(-D, DT, z0, D, T, z0 + t);
  both(x0 - 0.1, T, z0 - 0.1, x1 + 0.1, RF, z1);
  both(-1.2, 0, z0 - 0.6, 1.2, 0.25, z0);                                                    // stopień przed śluzą
}
// drabiny na dach: na zewnątrz ścian wschodniej i zachodniej, na środku (wspólne dla obu stron)
// [x0, y0, z0, x1, y1, z1, nx, nz] – w tej bryle gracz się wspina; y1 trochę nad dachem, żeby dało się zejść na dach
export const LADDERS = [
  [HAB.x0 - 0.75, 0, -0.35, HAB.x0 - 0.3, HAB.roof + 0.35, 0.35, -1, 0],
  [HAB.x1 + 0.3, 0, -0.35, HAB.x1 + 0.75, HAB.roof + 0.35, 0.35, 1, 0],
];

// ---------------- zachód: płaskowyż, iglice, krater z sondą ----------------
both(MESA.x0, 0, MESA.z0, MESA.x1, MESA.top, MESA.z1);
for (const [x0, z0, x1, z1] of STEPS) both(x0, 0, z0, x1, 1.0, z1);
for (const [x, z, sx, sz, h, y] of SPIRES) both(x - sx / 2, y, z - sz / 2, x + sx / 2, y + h, z + sz / 2);
box(PROBE.x0, 0, PROBE.z0, PROBE.x1, PROBE.h, PROBE.z1);
box(-10.9, PROBE.h, -0.45, -10.0, PROBE.h + 0.9, 0.45);                                      // sonda wbita w kamień
both(-15.2, 0, -3.3, -14.0, 1.15, -2.3);                                                     // głaz przy krawędzi kanionu

// ---------------- wschód: szklarnia, zbiorniki, łazik, panele słoneczne ----------------
{
  const { x, z, r, h, dome } = GREEN, a = r * Math.cos(Math.PI / 6);                         // sześciokąt: bryły w kształcie krzyża
  both(x - r, 0, z - a * 0.58, x + r, h, z + a * 0.58);
  both(x - r * 0.58, 0, z - a, x + r * 0.58, h, z + a);
  both(x - r * 0.62, h, z - a * 0.62, x + r * 0.62, dome, z + a * 0.62);                     // kopułka
}
for (const [x, z] of TANKS) both(x - 0.85, 0, z - 0.85, HX, 2.8, z + 0.85);
both(ROVER.x0, 0, ROVER.z0, ROVER.x1, ROVER.h, ROVER.z1);
both(ROVER.x0 + 0.5, ROVER.h, ROVER.z0 + 0.2, ROVER.x0 + 2.0, ROVER.h + 0.45, ROVER.z1 - 0.2);  // bagażnik na dachu
both(SOLAR.x0, 0, SOLAR.z0, SOLAR.x1, SOLAR.h, SOLAR.z1);

// ---------------- przy spawnach: maszt, generator, rura, skrzynie ----------------
// t: typ, x/z: środek; kolizje względem środka – localBoxes(); y podstawy zawsze 0
const SIDE_A = [
  { t: 'cargo', x: 0, z: -20.2 },                                  // ściana ze skrzyń przed spawnem (zasłania długą linię przez moduł)
  { t: 'generator', x: -6.0, z: -16.6 },
  { t: 'crates', x: 6.6, z: -18.2 },
  { t: 'tower', x: TOWER.x, z: TOWER.z },
  { t: 'astro', x: 7.3, z: -14.3, rot: -1.75 },                     // astronauta-ogrodnik przy szklarni
  { t: 'rock', x: -3.4, z: -12.6 },
  { t: 'rock', x: 4.2, z: -10.4, s: 0.8 },
  { t: 'beacon', x: 3.1, z: -8.2 },
];
export const OBJECTS = [...SIDE_A.map((o) => ({ ...o, side: 'A' })), ...SIDE_A.map((o) => ({ ...o, z: -o.z, side: 'B' }))];
export function localBoxes(o) {
  switch (o.t) {
    case 'cargo': return [[-2.6, 0, -0.55, 2.6, 1.35, 0.55], [-1.6, 1.35, -0.5, 0.4, 2.3, 0.5]];
    case 'generator': return [[-0.9, 0, -0.65, 0.9, 1.8, 0.65]];
    case 'crates': return [[-1.2, 0, -0.8, 1.2, 1.3, 0.8], [-0.4, 1.3, -0.55, 0.7, 2.2, 0.55]];
    case 'tower': return [[-TOWER.w / 2, 0, -TOWER.w / 2, TOWER.w / 2, TOWER.h, TOWER.w / 2]];
    case 'astro': return [[-0.36, 0, -0.36, 0.36, 1.9, 0.36]];
    case 'rock': { const s = o.s || 1; return [[-0.8 * s, 0, -0.65 * s, 0.8 * s, 1.05 * s, 0.65 * s]]; }
    case 'beacon': return [[-0.14, 0, -0.14, 0.14, 2.4, 0.14]];
    default: return [];
  }
}
for (const o of OBJECTS) {                                                                   // strona B: lokalne Z też odbite
  const m = o.side === 'B' ? -1 : 1;
  for (const [x0, y0, z0, x1, y1, z1] of localBoxes(o)) box(o.x + x0, y0, o.z + Math.min(m * z0, m * z1), o.x + x1, y1, o.z + Math.max(m * z0, m * z1));
}
both(PIPE.x - PIPE.w / 2, 0, PIPE.z0, PIPE.x + PIPE.w / 2, PIPE.h, PIPE.z1);                  // rura (przechodzi się nad nią)

// ---------------- granice: niewidzialne ściany na krawędzi wyspy ----------------
box(HX, 0, -HZ - 0.5, HX + 0.5, 9, HZ + 0.5); box(-HX - 0.5, 0, -HZ - 0.5, -HX, 9, HZ + 0.5);
box(-HX - 0.5, 0, HZ, HX + 0.5, 9, HZ + 0.5); box(-HX - 0.5, 0, -HZ - 0.5, HX + 0.5, 9, -HZ);

C.sort((a, b) => a[4] - b[4]);                                                              // od najniższej do najwyższej (jak w pozostałych mapach)

// clipy (blokują tylko ruch): nad iglicami i masztami, żeby nie wspinać się po ich kolizjach; nad dachem śluzy
const CLIPS = [
  [VEST.x0 - 0.1, VEST.roof, VEST.z0 - 0.1, VEST.x1 + 0.1, 9, VEST.z1], [VEST.x0 - 0.1, VEST.roof, -VEST.z1, VEST.x1 + 0.1, 9, -VEST.z0 + 0.1],
];

export const MAP = {
  name: 'Mars',
  spawns: [{ name: 'Spawn_A', x: 0, y: 0, z: -24, yaw: Math.PI }, { name: 'Spawn_B', x: 0, y: 0, z: 24, yaw: 0 }],
  colliders: C,
  clips: CLIPS,
  ladders: LADDERS,
};

// wygląd (three.js) wczytuje się dopiero w przeglądarce – serwer meczów potrzebuje tylko danych powyżej
export async function build() {
  const { buildMars } = await import('./mars-scena.js');
  return buildMars();
}
