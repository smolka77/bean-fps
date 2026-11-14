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
  function wsUrl() {
    const base = walletApi() || location.origin;
    return base.replace(/^http/i, 'ws').replace(/\/+$/, '') + '/ws?t=' + encodeURIComponent(token());
  }
  function connect() {
    if (ws && ws.readyState <= 1) return Promise.resolve();
    closing = false;
    return new Promise((ok, fail) => {
      if (!token()) return fail(new Error(tr('net.login')));
      let s; try { s = new WebSocket(wsUrl()); } catch (e) { return fail(e); }
      ws = s; let opened = false;
      const to = setTimeout(() => { if (!opened) { try { s.close(); } catch {} fail(new Error(tr('net.timeout'))); } }, 8000);
      s.onopen = () => { opened = true; clearTimeout(to); ok(); };
      s.onerror = () => { if (!opened) { clearTimeout(to); fail(new Error(tr('net.offline'))); } };
      s.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } if (m && m.t) emit(m.t, m); };
      s.onclose = () => { if (ws === s) ws = null; if (opened && !closing) emit('close', {}); };
    });
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
