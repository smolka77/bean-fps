// Arsenał: bronie za trzymanie środków. Gracz poniżej progu ma w 1v1 i w Deathmatch tylko pistolet (Glock-17);
// każda inna broń ma próg – ile gracz musi MIEĆ (nic się nie pobiera, wystarczy trzymać):
//  - unit 'sol' (domyślnie): saldo SOL gracza w grze (users.lamports; stawka zamrożona na czas meczu też się liczy),
//  - unit 'token': token SPL / Token-2022 (adres mintu) na adresie depozytu gracza – saldo czytane przez RPC Solany i trzymane w pamięci
//    (lobby odświeża co `refresh` s, kolejka – gdy wynik starszy niż 10 min). Sieć tokenu jest osobna od portfeli SOL; własny RPC: TOKEN_RPC_URL.
//  - unit 'hold': progi w tokenach, a gracz ma dwie drogi (liczy się lepsza):
//      1) podpięty własny portfel (Phantom itp., podpis wiadomości – serwer: /api/hold/*): tokeny na tym portfelu (odczyt przez RPC jak wyżej),
//      2) bez portfela: saldo SOL w grze przeliczone na tokeny po bieżącym kursie (priceSol = ile SOL kosztuje 1 token; serwer pobiera kurs co minutę).
// Bronie gracza serwer ustala na starcie meczu.
// Skiny z kreatora (skins.json) działają tak samo: każdy ma próg (skinNeed[id], brak = skinDefault); podstawowe kolorowe fasolki są darmowe.
// Serwer sprawdza skin przy wejściu do 1v1 i Deathmatch – skin poniżej progu zamienia na podstawowy.
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';

export const BASE = 'glock17';                                          // pistolet startowy – każdy ma go zawsze
export const GUNS = ['deagle', 'mp5k', 'spas12', 'akm', 'm4a1'];        // bronie z progiem (złoty AKM to osobny dostęp VIP)
export const NETWORKS = ['mainnet-beta', 'devnet', 'testnet'];
export const UNITS = ['sol', 'token', 'hold'];
export const DEFAULTS = {
  enabled: true, unit: 'sol', mint: '', symbol: 'TOKEN', network: 'mainnet-beta', refresh: 120,
  need: { deagle: 0.1, mp5k: 0.25, spas12: 0.5, akm: 1, m4a1: 1.5 },     // progi w jednostce `unit` (SOL albo tokeny; 'hold' – tokeny)
  skinDefault: 0, skinNeed: {},                                        // skiny z kreatora: próg domyślny (0 = każdy skin za darmo) i progi poszczególnych skinów (id -> ilość)
};
const MIN_GAP = 10e3;                                                   // ręczne „Sprawdź saldo” (token) najwyżej co 10 s
export const QUEUE_AGE = 10 * 60e3;                                     // kolejka: saldo tokenu starsze niż 10 min jest sprawdzane jeszcze raz

const isMint = (s) => { if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)) return false; try { new PublicKey(s); return true; } catch { return false; } };
export function sanitize(src) {
  const s = src && typeof src === 'object' ? src : {}, D = DEFAULTS;
  const mint = String(s.mint ?? D.mint).trim();
  const need = {};
  const amt = (v, d) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.min(1e15, Math.round(n * 1e6) / 1e6) : d; };
  const skinNeed = {};
  for (const [id, v] of Object.entries(s.skinNeed && typeof s.skinNeed === 'object' ? s.skinNeed : {}).slice(0, 300)) {
    if (/^[A-Za-z0-9_-]{1,64}$/.test(id) && v !== '' && v !== null && Number.isFinite(Number(v)) && Number(v) >= 0) skinNeed[id] = amt(v, 0);
  }
  for (const g of GUNS) { const v = Number(s.need && s.need[g]); need[g] = Number.isFinite(v) && v >= 0 ? Math.min(1e15, Math.round(v * 1e6) / 1e6) : D.need[g]; }
  return {
    enabled: s.enabled === undefined ? D.enabled : (s.enabled === true || s.enabled === 'true' || s.enabled === 1),
    unit: UNITS.includes(s.unit) ? s.unit : D.unit,
    mint: isMint(mint) ? mint : '',
    symbol: (String(s.symbol ?? D.symbol).replace(/[^\w$.\-]/g, '').slice(0, 12)) || D.symbol,
    network: NETWORKS.includes(s.network) ? s.network : D.network,
    refresh: Math.max(30, Math.min(3600, Math.round(Number(s.refresh) || D.refresh))),
    need,
    skinDefault: amt(s.skinDefault, D.skinDefault),
    skinNeed,
  };
}
const isToken = (c) => c.unit === 'token';
export const isHold = (c) => !!c && c.unit === 'hold';
export const usesMint = (c) => !!c && (c.unit === 'token' || c.unit === 'hold');
export const active = (c) => !!(c && c.enabled && (!usesMint(c) || c.mint));
export const unitLabel = (c) => usesMint(c) ? c.symbol : 'SOL';
export const publicConfig = (c) => ({ enabled: active(c), unit: c.unit, symbol: unitLabel(c), mint: usesMint(c) ? c.mint : '', network: c.network,
  base: BASE, guns: GUNS, need: c.need, refresh: c.refresh, skinDefault: c.skinDefault, skinNeed: c.skinNeed });
// próg skina z kreatora (własny albo domyślny)
export const skinNeedOf = (c, id) => (c.skinNeed && Object.prototype.hasOwnProperty.call(c.skinNeed, id) ? c.skinNeed[id] : c.skinDefault);
// bronie gracza z danym saldem; null = Arsenał wyłączony (wszystkie bronie jak dawniej)
export const gunsWith = (c, amount) => active(c) ? [BASE, ...GUNS.filter((g) => amount + 1e-9 >= c.need[g])] : null;

const timeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('RPC nie odpowiada')), ms))]);

// solOf(uid) – saldo SOL gracza w grze (serwer czyta je z bazy)
// walletOf(uid) – podpięty własny portfel gracza ('' = brak; tylko tryb 'hold')
// priceSol() – ile SOL kosztuje 1 token (0 = kurs nieznany; tylko tryb 'hold')
export function createArsenal({ getCfg, rpcUrl = '', solOf = () => 0, walletOf = () => '', priceSol = () => 0 }) {
  const cache = new Map();                                              // token: id gracza -> { amount, t, mint, addr, err, p }
  let conn = null, connUrl = '';
  const connOf = (c) => { const url = rpcUrl || clusterApiUrl(c.network); if (url !== connUrl) { conn = new Connection(url, 'confirmed'); connUrl = url; } return conn; };
  async function readAmount(c, address) {
    const r = await connOf(c).getParsedTokenAccountsByOwner(new PublicKey(address), { mint: new PublicKey(c.mint) });
    let sum = 0;
    for (const a of r.value || []) { const ta = a.account && a.account.data && a.account.data.parsed && a.account.data.parsed.info && a.account.data.parsed.info.tokenAmount;
      if (ta) sum += parseFloat(ta.uiAmountString ?? ta.uiAmount ?? 0) || 0; }
    return sum;
  }
  const entryOf = (uid) => { let e = cache.get(uid); if (!e) { e = { amount: 0, t: 0, mint: '', addr: '', err: '', p: null }; cache.set(uid, e); } return e; };
  // adres, z którego czytamy token: tryb 'token' – adres depozytu w grze, tryb 'hold' – podpięty portfel ('' = nie czytamy)
  const tokenAddr = (c, user) => isToken(c) ? (user.address || '') : isHold(c) ? (walletOf(user.id) || '') : '';
  const cached = (c, uid, addr) => { const e = cache.get(uid); return e && e.mint === c.mint && e.addr === addr ? e : null; };
  const solAmount = (uid, extra) => Math.max(0, (+solOf(uid) || 0) + (+extra || 0));
  // tryb 'hold': tokeny na portfelu i SOL w grze przeliczony na tokeny – liczy się większe
  function holdParts(uid, extra = 0) {
    const c = getCfg(), w = walletOf(uid) || '', e = w ? cached(c, uid, w) : null, p = +priceSol() || 0;
    const wallet = e ? e.amount : 0, sol = solAmount(uid, extra), solTok = p > 0 ? sol / p : 0;
    return { wallet, sol, solTok, linked: !!w, source: w && wallet >= solTok ? 'wallet' : 'sol', amount: Math.max(wallet, solTok) };
  }
  // saldo w jednostce Arsenału; extra = środki zamrożone na czas meczu (stawka / wpisowe w SOL)
  const amountOf = (uid, extra = 0) => {
    const c = getCfg();
    if (isHold(c)) return holdParts(uid, extra).amount;
    if (!isToken(c)) return solAmount(uid, extra);
    const e = cache.get(uid); return e && e.mint === c.mint ? e.amount : 0;
  };
  const isFresh = (uid, maxAge) => {
    const c = getCfg(); if (!usesMint(c)) return true;
    if (isHold(c) && !walletOf(uid)) return true;                       // bez portfela liczy się SOL w grze (zawsze aktualny)
    const e = cache.get(uid); return !!e && e.t > 0 && e.mint === c.mint && (!isHold(c) || e.addr === walletOf(uid)) && Date.now() - e.t < maxAge;
  };
  // token: sprawdza saldo na adresie gracza; zawsze kończy się powodzeniem (błąd RPC zostaje w `err`, saldo – ostatnie znane)
  function refresh(user, minGap = 0) {
    const c = getCfg(), e = entryOf(user.id), addr = tokenAddr(c, user);
    if (!active(c) || !usesMint(c) || !addr) return Promise.resolve(e);
    if (e.p) return e.p;
    if (minGap && e.mint === c.mint && e.addr === addr && Date.now() - e.t < minGap) return Promise.resolve(e);
    const mint = c.mint;
    e.p = timeout(readAmount(c, addr), 8000)
      .then((a) => { e.amount = a; e.mint = mint; e.addr = addr; e.err = ''; })
      .catch((er) => { if (e.mint !== mint || e.addr !== addr) { e.amount = 0; e.mint = mint; e.addr = addr; } e.err = String(er && er.message || er).slice(0, 160); console.warn('[arsenał] saldo', user.id, e.err); })
      .then(() => { e.t = Date.now(); e.p = null; return e; });
    return e.p;
  }
  const gunsFor = (uid, extra = 0) => gunsWith(getCfg(), amountOf(uid, extra));
  // skin z kreatora: czy gracz trzyma dość (Arsenał wyłączony = każdy skin wolno)
  const skinOk = (uid, id, extra = 0) => { const c = getCfg(); return !active(c) || amountOf(uid, extra) + 1e-9 >= skinNeedOf(c, id); };
  function status(user) {
    const c = getCfg(), e = cache.get(user.id), tok = isToken(c), hold = isHold(c);
    const out = { ...publicConfig(c), address: user.address || '', balance: amountOf(user.id), unlocked: gunsFor(user.id) || [BASE, ...GUNS],
      checkedAt: tok ? (e && e.t ? e.t : 0) : Date.now(), error: tok && e && e.err ? 'Nie udało się sprawdzić salda tokenu – spróbuj za chwilę' : '' };
    if (hold) {
      const h = holdParts(user.id), w = walletOf(user.id) || '', we = w ? cached(c, user.id, w) : null;
      Object.assign(out, { wallet: w, walletBalance: h.wallet, sol: h.sol, solTok: h.solTok, source: h.source, priceSol: +priceSol() || 0,
        checkedAt: w ? (we && we.t ? we.t : 0) : Date.now(),
        error: w && e && e.addr === w && e.err ? 'Nie udało się sprawdzić salda tokenu – spróbuj za chwilę' : !(+priceSol() > 0) ? 'Brak kursu tokenu – spróbuj za chwilę' : '' });
    }
    return out;
  }
  return { refresh, isFresh, gunsFor, skinOk, status, amountOf, forget: (uid) => cache.delete(uid), refreshDelay: () => MIN_GAP };
}
