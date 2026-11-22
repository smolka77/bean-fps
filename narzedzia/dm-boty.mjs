// Boty testowe trybu Deathmatch: zakładają konta na serwerze (albo logują się na istniejące), wchodzą do stałego lobby
// i grają jak prości gracze – chodzą po mapie (ruch sprawdzany tą samą fizyką co na serwerze, więc serwer go przyjmuje),
// strzelają do widocznych przeciwników z rozrzutem, po zabójstwie biorą nową broń, po śmierci od razu się odradzają (jak Spacja).
// Po zadanym czasie wychodzą z lobby. Do sprawdzania lobby z wieloma graczami (komplet 20, odrodzenia, broń za zabójstwa, WANTED) i obciążenia.
//
// Użycie (serwer gry musi działać):  node dm-boty.mjs [liczba=8] [adres=http://127.0.0.1:8787] [czas_s=60]
// Konta botów: bot_dm_01 … (hasło w BOT_PASS albo domyślne testowe). Serwer zakłada najwyżej 12 kont na minutę z jednego IP – skrypt czeka sam.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../serwer/package.json'));
const WebSocket = require('ws');
const MECZ = await import(pathToFileURL(path.join(here, '../serwer/mecz.mjs')).href);
const MAPS = ['OazaBL', 'MagazynBL', 'BazaBL', 'Oaza', 'Magazyn', 'Baza', 'Iglo', 'Kaskady', 'Mars'];
await MECZ.loadMaps(path.join(here, '..'), MAPS);

const N = +(process.argv[2] || 8), BASE = (process.argv[3] || 'http://127.0.0.1:8787').replace(/\/+$/, ''), SECS = +(process.argv[4] || 60);
const PASS = process.env.BOT_PASS || 'test-bot-haslo-123';
const WIDS = ['akm', 'm4a1', 'glock17', 'deagle', 'spas12', 'mp5k', 'akmgold', 'p90'];   // jak WEAPON_IDS w grze
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = async (p, body, tok) => { const r = await fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: JSON.stringify(body || {}) }); return { status: r.status, j: await r.json().catch(() => ({})) }; };

async function account(i) {
  const username = 'bot_dm_' + String(i + 1 + (+process.env.BOT_OFFSET || 0)).padStart(2, '0');   // BOT_OFFSET=10 → bot_dm_11… (druga grupa botów)
  for (;;) {
    let r = await post('/api/login', { username, password: PASS });
    if (r.status === 200) return { username, token: r.j.token };
    if (r.status === 429) { console.log(`[${username}] limit logowań – czekam 20 s`); await sleep(20000); continue; }
    r = await post('/api/register', { username, password: PASS });
    if (r.status === 200) return { username, token: r.j.token };
    if (r.status === 429) { console.log(`[${username}] limit kont na minutę – czekam 30 s`); await sleep(30000); continue; }
    throw new Error(`${username}: ${r.j.message || r.status}`);
  }
}

function runBot(acc, idx) {
  return new Promise(async (resolve) => {
    const t = await post('/api/ws-ticket', {}, acc.token); if (t.status !== 200) { console.log(acc.username, 'bilet', t.j.message); return resolve(null); }
    const ws = new WebSocket(BASE.replace(/^http/, 'ws') + '/ws?k=' + encodeURIComponent(t.j.ticket));
    const send = (o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };
    const B = { pid: 0, life: 0, alive: false, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, dir: Math.random() * 6.28, turnT: 0, map: null, w: 2, owned: ['glock17'], money: 0, q: 0,
      vis: new Map(), lastShot: 0, aimJ: 0.04 + Math.random() * 0.05, kills: 0, deaths: 0, res: null, cfg: null, p: { x: 0, y: 0, z: 0, lastT: 0, lastGroundY: 0, airSince: 0, trail: [] } };
    let iv = null;
    ws.on('open', () => send({ t: 'dmq', skin: '' }));
    const quit = () => { clearInterval(iv); send({ t: 'leave' }); setTimeout(() => { ws.close(); resolve(B); }, 300); };
    ws.on('message', (raw) => {
      const m = JSON.parse(String(raw));
      if (m.t === 'error') { console.log(`[${acc.username}] błąd (${m.code}): ${m.message}`); if (!B.pid) { B.err = m.code; ws.close(); } }
      if (m.t === 'dm') { B.pid = m.you; B.map = MECZ.mapByName(m.map); B.cfg = m.cfg; console.log(`[${acc.username}] w lobby: mapa ${m.map}, graczy ${m.players.length}`); setTimeout(quit, SECS * 1000); }
      if (m.t === 'spawn') { B.life = m.life; B.alive = true; [B.x, B.y, B.z] = m.p; B.yaw = m.yaw; B.owned = m.owned; B.money = m.money; Object.assign(B.p, { x: B.x, y: B.y, z: B.z, lastT: performance.now() / 1000, lastGroundY: B.y, airSince: 0, trail: [] });
        const order = ['m4a1', 'akm', 'mp5k', 'spas12', 'deagle', 'glock17']; B.w = WIDS.indexOf(order.find((g) => B.owned.includes(g)) || 'glock17'); }
      if (m.t === 'fix') { [B.x, B.y, B.z] = m.p; Object.assign(B.p, { x: B.x, y: B.y, z: B.z }); B.dir += Math.PI * (0.6 + Math.random() * 0.8); }
      if (m.t === 's') { const now = performance.now() / 1000; for (const r of m.p) B.vis.set(r[0], { x: r[2], y: r[3], z: r[4], t: now }); }
      if (m.t === 'kf') { if (m.k === B.pid) B.kills++; B.vis.delete(m.v); }
      if (m.t === 'upgrade') { B.owned = m.owned; B.w = WIDS.indexOf(m.gun); B.ups = (B.ups || 0) + (m.up ? 1 : 0); B.top = Math.max(B.top || 0, m.level); }
      if (m.t === 'dead') {
        B.alive = false; B.deaths++;
        setTimeout(() => send({ t: 'deploy' }), (m.minDeath || 2.4) * 1000 + 200 + Math.random() * 800);   // jak Spacja na ekranie śmierci
      }
      if (m.t === 'pi') send({ t: 'po', s: m.s });
    });
    ws.on('close', () => { clearInterval(iv); resolve(B); });
    // 20 razy na sekundę: ruch (sprawdzony fizyką serwera przed wysłaniem) i strzały
    iv = setInterval(() => {
      if (!B.alive || !B.map) return;
      const now = performance.now() / 1000, dt = 0.05;
      B.turnT -= dt; if (B.turnT <= 0) { B.turnT = 1 + Math.random() * 3; B.dir += (Math.random() - 0.5) * 2; }
      // cel: najbliższy widoczny przeciwnik
      let tgt = null, best = 1e9; for (const [id, v] of B.vis) { if (now - v.t > 0.3) continue; const d = Math.hypot(v.x - B.x, v.z - B.z); if (d < best) { best = d; tgt = v; } }
      const sp = tgt && best < 12 ? 2.2 : 3.6;
      const nx = B.x - Math.sin(B.dir) * sp * dt, nz = B.z - Math.cos(B.dir) * sp * dt;
      const s = { x: nx, y: B.y, z: nz, yaw: B.yaw, pitch: 0, cr: 0, run: sp / 6.8, air: 0, sl: 0, legYaw: 0, w: B.w, ads: 0 };
      B.p.lastT = now - dt;
      if (!MECZ.checkMove({ map: B.map }, B.p, s, now)) { B.x = nx; B.z = nz; Object.assign(B.p, { x: nx, z: nz }); B.p.trail.push({ t: now, x: nx, z: nz }); while (B.p.trail.length && now - B.p.trail[0].t > 2.5) B.p.trail.shift(); }
      else { B.dir += Math.PI * (0.5 + Math.random()); B.turnT = 0.8; }
      if (tgt) { const dx = tgt.x - B.x, dz = tgt.z - B.z; B.yaw = Math.atan2(-dx, -dz); B.pitch = Math.atan2((tgt.y + 1.0) - (B.y + 1.3), Math.hypot(dx, dz)); } else B.yaw = B.dir;
      send({ t: 'st', s: [B.x, B.y, B.z, B.yaw, B.pitch, 0, s.run, 0, 0, 0, B.w, 0, B.life].map((v) => +(+v).toFixed(3)) });
      const W = B.cfg && B.cfg.weapons[WIDS[B.w]];
      if (tgt && W && now - B.lastShot > 60 / W.rpm + 0.05 && best < 60) {
        B.lastShot = now; const j = () => (Math.random() - 0.5) * B.aimJ * 2;
        const yaw = B.yaw + j(), pitch = B.pitch + j(), d = [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
        send({ t: 'sh', o: [B.x, B.y + 1.3, B.z], d, q: ++B.q });
        if (Math.random() < 0.03) send({ t: 'rl' });
      }
    }, 50);
  });
}

console.log(`${N} botów → ${BASE}, ${SECS} s w lobby`);
const accs = []; for (let i = 0; i < N; i++) accs.push(await account(i));
const res = await Promise.all(accs.map((a, i) => sleep(i * 150).then(() => runBot(a, i))));
const ok = res.filter((b) => b && b.pid), full = res.filter((b) => b && b.err === 'full').length;
console.log(`
koniec: w lobby ${ok.length} botów, odbitych (pełne) ${full}, zabójstwa ${ok.reduce((a, b) => a + b.kills, 0)}, śmierci ${ok.reduce((a, b) => a + b.deaths, 0)}, nowe bronie ${ok.reduce((a, b) => a + (b.ups || 0), 0)}, najwyższy poziom broni ${Math.max(0, ...ok.map((b) => b.top || 0))}`);
process.exit(0);
