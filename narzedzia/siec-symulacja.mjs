// Symulacja sieci Deathmatch na wirtualnym zegarze (narzędzie testowe, nie wchodzi do gry): prawdziwy kod serwera (serwer/dm.mjs,
// boty z serwer/dm-boty.mjs), klient „biegacz” z dokładnie znaną trasą (tam i z powrotem 5 m/s), obserwator, opóźnienie i jitter łącza
// w obie strony (kolejność jak w TCP), nierówne ticki serwera i klatki przeglądarki. Paczki, które dostał obserwator, są odtwarzane
// algorytmem obrazu z gry (zrodla/interp.js) i porównywane z prawdziwą trasą: opóźnienie obrazu, błąd pozycji, szarpanie prędkości,
// zamrożenia i przeskoki. Wynik powtarzalny (stałe ziarno losowania), więc nadaje się do porównań „przed/po”.
//
// Użycie: node siec-symulacja.mjs [serwer=nowy|stary|ścieżka] [opóźnienie_ms=0] [jitter_ms=0] [boty=3] [czas_s=40]
//   stary = kopia serwera sprzed zmian (katalog podany w STARY_SERWER), wtedy klient wysyła paczki jak dawniej (co 50 ms od ostatniej).
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '..');
const which = process.argv[2] || 'nowy', DELAY = +(process.argv[3] || 0) / 1000, JIT = +(process.argv[4] || 0) / 1000, NBOTS = +(process.argv[5] ?? 3), SECS = +(process.argv[6] || 40);
const sdir = which === 'nowy' ? path.join(root, 'serwer') : which === 'stary' ? process.env.STARY_SERWER : which;
const OLD = which === 'stary';
const imp = (f) => import(pathToFileURL(path.join(sdir, f)).href);
const MECZ = await imp('mecz.mjs'), DM = await imp('dm.mjs'), BOTY = await imp('dm-boty.mjs');
const IP = await import(pathToFileURL(path.join(root, 'zrodla/interp.js')).href);
let ALG = IP;
const MAP = process.env.MAPA || 'Oaza';
await MECZ.loadMaps(root, [MAP]);
const map = MECZ.mapByName(MAP);

// powtarzalne losowanie (sieć, ticki, klatki); Math.random zostaje dla kodu serwera (rozrzut, boty) – też z ziarnem
let seed = 12345; const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
Math.random = rnd;
const TICK = 1 / (DM.TICK_HZ || 20), SEND = OLD ? 0.05 : IP.SEND_EVERY;
const net = () => JIT ? JIT * Math.min(3, -Math.log(1 - rnd()) * 0.5) : 0;   // jitter z „ogonem”, średnio JIT/2
function link() { let last = 0; const q = []; return { send(t, x) { const at = Math.max(last, t + DELAY + net()); last = at; q.push([at, x]); }, take(t) { const out = []; while (q.length && q[0][0] <= t) out.push(q.shift()[1]); return out; } }; }

// wolny odcinek do biegania (6 m) – szukany przy punktach odrodzenia
function freeSeg(p) {
  for (const A of [3, 2.5]) for (let k = 0; k < 16; k++) {
    const a = (k * Math.PI) / 8, dx = Math.cos(a), dz = Math.sin(a); let ok = true;
    for (let q = -A - 0.4; q <= A + 0.4 && ok; q += 0.2) { const x = p[0] + dx * q, z = p[2] + dz * q;
      if (Math.abs(MECZ.supportTop(map, x, z, p[1] + 0.45) - p[1]) > 0.02 || MECZ.bodyHits(map, x, p[1], z, 0.4).length) ok = false; }
    if (ok) return { A, cx: p[0], cz: p[2], dx, dz, y: p[1] };
  }
  return null;
}
let seg = null; for (const c of DM.navPoints(map)) { seg = freeSeg([c[0], c[2] || 0, c[1]]); if (seg) break; }
if (!seg) throw new Error('brak wolnego odcinka');
const SPEED = 5, truthMover = (t) => { const A = seg.A, u = (Math.max(0, t) * SPEED) % (4 * A), q = u < 2 * A ? -A + u : 3 * A - u; return [seg.cx + seg.dx * q, seg.cz + seg.dz * q]; };

// pokój i gracze
const cfg = DM.sanitizeConfig({ spawnProtect: 0 }), room = DM.createRoom(cfg, MAP, 0);
const toObs = link(), toMover = link(), upMover = link();
const obsLog = [], moverFix = []; let bytes = 0, nS = 0;
const pids = {};
const out = (pid, m) => {
  const send = (id) => { if (id === pids.obs) { const s = JSON.stringify(m); if (m.t === 's') { bytes += s.length; nS++; } toObs.send(T, s); } else if (id === pids.mover) toMover.send(T, m); else if (bots.has(id)) BOTY.botMessage(bots.get(id), m, T, cfg); };
  if (pid < 0) for (const id of room.p.keys()) send(id); else send(pid);
};
let T = 0; const bots = new Map();
pids.obs = DM.addPlayer(room, { uid: 1, nick: 'obs' }, 0, out);
pids.mover = DM.addPlayer(room, { uid: 2, nick: 'bieg' }, 0, out);
const place = (pid, x, y, z) => { const p = room.p.get(pid); Object.assign(p, { x, y, z, lastGroundY: y, gx: x, gy: y, gz: z, hist: [], trail: [], lastT: 0, protUntil: 1e9 }); MECZ.pushHist(p, 0); };   // nietykalni (boty ich nie zabiją)
place(pids.obs, seg.cx - seg.dz * 1.0, seg.y, seg.cz + seg.dx * 1.0);
const m0 = truthMover(0); place(pids.mover, m0[0], seg.y, m0[1]);
for (let i = 0; i < NBOTS; i++) { const pid = DM.addPlayer(room, { uid: 0, nick: 'bot' + i, bot: true }, 0, out); bots.set(pid, BOTY.createBot(pid, 0.5)); }
const botTruth = new Map([...bots.keys()].map((id) => [id, []]));

// pętla: 1 ms kroku
const CLOCK = 5000.123;                                           // zegar przeglądarki biegacza (inny niż serwera)
let nextFrameM = 0.003, nextTick = 0.01, sendT = 0, fixN = 0, fixes = 0, lastBotT = 0;
// SKOK=1: w 10. s gra biegacza raz przeskakuje 2,5 m do przodu (błąd fizyki / przycięcie) – serwer to cofa; po korekcie biegacz
// idzie dalej od miejsca korekty (przesunięcie trasy), jak prawdziwa gra. Liczymy, ile razy gracz został cofnięty.
const GLITCH = process.env.SKOK === '1'; let off = [0, 0], glitched = false, snaps = 0;
// STRZALY=1: obserwator strzela co 0,25 s w środek biegacza takiego, jakiego widzi na ekranie (obraz z interp.js), z celowaniem (ADS).
// Biegacz jest chroniony, więc serwer tylko zgłasza trafienie ('hc' z prot). Odsetek trafień = jak dobrze kompensacja opóźnienia
// zgadza się z obrazem gracza. BEZ_RT=1: gra nie podaje chwili obrazu (serwer liczy cofnięcie z pingu).
const SHOOT = process.env.STRZALY === '1', NORT = process.env.BEZ_RT === '1', upObs = link();
const live = OLD ? IP.legacy() : IP.createView(IP.DM_ROW), op = room.p.get(pids.obs);
let nextFrameO = 0.009, sendO = 0, nextShot = 2, shots = 0, hits = 0, mag = 17, q = 0, lastSeenM = -9;
for (let step = 0; step <= SECS * 1000; step++) {
  T = step / 1000;
  // biegacz: klatki ~60/s (czasem zgubiona klatka), paczka ruchu z pętli klatek
  if (T >= nextFrameM) {
    const dt = 1 / 60 * (rnd() < 0.03 ? 2 : 1); nextFrameM += dt;
    sendT -= dt;
    if (sendT <= 0) {
      if (OLD) sendT = 0.05; else sendT = Math.max(0, sendT + SEND);
      if (GLITCH && !glitched && T >= 10) { glitched = true; off = [off[0] + seg.dx * 2.5, off[1] + seg.dz * 2.5]; }
      const tz = truthMover(T), x = tz[0] + off[0], z = tz[1] + off[1], p = room.p.get(pids.mover);
      const m = { t: 'st', s: [x, seg.y, z, Math.atan2(-seg.dx, -seg.dz), 0, 0, 0.73, 0, 0, 0, 2, 0, p.life, 0].map((v) => +(+v).toFixed(3)) };
      if (!OLD) { m.c = Math.round((T + CLOCK) * 1000); m.f = fixN; }
      upMover.send(T, m);
    }
  }
  for (const m of upMover.take(T)) DM.handleMessage(room, pids.mover, m, T, out);
  for (const m of toMover.take(T)) if (m.t === 'fix') {
    fixes++; if (m.n) fixN = m.n;
    const tz = truthMover(T), cur = [tz[0] + off[0], tz[1] + off[1]];
    if (Math.hypot(m.p[0] - cur[0], m.p[2] - cur[1]) > 0.05) { snaps++; off = [m.p[0] - tz[0], m.p[2] - tz[1]]; }   // gra: pozycja = korekta
  }
  // tick serwera: nierówny (pętla zdarzeń, GC)
  if (T >= nextTick) {
    const dt = Math.min(0.1, T - lastBotT); lastBotT = T;
    for (const b of bots.values()) BOTY.botStep(room, b, T, DM.TICK_HZ ? dt : 0.05, (m) => DM.handleMessage(room, b.pid, m, T, out));
    for (const id of bots.keys()) { const p = room.p.get(id); if (p && p.alive) botTruth.get(id).push([T, p.x, p.z, p.life]); }
    DM.tick(room, T, out);
    nextTick += TICK + rnd() * 0.0015 + (rnd() < 0.02 ? rnd() * 0.012 : 0);
  }
  for (const s of toObs.take(T)) {
    const m = JSON.parse(s); obsLog.push({ L: T, m });
    if (m.t === 's') { live.packet(m, T); if (m.p.some((r) => r[0] === pids.mover)) lastSeenM = T; }
    if (m.t === 'pi') upObs.send(T, { t: 'po', s: m.s });
    if (m.t === 'hc' && m.prot) { hits++; if (process.env.DBG2) console.log('hc', T.toFixed(2)); }
    if (process.env.DBG2 && m.t !== 's' && m.t !== 'hc' && m.t !== 'pi') console.log('msg', T.toFixed(2), JSON.stringify(m).slice(0, 120));
  }
  if (SHOOT && T >= nextFrameO) {
    nextFrameO += 1 / 60; live.frame(T, 1 / 60);
    sendO -= 1 / 60;
    if (sendO <= 0) { sendO = OLD ? 0.05 : Math.max(0, sendO + SEND); const m = { t: 'st', s: [op.x, op.y, op.z, 0, 0, 0, 0, 0, 0, 0, 2, 1, op.life, 0] }; if (!OLD) { m.c = Math.round((T + 777) * 1000); m.f = 0; m.d = Math.round((live.delay || 0.1) * 1000); } upObs.send(T, m); }
    const v = live.sample(pids.mover, T);
    if (v && T - lastSeenM < 0.2 && T >= nextShot) {
      if (mag <= 0) { for (const k in op.ammo) op.ammo[k].res = 999; upObs.send(T, { t: 'rl' }); mag = 17; nextShot = T + 2.2; }   // zapas bez końca (test)
      else {
        const o = [op.x, op.y + 1.3, op.z], tg = [v[2], v[3] + 0.95, v[4]], d = [tg[0] - o[0], tg[1] - o[1], tg[2] - o[2]], L = Math.hypot(...d);
        const m = { t: 'sh', o, d: d.map((x) => x / L), q: ++q }; if (!OLD && !NORT && live.renderT != null) m.rt = +live.renderT.toFixed(3);
        upObs.send(T, m); shots++; mag--; nextShot = T + 0.25;
        if (process.env.DBG2) { const mv = room.p.get(pids.mover), back = DM.rewindOf ? DM.rewindOf(room, op, m, T) : 0.1, st = MECZ.stateAt(mv, T - back), hb = MECZ.rayBean(o, m.d, st), tw = DM.rayGrid(map, o, m.d, 300);
          console.log('strzał', T.toFixed(2), 'dyst', L.toFixed(2), 'obraz-serwer cm', (Math.hypot(st.x - v[2], st.z - v[4]) * 100).toFixed(1), 'bean', hb ? hb.t.toFixed(2) : '-', 'ściana', tw.toFixed(2)); }
      }
    }
  }
  for (const m of upObs.take(T)) DM.handleMessage(room, pids.obs, m, T, out);
}
if (SHOOT) console.log(`strzały obserwatora w biegacza (środek obrazu): ${shots}, trafione ${hits} = ${(100 * hits / Math.max(1, shots)).toFixed(1)}%  (ping serwera ${(op.rtt * 1000).toFixed(0)} ms)`);

// ---------------- ocena ----------------
const sM = obsLog.filter((r) => r.m.t === 's');
const f1 = (v) => (v == null || !isFinite(v) ? '-' : v.toFixed(1));
const st = (a) => { const s = a.slice().sort((x, y) => x - y), m = a.reduce((x, y) => x + y, 0) / (a.length || 1); return { mean: m, p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1] }; };
const gaps = []; for (let i = 1; i < sM.length; i++) gaps.push((sM[i].L - sM[i - 1].L) * 1000);
const g = st(gaps);
console.log(`\n== serwer ${which}${OLD ? ' (klient stary)' : ''}  opóźnienie ${DELAY * 1000} ms  jitter ${JIT * 1000} ms  boty ${NBOTS}  ${SECS}s ==`);
console.log(`paczki 's' u obserwatora: ${(sM.length / SECS).toFixed(1)}/s, odstęp ms śr ${f1(g.mean)} p95 ${f1(g.p95)} max ${f1(g.max)}, śr ${(bytes / Math.max(1, nS)).toFixed(0)} B; biegacz: korekty 'fix' ${fixes} (cofnięć postaci ${snaps})`);
// zapis paczek → obraz w klatkach 60/s obserwatora
function render(algo, ids) {
  const view = ALG[algo](), outp = new Map(ids.map((id) => [id, []])), seen = new Map(); let i = 0, L = 1.5, lastL = L;
  while (L < SECS - 0.2) {
    while (i < sM.length && sM[i].L <= L) { view.packet(sM[i].m, sM[i].L); for (const r of sM[i].m.p) seen.set(r[0], sM[i].L); i++; }
    view.frame(L, L - lastL); lastL = L;
    for (const id of ids) { if (!(L - (seen.get(id) ?? -9) < 0.2)) continue; const s = view.sample(id, L); if (s) outp.get(id).push([L, s[2], s[4], s[1], s.__ex || 0, view.delay || 0]); }   // jak w grze: niewidoczny = schowany
    L += 1 / 60 * (rnd() < 0.02 ? 2 : 1) + (rnd() - 0.5) * 0.001;
  }
  return outp;
}
function score(tr, truth) {
  if (tr.length < 60) return null;
  // opóźnienie obrazu: stała, przy której pokazana pozycja najlepiej pasuje do prawdziwej trasy
  let best = 1e9, lag = 0;
  for (let l = 0; l <= 0.6; l += 0.002) { let e = 0, n = 0; for (let k = 0; k < tr.length; k += 4) { const p = truth(tr[k][0] - l); if (!p) continue; e += Math.hypot(p[0] - tr[k][1], p[1] - tr[k][2]); n++; } if (n && e / n < best) { best = e / n; lag = l; } }
  const errs = [], dv = []; let ref = 0, nv = 0, frz = 0, jmp = 0;
  for (let k = 1; k < tr.length; k++) {
    const [L, x, z] = tr[k], [L0, x0, z0] = tr[k - 1], dt = L - L0, p = truth(L - lag), p0 = truth(L0 - lag); if (!p || !p0 || dt <= 0) continue;
    errs.push(Math.hypot(p[0] - x, p[1] - z) * 100);
    const vr = [(x - x0) / dt, (z - z0) / dt], vt = [(p[0] - p0[0]) / dt, (p[1] - p0[1]) / dt], st0 = Math.hypot(...vt), sr = Math.hypot(...vr);
    if (st0 < 1) continue;
    dv.push(Math.hypot(vr[0] - vt[0], vr[1] - vt[1])); ref += st0; nv++;
    if (sr < 0.25 * st0) { frz++; if (process.env.DBG) console.log('zamrożona', L.toFixed(3), 'v', st0.toFixed(2), sr.toFixed(2), 'ex', (tr[k][4]||0).toFixed(3), (tr[k-1][4]||0).toFixed(3), 'D', (tr[k][5]||0).toFixed(3), 'dt', dt.toFixed(4)); } if (sr > 2 * st0 + 1) jmp++;
  }
  const e = st(errs);
  return { lag: lag * 1000, err: e.mean, errMax: e.p95, jerk: nv ? (100 * dv.reduce((a, b) => a + b, 0)) / ref : 0, frz: nv ? (100 * frz) / nv : 0, jmp: nv ? (100 * jmp) / nv : 0 };
}
const botTruthFn = (id) => (t) => { const a = botTruth.get(id); let lo = 0, hi = a.length - 1; if (!a.length || t < a[0][0] || t > a[hi][0]) return null; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (a[m][0] <= t) lo = m; else hi = m; } const A = a[lo], B = a[hi]; if (B[3] !== A[3] || B[0] - A[0] > 0.2) return null; const k = (t - A[0]) / Math.max(1e-6, B[0] - A[0]); return [A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k]; };
if (process.env.DBG) for (const [id, a] of botTruth) { let st = 0, n = 0; for (let k = 2; k < a.length; k++) { const d1 = Math.hypot(a[k][1] - a[k - 1][1], a[k][2] - a[k - 1][2]), d0 = Math.hypot(a[k - 1][1] - a[k - 2][1], a[k - 1][2] - a[k - 2][2]); if (a[k][3] !== a[k - 2][3]) continue; n++; if (d1 < 0.01 && d0 > 0.05) { st++; console.log('bot', id, 'stoi', a[k][0].toFixed(3)); } } console.log('bot', id, 'zatrzymania w ruchu', st, '/', n); }
const line = (n, r) => r ? `${n}: opóźnienie obrazu ${f1(r.lag)} ms  błąd poz. śr ${f1(r.err)} cm (p95 ${f1(r.errMax)})  szarpanie ${f1(r.jerk)}%  zamrożone ${f1(r.frz)}%  przeskoki ${f1(r.jmp)}%` : `${n}: za mało danych`;
ALG = { ...IP, p90: () => IP.createView(IP.DM_ROW, { pct: 0.9 }), p80: () => IP.createView(IP.DM_ROW, { pct: 0.8 }), max20: () => IP.createView(IP.DM_ROW, { dMax: 0.2 }) };
for (const algo of (process.env.ALGOS ? process.env.ALGOS.split(',') : IP.ALGOS)) {
  const ids = [pids.mover, ...bots.keys()], o = render(algo, ids);
  console.log(`[${algo}] ` + line('biegacz', score(o.get(pids.mover), truthMover)));
  const bs = [...bots.keys()].map((id) => score(o.get(id), botTruthFn(id))).filter(Boolean);
  if (bs.length) { const a = (k) => bs.reduce((x, y) => x + y[k], 0) / bs.length; console.log(`[${algo}] ` + line(`boty (${bs.length})`, { lag: a('lag'), err: a('err'), errMax: a('errMax'), jerk: a('jerk'), frz: a('frz'), jmp: a('jmp') })); }
}
