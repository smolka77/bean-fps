// Mapa 1v1 „Jachty” (w kodzie i na serwerze dalej pod nazwą "Magazyn", żeby nie zmieniać serwera meczów; nazwa w grze: lobby-ui.js).
// Dwa identyczne superjachty (~46 m) na otwartym morzu, dziobami w stronę +Z, lustrzanie po obu stronach osi X = 0.
// Na każdym: pokład rufowy z kanapą, stołem i barkiem; salon, do którego się wchodzi (drzwi z rufy i z obu boków, okna do strzelania),
// schody na flybridge (burty do kucania, ster, kanapa, hardtop z pałąkiem radarowym), dziób z jacuzzi, materacem i łodzią na kołysce.
// Dzioby łączy trap, rufy – mahoniowa motorówka. Złote akcenty: pasy na kadłubie, listwy, kopuły, nazwa na pawęży.
// Do wody nie da się wpaść: wzdłuż relingów stoją niewidzialne ściany (zewnętrzne burty = kolizje, od strony drugiego jachtu = blokady
// ruchu `clips`, żeby kule przelatywały nad wodą). Każdy gracz zaczyna na swoim jachcie, na zewnętrznym przejściu za filarem salonu.
// Kolizje i model powstają z tego samego opisu niżej, więc serwer (czyta tylko MAP) i grafika zawsze się zgadzają.
// Plik nie importuje three.js (serwer go wczytuje w Node) – model buduje build(THREE) z klockami z wnetrza.js; morze, niebo i wyspy są w klimaty.js.
import { warsztat } from './wnetrza.js';   // meble, materiały z fakturą, światło wnętrz (bez three.js – bezpieczne dla serwera)

const CX = 13;                  // środek jachtu A w X = -13, jachtu B w X = +13
const HALF = 5.6;               // pół szerokości pokładu
const STERN = -22, BOW = 24;    // rufa (pawęż) i czubek dziobu
const TAPER = 8;                // od tego Z pokład zwęża się w dziób
const WL = -2.1;                // poziom wody (pokład ~2 m nad wodą)
const SAL = { x: 3.6, z0: -9, z1: 8, h: 2.8, roof: 3.05, t: 0.25, sill: 1.05, lintel: 2.25 };   // salon: ściany, dach = podłoga flybridge
const STEPS = 9, RISE = SAL.roof / STEPS, RUN = 0.45, STAIR = [-3.3, -1.9];                   // schody przy burcie zewnętrznej
const GATE_BOAT = [-19.5, -15.5];                // furta w relingu do motorówki (burta wewnętrzna)
const GATE_BRIDGE = [12, 14.5];                  // furta do trapu na dziobie
const WALL = 9;                                  // wysokość niewidzialnych ścian (nie da się ich przeskoczyć nawet z flybridge)
export const YACHT = { CX, HALF, STERN, BOW, TAPER, WL, GATE_BOAT, GATE_BRIDGE };

export const halfAt = (z) => (z <= TAPER ? HALF : HALF * Math.sqrt(Math.max(0, 1 - ((z - TAPER) / (BOW - TAPER)) ** 2)));
// lokalne X jachtu (dodatnie = burta wewnętrzna, w stronę drugiego jachtu) -> świat
const gx = (side, xl) => (side < 0 ? -CX + xl : CX - xl);
const boxL = (side, x0, y0, z0, x1, y1, z1) => { const a = gx(side, x0), b = gx(side, x1); return [Math.min(a, b), y0, z0, Math.max(a, b), y1, z1]; };
const r2 = (b) => b.map((v) => Math.round(v * 1000) / 1000);

// ---------- salon: ściany z otworami (w = okno nad parapetem, d = drzwi, s = pełna ściana/filar) ----------
const SIDE_SEG = [[SAL.z0, -8, 's'], [-8, -3, 'w'], [-3, -1, 's'], [-1, 3.5, 'w'], [3.5, 5, 'd'], [5, 7, 'w'], [7, SAL.z1, 's']];
const AFT_SEG = [[-SAL.x, -1.0, 'w'], [-1.0, 1.4, 'd'], [1.4, SAL.x, 'w']];
const FRONT_SEG = [[-SAL.x, -2.6, 's'], [-2.6, 2.6, 'w'], [2.6, SAL.x, 's']];
function salonWalls() {
  const out = [], { x, z0, z1, t, sill, lintel, h } = SAL;
  const seg = (a0, a1, kind, mk) => {
    if (kind === 's') out.push(mk(a0, a1, 0, h));
    else if (kind === 'w') { out.push(mk(a0, a1, 0, sill)); out.push(mk(a0, a1, lintel, h)); }
    else out.push(mk(a0, a1, lintel, h));
  };
  for (const sx of [-1, 1]) for (const [a, b, k] of SIDE_SEG) seg(a, b, k, (c0, c1, y0, y1) => (sx < 0 ? ['wall', -x, y0, c0, -x + t, y1, c1] : ['wall', x - t, y0, c0, x, y1, c1]));
  for (const [a, b, k] of AFT_SEG) seg(a, b, k, (c0, c1, y0, y1) => ['wall', c0, y0, z0, c1, y1, z0 + t]);
  for (const [a, b, k] of FRONT_SEG) seg(a, b, k, (c0, c1, y0, y1) => ['wall', c0, y0, z1 - t, c1, y1, z1]);
  out.push(['roof', -x, h, z0, x, SAL.roof, z1]);
  return out;
}

// ---------- elementy, które są też osłoną (wspólne dla kolizji i modelu), układ lokalny jachtu ----------
const R = SAL.roof;
const COVER = [
  ...salonWalls(),
  // rufa
  ['sofaAft', -5.0, 0, -19, -4.4, 0.95, -14],
  ['table', -1.0, 0, -17, 1.2, 0.8, -15],
  ['barAft', 3.4, 0, -17.5, 4.0, 1.45, -13.5],
  ['bench', -1.6, 0, -20.6, 1.6, 1.1, -20.0],
  // salon w środku
  ['barIn', 1.6, 0, -6.5, 3.0, 1.1, -2.5],
  ['sofaIn', -3.3, 0, -6, -2.6, 0.9, 0],
  // dziób
  ['jacuzzi', -1.6, 0, 10, 1.6, 0.75, 13],
  ['sunpad', -2.4, 0, 14.5, 2.4, 0.5, 17.5],
  ['tender', -1.1, 0, 18.5, 1.1, 1.4, 22],
  // flybridge (stoją na dachu salonu)
  ['flyAft', STAIR[1], R, SAL.z0, SAL.x, R + 0.9, SAL.z0 + 0.3],
  ['flyOut', -SAL.x, R, -7.6, -SAL.x + 0.3, R + 0.9, 3],
  ['flyIn', SAL.x - 0.3, R, SAL.z0, SAL.x, R + 0.9, 3],
  ['helm', -2.0, R, 1.4, 2.0, R + 1.2, 2.2],
  ['screen', -SAL.x, R, 2.7, SAL.x, R + 1.0, 3.0],
  ['lounge', -1.0, R, -7.2, 2.8, R + 0.9, -6.2],
  ['hardtop', -3.75, R + 2.35, -6.0, 3.75, R + 2.6, 2.6],
];
const STAIRS = Array.from({ length: STEPS }, (_, i) => ['step', STAIR[0], 0, SAL.z0 - (STEPS - i) * RUN, STAIR[1], (i + 1) * RISE, SAL.z0 - (STEPS - i - 1) * RUN]);

// motorówka między rufami i trap między dziobami (współrzędne świata)
const BOAT = { z0: GATE_BOAT[0], z1: GATE_BOAT[1], x: CX - HALF + 0.2 };
const BOAT_COVER = [
  [-BOAT.x, 0, BOAT.z0, BOAT.x, 0.75, BOAT.z0 + 0.2],       // burty motorówki
  [-BOAT.x, 0, BOAT.z1 - 0.2, BOAT.x, 0.75, BOAT.z1],
  [-0.7, 0, -17.8, 0.7, 1.3, -17.2],                        // konsola z szybą (po obu stronach ~1,5 m przejścia)
];

function layout() {
  const colliders = [], clips = [];
  for (const side of [-1, 1]) {
    for (const [, ...b] of [...COVER, ...STAIRS]) colliders.push(r2(boxL(side, ...b)));
    // burta zewnętrzna, pawęż i czubek dziobu: wysokie kolizje (za nimi nic nie ma, więc mogą zatrzymywać kule)
    colliders.push(r2(boxL(side, -HALF - 0.6, 0, STERN, -HALF + 0.3, WALL, TAPER)));
    colliders.push(r2(boxL(side, -HALF - 0.6, 0, STERN - 0.6, HALF + 0.6, WALL, STERN + 0.3)));
    colliders.push(r2(boxL(side, -1.6, 0, BOW - 1.5, 1.6, WALL, BOW + 0.6)));
    for (let z = TAPER; z < BOW - 1.5; z += 0.5) {          // zwężenie dziobu schodkami co 0,5 m
      const h = halfAt(z + 0.5);
      colliders.push(r2(boxL(side, -HALF - 0.6, 0, z, -h + 0.3, WALL, z + 0.5)));
      const inGate = z + 0.5 > GATE_BRIDGE[0] && z < GATE_BRIDGE[1];
      if (!inGate) clips.push(r2(boxL(side, h - 0.3, 0, z, HALF + 0.6, WALL, z + 0.5)));
    }
    // burta wewnętrzna: blokada ruchu z furtą do motorówki
    clips.push(r2(boxL(side, HALF - 0.3, 0, STERN, HALF + 0.6, WALL, GATE_BOAT[0])));
    clips.push(r2(boxL(side, HALF - 0.3, 0, GATE_BOAT[1], HALF + 0.6, WALL, TAPER)));
  }
  for (const b of BOAT_COVER) colliders.push(r2(b));
  const reach = CX - HALF + 0.8;                             // boczne blokady wchodzą na pokład jachtów, żeby nie było szpar
  clips.push([-reach, 0, BOAT.z0 - 0.3, reach, WALL, BOAT.z0], [-reach, 0, BOAT.z1, reach, WALL, BOAT.z1 + 0.3]);
  clips.push([-reach, 0, GATE_BRIDGE[0] - 0.3, reach, WALL, GATE_BRIDGE[0]], [-reach, 0, GATE_BRIDGE[1], reach, WALL, GATE_BRIDGE[1] + 0.3]);
  return { colliders, clips: clips.map(r2) };
}

const L = layout();
export const MAP = {
  name: 'Magazyn',
  spawns: [
    { name: 'Spawn_A', x: gx(-1, -4.6), z: -2, yaw: 0 },     // jacht A, zewnętrzne przejście za filarem salonu, twarzą do rufy
    { name: 'Spawn_B', x: gx(1, -4.6), z: -2, yaw: 0 },
  ],
  colliders: L.colliders,
  clips: L.clips,
  ladders: [],
  view: { pos: [0, 44, -52], look: [0, 0, 1], fov: 44 },    // miniatura mapy: z góry od strony ruf
};

// =====================================================================================================
//                                   MODEL (tylko w przeglądarce)
// =====================================================================================================
// Jeden jacht powstaje w układzie lokalnym (X dodatnie = burta wewnętrzna) i jest kopiowany na obie pozycje (drugi lustrzanie).
// Materiały z fakturą i ciepłe światło salonu: wnetrza.js. Kule zatrzymują: pokład i podłogi, ściany/dach salonu, nadbudówki
// flybridge oraz niewidzialne pudełka mebli (dokładnie bryły kolizji z serwera); same meble, poduszki i ozdoby kule przelatują.
export function build(THREE) {
  const root = new THREE.Group(); root.name = 'Jachty';
  const W = warsztat(THREE);                  // świat: siatki końcowe, materiały, lampy
  const Y = warsztat(THREE);                  // jeden jacht w układzie lokalnym
  const { M4 } = W, I = new THREE.Matrix4();
  const sideM = (s) => new THREE.Matrix4().makeTranslation(s < 0 ? -CX : CX, 0, 0).multiply(new THREE.Matrix4().makeScale(s < 0 ? 1 : -1, 1, 1));

  // paleta
  const WHITE = '#f5f6f8', WHITE2 = '#e3e7ec', NAVY = '#14203a', NAVY2 = '#1c2c4c', TEAK = '#b47c4b', TEAK2 = '#a46e40', CAULK = '#2e2218',
    CHROME = '#dfe5ec', CREAM = '#f2eadb', CREAM2 = '#e6dcc8', SAND = '#d8c7a8', WALNUT = '#6a4430', WALNUT2 = '#5a3826', OAK = '#caa77c', OAK2 = '#bf9a6e',
    MAHO = '#7a3a1e', MAHO2 = '#6a3018', GOLD = '#f2c552', GOLDL = '#ffdf86', SCREEN = '#39d9ff', ANTIFOUL = '#3a1e22', GLASS = '#9fc3e0',
    MARBLE = '#f1eee9', MARBLE_D = '#24262c', LEATHER = '#efe4d0', TAUPE = '#8a7a6a', BLACK = '#121418';

  // ---------------- światło salonów: lampy (ciepłe) i pudełka wnętrz (poza nimi lampy nie świecą) ----------------
  for (const s of [-1, 1]) {
    const a = gx(s, -SAL.x + SAL.t), b = gx(s, SAL.x - SAL.t);
    W.room([Math.min(a, b), -0.2, SAL.z0 + SAL.t, Math.max(a, b), SAL.h + 0.01, SAL.z1 - SAL.t]);
    for (const [x, z] of [[0.6, -5.4], [-0.4, -0.4], [0, 4.6]]) W.lamp(gx(s, x), 2.35, z, 5.2, '#ffcc8e', 0.72);
  }

  // ---------------- powierzchnie (jeden materiał z parametrami w wierzchołkach – wnetrza.js) ----------------
  const PR = {
    tek: { tex: 'teak', k: 0.38, rough: 0.72, lamps: false }, podl: { tex: 'wood', k: 0.42, rough: 0.5 }, lak: { rough: 0.24, metal: 0.05 },
    kadlub: { rough: 0.16, metal: 0.12, lamps: false }, drewno: { tex: 'wood', k: 0.5, rough: 0.32, metal: 0.02 }, mah: { tex: 'wood', k: 0.45, rough: 0.2, metal: 0.05, lamps: false },
    skora: { tex: 'leather', k: 0.22, rough: 0.52 }, tkanina: { tex: 'fabric', k: 0.32, rough: 0.92 }, dywan: { tex: 'carpet', k: 0.4, rough: 1 },
    marmur: { tex: 'marble', k: 0.55, rough: 0.12, metal: 0.05 }, chrom: { tex: 'metal', k: 0.08, rough: 0.16, metal: 0.95 },
    zloto: { tex: 'metal', k: 0.1, rough: 0.3, metal: 0.6, emis: 0.3 },   // ciepłe złoto ze słabą poświatą (pełny metal odbijał niebieskie niebo)
    szklo_b: { rough: 0.08, metal: 0.3 }, lisc: { rough: 0.65 },
  };
  for (const [k, p] of Object.entries(PR)) W.preset(k, p);
  for (const k of ['tek', 'podl', 'lak', 'mah']) W.preset('h_' + k, PR[k]);           // to samo, ale w siatce zatrzymującej kule
  W.preset('h_spod', { rough: 0.9 });                                                   // spoiny i podkład pod deskami
  const MT = {
    uber: W.uber(),
    szklo: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.7, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false }),
    woda: new THREE.MeshStandardMaterial({ color: '#7ff4ec', emissive: '#1fb8c4', emissiveIntensity: 0.55, roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.86, side: THREE.DoubleSide }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    hitbox: new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
  };

  // =====================================================================================================
  //                                       JEDEN JACHT (układ lokalny)
  // =====================================================================================================
  {
    const { box, rbox, rboxM, cyl, tube, pipe, tris, quad, add, T } = Y;
    const P = (xl, y, z) => [xl, y, z];
    const part = (name) => COVER.find((c) => c[0] === name).slice(1);
    const hitbox = (b) => box('hitbox', '#ffffff', ...b);          // niewidzialna bryła = kolizja z serwera (trafienia w przeglądarce)
    const zs = []; for (let z = STERN; z <= BOW + 1e-6; z += 0.5) zs.push(+z.toFixed(2));

    // ---------------- kadłub ----------------
    // poziomy: [y, skala szerokości, cofnięcie przy dziobie (pochylona dziobnica), kolor pasa poniżej]
    const LV = [[0.05, 1.0, 0], [-0.7, 1.01, 0.2, WHITE], [-1.5, 0.985, 0.6, WHITE], [-1.85, 0.965, 0.9, WHITE], [-2.0, 0.955, 1.0, GOLD], [-2.6, 0.86, 1.8, NAVY], [-3.4, 0.35, 4.5, ANTIFOUL]];
    for (const sx of [-1, 1]) for (let i = 0; i < zs.length - 1; i++) for (let l = 0; l < LV.length - 1; l++) {
      const [ya, ka, ra] = LV[l], [yb, kb, rb, col] = LV[l + 1];
      const za = Math.min(zs[i], BOW - ra), zb = Math.min(zs[i + 1], BOW - ra), zA = Math.min(zs[i], BOW - rb), zB = Math.min(zs[i + 1], BOW - rb);
      quad(col === GOLD ? 'zloto' : 'kadlub', col, P(sx * halfAt(za) * ka, ya, za), P(sx * halfAt(zb) * ka, ya, zb), P(sx * halfAt(zB) * kb, yb, zB), P(sx * halfAt(zA) * kb, yb, zA));
    }
    for (let l = 0; l < LV.length - 1; l++) {                // pawęż
      const [ya, ka] = LV[l], [yb, kb, , col] = LV[l + 1];
      quad(col === GOLD ? 'zloto' : 'kadlub', col === WHITE ? WHITE2 : col, P(-HALF * ka, ya, STERN), P(-HALF * kb, yb, STERN), P(HALF * kb, yb, STERN), P(HALF * ka, ya, STERN));
    }
    // złota listwa wzdłuż burty i ciemne pasy okien kabin gości w kadłubie, ze złotą ramką i podziałem na okna
    for (const sx of [-1, 1]) for (let i = 0; i < zs.length - 1; i++) {
      const za = zs[i], zb = zs[i + 1], a = halfAt(za) * 1.006 + 0.012, b = halfAt(zb) * 1.006 + 0.012;
      quad('zloto', GOLD, P(sx * a, -0.36, za), P(sx * b, -0.36, zb), P(sx * b, -0.24, zb), P(sx * a, -0.24, za));
    }
    for (const [z0, z1] of [[-17, -12], [-8.5, -2.5], [-1, 5]]) for (const sx of [-1, 1]) {
      const o = HALF * 1.01 + 0.02;
      box('szklo_b', '#0d1626', sx * o - 0.03, -1.2, z0, sx * o + 0.03, -0.72, z1);
      box('zloto', GOLD, sx * o - 0.035, -1.25, z0 - 0.05, sx * o + 0.035, -1.2, z1 + 0.05); box('zloto', GOLD, sx * o - 0.035, -0.72, z0 - 0.05, sx * o + 0.035, -0.67, z1 + 0.05);
      for (let z = z0 + 1.25; z < z1 - 0.2; z += 1.25) box('kadlub', WHITE, sx * o - 0.036, -1.2, z - 0.04, sx * o + 0.036, -0.72, z + 0.04);
    }
    for (const z of [8.5, 10, 11.5]) for (const sx of [-1, 1]) {   // bulaje na dziobie
      const h = halfAt(z) * 1.0 + 0.01;
      cyl('szklo_b', '#0d1626', 0.17, 0.17, 0.06, sx * h, -0.95, z, 14, 0, 0, Math.PI / 2); add('zloto', new THREE.TorusGeometry(0.19, 0.025, 6, 18), GOLD, M4(sx * (h + 0.01), -0.95, z, Math.PI / 2));
    }
    // platforma kąpielowa z teku za pawężą (za blokadą – tylko widok), drabinka kąpielowa, dysze wody
    box('tek', TEAK, -HALF + 0.3, -1.25, STERN - 1.6, HALF - 0.3, -1.05, STERN);
    box('zloto', GOLD, -HALF + 0.3, -1.08, STERN - 1.62, HALF - 0.3, -1.03, STERN - 1.55);
    for (const x of [-2.2, -1.8]) pipe('chrom', CHROME, [[x, -1.05, STERN - 1.45], [x, -0.7, STERN - 1.45], [x, -0.7, STERN - 1.75], [x, -1.9, STERN - 1.75]], 0.025);
    for (let y = -1.3; y > -1.95; y -= 0.22) tube('chrom', CHROME, [-2.2, y, STERN - 1.75], [-1.8, y, STERN - 1.75], 0.02);
    for (const x of [-HALF + 0.6, HALF - 0.6]) { tube('chrom', CHROME, [x, -1.05, STERN - 1.5], [x, -0.05, STERN - 0.05], 0.03); }

    // ---------------- pokład z teku z ciemnymi spoinami i listwą obrzeża (kule zatrzymuje pokład) ----------------
    const deckStrips = (x0, x1, z0, z1, y) => {
      const n = Math.max(1, Math.round((x1 - x0) / 0.24));
      for (let k = 0; k < n; k++) {
        const a = x0 + (k / n) * (x1 - x0), b = x0 + ((k + 1) / n) * (x1 - x0), pts = [];
        const zl = [z0, ...zs.filter((z) => z > Math.max(z0, TAPER) && z < z1), z1];   // do TAPER pokład ma stałą szerokość: jeden czworokąt
        for (let i = 0; i < zl.length - 1; i++) {
          const za = zl[i], zb = zl[i + 1]; if (zb <= za) continue;
          const ha = halfAt(za) - 0.2, hb = halfAt(zb) - 0.2, cl = (v, h) => Math.max(-h, Math.min(h, v));
          const a0 = cl(a + 0.008, ha), a1 = cl(b - 0.008, ha), b0 = cl(a + 0.008, hb), b1 = cl(b - 0.008, hb);
          if (a1 - a0 < 1e-3 && b1 - b0 < 1e-3) continue;
          pts.push(P(a0, y, za), P(b0, y, zb), P(b1, y, zb), P(a0, y, za), P(b1, y, zb), P(a1, y, za));
        }
        if (pts.length) tris('h_tek', [TEAK, TEAK2, '#ab7546'][k % 3], pts);
      }
    };
    for (let i = 0; i < zs.length - 1; i++) {                // ciemne podłoże pod listwami = spoiny
      const za = zs[i], zb = zs[i + 1], ha = halfAt(za), hb = halfAt(zb);
      quad('h_spod', CAULK, P(-ha, -0.006, za), P(-hb, -0.006, zb), P(hb, -0.006, zb), P(ha, -0.006, za));
      for (const sx of [-1, 1]) {                              // listwa obrzeża (szersza deska wzdłuż nadburcia)
        const a0 = halfAt(za) - 0.2, b0 = halfAt(zb) - 0.2, a1 = halfAt(za) - 0.02, b1 = halfAt(zb) - 0.02;
        quad('h_tek', '#9a6438', P(sx * a0, 0.021, za), P(sx * b0, 0.021, zb), P(sx * b1, 0.021, zb), P(sx * a1, 0.021, za));
      }
    }
    deckStrips(-HALF, HALF, STERN, SAL.z0, 0.02);
    deckStrips(-HALF, -SAL.x, SAL.z0, SAL.z1, 0.02); deckStrips(SAL.x, HALF, SAL.z0, SAL.z1, 0.02);
    deckStrips(-HALF, HALF, SAL.z1, BOW, 0.02);
    // nadburcie: biała ścianka ze złotym wierzchem, na dziobie coraz wyższe
    const bulH = (z) => 0.32 + 0.85 * Math.pow(Math.max(0, (z - TAPER) / (BOW - TAPER)), 1.4);
    for (const sx of [-1, 1]) for (let i = 0; i < zs.length - 1; i++) {
      const za = zs[i], zb = zs[i + 1], a = halfAt(za), b = halfAt(zb);
      quad('lak', WHITE, P(sx * a, 0.0, za), P(sx * b, 0.0, zb), P(sx * b, bulH(zb), zb), P(sx * a, bulH(za), za));
      quad('lak', WHITE2, P(sx * (a - 0.14), 0.0, za), P(sx * (b - 0.14), 0.0, zb), P(sx * (b - 0.14), bulH(zb), zb), P(sx * (a - 0.14), bulH(za), za));
      quad('tek', TEAK2, P(sx * (a + 0.01), bulH(za), za), P(sx * (b + 0.01), bulH(zb), zb), P(sx * (b - 0.15), bulH(zb), zb), P(sx * (a - 0.15), bulH(za), za));
      quad('zloto', GOLD, P(sx * (a + 0.012), bulH(za) - 0.05, za), P(sx * (b + 0.012), bulH(zb) - 0.05, zb), P(sx * (b + 0.012), bulH(zb) - 0.01, zb), P(sx * (a + 0.012), bulH(za) - 0.01, za));
    }

    // =========================================== SALON ===========================================
    for (const [, ...b] of COVER.filter((c) => c[0] === 'wall')) {
      box('h_lak', WHITE, ...b);
      if (b[4] === SAL.sill) box('zloto', GOLD, b[0] - 0.02, b[4], b[2] - 0.02, b[3] + 0.02, b[4] + 0.035, b[5] + 0.02);   // złoty parapet
    }
    // szyby (przyciemniane, przepuszczają kule – tak jak na serwerze, bo tam okno to otwór) i ramy okien
    const winSides = [];
    for (const sx of [-1, 1]) for (const [a, b, k] of SIDE_SEG) if (k !== 's') { const xw = sx * (SAL.x - SAL.t / 2); box('szklo', GLASS, xw - 0.02, k === 'w' ? SAL.sill : 0.03, a, xw + 0.02, SAL.lintel, b); winSides.push(['x', sx, a, b, k]); }
    for (const [a, b, k] of AFT_SEG) { box('szklo', GLASS, a, k === 'w' ? SAL.sill : 0.03, SAL.z0 + 0.1, b, SAL.lintel, SAL.z0 + 0.14); winSides.push(['z', -1, a, b, k]); }
    for (const [a, b, k] of FRONT_SEG) if (k === 'w') { box('szklo', GLASS, a, SAL.sill, SAL.z1 - 0.14, b, SAL.lintel, SAL.z1 - 0.1); winSides.push(['z', 1, a, b, k]); }
    for (const sx of [-1, 1]) for (const z of [3.5, 5]) box('zloto', GOLD, sx * SAL.x - 0.04, 0, z - 0.04, sx * SAL.x + 0.04, SAL.lintel, z + 0.04);   // złote ramy drzwi
    for (const xx of [-1.0, 1.4]) box('zloto', GOLD, xx - 0.04, 0, SAL.z0 - 0.04, xx + 0.04, SAL.lintel, SAL.z0 + 0.04);
    // drzwi przesuwne (otwarte): szklane skrzydło schowane przy ościeżu
    for (const sx of [-1, 1]) { box('szklo', GLASS, sx * (SAL.x - 0.03) - 0.015, 0.03, 5.02, sx * (SAL.x - 0.03) + 0.015, SAL.lintel - 0.02, 6.4); box('chrom', CHROME, sx * (SAL.x - 0.03) - 0.025, 0.03, 4.98, sx * (SAL.x - 0.03) + 0.025, SAL.lintel - 0.02, 5.04); }
    // dach salonu (podłoga flybridge) z okapem i złotą krawędzią
    box('h_lak', '#fff0d4', -SAL.x, SAL.h, SAL.z0, SAL.x, SAL.roof, SAL.z1);                 // spód dachu = kremowy sufit salonu
    box('lak', WHITE, -SAL.x - 0.35, SAL.h + 0.02, SAL.z0 - 0.35, SAL.x + 0.35, SAL.roof - 0.02, SAL.z1 + 0.5);
    box('zloto', GOLD, -SAL.x - 0.37, SAL.h + 0.08, SAL.z0 - 0.37, SAL.x + 0.37, SAL.h + 0.14, SAL.z1 + 0.52);
    for (let z = SAL.z0 + 0.6; z < SAL.z1; z += 2.3) for (const sx of [-1, 1]) cyl('glow', '#fff3d6', 0.06, 0.06, 0.02, sx * (SAL.x + 0.15), SAL.h + 0.005, z, 8);   // lampki w okapie

    const IX = SAL.x - SAL.t, IZ0 = SAL.z0 + SAL.t, IZ1 = SAL.z1 - SAL.t;     // wewnętrzne lica ścian
    // ---- podłoga: jasny dąb w deskach z przesuniętymi łączeniami (zatrzymuje kule jak dawny dywan) ----
    box('h_spod', '#5a4030', -SAL.x, -0.03, SAL.z0, SAL.x, 0.0, SAL.z1);
    { let r = 7; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647, PW = 0.16;
      for (let x = -IX, i = 0; x < IX - 1e-6; x += PW, i++) {
        let z = IZ0 - rnd() * 1.6;
        while (z < IZ1) { const z1 = Math.min(IZ1, z + 1.4 + rnd() * 0.8), zz = Math.max(IZ0, z); if (z1 - zz > 0.05) { const c = ['#d0a873', '#c49a66', '#d8b27e', '#c8a06c'][Math.floor(rnd() * 4)]; quad('h_podl', c, [x + 0.003, 0.025, zz + 0.003], [x + 0.003, 0.025, z1 - 0.003], [Math.min(x + PW, IX) - 0.003, 0.025, z1 - 0.003], [Math.min(x + PW, IX) - 0.003, 0.025, zz + 0.003]); } z = z1; }
      } }
    box('drewno', WALNUT, -1.0, 0.025, SAL.z0 + 0.25, 1.4, 0.035, SAL.z0 + 0.95);               // wycieraczka przy drzwiach
    // ---- dywany: prostokątny pod kanapą i stolikiem, okrągły z przodu salonu ----
    const frame = (key, col, x0, z0, x1, z1, w, y0, y1) => { box(key, col, x0, y0, z0, x1, y1, z0 + w); box(key, col, x0, y0, z1 - w, x1, y1, z1); box(key, col, x0, y0, z0 + w, x0 + w, y1, z1 - w); box(key, col, x1 - w, y0, z0 + w, x1, y1, z1 - w); };
    { const [x0, z0, x1, z1] = [-2.5, -6.1, 0.35, 0.1], y0 = 0.025, y1 = 0.05;
      frame('dywan', NAVY2, x0, z0, x1, z1, 0.2, y0, y1); frame('dywan', GOLD, x0 + 0.2, z0 + 0.2, x1 - 0.2, z1 - 0.2, 0.035, y0, y1);
      frame('dywan', CREAM, x0 + 0.235, z0 + 0.235, x1 - 0.235, z1 - 0.235, 0.3, y0, y1); frame('dywan', '#d9cbb0', x0 + 0.535, z0 + 0.535, x1 - 0.535, z1 - 0.535, 0.06, y0, y1);
      box('dywan', CREAM, x0 + 0.595, y0, z0 + 0.595, x1 - 0.595, y1, z1 - 0.595); }
    { const ring = (r0, r1, col) => add('dywan', new THREE.LatheGeometry([new THREE.Vector2(r0, 0), new THREE.Vector2(r1, 0), new THREE.Vector2(r1, 0.025), new THREE.Vector2(r0, 0.025)], 48), col, M4(0.2, 0.025, 3.4));
      ring(1.38, 1.55, NAVY2); ring(1.12, 1.38, CREAM); ring(1.07, 1.12, GOLD); cyl('dywan', CREAM, 1.07, 1.07, 0.025, 0.2, 0.0375, 3.4, 48); }
    // ---- boazeria z orzecha pod oknami, skórzane panele na filarach, listwy ----
    const onWall = (ax, side, a0, a1, y0, y1, key, col, d = 0.018, r = 0) => {     // płyta na wewnętrznym licu ściany
      if (ax === 'x') { const x = side * IX; return r ? rbox(key, col, x - side * d, y0, a0, x, y1, a1, r, 1) : box(key, col, x - side * d, y0, a0, x, y1, a1); }
      const z = side < 0 ? IZ0 : IZ1; return r ? rbox(key, col, a0, y0, z, a1, y1, z - side * d, r, 1) : box(key, col, a0, y0, z, a1, y1, z - side * d);
    };
    const wallRuns = [];
    for (const sx of [-1, 1]) for (const [a, b, k] of SIDE_SEG) wallRuns.push(['x', sx, Math.max(a, IZ0), Math.min(b, IZ1), k]);
    for (const [a, b, k] of AFT_SEG) wallRuns.push(['z', -1, Math.max(a, -IX), Math.min(b, IX), k]);
    for (const [a, b, k] of FRONT_SEG) wallRuns.push(['z', 1, Math.max(a, -IX), Math.min(b, IX), k]);
    for (const [ax, sd, a0, a1, k] of wallRuns) {
      if (k === 'd' || a1 - a0 < 0.05) continue;
      onWall(ax, sd, a0, a1, 0, 0.1, 'drewno', BLACK, 0.022);                                // cokół
      onWall(ax, sd, a0, a1, 0.1, 0.98, 'drewno', WALNUT, 0.016);                            // boazeria
      const n = Math.max(1, Math.round((a1 - a0) / 0.7)), w = (a1 - a0) / n;
      for (let i = 0; i < n; i++) onWall(ax, sd, a0 + i * w + 0.07, a0 + (i + 1) * w - 0.07, 0.2, 0.88, 'drewno', WALNUT2, 0.026);   // płyciny
      onWall(ax, sd, a0, a1, 0.98, 1.0, 'zloto', GOLD, 0.03);                               // złota listwa
      if (k === 's') {                                                                       // filar: pikowane panele ze skóry
        const m = Math.max(1, Math.round((a1 - a0) / 0.7)), pw = (a1 - a0) / m;
        for (let i = 0; i < m; i++) for (let y = 1.04; y < 2.55; y += 0.78) onWall(ax, sd, a0 + i * pw + 0.012, a0 + (i + 1) * pw - 0.012, y, Math.min(2.6, y + 0.76), 'skora', LEATHER, 0.045, 0.03);
      }
    }
    // rolety rzymskie w oknach (podciągnięte) i złote listwy nadproży
    for (const [ax, sd, a, b, k] of winSides) {
      if (k === 'd') continue;
      const a0 = ax === 'x' ? Math.max(a, IZ0) : a, a1 = ax === 'x' ? Math.min(b, IZ1) : b; if (a1 - a0 < 0.1) continue;
      for (let i = 0; i < 3; i++) onWall(ax, sd, a0 + 0.02, a1 - 0.02, SAL.lintel - 0.1 - i * 0.07, SAL.lintel - 0.03 - i * 0.07, 'tkanina', i % 2 ? CREAM2 : CREAM, 0.07 - i * 0.012);
      onWall(ax, sd, a0, a1, SAL.lintel - 0.02, SAL.lintel + 0.02, 'zloto', GOLD, 0.03);
    }
    // ---- sufit: obniżony obrys z ciepłą listwą LED, środek z drewnianych paneli, oczka lamp ----
    const SY = SAL.h - 0.16, SW = 0.42;
    box('lak', WHITE, -IX, SY, IZ0, IX, SAL.h, IZ0 + SW); box('lak', WHITE, -IX, SY, IZ1 - SW, IX, SAL.h, IZ1);
    box('lak', WHITE, -IX, SY, IZ0 + SW, -IX + SW, SAL.h, IZ1 - SW); box('lak', WHITE, IX - SW, SY, IZ0 + SW, IX, SAL.h, IZ1 - SW);
    for (const [x0, z0, x1, z1] of [[-IX + SW, IZ0 + SW, IX - SW, IZ0 + SW + 0.02], [-IX + SW, IZ1 - SW - 0.02, IX - SW, IZ1 - SW], [-IX + SW, IZ0 + SW, -IX + SW + 0.02, IZ1 - SW], [IX - SW - 0.02, IZ0 + SW, IX - SW, IZ1 - SW]])
      box('glow', '#ffe3b4', x0, SY + 0.02, z0, x1, SAL.h - 0.03, z1);
    { const x0 = -IX + SW, x1 = IX - SW, z0 = IZ0 + SW, z1 = IZ1 - SW, nx = 3, nz = 8, w = (x1 - x0) / nx, d = (z1 - z0) / nz;
      for (let i = 1; i < nx; i++) box('drewno', WALNUT, x0 + i * w - 0.03, SAL.h - 0.07, z0, x0 + i * w + 0.03, SAL.h - 0.025, z1);
      for (let j = 1; j < nz; j++) box('drewno', WALNUT, x0, SAL.h - 0.07, z0 + j * d - 0.03, x1, SAL.h - 0.025, z0 + j * d + 0.03); }
    for (const z of [IZ0 + 0.21, IZ1 - 0.21]) for (let x = -2.6; x <= 2.61; x += 1.3) { cyl('glow', '#fff6e2', 0.06, 0.06, 0.026, x, SY - 0.013, z, 8); }
    for (const x of [-IX + 0.21, IX - 0.21]) for (let z = -7.6; z < 7.2; z += 1.9) { cyl('glow', '#fff6e2', 0.06, 0.06, 0.026, x, SY - 0.013, z, 8); }

    // ---- bar: front z orzecha z pionowymi żłobieniami, marmurowy blat, złote listwy, podświetlenie, stołki ----
    { const b = part('barIn'); hitbox(b);
      const [x0, , z0, x1, , z1] = b;
      box('drewno', BLACK, x0 + 0.08, 0, z0 + 0.04, x1, 0.1, z1 - 0.04);                                   // cofnięty cokół
      box('glow', '#ffc878', x0 + 0.075, 0.095, z0 + 0.05, x0 + 0.085, 0.105, z1 - 0.05);                  // listwa LED przy podłodze
      rbox('drewno', WALNUT, x0, 0.1, z0, x1, 1.0, z1, 0.02, 1);
      for (let z = z0 + 0.09; z < z1 - 0.06; z += 0.11) box('drewno', WALNUT2, x0 - 0.025, 0.14, z - 0.028, x0 + 0.01, 0.94, z + 0.028);   // żłobienia
      box('zloto', GOLD, x0 - 0.03, 0.94, z0 - 0.01, x0 + 0.01, 0.98, z1 + 0.01);
      for (const z of [z0, z1]) box('drewno', WALNUT2, x0 - 0.02, 0.1, z - 0.02, x1, 1.0, z + 0.02);
      rbox('marmur', MARBLE, x0 - 0.12, 1.0, z0 - 0.06, x1 + 0.02, 1.1, z1 + 0.06, 0.02, 1);                // blat z białego marmuru
      box('zloto', GOLD, x0 - 0.125, 0.985, z0 - 0.065, x1 + 0.025, 1.0, z1 + 0.065);
      // na blacie: kubełek z szampanem, kieliszki, storczyk, misa z owocami
      cyl('chrom', CHROME, 0.11, 0.08, 0.22, 2.55, 1.21, -5.9, 18);
      Y.bottles(T(I, 2.55, 1.12, -5.9), { n: 1, cols: ['#1d4a2a'], seed: 9 });
      for (const [x, z] of [[2.2, -5.3], [2.3, -5.15], [2.25, -3.2]]) { cyl('szklo_b', '#dfeaf2', 0.028, 0.004, 0.12, x, 1.16, z, 10); cyl('szklo_b', '#dfeaf2', 0.003, 0.003, 0.08, x, 1.14 - 0.03, z, 6); cyl('szklo_b', '#dfeaf2', 0.03, 0.03, 0.006, x, 1.103, z, 10); }
      Y.plant(T(I, 2.5, 1.1, -2.9), { h: 0.42, r: 0.07, pot: WHITE, potK: 'lak', lf: ['#3f8a4c', '#2f7a3e'], leaves: 6, kind: 'orchid', seed: 5 });
      for (let i = 0; i < 4; i++) add('lisc', new THREE.SphereGeometry(0.03, 8, 6), '#f4f0f6', M4(2.5 + Math.cos(i * 1.7) * 0.06, 1.42 + i * 0.03, -2.9 + Math.sin(i * 1.7) * 0.06));   // kwiaty storczyka
      cyl('marmur', MARBLE, 0.16, 0.09, 0.08, 2.4, 1.14, -4.3, 20);
      for (let i = 0; i < 5; i++) add('lisc', new THREE.SphereGeometry(0.045, 10, 8), ['#ffb02e', '#e3233a', '#9be22d', '#ffd84a', '#ff7a2a'][i], M4(2.4 + Math.cos(i * 1.3) * 0.06, 1.2 + (i % 2) * 0.03, -4.3 + Math.sin(i * 1.3) * 0.06));
      // zaplecze baru przy ścianie: niska szafka z orzecha z rzędem butelek
      box('drewno', WALNUT2, x1, 0, z0, IX - 0.02, 0.95, z1);
      box('marmur', MARBLE_D, x1, 0.95, z0, IX - 0.02, 0.98, z1);
      for (const z of [-6.1, -5.2, -4.3, -3.4]) Y.bottles(T(I, (x1 + IX) / 2, 0.98, z, Math.PI / 2), { n: 5, step: 0.13, seed: Math.round(-z * 10) });
      // lampy wiszące nad barem: przezroczysty klosz, świecąca żarówka, złoty pręt
      for (const z of [-5.7, -4.5, -3.3]) { tube('zloto', GOLD, [2.3, SAL.h - 0.03, z], [2.3, 2.1, z], 0.008, 6); cyl('zloto', GOLD, 0.05, 0.03, 0.05, 2.3, 2.08, z, 12);
        add('glow', new THREE.SphereGeometry(0.06, 12, 8), '#ffe2a8', M4(2.3, 1.96, z)); add('szklo', new THREE.SphereGeometry(0.13, 18, 12), '#ffd8a0', M4(2.3, 1.95, z)); }
      for (const z of [-6, -5, -4, -3]) Y.stool(T(I, 1.25, 0, z, Math.PI / 2), { h: 0.76, c: NAVY2, mt: CHROME, k: { up: 'skora', mt: 'chrom' } }); }
    // ---- kanapa: kremowa skóra na orzechowym cokole, granatowe i złote poduszki ----
    { const b = part('sofaIn'); hitbox(b);
      const cx = (b[0] + b[3]) / 2, cz = (b[2] + b[5]) / 2;
      Y.sofa(T(I, cx, 0, cz, Math.PI / 2), { w: b[5] - b[2], d: b[3] - b[0], h: 0.9, seat: 0.45, arm: 0.2, armH: 0.6, n: 3, c: '#e6d2b0', c2: '#d6bf98', base: WALNUT2, pil: [NAVY2, '#c9a24a', NAVY2, TAUPE], pillows: 4, back: 0.22, k: { up: 'skora', base: 'drewno', mt: 'chrom' } });
      // nad kanapą: obraz w złotej ramie i dwa kinkiety
      for (const z of [-2.9, -1.1]) Y.sconce(T(I, -IX + 0.045, 1.95, z, Math.PI / 2), { mt: GOLD, glow: '#ffe6b8', k: { mt: 'zloto', gl: 'glow' } }); }
    // ---- stolik kawowy: marmurowy blat na złotej ramie; książki, misa, wazon ----
    { const x0 = -1.8, x1 = -0.6, z0 = -4.2, z1 = -1.8, h = 0.44;
      rbox('marmur', MARBLE, x0, h - 0.045, z0, x1, h, z1, 0.015, 1);
      for (const z of [z0 + 0.12, z1 - 0.12]) pipe('zloto', GOLD, [[x0 + 0.1, 0.0, z], [x0 + 0.1, h - 0.045, z], [x1 - 0.1, h - 0.045, z], [x1 - 0.1, 0.0, z]], 0.018, 8);
      tube('zloto', GOLD, [x0 + 0.1, 0.06, z0 + 0.12], [x0 + 0.1, 0.06, z1 - 0.12], 0.014); tube('zloto', GOLD, [x1 - 0.1, 0.06, z0 + 0.12], [x1 - 0.1, 0.06, z1 - 0.12], 0.014);
      for (const [i, c] of [[0, NAVY2], [1, '#c9a24a'], [2, CREAM2]]) rbox('tkanina', c, -1.5 + i * 0.01, h + i * 0.035, -3.6, -1.15 + i * 0.01, h + (i + 1) * 0.035 - 0.003, -3.2 + i * 0.02, 0.006, 1);
      cyl('marmur', MARBLE_D, 0.18, 0.1, 0.07, -1.2, h + 0.035, -2.5, 24);
      cyl('szklo_b', '#cfe3ee', 0.05, 0.07, 0.26, -1.0, h + 0.13, -3.75, 14); for (let i = 0; i < 3; i++) add('lisc', new THREE.SphereGeometry(0.05, 10, 8), ['#f4f0f6', '#ffd0dc', '#fff4d6'][i], M4(-1.0 + Math.cos(i * 2.1) * 0.05, h + 0.3 + i * 0.02, -3.75 + Math.sin(i * 2.1) * 0.05)); }
    // ---- przód salonu: konsola RTV z orzecha, duży telewizor, głośnik, rośliny w narożnikach ----
    { const z1 = IZ1 - 0.005, z0 = z1 - 0.34;
      box('drewno', BLACK, -1.5, 0, z0 + 0.04, 1.5, 0.12, z1); rbox('drewno', WALNUT, -1.55, 0.12, z0, 1.55, 0.52, z1, 0.012, 1);
      for (let i = 0; i < 4; i++) { box('drewno', WALNUT2, -1.5 + i * 0.75 + 0.02, 0.16, z0 - 0.01, -1.5 + (i + 1) * 0.75 - 0.02, 0.48, z0 + 0.01); box('zloto', GOLD, -1.5 + (i + 0.5) * 0.75 - 0.12, 0.43, z0 - 0.025, -1.5 + (i + 0.5) * 0.75 + 0.12, 0.445, z0 - 0.005); }
      box('marmur', MARBLE_D, -1.56, 0.52, z0 - 0.005, 1.56, 0.545, z1);
      box('szklo_b', BLACK, -0.9, 0.68, z1 - 0.06, 0.9, 1.7, z1 - 0.02); box('szklo_b', '#0b1a2c', -0.87, 0.71, z1 - 0.065, 0.87, 1.67, z1 - 0.06);
      box('chrom', '#30343c', -0.7, 0.56, z1 - 0.2, 0.7, 0.64, z1 - 0.08);
      for (const sx of [-1, 1]) Y.plant(T(I, sx * (IX - 0.32), 0, IZ1 - 0.32), { h: 1.0, r: 0.2, pot: sx < 0 ? '#2a2c34' : '#2a2c34', potK: 'marmur', leaves: 11, seed: sx < 0 ? 11 : 17 }); }
    // ---- złote ramy obrazów na filarach (same obrazy: atlas na canvasie, osobna siatka niżej) ----
    for (const sd of [-1, 1]) { const a = sd * (IX - 0.045), b2 = sd * (IX - 0.075); box('zloto', GOLD, Math.min(a, b2), 1.3, -2.58, Math.max(a, b2), 2.14, -1.42); }

    // =========================================== FLYBRIDGE ===========================================
    for (const n of ['flyAft', 'flyOut', 'flyIn']) { const b = part(n); box('h_lak', WHITE, ...b); box('tek', TEAK2, b[0] - 0.03, b[4], b[2] - 0.03, b[3] + 0.03, b[4] + 0.05, b[5] + 0.03); box('zloto', GOLD, b[0] - 0.035, b[4] - 0.03, b[2] - 0.035, b[3] + 0.035, b[4], b[5] + 0.035); }
    // pulpit sterowy: korpus, ciemny pochyły pulpit z ekranami, koło sterowe z chromu i drewna, manetki, kompas
    { const b = part('helm'); hitbox(b);
      const [x0, y0, z0, x1, , z1] = b;
      rbox('lak', WHITE, x0, y0, z0, x1, y0 + 0.95, z1, 0.05, 1);
      add('drewno', new THREE.BoxGeometry(x1 - x0 - 0.15, 0.06, 0.8), BLACK, M4(0, y0 + 1.02, (z0 + z1) / 2 - 0.05, 0, -0.42));
      for (const sx of [-0.75, 0.75]) { add('glow', new THREE.BoxGeometry(1.0, 0.012, 0.42), SCREEN, M4(sx, y0 + 1.06, (z0 + z1) / 2 - 0.05, 0, -0.42)); box('chrom', '#30343c', sx - 0.52, y0 + 0.99, z0 + 0.1, sx + 0.52, y0 + 1.02, z0 + 0.14); }
      add('chrom', new THREE.TorusGeometry(0.24, 0.018, 8, 28), CHROME, M4(0, y0 + 1.05, z0 - 0.1, 0, -0.55));
      add('drewno', new THREE.TorusGeometry(0.24, 0.028, 8, 28), WALNUT, M4(0, y0 + 1.05, z0 - 0.105, 0, -0.55));
      for (let i = 0; i < 3; i++) add('chrom', new THREE.CylinderGeometry(0.012, 0.012, 0.46, 6), CHROME, M4(0, y0 + 1.05, z0 - 0.1, 0, -0.55, (i * Math.PI) / 3));
      cyl('zloto', GOLD, 0.05, 0.05, 0.08, 0, y0 + 1.0, z0 - 0.02, 12, Math.PI / 2 - 0.55);
      for (const x of [0.55, 0.68]) { tube('chrom', CHROME, [x, y0 + 0.95, z0 + 0.2], [x, y0 + 1.18, z0 + 0.12], 0.012); add('szklo_b', new THREE.SphereGeometry(0.03, 8, 6), BLACK, M4(x, y0 + 1.19, z0 + 0.12)); }
      add('szklo_b', new THREE.SphereGeometry(0.07, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#1d2a3a', M4(-0.6, y0 + 1.0, z0 + 0.2));
      // fotele sternika: skóra na chromowanych kolumnach
      for (const xl of [-1.0, 1.0]) { cyl('chrom', CHROME, 0.05, 0.05, 0.3, xl, R + 0.15, 0.6, 12); cyl('chrom', CHROME, 0.22, 0.24, 0.03, xl, R + 0.015, 0.6, 18);
        rboxM('skora', LEATHER, 0.56, 0.14, 0.52, 0.06, M4(xl, R + 0.37, 0.62), 1); rboxM('skora', LEATHER, 0.54, 0.6, 0.12, 0.06, M4(xl, R + 0.72, 0.33, 0, -0.12), 1);
        for (const sx of [-1, 1]) rboxM('skora', CREAM2, 0.08, 0.16, 0.42, 0.035, M4(xl + sx * 0.3, R + 0.5, 0.6), 1); } }
    { const b = part('screen'); box('h_lak', WHITE, b[0], R, b[2], b[3], R + 0.5, b[5]); box('szklo', GLASS, b[0] + 0.05, R + 0.5, b[2] + 0.1, b[3] - 0.05, R + 1.0, b[5] - 0.1);
      box('zloto', GOLD, b[0], R + 0.5, b[2] - 0.02, b[3], R + 0.55, b[5] + 0.02); box('chrom', CHROME, b[0] + 0.05, R + 0.98, b[2] + 0.08, b[3] - 0.05, R + 1.02, b[5] - 0.08); }
    // kanapa flybridge z tkaniny i teakowy stolik
    { const b = part('lounge'); hitbox(b);
      Y.sofa(T(I, (b[0] + b[3]) / 2, R, (b[2] + b[5]) / 2), { w: b[3] - b[0], d: b[5] - b[2], h: 0.9, seat: 0.45, arm: 0.16, n: 3, c: CREAM, c2: WHITE, base: WHITE, pil: [NAVY2, GOLD, NAVY2], pillows: 3, k: { up: 'tkanina', base: 'lak', mt: 'chrom' } });
      Y.table(T(I, 0.9, R, -4.9), { w: 3.0, d: 1.0, h: 0.66, top: TEAK, topK: 'tek', base: CHROME, baseK: 'chrom', th: 0.05 }); }
    // pokład flybridge: teak na ciemnej spoinie
    box('h_spod', CAULK, -SAL.x + 0.3, SAL.roof, SAL.z0 + 0.3, SAL.x - 0.3, SAL.roof + 0.003, 3);
    const flyStrips = () => { const x0 = -SAL.x + 0.3, x1 = SAL.x - 0.3, n = Math.round((x1 - x0) / 0.24);
      for (let k = 0; k < n; k++) { const a = x0 + (k / n) * (x1 - x0) + 0.008, b2 = x0 + ((k + 1) / n) * (x1 - x0) - 0.008; quad('h_tek', [TEAK, TEAK2, '#ab7546'][k % 3], [a, SAL.roof + 0.026, SAL.z0 + 0.3], [a, SAL.roof + 0.026, 3], [b2, SAL.roof + 0.026, 3], [b2, SAL.roof + 0.026, SAL.z0 + 0.3]); } };
    flyStrips();
    // hardtop + słupki, pałąk radarowy, złote kopuły, anteny, bandera; od spodu oczka lamp
    { const b = part('hardtop'), y0 = b[1], y1 = b[4];
      box('h_lak', WHITE, ...b); box('zloto', GOLD, b[0] - 0.02, y0 + 0.05, b[2] - 0.02, b[3] + 0.02, y0 + 0.12, b[5] + 0.02);
      for (let x = -2.8; x <= 2.81; x += 1.4) for (const z of [-4.8, -2.4, 0, 2.0]) { cyl('glow', '#fff3d6', 0.05, 0.05, 0.01, x, y0 - 0.004, z, 8); }
      for (const xl of [-3.45, 3.45]) for (const [zb, zt] of [[-5.2, -5.6], [1.8, 2.2]]) tube('chrom', WHITE2, [xl, R, zb], [xl, y0, zt], 0.09, 8);
      for (const xl of [-2.6, 2.6]) tube('h_lak', WHITE, [xl, y1, -3.5], [xl * 0.75, y1 + 1.6, -4.6], 0.18, 8);
      tube('h_lak', WHITE, [-1.95, y1 + 1.6, -4.6], [1.95, y1 + 1.6, -4.6], 0.18, 8);
      for (const xl of [-1.95, 1.95]) add('h_lak', new THREE.SphereGeometry(0.18, 12, 8), WHITE, M4(xl, y1 + 1.6, -4.6));
      for (const xl of [-1.2, 1.2]) { cyl('lak', WHITE2, 0.12, 0.15, 0.4, xl, y1 + 1.9, -4.6, 12); add('zloto', new THREE.IcosahedronGeometry(0.55, 2), GOLDL, M4(xl, y1 + 2.5, -4.6)); }
      tube('chrom', CHROME, [0, y1 + 1.6, -4.6], [0, y1 + 3.6, -5.0], 0.04); tube('chrom', CHROME, [-0.6, y1 + 3.1, -4.9], [0.6, y1 + 3.1, -4.9], 0.03);
      box('szklo_b', '#11151c', -0.8, y1 + 0.02, -4.45, 0.8, y1 + 0.08, -4.05);
      cyl('zloto', GOLD, 0.03, 0.03, 2.0, 0, y1 + 1.0, b[5] - 0.3); box('tkanina', NAVY2, -0.01, y1 + 1.5, b[5] - 1.08, 0.01, y1 + 2.0, b[5] - 0.28); }
    // ---------------- schody na flybridge (tek, białe podstopnice, złote poręcze) ----------------
    for (const [, ...b] of STAIRS) { box('h_lak', WHITE2, b[0], 0, b[2], b[3], b[4] - 0.05, b[5]); box('h_tek', TEAK, b[0], b[4] - 0.05, b[2] - 0.02, b[3], b[4], b[5]); box('glow', '#ffe9c0', b[0] + 0.05, b[4] - 0.075, b[2] - 0.004, b[3] - 0.05, b[4] - 0.06, b[2] + 0.004); }
    for (const xl of STAIR) { tube('zloto', GOLD, [xl, 0.95, SAL.z0 - STEPS * RUN], [xl, SAL.roof + 0.95, SAL.z0], 0.035, 8); for (let i = 0; i <= STEPS; i += 3) { const z = SAL.z0 - (STEPS - i) * RUN, y = i * RISE; tube('chrom', CHROME, [xl, y, z], [xl, y + 0.95, z], 0.02, 6); } }

    // =========================================== RUFA ===========================================
    { const b = part('sofaAft'); hitbox(b);
      Y.sofa(T(I, (b[0] + b[3]) / 2, 0, (b[2] + b[5]) / 2, Math.PI / 2), { w: b[5] - b[2], d: b[3] - b[0], h: 0.95, seat: 0.45, arm: 0.15, armH: 0.6, n: 3, c: CREAM, c2: WHITE, base: WHITE, pil: [NAVY2, GOLD, NAVY2, '#f4f2f6'], pillows: 4, back: 0.2, k: { up: 'tkanina', base: 'lak', mt: 'chrom' } }); }
    { const b = part('table'); hitbox(b);
      Y.table(T(I, (b[0] + b[3]) / 2, 0, (b[2] + b[5]) / 2), { w: b[3] - b[0], d: b[5] - b[2], h: 0.8, top: TEAK, topK: 'tek', base: CHROME, baseK: 'chrom', th: 0.06 });
      box('zloto', GOLD, b[0] + 0.02, 0.735, b[2] + 0.02, b[3] - 0.02, 0.742, b[5] - 0.02);
      cyl('chrom', CHROME, 0.12, 0.09, 0.24, 0.2, 0.92, -16.2, 18); Y.bottles(T(I, 0.2, 0.82, -16.2), { n: 1, cols: ['#1d4a2a'], seed: 4 });
      for (const [x, z] of [[-0.4, -16.6], [0.6, -15.4], [-0.2, -15.5]]) { cyl('szklo_b', '#dfeaf2', 0.03, 0.004, 0.12, x, 0.9, z, 10); cyl('szklo_b', '#dfeaf2', 0.003, 0.003, 0.06, x, 0.84, z, 6); }
      // pufy (bez kolizji, jak dawniej)
      for (const xl of [-0.6, 0.8]) for (const z of [-17.6, -14.4]) { rbox('lak', WHITE, xl - 0.26, 0, z - 0.26, xl + 0.26, 0.12, z + 0.26, 0.04, 1); rbox('tkanina', CREAM, xl - 0.27, 0.11, z - 0.27, xl + 0.27, 0.46, z + 0.27, 0.08, 1); box('tkanina', NAVY2, xl - 0.272, 0.36, z - 0.272, xl + 0.272, 0.38, z + 0.272); } }
    { const b = part('barAft'); hitbox(b);
      const [x0, , z0, x1, h, z1] = b;
      rbox('lak', WHITE, x0, 0.06, z0, x1, h - 0.08, z1, 0.03, 1); box('drewno', BLACK, x0 + 0.05, 0, z0 + 0.05, x1 - 0.05, 0.06, z1 - 0.05);
      for (let z = z0 + 0.5; z < z1 - 0.3; z += 1.0) { box('lak', WHITE2, x0 - 0.01, 0.15, z - 0.42, x0 + 0.01, h - 0.2, z + 0.42); box('chrom', CHROME, x0 - 0.03, h - 0.38, z - 0.2, x0 - 0.01, h - 0.35, z + 0.2); }
      rbox('tek', TEAK, x0 - 0.08, h - 0.08, z0 - 0.04, x1 + 0.02, h, z1 + 0.04, 0.015, 1);
      box('chrom', CHROME, x0 + 0.12, h - 0.005, -16.6, x0 + 0.48, h + 0.005, -16.0); tube('chrom', CHROME, [x0 + 0.45, h, -16.3], [x0 + 0.45, h + 0.25, -16.3], 0.012); tube('chrom', CHROME, [x0 + 0.45, h + 0.25, -16.3], [x0 + 0.3, h + 0.25, -16.3], 0.012);
      Y.bottles(T(I, x0 + 0.35, h, -14.9, Math.PI / 2), { n: 4, step: 0.12, seed: 21 });
      cyl('chrom', CHROME, 0.1, 0.08, 0.2, x0 + 0.3, h + 0.1, -15.6, 16); }
    { const b = part('bench'); hitbox(b);
      const [x0, , z0, x1, h, z1] = b;
      rbox('lak', WHITE, x0, 0, z0, x1, 0.32, z1, 0.03, 1); rbox('lak', WHITE, x0, 0, z0, x1, h, z0 + 0.12, 0.03, 1);
      for (let i = 0; i < 3; i++) { const a = x0 + 0.04 + i * (x1 - x0 - 0.08) / 3; rbox('tkanina', CREAM, a + 0.01, 0.32, z0 + 0.12, a + (x1 - x0 - 0.08) / 3 - 0.01, 0.46, z1, 0.05, 1); rbox('tkanina', CREAM2, a + 0.02, 0.48, z0 + 0.1, a + (x1 - x0 - 0.08) / 3 - 0.02, h - 0.05, z0 + 0.26, 0.06, 1); }
      for (const x of [-0.9, 0.9]) rboxM('tkanina', NAVY2, 0.42, 0.36, 0.12, 0.06, M4(x, 0.68, z0 + 0.32, 0, -0.2), 1); }

    // =========================================== DZIÓB ===========================================
    // jacuzzi: biała wanna, teakowe obramowanie, turkusowa woda (podświetlona), chromowane uchwyty
    { const b = part('jacuzzi'); hitbox(b);
      const [x0, , z0, x1, h, z1] = b;
      frame('lak', WHITE, x0, z0, x1, z1, 0.2, 0, h - 0.07);                                           // ścianki wanny (w środku pusto)
      frame('tek', TEAK, x0 - 0.04, z0 - 0.04, x1 + 0.04, z1 + 0.04, 0.24, h - 0.07, h);
      box('lak', '#bfeef2', x0 + 0.2, 0.2, z0 + 0.2, x1 - 0.2, 0.24, z1 - 0.2);                         // dno
      frame('lak', '#d6f6f8', x0 + 0.2, z0 + 0.2, x1 - 0.2, z1 - 0.2, 0.25, 0.24, 0.45);               // stopień-siedzisko dookoła
      add('woda', new THREE.BoxGeometry(x1 - x0 - 0.4, 0.02, z1 - z0 - 0.4), '#ffffff', M4((x0 + x1) / 2, h - 0.08, (z0 + z1) / 2));
      for (const [x, z] of [[x0 + 0.21, z0 + 0.8], [x1 - 0.21, z1 - 0.8], [x0 + 0.21, z1 - 0.8], [x1 - 0.21, z0 + 0.8]]) cyl('glow', '#bff8ff', 0.05, 0.05, 0.01, x, 0.36, z, 8, 0, 0, Math.PI / 2);   // podświetlenie pod wodą
      for (const x of [x0 + 0.6, x1 - 0.6]) pipe('chrom', CHROME, [[x - 0.2, h, z0 - 0.02], [x - 0.2, h + 0.18, z0 - 0.02], [x + 0.2, h + 0.18, z0 - 0.02], [x + 0.2, h, z0 - 0.02]], 0.018);
      for (const x of [x0 + 0.5, x1 - 0.5]) { rbox('tkanina', '#f8f8f8', x - 0.3, h, z1 - 0.15, x + 0.3, h + 0.08, z1 + 0.03, 0.03, 1); } }
    // materac do opalania: biała baza, kremowy materac z granatową lamówką, poduszki i zwinięte ręczniki
    { const b = part('sunpad'); hitbox(b);
      const [x0, , z0, x1, h, z1] = b;
      rbox('lak', WHITE, x0, 0, z0, x1, 0.3, z1, 0.05, 1);
      rbox('tkanina', CREAM, x0 + 0.05, 0.29, z0 + 0.05, x1 - 0.05, h, z1 - 0.05, 0.09, 1);
      for (const z of [z0 + 0.05, z1 - 0.05]) tube('tkanina', NAVY2, [x0 + 0.12, h - 0.03, z], [x1 - 0.12, h - 0.03, z], 0.018);
      for (const x of [x0 + 0.05, x1 - 0.05]) tube('tkanina', NAVY2, [x, h - 0.03, z0 + 0.12], [x, h - 0.03, z1 - 0.12], 0.018);
      for (const xl of [-1.6, 0, 1.6]) rboxM('tkanina', NAVY2, 0.85, 0.14, 0.4, 0.06, M4(xl, h + 0.08, 17.1, 0, 0.35), 1);
      for (const [x, c] of [[-0.8, '#f4f2f6'], [0.8, '#f4f2f6']]) { cyl('tkanina', c, 0.09, 0.09, 0.55, x, h + 0.09, 15.4, 14, 0, 0, Math.PI / 2); cyl('tkanina', NAVY2, 0.092, 0.092, 0.08, x, h + 0.09, 15.4, 14, 0, 0, Math.PI / 2); } }
    // łódź (RIB) na kołysce: granatowe pontony, biały kadłub, konsola z szybką, silnik
    { const b = part('tender'); hitbox(b);
      const [x0, , z0, x1, , z1] = b, cx = (x0 + x1) / 2;
      for (const z of [z0 + 0.4, z1 - 0.7]) { box('chrom', CHROME, x0 + 0.15, 0, z - 0.1, x1 - 0.15, 0.22, z + 0.1); rbox('tkanina', BLACK, x0 + 0.1, 0.22, z - 0.12, x1 - 0.1, 0.3, z + 0.12, 0.03, 1); }
      rbox('kadlub', WHITE, x0 + 0.25, 0.28, z0 + 0.15, x1 - 0.25, 0.62, z1 - 0.55, 0.1, 1);
      for (const sx of [-1, 1]) pipe('tkanina', NAVY, [[cx + sx * 0.8, 0.72, z0 + 0.12], [cx + sx * 0.82, 0.72, z0 + 1.8], [cx + sx * 0.62, 0.74, z1 - 0.65], [cx + sx * 0.25, 0.78, z1 - 0.18], [cx, 0.8, z1 - 0.05]], 0.26, 8);
      for (const sx of [-1, 1]) tube('zloto', GOLD, [cx + sx * 0.98, 0.7, z0 + 0.3], [cx + sx * 0.98, 0.7, z0 + 2.2], 0.02);
      box('tek', TEAK, cx - 0.55, 0.62, z0 + 0.2, cx + 0.55, 0.66, z1 - 0.7);
      rbox('lak', WHITE, cx - 0.32, 0.66, z0 + 1.55, cx + 0.32, 1.2, z0 + 2.05, 0.06, 1);
      add('szklo', new THREE.BoxGeometry(0.62, 0.3, 0.03), GLASS, M4(cx, 1.32, z0 + 2.08, 0, -0.5));
      rbox('tkanina', CREAM, cx - 0.4, 0.66, z0 + 0.6, cx + 0.4, 0.94, z0 + 1.2, 0.08, 1);
      rbox('lak', '#2a2c34', cx - 0.18, 0.55, z0 - 0.02, cx + 0.18, 1.25, z0 + 0.3, 0.06, 1); rbox('lak', WHITE, cx - 0.2, 1.05, z0 - 0.04, cx + 0.2, 1.35, z0 + 0.34, 0.08, 1); }
    // kabestany, knagi
    for (const xl of [-0.7, 0.7]) { cyl('chrom', CHROME, 0.2, 0.25, 0.32, xl, 0.16, 22.4, 18); cyl('chrom', CHROME, 0.24, 0.2, 0.1, xl, 0.37, 22.4, 18); add('chrom', new THREE.SphereGeometry(0.12, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), CHROME, M4(xl, 0.42, 22.4)); }
    for (const [xl, z] of [[-4.7, -20.5], [4.7, -20.5], [-5.0, 6.5], [5.0, 6.5], [-3.5, 19], [3.5, 19]]) {
      rbox('chrom', CHROME, xl - 0.08, 0.02, z - 0.16, xl + 0.08, 0.1, z + 0.16, 0.02, 1);
      add('chrom', new THREE.CapsuleGeometry(0.035, 0.38, 4, 8), CHROME, M4(xl, 0.16, z, 0, Math.PI / 2));
      for (const dz of [-0.07, 0.07]) cyl('chrom', CHROME, 0.035, 0.045, 0.08, xl, 0.1, z + dz, 8);
    }
    // ---------------- reling: chromowane słupki, złoty pochwyt, linka, furty do trapu i motorówki ----------------
    const rail = (pts) => {
      for (const [xl, z] of pts) { const y0 = bulH(z); if (y0 < 1.3) { cyl('chrom', CHROME, 0.03, 0.035, 1.37 - y0, xl, (y0 + 1.37) / 2, z, 6, 0, 0, 0, true); cyl('chrom', CHROME, 0.05, 0.05, 0.03, xl, y0 + 0.015, z, 6, 0, 0, 0, true); } }
      for (let i = 0; i < pts.length - 1; i++) {
        tube('zloto', GOLD, [pts[i][0], 1.37, pts[i][1]], [pts[i + 1][0], 1.37, pts[i + 1][1]], 0.035, 7);
        for (const f of [0.38, 0.68]) {
          const ya = bulH(pts[i][1]) + (1.37 - bulH(pts[i][1])) * f, yb = bulH(pts[i + 1][1]) + (1.37 - bulH(pts[i + 1][1])) * f;
          if (ya < 1.25 && yb < 1.25) tube('chrom', CHROME, [pts[i][0], ya, pts[i][1]], [pts[i + 1][0], yb, pts[i + 1][1]], 0.012, 4);
        }
      }
    };
    const edge = (sx, z0, z1) => { const p = []; for (let z = z0; z <= z1 + 1e-6; z += 1.5) p.push([sx * (halfAt(z) - 0.2), z]); if (p[p.length - 1][1] !== z1) p.push([sx * (halfAt(z1) - 0.2), z1]); return p; };
    rail(edge(-1, STERN + 0.35, BOW - 1.6));
    rail(edge(1, STERN + 0.35, GATE_BOAT[0])); rail(edge(1, GATE_BOAT[1], GATE_BRIDGE[0])); rail(edge(1, GATE_BRIDGE[1], BOW - 1.6));
    rail([[-HALF + 0.2, STERN + 0.35], [HALF - 0.2, STERN + 0.35]]);
    rail([[-(halfAt(BOW - 1.6) - 0.2), BOW - 1.6], [0, BOW - 0.45], [halfAt(BOW - 1.6) - 0.2, BOW - 1.6]]);
    for (const z of [-19, -16]) { add('lak', new THREE.CapsuleGeometry(0.22, 0.55, 4, 14), '#eef2f6', M4(HALF + 0.12, -1.0, z)); tube('chrom', '#30343c', [HALF + 0.12, -0.55, z], [HALF - 0.05, 0.35, z], 0.01, 4); }   // odbijacze
    cyl('glow', '#ff3a3a', 0.08, 0.08, 0.12, -SAL.x - 0.36, SAL.h + 0.3, SAL.z1 + 0.3, 8);   // światło pozycyjne (lustrzane odbicie zamienia burtę, kolor poprawia się niżej)
    for (let z = STERN + 2; z < TAPER; z += 3) for (const sx of [-1, 1]) cyl('glow', '#ffe7b0', 0.045, 0.045, 0.045, sx * (HALF - 0.4), 0.0225, z, 8);   // lampki w pokładzie
  }
  // jacht lokalny -> dwa jachty w świecie
  for (const s of [-1, 1]) for (const [key, list] of Object.entries(Y.kits)) if (list.length) W.addKit(key, list, sideM(s));
  // światło pozycyjne: lewa burta czerwona, prawa zielona (w jachcie B lustrzane – kolor wymieniony)
  W.kits.glow.forEach((g) => {
    const P = g.attributes.position, C = g.attributes.color;
    for (let i = 0; i < P.count; i++) if (C.getX(i) > 0.9 && C.getY(i) < 0.1 && P.getX(i) > 0) C.setXYZ(i, 0.23, 1, 0.48);
  });

  // ---------- nazwa na pawęży: złote litery; obrazy w salonach (atlas) ----------
  if (typeof document !== 'undefined') {
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256; const x = cv.getContext('2d');
    const g = x.createLinearGradient(0, 40, 0, 200); g.addColorStop(0, '#fff1b8'); g.addColorStop(0.45, '#f0c24f'); g.addColorStop(1, '#a8761c');
    x.fillStyle = g; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = 'italic 900 150px Anton, Impact, "Arial Narrow", sans-serif'; x.fillText('BEANGTA', 512, 112);
    x.font = '700 46px Barlow, Arial, sans-serif'; x.fillText('V I C E   C I T Y', 512, 214);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const mat = new THREE.MeshStandardMaterial({ map: t, transparent: true, metalness: 0.6, roughness: 0.3 });
    for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.3), mat); m.position.set(gx(s, 0), -0.6, STERN - 0.03); m.rotation.y = Math.PI; m.userData.noHit = true; root.add(m); }
    // obrazy: abstrakcje w kolorach morza i zachodu słońca (jedna tekstura na wszystkie)
    const art = W.artAtlas((c, S, i) => {
      const pal = [['#0d3a5c', '#2f7ab0', '#f2c552', '#f4efe6'], ['#f4e6d0', '#d9a066', '#1c2c4c', '#c94a3a'], ['#1a2a3a', '#3fb6c6', '#f4f2f6', '#f2c552'], ['#efe6d4', '#14203a', '#b47c4b', '#8fb8d0']][i];
      const gr = c.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, pal[0]); gr.addColorStop(1, pal[1]); c.fillStyle = gr; c.fillRect(0, 0, S, S);
      let r = 3 + i * 17; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
      for (let k = 0; k < 7; k++) { c.globalAlpha = 0.5 + rnd() * 0.4; c.fillStyle = pal[2 + (k % 2)]; c.beginPath();
        if (i % 2) c.arc(rnd() * S, rnd() * S, 18 + rnd() * 60, 0, Math.PI * 2); else c.ellipse(S / 2 + (rnd() - 0.5) * S * 0.6, S * (0.3 + k * 0.08), S * (0.2 + rnd() * 0.3), 6 + rnd() * 18, (rnd() - 0.5) * 0.4, 0, Math.PI * 2); c.fill(); }
      c.globalAlpha = 1; c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 3; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(0, S * (0.6 + k * 0.1)); c.bezierCurveTo(S * 0.3, S * (0.5 + k * 0.1), S * 0.7, S * (0.75 + k * 0.08), S, S * (0.62 + k * 0.1)); c.stroke(); }
    });
    const IXA = SAL.x - SAL.t - 0.08;
    for (const s of [-1, 1]) {
      const M = sideM(s), fl = s < 0 ? 1 : -1;
      for (const [sd, i] of [[-1, 0], [1, 1]]) {           // sd = -1: nad kanapą (burta zewnętrzna), +1: na filarze przy barze
        const c = new THREE.Vector3(sd * IXA, 1.72, -2.0).applyMatrix4(M);
        art.put([c.x, c.y, c.z], [0, 0, 0.5 * sd * fl], [0, 0.36, 0], i + (s > 0 ? 2 : 0));
      }
    }
    const am = art.mesh('jachty_obrazy'); if (am) root.add(am);
  }

  // ---------- motorówka między rufami: mahoniowa, w stylu klasycznej łodzi motorowej, dziób w stronę jachtu B ----------
  {
    const { box, cyl, tube, quad, add } = W;
    const z0 = BOAT.z0, z1 = BOAT.z1, zc = (z0 + z1) / 2, Wd = (z1 - z0) / 2, XA = -BOAT.x - 0.1, XB = BOAT.x + 0.1;
    const lv = [[0.75, 1], [0.05, 1, MAHO], [-0.5, 0.97, NAVY], [-1.2, 0.92, NAVY], [-1.35, 0.85, GOLD], [-2.2, 0.3, ANTIFOUL]];
    const wAt = (x, k) => { const u = (x - XA) / (XB - XA); return Wd * k * (u > 0.7 ? Math.sqrt(Math.max(0, 1 - ((u - 0.7) / 0.3) ** 2)) : 1); };
    const xs = []; for (let x = XA; x < XB - 1e-6; x += 0.5) xs.push(x); xs.push(XB);
    for (let i = 0; i < xs.length - 1; i++) for (let l = 0; l < lv.length - 1; l++) for (const sz of [-1, 1]) {
      const a = xs[i], b = xs[i + 1], [ya, ka] = lv[l], [yb, kb, col] = lv[l + 1];
      quad(col === GOLD ? 'zloto' : col === MAHO ? 'h_mah' : 'kadlub', col, [a, ya, zc + sz * wAt(a, ka)], [b, ya, zc + sz * wAt(b, ka)], [b, yb, zc + sz * wAt(b, kb)], [a, yb, zc + sz * wAt(a, kb)]);
    }
    for (let i = 0; i < xs.length - 1; i++) {                // pokład z lakierowanego mahoniu z jasnymi spoinami
      const a = xs[i], b = xs[i + 1], wa = wAt(a, 1) - 0.22, wb = wAt(b, 1) - 0.22; if (wa <= 0 && wb <= 0) continue;
      for (let k = -4; k < 4; k++) { const f0 = k / 4 + 0.01, f1 = (k + 1) / 4 - 0.01;
        quad('h_mah', k % 2 ? MAHO : MAHO2, [a, 0.03, zc + wa * f0], [a, 0.03, zc + wa * f1], [b, 0.03, zc + wb * f1], [b, 0.03, zc + wb * f0]); }
      quad('h_mah', CREAM, [a, 0.02, zc - wa], [a, 0.02, zc + wa], [b, 0.02, zc + wb], [b, 0.02, zc - wb]);
    }
    for (const b of BOAT_COVER.slice(0, 2)) { box('h_mah', MAHO, b[0], 0, b[2], b[3], b[4], b[5]); box('zloto', GOLD, b[0], b[4], b[2] - 0.02, b[3], b[4] + 0.04, b[5] + 0.02); }
    { const c = BOAT_COVER[2]; box('h_mah', MAHO, c[0], 0, c[2], c[3], 1.0, c[5]); box('tkanina', CREAM, c[0] + 0.1, 1.0, c[2] + 0.05, c[3] - 0.1, 1.05, c[5] - 0.05);
      add('szklo', new THREE.BoxGeometry(0.05, 0.5, c[5] - c[2] + 0.2), GLASS, M4(c[3] + 0.05, 1.28, (c[2] + c[5]) / 2, 0, 0, 0.5));
      tube('zloto', GOLD, [c[3] + 0.1, 1.05, c[2] - 0.1], [c[3] - 0.15, 1.53, c[2] - 0.1], 0.025); tube('zloto', GOLD, [c[3] + 0.1, 1.05, c[5] + 0.1], [c[3] - 0.15, 1.53, c[5] + 0.1], 0.025);
      add('zloto', new THREE.TorusGeometry(0.2, 0.02, 8, 24), GOLD, M4(c[0] - 0.02, 1.2, zc, Math.PI / 2, 0, -0.4)); }
    for (const x of [-4.5, 3.5]) { W.rbox('skora', CREAM, x - 0.9, 0.03, zc - 0.55, x + 0.9, 0.45, zc + 0.55, 0.08, 1); W.rbox('skora', '#e0d2b8', x - 0.92, 0.42, zc - 0.57, x + 0.92, 0.5, zc + 0.57, 0.04, 1); }
    for (const dz of [-0.6, 0.6]) { W.rbox('lak', '#11151c', XA - 0.6, -1.2, zc + dz - 0.25, XA - 0.05, 0.3, zc + dz + 0.25, 0.08, 1); box('zloto', GOLD, XA - 0.61, 0.05, zc + dz - 0.26, XA - 0.04, 0.15, zc + dz + 0.26); }
    tube('zloto', GOLD, [XB - 1.2, 0.8, zc], [XB + 0.1, 0.85, zc], 0.03);
    void cyl;
  }

  // ---------- trap między dziobami: tek na aluminiowej kratownicy, złote poręcze, dwa pływaki, lampki ----------
  {
    const { box, cyl, tube, add } = W;
    const z0 = GATE_BRIDGE[0], z1 = GATE_BRIDGE[1], zc = (z0 + z1) / 2, xe = CX - halfAt(zc) + 0.25;
    for (let x = -xe; x < xe - 1e-6; x += 0.4) box('h_tek', Math.round((x + xe) / 0.4) % 2 ? TEAK : TEAK2, x + 0.01, -0.06, z0 + 0.1, Math.min(x + 0.4, xe) - 0.01, 0.04, z1 - 0.1);
    box('chrom', '#8a96a2', -xe, -0.6, z0 + 0.1, xe, -0.06, z0 + 0.28); box('chrom', '#8a96a2', -xe, -0.6, z1 - 0.28, xe, -0.06, z1 - 0.1);
    for (const z of [z0 + 0.18, z1 - 0.18]) {
      const pts = []; for (let x = -xe; x < xe - 1e-6; x += 1.4) pts.push(x); pts.push(xe);
      for (const x of pts) cyl('chrom', CHROME, 0.035, 0.035, 1.15, x, 0.62, z, 6, 0, 0, 0, true);
      tube('zloto', GOLD, [-xe, 1.2, z], [xe, 1.2, z], 0.035, 8); tube('chrom', CHROME, [-xe, 0.62, z], [xe, 0.62, z], 0.02);
      for (let i = 0; i < pts.length - 1; i++) tube('chrom', CHROME, [pts[i], 0.08, z], [pts[i + 1], 1.15, z], 0.018);
    }
    for (const x of [-3.2, 3.2]) { add('lak', new THREE.CapsuleGeometry(0.7, 1.8, 6, 16), WHITE, M4(x, WL + 0.3, zc, 0, 0, Math.PI / 2)); cyl('zloto', GOLD, 0.72, 0.72, 0.25, x, WL + 0.3, zc, 18, Math.PI / 2); cyl('chrom', '#8a96a2', 0.1, 0.1, 1.9, x, -1.05, zc, 8); }
    for (let x = -xe + 0.5; x < xe; x += 0.8) add('glow', new THREE.IcosahedronGeometry(0.07, 0), Math.round(x * 2) % 3 ? '#ffe2a0' : '#fff6dc', M4(x, 1.75 - 0.25 * Math.cos((x / xe) * Math.PI / 2), zc));
    tube('chrom', '#30343c', [-xe, 1.75, zc], [xe, 1.75, zc], 0.008, 4);
  }

  // ---------- siatki: pokład, podłogi, ściany i niewidzialne bryły mebli zatrzymują kule (jak kolizje na serwerze); reszta – nie ----------
  if (W.kits.kadlub) W.kits.kadlub = [W.crease(W.merge(W.kits.kadlub), 32)];   // gładki kadłub (ostre tylko załamania pasów)
  const add = (key, mat, name, o = {}) => W.mesh(key, mat, name, { parent: root, ...o });
  const DECO = ['kadlub', 'lak', 'tek', 'drewno', 'mah', 'skora', 'tkanina', 'dywan', 'marmur', 'chrom', 'zloto', 'szklo_b', 'lisc'];
  { const rooms = [-1, 1].map((s) => { const a = gx(s, -SAL.x + SAL.t), b = gx(s, SAL.x - SAL.t); return [Math.min(a, b) - 0.05, -0.1, SAL.z0 + SAL.t - 0.05, Math.max(a, b) + 0.05, SAL.h + 0.01, SAL.z1 - SAL.t + 0.05]; });
    const inside = (g) => { g.computeBoundingBox(); const b = g.boundingBox, c = b.getCenter(new THREE.Vector3()), d = b.getSize(new THREE.Vector3()).toArray().sort((p, q) => p - q);
      return d[2] < 0.3 || d[1] < 0.08 || rooms.some((r) => c.x > r[0] && c.x < r[3] && c.y > r[1] && c.y < r[4] && c.z > r[2] && c.z < r[5]); };   // w salonie, drobiazg albo cienka rurka (reling, poręcz): bez cienia
    for (const k of DECO) { const l = W.kits[k] || []; W.kits[k + '_w'] = l.filter(inside); W.kits[k] = l.filter((g) => !inside(g)); W.preset(k + '_w', PR[k]); } }
  // kolejność ma znaczenie: ten sam materiał rysuje się w kolejności tworzenia, więc najpierw to, co z przodu (meble, boazeria),
  // potem ściany i podłogi – zasłonięte piksele odrzuca test głębi zamiast liczyć je dwa razy
  add(DECO.map((k) => k + '_w'), MT.uber, 'jachty_wnetrze', { noHit: true, cast: false });   // meble w salonach i drobiazgi: bez cienia od słońca (salon jest pod dachem)
  add(DECO, MT.uber, 'jachty_wystroj', { noHit: true });
  add(['h_tek', 'h_podl', 'h_lak', 'h_mah', 'h_spod'], MT.uber, 'floor_jachty');                    // pokład, podłogi, ściany, motorówka: zatrzymują kule
  add('hitbox', MT.hitbox, 'jachty_kolizje_mebli', { cast: false, receive: false });         // niewidzialne bryły mebli = kolizje serwera
  add('woda', MT.woda, 'jachty_jacuzzi', { noHit: true, cast: false, order: 1 });
  add('szklo', MT.szklo, 'jachty_szyby', { noHit: true, cast: false, order: 2 });
  add('glow', MT.glow, 'jachty_lampki', { noHit: true, cast: false });
  return root;
}
