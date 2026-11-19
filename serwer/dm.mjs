// Autorytatywny serwer trybu DEATHMATCH (do 20 graczy, 3 minuty, ranking: zabójstwa, potem zadane obrażenia).
// Jak w 1v1 (mecz.mjs) to SERWER decyduje o wszystkim, co ważne:
//  - ruch: prędkość, skok, ściany, wyjście poza mapę (zły ruch = korekta „fix”),
//  - strzały: szybkostrzelność, amunicja, przeładowanie, rozrzut, śruciny strzelby, spadek obrażeń z odległością,
//    trafienie w głowę albo tułów z kompensacją opóźnienia strzelającego,
//  - pancerz (kamizelka: +100 punktów na tułów; kamizelka z hełmem: też głowa, z mniejszymi obrażeniami głowy),
//  - zabójstwa, kasa meczu (nagroda za zabójstwo, ×3 za gracza WANTED), status WANTED (pierwsze miejsce w rankingu),
//  - sklep po śmierci (zakupy sprawdza serwer), odrodzenie w bezpiecznym miejscu z ochroną, zegar meczu i wynik końcowy,
//  - widoczność: gracz dostaje pozycje tylko tych przeciwników, których może zobaczyć (wallhack nic nie pokaże).
// Moduł nie zna WebSocketu ani bazy: serwer.mjs woła createRoom / handleMessage / tick / leave i wysyła to, co dostanie w out(pid, msg).
import * as MECZ from './mecz.mjs';

// kolejność jak WEAPON_IDS w grze (zrodla/weaponry.js) – w paczkach ruchu broń to indeks w tej liście
export const WIDS = ['akm', 'm4a1', 'glock17', 'deagle', 'spas12', 'mp5k', 'akmgold'];   // akmgold: złoty AKM – jeszcze nie w trybie (brak w DM_GUNS)
export const DM_GUNS = ['glock17', 'deagle', 'spas12', 'mp5k', 'akm', 'm4a1'];   // bronie trybu, w kolejności slotów (1 = pistolet startowy)
export const PISTOL = 'glock17';

// ---------------- ustawienia (panel admina może zmienić każdą wartość) ----------------
export const DEFAULTS = {
  maxPlayers: 20, minPlayers: 2, queueTimeout: 60,     // kolejka: najwyżej tylu graczy; po queueTimeout s start z tyloma, ilu jest (co najmniej minPlayers)
  duration: 180, startDelay: 7, endDelay: 16,          // mecz 3 min; odliczanie przed startem; podium po meczu
  startMoney: 0, killReward: 300, wantedMult: 3, wantedMinKills: 1,
  spawnProtect: 2.5, minDeathTime: 2.4, shopTimeout: 30,   // ochrona po odrodzeniu (s), najkrótsza śmierć (ekran WASTED), po tylu s w sklepie gracz wraca sam
  houseFee: 0.10, prizeSplit: [0.5, 0.3, 0.2],          // prowizja od puli wpisowego; podział puli na miejsca 1–3
  tiers: [
    { id: 'free', name: 'Free', entry: 0 },
    { id: 'bronze', name: 'Bronze', entry: 1 },
    { id: 'silver', name: 'Silver', entry: 5 },
    { id: 'gold', name: 'Gold', entry: 20 },
  ],
  maps: ['Oaza', 'Magazyn', 'Baza'],
  armor: {
    vest: { name: 'Body Armor', price: 650, hp: 100 },
    helmet: { name: 'Body Armor + Helmet', price: 1000, hp: 100, headMult: 0.55 },   // hełm: obrażenia głowy ×0,55 i najpierw z pancerza
  },
  // falloff: [od ilu m spada, przy ilu m minimum, mnożnik minimum]; recoil/spread jak w grze (radiany)
  weapons: {
    glock17: { name: 'Glock-17',     price: 0,    dmg: 24, head: 2.4, rpm: 400, auto: false, mag: 17, reserve: 85,  reload: 1.75, pellets: 1, pelletSpread: 0,
               falloff: [22, 55, 0.6],  recoil: { pitch: 0.0065, yaw: 0.0028 }, spread: { hip: 0.006, ads: 0.002, move: 0.7, bloom: 0.12 } },
    deagle:  { name: 'Desert Eagle', price: 500,  dmg: 48, head: 2.6, rpm: 267, auto: false, mag: 7,  reserve: 35,  reload: 2.2,  pellets: 1, pelletSpread: 0,
               falloff: [30, 70, 0.75], recoil: { pitch: 0.021, yaw: 0.006 },   spread: { hip: 0.009, ads: 0.0016, move: 1.0, bloom: 0.32 } },
    spas12:  { name: 'SPAS-12',      price: 900,  dmg: 15, head: 1.6, rpm: 72,  auto: false, mag: 8,  reserve: 32,  reload: 2.6,  pellets: 9, pelletSpread: 0.052,
               falloff: [7, 26, 0.2],   recoil: { pitch: 0.045, yaw: 0.008 },   spread: { hip: 0.004, ads: 0.003, move: 0.4, bloom: 0.1 } },
    mp5k:    { name: 'MP5K',         price: 1250, dmg: 25, head: 2.5, rpm: 900, auto: true,  mag: 30, reserve: 120, reload: 2.1,  pellets: 1, pelletSpread: 0,
               falloff: [18, 45, 0.6],  recoil: { pitch: 0.0072, yaw: 0.004 },  spread: { hip: 0.0075, ads: 0.0022, move: 0.8, bloom: 0.09 } },
    akm:     { name: 'AKM',          price: 1700, dmg: 34, head: 2.8, rpm: 600, auto: true,  mag: 30, reserve: 120, reload: 2.45, pellets: 1, pelletSpread: 0,
               falloff: [30, 80, 0.7],  recoil: { pitch: 0.0125, yaw: 0.0045 }, spread: { hip: 0.0075, ads: 0.0016, move: 1.15, bloom: 0.14 } },
    m4a1:    { name: 'M4A1',         price: 1900, dmg: 30, head: 3,   rpm: 700, auto: true,  mag: 30, reserve: 120, reload: 2.3,  pellets: 1, pelletSpread: 0,
               falloff: [35, 90, 0.72], recoil: { pitch: 0.0092, yaw: 0.0032 }, spread: { hip: 0.0065, ads: 0.0011, move: 1.0, bloom: 0.11 } },
  },
};

// scalanie ustawień admina z domyślnymi (tylko znane klucze, liczby w rozsądnych granicach)
const num = (v, lo, hi, d) => { const n = +v; return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
export function sanitizeConfig(src = {}) {
  const D = DEFAULTS, s = src || {}, o = {};
  o.maxPlayers = Math.round(num(s.maxPlayers, 2, 20, D.maxPlayers));
  o.minPlayers = Math.round(num(s.minPlayers, 2, o.maxPlayers, D.minPlayers));
  o.queueTimeout = num(s.queueTimeout, 5, 600, D.queueTimeout);
  o.duration = num(s.duration, 30, 1800, D.duration);
  o.startDelay = num(s.startDelay, 3, 30, D.startDelay);
  o.endDelay = num(s.endDelay, 6, 60, D.endDelay);
  o.startMoney = Math.round(num(s.startMoney, 0, 100000, D.startMoney));
  o.killReward = Math.round(num(s.killReward, 0, 100000, D.killReward));
  o.wantedMult = num(s.wantedMult, 1, 20, D.wantedMult);
  o.wantedMinKills = Math.round(num(s.wantedMinKills, 0, 100, D.wantedMinKills));
  o.spawnProtect = num(s.spawnProtect, 0, 10, D.spawnProtect);
  o.minDeathTime = num(s.minDeathTime, 0.5, 10, D.minDeathTime);
  o.shopTimeout = num(s.shopTimeout, 5, 300, D.shopTimeout);
  o.houseFee = num(s.houseFee, 0, 0.5, D.houseFee);
  const sp = Array.isArray(s.prizeSplit) && s.prizeSplit.length === 3 ? s.prizeSplit.map((v, i) => num(v, 0, 1, D.prizeSplit[i])) : D.prizeSplit.slice();
  const sum = sp.reduce((a, b) => a + b, 0) || 1; o.prizeSplit = sp.map((v) => Math.round((v / sum) * 1000) / 1000);
  const tiers = Array.isArray(s.tiers) && s.tiers.length ? s.tiers : D.tiers;
  o.tiers = tiers.slice(0, 8).map((t, i) => ({ id: String(t.id || 'tier' + i).replace(/[^a-z0-9_-]/gi, '').slice(0, 16) || 'tier' + i,
    name: String(t.name || '').slice(0, 24) || 'Tier ' + (i + 1), entry: Math.round(num(t.entry, 0, 1000, 0) * 100) / 100 }));
  { const seen = new Set(); o.tiers = o.tiers.filter((t) => !seen.has(t.id) && seen.add(t.id)); }
  const maps = Array.isArray(s.maps) ? s.maps.filter((m) => D.maps.includes(m)) : []; o.maps = maps.length ? maps : D.maps.slice();
  o.armor = {};
  for (const k of ['vest', 'helmet']) { const a = (s.armor || {})[k] || {}, d = D.armor[k];
    o.armor[k] = { name: String(a.name || d.name).slice(0, 32), price: Math.round(num(a.price, 0, 100000, d.price)), hp: Math.round(num(a.hp, 1, 500, d.hp)) };
    if (k === 'helmet') o.armor[k].headMult = num(a.headMult, 0, 1, d.headMult); }
  o.weapons = {};
  for (const id of DM_GUNS) {
    const w = (s.weapons || {})[id] || {}, d = D.weapons[id], f = Array.isArray(w.falloff) ? w.falloff : d.falloff;
    o.weapons[id] = {
      name: String(w.name || d.name).slice(0, 24), price: id === PISTOL ? 0 : Math.round(num(w.price, 0, 100000, d.price)),
      dmg: num(w.dmg, 1, 500, d.dmg), head: num(w.head, 1, 10, d.head), rpm: num(w.rpm, 10, 1500, d.rpm), auto: w.auto === undefined ? d.auto : !!w.auto,
      mag: Math.round(num(w.mag, 1, 200, d.mag)), reserve: Math.round(num(w.reserve, 0, 1000, d.reserve)), reload: num(w.reload, 0.3, 8, d.reload),
      pellets: Math.round(num(w.pellets, 1, 20, d.pellets)), pelletSpread: num(w.pelletSpread, 0, 0.3, d.pelletSpread),
      falloff: [num(f[0], 1, 500, d.falloff[0]), num(f[1], 1, 600, d.falloff[1]), num(f[2], 0, 1, d.falloff[2])],
      recoil: { pitch: num((w.recoil || {}).pitch, 0, 0.2, d.recoil.pitch), yaw: num((w.recoil || {}).yaw, 0, 0.1, d.recoil.yaw) },
      spread: { hip: num((w.spread || {}).hip, 0, 0.2, d.spread.hip), ads: num((w.spread || {}).ads, 0, 0.2, d.spread.ads), move: num((w.spread || {}).move, 0, 5, d.spread.move), bloom: num((w.spread || {}).bloom, 0, 1, d.spread.bloom) },
    };
    if (o.weapons[id].falloff[1] < o.weapons[id].falloff[0]) o.weapons[id].falloff[1] = o.weapons[id].falloff[0];
  }
  return o;
}
// to, co dostaje przeglądarka (ceny, statystyki do przewidywania strzałów, zasady)
export const publicConfig = (c) => ({ duration: c.duration, killReward: c.killReward, wantedMult: c.wantedMult, startMoney: c.startMoney, spawnProtect: c.spawnProtect,
  minDeathTime: c.minDeathTime, shopTimeout: c.shopTimeout, maxPlayers: c.maxPlayers, minPlayers: c.minPlayers, queueTimeout: c.queueTimeout,
  houseFee: c.houseFee, prizeSplit: c.prizeSplit, tiers: c.tiers, armor: c.armor, weapons: c.weapons, guns: DM_GUNS });

// ---------------- szybki promień po siatce mapy (DDA po komórkach 2 m) ----------------
// mecz.mjs sprawdza wszystkie bryły (2 graczy); przy 20 graczach i setkach promieni na sekundę przechodzimy tylko przez komórki na drodze promienia
let stamp = 1; const STAMPS = new WeakMap();
export function rayGrid(map, o, d, tMax) {
  const { g, C } = map.grid; let st = STAMPS.get(map); if (!st) { st = new Uint32Array(map.boxes.length); STAMPS.set(map, st); }
  const tag = ++stamp; if (stamp > 4e9) { stamp = 1; st.fill(0); }
  let cx = Math.floor(o[0] / C), cz = Math.floor(o[2] / C);
  const sx = d[0] > 0 ? 1 : -1, sz = d[2] > 0 ? 1 : -1;
  const ax = Math.abs(d[0]) < 1e-12 ? Infinity : C / Math.abs(d[0]), az = Math.abs(d[2]) < 1e-12 ? Infinity : C / Math.abs(d[2]);
  let tx = Math.abs(d[0]) < 1e-12 ? Infinity : ((cx + (d[0] > 0 ? 1 : 0)) * C - o[0]) / d[0];
  let tz = Math.abs(d[2]) < 1e-12 ? Infinity : ((cz + (d[2] > 0 ? 1 : 0)) * C - o[2]) / d[2];
  let best = tMax, t = 0;
  const lim = Math.ceil(Math.max(map.bx, map.bz) / C) + 3;
  for (let guard = 0; guard < 400; guard++) {
    const list = g.get(cx * 4096 + cz);
    if (list) for (const i of list) { if (st[i] === tag) continue; st[i] = tag; const b = map.boxes[i], h = boxT(o, d, b); if (h < best) best = h; }
    const exit = Math.min(tx, tz);
    if (best <= exit || exit >= tMax) break;
    t = exit; if (tx < tz) { cx += sx; tx += ax; } else { cz += sz; tz += az; }
    if (Math.abs(cx) > lim || Math.abs(cz) > lim) break;
    const y = o[1] + d[1] * t; if ((y > 30 && d[1] > 0) || (y < -1 && d[1] < 0)) break;
  }
  // podłoga (y = 0)
  if (d[1] < -1e-9) { const tf = -o[1] / d[1]; if (tf > 0 && tf < best) best = tf; }
  return best;
}
function boxT(o, d, b) {
  let t0 = 0, t1 = Infinity;
  for (let k = 0; k < 3; k++) {
    const oo = o[k], dd = d[k], lo = k === 0 ? b.x0 : k === 1 ? b.y0 : b.z0, hi = k === 0 ? b.x1 : k === 1 ? b.y1 : b.z1;
    if (Math.abs(dd) < 1e-12) { if (oo < lo || oo > hi) return Infinity; continue; }
    let a = (lo - oo) / dd, c = (hi - oo) / dd; if (a > c) { const s = a; a = c; c = s; }
    if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) return Infinity;
  }
  return t0;
}
function lineClear(map, a, b) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(d[0], d[1], d[2]); if (L < 1e-6) return true;
  return rayGrid(map, a, [d[0] / L, d[1] / L, d[2] / L], L) >= L - 0.05;
}

// ---------------- punkty odrodzenia: siatka 1 m na podłodze, osiągalna z punktu startu mapy ----------------
const SPAWNS = new WeakMap();
function spawnGrid(map) {
  if (SPAWNS.has(map)) return SPAWNS.get(map);
  const S = 1, nx = Math.floor(map.bx / S) - 1, nz = Math.floor(map.bz / S) - 1, free = new Map();
  const blocked = (x, z) => MECZ.near(map, x, z, 0.75).some((b) => b.y0 < 1.9 && b.y1 > 0.3 && x > b.x0 - 0.55 && x < b.x1 + 0.55 && z > b.z0 - 0.55 && z < b.z1 + 0.55);
  for (let i = -nx; i <= nx; i++) for (let j = -nz; j <= nz; j++) if (!blocked(i * S, j * S)) free.set(i * 4096 + j, [i * S, j * S]);
  // dostępne z miejsc startu mapy (przejście po sąsiednich wolnych komórkach)
  const seen = new Set(), q = [];
  for (const s of map.spawns || []) { const k = Math.round(s.x / S) * 4096 + Math.round(s.z / S); if (free.has(k) && !seen.has(k)) { seen.add(k); q.push(k); } }
  while (q.length) { const k = q.pop(), i = Math.round(k / 4096), j = k - i * 4096;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = (i + a) * 4096 + (j + b); if (free.has(n) && !seen.has(n)) { seen.add(n); q.push(n); } } }
  // z zapasem: wszystkie 8 sąsiadów wolne (nie w kącie, nie wciśnięty w ścianę)
  const out = [];
  for (const k of seen) { const i = Math.round(k / 4096), j = k - i * 4096; let ok = true;
    for (let a = -1; a <= 1 && ok; a++) for (let b = -1; b <= 1; b++) if (!seen.has((i + a) * 4096 + (j + b))) { ok = false; break; }
    if (ok) out.push(free.get(k)); }
  const list = out.length >= 8 ? out : [...seen].map((k) => free.get(k));
  SPAWNS.set(map, list); return list;
}

// ---------------- pokój ----------------
const RW = 0.12;                                            // ile s po śmierci przeciwnik jeszcze jest w historii (żeby strzał oddany chwilę przed śmiercią się liczył)
function newPlayer(pid, info, cfg) {
  return { pid, uid: info.uid, nick: info.nick, skin: info.skin || '', bot: !!info.bot,
    x: 0, y: 0, z: 0, yaw: 0, pitch: 0, cr: 0, sl: 0, ads: 0, w: WIDS.indexOf(PISTOL), run: 0, air: 0, legYaw: 0,
    hp: 100, armor: 0, helmet: false, alive: false, dead: true, deadAt: -99, life: 0, protUntil: 0, inShop: false,
    money: cfg.startMoney, kills: 0, deaths: 0, damage: 0, heads: 0, shots: 0, hits: 0, streak: 0, best: 0, joinOrder: pid,
    owned: new Set([PISTOL]), ammo: {}, reloadW: -1, reloadAt: 0, bloom: 0, bloomT: 0, tokens: 1, tokT: 0, lastQ: 0,
    lastT: 0, lastGroundY: 0, airSince: 0, ground: true, hist: [], trail: [], viol: [], kicked: false, left: false,
    rtt: 0.1, lastStT: 0, lastFix: 0, speed01: 0, killer: null, lastSpawnAt: -99, spawnIdx: -1, sent: new Map() };
}
function refillOwned(p, cfg) { p.ammo = {}; for (const id of p.owned) p.ammo[id] = { mag: cfg.weapons[id].mag, res: cfg.weapons[id].reserve }; p.reloadW = -1; p.bloom = 0; }

export function createRoom(cfg, mapName, players, now) {
  const map = MECZ.mapByName(mapName); if (!map) throw new Error('Brak mapy ' + mapName);
  if (!map.grid) throw new Error('Mapa bez siatki');
  const room = { cfg, map, mapName, phase: 'count', t0: now, liveAt: now + cfg.startDelay, endAt: now + cfg.startDelay + cfg.duration, overAt: Infinity,
    p: new Map(), order: [], wanted: 0, tick: 0, boardDirty: true, boardT: 0, log: [], over: false, results: null, recentSpawns: [] };
  players.forEach((info, i) => { const p = newPlayer(i + 1, info, cfg); room.p.set(p.pid, p); room.order.push(p.pid); });
  // pierwsze rozstawienie: każdy w innym miejscu, jak najdalej od pozostałych
  for (const p of room.p.values()) spawnPlayer(room, p, now, null, true);
  return room;
}
const alivePlayers = (room) => [...room.p.values()].filter((p) => p.alive && !p.left);

// ranking: zabójstwa, potem zadane obrażenia, potem mniej śmierci, potem kolejność dołączenia
export function ranking(room) {
  return [...room.p.values()].sort((a, b) => b.kills - a.kills || b.damage - a.damage || a.deaths - b.deaths || a.joinOrder - b.joinOrder);
}
function updateWanted(room, out) {
  const r = ranking(room).filter((p) => !p.left), top = r[0];
  const id = top && top.kills >= Math.max(1, room.cfg.wantedMinKills) ? top.pid : 0;
  if (id !== room.wanted) { const prev = room.wanted; room.wanted = id; out(-1, { t: 'wanted', id, prev }); }
}
function boardMsg(room) {
  return { t: 'board', r: ranking(room).map((p) => [p.pid, p.kills, p.deaths, Math.round(p.damage), p.left ? 1 : 0]), wanted: room.wanted };
}

// wybór punktu odrodzenia: daleko od żywych przeciwników, poza ich polem widzenia, nie przy zabójcy i nie tam, gdzie ktoś przed chwilą się pojawił
function pickSpawn(room, p, now, initial) {
  // mapy z wieloma punktami startu (mapy Deathmatch: ≥ 8) – tylko z nich; inne mapy – siatka podłogi
  const sp = room.map.spawns || [], grid = sp.length >= 8 ? sp.map((s) => [s.x, s.z, s.y || 0, s.yaw]) : spawnGrid(room.map), foes = alivePlayers(room).filter((q) => q !== p);
  const recent = room.recentSpawns.filter((s) => now - s.t < 6);
  let best = null, bestScore = -Infinity;
  const N = Math.min(grid.length, initial ? 80 : 48);
  for (let k = 0; k < N; k++) {
    const c = grid[(Math.random() * grid.length) | 0];
    let dMin = 40; for (const q of foes) { const d = Math.hypot(q.x - c[0], q.z - c[1]); if (d < dMin) dMin = d; }
    let score = Math.min(dMin, 28) * 2;
    if (dMin < 6) score -= 60;
    for (const s of recent) { const d = Math.hypot(s.x - c[0], s.z - c[1]); if (d < 6) score -= (6 - d) * 6; }
    if (p.killer) { const kq = room.p.get(p.killer); if (kq && kq.alive) score += Math.min(25, Math.hypot(kq.x - c[0], kq.z - c[1])) * 0.6; }
    if (score > bestScore - 40 && foes.length) {
      const head = [c[0], (c[2] || 0) + 1.4, c[1]]; let seen = 0;
      for (const q of foes) { if (Math.hypot(q.x - c[0], q.z - c[1]) > 45) continue; if (lineClear(room.map, [q.x, MECZ.EYE(q), q.z], head)) { seen++; if (seen > 1) break; } }
      score -= seen * 45;
    }
    score += Math.random() * 3;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  if (!best) best = [room.map.spawns[0].x, room.map.spawns[0].z, room.map.spawns[0].y || 0];
  // kierunek z mapy albo w stronę środka mapy
  return { x: best[0], y: best[2] || 0, z: best[1], yaw: Number.isFinite(best[3]) ? best[3] : Math.atan2(best[0], best[1]) };
}
function spawnPlayer(room, p, now, out, initial = false) {
  const s = pickSpawn(room, p, now, initial);
  p.life++;
  Object.assign(p, { x: s.x, y: s.y, z: s.z, yaw: s.yaw, pitch: 0, hp: 100, alive: true, dead: false, inShop: false, lastT: now, lastGroundY: s.y, airSince: 0, ground: true, gx: s.x, gy: s.y, gz: s.z,
    hist: [], trail: [], protUntil: (initial ? room.liveAt : now) + room.cfg.spawnProtect, lastSpawnAt: now, w: WIDS.indexOf(PISTOL), lastStT: now, killer: null });
  refillOwned(p, room.cfg);
  MECZ.pushHist(p, now);
  room.recentSpawns.push({ x: s.x, z: s.z, t: now }); if (room.recentSpawns.length > 40) room.recentSpawns.shift();
  const msg = { t: 'spawn', life: p.life, p: [s.x, s.y, s.z].map((v) => +v.toFixed(3)), yaw: +s.yaw.toFixed(3), prot: room.cfg.spawnProtect, ...invOf(p) };
  if (out) out(p.pid, msg); else p.pendingSpawn = msg;
}
const invOf = (p) => ({ money: p.money, owned: DM_GUNS.filter((g) => p.owned.has(g)), armor: p.armor, helmet: p.helmet, hp: p.hp });

// ---------------- ruch ----------------
function accept(p, s, now) {
  const map = p._map, ladder = MECZ.inLadder(map, s.x, s.y, s.z), sup = MECZ.supportTop(map, s.x, s.z, s.y);
  const sp = Math.hypot(s.x - p.x, s.z - p.z) / Math.max(0.02, now - p.lastT);
  Object.assign(p, { x: s.x, y: s.y, z: s.z, yaw: s.yaw, pitch: s.pitch, cr: s.cr, sl: s.sl, ads: s.ads, run: s.run, air: s.air, legYaw: s.legYaw, lastT: now });
  p.speed01 = Math.min(1, sp / 6.8);
  if (ladder || Math.abs(s.y - sup) < 0.15) { p.lastGroundY = ladder ? Math.max(s.y, sup) : s.y; p.airSince = 0; p.ground = true; p.gx = s.x; p.gy = s.y; p.gz = s.z; }
  else { if (!p.airSince) p.airSince = now; p.ground = false; }
  MECZ.pushHist(p, now);
  p.trail.push({ t: now, x: s.x, z: s.z }); while (p.trail.length && now - p.trail[0].t > 2.5) p.trail.shift();
  // ruch kończy ochronę po odrodzeniu dopiero po wyjściu ze strefy (2 m) – gracz nie jest zabijany na spawnie, ale też nie biega nietykalny
}
function onState(room, p, m, now, out) {
  if (!Array.isArray(m.s) || p.dead || !p.alive) return;
  const v = m.s.map(Number);
  const [x, y, z, yaw, pitch, cr, run, air, sl, legYaw, w, ads, life, emote] = v;
  p.emote = emote >= 1 && emote <= 3 ? emote | 0 : 0;                // emotka (1–3) widoczna dla innych
  if (life !== p.life) return;                                  // paczka z poprzedniego życia (przed odrodzeniem) – pomijamy
  p.lastStT = now;
  let wid = WIDS[w | 0] && p.owned.has(WIDS[w | 0]) ? w | 0 : WIDS.indexOf(PISTOL);
  if (wid !== p.w && p.reloadW >= 0) p.reloadW = -1;            // zmiana broni przerywa przeładowanie
  p.w = wid;
  const clamp01 = (q) => (q > 1 ? 1 : q > 0 ? q : 0);
  const s = { x, y, z, yaw: yaw || 0, pitch: pitch || 0, cr: clamp01(cr), run: clamp01(run), air: clamp01(air), sl: clamp01(sl), legYaw: legYaw || 0, ads: ads > 0.5 ? 1 : 0 };
  p._map = room.map;
  const why = MECZ.checkMove({ map: room.map }, p, s, now);
  if (why) {
    if ((why === 'wisi w powietrzu' || why === 'za wysoko') && p.gx !== undefined) Object.assign(p, { x: p.gx, y: p.gy, z: p.gz, airSince: 0, lastGroundY: p.gy, trail: [] });
    if (now - p.lastFix > 0.25) { p.lastFix = now; out(p.pid, { t: 'fix', p: [p.x, p.y, p.z].map((q) => +q.toFixed(3)) }); }
    if (room.log.length < 400) room.log.push(`${p.nick}: ${why}`);
    if (MECZ.SEVERE.has(why) && why !== 'nan') { p.viol.push(now); while (p.viol.length && now - p.viol[0] > 20) p.viol.shift(); if (p.viol.length >= 25) p.kicked = true; }
    p.lastT = now; return;
  }
  accept(p, s, now);
}

// ---------------- strzały ----------------
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
function jitter(d, rad) {
  if (rad <= 0) return d;
  const ang = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * rad, up = Math.abs(d[1]) > 0.99 ? [1, 0, 0] : [0, 1, 0];
  const u = norm(cross(d, up)), v = cross(u, d), k = Math.tan(rr), c = Math.cos(ang), s = Math.sin(ang);
  return norm([d[0] + (u[0] * c + v[0] * s) * k, d[1] + (u[1] * c + v[1] * s) * k, d[2] + (u[2] * c + v[2] * s) * k]);
}
function finishReload(p, cfg) { const id = WIDS[p.reloadW], W = cfg.weapons[id], a = p.ammo[id]; if (a && W) { const n = Math.min(W.mag - a.mag, a.res); a.mag += n; a.res -= n; } p.reloadW = -1; }
const falloff = (W, dist) => { const [a, b, m] = W.falloff; if (dist <= a) return 1; if (dist >= b) return m; return 1 - (1 - m) * (dist - a) / (b - a); };

function shoot(room, p, m, now, out) {
  const cfg = room.cfg, wid = WIDS[p.w], W = cfg.weapons[wid];
  if (room.phase !== 'live' || !p.alive || p.dead || !W || !p.owned.has(wid)) return;
  const q = +m.q; if (!(q > p.lastQ)) return; p.lastQ = q;
  if (now - p.lastStT > 0.4) return;                              // bez świeżych paczek ruchu (lag switch) strzały nie przechodzą
  p.tokens = Math.min(2, p.tokens + (now - p.tokT) * (W.rpm / 60)); p.tokT = now;
  if (p.tokens < 0.95) return; p.tokens -= 1;
  if (p.reloadW >= 0 && now >= p.reloadAt) finishReload(p, cfg);
  if (p.reloadW >= 0) return;
  const a = p.ammo[wid]; if (!a || a.mag <= 0) return; a.mag--;
  p.shots++;
  if (now < p.protUntil) p.protUntil = now;                       // strzał kończy ochronę po odrodzeniu
  p.bloom = Math.max(0, p.bloom - (now - p.bloomT) * 0.9); p.bloomT = now;
  const sp = (p.ads ? W.spread.ads : W.spread.hip) + p.bloom * 0.018;
  const spread = sp * (1 + (p.speed01 || 0) * W.spread.move * 1.2) * (p.ground === false ? 2.2 : 1) * (1 - p.cr * 0.35);
  p.bloom = Math.min(1, p.bloom + W.spread.bloom);
  const eye = [p.x, MECZ.EYE(p), p.z]; let o = eye;
  if (Array.isArray(m.o) && m.o.length === 3 && m.o.every(Number.isFinite) && Math.hypot(m.o[0] - eye[0], m.o[1] - eye[1], m.o[2] - eye[2]) <= 0.7) o = m.o;
  let d = Array.isArray(m.d) && m.d.length === 3 && m.d.every(Number.isFinite) ? m.d : null; if (!d) return;
  if (Math.hypot(d[0], d[1], d[2]) < 1e-6) return; d = norm(d);
  const aim = jitter(d, spread);
  const back = Math.min(0.35, p.rtt + 0.1);                        // cofnięcie przeciwników o to, co strzelający widział (opóźnienie + wygładzanie obrazu)
  const targets = [];
  for (const t of room.p.values()) {
    if (t === p || t.left) continue;
    if (!(t.alive || now - t.deadAt < RW)) continue;
    const st = MECZ.stateAt(t, now - back);
    if (Math.hypot(st.x - o[0], st.z - o[2]) > 320) continue;
    targets.push({ t, st });
  }
  const per = new Map(); const ends = [];
  for (let k = 0; k < W.pellets; k++) {
    const dir = W.pellets > 1 ? jitter(aim, W.pelletSpread) : aim;
    const tWall = rayGrid(room.map, o, dir, 300);
    let hit = null;
    for (const T of targets) { const h = MECZ.rayBean(o, dir, T.st); if (h && h.t < tWall && (!hit || h.t < hit.t)) hit = { ...h, T }; }
    const endT = hit ? hit.t : Math.min(tWall, 150);
    if (k < 4) ends.push([o[0] + dir[0] * endT, o[1] + dir[1] * endT, o[2] + dir[2] * endT].map((v) => +v.toFixed(2)));
    if (!hit) continue;
    const raw = W.dmg * (hit.head ? W.head : 1) * falloff(W, hit.t);
    const e = per.get(hit.T.t) || { raw: [], head: false, dist: hit.t }; e.raw.push([raw, hit.head]); if (hit.head) e.head = true; per.set(hit.T.t, e);
  }
  // smuga i dźwięk strzału dla wszystkich w pobliżu (pozycja strzelającego i tak jest słyszalna)
  for (const r of room.p.values()) if (r !== p && !r.left && Math.hypot(r.x - p.x, r.z - p.z) < 90) out(r.pid, { t: 'fx', id: p.pid, w: p.w, a: o.map((v) => +v.toFixed(2)), b: ends });
  if (!per.size) return;
  p.hits++;
  let totalDealt = 0, anyHead = false, killed = [];
  for (const [t, e] of per) {
    if (!t.alive || t.dead) continue;
    if (now < t.protUntil) { out(p.pid, { t: 'hc', id: t.pid, d: 0, prot: 1 }); continue; }
    let dealt = 0;
    for (const [raw, head] of e.raw) { dealt += applyDamage(room, t, raw, head); if (t.hp <= 0) break; }
    dealt = Math.round(dealt);
    p.damage += dealt; totalDealt += dealt; if (e.head) { anyHead = true; p.heads++; }
    out(t.pid, { t: 'dmg', d: dealt, hp: Math.max(0, Math.round(t.hp)), ar: Math.round(t.armor), h: e.head ? 1 : 0, from: [+p.x.toFixed(1), +p.z.toFixed(1)], by: p.pid });
    out(p.pid, { t: 'hc', id: t.pid, d: dealt, h: e.head ? 1 : 0, k: t.hp <= 0 ? 1 : 0, ar: t.armor > 0 ? 1 : 0 });
    if (t.hp <= 0) killed.push({ t, head: e.head, dist: e.dist });
  }
  for (const k of killed) onKill(room, p, k.t, wid, k.head, k.dist, now, out);
  if (totalDealt) room.boardDirty = true;
}
// obrażenia z pancerzem: tułów – najpierw pancerz; głowa – pancerz tylko z hełmem (i wtedy mniejsze obrażenia)
function applyDamage(room, t, raw, head) {
  let d = raw, dealt = 0;
  if (head) {
    if (t.helmet && t.armor > 0) { d *= room.cfg.armor.helmet.headMult; const a = Math.min(t.armor, d); t.armor -= a; d -= a; dealt += a; }
  } else if (t.armor > 0) { const a = Math.min(t.armor, d); t.armor -= a; d -= a; dealt += a; }
  const h = Math.min(t.hp, d); t.hp -= h; dealt += h;
  if (t.armor <= 0) { t.armor = 0; t.helmet = false; }
  return dealt;
}
function onKill(room, k, v, wid, head, dist, now, out) {
  const cfg = room.cfg, wasWanted = room.wanted === v.pid;
  v.alive = false; v.dead = true; v.deadAt = now; v.deaths++; v.streak = 0; v.killer = k ? k.pid : null; v.inShop = false;
  // zakupy przepadają; kasa zostaje
  v.owned = new Set([PISTOL]); v.armor = 0; v.helmet = false; v.reloadW = -1;
  let reward = 0;
  if (k && k !== v) { reward = Math.round(cfg.killReward * (wasWanted ? cfg.wantedMult : 1)); k.money += reward; k.kills++; k.streak++; k.best = Math.max(k.best, k.streak); }
  out(-1, { t: 'kf', k: k ? k.pid : 0, v: v.pid, w: WIDS.indexOf(wid), h: head ? 1 : 0, wanted: wasWanted ? 1 : 0, d: Math.round(dist) });
  if (k && k !== v) out(k.pid, { t: 'reward', money: k.money, plus: reward, wanted: wasWanted ? 1 : 0, streak: k.streak });
  out(v.pid, { t: 'dead', by: k ? k.pid : 0, w: WIDS.indexOf(wid), h: head ? 1 : 0, d: Math.round(dist), killerHp: k ? Math.round(k.hp) : 0, killerAr: k ? Math.round(k.armor) : 0,
    stats: { kills: v.kills, deaths: v.deaths, damage: Math.round(v.damage) }, money: v.money, minDeath: cfg.minDeathTime, shopTimeout: cfg.shopTimeout });
  room.boardDirty = true;
  updateWanted(room, out);
}

// ---------------- sklep i powrót do walki ----------------
function buy(room, p, item, out) {
  const cfg = room.cfg; let ok = false, why = '';
  if (!p.dead || room.phase === 'end') why = 'alive';
  else if (cfg.weapons[item] && item !== PISTOL) {
    const W = cfg.weapons[item];
    if (p.owned.has(item)) why = 'owned'; else if (p.money < W.price) why = 'funds'; else { p.money -= W.price; p.owned.add(item); ok = true; }
  } else if (item === 'vest' || item === 'helmet') {
    const A = cfg.armor[item], cur = p.armor > 0 ? (p.helmet ? 'helmet' : 'vest') : '';
    if (cur === item || (cur === 'helmet' && item === 'vest')) why = 'owned';
    else if (p.money < A.price) why = 'funds';
    else { p.money -= A.price; p.armor = A.hp; p.helmet = item === 'helmet'; ok = true; }
  } else why = 'item';
  out(p.pid, { t: 'inv', ok: ok ? 1 : 0, item, why, ...invOf(p) });
}
function deploy(room, p, now, out) {
  if (!p.dead || p.left || room.phase !== 'live') return;
  if (now - p.deadAt < room.cfg.minDeathTime - 0.15) return;      // za wcześnie (ekran WASTED jeszcze trwa)
  spawnPlayer(room, p, now, out);
  room.boardDirty = true;
}

// ---------------- wiadomości od gracza ----------------
export function handleMessage(room, pid, m, now, out) {
  const p = room.p.get(pid); if (!p || p.left || room.over) return;
  switch (m.t) {
    case 'st': return onState(room, p, m, now, out);
    case 'sh': return shoot(room, p, m, now, out);
    case 'rl': {
      if (!p.alive) return; const id = WIDS[p.w], W = room.cfg.weapons[id], a = p.ammo[id];
      if (W && a && p.reloadW < 0 && a.mag < W.mag && a.res > 0) { p.reloadW = p.w; p.reloadAt = now + W.reload * 0.9; }
      return;
    }
    case 'shop': if (p.dead) p.inShop = true; return;
    case 'buy': return buy(room, p, String(m.item || ''), out);
    case 'deploy': return deploy(room, p, now, out);
    case 'po': { const rtt = now - (+m.s || 0); if (rtt >= 0 && rtt < 2) p.rtt = p.rtt * 0.7 + rtt * 0.3; return; }
    case 'ready': p.ready = true; return;
  }
}
export function leave(room, pid, now, out) {
  const p = room.p.get(pid); if (!p || p.left) return;
  p.left = true; p.alive = false; p.dead = true;
  out(-1, { t: 'left', id: pid });
  room.boardDirty = true; updateWanted(room, out);
}

// ---------------- co tick (20/s): fazy meczu, widoczność, paczki stanu dla każdego gracza ----------------
function canSee(room, v, t) {
  const dx = t.x - v.x, dz = t.z - v.z, D = Math.hypot(dx, dz);
  if (D < 5) return true;
  if (D > 130) return false;
  const e = [v.x, MECZ.EYE(v), v.z], drop = MECZ.CROUCH_DROP * t.cr, L = D || 1, sx = -dz / L * 0.32, sz = dx / L * 0.32;
  const lead = (p) => { const h = p.hist; if (h.length < 2) return [0, 0]; const a = h[h.length - 2], b = h[h.length - 1], dt = Math.max(0.02, b.t - a.t); return [(b.x - a.x) / dt * 0.15, (b.z - a.z) / dt * 0.15]; };
  const pts = [[t.x, t.y + 1.45 - drop, t.z], [t.x, t.y + 1.0 - drop, t.z], [t.x + sx, t.y + 1.0 - drop, t.z + sz], [t.x - sx, t.y + 1.0 - drop, t.z - sz], [t.x, t.y + 0.25, t.z]];
  for (const p of pts) if (lineClear(room.map, e, p)) return true;
  const [lvx, lvz] = lead(v), [ltx, ltz] = lead(t);
  if (lvx || lvz || ltx || ltz) { const e2 = [e[0] + lvx, e[1], e[2] + lvz]; for (const p of pts.slice(0, 2)) if (lineClear(room.map, e2, [p[0] + ltx, p[1], p[2] + ltz])) return true; }
  return false;
}
const r3 = (v) => Math.round(v * 1000) / 1000, r2 = (v) => Math.round(v * 100) / 100;
function stateRow(p, now) {
  const fl = (p.ads ? 1 : 0) | (p.armor > 0 ? 2 : 0) | (p.helmet && p.armor > 0 ? 4 : 0) | (now < p.protUntil ? 8 : 0) | (p.reloadW >= 0 ? 16 : 0) | ((p.emote || 0) << 5);
  return [p.pid, p.life, r3(p.x), r3(p.y), r3(p.z), r3(p.yaw), r3(p.pitch), r2(p.cr), r2(p.run), r2(p.air), r2(p.sl), r2(p.legYaw), p.w, fl];
}
export function tick(room, now, out) {
  if (room.over) return;
  room.tick++;
  const cfg = room.cfg;
  for (const p of room.p.values()) if (p.pendingSpawn) { out(p.pid, p.pendingSpawn); p.pendingSpawn = null; }
  if (room.phase === 'count' && now >= room.liveAt) { room.phase = 'live'; out(-1, { t: 'go', left: +(room.endAt - now).toFixed(2) }); }
  if (room.phase === 'live' && now >= room.endAt) return finish(room, now, out);
  if (room.phase === 'end') { if (now >= room.overAt) room.over = true; return; }
  for (const p of room.p.values()) {
    if (p.reloadW >= 0 && now >= p.reloadAt) finishReload(p, cfg);
    if (p.kicked && !p.left) { out(p.pid, { t: 'error', code: 'cheat', message: 'Wyrzucono z meczu: serwer wykrył niedozwolony ruch.' }); leave(room, p.pid, now, out); p.kickedOut = true; }
    if (p.dead && !p.left && room.phase === 'live' && now - p.deadAt > cfg.minDeathTime + cfg.shopTimeout) deploy(room, p, now, out);   // za długo w sklepie: wraca sam
  }
  // paczki stanu: każdy dostaje widocznych przeciwników (widoczność liczona co 3. tick dla każdej pary, na zmianę)
  const list = [...room.p.values()].filter((p) => !p.left);
  for (const v of list) {
    const rows = [];
    for (const t of list) {
      if (t === v || !t.alive) continue;
      let c = v.sent.get(t.pid); if (!c) { c = { vis: false, seenT: -9, k: (t.pid * 7 + v.pid) % 3 }; v.sent.set(t.pid, c); }
      if ((room.tick + c.k) % 3 === 0 || !v.alive) { c.vis = v.alive ? canSee(room, v, t) : true; }   // martwy (sklep, WASTED) nic nie zyskuje na pozycjach
      if (c.vis) c.seenT = now;
      if (c.vis || now - c.seenT < 0.4) rows.push(stateRow(t, now));
    }
    out(v.pid, { t: 's', T: +(now - room.t0).toFixed(3), p: rows });
  }
  // WANTED na minimapie widać zawsze (4 razy na sekundę)
  if (room.wanted && room.tick % 5 === 0) { const w = room.p.get(room.wanted); if (w && w.alive) out(-1, { t: 'wp', id: w.pid, x: r2(w.x), z: r2(w.z) }); }
  if (room.boardDirty && now - room.boardT > 0.4) { room.boardDirty = false; room.boardT = now; out(-1, boardMsg(room)); }
  if (room.tick % 40 === 0) out(-1, { t: 'pi', s: +now.toFixed(3) });
  if (room.tick % 100 === 0 && room.phase === 'live') out(-1, { t: 'tm', left: +(room.endAt - now).toFixed(2) });
  if (room.phase === 'live' && list.length === 0) finish(room, now, out);
}
// koniec meczu: kolejność liczy serwer (zabójstwa → obrażenia), podium z trzech pierwszych (gracze, którzy wyszli, nie dostają nagród)
function finish(room, now, out) {
  if (room.phase === 'end') return;
  room.phase = 'end'; room.overAt = now + room.cfg.endDelay;
  const r = ranking(room);
  const eligible = r.filter((p) => !p.left);
  room.results = r.map((p, i) => ({ pid: p.pid, uid: p.uid, nick: p.nick, skin: p.skin, bot: p.bot, rank: i + 1, kills: p.kills, deaths: p.deaths, damage: Math.round(p.damage),
    heads: p.heads, shots: p.shots, hits: p.hits, best: p.best, left: p.left, place: p.left ? 0 : eligible.indexOf(p) + 1 }));
  room.podium = eligible.slice(0, 3).map((p) => p.pid);
}
// wyniki z nagrodami (serwer.mjs dopisuje kwoty po rozliczeniu)
export function endMessage(room, prizes = {}) {
  return { t: 'end', podium: room.podium, wanted: room.wanted,
    standings: room.results.map((s) => ({ id: s.pid, nick: s.nick, skin: s.skin, rank: s.rank, place: s.place, kills: s.kills, deaths: s.deaths, damage: s.damage, heads: s.heads, left: s.left ? 1 : 0, prize: prizes[s.pid] || 0 })) };
}
// stan początkowy dla gracza (po starcie pokoju)
export function startMessage(room, pid, now) {
  const p = room.p.get(pid);
  return { t: 'dm', you: pid, map: room.mapName, liveIn: +(room.liveAt - now).toFixed(2), duration: room.cfg.duration, cfg: publicConfig(room.cfg),
    players: [...room.p.values()].map((q) => ({ id: q.pid, nick: q.nick, skin: q.skin })), ...invOf(p) };
}
