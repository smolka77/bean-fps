// Skiny broni: lista id i progów (ta sama co WSKINS w zrodla/weapon-skins.js – id muszą się zgadzać).
// free = każdy, mid = od wskin.mid tokenów (Ekwipunek, domyślnie 5 mln), legend = od wskin.legend (domyślnie 10 mln).
// Serwer przyjmuje od gracza tylko skiny z dostępnego progu i rozsyła je innym graczom (widać je u przeciwników i botów).
export const TIERS = {
  desert: 'free', woodland: 'free', urban: 'free',
  tiger: 'mid', carbon: 'mid', miami: 'mid', vicecamo: 'mid', chrome: 'mid',
  gold: 'legend', damascus: 'legend', lava: 'legend', galaxy: 'legend', hologram: 'legend',
};
export const RANK = { free: 0, mid: 1, legend: 2 };
const GUN = /^[a-z0-9]{2,12}$/;
// mapa od gracza {broń: skin} → tylko znane bronie/skiny z progu <= rank (rank: 0 free, 1 mid, 2 legend)
export function clean(src, rank) {
  const out = {}; if (!src || typeof src !== 'object') return out;
  for (const [g, id] of Object.entries(src).slice(0, 20)) if ((GUN.test(g) || g === '*') && TIERS[id] && RANK[TIERS[id]] <= rank) out[g] = id;
  return out;
}
// skin dla bota (ten sam na wszystkie bronie): przeważnie darmowe i średnie, czasem legendarny – gracze widzą, co da się zdobyć
export function botSkins() {
  const r = Math.random(), pick = (tier) => { const l = Object.keys(TIERS).filter((k) => TIERS[k] === tier); return l[(Math.random() * l.length) | 0]; };
  if (r < 0.3) return {};
  return { '*': pick(r < 0.6 ? 'free' : r < 0.88 ? 'mid' : 'legend') };
}
