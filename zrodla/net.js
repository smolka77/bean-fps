// Połączenie gry z serwerem meczów 1v1 (WebSocket /ws na serwerze portfeli).
// Kolejka: queue({matchId, skin}) -> 'queued' -> 'matched' {seat, map, opp:{nick, skin}} -> obaj 'ready' -> 'go'.
// W meczu gracz wysyła tylko: 'st' (stan ~20/s), 'sh' (skąd i w którą stronę strzelił), 'rl' (przeładowanie), 'rs'/'lv' (start rundy),
// 'po' (odpowiedź na ping). Trafienia, obrażenia, śmierć, amunicję i ruch sprawdza serwer: odsyła 'dmg', 'hc', 'sh' (smuga),
// 'fix' (cofnięcie niedozwolonego ruchu), 'st' (przeciwnik; null = nie widać go), 'round' i 'end' {reason: 'score' | 'left' | 'cheat'}.
import { walletApi } from './wallet-config.js';
import { t as tr } from './lobby-ui.js';

export function createNet() {
  let ws = null, closing = false;
  const on = {};                                                   // t -> funkcja(wiadomość)
  const emit = (t, m) => { const f = on[t]; if (f) try { f(m); } catch (e) { console.error('net', t, e); } };
  const token = () => { try { return localStorage.getItem('bl-token') || ''; } catch { return ''; } };
  const base = () => (walletApi() || location.origin).replace(/\/+$/, '');
  // token sesji nie idzie w adresie /ws (adresy trafiają do logów): serwer daje jednorazowy bilet ważny 30 s
  async function wsUrl() {
    const r = await fetch(base() + '/api/ws-ticket', { method: 'POST', headers: { Authorization: 'Bearer ' + token() } });
    if (r.status === 401) throw new Error(tr('net.login'));
    if (!r.ok) throw new Error(tr('net.offline'));
    const { ticket } = await r.json();
    return base().replace(/^http/i, 'ws') + '/ws?k=' + encodeURIComponent(ticket);
  }
  let pending = null;                                              // trwa pobieranie biletu / łączenie – drugie wywołanie czeka na to samo
  function connect() {
    if (ws && ws.readyState <= 1) return Promise.resolve();
    if (pending) return pending;
    closing = false;
    return (pending = new Promise(async (ok, fail) => {
      if (!token()) return fail(new Error(tr('net.login')));
      let s; try { s = new WebSocket(await wsUrl()); } catch (e) { return fail(e && e.name === 'Error' && e.message ? e : new Error(tr('net.offline'))); }
      ws = s; let opened = false;
      const to = setTimeout(() => { if (!opened) { try { s.close(); } catch {} fail(new Error(tr('net.timeout'))); } }, 8000);
      s.onopen = () => { opened = true; clearTimeout(to); ok(); };
      s.onerror = () => { if (!opened) { clearTimeout(to); fail(new Error(tr('net.offline'))); } };
      s.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } if (m && m.t) emit(m.t, m); };
      s.onclose = () => { if (ws === s) ws = null; if (opened && !closing) emit('close', {}); };
    })).finally(() => { pending = null; });
  }
  const send = o => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };
  return {
    on: (t, f) => { on[t] = f; },
    connect,
    async queue(o) { await connect(); send({ t: 'queue', matchId: o.matchId, skin: o.skin || '' }); },
    cancel() { send({ t: 'cancel' }); },
    send,
    close() { closing = true; if (ws) try { ws.close(); } catch {} ws = null; },
    get open() { return !!ws && ws.readyState === 1; },
  };
}
