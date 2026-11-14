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
import { DatabaseSync } from 'node:sqlite';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, sendAndConfirmTransaction, clusterApiUrl } from '@solana/web3.js';
import { derivePath } from 'ed25519-hd-key';
import * as bip39 from 'bip39';
import { WebSocketServer } from 'ws';
import * as MECZ from './mecz.mjs';

// ---------------- konfiguracja ----------------
const env = process.env;
const PORT = +(env.PORT || 8787);
const CLUSTER = env.SOLANA_CLUSTER || 'devnet';                       // devnet | testnet | mainnet-beta
const RPC_URL = env.SOLANA_RPC_URL || clusterApiUrl(CLUSTER);
const DATA_DIR = path.resolve(env.DATA_DIR || path.join(path.dirname(new URL(import.meta.url).pathname), 'dane'));
const ADMIN_USERS = new Set((env.ADMIN_USERS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
const ORIGINS = (env.CORS_ORIGINS || '*').split(',').map(s => s.trim()).filter(Boolean);
const HOUSE_FEE = +(env.HOUSE_FEE || 0.10);                             // prowizja od puli (2 × stawka)
const SCAN_MS = +(env.SCAN_MS || 15000);
const MIN_WITHDRAW_LAMPORTS = Math.round(+(env.MIN_WITHDRAW_SOL || 0.001) * LAMPORTS_PER_SOL);
const STAKE_MIN_USD = 1, STAKE_MAX_USD = 1000;
const TX_FEE = 5000;
const GOOGLE_CLIENT_ID = (env.GOOGLE_CLIENT_ID || '').trim();   // logowanie przez Google (OAuth, typ: aplikacja internetowa)
const GAME_DIR = path.resolve(env.GAME_DIR || path.join(path.dirname(new URL(import.meta.url).pathname), '..'));   // zbudowana gra (index.html) – serwer może ją podawać pod tym samym adresem                                                   // opłata sieci za prosty przelew (lamporty)
if (CLUSTER === 'mainnet-beta' && env.ALLOW_MAINNET !== 'tak') {
  console.error('Mainnet jest zablokowany: wyniki meczów liczy przeglądarka gracza (do oszukania). Zobacz README – „Przed mainnetem”.');
  process.exit(1);
}
fs.mkdirSync(DATA_DIR, { recursive: true });

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
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
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
CREATE TABLE IF NOT EXISTS config(key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
for (const c of ['email TEXT', 'avatar TEXT', 'google_sub TEXT']) { try { db.exec('ALTER TABLE users ADD COLUMN ' + c); } catch {} }   // profil: e-mail i awatar (starsze bazy)
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
const scryptP = (pw, salt) => new Promise((ok, no) => crypto.scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => e ? no(e) : ok(k)));
async function hashPass(pw) { const salt = crypto.randomBytes(16); return 'scrypt$' + salt.toString('base64') + '$' + (await scryptP(pw, salt)).toString('base64'); }
async function checkPass(pw, stored) { const [, s, h] = stored.split('$'); const k = await scryptP(pw, Buffer.from(s, 'base64')); return crypto.timingSafeEqual(k, Buffer.from(h, 'base64')); }
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
function newSession(userId) { const tok = crypto.randomBytes(32).toString('base64url'); q('INSERT INTO sessions(token,user_id,created) VALUES(?,?,?)').run(sha(tok), userId, Date.now()); return tok; }
function userFromReq(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || ''); if (!m) return null;
  return q('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?').get(sha(m[1])) || null;
}
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
    balance: toUsd(u.lamports), price: PRICE, cluster: CLUSTER, admin: ADMIN_USERS.has(u.username.toLowerCase()),
    stats: { ...Object.fromEntries(STAT_KEYS.map(k => [k, 0])), ...JSON.parse(u.stats || '{}'), ...totals(u.id), lastActive: u.last_active || u.created } };
}
const histOf = (uid, n = 60) => q('SELECT t,type,lamports,usd,fee_usd,note,sig,status FROM txs WHERE user_id=? ORDER BY t DESC, id DESC LIMIT ?').all(uid, n)
  .map(h => ({ t: h.t, type: h.type, amount: h.usd, lamports: h.lamports, fee: h.fee_usd || undefined, note: h.note, sig: h.sig || undefined, status: h.status }));
function addTx(uid, type, lamports, usd, extra = {}) {
  q('INSERT INTO txs(user_id,t,type,lamports,usd,fee_usd,note,sig,status) VALUES(?,?,?,?,?,?,?,?,?)').run(uid, Date.now(), type, lamports, usd, extra.fee || 0, extra.note || '', extra.sig || null, extra.status || 'ok');
  q('UPDATE users SET last_active=? WHERE id=?').run(Date.now(), uid);
}

// ---------------- wpłaty: wykrywanie i przeniesienie do skarbca ----------------
const isOurs = new Set();                                              // podpisy przelewów wysłanych przez serwer (przeniesienia)
async function scanUser(u) {
  const pk = new PublicKey(u.address);
  const sigs = await conn.getSignaturesForAddress(pk, { limit: 50, ...(u.last_sig ? { until: u.last_sig } : {}) });
  if (!sigs.length) return;
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
async function scanAll() {
  if (scanning) return; scanning = true;
  try { for (const u of q('SELECT * FROM users ORDER BY last_active DESC').all()) { try { await scanUser(u); } catch (e) { console.warn('[skan]', u.username, e.message); } } }
  finally { scanning = false; }
}

// ---------------- HTTP ----------------
const limits = new Map();                                              // proste ograniczenie prób logowania (IP -> [czas])
function limited(ip, max = 12, ms = 60000) { const now = Date.now(), a = (limits.get(ip) || []).filter(t => now - t < ms); a.push(now); limits.set(ip, a); return a.length > max; }
function send(res, code, obj, origin) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(origin) }); res.end(body);
}
function cors(origin) {
  const ok = ORIGINS.includes('*') ? '*' : (origin && ORIGINS.includes(origin) ? origin : ORIGINS[0]);
  return { 'Access-Control-Allow-Origin': ok, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', Vary: 'Origin' };
}
const readBody = req => new Promise((ok, no) => { let b = ''; req.on('data', c => { b += c; if (b.length > 1e5) { no(new Error('za duże')); req.destroy(); } }); req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch { no(new Error('zły JSON')); } }); });
class E extends Error { constructor(code, msg, status = 400) { super(msg); this.code = code; this.status = status; } }
const need = u => { if (!u) throw new E('auth', 'Zaloguj się', 401); return u; };
const fresh = id => q('SELECT * FROM users WHERE id=?').get(id);
const explorer = sig => `https://explorer.solana.com/tx/${sig}${CLUSTER === 'mainnet-beta' ? '' : '?cluster=' + CLUSTER}`;

const routes = {
  'GET /api/health': async () => ({ ok: true, cluster: CLUSTER, price: PRICE, treasury: TREASURY.publicKey.toBase58() }),
  'GET /api/price': async () => ({ price: PRICE, at: PRICE_AT }),
  'POST /api/register': async ({ body, ip }) => {
    if (limited(ip)) throw new E('rate', 'Za dużo prób – odczekaj minutę', 429);
    const u = String(body.username || '').trim(), p = String(body.password || '');
    if (!/^[a-z0-9_]{3,16}$/i.test(u)) throw new E('user', 'Nazwa: 3–16 znaków (litery, cyfry, _)');
    if (p.length < 6 || p.length > 128) throw new E('pass', 'Hasło: co najmniej 6 znaków');
    if (q('SELECT 1 FROM users WHERE username=?').get(u)) throw new E('exists', 'Ta nazwa jest zajęta', 409);
    const pass = await hashPass(p);
    const id = tx(() => {
      const idx = (q('SELECT MAX(idx) m FROM users').get().m || 0) + 1;
      const address = keypairAt(idx).publicKey.toBase58();
      return Number(q('INSERT INTO users(username,pass,created,idx,address,last_active) VALUES(?,?,?,?,?,?)').run(u, pass, Date.now(), idx, address, Date.now()).lastInsertRowid);
    });
    console.log('[konto]', u, fresh(id).address);
    return { token: newSession(id), account: publicUser(fresh(id)), history: [] };
  },
  'POST /api/login': async ({ body, ip }) => {
    if (limited(ip)) throw new E('rate', 'Za dużo prób – odczekaj minutę', 429);
    const u = q('SELECT * FROM users WHERE username=?').get(String(body.username || '').trim());
    if (!u || !(await checkPass(String(body.password || ''), u.pass))) throw new E('creds', 'Zła nazwa lub hasło', 401);
    q('UPDATE users SET last_active=? WHERE id=?').run(Date.now(), u.id);
    scanUser(u).catch(() => {});
    return { token: newSession(u.id), account: publicUser(fresh(u.id)), history: histOf(u.id) };
  },
  'POST /api/logout': async ({ req }) => { const m = /^Bearer (.+)$/.exec(req.headers.authorization || ''); if (m) q('DELETE FROM sessions WHERE token=?').run(sha(m[1])); return { ok: true }; },
  'GET /api/me': async ({ user }) => { need(user); return { account: publicUser(fresh(user.id)), history: histOf(user.id) }; },
  'POST /api/scan': async ({ user }) => { need(user); await scanUser(fresh(user.id)); return { account: publicUser(fresh(user.id)), history: histOf(user.id) }; },
  'GET /api/earnings': async ({ user }) => {
    need(user);
    const rows = q(`SELECT t, ended, state, stake_usd, payout_lamports, price, map FROM matches WHERE user_id=? AND state!='open' ORDER BY COALESCE(ended,t)`).all(user.id);
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
    let lam = body.lamports != null ? Math.floor(+body.lamports) : body.sol != null ? Math.floor(+body.sol * LAMPORTS_PER_SOL) : body.usd != null && PRICE ? Math.floor(+body.usd / PRICE * LAMPORTS_PER_SOL) : NaN;
    if (!(lam >= MIN_WITHDRAW_LAMPORTS)) throw new E('amount', `Minimalna wypłata: ${MIN_WITHDRAW_LAMPORTS / LAMPORTS_PER_SOL} SOL`);
    const usd = toUsd(lam);
    const txId = tx(() => {
      const u = fresh(user.id); if (u.lamports < lam) throw new E('funds', 'Za mało środków');
      q('UPDATE users SET lamports=lamports-? WHERE id=?').run(lam, u.id);
      addTx(u.id, 'withdraw', -lam, -usd, { note: to.toBase58().slice(0, 4) + '…' + to.toBase58().slice(-4), status: 'pending' });
      return Number(q('SELECT last_insert_rowid() id').get().id);
    });
    try {
      const t = new Transaction().add(SystemProgram.transfer({ fromPubkey: TREASURY.publicKey, toPubkey: to, lamports: lam }));
      const sig = await sendAndConfirmTransaction(conn, t, [TREASURY], { commitment: 'confirmed' });
      q("UPDATE txs SET status='ok', sig=? WHERE id=?").run(sig, txId);
      console.log(`[wypłata] ${user.username} ${lam / LAMPORTS_PER_SOL} SOL -> ${to.toBase58()}`);
      return { ok: true, sig, url: explorer(sig), account: publicUser(fresh(user.id)), history: histOf(user.id) };
    } catch (e) {
      tx(() => { q('UPDATE users SET lamports=lamports+? WHERE id=?').run(lam, user.id); q("UPDATE txs SET status='failed', note=note||' · zwrot' WHERE id=?").run(txId); });
      console.warn('[wypłata] nieudana', e.message);
      throw new E('send', 'Wypłata nie przeszła – środki wróciły na saldo. Spróbuj za chwilę.', 502);
    }
  },
  'POST /api/match/start': async ({ user, body }) => {
    need(user); const usd = Math.round(+body.stakeUsd * 100) / 100;
    if (!(usd >= STAKE_MIN_USD && usd <= STAKE_MAX_USD)) throw new E('stake', `Stawka od $${STAKE_MIN_USD} do $${STAKE_MAX_USD}`);
    if (!PRICE) throw new E('price', 'Brak kursu SOL – spróbuj za chwilę', 503);
    const lam = Math.round(usd / PRICE * LAMPORTS_PER_SOL), price = PRICE;
    return tx(() => {
      // poprzedni niezamknięty mecz (np. zamknięta karta) liczy się jako przegrany
      for (const m of q("SELECT * FROM matches WHERE user_id=? AND state='open'").all(user.id)) q("UPDATE matches SET state='lost', forfeit=1, ended=? WHERE id=?").run(Date.now(), m.id);
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
  'POST /api/google': async ({ body, ip }) => {
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
      let name = base; for (let i = 0; q('SELECT 1 FROM users WHERE username=?').get(name); i++) name = base + (Math.floor(Math.random() * 9000) + 1000);
      const pass = await hashPass(crypto.randomBytes(24).toString('base64'));   // hasło losowe – logowanie przez Google
      const id = tx(() => {
        const idx = (q('SELECT MAX(idx) m FROM users').get().m || 0) + 1, address = keypairAt(idx).publicKey.toBase58();
        return Number(q('INSERT INTO users(username,pass,created,idx,address,last_active,email,google_sub) VALUES(?,?,?,?,?,?,?,?)').run(name, pass, Date.now(), idx, address, Date.now(), email, info.sub).lastInsertRowid);
      });
      u = fresh(id); created = true; console.log('[konto google]', name, u.address);
    }
    q('UPDATE users SET last_active=? WHERE id=?').run(Date.now(), u.id);
    return { token: newSession(u.id), account: publicUser(fresh(u.id)), history: histOf(u.id), created };
  },
  'POST /api/admin/config': async ({ user, body }) => {
    need(user); if (!ADMIN_USERS.has(user.username.toLowerCase())) throw new E('admin', 'Brak dostępu do panelu admina', 403);
    const put = (k, v) => q('INSERT INTO config(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k, v), out = {};
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
      const other = q('SELECT id FROM users WHERE username=?').get(n); if (other && other.id !== u.id) throw new E('exists', 'Ta nazwa jest zajęta', 409);
      q('UPDATE users SET username=? WHERE id=?').run(n, u.id);
    }
    if (body.email != null) {
      const m = String(body.email).trim().toLowerCase();
      if (m && (m.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m))) throw new E('email', 'Nieprawidłowy adres e-mail');
      q('UPDATE users SET email=? WHERE id=?').run(m || null, u.id);
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
    if (np.length < 6 || np.length > 128) throw new E('pass', 'Nowe hasło: co najmniej 6 znaków');
    q('UPDATE users SET pass=? WHERE id=?').run(await hashPass(np), u.id);
    const m = /^Bearer (.+)$/.exec(user._auth || ''); q('DELETE FROM sessions WHERE user_id=? AND token!=?').run(u.id, m ? sha(m[1]) : '');   // wyloguj inne urządzenia
    return { ok: true };
  },
  'POST /api/stats': async ({ user, body }) => {
    need(user); const u = fresh(user.id), st = JSON.parse(u.stats || '{}');
    for (const k of STAT_KEYS) { const v = Math.floor(+body[k] || 0); if (v > 0 && v < 10000) st[k] = (st[k] || 0) + v; }
    q('UPDATE users SET stats=?, last_active=? WHERE id=?').run(JSON.stringify(st), Date.now(), u.id); return { ok: true };
  },
  'GET /api/admin/overview': async ({ user }) => {
    need(user); if (!ADMIN_USERS.has(user.username.toLowerCase())) throw new E('admin', 'Brak dostępu do panelu admina', 403);
    const accounts = q('SELECT * FROM users ORDER BY id').all().map(u => ({ id: String(u.id), ...publicUser(u), wallet: u.address, history: histOf(u.id, 40) }));
    const names = Object.fromEntries(accounts.map(a => [a.id, a.username]));
    const matches = q("SELECT * FROM matches WHERE state!='open' ORDER BY COALESCE(ended,t) DESC LIMIT 1000").all().map(m => ({ id: String(m.id), u: String(m.user_id), name: names[m.user_id],
      t: m.ended || m.t, map: m.map, stake: m.stake_usd, won: m.state === 'won', forfeit: !!m.forfeit,
      payout: Math.round(m.payout_lamports / 1e9 * m.price * 100) / 100, fee: Math.round(m.fee_lamports / 1e9 * m.price * 100) / 100 }));
    let tre = 0; try { tre = await conn.getBalance(TREASURY.publicKey); } catch {}
    const ledger = q('SELECT COALESCE(SUM(lamports),0) s FROM users').get().s;
    return { accounts, matches, price: PRICE, cluster: CLUSTER, treasury: { address: TREASURY.publicKey.toBase58(), lamports: tre, usd: toUsd(tre) },
      ledger: { lamports: ledger, usd: toUsd(ledger) }, pendingSweep: q('SELECT COALESCE(SUM(lamports),0) s FROM deposits WHERE swept=0').get().s };
  },
};

// gra pod tym samym adresem co API: index.html z wpisanym adresem serwera portfeli + skins.json
const STATIC = { '/': 'index.html', '/index.html': 'index.html', '/skins.json': 'skins.json', '/kreator-skinow.html': 'zrodla/kreator-skinow.html' };
function serveGame(p, res) {
  const f = STATIC[p] && path.join(GAME_DIR, STATIC[p]);
  if (!f || !fs.existsSync(f)) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Nie znaleziono'); }
  let b = fs.readFileSync(f);
  if (f.endsWith('index.html')) { const s = b.toString('utf8'), i = s.indexOf('<head>'); b = Buffer.from(i >= 0 ? s.slice(0, i + 6) + '<script>window.BEANLADEN_API=location.origin</script>' + s.slice(i + 6) : s); }
  res.writeHead(200, { 'Content-Type': f.endsWith('.json') ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }); res.end(b);
}
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
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress, now = Date.now();
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
// Gracz płaci stawkę (/api/match/start), łączy się z /ws?t=TOKEN i wysyła {t:'queue', matchId}. Serwer paruje dwóch różnych
// graczy z tą samą stawką, losuje mapę, a potem przekazuje między nimi stan (ruch, strzały, trafienia). Rundy liczy serwer
// (z meldunków 'dead' gracza, który zginął) i to on rozlicza stawki obu graczy po meczu. Wyjście z kolejki = zwrot stawki,
// zerwanie połączenia w trakcie meczu = wygrana przeciwnika.
const DUEL_MAPS = ['Oaza', 'Magazyn', 'Baza'];
await MECZ.loadMaps(GAME_DIR, DUEL_MAPS);                       // kolizje map z plików gry (zrodla/*-data.js): serwer sam liczy ruch i strzały
const rooms = new Set();
const nowS = () => performance.now() / 1000;
const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
const mmQueue = [];                                             // czekający: {ws, user, matchId, stake, nick, skin}
let roomSeq = 0;
const wsSend = (ws, o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };
function userFromToken(tok) { return tok ? q('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?').get(sha(tok)) || null : null; }

// anulowane szukanie: stawka wraca, a mecz i pobranie stawki znikają z historii (jakby gry nie było)
function refundMatch(matchId, userId) {
  try {
    tx(() => {
      const m = q("SELECT * FROM matches WHERE id=? AND user_id=? AND state='open'").get(matchId, userId); if (!m) return;
      q('DELETE FROM matches WHERE id=?').run(m.id);
      const st = q("SELECT id FROM txs WHERE user_id=? AND type='stake' AND lamports=? AND t>=? ORDER BY t DESC, id DESC LIMIT 1").get(userId, -m.stake_lamports, m.t - 5000);
      if (st) q('DELETE FROM txs WHERE id=?').run(st.id);
      q('UPDATE users SET lamports=lamports+? WHERE id=?').run(m.stake_lamports, userId);
      console.log(`[1v1] zwrot stawki ${m.stake_usd} USD dla użytkownika ${userId} (anulowane szukanie)`);
    });
  } catch (e) { console.error('[1v1] zwrot stawki', e); }
}
// rozliczenie jednego gracza po meczu (to samo co POST /api/match/end, ale decyduje serwer)
function settleDuel(matchId, userId, won, forfeit, map) {
  try {
    tx(() => {
      const m = q("SELECT * FROM matches WHERE id=? AND user_id=? AND state='open'").get(matchId, userId); if (!m) return;
      if (won) {
        const pot = m.stake_lamports * 2, fee = Math.round(pot * HOUSE_FEE), pay = pot - fee;
        q("UPDATE matches SET state='won', payout_lamports=?, fee_lamports=?, ended=?, map=COALESCE(?,map) WHERE id=?").run(pay, fee, Date.now(), map || null, m.id);
        q('UPDATE users SET lamports=lamports+? WHERE id=?').run(pay, userId);
        addTx(userId, 'win', pay, Math.round(pay / 1e9 * m.price * 100) / 100, { fee: Math.round(fee / 1e9 * m.price * 100) / 100 });
      } else {
        q("UPDATE matches SET state='lost', forfeit=?, ended=?, map=COALESCE(?,map) WHERE id=?").run(forfeit ? 1 : 0, Date.now(), map || null, m.id);
        addTx(userId, 'loss', 0, 0, { note: '$' + m.stake_usd.toFixed(2) });
      }
    });
  } catch (e) { console.error('[1v1] rozliczenie', e); }
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
  for (const pl of [a, b]) try { q('UPDATE matches SET map=? WHERE id=?').run(room.map, pl.matchId); } catch {}
  [a, b].forEach((pl, seat) => { const op = room.p[1 - seat]; wsSend(pl.ws, { t: 'matched', seat, map: room.map, opp: { nick: op.nick, skin: op.skin } }); });
  console.log(`[1v1] pokój ${room.id}: ${a.nick} vs ${b.nick}, stawka $${a.stake}, mapa ${room.map}`);
}
function endRoom(room, winner, reason) {
  if (room.over) return; room.over = true; rooms.delete(room);
  room.p.forEach((pl, seat) => settleDuel(pl.matchId, pl.user.id, seat === winner, seat !== winner && reason === 'left', room.map));
  room.p.forEach(pl => { wsSend(pl.ws, { t: 'end', winner, score: room.score, reason }); if (pl.ws) pl.ws.mm = null; });
  console.log(`[1v1] pokój ${room.id}: koniec, wygrał ${room.p[winner].nick} (${room.score.join(':')}${reason === 'left' ? ', walkower' : reason === 'cheat' ? ', przeciwnik wyrzucony za oszukiwanie' : ''})`);
  if (room.game.log.length) console.log(`[1v1] pokój ${room.id}: odrzucone ruchy:`, room.game.log.slice(-20).join(' | '));
}
function onDuelMessage(ws, user, raw) {
  let m; try { m = JSON.parse(raw); } catch { return; }
  if (!m || typeof m.t !== 'string') return;
  const me = ws.mm;
  if (m.t === 'queue') {
    if (me) return;                                              // już w kolejce albo w meczu
    const match = q("SELECT * FROM matches WHERE id=? AND user_id=? AND state='open'").get(+m.matchId, user.id);
    if (!match) return wsSend(ws, { t: 'error', code: 'match', message: 'Brak opłaconej stawki – zagraj jeszcze raz z lobby.' });
    for (const x of mmQueue.filter(x => x.user.id === user.id)) { leaveQueue(x.ws, true); wsSend(x.ws, { t: 'error', code: 'dup', message: 'Szukasz meczu w innej karcie.' }); }
    const entry = { ws, user, matchId: match.id, stake: match.stake_usd, nick: user.username, skin: String(m.skin || '').slice(0, 64) };
    const i = mmQueue.findIndex(x => x.stake === entry.stake && x.user.id !== user.id && x.ws.readyState === 1);
    if (i < 0) { mmQueue.push(entry); ws.mm = entry; wsSend(ws, { t: 'queued', waiting: mmQueue.filter(x => x.stake === entry.stake).length }); return; }
    startRoom(mmQueue.splice(i, 1)[0], entry); return;
  }
  if (m.t === 'cancel') { if (me && !me.room) { leaveQueue(ws, true); wsSend(ws, { t: 'cancelled' }); } return; }
  if (!me || !me.room || me.room.over) return;
  const room = me.room, op = room.p[1 - me.seat];
  if (m.t === 'ready') {
    room.ready[me.seat] = true;
    if (room.ready[0] && room.ready[1] && room.game.phase === 'wait') { MECZ.startRound(room.game, nowS(), MECZ.START_DELAY); room.out(-1, { t: 'go' }); }
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
wss.on('connection', (ws, req, user) => {
  ws.alive = true; ws.on('pong', () => { ws.alive = true; });
  ws.on('message', d => onDuelMessage(ws, user, String(d)));
  ws.on('close', () => {
    const me = ws.mm; if (!me) return;
    if (!me.room) leaveQueue(ws, true);                           // zamknięta karta w trakcie szukania: zwrot stawki
    else if (!me.room.over) endRoom(me.room, 1 - me.seat, 'left');   // wyjście z meczu: wygrywa przeciwnik
  });
  wsSend(ws, { t: 'hello', nick: user.username });
});
setInterval(() => { for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; try { ws.ping(); } catch {} } }, 20000);
function onUpgrade(req, socket, head) {
  const url = new URL(req.url, 'http://x');
  if (url.pathname !== '/ws' || (COVER_PW && !coverOk(req))) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); return socket.destroy(); }
  const user = userFromToken(url.searchParams.get('t'));
  if (!user) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); return socket.destroy(); }
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req, user));
}
const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (req.method === 'OPTIONS') { res.writeHead(204, cors(origin)); return res.end(); }
  if (COVER_PW) {                                               // bramka z hasłem (lock screen)
    const p0 = new URL(req.url, 'http://x').pathname;
    if (req.method === 'POST' && p0 === '/__cover') return coverLogin(req, res);
    if (!coverOk(req)) {
      if (req.method === 'GET' && !p0.startsWith('/api/')) return serveCover(res);
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(origin) });
      return res.end(JSON.stringify({ error: 'locked', message: 'Strona jest zablokowana hasłem' }));
    }
  }
  const url = new URL(req.url, 'http://x'), key = req.method + ' ' + url.pathname, h = routes[key];
  if (!h && req.method === 'GET' && !url.pathname.startsWith('/api/')) return serveGame(url.pathname, res);
  if (!h) return send(res, 404, { error: 'not_found', message: 'Nie ma takiej ścieżki' }, origin);
  try {
    const body = req.method === 'POST' ? await readBody(req) : {};
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
    const user = userFromReq(req); if (user) user._auth = req.headers.authorization;
    send(res, 200, await h({ req, body, ip, user }), origin);
  } catch (e) {
    if (!(e instanceof E)) console.error(key, e);
    send(res, e.status || 500, { error: e.code || 'server', message: e instanceof E ? e.message : 'Błąd serwera' }, origin);
  }
});
server.on('upgrade', onUpgrade);                              // WebSocket /ws: kolejka i mecze 1v1
server.listen(PORT, () => {
  console.log(`Portfele BEANLADEN: http://localhost:${PORT}  sieć: ${CLUSTER}  skarbiec: ${TREASURY.publicKey.toBase58()}`);
  if (!ADMIN_USERS.size) console.log('Uwaga: brak ADMIN_USERS – panel admina nie wpuści nikogo.');
});
refreshPrice(); setInterval(refreshPrice, 60000);
setInterval(scanAll, SCAN_MS); setTimeout(scanAll, 3000);
