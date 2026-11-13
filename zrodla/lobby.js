// Lobby z fasolką: niebo, chmury, las i góry w tle, trawiasta ziemia, duży przycisk GRAJ.
// Użycie: createLobby({renderer, bean, animate, onPlay(modeId, {map, stake}), onSkin, modes}) – bean to THREE.Object3D ~1,5 m, przodem do -Z.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildVillage } from './village.js';
import { buildBattlefield } from './battlefield.js';
import { buildHangar } from './hangar.js';
import { initLobbyUI, t as tr, skinName } from './lobby-ui.js';
import CUSTOM_SKINS from './skins-data.js';

const CSS = `
#lb-ui{--bg:rgba(10,14,24,.72);--bg2:rgba(14,19,32,.97);--line:rgba(255,255,255,.08);--line2:rgba(255,255,255,.15);--tx:#eef1f7;--mut:#8e9ab0;
  --acc:#ffc629;--acc2:#ff9f0a;--ok:#34d27f;--err:#ff5d5d;--r:12px;
  position:fixed;inset:0;z-index:20;pointer-events:none;font:500 14px/1.45 Inter,system-ui,-apple-system,'Segoe UI',sans-serif;color:var(--tx);
  transition:opacity .35s ease;-webkit-user-select:none;user-select:none;-webkit-font-smoothing:antialiased}
#lb-ui.lb-hidden{opacity:0;visibility:hidden;transition:opacity .25s ease,visibility 0s .25s}
#lb-ui *{box-sizing:border-box}
#lb-ui [hidden]{display:none!important}
#lb-ui button{font:inherit;color:inherit}
#lb-ui .lb-h{font-family:Rajdhani,Oswald,'Arial Narrow',sans-serif;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
#lb-ui .lb-shade{position:absolute;inset:0;background:
  linear-gradient(180deg,rgba(6,10,22,.55) 0%,rgba(6,10,22,0) 16%),
  linear-gradient(0deg,rgba(4,8,18,.6) 0%,rgba(4,8,18,0) 32%),
  linear-gradient(270deg,rgba(4,8,18,.35) 0%,rgba(4,8,18,0) 30%)}
/* ---- pasek górny ---- */
#lb-ui .lb-top{position:absolute;left:0;right:0;top:0;display:flex;align-items:center;gap:10px;
  padding:max(14px,env(safe-area-inset-top)) max(18px,env(safe-area-inset-right)) 0 max(20px,env(safe-area-inset-left))}
#lb-ui .lb-logo{font:400 clamp(28px,3.4vw,40px)/1 Anton,Oswald,Impact,sans-serif;letter-spacing:.04em;transform:skewX(-6deg);
  text-shadow:0 2px 0 rgba(0,0,0,.35),0 8px 26px rgba(0,0,0,.35)}
#lb-ui .lb-logo b{color:var(--acc);font-weight:400}
#lb-ui .lb-beta{font:700 10px/1 Inter,sans-serif;font-style:normal;letter-spacing:.14em;color:var(--acc);border:1px solid rgba(255,198,41,.45);
  border-radius:5px;padding:4px 6px;margin-left:2px;align-self:center;background:rgba(10,14,24,.4)}
#lb-ui .lb-sp{flex:1}
#lb-ui .lb-chip{pointer-events:auto;height:44px;display:flex;align-items:center;gap:10px;padding:0 14px 0 6px;cursor:pointer;
  background:var(--bg);border:1px solid var(--line2);border-radius:var(--r);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
  transition:border-color .15s,background .15s}
#lb-ui .lb-chip:hover{border-color:rgba(255,198,41,.55);background:rgba(16,22,38,.82)}
#lb-ui .lb-chip:focus-visible,#lb-ui .lb-burger:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
#lb-ui .lb-coin{width:30px;height:30px;border-radius:50%;flex:none;display:grid;place-items:center;background:linear-gradient(150deg,#3ad8a6,#1b9e78);
  color:#fff;font:800 16px/1 Inter,sans-serif;box-shadow:inset 0 -2px 0 rgba(0,0,0,.2)}
#lb-ui .lb-wbal{display:flex;align-items:baseline;gap:5px}
#lb-ui .lb-wbal b{font:700 19px/1 Rajdhani,Oswald,sans-serif;letter-spacing:.02em}
#lb-ui .lb-wbal small{font:600 10px/1 Inter,sans-serif;letter-spacing:.1em;color:var(--mut)}
#lb-ui .lb-plus{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;background:var(--acc);color:#1a1200;font:800 18px/1 Inter,sans-serif;margin-right:-6px}
#lb-ui .lb-av{width:32px;height:32px;flex:none;border-radius:9px;display:grid;place-items:center;background:linear-gradient(150deg,#ffd76a,#f09a1a);
  color:#3a2200;font:700 16px/1 Rajdhani,Oswald,sans-serif}
#lb-ui .lb-av.lg{width:52px;height:52px;border-radius:14px;font-size:26px}
#lb-ui .lb-aname{font:600 14px/1 Inter,sans-serif;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#lb-ui .lb-burger{pointer-events:auto;width:44px;height:44px;flex:none;cursor:pointer;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:5px;
  background:var(--bg);border:1px solid var(--line2);border-radius:var(--r);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);transition:border-color .15s}
#lb-ui .lb-burger:hover{border-color:rgba(255,198,41,.55)}
#lb-ui .lb-burger span{display:block;width:18px;height:2px;border-radius:2px;background:#fff;transition:transform .2s,opacity .2s}
#lb-ui .lb-burger[aria-expanded=true] span:nth-child(1){transform:translateY(7px) rotate(45deg)}
#lb-ui .lb-burger[aria-expanded=true] span:nth-child(2){opacity:0}
#lb-ui .lb-burger[aria-expanded=true] span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}
#lb-ui .lb-menu{position:absolute;top:calc(max(14px,env(safe-area-inset-top)) + 52px);right:max(18px,env(safe-area-inset-right));width:250px;pointer-events:auto;
  padding:6px;background:var(--bg2);border:1px solid var(--line2);border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,.5);animation:lb-drop .16s ease;z-index:3}
@keyframes lb-drop{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
#lb-ui .lb-menu button{display:flex;align-items:center;gap:12px;width:100%;padding:11px 12px;border:0;border-radius:9px;background:none;cursor:pointer;
  font:600 14px/1 Inter,sans-serif;text-align:left;color:var(--tx)}
#lb-ui .lb-menu button:hover,#lb-ui .lb-menu button:focus-visible{background:rgba(255,255,255,.07);outline:none}
#lb-ui .lb-menu svg{width:18px;height:18px;flex:none;color:var(--mut)}
#lb-ui .lb-menu button:hover svg{color:var(--acc)}
#lb-ui .lb-menu hr{border:0;border-top:1px solid var(--line);margin:6px 4px}
#lb-ui .lb-menu .danger{color:#ff8a8a}
#lb-ui .lb-menu .danger svg{color:#ff8a8a}
/* ---- tabliczka nad postacią ---- */
#lb-ui .lb-plate{position:absolute;left:0;top:0;transform:translate(-50%,-100%);white-space:nowrap;display:flex;flex-direction:column;align-items:center;gap:4px}
#lb-ui .lb-plate>span{font:700 22px/1 Rajdhani,Oswald,sans-serif;letter-spacing:.05em;text-shadow:0 2px 6px rgba(0,0,0,.6)}
#lb-ui .lb-plate small{font:700 9.5px/1 Inter,sans-serif;letter-spacing:.16em;color:#04220f;background:var(--ok);border-radius:4px;padding:3px 7px}
#lb-ui .lb-plate em{display:block;font:700 9.5px/1 Inter,sans-serif;font-style:normal;letter-spacing:.14em;color:#1a1200;background:var(--acc);
  border-radius:4px;padding:4px 7px;opacity:0;transform:translateY(4px);transition:opacity .15s,transform .15s}
#lb-ui .lb-plate.hov em{opacity:1;transform:none}
#lb-ui.bean-hover{cursor:pointer}
/* ---- panel gry (prawy dół) ---- */
#lb-ui .lb-dock{position:absolute;right:max(24px,env(safe-area-inset-right));bottom:max(24px,env(safe-area-inset-bottom));
  display:flex;flex-direction:column;gap:10px;width:min(360px,calc(100vw - 32px))}
#lb-ui .lb-card{pointer-events:auto;background:var(--bg);border:1px solid var(--line2);border-radius:16px;padding:12px;
  backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 18px 50px rgba(0,0,0,.35)}
#lb-ui .lb-mode{width:100%;display:flex;align-items:center;gap:12px;padding:6px;border:1px solid transparent;border-radius:11px;background:rgba(255,255,255,.04);
  cursor:pointer;text-align:left;transition:background .15s,border-color .15s}
#lb-ui .lb-mode:hover{background:rgba(255,255,255,.08);border-color:rgba(255,198,41,.4)}
#lb-ui .lb-mode:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
#lb-ui .lb-thumb{width:76px;height:48px;flex:none;border-radius:8px;overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,.25)}
#lb-ui .lb-thumb svg{display:block;width:100%;height:100%}
#lb-ui .lb-mtxt{min-width:0}
#lb-ui .lb-mtxt small{display:block;font:700 10px/1 Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--mut);margin-bottom:4px}
#lb-ui .lb-mtxt span{display:block;font:700 22px/1 Rajdhani,Oswald,sans-serif;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#lb-ui .lb-mtxt em{display:block;font:500 11.5px/1.25 Inter,sans-serif;font-style:normal;color:var(--mut);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#lb-ui .lb-chev{margin-left:auto;font:700 11px/1 Inter,sans-serif;font-style:normal;letter-spacing:.06em;color:var(--acc);white-space:nowrap;padding-right:6px}
#lb-ui .lb-stakewrap{margin-top:12px}
#lb-ui .lb-lbl{display:flex;justify-content:space-between;align-items:center;font:700 10px/1 Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--mut);margin:0 2px 8px}
#lb-ui .lb-usdt{display:inline-flex;align-items:center;gap:5px;color:#5fe0b8}
#lb-ui .lb-usdt::before{content:"";width:7px;height:7px;border-radius:50%;background:#2fd3a0;box-shadow:0 0 8px #2fd3a0}
#lb-ui .lb-stake{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
#lb-ui .lb-stake button{height:44px;border-radius:10px;border:1px solid var(--line2);background:rgba(255,255,255,.04);cursor:pointer;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;transition:background .12s,border-color .12s,transform .12s}
#lb-ui .lb-stake button:hover{background:rgba(255,255,255,.09);transform:translateY(-1px)}
#lb-ui .lb-stake button b{font:700 19px/1 Rajdhani,Oswald,sans-serif;letter-spacing:.02em}
#lb-ui .lb-stake button small{font:600 8.5px/1 Inter,sans-serif;letter-spacing:.12em;color:var(--mut)}
#lb-ui .lb-stake button[data-stake=custom] b{font-size:15px;text-transform:uppercase;letter-spacing:.04em}
#lb-ui .lb-stake button.on{border-color:var(--acc);background:rgba(255,198,41,.13);box-shadow:inset 0 0 0 1px var(--acc)}
#lb-ui .lb-stake button.on small{color:var(--acc)}
#lb-ui .lb-custom{display:flex;align-items:center;margin-top:8px;border:1px solid var(--line2);border-radius:10px;background:rgba(0,0,0,.25);transition:border-color .12s}
#lb-ui .lb-custom:focus-within{border-color:var(--acc)}
#lb-ui .lb-custom input{flex:1;min-width:0;height:42px;border:0;background:none;outline:none;padding:0 12px;color:#fff;font:700 18px/1 Rajdhani,Oswald,sans-serif;letter-spacing:.02em;
  -moz-appearance:textfield;-webkit-user-select:text;user-select:text}
#lb-ui .lb-custom input::-webkit-inner-spin-button,#lb-ui .lb-custom input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
#lb-ui .lb-custom input::placeholder{font:500 13px Inter,sans-serif;color:var(--mut)}
#lb-ui .lb-custom span{padding:0 12px;font:700 11px/1 Inter,sans-serif;letter-spacing:.1em;color:var(--mut)}
#lb-ui .lb-win{display:flex;justify-content:space-between;align-items:center;margin:10px 2px 0;font:500 12.5px/1 Inter,sans-serif;color:var(--mut)}
#lb-ui .lb-win b{font:700 17px/1 Rajdhani,Oswald,sans-serif;letter-spacing:.02em;color:var(--ok)}
#lb-ui .lb-fee{margin-top:10px}
#lb-ui .lb-fee+.lb-win{margin-top:7px}
#lb-ui .lb-fee b{font-size:14px;color:var(--mut)}
#lb-ui .lb-free{display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:10px;background:rgba(255,255,255,.04);border:1px dashed var(--line2);
  font:500 13px/1.3 Inter,sans-serif;color:var(--mut)}
#lb-ui .lb-free svg{width:18px;height:18px;flex:none;color:var(--acc)}
#lb-ui .lb-playwrap{pointer-events:auto}
#lb-ui .lb-play{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:82px;overflow:hidden;cursor:pointer;
  border:0;border-radius:16px;color:#1d1300;background:linear-gradient(180deg,#ffe066 0%,#ffc629 48%,#ffa90a 100%);
  box-shadow:0 1px 0 rgba(255,255,255,.7) inset,0 -3px 0 rgba(150,80,0,.35) inset,0 14px 34px rgba(255,160,0,.32),0 4px 12px rgba(0,0,0,.35);
  transition:transform .12s ease,filter .12s ease,box-shadow .12s}
#lb-ui .lb-play:hover{transform:translateY(-2px);filter:brightness(1.05);box-shadow:0 1px 0 rgba(255,255,255,.7) inset,0 -3px 0 rgba(150,80,0,.35) inset,0 18px 44px rgba(255,170,0,.5),0 4px 12px rgba(0,0,0,.35)}
#lb-ui .lb-play:active{transform:translateY(1px);filter:brightness(.97)}
#lb-ui .lb-play:disabled{filter:grayscale(.6) brightness(.8);cursor:progress}
#lb-ui .lb-play .lb-pl{font:400 46px/1 Anton,Oswald,Impact,sans-serif;letter-spacing:.08em;transform:skewX(-6deg);text-shadow:0 1px 0 rgba(255,255,255,.5)}
#lb-ui .lb-play small{font:700 11px/1 Inter,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:rgba(40,24,0,.72);margin-top:5px}
#lb-ui .lb-play::after{content:"";position:absolute;top:-30%;bottom:-30%;width:22%;left:-40%;transform:skewX(-20deg);
  background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.6),rgba(255,255,255,0));animation:lb-shine 4s ease-in-out infinite}
@keyframes lb-shine{0%,70%{left:-40%}100%{left:130%}}
#lb-ui .lb-play:focus-visible{outline:3px solid #fff;outline-offset:3px}
/* ---- okna ---- */
#lb-ui .lb-modal{position:absolute;inset:0;pointer-events:auto;display:grid;place-items:center;padding:16px;background:rgba(3,6,14,.62);
  backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:lb-in .16s ease;z-index:4}
@keyframes lb-in{from{opacity:0}to{opacity:1}}
#lb-ui .lb-dlg{width:min(540px,100%);max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);overflow:auto;padding:20px;background:var(--bg2);
  border:1px solid var(--line2);border-radius:18px;box-shadow:0 30px 90px rgba(0,0,0,.6);animation:lb-pop .18s ease}
#lb-ui .lb-dlg.lb-sm{width:min(420px,100%)}
@keyframes lb-pop{from{transform:translateY(8px) scale(.985)}to{transform:none}}
#lb-ui .lb-dh{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
#lb-ui .lb-dh h3{margin:0;font:700 24px/1 Rajdhani,Oswald,sans-serif;letter-spacing:.06em;text-transform:uppercase}
#lb-ui .lb-x{width:34px;height:34px;border-radius:10px;border:1px solid var(--line2);background:rgba(255,255,255,.04);cursor:pointer;display:grid;place-items:center;color:var(--mut)}
#lb-ui .lb-x:hover{color:#fff;background:rgba(255,255,255,.1)}
#lb-ui .lb-x svg{width:16px;height:16px}
#lb-ui .lb-tabs{display:flex;gap:4px;padding:4px;margin-bottom:16px;background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:12px}
#lb-ui .lb-tabs button{flex:1;height:36px;border:0;border-radius:9px;background:none;cursor:pointer;font:600 13px/1 Inter,sans-serif;color:var(--mut);transition:background .12s,color .12s}
#lb-ui .lb-tabs button:hover{color:#fff}
#lb-ui .lb-tabs button.on{background:rgba(255,198,41,.14);color:var(--acc);box-shadow:inset 0 0 0 1px rgba(255,198,41,.35)}
#lb-ui .lb-field{display:block;margin-bottom:14px}
#lb-ui .lb-field>span,#lb-ui .lb-row label{display:block;font:600 12px/1 Inter,sans-serif;color:var(--mut);margin-bottom:7px}
#lb-ui .lb-field input:not([type=range]){width:100%;height:46px;border-radius:11px;border:1px solid var(--line2);background:rgba(0,0,0,.28);color:#fff;
  padding:0 14px;font:500 15px Inter,sans-serif;outline:none;transition:border-color .12s,box-shadow .12s;-webkit-user-select:text;user-select:text}
#lb-ui .lb-field input:focus{border-color:var(--acc);box-shadow:0 0 0 3px rgba(255,198,41,.15)}
#lb-ui .lb-field i{display:block;font:500 11.5px/1.3 Inter,sans-serif;font-style:normal;color:var(--mut);margin-top:6px}
#lb-ui .lb-row{display:flex;justify-content:space-between;align-items:baseline}
#lb-ui .lb-row b{font:700 17px/1 Rajdhani,Oswald,sans-serif;color:var(--acc)}
#lb-ui input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:22px;margin:0;background:none;cursor:pointer;--p:50%}
#lb-ui input[type=range]::-webkit-slider-runnable-track{height:6px;border-radius:6px;background:linear-gradient(90deg,color-mix(in srgb,var(--c,var(--acc)) 55%,#000) 0,var(--c,var(--acc)) var(--p),rgba(255,255,255,.1) var(--p))}
#lb-ui input[type=range]::-moz-range-track{height:6px;border-radius:6px;background:rgba(255,255,255,.1)}
#lb-ui input[type=range]::-moz-range-progress{height:6px;border-radius:6px;background:var(--c,var(--acc))}
#lb-ui input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;margin-top:-6px;border-radius:50%;background:#fff;border:3px solid var(--c,var(--acc));
  box-shadow:0 0 0 4px color-mix(in srgb,var(--c,var(--acc)) 18%,transparent),0 2px 6px rgba(0,0,0,.5);transition:box-shadow .12s}
#lb-ui input[type=range]::-moz-range-thumb{width:12px;height:12px;border-radius:50%;background:#fff;border:3px solid var(--c,var(--acc))}
#lb-ui input[type=range]:hover::-webkit-slider-thumb,#lb-ui input[type=range]:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 7px color-mix(in srgb,var(--c,var(--acc)) 25%,transparent),0 2px 6px rgba(0,0,0,.5)}
#lb-ui input[type=range]:focus-visible{outline:none}
#lb-ui .lb-vrow{display:grid;grid-template-columns:48px minmax(0,1fr) auto;align-items:center;gap:10px 14px;padding:14px 16px;margin-bottom:10px;border-radius:16px;
  background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.015));border:1px solid var(--line)}
#lb-ui .lb-vrow:first-child{border-color:color-mix(in srgb,var(--c) 30%,transparent)}
#lb-ui .lb-vic{grid-row:span 2;width:48px;height:48px;border-radius:14px;border:1px solid color-mix(in srgb,var(--c) 35%,transparent);cursor:pointer;display:grid;place-items:center;
  background:color-mix(in srgb,var(--c) 12%,transparent);color:var(--c);box-shadow:0 0 18px color-mix(in srgb,var(--c) 14%,transparent);transition:background .12s}
#lb-ui .lb-vic:hover{background:color-mix(in srgb,var(--c) 22%,transparent)}
#lb-ui .lb-vic svg{width:22px;height:22px;grid-area:1/1}
#lb-ui .lb-vic svg:last-child,#lb-ui .lb-vrow.muted .lb-vic svg:first-child{display:none}
#lb-ui .lb-vrow.muted .lb-vic svg:last-child{display:block}
#lb-ui .lb-vrow.muted .lb-vic{color:var(--mut);background:rgba(255,255,255,.04);border-color:var(--line2);box-shadow:none}
#lb-ui .lb-vtt b{display:block;font:600 14.5px/1.2 Inter,sans-serif}
#lb-ui .lb-vtt small{display:block;font:500 12px/1.3 Inter,sans-serif;color:var(--mut);margin-top:2px}
#lb-ui .lb-vval{font:700 20px/1 Rajdhani,Oswald,sans-serif;color:var(--c);min-width:54px;text-align:right}
#lb-ui .lb-vrow.muted .lb-vval{color:var(--mut)}
#lb-ui .lb-vsl{grid-column:2/4;display:flex;align-items:center;gap:12px}
#lb-ui .lb-vplay{width:32px;height:32px;flex:none;border-radius:50%;border:1px solid var(--line2);background:rgba(255,255,255,.05);color:#fff;cursor:pointer;display:grid;place-items:center}
#lb-ui .lb-vplay:hover{border-color:var(--c);color:var(--c)}
#lb-ui .lb-vplay svg{width:13px;height:13px;margin-left:2px}
#lb-ui .lb-sec{margin:0 0 10px;font:700 11px/1 Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--mut)}
#lb-ui .lb-sec:not(:first-child){margin-top:18px}
#lb-ui .lb-sec+.lb-note{margin:-2px 0 10px}
#lb-ui .lb-fovcard{display:flex;align-items:center;gap:18px;padding:12px 16px;border-radius:16px;background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.015));border:1px solid var(--line)}
#lb-ui .lb-fovsvg{width:120px;height:64px;flex:none}
#lb-ui .lb-fovmain{flex:1;min-width:0}
#lb-ui .lb-fovmain small{display:block;font:500 12px/1.3 Inter,sans-serif;color:var(--mut);margin:3px 0 6px}
#lb-ui .lb-flag{width:30px;height:20px;flex:none;display:block;border-radius:4px;overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,.2),0 2px 6px rgba(0,0,0,.45)}
#lb-ui .lb-flag svg{display:block;width:100%;height:100%}
#lb-ui .lb-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:46px;border-radius:11px;border:1px solid var(--line2);
  background:rgba(255,255,255,.05);cursor:pointer;font:700 14px/1 Inter,sans-serif;letter-spacing:.02em;transition:filter .12s,background .12s,transform .12s}
#lb-ui .lb-btn:hover{background:rgba(255,255,255,.1)}
#lb-ui .lb-btn.pri{border:0;color:#1d1300;background:linear-gradient(180deg,#ffd84d,#ffb411);box-shadow:0 8px 22px rgba(255,170,0,.25)}
#lb-ui .lb-btn.pri:hover{filter:brightness(1.06)}
#lb-ui .lb-btn.pri:active{transform:translateY(1px)}
#lb-ui .lb-btn:disabled{opacity:.6;cursor:progress}
#lb-ui .lb-btn.sm{width:auto;height:36px;padding:0 14px;font-size:13px}
#lb-ui .lb-err{margin:0 0 12px;padding:9px 12px;border-radius:9px;background:rgba(255,93,93,.1);border:1px solid rgba(255,93,93,.3);color:#ff9c9c;font:500 13px/1.3 Inter,sans-serif}
#lb-ui .lb-note{margin:14px 0 0;font:500 12px/1.45 Inter,sans-serif;color:var(--mut)}
#lb-ui .lb-note:first-child{margin-top:0;margin-bottom:12px}
#lb-ui .lb-langs{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#lb-ui .lb-seg{display:flex;align-items:center;gap:12px;height:54px;padding:0 14px;border-radius:12px;border:1px solid var(--line2);background:rgba(255,255,255,.04);cursor:pointer;text-align:left}
#lb-ui .lb-seg:hover{background:rgba(255,255,255,.08)}
#lb-ui .lb-seg b{width:34px;height:26px;border-radius:6px;display:grid;place-items:center;background:rgba(255,255,255,.08);font:700 13px/1 Rajdhani,Oswald,sans-serif;letter-spacing:.06em}
#lb-ui .lb-seg span{flex:1;font:600 14px Inter,sans-serif}
#lb-ui .lb-seg.on{border-color:var(--acc);background:rgba(255,198,41,.1)}
#lb-ui .lb-seg.on b{background:var(--acc);color:#1d1300}
#lb-ui .c-move{--c:#ffc629}
#lb-ui .c-fight{--c:#ff6b57}
#lb-ui .c-sys{--c:#9d8cff}
#lb-ui .lb-dlg.lb-wide{width:min(740px,100%)}
#lb-ui .lb-binds{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
#lb-ui .lb-bind{display:flex;align-items:center;gap:9px;height:42px;padding:0 6px 0 11px;border-radius:10px;border:1px solid var(--line);
  background:rgba(255,255,255,.03);cursor:pointer;text-align:left;font:500 13px/1.1 Inter,sans-serif;transition:border-color .12s,background .12s}
#lb-ui .lb-bind i{width:7px;height:7px;flex:none;border-radius:2px;background:var(--c);box-shadow:0 0 7px var(--c)}
#lb-ui .lb-bind span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#lb-ui .lb-bind:hover,#lb-ui .lb-bind.hl{border-color:color-mix(in srgb,var(--c) 55%,transparent);background:color-mix(in srgb,var(--c) 8%,transparent)}
#lb-ui .lb-bind kbd{min-width:56px;max-width:60%;overflow:hidden;text-overflow:ellipsis;height:30px;padding:0 8px;border-radius:7px;display:grid;place-items:center;background:rgba(255,255,255,.08);
  border:1px solid var(--line2);border-bottom-width:2px;font:700 14px/1 Rajdhani,Oswald,sans-serif;letter-spacing:.04em;white-space:nowrap}
#lb-ui .lb-bind.wait{border-color:var(--acc);background:rgba(255,198,41,.08)}
#lb-ui .lb-bind.wait kbd{color:var(--acc);font:600 11px Inter,sans-serif;animation:lb-blink 1s ease-in-out infinite}
/* klawiatura */
#lb-ui .lb-deck{position:relative;display:flex;gap:16px;align-items:center;margin-top:14px;padding:14px 16px 16px;border-radius:18px;
  background:radial-gradient(120% 90% at 50% 0%,rgba(255,255,255,.05),rgba(255,255,255,0) 60%),linear-gradient(180deg,#131927,#0a0e17);
  border:1px solid var(--line2);box-shadow:inset 0 1px 0 rgba(255,255,255,.06),inset 0 -12px 24px rgba(0,0,0,.35),0 14px 34px rgba(0,0,0,.4)}
#lb-ui .lb-deck::after{content:"";position:absolute;left:8%;right:8%;bottom:-1px;height:2px;border-radius:2px;
  background:linear-gradient(90deg,transparent,#ffc629 25%,#ff6b57 50%,#9d8cff 75%,transparent);box-shadow:0 0 14px rgba(255,160,80,.45);opacity:.85}
#lb-ui .lb-kb{flex:1;min-width:0;container-type:inline-size;padding:5px;border-radius:12px;background:#080b12;box-shadow:inset 0 2px 6px rgba(0,0,0,.7),0 1px 0 rgba(255,255,255,.05)}
#lb-ui .lb-kbrow{display:grid;grid-template-columns:repeat(60,1fr)}
#lb-ui .lb-key{position:relative;margin:2px;height:calc(6.667cqw - 4px);min-width:0;padding:0;border:0;border-radius:min(7px,1.3cqw);cursor:default;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.5cqw;overflow:hidden;
  background:linear-gradient(180deg,#252c3b 0%,#1b202c 100%);color:#5f6a80;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.07),inset 0 -2px 0 rgba(0,0,0,.35),0 2px 0 #05070c,0 3px 5px rgba(0,0,0,.4);
  transition:transform .07s ease,box-shadow .07s ease,filter .15s,background .15s}
#lb-ui .lb-key b{font:700 max(9px,2.15cqw)/1 Rajdhani,Oswald,sans-serif;letter-spacing:.03em}
#lb-ui .lb-key small{font:700 max(7px,1.25cqw)/1 Inter,sans-serif;letter-spacing:.08em;text-transform:uppercase;opacity:.9;white-space:nowrap}
#lb-ui .lb-key small:empty{display:none}
@container (max-width:520px){#lb-ui .lb-key small{display:none}#lb-ui .lb-key.use:has(small:not(:empty))::after{display:block}}
#lb-ui .lb-key.use{color:#fff;background:linear-gradient(180deg,color-mix(in srgb,var(--c) 38%,#252c3b) 0%,color-mix(in srgb,var(--c) 16%,#1b202c) 100%);
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--c) 75%,transparent),inset 0 1px 0 rgba(255,255,255,.22),inset 0 -2px 0 rgba(0,0,0,.3),0 2px 0 #05070c,0 0 16px color-mix(in srgb,var(--c) 38%,transparent)}
#lb-ui .lb-key.use b{text-shadow:0 0 10px color-mix(in srgb,var(--c) 80%,transparent)}
#lb-ui .lb-key.use::after{content:"";position:absolute;left:50%;bottom:9%;width:20%;height:2px;margin-left:-10%;border-radius:2px;background:var(--c);box-shadow:0 0 6px var(--c)}
#lb-ui .lb-key.use:has(small:not(:empty))::after{display:none}
#lb-ui .lb-key.alt{filter:saturate(.55) brightness(.85)}
#lb-ui .lb-key.hl{filter:brightness(1.3);transform:translateY(-2px);z-index:1;box-shadow:inset 0 0 0 2px #fff,0 4px 0 #05070c,0 0 22px color-mix(in srgb,var(--c,#fff) 60%,transparent)}
#lb-ui .lb-key.down{transform:translateY(2px);filter:brightness(1.45);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--c,#8e9ab0) 85%,transparent),0 0 0 #05070c,0 0 18px color-mix(in srgb,var(--c,#8e9ab0) 55%,transparent)}
#lb-ui .lb-kb.pick .lb-key{cursor:pointer}
#lb-ui .lb-kb.pick .lb-key:hover{box-shadow:inset 0 0 0 2px var(--acc),0 2px 0 #05070c,0 0 14px rgba(255,198,41,.45)}
#lb-ui .lb-kb:not(.pick) .lb-key.use:not(.alt){cursor:pointer}
#lb-ui .lb-kbtip{position:absolute;z-index:5;transform:translate(-50%,-100%);display:flex;align-items:center;gap:8px;padding:6px 10px 6px 6px;border-radius:9px;
  background:#06080e;border:1px solid color-mix(in srgb,var(--c,#8e9ab0) 55%,transparent);box-shadow:0 10px 24px rgba(0,0,0,.55);
  font:600 12px/1 Inter,sans-serif;white-space:nowrap;pointer-events:none}
#lb-ui .lb-kbtip kbd{min-width:26px;height:22px;padding:0 6px;border-radius:5px;display:grid;place-items:center;background:color-mix(in srgb,var(--c,#8e9ab0) 25%,#1b202c);
  color:#fff;font:700 13px/1 Rajdhani,Oswald,sans-serif}
#lb-ui .lb-mouse{width:104px;flex:none;display:flex;flex-direction:column;align-items:center;gap:10px}
#lb-ui .lb-msvg{width:54px;height:84px;filter:drop-shadow(0 6px 10px rgba(0,0,0,.5))}
#lb-ui .lb-msvg .mb{fill:rgba(255,107,87,.26);stroke:#ff6b57;stroke-width:1;filter:drop-shadow(0 0 4px rgba(255,107,87,.6))}
#lb-ui .lb-msvg .mw{fill:#ff6b57;filter:drop-shadow(0 0 4px rgba(255,107,87,.8))}
#lb-ui .lb-mleg{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px;width:100%}
#lb-ui .lb-mleg li{display:flex;align-items:center;gap:6px;font:500 11px/1.15 Inter,sans-serif;color:#c8cfdd}
#lb-ui .lb-mleg b{flex:none;min-width:34px;padding:3px 4px;border-radius:5px;text-align:center;background:rgba(255,107,87,.16);color:#ff9a88;font:700 10px/1 Inter,sans-serif;letter-spacing:.04em}
#lb-ui .lb-kbfoot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px}
#lb-ui .lb-legend{display:flex;flex-wrap:wrap;gap:14px;font:600 11.5px/1 Inter,sans-serif;color:var(--mut)}
#lb-ui .lb-legend span{display:inline-flex;align-items:center;gap:7px}
#lb-ui .lb-legend span::before{content:"";width:9px;height:9px;border-radius:3px;background:var(--c);box-shadow:0 0 8px var(--c)}
@keyframes lb-blink{50%{opacity:.4}}
#lb-ui .lb-me{display:flex;align-items:center;gap:14px;padding:14px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid var(--line);margin-bottom:14px}
#lb-ui .lb-me small{display:block;font:600 11px/1 Inter,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}
#lb-ui .lb-me b{display:block;font:700 24px/1.1 Rajdhani,Oswald,sans-serif;letter-spacing:.03em;margin:3px 0}
#lb-ui .lb-me em{display:block;font:500 12px Inter,sans-serif;font-style:normal;color:var(--mut)}
#lb-ui .lb-balcard{position:relative;overflow:hidden;padding:18px;border-radius:16px;margin-bottom:12px;
  background:radial-gradient(120% 140% at 100% 0%,rgba(153,69,255,.35),rgba(153,69,255,0) 55%),radial-gradient(120% 140% at 0% 100%,rgba(20,241,149,.22),rgba(20,241,149,0) 55%),#121a2b;
  border:1px solid var(--line2)}
#lb-ui .lb-balcard small{font:600 11px/1 Inter,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--mut)}
#lb-ui .lb-big{display:flex;align-items:baseline;gap:8px;margin:6px 0 10px}
#lb-ui .lb-big b{font:700 42px/1 Rajdhani,Oswald,sans-serif;letter-spacing:.01em}
#lb-ui .lb-big span{font:700 14px/1 Inter,sans-serif;letter-spacing:.08em;color:#5fe0b8}
#lb-ui .lb-net{display:flex;align-items:center;gap:8px;font:500 12px/1 Inter,sans-serif;color:#c5cde0}
#lb-ui .lb-net svg{width:16px;height:13px}
#lb-ui .lb-phantom{position:absolute;top:14px;right:14px;display:flex;align-items:center;gap:7px;height:32px;padding:0 11px;border-radius:9px;cursor:pointer;
  border:1px solid rgba(171,159,242,.45);background:rgba(171,159,242,.12);font:600 12px/1 Inter,sans-serif;color:#d9d3ff}
#lb-ui .lb-phantom:hover{background:rgba(171,159,242,.22)}
#lb-ui .lb-phantom svg{width:15px;height:15px}
#lb-ui .lb-phantom code{font:600 12px ui-monospace,Menlo,monospace;color:#fff}
#lb-ui .lb-phantom.on [data-i18n]{display:none}
#lb-ui .lb-phantom:not(.on) code{display:none}
#lb-ui .lb-test{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:11px;margin-bottom:14px;background:rgba(255,176,32,.1);border:1px solid rgba(255,176,32,.35);
  font:500 12px/1.4 Inter,sans-serif;color:#ffd38a}
#lb-ui .lb-test svg{width:16px;height:16px;flex:none;margin-top:1px}
#lb-ui .lb-quick{display:flex;gap:6px;margin-bottom:12px}
#lb-ui .lb-quick button{flex:1;height:36px;border-radius:9px;border:1px solid var(--line2);background:rgba(255,255,255,.04);cursor:pointer;font:700 15px/1 Rajdhani,Oswald,sans-serif;letter-spacing:.02em}
#lb-ui .lb-quick button:hover{border-color:rgba(255,198,41,.5);background:rgba(255,198,41,.08)}
#lb-ui .lb-hist{list-style:none;margin:0;padding:0;max-height:300px;overflow:auto}
#lb-ui .lb-hist li{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:11px 2px;border-bottom:1px solid var(--line)}
#lb-ui .lb-hist li:last-child{border-bottom:0}
#lb-ui .lb-hist li b{display:block;font:600 13.5px/1.2 Inter,sans-serif}
#lb-ui .lb-hist li small{display:block;font:500 11.5px/1.2 Inter,sans-serif;color:var(--mut);margin-top:2px}
#lb-ui .lb-hist li>span{font:700 16px/1 Rajdhani,Oswald,sans-serif;white-space:nowrap}
#lb-ui .lb-hist .pos{color:var(--ok)}
#lb-ui .lb-hist .neg{color:#ff8a8a}
#lb-ui .lb-hist .empty{justify-content:center;color:var(--mut);padding:26px 0;font:500 13px Inter,sans-serif}
/* ---- losowanie mapy ---- */
#lb-ui .lb-draw{position:absolute;inset:0;pointer-events:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;padding:16px;z-index:6;
  background:radial-gradient(80% 70% at 50% 50%,rgba(8,12,26,.78),rgba(2,4,10,.94));backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);animation:lb-in .25s ease}
#lb-ui .lb-dsub{font:700 12px/1 Inter,sans-serif;letter-spacing:.42em;text-transform:uppercase;color:var(--mut);padding-left:.42em}
#lb-ui .lb-dtitle{margin:-12px 0 0;font:400 clamp(34px,5vw,54px)/1 Anton,Oswald,Impact,sans-serif;letter-spacing:.06em;transform:skewX(-6deg)}
#lb-ui .lb-dtitle b{color:var(--acc);font-weight:400}
#lb-ui .lb-reelwin{position:relative;width:min(1240px,100%);height:280px;overflow:hidden;
  -webkit-mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)}
#lb-ui .lb-reelwin::before{content:"";position:absolute;left:50%;top:0;bottom:0;width:3px;margin-left:-1.5px;background:var(--acc);z-index:2;box-shadow:0 0 14px var(--acc),0 0 30px rgba(255,198,41,.6)}
#lb-ui .lb-reelwin::after{content:"";position:absolute;left:50%;top:0;margin-left:-11px;border:11px solid transparent;border-top-color:var(--acc);z-index:2;filter:drop-shadow(0 0 6px var(--acc))}
#lb-ui .lb-reel{display:flex;gap:16px;padding:20px 0;will-change:transform}
#lb-ui .lb-mcard{position:relative;flex:none;width:384px;height:240px;border-radius:16px;overflow:hidden;background:#1a2030;
  box-shadow:0 0 0 1px rgba(255,255,255,.2),0 16px 34px rgba(0,0,0,.5);transition:transform .3s ease,box-shadow .3s ease,opacity .3s ease,filter .3s ease}
#lb-ui .lb-mcard svg,#lb-ui .lb-mcard img{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:cover}
#lb-ui .lb-mcard::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 50%,rgba(4,7,14,.82) 100%);pointer-events:none}
#lb-ui .lb-mcard span{position:absolute;left:16px;bottom:13px;z-index:1;display:flex;align-items:center;gap:10px;font:700 30px/1 Rajdhani,Oswald,sans-serif;letter-spacing:.08em;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.6)}
#lb-ui .lb-mcard span i{font:700 10px/1 Inter,sans-serif;font-style:normal;letter-spacing:.12em;color:#1d1300;background:var(--acc);padding:4px 6px;border-radius:5px;text-shadow:none}
#lb-ui .lb-draw.done .lb-mcard{opacity:.25;filter:grayscale(.75)}
#lb-ui .lb-draw.done .lb-mcard.win{opacity:1;filter:none;transform:scale(1.06);box-shadow:0 0 0 3px var(--acc),0 0 60px rgba(255,198,41,.5),0 18px 40px rgba(0,0,0,.55)}
#lb-ui .lb-draw.done .lb-mcard.win span{color:var(--acc)}
#lb-ui .lb-dres{min-height:44px;font:400 clamp(28px,4vw,40px)/1 Anton,Oswald,Impact,sans-serif;letter-spacing:.06em;color:var(--acc);text-shadow:0 0 28px rgba(255,198,41,.45);
  opacity:0;transform:translateY(8px) scale(.96);transition:opacity .3s,transform .3s}
#lb-ui .lb-draw.done .lb-dres{opacity:1;transform:none}
#lb-ui .lb-dstake{font:600 13px/1 Inter,sans-serif;color:var(--mut)}
#lb-ui .lb-dstake b{color:#fff;font:700 16px Rajdhani,Oswald,sans-serif;letter-spacing:.03em}
/* ---- powiadomienia ---- */
#lb-ui .lb-toast{position:absolute;left:50%;top:calc(max(14px,env(safe-area-inset-top)) + 58px);transform:translate(-50%,-8px);max-width:calc(100vw - 32px);
  padding:11px 16px 11px 14px;border-radius:11px;background:var(--bg2);border:1px solid var(--line2);border-left:3px solid var(--acc);box-shadow:0 16px 40px rgba(0,0,0,.45);
  font:600 13.5px/1.3 Inter,sans-serif;opacity:0;visibility:hidden;transition:opacity .2s,transform .2s,visibility 0s .2s;z-index:8}
#lb-ui .lb-toast.show{opacity:1;visibility:visible;transform:translate(-50%,0);transition:opacity .2s,transform .2s}
#lb-ui .lb-toast.ok{border-left-color:var(--ok)}
#lb-ui .lb-toast.err{border-left-color:var(--err)}
/* ---- wybór trybu ---- */
#lb-ui .lb-picker{position:absolute;inset:0;pointer-events:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;
  padding:24px 16px;background:rgba(3,6,14,.74);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);animation:lb-in .18s ease;z-index:4}
#lb-ui .lb-picker h2{margin:0;font:700 clamp(28px,3.4vw,40px)/1 Rajdhani,Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase}
#lb-ui .lb-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,300px));gap:18px;width:100%;justify-content:center}
#lb-ui .lb-tile{position:relative;display:block;aspect-ratio:16/10;padding:0;text-align:left;cursor:pointer;overflow:hidden;
  border:0;border-radius:14px;background:#0c1630;box-shadow:0 0 0 1px rgba(255,255,255,.18),0 12px 28px rgba(0,0,0,.45);
  transition:transform .14s ease,box-shadow .14s ease}
#lb-ui .lb-tile svg.art{position:absolute;inset:0;width:100%;height:100%;display:block;transition:transform .35s ease}
#lb-ui .lb-tile:hover{transform:translateY(-4px);box-shadow:0 0 0 1px rgba(255,255,255,.6),0 18px 34px rgba(0,0,0,.5)}
#lb-ui .lb-tile:hover svg.art{transform:scale(1.04)}
#lb-ui .lb-tile.sel{transform:translateY(-4px);box-shadow:0 0 0 3px var(--acc),0 0 40px rgba(255,198,41,.3),0 18px 34px rgba(0,0,0,.55)}
#lb-ui .lb-tile:focus-visible{outline:2px solid #fff;outline-offset:5px}
#lb-ui .lb-tile .tag{position:absolute;top:10px;left:10px;font:700 10px/1 Inter,sans-serif;font-style:normal;letter-spacing:.12em;color:#1d1300;background:var(--acc);
  padding:5px 8px;border-radius:5px}
#lb-ui .lb-tile .check{position:absolute;top:10px;right:10px;width:26px;height:26px;border-radius:50%;background:var(--acc);color:#1d1300;font-style:normal;
  display:none;place-items:center;font:800 14px/1 Inter,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.4)}
#lb-ui .lb-tile.sel .check{display:grid}
#lb-ui .lb-tile.soon{cursor:default}
#lb-ui .lb-tile.soon:hover{transform:none;box-shadow:0 0 0 1px rgba(255,255,255,.18),0 12px 28px rgba(0,0,0,.45)}
#lb-ui .lb-tile.soon:hover svg.art{transform:none}
#lb-ui .lb-tile.soon .tag{background:#9aa7c0}
#lb-ui .lb-picker .lb-btn,#lb-ui .lb-skins .lb-btn{width:auto;min-width:180px;padding:0 28px}
/* ---- skiny ---- */
#lb-ui .lb-skins{position:absolute;left:max(16px,env(safe-area-inset-left));top:calc(max(14px,env(safe-area-inset-top)) + 60px);bottom:24px;width:min(340px,calc(100vw - 32px));
  pointer-events:auto;display:flex;flex-direction:column;gap:12px;padding:16px;background:var(--bg);border:1px solid var(--line2);border-radius:16px;
  backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);animation:lb-in .18s ease;z-index:2}
#lb-ui .lb-skins h2{margin:0;font:700 24px/1 Rajdhani,Oswald,sans-serif;letter-spacing:.08em;text-transform:uppercase}
#lb-ui .lb-skins .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;overflow-y:auto;padding:3px}
#lb-ui .lb-skin{cursor:pointer;border:1px solid var(--line);border-radius:11px;padding:9px 4px 8px;background:rgba(255,255,255,.04);
  display:flex;flex-direction:column;align-items:center;gap:5px;transition:transform .12s,border-color .12s,background .12s}
#lb-ui .lb-skin:hover{transform:translateY(-2px);background:rgba(255,255,255,.09);border-color:var(--line2)}
#lb-ui .lb-skin.sel{border-color:var(--acc);box-shadow:inset 0 0 0 1px var(--acc);background:rgba(255,198,41,.1)}
#lb-ui .lb-skin svg,#lb-ui .lb-skin img{width:42px;height:56px;display:block;object-fit:contain}
#lb-ui .lb-skin span{font:600 12.5px/1.1 Inter,sans-serif;text-align:center}
#lb-ui .lb-skin small{font:700 8.5px/1 Inter,sans-serif;letter-spacing:.12em;color:var(--acc);min-height:9px}
#lb-ui .lb-skins .lb-btn{align-self:flex-start;margin-top:auto}
/* ---- panel admina ---- */
#lb-ui .lb-adm [data-apane=lobby] label{display:flex;gap:10px;align-items:flex-start;padding:11px 12px;border:1px solid var(--line);border-radius:11px;margin-bottom:8px;cursor:pointer}
#lb-ui .lb-adm [data-apane=lobby] label:hover{background:rgba(255,255,255,.04)}
#lb-ui .lb-adm [data-apane=lobby] label:has(input:checked){border-color:var(--acc);background:rgba(255,198,41,.07)}
#lb-ui .lb-adm [data-apane=lobby] input{margin-top:3px;accent-color:var(--acc)}
#lb-ui .lb-adm [data-apane=lobby] label b{display:block;font-weight:600}
#lb-ui .lb-adm [data-apane=lobby] label small{color:var(--mut);font-size:12px}
#lb-ui .lb-adm h4{margin:0 0 8px;font:700 11px Inter,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--mut)}
#lb-ui .lb-adm .row{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}
#lb-ui .lb-adm .row .lb-btn{width:auto;padding:0 16px}
#lb-ui .lb-askins{display:flex;flex-direction:column;gap:8px;max-height:46vh;overflow-y:auto;margin-bottom:10px;padding-right:2px}
#lb-ui .lb-askin{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--line);border-radius:11px;background:rgba(255,255,255,.03)}
#lb-ui .lb-askin img{width:36px;height:48px;object-fit:contain;flex:none}
#lb-ui .lb-askin .nm{flex:1;min-width:0}
#lb-ui .lb-askin .nm b{display:block;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#lb-ui .lb-askin .nm small{color:var(--mut);font-size:11.5px}
#lb-ui .lb-askin input{width:96px;height:32px;border-radius:8px;border:1px solid var(--line2);background:rgba(0,0,0,.28);color:#fff;padding:0 8px;font:600 11px Inter,sans-serif;text-transform:uppercase}
#lb-ui .lb-askin button{height:32px;min-width:32px;padding:0 10px;border-radius:8px;border:1px solid var(--line2);background:rgba(255,255,255,.05);color:#fff;cursor:pointer;font:600 12px Inter,sans-serif}
#lb-ui .lb-askin button:hover{background:rgba(255,255,255,.12)}
#lb-ui .lb-askin button.del{color:#ff8a8a}
#lb-ui .lb-askin button:disabled{opacity:.3;cursor:default}
#lb-ui .lb-agh{margin:12px 0 4px;border:1px solid var(--line);border-radius:11px;padding:10px 12px}
#lb-ui .lb-agh summary{cursor:pointer;font:600 12.5px Inter,sans-serif;color:var(--mut)}
#lb-ui .lb-agh .lb-field{margin:10px 0 0}
#lb-ui #lb-askin-status{min-height:18px;margin:8px 0 0}
#lb-kreator{position:fixed;inset:0;z-index:2147483000;background:#1b1e25}
#lb-kreator iframe{width:100%;height:100%;border:0;display:block}
@media (max-width:640px){
  #lb-ui .lb-dock{left:12px;right:12px;width:auto;bottom:max(12px,env(safe-area-inset-bottom))}
  #lb-ui .lb-card{padding:10px}
  #lb-ui .lb-play{height:66px}
  #lb-ui .lb-play .lb-pl{font-size:36px}
  #lb-ui .lb-aname,#lb-ui .lb-beta{display:none}
  #lb-ui .lb-achip{padding:0 6px}
  #lb-ui .lb-wchip{padding-right:12px}
  #lb-ui .lb-wbal small{display:none}
  #lb-ui .lb-top{gap:6px}
  #lb-ui .lb-plate>span{font-size:18px}
  #lb-ui .lb-tiles{grid-template-columns:minmax(0,1fr);max-width:340px;padding:0 6px}
  #lb-ui .lb-picker{justify-content:flex-start;overflow-y:auto;padding-top:max(20px,env(safe-area-inset-top))}
  #lb-ui .lb-tile.sel,#lb-ui .lb-tile:hover{transform:none}
  #lb-ui .lb-skins{top:auto;bottom:16px;height:52vh;left:12px;right:12px;width:auto}
  #lb-ui .lb-skins .grid{grid-template-columns:repeat(4,1fr)}
  #lb-ui .lb-langs{grid-template-columns:1fr}
  #lb-ui .lb-binds{grid-template-columns:repeat(2,minmax(0,1fr))}
  #lb-ui .lb-deck{flex-direction:column;padding:10px}
  #lb-ui .lb-kb{width:100%}
  #lb-ui .lb-mouse{width:auto;flex-direction:row;gap:14px}
  #lb-ui .lb-msvg{width:40px;height:62px}
  #lb-ui .lb-kbfoot{flex-direction:column;align-items:stretch}
  #lb-ui .lb-dlg{padding:16px}
  #lb-ui .lb-reelwin{height:196px}
  #lb-ui .lb-mcard{width:256px;height:160px;border-radius:12px}
  #lb-ui .lb-mcard span{font-size:22px;left:12px;bottom:10px}
  #lb-ui .lb-phantom{position:static;margin-top:12px}
}
@media (max-width:520px){#lb-ui .lb-binds{grid-template-columns:minmax(0,1fr)}}
`;

const IC = {
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7V5a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-4a2 2 0 0 0 0 4h4v2a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V6"/><circle cx="17" cy="15" r=".5" fill="currentColor"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>',
  vol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 12l5 9 1.5-3.5L22 16z" fill="currentColor"/></svg>',
  cross: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>',
  mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4z"/><path d="M16 9l5 6M21 9l-5 6"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10-6.5a1 1 0 0 0 0-1.7l-10-6.5A1 1 0 0 0 8 5.5z"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
  sol: '<svg viewBox="0 0 32 26"><defs><linearGradient id="lbsol" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#9945ff"/><stop offset="1" stop-color="#14f195"/></linearGradient></defs><g fill="url(#lbsol)"><path d="M6 0h26l-6 6H0z"/><path d="M0 10h26l6 6H6z"/><path d="M6 20h26l-6 6H0z"/></g></svg>',
  ghost: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C6.5 3 3 7.4 3 12.6V20c0 .9 1 1.3 1.6.7l1.4-1.4 1.6 1.6c.4.4 1 .4 1.4 0L12 18l3 2.9c.4.4 1 .4 1.4 0l1.6-1.6 1.4 1.4c.6.6 1.6.2 1.6-.7v-7.4C21 7.4 17.5 3 12 3zm-3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>',
};
const VROW = (k, c, icon, l, d) => `<div class="lb-vrow ${c}" data-k="${k}"><button type="button" class="lb-vic">${IC[icon]}${IC.mute}</button>
  <div class="lb-vtt"><b data-i18n="${l}"></b><small data-i18n="${d}"></small></div><b class="lb-vval"></b>
  <div class="lb-vsl"><input type="range" min="0" max="100" step="1" data-i18n-title="${l}"><button type="button" class="lb-vplay" data-i18n-title="set.preview">${IC.play}</button></div></div>`;
const X_BTN = `<button class="lb-x" type="button" aria-label="Zamknij">${IC.x}</button>`;
const HTML = `
<div class="lb-shade"></div>
<header class="lb-top">
  <div class="lb-logo">FASOL<b>KA</b></div><i class="lb-beta">BETA</i>
  <div class="lb-sp"></div>
  <button class="lb-chip lb-wchip" id="lb-walletchip" type="button" aria-label="Portfel"><span class="lb-coin">₮</span><span class="lb-wbal"><b id="lb-bal">—</b><small>USDT</small></span><span class="lb-plus">+</span></button>
  <button class="lb-chip lb-achip" id="lb-acct" type="button"><span class="lb-av" id="lb-acct-av">?</span><span class="lb-aname" id="lb-acct-name"></span></button>
  <button class="lb-burger" id="lb-burger" type="button" aria-label="Menu" aria-haspopup="menu" aria-expanded="false"><span></span><span></span><span></span></button>
</header>
<nav class="lb-menu" id="lb-menu" role="menu" hidden>
  <button type="button" role="menuitem" data-act="settings">${IC.gear}<span data-i18n="menu.settings"></span></button>
  <button type="button" role="menuitem" data-act="wallet">${IC.wallet}<span data-i18n="menu.wallet"></span></button>
  <button type="button" role="menuitem" data-act="auth">${IC.user}<span></span></button>
  <hr>
  <button type="button" role="menuitem" data-act="admin">${IC.shield}<span data-i18n="menu.admin"></span></button>
  <button type="button" role="menuitem" data-act="logout" class="danger">${IC.logout}<span data-i18n="menu.logout"></span></button>
</nav>
<div class="lb-plate" id="lb-plate"><span id="lb-plate-name"></span><small data-i18n="plate.ready"></small><em data-i18n="plate.skin"></em></div>
<div class="lb-dock">
  <div class="lb-card">
    <button class="lb-mode" id="lb-mode" type="button" aria-haspopup="dialog"><div class="lb-thumb" id="lb-mode-ic"></div>
      <div class="lb-mtxt"><small data-i18n="mode.label"></small><span id="lb-mode-name"></span><em id="lb-mode-desc"></em></div><i class="lb-chev"><span data-i18n="mode.change"></span> ›</i></button>
    <div class="lb-stakewrap" id="lb-stake-wrap">
      <div class="lb-lbl"><span data-i18n="stake.label"></span><span class="lb-usdt">USDT · Solana</span></div>
      <div class="lb-stake" id="lb-stake">
        <button type="button" data-stake="5"><b>5</b><small>USDT</small></button><button type="button" data-stake="10"><b>10</b><small>USDT</small></button>
        <button type="button" data-stake="20"><b>20</b><small>USDT</small></button><button type="button" data-stake="custom"><b data-i18n="stake.custom"></b><small>1–1000</small></button>
      </div>
      <div class="lb-custom" id="lb-stake-custom" hidden><input id="lb-stake-in" type="number" min="1" max="1000" step="1" inputmode="numeric" data-i18n-ph="stake.range" aria-label="USDT"><span>USDT</span></div>
      <div class="lb-free" id="lb-stake-free" hidden>${IC.info}<span data-i18n="stake.free"></span></div>
      <div class="lb-win lb-fee" id="lb-stake-feerow"><span data-i18n="stake.fee"></span><b id="lb-stake-fee"></b></div>
      <div class="lb-win" id="lb-stake-winrow"><span data-i18n="stake.win"></span><b id="lb-stake-win"></b></div>
    </div>
  </div>
  <div class="lb-playwrap"><button class="lb-play" id="lb-play" type="button"><span class="lb-pl" data-i18n="play"></span><small id="lb-play-sub"></small></button></div>
</div>
<div class="lb-skins" id="lb-skins" role="dialog" aria-label="Skiny" hidden>
  <h2 data-i18n="skins.title"></h2>
  <div class="grid" id="lb-skin-grid"></div>
  <button class="lb-btn pri" id="lb-skin-close" type="button" data-i18n="done"></button>
</div>
<div class="lb-picker" id="lb-picker" role="dialog" aria-label="Tryb gry" hidden>
  <h2 data-i18n="picker.title"></h2>
  <div class="lb-tiles" id="lb-tiles"></div>
  <button class="lb-btn pri" id="lb-close" type="button" data-i18n="done"></button>
</div>
<div class="lb-modal" id="lb-set" hidden><div class="lb-dlg lb-wide" role="dialog" aria-modal="true">
  <div class="lb-dh"><h3 data-i18n="set.title"></h3>${X_BTN}</div>
  <div class="lb-tabs"><button type="button" data-tab="audio" class="on" data-i18n="set.audio"></button><button type="button" data-tab="controls" data-i18n="set.controls"></button><button type="button" data-tab="lang" data-i18n="set.lang"></button></div>
  <div data-pane="audio">
    ${VROW('volume', 'c-move', 'vol', 'set.vMaster', 'set.vMasterD')}
    ${VROW('vMenu', 'c-sys', 'menu', 'set.vMenu', 'set.vMenuD')}
    ${VROW('vGame', 'c-fight', 'cross', 'set.vGame', 'set.vGameD')}
  </div>
  <div data-pane="controls" hidden>
    <h5 class="lb-sec" data-i18n="set.secView"></h5>
    <div class="lb-fovcard">
      <svg class="lb-fovsvg" viewBox="0 0 120 64" aria-hidden="true"><defs><radialGradient id="lbfovg" cx="60" cy="58" r="56" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffc629" stop-opacity=".6"/><stop offset="1" stop-color="#ffc629" stop-opacity=".04"/></radialGradient></defs>
        <path d="M8 58A52 52 0 0 1 112 58" fill="none" stroke="rgba(255,255,255,.1)" stroke-dasharray="2 3"/><path id="lb-fov-wedge" fill="url(#lbfovg)" stroke="#ffc629" stroke-width="1.2" stroke-linejoin="round"/>
        <circle cx="60" cy="58" r="4.5" fill="#ffc629"/><circle cx="60" cy="58" r="8" fill="none" stroke="rgba(255,198,41,.35)"/></svg>
      <div class="lb-fovmain"><div class="lb-row"><label for="lb-fov" data-i18n="set.fov"></label><b id="lb-fov-v"></b></div><small data-i18n="set.fovD"></small><input type="range" id="lb-fov" min="60" max="110" step="1"></div>
    </div>
    <h5 class="lb-sec" data-i18n="set.secKeys"></h5>
    <p class="lb-note" data-i18n="set.bindHint"></p>
    <div class="lb-binds" id="lb-binds"></div>
    <div class="lb-deck">
      <div class="lb-kb" id="lb-kb"></div>
      <div class="lb-mouse">
        <svg class="lb-msvg" viewBox="0 0 64 100" aria-hidden="true"><defs><linearGradient id="lbmb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b3244"/><stop offset="1" stop-color="#141925"/></linearGradient></defs>
          <path d="M32 4C14 4 6 18 6 36v28c0 20 12 32 26 32s26-12 26-32V36C58 18 50 4 32 4z" fill="url(#lbmb)" stroke="rgba(255,255,255,.16)"/>
          <path class="mb" d="M30.5 5.6C16 6.6 8 18.6 8 36v6h22.5z"/><path class="mb" d="M33.5 5.6C48 6.6 56 18.6 56 36v6H33.5z"/>
          <rect class="mw" x="29" y="13" width="6" height="15" rx="3"/><path d="M14 70h36" stroke="rgba(255,255,255,.06)"/><path d="M26 84h12" stroke="rgba(255,255,255,.08)" stroke-linecap="round"/></svg>
        <ul class="lb-mleg"><li><b data-i18n="kb.lmb"></b><span data-i18n="kb.fire"></span></li><li><b data-i18n="kb.rmb"></b><span data-i18n="kb.aim"></span></li><li><b data-i18n="kb.mmb"></b><span data-i18n="kb.wheel"></span></li></ul>
      </div>
      <div class="lb-kbtip" id="lb-kbtip" hidden></div>
    </div>
    <div class="lb-kbfoot"><div class="lb-legend"><span class="c-move" data-i18n="kb.move"></span><span class="c-fight" data-i18n="kb.fight"></span><span class="c-sys" data-i18n="kb.sys"></span></div>
      <button class="lb-btn sm" type="button" id="lb-bind-reset" data-i18n="set.reset"></button></div>
  </div>
  <div data-pane="lang" hidden><div class="lb-langs" id="lb-langs"></div></div>
</div></div>
<div class="lb-modal" id="lb-auth" hidden><div class="lb-dlg lb-sm" role="dialog" aria-modal="true">
  <div class="lb-dh"><h3 data-i18n="auth.title"></h3>${X_BTN}</div>
  <div id="lb-auth-out">
    <div class="lb-tabs"><button type="button" data-tab="login" class="on" data-i18n="auth.login"></button><button type="button" data-tab="register" data-i18n="auth.register"></button></div>
    <form data-pane="login" id="lb-login-form" novalidate>
      <label class="lb-field"><span data-i18n="auth.user"></span><input id="lb-l-user" autocomplete="username" maxlength="16" spellcheck="false" autocapitalize="off"></label>
      <label class="lb-field"><span data-i18n="auth.pass"></span><input id="lb-l-pass" type="password" autocomplete="current-password" maxlength="128"></label>
      <p class="lb-err" id="lb-login-err" hidden></p>
      <button class="lb-btn pri" type="submit" data-i18n="auth.doLogin"></button>
    </form>
    <form data-pane="register" id="lb-reg-form" novalidate hidden>
      <label class="lb-field"><span data-i18n="auth.user"></span><input id="lb-r-user" autocomplete="username" maxlength="16" spellcheck="false" autocapitalize="off"><i data-i18n="auth.userRule"></i></label>
      <label class="lb-field"><span data-i18n="auth.pass"></span><input id="lb-r-pass" type="password" autocomplete="new-password" maxlength="128"><i data-i18n="auth.passRule"></i></label>
      <label class="lb-field"><span data-i18n="auth.pass2"></span><input id="lb-r-pass2" type="password" autocomplete="new-password" maxlength="128"></label>
      <p class="lb-err" id="lb-reg-err" hidden></p>
      <button class="lb-btn pri" type="submit" data-i18n="auth.doRegister"></button>
    </form>
    <p class="lb-note" data-i18n="auth.note"></p>
  </div>
  <div id="lb-auth-in" hidden>
    <div class="lb-me"><span class="lb-av lg" id="lb-me-av"></span><div><small data-i18n="auth.loggedAs"></small><b id="lb-me-name"></b><em><span data-i18n="auth.since"></span> <span id="lb-me-since"></span></em></div></div>
    <button class="lb-btn" type="button" id="lb-logout" data-i18n="auth.logout"></button>
  </div>
</div></div>
<div class="lb-modal" id="lb-wallet" hidden><div class="lb-dlg" role="dialog" aria-modal="true">
  <div class="lb-dh"><h3 data-i18n="w.title"></h3>${X_BTN}</div>
  <div class="lb-balcard">
    <small data-i18n="w.balance"></small>
    <div class="lb-big"><b id="lb-w-bal">—</b><span>USDT</span></div>
    <div class="lb-net">${IC.sol}<span data-i18n="w.network"></span></div>
    <button class="lb-phantom" type="button" id="lb-phantom">${IC.ghost}<span data-i18n="w.connect"></span><code id="lb-w-addr"></code></button>
  </div>
  <div class="lb-test">${IC.warn}<span data-i18n="w.test"></span></div>
  <div class="lb-tabs"><button type="button" data-tab="deposit" class="on" data-i18n="w.deposit"></button><button type="button" data-tab="withdraw" data-i18n="w.withdraw"></button><button type="button" data-tab="history" data-i18n="w.history"></button></div>
  <form data-pane="deposit" id="lb-dep-form" novalidate>
    <p class="lb-note" data-i18n="w.depHint"></p>
    <div class="lb-quick"><button type="button" data-q="10">+10</button><button type="button" data-q="50">+50</button><button type="button" data-q="100">+100</button><button type="button" data-q="500">+500</button></div>
    <label class="lb-field"><span data-i18n="w.amount"></span><input id="lb-dep-amt" type="number" min="1" max="10000" step="0.01" inputmode="decimal" placeholder="0.00"></label>
    <button class="lb-btn pri" type="submit" data-i18n="w.doDeposit"></button>
  </form>
  <form data-pane="withdraw" id="lb-wd-form" novalidate hidden>
    <label class="lb-field"><span data-i18n="w.address"></span><input id="lb-wd-addr" maxlength="44" spellcheck="false" autocapitalize="off" placeholder="7xKX…"></label>
    <label class="lb-field"><span data-i18n="w.amount"></span><input id="lb-wd-amt" type="number" min="1" max="10000" step="0.01" inputmode="decimal" placeholder="0.00"></label>
    <button class="lb-btn pri" type="submit" data-i18n="w.doWithdraw"></button>
  </form>
  <div data-pane="history" hidden><ul class="lb-hist" id="lb-hist"></ul></div>
</div></div>
<div class="lb-modal" id="lb-admin" hidden><div class="lb-dlg lb-adm lb-wide" role="dialog" aria-modal="true">
  <div class="lb-dh"><h3>Panel admina</h3>${X_BTN}</div>
  <div class="lb-tabs"><button type="button" data-atab="lobby" class="on">Lobby</button><button type="button" data-atab="skins">Skiny</button></div>
  <div data-apane="lobby">
    <p class="lb-note" style="margin:-4px 0 14px">Ustawienia zapisują się w tej przeglądarce.</p>
    <h4>Mapa lobby</h4><div id="lb-admin-maps"></div>
    <div class="row"><button class="lb-btn" id="lb-admin-cancel" type="button">Anuluj</button><button class="lb-btn pri" id="lb-admin-save" type="button">Zapisz i przeładuj lobby</button></div>
  </div>
  <div data-apane="skins" hidden>
    <p class="lb-note" style="margin:-4px 0 12px">Skiny z kreatora. Zmiany widać od razu u Ciebie. „Opublikuj w grze” zapisuje je w repozytorium, więc po odświeżeniu strony zobaczą je wszyscy gracze.</p>
    <div class="lb-askins" id="lb-askins"></div>
    <button class="lb-btn" id="lb-askin-new" type="button" style="width:auto;padding:0 16px">+ Nowy skin</button>
    <details class="lb-agh" id="lb-agh"><summary>Publikowanie na GitHubie</summary>
      <label class="lb-field"><span>Repozytorium</span><input id="lb-gh-repo" spellcheck="false" autocapitalize="off" placeholder="użytkownik/repo"></label>
      <label class="lb-field"><span>Token GitHub (dostęp Contents: zapis do tego repo)</span><input id="lb-gh-token" type="password" autocomplete="off" spellcheck="false"></label>
      <p class="lb-note" style="margin:8px 0 0">Token zostaje tylko w tej przeglądarce.</p>
    </details>
    <p class="lb-note" id="lb-askin-status"></p>
    <div class="row"><button class="lb-btn" id="lb-askin-dl" type="button">Pobierz skins.json</button><button class="lb-btn pri" id="lb-askin-pub" type="button">Opublikuj w grze</button></div>
  </div>
</div></div>
<div class="lb-draw" id="lb-draw" hidden>
  <small class="lb-dsub">1 v 1</small>
  <h2 class="lb-dtitle" data-i18n="draw.title"></h2>
  <div class="lb-reelwin"><div class="lb-reel" id="lb-reel"></div></div>
  <div class="lb-dres" id="lb-draw-res"></div>
  <div class="lb-dstake" id="lb-draw-stake"></div>
</div>
<div class="lb-toast" id="lb-toast" role="status" aria-live="polite"></div>`;

// ilustracje kafelków (SVG 320x200): same napisy na tłach; uid = unikalne id gradientów w dokumencie
let artN = 0;
const DEFS = u => `<radialGradient id="vg${u}" cx=".5" cy=".5" r=".72"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></radialGradient>
  <radialGradient id="hl${u}" cx=".5" cy=".42" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <linearGradient id="gold${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffbe8"/><stop offset=".3" stop-color="#ffe9a0"/><stop offset=".5" stop-color="#f3b632"/><stop offset=".51" stop-color="#b06c10"/><stop offset=".8" stop-color="#e9a52a"/><stop offset="1" stop-color="#ffe08a"/></linearGradient>
  <linearGradient id="slv${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#f1f4ff"/><stop offset=".51" stop-color="#cdd6ee"/><stop offset="1" stop-color="#f4f7ff"/></linearGradient>
  <filter id="gr${u}"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="${u}"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .09 0"/></filter>
  <filter id="bl${u}" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="7"/></filter>
  <filter id="ds${u}" x="-30%" y="-10%" width="160%" height="120%"><feDropShadow dx="2.5" dy="1" stdDeviation="2" flood-color="#000" flood-opacity=".55"/></filter>
  <pattern id="ht${u}" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="3.5" cy="3.5" r="1.3" fill="#fff"/></pattern>
  <linearGradient id="hm${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <mask id="mk${u}"><rect width="320" height="200" fill="url(#hm${u})"/></mask>`;
const TXT = 'font-family="Anton,Impact,sans-serif" text-anchor="middle" stroke-linejoin="round"';
// duży napis: poświata, wytłoczenie w głąb (kilka warstw), obrys i połysk; y = środek wysokości liter
function bigText(u, y, size, plain, spans, depth = '#1c0b16') {
  const base = y + size * .36, sw = size * .085;
  return `<g transform="translate(154 ${base}) skewX(-10)">
    <text ${TXT} y="${-size * .02}" font-size="${size}" fill="#fff" opacity=".45" filter="url(#bl${u})">${plain}</text>
    ${[7, 5.5, 4, 2.5].map(d => `<text ${TXT} y="${d}" x="${d * .35}" font-size="${size}" fill="${depth}" stroke="${depth}" stroke-width="${sw}">${plain}</text>`).join('')}
    <text ${TXT} font-size="${size}" stroke="#120a1c" stroke-width="${sw}" paint-order="stroke">${spans}</text></g>`;
}
// pojedynczy znak z wytłoczeniem (do układu 1 VS 1)
function glyph(u, x, base, size, ch, fill, depth = '#1c0b16') {
  const sw = size * .085;
  return `<g transform="translate(${x} ${base}) skewX(-10)">
    <text ${TXT} y="${-size * .02}" font-size="${size}" fill="#fff" opacity=".4" filter="url(#bl${u})">${ch}</text>
    ${[8, 6, 4, 2].map(d => `<text ${TXT} y="${d}" x="${d * .35}" font-size="${size}" fill="${depth}" stroke="${depth}" stroke-width="${sw}">${ch}</text>`).join('')}
    <text ${TXT} font-size="${size}" stroke="#120a1c" stroke-width="${sw}" paint-order="stroke" fill="${fill}">${ch}</text></g>`;
}
const finish = u => `<rect width="320" height="200" fill="url(#vg${u})"/><rect width="320" height="200" filter="url(#gr${u})"/>`;
const halftone = u => `<rect width="320" height="200" fill="url(#ht${u})" opacity=".14" mask="url(#mk${u})"/>`;
const stripes = (n, op) => `<g stroke="#fff" stroke-opacity="${op}" stroke-width="2">${Array.from({ length: n }, (_, i) => `<line x1="${-60 + i * 22}" y1="200" x2="${i * 22}" y2="0"/>`).join('')}</g>`;
// poszarpana krawędź w zygzaku (błyskawica / rozdarty papier) od (x0,0) do (x1,200)
function tear(u, x0, x1) {
  let seed = 97 * u + 13; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const C = [], Lp = [], Rp = [], N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N, y = t * 200, bx = x0 + (x1 - x0) * t, z = (i % 2 ? 1 : -1) * (5 + r() * 9) * (i && i < N ? 1 : 0);
    C.push([bx + z, y]);
    for (let k = 0; k < 2; k++) {                       // drobne włókna papieru między punktami zygzaka
      const yy = y + (k ? 200 / N * .5 : 0); if (yy > 200) continue;
      Lp.push([bx + z - (3 + r() * 4), yy]); Rp.push([bx + z + (3 + r() * 5), yy]);
    }
  }
  const pts = a => a.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  return { red: `0,0 ${pts(C)} 0,200`, blue: `320,0 ${pts(C)} 320,200`, paper: `${pts(Lp)} ${pts(Rp.slice().reverse())}` };
}
const ART = {
  range() {
    const u = ++artN;
    return `<svg class="art" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice"><defs>${DEFS(u)}
      <linearGradient id="bg${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffa53a"/><stop offset=".5" stop-color="#e2461f"/><stop offset="1" stop-color="#5e0c10"/></linearGradient></defs>
      <rect width="320" height="200" fill="url(#bg${u})"/>${stripes(18, .06)}${halftone(u)}
      <g fill="none" stroke="#fff" stroke-opacity=".14"><circle cx="160" cy="100" r="128" stroke-width="18"/><circle cx="160" cy="100" r="88" stroke-width="15"/><circle cx="160" cy="100" r="50" stroke-width="12"/></g>
      <g stroke="#fff" stroke-opacity=".22" stroke-width="2"><line x1="160" y1="0" x2="160" y2="200"/><line x1="0" y1="100" x2="320" y2="100"/></g>
      <rect width="320" height="200" fill="url(#hl${u})"/>
      ${bigText(u, 100, 62, 'STRZELNICA', '<tspan fill="url(#slv' + u + ')">STRZELNICA</tspan>', '#4a0d0a')}
      ${finish(u)}</svg>`;
  },
  duel() {
    // niebieski | biała błyskawica | czerwony; duże jedynki, mniejsze złote VS, wszystko na środku
    const u = ++artN;
    // błyskawica / _ / : stroma, zygzak na środku za VS
    const boltPts = [[166, -4], [184, -4], [160, 93], [186, 93], [176, 204], [158, 204], [170, 107], [144, 107]];
    const P = a => a.map(q => q.join(',')).join(' ');
    const bolt = P(boltPts);
    return `<svg class="art" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice"><defs>${DEFS(u)}
      <linearGradient id="bu${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#21b0f2"/><stop offset="1" stop-color="#0577c4"/></linearGradient>
      <linearGradient id="rd${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff3a3a"/><stop offset="1" stop-color="#c8101c"/></linearGradient>
      <linearGradient id="wb${u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#eef2f8"/><stop offset=".5" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe6ef"/></linearGradient></defs>
      <rect width="320" height="200" fill="url(#rd${u})"/>
      <polygon points="-4,-4 166,-4 144,107 170,107 158,204 -4,204" fill="url(#bu${u})"/>
      ${stripes(18, .06)}<rect width="320" height="200" fill="url(#hl${u})"/>
      <polygon points="${bolt}" fill="#fff" opacity=".55" filter="url(#bl${u})"/>
      <polygon points="${bolt}" fill="#000" opacity=".3" transform="translate(3 2)"/>
      <polygon points="${bolt}" fill="url(#wb${u})" stroke="#fff" stroke-width="1" stroke-linejoin="miter"/>
      ${glyph(u, 94, 136, 100, '1', `url(#slv${u})`, '#0a2a66')}${glyph(u, 232, 136, 100, '1', `url(#slv${u})`, '#5a0712')}
      ${glyph(u, 162, 131, 86, 'VS', `url(#gold${u})`, '#3a1a04')}
      ${finish(u)}</svg>`;
  },
  soon() {
    const u = ++artN;
    return `<svg class="art" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice"><defs>${DEFS(u)}
      <radialGradient id="bg${u}" cx=".5" cy=".45" r=".75"><stop offset="0" stop-color="#3a5394"/><stop offset=".6" stop-color="#18234a"/><stop offset="1" stop-color="#080d22"/></radialGradient></defs>
      <rect width="320" height="200" fill="url(#bg${u})"/>${stripes(18, .05)}${halftone(u)}
      ${bigText(u, 100, 50, 'COMING SOON...', '<tspan fill="#d6e1f7">COMING SOON...</tspan>', '#070b1c')}
      ${finish(u)}</svg>`;
  },
};
export const LOBBY_MAPS = [
  { id: 'pole-bitwy', name: 'Pole bitwy', desc: 'Zachód słońca, okopy, czołgi i wioska' },
  { id: 'las', name: 'Las', desc: 'Dzień, gęsty las i wioska, bez czołgów' },
  { id: 'hangar', name: 'Hangar', desc: 'Jasny hangar z autami i arsenałem' },
];
export const BUILTIN_SKINS = [
  { id: 'klasyk', name: 'Klasyczna', c: 0xf0b440 },
  { id: 'kamuflaz', name: 'Kamuflaż', c: 0x5a6438, c2: 0x7f7548, c3: 0x2f3524, p: 1, tag: 'WOJSKO' },
  { id: 'pustynia', name: 'Pustynia', c: 0xc9b07a, c2: 0x9c7e4f, c3: 0x6e5a3a, p: 1, tag: 'WOJSKO' },
  { id: 'arbuz', name: 'Arbuz', c: 0x3f9a3a, c2: 0x1f5e22, p: 2 },
  { id: 'truskawka', name: 'Truskawka', c: 0xe0343a, c2: 0xffe66b, p: 3 },
  { id: 'jagoda', name: 'Jagoda', c: 0x4f5fd6 },
  { id: 'mieta', name: 'Mięta', c: 0x7fe0c0 },
  { id: 'wegiel', name: 'Węgiel', c: 0x34363b },
  { id: 'lawa', name: 'Lawa', c: 0x2a1c18, c2: 0xff6a1a, p: 5, tag: 'RZADKI' },
  { id: 'zlota', name: 'Złota', c: 0xffc23a, metal: true, tag: 'LEGENDA' },
  { id: 'teczowa', name: 'Tęczowa', c: 0xffffff, p: 4, tag: 'RZADKI' },
  { id: 'arktyka', name: 'Arktyka', c: 0xe8eef2, c2: 0xb9c7d2, c3: 0x8a9aa8, p: 1, tag: 'WOJSKO' },
];
// skiny z kreatora: najpierw te wbudowane w plik gry (skins-data.js), potem lobby wczytuje aktualne ./skins.json z repo
export const SKINS = [...BUILTIN_SKINS, ...CUSTOM_SKINS];
const SKIN_GLSL = `uniform float uPat,uRim,uHasTex;uniform vec3 uC2,uC3,uRimC;uniform sampler2D uTex;uniform vec4 uProj;uniform float uVmap[129],uVmapOn;varying vec3 vObj;
  float skinV(float y){float t=clamp((y-uProj.z)/(uProj.w-uProj.z),0.,1.);if(uVmapOn<.5)return t;t*=128.;int i=int(min(floor(t),127.));return mix(uVmap[i],uVmap[i+1],t-float(i));}
  float h3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
  float vn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}`;
// Nakłada skin na materiał skóry fasolki (kolor + wzór + metal). Działa też na postaci w grze.
export function applySkin(mat, skin) {
  if (!mat.userData.skinU) {
    const U = { uPat: { value: 0 }, uC2: { value: new THREE.Color() }, uC3: { value: new THREE.Color() }, uRim: { value: 0 }, uRimC: { value: new THREE.Color(0xfff0a8) },
      uTex: { value: null }, uHasTex: { value: 0 }, uProj: { value: new THREE.Vector4() }, uVmap: { value: new Array(129).fill(0) }, uVmapOn: { value: 0 } };
    mat.userData.skinU = U;
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = 'varying vec3 vObj;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
      sh.fragmentShader = SKIN_GLSL + '\n' + sh.fragmentShader
        .replace('#include <color_fragment>', `#include <color_fragment>
          float lavaGlow = 0.; vec3 P = vObj;
          if (uPat > .5 && uPat < 1.5) { float n = vn(P * 4.2) * .65 + vn(P * 9.) * .35; diffuseColor.rgb = n < .43 ? diffuseColor.rgb : (n < .58 ? uC2 : uC3); }
          else if (uPat > 1.5 && uPat < 2.5) { float a = atan(P.z, P.x); float st = step(.5, fract(a * 1.6 + vn(P * 7.) * .18)); diffuseColor.rgb = mix(diffuseColor.rgb, uC2, st); }
          else if (uPat > 2.5 && uPat < 3.5) { vec3 q = P * 15.; float d = length(fract(q) - .5); diffuseColor.rgb = mix(diffuseColor.rgb, uC2, step(d, .17) * step(.55, h3(floor(q)))); }
          else if (uPat > 3.5 && uPat < 4.5) { diffuseColor.rgb = .55 + .45 * cos(6.2832 * (P.y * 1.1 + vec3(0., .33, .67))); }
          else if (uPat > 4.5) { float n = vn(P * 6.5) * .7 + vn(P * 13.) * .3; lavaGlow = 1. - smoothstep(.0, .07, abs(n - .5)); diffuseColor.rgb = mix(diffuseColor.rgb, uC2, lavaGlow); }
          if (uHasTex > .5) { vec2 d = P.xz - uProj.xy;          // rysunek z kreatora: walec wokół osi korpusu, przód = środek tekstury
            vec4 tx = texture2D(uTex, vec2(atan(-d.x, -d.y) / 6.2831853 + .5, skinV(P.y)));
            diffuseColor.rgb = mix(diffuseColor.rgb, tx.rgb, tx.a); }`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance += uC2 * lavaGlow * 2.2;
          float rimK = 1. - abs(dot(normalize(normal), normalize(vViewPosition)));
          totalEmissiveRadiance += uRimC * pow(rimK, 2.6) * uRim * 1.2 + uRimC * uRim * .02;
          if (uPat < -.5) totalEmissiveRadiance += diffuseColor.rgb * (.18 + .5 * pow(rimK, 3.));`);
    };
    mat.customProgramCacheKey = () => 'fasolka-skin';
    mat.needsUpdate = true;
  }
  const U = mat.userData.skinU, P = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };
  mat.color.set(skin.c); U.uPat.value = skin.metal ? -1 : (P[skin.p] || 0); U.uC2.value.set(skin.c2 ?? skin.c); U.uC3.value.set(skin.c3 ?? skin.c);
  mat.metalness = skin.metal ? .35 : 0; mat.roughness = skin.metal ? .3 : .55;
  const tx = mat.userData.body && skin.tex ? skinTexture(skin) : null;   // rysunek tylko na korpusie (ręce/nogi mają inne współrzędne)
  U.uTex.value = tx; U.uHasTex.value = tx ? 1 : 0;
  if (tx) { const j = skin.proj; U.uProj.value.set(j.cx, j.cz, j.y0, j.y1);     // arc-y: v wzdłuż powierzchni (tablica vmap), cylinder-y: v = wysokość
    U.uVmapOn.value = j.type === 'arc-y' && j.vmap ? 1 : 0; if (U.uVmapOn.value) U.uVmap.value = j.vmap; }
}
// tekstura skina z kreatora (data URL w skins-data.js), ładowana raz
const SKIN_TEX = new Map();
function skinTexture(skin) {
  let t = SKIN_TEX.get(skin.tex);
  if (!t) {
    const img = new Image(); t = new THREE.Texture(img);
    t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.wrapS = THREE.RepeatWrapping;
    img.onload = () => { t.needsUpdate = true; }; img.src = skin.tex; SKIN_TEX.set(skin.tex, t);
  }
  return t;
}
// ikona fasolki do kafelka (SVG z kolorem/wzorem)
function skinIcon(sk) {
  if (sk.icon) return `<img src="${sk.icon}" alt="">`;            // skin z kreatora ma gotową ikonkę
  const hex = c => '#' + new THREE.Color(c).getHexString(), c1 = hex(sk.c), c2 = hex(sk.c2 ?? sk.c), c3 = hex(sk.c3 ?? sk.c), id = 'sk' + sk.id;
  let fill = c1, defs = '';
  if (sk.p === 1) { defs = `<pattern id="${id}" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="${c1}"/><path d="M2 4c6-3 9 2 7 6s-7 3-8 0z" fill="${c2}"/><path d="M14 13c5-2 9 1 8 5s-6 4-9 1z" fill="${c3}"/><path d="M12 1c3 0 4 3 2 4s-4 0-2-4z" fill="${c3}"/><path d="M1 16c3-1 5 2 3 4s-4 0-3-4z" fill="${c2}"/></pattern>`; fill = `url(#${id})`; }
  if (sk.p === 2) { defs = `<pattern id="${id}" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="${c1}"/><rect width="4" height="10" fill="${c2}"/></pattern>`; fill = `url(#${id})`; }
  if (sk.p === 3) { defs = `<pattern id="${id}" width="8" height="9" patternUnits="userSpaceOnUse"><rect width="8" height="9" fill="${c1}"/><ellipse cx="3" cy="3" rx="1" ry="1.4" fill="${c2}"/><ellipse cx="7" cy="7.5" rx="1" ry="1.4" fill="${c2}"/></pattern>`; fill = `url(#${id})`; }
  if (sk.p === 4) { defs = `<linearGradient id="${id}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff5a5a"/><stop offset=".25" stop-color="#ffc83a"/><stop offset=".5" stop-color="#5fe36a"/><stop offset=".75" stop-color="#4aa3ff"/><stop offset="1" stop-color="#b56cff"/></linearGradient>`; fill = `url(#${id})`; }
  if (sk.p === 5) { defs = `<pattern id="${id}" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="${c1}"/><path d="M0 6l6 2 4-5 5 4 5-2M3 20l3-7 6 1 3-5 5 3" stroke="${c2}" stroke-width="1.6" fill="none"/></pattern>`; fill = `url(#${id})`; }
  if (sk.metal) { defs = `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3c0"/><stop offset=".45" stop-color="#ffc23a"/><stop offset="1" stop-color="#a86d0e"/></linearGradient>`; fill = `url(#${id})`; }
  return `<svg viewBox="0 0 44 58"><defs>${defs}</defs><rect x="15" y="40" width="5" height="15" rx="2.5" fill="${fill}"/><rect x="24" y="40" width="5" height="15" rx="2.5" fill="${fill}"/>
    <rect x="8" y="3" width="28" height="44" rx="14" fill="${fill}" stroke="rgba(0,0,0,.35)" stroke-width="1.2"/><ellipse cx="16" cy="13" rx="3.5" ry="5" fill="#fff" opacity=".35"/></svg>`;
}
const DEFAULT_MODES = [
  { id: 'range', name: 'Strzelnica', desc: 'Solo · zestrzel czerwone fasolki', icon: 'range', tag: 'SOLO' },
  { id: '1v1', name: '1v1', desc: 'Mapa Oaza · bot · do 5 trafień', icon: 'duel', tag: '1 NA 1' },
  { soon: true },
];

// deterministyczny generator losowy, żeby las wyglądał zawsze tak samo
function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

export function createLobby({ renderer, bean, animate = () => {}, onPlay = () => {}, onSkin = () => {}, modes = DEFAULT_MODES, skins: skinsIn = SKINS }) {
  let skins = skinsIn.slice();
  const rnd = rng(7);
  const R = (a, b) => a + (b - a) * rnd();

  // ---------- DOM ----------
  if (!document.getElementById('lb-font')) {
    const l = document.createElement('link');
    l.id = 'lb-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700;800&family=Rajdhani:wght@500;600;700&family=Oswald:wght@500;600;700&display=swap';
    document.head.appendChild(l);
  }
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const ui = document.createElement('div'); ui.id = 'lb-ui'; ui.innerHTML = HTML; document.body.appendChild(ui);
  const $ = id => ui.querySelector('#' + id);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };
  // ---------- tryby gry ----------
  const playable = modes.filter(m => !m.soon);
  let mode = playable.find(m => m.id === store.get('fasolka-mode')) || playable[0];
  const picker = $('lb-picker'), tiles = $('lb-tiles');
  const mName = m => { const k = 'mode.' + m.id + '.name', v = tr(k); return v === k ? m.name : v; };
  const mDesc = m => { const k = 'mode.' + m.id + '.desc', v = tr(k); return v === k ? m.desc : v; };
  const mTag = m => { const k = 'tag.' + m.id, v = tr(k); return v === k ? (m.tag || 'TRYB') : v; };
  function renderMode() {
    $('lb-mode-name').textContent = mName(mode); $('lb-mode-desc').textContent = mDesc(mode);
    $('lb-mode-ic').innerHTML = ART[mode.icon] ? ART[mode.icon]() : '';
    tiles.querySelectorAll('.lb-tile').forEach(t => {
      if (t.dataset.id) { const m = modes.find(x => x.id === t.dataset.id); t.classList.toggle('sel', m === mode); t.setAttribute('aria-pressed', m === mode);
        t.querySelector('.tag').textContent = mTag(m); t.setAttribute('aria-label', mName(m) + ' – ' + mDesc(m)); t.title = mDesc(m); }
      else t.querySelector('.tag').textContent = tr('soon');
    });
    if (uiApi) uiApi.renderStake();
  }
  let uiApi = null;
  modes.forEach(m => {
    const t = document.createElement('button'); t.type = 'button';
    t.className = 'lb-tile' + (m.soon ? ' soon' : '');
    const icon = m.soon ? 'soon' : m.icon;
    t.innerHTML = (ART[icon] ? ART[icon]() : '') + '<i class="tag"></i><i class="check">✓</i>';
    if (m.soon) { t.disabled = true; t.setAttribute('aria-label', 'Coming soon'); }
    else {
      t.dataset.id = m.id;
      t.addEventListener('click', () => { mode = m; store.set('fasolka-mode', m.id); renderMode(); });
      t.addEventListener('dblclick', () => closePicker());
    }
    tiles.appendChild(t);
  });
  const openPicker = () => { picker.hidden = false; };
  const closePicker = () => { picker.hidden = true; };
  $('lb-mode').addEventListener('click', openPicker);
  $('lb-close').addEventListener('click', closePicker);
  picker.addEventListener('click', e => { if (e.target === picker) closePicker(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !picker.hidden) { closePicker(); e.stopPropagation(); } }, true);
  renderMode();
  const plateName = $('lb-plate-name'), plate = $('lb-plate');

  // ---------- scena ----------
  const scene = new THREE.Scene();
  // ---------- mapa lobby: las (dzień), pole bitwy (zachód, okopy, czołgi) albo hangar ----------
  function buildForest(SUNSET) {
  const HORIZON = new THREE.Color(SUNSET ? 0xf4a46e : 0xcfe9ff);   // zachód słońca albo dzień
  scene.fog = new THREE.FogExp2(HORIZON, 0.0105);   // lekka mgła: przy postaci niewidoczna, gęstnieje z odległością

  // niebo: gradient na kuli
  const skyU = { top: { value: new THREE.Color(SUNSET ? 0x2b2f6b : 0x1d63d8) }, mid: { value: new THREE.Color(SUNSET ? 0xc8657c : 0x5fb0ff) }, bot: { value: HORIZON } };
  const SKY_GLSL = `uniform vec3 top,mid,bot;
    vec3 skyCol(float h){vec3 c=mix(bot,mid,smoothstep(0.,.18,h));return mix(c,top,smoothstep(.18,.75,h));}`;
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `${SKY_GLSL} varying vec3 vP;
      void main(){gl_FragColor=vec4(skyCol(vP.y),1.);
      #include <colorspace_fragment>
      }`,
  })));
  // materiał gór "za mgłą": kolor nieba w tym kierunku zmieszany z barwą góry (amt = ile góry widać)
  const SUN_DIR = (SUNSET ? new THREE.Vector3(-.55, .32, -.77) : new THREE.Vector3(7, 13, 6)).normalize();   // nisko, z lewej za wioską
  function hazeMat(tint, amt, fullAt) {
    return new THREE.ShaderMaterial({
      fog: false,
      uniforms: { ...skyU, tint: { value: new THREE.Color(tint) }, amt: { value: amt }, fullAt: { value: fullAt }, sunDir: { value: SUN_DIR } },
      vertexShader: 'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
      fragmentShader: `${SKY_GLSL} uniform vec3 tint,sunDir;uniform float amt,fullAt;varying vec3 vW;
        void main(){
          vec3 d=normalize(vW-cameraPosition),n=normalize(cross(dFdx(vW),dFdy(vW)));if(dot(n,d)>0.)n=-n;
          float l=.8+.25*max(dot(n,sunDir),0.);
          float k=amt*(.3+.7*smoothstep(-6.,fullAt,vW.y));          // u podnóża więcej mgły
          gl_FragColor=vec4(mix(skyCol(max(d.y,0.)),tint*l,k),1.);
          #include <colorspace_fragment>
        }`,
    });
  }
  const rnd2 = rng(19), R2 = (a, b) => a + (b - a) * rnd2();   // osobny generator, żeby nie ruszać układu lasu

  // słońce z poświatą
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(.18, 'rgba(255,250,220,.95)');
    g.addColorStop(.4, 'rgba(255,240,190,.35)'); g.addColorStop(1, 'rgba(255,240,190,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, fog: false, depthWrite: false, transparent: true }));
  if (SUNSET) { sunSprite.position.set(-150, 58, -430); sunSprite.scale.setScalar(240); sunSprite.material.color.set(0xffc078); } else { sunSprite.position.set(150, 150, -420); sunSprite.scale.setScalar(150); } scene.add(sunSprite);

  // światła
  scene.add(SUNSET ? new THREE.HemisphereLight(0xffb898, 0x3d3324, 1.15) : new THREE.HemisphereLight(0xd6ecff, 0x557a33, 1.35));
  const sun = new THREE.DirectionalLight(SUNSET ? 0xff9a52 : 0xfff0d2, SUNSET ? 2.9 : 2.6);
  sun.target.position.set(0, 0, -10); sun.position.copy(SUN_DIR).multiplyScalar(32).add(sun.target.position); sun.castShadow = true;   // cień obejmuje też wioskę
  const fillL = new THREE.DirectionalLight(0x9aa6d8, SUNSET ? 1.05 : 0); fillL.position.set(4, 6, 10); scene.add(fillL);   // chłodne doświetlenie od kamery
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 60 });
  scene.add(sun, sun.target);

  // teren: płaski w środku, łagodne pagórki dalej
  const heightAt = (x, z) => {
    const d = Math.hypot(x, z * 1.2);
    const k = THREE.MathUtils.smoothstep(d, 45, 110);
    return k * (Math.sin(x * 0.05) * Math.cos(z * 0.045) * 2 + Math.sin(x * 0.017 + 1.3) * 2.5 + 2);
  };
  const grassTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    x.fillStyle = '#62b33d'; x.fillRect(0, 0, 256, 256);
    const r = rng(3);
    for (let i = 0; i < 900; i++) {
      const l = r();
      x.fillStyle = l < .5 ? `rgba(70,140,40,${.25 + r() * .3})` : `rgba(140,205,80,${.2 + r() * .3})`;
      x.beginPath(); x.arc(r() * 256, r() * 256, 2 + r() * 9, 0, 7); x.fill();
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(90, 90);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  })();
  const groundGeo = new THREE.PlaneGeometry(700, 700, 140, 140); groundGeo.rotateX(-Math.PI / 2);
  { const p = groundGeo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i))); groundGeo.computeVertexNormals(); }
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
  ground.receiveShadow = true; scene.add(ground);

  // góry na horyzoncie (bliższe pasmo, lekko zamglone)
  const mountMat = hazeMat(SUNSET ? 0x5b4a6c : 0x6f9cc0, SUNSET ? .8 : .78, 40);
  const snowMat = hazeMat(SUNSET ? 0xffcfc0 : 0xf4f8ff, .82, 40);
  for (let i = 0; i < 12; i++) {
    const h = R(28, 52), r = h * R(1.3, 1.8), g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 9), mountMat); m.position.y = h / 2; g.add(m);
    const s = new THREE.Mesh(new THREE.ConeGeometry(r * .26, h * .26, 9), snowMat); s.position.y = h * .87 + .1; g.add(s);
    g.position.set(-330 + i * 60 + R(-20, 20), -6, R(-300, -250)); g.rotation.y = R(0, 6); scene.add(g);
  }
  // dalekie pasmo: ogromne, ledwo widoczne zza mgły
  const farMat = hazeMat(SUNSET ? 0x6a4f72 : 0x4f74a6, SUNSET ? .3 : .26, 120), farSnow = hazeMat(SUNSET ? 0xffd8c8 : 0xffffff, SUNSET ? .22 : .2, 120);
  for (let i = 0; i < 16; i++) {
    const h = R2(80, 150), r = h * R2(1.4, 2.1), g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 10), farMat); m.position.y = h / 2; g.add(m);
    const sn = new THREE.Mesh(new THREE.ConeGeometry(r * .22, h * .22, 10), farSnow); sn.position.y = h * .89 + .2; g.add(sn);
    g.position.set(-800 + i * 105 + R2(-30, 30), -10, R2(-640, -540)); g.rotation.y = R2(0, 6); scene.add(g);
  }

  // chmury
  const cloudMat = new THREE.MeshStandardMaterial({ color: SUNSET ? 0xffc9a8 : 0xffffff, emissive: SUNSET ? 0xa0506a : 0x9fb8d8, emissiveIntensity: SUNSET ? .55 : .6, roughness: 1, fog: false });
  const cloudGeo = new THREE.SphereGeometry(1, 18, 12);
  const clouds = [];
  for (let i = 0; i < 16; i++) {
    const c = new THREE.Group(), n = 5 + Math.floor(R(0, 4));
    for (let j = 0; j < n; j++) {
      const p = new THREE.Mesh(cloudGeo, cloudMat), s = R(5, 10) * (1 - Math.abs(j - n / 2) / n);
      p.scale.set(s, s * .8, s); p.position.set((j - n / 2) * 6 + R(-2, 2), R(0, 3), R(-3, 3)); c.add(p);
    }
    const flat = new THREE.Mesh(cloudGeo, cloudMat); flat.scale.set(n * 3.6, 2.2, 7); flat.position.y = -1.5; c.add(flat);
    c.position.set(R(-320, 320), R(45, 110), R(-380, -120)); c.scale.setScalar(R(.8, 1.6));
    c.userData.v = R(.6, 1.6); scene.add(c); clouds.push(c);
  }

  // ptaki: kilka kluczy przelatuje po niebie, machają skrzydłami i czasem szybują
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x2c3746, side: THREE.DoubleSide, fog: false });
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([.24, 0, 0, -.22, 0, 0, -.16, 0, .82], 3));
  const birdBody = new THREE.ConeGeometry(.07, .5, 5); birdBody.rotateZ(-Math.PI / 2);   // dziób w +X
  function makeBird() {
    const g = new THREE.Group(), L = new THREE.Mesh(wingGeo, birdMat), Rw = new THREE.Mesh(wingGeo, birdMat);
    Rw.scale.z = -1; g.add(new THREE.Mesh(birdBody, birdMat), L, Rw);
    g.userData = { L, R: Rw, ph: rnd2() * 6.28, f: R2(8, 10.5) }; return g;
  }
  const flocks = [];
  // lot po skosie (nie idealnie w poprzek kadru), żeby z ziemi było widać rozpiętość skrzydeł
  function launchFlock(f, first) {
    const dir = rnd2() < .5 ? 1 : -1, tilt = (rnd2() < .5 ? 1 : -1) * R2(.6, .85);
    const h = dir > 0 ? tilt : Math.PI - tilt;                       // obrót wokół Y; lokalne +X = kierunek lotu
    f.v = new THREE.Vector3(Math.cos(h), 0, -Math.sin(h)); f.group.rotation.y = h;
    f.speed = R2(5.5, 8.5); f.y = R2(13, 21);
    const cross = new THREE.Vector3(R2(-18, 18), f.y, R2(-105, -70));   // gdzie klucz przetnie środek kadru
    const back = first ? R2(5, 25) : R2(90, 200);
    f.group.position.copy(cross).addScaledVector(f.v, -back);
    f.left = back + 140;                                              // ile jeszcze leci, zanim wróci na start
  }
  for (let i = 0; i < 3; i++) {
    const group = new THREE.Group(), n = 3 + Math.floor(R2(0, 5)), birds = [];
    for (let j = 0; j < n; j++) {                       // formacja V za przewodnikiem
      const b = makeBird(), row = Math.ceil(j / 2), side = j % 2 ? 1 : -1;
      b.position.set(-row * 1.7 + R2(-.3, .3), R2(-.35, .35), row * side * 1.5); b.scale.setScalar(R2(1.9, 2.4));
      group.add(b); birds.push(b);
    }
    const f = { group, birds, bob: R2(0, 6) }; launchFlock(f, i === 0); scene.add(group); flocks.push(f);
  }

  // ---------- wioska ~20 m za graczem ----------
  const village = buildVillage(scene, heightAt);
  const battle = SUNSET ? buildBattlefield(scene, heightAt) : { zones: [], update() {} };
  village.zones.push(...battle.zones);   // drzewa omijają też okopy, czołgi i leje

  // ---------- las: gęsty, zwarty, z nieregularnymi koronami (instancje, kołysanie na wietrze) ----------
  const hash3 = (x, y, z) => { const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return v - Math.floor(v); };
  const jitter = (g, amt, seed) => { const p = g.attributes.position;                 // te same punkty przesuwają się tak samo (brak dziur)
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = o => hash3(x * 3.1 + o + seed, y * 3.7 + o, z * 2.9) - .5;
      p.setXYZ(i, x + n(1) * amt, y + n(5) * amt * .6, z + n(9) * amt); } return g; };
  const paint = (g, fn) => { const p = g.attributes.position, c = new Float32Array(p.count * 3), col = new THREE.Color();
    for (let i = 0; i < p.count; i++) { fn(p.getX(i), p.getY(i), p.getZ(i), col); c.set([col.r, col.g, col.b], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; };
  const prep = g => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); return g; };
  const TRUNK = new THREE.Color(0x6b4426), tmpC = new THREE.Color();
  const trunkPart = (h, r0, r1) => { const g = new THREE.CylinderGeometry(r1, r0, h, 7); g.translate(0, h / 2, 0); return paint(prep(jitter(g, .04, 3)), (x, y, z, c) => c.copy(TRUNK).multiplyScalar(.75 + .25 * y / h)); };
  function pineGeo(layers, h, r0, seed, dark, light) {
    const parts = [trunkPart(1.5, .27, .16)], D = new THREE.Color(dark), L = new THREE.Color(light);
    for (let k = 0; k < layers; k++) {
      const t = k / (layers - 1), r = r0 * (1 - .74 * t), ch = 2.1 - .7 * t, y0 = .55 + t * (h - .55 - ch);
      const g = new THREE.ConeGeometry(r, ch, 10, 2); const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) if (p.getY(i) < -ch / 2 + .01) { const a = Math.atan2(p.getZ(i), p.getX(i)); p.setY(i, p.getY(i) - (Math.round(a / (Math.PI / 5)) % 2 ? .28 : 0) * r / r0); }   // poszarpany, opadający brzeg
      g.translate(0, y0 + ch / 2, 0); jitter(g, .22 * r / r0 + .08, seed + k);
      parts.push(paint(prep(g), (x, y, z, c) => { c.lerpColors(D, L, Math.min(1, y / h * .9 + .1)); const edge = Math.hypot(x, z) / r; c.multiplyScalar(.8 + .3 * edge); }));
    }
    return mergeGeometries(parts);
  }
  function leafGeo(blobs, trunkH, seed, base) {
    const parts = [trunkPart(trunkH, .28, .17)], B = new THREE.Color(base);
    for (const [x, y, z, r] of blobs) {
      const g = new THREE.IcosahedronGeometry(r, 1); g.translate(x, y, z); jitter(g, .32 * r, seed + x * 7);
      const tint = .85 + hash3(x, y, z) * .3;
      parts.push(paint(prep(g), (px, py, pz, c) => { c.copy(B).multiplyScalar(tint * (.62 + .5 * THREE.MathUtils.clamp((py - y + r) / (2 * r), 0, 1))); }));
    }
    return mergeGeometries(parts);
  }
  const TREES = [
    pineGeo(5, 6.4, 1.75, 11, 0x1d5a2a, 0x46a04c),                  // świerk
    pineGeo(4, 5.4, 1.95, 23, 0x235f2c, 0x52a650),                  // jodła, szersza
    leafGeo([[0, 3.3, 0, 1.6], [1.05, 2.8, .3, 1.15], [-.95, 2.95, -.4, 1.2], [.2, 4.1, -.45, 1.05], [-.35, 2.55, .95, 1.0], [.65, 3.75, .85, .95]], 2.3, 31, 0x5fae3c),
    leafGeo([[0, 3.9, 0, 1.35], [.7, 3.2, .4, 1.05], [-.7, 3.4, -.3, 1.05], [.1, 4.9, .1, 1.0], [-.2, 2.8, -.8, .9], [.4, 2.7, .9, .85]], 2.6, 47, 0x4f9e34),
    leafGeo([[0, .55, 0, .75], [.6, .45, .25, .55], [-.55, .5, -.2, .6], [.1, .9, -.35, .5]], .1, 59, 0x4c9a32),   // krzak podszytu
  ];
  const wind = { value: 0 };
  const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .95 });
  treeMat.onBeforeCompile = sh => {
    sh.uniforms.uTime = wind;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 wp = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      #else
        vec3 wp = vec3(0.0);
      #endif
      float hh = max(position.y - 1.2, 0.0);
      transformed.x += sin(uTime * 1.3 + wp.x * .17 + wp.z * .11) * .022 * hh;
      transformed.z += cos(uTime * 1.05 + wp.z * .13 + wp.x * .07) * .016 * hh;`);
  };
  // granica lasu: z tyłu dalej (żeby było widać niebo i góry), po bokach bliżej (rama kadru), nieregularna
  const edgeR = th => 24 + 26 * Math.pow(Math.max(0, Math.cos(th)), 1.5) + 4 * Math.sin(th * 5 + 1.3) + 2.5 * Math.sin(th * 11 + .4);
  const lists = TREES.map(() => ({ near: [], far: [] }));
  const put = (type, x, z, sc, near) => village.zones.some(v => Math.hypot(x - v.x, z - v.z) < v.r) ? 0 : lists[type][near ? 'near' : 'far'].push({ x, z, y: heightAt(x, z) - .1, s: sc, ry: rnd() * 6.28, sx: R(.88, 1.12), sy: R(.9, 1.12) });
  const plant = (x, z, d, e) => {
    const nearEdge = d < e + 6, pine = rnd() < (nearEdge ? .48 : .66);
    const type = pine ? (rnd() < .6 ? 0 : 1) : (rnd() < .55 ? 2 : 3);
    put(type, x, z, pine ? R(.88, 1.22) : R(.85, 1.2), d < 24);
  };
  for (const [step, dmin, dmax, prob] of [[3.4, 0, 70, .62], [4.2, 70, 160, .78]]) {
    for (let gx = -150; gx <= 150; gx += step) for (let gz = -160; gz <= 6; gz += step) {
      const x = gx + R(-.45, .45) * step, z = gz + R(-.45, .45) * step, d = Math.hypot(x, z), th = Math.atan2(x, -z), e = edgeR(th);
      if (d < Math.max(e, dmin) || d >= dmax) continue;
      const clump = Math.sin(x * .085 + 1.7) * Math.cos(z * .075 - .6) * .5 + .5 + (Math.sin(x * .23 - z * .19) * .25);   // kępy i prześwity
      if (rnd() > prob * THREE.MathUtils.clamp(clump * 1.5 - .15, .08, 1.3)) continue;
      plant(x, z, d, e);
    }
  }
  for (let i = 0; i < 90; i++) {                                           // trochę podszytu przy skraju lasu
    const th = R(-2.3, 2.3), r = edgeR(th) + R(-1, 3), x = Math.sin(th) * r, z = -Math.cos(th) * r;
    if (z > 6) continue; put(4, x, z, R(.8, 1.5), r < 22);
  }
  // pojedyncze drzewa i małe kępy na łące w różnych odległościach – dają głębię
  [[-10.5, -5.5, 2], [11.5, -7, 0], [-16, -1.5, 1], [17, -3, 3],
   [-16.5, -13.5, 0], [-15.6, -25, 3], [17.5, -25, 2], [18.6, -21.5, 0], [-21, -30, 1], [-10, -31, 2], [9, -33, 0], [22, -34, 3], [-26, -15, 0], [27, -14, 2]]
    .forEach(([x, z, t]) => put(t, x, z, R(.95, 1.2), Math.hypot(x, z) < 24));
  const dummy = new THREE.Object3D(), tint = new THREE.Color();
  lists.forEach((L, type) => { for (const [arr, cast] of [[L.near, true], [L.far, false]]) {
    if (!arr.length) continue;
    const m = new THREE.InstancedMesh(TREES[type], treeMat, arr.length);
    arr.forEach((t, i) => { dummy.position.set(t.x, t.y, t.z); dummy.rotation.set(0, t.ry, 0); dummy.scale.set(t.s * t.sx, t.s * t.sy, t.s * t.sx); dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix); m.setColorAt(i, tint.setRGB(R(.84, 1.06), R(.88, 1.08), R(.8, 1.0))); });
    m.castShadow = cast; m.receiveShadow = true; scene.add(m);
  } });
  // ciemniejsza ściółka pod drzewami
  { const p = groundGeo.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), d = Math.hypot(x, z), k = 1 - .38 * THREE.MathUtils.smoothstep(d, edgeR(Math.atan2(x, -z)) - 1, edgeR(Math.atan2(x, -z)) + 7);
      c.set([k, k * .97 + .03 * (1 - k), k], i * 3); }
    groundGeo.setAttribute('color', new THREE.BufferAttribute(c, 3)); ground.material.vertexColors = true; ground.material.needsUpdate = true; }
  const leafMats = [0x5fae3c, 0x4f9e34, 0x78c043, 0x8acb4c].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true }));
  const blobGeo = new THREE.IcosahedronGeometry(1, 1);

  // krzaki, kamienie
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x9aa3a8, roughness: 1, flatShading: true });
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  [[-2.8, -2.2, .32], [3.4, -2.8, .45], [2.3, 1.0, .18], [-3.9, .3, .24], [7.4, -8.2, .7], ...(SUNSET ? [] : [[-7, -9, .9]])].forEach(([x, z, s]) => {
    const r = new THREE.Mesh(rockGeo, rockMat); r.scale.set(s * 1.3, s * .8, s); r.position.set(x, s * .35, z);
    r.rotation.set(rnd(), rnd() * 6, rnd()); r.castShadow = r.receiveShadow = true; scene.add(r);
  });
  [[-3.4, -3], [4.2, -1.6], [-2, -5.5], [2.8, -6], [-5.6, -1.5], [6.5, -3]].forEach(([x, z]) => {
    const b = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(blobGeo, leafMats[k % 4]); const s = R(.32, .5);
      m.scale.set(s, s * .8, s); m.position.set(R(-.35, .35), s * .55, R(-.25, .25)); m.castShadow = m.receiveShadow = true; b.add(m);
    }
    b.position.set(x, 0, z); scene.add(b);
  });

  // kępki trawy i kwiatki (instancje)
  const bladeGeo = new THREE.ConeGeometry(.025, .2, 3); bladeGeo.translate(0, .1, 0);
  const blades = new THREE.InstancedMesh(bladeGeo, new THREE.MeshStandardMaterial({ roughness: 1 }), 2600);
  const flowerGeo = new THREE.IcosahedronGeometry(.03, 0);
  const flowers = new THREE.InstancedMesh(flowerGeo, new THREE.MeshStandardMaterial({ roughness: .7, emissive: 0x222222 }), 260);
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
    const greens = [0x5aa935, 0x6dbd3f, 0x4e9a2e, 0x86cf4f];
    for (let i = 0; i < blades.count; i++) {
      const a = rnd() * 6.283, r = .9 + Math.pow(rnd(), .7) * 16;
      p.set(Math.cos(a) * r, 0, Math.sin(a) * r * .9 - 2); if (p.z > 2.5) p.z = R(-12, 2.5); p.y = heightAt(p.x, p.z);
      e.set(R(-.35, .35), rnd() * 6, R(-.35, .35)); q.setFromEuler(e); const s = R(.6, 1.2); sc.set(s, s * R(.8, 1.3), s);
      blades.setMatrixAt(i, m.compose(p, q, sc)); blades.setColorAt(i, col.set(greens[i % 4]));
    }
    const petals = [0xffffff, 0xffe14a, 0xff7eb6, 0xb58cff, 0xff9a3c];
    for (let i = 0; i < flowers.count; i++) {
      const a = rnd() * 6.283, r = 1.1 + rnd() * 13;
      p.set(Math.cos(a) * r, 0, Math.sin(a) * r * .9 - 2); if (p.z > 2.5) p.z = R(-12, 2.5); p.y = heightAt(p.x, p.z) + R(.1, .2);
      q.identity(); sc.setScalar(R(.8, 1.5));
      flowers.setMatrixAt(i, m.compose(p, q, sc)); flowers.setColorAt(i, col.set(petals[i % petals.length]));
    }
  }
  blades.receiveShadow = true; scene.add(blades, flowers);

  // pyłki unoszące się w powietrzu
  const POLLEN = 140;
  const pollenGeo = new THREE.BufferGeometry();
  const pp = new Float32Array(POLLEN * 3);
  for (let i = 0; i < POLLEN; i++) { pp[i * 3] = R(-8, 8); pp[i * 3 + 1] = R(0, 5); pp[i * 3 + 2] = R(-8, 4); }
  pollenGeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const pollen = new THREE.Points(pollenGeo, new THREE.PointsMaterial({
    size: .07, map: glowTex, transparent: true, depthWrite: false, color: 0xfff6c8, opacity: .9,
  }));
  scene.add(pollen);

    return (t, dt) => {
      wind.value = t; village.update(t, dt); battle.update(t, dt);
      clouds.forEach(c => { c.position.x += c.userData.v * dt; if (c.position.x > 360) c.position.x = -360; });
      flocks.forEach(f => {
        const p = f.group.position;
        p.addScaledVector(f.v, f.speed * dt); p.y = f.y + Math.sin(t * .45 + f.bob) * .8;
        f.left -= f.speed * dt; if (f.left < 0) launchFlock(f, false);
        f.birds.forEach(b => {
          const u = b.userData, glide = THREE.MathUtils.smoothstep(Math.sin(t * .35 + u.ph), .45, .8);
          const a = THREE.MathUtils.lerp(.15 + Math.sin(t * u.f + u.ph) * .6, .1, glide);
          u.L.rotation.x = -a; u.R.rotation.x = a; b.position.y += Math.cos(t * u.f + u.ph) * .002;
        });
      });
      const pa = pollenGeo.attributes.position;
      for (let i = 0; i < POLLEN; i++) {
        let y = pa.getY(i) + dt * (.12 + (i % 5) * .03); if (y > 5) y = 0;
        pa.setY(i, y); pa.setX(i, pa.getX(i) + Math.sin(t * .8 + i) * dt * .08);
      }
      pa.needsUpdate = true;
    };
  }
  const LOBBY_MAP = LOBBY_MAPS.some(m => m.id === store.get('fasolka-lobby-map')) ? store.get('fasolka-lobby-map') : LOBBY_MAPS[0].id;
  const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 1200);
  let envUpdate;
  if (LOBBY_MAP === 'hangar') { const h = buildHangar(scene, renderer); envUpdate = (t, dt) => h.update(t, dt); }
  else envUpdate = buildForest(LOBBY_MAP === 'pole-bitwy');

  // cień kontaktowy pod fasolką
  const blob = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = .01; return m;
  })();
  scene.add(blob);

  // hologram pod fasolką: mały, cyjanowy, z obracającymi się kreskami i lekkim snopem światła
  const holoTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    x.strokeStyle = 'rgba(120,240,255,.95)'; x.lineWidth = 6; x.beginPath(); x.arc(128, 128, 118, 0, 7); x.stroke();
    x.lineWidth = 3; x.strokeStyle = 'rgba(120,240,255,.7)'; x.beginPath(); x.arc(128, 128, 96, 0, 7); x.stroke();
    x.lineWidth = 8; for (let i = 0; i < 8; i++) { x.beginPath(); x.arc(128, 128, 107, i * Math.PI / 4, i * Math.PI / 4 + .45); x.stroke(); }
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 96); g.addColorStop(0, 'rgba(90,220,255,.28)'); g.addColorStop(1, 'rgba(90,220,255,.05)'); x.fillStyle = g; x.beginPath(); x.arc(128, 128, 96, 0, 7); x.fill();
    x.fillStyle = 'rgba(160,250,255,.18)'; for (let y = 0; y < 256; y += 6) x.fillRect(0, y, 256, 2);                        // linie skanowania
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const ringM = new THREE.MeshBasicMaterial({ map: holoTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .9, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), ringM); ring.rotation.x = -Math.PI / 2; ring.position.y = .05; scene.add(ring);
  const beamTex = (() => { const c = document.createElement('canvas'); c.width = 8; c.height = 64; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 64, 0, 0); g.addColorStop(0, 'rgba(110,235,255,.45)'); g.addColorStop(1, 'rgba(110,235,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 8, 64);
    const t = new THREE.CanvasTexture(c); return t; })();
  const discM = new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: .35, toneMapped: false });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(.42, .46, .5, 32, 1, true), discM); disc.position.y = .27; scene.add(disc);

  // fasolka
  const holder = new THREE.Group(); holder.add(bean); scene.add(holder);
  const hitProxy = new THREE.Mesh(new THREE.CylinderGeometry(.48, .48, 1.75, 10), new THREE.MeshBasicMaterial({ visible: false })); hitProxy.position.y = .87; holder.add(hitProxy);
  const skinMats = [];                                   // materiały skóry fasolki (z gry: userData.mats.skin, inaczej wszystkie)
  if (bean.userData.mats && bean.userData.mats.skin) skinMats.push(bean.userData.mats.skin, ...(bean.userData.mats.body ? [bean.userData.mats.body] : []));
  else bean.traverse(o => { if (o.isMesh && o.material && !skinMats.includes(o.material)) skinMats.push(o.material); });
  let skin = skins.find(k => k.id === store.get('fasolka-skin')) || skins[0];
  const setSkin = (k, keep) => { skin = k; skinMats.forEach(m => applySkin(m, k)); if (!keep) store.set('fasolka-skin', k.id); onSkin(k);
    skinGrid.querySelectorAll('.lb-skin').forEach(b => b.classList.toggle('sel', b.dataset.id === k.id)); };
  const skinPanel = $('lb-skins'), skinGrid = $('lb-skin-grid');
  const buildSkinGrid = () => { skinGrid.innerHTML = '';
    skins.forEach(k => { const b = document.createElement('button'); b.type = 'button'; b.className = 'lb-skin'; b.dataset.id = k.id;
      b.innerHTML = skinIcon(k) + '<span></span><small></small>'; b.querySelector('span').textContent = skinName(k); b.querySelector('small').textContent = k.tag || '';
      b.classList.toggle('sel', k.id === skin.id);
      b.addEventListener('click', () => { setSkin(k); hopT = 0; }); skinGrid.appendChild(b); }); };
  buildSkinGrid();
  const BUILTIN_IDS = new Set(BUILTIN_SKINS.map(k => k.id));
  // podmienia skiny z kreatora (z skins.json albo z panelu admina) i od razu przebudowuje kafelki
  const setCustomSkins = list => {
    skins = [...BUILTIN_SKINS, ...list.filter(k => k && k.id && !BUILTIN_IDS.has(k.id))];
    const want = skins.find(k => k.id === store.get('fasolka-skin'));
    if (want && want !== skin) setSkin(want, true);
    else if (!skins.some(k => k.id === skin.id)) setSkin(skins[0], true);
    else { const same = skins.find(k => k.id === skin.id); if (same !== skin) setSkin(same, true); }
    buildSkinGrid();
  };
  fetch('./skins.json?v=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : null)
    .then(list => { if (Array.isArray(list)) setCustomSkins(list); }).catch(() => {});
  const openSkins = () => { skinPanel.hidden = false; picker.hidden = true; };
  const closeSkins = () => { skinPanel.hidden = true; };
  $('lb-skin-close').addEventListener('click', closeSkins);
  addEventListener('keydown', e => { if (e.key === 'Escape' && !skinPanel.hidden) { closeSkins(); e.stopPropagation(); } }, true);
  let hopT = -1;
  setSkin(skin, true);
  // panel admina: wybór mapy lobby (zmiana wymaga przeładowania strony)
  const admin = $('lb-admin'), adminMaps = $('lb-admin-maps');
  LOBBY_MAPS.forEach(m => { const l = document.createElement('label'); l.innerHTML = '<input type="radio" name="lb-lmap"><div><b></b><small></small></div>';
    const inp = l.querySelector('input'); inp.value = m.id; inp.checked = m.id === LOBBY_MAP; l.querySelector('b').textContent = m.name; l.querySelector('small').textContent = m.desc; adminMaps.appendChild(l); });
  const showATab = id => { admin.querySelectorAll('[data-atab]').forEach(b => b.classList.toggle('on', b.dataset.atab === id));
    admin.querySelectorAll('[data-apane]').forEach(p => p.hidden = p.dataset.apane !== id); if (id === 'skins') openASkins(); };
  admin.querySelectorAll('[data-atab]').forEach(b => b.addEventListener('click', () => showATab(b.dataset.atab)));
  const openAdmin = () => { adminMaps.querySelectorAll('input').forEach(i => i.checked = i.value === LOBBY_MAP); admin.hidden = false;
    if (!admin.querySelector('[data-apane=skins]').hidden) openASkins(); };

  // ---------- panel admina: skiny z kreatora (lista, dodawanie, edycja w kreatorze, usuwanie, publikacja) ----------
  const aList = $('lb-askins'), aStat = $('lb-askin-status'), ghRepo = $('lb-gh-repo'), ghTok = $('lb-gh-token');
  let draft = null, dirty = false;
  const ghCfg = (() => { try { return JSON.parse(localStorage.getItem('fasolka-gh')) || {}; } catch { return {}; } })();
  ghRepo.value = ghCfg.repo || 'smolka77/bean-fps'; ghTok.value = ghCfg.token || '';
  const saveGh = () => { try { localStorage.setItem('fasolka-gh', JSON.stringify({ repo: ghRepo.value.trim(), token: ghTok.value.trim() })); } catch {} };
  ghRepo.addEventListener('change', saveGh); ghTok.addEventListener('change', saveGh);
  const setStat = (t, bad) => { aStat.textContent = t; aStat.style.color = bad ? '#ff8a8a' : ''; };
  function openASkins() { if (!draft || !dirty) draft = skins.filter(k => !BUILTIN_IDS.has(k.id)).map(k => ({ ...k })); renderASkins(); }
  function renderASkins() {
    aList.innerHTML = '';
    if (!draft.length) { const p = document.createElement('p'); p.className = 'lb-note'; p.textContent = 'Nie ma jeszcze skinów z kreatora. Kliknij „+ Nowy skin”.'; aList.appendChild(p); }
    draft.forEach((k, i) => {
      const row = document.createElement('div'); row.className = 'lb-askin';
      row.innerHTML = '<img alt=""><div class="nm"><b></b><small></small></div><input title="Napis pod nazwą (tag)" maxlength="12">'
        + '<button type="button" data-a="up" title="W górę">↑</button><button type="button" data-a="down" title="W dół">↓</button>'
        + '<button type="button" data-a="edit">Edytuj</button><button type="button" data-a="del" class="del">Usuń</button>';
      if (k.icon) row.querySelector('img').src = k.icon; else row.querySelector('img').remove();
      row.querySelector('b').textContent = k.name; row.querySelector('small').textContent = k.id + (k.tex ? '' : ' · bez rysunku');
      const tag = row.querySelector('input'); tag.value = k.tag || '';
      tag.addEventListener('change', () => { k.tag = tag.value.trim().toUpperCase(); changed(); });
      row.querySelector('[data-a=up]').disabled = i === 0; row.querySelector('[data-a=down]').disabled = i === draft.length - 1;
      row.addEventListener('click', e => { const a = e.target.closest('button')?.dataset.a; if (!a) return;
        if (a === 'up' || a === 'down') { const j = a === 'up' ? i - 1 : i + 1; [draft[i], draft[j]] = [draft[j], draft[i]]; changed(); }
        else if (a === 'del') { if (confirm('Usunąć skin „' + k.name + '”?')) { draft.splice(i, 1); changed(); } }
        else if (a === 'edit') openKreator(k, d => { draft[i] = fromKreator(d, k); changed(); }); });
      aList.appendChild(row);
    });
  }
  function changed() { dirty = true; setCustomSkins(draft); renderASkins(); setStat('Masz nieopublikowane zmiany. Kliknij „Opublikuj w grze”.'); }
  const uniqueId = base => { base = base || 'skin'; let id = base, n = 2; const used = new Set([...BUILTIN_IDS, ...draft.map(k => k.id)]); while (used.has(id)) id = base + '-' + n++; return id; };
  function fromKreator(d, prev) {
    return { id: prev ? prev.id : uniqueId(d.id), name: d.name || 'Skin', c: d.c || '#ffffff', eyes: d.eyes === true, tag: prev ? prev.tag : 'WŁASNY',
      ...(d.tex ? { tex: d.tex, proj: d.proj } : {}), ...(d.icon ? { icon: d.icon } : {}) };
  }
  // kreator skinów w nakładce (ten sam plik co samodzielny kreator, w trybie ?embed)
  function openKreator(k, done) {
    let ov = document.getElementById('lb-kreator');
    if (!ov) { ov = document.createElement('div'); ov.id = 'lb-kreator'; document.body.appendChild(ov); }
    ov.innerHTML = ''; const fr = document.createElement('iframe'); fr.src = './kreator-skinow.html?embed=1'; fr.title = 'Kreator skinów'; ov.appendChild(fr); ov.hidden = false;
    const close = () => { removeEventListener('message', onMsg); ov.hidden = true; ov.innerHTML = ''; };
    const onMsg = e => {
      if (e.source !== fr.contentWindow) return; const m = e.data || {};
      if (m.type === 'fasolka-kreator-ready') fr.contentWindow.postMessage({ type: 'fasolka-skin-load',
        skin: k ? { format: 'fasolka-skin', version: 1, id: k.id, name: k.name, c: k.c, eyes: k.eyes, tex: k.tex || null, proj: k.proj } : null }, '*');
      else if (m.type === 'fasolka-skin-save' && m.skin && m.skin.format === 'fasolka-skin') { close(); done(m.skin); }
      else if (m.type === 'fasolka-kreator-close') close();
    };
    addEventListener('message', onMsg);
  }
  $('lb-askin-new').addEventListener('click', () => openKreator(null, d => { draft.push(fromKreator(d)); changed(); }));
  const skinsJson = () => '[\n' + draft.map(k => JSON.stringify(k)).join(',\n') + '\n]\n';
  $('lb-askin-dl').addEventListener('click', () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([skinsJson()], { type: 'application/json' }));
    a.download = 'skins.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); });
  $('lb-askin-pub').addEventListener('click', async () => {
    saveGh(); const repo = ghRepo.value.trim(), token = ghTok.value.trim();
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !token) { $('lb-agh').open = true; return setStat('Wpisz repozytorium i token GitHub w sekcji „Publikowanie na GitHubie”.', true); }
    const btn = $('lb-askin-pub'); btn.disabled = true; setStat('Publikuję…');
    try {
      const url = 'https://api.github.com/repos/' + repo + '/contents/skins.json', H = { Authorization: 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28' };
      const g = await fetch(url + '?ref=main', { headers: { ...H, Accept: 'application/vnd.github.object' }, cache: 'no-store' });
      if (!g.ok && g.status !== 404) throw new Error('GitHub ' + g.status + (g.status === 401 ? ' (zły token)' : ''));
      const sha = g.ok ? (await g.json()).sha : undefined;
      const bytes = new TextEncoder().encode(skinsJson()); let bin = ''; for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode(...bytes.subarray(i, i + 32768));
      const p = await fetch(url, { method: 'PUT', headers: { ...H, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Skiny: zmiany z panelu admina (' + draft.length + ')', content: btoa(bin), branch: 'main', ...(sha ? { sha } : {}) }) });
      if (!p.ok) { let msg = ''; try { msg = (await p.json()).message; } catch {} throw new Error('GitHub ' + p.status + (msg ? ': ' + msg : '')); }
      dirty = false; setStat('Opublikowano. Gracze zobaczą zmiany po odświeżeniu strony (GitHub Pages potrzebuje 1–2 minut).');
    } catch (err) { setStat('Nie udało się opublikować: ' + (err && err.message || err), true); }
    btn.disabled = false;
  });
  $('lb-admin-cancel').addEventListener('click', () => admin.hidden = true);
  admin.addEventListener('click', e => { if (e.target === admin) admin.hidden = true; });
  admin.querySelector('.lb-x').addEventListener('click', () => admin.hidden = true);
  $('lb-admin-save').addEventListener('click', () => { const v = adminMaps.querySelector('input:checked').value; store.set('fasolka-lobby-map', v); if (v !== LOBBY_MAP) location.reload(); else admin.hidden = true; });
  addEventListener('keydown', e => { if (!active) return; if (e.ctrlKey && e.shiftKey && e.code === 'KeyA') { e.preventDefault(); admin.hidden ? openAdmin() : (admin.hidden = true); }
    if (e.key === 'Escape' && !admin.hidden) { admin.hidden = true; e.stopPropagation(); } }, true);
  bean.rotation.y = Math.PI;                 // model patrzy w -Z, kamera stoi na +Z
  bean.traverse(o => { if (o.isMesh) o.castShadow = true; });

  // ---------- kamera i sterowanie ----------
  const lookAt = new THREE.Vector3();
  let camZ = 5.4;
  function frameCamera() {
    camera.aspect = innerWidth / innerHeight;
    const portrait = camera.aspect < 0.8;
    camera.fov = LOBBY_MAP === 'hangar' ? (portrait ? 44 : 36) : (portrait ? 42 : 30);
    camZ = LOBBY_MAP === 'hangar' ? (portrait ? 6.0 : 5.3) : (portrait ? 6.2 : 6);
    lookAt.set(0, portrait ? 1.2 : 1.0, 0);
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', frameCamera); frameCamera();

  const canvas = renderer.domElement;
  let active = true, dragging = false, lastX = 0, rotY = 0, rotVel = 0, mx = 0, my = 0, cmx = 0, cmy = 0;
  let beanHover = false, hoverK = 0, downX = 0, downY = 0, moved = 0;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const overBean = e => { const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera); return ray.intersectObject(hitProxy, false).length > 0; };
  canvas.addEventListener('pointerdown', e => { if (!active) return; dragging = true; lastX = downX = e.clientX; downY = e.clientY; moved = 0; try { canvas.setPointerCapture(e.pointerId); } catch {} });
  addEventListener('pointermove', e => {
    mx = e.clientX / innerWidth * 2 - 1; my = e.clientY / innerHeight * 2 - 1;
    if (!active) return;
    beanHover = e.target === canvas && overBean(e); ui.classList.toggle('bean-hover', beanHover); plate.classList.toggle('hov', beanHover);
    if (!dragging) return;
    moved = Math.max(moved, Math.hypot(e.clientX - downX, e.clientY - downY));
    const dx = e.clientX - lastX; lastX = e.clientX; rotVel = dx * .012; rotY += rotVel;
  });
  addEventListener('pointerup', e => { if (dragging && active && moved < 6 && e.target === canvas && overBean(e)) { openSkins(); hopT = 0; } dragging = false; });
  canvas.style.cursor = '';
  const syncCursor = () => { canvas.style.cursor = active && beanHover ? 'pointer' : ''; };

  const play = $('lb-play');
  play.addEventListener('click', () => { if (active && !uiApi.open) uiApi.requestPlay(); });

  // ---------- interfejs: menu, ustawienia, konto, portfel, stawki, losowanie mapy ----------
  uiApi = initLobbyUI({
    ui, $, openAdmin,
    getMode: () => mode.id,
    setName: n => { plateName.textContent = n; },
    play: (id, opts) => { if (active) onPlay(id, opts); },
    refresh: () => { renderMode(); skinGrid.querySelectorAll('.lb-skin').forEach(b => { const k = skins.find(x => x.id === b.dataset.id); if (k) b.querySelector('span').textContent = skinName(k); }); },
  });

  // ---------- pętla ----------
  const head = new THREE.Vector3();
  let t = 0;
  const state = { wave: 0, dragging: false };
  function update(dt) {
    t += dt;
    if (!dragging) { rotVel *= .93; rotY += rotVel; rotY += (Math.sin(t * .35) * .3 - rotY) * .008; }
    holder.rotation.y = rotY;
    state.dragging = dragging;                    // state.wave zostaje 0: postać nie macha
    animate(bean, t, dt, state);
    hoverK = THREE.MathUtils.damp(hoverK, beanHover ? 1 : !skinPanel.hidden ? .35 : 0, 10, dt); syncCursor();
    skinMats.forEach(m => { if (m.userData.skinU) m.userData.skinU.uRim.value = hoverK * (.75 + .25 * Math.sin(t * 6)); });
    ring.rotation.z = t * .6; ring.scale.setScalar(1 + hoverK * (.08 + .03 * Math.sin(t * 6)));
    ringM.opacity = (.55 + .45 * hoverK) * (.9 + .1 * Math.sin(t * 23) * Math.sin(t * 3.1)); discM.opacity = .25 + .3 * hoverK; disc.scale.set(1, 1 + hoverK * .6, 1); disc.position.y = .27 * (1 + hoverK * .6);
    if (hopT >= 0) { hopT += dt * 2.8; const k = Math.min(hopT, 1); holder.position.y = Math.sin(k * Math.PI) * .35; if (hopT >= 1) { hopT = -1; holder.position.y = 0; } }

    cmx = THREE.MathUtils.damp(cmx, mx, 2.5, dt); cmy = THREE.MathUtils.damp(cmy, my, 2.5, dt);
    camera.position.set(cmx * .35, .8 - cmy * .1, camZ);
    camera.lookAt(lookAt);

    envUpdate(t, dt);

    renderer.render(scene, camera);

    // tabliczka z nickiem nad głową
    head.set(0, 1.78, 0); holder.localToWorld(head); head.project(camera);
    plate.style.transform = `translate(${(head.x * .5 + .5) * innerWidth}px,${(-head.y * .5 + .5) * innerHeight}px) translate(-50%,-100%)`;
  }

  function show() { active = true; ui.classList.remove('lb-hidden'); uiApi.onShow(); }
  function hide() { active = false; dragging = false; beanHover = false; picker.hidden = true; skinPanel.hidden = true; admin.hidden = true; uiApi.closeAll(); canvas.style.cursor = ''; ui.classList.add('lb-hidden'); }

  return { scene, camera, update, show, hide, get active() { return active; }, get mode() { return mode.id; }, get skin() { return skin; }, ui };
}
