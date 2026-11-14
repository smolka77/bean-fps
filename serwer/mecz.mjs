// Autorytatywny serwer meczu 1v1 (antycheat): to SERWER, a nie przeglądarka gracza, decyduje o:
//  - trafieniach, obrażeniach i śmierci (gracz wysyła tylko „strzeliłem stąd w tę stronę”; rozrzut, lot pocisku
//    po kolizjach mapy, trafienie w fasolkę przeciwnika z kompensacją opóźnienia i HP liczy serwer),
//  - szybkostrzelności i amunicji każdej broni (z przeładowaniem),
//  - ruchu: prędkość, wysokość skoku, wiszenie w powietrzu, przenikanie przez ściany, wyjście poza mapę
//    (zła pozycja jest odrzucana, a gracz dostaje korektę „fix” z ostatnią dobrą pozycją),
//  - widoczności: pozycja przeciwnika idzie do gracza tylko wtedy, gdy może go zobaczyć (wallhack nic nie pokaże).
// Moduł nie zna WebSocketu: serwer.mjs woła handleMessage/tick i wysyła to, co zwróci funkcja send.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// ---------------- stałe zgodne z grą (zrodla/index.html, weaponry.js) ----------------
export const WEAPON_IDS = ['ak47', 'm4a1s', 'glock', 'usps'];
export const WEAPONS = {
  ak47: { rpm: 600, dmg: 36, head: 3, mag: 30, reserve: 90, reload: 2.45, spread: { hip: 0.0075, ads: 0.0016, move: 1.15, bloom: 0.14 } },
  m4a1s: { rpm: 600, dmg: 33, head: 3, mag: 25, reserve: 75, reload: 2.3, spread: { hip: 0.0065, ads: 0.0012, move: 1.0, bloom: 0.11 } },
  glock: { rpm: 400, dmg: 22, head: 2.5, mag: 20, reserve: 120, reload: 1.75, spread: { hip: 0.006, ads: 0.002, move: 0.7, bloom: 0.12 } },
  usps: { rpm: 350, dmg: 35, head: 2.5, mag: 12, reserve: 24, reload: 1.95, spread: { hip: 0.005, ads: 0.0012, move: 0.7, bloom: 0.13 } },
};
const R = 0.3;                         // promień gracza w fizyce gry
const CROUCH_DROP = 0.25;              // o tyle opada tułów w przysiadzie
const EYE = (s) => s.y + 1.3 - s.cr * (CROUCH_DROP + 0.12) - 0.1 * (s.sl || 0);
// ruch (fizyka gracza: sprint 6,8 m/s, wślizg do ~10,4 m/s, skok 1,09 m, drabina 3,4 m/s)
const V_MAX = 11.5, V_AVG = 9.0, SLACK = 1.0, JUMP_H = 1.35, UP_V = 7.5, SUP_M = 0.45;
const ROUND_DELAY = 6.6;               // od zabójstwa do „WALCZ!” (killcam 1 s + wynik 3,1 s + kurtyna + odliczanie 2,4 s)
const START_DELAY = 6.8;               // od 'go' do „WALCZ!” (wczytanie + intro 4,4 s + odliczanie 2,4 s)
const LIVE_GRACE = 2.5;                // po tylu sekundach od planowanego startu gracz jest w grze, nawet bez 'lv'
const REWIND_MAX = 0.25;               // kompensacja opóźnienia: maksymalne cofnięcie przeciwnika (s) – więcej nie daje sztuczny lag
const LAG_SHOT = 0.35;                 // bez paczek ruchu dłużej niż tyle (lag switch) strzały nie są przyjmowane

// ---------------- mapy: kolizje z plików gry ----------------
const MAPS = {};
export async function loadMaps(gameDir, names = ['Oaza', 'Magazyn', 'Baza']) {
  for (const name of names) {
    const file = path.join(gameDir, 'zrodla', name.toLowerCase() + '-data.js');
    const mod = await import(pathToFileURL(file).href);
    const D = mod.MAP || mod.OAZA;
    const boxes = D.colliders.map(([x0, y0, z0, x1, y1, z1]) => ({ x0, y0, z0, x1, y1, z1 }));
    const ladders = (D.ladders || []).map(([x0, y0, z0, x1, y1, z1]) => ({ x0, y0, z0, x1, y1, z1 }));
    const bx = Math.max(...D.colliders.map((c) => Math.max(-c[0], c[3]))), bz = Math.max(...D.colliders.map((c) => Math.max(-c[2], c[5])));
    MAPS[name] = { name, boxes, ladders, spawns: D.spawns, bx, bz, grid: makeGrid(boxes) };
  }
  return MAPS;
}
export const mapByName = (n) => MAPS[n];

// siatka 2 m dla szybkich zapytań o bryły w pobliżu punktu
function makeGrid(boxes) {
  const g = new Map(), C = 2;
  boxes.forEach((b, i) => {
    for (let x = Math.floor(b.x0 / C); x <= Math.floor(b.x1 / C); x++) for (let z = Math.floor(b.z0 / C); z <= Math.floor(b.z1 / C); z++) {
      const k = x * 4096 + z; if (!g.has(k)) g.set(k, []); g.get(k).push(i);
    }
  });
  return { g, C };
}
function near(map, x, z, r) {
  const { g, C } = map.grid, out = new Set();
  for (let gx = Math.floor((x - r) / C); gx <= Math.floor((x + r) / C); gx++) for (let gz = Math.floor((z - r) / C); gz <= Math.floor((z + r) / C); gz++) {
    const l = g.get(gx * 4096 + gz); if (l) for (const i of l) out.add(i);
  }
  return [...out].map((i) => map.boxes[i]);
}

// promień o + d*t, t ∈ [0, tMax]: pierwsze trafienie w bryłę (slab test)
function rayBox(o, d, b) {
  let t0 = 0, t1 = Infinity;
  for (const [oo, dd, lo, hi] of [[o[0], d[0], b.x0, b.x1], [o[1], d[1], b.y0, b.y1], [o[2], d[2], b.z0, b.z1]]) {
    if (Math.abs(dd) < 1e-12) { if (oo < lo || oo > hi) return Infinity; continue; }
    let a = (lo - oo) / dd, c = (hi - oo) / dd; if (a > c) [a, c] = [c, a];
    if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) return Infinity;
  }
  return t0;
}
export function rayMap(map, o, d, tMax) {
  let best = tMax;
  for (const b of map.boxes) {
    // szybkie odrzucenie: bryła daleko od odcinka (sfera ograniczająca)
    const t = rayBox(o, d, b); if (t < best) best = t;
  }
  return best;
}
function visibleLine(map, a, b) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d); if (L < 1e-6) return true;
  const n = d.map((v) => v / L);
  return rayMap(map, a, n, L) >= L - 0.05;
}

// trafienie promienia w fasolkę przeciwnika stojącą w s (pionowe walce: nogi, tułów) -> {t, head} albo null
function rayBean(o, d, s, margin = 0.05) {
  const drop = CROUCH_DROP * (s.cr || 0);
  const parts = [{ r: 0.33 + margin, y0: s.y + 0.4 - drop, y1: s.y + 1.5 - drop }, { r: 0.24 + margin, y0: s.y, y1: s.y + 0.45 }];
  let best = null;
  for (const p of parts) {
    const ox = o[0] - s.x, oz = o[2] - s.z, a = d[0] * d[0] + d[2] * d[2], bb = 2 * (ox * d[0] + oz * d[2]), c = ox * ox + oz * oz - p.r * p.r;
    let ts = [];
    if (a > 1e-12) { const disc = bb * bb - 4 * a * c; if (disc >= 0) { const q = Math.sqrt(disc); ts = [(-bb - q) / (2 * a), (-bb + q) / (2 * a)]; } }
    else if (c <= 0) ts = [0, 1e9];
    for (const t of ts.length ? [ts[0]] : []) {
      // wejście w walec z boku
      if (t > 0) { const y = o[1] + d[1] * t; if (y >= p.y0 && y <= p.y1 && (!best || t < best.t)) best = { t, y }; }
    }
    // wejście od góry/dołu (strzał z góry w głowę)
    for (const yy of [p.y1, p.y0]) {
      if (Math.abs(d[1]) < 1e-9) continue; const t = (yy - o[1]) / d[1]; if (t <= 0) continue;
      const x = ox + d[0] * t, z = oz + d[2] * t; if (x * x + z * z <= p.r * p.r && (!best || t < best.t)) best = { t, y: yy };
    }
  }
  if (!best) return null;
  return { t: best.t, head: best.y - s.y > 1.12 - drop };
}

// ---------------- pokój meczu ----------------
// stan gracza po stronie serwera
function newPlayer() {
  return { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, cr: 0, sl: 0, ads: 0, w: 0, run: 0, air: 0, legYaw: 0,
    hp: 100, live: false, inited: false, lastT: 0, lastGroundY: 0, airSince: 0, hist: [], trail: [],
    bloom: 0, bloomT: 0, tokens: 1, tokT: 0, lastQ: 0, ammo: {}, reloadW: -1, reloadAt: 0,
    rtt: 0.1, viol: [], kicked: false, seen: false, seenT: 0, hiddenSent: false,
    aim: [], lastStT: 0, visOpp: false, visSince: 0, reacted: true, spray: null, lastShotT: 0,
    pending: [], preFire: false,
    an: { shots: 0, hits: 0, heads: 0, hitsOpen: 0, headsOpen: 0, reactions: [], flicks: 0, flickHeads: 0, snaps: 0, snapHeads: 0, trigger: [], sprays: [], mismatch: 0, noSamp: 0,
      samples: 0, noShotSamp: 0, spikes: 0, firstOn: 0, sweep: 0, shotsOn: 0, shotsSeen: 0, track: { n: 0, on: 0, on1: 0 }, gaps: 0, sevMoves: 0, rtts: [] } };
}
function refill(p) { p.ammo = {}; for (const id of WEAPON_IDS) p.ammo[id] = { mag: WEAPONS[id].mag, res: WEAPONS[id].reserve }; p.reloadW = -1; p.bloom = 0; }

export function createRoom(mapName, now) {
  const map = MAPS[mapName]; if (!map) throw new Error('Brak mapy ' + mapName);
  const room = { map, p: [newPlayer(), newPlayer()], liveAt: Infinity, phase: 'wait', score: [0, 0], over: false, log: [],
    t0: now, rec: { map: mapName, st: [], sh: [], rd: [] } };          // powtórka meczu do weryfikacji przez admina
  room.p.forEach(refill);
  return room;
}
const spawnOf = (room, seat) => room.map.spawns[seat === 1 && room.map.spawns[1] ? 1 : 0];
function placeAtSpawn(room, seat, now) {
  const p = room.p[seat], s = spawnOf(room, seat);
  Object.assign(p, { x: s.x, y: s.y || 0, z: s.z, yaw: s.yaw || 0, hp: 100, live: false, inited: true, lastT: now, lastGroundY: s.y || 0, airSince: 0, hist: [], trail: [] });
  refill(p); pushHist(p, now);
}
function pushHist(p, now) { p.hist.push({ t: now, x: p.x, y: p.y, z: p.z, cr: p.cr }); while (p.hist.length && now - p.hist[0].t > 1.2) p.hist.shift(); }
function stateAt(p, t) {
  const h = p.hist; if (!h.length) return p;
  if (t <= h[0].t) return h[0];
  for (let i = h.length - 1; i >= 0; i--) if (h[i].t <= t) {
    const a = h[i], b = h[i + 1]; if (!b) return a;
    const k = (t - a.t) / Math.max(1e-6, b.t - a.t);
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, cr: a.cr + (b.cr - a.cr) * k };
  }
  return h[h.length - 1];
}

// start meczu ('go') i kolejnych rund: obaj na spawnach, pełne HP i amunicja, gra rusza po odliczaniu
// Pozycje na spawnie serwer przyjmuje dopiero, gdy klient zgłosi reset rundy ('rs'), albo wymusza je tuż przed startem
// (do tego czasu klient jeszcze pokazuje wynik poprzedniej rundy i stoi w starym miejscu).
export function startRound(room, now, delay) {
  room.p.forEach((p) => { Object.assign(p, { inited: false, live: false, hp: 100 }); refill(p); });
  room.liveAt = now + delay; room.phase = 'count';
}

// ---------------- ruch ----------------
function supportTop(map, x, z, y) {
  let top = 0;
  // z zapasem jak w fizyce gry (gracz stoi też na samej krawędzi skrzyni czy stopki bloku)
  for (const b of near(map, x, z, SUP_M)) if (b.y1 <= y + 0.2 && x > b.x0 - SUP_M && x < b.x1 + SUP_M && z > b.z0 - SUP_M && z < b.z1 + SUP_M && b.y1 > top) top = b.y1;
  return top;
}
const inLadder = (map, x, y, z) => map.ladders.some((l) => x > l.x0 - 0.5 && x < l.x1 + 0.5 && z > l.z0 - 0.5 && z < l.z1 + 0.5 && y >= l.y0 - 0.2 && y <= l.y1 + 0.6);
function insideSolid(map, x, y, z) {
  for (const b of near(map, x, z, 0.3)) {
    if (b.y1 <= y + 0.75 || b.y0 >= y + 1.6) continue;                       // stopnie pod nogami (gra potrafi na chwilę wcisnąć w stopień) i bryły nad głową
    if (x > b.x0 + 0.12 && x < b.x1 - 0.12 && z > b.z0 + 0.12 && z < b.z1 - 0.12) return b;   // środek gracza w ścianie
  }
  return null;
}
// odcinek (ax,az)->(bx,bz) przecina wnętrze bryły na wysokości ciała -> przejście przez ścianę
function crossesWall(map, a, b) {
  const yLo = Math.min(a.y, b.y) + 0.8, yHi = Math.max(a.y, b.y) + 1.4;
  const minx = Math.min(a.x, b.x), maxx = Math.max(a.x, b.x), minz = Math.min(a.z, b.z), maxz = Math.max(a.z, b.z);
  for (const box of near(map, (a.x + b.x) / 2, (a.z + b.z) / 2, Math.hypot(b.x - a.x, b.z - a.z) / 2 + 0.5)) {
    if (box.y1 <= yLo || box.y0 >= yHi) continue;
    const x0 = box.x0 + 0.1, x1 = box.x1 - 0.1, z0 = box.z0 + 0.1, z1 = box.z1 - 0.1; if (x0 >= x1 || z0 >= z1) continue;
    if (maxx < x0 || minx > x1 || maxz < z0 || minz > z1) continue;
    // Liang–Barsky dla odcinka w prostokącie
    let t0 = 0, t1 = 1; const dx = b.x - a.x, dz = b.z - a.z; let ok = true;
    for (const [p, q] of [[-dx, a.x - x0], [dx, x1 - a.x], [-dz, a.z - z0], [dz, z1 - a.z]]) {
      if (Math.abs(p) < 1e-12) { if (q < 0) { ok = false; break; } continue; }
      const r = q / p; if (p < 0) { if (r > t1) { ok = false; break; } if (r > t0) t0 = r; } else { if (r < t0) { ok = false; break; } if (r < t1) t1 = r; }
    }
    if (ok && t1 - t0 > 1e-3) return box;
  }
  return null;
}
// sprawdza nowy stan gracza; zwraca null (dobrze) albo powód odrzucenia
export function checkMove(room, p, s, now) {
  const map = room.map, dt = Math.max(0.001, now - p.lastT);
  if (![s.x, s.y, s.z].every(Number.isFinite)) return 'nan';
  if (Math.abs(s.x) > map.bx + 1 || Math.abs(s.z) > map.bz + 1 || s.y < -0.5 || s.y > 30) return 'poza mapą';
  const d2 = Math.hypot(s.x - p.x, s.z - p.z);
  if (d2 > V_MAX * dt + SLACK) return 'za szybko';
  // średnia prędkość z ostatnich ~2 s (speedhack z małym mnożnikiem)
  const old = p.trail.find((q) => now - q.t <= 2.2 && now - q.t >= 1.5);
  if (old && Math.hypot(s.x - old.x, s.z - old.z) > V_AVG * (now - old.t) + SLACK) return 'za szybko (średnio)';
  if (s.y - p.y > UP_V * dt + 0.6) return 'za szybko w górę';
  const ladder = inLadder(map, s.x, s.y, s.z);
  if (!ladder && s.y > p.lastGroundY + JUMP_H) return 'za wysoko';
  const wall = insideSolid(map, s.x, s.y, s.z);
  if (wall && insideSolid(map, p.x, p.y, p.z) !== wall) return 'w ścianie';   // wejście w ścianę (zakleszczenia z fizyki gry przepuszczamy)
  if (crossesWall(map, p, s)) return 'przez ścianę';
  // wiszenie w powietrzu: czas lotu ograniczony fizyką skoku i spadania
  const sup = supportTop(map, s.x, s.z, s.y);
  if (!ladder && s.y > sup + 0.25) {
    const h = Math.max(0, p.lastGroundY + JUMP_H - sup), tMax = 0.75 + Math.sqrt((2 * h) / 20) + 0.5;
    if (p.airSince && now - p.airSince > tMax) return 'wisi w powietrzu';
  }
  return null;
}
function acceptMove(room, p, s, now) {
  const map = room.map, ladder = inLadder(map, s.x, s.y, s.z), sup = supportTop(map, s.x, s.z, s.y);
  const prevSpeed = Math.hypot(s.x - p.x, s.z - p.z) / Math.max(0.02, now - p.lastT);
  Object.assign(p, { x: s.x, y: s.y, z: s.z, yaw: s.yaw, pitch: s.pitch, cr: s.cr, sl: s.sl, ads: s.ads, w: s.w, run: s.run, air: s.air, legYaw: s.legYaw, lastT: now });
  p.speed01 = Math.min(1, prevSpeed / 6.8);
  if (ladder || Math.abs(s.y - sup) < 0.15) { p.lastGroundY = ladder ? Math.max(s.y, sup) : s.y; p.airSince = 0; p.ground = true; p.gx = s.x; p.gy = s.y; p.gz = s.z; }
  else { if (!p.airSince) p.airSince = now; p.ground = false; }
  pushHist(p, now);
  p.trail.push({ t: now, x: s.x, z: s.z }); while (p.trail.length && now - p.trail[0].t > 2.5) p.trail.shift();
  const seat = room.p.indexOf(p), r2 = (v) => Math.round(v * 100) / 100, r3 = (v) => Math.round(v * 1000) / 1000;
  if (room.rec.st.length < 60000) room.rec.st.push([r2(now - room.t0), seat, r2(s.x), r2(s.y), r2(s.z), r3(s.yaw), r3(s.pitch), r2(s.cr)]);
}
// Ciężkie odrzucenia (teleport, latanie, przenikanie przez ściany, wyjście poza mapę) liczą się do wyrzucenia z meczu;
// łagodne (wciśnięcie w stopień, odrobinę za wysoko) tylko cofają gracza – zdarzają się też uczciwym przez fizykę gry.
const SEVERE = new Set(['nan', 'poza mapą', 'za szybko', 'za szybko w górę', 'przez ścianę', 'wisi w powietrzu']);
function violation(p, why, now) {
  if (!SEVERE.has(why)) return false;
  if (why !== 'nan') p.an.sevMoves++;                            // NaN to błąd silnika gry (zdarza się uczciwym), nie liczy się do ryzyka
  p.viol.push(now); while (p.viol.length && now - p.viol[0] > 20) p.viol.shift();
  return p.viol.length >= 25;                                  // 25 ciężkich odrzuceń w 20 s = oszust
}

// ---------------- strzał ----------------
function shoot(room, seat, m, now, out) {
  const me = room.p[seat], op = room.p[1 - seat], wid = WEAPON_IDS[me.w] || 'ak47', W = WEAPONS[wid];
  if (room.phase !== 'live' || !me.live || me.hp <= 0) return;
  const q = +m.q; if (!(q > me.lastQ)) return; me.lastQ = q;      // każdy strzał raz
  if (now - me.lastStT > LAG_SHOT) return;                         // lag switch: bez świeżych paczek ruchu nie ma strzałów
  // szybkostrzelność: wiadro żetonów (rpm/60 na sekundę, zapas 2 na skoki sieci)
  me.tokens = Math.min(2, me.tokens + (now - me.tokT) * (W.rpm / 60)); me.tokT = now;
  if (me.tokens < 0.95) return; me.tokens -= 1;
  // amunicja i przeładowanie
  if (me.reloadW >= 0 && now >= me.reloadAt) finishReload(me);
  if (me.reloadW >= 0) return;                                     // w trakcie przeładowania nie strzela
  const a = me.ammo[wid]; if (a.mag <= 0) return; a.mag--;
  // rozrzut liczy serwer (tak jak gra: broń, celowanie, ruch, skok, kucanie, seria)
  me.bloom = Math.max(0, me.bloom - (now - me.bloomT) * 0.9); me.bloomT = now;
  const sp = (me.ads ? W.spread.ads : W.spread.hip) + me.bloom * 0.018;
  const spread = sp * (1 + (me.speed01 || 0) * W.spread.move * 1.2) * (me.ground === false ? 2.2 : 1) * (1 - me.cr * 0.35);
  me.bloom = Math.min(1, me.bloom + W.spread.bloom);
  // punkt startu: z ostatniej znanej pozycji serwera (gracz może być do ~0,6 m dalej przez opóźnienie paczek)
  const eye = [me.x, EYE(me), me.z]; let o = eye;
  if (Array.isArray(m.o) && m.o.length === 3 && m.o.every(Number.isFinite) && Math.hypot(m.o[0] - eye[0], m.o[1] - eye[1], m.o[2] - eye[2]) <= 0.7) o = m.o;
  let d = Array.isArray(m.d) && m.d.length === 3 && m.d.every(Number.isFinite) ? m.d : null; if (!d) return;
  const L = Math.hypot(...d); if (L < 1e-6) return; d = d.map((v) => v / L);
  const aimDir = d.slice();                                        // kierunek celowania gracza (przed rozrzutem) – do analizy celowania
  // losowy odchył w stożku spread wokół kierunku celowania
  const ang = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * spread;
  const up = Math.abs(d[1]) > 0.99 ? [1, 0, 0] : [0, 1, 0];
  const u = norm(cross(d, up)), v = cross(u, d);
  d = norm([d[0] + (u[0] * Math.cos(ang) + v[0] * Math.sin(ang)) * Math.tan(rr), d[1] + (u[1] * Math.cos(ang) + v[1] * Math.sin(ang)) * Math.tan(rr), d[2] + (u[2] * Math.cos(ang) + v[2] * Math.sin(ang)) * Math.tan(rr)]);
  const tWall = rayMap(room.map, o, d, 250);
  // przeciwnik cofnięty o opóźnienie strzelającego (to, co widział na ekranie)
  let hit = null;
  if (op.live && op.hp > 0) { const back = Math.min(REWIND_MAX, me.rtt + 0.07); hit = rayBean(o, d, stateAt(op, now - back)); }
  const end = (t) => [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t].map((x) => +x.toFixed(2));
  const landed = !!(hit && hit.t < tWall);
  // trafienie w głowę zza osłony (murek zasłania tułów) nie liczy się do odsetka trafień w głowę – tam inaczej się nie da
  let open = true;
  if (landed && hit.head) { const ts = stateAt(op, now - Math.min(REWIND_MAX, me.rtt + 0.07)), dr = CROUCH_DROP * (ts.cr || 0); open = visibleLine(room.map, o, [ts.x, ts.y + 0.95 - dr, ts.z]) || visibleLine(room.map, o, [ts.x, ts.y + 0.6 - dr, ts.z]); }
  analyzeShot(room, seat, o, aimDir, landed, landed && hit.head, open, W, now, q);
  room.rec.sh.push([Math.round((now - room.t0) * 100) / 100, seat, o.map((x) => +x.toFixed(2)), end(landed ? hit.t : Math.min(tWall, 120)), landed ? (hit.head ? 2 : 1) : 0]);
  if (hit && hit.t < tWall) {
    const dmg = Math.round(W.dmg * (hit.head ? W.head : 1));
    op.hp = Math.max(0, op.hp - dmg);
    out(1 - seat, { t: 'dmg', d: dmg, hp: op.hp, h: hit.head });
    out(seat, { t: 'hc', h: hit.head, k: op.hp <= 0 });
    out(1 - seat, { t: 'sh', a: o.map((x) => +x.toFixed(2)), b: end(hit.t), w: wid });
    if (op.hp <= 0) roundWon(room, seat, now, out);
  } else out(1 - seat, { t: 'sh', a: o.map((x) => +x.toFixed(2)), b: end(Math.min(tWall, 120)), w: wid });
}
// ---------------- telemetria celowania (aimbot, triggerbot, silent aim, skrypty na odrzut) ----------------
// Gracz przysyła kąty kamery z każdej klatki (pole 'a' w paczce ruchu). Serwer porównuje je z tym, gdzie naprawdę był
// przeciwnik (stan cofnięty o opóźnienie), i zbiera statystyki do oceny ryzyka po meczu (ochrona.mjs).
const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
const dirOf = (yaw, pitch) => [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
const wrapPi = (a) => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
// odległość kątowa dwóch kierunków kamery (yaw, pitch) – szybka, bez wektorów
const angYP = (y1, p1, y2, p2) => Math.hypot(wrapPi(y2 - y1) * Math.cos((p1 + p2) / 2), p2 - p1);
// błąd celowania (rad) do głowy i do środka tułowia przeciwnika w stanie s, z oka gracza e; radius = kątowa połowa szerokości fasolki
function aimErr(e, dir, s) {
  const drop = CROUCH_DROP * (s.cr || 0), head = [s.x, s.y + 1.35 - drop, s.z], body = [s.x, s.y + 0.95 - drop, s.z];
  const toH = norm([head[0] - e[0], head[1] - e[1], head[2] - e[2]]), toB = norm([body[0] - e[0], body[1] - e[1], body[2] - e[2]]);
  const dist = Math.hypot(body[0] - e[0], body[1] - e[1], body[2] - e[2]);
  return { head: ang(dir, toH), body: ang(dir, toB), radius: Math.atan2(0.34, Math.max(0.5, dist)), dist };
}
function analyzeShot(room, seat, o, aimDir, landed, head, open, W, now, qn) {
  const me = room.p[seat], op = room.p[1 - seat], an = me.an;
  an.shots++; if (landed) { an.hits++; if (head) an.heads++; if (!head || open) { an.hitsOpen++; if (head) an.headsOpen++; } }
  const back = Math.min(REWIND_MAX, me.rtt + 0.07), tgt = stateAt(op, now - back), err = aimErr(o, aimDir, tgt);
  // czas reakcji: od chwili, gdy serwer pokazał przeciwnika, do pierwszego trafienia (minus opóźnienie sieci i wygładzanie obrazu);
  // pomijamy „prefire” (strzelanie na ślepo w róg tuż przed wyjściem przeciwnika)
  if (landed && !me.reacted && me.visSince) { if (!me.preFire) an.reactions.push(+Math.max(0, now - me.visSince - me.rtt - 0.07).toFixed(3)); me.reacted = true; }
  const first = now - me.lastShotT > 0.3;                          // pierwszy strzał serii
  // strzały w biegnącego przeciwnika na widoku: jaka część padła z celownikiem na nim (tułów albo głowa). Człowiek strzela też,
  // gdy celownik ucieka; triggerbot i aimbot prawie tylko wtedy, gdy jest na celu
  const t0 = stateAt(op, now - back - 0.1), off = Math.min(err.body, err.head);
  if (me.visOpp && off < 0.5 && err.dist >= 3 && Math.hypot(tgt.x - t0.x, tgt.z - t0.z) / 0.1 >= 2.5) { an.shotsSeen++; if (off < err.radius) an.shotsOn++; }
  // serie z broni automatycznej: błąd celowania względem rozmiaru celu (idealnie równy przy odrzucie = skrypt)
  const auto = W.rpm >= 500, e = err.body / err.radius;
  if (auto && me.spray && now - me.lastShotT < 0.2) { me.spray.n++; me.spray.hits += landed ? 1 : 0; me.spray.errs.push(e); }
  else { endSpray(me); me.spray = auto ? { n: 1, hits: landed ? 1 : 0, errs: [e] } : null; }
  me.lastShotT = now;
  // ruch kamery wokół strzału sprawdzamy, gdy przyjdą próbki z klatek po nim (paczka ruchu co 50 ms)
  if (me.pending.length < 64) me.pending.push({ t: now, qn, aimDir, back, landed, head, first, onTgt: err.body < err.radius, near: err.body < Math.max(0.035, err.radius * 1.5) });
}
// szczegóły jednego strzału na tle próbek kamery: silent aim, snap aimbota, flick, czas od wejścia celownika na cel (triggerbot)
function aimDetail(room, seat, q) {
  const me = room.p[seat], op = room.p[1 - seat], an = me.an;
  const win = me.aim.filter((s) => s.q === undefined && s.t >= q.t - 0.3 && s.t <= q.t + 0.08), a = me.aim.filter((s) => s.q === undefined);
  if (win.length < 2) { an.noSamp++; return; }
  // silent aim: gra wysyła próbkę kamery z chwili strzału (ten sam numer co strzał). U uczciwego gracza kierunek strzału
  // to dokładnie ta próbka. Inny kierunek = pocisk poleciał tam, gdzie kamera nie patrzyła. Próbka dopisana „pod strzał”,
  // odstająca od klatek przed i po nim, to kamera, która skoczyła na cel tylko na czas strzału.
  const shotS = me.aim.find((s) => s.q === q.qn);
  if (!shotS) an.noShotSamp++;
  else {
    const dShot = ang(dirOf(shotS.yaw, shotS.pitch), q.aimDir);
    if (dShot > 0.006) an.mismatch++;
    const prev = win.filter((s) => s.t <= shotS.t + 0.001).pop(), next = win.find((s) => s.t > shotS.t + 0.001);
    if (prev && next && next.t - prev.t < 0.06) {
      let d = Infinity; for (let k = 0; k <= 8; k++) { const f = k / 8; d = Math.min(d, angYP(prev.yaw + wrapPi(next.yaw - prev.yaw) * f, prev.pitch + (next.pitch - prev.pitch) * f, shotS.yaw, shotS.pitch)); }
      if (d > 0.035 && q.near) an.spikes++;
    }
  }
  // snap: z bezruchu jednym skokiem kamery (jedna klatka, > 10 rad/s) prosto na cel i znów bezruch do strzału – ręka tak nie potrafi
  for (let k = 1; k < win.length; k++) {
    const s0 = win[k - 1], s1 = win[k], dt = s1.t - s0.t;
    if (s1.t < q.t - 0.15 || s1.t > q.t + 0.008 || dt <= 0 || dt > 0.025) continue;   // skok kończy się przed strzałem (najpóźniej w jego klatce)
    const step = angYP(s0.yaw, s0.pitch, s1.yaw, s1.pitch); if (step < 0.25 || step / dt < 10) continue;
    let pre = 0, post = 0;
    for (let j = k - 1; j > 0 && s0.t - win[j - 1].t < 0.07; j--) pre += angYP(win[j - 1].yaw, win[j - 1].pitch, win[j].yaw, win[j].pitch);
    for (let j = k + 1; j < win.length && win[j].t <= q.t + 0.01; j++) post += angYP(win[j - 1].yaw, win[j - 1].pitch, win[j].yaw, win[j].pitch);
    const preN = win.filter((s) => s.t < s0.t && s0.t - s.t < 0.07).length;
    if (preN >= 2 && pre < 0.04 && post < 0.04 && q.onTgt) { an.snaps++; if (q.landed && q.head) an.snapHeads++; if (globalThis.__snapDbg) globalThis.__snapDbg({ q, k, win }); }
    break;
  }
  // flick: obrót > 20° w 100–200 ms zakończony na celu (zdarza się też ludziom – słaby sygnał)
  const cur = win.filter((s) => s.t <= q.t + 0.01).pop();
  if (cur) {
    const prev = win.filter((s) => cur.t - s.t >= 0.1 && cur.t - s.t <= 0.2).pop();
    if (prev && angYP(prev.yaw, prev.pitch, cur.yaw, cur.pitch) > 0.35 && q.onTgt) { an.flicks++; if (q.landed && q.head) an.flickHeads++; }
  }
  // triggerbot: pierwszy strzał serii oddany, gdy celownik przelatywał po przeciwniku (szybki ruch kamery) – człowiek
  // naciska spust po zatrzymaniu celownika, program w klatce, w której celownik przechodzi przez cel
  if (q.first && q.onTgt) {
    const p0 = win.filter((s) => s.t <= q.t).pop(), p1 = win.find((s) => s.t > q.t);
    if (p0 && p1 && p1.t - p0.t < 0.05) { an.firstOn++; if (angYP(p0.yaw, p0.pitch, p1.yaw, p1.pitch) / (p1.t - p0.t) > 2.5) an.sweep++; }
  }
  // czas od wejścia celownika na przeciwnika do strzału (pierwszy strzał serii)
  if (q.first && q.onTgt && cur) {
    const eye = [me.x, EYE(me), me.z];
    for (let i = a.indexOf(cur); i > 0 && q.t - a[i].t < 1.0; i--) {
      const st = stateAt(op, a[i - 1].t - q.back), e = aimErr(eye, dirOf(a[i - 1].yaw, a[i - 1].pitch), st);
      if (e.body > e.radius * 1.15) { an.trigger.push(+Math.max(0, q.t - a[i].t).toFixed(3)); break; }
    }
  }
}
function processAim(room, seat, now, flush) {
  const me = room.p[seat];
  while (me.pending.length && (flush || now - me.pending[0].t >= 0.09)) aimDetail(room, seat, me.pending.shift());
}
// śledzenie: jak długo celownik trzyma się poruszającego się przeciwnika, gdy ten jest na widoku i przed graczem
function trackSample(room, seat, now) {
  const me = room.p[seat], op = room.p[1 - seat];
  if (room.phase !== 'live' || !me.visOpp || !op.live || op.hp <= 0 || me.hp <= 0) return;
  const back = Math.min(REWIND_MAX, me.rtt + 0.07), st = stateAt(op, now - back), st0 = stateAt(op, now - back - 0.1);
  if (Math.hypot(st.x - st0.x, st.z - st0.z) / 0.1 < 2.5) return;   // przeciwnik stoi – trzymanie celu nic nie mówi
  const e = aimErr([me.x, EYE(me), me.z], dirOf(me.yaw, me.pitch), st);
  if (e.dist < 3 || Math.min(e.body, e.head) > 0.5) return;       // za blisko albo poza polem widzenia
  const off = Math.min(e.body, e.head);                            // celownik na tułowiu albo na głowie
  me.an.track.n++; if (off < e.radius * 0.5) me.an.track.on++; if (off < e.radius) me.an.track.on1++;
}
function endSpray(p) {
  const sp = p.spray; p.spray = null; if (!sp || sp.n < 6) return;
  const m = sp.errs.reduce((x, y) => x + y, 0) / sp.n, sd = Math.sqrt(sp.errs.reduce((x, y) => x + (y - m) ** 2, 0) / sp.n);
  p.an.sprays.push({ n: sp.n, hits: sp.hits, mean: +m.toFixed(3), sd: +sd.toFixed(3) });
}
// statystyki gracza po meczu (do oceny ryzyka w ochrona.mjs)
export function playerStats(room, seat) {
  const p = room.p[seat]; processAim(room, seat, Infinity, true); endSpray(p);
  const r = p.an.rtts.slice().sort((x, y) => x - y);
  return { ...p.an, rtt: +p.rtt.toFixed(3), rttMax: r.length ? r[r.length - 1] : 0, rttMed: r.length ? r[r.length >> 1] : 0 };
}
// bryły mapy (do rysowania powtórki w panelu admina)
export const mapBoxes = (name) => (MAPS[name] ? MAPS[name].boxes.map((b) => [b.x0, b.y0, b.z0, b.x1, b.y1, b.z1].map((v) => +v.toFixed(2))) : null);
function finishReload(p) { const id = WEAPON_IDS[p.reloadW], W = WEAPONS[id], a = p.ammo[id], n = Math.min(W.mag - a.mag, a.res); a.mag += n; a.res -= n; p.reloadW = -1; }
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };

function roundWon(room, w, now, out) {
  room.score[w]++; room.phase = 'inter';
  room.rec.rd.push([Math.round((now - room.t0) * 100) / 100, w]);
  room.p.forEach((p) => { p.live = false; });
  out(-1, { t: 'round', winner: w, score: room.score.slice() });
  if (room.score[w] >= 3) { room.over = true; room.winner = w; return; }
  startRound(room, now, ROUND_DELAY);
}

// ---------------- widoczność przeciwnika (anty-wallhack) ----------------
function canSee(room, viewer, target, now) {
  const map = room.map, e = [viewer.x, EYE(viewer), viewer.z];
  const drop = CROUCH_DROP * target.cr;
  const dx = target.x - viewer.x, dz = target.z - viewer.z, L = Math.hypot(dx, dz) || 1, sx = -dz / L * 0.32, sz = dx / L * 0.32;
  const pts = [[target.x, target.y + 1.45 - drop, target.z], [target.x, target.y + 1.0 - drop, target.z], [target.x, target.y + 0.2, target.z],
    [target.x + sx, target.y + 1.0 - drop, target.z + sz], [target.x - sx, target.y + 1.0 - drop, target.z - sz]];
  // wyprzedzenie: gdzie obaj będą za ~0,15 s (żeby przeciwnik nie „wyskakiwał” zza rogu z opóźnieniem)
  const lead = (p) => { const h = p.hist; if (h.length < 2) return [0, 0]; const a = h[h.length - 2], b = h[h.length - 1], dt = Math.max(0.02, b.t - a.t); return [(b.x - a.x) / dt * 0.15, (b.z - a.z) / dt * 0.15]; };
  const [lvx, lvz] = lead(viewer), [ltx, ltz] = lead(target);
  for (const [ox, oz, tx, tz] of [[0, 0, 0, 0], [lvx, lvz, ltx, ltz]]) {
    const eye = [e[0] + ox, e[1], e[2] + oz];
    for (const p of pts) if (visibleLine(map, eye, [p[0] + tx, p[1], p[2] + tz])) return true;
  }
  return false;
}

// ---------------- wiadomości ----------------
// out(seat, msg): seat = 0/1 do jednego gracza, -1 do obu
export function handleMessage(room, seat, m, now, out) {
  const me = room.p[seat];
  if (room.over) return;
  switch (m.t) {
    case 'st': {
      if (!Array.isArray(m.s)) return;
      if (me.lastStT && now - me.lastStT > 0.3 && room.phase === 'live' && me.live) me.an.gaps++;   // przerwa w paczkach (lag switch)
      me.lastStT = now;
      // próbki kamery z każdej klatki od ostatniej paczki: [ile ms temu, yaw, pitch]
      if (Array.isArray(m.a)) for (const sm of m.a.slice(-24)) {
        if (!Array.isArray(sm) || sm.length < 3 || sm.length > 4 || !sm.every(Number.isFinite)) continue;
        const smp = { t: now - Math.max(0, Math.min(0.5, sm[0] / 1000)), yaw: sm[1], pitch: Math.max(-1.6, Math.min(1.6, sm[2])) };
        if (sm.length === 4) smp.q = sm[3]; else me.an.samples++;
        me.aim.push(smp);
      }
      me.aim.sort((x, y) => x.t - y.t); while (me.aim.length && now - me.aim[0].t > 2.5) me.aim.shift();
      processAim(room, seat, now, false);
      if (!me.inited) return;
      const [x, y, z, yaw, pitch, cr, run, air, sl, legYaw, w, ads] = m.s.map(Number);
      const s = { x, y, z, yaw: yaw || 0, pitch: pitch || 0, cr: clamp01(cr), run: clamp01(run), air: clamp01(air), sl: clamp01(sl), legYaw: legYaw || 0, w: WEAPON_IDS[w | 0] ? w | 0 : 0, ads: ads > 0.5 ? 1 : 0 };
      if (s.w !== me.w && me.reloadW >= 0) me.reloadW = -1;          // zmiana broni przerywa przeładowanie
      const why = checkMove(room, me, s, now);
      if (why) {
        // w powietrzu wracamy do ostatniego miejsca na ziemi (inaczej gracz zostałby zawieszony w powietrzu)
        if ((why === 'wisi w powietrzu' || why === 'za wysoko') && me.gx !== undefined) Object.assign(me, { x: me.gx, y: me.gy, z: me.gz, airSince: 0, lastGroundY: me.gy, trail: [] });
        if (now - (me.lastFix || 0) > 0.25) { me.lastFix = now; out(seat, { t: 'fix', p: [me.x, me.y, me.z].map((v) => +v.toFixed(3)) }); }
        room.log.push(`${seat}: ${why}`);
        if (violation(me, why, now)) { me.kicked = true; room.log.push(`${seat}: wyrzucony za oszukiwanie ruchu`); }
        me.lastT = now;                                               // nie kumulujemy budżetu ruchu
        return;
      }
      acceptMove(room, me, s, now);
      trackSample(room, seat, now);
      relayState(room, seat, now, out);
      return;
    }
    case 'sh': shoot(room, seat, m, now, out); return;
    case 'rl': {
      const id = WEAPON_IDS[me.w], a = me.ammo[id];
      if (me.reloadW < 0 && a.mag < WEAPONS[id].mag && a.res > 0) { me.reloadW = me.w; me.reloadAt = now + WEAPONS[id].reload * 0.9; }
      return;
    }
    case 'rs': if (room.phase !== 'live') placeAtSpawn(room, seat, now); return;
    case 'lv': if (room.phase !== 'inter' && now >= room.liveAt - 1.2) { me.live = true; if (room.phase === 'count') room.phase = 'live'; } return;
    case 'po': { const rtt = now - (+m.s || 0); if (rtt >= 0 && rtt < 2) { me.rtt = me.rtt * 0.7 + rtt * 0.3; me.an.rtts.push(+rtt.toFixed(3)); if (me.an.rtts.length > 200) me.an.rtts.shift(); } return; }
  }
}
const clamp01 = (v) => (v > 1 ? 1 : v > 0 ? v : 0);

// przekazanie stanu gracza seat przeciwnikowi (albo „schowany”, gdy go nie widać)
function relayState(room, seat, now, out) {
  const me = room.p[seat], op = room.p[1 - seat];
  const vis = canSee(room, op, me, now);
  if (vis && !op.visOpp) { op.visSince = now; op.reacted = false; op.preFire = now - op.lastShotT < 0.4; }
  op.visOpp = vis;
  if (vis) me.seenT = now;
  if (vis || now - me.seenT < 0.35) {                             // chwilę po zniknięciu jeszcze wysyłamy (bez migania na krawędzi)
    me.hiddenSent = false;
    out(1 - seat, { t: 'st', s: [me.x, me.y, me.z, me.yaw, me.pitch, me.cr, me.run, me.air, me.sl, me.legYaw, me.w].map((v) => +(+v).toFixed(3)) });
  } else if (!me.hiddenSent || now - (me.hiddenT || 0) > 1) { me.hiddenSent = true; me.hiddenT = now; out(1 - seat, { t: 'st', s: null }); }
}

// co ~100 ms: wymuszenie startu rundy, gdy klient nie zgłosił 'lv', i pingi do pomiaru opóźnienia
export function tick(room, now, out) {
  if (room.over) return;
  if (room.phase === 'count') room.p.forEach((p, s) => { if (!p.inited && now >= room.liveAt - 0.5) { placeAtSpawn(room, s, now); out(s, { t: 'fix', p: [p.x, p.y, p.z] }); } });
  if ((room.phase === 'count') && now >= room.liveAt + LIVE_GRACE) { room.p.forEach((p) => { p.live = true; }); room.phase = 'live'; }
  if (room.phase === 'live') room.p.forEach((p, s) => { if (!p.live && now >= room.liveAt + LIVE_GRACE) p.live = true; });
  if (!room.pingT || now - room.pingT > 2) { room.pingT = now; out(-1, { t: 'pi', s: +now.toFixed(3) }); }
  room.p.forEach((p) => { if (p.reloadW >= 0 && now >= p.reloadAt) finishReload(p); });
}
export { START_DELAY, ROUND_DELAY, acceptMove as __accept, canSee as __canSee };
