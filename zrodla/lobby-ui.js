// Interfejs lobby: menu (☰), ustawienia (głośność, FOV, sterowanie, język), konto (logowanie / rejestracja),
// portfel USDT na Solanie (TRYB TESTOWY – bez prawdziwych transakcji), stawki meczu i losowanie mapy.
// Konta i salda: baza danych artefaktu (claude.use("db")), a poza claude.ai – localStorage.

// ---------------- tłumaczenia ----------------
const DICT = {
  pl: {
    'menu.settings': 'Ustawienia', 'menu.wallet': 'Portfel', 'menu.login': 'Zaloguj się', 'menu.account': 'Konto', 'menu.logout': 'Wyloguj', 'menu.admin': 'Panel admina',
    'top.guest': 'Gość', 'top.signin': 'Zaloguj się',
    'plate.ready': 'GOTOWY', 'plate.skin': 'KLIKNIJ, BY ZMIENIĆ SKIN',
    'mode.label': 'Tryb gry', 'mode.change': 'Zmień', 'mode.range.name': 'Strzelnica', 'mode.range.desc': 'Trening solo – zestrzel czerwone fasolki',
    'mode.1v1.name': '1v1', 'mode.1v1.desc': 'Pojedynek · do 3 wygranych rund · Oaza / Magazyn / Baza',
    'tag.range': 'SOLO', 'tag.1v1': '1 NA 1', 'soon': 'WKRÓTCE',
    'stake.label': 'Stawka', 'stake.custom': 'Własna', 'stake.win': 'Możliwa wygrana', 'stake.free': 'Trening – bez stawki', 'stake.range': 'Kwota 1–1000 USDT', 'stake.invalid': 'Podaj stawkę od 1 do 1000 USDT',
    'play': 'GRAJ', 'picker.title': 'Wybierz tryb', 'done': 'Gotowe', 'skins.title': 'Skiny', 'close': 'Zamknij',
    'set.title': 'Ustawienia', 'set.general': 'Ogólne', 'set.audio': 'Dźwięk', 'set.controls': 'Sterowanie', 'set.lang': 'Język', 'set.volume': 'Głośność', 'set.fov': 'Pole widzenia (FOV)',
    'set.bindHint': 'Kliknij akcję (albo klawisz na klawiaturze) i naciśnij nowy klawisz. Esc anuluje.', 'set.press': 'Naciśnij klawisz…', 'set.reset': 'Przywróć domyślne', 'set.mouse': 'Strzał: lewy przycisk myszy · Celowanie: prawy',
    'act.fwd': 'Do przodu', 'act.back': 'Do tyłu', 'act.left': 'W lewo', 'act.right': 'W prawo', 'act.sprint': 'Bieg', 'act.jump': 'Skok', 'act.crouch': 'Kucanie / slide',
    'act.reload': 'Przeładowanie', 'act.inspect': 'Oglądanie broni', 'act.prev': 'Poprzednia broń', 'act.view': 'Zmiana widoku', 'act.mute': 'Wycisz dźwięk',
    'auth.title': 'Konto', 'auth.login': 'Logowanie', 'auth.register': 'Rejestracja', 'auth.user': 'Nazwa użytkownika', 'auth.pass': 'Hasło', 'auth.pass2': 'Powtórz hasło',
    'auth.doLogin': 'Zaloguj się', 'auth.doRegister': 'Załóż konto', 'auth.userRule': '3–16 znaków: litery, cyfry, _', 'auth.passRule': 'Minimum 6 znaków',
    'auth.errUser': 'Nazwa: 3–16 znaków (litery, cyfry, _)', 'auth.errPass': 'Hasło musi mieć minimum 6 znaków', 'auth.errMatch': 'Hasła się różnią', 'auth.errExists': 'Ta nazwa jest już zajęta',
    'auth.errCreds': 'Nieprawidłowa nazwa lub hasło', 'auth.errDb': 'Baza danych jest niedostępna – spróbuj ponownie', 'auth.welcome': 'Zalogowano jako {u}', 'auth.created': 'Konto utworzone – witaj, {u}!',
    'auth.loggedAs': 'Zalogowano jako', 'auth.since': 'Konto od', 'auth.logout': 'Wyloguj się', 'auth.note': 'Wersja testowa: bez weryfikacji e-mail. Hasło jest haszowane (PBKDF2).',
    'w.title': 'Portfel', 'w.balance': 'Saldo', 'w.test': 'TRYB TESTOWY – środki są wirtualne, nie są wysyłane żadne prawdziwe transakcje.', 'w.network': 'Sieć Solana · token USDT (SPL)',
    'w.deposit': 'Wpłata', 'w.withdraw': 'Wypłata', 'w.history': 'Historia', 'w.amount': 'Kwota (USDT)', 'w.address': 'Adres portfela Solana', 'w.doDeposit': 'Dodaj testowe USDT', 'w.doWithdraw': 'Wypłać (test)',
    'w.depHint': 'W wersji docelowej tu pojawi się adres depozytu po podłączeniu backendu.', 'w.connect': 'Połącz Phantom', 'w.connected': 'Portfel', 'w.noPhantom': 'Nie wykryto portfela Phantom w tej przeglądarce',
    'w.rejected': 'Połączenie odrzucone', 'w.empty': 'Brak operacji', 'w.loginFirst': 'Zaloguj się, aby korzystać z portfela', 'w.errAmount': 'Podaj kwotę od 1 do 10 000 USDT', 'w.errFunds': 'Za mało środków',
    'w.errAddr': 'Nieprawidłowy adres Solana', 'w.depOk': 'Dodano {a} USDT (test)', 'w.wdOk': 'Wypłata {a} USDT zlecona (test)',
    'tx.deposit': 'Wpłata (test)', 'tx.withdraw': 'Wypłata (test)', 'tx.stake': 'Stawka 1v1', 'tx.win': 'Wygrana 1v1', 'tx.loss': 'Przegrana 1v1',
    'err.loginToPlay': 'Zaloguj się, aby grać o stawkę', 'err.funds': 'Za mało środków na stawkę – doładuj portfel', 'err.rematchFunds': 'Za mało środków na kolejny mecz',
    'draw.title': 'Losowanie mapy', 'draw.map': 'Mapa',
    'stake.fee': 'Prowizja (10%)', 'set.vMaster': 'Głośność ogólna', 'set.vMasterD': 'Wszystkie dźwięki', 'set.vMenu': 'Dźwięki w menu', 'set.vMenuD': 'Kliknięcia, okna, losowanie mapy', 'set.vGame': 'Dźwięki w grze', 'set.vGameD': 'Strzały, trafienia, przeładowanie', 'set.preview': 'Odsłuchaj', 'set.secView': 'Widok', 'set.secKeys': 'Klawisze', 'set.fovD': 'Szerszy kąt = więcej widać, mniejsze obiekty', 'tx.fee': 'prowizja {a}', 'set.reserved': 'Ten klawisz jest zarezerwowany (bronie 1–4 i Esc)', 'kb.move': 'Ruch', 'kb.fight': 'Walka', 'kb.sys': 'Inne', 'kb.lmb': 'LPM', 'kb.rmb': 'PPM', 'kb.mmb': 'Kółko', 'kb.fire': 'Strzał', 'kb.aim': 'Celowanie', 'kb.wheel': 'Zmiana broni', 'kb.weapons': 'Broń 1–4', 'kb.pause': 'Pauza', 'kb.alt': 'zapasowy',
  },
  en: {
    'menu.settings': 'Settings', 'menu.wallet': 'Wallet', 'menu.login': 'Log in', 'menu.account': 'Account', 'menu.logout': 'Log out', 'menu.admin': 'Admin panel',
    'top.guest': 'Guest', 'top.signin': 'Log in',
    'plate.ready': 'READY', 'plate.skin': 'CLICK TO CHANGE SKIN',
    'mode.label': 'Game mode', 'mode.change': 'Change', 'mode.range.name': 'Shooting range', 'mode.range.desc': 'Solo practice – shoot the red beans',
    'mode.1v1.name': '1v1', 'mode.1v1.desc': 'Duel · first to 3 rounds · Oasis / Warehouse / Base',
    'tag.range': 'SOLO', 'tag.1v1': '1 VS 1', 'soon': 'SOON',
    'stake.label': 'Stake', 'stake.custom': 'Custom', 'stake.win': 'Potential win', 'stake.free': 'Practice – no stake', 'stake.range': 'Amount 1–1000 USDT', 'stake.invalid': 'Enter a stake between 1 and 1000 USDT',
    'play': 'PLAY', 'picker.title': 'Choose mode', 'done': 'Done', 'skins.title': 'Skins', 'close': 'Close',
    'set.title': 'Settings', 'set.general': 'General', 'set.audio': 'Audio', 'set.controls': 'Controls', 'set.lang': 'Language', 'set.volume': 'Volume', 'set.fov': 'Field of view (FOV)',
    'set.bindHint': 'Click an action (or a key on the keyboard) and press a new key. Esc cancels.', 'set.press': 'Press a key…', 'set.reset': 'Restore defaults', 'set.mouse': 'Fire: left mouse button · Aim: right',
    'act.fwd': 'Forward', 'act.back': 'Back', 'act.left': 'Left', 'act.right': 'Right', 'act.sprint': 'Sprint', 'act.jump': 'Jump', 'act.crouch': 'Crouch / slide',
    'act.reload': 'Reload', 'act.inspect': 'Inspect weapon', 'act.prev': 'Previous weapon', 'act.view': 'Change view', 'act.mute': 'Mute sound',
    'auth.title': 'Account', 'auth.login': 'Log in', 'auth.register': 'Sign up', 'auth.user': 'Username', 'auth.pass': 'Password', 'auth.pass2': 'Repeat password',
    'auth.doLogin': 'Log in', 'auth.doRegister': 'Create account', 'auth.userRule': '3–16 characters: letters, digits, _', 'auth.passRule': 'At least 6 characters',
    'auth.errUser': 'Username: 3–16 characters (letters, digits, _)', 'auth.errPass': 'Password must be at least 6 characters', 'auth.errMatch': 'Passwords do not match', 'auth.errExists': 'This username is taken',
    'auth.errCreds': 'Wrong username or password', 'auth.errDb': 'Database unavailable – try again', 'auth.welcome': 'Logged in as {u}', 'auth.created': 'Account created – welcome, {u}!',
    'auth.loggedAs': 'Logged in as', 'auth.since': 'Member since', 'auth.logout': 'Log out', 'auth.note': 'Test version: no e-mail verification. Passwords are hashed (PBKDF2).',
    'w.title': 'Wallet', 'w.balance': 'Balance', 'w.test': 'TEST MODE – funds are virtual, no real transactions are sent.', 'w.network': 'Solana network · USDT (SPL) token',
    'w.deposit': 'Deposit', 'w.withdraw': 'Withdraw', 'w.history': 'History', 'w.amount': 'Amount (USDT)', 'w.address': 'Solana wallet address', 'w.doDeposit': 'Add test USDT', 'w.doWithdraw': 'Withdraw (test)',
    'w.depHint': 'In production a deposit address will appear here once the backend is connected.', 'w.connect': 'Connect Phantom', 'w.connected': 'Wallet', 'w.noPhantom': 'Phantom wallet not detected in this browser',
    'w.rejected': 'Connection rejected', 'w.empty': 'No transactions', 'w.loginFirst': 'Log in to use the wallet', 'w.errAmount': 'Enter an amount between 1 and 10,000 USDT', 'w.errFunds': 'Insufficient funds',
    'w.errAddr': 'Invalid Solana address', 'w.depOk': 'Added {a} USDT (test)', 'w.wdOk': 'Withdrawal of {a} USDT requested (test)',
    'tx.deposit': 'Deposit (test)', 'tx.withdraw': 'Withdrawal (test)', 'tx.stake': '1v1 stake', 'tx.win': '1v1 win', 'tx.loss': '1v1 loss',
    'err.loginToPlay': 'Log in to play for a stake', 'err.funds': 'Not enough funds for this stake – top up your wallet', 'err.rematchFunds': 'Not enough funds for another match',
    'draw.title': 'Map draw', 'draw.map': 'Map',
    'stake.fee': 'House fee (10%)', 'set.vMaster': 'Master volume', 'set.vMasterD': 'All sounds', 'set.vMenu': 'Menu sounds', 'set.vMenuD': 'Clicks, windows, map draw', 'set.vGame': 'Game sounds', 'set.vGameD': 'Shots, hits, reloads', 'set.preview': 'Preview', 'set.secView': 'View', 'set.secKeys': 'Keys', 'set.fovD': 'Wider angle = see more, smaller objects', 'tx.fee': 'fee {a}', 'set.reserved': 'This key is reserved (weapons 1–4 and Esc)', 'kb.move': 'Movement', 'kb.fight': 'Combat', 'kb.sys': 'Other', 'kb.lmb': 'LMB', 'kb.rmb': 'RMB', 'kb.mmb': 'Wheel', 'kb.fire': 'Fire', 'kb.aim': 'Aim', 'kb.wheel': 'Switch weapon', 'kb.weapons': 'Weapon 1–4', 'kb.pause': 'Pause', 'kb.alt': 'alternate',
  },
  ru: {
    'menu.settings': 'Настройки', 'menu.wallet': 'Кошелёк', 'menu.login': 'Войти', 'menu.account': 'Аккаунт', 'menu.logout': 'Выйти', 'menu.admin': 'Админ-панель',
    'top.guest': 'Гость', 'top.signin': 'Войти',
    'plate.ready': 'ГОТОВ', 'plate.skin': 'НАЖМИ, ЧТОБЫ СМЕНИТЬ СКИН',
    'mode.label': 'Режим игры', 'mode.change': 'Сменить', 'mode.range.name': 'Стрельбище', 'mode.range.desc': 'Соло-тренировка – сбей красные фасолины',
    'mode.1v1.name': '1v1', 'mode.1v1.desc': 'Дуэль · до 3 выигранных раундов · Оазис / Склад / База',
    'tag.range': 'СОЛО', 'tag.1v1': '1 НА 1', 'soon': 'СКОРО',
    'stake.label': 'Ставка', 'stake.custom': 'Своя', 'stake.win': 'Возможный выигрыш', 'stake.free': 'Тренировка – без ставки', 'stake.range': 'Сумма 1–1000 USDT', 'stake.invalid': 'Введите ставку от 1 до 1000 USDT',
    'play': 'ИГРАТЬ', 'picker.title': 'Выбери режим', 'done': 'Готово', 'skins.title': 'Скины', 'close': 'Закрыть',
    'set.title': 'Настройки', 'set.general': 'Общие', 'set.audio': 'Звук', 'set.controls': 'Управление', 'set.lang': 'Язык', 'set.volume': 'Громкость', 'set.fov': 'Поле зрения (FOV)',
    'set.bindHint': 'Нажми на действие (или клавишу на схеме) и выбери новую клавишу. Esc – отмена.', 'set.press': 'Нажми клавишу…', 'set.reset': 'Сбросить', 'set.mouse': 'Выстрел: левая кнопка мыши · Прицел: правая',
    'act.fwd': 'Вперёд', 'act.back': 'Назад', 'act.left': 'Влево', 'act.right': 'Вправо', 'act.sprint': 'Бег', 'act.jump': 'Прыжок', 'act.crouch': 'Присед / подкат',
    'act.reload': 'Перезарядка', 'act.inspect': 'Осмотр оружия', 'act.prev': 'Предыдущее оружие', 'act.view': 'Смена вида', 'act.mute': 'Выключить звук',
    'auth.title': 'Аккаунт', 'auth.login': 'Вход', 'auth.register': 'Регистрация', 'auth.user': 'Имя пользователя', 'auth.pass': 'Пароль', 'auth.pass2': 'Повтори пароль',
    'auth.doLogin': 'Войти', 'auth.doRegister': 'Создать аккаунт', 'auth.userRule': '3–16 символов: буквы, цифры, _', 'auth.passRule': 'Минимум 6 символов',
    'auth.errUser': 'Имя: 3–16 символов (буквы, цифры, _)', 'auth.errPass': 'Пароль – минимум 6 символов', 'auth.errMatch': 'Пароли не совпадают', 'auth.errExists': 'Это имя уже занято',
    'auth.errCreds': 'Неверное имя или пароль', 'auth.errDb': 'База данных недоступна – попробуй ещё раз', 'auth.welcome': 'Вход выполнен: {u}', 'auth.created': 'Аккаунт создан – привет, {u}!',
    'auth.loggedAs': 'Вы вошли как', 'auth.since': 'Аккаунт с', 'auth.logout': 'Выйти', 'auth.note': 'Тестовая версия: без подтверждения e-mail. Пароль хешируется (PBKDF2).',
    'w.title': 'Кошелёк', 'w.balance': 'Баланс', 'w.test': 'ТЕСТОВЫЙ РЕЖИМ – средства виртуальные, реальные транзакции не отправляются.', 'w.network': 'Сеть Solana · токен USDT (SPL)',
    'w.deposit': 'Пополнение', 'w.withdraw': 'Вывод', 'w.history': 'История', 'w.amount': 'Сумма (USDT)', 'w.address': 'Адрес кошелька Solana', 'w.doDeposit': 'Добавить тестовые USDT', 'w.doWithdraw': 'Вывести (тест)',
    'w.depHint': 'В рабочей версии здесь появится адрес для пополнения после подключения бэкенда.', 'w.connect': 'Подключить Phantom', 'w.connected': 'Кошелёк', 'w.noPhantom': 'Кошелёк Phantom не найден в этом браузере',
    'w.rejected': 'Подключение отклонено', 'w.empty': 'Операций нет', 'w.loginFirst': 'Войди, чтобы пользоваться кошельком', 'w.errAmount': 'Введите сумму от 1 до 10 000 USDT', 'w.errFunds': 'Недостаточно средств',
    'w.errAddr': 'Неверный адрес Solana', 'w.depOk': 'Добавлено {a} USDT (тест)', 'w.wdOk': 'Вывод {a} USDT оформлен (тест)',
    'tx.deposit': 'Пополнение (тест)', 'tx.withdraw': 'Вывод (тест)', 'tx.stake': 'Ставка 1v1', 'tx.win': 'Победа 1v1', 'tx.loss': 'Поражение 1v1',
    'err.loginToPlay': 'Войди, чтобы играть на ставку', 'err.funds': 'Недостаточно средств для ставки – пополни кошелёк', 'err.rematchFunds': 'Недостаточно средств для следующего матча',
    'draw.title': 'Выбор карты', 'draw.map': 'Карта',
    'stake.fee': 'Комиссия (10%)', 'set.vMaster': 'Общая громкость', 'set.vMasterD': 'Все звуки', 'set.vMenu': 'Звуки меню', 'set.vMenuD': 'Клики, окна, выбор карты', 'set.vGame': 'Звуки в игре', 'set.vGameD': 'Выстрелы, попадания, перезарядка', 'set.preview': 'Прослушать', 'set.secView': 'Обзор', 'set.secKeys': 'Клавиши', 'set.fovD': 'Шире угол – больше видно, объекты меньше', 'tx.fee': 'комиссия {a}', 'set.reserved': 'Эта клавиша зарезервирована (оружие 1–4 и Esc)', 'kb.move': 'Движение', 'kb.fight': 'Бой', 'kb.sys': 'Прочее', 'kb.lmb': 'ЛКМ', 'kb.rmb': 'ПКМ', 'kb.mmb': 'Колесо', 'kb.fire': 'Выстрел', 'kb.aim': 'Прицел', 'kb.wheel': 'Смена оружия', 'kb.weapons': 'Оружие 1–4', 'kb.pause': 'Пауза', 'kb.alt': 'запасная',
  },
  es: {
    'menu.settings': 'Ajustes', 'menu.wallet': 'Cartera', 'menu.login': 'Iniciar sesión', 'menu.account': 'Cuenta', 'menu.logout': 'Cerrar sesión', 'menu.admin': 'Panel de admin',
    'top.guest': 'Invitado', 'top.signin': 'Iniciar sesión',
    'plate.ready': 'LISTO', 'plate.skin': 'HAZ CLIC PARA CAMBIAR DE SKIN',
    'mode.label': 'Modo de juego', 'mode.change': 'Cambiar', 'mode.range.name': 'Campo de tiro', 'mode.range.desc': 'Práctica en solitario – dispara a las judías rojas',
    'mode.1v1.name': '1v1', 'mode.1v1.desc': 'Duelo · a 3 rondas ganadas · Oasis / Almacén / Base',
    'tag.range': 'SOLO', 'tag.1v1': '1 VS 1', 'soon': 'PRONTO',
    'stake.label': 'Apuesta', 'stake.custom': 'Otra', 'stake.win': 'Ganancia posible', 'stake.free': 'Práctica – sin apuesta', 'stake.range': 'Importe 1–1000 USDT', 'stake.invalid': 'Introduce una apuesta entre 1 y 1000 USDT',
    'play': 'JUGAR', 'picker.title': 'Elige modo', 'done': 'Listo', 'skins.title': 'Skins', 'close': 'Cerrar',
    'set.title': 'Ajustes', 'set.general': 'General', 'set.audio': 'Sonido', 'set.controls': 'Controles', 'set.lang': 'Idioma', 'set.volume': 'Volumen', 'set.fov': 'Campo de visión (FOV)',
    'set.bindHint': 'Haz clic en una acción (o en una tecla del teclado) y pulsa una tecla nueva. Esc cancela.', 'set.press': 'Pulsa una tecla…', 'set.reset': 'Restablecer', 'set.mouse': 'Disparo: botón izquierdo · Apuntar: derecho',
    'act.fwd': 'Adelante', 'act.back': 'Atrás', 'act.left': 'Izquierda', 'act.right': 'Derecha', 'act.sprint': 'Correr', 'act.jump': 'Saltar', 'act.crouch': 'Agacharse / deslizar',
    'act.reload': 'Recargar', 'act.inspect': 'Inspeccionar arma', 'act.prev': 'Arma anterior', 'act.view': 'Cambiar vista', 'act.mute': 'Silenciar',
    'auth.title': 'Cuenta', 'auth.login': 'Iniciar sesión', 'auth.register': 'Registro', 'auth.user': 'Nombre de usuario', 'auth.pass': 'Contraseña', 'auth.pass2': 'Repite la contraseña',
    'auth.doLogin': 'Entrar', 'auth.doRegister': 'Crear cuenta', 'auth.userRule': '3–16 caracteres: letras, números, _', 'auth.passRule': 'Mínimo 6 caracteres',
    'auth.errUser': 'Nombre: 3–16 caracteres (letras, números, _)', 'auth.errPass': 'La contraseña debe tener al menos 6 caracteres', 'auth.errMatch': 'Las contraseñas no coinciden', 'auth.errExists': 'Ese nombre ya está en uso',
    'auth.errCreds': 'Usuario o contraseña incorrectos', 'auth.errDb': 'Base de datos no disponible – inténtalo de nuevo', 'auth.welcome': 'Sesión iniciada como {u}', 'auth.created': 'Cuenta creada – ¡bienvenido, {u}!',
    'auth.loggedAs': 'Sesión iniciada como', 'auth.since': 'Miembro desde', 'auth.logout': 'Cerrar sesión', 'auth.note': 'Versión de prueba: sin verificación de e-mail. La contraseña se guarda con hash (PBKDF2).',
    'w.title': 'Cartera', 'w.balance': 'Saldo', 'w.test': 'MODO DE PRUEBA – los fondos son virtuales, no se envían transacciones reales.', 'w.network': 'Red Solana · token USDT (SPL)',
    'w.deposit': 'Depósito', 'w.withdraw': 'Retiro', 'w.history': 'Historial', 'w.amount': 'Importe (USDT)', 'w.address': 'Dirección de cartera Solana', 'w.doDeposit': 'Añadir USDT de prueba', 'w.doWithdraw': 'Retirar (prueba)',
    'w.depHint': 'En la versión final aquí aparecerá la dirección de depósito al conectar el backend.', 'w.connect': 'Conectar Phantom', 'w.connected': 'Cartera', 'w.noPhantom': 'No se detectó Phantom en este navegador',
    'w.rejected': 'Conexión rechazada', 'w.empty': 'Sin operaciones', 'w.loginFirst': 'Inicia sesión para usar la cartera', 'w.errAmount': 'Introduce un importe entre 1 y 10 000 USDT', 'w.errFunds': 'Fondos insuficientes',
    'w.errAddr': 'Dirección de Solana no válida', 'w.depOk': 'Añadidos {a} USDT (prueba)', 'w.wdOk': 'Retiro de {a} USDT solicitado (prueba)',
    'tx.deposit': 'Depósito (prueba)', 'tx.withdraw': 'Retiro (prueba)', 'tx.stake': 'Apuesta 1v1', 'tx.win': 'Victoria 1v1', 'tx.loss': 'Derrota 1v1',
    'err.loginToPlay': 'Inicia sesión para jugar con apuesta', 'err.funds': 'Fondos insuficientes para la apuesta – recarga la cartera', 'err.rematchFunds': 'Fondos insuficientes para otra partida',
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
let LANG = 'pl';
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
const MAP_IMG = { Oaza: new URL('./maps/oaza.jpg', import.meta.url).href, Magazyn: new URL('./maps/magazyn.jpg', import.meta.url).href, Baza: new URL('./maps/baza.jpg', import.meta.url).href };
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
  let S = { lang: 'pl', volume: 80, vMenu: 70, vGame: 100, fov: 78, binds: { ...defBinds } };
  try { const v = JSON.parse(ls.get('fasolka-settings') || 'null'); if (v) S = { ...S, ...v, binds: { ...defBinds, ...(v.binds || {}) } }; } catch {}
  if (!DICT[S.lang]) S.lang = 'pl';
  LANG = S.lang;
  let pushT = 0;
  const pushSettings = () => { ls.set('fasolka-settings', JSON.stringify(S)); clearTimeout(pushT);
    pushT = setTimeout(sendSettings, 30); applyUiVol(); };
  // gra dostaje głośność = ogólna × dźwięki w grze; dźwięki menu gra lobby (ogólna × menu)
  const sendSettings = () => dispatchEvent(new CustomEvent('fasolka:settings', { detail: { volume: (S.volume / 100) * (S.vGame / 100), fov: S.fov } }));
  setTimeout(sendSettings, 0);

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
  function noiseHit(vol) {                            // podgląd „dźwięku w grze”: krótki wystrzał
    const ac = audio(); if (!ac || vol <= 0) return;
    const t0 = ac.currentTime, len = Math.floor(ac.sampleRate * .3), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = ac.createBufferSource(), lp = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = buf; lp.type = 'lowpass'; lp.frequency.setValueAtTime(5000, t0); lp.frequency.exponentialRampToValueAtTime(400, t0 + .25);
    g.gain.setValueAtTime(.9 * vol, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + .28);
    src.connect(lp).connect(g).connect(ac.destination); src.start(t0);
    const o = ac.createOscillator(), og = ac.createGain(); o.frequency.setValueAtTime(140, t0); o.frequency.exponentialRampToValueAtTime(40, t0 + .15);
    og.gain.setValueAtTime(.8 * vol, t0); og.gain.exponentialRampToValueAtTime(.001, t0 + .18); o.connect(og).connect(ac.destination); o.start(t0); o.stop(t0 + .2);
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
    ({ settings: () => openModal('lb-set'), wallet: () => openWallet(), auth: () => openModal('lb-auth'), logout: () => logout(), admin: () => ctx.openAdmin() })[b.dataset.act](); });

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
    b.querySelector('span').textContent = l.name; b.addEventListener('click', () => { S.lang = l.id; LANG = l.id; pushSettings(); applyI18n(); }); langBox.appendChild(b); });
  const fillRange = r => r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%');
  const preview = k => k === 'vGame' ? noiseHit((S.volume / 100) * (S.vGame / 100)) : k === 'vMenu' ? SFX.reveal() : (tone({ f: 660, d: .12, g: .5, type: 'triangle', out: masterOut() }));
  const masterOut = () => { const ac = audio(); if (!ac) return null; const g = ac.createGain(); g.gain.value = S.volume / 100 * .3; g.connect(ac.destination); return g; };
  ui.querySelectorAll('.lb-vrow').forEach(row => { const k = row.dataset.k, r = row.querySelector('input'), last = { v: S[k] || 80 };
    r.addEventListener('input', () => { S[k] = +r.value; if (S[k]) last.v = S[k]; renderVol(); pushSettings(); });
    r.addEventListener('change', () => preview(k));
    row.querySelector('.lb-vic').addEventListener('click', () => { S[k] = S[k] ? 0 : last.v; renderVol(); pushSettings(); if (S[k]) preview(k); });
    row.querySelector('.lb-vplay').addEventListener('click', () => preview(k)); });
  function renderVol() { ui.querySelectorAll('.lb-vrow').forEach(row => { const k = row.dataset.k, r = row.querySelector('input'); r.value = S[k]; fillRange(r);
    row.querySelector('.lb-vval').textContent = S[k] + '%'; row.classList.toggle('muted', !S[k]); }); }
  const wedge = $('lb-fov-wedge');
  function renderFov() { fovR.value = S.fov; fillRange(fovR); $('lb-fov-v').textContent = S.fov + '°';
    const h = S.fov / 2 * Math.PI / 180, R = 52, x1 = 60 - R * Math.sin(h), x2 = 60 + R * Math.sin(h), y = 58 - R * Math.cos(h);
    wedge.setAttribute('d', `M60 58L${x1.toFixed(1)} ${y.toFixed(1)}A${R} ${R} 0 0 1 ${x2.toFixed(1)} ${y.toFixed(1)}Z`); }
  fovR.addEventListener('input', () => { S.fov = +fovR.value; renderFov(); pushSettings(); });
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
    langBox.querySelectorAll('.lb-seg').forEach(b => b.classList.toggle('on', b.dataset.lang === S.lang));
    renderVol(); renderFov();
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
  const saveAcct = async () => { if (acct) await accSet(acctId, acct); };
  const setErr = (id, msg) => { const el = $(id); el.textContent = msg || ''; el.hidden = !msg; };
  $('lb-login-form').addEventListener('submit', async e => { e.preventDefault(); setErr('lb-login-err');
    const u = $('lb-l-user').value.trim(), p = $('lb-l-pass').value, id = u.toLowerCase();
    if (!/^[a-z0-9_]{3,16}$/.test(id) || p.length < 6) return setErr('lb-login-err', t('auth.errCreds'));
    const btn = e.submitter || e.target.querySelector('[type=submit]'); btn.disabled = true;
    try { const a = await accGet(id); if (!a) throw 'creds'; const h = await hashPw(p, a.salt); if (h.hash !== a.hash) throw 'creds';
      acct = a; acctId = id; ls.set('fasolka-session', id); $('lb-l-pass').value = ''; closeAll(); toast(t('auth.welcome', { u: a.username }), 'ok'); renderAll(); }
    catch (err) { setErr('lb-login-err', err === 'creds' ? t('auth.errCreds') : t('auth.errDb')); } finally { btn.disabled = false; } });
  $('lb-reg-form').addEventListener('submit', async e => { e.preventDefault(); setErr('lb-reg-err');
    const u = $('lb-r-user').value.trim(), p = $('lb-r-pass').value, p2 = $('lb-r-pass2').value, id = u.toLowerCase();
    if (!/^[a-z0-9_]{3,16}$/i.test(u)) return setErr('lb-reg-err', t('auth.errUser'));
    if (p.length < 6) return setErr('lb-reg-err', t('auth.errPass'));
    if (p !== p2) return setErr('lb-reg-err', t('auth.errMatch'));
    const btn = e.submitter || e.target.querySelector('[type=submit]'); btn.disabled = true;
    try { if (await accGet(id)) throw 'exists'; const h = await hashPw(p);
      const a = { username: u, salt: h.salt, hash: h.hash, kdf: 'pbkdf2-sha256-150k', createdAt: new Date().toISOString(), balance: 0, wallet: '', history: [] };
      await accSet(id, a); acct = a; acctId = id; ls.set('fasolka-session', id); ['lb-r-pass', 'lb-r-pass2'].forEach(k => $(k).value = ''); closeAll(); toast(t('auth.created', { u }), 'ok'); renderAll(); }
    catch (err) { setErr('lb-reg-err', err === 'exists' ? t('auth.errExists') : t('auth.errDb')); } finally { btn.disabled = false; } });
  $('lb-logout').addEventListener('click', () => logout());
  function logout() { acct = null; acctId = null; ls.del('fasolka-session'); closeAll(); renderAll(); }
  function renderAuth() {
    const inBox = $('lb-auth-in'), outBox = $('lb-auth-out');
    inBox.hidden = !acct; outBox.hidden = !!acct;
    if (acct) { $('lb-me-av').textContent = acct.username[0].toUpperCase(); $('lb-me-name').textContent = acct.username; $('lb-me-since').textContent = new Date(acct.createdAt).toLocaleDateString(LANG); }
  }

  // ---- portfel (test) ----
  const addTx = async (amount, type, note = '', extra = {}) => { acct.balance = Math.round((acct.balance + amount) * 100) / 100;
    acct.history = [{ t: Date.now(), type, amount, note, ...extra }, ...(acct.history || [])].slice(0, 40); await saveAcct(); renderAll(); };
  function openWallet(tab = 'deposit') { if (!acct) { toast(t('w.loginFirst')); openModal('lb-auth'); showTab('lb-auth', 'login'); return; } openModal('lb-wallet'); showTab('lb-wallet', tab); }
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
    const bal = acct ? money(acct.balance) : '—';
    $('lb-w-bal').textContent = bal; $('lb-wd-addr').value = $('lb-wd-addr').value || (acct && acct.wallet) || '';
    $('lb-w-addr').textContent = acct && acct.wallet ? acct.wallet.slice(0, 6) + '…' + acct.wallet.slice(-6) : '';
    $('lb-phantom').classList.toggle('on', !!(acct && acct.wallet));
    const list = $('lb-hist'); list.innerHTML = '';
    const hist = (acct && acct.history) || [];
    if (!hist.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = t('w.empty'); list.appendChild(li); }
    for (const h of hist) { const li = document.createElement('li'); li.innerHTML = '<div><b></b><small></small></div><span></span>';
      const note = h.fee ? t('tx.fee', { a: money(h.fee) }) : h.note; li.querySelector('b').textContent = t('tx.' + h.type) + (note ? ' · ' + note : ''); li.querySelector('small').textContent = new Date(h.t).toLocaleString(LANG);
      const sp = li.querySelector('span'); sp.textContent = h.amount ? (h.amount > 0 ? '+' : '−') + money(Math.abs(h.amount)) + ' USDT' : ''; sp.className = h.amount > 0 ? 'pos' : h.amount < 0 ? 'neg' : '';
      list.appendChild(li); }
  }

  // ---- pasek górny ----
  function renderTop() {
    $('lb-acct-name').textContent = acct ? acct.username : t('top.signin');
    $('lb-acct-av').textContent = acct ? acct.username[0].toUpperCase() : '?';
    $('lb-bal').textContent = acct ? money(acct.balance) : '—';
    ctx.setName(acct ? acct.username : t('top.guest'));
    menu.querySelector('[data-act="auth"] span').textContent = acct ? t('menu.account') : t('menu.login');
    menu.querySelector('[data-act="logout"]').hidden = !acct;
  }
  $('lb-acct').addEventListener('click', () => { openModal('lb-auth'); if (!acct) showTab('lb-auth', 'login'); });
  $('lb-walletchip').addEventListener('click', () => openWallet());

  // ---- stawka ----
  let stakeSel = ls.get('fasolka-stake-sel') || '10', stakeCustom = +(ls.get('fasolka-stake-custom') || 50);
  const stakeBox = $('lb-stake'), customIn = $('lb-stake-in');
  stakeBox.querySelectorAll('[data-stake]').forEach(b => b.addEventListener('click', () => { stakeSel = b.dataset.stake; ls.set('fasolka-stake-sel', stakeSel); renderStake(); if (stakeSel === 'custom') customIn.focus(); }));
  customIn.addEventListener('input', () => { stakeCustom = Math.floor(+customIn.value); ls.set('fasolka-stake-custom', String(stakeCustom)); renderStake(true); });
  const getStake = () => stakeSel === 'custom' ? stakeCustom : +stakeSel;
  function renderStake(keepInput) {
    const duel = ctx.getMode() === '1v1';
    $('lb-stake-wrap').classList.toggle('off', !duel);
    $('lb-stake-free').hidden = duel; stakeBox.hidden = !duel;
    stakeBox.querySelectorAll('[data-stake]').forEach(b => b.classList.toggle('on', b.dataset.stake === stakeSel));
    $('lb-stake-custom').hidden = stakeSel !== 'custom'; if (!keepInput) customIn.value = stakeCustom || '';
    const s = getStake(), ok = s >= 1 && s <= 1000;
    $('lb-stake-win').textContent = duel ? (ok ? money(payout(s)) + ' USDT' : '—') : '';
    $('lb-stake-fee').textContent = duel && ok ? '−' + money(feeOf(s)) + ' USDT' : '—';
    $('lb-stake-winrow').hidden = !duel; $('lb-stake-feerow').hidden = !duel;
    $('lb-play-sub').textContent = duel ? (ok ? money(s) + ' USDT' : t('stake.range')) : t('stake.free');
  }

  // ---- losowanie mapy ----
  const draw = $('lb-draw'), reel = $('lb-reel');
  function runDraw(stake, cb) {
    const N = 32, win = N - 4, pick = DUEL_MAPS[Math.floor(Math.random() * DUEL_MAPS.length)];
    const seq = Array.from({ length: N }, (_, i) => i === win ? pick : DUEL_MAPS[(i + Math.floor(Math.random() * 2)) % DUEL_MAPS.length]);
    reel.innerHTML = seq.map((m, i) => `<div class="lb-mcard" data-i="${i}">${MAP_ART[m](i)}<img src="${MAP_IMG[m]}" alt="" draggable="false" onerror="this.remove()"><span><i>1v1</i>${m.toUpperCase()}</span></div>`).join('');
    $('lb-draw-res').textContent = ''; draw.classList.remove('done'); draw.hidden = false;
    $('lb-draw-stake').innerHTML = `${t('stake.label')}: <b>${money(stake)} USDT</b> · ${t('stake.win')}: <b>${money(payout(stake))} USDT</b>`;
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
  let activeStake = 0, lastStake = 0, busy = false;
  async function requestPlay() {
    if (busy) return;
    const m = ctx.getMode();
    if (m !== '1v1') { lastStake = 0; SFX.play(); ctx.play(m, {}); return; }
    const s = getStake();
    if (!(s >= 1 && s <= 1000)) return toast(t('stake.invalid'), 'err');
    if (!acct) { toast(t('err.loginToPlay')); openModal('lb-auth'); showTab('lb-auth', 'login'); return; }
    if (acct.balance < s) { toast(t('err.funds'), 'err'); openWallet('deposit'); return; }
    busy = true;
    try { await addTx(-s, 'stake'); activeStake = lastStake = s; } catch { busy = false; return toast(t('auth.errDb'), 'err'); }
    SFX.play(); runDraw(s, map => { busy = false; ctx.play(m, { map, stake: s }); });
  }
  addEventListener('fasolka:match', async e => {
    if (!activeStake || !acct) return; const s = activeStake; activeStake = 0;
    if (e.detail && e.detail.won) await addTx(payout(s), 'win', '', { fee: feeOf(s) }); else await addTx(0, 'loss', money(s) + ' USDT');
  });
  addEventListener('fasolka:rematch', e => {
    if (!lastStake) return;
    if (!acct || acct.balance < lastStake) { e.detail.ok = false; toast(t('err.rematchFunds'), 'err'); lastStake = 0; return; }
    activeStake = lastStake; addTx(-lastStake, 'stake');
  });

  function renderAll() { renderTop(); renderStake(); renderAuth(); renderWallet(); }
  // przywrócenie sesji
  const sid = ls.get('fasolka-session');
  if (sid) accGet(sid).then(a => { if (a) { acct = a; acctId = sid; renderAll(); } }).catch(() => {});
  applyI18n();

  return {
    requestPlay, closeAll, renderStake,
    onShow() { if (activeStake && acct) addTx(0, 'loss', money(activeStake) + ' USDT').catch(() => {}); activeStake = 0; lastStake = 0; renderAll(); },   // wyjście z meczu o stawkę = przegrana
    get open() { return anyOpen() || !draw.hidden; },
  };
}
