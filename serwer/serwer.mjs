// Serwer portfeli BEANLADEN – konta graczy, adres depozytu SOL dla każdego konta, wykrywanie wpłat,
// wypłaty na dowolny adres, stawki meczów 1v1 i dane dla panelu admina.
//
// Model (jak w serwisach z grami): saldo gracza to księga w bazie (lamporty). Każde konto ma własny adres
// depozytu wyprowadzony z jednej frazy (BIP39, ścieżka Phantoma m/44'/501'/i'/0'). Wpłata na ten adres jest
// wykrywana, dopisywana do salda i przenoszona do skarbca (indeks 0). Wypłaty idą ze skarbca.
// Klucze prywatne nie są nigdzie zapisywane – są wyliczane z frazy w chwili podpisu.
//
// Uruchomienie: node serwer.mjs   (zmienne środowiskowe opisane w README.md)
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, sendAndConfirmTransaction, clusterApiUrl } from '@solana/web3.js';
import { derivePath } from 'ed25519-hd-key';
import * as bip39 from 'bip39';
import { WebSocketServer } from 'ws';
import * as MECZ from './mecz.mjs';
import * as DM from './dm.mjs';
import * as BOTY from './dm-boty.mjs';                            // boty zapełniające lobby Deathmatch (ustawienie „bots” w panelu admina)                                   // tryb Deathmatch: stałe darmowe lobby do 20 graczy, broń za zabójstwa, WANTED
import * as XS from './xshare.mjs';                              // udostępnienie gry na X = wejście do Deathmatch
import * as ARS from './arsenal.mjs';                             // Arsenał: bronie za trzymanie tokenu na adresie depozytu (1v1 i Deathmatch)
import * as OCH from './ochrona.mjs';
import * as ANTY from './antycheat.mjs';                          // ocena ryzyka cheatów po meczu (aimbot, triggerbot, silent aim)

// ---------------- konfiguracja ----------------
const env = process.env;
const PORT = +(env.PORT || 8787);
const CLUSTER = env.SOLANA_CLUSTER || 'devnet';                       // devnet | testnet | mainnet-beta
const RPC_URL = env.SOLANA_RPC_URL || clusterApiUrl(CLUSTER);
const DATA_DIR = path.resolve(env.DATA_DIR || path.join(path.dirname(new URL(import.meta.url).pathname), 'dane'));
const ORIGINS = (env.CORS_ORIGINS || '*').split(',').map(s => s.trim()).filter(Boolean);
const HOUSE_FEE = +(env.HOUSE_FEE || 0.10);                             // prowizja od puli (2 × stawka)
const SCAN_MS = +(env.SCAN_MS || 15000);
const MIN_WITHDRAW_LAMPORTS = Math.round(+(env.MIN_WITHDRAW_SOL || 0.001) * LAMPORTS_PER_SOL);
const STAKE_MIN_USD = 1, STAKE_MAX_USD = 1000;
// nowe konta grają o mniejsze stawki: [rozegrane mecze poniżej, najwyższa stawka w $] (cheater na świeżym koncie nie wygra od razu dużo)
const STAKE_TIERS = [[5, 5], [20, 25], [50, 100]];
const STAKE_MSG = { 5: 'Nowe konto: stawka najwyżej $5 (więcej po 5 meczach)', 25: 'Stawka najwyżej $25 – więcej po 20 meczach', 100: 'Stawka najwyżej $100 – więcej po 50 meczach' };
const MM_BLOCK_LINKED = env.MM_BLOCK_LINKED === '1';                 // 1 = kolejka 1v1 nie paruje kont z tym samym IP/urządzeniem/adresem wypłat (domyślnie wyłączone; wygrana takich kont i tak czeka na admina)
const REVIEW_STAKE_USD = +(env.REVIEW_STAKE_USD || 250);               // od takiej stawki każda wygrana czeka na sprawdzenie przez admina
const REPLAY_DAYS = +(env.REPLAY_DAYS || 60);                          // powtórki meczów trzymamy tyle dni (wstrzymane i odrzucone – zawsze)
const GAME_PROTO = 2;                                                  // wersja gry wymagana do meczu 1v1 (stara karta musi się odświeżyć)
const TX_FEE = 5000;
const GOOGLE_CLIENT_ID = (env.GOOGLE_CLIENT_ID || '').trim();   // logowanie przez Google (OAuth, typ: aplikacja internetowa)
const HOST = env.HOST || '127.0.0.1';                                   // tylko ta maszyna (nginx); 0.0.0.0 = cały internet (niezalecane)
const SESSION_MS = +(env.SESSION_DAYS || 30) * 864e5;                   // sesja gracza wygasa po tylu dniach
const ADMIN_IDLE_MS = 30 * 60e3, ADMIN_MAX_MS = 12 * 3600e3;            // sesja panelu admina: 30 min bez ruchu, najwyżej 12 h
const WD_DAILY_USD = +(env.WITHDRAW_DAILY_USD || 500);                  // limit wypłat na konto w ciągu 24 h
const WD_REVIEW_USD = +(env.WITHDRAW_REVIEW_USD || 100);                // wypłata powyżej tej kwoty czeka na akceptację admina
const SEC_HOLD_MS = +(env.SECURITY_HOLD_HOURS || 24) * 3600e3;          // blokada wypłat po zmianie hasła albo e-maila
const GAME_DIR = path.resolve(env.GAME_DIR || path.join(path.dirname(new URL(import.meta.url).pathname), '..'));   // zbudowana gra (index.html) – serwer może ją podawać pod tym samym adresem                                                   // opłata sieci za prosty przelew (lamporty)
if (CLUSTER === 'mainnet-beta' && env.ALLOW_MAINNET !== 'tak') {
  console.error('Mainnet jest zablokowany do czasu ustawienia ALLOW_MAINNET=tak. Zobacz README – „Przed mainnetem”.');
  process.exit(1);
}
fs.mkdirSync(DATA_DIR, { recursive: true });
const REPLAY_DIR = path.join(DATA_DIR, 'powtorki'); fs.mkdirSync(REPLAY_DIR, { recursive: true });   // powtórki meczów (gzip) do sprawdzenia przez admina

// fraza portfeli: ze zmiennej WALLET_MNEMONIC; bez niej (tylko devnet/testnet) generowana raz i zapisywana w dane/fraza.txt
let MNEMONIC = (env.WALLET_MNEMONIC || '').trim();
if (!MNEMONIC) {
  if (CLUSTER === 'mainnet-beta') { console.error('Brak WALLET_MNEMONIC.'); process.exit(1); }
  const f = path.join(DATA_DIR, 'fraza.txt');
  if (fs.existsSync(f)) MNEMONIC = fs.readFileSync(f, 'utf8').trim();
  else { MNEMONIC = bip39.generateMnemonic(256); fs.writeFileSync(f, MNEMONIC + '\n', { mode: 0o600 }); console.log('Wygenerowano nową frazę portfeli w', f, '(tylko sieć testowa).'); }
}
if (!bip39.validateMnemonic(MNEMONIC)) { console.error('WALLET_MNEMONIC jest nieprawidłowa.'); process.exit(1); }
const SEED = bip39.mnemonicToSeedSync(MNEMONIC).toString('hex');
const keypairAt = i => Keypair.fromSeed(derivePath(`m/44'/501'/${i}'/0'`, SEED).key);
const TREASURY = keypairAt(0);
const conn = new Connection(RPC_URL, 'confirmed');

// ---------------- baza ----------------
const db = new DatabaseSync(path.join(DATA_DIR, 'portfele.db'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, pass TEXT NOT NULL, created INTEGER NOT NULL,
  idx INTEGER NOT NULL UNIQUE, address TEXT NOT NULL UNIQUE, lamports INTEGER NOT NULL DEFAULT 0, last_sig TEXT, last_active INTEGER, stats TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS txs(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), t INTEGER NOT NULL, type TEXT NOT NULL,
  lamports INTEGER NOT NULL, usd REAL NOT NULL, fee_usd REAL NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '', sig TEXT, status TEXT NOT NULL DEFAULT 'ok');
CREATE INDEX IF NOT EXISTS txs_user ON txs(user_id, t DESC);
CREATE TABLE IF NOT EXISTS deposits(sig TEXT PRIMARY KEY, user_id INTEGER NOT NULL, lamports INTEGER NOT NULL, t INTEGER NOT NULL, swept INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS matches(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), t INTEGER NOT NULL, stake_usd REAL NOT NULL, stake_lamports INTEGER NOT NULL,
  price REAL NOT NULL, state TEXT NOT NULL DEFAULT 'open', payout_lamports INTEGER NOT NULL DEFAULT 0, fee_lamports INTEGER NOT NULL DEFAULT 0, map TEXT, forfeit INTEGER NOT NULL DEFAULT 0, ended INTEGER);
CREATE INDEX IF NOT EXISTS matches_t ON matches(t DESC);
CREATE TABLE IF NOT EXISTS config(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, t INTEGER NOT NULL, user_id INTEGER, ip TEXT, action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS withdrawals(id INTEGER PRIMARY KEY, tx_id INTEGER NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id), to_addr TEXT NOT NULL, lamports INTEGER NOT NULL,
  usd REAL NOT NULL, t INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'review', decided INTEGER, decided_by INTEGER);`);
// profil: e-mail i awatar; 2FA admina (totp, ostatni użyty krok, sekret w trakcie włączania); czas ostatniej zmiany hasła/e-maila
for (const c of ['email TEXT', 'avatar TEXT', 'google_sub TEXT', 'totp TEXT', 'totp_step INTEGER', 'totp_pending TEXT', 'sec_changed INTEGER']) { try { db.exec('ALTER TABLE users ADD COLUMN ' + c); } catch {} }
// ochrona: blokada konta, podejrzenie (średnia ryzyka z meczów); przy meczu: przeciwnik, pokój, ryzyko, sygnały, powtórka, decyzja admina
for (const c of ['banned INTEGER NOT NULL DEFAULT 0', 'ban_reason TEXT', 'suspicion REAL NOT NULL DEFAULT 0']) { try { db.exec('ALTER TABLE users ADD COLUMN ' + c); } catch {} }
for (const c of ['opp_id INTEGER', 'room TEXT', 'risk REAL', 'flags TEXT', 'replay TEXT', 'review TEXT', 'score TEXT', 'hold TEXT']) { try { db.exec('ALTER TABLE matches ADD COLUMN ' + c); } catch {} }
// urządzenia, adresy IP i adresy wypłat każdego konta (wykrywanie multikont i omijania blokady)
// Deathmatch: wpis gracza do meczu (wpisowe pobrane przy dołączeniu do kolejki, zwrot przy anulowaniu, nagroda za miejsca 1–3)
db.exec(`CREATE TABLE IF NOT EXISTS dm_entries(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), t INTEGER NOT NULL, tier TEXT NOT NULL,
  entry_usd REAL NOT NULL, lamports INTEGER NOT NULL, price REAL NOT NULL, state TEXT NOT NULL DEFAULT 'queued', room TEXT, map TEXT, players INTEGER,
  rank INTEGER, place INTEGER, kills INTEGER, deaths INTEGER, damage INTEGER, payout_lamports INTEGER NOT NULL DEFAULT 0, fee_lamports INTEGER NOT NULL DEFAULT 0, ended INTEGER);
CREATE INDEX IF NOT EXISTS dm_entries_room ON dm_entries(room);
CREATE INDEX IF NOT EXISTS dm_entries_user ON dm_entries(user_id, t DESC);`);
db.exec(`CREATE TABLE IF NOT EXISTS seen(user_id INTEGER NOT NULL, kind TEXT NOT NULL, value TEXT NOT NULL, first INTEGER NOT NULL, last INTEGER NOT NULL, n INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(user_id, kind, value));
CREATE INDEX IF NOT EXISTS seen_val ON seen(kind, value);
CREATE INDEX IF NOT EXISTS matches_room ON matches(room);`);
OCH.adminSchema(db);                                                    // konta panelu admina (osobne od graczy) i ich sesje
const q = sql => db.prepare(sql);
const tx = fn => { db.exec('BEGIN IMMEDIATE'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } };
const STAT_KEYS = ['shots', 'hits', 'heads', 'kills', 'deaths'];

// ---------------- kurs SOL/USD ----------------
let PRICE = 0, PRICE_AT = 0;
async function refreshPrice() {
  const srcs = [
    async () => (await (await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', { signal: AbortSignal.timeout(8000) })).json()).solana.usd,
    async () => +(await (await fetch('https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT', { signal: AbortSignal.timeout(8000) })).json()).price,
  ];
  for (const s of srcs) { try { const p = await s(); if (p > 0) { PRICE = p; PRICE_AT = Date.now(); return; } } catch {} }
  if (!PRICE && env.FALLBACK_PRICE) { PRICE = +env.FALLBACK_PRICE; PRICE_AT = Date.now(); }
}
const toUsd = l => PRICE ? Math.round(l / LAMPORTS_PER_SOL * PRICE * 100) / 100 : 0;

// ---------------- konta ----------------
const { hashPass, checkPass } = OCH;                                    // scrypt (ochrona.mjs); stare hashe przepisywane przy logowaniu
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
function newSession(userId) { const tok = crypto.randomBytes(32).toString('base64url'); q('INSERT INTO sessions(token,user_id,created) VALUES(?,?,?)').run(sha(tok), userId, Date.now()); return tok; }
function userFromReq(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || ''); if (!m) return null;
  return q('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.created>?').get(sha(m[1]), Date.now() - SESSION_MS) || null;
}
// stare sesje (gracz po SESSION_DAYS, admin po 12 h) i bilety znikają same
const purgeSessions = () => { try { q('DELETE FROM sessions WHERE created<?').run(Date.now() - SESSION_MS); q('DELETE FROM admin_tokens WHERE created<? OR last<?').run(Date.now() - ADMIN_MAX_MS, Date.now() - ADMIN_IDLE_MS); } catch (e) { console.warn('[sesje]', e.message); } };
purgeSessions(); setInterval(purgeSessions, 3600e3).unref();

// ---------------- admini ----------------
// Panel admina ma własne konta (tabela admins: login, hasło, 2FA), niezależne od kont graczy. Zakłada się je na serwerze:
// bash beanladen-admin.sh dodaj NAZWA (albo node admin.mjs dodaj NAZWA). Dawne ADMIN_USERS / ADMIN_IDS nie są już używane.
const cfgPut = (k, v) => q('INSERT INTO config(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k, v);
// napis „150 players online” na górze lobby – liczbę i tekst ustawia panel admina (klucz 'online' w config); {n} = liczba
const onlineSanitize = (s = {}) => {
  const text = String(s.text ?? '{n} players online').replace(/[<>]/g, '').trim().slice(0, 60) || '{n} players online';
  return { enabled: s.enabled === undefined ? true : !!s.enabled, count: Math.max(0, Math.min(1e6, Math.round(+(s.count ?? 150) || 0))), text: text.includes('{n}') ? text : '{n} ' + text };
};
let onlineCfg = (() => { try { const r = q("SELECT value FROM config WHERE key='online'").get(); return onlineSanitize(r ? JSON.parse(r.value) : {}); } catch { return onlineSanitize({}); } })();
{ const a = q('SELECT username, totp FROM admins ORDER BY id').all();
  console.log(a.length ? `[admin] konta panelu: ${a.map(x => x.username + (x.totp ? ' (2FA)' : ' (2FA przy pierwszym logowaniu)')).join(', ')}` : '[admin] brak konta panelu admina – dodaj je: bash beanladen-admin.sh dodaj NAZWA');
  if (env.ADMIN_USERS || env.ADMIN_IDS) console.log('[admin] ADMIN_USERS / ADMIN_IDS w .env nie są już używane (panel ma własne konta)'); }
const audit = (who, ip, action, detail = '') => { try { q('INSERT INTO audit(t,who,ip,action,detail) VALUES(?,?,?,?,?)').run(Date.now(), who ?? null, ip || '', action, String(detail).slice(0, 300)); } catch {} };
function totals(uid) {
  const m = q(`SELECT COUNT(*) n, SUM(state='won') w, SUM(state='lost') l, COALESCE(SUM(stake_usd),0) staked,
    COALESCE(SUM(CASE WHEN state='won' THEN payout_lamports/1e9*price END),0) won, COALESCE(SUM(CASE WHEN state='won' THEN fee_lamports/1e9*price END),0) fees
    FROM matches WHERE user_id=? AND state!='open'`).get(uid);
  const d = q(`SELECT COALESCE(SUM(CASE WHEN type='deposit' THEN usd END),0) dep, COALESCE(SUM(CASE WHEN type='withdraw' AND status='ok' THEN -usd END),0) wd FROM txs WHERE user_id=?`).get(uid);
  const r2 = v => Math.round((v || 0) * 100) / 100;
  return { matches: m.n || 0, wins: m.w || 0, losses: m.l || 0, staked: r2(m.staked), won: r2(m.won), fees: r2(m.fees), deposits: r2(d.dep), withdrawn: r2(d.wd) };
}
function publicUser(u) {
  return { username: u.username, email: u.email || '', avatar: u.avatar || '', createdAt: new Date(u.created).toISOString(), address: u.address, lamports: u.lamports, sol: u.lamports / LAMPORTS_PER_SOL,
    balance: toUsd(u.lamports), price: PRICE, cluster: CLUSTER, admin: false, banned: !!u.banned, stakeMax: stakeCap(u.id).cap,
    stats: { ...Object.fromEntries(STAT_KEYS.map(k => [k, 0])), ...JSON.parse(u.stats || '{}'), ...totals(u.id), lastActive: u.last_active || u.created } };
}
const histOf = (uid, n = 60) => q('SELECT t,type,lamports,usd,fee_usd,note,sig,status FROM txs WHERE user_id=? ORDER BY t DESC, id DESC LIMIT ?').all(uid, n)
  .map(h => ({ t: h.t, type: h.type, amount: h.usd, lamports: h.lamports, fee: h.fee_usd || undefined, note: h.note, sig: h.sig || undefined, status: h.status }));
function addTx(uid, type, lamports, usd, extra = {}) {
  q('INSERT INTO txs(user_id,t,type,lamports,usd,fee_usd,note,sig,status) VALUES(?,?,?,?,?,?,?,?,?)').run(uid, Date.now(), type, lamports, usd, extra.fee || 0, extra.note || '', extra.sig || null, extra.status || 'ok');
  q('UPDATE users SET last_active=? WHERE id=?').run(Date.now(), uid);
}

// ---------------- ochrona: urządzenia, multikonta, blokady, limity stawek ----------------
const BANNED_MSG = 'Konto zablokowane za oszukiwanie – gra o stawki i wypłaty są wyłączone.';
const cleanDev = v => /^[0-9a-f]{16,64}$/.test(String(v || '')) ? String(v) : '';
const seenAt = new Map();
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
function noteSeen(uid, kind, value) {
  if (!uid || !value || (kind === 'ip' && LOOPBACK.has(value))) return;   // adres lokalny (test, serwer bez pośrednika) nikogo nie wyróżnia
  const k = uid + '|' + kind + '|' + value, now = Date.now(); if (now - (seenAt.get(k) || 0) < 60000) return;
  seenAt.set(k, now); if (seenAt.size > 50000) seenAt.clear();
  q('INSERT INTO seen(user_id,kind,value,first,last) VALUES(?,?,?,?,?) ON CONFLICT(user_id,kind,value) DO UPDATE SET last=excluded.last, n=n+1').run(uid, kind, value, now, now);
  if (kind === 'ip') return;                                           // wspólne IP (akademik, kawiarnia) to jeszcze nie dowód
  // to samo urządzenie albo adres wypłat co zablokowane konto = ta sama osoba pod nową nazwą
  const b = q('SELECT u.username FROM seen s JOIN users u ON u.id=s.user_id WHERE s.kind=? AND s.value=? AND s.user_id!=? AND u.banned=1 LIMIT 1').get(kind, value, uid);
  if (b) banUser(uid, `${kind === 'dev' ? 'to samo urządzenie' : 'ten sam adres wypłat'} co zablokowane konto ${b.username}`);
}
function banUser(uid, reason, on = true) {
  const u = fresh(uid); if (!u || !!u.banned === on) return;
  q('UPDATE users SET banned=?, ban_reason=? WHERE id=?').run(on ? 1 : 0, on ? String(reason || '').slice(0, 200) : null, uid);
  console.log(`[antycheat] ${on ? 'zablokowane' : 'odblokowane'} konto ${u.username}${on ? ': ' + reason : ''}`);
}
// dwa konta jednej osoby: wspólne urządzenie albo adres wypłat (wspólne IP – np. jedno wifi – się NIE liczy)
function linkOf(a, b) {
  return q(`SELECT s1.kind FROM seen s1 JOIN seen s2 ON s2.kind=s1.kind AND s2.value=s1.value AND s2.user_id=?
    WHERE s1.user_id=? AND s1.kind!='ip' LIMIT 1`).get(b, a) || null;
}
const linkedAccounts = uid => q(`SELECT u.username name, u.banned, GROUP_CONCAT(DISTINCT s1.kind) kinds FROM seen s1
  JOIN seen s2 ON s2.kind=s1.kind AND s2.value=s1.value AND s2.user_id!=s1.user_id JOIN users u ON u.id=s2.user_id WHERE s1.user_id=? GROUP BY u.id LIMIT 30`).all(uid);
const playedMatches = uid => q("SELECT COUNT(*) n FROM matches WHERE user_id=? AND state IN ('won','lost','held')").get(uid).n;
function stakeCap(uid) { const n = playedMatches(uid); for (const [lim, cap] of STAKE_TIERS) if (n < lim) return { cap, n, next: lim }; return { cap: STAKE_MAX_USD, n, next: null }; }

// ---------------- wpłaty: wykrywanie i przeniesienie do skarbca ----------------
const isOurs = new Set();                                              // podpisy przelewów wysłanych przez serwer (przeniesienia)
async function scanUser(u) {
  const pk = new PublicKey(u.address);
  const sigs = await conn.getSignaturesForAddress(pk, { limit: 50, ...(u.last_sig ? { until: u.last_sig } : {}) });
  if (!sigs.length) return 0;
  for (const s of sigs.slice().reverse()) {                            // od najstarszego
    if (s.err || isOurs.has(s.signature) || q('SELECT 1 FROM deposits WHERE sig=?').get(s.signature)) continue;
    const t = await conn.getTransaction(s.signature, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' });
    if (!t || t.meta.err) continue;
    const keys = t.transaction.message.getAccountKeys ? t.transaction.message.getAccountKeys().staticAccountKeys : t.transaction.message.accountKeys;
    const i = keys.findIndex(k => k.toBase58() === u.address); if (i < 0) continue;
    const delta = t.meta.postBalances[i] - t.meta.preBalances[i];
    if (delta <= 0) continue;                                          // wychodzące (przeniesienie do skarbca) – pomijamy
    const from = keys[0] ? keys[0].toBase58() : '';
    tx(() => {
      q('INSERT INTO deposits(sig,user_id,lamports,t) VALUES(?,?,?,?)').run(s.signature, u.id, delta, Date.now());
      q('UPDATE users SET lamports=lamports+? WHERE id=?').run(delta, u.id);
      addTx(u.id, 'deposit', delta, toUsd(delta), { sig: s.signature, note: from ? from.slice(0, 4) + '…' + from.slice(-4) : '' });
    });
    console.log(`[wpłata] ${u.username} +${delta / LAMPORTS_PER_SOL} SOL (${s.signature.slice(0, 10)}…)`);
  }
  q('UPDATE users SET last_sig=? WHERE id=?').run(sigs[0].signature, u.id);
  await sweep(u);
  return sigs.length;
}
async function sweep(u) {                                              // cały depozyt (minus opłata) idzie do skarbca
  const bal = await conn.getBalance(new PublicKey(u.address));
  if (bal <= TX_FEE * 2) return;
  const kp = keypairAt(u.idx);
  const t = new Transaction().add(SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: TREASURY.publicKey, lamports: bal - TX_FEE }));
  try { const sig = await sendAndConfirmTransaction(conn, t, [kp], { commitment: 'confirmed' }); isOurs.add(sig); q('UPDATE users SET last_sig=? WHERE id=?').run(sig, u.id);
    q('UPDATE deposits SET swept=1 WHERE user_id=? AND swept=0').run(u.id); console.log(`[skarbiec] ${u.username}: ${(bal - TX_FEE) / LAMPORTS_PER_SOL} SOL przeniesione`); }
  catch (e) { console.warn('[skarbiec] przeniesienie nieudane', u.username, e.message); }
}
let scanning = false;
// salda adresów depozytów czytamy zbiorczo (getMultipleAccountsInfo: 1 zapytanie na 100 graczy); pełny skan historii
// (getSignaturesForAddress + getTransaction) tylko dla adresów, których saldo zmieniło się od ostatniego skanu
const lastBal = new Map();                                             // adres -> saldo (lamporty) przy ostatnim udanym skanie
const misses = new Map();                                              // adres -> ile skanów z rzędu bez nowych podpisów mimo zmiany salda
async function scanAll() {
  if (scanning) return; scanning = true;
  try {
    const users = q('SELECT * FROM users WHERE address IS NOT NULL ORDER BY last_active DESC').all();
    for (let i = 0; i < users.length; i += 100) {
      const part = users.slice(i, i + 100);
      let infos;
      try { infos = await conn.getMultipleAccountsInfo(part.map(u => new PublicKey(u.address)), 'confirmed'); }
      catch (e) { console.warn('[skan] salda', e.message); continue; }
      for (let j = 0; j < part.length; j++) {
        const u = part[j], bal = infos[j] ? infos[j].lamports : 0;
        if (bal === 0 || lastBal.get(u.address) === bal) { lastBal.set(u.address, bal); continue; }   // pusto (wszystko w skarbcu) albo bez zmian
        try {                                                          // saldo już widać, a historii jeszcze nie (opóźnienie węzła RPC) – ponawiamy, najwyżej 8 razy
          const n = await scanUser(u), m = n ? 0 : (misses.get(u.address) || 0) + 1;
          if (n || m >= 8) { lastBal.set(u.address, bal); misses.delete(u.address); } else misses.set(u.address, m);
        } catch (e) { console.warn('[skan]', u.username, e.message); }
      }
    }
  } finally { scanning = false; }
}
// „Sprawdź wpłatę” / odświeżanie otwartego portfela (co 8 s): najwyżej raz na 10 s na gracza, a pełny skan tylko gdy saldo adresu się zmieniło
const quickAt = new Map();
async function scanQuick(u) {
  if (!u.address || Date.now() - (quickAt.get(u.id) || 0) < 10e3) return;
  quickAt.set(u.id, Date.now());
  const bal = await conn.getBalance(new PublicKey(u.address));
  if (bal === 0 || lastBal.get(u.address) === bal) return;
  if (await scanUser(u)) { lastBal.set(u.address, bal); misses.delete(u.address); }
}
setInterval(() => { const lim = Date.now() - 60e3; for (const [k, t] of quickAt) if (t < lim) quickAt.delete(k); }, 300e3).unref();

// ---------------- HTTP ----------------
const limited = OCH.makeLimiter();                                     // limity prób: klucz (IP, nick) -> czasy prób w oknie
function send(res, code, obj, origin) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(origin) }); res.end(body);
}
function cors(origin) {
  const ok = ORIGINS.includes('*') ? '*' : (origin && ORIGINS.includes(origin) ? origin : ORIGINS[0]);
  return { 'Access-Control-Allow-Origin': ok, 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token, X-Dev', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', Vary: 'Origin' };
}
const readBody = req => new Promise((ok, no) => { let b = ''; req.on('data', c => { b += c; if (b.length > 1e5) { no(new Error('za duże')); req.destroy(); } }); req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch { no(new Error('zły JSON')); } }); });
class E extends Error { constructor(code, msg, status = 400) { super(msg); this.code = code; this.status = status; } }
const need = u => { if (!u) throw new E('auth', 'Zaloguj się', 401); return u; };
const fresh = id => q('SELECT * FROM users WHERE id=?').get(id);
const explorer = sig => `https://explorer.solana.com/tx/${sig}${CLUSTER === 'mainnet-beta' ? '' : '?cluster=' + CLUSTER}`;
const PASS_MSG = `Hasło: co najmniej ${OCH.PASS_MIN} znaków`, NEWPASS_MSG = `Nowe hasło: co najmniej ${OCH.PASS_MIN} znaków`;
const RESERVED_MSG = 'Ta nazwa jest zastrzeżona';
const reserved = n => OCH.reservedName(n);

// panel admina: sesja z logowania login + hasło + kod 2FA, w nagłówku X-Admin-Token
function adminFromReq(req) {
  const tok = String(req.headers['x-admin-token'] || ''), now = Date.now(); if (!tok) return null;
  const s = q('SELECT t.token, t.created, t.last, a.id, a.username FROM admin_tokens t JOIN admins a ON a.id=t.admin_id WHERE t.token=?').get(sha(tok));
  if (!s || s.created < now - ADMIN_MAX_MS || s.last < now - ADMIN_IDLE_MS) return null;
  q('UPDATE admin_tokens SET last=? WHERE token=?').run(now, s.token);
  return { id: s.id, username: s.username };
}
function adminGate(req) { const a = adminFromReq(req); if (!a) throw new E('admin2fa', 'Zaloguj się do panelu admina', 401); return a; }
function newAdminToken(adminId, ip) { const tok = crypto.randomBytes(32).toString('base64url'), now = Date.now(); q('INSERT INTO admin_tokens(token,admin_id,created,last,ip) VALUES(?,?,?,?,?)').run(sha(tok), adminId, now, now, ip || ''); return tok; }
const adminSetups = new Map();                                         // pierwsze logowanie: token -> {id, secret, exp} (10 min na zeskanowanie kodu QR)
const ADMIN_BAD = 'Zły login, hasło lub kod 2FA';

// wypłata ze skarbca dla zapisanej operacji (txs.id); błąd = zwrot na saldo
async function payout(txId, userId, to, lam) {
  try {
    const t = new Transaction().add(SystemProgram.transfer({ fromPubkey: TREASURY.publicKey, toPubkey: to, lamports: lam }));
    const sig = await sendAndConfirmTransaction(conn, t, [TREASURY], { commitment: 'confirmed' });
    q("UPDATE txs SET status='ok', sig=? WHERE id=?").run(sig, txId);
    console.log(`[wypłata] użytkownik ${userId}: ${lam / LAMPORTS_PER_SOL} SOL -> ${to.toBase58()}`);
    return sig;
  } catch (e) {
    tx(() => { q('UPDATE users SET lamports=lamports+? WHERE id=?').run(lam, userId); q("UPDATE txs SET status='failed', note=note||' · zwrot' WHERE id=?").run(txId); });
    console.warn('[wypłata] nieudana', e.message);
    return null;
  }
}

const routes = {
  'GET /api/health': async () => ({ ok: true, cluster: CLUSTER, price: PRICE, treasury: TREASURY.publicKey.toBase58() }),
  'GET /api/price': async () => ({ price: PRICE, at: PRICE_AT }),
  'POST /api/register': async ({ body, ip, dev }) => {
    if (limited(ip)) throw new E('rate', 'Za dużo prób – odczekaj minutę', 429);
    const u = String(body.username || '').trim(), p = String(body.password || '');
    if (!/^[a-z0-9_]{3,16}$/i.test(u)) throw new E('user', 'Nazwa: 3–16 znaków (litery, cyfry, _)');
    if (reserved(u)) throw new E('reserved', RESERVED_MSG, 409);
    if (p.length < OCH.PASS_MIN || p.length > 128) throw new E('pass', PASS_MSG);
    if (q('SELECT 1 FROM users WHERE username=?').get(u)) throw new E('exists', 'Ta nazwa jest zajęta', 409);
    const pass = await hashPass(p);
    const id = tx(() => {
      const idx = (q('SELECT MAX(idx) m FROM users').get().m || 0) + 1;
      const address = keypairAt(idx).publicKey.toBase58();
      return Number(q('INSERT INTO users(username,pass,created,idx,address,last_active) VALUES(?,?,?,?,?,?)').run(u, pass, Date.now(), idx, address, Date.now()).lastInsertRowid);
    });
    console.log('[konto]', u, fresh(id).address);
    noteSeen(id, 'ip', ip); noteSeen(id, 'dev', dev);
    return { token: newSession(id), account: publicUser(fresh(id)), history: [] };
  },
  'POST /api/login': async ({ body, ip, dev }) => {
    const name = String(body.username || '').trim(), pw = String(body.password || '');
    // limit na IP i osobno na nick (zgadywanie hasła jednego konta z wielu adresów)
    if (limited('login:' + ip) || limited('u:' + name.toLowerCase(), 20, 15 * 60e3)) throw new E('rate', 'Za dużo prób – odczekaj minutę', 429);
    const u = q('SELECT * FROM users WHERE username=?').get(name);
    if (!u) { await OCH.fakeCheck(pw); throw new E('creds', 'Zła nazwa lub hasło', 401); }
    if (!(await checkPass(pw, u.pass))) throw new E('creds', 'Zła nazwa lub hasło', 401);
    if (OCH.needsRehash(u.pass)) q('UPDATE users SET pass=? WHERE id=?').run(await hashPass(pw), u.id);   // mocniejszy hash przy okazji logowania
    q('UPDATE users SET last_active=? WHERE id=?').run(Date.now(), u.id);
    noteSeen(u.id, 'ip', ip); noteSeen(u.id, 'dev', dev);
    scanUser(u).catch(() => {});
    return { token: newSession(u.id), account: publicUser(fresh(u.id)), history: histOf(u.id) };
  },
  'POST /api/logout': async ({ req }) => { const m = /^Bearer (.+)$/.exec(req.headers.authorization || ''); if (m) q('DELETE FROM sessions WHERE token=?').run(sha(m[1])); return { ok: true }; },
  'GET /api/me': async ({ user }) => { need(user); return { account: publicUser(fresh(user.id)), history: histOf(user.id) }; },
  // jednorazowy bilet (30 s) do połączenia z /ws – token sesji nie trafia do adresu
  'POST /api/ws-ticket': async ({ user }) => { need(user); return { ticket: OCH.wsTicket(user.id) }; },
  'POST /api/scan': async ({ user }) => { need(user); await scanQuick(fresh(user.id)); return { account: publicUser(fresh(user.id)), history: histOf(user.id) }; },
  'GET /api/earnings': async ({ user }) => {
    need(user);
    const rows = q(`SELECT t, ended, state, stake_usd, payout_lamports, price, map FROM matches WHERE user_id=? AND state IN ('won','lost') ORDER BY COALESCE(ended,t)`).all(user.id);
    let cum = 0;
    return { points: rows.map(m => { const net = m.state === 'won' ? Math.round((m.payout_lamports / 1e9 * m.price - m.stake_usd) * 100) / 100 : -m.stake_usd; cum = Math.round((cum + net) * 100) / 100;
      return { t: m.ended || m.t, net, cum, won: m.state === 'won', stake: m.stake_usd, map: m.map }; }) };
  },
  'POST /api/faucet': async ({ user }) => {
    need(user); if (CLUSTER === 'mainnet-beta') throw new E('net', 'Tylko w sieci testowej');
    // publiczny RPC devnetu ma zamknięty faucet (testowe SOL tylko przez faucet.solana.com); własny RPC (SOLANA_RPC_URL) może go mieć
    try { const sig = await conn.requestAirdrop(new PublicKey(user.address), 1 * LAMPORTS_PER_SOL); await conn.confirmTransaction(sig, 'confirmed'); setTimeout(() => scanUser(fresh(user.id)).catch(() => {}), 1500); return { ok: true, sig, url: explorer(sig) }; }
    catch (e) { throw new E('faucet', 'Faucet w RPC jest zamknięty – pobierz testowe SOL na faucet.solana.com (adres jest skopiowany).', 429); }
  },
  'POST /api/withdraw': async ({ user, body }) => {
    need(user);
    let to; try { to = new PublicKey(String(body.to || '').trim()); } catch { throw new E('addr', 'Nieprawidłowy adres Solana'); }
    if (to.equals(new PublicKey(user.address))) throw new E('addr', 'To adres Twojego portfela w grze');
    noteSeen(user.id, 'wd', to.toBase58());
    if (fresh(user.id).banned) throw new E('banned', BANNED_MSG, 403);
    let lam = body.lamports != null ? Math.floor(+body.lamports) : body.sol != null ? Math.floor(+body.sol * LAMPORTS_PER_SOL) : body.usd != null && PRICE ? Math.floor(+body.usd / PRICE * LAMPORTS_PER_SOL) : NaN;
    if (!(lam >= MIN_WITHDRAW_LAMPORTS)) throw new E('amount', `Minimalna wypłata: ${MIN_WITHDRAW_LAMPORTS / LAMPORTS_PER_SOL} SOL`);
    const usd = toUsd(lam);
    if (!PRICE) throw new E('price', 'Brak kursu SOL – spróbuj za chwilę', 503);
    // po zmianie hasła albo e-maila wypłaty czekają (przejęte konto nie wypłaci od razu)
    const sc = fresh(user.id).sec_changed || 0;
    if (Date.now() - sc < SEC_HOLD_MS) throw new E('hold', `Wypłaty są wstrzymane przez ${Math.round(SEC_HOLD_MS / 3600e3)} h po zmianie hasła lub e-maila`, 403);
    const review = usd > WD_REVIEW_USD;
    const txId = tx(() => {
      const u = fresh(user.id); if (u.lamports < lam) throw new E('funds', 'Za mało środków');
      const day = -q("SELECT COALESCE(SUM(usd),0) s FROM txs WHERE user_id=? AND type='withdraw' AND status IN ('ok','pending','review') AND t>?").get(u.id, Date.now() - 864e5).s;
      if (day + usd > WD_DAILY_USD) throw new E('limit', `Dzienny limit wypłat to $${WD_DAILY_USD} – zostało $${Math.max(0, Math.floor((WD_DAILY_USD - day) * 100) / 100)}`, 403);
      q('UPDATE users SET lamports=lamports-? WHERE id=?').run(lam, u.id);
      addTx(u.id, 'withdraw', -lam, -usd, { note: to.toBase58().slice(0, 4) + '…' + to.toBase58().slice(-4), status: review ? 'review' : 'pending' });
      const id = Number(q('SELECT last_insert_rowid() id').get().id);
      if (review) q('INSERT INTO withdrawals(tx_id,user_id,to_addr,lamports,usd,t) VALUES(?,?,?,?,?,?)').run(id, u.id, to.toBase58(), lam, usd, Date.now());
      return id;
    });
    if (review) { console.log(`[wypłata] ${user.username} $${usd} czeka na akceptację admina`); return { ok: true, review: true, url: '', account: publicUser(fresh(user.id)), history: histOf(user.id) }; }
    const sig = await payout(txId, user.id, to, lam);
    if (!sig) throw new E('send', 'Wypłata nie przeszła – środki wróciły na saldo. Spróbuj za chwilę.', 502);
    return { ok: true, sig, url: explorer(sig), account: publicUser(fresh(user.id)), history: histOf(user.id) };
  },
  'POST /api/match/start': async ({ user, body }) => {
    need(user);
    if (+body.pv !== GAME_PROTO) throw new E('old', 'Jest nowa wersja gry – odśwież stronę (Ctrl+F5) i zagraj jeszcze raz.', 409);   // stara karta z pamięci przeglądarki
    const usd = Math.round(+body.stakeUsd * 100) / 100;
    if (!(usd >= STAKE_MIN_USD && usd <= STAKE_MAX_USD)) throw new E('stake', `Stawka od $${STAKE_MIN_USD} do $${STAKE_MAX_USD}`);
    if (fresh(user.id).banned) throw new E('banned', BANNED_MSG, 403);
    const cap = stakeCap(user.id); if (usd > cap.cap) throw new E('stake_cap', STAKE_MSG[cap.cap] || `Stawka najwyżej $${cap.cap}`, 403);
    if (!PRICE) throw new E('price', 'Brak kursu SOL – spróbuj za chwilę', 503);
    const lam = Math.round(usd / PRICE * LAMPORTS_PER_SOL), price = PRICE;
    return tx(() => {
      // poprzednia opłacona stawka, która nie czeka w kolejce ani nie trwa (nieudane połączenie, podwójne kliknięcie) – nie było gry,
      // więc wraca do gracza (wcześniej przepadała jako przegrana). Mecz w kolejce albo w trakcie rozlicza wyłącznie serwer meczu.
      for (const m of q("SELECT * FROM matches WHERE user_id=? AND state='open'").all(user.id)) if (!duelActive(m.id)) refundOpen(m, 'nierozegrana stawka');
      const u = fresh(user.id); if (u.lamports < lam) throw new E('funds', 'Za mało środków na stawkę');
      q('UPDATE users SET lamports=lamports-? WHERE id=?').run(lam, u.id);
      const id = Number(q('INSERT INTO matches(user_id,t,stake_usd,stake_lamports,price,map) VALUES(?,?,?,?,?,?)').run(u.id, Date.now(), usd, lam, price, body.map || null).lastInsertRowid);
      addTx(u.id, 'stake', -lam, -usd);
      return { matchId: id, account: publicUser(fresh(u.id)) };
    });
  },
  // Wynik meczu daje wyłącznie serwer meczu (WebSocket): rozlicza stawki obu graczy po ostatniej rundzie.
  // Ten adres zostaje tylko dla zgodności ze starszym lobby i niczego nie zmienia (dawniej przyjmował „wygrałem” od gracza).
  'POST /api/match/end': async ({ user }) => {
    need(user);
    return { account: publicUser(fresh(user.id)), history: histOf(user.id) };
  },
  'GET /api/config': async () => {
    const g = k => { const r = q('SELECT value FROM config WHERE key=?').get(k); return r ? r.value : ''; };
    let authTexts = {}; try { authTexts = JSON.parse(g('authTexts') || '{}'); } catch {}
    return { businessEmail: g('businessEmail'), googleClientId: GOOGLE_CLIENT_ID, authTexts };
  },
  // logowanie przez Google: przeglądarka dostaje token dostępu (Google Identity Services), serwer sprawdza go w Google
  // (czy wydany dla naszej aplikacji i czy e-mail jest potwierdzony), potem loguje albo zakłada konto
  'POST /api/google': async ({ body, ip, dev }) => {
    if (!GOOGLE_CLIENT_ID) throw new E('google_off', 'Logowanie przez Google nie jest skonfigurowane', 503);
    if (limited(ip)) throw new E('rate', 'Za dużo prób – odczekaj minutę', 429);
    let info; try { const r = await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(String(body.accessToken || '')), { signal: AbortSignal.timeout(8000) }); info = await r.json(); if (!r.ok) throw 0; }
    catch { throw new E('google', 'Google nie potwierdził logowania – spróbuj ponownie', 401); }
    if ((info.aud !== GOOGLE_CLIENT_ID && info.azp !== GOOGLE_CLIENT_ID) || !info.sub) throw new E('google', 'Token Google nie jest dla tej gry', 401);
    if (!info.email || String(info.email_verified) !== 'true') throw new E('google', 'Konto Google bez potwierdzonego e-maila', 401);
    const email = String(info.email).toLowerCase();
    let u = q('SELECT * FROM users WHERE google_sub=?').get(info.sub), created = false;
    if (!u) {
      // nowe konto: nick z początku adresu e-mail (litery, cyfry, _), w razie zajętości z dopiskiem cyfr
      let base = email.split('@')[0].replace(/[^a-z0-9_]/gi, '').slice(0, 12) || 'gracz'; if (base.length < 3) base = (base + 'gracz').slice(0, 5);
      if (reserved(base)) base = 'gracz';                         // admin@… nie dostanie nicku „admin”
      let name = base; for (let i = 0; q('SELECT 1 FROM users WHERE username=?').get(name); i++) name = base + (Math.floor(Math.random() * 9000) + 1000);
      const pass = await hashPass(crypto.randomBytes(24).toString('base64'));   // hasło losowe – logowanie przez Google
      const id = tx(() => {
        const idx = (q('SELECT MAX(idx) m FROM users').get().m || 0) + 1, address = keypairAt(idx).publicKey.toBase58();
        return Number(q('INSERT INTO users(username,pass,created,idx,address,last_active,email,google_sub) VALUES(?,?,?,?,?,?,?,?)').run(name, pass, Date.now(), idx, address, Date.now(), email, info.sub).lastInsertRowid);
      });
      u = fresh(id); created = true; console.log('[konto google]', name, u.address);
    }
    q('UPDATE users SET last_active=? WHERE id=?').run(Date.now(), u.id);
    noteSeen(u.id, 'ip', ip); noteSeen(u.id, 'dev', dev);
    return { token: newSession(u.id), account: publicUser(fresh(u.id)), history: histOf(u.id), created };
  },
  // ---- panel admina: osobne konta (login + hasło + kod 2FA) ----
  'GET /api/admin/status': async ({ req }) => { const a = adminFromReq(req); return { unlocked: !!a, username: a ? a.username : '' }; },
  // logowanie: login + hasło + kod. Konto bez 2FA (pierwsze logowanie) dostaje klucz do zeskanowania i token na 10 min do /2fa/enable.
  'POST /api/admin/login': async ({ body, ip }) => {
    const name = String(body.username || '').trim(), pw = String(body.password || '');
    if (limited('adm:' + ip, 8, 5 * 60e3) || limited('admu:' + name.toLowerCase(), 10, 15 * 60e3)) throw new E('rate', 'Za dużo prób – odczekaj chwilę', 429);
    const a = OCH.ADMIN_NAME.test(name) ? q('SELECT * FROM admins WHERE username=?').get(name) : null;
    if (!a) { await OCH.fakeCheck(pw); audit(name.slice(0, 32), ip, 'admin_login_fail', 'nieznany login'); throw new E('creds', ADMIN_BAD, 401); }
    if (!(await checkPass(pw, a.pass))) { audit(a.username, ip, 'admin_login_fail', 'hasło'); throw new E('creds', ADMIN_BAD, 401); }
    if (OCH.needsRehash(a.pass)) q('UPDATE admins SET pass=? WHERE id=?').run(await hashPass(pw), a.id);
    if (!a.totp) {
      const secret = OCH.totpSecret(), setupToken = crypto.randomBytes(24).toString('base64url');
      for (const [k, v] of adminSetups) if (v.exp < Date.now() || v.id === a.id) adminSetups.delete(k);
      adminSetups.set(setupToken, { id: a.id, secret, exp: Date.now() + 10 * 60e3 });
      audit(a.username, ip, '2fa_setup');
      return { setup: true, setupToken, secret, uri: OCH.totpUri(secret, a.username) };
    }
    const st = OCH.totpCheck(a.totp, body.code, a.totp_step);
    if (!st) { audit(a.username, ip, 'admin_login_fail', 'kod 2FA'); throw new E('creds', ADMIN_BAD, 401); }
    q('UPDATE admins SET totp_step=?, last_login=? WHERE id=?').run(st, Date.now(), a.id);
    audit(a.username, ip, 'admin_login');
    return { adminToken: newAdminToken(a.id, ip), username: a.username };
  },
  'POST /api/admin/2fa/enable': async ({ body, ip }) => {
    if (limited('adm:' + ip, 8, 5 * 60e3)) throw new E('rate', 'Za dużo prób – odczekaj chwilę', 429);
    const key = String(body.setupToken || ''), s = adminSetups.get(key);
    if (!s || s.exp < Date.now()) throw new E('setup', 'Czas na włączenie 2FA minął – zaloguj się jeszcze raz', 400);
    const st = OCH.totpCheck(s.secret, body.code, 0); if (!st) throw new E('code', 'Zły kod 2FA', 400);
    adminSetups.delete(key);
    const ch = q('UPDATE admins SET totp=?, totp_step=?, last_login=? WHERE id=? AND totp IS NULL').run(s.secret, st, Date.now(), s.id);
    if (!ch.changes) throw new E('setup', '2FA jest już włączone – zaloguj się kodem', 409);
    const a = q('SELECT username FROM admins WHERE id=?').get(s.id);
    audit(a.username, ip, '2fa_on'); console.log(`[admin] ${a.username}: 2FA włączone`);
    return { adminToken: newAdminToken(s.id, ip), username: a.username };
  },
  'POST /api/admin/logout': async ({ req }) => { const t = String(req.headers['x-admin-token'] || ''); if (t) q('DELETE FROM admin_tokens WHERE token=?').run(sha(t)); return { ok: true }; },
  // wypłata czekająca na akceptację: approve=true wysyła ze skarbca, false oddaje środki na saldo gracza
  'POST /api/admin/withdraw': async ({ body, req, ip }) => {
    const adm = adminGate(req);
    const w = q("SELECT * FROM withdrawals WHERE id=? AND state='review'").get(+body.id); if (!w) throw new E('wd', 'Nie ma takiej wypłaty do akceptacji', 404);
    const ch = q("UPDATE withdrawals SET state=?, decided=?, decided_by=? WHERE id=? AND state='review'").run(body.approve ? 'sending' : 'rejected', Date.now(), adm.id, w.id);
    if (!ch.changes) throw new E('wd', 'Tę wypłatę ktoś już rozpatrzył', 409);   // dwa kliknięcia naraz nie wypłacą dwa razy
    audit(adm.username, ip, body.approve ? 'wd_approve' : 'wd_reject', `#${w.id} user=${w.user_id} $${w.usd} -> ${w.to_addr}`);
    if (!body.approve) {
      tx(() => { q('UPDATE users SET lamports=lamports+? WHERE id=?').run(w.lamports, w.user_id); q("UPDATE txs SET status='rejected', note=note||' · zwrot' WHERE id=?").run(w.tx_id); });
      return { ok: true, state: 'rejected' };
    }
    q("UPDATE txs SET status='pending' WHERE id=?").run(w.tx_id);
    const sig = await payout(w.tx_id, w.user_id, new PublicKey(w.to_addr), w.lamports);
    q('UPDATE withdrawals SET state=? WHERE id=?').run(sig ? 'sent' : 'failed', w.id);
    return { ok: !!sig, state: sig ? 'sent' : 'failed', url: sig ? explorer(sig) : '' };
  },
  'POST /api/admin/config': async ({ body, req, ip }) => {
    const adm = adminGate(req); audit(adm.username, ip, 'config', Object.keys(body || {}).join(','));
    const put = cfgPut, out = {};
    if (body.businessEmail !== undefined) {
      const m = String(body.businessEmail ?? '').trim();
      if (m && (m.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m))) throw new E('email', 'Nieprawidłowy adres e-mail');
      put('businessEmail', m); out.businessEmail = m;
    }
    if (body.authTexts !== undefined) {   // hasła w oknie logowania: { pl|en|ru|es: { tag, f1, f2, f3 } }, puste = tekst domyślny
      const clean = {};
      for (const l of ['pl', 'en', 'ru', 'es']) { const src = (body.authTexts || {})[l] || {}; const o = {};
        for (const k of ['tag', 'f1', 'f2', 'f3']) { const v = String(src[k] ?? '').trim().slice(0, 140); if (v) o[k] = v; } if (Object.keys(o).length) clean[l] = o; }
      put('authTexts', JSON.stringify(clean)); out.authTexts = clean;
    }
    return out;
  },
  'POST /api/profile': async ({ user, body }) => {
    need(user); const u = fresh(user.id);
    if (body.username != null && String(body.username).trim() !== u.username) {
      const n = String(body.username).trim();
      if (!/^[a-z0-9_]{3,16}$/i.test(n)) throw new E('user', 'Nazwa: 3–16 znaków (litery, cyfry, _)');
      if (reserved(n) && n.toLowerCase() !== u.username.toLowerCase()) throw new E('reserved', RESERVED_MSG, 409);
      const other = q('SELECT id FROM users WHERE username=?').get(n); if (other && other.id !== u.id) throw new E('exists', 'Ta nazwa jest zajęta', 409);
      q('UPDATE users SET username=? WHERE id=?').run(n, u.id);
    }
    if (body.email != null) {
      const m = String(body.email).trim().toLowerCase();
      if (m && (m.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m))) throw new E('email', 'Nieprawidłowy adres e-mail');
      // zmiana istniejącego e-maila wstrzymuje wypłaty na SECURITY_HOLD_HOURS (pierwsze dopisanie e-maila nie)
      if (m !== (u.email || '')) q('UPDATE users SET email=?, sec_changed=CASE WHEN ? THEN ? ELSE sec_changed END WHERE id=?').run(m || null, u.email ? 1 : 0, Date.now(), u.id);
    }
    if (body.avatar != null) {
      const a = String(body.avatar);
      if (a && !(/^preset:[a-z0-9-]{1,24}$/.test(a) || (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(a) && a.length <= 90000))) throw new E('avatar', 'Nieprawidłowy obrazek (PNG/JPG do ~60 KB)');
      q('UPDATE users SET avatar=? WHERE id=?').run(a || null, u.id);
    }
    return { account: publicUser(fresh(u.id)), history: histOf(u.id) };
  },
  'POST /api/password': async ({ user, body, ip }) => {
    need(user); if (limited('pw:' + ip, 8)) throw new E('rate', 'Za dużo prób – odczekaj minutę', 429);
    const u = fresh(user.id), np = String(body.newPassword || '');
    if (!(await checkPass(String(body.oldPassword || ''), u.pass))) throw new E('oldpass', 'Obecne hasło jest nieprawidłowe', 400);
    if (np.length < OCH.PASS_MIN || np.length > 128) throw new E('pass', NEWPASS_MSG);
    q('UPDATE users SET pass=?, sec_changed=? WHERE id=?').run(await hashPass(np), Date.now(), u.id);
    const m = /^Bearer (.+)$/.exec(user._auth || ''); q('DELETE FROM sessions WHERE user_id=? AND token!=?').run(u.id, m ? sha(m[1]) : '');   // wyloguj inne urządzenia
    return { ok: true };
  },
  'POST /api/stats': async ({ user, body }) => {
    need(user); const u = fresh(user.id), st = JSON.parse(u.stats || '{}');
    for (const k of STAT_KEYS) { const v = Math.floor(+body[k] || 0); if (v > 0 && v < 10000) st[k] = (st[k] || 0) + v; }
    q('UPDATE users SET stats=?, last_active=? WHERE id=?').run(JSON.stringify(st), Date.now(), u.id); return { ok: true };
  },
  // mecze do sprawdzenia: wstrzymane wypłaty i mecze z ryzykiem od 30% (all=1: wszystkie z ostatnich)
  'GET /api/admin/review': async ({ req }) => {
    const adm = adminGate(req);
    const all = new URL(req.url, 'http://x').searchParams.get('all') === '1';
    const keys = q(`SELECT room, MAX(COALESCE(ended,t)) te FROM matches WHERE room IS NOT NULL ${all ? '' : "AND (review IS NOT NULL OR risk>=0.3)"} GROUP BY room ORDER BY te DESC LIMIT 300`).all();
    const rooms = keys.map(({ room }) => {
      const rows = q('SELECT m.*, u.username, u.banned, u.ban_reason, u.suspicion FROM matches m JOIN users u ON u.id=m.user_id WHERE m.room=? ORDER BY m.id').all(room);
      const r0 = rows[0] || {};
      return { room, t: r0.ended || r0.t, map: r0.map, stake: r0.stake_usd, score: r0.score, replay: !!r0.replay, review: rows.map(r => r.review).find(Boolean) || null,
        hold: rows.map(r => r.hold).find(Boolean) || null,
        players: rows.map(r => ({ uid: r.user_id, name: r.username, state: r.state, won: r.state === 'won' || r.state === 'held', risk: r.risk, flags: JSON.parse(r.flags || '[]'),
          payout: Math.round(r.payout_lamports / 1e9 * r.price * 100) / 100, banned: !!r.banned, banReason: r.ban_reason || '', suspicion: r.suspicion || 0,
          matches: playedMatches(r.user_id), linked: linkedAccounts(r.user_id) })) };
    });
    return { rooms, held: q("SELECT COUNT(*) n FROM matches WHERE state='held'").get().n, holdRisk: ANTY.HOLD_RISK, reviewStake: REVIEW_STAKE_USD };
  },
  // powtórka meczu (ruch obu graczy, strzały, rundy) + bryły mapy do rysowania
  'GET /api/admin/replay': async ({ req }) => {
    const adm = adminGate(req);
    const room = String(new URL(req.url, 'http://x').searchParams.get('room') || '');
    const r = q('SELECT replay FROM matches WHERE room=? AND replay IS NOT NULL LIMIT 1').get(room);
    if (!r || !/^[a-z0-9]+-\d+\.json\.gz$/.test(r.replay)) throw new E('replay', 'Brak powtórki tego meczu', 404);
    let rep; try { rep = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(REPLAY_DIR, r.replay))).toString('utf8')); } catch { throw new E('replay', 'Brak powtórki tego meczu', 404); }
    return { ...rep, boxes: MECZ.mapBoxes(rep.map) };
  },
  // decyzja o wstrzymanej wygranej: approve = wypłata zwycięzcy; reject = wygrana przechodzi na przeciwnika (+ blokada oszusta)
  'POST /api/admin/decide': async ({ body, req, ip }) => {
    const adm = adminGate(req);
    const room = String(body.room || ''), ok = body.decision === 'approve';
    if (!['approve', 'reject'].includes(body.decision)) throw new E('decision', 'Decyzja: approve albo reject');
    const out = tx(() => {
      const h = q("SELECT * FROM matches WHERE room=? AND state='held'").get(room); if (!h) throw new E('state', 'Ten mecz nie czeka na decyzję', 409);
      const pendingTx = q("SELECT id FROM txs WHERE user_id=? AND type='win' AND status='pending' AND lamports=? ORDER BY id DESC LIMIT 1").get(h.user_id, h.payout_lamports);
      if (ok) {
        q("UPDATE matches SET state='won', review='approved' WHERE id=?").run(h.id);
        q('UPDATE users SET lamports=lamports+? WHERE id=?').run(h.payout_lamports, h.user_id);
        if (pendingTx) q("UPDATE txs SET status='ok', t=? WHERE id=?").run(Date.now(), pendingTx.id);
        q("UPDATE matches SET review='approved' WHERE room=? AND id!=?").run(room, h.id);
        q('UPDATE users SET suspicion=suspicion*0.5 WHERE id=?').run(h.user_id);   // fałszywy alarm: następne wygrane rzadziej czekają
        return { approved: h.user_id };
      }
      q("UPDATE matches SET state='lost', payout_lamports=0, fee_lamports=0, review='rejected' WHERE id=?").run(h.id);
      if (pendingTx) q("UPDATE txs SET status='failed', note='odrzucona: oszukiwanie' WHERE id=?").run(pendingTx.id);
      const v = q("SELECT * FROM matches WHERE room=? AND id!=? AND state='lost'").get(room, h.id);
      if (v) {
        q("UPDATE matches SET state='won', payout_lamports=?, fee_lamports=?, review='rejected' WHERE id=?").run(h.payout_lamports, h.fee_lamports, v.id);
        q('UPDATE users SET lamports=lamports+? WHERE id=?').run(h.payout_lamports, v.user_id);
        addTx(v.user_id, 'win', h.payout_lamports, Math.round(h.payout_lamports / 1e9 * v.price * 100) / 100, { fee: Math.round(h.fee_lamports / 1e9 * v.price * 100) / 100, note: 'przeciwnik oszukiwał' });
      }
      return { rejected: h.user_id, victim: v ? v.user_id : null };
    });
    if (!ok && body.ban !== false) banUser(out.rejected, String(body.reason || `oszukiwanie (mecz ${room})`));
    audit(adm.username, ip, ok ? 'match_approve' : 'match_reject', `pokój ${room} user=${out.approved || out.rejected}`);
    console.log(`[antycheat] mecz ${room}: ${ok ? 'wypłata zatwierdzona' : 'wygrana odrzucona'} przez ${adm.username}`);
    return { ok: true, ...out };
  },
  'POST /api/admin/ban': async ({ body, req, ip }) => {
    const adm = adminGate(req);
    const u = q('SELECT * FROM users WHERE username=?').get(String(body.username || '').trim()); if (!u) throw new E('user', 'Nie ma takiego konta', 404);
    banUser(u.id, String(body.reason || 'decyzja admina'), body.banned !== false);
    audit(adm.username, ip, body.banned !== false ? 'ban' : 'unban', `${u.username}: ${String(body.reason || '').slice(0, 120)}`);
    if (body.banned === false) q('UPDATE users SET suspicion=0 WHERE id=?').run(u.id);
    return { ok: true, banned: !!fresh(u.id).banned };
  },
  'GET /api/admin/overview': async ({ req }) => {
    adminGate(req);
    const accounts = q('SELECT * FROM users ORDER BY id').all().map(u => ({ id: String(u.id), ...publicUser(u), wallet: u.address, history: histOf(u.id, 40) }));
    const names = Object.fromEntries(accounts.map(a => [a.id, a.username]));
    const matches = q("SELECT * FROM matches WHERE state!='open' ORDER BY COALESCE(ended,t) DESC LIMIT 1000").all().map(m => ({ id: String(m.id), u: String(m.user_id), name: names[m.user_id],
      t: m.ended || m.t, map: m.map, stake: m.stake_usd, won: m.state === 'won', held: m.state === 'held', risk: m.risk, forfeit: !!m.forfeit,
      payout: Math.round(m.payout_lamports / 1e9 * m.price * 100) / 100, fee: Math.round(m.fee_lamports / 1e9 * m.price * 100) / 100 }));
    let tre = 0; try { tre = await conn.getBalance(TREASURY.publicKey); } catch {}
    const ledger = q('SELECT COALESCE(SUM(lamports),0) s FROM users').get().s;
    return { accounts, matches, price: PRICE, cluster: CLUSTER, treasury: { address: TREASURY.publicKey.toBase58(), lamports: tre, usd: toUsd(tre) },
      ledger: { lamports: ledger, usd: toUsd(ledger) }, pendingSweep: q('SELECT COALESCE(SUM(lamports),0) s FROM deposits WHERE swept=0').get().s,
      // wypłaty do akceptacji i dziennik admina (logowania, 2FA, zmiany ustawień, decyzje o wypłatach)
      withdrawals: q("SELECT w.*, u.username FROM withdrawals w JOIN users u ON u.id=w.user_id WHERE w.state='review' ORDER BY w.t").all()
        .map(w => ({ id: w.id, name: w.username, u: String(w.user_id), to: w.to_addr, usd: w.usd, sol: w.lamports / LAMPORTS_PER_SOL, t: w.t })),
      audit: q('SELECT a.t, a.ip, a.action, a.detail, COALESCE(a.who, u.username) username FROM audit a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 50').all(),
      limits: { dailyUsd: WD_DAILY_USD, reviewUsd: WD_REVIEW_USD } };
  },
  // ---- Deathmatch ----
  // lobby gry: zasady i ilu graczy jest teraz w stałym lobby Deathmatch (komplet = full)
  'GET /api/dm/info': async () => { const n = dmCount(); return { ...DM.publicConfig(dmCfg), players: n, full: dmHumans() >= dmCfg.maxPlayers, queues: { [dmCfg.tiers[0].id]: n }, live: dmRooms.size, xshare: xsCfg.enabled }; },
  // panel admina: wszystkie ustawienia trybu, kolejki, trwające mecze i ostatnie wyniki
  'GET /api/admin/dm': async ({ req }) => {
    adminGate(req);
    const recent = q(`SELECT room, MAX(COALESCE(ended,t)) te, MAX(map) map, MAX(tier) tier, MAX(players) players, SUM(lamports) pot, SUM(payout_lamports) paid, MAX(price) price FROM dm_entries
      WHERE room IS NOT NULL AND state IN ('won','lost','left','played') GROUP BY room ORDER BY te DESC LIMIT 40`).all().map((r) => {
      const top = q('SELECT e.place, e.kills, e.damage, e.payout_lamports, e.price, u.username FROM dm_entries e JOIN users u ON u.id=e.user_id WHERE e.room=? AND e.place BETWEEN 1 AND 3 ORDER BY e.place').all(r.room);
      return { room: r.room, t: r.te, map: r.map, tier: r.tier, players: r.players, pot: Math.round(r.pot / 1e9 * r.price * 100) / 100, paid: Math.round(r.paid / 1e9 * r.price * 100) / 100,
        top: top.map((x) => ({ place: x.place, name: x.username, kills: x.kills, damage: x.damage, prize: Math.round(x.payout_lamports / 1e9 * x.price * 100) / 100 })) };
    });
    return { config: dmCfg, defaults: DM.sanitizeConfig({}), queues: [],
      rooms: [...dmRooms].map((r) => ({ id: r.id, tier: r.tier.id, map: r.game.mapName, phase: r.game.phase, players: DM.playerCount(r.game), bots: r.bots.size, left: 0 })), recent };
  },
  'POST /api/admin/dm': async ({ body, req, ip }) => {
    const adm = adminGate(req);
    const next = DM.sanitizeConfig(body && body.reset ? {} : (body.config || {}));
    cfgPut('dm', JSON.stringify(next)); dmCfg = next;
    audit(adm.username, ip, 'dm_config', body && body.reset ? 'reset' : Object.keys(body.config || {}).join(','));
    return { config: dmCfg };
  },
  // ---- napis „N players online” na górze lobby (bez logowania) ----
  'GET /api/online': async () => ({ enabled: onlineCfg.enabled, count: onlineCfg.count, text: onlineCfg.text }),
  'GET /api/admin/online': async ({ req }) => { adminGate(req); return { config: onlineCfg, defaults: onlineSanitize({}) }; },
  'POST /api/admin/online': async ({ body, req, ip }) => {
    const adm = adminGate(req);
    const next = onlineSanitize(body && body.reset ? {} : (body.config || {}));
    cfgPut('online', JSON.stringify(next)); onlineCfg = next;
    audit(adm.username, ip, 'online_config', `${next.enabled ? 'wł.' : 'wył.'} ${next.count}`);
    return { config: onlineCfg };
  },
  // ---- Udostępnienie na X (wejście do Deathmatch) ----
  // lobby: kod gracza, gotowy tekst posta, link do okna X i czy post jest już zweryfikowany
  'GET /api/xshare': async ({ user, req }) => { if (!user) return { enabled: xsCfg.enabled, verified: false, guest: true, profile: xsCfg.profile }; return { ...xshare.status(user.id, originOf(req)), profile: xsCfg.profile }; },
  // wklejony link do posta: serwer czyta post (oEmbed X) i sprawdza kod gracza i CA
  'POST /api/xshare/verify': async ({ user, body, req, ip }) => {
    need(user); if (limited('xs:' + user.id, 6) || limited('xsip:' + ip, 20)) throw new E('rate', 'Za dużo prób – odczekaj minutę', 429);
    return xshare.verify(user.id, body && body.url, originOf(req), E);
  },
  'GET /api/admin/xshare': async ({ req }) => { adminGate(req); return { config: xsCfg, defaults: XS.sanitize({}), stats: xshare.stats(), ca: xsCfg.ca || (arsCfg.unit === 'token' ? arsCfg.mint : ''), site: originOf(req), preview: xshare.textFor('GTA-XXXXX', originOf(req)), len: XS.xLength(xshare.textFor('GTA-XXXXX', originOf(req))) }; },
  'POST /api/admin/xshare': async ({ body, req, ip }) => {
    const adm = adminGate(req);
    const next = XS.sanitize(body && body.reset ? {} : (body.config || {}));
    if (body && body.config && String(body.config.ca || '').trim() && !next.ca) throw new E('ca', 'Nieprawidłowy adres CA (Solana)');
    if (body && body.config && String(body.config.url || '').trim() && !next.url) throw new E('url', 'Link do gry musi mieć domenę (np. https://twoja-domena.pl), nie adres IP');
    cfgPut('xshare', JSON.stringify(next)); xsCfg = next;
    audit(adm.username, ip, 'xshare_config', body && body.reset ? 'reset' : (next.enabled ? 'wł.' : 'wył.'));
    return { config: xsCfg, preview: xshare.textFor('GTA-XXXXX', originOf(req)) };
  },
  // ---- Arsenał (bronie za trzymanie tokenu) ----
  // lobby: progi broni, saldo tokenu na adresie depozytu gracza i odblokowane bronie (saldo sprawdzane najwyżej co `refresh` s)
  'GET /api/arsenal': async ({ user }) => {
    if (!user) return { ...ARS.publicConfig(arsCfg), address: '', balance: 0, unlocked: [ARS.BASE], checkedAt: 0, guest: true, price: PRICE };   // bez logowania: same progi
    const u = fresh(user.id);
    if (ARS.active(arsCfg) && !arsenal.isFresh(u.id, arsCfg.refresh * 1000)) await arsenal.refresh(u);
    return { ...arsenal.status(u), price: PRICE };
  },
  // przycisk „Sprawdź saldo” (po wpłacie tokenu): od razu, ale najwyżej co 10 s
  'POST /api/arsenal/refresh': async ({ user }) => { need(user); const u = fresh(user.id); await arsenal.refresh(u, arsenal.refreshDelay()); return { ...arsenal.status(u), price: PRICE }; },
  'GET /api/admin/arsenal': async ({ req }) => { adminGate(req); return { config: arsCfg, defaults: ARS.sanitize({}), guns: ARS.GUNS, base: ARS.BASE, rpc: env.TOKEN_RPC_URL ? 'własny (TOKEN_RPC_URL)' : 'publiczny ' + arsCfg.network }; },
  'POST /api/admin/arsenal': async ({ body, req, ip }) => {
    const adm = adminGate(req);
    const next = ARS.sanitize(body && body.reset ? {} : (body.config || {}));
    if (body && body.config && String(body.config.mint || '').trim() && !next.mint) throw new E('mint', 'Nieprawidłowy adres mintu tokenu (Solana)');
    cfgPut('arsenal', JSON.stringify(next)); arsCfg = next;
    audit(adm.username, ip, 'arsenal_config', body && body.reset ? 'reset' : `${next.enabled ? 'wł.' : 'wył.'} ${next.symbol} ${next.mint.slice(0, 6)}…`);
    return { config: arsCfg };
  },
};

// gra pod tym samym adresem co API: index.html z wpisanym adresem serwera portfeli + skins.json
const STATIC = { '/': 'index.html', '/index.html': 'index.html', '/skins.json': 'skins.json', '/kreator-skinow.html': 'zrodla/kreator-skinow.html',
  '/privacy.html': 'privacy.html', '/privacy': 'privacy.html', '/polityka-prywatnosci': 'privacy.html' };
const PUBLIC_PAGES = new Set(['/privacy.html', '/privacy', '/polityka-prywatnosci']);   // dostępne bez hasła bramki (Google sprawdza politykę prywatności)
// Pliki gry z pamięci: czytane raz (ponownie dopiero, gdy zmieni się plik po git pull), gzip i brotli liczone raz w tle (pula wątków zlib),
// więc wejście gracza na stronę nie zatrzymuje pętli serwera, która liczy mecze. Pliki w gra/ mają skrót treści w nazwie → cache na rok;
// index.html i skins.json → 'no-cache' + ETag (przeglądarka dostaje 304, gdy nic się nie zmieniło).
const GAME_TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };
const GAME_CACHE = new Map();
const zgz = (b) => new Promise((ok, no) => zlib.gzip(b, { level: 9 }, (e, r) => (e ? no(e) : ok(r))));
const zbr = (b) => new Promise((ok, no) => zlib.brotliCompress(b, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: b.length } }, (e, r) => (e ? no(e) : ok(r))));
async function gameFile(f) {
  let st; try { st = await fs.promises.stat(f); } catch { return null; }
  const c = GAME_CACHE.get(f);
  if (c && c.mtime === st.mtimeMs && c.size === st.size) return c.ready;
  const ready = (async () => {
    let b = await fs.promises.readFile(f);
    if (f.endsWith('index.html')) { const s = b.toString('utf8'), i = s.indexOf('<head>'); b = Buffer.from(i >= 0 ? s.slice(0, i + 6) + '<script>window.BEANLADEN_API=location.origin</script>' + s.slice(i + 6) : s); }
    const ext = path.extname(f).toLowerCase(), pack = /^\.(html|json|js|css|glb|svg)$/.test(ext) && b.length > 1024;
    const [gz, br] = pack ? await Promise.all([zgz(b), zbr(b)]) : [null, null];
    return { raw: b, gz, br, type: GAME_TYPES[ext] || 'application/octet-stream', etag: '"' + crypto.createHash('sha1').update(b).digest('base64url').slice(0, 22) + '"' };
  })();
  GAME_CACHE.set(f, { mtime: st.mtimeMs, size: st.size, ready });
  ready.catch(() => GAME_CACHE.delete(f));
  return ready;
}
async function serveGame(p, res, req) {
  const name = p.startsWith('/gra/') && /^\/gra\/[A-Za-z0-9._-]+$/.test(p) && !p.includes('..') ? p.slice(1) : STATIC[p];
  const e = name ? await gameFile(path.join(GAME_DIR, name)).catch(() => null) : null;
  if (!e) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Nie znaleziono'); }
  const head = { 'Content-Type': e.type, ETag: e.etag, Vary: 'Accept-Encoding', 'Cache-Control': name.startsWith('gra/') ? 'public, max-age=31536000, immutable' : 'no-cache' };
  if (req && req.headers['if-none-match'] === e.etag) { res.writeHead(304, head); return res.end(); }
  const ae = (req && req.headers['accept-encoding']) || '';
  const [body, enc] = e.br && /\bbr\b/.test(ae) ? [e.br, 'br'] : e.gz && /\bgzip\b/.test(ae) ? [e.gz, 'gzip'] : [e.raw, null];
  if (enc) head['Content-Encoding'] = enc;
  head['Content-Length'] = body.length;
  res.writeHead(200, head); res.end(body);
}
// po starcie od razu przygotuj (w tle) stronę, skiny i pliki gry, żeby pierwsi gracze nie czekali na kompresję
setTimeout(() => {
  const files = ['index.html', 'skins.json'];
  try { for (const f of fs.readdirSync(path.join(GAME_DIR, 'gra'))) files.push('gra/' + f); } catch {}
  (async () => { for (const f of files) await gameFile(path.join(GAME_DIR, f)).catch(() => {}); })();
}, 500);
// ---------------- bramka: czarny ekran z kotem i hasłem (jak na cryptostrike.pl) ----------------
// Ustawione COVER_PASSWORD = cała strona i API dopiero po wpisaniu hasła na ekranie z serwer/cover.html.
// Dobre hasło -> ciasteczko bl_cover (HttpOnly, 30 dni) podpisane kluczem z DATA_DIR/cover.key; zmiana hasła unieważnia stare wejścia.
const COVER_PW = (env.COVER_PASSWORD || '').trim();
const COVER_KEY = COVER_PW ? (() => { const f = path.join(DATA_DIR, 'cover.key'); if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(32).toString('hex'), { mode: 0o600 }); return fs.readFileSync(f, 'utf8').trim(); })() : '';
const coverToken = () => crypto.createHmac('sha256', COVER_KEY).update('ok|' + COVER_PW).digest('base64url');
function coverOk(req) {
  if (!COVER_PW) return true;
  const m = /(?:^|;\s*)bl_cover=([\w-]+)/.exec(req.headers.cookie || ''); if (!m) return false;
  const a = Buffer.from(m[1]), b = Buffer.from(coverToken()); return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const coverTries = new Map();                                   // ip -> czasy prób (najwyżej 10 na minutę)
async function coverLogin(req, res) {
  const ip = OCH.clientIp(req), now = Date.now();
  const t = (coverTries.get(ip) || []).filter(x => now - x < 60000); t.push(now); coverTries.set(ip, t);
  if (coverTries.size > 5000) coverTries.clear();
  if (t.length > 10) { res.writeHead(429, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end('Za dużo prób'); }
  let body = {}; try { body = await readBody(req); } catch {}
  const a = crypto.createHash('sha256').update(String(body.p || '')).digest(), b = crypto.createHash('sha256').update(COVER_PW).digest();
  if (!crypto.timingSafeEqual(a, b)) { res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end('nope'); }
  const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  res.writeHead(204, { 'Set-Cookie': `bl_cover=${coverToken()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${secure}`, 'Cache-Control': 'no-store' }); res.end();
}
function serveCover(res) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
  res.end(fs.readFileSync(new URL('./cover.html', import.meta.url)));
}
// ---------------- 1v1 z prawdziwymi graczami: kolejka, pokoje meczowe, przekazywanie ruchu (WebSocket /ws) ----------------
// Gracz płaci stawkę (/api/match/start), bierze bilet (POST /api/ws-ticket), łączy się z /ws?k=BILET i wysyła {t:'queue', matchId}. Serwer paruje dwóch różnych
// graczy z tą samą stawką, losuje mapę, a potem przekazuje między nimi stan (ruch, strzały, trafienia). Rundy liczy serwer
// (z meldunków 'dead' gracza, który zginął) i to on rozlicza stawki obu graczy po meczu. Wyjście z kolejki = zwrot stawki,
// zerwanie połączenia w trakcie meczu = wygrana przeciwnika.
const DUEL_MAPS = ['Oaza', 'Magazyn', 'Baza'];
await MECZ.loadMaps(GAME_DIR, DUEL_MAPS);                       // kolizje map z plików gry (zrodla/*-data.js): serwer sam liczy ruch i strzały
for (const n of DM.DEFAULTS.maps) if (!DUEL_MAPS.includes(n)) { try { await MECZ.loadMaps(GAME_DIR, [n]); } catch (e) { console.warn(`[dm] mapa ${n} niedostępna:`, e.message); } }   // mapy tylko do Deathmatch
const dmMapsReady = (list) => { const ok = list.filter((n) => MECZ.mapByName(n)); return ok.length ? ok : DUEL_MAPS; };
const rooms = new Set();
// czy opłacony mecz właśnie czeka w kolejce albo trwa (wtedy rozlicza go wyłącznie serwer meczu)
const duelActive = matchId => mmQueue.some(x => x.matchId === matchId) || [...rooms].some(r => !r.over && r.p.some(p => p.matchId === matchId));
const nowS = () => performance.now() / 1000;
const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
const mmQueue = [];                                             // czekający: {ws, user, matchId, stake, nick, skin}
let roomSeq = 0;
const wsSend = (ws, o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

// anulowane szukanie: stawka wraca, a mecz i pobranie stawki znikają z historii (jakby gry nie było)
function refundMatch(matchId, userId) {
  try {
    tx(() => {
      const m = q("SELECT * FROM matches WHERE id=? AND user_id=? AND state='open'").get(matchId, userId); if (!m) return;
      refundOpen(m, 'anulowane szukanie');
    });
  } catch (e) { console.error('[1v1] zwrot stawki', e); }
}
// zwrot opłaconej, nierozegranej stawki 1v1 – wołać WEWNĄTRZ transakcji (tx). Mecz i pobranie stawki znikają z historii, saldo wraca.
function refundOpen(m, why) {
  q('DELETE FROM matches WHERE id=?').run(m.id);
  const st = q("SELECT id FROM txs WHERE user_id=? AND type='stake' AND lamports=? AND t BETWEEN ? AND ? ORDER BY t DESC, id DESC LIMIT 1").get(m.user_id, -m.stake_lamports, m.t - 5000, m.t + 5000);
  if (st) q('DELETE FROM txs WHERE id=?').run(st.id);
  q('UPDATE users SET lamports=lamports+? WHERE id=?').run(m.stake_lamports, m.user_id);
  console.log(`[1v1] zwrot stawki ${m.stake_usd} USD dla użytkownika ${m.user_id} (${why})`);
}
// Po restarcie albo awarii serwera w pamięci nie ma kolejek ani pokoi, więc każda otwarta stawka 1v1 i każde wpisowe Deathmatch
// w kolejce / w trakcie meczu jest osierocone: wraca do gracza (mecz nie został rozstrzygnięty). Wołane raz, przed startem serwera.
function refundOrphans() {
  try {
    const n = tx(() => {
      const ms = q("SELECT * FROM matches WHERE state='open'").all();
      for (const m of ms) refundOpen(m, 'restart serwera');
      const es = q("SELECT * FROM dm_entries WHERE state IN ('queued','playing')").all();
      for (const e of es) {
        q("UPDATE dm_entries SET state='refunded', ended=? WHERE id=?").run(Date.now(), e.id);
        if (e.lamports > 0) {
          q('UPDATE users SET lamports=lamports+? WHERE id=?').run(e.lamports, e.user_id);
          const st = q("SELECT id FROM txs WHERE user_id=? AND type='stake' AND lamports=? AND t BETWEEN ? AND ? ORDER BY t DESC, id DESC LIMIT 1").get(e.user_id, -e.lamports, e.t - 5000, e.t + 5000);
          if (st) q('DELETE FROM txs WHERE id=?').run(st.id);
        }
      }
      return [ms.length, es.length];
    });
    if (n[0] || n[1]) console.log(`[restart] zwrócono ${n[0]} stawek 1v1 i ${n[1]} wpisowych Deathmatch z przerwanych meczów`);
  } catch (e) { console.error('[restart] zwrot osieroconych stawek', e); }
}
// rozliczenie jednego gracza po meczu (decyduje serwer). x: przeciwnik, pokój, ryzyko, sygnały, powtórka, wynik, powód wstrzymania wypłaty
function settleDuel(matchId, userId, won, forfeit, map, x = {}) {
  try {
    tx(() => {
      const m = q("SELECT * FROM matches WHERE id=? AND user_id=? AND state='open'").get(matchId, userId); if (!m) return;
      const meta = [x.opp ?? null, x.room ?? null, x.risk ?? null, x.flags ? JSON.stringify(x.flags) : null, x.replay ?? null, x.score ?? null];
      const setMeta = 'opp_id=?, room=?, risk=?, flags=?, replay=?, score=?';
      if (won) {
        const pot = m.stake_lamports * 2, fee = Math.round(pot * HOUSE_FEE), pay = pot - fee, usd = Math.round(pay / 1e9 * m.price * 100) / 100, feeUsd = Math.round(fee / 1e9 * m.price * 100) / 100;
        if (x.hold) {                                                  // wygrana czeka na admina: saldo bez zmian, w historii „w toku”
          q(`UPDATE matches SET state='held', payout_lamports=?, fee_lamports=?, ended=?, map=COALESCE(?,map), ${setMeta}, hold=?, review='held' WHERE id=?`).run(pay, fee, Date.now(), map || null, ...meta, x.hold, m.id);
          addTx(userId, 'win', pay, usd, { fee: feeUsd, note: 'weryfikacja wyniku', status: 'pending' });
        } else {
          q(`UPDATE matches SET state='won', payout_lamports=?, fee_lamports=?, ended=?, map=COALESCE(?,map), ${setMeta} WHERE id=?`).run(pay, fee, Date.now(), map || null, ...meta, m.id);
          q('UPDATE users SET lamports=lamports+? WHERE id=?').run(pay, userId);
          addTx(userId, 'win', pay, usd, { fee: feeUsd });
        }
      } else {
        q(`UPDATE matches SET state='lost', forfeit=?, ended=?, map=COALESCE(?,map), ${setMeta} WHERE id=?`).run(forfeit ? 1 : 0, Date.now(), map || null, ...meta, m.id);
        addTx(userId, 'loss', 0, 0, { note: '$' + m.stake_usd.toFixed(2) });
      }
    });
  } catch (e) { console.error('[1v1] rozliczenie', e); }
}
// po meczu: ocena ryzyka obu graczy, powód wstrzymania wypłaty zwycięzcy, powtórka na dysk
function judgeRoom(room, winner, reason) {
  const g = room.game, key = Date.now().toString(36) + '-' + room.id;
  const stats = [0, 1].map(s => MECZ.playerStats(g, s)), ev = stats.map(ANTY.assess);
  const W = room.p[winner], L = room.p[1 - winner], hold = [];
  if (ev[winner].risk >= ANTY.HOLD_RISK) hold.push(`ryzyko oszustwa ${Math.round(ev[winner].risk * 100)}%`);
  const wu = fresh(W.user.id) || {};
  if ((wu.suspicion || 0) >= ANTY.FLAG_SUSP) hold.push(`konto pod obserwacją (${Math.round(wu.suspicion * 100)}%)`);
  if (wu.banned) hold.push('konto zablokowane');
  const pairN = q('SELECT COUNT(*) n FROM matches WHERE user_id=? AND opp_id=? AND t>?').get(W.user.id, L.user.id, Date.now() - 864e5).n;
  if (pairN >= 3) hold.push(`${pairN + 1}. mecz tej samej pary w 24 h`);
  if (reason === 'left' && g.score[0] + g.score[1] === 0 && pairN >= 1) hold.push('walkower bez gry z tym samym przeciwnikiem');
  const link = linkOf(W.user.id, L.user.id); if (link) hold.push(`konta powiązane (${link.kind === 'dev' ? 'urządzenie' : link.kind === 'wd' ? 'adres wypłat' : 'IP'})`);
  if (W.stake >= REVIEW_STAKE_USD) hold.push(`stawka od $${REVIEW_STAKE_USD}`);
  let replay = key + '.json.gz';
  try {
    fs.writeFileSync(path.join(REPLAY_DIR, replay), zlib.gzipSync(JSON.stringify({ v: 1, key, t: Date.now(), map: room.map, stake: W.stake, reason, winner, score: g.score,
      players: room.p.map((p, s) => ({ uid: p.user.id, nick: p.nick, risk: ev[s].risk, flags: ev[s].flags, summary: ev[s].summary })), stats: stats.map(st => ({ ...st, rtts: undefined })), rec: g.rec })));
  } catch (e) { console.error('[powtórka]', e.message); replay = null; }
  return { key, ev, hold, replay };
}

function leaveQueue(ws, refund) {
  const i = mmQueue.findIndex(x => x.ws === ws); if (i < 0) return false;
  const me = mmQueue.splice(i, 1)[0]; ws.mm = null;
  if (refund) refundMatch(me.matchId, me.user.id);
  return true;
}
function startRoom(a, b) {
  const map = DUEL_MAPS[Math.floor(Math.random() * DUEL_MAPS.length)];
  const room = { id: ++roomSeq, p: [a, b], score: [0, 0], map, ready: [false, false], over: false, game: MECZ.createRoom(map, nowS()) };
  room.out = (seat, m) => { if (seat < 0) room.p.forEach((pl) => wsSend(pl.ws, m)); else wsSend(room.p[seat].ws, m); };
  rooms.add(room);
  [a, b].forEach((pl, seat) => { pl.room = room; pl.seat = seat; pl.ws.mm = pl; });
  // Arsenał: pistolet + bronie odblokowane tokenem (serwer meczu nie przyjmie innej broni); wyłączony = bronie drużyn jak dawniej
  [a, b].forEach((pl, seat) => { pl.guns = arsenalGuns(pl.user.id, MECZ.WEAPON_IDS, pl.lam); if (pl.guns) MECZ.setGuns(room.game, seat, pl.guns); });
  for (const pl of [a, b]) try { q('UPDATE matches SET map=? WHERE id=?').run(room.map, pl.matchId); } catch {}
  [a, b].forEach((pl, seat) => { const op = room.p[1 - seat]; wsSend(pl.ws, { t: 'matched', seat, map: room.map, opp: { nick: op.nick, skin: op.skin }, ...(pl.guns ? { guns: pl.guns } : {}) }); });
  console.log(`[1v1] pokój ${room.id}: ${a.nick} vs ${b.nick}, stawka $${a.stake}, mapa ${room.map}`);
}
function endRoom(room, winner, reason) {
  if (room.over) return; room.over = true; rooms.delete(room);
  let J = null; try { J = judgeRoom(room, winner, reason); } catch (e) { console.error('[antycheat] ocena meczu', e); }
  room.p.forEach((pl, seat) => settleDuel(pl.matchId, pl.user.id, seat === winner, seat !== winner && reason === 'left', room.map, J ? {
    opp: room.p[1 - seat].user.id, room: J.key, risk: J.ev[seat].risk, flags: J.ev[seat].flags, replay: J.replay, score: room.game.score.join(':'),
    hold: seat === winner && J.hold.length ? J.hold.join('; ') : null } : {}));
  if (J) room.p.forEach((pl, seat) => { const u = fresh(pl.user.id); if (u) q('UPDATE users SET suspicion=? WHERE id=?').run(ANTY.nextSuspicion(u.suspicion, J.ev[seat]), u.id); });
  const held = !!(J && J.hold.length);
  room.p.forEach((pl, seat) => { wsSend(pl.ws, { t: 'end', winner, score: room.score, reason, ...(held && seat === winner ? { held: true } : {}) }); if (pl.ws) pl.ws.mm = null; });
  if (held) console.log(`[antycheat] pokój ${room.id}: wygrana ${room.p[winner].nick} czeka na admina – ${J.hold.join('; ')}`);
  if (J) J.ev.forEach((e, s) => { if (e.flags.length) console.log(`[antycheat] pokój ${room.id}: ${room.p[s].nick} ryzyko ${Math.round(e.risk * 100)}% –`, e.flags.map(f => f.code + ' ' + f.score).join(', ')); });
  console.log(`[1v1] pokój ${room.id}: koniec, wygrał ${room.p[winner].nick} (${room.score.join(':')}${reason === 'left' ? ', walkower' : reason === 'cheat' ? ', przeciwnik wyrzucony za oszukiwanie' : ''})`);
  if (room.game.log.length) console.log(`[1v1] pokój ${room.id}: odrzucone ruchy:`, room.game.log.slice(-20).join(' | '));
}
function onDuelMessage(ws, user, raw, arsChecked = false) {
  let m; try { m = JSON.parse(raw); } catch { return; }
  if (!m || typeof m.t !== 'string') return;
  const me = ws.mm;
  if (m.t === 'queue') {
    if (me) return;                                              // już w kolejce albo w meczu
    if ((fresh(user.id) || {}).banned) return wsSend(ws, { t: 'error', code: 'banned', message: BANNED_MSG });
    const mid = typeof m.matchId === 'number' || typeof m.matchId === 'string' ? Number(m.matchId) : NaN;
    const noMatch = () => wsSend(ws, { t: 'error', code: 'match', message: 'Brak opłaconej stawki – zagraj jeszcze raz z lobby.' });
    const match = Number.isSafeInteger(mid) ? q("SELECT * FROM matches WHERE id=? AND user_id=? AND state='open'").get(mid, user.id) : null;
    if (!match) return noMatch();
    if (!arsChecked && arsenalWait(ws, user, () => { if (!ws.mm) onDuelMessage(ws, user, raw, true); })) return;   // Arsenał: najpierw aktualne saldo tokenu
    // jedna opłacona stawka = jeden mecz: ten sam mecz nie może trwać w innym pokoju ani czekać w drugiej kolejce
    // (wcześniej druga karta dostawała zwrot stawki pierwszej, a sama grała dalej – bez stawki – albo w kilku pokojach naraz)
    if ([...rooms].some(r => !r.over && r.p.some(p => p.matchId === match.id))) return wsSend(ws, { t: 'error', code: 'dup', message: 'Ten mecz już trwa w innej karcie.' });
    for (const x of mmQueue.filter(x => x.user.id === user.id)) { leaveQueue(x.ws, x.matchId !== match.id); wsSend(x.ws, { t: 'error', code: 'dup', message: 'Szukasz meczu w innej karcie.' }); }
    if (!q("SELECT 1 FROM matches WHERE id=? AND state='open'").get(match.id)) return noMatch();   // stawka mogła właśnie wrócić
    const entry ={ ws, user, matchId: match.id, stake: match.stake_usd, lam: match.stake_lamports || 0, nick: user.username, skin: String(m.skin || '').slice(0, 64) };
    const i = mmQueue.findIndex(x => x.stake === entry.stake && x.user.id !== user.id && x.ws.readyState === 1 && !(MM_BLOCK_LINKED && linkOf(x.user.id, user.id)));
    if (i < 0) { mmQueue.push(entry); ws.mm = entry; wsSend(ws, { t: 'queued', waiting: mmQueue.filter(x => x.stake === entry.stake).length }); return; }
    startRoom(mmQueue.splice(i, 1)[0], entry); return;
  }
  if (m.t === 'cancel') { if (me && !me.room) { leaveQueue(ws, true); wsSend(ws, { t: 'cancelled' }); } return; }
  if (!me || !me.room || me.room.over) return;
  const room = me.room, op = room.p[1 - me.seat];
  if (m.t === 'ready') {
    room.ready[me.seat] = true;
    if (room.ready[0] && room.ready[1] && room.game.phase === 'wait') { MECZ.beginIntro(room.game, nowS()); room.out(-1, { t: 'go' }); }
    return;
  }
  if (m.t === 'leave') return endRoom(room, 1 - me.seat, 'left');
  // ruch, strzały, przeładowanie, start rundy, ping: wszystko liczy serwer meczu (mecz.mjs) – gracz nie zgłasza już trafień ani śmierci
  MECZ.handleMessage(room.game, me.seat, m, nowS(), room.out);
  afterGame(room);
}
// po każdej wiadomości i co 100 ms: wynik rund, koniec meczu, wyrzucenie oszusta
function afterGame(room) {
  if (room.over) return;
  const g = room.game; room.score = g.score.slice();
  const cheat = g.p.findIndex((p) => p.kicked);
  if (cheat >= 0) { room.out(cheat, { t: 'error', code: 'cheat', message: 'Mecz przerwany: serwer wykrył niedozwolony ruch.' }); return endRoom(room, 1 - cheat, 'cheat'); }
  if (g.over && !room.ending) { room.ending = true; setTimeout(() => endRoom(room, g.winner, 'score'), 1200); }
}
setInterval(() => { const t = nowS(); for (const room of rooms) { if (room.over) continue; MECZ.tick(room.game, t, room.out); afterGame(room); } }, 100);

// ---------------- ARSENAŁ: bronie za trzymanie tokenu (arsenal.mjs) ----------------
// Bez tokenu w 1v1 i Deathmatch tylko pistolet; progi i mint ustawia panel admina (klucz 'arsenal' w config).
// Wejście do kolejki ze starym saldem (> 10 min) najpierw sprawdza saldo, potem dopiero wpuszcza gracza do kolejki.
let arsCfg = (() => { try { const r = q("SELECT value FROM config WHERE key='arsenal'").get(); return ARS.sanitize(r ? JSON.parse(r.value) : {}); } catch { return ARS.sanitize({}); } })();
const arsenal = ARS.createArsenal({ getCfg: () => arsCfg, rpcUrl: (env.TOKEN_RPC_URL || '').trim(),
  solOf: (uid) => { const u = fresh(uid); return u ? u.lamports / LAMPORTS_PER_SOL : 0; } });   // tryb SOL: saldo w grze (nic się nie pobiera)
console.log(!ARS.active(arsCfg) ? '[arsenał] wyłączony – wszystkie bronie dla każdego'
  : arsCfg.unit === 'token' ? `[arsenał] włączony: token ${arsCfg.symbol} (${arsCfg.mint}), sieć ${arsCfg.network}` : '[arsenał] włączony: progi w SOL (saldo w grze)');
// true = najpierw trzeba sprawdzić saldo (wtedy `again` wywoła się po sprawdzeniu, jeśli karta jest dalej otwarta)
function arsenalWait(ws, user, again) {
  if (!ARS.active(arsCfg) || arsenal.isFresh(user.id, ARS.QUEUE_AGE)) return false;
  const u = fresh(user.id); if (!u) return false;
  arsenal.refresh(u).then(() => { if (ws.readyState === 1) again(); }).catch((e) => console.error('[arsenał] po sprawdzeniu salda:', e && e.message));
  return true;
}
// bronie gracza w meczu (null = Arsenał wyłączony); `ids` = bronie, które zna dany tryb; lam = stawka / wpisowe zamrożone na ten mecz (liczy się do salda SOL)
const arsenalGuns = (uid, ids, lam = 0) => { const g = arsenal.gunsFor(uid, (lam || 0) / LAMPORTS_PER_SOL); return g ? g.filter((id) => ids.includes(id)) : null; };

// ---------------- Udostępnienie na X (warunek wejścia do Deathmatch, xshare.mjs) ----------------
let xsCfg = (() => { try { const r = q("SELECT value FROM config WHERE key='xshare'").get(); return XS.sanitize(r ? JSON.parse(r.value) : {}); } catch { return XS.sanitize({}); } })();
const xshare = XS.createXShare({ db, getCfg: () => xsCfg, getCa: () => (arsCfg.unit === 'token' ? arsCfg.mint : ''), randomBytes: (n) => crypto.randomBytes(n) });
// adres gry do tekstu posta, gdy admin nie wpisał własnego – zawsze domena (DNS), nigdy goły adres IP ani localhost:
// PUBLIC_URL z .env → pierwsza domena z CORS_ORIGINS → domena, pod którą przyszło żądanie (za nginx: X-Forwarded-Host/Proto)
const isDomainHost = (host) => /^(?=.*[a-z])[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?$/i.test(host) && !/^\d+(\.\d+){3}(:\d+)?$/.test(host) && !/^localhost(:|$)/i.test(host);
const domainUrl = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) && isDomainHost(x.host) ? x.origin : ''; } catch { return ''; } };
const PUBLIC_URL = domainUrl((env.PUBLIC_URL || '').trim()) || ORIGINS.map(domainUrl).find(Boolean) || '';
const originOf = (req) => {
  if (PUBLIC_URL) return PUBLIC_URL;
  const h = req && req.headers || {}, host = String(h['x-forwarded-host'] || h.host || '').split(',')[0].trim();
  if (!isDomainHost(host)) return '';
  const pr = String(h['x-forwarded-proto'] || '').split(',')[0].trim() || 'https'; return pr + '://' + host;
};
// Deathmatch: bez zweryfikowanego posta nie ma wejścia; co recheckHours post sprawdzany ponownie (w tle, potem ponowna próba wejścia)
function xshareWait(ws, user, again) {
  if (!xsCfg.enabled) return false;
  if (!xshare.isVerified(user.id)) { wsSend(ws, { t: 'error', code: 'xshare', message: 'Żeby zagrać w Deathmatch, udostępnij grę na X.' }); return true; }
  if (!xshare.needsRecheck(user.id)) return false;
  xshare.recheck(user.id).then((ok) => { if (ws.readyState !== 1) return; if (ok) again(); else wsSend(ws, { t: 'error', code: 'xshare', message: 'Twój post o grze zniknął z X – udostępnij grę jeszcze raz.' }); })
    .catch((e) => { console.error('[xshare] sprawdzenie:', e && e.message); if (ws.readyState === 1) again(); });
  return true;
}

// ---------------- DEATHMATCH: jedno stałe, zawsze otwarte lobby (za darmo, do maxPlayers = 20 graczy) ----------------
// Gracz łączy się z /ws i wysyła {t:'dmq', skin}. Jeśli w lobby jest wolne miejsce, od razu do niego wchodzi (odradza się w trwającej grze),
// a jeśli jest komplet, dostaje błąd 'full'. Lobby nie ma końca: gracze wchodzą i wychodzą (Esc na ekranie śmierci, zamknięta karta).
// Pokój powstaje przy pierwszym graczu (losowa mapa) i znika, gdy wyjdzie ostatni. Bez wpisowego i nagród – statystyki konta zapisują się przy wyjściu.
let dmCfg = (() => { try { const r = q("SELECT value FROM config WHERE key='dm'").get(); return DM.sanitizeConfig(r ? JSON.parse(r.value) : {}); } catch { return DM.sanitizeConfig({}); } })();
const dmRooms = new Set();                                      // najwyżej jedno lobby (Set zostaje dla panelu admina)
const dmUsers = new Map();                                      // user.id -> wpis gracza w lobby: jedno lobby na konto
let dmSeq = 0;
const inDuel = (uid) => mmQueue.some((x) => x.user.id === uid) || [...rooms].some((r) => !r.over && r.p.some((p) => p.user.id === uid));
const dmLobby = () => [...dmRooms][0] || null;
const dmCount = () => { const r = dmLobby(); return r ? DM.playerCount(r.game) : 0; };          // razem z botami (tyle widać w lobby)
const dmHumans = () => { const r = dmLobby(); return r ? r.entries.size : 0; };                 // tylko prawdziwi gracze
function dmOpenLobby() {
  const maps = dmMapsReady(dmCfg.maps), map = maps[Math.floor(Math.random() * maps.length)];
  const key = Date.now().toString(36) + '-d' + (++dmSeq);
  const room = { id: dmSeq, key, tier: dmCfg.tiers[0], entries: new Map(), bots: new Map(), botT: 0, game: DM.createRoom(dmCfg, map, nowS()) };
  room.out = (pid, msg) => {
    if (pid < 0) { const s = JSON.stringify(msg); for (const e of room.entries.values()) if (e.ws.readyState === 1) e.ws.send(s); for (const b of room.bots.values()) BOTY.botMessage(b, msg, nowS(), room.game.cfg); return; }
    const e = room.entries.get(pid); if (e) return wsSend(e.ws, msg);
    const b = room.bots.get(pid); if (b) BOTY.botMessage(b, msg, nowS(), room.game.cfg);
  };
  dmRooms.add(room);
  console.log(`[dm] lobby ${key}: otwarte, mapa ${map}`);
  return room;
}
function dmJoin(ws, user, m, arsChecked = false, xsChecked = false) {
  if (ws.dm || ws.mm) return wsSend(ws, { t: 'error', code: 'dup', message: 'Już szukasz meczu albo grasz.' });
  const u = fresh(user.id) || {};
  if (u.banned) return wsSend(ws, { t: 'error', code: 'banned', message: BANNED_MSG });
  if (inDuel(user.id)) return wsSend(ws, { t: 'error', code: 'dup', message: 'Grasz już mecz 1v1.' });
  if (!xsChecked && xshareWait(ws, user, () => { if (!ws.dm && !ws.mm) dmJoin(ws, user, m, arsChecked, true); })) return;   // udostępnienie na X
  if (!arsChecked && arsenalWait(ws, user, () => { if (!ws.dm && !ws.mm) dmJoin(ws, user, m, true, true); })) return;   // Ekwipunek: najpierw aktualne saldo
  const old = dmUsers.get(user.id);
  if (old) { wsSend(old.ws, { t: 'error', code: 'dup', message: 'Wszedłeś do Deathmatch w innej karcie.' }); dmPlayerGone(old, 'nowa karta'); }
  if (dmHumans() >= dmCfg.maxPlayers) return wsSend(ws, { t: 'error', code: 'full', message: `Lobby Deathmatch jest pełne (${dmCfg.maxPlayers}/${dmCfg.maxPlayers}). Spróbuj za chwilę.` });
  let room = dmLobby();
  if (!room) { try { room = dmOpenLobby(); } catch (er) { console.error('[dm] lobby', er); return wsSend(ws, { t: 'error', code: 'start', message: 'Nie udało się otworzyć lobby Deathmatch.' }); } }
  if (DM.playerCount(room.game) >= dmCfg.maxPlayers) dmBotRemove(room);   // komplet z botami: bot ustępuje miejsca graczowi
  const e = { ws, user, nick: user.username, skin: String(m.skin || '').slice(0, 64), room, pid: 0, entryId: 0 };
  try { e.entryId = Number(q("INSERT INTO dm_entries(user_id,t,tier,entry_usd,lamports,price,state,room,map) VALUES(?,?,?,?,?,?,'playing',?,?)")
    .run(user.id, Date.now(), room.tier.id, 0, 0, 0, room.key, room.game.mapName).lastInsertRowid); } catch (er) { console.error('[dm] zapis wejścia', er); }
  const t = nowS();
  e.pid = DM.addPlayer(room.game, { uid: user.id, nick: e.nick, skin: e.skin, guns: arsenalGuns(user.id, DM.DM_GUNS) }, t, room.out);   // pozostali dostają {t:'joined'} (nowy gracz jeszcze nie jest na liście)
  room.entries.set(e.pid, e); dmUsers.set(user.id, e); ws.dm = e;
  wsSend(ws, DM.startMessage(room.game, e.pid, t));
  console.log(`[dm] lobby ${room.key}: ${e.nick} wszedł (${dmCount()}/${dmCfg.maxPlayers})`);
}
// gracz wychodzi z lobby (sam, rozłączony albo wyrzucony przez dm.mjs): wpis i statystyki konta z wyniku serwera
function dmPlayerGone(e, why, stats) {
  const room = e.room; if (!room || e.gone) return;
  e.gone = true;
  if (!stats) { DM.leave(room.game, e.pid, nowS(), room.out, why); const r = room.game.removed.findIndex((x) => x.pid === e.pid); if (r >= 0) stats = room.game.removed.splice(r, 1)[0].stats; }
  room.entries.delete(e.pid);
  if (dmUsers.get(e.user.id) === e) dmUsers.delete(e.user.id); if (e.ws.dm === e) e.ws.dm = null;
  const s = stats || {};
  try {
    tx(() => {
      if (e.entryId) q("UPDATE dm_entries SET state='played', kills=?, deaths=?, damage=?, players=?, ended=? WHERE id=?").run(s.kills || 0, s.deaths || 0, s.damage || 0, room.game.nextPid, Date.now(), e.entryId);
      const u = fresh(e.user.id); if (u) { const st = JSON.parse(u.stats || '{}');
        for (const [k, v] of [['shots', s.shots], ['hits', s.hits], ['heads', s.heads], ['kills', s.kills], ['deaths', s.deaths]]) if (v > 0) st[k] = (st[k] || 0) + v;
        q('UPDATE users SET stats=?, last_active=? WHERE id=?').run(JSON.stringify(st), Date.now(), u.id); }
    });
  } catch (er) { console.error('[dm] zapis wyjścia', er); }
  console.log(`[dm] lobby ${room.key}: ${e.nick} wyszedł (${why}) – zostało ${DM.playerCount(room.game)}`);
  if (!room.entries.size) {                                    // bez prawdziwych graczy lobby się zamyka (boty nie grają same dla siebie)
    for (const pid of [...room.bots.keys()]) dmBotRemove(room, pid);
    dmRooms.delete(room); console.log(`[dm] lobby ${room.key}: puste – zamknięte`);
  }
}
// boty: dodanie jednego do lobby / usunięcie (domyślnie martwego albo ostatnio dodanego)
function dmBotAdd(room, t) {
  const taken = new Set([...room.game.p.values()].map((p) => String(p.nick).toLowerCase()));
  const pid = DM.addPlayer(room.game, { uid: 0, nick: BOTY.botNick(taken), skin: BOTY.botSkin(), bot: true }, t, room.out);
  room.bots.set(pid, BOTY.createBot(pid, dmCfg.botSkill));
}
function dmBotRemove(room, pid) {
  if (!pid) { const ids = [...room.bots.keys()]; pid = ids.find((id) => { const p = room.game.p.get(id); return p && p.dead; }) || ids[ids.length - 1]; }
  if (!pid || !room.bots.has(pid)) return;
  room.bots.delete(pid); DM.leave(room.game, pid, nowS(), room.out, 'bot');
}
// ilu botów chcemy: dmCfg.bots (stała liczba), zawsze z miejscem dla graczy; bez graczy – zero
function dmBalanceBots(room, t) {
  const humans = room.entries.size, want = humans ? Math.max(0, Math.min(dmCfg.bots, dmCfg.maxPlayers - humans)) : 0;
  if (room.bots.size === want || t - room.botT < (room.bots.size < want ? 1.2 + Math.random() * 1.5 : 0.6)) return;   // boty wchodzą po jednym, jak gracze
  room.botT = t;
  if (room.bots.size < want && DM.playerCount(room.game) < dmCfg.maxPlayers) dmBotAdd(room, t); else if (room.bots.size > want) dmBotRemove(room);
}
function onDmMessage(ws, user, m) {
  if (m.t === 'dmq') return dmJoin(ws, user, m);
  const e = ws.dm; if (!e || e.gone) return;
  if (m.t === 'leave' || m.t === 'dmc') { dmPlayerGone(e, 'wyjście'); return; }
  DM.handleMessage(e.room.game, e.pid, m, nowS(), e.room.out);
}
setInterval(() => {
  const t = nowS();
  for (const room of dmRooms) {
    for (const b of room.bots.values()) { try { BOTY.botStep(room.game, b, t, 0.05, (m) => DM.handleMessage(room.game, b.pid, m, t, room.out)); } catch (er) { console.error('[dm] bot', er && er.message); } }
    DM.tick(room.game, t, room.out);
    // wyrzuceni przez serwer trybu (antycheat, za długo na ekranie śmierci)
    for (const r of room.game.removed.splice(0)) { const e = room.entries.get(r.pid); if (e) dmPlayerGone(e, r.why, r.stats); else room.bots.delete(r.pid); }
    if (dmRooms.has(room)) dmBalanceBots(room, t);
  }
}, 50);

wss.on('connection', (ws, req, user) => {
  ws.alive = true; ws.on('pong', () => { ws.alive = true; });
  try { noteSeen(user.id, 'ip', OCH.clientIp(req)); noteSeen(user.id, 'dev', cleanDev(new URL(req.url, 'http://x').searchParams.get('d'))); } catch {}
  ws.on('message', d => {
    try {                                                         // uszkodzona wiadomość jednego gracza nie może wyłączyć serwera
      const raw = String(d); let m; try { m = JSON.parse(raw); } catch { return; }
      if (!m || typeof m.t !== 'string') return;
      if (ws.dm || m.t === 'dmq' || m.t === 'dmc') return onDmMessage(ws, user, m);
      if (m.t === 'queue' && dmUsers.has(user.id)) return wsSend(ws, { t: 'error', code: 'dup', message: 'Jesteś w kolejce Deathmatch albo w meczu.' });
      onDuelMessage(ws, user, raw);
    } catch (e) { console.error(`[ws] wiadomość od ${user.id} odrzucona:`, e && e.message); }
  });
  ws.on('close', () => {
    const e = ws.dm; if (e) dmPlayerGone(e, 'rozłączony');
    const me = ws.mm; if (!me) return;
    if (!me.room) leaveQueue(ws, true);                           // zamknięta karta w trakcie szukania: zwrot stawki
    else if (!me.room.over) endRoom(me.room, 1 - me.seat, 'left');   // wyjście z meczu: wygrywa przeciwnik
  });
  wsSend(ws, { t: 'hello', nick: user.username });
});
setInterval(() => { for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; try { ws.ping(); } catch {} } }, 20000);
function onUpgrade(req, socket, head) {
  try {
    let url; try { url = new URL(req.url, 'http://x'); } catch { socket.write('HTTP/1.1 400 Bad Request\r\n\r\n'); return socket.destroy(); }
    if (url.pathname !== '/ws' || (COVER_PW && !coverOk(req))) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); return socket.destroy(); }
    const uid = OCH.useTicket(url.searchParams.get('k'));           // jednorazowy bilet z POST /api/ws-ticket (nie token sesji)
    const user = uid ? fresh(uid) : null;
    if (!user) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); return socket.destroy(); }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req, user));
  } catch (e) { console.error('[ws] połączenie odrzucone:', e && e.message); try { socket.destroy(); } catch {} }
}
// ostatnia linia obrony: pojedynczy błąd (złe zapytanie, uszkodzona wiadomość) nie wyłącza serwera z trwającymi meczami i stawkami
process.on('unhandledRejection', (e) => console.error('[serwer] nieobsłużona obietnica:', e));
process.on('uncaughtException', (e) => console.error('[serwer] nieobsłużony wyjątek:', e));
const server = http.createServer((req, res) => handleHttp(req, res).catch((e) => {
  console.error('[http]', req.method, String(req.url).slice(0, 200), e && e.message);
  try { if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ error: 'server', message: 'Błąd serwera' })); } catch {}
}));
async function handleHttp(req, res) {
  const origin = req.headers.origin;
  if (req.method === 'OPTIONS') { res.writeHead(204, cors(origin)); return res.end(); }
  let url; try { url = new URL(req.url, 'http://x'); } catch { res.writeHead(400); return res.end(); }   // np. „GET //x:99999/” – wcześniej wyłączało serwer
  if (COVER_PW) {                                               // bramka z hasłem (lock screen)
    const p0 = url.pathname;
    if (req.method === 'POST' && p0 === '/__cover') return coverLogin(req, res);
    if (!coverOk(req) && !(req.method === 'GET' && PUBLIC_PAGES.has(p0))) {
      if (req.method === 'GET' && !p0.startsWith('/api/')) return serveCover(res);
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(origin) });
      return res.end(JSON.stringify({ error: 'locked', message: 'Strona jest zablokowana hasłem' }));
    }
  }
  const key = req.method + ' ' + url.pathname, h = routes[key];
  if (!h && req.method === 'GET' && !url.pathname.startsWith('/api/')) return serveGame(url.pathname, res, req);
  if (!h) return send(res, 404, { error: 'not_found', message: 'Nie ma takiej ścieżki' }, origin);
  try {
    const body = req.method === 'POST' ? await readBody(req) : {};
    const ip = OCH.clientIp(req), dev = cleanDev(req.headers['x-dev']);
    const user = userFromReq(req); if (user) { user._auth = req.headers.authorization; noteSeen(user.id, 'ip', ip); noteSeen(user.id, 'dev', dev); }
    send(res, 200, await h({ req, body, ip, dev, user }), origin);
  } catch (e) {
    if (!(e instanceof E)) console.error(key, e);
    send(res, e.status || 500, { error: e.code || 'server', message: e instanceof E ? e.message : 'Błąd serwera' }, origin);
  }
}
refundOrphans();                                              // stawki z meczów przerwanych restartem / awarią wracają do graczy
server.on('upgrade', onUpgrade);                              // WebSocket /ws: kolejka i mecze 1v1
server.listen(PORT, HOST, () => {
  console.log(`Portfele BEANLADEN: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}  sieć: ${CLUSTER}  skarbiec: ${TREASURY.publicKey.toBase58()}`);
});
refreshPrice(); setInterval(refreshPrice, 60000);
function cleanReplays() {                                        // stare powtórki znikają; wstrzymane i odrzucone mecze zostają
  try {
    const keep = new Set(q("SELECT replay FROM matches WHERE replay IS NOT NULL AND (state='held' OR review IN ('held','rejected'))").all().map(r => r.replay));
    const lim = Date.now() - REPLAY_DAYS * 864e5;
    for (const f of fs.readdirSync(REPLAY_DIR)) { const fp = path.join(REPLAY_DIR, f); if (!keep.has(f) && fs.statSync(fp).mtimeMs < lim) fs.unlinkSync(fp); }
  } catch (e) { console.warn('[powtórki]', e.message); }
}
setInterval(cleanReplays, 6 * 3600e3); setTimeout(cleanReplays, 60e3);
setInterval(scanAll, SCAN_MS); setTimeout(scanAll, 3000);
