// Interfejs lobby: menu (☰), ustawienia (głośność, FOV, sterowanie, język), konto (logowanie / rejestracja),
// portfel na Solanie: kwoty w USD, płatność w SOL (TRYB TESTOWY – bez prawdziwych transakcji), stawki meczu i losowanie mapy.
// Konta i salda: baza danych artefaktu (claude.use("db")), a poza claude.ai – localStorage.

import { createSfx } from './sfx.js';
import { createWallet } from './wallet.js';
import { walletApi } from './wallet-config.js';
import { createProfile, paintAvatar } from './profile.js';
import { pointsFromHistory } from './earnings.js';
import { OPERATOR, LEGAL_TXT, legalDoc } from './legal.js';

// ---------------- tłumaczenia ----------------
const DICT = {
  pl: {
    'menu.settings': 'Ustawienia', 'menu.wallet': 'Portfel', 'menu.login': 'Zaloguj się', 'menu.account': 'Konto', 'menu.logout': 'Wyloguj', 'menu.admin': 'Panel admina',
    'top.guest': 'Gość', 'top.signin': 'Zaloguj się',
    'plate.ready': 'GOTOWY', 'plate.skin': 'KLIKNIJ, BY ZMIENIĆ SKIN',
    'mode.label': 'Tryb gry', 'mode.change': 'Zmień', 'mode.range.name': 'Strzelnica', 'mode.range.desc': 'Trening solo – zestrzel czerwone fasolki',
    'mode.1v1.name': '1v1', 'mode.1v1.desc': 'Pojedynek · do 3 wygranych rund · Oaza / Magazyn / Baza',
    'tag.range': 'SOLO', 'tag.1v1': '1 NA 1', 'soon': 'WKRÓTCE', 'soon.art': 'WKRÓTCE...',
    'cur.tag': 'USD · płatność w SOL', 'cur.in': 'w SOL', 'stake.label': 'Stawka', 'stake.custom': 'Własna', 'stake.win': 'Możliwa wygrana', 'stake.free': 'Trening – bez stawki', 'stake.range': 'Kwota $1–$1000', 'stake.invalid': 'Podaj stawkę od $1 do $1000',
    'play': 'GRAJ', 'play.login': 'ZALOGUJ SIĘ', 'picker.title': 'Wybierz tryb', 'done': 'Gotowe', 'skins.title': 'Skiny', 'close': 'Zamknij',
    'set.title': 'Ustawienia', 'set.general': 'Ogólne', 'set.audio': 'Dźwięk', 'set.controls': 'Sterowanie', 'set.lang': 'Język', 'set.volume': 'Głośność', 'set.fov': 'Pole widzenia (FOV)',
    'rg.tag': 'STRZELNICA', 'rg.title': 'USTAWIENIA TRENINGU', 'rg.hits': 'TRAFIONE', 'rg.acc': 'CELNOŚĆ', 'rg.zone': 'Zakres celów', 'rg.count': 'Fasolek naraz', 'rg.rate': 'Pojawianie się', 'rg.pace': 'Czas na trafienie', 'rg.moving': 'Ruchome cele', 'rg.sound': 'Dźwięk', 'rg.all': 'Wszystkie', 'rg.near': 'Blisko', 'rg.mid': 'Średnio', 'rg.far': 'Daleko', 'rg.rate.slow': 'Wolno', 'rg.rate.normal': 'Normalnie', 'rg.rate.fast': 'Szybko', 'rg.pace.slow': 'Długi', 'rg.pace.normal': 'Normalny', 'rg.pace.fast': 'Krótki', 'rg.yes': 'Tak', 'rg.no': 'Nie', 'rg.reset': 'Zeruj statystyki', 'rg.on': 'Trening: włączony', 'rg.off': 'Trening: wyłączony', 'rg.hint': 'Celuj w przycisk i kliknij  ·  Odwróć się do pola, żeby wrócić do strzelania',
    'set.bindHint': 'Kliknij akcję (albo klawisz na klawiaturze) i naciśnij nowy klawisz. Esc anuluje.', 'set.press': 'Naciśnij klawisz…', 'set.reset': 'Przywróć domyślne', 'set.mouse': 'Strzał: lewy przycisk myszy · Celowanie: prawy',
    'act.fwd': 'Do przodu', 'act.back': 'Do tyłu', 'act.left': 'W lewo', 'act.right': 'W prawo', 'act.sprint': 'Bieg', 'act.jump': 'Skok', 'act.crouch': 'Kucanie / slide',
    'act.reload': 'Przeładowanie', 'act.inspect': 'Oglądanie broni', 'act.prev': 'Poprzednia broń', 'act.view': 'Zmiana widoku', 'act.mute': 'Wycisz dźwięk',
    'auth.title': 'Konto', 'auth.login': 'Logowanie', 'auth.register': 'Rejestracja', 'auth.user': 'Nazwa użytkownika', 'auth.pass': 'Hasło', 'auth.pass2': 'Powtórz hasło',
    'auth.doLogin': 'Zaloguj się', 'auth.doRegister': 'Załóż konto', 'auth.userRule': '3–16 znaków: litery, cyfry, _', 'auth.passRule': 'Minimum 6 znaków',
    'auth.errUser': 'Nazwa: 3–16 znaków (litery, cyfry, _)', 'auth.errPass': 'Hasło musi mieć minimum 6 znaków', 'auth.errMatch': 'Hasła się różnią', 'auth.errExists': 'Ta nazwa jest już zajęta',
    'auth.errCreds': 'Nieprawidłowa nazwa lub hasło', 'auth.errDb': 'Baza danych jest niedostępna – spróbuj ponownie', 'auth.welcome': 'Zalogowano jako {u}', 'auth.created': 'Konto utworzone – witaj, {u}!',
    'auth.loggedAs': 'Zalogowano jako', 'auth.since': 'Konto od', 'auth.logout': 'Wyloguj się', 'auth.note': 'Wersja testowa: bez weryfikacji e-mail. Hasło jest haszowane (PBKDF2).',
    'w.title': 'Portfel', 'w.balance': 'Saldo', 'w.test': 'TRYB TESTOWY – środki są wirtualne, nie są wysyłane żadne prawdziwe transakcje.', 'w.network': 'Sieć Solana · kwoty w dolarach (USD), płatność w SOL po bieżącym kursie',
    'w.deposit': 'Wpłata', 'w.withdraw': 'Wypłata', 'w.history': 'Historia', 'w.amount': 'Kwota (USD)', 'w.address': 'Adres portfela Solana', 'w.doDeposit': 'Dodaj testowe środki', 'w.doWithdraw': 'Wypłać (test)',
    'w.depHint': 'W wersji docelowej tu pojawi się adres depozytu po podłączeniu backendu.', 'w.connect': 'Połącz Phantom', 'w.connected': 'Portfel', 'w.noPhantom': 'Nie wykryto portfela Phantom w tej przeglądarce',
    'w.rejected': 'Połączenie odrzucone', 'w.empty': 'Brak operacji', 'w.loginFirst': 'Zaloguj się, aby korzystać z portfela', 'w.errAmount': 'Podaj kwotę od $1 do $10 000', 'w.errFunds': 'Za mało środków',
    'w.errAddr': 'Nieprawidłowy adres Solana', 'w.depOk': 'Dodano ${a} (test)', 'w.wdOk': 'Wypłata ${a} zlecona (test)',
    'tx.deposit': 'Wpłata (test)', 'tx.withdraw': 'Wypłata (test)', 'tx.stake': 'Stawka 1v1', 'tx.win': 'Wygrana 1v1', 'tx.loss': 'Przegrana 1v1',
    'err.loginToPlay': 'Zaloguj się, aby grać o stawkę', 'err.funds': 'Za mało środków na stawkę – doładuj portfel', 'err.needServer': '1v1 wymaga połączenia z serwerem gry.', 'err.rematchFunds': 'Za mało środków na kolejny mecz',
    'draw.title': 'Losowanie mapy', 'draw.map': 'Mapa',
    'stake.fee': 'Prowizja (10%)', 'set.vMaster': 'Głośność ogólna', 'set.vMasterD': 'Wszystkie dźwięki', 'set.vMenu': 'Dźwięki w menu', 'set.vMenuD': 'Kliknięcia, okna, losowanie mapy', 'set.vGame': 'Dźwięki w grze', 'set.vGameD': 'Strzały, trafienia, przeładowanie', 'set.preview': 'Odsłuchaj', 'set.secView': 'Widok', 'set.secKeys': 'Klawisze', 'set.fovD': 'Szerszy kąt = więcej widać, mniejsze obiekty', 'tx.fee': 'prowizja {a}', 'set.reserved': 'Ten klawisz jest zarezerwowany (bronie 1–4 i Esc)', 'kb.move': 'Ruch', 'kb.fight': 'Walka', 'kb.sys': 'Inne', 'kb.lmb': 'LPM', 'kb.rmb': 'PPM', 'kb.mmb': 'Kółko', 'kb.fire': 'Strzał', 'kb.aim': 'Celowanie', 'kb.wheel': 'Zmiana broni', 'kb.weapons': 'Broń 1–4', 'kb.pause': 'Pauza', 'kb.alt': 'zapasowy',
  },
  en: {
    'menu.settings': 'Settings', 'menu.wallet': 'Wallet', 'menu.login': 'Log in', 'menu.account': 'Account', 'menu.logout': 'Log out', 'menu.admin': 'Admin panel',
    'top.guest': 'Guest', 'top.signin': 'Log in',
    'plate.ready': 'READY', 'plate.skin': 'CLICK TO CHANGE SKIN',
    'mode.label': 'Game mode', 'mode.change': 'Change', 'mode.range.name': 'Shooting range', 'mode.range.desc': 'Solo practice – shoot the red beans',
    'mode.1v1.name': '1v1', 'mode.1v1.desc': 'Duel · first to 3 rounds · Oasis / Warehouse / Base',
    'tag.range': 'SOLO', 'tag.1v1': '1 VS 1', 'soon': 'SOON', 'soon.art': 'COMING SOON...',
    'cur.tag': 'USD · paid in SOL', 'cur.in': 'in SOL', 'stake.label': 'Stake', 'stake.custom': 'Custom', 'stake.win': 'Potential win', 'stake.free': 'Practice – no stake', 'stake.range': 'Amount $1–$1000', 'stake.invalid': 'Enter a stake between $1 and $1000',
    'play': 'PLAY', 'play.login': 'LOG IN', 'picker.title': 'Choose mode', 'done': 'Done', 'skins.title': 'Skins', 'close': 'Close',
    'set.title': 'Settings', 'set.general': 'General', 'set.audio': 'Audio', 'set.controls': 'Controls', 'set.lang': 'Language', 'set.volume': 'Volume', 'set.fov': 'Field of view (FOV)',
    'rg.tag': 'RANGE', 'rg.title': 'TRAINING SETTINGS', 'rg.hits': 'HITS', 'rg.acc': 'ACCURACY', 'rg.zone': 'Target range', 'rg.count': 'Beans at once', 'rg.rate': 'Spawn rate', 'rg.pace': 'Time to hit', 'rg.moving': 'Moving targets', 'rg.sound': 'Sound', 'rg.all': 'All', 'rg.near': 'Close', 'rg.mid': 'Medium', 'rg.far': 'Far', 'rg.rate.slow': 'Slow', 'rg.rate.normal': 'Normal', 'rg.rate.fast': 'Fast', 'rg.pace.slow': 'Long', 'rg.pace.normal': 'Normal', 'rg.pace.fast': 'Short', 'rg.yes': 'Yes', 'rg.no': 'No', 'rg.reset': 'Reset stats', 'rg.on': 'Training: on', 'rg.off': 'Training: off', 'rg.hint': 'Aim at a button and click  ·  Turn back to the range to keep shooting',
    'set.bindHint': 'Click an action (or a key on the keyboard) and press a new key. Esc cancels.', 'set.press': 'Press a key…', 'set.reset': 'Restore defaults', 'set.mouse': 'Fire: left mouse button · Aim: right',
    'act.fwd': 'Forward', 'act.back': 'Back', 'act.left': 'Left', 'act.right': 'Right', 'act.sprint': 'Sprint', 'act.jump': 'Jump', 'act.crouch': 'Crouch / slide',
    'act.reload': 'Reload', 'act.inspect': 'Inspect weapon', 'act.prev': 'Previous weapon', 'act.view': 'Change view', 'act.mute': 'Mute sound',
    'auth.title': 'Account', 'auth.login': 'Log in', 'auth.register': 'Sign up', 'auth.user': 'Username', 'auth.pass': 'Password', 'auth.pass2': 'Repeat password',
    'auth.doLogin': 'Log in', 'auth.doRegister': 'Create account', 'auth.userRule': '3–16 characters: letters, digits, _', 'auth.passRule': 'At least 6 characters',
    'auth.errUser': 'Username: 3–16 characters (letters, digits, _)', 'auth.errPass': 'Password must be at least 6 characters', 'auth.errMatch': 'Passwords do not match', 'auth.errExists': 'This username is taken',
    'auth.errCreds': 'Wrong username or password', 'auth.errDb': 'Database unavailable – try again', 'auth.welcome': 'Logged in as {u}', 'auth.created': 'Account created – welcome, {u}!',
    'auth.loggedAs': 'Logged in as', 'auth.since': 'Member since', 'auth.logout': 'Log out', 'auth.note': 'Test version: no e-mail verification. Passwords are hashed (PBKDF2).',
    'w.title': 'Wallet', 'w.balance': 'Balance', 'w.test': 'TEST MODE – funds are virtual, no real transactions are sent.', 'w.network': 'Solana network · amounts in US dollars (USD), paid in SOL at the current rate',
    'w.deposit': 'Deposit', 'w.withdraw': 'Withdraw', 'w.history': 'History', 'w.amount': 'Amount (USD)', 'w.address': 'Solana wallet address', 'w.doDeposit': 'Add test funds', 'w.doWithdraw': 'Withdraw (test)',
    'w.depHint': 'In production a deposit address will appear here once the backend is connected.', 'w.connect': 'Connect Phantom', 'w.connected': 'Wallet', 'w.noPhantom': 'Phantom wallet not detected in this browser',
    'w.rejected': 'Connection rejected', 'w.empty': 'No transactions', 'w.loginFirst': 'Log in to use the wallet', 'w.errAmount': 'Enter an amount between $1 and $10,000', 'w.errFunds': 'Insufficient funds',
    'w.errAddr': 'Invalid Solana address', 'w.depOk': 'Added ${a} (test)', 'w.wdOk': 'Withdrawal of ${a} requested (test)',
    'tx.deposit': 'Deposit (test)', 'tx.withdraw': 'Withdrawal (test)', 'tx.stake': '1v1 stake', 'tx.win': '1v1 win', 'tx.loss': '1v1 loss',
    'err.loginToPlay': 'Log in to play for a stake', 'err.funds': 'Not enough funds for this stake – top up your wallet', 'err.needServer': '1v1 needs a connection to the game server.', 'err.rematchFunds': 'Not enough funds for another match',
    'draw.title': 'Map draw', 'draw.map': 'Map',
    'stake.fee': 'House fee (10%)', 'set.vMaster': 'Master volume', 'set.vMasterD': 'All sounds', 'set.vMenu': 'Menu sounds', 'set.vMenuD': 'Clicks, windows, map draw', 'set.vGame': 'Game sounds', 'set.vGameD': 'Shots, hits, reloads', 'set.preview': 'Preview', 'set.secView': 'View', 'set.secKeys': 'Keys', 'set.fovD': 'Wider angle = see more, smaller objects', 'tx.fee': 'fee {a}', 'set.reserved': 'This key is reserved (weapons 1–4 and Esc)', 'kb.move': 'Movement', 'kb.fight': 'Combat', 'kb.sys': 'Other', 'kb.lmb': 'LMB', 'kb.rmb': 'RMB', 'kb.mmb': 'Wheel', 'kb.fire': 'Fire', 'kb.aim': 'Aim', 'kb.wheel': 'Switch weapon', 'kb.weapons': 'Weapon 1–4', 'kb.pause': 'Pause', 'kb.alt': 'alternate',
  },
  ru: {
    'menu.settings': 'Настройки', 'menu.wallet': 'Кошелёк', 'menu.login': 'Войти', 'menu.account': 'Аккаунт', 'menu.logout': 'Выйти', 'menu.admin': 'Админ-панель',
    'top.guest': 'Гость', 'top.signin': 'Войти',
    'plate.ready': 'ГОТОВ', 'plate.skin': 'НАЖМИ, ЧТОБЫ СМЕНИТЬ СКИН',
    'mode.label': 'Режим игры', 'mode.change': 'Сменить', 'mode.range.name': 'Стрельбище', 'mode.range.desc': 'Соло-тренировка – сбей красные фасолины',
    'mode.1v1.name': '1v1', 'mode.1v1.desc': 'Дуэль · до 3 выигранных раундов · Оазис / Склад / База',
    'tag.range': 'СОЛО', 'tag.1v1': '1 НА 1', 'soon': 'СКОРО', 'soon.art': 'СКОРО...',
    'cur.tag': 'USD · оплата в SOL', 'cur.in': 'в SOL', 'stake.label': 'Ставка', 'stake.custom': 'Своя', 'stake.win': 'Возможный выигрыш', 'stake.free': 'Тренировка – без ставки', 'stake.range': 'Сумма $1–$1000', 'stake.invalid': 'Введите ставку от $1 до $1000',
    'play': 'ИГРАТЬ', 'play.login': 'ВОЙТИ', 'picker.title': 'Выбери режим', 'done': 'Готово', 'skins.title': 'Скины', 'close': 'Закрыть',
    'set.title': 'Настройки', 'set.general': 'Общие', 'set.audio': 'Звук', 'set.controls': 'Управление', 'set.lang': 'Язык', 'set.volume': 'Громкость', 'set.fov': 'Поле зрения (FOV)',
    'rg.tag': 'СТРЕЛЬБИЩЕ', 'rg.title': 'НАСТРОЙКИ ТРЕНИРОВКИ', 'rg.hits': 'ПОПАДАНИЯ', 'rg.acc': 'ТОЧНОСТЬ', 'rg.zone': 'Дальность целей', 'rg.count': 'Фасолин сразу', 'rg.rate': 'Появление', 'rg.pace': 'Время на попадание', 'rg.moving': 'Движущиеся цели', 'rg.sound': 'Звук', 'rg.all': 'Все', 'rg.near': 'Близко', 'rg.mid': 'Средне', 'rg.far': 'Далеко', 'rg.rate.slow': 'Медленно', 'rg.rate.normal': 'Обычно', 'rg.rate.fast': 'Быстро', 'rg.pace.slow': 'Долго', 'rg.pace.normal': 'Обычно', 'rg.pace.fast': 'Коротко', 'rg.yes': 'Да', 'rg.no': 'Нет', 'rg.reset': 'Сбросить статистику', 'rg.on': 'Тренировка: вкл.', 'rg.off': 'Тренировка: выкл.', 'rg.hint': 'Наведи на кнопку и кликни  ·  Развернись к полю, чтобы продолжить стрельбу',
    'set.bindHint': 'Нажми на действие (или клавишу на схеме) и выбери новую клавишу. Esc – отмена.', 'set.press': 'Нажми клавишу…', 'set.reset': 'Сбросить', 'set.mouse': 'Выстрел: левая кнопка мыши · Прицел: правая',
    'act.fwd': 'Вперёд', 'act.back': 'Назад', 'act.left': 'Влево', 'act.right': 'Вправо', 'act.sprint': 'Бег', 'act.jump': 'Прыжок', 'act.crouch': 'Присед / подкат',
    'act.reload': 'Перезарядка', 'act.inspect': 'Осмотр оружия', 'act.prev': 'Предыдущее оружие', 'act.view': 'Смена вида', 'act.mute': 'Выключить звук',
    'auth.title': 'Аккаунт', 'auth.login': 'Вход', 'auth.register': 'Регистрация', 'auth.user': 'Имя пользователя', 'auth.pass': 'Пароль', 'auth.pass2': 'Повтори пароль',
    'auth.doLogin': 'Войти', 'auth.doRegister': 'Создать аккаунт', 'auth.userRule': '3–16 символов: буквы, цифры, _', 'auth.passRule': 'Минимум 6 символов',
    'auth.errUser': 'Имя: 3–16 символов (буквы, цифры, _)', 'auth.errPass': 'Пароль – минимум 6 символов', 'auth.errMatch': 'Пароли не совпадают', 'auth.errExists': 'Это имя уже занято',
    'auth.errCreds': 'Неверное имя или пароль', 'auth.errDb': 'База данных недоступна – попробуй ещё раз', 'auth.welcome': 'Вход выполнен: {u}', 'auth.created': 'Аккаунт создан – привет, {u}!',
    'auth.loggedAs': 'Вы вошли как', 'auth.since': 'Аккаунт с', 'auth.logout': 'Выйти', 'auth.note': 'Тестовая версия: без подтверждения e-mail. Пароль хешируется (PBKDF2).',
    'w.title': 'Кошелёк', 'w.balance': 'Баланс', 'w.test': 'ТЕСТОВЫЙ РЕЖИМ – средства виртуальные, реальные транзакции не отправляются.', 'w.network': 'Сеть Solana · суммы в долларах (USD), оплата в SOL по текущему курсу',
    'w.deposit': 'Пополнение', 'w.withdraw': 'Вывод', 'w.history': 'История', 'w.amount': 'Сумма (USD)', 'w.address': 'Адрес кошелька Solana', 'w.doDeposit': 'Добавить тестовые средства', 'w.doWithdraw': 'Вывести (тест)',
    'w.depHint': 'В рабочей версии здесь появится адрес для пополнения после подключения бэкенда.', 'w.connect': 'Подключить Phantom', 'w.connected': 'Кошелёк', 'w.noPhantom': 'Кошелёк Phantom не найден в этом браузере',
    'w.rejected': 'Подключение отклонено', 'w.empty': 'Операций нет', 'w.loginFirst': 'Войди, чтобы пользоваться кошельком', 'w.errAmount': 'Введите сумму от $1 до $10 000', 'w.errFunds': 'Недостаточно средств',
    'w.errAddr': 'Неверный адрес Solana', 'w.depOk': 'Добавлено ${a} (тест)', 'w.wdOk': 'Вывод ${a} оформлен (тест)',
    'tx.deposit': 'Пополнение (тест)', 'tx.withdraw': 'Вывод (тест)', 'tx.stake': 'Ставка 1v1', 'tx.win': 'Победа 1v1', 'tx.loss': 'Поражение 1v1',
    'err.loginToPlay': 'Войди, чтобы играть на ставку', 'err.funds': 'Недостаточно средств для ставки – пополни кошелёк', 'err.needServer': 'Для 1v1 нужно подключение к игровому серверу.', 'err.rematchFunds': 'Недостаточно средств для следующего матча',
    'draw.title': 'Выбор карты', 'draw.map': 'Карта',
    'stake.fee': 'Комиссия (10%)', 'set.vMaster': 'Общая громкость', 'set.vMasterD': 'Все звуки', 'set.vMenu': 'Звуки меню', 'set.vMenuD': 'Клики, окна, выбор карты', 'set.vGame': 'Звуки в игре', 'set.vGameD': 'Выстрелы, попадания, перезарядка', 'set.preview': 'Прослушать', 'set.secView': 'Обзор', 'set.secKeys': 'Клавиши', 'set.fovD': 'Шире угол – больше видно, объекты меньше', 'tx.fee': 'комиссия {a}', 'set.reserved': 'Эта клавиша зарезервирована (оружие 1–4 и Esc)', 'kb.move': 'Движение', 'kb.fight': 'Бой', 'kb.sys': 'Прочее', 'kb.lmb': 'ЛКМ', 'kb.rmb': 'ПКМ', 'kb.mmb': 'Колесо', 'kb.fire': 'Выстрел', 'kb.aim': 'Прицел', 'kb.wheel': 'Смена оружия', 'kb.weapons': 'Оружие 1–4', 'kb.pause': 'Пауза', 'kb.alt': 'запасная',
  },
  es: {
    'menu.settings': 'Ajustes', 'menu.wallet': 'Cartera', 'menu.login': 'Iniciar sesión', 'menu.account': 'Cuenta', 'menu.logout': 'Cerrar sesión', 'menu.admin': 'Panel de admin',
    'top.guest': 'Invitado', 'top.signin': 'Iniciar sesión',
    'plate.ready': 'LISTO', 'plate.skin': 'HAZ CLIC PARA CAMBIAR DE SKIN',
    'mode.label': 'Modo de juego', 'mode.change': 'Cambiar', 'mode.range.name': 'Campo de tiro', 'mode.range.desc': 'Práctica en solitario – dispara a las judías rojas',
    'mode.1v1.name': '1v1', 'mode.1v1.desc': 'Duelo · a 3 rondas ganadas · Oasis / Almacén / Base',
    'tag.range': 'SOLO', 'tag.1v1': '1 VS 1', 'soon': 'PRONTO', 'soon.art': 'MUY PRONTO...',
    'cur.tag': 'USD · pago en SOL', 'cur.in': 'en SOL', 'stake.label': 'Apuesta', 'stake.custom': 'Otra', 'stake.win': 'Ganancia posible', 'stake.free': 'Práctica – sin apuesta', 'stake.range': 'Importe $1–$1000', 'stake.invalid': 'Introduce una apuesta entre $1 y $1000',
    'play': 'JUGAR', 'play.login': 'ACCEDER', 'picker.title': 'Elige modo', 'done': 'Listo', 'skins.title': 'Skins', 'close': 'Cerrar',
    'set.title': 'Ajustes', 'set.general': 'General', 'set.audio': 'Sonido', 'set.controls': 'Controles', 'set.lang': 'Idioma', 'set.volume': 'Volumen', 'set.fov': 'Campo de visión (FOV)',
    'rg.tag': 'POLÍGONO', 'rg.title': 'AJUSTES DE ENTRENAMIENTO', 'rg.hits': 'ACIERTOS', 'rg.acc': 'PRECISIÓN', 'rg.zone': 'Alcance de objetivos', 'rg.count': 'Alubias a la vez', 'rg.rate': 'Aparición', 'rg.pace': 'Tiempo para acertar', 'rg.moving': 'Objetivos móviles', 'rg.sound': 'Sonido', 'rg.all': 'Todos', 'rg.near': 'Cerca', 'rg.mid': 'Medio', 'rg.far': 'Lejos', 'rg.rate.slow': 'Lento', 'rg.rate.normal': 'Normal', 'rg.rate.fast': 'Rápido', 'rg.pace.slow': 'Largo', 'rg.pace.normal': 'Normal', 'rg.pace.fast': 'Corto', 'rg.yes': 'Sí', 'rg.no': 'No', 'rg.reset': 'Reiniciar estadísticas', 'rg.on': 'Entrenamiento: activo', 'rg.off': 'Entrenamiento: inactivo', 'rg.hint': 'Apunta a un botón y haz clic  ·  Gírate hacia el campo para volver a disparar',
    'set.bindHint': 'Haz clic en una acción (o en una tecla del teclado) y pulsa una tecla nueva. Esc cancela.', 'set.press': 'Pulsa una tecla…', 'set.reset': 'Restablecer', 'set.mouse': 'Disparo: botón izquierdo · Apuntar: derecho',
    'act.fwd': 'Adelante', 'act.back': 'Atrás', 'act.left': 'Izquierda', 'act.right': 'Derecha', 'act.sprint': 'Correr', 'act.jump': 'Saltar', 'act.crouch': 'Agacharse / deslizar',
    'act.reload': 'Recargar', 'act.inspect': 'Inspeccionar arma', 'act.prev': 'Arma anterior', 'act.view': 'Cambiar vista', 'act.mute': 'Silenciar',
    'auth.title': 'Cuenta', 'auth.login': 'Iniciar sesión', 'auth.register': 'Registro', 'auth.user': 'Nombre de usuario', 'auth.pass': 'Contraseña', 'auth.pass2': 'Repite la contraseña',
    'auth.doLogin': 'Entrar', 'auth.doRegister': 'Crear cuenta', 'auth.userRule': '3–16 caracteres: letras, números, _', 'auth.passRule': 'Mínimo 6 caracteres',
    'auth.errUser': 'Nombre: 3–16 caracteres (letras, números, _)', 'auth.errPass': 'La contraseña debe tener al menos 6 caracteres', 'auth.errMatch': 'Las contraseñas no coinciden', 'auth.errExists': 'Ese nombre ya está en uso',
    'auth.errCreds': 'Usuario o contraseña incorrectos', 'auth.errDb': 'Base de datos no disponible – inténtalo de nuevo', 'auth.welcome': 'Sesión iniciada como {u}', 'auth.created': 'Cuenta creada – ¡bienvenido, {u}!',
    'auth.loggedAs': 'Sesión iniciada como', 'auth.since': 'Miembro desde', 'auth.logout': 'Cerrar sesión', 'auth.note': 'Versión de prueba: sin verificación de e-mail. La contraseña se guarda con hash (PBKDF2).',
    'w.title': 'Cartera', 'w.balance': 'Saldo', 'w.test': 'MODO DE PRUEBA – los fondos son virtuales, no se envían transacciones reales.', 'w.network': 'Red Solana · importes en dólares (USD), pago en SOL al cambio actual',
    'w.deposit': 'Depósito', 'w.withdraw': 'Retiro', 'w.history': 'Historial', 'w.amount': 'Importe (USD)', 'w.address': 'Dirección de cartera Solana', 'w.doDeposit': 'Añadir fondos de prueba', 'w.doWithdraw': 'Retirar (prueba)',
    'w.depHint': 'En la versión final aquí aparecerá la dirección de depósito al conectar el backend.', 'w.connect': 'Conectar Phantom', 'w.connected': 'Cartera', 'w.noPhantom': 'No se detectó Phantom en este navegador',
    'w.rejected': 'Conexión rechazada', 'w.empty': 'Sin operaciones', 'w.loginFirst': 'Inicia sesión para usar la cartera', 'w.errAmount': 'Introduce un importe entre $1 y $10 000', 'w.errFunds': 'Fondos insuficientes',
    'w.errAddr': 'Dirección de Solana no válida', 'w.depOk': 'Añadidos ${a} (prueba)', 'w.wdOk': 'Retiro de ${a} solicitado (prueba)',
    'tx.deposit': 'Depósito (prueba)', 'tx.withdraw': 'Retiro (prueba)', 'tx.stake': 'Apuesta 1v1', 'tx.win': 'Victoria 1v1', 'tx.loss': 'Derrota 1v1',
    'err.loginToPlay': 'Inicia sesión para jugar con apuesta', 'err.funds': 'Fondos insuficientes para la apuesta – recarga la cartera', 'err.needServer': 'El 1v1 necesita conexión con el servidor del juego.', 'err.rematchFunds': 'Fondos insuficientes para otra partida',
    'draw.title': 'Sorteo del mapa', 'draw.map': 'Mapa',
    'stake.fee': 'Comisión (10%)', 'set.vMaster': 'Volumen general', 'set.vMasterD': 'Todos los sonidos', 'set.vMenu': 'Sonidos del menú', 'set.vMenuD': 'Clics, ventanas, sorteo del mapa', 'set.vGame': 'Sonidos del juego', 'set.vGameD': 'Disparos, impactos, recargas', 'set.preview': 'Escuchar', 'set.secView': 'Vista', 'set.secKeys': 'Teclas', 'set.fovD': 'Más ángulo = ves más, objetos más pequeños', 'tx.fee': 'comisión {a}', 'set.reserved': 'Esta tecla está reservada (armas 1–4 y Esc)', 'kb.move': 'Movimiento', 'kb.fight': 'Combate', 'kb.sys': 'Otros', 'kb.lmb': 'Clic izq.', 'kb.rmb': 'Clic der.', 'kb.mmb': 'Rueda', 'kb.fire': 'Disparo', 'kb.aim': 'Apuntar', 'kb.wheel': 'Cambiar arma', 'kb.weapons': 'Arma 1–4', 'kb.pause': 'Pausa', 'kb.alt': 'alternativa',
  },
};
const SKIN_NAMES = {
  en: { klasyk: 'Classic', kamuflaz: 'Camo', pustynia: 'Desert', arbuz: 'Watermelon', truskawka: 'Strawberry', jagoda: 'Blueberry', mieta: 'Mint', wegiel: 'Coal', lawa: 'Lava', zlota: 'Golden', teczowa: 'Rainbow', arktyka: 'Arctic' },
  ru: { klasyk: 'Классика', kamuflaz: 'Камуфляж', pustynia: 'Пустыня', arbuz: 'Арбуз', truskawka: 'Клубника', jagoda: 'Черника', mieta: 'Мята', wegiel: 'Уголь', lawa: 'Лава', zlota: 'Золотая', teczowa: 'Радуга', arktyka: 'Арктика' },
  es: { klasyk: 'Clásica', kamuflaz: 'Camuflaje', pustynia: 'Desierto', arbuz: 'Sandía', truskawka: 'Fresa', jagoda: 'Arándano', mieta: 'Menta', wegiel: 'Carbón', lawa: 'Lava', zlota: 'Dorada', teczowa: 'Arcoíris', arktyka: 'Ártico' },
};
export const LANGS = [{ id: 'pl', name: 'Polski' }, { id: 'en', name: 'English' }, { id: 'ru', name: 'Русский' }, { id: 'es', name: 'Español' }];
const FLAGS = {
  pl: '<svg viewBox="0 0 30 20"><rect width="30" height="10" fill="#fff"/><rect y="10" width="30" height="10" fill="#dc143c"/></svg>',
  en: '<svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice"><clipPath id="lbuk1"><path d="M0 0v30h60V0z"/></clipPath><clipPath id="lbuk2"><path d="M30 15h30v15zv15H0zH0V0zV0h30z"/></clipPath><g clip-path="url(#lbuk1)"><path d="M0 0v30h60V0z" fill="#012169"/><path d="M0 0l60 30m0-30L0 30" stroke="#fff" stroke-width="6"/><path d="M0 0l60 30m0-30L0 30" clip-path="url(#lbuk2)" stroke="#c8102e" stroke-width="4"/><path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10"/><path d="M30 0v30M0 15h60" stroke="#c8102e" stroke-width="6"/></g></svg>',
  ru: '<svg viewBox="0 0 30 20"><rect width="30" height="7" fill="#fff"/><rect y="6.67" width="30" height="6.67" fill="#0039a6"/><rect y="13.33" width="30" height="6.67" fill="#d52b1e"/></svg>',
  es: '<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#aa151b"/><rect y="5" width="30" height="10" fill="#f1bf00"/><rect x="7" y="7.2" width="3.4" height="5.6" rx=".9" fill="#aa151b" opacity=".85"/></svg>',
};
let LANG = 'en';
for (const l in LEGAL_TXT) if (DICT[l]) DICT[l]['set.biz'] = LEGAL_TXT[l].tab;
// czułość myszy i czułość przy celowaniu (zakładka Sterowanie)
const SENS_TXT = {
  pl: { 'set.secMouse': 'Mysz', 'set.sens': 'Czułość myszy', 'set.sensD': 'Jak szybko obraca się kamera', 'set.sensAds': 'Czułość przy celowaniu', 'set.sensAdsD': 'Gdy celujesz przez celownik (prawy przycisk myszy)' },
  en: { 'set.secMouse': 'Mouse', 'set.sens': 'Mouse sensitivity', 'set.sensD': 'How fast the camera turns', 'set.sensAds': 'Aim sensitivity', 'set.sensAdsD': 'While aiming down sights (right mouse button)' },
  ru: { 'set.secMouse': 'Мышь', 'set.sens': 'Чувствительность мыши', 'set.sensD': 'Скорость поворота камеры', 'set.sensAds': 'Чувствительность в прицеле', 'set.sensAdsD': 'При прицеливании (правая кнопка мыши)' },
  es: { 'set.secMouse': 'Ratón', 'set.sens': 'Sensibilidad del ratón', 'set.sensD': 'Velocidad de giro de la cámara', 'set.sensAds': 'Sensibilidad al apuntar', 'set.sensAdsD': 'Al apuntar con la mira (botón derecho)' },
};
for (const l in SENS_TXT) if (DICT[l]) Object.assign(DICT[l], SENS_TXT[l]);
// okno logowania / rejestracji
export const AUTH_TXT = {
  pl: { 'auth.tag': 'Strzelanka FPS o prawdziwe pieniądze', 'auth.f1': 'Pojedynki 1v1 do 3 wygranych rund', 'auth.f2': 'Własny portfel Solana i wypłaty na dowolny adres', 'auth.f3': 'Wejdź do gry w kilka sekund',
    'auth.hiLogin': 'Witaj z powrotem', 'auth.subLogin': 'Zaloguj się, aby grać o stawkę i odbierać wygrane.', 'auth.hiReg': 'Dołącz do gry', 'auth.subReg': 'Załóż konto w kilka sekund – dostaniesz własny portfel SOL.',
    'auth.google': 'Kontynuuj z Google', 'auth.or': 'lub', 'auth.show': 'Pokaż hasło', 'auth.noAcc': 'Nie masz konta?', 'auth.haveAcc': 'Masz już konto?',
    'auth.terms': 'Mam ukończone 18 lat i akceptuję {t} oraz {p}.', 'auth.termsT': 'Regulamin', 'auth.termsP': 'Politykę prywatności', 'auth.errTerms': 'Zaznacz, że masz 18 lat i akceptujesz regulamin.',
    'auth.googleOff': 'Logowanie przez Google działa, gdy gra jest połączona z serwerem.', 'auth.googleErr': 'Nie udało się zalogować przez Google.', 'auth.pw1': 'Słabe', 'auth.pw2': 'Średnie', 'auth.pw3': 'Dobre', 'auth.pw4': 'Mocne' },
  en: { 'auth.tag': 'FPS shooter with real money stakes', 'auth.f1': '1v1 duels, first to 3 rounds', 'auth.f2': 'Your own Solana wallet, withdraw to any address', 'auth.f3': 'Jump into a match in seconds',
    'auth.hiLogin': 'Welcome back', 'auth.subLogin': 'Log in to play for stakes and collect your winnings.', 'auth.hiReg': 'Join the game', 'auth.subReg': 'Create an account in seconds – you get your own SOL wallet.',
    'auth.google': 'Continue with Google', 'auth.or': 'or', 'auth.show': 'Show password', 'auth.noAcc': 'No account yet?', 'auth.haveAcc': 'Already have an account?',
    'auth.terms': 'I am 18 or older and accept the {t} and the {p}.', 'auth.termsT': 'Terms of Service', 'auth.termsP': 'Privacy Policy', 'auth.errTerms': 'Confirm that you are 18+ and accept the terms.',
    'auth.googleOff': 'Google sign-in works when the game is connected to its server.', 'auth.googleErr': 'Google sign-in failed.', 'auth.pw1': 'Weak', 'auth.pw2': 'Fair', 'auth.pw3': 'Good', 'auth.pw4': 'Strong' },
  ru: { 'auth.tag': 'FPS-шутер на реальные деньги', 'auth.f1': 'Дуэли 1 на 1 до 3 побед', 'auth.f2': 'Свой кошелёк Solana и вывод на любой адрес', 'auth.f3': 'В игру за несколько секунд',
    'auth.hiLogin': 'С возвращением', 'auth.subLogin': 'Войди, чтобы играть на ставки и получать выигрыши.', 'auth.hiReg': 'Присоединяйся', 'auth.subReg': 'Создай аккаунт за пару секунд – получишь свой кошелёк SOL.',
    'auth.google': 'Продолжить с Google', 'auth.or': 'или', 'auth.show': 'Показать пароль', 'auth.noAcc': 'Нет аккаунта?', 'auth.haveAcc': 'Уже есть аккаунт?',
    'auth.terms': 'Мне есть 18 лет, и я принимаю {t} и {p}.', 'auth.termsT': 'Условия использования', 'auth.termsP': 'Политику конфиденциальности', 'auth.errTerms': 'Подтверди, что тебе 18+ и ты принимаешь условия.',
    'auth.googleOff': 'Вход через Google работает, когда игра подключена к серверу.', 'auth.googleErr': 'Не удалось войти через Google.', 'auth.pw1': 'Слабый', 'auth.pw2': 'Средний', 'auth.pw3': 'Хороший', 'auth.pw4': 'Сильный' },
  es: { 'auth.tag': 'Shooter FPS con apuestas de dinero real', 'auth.f1': 'Duelos 1v1 al mejor de 3 rondas', 'auth.f2': 'Tu propia cartera Solana y retiros a cualquier dirección', 'auth.f3': 'Entra a jugar en segundos',
    'auth.hiLogin': 'Bienvenido de nuevo', 'auth.subLogin': 'Inicia sesión para jugar con apuestas y cobrar tus ganancias.', 'auth.hiReg': 'Únete al juego', 'auth.subReg': 'Crea una cuenta en segundos – recibes tu propia cartera SOL.',
    'auth.google': 'Continuar con Google', 'auth.or': 'o', 'auth.show': 'Mostrar contraseña', 'auth.noAcc': '¿No tienes cuenta?', 'auth.haveAcc': '¿Ya tienes cuenta?',
    'auth.terms': 'Tengo 18 años o más y acepto los {t} y la {p}.', 'auth.termsT': 'Términos del servicio', 'auth.termsP': 'Política de privacidad', 'auth.errTerms': 'Confirma que tienes 18+ y aceptas los términos.',
    'auth.googleOff': 'El inicio con Google funciona cuando el juego está conectado al servidor.', 'auth.googleErr': 'No se pudo iniciar sesión con Google.', 'auth.pw1': 'Débil', 'auth.pw2': 'Regular', 'auth.pw3': 'Buena', 'auth.pw4': 'Fuerte' },
};
for (const l in AUTH_TXT) if (DICT[l]) Object.assign(DICT[l], AUTH_TXT[l]);   // zakładka Business w ustawieniach
export function t(key, vars) { let s = (DICT[LANG] && DICT[LANG][key]) ?? DICT.pl[key] ?? key; if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]); return s; }
export function skinName(sk) { return (SKIN_NAMES[LANG] && SKIN_NAMES[LANG][sk.id]) || sk.name; }

// ---------------- sterowanie ----------------
export const ACTIONS = [
  ['fwd', 'KeyW'], ['back', 'KeyS'], ['left', 'KeyA'], ['right', 'KeyD'], ['sprint', 'ShiftLeft'], ['jump', 'Space'], ['crouch', 'KeyC'],
  ['reload', 'KeyR'], ['inspect', 'KeyF'], ['prev', 'KeyQ'], ['view', 'KeyV'], ['mute', 'KeyM'],
];
const keyLabel = c => ({ Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'R-Shift', ControlLeft: 'Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'Alt', AltRight: 'R-Alt', Tab: 'Tab', CapsLock: 'Caps',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'Enter', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\' }[c]
  || c.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num '));

// ---------------- pamięć ----------------
const ls = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} }, del(k) { try { localStorage.removeItem(k); } catch {} } };
const dbP = (typeof window !== 'undefined' && window.claude && typeof window.claude.use === 'function') ? window.claude.use('db').catch(() => null) : Promise.resolve(null);
// konto: najpierw baza danych artefaktu, a gdy jest niedostępna (np. strona poza claude.ai) – pamięć przeglądarki
async function accGet(id) {
  const db = await dbP;
  if (db) { try { const s = await db.doc('accounts/' + id).get(); if (s.exists) return JSON.parse(JSON.stringify(s.data())); } catch {} }
  const v = ls.get('fasolka-acc:' + id); return v ? JSON.parse(v) : null;
}
async function accSet(id, data) {
  const db = await dbP;
  if (db) {
    for (let i = 0; i < 2; i++) {
      try { await db.doc('accounts/' + id).set(data); return; }
      catch (e) { if (!e || e.code !== 'unavailable') break; await new Promise(r => setTimeout(r, 300 + Math.random() * 500)); }
    }
  }
  ls.set('fasolka-acc:' + id, JSON.stringify(data));
}
const b64e = u8 => btoa(String.fromCharCode(...u8)), b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function hashPw(pw, saltB64) {
  const salt = saltB64 ? b64d(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, key, 256);
  return { salt: b64e(salt), hash: b64e(new Uint8Array(bits)) };
}
const usd = v => '$' + money(v);   // kwoty w dolarach, płatność w SOL
const STAT_KEYS = ['matches', 'wins', 'losses', 'staked', 'won', 'fees', 'deposits', 'withdrawn', 'shots', 'hits', 'heads', 'kills', 'deaths', 'lastActive'];
// statystyki konta; starsze konta bez statystyk dostają je wyliczone z historii
export function ensureStats(a) {
  if (a.stats && typeof a.stats === 'object') { for (const k of STAT_KEYS) if (typeof a.stats[k] !== 'number') a.stats[k] = 0; return a.stats; }
  const st = Object.fromEntries(STAT_KEYS.map(k => [k, 0]));
  for (const h of a.history || []) {
    if (h.type === 'stake') { st.matches++; st.staked += -h.amount; } else if (h.type === 'win') { st.wins++; st.won += h.amount; st.fees += h.fee || 0; }
    else if (h.type === 'loss') st.losses++; else if (h.type === 'deposit') st.deposits += h.amount; else if (h.type === 'withdraw') st.withdrawn += -h.amount;
    st.lastActive = Math.max(st.lastActive, h.t || 0);
  }
  for (const k of ['staked', 'won', 'fees', 'deposits', 'withdrawn']) st[k] = Math.round(st[k] * 100) / 100;
  return (a.stats = st);
}
const money = v => (Math.round(v * 100) / 100).toLocaleString(LANG === 'en' ? 'en-US' : LANG === 'ru' ? 'ru-RU' : LANG === 'es' ? 'es-ES' : 'pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ---------------- grafiki map do losowania ----------------
const MAP_ART = {
  Oaza: n => `<svg viewBox="0 0 200 124" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="oz${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb35a"/><stop offset=".55" stop-color="#ffd9a0"/><stop offset="1" stop-color="#f6e2b8"/></linearGradient></defs>
    <rect width="200" height="124" fill="url(#oz${n})"/><circle cx="150" cy="38" r="16" fill="#fff4cf"/>
    <path d="M0 92 Q40 78 90 88 T200 84 V124 H0Z" fill="#e7c48a"/><path d="M0 104 Q60 92 120 102 T200 98 V124 H0Z" fill="#d9ad6c"/>
    <g fill="#f6f0e4" stroke="#c9b28a" stroke-width="1"><rect x="40" y="58" width="34" height="34"/><rect x="78" y="66" width="26" height="26"/><rect x="108" y="54" width="30" height="38"/></g>
    <path d="M118 54 a10 9 0 0 1 20 0z" fill="#4f8fc9"/><g fill="#7a5a3c"><rect x="50" y="72" width="7" height="12"/><rect x="118" y="70" width="8" height="10"/></g>
    <path d="M160 92 q2-26 -4-40" stroke="#7a4f2a" stroke-width="4" fill="none"/><g fill="#3e8a3a"><path d="M156 52 q-18-6-26 6 q14-4 26-6z"/><path d="M156 52 q16-10 28-2 q-14 0-28 2z"/><path d="M156 52 q-4-16 8-22 q-6 12-8 22z"/></g></svg>`,
  Magazyn: n => `<svg viewBox="0 0 200 124" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="mg${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2f3a"/><stop offset="1" stop-color="#4a4f5a"/></linearGradient></defs>
    <rect width="200" height="124" fill="url(#mg${n})"/><g stroke="#5c6472" stroke-width="2">${Array.from({ length: 7 }, (_, i) => `<line x1="${i * 34}" y1="0" x2="${i * 34 + 17}" y2="22"/><line x1="${i * 34 + 34}" y1="0" x2="${i * 34 + 17}" y2="22"/>`).join('')}<line x1="0" y1="22" x2="200" y2="22"/></g>
    <g fill="#bfe6ff" opacity=".7"><rect x="30" y="2" width="30" height="8"/><rect x="120" y="2" width="30" height="8"/></g>
    <rect x="0" y="96" width="200" height="28" fill="#3a3f48"/>
    <g><rect x="12" y="58" width="70" height="38" fill="#b0362c"/><rect x="88" y="66" width="56" height="30" fill="#2f5aa8"/><rect x="100" y="38" width="56" height="28" fill="#d9a521"/><rect x="150" y="62" width="44" height="34" fill="#3d7a46"/></g>
    <g stroke="rgba(0,0,0,.28)" stroke-width="2">${[18, 28, 38, 48, 58, 68].map(x => `<line x1="${x}" y1="60" x2="${x}" y2="94"/>`).join('')}${[94, 104, 114, 124, 134].map(x => `<line x1="${x}" y1="68" x2="${x}" y2="94"/>`).join('')}</g></svg>`,
  Baza: n => `<svg viewBox="0 0 200 124" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="bz${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfd6de"/><stop offset="1" stop-color="#9aa3ad"/></linearGradient></defs>
    <rect width="200" height="124" fill="url(#bz${n})"/><g fill="#e2b33a"><rect x="14" y="30" width="44" height="30"/><rect x="140" y="26" width="46" height="34"/></g><g fill="#b9bfc7"><path d="M10 30 L36 16 L62 30Z"/><path d="M136 26 L163 12 L190 26Z"/></g>
    <rect x="0" y="62" width="200" height="62" fill="#3b3d42"/><g fill="#eef0f2" stroke="#c63a2e" stroke-width="1.5"><rect x="6" y="64" width="188" height="6"/></g>
    <g><rect x="22" y="80" width="52" height="22" fill="#d2402f"/><rect x="26" y="74" width="44" height="8" fill="#3b6fc2"/><rect x="88" y="84" width="34" height="26" fill="#e2b33a"/><rect x="132" y="82" width="56" height="22" fill="#d2402f"/><rect x="140" y="104" width="30" height="10" fill="#d2402f"/></g>
    <g stroke="rgba(0,0,0,.25)" stroke-width="2">${[30, 40, 50, 60].map(x => `<line x1="${x}" y1="82" x2="${x}" y2="100"/>`).join('')}${[142, 152, 162, 172].map(x => `<line x1="${x}" y1="84" x2="${x}" y2="102"/>`).join('')}</g>
    <g fill="#e2b33a"><rect x="104" y="6" width="8" height="56"/></g></svg>`,
};
const DUEL_MAPS = ['Oaza', 'Magazyn', 'Baza'];
// zrzuty map z lotu ptaka (wyrenderowane z gry); SVG pod spodem zostaje jako zapas, gdyby obrazek się nie wczytał
// ujęcia z map (z poziomu gracza) do pokazu w oknie logowania
const SHOTS = [['Oaza', new URL('./maps/shot-oaza-1.jpg', import.meta.url).href], ['Magazyn', new URL('./maps/shot-magazyn-1.jpg', import.meta.url).href], ['Baza', new URL('./maps/shot-baza-1.jpg', import.meta.url).href],
  ['Oaza', new URL('./maps/shot-oaza-2.jpg', import.meta.url).href], ['Magazyn', new URL('./maps/shot-magazyn-2.jpg', import.meta.url).href], ['Baza', new URL('./maps/shot-baza-2.jpg', import.meta.url).href]];
export const MAP_IMG = { Oaza: new URL('./maps/oaza.jpg', import.meta.url).href, Magazyn: new URL('./maps/magazyn.jpg', import.meta.url).href, Baza: new URL('./maps/baza.jpg', import.meta.url).href };
Object.values(MAP_IMG).forEach(src => { const im = new Image(); im.src = src; });
export const HOUSE_FEE = 0.10;                          // prowizja od puli (2 × stawka)
const r2 = v => Math.round(v * 100) / 100;
export const payout = s => r2(s * 2 * (1 - HOUSE_FEE)), feeOf = s => r2(s * 2 * HOUSE_FEE);

// ---------------- główna funkcja ----------------
export function initLobbyUI(ctx) {
  const { ui, $ } = ctx;
  const toastEl = $('lb-toast'); let toastT = 0;
  const toast = (msg, kind = '') => { if (kind === 'err') SFX.err(); else if (kind === 'ok') SFX.ok(); toastEl.textContent = msg; toastEl.className = 'lb-toast show ' + kind; clearTimeout(toastT); toastT = setTimeout(() => toastEl.className = 'lb-toast', 3200); };

  // ---- ustawienia ----
  const defBinds = Object.fromEntries(ACTIONS);
  let S = { lang: 'en', volume: 80, vMenu: 70, vGame: 100, fov: 78, sens: 1, sensAds: 1, binds: { ...defBinds } };
  try { const v = JSON.parse(ls.get('fasolka-settings') || 'null'); if (v) S = { ...S, ...v, binds: { ...defBinds, ...(v.binds || {}) } }; } catch {}
  if (!S.langPicked || !DICT[S.lang]) S.lang = 'en';
  S.fov = 78;   // pole widzenia stałe – takie samo dla wszystkich graczy (bez ustawienia)   // domyślnie angielski, dopóki gracz sam nie wybierze języka
  LANG = S.lang;
  let pushT = 0;
  const pushSettings = () => { ls.set('fasolka-settings', JSON.stringify(S)); clearTimeout(pushT);
    pushT = setTimeout(sendSettings, 30); applyUiVol(); };
  // gra dostaje głośność = ogólna × dźwięki w grze; dźwięki menu gra lobby (ogólna × menu)
  const sendSettings = () => dispatchEvent(new CustomEvent('fasolka:settings', { detail: { volume: (S.volume / 100) * (S.vGame / 100), fov: S.fov, sens: +S.sens || 1, sensAds: +S.sensAds || 1 } }));
  setTimeout(sendSettings, 0);
  // zmiany z menu pauzy w grze trafiają do tego samego stanu (lobby nie nadpisze ich starą wartością)
  addEventListener('fasolka:settings-set', e => { S = { ...S, ...(e.detail || {}) }; pushSettings(); try { renderSettings(); } catch {} });

  // ---- dźwięki menu (WebAudio, bez plików) ----
  let AC = null, uiGain = null, gestured = false;
  const uiVol = () => (S.volume / 100) * (S.vMenu / 100);
  function applyUiVol() { if (uiGain) uiGain.gain.setTargetAtTime(uiVol(), AC.currentTime, .01); }
  const audio = () => {
    if (!gestured) return null;
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); uiGain = AC.createGain(); uiGain.gain.value = uiVol(); uiGain.connect(AC.destination); } catch { return null; } }
    if (AC.state === 'suspended') AC.resume().catch(() => {});
    return AC;
  };
  addEventListener('pointerdown', () => { gestured = true; }, true); addEventListener('keydown', () => { gestured = true; }, true);
  function tone({ f = 880, f2 = 0, type = 'sine', d = .06, g = .18, at = 0, out = null }) {
    const ac = audio(); if (!ac) return; if (!out && uiVol() <= 0) return;
    const t0 = ac.currentTime + at, o = ac.createOscillator(), v = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
    v.gain.setValueAtTime(0, t0); v.gain.linearRampToValueAtTime(g, t0 + .004); v.gain.exponentialRampToValueAtTime(.0001, t0 + d);
    o.connect(v).connect(out || uiGain); o.start(t0); o.stop(t0 + d + .03);
  }
  let gSfx = null, gGain = null;
  function gamePreview(vol) {                          // podgląd „dźwięków w grze”: prawdziwy strzał z AK i trafienie w głowę
    const ac = audio(); if (!ac || vol <= 0) return;
    if (!gSfx) { gGain = ac.createGain(); gGain.connect(ac.destination); try { gSfx = createSfx(ac, gGain); } catch { return; } }
    gGain.gain.value = vol; gSfx.shot('ak'); setTimeout(() => gSfx && gSfx.hit(false, true), 170);
  }
  const SFX = {
    hover: () => tone({ f: 1500, d: .025, g: .035, type: 'triangle' }),
    click: () => { tone({ f: 640, f2: 430, d: .06, g: .12, type: 'triangle' }); tone({ f: 2400, d: .015, g: .03, type: 'square' }); },
    open: () => { tone({ f: 330, f2: 660, d: .13, g: .07 }); tone({ f: 990, d: .08, g: .03, at: .05, type: 'triangle' }); },
    close: () => tone({ f: 620, f2: 300, d: .11, g: .06 }),
    tick: () => tone({ f: 2100, f2: 1600, d: .022, g: .06, type: 'square' }),
    reveal: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone({ f, d: .5, g: .09, type: 'triangle', at: i * .075 })),
    ok: () => { tone({ f: 988, d: .09, g: .09, type: 'square' }); tone({ f: 1319, d: .22, g: .08, type: 'square', at: .07 }); },
    err: () => { tone({ f: 200, f2: 150, d: .16, g: .1, type: 'sawtooth' }); },
    play: () => { tone({ f: 180, f2: 720, d: .3, g: .1, type: 'sawtooth' }); [392, 523.25, 659.25].forEach((f, i) => tone({ f, d: .4, g: .07, type: 'triangle', at: .12 + i * .04 })); },
  };
  const HOVER_SEL = '.lb-stake button,.lb-menu button,.lb-tile:not(.soon),.lb-play,.lb-mode,.lb-chip,.lb-burger,.lb-skin,.lb-tabs button,.lb-seg,.lb-bind,.lb-quick button';
  ui.addEventListener('pointerover', e => { const el = e.target.closest(HOVER_SEL); if (el && !(e.relatedTarget && el.contains(e.relatedTarget))) SFX.hover(); });
  ui.addEventListener('pointerdown', e => { gestured = true; const b = e.target.closest('button,.lb-key'); if (b && b.id !== 'lb-play' && !b.closest('.lb-vrow')) SFX.click(); });

  // przemapowanie klawiszy: fizyczny klawisz -> klawisz, którego oczekuje gra
  let remap = {}, swallow = new Set(), rebinding = null;
  const buildRemap = () => { remap = {}; swallow = new Set();
    for (const [id, def] of ACTIONS) { const k = S.binds[id] || def; if (k !== def) remap[k] = def; }
    for (const [id, def] of ACTIONS) if ((S.binds[id] || def) !== def && !remap[def]) swallow.add(def); };
  buildRemap();
  const isField = el => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
  const onKey = e => {
    if (e.__fasolka) return;
    if (!$('lb-set').hidden && keyEls[e.code]) keyEls[e.code].classList.toggle('down', e.type === 'keydown');
    if (rebinding) { if (e.type !== 'keydown') { e.stopImmediatePropagation(); return; } e.preventDefault(); e.stopImmediatePropagation(); finishRebind(e.code); return; }
    if (isField(e.target)) { e.stopImmediatePropagation(); if (e.key === 'Escape') closeAll(); return; }   // pisanie w polach nie steruje grą
    if (e.type === 'keydown' && e.key === 'Escape' && anyOpen()) { e.stopImmediatePropagation(); closeAll(); return; }
    const to = remap[e.code];
    if (to) { e.preventDefault(); e.stopImmediatePropagation(); const ev = new KeyboardEvent(e.type, { code: to, key: e.key, bubbles: true, cancelable: true, repeat: e.repeat }); ev.__fasolka = true; window.dispatchEvent(ev); return; }
    if (swallow.has(e.code)) { e.stopImmediatePropagation(); e.preventDefault(); }
  };
  addEventListener('keydown', onKey, true); addEventListener('keyup', onKey, true);

  // ---- tłumaczenia statycznych napisów ----
  const applyI18n = () => {
    document.documentElement.lang = LANG;
    ui.querySelectorAll('[data-i18n]').forEach(el => el.textContent = t(el.dataset.i18n));
    ui.querySelectorAll('[data-i18n-ph]').forEach(el => el.placeholder = t(el.dataset.i18nPh));
    ui.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); el.setAttribute('aria-label', el.title); });
    renderTop(); renderStake(); renderSettings(); renderAuth(); renderWallet(); ctx.refresh();
  };

  // ---- menu ☰ ----
  const menu = $('lb-menu'), burger = $('lb-burger');
  const openMenu = v => { menu.hidden = !v; burger.setAttribute('aria-expanded', String(v)); };
  burger.addEventListener('click', e => { e.stopPropagation(); openMenu(menu.hidden); });
  addEventListener('pointerdown', e => { if (!menu.hidden && !menu.contains(e.target) && e.target !== burger && !burger.contains(e.target)) openMenu(false); });
  menu.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b) return; openMenu(false);
    ({ settings: () => openModal('lb-set'), wallet: () => openWallet(), auth: () => openModal('lb-auth'), logout: () => logout() })[b.dataset.act](); });

  // ---- okna dialogowe ----
  const modals = ['lb-set', 'lb-auth', 'lb-wallet'].map($);
  const openModal = id => { modals.forEach(m => m.hidden = m.id !== id); SFX.open(); };
  const closeAll = () => { if (modals.some(m => !m.hidden)) SFX.close(); modals.forEach(m => m.hidden = true); openMenu(false); Object.values(keyEls).forEach(k => k.classList.remove('down')); if (rebinding) { rebinding = null; renderSettings(); } };
  const anyOpen = () => modals.some(m => !m.hidden) || !menu.hidden;
  modals.forEach(m => { m.addEventListener('pointerdown', e => { if (e.target === m) closeAll(); }); m.querySelectorAll('.lb-x').forEach(b => b.addEventListener('click', closeAll)); });
  ui.querySelectorAll('.lb-tabs').forEach(tb => tb.addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (!b) return;
    const box = tb.parentElement; box.querySelectorAll('.lb-tabs button').forEach(x => x.classList.toggle('on', x === b));
    box.querySelectorAll('[data-pane]').forEach(p => p.hidden = p.dataset.pane !== b.dataset.tab); }));
  const showTab = (modalId, tab) => { const box = $(modalId).querySelector('.lb-dlg'); box.querySelectorAll('.lb-tabs button').forEach(x => x.classList.toggle('on', x.dataset.tab === tab));
    box.querySelectorAll('[data-pane]').forEach(p => p.hidden = p.dataset.pane !== tab); };

  // ---- ustawienia: renderowanie ----
  const langBox = $('lb-langs'), fovR = $('lb-fov'), bindBox = $('lb-binds');
  LANGS.forEach(l => { const b = document.createElement('button'); b.type = 'button'; b.className = 'lb-seg'; b.dataset.lang = l.id; b.innerHTML = `<i class="lb-flag">${FLAGS[l.id]}</i><span></span><b>${l.id.toUpperCase()}</b>`;
    b.querySelector('span').textContent = l.name; b.addEventListener('click', () => setLang(l.id)); langBox.appendChild(b); });
  function setLang(id) { S.lang = id; S.langPicked = true; LANG = id; pushSettings(); applyI18n(); }
  // ---- flaga języka w pasku ----
  const langBtn = $('lb-langbtn'), langMenu = $('lb-langmenu');
  const openLang = v => { langMenu.hidden = !v; langBtn.setAttribute('aria-expanded', String(v)); };
  LANGS.forEach(l => { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.dataset.lang = l.id;
    b.innerHTML = `<i class="lb-flag">${FLAGS[l.id]}</i><span></span><small>${l.id.toUpperCase()}</small>`; b.querySelector('span').textContent = l.name;
    b.addEventListener('click', () => { openLang(false); if (l.id !== S.lang) setLang(l.id); }); langMenu.appendChild(b); });
  const renderLangPick = () => { $('lb-langflag').innerHTML = FLAGS[S.lang]; $('lb-langcode').textContent = S.lang.toUpperCase();
    langMenu.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.lang === S.lang)); };
  langBtn.addEventListener('click', e => { e.stopPropagation(); openLang(langMenu.hidden); });
  document.addEventListener('pointerdown', e => { if (!langMenu.hidden && !e.target.closest('.lb-lang')) openLang(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !langMenu.hidden) { openLang(false); e.stopPropagation(); } }, true);
  const fillRange = r => r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%');
  const preview = k => k === 'vGame' ? gamePreview((S.volume / 100) * (S.vGame / 100)) : k === 'vMenu' ? SFX.reveal() : (tone({ f: 660, d: .12, g: .5, type: 'triangle', out: masterOut() }));
  const masterOut = () => { const ac = audio(); if (!ac) return null; const g = ac.createGain(); g.gain.value = S.volume / 100 * .3; g.connect(ac.destination); return g; };
  ui.querySelectorAll('.lb-vrow').forEach(row => { const k = row.dataset.k, r = row.querySelector('input'), last = { v: S[k] || 80 };
    r.addEventListener('input', () => { S[k] = +r.value; if (S[k]) last.v = S[k]; renderVol(); pushSettings(); });
    r.addEventListener('change', () => preview(k));
    row.querySelector('.lb-vic').addEventListener('click', () => { S[k] = S[k] ? 0 : last.v; renderVol(); pushSettings(); if (S[k]) preview(k); });
    row.querySelector('.lb-vplay').addEventListener('click', () => preview(k)); });
  ui.querySelectorAll('.lb-srow').forEach(row => { const k = row.dataset.k, r = row.querySelector('input');
    r.addEventListener('input', () => { S[k] = +r.value; renderSens(); pushSettings(); }); });
  function renderSens() { ui.querySelectorAll('.lb-srow').forEach(row => { const k = row.dataset.k, r = row.querySelector('input'); r.value = +S[k] || 1; fillRange(r);
    row.querySelector('.lb-vval').textContent = (+S[k] || 1).toFixed(2); }); }
  function renderVol() { ui.querySelectorAll('.lb-vrow').forEach(row => { const k = row.dataset.k, r = row.querySelector('input'); r.value = S[k]; fillRange(r);
    row.querySelector('.lb-vval').textContent = S[k] + '%'; row.classList.toggle('muted', !S[k]); }); }
  const wedge = $('lb-fov-wedge');
  function renderFov() { if (!fovR) return; fovR.value = S.fov; fillRange(fovR); $('lb-fov-v').textContent = S.fov + '°';
    const h = S.fov / 2 * Math.PI / 180, R = 52, x1 = 60 - R * Math.sin(h), x2 = 60 + R * Math.sin(h), y = 58 - R * Math.cos(h);
    wedge.setAttribute('d', `M60 58L${x1.toFixed(1)} ${y.toFixed(1)}A${R} ${R} 0 0 1 ${x2.toFixed(1)} ${y.toFixed(1)}Z`); }
  if (fovR) fovR.addEventListener('input', () => { S.fov = +fovR.value; renderFov(); pushSettings(); });
  $('lb-bind-reset').addEventListener('click', () => { S.binds = { ...defBinds }; buildRemap(); pushSettings(); renderSettings(); });
  const finishRebind = code => { const id = rebinding; rebinding = null;
    if (code !== 'Escape') {
      if (RESERVED.has(code)) toast(t('set.reserved'), 'err');
      else { const other = ACTIONS.find(([a]) => a !== id && (S.binds[a] || defBinds[a]) === code); if (other) S.binds[other[0]] = S.binds[id]; S.binds[id] = code; buildRemap(); pushSettings(); }
    }
    renderSettings(); };

  // ---- ilustracja klawiatury 60% z podświetleniem klawiszy w użyciu ----
  const CAT = { fwd: 'move', back: 'move', left: 'move', right: 'move', sprint: 'move', jump: 'move', crouch: 'move', reload: 'fight', inspect: 'fight', prev: 'fight', view: 'sys', mute: 'sys' };
  const FIXED = { Digit1: ['kb.weapons', 'fight'], Digit2: ['kb.weapons', 'fight'], Digit3: ['kb.weapons', 'fight'], Digit4: ['kb.weapons', 'fight'], Escape: ['kb.pause', 'sys'] };
  const ALT = { ControlLeft: 'crouch', ShiftRight: 'sprint' };      // zapasowe klawisze wbudowane w grę
  const RESERVED = new Set(['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Escape']);
  const row1 = (str, pre) => str.split('').map(c => [pre + c, c]);
  const KB_ROWS = [
    [['Escape', 'Esc'], ...row1('1234567890', 'Digit'), ['Minus', '-'], ['Equal', '='], ['Backspace', '⌫', 2]],
    [['Tab', 'Tab', 1.5], ...row1('QWERTYUIOP', 'Key'), ['BracketLeft', '['], ['BracketRight', ']'], ['Backslash', '\\', 1.5]],
    [['CapsLock', 'Caps', 1.75], ...row1('ASDFGHJKL', 'Key'), ['Semicolon', ';'], ['Quote', "'"], ['Enter', 'Enter', 2.25]],
    [['ShiftLeft', 'Shift', 2.25], ...row1('ZXCVBNM', 'Key'), ['Comma', ','], ['Period', '.'], ['Slash', '/'], ['ShiftRight', 'Shift', 2.75]],
    [['ControlLeft', 'Ctrl', 1.5], ['MetaLeft', 'Win', 1.25], ['AltLeft', 'Alt', 1.25], ['Space', 'Space', 7], ['AltRight', 'Alt', 1.25], ['MetaRight', 'Fn', 1.25], ['ControlRight', 'Ctrl', 1.5]],
  ];
  const kb = $('lb-kb'), kbTip = $('lb-kbtip'), deck = kb.parentElement, keyEls = {};
  for (const row of KB_ROWS) { const r = document.createElement('div'); r.className = 'lb-kbrow';
    for (const [code, label, u = 1] of row) { const k = document.createElement('button'); k.type = 'button'; k.tabIndex = -1; k.className = 'lb-key';
      k.dataset.code = code; k.dataset.u = u; k.style.gridColumn = 'span ' + Math.round(u * 4); k.innerHTML = '<b></b><small></small>';
      k.querySelector('b').textContent = label; keyEls[code] = k; r.appendChild(k); }
    kb.appendChild(r); }
  const keyActs = code => {
    const out = [];
    for (const [id, def] of ACTIONS) if ((S.binds[id] || def) === code) out.push({ id, name: t('act.' + id), cat: CAT[id] });
    if (!out.length && FIXED[code]) out.push({ name: t(FIXED[code][0]), cat: FIXED[code][1], fixed: true });
    if (!out.length && ALT[code]) out.push({ id: ALT[code], name: t('act.' + ALT[code]) + ' (' + t('kb.alt') + ')', cat: CAT[ALT[code]], alt: true });
    return out;
  };
  const codeOf = id => S.binds[id] || defBinds[id];
  const hlAction = (id, on) => { const k = keyEls[codeOf(id)]; if (k) k.classList.toggle('hl', on); };
  function renderKb() {
    kb.classList.toggle('pick', !!rebinding);
    for (const code in keyEls) { const k = keyEls[code], a = keyActs(code)[0], down = k.classList.contains('down');
      k.className = 'lb-key' + (a ? ' use c-' + a.cat + (a.alt ? ' alt' : '') : '') + (rebinding && a && a.id === rebinding && !a.alt ? ' hl' : '') + (down ? ' down' : '');
      k.querySelector('small').textContent = a && +k.dataset.u >= 2 ? a.name.replace(/ \(.*\)$/, '') : '';
      k.dataset.tip = a ? a.name : ''; }
  }
  kb.addEventListener('pointerover', e => { const k = e.target.closest('.lb-key'); if (!k) return;
    const a = keyActs(k.dataset.code)[0];
    bindBox.querySelectorAll('.lb-bind').forEach(r => r.classList.toggle('hl', !!a && r.dataset.id === a.id));
    if (!a && !rebinding) { kbTip.hidden = true; return; }
    kbTip.innerHTML = '<kbd></kbd><span></span>'; kbTip.querySelector('kbd').textContent = keyLabel(k.dataset.code);
    kbTip.querySelector('span').textContent = a ? a.name : t('set.press'); kbTip.className = 'lb-kbtip' + (a ? ' c-' + a.cat : '');
    const kr = k.getBoundingClientRect(), dr = deck.getBoundingClientRect();
    kbTip.style.left = (kr.left - dr.left + kr.width / 2) + 'px'; kbTip.style.top = (kr.top - dr.top - 6) + 'px'; kbTip.hidden = false; });
  kb.addEventListener('pointerleave', () => { kbTip.hidden = true; bindBox.querySelectorAll('.lb-bind.hl').forEach(r => r.classList.remove('hl')); });
  kb.addEventListener('click', e => { const k = e.target.closest('.lb-key'); if (!k) return; const code = k.dataset.code;
    if (rebinding) { finishRebind(code); return; }
    const a = keyActs(code)[0]; if (a && a.id && !a.alt) { rebinding = a.id; renderSettings(); } });

  function renderSettings() {
    renderLangPick(); renderBiz();
    langBox.querySelectorAll('.lb-seg').forEach(b => b.classList.toggle('on', b.dataset.lang === S.lang));
    renderVol(); renderFov(); renderSens();
    bindBox.innerHTML = '';
    for (const [id, def] of ACTIONS) { const row = document.createElement('button'); row.type = 'button'; row.dataset.id = id;
      row.className = 'lb-bind c-' + CAT[id] + (rebinding === id ? ' wait' : '');
      row.innerHTML = '<i></i><span></span><kbd></kbd>'; row.querySelector('span').textContent = t('act.' + id);
      row.querySelector('kbd').textContent = rebinding === id ? t('set.press') : keyLabel(S.binds[id] || def);
      row.addEventListener('click', () => { rebinding = rebinding === id ? null : id; renderSettings(); });
      row.addEventListener('pointerenter', () => hlAction(id, true)); row.addEventListener('pointerleave', () => hlAction(id, false));
      bindBox.appendChild(row); }
    renderKb();
  }

  // ---- konto ----
  let acct = null, acctId = null;
  // serwer portfeli (serwer/ w repo): gdy ustawiony, konta, saldo, wpłaty, wypłaty i stawki idą przez niego (prawdziwe SOL w sieci Solana)
  const API = walletApi();
  const W = API ? createWallet({ api: API, root: ui, getLang: () => LANG, toast, onChange: a => { acct = a; acctId = a ? a.username.toLowerCase() : null; renderAll(); } }) : null;
  let activeMatch = null;
  // bez serwera: ten sam nowy portfel, ale na koncie lokalnym (tryb testowy)
  const WL = W ? null : createWallet({ api: '', root: ui, getLang: () => LANG, toast, onChange: () => {}, local: { acct: () => acct, addTx: (a, type, note) => addTx(a, type, note) } });
  // profil (karta konta w menu): zapis przez serwer portfeli albo konto lokalne
  const localSave = async patch => {
    if (patch.username && patch.username.toLowerCase() !== acctId) {
      const nid = patch.username.toLowerCase(); if (await accGet(nid)) throw new Error(t('auth.errExists'));
      const old = acctId; Object.assign(acct, patch); await accSet(nid, acct); acctId = nid; ls.set('fasolka-session', nid);
      ls.del('fasolka-acc:' + old); const db = await dbP; if (db) { try { await db.doc('accounts/' + old).delete(); } catch {} }
    } else { Object.assign(acct, patch); await saveAcct(); }
    renderAll();
  };
  const localPw = async (oldP, newP) => { const h = await hashPw(oldP, acct.salt); if (h.hash !== acct.hash) throw Object.assign(new Error('old'), { code: 'oldpass' }); const n = await hashPw(newP); acct.salt = n.salt; acct.hash = n.hash; await saveAcct(); };
  var P = createProfile({ root: ui, getLang: () => LANG, toast, adapter: {
    get acct() { return acct; },
    save: patch => W ? W.profile(patch) : localSave(patch),
    password: (o, n) => W ? W.password(o, n) : localPw(o, n),
    earnings: async () => W ? W.earnings() : pointsFromHistory(acct && acct.history),
    logout: () => logout(),
  } });
  const saveAcct = async () => { if (acct) await accSet(acctId, acct); };
  const setErr = (id, msg) => { const el = $(id); el.textContent = msg || ''; el.hidden = !msg; };
  $('lb-login-form').addEventListener('submit', async e => { e.preventDefault(); setErr('lb-login-err');
    const u = $('lb-l-user').value.trim(), p = $('lb-l-pass').value, id = u.toLowerCase();
    if (!/^[a-z0-9_]{3,16}$/.test(id) || p.length < 6) return setErr('lb-login-err', t('auth.errCreds'));
    const btn = e.submitter || e.target.querySelector('[type=submit]'); btn.disabled = true;
    if (W) { try { const a = await W.login(u, p); $('lb-l-pass').value = ''; closeAll(); toast(t('auth.welcome', { u: a.username }), 'ok'); }
      catch (err) { setErr('lb-login-err', err.status === 401 ? t('auth.errCreds') : err.message || t('auth.errDb')); } finally { btn.disabled = false; } return; }
    try { const a = await accGet(id); if (!a) throw 'creds'; const h = await hashPw(p, a.salt); if (h.hash !== a.hash) throw 'creds';
      acct = a; acctId = id; ensureStats(acct); ls.set('fasolka-session', id); $('lb-l-pass').value = ''; closeAll(); toast(t('auth.welcome', { u: a.username }), 'ok'); renderAll(); }
    catch (err) { setErr('lb-login-err', err === 'creds' ? t('auth.errCreds') : t('auth.errDb')); } finally { btn.disabled = false; } });
  $('lb-reg-form').addEventListener('submit', async e => { e.preventDefault(); setErr('lb-reg-err');
    const u = $('lb-r-user').value.trim(), p = $('lb-r-pass').value, p2 = $('lb-r-pass2').value, id = u.toLowerCase();
    if (!/^[a-z0-9_]{3,16}$/i.test(u)) return setErr('lb-reg-err', t('auth.errUser'));
    if (p.length < 6) return setErr('lb-reg-err', t('auth.errPass'));
    if (p !== p2) return setErr('lb-reg-err', t('auth.errMatch'));
    if (!$('lb-r-terms').checked) return setErr('lb-reg-err', t('auth.errTerms'));
    const btn = e.submitter || e.target.querySelector('[type=submit]'); btn.disabled = true;
    if (W) { try { await W.register(u, p); ['lb-r-pass', 'lb-r-pass2'].forEach(k => $(k).value = ''); closeAll(); toast(t('auth.created', { u }), 'ok'); }
      catch (err) { setErr('lb-reg-err', err.code === 'exists' ? t('auth.errExists') : err.message || t('auth.errDb')); } finally { btn.disabled = false; } return; }
    try { if (await accGet(id)) throw 'exists'; const h = await hashPw(p);
      const a = { username: u, salt: h.salt, hash: h.hash, kdf: 'pbkdf2-sha256-150k', createdAt: new Date().toISOString(), balance: 0, wallet: '', history: [] };
      await accSet(id, a); acct = a; acctId = id; ls.set('fasolka-session', id); ['lb-r-pass', 'lb-r-pass2'].forEach(k => $(k).value = ''); closeAll(); toast(t('auth.created', { u }), 'ok'); renderAll(); }
    catch (err) { setErr('lb-reg-err', err === 'exists' ? t('auth.errExists') : t('auth.errDb')); } finally { btn.disabled = false; } });
  $('lb-logout').addEventListener('click', () => logout());
  function logout() { if (W) W.logout(); acct = null; acctId = null; ls.del('fasolka-session'); closeAll(); renderAll(); }
  // ---- okno logowania: nagłówek zależny od zakładki, pokaż hasło, siła hasła, zgoda 18+, Google ----
  const authBox = $('lb-auth');
  // tło lewego panelu: zmieniające się ujęcia z map gry (co ~4 s, płynne przejście i lekki najazd)
  const show = $('lb-abg');
  show.innerHTML = SHOTS.map(([, src], i) => `<img src="${src}" alt="" decoding="async"${i ? ' loading="lazy"' : ''}>`).join('');
  let shotI = 0, shotT = 0;
  const shotGo = i => { shotI = (i + SHOTS.length) % SHOTS.length;
    show.querySelectorAll('img').forEach((im, k) => { if (k === shotI) { im.classList.remove('on'); void im.offsetWidth; im.classList.add('on'); } else im.classList.remove('on'); }); };
  shotGo(0);
  new MutationObserver(() => { clearInterval(shotT); if (!authBox.hidden) { shotGo(shotI); shotT = setInterval(() => shotGo(shotI + 1), 4200); } }).observe(authBox, { attributes: true, attributeFilter: ['hidden'] });
  function renderAuthHead() {
    const reg = !$('lb-reg-form').hidden; $('lb-auth-h').textContent = t(reg ? 'auth.hiReg' : 'auth.hiLogin'); $('lb-auth-sub').textContent = t(reg ? 'auth.subReg' : 'auth.subLogin');
    const e = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    $('lb-terms-txt').innerHTML = e(t('auth.terms')).replace('{t}', `<a data-doc="terms">${e(t('auth.termsT'))}</a>`).replace('{p}', `<a data-doc="privacy">${e(t('auth.termsP'))}</a>`);
  }
  new MutationObserver(renderAuthHead).observe($('lb-reg-form'), { attributes: true, attributeFilter: ['hidden'] });
  authBox.addEventListener('click', e => {
    const g = e.target.closest('[data-goto]'); if (g) { showTab('lb-auth', g.dataset.goto); return; }
    const d = e.target.closest('a[data-doc]'); if (d) { e.preventDefault(); closeAll(); openModal('lb-set'); showTab('lb-set', 'biz'); bizDoc = d.dataset.doc; renderBiz(); return; }
    const y = e.target.closest('[data-eye]'); if (y) { const i = $(y.dataset.eye), show = i.type === 'password'; i.type = show ? 'text' : 'password'; y.classList.toggle('on', show); }
  });
  $('lb-r-pass').addEventListener('input', () => {
    const p = $('lb-r-pass').value; let sc = 0;
    if (p.length >= 6) sc++; if (p.length >= 10) sc++; if (/[A-Z]/.test(p) && /[a-z]/.test(p)) sc++; if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) sc++;
    const m = $('lb-pwm'), s = p ? Math.max(1, sc) : 0; m.dataset.s = s; m.querySelector('em').textContent = s ? t('auth.pw' + s) : '';
  });
  let gId = null;
  const googleId = async () => { if (gId !== null) return gId; if (!API) return (gId = ''); try { gId = (await (await fetch(API + '/api/config')).json()).googleClientId || ''; } catch { gId = ''; } return gId; };
  const loadGis = () => new Promise((ok, no) => { if (window.google && google.accounts && google.accounts.oauth2) return ok(); const sc = document.createElement('script'); sc.src = 'https://accounts.google.com/gsi/client'; sc.async = true; sc.onload = () => ok(); sc.onerror = no; document.head.appendChild(sc); });
  $('lb-google').addEventListener('click', async () => {
    const id = await googleId(); if (!W || !id) return toast(t('auth.googleOff'));
    const btn = $('lb-google'); btn.disabled = true;
    try {
      await loadGis();
      google.accounts.oauth2.initTokenClient({ client_id: id, scope: 'openid email profile', error_callback: () => { btn.disabled = false; },
        callback: async r => {
          if (!r || r.error) { btn.disabled = false; return toast(t('auth.googleErr'), 'err'); }
          try { const j = await W.google(r.access_token); closeAll(); toast(t(j.created ? 'auth.created' : 'auth.welcome', { u: j.account.username }), 'ok'); }
          catch (er) { toast(er.message || t('auth.googleErr'), 'err'); }
          btn.disabled = false;
        } }).requestAccessToken();
    } catch { btn.disabled = false; toast(t('auth.googleErr'), 'err'); }
  });
  function renderAuth() {
    renderAuthHead();
    const inBox = $('lb-auth-in'), outBox = $('lb-auth-out');
    inBox.hidden = !acct; outBox.hidden = !!acct;
    if (acct) { $('lb-me-av').textContent = acct.username[0].toUpperCase(); $('lb-me-name').textContent = acct.username; $('lb-me-since').textContent = new Date(acct.createdAt).toLocaleDateString(LANG); }
  }

  // ---- portfel (test) ----
  // statystyki konta (sumy od początku; historia trzyma tylko 40 ostatnich operacji) – czyta je panel admina
  const addTx = async (amount, type, note = '', extra = {}) => { acct.balance = r2(acct.balance + amount);
    const st = ensureStats(acct);
    if (type === 'deposit') st.deposits = r2(st.deposits + amount);
    else if (type === 'withdraw') st.withdrawn = r2(st.withdrawn - amount);
    else if (type === 'stake') { st.matches++; st.staked = r2(st.staked - amount); }
    else if (type === 'win') { st.wins++; st.won = r2(st.won + amount); st.fees = r2(st.fees + (extra.fee || 0)); }
    else if (type === 'loss') st.losses++;
    flushCombat(); st.lastActive = Date.now();
    acct.history = [{ t: Date.now(), type, amount, note, ...extra }, ...(acct.history || [])].slice(0, 40); await saveAcct(); renderAll(); };
  // statystyki walki w 1v1 (strzały, trafienia, głowy, zabójstwa, śmierci) – zbierane w pamięci, zapisywane razem z rozliczeniem meczu
  const pend = { shots: 0, hits: 0, heads: 0, kills: 0, deaths: 0 };
  addEventListener('fasolka:shot', e => { if (acct && e.detail && e.detail.mode === '1v1') pend.shots++; });
  addEventListener('fasolka:hit', e => { const d = e.detail || {}; if (!acct || d.mode !== '1v1') return; pend.hits++; if (d.head) pend.heads++; if (d.kill) pend.kills++; });
  addEventListener('fasolka:death', e => { if (acct && (!e.detail || e.detail.mode === '1v1')) pend.deaths++; });
  function sendStats() { if (!W) return; const o = { ...pend }; for (const k in pend) pend[k] = 0; if (Object.values(o).some(v => v)) W.stats(o); }
  function flushCombat() { if (!acct) return false; const st = ensureStats(acct); let ch = false;
    for (const k in pend) if (pend[k]) { st[k] += pend[k]; pend[k] = 0; ch = true; } return ch; }
  // każdy mecz o stawkę trafia do wspólnej listy (panel admina: wykresy, ostatnie mecze)
  async function logMatch(o) {
    if (!acct) return; const rec = { u: acctId, name: acct.username, t: Date.now(), map: lastMap || null, ...o };
    const db = await dbP;
    if (db) { try { await db.collection('matches').add(rec); return; } catch {} }
    try { const a = JSON.parse(ls.get('fasolka-matches') || '[]'); a.unshift(rec); ls.set('fasolka-matches', JSON.stringify(a.slice(0, 500))); } catch {}
  }
  function openWallet(tab = 'deposit') { if (!acct) { toast(t('w.loginFirst')); openModal('lb-auth'); showTab('lb-auth', 'login'); return; } if (W || WL) { closeAll(); (W || WL).open(tab); return; } openModal('lb-wallet'); showTab('lb-wallet', tab); }
  $('lb-dep-form').addEventListener('submit', async e => { e.preventDefault(); const a = Math.round(+$('lb-dep-amt').value * 100) / 100;
    if (!(a >= 1 && a <= 10000)) return toast(t('w.errAmount'), 'err'); await addTx(a, 'deposit'); $('lb-dep-amt').value = ''; toast(t('w.depOk', { a: money(a) }), 'ok'); });
  $('lb-dep-form').querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => { $('lb-dep-amt').value = b.dataset.q; }));
  $('lb-wd-form').addEventListener('submit', async e => { e.preventDefault(); const a = Math.round(+$('lb-wd-amt').value * 100) / 100, addr = $('lb-wd-addr').value.trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)) return toast(t('w.errAddr'), 'err');
    if (!(a >= 1 && a <= 10000)) return toast(t('w.errAmount'), 'err'); if (a > acct.balance) return toast(t('w.errFunds'), 'err');
    await addTx(-a, 'withdraw', addr.slice(0, 4) + '…' + addr.slice(-4)); $('lb-wd-amt').value = ''; toast(t('w.wdOk', { a: money(a) }), 'ok'); });
  $('lb-phantom').addEventListener('click', async () => { const p = (window.phantom && window.phantom.solana) || window.solana;
    if (!p || !p.isPhantom) return toast(t('w.noPhantom'), 'err');
    try { const r = await p.connect(); acct.wallet = r.publicKey.toString(); await saveAcct(); renderAll(); } catch { toast(t('w.rejected'), 'err'); } });
  function renderWallet() {
    const bal = acct ? usd(acct.balance) : '—';
    $('lb-w-bal').textContent = bal; $('lb-wd-addr').value = $('lb-wd-addr').value || (acct && acct.wallet) || '';
    $('lb-w-addr').textContent = acct && acct.wallet ? acct.wallet.slice(0, 6) + '…' + acct.wallet.slice(-6) : '';
    $('lb-phantom').classList.toggle('on', !!(acct && acct.wallet));
    const list = $('lb-hist'); list.innerHTML = '';
    const hist = (acct && acct.history) || [];
    if (!hist.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = t('w.empty'); list.appendChild(li); }
    for (const h of hist) { const li = document.createElement('li'); li.innerHTML = '<div><b></b><small></small></div><span></span>';
      const note = h.fee ? t('tx.fee', { a: usd(h.fee) }) : h.note; li.querySelector('b').textContent = t('tx.' + h.type) + (note ? ' · ' + note : ''); li.querySelector('small').textContent = new Date(h.t).toLocaleString(LANG);
      const sp = li.querySelector('span'); sp.textContent = h.amount ? (h.amount > 0 ? '+' : '−') + usd(Math.abs(h.amount)) : ''; sp.className = h.amount > 0 ? 'pos' : h.amount < 0 ? 'neg' : '';
      list.appendChild(li); }
  }

  // ---- pasek górny ----
  function renderTop() {
    $('lb-acct-name').textContent = acct ? acct.username : t('top.signin');
    if (acct) paintAvatar($('lb-acct-av'), acct); else { $('lb-acct-av').textContent = '?'; $('lb-acct-av').style.background = ''; }
    $('lb-bal').textContent = usd(acct ? acct.balance : 0);   // bez konta: $0,00
    ctx.setName(acct ? acct.username : t('top.guest'));
    menu.querySelector('[data-act="auth"] span').textContent = acct ? t('menu.account') : t('menu.login');
    $('lb-acct').hidden = $('lb-acct-hr').hidden = !acct; menu.querySelector('[data-act="auth"]').hidden = !!acct;   // konto w menu: karta po zalogowaniu, „Zaloguj się” bez konta
    menu.querySelector('[data-act="logout"]').hidden = !acct;
    const hr = menu.querySelector('hr'); if (hr) hr.hidden = !acct;
  }
  $('lb-acct').addEventListener('click', () => { openMenu(false); if (acct) { closeAll(); P.open(); return; } openModal('lb-auth'); showTab('lb-auth', 'login'); });
  $('lb-walletchip').addEventListener('click', () => openWallet());

  // ---- stawka ----
  let stakeSel = ls.get('fasolka-stake-sel') || '5', stakeCustom = +(ls.get('fasolka-stake-custom') || 50);
  const stakeBox = $('lb-stake'), customIn = $('lb-stake-in');
  stakeBox.querySelectorAll('[data-stake]').forEach(b => b.addEventListener('click', () => { stakeSel = b.dataset.stake; ls.set('fasolka-stake-sel', stakeSel); renderStake(); if (stakeSel === 'custom') customIn.focus(); }));
  customIn.addEventListener('input', () => { stakeCustom = Math.floor(+customIn.value); ls.set('fasolka-stake-custom', String(stakeCustom)); renderStake(true); });
  const getStake = () => stakeSel === 'custom' ? stakeCustom : +stakeSel;
  function renderStake(keepInput) {
    const duel = ctx.getMode() === '1v1';
    $('lb-stake-wrap').classList.toggle('off', !duel);
    // strzelnica: stawki widoczne, ale szare i nieaktywne; prowizja i wygrana $0,00
    $('lb-stake-free').hidden = true; stakeBox.hidden = false;
    stakeBox.querySelectorAll('[data-stake]').forEach(b => { b.classList.toggle('on', duel && b.dataset.stake === stakeSel); b.disabled = !duel; });
    $('lb-stake-custom').hidden = !duel || stakeSel !== 'custom'; if (!keepInput) customIn.value = stakeCustom || '';
    const s = getStake(), ok = s >= 1 && s <= 1000;
    $('lb-stake-win').textContent = duel ? (ok ? usd(payout(s)) : '—') : usd(0);
    $('lb-stake-fee').textContent = duel ? (ok ? '−' + usd(feeOf(s)) : '—') : usd(0);
    $('lb-stake-winrow').hidden = false; $('lb-stake-feerow').hidden = false; $('lb-stake-slip').hidden = false;
    // równowartość w SOL (kurs z serwera portfeli); bez kursu – sam znak SOL
    const px = acct && acct.price, sol = v => (v / px).toLocaleString(LANG === 'en' ? 'en-US' : LANG, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    stakeBox.querySelectorAll('[data-sol]').forEach(el => { el.textContent = px ? '≈ ' + sol(+el.dataset.sol) + ' SOL' : 'SOL'; });
    $('lb-stake-sol').innerHTML = duel && ok && px && stakeSel === 'custom' ? '≈ <b>' + sol(s) + ' SOL</b>' : '';   // własna kwota: SOL obok etykiety (gotowe kwoty mają SOL na kafelku)
    $('lb-stake-x').textContent = duel && ok ? '×' + (payout(s) / s).toFixed(2) : '';
    $('lb-play-sub').textContent = ''; $('lb-play-sub').hidden = true;   // sam duży napis – stawka jest opisana wyżej
    $('lb-play').querySelector('.lb-pl').textContent = acct ? t('play') : t('play.login');   // bez konta: LOG IN
  }

  // ---- losowanie mapy ----
  const draw = $('lb-draw'), reel = $('lb-reel');
  function runDraw(stake, cb) {
    const N = 32, win = N - 4, pick = DUEL_MAPS[Math.floor(Math.random() * DUEL_MAPS.length)];
    const seq = Array.from({ length: N }, (_, i) => i === win ? pick : DUEL_MAPS[(i + Math.floor(Math.random() * 2)) % DUEL_MAPS.length]);
    reel.innerHTML = seq.map((m, i) => `<div class="lb-mcard" data-i="${i}">${MAP_ART[m](i)}<img src="${MAP_IMG[m]}" alt="" draggable="false" onerror="this.remove()"><span><i>1v1</i>${m.toUpperCase()}</span></div>`).join('');
    $('lb-draw-res').textContent = ''; draw.classList.remove('done'); draw.hidden = false;
    $('lb-draw-stake').innerHTML = `${t('stake.label')}: <b>${usd(stake)}</b> · ${t('stake.win')}: <b>${usd(payout(stake))}</b>`;
    reel.style.transition = 'none'; reel.style.transform = 'translateX(0)';
    const c0 = reel.firstElementChild, cw = c0.offsetWidth, cardW = cw + (parseFloat(getComputedStyle(reel).columnGap) || 16), view = reel.parentElement.clientWidth;
    const stop = win * cardW - (view / 2 - cw / 2), target = stop + (Math.random() - .5) * cw * .6;
    requestAnimationFrame(() => requestAnimationFrame(() => { reel.style.transition = 'transform 4.2s cubic-bezier(.08,.62,.1,1)'; reel.style.transform = `translateX(${-target}px)`; }));
    let lastIdx = -1; const t0 = performance.now();
    (function tickLoop() {                               // tyknięcie przy każdej karcie mijającej wskaźnik
      const m = getComputedStyle(reel).transform, x = m && m !== 'none' ? new DOMMatrixReadOnly(m).m41 : 0, idx = Math.floor((-x + view / 2) / cardW);
      if (idx !== lastIdx) { if (lastIdx >= 0) SFX.tick(); lastIdx = idx; }
      if (performance.now() - t0 < 4600 && !draw.hidden) requestAnimationFrame(tickLoop);
    })();
    setTimeout(() => { reel.style.transition = 'transform .35s ease'; reel.style.transform = `translateX(${-stop}px)`; }, 4300);
    setTimeout(() => { SFX.reveal(); reel.querySelector(`[data-i="${win}"]`).classList.add('win'); draw.classList.add('done'); $('lb-draw-res').textContent = t('draw.map') + ': ' + pick.toUpperCase(); }, 4700);
    setTimeout(() => { draw.hidden = true; cb(pick); }, 6100);
  }

  // ---- start gry ----
  let activeStake = 0, lastStake = 0, busy = false, lastMap = null;
  async function requestPlay() {
    if (busy) return;
    const m = ctx.getMode();
    if (m !== '1v1') { lastStake = 0; SFX.play(); ctx.play(m, {}); return; }
    const s = getStake();
    if (!(s >= 1 && s <= 1000)) return toast(t('stake.invalid'), 'err');
    if (!acct) { toast(t('err.loginToPlay')); openModal('lb-auth'); showTab('lb-auth', 'login'); return; }
    if (acct.balance < s) { toast(t('err.funds'), 'err'); openWallet('deposit'); return; }
    if (!W) return toast(t('err.needServer'), 'err');   // 1v1 to mecz z prawdziwym graczem: potrzebny serwer gry (kolejka)
    if (W) { busy = true;   // stawka pobierana z salda na serwerze (w SOL po bieżącym kursie)
      try { activeMatch = await W.startMatch(s); activeStake = lastStake = s; }
      catch (er) { busy = false; if (er.code === 'funds') { toast(t('err.funds'), 'err'); openWallet('deposit'); } else toast(er.message || t('auth.errDb'), 'err'); return; }
      SFX.play(); busy = false; ctx.play(m, { stake: s, matchId: activeMatch }); return; }
    busy = true;
    try { await addTx(-s, 'stake'); activeStake = lastStake = s; } catch { busy = false; return toast(t('auth.errDb'), 'err'); }
    SFX.play(); busy = false; ctx.play(m, { stake: s });   // najpierw szukanie przeciwnika, losowanie mapy dopiero potem (match.js: search → found → draw → load)
  }
  addEventListener('fasolka:match', async e => {
    if (!activeStake || !acct) return; const s = activeStake; activeStake = 0;
    const won = !!(e.detail && e.detail.won);
    if (W) { const id = activeMatch; activeMatch = null; sendStats(); W.endMatch(id, won, false, lastMap).catch(er => toast(er.message, 'err')); return; }
    if (won) await addTx(payout(s), 'win', '', { fee: feeOf(s) }); else await addTx(0, 'loss', usd(s));
    logMatch({ stake: s, won, payout: won ? payout(s) : 0, fee: won ? feeOf(s) : 0 });   // panel admina: lista meczów
  });
  addEventListener('fasolka:cancelled', e => {
    activeStake = 0; lastStake = 0; activeMatch = null; busy = false;
    if (W) W.refresh().catch(() => {}); renderAll();
    const msg = e.detail && e.detail.message; if (msg) toast(msg, 'err');
  });
  addEventListener('fasolka:rematch', e => {
    if (!lastStake) return;
    if (!acct || acct.balance < lastStake) { e.detail.ok = false; toast(t('err.rematchFunds'), 'err'); lastStake = 0; return; }
    if (W) { activeStake = lastStake; W.startMatch(lastStake).then(id => { activeMatch = id; }).catch(er => { activeStake = 0; toast(er.message, 'err'); }); return; }
    activeStake = lastStake; addTx(-lastStake, 'stake');
  });

  function renderAll() { renderTop(); renderStake(); renderAuth(); renderWallet(); if (P) P.render(); }
  // ---- zakładka Business (ustawienia): e-mail do zapytań biznesowych, regulamin, polityka prywatności ----
  var bizDoc = null, bizEmail = OPERATOR.businessEmail, BIZ_IC = {
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    copy: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>', brief: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>' };
  function renderBiz() {
    const box = $('lb-biz'); if (!box || !BIZ_IC) return; const L = LEGAL_TXT[LANG] || LEGAL_TXT.en, m = bizEmail, e = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    if (bizDoc) { box.innerHTML = `<button type="button" class="lb-bizback" data-biz="back">${e(L.back)}</button><div class="lb-doc">${legalDoc(bizDoc, LANG)}</div>`; return; }
    box.innerHTML = `<div class="lb-bizcard"><div class="lb-bizglow"></div><div class="lb-bizic">${BIZ_IC.brief}</div><h4>${e(L.biz)}</h4><p>${e(L.bizD)}</p>
      <div class="lb-mailbox${m ? '' : ' none'}"><i>${BIZ_IC.mail}</i><span><small>${e(L.mailL)}</small><b>${m ? e(m) : e(L.soon)}</b></span>
        ${m ? `<button type="button" class="lb-bizbtn" data-biz="copy">${BIZ_IC.copy}${e(L.copy)}</button><a class="lb-bizbtn pri" href="mailto:${e(m)}?subject=${encodeURIComponent(OPERATOR.brand + ' – business')}">${e(L.write)} ›</a>` : ''}</div></div>
      <h5 class="lb-sec lb-docsh">${e(L.docs)}</h5>
      <div class="lb-docs"><button type="button" class="lb-docbtn t" data-biz="terms"><i>${BIZ_IC.doc}</i><span><b>${e(L.terms)}</b><small>${e(L.termsD)}</small></span><em>›</em></button>
      <button type="button" class="lb-docbtn p" data-biz="privacy"><i>${BIZ_IC.lock}</i><span><b>${e(L.privacy)}</b><small>${e(L.privacyD)}</small></span><em>›</em></button></div>`;
  }
  // e-mail biznesowy ustawia admin (panel admina): serwer portfeli, baza artefaktu albo – lokalnie – ta przeglądarka
  (async () => { try {
    if (API) { const j = await (await fetch(API + '/api/config')).json(); if (j.businessEmail != null) bizEmail = j.businessEmail; }
    else { const db = await dbP; if (db) { const sn = await db.doc('config/business').get(); if (sn.exists) bizEmail = sn.data().email || ''; } else bizEmail = ls.get('fasolka-biz-email') || bizEmail; }
  } catch {} renderBiz(); })();
  addEventListener('fasolka:biz-email', e => { bizEmail = e.detail || ''; renderBiz(); });
  // hasła w lewym panelu okna logowania – admin może je zmienić (panel admina), osobno dla każdego języka
  const applyAuthTexts = o => { for (const l in AUTH_TXT) for (const k of ['tag', 'f1', 'f2', 'f3']) { const v = o && o[l] && o[l][k]; DICT[l]['auth.' + k] = v || AUTH_TXT[l]['auth.' + k]; } applyI18n(); };
  (async () => { try {
    let o = null;
    if (API) { const c = await (await fetch(API + '/api/config')).json(); o = c.authTexts || null; }
    else { const db = await dbP;
      if (db) { const sn = await db.doc('config/auth').get(); if (sn.exists) o = sn.data().texts || null; }
      else o = JSON.parse(ls.get('fasolka-auth-texts') || 'null'); }
    if (o) applyAuthTexts(o);
  } catch {} })();
  addEventListener('fasolka:auth-texts', e => applyAuthTexts(e.detail));
  $('lb-biz').addEventListener('click', async ev => { const b = ev.target.closest('[data-biz]'); if (!b) return; const k = b.dataset.biz;
    if (k === 'copy') { try { await navigator.clipboard.writeText(bizEmail); toast((LEGAL_TXT[LANG] || LEGAL_TXT.en).copied, 'ok'); } catch {} return; }
    bizDoc = k === 'back' ? null : k; renderBiz(); const d = $('lb-biz').querySelector('.lb-doc'); if (d) d.scrollTop = 0; });
  // ---- bez konta: każda interakcja w lobby (poza wyborem języka) otwiera logowanie ----
  const askLogin = () => { closeAll(); openModal('lb-auth'); showTab('lb-auth', 'login'); };
  const GATED = 'button,a,input,select,textarea,label,[role=button],[role=menuitem],[data-act],.lb-tile,.lb-skin,.lb-key';
  ui.addEventListener('click', e => {
    if (acct || e.target.closest('.lb-lang,#lb-auth,.lb-toast,#bl-w')) return;
    if (!e.target.closest(GATED)) return;
    e.preventDefault(); e.stopImmediatePropagation(); askLogin();
  }, true);
  window.__fasolkaGate = () => { if (acct) return false; askLogin(); return true; };   // klik w fasolkę (scena 3D) – lobby.js
  // przywrócenie sesji
  const sid = W ? null : ls.get('fasolka-session');
  if (W) W.restore();
  if (sid) accGet(sid).then(a => { if (a) { acct = a; acctId = sid; ensureStats(acct); renderAll(); } }).catch(() => {});

  // ---- panel admina: osobny link (#admin na końcu adresu gry) albo ukryty skrót Ctrl+Shift+A w lobby; nie ma go w menu ----
  const wantsAdmin = () => /(^|[#?&])admin\b/i.test(location.hash + '&' + location.search);
  let adminLoading = false;
  function openAdminPanel() {
    if (adminLoading) return; adminLoading = true; closeAll();
    import('./admin.js').then(m => m.openAdmin({ onClose: () => { try { if (/admin/i.test(location.hash)) history.replaceState(null, '', location.pathname + location.search); } catch {} } }))
      .catch(() => toast('Nie udało się otworzyć panelu admina', 'err')).finally(() => { adminLoading = false; });
  }
  if (wantsAdmin()) setTimeout(openAdminPanel, 0);
  addEventListener('hashchange', () => { if (wantsAdmin()) openAdminPanel(); });
  addEventListener('keydown', e => { if (e.ctrlKey && e.shiftKey && e.code === 'KeyA' && !isField(e.target) && (!ctx.isActive || ctx.isActive())) { e.preventDefault(); e.stopImmediatePropagation(); openAdminPanel(); } }, true);
  // mapa lobby ustawiona w panelu admina (wspólna dla wszystkich graczy): jeśli inna niż w tej przeglądarce – zapisz i przeładuj raz
  dbP.then(db => db && db.doc('config/lobby').get()).then(sn => {
    const m = sn && sn.exists && sn.data().map;
    if (!m || !ctx.lobbyMaps || !ctx.lobbyMaps.includes(m) || m === ctx.lobbyMap || wantsAdmin()) return;
    ls.set('fasolka-lobby-map', m);
    let done = false; try { done = sessionStorage.getItem('fasolka-lobby-sync') === m; sessionStorage.setItem('fasolka-lobby-sync', m); } catch {}
    if (!done && (!ctx.isActive || ctx.isActive())) location.reload();
  }).catch(() => {});
  applyI18n();

  return {
    requestPlay, closeAll, renderStake,
    onShow() {
      if (W && activeStake && acct) { const id = activeMatch; activeMatch = null; sendStats(); W.endMatch(id, false, true, lastMap).catch(() => {}); activeStake = 0; lastStake = 0; renderAll(); return; }   // wyjście z meczu = przegrana walkowerem
      if (activeStake && acct) { const s = activeStake; addTx(0, 'loss', usd(s)).catch(() => {}); logMatch({ stake: s, won: false, payout: 0, fee: 0, forfeit: true }); }   // wyjście z meczu o stawkę = przegrana
      else if (acct && flushCombat()) saveAcct().catch(() => {});
      activeStake = 0; lastStake = 0; renderAll();
    },
    get open() { return anyOpen() || !draw.hidden; },
  };
}
