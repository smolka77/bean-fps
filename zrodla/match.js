// Mecz 1v1 w Bean FPS.
// Po GRAJ w lobby (stawka i losowanie mapy są w lobby): szukanie przeciwnika → wczytywanie obu graczy (nad sceną lobby);
// bez mapy z lobby mecz sam ją losuje (karty map z miniaturami z silnika).
// potem w grze: plansza meczu (mapa, stawka, rundy, przeciwnik) → odliczanie → runda → ZWYCIĘSTWO / PORAŻKA z wynikiem.
// Każde zabójstwo kończy rundę, mecz trwa do 3 wygranych rund. Podczas plansz i odliczania gracze stoją w miejscu.
//
// Użycie: const match = createMatch(hooks); match.start({map, stake}) po GRAJ; match.kill('me' | 'op') przy zabójstwie;
// match.update(dt, paused) w każdej klatce. Haki gry opisane są przy createMatch.

export const ROUNDS_TO_WIN = 3;
const OPP_NAMES = ['Groszek', 'Bobek_PL', 'Fasolino', 'Cieciorka', 'Soczewica', 'Edamame', 'Pinto', 'Mung', 'Wielki Bób',
  'Fasolada', 'Strączek', 'Kidney', 'BeanSniper', 'ZiarnoX', 'Lima', 'Adzuki', 'Tyczny', 'Szparag'];
const LOBBY_PHASES = new Set(['search', 'found', 'draw', 'load']);
const CANCELABLE = new Set(['search', 'found', 'draw']);

const CSS = `
#mt{font-family:'Anton',Impact,'Arial Narrow Bold',sans-serif;color:#fff;-webkit-user-select:none;user-select:none}
#mt *{box-sizing:border-box}
#mt [hidden]{display:none!important}
@keyframes mt-fade{from{opacity:0}to{opacity:1}}
@keyframes mt-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
#mt .mt-tag{display:inline-block;font:800 11px/1 system-ui,sans-serif;letter-spacing:.16em;color:#1d1400;background:#ffe14a;padding:6px 10px 5px;transform:skewX(-10deg);box-shadow:0 2px 0 rgba(0,0,0,.35)}
#mt .mt-title{margin:0;font-weight:400;font-size:clamp(28px,4.6vw,52px);line-height:1;letter-spacing:.04em;transform:skewX(-8deg);text-align:center;
  text-shadow:0 3px 0 #1b4fa8,0 6px 0 #123a80,0 10px 22px rgba(0,0,0,.35)}
#mt .mt-title.gold{color:#ffe14a;text-shadow:0 3px 0 #a87400,0 6px 0 #6e4c00,0 10px 22px rgba(0,0,0,.35)}
#mt .mt-dots i{font-style:normal;animation:mt-dot 1.2s infinite}
#mt .mt-dots i:nth-child(2){animation-delay:.2s}#mt .mt-dots i:nth-child(3){animation-delay:.4s}
@keyframes mt-dot{0%,20%{opacity:.15}50%{opacity:1}100%{opacity:.15}}
#mt .mt-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:10px}
#mt .mt-chip{display:flex;align-items:center;gap:8px;padding:7px 18px 6px;background:rgba(10,22,48,.62);border:2px solid rgba(255,255,255,.14);
  clip-path:polygon(6% 0,100% 0,94% 100%,0 100%);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
#mt .mt-chip small{font:700 10px/1 system-ui,sans-serif;letter-spacing:.14em;color:#9fc2ff}
#mt .mt-chip b{font-weight:400;font-size:19px;letter-spacing:.04em;line-height:1}
#mt .mt-coin{width:18px;height:18px;flex:none;display:block}
#mt .mt-btn{font:inherit;font-size:22px;letter-spacing:.05em;cursor:pointer;border:0;padding:10px 34px 8px;clip-path:polygon(6% 0,100% 0,94% 100%,0 100%);transition:filter .12s,transform .12s}
#mt .mt-btn:hover{filter:brightness(1.1);transform:translateY(-2px)}
#mt .mt-btn:active{transform:translateY(2px)}
#mt .mt-btn:focus-visible{outline:3px solid #fff;outline-offset:-6px}
#mt .mt-btn.pri{color:#2a1c00;background:linear-gradient(180deg,#fff7a8 0%,#ffe437 38%,#ffc800 70%,#f5ad00 100%)}
#mt .mt-btn.ghost{color:#fff;background:rgba(10,22,48,.7);box-shadow:inset 0 0 0 2px rgba(255,255,255,.28)}
#mt .mt-btn kbd{font:700 10px/1 system-ui,sans-serif;letter-spacing:.1em;color:#cfe0ff;border:1px solid rgba(255,255,255,.35);border-radius:4px;padding:3px 5px;margin-left:8px;vertical-align:3px}

/* ---------- szukanie przeciwnika i losowanie mapy (nad lobby) ---------- */
#mt-mm{position:fixed;inset:0;z-index:25;display:flex;align-items:center;justify-content:center;padding:max(20px,env(safe-area-inset-top)) 16px max(20px,env(safe-area-inset-bottom));overflow-y:auto;
  background:radial-gradient(ellipse 80% 70% at 50% 45%,rgba(10,26,62,.62),rgba(4,10,26,.9));backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);animation:mt-fade .3s ease}
#mt-mm.out{opacity:0;transition:opacity .3s ease}
#mt .mt-box{width:min(780px,100%);display:flex;flex-direction:column;align-items:center;gap:clamp(14px,2.6vh,24px);margin:auto}
#mt .mt-head{display:flex;flex-direction:column;align-items:center;gap:12px}
#mt .mt-vs{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:clamp(10px,3vw,34px);width:min(620px,100%)}
#mt .mt-pl{display:flex;flex-direction:column;align-items:center;gap:9px;padding:18px 18px 14px;min-width:0;background:rgba(10,22,48,.62);border:2px solid rgba(255,255,255,.14);
  clip-path:polygon(7% 0,100% 0,93% 100%,0 100%);transition:padding .3s ease,gap .3s ease}
#mt .mt-pl .av{position:relative;width:76px;height:76px;border-radius:16px;display:grid;place-items:center;flex:none;overflow:hidden;
  background:linear-gradient(160deg,#ffd76a,#f0a020);box-shadow:0 6px 18px rgba(0,0,0,.35),inset 0 0 0 2px rgba(255,255,255,.35);transition:width .3s ease,height .3s ease}
#mt .mt-pl .av svg{width:72%;height:72%;display:block;position:relative}
#mt .mt-pl.op .av{background:linear-gradient(160deg,#ff9a88,#d9514c)}
#mt .mt-pl .nm{max-width:100%;font-size:clamp(20px,2.8vw,30px);line-height:1.05;letter-spacing:.03em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transform:skewX(-6deg)}
#mt .mt-pl small{font:700 10px/1 system-ui,sans-serif;letter-spacing:.16em;color:#9fc2ff}
#mt .mt-pl.me small{color:#ffe14a}
#mt .mt-vsx{font-size:clamp(34px,5vw,58px);line-height:1;color:#ffe14a;transform:skewX(-8deg);text-shadow:0 3px 0 #a87400,0 8px 18px rgba(0,0,0,.45)}
#mt .mt-pl.op.searching .av{background:radial-gradient(circle,#173068 0%,#0b1838 70%)}
#mt .mt-pl.op.searching .av svg{opacity:0}
#mt .mt-pl.op .q{position:absolute;inset:0;display:none;place-items:center;font-weight:400;font-size:38px;color:#cfe0ff;text-shadow:0 0 14px rgba(120,170,255,.6)}
#mt .mt-pl.op.searching .q{display:grid}
#mt .mt-pl.op .radar{position:absolute;inset:0;display:none}
#mt .mt-pl.op.searching .radar{display:block}
#mt .mt-pl.op .radar::before,#mt .mt-pl.op .radar::after{content:"";position:absolute;left:50%;top:50%;width:100%;height:100%;margin:-50% 0 0 -50%;border-radius:50%;
  border:2px solid rgba(159,194,255,.75);animation:mt-ping 1.6s ease-out infinite}
#mt .mt-pl.op .radar::after{animation-delay:.8s}
@keyframes mt-ping{from{transform:scale(.15);opacity:1}to{transform:scale(1.25);opacity:0}}
#mt .mt-pl.op.searching .nm{opacity:.45}
#mt .mt-pl.op.found{animation:mt-found .55s cubic-bezier(.2,.9,.25,1.3)}
@keyframes mt-found{0%{transform:scale(.9);filter:brightness(2.2)}60%{transform:scale(1.05)}100%{transform:none;filter:none}}
#mt .mt-vs.compact .mt-pl{padding:10px 16px 9px;gap:6px}
#mt .mt-vs.compact .mt-pl .av{width:46px;height:46px;border-radius:11px}
#mt .mt-maps{display:grid;grid-template-columns:repeat(var(--n,3),minmax(0,220px));gap:clamp(10px,2vw,18px);justify-content:center;width:100%;animation:mt-rise .35s ease}
#mt .mt-map{position:relative;aspect-ratio:16/10;border-radius:10px;overflow:hidden;background:#0c1630 center/cover no-repeat;
  box-shadow:0 0 0 3px rgba(255,255,255,.16),0 10px 24px rgba(0,0,0,.45);transition:transform .12s ease,box-shadow .12s ease,filter .35s ease,opacity .35s ease}
#mt .mt-map::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(4,8,24,0) 45%,rgba(4,8,24,.72) 100%)}
#mt .mt-map span{position:absolute;left:12px;right:10px;bottom:8px;z-index:1;font-size:clamp(20px,2.6vw,30px);line-height:1;letter-spacing:.03em;text-transform:uppercase;
  transform:skewX(-8deg);transform-origin:left bottom;text-shadow:0 3px 0 rgba(0,0,0,.45);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#mt .mt-map.on{transform:translateY(-4px);box-shadow:0 0 0 3px #fff,0 14px 28px rgba(0,0,0,.5)}
#mt .mt-map.sel{transform:translateY(-6px) scale(1.06);box-shadow:0 0 0 4px #fff,0 0 0 8px rgba(255,225,74,.9),0 0 40px 10px rgba(255,214,60,.35),0 18px 34px rgba(0,0,0,.55)}
#mt .mt-maps.done .mt-map:not(.sel){filter:grayscale(.85) brightness(.55);opacity:.6;transform:scale(.95)}
#mt .mt-foot{display:flex;flex-direction:column;align-items:center;gap:12px;min-height:70px}
#mt .mt-timer{font-size:24px;letter-spacing:.08em;color:#cfe0ff;font-variant-numeric:tabular-nums}
#mt .mt-load{display:flex;flex-direction:column;align-items:center;gap:10px;animation:mt-rise .3s ease}
#mt .mt-lbl{font:800 11px/1 system-ui,sans-serif;letter-spacing:.2em;color:#9fc2ff}
#mt .mt-lbl.ok{color:#5ff08a}
#mt .mt-bar{width:min(440px,78vw);height:8px;border-radius:4px;background:rgba(255,255,255,.12);overflow:hidden}
#mt .mt-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#ffe14a,#ffc800);box-shadow:0 0 12px rgba(255,214,60,.7)}
#mt .mt-ready{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
#mt .mt-ready span{display:flex;align-items:center;gap:7px;font:700 11px/1 system-ui,sans-serif;letter-spacing:.12em;color:#9fc2ff;padding:7px 12px;border-radius:6px;background:rgba(10,22,48,.62);border:1px solid rgba(255,255,255,.12)}
#mt .mt-ready span::before{content:"";width:8px;height:8px;border-radius:50%;background:#9aa7c0;animation:mt-dot 1s infinite}
#mt .mt-ready span.ok{color:#fff;border-color:rgba(95,240,138,.5)}
#mt .mt-ready span.ok::before{background:#5ff08a;animation:none;box-shadow:0 0 8px #5ff08a}

/* ---------- w grze ---------- */
#mt-dim{position:fixed;inset:0;z-index:3;pointer-events:none;opacity:0;transition:opacity .35s ease;
  background:radial-gradient(ellipse 75% 65% at 50% 50%,rgba(4,10,26,.08),rgba(4,10,26,.62))}
#mt-dim.on{opacity:1}
#mt-hud{position:fixed;left:50%;top:max(12px,env(safe-area-inset-top));transform:translateX(-50%);z-index:3;pointer-events:none;display:none;align-items:stretch;
  filter:drop-shadow(0 6px 14px rgba(0,0,0,.35))}
#mt-hud.on{display:flex;animation:mt-fade .3s ease}
#mt-hud .side{display:flex;flex-direction:column;justify-content:center;gap:5px;padding:6px 14px 6px;min-width:0;background:rgba(10,22,48,.66);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
#mt-hud .side.me{align-items:flex-end;padding-left:22px;clip-path:polygon(14px 0,100% 0,100% 100%,0 100%)}
#mt-hud .side.op{align-items:flex-start;padding-right:22px;clip-path:polygon(0 0,100% 0,calc(100% - 14px) 100%,0 100%)}
#mt-hud .nm{font-size:16px;line-height:1;letter-spacing:.04em;max-width:24vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#mt-hud .side.me .nm{color:#ffe14a}
#mt-hud .sc{min-width:46px;display:grid;place-items:center;font-weight:400;font-size:30px;line-height:1;color:#2a1c00;padding:4px 8px 2px;background:linear-gradient(180deg,#fff7a8,#ffd400 60%,#f5ad00)}
#mt-hud .sc.op{color:#fff;background:linear-gradient(180deg,#ff9a88,#e5432f)}
#mt-hud .sc.bump{animation:mt-bump .5s ease}
@keyframes mt-bump{0%{transform:scale(1)}30%{transform:scale(1.25);filter:brightness(1.4)}100%{transform:scale(1)}}
#mt-hud .mid{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:4px 12px;background:rgba(6,14,32,.88)}
#mt-hud .mid small{font:700 9px/1 system-ui,sans-serif;letter-spacing:.16em;color:#9fc2ff}
#mt-hud .mid b{font-weight:400;font-size:20px;line-height:1}
#mt .pips{display:flex;gap:5px}
#mt .pips u{display:block;width:16px;height:6px;transform:skewX(-20deg);background:rgba(255,255,255,.2)}
#mt .me .pips u.f{background:#ffe14a;box-shadow:0 0 6px rgba(255,214,60,.7)}
#mt .op .pips u.f{background:#ff6a55;box-shadow:0 0 6px rgba(255,90,77,.7)}
#mt-count{position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);z-index:4;pointer-events:none;text-align:center;display:none}
#mt-count.on{display:block}
#mt-count small{display:block;font:800 13px/1 system-ui,sans-serif;letter-spacing:.24em;color:#cfe0ff;text-shadow:0 2px 8px rgba(0,0,0,.6);margin-bottom:6px}
#mt-count b{display:block;font-weight:400;font-size:clamp(96px,15vw,170px);line-height:1;letter-spacing:.02em;opacity:0;
  text-shadow:0 4px 0 #1b4fa8,0 8px 0 #123a80,0 16px 34px rgba(0,0,0,.5)}
#mt-count b.pop{animation:mt-pop .8s ease-out forwards}
#mt-count b.go{color:#ffe14a;text-shadow:0 4px 0 #a87400,0 8px 0 #6e4c00,0 16px 34px rgba(0,0,0,.5);animation:mt-pop .9s ease-out forwards}
@keyframes mt-pop{0%{opacity:0;transform:skewX(-8deg) scale(1.9)}22%{opacity:1;transform:skewX(-8deg) scale(1)}78%{opacity:1;transform:skewX(-8deg) scale(1)}100%{opacity:0;transform:skewX(-8deg) scale(.92)}}
#mt-strip{position:fixed;left:0;right:0;top:50%;z-index:4;pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:clamp(10px,2vh,16px);
  padding:clamp(20px,4vh,34px) 16px;transform:translateY(-50%);opacity:0;visibility:hidden;transition:opacity .3s ease,visibility 0s .3s;--acc:#ffe14a;
  background:linear-gradient(90deg,rgba(6,14,32,0) 0%,rgba(6,14,32,.84) 20%,rgba(6,14,32,.84) 80%,rgba(6,14,32,0) 100%)}
#mt-strip::before,#mt-strip::after{content:"";position:absolute;left:8%;right:8%;height:2px;background:linear-gradient(90deg,transparent,var(--acc),transparent)}
#mt-strip::before{top:0}#mt-strip::after{bottom:0}
#mt-strip.on{opacity:1;visibility:visible;transition:opacity .2s ease;animation:mt-strip .5s cubic-bezier(.2,.9,.25,1.15)}
#mt-strip.loss{--acc:#ff5a4d}
#mt-strip.on.final{pointer-events:auto}
@keyframes mt-strip{from{transform:translateY(-50%) scaleY(.15)}to{transform:translateY(-50%) scaleY(1)}}
#mt-strip > *{animation:mt-rise .45s ease both}
#mt-strip > :nth-child(2){animation-delay:.06s}#mt-strip > :nth-child(3){animation-delay:.12s}#mt-strip > :nth-child(4){animation-delay:.18s}#mt-strip > :nth-child(5){animation-delay:.24s}
#mt .mt-sub{font:800 12px/1 system-ui,sans-serif;letter-spacing:.24em;color:#cfe0ff}
#mt .mt-big{font-size:clamp(58px,10.5vw,124px);line-height:1;letter-spacing:.03em;padding:.16em .08em .06em;margin:-.2em 0 -.1em;transform:skewX(-8deg);
  background:linear-gradient(180deg,#fff7a8 0%,#ffe437 40%,#ffc800 68%,#f5ad00 100%);-webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 4px 0 #a87400) drop-shadow(0 14px 26px rgba(0,0,0,.5))}
#mt-strip.loss .mt-big{background-image:linear-gradient(180deg,#ffd9d2 0%,#ff8a70 42%,#f0503a 70%,#c92f22 100%);filter:drop-shadow(0 4px 0 #6e140c) drop-shadow(0 14px 26px rgba(0,0,0,.5))}
#mt .mt-score{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto minmax(0,1fr);align-items:center;gap:clamp(10px,2.4vw,22px);width:min(640px,100%)}
#mt .mt-score > div{display:flex;flex-direction:column;gap:6px;min-width:0}
#mt .mt-score > div.me{align-items:flex-end}#mt .mt-score > div.op{align-items:flex-start}
#mt .mt-score .nm{max-width:100%;font-size:clamp(18px,2.6vw,26px);line-height:1;letter-spacing:.03em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#mt .mt-score .me .nm{color:#ffe14a}#mt .mt-score .op .nm{color:#ff9a88}
#mt .mt-score b{font-weight:400;font-size:clamp(44px,6vw,66px);line-height:1;transform:skewX(-8deg)}
#mt .mt-score b.lead{color:#fff;text-shadow:0 0 20px rgba(255,255,255,.35)}
#mt .mt-score b:not(.lead){color:rgba(255,255,255,.62)}
#mt .mt-score i{font-style:normal;font-size:clamp(30px,4vw,44px);color:rgba(255,255,255,.4)}
#mt .mt-note{font:700 12px/1.3 system-ui,sans-serif;letter-spacing:.16em;color:#9fc2ff;text-align:center}
#mt .mt-vsrow{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:clamp(14px,3vw,30px);width:min(680px,100%)}
#mt .mt-vsrow > div{display:flex;flex-direction:column;gap:6px;min-width:0}
#mt .mt-vsrow > div.me{align-items:flex-end;text-align:right}#mt .mt-vsrow > div.op{align-items:flex-start}
#mt .mt-vsrow .nm{max-width:100%;font-size:clamp(28px,4.6vw,52px);line-height:1;letter-spacing:.03em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transform:skewX(-8deg)}
#mt .mt-vsrow .me .nm{color:#ffe14a;text-shadow:0 3px 0 #a87400,0 8px 18px rgba(0,0,0,.4)}
#mt .mt-vsrow .op .nm{text-shadow:0 3px 0 #a3241a,0 8px 18px rgba(0,0,0,.4)}
#mt .mt-vsrow small{font:700 10px/1 system-ui,sans-serif;letter-spacing:.16em;color:#9fc2ff}
#mt .mt-clickhint{display:none;font:800 13px/1 system-ui,sans-serif;letter-spacing:.2em;color:#ffe14a;animation:mt-dot 1.6s infinite!important}
#mt.needclick .mt-clickhint{display:block}
#mt .mt-prize{display:flex;align-items:center;gap:10px;font-size:34px;line-height:1;letter-spacing:.03em;transform:skewX(-8deg)}
#mt .mt-prize .mt-coin{width:28px;height:28px}
#mt .mt-prize small{font:700 10px/1 system-ui,sans-serif;letter-spacing:.16em;color:#9fc2ff;transform:skewX(8deg)}
#mt .mt-prize.plus b{color:#ffe14a}#mt .mt-prize.minus b{color:#ff8a70}
#mt .mt-actions{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:4px}
#mt-catch{position:fixed;inset:0;z-index:4;cursor:pointer;display:none}
#mt.needclick #mt-catch{display:block}
#mt-curtain{position:fixed;inset:0;z-index:30;pointer-events:none;opacity:0;transition:opacity .35s ease;background:#071330}
#mt-curtain.on{opacity:1}
body.mt-dead canvas{filter:saturate(.2) brightness(.78) contrast(1.06);transition:filter .6s ease}
body canvas{transition:filter .4s ease}
@media (max-height:620px){
  #mt .mt-pl .av{width:58px;height:58px}
  #mt .mt-vs.compact .mt-pl .av{width:38px;height:38px}
}
`;

// moneta Solany (płatność w SOL, kwoty w USD) jak w portfelu lobby
const COIN = '<svg class="mt-coin" viewBox="0 0 20 20" aria-hidden="true"><defs><linearGradient id="mtusdt" x1="361" y1="-37" x2="141" y2="383" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#00ffa3"/><stop offset="1" stop-color="#dc1fff"/></linearGradient></defs>'
  + '<circle cx="10" cy="10" r="9.4" fill="#0d1019" stroke="rgba(255,255,255,.18)" stroke-width=".8"/><g transform="translate(4.6 5.7) scale(.0272)" fill="url(#mtusdt)">'
  + '<path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1z"/><path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1z"/>'
  + '<path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1z"/></g></svg>';   // logo Solany
const BEAN = visor => `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="13" y="4" width="22" height="40" rx="11" fill="#fff6dc"/>`
  + `<rect x="17" y="13" width="14" height="7.5" rx="3.75" fill="${visor}"/><ellipse cx="19" cy="10.5" rx="2.4" ry="3.6" fill="#fff" opacity=".7"/></svg>`;

const HTML = `
<div id="mt-mm" hidden><div class="mt-box">
  <div class="mt-head"><span class="mt-tag">TRYB 1 NA 1</span><h2 class="mt-title" id="mt-title"></h2>
    <div class="mt-chips"><span class="mt-chip" id="mt-stakechip"><small>STAWKA</small>${COIN}<b id="mt-stake"></b></span><span class="mt-chip"><small>RUNDY</small><b>DO ${ROUNDS_TO_WIN} WYGRANYCH</b></span></div></div>
  <div class="mt-vs" id="mt-vs">
    <div class="mt-pl me"><div class="av">${BEAN('#5a3500')}</div><span class="nm" id="mt-me"></span><small>TY</small></div>
    <div class="mt-vsx">VS</div>
    <div class="mt-pl op" id="mt-opcard"><div class="av"><i class="radar"></i>${BEAN('#6e140c')}<b class="q">?</b></div><span class="nm" id="mt-op"></span><small id="mt-opst"></small></div>
  </div>
  <div class="mt-maps" id="mt-maps" hidden></div>
  <div class="mt-foot">
    <div class="mt-timer" id="mt-timer">0:00</div>
    <div class="mt-load" id="mt-load" hidden><small class="mt-lbl" id="mt-lbl"></small><div class="mt-bar"><i id="mt-bar"></i></div><div class="mt-ready"><span id="mt-rme"></span><span id="mt-rop"></span></div></div>
    <button class="mt-btn ghost" id="mt-cancel" type="button">ANULUJ<kbd>ESC</kbd></button>
  </div>
</div></div>
<div id="mt-dim"></div>
<div id="mt-hud">
  <div class="side me"><span class="nm" id="mt-hme"></span><span class="pips" id="mt-hpme"></span></div>
  <b class="sc me" id="mt-hsme">0</b>
  <div class="mid"><small>RUNDA</small><b id="mt-hround">1</b></div>
  <b class="sc op" id="mt-hsop">0</b>
  <div class="side op"><span class="nm" id="mt-hop"></span><span class="pips" id="mt-hpop"></span></div>
</div>
<div id="mt-count"><small id="mt-cround"></small><b id="mt-cnum"></b></div>
<div id="mt-strip"></div>
<div id="mt-catch" title="Kliknij, aby zacząć"></div>
<div id="mt-curtain"></div>`;

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pipsHtml = n => Array.from({ length: ROUNDS_TO_WIN }, (_, i) => `<u class="${i < n ? 'f' : ''}"></u>`).join('');
const rand = (a, b) => a + Math.random() * (b - a);
// tło karty mapy, zanim gotowa jest miniatura z silnika
const MAP_TINT = { oaza: ['#ffd27a', '#d9783a'], magazyn: ['#a9bdd4', '#46597a'], baza: ['#c3cf8e', '#56663a'] };
function mapFallback(name) {
  const k = name.toLowerCase(), c = MAP_TINT[k] || ['#7fb0ff', '#2a4a8a'];
  return `linear-gradient(160deg,${c[0]},${c[1]})`;
}

/**
 * Haki gry (g):
 *  money(v)         – zapis kwoty, np. "$10,00" (stawka przychodzi z lobby w start({map, stake}))
 *  prize(stake)     – wypłata za wygrany mecz (pula minus prowizja lobby)
 *  matchEnd(won)    – koniec meczu: lobby rozlicza stawkę (zdarzenie fasolka:match)
 *  again()          – „GRAJ DALEJ”: powrót do lobby i GRAJ (nowa stawka, losowanie mapy w lobby)
 *  maps()           – [{name, ready, thumb}] wszystkie mapy z rotacji 1v1
 *  mapsSettled()    – true, gdy ładowanie map się zakończyło (także z błędem)
 *  nick()           – nick gracza z lobby
 *  enterGame(i)     – przejście z lobby do gry na mapie i (-1 = arena zastępcza)
 *  resetRound()     – obaj gracze na spawn, pełne HP i amunicja
 *  release()        – pauza bez nakładki + zwolnienie kursora (ekran końca meczu)
 *  lock()           – przechwycenie kursora i dźwięk (wołać w obsłudze kliknięcia)
 *  resume()         – wznowienie gry po kliknięciu (jak klik w nakładkę pauzy)
 *  toLobbyScene()   – gra znika, w tle znowu scena lobby (bez jego menu)
 *  exitToLobby()    – pełny powrót do lobby
 *  sfx(name)        – dźwięki: tick, found, select, count, go, win, lose
 */
export function createMatch(g) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const root = document.createElement('div'); root.id = 'mt'; root.innerHTML = HTML; document.body.appendChild(root);
  const $ = id => root.querySelector('#' + id);
  const mm = $('mt-mm'), vs = $('mt-vs'), opCard = $('mt-opcard'), mapsEl = $('mt-maps'), title = $('mt-title');
  const strip = $('mt-strip'), hud = $('mt-hud'), dim = $('mt-dim'), count = $('mt-count'), curtain = $('mt-curtain');

  const S = { me: 0, op: 0, round: 1, nick: 'Gracz', opp: '', mapIdx: -1, mapName: '', stake: 0, preset: null };
  let opts = {};                             // z lobby: { map: nazwa wylosowanej mapy, stake: stawka pobrana z portfela }
  const money = v => g.money ? g.money(v) : String(v);
  const stakeChip = () => S.stake ? `<span class="mt-chip"><small>STAWKA</small>${COIN}<b>${esc(money(S.stake))}</b></span>` : '';
  let phase = 'idle', t = 0, frozen = false, lastWinner = null;
  let searchDur = 3, nameT = 0, oppReadyT = 1, countN = 0, curtainT = -1, roul = null, drawDone = -1, switched = false;

  const sfx = n => { try { g.sfx(n); } catch (e) {} };
  function setTitle(html, gold) { title.innerHTML = html; title.classList.toggle('gold', !!gold); }
  function showStrip(cls, html) {
    strip.className = ''; strip.innerHTML = html; void strip.offsetWidth; strip.className = 'on ' + cls;
  }
  const hideStrip = () => { strip.classList.remove('on'); };
  function renderHud(bump) {
    $('mt-hme').textContent = S.nick; $('mt-hop').textContent = S.opp;
    $('mt-hpme').innerHTML = pipsHtml(S.me); $('mt-hpop').innerHTML = pipsHtml(S.op);
    $('mt-hround').textContent = S.round;
    const a = $('mt-hsme'), b = $('mt-hsop'); a.textContent = S.me; b.textContent = S.op;
    if (bump) { const el = bump === 'me' ? a : b; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  }
  function scoreRow() {
    return `<div class="mt-score"><div class="me"><span class="nm">${esc(S.nick)}</span><span class="pips">${pipsHtml(S.me)}</span></div>`
      + `<b class="${S.me >= S.op ? 'lead' : ''}">${S.me}</b><i>:</i><b class="${S.op >= S.me ? 'lead' : ''}">${S.op}</b>`
      + `<div class="op"><span class="nm">${esc(S.opp)}</span><span class="pips">${pipsHtml(S.op)}</span></div></div>`;
  }
  function setCount(txt, go) {
    const b = $('mt-cnum'); b.textContent = txt; b.className = ''; void b.offsetWidth; b.className = go ? 'go' : 'pop';
  }
  const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

  // ---------- fazy ----------
  function go(p) { phase = p; t = 0; (ENTER[p] || (() => {}))(); }
  const ENTER = {
    search() {
      Object.assign(S, { me: 0, op: 0, round: 1, nick: g.nick(), opp: '', mapIdx: -1, mapName: '', stake: +opts.stake > 0 ? +opts.stake : 0, preset: opts.map || null });
      frozen = false; lastWinner = null; switched = false; roul = null; drawDone = -1;
      root.classList.remove('needclick');
      mm.hidden = false; mm.classList.remove('out'); vs.classList.remove('compact'); mapsEl.hidden = true; mapsEl.classList.remove('done');
      $('mt-stakechip').hidden = !S.stake; $('mt-stake').textContent = S.stake ? money(S.stake) : '';
      $('mt-load').hidden = true; $('mt-timer').hidden = false;
      $('mt-cancel').hidden = !!S.stake;     // stawka jest już pobrana z portfela – szukania nie da się przerwać
      setTitle('SZUKANIE PRZECIWNIKA<span class="mt-dots"><i>.</i><i>.</i><i>.</i></span>');
      $('mt-me').textContent = S.nick;
      opCard.className = 'mt-pl op searching'; $('mt-op').textContent = '???'; $('mt-opst').textContent = 'SZUKANIE';
      searchDur = rand(2.4, 4.8); nameT = 0;
    },
    found() {
      const pool = OPP_NAMES.filter(n => n.toLowerCase() !== S.nick.toLowerCase());
      S.opp = pool[Math.floor(Math.random() * pool.length)];
      $('mt-op').textContent = S.opp; $('mt-opst').textContent = 'PRZECIWNIK';
      opCard.className = 'mt-pl op'; void opCard.offsetWidth; opCard.classList.add('found');
      setTitle('PRZECIWNIK ZNALEZIONY', true); sfx('found');
    },
    draw() {
      setTitle('LOSOWANIE MAPY<span class="mt-dots"><i>.</i><i>.</i><i>.</i></span>');
      vs.classList.add('compact'); $('mt-timer').hidden = true;
      const maps = g.maps(); mapsEl.innerHTML = ''; mapsEl.style.setProperty('--n', Math.max(1, maps.length));
      maps.forEach(m => { const d = document.createElement('div'); d.className = 'mt-map'; d.style.backgroundImage = m.thumb ? `url("${m.thumb}")` : mapFallback(m.name);
        const s = document.createElement('span'); s.textContent = m.name; d.appendChild(s); mapsEl.appendChild(d); });
      mapsEl.hidden = maps.length === 0;
    },
    load() {
      if (S.preset) {                        // mapa wylosowana już w lobby: pokazujemy tylko jej kartę
        const maps = g.maps(), i = maps.findIndex(m => m.name.toLowerCase() === String(S.preset).toLowerCase());
        S.mapIdx = i; S.mapName = i >= 0 ? maps[i].name : String(S.preset);
        vs.classList.add('compact'); $('mt-timer').hidden = true;
        mapsEl.innerHTML = ''; mapsEl.style.setProperty('--n', 1);
        const d = document.createElement('div'); d.className = 'mt-map sel'; const m = maps[i];
        d.style.backgroundImage = m && m.thumb ? `url("${m.thumb}")` : mapFallback(S.mapName);
        const s = document.createElement('span'); s.textContent = S.mapName; d.appendChild(s); mapsEl.appendChild(d);
        mapsEl.classList.add('done'); mapsEl.hidden = false; sfx('select');
      }
      $('mt-cancel').hidden = true; $('mt-load').hidden = false; $('mt-bar').style.width = '0%';
      $('mt-lbl').textContent = 'WCZYTYWANIE GRACZY'; $('mt-lbl').className = 'mt-lbl';
      const rme = $('mt-rme'), rop = $('mt-rop'); rme.textContent = S.nick.toUpperCase(); rop.textContent = S.opp.toUpperCase(); rme.className = rop.className = '';
      setTitle('MAPA: ' + esc(S.mapName.toUpperCase()), true);
      oppReadyT = rand(.7, 1.5); curtainT = -1;
    },
    intro() {
      frozen = true; mm.hidden = true; g.resetRound();
      renderHud(); hud.classList.add('on'); dim.classList.add('on'); document.body.classList.add('mt-on');
      showStrip('intro', `<span class="mt-tag">MECZ 1 NA 1</span>
        <div class="mt-vsrow"><div class="me"><span class="nm">${esc(S.nick)}</span><small>TY</small></div><div class="mt-vsx">VS</div><div class="op"><span class="nm">${esc(S.opp)}</span><small>PRZECIWNIK</small></div></div>
        <div class="mt-chips"><span class="mt-chip"><small>MAPA</small><b>${esc(S.mapName.toUpperCase())}</b></span>${stakeChip()}<span class="mt-chip"><small>RUNDY</small><b>DO ${ROUNDS_TO_WIN} WYGRANYCH</b></span></div>
        <div class="mt-clickhint">KLIKNIJ, ABY ZACZĄĆ</div>`);
    },
    count() {
      frozen = true; hideStrip(); dim.classList.remove('on'); renderHud();
      $('mt-cround').textContent = 'RUNDA ' + S.round + (S.me === ROUNDS_TO_WIN - 1 && S.op === ROUNDS_TO_WIN - 1 ? ' · DECYDUJĄCA' : '');
      count.classList.add('on'); countN = 3; setCount('3'); sfx('count');
    },
    live() { frozen = false; },
    killcam() { frozen = true; },
    result() {
      const won = lastWinner === 'me', k = ROUNDS_TO_WIN - S.me;
      const note = S.me === ROUNDS_TO_WIN - 1 && S.op === ROUNDS_TO_WIN - 1 ? 'NASTĘPNA RUNDA ROZSTRZYGA MECZ'
        : `DO WYGRANIA MECZU BRAKUJE CI ${k} ${k === 1 ? 'RUNDY' : 'RUND'}`;
      dim.classList.add('on'); curtainT = -1;
      showStrip(won ? 'win' : 'loss', `<span class="mt-sub">RUNDA ${S.round}</span><div class="mt-big">${won ? 'ZWYCIĘSTWO' : 'PORAŻKA'}</div>${scoreRow()}<span class="mt-note">${note}</span>`);
      sfx(won ? 'win' : 'lose');
    },
    final() {
      const won = S.me > S.op; frozen = true; g.release(); dim.classList.add('on');
      if (g.matchEnd) g.matchEnd(won);       // lobby rozlicza stawkę w portfelu
      const prize = !S.stake ? '' : won
        ? `<div class="mt-prize plus"><small>WYGRANA</small>${COIN}<b>+${esc(money(g.prize ? g.prize(S.stake) : S.stake * 2))}</b></div>`
        : `<div class="mt-prize minus"><small>STAWKA</small>${COIN}<b>−${esc(money(S.stake))}</b></div>`;
      showStrip((won ? 'win' : 'loss') + ' final', `<span class="mt-sub">KONIEC MECZU · ${esc(S.mapName.toUpperCase())}</span><div class="mt-big">${won ? 'ZWYCIĘSTWO' : 'PORAŻKA'}</div>${scoreRow()}
        ${prize}
        <div class="mt-actions"><button class="mt-btn pri" type="button" data-a="again">GRAJ DALEJ</button><button class="mt-btn ghost" type="button" data-a="lobby">LOBBY</button></div>`);
      sfx(won ? 'win' : 'lose');
    },
  };

  function startRoulette() {
    const maps = g.maps(), n = maps.length, ready = maps.map((m, i) => m.ready ? i : -1).filter(i => i >= 0);
    if (!ready.length) { S.mapIdx = -1; S.mapName = 'Arena'; drawDone = 0; return; }   // żadna mapa się nie wczytała: arena zastępcza
    const chosen = ready[Math.floor(Math.random() * ready.length)];
    S.mapIdx = chosen; S.mapName = maps[chosen].name;
    let cur = Math.floor(Math.random() * n); const steps = [];
    const total = n * Math.max(2, Math.ceil(9 / n)) + ((chosen - cur + n) % n);
    for (let k = 0; k < total; k++) { cur = (cur + 1) % n; steps.push(cur); }
    const delays = steps.map((_, i) => .05 + .44 * Math.pow(i / Math.max(1, total - 1), 2.6));
    roul = { steps, delays, i: -1, acc: 0 };
  }
  function stepRoulette(dt) {
    roul.acc += dt;
    const cards = mapsEl.children, maps = g.maps();
    while (roul.i < roul.steps.length - 1 && roul.acc >= (roul.i < 0 ? 0 : roul.delays[roul.i])) {
      roul.acc -= roul.i < 0 ? 0 : roul.delays[roul.i]; roul.i++;
      for (const c of cards) c.classList.remove('on');
      const idx = roul.steps[roul.i], card = cards[idx];
      if (card) { card.classList.add('on'); if (maps[idx] && maps[idx].thumb && !card.dataset.th) { card.dataset.th = 1; card.style.backgroundImage = `url("${maps[idx].thumb}")`; } }
      sfx('tick');
    }
    if (roul.i >= roul.steps.length - 1 && roul.acc >= .25) {
      for (const c of cards) c.classList.remove('on');
      if (cards[S.mapIdx]) cards[S.mapIdx].classList.add('sel');
      mapsEl.classList.add('done'); setTitle('MAPA: ' + esc(S.mapName.toUpperCase()), true); sfx('select');
      roul = null; drawDone = 0;
    }
  }

  const TICK = {
    search() {
      $('mt-timer').textContent = fmt(t);
      nameT -= DT; if (nameT <= 0) { nameT = .09; $('mt-op').textContent = OPP_NAMES[Math.floor(Math.random() * OPP_NAMES.length)]; }
      if (t >= searchDur) go('found');
    },
    found() { if (t >= 1.3) go(S.preset ? 'load' : 'draw'); },
    draw() {
      if (drawDone >= 0) { drawDone += DT; if (drawDone >= 1.2) go('load'); return; }
      if (!roul) { if (t >= .45 && (g.maps().some(m => m.ready) || g.mapsSettled())) startRoulette(); return; }
      stepRoulette(DT);
    },
    load() {
      const M = S.mapIdx >= 0 ? g.maps()[S.mapIdx] : null, mready = !M || M.ready || g.mapsSettled();   // mapa z lobby mogła się jeszcze nie wczytać
      const p = Math.min(mready ? 1 : .9, t / 1.6); $('mt-bar').style.width = (p * 100).toFixed(1) + '%';
      if (t >= .45 && mready) $('mt-rme').className = 'ok';
      if (t >= oppReadyT) $('mt-rop').className = 'ok';
      if (!mready) { t = Math.min(t, 1.5); return; }
      if (t >= Math.max(.45, oppReadyT) && t >= 1.6 && !$('mt-lbl').classList.contains('ok')) { $('mt-lbl').textContent = 'OBAJ GRACZE GOTOWI'; $('mt-lbl').classList.add('ok'); }
      if (t >= 1.9 && curtainT < 0) { curtainT = 0; curtain.classList.add('on'); }
      if (curtainT >= 0) { curtainT += DT; if (curtainT >= .4) { g.enterGame(S.mapIdx); go('intro'); curtain.classList.remove('on'); } }
    },
    intro() { if (t >= 4.4) go('count'); },
    count() {
      const n = 3 - Math.floor(t / .8);
      if (n !== countN && n > 0) { countN = n; setCount(String(n)); sfx('count'); }
      if (t >= 2.4) { countN = 0; setCount('WALCZ!', true); sfx('go'); go('live'); }
    },
    live() { if (t >= 1 && count.classList.contains('on')) count.classList.remove('on'); },
    killcam() {
      if (t >= 1.0) go(S.me >= ROUNDS_TO_WIN || S.op >= ROUNDS_TO_WIN ? 'final' : 'result');
    },
    result() {
      if (t >= 3.1 && curtainT < 0) { curtainT = 0; curtain.classList.add('on'); }
      if (curtainT >= 0) {
        curtainT += DT;
        if (curtainT >= .4 && curtainT < 1) { curtainT = 1; S.round++; hideStrip(); g.resetRound(); go('count'); curtain.classList.remove('on'); }
      }
    },
  };
  let DT = 0, hold = false;

  function update(dt, paused) {
    if (phase === 'idle') return;
    const inGame = !LOBBY_PHASES.has(phase);
    root.classList.toggle('needclick', phase === 'intro' && paused);
    if ((inGame && paused) || hold) return;  // pauza (Esc) zatrzymuje plansze i odliczanie; hold = testy
    DT = dt; t += dt;
    (TICK[phase] || (() => {}))();
  }
  function hideAll() {
    mm.hidden = true; hideStrip(); hud.classList.remove('on'); dim.classList.remove('on'); count.classList.remove('on');
    curtain.classList.remove('on'); root.classList.remove('needclick'); document.body.classList.remove('mt-on');
  }
  function abort() { phase = 'idle'; frozen = false; roul = null; hideAll(); }
  const cancelable = () => CANCELABLE.has(phase) && !S.stake;   // mecz o stawkę: stawka już pobrana, bez anulowania
  function cancel() { if (!cancelable()) return; abort(); g.exitToLobby(); }

  $('mt-cancel').addEventListener('click', cancel);
  $('mt-catch').addEventListener('click', () => { if (phase === 'intro') g.resume(); });
  strip.addEventListener('click', e => {
    const a = e.target.closest('[data-a]'); if (!a || phase !== 'final') return;
    if (a.dataset.a !== 'again') { abort(); g.exitToLobby(); }
    else if (g.again) { abort(); g.again(); }            // nowa stawka i losowanie mapy przez lobby
    else { g.lock(); hideAll(); g.toLobbyScene(); opts = {}; go('search'); }
  });
  addEventListener('keydown', e => { if (e.key === 'Escape' && cancelable()) { e.stopPropagation(); cancel(); } }, true);

  return {
    // o = { map, stake } z lobby; bez mapy mecz sam ją losuje
    start(o) { opts = o || {}; hideAll(); go('search'); },
    abort, cancel, update,
    // zabójstwo kończy rundę: 'me' = gracz wygrał rundę, 'op' = przeciwnik
    kill(w) {
      if (phase !== 'live') return false;
      lastWinner = w; if (w === 'me') S.me++; else S.op++;
      renderHud(w); count.classList.remove('on'); go('killcam'); return true;
    },
    get frozen() { return frozen; },
    get phase() { return phase; },
    get lobbyPhase() { return LOBBY_PHASES.has(phase); },
    get cancelable() { return cancelable(); },
    get on() { return phase !== 'idle' && !LOBBY_PHASES.has(phase); },
    get state() { return { ...S, phase, t }; },
    // tylko do testów: zatrzymanie bieżącej fazy
    get hold() { return hold; }, set hold(v) { hold = !!v; },
  };
}
