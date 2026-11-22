// Mapa KASKADY (1v1, nazwa w kodzie: „Kaskady”): jesienna wyspa-diorama z tarasami z rudej ziemi, wodospadami i starą warownią.
// Ten plik ma TYLKO dane rozgrywki (spawny, kolizje AABB, układ) – czyta go też serwer meczów (Node, bez three.js).
// Wygląd buduje zrodla/kaskady-scena.js z tych samych liczb, więc kolizje i grafika zawsze się zgadzają.
// Mapa jest lustrzana: strona B to strona A odbita względem osi X (z → −z). Trzy drogi między stronami:
//   zachód – wysoki płaskowyż z kręgiem kamieni (3 m, schody od obu stron, wodospad spada z niego do stawu),
//   środek  – staw ze świecącą wodą (brodzi się po kolana), wyspa z krzakiem na środku, dwie drewniane kładki,
//   wschód  – taras z bramą warowni między dwiema wieżami (jedyne przejście górą to brama).

export const HX = 17, HZ = 27;                  // pół szerokości (X) i pół długości (Z) pola gry
export const LAND = 0.5;                        // łąka; staw ma dno na 0 (z wody na łąkę – jeden stopień 0,5 m)
export const WATER = 0.3;                       // lustro wody w stawie (tylko grafika)
export const POND = { x0: -8, x1: 7, z0: -5, z1: 5 };
export const CLIFF = { x0: -HX, x1: -8, z0: -6, z1: 6, top: 3.0 };                           // płaskowyż z kręgiem kamieni (wspólny)
export const CIRCLE = { x: -12.5, z: 0, r: 3.1 };                                            // krąg kamieni na płaskowyżu
export const FALL = { z0: -1.3, z1: 1.3 };                                                   // wodospad z płaskowyżu do stawu (x = CLIFF.x1)
export const TERRACE = { x0: 9, x1: HX, z0: -9, z1: 9, top: 1.8 };                           // taras z bramą (wspólny)
export const TOWERS = [10.4, 15.6];                                                          // środki wież bramy (x; z = 0)
export const GATE = { x0: 12.2, x1: 13.8, h: 2.6, wall: 3.2, tower: 5.4, tr: 1.2, t: 0.45 };  // brama: przejście, mur, wieże (wysokości nad tarasem)
export const ISLAND = { x0: -1.8, x1: 1.8, z0: -1.8, z1: 1.8, top: 0.8 };                  // wyspa na środku stawu
export const BRIDGES = [[-5.6, -4.3], [3.4, 4.7]];                                           // kładki przez staw [x0, x1], z od −5,4 do 5,4
export const BRIDGE_TOP = 0.75, BRIDGE_Z = 5.4;
// schody strony A (B = odbicie): [x0, x1, z0, z1, liczba stopni, od wysokości, do wysokości, kierunek wznoszenia: 'z' lub 'x']
export const STAIRS = [
  { name: 'cliff', x0: -13.2, x1: -10.8, z0: -11, z1: CLIFF.z0, n: 10, from: LAND, to: CLIFF.top, dir: 'z' },   // kamienne na płaskowyż
  { name: 'terrace', x0: 12.6, x1: 14.6, z0: -14, z1: TERRACE.z0, n: 5, from: LAND, to: TERRACE.top, dir: 'z' }, // drewniane na taras
  { name: 'pond', x0: 7, x1: TERRACE.x0, z0: -4.4, z1: -2.8, n: 5, from: LAND, to: TERRACE.top, dir: 'x' },      // od stawu na taras
];

const r3 = (v) => Math.round(v * 1000) / 1000;
const C = [];
const box = (x0, y0, z0, x1, y1, z1) => { C.push([r3(x0), r3(y0), r3(z0), r3(x1), r3(y1), r3(z1)]); };
// bryła strony A i jej odbicie na stronę B (z → −z)
const both = (x0, y0, z0, x1, y1, z1) => { box(x0, y0, z0, x1, y1, z1); box(x0, y0, -z1, x1, y1, -z0); };

// ---------------- teren: łąki obu stron, pas łąki przy tarasie, staw (dno na 0) ----------------
both(-HX, 0, -HZ, HX, LAND, POND.z0);
box(POND.x1, 0, POND.z0, HX, LAND, POND.z1);
// płaskowyż i taras (bryły od ziemi – boty i serwer widzą je jak ściany z wierzchem)
box(CLIFF.x0, 0, CLIFF.z0, CLIFF.x1, CLIFF.top, CLIFF.z1);
box(TERRACE.x0, 0, TERRACE.z0, TERRACE.x1, TERRACE.top, TERRACE.z1);

// ---------------- schody (stopnie sklejone w bryły „od ziemi do stopnia”, każda kolejna krótsza) ----------------
export function stairSteps(s) {
  const out = [], rise = (s.to - s.from) / s.n;
  for (let k = 1; k <= s.n; k++) {
    const y = s.from + rise * k;
    if (s.dir === 'z') { const d = (s.z1 - s.z0) / s.n, z = s.z0 + d * (k - 1); out.push([s.x0, 0, z, s.x1, y, s.z1]); }
    else { const d = (s.x1 - s.x0) / s.n, x = s.x0 + d * (k - 1); out.push([x, 0, s.z0, s.x1, y, s.z1]); }
  }
  return out;
}
for (const s of STAIRS) for (const b of stairSteps(s)) both(...b);
// stopień z wody pod schodami od stawu (dno 0 → 0,25 → łąka)
export const POND_STEP = [6.2, 0, -4.4, POND.x1, 0.25, -2.8];
both(...POND_STEP);

// ---------------- płaskowyż: murek (osłona) nad krawędzią, krąg kamieni, ołtarz ----------------
const T = CLIFF.top;
export const PARAPETS = [                                                                    // strona A (B = odbicie)
  [CLIFF.x1 - 0.6, T, CLIFF.z0, CLIFF.x1, T + 0.95, FALL.z0],                              // nad stawem (przerwa na wodospad)
  [CLIFF.x0, T, CLIFF.z0, -13.2, T + 0.95, CLIFF.z0 + 0.6],                                // nad łąką strony A (przerwa na schody)
  [-10.8, T, CLIFF.z0, CLIFF.x1 - 0.6, T + 0.95, CLIFF.z0 + 0.6],
];
for (const p of PARAPETS) both(...p);
export const MENHIRS = [-30, -90, -150].map((deg, i) => {                                   // strona A; środkowy wyższy
  const a = (deg * Math.PI) / 180;
  return { x: CIRCLE.x + Math.cos(a) * CIRCLE.r, z: CIRCLE.z + Math.sin(a) * CIRCLE.r, h: i === 1 ? 2.6 : 2.25, rot: -a };
});
for (const m of MENHIRS) both(m.x - 0.38, T, m.z - 0.38, m.x + 0.38, T + m.h, m.z + 0.38);
box(CIRCLE.x - 0.7, T, -0.5, CIRCLE.x + 0.7, T + 0.75, 0.5);                                 // ołtarz ze świecącym kryształem

// ---------------- staw: wyspa z krzakiem, kamienie do wejścia, kładki ----------------
box(ISLAND.x0, 0, ISLAND.z0, ISLAND.x1, ISLAND.top, ISLAND.z1);
box(-1.15, ISLAND.top, -1.15, 1.15, 2.55, 1.15);                                             // krzak (zasłania przelot środkiem)
both(-0.45, 0, -2.6, 0.45, 0.4, ISLAND.z0);                                                  // kamień-stopień z wody na wyspę
for (const [x0, x1] of BRIDGES) box(x0, 0, -BRIDGE_Z, x1, BRIDGE_TOP, BRIDGE_Z);

// ---------------- taras: mur z bramą i dwie okrągłe wieże ----------------
{
  const y = TERRACE.top, { x0: g0, x1: g1, h, wall, tower, tr, t } = GATE;
  for (const cx of TOWERS) {                                                                 // wieża: krzyż dwóch brył (prawie okrąg)
    box(cx - tr, y, -tr * 0.62, cx + tr, y + tower, tr * 0.62);
    box(cx - tr * 0.62, y, -tr, cx + tr * 0.62, y + tower, tr);
  }
  box(TOWERS[0] + tr * 0.9, y, -t, g0, y + wall, t);                                         // mur między wieżą a bramą
  box(g1, y, -t, TOWERS[1] - tr * 0.9, y + wall, t);
  box(g0, y + h, -t, g1, y + wall, t);                                                       // nadproże bramy
}
// płot na krawędzi tarasu (strona A): nad stawem i nad łąką, z przerwami na schody
export const FENCES = [
  [TERRACE.x0, TERRACE.z0, TERRACE.x0, -4.4],
  [TERRACE.x0, -2.8, TERRACE.x0, -1.35],
  [TERRACE.x0, TERRACE.z0, 12.6, TERRACE.z0],
  [14.6, TERRACE.z0, TERRACE.x1, TERRACE.z0],
];
export const FENCE_H = 1.0;
for (const [ax, az, bx, bz] of FENCES) both(Math.min(ax, bx) - 0.08, TERRACE.top, Math.min(az, bz) - 0.08, Math.max(ax, bx) + 0.08, TERRACE.top + FENCE_H, Math.max(az, bz) + 0.08);

// ---------------- obiekty strony A (strona B = odbicie) ----------------
// t: typ, x/z: środek, y: podstawa (domyślnie łąka); kolizje liczy localBoxes() niżej
const SIDE_A = [
  { t: 'archwall', x: 0, z: -19 },                                 // mur z łukiem przed spawnem (zasłania linię przez środek)
  { t: 'tower', x: -13.8, z: -18.5 },                               // okrągła strażnica (jak na obrazku 1)
  { t: 'stall', x: 5.6, z: -16.1 },                                 // stragan z dyniami
  { t: 'crate', x: 8.3, z: -17.6, s: 1.0 },
  { t: 'crate', x: 8.9, z: -18.9, s: 0.8 },
  { t: 'hay', x: -4.9, z: -24.2 },
  { t: 'crate', x: 5.2, z: -24.4, s: 1.1 },
  { t: 'tree', x: -7.2, z: -14.6, s: 1.0, c: 'orange' },           // drzewa liściaste (jesienne)
  { t: 'tree', x: 6.9, z: -21.9, s: 1.1, c: 'red' },
  { t: 'tree', x: -9.8, z: -22.0, s: 0.95, c: 'gold' },
  { t: 'tree', x: 15.3, z: -24.4, s: 1.05, c: 'orange' },
  { t: 'tree', x: -15.6, z: -24.6, s: 1.0, c: 'green' },
  { t: 'tree', x: 2.6, z: -11.6, s: 0.85, c: 'green' },
  { t: 'pine', x: -16.0, z: -9.6, s: 1.0 },                         // świerki
  { t: 'pine', x: 16.2, z: -16.4, s: 1.1 },
  { t: 'pine', x: 10.4, z: -11.2, s: 0.85 },
  { t: 'pine', x: -15.8, z: -4.4, y: CLIFF.top, s: 0.9 },           // świerk na płaskowyżu
  { t: 'rock', x: 5.4, z: -8.6 },
  { t: 'rock', x: -6.7, z: -7.3, s: 0.85 },
  { t: 'rock', x: -1.2, z: -14.8, s: 0.7 },
  { t: 'log', x: -3.4, z: -6.2 },                                    // zwalony pień nad stawem (niska osłona)
  { t: 'crate', x: 15.7, z: -6.2, y: TERRACE.top, s: 1.2, stack: true },   // skrzynie na tarasie
  { t: 'barrel', x: 10.3, z: -7.7, y: TERRACE.top },
  { t: 'barrel', x: 11.1, z: -8.1, y: TERRACE.top },
  { t: 'cart', x: 11.4, z: -4.0, y: TERRACE.top },
  { t: 'lamp', x: -1.9, z: -18.3 },                                  // latarnie
  { t: 'lamp', x: 6.6, z: -6.1 },
  { t: 'lamp', x: -10.4, z: -11.6 },
];
export const OBJECTS = [...SIDE_A.map((o) => ({ ...o, side: 'A' })), ...SIDE_A.map((o) => ({ ...o, z: -o.z, side: 'B' }))];

// kolizje obiektu względem jego środka i podstawy: [x0, y0, z0, x1, y1, z1] (strona A; dla B odbija się lokalne Z)
export function localBoxes(o) {
  const s = o.s || 1;
  switch (o.t) {
    case 'archwall': return [[-4.8, 0, -0.3, -1.4, 1.7, 0.3], [1.4, 0, -0.3, 4.8, 1.7, 0.3], [-1.4, 0, -0.35, -1.0, 2.8, 0.35], [1.0, 0, -0.35, 1.4, 2.8, 0.35], [-1.0, 2.3, -0.3, 1.0, 2.8, 0.3]];
    case 'tower': return [[-1.6, 0, -1.0, 1.6, 6.2, 1.0], [-1.0, 0, -1.6, 1.0, 6.2, 1.6]];
    case 'stall': return [[-1.45, 0, -0.45, 1.45, 1.05, 0.4], [-1.6, 2.4, -0.95, 1.6, 2.7, 0.95]];
    case 'crate': { const L = [[-0.5 * s, 0, -0.5 * s, 0.5 * s, s, 0.5 * s]]; if (o.stack) L.push([-0.35 * s, s, -0.35 * s, 0.35 * s, 1.7 * s, 0.35 * s]); return L; }
    case 'hay': return [[-0.75, 0, -0.5, 0.75, 0.95, 0.5]];
    case 'tree': return [[-0.28 * s, 0, -0.28 * s, 0.28 * s, 2.2 * s, 0.28 * s], [-1.35 * s, 2.2 * s, -1.35 * s, 1.35 * s, 4.7 * s, 1.35 * s]];
    case 'pine': return [[-0.25, 0, -0.25, 0.25, 0.9, 0.25], [-1.0 * s, 0.9, -1.0 * s, 1.0 * s, 2.6 * s, 1.0 * s], [-0.65 * s, 2.6 * s, -0.65 * s, 0.65 * s, 4.2 * s, 0.65 * s], [-0.3 * s, 4.2 * s, -0.3 * s, 0.3 * s, 5.6 * s, 0.3 * s]];
    case 'rock': return [[-0.8 * s, 0, -0.65 * s, 0.8 * s, 1.05 * s, 0.65 * s]];
    case 'log': return [[-1.5, 0, -0.35, 1.5, 0.62, 0.35]];
    case 'barrel': return [[-0.36, 0, -0.36, 0.36, 0.95, 0.36]];
    case 'cart': return [[-1.0, 0, -0.65, 1.0, 1.0, 0.65]];
    case 'lamp': return [[-0.1, 0, -0.1, 0.1, 2.9, 0.1]];
    default: return [];
  }
}
export const baseY = (o) => (o.y != null ? o.y : LAND);
for (const o of OBJECTS) {
  const y = baseY(o), m = o.side === 'B' ? -1 : 1;
  for (const [x0, y0, z0, x1, y1, z1] of localBoxes(o)) box(o.x + x0, y + y0, o.z + Math.min(m * z0, m * z1), o.x + x1, y + y1, o.z + Math.max(m * z0, m * z1));
}

// ---------------- granice: niewidzialne ściany (za nimi wyspa urywa się nad morzem chmur) ----------------
box(HX, 0, -HZ - 0.5, HX + 0.5, 9, HZ + 0.5); box(-HX - 0.5, 0, -HZ - 0.5, -HX, 9, HZ + 0.5);
box(-HX - 0.5, 0, HZ, HX + 0.5, 9, HZ + 0.5); box(-HX - 0.5, 0, -HZ - 0.5, HX + 0.5, 9, -HZ);

C.sort((a, b) => a[4] - b[4]);

export const MAP = {
  name: 'Kaskady',
  spawns: [{ name: 'Spawn_A', x: 0, y: LAND, z: -24.5, yaw: Math.PI }, { name: 'Spawn_B', x: 0, y: LAND, z: 24.5, yaw: 0 }],
  colliders: C,
  clips: [],
  ladders: [],
};

// wygląd (three.js) wczytuje się dopiero w przeglądarce – serwer meczów potrzebuje tylko danych powyżej
export async function build() {
  const { buildKaskady } = await import('./kaskady-scena.js');
  return buildKaskady();
}
