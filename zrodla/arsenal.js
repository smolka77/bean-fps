// Arsenał w lobby: sklep z broniami odblokowywanymi za trzymanie tokenu (serwer: serwer/arsenal.mjs).
// Na start każdy ma pistolet (Glock-17); każda inna broń ma próg – ile tokenów musi leżeć na adresie depozytu gracza w grze.
// Odblokowane bronie działają w 1v1 i w Deathmatch (tam: można je kupić w sklepie meczu); Z botem i Strzelnica – wszystkie bronie.
// Użycie (lobby-ui.js): createArsenal({ root, getLang, toast, sfx, wallet: () => W, acct: () => konto, art: () => {id: dataURL}, openAuth })
import { WEAPON_STATS } from './weaponry.js';

const TXT = {
  pl: { title: 'Arsenał', sub: 'Na start masz pistolet. Trzymaj token na swoim adresie w grze, a odblokujesz resztę broni.',
    subSol: 'Na start masz pistolet. Miej SOL na saldzie w grze, a odblokujesz resztę broni – nic się nie pobiera, liczy się samo saldo.',
    howSol: 'Wpłać SOL na swoje saldo w grze i po prostu je trzymaj. Broń nic nie kosztuje – SOL zostaje na koncie. Gdy saldo spadnie poniżej progu, broń znów się zablokuje.', deposit: 'Wpłać SOL',
    tile: 'Arsenał', tileOf: '{n} / {m} broni', tileOff: 'Bronie i odblokowania', balance: 'Twoje saldo', refresh: 'Sprawdź saldo', checking: 'Sprawdzam…',
    ago: 'sprawdzone {t} temu', now: 'sprawdzone przed chwilą', base: 'W zestawie', open: 'Odblokowane', all: 'Dostępne', need: 'Trzymaj', missing: 'Brakuje {n}',
    have: 'Masz tę broń', free: 'Za darmo – dostępna dla każdego', haveBase: 'Pistolet startowy – zawsze w zestawie', modes: 'Działa w 1v1 i Deathmatch (tam kupujesz ją w sklepie meczu). Z botem i w Strzelnicy masz wszystkie bronie.',
    how: 'Jak odblokować', howTxt: 'Wyślij {s} na swój adres w grze i trzymaj go tam. Serwer sprawdza saldo co kilka minut – gdy tokenów ubędzie, broń znów się zablokuje.',
    addr: 'Twój adres w grze (Solana)', copy: 'Kopiuj', copied: 'Skopiowano adres', login: 'Zaloguj się, żeby zobaczyć saldo i swój adres do wpłaty.', loginBtn: 'Zaloguj się',
    off: 'Arsenał nie jest jeszcze włączony – na razie każdy ma wszystkie bronie.', offline: 'Arsenał działa z serwerem gry – tu masz wszystkie bronie.', close: 'Zamknij', err: 'Nie udało się sprawdzić salda – spróbuj za chwilę',
    st_dmg: 'Obrażenia', st_rof: 'Szybkostrzelność', st_acc: 'Celność', st_mag: 'Magazynek', c_pistol: 'Pistolet', c_hand: 'Pistolet ciężki', c_smg: 'Pistolet maszynowy', c_shot: 'Strzelba', c_rifle: 'Karabin szturmowy',
    keys: 'W / S wybór · Esc zamknij', net: 'sieć' },
  en: { title: 'Arsenal', sub: 'You start with a pistol. Hold the token on your in-game address to unlock the other guns.',
    subSol: 'You start with a pistol. Keep SOL in your in-game balance to unlock the other guns – nothing is charged, only the balance counts.',
    howSol: 'Deposit SOL to your in-game balance and simply keep it there. The guns cost nothing – the SOL stays in your account. If the balance drops below a threshold, that gun locks again.', deposit: 'Deposit SOL',
    tile: 'Arsenal', tileOf: '{n} / {m} guns', tileOff: 'Guns and unlocks', balance: 'Your balance', refresh: 'Check balance', checking: 'Checking…',
    ago: 'checked {t} ago', now: 'checked just now', base: 'Included', open: 'Unlocked', all: 'Available', need: 'Hold', missing: '{n} to go',
    have: 'You have this gun', free: 'Free – available to everyone', haveBase: 'Starter pistol – always included', modes: 'Works in 1v1 and Deathmatch (there you buy it in the match shop). Vs bot and on the Range you have every gun.',
    how: 'How to unlock', howTxt: 'Send {s} to your in-game address and keep it there. The server checks the balance every few minutes – if it drops, the gun locks again.',
    addr: 'Your in-game address (Solana)', copy: 'Copy', copied: 'Address copied', login: 'Log in to see your balance and deposit address.', loginBtn: 'Log in',
    off: 'The Arsenal is not switched on yet – for now everyone has every gun.', offline: 'The Arsenal works with the game server – here you have every gun.', close: 'Close', err: 'Could not check the balance – try again shortly',
    st_dmg: 'Damage', st_rof: 'Fire rate', st_acc: 'Accuracy', st_mag: 'Magazine', c_pistol: 'Pistol', c_hand: 'Heavy pistol', c_smg: 'Submachine gun', c_shot: 'Shotgun', c_rifle: 'Assault rifle',
    keys: 'W / S select · Esc close', net: 'network' },
  ru: { title: 'Арсенал', sub: 'На старте у тебя пистолет. Держи токен на своём игровом адресе – и откроешь остальное оружие.',
    subSol: 'На старте у тебя пистолет. Держи SOL на игровом балансе – и откроешь остальное оружие. Ничего не списывается, важен только баланс.',
    howSol: 'Пополни игровой баланс в SOL и просто держи его. Оружие ничего не стоит – SOL остаётся на счёте. Если баланс упадёт ниже порога, оружие снова закроется.', deposit: 'Пополнить SOL',
    tile: 'Арсенал', tileOf: '{n} / {m} оружия', tileOff: 'Оружие и открытия', balance: 'Твой баланс', refresh: 'Проверить баланс', checking: 'Проверяю…',
    ago: 'проверено {t} назад', now: 'проверено только что', base: 'В комплекте', open: 'Открыто', all: 'Доступно', need: 'Держи', missing: 'Не хватает {n}',
    have: 'Это оружие у тебя есть', free: 'Бесплатно – доступно всем', haveBase: 'Стартовый пистолет – всегда в комплекте', modes: 'Работает в 1v1 и Deathmatch (там покупаешь в магазине матча). С ботом и в тире – всё оружие.',
    how: 'Как открыть', howTxt: 'Отправь {s} на свой игровой адрес и держи его там. Сервер проверяет баланс каждые несколько минут – если токенов станет меньше, оружие снова закроется.',
    addr: 'Твой игровой адрес (Solana)', copy: 'Копировать', copied: 'Адрес скопирован', login: 'Войди, чтобы увидеть баланс и адрес для пополнения.', loginBtn: 'Войти',
    off: 'Арсенал ещё не включён – пока у всех всё оружие.', offline: 'Арсенал работает с игровым сервером – здесь у тебя всё оружие.', close: 'Закрыть', err: 'Не удалось проверить баланс – попробуй чуть позже',
    st_dmg: 'Урон', st_rof: 'Скорострельность', st_acc: 'Точность', st_mag: 'Магазин', c_pistol: 'Пистолет', c_hand: 'Тяжёлый пистолет', c_smg: 'Пистолет-пулемёт', c_shot: 'Дробовик', c_rifle: 'Штурмовая винтовка',
    keys: 'W / S выбор · Esc закрыть', net: 'сеть' },
  es: { title: 'Arsenal', sub: 'Empiezas con una pistola. Guarda el token en tu dirección del juego y desbloquea el resto de armas.',
    subSol: 'Empiezas con una pistola. Mantén SOL en tu saldo del juego y desbloquea el resto de armas: no se cobra nada, solo cuenta el saldo.',
    howSol: 'Deposita SOL en tu saldo del juego y simplemente mantenlo. Las armas no cuestan nada: el SOL se queda en tu cuenta. Si el saldo baja del umbral, el arma se vuelve a bloquear.', deposit: 'Depositar SOL',
    tile: 'Arsenal', tileOf: '{n} / {m} armas', tileOff: 'Armas y desbloqueos', balance: 'Tu saldo', refresh: 'Comprobar saldo', checking: 'Comprobando…',
    ago: 'comprobado hace {t}', now: 'comprobado ahora mismo', base: 'Incluida', open: 'Desbloqueada', all: 'Disponible', need: 'Guarda', missing: 'Faltan {n}',
    have: 'Tienes esta arma', free: 'Gratis – disponible para todos', haveBase: 'Pistola inicial – siempre incluida', modes: 'Funciona en 1v1 y Deathmatch (allí la compras en la tienda de la partida). Contra el bot y en la galería tienes todas las armas.',
    how: 'Cómo desbloquear', howTxt: 'Envía {s} a tu dirección del juego y mantenlo allí. El servidor comprueba el saldo cada pocos minutos: si baja, el arma se vuelve a bloquear.',
    addr: 'Tu dirección del juego (Solana)', copy: 'Copiar', copied: 'Dirección copiada', login: 'Inicia sesión para ver tu saldo y tu dirección de depósito.', loginBtn: 'Iniciar sesión',
    off: 'El Arsenal aún no está activado: por ahora todos tienen todas las armas.', offline: 'El Arsenal funciona con el servidor del juego: aquí tienes todas las armas.', close: 'Cerrar', err: 'No se pudo comprobar el saldo, inténtalo en un momento',
    st_dmg: 'Daño', st_rof: 'Cadencia', st_acc: 'Precisión', st_mag: 'Cargador', c_pistol: 'Pistola', c_hand: 'Pistola pesada', c_smg: 'Subfusil', c_shot: 'Escopeta', c_rifle: 'Fusil de asalto',
    keys: 'W / S elegir · Esc cerrar', net: 'red' },
};
const CAT = { glock17: 'c_pistol', deagle: 'c_hand', mp5k: 'c_smg', spas12: 'c_shot', akm: 'c_rifle', m4a1: 'c_rifle' };
const ORDER = ['glock17', 'deagle', 'mp5k', 'spas12', 'akm', 'm4a1'];   // jak na serwerze: pistolet + bronie z progiem
const IC = {
  gun: '<svg viewBox="0 0 64 32" fill="currentColor"><path d="M2 9h40l2-3h6v3h12v5H50l-2 3H36l-4 3v8h-9l2-11H2z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  ref: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="1"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  token: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#ff2e93"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="#fff" stroke-width="2"/><path d="M12 8.5v7M9.5 12h5" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>',
  sol: '<svg viewBox="0 0 398 312"><defs><linearGradient id="arsol" x1="361" y1="-37" x2="141" y2="383" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#00ffa3"/><stop offset="1" stop-color="#dc1fff"/></linearGradient></defs><g fill="url(#arsol)"><path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1z"/><path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1z"/><path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1z"/></g></svg>',
};
const CSS = `
#lb-ui .lb-arsbtn{position:absolute;left:max(24px,env(safe-area-inset-left));bottom:max(24px,env(safe-area-inset-bottom));pointer-events:auto;display:flex;align-items:center;gap:14px;
  min-width:270px;padding:12px 16px 12px 12px;border:0;border-top:3px solid transparent;border-image:var(--vc) 1;background:var(--bg);color:var(--tx,#f4eff6);cursor:pointer;
  box-shadow:0 18px 50px rgba(0,0,0,.4);text-align:left;font:inherit;transition:background .15s}
#lb-ui .lb-arsbtn:hover{background:rgba(22,8,30,.9)}
#lb-ui .lb-arsbtn .ic{display:grid;place-items:center;width:62px;height:46px;background:rgba(255,255,255,.06);color:#fff;box-shadow:0 0 0 2px rgba(255,255,255,.85)}
#lb-ui .lb-arsbtn .ic svg{width:46px;height:23px}
#lb-ui .lb-arsbtn small{display:block;font:700 11px/1 'Barlow Condensed',Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--teal)}
#lb-ui .lb-arsbtn b{display:block;margin-top:4px;font:400 24px/1 Anton,Impact,sans-serif;letter-spacing:.03em;text-transform:uppercase}
#lb-ui .lb-arsbtn em{display:block;margin-top:3px;font-style:normal;font-size:13px;color:var(--mut,#a39aae)}
#lb-ui .lb-arsbtn i{margin-left:auto;font-style:normal;font:700 13px 'Barlow Condensed',sans-serif;color:var(--acc);letter-spacing:.04em}
#lb-ui .lb-arsbtn .pips{display:flex;gap:3px;margin-top:6px}#lb-ui .lb-arsbtn .pips u{width:16px;height:4px;background:rgba(255,255,255,.18)}#lb-ui .lb-arsbtn .pips u.on{background:var(--cash)}
#lb-ui .lb-ars{position:absolute;inset:0;z-index:40;pointer-events:auto;overflow:auto;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);background:
  radial-gradient(120% 90% at 50% 120%,rgba(255,46,147,.3),rgba(0,0,0,0) 55%),linear-gradient(180deg,rgba(8,3,12,.985),rgba(14,4,20,.975) 60%,rgba(30,6,30,.985));color:#f4eff6}
#lb-ui .lb-ars[hidden]{display:none}
#lb-ui .ars-in{position:relative;min-height:100%;box-sizing:border-box;padding:28px max(28px,env(safe-area-inset-right)) 30px max(28px,env(safe-area-inset-left));display:flex;flex-direction:column;gap:18px}
#lb-ui .ars-in>.ars-body{flex:1}
#lb-ui .ars-hd{display:flex;align-items:flex-start;gap:24px}
#lb-ui .ars-hd h2{margin:0;font:400 clamp(34px,4vw,52px)/.9 Anton,Impact,sans-serif;letter-spacing:.02em;text-transform:uppercase;transform:skewX(-6deg);
  color:#fff;-webkit-text-stroke:2px #12041a;paint-order:stroke fill;filter:drop-shadow(3px 3px 0 #12041a)}
#lb-ui .ars-hd h2 b{background:var(--vc);-webkit-background-clip:text;background-clip:text;color:transparent}
#lb-ui .ars-hd p{margin:10px 0 0;max-width:560px;color:#cfc6d8;font-size:15px;line-height:1.4}
#lb-ui .ars-bal{margin-left:auto;text-align:right}
#lb-ui .ars-bal small{display:block;font:700 11px/1 'Barlow Condensed',sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#a39aae}
#lb-ui .ars-bal .v{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:6px;font:400 34px/1 Anton,Impact,sans-serif;color:var(--cash);
  text-shadow:1px 1px 0 #000,-1px 1px 0 #000,1px -1px 0 #000,-1px -1px 0 #000,0 2px 0 #000}
#lb-ui .ars-bal .v svg{width:26px;height:26px}#lb-ui .ars-bal .v i{font-style:normal;font-size:20px;color:#fff}
#lb-ui .ars-bal .row{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:8px}
#lb-ui .ars-bal em{font-style:normal;font-size:12px;color:#8f86a0}
#lb-ui .ars-btn{display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 12px;border:0;background:rgba(255,255,255,.08);color:#fff;cursor:pointer;
  font:700 13px/1 'Barlow Condensed',sans-serif;letter-spacing:.08em;text-transform:uppercase}
#lb-ui .ars-btn:hover{background:#fff;color:#0b0610}#lb-ui .ars-btn svg{width:15px;height:15px}#lb-ui .ars-btn[disabled]{opacity:.5;pointer-events:none}
#lb-ui .ars-btn.pri{background:var(--vc);color:#fff}#lb-ui .ars-btn[hidden]{display:none}#lb-ui .ars-ft .ars-btn.pri{height:42px;padding:0 18px;font-size:15px}
#lb-ui .ars-x{width:40px;height:40px;padding:0;justify-content:center;flex:none}#lb-ui .ars-x svg{width:20px;height:20px}
#lb-ui .ars-note{padding:10px 14px;background:rgba(46,230,214,.1);border-left:3px solid var(--teal);color:#d8f8f5;font-size:14px}
#lb-ui .ars-note.err{background:rgba(255,46,147,.1);border-color:var(--acc);color:#ffd5e8}
#lb-ui .ars-body{display:grid;grid-template-columns:minmax(260px,400px) 1fr minmax(260px,330px);gap:24px;align-items:start;align-content:center;min-height:0}
#lb-ui .ars-list{display:flex;flex-direction:column}
#lb-ui .ars-list button{position:relative;display:flex;align-items:center;gap:12px;min-height:54px;padding:0 16px;border:0;border-bottom:1px solid rgba(255,255,255,.1);
  background:transparent;color:#f4eff6;cursor:pointer;text-align:left;font:500 19px/1.1 Barlow,sans-serif}
#lb-ui .ars-list button:hover{background:rgba(255,255,255,.06)}
#lb-ui .ars-list button.on{background:linear-gradient(90deg,#f6f3f8 0%,#f6f3f8 55%,rgba(246,243,248,.55) 100%);color:#0b0610}
#lb-ui .ars-list .dot{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.25);flex:none}
#lb-ui .ars-list .ok .dot{background:var(--cash)}#lb-ui .ars-list .lk .dot{background:var(--acc)}
#lb-ui .ars-list .st{margin-left:auto;display:flex;align-items:center;gap:6px;font:700 14px/1 'Barlow Condensed',sans-serif;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}
#lb-ui .ars-list .st svg{width:14px;height:14px}
#lb-ui .ars-list .ok .st{color:var(--cash)}#lb-ui .ars-list .lk .st{color:#ff7ab8}#lb-ui .ars-list .bs .st{color:#a39aae}
#lb-ui .ars-list button.on .st{color:#0b0610}#lb-ui .ars-list button.on.lk .st{color:#c4106a}#lb-ui .ars-list button.on.ok .st{color:#178a2a}
#lb-ui .ars-stage{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:340px}
#lb-ui .ars-stage::before{content:'';position:absolute;left:8%;right:8%;bottom:16%;height:34%;background:radial-gradient(50% 50% at 50% 50%,rgba(255,46,147,.22),rgba(0,0,0,0) 70%);filter:blur(6px)}
#lb-ui .ars-art{position:relative;width:min(100%,720px);aspect-ratio:12/5;object-fit:contain;filter:drop-shadow(0 22px 24px rgba(0,0,0,.55))}
#lb-ui .ars-art.lk{filter:drop-shadow(0 22px 24px rgba(0,0,0,.55)) saturate(.7) brightness(.85)}
#lb-ui .ars-art.sm{width:min(64%,460px)}
#lb-ui .ars-stage .big{position:absolute;z-index:2;right:6%;top:4%;display:flex;align-items:center;gap:8px;padding:7px 12px;font:700 15px/1 'Barlow Condensed',sans-serif;letter-spacing:.12em;text-transform:uppercase}
#lb-ui .ars-stage .big svg{width:16px;height:16px}
#lb-ui .ars-stage .big.ok{background:var(--cash);color:#0b0610}#lb-ui .ars-stage .big.lk{background:#0b0610;color:#ff7ab8;box-shadow:inset 0 0 0 1px rgba(255,122,184,.5)}#lb-ui .ars-stage .big.bs{background:rgba(255,255,255,.1);color:#fff}
#lb-ui .ars-noart{font:400 64px/1 Anton,Impact,sans-serif;color:rgba(255,255,255,.12);text-transform:uppercase}
#lb-ui .ars-side{display:flex;flex-direction:column;gap:14px}
#lb-ui .ars-card{background:rgba(9,4,13,.82);border:1px solid rgba(255,255,255,.12);padding:16px}
#lb-ui .ars-card h3{margin:0;font:700 22px/1 'Barlow Condensed',sans-serif;letter-spacing:.04em;text-transform:uppercase}
#lb-ui .ars-card h4{margin:4px 0 0;font:600 13px/1.2 'Barlow Condensed',sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#a39aae}
#lb-ui .ars-req .need{display:flex;align-items:baseline;gap:8px;margin-top:12px;font:400 34px/1 Anton,Impact,sans-serif;color:#fff}
#lb-ui .ars-req .need small{font:700 12px/1 'Barlow Condensed',sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#a39aae}
#lb-ui .ars-req .need i{font-style:normal;font-size:18px;color:#ff7ab8}
#lb-ui .ars-req .bar{position:relative;height:8px;margin-top:12px;background:rgba(255,255,255,.12)}#lb-ui .ars-req .bar b{position:absolute;left:0;top:0;bottom:0;background:var(--vc)}
#lb-ui .ars-req .bar.full b{background:var(--cash)}
#lb-ui .ars-req p{margin:10px 0 0;font-size:14px;color:#cfc6d8}#lb-ui .ars-req p.ok{color:var(--cash);font-weight:600}
#lb-ui .ars-stat{margin-top:12px}#lb-ui .ars-stat div{display:flex;justify-content:space-between;font:700 14px/1 'Barlow Condensed',sans-serif;letter-spacing:.06em;text-transform:uppercase}
#lb-ui .ars-stat i{position:relative;display:block;height:3px;margin-top:6px;background:rgba(255,255,255,.16)}#lb-ui .ars-stat i b{position:absolute;left:0;top:0;bottom:0;background:#fff}
#lb-ui .ars-modes{margin:0;font-size:13px;line-height:1.4;color:#a39aae}
#lb-ui .ars-ft{display:grid;grid-template-columns:1fr auto;gap:20px;align-items:center;padding:16px 18px;background:rgba(9,4,13,.82);border-top:3px solid transparent;border-image:var(--vc) 1}
#lb-ui .ars-ft b{font:700 15px/1 'Barlow Condensed',sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--teal)}
#lb-ui .ars-ft p{margin:6px 0 0;font-size:14px;line-height:1.4;color:#cfc6d8;max-width:640px}
#lb-ui .ars-addr{display:flex;align-items:center;gap:10px}
#lb-ui .ars-addr small{display:block;font:700 11px/1 'Barlow Condensed',sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#a39aae}
#lb-ui .ars-addr code{display:block;margin-top:5px;font:600 14px/1 ui-monospace,Menlo,Consolas,monospace;color:#fff;word-break:break-all}
#lb-ui .ars-keys{position:absolute;right:max(28px,env(safe-area-inset-right));bottom:6px;font-size:11px;color:#6f6680;letter-spacing:.06em}
@media (max-width:1100px){#lb-ui .ars-body{grid-template-columns:minmax(220px,320px) 1fr}#lb-ui .ars-side{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr}}
@media (max-width:760px){
  #lb-ui .lb-arsbtn{left:12px;right:auto;bottom:auto;top:76px;min-width:0;padding:8px 12px 8px 8px;gap:10px}#lb-ui .lb-arsbtn .ic{width:44px;height:34px}#lb-ui .lb-arsbtn .ic svg{width:34px;height:17px}
  #lb-ui .lb-arsbtn b{font-size:18px}#lb-ui .lb-arsbtn em,#lb-ui .lb-arsbtn i{display:none}
  #lb-ui .ars-in{padding:18px 16px;gap:14px}#lb-ui .ars-hd{flex-wrap:wrap;gap:12px}#lb-ui .ars-hd>div:first-child{flex:1 1 100%;order:1}#lb-ui .ars-bal{order:2;text-align:left;margin-left:0}
  #lb-ui .ars-bal .v,#lb-ui .ars-bal .row{justify-content:flex-start}#lb-ui .ars-x{position:absolute;top:14px;right:14px}
  #lb-ui .ars-body{grid-template-columns:1fr}#lb-ui .ars-side{grid-template-columns:1fr}#lb-ui .ars-stage{min-height:180px;order:-1}
  #lb-ui .ars-ft{grid-template-columns:1fr}#lb-ui .ars-keys{display:none}}
`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function createArsenal({ root, getLang, toast = () => {}, sfx = {}, wallet = () => null, acct = () => null, art = null, openAuth = () => {}, openWallet = () => {} }) {
  const T = (k, v) => { let s = (TXT[getLang()] || TXT.en)[k] ?? TXT.en[k] ?? k; if (v) for (const n in v) s = s.replace('{' + n + '}', v[n]); return s; };
  const loc = () => ({ pl: 'pl-PL', en: 'en-US', ru: 'ru-RU', es: 'es-ES' })[getLang()] || 'en-US';
  const num = (v) => (+v || 0).toLocaleString(loc(), { maximumFractionDigits: v >= 100 ? 0 : 2 });
  if (!document.getElementById('lb-ars-css')) { const st = document.createElement('style'); st.id = 'lb-ars-css'; st.textContent = CSS; document.head.appendChild(st); }

  const tile = document.createElement('button'); tile.type = 'button'; tile.className = 'lb-arsbtn'; tile.id = 'lb-ars-tile';
  tile.innerHTML = `<span class="ic">${IC.gun}</span><span><small></small><b></b><em></em><span class="pips"></span></span><i>›</i>`;
  const ov = document.createElement('div'); ov.className = 'lb-ars'; ov.id = 'lb-arsenal'; ov.hidden = true; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
  ov.innerHTML = `<div class="ars-in">
    <div class="ars-hd"><div><h2></h2><p class="sub"></p></div>
      <div class="ars-bal"><small class="bl"></small><div class="v"></div><div class="row"><em class="ago"></em><button type="button" class="ars-btn ref">${IC.ref}<span></span></button></div></div>
      <button type="button" class="ars-btn ars-x" aria-label="">${IC.x}</button></div>
    <div class="ars-note" hidden></div>
    <div class="ars-body"><div class="ars-list" role="listbox"></div>
      <div class="ars-stage"><span class="big"></span><img class="ars-art" alt=""><span class="ars-noart" hidden></span></div>
      <div class="ars-side"><div class="ars-card ars-req"></div><div class="ars-card ars-stats"></div><p class="ars-modes"></p></div></div>
    <div class="ars-ft"></div><span class="ars-keys"></span></div>`;
  root.appendChild(tile); root.appendChild(ov);
  const Q = (s) => ov.querySelector(s);

  // stan: s = odpowiedź serwera (GET /api/arsenal); null = jeszcze nie ma / brak serwera
  let s = null, sel = 0, busy = false, forUser = undefined, lastFetch = 0, artMap = null, err = '';
  const W = () => wallet();
  const online = () => !!(W() && W().api);
  const guns = () => (s && s.base ? [s.base, ...(s.guns || [])] : ORDER).filter((id) => WEAPON_STATS[id]);
  const active = () => !!(s && s.enabled);
  const solMode = () => !!(s && s.unit !== 'token');
  // saldo: w trybie SOL – na żywo z portfela w grze (po wpłacie od razu), w trybie tokenu – z serwera
  const bal = () => { const a = acct(); if (solMode() && a && typeof a.sol === 'number') return a.sol; return a ? (s && s.balance) || 0 : 0; };
  const usdOf = (v) => s && s.price && solMode() ? '≈ $' + (v * s.price).toLocaleString(loc(), { maximumFractionDigits: v * s.price >= 100 ? 0 : 2 }) : '';
  const stateOf = (id) => {
    if (!active()) return 'all';
    if (id === s.base) return 'bs';
    return bal() + 1e-9 >= (s.need[id] ?? Infinity) ? 'ok' : 'lk';
  };
  async function call(method, p) {
    const w = W(); if (!w || !w.api) throw new Error('offline');
    const r = await fetch(w.api + '/api' + p, { method, headers: { 'Content-Type': 'application/json', ...(w.token && w.token !== 'local' ? { Authorization: 'Bearer ' + w.token } : {}) } });
    let j = {}; try { j = await r.json(); } catch {}
    if (!r.ok) throw new Error(j.message || 'HTTP ' + r.status);
    return j;
  }
  async function load(force) {
    if (!online()) { s = null; render(); return; }
    if (busy) return; busy = true; err = ''; renderBal();
    try { s = await call(force ? 'POST' : 'GET', force && acct() ? '/arsenal/refresh' : '/arsenal'); lastFetch = Date.now(); if (s.error) err = T('err'); }
    catch (e) { err = T('err'); }
    busy = false; render();
  }

  function renderTile() {
    const list = guns(), n = list.filter((id) => stateOf(id) !== 'lk').length;
    tile.querySelector('small').textContent = !active() ? 'GTAssault' : solMode() ? 'SOL' : '$' + String(s.symbol || '').replace(/^\$/, '');
    tile.querySelector('b').textContent = T('tile');
    tile.querySelector('em').textContent = active() ? T('tileOf', { n, m: list.length }) : T('tileOff');
    tile.querySelector('.pips').innerHTML = active() ? list.map((id) => `<u class="${stateOf(id) !== 'lk' ? 'on' : ''}"></u>`).join('') : '';
  }
  function renderBal() {
    const sym = s && s.symbol ? s.symbol : 'TOKEN';
    Q('.bl').textContent = T('balance');
    const loggedIn = !!acct();
    Q('.v').innerHTML = active() && loggedIn ? `${solMode() ? IC.sol : IC.token}${esc(num(bal()))}<i>${esc(sym)}</i>` : '<i>—</i>';
    const rb = Q('.ref'); rb.hidden = solMode(); rb.disabled = busy || !online() || !loggedIn || !active(); rb.querySelector('span').textContent = busy ? T('checking') : T('refresh');
    const ago = s && s.checkedAt ? Math.max(0, Math.round((Date.now() - s.checkedAt) / 1000)) : -1;
    Q('.ago').textContent = !active() || !loggedIn ? '' : solMode() ? usdOf(bal()) : ago < 0 ? '' : ago < 20 ? T('now') : T('ago', { t: ago < 120 ? ago + ' s' : Math.round(ago / 60) + ' min' });
  }
  function statRows(id) {
    const w = WEAPON_STATS[id], pel = w.pellets || 1;
    const dmg = Math.min(10, (w.dmg * pel) / 13), rof = Math.min(10, w.rpm / 90), acc = Math.max(.5, Math.min(10, 10 - (w.spread.hip * 600 + (w.pelletSpread || 0) * 80))), mag = Math.min(10, w.mag / 3);
    return [[T('st_dmg'), dmg, pel > 1 ? w.dmg + '×' + pel : String(w.dmg)], [T('st_rof'), rof, w.rpm + ' rpm'], [T('st_acc'), acc, acc.toFixed(1)], [T('st_mag'), mag, w.mag + ' / ' + w.reserve]];
  }
  function render() {
    renderTile();
    if (ov.hidden) return;
    const list = guns(); sel = Math.max(0, Math.min(list.length - 1, sel)); const id = list[sel], st = stateOf(id), sym = s && s.symbol ? s.symbol : 'TOKEN';
    Q('h2').innerHTML = `<b>${esc(T('title'))}</b>`; Q('.sub').textContent = T(solMode() || !s ? 'subSol' : 'sub');
    Q('.ars-x').setAttribute('aria-label', T('close')); Q('.ars-keys').textContent = T('keys');
    renderBal();
    const note = Q('.ars-note'), msg = !online() ? T('offline') : err ? err : s && !s.enabled ? T('off') : '';
    note.hidden = !msg; note.textContent = msg; note.classList.toggle('err', !!err);
    Q('.ars-list').innerHTML = list.map((g, i) => { const k = stateOf(g), lbl = k === 'ok' ? `${IC.check}${esc(T('open'))}` : k === 'lk' ? `${IC.lock}${esc(num(s.need[g]))} ${esc(sym)}` : k === 'bs' ? esc(T('base')) : esc(T('all'));
      return `<button type="button" role="option" data-i="${i}" class="${k}${i === sel ? ' on' : ''}" aria-selected="${i === sel}"><span class="dot"></span>${esc(WEAPON_STATS[g].name)}<span class="st">${lbl}</span></button>`; }).join('');
    // zdjęcie broni (kolorowe, robione raz przy pierwszym otwarciu)
    if (!artMap && art) { try { artMap = art() || {}; } catch { artMap = {}; } }
    const img = Q('.ars-art'), src = artMap && artMap[id];
    img.hidden = !src; if (src) { img.src = src; img.alt = WEAPON_STATS[id].name; } img.classList.toggle('lk', st === 'lk'); img.classList.toggle('sm', id === 'glock17' || id === 'deagle');
    const na = Q('.ars-noart'); na.hidden = !!src; na.textContent = WEAPON_STATS[id].name;
    const big = Q('.big'); big.className = 'big ' + st;
    big.innerHTML = st === 'ok' ? `${IC.check}${esc(T('open'))}` : st === 'lk' ? `${IC.lock}${esc(num(s.need[id]))} ${esc(sym)}` : st === 'bs' ? esc(T('base')) : esc(T('all'));
    // wymaganie: próg, pasek postępu, ile brakuje
    let req = `<h3>${esc(WEAPON_STATS[id].name)}</h3><h4>${esc(T(CAT[id] || 'c_rifle'))}</h4>`;
    if (st === 'ok' && !(s.need[id] > 0)) req += `<p class="ok" style="margin-top:12px">${esc(T('free'))}</p>`;   // próg 0: broń dla każdego
    else if (st === 'lk' || st === 'ok') {
      const need = s.need[id] || 0, b = bal(), k = need > 0 ? Math.min(1, b / need) : 1, usd = usdOf(need);
      req += `<div class="need"><small>${esc(T('need'))}</small>${esc(num(need))}<i>${esc(sym)}</i>${usd ? `<small>${esc(usd)}</small>` : ''}</div><div class="bar${k >= 1 ? ' full' : ''}"><b style="width:${(k * 100).toFixed(1)}%"></b></div>`
        + (st === 'ok' ? `<p class="ok">${esc(T('have'))}</p>` : acct() ? `<p>${esc(T('missing', { n: num(Math.max(0, need - b)) + ' ' + sym }))}</p>` : `<p>${esc(T('login'))}</p>`);
    } else if (st === 'bs') req += `<p class="ok" style="margin-top:12px">${esc(T('haveBase'))}</p>`;
    Q('.ars-req').innerHTML = req;
    Q('.ars-stats').innerHTML = statRows(id).map(([n, v, l]) => `<div class="ars-stat"><div><span>${esc(n)}</span><span>${esc(l)}</span></div><i><b style="width:${Math.max(3, v * 10)}%"></b></i></div>`).join('');
    Q('.ars-modes').textContent = T('modes');
    // stopka: jak odblokować + adres depozytu (albo logowanie)
    const ft = Q('.ars-ft');
    if (!active()) ft.innerHTML = `<div><b>${esc(T('how'))}</b><p>${esc(T(solMode() || !s ? 'howSol' : 'howTxt', { s: sym }))}</p></div>`;
    else if (!acct()) ft.innerHTML = `<div><b>${esc(T('how'))}</b><p>${esc(T('login'))}</p></div><button type="button" class="ars-btn pri" data-a="login">${esc(T('loginBtn'))}</button>`;
    else if (solMode()) ft.innerHTML = `<div><b>${esc(T('how'))}</b><p>${esc(T('howSol'))}</p></div><button type="button" class="ars-btn pri" data-a="deposit">${IC.sol}<span>${esc(T('deposit'))}</span></button>`;
    else ft.innerHTML = `<div><b>${esc(T('how'))}</b><p>${esc(T('howTxt', { s: sym }))}${s.network && s.network !== 'mainnet-beta' ? ' (' + esc(T('net')) + ': ' + esc(s.network) + ')' : ''}</p></div>
      <div class="ars-addr"><div><small>${esc(T('addr'))}</small><code>${esc(s.address || '—')}</code></div>${s.address ? `<button type="button" class="ars-btn" data-a="copy">${IC.copy}<span>${esc(T('copy'))}</span></button>` : ''}</div>`;
  }

  function open() {
    ov.hidden = false; sfx.open && sfx.open();
    const who = acct() ? acct().username : null;
    if (who !== forUser || Date.now() - lastFetch > 60e3) { forUser = who; load(false); }
    const list = guns(); if (sel === 0 && s && active()) { const j = list.findIndex((g) => stateOf(g) === 'lk'); if (j > 0) sel = j; }   // od razu pierwsza zablokowana
    render();
  }
  const close = () => { if (!ov.hidden) { ov.hidden = true; sfx.close && sfx.close(); } };
  tile.addEventListener('click', open);
  ov.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.i) { sel = +b.dataset.i; sfx.click && sfx.click(); render(); return; }
    if (b.classList.contains('ars-x')) return close();
    if (b.classList.contains('ref')) return load(true);
    if (b.dataset.a === 'login') { close(); openAuth(); return; }
    if (b.dataset.a === 'deposit') { close(); openWallet(); return; }
    if (b.dataset.a === 'copy' && s && s.address) { (navigator.clipboard ? navigator.clipboard.writeText(s.address) : Promise.reject()).then(() => toast(T('copied'), 'ok')).catch(() => {}); }
  });
  addEventListener('keydown', (e) => {
    if (ov.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.code; let d = 0;
    if (k === 'ArrowUp' || k === 'KeyW') d = -1; else if (k === 'ArrowDown' || k === 'KeyS') d = 1;
    else if (k === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); close(); return; } else return;
    e.preventDefault(); e.stopImmediatePropagation(); sel = (sel + d + guns().length) % guns().length; sfx.click && sfx.click(); render();
  }, true);
  // odświeżanie „sprawdzone X s temu” i saldo co kilka minut, gdy Arsenał jest otwarty
  setInterval(() => { if (ov.hidden) return; renderBal(); if (s && active() && acct() && Date.now() - lastFetch > (s.refresh || 120) * 1000) load(false); }, 5000);

  // lobby woła przy zmianie konta / języka; konto się zmieniło = nowe saldo
  function sync() {
    const who = acct() ? acct().username : null;
    if (online() && (who !== forUser || !s)) { forUser = who; load(false); return; }
    render();
  }
  return { el: ov, tile, open, close, render: sync, get isOpen() { return !ov.hidden; } };
}
