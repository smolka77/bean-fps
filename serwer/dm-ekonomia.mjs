// Pieniądze trybu Deathmatch: wpisowe, zwroty, rozliczenie puli po meczu, wstrzymane nagrody (antycheat, zgłoszenia),
// decyzje admina (wypłać / przepadek / przesunięcie nagród), zgłoszenia graczy, odtworzenie stanu po awarii serwera, rankingi.
//
// Moduł nie zna WebSocketu ani Solany – dostaje bazę (node:sqlite), księgę (ksiega.mjs) i kilka funkcji z serwera.
// Każda operacja na pieniądzach jest w jednej transakcji SQLite i ma klucz idempotencji (ref), więc:
//  - rozliczenie meczu dwa razy (np. ponowienie po błędzie) nic nie zmienia,
//  - awaria serwera w trakcie meczu = przy starcie mecz jest unieważniany, a wpisowe wraca (recover()),
//  - zmiana ustawień w panelu nie rusza trwających meczów: mecz ma kopię ustawień z chwili startu (dm_matches.cfg).
import { LedgerError } from './ksiega.mjs';

// ---------------- ustawienia ekonomii (panel admina → Deathmatch → Ekonomia) ----------------
export const ECON_DEFAULTS = {
  reconnectGrace: 45,        // s: rozłączony gracz może wrócić do meczu (odświeżenie strony, zerwane łącze); potem = wyszedł
  queueGrace: 12,            // s: rozłączony w kolejce nie traci miejsca od razu (odświeżenie strony); potem zwrot wpisowego
  separateLinked: true,      // konta powiązane (urządzenie / adres wypłat / IP) nie trafiają do jednego płatnego meczu
  reportThreshold: 3,        // tyle (ważonych) zgłoszeń w jednym meczu = incydent i wstrzymana nagroda
  reportMinMatches: 3,       // zgłaszający z mniejszą liczbą meczów liczy się za pół zgłoszenia
  reportWindowH: 24,         // tyle godzin po meczu można zgłosić gracza
  holdRisk: 0.5,             // od takiego ryzyka (0..1) nagroda czeka na admina
  reviewPrizeUsd: 250,       // nagroda od tej kwoty zawsze czeka na sprawdzenie
  disputePolicy: 'shift',    // przy odrzuceniu nagrody: shift = gracze niżej przesuwają się w górę; house = nagroda do kasy gry
  ac: { accMinShots: 60, accHigh: 0.8, accMax: 0.92, hsMinHits: 25, hsHigh: 0.6, hsMax: 0.75, sevMoves: 5, sevMovesMax: 15 },
};
const num = (v, lo, hi, d) => { const n = +v; return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
export function sanitizeEcon(s = {}) {
  const D = ECON_DEFAULTS, a = (s && s.ac) || {};
  s = s || {};
  return {
    reconnectGrace: num(s.reconnectGrace, 0, 600, D.reconnectGrace), queueGrace: num(s.queueGrace, 0, 120, D.queueGrace),
    separateLinked: s.separateLinked === undefined ? D.separateLinked : !!s.separateLinked,
    reportThreshold: num(s.reportThreshold, 1, 50, D.reportThreshold), reportMinMatches: Math.round(num(s.reportMinMatches, 0, 1000, D.reportMinMatches)),
    reportWindowH: num(s.reportWindowH, 0.1, 720, D.reportWindowH),
    holdRisk: num(s.holdRisk, 0.05, 1, D.holdRisk), reviewPrizeUsd: num(s.reviewPrizeUsd, 0, 1e7, D.reviewPrizeUsd),
    disputePolicy: s.disputePolicy === 'house' ? 'house' : 'shift',
    ac: Object.fromEntries(Object.entries(D.ac).map(([k, d]) => [k, num(a[k], 0, k.includes('Shots') || k.includes('Hits') || k.includes('Moves') ? 100000 : 1, d)])),
  };
}

// ---------------- podział puli (czysta funkcja – testy) ----------------
// pula − prowizja = do podziału; miejsca 1..n (n = min(liczba uprawnionych, liczba miejsc z nagrodą)), udziały przeskalowane
// do sumy 1 (mniej graczy niż miejsc = podział tylko między obecnych). Zaokrąglenie w dół, reszta (pył) do kasy gry.
export function computePrizes(pot, feeRate, split, rankedIds) {
  if (!Number.isSafeInteger(pot) || pot < 0) throw new Error('pot');
  const fee = Math.floor(pot * Math.min(1, Math.max(0, +feeRate || 0)));
  const dist = pot - fee, n = Math.min(rankedIds.length, split.length);
  const w = split.slice(0, n).map((v) => Math.max(0, +v || 0)), sum = w.reduce((a, b) => a + b, 0);
  const alloc = new Map(); let paid = 0;
  if (n && sum > 0) for (let i = 0; i < n; i++) { const v = Math.floor(dist * w[i] / sum); alloc.set(rankedIds[i], v); paid += v; }
  return { fee, dist, dust: dist - paid, alloc };
}

// ---------------- ocena ryzyka po meczu DM (czysta funkcja) ----------------
// Serwer liczy strzały i trafienia sam (rozrzut po stronie serwera), więc celność i trafienia w głowę są wiarygodne.
// Jeden sygnał rzadko przesądza: ryzyko = 1 − Π(1 − s). Wysokie ryzyko wstrzymuje nagrodę, nie banuje.
export function assessDm(st, ac = ECON_DEFAULTS.ac) {
  const flags = [], add = (code, score, text) => { if (score > 0) flags.push({ code, score: +score.toFixed(2), text }); };
  const shots = st.shots || 0, hits = st.hits || 0, heads = st.heads || 0, sev = st.sev || 0;
  if (st.kicked) add('wyrzucony', 1, 'serwer wyrzucił gracza z meczu za niedozwolony ruch');
  if (shots >= ac.accMinShots) { const acc = hits / shots; add('celnosc', acc >= ac.accMax ? 0.6 : acc >= ac.accHigh ? 0.3 : 0, `celność ${Math.round(acc * 100)}% (${hits}/${shots})`); }
  if (hits >= ac.hsMinHits) { const hs = heads / hits; add('glowa', hs >= ac.hsMax ? 0.6 : hs >= ac.hsHigh ? 0.3 : 0, `${Math.round(hs * 100)}% trafień w głowę (${heads}/${hits})`); }
  if (sev >= ac.sevMoves) add('ruch', sev >= ac.sevMovesMax ? 0.6 : 0.3, `${sev} odrzuconych ruchów (teleport, latanie, przenikanie, za szybko)`);
  flags.sort((a, b) => b.score - a.score);
  const risk = +(1 - flags.reduce((p, f) => p * (1 - f.score), 1)).toFixed(2);
  return { risk, flags, summary: { shots, hits, heads, acc: shots ? +(hits / shots).toFixed(2) : 0, hs: hits ? +(heads / hits).toFixed(2) : 0, sev } };
}

export const REPORT_CATS = ['aimbot', 'wallhack', 'ammo', 'speed', 'exploit', 'suspicious', 'other'];

export function migrate(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS dm_entries(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), t INTEGER NOT NULL, tier TEXT NOT NULL,
    entry_usd REAL NOT NULL, lamports INTEGER NOT NULL, price REAL NOT NULL, state TEXT NOT NULL DEFAULT 'queued', room TEXT, map TEXT, players INTEGER,
    rank INTEGER, place INTEGER, kills INTEGER, deaths INTEGER, damage INTEGER, payout_lamports INTEGER NOT NULL DEFAULT 0, fee_lamports INTEGER NOT NULL DEFAULT 0, ended INTEGER);
  CREATE INDEX IF NOT EXISTS dm_entries_room ON dm_entries(room);
  CREATE INDEX IF NOT EXISTS dm_entries_user ON dm_entries(user_id, t DESC);
  CREATE INDEX IF NOT EXISTS dm_entries_state ON dm_entries(state);
  CREATE INDEX IF NOT EXISTS dm_entries_ended ON dm_entries(ended);
  CREATE TABLE IF NOT EXISTS dm_matches(key TEXT PRIMARY KEY, t INTEGER NOT NULL, tier TEXT NOT NULL, entry_usd REAL NOT NULL, map TEXT, players INTEGER NOT NULL,
    cfg TEXT NOT NULL, econ TEXT NOT NULL DEFAULT '{}', cfg_ver INTEGER, state TEXT NOT NULL DEFAULT 'live', pot INTEGER NOT NULL DEFAULT 0, fee INTEGER NOT NULL DEFAULT 0,
    dust INTEGER NOT NULL DEFAULT 0, started INTEGER, ended INTEGER, settled INTEGER, results TEXT, log TEXT, note TEXT);
  CREATE INDEX IF NOT EXISTS dm_matches_state ON dm_matches(state, t DESC);
  CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY, t INTEGER NOT NULL, match_key TEXT NOT NULL, reporter_id INTEGER NOT NULL, target_id INTEGER NOT NULL,
    category TEXT NOT NULL, descr TEXT NOT NULL DEFAULT '', weight REAL NOT NULL DEFAULT 1, state TEXT NOT NULL DEFAULT 'open', stats TEXT,
    decided INTEGER, decided_by TEXT, note TEXT, UNIQUE(match_key, reporter_id, target_id));
  CREATE INDEX IF NOT EXISTS reports_target ON reports(target_id, t DESC);
  CREATE INDEX IF NOT EXISTS reports_state ON reports(state, t DESC);
  CREATE TABLE IF NOT EXISTS incidents(id INTEGER PRIMARY KEY, t INTEGER NOT NULL, user_id INTEGER NOT NULL, match_key TEXT, kind TEXT NOT NULL, score REAL,
    reasons TEXT NOT NULL DEFAULT '[]', state TEXT NOT NULL DEFAULT 'open', decided INTEGER, decided_by TEXT, note TEXT);
  CREATE UNIQUE INDEX IF NOT EXISTS incidents_once ON incidents(user_id, match_key, kind) WHERE match_key IS NOT NULL;
  CREATE INDEX IF NOT EXISTS incidents_open ON incidents(state, t DESC);
  CREATE TABLE IF NOT EXISTS prize_decisions(id INTEGER PRIMARY KEY, t INTEGER NOT NULL, entry_id INTEGER NOT NULL, match_key TEXT NOT NULL, action TEXT NOT NULL,
    reason TEXT NOT NULL, admin TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '{}');`);
  for (const c of ['pid INTEGER', "prize_state TEXT NOT NULL DEFAULT 'none'", 'hold TEXT', 'risk REAL', 'flags TEXT', 'stats TEXT', 'reports REAL']) { try { db.exec('ALTER TABLE dm_entries ADD COLUMN ' + c); } catch {} }
}

// hooks: { usd(lam, price), linkOf(a,b), playedMatches(uid), suspicionOf(uid), flagSusp, setSuspicion(uid, assessment), log(...), now() }
export function createDmEconomy({ db, ledger, tx, hooks = {} }) {
  const q = (s) => db.prepare(s);
  const now = hooks.now || (() => Date.now());
  const log = hooks.log || (() => {});
  const usd = (lam, price) => (price ? Math.round(lam / 1e9 * price * 100) / 100 : 0);
  const linkOf = hooks.linkOf || (() => null);
  const played = hooks.playedMatches || (() => 0);
  const E = (code, msg, status = 400) => new LedgerError(code, msg, status);
  let econ = sanitizeEcon({});
  const setEcon = (c) => { econ = sanitizeEcon(c); return econ; };

  // ---------- wpisowe i zwrot ----------
  function enter({ uid, tier, price, lamports }) {
    if (!(tier.entry >= 0)) throw E('tier', 'Zły poziom');
    const lam = tier.entry > 0 ? lamports : 0;
    if (tier.entry > 0 && !(Number.isSafeInteger(lam) && lam > 0)) throw E('price', 'Brak kursu SOL – spróbuj za chwilę', 503);
    return tx(() => {
      const id = Number(q('INSERT INTO dm_entries(user_id,t,tier,entry_usd,lamports,price) VALUES(?,?,?,?,?,?)').run(uid, now(), tier.id, tier.entry, lam, price || 0).lastInsertRowid);
      if (lam > 0) ledger.debit(uid, lam, { type: 'stake', game: 'dm', usd: -tier.entry, ref: 'dm:entry:' + id, note: 'Deathmatch ' + tier.name, fundsMsg: 'Za mało środków na wpisowe' });
      return { entryId: id, lamports: lam };
    });
  }
  // zwrot tylko dla wpisu w kolejce albo w meczu, który nie został rozliczony (unieważniony)
  function refundEntry(entryId, why = '') {
    return tx(() => {
      const r = q("SELECT * FROM dm_entries WHERE id=? AND state IN ('queued','playing')").get(entryId); if (!r) return false;
      q("UPDATE dm_entries SET state='refunded', ended=? WHERE id=?").run(now(), r.id);
      if (r.lamports > 0) ledger.credit(r.user_id, r.lamports, { type: 'refund', game: 'dm', usd: r.entry_usd, ref: 'dm:refund:' + r.id, note: 'Deathmatch – zwrot wpisowego' + (why ? ' (' + why + ')' : '') });
      return true;
    });
  }

  // ---------- start meczu: zapis z kopią ustawień ----------
  function startMatch({ key, tier, map, entries, cfg, cfgVer }) {
    return tx(() => {
      let pot = 0;
      for (const e of entries) {
        const r = q("SELECT * FROM dm_entries WHERE id=? AND state='queued'").get(e.entryId);
        if (!r) throw E('entry', 'Wpis ' + e.entryId + ' nie czeka w kolejce');
        pot += r.lamports;
        q("UPDATE dm_entries SET state='playing', room=?, map=?, players=?, pid=? WHERE id=?").run(key, map, entries.length, e.pid, r.id);
      }
      q('INSERT INTO dm_matches(key,t,tier,entry_usd,map,players,cfg,econ,cfg_ver,state,pot,started) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(key, now(), tier.id, tier.entry, map, entries.length, JSON.stringify(cfg), JSON.stringify(econ), cfgVer ?? null, 'live', pot, now());
      return { pot, econ: JSON.parse(JSON.stringify(econ)) };
    });
  }

  // ---------- zgłoszenia: waga zgłaszającego i suma dla celu w meczu ----------
  function reporterWeight(reporterId, targetId, ec = econ) {
    if (linkOf(reporterId, targetId)) return 0;                          // „zgłaszam sam siebie” z drugiego konta – nic nie znaczy
    let w = played(reporterId) < ec.reportMinMatches ? 0.5 : 1;
    const h = q("SELECT SUM(state='rejected') rej, SUM(state IN ('rejected','resolved')) dec FROM reports WHERE reporter_id=?").get(reporterId);
    if ((h.dec || 0) >= 3 && (h.rej || 0) / h.dec >= 0.6) w = Math.min(w, 0.25);   // zgłasza na oślep – mniejsza waga
    return w;
  }
  // konta powiązane ze sobą liczą się jak jedno zgłoszenie (zmowa kilku kont jednej osoby)
  function reportScore(matchKey, targetId) {
    const rows = q("SELECT reporter_id, weight FROM reports WHERE match_key=? AND target_id=? AND state!='rejected' ORDER BY t").all(matchKey, targetId);
    const counted = []; let sum = 0;
    for (const r of rows) { if (counted.some((c) => linkOf(c, r.reporter_id))) continue; counted.push(r.reporter_id); sum += r.weight; }
    return +sum.toFixed(2);
  }
  function openIncident(uid, matchKey, kind, score, reasons) {
    const ex = matchKey ? q('SELECT id FROM incidents WHERE user_id=? AND match_key=? AND kind=?').get(uid, matchKey, kind) : null;
    if (ex) { q("UPDATE incidents SET reasons=?, score=MAX(COALESCE(score,0),?) WHERE id=?").run(JSON.stringify(reasons), score ?? 0, ex.id); return ex.id; }
    return Number(q('INSERT INTO incidents(t,user_id,match_key,kind,score,reasons) VALUES(?,?,?,?,?,?)').run(now(), uid, matchKey, kind, score ?? null, JSON.stringify(reasons)).lastInsertRowid);
  }
  const openIncidents = (uid) => q("SELECT COUNT(*) n FROM incidents WHERE user_id=? AND state IN ('open','escalated')").get(uid).n;

  function report(reporterId, { match, target, category, description }) {
    const key = String(match || ''), cat = String(category || '');
    if (!REPORT_CATS.includes(cat)) throw E('category', 'Zła kategoria zgłoszenia');
    const m = q('SELECT * FROM dm_matches WHERE key=?').get(key); if (!m) throw E('match', 'Nie ma takiego meczu', 404);
    const ec = sanitizeEcon(JSON.parse(m.econ || '{}'));
    if (m.state !== 'live' && now() - (m.ended || m.t) > ec.reportWindowH * 3600e3) throw E('late', 'Za późno na zgłoszenie tego meczu');
    const me = q("SELECT * FROM dm_entries WHERE room=? AND user_id=?").get(key, reporterId); if (!me) throw E('match', 'Nie grałeś w tym meczu', 403);
    const tg = typeof target === 'number' || /^\d+$/.test(String(target)) && +target < 1000
      ? q('SELECT * FROM dm_entries WHERE room=? AND pid=?').get(key, +target)
      : q('SELECT e.* FROM dm_entries e JOIN users u ON u.id=e.user_id WHERE e.room=? AND u.username=?').get(key, String(target || ''));
    if (!tg) throw E('target', 'Tego gracza nie było w meczu', 404);
    if (tg.user_id === reporterId) throw E('target', 'Nie można zgłosić siebie');
    const w = reporterWeight(reporterId, tg.user_id, ec);
    return tx(() => {
      const ins = q('INSERT OR IGNORE INTO reports(t,match_key,reporter_id,target_id,category,descr,weight,stats) VALUES(?,?,?,?,?,?,?,?)')
        .run(now(), key, reporterId, tg.user_id, cat, String(description || '').slice(0, 500), w, tg.stats || null);
      if (!ins.changes) throw E('dup', 'Ten gracz jest już przez Ciebie zgłoszony w tym meczu', 409);
      const score = reportScore(key, tg.user_id);
      let flagged = false;
      if (score >= ec.reportThreshold) {
        flagged = true;
        openIncident(tg.user_id, key, 'reports', score, [{ code: 'zgloszenia', text: `${score} ważonych zgłoszeń w meczu (próg ${ec.reportThreshold})` }]);
        // już rozliczony mecz: wstrzymana nagroda dostaje powód; wypłacona – konto ma otwarty incydent, więc wypłaty z niego czekają na admina
        const cur = q('SELECT * FROM dm_entries WHERE id=?').get(tg.id);
        if (cur.prize_state === 'held') { const hold = JSON.parse(cur.hold || '[]'); if (!hold.some((h) => h.code === 'zgloszenia')) hold.push({ code: 'zgloszenia', text: `${score} ważonych zgłoszeń` }); q('UPDATE dm_entries SET hold=?, reports=? WHERE id=?').run(JSON.stringify(hold), score, cur.id); }
        else q('UPDATE dm_entries SET reports=? WHERE id=?').run(score, cur.id);
        log(`[zgłoszenia] ${key}: gracz ${tg.user_id} – ${score} zgłoszeń, incydent`);
      }
      return { ok: true, flagged, weight: w };
    });
  }

  // ---------- rozliczenie meczu ----------
  // results: wynik z dm.mjs (pid, rank, place (0 = wyszedł), kills, deaths, damage, heads, shots, hits, best, sev, kicked)
  function holdReasonsFor(e, r, m, ec, entries, risk) {
    const out = [];
    if (risk.risk >= ec.holdRisk) out.push({ code: 'ryzyko', text: `ryzyko oszustwa ${Math.round(risk.risk * 100)}%` });
    if (r.kicked) out.push({ code: 'wyrzucony', text: 'wyrzucony z meczu za niedozwolony ruch' });
    const rs = reportScore(m.key, e.user_id); if (rs >= ec.reportThreshold) out.push({ code: 'zgloszenia', text: `${rs} ważonych zgłoszeń (próg ${ec.reportThreshold})` });
    const u = q('SELECT banned, suspicion FROM users WHERE id=?').get(e.user_id) || {};
    if (u.banned) out.push({ code: 'zablokowane', text: 'konto zablokowane' });
    if ((u.suspicion || 0) >= (hooks.flagSusp ?? 0.35)) out.push({ code: 'obserwacja', text: `konto pod obserwacją (${Math.round(u.suspicion * 100)}%)` });
    if (openIncidents(e.user_id)) out.push({ code: 'incydent', text: 'otwarty incydent na koncie' });
    if (m.entry_usd > 0) for (const o of entries) if (o.user_id !== e.user_id) { const l = linkOf(e.user_id, o.user_id); if (l) { out.push({ code: 'powiazane', text: `konto powiązane z innym graczem meczu (${l.kind === 'dev' ? 'urządzenie' : l.kind === 'wd' ? 'adres wypłat' : 'IP'})` }); break; } }
    return out;
  }
  function settleMatch(key, results, extra = {}) {
    return tx(() => {
      const m = q('SELECT * FROM dm_matches WHERE key=?').get(key); if (!m) throw E('match', 'Brak meczu ' + key);
      if (m.state !== 'live') return { already: true, state: m.state, prizes: prizesOf(key) };
      const cfg = JSON.parse(m.cfg), ec = sanitizeEcon(JSON.parse(m.econ || '{}'));
      const entries = q("SELECT * FROM dm_entries WHERE room=? AND state='playing' ORDER BY pid").all(key);
      const byPid = new Map(entries.map((e) => [e.pid, e])), res = new Map(results.map((r) => [r.pid, r]));
      const eligible = results.filter((r) => r.place >= 1 && byPid.has(r.pid)).sort((a, b) => a.place - b.place).map((r) => byPid.get(r.pid));
      if (!eligible.length) { const n = voidInTx(m, 'brak graczy na końcu meczu', 'serwer'); return { void: true, refunded: n, prizes: new Map() }; }
      const pot = entries.reduce((a, e) => a + e.lamports, 0);
      const { fee, dust, alloc } = computePrizes(pot, cfg.houseFee, cfg.prizeSplit, eligible.map((e) => e.id));
      const prizes = new Map();
      for (const e of entries) {
        const r = res.get(e.pid) || {}, lam = alloc.get(e.id) || 0, risk = assessDm(r, ec.ac);
        const reasons = holdReasonsFor(e, r, m, ec, entries, risk);
        const prizeUsd = usd(lam, e.price);
        if (lam > 0 && ec.reviewPrizeUsd > 0 && prizeUsd >= ec.reviewPrizeUsd) reasons.push({ code: 'kwota', text: `nagroda od $${ec.reviewPrizeUsd}` });
        const held = lam > 0 && reasons.length > 0;
        const state = r.left || !(r.place >= 1) ? 'left' : lam > 0 || (r.place >= 1 && r.place <= cfg.prizeSplit.length) ? 'won' : 'lost';
        const stats = { shots: r.shots || 0, hits: r.hits || 0, heads: r.heads || 0, best: r.best || 0, sev: r.sev || 0, kicked: r.kicked ? 1 : 0 };
        q(`UPDATE dm_entries SET state=?, rank=?, place=?, kills=?, deaths=?, damage=?, payout_lamports=?, ended=?, prize_state=?, hold=?, risk=?, flags=?, stats=?, reports=? WHERE id=?`)
          .run(state, r.rank || null, r.place || 0, r.kills || 0, r.deaths || 0, r.damage || 0, lam, now(), lam > 0 ? (held ? 'held' : 'paid') : 'none',
            reasons.length ? JSON.stringify(reasons) : null, risk.risk, JSON.stringify(risk.flags), JSON.stringify(stats), reportScore(key, e.user_id), e.id);
        if (lam > 0) {
          ledger.credit(e.user_id, lam, { type: 'win', game: 'dm', usd: prizeUsd, ref: 'dm:prize:' + e.id, note: `Deathmatch · ${r.place}. miejsce` + (held ? ' · weryfikacja' : ''),
            applied: held ? 0 : 1, status: held ? 'pending' : 'ok' });
          if (held) { openIncident(e.user_id, key, 'prize_hold', risk.risk, reasons); log(`[dm] ${key}: nagroda gracza ${e.user_id} wstrzymana – ${reasons.map((x) => x.text).join('; ')}`); }
        } else if (e.lamports > 0) ledger.credit(e.user_id, 0, { type: 'loss', game: 'dm', usd: 0, ref: 'dm:loss:' + e.id, note: `Deathmatch · ${r.rank || '-'}. miejsce` });
        if (!held && risk.risk >= ec.holdRisk) openIncident(e.user_id, key, 'anticheat', risk.risk, risk.flags.map((f) => ({ code: f.code, text: f.text })));
        if (hooks.setSuspicion) hooks.setSuspicion(e.user_id, risk);
        if (hooks.addStats) hooks.addStats(e.user_id, r);
        prizes.set(e.pid, { entryId: e.id, lam, usd: prizeUsd, held });
      }
      ledger.house('fee', fee, { ref: 'dm:fee:' + key, match: key, note: `prowizja ${Math.round(cfg.houseFee * 100)}%` });
      ledger.house('dust', dust, { ref: 'dm:dust:' + key, match: key, note: 'reszta z zaokrągleń' });
      const compact = results.map((r) => [r.pid, r.place || 0, r.kills || 0, r.deaths || 0, r.damage || 0, r.left ? 1 : 0]);
      q("UPDATE dm_matches SET state='settled', pot=?, fee=?, dust=?, ended=?, settled=?, results=?, log=? WHERE key=?")
        .run(pot, fee, dust, now(), now(), JSON.stringify(compact), JSON.stringify((extra.log || []).slice(-200)), key);
      return { pot, fee, dust, prizes };
    });
  }
  function prizesOf(key) {
    return new Map(q("SELECT id, pid, payout_lamports lam, price, prize_state FROM dm_entries WHERE room=?").all(key).map((e) => [e.pid, { entryId: e.id, lam: e.lam, usd: usd(e.lam, e.price), held: e.prize_state === 'held' }]));
  }

  // ---------- unieważnienie (awaria, brak graczy, decyzja admina): zwrot wpisowego wszystkim ----------
  function voidInTx(m, reason, who) {
    let n = 0;
    for (const e of q("SELECT id FROM dm_entries WHERE room=? AND state IN ('queued','playing')").all(m.key)) if (refundEntry(e.id, reason)) n++;
    q("UPDATE dm_matches SET state='void', ended=COALESCE(ended,?), settled=?, note=? WHERE key=?").run(now(), now(), `${reason} (${who})`, m.key);
    return n;
  }
  function voidMatch(key, reason, who = 'serwer') {
    return tx(() => {
      const m = q('SELECT * FROM dm_matches WHERE key=?').get(key); if (!m) throw E('match', 'Nie ma takiego meczu', 404);
      if (m.state !== 'live') throw E('state', 'Mecz jest już rozliczony albo unieważniony', 409);
      const n = voidInTx(m, reason, who); log(`[dm] ${key}: unieważniony (${reason}), zwroty: ${n}`); return { refunded: n };
    });
  }
  // start serwera: wszystko, co było w kolejce albo w trakcie meczu, dostaje zwrot (mecz przerwany przez awarię/restart)
  function recover() {
    return tx(() => {
      let matches = 0, refunds = 0;
      for (const m of q("SELECT * FROM dm_matches WHERE state='live'").all()) { refunds += voidInTx(m, 'restart serwera', 'serwer'); matches++; }
      for (const e of q("SELECT id FROM dm_entries WHERE state IN ('queued','playing')").all()) if (refundEntry(e.id, 'restart serwera')) refunds++;
      return { matches, refunds };
    });
  }

  // ---------- decyzje admina o wstrzymanej nagrodzie ----------
  const prizeRows = (entryId) => q("SELECT * FROM txs WHERE (ref=? OR ref LIKE ?) AND applied=0 AND status='pending'").all('dm:prize:' + entryId, 'dm:redist:' + entryId + ':%');
  function decide(entryId, action, reason, admin) {
    const why = String(reason || '').trim(); if (why.length < 3) throw E('reason', 'Podaj powód decyzji');
    if (!['release', 'forfeit', 'redistribute'].includes(action)) throw E('action', 'Decyzja: release, forfeit albo redistribute');
    return tx(() => {
      const e = q('SELECT * FROM dm_entries WHERE id=?').get(+entryId); if (!e) throw E('entry', 'Nie ma takiego wpisu', 404);
      if (e.prize_state !== 'held') throw E('state', 'Ta nagroda nie czeka na decyzję', 409);
      const m = q('SELECT * FROM dm_matches WHERE key=?').get(e.room);
      const held = prizeRows(e.id), amount = held.reduce((a, t) => a + t.lamports, 0);
      const did = Number(q('INSERT INTO prize_decisions(t,entry_id,match_key,action,reason,admin) VALUES(?,?,?,?,?,?)').run(now(), e.id, e.room, action, why.slice(0, 300), String(admin)).lastInsertRowid);
      let detail = { amount };
      if (action === 'release') {
        for (const t of held) ledger.apply(t.id, { status: 'ok', note: `Deathmatch · ${e.place}. miejsce` });
        q("UPDATE dm_entries SET prize_state='paid' WHERE id=?").run(e.id);
      } else {
        for (const t of held) q("UPDATE txs SET status='failed', note=? WHERE id=?").run('Deathmatch · nagroda odrzucona', t.id);
        q("UPDATE dm_entries SET prize_state=?, payout_lamports=0 WHERE id=?").run(action === 'forfeit' ? 'forfeit' : 'disq', e.id);
        const ec = sanitizeEcon(JSON.parse(m.econ || '{}'));
        if (action === 'forfeit' || ec.disputePolicy === 'house') ledger.house('forfeit', amount, { ref: 'dm:forfeit:' + e.id, match: e.room, note: 'nagroda odrzucona: ' + why.slice(0, 80) });
        else detail = { amount, ...redistribute(m, did) };
      }
      q("UPDATE incidents SET state='closed', decided=?, decided_by=?, note=? WHERE user_id=? AND match_key=? AND kind='prize_hold' AND state!='closed'").run(now(), String(admin), `${action}: ${why}`.slice(0, 300), e.user_id, e.room);
      q('UPDATE prize_decisions SET detail=? WHERE id=?').run(JSON.stringify(detail), did);
      log(`[dm] ${e.room}: nagroda wpisu ${e.id} – ${action} (${admin}: ${why})`);
      return { ok: true, action, ...detail };
    });
  }
  // przesunięcie: wykluczeni (dyskwalifikacja) wypadają z rankingu, pozostali przesuwają się w górę; różnice dopisujemy
  function redistribute(m, did) {
    const cfg = JSON.parse(m.cfg), ec = sanitizeEcon(JSON.parse(m.econ || '{}'));
    const entries = q('SELECT * FROM dm_entries WHERE room=? AND place>=1 ORDER BY place').all(m.key);
    const keep = entries.filter((e) => e.prize_state !== 'disq' && e.prize_state !== 'forfeit');
    const { dust, alloc } = computePrizes(m.pot, cfg.houseFee, cfg.prizeSplit, keep.map((e) => e.id));
    const moves = [];
    for (const e of keep) {
      const delta = (alloc.get(e.id) || 0) - e.payout_lamports; if (delta <= 0) continue;
      const reasons = e.prize_state === 'held' ? JSON.parse(e.hold || '[]') : (() => { const r = JSON.parse(e.hold || '[]'); if ((e.risk || 0) >= ec.holdRisk && !r.length) r.push({ code: 'ryzyko', text: `ryzyko ${Math.round(e.risk * 100)}%` }); if (openIncidents(e.user_id)) r.push({ code: 'incydent', text: 'otwarty incydent na koncie' }); return r; })();
      const held = e.prize_state === 'held' || reasons.length > 0;
      ledger.credit(e.user_id, delta, { type: 'win', game: 'dm', usd: usd(delta, e.price), ref: `dm:redist:${e.id}:${did}`, note: 'Deathmatch · przesunięcie po dyskwalifikacji', applied: held ? 0 : 1, status: held ? 'pending' : 'ok' });
      q('UPDATE dm_entries SET payout_lamports=payout_lamports+?, prize_state=?, hold=? WHERE id=?').run(delta, held ? 'held' : 'paid', reasons.length ? JSON.stringify(reasons) : null, e.id);
      if (held && e.prize_state !== 'held') openIncident(e.user_id, m.key, 'prize_hold', e.risk, reasons);
      moves.push({ entry: e.id, user: e.user_id, delta, held });
    }
    const adj = dust - m.dust;
    if (adj) { ledger.house('dust', adj, { ref: `dm:dustadj:${m.key}:${did}`, match: m.key, note: 'pył po przesunięciu nagród' }); q('UPDATE dm_matches SET dust=? WHERE key=?').run(dust, m.key); }
    return { moves, dustAdj: adj };
  }

  // ---------- incydenty i zgłoszenia (panel admina) ----------
  function decideReport(id, action, note, admin) {
    if (!['resolve', 'reject', 'escalate'].includes(action)) throw E('action', 'Decyzja: resolve, reject albo escalate');
    return tx(() => {
      const r = q('SELECT * FROM reports WHERE id=?').get(+id); if (!r) throw E('report', 'Nie ma takiego zgłoszenia', 404);
      q('UPDATE reports SET state=?, decided=?, decided_by=?, note=? WHERE id=?').run({ resolve: 'resolved', reject: 'rejected', escalate: 'escalated' }[action], now(), String(admin), String(note || '').slice(0, 300), r.id);
      if (action === 'escalate') openIncident(r.target_id, r.match_key, 'reports', reportScore(r.match_key, r.target_id), [{ code: 'eskalacja', text: 'zgłoszenie przekazane wyżej przez admina' }]);
      return { ok: true };
    });
  }
  function decideIncident(id, action, note, admin) {
    if (!['close', 'escalate', 'reopen'].includes(action)) throw E('action', 'Decyzja: close, escalate albo reopen');
    const i = q('SELECT * FROM incidents WHERE id=?').get(+id); if (!i) throw E('incident', 'Nie ma takiego incydentu', 404);
    if (action === 'close' && i.kind === 'prize_hold' && q("SELECT 1 FROM dm_entries WHERE user_id=? AND room=? AND prize_state='held'").get(i.user_id, i.match_key))
      throw E('held', 'Najpierw zdecyduj o wstrzymanej nagrodzie tego meczu', 409);
    q('UPDATE incidents SET state=?, decided=?, decided_by=?, note=? WHERE id=?').run({ close: 'closed', escalate: 'escalated', reopen: 'open' }[action], now(), String(admin), String(note || '').slice(0, 300), i.id);
    return { ok: true };
  }

  // ---------- rankingi (dzienny / tygodniowy / od początku): wygrane, zabójstwa, podia ----------
  const lbCache = new Map();
  function leaderboard(period = 'all', cat = 'winnings', limit = 50) {
    const P = { daily: 864e5, weekly: 7 * 864e5, all: 0 }; if (!(period in P)) period = 'all';
    if (!['winnings', 'kills', 'podiums'].includes(cat)) cat = 'winnings';
    const k = period + '|' + cat + '|' + limit, c = lbCache.get(k); if (c && now() - c.t < 30000) return c.v;
    const since = P[period] ? now() - P[period] : 0;
    const metric = cat === 'kills' ? 'SUM(e.kills)' : cat === 'podiums' ? 'SUM(e.place BETWEEN 1 AND 3)' : "SUM(CASE WHEN e.prize_state='paid' THEN e.payout_lamports/1e9*e.price ELSE 0 END)";
    const rows = q(`SELECT u.username name, u.avatar, ${metric} v, COUNT(*) matches, SUM(e.kills) kills, SUM(e.place BETWEEN 1 AND 3) podiums,
      SUM(CASE WHEN e.prize_state='paid' THEN e.payout_lamports/1e9*e.price ELSE 0 END) won
      FROM dm_entries e JOIN users u ON u.id=e.user_id WHERE e.state IN ('won','lost','left') AND e.ended>=? AND u.banned=0 GROUP BY e.user_id HAVING v>0 ORDER BY v DESC LIMIT ?`).all(since, limit)
      .map((r, i) => ({ rank: i + 1, name: r.name, avatar: r.avatar || '', value: cat === 'winnings' ? Math.round(r.v * 100) / 100 : r.v, matches: r.matches, kills: r.kills || 0, podiums: r.podiums || 0, won: Math.round((r.won || 0) * 100) / 100 }));
    const v = { period, cat, rows, t: now() }; lbCache.set(k, { t: now(), v }); if (lbCache.size > 50) lbCache.clear();
    return v;
  }

  // ---------- historia gracza i wynik meczu ----------
  function history(uid, limit = 30) {
    return q(`SELECT e.*, m.state mstate, m.pot, m.fee FROM dm_entries e LEFT JOIN dm_matches m ON m.key=e.room WHERE e.user_id=? AND e.state!='queued' ORDER BY e.t DESC LIMIT ?`).all(uid, limit)
      .map((e) => ({ match: e.room, t: e.ended || e.t, tier: e.tier, entry: e.entry_usd, map: e.map, players: e.players, state: e.state, rank: e.rank, place: e.place,
        kills: e.kills, deaths: e.deaths, damage: e.damage, prize: usd(e.payout_lamports, e.price), prizeState: e.prize_state, matchState: e.mstate || null }));
  }
  function matchPublic(key, uid) {
    const m = q('SELECT * FROM dm_matches WHERE key=?').get(key); if (!m) throw E('match', 'Nie ma takiego meczu', 404);
    const rows = q('SELECT e.*, u.username FROM dm_entries e JOIN users u ON u.id=e.user_id WHERE e.room=? ORDER BY COALESCE(e.rank, 99), e.pid').all(key);
    if (uid != null && !rows.some((r) => r.user_id === uid)) throw E('match', 'Nie grałeś w tym meczu', 403);
    return { match: key, t: m.t, ended: m.ended, state: m.state, tier: m.tier, entry: m.entry_usd, map: m.map, players: m.players,
      pot: usd(m.pot, rows[0] ? rows[0].price : 0), fee: usd(m.fee, rows[0] ? rows[0].price : 0),
      standings: rows.map((e) => ({ id: e.pid, nick: e.username, rank: e.rank, place: e.place, kills: e.kills, deaths: e.deaths, damage: e.damage, prize: usd(e.payout_lamports, e.price), prizeState: e.prize_state, you: e.user_id === uid })) };
  }

  return { setEcon, get econ() { return econ; }, enter, refundEntry, startMatch, settleMatch, voidMatch, recover, decide, report, reportScore,
    decideReport, decideIncident, openIncidents, openIncident, leaderboard, history, matchPublic, prizesOf };
}
