// Mapa 1v1 „Jachty” (w kodzie i na serwerze dalej pod nazwą "Magazyn", żeby nie zmieniać serwera meczów; nazwa w grze: lobby-ui.js).
// Dwa identyczne superjachty (~46 m) na otwartym morzu, dziobami w stronę +Z, lustrzanie po obu stronach osi X = 0.
// Na każdym: pokład rufowy z kanapą, stołem i barkiem; salon, do którego się wchodzi (drzwi z rufy i z obu boków, okna do strzelania),
// schody na flybridge (burty do kucania, ster, kanapa, hardtop z pałąkiem radarowym), dziób z jacuzzi, materacem i łodzią na kołysce.
// Dzioby łączy trap, rufy – mahoniowa motorówka. Złote akcenty: pasy na kadłubie, listwy, kopuły, nazwa na pawęży.
// Do wody nie da się wpaść: wzdłuż relingów stoją niewidzialne ściany (zewnętrzne burty = kolizje, od strony drugiego jachtu = blokady
// ruchu `clips`, żeby kule przelatywały nad wodą). Każdy gracz zaczyna na swoim jachcie, na zewnętrznym przejściu za filarem salonu.
// Kolizje i model powstają z tego samego opisu niżej, więc serwer (czyta tylko MAP) i grafika zawsze się zgadzają.
// Plik nie importuje three.js (serwer go wczytuje w Node) – model buduje build(THREE); morze, niebo i wyspy są w klimaty.js.

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
export function build(THREE) {
  const root = new THREE.Group(); root.name = 'Jachty';
  const kits = {};
  const push = (key, geo, color, m) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
    if (m) g.applyMatrix4(m);
    const n = g.attributes.position.count, c = new THREE.Color(color), a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); (kits[key] ||= []).push(g);
  };
  const merge = (list) => {
    let n = 0; for (const g of list) n += g.attributes.position.count;
    const P = new Float32Array(n * 3), K = new Float32Array(n * 3); let o = 0;
    for (const g of list) { P.set(g.attributes.position.array, o * 3); K.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('color', new THREE.BufferAttribute(K, 3));
    out.computeVertexNormals(); out.computeBoundingSphere(); return out;
  };
  const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  const M4 = (x, y, z, ry = 0, rx = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(sx, sy, sz));
  const box = (key, w, h, d, col, x, y, z, ry = 0, rx = 0, rz = 0) => push(key, new THREE.BoxGeometry(w, h, d), col, M4(x, y, z, ry, rx, rz));
  const boxAB = (key, col, x0, y0, z0, x1, y1, z1) => box(key, Math.abs(x1 - x0), y1 - y0, z1 - z0, col, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const cyl = (key, rt, rb, h, col, x, y, z, seg = 8, rx = 0, ry = 0, rz = 0) => push(key, new THREE.CylinderGeometry(rt, rb, h, seg), col, M4(x, y, z, ry, rx, rz));
  const tube = (key, a, b, r, col, seg = 6) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length();
    push(key, new THREE.CylinderGeometry(r, r, len, seg), col, new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()), new THREE.Vector3(1, 1, 1)));
  };
  const tris = (key, pts, col) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3)); push(key, g, col); };
  const quad = (key, a, b, c, d, col) => tris(key, [a, b, c, a, c, d], col);

  // paleta: biel, granat, przyciemniane szkło, tek, mahoń, kremowa tapicerka, chrom; złoto (osobny metaliczny materiał)
  const WHITE = '#f5f6f8', WHITE2 = '#e3e7ec', NAVY = '#14203a', NAVY2 = '#1c2c4c', TEAK = '#b47c4b', TEAK2 = '#a06c3e', CAULK = '#3a2a1c',
    CHROME = '#d2dae2', CREAM = '#f0e7d6', CREAM2 = '#e2d6c0', CARPET = '#d9cfbf', WALNUT = '#5a3a24', MAHO = '#7a3a1e', MAHO2 = '#6a3018',
    GOLD = '#f2c552', GOLDL = '#ffdf86', SCREEN = '#39d9ff', ANTIFOUL = '#3a1e22', GLASS = '#9fc3e0';

  function yacht(s) {
    const X = (xl) => gx(s, xl);
    const P = (xl, y, z) => [X(xl), y, z];
    const bL = (key, col, x0, y0, z0, x1, y1, z1) => { const b = boxL(s, x0, y0, z0, x1, y1, z1); boxAB(key, col, b[0], b[1], b[2], b[3], b[4], b[5]); };
    const part = (name) => boxL(s, ...COVER.find((c) => c[0] === name).slice(1));
    const zs = []; for (let z = STERN; z <= BOW + 1e-6; z += 0.5) zs.push(+z.toFixed(2));

    // ---------------- kadłub ----------------
    // poziomy: [y, skala szerokości, cofnięcie przy dziobie (pochylona dziobnica), kolor pasa poniżej]
    const LV = [[0.05, 1.0, 0], [-0.7, 1.01, 0.2, WHITE], [-1.5, 0.985, 0.6, WHITE], [-1.85, 0.965, 0.9, WHITE], [-2.0, 0.955, 1.0, GOLD], [-2.6, 0.86, 1.8, NAVY], [-3.4, 0.35, 4.5, ANTIFOUL]];
    for (const sx of [-1, 1]) for (let i = 0; i < zs.length - 1; i++) for (let l = 0; l < LV.length - 1; l++) {
      const [ya, ka, ra] = LV[l], [yb, kb, rb, col] = LV[l + 1];
      const za = Math.min(zs[i], BOW - ra), zb = Math.min(zs[i + 1], BOW - ra), zA = Math.min(zs[i], BOW - rb), zB = Math.min(zs[i + 1], BOW - rb);
      quad(col === GOLD ? 'gold' : 'hull', P(sx * halfAt(za) * ka, ya, za), P(sx * halfAt(zb) * ka, ya, zb), P(sx * halfAt(zB) * kb, yb, zB), P(sx * halfAt(zA) * kb, yb, zA), col);
    }
    for (let l = 0; l < LV.length - 1; l++) {                // pawęż
      const [ya, ka] = LV[l], [yb, kb, , col] = LV[l + 1];
      quad(col === GOLD ? 'gold' : 'hull', P(-HALF * ka, ya, STERN), P(-HALF * kb, yb, STERN), P(HALF * kb, yb, STERN), P(HALF * ka, ya, STERN), col === WHITE ? WHITE2 : col);
    }
    // złota listwa wzdłuż burty i ciemne pasy okien kabin gości w kadłubie, ze złotą ramką
    for (const sx of [-1, 1]) for (let i = 0; i < zs.length - 1; i++) {
      const za = zs[i], zb = zs[i + 1], a = halfAt(za) * 1.006 + 0.012, b = halfAt(zb) * 1.006 + 0.012;
      quad('gold', P(sx * a, -0.36, za), P(sx * b, -0.36, zb), P(sx * b, -0.24, zb), P(sx * a, -0.24, za), GOLD);
    }
    for (const [z0, z1] of [[-17, -12], [-8.5, -2.5], [-1, 5]]) for (const sx of [-1, 1]) {
      const o = HALF * 1.01 + 0.02;
      bL('hull', NAVY, sx * o - 0.03, -1.2, z0, sx * o + 0.03, -0.72, z1);
      bL('gold', GOLD, sx * o - 0.035, -1.25, z0 - 0.05, sx * o + 0.035, -1.2, z1 + 0.05); bL('gold', GOLD, sx * o - 0.035, -0.72, z0 - 0.05, sx * o + 0.035, -0.67, z1 + 0.05);
    }
    for (const z of [8.5, 10, 11.5]) for (const sx of [-1, 1]) {   // bulaje na dziobie
      const h = halfAt(z) * 1.0 + 0.01;
      cyl('hull', 0.17, 0.17, 0.06, NAVY, X(sx * h), -0.95, z, 12, 0, 0, Math.PI / 2); cyl('gold', 0.21, 0.21, 0.04, GOLD, X(sx * (h - 0.01)), -0.95, z, 12, 0, 0, Math.PI / 2);
    }
    // platforma kąpielowa z teku za pawężą (za blokadą – tylko widok)
    bL('hull', TEAK, -HALF + 0.3, -1.25, STERN - 1.6, HALF - 0.3, -1.05, STERN);
    bL('gold', GOLD, -HALF + 0.3, -1.08, STERN - 1.62, HALF - 0.3, -1.03, STERN - 1.55);
    // nazwa na pawęży: złote litery
    if (typeof document !== 'undefined') {
      const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256; const x = cv.getContext('2d');
      const g = x.createLinearGradient(0, 40, 0, 200); g.addColorStop(0, '#fff1b8'); g.addColorStop(0.45, '#f0c24f'); g.addColorStop(1, '#a8761c');
      x.fillStyle = g; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = 'italic 900 150px Anton, Impact, "Arial Narrow", sans-serif'; x.fillText('BEANGTA', 512, 112);
      x.font = '700 46px Barlow, Arial, sans-serif'; x.fillText('V I C E   C I T Y', 512, 214);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.3), new THREE.MeshStandardMaterial({ map: t, transparent: true, metalness: 0.6, roughness: 0.3 }));
      m.position.set(X(0), -0.6, STERN - 0.03); m.rotation.y = Math.PI; m.userData.noHit = true; root.add(m);
    }

    // ---------------- pokład z teku z ciemnymi spoinami ----------------
    const deckStrips = (x0, x1, z0, z1, y, key = 'floor') => {
      const n = Math.max(1, Math.round((x1 - x0) / 0.32));
      for (let k = 0; k < n; k++) {
        const a = x0 + (k / n) * (x1 - x0), b = x0 + ((k + 1) / n) * (x1 - x0), pts = [];
        for (let i = 0; i < zs.length - 1; i++) {
          const za = Math.max(z0, zs[i]), zb = Math.min(z1, zs[i + 1]); if (zb <= za) continue;
          const ha = halfAt(za) - 0.05, hb = halfAt(zb) - 0.05, cl = (v, h) => Math.max(-h, Math.min(h, v));
          const a0 = cl(a + 0.015, ha), a1 = cl(b - 0.015, ha), b0 = cl(a + 0.015, hb), b1 = cl(b - 0.015, hb);
          if (a1 - a0 < 1e-3 && b1 - b0 < 1e-3) continue;
          pts.push(P(a0, y, za), P(b0, y, zb), P(b1, y, zb), P(a0, y, za), P(b1, y, zb), P(a1, y, za));
        }
        if (pts.length) tris(key, pts, k % 2 ? TEAK : TEAK2);
      }
    };
    for (let i = 0; i < zs.length - 1; i++) {                // ciemne podłoże pod listwami = spoiny
      const za = zs[i], zb = zs[i + 1], ha = halfAt(za), hb = halfAt(zb);
      quad('floor', P(-ha, 0.005, za), P(-hb, 0.005, zb), P(hb, 0.005, zb), P(ha, 0.005, za), CAULK);
    }
    deckStrips(-HALF, HALF, STERN, SAL.z0, 0.02);
    deckStrips(-HALF, -SAL.x, SAL.z0, SAL.z1, 0.02); deckStrips(SAL.x, HALF, SAL.z0, SAL.z1, 0.02);
    deckStrips(-HALF, HALF, SAL.z1, BOW, 0.02);
    bL('floor', CARPET, -SAL.x, 0.0, SAL.z0, SAL.x, 0.025, SAL.z1);                          // dywan w salonie
    bL('floor', WALNUT, -1.0, 0.026, SAL.z0 + 0.25, 1.4, 0.03, SAL.z0 + 1.0);                // wycieraczka przy drzwiach
    // nadburcie: biała ścianka ze złotym wierzchem, na dziobie coraz wyższe (sylwetka jak na zdjęciu)
    const bulH = (z) => 0.32 + 0.85 * Math.pow(Math.max(0, (z - TAPER) / (BOW - TAPER)), 1.4);
    for (const sx of [-1, 1]) for (let i = 0; i < zs.length - 1; i++) {
      const za = zs[i], zb = zs[i + 1], a = halfAt(za), b = halfAt(zb);
      quad('deco', P(sx * a, 0.0, za), P(sx * b, 0.0, zb), P(sx * b, bulH(zb), zb), P(sx * a, bulH(za), za), WHITE);
      quad('deco', P(sx * (a - 0.14), 0.0, za), P(sx * (b - 0.14), 0.0, zb), P(sx * (b - 0.14), bulH(zb), zb), P(sx * (a - 0.14), bulH(za), za), WHITE2);
      quad('gold', P(sx * a, bulH(za), za), P(sx * b, bulH(zb), zb), P(sx * (b - 0.14), bulH(zb), zb), P(sx * (a - 0.14), bulH(za), za), GOLD);
    }

    // ---------------- salon ----------------
    for (const [, ...b] of COVER.filter((c) => c[0] === 'wall')) {
      const w = boxL(s, ...b), y1 = w[4];
      boxAB('hit', WHITE, w[0], w[1], w[2], w[3], y1, w[5]);
      if (y1 === SAL.sill) boxAB('gold', GOLD, w[0] - 0.02, y1, w[2] - 0.02, w[3] + 0.02, y1 + 0.04, w[5] + 0.02);   // złoty parapet
    }
    // szyby (przyciemniane, przepuszczają kule – tak jak na serwerze, bo tam okno to otwór)
    for (const sx of [-1, 1]) for (const [a, b, k] of SIDE_SEG) if (k !== 's') { const xw = sx * (SAL.x - SAL.t / 2); bL('glass', GLASS, xw - 0.02, k === 'w' ? SAL.sill : 0.03, a, xw + 0.02, SAL.lintel, b); }
    for (const [a, b, k] of AFT_SEG) bL('glass', GLASS, a, k === 'w' ? SAL.sill : 0.03, SAL.z0 + 0.1, b, SAL.lintel, SAL.z0 + 0.14);
    for (const [a, b, k] of FRONT_SEG) if (k === 'w') bL('glass', GLASS, a, SAL.sill, SAL.z1 - 0.14, b, SAL.lintel, SAL.z1 - 0.1);
    for (const sx of [-1, 1]) for (const z of [3.5, 5]) bL('gold', GOLD, sx * SAL.x - 0.04, 0, z - 0.04, sx * SAL.x + 0.04, SAL.lintel, z + 0.04);   // złote ramy drzwi
    for (const xx of [-1.0, 1.4]) bL('gold', GOLD, xx - 0.04, 0, SAL.z0 - 0.04, xx + 0.04, SAL.lintel, SAL.z0 + 0.04);
    // dach salonu (podłoga flybridge) z okapem i złotą krawędzią; od spodu sufit z lampkami
    { const r = boxL(s, -SAL.x, SAL.h, SAL.z0, SAL.x, SAL.roof, SAL.z1); boxAB('hit', WHITE, r[0], SAL.h, r[2], r[3], SAL.roof, r[5]);
      const o = boxL(s, -SAL.x - 0.35, SAL.h + 0.02, SAL.z0 - 0.35, SAL.x + 0.35, SAL.roof - 0.02, SAL.z1 + 0.5); boxAB('deco', WHITE, o[0], o[1], o[2], o[3], o[4], o[5]);
      boxAB('gold', GOLD, o[0] - 0.02, SAL.h + 0.08, o[2] - 0.02, o[3] + 0.02, SAL.h + 0.14, o[5] + 0.02);
      for (let z = SAL.z0 + 1.5; z < SAL.z1 - 1; z += 2.2) for (const xl of [-1.8, 0.2, 2.2]) cyl('glow', 0.12, 0.12, 0.03, '#fff3d6', X(xl), SAL.h - 0.02, z, 10); }
    deckStrips(-SAL.x + 0.3, SAL.x - 0.3, SAL.z0 + 0.3, 3, SAL.roof + 0.01);              // tek na flybridge
    // wnętrze: bar ze złotym blatem i stołkami, kanapa, stolik, telewizor
    { const b = part('barIn'); boxAB('hit', WALNUT, b[0], 0, b[2], b[3], 1.02, b[5]); boxAB('gold', GOLD, b[0] - 0.05, 1.02, b[2] - 0.05, b[3] + 0.05, 1.1, b[5] + 0.05);
      for (const z of [-6, -5, -4, -3]) { cyl('deco', 0.04, 0.12, 0.72, CHROME, X(1.25), 0.36, z, 8); cyl('deco', 0.2, 0.2, 0.08, NAVY2, X(1.25), 0.76, z, 10); }
      for (const z of [-6.2, -5.8, -3.1]) cyl('deco', 0.05, 0.06, 0.3, z === -5.8 ? GOLDL : '#2f7a4f', X(2.6), 1.25, z, 8); }
    { const b = part('sofaIn'); boxAB('hit', CREAM, b[0], 0, b[2], b[3], 0.45, b[5]); bL('hit', CREAM2, -3.3, 0.45, -6, -3.05, 0.9, 0);
      for (const z of [-5, -3, -1]) bL('deco', NAVY2, -3.0, 0.45, z - 0.3, -2.8, 0.8, z + 0.3); }
    bL('deco', WALNUT, -1.8, 0.4, -4.2, -0.6, 0.46, -1.8); bL('gold', GOLD, -1.25, 0, -3.05, -1.15, 0.4, -2.95);
    bL('deco', '#0b0f16', -0.6, 0.9, SAL.z1 - 0.3, 1.2, 1.7, SAL.z1 - 0.26);
    // ---------------- flybridge ----------------
    for (const n of ['flyAft', 'flyOut', 'flyIn']) { const b = part(n); boxAB('hit', WHITE, b[0], b[1], b[2], b[3], b[4], b[5]); boxAB('gold', GOLD, b[0] - 0.02, b[4], b[2] - 0.02, b[3] + 0.02, b[4] + 0.05, b[5] + 0.02); }
    { const b = part('helm'); boxAB('hit', WHITE, b[0], R, b[2], b[3], R + 0.95, b[5]); boxAB('hit', NAVY, b[0] + 0.1, R + 0.95, b[2] + 0.05, b[3] - 0.1, R + 1.2, b[5] - 0.25);
      boxAB('glow', SCREEN, b[0] + 0.5, R + 0.97, b[2] + 0.12, b[3] - 0.5, R + 1.12, b[2] + 0.14);
      cyl('gold', 0.26, 0.26, 0.05, GOLD, (b[0] + b[3]) / 2, R + 1.1, b[2] - 0.08, 14, Math.PI / 2 - 0.5);
      for (const xl of [-1.0, 1.0]) { bL('deco', CREAM, xl - 0.3, R + 0.25, 0.3, xl + 0.3, R + 0.55, 0.9); bL('deco', CREAM2, xl - 0.3, R + 0.55, 0.2, xl + 0.3, R + 1.2, 0.35); cyl('deco', 0.05, 0.05, 0.25, CHROME, X(xl), R + 0.12, 0.6, 8); } }
    { const b = part('screen'); boxAB('hit', WHITE, b[0], R, b[2], b[3], R + 0.5, b[5]); boxAB('glass', GLASS, b[0] + 0.05, R + 0.5, b[2] + 0.1, b[3] - 0.05, R + 1.0, b[5] - 0.1);
      boxAB('gold', GOLD, b[0], R + 0.5, b[2] - 0.02, b[3], R + 0.55, b[5] + 0.02); }
    { const b = part('lounge'); boxAB('hit', CREAM, b[0], R, b[2], b[3], R + 0.45, b[5]); bL('hit', CREAM2, -1.0, R + 0.45, -7.2, 2.8, R + 0.9, -6.9);
      bL('deco', WALNUT, -0.6, R + 0.6, -5.4, 2.4, R + 0.66, -4.4); cyl('deco', 0.06, 0.08, 0.6, CHROME, X(0.9), R + 0.3, -4.9, 8); }
    // hardtop + słupki, pałąk radarowy, złote kopuły, anteny, bandera
    { const b = part('hardtop'), y0 = b[1], y1 = b[4];
      boxAB('hit', WHITE, b[0], y0, b[2], b[3], y1, b[5]); boxAB('gold', GOLD, b[0] - 0.02, y0 + 0.05, b[2] - 0.02, b[3] + 0.02, y0 + 0.12, b[5] + 0.02);
      for (const xl of [-3.45, 3.45]) for (const [zb, zt] of [[-5.2, -5.6], [1.8, 2.2]]) tube('deco', [X(xl), R, zb], [X(xl), y0, zt], 0.09, WHITE2, 8);
      for (const xl of [-2.6, 2.6]) tube('hit', [X(xl), y1, -3.5], [X(xl * 0.75), y1 + 1.6, -4.6], 0.18, WHITE, 8);
      tube('hit', [X(-1.95), y1 + 1.6, -4.6], [X(1.95), y1 + 1.6, -4.6], 0.18, WHITE, 8);
      for (const xl of [-1.2, 1.2]) { cyl('deco', 0.12, 0.15, 0.4, WHITE2, X(xl), y1 + 1.9, -4.6, 10); push('gold', new THREE.IcosahedronGeometry(0.55, 2), GOLDL, M4(X(xl), y1 + 2.5, -4.6)); }
      tube('deco', [X(0), y1 + 1.6, -4.6], [X(0), y1 + 3.6, -5.0], 0.04, CHROME); tube('deco', [X(-0.6), y1 + 3.1, -4.9], [X(0.6), y1 + 3.1, -4.9], 0.03, CHROME);
      box('deco', 1.6, 0.06, 0.4, '#11151c', X(0), y1 + 0.05, -4.25);
      cyl('gold', 0.03, 0.03, 2.0, GOLD, X(0), y1 + 1.0, b[5] - 0.3); box('deco', 0.02, 0.5, 0.8, NAVY2, X(0), y1 + 1.75, b[5] - 0.68); }
    // ---------------- schody na flybridge (tek, białe podstopnice, złote poręcze) ----------------
    for (const [, ...b] of STAIRS) { const w = boxL(s, ...b); boxAB('hit', WHITE2, w[0], 0, w[2], w[3], w[4] - 0.07, w[5]); boxAB('hit', TEAK, w[0], w[4] - 0.07, w[2], w[3], w[4], w[5]); }
    for (const xl of STAIR) tube('gold', [X(xl), 0.95, SAL.z0 - STEPS * RUN], [X(xl), SAL.roof + 0.95, SAL.z0], 0.04, GOLD);
    // ---------------- rufa ----------------
    { const b = part('sofaAft'); boxAB('hit', WHITE, b[0], 0, b[2], b[3], 0.42, b[5]); boxAB('hit', CREAM, b[0], 0.42, b[2], b[3], 0.6, b[5]);
      bL('hit', CREAM2, -5.0, 0.6, -19, -4.75, 0.95, -14);
      for (const z of [-18, -16.5, -15]) bL('deco', NAVY2, -4.7, 0.6, z - 0.32, -4.5, 0.95, z + 0.32); }
    { const b = part('table'); boxAB('hit', WALNUT, b[0], 0.72, b[2], b[3], 0.8, b[5]); boxAB('gold', GOLD, b[0] + 0.9, 0, b[2] + 0.9, b[3] - 0.9, 0.72, b[5] - 0.9);
      for (const xl of [-0.6, 0.8]) for (const z of [-17.6, -14.4]) bL('deco', CREAM, xl - 0.25, 0, z - 0.25, xl + 0.25, 0.48, z + 0.25); }
    { const b = part('barAft'); boxAB('hit', WHITE, b[0], 0, b[2], b[3], 1.37, b[5]); boxAB('gold', GOLD, b[0] - 0.05, 1.37, b[2] - 0.05, b[3] + 0.05, 1.45, b[5] + 0.05);
      for (const z of [-16.8, -16.2, -15.4, -14.6]) cyl('deco', 0.05, 0.06, 0.3, z === -16.2 ? GOLDL : '#2f7a4f', X(3.7), 1.6, z, 8); }
    { const b = part('bench'); boxAB('hit', WHITE, b[0], 0, b[2], b[3], 0.75, b[5]); boxAB('hit', CREAM, b[0], 0.75, b[2], b[3], 1.1, b[5]); }
    // ---------------- dziób: jacuzzi, materac, łódź na kołysce, kabestany, knagi ----------------
    { const b = part('jacuzzi'); boxAB('hit', WHITE, b[0], 0, b[2], b[3], 0.68, b[5]); boxAB('gold', GOLD, b[0] - 0.03, 0.68, b[2] - 0.03, b[3] + 0.03, 0.75, b[5] + 0.03);
      boxAB('glow', '#3fe6e0', b[0] + 0.2, 0.62, b[2] + 0.2, b[3] - 0.2, 0.66, b[5] - 0.2); }
    { const b = part('sunpad'); boxAB('hit', WHITE, b[0], 0, b[2], b[3], 0.3, b[5]); boxAB('hit', CREAM, b[0] + 0.05, 0.3, b[2] + 0.05, b[3] - 0.05, 0.5, b[5] - 0.05);
      for (const xl of [-1.6, 0, 1.6]) bL('deco', NAVY2, xl - 0.45, 0.5, 16.9, xl + 0.45, 0.66, 17.35); }
    { const b = part('tender'), cx = (b[0] + b[3]) / 2;
      boxAB('deco', CHROME, b[0] + 0.15, 0, b[2] + 0.3, b[3] - 0.15, 0.3, b[2] + 0.5); boxAB('deco', CHROME, b[0] + 0.15, 0, b[5] - 0.6, b[3] - 0.15, 0.3, b[5] - 0.4);
      boxAB('hit', NAVY, b[0], 0.3, b[2], b[3], 1.0, b[5] - 0.6); push('hit', new THREE.CylinderGeometry(0.01, 1.1, 0.6, 4, 1), NAVY, M4(cx, 0.65, b[5] - 0.3, Math.PI / 4, Math.PI / 2, 0, 1, 1, 0.5));
      boxAB('gold', GOLD, b[0] - 0.02, 0.88, b[2], b[3] + 0.02, 0.94, b[5] - 0.6); boxAB('hit', CREAM, b[0] + 0.2, 1.0, b[2] + 0.2, b[3] - 0.2, 1.1, b[5] - 1.0);
      boxAB('hit', WHITE, b[0] + 0.35, 1.0, b[2] + 1.6, b[3] - 0.35, 1.4, b[2] + 2.1); }
    for (const xl of [-0.7, 0.7]) cyl('deco', 0.2, 0.25, 0.4, CHROME, X(xl), 0.2, 22.4, 10);
    for (const [xl, z] of [[-4.7, -20.5], [4.7, -20.5], [-5.0, 6.5], [5.0, 6.5], [-3.5, 19], [3.5, 19]]) box('gold', 0.42, 0.1, 0.1, GOLD, X(xl), 0.4, z);
    // ---------------- reling: chromowane słupki, złoty pochwyt, furty do trapu i motorówki ----------------
    const rail = (pts) => {
      for (const [xl, z] of pts) { const y0 = bulH(z); if (y0 < 1.3) cyl('deco', 0.035, 0.035, 1.37 - y0, CHROME, X(xl), (y0 + 1.37) / 2, z, 6); }
      for (let i = 0; i < pts.length - 1; i++) {
        tube('gold', [X(pts[i][0]), 1.37, pts[i][1]], [X(pts[i + 1][0]), 1.37, pts[i + 1][1]], 0.04, GOLD);
        const ya = (bulH(pts[i][1]) + 1.37) / 2, yb = (bulH(pts[i + 1][1]) + 1.37) / 2;
        if (ya < 1.15 && yb < 1.15) tube('deco', [X(pts[i][0]), ya, pts[i][1]], [X(pts[i + 1][0]), yb, pts[i + 1][1]], 0.025, CHROME);
      }
    };
    const edge = (sx, z0, z1) => { const p = []; for (let z = z0; z <= z1 + 1e-6; z += 1.5) p.push([sx * (halfAt(z) - 0.2), z]); if (p[p.length - 1][1] !== z1) p.push([sx * (halfAt(z1) - 0.2), z1]); return p; };
    rail(edge(-1, STERN + 0.35, BOW - 1.6));
    rail(edge(1, STERN + 0.35, GATE_BOAT[0])); rail(edge(1, GATE_BOAT[1], GATE_BRIDGE[0])); rail(edge(1, GATE_BRIDGE[1], BOW - 1.6));
    rail([[-HALF + 0.2, STERN + 0.35], [HALF - 0.2, STERN + 0.35]]);
    rail([[-(halfAt(BOW - 1.6) - 0.2), BOW - 1.6], [0, BOW - 0.45], [halfAt(BOW - 1.6) - 0.2, BOW - 1.6]]);
    for (const z of [-19, -16]) cyl('deco', 0.22, 0.22, 0.95, '#eef2f6', X(HALF + 0.12), -1.0, z, 12);   // odbijacze
    cyl('glow', 0.08, 0.08, 0.12, s < 0 ? '#ff3a3a' : '#3aff7a', X(-SAL.x - 0.36), SAL.h + 0.3, SAL.z1 + 0.3, 8);   // światło pozycyjne
    for (let z = STERN + 2; z < TAPER; z += 3) for (const sx of [-1, 1]) cyl('glow', 0.05, 0.05, 0.02, '#ffe7b0', X(sx * (HALF - 0.4)), 0.035, z, 8);
  }
  yacht(-1); yacht(1);

  // ---------- motorówka między rufami: mahoniowa, w stylu klasycznej łodzi motorowej, dziób w stronę jachtu B ----------
  {
    const z0 = BOAT.z0, z1 = BOAT.z1, zc = (z0 + z1) / 2, W = (z1 - z0) / 2, XA = -BOAT.x - 0.1, XB = BOAT.x + 0.1;
    const lv = [[0.75, 1], [0.05, 1, MAHO], [-0.5, 0.97, NAVY], [-1.2, 0.92, NAVY], [-1.35, 0.85, GOLD], [-2.2, 0.3, ANTIFOUL]];
    const wAt = (x, k) => { const u = (x - XA) / (XB - XA); return W * k * (u > 0.7 ? Math.sqrt(Math.max(0, 1 - ((u - 0.7) / 0.3) ** 2)) : 1); };
    const xs = []; for (let x = XA; x < XB - 1e-6; x += 0.5) xs.push(x); xs.push(XB);
    for (let i = 0; i < xs.length - 1; i++) for (let l = 0; l < lv.length - 1; l++) for (const sz of [-1, 1]) {
      const a = xs[i], b = xs[i + 1], [ya, ka] = lv[l], [yb, kb, col] = lv[l + 1];
      quad(col === GOLD ? 'gold' : 'hit', [a, ya, zc + sz * wAt(a, ka)], [b, ya, zc + sz * wAt(b, ka)], [b, yb, zc + sz * wAt(b, kb)], [a, yb, zc + sz * wAt(a, kb)], col);
    }
    for (let i = 0; i < xs.length - 1; i++) {                // pokład z lakierowanego mahoniu z jasnymi spoinami
      const a = xs[i], b = xs[i + 1], wa = wAt(a, 1) - 0.22, wb = wAt(b, 1) - 0.22; if (wa <= 0 && wb <= 0) continue;
      for (let k = -4; k < 4; k++) { const f0 = k / 4 + 0.01, f1 = (k + 1) / 4 - 0.01;
        quad('floor', [a, 0.03, zc + wa * f0], [a, 0.03, zc + wa * f1], [b, 0.03, zc + wb * f1], [b, 0.03, zc + wb * f0], k % 2 ? MAHO : MAHO2); }
      quad('floor', [a, 0.02, zc - wa], [a, 0.02, zc + wa], [b, 0.02, zc + wb], [b, 0.02, zc - wb], CREAM);
    }
    for (const b of BOAT_COVER.slice(0, 2)) { boxAB('hit', MAHO, b[0], 0, b[2], b[3], b[4], b[5]); boxAB('gold', GOLD, b[0], b[4], b[2] - 0.02, b[3], b[4] + 0.04, b[5] + 0.02); }
    { const c = BOAT_COVER[2]; boxAB('hit', MAHO, c[0], 0, c[2], c[3], 1.0, c[5]); boxAB('hit', CREAM, c[0] + 0.1, 1.0, c[2] + 0.05, c[3] - 0.1, 1.05, c[5] - 0.05);
      push('glass', new THREE.BoxGeometry(0.05, 0.5, c[5] - c[2] + 0.2), GLASS, M4(c[3] + 0.05, 1.28, (c[2] + c[5]) / 2, 0, 0, 0.5));
      tube('gold', [c[3] + 0.1, 1.05, c[2] - 0.1], [c[3] - 0.15, 1.53, c[2] - 0.1], 0.025, GOLD); tube('gold', [c[3] + 0.1, 1.05, c[5] + 0.1], [c[3] - 0.15, 1.53, c[5] + 0.1], 0.025, GOLD);
      cyl('gold', 0.2, 0.2, 0.04, GOLD, c[0] + 0.2, 1.2, zc, 14, 0, 0, Math.PI / 2 - 0.4); }
    for (const x of [-4.5, 3.5]) { boxAB('deco', CREAM, x - 0.9, 0.03, zc - 0.55, x + 0.9, 0.45, zc + 0.55); boxAB('deco', NAVY2, x - 0.9, 0.45, zc - 0.56, x + 0.9, 0.5, zc + 0.56); }
    for (const dz of [-0.6, 0.6]) { boxAB('deco', '#11151c', XA - 0.6, -1.2, zc + dz - 0.25, XA - 0.05, 0.3, zc + dz + 0.25); boxAB('gold', GOLD, XA - 0.61, 0.05, zc + dz - 0.26, XA - 0.04, 0.15, zc + dz + 0.26); }
    tube('gold', [XB - 1.2, 0.8, zc], [XB + 0.1, 0.85, zc], 0.03, GOLD);
  }

  // ---------- trap między dziobami: tek na aluminiowej kratownicy, złote poręcze, dwa pływaki, lampki ----------
  {
    const z0 = GATE_BRIDGE[0], z1 = GATE_BRIDGE[1], zc = (z0 + z1) / 2, xe = CX - halfAt(zc) + 0.25;
    for (let x = -xe; x < xe - 1e-6; x += 0.4) boxAB('floor', Math.round((x + xe) / 0.4) % 2 ? TEAK : TEAK2, x + 0.01, -0.06, z0 + 0.1, Math.min(x + 0.4, xe) - 0.01, 0.04, z1 - 0.1);
    boxAB('deco', '#8a96a2', -xe, -0.6, z0 + 0.1, xe, -0.06, z0 + 0.28); boxAB('deco', '#8a96a2', -xe, -0.6, z1 - 0.28, xe, -0.06, z1 - 0.1);
    for (const z of [z0 + 0.18, z1 - 0.18]) {
      const pts = []; for (let x = -xe; x < xe - 1e-6; x += 1.4) pts.push(x); pts.push(xe);
      for (const x of pts) cyl('deco', 0.04, 0.04, 1.15, CHROME, x, 0.62, z, 6);
      tube('gold', [-xe, 1.2, z], [xe, 1.2, z], 0.04, GOLD); tube('deco', [-xe, 0.62, z], [xe, 0.62, z], 0.025, CHROME);
      for (let i = 0; i < pts.length - 1; i++) tube('deco', [pts[i], 0.08, z], [pts[i + 1], 1.15, z], 0.022, CHROME);
    }
    for (const x of [-3.2, 3.2]) { cyl('deco', 0.7, 0.7, 3.2, WHITE, x, WL + 0.3, zc, 14, Math.PI / 2); cyl('gold', 0.72, 0.72, 0.25, GOLD, x, WL + 0.3, zc, 14, Math.PI / 2); cyl('deco', 0.1, 0.1, 1.9, '#8a96a2', x, -1.05, zc, 6); }
    for (let x = -xe + 0.5; x < xe; x += 0.8) push('glow', new THREE.IcosahedronGeometry(0.07, 0), Math.round(x * 2) % 3 ? '#ffe2a0' : '#fff6dc', M4(x, 1.75 - 0.25 * Math.cos((x / xe) * Math.PI / 2), zc));
    tube('deco', [-xe, 1.75, zc], [xe, 1.75, zc], 0.008, '#30343c');
  }

  // ---------- siatki: hit/floor zatrzymują kule (jak kolizje na serwerze); kadłub pod pokładem, ozdoby, szkło i światła – nie ----------
  const solid = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.5, metalness: 0.05, side: THREE.DoubleSide });
  const hullM = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.22, metalness: 0.1, side: THREE.DoubleSide });
  const chrome = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.25, metalness: 0.55, side: THREE.DoubleSide });
  const gold = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.3, metalness: 0.55, side: THREE.DoubleSide, emissive: '#b07a10', emissiveIntensity: 0.32 });   // ciepłe, jasne złoto (przy pełnym metalu odbijało niebieskie niebo)
  const glass = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.7, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false });
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true });
  const add = (key, mat, name, o = {}) => { if (!kits[key]) return; const m = new THREE.Mesh(merge(kits[key]), mat); m.name = name; m.castShadow = o.cast !== false; m.receiveShadow = true; if (o.noHit) m.userData.noHit = true; if (o.order) m.renderOrder = o.order; root.add(m); return m; };
  add('floor', solid, 'floor_jachty');
  add('hit', solid, 'jachty_bryly');
  add('hull', hullM, 'kadlub', { noHit: true });
  add('deco', chrome, 'jachty_ozdoby', { noHit: true });
  add('gold', gold, 'jachty_zloto', { noHit: true });
  add('glass', glass, 'jachty_szyby', { noHit: true, cast: false, order: 2 });
  add('glow', glow, 'jachty_lampki', { noHit: true, cast: false });
  return root;
}
