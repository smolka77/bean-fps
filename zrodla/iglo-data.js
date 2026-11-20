// Mapa IGLOO (1v1, nazwa w kodzie: „Iglo”): zimowy obóz nad zamarzniętym jeziorem. Na środku jeziora duże iglo z dwoma tunelami,
// na zachodzie ośnieżona grań z sosnami i zamarznięta łódź rybacka, na wschodzie czerwona chata polarna i budka do łowienia ryb na lodzie.
// Ten plik ma TYLKO dane rozgrywki (spawny, kolizje AABB, układ) – czyta go też serwer meczów (Node, bez three.js).
// Wygląd buduje zrodla/iglo-scena.js z tych samych liczb, więc kolizje i grafika zawsze się zgadzają.
// Mapa jest lustrzana: strona B to strona A odbita względem osi X (z → −z). Te same drogi po obu stronach:
//   zachód – grań (wysoko, sosny) → łódź w lodzie, środek – iglo (tunel, stos skrzyń w środku, strzelnice w bokach),
//   wschód – chata (okno na jezioro) → budka rybacka na lodzie.

export const HX = 16, HZ = 27;                 // pół szerokości (X) i pół długości (Z) pola gry
export const LAND = 0.5;                        // ubity śnieg na lądzie (z lodu wchodzi się jednym stopniem 0,5 m)
export const LAKE = 7;                          // zamarznięte jezioro: |z| < 7, lód na wysokości 0
export const RIDGE = { x0: -HX, x1: -10, z0: -20.5, z1: -9, top: 1.5 };                    // grań strony A (B = odbicie)
// iglo: kopuła (półelipsoida) z bloków śniegu; R promień zewnętrzny, T grubość ściany, K wysokość kopuły / promień
export const IGLOO = { R: 3.9, T: 0.6, K: 1.08, door: 0.75, wall: 0.5, mouth: 5.3, th: 2.1, course: 0.35, win: [1.05, 1.75], winHalf: 0.25, winFrom: 2.6 };   // strzelnice = 3. i 4. warstwa bloków (oko gracza 1,3 m)
export const CABIN = { x0: 7.6, x1: 14.4, z0: -16.4, z1: -11, floor: 0.8, t: 0.2, eave: 3.5, ridge: 5.0 };    // chata strony A
export const HUT = { x0: 9.4, x1: 11.8, z0: -1.5, z1: 1.5, h: 2.5 };                        // budka rybacka (na środku, lustrzana sama w sobie)
export const BOAT = { x0: -13.4, x1: -7.6, bow: -9.2, beam: 1.15, bowBeam: 0.7, deck: 0.95, cab: [-12.9, -11.1], cabH: 2.55, cabBeam: 0.8 };

const r3 = (v) => Math.round(v * 1000) / 1000;
const C = [];
const box = (x0, y0, z0, x1, y1, z1) => { C.push([r3(x0), r3(y0), r3(z0), r3(x1), r3(y1), r3(z1)]); };
// bryła strony A i jej odbicie na stronę B (z → −z)
const both = (x0, y0, z0, x1, y1, z1) => { box(x0, y0, z0, x1, y1, z1); box(x0, y0, -z1, x1, y1, -z0); };

// ---------------- teren: dwa brzegi ze śniegiem, między nimi lód ----------------
both(-HX, 0, -HZ, HX, LAND, -LAKE);

// ---------------- grań (zachód): płaskowyż 1,5 m ze stopniami ze śniegu z trzech stron ----------------
both(RIDGE.x0, 0, RIDGE.z0, RIDGE.x1, RIDGE.top, RIDGE.z1);
export const STEPS = [                                                                       // stopnie 1,0 m (strona A, B = odbicie)
  [RIDGE.x1, -16.4, -9.2, -13.2],        // od środka mapy
  [-15.6, -21.3, -11.6, RIDGE.z0],       // od spawnu
  [-15.4, RIDGE.z1, -11.4, -8.2],        // od jeziora
];
for (const [x0, z0, x1, z1] of STEPS) both(x0, 0, z0, x1, 1.0, z1);

// ---------------- iglo: kolizje z siatki 0,5 m (kolumna od wewnętrznej do zewnętrznej powierzchni kopuły) ----------------
const { R, T, K } = IGLOO, RI = R - T;
export const domeOut = (r) => (r >= R ? 0 : K * Math.sqrt(R * R - r * r));                  // wysokość zewnętrznej powierzchni nad lodem
export const domeIn = (r) => (r >= RI ? 0 : K * Math.sqrt(RI * RI - r * r));               // wysokość wewnętrznej (0 = w ścianie)
{
  const S = 0.5, cells = [], q = (v) => Math.round(v * 20) / 20;
  const cut = (iv, a, b) => iv.flatMap(([lo, hi]) => (b <= lo || a >= hi ? [[lo, hi]] : [lo < a ? [lo, a] : null, hi > b ? [b, hi] : null].filter(Boolean)));
  // sklepienie nad środkiem (|x|, |z| < 1,75 – wysoko nad głową) z 9 większych komórek: dół z najdalszego, góra z najbliższego punktu komórki
  const B = 1.75, h = B / 3;
  for (const cx of [-2 * h, 0, 2 * h]) for (const cz of [-2 * h, 0, 2 * h]) {
    const rn = Math.hypot(Math.max(0, Math.abs(cx) - h), Math.max(0, Math.abs(cz) - h)), rf = Math.hypot(Math.abs(cx) + h, Math.abs(cz) + h);
    cells.push({ x0: cx - h, x1: cx + h, z0: cz - h, z1: cz + h, lo: q(domeIn(rf)), hi: q(domeOut(rn)) });
  }
  for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) {
    const cx = i * S, cz = j * S, r = Math.hypot(cx, cz);
    if (Math.abs(cx) < B && Math.abs(cz) < B) continue;                                        // środek: większe komórki wyżej
    const top = q(domeOut(r)); if (top < 0.2) continue;
    let iv = [[q(domeIn(r)), top]];
    if (Math.abs(cx) < IGLOO.door && Math.abs(cz) > 2.2) iv = cut(iv, 0, IGLOO.th);              // wejścia (tunele od strony A i B)
    if (Math.abs(cz) < IGLOO.winHalf && Math.abs(cx) > IGLOO.winFrom) iv = cut(iv, IGLOO.win[0], IGLOO.win[1]);   // strzelnice na wschód i zachód
    for (const [lo, hi] of iv) if (hi - lo > 0.04) cells.push({ x0: cx - S / 2, x1: cx + S / 2, z0: cz - S / 2, z1: cz + S / 2, lo, hi });
  }
  // sklejanie sąsiednich komórek o tej samej wysokości: najpierw wzdłuż X, potem wzdłuż Z
  const merge = (list, along) => {
    const k = (c) => (along === 'x' ? [c.z0, c.lo, c.hi] : [c.x0, c.x1, c.lo, c.hi]).join('|'), groups = new Map();
    for (const c of list) { const g = groups.get(k(c)) || []; g.push(c); groups.set(k(c), g); }
    const out = [];
    for (const g of groups.values()) {
      g.sort((a, b) => (along === 'x' ? a.x0 - b.x0 : a.z0 - b.z0));
      let cur = null;
      for (const c of g) {
        if (cur && (along === 'x' ? Math.abs(cur.x1 - c.x0) < 1e-6 : Math.abs(cur.z1 - c.z0) < 1e-6)) { if (along === 'x') cur.x1 = c.x1; else cur.z1 = c.z1; }
        else { cur = { ...c }; out.push(cur); }
      }
    }
    return out;
  };
  for (const c of merge(merge(cells, 'x'), 'z')) box(c.x0, c.lo, c.z0, c.x1, c.hi, c.z1);
  // tunele wejściowe: ściany z bloków i strop (strona A, B = odbicie); strop wchodzi pod kopułę, aż jej sklepienie będzie wyżej
  const { door: D, wall: W, mouth: M, th: TH } = IGLOO;
  for (const s of [1, -1]) both(s > 0 ? D : -D - W, 0, -M, s > 0 ? D + W : -D, TH, -3.2);
  both(-D - W, TH, -M, D + W, TH + 0.45, -2.75);
  // w środku: stos skrzyń i worków (zasłania przelot tunel–tunel, wokół da się obchodzić)
  box(-0.5, 0, -0.5, 0.5, 1.9, 0.5);
}

// ---------------- chata polarna (wschód): ściany z otworami na drzwi i okna, dach dwuspadowy ----------------
export const CABIN_WALLS = [];                                                               // bryły ścian strony A (grafika układa z nich deski)
{
  const { x0, x1, z0, z1, floor: F, t, eave: E } = CABIN, sill = F + 1.0, top = F + 1.9, door = F + 2.15;
  const w = (a, b, c, d, e, f) => { both(a, b, c, d, e, f); CABIN_WALLS.push([a, b, c, d, e, f]); };
  both(6.2, 0, z0 - 0.4, x1 + 0.2, F, z1 + 0.4);                                             // podłoga z gankiem od zachodu (0,3 m nad śniegiem)
  // ściana zachodnia (do środka mapy): drzwi i okno
  w(x0, F, z0, x0 + t, E, -14.3);
  w(x0, door, -14.3, x0 + t, E, -13.0);                                                      // nadproże drzwi
  w(x0, F, -13.0, x0 + t, E, -12.5);
  w(x0, F, -12.5, x0 + t, sill, -11.6); w(x0, top, -12.5, x0 + t, E, -11.6);                // okno
  w(x0, F, -11.6, x0 + t, E, z1);
  // ściana północna (do jeziora): szerokie okno
  w(x0 + t, F, z1 - t, 9.2, E, z1);
  w(9.2, F, z1 - t, 12.8, sill, z1); w(9.2, top, z1 - t, 12.8, E, z1);
  w(12.8, F, z1 - t, x1 - t, E, z1);
  // ściana wschodnia (pełna) i południowa (tylne drzwi od strony spawnu)
  w(x1 - t, F, z0, x1, E, z1);
  w(x0 + t, F, z0, 10.4, E, z0 + t);
  w(10.4, door, z0, 11.7, E, z0 + t);
  w(11.7, F, z0, x1 - t, E, z0 + t);
  // dach dwuspadowy (kalenica wzdłuż X): okap 3,5 m, kalenica 5,0 m
  both(x0 - 0.3, E, z0 - 0.35, x1 + 0.3, E + 0.5, z1 + 0.35);
  both(x0 - 0.3, E + 0.5, z0 + 0.7, x1 + 0.3, E + 1.0, z1 - 0.7);
  both(x0 - 0.3, E + 1.0, z0 + 1.75, x1 + 0.3, CABIN.ridge, z1 - 1.75);
  // w środku: stół, piec, regał pod ścianą wschodnią, skrzynie w rogu pod oknem na jezioro
  both(11.4, 0, -14.9, 13.4, F + 0.85, -13.9);
  both(13.5, 0, z0 + t, x1 - t, F + 1.3, -15.4);
  both(13.85, 0, -14.6, x1 - t, F + 2.0, -12.2);
  both(13.0, 0, z1 - t - 0.7, x1 - t, F + 0.9, z1 - t);
  // zaspa za chatą (do granicy mapy – nie ma tam przejścia)
  both(x1, 0, z0 - 0.4, HX, 2.4, z1 + 0.4);
}

// ---------------- jezioro: budka rybacka (wschód), łódź w lodzie (zachód), bloki lodu ----------------
box(HUT.x0, 0, HUT.z0, HUT.x1, HUT.h, HUT.z1);
box(HUT.x0 - 0.2, HUT.h, HUT.z0 - 0.2, HUT.x1 + 0.2, HUT.h + 0.4, HUT.z1 + 0.2);
{
  const { x0, x1, bow, beam, bowBeam, deck, cab, cabH, cabBeam } = BOAT;
  box(x0, 0, -beam, bow, deck, beam);                                                       // kadłub (pokład 0,95 m – da się na niego wskoczyć z lodu)
  box(bow, 0, -bowBeam, x1, deck, bowBeam);                                                  // dziób w stronę iglo
  box(cab[0], deck, -cabBeam, cab[1], cabH, cabBeam);                                        // sterówka
}
export const ICE_BLOCKS = [[6.3, -3.45]];                                                    // stos bloków lodu przy iglo (strona A, B = odbicie)
for (const [x, z] of ICE_BLOCKS) { both(x - 0.9, 0, z - 0.45, x + 0.9, 0.9, z + 0.45); both(x - 0.45, 0.9, z - 0.42, x + 0.45, 1.8, z + 0.42); }

// ---------------- obiekty na lądzie strony A (strona B = odbicie) ----------------
// t: typ, x/z: środek, y: podstawa (domyślnie śnieg); kolizje liczy localBoxes() niżej
const SIDE_A = [
  { t: 'woodpile', x: 0, z: -20.1, w: 5.2 },                       // stos drewna przed spawnem (zasłania długą linię przez iglo)
  { t: 'fort', x: -3.1, z: -9.3, w: 3.8 },                         // murek z bloków śniegu nad brzegiem (z blankami)
  { t: 'fort', x: 3.1, z: -9.3, w: 3.8 },
  { t: 'snowman', x: -5.9, z: -14.2 },
  { t: 'sled', x: 3.9, z: -15.6 },                                 // sanki ze skrzyniami
  { t: 'pine', x: -13.6, z: -17.6, y: RIDGE.top, s: 1.05 },        // sosny na grani
  { t: 'pine', x: -12.3, z: -12.0, y: RIDGE.top, s: 0.95 },
  { t: 'rock', x: -15.0, z: -14.4, y: RIDGE.top },
  { t: 'pine', x: 6.0, z: -22.6, s: 1.1 },                         // sosna przy spawnie (wschód)
  { t: 'rock', x: -6.8, z: -22.4 },
  { t: 'lamp', x: -1.6, z: -8.6 },                                 // latarnia przy przejściu w murku
];
export const OBJECTS = [...SIDE_A.map((o) => ({ ...o, side: 'A' })), ...SIDE_A.map((o) => ({ ...o, z: -o.z, side: 'B' }))];

// kolizje obiektu względem jego środka i podstawy: [x0, y0, z0, x1, y1, z1]
export function localBoxes(o) {
  switch (o.t) {
    case 'woodpile': return [[-o.w / 2, 0, -0.5, o.w / 2, 1.5, 0.5]];
    case 'fort': {                                                      // murek 0,8 m + blanki do 1,25 m co 0,95 m
      const L = [[-o.w / 2, 0, -0.3, o.w / 2, 0.8, 0.3]], n = Math.round(o.w / 0.95);
      for (let i = 0; i < n; i += 2) { const a = -o.w / 2 + i * (o.w / n); L.push([a, 0.8, -0.3, a + o.w / n, 1.25, 0.3]); }
      return L;
    }
    case 'snowman': return [[-0.62, 0, -0.62, 0.62, 1.15, 0.62], [-0.45, 1.15, -0.45, 0.45, 1.85, 0.45], [-0.3, 1.85, -0.3, 0.3, 2.45, 0.3]];
    case 'sled': return [[-1.05, 0, -0.5, 1.05, 0.95, 0.5], [-0.95, 0.95, -0.42, 0.05, 1.45, 0.42]];
    case 'pine': { const s = o.s || 1; return [[-0.25, 0, -0.25, 0.25, 0.9, 0.25], [-1.0 * s, 0.9, -1.0 * s, 1.0 * s, 2.6 * s, 1.0 * s], [-0.65 * s, 2.6 * s, -0.65 * s, 0.65 * s, 4.2 * s, 0.65 * s], [-0.3 * s, 4.2 * s, -0.3 * s, 0.3 * s, 5.6 * s, 0.3 * s]]; }
    case 'rock': return [[-0.75, 0, -0.6, 0.75, 1.0, 0.6]];
    case 'lamp': return [[-0.12, 0, -0.12, 0.12, 3.2, 0.12]];
    default: return [];
  }
}
export const baseY = (o) => (o.y != null ? o.y : LAND);
for (const o of OBJECTS) {                                                                   // strona B: lokalne Z też odbite
  const y = baseY(o), m = o.side === 'B' ? -1 : 1;
  for (const [x0, y0, z0, x1, y1, z1] of localBoxes(o)) box(o.x + x0, y + y0, o.z + Math.min(m * z0, m * z1), o.x + x1, y + y1, o.z + Math.max(m * z0, m * z1));
}

// ---------------- granice: niewidzialne ściany (na lądzie płot przeciwśnieżny, na lodzie tyczki z flagami) ----------------
box(HX, 0, -HZ - 0.5, HX + 0.5, 6, HZ + 0.5); box(-HX - 0.5, 0, -HZ - 0.5, -HX, 6, HZ + 0.5);
box(-HX - 0.5, 0, HZ, HX + 0.5, 6, HZ + 0.5); box(-HX - 0.5, 0, -HZ - 0.5, HX + 0.5, 6, -HZ);

// kolizje posortowane od najniższej do najwyższej (tak jak w pozostałych mapach)
C.sort((a, b) => a[4] - b[4]);

// clipy: niewidzialne blokady ruchu (nie zatrzymują kul) – nad kopułą iglo, żeby nie dało się wejść po jej schodkowych kolizjach na dach;
// zaczynają się nad zasięgiem głowy w środku (2,9 m > 1,75 m + skok), więc wewnątrz iglo niczego nie zmieniają
const CLIPS = [[-IGLOO.R - 0.05, 2.9, -IGLOO.R - 0.05, IGLOO.R + 0.05, 8, IGLOO.R + 0.05]];

export const MAP = {
  name: 'Iglo',
  spawns: [{ name: 'Spawn_A', x: 0, y: LAND, z: -24, yaw: Math.PI }, { name: 'Spawn_B', x: 0, y: LAND, z: 24, yaw: 0 }],
  colliders: C,
  clips: CLIPS,
  ladders: [],
};

// wygląd (three.js) wczytuje się dopiero w przeglądarce – serwer meczów potrzebuje tylko danych powyżej
export async function build() {
  const { buildIgloo } = await import('./iglo-scena.js');
  return buildIgloo();
}
