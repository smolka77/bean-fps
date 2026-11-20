// Krótki tutorial w slajdach: pokazuje się raz (pierwsze wejście w tej przeglądarce, po ekranie wczytywania),
// potem można go otworzyć z menu („Jak grać”). Treść zgodna z zasadami serwera: stawki 1v1, prowizja, Deathmatch,
// wpłaty/wypłaty, Ekwipunek (bronie za trzymanie SOL albo tokena – ustawienia czytane z /api/arsenal, CA z /api/xshare).
const KEY = 'gta-tutorial-v1';
const SV = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
const ICON = {
  hello: `<svg ${SV}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="1.6"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/></svg>`,
  duel: `<svg ${SV}><path d="M4 20 14.5 9.5M9.5 4.5l10 10M14 4l6 6-2 2-6-6zM4 14l6 6-2 2-6-6z"/></svg>`,
  dm: `<svg ${SV}><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>`,
  dep: `<svg ${SV}><path d="M12 3v12m0 0-4-4m4 4 4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>`,
  wd: `<svg ${SV}><path d="M12 15V3m0 0L8 7m4-4 4 4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>`,
  coin: `<svg ${SV}><ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/></svg>`,
  fair: `<svg ${SV}><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>`,
};
const GUN = { deagle: 'Desert Eagle', mp5k: 'MP5K', spas12: 'SPAS-12', akm: 'AKM', m4a1: 'M4A1' };

const T = {
  pl: { skip: 'Pomiń', back: 'Wstecz', next: 'Dalej', go: 'Gramy!', menu: 'Jak grać', step: '{i} / {n}',
    s: [
      ['hello', 'Witaj w GTASSAULT', 'Szybka strzelanka FPS w przeglądarce. Grasz za darmo albo o prawdziwe SOL. Bez pobierania, bez instalacji.',
        ['<b>1v1</b> – mecz o stawkę z prawdziwym graczem', '<b>Deathmatch</b> – darmowe lobby, wchodzisz kiedy chcesz', '<b>Strzelnica</b> – trening celowania']],
      ['duel', '1v1 o stawkę', 'Wybierasz stawkę, serwer dobiera rywala z tą samą stawką. Gracie do 3 wygranych rund.',
        ['Stawki <b>$1 · $5 · $10</b> albo własna (płacisz w SOL po bieżącym kursie)', 'Zwycięzca bierze pulę obu stawek minus <b>10% prowizji</b>', 'Nowe konto: najpierw do $5, wyższe stawki po kolejnych meczach', 'Wyjście z meczu = przegrana walkowerem']],
      ['dm', 'Deathmatch – za darmo', 'Stałe lobby do 20 osób (gracze i boty). Wchodzisz i wychodzisz w dowolnej chwili.',
        ['Startujesz z <b>Glockiem</b>', 'Lepsza broń za 1 kill, potem za kolejne 2, 3, 4…', 'Śmierć cofa o jedną broń – odzyskasz ją za 3 kille', '<b>Spacja</b> – odrodzenie, <b>Tab</b> – ranking, <b>Esc</b> – wyjście']],
      ['dep', 'Wpłaty', 'Każde konto ma własny adres SOL w portfelu gry (sieć Solana).',
        ['Wyślij SOL na swój adres z dowolnego portfela lub giełdy', 'Serwer sam wykryje wpłatę, możesz też kliknąć „Sprawdź”', 'Saldo widzisz w USD, rozliczane jest w SOL']],
      ['wd', 'Wypłaty', 'Wypłacasz na dowolny adres Solany w zakładce Wypłać w portfelu.',
        ['Wypłaty powyżej <b>$100</b> sprawdza ręcznie admin', 'Limit <b>$500</b> na dobę na konto', 'Po zmianie hasła lub e-maila wypłaty są wstrzymane na 24 h – to ochrona konta']],
      ['coin', '{coinTitle}', '{coinLead}', '{coinList}'],
      ['fair', 'Uczciwa gra', 'Trafienia, obrażenia i ruch liczy serwer, nie przeglądarka – cheaty nic nie dają.',
        ['Podejrzane wygrane czekają na sprawdzenie (mamy powtórki meczów)', 'Za oszustwo: blokada gry o stawki i wypłat', 'Graj odpowiedzialnie – stawiaj tylko tyle, ile możesz stracić']],
    ],
    dmX: '<b>Wejście po udostępnieniu gry na X</b>: dostajesz swój kod, publikujesz post z tym kodem (tekst wstawi się sam) i wklejasz link do posta – raz na konto',
    coinSolT: 'Ekwipunek – bronie za saldo', coinSolL: 'Na start masz pistolet. Trzymaj SOL na saldzie w grze, a odblokujesz resztę broni (1v1 i Deathmatch).',
    coinTokT: 'Coin {sym} – bronie za trzymanie', coinTokL: 'Na start masz pistolet. Trzymaj {sym} na swoim adresie w grze, a odblokujesz resztę broni (1v1 i Deathmatch).',
    coinNone: 'Nic się nie pobiera – liczy się samo saldo', coinDrop: 'Gdy saldo spadnie poniżej progu, broń znów się zablokuje', coinCa: 'CA: <code>{ca}</code>', coinNeed: '{gun}: od {n} {u}',
coinHoldT: 'Coin {sym} – bronie za trzymanie', coinHoldL: 'Na start masz pistolet. Podepnij swój portfel z {sym} albo trzymaj tyle samo wartości w SOL w grze, a odblokujesz resztę broni (1v1 i Deathmatch).',
    coinHoldW: '<b>Portfel</b>: Ekwipunek → „Podepnij portfel” (Phantom, Solflare) – podpis nic nie kosztuje, tokeny zostają u Ciebie', coinHoldS: '<b>Bez portfela</b>: liczy się SOL w grze po bieżącym kursie {sym}',
    coinOffT: 'Ekwipunek', coinOffL: 'Teraz wszystkie bronie są dostępne dla każdego. Gdy włączymy Ekwipunek, część broni odblokujesz za trzymanie SOL lub coina – nic nie będzie pobierane.' },
  en: { skip: 'Skip', back: 'Back', next: 'Next', go: 'Let’s play!', menu: 'How to play', step: '{i} / {n}',
    s: [
      ['hello', 'Welcome to GTASSAULT', 'A fast browser FPS. Play for free or for real SOL. No download, no install.',
        ['<b>1v1</b> – a match for a stake against a real player', '<b>Deathmatch</b> – a free lobby, drop in any time', '<b>Shooting range</b> – aim training']],
      ['duel', '1v1 for a stake', 'Pick a stake and the server finds an opponent with the same stake. First to 3 rounds wins.',
        ['Stakes <b>$1 · $5 · $10</b> or custom (paid in SOL at the current rate)', 'The winner takes both stakes minus a <b>10% fee</b>', 'New accounts: up to $5 first, higher stakes after more matches', 'Leaving a match = loss by forfeit']],
      ['dm', 'Deathmatch – free', 'A persistent lobby for up to 20 (players and bots). Join and leave whenever you like.',
        ['You start with a <b>Glock</b>', 'A better gun after 1 kill, then after 2, 3, 4 more…', 'Dying drops you one gun – win it back with 3 kills', '<b>Space</b> – respawn, <b>Tab</b> – scoreboard, <b>Esc</b> – leave']],
      ['dep', 'Deposits', 'Every account has its own SOL address in the game wallet (Solana network).',
        ['Send SOL to your address from any wallet or exchange', 'The server detects it automatically, or click “Check”', 'Your balance shows in USD and settles in SOL']],
      ['wd', 'Withdrawals', 'Withdraw to any Solana address in the Withdraw tab of the wallet.',
        ['Withdrawals over <b>$100</b> are reviewed by an admin', 'Limit of <b>$500</b> per day per account', 'After a password or e-mail change withdrawals pause for 24 h – account protection']],
      ['coin', '{coinTitle}', '{coinLead}', '{coinList}'],
      ['fair', 'Fair play', 'Hits, damage and movement are calculated by the server, not your browser – cheats don’t work.',
        ['Suspicious wins are held for review (we keep match replays)', 'Cheating: banned from stakes and withdrawals', 'Play responsibly – only stake what you can afford to lose']],
    ],
    dmX: '<b>Access after sharing the game on X</b>: you get your own code, post it on X (the text is filled in for you) and paste the post link – once per account',
    coinSolT: 'Inventory – guns for your balance', coinSolL: 'You start with a pistol. Keep SOL in your in-game balance to unlock the other guns (1v1 and Deathmatch).',
    coinTokT: '{sym} coin – guns for holding', coinTokL: 'You start with a pistol. Hold {sym} on your in-game address to unlock the other guns (1v1 and Deathmatch).',
    coinNone: 'Nothing is charged – only the balance counts', coinDrop: 'If your balance drops below a threshold, that gun locks again', coinCa: 'CA: <code>{ca}</code>', coinNeed: '{gun}: from {n} {u}',
coinHoldT: '{sym} coin – guns for holding', coinHoldL: 'You start with a pistol. Link your wallet holding {sym}, or keep the same value in SOL in the game, to unlock the other guns (1v1 and Deathmatch).',
    coinHoldW: '<b>Wallet</b>: Inventory → “Link wallet” (Phantom, Solflare) – signing is free and the tokens stay with you', coinHoldS: '<b>No wallet</b>: your in-game SOL counts at the current {sym} price',
    coinOffT: 'Inventory', coinOffL: 'Right now every gun is available to everyone. When Inventory is on, some guns unlock for holding SOL or the coin – nothing is ever charged.' },
  ru: { skip: 'Пропустить', back: 'Назад', next: 'Далее', go: 'Играем!', menu: 'Как играть', step: '{i} / {n}',
    s: [
      ['hello', 'Добро пожаловать в GTASSAULT', 'Быстрый FPS-шутер в браузере. Играй бесплатно или на реальные SOL. Без скачивания и установки.',
        ['<b>1v1</b> – матч на ставку против живого игрока', '<b>Deathmatch</b> – бесплатное лобби, заходи когда хочешь', '<b>Стрельбище</b> – тренировка прицеливания']],
      ['duel', '1v1 на ставку', 'Выбираешь ставку, сервер подбирает соперника с такой же ставкой. Играете до 3 выигранных раундов.',
        ['Ставки <b>$1 · $5 · $10</b> или своя (оплата в SOL по текущему курсу)', 'Победитель забирает обе ставки минус <b>10% комиссии</b>', 'Новый аккаунт: сначала до $5, ставки выше – после следующих матчей', 'Выход из матча = техническое поражение']],
      ['dm', 'Deathmatch – бесплатно', 'Постоянное лобби до 20 человек (игроки и боты). Заходишь и выходишь в любой момент.',
        ['Старт с <b>Glock</b>', 'Оружие лучше за 1 убийство, потом за следующие 2, 3, 4…', 'Смерть отнимает одно оружие – вернёшь его за 3 убийства', '<b>Пробел</b> – возрождение, <b>Tab</b> – рейтинг, <b>Esc</b> – выход']],
      ['dep', 'Пополнение', 'У каждого аккаунта свой адрес SOL в кошельке игры (сеть Solana).',
        ['Отправь SOL на свой адрес с любого кошелька или биржи', 'Сервер сам увидит пополнение, можно также нажать «Проверить»', 'Баланс показан в USD, расчёты идут в SOL']],
      ['wd', 'Вывод', 'Выводи на любой адрес Solana во вкладке «Вывод» в кошельке.',
        ['Выводы больше <b>$100</b> админ проверяет вручную', 'Лимит <b>$500</b> в сутки на аккаунт', 'После смены пароля или e-mail вывод приостановлен на 24 ч – это защита аккаунта']],
      ['coin', '{coinTitle}', '{coinLead}', '{coinList}'],
      ['fair', 'Честная игра', 'Попадания, урон и движение считает сервер, а не браузер – читы не помогут.',
        ['Подозрительные выигрыши ждут проверки (у нас есть повторы матчей)', 'За обман: запрет игры на ставки и вывода', 'Играй ответственно – ставь только то, что готов потерять']],
    ],
    dmX: '<b>Вход после публикации об игре в X</b>: получаешь свой код, публикуешь пост с этим кодом (текст подставится сам) и вставляешь ссылку на пост – один раз на аккаунт',
    coinSolT: 'Инвентарь – оружие за баланс', coinSolL: 'На старте у тебя пистолет. Держи SOL на игровом балансе – и откроешь остальное оружие (1v1 и Deathmatch).',
    coinTokT: 'Монета {sym} – оружие за удержание', coinTokL: 'На старте у тебя пистолет. Держи {sym} на своём игровом адресе – и откроешь остальное оружие (1v1 и Deathmatch).',
    coinNone: 'Ничего не списывается – важен только баланс', coinDrop: 'Если баланс упадёт ниже порога, оружие снова заблокируется', coinCa: 'CA: <code>{ca}</code>', coinNeed: '{gun}: от {n} {u}',
coinHoldT: 'Монета {sym} – оружие за удержание', coinHoldL: 'На старте у тебя пистолет. Подключи свой кошелёк с {sym} или держи столько же по стоимости в SOL в игре – и откроешь остальное оружие (1v1 и Deathmatch).',
    coinHoldW: '<b>Кошелёк</b>: Инвентарь → «Подключить кошелёк» (Phantom, Solflare) – подпись бесплатна, токены остаются у тебя', coinHoldS: '<b>Без кошелька</b>: считается SOL в игре по текущему курсу {sym}',
    coinOffT: 'Инвентарь', coinOffL: 'Сейчас всё оружие доступно всем. Когда включим Инвентарь, часть оружия откроется за удержание SOL или монеты – ничего не будет списываться.' },
  es: { skip: 'Saltar', back: 'Atrás', next: 'Siguiente', go: '¡A jugar!', menu: 'Cómo jugar', step: '{i} / {n}',
    s: [
      ['hello', 'Bienvenido a GTASSAULT', 'Un shooter FPS rápido en el navegador. Juega gratis o por SOL de verdad. Sin descargas ni instalación.',
        ['<b>1v1</b> – partida con apuesta contra un jugador real', '<b>Deathmatch</b> – lobby gratis, entras cuando quieras', '<b>Campo de tiro</b> – entrenamiento de puntería']],
      ['duel', '1v1 con apuesta', 'Eliges la apuesta y el servidor busca un rival con la misma apuesta. Gana quien llegue a 3 rondas.',
        ['Apuestas de <b>$1 · $5 · $10</b> o personalizada (pagas en SOL al cambio actual)', 'El ganador se lleva ambas apuestas menos una <b>comisión del 10%</b>', 'Cuenta nueva: primero hasta $5, apuestas mayores tras más partidas', 'Salir de la partida = derrota por abandono']],
      ['dm', 'Deathmatch – gratis', 'Lobby permanente de hasta 20 personas (jugadores y bots). Entras y sales cuando quieras.',
        ['Empiezas con una <b>Glock</b>', 'Mejor arma tras 1 baja, luego tras otras 2, 3, 4…', 'Morir te quita un arma – la recuperas con 3 bajas', '<b>Espacio</b> – reaparecer, <b>Tab</b> – clasificación, <b>Esc</b> – salir']],
      ['dep', 'Depósitos', 'Cada cuenta tiene su propia dirección SOL en la cartera del juego (red Solana).',
        ['Envía SOL a tu dirección desde cualquier cartera o exchange', 'El servidor detecta el depósito solo, o pulsa «Comprobar»', 'Ves el saldo en USD y se liquida en SOL']],
      ['wd', 'Retiros', 'Retira a cualquier dirección de Solana en la pestaña Retirar de la cartera.',
        ['Los retiros de más de <b>$100</b> los revisa un admin', 'Límite de <b>$500</b> al día por cuenta', 'Tras cambiar la contraseña o el e-mail, los retiros se pausan 24 h – protección de la cuenta']],
      ['coin', '{coinTitle}', '{coinLead}', '{coinList}'],
      ['fair', 'Juego limpio', 'Los impactos, el daño y el movimiento los calcula el servidor, no tu navegador: las trampas no sirven.',
        ['Las victorias sospechosas quedan en revisión (guardamos repeticiones)', 'Por hacer trampas: sin apuestas ni retiros', 'Juega con responsabilidad: apuesta solo lo que puedas perder']],
    ],
    dmX: '<b>Acceso tras compartir el juego en X</b>: recibes tu código, publicas un post con él (el texto se rellena solo) y pegas el enlace del post – una vez por cuenta',
    coinSolT: 'Inventario – armas por tu saldo', coinSolL: 'Empiezas con una pistola. Mantén SOL en tu saldo del juego y desbloquea el resto de armas (1v1 y Deathmatch).',
    coinTokT: 'Moneda {sym} – armas por mantenerla', coinTokL: 'Empiezas con una pistola. Guarda {sym} en tu dirección del juego y desbloquea el resto de armas (1v1 y Deathmatch).',
    coinNone: 'No se cobra nada: solo cuenta el saldo', coinDrop: 'Si el saldo baja del umbral, el arma se vuelve a bloquear', coinCa: 'CA: <code>{ca}</code>', coinNeed: '{gun}: desde {n} {u}',
coinHoldT: 'Moneda {sym} – armas por mantenerla', coinHoldL: 'Empiezas con una pistola. Conecta tu cartera con {sym} o guarda el mismo valor en SOL en el juego y desbloquea el resto de armas (1v1 y Deathmatch).',
    coinHoldW: '<b>Cartera</b>: Inventario → «Conectar cartera» (Phantom, Solflare): firmar es gratis y los tokens se quedan contigo', coinHoldS: '<b>Sin cartera</b>: cuenta tu SOL del juego al precio actual de {sym}',
    coinOffT: 'Inventario', coinOffL: 'Ahora todas las armas están disponibles para todos. Cuando activemos el Inventario, algunas armas se desbloquearán por mantener SOL o la moneda: nunca se cobrará nada.' },
};

const CSS = `#gta-tut{position:fixed;inset:0;z-index:99985;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(6,2,12,.66);backdrop-filter:blur(8px);animation:gt-in .25s ease}
@keyframes gt-in{from{opacity:0}to{opacity:1}}
#gta-tut .gt{position:relative;width:min(760px,100%);display:grid;grid-template-columns:220px 1fr;min-height:380px;background:linear-gradient(160deg,#1c0b2c 0%,#110619 100%);
  border:1px solid rgba(255,79,168,.38);box-shadow:0 30px 80px rgba(0,0,0,.55),0 0 50px rgba(255,46,147,.18);color:#fff;font:500 15px/1.5 Barlow,system-ui,sans-serif;overflow:hidden}
#gta-tut .art{position:relative;display:flex;align-items:center;justify-content:center;background:radial-gradient(120% 90% at 30% 20%,rgba(255,79,168,.45),transparent 60%),radial-gradient(110% 90% at 80% 90%,rgba(95,240,226,.35),transparent 60%),#160828}
#gta-tut .art svg{width:96px;height:96px;color:#fff;filter:drop-shadow(0 0 18px rgba(255,79,168,.8));animation:gt-pop .35s ease}
@keyframes gt-pop{from{transform:scale(.7);opacity:0}to{transform:none;opacity:1}}
#gta-tut .num{position:absolute;left:16px;top:14px;font:800 12px/1 Barlow,sans-serif;letter-spacing:.2em;color:rgba(255,255,255,.65)}
#gta-tut .body{display:flex;flex-direction:column;padding:28px 28px 22px}
#gta-tut h2{margin:0 0 8px;font:800 26px/1.1 Barlow,sans-serif;letter-spacing:.03em;text-transform:uppercase;background:linear-gradient(90deg,#ff4fa8,#ffb84f);-webkit-background-clip:text;background-clip:text;color:transparent}
#gta-tut p{margin:0 0 14px;color:#d9cfee}
#gta-tut ul{margin:0;padding:0;list-style:none;display:grid;gap:8px}
#gta-tut li{position:relative;padding-left:20px;color:#efe9fb}#gta-tut li::before{content:"";position:absolute;left:2px;top:.55em;width:8px;height:8px;background:#5ff0e2;box-shadow:0 0 8px #5ff0e2;transform:rotate(45deg)}
#gta-tut li b{color:#fff}#gta-tut code{font:600 12px/1.3 ui-monospace,Consolas,monospace;background:rgba(255,255,255,.08);padding:2px 5px;word-break:break-all}
#gta-tut .foot{margin-top:auto;padding-top:20px;display:flex;align-items:center;gap:10px}
#gta-tut .dots{display:flex;gap:6px;margin-right:auto}#gta-tut .dots i{width:8px;height:8px;background:rgba(255,255,255,.22);transition:all .2s}#gta-tut .dots i.on{width:22px;background:linear-gradient(90deg,#ff4fa8,#ff7a4f)}
#gta-tut button{border:0;cursor:pointer;font:800 13px/1 Barlow,sans-serif;letter-spacing:.12em;text-transform:uppercase;padding:12px 18px}
#gta-tut .skip{position:absolute;right:12px;top:10px;background:transparent;color:rgba(255,255,255,.55);padding:6px 8px;letter-spacing:.14em;font-size:11px}#gta-tut .skip:hover{color:#fff}
#gta-tut .bk{background:transparent;color:#d9cfee;border:1px solid rgba(255,255,255,.2)}#gta-tut .bk[hidden]{display:none}
#gta-tut .nx{background:linear-gradient(90deg,#ff4fa8,#ff7a4f);color:#fff;min-width:120px}#gta-tut .nx:hover,#gta-tut .bk:hover{filter:brightness(1.12)}
#gta-tut button:focus-visible{outline:2px solid #5ff0e2;outline-offset:2px}
@media (max-width:640px){#gta-tut .gt{grid-template-columns:1fr}#gta-tut .art{min-height:120px}#gta-tut .art svg{width:64px;height:64px}#gta-tut h2{font-size:22px}}`;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ls = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };

export function createTutorial({ getLang, api }) {
  const base = String(api || location.origin).replace(/\/+$/, '');
  let open = false, info = null;
  const L = () => T[getLang && getLang()] || T.en;   // pl / en / ru / es
  async function loadInfo() {
    if (info) return info;
    const get = async (p) => { try { const r = await fetch(base + p, { cache: 'no-store' }); return r.ok ? await r.json() : null; } catch { return null; } };
    const [ars, xs] = await Promise.all([get('/api/arsenal'), get('/api/xshare')]);
    info = { ars, xshare: !!(xs && xs.enabled), ca: (ars && ars.mint) || (xs && xs.ca) || '' };
    return info;
  }
  // slajd o coinie / Ekwipunku z ustawień serwera
  function coinSlide(t) {
    const a = info && info.ars;
    if (!a || !a.enabled) return [t.coinOffT, t.coinOffL, info && info.ca ? [t.coinCa.replace('{ca}', esc(info.ca))] : []];
    const tok = a.unit === 'token', hold = a.unit === 'hold', sym = esc(a.symbol || 'TOKEN'), u = tok || hold ? sym : 'SOL';
    const needs = Object.entries(a.need || {}).filter(([, n]) => +n > 0).sort((x, y) => x[1] - y[1]).slice(0, 3)
      .map(([g, n]) => t.coinNeed.replace('{gun}', GUN[g] || g).replace('{n}', String(+n)).replace('{u}', u));
    const list = [...(hold ? [t.coinHoldW, t.coinHoldS.replace('{sym}', sym)] : []), t.coinNone, ...needs, t.coinDrop];
    if ((tok || hold) && info.ca) list.push(t.coinCa.replace('{ca}', esc(info.ca)));
    if (hold) return [t.coinHoldT.replace('{sym}', sym), t.coinHoldL.replace(/\{sym\}/g, sym), list];   // portfel z tokenem albo SOL w grze po kursie
    return [(tok ? t.coinTokT : t.coinSolT).replace('{sym}', sym), (tok ? t.coinTokL : t.coinSolL).replace(/\{sym\}/g, sym), list];
  }
  async function show() {
    if (open) return; open = true;
    await loadInfo();
    if (!document.getElementById('gta-tut-css')) { const s = document.createElement('style'); s.id = 'gta-tut-css'; s.textContent = CSS; document.head.appendChild(s); }
    // Deathmatch: warunek posta na X (tylko gdy włączony w panelu admina) – jako drugi punkt slajdu
    const t = L(), slides = t.s.map((s) => s[0] === 'coin' ? ['coin', ...coinSlide(t)] : s[0] === 'dm' && info.xshare ? [s[0], s[1], s[2], [s[3][0], t.dmX, ...s[3].slice(1)]] : s);
    let i = 0;
    const w = document.createElement('div'); w.id = 'gta-tut'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true');
    document.body.appendChild(w);
    const close = () => { ls.set(KEY, '1'); open = false; removeEventListener('keydown', onKey, true); w.remove(); };
    const go = (d) => { const n = i + d; if (n >= slides.length) return close(); if (n < 0) return; i = n; render(); };
    function render() {
      const [ic, title, lead, list] = slides[i], last = i === slides.length - 1;
      w.innerHTML = `<div class="gt"><div class="art"><span class="num">${t.step.replace('{i}', i + 1).replace('{n}', slides.length)}</span>${ICON[ic] || ''}</div>
        <div class="body"><button type="button" class="skip">${esc(t.skip)}</button><h2>${esc(title)}</h2><p>${esc(lead)}</p>
          <ul>${(list || []).map((x) => `<li>${x}</li>`).join('')}</ul>
          <div class="foot"><div class="dots">${slides.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
            <button type="button" class="bk"${i ? '' : ' hidden'}>${esc(t.back)}</button><button type="button" class="nx">${esc(last ? t.go : t.next)}</button></div></div></div>`;
      w.querySelector('.skip').onclick = close; w.querySelector('.bk').onclick = () => go(-1); w.querySelector('.nx').onclick = () => go(1);
      w.querySelector('.nx').focus({ preventScroll: true });
    }
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') { e.stopPropagation(); e.preventDefault(); go(-1); }
    };
    addEventListener('keydown', onKey, true);
    w.addEventListener('click', (e) => { if (e.target === w) close(); });
    render();
  }
  // pierwsze wejście: po zniknięciu ekranu wczytywania, gdy widać lobby (nie na telefonie)
  function maybeShow() {
    if (ls.get(KEY) || window.__mobileGate) return;
    let n = 0;
    const tick = () => {
      const ld = document.getElementById('ld'), lb = document.getElementById('lb-ui');
      const ready = (!ld || ld.hidden) && lb && !lb.classList.contains('lb-hidden') && !document.querySelector('.lb-modal:not([hidden]),#bl-w:not([hidden]),#bl-x');   // żadne okno lobby nie jest otwarte
      if (ready) return setTimeout(show, 600);
      if (++n < 120) setTimeout(tick, 500);
    };
    tick();
  }
  return { show, maybeShow, label: () => L().menu };
}
