// Arsenał: bronie za trzymanie środków. Gracz poniżej progu ma w 1v1 i w Deathmatch tylko pistolet (Glock-17);
// każda inna broń ma próg – ile gracz musi MIEĆ (nic się nie pobiera, wystarczy trzymać):
//  - unit 'sol' (domyślnie): saldo SOL gracza w grze (users.lamports; stawka zamrożona na czas meczu też się liczy),
//  - unit 'token': token SPL / Token-2022 (adres mintu) na adresie depozytu gracza – saldo czytane przez RPC Solany i trzymane w pamięci
//    (lobby odświeża co `refresh` s, kolejka – gdy wynik starszy niż 10 min). Sieć tokenu jest osobna od portfeli SOL; własny RPC: TOKEN_RPC_URL.
// Bronie gracza serwer ustala na starcie meczu.
// Skiny z kreatora (skins.json) działają tak samo: każdy ma próg (skinNeed[id], brak = skinDefault); podstawowe kolorowe fasolki są darmowe.
// Serwer sprawdza skin przy wejściu do 1v1 i Deathmatch – skin poniżej progu zamienia na podstawowy.
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';

export const BASE = 'glock17';                                          // pistolet startowy – każdy ma go zawsze
export const GUNS = ['deagle', 'mp5k', 'spas12', 'akm', 'm4a1'];        // bronie z progiem (złoty AKM to osobny dostęp VIP)
export const NETWORKS = ['mainnet-beta', 'devnet', 'testnet'];
export const UNITS = ['sol', 'token'];
export const DEFAULTS = {
  enabled: true, unit: 'sol', mint: '', symbol: 'TOKEN', network: 'mainnet-beta', refresh: 120,
  need: { deagle: 0.1, mp5k: 0.25, spas12: 0.5, akm: 1, m4a1: 1.5 },     // progi w jednostce `unit` (SOL albo tokeny)
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
export const active = (c) => !!(c && c.enabled && (!isToken(c) || c.mint));
export const unitLabel = (c) => isToken(c) ? c.symbol : 'SOL';
export const publicConfig = (c) => ({ enabled: active(c), unit: c.unit, symbol: unitLabel(c), mint: isToken(c) ? c.mint : '', network: c.network,
  base: BASE, guns: GUNS, need: c.need, refresh: c.refresh, skinDefault: c.skinDefault, skinNeed: c.skinNeed });
// próg skina z kreatora (własny albo domyślny)
export const skinNeedOf = (c, id) => (c.skinNeed && Object.prototype.hasOwnProperty.call(c.skinNeed, id) ? c.skinNeed[id] : c.skinDefault);
// bronie gracza z danym saldem; null = Arsenał wyłączony (wszystkie bronie jak dawniej)
export const gunsWith = (c, amount) => active(c) ? [BASE, ...GUNS.filter((g) => amount + 1e-9 >= c.need[g])] : null;

const timeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('RPC nie odpowiada')), ms))]);

// solOf(uid) – saldo SOL gracza w grze (serwer czyta je z bazy)
export function createArsenal({ getCfg, rpcUrl = '', solOf = () => 0 }) {
  const cache = new Map();                                              // token: id gracza -> { amount, t, mint, err, p }
  let conn = null, connUrl = '';
  const connOf = (c) => { const url = rpcUrl || clusterApiUrl(c.network); if (url !== connUrl) { conn = new Connection(url, 'confirmed'); connUrl = url; } return conn; };
  async function readAmount(c, address) {
    const r = await connOf(c).getParsedTokenAccountsByOwner(new PublicKey(address), { mint: new PublicKey(c.mint) });
    let sum = 0;
    for (const a of r.value || []) { const ta = a.account && a.account.data && a.account.data.parsed && a.account.data.parsed.info && a.account.data.parsed.info.tokenAmount;
      if (ta) sum += parseFloat(ta.uiAmountString ?? ta.uiAmount ?? 0) || 0; }
    return sum;
  }
  const entryOf = (uid) => { let e = cache.get(uid); if (!e) { e = { amount: 0, t: 0, mint: '', err: '', p: null }; cache.set(uid, e); } return e; };
  // saldo w jednostce Arsenału; extra = środki zamrożone na czas meczu (stawka / wpisowe w SOL)
  const amountOf = (uid, extra = 0) => {
    const c = getCfg();
    if (!isToken(c)) return Math.max(0, (+solOf(uid) || 0) + (+extra || 0));
    const e = cache.get(uid); return e && e.mint === c.mint ? e.amount : 0;
  };
  const isFresh = (uid, maxAge) => { const c = getCfg(); if (!isToken(c)) return true; const e = cache.get(uid); return !!e && e.t > 0 && e.mint === c.mint && Date.now() - e.t < maxAge; };
  // token: sprawdza saldo na adresie gracza; zawsze kończy się powodzeniem (błąd RPC zostaje w `err`, saldo – ostatnie znane)
  function refresh(user, minGap = 0) {
    const c = getCfg(), e = entryOf(user.id);
    if (!active(c) || !isToken(c) || !user.address) return Promise.resolve(e);
    if (e.p) return e.p;
    if (minGap && e.mint === c.mint && Date.now() - e.t < minGap) return Promise.resolve(e);
    const mint = c.mint;
    e.p = timeout(readAmount(c, user.address), 8000)
      .then((a) => { e.amount = a; e.mint = mint; e.err = ''; })
      .catch((er) => { if (e.mint !== mint) { e.amount = 0; e.mint = mint; } e.err = String(er && er.message || er).slice(0, 160); console.warn('[arsenał] saldo', user.id, e.err); })
      .then(() => { e.t = Date.now(); e.p = null; return e; });
    return e.p;
  }
  const gunsFor = (uid, extra = 0) => gunsWith(getCfg(), amountOf(uid, extra));
  // skin z kreatora: czy gracz trzyma dość (Arsenał wyłączony = każdy skin wolno)
  const skinOk = (uid, id, extra = 0) => { const c = getCfg(); return !active(c) || amountOf(uid, extra) + 1e-9 >= skinNeedOf(c, id); };
  function status(user) {
    const c = getCfg(), e = cache.get(user.id), tok = isToken(c);
    return { ...publicConfig(c), address: user.address || '', balance: amountOf(user.id), unlocked: gunsFor(user.id) || [BASE, ...GUNS],
      checkedAt: tok ? (e && e.t ? e.t : 0) : Date.now(), error: tok && e && e.err ? 'Nie udało się sprawdzić salda tokenu – spróbuj za chwilę' : '' };
  }
  return { refresh, isFresh, gunsFor, skinOk, status, amountOf, forget: (uid) => cache.delete(uid), refreshDelay: () => MIN_GAP };
}
