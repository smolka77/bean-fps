// Pomiar płynności sieci w Deathmatch (narzędzie testowe, nie wchodzi do gry).
// Dwa konta: „biegacz” chodzi po mapie jak gracz z przeglądarki (paczki 'st' z pętli klatek ~60 kl./s), „obserwator” tylko patrzy.
// Oba łącza mają sztuczne opóźnienie i jitter (kolejność paczek zachowana jak w TCP). Obserwator zapisuje każdą paczkę 's'
// z chwilą odbioru, a potem ten zapis jest odtwarzany algorytmem obrazu z gry (zrodla/interp.js: stary = jak dm.js przed zmianą,
// nowy = bufor z zegarem serwera i ekstrapolacją). Wynik: rytm paczek, ich wielkość, płynność ruchu (szarpnięcia, zamrożenia,
// przeskoki), opóźnienie obrazu i liczba korekt 'fix'.
//
// Użycie (serwer gry musi działać):  node siec-pomiar.mjs [adres=http://127.0.0.1:8802] [czas_s=30] [opóźnienie_ms=0] [jitter_ms=0]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../serwer/package.json'));
const WebSocket = require('ws');
const MECZ = await import(pathToFileURL(path.join(here, '../serwer/mecz.mjs')).href);
const DM = await import(pathToFileURL(path.join(here, '../serwer/dm.mjs')).href);
const IP = await import(pathToFileURL(path.join(here, '../zrodla/interp.js')).href);
await MECZ.loadMaps(path.join(here, '..'), ['OazaBL', 'MagazynBL', 'BazaBL', 'Oaza', 'Magazyn', 'Baza', 'Iglo', 'Kaskady', 'Mars']);

const BASE = (process.argv[2] || 'http://127.0.0.1:8802').replace(/\/+$/, ''), SECS = +(process.argv[3] || 30);
const DELAY = +(process.argv[4] || 0) / 1000, JIT = +(process.argv[5] || 0) / 1000;
const PASS = 'test-siec-haslo-123', OLD = process.env.STARY === '1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowS = () => performance.now() / 1000;
const post = async (p, body, tok) => { const r = await fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: JSON.stringify(body || {}) }); return { status: r.status, j: await r.json().catch(() => ({})) }; };
async function account(username) {
  let r = await post('/api/login', { username, password: PASS }); if (r.status === 200) return r.j.token;
  r = await post('/api/register', { username, password: PASS }); if (r.status === 200) return r.j.token;
  throw new Error(username + ': ' + (r.j.message || r.status));
}
// łącze z opóźnieniem: każda wiadomość dostaje opóźnienie DELAY + losowy jitter (0..JIT, rozkład z „ogonem”), bez wyprzedzania poprzedniej
function lagLine(deliver) {
  let last = 0;
  return (x) => {
    const j = JIT ? JIT * Math.min(3, -Math.log(1 - Math.random()) * 0.5) : 0;
    const at = Math.max(last, nowS() + DELAY + j); last = at;
    const ms = (at - nowS()) * 1000; if (ms <= 0.5) deliver(x); else setTimeout(() => deliver(x), ms);
  };
}
async function connect(token, onMsg) {
  const t = await post('/api/ws-ticket', {}, token);
  const ws = new WebSocket(BASE.replace(/^http/, 'ws') + '/ws?k=' + encodeURIComponent(t.j.ticket));
  const down = lagLine((raw) => onMsg(JSON.parse(String(raw)), raw.length));
  ws.on('message', (raw) => down(raw));
  await new Promise((ok) => ws.on('open', ok));
  const up = lagLine((s) => { if (ws.readyState === 1) ws.send(s); });
  return { ws, send: (o) => up(JSON.stringify(o)) };
}

// ---------------- biegacz: ruch jak gracz w przeglądarce ----------------
const O = { pid: 0, rec: [], bytes: 0, n: 0, pos: null };
const runTok = await account('siec_bieg'), obsTok = await account('siec_obs');
const R = { pid: 0, life: 0, alive: false, x: 0, y: 0, z: 0, dir: Math.random() * 6.28, map: null, fixes: 0, sends: 0, truth: [], fixN: 0, sendT: 0, frames: 0, spin: 1, path: null, pathT: 0, pi: 0 };
const run = await connect(runTok, (m) => {
  if (m.t === 'dm') { R.pid = m.you; R.map = MECZ.mapByName(m.map); R.T0 = nowS(); }
  if (m.t === 'spawn') { R.life = m.life; R.alive = true; [R.x, R.y, R.z] = m.p; R.p = { x: R.x, y: R.y, z: R.z, lastT: nowS(), lastGroundY: R.y, airSince: 0, trail: [] }; }
  if (m.t === 'fix') { R.fixes++; [R.x, R.y, R.z] = m.p; Object.assign(R.p, { x: R.x, y: R.y, z: R.z }); if (m.n) R.fixN = m.n; }
  if (m.t === 'dead') { R.alive = false; setTimeout(() => run.send({ t: 'deploy' }), 2700); }
  if (m.t === 'pi') run.send({ t: 'po', s: m.s });
});
run.send({ t: 'dmq', skin: '' });
const SPEED = 5;
// wolny odcinek (6 m, potem 4 m) przez punkt p: równa podłoga, bez brył na wysokości ciała
function freeSeg(map, p) {
  for (const A of [3, 2]) for (let k = 0; k < 16; k++) {
    const a = (k * Math.PI) / 8, dx = Math.cos(a), dz = Math.sin(a); let ok = true;
    for (let q = -A - 0.3; q <= A + 0.3 && ok; q += 0.2) { const x = p[0] + dx * q, z = p[2] + dz * q;
      if (Math.abs(MECZ.supportTop(map, x, z, p[1] + 0.45) - p[1]) > 0.05 || MECZ.bodyHits(map, x, p[1], z, 0.35).length) ok = false; }
    if (ok) return { ok: true, o: p, A, cx: p[0], cz: p[2], dx, dz, y: p[1], t0: 0 };
  }
  return { ok: false, o: p };
}
let lastF = nowS();
const runIv = setInterval(() => {                                   // pętla „klatek” ~60/s
  const t = nowS(), dt = Math.min(0.05, t - lastF); lastF = t; R.frames++;
  if (!R.alive || !R.map) return;
  // biegacz chodzi tam i z powrotem równym krokiem po wolnym odcinku 6 m obok obserwatora (zawsze widoczny); trasa to wzór od czasu,
  // więc nie zależy od nierównych klatek tego skryptu
  if (O.pos && (!R.seg || R.seg.o !== O.pos)) R.seg = freeSeg(R.map, O.pos), R.osc = false, R.path = null;
  const sg = R.seg && R.seg.ok ? R.seg : null;
  if (sg && R.osc) {
    const A = sg.A, u = ((t - sg.t0) * SPEED) % (4 * A), q = u < 2 * A ? -A + u : 3 * A - u;
    R.x = sg.cx + sg.dx * q; R.z = sg.cz + sg.dz * q; R.y = sg.y; R.dir = Math.atan2(-sg.dx, -sg.dz);
  } else if (sg) {                                                    // dojście do początku odcinka po siatce podłogi
    const gx = sg.cx - sg.dx * sg.A, gz = sg.cz - sg.dz * sg.A;
    if (Math.hypot(gx - R.x, gz - R.z) < 0.35) { R.osc = true; sg.t0 = t; R.x = gx; R.z = gz; R.y = sg.y; }
    else {
      if (!R.path || t - R.pathT > 3) { R.path = DM.navPath(R.map, R.x, R.z, gx, gz) || []; R.path.push([gx, gz]); R.pi = 0; R.pathT = t; }
      while (R.pi < R.path.length - 1 && Math.hypot(R.path[R.pi][0] - R.x, R.path[R.pi][1] - R.z) < 0.3) R.pi++;
      const w = R.path[R.pi]; if (w) R.dir = Math.atan2(-(w[0] - R.x), -(w[1] - R.z));
      const st = Math.min(SPEED * dt, Math.hypot(w[0] - R.x, w[1] - R.z)), nx = R.x - Math.sin(R.dir) * st, nz = R.z - Math.cos(R.dir) * st;
      R.x = nx; R.z = nz; R.y = MECZ.supportTop(R.map, nx, nz, R.y + 0.45);
    }
  }
  R.truth.push([t, R.x, R.z]);
  // jak gra: wysyłka paczki co SEND s z pętli klatek
  // STARY=1: jak gra przed zmianą (co 50 ms od ostatniej wysyłki, czyli co 3–4 klatki), inaczej równo SEND_EVERY
  R.sendT -= dt; if (R.sendT > 0) return; if (OLD) R.sendT = 0.05; else R.sendT = Math.max(0, R.sendT + IP.SEND_EVERY);
  R.sends++;
  const msg = { t: 'st', s: [R.x, R.y, R.z, R.dir, 0, 0, 0.7, 0, 0, 0, 2, 0, R.life, 0].map((v) => +(+v).toFixed(3)), c: Math.round(performance.now()) };
  msg.f = R.fixN;
  run.send(msg);
}, 16);

// ---------------- obserwator ----------------

const obs = await connect(obsTok, (m, len) => {
  if (m.t === 'dm') O.pid = m.you;
  if (m.t === 'spawn') { O.pos = m.p; R.path = null; R.ang = null; }
  if (m.t === 'fix') O.pos = m.p;
  if (m.t === 'dead') { O.pos = null; O.deaths = (O.deaths || 0) + 1; setTimeout(() => obs.send({ t: 'deploy' }), 2700); }
  if (m.t === 's') { O.rec.push({ L: nowS(), m }); O.bytes += len; O.n++; }
  if (m.t === 'pi') obs.send({ t: 'po', s: m.s });
});
await sleep(400);
obs.send({ t: 'dmq', skin: '' });
await sleep(SECS * 1000);
clearInterval(runIv);
run.send({ t: 'leave' }); obs.send({ t: 'leave' });
await sleep(DELAY * 1000 + 600);
run.ws.close(); obs.ws.close();

// ---------------- analiza ----------------
if (process.env.ZAPIS) (await import('node:fs')).writeFileSync(process.env.ZAPIS, JSON.stringify({ rec: O.rec, truth: R.truth, pid: R.pid }));
const rec = O.rec.filter((r) => r.L > O.rec[0].L + 2);          // pierwsze 2 s: wejście, ustalanie zegara
const gaps = []; for (let i = 1; i < rec.length; i++) gaps.push((rec[i].L - rec[i - 1].L) * 1000);
const st = (a) => { const s = a.slice().sort((x, y) => x - y), m = a.reduce((x, y) => x + y, 0) / (a.length || 1); return { mean: m, sd: Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length || 1)), p50: s[s.length >> 1], p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1] }; };
const f1 = (v) => (v == null ? '-' : v.toFixed(1));
const g = st(gaps);
console.log(`\n== ${BASE}  ${SECS}s  opóźnienie ${DELAY * 1000} ms  jitter do ${JIT * 1000} ms ==`);
console.log(`paczki 's': ${(rec.length / (rec[rec.length - 1].L - rec[0].L)).toFixed(1)}/s, odstęp ms śr ${f1(g.mean)} sd ${f1(g.sd)} p95 ${f1(g.p95)} max ${f1(g.max)}, wielkość śr ${(O.bytes / O.n).toFixed(0)} B`);
console.log(`biegacz: wysłał ${R.sends} paczek (${(R.sends / SECS).toFixed(1)}/s), korekt 'fix': ${R.fixes}`);
// powtórki wiersza: ta sama pozycja gracza w kolejnych paczkach, choć się rusza (serwer nie dostał nowej paczki przed tickiem)
const pids = new Set(); for (const r of rec) for (const row of r.m.p) pids.add(row[0]);
let reps = 0, rows = 0; const lastRow = new Map();
for (const r of rec) for (const row of r.m.p) { if (row[0] !== R.pid) continue; rows++; const l = lastRow.get(row[0]); if (l && l[2] === row[2] && l[4] === row[4]) reps++; lastRow.set(row[0], row); }
console.log(`wiersze biegacza: ${rows}, powtórzone bez zmiany pozycji: ${reps} (${(100 * reps / Math.max(1, rows)).toFixed(1)}%)`);

const truthAt = (t) => { const a = R.truth; let lo = 0, hi = a.length - 1; if (!a.length || t <= a[0][0]) return null; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (a[mid][0] <= t) lo = mid; else hi = mid; } return a[lo]; };
function replay(algo) {
  const view = IP[algo]();                                       // obraz (bufor + zegar) jak w grze
  const out = new Map(), t0 = rec[0].L, t1 = rec[rec.length - 1].L; let i = 0;
  for (let L = t0; L < t1; L += 1 / 60) {
    while (i < rec.length && rec[i].L <= L) { view.packet(rec[i].m, rec[i].L); i++; }
    view.frame(L, 1 / 60);
    for (const pid of pids) { const s = view.sample(pid, L); if (!s) continue; if (!out.has(pid)) out.set(pid, []); out.get(pid).push([L, s[2], s[4], s.__ex || 0]); }
  }
  return out;
}
function smooth(tr, withTruth) {
  // ruch klatka po klatce: odchylenie od średniej z ±6 klatek (szarpanie), zamrożenia (prawie 0 przy ruchu), przeskoki (> 2,5× średniej)
  const d = []; for (let k = 1; k < tr.length; k++) d.push(Math.hypot(tr[k][1] - tr[k - 1][1], tr[k][2] - tr[k - 1][2]));
  let jerk = 0, nj = 0, frz = 0, jmp = 0, mv = 0;
  for (let k = 6; k < d.length - 6; k++) {
    let a = 0; for (let j = k - 6; j <= k + 6; j++) if (j !== k) a += d[j]; a /= 12;
    if (a < 0.02) continue;                                       // stoi (< 1,2 m/s)
    mv++; jerk += Math.abs(d[k] - a) / a; nj++;
    if (d[k] < 0.25 * a) frz++; if (d[k] > 2.5 * a) jmp++;
  }
  let lag = null, err = null;
  if (withTruth) {
    // opóźnienie obrazu: o ile wstecz w prawdziwej trasie biegacza leży pokazana pozycja (szukamy najbliższego punktu trasy w oknie 0–600 ms)
    const ls = [], es = [];
    for (let k = 0; k < tr.length; k += 3) {
      const [L, x, z] = tr[k]; let best = 1e9, bl = 0;
      for (let back = 0; back <= 0.6; back += 0.005) { const p = truthAt(L - back); if (!p) break; const e = Math.hypot(p[1] - x, p[2] - z); if (e < best) { best = e; bl = back; } }
      if (best < 1e9) { ls.push(bl * 1000); es.push(best); }
    }
    lag = st(ls); err = st(es);
  }
  return { mv, jerk: nj ? (100 * jerk) / nj : 0, frz: mv ? (100 * frz) / mv : 0, jmp: mv ? (100 * jmp) / mv : 0, lag, err };
}
{ // tło: sama trasa biegacza (60 kl./s) – tyle „szarpania” ma prawdziwy ruch (zakręty, blokady na ścianach)
  const tr = []; const a = R.truth; let k = 0; for (let L = rec[0].L; L < rec[rec.length - 1].L; L += 1 / 60) { while (k < a.length - 2 && a[k + 1][0] <= L) k++; const A = a[k], B = a[k + 1]; if (A && B && L >= A[0] && B[0] - A[0] < 0.1) { const f = Math.min(1, (L - A[0]) / Math.max(1e-4, B[0] - A[0])); tr.push([L, A[1] + (B[1] - A[1]) * f, A[2] + (B[2] - A[2]) * f]); } }
  const sm = smooth(tr, false); console.log(`[trasa] biegacz (prawdziwy ruch): szarpanie ${f1(sm.jerk)}%  zamrożone ${f1(sm.frz)}%  przeskoki ${f1(sm.jmp)}%`); }
for (const algo of IP.ALGOS) {
  const out = replay(algo);
  const me = out.get(R.pid), sm = me ? smooth(me, true) : null;
  const bots = [...out.entries()].filter(([pid]) => pid !== R.pid).map(([, tr]) => smooth(tr, false)).filter((s) => s.mv > 30);
  const avg = (k) => bots.length ? bots.reduce((a, b) => a + b[k], 0) / bots.length : 0;
  console.log(`[${algo}] biegacz: szarpanie ${f1(sm && sm.jerk)}%  zamrożone klatki ${f1(sm && sm.frz)}%  przeskoki ${f1(sm && sm.jmp)}%  opóźnienie obrazu ms śr ${f1(sm && sm.lag.mean)} p95 ${f1(sm && sm.lag.p95)}  błąd trasy cm śr ${f1(sm && sm.err.mean * 100)} max ${f1(sm && sm.err.max * 100)}`);
  console.log(`[${algo}] boty (${bots.length}): szarpanie ${f1(avg('jerk'))}%  zamrożone ${f1(avg('frz'))}%  przeskoki ${f1(avg('jmp'))}%`);
}
process.exit(0);
