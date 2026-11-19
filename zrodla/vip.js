// VIP – złoty nick z poświatą. Kto jest VIP-em: do ustalenia; na razie NIKT (isVip zawsze zwraca false).
// Styl .vip-nick działa na dowolnym napisie z nickiem: teraz tabliczka nad fasolką w lobby (lobby.js setName),
// później np. tabela wyników, killfeed i podium Deathmatch (tam serwer musi podawać, kto jest VIP-em).
// Użycie: ensureVipCss(); el.classList.toggle('vip-nick', isVip(konto));

// kryteria VIP – do ustalenia; do tego czasu nikt nie dostaje złotego nicka
export function isVip(acct) { return false; }

// złoty gradient w literach, przesuwający się połysk i ciepła poświata (drop-shadow, bo text-shadow
// przykryłby gradient przyciętego do liter tła); !important – nadpisuje kolory i cienie miejsca, w którym stoi nick
const CSS = `
.vip-nick{
  background:linear-gradient(100deg,#9a6a12 0%,#e2b443 16%,#fff6c4 30%,#f5c94e 44%,#b98317 58%,#ffe68f 76%,#c99325 100%) 0 0/260% 100% !important;
  -webkit-background-clip:text !important;background-clip:text !important;color:transparent !important;-webkit-text-fill-color:transparent !important;
  text-shadow:none !important;
  filter:drop-shadow(0 0 1px rgba(70,38,0,.95)) drop-shadow(0 1px 0 rgba(70,38,0,.9)) drop-shadow(0 0 7px rgba(255,204,64,.8)) drop-shadow(0 0 16px rgba(255,170,40,.5));
  animation:vipNickShine 3.4s linear infinite;
}
@keyframes vipNickShine{from{background-position:100% 0}to{background-position:-160% 0}}
@media (prefers-reduced-motion:reduce){.vip-nick{animation:none}}
`;
let injected = false;
export function ensureVipCss() {
  if (injected || typeof document === 'undefined') return; injected = true;
  const s = document.createElement('style'); s.id = 'vip-css'; s.textContent = CSS; document.head.appendChild(s);
}
