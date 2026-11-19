// Mapa 1v1 „Salon” (w kodzie i na serwerze meczów dalej pod nazwą "Baza", żeby nie zmieniać serwera; nazwa w grze: lobby-ui.js).
// Wielka hala salonu luksusowych aut w klimacie Vice City (wieczór, neony, pastele). Akcja toczy się w środku, między autami:
//  • środek hali: salon z błyszczącą posadzką, auta sportowe na wystawie, obrotowa platforma z „gwiazdą” salonu, recepcja
//    przy wejściu, przeszklona ściana od strony parkingu i ulicy, filary z neonami;
//  • oba końce hali: serwis (tu startują gracze) – auto na podnośniku, regał z oponami, skrzynie, beczki, stół warsztatowy;
//  • wzdłuż ściany zachodniej pokoje: szatnia z szafkami (rząd szafek na środku, za którym można się schować), biuro sprzedaży
//    z oknami na salon, poczekalnia z kanapami i ekspresem oraz wspólny gabinet kierownika („Finanse”) pośrodku.
// Mapa jest lustrzana względem osi Z = 0: obaj gracze mają takie samo zaplecze; gabinet, platforma i recepcja są wspólne.
// Kolizje i model powstają z tego samego opisu niżej, więc serwer (czyta tylko MAP) i grafika zawsze się zgadzają;
// kule w przeglądarce trafiają w niewidzialną siatkę z tych samych pudełek, którymi liczy serwer. Szyby w oknach pokoi
// przepuszczają kule (jak na serwerze, gdzie okno to otwór); szyba frontowa salonu to pełna ściana (za nią jest już parking).
// Plik nie importuje three.js (serwer go wczytuje w Node) – model buduje build(THREE); niebo, ulica i miasto są w klimaty.js.

export const HALL = { X0: -20, X1: 20, Z: 28, T: 0.4, H: 9, GLASS: 19 };
const { X0, X1, Z: ZE, T: WT, H: HH } = HALL;
const RX = -12.25, RXE = -12;                 // ściana pokoi od strony salonu
const RH = 3.2, SILL = 1.0, LINTEL = 2.3, FASCIA = 4.2;
const PZ = [-19.2, -18.8], PH = 4.2;          // ściana działowa serwis | salon (po stronie B lustrzanie)
export const TT = { x: 3, z: 0, r: 4, h: 0.3 };   // obrotowa platforma z autem
const r3 = (v) => Math.round(v * 1000) / 1000;
const C = { show: '#f1ecf4', serv: '#9a94aa', lock: '#9fc6d8', office: '#f3d9c4', lounge: '#f6c6d8', boss: '#e8dcc0' };

// ---------- opis hali: [rodzaj, pudełko x0,y0,z0,x1,y1,z1, opcje]; both() dodaje też lustrzane odbicie po stronie B ----------
const PARTS = [];
const FLIP = { '+z': '-z', '-z': '+z', '+x': '+x', '-x': '-x' };
// siedziska (kanapy, fotele): siedzisko 0,45 m (da się na nie wejść) i oparcie od strony przeciwnej do kierunku siedzenia
function seatCols(b, face, back = 0.22) {
  const [x0, , z0, x1, y1, z1] = b;
  const bk = face === '+z' ? [x0, 0, z0, x1, y1, z0 + back] : face === '-z' ? [x0, 0, z1 - back, x1, y1, z1]
    : face === '+x' ? [x0, 0, z0, x0 + back, y1, z1] : [x1 - back, 0, z0, x1, y1, z1];
  return [[x0, 0, z0, x1, 0.45, z1], bk];
}
const add = (k, b, o = {}) => {
  b = b.map(r3);
  if (k === 'sofa' || k === 'chair') o.cols = seatCols(b, o.face);
  PARTS.push({ k, b, o });
};
const both = (k, b, o = {}) => {
  add(k, b, { ...o, s: -1 });
  const m = { ...o, s: 1 };
  if (o.face) m.face = Array.isArray(o.face) ? o.face.map((f) => FLIP[f]) : FLIP[o.face];
  if (o.ax === 'x' && o.c2) { m.c = o.c2; m.c2 = o.c; }        // ściana wzdłuż X: kolory stron zamieniają się
  add(k, [b[0], b[1], -b[5], b[3], b[4], -b[2]], m);
};
// ściana z otworami: s = pełna, w = okno (parapet + nadproże), d = drzwi (nadproże), o = przejazd (nadproże od o.hdr)
function wallRun(ax, c0, c1, segs, h, o, mirror = true) {
  const put = mirror ? both : add;
  for (const [a0, a1, t] of segs) {
    const mk = (y0, y1, part) => put('wall', ax === 'x' ? [a0, y0, c0, a1, y1, c1] : [c0, y0, a0, c1, y1, a1], { ...o, ax, t, part });
    if (t === 's') mk(0, h, 'full');
    else if (t === 'w') { mk(0, SILL, 'sill'); mk(LINTEL, h, 'top'); }
    else if (t === 'd') mk(LINTEL, h, 'top');
    else if (t === 'o' && o.hdr) mk(o.hdr, h, 'top');
  }
}

// ściany zewnętrzne
add('outer', [X0 - WT, 0, -ZE - WT, X0, HH, ZE + WT], { side: 'W' });
add('outer', [X1, 0, -ZE - WT, X1 + WT, HH, ZE + WT], { side: 'E' });
add('outer', [X0, 0, -ZE - WT, X1, HH, -ZE], { side: 'S' });
add('outer', [X0, 0, ZE, X1, HH, ZE + WT], { side: 'N' });
add('roof', [X0 - WT, HH, -ZE - WT, X1 + WT, HH + 0.25, ZE + WT]);   // dach: tylko kolizja (model w build), strzał w sufit zostawia ślad
// ściana działowa serwis | salon: dwa przejazdy po 4 m, gracz startuje za pełnym środkowym odcinkiem
wallRun('x', PZ[0], PZ[1], [[RXE, -7, 's'], [-7, -3, 'o'], [-3, 9, 's'], [9, 13, 'o'], [13, X1, 's']], PH, { c: C.serv, c2: C.show, hdr: 3.4, kind: 'part' });
// pokoje przy ścianie zachodniej
wallRun('z', RX, RXE, [[-ZE, -26.6, 's'], [-26.6, -25, 'd'], [-25, -23.6, 's'], [-23.6, -20.6, 'w'], [-20.6, PZ[0], 's']], RH, { c: C.lock, c2: C.serv });          // szatnia | serwis
wallRun('x', PZ[0], PZ[1], [[X0, -16, 's'], [-16, -14.6, 'd'], [-14.6, RX, 's']], RH, { c: C.lock, c2: C.office });                                              // szatnia | biuro
wallRun('z', RX, RXE, [[PZ[0], -17.6, 's'], [-17.6, -14.6, 'w'], [-14.6, -13.2, 'd'], [-13.2, -11.2, 'w'], [-11.2, -10, 's']], RH, { c: C.office, c2: C.show });  // biuro | salon
wallRun('x', -10.25, -10, [[X0, -14.4, 's'], [-14.4, -13, 'd'], [-13, RX, 's']], RH, { c: C.office, c2: C.lounge });                                            // biuro | poczekalnia
wallRun('x', -5, -4.75, [[X0, -15.2, 's'], [-15.2, -13.8, 'd'], [-13.8, RX, 's']], RH, { c: C.lounge, c2: C.boss });                                            // poczekalnia | gabinet
wallRun('z', RX, RXE, [[-5, -3.4, 's'], [-3.4, -1, 'w'], [-1, 1, 'd'], [1, 3.4, 'w'], [3.4, 5, 's']], RH, { c: C.boss, c2: C.show }, false);                     // gabinet | salon (wspólny)
add('fascia', [RX, RH, -ZE, RXE, FASCIA, ZE]);           // pas z neonami nad pokojami (od strony salonu)
add('ceil', [X0, RH, -ZE, RXE, RH + 0.2, ZE]);           // strop pokoi
// salon: filary, platforma, recepcja, donice z palmami
for (const x of [-5, 11]) { both('col', [x - 0.5, 0, -10.5, x + 0.5, HH, -9.5]); add('col', [x - 0.5, 0, -0.5, x + 0.5, HH, 0.5]); }
add('tt', [TT.x - 3.7, 0, -1.6, TT.x + 3.7, TT.h, 1.6], { draw: true });   // okrągła platforma = trzy nachodzące pudełka
add('tt', [TT.x - 1.6, 0, -3.7, TT.x + 1.6, TT.h, 3.7]);
add('tt', [TT.x - 2.9, 0, -2.9, TT.x + 2.9, TT.h, 2.9]);
add('recep', [15.6, 0, -2.2, 16.8, 1.1, 2.2]);
both('pot', [18.6, 0, -18.6, 19.6, 0.8, -17.6]);
both('pot', [18.6, 0, -11, 19.6, 0.8, -10]);
both('pot', [18.6, 0, -4, 19.6, 0.8, -3]);
both('pot', [-11.6, 0, -18.6, -10.8, 0.8, -17.8]);
both('pot', [-11.5, 0, -10.6, -10.3, 0.85, -9.4]);
// osłony na długich przejściach między serwisami (żeby z jednego przejazdu nie było czystego strzału do drugiego)
both('kiosk', [7.8, 0, -6, 9.2, 1.15, -5.2]);              // stojak z broszurami i ekranem
both('rims', [-3.9, 0, -6.4, -2.7, 1.6, -5.4]);            // wieża z felgami
add('pylon', [12.6, 0, -0.6, 14.2, 2.6, 0.6]);             // biały pylon z logo salonu
// serwis (strefa startu)
both('work', [-4.5, 0, -ZE, -0.5, 0.95, -27.2]);
both('tool', [7, 0, -ZE, 8.6, 1.1, -27.35]);
both('tires', [-9.6, 0, -23, -8.8, 1.2, -22.2], { n: 5 });
both('tires', [-8.6, 0, -23.6, -7.8, 0.72, -22.8], { n: 3 });
both('drum', [-11.7, 0, -27.9, -11.1, 0.9, -27.3], { c: '#2f5aa8' });
both('drum', [-11, 0, -27.9, -10.4, 0.9, -27.3], { c: '#e3233a' });
both('crate', [-2.4, 0, -22.6, -0.6, 1.15, -21.4]);
both('engine', [9.4, 0, -26.2, 10.2, 1.0, -25.4]);
both('rack', [19.4, 0, -27, X1, 2.0, -21]);
both('lpost', [12.95, 0, -24.25, 13.45, 2.9, -23.75], { dir: 1 });
both('lpost', [16.55, 0, -24.25, 17.05, 2.9, -23.75], { dir: -1 });
// szatnia: szafki pod ścianami i podwójny rząd na środku (chowanie się), ławka
both('locker', [X0, 0, -27.45, -19.45, 2, -19.6], { face: ['+x'] });
both('locker', [-19.45, 0, -ZE, -14.6, 2, -27.45], { face: ['+z'] });
both('locker', [-17.4, 0, -25.6, -16.4, 2, -21], { face: ['+x', '-x'] });
both('lbench', [-16.4, 0, -25, -15.8, 0.45, -21.6]);
// biuro sprzedaży
both('desk', [-17.6, 0, -15.4, -15.2, 0.78, -14.4], { face: '+x' });
both('files', [X0, 0, -18.6, -19.45, 1.35, -16.6], { face: '+x' });
both('shelf', [X0, 0, -13.8, -19.6, 2.2, -10.6], { face: '+x' });
both('sofa', [-18.6, 0, -11.05, -15.8, 0.8, -10.25], { face: '-z', c: '#2fb6c6' });
both('pot', [-13.1, 0, -18.6, -12.5, 0.7, -18]);
// poczekalnia (otwarta na salon)
both('counter', [X0, 0, -9.8, -19.3, 1, -5.4], { face: '+x' });
both('sofa', [-17.8, 0, -9.95, -15, 0.8, -9.15], { face: '+z', c: '#ff6fa8' });
both('ctable', [-17, 0, -7.9, -15.6, 0.42, -6.9]);
both('chair', [-14.6, 0, -7.8, -13.8, 0.75, -7], { face: '-x', c: '#ff6fa8' });
both('vend', [-19.1, 0, -5.75, -18.2, 1.9, -5], { face: '-z' });
// gabinet kierownika (wspólny, pośrodku)
add('desk', [-17.4, 0, -1.5, -15.6, 0.8, 1.5], { face: '+x', boss: true });
add('shelf', [X0, 0, -2.6, -19.6, 2.4, 2.6], { face: '+x' });
both('safe', [X0, 0, -4.75, -19.2, 1.3, -3.95], { face: '+x' });
both('chair', [-14.6, 0, -1.5, -13.9, 0.75, -0.7], { face: '-x', c: '#7a2a3c' });
both('vitrine', [-19, 0, -4.75, -17.6, 1.8, -4.3], { face: '+z' });

// ---------- auta: wymiary, profil boku (z, y) i kolizje (dół nadwozia + kabina) ----------
export const CAR_T = {
  super: { L: 4.6, W: 2.0, body: 0.8, roof: 1.12, cab: [-1.45, 0.85], cw: 1.6, wr: 0.36, axle: 1.42, head: 0.42, tail: 0.62, wing: true,
    low: [[-2.3, 0.24], [2.2, 0.24], [2.32, 0.34], [2.3, 0.48], [1.3, 0.7], [0.85, 0.8], [-1.45, 0.8], [-2.15, 0.8], [-2.3, 0.74], [-2.34, 0.5]],
    top: [[-1.45, 0.79], [0.85, 0.79], [0.25, 1.1], [-0.75, 1.12], [-1.3, 0.96]] },
  gt: { L: 4.6, W: 1.96, body: 0.86, roof: 1.25, cab: [-1.7, 0.95], cw: 1.6, wr: 0.35, axle: 1.45, head: 0.5, tail: 0.68, lip: true,
    low: [[-2.3, 0.26], [2.2, 0.26], [2.32, 0.4], [2.28, 0.58], [1.05, 0.82], [0.6, 0.86], [-1.5, 0.86], [-2.2, 0.86], [-2.32, 0.78], [-2.34, 0.5]],
    top: [[-1.7, 0.85], [0.95, 0.85], [0.3, 1.22], [-1.0, 1.25], [-1.55, 1.05]] },
  muscle: { L: 4.8, W: 1.98, body: 0.92, roof: 1.3, cab: [-1.6, 0.75], cw: 1.64, wr: 0.38, axle: 1.55, head: 0.66, tail: 0.7, duck: true, stripes: true, scoop: true,
    low: [[-2.4, 0.27], [2.32, 0.27], [2.42, 0.42], [2.42, 0.8], [0.85, 0.9], [0.75, 0.92], [-1.6, 0.92], [-2.35, 0.9], [-2.43, 0.82], [-2.44, 0.45]],
    top: [[-1.6, 0.91], [0.75, 0.91], [0.35, 1.28], [-1.25, 1.3], [-1.55, 1.02]] },
};
const YAW = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 };
export const CARS = [];
// c = lakier, a = dodatki (pasy, spoiler); mc/ma = kolory auta po stronie B
const carBoth = (c) => { CARS.push({ ...c, s: -1 }); CARS.push({ ...c, z: -c.z, d: FLIP[c.d], c: c.mc, a: c.ma, s: 1 }); };
carBoth({ t: 'gt', x: 16.5, z: -15, d: '+z', c: '#f4f2f6', a: '#2a5bff', mc: '#7a3cff', ma: '#ffd23f', price: '189 000' });
carBoth({ t: 'super', x: 16.5, z: -7, d: '-z', c: '#ffc82e', a: '#16141c', mc: '#ff7a2a', ma: '#16141c', price: '349 000' });
carBoth({ t: 'muscle', x: -8.5, z: -14.5, d: '+x', c: '#e3233a', a: '#f4f2f6', mc: '#7fc8ff', ma: '#f4f2f6', price: '74 500', glow: '#3ff0e0' });
carBoth({ t: 'super', x: 4, z: -13, d: '-x', c: '#19c3d6', a: '#ff3f9a', mc: '#9be22d', ma: '#16141c', price: '299 000' });
carBoth({ t: 'gt', x: -8.5, z: -5.2, d: '+z', c: '#18161f', a: '#f2c552', mc: '#f4f2f6', ma: '#e3233a', price: '215 000' });
carBoth({ t: 'muscle', x: 15, z: -24, d: '-z', y: 1.95, c: '#8a8796', a: '#3a3644', mc: '#2f5aa8', ma: '#f4f2f6', lift: true });
CARS.push({ t: 'super', x: TT.x, z: TT.z, d: '+x', y: TT.h, c: '#ff3f9a', a: '#f4f2f6', hero: true, glow: '#ff4fd8', price: '999 000' });
// auta na parkingu przed salonem: tylko wygląd (są za szybą, poza polem gry)
const LOT = [
  { t: 'gt', x: 27.5, z: -21, d: '-x', c: '#7fc8ff', a: '#f4f2f6' }, { t: 'muscle', x: 27.5, z: -12, d: '-x', c: '#ffc82e', a: '#16141c' },
  { t: 'super', x: 27.5, z: 12, d: '-x', c: '#f4f2f6', a: '#e3233a' }, { t: 'gt', x: 27.5, z: 24, d: '-x', c: '#ff7a2a', a: '#16141c' },
];

function carCols(c) {
  const T = CAR_T[c.t], y = c.y || 0, a = YAW[c.d], cs = Math.round(Math.cos(a)), sn = Math.round(Math.sin(a));
  const w = (lx, lz) => [c.x + lx * cs + lz * sn, c.z - lx * sn + lz * cs];
  const box = (x0, y0, z0, x1, y1, z1) => { const p = w(x0, z0), q = w(x1, z1); return [Math.min(p[0], q[0]), y + y0, Math.min(p[1], q[1]), Math.max(p[0], q[0]), y + y1, Math.max(p[1], q[1])].map(r3); };
  return [box(-T.W / 2, 0, -T.L / 2, T.W / 2, T.body, T.L / 2), box(-T.cw / 2, T.body, T.cab[0], T.cw / 2, T.roof, T.cab[1])];
}

const COLS = [];
for (const p of PARTS) for (const c of p.o.cols || [p.b]) COLS.push(c.map(r3));
for (const c of CARS) COLS.push(...carCols(c));

export const MAP = {
  name: 'Baza',
  spawns: [
    { name: 'Spawn_A', x: 3.5, y: 0, z: -25, yaw: Math.PI },   // serwis A, za pełnym odcinkiem ściany działowej, twarzą do salonu
    { name: 'Spawn_B', x: 3.5, y: 0, z: 25, yaw: 0 },
  ],
  colliders: COLS,
  clips: [],
  ladders: [],
  view: { pos: [44, 54, -31], look: [-1, 0, 1], fov: 46 },     // miniatura: z góry od strony parkingu (dach hali schowany)
};

// =====================================================================================================
//                                   MODEL (tylko w przeglądarce)
// =====================================================================================================
export function build(THREE) {
  const root = new THREE.Group(); root.name = 'Salon';
  const roofG = new THREE.Group(); roofG.name = 'Dach'; root.add(roofG);       // dach i stropy pokoi: bez cienia, schowane na miniaturze
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
  const boxAB = (key, col, x0, y0, z0, x1, y1, z1) => { if (x1 - x0 > 1e-4 && y1 - y0 > 1e-4 && z1 - z0 > 1e-4) box(key, x1 - x0, y1 - y0, z1 - z0, col, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); };
  const cyl = (key, rt, rb, h, col, x, y, z, seg = 10, rx = 0, ry = 0, rz = 0) => push(key, new THREE.CylinderGeometry(rt, rb, h, seg), col, M4(x, y, z, ry, rx, rz));
  const tube = (key, a, b, r, col, seg = 6) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length();
    push(key, new THREE.CylinderGeometry(r, r, len, seg), col, new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()), new THREE.Vector3(1, 1, 1)));
  };
  const tris = (key, pts, col) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3)); push(key, g, col); };
  const quad = (key, a, b, c, d, col) => tris(key, [a, b, c, a, c, d], col);
  const shade = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
  const FACE = { '+x': 'px', '-x': 'nx', '+z': 'pz', '-z': 'nz' };
  // prostokąt na ścianie bryły b: f = px|nx|pz|nz, zakres wzdłuż ściany [a0,a1] i wysokości [y0,y1], odsunięty o e
  const paint = (key, col, b, f, a0, a1, y0, y1, e = 0.006) => {
    if (a1 - a0 < 1e-4 || y1 - y0 < 1e-4) return;
    if (f === 'px' || f === 'nx') { const x = f === 'px' ? b[3] + e : b[0] - e; quad(key, [x, y0, a0], [x, y0, a1], [x, y1, a1], [x, y1, a0], col); }
    else { const z = f === 'pz' ? b[5] + e : b[2] - e; quad(key, [a0, y0, z], [a1, y0, z], [a1, y1, z], [a0, y1, z], col); }
  };
  const along = (b, f) => (f === 'px' || f === 'nx' ? [b[2], b[5]] : [b[0], b[3]]);
  let seed = 20261119; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // ---------- napisy i plakaty (canvas) – osobne siatki, kule ich nie widzą ----------
  const hasDoc = typeof document !== 'undefined';
  const flick = [];
  function canvasPlane(w, h, px, draw, { glow = true, add = false } = {}) {
    if (!hasDoc) return null;
    const cv = document.createElement('canvas'); cv.width = Math.max(8, Math.round(w * px)); cv.height = Math.max(8, Math.round(h * px));
    draw(cv.getContext('2d'), cv.width, cv.height);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const mat = glow ? new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending })
      : new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.05 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.userData.noHit = true; m.castShadow = false; m.receiveShadow = !glow; m.renderOrder = 2;
    return m;
  }
  const place = (m, x, y, z, ry, parent = root) => { if (m) { m.position.set(x, y, z); m.rotation.y = ry; parent.add(m); } return m; };
  const NEONF = 'italic 900 ${s}px Impact, "Arial Black", sans-serif';
  // napis neonowy: lines = [[tekst, kolor, wielkość 0..1]], wysokość h (m); szerokość wynika z tekstu
  function neon(lines, h, { frame = null, px = 150, pad = 0.35 } = {}) {
    if (!hasDoc) return null;
    const tmp = document.createElement('canvas').getContext('2d'), H = h * px, rows = lines.map(([t, c, s]) => [t, c, s * H / lines.reduce((a, l) => a + l[2], 0)]);
    let W = 0; for (const [t, , s] of rows) { tmp.font = NEONF.replace('${s}', Math.round(s * 0.82)); W = Math.max(W, tmp.measureText(t).width); }
    const w = (W + pad * px * 2) / px;
    const m = canvasPlane(w, h, px, (x, cw, ch) => {
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
      if (frame) { x.shadowColor = frame; x.shadowBlur = 18; x.strokeStyle = frame; x.lineWidth = 6; x.beginPath(); x.roundRect(10, 10, cw - 20, ch - 20, 22); x.stroke(); x.stroke(); }
      let y = 0;
      for (const [t, c, s] of rows) {
        x.font = NEONF.replace('${s}', Math.round(s * 0.82)); const cy = y + s / 2 + s * 0.04;
        x.shadowColor = c; x.shadowBlur = 24; x.strokeStyle = c; x.lineWidth = Math.max(4, s * 0.09); x.strokeText(t, cw / 2, cy); x.strokeText(t, cw / 2, cy);
        x.shadowBlur = 6; x.fillStyle = '#fff6fb'; x.fillText(t, cw / 2, cy); y += s;
      }
    });
    return m;
  }
  // plakat: tło z gradientem i paskami, duży napis i mniejszy podpis
  function poster(w, h, title, sub, c1, c2, { tc = '#ffffff' } = {}) {
    return canvasPlane(w, h, 120, (x, cw, ch) => {
      const g = x.createLinearGradient(0, 0, 0, ch); g.addColorStop(0, c1); g.addColorStop(1, c2); x.fillStyle = g; x.fillRect(0, 0, cw, ch);
      x.fillStyle = 'rgba(255,255,255,.18)'; for (let i = -ch; i < cw; i += 46) { x.beginPath(); x.moveTo(i, ch); x.lineTo(i + 22, ch); x.lineTo(i + 22 + ch * 0.6, 0); x.lineTo(i + ch * 0.6, 0); x.fill(); }
      x.strokeStyle = '#ffffff'; x.lineWidth = 8; x.strokeRect(8, 8, cw - 16, ch - 16);
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = tc; x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 10;
      let fs = ch * 0.42; x.font = NEONF.replace('${s}', Math.round(fs)); while (x.measureText(title).width > cw * 0.88 && fs > 10) { fs -= 4; x.font = NEONF.replace('${s}', Math.round(fs)); }
      x.fillText(title, cw / 2, ch * (sub ? 0.42 : 0.52));
      if (sub) { x.font = `700 ${Math.round(ch * 0.15)}px Barlow, Arial, sans-serif`; x.fillText(sub, cw / 2, ch * 0.77); }
    }, { glow: false });
  }
  function priceTag(price) {
    return canvasPlane(0.62, 0.36, 300, (x, cw, ch) => {
      x.fillStyle = '#16141c'; x.fillRect(0, 0, cw, ch); x.fillStyle = '#ff3f9a'; x.fillRect(0, 0, cw, ch * 0.28);
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#ffffff'; x.font = `800 ${Math.round(ch * 0.2)}px Barlow, Arial, sans-serif`; x.fillText('BEAN DELUXE', cw / 2, ch * 0.15);
      x.fillStyle = '#3ff0e0'; x.font = `italic 900 ${Math.round(ch * 0.36)}px Impact, "Arial Black", sans-serif`; x.fillText('$' + price, cw / 2, ch * 0.62);
      x.fillStyle = '#c9c1d3'; x.font = `700 ${Math.round(ch * 0.12)}px Barlow, Arial, sans-serif`; x.fillText('0% FINANCING', cw / 2, ch * 0.88);
    }, { glow: true });
  }
  // poświata (np. neon pod autem, obwódka platformy): radialny gradient dodawany do obrazu
  let haloTex = null;
  function halo(w, d, col, op = 0.8) {
    if (!hasDoc) return null;
    if (!haloTex) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
      const g = x.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128); haloTex = new THREE.CanvasTexture(cv);
    }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: haloTex, color: col, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.userData.noHit = true; m.castShadow = false; m.renderOrder = 1; return m;
  }

  // ================================= POSADZKA =================================
  const tile = (x0, z0, x1, z1, col, y = 0.002) => quad('floor', [x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], col);
  const tiles = (x0, z0, x1, z1, size, c1, c2, gap = 0.03, y = 0.002) => {
    const nx = Math.max(1, Math.round((x1 - x0) / size)), nz = Math.max(1, Math.round((z1 - z0) / size)), sx = (x1 - x0) / nx, sz = (z1 - z0) / nz;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) tile(x0 + i * sx + gap, z0 + j * sz + gap, x0 + (i + 1) * sx - gap, z0 + (j + 1) * sz - gap, (i + j) % 2 ? c1 : c2, y);
  };
  tile(X0, -ZE, X1, ZE, '#3a3448', 0);                                         // podkład (spoiny)
  tiles(RXE, PZ[1], X1, -PZ[1], 2, '#f2edf5', '#e3dcea');                       // salon: duże jasne płyty
  for (const s of [-1, 1]) {
    const Z = (a, b) => (s < 0 ? [a, b] : [-b, -a]);
    { const [z0, z1] = Z(-ZE, PZ[0]); tiles(RXE, z0, X1, z1, 3, '#7c768c', '#736d84', 0.02); }          // serwis: beton
    { const [z0, z1] = Z(-ZE, PZ[0]); tiles(X0, z0, RX, z1, 0.6, '#5f8fb0', '#567f9e', 0.012); }        // szatnia: płytki
    { const [z0, z1] = Z(PZ[1], -10.25); tile(X0, z0, RX, z1, '#2f6f78'); tile(X0 + 0.25, z0 + 0.25, RX - 0.25, z1 - 0.25, '#2a646c', 0.003); }   // biuro: wykładzina
    { const [z0, z1] = Z(-10, -5); for (let x = X0; x < RXE - 1e-6; x += 0.32) tile(x + 0.01, z0, Math.min(x + 0.32, RXE) - 0.01, z1, Math.round((x - X0) / 0.32) % 2 ? '#8a5a3c' : '#7a4e34'); }   // poczekalnia: deski
    // serwis: żółte linie (pas przejazdu, ramka stanowiska podnośnika) i ramka strefy startu
    const ln = (x0, za, x1, zb, col = '#f2c33a') => { const [z0, z1] = Z(za, zb); tile(x0, z0, x1, z1, col, 0.004); };
    ln(RXE + 0.4, -20.0, X1 - 0.4, -19.85); ln(12.3, -27.4, 12.45, -20.6); ln(17.55, -27.4, 17.7, -20.6); ln(12.3, -20.75, 17.7, -20.6); ln(12.3, -27.4, 17.7, -27.25);
    ln(1.3, -27.0, 5.7, -26.88, '#f4f2f6'); ln(1.3, -23.12, 5.7, -23.0, '#f4f2f6'); ln(1.3, -27.0, 1.42, -23.0, '#f4f2f6'); ln(5.58, -27.0, 5.7, -23.0, '#f4f2f6');
    for (const [x, z, r] of [[14.6, -23.6, 0.9], [-5.6, -24.4, 0.6], [9.2, -21.6, 0.5]]) { const [z0] = Z(z - r * 0.6, z + r * 0.6); tile(x - r, z0, x + r, z0 + r * 1.2, '#4e4960', 0.003); }   // plamy oleju
  }
  { tile(X0, -4.75, RX, 4.75, '#d8b44a'); tile(X0 + 0.18, -4.57, RX - 0.18, 4.57, '#6a2a3c', 0.003); }    // gabinet: bordowa wykładzina ze złotym brzegiem

  // ================================= ŚCIANY =================================
  const rollerDoor = (b, f, a0, a1, h) => {
    for (let y = 0; y < h - 1e-6; y += 0.24) paint('wall', Math.round(y / 0.24) % 2 ? '#b9b4c6' : '#a8a2b8', b, f, a0, a1, y, Math.min(y + 0.24, h), 0.012);
    paint('wall', '#3a3548', b, f, a0 - 0.18, a0, 0, h + 0.2, 0.02); paint('wall', '#3a3548', b, f, a1, a1 + 0.18, 0, h + 0.2, 0.02); paint('wall', '#3a3548', b, f, a0 - 0.18, a1 + 0.18, h, h + 0.25, 0.02);
    paint('chrome', '#d8dde6', b, f, (a0 + a1) / 2 - 0.3, (a0 + a1) / 2 + 0.3, 0.3, 0.38, 0.025);
  };
  const hazard = (b, f, a0, a1, y0, y1, e = 0.012) => { for (let a = a0, i = 0; a < a1 - 1e-6; a += 0.3, i++) paint('wall', i % 2 ? '#24202c' : '#f2c33a', b, f, a, Math.min(a + 0.3, a1), y0, y1, e); };
  function drawOuter(b, side) {
    const ext = { W: 'nx', E: 'px', S: 'nz', N: 'pz' }[side], inn = { W: 'px', E: 'nx', S: 'pz', N: 'nz' }[side], [A0, A1] = along(b, ext);
    const G = HALL.GLASS;
    if (side === 'E') {                                            // front: dwie pełne części przy serwisach, pośrodku witryna (rdzeń tylko pod i nad szybą)
      boxAB('wall', '#2c2836', b[0], 0, A0, b[3], HH, -G); boxAB('wall', '#2c2836', b[0], 0, G, b[3], HH, A1);
      boxAB('wall', '#2c2836', b[0], 6, -G, b[3], HH, G); boxAB('wall', '#2a2633', b[0] - 0.02, 0, -G, b[3] + 0.02, 0.3, G);
    } else boxAB('wall', '#2c2836', ...b);
    // na zewnątrz: cokół, blacha falista, ciemny pas z czerwonym i niebieskim neonem, biało-czerwono-niebieski pasek
    paint('wall', '#2a2633', b, ext, A0, A1, 0, 0.45);
    for (let a = A0, i = 0; a < A1 - 1e-6; a += 0.45, i++) {
      const a1 = Math.min(a + 0.45, A1); if (side === 'E' && a1 > -G && a < G) continue;
      paint('wall', i % 2 ? '#e4e0ea' : '#cdc8d8', b, ext, a, a1, 0.45, 6);
    }
    paint('wall', '#26222f', b, ext, A0, A1, 6, HH);
    paint('glow', '#ff2b4f', b, ext, A0, A1, 6.0, 6.24, 0.03); paint('glow', '#3b6bff', b, ext, A0, A1, 8.7, 8.92, 0.03);
    paint('wall', '#f4f2f6', b, ext, A0, A1, 5.62, 5.72, 0.02); paint('wall', '#e3233a', b, ext, A0, A1, 5.72, 5.82, 0.02); paint('wall', '#2a5bff', b, ext, A0, A1, 5.82, 5.92, 0.02);
    boxAB('wall', '#d9d4e2', b[0] - 0.05, HH, b[2] - 0.05, b[3] + 0.05, HH + 0.12, b[5] + 0.05);
    // w środku
    if (side === 'W') {
      for (const s of [-1, 1]) for (const [za, zb, col] of [[-ZE, -19, C.lock], [-19, -10.1, C.office], [-10.1, -4.9, C.lounge]]) { const z0 = s < 0 ? za : -zb, z1 = s < 0 ? zb : -za; paint('wall', col, b, inn, z0, z1, 0, RH); paint('wall', shade(col, 0.55), b, inn, z0, z1, 0, 0.12, 0.012); }
      paint('wall', C.boss, b, inn, -4.9, 4.9, 0, RH); paint('wall', '#7a4e34', b, inn, -4.9, 4.9, 0, 1.0, 0.012);
      paint('wall', C.show, b, inn, A0, A1, RH, HH);
    } else if (side === 'E') {
      for (const [za, zb] of [[A0, -G], [G, A1]]) { paint('wall', C.serv, b, inn, za, zb, 0, HH); hazard(b, inn, za, zb, 0, 0.3); }
      paint('wall', C.show, b, inn, -G, G, 6, HH);
    } else {
      paint('wall', C.lock, b, inn, X0, RX, 0, RH); paint('wall', shade(C.lock, 0.55), b, inn, X0, RX, 0, 0.12, 0.012); paint('wall', C.serv, b, inn, X0, RX, RH, HH);
      paint('wall', C.serv, b, inn, RXE, X1, 0, HH); hazard(b, inn, RXE, X1, 0, 0.3);
      for (const [a0, a1] of [[-9.5, -5.5], [12.5, 17.5]]) { rollerDoor(b, inn, a0, a1, 4.2); rollerDoor(b, ext, a0, a1, 4.2); }
      paint('wall', '#f2c33a', b, ext, -9.5, -5.5, 4.45, 4.6, 0.03);
    }
    paint('glow', '#ff2b4f', b, inn, A0, A1, 8.25, 8.4, 0.02); paint('glow', '#3b6bff', b, inn, A0, A1, 8.5, 8.65, 0.02);
  }

  // witryna: szyba, słupki, rygiel, drzwi wejściowe
  {
    const G = HALL.GLASS, x = X1 + WT / 2;
    boxAB('glass', '#9fd3ff', x - 0.03, 0.3, -G, x + 0.03, 6, G);
    const n = 12; for (let k = 0; k <= n; k++) { const z = -G + (k * 2 * G) / n; boxAB('chrome', '#c9c6d4', X1 - 0.04, 0.3, z - 0.08, X1 + WT + 0.04, 6, z + 0.08); }
    boxAB('chrome', '#c9c6d4', X1 - 0.03, 2.9, -G, X1 + WT + 0.03, 3.04, G);
    boxAB('chrome', '#c9c6d4', X1 - 0.05, 5.9, -G, X1 + WT + 0.05, 6.02, G);
    for (const z of [-1.6, -0.03, 1.6]) boxAB('chrome', '#8f8aa0', X1 - 0.06, 0.3, z - 0.07, X1 + WT + 0.06, 2.9, z + 0.07);
    for (const s of [-1, 1]) for (const xx of [X1 - 0.12, X1 + WT + 0.12]) boxAB('chrome', '#e8ecf2', xx - 0.025, 0.9, s * 0.25 - 0.025, xx + 0.025, 1.9, s * 0.25 + 0.025);
    const open = place(neon([['OPEN', '#ff2b4f', 1]], 0.55, { frame: '#3b6bff', px: 160, pad: 0.2 }), X1 - 0.05, 2.35, -3.5, -Math.PI / 2); if (open) flick.push(open);
  }

  function drawWall(b, o) {
    const fa = o.ax === 'x' ? 'nz' : 'nx', fb = o.ax === 'x' ? 'pz' : 'px', [a0, a1] = along(b, fa);
    boxAB('wall', o.c, ...b);
    if (o.c2) paint('wall', o.c2, b, fb, a0, a1, b[1], b[4]);
    if (b[1] === 0 && o.kind !== 'part') for (const [f, col] of [[fa, o.c], [fb, o.c2 || o.c]]) paint('wall', shade(col, 0.55), b, f, a0, a1, 0, 0.12, 0.012);
    if (o.part === 'sill') {                                       // okno: biały parapet i szyba (kule przez nią przelatują)
      const ex = o.ax === 'z' ? 0.07 : 0, ez = o.ax === 'x' ? 0.07 : 0;
      boxAB('shiny', '#f7f4fa', b[0] - ex, SILL, b[2] - ez, b[3] + ex, SILL + 0.05, b[5] + ez);
      if (o.ax === 'z') { const x = (b[0] + b[3]) / 2; boxAB('glass', '#9fd3ff', x - 0.015, SILL + 0.05, b[2], x + 0.015, LINTEL, b[5]); }
      else { const z = (b[2] + b[5]) / 2; boxAB('glass', '#9fd3ff', b[0], SILL + 0.05, z - 0.015, b[3], LINTEL, z + 0.015); }
    }
    if (o.part === 'top' && (o.t === 'd' || o.t === 'w')) {         // ościeżnica drzwi / rama okna
      const ex = o.ax === 'z' ? 0.03 : 0, ez = o.ax === 'x' ? 0.03 : 0;
      boxAB('wall', o.t === 'd' ? '#4a3a5a' : '#f7f4fa', b[0] - ex, LINTEL - 0.06, b[2] - ez, b[3] + ex, LINTEL, b[5] + ez);
      if (o.t === 'd') for (const a of [a0, a1]) { const p = o.ax === 'x' ? [a - 0.05, 0, b[2] - 0.03, a + 0.05, LINTEL, b[5] + 0.03] : [b[0] - 0.03, 0, a - 0.05, b[3] + 0.03, LINTEL, a + 0.05]; boxAB('wall', '#4a3a5a', ...p); }
    }
    if (o.kind === 'part') {
      const sv = o.s < 0 ? fa : fb, sh = o.s < 0 ? fb : fa;          // strona serwisu / strona salonu
      if (b[1] === 0) hazard(b, sv, a0, a1, 0, 0.3);
      else { hazard(b, sv, a0, a1, b[1], b[1] + 0.25); hazard(b, sh, a0, a1, b[1], b[1] + 0.25); }
      if (b[1] === 0) paint('wall', '#d8d0e0', b, sh, a0, a1, 0, 0.15, 0.012);
      paint('glow', '#ff2b4f', b, sh, a0, a1, 3.75, 3.87, 0.015); paint('glow', '#3b6bff', b, sh, a0, a1, 3.95, 4.07, 0.015);
    }
  }

  // ================================= MEBLE I SPRZĘT =================================
  const D = {
    outer: (b, o) => drawOuter(b, o.side),
    wall: drawWall,
    fascia(b) {
      boxAB('wall', '#26222f', ...b);
      paint('glow', '#ff2b4f', b, 'px', b[2], b[5], 3.28, 3.4, 0.015); paint('glow', '#3b6bff', b, 'px', b[2], b[5], 4.02, 4.14, 0.015);
    },
    ceil(b) {
      push('roofS', new THREE.BoxGeometry(b[3] - b[0], b[4] - b[1], b[5] - b[2]), '#ece6f0', M4((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2));
      for (const z of [-23.5, -14.5, -7.5, 0, 7.5, 14.5, 23.5]) for (const x of [-18, -14.6]) push('roofG', new THREE.BoxGeometry(1.4, 0.03, 0.5), '#fff4e6', M4(x, RH - 0.02, z));
    },
    col(b) {
      boxAB('wall', '#f4f0f7', ...b);
      boxAB('wall', '#2a2633', b[0] - 0.06, 0, b[2] - 0.06, b[3] + 0.06, 0.32, b[5] + 0.06);
      for (const [y, c] of [[2.5, '#ff4fd8'], [2.72, '#3ff0e0'], [6.3, '#ff4fd8'], [6.52, '#3ff0e0']]) boxAB('glow', c, b[0] - 0.03, y, b[2] - 0.03, b[3] + 0.03, y + 0.09, b[5] + 0.03);
    },
    tt(b, o) {
      if (!o.draw) return;
      const { x, z, r, h } = TT;
      cyl('shiny', r, r, h - 0.04, '#1e1b26', x, (h - 0.04) / 2, z, 40);
      cyl('shiny', r - 0.04, r - 0.04, 0.04, '#2c2838', x, h - 0.02, z, 40);
      cyl('glow', r + 0.015, r + 0.015, 0.06, '#ff4fd8', x, 0.14, z, 40);
      push('glow', new THREE.RingGeometry(r - 0.35, r - 0.25, 40).rotateX(-Math.PI / 2), '#3ff0e0', M4(x, h + 0.004, z));
      push('glow', new THREE.RingGeometry(r - 1.9, r - 1.84, 40).rotateX(-Math.PI / 2), '#ff4fd8', M4(x, h + 0.004, z));
      place(halo(r * 2.9, r * 2.9, '#ff4fd8', 0.55), x, 0.01, z, 0);
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; cyl('chrome', 0.08, 0.1, 0.06, '#e8ecf2', x + Math.cos(a) * (r + 0.6), 0.03, z + Math.sin(a) * (r + 0.6), 8); cyl('glow', 0.05, 0.05, 0.3, '#fff2fb', x + Math.cos(a) * (r + 0.6), 0.2, z + Math.sin(a) * (r + 0.6), 6); }
    },
    recep(b) {
      boxAB('shiny', '#f6f3f8', b[0], 0, b[2], b[3], 1.02, b[5]);
      boxAB('shiny', '#2a2633', b[0] - 0.12, 1.02, b[2] - 0.08, b[3] + 0.1, 1.1, b[5] + 0.08);
      boxAB('glow', '#ff4fd8', b[3] + 0.005, 0.08, b[2], b[3] + 0.02, 0.16, b[5]); boxAB('glow', '#3ff0e0', b[3] + 0.005, 0.92, b[2], b[3] + 0.02, 0.98, b[5]);
      for (const z of [-1.1, 1.1]) { boxAB('wall', '#16141c', b[0] + 0.25, 1.1, z - 0.3, b[0] + 0.3, 1.5, z + 0.3); paint('glow', '#7fd8ff', [b[0] + 0.25, 1.14, z - 0.26, b[0] + 0.3, 1.46, z + 0.26], 'nx', z - 0.26, z + 0.26, 1.14, 1.46, 0.006); }
      cyl('chrome', 0.07, 0.09, 0.08, '#f2c552', b[0] + 0.7, 1.14, 0.2, 10);
      place(neon([['WELCOME', '#ff4fd8', 1]], 0.34, { px: 200, pad: 0.12 }), b[3] + 0.03, 0.55, (b[2] + b[5]) / 2, Math.PI / 2);
    },
    pot(b) {
      const cx = (b[0] + b[3]) / 2, cz = (b[2] + b[5]) / 2, h = b[4];
      boxAB('shiny', '#f4efea', ...b); boxAB('wall', '#ff4fd8', b[0] - 0.01, h - 0.12, b[2] - 0.01, b[3] + 0.01, h - 0.06, b[5] + 0.01); boxAB('wall', '#4a3428', b[0] + 0.06, h - 0.02, b[2] + 0.06, b[3] - 0.06, h + 0.005, b[5] - 0.06);
      palm(cx, h, cz, 2.2 + rand() * 0.8);
    },
    work(b, o) {
      const wallZ = o.s < 0 ? b[2] : b[5], f = o.s < 0 ? 'pz' : 'nz';
      boxAB('shiny', '#a06c3e', b[0], 0.86, b[2], b[3], b[4], b[5]);
      boxAB('wall', '#3a3f4a', b[0] + 0.05, 0, b[2] + 0.05, b[3] - 0.05, 0.86, b[5] - 0.05);
      for (let x = b[0] + 0.1; x < b[3] - 0.5; x += 0.95) { const fz = o.s < 0 ? b[5] : b[2]; paint('wall', '#d42a3a', [x, 0, fz, x + 0.85, 0.82, fz], o.s < 0 ? 'pz' : 'nz', x, x + 0.85, 0.12, 0.8, 0.008); paint('chrome', '#d8dde6', [x, 0, fz, x + 0.85, 0.82, fz], o.s < 0 ? 'pz' : 'nz', x + 0.3, x + 0.55, 0.62, 0.66, 0.015); }
      const pb = [b[0], 0, wallZ, b[3], 2.6, wallZ]; paint('wall', '#c79a62', pb, f, b[0], b[3], 1.15, 2.45, 0.01);
      const TC = ['#d42a3a', '#2f5aa8', '#f2c33a', '#3a3f4a', '#2fb67a'];
      for (let i = 0; i < 14; i++) { const x = b[0] + 0.25 + rand() * (b[3] - b[0] - 0.5), y = 1.35 + rand() * 0.9, w = 0.05 + rand() * 0.25, hh = 0.15 + rand() * 0.3; paint('wall', TC[i % TC.length], pb, f, x, x + w, y, Math.min(2.4, y + hh), 0.02); }
      boxAB('wall', '#3a3f4a', b[0] + 0.4, b[4], (b[2] + b[5]) / 2 - 0.15, b[0] + 0.9, b[4] + 0.18, (b[2] + b[5]) / 2 + 0.15);   // imadło
      cyl('wall', 0.12, 0.12, 0.25, '#f2c33a', b[3] - 0.6, b[4] + 0.125, (b[2] + b[5]) / 2, 10);
    },
    tool(b, o) {
      const f = o.s < 0 ? 'pz' : 'nz';
      boxAB('shiny', '#d42a3a', b[0], 0.08, b[2], b[3], b[4] - 0.04, b[5]); boxAB('wall', '#2a2633', b[0] - 0.02, b[4] - 0.04, b[2] - 0.02, b[3] + 0.02, b[4], b[5] + 0.02);
      for (let y = 0.2; y < b[4] - 0.1; y += 0.2) { paint('wall', '#9c1f2c', b, f, b[0] + 0.06, b[3] - 0.06, y - 0.005, y + 0.005, 0.008); paint('chrome', '#d8dde6', b, f, b[0] + 0.5, b[3] - 0.5, y + 0.08, y + 0.11, 0.015); }
      for (const x of [b[0] + 0.1, b[3] - 0.1]) for (const z of [b[2] + 0.1, b[5] - 0.1]) cyl('wall', 0.05, 0.05, 0.08, '#16141c', x, 0.04, z, 8);
    },
    tires(b, o) {
      const n = o.n, hh = (b[4] - b[1]) / n, r = (b[3] - b[0]) / 2, cx = (b[0] + b[3]) / 2, cz = (b[2] + b[5]) / 2;
      for (let i = 0; i < n; i++) { const y = i * hh + hh / 2, dx = (rand() - 0.5) * 0.04, dz = (rand() - 0.5) * 0.04; cyl('wall', r - 0.02, r - 0.02, hh * 0.94, '#1c1a20', cx + dx, y, cz + dz, 14); cyl('wall', r * 0.55, r * 0.55, hh * 0.96, '#3a3644', cx + dx, y, cz + dz, 12); }
    },
    drum(b, o) {
      const r = (b[3] - b[0]) / 2, cx = (b[0] + b[3]) / 2, cz = (b[2] + b[5]) / 2;
      cyl('shiny', r, r, b[4], o.c, cx, b[4] / 2, cz, 14);
      for (const y of [0.3, 0.6]) cyl('wall', r + 0.012, r + 0.012, 0.04, shade(o.c, 0.6), cx, y, cz, 14);
      cyl('wall', r * 0.96, r * 0.96, 0.02, '#c9c6d4', cx, b[4] + 0.005, cz, 14); cyl('chrome', 0.05, 0.05, 0.03, '#e8ecf2', cx + r * 0.5, b[4] + 0.02, cz, 8);
    },
    crate(b) {
      const [x0, , z0, x1, h, z1] = b, xm = (x0 + x1) / 2;
      for (let x = x0; x < x1 - 1e-6; x += 0.3) boxAB('wall', '#b08a5a', x + 0.02, 0.1, z0, Math.min(x + 0.3, x1) - 0.02, 0.15, z1);
      for (const z of [z0, (z0 + z1) / 2 - 0.05, z1 - 0.1]) boxAB('wall', '#8a6a44', x0, 0, z, x1, 0.1, z + 0.1);
      boxAB('wall', '#c99a62', x0, 0.15, z0, xm - 0.02, 0.68, z1); boxAB('wall', '#d4a86e', xm + 0.02, 0.15, z0, x1, 0.68, z1);
      boxAB('wall', '#d4a86e', x0, 0.68, z0, xm + 0.1, h, z1); boxAB('wall', '#c99a62', xm + 0.12, 0.68, z0, x1, h - 0.1, z1);
      for (const [a, c] of [[x0, xm - 0.02], [xm + 0.02, x1]]) boxAB('wall', '#e8d4a8', a, 0.4, z0 - 0.005, c, 0.46, z1 + 0.005);
      place(poster(0.7, 0.35, 'BEAN', 'PARTS', '#2a5bff', '#16306e'), x0 + 0.45, 0.42, z1 + 0.01, 0);
      place(poster(0.7, 0.35, 'BEAN', 'PARTS', '#2a5bff', '#16306e'), x1 - 0.45, 0.42, z0 - 0.01, Math.PI);
    },
    engine(b) {
      const cx = (b[0] + b[3]) / 2, cz = (b[2] + b[5]) / 2;
      cyl('wall', 0.05, 0.05, 0.5, '#d42a3a', cx, 0.25, cz, 8); boxAB('wall', '#d42a3a', b[0], 0, cz - 0.05, b[3], 0.06, cz + 0.05); boxAB('wall', '#d42a3a', cx - 0.05, 0, b[2], cx + 0.05, 0.06, b[5]);
      boxAB('wall', '#5a5868', b[0] + 0.02, 0.5, b[2] + 0.08, b[3] - 0.02, 0.85, b[5] - 0.08);
      for (const dx of [-0.22, 0.22]) boxAB('shiny', '#e3233a', cx + dx - 0.12, 0.85, b[2] + 0.12, cx + dx + 0.12, b[4], b[5] - 0.12);
      cyl('chrome', 0.13, 0.13, 0.1, '#c9c6d4', cx, 0.68, b[5] - 0.02, 12, Math.PI / 2);
    },
    rack(b) {
      const [x0, , z0, x1, h, z1] = b;
      for (const z of [z0, z1 - 0.06]) for (const x of [x0, x1 - 0.06]) boxAB('wall', '#2f5aa8', x, 0, z, x + 0.06, h, z + 0.06);
      for (const y of [0.05, 0.7, 1.35]) { boxAB('wall', '#f2c33a', x0, y - 0.05, z0, x0 + 0.06, y, z1); boxAB('wall', '#f2c33a', x1 - 0.06, y - 0.05, z0, x1, y, z1);
        for (let z = z0 + 0.4; z < z1 - 0.3; z += 0.68) { const xc = (x0 + x1) / 2; cyl('wall', 0.3, 0.3, 0.24, '#1c1a20', xc, y + 0.3, z, 14, 0, 0, Math.PI / 2); cyl('chrome', 0.17, 0.17, 0.25, '#b9b4c6', xc, y + 0.3, z, 10, 0, 0, Math.PI / 2); } }
    },
    lpost(b, o) {
      const cx = (b[0] + b[3]) / 2, cz = (b[2] + b[5]) / 2;
      boxAB('shiny', '#f2c33a', ...b); boxAB('wall', '#d42a3a', b[0] - 0.04, b[4] - 0.15, b[2] - 0.04, b[3] + 0.04, b[4], b[5] + 0.04);
      boxAB('wall', '#3a3f4a', b[0] - 0.12, 0, b[2] - 0.12, b[3] + 0.12, 0.05, b[5] + 0.12);
      for (const dz of [-0.55, 0.55]) tube('wall', [cx, 1.86, cz], [cx + o.dir * 1.35, 1.86, cz + dz], 0.06, '#3a3f4a');
      boxAB('wall', '#16141c', cx - 0.05, 0.3, b[2] - 0.02, cx + 0.05, 0.8, b[2]);
    },
    locker(b, o) {
      const alongX = b[3] - b[0] > b[5] - b[2];
      boxAB('wall', '#2f5f9a', ...b); boxAB('wall', '#24497a', b[0] - 0.01, b[4] - 0.05, b[2] - 0.01, b[3] + 0.01, b[4], b[5] + 0.01);
      boxAB('wall', '#1c3558', b[0] + 0.02, 0, b[2] + 0.02, b[3] - 0.02, 0.1, b[5] - 0.02);
      for (const fc of o.face) {
        const f = FACE[fc], [a0, a1] = alongX ? [b[0], b[3]] : [b[2], b[5]], n = Math.max(1, Math.round((a1 - a0) / 0.5)), w = (a1 - a0) / n;
        for (let i = 0; i < n; i++) {
          const s = a0 + i * w, r = rand(), col = r < 0.12 ? '#e3233a' : r < 0.2 ? '#f2c33a' : i % 2 ? '#3d78c0' : '#3a72b6';
          paint('wall', col, b, f, s + 0.025, s + w - 0.025, 0.12, b[4] - 0.07);
          for (const y of [1.62, 1.69, 1.76, 0.3, 0.37]) paint('wall', '#1c3558', b, f, s + 0.12, s + w - 0.12, y, y + 0.028, 0.012);
          paint('chrome', '#d8dde6', b, f, s + w - 0.13, s + w - 0.09, 0.95, 1.15, 0.02);
          paint('wall', '#f4f2f6', b, f, s + 0.16, s + 0.3, 1.35, 1.43, 0.014);
        }
      }
    },
    lbench(b) {
      boxAB('shiny', '#b47c4b', b[0], 0.38, b[2], b[3], b[4], b[5]);
      for (const z of [b[2] + 0.15, b[5] - 0.15]) boxAB('chrome', '#9aa2ae', b[0] + 0.12, 0, z - 0.04, b[3] - 0.12, 0.38, z + 0.04);
      boxAB('wall', '#f4f2f6', b[0] + 0.1, b[4], b[2] + 0.6, b[3] - 0.1, b[4] + 0.06, b[2] + 1.0);      // ręcznik
    },
    desk(b, o) {
      const top = b[4], wood = o.boss ? '#3a2416' : '#5a3a24';
      boxAB('shiny', wood, b[0] - 0.03, top - 0.06, b[2] - 0.03, b[3] + 0.03, top, b[5] + 0.03);
      boxAB('wall', shade(wood, 1.2), b[0] + 0.03, 0, b[2] + 0.03, b[3] - 0.03, top - 0.06, b[5] - 0.03);
      if (o.boss) { paint('wall', '#d9b04a', b, 'px', b[2] + 0.1, b[5] - 0.1, top - 0.2, top - 0.14, 0.01); paint('wall', '#d9b04a', b, 'px', b[2] + 0.1, b[5] - 0.1, 0.1, 0.16, 0.01); }
      const cz = (b[2] + b[5]) / 2;
      boxAB('wall', '#16141c', b[0] + 0.3, top, cz - 0.32, b[0] + 0.36, top + 0.42, cz + 0.32);                 // monitor ekranem do salonu (klient widzi ofertę)
      paint('glow', '#7fd8ff', [b[0] + 0.3, top + 0.04, cz - 0.29, b[0] + 0.36, top + 0.38, cz + 0.29], 'px', cz - 0.29, cz + 0.29, top + 0.04, top + 0.38, 0.006);
      boxAB('wall', '#2a2633', b[0] + 0.5, top, cz - 0.25, b[0] + 0.66, top + 0.02, cz + 0.25);
      if (o.boss) {
        cyl('wall', 0.08, 0.12, 0.04, '#d9b04a', b[3] - 0.25, top + 0.02, b[2] + 0.35, 10); tube('wall', [b[3] - 0.25, top, b[2] + 0.35], [b[3] - 0.32, top + 0.45, b[2] + 0.4], 0.015, '#d9b04a');
        cyl('glow', 0.12, 0.16, 0.14, '#ffe9b0', b[3] - 0.32, top + 0.5, b[2] + 0.4, 10);
        for (let i = 0; i < 4; i++) boxAB('wall', '#4fa45a', b[3] - 0.5 - (i % 2) * 0.08, top + i * 0.05, b[5] - 0.6, b[3] - 0.25 - (i % 2) * 0.08, top + (i + 1) * 0.05, b[5] - 0.42);   // stosik dolarów
        boxAB('wall', '#d9b04a', b[3] - 0.08, top, cz - 0.25, b[3] - 0.02, top + 0.1, cz + 0.25);
      }
      // krzesło (bez kolizji)
      const kx = b[0] - 0.45; cyl('chrome', 0.04, 0.04, 0.4, '#9aa2ae', kx, 0.2, cz, 6); boxAB('wall', o.boss ? '#16141c' : '#2a2633', kx - 0.25, 0.4, cz - 0.25, kx + 0.25, 0.5, cz + 0.25);
      boxAB('wall', o.boss ? '#16141c' : '#2a2633', kx - 0.3, 0.5, cz - 0.24, kx - 0.22, o.boss ? 1.25 : 1.0, cz + 0.24);
    },
    files(b) {
      boxAB('wall', '#8a8f9a', ...b);
      for (let y = 0.05; y < b[4] - 0.1; y += 0.32) { paint('wall', '#9aa0ac', b, 'px', b[2] + 0.04, b[5] - 0.04, y + 0.02, y + 0.3); paint('chrome', '#e8ecf2', b, 'px', (b[2] + b[5]) / 2 - 0.12, (b[2] + b[5]) / 2 + 0.12, y + 0.2, y + 0.24, 0.015); }
      for (let i = 0; i < 3; i++) boxAB('wall', ['#ff4fd8', '#3ff0e0', '#f2c33a'][i], b[0] + 0.1, b[4], b[2] + 0.2 + i * 0.5, b[3] - 0.1, b[4] + 0.06, b[2] + 0.5 + i * 0.5);
    },
    shelf(b) {
      const wood = '#6a4630', [x0, , z0, x1, h, z1] = b;
      boxAB('wall', shade(wood, 0.8), x0, 0, z0, x0 + 0.05, h, z1);
      for (const z of [z0, z1 - 0.05]) boxAB('wall', wood, x0, 0, z, x1, h, z + 0.05);
      const BK = ['#e3233a', '#2a5bff', '#f2c33a', '#2fb67a', '#ff6fa8', '#f4f2f6', '#16141c', '#7a3cff', '#ff7a2a'];
      for (let y = 0.05; y < h - 0.1; y += 0.48) {
        boxAB('wall', wood, x0, y - 0.04, z0, x1, y, z1);
        for (let z = z0 + 0.08; z < z1 - 0.12;) { const w = 0.05 + rand() * 0.07, bh = 0.24 + rand() * 0.16; if (rand() < 0.85) boxAB('wall', BK[Math.floor(rand() * BK.length)], x0 + 0.06, y, z, x1 - 0.04 - rand() * 0.06, y + bh, z + w); z += w + 0.01; }
      }
      boxAB('wall', wood, x0, h - 0.04, z0, x1, h, z1);
    },
    sofa(b, o) { seat(b, o, 0.8); },
    chair(b, o) { seat(b, o, 0.75); },
    ctable(b) {
      boxAB('glass', '#bfe6ff', b[0], 0.38, b[2], b[3], b[4], b[5]);
      for (const x of [b[0] + 0.08, b[3] - 0.08]) for (const z of [b[2] + 0.08, b[5] - 0.08]) cyl('chrome', 0.025, 0.025, 0.38, '#e8ecf2', x, 0.19, z, 6);
      boxAB('wall', '#ff4fd8', b[0] + 0.3, b[4], b[2] + 0.25, b[0] + 0.62, b[4] + 0.03, b[2] + 0.48);
      cyl('wall', 0.05, 0.04, 0.1, '#f4f2f6', b[3] - 0.3, b[4] + 0.05, b[5] - 0.3, 8);
    },
    counter(b) {
      boxAB('wall', '#7a3cff', b[0], 0, b[2], b[3], 0.94, b[5]); boxAB('shiny', '#f7f4fa', b[0] - 0.02, 0.94, b[2] - 0.02, b[3] + 0.06, b[4], b[5] + 0.02);
      paint('glow', '#3ff0e0', b, 'px', b[2], b[5], 0.05, 0.1, 0.01);
      const ez = b[2] + 0.7; boxAB('chrome', '#d8dde6', b[0] + 0.08, b[4], ez - 0.3, b[0] + 0.55, b[4] + 0.45, ez + 0.3);
      boxAB('wall', '#16141c', b[0] + 0.45, b[4] + 0.1, ez - 0.15, b[0] + 0.56, b[4] + 0.15, ez + 0.15);
      for (const z of [b[2] + 1.5, b[2] + 1.7, b[2] + 1.9]) cyl('wall', 0.05, 0.04, 0.09, '#f4f2f6', b[0] + 0.35, b[4] + 0.045, z, 8);
      for (const z of [b[2] + 2.6, b[2] + 2.9]) cyl('wall', 0.09, 0.06, 0.28, '#f4efea', b[0] + 0.3, b[4] + 0.14, z, 8);
      place(neon([['COFFEE', '#3ff0e0', 1]], 0.4, { px: 180, pad: 0.15 }), X0 + 0.03, 2.2, (b[2] + b[5]) / 2, Math.PI / 2);
    },
    vend(b, o) {
      const f = FACE[o.face], [a0, a1] = along(b, f);
      boxAB('shiny', '#e3233a', ...b);
      paint('glow', '#ffe3ef', b, f, a0 + 0.08, a1 - 0.3, 0.75, 1.8);
      for (let y = 0.85; y < 1.75; y += 0.22) for (let a = a0 + 0.12; a < a1 - 0.36; a += 0.12) paint('wall', ['#2a5bff', '#f2c33a', '#2fb67a', '#ff4fd8'][Math.floor(rand() * 4)], b, f, a, a + 0.08, y, y + 0.14, 0.012);
      paint('wall', '#16141c', b, f, a1 - 0.24, a1 - 0.06, 0.9, 1.3, 0.01); paint('wall', '#16141c', b, f, a0 + 0.1, a1 - 0.1, 0.15, 0.4, 0.01);
      paint('glow', '#ffffff', b, f, a0 + 0.08, a1 - 0.08, 1.82, 1.86, 0.01);
    },
    safe(b) {
      boxAB('shiny', '#2a2d36', ...b);
      paint('wall', '#3a3e4a', b, 'px', b[2] + 0.06, b[5] - 0.06, 0.08, b[4] - 0.06);
      cyl('chrome', 0.12, 0.12, 0.05, '#d9b04a', b[3] + 0.03, b[4] * 0.62, (b[2] + b[5]) / 2, 14, 0, 0, Math.PI / 2);
      boxAB('chrome', '#e8ecf2', b[3], b[4] * 0.4, (b[2] + b[5]) / 2 - 0.02, b[3] + 0.08, b[4] * 0.5, (b[2] + b[5]) / 2 + 0.2);
      boxAB('wall', '#4fa45a', b[0] + 0.1, b[4], b[2] + 0.15, b[3] - 0.15, b[4] + 0.12, b[5] - 0.2);
    },
    kiosk(b) {
      const cx = (b[0] + b[3]) / 2, cz = (b[2] + b[5]) / 2;
      boxAB('shiny', '#f6f3f8', b[0] + 0.15, 0, b[2] + 0.1, b[3] - 0.15, 0.95, b[5] - 0.1);
      boxAB('glow', '#ff4fd8', b[0] + 0.13, 0.05, b[2] + 0.08, b[3] - 0.13, 0.11, b[5] - 0.08);
      boxAB('shiny', '#2a2633', b[0], 0.95, b[2], b[3], 1.15, b[5]);
      for (const s of [-1, 1]) {                                     // ekrany z ofertą po obu stronach (lekko pochylone)
        box('glow', 1.1, 0.02, 0.32, s < 0 ? '#3ff0e0' : '#ff7ac8', cx, 1.16, cz + s * 0.18, 0, s * 0.18);
        for (let i = 0; i < 4; i++) boxAB('wall', ['#ff3f9a', '#19c3d6', '#ffc82e', '#7a3cff'][i], b[0] + 0.25 + i * 0.24, 0.35, s < 0 ? b[2] + 0.06 : b[5] - 0.1, b[0] + 0.43 + i * 0.24, 0.62, s < 0 ? b[2] + 0.1 : b[5] - 0.06);   // broszury
      }
    },
    rims(b) {
      const cx = (b[0] + b[3]) / 2, cz = (b[2] + b[5]) / 2, r = (b[3] - b[0]) / 2;
      cyl('shiny', r, r, 0.12, '#16141c', cx, 0.06, cz, 16); cyl('glow', r + 0.01, r + 0.01, 0.03, '#3ff0e0', cx, 0.1, cz, 16);
      cyl('chrome', 0.05, 0.05, b[4] - 0.12, '#d8dde6', cx, b[4] / 2 + 0.06, cz, 8);
      for (let i = 0; i < 6; i++) {                                  // felgi: chrom, złoto, czerń na przemian, z oponą
        const y = 0.24 + i * 0.235, rr = r * (0.98 - i * 0.04), col = ['#d8dde6', '#f2c552', '#2a2633'][i % 3];
        cyl('wall', rr, rr, 0.2, '#1c1a20', cx, y, cz, 16); cyl('chrome', rr * 0.7, rr * 0.7, 0.21, col, cx, y, cz, 12);
      }
    },
    pylon(b) {
      const cx = (b[0] + b[3]) / 2;
      boxAB('shiny', '#f6f3f8', b[0], 0.1, b[2], b[3], b[4], b[5]); boxAB('shiny', '#2a2633', b[0] - 0.05, 0, b[2] - 0.05, b[3] + 0.05, 0.1, b[5] + 0.05);
      for (const x of [b[0] - 0.005, b[3] - 0.035]) { boxAB('glow', '#ff4fd8', x, 0.1, b[2] - 0.005, x + 0.04, b[4], b[2] + 0.035); boxAB('glow', '#3ff0e0', x, 0.1, b[5] - 0.035, x + 0.04, b[4], b[5] + 0.005); }
      boxAB('glow', '#ff4fd8', b[0] - 0.01, b[4] - 0.04, b[2] - 0.01, b[3] + 0.01, b[4] + 0.01, b[5] + 0.01);
      for (const s of [-1, 1]) {
        const L = neon([['BEAN', '#ff4fd8', 1], ['DELUXE', '#3ff0e0', 0.7]], 0.95, { px: 160, pad: 0.1 });
        if (L) { L.scale.setScalar(Math.min(1, 1.4 / L.geometry.parameters.width)); place(L, cx, 1.9, s * (b[5] + 0.012), s < 0 ? Math.PI : 0); }
        const sc = poster(1.3, 0.75, '$999 000', 'THE STAR OF THE SHOW', '#ff3f9a', '#7a3cff'); place(sc, cx, 0.95, s * (b[5] + 0.012), s < 0 ? Math.PI : 0);
      }
    },
    vitrine(b) {
      boxAB('wall', '#4a2e1c', b[0], 0, b[2], b[3], 0.8, b[5]); boxAB('wall', '#4a2e1c', b[0], b[4] - 0.06, b[2], b[3], b[4], b[5]);
      boxAB('glass', '#bfe6ff', b[0] + 0.02, 0.8, b[2] + 0.02, b[3] - 0.02, b[4] - 0.06, b[5] - 0.02);
      for (let i = 0; i < 4; i++) { const x = b[0] + 0.2 + i * 0.33, z = (b[2] + b[5]) / 2; cyl('wall', 0.05, 0.08, 0.06, '#d9b04a', x, 0.83, z, 8); cyl('wall', 0.02, 0.02, 0.14 + (i % 2) * 0.08, '#d9b04a', x, 0.93 + (i % 2) * 0.04, z, 6); cyl('wall', 0.1, 0.04, 0.16, '#f2c552', x, 1.08 + (i % 2) * 0.08, z, 8); }
      for (const y of [1.3]) boxAB('glass', '#d6f0ff', b[0] + 0.03, y - 0.01, b[2] + 0.03, b[3] - 0.03, y + 0.01, b[5] - 0.03);
    },
  };
  function seat(b, o, hb) {
    const col = o.c, dark = shade(col, 0.72), f = o.face;
    const [sc, bk] = seatCols(b, f);
    boxAB('wall', dark, b[0], 0, b[2], b[3], 0.14, b[5]);
    boxAB('wall', col, sc[0], 0.14, sc[2], sc[3], 0.45, sc[5]);
    boxAB('wall', col, ...bk);
    const alongX = f === '+z' || f === '-z', [a0, a1] = alongX ? [b[0], b[3]] : [b[2], b[5]];
    for (const a of [a0, a1 - 0.16]) { const p = alongX ? [a, 0.14, b[2], a + 0.16, 0.62, b[5]] : [b[0], 0.14, a, b[3], 0.62, a + 0.16]; boxAB('wall', dark, ...p); }
    const n = Math.max(1, Math.round((a1 - a0 - 0.32) / 0.75));
    for (let i = 0; i < n; i++) {                                  // poduszki
      const s = a0 + 0.2 + (i * (a1 - a0 - 0.4)) / n, e = a0 + 0.2 + ((i + 1) * (a1 - a0 - 0.4)) / n - 0.04;
      const p = alongX ? [s, 0.45, sc[2] + 0.04, e, 0.52, sc[5] - 0.04] : [sc[0] + 0.04, 0.45, s, sc[3] - 0.04, 0.52, e];
      boxAB('wall', shade(col, 1.12), ...p);
    }
    void hb;
  }
  function palm(x, y, z, h) {
    const lean = rand() * Math.PI * 2, bend = 0.08 + rand() * 0.12, pts = [];
    for (let i = 0; i <= 5; i++) { const t = i / 5; pts.push([x + Math.cos(lean) * bend * h * t * t, y + h * t, z + Math.sin(lean) * bend * h * t * t]); }
    for (let i = 0; i < 5; i++) tube('wall', pts[i], pts[i + 1], 0.11 - i * 0.012, i % 2 ? '#8a6a4c' : '#7a5a40', 6);
    const top = pts[5], n = 8;
    for (let k = 0; k < n; k++) {
      const az = (k / n) * Math.PI * 2 + rand() * 0.4, L = h * (0.42 + rand() * 0.12), dir = [Math.cos(az), Math.sin(az)], side = [-Math.sin(az), Math.cos(az)], st = [];
      for (let i = 0; i <= 5; i++) {
        const s = i / 5, px = top[0] + dir[0] * L * s, pz = top[2] + dir[1] * L * s, py = top[1] + L * (0.35 * s * 2 - 0.9 * s * s), w = L * 0.14 * Math.sin(Math.PI * Math.min(1, s * 1.08 + 0.02));
        st.push([[px, py, pz], [px + side[0] * w, py - w * 0.4, pz + side[1] * w], [px - side[0] * w, py - w * 0.4, pz - side[1] * w]]);
      }
      const t = []; for (let i = 0; i < 5; i++) { const [c0, l0, r0] = st[i], [c1, l1, r1] = st[i + 1]; t.push(c0, l0, c1, l0, l1, c1, c0, c1, r0, r0, c1, r1); }
      tris('leaf', t, k % 2 ? '#2f9a52' : '#24804a');
    }
  }

  // ================================= AUTA =================================
  function drawCar(c, keyP = 'paint') {
    const T = CAR_T[c.t], y0 = c.y || 0, base = new THREE.Matrix4().compose(_p.set(c.x, y0, c.z), _q.setFromEuler(_e.set(0, YAW[c.d], 0, 'YXZ')), _s.set(1, 1, 1));
    const P = (key, geo, col, m) => push(key, geo, col, m ? base.clone().multiply(m) : base);
    const B = (key, col, x0, yy0, z0, x1, yy1, z1) => P(key, new THREE.BoxGeometry(x1 - x0, yy1 - yy0, z1 - z0), col, M4((x0 + x1) / 2, (yy0 + yy1) / 2, (z0 + z1) / 2));
    const ext = (pts, w, x = 0) => { const sh = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v))); const g = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false, curveSegments: 1 }); g.rotateY(-Math.PI / 2); g.translate(w / 2 + x, 0, 0); return g; };
    const { L, W } = T, hl = L / 2;
    B('wall', '#141218', -W / 2 + 0.12, 0.12, -hl + 0.2, W / 2 - 0.12, 0.3, hl - 0.25);              // podwozie
    P(keyP, ext(T.low, W - 0.04), c.c);                                                                 // nadwozie
    P('cglass', ext(T.top, T.cw), '#1b1636');                                                           // kabina (szyby)
    { const t = T.top, zr = t[3][0], zf = t[2][0], yr = Math.min(t[2][1], t[3][1]); B(keyP, c.c, -T.cw / 2 + 0.06, yr - 0.03, zr + 0.05, T.cw / 2 - 0.06, T.roof + 0.004, zf - 0.05); }   // dach w kolorze lakieru
    for (const sx of [-1, 1]) B(keyP, c.a, sx * (W / 2 - 0.02) - 0.012, 0.3, -hl + 0.45, sx * (W / 2 - 0.02) + 0.012, 0.37, hl - 0.5);   // pas na progu
    if (T.stripes) for (const sx of [-0.26, 0.26]) {                                                    // pasy wyścigowe: maska, dach, bagażnik
      P(keyP, ext(T.low, 0.22, sx), c.a, M4(0, 0.008, 0, 0, 0, 0, 1, 1, 1.003));
      const t = T.top; B(keyP, c.a, sx - 0.11, T.roof - 0.01, t[3][0] + 0.1, sx + 0.11, T.roof + 0.012, t[2][0] - 0.1);
    }
    // koła
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const wx = sx * (W / 2 - 0.15), wz = sz * T.axle;
      P('wall', new THREE.CylinderGeometry(T.wr, T.wr, 0.28, 14), '#18161c', M4(wx, T.wr, wz, 0, 0, Math.PI / 2));
      P('chrome', new THREE.CylinderGeometry(T.wr * 0.62, T.wr * 0.62, 0.3, 10), c.hero ? '#f2c552' : '#d8dde6', M4(wx, T.wr, wz, 0, 0, Math.PI / 2));
      P('wall', new THREE.CylinderGeometry(T.wr * 0.18, T.wr * 0.18, 0.31, 6), '#2a2633', M4(wx, T.wr, wz, 0, 0, Math.PI / 2));
    }
    // światła, grill, tablice, lusterka, wydech
    const fz = T.low[2][0], rz = T.low[9][0];
    for (const sx of [-1, 1]) {
      if (c.t === 'muscle') P('glow', new THREE.CylinderGeometry(0.11, 0.11, 0.05, 10), '#fff6e0', M4(sx * 0.66, T.head, hl + 0.01, 0, Math.PI / 2));
      else B('glow', '#fff6e0', sx * 0.82 - 0.24, T.head - 0.04, fz - 0.06, sx * 0.82 + 0.24, T.head + 0.04, fz + 0.005);
      B('glow', '#ff2a3a', sx * 0.66 - 0.26, T.tail - 0.05, rz - 0.04, sx * 0.66 + 0.26, T.tail + 0.05, rz + 0.01);
      B(keyP, c.c, sx * (T.cw / 2 + 0.05) - 0.06, T.body + 0.02, T.cab[1] - 0.35, sx * (T.cw / 2 + 0.05) + 0.06, T.body + 0.14, T.cab[1] - 0.2);
      P('chrome', new THREE.CylinderGeometry(0.05, 0.05, 0.2, 8), '#d8dde6', M4(sx * 0.45, 0.32, -hl - 0.02, 0, Math.PI / 2));
    }
    B('cglass', '#16141c', -0.6, 0.28, fz - 0.03, 0.6, Math.min(0.4, T.head - 0.06), fz + 0.02);
    B('wall', '#f4f2f6', -0.26, 0.4, rz - 0.06, 0.26, 0.5, rz - 0.01);
    if (T.wing) { for (const sx of [-0.6, 0.6]) B(keyP, c.a, sx - 0.04, T.body - 0.02, -hl + 0.3, sx + 0.04, T.body + 0.22, -hl + 0.45); B(keyP, c.a, -W / 2 + 0.12, T.body + 0.2, -hl + 0.15, W / 2 - 0.12, T.body + 0.26, -hl + 0.6); }
    if (T.duck) B(keyP, c.c, -W / 2 + 0.1, T.body - 0.02, -hl + 0.02, W / 2 - 0.1, T.body + 0.06, -hl + 0.3);
    if (T.lip) B(keyP, c.a, -W / 2 + 0.15, 0.22, fz - 0.15, W / 2 - 0.15, 0.27, fz + 0.04);
    if (T.scoop) B(keyP, c.a, -0.3, T.body - 0.05, 1.0, 0.3, T.body + 0.08, 1.7);
    if (c.glow && !c.lift) place(halo(W + 1.4, L + 1.0, c.glow, 0.85), c.x, y0 + 0.012, c.z, c.d === '+x' || c.d === '-x' ? Math.PI / 2 : 0);
  }
  function priceStand(c) {
    if (!c.price) return;
    const T = CAR_T[c.t], a = YAW[c.d], cs = Math.cos(a), sn = Math.sin(a), lx = T.W / 2 + 0.55, lz = T.L / 2 - 0.6;
    const wx = c.x + lx * cs + lz * sn, wz = c.z - lx * sn + lz * cs, y = c.y || 0;
    cyl('chrome', 0.03, 0.03, 0.9, '#d8dde6', wx, y + 0.45, wz, 6); cyl('chrome', 0.14, 0.16, 0.03, '#d8dde6', wx, y + 0.015, wz, 10);
    const m = priceTag(c.price); if (m) { m.rotation.order = 'YXZ'; place(m, wx, y + 1.0, wz, Math.atan2(cs, -sn)); m.rotation.x = -0.35; }   // cenówka patrzy od boku auta na zewnątrz
  }
  for (const c of CARS) { drawCar(c); priceStand(c); }
  for (const c of LOT) drawCar(c);

  // ================================= HALA =================================
  for (const p of PARTS) { const fn = D[p.k]; if (fn) fn(p.b, p.o); }

  // ---------- napisy w środku ----------
  for (const s of [-1, 1]) {
    const rySh = s < 0 ? 0 : Math.PI, rySv = s < 0 ? Math.PI : 0;     // strona salonu / strona serwisu ściany działowej
    place(neon([['BEAN DELUXE', '#ff4fd8', 1.25], ['M O T O R S', '#3ff0e0', 0.75]], 1.75, { px: 120 }), 3, 2.75, s * (18.8 - 0.04), rySh);
    place(poster(3.2, 1.7, '0% FINANCING', 'ASK OUR SALES TEAM', '#ff3f9a', '#7a3cff'), -9.5, 2.2, s * (18.8 - 0.02), rySh);
    place(poster(3.2, 1.7, 'TEST DRIVE', 'TODAY · NO APPOINTMENT', '#19c3d6', '#2a5bff'), 16.5, 2.2, s * (18.8 - 0.02), rySh);
    place(neon([['SERVICE', '#ff2b4f', 1]], 0.9, { frame: '#3b6bff', px: 130 }), 3, 2.9, s * (19.2 + 0.04), rySv);
    place(neon([['STAFF ONLY', '#f2c33a', 1]], 0.4, { px: 140 }), -9.5, 2.4, s * (19.2 + 0.04), rySv);
    place(neon([['PARTS & TIRES', '#3ff0e0', 1]], 0.45, { px: 140 }), 16.5, 2.6, s * (19.2 + 0.04), rySv);
    // nad pokojami (pas od strony salonu)
    place(neon([['SALES', '#ff4fd8', 1]], 0.62, { px: 140 }), RXE + 0.03, 3.71, s * 14.7, Math.PI / 2);
    place(neon([['LOUNGE', '#3ff0e0', 1]], 0.62, { px: 140 }), RXE + 0.03, 3.71, s * 7.5, Math.PI / 2);
    place(neon([['STAFF', '#f2c33a', 1]], 0.62, { px: 140 }), RXE + 0.03, 3.71, s * 23.6, Math.PI / 2);
    place(poster(1.4, 1.9, 'WE BUY CARS', 'BEST PRICE IN VICE', '#ff7a2a', '#e3233a'), RXE + 0.02, 1.5, s * 4.2, Math.PI / 2);   // na ścianie gabinetu od strony poczekalni
    // w pokojach
    place(poster(1.8, 1.0, 'EMPLOYEE', 'OF THE MONTH', '#2a5bff', '#16306e'), -18.2, 2.2, s * (18.8 - 0.02), s < 0 ? 0 : Math.PI);
    place(poster(1.6, 1.1, 'SALES Q4', '▲ 240%', '#2fb67a', '#16603a'), X0 + 0.02, 1.8, s * 15, Math.PI / 2);
  }
  { const F = neon([['FINANCE', '#f2c552', 1]], 0.62, { px: 140 }); place(F, RXE + 0.03, 3.71, 0, Math.PI / 2); if (F) flick.push(F); }
  place(neon([['$  BOSS  $', '#f2c552', 1]], 0.5, { px: 140 }), X0 + 0.03, 2.75, 0, Math.PI / 2);
  // na zewnątrz: wielki szyld na froncie, hasła po bokach, „SERVICE” na ścianach szczytowych
  {
    const big = neon([['BEAN DELUXE', '#ff4fd8', 1.2], ['M O T O R S', '#3ff0e0', 0.8]], 2.7, { px: 90, pad: 0.4 }); place(big, X1 + WT + 0.05, 7.45, 0, Math.PI / 2);
    for (const [z, t, c] of [[-13.5, 'TEST DRIVE', '#f4f2f6'], [13.5, 'WE BUY CARS', '#ff3f5a'], [-23.5, 'FINANCING 0%', '#3ff0e0'], [23.5, 'SERVICE', '#f4f2f6']]) place(neon([[t, c, 1]], 1.0, { px: 110 }), X1 + WT + 0.05, 7.45, z, Math.PI / 2);
    for (const s of [-1, 1]) place(neon([['SERVICE', '#ff2b4f', 1]], 1.6, { px: 100, frame: '#3b6bff' }), 2, 7.45, s * (ZE + WT + 0.05), s < 0 ? Math.PI : 0);
    place(neon([['BEAN DELUXE', '#ff4fd8', 1]], 1.6, { px: 100 }), X0 - WT - 0.05, 7.45, 0, -Math.PI / 2);
  }

  // ================================= PARKING PRZED SALONEM (tylko wygląd) =================================
  {
    const LX0 = X1 + WT, LX1 = 36, y = 0.004;
    quad('wall', [LX0, y, -34], [LX1, y, -34], [LX1, y, 34], [LX0, y, 34], '#34303e');
    for (let z = -27; z <= 27.01; z += 3) if (Math.abs(z) > 4) quad('wall', [24, y + 0.002, z - 0.06], [31, y + 0.002, z - 0.06], [31, y + 0.002, z + 0.06], [24, y + 0.002, z + 0.06], '#e8e4ee');
    for (let x = LX0; x < 24; x += 0.6) for (let z = -3; z < 3; z += 0.6) quad('wall', [x + 0.02, y + 0.003, z + 0.02], [x + 0.58, y + 0.003, z + 0.02], [x + 0.58, y + 0.003, z + 0.58], [x + 0.02, y + 0.003, z + 0.58], (Math.round(x / 0.6) + Math.round(z / 0.6)) % 2 ? '#e8b8c8' : '#f4d4de');
    boxAB('wall', '#bdb6c9', LX1, 0, -60, LX1 + 3, 0.15, 60); boxAB('wall', '#f4f2f6', LX1 - 0.15, 0, -60, LX1, 0.17, 60);
    // flagi na linkach między masztami
    const FC = ['#e3233a', '#f4f2f6', '#2a5bff', '#ff4fd8', '#3ff0e0', '#f2c33a'];
    for (let z = -30; z < 30; z += 10) {
      for (const zz of [z, z + 10]) cyl('chrome', 0.06, 0.06, 5, '#d8dde6', 34.5, 2.5, zz, 6);
      for (let i = 0; i < 16; i++) {
        const t0 = i / 16, t1 = (i + 0.7) / 16, sag = (t) => 4.8 - Math.sin(t * Math.PI) * 0.7, za = z + t0 * 10, zb = z + t1 * 10;
        tris('wall', [[34.5, sag(t0), za], [34.5, sag(t1), zb], [34.5, (sag(t0) + sag(t1)) / 2 - 0.45, (za + zb) / 2]], FC[i % FC.length]);
      }
    }
    // pylon z szyldem przy ulicy
    boxAB('wall', '#2a2633', 37.2, 0, -31.3, 37.8, 9, -30.7);
    boxAB('wall', '#26222f', 36.4, 9, -33.8, 38.6, 11.6, -28.2);
    boxAB('glow', '#ff2b4f', 36.38, 9, -33.82, 38.62, 9.12, -28.18); boxAB('glow', '#3b6bff', 36.38, 11.48, -33.82, 38.62, 11.6, -28.18);
    for (const sx of [-1, 1]) place(neon([['BEAN DELUXE', '#ff4fd8', 1.1], ['MOTORS', '#3ff0e0', 0.9]], 2.1, { px: 90, pad: 0.2 }), 37.5 + sx * 1.13, 10.3, -31, sx > 0 ? Math.PI / 2 : -Math.PI / 2);
  }

  // ================================= DACH (bez cienia, schowany na miniaturze) =================================
  {
    push('roofS', new THREE.BoxGeometry(X1 - X0 + 2 * WT, 0.25, 2 * (ZE + WT)), '#4a4658', M4(0, HH + 0.125, 0));
    for (const x of [-6, 4, 14]) push('roofG', new THREE.BoxGeometry(2.2, 0.02, 2 * ZE - 4), '#ffd6ec', M4(x, HH - 0.01, 0));      // świetliki
    for (const z of [-24, -16, -8, 0, 8, 16, 24]) {                                                                                 // kratownice
      push('roofS', new THREE.BoxGeometry(X1 - X0, 0.22, 0.22), '#3a3550', M4(0, 7.65, z));
      push('roofS', new THREE.BoxGeometry(X1 - X0, 0.2, 0.22), '#3a3550', M4(0, HH - 0.1, z));
      for (let x = X0 + 0.5, i = 0; x < X1 - 0.5; x += 2.5, i++) {
        const a = [x, 7.7, z], b = [x + 2.5, HH - 0.15, z]; if (i % 2) { a[1] = HH - 0.15; b[1] = 7.7; }
        const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), d = Bv.clone().sub(A);
        push('roofS', new THREE.CylinderGeometry(0.06, 0.06, d.length(), 5), '#3a3550', new THREE.Matrix4().compose(A.clone().add(Bv).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()), new THREE.Vector3(1, 1, 1)));
      }
    }
    for (const x of [-15, -5, 5, 15]) push('roofS', new THREE.BoxGeometry(0.16, 0.14, 2 * ZE), '#3a3550', M4(x, HH - 0.08, 0));
    for (const x of [-6, 4, 14]) for (const z of [-23.5, -15, -7.5, 0, 7.5, 15, 23.5]) {                                            // lampy
      push('roofS', new THREE.CylinderGeometry(0.012, 0.012, HH - 7.6, 4), '#16141c', M4(x, (HH + 7.6) / 2, z));
      push('roofS', new THREE.CylinderGeometry(0.16, 0.48, 0.38, 10, 1, true), '#2a2633', M4(x, 7.4, z));
      push('roofG', new THREE.CircleGeometry(0.42, 10).rotateX(Math.PI / 2), '#fff4e0', M4(x, 7.22, z));
    }
    for (const [x, col] of [[-1, '#ff2b4f'], [9, '#3b6bff']]) {                                                                   // wiszące neonowe rury
      push('roofG', new THREE.BoxGeometry(0.1, 0.1, 34), col, M4(x, 6.9, 0));
      for (const z of [-16, -8, 0, 8, 16]) push('roofS', new THREE.CylinderGeometry(0.01, 0.01, HH - 6.95, 4), '#16141c', M4(x, (HH + 6.95) / 2, z));
    }
  }

  // ================================= SIATKI =================================
  // posadzka i niewidzialna siatka kolizji zatrzymują kule (dokładnie jak serwer); reszta to ozdoby
  for (const c of MAP.colliders) push('hitbox', new THREE.BoxGeometry(c[3] - c[0], c[4] - c[1], c[5] - c[2]), '#ffffff', M4((c[0] + c[3]) / 2, (c[1] + c[4]) / 2, (c[2] + c[5]) / 2));
  const mk = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, ...o });
  const MAT = {
    floor: mk({ roughness: 0.32, metalness: 0.12 }), wall: mk({ roughness: 0.72, metalness: 0.04 }), shiny: mk({ roughness: 0.3, metalness: 0.15 }),
    paint: mk({ roughness: 0.24, metalness: 0.38 }), cglass: mk({ roughness: 0.08, metalness: 0.7 }), chrome: mk({ roughness: 0.22, metalness: 0.8 }),
    leaf: mk({ roughness: 0.8 }), glass: mk({ roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.28, depthWrite: false }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    roofS: mk({ roughness: 0.7, metalness: 0.1 }), roofG: new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    hitbox: new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
  };
  const addMesh = (key, name, o = {}) => {
    if (!kits[key]) return null;
    const m = new THREE.Mesh(merge(kits[key]), MAT[key]); m.name = name;
    m.castShadow = o.cast !== false; m.receiveShadow = true; if (o.noHit) m.userData.noHit = true; if (o.order) m.renderOrder = o.order;
    (o.parent || root).add(m); return m;
  };
  addMesh('floor', 'floor_salon');
  addMesh('hitbox', 'salon_kolizje', { cast: false });
  addMesh('wall', 'salon_sciany', { noHit: true });
  addMesh('shiny', 'salon_meble', { noHit: true });
  addMesh('paint', 'salon_lakier', { noHit: true });
  addMesh('cglass', 'salon_szyby_aut', { noHit: true });
  addMesh('chrome', 'salon_chrom', { noHit: true });
  addMesh('leaf', 'salon_palmy', { noHit: true });
  addMesh('glass', 'salon_szyby', { noHit: true, cast: false, order: 2 });
  addMesh('glow', 'salon_neony', { noHit: true, cast: false });
  addMesh('roofS', 'dach', { noHit: true, cast: false, parent: roofG });
  addMesh('roofG', 'dach_swiatla', { noHit: true, cast: false, parent: roofG });
  for (const m of flick) m.userData.flicker = true;
  return root;
}
