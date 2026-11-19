// Deathmatch – interfejs (HUD w meczu, ekran WASTED, sklep po śmierci, kolejka, podium, tabela wyników).
// Wygląd według wzorów: amunicja i broń w prawym górnym rogu (duże liczby z obrysem i ikona broni), kasa pod spodem,
// paski zdrowia / energii / pancerza z okrągłymi ikonami, czerwony napis „wasted”, sklep na ciemnym tle z kartami broni,
// panelem statystyk, zakładkami i listą kategorii (biały pasek wybranego wiersza), różowy akcent, zielona ikona kasy.
// Moduł nie zna silnika gry: dm.js podaje dane (setAmmo, setVitals, …) i dostaje zdarzenia (onBuy, onDeploy, …).
import { getLang } from './lobby-ui.js';

// ---------------- teksty (PL / EN / RU / ES) ----------------
const TX = {
  pl: { kills: 'ZABÓJSTWA', rank: 'MIEJSCE', wanted: 'POSZUKIWANY', youWanted: 'JESTEŚ POSZUKIWANY', youWantedSub: 'Za twoją głowę płacą ×{m}', wantedNow: '{n} jest POSZUKIWANY',
    wantedKill: 'ZABÓJSTWO POSZUKIWANEGO ×{m}', head: 'STRZAŁ W GŁOWĘ', kill: 'ZABÓJSTWO', protect: 'OCHRONA', killedBy: 'Zabity przez', weapon: 'Broń', dist: 'Odległość',
    headshot: 'w głowę', killerLeft: 'Zabójcy zostało', yourStats: 'Twój mecz', deaths: 'ŚMIERCI', damage: 'OBRAŻENIA', cash: 'KASA', toShop: 'Sklep za chwilę…',
    shopName: 'VICE BEACH ARMORY', sidearms: 'PISTOLETY', longarms: 'BROŃ DŁUGA', equipment: 'PANCERZ', pistols: 'Pistolety', shotguns: 'Strzelby', assault: 'Karabiny szturmowe',
    tactical: 'Karabiny taktyczne', smg: 'Pistolety maszynowe', sniper: 'Karabiny snajperskie', armorCat: 'Kamizelki', buyEquip: 'KUP I WYPOSAŻ', equipped: 'WYPOSAŻONE', owned: 'Masz', back: 'WRÓĆ DO WALKI',
    purchase: 'Kup {what} i wróć do walki', what_long: 'broń długą', what_side: 'pistolet', what_eq: 'pancerz', free: 'W ZESTAWIE', noFunds: 'Za mało kasy', locked: 'Odblokuj w Ekwipunku w lobby', lockedNeed: 'Odblokuj w Ekwipunku: miej {n} na saldzie (nic się nie pobiera)', lockedTag: 'EKWIPUNEK',
    loadout: 'Wyposażenie', st_dmg: 'OBRAŻENIA', st_acc: 'CELNOŚĆ', st_hand: 'PRĘDKOŚĆ', st_range: 'ZASIĘG', st_prot: 'OCHRONA', st_head: 'GŁOWA', st_mag: 'MAGAZYNEK',
    sub_glock17: 'PISTOLET PÓŁAUTOMATYCZNY 9 MM', sub_deagle: 'CIĘŻKI PISTOLET .50 AE', sub_spas12: 'STRZELBA BOJOWA', sub_mp5k: 'PISTOLET MASZYNOWY', sub_akm: 'KARABIN SZTURMOWY', sub_m4a1: 'KARABINEK TAKTYCZNY',
    sub_vest: '+{hp} PANCERZA · TUŁÓW', sub_helmet: '+{hp} PANCERZA · TUŁÓW I GŁOWA', lostOnDeath: 'Zakupy przepadają po śmierci. Kasa zostaje.', autoDeploy: 'Powrót za {s} s', autoBack: 'POWRÓT ZA', waited: 'CZEKASZ', startIn: 'START NAJPÓŹNIEJ ZA',
    searching: 'SZUKANIE GRACZY', players: 'graczy', startAt: 'Start przy {max} graczach albo po {t} s (najmniej {min})', cancel: 'Anuluj', waitMore: 'Czekamy na co najmniej {min} graczy…',
    entry: 'Wpisowe', prize: 'Pula dla top 3', countdown: 'MECZ ZA', fight: 'WALCZ!', timeUp: 'KONIEC CZASU', results: 'WYNIKI MECZU', you: 'Ty', toLobby: 'Wróć do lobby', backIn: 'Lobby za {s} s',
    place1: '1. MIEJSCE', place2: '2. MIEJSCE', place3: '3. MIEJSCE', reward: 'Nagroda', player: 'GRACZ', board: 'TABELA', left: 'wyszedł', joined: 'w meczu', tabHint: 'TAB – tabela',
    spawnProt: 'Ochrona po odrodzeniu', armorUp: 'PANCERZ', mapLbl: 'Mapa', bought: 'Kupiono: {n}', yourPlace: 'Twoje miejsce: {p}', leaveTitle: 'Wyjść z meczu?', deadHint: 'SPACJA – odrodzenie · ESC – wyjście do lobby', deadWait: 'Odrodzenie za chwilę…', upgrade: 'NOWA BROŃ', maxGun: 'NAJLEPSZA BROŃ', online: 'W LOBBY', lost: 'Utracono połączenie z serwerem meczu.' },
  en: { kills: 'KILLS', rank: 'RANK', wanted: 'WANTED', youWanted: 'YOU ARE WANTED', youWantedSub: 'Your head is worth ×{m}', wantedNow: '{n} is WANTED',
    wantedKill: 'WANTED KILL ×{m}', head: 'HEADSHOT', kill: 'KILL', protect: 'PROTECTED', killedBy: 'Killed by', weapon: 'Weapon', dist: 'Distance',
    headshot: 'headshot', killerLeft: 'Killer left with', yourStats: 'Your match', deaths: 'DEATHS', damage: 'DAMAGE', cash: 'CASH', toShop: 'Opening the shop…',
    shopName: 'VICE BEACH ARMORY', sidearms: 'SIDEARMS', longarms: 'LONGARMS', equipment: 'AMMO & EQUIPMENT', pistols: 'Pistols', shotguns: 'Shotguns', assault: 'Assault Rifles',
    tactical: 'Tactical Rifles', smg: 'Submachine Guns', sniper: 'Sniper Rifles', armorCat: 'Body Armor', buyEquip: 'BUY & EQUIP', equipped: 'EQUIPPED', owned: 'Owned', back: 'BACK TO FIGHT',
    purchase: 'Purchase a {what} and get back in', what_long: 'longarm', what_side: 'sidearm', what_eq: 'vest', free: 'INCLUDED', noFunds: 'Not enough cash', locked: 'Unlock it in the Inventory in the lobby', lockedNeed: 'Unlock it in the Inventory: keep {n} in your balance (nothing is charged)', lockedTag: 'INVENTORY',
    loadout: 'Loadout', st_dmg: 'DAMAGE', st_acc: 'ACCURACY', st_hand: 'HANDLING', st_range: 'RANGE', st_prot: 'PROTECTION', st_head: 'HEAD', st_mag: 'MAGAZINE',
    sub_glock17: 'SEMI-AUTO 9MM PISTOL', sub_deagle: 'HEAVY .50 AE PISTOL', sub_spas12: 'COMBAT SHOTGUN', sub_mp5k: 'SUBMACHINE GUN', sub_akm: 'ASSAULT RIFLE', sub_m4a1: 'TACTICAL CARBINE',
    sub_vest: '+{hp} ARMOR · BODY', sub_helmet: '+{hp} ARMOR · BODY & HEAD', lostOnDeath: 'Purchases are lost on death. Cash stays.', autoDeploy: 'Auto deploy in {s}s', autoBack: 'AUTO DEPLOY', waited: 'WAITING', startIn: 'STARTS AT THE LATEST IN',
    searching: 'FINDING PLAYERS', players: 'players', startAt: 'Starts at {max} players or after {t}s (min {min})', cancel: 'Cancel', waitMore: 'Waiting for at least {min} players…',
    entry: 'Entry', prize: 'Top 3 prize pool', countdown: 'MATCH IN', fight: 'FIGHT!', timeUp: 'TIME UP', results: 'MATCH RESULTS', you: 'You', toLobby: 'Back to lobby', backIn: 'Lobby in {s}s',
    place1: '1ST PLACE', place2: '2ND PLACE', place3: '3RD PLACE', reward: 'Reward', player: 'PLAYER', board: 'SCOREBOARD', left: 'left', joined: 'in match', tabHint: 'TAB – scoreboard',
    spawnProt: 'Spawn protection', armorUp: 'ARMOR', mapLbl: 'Map', bought: 'Bought: {n}', yourPlace: 'Your place: {p}', leaveTitle: 'Leave the match?', deadHint: 'SPACE – respawn · ESC – back to lobby', deadWait: 'Respawn in a moment…', upgrade: 'NEW WEAPON', maxGun: 'TOP WEAPON', online: 'IN LOBBY', lost: 'Lost connection to the match server.' },
  ru: { kills: 'УБИЙСТВА', rank: 'МЕСТО', wanted: 'В РОЗЫСКЕ', youWanted: 'ТЫ В РОЗЫСКЕ', youWantedSub: 'За твою голову платят ×{m}', wantedNow: '{n} В РОЗЫСКЕ',
    wantedKill: 'УБИЙСТВО РАЗЫСКИВАЕМОГО ×{m}', head: 'В ГОЛОВУ', kill: 'УБИЙСТВО', protect: 'ЗАЩИТА', killedBy: 'Убит игроком', weapon: 'Оружие', dist: 'Дистанция',
    headshot: 'в голову', killerLeft: 'У убийцы осталось', yourStats: 'Твой матч', deaths: 'СМЕРТИ', damage: 'УРОН', cash: 'ДЕНЬГИ', toShop: 'Открываем магазин…',
    shopName: 'VICE BEACH ARMORY', sidearms: 'ПИСТОЛЕТЫ', longarms: 'ДЛИННОСТВОЛЬНОЕ', equipment: 'СНАРЯЖЕНИЕ', pistols: 'Пистолеты', shotguns: 'Дробовики', assault: 'Штурмовые винтовки',
    tactical: 'Тактические винтовки', smg: 'Пистолеты-пулемёты', sniper: 'Снайперские винтовки', armorCat: 'Бронежилеты', buyEquip: 'КУПИТЬ', equipped: 'ЭКИПИРОВАНО', owned: 'Есть', back: 'В БОЙ',
    purchase: 'Купи {what} и возвращайся', what_long: 'винтовку', what_side: 'пистолет', what_eq: 'броню', free: 'В КОМПЛЕКТЕ', noFunds: 'Мало денег', locked: 'Открой в инвентаре в лобби', lockedNeed: 'Открой в инвентаре: держи {n} на балансе (ничего не списывается)', lockedTag: 'ИНВЕНТАРЬ',
    loadout: 'Снаряжение', st_dmg: 'УРОН', st_acc: 'ТОЧНОСТЬ', st_hand: 'СКОРОСТЬ', st_range: 'ДАЛЬНОСТЬ', st_prot: 'ЗАЩИТА', st_head: 'ГОЛОВА', st_mag: 'МАГАЗИН',
    sub_glock17: 'ПОЛУАВТОМАТИЧЕСКИЙ ПИСТОЛЕТ 9 ММ', sub_deagle: 'ТЯЖЁЛЫЙ ПИСТОЛЕТ .50 AE', sub_spas12: 'БОЕВОЙ ДРОБОВИК', sub_mp5k: 'ПИСТОЛЕТ-ПУЛЕМЁТ', sub_akm: 'ШТУРМОВАЯ ВИНТОВКА', sub_m4a1: 'ТАКТИЧЕСКИЙ КАРАБИН',
    sub_vest: '+{hp} БРОНИ · КОРПУС', sub_helmet: '+{hp} БРОНИ · КОРПУС И ГОЛОВА', lostOnDeath: 'Покупки пропадают после смерти. Деньги остаются.', autoDeploy: 'Возврат через {s} с', autoBack: 'ВОЗВРАТ ЧЕРЕЗ', waited: 'ЖДЁШЬ', startIn: 'СТАРТ НЕ ПОЗЖЕ ЧЕМ ЧЕРЕЗ',
    searching: 'ПОИСК ИГРОКОВ', players: 'игроков', startAt: 'Старт при {max} игроках или через {t} с (минимум {min})', cancel: 'Отмена', waitMore: 'Ждём минимум {min} игроков…',
    entry: 'Взнос', prize: 'Призовой фонд топ-3', countdown: 'МАТЧ ЧЕРЕЗ', fight: 'В БОЙ!', timeUp: 'ВРЕМЯ ВЫШЛО', results: 'ИТОГИ МАТЧА', you: 'Ты', toLobby: 'В лобби', backIn: 'Лобби через {s} с',
    place1: '1 МЕСТО', place2: '2 МЕСТО', place3: '3 МЕСТО', reward: 'Награда', player: 'ИГРОК', board: 'ТАБЛИЦА', left: 'вышел', joined: 'в матче', tabHint: 'TAB – таблица',
    spawnProt: 'Защита после возрождения', armorUp: 'БРОНЯ', mapLbl: 'Карта', bought: 'Куплено: {n}', yourPlace: 'Твоё место: {p}', leaveTitle: 'Выйти из матча?', deadHint: 'ПРОБЕЛ – возрождение · ESC – в лобби', deadWait: 'Возрождение через мгновение…', upgrade: 'НОВОЕ ОРУЖИЕ', maxGun: 'ЛУЧШЕЕ ОРУЖИЕ', online: 'В ЛОББИ', lost: 'Соединение с сервером матча потеряно.' },
  es: { kills: 'BAJAS', rank: 'PUESTO', wanted: 'BUSCADO', youWanted: 'ESTÁS BUSCADO', youWantedSub: 'Tu cabeza vale ×{m}', wantedNow: '{n} está BUSCADO',
    wantedKill: 'BAJA DEL BUSCADO ×{m}', head: 'TIRO A LA CABEZA', kill: 'BAJA', protect: 'PROTEGIDO', killedBy: 'Te mató', weapon: 'Arma', dist: 'Distancia',
    headshot: 'a la cabeza', killerLeft: 'Al asesino le quedó', yourStats: 'Tu partida', deaths: 'MUERTES', damage: 'DAÑO', cash: 'DINERO', toShop: 'Abriendo la tienda…',
    shopName: 'VICE BEACH ARMORY', sidearms: 'PISTOLAS', longarms: 'ARMAS LARGAS', equipment: 'EQUIPO', pistols: 'Pistolas', shotguns: 'Escopetas', assault: 'Rifles de asalto',
    tactical: 'Rifles tácticos', smg: 'Subfusiles', sniper: 'Rifles de francotirador', armorCat: 'Chalecos', buyEquip: 'COMPRAR Y EQUIPAR', equipped: 'EQUIPADO', owned: 'Tienes', back: 'VOLVER A LUCHAR',
    purchase: 'Compra {what} y vuelve', what_long: 'un arma larga', what_side: 'una pistola', what_eq: 'un chaleco', free: 'INCLUIDO', noFunds: 'Dinero insuficiente', locked: 'Desbloquéala en el Inventario del lobby', lockedNeed: 'Desbloquéala en el Inventario: mantén {n} en tu saldo (no se cobra nada)', lockedTag: 'INVENTARIO',
    loadout: 'Equipo', st_dmg: 'DAÑO', st_acc: 'PRECISIÓN', st_hand: 'MANEJO', st_range: 'ALCANCE', st_prot: 'PROTECCIÓN', st_head: 'CABEZA', st_mag: 'CARGADOR',
    sub_glock17: 'PISTOLA SEMIAUTOMÁTICA 9 MM', sub_deagle: 'PISTOLA PESADA .50 AE', sub_spas12: 'ESCOPETA DE COMBATE', sub_mp5k: 'SUBFUSIL', sub_akm: 'RIFLE DE ASALTO', sub_m4a1: 'CARABINA TÁCTICA',
    sub_vest: '+{hp} BLINDAJE · TORSO', sub_helmet: '+{hp} BLINDAJE · TORSO Y CABEZA', lostOnDeath: 'Las compras se pierden al morir. El dinero se queda.', autoDeploy: 'Vuelves en {s} s', autoBack: 'VUELVES EN', waited: 'ESPERANDO', startIn: 'EMPIEZA COMO MUCHO EN',
    searching: 'BUSCANDO JUGADORES', players: 'jugadores', startAt: 'Empieza con {max} jugadores o tras {t} s (mín. {min})', cancel: 'Cancelar', waitMore: 'Esperando al menos {min} jugadores…',
    entry: 'Entrada', prize: 'Premio top 3', countdown: 'PARTIDA EN', fight: '¡LUCHA!', timeUp: 'TIEMPO', results: 'RESULTADOS', you: 'Tú', toLobby: 'Volver al lobby', backIn: 'Lobby en {s} s',
    place1: '1.er PUESTO', place2: '2.º PUESTO', place3: '3.er PUESTO', reward: 'Premio', player: 'JUGADOR', board: 'MARCADOR', left: 'salió', joined: 'en partida', tabHint: 'TAB – marcador',
    spawnProt: 'Protección al reaparecer', armorUp: 'BLINDAJE', mapLbl: 'Mapa', bought: 'Comprado: {n}', yourPlace: 'Tu puesto: {p}', leaveTitle: '¿Salir de la partida?', deadHint: 'ESPACIO – reaparecer · ESC – volver al lobby', deadWait: 'Reapareces en un momento…', upgrade: 'ARMA NUEVA', maxGun: 'MEJOR ARMA', online: 'EN EL LOBBY', lost: 'Se perdió la conexión con el servidor.' },
};
export function tx(k, vars) { const L = TX[getLang()] || TX.en; let s = L[k] ?? TX.en[k] ?? k; if (vars) for (const v in vars) s = s.split('{' + v + '}').join(vars[v]); return s; }
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = v => '$' + Math.max(0, Math.round(v || 0)).toLocaleString('en-US');
const usd = v => '$' + (Math.round((v || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const clock = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

// ---------------- ikony (SVG) ----------------
export const SKULL_PATH = 'M12 1.6C6.9 1.6 3.2 5.3 3.2 10c0 2.8 1.3 4.8 3.1 6v3.1c0 .6.5 1.1 1.1 1.1h1.5v-2.1h1.6v2.1h3v-2.1h1.6v2.1h1.5c.6 0 1.1-.5 1.1-1.1V16c1.8-1.2 3.1-3.2 3.1-6 0-4.7-3.7-8.4-8.8-8.4zM8.5 14.3a2.3 2.3 0 1 1 0-4.6 2.3 2.3 0 0 1 0 4.6zm7 0a2.3 2.3 0 1 1 0-4.6 2.3 2.3 0 0 1 0 4.6zM12 15.1l-1.2 2.1h2.4z';
const IC = {
  skull: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="${SKULL_PATH}"/></svg>`,
  cash: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="4" fill="#2fc46f"/><rect x="5" y="8" width="14" height="8" rx="1.4" fill="#fff"/><circle cx="12" cy="12" r="2.4" fill="#2fc46f"/></svg>',
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3 4.6 13a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9A4.6 4.6 0 0 1 19.4 13z"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.6 2 5 13.4h5.6L9.4 22 19 9.8h-5.7z"/></svg>',
  vest: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.2 2.5 4 4.6l.9 5.2L4 20.6l4.8 1.4 3.2-2 3.2 2 4.8-1.4-.9-10.8.9-5.2-4.2-2.1L14.3 6h-4.6z"/></svg>',
  helmet: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3C6.8 3 3 6.9 3 12v3.2h3.3l.8-2.4h9.8l.8 2.4H21V12c0-5.1-3.8-9-9-9zM2 16.7h20v2.4H2z"/></svg>',
  head: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="2.6"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5" stroke="currentColor" stroke-width="2.2"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7.5a5 5 0 0 1 10 0V10h1.5v11h-13V10zm2.4 0h5.2V7.5a2.6 2.6 0 0 0-5.2 0z"/></svg>',
  shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 5v6.2c0 5 3.4 9.3 8 10.8 4.6-1.5 8-5.8 8-10.8V5z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 16.6-4.6-4.6-1.8 1.8 6.4 6.4L21 8.7l-1.8-1.8z"/></svg>',
  crown: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 7 4.5 4L12 4l4.5 7L21 7l-2 12H5z"/></svg>',
};

// ---------------- style ----------------
const CSS = `
#dmh,#dm-wasted,#dm-podium,#dm-board,#dm-scope,#dm-count{
  --ink:#fff;--dim:#a9a9b3;--mut:#6f6f7a;--pink:#ff5fa2;--pink2:#ff8cc0;--green:#2fc46f;--red:#ef5952;--panel:rgba(14,14,18,.82);--line:rgba(255,255,255,.14);
  --hp:#f2a7c9;--hpTrack:#7d5d6c;--en:#5fe3c8;--enTrack:#2e6e63;--ar:#9b8cf4;--arTrack:#4b437a;
  --head:"Barlow Condensed","Oswald","Arial Narrow",sans-serif;--body:Inter,"Segoe UI",system-ui,sans-serif;--num:"Barlow Condensed","Oswald",Impact,sans-serif;
  --stroke:0 0 1px #000,0 0 2px #000,1px 1px 0 #000,-1px 1px 0 #000,1px -1px 0 #000,-1px -1px 0 #000,0 2px 3px rgba(0,0,0,.55);
  font-family:var(--body);color:var(--ink);-webkit-user-select:none;user-select:none}
#dmh{position:fixed;inset:0;z-index:4;pointer-events:none}
#dmh[hidden],#dm-wasted[hidden],#dm-podium[hidden],#dm-board[hidden],#dm-scope[hidden],#dm-count[hidden]{display:none!important}
body.dm-on #hp,body.dm-on #ammo,body.dm-on #slots,body.dm-on #score,body.dm-on #fatigue,body.dm-on #vlabel{display:none!important}
body.dm-shop canvas{cursor:default}
/* sklep / podium: tylko ich interfejs; WASTED: bez HUD (jak w GTA); kolejka: bez interfejsu lobby pod spodem */
body.dm-shop #dmh,body.dm-shop .hud,body.dm-shop #dm-scope,body.dm-dead #dmh,body.dm-dead .hud,body.dm-dead #dm-scope{display:none!important}
/* --- prawy górny róg: amunicja, broń, kasa, lista zabójstw --- */
#dmh .tr{position:absolute;right:max(22px,env(safe-area-inset-right,0px));top:18px;display:flex;flex-direction:column;align-items:flex-end;gap:2px}
#dmh .ammo{display:flex;align-items:baseline;gap:14px;font:700 40px/1 var(--num);letter-spacing:.02em;text-shadow:var(--stroke);font-variant-numeric:tabular-nums}
#dmh .ammo .res{font-size:40px;color:#e9e9ef}
#dmh .ammo.low .mag{color:var(--red)}
#dmh .ammo.rl .mag{opacity:.45}
#dmh .gun{height:46px;display:flex;align-items:center;justify-content:flex-end;margin-top:2px}
#dmh .gun img{height:38px;max-width:150px;object-fit:contain;filter:brightness(.78) drop-shadow(0 0 1px #000) drop-shadow(0 1px 0 #000) drop-shadow(0 2px 4px rgba(0,0,0,.6));opacity:.95}
#dmh .gun span{font:700 20px var(--head);letter-spacing:.08em;text-transform:uppercase;text-shadow:var(--stroke)}
#dmh .st{min-height:14px;font:700 13px/14px var(--head);letter-spacing:.18em;text-transform:uppercase;color:#ffe08a;text-shadow:var(--stroke)}
#dmh .cash{margin-top:6px;font:700 30px/1 var(--num);letter-spacing:.02em;text-shadow:var(--stroke);font-variant-numeric:tabular-nums;position:relative}
#dmh .cash .plus{position:absolute;right:0;top:100%;margin-top:3px;font-size:24px;color:#7dffb0;opacity:0;white-space:nowrap}
#dmh .cash .plus.go{animation:dm-plus 1.6s ease-out forwards}
@keyframes dm-plus{0%{opacity:0;transform:translateY(-6px)}12%{opacity:1;transform:none}75%{opacity:1}100%{opacity:0;transform:translateY(8px)}}
#dmh .feed{margin-top:34px;display:flex;flex-direction:column;align-items:flex-end;gap:4px;min-width:260px}
#dmh .kf{display:flex;align-items:center;gap:8px;padding:5px 10px;background:rgba(10,10,14,.62);border-right:3px solid transparent;font:700 15px/1 var(--head);letter-spacing:.04em;
  text-transform:uppercase;white-space:nowrap;animation:dm-kf .25s ease-out}
#dmh .kf.me{border-right-color:var(--pink);background:rgba(40,10,26,.72)}
#dmh .kf .k{color:#fff}#dmh .kf .v{color:#d6d6dd}#dmh .kf b.k.self,#dmh .kf b.v.self{color:var(--pink2)}
#dmh .kf img{height:16px;max-width:64px;object-fit:contain;filter:brightness(.9)}
#dmh .kf svg{width:15px;height:15px;fill:currentColor}
#dmh .kf .hs{color:#ffcf5a}#dmh .kf .sk{color:var(--red)}
@keyframes dm-kf{from{opacity:0;transform:translateX(12px)}}
/* --- środek góry: czas, zabójstwa, miejsce, POSZUKIWANY --- */
#dmh .tc{position:absolute;left:50%;top:14px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px}
#dmh .timer{display:flex;align-items:stretch;background:rgba(10,10,14,.7);clip-path:polygon(10px 0,calc(100% - 10px) 0,100% 100%,0 100%)}
#dmh .timer > div{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px 18px 7px;min-width:74px}
#dmh .timer small{font:600 10px/1 var(--head);letter-spacing:.24em;color:var(--dim)}
#dmh .timer b{font:700 27px/1.05 var(--num);letter-spacing:.03em;font-variant-numeric:tabular-nums}
#dmh .timer .clk{background:rgba(255,255,255,.07);min-width:96px}
#dmh .timer .clk b{font-size:32px}
#dmh .timer.hurry .clk b{color:var(--red);animation:dm-pulse .8s ease-in-out infinite}
@keyframes dm-pulse{50%{opacity:.55}}
#dmh .wantedme{display:flex;align-items:center;gap:8px;padding:5px 14px;background:linear-gradient(90deg,rgba(150,10,20,.0),rgba(170,12,24,.85) 20%,rgba(170,12,24,.85) 80%,rgba(150,10,20,0));
  font:700 16px/1 var(--head);letter-spacing:.22em;color:#fff;text-shadow:0 1px 2px #000}
#dmh .wantedme svg{width:20px;height:20px;fill:#fff;filter:drop-shadow(0 0 4px #ff3a3a)}
#dmh .wantedme[hidden]{display:none}
/* --- lewa góra: ranking na żywo --- */
#dmh .lb{position:absolute;left:max(18px,env(safe-area-inset-left,0px));top:62px;display:flex;flex-direction:column;gap:2px;min-width:232px}
#dmh .lb .row{display:grid;grid-template-columns:22px 1fr 34px 46px;align-items:center;gap:6px;padding:4px 10px 4px 8px;background:rgba(10,10,14,.58);font:700 14px/1 var(--head);letter-spacing:.04em}
#dmh .lb .row i{font-style:normal;color:var(--dim);text-align:center}
#dmh .lb .row span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-transform:uppercase;display:flex;align-items:center;gap:5px}
#dmh .lb .row span svg{flex:none;width:14px;height:14px;fill:var(--red)}
#dmh .lb .row b{text-align:right;font-variant-numeric:tabular-nums}
#dmh .lb .row em{font-style:normal;text-align:right;color:var(--dim);font-size:12px;font-variant-numeric:tabular-nums}
#dmh .lb .row.me{background:linear-gradient(90deg,rgba(150,18,84,.88),rgba(110,14,62,.7));box-shadow:inset 3px 0 0 var(--pink)}
#dmh .lb .row.gap{background:none;padding:0;height:6px}
#dmh .lb .head{display:flex;justify-content:space-between;font:600 10px/1 var(--head);letter-spacing:.24em;color:var(--dim);padding:0 10px 3px 8px;text-shadow:0 1px 2px #000}
/* --- lewy dół: minimapa i paski --- */
#dmh .bl{position:absolute;left:max(18px,env(safe-area-inset-left,0px));bottom:max(18px,env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:8px}
#dmh .mm{position:relative;width:236px;height:150px;border-radius:10px;overflow:hidden;background:#15151b;box-shadow:0 0 0 2px rgba(0,0,0,.55),0 6px 16px rgba(0,0,0,.4)}
#dmh .mm canvas{display:block;width:100%;height:100%}
#dmh .vit{display:flex;flex-direction:column;gap:5px}
#dmh .vrow{display:flex;align-items:center;gap:8px}
#dmh .vrow .ic{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:rgba(20,18,24,.85);box-shadow:0 0 0 1px rgba(0,0,0,.5)}
#dmh .vrow .ic svg{width:14px;height:14px}
#dmh .vrow .bar{position:relative;width:200px;height:10px;box-shadow:0 0 0 1px rgba(0,0,0,.55)}
#dmh .vrow .bar b{position:absolute;left:0;top:0;bottom:0;transition:width .12s}
#dmh .vrow .bar s{position:absolute;left:0;top:0;bottom:0;background:rgba(255,255,255,.75);transition:width .45s ease .3s}
#dmh .vrow.hp .ic svg{fill:var(--hp)}#dmh .vrow.hp .bar{background:var(--hpTrack)}#dmh .vrow.hp .bar b{background:var(--hp)}
#dmh .vrow.en .ic svg{fill:var(--en)}#dmh .vrow.en .bar{background:var(--enTrack)}#dmh .vrow.en .bar b{background:var(--en)}
#dmh .vrow.ar .ic svg{fill:var(--ar)}#dmh .vrow.ar .bar{background:var(--arTrack)}#dmh .vrow.ar .bar b{background:var(--ar)}
#dmh .vrow.ar.off{opacity:.38}
#dmh .vrow.hp.low .bar b{background:#ff5a6a;animation:dm-pulse .9s ease-in-out infinite}
#dmh .vrow .n{min-width:30px;font:700 15px/1 var(--num);text-shadow:var(--stroke);font-variant-numeric:tabular-nums}
/* --- środek: powiadomienia, ochrona, kierunek obrażeń --- */
#dmh .note{position:absolute;left:50%;top:24%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px}
#dmh .note .n{display:flex;align-items:center;gap:10px;padding:6px 18px;font:700 26px/1 var(--head);letter-spacing:.14em;text-transform:uppercase;text-shadow:var(--stroke);animation:dm-note 2.2s ease forwards;white-space:nowrap}
#dmh .note .n small{display:block;font:600 14px/1.2 var(--body);letter-spacing:.02em;text-transform:none;color:#e6e6ee}
#dmh .note .n.big{font-size:38px}
#dmh .note .n.red{color:#ff6b62}#dmh .note .n.gold{color:#ffd55a}#dmh .note .n.green{color:#7dffb0}#dmh .note .n.pink{color:var(--pink2)}
#dmh .note .n svg{width:30px;height:30px;fill:currentColor}
@keyframes dm-note{0%{opacity:0;transform:scale(.85)}10%{opacity:1;transform:scale(1.04)}18%{transform:none}80%{opacity:1}100%{opacity:0}}
#dmh .prot{position:absolute;left:50%;top:calc(50% + 46px);transform:translateX(-50%);display:flex;align-items:center;gap:6px;font:700 13px/1 var(--head);letter-spacing:.2em;color:#9fe6ff;text-shadow:var(--stroke)}
#dmh .prot svg{width:16px;height:16px;fill:#9fe6ff}
#dmh .prot[hidden]{display:none}
#dmh .ddir{position:absolute;left:50%;top:50%;width:0;height:0}
#dmh .ddir i{position:absolute;left:-60px;top:-160px;width:120px;height:40px;border-top:5px solid rgba(255,40,40,.85);border-radius:50%/100% 100% 0 0;transform-origin:60px 160px;opacity:0;filter:drop-shadow(0 0 6px rgba(255,0,0,.7))}
#dmh .ddir i.go{animation:dm-dd 1.1s ease-out forwards}
@keyframes dm-dd{0%{opacity:1}100%{opacity:0}}
#dmh .vign{position:absolute;inset:0;box-shadow:inset 0 0 160px rgba(200,0,0,0);transition:box-shadow .25s}
#dmh .tabhint{position:absolute;left:max(18px,env(safe-area-inset-left,0px));top:62px;transform:translateY(-22px);font:600 10px/1 var(--head);letter-spacing:.24em;color:rgba(255,255,255,.55);text-shadow:0 1px 2px #000}
/* --- luneta AWP --- */
/* okular: czarne otoczenie, miękka winieta soczewki, siatka (duplex z kropkami miliradianowymi i podświetlonym środkiem);
   przy przyłożeniu oka krótkie zaciemnienie (::before), na szkle delikatny odblask i barwna obwódka (::after) */
#dm-scope{position:fixed;inset:0;z-index:3;pointer-events:none;--R:min(47vh,47vw);
  background:radial-gradient(circle at 50% 50%,transparent 0,transparent calc(var(--R)*.78),rgba(0,0,0,.28) calc(var(--R)*.9),rgba(0,0,0,.8) calc(var(--R)*.985),#000 calc(var(--R) + 1px))}
#dm-scope::before{content:"";position:absolute;inset:0;background:#000;opacity:0;animation:dmScopeIn .2s ease-out}
#dm-scope::after{content:"";position:absolute;left:50%;top:50%;width:calc(var(--R)*2);height:calc(var(--R)*2);transform:translate(-50%,-50%);border-radius:50%;
  background:radial-gradient(circle at 34% 28%,rgba(255,255,255,.07),transparent 38%),radial-gradient(circle,transparent 96%,rgba(70,120,255,.18) 98.5%,rgba(255,150,60,.12) 99.6%,transparent 100%)}
#dm-scope svg{position:absolute;left:50%;top:50%;width:calc(var(--R)*2);height:calc(var(--R)*2);transform:translate(-50%,-50%);overflow:visible}
@keyframes dmScopeIn{0%{opacity:1}35%{opacity:.85}100%{opacity:0}}
/* --- odliczanie przed startem --- */
#dm-count{position:fixed;inset:0;z-index:6;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:radial-gradient(ellipse at center,rgba(0,0,0,.15),rgba(0,0,0,.55))}
#dm-count small{font:700 16px/1 var(--head);letter-spacing:.4em;color:#fff;text-shadow:var(--stroke)}
#dm-count b{font:700 130px/1 var(--num);color:#fff;text-shadow:var(--stroke),0 0 40px rgba(255,95,162,.6)}
#dm-count b.pop{animation:dm-pop .9s ease-out}
#dm-count b.go{color:var(--pink2);animation:dm-pop .9s ease-out}
#dm-count .map{margin-bottom:10px;padding:6px 14px;background:rgba(10,10,14,.6);font:700 14px/1 var(--head);letter-spacing:.24em;color:#fff}
@keyframes dm-pop{0%{transform:scale(1.6);opacity:0}25%{transform:scale(1);opacity:1}}
/* --- WASTED --- */
#dm-wasted{position:fixed;inset:0;z-index:7;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;background:rgba(0,0,0,0);transition:background .9s ease}
#dm-wasted.on{background:rgba(0,0,0,.62)}
#dm-wasted .w{font:900 clamp(90px,15vw,210px)/.9 "Passion One","Pricedown","Anton",Impact,sans-serif;color:var(--red);letter-spacing:.01em;text-shadow:0 4px 0 rgba(0,0,0,.35);opacity:0;transform:scale(1.25)}
#dm-wasted.on .w{animation:dm-wasted 1s cubic-bezier(.2,.8,.2,1) .25s forwards}
@keyframes dm-wasted{0%{opacity:0;transform:scale(1.25)}100%{opacity:1;transform:scale(1)}}
#dm-wasted .info{margin-top:26px;display:flex;flex-direction:column;align-items:center;gap:14px;opacity:0}
#dm-wasted.on .info{animation:dm-fade .6s ease 1s forwards}
@keyframes dm-fade{to{opacity:1}}
#dm-wasted .by{display:flex;align-items:center;gap:12px;font:600 15px/1 var(--body);color:#cfcfd8}
#dm-wasted .by b{font:700 28px/1 var(--head);letter-spacing:.06em;text-transform:uppercase;color:#fff}
#dm-wasted .by img{height:24px;max-width:90px;object-fit:contain;filter:brightness(.9)}
#dm-wasted .by .hs{color:#ffcf5a;font:700 14px/1 var(--head);letter-spacing:.2em;text-transform:uppercase}
#dm-wasted .facts{display:flex;gap:2px}
#dm-wasted .facts div{min-width:104px;padding:10px 16px;background:rgba(14,14,18,.75);display:flex;flex-direction:column;align-items:center;gap:6px}
#dm-wasted .facts small{font:600 10px/1 var(--head);letter-spacing:.24em;color:var(--dim)}
#dm-wasted .facts b{font:700 24px/1 var(--num);font-variant-numeric:tabular-nums}
#dm-wasted .facts b.g{color:#7dffb0}
#dm-wasted .kleft{font:500 13px/1 var(--body);color:#b7b7c2}
#dm-wasted .kleft b{color:var(--hp)}#dm-wasted .kleft em{font-style:normal;color:var(--ar)}
#dm-wasted .hint{margin-top:6px;font:600 11px/1 var(--head);letter-spacing:.22em;color:rgba(255,255,255,.5);text-transform:uppercase}
#dm-wasted .hint.ready{color:rgba(255,255,255,.72)}
#dmh .cash{display:none!important}
/* --- sklep po śmierci --- */
  clip-path:polygon(10px 0,100% 0,calc(100% - 10px) 100%,0 100%);display:flex;align-items:center;gap:7px;transition:background .12s}
  background:transparent;color:#e9e9ee;font:500 21px/1 var(--body);text-align:left;transition:background .12s,color .12s}
/* --- kolejka --- */
/* --- podium --- */
#dm-podium{position:fixed;inset:0;z-index:9;pointer-events:auto;cursor:default}
#dm-podium .ttl{position:absolute;left:28px;top:22px;text-align:left}
#dm-podium .ttl small{display:block;font:700 13px/1 var(--head);letter-spacing:.4em;color:var(--pink2);text-shadow:0 1px 3px #000}
#dm-podium .ttl b{display:block;margin-top:6px;font:700 46px/1 var(--head);letter-spacing:.08em;text-shadow:0 3px 10px rgba(0,0,0,.6)}
#dm-podium .plate{position:absolute;transform:translate(-50%,-100%);min-width:170px;text-align:center;padding:8px 12px 9px;background:rgba(10,10,14,.8);border-top:3px solid #fff;opacity:0;animation:dm-fade .5s ease forwards}
#dm-podium .plate.p1{border-top-color:#ffd55a}#dm-podium .plate.p2{border-top-color:#dfe3ea}#dm-podium .plate.p3{border-top-color:#e39a62}
#dm-podium .plate small{display:block;font:700 11px/1 var(--head);letter-spacing:.24em;color:var(--dim)}
#dm-podium .plate b{display:block;margin:4px 0 5px;font:700 24px/1 var(--head);letter-spacing:.04em;text-transform:uppercase;white-space:nowrap}
#dm-podium .plate.me b{color:var(--pink2)}
#dm-podium .plate span{display:block;font:600 13px/1.3 var(--body);color:#d2d2da;font-variant-numeric:tabular-nums}
#dm-podium .plate em{display:block;margin-top:4px;font:700 20px/1 var(--num);font-style:normal;color:#7dffb0}
#dm-podium .table{position:absolute;right:24px;top:22px;width:min(380px,34vw);max-height:calc(100% - 190px);overflow:auto;background:rgba(10,10,14,.72)}
#dm-podium .table .r{display:grid;grid-template-columns:30px 1fr 40px 40px 56px 64px;gap:4px;align-items:center;padding:7px 12px;font:600 14px/1 var(--head);letter-spacing:.03em;border-bottom:1px solid rgba(255,255,255,.06)}
#dm-podium .table .r.h{font-size:10px;letter-spacing:.2em;color:var(--dim)}
#dm-podium .table .r.me{background:rgba(255,95,162,.2)}
#dm-podium .table .r.lf{opacity:.45}
#dm-podium .table .r span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-transform:uppercase}
#dm-podium .table .r b,#dm-podium .table .r em{text-align:right;font-style:normal;font-variant-numeric:tabular-nums}
#dm-podium .table .r em{color:#7dffb0}
#dm-podium .foot{position:absolute;left:0;right:0;bottom:24px;display:flex;flex-direction:column;align-items:center;gap:10px}
#dm-podium .foot .mine{font:700 18px/1 var(--head);letter-spacing:.12em;text-shadow:0 1px 3px #000}
#dm-podium .foot button{height:48px;padding:0 34px;border:0;cursor:pointer;font:700 18px/1 var(--head);letter-spacing:.18em;text-transform:uppercase;color:#fff;background:linear-gradient(90deg,#ff2d95,#ff8a3d)}
#dm-podium .foot small{font:600 12px/1 var(--head);letter-spacing:.2em;color:rgba(255,255,255,.6)}
/* --- tabela (Tab) --- */
#dm-board{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:5;width:min(640px,94vw);max-height:80vh;overflow:auto;background:rgba(10,10,14,.88);border-top:3px solid var(--pink);pointer-events:none}
#dm-board h3{margin:0;padding:14px 18px 10px;display:flex;justify-content:space-between;font:700 22px/1 var(--head);letter-spacing:.14em}
#dm-board h3 small{font:600 12px/1.8 var(--head);letter-spacing:.2em;color:var(--dim)}
#dm-board .r{display:grid;grid-template-columns:34px 1fr 60px 60px 80px;gap:6px;align-items:center;padding:7px 18px;font:600 15px/1 var(--head);letter-spacing:.03em;border-bottom:1px solid rgba(255,255,255,.06)}
#dm-board .r.h{font-size:11px;letter-spacing:.22em;color:var(--dim)}
#dm-board .r.me{background:rgba(255,95,162,.2)}#dm-board .r.lf{opacity:.4}
#dm-board .r span{display:flex;align-items:center;gap:6px;text-transform:uppercase;overflow:hidden;white-space:nowrap}
#dm-board .r span svg{width:15px;height:15px;fill:var(--red);flex:none}
#dm-board .r b{text-align:right;font-variant-numeric:tabular-nums}
@media (max-width:900px){#dmh .lb{display:none}#dmh .mm{width:180px;height:120px}#dmh .vrow .bar{width:150px}}
@media (prefers-reduced-motion:reduce){#dmh .kf,#dmh .note .n,#dm-wasted .w,#dm-count b{animation:none!important;opacity:1}}
`;

// ---------------- budowa ----------------
export function createDmUi(opts = {}) {
  if (!document.getElementById('dm-font')) {
    const l = document.createElement('link'); l.id = 'dm-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Passion+One:wght@700;900&display=swap';
    document.head.appendChild(l);
  }
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const el = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
  let icons = opts.icons || {};
  const gunImg = (id) => icons[id] ? `<img alt="" src="${icons[id]}">` : '';

  // ===== HUD =====
  const hud = el(`<div id="dmh" hidden>
    <div class="tr"><div class="ammo"><b class="mag">0</b><b class="res">0</b></div><div class="gun"></div><div class="st"></div>
      <div class="cash"><span class="v">$0</span><span class="plus"></span></div><div class="feed"></div></div>
    <div class="tc"><div class="timer"><div><small data-t="kills"></small><b class="kk">0</b></div><div class="clk"><small data-t="online"></small><b class="tt">1/20</b></div><div><small data-t="rank"></small><b class="rk">-</b></div></div>
      <div class="wantedme" hidden>${IC.skull}<span data-t="youWanted"></span>${IC.skull}</div></div>
    <div class="tabhint" data-t="tabHint"></div>
    <div class="lb"></div>
    <div class="bl"><div class="mm"><canvas width="472" height="300"></canvas></div>
      <div class="vit"><div class="vrow hp"><div class="ic">${IC.heart}</div><div class="bar"><s></s><b></b></div><span class="n">100</span></div>
        <div class="vrow en"><div class="ic">${IC.bolt}</div><div class="bar"><b></b></div></div>
        <div class="vrow ar off"><div class="ic">${IC.vest}</div><div class="bar"><b></b></div><span class="n"></span></div></div></div>
    <div class="note"></div><div class="prot" hidden>${IC.shield}<span data-t="protect"></span></div>
    <div class="ddir"></div><div class="vign"></div>
  </div>`);
  document.body.appendChild(hud);
  const q = (s) => hud.querySelector(s);
  const H = { mag: q('.mag'), res: q('.res'), ammo: q('.ammo'), gun: q('.gun'), st: q('.st'), cash: q('.cash .v'), plus: q('.cash .plus'), feed: q('.feed'), kk: q('.kk'), tt: q('.tt'), rk: q('.rk'), timer: q('.timer'),
    wme: q('.wantedme'), lb: q('.lb'), mm: q('.mm canvas'), hpB: q('.vrow.hp .bar b'), hpS: q('.vrow.hp .bar s'), hpN: q('.vrow.hp .n'), hpRow: q('.vrow.hp'), enB: q('.vrow.en .bar b'),
    arB: q('.vrow.ar .bar b'), arN: q('.vrow.ar .n'), arRow: q('.vrow.ar'), arIc: q('.vrow.ar .ic'), note: q('.note'), prot: q('.prot'), ddir: q('.ddir'), vign: q('.vign') };
  const texts = () => document.querySelectorAll('[data-t]').forEach((n) => { n.textContent = tx(n.dataset.t); });

  let lastGun = '';
  function setAmmo(mag, res, id, state, low, reloading) {
    H.mag.textContent = mag; H.res.textContent = res;
    H.ammo.classList.toggle('low', !!low); H.ammo.classList.toggle('rl', !!reloading);
    if (id !== lastGun) { lastGun = id; H.gun.innerHTML = gunImg(id) || `<span>${esc(opts.gunName ? opts.gunName(id) : id)}</span>`; }
    H.st.textContent = state || '';
  }
  let shownMoney = 0;
  function setMoney(v, plus) {
    H.cash.textContent = money(v); shownMoney = v;
    if (plus > 0) { H.plus.textContent = '+' + money(plus); H.plus.classList.remove('go'); void H.plus.offsetWidth; H.plus.classList.add('go'); }
  }
  let ghostHp = 100;
  function setVitals(hp, energy, armor, armorMax, helmet) {
    const w = Math.max(0, Math.min(100, hp));
    H.hpB.style.width = w + '%'; if (w > ghostHp) H.hpS.style.width = w + '%'; ghostHp = w; requestAnimationFrame(() => { H.hpS.style.width = w + '%'; });
    H.hpN.textContent = Math.ceil(w); H.hpRow.classList.toggle('low', w <= 25 && w > 0);
    H.enB.style.width = Math.round(Math.max(0, Math.min(1, energy)) * 100) + '%';
    const a = armorMax ? Math.max(0, Math.min(1, armor / armorMax)) : 0;
    H.arB.style.width = Math.round(a * 100) + '%'; H.arRow.classList.toggle('off', !(armor > 0)); H.arN.textContent = armor > 0 ? Math.ceil(armor) : '';
    H.arIc.innerHTML = helmet ? IC.helmet : IC.vest;
  }
  // stałe lobby: bez zegara – w środku liczba graczy w lobby
  function setTimer(online, max, kills, rank, total) {
    H.tt.textContent = online + '/' + max;
    H.kk.textContent = kills; H.rk.textContent = rank ? rank + '/' + total : '-';
  }
  function setWantedMe(on) { H.wme.hidden = !on; }
  // ranking: 5 pierwszych + ja (jeśli dalej)
  function setBoard(rows, meId, wantedId, nameOf) {
    const head = `<div class="head"><span>${esc(tx('player'))}</span><span>K · DMG</span></div>`;
    const line = (r, i) => `<div class="row${r[0] === meId ? ' me' : ''}"><i>${i + 1}</i><span>${r[0] === wantedId ? IC.skull : ''}${esc(nameOf(r[0]))}</span><b>${r[1]}</b><em>${r[3]}</em></div>`;
    const act = rows.filter((r) => !r[4]); let h = head + act.slice(0, 5).map(line).join('');
    const mi = act.findIndex((r) => r[0] === meId); if (mi >= 5) h += '<div class="row gap"></div>' + line(act[mi], mi);
    H.lb.innerHTML = h;
  }
  function killFeed(k, v, wid, head, wanted, meId, nameOf) {
    const d = document.createElement('div'); d.className = 'kf' + (k === meId || v === meId ? ' me' : '');
    d.innerHTML = (k ? `<b class="k${k === meId ? ' self' : ''}">${esc(nameOf(k))}</b>` : '') + (gunImg(wid) || `<span>${esc(wid)}</span>`) + (head ? `<span class="hs">${IC.head}</span>` : '')
      + (wanted ? `<span class="sk">${IC.skull}</span>` : '') + `<b class="v${v === meId ? ' self' : ''}">${esc(nameOf(v))}</b>`;
    H.feed.prepend(d); while (H.feed.children.length > 6) H.feed.lastChild.remove();
    setTimeout(() => { d.style.transition = 'opacity .5s'; d.style.opacity = '0'; setTimeout(() => d.remove(), 520); }, 6500);
  }
  function notify(html, kind = '', big = false, icon = '') {
    const n = document.createElement('div'); n.className = 'n ' + kind + (big ? ' big' : ''); n.innerHTML = (icon ? IC[icon] || '' : '') + '<div>' + html + '</div>';
    H.note.appendChild(n); while (H.note.children.length > 3) H.note.firstChild.remove();
    setTimeout(() => n.remove(), 2300);
  }
  function damageDir(angle) {
    const i = document.createElement('i'); i.style.transform = `rotate(${angle}rad)`; H.ddir.appendChild(i); void i.offsetWidth; i.classList.add('go');
    setTimeout(() => i.remove(), 1200);
    H.vign.style.boxShadow = 'inset 0 0 160px rgba(220,0,0,.55)'; clearTimeout(H.vign._t); H.vign._t = setTimeout(() => { H.vign.style.boxShadow = ''; }, 180);
  }
  function setProt(sec) { H.prot.hidden = !(sec > 0); if (sec > 0) H.prot.querySelector('span').textContent = tx('protect') + ' ' + sec.toFixed(1); }

  // ===== minimapa (obrót z graczem, jak w GTA) =====
  const MM = { base: null, scale: 5, bx: 20, bz: 30 };
  function mapBase(boxes, bx, bz) {
    const S = 5, W = Math.ceil(bx * 2 * S) + 40, Hh = Math.ceil(bz * 2 * S) + 40, c = document.createElement('canvas'); c.width = W; c.height = Hh;
    const x = c.getContext('2d'); x.fillStyle = '#2b3a2f'; x.fillRect(0, 0, W, Hh);
    x.fillStyle = '#3c4c40'; x.fillRect(20, 20, bx * 2 * S, bz * 2 * S);
    const sorted = boxes.slice().sort((a, b) => a.top - b.top);
    for (const b of sorted) {
      if (b.top < 0.35) continue; const h = Math.min(1, b.top / 6);
      x.fillStyle = `rgb(${Math.round(70 + h * 90)},${Math.round(72 + h * 84)},${Math.round(84 + h * 86)})`;
      x.fillRect(20 + (b.minX + bx) * S, 20 + (b.minZ + bz) * S, Math.max(1, (b.maxX - b.minX) * S), Math.max(1, (b.maxZ - b.minZ) * S));
    }
    x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 2; x.strokeRect(20, 20, bx * 2 * S, bz * 2 * S);
    MM.base = c; MM.scale = S; MM.bx = bx; MM.bz = bz;
  }
  const skullP = new Path2D(SKULL_PATH);
  function drawMinimap(me, foes, wanted) {
    const c = H.mm, x = c.getContext('2d'), W = c.width, Hh = c.height, S = MM.scale * 1.15;
    x.fillStyle = '#15151b'; x.fillRect(0, 0, W, Hh);
    if (!MM.base) return;
    const cx = W / 2, cy = Hh * 0.6;
    x.save(); x.translate(cx, cy); x.rotate(me.yaw); x.scale(S / MM.scale, S / MM.scale);
    x.drawImage(MM.base, -(20 + (me.x + MM.bx) * MM.scale), -(20 + (me.z + MM.bz) * MM.scale));
    x.restore();
    const toScr = (px, pz) => { const dx = (px - me.x) * S, dz = (pz - me.z) * S, c0 = Math.cos(me.yaw), s0 = Math.sin(me.yaw); return [cx + dx * c0 - dz * s0, cy + dx * s0 + dz * c0]; };
    for (const f of foes) { const [sx, sy] = toScr(f.x, f.z); if (f.id === (wanted && wanted.id)) continue;
      x.fillStyle = '#ff4d5e'; x.strokeStyle = 'rgba(0,0,0,.7)'; x.lineWidth = 2; x.beginPath(); x.arc(sx, sy, 6, 0, 7); x.fill(); x.stroke(); }
    if (wanted) {
      let [sx, sy] = toScr(wanted.x, wanted.z); const m = 16; const out = sx < m || sx > W - m || sy < m || sy > Hh - m;
      sx = Math.max(m, Math.min(W - m, sx)); sy = Math.max(m, Math.min(Hh - m, sy));
      x.save(); x.translate(sx - 14, sy - 14); x.scale(28 / 24, 28 / 24); x.fillStyle = '#000'; x.globalAlpha = .55; x.translate(.8, .8); x.fill(skullP, 'evenodd'); x.translate(-.8, -.8); x.globalAlpha = 1;
      x.fillStyle = out ? '#ff7a70' : '#ff2b2b'; x.fill(skullP, 'evenodd'); x.restore();
    }
    // ja: strzałka
    x.save(); x.translate(cx, cy); x.fillStyle = '#fff'; x.strokeStyle = 'rgba(0,0,0,.7)'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(0, -12); x.lineTo(9, 10); x.lineTo(0, 5); x.lineTo(-9, 10); x.closePath(); x.fill(); x.stroke(); x.restore();
    // pole widzenia
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, 120); g.addColorStop(0, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, 120, -Math.PI / 2 - .55, -Math.PI / 2 + .55); x.closePath(); x.fill();
  }

  // ===== odliczanie =====
  const cnt = el(`<div id="dm-count" hidden><div class="map"></div><small data-t="countdown"></small><b></b></div>`); document.body.appendChild(cnt);
  let lastCnt = '';
  function countdown(sec, mapLabel) {
    if (sec === null) { cnt.hidden = true; lastCnt = ''; return; }
    cnt.hidden = false; const b = cnt.querySelector('b'), go = sec <= 0, v = go ? tx('fight') : String(Math.ceil(sec));
    cnt.querySelector('small').textContent = go ? '' : tx('countdown'); cnt.querySelector('.map').textContent = mapLabel || '';
    if (v !== lastCnt) { lastCnt = v; b.textContent = v; b.className = ''; void b.offsetWidth; b.className = go ? 'go' : 'pop'; }
  }

  // ===== luneta =====
  const dots = [9, 18, 27, 36].flatMap(k => [[k, 0], [-k, 0], [0, k], [0, -k]]).map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".9"/>`).join('');
  const scope = el(`<div id="dm-scope" hidden><svg viewBox="-100 -100 200 200" aria-hidden="true">
    <g stroke="#050505" fill="none" vector-effect="non-scaling-stroke">
      <path d="M-100 0H100M0 -100V100" stroke-width="1.2" vector-effect="non-scaling-stroke"/>
      <path d="M-100 0H-44M44 0H100M0 44V100M0 -100V-44" stroke-width="4.5" vector-effect="non-scaling-stroke"/>
    </g><g fill="#050505">${dots}</g><circle r="1.05" fill="#e0291c"/></svg></div>`); document.body.appendChild(scope);

  // ===== WASTED =====
  const wasted = el(`<div id="dm-wasted" hidden><div class="w">wasted</div><div class="info"><div class="by"></div><div class="kleft"></div><div class="facts"></div><div class="hint"></div></div></div>`);
  document.body.appendChild(wasted);
  function showWasted(o) {
    wasted.querySelector('.by').innerHTML = o.killer ? `<span>${esc(tx('killedBy'))}</span><b>${esc(o.killer)}</b>${gunImg(o.weapon)}${o.head ? `<span class="hs">${esc(tx('headshot'))}</span>` : ''}<span>${o.dist} m</span>` : '';
    wasted.querySelector('.kleft').innerHTML = o.killer ? `${esc(tx('killerLeft'))}: <b>${o.killerHp} HP</b>${o.killerAr > 0 ? ` · <em>${o.killerAr} ${esc(tx('armorUp'))}</em>` : ''}` : '';
    wasted.querySelector('.facts').innerHTML = `<div><small>${esc(tx('kills'))}</small><b>${o.kills}</b></div><div><small>${esc(tx('deaths'))}</small><b>${o.deaths}</b></div>`
      + `<div><small>${esc(tx('damage'))}</small><b>${o.damage}</b></div>`;
    wastedReady(false);
    wasted.hidden = false; wasted.classList.remove('on'); void wasted.offsetWidth; wasted.classList.add('on');
  }
  const hideWasted = () => { wasted.hidden = true; wasted.classList.remove('on'); };
  // mały druk pod statystykami: najpierw „za chwilę”, potem Spacja = odrodzenie, Esc = lobby
  function wastedReady(ready) { const h = wasted.querySelector('.hint'); h.textContent = tx(ready ? 'deadHint' : 'deadWait'); h.classList.toggle('ready', !!ready); }

  // ===== podium =====
  const pod = el(`<div id="dm-podium" hidden><div class="ttl"><small>DEATHMATCH</small><b data-t="results"></b></div><div class="plates"></div><div class="table"></div>
    <div class="foot"><div class="mine"></div><button type="button" class="back"></button><small class="cd"></small></div></div>`);
  document.body.appendChild(pod);
  function showPodium(end, meId, onBack) {
    pod.hidden = false; texts();
    const st = end.standings, top = end.podium.map((id) => st.find((s) => s.id === id));
    pod.querySelector('.plates').innerHTML = top.map((s, i) => s ? `<div class="plate p${i + 1}${s.id === meId ? ' me' : ''}" data-i="${i}" style="animation-delay:${0.6 + i * 0.35}s"><small>${esc(tx('place' + (i + 1)))}</small><b>${esc(s.nick)}</b>`
      + `<span>${s.kills} ${esc(tx('kills').toLowerCase())} · ${s.damage} ${esc(tx('damage').toLowerCase())}</span>${s.prize > 0 ? `<em>+${usd(s.prize)}</em>` : ''}</div>` : '').join('');
    pod.querySelector('.table').innerHTML = `<div class="r h"><i>#</i><span>${esc(tx('player'))}</span><b>K</b><b>D</b><b>DMG</b><em>${esc(tx('reward'))}</em></div>`
      + st.map((s) => `<div class="r${s.id === meId ? ' me' : ''}${s.left ? ' lf' : ''}"><i>${s.rank}</i><span>${esc(s.nick)}${s.left ? ' · ' + esc(tx('left')) : ''}</span><b>${s.kills}</b><b>${s.deaths}</b><b>${s.damage}</b><em>${s.prize > 0 ? usd(s.prize) : ''}</em></div>`).join('');
    const mine = st.find((s) => s.id === meId);
    pod.querySelector('.mine').textContent = mine ? tx('yourPlace', { p: mine.rank + ' / ' + st.length }) + (mine.prize > 0 ? ' · +' + usd(mine.prize) : '') : '';
    const b = pod.querySelector('.back'); b.textContent = tx('toLobby'); b.onclick = onBack;
  }
  function podiumPlates(pos) { pod.querySelectorAll('.plate').forEach((p) => { const v = pos[+p.dataset.i]; if (!v) return; p.style.left = v[0] + 'px'; p.style.top = v[1] + 'px'; }); }
  const podiumCd = (s) => { pod.querySelector('.cd').textContent = tx('backIn', { s: Math.max(0, Math.ceil(s)) }); };
  const hidePodium = () => { pod.hidden = true; };

  // ===== tabela (Tab) =====
  const board = el('<div id="dm-board" hidden></div>'); document.body.appendChild(board);
  function showBoard(on, rows, meId, wantedId, nameOf, mapLabel) {
    board.hidden = !on; if (!on) return;
    board.innerHTML = `<h3><span>${esc(tx('board'))}</span><small>${esc(mapLabel || '')}</small></h3><div class="r h"><i>#</i><span>${esc(tx('player'))}</span><b>K</b><b>D</b><b>DMG</b></div>`
      + rows.map((r, i) => `<div class="r${r[0] === meId ? ' me' : ''}${r[4] ? ' lf' : ''}"><i>${i + 1}</i><span>${r[0] === wantedId ? IC.skull : ''}${esc(nameOf(r[0]))}</span><b>${r[1]}</b><b>${r[2]}</b><b>${r[3]}</b></div>`).join('');
  }

  texts();
  return {
    hud, setIcons(ic) { icons = ic || {}; lastGun = ''; }, texts,
    show(on) { hud.hidden = !on; document.body.classList.toggle('dm-on', !!on); if (on) texts(); },
    setAmmo, setMoney, setVitals, setTimer, setWantedMe, setBoard, killFeed, notify, damageDir, setProt, mapBase, drawMinimap,
    countdown, scope(on) { scope.hidden = !on; },
    showWasted, hideWasted, wastedReady,
    showPodium, podiumPlates, podiumCd, hidePodium, showBoard,
    get money() { return shownMoney; },
  };
}
