// Ekran wczytywania: tło, nazwa gry i pasek postępu (bez wskazówek).
// Wygląd (CSS) i znaczniki są w index.html (#ld), żeby ekran był widoczny od pierwszej chwili, zanim wczyta się kod.
//
// Użycie:  import { loader } from './loader.js';
//   loader.show({ title, sub, bg, label })  – bg = wartość CSS background (np. 'url("...")' albo gradient)
//   loader.set(p, label)                     – postęp 0..1 (pasek dojeżdża płynnie), opcjonalnie nowy podpis
//   loader.hide()                            – dopełnia pasek i chowa ekran z animacją
const WORDS = { pl: 'WCZYTYWANIE', en: 'LOADING', ru: 'ЗАГРУЗКА', es: 'CARGANDO' };

function lang() {
  const l = document.documentElement.lang;
  if (WORDS[l]) return l;
  try { const s = JSON.parse(localStorage.getItem('fasolka-settings') || 'null'); if (s && s.langPicked && WORDS[s.lang]) return s.lang; } catch {}
  return 'en';
}

const $ = id => document.getElementById(id);
let shown = false, target = 0, cur = 0, raf = 0, hideT = 0;

function words() {
  const lb = $('ld-label'); if (lb && !lb.dataset.custom) lb.textContent = WORDS[lang()];
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
  raf = requestAnimationFrame(loop);
}
function run() { if (!raf) raf = requestAnimationFrame(loop); }
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
    cur = 0; target = .05; paint(); words();
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
