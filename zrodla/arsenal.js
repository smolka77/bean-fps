// Arsenał w lobby: sklep z broniami odblokowywanymi za trzymanie tokenu (serwer: serwer/arsenal.mjs).
// Na start każdy ma pistolet (Glock-17); każda inna broń ma próg – ile tokenów musi leżeć na adresie depozytu gracza w grze.
// Odblokowane bronie działają w 1v1 i w Deathmatch (tam: można je kupić w sklepie meczu); Z botem i Strzelnica – wszystkie bronie.
// Użycie (lobby-ui.js): createArsenal({ root, getLang, toast, sfx, wallet: () => W, acct: () => konto, art: () => {id: dataURL}, openAuth })
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { WEAPON_STATS, createWeapon } from './weaponry.js';
import { WSKINS, WSKIN, TIER_RANK, applyWeaponSkin, chooseSkin, chosen, setWskinRank } from './weapon-skins.js';
import { srvText } from './wallet.js';

// ---- podgląd 3D broni: obracanie (przeciągnij), przybliżanie (kółko), reset (2× klik), płynne przejście przy zmianie broni ----
const PISTOLS = new Set(['glock17', 'deagle']);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOutBack = (t) => { const c1 = 1.35, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t) => t * t * t;
const wrapPi = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
function createViewer(host, onInput = () => {}) {
  let r;
  try { r = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { return null; }
  if (!r.getContext()) return null;
  r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); r.setClearColor(0x000000, 0);
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1;
  const cv = r.domElement; cv.className = 'ars-3d'; host.appendChild(cv);
  const sc = new THREE.Scene();
  try { const pm = new THREE.PMREMGenerator(r); sc.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); sc.environmentIntensity = 0.85; } catch {}
  sc.add(new THREE.HemisphereLight(0xfff4fb, 0x2a1430, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(4, 5, 2); sc.add(key);
  const rim = new THREE.DirectionalLight(0xff6ab4, 1.6); rim.position.set(-3, 2, -4); sc.add(rim);
  const cam = new THREE.PerspectiveCamera(26, 2.4, 0.05, 50);   // kamera z boku (+X): lufa w prawo
  const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  // model: środek pudełka w (0,0,0), najdłuższy wymiar = 1 (pistolety 0,6); pivot = przechył, spin = obrót wokół pionu
  const models = new Map();
  function model(id) {
    let m = models.get(id); if (m) return m;
    const g = createWeapon(id, { fx: false }).group; g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    g.position.sub(c);
    // skala jak w rzeczywistości (0,95 m = 1 jednostka kadru), ale krótka broń nie mniej niż 0,5–0,62 długości, a żadna nie za wysoka ani za długa
    const len = Math.max(size.z, size.x, 1e-3), h = Math.max(size.y, 1e-3);
    let k = 1 / 0.95; if (len * k < (PISTOLS.has(id) ? 0.5 : 0.62)) k = (PISTOLS.has(id) ? 0.5 : 0.62) / len; if (h * k > 0.42) k = 0.42 / h; if (len * k > 1) k = 1 / len;
    const inner = new THREE.Group(); inner.add(g); inner.scale.setScalar(k);
    const spin = new THREE.Group(); spin.add(inner);
    const pivot = new THREE.Group(); pivot.add(spin);
    m = { pivot, spin, g }; models.set(id, m); return m;
  }
  const DEF = { yaw: -0.3, pitch: 0.12 };
  const V = { yaw: DEF.yaw, pitch: DEF.pitch, vy: 0, vp: 0, zoom: 1, zoomT: 1, idle: 9, t: 0, drag: null, lastMove: 0 };
  let cur = null, curId = '', inT = 1, dir = 1; const outs = [];
  function show(id, d = 1) {
    if (id === curId) return;
    if (cur) outs.push({ m: cur, t: 0, dir: d });
    cur = model(id); curId = id; inT = reduce ? 1 : 0; dir = d;
    for (let i = outs.length - 1; i >= 0; i--) if (outs[i].m === cur) outs.splice(i, 1);   // wraca broń, która jeszcze odjeżdżała
    sc.add(cur.pivot);
  }
  let fitD = 1;
  function resize() {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    const tan = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    fitD = Math.max(0.54 / (tan * cam.aspect), 0.34 / tan);          // cała broń mieści się w kadrze (z małym zapasem na obrót)
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null; if (ro) ro.observe(host); else addEventListener('resize', resize);
  function step(dt) {
    V.t += dt; V.idle += dt;
    if (!V.drag) {
      V.yaw += V.vy * dt; V.pitch = clamp(V.pitch + V.vp * dt, -0.75, 0.75);
      const k = Math.exp(-3.2 * dt); V.vy *= k; V.vp *= k;
      // po chwili bez ruchu broń wraca do ustawienia sklepowego i lekko się kołysze
      if (V.idle > 2.6 && Math.abs(V.vy) < 0.3) {
        const ty = DEF.yaw + (reduce ? 0 : 0.26 * Math.sin(V.t * 0.55)), a = 1 - Math.exp(-1.6 * dt);
        V.yaw = ty + wrapPi(V.yaw - ty); V.yaw += (ty - V.yaw) * a; V.pitch += (DEF.pitch - V.pitch) * a;
      }
    }
    V.zoom += (V.zoomT - V.zoom) * (1 - Math.exp(-10 * dt));
    cam.position.set(fitD / V.zoom, 0, 0); cam.lookAt(0, 0, 0);
    if (cur) {
      inT = Math.min(1, inT + dt / 0.55);
      const e = easeOutCubic(inT), s = 0.55 + 0.45 * easeOutBack(inT);
      cur.pivot.position.set(0, 0, -1.25 * dir * (1 - e)); cur.pivot.scale.setScalar(s);
      cur.pivot.rotation.z = -V.pitch; cur.spin.rotation.y = V.yaw + 1.15 * dir * (1 - e);
    }
    for (let i = outs.length - 1; i >= 0; i--) {
      const o = outs[i]; o.t = Math.min(1, o.t + dt / (reduce ? 0.01 : 0.32)); const e = easeInCubic(o.t);
      o.m.pivot.position.set(0, 0, 1.25 * o.dir * e); o.m.pivot.scale.setScalar(Math.max(0.01, 1 - 0.55 * e));
      o.m.pivot.rotation.z = -V.pitch; o.m.spin.rotation.y = V.yaw - 0.9 * o.dir * e;
      if (o.t >= 1) { sc.remove(o.m.pivot); outs.splice(i, 1); }
    }
  }
  let raf = 0, last = 0;
  const frame = (now) => { raf = requestAnimationFrame(frame); const dt = Math.min(0.1, last ? (now - last) / 1000 : 0); last = now; step(dt); r.render(sc, cam); };
  // przeciąganie (mysz / palec), bezwładność po puszczeniu
  cv.addEventListener('pointerdown', (e) => { if (e.button > 0) return; V.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() }; V.vy = V.vp = 0; V.idle = 0;
    try { cv.setPointerCapture(e.pointerId); } catch {} cv.classList.add('drag'); onInput(); });
  cv.addEventListener('pointermove', (e) => {
    const d = V.drag; if (!d || d.id !== e.pointerId) return;
    const now = performance.now(), dt = Math.max(8, now - d.t) / 1000, dx = e.clientX - d.x, dy = e.clientY - d.y;
    V.yaw += dx * 0.011; V.pitch = clamp(V.pitch + dy * 0.007, -0.75, 0.75);
    V.vy = clamp(V.vy * 0.4 + (dx * 0.011 / dt) * 0.6, -14, 14); V.vp = clamp(V.vp * 0.4 + (dy * 0.007 / dt) * 0.6, -6, 6);
    d.x = e.clientX; d.y = e.clientY; d.t = now; V.lastMove = now; V.idle = 0;
  });
  const end = (e) => { const d = V.drag; if (!d || d.id !== e.pointerId) return; V.drag = null; cv.classList.remove('drag'); if (performance.now() - V.lastMove > 90) V.vy = V.vp = 0; };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end); cv.addEventListener('lostpointercapture', end);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); V.zoomT = clamp(V.zoomT * Math.exp(-e.deltaY * 0.0012), 0.7, 1.9); V.idle = 0; onInput(); }, { passive: false });
  cv.addEventListener('dblclick', () => { V.zoomT = 1; V.vy = V.vp = 0; V.idle = 99; });
  return {
    show, resize,
    start() { if (!raf) { resize(); last = 0; raf = requestAnimationFrame(frame); } },
    stop() { if (raf) cancelAnimationFrame(raf); raf = 0; },
    setLocked(v) { cv.classList.toggle('lk', !!v); },
    setSkin(id, sk) { const m = model(id); if ((m.g.userData.wskin || '') !== (sk || '')) applyWeaponSkin(m.g, sk); },
  };
}

const TXT = {
  pl: { title: 'Ekwipunek', sub: 'Na start masz pistolet. Trzymaj token na swoim adresie w grze, a odblokujesz resztę broni.',
    subSol: 'Na start masz pistolet. Miej SOL na saldzie w grze, a odblokujesz resztę broni – nic się nie pobiera, liczy się samo saldo.',
    howSol: 'Wpłać SOL na swoje saldo w grze i po prostu je trzymaj. Broń nic nie kosztuje – SOL zostaje na koncie. Gdy saldo spadnie poniżej progu, broń znów się zablokuje.', deposit: 'Wpłać SOL',
    tile: 'Ekwipunek', tileOf: '{n} / {m} broni', tileOff: 'Bronie i odblokowania', balance: 'Twoje saldo', refresh: 'Sprawdź saldo', checking: 'Sprawdzam…',
    ago: 'sprawdzone {t} temu', now: 'sprawdzone przed chwilą', base: 'W zestawie', open: 'Odblokowane', all: 'Dostępne', need: 'Trzymaj', missing: 'Brakuje {n}',
    have: 'Masz tę broń', free: 'Za darmo – dostępna dla każdego', haveBase: 'Pistolet startowy – zawsze w zestawie', modes: 'Działa w 1v1 i Deathmatch (drabinka broni za zabójstwa daje tylko odblokowane bronie). Z botem i w Strzelnicy masz wszystkie bronie.',
    how: 'Jak odblokować', howTxt: 'Wyślij {s} na swój adres w grze i trzymaj go tam. Serwer sprawdza saldo co kilka minut – gdy tokenów ubędzie, broń znów się zablokuje.',
    addr: 'Twój adres w grze (Solana)', copy: 'Kopiuj', copied: 'Skopiowano adres', login: 'Zaloguj się, żeby zobaczyć saldo i swój adres do wpłaty.', loginBtn: 'Zaloguj się',
    off: 'Ekwipunek nie jest jeszcze włączony – na razie każdy ma wszystkie bronie.', offline: 'Ekwipunek działa z serwerem gry – tu masz wszystkie bronie.', close: 'Zamknij', err: 'Nie udało się sprawdzić salda – spróbuj za chwilę',
    st_dmg: 'Obrażenia', st_rof: 'Szybkostrzelność', st_acc: 'Celność', st_mag: 'Magazynek', c_pistol: 'Pistolet', c_hand: 'Pistolet ciężki', c_smg: 'Pistolet maszynowy', c_shot: 'Strzelba', c_rifle: 'Karabin szturmowy',
    keys: 'W / S wybór · Esc zamknij', net: 'sieć', drag: 'Przeciągnij, żeby obrócić · kółko: przybliż · 2× klik: od nowa' },
  en: { title: 'Inventory', sub: 'You start with a pistol. Hold the token on your in-game address to unlock the other guns.',
    subSol: 'You start with a pistol. Keep SOL in your in-game balance to unlock the other guns – nothing is charged, only the balance counts.',
    howSol: 'Deposit SOL to your in-game balance and simply keep it there. The guns cost nothing – the SOL stays in your account. If the balance drops below a threshold, that gun locks again.', deposit: 'Deposit SOL',
    tile: 'Inventory', tileOf: '{n} / {m} guns', tileOff: 'Guns and unlocks', balance: 'Your balance', refresh: 'Check balance', checking: 'Checking…',
    ago: 'checked {t} ago', now: 'checked just now', base: 'Included', open: 'Unlocked', all: 'Available', need: 'Hold', missing: '{n} to go',
    have: 'You have this gun', free: 'Free – available to everyone', haveBase: 'Starter pistol – always included', modes: 'Works in 1v1 and Deathmatch (the kill ladder only gives you unlocked guns). Vs bot and on the Range you have every gun.',
    how: 'How to unlock', howTxt: 'Send {s} to your in-game address and keep it there. The server checks the balance every few minutes – if it drops, the gun locks again.',
    addr: 'Your in-game address (Solana)', copy: 'Copy', copied: 'Address copied', login: 'Log in to see your balance and deposit address.', loginBtn: 'Log in',
    off: 'The Inventory is not switched on yet – for now everyone has every gun.', offline: 'The Inventory works with the game server – here you have every gun.', close: 'Close', err: 'Could not check the balance – try again shortly',
    st_dmg: 'Damage', st_rof: 'Fire rate', st_acc: 'Accuracy', st_mag: 'Magazine', c_pistol: 'Pistol', c_hand: 'Heavy pistol', c_smg: 'Submachine gun', c_shot: 'Shotgun', c_rifle: 'Assault rifle',
    keys: 'W / S select · Esc close', net: 'network', drag: 'Drag to rotate · wheel: zoom · double-click: reset' },
  ru: { title: 'Инвентарь', sub: 'На старте у тебя пистолет. Держи токен на своём игровом адресе – и откроешь остальное оружие.',
    subSol: 'На старте у тебя пистолет. Держи SOL на игровом балансе – и откроешь остальное оружие. Ничего не списывается, важен только баланс.',
    howSol: 'Пополни игровой баланс в SOL и просто держи его. Оружие ничего не стоит – SOL остаётся на счёте. Если баланс упадёт ниже порога, оружие снова закроется.', deposit: 'Пополнить SOL',
    tile: 'Инвентарь', tileOf: '{n} / {m} оружия', tileOff: 'Оружие и открытия', balance: 'Твой баланс', refresh: 'Проверить баланс', checking: 'Проверяю…',
    ago: 'проверено {t} назад', now: 'проверено только что', base: 'В комплекте', open: 'Открыто', all: 'Доступно', need: 'Держи', missing: 'Не хватает {n}',
    have: 'Это оружие у тебя есть', free: 'Бесплатно – доступно всем', haveBase: 'Стартовый пистолет – всегда в комплекте', modes: 'Работает в 1v1 и Deathmatch (лестница оружия за убийства даёт только открытое оружие). С ботом и в тире – всё оружие.',
    how: 'Как открыть', howTxt: 'Отправь {s} на свой игровой адрес и держи его там. Сервер проверяет баланс каждые несколько минут – если токенов станет меньше, оружие снова закроется.',
    addr: 'Твой игровой адрес (Solana)', copy: 'Копировать', copied: 'Адрес скопирован', login: 'Войди, чтобы увидеть баланс и адрес для пополнения.', loginBtn: 'Войти',
    off: 'Инвентарь ещё не включён – пока у всех всё оружие.', offline: 'Инвентарь работает с игровым сервером – здесь у тебя всё оружие.', close: 'Закрыть', err: 'Не удалось проверить баланс – попробуй чуть позже',
    st_dmg: 'Урон', st_rof: 'Скорострельность', st_acc: 'Точность', st_mag: 'Магазин', c_pistol: 'Пистолет', c_hand: 'Тяжёлый пистолет', c_smg: 'Пистолет-пулемёт', c_shot: 'Дробовик', c_rifle: 'Штурмовая винтовка',
    keys: 'W / S выбор · Esc закрыть', net: 'сеть', drag: 'Тяни, чтобы вращать · колесо: зум · двойной клик: сброс' },
  es: { title: 'Inventario', sub: 'Empiezas con una pistola. Guarda el token en tu dirección del juego y desbloquea el resto de armas.',
    subSol: 'Empiezas con una pistola. Mantén SOL en tu saldo del juego y desbloquea el resto de armas: no se cobra nada, solo cuenta el saldo.',
    howSol: 'Deposita SOL en tu saldo del juego y simplemente mantenlo. Las armas no cuestan nada: el SOL se queda en tu cuenta. Si el saldo baja del umbral, el arma se vuelve a bloquear.', deposit: 'Depositar SOL',
    tile: 'Inventario', tileOf: '{n} / {m} armas', tileOff: 'Armas y desbloqueos', balance: 'Tu saldo', refresh: 'Comprobar saldo', checking: 'Comprobando…',
    ago: 'comprobado hace {t}', now: 'comprobado ahora mismo', base: 'Incluida', open: 'Desbloqueada', all: 'Disponible', need: 'Guarda', missing: 'Faltan {n}',
    have: 'Tienes esta arma', free: 'Gratis – disponible para todos', haveBase: 'Pistola inicial – siempre incluida', modes: 'Funciona en 1v1 y Deathmatch (la escalera de armas por bajas solo da armas desbloqueadas). Contra el bot y en la galería tienes todas las armas.',
    how: 'Cómo desbloquear', howTxt: 'Envía {s} a tu dirección del juego y mantenlo allí. El servidor comprueba el saldo cada pocos minutos: si baja, el arma se vuelve a bloquear.',
    addr: 'Tu dirección del juego (Solana)', copy: 'Copiar', copied: 'Dirección copiada', login: 'Inicia sesión para ver tu saldo y tu dirección de depósito.', loginBtn: 'Iniciar sesión',
    off: 'El Inventario aún no está activado: por ahora todos tienen todas las armas.', offline: 'El Inventario funciona con el servidor del juego: aquí tienes todas las armas.', close: 'Cerrar', err: 'No se pudo comprobar el saldo, inténtalo en un momento',
    st_dmg: 'Daño', st_rof: 'Cadencia', st_acc: 'Precisión', st_mag: 'Cargador', c_pistol: 'Pistola', c_hand: 'Pistola pesada', c_smg: 'Subfusil', c_shot: 'Escopeta', c_rifle: 'Fusil de asalto',
    keys: 'W / S elegir · Esc cerrar', net: 'red', drag: 'Arrastra para girar · rueda: zoom · doble clic: restablecer' },
};
// złoty AKM: limitowana broń (pierwsze 100 kont z rozegranym meczem 1v1; serwer: konto.limited i konto.goldLeft)
const GOLD = 'akmgold', P90 = 'p90';
const GTXT = {
  pl: { p_cat: 'Pistolet maszynowy · darmowy', p_own: 'Twój', p_get: 'Za grę w DM', p_info: 'Darmowa broń: dostajesz ją na zawsze po minucie gry w Deathmatch. Zastępuje MP5K na drabince Deathmatch, a w 1v1 masz ją jako dodatkową broń.',
    p_have: 'Masz P90 – jest Twój na zawsze.', p_play: 'Zagraj minutę w Deathmatch, żeby go dostać (za darmo).',
    g_cat: 'Limitowany · złoty karabin', g_own: 'Twój', g_left: 'Zostało {n}/100', g_out: 'Rozdane', g_max: 'Tylko 100 sztuk',
    g_info: 'Limitowana broń: dostaje ją na zawsze pierwsze 100 kont, które rozegrają mecz 1v1. Zastępuje karabin w 1v1 i AKM na drabince Deathmatch.',
    g_have: 'Masz złotego AKM – jest Twój na zawsze.', g_play: 'Rozegraj mecz 1v1, żeby go zdobyć.', g_none: 'Wszystkie 100 sztuk zostały już rozdane.' },
  en: { p_cat: 'Submachine gun · free', p_own: 'Yours', p_get: 'Play DM', p_info: 'Free gun: play Deathmatch for a minute and it is yours forever. It replaces the MP5K on the Deathmatch ladder and is an extra gun in 1v1.',
    p_have: 'You own the P90 – it is yours forever.', p_play: 'Play Deathmatch for a minute to get it (free).',
    g_cat: 'Limited · golden rifle', g_own: 'Yours', g_left: '{n}/100 left', g_out: 'All gone', g_max: 'Only 100 made',
    g_info: 'Limited gun: the first 100 accounts to play a 1v1 match get it forever. It replaces your rifle in 1v1 and the AKM on the Deathmatch ladder.',
    g_have: 'You own the Golden AKM – it is yours forever.', g_play: 'Play a 1v1 match to get it.', g_none: 'All 100 have already been given out.' },
  ru: { p_cat: 'Пистолет-пулемёт · бесплатно', p_own: 'Твой', p_get: 'Сыграй DM', p_info: 'Бесплатное оружие: сыграй минуту в Deathmatch – и оно твоё навсегда. Заменяет MP5K в лестнице Deathmatch, а в 1v1 это дополнительное оружие.',
    p_have: 'У тебя есть P90 – он твой навсегда.', p_play: 'Сыграй минуту в Deathmatch, чтобы получить его (бесплатно).',
    g_cat: 'Лимитированный · золотой автомат', g_own: 'Твой', g_left: 'Осталось {n}/100', g_out: 'Разобраны', g_max: 'Всего 100 штук',
    g_info: 'Лимитированное оружие: навсегда получают первые 100 аккаунтов, сыгравших матч 1v1. Заменяет винтовку в 1v1 и AKM в лестнице Deathmatch.',
    g_have: 'У тебя есть золотой AKM – он твой навсегда.', g_play: 'Сыграй матч 1v1, чтобы получить его.', g_none: 'Все 100 штук уже разобраны.' },
  es: { p_cat: 'Subfusil · gratis', p_own: 'Tuyo', p_get: 'Juega DM', p_info: 'Arma gratis: juega un minuto de Deathmatch y es tuya para siempre. Sustituye al MP5K en la escalera de Deathmatch y en 1v1 es un arma extra.',
    p_have: 'Tienes la P90: es tuya para siempre.', p_play: 'Juega un minuto de Deathmatch para conseguirla (gratis).',
    g_cat: 'Limitada · fusil dorado', g_own: 'Tuyo', g_left: 'Quedan {n}/100', g_out: 'Agotado', g_max: 'Solo 100 unidades',
    g_info: 'Arma limitada: la reciben para siempre las primeras 100 cuentas que jueguen una partida 1v1. Sustituye a tu fusil en 1v1 y al AKM en la escalera de Deathmatch.',
    g_have: 'Tienes el AKM dorado: es tuyo para siempre.', g_play: 'Juega una partida 1v1 para conseguirlo.', g_none: 'Ya se han repartido las 100 unidades.' },
};
for (const l in GTXT) Object.assign(TXT[l], GTXT[l]);
// skiny broni: progi i stany (nazwy skinów są własne – jak w CS – i się nie tłumaczą)
const WTXT = {
  pl: { w_title: 'Skiny broni', w_free: 'Zwykłe', w_mid: 'Średnie', w_legend: 'Legendarne', w_freeP: 'za darmo', w_from: 'od {n} {s}', w_mln: '{n} mln',
    w_on: 'Założony na tę broń', w_pick: 'Kliknij, żeby założyć', w_try: 'Podgląd – odblokujesz, trzymając {n} {s}', w_sol: '≈ {n} SOL' },
  en: { w_title: 'Weapon skins', w_free: 'Standard', w_mid: 'Rare', w_legend: 'Legendary', w_freeP: 'free', w_from: 'from {n} {s}', w_mln: '{n}M',
    w_on: 'Equipped on this gun', w_pick: 'Click to equip', w_try: 'Preview – hold {n} {s} to unlock', w_sol: '≈ {n} SOL' },
  ru: { w_title: 'Скины оружия', w_free: 'Обычные', w_mid: 'Редкие', w_legend: 'Легендарные', w_freeP: 'бесплатно', w_from: 'от {n} {s}', w_mln: '{n} млн',
    w_on: 'Надет на это оружие', w_pick: 'Нажми, чтобы надеть', w_try: 'Предпросмотр – откроется, если держать {n} {s}', w_sol: '≈ {n} SOL' },
  es: { w_title: 'Skins de armas', w_free: 'Comunes', w_mid: 'Raros', w_legend: 'Legendarios', w_freeP: 'gratis', w_from: 'desde {n} {s}', w_mln: '{n} M',
    w_on: 'Equipado en esta arma', w_pick: 'Haz clic para equipar', w_try: 'Vista previa – mantén {n} {s} para desbloquear', w_sol: '≈ {n} SOL' },
};
for (const l in WTXT) Object.assign(TXT[l], WTXT[l]);
// tryb 'hold': token na podpiętym własnym portfelu albo SOL w grze o tej samej wartości (serwer: serwer/arsenal.mjs, /api/hold/*)
const HTXT = {
  pl: { subHold: 'Na start masz pistolet. Podepnij portfel z {s} albo trzymaj tyle samo wartości w SOL w grze, a odblokujesz resztę broni – nic się nie pobiera.',
    howHold: 'Dwie drogi, liczy się lepsza: podepnij swój portfel (Phantom, Solflare) z tokenem {s} – tokeny zostają u Ciebie – albo bez portfela trzymaj SOL w grze o tej samej wartości (po bieżącym kursie {s}).',
    opt1: 'Portfel z {s}', opt2: 'Albo SOL w grze', link: 'Podepnij portfel', unlink: 'Odepnij', linking: 'Podpisz w portfelu…', linkOk: 'Portfel podpięty', unlinkOk: 'Portfel odpięty',
    noWallet: 'Nie wykryto portfela Solana (Phantom, Solflare) w tej przeglądarce', rejected: 'Anulowano w portfelu', orSol: 'albo {n} SOL w grze', fromWallet: 'portfel {a}', fromSol: 'z {n} SOL w grze',
    ca: 'CA tokenu', noPrice: 'Brak kursu {s} – SOL w grze chwilowo nie odblokowuje broni. Spróbuj za chwilę.', signFree: 'Podpis nic nie kosztuje i nie wysyła transakcji.' },
  en: { subHold: 'You start with a pistol. Link a wallet holding {s}, or keep the same value in SOL in the game, to unlock the other guns – nothing is charged.',
    howHold: 'Two ways, the better one counts: link your own wallet (Phantom, Solflare) holding {s} – the tokens stay with you – or, without a wallet, keep SOL in the game worth the same (at the current {s} price).',
    opt1: 'Wallet with {s}', opt2: 'Or SOL in the game', link: 'Link wallet', unlink: 'Unlink', linking: 'Sign in your wallet…', linkOk: 'Wallet linked', unlinkOk: 'Wallet unlinked',
    noWallet: 'No Solana wallet (Phantom, Solflare) found in this browser', rejected: 'Cancelled in the wallet', orSol: 'or {n} SOL in the game', fromWallet: 'wallet {a}', fromSol: 'from {n} SOL in the game',
    ca: 'Token CA', noPrice: 'No {s} price right now – SOL in the game does not unlock guns for the moment. Try again shortly.', signFree: 'Signing is free and sends no transaction.' },
  ru: { subHold: 'На старте у тебя пистолет. Подключи кошелёк с {s} или держи столько же по стоимости в SOL в игре – и откроешь остальное оружие. Ничего не списывается.',
    howHold: 'Два пути, считается лучший: подключи свой кошелёк (Phantom, Solflare) с токеном {s} – токены остаются у тебя – или без кошелька держи SOL в игре на ту же сумму (по текущему курсу {s}).',
    opt1: 'Кошелёк с {s}', opt2: 'Или SOL в игре', link: 'Подключить кошелёк', unlink: 'Отключить', linking: 'Подпиши в кошельке…', linkOk: 'Кошелёк подключён', unlinkOk: 'Кошелёк отключён',
    noWallet: 'В этом браузере не найден кошелёк Solana (Phantom, Solflare)', rejected: 'Отменено в кошельке', orSol: 'или {n} SOL в игре', fromWallet: 'кошелёк {a}', fromSol: 'из {n} SOL в игре',
    ca: 'CA токена', noPrice: 'Нет курса {s} – SOL в игре пока не открывает оружие. Попробуй чуть позже.', signFree: 'Подпись бесплатна и не отправляет транзакцию.' },
  es: { subHold: 'Empiezas con una pistola. Conecta una cartera con {s} o guarda el mismo valor en SOL en el juego y desbloquea el resto de armas: no se cobra nada.',
    howHold: 'Dos caminos, cuenta el mejor: conecta tu propia cartera (Phantom, Solflare) con el token {s} – los tokens se quedan contigo – o, sin cartera, guarda SOL en el juego por el mismo valor (al precio actual de {s}).',
    opt1: 'Cartera con {s}', opt2: 'O SOL en el juego', link: 'Conectar cartera', unlink: 'Desconectar', linking: 'Firma en tu cartera…', linkOk: 'Cartera conectada', unlinkOk: 'Cartera desconectada',
    noWallet: 'No se encontró una cartera de Solana (Phantom, Solflare) en este navegador', rejected: 'Cancelado en la cartera', orSol: 'o {n} SOL en el juego', fromWallet: 'cartera {a}', fromSol: 'de {n} SOL en el juego',
    ca: 'CA del token', noPrice: 'Sin precio de {s} ahora mismo: el SOL del juego no desbloquea armas por el momento. Inténtalo en un rato.', signFree: 'Firmar es gratis y no envía ninguna transacción.' },
};
for (const l in HTXT) Object.assign(TXT[l], HTXT[l]);
// portfel Solana w przeglądarce (Phantom, Solflare, Backpack) – musi umieć podpisać wiadomość
const solProvider = () => { const w = typeof window !== 'undefined' ? window : {}; return [w.phantom && w.phantom.solana, w.solflare, w.backpack, w.solana].find((p) => p && typeof p.connect === 'function' && typeof p.signMessage === 'function') || null; };
const short = (a) => (a ? a.slice(0, 4) + '…' + a.slice(-4) : '');
const CAT = { glock17: 'c_pistol', deagle: 'c_hand', mp5k: 'c_smg', p90: 'c_smg', spas12: 'c_shot', akm: 'c_rifle', m4a1: 'c_rifle' };
const ORDER = ['glock17', 'deagle', 'mp5k', 'spas12', 'akm', 'm4a1'];   // jak na serwerze: pistolet + bronie z progiem
const IC = {
  gun: '<svg viewBox="0 0 64 32" fill="currentColor"><path d="M2 9h40l2-3h6v3h12v5H50l-2 3H36l-4 3v8h-9l2-11H2z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  ref: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="1"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  rot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12c0-2.2 4-4 9-4s9 1.8 9 4-4 4-9 4"/><path d="M8.5 13.5L12 16l-3.5 2.5"/></svg>',
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
#lb-ui .ars-list button{transition:color .22s ease}
#lb-ui .ars-list button::before{content:'';position:absolute;inset:0;background:linear-gradient(90deg,#f6f3f8 0%,#f6f3f8 55%,rgba(246,243,248,.55) 100%);
  opacity:0;transform:scaleX(.94);transform-origin:left center;transition:opacity .22s ease,transform .28s cubic-bezier(.2,.8,.2,1);pointer-events:none}
#lb-ui .ars-list button>*{position:relative}
#lb-ui .ars-list button.on{color:#0b0610}#lb-ui .ars-list button.on::before{opacity:1;transform:none}
#lb-ui .ars-list .st,#lb-ui .ars-list .dot{transition:color .22s ease,background .22s ease}
#lb-ui .ars-view{position:relative;width:100%;height:clamp(240px,42vh,460px)}
#lb-ui .ars-3d{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:grab;touch-action:pan-y;filter:drop-shadow(0 22px 24px rgba(0,0,0,.5));transition:filter .35s ease}
#lb-ui .ars-3d.drag{cursor:grabbing}#lb-ui .ars-3d.lk{filter:drop-shadow(0 22px 24px rgba(0,0,0,.5)) saturate(.7) brightness(.85)}
#lb-ui .ars-hint{position:absolute;left:50%;bottom:2%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;padding:6px 12px;white-space:nowrap;pointer-events:none;
  font:600 12px/1 Barlow,sans-serif;letter-spacing:.04em;color:#cfc6d8;background:rgba(9,4,13,.6);transition:opacity .5s ease}
#lb-ui .ars-hint svg{width:16px;height:16px;color:var(--teal)}#lb-ui .ars-hint.off{opacity:0}#lb-ui .ars-hint[hidden]{display:none}
@keyframes arsIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes arsBadge{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:none}}
@keyframes arsBar{from{width:0}}
#lb-ui .ars-side.swap>*{animation:arsIn .34s cubic-bezier(.2,.8,.2,1) both}
#lb-ui .ars-side.swap>*:nth-child(2){animation-delay:.05s}#lb-ui .ars-side.swap>*:nth-child(3){animation-delay:.1s}
#lb-ui .ars-stage .big.swap{animation:arsBadge .34s .12s cubic-bezier(.2,.8,.2,1) both}
#lb-ui .ars-req .bar b{animation:arsBar .6s .1s cubic-bezier(.2,.8,.2,1) both}
#lb-ui .ars-stat i b{transition:width .5s cubic-bezier(.2,.8,.2,1)}
@media (prefers-reduced-motion:reduce){#lb-ui .ars-side.swap>*,#lb-ui .ars-stage .big.swap,#lb-ui .ars-req .bar b{animation:none}#lb-ui .ars-stat i b{transition:none}}
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
#lb-ui .ars-wsk h5{margin:12px 0 7px;display:flex;justify-content:space-between;align-items:baseline;gap:8px;font:700 14px/1 'Barlow Condensed',sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#d9d2e3}
#lb-ui .ars-wsk h5 small{font:600 12px/1 'Barlow Condensed',sans-serif;letter-spacing:.04em;color:#a39aae;text-transform:none;text-align:right}
#lb-ui .ars-wsk h5.mid{color:#7fd7ff}#lb-ui .ars-wsk h5.legend{color:#ffcf5a}
#lb-ui .ars-wsk .sw{display:flex;flex-wrap:wrap;gap:7px}
#lb-ui .ars-wsk .wsk{width:40px;height:40px;border:0;padding:0;border-radius:7px;cursor:pointer;position:relative;display:grid;place-items:center;box-shadow:inset 0 0 0 1px rgba(255,255,255,.2);transition:transform .12s}
#lb-ui .ars-wsk .wsk:hover{transform:translateY(-2px)}
#lb-ui .ars-wsk .wsk.on{box-shadow:0 0 0 2px #fff,0 0 14px rgba(255,255,255,.35)}
#lb-ui .ars-wsk .wsk.try{box-shadow:0 0 0 2px #ff7ab8,0 0 14px rgba(255,122,184,.45)}
#lb-ui .ars-wsk .wsk.lk::after{content:'';position:absolute;inset:0;border-radius:7px;background:rgba(5,2,8,.5)}
#lb-ui .ars-wsk .wsk svg{position:relative;z-index:1;width:14px;height:14px;color:#fff}
#lb-ui .ars-wsk .st{margin:12px 0 0;font:600 15px/1.3 'Barlow Condensed',sans-serif;color:#cfc7da}
#lb-ui .ars-wsk .st b{color:#fff}#lb-ui .ars-wsk .st .ok{color:var(--cash)}#lb-ui .ars-wsk .st .lk{color:#ff7ab8}
#lb-ui .ars-card h4{margin:4px 0 0;font:600 13px/1.2 'Barlow Condensed',sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#a39aae}
#lb-ui .ars-req{min-height:172px;box-sizing:border-box}   /* stała wysokość: przy zmianie broni układ nie podskakuje */
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
#lb-ui .ars-opts{display:flex;flex-direction:column;gap:10px;min-width:300px}
#lb-ui .ars-opts .ars-addr{justify-content:space-between;padding:10px 12px;background:rgba(255,255,255,.05)}
#lb-ui .ars-addr em{display:block;margin-top:5px;font-style:normal;font-size:13px;color:#cfc6d8}
#lb-ui .ars-ft p.ca{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;color:#a39aae}#lb-ui .ars-ft p.ca code{font:600 12px ui-monospace,Menlo,Consolas,monospace;color:#fff;word-break:break-all}
#lb-ui .ars-ft p.ca .ars-btn{height:26px;padding:0 8px}
#lb-ui .ars-req p.alt{margin:6px 0 0;font-size:13px;color:#a39aae}
#lb-ui .ars-keys{position:absolute;right:max(28px,env(safe-area-inset-right));bottom:6px;font-size:11px;color:#6f6680;letter-spacing:.06em}
@media (max-width:1100px){#lb-ui .ars-body{grid-template-columns:minmax(220px,320px) 1fr}#lb-ui .ars-side{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr}}
@media (max-width:760px){
  #lb-ui .lb-arsbtn{left:12px;right:auto;bottom:auto;top:76px;min-width:0;padding:8px 12px 8px 8px;gap:10px}#lb-ui .lb-arsbtn .ic{width:44px;height:34px}#lb-ui .lb-arsbtn .ic svg{width:34px;height:17px}
  #lb-ui .lb-arsbtn b{font-size:18px}#lb-ui .lb-arsbtn em,#lb-ui .lb-arsbtn i{display:none}
  #lb-ui .ars-in{padding:18px 16px;gap:14px}#lb-ui .ars-hd{flex-wrap:wrap;gap:12px}#lb-ui .ars-hd>div:first-child{flex:1 1 100%;order:1}#lb-ui .ars-bal{order:2;text-align:left;margin-left:0}
  #lb-ui .ars-bal .v,#lb-ui .ars-bal .row{justify-content:flex-start}#lb-ui .ars-x{position:absolute;top:14px;right:14px}
  #lb-ui .ars-body{grid-template-columns:1fr}#lb-ui .ars-side{grid-template-columns:1fr}#lb-ui .ars-stage{min-height:180px;order:-1}#lb-ui .ars-view{height:clamp(190px,32vh,270px)}
  #lb-ui .ars-ft{grid-template-columns:1fr}#lb-ui .ars-keys{display:none}}
`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function createArsenal({ root, getLang, toast = () => {}, sfx = {}, wallet = () => null, acct = () => null, art = null, openAuth = () => {}, openWallet = () => {} }) {
  const T = (k, v) => { let s = (TXT[getLang()] || TXT.en)[k] ?? TXT.en[k] ?? k; if (v) for (const n in v) s = s.split('{' + n + '}').join(v[n]); return s; };
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
      <div class="ars-stage"><span class="big"></span><div class="ars-view" hidden></div><img class="ars-art" alt=""><span class="ars-noart" hidden></span><span class="ars-hint" hidden></span></div>
      <div class="ars-side"><div class="ars-card ars-wsk"></div><div class="ars-card ars-req"></div><div class="ars-card ars-stats"></div><p class="ars-modes"></p></div></div>
    <div class="ars-ft"></div><span class="ars-keys"></span></div>`;
  root.appendChild(tile); root.appendChild(ov);
  const Q = (s) => ov.querySelector(s);

  // stan: s = odpowiedź serwera (GET /api/arsenal); null = jeszcze nie ma / brak serwera
  let s = null, sel = 0, busy = false, forUser = undefined, lastFetch = 0, artMap = null, err = '';
  let viewer, shownId = '', shownSel = -1, listSig = '', hintDone = false;   // podgląd 3D (undefined = jeszcze nie tworzony, null = brak WebGL – zdjęcia)
  const hideHint = () => { if (hintDone) return; hintDone = true; Q('.ars-hint').classList.add('off'); };
  const restart = (el) => { el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap'); };   // ponowne odpalenie animacji wejścia
  const W = () => wallet();
  const online = () => !!(W() && W().api);
  const guns = () => [...(s && s.base ? [s.base, ...(s.guns || [])] : ORDER), P90, GOLD].filter((id) => WEAPON_STATS[id]);
  const owns = (id) => { const a = acct(); return !!(a && (a.limited || []).includes(id)); };
  const ownGold = () => owns(GOLD);
  const p90Lbl = () => owns(P90) ? `${IC.check}${esc(T('p_own'))}` : esc(T('p_get'));
  const goldLeft = () => { const a = acct(); return a && typeof a.goldLeft === 'number' ? a.goldLeft : null; };
  const goldLbl = () => ownGold() ? `${IC.check}${esc(T('g_own'))}` : goldLeft() === 0 ? esc(T('g_out')) : goldLeft() == null ? esc(T('g_max')) : esc(T('g_left', { n: goldLeft() }));
  const active = () => !!(s && s.enabled);
  const holdMode = () => !!(s && s.unit === 'hold');
  const solMode = () => !!(s && s.unit !== 'token' && s.unit !== 'hold');
  const pSol = () => (holdMode() && s.priceSol > 0 ? s.priceSol : 0);   // ile SOL kosztuje 1 token
  // tryb 'hold': tokeny na podpiętym portfelu i SOL w grze (na żywo z portfela w grze) przeliczony na tokeny – liczy się większe
  const holdParts = () => { const a = acct(), sol = a && typeof a.sol === 'number' ? a.sol : (s.sol || 0), p = pSol();
    const solTok = p ? sol / p : (s.solTok || 0), wallet = s.wallet ? (s.walletBalance || 0) : 0;
    return { sol, solTok, wallet, linked: !!s.wallet, source: s.wallet && wallet >= solTok ? 'wallet' : 'sol', amount: Math.max(wallet, solTok) }; };
  // saldo: w trybie SOL – na żywo z portfela w grze (po wpłacie od razu), w trybie tokenu – z serwera
  const bal = () => { const a = acct(); if (!a) return 0; if (holdMode()) return holdParts().amount; if (solMode() && typeof a.sol === 'number') return a.sol; return (s && s.balance) || 0; };
  const numSol = (v) => (+v || 0).toLocaleString(loc(), { maximumFractionDigits: v >= 10 ? 2 : v >= 0.01 ? 4 : 6 });
  const usdOf = (v) => { const sol = holdMode() ? v * pSol() : solMode() ? v : 0, u = s && s.price ? sol * s.price : 0;
    return u > 0 ? '≈ $' + u.toLocaleString(loc(), { maximumFractionDigits: u >= 100 ? 0 : 2 }) : ''; };
  const stateOf = (id) => {
    if (id === GOLD) return ownGold() ? 'ok' : 'lk';               // złoty AKM: tylko posiadacze, niezależnie od progów Ekwipunku
    if (id === P90) return owns(P90) ? 'ok' : 'lk';                 // P90: za grę w Deathmatch, niezależnie od progów
    if (!active()) return 'all';
    if (id === s.base) return 'bs';
    return bal() + 1e-9 >= (s.need[id] ?? Infinity) ? 'ok' : 'lk';
  };
  async function call(method, p, body) {
    const w = W(); if (!w || !w.api) throw new Error('offline');
    const r = await fetch(w.api + '/api' + p, { method, headers: { 'Content-Type': 'application/json', ...(w.token && w.token !== 'local' ? { Authorization: 'Bearer ' + w.token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    let j = {}; try { j = await r.json(); } catch {}
    if (!r.ok) throw new Error(j.message ? srvText(j.message, getLang()) : 'HTTP ' + r.status);
    return j;
  }
  async function load(force) {
    if (!online()) { s = null; render(); return; }
    if (busy) return; busy = true; err = ''; renderBal();
    try { s = await call(force ? 'POST' : 'GET', force && acct() ? '/arsenal/refresh' : '/arsenal'); lastFetch = Date.now(); if (s.error) err = errText(s.error); }
    catch (e) { err = T('err'); }
    busy = false; render();
  }
  const errText = (m) => (/kursu tokenu/.test(m) ? T('noPrice', { s: s && s.symbol ? s.symbol : 'TOKEN' }) : T('err'));
  // podpięcie własnego portfela: kod od serwera -> podpis wiadomości w portfelu (bez transakcji) -> serwer sprawdza podpis
  let linking = false;
  async function linkWallet() {
    if (linking) return; const p = solProvider(); if (!p) { toast(T('noWallet'), 'err'); return; }
    linking = true; render();
    try {
      const c = await p.connect(), pk = (c && c.publicKey) || p.publicKey; const address = pk && pk.toString();
      if (!address) throw new Error(T('rejected'));
      const { message } = await call('POST', '/hold/nonce');
      let r; try { r = await p.signMessage(new TextEncoder().encode(message), 'utf8'); } catch { throw new Error(T('rejected')); }
      const sig = r && r.signature ? r.signature : r; if (!sig || !sig.length) throw new Error(T('rejected'));
      const j = await call('POST', '/hold/link', { address, message, signature: btoa(String.fromCharCode(...new Uint8Array(sig))) });
      s = j; err = s.error ? errText(s.error) : ''; lastFetch = Date.now(); const a = acct(); if (a) a.holdWallet = address; toast(T('linkOk'), 'ok');
    } catch (e) { toast(e && e.message ? e.message : T('err'), 'err'); }
    linking = false; render();
  }
  async function unlinkWallet() {
    try { s = await call('POST', '/hold/unlink'); err = s.error ? errText(s.error) : ''; const a = acct(); if (a) a.holdWallet = ''; toast(T('unlinkOk'), 'ok'); }
    catch (e) { toast(e && e.message ? e.message : T('err'), 'err'); }
    render();
  }

  // skiny broni: najwyższy dostępny próg z salda (jak serwer: Arsenał wyłączony = wszystkie)
  const wsNeed = () => (s && s.wskin) || { mid: 5e6, legend: 1e7 };
  const wsRank = () => { if (!s || !active()) return s ? 2 : 0; if (!acct()) return 0; const b = bal(), n = wsNeed(); return b + 1e-9 >= n.legend ? 2 : b + 1e-9 >= n.mid ? 1 : 0; };
  let tryOn = null;                                                   // przymierzany (zablokowany) skin: { gun, id }
  function renderWsk(id) {
    const box = Q('.ars-wsk'), sym = s && s.symbol ? s.symbol : 'TOKEN', n = wsNeed(), rank = wsRank();
    const mln = (v) => T('w_mln', { n: (v / 1e6).toLocaleString(loc(), { maximumFractionDigits: 2 }) });
    const amount = (v) => (holdMode() || v >= 1e6 ? mln(v) : num(v));
    const price = (tier) => { if (tier === 'free') return esc(T('w_freeP')); const v = n[tier], sol = pSol() ? ' · ' + T('w_sol', { n: numSol(v * pSol()) }) : '';
      return esc(T('w_from', { n: amount(v), s: sym }) + sol); };
    const cur = chosen(id), shown = tryOn && tryOn.gun === id ? tryOn.id : (TIER_RANK[(WSKIN[cur] || WSKIN['']).tier] <= rank ? cur : '');
    box.innerHTML = '<h3>' + esc(T('w_title')) + '</h3>' + ['free', 'mid', 'legend'].map((tier) => '<h5 class="' + tier + '">' + esc(T('w_' + tier)) + '<small>' + price(tier) + '</small></h5><div class="sw">'
      + WSKINS.filter((k) => k.tier === tier).map((k) => { const lk = TIER_RANK[tier] > rank;
        return '<button type="button" class="wsk' + (lk ? ' lk' : '') + (k.id === shown ? (lk ? ' try' : ' on') : '') + '" data-ws="' + k.id + '" title="' + esc(k.name) + '" aria-label="' + esc(k.name) + '" style="background:' + k.sw + '">' + (lk ? IC.lock : '') + '</button>'; }).join('') + '</div>').join('');
    const sk = WSKIN[shown] || WSKIN[''], lkS = TIER_RANK[sk.tier] > rank;
    const st = lkS ? '<span class="lk">' + esc(T('w_try', { n: amount(n[sk.tier]), s: sym })) + '</span>' : shown === cur ? '<span class="ok">' + esc(T('w_on')) + '</span>' : esc(T('w_pick'));
    box.insertAdjacentHTML('beforeend', '<p class="st"><b>' + esc(sk.name) + '</b> · ' + st + '</p>');
    if (viewer) viewer.setSkin(id, shown);
  }
  // klik w próbkę: dostępny skin – zakładamy na tę broń (zapis), zablokowany – tylko przymierzamy na podglądzie
  ov.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-ws]'); if (!b) return;
    const list = guns(), gun = list[Math.max(0, Math.min(list.length - 1, sel))], id = b.dataset.ws, sk = WSKIN[id]; if (!sk || !gun) return;
    if (TIER_RANK[sk.tier] <= wsRank()) { tryOn = null; chooseSkin(gun, id); } else tryOn = { gun, id };
    renderWsk(gun);
  });
  function renderTile() {
    setWskinRank(wsRank());
    const list = guns(), n = list.filter((id) => stateOf(id) !== 'lk').length;
    tile.querySelector('small').textContent = !active() ? 'GTASSAULT' : solMode() ? 'SOL' : '$' + String(s.symbol || '').replace(/^\$/, '');
    tile.querySelector('b').textContent = T('tile');
    tile.querySelector('em').textContent = active() ? T('tileOf', { n, m: list.length }) : T('tileOff');
    tile.querySelector('.pips').innerHTML = active() ? list.map((id) => `<u class="${stateOf(id) !== 'lk' ? 'on' : ''}"></u>`).join('') : '';
  }
  function renderBal() {
    const sym = s && s.symbol ? s.symbol : 'TOKEN';
    Q('.bl').textContent = T('balance');
    const loggedIn = !!acct();
    Q('.v').innerHTML = active() && loggedIn ? `${solMode() ? IC.sol : IC.token}${esc(num(bal()))}<i>${esc(sym)}</i>` : '<i>—</i>';
    const rb = Q('.ref'); rb.hidden = solMode() || (holdMode() && !s.wallet); rb.disabled = busy || !online() || !loggedIn || !active(); rb.querySelector('span').textContent = busy ? T('checking') : T('refresh');
    const ago = s && s.checkedAt ? Math.max(0, Math.round((Date.now() - s.checkedAt) / 1000)) : -1;
    const agoTxt = ago < 0 ? '' : ago < 20 ? T('now') : T('ago', { t: ago < 120 ? ago + ' s' : Math.round(ago / 60) + ' min' });
    if (holdMode() && active() && loggedIn) { const h = holdParts();   // skąd saldo: portfel (i kiedy sprawdzony) albo SOL w grze (i ile to dolarów)
      Q('.ago').textContent = h.source === 'wallet' ? T('fromWallet', { a: short(s.wallet) }) + (agoTxt ? ' · ' + agoTxt : '') : T('fromSol', { n: numSol(h.sol) }) + (usdOf(h.amount) ? ' · ' + usdOf(h.amount) : '');
      return; }
    Q('.ago').textContent = !active() || !loggedIn ? '' : solMode() ? usdOf(bal()) : agoTxt;
  }
  function statRows(id) {
    const w = WEAPON_STATS[id], pel = w.pellets || 1;
    const dmg = Math.min(10, (w.dmg * pel) / 13), rof = Math.min(10, w.rpm / 90), acc = Math.max(.5, Math.min(10, 10 - (w.spread.hip * 600 + (w.pelletSpread || 0) * 80))), mag = Math.min(10, w.mag / 3);
    return [[T('st_dmg'), dmg, pel > 1 ? w.dmg + '×' + pel : String(w.dmg)], [T('st_rof'), rof, w.rpm + ' rpm'], [T('st_acc'), acc, acc.toFixed(1)], [T('st_mag'), mag, w.mag + ' / ' + w.reserve]];
  }
  // skiny z kreatora: próg (własny albo domyślny) – null = skin dostępny; lobby.js rysuje kłódki na kafelkach skinów
  function skinLock(id) {
    if (!active() || s.skinDefault === undefined) return null;
    const need = s.skinNeed && Object.prototype.hasOwnProperty.call(s.skinNeed, id) ? s.skinNeed[id] : s.skinDefault;
    if (!(need > 0) || bal() + 1e-9 >= need) return null;
    return { need, unit: solMode() ? 'SOL' : String(s.symbol || 'TOKEN') };
  }
  function render() {
    renderTile();
    dispatchEvent(new CustomEvent('fasolka:arsenal', { detail: { lock: skinLock } }));
    if (ov.hidden) return;
    const list = guns(); sel = Math.max(0, Math.min(list.length - 1, sel)); const id = list[sel], st = stateOf(id), sym = s && s.symbol ? s.symbol : 'TOKEN';
    Q('h2').innerHTML = `<b>${esc(T('title'))}</b>`; Q('.sub').textContent = T(holdMode() ? 'subHold' : solMode() || !s ? 'subSol' : 'sub', { s: sym });
    Q('.ars-x').setAttribute('aria-label', T('close')); Q('.ars-keys').textContent = T('keys');
    renderBal();
    const note = Q('.ars-note'), msg = !online() ? T('offline') : err ? err : s && !s.enabled ? T('off') : '';
    note.hidden = !msg; note.textContent = msg; note.classList.toggle('err', !!err);
    // lista: przebudowa tylko po zmianie danych; zmiana wyboru = przesunięcie podświetlenia (płynne przejście w CSS)
    const rows = list.map((g) => { const k = stateOf(g), lbl = g === GOLD ? goldLbl() : g === P90 ? p90Lbl() : k === 'ok' ? `${IC.check}${esc(T('open'))}` : k === 'lk' ? `${IC.lock}${esc(num(s.need[g]))} ${esc(sym)}` : k === 'bs' ? esc(T('base')) : esc(T('all')); return [g, k, lbl]; });
    const sig = getLang() + JSON.stringify(rows);
    if (sig !== listSig) { listSig = sig; Q('.ars-list').innerHTML = rows.map(([g, k, lbl], i) => `<button type="button" role="option" data-i="${i}" class="${k}"><span class="dot"></span><span>${esc(WEAPON_STATS[g].name)}</span><span class="st">${lbl}</span></button>`).join(''); }
    Q('.ars-list').querySelectorAll('button').forEach((b, i) => { b.classList.toggle('on', i === sel); b.setAttribute('aria-selected', String(i === sel)); });
    // broń: podgląd 3D (obracanie) albo – bez WebGL – kolorowe zdjęcie
    if (viewer === undefined) { viewer = createViewer(Q('.ars-view'), hideHint); if (viewer) { Q('.ars-view').hidden = false; viewer.start(); } }
    const img = Q('.ars-art'), na = Q('.ars-noart'), hint = Q('.ars-hint');
    if (viewer) {
      img.hidden = true; na.hidden = true; hint.hidden = false; hint.innerHTML = `${IC.rot}<span>${esc(T('drag'))}</span>`;
      viewer.show(id, shownSel < 0 || sel >= shownSel ? 1 : -1); viewer.setLocked(st === 'lk');
    } else {
      if (!artMap && art) { try { artMap = art() || {}; } catch { artMap = {}; } }
      const src = artMap && artMap[id];
      img.hidden = !src; if (src) { img.src = src; img.alt = WEAPON_STATS[id].name; } img.classList.toggle('lk', st === 'lk'); img.classList.toggle('sm', PISTOLS.has(id));
      na.hidden = !!src; na.textContent = WEAPON_STATS[id].name;
    }
    const changed = id !== shownId; shownId = id; shownSel = sel;
    const big = Q('.big'); big.className = 'big ' + st + (changed ? ' swap' : ''); if (changed) restart(big);
    if (changed) { restart(Q('.ars-side')); tryOn = null; }
    renderWsk(id);
    big.innerHTML = id === GOLD ? goldLbl() : id === P90 ? p90Lbl() : st === 'ok' ? `${IC.check}${esc(T('open'))}` : st === 'lk' ? `${IC.lock}${esc(num(s.need[id]))} ${esc(sym)}` : st === 'bs' ? esc(T('base')) : esc(T('all'));
    // wymaganie: próg, pasek postępu, ile brakuje
    let req = `<h3>${esc(WEAPON_STATS[id].name)}</h3><h4>${esc(T(CAT[id] || 'c_rifle'))}</h4>`;
    if (id === P90) req = `<h3>${esc(WEAPON_STATS[id].name)}</h3><h4>${esc(T('p_cat'))}</h4><p style="margin-top:12px">${esc(T('p_info'))}</p>`
      + (owns(P90) ? `<p class="ok">${esc(T('p_have'))}</p>` : `<p>${esc(acct() ? T('p_play') : T('login'))}</p>`);
    else if (id === GOLD) { req = `<h3>${esc(WEAPON_STATS[id].name)}</h3><h4>${esc(T('g_cat'))}</h4><p style="margin-top:12px">${esc(T('g_info'))}</p>`
      + (ownGold() ? `<p class="ok">${esc(T('g_have'))}</p>` : goldLeft() === 0 ? `<p>${esc(T('g_none'))}</p>` : `<p>${esc(acct() ? T('g_play') : T('login'))}</p>`); }
    else if (st === 'ok' && !(s.need[id] > 0)) req += `<p class="ok" style="margin-top:12px">${esc(T('free'))}</p>`;   // próg 0: broń dla każdego
    else if (st === 'lk' || st === 'ok') {
      const need = s.need[id] || 0, b = bal(), k = need > 0 ? Math.min(1, b / need) : 1, usd = usdOf(need);
      req += `<div class="need"><small>${esc(T('need'))}</small>${esc(num(need))}<i>${esc(sym)}</i>${usd ? `<small>${esc(usd)}</small>` : ''}</div>`
        + (holdMode() && pSol() ? `<p class="alt">${esc(T('orSol', { n: numSol(need * pSol()) }))}</p>` : '')   // ta sama wartość w SOL (po bieżącym kursie)
        + `<div class="bar${k >= 1 ? ' full' : ''}"><b style="width:${(k * 100).toFixed(1)}%"></b></div>`
        + (st === 'ok' ? `<p class="ok">${esc(T('have'))}</p>` : acct() ? `<p>${esc(T('missing', { n: num(Math.max(0, need - b)) + ' ' + sym }))}</p>` : `<p>${esc(T('login'))}</p>`);
    } else if (st === 'bs') req += `<p class="ok" style="margin-top:12px">${esc(T('haveBase'))}</p>`;
    Q('.ars-req').innerHTML = req;
    // statystyki: te same wiersze, zmieniają się liczby i długość pasków (pasek „dojeżdża” do nowej wartości)
    const stBox = Q('.ars-stats'), sr = statRows(id);
    if (stBox.children.length !== sr.length) stBox.innerHTML = sr.map(() => `<div class="ars-stat"><div><span></span><span></span></div><i><b style="width:3%"></b></i></div>`).join('');
    sr.forEach(([n, v, l], i) => { const row = stBox.children[i], sp = row.querySelectorAll('span'); sp[0].textContent = n; sp[1].textContent = l; row.querySelector('b').style.width = Math.max(3, v * 10) + '%'; });
    Q('.ars-modes').textContent = T('modes');
    // stopka: jak odblokować + adres depozytu (albo logowanie)
    const ft = Q('.ars-ft');
    if (!active()) ft.innerHTML = `<div><b>${esc(T('how'))}</b><p>${esc(T(solMode() || !s ? 'howSol' : 'howTxt', { s: sym }))}</p></div>`;
    else if (!acct()) ft.innerHTML = `<div><b>${esc(T('how'))}</b><p>${esc(T('login'))}</p></div><button type="button" class="ars-btn pri" data-a="login">${esc(T('loginBtn'))}</button>`;
    else if (holdMode()) {   // dwie drogi: własny portfel z tokenem albo SOL w grze o tej samej wartości
      const wbtn = s.wallet ? `<div class="ars-addr"><div><small>${esc(T('opt1', { s: sym }))}</small><code>${esc(short(s.wallet))} · ${esc(num(s.walletBalance || 0))} ${esc(sym)}</code></div><button type="button" class="ars-btn" data-a="unlink">${esc(T('unlink'))}</button></div>`
        : `<div class="ars-addr"><div><small>${esc(T('opt1', { s: sym }))}</small><em>${esc(T('signFree'))}</em></div><button type="button" class="ars-btn pri" data-a="link"${linking ? ' disabled' : ''}>${IC.token}<span>${esc(T(linking ? 'linking' : 'link'))}</span></button></div>`;
      ft.innerHTML = `<div><b>${esc(T('how'))}</b><p>${esc(T('howHold', { s: sym }))}</p>${s.mint ? `<p class="ca">${esc(T('ca'))}: <code>${esc(s.mint)}</code> <button type="button" class="ars-btn" data-a="copyca">${IC.copy}</button></p>` : ''}</div>
        <div class="ars-opts">${wbtn}<div class="ars-addr"><div><small>${esc(T('opt2'))}</small><em>${esc(numSol(holdParts().sol))} SOL</em></div><button type="button" class="ars-btn" data-a="deposit">${IC.sol}<span>${esc(T('deposit'))}</span></button></div></div>`;
    }
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
    if (viewer) viewer.start();                                  // podgląd 3D rysuje się tylko przy otwartym Arsenale
  }
  const close = () => { if (!ov.hidden) { ov.hidden = true; sfx.close && sfx.close(); if (viewer) viewer.stop(); } };
  tile.addEventListener('click', open);
  ov.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.i) { sel = +b.dataset.i; sfx.click && sfx.click(); render(); return; }
    if (b.classList.contains('ars-x')) return close();
    if (b.classList.contains('ref')) return load(true);
    if (b.dataset.a === 'login') { close(); openAuth(); return; }
    if (b.dataset.a === 'deposit') { close(); openWallet(); return; }
    if (b.dataset.a === 'copy' && s && s.address) { (navigator.clipboard ? navigator.clipboard.writeText(s.address) : Promise.reject()).then(() => toast(T('copied'), 'ok')).catch(() => {}); }
    if (b.dataset.a === 'copyca' && s && s.mint) { (navigator.clipboard ? navigator.clipboard.writeText(s.mint) : Promise.reject()).then(() => toast(T('copied'), 'ok')).catch(() => {}); }
    if (b.dataset.a === 'link') return linkWallet();
    if (b.dataset.a === 'unlink') return unlinkWallet();
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
