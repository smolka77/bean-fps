// Udostępnienie gry na X jako warunek wejścia do Deathmatch.
//  - gracz dostaje stały, unikalny kod (np. GTA-7K3QD) i gotowy tekst posta (opis gry, CA, link, kod)
//  - przycisk w lobby otwiera okno X z tym tekstem (x.com/intent/post) – gracz tylko klika „Opublikuj”
//  - potem wkleja w grze link do swojego posta; serwer czyta post przez publiczny oEmbed X (bez klucza API, za darmo)
//    i sprawdza, czy jest w nim kod gracza (i CA, jeśli ustawione). Kod w treści = post należy do tego gracza.
//  - co `recheckHours` godzin przy wejściu do Deathmatch post jest sprawdzany ponownie (usunięty = trzeba udostępnić jeszcze raz);
//    gdy X nie odpowiada, gracz wchodzi (awaria X nie blokuje gry).
// Ustawienia w panelu admina (klucz 'xshare' w config). Domyślnie wyłączone.

// domyślny post po angielsku (bez linku – {url} można dopisać w panelu); razem z CA i kodem ok. 275 z 280 znaków X
const DEFAULT_TEXT = 'Just dropped into GRAND THEFT ASSAULT 🔫 – a fast browser FPS with real money stakes.\n\nNo download. Jump into Deathmatch, unlock guns, top the kill feed or go 1v1 for real money. Can you beat me? 👇\n\nCA: {ca}\n\n#GTASSAULT #FPS {code}';
// długość posta tak, jak liczy X: link = 23 znaki, emoji i znaki spoza alfabetów łacińskich = 2
export function xLength(t) {
  let n = 0;
  for (const ch of String(t).replace(/https?:\/\/\S+/g, 'x'.repeat(23))) { const c = ch.codePointAt(0); n += c <= 0x10ff || (c >= 0x2000 && c <= 0x200d) || (c >= 0x2010 && c <= 0x201f) || (c >= 0x2032 && c <= 0x2037) ? 1 : 2; }
  return n;
}
const D = { enabled: false, text: DEFAULT_TEXT, ca: '', url: '', requireCa: true, recheckHours: 24, profile: 'https://x.com/playGTAssault' };   // profile: strona gry na X (kafelek X w lobby)
const isB58 = (s) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);

export function sanitize(s = {}) {
  const text = String(s.text ?? D.text).slice(0, 600);
  const ca = String(s.ca ?? D.ca).trim();
  const url = String(s.url ?? D.url).trim();
  return {
    enabled: !!(s.enabled ?? D.enabled),
    text: text.includes('{code}') ? text : (text.trim() + ' {code}'),     // bez kodu nie da się sprawdzić, czyj to post
    ca: isB58(ca) ? ca : '',
    url: /^https?:\/\/(?=[^/\s]*[a-z])[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/[^\s]{0,180})?$/i.test(url) && !/^https?:\/\/\d+(\.\d+){3}/.test(url) ? url : '',   // tylko domena (DNS), nie adres IP
    requireCa: !!(s.requireCa ?? D.requireCa),
    recheckHours: Math.max(0, Math.min(24 * 30, Math.round(+(s.recheckHours ?? D.recheckHours) || 0))),
    profile: /^https:\/\/(www\.)?(x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/?$/.test(String(s.profile ?? '').trim()) ? String(s.profile).trim() : (s.profile === '' ? '' : D.profile),
  };
}

// link do posta: x.com / twitter.com (www., mobile.), /<konto>/status/<id> albo /i/status/<id>
export function parsePostUrl(raw) {
  const m = String(raw || '').trim().match(/^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/(?:([A-Za-z0-9_]{1,15})|i(?:\/web)?)\/status(?:es)?\/(\d{1,25})(?:[/?#].*)?$/i);
  return m ? { handle: m[1] && m[1].toLowerCase() !== 'i' ? m[1] : '', id: m[2] } : null;
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…' };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENT[e.toLowerCase()] ?? all));
// treść posta z HTML oEmbed: tylko <p> (bez stopki „— nick (@konto) data”)
export function postText(html) {
  const p = String(html || '').match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  return decode((p ? p[1] : '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''));
}

const ALPHA = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';   // bez 0/O/1/I – łatwe do odczytania
const newCode = (rnd) => 'GTA-' + Array.from(rnd(5), (b) => ALPHA[b % ALPHA.length]).join('');

export function createXShare({ db, getCfg, getCa, randomBytes, fetchImpl = fetch, log = console }) {
  db.exec(`CREATE TABLE IF NOT EXISTS xshare(user_id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, post_id TEXT UNIQUE, author TEXT, url TEXT,
    verified INTEGER NOT NULL DEFAULT 0, verified_at INTEGER, checked_at INTEGER)`);
  const q = (s) => db.prepare(s);
  const ca = () => { const c = getCfg(); return c.ca || getCa() || ''; };

  function row(uid) {
    let r = q('SELECT * FROM xshare WHERE user_id=?').get(uid);
    if (r) return r;
    for (let k = 0; k < 8; k++) {
      try { q('INSERT INTO xshare(user_id, code) VALUES(?,?)').run(uid, newCode(randomBytes)); break; } catch (e) { if (k === 7) throw e; }   // kolizja kodu – losujemy jeszcze raz
    }
    return q('SELECT * FROM xshare WHERE user_id=?').get(uid);
  }
  function textFor(code, origin) {
    const c = getCfg(), url = c.url || origin || '';
    return c.text.replace(/\{code\}/g, code).replace(/\{ca\}/g, ca()).replace(/\{url\}/g, url).replace(/\n{3,}/g, '\n\n').trim();
  }
  const isVerified = (uid) => { const r = q('SELECT verified FROM xshare WHERE user_id=?').get(uid); return !!(r && r.verified); };
  function status(uid, origin) {
    const c = getCfg(), r = row(uid), text = textFor(r.code, origin);
    return { enabled: c.enabled, verified: !!r.verified, code: r.code, text, intent: 'https://x.com/intent/post?text=' + encodeURIComponent(text), post: r.url || '', ca: ca() };
  }

  // odczyt posta przez oEmbed: { ok, text, author } | { gone } (usunięty / prywatny) | { err } (X nie odpowiada)
  async function fetchPost(id) {
    let r;
    try { r = await fetchImpl('https://publish.x.com/oembed?omit_script=1&dnt=true&url=' + encodeURIComponent('https://x.com/i/status/' + id), { signal: AbortSignal.timeout(8000), redirect: 'follow' }); }
    catch (e) { return { err: e && e.message || 'sieć' }; }
    if (r.status === 404 || r.status === 403) return { gone: true };
    if (!r.ok) return { err: 'HTTP ' + r.status };
    let j; try { j = await r.json(); } catch { return { err: 'zła odpowiedź' }; }
    const author = String(j.author_url || '').split('/').pop() || '';
    return { ok: true, text: postText(j.html), author };
  }
  const has = (text, s) => !!s && text.toLowerCase().includes(s.toLowerCase());

  // POST /api/xshare/verify – wklejony link; błąd = Error z polem code (serwer zamienia na odpowiedź 400)
  async function verify(uid, rawUrl, origin, E) {
    const c = getCfg(), p = parsePostUrl(rawUrl);
    if (!p) throw new E('xshare_url', 'To nie jest link do posta na X (np. https://x.com/twojekonto/status/123…)');
    const r = row(uid);
    const other = q('SELECT user_id FROM xshare WHERE post_id=? AND user_id<>?').get(p.id, uid);
    if (other) throw new E('xshare_taken', 'Ten post jest już przypisany do innego konta.');
    const post = await fetchPost(p.id);
    if (post.gone) throw new E('xshare_gone', 'Nie widać tego posta – sprawdź link i czy konto na X jest publiczne.');
    if (post.err) { log.error('[xshare] oEmbed:', post.err); throw new E('xshare_down', 'X nie odpowiada – spróbuj za chwilę.', 503); }
    if (!has(post.text, r.code)) throw new E('xshare_code', `W poście nie ma Twojego kodu ${r.code} – opublikuj gotowy tekst z przycisku.`);
    const want = ca();
    if (c.requireCa && want && !post.text.includes(want)) throw new E('xshare_ca', 'W poście nie ma adresu CA – opublikuj gotowy tekst z przycisku.');
    const now = Date.now(), url = `https://x.com/${post.author || 'i'}/status/${p.id}`;
    q('UPDATE xshare SET post_id=?, author=?, url=?, verified=1, verified_at=?, checked_at=? WHERE user_id=?').run(p.id, post.author, url, now, now, uid);
    log.log(`[xshare] gracz ${uid}: post ${url} zweryfikowany`);
    return status(uid, origin);
  }

  // przy wejściu do Deathmatch: czy post nadal jest (najwyżej co recheckHours). true = może grać
  async function recheck(uid) {
    const c = getCfg(), r = q('SELECT * FROM xshare WHERE user_id=?').get(uid);
    if (!r || !r.verified) return false;
    if (!c.recheckHours || Date.now() - (r.checked_at || 0) < c.recheckHours * 3600e3) return true;
    const post = await fetchPost(r.post_id);
    if (post.err) return true;                                       // awaria X nie blokuje gry
    if (post.gone || !has(post.text, r.code)) {
      q('UPDATE xshare SET verified=0, checked_at=? WHERE user_id=?').run(Date.now(), uid);
      log.log(`[xshare] gracz ${uid}: post ${r.url} zniknął – weryfikacja cofnięta`);
      return false;
    }
    q('UPDATE xshare SET checked_at=? WHERE user_id=?').run(Date.now(), uid);
    return true;
  }
  const needsRecheck = (uid) => { const c = getCfg(), r = q('SELECT verified, checked_at FROM xshare WHERE user_id=?').get(uid);
    return !!(r && r.verified && c.recheckHours && Date.now() - (r.checked_at || 0) >= c.recheckHours * 3600e3); };
  const stats = () => q('SELECT COUNT(*) n, SUM(verified) v FROM xshare').get();
  const reset = (uid) => q('UPDATE xshare SET verified=0, post_id=NULL, url=NULL, author=NULL WHERE user_id=?').run(uid);

  return { status, verify, recheck, needsRecheck, isVerified, stats, reset, textFor };
}
