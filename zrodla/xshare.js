// Okno „Udostępnij na X” przed wejściem do Deathmatch (serwer: serwer/xshare.mjs).
// Krok 1: przycisk otwiera okno X z gotowym tekstem (opis gry, CA, link, kod gracza). Krok 2: gracz wkleja link do posta, serwer go sprawdza.
// Użycie: const xs = createXShare({ root, getLang, toast, sfx, wallet }); xs.open(() => wejdźDoDM()); xs.el – okno (do listy okien lobby).
import { srvText } from './wallet.js';
const TXT = {
  pl: { tag: 'DEATHMATCH', title: 'Udostępnij grę na X', sub: 'Wejście do Deathmatch jest za darmo – wystarczy jeden post o grze.', s1: 'Opublikuj post', s1d: 'Otworzy się X z gotowym tekstem. Nie zmieniaj kodu na końcu.',
    share: 'Udostępnij na X', copy: 'Kopiuj tekst', copied: 'Skopiowano', s2: 'Wklej link do posta', s2d: 'Na X kliknij „Udostępnij” → „Kopiuj link” i wklej go tutaj.', ph: 'https://x.com/twojekonto/status/…',
    verify: 'Sprawdź i graj', checking: 'Sprawdzam post…', ok: 'Post zweryfikowany – miłej gry!', code: 'Twój kod', loading: 'Wczytywanie…', err: 'Nie udało się połączyć z serwerem.', paste: 'Wklej link do posta.', close: 'Zamknij' },
  en: { tag: 'DEATHMATCH', title: 'Share the game on X', sub: 'Deathmatch is free – all it takes is one post about the game.', s1: 'Publish a post', s1d: 'X opens with the text ready. Keep the code at the end.',
    share: 'Share on X', copy: 'Copy text', copied: 'Copied', s2: 'Paste the post link', s2d: 'On X tap “Share” → “Copy link” and paste it here.', ph: 'https://x.com/youraccount/status/…',
    verify: 'Verify & play', checking: 'Checking post…', ok: 'Post verified – have fun!', code: 'Your code', loading: 'Loading…', err: 'Could not reach the server.', paste: 'Paste the post link.', close: 'Close' },
  es: { tag: 'DEATHMATCH', title: 'Comparte el juego en X', sub: 'Deathmatch es gratis: basta con una publicación sobre el juego.', s1: 'Publica un post', s1d: 'Se abrirá X con el texto listo. No cambies el código del final.',
    share: 'Compartir en X', copy: 'Copiar texto', copied: 'Copiado', s2: 'Pega el enlace del post', s2d: 'En X pulsa «Compartir» → «Copiar enlace» y pégalo aquí.', ph: 'https://x.com/tucuenta/status/…',
    verify: 'Verificar y jugar', checking: 'Comprobando el post…', ok: 'Post verificado – ¡a jugar!', code: 'Tu código', loading: 'Cargando…', err: 'No se pudo conectar con el servidor.', paste: 'Pega el enlace del post.', close: 'Cerrar' },
};
const XLOGO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.4L6.4 22H3.3l7.3-8.3L2.9 2h6.4l4.4 5.9L18.9 2Zm-1.1 18.1h1.7L8.3 3.8H6.5l11.3 16.3Z"/></svg>';
const CSS = `
#lb-ui .lb-xs{position:absolute;inset:0;z-index:41;pointer-events:auto;display:grid;place-items:center;padding:16px;overflow:auto;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);
  background:radial-gradient(120% 90% at 50% 120%,rgba(255,46,147,.28),rgba(0,0,0,0) 55%),rgba(8,3,12,.9);color:#f4eff6}
#lb-ui .lb-xs[hidden]{display:none}
#lb-ui .xs-dlg{position:relative;width:min(560px,100%);box-sizing:border-box;padding:28px 28px 24px;background:linear-gradient(180deg,rgba(24,8,32,.98),rgba(14,4,20,.98));
  border-top:3px solid transparent;border-image:var(--vc,linear-gradient(90deg,#ff2e93,#22e0d6)) 1;box-shadow:0 30px 80px rgba(0,0,0,.6)}
#lb-ui .xs-x{position:absolute;top:12px;right:12px;width:34px;height:34px;border:0;background:rgba(255,255,255,.06);color:#fff;font:700 18px/1 sans-serif;cursor:pointer}
#lb-ui .xs-x:hover{background:rgba(255,255,255,.14)}
#lb-ui .xs-tag{font:700 11px/1 'Barlow Condensed',Oswald,sans-serif;letter-spacing:.18em;color:var(--teal,#22e0d6)}
#lb-ui .xs-dlg h2{margin:8px 0 6px;font:400 clamp(28px,5vw,40px)/.95 Anton,Impact,sans-serif;text-transform:uppercase;letter-spacing:.02em;transform:skewX(-6deg);transform-origin:left}
#lb-ui .xs-sub{margin:0 0 20px;color:var(--mut,#a39aae);font-size:14px}
#lb-ui .xs-step{display:grid;grid-template-columns:30px 1fr;gap:4px 12px;margin-top:16px}
#lb-ui .xs-n{grid-row:span 3;width:30px;height:30px;display:grid;place-items:center;background:var(--acc,#ff2e93);color:#fff;font:400 17px/1 Anton,Impact,sans-serif}
#lb-ui .xs-step.done .xs-n{background:var(--cash,#3ce38a);color:#07140c}
#lb-ui .xs-step b{font:700 16px/1.2 'Barlow Condensed',Oswald,sans-serif;letter-spacing:.06em;text-transform:uppercase}
#lb-ui .xs-step p{margin:0;color:var(--mut,#a39aae);font-size:13px}
#lb-ui .xs-pre{margin:8px 0 0;padding:10px 12px;max-height:150px;overflow:auto;white-space:pre-wrap;word-break:break-word;background:rgba(255,255,255,.05);border-left:2px solid rgba(255,255,255,.2);font:13px/1.45 system-ui,sans-serif;color:#e9e3ee}
#lb-ui .xs-pre mark{background:rgba(255,46,147,.25);color:#fff;padding:0 3px}
#lb-ui .xs-row{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
#lb-ui .xs-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:0 16px;border:0;cursor:pointer;font:700 15px/1 'Barlow Condensed',Oswald,sans-serif;letter-spacing:.08em;text-transform:uppercase;text-decoration:none}
#lb-ui .xs-btn svg{width:17px;height:17px}
#lb-ui .xs-x1{background:#fff;color:#000}#lb-ui .xs-x1:hover{background:#e6e6e6}
#lb-ui .xs-ghost{background:rgba(255,255,255,.08);color:#fff}#lb-ui .xs-ghost:hover{background:rgba(255,255,255,.16)}
#lb-ui .xs-go{flex:1;background:var(--acc,#ff2e93);color:#fff}#lb-ui .xs-go:hover{filter:brightness(1.1)}#lb-ui .xs-go[disabled]{opacity:.6;cursor:default;filter:none}
#lb-ui .xs-in{width:100%;box-sizing:border-box;min-height:42px;margin-top:8px;padding:0 12px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.35);color:#fff;font:14px system-ui,sans-serif;outline:none}
#lb-ui .xs-in:focus{border-color:var(--teal,#22e0d6)}
#lb-ui .xs-msg{min-height:18px;margin:10px 0 0;font-size:13px}#lb-ui .xs-msg.err{color:#ff6b8b}#lb-ui .xs-msg.ok{color:var(--cash,#3ce38a)}
@media (max-width:480px){#lb-ui .xs-dlg{padding:24px 18px 18px}#lb-ui .xs-row .xs-btn{flex:1}}
`;

export function createXShare({ root, getLang, toast = () => {}, sfx = {}, wallet = () => null }) {
  const T = (k) => (TXT[getLang()] || TXT.en)[k] ?? TXT.en[k] ?? k;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  if (!document.getElementById('lb-xs-css')) { const st = document.createElement('style'); st.id = 'lb-xs-css'; st.textContent = CSS; document.head.appendChild(st); }
  const ov = document.createElement('div'); ov.className = 'lb-xs'; ov.id = 'lb-xshare'; ov.hidden = true;
  ov.innerHTML = `<div class="xs-dlg" role="dialog" aria-modal="true" aria-labelledby="xs-h">
    <button type="button" class="xs-x">×</button>
    <div class="xs-tag"></div><h2 id="xs-h"></h2><p class="xs-sub"></p>
    <div class="xs-step" data-s="1"><span class="xs-n">1</span><b></b><p></p>
      <div><div class="xs-pre"></div><div class="xs-row"><a class="xs-btn xs-x1" target="_blank" rel="noopener">${XLOGO}<span></span></a><button type="button" class="xs-btn xs-ghost xs-copy"></button></div></div></div>
    <div class="xs-step" data-s="2"><span class="xs-n">2</span><b></b><p></p>
      <div><input class="xs-in" type="url" inputmode="url" autocomplete="off" spellcheck="false"><div class="xs-row"><button type="button" class="xs-btn xs-go"></button></div><p class="xs-msg" role="status"></p></div></div>
  </div>`;
  root.appendChild(ov);
  const Q = (s) => ov.querySelector(s);
  let st = null, onOk = null, busy = false;

  async function call(method, p, body) {
    const w = wallet(); if (!w || !w.api) throw new Error(T('err'));
    const r = await fetch(w.api + '/api' + p, { method, headers: { 'Content-Type': 'application/json', ...(w.token && w.token !== 'local' ? { Authorization: 'Bearer ' + w.token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    let j = {}; try { j = await r.json(); } catch {}
    if (!r.ok) throw new Error(j.message ? srvText(j.message, getLang()) : T('err'));
    return j;
  }
  const msg = (text, kind = '') => { const m = Q('.xs-msg'); m.textContent = text || ''; m.className = 'xs-msg' + (kind ? ' ' + kind : ''); };
  function render() {
    Q('.xs-tag').textContent = T('tag'); Q('#xs-h').textContent = T('title'); Q('.xs-sub').textContent = T('sub'); Q('.xs-x').setAttribute('aria-label', T('close'));
    const [s1, s2] = ov.querySelectorAll('.xs-step');
    s1.querySelector('b').textContent = T('s1'); s1.querySelector('p').textContent = T('s1d');
    s2.querySelector('b').textContent = T('s2'); s2.querySelector('p').textContent = T('s2d');
    Q('.xs-x1 span').textContent = T('share'); Q('.xs-copy').textContent = T('copy');
    Q('.xs-in').placeholder = T('ph'); Q('.xs-go').textContent = busy ? T('checking') : T('verify'); Q('.xs-go').disabled = busy || !st;
    const pre = Q('.xs-pre');
    if (!st) { pre.textContent = T('loading'); Q('.xs-x1').removeAttribute('href'); return; }
    pre.innerHTML = esc(st.text).replace(esc(st.code), `<mark>${esc(st.code)}</mark>`);
    Q('.xs-x1').href = st.intent;
  }
  async function open(cb) {
    onOk = cb; st = null; busy = false; msg(''); Q('.xs-in').value = '';
    ov.querySelectorAll('.xs-step').forEach((s) => s.classList.remove('done'));
    ov.hidden = false; if (sfx.open) sfx.open(); render();
    try { st = await call('GET', '/xshare'); if (st.post) Q('.xs-in').value = st.post; } catch (e) { msg(e.message, 'err'); }
    render();
    if (st && st.verified) { close(); if (onOk) onOk(); }       // już zweryfikowany (np. w innej karcie)
  }
  function close() { if (ov.hidden) return; ov.hidden = true; if (sfx.close) sfx.close(); }
  async function verify() {
    if (busy || !st) return;
    const url = Q('.xs-in').value.trim(); if (!url) { msg(T('paste'), 'err'); Q('.xs-in').focus(); return; }
    busy = true; msg(''); render();
    try {
      st = await call('POST', '/xshare/verify', { url });
      ov.querySelectorAll('.xs-step').forEach((s) => s.classList.add('done'));
      msg(T('ok'), 'ok'); toast(T('ok'), 'ok');
      setTimeout(() => { close(); if (onOk) onOk(); }, 700);
    } catch (e) { msg(e.message, 'err'); }
    busy = false; render();
  }
  Q('.xs-x').addEventListener('click', close);
  ov.addEventListener('pointerdown', (e) => { if (e.target === ov) close(); });
  Q('.xs-x1').addEventListener('click', () => { ov.querySelector('[data-s="1"]').classList.add('done'); setTimeout(() => Q('.xs-in').focus(), 300); });
  Q('.xs-copy').addEventListener('click', async () => { if (!st) return; try { await navigator.clipboard.writeText(st.text); Q('.xs-copy').textContent = T('copied'); setTimeout(render, 1400); } catch {} });
  Q('.xs-go').addEventListener('click', verify);
  Q('.xs-in').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); verify(); } e.stopPropagation(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !ov.hidden) { e.stopPropagation(); close(); } }, true);

  return { el: ov, open, close, get open_() { return !ov.hidden; } };
}
