// Bean FPS – oglądanie broni (klawisz F) w stylu CS: choreografia z klatek kluczowych + interpolacja Catmull-Rom.
//
// Klatka kluczowa (wszystkie kanały poza t są opcjonalne; brakujący kanał = wartość z poprzedniej klatki, na starcie 0):
//   t    czas [s]
//   p    [x,y,z]  przesunięcie broni w układzie kamery [m] (FPS); w 3. osobie to samo w układzie tułowia (×0.8)
//   r    [rx,ry,rz] obrót broni [rad]: rz = przechył wokół osi lufy (najpierw), potem rx = lufa w górę/dół
//        i ry = skręt lufy w lewo(+)/prawo(−) w układzie kamery
//   piv  0..1 punkt obrotu wzdłuż broni: 0 = nad chwytem, 1 = środek długości broni
//   pvy  0..1 wysokość punktu obrotu: 0 = dłoń na chwycie, 1 = linia lufy (przechył wokół lufy przy prawej dłoni)
//   L    kotwica lewej dłoni (nazwy w ANCHORS; 'grip' = zwykły chwyt, 'rest' = ręka poza kadrem)
//   lo   [x,y,z] przesunięcie celu lewej dłoni w układzie broni [m] (dla 'rest': w układzie kamery)
//   wk   0..1 ile przedramię prawej ręki podąża za skrętem/pochyleniem broni (przechył robi nadgarstek, nie przedramię)
//   rp   [x,y,z] kierunek łokcia prawej ręki (układ kamery); domyślnie z układu broni w FPS
//   lp   [x,y,z] kierunek łokcia lewej ręki (układ kamery); domyślnie z układu broni w FPS
//   lwk  0..1 jak mocno przedramię lewej ręki trzyma naturalny kierunek kotwicy (reszta: kierunek łokcia lp)
//   sl   0..1 zamek / rączka przeładowania (ułamek pełnego cofnięcia)
//   mg   wysunięcie magazynka wzdłuż jego osi [m]
//   sh   [x,y,z] przesunięcie barków (ruch tułowia) w układzie kamery [m]
// Zdarzenia dźwiękowe: events: [{t, s:'cloth'|'grab'|'tap'|'click'|'slide'|'ratchet'}]
// spring: {w, z} – sprężyna (częstość [rad/s], tłumienie) nałożona na p i r: bezwładność, lekkie przeregulowanie
// przy zatrzymaniach i dochodzenie do pozy (jak cięższa broń w dłoniach). Choreografia kończy się po dur + SETTLE.

// Kotwice lewej dłoni w układzie broni: p = punkt na powierzchni, n = normalna na zewnątrz (dłoń leży o promień
// rurki dalej), w = naturalny kierunek przedramienia (od dłoni do łokcia).
export const ANCHORS = {
  ak47: {
    guard:   { p: [0, .041, -.38],    n: [0, -1, 0],   w: [-.45, -.75, .5] },
    guardR:  { p: [0, .0232, -.275],  n: [0, -1, 0],   w: [-.45, -.75, .5] },
    guardL:  { p: [-.021, .055, -.34], n: [-1, -.25, 0], w: [-.8, -.45, .35] },
    magL:    { p: [-.014, -.045, -.152], n: [-1, 0, 0], w: [-.75, -.5, .45] },
    magBase: { p: [0, -.165, -.205],  n: [0, -.8, -.6], w: [-.35, -.9, .25] },
    magF:    { p: [0, -.115, -.222],  n: [0, -.3, -1],  w: [-.4, -.7, .6] },       // przód dolnego łuku magazynka
    guardS:  { p: [-.012, .03, -.33], n: [-.6, -.8, 0], w: [-.6, -.7, .4] },        // spód łoża od lewej
    chandle: { p: [.048, .092, -.075], n: [1, .2, 0],  w: [-.2, -.35, .9] },
  },
  m4a1s: {
    guard:   { p: [0, .054, -.31],    n: [0, -1, 0],   w: [-.45, -.75, .5] },
    guardF:  { p: [0, .054, -.36],    n: [0, -1, 0],   w: [-.45, -.75, .5] },
    guardFF: { p: [0, .054, -.395],   n: [0, -1, 0],   w: [-.45, -.75, .5] },
    guardR:  { p: [0, .054, -.2],     n: [0, -1, 0],   w: [-.45, -.75, .5] },
    guardL:  { p: [-.023, .08, -.3],  n: [-1, 0, 0],   w: [-.8, -.45, .35] },
    supp:    { p: [0, .0565, -.6],    n: [0, -1, 0],   w: [-.35, -.85, .4] },
    suppTop: { p: [0, .099, -.6],     n: [0, 1, 0],    w: [-.6, .35, .7] },
    suppL:   { p: [-.021, .0775, -.6], n: [-1, 0, 0],  w: [-.85, -.35, .4] },
    magL:    { p: [-.014, -.055, -.115], n: [-1, 0, 0], w: [-.75, -.5, .45] },
    magBase: { p: [0, -.158, -.122],  n: [0, -1, -.15], w: [-.35, -.9, .25] },
    chandle: { p: [0, .102, .118],    n: [0, 1, .3],   w: [-.4, .1, .9] },
  },
  glock: {
    slideTop: { p: [0, .057, -.075],  n: [0, 1, 0],    w: [-.75, .25, .6] },
    slideF:   { p: [0, .057, -.102],  n: [0, 1, 0],    w: [-.75, .25, .6] },
    slideL:   { p: [-.013, .042, -.08], n: [-1, 0, 0], w: [-.85, -.1, .5] },
    frameL:   { p: [-.012, .0, -.045], n: [-1, 0, 0],  w: [-.85, -.35, .4] },
    magBase:  { p: [0, -.087, .03],   n: [0, -1, .2],  w: [-.4, -.85, .3] },
  },
  usps: {
    slideTop: { p: [0, .0597, -.07],  n: [0, 1, 0],    w: [-.75, .25, .6] },
    slideF:   { p: [0, .0597, -.1],   n: [0, 1, 0],    w: [-.75, .25, .6] },
    slideL:   { p: [-.0138, .044, -.08], n: [-1, 0, 0], w: [-.85, -.1, .5] },
    frameL:   { p: [-.012, .0, -.045], n: [-1, 0, 0],  w: [-.85, -.35, .4] },
    supp:     { p: [0, .024, -.24],   n: [0, -1, 0],   w: [-.4, -.85, .35] },
    suppL:    { p: [-.0175, .0415, -.24], n: [-1, 0, 0], w: [-.85, -.35, .4] },
    suppTop:  { p: [0, .059, -.24],   n: [0, 1, 0],    w: [-.6, .35, .7] },
    magBase:  { p: [0, -.087, .03],   n: [0, -1, .2],  w: [-.4, -.85, .3] },
  },
};

// ---------------- choreografie ----------------
// Rytm jak w CS: wyprzedzenie → pokazanie jednego boku (ruchome przytrzymanie, nigdy martwa pauza) → jeden szybki
// obrót na drugi bok → przytrzymanie → powrót z lekkim przeregulowaniem. Prawa dłoń nigdy nie puszcza chwytu,
// obrót idzie z nadgarstka (punkt obrotu blisko chwytu). Konwencja r: rx + = lufa w górę, ry + = lufa w lewo,
// rz + = przechył przeciwnie do wskazówek zegara (góra broni w lewo).
export const TIMELINES = {
  // AK-47: lewy bok położony płasko do kamery, lewa dłoń trzyma zakrzywiony magazynek; przewrót na prawy bok
  // (okno wyrzutowe, rączka zamka), lewa dłoń wraca pod łoże; powrót z ciężkim osiadaniem.
  ak47: {
    dur: 5.3,
    spring: { w: 16, z: 0.8 },
    anchors: {
      magHold: { p: [0.01, -0.118, -0.226], n: [0.35, -0.4, -1], w: [0.5, -0.77, 0.39] },
      guardSup: { p: [-0.012, 0.03, -0.33], n: [-0.6, -0.8, 0], w: [-0.9, -0.4, 0.2] },
    },
    keys: [
      { t: 0, p: [0, 0, 0], r: [0, 0, 0], piv: 0.15, L: "grip" },
      { t: 0.3, p: [0.004, -0.014, 0.02], r: [-0.05, -0.02, 0.08], L: "grip" },
      { t: 1, p: [-0.035, 0.04, -0.03], r: [0.2, 0.3, -1.05], L: "magHold", sh: [-0.035, 0.02, -0.05], lp: [-1, -0.7, 0.6], lwk: 0.5 },
      { t: 1.95, p: [-0.04, 0.046, -0.025], r: [0.22, 0.34, -1.12], L: "magHold", sh: [-0.035, 0.02, -0.05], lp: [-1, -1, 0.35], lwk: 0.5 },
      { t: 2.15, p: [-0.06, 0.022, 0.03], r: [0.26, 0.29, 0.05], L: "magHold", lp: [-0.7, -1, 0.3], sh: [-0.008, 0.004, -0.008] },
      { t: 2.5, p: [-0.085, 0.016, 0.03], r: [0.33, 0.27, 1.2], L: "guardSup", lp: [-0.6, -1, 0.1], sh: [0, 0, 0] },
      { t: 3.5, p: [-0.085, 0.03, 0.03], r: [0.3, 0.28, 1.2], L: "guardSup" },
      { t: 3.95, p: [-0.045, 0.012, 0.03], r: [0.24, 0.24, 0.25], L: "guardSup" },
      { t: 4.4, p: [-0.008, 0.002, 0.008], r: [0.02, 0.03, 0.03], L: "grip", lp: [-1, -0.9, 0] },
      { t: 4.75, p: [0.002, -0.008, -0.004], r: [-0.03, -0.01, -0.05], L: "grip" },
      { t: 5.3, p: [0, 0, 0], r: [0, 0, 0], L: "grip" },
    ],
    events: [{ t: 0.25, s: "cloth" }, { t: 0.95, s: "grab" }, { t: 2.05, s: "cloth" }, { t: 2.5, s: "grab" }, { t: 3.75, s: "cloth" }, { t: 4.35, s: "grab" }],
  },
  // M4A1-S: przechył w lewo (prawy bok z oknem wyrzutowym do góry, tłumik w lewy górny róg), szybkie przerzucenie
  // w poprzek ekranu (lewy profil, tłumik w lewo), uniesienie wzdłuż góry i tłumika; powrót.
  m4a1s: {
    dur: 5.6,
    spring: { w: 15, z: 0.8 },
    keys: [
      { t: 0, p: [0, 0, 0], r: [0, 0, 0], piv: 0.15, L: "grip" },
      { t: 0.3, p: [0.004, -0.012, 0.01], r: [-0.05, 0.08, 0.16], L: "grip" },
      { t: 0.95, p: [-0.055, 0.04, -0.02], r: [0.33, 0.5, 1.42], L: "guard", sh: [-0.06, 0.035, -0.08] },
      { t: 1.38, p: [-0.07, 0.04, -0.02], r: [0.36, 0.54, 1.62], L: "guardF", sh: [-0.06, 0.035, -0.08] },
      { t: 2, p: [-0.07, 0, -0.13], r: [0.12, 1.05, 0.14], L: "guardF", piv: 0.3, lp: [-1, -1.1, 0.3], lwk: 0.2, wk: 0.15, rp: [1, -1, 0.5], sh: [-0.06, 0.035, -0.08] },
      { t: 2.75, p: [-0.068, 0.012, -0.14], r: [0.07, 1.1, 0.34], L: "guardF", lp: [-1, -1.1, 0.3], lwk: 0.2, wk: 0.15, rp: [1, -1, 0.5], sh: [-0.06, 0.035, -0.08] },
      { t: 3.45, p: [-0.078, 0.004, -0.15], r: [0.15, 1.06, 0.22], L: "guardF", lp: [-1, -1.1, 0.3], lwk: 0.2, wk: 0.15, rp: [1, -1, 0.5], sh: [-0.06, 0.035, -0.08] },
      { t: 4.3, p: [-0.07, 0.03, -0.05], r: [0.45, 0.78, 0.6], L: "guardFF", lp: [-1, -0.8, 0.5], lwk: 0.1, wk: 0.15, rp: [1, -1, 0.5], sh: [-0.06, 0.035, -0.08] },
      { t: 4.55, p: [-0.068, 0.032, -0.05], r: [0.47, 0.76, 0.62], L: "guardFF", lp: [-1, -0.8, 0.5], lwk: 0.1, wk: 0.15, rp: [1, -1, 0.5], sh: [-0.06, 0.035, -0.08] },
      { t: 5.12, p: [0.003, -0.008, -0.003], r: [-0.04, -0.01, -0.03], L: "grip", piv: 0.15 },
      { t: 5.6, p: [0, 0, 0], r: [0, 0, 0], L: "grip" },
    ],
    events: [{ t: 0.25, s: "cloth" }, { t: 0.95, s: "grab" }, { t: 1.5, s: "cloth" }, { t: 2, s: "grab" }, { t: 3.6, s: "cloth" }, { t: 5, s: "grab" }],
  },
  // Glock-18: lewa dłoń puszcza i wychodzi z kadru; zamach do środka przez celownik (lewy bok), przewrót
  // przedramieniem dłonią w dół (prawy bok z oknem wyrzutowym do góry), powrót i ponowne objęcie chwytu.
  glock: {
    dur: 4.5,
    spring: { w: 20, z: 0.8 },
    keys: [
      { t: 0, p: [0, 0, 0], r: [0, 0, 0], piv: 0.05, L: "grip", pvy: 0.3 },
      { t: 0.32, p: [0.004, -0.022, 0], r: [-0.09, -0.03, 0.03], L: "rest", lo: [0.03, 0.08, 0], rp: [1.1, -1.3, 0.1] },
      { t: 0.95, p: [-0.065, 0.005, 0.02], r: [0.17, 1.2, 0.3], L: "rest", rp: [1.1, -1.3, 0.1], wk: 0.2 },
      { t: 1.75, p: [-0.07, 0.01, 0.022], r: [0.22, 1.27, 0.32], L: "rest", wk: 0.3 },
      { t: 2.05, p: [-0.03, 0.005, 0.03], r: [0.4, 0.7, 1], L: "rest", rp: [1.2, -1.1, 0.4], wk: 0.3 },
      { t: 2.35, p: [-0.05, 0, 0.04], r: [0.48, 0.38, 1.95], L: "rest", rp: [1.2, -1, 0.5], wk: 0.3 },
      { t: 3.15, p: [-0.052, 0.004, 0.04], r: [0.6, 0.42, 2.12], L: "rest", lo: [0.02, 0.04, 0], rp: [1.2, -1, 0.5], wk: 0.3 },
      { t: 3.5, p: [-0.03, 0.014, 0.03], r: [0.35, 0.3, 1.2], L: "rest", lo: [0.02, 0, 0], rp: [1.1, -1.1, 0.3], wk: 0.3 },
      { t: 3.8, p: [0.002, -0.006, 0], r: [0.01, 0.02, 0.03], L: "grip", rp: [1, -1.3, 0.1], lwk: 0.6 },
      { t: 4.08, p: [0.003, -0.012, -0.003], r: [-0.03, -0.01, -0.07], L: "grip" },
      { t: 4.5, p: [0, 0, 0], r: [0, 0, 0], L: "grip" },
    ],
    events: [{ t: 0.2, s: "cloth" }, { t: 1.8, s: "cloth" }, { t: 3.78, s: "grab" }],
  },
  // USP-S: lewa dłoń wychodzi z kadru; lewy profil (pistolet i długi tłumik poziomo w poprzek ekranu), przewrót
  // dłonią w dół (prawy bok, tłumik w lewy górny róg), powrót i ponowne objęcie chwytu.
  usps: {
    dur: 5.3,
    spring: { w: 20, z: 0.8 },
    keys: [
      { t: 0, p: [0, 0, 0], r: [0, 0, 0], piv: 0.05, L: "grip", pvy: 0.35 },
      { t: 0.1, p: [0, -0.01, 0], r: [-0.035, 0, 0], L: "grip" },
      { t: 0.45, p: [-0.02, 0.025, 0], r: [0.02, 0.26, -0.05], L: "rest", lo: [0.04, 0.1, 0] },
      { t: 1.05, p: [0, 0, 0.025], r: [-0.09, 1.23, -0.26], L: "rest", rp: [1.3, -1, 0.6], wk: 0.15 },
      { t: 1.4, p: [0.004, 0.006, 0.02], r: [-0.12, 1.26, -0.2], L: "rest", rp: [1, -1, 0.5], wk: 0.25 },
      { t: 1.75, p: [-0.002, 0, 0.025], r: [-0.07, 1.32, -0.24], L: "rest", rp: [1.3, -1, 0.6], wk: 0.15 },
      { t: 1.83, p: [-0.011, 0, 0.025], r: [-0.1, 1.31, -0.33], L: "rest", rp: [1.3, -1, 0.6], wk: 0.15 },
      { t: 2.5, p: [0.025, -0.01, -0.01], r: [0.44, 0.61, 2.09], L: "rest", rp: [1.3, -1, 0.6], wk: 0.15 },
      { t: 2.62, p: [0.025, -0.01, -0.01], r: [0.45, 0.6, 1.99], L: "rest", rp: [1.3, -1, 0.6], wk: 0.15 },
      { t: 3.5, p: [0.023, -0.01, -0.01], r: [0.52, 0.64, 2.17], L: "rest", lo: [0.03, 0.12, 0], rp: [1.3, -1, 0.6], wk: 0.15 },
      { t: 3.95, p: [0.015, -0.015, -0.008], r: [0.25, 0.3, 1], L: "rest", lo: [0.03, 0.1, 0], rp: [1.2, -1, 0.4], wk: 0.2 },
      { t: 4.4, p: [0.006, -0.012, -0.004], r: [-0.05, 0.01, 0.02], L: "grip", lp: [-1.1, -1, 0.1] },
      { t: 4.65, p: [-0.002, 0.004, 0.002], r: [0.02, 0, -0.01], L: "grip" },
      { t: 5.3, p: [0, 0, 0], r: [0, 0, 0], L: "grip" },
    ],
    events: [{ t: 0.25, s: "cloth" }, { t: 1.9, s: "cloth" }, { t: 4.32, s: "grab" }],
  },
};

// ---------------- interpolacja ----------------
const CH_VEC = ['p', 'r', 'sh'], CH_NUM = ['piv', 'pvy', 'sl', 'mg', 'wk', 'lwk'], CH_OPT = ['rp', 'lp'];
const DEF = { p: [0, 0, 0], r: [0, 0, 0], sh: [0, 0, 0], piv: .15, pvy: 1, sl: 0, mg: 0, wk: .45, lwk: .35 };
export const SETTLE = .35;                      // czas dojścia sprężyny po ostatniej klatce
const BAKE_HZ = 240;

// Uzupełnia brakujące kanały (wartość z poprzedniej klatki) – raz na choreografię.
export function prepareTimeline(tl) {
  if (tl._ready) return tl;
  let prev = { ...DEF, L: 'grip', lo: [0, 0, 0], rp: null, lp: null };
  for (const k of tl.keys) {
    for (const c of [...CH_VEC, ...CH_NUM, ...CH_OPT, 'L']) if (k[c] === undefined) k[c] = prev[c];
    if (k.lo === undefined) k.lo = (k.L === prev.L) ? prev.lo : [0, 0, 0];
    prev = k;
  }
  tl.events = (tl.events || []).slice().sort((a, b) => a.t - b.t);
  bake(tl);
  tl._ready = true;
  return tl;
}

// Mikro-dryf (oddech, drżenie rąk) – deterministyczny w czasie, z obwiednią: zero na początku i na końcu.
function drift(tl, t, out) {
  const e = Math.min(1, Math.max(0, t / .5)) * Math.min(1, Math.max(0, (tl.dur - t) / .6)), E = e * e * (3 - 2 * e), P2 = Math.PI * 2;
  out[0] = E * .0016 * Math.sin(P2 * .29 * t + .7);                        // p.y
  out[1] = E * (.006 * Math.sin(P2 * .43 * t + 1.1) + .003 * Math.sin(P2 * .71 * t + .2));   // rx
  out[2] = E * (.007 * Math.sin(P2 * .37 * t + 2.0) + .002 * Math.sin(P2 * .83 * t + 1.3));  // ry
  out[3] = E * (.009 * Math.sin(P2 * .53 * t + .5) + .003 * Math.sin(P2 * .97 * t + 2.4));   // rz
  return out;
}
// Wypiekanie p i r: krzywa z klatek + dryf → sprężyna 2. rzędu (semi-implicit Euler, 240 Hz).
function bake(tl) {
  const sp = tl.spring || { w: 15, z: .8 }, n = Math.ceil((tl.dur + SETTLE) * BAKE_HZ) + 2, dt = 1 / BAKE_HZ;
  const B = { n, p: [0, 1, 2].map(() => new Float32Array(n)), r: [0, 1, 2].map(() => new Float32Array(n)) };
  const x = new Float32Array(6), v = new Float32Array(6), tmp = newInspectState(), dr = [0, 0, 0, 0];
  const w2 = sp.w * sp.w, c = 2 * sp.z * sp.w;
  for (let k = 0; k < n; k++) {
    const t = k * dt; rawEval(tl, Math.min(t, tl.dur), tmp); drift(tl, Math.min(t, tl.dur), dr);
    const tg = [tmp.p[0], tmp.p[1] + dr[0], tmp.p[2], tmp.r[0] + dr[1], tmp.r[1] + dr[2], tmp.r[2] + dr[3]];
    for (let j = 0; j < 6; j++) { v[j] += (w2 * (tg[j] - x[j]) - c * v[j]) * dt; x[j] += v[j] * dt; }
    const f = t > tl.dur + SETTLE - .12 ? Math.max(0, (tl.dur + SETTLE - t) / .12) : 1;    // dokładnie zero na końcu
    for (let j = 0; j < 3; j++) { B.p[j][k] = x[j] * f; B.r[j][k] = x[3 + j] * f; }
  }
  tl._bake = B;
}

// Hermite z tangentami Catmulla-Roma dla nierównych odstępów czasu; końce choreografii z zerową prędkością.
function seg(tl, t) {
  const K = tl.keys, n = K.length;
  if (t <= K[0].t) return { i: 0, u: 0 };
  if (t >= K[n - 1].t) return { i: n - 2, u: 1 };
  let i = 0; while (i < n - 2 && t > K[i + 1].t) i++;
  return { i, u: (t - K[i].t) / Math.max(1e-6, K[i + 1].t - K[i].t) };
}
const TENSION = .85;
function tangent(K, i, get) {
  if (i <= 0 || i >= K.length - 1) return 0;
  const a = get(K[i - 1]), b = get(K[i + 1]), dt = K[i + 1].t - K[i - 1].t;
  return dt > 0 ? (b - a) / dt * TENSION : 0;
}
function herm(K, i, u, get) {
  const k0 = K[i], k1 = K[i + 1], h = k1.t - k0.t;
  const p0 = get(k0), p1 = get(k1), m0 = tangent(K, i, get) * h, m1 = tangent(K, i + 1, get) * h;
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * m1;
}

export function newInspectState() {
  return { p: [0, 0, 0], r: [0, 0, 0], sh: [0, 0, 0], rp: [0, 0, 0], lp: [0, 0, 0], piv: .15, pvy: 1, sl: 0, mg: 0, wk: .45, lwk: .35, i: 0, u: 0 };
}
const _noDefs = { rp: [0, 0, 0], lp: [0, 0, 0] };
function rawEval(tl, t, out, defs = _noDefs) {
  const K = tl.keys, { i, u } = seg(tl, t);
  out.i = i; out.u = u;
  for (const c of CH_VEC) for (let j = 0; j < 3; j++) out[c][j] = herm(K, i, u, k => k[c][j]);
  for (const c of CH_NUM) out[c] = herm(K, i, u, k => k[c]);
  for (const c of CH_OPT) for (let j = 0; j < 3; j++) out[c][j] = herm(K, i, u, k => (k[c] || defs[c])[j]);
  return out;
}

// Kanały liczbowe w chwili t → out. defs = {rp:[..], lp:[..]}: kierunki łokci, gdy klatka ich nie podaje.
export function evalInspect(tl, t, out, defs) {
  rawEval(tl, Math.min(t, tl.dur), out, defs);
  const B = tl._bake;
  if (B) {                                         // p i r z wypieczonej sprężyny
    const f = Math.min(B.n - 1.001, Math.max(0, t * BAKE_HZ)), k = Math.floor(f), a = f - k;
    for (let j = 0; j < 3; j++) { out.p[j] = B.p[j][k] * (1 - a) + B.p[j][k + 1] * a; out.r[j] = B.r[j][k] * (1 - a) + B.r[j][k + 1] * a; }
  }
  out.sl = Math.min(1, Math.max(0, out.sl)); out.mg = Math.max(0, out.mg);
  out.wk = Math.min(1, Math.max(0, out.wk)); out.lwk = Math.min(1, Math.max(0, out.lwk));
  return out;
}

// Cel lewej dłoni i kierunek przedramienia (układ broni). resolve(key, i) zwraca {p:[...], n:[...], w:[...]}
// dla kotwicy klatki (już w układzie broni, z przesunięciem lo). Między różnymi kotwicami dłoń leci łukiem
// odsuniętym od broni (wzdłuż średniej normalnej), żeby nie przechodziła przez nią.
const _r = [null, null, null, null];
export function evalLeft(tl, t, resolve, outP, outW) {
  const K = tl.keys, { i, u } = seg(tl, t);
  const ia = Math.max(0, i - 1), ib = Math.min(K.length - 1, i + 2);
  const A = resolve(K[i], i), B = resolve(K[i + 1], i + 1);
  const Am = resolve(K[ia], ia), Bp = resolve(K[ib], ib);
  // Hermite po pozycjach rozwiązanych kotwic (tangenty z sąsiednich klatek)
  const h = K[i + 1].t - K[i].t;
  const tan = (P, N, tP, tN, cur) => (cur <= 0 || cur >= K.length - 1) ? 0 : (N - P) / Math.max(1e-6, tN - tP) * TENSION * h;
  const u2 = u * u, u3 = u2 * u, h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  for (let j = 0; j < 3; j++) {
    const m0 = tan(Am.p[j], B.p[j], K[ia].t, K[i + 1].t, i), m1 = tan(A.p[j], Bp.p[j], K[i].t, K[ib].t, i + 1);
    outP[j] = h00 * A.p[j] + h10 * m0 + h01 * B.p[j] + h11 * m1;
  }
  if (K[i].L !== K[i + 1].L) {                         // łuk przy zmianie chwytu
    const dx = B.p[0] - A.p[0], dy = B.p[1] - A.p[1], dz = B.p[2] - A.p[2], d = Math.hypot(dx, dy, dz);
    let nx = A.n[0] + B.n[0], ny = A.n[1] + B.n[1], nz = A.n[2] + B.n[2]; const nl = Math.hypot(nx, ny, nz) || 1;
    const bulge = Math.sin(Math.PI * u) * Math.min(.06, d * .45) / nl;
    outP[0] += nx * bulge; outP[1] += ny * bulge; outP[2] += nz * bulge;
  }
  const e = u * u * (3 - 2 * u);
  for (let j = 0; j < 3; j++) outW[j] = A.w[j] + (B.w[j] - A.w[j]) * e;
  const wl = Math.hypot(outW[0], outW[1], outW[2]) || 1; outW[0] /= wl; outW[1] /= wl; outW[2] /= wl;
  return { i, u, la: K[i].L, lb: K[i + 1].L };
}

export function inspectEvents(tl) { return tl.events || []; }
