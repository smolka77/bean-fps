// Profil gracza (karta konta w menu ☰): nick, e-mail, awatar (gotowe kolory albo własne zdjęcie), zmiana hasła
// i statystyki – mecze, skuteczność, celność, K/D oraz wykres zarobków w dolarach (jak w portfelu).
// Dane zapisuje „adapter” z lobby-ui.js: serwer portfeli albo konto lokalne.
import { renderEarnings } from './earnings.js';

const TXT = {
  pl: { title: 'Profil', since: 'Gracz od {d}', tProf: 'Profil', tSec: 'Bezpieczeństwo', tStats: 'Statystyki', nick: 'Nick', nickD: '3–16 znaków: litery, cyfry, _', email: 'E-mail', emailD: 'Do kontaktu i odzyskania konta (opcjonalnie)',
    avatar: 'Zdjęcie profilowe', avatarD: 'PNG, JPG lub WebP – przytniemy je do kwadratu', upload: 'Wgraj zdjęcie', change: 'Zmień zdjęcie', remove: 'Usuń', save: 'Zapisz zmiany', saving: 'Zapisywanie…', saved: 'Zapisano', pwOld: 'Obecne hasło', pwNew: 'Nowe hasło', pwNew2: 'Powtórz nowe hasło',
    pwBtn: 'Zmień hasło', pwOk: 'Hasło zmienione', pwShort: 'Nowe hasło: co najmniej 6 znaków', pwBad: 'Obecne hasło jest nieprawidłowe', pwMatch: 'Hasła nie są takie same', errNick: 'Nick: 3–16 znaków (litery, cyfry, _)', errMail: 'Nieprawidłowy adres e-mail',
    errImg: 'Nie udało się wczytać obrazka', matches: 'Mecze', wr: 'Skuteczność', kd: 'K/D', acc: 'Celność', hs: 'W głowę', earn: 'Zarobki', logout: 'Wyloguj', secD: 'Po zmianie hasła inne urządzenia zostaną wylogowane.', wl: '{w} W · {l} P' },
  en: { title: 'Profile', since: 'Player since {d}', tProf: 'Profile', tSec: 'Security', tStats: 'Stats', nick: 'Nickname', nickD: '3–16 characters: letters, digits, _', email: 'E-mail', emailD: 'For contact and account recovery (optional)',
    avatar: 'Profile picture', avatarD: 'PNG, JPG or WebP – we crop it to a square', upload: 'Upload photo', change: 'Change photo', remove: 'Remove', save: 'Save changes', saving: 'Saving…', saved: 'Saved', pwOld: 'Current password', pwNew: 'New password', pwNew2: 'Repeat new password',
    pwBtn: 'Change password', pwOk: 'Password changed', pwShort: 'New password: at least 6 characters', pwBad: 'Current password is incorrect', pwMatch: 'Passwords do not match', errNick: 'Nickname: 3–16 characters (letters, digits, _)', errMail: 'Invalid e-mail address',
    errImg: 'Could not load the image', matches: 'Matches', wr: 'Win rate', kd: 'K/D', acc: 'Accuracy', hs: 'Headshots', earn: 'Earnings', logout: 'Log out', secD: 'Changing your password signs out your other devices.', wl: '{w} W · {l} L' },
  ru: { title: 'Профиль', since: 'Игрок с {d}', tProf: 'Профиль', tSec: 'Безопасность', tStats: 'Статистика', nick: 'Ник', nickD: '3–16 символов: буквы, цифры, _', email: 'E-mail', emailD: 'Для связи и восстановления (необязательно)',
    avatar: 'Фото профиля', avatarD: 'PNG, JPG или WebP – обрежем до квадрата', upload: 'Загрузить фото', change: 'Сменить фото', remove: 'Удалить', save: 'Сохранить', saving: 'Сохранение…', saved: 'Сохранено', pwOld: 'Текущий пароль', pwNew: 'Новый пароль', pwNew2: 'Повтори новый пароль',
    pwBtn: 'Сменить пароль', pwOk: 'Пароль изменён', pwShort: 'Новый пароль: минимум 6 символов', pwBad: 'Текущий пароль неверный', pwMatch: 'Пароли не совпадают', errNick: 'Ник: 3–16 символов (буквы, цифры, _)', errMail: 'Неверный e-mail',
    errImg: 'Не удалось загрузить изображение', matches: 'Матчи', wr: 'Побед', kd: 'K/D', acc: 'Точность', hs: 'В голову', earn: 'Доход', logout: 'Выйти', secD: 'После смены пароля другие устройства выйдут из аккаунта.', wl: '{w} П · {l} Пор' },
  es: { title: 'Perfil', since: 'Jugador desde {d}', tProf: 'Perfil', tSec: 'Seguridad', tStats: 'Estadísticas', nick: 'Apodo', nickD: '3–16 caracteres: letras, números, _', email: 'E-mail', emailD: 'Para contacto y recuperar la cuenta (opcional)',
    avatar: 'Foto de perfil', avatarD: 'PNG, JPG o WebP – la recortamos en cuadrado', upload: 'Subir foto', change: 'Cambiar foto', remove: 'Quitar', save: 'Guardar cambios', saving: 'Guardando…', saved: 'Guardado', pwOld: 'Contraseña actual', pwNew: 'Nueva contraseña', pwNew2: 'Repite la nueva contraseña',
    pwBtn: 'Cambiar contraseña', pwOk: 'Contraseña cambiada', pwShort: 'Nueva contraseña: al menos 6 caracteres', pwBad: 'La contraseña actual no es correcta', pwMatch: 'Las contraseñas no coinciden', errNick: 'Apodo: 3–16 caracteres (letras, números, _)', errMail: 'E-mail no válido',
    errImg: 'No se pudo cargar la imagen', matches: 'Partidas', wr: 'Victorias', kd: 'K/D', acc: 'Precisión', hs: 'A la cabeza', earn: 'Ganancias', logout: 'Cerrar sesión', secD: 'Al cambiar la contraseña se cerrará la sesión en otros dispositivos.', wl: '{w} V · {l} D' },
};

export const AVATAR_PRESETS = {
  gold: ['#ffd76a', '#f09a1a'], sol: ['#9945ff', '#14f195'], ocean: ['#3fb6ff', '#1f4fd8'], crimson: ['#ff7a6b', '#b3123a'],
  lime: ['#d4ff5a', '#2bb24c'], pink: ['#ff9be0', '#c03ad9'], ice: ['#e6f3ff', '#7ab8ff'], night: ['#5b647a', '#1a1f2e'],
};
// awatar w elemencie: zdjęcie albo pierwsza litera na gradiencie
export function paintAvatar(el, acct) {
  if (!el) return; const a = acct && acct.avatar || '', name = acct && acct.username || '?';
  if (a.startsWith('data:image/')) { el.textContent = ''; el.style.background = `center/cover no-repeat url("${a}")`; el.style.color = 'transparent'; return; }
  const p = AVATAR_PRESETS.gold;
  el.textContent = name[0].toUpperCase(); el.style.background = `linear-gradient(150deg,${p[0]},${p[1]})`; el.style.color = '';
}

const CSS = `
#bl-p{position:fixed;inset:0;z-index:60;display:grid;place-items:center;padding:16px;background:rgba(4,7,14,.62);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);pointer-events:auto;
  font:500 14px/1.45 Inter,system-ui,sans-serif;color:#eef1f7}
#bl-p[hidden]{display:none}#bl-p *{box-sizing:border-box}#bl-p button{font:inherit;color:inherit;cursor:pointer}
#bl-p .bp{position:relative;width:min(520px,100%);max-height:calc(100dvh - 32px);overflow:auto;border-radius:22px;border:1px solid rgba(255,255,255,.12);
  background:linear-gradient(180deg,#121a2c,#0b111e);box-shadow:0 30px 80px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.06);animation:bp-in .22s ease}
@keyframes bp-in{from{opacity:0;transform:translateY(10px) scale(.985)}}
#bl-p .bp-hero{position:relative;display:flex;align-items:center;gap:16px;padding:22px 22px 18px;border-bottom:1px solid rgba(255,255,255,.07);
  background:radial-gradient(120% 160% at 0% 0%,rgba(255,198,41,.16),transparent 55%),radial-gradient(120% 160% at 100% 0%,rgba(153,69,255,.18),transparent 55%)}
#bl-p .bp-av{position:relative;flex:none;width:76px;height:76px;border-radius:22px;display:grid;place-items:center;font:800 34px/1 Inter,sans-serif;color:#2a1c00;
  box-shadow:0 10px 26px rgba(0,0,0,.4),inset 0 -3px 0 rgba(0,0,0,.18)}
#bl-p .bp-cam{position:absolute;right:-6px;bottom:-6px;width:30px;height:30px;border-radius:10px;border:2px solid #0f1626;background:#ffc629;color:#1d1300;display:grid;place-items:center}
#bl-p .bp-cam svg{width:15px;height:15px}
#bl-p .bp-who{min-width:0;flex:1}
#bl-p .bp-who h2{margin:0;font:800 24px/1.1 Inter,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#bl-p .bp-who small{display:block;margin-top:5px;font:600 12px/1 Inter,sans-serif;color:#8e9ab0}
#bl-p .bp-chips{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
#bl-p .bp-chip{font:700 11px/1 Inter,sans-serif;padding:6px 9px;border-radius:999px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);color:#d6dcea}
#bl-p .bp-chip b{color:#ffd36a}
#bl-p .bp-x{position:absolute;z-index:3;top:14px;right:14px;width:34px;height:34px;border-radius:10px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.04);display:grid;place-items:center}
#bl-p .bp-x:hover{background:rgba(255,255,255,.09)}
#bl-p .bp-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin:16px 22px 0;padding:4px;border-radius:13px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09)}
#bl-p .bp-tabs button{height:36px;border:0;border-radius:10px;background:none;font:600 13px/1 Inter,sans-serif;color:#8e9ab0}
#bl-p .bp-tabs button.on{background:rgba(255,198,41,.14);color:#ffe08a;box-shadow:inset 0 0 0 1px rgba(255,198,41,.4)}
#bl-p .bp-pane{padding:18px 22px 22px}#bl-p .bp-pane[hidden]{display:none}
#bl-p label.bp-f{display:block;margin-bottom:14px}
#bl-p label.bp-f>span{display:flex;justify-content:space-between;margin-bottom:6px;font:600 12px/1 Inter,sans-serif;color:#aeb8cc}
#bl-p label.bp-f>span i{font-style:normal;font-weight:500;color:#6f7a8f}
#bl-p .bp-in{width:100%;height:46px;padding:0 14px;border-radius:12px;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.12);color:#fff;font:600 15px/1 Inter,sans-serif;outline:none}
#bl-p .bp-in:focus{border-color:rgba(255,198,41,.6);box-shadow:0 0 0 3px rgba(255,198,41,.12)}
#bl-p .bp-avs{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}
#bl-p .bp-avcard{display:flex;align-items:center;gap:16px;margin:2px 0 16px;padding:14px;border-radius:16px;background:rgba(255,255,255,.035);border:1px dashed rgba(255,255,255,.16)}
#bl-p .bp-avprev{flex:none;width:72px;height:72px;border-radius:20px;display:grid;place-items:center;font:800 30px/1 Inter,sans-serif;color:#2a1c00;cursor:pointer;
  box-shadow:0 8px 20px rgba(0,0,0,.35),inset 0 -3px 0 rgba(0,0,0,.15);transition:transform .15s,box-shadow .15s}
#bl-p .bp-avprev:hover{transform:scale(1.04);box-shadow:0 0 0 3px rgba(255,198,41,.45),0 8px 20px rgba(0,0,0,.35)}
#bl-p .bp-avtx{min-width:0}
#bl-p .bp-avtx b{display:block;font:700 14px/1.2 Inter,sans-serif}
#bl-p .bp-avtx small{display:block;margin-top:4px;font:500 12px/1.35 Inter,sans-serif;color:#8e9ab0}
#bl-p .bp-btn.up{border:0;background:linear-gradient(180deg,#ffd84d,#ffb411);color:#1d1300}
#bl-p .bp-iw{position:relative}
#bl-p .bp-iw svg{position:absolute;left:14px;top:50%;width:17px;height:17px;transform:translateY(-50%);fill:none;stroke:#7d889c;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
#bl-p .bp-iw .bp-in{padding-left:42px}
#bl-p .bp-iw:focus-within svg{stroke:#ffc629}
#bl-p .bp-btn{height:42px;padding:0 16px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);font:700 13px/1 Inter,sans-serif;display:inline-flex;align-items:center;justify-content:center;gap:8px}
#bl-p .bp-btn:hover{background:rgba(255,255,255,.11)}
#bl-p .bp-btn.sm{height:40px;padding:0 12px;font-size:12px}
#bl-p .bp-btn.pri{border:0;background:linear-gradient(180deg,#ffd84d,#ffb411);color:#1d1300;box-shadow:0 8px 22px rgba(255,180,17,.25);width:100%}
#bl-p .bp-btn.out{width:100%;margin-top:10px;color:#ff9a8f;border-color:rgba(255,107,94,.3);background:rgba(255,107,94,.06)}
#bl-p .bp-btn:disabled{opacity:.6;cursor:progress}
#bl-p .bp-msg{margin-top:10px;font:600 13px/1.3 Inter,sans-serif;min-height:1px}
#bl-p .bp-msg.ok{color:#5fe0a0}#bl-p .bp-msg.err{color:#ff8f84}
#bl-p .bp-note{margin:-4px 0 14px;font-size:12px;color:#8e9ab0}
#bl-p .bp-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}
#bl-p .bp-st{padding:12px 10px;border-radius:13px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06)}
#bl-p .bp-st small{display:block;font:600 10px/1 Inter,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#8e9ab0}
#bl-p .bp-st b{display:block;margin-top:7px;font:800 19px/1 Inter,sans-serif;font-variant-numeric:tabular-nums}
#bl-p .bp-st em{display:block;margin-top:4px;font:600 11px/1 Inter,sans-serif;font-style:normal;color:#8e9ab0}
#bl-p h4.bp-h{margin:4px 0 10px;font:700 11px/1 Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#8e9ab0}
@media (max-width:480px){#bl-p .bp-stats{grid-template-columns:repeat(2,1fr)}#bl-p .bp-av{width:62px;height:62px;font-size:28px}}
@media (prefers-reduced-motion:reduce){#bl-p .bp{animation:none}}
`;

export function createProfile({ root, getLang, toast, adapter }) {
  const L = () => TXT[getLang()] || TXT.en, T = (k, v) => { let s = L()[k] ?? TXT.en[k]; if (v) for (const n in v) s = s.replace('{' + n + '}', v[n]); return s; };
  const loc = () => ({ pl: 'pl-PL', en: 'en-US', ru: 'ru-RU', es: 'es-ES' })[getLang()] || 'en-US';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  if (!document.getElementById('bl-p-css')) { const st = document.createElement('style'); st.id = 'bl-p-css'; st.textContent = CSS; document.head.appendChild(st); }
  const wrap = document.createElement('div'); wrap.id = 'bl-p'; wrap.hidden = true; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true');
  const camI = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
  wrap.innerHTML = `<div class="bp"><button class="bp-x" type="button" data-x aria-label="Zamknij"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    <div class="bp-hero"><div class="bp-av" id="bp-av"><button class="bp-cam" type="button" id="bp-cam">${camI}</button></div>
      <div class="bp-who"><h2 id="bp-name"></h2><small id="bp-since"></small></div></div>
    <div class="bp-tabs"><button type="button" data-tab="prof" data-t="tProf"></button><button type="button" data-tab="sec" data-t="tSec"></button><button type="button" data-tab="stats" data-t="tStats"></button></div>
    <form class="bp-pane" data-pane="prof" novalidate>
      <label class="bp-f"><span><b data-t="nick"></b><i data-t="nickD"></i></span><div class="bp-iw"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg><input class="bp-in" id="bp-nick" maxlength="16" autocomplete="username" spellcheck="false" autocapitalize="off"></div></label>
      <label class="bp-f"><span><b data-t="email"></b><i data-t="emailD"></i></span><div class="bp-iw"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg><input class="bp-in" id="bp-mail" type="email" maxlength="120" autocomplete="email" spellcheck="false" placeholder="name@example.com"></div></label>
      <div class="bp-avcard"><div class="bp-avprev" id="bp-avprev"></div><div class="bp-avtx"><b data-t="avatar"></b><small data-t="avatarD"></small><div class="bp-avs" id="bp-avs"></div></div></div>
      <input type="file" id="bp-file" accept="image/png,image/jpeg,image/webp" hidden>
      <button class="bp-btn pri" type="submit" id="bp-save" style="margin-top:6px" data-t="save"></button><div class="bp-msg" id="bp-msg"></div>
      <button class="bp-btn out" type="button" id="bp-out" data-t="logout"></button></form>
    <form class="bp-pane" data-pane="sec" novalidate hidden><p class="bp-note" data-t="secD"></p>
      <label class="bp-f"><span><b data-t="pwOld"></b></span><input class="bp-in" id="bp-p0" type="password" autocomplete="current-password" maxlength="128"></label>
      <label class="bp-f"><span><b data-t="pwNew"></b></span><input class="bp-in" id="bp-p1" type="password" autocomplete="new-password" maxlength="128"></label>
      <label class="bp-f"><span><b data-t="pwNew2"></b></span><input class="bp-in" id="bp-p2" type="password" autocomplete="new-password" maxlength="128"></label>
      <button class="bp-btn pri" type="submit" id="bp-pwb" data-t="pwBtn"></button><div class="bp-msg" id="bp-pwmsg"></div></form>
    <div class="bp-pane" data-pane="stats" hidden><div class="bp-stats" id="bp-stats"></div><h4 class="bp-h" data-t="earn"></h4><div id="bp-earn"></div></div></div>`;
  root.appendChild(wrap);
  const $ = id => wrap.querySelector('#' + id), camBtn = $('bp-cam');
  let tab = 'prof', draftAv = null, earn = null; const earnState = {};
  const close = () => { wrap.hidden = true; };
  wrap.addEventListener('click', e => { if (e.target === wrap || e.target.closest('[data-x]')) close(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !wrap.hidden) { e.stopImmediatePropagation(); close(); } }, true);
  wrap.querySelector('.bp-tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; tab = b.dataset.tab; render(); if (tab === 'stats') loadEarn(); });

  // awatar: gotowe kolory albo własne zdjęcie (przycięte do kwadratu 160 px, JPEG)
  camBtn.addEventListener('click', e => { e.stopPropagation(); $('bp-file').click(); });
  $('bp-avs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.up) return $('bp-file').click(); if (b.dataset.rm) { draftAv = ''; render(); } });
  $('bp-avprev').addEventListener('click', () => $('bp-file').click());
  $('bp-file').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = URL.createObjectURL(f); });
      const c = document.createElement('canvas'), S = 160, m = Math.min(img.width, img.height); c.width = c.height = S;
      c.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, S, S);
      let q = .86, d = c.toDataURL('image/jpeg', q); while (d.length > 85000 && q > .4) { q -= .1; d = c.toDataURL('image/jpeg', q); }
      URL.revokeObjectURL(img.src); draftAv = d; render();
    } catch { msg('bp-msg', T('errImg'), 'err'); }
  });
  const msg = (id, t, k = '') => { const el = $(id); el.textContent = t || ''; el.className = 'bp-msg ' + k; };

  wrap.querySelector('[data-pane="prof"]').addEventListener('submit', async e => {
    e.preventDefault(); const a = adapter.acct; if (!a) return;
    const nick = $('bp-nick').value.trim(), mail = $('bp-mail').value.trim().toLowerCase(), patch = {};
    if (!/^[a-z0-9_]{3,16}$/i.test(nick)) return msg('bp-msg', T('errNick'), 'err');
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) return msg('bp-msg', T('errMail'), 'err');
    if (nick !== a.username) patch.username = nick;
    if (mail !== (a.email || '')) patch.email = mail;
    if (draftAv !== null && draftAv !== (a.avatar || '')) patch.avatar = draftAv;
    if (!Object.keys(patch).length) return msg('bp-msg', T('saved'), 'ok');
    const b = $('bp-save'); b.disabled = true; b.textContent = T('saving'); msg('bp-msg');
    try { await adapter.save(patch); draftAv = null; msg('bp-msg', T('saved'), 'ok'); render(); }
    catch (er) { msg('bp-msg', er.message || String(er), 'err'); }
    b.disabled = false; b.textContent = T('save');
  });
  wrap.querySelector('[data-pane="sec"]').addEventListener('submit', async e => {
    e.preventDefault(); const p0 = $('bp-p0').value, p1 = $('bp-p1').value, p2 = $('bp-p2').value;
    if (p1.length < 6) return msg('bp-pwmsg', T('pwShort'), 'err'); if (p1 !== p2) return msg('bp-pwmsg', T('pwMatch'), 'err');
    const b = $('bp-pwb'); b.disabled = true;
    try { await adapter.password(p0, p1); ['bp-p0', 'bp-p1', 'bp-p2'].forEach(k => $(k).value = ''); msg('bp-pwmsg', T('pwOk'), 'ok'); toast(T('pwOk'), 'ok'); }
    catch (er) { msg('bp-pwmsg', er.code === 'oldpass' ? T('pwBad') : er.message || String(er), 'err'); }
    b.disabled = false;
  });
  $('bp-out').addEventListener('click', () => { close(); adapter.logout(); });

  async function loadEarn() { try { earn = await adapter.earnings(); } catch { earn = earn || []; } if (tab === 'stats') renderEarnings($('bp-earn'), earn, getLang(), earnState); }

  function render() {
    wrap.querySelectorAll('[data-t]').forEach(el => { el.textContent = T(el.dataset.t); });
    const a = adapter.acct; if (!a || wrap.hidden) return;
    const shown = { ...a, avatar: draftAv !== null ? draftAv : a.avatar };
    paintAvatar($('bp-av'), shown); $('bp-av').appendChild(camBtn);
    $('bp-name').textContent = a.username;
    $('bp-since').textContent = T('since', { d: new Date(a.createdAt).toLocaleDateString(loc(), { day: 'numeric', month: 'long', year: 'numeric' }) });
    const st = a.stats || {}, games = (st.wins || 0) + (st.losses || 0);
    if (document.activeElement !== $('bp-nick')) $('bp-nick').value = a.username;
    if (document.activeElement !== $('bp-mail')) $('bp-mail').value = a.email || '';
    const cur = draftAv !== null ? draftAv : (a.avatar || ''), photo = cur.startsWith('data:');
    paintAvatar($('bp-avprev'), { ...a, avatar: cur });
    $('bp-avs').innerHTML = `<button type="button" class="bp-btn sm up" data-up="1">${camI.replace('<svg', '<svg width="15" height="15"')}${esc(T(photo ? 'change' : 'upload'))}</button>` + (photo ? `<button type="button" class="bp-btn sm" data-rm="1">${esc(T('remove'))}</button>` : '');
    wrap.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    wrap.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== tab; });
    const pct = (x, y) => y ? Math.round(x / y * 100) + '%' : '—';
    $('bp-stats').innerHTML = [[T('matches'), games, T('wl', { w: st.wins || 0, l: st.losses || 0 })], [T('wr'), pct(st.wins || 0, games), ''],
      [T('kd'), st.deaths ? (st.kills / st.deaths).toFixed(2) : st.kills ? String(st.kills) : '—', `${st.kills || 0} / ${st.deaths || 0}`], [T('acc'), pct(st.hits || 0, st.shots || 0), `${T('hs')} ${pct(st.heads || 0, st.hits || 0)}`]]
      .map(([k, v, s]) => `<div class="bp-st"><small>${esc(k)}</small><b>${esc(v)}</b><em>${esc(s || ' ')}</em></div>`).join('');
    if (tab === 'stats') renderEarnings($('bp-earn'), earn, getLang(), earnState);
  }
  return {
    open(t = 'prof') { tab = t; draftAv = null; earn = null; msg('bp-msg'); msg('bp-pwmsg'); wrap.hidden = false; render(); if (tab === 'stats') loadEarn(); },
    close, render, get open$() { return !wrap.hidden; },
  };
}
