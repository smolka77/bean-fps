// Ochrona serwera BEANLADEN: hashowanie haseł, kody 2FA (TOTP), limity prób, prawdziwe IP klienta,
// jednorazowe bilety do WebSocketu i zastrzeżone nicki. Bez zależności – tylko node:crypto.
import crypto from 'node:crypto';

// ---------------- hasła ----------------
// scrypt N=2^14, r=8, p=5 (16 MiB pamięci, zalecenie OWASP). Stary format 'scrypt$sól$hash' (p=1) jest nadal
// rozpoznawany, a przy udanym logowaniu serwer przepisuje go na nowy (needsRehash).
const P = { N: 16384, r: 8, p: 5 };
const TAG = `scrypt2$${P.N}:${P.r}:${P.p}$`;
const scryptP = (pw, salt, o) => new Promise((ok, no) => crypto.scrypt(String(pw), salt, 64, { ...o, maxmem: 64 * 1024 * 1024 }, (e, k) => e ? no(e) : ok(k)));
export async function hashPass(pw) { const salt = crypto.randomBytes(16); return TAG + salt.toString('base64') + '$' + (await scryptP(pw, salt, P)).toString('base64'); }
export async function checkPass(pw, stored) {
  const a = String(stored || '').split('$'); let o, s, h;
  if (a[0] === 'scrypt' && a.length === 3) { o = { N: 16384, r: 8, p: 1 }; [, s, h] = a; }
  else if (a[0] === 'scrypt2' && a.length === 4) { const [N, r, p] = a[1].split(':').map(Number); if (!(N <= 1 << 17 && r <= 16 && p <= 16)) return false; o = { N, r, p }; [, , s, h] = a; }
  else return false;
  const want = Buffer.from(h, 'base64'), k = await scryptP(pw, Buffer.from(s, 'base64'), o);
  return k.length === want.length && crypto.timingSafeEqual(k, want);
}
export const needsRehash = stored => !String(stored || '').startsWith(TAG);
// to samo obciążenie co prawdziwe sprawdzenie – nieistniejący nick nie odpowiada szybciej (brak zgadywania kont po czasie)
const DUMMY = hashPass(crypto.randomBytes(16).toString('hex'));
export async function fakeCheck(pw) { await checkPass(pw, await DUMMY); return false; }
export const PASS_MIN = 10;

// ---------------- limity prób ----------------
// klucz (np. 'login:IP' albo 'u:nick') -> czasy prób; stare wpisy znikają, więc mapa nie rośnie bez końca
export function makeLimiter() {
  const m = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, a] of m) if (!a.length || now - a[a.length - 1] > 3600e3) m.delete(k); }, 60e3).unref();
  return (key, max = 12, ms = 60000) => {
    if (m.size > 100000) m.clear();
    const now = Date.now(), a = (m.get(key) || []).filter(t => now - t < ms); a.push(now); m.set(key, a); return a.length > max;
  };
}

// ---------------- IP klienta ----------------
// X-Forwarded-For ustawia nginx, więc ufamy mu tylko wtedy, gdy połączenie przyszło z tej samej maszyny (127.0.0.1).
// Bezpośrednie połączenie z internetu może wpisać tam cokolwiek – wtedy liczy się adres gniazda.
const LOOP = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
export function clientIp(req) {
  const r = req.socket.remoteAddress || '';
  if (!LOOP.has(r)) return r;
  const f = String(req.headers['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean);
  return f.length ? f[f.length - 1] : r;
}

// ---------------- 2FA: TOTP (RFC 6238, jak Google Authenticator / Authy / 1Password) ----------------
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32enc(buf) { let bits = 0, v = 0, out = ''; for (const b of buf) { v = (v << 8) | b; bits += 8; while (bits >= 5) { out += B32[(v >>> (bits - 5)) & 31]; bits -= 5; } } if (bits) out += B32[(v << (5 - bits)) & 31]; return out; }
function b32dec(s) { let bits = 0, v = 0; const out = []; for (const c of String(s).toUpperCase().replace(/[^A-Z2-7]/g, '')) { v = (v << 5) | B32.indexOf(c); bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); }
function hotp(secret, step) {
  const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac('sha1', b32dec(secret)).update(b).digest(), o = h[19] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
}
export const totpSecret = () => b32enc(crypto.randomBytes(20));
export const totpUri = (secret, label) => `otpauth://totp/${encodeURIComponent('BEANLADEN:' + label)}?secret=${secret}&issuer=BEANLADEN&algorithm=SHA1&digits=6&period=30`;
// zwraca numer kroku czasu (do zapisania, żeby ten sam kod nie zadziałał drugi raz) albo 0
export function totpCheck(secret, code, lastStep = 0) {
  const c = String(code || '').replace(/\s/g, ''); if (!secret || !/^\d{6}$/.test(c)) return 0;
  const now = Math.floor(Date.now() / 30000);
  for (const d of [0, -1, 1]) { const st = now + d; if (st <= (lastStep || 0)) continue; if (crypto.timingSafeEqual(Buffer.from(hotp(secret, st)), Buffer.from(c))) return st; }
  return 0;
}
export const _hotp = hotp;   // do testów

// ---------------- bilety do WebSocketu ----------------
// Token sesji nie trafia do adresu /ws (adresy lądują w logach). Gra bierze bilet (POST /api/ws-ticket), ważny 30 s i jednorazowy.
const tickets = new Map();
export function wsTicket(userId) {
  const now = Date.now(); if (tickets.size > 20000) for (const [k, v] of tickets) if (v.exp < now) tickets.delete(k);
  const t = crypto.randomBytes(24).toString('base64url'); tickets.set(t, { uid: userId, exp: now + 30000 }); return t;
}
export function useTicket(t) { const x = t && tickets.get(t); if (!x) return 0; tickets.delete(t); return x.exp > Date.now() ? x.uid : 0; }

// ---------------- zastrzeżone nicki ----------------
// Nie da się ich założyć ani przyjąć zmianą nicku (podszywanie się pod obsługę gry). Konta, które już je mają, zostają.
const RESERVED = /admin|adm1n|moderat|beanladen|support|wsparcie|pomoc|^(root|system|owner|staff|official|mod|help|serwer|server)\d*$/i;
export const reservedName = (n, extra = []) => RESERVED.test(n) || extra.includes(String(n).toLowerCase());
