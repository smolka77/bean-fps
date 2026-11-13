// Zarobki gracza: wynik / wygrane / przegrane w dolarach i wykres skumulowanego zysku w czasie (zielony nad zerem,
// czerwony pod zerem), z zakresem 7 dni / 30 dni / wszystko i podpowiedzią po najechaniu. Używają go portfel i profil.
const TXT = {
  pl: { net: 'Wynik', won: 'Wygrane', lost: 'Przegrane', all: 'Wszystko', d7: '7 dni', d30: '30 dni', none: 'Zagraj mecz o stawkę, a tu zobaczysz swój wynik w czasie.', load: 'Ładowanie…', match: 'Mecz {n}', chart: 'Zarobki' },
  en: { net: 'Net result', won: 'Won', lost: 'Lost', all: 'All', d7: '7 days', d30: '30 days', none: 'Play a staked match and your results over time will show up here.', load: 'Loading…', match: 'Match {n}', chart: 'Earnings' },
  ru: { net: 'Итог', won: 'Выиграно', lost: 'Проиграно', all: 'Всё', d7: '7 дней', d30: '30 дней', none: 'Сыграй матч на ставку – здесь появится твой результат.', load: 'Загрузка…', match: 'Матч {n}', chart: 'Доход' },
  es: { net: 'Resultado', won: 'Ganado', lost: 'Perdido', all: 'Todo', d7: '7 días', d30: '30 días', none: 'Juega una partida con apuesta y aquí verás tu resultado en el tiempo.', load: 'Cargando…', match: 'Partida {n}', chart: 'Ganancias' },
};
export const EARN_CSS = `
.be-kpis{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:8px}
.be-kpi{padding:12px;border-radius:13px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06)}
.be-kpi small{display:block;font:600 10px/1 Inter,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#8e9ab0}
.be-kpi b{display:block;margin-top:7px;font:800 18px/1 Inter,sans-serif;font-variant-numeric:tabular-nums;color:#eef1f7}
.be-kpi.big b{font-size:24px}
.be-pos{color:#2fd27a!important}.be-neg{color:#ff6b5e!important}
.be-rng{display:flex;gap:4px;margin:14px 0 8px}
.be-rng button{height:28px;padding:0 10px;border-radius:8px;border:1px solid rgba(255,255,255,.09);background:none;font:600 12px/1 Inter,sans-serif;color:#8e9ab0;cursor:pointer}
.be-rng button.on{color:#fff;background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.2)}
.be-chart{position:relative;height:190px;border-radius:14px;background:rgba(0,0,0,.18);border:1px solid rgba(255,255,255,.05)}
.be-chart svg{width:100%;height:100%;display:block}
.be-chart .ax text{font:600 10px Inter,sans-serif;fill:#7d889c}
.be-empty{height:100%;display:grid;place-items:center;padding:0 20px;text-align:center;color:#8e9ab0;font:500 13px/1.4 Inter,sans-serif}
.be-tip{position:absolute;transform:translate(-50%,-115%);pointer-events:none;padding:7px 10px;border-radius:10px;background:#0b111e;border:1px solid rgba(255,255,255,.16);
  font:700 12px/1.3 Inter,sans-serif;color:#eef1f7;white-space:nowrap;box-shadow:0 8px 20px rgba(0,0,0,.4)}
.be-tip small{display:block;font-weight:600;color:#8e9ab0}
`;
let cssOn = false;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// points: [{t, net, cum, won}] (kolejność rosnąca w czasie); null = jeszcze się ładuje
export function renderEarnings(box, points, lang, state = {}) {
  if (!cssOn) { cssOn = true; const st = document.createElement('style'); st.textContent = EARN_CSS; document.head.appendChild(st); }
  const L = TXT[lang] || TXT.en, T = (k, v) => { let s = L[k]; if (v) for (const n in v) s = s.replace('{' + n + '}', v[n]); return s; };
  const loc = ({ pl: 'pl-PL', en: 'en-US', ru: 'ru-RU', es: 'es-ES' })[lang] || 'en-US';
  const fmtUsd = v => (v < 0 ? '−' : '') + '$' + Math.abs(v).toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const range = state.range || 'all';
  if (!box.querySelector('.be-kpis')) {
    box.innerHTML = `<div class="be-kpis"></div><div class="be-rng"><button type="button" data-r="7"></button><button type="button" data-r="30"></button><button type="button" data-r="all"></button></div><div class="be-chart"></div>`;
    box.querySelector('.be-rng').addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (!b) return; state.range = b.dataset.r; renderEarnings(box, box._pts, box._lang, state); });
  }
  box._pts = points; box._lang = lang;
  box.querySelectorAll('.be-rng [data-r]').forEach(b => { b.textContent = T(b.dataset.r === 'all' ? 'all' : 'd' + b.dataset.r); b.classList.toggle('on', b.dataset.r === range); });
  const pts0 = points || [], from = range === 'all' ? 0 : Date.now() - (+range) * 86400e3;
  const pts = pts0.filter(p => p.t >= from), base = pts0.filter(p => p.t < from).reduce((a, p) => a + p.net, 0);
  const won = pts.filter(p => p.net > 0).reduce((a, p) => a + p.net, 0), lost = -pts.filter(p => p.net < 0).reduce((a, p) => a + p.net, 0), net = won - lost;
  box.querySelector('.be-kpis').innerHTML = `<div class="be-kpi big"><small>${esc(T('net'))}</small><b class="${net > 0 ? 'be-pos' : net < 0 ? 'be-neg' : ''}">${net > 0 ? '+' : ''}${fmtUsd(net)}</b></div>
    <div class="be-kpi"><small>${esc(T('won'))}</small><b class="be-pos">+${fmtUsd(won)}</b></div><div class="be-kpi"><small>${esc(T('lost'))}</small><b class="be-neg">${fmtUsd(-lost)}</b></div>`;
  const el = box.querySelector('.be-chart');
  if (!pts.length) { el.innerHTML = `<div class="be-empty">${esc(points ? T('none') : T('load'))}</div>`; return; }
  const W = 440, H = 190, pl = 46, pr = 10, pt = 14, pb = 22;
  const series = [{ t: pts[0].t - 1, cum: base }, ...pts.map(p => ({ t: p.t, cum: p.cum, p }))];
  let lo = Math.min(0, ...series.map(s => s.cum)), hi = Math.max(0, ...series.map(s => s.cum)); if (hi - lo < 1) { hi += .5; lo -= .5; }
  const pad = (hi - lo) * .12; hi += pad; lo -= pad;
  const x = i => pl + (W - pl - pr) * (series.length === 1 ? .5 : i / (series.length - 1)), y = v => pt + (H - pt - pb) * (hi - v) / (hi - lo), y0 = y(0);
  const line = series.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(s.cum).toFixed(1)}`).join('');
  const area = `${line}L${x(series.length - 1).toFixed(1)} ${y0}L${x(0).toFixed(1)} ${y0}Z`;
  const ticks = [hi - pad, 0, lo + pad].filter((v, i, a) => a.findIndex(w => Math.abs(w - v) < (hi - lo) * .08) === i);
  const fmtK = v => (v < 0 ? '−' : '') + '$' + (Math.abs(v) >= 1000 ? (Math.abs(v) / 1000).toFixed(1) + 'k' : Math.abs(v).toFixed(Math.abs(v) < 10 ? 2 : 0));
  const last = series[series.length - 1].cum, col = last >= base ? '#2fd27a' : '#ff6b5e', id = 'be' + Math.random().toString(36).slice(2, 7);
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(T('chart'))}"><defs>
    <linearGradient id="${id}u" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2fd27a" stop-opacity=".38"/><stop offset="1" stop-color="#2fd27a" stop-opacity="0"/></linearGradient>
    <linearGradient id="${id}d" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff6b5e" stop-opacity=".38"/><stop offset="1" stop-color="#ff6b5e" stop-opacity="0"/></linearGradient>
    <clipPath id="${id}cu"><rect x="0" y="0" width="${W}" height="${y0}"/></clipPath><clipPath id="${id}cd"><rect x="0" y="${y0}" width="${W}" height="${H - y0}"/></clipPath></defs>
    <g class="ax">${ticks.map(v => `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(255,255,255,${v === 0 ? .22 : .07})" ${v === 0 ? 'stroke-dasharray="3 4"' : ''}/><text x="${pl - 8}" y="${y(v) + 3}" text-anchor="end">${fmtK(v)}</text>`).join('')}</g>
    <path d="${area}" fill="url(#${id}u)" clip-path="url(#${id}cu)"/><path d="${area}" fill="url(#${id}d)" clip-path="url(#${id}cd)"/>
    <path d="${line}" fill="none" stroke="#2fd27a" stroke-width="2.2" stroke-linejoin="round" clip-path="url(#${id}cu)" vector-effect="non-scaling-stroke"/>
    <path d="${line}" fill="none" stroke="#ff6b5e" stroke-width="2.2" stroke-linejoin="round" clip-path="url(#${id}cd)" vector-effect="non-scaling-stroke"/>
    <circle class="be-dot" r="4" fill="${col}" stroke="#0b111e" stroke-width="2" cx="${x(series.length - 1)}" cy="${y(last)}"/></svg><div class="be-tip" hidden></div>`;
  const svg = el.querySelector('svg'), tip = el.querySelector('.be-tip'), dot = el.querySelector('.be-dot');
  svg.addEventListener('pointermove', e => {
    const r = svg.getBoundingClientRect(); if (!r.width) return;
    let i = Math.round(((e.clientX - r.left) / r.width * W - pl) / (W - pl - pr) * (series.length - 1)); if (!Number.isFinite(i)) return;
    i = Math.max(1, Math.min(series.length - 1, i)); const s = series[i]; if (!s || !s.p) return;
    dot.setAttribute('cx', x(i)); dot.setAttribute('cy', y(s.cum)); dot.setAttribute('fill', s.p.net >= 0 ? '#2fd27a' : '#ff6b5e');
    tip.innerHTML = `<small>${esc(T('match', { n: pts0.indexOf(s.p) + 1 }))} · ${new Date(s.t).toLocaleString(loc, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>
      <span class="${s.p.net >= 0 ? 'be-pos' : 'be-neg'}">${s.p.net >= 0 ? '+' : ''}${fmtUsd(s.p.net)}</span> · ${esc(T('net'))} ${s.cum >= 0 ? '+' : ''}${fmtUsd(s.cum)}`;
    tip.style.left = (x(i) / W * r.width) + 'px'; tip.style.top = (y(s.cum) / H * r.height) + 'px'; tip.hidden = false;
  });
  svg.addEventListener('pointerleave', () => { tip.hidden = true; dot.setAttribute('cx', x(series.length - 1)); dot.setAttribute('cy', y(last)); dot.setAttribute('fill', col); });
}

// zarobki z historii konta (tryb bez serwera): każda stawka to mecz, wygrana dopisuje wypłatę
export function pointsFromHistory(hist) {
  const h = (hist || []).slice().sort((a, b) => a.t - b.t), out = []; let cum = 0, open = null;
  for (const x of h) {
    if (x.type === 'stake') { if (open) { cum = Math.round((cum - open.s) * 100) / 100; out.push({ t: open.t, net: -open.s, cum, won: false }); } open = { t: x.t, s: -x.amount }; }
    else if (x.type === 'win' && open) { const net = Math.round((x.amount - open.s) * 100) / 100; cum = Math.round((cum + net) * 100) / 100; out.push({ t: x.t, net, cum, won: true }); open = null; }
    else if (x.type === 'loss' && open) { cum = Math.round((cum - open.s) * 100) / 100; out.push({ t: x.t, net: -open.s, cum, won: false }); open = null; }
  }
  return out;
}
