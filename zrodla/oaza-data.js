// Mapa BAGNO (1v1, nazwa w kodzie: „Oaza”): przystań na bagnie z rozlewiskiem. Drewniany sklepik z przynętami na palach,
// pomosty, dwa hydroplany przy pomostach, przyczepy kempingowe, dęby z wystającymi korzeniami, beczki, zwalony pień.
// Ten plik ma TYLKO dane rozgrywki (spawny, kolizje AABB, układ obiektów) – czyta go też serwer meczów (Node, bez three.js).
// Wygląd buduje zrodla/bagno-scena.js z tego samego układu, więc kolizje i grafika zawsze się zgadzają.
// Mapa jest symetryczna: strona B to strona A obrócona o 180° wokół środka (x → −x, z → −z).

export const HX = 16, HZ = 26;                 // pół szerokości (X) i pół długości (Z) pola gry
export const LAND = 0.5;                        // ląd: 0,5 m nad dnem rozlewiska (w wodzie brodzi się po kolana)
export const WL = 0.32;                         // lustro wody
export const DECK = 1.35;                       // podłoga sklepiku i tarasu na palach
export const PIER = 0.9;                        // pomosty i kładki
export const SHACK = { x0: -4, x1: 4, z0: -2.2, z1: 2.2, t: 0.2, wall: DECK + 2.7 };   // sklepik (ściany 20 cm)

const r3 = (v) => Math.round(v * 1000) / 1000;
const C = [];
const box = (x0, y0, z0, x1, y1, z1) => { C.push([r3(x0), r3(y0), r3(z0), r3(x1), r3(y1), r3(z1)]); };
// bryła i jej odbicie na stronę B (obrót o 180° wokół środka)
const both = (x0, y0, z0, x1, y1, z1) => { box(x0, y0, z0, x1, y1, z1); box(-x1, y0, -z1, -x0, y1, -z0); };

// ---------------- teren: dwa brzegi z umocnieniem z bali, rozlewisko w poprzek mapy i zatoczki ----------------
// woda: kanał |z| < 5 przez całą szerokość + zatoczka A (x < −9, −11 < z < −5) i zatoczka B (odbicie)
export const WATER = [[-HX, -5, HX, 5], [-HX, -11, -9, -5], [9, 5, HX, 11]];          // prostokąty [x0, z0, x1, z1]
both(-HX, 0, -HZ, HX, LAND, -11);
both(-9, 0, -11, HX, LAND, -5);

// ---------------- taras na palach ze sklepikiem (środek mapy) ----------------
export const DECK_RECT = [-7, -3.6, 7, 3.6];
box(-7, 0, -3.6, 7, DECK, 3.6);
// kładka z brzegu na taras (stopień 0,42 m z lądu i 0,43 m na taras) – po jednej z każdej strony, na środku
export const GANGWAYS = [[-1.1, -5, 1.1, -3.6]];                                          // strona A (B = odbicie)
for (const [x0, z0, x1, z1] of GANGWAYS) both(x0, 0, z0, x1, 0.92, z1);
// pomosty na wschód i zachód od tarasu (przy nich cumują hydroplany) + stopień do wody na końcu
export const PIERS = [[7, -1, 12.2, 1]];
both(7, 0, -1, 12.2, PIER, 1);
both(12.2, 0, -1, 12.8, 0.45, 1);
// boczna kładka z brzegu A na pomost wschodni (strona B: z brzegu B na pomost zachodni)
export const FINGERS = [[9.6, -5, 10.8, -1]];
for (const [x0, z0, x1, z1] of FINGERS) both(x0, 0, z0, x1, PIER, z1);
// pale wystające 0,5 m nad pomost (przy krawędziach, w obrysie pomostu) i słupki ganku pod okapem
export const PILES = [];
for (const x of [7.4, 9.0, 11.8]) for (const z of [-0.88, 0.88]) PILES.push([x, z, PIER]);
for (const z of [-4.6, -2.6]) PILES.push([10.68, z, PIER]);
export const POSTS = [[-4.2, -3.48], [-1.4, -3.48], [1.4, -3.48], [4.2, -3.48]];          // ganek A (B = odbicie)
for (const [x, z, y] of PILES) both(x - 0.13, y, z - 0.13, x + 0.13, y + 0.5, z + 0.13);
for (const [x, z] of POSTS) both(x - 0.09, DECK, z - 0.09, x + 0.09, 3.65, z + 0.09);

// sklepik: ściany z otworami na drzwi (środek ściany od strony A i B) i okna (parapet 1 m nad podłogą, okno 1 m wysokie)
export const SHACK_WALLS = [];                                                           // bryły ścian (grafika układa z nich deski)
{
  const { x0, x1, z0, t, wall } = SHACK, sill = DECK + 1, top = DECK + 2, door = DECK + 2.15;
  const w = (a, b, c, d, e, f) => { both(a, b, c, d, e, f); SHACK_WALLS.push([a, b, c, d, e, f], [-d, b, -f, -a, e, -c]); };
  // ściana od strony A (z = −2,2) – odbicie daje ścianę od strony B
  w(x0, DECK, z0, -3.3, wall, z0 + t);
  w(-3.3, DECK, z0, -1.7, sill, z0 + t); w(-3.3, top, z0, -1.7, wall, z0 + t);                // okno
  w(-1.7, DECK, z0, -0.6, wall, z0 + t);
  w(-0.6, door, z0, 0.6, wall, z0 + t);                                                        // nadproże drzwi
  w(0.6, DECK, z0, 1.7, wall, z0 + t);
  w(1.7, DECK, z0, 3.3, sill, z0 + t); w(1.7, top, z0, 3.3, wall, z0 + t);                    // okno
  w(3.3, DECK, z0, x1, wall, z0 + t);
  // ściana wschodnia (x = 4) z oknem na pomost – odbicie daje zachodnią
  w(x1 - t, DECK, z0 + t, x1, wall, -0.8);
  w(x1 - t, DECK, -0.8, x1, sill, 0.8); w(x1 - t, top, -0.8, x1, wall, 0.8);
  w(x1 - t, DECK, 0.8, x1, wall, -z0 - t);
  // dach dwuspadowy nad sklepikiem i gankami (okap 3,65 m, kalenica ~5,35 m)
  box(-4.6, 3.65, -3.8, 4.6, wall, 3.8);
  box(-4.6, wall, -2.6, 4.6, wall + 0.7, 2.6);
  box(-4.6, wall + 0.7, -1.2, 4.6, wall + 1.3, 1.2);
  // w środku: lada na środku i regały z przynętą pod ścianami
  box(-1.2, DECK, -0.35, 1.2, DECK + 1.0, 0.35);
  both(3.0, DECK, -1.95, 3.8, DECK + 2.0, -0.95);
}

// ---------------- obiekty strony A (strona B = obrót o 180°) ----------------
// t: typ, x/z: środek, rot: obrót (wielokrotność 90°), look: wariant wyglądu; kolizje liczy localBoxes() niżej
const SIDE_A = [
  { t: 'plane', x: -11.8, z: -6.3, rot: Math.PI, look: 'yellow' },        // hydroplan w zatoczce A (dziobem do −Z)
  { t: 'trailer', x: 9.6, z: -18.2, look: 'mint' },                       // przyczepa kempingowa (aluminiowa, zaokrąglona)
  { t: 'oak', x: -7.5, z: -15.5 },                                        // dąb z wystającymi korzeniami
  { t: 'cypress', x: -4.5, z: -6.6 },                                     // cypryś przy brzegu
  { t: 'log', x: 4.2, z: -12.55 },                                        // zwalony pień
  { t: 'roots', x: 11.6, z: -8.6 },                                       // splątane korzenie i złamany pień przy brzegu
  { t: 'barrels', x: -2.7, z: -9.4, n: 3 },
  { t: 'tires', x: 3.0, z: -6.8 },
  { t: 'picnic', x: 8.2, z: -11.6 },
  { t: 'fence', x: 0, z: -19.5, w: 5.2 },                                 // płot z desek przed spawnem (zasłania długą linię przez sklepik)
  { t: 'pole', x: -14.2, z: -20.5 },                                      // słup z transformatorem
  { t: 'deckBarrels', x: 5.6, z: -2.75 },                                 // beczki na tarasie (wschód, strona A)
  { t: 'crates', x: -5.8, z: -2.5, y: DECK },                             // skrzynki na tarasie (zachód, strona A)
];
const rot180 = (o) => ({ ...o, x: -o.x, z: -o.z, rot: (o.rot || 0) + Math.PI, side: 'B' });
const LOOK_B = { yellow: 'white', mint: 'peach' };
export const OBJECTS = [...SIDE_A.map((o) => ({ ...o, side: 'A' })), ...SIDE_A.map((o) => { const b = rot180(o); if (LOOK_B[o.look]) b.look = LOOK_B[o.look]; return b; })];

// kolizje obiektu w układzie lokalnym (przed obrotem): [x0, y0, z0, x1, y1, z1] względem środka obiektu i jego podstawy
export function localBoxes(o) {
  switch (o.t) {
    case 'plane': return [                                                 // dziób w stronę +Z (lokalnie)
      [-1.5, 0, -2.3, -0.9, 0.75, 3.7], [0.9, 0, -2.3, 1.5, 0.75, 3.7],   // pływaki
      [-0.6, 1.15, -1.7, 0.6, 2.75, 3.9],                                  // kadłub z kabiną
      [-0.45, 1.3, 3.9, 0.45, 2.5, 4.5],                                   // silnik i kołpak
      [-0.3, 1.6, -4.4, 0.3, 2.45, -1.7],                                  // belka ogonowa
      [-4.2, 2.75, 1.1, 4.2, 2.92, 2.7],                                   // skrzydło (górnopłat)
    ];
    case 'trailer': return [[-3.3, 0, -1.25, 3.3, 2.8, 1.25]];
    case 'oak': return [[-0.7, 0, -0.7, 0.7, 6, 0.7], [-2.1, 0, -0.9, -0.7, 0.75, 0.5], [0.7, 0, 0.5, 1.9, 0.65, 1.6], [-0.5, 0, 0.7, 0.5, 0.55, 2.3]];
    case 'cypress': return [[-0.6, 0, -0.6, 0.6, 7, 0.6]];
    case 'log': return [[-2.4, 0, -0.35, 2.4, 0.72, 0.35]];
    case 'roots': return [[-1.0, 0, -0.7, 1.0, 0.9, 0.7], [-0.35, 0, -0.3, 0.35, 2.2, 0.4]];
    case 'barrels': return [[-0.6, 0, -0.51, 0.02, 0.92, 0.11], [0.04, 0, -0.46, 0.66, 0.92, 0.16], [-0.31, 0, 0.09, 0.31, 0.92, 0.71]].slice(0, o.n || 3);
    case 'deckBarrels': return [[-0.31, 0, -0.31, 0.31, 0.92, 0.31], [0.35, 0, 0.3, 0.97, 0.92, 0.92]];
    case 'crates': return [[-0.45, 0, -0.45, 0.45, 0.9, 0.45], [-0.35, 0.9, -0.35, 0.35, 1.6, 0.35]];
    case 'tires': return [[-0.55, 0, -0.55, 0.55, 1.0, 0.55]];
    case 'picnic': return [[-0.8, 0, -0.4, 0.8, 0.78, 0.4], [-0.8, 0, -0.95, 0.8, 0.45, -0.6], [-0.8, 0, 0.6, 0.8, 0.45, 0.95]];
    case 'fence': return [[-o.w / 2, 0, -0.15, o.w / 2, 1.55, 0.15]];
    case 'pole': return [[-0.15, 0, -0.15, 0.15, 8.5, 0.15]];
    default: return [];
  }
}
// wysokość podstawy obiektu: ląd, dno rozlewiska (hydroplan) albo taras
export const baseY = (o) => (o.y != null ? o.y : o.t === 'plane' ? 0 : o.t === 'deckBarrels' ? DECK : LAND);
// obrót (wielokrotność 90°) punktu lokalnego wokół środka obiektu – ten sam co w grafice (obrót o rot wokół osi Y)
export function toWorld(o, lx, lz) {
  const k = ((Math.round((o.rot || 0) / (Math.PI / 2)) % 4) + 4) % 4;
  const [x, z] = k === 0 ? [lx, lz] : k === 1 ? [lz, -lx] : k === 2 ? [-lx, -lz] : [-lz, lx];
  return [o.x + x, o.z + z];
}
for (const o of OBJECTS) {
  const y = baseY(o);
  for (const [x0, y0, z0, x1, y1, z1] of localBoxes(o)) {
    const [ax, az] = toWorld(o, x0, z0), [bx, bz] = toWorld(o, x1, z1);
    box(Math.min(ax, bx), y + y0, Math.min(az, bz), Math.max(ax, bx), y + y1, Math.max(az, bz));
  }
}

// ---------------- granice: niewidzialne ściany (na ziemi płoty i krzaki, na wodzie pale z liną i boje) ----------------
box(HX, 0, -HZ - 0.5, HX + 0.5, 6, HZ + 0.5); box(-HX - 0.5, 0, -HZ - 0.5, -HX, 6, HZ + 0.5);
box(-HX - 0.5, 0, HZ, HX + 0.5, 6, HZ + 0.5); box(-HX - 0.5, 0, -HZ - 0.5, HX + 0.5, 6, -HZ);

// kolizje posortowane od najniższej do najwyższej (tak jak w pozostałych mapach)
C.sort((a, b) => a[4] - b[4]);

export const MAP = {
  name: 'Oaza',
  spawns: [{ name: 'Spawn_A', x: 0, y: LAND, z: -22.5, yaw: Math.PI }, { name: 'Spawn_B', x: 0, y: LAND, z: 22.5, yaw: 0 }],
  colliders: C,
  ladders: [],
};

// wygląd (three.js) wczytuje się dopiero w przeglądarce – serwer meczów potrzebuje tylko danych powyżej
export async function build() {
  const { buildBayou } = await import('./bagno-scena.js');
  return buildBayou();
}
