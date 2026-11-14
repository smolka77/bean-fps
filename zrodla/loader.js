// Ekran wczytywania BEANLADEN: biegnąca fasolka, tło z mapą, skośny pasek postępu, wskazówki w języku gracza.
// Wygląd (CSS) i znaczniki są w index.html (#ld), żeby ekran był widoczny od pierwszej chwili, zanim wczyta się kod.
//
// Użycie:  import { loader } from './loader.js';
//   loader.show({ title, sub, bg, label })  – bg = wartość CSS background (np. 'url("...")' albo gradient)
//   loader.set(p, label)                     – postęp 0..1 (pasek dojeżdża płynnie), opcjonalnie nowy podpis
//   loader.hide()                            – dopełnia pasek i chowa ekran z animacją
const TIPS = {
  pl: ['Kucanie w biegu (C) robi wślizg – świetny do wyskoczenia zza rogu.', 'Strzał w głowę zadaje dużo więcej obrażeń.', 'Celowanie (PPM) zmniejsza rozrzut, ale spowalnia ruch.',
    'Po wślizgu przez chwilę jesteś zmęczony – kolejny będzie słabszy.', 'Pistolet wyciągniesz szybciej niż przeładujesz karabin.', 'Skok psuje celność – strzelaj z ziemi.',
    'Klawisz F pozwala obejrzeć broń z bliska.', 'Wysokie miejsca dają przewagę, ale łatwo cię na nich zobaczyć.'],
  en: ['Crouch while sprinting (C) to slide – great for peeking corners.', 'Headshots deal much more damage.', 'Aiming (RMB) tightens your spread but slows you down.',
    'After a slide you are tired for a moment – the next one is weaker.', 'Switching to your pistol is faster than reloading the rifle.', 'Jumping ruins accuracy – shoot with your feet on the ground.',
    'Press F to inspect your weapon up close.', 'High ground gives you an edge, but you are easier to spot.'],
  ru: ['Присядь на бегу (C), чтобы сделать подкат – удобно выглядывать из-за угла.', 'Выстрел в голову наносит гораздо больше урона.', 'Прицеливание (ПКМ) уменьшает разброс, но замедляет.',
    'После подката ты ненадолго устаёшь – следующий будет слабее.', 'Достать пистолет быстрее, чем перезарядить винтовку.', 'Прыжок портит точность – стреляй с земли.',
    'Клавиша F – осмотреть оружие вблизи.', 'Высота даёт преимущество, но там тебя легче заметить.'],
  es: ['Agáchate corriendo (C) para deslizarte – ideal para asomarte en las esquinas.', 'Los disparos a la cabeza hacen mucho más daño.', 'Apuntar (clic derecho) reduce la dispersión pero te frena.',
    'Tras deslizarte quedas cansado un momento – el siguiente será más débil.', 'Sacar la pistola es más rápido que recargar el rifle.', 'Saltar arruina la puntería – dispara con los pies en el suelo.',
    'Pulsa F para examinar tu arma de cerca.', 'Las alturas dan ventaja, pero te ven con más facilidad.'],
};
const WORDS = { pl: ['WSKAZÓWKA', 'WCZYTYWANIE'], en: ['TIP', 'LOADING'], ru: ['СОВЕТ', 'ЗАГРУЗКА'], es: ['CONSEJO', 'CARGANDO'] };

function lang() {
  const l = document.documentElement.lang;
  if (TIPS[l]) return l;
  try { const s = JSON.parse(localStorage.getItem('fasolka-settings') || 'null'); if (s && s.langPicked && TIPS[s.lang]) return s.lang; } catch {}
  return 'en';
}

const $ = id => document.getElementById(id);
let shown = false, target = 0, cur = 0, raf = 0, tipT = 0, tipI = Math.floor(Math.random() * 8), hideT = 0;

function words() {
  const L = lang(), w = WORDS[L];
  const tag = $('ld-tiptag'); if (tag) tag.textContent = w[0];
  const lb = $('ld-label'); if (lb && !lb.dataset.custom) lb.textContent = w[1];
}
function nextTip() {
  const el = $('ld-tip'); if (!el) return;
  const list = TIPS[lang()]; tipI = (tipI + 1) % list.length;
  el.classList.remove('in'); void el.offsetWidth; el.textContent = list[tipI]; el.classList.add('in');
}
function paint() {
  const fill = $('ld-fill'), pct = $('ld-pct');
  if (fill) fill.style.width = (cur * 100).toFixed(1) + '%';
  if (pct) pct.textContent = Math.round(cur * 100) + '%';
}
function loop(ts) {
  raf = 0;
  if (!shown) return;
  cur += (target - cur) * .12; if (Math.abs(target - cur) < .002) cur = target;
  paint();
  if (!loop.last) loop.last = ts; const dt = Math.min(.1, (ts - loop.last) / 1000); loop.last = ts;
  tipT += dt; if (tipT > 4.2) { tipT = 0; nextTip(); }
  raf = requestAnimationFrame(loop);
}
function run() { if (!raf) { loop.last = 0; raf = requestAnimationFrame(loop); } }
function takeOverBoot(root) {           // ekran startowy: pasek pełzał animacją CSS – przejmujemy go od bieżącej szerokości
  const fill = $('ld-fill');
  if (root.classList.contains('boot') && fill) {
    const w = fill.getBoundingClientRect().width, tw = fill.parentElement.getBoundingClientRect().width;
    cur = tw ? Math.min(.95, w / tw) : 0; root.classList.remove('boot'); paint();
  }
}

export const loader = {
  show(o = {}) {
    const root = $('ld'); if (!root) return;
    clearTimeout(hideT);
    root.hidden = false; root.classList.remove('out', 'boot');
    $('ld-title').textContent = o.title || '';
    $('ld-sub').textContent = o.sub || '';
    const bg = $('ld-bg'); bg.style.background = o.bg ? o.bg + ' center/cover no-repeat' : ''; bg.classList.toggle('on', !!o.bg);
    const lb = $('ld-label'); if (o.label) { lb.textContent = o.label; lb.dataset.custom = '1'; } else delete lb.dataset.custom;
    root.classList.remove('done');
    cur = 0; target = .05; paint(); words(); tipT = 0; nextTip();
    shown = true; run();
  },
  set(p, label) {
    const root = $('ld'); if (!root || root.hidden) return;
    if (!shown) { shown = true; takeOverBoot(root); words(); run(); }
    target = Math.max(target, Math.min(1, p));
    if (label) { const lb = $('ld-label'); lb.textContent = label; lb.dataset.custom = '1'; }
  },
  hide() {
    const root = $('ld'); if (!root || root.hidden) return;
    if (!shown) { shown = true; takeOverBoot(root); run(); }
    target = 1; root.classList.add('done');
    clearTimeout(hideT);
    hideT = setTimeout(() => {
      root.classList.add('out');
      hideT = setTimeout(() => { root.hidden = true; root.classList.remove('out'); shown = false; cancelAnimationFrame(raf); raf = 0; }, 480);
    }, 260);
  },
  get visible() { const r = $('ld'); return !!r && !r.hidden; },
};
window.__loader = loader;
