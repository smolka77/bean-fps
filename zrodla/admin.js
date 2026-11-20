// Panel admina Fasolki: przegląd graczy, ich statystyki, liczby ogólne (gracze, mecze, stawki, wygrane, prowizja 10%),
// wykresy aktywności, ostatnie mecze, ustawienie mapy lobby dla wszystkich i antycheat (mecze do sprawdzenia, powtórki, blokady).
// Otwierany osobnym linkiem (adres gry z #admin na końcu) albo skrótem Ctrl+Shift+A w lobby – nie ma go w menu.
// Dostęp ma tylko właściciel artefaktu. Dane: baza artefaktu (accounts/*, matches/*, config/lobby);
// poza claude.ai – konta z pamięci tej przeglądarki (tryb lokalny).
import { LOBBY_MAPS, DEFAULT_LOBBY, BUILTIN_SKINS, SKINS } from './lobby.js';
import { walletApi } from './wallet-config.js';
import { AUTH_TXT } from './lobby-ui.js';
import qrcode from 'qrcode-generator';
// serwer portfeli (gdy ustawiony): prawdziwe konta, adresy depozytów i salda SOL wszystkich graczy
const SRV = walletApi();
const srvToken = () => { try { return localStorage.getItem('bl-token'); } catch { return null; } };
// sesja panelu po logowaniu login + hasło + kod 2FA (30 min bez ruchu, max 12 h): tylko w tej karcie (sessionStorage), wysyłana w nagłówku X-Admin-Token
const admTok = {
  get() { try { return sessionStorage.getItem('bl-admin') || ''; } catch { return ''; } },
  set(v) { try { v ? sessionStorage.setItem('bl-admin', v) : sessionStorage.removeItem('bl-admin'); } catch {} },
};
const AH = () => ({ 'Content-Type': 'application/json', 'X-Admin-Token': admTok.get() });   // panel ma własne konta – bez tokenu gracza
async function srvPost(p, body) {
  const r = await fetch(SRV + p, { method: 'POST', headers: AH(), body: JSON.stringify(body || {}) }); const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.message || 'Błąd serwera'); e.code = j.error; throw e; } return j;
}
let lastOpts = {};

const CSS = `
#fa-admin{--bg:#0a0e17;--card:rgba(255,255,255,.035);--card2:rgba(255,255,255,.06);--line:rgba(255,255,255,.08);--line2:rgba(255,255,255,.15);
  --tx:#eef1f7;--mut:#8e9ab0;--acc:#ffc629;--ok:#34d27f;--bad:#ff7a6b;
  position:fixed;inset:0;z-index:100;overflow:auto;background:radial-gradient(120% 60% at 50% 0%,#141c2e 0%,var(--bg) 60%);color:var(--tx);
  font:500 14px/1.45 Inter,system-ui,-apple-system,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;color-scheme:dark}
#fa-admin *{box-sizing:border-box}
#fa-admin [hidden]{display:none!important}
#fa-admin button{font:inherit;color:inherit}
#fa-admin .fa-wrap{max-width:1280px;margin:0 auto;padding:max(18px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) 40px max(16px,env(safe-area-inset-left))}
#fa-admin .fa-head{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:18px}
#fa-admin .fa-brand{display:flex;align-items:baseline;gap:12px}
#fa-admin .fa-brand b{font:400 30px/1 Anton,Oswald,Impact,sans-serif;letter-spacing:.04em;transform:skewX(-6deg)}
#fa-admin .fa-brand b{font-family:Anton,Impact,'Arial Narrow Bold',sans-serif;background:linear-gradient(100deg,#ff2e93 0%,#ff5470 48%,#ff9a3c 100%);-webkit-background-clip:text;background-clip:text;color:transparent;padding-right:.05em}
#fa-admin .fa-brand span{font:700 20px/1 Rajdhani,Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--mut)}
#fa-admin .fa-live{display:inline-flex;align-items:center;gap:7px;font:600 12px/1 Inter,sans-serif;color:var(--mut);padding:6px 10px;border:1px solid var(--line2);border-radius:999px}
#fa-admin .fa-live::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--mut)}
#fa-admin .fa-live.on::before{background:var(--ok);box-shadow:0 0 8px var(--ok)}
#fa-admin .fa-sp{flex:1}
#fa-admin .fa-btn{height:38px;padding:0 14px;border-radius:10px;border:1px solid var(--line2);background:var(--card);cursor:pointer;font-weight:600;display:inline-flex;align-items:center;gap:8px}
#fa-admin .fa-btn:hover{background:var(--card2);border-color:rgba(255,198,41,.5)}
#fa-admin .fa-btn.pri{border:0;background:linear-gradient(180deg,#ffd84d,#ffb411);color:#1d1300}
#fa-admin .fa-btn:disabled{opacity:.6;cursor:progress}
#fa-admin .fa-note{margin:0 0 16px;padding:10px 14px;border-radius:12px;border:1px solid rgba(255,176,32,.35);background:rgba(255,176,32,.08);color:#ffd38a;font-size:13px}
#fa-admin .fa-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:14px}
#fa-admin .fa-kpi{padding:16px 16px 14px;border-radius:16px;background:var(--card);border:1px solid var(--line)}
#fa-admin .fa-kpi small{display:block;font:700 10.5px/1.2 Inter,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--mut)}
#fa-admin .fa-kpi b{display:block;margin:8px 0 4px;font:700 32px/1 Rajdhani,Oswald,sans-serif;letter-spacing:.01em;white-space:nowrap}
#fa-admin .fa-kpi b u{text-decoration:none;font:700 13px Inter,sans-serif;color:var(--mut);margin-left:6px;letter-spacing:.06em}
#fa-admin .fa-kpi span{display:block;font-size:12px;color:var(--mut)}
#fa-admin .fa-kpi.hi{border-color:rgba(255,198,41,.45);background:linear-gradient(160deg,rgba(255,198,41,.13),rgba(255,198,41,.02))}
#fa-admin .fa-kpi.hi b{color:var(--acc)}
#fa-admin .fa-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}
#fa-admin .fa-card{padding:16px;border-radius:16px;background:var(--card);border:1px solid var(--line);margin-bottom:14px;min-width:0}
#fa-admin .fa-grid2 .fa-card{margin-bottom:0}
#fa-admin .fa-ch{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px}
#fa-admin .fa-ch h3{margin:0;font:700 18px/1.2 Rajdhani,Oswald,sans-serif;letter-spacing:.06em;text-transform:uppercase}
#fa-admin .fa-ch small{color:var(--mut);font-size:12px}
#fa-admin .fa-chart{position:relative}
#fa-admin .fa-chart svg{display:block;width:100%;height:auto;overflow:visible}
#fa-admin .fa-chart .grid line{stroke:rgba(255,255,255,.07)}
#fa-admin .fa-chart .ax text{fill:var(--mut);font:500 10px Inter,sans-serif}
#fa-admin .fa-chart .bar{fill:var(--acc)}
#fa-admin .fa-chart .hit{fill:transparent;cursor:default}
#fa-admin .fa-chart .hit:hover+.hl,#fa-admin .fa-chart .hl.on{opacity:1}
#fa-admin .fa-chart .hl{fill:rgba(255,255,255,.05);opacity:0;pointer-events:none}
#fa-admin .fa-tip{position:absolute;pointer-events:none;transform:translate(-50%,calc(-100% - 10px));padding:7px 10px;border-radius:9px;background:#05070c;border:1px solid var(--line2);
  font:600 12px/1.3 Inter,sans-serif;white-space:nowrap;box-shadow:0 10px 24px rgba(0,0,0,.5)}
#fa-admin .fa-tip small{display:block;color:var(--mut);font-weight:500}
#fa-admin .fa-empty{padding:26px 10px;text-align:center;color:var(--mut);font-size:13px}
#fa-admin .fa-q{height:38px;min-width:0;width:min(280px,100%);padding:0 12px;border-radius:10px;border:1px solid var(--line2);background:rgba(0,0,0,.3);color:var(--tx);font:500 14px Inter,sans-serif;outline:none}
#fa-admin .fa-q:focus{border-color:var(--acc)}
#fa-admin .fa-tw{overflow-x:auto;margin:0 -16px;padding:0 16px}
#fa-admin table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;min-width:1100px}
#fa-admin th{position:sticky;top:0;text-align:right;font:700 10.5px/1.2 Inter,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--mut);padding:10px 10px;border-bottom:1px solid var(--line2);white-space:nowrap;cursor:pointer;user-select:none}
#fa-admin th:first-child,#fa-admin td:first-child{text-align:left}
#fa-admin th:hover{color:var(--tx)}
#fa-admin th.s{color:var(--acc)}
#fa-admin th.s::after{content:" ↓"}#fa-admin th.s.asc::after{content:" ↑"}
#fa-admin td{padding:10px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}
#fa-admin tbody tr{cursor:pointer}
#fa-admin tbody tr:hover td{background:rgba(255,255,255,.035)}
#fa-admin .fa-u{display:flex;align-items:center;gap:10px;font-weight:600}
#fa-admin .fa-av{width:28px;height:28px;flex:none;border-radius:8px;display:grid;place-items:center;background:linear-gradient(150deg,#ffd76a,#f09a1a);color:#3a2200;font:700 14px/1 Rajdhani,sans-serif}
#fa-admin .pos{color:var(--ok)}#fa-admin .neg{color:var(--bad)}#fa-admin .mut{color:var(--mut)}
#fa-admin .fa-list{list-style:none;margin:0;padding:0;max-height:430px;overflow:auto}
#fa-admin .fa-list li{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 2px;border-bottom:1px solid var(--line)}
#fa-admin .fa-list li:last-child{border-bottom:0}
#fa-admin .fa-list b{display:block;font-weight:600}
#fa-admin .fa-list small{display:block;color:var(--mut);font-size:12px}
#fa-admin .fa-list .r{text-align:right;font:700 15px/1.2 Rajdhani,Oswald,sans-serif;white-space:nowrap}
#fa-admin .fa-tag{display:inline-block;font:700 10px/1 Inter,sans-serif;letter-spacing:.08em;padding:4px 6px;border-radius:5px;margin-left:6px;vertical-align:1px}
#fa-admin .fa-tag.w{background:rgba(52,210,127,.15);color:var(--ok)}#fa-admin .fa-tag.l{background:rgba(255,122,107,.14);color:var(--bad)}#fa-admin .fa-tag.f{background:rgba(255,255,255,.08);color:var(--mut)}
#fa-admin .fa-maps label{display:flex;gap:12px;align-items:flex-start;padding:12px;border:1px solid var(--line);border-radius:12px;margin-bottom:8px;cursor:pointer}
#fa-admin .fa-maps label:hover{background:rgba(255,255,255,.03)}
#fa-admin .fa-maps label:has(input:checked){border-color:var(--acc);background:rgba(255,198,41,.07)}
#fa-admin .fa-maps input{margin-top:3px;accent-color:#ffc629}
#fa-admin .fa-maps b{display:block;font-weight:600}
#fa-admin .fa-maps small{color:var(--mut);font-size:12px}
#fa-admin .fa-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:12px}
#fa-admin .fa-dmg{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px 12px}
#fa-admin .fa-dmf{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--mut)}
#fa-admin .fa-dmf input{width:100%}
#fa-admin .fa-dmw input.fa-q{width:74px;padding:6px 7px;font-size:12px}
#fa-admin .fa-dmw td,#fa-admin .fa-dmw th{padding:4px 5px;white-space:nowrap;font-size:12px}
#fa-admin .fa-msg{font-size:13px;color:var(--mut)}
#fa-admin .fa-msg.ok{color:var(--ok)}#fa-admin .fa-msg.err{color:var(--bad)}
#fa-admin .fa-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:6px}
#fa-admin .fa-meta div{padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.03);border:1px solid var(--line)}
#fa-admin .fa-meta small{display:block;color:var(--mut);font-size:11.5px}
#fa-admin .fa-meta b{font:700 17px/1.3 Rajdhani,Oswald,sans-serif}
#fa-admin .fa-drw{position:fixed;inset:0;z-index:2;display:flex;justify-content:flex-end;background:rgba(3,6,14,.55);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
#fa-admin .fa-drw>div{width:min(520px,100%);height:100%;overflow:auto;padding:20px;background:#0e1422;border-left:1px solid var(--line2);box-shadow:-20px 0 60px rgba(0,0,0,.5)}
#fa-admin .fa-dh{display:flex;align-items:center;gap:12px;margin-bottom:14px}
#fa-admin .fa-dh .fa-av{width:46px;height:46px;border-radius:13px;font-size:24px}
#fa-admin .fa-dh h3{margin:0;font:700 26px/1.1 Rajdhani,Oswald,sans-serif;letter-spacing:.03em}
#fa-admin .fa-dh small{display:block;color:var(--mut);font-size:12px}
#fa-admin .fa-x{margin-left:auto;width:36px;height:36px;border-radius:10px;border:1px solid var(--line2);background:var(--card);cursor:pointer;font-size:18px}
#fa-admin h4{margin:18px 0 8px;font:700 11px Inter,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--mut)}
#fa-admin .fa-deny{max-width:460px;margin:12vh auto 0;text-align:center;padding:28px;border-radius:18px;background:var(--card);border:1px solid var(--line2)}
#fa-admin .fa-deny h2{margin:0 0 8px;font:700 26px Rajdhani,Oswald,sans-serif;letter-spacing:.06em;text-transform:uppercase}
#fa-admin .fa-deny p{color:var(--mut);margin:0 0 18px}
#fa-admin .fa-2f{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 10px}
#fa-admin .fa-2f .fa-q{width:200px;text-align:center;letter-spacing:.12em}
#fa-admin .fa-key{display:inline-block;padding:10px 14px;border-radius:10px;background:rgba(0,0,0,.35);border:1px solid var(--line2);font:600 17px/1.4 ui-monospace,Consolas,monospace;letter-spacing:.06em;color:var(--tx);user-select:all;word-break:break-all}
#fa-admin .fa-deny a{color:var(--acc)}
#fa-admin .fa-qr{width:200px;margin:0 auto 14px;background:#fff;border-radius:10px;padding:6px}#fa-admin .fa-qr svg{display:block;width:100%;height:auto}
@media (max-width:900px){#fa-admin .fa-grid2{grid-template-columns:1fr}#fa-admin .fa-grid2 .fa-card{margin-bottom:0}}
@media (max-width:520px){#fa-admin .fa-kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}#fa-admin .fa-kpi{padding:12px}#fa-admin .fa-kpi b{font-size:23px}#fa-admin .fa-kpi b u{display:block;margin:4px 0 0;font-size:10px}#fa-admin .fa-brand b{font-size:25px}#fa-admin .fa-brand span{font-size:16px}}
#fa-admin .fa-skins{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;margin-bottom:12px}
#fa-admin .fa-sk{display:flex;gap:12px;align-items:center;padding:10px 12px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.025)}
#fa-admin .fa-sk img,#fa-admin .fa-sk .ph{width:48px;height:64px;object-fit:contain;flex:none;border-radius:8px;background:rgba(0,0,0,.25)}
#fa-admin .fa-sk .in{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
#fa-admin .fa-sk .in b{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#fa-admin .fa-sk .in small{color:var(--mut);font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#fa-admin .fa-sk .bt{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
#fa-admin .fa-sk input{width:92px;height:30px;border-radius:8px;border:1px solid var(--line2);background:rgba(0,0,0,.3);color:var(--tx);padding:0 8px;font:600 11px Inter,sans-serif;text-transform:uppercase;outline:none}
#fa-admin .fa-sk input:focus{border-color:var(--acc)}
#fa-admin .fa-sk button{height:30px;min-width:30px;padding:0 9px;border-radius:8px;border:1px solid var(--line2);background:var(--card);cursor:pointer;font-weight:600;font-size:12px}
#fa-admin .fa-sk button:hover{background:var(--card2);border-color:rgba(255,198,41,.5)}
#fa-admin .fa-sk button.del{color:var(--bad)}
#fa-admin .fa-sk button:disabled{opacity:.3;cursor:default}
#fa-admin .fa-gh{margin-top:12px;border:1px solid var(--line);border-radius:12px;padding:10px 12px}
#fa-admin .fa-gh summary{cursor:pointer;color:var(--mut);font-weight:600;font-size:13px}
#fa-admin .fa-gh label{display:block;margin-top:10px;font-size:12px;color:var(--mut)}
#fa-admin .fa-gh input{display:block;width:100%;max-width:460px;margin-top:5px;height:38px;padding:0 12px;border-radius:10px;border:1px solid var(--line2);background:rgba(0,0,0,.3);color:var(--tx);font:500 14px Inter,sans-serif;outline:none}
#fa-admin .fa-gh input:focus{border-color:var(--acc)}
#fa-kreator{position:fixed;inset:0;z-index:300;background:#1b1e25}
#fa-kreator iframe{width:100%;height:100%;border:0;display:block}
#fa-admin .fa-ac-room{border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin-bottom:10px;background:rgba(255,255,255,.02)}
#fa-admin .fa-ac-room.held{border-color:rgba(255,198,41,.55);background:rgba(255,198,41,.05)}
#fa-admin .fa-ac-h{display:flex;gap:10px;align-items:center;flex-wrap:wrap;color:var(--mut);font-size:13px}
#fa-admin .fa-ac-h b{color:var(--tx)}
#fa-admin .fa-ac-hold{margin-top:6px;font-size:13px;color:#ffd38a}
#fa-admin .fa-ac-pl{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
#fa-admin .fa-ac-p{border-radius:12px;padding:10px 12px;background:rgba(0,0,0,.22);border-left:3px solid #4da3ff;min-width:0}
#fa-admin .fa-ac-p.s1{border-left-color:#ff7ab6}
#fa-admin .fa-ac-p h5{margin:0 0 4px;font:700 15px/1.3 Inter,sans-serif;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
#fa-admin .fa-ac-p .mut{font-size:12px}
#fa-admin .fa-risk{font:700 11px/1 Inter,sans-serif;padding:4px 7px;border-radius:6px;white-space:nowrap}
#fa-admin .fa-risk.r0{background:rgba(52,210,127,.15);color:var(--ok)}#fa-admin .fa-risk.r1{background:rgba(255,198,41,.16);color:var(--acc)}#fa-admin .fa-risk.r2{background:rgba(255,122,107,.18);color:var(--bad)}
#fa-admin .fa-flags{list-style:none;margin:6px 0 0;padding:0;font-size:12.5px}
#fa-admin .fa-flags li{display:flex;gap:8px;padding:2px 0}#fa-admin .fa-flags li span:first-child{min-width:36px;flex:none;color:var(--mut);font-variant-numeric:tabular-nums}
#fa-admin .fa-btn.sm{height:30px;padding:0 10px;font-size:12.5px}
#fa-admin .fa-btn.bad{border-color:rgba(255,122,107,.5);color:var(--bad)}
#fa-admin .fa-chk{display:inline-flex;gap:6px;align-items:center;color:var(--mut);font-size:12.5px;cursor:pointer}#fa-admin .fa-chk input{accent-color:#ffc629}
#fa-admin .fa-rp{position:fixed;inset:0;z-index:3;display:flex;padding:16px;background:rgba(3,6,14,.8);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
#fa-admin .fa-rp>div{margin:auto;width:min(1300px,100%);height:min(860px,100%);display:grid;grid-template-columns:1fr 320px;grid-template-rows:auto 1fr auto;background:#0e1422;border:1px solid var(--line2);border-radius:16px;overflow:hidden}
#fa-admin .fa-rp-top{grid-column:1/-1;display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid var(--line)}
#fa-admin .fa-rp-top b{font-weight:700}
#fa-admin .fa-rp-cv{position:relative;min-height:260px;background:#151b28}#fa-admin .fa-rp-cv canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
#fa-admin .fa-rp-side{border-left:1px solid var(--line);padding:12px;overflow:auto;font-size:13px}
#fa-admin .fa-kv{display:flex;justify-content:space-between;gap:10px;padding:3px 0;border-bottom:1px solid var(--line);font-size:12.5px}#fa-admin .fa-kv b{font-weight:600;font-variant-numeric:tabular-nums}
#fa-admin .fa-rp-bar{grid-column:1/-1;display:flex;gap:10px;align-items:center;padding:10px 14px;border-top:1px solid var(--line)}
#fa-admin .fa-rp-bar input[type=range]{flex:1;accent-color:#ffc629}
#fa-admin .fa-rp-bar select{height:34px;border-radius:9px;border:1px solid var(--line2);background:rgba(0,0,0,.3);color:var(--tx);padding:0 8px}
#fa-admin .fa-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:5px;vertical-align:-1px}
@media (max-width:900px){#fa-admin .fa-ac-pl{grid-template-columns:1fr}#fa-admin .fa-rp>div{grid-template-columns:1fr;grid-template-rows:auto 1fr auto auto}#fa-admin .fa-rp-side{border-left:0;border-top:1px solid var(--line);max-height:220px}}
`;

const STAT0 = { matches: 0, wins: 0, losses: 0, staked: 0, won: 0, fees: 0, deposits: 0, withdrawn: 0, shots: 0, hits: 0, heads: 0, kills: 0, deaths: 0, lastActive: 0 };
const r2 = v => Math.round(v * 100) / 100;
const usd = v => '$' + fmtMoney(v);   // kwoty w dolarach, płatność w SOL (jak w lobby)
const fmtMoney = v => (Math.round(v * 100) / 100).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = v => Math.round(v).toLocaleString('pl-PL');
const pct = (a, b) => b > 0 ? Math.round(a / b * 100) + '%' : '—';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dayKey = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const ago = t => {
  if (!t) return '—'; const s = (Date.now() - t) / 1000;
  if (s < 90) return 'przed chwilą'; if (s < 3600) return Math.round(s / 60) + ' min temu'; if (s < 86400) return Math.round(s / 3600) + ' h temu';
  if (s < 86400 * 30) { const d = Math.round(s / 86400); return d + (d === 1 ? ' dzień temu' : ' dni temu'); } return new Date(t).toLocaleDateString('pl-PL');
};
// polska odmiana: 1 mecz, 2–4 mecze, 5+ meczów (12–14 też "meczów")
const pl = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return n === 1 ? one : b >= 2 && b <= 4 && (a < 12 || a > 14) ? few : many; };
const toMs = v => typeof v === 'number' ? v : v ? Date.parse(v) || 0 : 0;

// statystyki gracza: z sum zapisanych w koncie, a dla starszych kont – wyliczone z historii
function playerStats(a) {
  const h = Array.isArray(a.history) ? a.history : [];
  let s = a.stats && typeof a.stats === 'object' ? { ...STAT0, ...a.stats } : null;
  if (!s) {
    s = { ...STAT0 };
    for (const x of h) {
      if (x.type === 'stake') { s.matches++; s.staked += -x.amount; } else if (x.type === 'win') { s.wins++; s.won += x.amount; s.fees += x.fee || 0; }
      else if (x.type === 'loss') s.losses++; else if (x.type === 'deposit') s.deposits += x.amount; else if (x.type === 'withdraw') s.withdrawn += -x.amount;
    }
  }
  const created = toMs(a.createdAt), last = Math.max(created, s.lastActive || 0, ...h.slice(0, 3).map(x => x.t || 0));
  return {
    id: a.id, name: a.username || a.id, created, last, balance: +a.balance || 0, wallet: a.wallet || '', sol: +a.sol || 0, history: h, ...s,
    net: r2(s.won - s.staked), wr: s.wins + s.losses ? s.wins / (s.wins + s.losses) : -1,
    acc: s.shots ? s.hits / s.shots : -1, hs: s.hits ? s.heads / s.hits : -1, kd: s.deaths ? s.kills / s.deaths : s.kills ? s.kills : -1,
  };
}

let root = null, cleanup = [];
export async function openAdmin({ onClose } = {}) {
  if (root) { root.hidden = false; return; }
  if (!document.getElementById('fa-admin-css')) { const st = document.createElement('style'); st.id = 'fa-admin-css'; st.textContent = CSS; document.head.appendChild(st); }
  root = document.createElement('div'); root.id = 'fa-admin'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Panel admina');
  document.body.appendChild(root);
  const close = () => { cleanup.forEach(f => { try { f(); } catch {} }); cleanup = []; root.remove(); root = null; if (onClose) onClose(); };
  const onKey = e => { if (e.key !== 'Escape' || !root) return; const rp = root.querySelector('.fa-rp'), d = root.querySelector('.fa-drw');
    if (rp && !rp.hidden) rp.querySelector('[data-rpx]').click(); else if (d && !d.hidden) d.hidden = true; else close(); };
  addEventListener('keydown', onKey); cleanup.push(() => removeEventListener('keydown', onKey));
  root.innerHTML = `<div class="fa-wrap"><div class="fa-head"><div class="fa-brand"><b>GTASSAULT</b><span>Panel admina</span></div><div class="fa-sp"></div>
    <button class="fa-btn" type="button" data-close>← Wróć do gry</button></div><p class="fa-empty">Ładowanie danych…</p></div>`;
  root.querySelector('[data-close]').addEventListener('click', close);

  if (SRV) {
    const deny = msg => { root.innerHTML = `<div class="fa-wrap"><div class="fa-deny"><h2>Brak dostępu</h2><p>${esc(msg)}</p><button class="fa-btn pri" type="button" data-close>Wróć do gry</button></div></div>`; root.querySelector('[data-close]').addEventListener('click', close); };
    lastOpts = { onClose };
    if (!(await unlockAdmin(deny, close))) return;
    if (!root) return; buildDashboard(null, close); return;
  }
  const use = n => (window.claude && typeof window.claude.use === 'function') ? window.claude.use(n).catch(() => null) : Promise.resolve(null);
  const [db, user] = await Promise.all([use('db'), use('user')]);
  if (!root) return;
  if (db) {
    const owner = user ? await user.isOwner().catch(() => false) : false;
    if (!owner) {
      root.innerHTML = `<div class="fa-wrap"><div class="fa-deny"><h2>Brak dostępu</h2><p>Panel admina jest dostępny tylko dla właściciela gry.</p><button class="fa-btn pri" type="button" data-close>Wróć do gry</button></div></div>`;
      root.querySelector('[data-close]').addEventListener('click', close); return;
    }
  }
  buildDashboard(db, close);
}

// Logowanie do panelu na serwerze portfeli: osobne konto admina (login + hasło + kod 2FA), niezależne od konta w grze.
// Pierwsze logowanie konta bez 2FA: serwer zwraca klucz – panel pokazuje kod QR i prosi o kod kontrolny. Zwraca true, gdy sesja jest ważna.
async function unlockAdmin(deny, close) {
  let st;
  try { const r = await fetch(SRV + '/api/admin/status', { headers: AH() }); st = await r.json().catch(() => ({})); if (!r.ok) { deny(st.message || 'Serwer portfeli odmówił dostępu.'); return false; } }
  catch { deny('Serwer portfeli nie odpowiada (' + SRV + ').'); return false; }
  if (st.unlocked) return true;
  admTok.set('');
  return new Promise(done => {
    const screen = (inner, onSubmit) => {
      if (!root) return done(false);
      root.innerHTML = `<div class="fa-wrap"><div class="fa-deny">${inner}<p class="fa-msg" data-m style="margin:4px 0 14px"></p><button class="fa-btn" type="button" data-close>Wróć do gry</button></div></div>`;
      root.querySelector('[data-close]').addEventListener('click', () => { close(); done(false); });
      const f = root.querySelector('form'), m = root.querySelector('[data-m]'), b = f.querySelector('button.pri');
      f.querySelector('input').focus();
      f.addEventListener('submit', async e => {
        e.preventDefault(); b.disabled = true; m.className = 'fa-msg'; m.textContent = '';
        try { await onSubmit(new FormData(f)); } catch (er) { m.className = 'fa-msg err'; m.textContent = er.message; b.disabled = false; }
      });
    };
    const codeInput = (req = true) => `<input class="fa-q" name="c" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}"${req ? ' required' : ''} placeholder="kod 2FA (6 cyfr)">`;
    const ok = j => { admTok.set(j.adminToken); done(true); };
    const qrSvg = uri => { try { const qr = qrcode(0, 'M'); qr.addData(uri); qr.make(); return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); } catch { return ''; } };
    const setupKey = j => screen(`<h2>Włącz 2FA</h2><p>Pierwsze logowanie: zeskanuj kod aplikacją (Google Authenticator, Authy, 1Password…) albo wybierz „Wpisz klucz konfiguracji”: nazwa BEANLADEN, klucz poniżej, oparty na czasie.</p>
      <div class="fa-qr">${qrSvg(j.uri)}</div>
      <p><span class="fa-key">${esc(j.secret.match(/.{1,4}/g).join(' '))}</span></p><p><a href="${esc(j.uri)}">Otwórz w aplikacji na tym urządzeniu</a></p>
      <p>Zapisz klucz w bezpiecznym miejscu (menedżer haseł albo kartka). Potem wpisz kod z aplikacji (masz 10 minut):</p>
      <form class="fa-2f">${codeInput()}<button class="fa-btn pri">Włącz 2FA</button></form>`, async d => ok(await srvPost('/api/admin/2fa/enable', { setupToken: j.setupToken, code: d.get('c') })));
    // login + hasło + kod; pole kodu można zostawić puste tylko przy pierwszym logowaniu (2FA jeszcze nie ustawione)
    screen(`<h2>Panel admina</h2><p>Zaloguj się kontem admina (to nie jest konto z gry). Przy pierwszym logowaniu zostaw kod pusty – panel pokaże kod QR.</p>
      <form class="fa-login" style="display:grid;gap:8px;max-width:280px;margin:0 auto 6px">
        <input class="fa-q" name="u" autocomplete="username" spellcheck="false" autocapitalize="off" required placeholder="Login admina" style="width:100%">
        <input class="fa-q" name="p" type="password" autocomplete="current-password" required placeholder="Hasło" style="width:100%">
        ${codeInput(false).replace('class="fa-q"', 'class="fa-q" style="width:100%;letter-spacing:.12em"')}
        <button class="fa-btn pri" style="justify-content:center">Zaloguj</button></form>`,
      async d => { const j = await srvPost('/api/admin/login', { username: d.get('u'), password: d.get('p'), code: d.get('c') }); j.setup ? setupKey(j) : ok(j); });
  });
}
// ---------- antycheat: mecze do sprawdzenia (wstrzymane wypłaty, podejrzane mecze), decyzje, blokady i powtórki ----------
const AC_STATE = { won: 'wygrał', lost: 'przegrał', held: 'wygrał – wypłata czeka', open: 'w grze' };
const acRisk = r => r == null ? 'r0' : r >= 0.5 ? 'r2' : r >= 0.25 ? 'r1' : 'r0';
const acPct = v => v == null ? '—' : Math.round(v * 100) + '%';
async function srvGet(p) {
  const r = await fetch(SRV + p, { headers: AH() }); const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.message || 'Błąd serwera'); e.code = j.error; throw e; } return j;
}
// ---------- Deathmatch: wszystkie parametry trybu (serwer sprawdza i przycina wartości), kolejki, trwające mecze, ostatnie wyniki ----------
const DM_FIELDS = [
  ['Mecz', [['maxPlayers', 'Graczy w meczu (max)', 1], ['minPlayers', 'Najmniej graczy do startu', 1], ['queueTimeout', 'Czekanie w kolejce (s)', 1], ['duration', 'Czas meczu (s)', 1], ['startDelay', 'Odliczanie przed startem (s)', 0.5], ['endDelay', 'Podium po meczu (s)', 1]]],
  ['Kasa meczu i WANTED', [['startMoney', 'Kasa na start ($)', 10], ['killReward', 'Nagroda za zabójstwo ($)', 10], ['wantedMult', 'Mnożnik za WANTED (×)', 0.5], ['wantedMinKills', 'WANTED od zabójstw', 1]]],
  ['Boty (zapełniają lobby, gdy jest w nim co najmniej 1 gracz; ustępują miejsca graczom)', [['bots', 'Liczba botów w lobby (0 = bez botów)', 1], ['botSkill', 'Poziom botów (0 = słabe, 1 = mocne)', 0.05]]],
  ['Odrodzenie', [['spawnProtect', 'Ochrona po odrodzeniu (s)', 0.5], ['minDeathTime', 'Ekran WASTED (s)', 0.1], ['idleDead', 'Ekran śmierci – powrót do lobby po (s)', 5]]],
  ['Nagrody (pula = wpisowe graczy)', [['houseFee', 'Prowizja (0–0,5)', 0.01], ['prizeSplit.0', '1. miejsce (część puli)', 0.05], ['prizeSplit.1', '2. miejsce', 0.05], ['prizeSplit.2', '3. miejsce', 0.05]]],
  ['Pancerz', [['armor.vest.price', 'Kamizelka – cena ($)', 50], ['armor.vest.hp', 'Kamizelka – punkty', 5], ['armor.helmet.price', 'Kamizelka + hełm – cena ($)', 50], ['armor.helmet.hp', 'Kamizelka + hełm – punkty', 5], ['armor.helmet.headMult', 'Hełm – obrażenia głowy (×)', 0.05]]],
];
const DM_WCOLS = [['name', 'Nazwa'], ['price', 'Cena $'], ['dmg', 'Obr.'], ['head', 'Głowa ×'], ['rpm', 'RPM'], ['mag', 'Mag.'], ['reserve', 'Zapas'], ['reload', 'Przeł. s'], ['pellets', 'Śruciny'], ['pelletSpread', 'Rozrzut śr.'],
  ['falloff.0', 'Spadek od m'], ['falloff.1', 'Min. przy m'], ['falloff.2', 'Min. ×'], ['recoil.pitch', 'Odrzut ↑'], ['recoil.yaw', 'Odrzut ↔'], ['spread.hip', 'Rozrzut z biodra'], ['spread.ads', 'Rozrzut celując'], ['auto', 'Auto']];
const getP = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const setP = (o, p, v) => { const ks = p.split('.'); let a = o; for (let i = 0; i < ks.length - 1; i++) a = a[ks[i]]; a[ks[ks.length - 1]] = v; };
// Arsenał: mint tokenu, nazwa, sieć, co ile sprawdzać saldo, progi broni i skinów z kreatora (serwer: serwer/arsenal.mjs)
const ARS_NAMES = { deagle: 'Desert Eagle', mp5k: 'MP5K', spas12: 'SPAS-12', akm: 'AKM', m4a1: 'M4A1' };
function mountArsenal($) {
  const box = $('fa-ars'), msg = $('fa-ars-msg'); let cfg = null, info = null, skinList = [];   // skinList: skiny z kreatora (skins.json) – mają progi
  function render() {
    const tok = cfg.unit === 'token' || cfg.unit === 'hold', hold = cfg.unit === 'hold';
    box.innerHTML = `<div class="fa-row" style="gap:14px;margin:0 0 10px"><label class="fa-chk"><input type="checkbox" id="fa-ars-on" ${cfg.enabled ? 'checked' : ''}> Ekwipunek włączony</label>
        <label class="fa-dmf" style="min-width:280px"><span>Odblokowanie za</span><select class="fa-q" id="fa-ars-unit"><option value="sol" ${tok ? '' : 'selected'}>saldo SOL w grze (nic się nie pobiera)</option><option value="token" ${cfg.unit === 'token' ? 'selected' : ''}>token SPL na adresie gracza w grze</option><option value="hold" ${hold ? 'selected' : ''}>token na podpiętym portfelu gracza albo SOL w grze po kursie tokenu</option></select></label></div>
      <div class="fa-dmg" ${tok ? '' : 'style="display:none"'}>
        <label class="fa-dmf" style="grid-column:span 2"><span>Adres mintu tokenu (Solana)</span><input class="fa-q" id="fa-ars-mint" value="${esc(cfg.mint)}" placeholder="np. 7xKX…pump" spellcheck="false"></label>
        <label class="fa-dmf"><span>Nazwa tokenu (np. BEAN)</span><input class="fa-q" id="fa-ars-sym" value="${esc(cfg.symbol)}" maxlength="12"></label>
        <label class="fa-dmf"><span>Sieć tokenu</span><select class="fa-q" id="fa-ars-net">${['mainnet-beta', 'devnet', 'testnet'].map((n) => `<option ${cfg.network === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="fa-dmf"><span>Sprawdzanie salda co (s)</span><input class="fa-q" type="number" min="30" max="3600" step="10" id="fa-ars-ref" value="${cfg.refresh}"></label>
      </div>
      <h4>Progi broni – ${tok ? 'ile tokenów' : 'ile SOL'} gracz musi mieć (nic się nie pobiera; Glock-17 zawsze za darmo, 0 = broń dla każdego)</h4>
      <div class="fa-dmg">${info.guns.map((g) => `<label class="fa-dmf"><span>${esc(ARS_NAMES[g] || g)}</span><input class="fa-q" type="number" min="0" step="any" data-need="${g}" value="${cfg.need[g]}"></label>`).join('')}</div>
      <h4>Skiny broni – ${tok ? 'ile tokenów' : 'ile SOL'} gracz musi mieć (zwykłe zawsze za darmo; serwer sprawdza próg przy wejściu do meczu)</h4>
      <div class="fa-dmg"><label class="fa-dmf"><span>Średnie (tygrys, karbon, neon, chrom…) od</span><input class="fa-q" type="number" min="0" step="any" id="fa-ars-wsm" value="${(cfg.wskin || {}).mid ?? 5000000}"></label>
        <label class="fa-dmf"><span>Legendarne (złoto, damast, lawa, galaktyka, hologram) od</span><input class="fa-q" type="number" min="0" step="any" id="fa-ars-wsl" value="${(cfg.wskin || {}).legend ?? 10000000}"></label></div>
      <h4>Progi skinów z kreatora – ${tok ? 'ile tokenów' : 'ile SOL'} gracz musi mieć (podstawowe kolorowe fasolki zawsze za darmo; puste pole = próg domyślny, 0 = skin dla każdego)</h4>
      <div class="fa-dmg"><label class="fa-dmf"><span><b>Próg domyślny</b></span><input class="fa-q" type="number" min="0" step="any" id="fa-ars-skdef" value="${cfg.skinDefault ?? 0}"></label>
        ${skinList.map((k) => `<label class="fa-dmf"><span>${esc(k.name || k.id)}</span><input class="fa-q" type="number" min="0" step="any" data-skin="${esc(k.id)}" value="${cfg.skinNeed && cfg.skinNeed[k.id] !== undefined ? cfg.skinNeed[k.id] : ''}" placeholder="${cfg.skinDefault ?? 0} (domyślny)"></label>`).join('') || '<p class="fa-empty">Brak skinów z kreatora (skins.json).</p>'}</div>`;
    $('fa-ars-sum').textContent = !cfg.enabled ? 'wyłączony – wszystkie bronie dla każdego' : !tok ? 'włączony · progi w SOL (saldo w grze)'
      : !cfg.mint ? 'włączony, ale bez mintu tokenu – nie działa'
      : hold ? `włączony · ${cfg.symbol} na podpiętym portfelu albo SOL w grze po kursie (teraz 1 ${cfg.symbol} = ${info.priceSol ? info.priceSol.toPrecision(3) + ' SOL' : 'brak kursu'}) · RPC: ${info.rpc}`
      : `włączony · token ${cfg.symbol} · ${cfg.network} · RPC: ${info.rpc}`;
    $('fa-ars-unit').addEventListener('change', () => { collect(); render(); });
  }
  function collect() {
    cfg.enabled = $('fa-ars-on').checked; cfg.unit = $('fa-ars-unit').value; cfg.mint = $('fa-ars-mint').value.trim(); cfg.symbol = $('fa-ars-sym').value.trim(); cfg.network = $('fa-ars-net').value; cfg.refresh = +$('fa-ars-ref').value;
    box.querySelectorAll('[data-need]').forEach((i) => { cfg.need[i.dataset.need] = +i.value; });
    cfg.skinDefault = +$('fa-ars-skdef').value || 0; cfg.skinNeed = {};
    cfg.wskin = { mid: +$('fa-ars-wsm').value || 0, legend: +$('fa-ars-wsl').value || 0 };
    box.querySelectorAll('[data-skin]').forEach((i) => { if (i.value.trim() !== '') cfg.skinNeed[i.dataset.skin] = +i.value; });   // puste = próg domyślny
  }
  (async () => { try { info = await srvGet('/api/admin/arsenal'); cfg = JSON.parse(JSON.stringify(info.config));
      try { const l = await (await fetch('skins.json?v=' + Date.now(), { cache: 'no-store' })).json(); if (Array.isArray(l)) skinList = l.filter((k) => k && k.id).map((k) => ({ id: k.id, name: k.name })); } catch {}
      render(); }
    catch (e) { if (e.code === 'admin2fa') return relockAdmin(); box.innerHTML = `<p class="fa-empty">${esc(e.message)}</p>`; } })();
  $('fa-ars-save').addEventListener('click', async () => {
    if (!cfg) return; collect(); msg.textContent = 'Zapisywanie…';
    try { const j = await srvPost('/api/admin/arsenal', { config: cfg }); cfg = JSON.parse(JSON.stringify(j.config)); render(); msg.textContent = 'Zapisano. Działa od następnego meczu.'; }
    catch (e) { msg.textContent = e.message; }
  });
  $('fa-ars-reset').addEventListener('click', async () => {
    if (!confirm('Przywrócić domyślne ustawienia Ekwipunku (wyłączony, bez mintu)?')) return;
    try { const j = await srvPost('/api/admin/arsenal', { reset: true }); cfg = JSON.parse(JSON.stringify(j.config)); render(); msg.textContent = 'Przywrócono domyślne.'; } catch (e) { msg.textContent = e.message; }
  });
}
// Udostępnienie na X: włączenie, tekst posta, CA, link do gry, co ile sprawdzać post (serwer: serwer/xshare.mjs)
// napis „N players online” na górze lobby: włączony, liczba, tekst (serwer: klucz 'online' w config)
function mountOnline($) {
  const box = $('fa-on'), msg = $('fa-on-msg'); let cfg = null, now = 0;
  const fmt = (v) => (+v || 0).toLocaleString('en-US');
  const prev = () => esc(cfg.text).replace('{n}', `<b style="color:#3ce38a">${fmt(now || cfg.count)}</b>`);
  // ile będzie po czasie (ta sama formuła co serwer): start × (1 + wzrost%)^minuty, najwyżej limit
  const at = (min) => { const c = cfg, a = Math.log(1 + (+c.growth || 0) / 100), t1 = c.count >= c.slowAt ? 0 : a > 0 ? Math.log(c.slowAt / Math.max(1, c.count)) / a : Infinity;
    const v = min <= t1 ? c.count * Math.exp(a * min) : Math.max(c.count, c.slowAt) * Math.pow(1 + (+c.slowGrowth || 0) / 100, min - t1); return Math.min(Math.max(c.cap, c.count), Math.round(v)); };
  const curve = () => [[10, '10 min'], [30, '30 min'], [60, '1 h'], [120, '2 h'], [180, '3 h'], [360, '6 h'], [720, '12 h'], [1440, '24 h']].map(([m, l]) => `${l}: <b>${fmt(at(m))}</b>`).join(' · ');
  function render() {
    box.innerHTML = `<div class="fa-row" style="gap:14px;margin:0 0 10px"><label class="fa-chk"><input type="checkbox" id="fa-on-on" ${cfg.enabled ? 'checked' : ''}> Pokazuj napis</label></div>
      <div class="fa-dmg">
        <label class="fa-dmf"><span>Liczba startowa</span><input class="fa-q" type="number" min="0" max="1000000" step="1" id="fa-on-n" value="${cfg.count}"></label>
        <label class="fa-dmf"><span>Szybki wzrost co minutę (%)</span><input class="fa-q" type="number" min="0" max="10" step="0.05" id="fa-on-g" value="${cfg.growth}"></label>
        <label class="fa-dmf"><span>Zwolnij od (graczy)</span><input class="fa-q" type="number" min="0" max="1000000" step="1" id="fa-on-slow" value="${cfg.slowAt}"></label>
        <label class="fa-dmf"><span>Potem wzrost co minutę (%)</span><input class="fa-q" type="number" min="0" max="10" step="0.01" id="fa-on-g2" value="${cfg.slowGrowth}"></label>
        <label class="fa-dmf"><span>Limit (najwyżej tyle)</span><input class="fa-q" type="number" min="0" max="1000000" step="1" id="fa-on-cap" value="${cfg.cap}"></label>
        <label class="fa-dmf" style="grid-column:span 2"><span>Tekst ({n} = liczba)</span><input class="fa-q" id="fa-on-t" maxlength="60" value="${esc(cfg.text)}" spellcheck="false"></label>
      </div>
      <p class="fa-msg" id="fa-on-curve" style="margin:8px 0 0">Po zapisie liczba rośnie od liczby startowej: ${curve()}</p>
      <h4>Teraz w lobby</h4><p class="fa-msg" id="fa-on-prev" style="margin:0;text-transform:uppercase;letter-spacing:.12em">${prev()}</p>`;
    $('fa-on-sum').textContent = cfg.enabled ? `widoczny · teraz ${fmt(now)} · +${cfg.growth}%/min do ${fmt(cfg.slowAt)}, potem +${cfg.slowGrowth}%/min do ${fmt(cfg.cap)}` : 'ukryty';
    const live = () => { collect(); $('fa-on-curve').innerHTML = 'Po zapisie liczba rośnie od liczby startowej: ' + curve(); };
    ['fa-on-n', 'fa-on-g', 'fa-on-slow', 'fa-on-g2', 'fa-on-cap', 'fa-on-t'].forEach((id) => $(id).addEventListener('input', live));
  }
  function collect() { cfg.enabled = $('fa-on-on').checked; cfg.count = +$('fa-on-n').value; cfg.growth = +$('fa-on-g').value; cfg.slowAt = +$('fa-on-slow').value; cfg.slowGrowth = +$('fa-on-g2').value; cfg.cap = +$('fa-on-cap').value; cfg.text = $('fa-on-t').value; }
  const load = async () => { const j = await srvGet('/api/admin/online'); cfg = JSON.parse(JSON.stringify(j.config)); now = j.now; render(); };
  load().catch((e) => { if (e.code === 'admin2fa') return relockAdmin(); box.innerHTML = `<p class="fa-empty">${esc(e.message)}</p>`; });
  $('fa-on-save').addEventListener('click', async () => {
    if (!cfg) return; collect(); msg.textContent = 'Zapisywanie…';
    try { const j = await srvPost('/api/admin/online', { config: cfg }); cfg = JSON.parse(JSON.stringify(j.config)); now = j.now; render(); msg.textContent = 'Zapisano – licznik rośnie od nowa od liczby startowej.'; }
    catch (e) { msg.textContent = e.message; }
  });
  $('fa-on-reset').addEventListener('click', async () => {
    if (!confirm('Przywrócić domyślny napis (150 players online)?')) return;
    try { const j = await srvPost('/api/admin/online', { reset: true }); cfg = JSON.parse(JSON.stringify(j.config)); now = j.now; render(); msg.textContent = 'Przywrócono domyślne.'; } catch (e) { msg.textContent = e.message; }
  });
}
function mountXShare($) {
  const box = $('fa-xs'), msg = $('fa-xs-msg'); let cfg = null, info = null;
  function render() {
    box.innerHTML = `<div class="fa-row" style="gap:14px;margin:0 0 10px"><label class="fa-chk"><input type="checkbox" id="fa-xs-on" ${cfg.enabled ? 'checked' : ''}> Wymagaj posta na X przed Deathmatch</label>
        <label class="fa-chk"><input type="checkbox" id="fa-xs-reqca" ${cfg.requireCa ? 'checked' : ''}> CA musi być w poście</label></div>
      <div class="fa-dmg">
        <label class="fa-dmf" style="grid-column:span 2"><span>Adres CA (puste = mint z Ekwipunku${info.ca && !cfg.ca ? ': ' + esc(info.ca) : ''})</span><input class="fa-q" id="fa-xs-ca" value="${esc(cfg.ca)}" placeholder="np. 7xKX…pump" spellcheck="false"></label>
        <label class="fa-dmf" style="grid-column:span 2"><span>Link do gry w poście (domena, nie IP) – ${info.site ? 'puste = ' + esc(info.site) : '<b style="color:#ff6b8b">wpisz domenę strony</b>'}</span><input class="fa-q" id="fa-xs-url" value="${esc(cfg.url)}" placeholder="https://…" spellcheck="false"></label>
        <label class="fa-dmf" style="grid-column:span 2"><span>Strona gry na X – kafelek X w lobby (puste = ukryty)</span><input class="fa-q" id="fa-xs-profile" value="${esc(cfg.profile || '')}" placeholder="https://x.com/nazwa" spellcheck="false"></label>
        <label class="fa-dmf"><span>Sprawdzaj post ponownie co (godz., 0 = nigdy)</span><input class="fa-q" type="number" min="0" max="720" step="1" id="fa-xs-re" value="${cfg.recheckHours}"></label>
      </div>
      <label class="fa-dmf" style="display:block;margin-top:10px"><span>Tekst posta</span><textarea class="fa-q" id="fa-xs-text" rows="6" maxlength="600" style="width:100%;box-sizing:border-box;resize:vertical;font:inherit">${esc(cfg.text)}</textarea></label>
      <h4>Podgląd (z przykładowym kodem) – <span style="color:${info.len > 280 ? '#ff6b8b' : 'inherit'}">${info.len || 0}/280 znaków X${info.len > 280 ? ' – za długi, X go nie opublikuje' : ''}</span></h4><pre class="fa-msg" style="white-space:pre-wrap;margin:0">${esc(info.preview || '')}</pre>`;
    const s = info.stats || {};
    $('fa-xs-sum').textContent = (cfg.enabled ? 'włączone' : 'wyłączone – Deathmatch bez posta') + ` · zweryfikowanych graczy: ${s.v || 0}` + (cfg.enabled && cfg.requireCa && !(cfg.ca || info.ca) ? ' · brak CA – sprawdzany tylko kod' : '') + (!cfg.url && !info.site ? ' · brak domeny – post bez linku do gry' : '');
  }
  function collect() {
    cfg.enabled = $('fa-xs-on').checked; cfg.requireCa = $('fa-xs-reqca').checked; cfg.ca = $('fa-xs-ca').value.trim(); cfg.url = $('fa-xs-url').value.trim(); cfg.profile = $('fa-xs-profile').value.trim();
    cfg.recheckHours = +$('fa-xs-re').value; cfg.text = $('fa-xs-text').value;
  }
  const load = async () => { info = await srvGet('/api/admin/xshare'); cfg = JSON.parse(JSON.stringify(info.config)); render(); };
  load().catch((e) => { if (e.code === 'admin2fa') return relockAdmin(); box.innerHTML = `<p class="fa-empty">${esc(e.message)}</p>`; });
  $('fa-xs-save').addEventListener('click', async () => {
    if (!cfg) return; collect(); msg.textContent = 'Zapisywanie…';
    try { await srvPost('/api/admin/xshare', { config: cfg }); await load(); msg.textContent = 'Zapisano. Działa od razu.'; }
    catch (e) { msg.textContent = e.message; }
  });
  $('fa-xs-reset').addEventListener('click', async () => {
    if (!confirm('Przywrócić domyślne ustawienia udostępniania na X (wyłączone, domyślny tekst)?')) return;
    try { await srvPost('/api/admin/xshare', { reset: true }); await load(); msg.textContent = 'Przywrócono domyślne.'; } catch (e) { msg.textContent = e.message; }
  });
}
// prowizja domu: stan skarbca, nadwyżka do wypłaty, wypłata na adres admina (serwer: GET/POST /api/admin/house…)
function mountHouse($) {
  const msg = $('fa-house-msg'), go = $('fa-house-go'); let st = null, all = false;
  const sol = (l) => (l / 1e9).toLocaleString('pl-PL', { maximumFractionDigits: 6 }) + ' SOL';
  const inUsd = (l) => st && st.price ? ' · ' + usd(l / 1e9 * st.price) : '';
  const paren = (l) => st && st.price ? ` (${usd(l / 1e9 * st.price)})` : '';
  const kv = (k, v, sub) => `<div class="fa-dmf"><span>${esc(k)}</span><b style="font-size:15px;color:var(--fg,#fff)">${v}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
  async function pull() {
    try {
      st = await srvGet('/api/admin/house');
      const o = st.owed;
      $('fa-house-sum').textContent = `skarbiec ${st.address.slice(0, 4)}…${st.address.slice(-4)} · ${st.cluster}`;
      $('fa-house-kv').innerHTML = kv('Saldo skarbca', sol(st.treasury) + inUsd(st.treasury))
        + kv('Należy się graczom', sol(o.total), `salda ${sol(o.balances)} · stawki ${sol(o.stakes)} · wypłaty ${sol(o.withdrawals)}`)
        + kv('Do wypłaty (nadwyżka)', `<span style="color:#3ce38a">${sol(st.available)}</span>` + inUsd(st.available),
          st.feePart != null ? `prowizja ${sol(st.feePart)}${paren(st.feePart)} · inne środki ${sol(st.other)}${paren(st.other)}` : '')
        + kv('Prowizja z meczów / wypłacone', `${sol(st.fees)} / ${sol(st.sent)}`,
          st.feesDuel != null ? [`1v1 ${sol(st.feesDuel)}`, st.feesDm ? `Deathmatch ${sol(st.feesDm)}` : '', st.prior ? `sprzed resetu historii ${sol(st.prior)}` : ''].filter(Boolean).join(' · ') : '');
      $('fa-house-hist').innerHTML = st.history.length ? st.history.map((w) => `<li><div><b>${sol(w.lamports)} → <code>${esc(w.to_addr.slice(0, 6) + '…' + w.to_addr.slice(-6))}</code></b>
          <small>${new Date(w.t).toLocaleString('pl-PL')} · ${esc(w.admin)}${w.note ? ' · ' + esc(w.note) : ''}</small></div>
          <span class="mut">${w.state === 'sent' ? `<a href="${esc(w.url)}" target="_blank" rel="noopener">wysłane ↗</a>` : w.state === 'failed' ? 'nieudane' : 'w toku'}</span></li>`).join('')
        : '<li class="fa-empty">Jeszcze nie było wypłat prowizji.</li>';
    } catch (e) { if (e.code === 'admin2fa') return relockAdmin(); $('fa-house-sum').textContent = e.message; }
  }
  $('fa-house-sol').addEventListener('input', () => { all = false; });
  $('fa-house-max').addEventListener('click', () => { if (!st) return; all = true; $('fa-house-sol').value = (st.available / 1e9).toFixed(9).replace(/\.?0+$/, ''); });
  go.addEventListener('click', async () => {
    const to = $('fa-house-to').value.trim(), amount = +$('fa-house-sol').value, code = $('fa-house-code').value.trim();
    if (!to) return (msg.textContent = 'Podaj adres portfela.');
    if (!all && !(amount > 0)) return (msg.textContent = 'Podaj kwotę albo kliknij „Cała nadwyżka”.');
    if (!/^\d{6}$/.test(code)) return (msg.textContent = 'Wpisz 6-cyfrowy kod 2FA.');
    const label = all ? 'całą nadwyżkę (' + sol(st ? st.available : 0) + ')' : amount + ' SOL';
    if (!confirm(`Wysłać ${label} ze skarbca na adres
${to}?

Przelewu w sieci Solana nie da się cofnąć.`)) return;
    go.disabled = true; msg.textContent = 'Wysyłanie…';
    try {
      const j = await srvPost('/api/admin/house/withdraw', { to, code, ...(all ? { all: true } : { sol: amount }) });
      msg.innerHTML = `Wysłano ${sol(j.lamports)}. <a href="${esc(j.url)}" target="_blank" rel="noopener">Zobacz w eksploratorze ↗</a>`;
      $('fa-house-sol').value = ''; $('fa-house-code').value = ''; all = false;
    } catch (e) { if (e.code === 'admin2fa') return relockAdmin(); msg.textContent = e.message; }
    go.disabled = false; pull();
  });
  pull(); const iv = setInterval(pull, 30000); cleanup.push(() => clearInterval(iv));
}
function mountDeathmatch($) {
  const box = $('fa-dm'), msg = $('fa-dm-msg'); let cfg = null, defs = null;
  const field = (p, lbl, step) => `<label class="fa-dmf"><span>${esc(lbl)}</span><input class="fa-q" type="number" step="${step}" data-p="${p}" value="${esc(getP(cfg, p))}"></label>`;
  function render() {
    const guns = Object.keys(cfg.weapons);
    box.innerHTML = DM_FIELDS.map(([h, fs]) => `<h4>${esc(h)}</h4><div class="fa-dmg">${fs.map((f) => field(...f)).join('')}</div>`).join('')
      + `<h4>Mapy w rotacji</h4><div class="fa-row" style="gap:14px">${defs.maps.map((m) => `<label class="fa-chk"><input type="checkbox" data-map="${esc(m)}" ${cfg.maps.includes(m) ? 'checked' : ''}> ${esc(m)}</label>`).join('')}</div>`
      + `<h4>Poziomy kolejki (wpisowe w USD, 0 = darmowy)</h4><div class="fa-dmt" id="fa-dm-tiers">${cfg.tiers.map((t, i) => `<div class="fa-row" data-tier="${i}" style="gap:8px;margin:0 0 6px">
          <input class="fa-q" data-tk="id" value="${esc(t.id)}" placeholder="id" style="max-width:120px"><input class="fa-q" data-tk="name" value="${esc(t.name)}" placeholder="nazwa" style="max-width:160px">
          <input class="fa-q" type="number" step="1" min="0" data-tk="entry" value="${t.entry}" style="max-width:110px"><button class="fa-btn sm" type="button" data-deltier="${i}">Usuń</button></div>`).join('')}
        <button class="fa-btn sm" type="button" id="fa-dm-addtier">+ Poziom</button></div>`
      + `<h4>Bronie (pistolet zawsze za darmo na start)</h4><div class="fa-tw"><table class="fa-dmw"><thead><tr><th>Broń</th>${DM_WCOLS.map(([, l]) => `<th>${esc(l)}</th>`).join('')}</tr></thead><tbody>`
      + guns.map((g) => `<tr><td><b>${esc(g)}</b></td>${DM_WCOLS.map(([k]) => k === 'auto' ? `<td><input type="checkbox" data-w="${g}" data-k="auto" ${cfg.weapons[g].auto ? 'checked' : ''}></td>`
        : `<td><input class="fa-q" ${k === 'name' ? '' : 'type="number" step="any"'} data-w="${g}" data-k="${k}" value="${esc(getP(cfg.weapons[g], k))}" ${k === 'price' && g === 'glock17' ? 'disabled' : ''}></td>`).join('')}</tr>`).join('')
      + `</tbody></table></div>`;
    box.querySelectorAll('[data-deltier]').forEach((b) => b.addEventListener('click', () => { collect(); cfg.tiers.splice(+b.dataset.deltier, 1); render(); }));
    $('fa-dm-addtier').addEventListener('click', () => { collect(); cfg.tiers.push({ id: 'tier' + (cfg.tiers.length + 1), name: 'Nowy', entry: 10 }); render(); });
  }
  function collect() {
    box.querySelectorAll('[data-p]').forEach((i) => setP(cfg, i.dataset.p, +i.value));
    cfg.maps = [...box.querySelectorAll('[data-map]')].filter((i) => i.checked).map((i) => i.dataset.map);
    cfg.tiers = [...box.querySelectorAll('[data-tier]')].map((r) => ({ id: r.querySelector('[data-tk="id"]').value.trim(), name: r.querySelector('[data-tk="name"]').value.trim(), entry: +r.querySelector('[data-tk="entry"]').value }));
    box.querySelectorAll('[data-w]').forEach((i) => { const w = cfg.weapons[i.dataset.w]; setP(w, i.dataset.k, i.dataset.k === 'auto' ? i.checked : i.dataset.k === 'name' ? i.value : +i.value); });
  }
  async function pull() {
    try {
      const j = await srvGet('/api/admin/dm'); defs = j.defaults; if (!cfg) { cfg = JSON.parse(JSON.stringify(j.config)); render(); }
      $('fa-dm-live').textContent = j.rooms.length ? 'lobby: ' + j.rooms.map((r) => `${r.map}, ${r.players}/${cfg.maxPlayers} graczy${r.bots ? ` (w tym ${r.bots} botów)` : ''}`).join(', ') : 'lobby: puste (otworzy się przy pierwszym graczu)';
      $('fa-dm-recent').innerHTML = j.recent.length ? j.recent.map((r) => `<li><div><b>${esc(r.map || '—')} · ${esc(r.tier)} · ${r.players} graczy</b><small>${new Date(r.t).toLocaleString('pl-PL')} · pula $${r.pot.toFixed(2)} · wypłacone $${r.paid.toFixed(2)}</small></div>
        <span class="mut">${r.top.map((x) => `${x.place}. ${esc(x.name)} (${x.kills} K, ${x.damage} DMG${x.prize ? ', $' + x.prize.toFixed(2) : ''})`).join(' · ')}</span></li>`).join('') : '<li class="fa-empty">Jeszcze nie było meczów.</li>';
    } catch (e) { if (e.code === 'admin2fa') return relockAdmin(); box.innerHTML = `<p class="fa-empty">${esc(e.message)}</p>`; }
  }
  $('fa-dm-save').addEventListener('click', async () => {
    if (!cfg) return; collect(); msg.textContent = 'Zapisywanie…';
    try { const j = await srvPost('/api/admin/dm', { config: cfg }); cfg = JSON.parse(JSON.stringify(j.config)); render(); msg.textContent = 'Zapisano (serwer poprawił wartości spoza zakresu).'; }
    catch (e) { msg.textContent = e.message; }
  });
  $('fa-dm-reset').addEventListener('click', async () => {
    if (!confirm('Przywrócić domyślne ustawienia Deathmatch?')) return;
    try { const j = await srvPost('/api/admin/dm', { reset: true }); cfg = JSON.parse(JSON.stringify(j.config)); render(); msg.textContent = 'Przywrócono domyślne.'; } catch (e) { msg.textContent = e.message; }
  });
  pull(); const iv = setInterval(pull, 5000); cleanup.push(() => clearInterval(iv));
}
function mountAnticheat($) {
  const box = $('fa-ac'), all = $('fa-ac-all'), on = $('fa-ac-on'), rp = mountReplay($);
  on.addEventListener('change', async () => {
    const want = on.checked;
    if (!confirm(want ? 'Włączyć antycheat? Podejrzane wygrane 1v1 będą czekać na Twoją decyzję, a oszukujący ruchem będą wyrzucani z meczu.' : 'Wyłączyć antycheat? Wszystkie wygrane 1v1 będą wypłacane od razu, nikt nie wyleci z meczu za ruch.')) { on.checked = !want; return; }
    try { await srvPost('/api/admin/anticheat', { enabled: want }); last = ''; pull(); } catch (e) { if (e.code === 'admin2fa') return relockAdmin(); on.checked = !want; alert(e.message); }
  });
  let data = null, last = '';
  const pull = async () => {
    try { const j = await srvGet('/api/admin/review' + (all.checked ? '?all=1' : '')), t = JSON.stringify(j); if (t === last) return; last = t; data = j; render(); }
    catch (e) { if (e.code === 'admin2fa') return relockAdmin(); box.innerHTML = `<p class="fa-empty">${esc(e.message)}</p>`; }
  };
  function render() {
    on.checked = !!data.enabled;
    $('fa-ac-sum').textContent = data.enabled ? `${data.held} ${pl(data.held, 'czeka', 'czekają', 'czeka')} na decyzję · ryzyko od ${Math.round(data.holdRisk * 100)}% albo stawka od ${usd(data.reviewStake)}`
      : `wyłączony – wygrane wypłacane od razu, bez wyrzucania za ruch (ryzyko tylko informacyjnie)${data.held ? ` · ${data.held} ${pl(data.held, 'czeka', 'czekają', 'czeka')} z wcześniej` : ''}`;
    if (!data.rooms.length) { box.innerHTML = `<p class="fa-empty">Nic do sprawdzenia.${all.checked ? '' : ' Zaznacz „wszystkie mecze”, żeby zobaczyć ostatnie mecze.'}</p>`; return; }
    box.innerHTML = data.rooms.map(r => {
      const held = r.players.some(p => p.state === 'held');
      const pls = r.players.map((p, i) => `<div class="fa-ac-p s${i}">
        <h5>${esc(p.name)}<span class="fa-risk ${acRisk(p.risk)}">ryzyko ${acPct(p.risk)}</span><span class="mut">${esc(AC_STATE[p.state] || p.state)}${p.payout ? ' · ' + usd(p.payout) : ''}</span>
          ${p.banned ? `<span class="fa-risk r2" title="${esc(p.banReason)}">ZABLOKOWANY</span>` : ''}</h5>
        <div class="mut">podejrzenie konta ${acPct(p.suspicion)} · ${fmtInt(p.matches)} ${pl(p.matches, 'mecz', 'mecze', 'meczów')}${p.linked.length ? ' · powiązane: ' + p.linked.map(l => esc(l.name) + (l.banned ? ' (zablok.)' : '') + ' [' + esc(String(l.kinds).replace('dev', 'urządzenie').replace('wd', 'adres wypłat')) + ']').join(', ') : ''}</div>
        ${p.flags.length ? `<ul class="fa-flags">${p.flags.map(f => `<li><span>${Math.round(f.score * 100)}%</span><span>${esc(f.text)}</span></li>`).join('')}</ul>` : '<div class="mut" style="margin-top:6px">brak sygnałów</div>'}
        <div class="fa-row" style="margin-top:8px"><button class="fa-btn sm${p.banned ? '' : ' bad'}" type="button" data-ban="${esc(p.name)}" data-on="${p.banned ? 0 : 1}">${p.banned ? 'Odblokuj konto' : 'Zablokuj konto'}</button></div>
      </div>`).join('');
      return `<div class="fa-ac-room${held ? ' held' : ''}">
        <div class="fa-ac-h"><b>${esc(r.map || '?')}</b><span>${r.t ? new Date(r.t).toLocaleString('pl-PL') : ''}</span><span>stawka <b>${usd(+r.stake || 0)}</b></span><span>wynik <b>${esc(r.score || '—')}</b></span>
          ${r.review ? `<span class="fa-tag ${r.review === 'rejected' ? 'l' : r.review === 'approved' ? 'w' : 'f'}">${({ held: 'CZEKA', approved: 'WYPŁACONE', rejected: 'ODRZUCONE' })[r.review] || esc(r.review)}</span>` : ''}
          <span class="fa-sp"></span>${r.replay ? `<button class="fa-btn sm" type="button" data-rp="${esc(r.room)}">Powtórka</button>` : '<span class="mut">bez powtórki</span>'}
          ${held ? `<button class="fa-btn sm pri" type="button" data-dec="approve" data-room="${esc(r.room)}">Wypłać</button><button class="fa-btn sm bad" type="button" data-dec="reject" data-room="${esc(r.room)}">Odrzuć i zablokuj</button>` : ''}</div>
        ${r.hold ? `<div class="fa-ac-hold">Wstrzymane: ${esc(r.hold)}</div>` : ''}
        <div class="fa-ac-pl">${pls}</div></div>`;
    }).join('');
  }
  box.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.rp) return rp.open(b.dataset.rp);
    try {
      if (b.dataset.dec) {
        const r = data.rooms.find(x => x.room === b.dataset.room), w = r && r.players.find(p => p.state === 'held'), l = r && r.players.find(p => p.state !== 'held');
        if (!confirm(b.dataset.dec === 'approve' ? `Wypłacić wygraną graczowi ${w ? w.name : ''}?`
          : `Odrzucić wygraną gracza ${w ? w.name : ''}? Pula trafi do ${l ? l.name : 'przeciwnika'}, a ${w ? w.name : 'zwycięzca'} dostanie blokadę konta.`)) return;
        b.disabled = true; await srvPost('/api/admin/decide', { room: b.dataset.room, decision: b.dataset.dec });
      } else if (b.dataset.ban) {
        const on = b.dataset.on === '1'; let reason = '';
        if (on) { reason = prompt(`Powód blokady konta ${b.dataset.ban}:`, 'oszukiwanie'); if (reason === null) return; } else if (!confirm(`Odblokować konto ${b.dataset.ban}?`)) return;
        b.disabled = true; await srvPost('/api/admin/ban', { username: b.dataset.ban, banned: on, reason });
      } else return;
    } catch (er) { if (er.code === 'admin2fa') return relockAdmin(); alert(er.message); b.disabled = false; return; }
    last = ''; pull();
  });
  all.addEventListener('change', () => { last = ''; pull(); });
  pull(); const iv = setInterval(pull, 15000); cleanup.push(() => clearInterval(iv));
}
// powtórka z góry mapy: bryły (ciemniejsze = wyższe), gracze z kierunkiem kamery i śladem, strzały z ostatnich 0,35 s
function mountReplay($) {
  const ov = $('fa-rp'), cv = $('fa-rp-cv'), ctx = cv.getContext('2d'), tl = $('fa-rp-tl'), play = $('fa-rp-play');
  const C = { floor: '#151b28', b1: '#2a3244', b2: '#3d465c', b3: '#5a6580', p: ['#4da3ff', '#ff7ab6'], hit: '#ff7a6b', tx: '#eef1f7' };
  let R = null, T = 0, playing = false, lastNow = 0, view = null;
  const stop = () => { playing = false; play.textContent = '▶'; };
  ov.querySelector('[data-rpx]').addEventListener('click', () => { ov.hidden = true; stop(); });
  ov.addEventListener('click', e => { if (e.target === ov) { ov.hidden = true; stop(); } });
  play.addEventListener('click', () => { if (!R) return; if (T >= R.t1) T = R.t0; playing = !playing; play.textContent = playing ? '❚❚' : '▶'; lastNow = performance.now(); if (playing) requestAnimationFrame(loop); });
  tl.addEventListener('input', () => { if (!R) return; T = R.t0 + (tl.value / 1000) * (R.t1 - R.t0); draw(); });
  const onResize = () => { if (!ov.hidden) { resize(); draw(); } }; addEventListener('resize', onResize); cleanup.push(() => removeEventListener('resize', onResize));
  function loop(now) { if (!playing || !R || ov.hidden) return; T += (now - lastNow) / 1000 * +$('fa-rp-spd').value; lastNow = now; if (T >= R.t1) { T = R.t1; stop(); } draw(); if (playing) requestAnimationFrame(loop); }
  function resize() { const r = cv.parentElement.getBoundingClientRect(), d = devicePixelRatio || 1; cv.width = Math.max(10, r.width * d); cv.height = Math.max(10, r.height * d); }
  function at(rows, t) {                                            // stan gracza w chwili t (interpolacja między paczkami ruchu)
    if (!rows.length) return null; let lo = 0, hi = rows.length - 1; if (t <= rows[0][0]) return rows[0]; if (t >= rows[hi][0]) return rows[hi];
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (rows[m][0] <= t) lo = m; else hi = m; }
    const a = rows[lo], b = rows[hi]; if (b[0] - a[0] > 0.5) return a; const k = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
    const dy = Math.atan2(Math.sin(b[5] - a[5]), Math.cos(b[5] - a[5]));
    return [t, a[1], a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k, a[4] + (b[4] - a[4]) * k, a[5] + dy * k, a[6], a[7]];
  }
  function draw() {
    const W = cv.width, H = cv.height, d = devicePixelRatio || 1;
    ctx.fillStyle = C.floor; ctx.fillRect(0, 0, W, H); if (!R || !view) return;
    const pad = 20 * d, s = Math.min((W - pad * 2) / (view.x1 - view.x0 || 1), (H - pad * 2) / (view.z1 - view.z0 || 1));
    const ox = (W - (view.x1 - view.x0) * s) / 2, oz = (H - (view.z1 - view.z0) * s) / 2, X = x => ox + (x - view.x0) * s, Z = z => oz + (z - view.z0) * s;
    for (const b of R.boxes) { if (b[4] < 0.08) continue; ctx.fillStyle = b[4] < 0.7 ? C.b1 : b[4] < 1.8 ? C.b2 : C.b3; ctx.fillRect(X(b[0]), Z(b[2]), (b[3] - b[0]) * s, (b[5] - b[2]) * s); }
    for (const sh of R.rec.sh) { const age = T - sh[0]; if (age < 0 || age > 0.35) continue;
      ctx.globalAlpha = 1 - age / 0.35; ctx.strokeStyle = sh[4] ? C.hit : C.p[sh[1]]; ctx.lineWidth = (sh[4] === 2 ? 3 : 1.4) * d;
      ctx.beginPath(); ctx.moveTo(X(sh[2][0]), Z(sh[2][2])); ctx.lineTo(X(sh[3][0]), Z(sh[3][2])); ctx.stroke(); }
    ctx.globalAlpha = 1;
    for (const seat of [0, 1]) {
      const rows = R.byS[seat], p = at(rows, T); if (!p) continue;
      ctx.strokeStyle = C.p[seat]; ctx.globalAlpha = 0.35; ctx.lineWidth = 1.5 * d; ctx.beginPath(); let first = true;
      for (const r of rows) { if (r[0] < T - 3 || r[0] > T) continue; if (first) { ctx.moveTo(X(r[2]), Z(r[4])); first = false; } else ctx.lineTo(X(r[2]), Z(r[4])); }
      ctx.stroke(); ctx.globalAlpha = 1;
      const px = X(p[2]), pz = Z(p[4]), L = 3.2 * s;
      ctx.lineWidth = 2 * d; ctx.beginPath(); ctx.moveTo(px, pz); ctx.lineTo(px - Math.sin(p[5]) * L, pz - Math.cos(p[5]) * L); ctx.stroke();
      ctx.fillStyle = C.p[seat]; ctx.beginPath(); ctx.arc(px, pz, Math.max(4 * d, 0.32 * s), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.tx; ctx.font = `600 ${12 * d}px Inter,system-ui,sans-serif`; ctx.fillText(`${R.players[seat].nick}  ↕${p[3].toFixed(1)} m`, px + 8 * d, pz - 8 * d);
    }
    const rd = R.rec.rd.filter(r => r[0] <= T).length;
    $('fa-rp-tt').textContent = (T - R.t0).toFixed(1).replace('.', ',') + ' s · runda ' + Math.min(rd + 1, R.rec.rd.length + 1);
    tl.value = Math.round((T - R.t0) / Math.max(1e-6, R.t1 - R.t0) * 1000);
  }
  async function open(room) {
    ov.hidden = false; stop(); R = null; view = null; $('fa-rp-title').textContent = 'Wczytuję powtórkę…'; $('fa-rp-info').textContent = ''; $('fa-rp-side').innerHTML = ''; resize(); draw();
    try { R = await srvGet('/api/admin/replay?room=' + encodeURIComponent(room)); }
    catch (e) { if (e.code === 'admin2fa') return relockAdmin(); $('fa-rp-title').textContent = e.message; return; }
    const st = R.rec.st; R.byS = [[], []]; for (const row of st) R.byS[row[1]].push(row);
    R.t0 = st.length ? st[0][0] : 0; R.t1 = Math.max(R.t0 + 0.1, st.length ? st[st.length - 1][0] : 0, R.rec.sh.length ? R.rec.sh[R.rec.sh.length - 1][0] : 0); T = R.t0;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const b of R.boxes || []) { x0 = Math.min(x0, b[0]); x1 = Math.max(x1, b[3]); z0 = Math.min(z0, b[2]); z1 = Math.max(z1, b[5]); }
    for (const row of st) { x0 = Math.min(x0, row[2]); x1 = Math.max(x1, row[2]); z0 = Math.min(z0, row[4]); z1 = Math.max(z1, row[4]); }
    view = { x0, x1, z0, z1 }; R.boxes = (R.boxes || []).slice().sort((a, b) => a[4] - b[4]);
    $('fa-rp-title').textContent = `${R.map} · ${R.players.map(p => p.nick).join(' vs ')} · ${R.score.join(':')}`;
    $('fa-rp-info').textContent = `stawka ${usd(R.stake)} · ${({ score: 'koniec po rundach', left: 'walkower', cheat: 'wyrzucony za ruch' })[R.reason] || R.reason}`;
    $('fa-rp-lg0').textContent = R.players[0].nick; $('fa-rp-lg1').textContent = R.players[1].nick;
    const kv = (k, v) => `<div class="fa-kv"><span class="mut">${k}</span><b>${v}</b></div>`;
    $('fa-rp-side').innerHTML = R.players.map((p, i) => { const s = R.stats[i] || {}, m = p.summary || {};
      return `<h4 style="color:${C.p[i]};margin-top:${i ? 18 : 0}px">${esc(p.nick)} – ryzyko ${acPct(p.risk)}</h4>
        ${kv('celność', `${acPct(m.acc)} (${m.hits || 0}/${m.shots || 0})`)}${kv('w głowę (cała sylwetka widoczna)', acPct(m.hsOpen))}
        ${kv('mediana reakcji', m.reaction != null ? Math.round(m.reaction * 1000) + ' ms' : '—')}${kv('śledzenie celu', s.track && s.track.n ? acPct(s.track.on / s.track.n) : '—')}
        ${kv('strzały z celownikiem na celu', s.shotsSeen ? acPct(s.shotsOn / s.shotsSeen) : '—')}${kv('snapy / silent aim', `${m.snaps || 0} / ${(m.mismatch || 0) + (m.spikes || 0)}`)}
        ${kv('przerwy w paczkach', m.gaps || 0)}${kv('ping', Math.round((m.rtt || 0) * 1000) + ' ms')}
        ${p.flags.length ? `<ul class="fa-flags">${p.flags.map(f => `<li><span>${Math.round(f.score * 100)}%</span><span>${esc(f.text)}</span></li>`).join('')}</ul>` : '<p class="mut" style="margin:6px 0 0">brak sygnałów</p>'}`; }).join('') +
      `<h4>Rundy</h4><p class="mut" style="margin:0">${R.rec.rd.map(r => `${(r[0] - R.t0).toFixed(1).replace('.', ',')} s: ${esc(R.players[r[1]].nick)}`).join('<br>') || '—'}</p>
       <h4>Jak czytać</h4><p class="mut" style="margin:0">Kółko = gracz, kreska = kierunek kamery, cienkie linie = strzały (czerwone = trafienie, grubsze = w głowę). Ciemniejsze bryły są wyższe.
       Na wolnym tempie widać, czy celownik „przykleja się” do przeciwnika albo skacze na niego zza ściany. Spacja = start/pauza, strzałki = ±0,1 s.</p>`;
    resize(); draw();
  }
  const onKey = e => { if (ov.hidden || !R) return; if (e.key === ' ') { e.preventDefault(); play.click(); }
    if (e.key === 'ArrowRight') { T = Math.min(R.t1, T + 0.1); draw(); } if (e.key === 'ArrowLeft') { T = Math.max(R.t0, T - 0.1); draw(); } };
  addEventListener('keydown', onKey); cleanup.push(() => removeEventListener('keydown', onKey));
  return { open };
}

// sesja admina wygasła w trakcie pracy: panel od nowa (prośba o kod)
function relockAdmin() { admTok.set(''); cleanup.forEach(f => { try { f(); } catch {} }); cleanup = []; if (root) root.remove(); root = null; openAdmin(lastOpts); }

function buildDashboard(db, close) {
  root.innerHTML = `<div class="fa-wrap">
    <div class="fa-head"><div class="fa-brand"><b>GTASSAULT</b><span>Panel admina</span></div><span class="fa-live" id="fa-live">Łączenie…</span><div class="fa-sp"></div>
      ${SRV ? '<button class="fa-btn" type="button" id="fa-lock" title="Kończy sesję panelu – następne wejście wymaga loginu, hasła i kodu 2FA">Wyloguj z panelu</button>' : ''}
      <button class="fa-btn" type="button" data-close>← Wróć do gry</button></div>
    <p class="fa-note" id="fa-note" hidden></p>
    <section class="fa-kpis" id="fa-kpis" aria-label="Liczby ogólne"></section>
    ${SRV ? `<section class="fa-card" id="fa-house-card"><div class="fa-ch"><h3>Prowizja domu – wypłata ze skarbca</h3><small id="fa-house-sum">Ładowanie…</small></div>
      <p class="fa-msg" style="margin:0 0 12px">Prowizja z meczów zostaje w skarbcu razem z pieniędzmi graczy. Wypłacić można tylko <b>nadwyżkę</b>: saldo skarbca minus to, co należy się graczom
        (salda w grze, stawki w trwających meczach, wypłaty w toku) i 0,001 SOL rezerwy. Nadwyżka to niewypłacona prowizja plus <b>inne środki</b> –
        SOL wysłany prosto na adres skarbca (np. na opłaty sieci), pomniejszony o opłaty zapłacone od tamtej pory. Każda wypłata wymaga aktualnego kodu 2FA.</p>
      <div class="fa-dmg" id="fa-house-kv"></div>
      <div class="fa-dmg" style="margin-top:12px">
        <label class="fa-dmf" style="grid-column:span 2"><span>Adres portfela Solana (dokąd)</span><input class="fa-q" id="fa-house-to" placeholder="np. 7xKX…" spellcheck="false" autocomplete="off"></label>
        <label class="fa-dmf"><span>Kwota (SOL)</span><input class="fa-q" id="fa-house-sol" type="number" min="0" step="any" placeholder="0.0"></label>
        <label class="fa-dmf"><span>Kod 2FA</span><input class="fa-q" id="fa-house-code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="123456"></label>
      </div>
      <div class="fa-row"><button class="fa-btn" type="button" id="fa-house-max">Cała nadwyżka</button><button class="fa-btn pri" type="button" id="fa-house-go">Wypłać</button><span class="fa-msg" id="fa-house-msg"></span></div>
      <ul class="fa-list" id="fa-house-hist" style="max-height:220px;overflow:auto;margin-top:8px"></ul></section>
    <section class="fa-grid2">
      <div class="fa-card"><div class="fa-ch"><h3>Wypłaty do akceptacji</h3><small id="fa-wd-sum"></small></div><ul class="fa-list" id="fa-wd"><li class="fa-empty">Ładowanie…</li></ul></div>
      <div class="fa-card"><div class="fa-ch"><h3>Dziennik admina</h3><small>ostatnie 50 zdarzeń</small></div><ul class="fa-list" id="fa-audit" style="max-height:320px;overflow:auto"></ul></div>
    </section>
    <section class="fa-card"><div class="fa-ch"><h3>Antycheat – mecze do sprawdzenia</h3><small id="fa-ac-sum"></small><label class="fa-chk" title="Włączony: wysokie ryzyko, częste mecze tej samej pary, konta powiązane i duże stawki wstrzymują wygraną 1v1 do decyzji admina, a ciągle odrzucany ruch wyrzuca z meczu. Wyłączony: wygrane od razu, bez wyrzucania (ruch przez ściany dalej jest cofany)."><input type="checkbox" id="fa-ac-on"> antycheat włączony</label><label class="fa-chk"><input type="checkbox" id="fa-ac-all"> wszystkie mecze</label></div>
      <p class="fa-msg" style="margin:0 0 12px">Wygrana czeka tutaj, gdy serwer ocenił ryzyko oszustwa zwycięzcy wysoko, konto jest pod obserwacją, ta sama para gra ze sobą za często,
        konta są powiązane albo stawka jest wysoka. <b>Wypłać</b> = pieniądze trafiają do zwycięzcy. <b>Odrzuć i zablokuj</b> = pula przechodzi na przeciwnika, a oszust traci grę o stawki i wypłaty.</p>
      <div id="fa-ac"><p class="fa-empty">Ładowanie…</p></div></section>
    <section class="fa-card" id="fa-dm-card"><div class="fa-ch"><h3>Deathmatch – ustawienia trybu</h3><small id="fa-dm-live"></small></div>
      <p class="fa-msg" style="margin:0 0 12px">Zmiany działają od następnego meczu (kolejki – od razu). Ranking: zabójstwa, przy remisie zadane obrażenia. WANTED = 1. miejsce, za jego zabójstwo nagroda × mnożnik.</p>
      <div id="fa-dm"><p class="fa-empty">Ładowanie…</p></div>
      <div class="fa-row"><button class="fa-btn pri" type="button" id="fa-dm-save">Zapisz ustawienia</button><button class="fa-btn" type="button" id="fa-dm-reset">Przywróć domyślne</button><span class="fa-msg" id="fa-dm-msg"></span></div>
      <h4>Ostatnie mecze Deathmatch</h4><ul class="fa-list" id="fa-dm-recent"><li class="fa-empty">—</li></ul></section>
    <section class="fa-card" id="fa-ars-card"><div class="fa-ch"><h3>Ekwipunek – bronie za trzymanie SOL / tokenu</h3><small id="fa-ars-sum"></small></div>
      <p class="fa-msg" style="margin:0 0 12px">Włączony: w 1v1 i Deathmatch gracz poniżej progu ma tylko pistolet (Glock-17). Każda broń ma próg – ile gracz musi mieć: saldo SOL w grze
        (stawka zamrożona na mecz też się liczy) albo token na adresie depozytu. Nic się nie pobiera. Bronie serwer ustala na starcie meczu. Z botem i Strzelnica – bez zmian.</p>
      <div id="fa-ars"><p class="fa-empty">Ładowanie…</p></div>
      <div class="fa-row"><button class="fa-btn pri" type="button" id="fa-ars-save">Zapisz Ekwipunek</button><button class="fa-btn" type="button" id="fa-ars-reset">Przywróć domyślne</button><span class="fa-msg" id="fa-ars-msg"></span></div></section>
    <section class="fa-card" id="fa-on-card"><div class="fa-ch"><h3>Napis „players online” na górze lobby</h3><small id="fa-on-sum"></small></div>
      <p class="fa-msg" style="margin:0 0 12px">Liczba na środku górnej belki lobby. Rośnie wykładniczo: najpierw szybko (co minutę o podany procent – z każdą minutą przybywa więcej), od progu „zwolnij od” wolniej, aż do limitu. Zapis = start od nowa od liczby startowej. <code>{n}</code> w tekście = liczba.</p>
      <div id="fa-on"><p class="fa-empty">Ładowanie…</p></div>
      <div class="fa-row"><button class="fa-btn pri" type="button" id="fa-on-save">Zapisz</button><button class="fa-btn" type="button" id="fa-on-reset">Przywróć domyślne</button><span class="fa-msg" id="fa-on-msg"></span></div></section>
    <section class="fa-card" id="fa-xs-card"><div class="fa-ch"><h3>Udostępnienie na X – wejście do Deathmatch</h3><small id="fa-xs-sum"></small></div>
      <p class="fa-msg" style="margin:0 0 12px">Włączone: przed Deathmatch gracz publikuje na X gotowy post (przycisk otwiera X z tekstem) i wkleja link. Serwer czyta post (publiczny podgląd X, bez klucza API)
        i sprawdza unikalny kod gracza – <code>{code}</code> musi zostać w tekście – oraz CA. W tekście: <code>{ca}</code> = adres CA, <code>{url}</code> = link do gry, <code>{code}</code> = kod gracza.</p>
      <div id="fa-xs"><p class="fa-empty">Ładowanie…</p></div>
      <div class="fa-row"><button class="fa-btn pri" type="button" id="fa-xs-save">Zapisz</button><button class="fa-btn" type="button" id="fa-xs-reset">Przywróć domyślne</button><span class="fa-msg" id="fa-xs-msg"></span></div></section>` : ''}
    <section class="fa-grid2">
      <div class="fa-card"><div class="fa-ch"><h3>Mecze dziennie</h3><small id="fa-ch-m-sum">ostatnie 14 dni</small></div><div class="fa-chart" id="fa-ch-m"></div></div>
      <div class="fa-card"><div class="fa-ch"><h3>Prowizja dziennie</h3><small id="fa-ch-f-sum">USD (płatne w SOL) · ostatnie 14 dni</small></div><div class="fa-chart" id="fa-ch-f"></div></div>
    </section>
    <section class="fa-card"><div class="fa-ch"><h3>Gracze</h3><input class="fa-q" id="fa-q" type="search" placeholder="Szukaj gracza…" aria-label="Szukaj gracza"></div>
      <div class="fa-tw"><table><thead><tr id="fa-th"></tr></thead><tbody id="fa-tb"></tbody></table></div><p class="fa-empty" id="fa-tb-empty" hidden>Brak graczy.</p></section>
    <section class="fa-grid2">
      <div class="fa-card"><div class="fa-ch"><h3>Ostatnie mecze</h3><small id="fa-rc-sum"></small></div><ul class="fa-list" id="fa-recent"></ul></div>
      <div class="fa-card"><div class="fa-ch"><h3>Ustawienia gry</h3></div>
        <h4 style="margin-top:0">Mapa lobby (dla wszystkich graczy)</h4><div class="fa-maps" id="fa-maps"></div>
        <div class="fa-row"><button class="fa-btn pri" type="button" id="fa-map-save">Zapisz mapę lobby</button><span class="fa-msg" id="fa-map-msg"></span></div>
        <h4>Zapytania biznesowe (zakładka Biznes w grze)</h4><div class="fa-row"><input class="fa-q" id="fa-biz" type="email" maxlength="120" spellcheck="false" autocomplete="off" placeholder="business@twojadomena.com" style="flex:1;min-width:200px">
          <button class="fa-btn pri" type="button" id="fa-biz-save">Zapisz e-mail</button><span class="fa-msg" id="fa-biz-msg"></span></div>
        <h4>Okno logowania – hasło i 3 punkty w lewym panelu</h4>
        <div class="fa-row" id="fa-al-langs" style="gap:6px"></div>
        <div id="fa-al" style="display:grid;gap:8px;margin-top:8px"></div>
        <div class="fa-row"><button class="fa-btn pri" type="button" id="fa-al-save">Zapisz hasła</button><span class="fa-msg" id="fa-al-msg">Puste pole = tekst domyślny.</span></div>
        <h4>Baza danych</h4><div class="fa-meta" id="fa-dbmeta"></div></div>
    </section>
    <section class="fa-card" id="fa-skins-card"><div class="fa-ch"><h3>Skiny</h3><small id="fa-sk-sum">skiny z kreatora · kafelki w lobby</small></div>
      <div class="fa-skins" id="fa-skins"></div>
      <div class="fa-row"><button class="fa-btn" type="button" id="fa-sk-new">+ Nowy skin</button><button class="fa-btn" type="button" id="fa-sk-dl">Pobierz skins.json</button>
        <button class="fa-btn pri" type="button" id="fa-sk-pub">Opublikuj w grze</button><span class="fa-msg" id="fa-sk-msg"></span></div>
      <details class="fa-gh" id="fa-gh"><summary>Publikowanie na GitHubie (skins.json w repozytorium gry)</summary>
        <label>Repozytorium<input id="fa-gh-repo" spellcheck="false" autocapitalize="off" placeholder="użytkownik/repo"></label>
        <label>Token GitHub (Fine-grained, tylko to repo, Contents: zapis)<input id="fa-gh-token" type="password" autocomplete="off" spellcheck="false"></label>
        <p class="fa-msg" style="margin:8px 0 0">Token zostaje tylko w tej przeglądarce.</p>
      </details>
    </section>
  </div>
  <div class="fa-drw" id="fa-drw" hidden><div id="fa-drw-in" role="dialog" aria-label="Szczegóły gracza"></div></div>
  ${SRV ? `<div class="fa-rp" id="fa-rp" hidden><div role="dialog" aria-label="Powtórka meczu">
    <div class="fa-rp-top"><b id="fa-rp-title">Powtórka</b><span class="mut" id="fa-rp-info"></span><span class="fa-sp"></span>
      <span class="mut"><i class="fa-dot" style="background:#4da3ff"></i><span id="fa-rp-lg0"></span></span><span class="mut"><i class="fa-dot" style="background:#ff7ab6"></i><span id="fa-rp-lg1"></span></span>
      <span class="mut">— strzał</span><span style="color:var(--bad)">— trafienie</span><button class="fa-btn sm" type="button" data-rpx>Zamknij</button></div>
    <div class="fa-rp-cv"><canvas id="fa-rp-cv"></canvas></div>
    <div class="fa-rp-side" id="fa-rp-side"></div>
    <div class="fa-rp-bar"><button class="fa-btn sm" type="button" id="fa-rp-play" aria-label="Odtwórz">▶</button>
      <select id="fa-rp-spd" aria-label="Tempo"><option value="0.25">0,25×</option><option value="0.5">0,5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select>
      <input type="range" id="fa-rp-tl" min="0" max="1000" value="0" step="1" aria-label="Czas meczu"><span class="mut" id="fa-rp-tt" style="min-width:110px;text-align:right">0,0 s</span></div>
  </div></div>` : ''}`;
  const $ = id => root.querySelector('#' + id);
  root.querySelector('[data-close]').addEventListener('click', close);
  const live = $('fa-live'), note = $('fa-note');
  let accounts = [], matches = [], gotA = false, gotM = false, sort = { key: 'last', dir: -1 }, q = '', raf = 0;
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); };

  // ---------- dane ----------
  let srv = null;
  if (SRV) {
    live.textContent = 'Łączenie…';
    const pull = async () => {
      try { const r = await fetch(SRV + '/api/admin/overview', { headers: AH() });
        if (r.status === 401) { const j = await r.json().catch(() => ({})); if (j.error === 'admin2fa') return relockAdmin(); }
        if (!r.ok) throw 0;
        srv = await r.json(); accounts = srv.accounts; matches = srv.matches; gotA = gotM = true; note.hidden = true;
        live.classList.add('on'); live.textContent = 'Na żywo · ' + srv.cluster; schedule(); renderSrv(); }
      catch { live.classList.remove('on'); live.textContent = 'Rozłączono'; note.hidden = false; note.textContent = 'Serwer portfeli nie odpowiada – ponawiam…'; }
    };
    pull(); const iv = setInterval(pull, 10000); cleanup.push(() => clearInterval(iv));
    // wypłaty powyżej progu czekają tutaj; dziennik: logowania, 2FA, zmiany ustawień, decyzje o wypłatach
    const AUD = { admin_login: 'Logowanie do panelu', admin_login_fail: 'Nieudane logowanie do panelu', admin_add: 'Nowe konto admina (serwer)', admin_password: 'Nowe hasło admina (serwer)',
      admin_2fa_reset: 'Reset 2FA (serwer)', admin_delete: 'Usunięte konto admina (serwer)', '2fa_setup': 'Pierwsze logowanie – klucz 2FA', '2fa_on': 'Włączenie 2FA', config: 'Zmiana ustawień',
      wd_approve: 'Wypłata zaakceptowana', wd_reject: 'Wypłata odrzucona', match_approve: 'Antycheat: wygrana wypłacona', match_reject: 'Antycheat: wygrana odrzucona',
      ban: 'Blokada konta gracza', unban: 'Odblokowanie konta gracza' };
    const renderSrv = () => {
      if (!srv || !$('fa-wd')) return;
      const wd = srv.withdrawals || [], lim = srv.limits || {};
      $('fa-wd-sum').textContent = `powyżej ${usd(lim.reviewUsd || 0)} · limit ${usd(lim.dailyUsd || 0)} na konto / 24 h`;
      $('fa-wd').innerHTML = wd.length ? wd.map(w => `<li><div><b>${esc(w.name)} · ${esc(usd(w.usd))}</b><small>${new Date(w.t).toLocaleString('pl-PL')} · ${w.sol.toLocaleString('pl-PL', { maximumFractionDigits: 6 })} SOL → <code title="${esc(w.to)}">${esc(w.to.slice(0, 4) + '…' + w.to.slice(-4))}</code></small></div>
        <span class="r" style="display:flex;gap:6px"><button class="fa-btn pri" type="button" data-wd="${+w.id}" data-ok="1">Wypłać</button><button class="fa-btn" type="button" data-wd="${+w.id}" data-ok="0">Odrzuć</button></span></li>`).join('')
        : '<li class="fa-empty">Brak wypłat do akceptacji</li>';
      $('fa-audit').innerHTML = (srv.audit || []).length ? srv.audit.map(a => `<li><div><b>${esc(AUD[a.action] || a.action)}${a.username ? ' · ' + esc(a.username) : ''}</b><small>${new Date(a.t).toLocaleString('pl-PL')} · IP ${esc(a.ip || '—')}${a.detail ? ' · ' + esc(a.detail) : ''}</small></div></li>`).join('')
        : '<li class="fa-empty">Brak zdarzeń</li>';
    };
    $('fa-wd').addEventListener('click', async e => {
      const b = e.target.closest('[data-wd]'); if (!b) return; const ok = b.dataset.ok === '1';
      if (!confirm(ok ? 'Wysłać tę wypłatę ze skarbca?' : 'Odrzucić wypłatę i oddać środki na saldo gracza?')) return;
      b.disabled = true;
      try { const j = await srvPost('/api/admin/withdraw', { id: +b.dataset.wd, approve: ok }); if (ok && !j.ok) alert('Wypłata nie przeszła – środki wróciły na saldo gracza.'); }
      catch (er) { if (er.code === 'admin2fa') return relockAdmin(); alert(er.message); }
      pull();
    });
    $('fa-lock').addEventListener('click', async () => { try { await srvPost('/api/admin/logout'); } catch {} admTok.set(''); close(); });
    mountHouse($);
    mountAnticheat($);
    mountDeathmatch($);
    mountArsenal($);
    mountOnline($);
    mountXShare($);
  } else if (db) {
    const timer = setTimeout(() => { if (!gotA) { note.hidden = false; note.textContent = 'Baza danych jeszcze nie odpowiada – dane mogą być niepełne.'; } }, 10000);
    cleanup.push(() => clearTimeout(timer));
    const err = e => { note.hidden = false; note.textContent = 'Błąd bazy danych: ' + (e && e.code || 'nieznany') + '. Odśwież panel.'; live.classList.remove('on'); live.textContent = 'Rozłączono'; };
    cleanup.push(db.collection('accounts').limit(1000).onSnapshot(s => {
      accounts = s.docs.map(d => ({ id: d.id, ...d.data() })); gotA = true; if (!s.metadata || !s.metadata.fromCache) { clearTimeout(timer); note.hidden = true; }
      live.classList.add('on'); live.textContent = 'Na żywo'; schedule();
    }, err));
    cleanup.push(db.collection('matches').orderBy('t', 'desc').limit(1000).onSnapshot(s => { matches = s.docs.map(d => ({ id: d.id, ...d.data() })); gotM = true; schedule(); }, err));
  } else {
    note.hidden = false; note.textContent = 'Tryb lokalny: brak połączenia z bazą danych gry (strona otwarta poza claude.ai). Widać tylko konta i mecze z tej przeglądarki.';
    live.textContent = 'Tryb lokalny';
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('fasolka-acc:')) accounts.push({ id: k.slice(12), ...JSON.parse(localStorage.getItem(k)) }); } } catch {}
    try { matches = JSON.parse(localStorage.getItem('fasolka-matches') || '[]'); } catch {}
    gotA = gotM = true; schedule();
  }

  // ---------- ustawienia: mapa lobby ----------
  const mapsBox = $('fa-maps'); let curMap = null;
  try { curMap = localStorage.getItem('fasolka-lobby-map'); } catch {}
  const renderMaps = () => { mapsBox.innerHTML = LOBBY_MAPS.map(m => `<label><input type="radio" name="fa-lmap" value="${esc(m.id)}"${m.id === (curMap || DEFAULT_LOBBY) ? ' checked' : ''}><div><b>${esc(m.name)}</b><small>${esc(m.desc)}</small></div></label>`).join(''); };
  renderMaps();
  if (db) db.doc('config/lobby').get().then(s => { if (s.exists && s.data().map) { curMap = s.data().map; renderMaps(); } }).catch(() => {});
  $('fa-map-save').addEventListener('click', async e => {
    const v = (mapsBox.querySelector('input:checked') || {}).value, msg = $('fa-map-msg'); if (!v) return;
    e.currentTarget.disabled = true; msg.className = 'fa-msg'; msg.textContent = 'Zapisywanie…';
    try {
      if (db) await db.doc('config/lobby').set({ map: v, updatedAt: Date.now() });
      try { localStorage.setItem('fasolka-lobby-map', v); } catch {}
      curMap = v; msg.className = 'fa-msg ok'; msg.textContent = db ? 'Zapisano. Gracze zobaczą nową mapę lobby przy następnym wejściu do gry.' : 'Zapisano w tej przeglądarce.';
    } catch (er) { msg.className = 'fa-msg err'; msg.textContent = 'Nie udało się zapisać (' + (er && er.code || 'błąd') + ').'; }
    e.currentTarget.disabled = false;
  });

  // ---------- e-mail do zapytań biznesowych (pokazuje go zakładka Biznes w ustawieniach gry) ----------
  const bizIn = $('fa-biz'), bizMsg = $('fa-biz-msg'), H = AH;
  (async () => { try {
    if (SRV) bizIn.value = (await (await fetch(SRV + '/api/config')).json()).businessEmail || '';
    else if (db) { const sn = await db.doc('config/business').get(); bizIn.value = sn.exists ? sn.data().email || '' : ''; }
    else bizIn.value = localStorage.getItem('fasolka-biz-email') || '';
  } catch {} })();
  $('fa-biz-save').addEventListener('click', async e => {
    const v = bizIn.value.trim(); bizMsg.className = 'fa-msg';
    if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { bizMsg.className = 'fa-msg err'; bizMsg.textContent = 'Nieprawidłowy adres e-mail.'; return; }
    e.currentTarget.disabled = true; bizMsg.textContent = 'Zapisywanie…';
    try {
      if (SRV) { const r = await fetch(SRV + '/api/admin/config', { method: 'POST', headers: H(), body: JSON.stringify({ businessEmail: v }) }); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'błąd'); }
      else if (db) await db.doc('config/business').set({ email: v, updatedAt: Date.now() });
      try { localStorage.setItem('fasolka-biz-email', v); } catch {}
      dispatchEvent(new CustomEvent('fasolka:biz-email', { detail: v }));
      bizMsg.className = 'fa-msg ok'; bizMsg.textContent = v ? 'Zapisano – gracze zobaczą ten adres w zakładce Biznes.' : 'Usunięto adres.';
    } catch (er) { bizMsg.className = 'fa-msg err'; bizMsg.textContent = 'Nie udało się zapisać (' + (er.message || er.code || 'błąd') + ').'; }
    e.currentTarget.disabled = false;
  });

  // ---------- okno logowania: hasło i 3 punkty (każdy język osobno; puste = domyślne) ----------
  const AL_K = [['tag', 'Hasło pod logo'], ['f1', 'Punkt 1 (🏆)'], ['f2', 'Punkt 2 (Solana)'], ['f3', 'Punkt 3 (⚡)']], AL_L = { pl: 'PL', en: 'EN', ru: 'RU', es: 'ES' };
  let alData = {}, alLang = 'en';
  const alRender = () => {
    $('fa-al-langs').innerHTML = Object.entries(AL_L).map(([l, n]) => `<button type="button" class="fa-btn${l === alLang ? ' pri' : ''}" data-al="${l}" style="height:32px;padding:0 12px">${n}</button>`).join('');
    $('fa-al').innerHTML = AL_K.map(([k, n]) => `<label style="display:grid;gap:4px;font-size:12px;color:var(--mut)">${esc(n)}<input class="fa-q" data-k="${k}" maxlength="140" value="${esc((alData[alLang] || {})[k] || '')}" placeholder="${esc(AUTH_TXT[alLang]['auth.' + k])}" style="width:100%"></label>`).join('');
  };
  const alKeep = () => { const o = {}; $('fa-al').querySelectorAll('input').forEach(i => { if (i.value.trim()) o[i.dataset.k] = i.value.trim(); }); alData[alLang] = o; };
  $('fa-al-langs').addEventListener('click', e => { const b = e.target.closest('[data-al]'); if (!b) return; alKeep(); alLang = b.dataset.al; alRender(); });
  (async () => { try {
    if (SRV) alData = (await (await fetch(SRV + '/api/config')).json()).authTexts || {};
    else if (db) { const sn = await db.doc('config/auth').get(); alData = sn.exists ? sn.data().texts || {} : {}; }
    else alData = JSON.parse(localStorage.getItem('fasolka-auth-texts') || '{}') || {};
  } catch {} alRender(); })();
  $('fa-al-save').addEventListener('click', async e => {
    alKeep(); const msg = $('fa-al-msg'), btn = e.currentTarget; btn.disabled = true; msg.className = 'fa-msg'; msg.textContent = 'Zapisywanie…';
    try {
      if (SRV) { const r = await fetch(SRV + '/api/admin/config', { method: 'POST', headers: H(), body: JSON.stringify({ authTexts: alData }) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.message || 'błąd'); alData = j.authTexts || alData; }
      else if (db) await db.doc('config/auth').set({ texts: alData, updatedAt: Date.now() });
      try { localStorage.setItem('fasolka-auth-texts', JSON.stringify(alData)); } catch {}
      dispatchEvent(new CustomEvent('fasolka:auth-texts', { detail: alData }));
      msg.className = 'fa-msg ok'; msg.textContent = 'Zapisano – gracze zobaczą nowe hasła w oknie logowania.';
    } catch (er) { msg.className = 'fa-msg err'; msg.textContent = 'Nie udało się zapisać (' + (er.message || 'błąd') + ').'; }
    btn.disabled = false;
  });

  // ---------- skiny z kreatora: lista, nowy / edycja w kreatorze, usuwanie, kolejność, tag, publikacja ----------
  // Źródło: skins.json obok gry (repozytorium na GitHubie). Zmiany od razu widać w lobby tej przeglądarki (zdarzenie fasolka:skins),
  // a „Opublikuj w grze” zapisuje skins.json w repo przez GitHub API, więc po odświeżeniu widzą je wszyscy gracze.
  const BUILTIN_IDS = new Set(BUILTIN_SKINS.map(k => k.id));
  const skBox = $('fa-skins'), skMsg = $('fa-sk-msg'), ghRepo = $('fa-gh-repo'), ghTok = $('fa-gh-token');
  let skins = SKINS.filter(k => !BUILTIN_IDS.has(k.id)).map(k => ({ ...k })), skDirty = false;
  const setSkMsg = (t, cls) => { skMsg.className = 'fa-msg' + (cls ? ' ' + cls : ''); skMsg.textContent = t; };
  fetch('./skins.json?v=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : null)
    .then(list => { if (Array.isArray(list) && !skDirty) { skins = list.filter(k => k && k.id && !BUILTIN_IDS.has(k.id)); renderSkins(); } }).catch(() => {});
  const gh = (() => { try { return JSON.parse(localStorage.getItem('fasolka-gh')) || {}; } catch { return {}; } })();
  ghRepo.value = gh.repo || 'smolka77/bean-fps'; ghTok.value = gh.token || '';
  const saveGh = () => { try { localStorage.setItem('fasolka-gh', JSON.stringify({ repo: ghRepo.value.trim(), token: ghTok.value.trim() })); } catch {} };
  ghRepo.addEventListener('change', saveGh); ghTok.addEventListener('change', saveGh);
  function renderSkins() {
    if (!root) return;
    $('fa-sk-sum').textContent = skins.length + ' ' + pl(skins.length, 'skin', 'skiny', 'skinów') + ' z kreatora · kafelki w lobby';
    if (!skins.length) { skBox.innerHTML = '<p class="fa-empty" style="grid-column:1/-1">Nie ma jeszcze skinów z kreatora. Kliknij „+ Nowy skin”.</p>'; return; }
    skBox.innerHTML = skins.map((k, i) => `<div class="fa-sk" data-i="${i}">${k.icon ? `<img src="${esc(k.icon)}" alt="">` : '<span class="ph"></span>'}
      <div class="in"><b>${esc(k.name)}</b><small>${esc(k.id)}${k.tex ? '' : ' · bez rysunku'}${k.eyes ? ' · oczy z gry' : ''}</small>
      <div class="bt"><input data-tag value="${esc(k.tag || '')}" maxlength="12" title="Napis pod nazwą w lobby (tag)">
        <button type="button" data-a="up" title="Wcześniej w lobby"${i === 0 ? ' disabled' : ''}>↑</button><button type="button" data-a="down" title="Później w lobby"${i === skins.length - 1 ? ' disabled' : ''}>↓</button>
        <button type="button" data-a="edit">Edytuj</button><button type="button" data-a="del" class="del">Usuń</button></div></div></div>`).join('');
  }
  function skChanged() { skDirty = true; renderSkins(); dispatchEvent(new CustomEvent('fasolka:skins', { detail: skins })); setSkMsg('Masz nieopublikowane zmiany – kliknij „Opublikuj w grze”.'); }
  skBox.addEventListener('change', e => { const inp = e.target.closest('[data-tag]'); if (!inp) return; const k = skins[+inp.closest('.fa-sk').dataset.i]; k.tag = inp.value.trim().toUpperCase(); skChanged(); });
  skBox.addEventListener('click', e => {
    const b = e.target.closest('button[data-a]'); if (!b) return; const i = +b.closest('.fa-sk').dataset.i, k = skins[i];
    if (b.dataset.a === 'up' || b.dataset.a === 'down') { const j = b.dataset.a === 'up' ? i - 1 : i + 1; [skins[i], skins[j]] = [skins[j], skins[i]]; skChanged(); }
    else if (b.dataset.a === 'del') { if (confirm('Usunąć skin „' + k.name + '”?')) { skins.splice(i, 1); skChanged(); } }
    else if (b.dataset.a === 'edit') openKreator(k, d => { skins[i] = fromKreator(d, k); skChanged(); });
  });
  const uniqueId = base => { base = base || 'skin'; let id = base, n = 2; const used = new Set([...BUILTIN_IDS, ...skins.map(k => k.id)]); while (used.has(id)) id = base + '-' + n++; return id; };
  const fromKreator = (d, prev) => ({ id: prev ? prev.id : uniqueId(d.id), name: d.name || 'Skin', c: d.c || '#ffffff', eyes: d.eyes === true, tag: prev ? prev.tag : 'WŁASNY',
    ...(d.tex ? { tex: d.tex, proj: d.proj } : {}), ...(d.icon ? { icon: d.icon } : {}) });
  // kreator skinów w nakładce na cały ekran (kreator-skinow.html obok gry, tryb ?embed)
  function openKreator(k, done) {
    let ov = document.getElementById('fa-kreator');
    if (!ov) { ov = document.createElement('div'); ov.id = 'fa-kreator'; document.body.appendChild(ov); }
    ov.innerHTML = ''; const fr = document.createElement('iframe'); fr.src = './kreator-skinow.html?embed=1'; fr.title = 'Kreator skinów'; fr.allow = 'clipboard-write'; ov.appendChild(fr); ov.hidden = false;
    const shut = () => { removeEventListener('message', onMsg); ov.hidden = true; ov.innerHTML = ''; };
    const onMsg = e => {
      if (e.source !== fr.contentWindow) return; const m = e.data || {};
      if (m.type === 'fasolka-kreator-ready') fr.contentWindow.postMessage({ type: 'fasolka-skin-load',
        skin: k ? { format: 'fasolka-skin', version: 1, id: k.id, name: k.name, c: k.c, eyes: k.eyes, tex: k.tex || null, proj: k.proj } : null }, '*');
      else if (m.type === 'fasolka-skin-save' && m.skin && m.skin.format === 'fasolka-skin') { shut(); done(m.skin); }
      else if (m.type === 'fasolka-kreator-close') shut();
    };
    addEventListener('message', onMsg); cleanup.push(shut);
  }
  $('fa-sk-new').addEventListener('click', () => openKreator(null, d => { skins.push(fromKreator(d)); skChanged(); }));
  const skinsJson = () => '[\n' + skins.map(k => JSON.stringify(k)).join(',\n') + '\n]\n';
  $('fa-sk-dl').addEventListener('click', () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([skinsJson()], { type: 'application/json' }));
    a.download = 'skins.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); });
  $('fa-sk-pub').addEventListener('click', async e => {
    saveGh(); const repo = ghRepo.value.trim(), token = ghTok.value.trim(), btn = e.currentTarget;
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !token) { $('fa-gh').open = true; return setSkMsg('Wpisz repozytorium i token GitHub poniżej.', 'err'); }
    btn.disabled = true; setSkMsg('Publikuję…');
    try {
      const url = 'https://api.github.com/repos/' + repo + '/contents/skins.json', H = { Authorization: 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28' };
      const g = await fetch(url + '?ref=main', { headers: { ...H, Accept: 'application/vnd.github.object' }, cache: 'no-store' });
      if (!g.ok && g.status !== 404) throw new Error('GitHub ' + g.status + (g.status === 401 ? ' (zły token)' : ''));
      const sha = g.ok ? (await g.json()).sha : undefined;
      const bytes = new TextEncoder().encode(skinsJson()); let bin = ''; for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode(...bytes.subarray(i, i + 32768));
      const p = await fetch(url, { method: 'PUT', headers: { ...H, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Skiny: zmiany z panelu admina (' + skins.length + ')', content: btoa(bin), branch: 'main', ...(sha ? { sha } : {}) }) });
      if (!p.ok) { let m = ''; try { m = (await p.json()).message; } catch {} throw new Error('GitHub ' + p.status + (m ? ': ' + m : '')); }
      skDirty = false; setSkMsg('Opublikowano. Gracze zobaczą zmiany po odświeżeniu strony (GitHub Pages potrzebuje 1–2 minut).', 'ok');
    } catch (er) { setSkMsg('Nie udało się opublikować: ' + (er && er.message || er), 'err'); }
    btn.disabled = false;
  });
  renderSkins();

  // ---------- tabela graczy ----------
  const COLS = [
    ['name', 'Gracz', r => `<div class="fa-u"><span class="fa-av">${esc((r.name[0] || '?').toUpperCase())}</span>${esc(r.name)}</div>`, r => r.name.toLowerCase()],
    ['created', 'Dołączył', r => r.created ? new Date(r.created).toLocaleDateString('pl-PL') : '—'],
    ['last', 'Ostatnio', r => esc(ago(r.last))],
    ['matches', 'Mecze', r => fmtInt(r.matches)],
    ['wins', 'W – P', r => `${fmtInt(r.wins)} – ${fmtInt(r.losses)}`],
    ['wr', '% wygr.', r => r.wr < 0 ? '<span class="mut">—</span>' : Math.round(r.wr * 100) + '%'],
    ['staked', 'Postawione', r => fmtMoney(r.staked)],
    ['won', 'Wygrane', r => fmtMoney(r.won)],
    ['net', 'Wynik', r => `<span class="${r.net > 0 ? 'pos' : r.net < 0 ? 'neg' : 'mut'}">${r.net > 0 ? '+' : r.net < 0 ? '−' : ''}${fmtMoney(Math.abs(r.net))}</span>`],
    ['fees', 'Prowizja', r => fmtMoney(r.fees)],
    ['balance', 'Saldo', r => SRV ? `${usd(r.balance)}<small class="mut" style="display:block">${r.sol.toLocaleString('pl-PL', { maximumFractionDigits: 4 })} SOL</small>` : fmtMoney(r.balance)],
    ...(SRV ? [['wallet', 'Adres depozytu', r => r.wallet ? `<code title="${esc(r.wallet)}">${esc(r.wallet.slice(0, 4) + '…' + r.wallet.slice(-4))}</code>` : '—']] : []),
    ['acc', 'Celność', r => r.acc < 0 ? '<span class="mut">—</span>' : Math.round(r.acc * 100) + '%'],
    ['hs', 'HS%', r => r.hs < 0 ? '<span class="mut">—</span>' : Math.round(r.hs * 100) + '%'],
    ['kd', 'K/D', r => r.kd < 0 ? '<span class="mut">—</span>' : r.kd.toFixed(2)],
  ];
  const th = $('fa-th');
  th.innerHTML = COLS.map(([k, label]) => `<th data-k="${k}" scope="col">${label}</th>`).join('');
  th.addEventListener('click', e => { const c = e.target.closest('th'); if (!c) return; const k = c.dataset.k; sort = sort.key === k ? { key: k, dir: -sort.dir } : { key: k, dir: k === 'name' ? 1 : -1 }; render(); });
  $('fa-q').addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); render(); });
  $('fa-tb').addEventListener('click', e => { const tr = e.target.closest('tr[data-id]'); if (tr) openPlayer(tr.dataset.id); });
  const drw = $('fa-drw');
  drw.addEventListener('click', e => { if (e.target === drw || e.target.closest('[data-x]')) drw.hidden = true; });

  let rows = [];
  function openPlayer(id) {
    const r = rows.find(x => x.id === id); if (!r) return;
    const tx = { deposit: 'Wpłata (test)', withdraw: 'Wypłata (test)', stake: 'Stawka 1v1', win: 'Wygrana 1v1', loss: 'Przegrana 1v1' };
    const meta = [['Saldo', usd(r.balance)], ['Mecze', fmtInt(r.matches)], ['Wygrane – przegrane', `${r.wins} – ${r.losses}`], ['% wygranych', r.wr < 0 ? '—' : Math.round(r.wr * 100) + '%'],
      ['Postawione', usd(r.staked)], ['Wygrane (wypłaty)', usd(r.won)], ['Wynik z gier', (r.net >= 0 ? '+' : '−') + usd(Math.abs(r.net))], ['Prowizja od gracza', usd(r.fees)],
      ['Wpłaty (test)', usd(r.deposits)], ['Wypłaty (test)', usd(r.withdrawn)], ['Strzały', fmtInt(r.shots)], ['Trafienia', fmtInt(r.hits) + (r.acc >= 0 ? ' · ' + Math.round(r.acc * 100) + '%' : '')],
      ['W głowę', fmtInt(r.heads) + (r.hs >= 0 ? ' · ' + Math.round(r.hs * 100) + '%' : '')], ['Zabójstwa', fmtInt(r.kills)], ['Śmierci', fmtInt(r.deaths)], ['K/D', r.kd < 0 ? '—' : r.kd.toFixed(2)]];
    $('fa-drw-in').innerHTML = `<div class="fa-dh"><span class="fa-av">${esc((r.name[0] || '?').toUpperCase())}</span><div><h3>${esc(r.name)}</h3>
      <small>Dołączył ${r.created ? new Date(r.created).toLocaleString('pl-PL') : '—'} · ostatnio ${esc(ago(r.last))}</small></div><button class="fa-x" type="button" data-x aria-label="Zamknij">×</button></div>
      ${r.wallet ? `<p class="fa-msg">${SRV ? 'Adres depozytu w grze' : 'Portfel Solana'}: <code>${esc(r.wallet)}</code>${SRV ? ` · <a href="https://explorer.solana.com/address/${esc(r.wallet)}${srv && srv.cluster !== 'mainnet-beta' ? '?cluster=' + esc(srv.cluster) : ''}" target="_blank" rel="noopener">eksplorator ↗</a> · saldo ${r.sol.toLocaleString('pl-PL', { maximumFractionDigits: 6 })} SOL` : ''}</p>` : ''}
      <div class="fa-meta">${meta.map(([k, v]) => `<div><small>${k}</small><b>${esc(v)}</b></div>`).join('')}</div>
      <h4>Ostatnie operacje (do 40)</h4>
      <ul class="fa-list">${r.history.length ? r.history.map(h => `<li><div><b>${esc(tx[h.type] || h.type)}${h.fee ? ' · prowizja ' + fmtMoney(h.fee) : h.note ? ' · ' + esc(h.note) : ''}</b><small>${h.t ? new Date(h.t).toLocaleString('pl-PL') : ''}</small></div>
        <span class="r ${h.amount > 0 ? 'pos' : h.amount < 0 ? 'neg' : 'mut'}">${h.amount ? (h.amount > 0 ? '+' : '−') + fmtMoney(Math.abs(h.amount)) : '—'}</span></li>`).join('') : '<li class="fa-empty">Brak operacji</li>'}</ul>`;
    drw.hidden = false;
  }

  // ---------- wykres słupkowy (jedna seria, podpowiedź po najechaniu) ----------
  function bars(el, days, vals, fmt, unit) {
    const W = 560, H = 190, pl = 44, pr = 6, pt = 10, pb = 24, n = vals.length, maxV = Math.max(0, ...vals);
    const nice = m => { if (m <= 0) return 1; const p = 10 ** Math.floor(Math.log10(m)), f = m / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };
    const top = nice(maxV), step = (W - pl - pr) / n, bw = Math.max(6, Math.min(26, step - 8)), y = v => pt + (H - pt - pb) * (1 - v / top), base = H - pb;
    const grid = [0, top / 2, top].map(v => `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}"/>`).join('');
    const yl = [0, top / 2, top].map(v => `<text x="${pl - 8}" y="${y(v) + 3}" text-anchor="end">${esc(fmt(v))}</text>`).join('');
    let b = '', hits = '', xl = '';
    vals.forEach((v, i) => {
      const cx = pl + step * i + step / 2, x0 = cx - bw / 2, yt = y(v), h = base - yt, r = Math.min(4, h);
      if (v > 0) b += `<path class="bar" d="M${x0} ${base}V${yt + r}Q${x0} ${yt} ${x0 + r} ${yt}H${x0 + bw - r}Q${x0 + bw} ${yt} ${x0 + bw} ${yt + r}V${base}Z"/>`;
      hits += `<rect class="hit" data-i="${i}" x="${pl + step * i}" y="${pt}" width="${step}" height="${base - pt}"/><rect class="hl" x="${pl + step * i + 1}" y="${pt}" width="${step - 2}" height="${base - pt}" rx="4"/>`;
      if (i % 2 === (n - 1) % 2) xl += `<text x="${cx}" y="${H - 6}" text-anchor="middle">${days[i].slice(8)}.${days[i].slice(5, 7)}</text>`;
    });
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(el.dataset.label || '')}"><g class="grid">${grid}</g><g class="ax">${yl}${xl}</g><g>${b}</g><g>${hits}</g></svg><div class="fa-tip" hidden></div>`;
    const tip = el.querySelector('.fa-tip'), svg = el.querySelector('svg');
    svg.addEventListener('pointermove', e => { const t = e.target.closest('.hit'); if (!t) { tip.hidden = true; return; } const i = +t.dataset.i, rc = svg.getBoundingClientRect(), k = rc.width / W;
      tip.innerHTML = `<small>${new Date(days[i] + 'T12:00').toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' })}</small>${esc(fmt(vals[i], true))}${unit ? ' ' + unit : ''}`;
      tip.style.left = ((pl + step * i + step / 2) * k) + 'px'; tip.style.top = (y(vals[i]) * k) + 'px'; tip.hidden = false; });
    svg.addEventListener('pointerleave', () => { tip.hidden = true; });
  }

  // ---------- render ----------
  function render() {
    if (!root) return;
    rows = accounts.map(playerStats);
    const T = rows.reduce((o, r) => { for (const k of ['matches', 'wins', 'losses', 'staked', 'won', 'fees', 'deposits', 'withdrawn', 'balance', 'shots', 'hits', 'kills']) o[k] += r[k]; return o; },
      { matches: 0, wins: 0, losses: 0, staked: 0, won: 0, fees: 0, deposits: 0, withdrawn: 0, balance: 0, shots: 0, hits: 0, kills: 0 });
    const now = Date.now(), wk = now - 7 * 86400e3, active7 = rows.filter(r => r.last >= wk).length, new7 = rows.filter(r => r.created >= wk).length;
    const today = dayKey(now), today$ = matches.filter(m => dayKey(m.t) === today);
    const kpi = (label, val, sub, unit = '', hi = false) => `<div class="fa-kpi${hi ? ' hi' : ''}"><small>${label}</small><b>${val}${unit ? `<u>${unit}</u>` : ''}</b><span>${sub}</span></div>`;
    $('fa-kpis').innerHTML = [
      kpi('Gracze', fmtInt(rows.length), `+${new7} ${pl(new7, 'nowy', 'nowych', 'nowych')} w 7 dni`),
      kpi('Aktywni (7 dni)', fmtInt(active7), rows.length ? pct(active7, rows.length) + ' wszystkich' : '—'),
      kpi('Mecze 1v1', fmtInt(T.matches), `W ${fmtInt(T.wins)} · P ${fmtInt(T.losses)} · dziś ${fmtInt(today$.length)}`),
      kpi('Łączne stawki', usd(T.staked), T.matches ? 'średnio ' + usd(T.staked / T.matches) : '—', 'w SOL'),
      kpi('Łączne wygrane graczy', usd(T.won), `${fmtInt(T.wins)} ${pl(T.wins, 'wygrany mecz', 'wygrane mecze', 'wygranych meczów')} (po prowizji)`, 'w SOL'),
      kpi('Zarobek – prowizja 10%', usd(T.fees), '10% puli każdej wygranej', 'w SOL', true),
      kpi('Wynik domu', (T.staked - T.won >= 0 ? '+' : '−') + usd(Math.abs(T.staked - T.won)), 'stawki − wypłaty (dom gra jako bot)', 'w SOL'),
      kpi('Saldo graczy', usd(T.balance), `wpłaty ${usd(T.deposits)} · wypłaty ${usd(T.withdrawn)}${SRV ? '' : ' (test)'}`, 'w SOL'),
      ...(SRV && srv ? [kpi('Skarbiec (on-chain)', usd(srv.treasury.usd), `${(srv.treasury.lamports / 1e9).toLocaleString('pl-PL', { maximumFractionDigits: 4 })} SOL · pokrycie sald ${srv.ledger.lamports ? Math.round(srv.treasury.lamports / srv.ledger.lamports * 100) + '%' : '—'}${srv.pendingSweep ? ' · w drodze ' + (srv.pendingSweep / 1e9).toLocaleString('pl-PL', { maximumFractionDigits: 4 }) + ' SOL' : ''}`, 'w SOL', srv.treasury.lamports < srv.ledger.lamports),
        kpi('Kurs SOL', usd(srv.price), `sieć ${esc(srv.cluster)} · <code title="${esc(srv.treasury.address)}">${esc(srv.treasury.address.slice(0, 4) + '…' + srv.treasury.address.slice(-4))}</code>`)] : []),
    ].join('');

    // wykresy: z listy meczów; gdy jej jeszcze nie ma – z historii kont
    const days = Array.from({ length: 14 }, (_, i) => dayKey(now - (13 - i) * 86400e3)), idx = Object.fromEntries(days.map((d, i) => [d, i]));
    const mc = days.map(() => 0), fc = days.map(() => 0);
    const inLog = new Set(matches.map(m => m.u));
    for (const m of matches) { const i = idx[dayKey(m.t)]; if (i !== undefined) { mc[i]++; fc[i] += m.fee || 0; } }
    for (const r of rows) if (!inLog.has(r.id)) for (const h of r.history) { const i = idx[dayKey(h.t)]; if (i === undefined) continue; if (h.type === 'stake') mc[i]++; if (h.type === 'win') fc[i] += h.fee || 0; }
    const sumM = mc.reduce((a, b) => a + b, 0), sumF = fc.reduce((a, b) => a + b, 0);
    $('fa-ch-m').dataset.label = `Mecze dziennie w ostatnich 14 dniach, razem ${sumM}`; $('fa-ch-f').dataset.label = `Prowizja dziennie w ostatnich 14 dniach, razem ${usd(sumF)}`;
    bars($('fa-ch-m'), days, mc, (v, tip) => tip ? fmtInt(v) + ' ' + pl(v, 'mecz', 'mecze', 'meczów') : fmtInt(v));
    bars($('fa-ch-f'), days, fc.map(r2), (v, tip) => tip ? fmtMoney(v) : (v >= 100 ? fmtInt(v) : (Math.round(v * 10) / 10).toLocaleString('pl-PL')), '');
    $('fa-ch-m-sum').textContent = `ostatnie 14 dni · razem ${fmtInt(sumM)}`; $('fa-ch-f-sum').textContent = `USD (płatne w SOL) · ostatnie 14 dni · razem ${usd(sumF)}`;

    // tabela
    const col = COLS.find(c => c[0] === sort.key) || COLS[2], keyOf = col[3] || (r => r[sort.key]);
    const shown = rows.filter(r => !q || r.name.toLowerCase().includes(q)).sort((a, b) => { const x = keyOf(a), y = keyOf(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
    th.querySelectorAll('th').forEach(c => { c.classList.toggle('s', c.dataset.k === sort.key); c.classList.toggle('asc', c.dataset.k === sort.key && sort.dir > 0); });
    $('fa-tb').innerHTML = shown.map(r => `<tr data-id="${esc(r.id)}">${COLS.map(c => `<td>${c[2](r)}</td>`).join('')}</tr>`).join('');
    $('fa-tb-empty').hidden = shown.length > 0 || !gotA; $('fa-tb-empty').textContent = rows.length ? 'Nikt nie pasuje do wyszukiwania.' : 'Brak graczy – nikt jeszcze nie założył konta.';

    // ostatnie mecze
    const rc = matches.slice(0, 25);
    $('fa-rc-sum').textContent = matches.length ? `${fmtInt(matches.length)} w zapisie` : '';
    $('fa-recent').innerHTML = rc.length ? rc.map(m => `<li><div><b>${esc(m.name || m.u)}${m.held ? '<span class="fa-tag f">CZEKA NA ADMINA</span>' : m.forfeit ? '<span class="fa-tag f">PODDANY</span>' : m.won ? '<span class="fa-tag w">WYGRANA</span>' : '<span class="fa-tag l">PRZEGRANA</span>'}</b>
      <small>${new Date(m.t).toLocaleString('pl-PL')}${m.map ? ' · ' + esc(m.map) : ''} · stawka ${usd(m.stake || 0)}</small></div>
      <span class="r">${m.won ? `<span class="pos">+${fmtMoney(m.payout || 0)}</span><small>prowizja ${fmtMoney(m.fee || 0)}</small>` : `<span class="neg">−${fmtMoney(m.stake || 0)}</span>`}</span></li>`).join('')
      : `<li class="fa-empty">${gotM ? 'Brak zapisanych meczów. Mecze o stawkę zapisują się od tej wersji gry.' : 'Ładowanie…'}</li>`;

    // baza
    $('fa-dbmeta').innerHTML = [['Konta', fmtInt(accounts.length)], ['Zapisane mecze', fmtInt(matches.length)], ['Rekordy razem', fmtInt(accounts.length + matches.length + 1) + ' / 25 000'],
      ['Strzały / trafienia (1v1)', fmtInt(T.shots) + ' / ' + fmtInt(T.hits)]].map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('');
  }
}
