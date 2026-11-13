// Portfel gry BEANLADEN połączony z serwerem portfeli (serwer/): konto, własny adres depozytu SOL,
// wpłaty z dowolnego portfela, wypłaty na dowolny adres, historia i zakładka Zarobki (wykres zysku w dolarach).
// Saldo domyślnie w dolarach, pod spodem małym szarym drukiem ilość SOL; strzałki zamieniają kolejność.
import qrcode from 'qrcode-generator';
import { renderEarnings } from './earnings.js';

const TXT = {
  pl: { title: 'Portfel', bal: 'Saldo', dep: 'Wpłać', wd: 'Wypłać', hist: 'Historia', earn: 'Zarobki', swap: 'Zamień dolary i SOL', rate: '1 SOL = {p}',
    depInfo: 'Twój adres portfela w grze. Wysyłaj tylko SOL w sieci Solana{net}. Wpłata pojawi się na saldzie po około 15–30 sekundach.',
    copy: 'Kopiuj adres', copied: 'Adres skopiowany', faucet: 'Pobierz testowe SOL', faucetInfo: 'Sieć testowa: darmowe SOL weźmiesz z faucet.solana.com – adres jest już skopiowany, wklej go tam.',
    check: 'Sprawdź wpłaty', checking: 'Sprawdzanie…', to: 'Adres odbiorcy (Solana)', amount: 'Kwota', max: 'MAX', youGet: 'Odbiorca dostanie ≈ {s}', feeNote: 'Opłatę sieci pokrywa gra.',
    send: 'Wypłać', sending: 'Wysyłanie…', sent: 'Wypłata wysłana', view: 'Zobacz w eksploratorze', errAddr: 'Nieprawidłowy adres Solana', errAmt: 'Podaj kwotę', errFunds: 'Za mało środków',
    empty: 'Brak operacji', pending: 'w toku', failed: 'nieudana', net: 'Wynik', won: 'Wygrane', lost: 'Przegrane', wr: 'Skuteczność', games: 'Mecze', noGames: 'Zagraj mecz o stawkę, a tu zobaczysz swój wynik w czasie.',
    all: 'Wszystko', d7: '7 dni', d30: '30 dni', profit: 'Zysk', loss: 'Strata', live: 'Połączono z siecią Solana', offline: 'Serwer portfeli nie odpowiada',
    tx: { deposit: 'Wpłata', withdraw: 'Wypłata', stake: 'Stawka 1v1', win: 'Wygrana 1v1', loss: 'Przegrana 1v1' }, fee: 'prowizja {a}', match: 'Mecz {n}' },
  en: { title: 'Wallet', bal: 'Balance', dep: 'Deposit', wd: 'Withdraw', hist: 'History', earn: 'Earnings', swap: 'Swap dollars and SOL', rate: '1 SOL = {p}',
    depInfo: 'Your in-game wallet address. Send only SOL on the Solana network{net}. Deposits show up in your balance in about 15–30 seconds.',
    copy: 'Copy address', copied: 'Address copied', faucet: 'Get test SOL', faucetInfo: 'Test network: get free SOL at faucet.solana.com – your address is copied, paste it there.',
    check: 'Check deposits', checking: 'Checking…', to: 'Recipient address (Solana)', amount: 'Amount', max: 'MAX', youGet: 'Recipient gets ≈ {s}', feeNote: 'Network fee is covered by the game.',
    send: 'Withdraw', sending: 'Sending…', sent: 'Withdrawal sent', view: 'View in explorer', errAddr: 'Invalid Solana address', errAmt: 'Enter an amount', errFunds: 'Insufficient funds',
    empty: 'No transactions', pending: 'pending', failed: 'failed', net: 'Net result', won: 'Won', lost: 'Lost', wr: 'Win rate', games: 'Matches', noGames: 'Play a staked match and your results over time will show up here.',
    all: 'All', d7: '7 days', d30: '30 days', profit: 'Profit', loss: 'Loss', live: 'Connected to Solana', offline: 'Wallet server is not responding',
    tx: { deposit: 'Deposit', withdraw: 'Withdrawal', stake: '1v1 stake', win: '1v1 win', loss: '1v1 loss' }, fee: 'fee {a}', match: 'Match {n}' },
  ru: { title: 'Кошелёк', bal: 'Баланс', dep: 'Пополнить', wd: 'Вывести', hist: 'История', earn: 'Доход', swap: 'Поменять доллары и SOL', rate: '1 SOL = {p}',
    depInfo: 'Адрес твоего игрового кошелька. Отправляй только SOL в сети Solana{net}. Пополнение появится на балансе примерно через 15–30 секунд.',
    copy: 'Копировать адрес', copied: 'Адрес скопирован', faucet: 'Получить тестовые SOL', faucetInfo: 'Тестовая сеть: бесплатные SOL на faucet.solana.com – адрес уже скопирован, вставь его там.',
    check: 'Проверить пополнения', checking: 'Проверка…', to: 'Адрес получателя (Solana)', amount: 'Сумма', max: 'МАКС', youGet: 'Получатель получит ≈ {s}', feeNote: 'Комиссию сети платит игра.',
    send: 'Вывести', sending: 'Отправка…', sent: 'Вывод отправлен', view: 'Открыть в обозревателе', errAddr: 'Неверный адрес Solana', errAmt: 'Введите сумму', errFunds: 'Недостаточно средств',
    empty: 'Операций нет', pending: 'в процессе', failed: 'не удалось', net: 'Итог', won: 'Выиграно', lost: 'Проиграно', wr: 'Побед', games: 'Матчи', noGames: 'Сыграй матч на ставку – здесь появится твой результат.',
    all: 'Всё', d7: '7 дней', d30: '30 дней', profit: 'Прибыль', loss: 'Убыток', live: 'Подключено к Solana', offline: 'Сервер кошельков не отвечает',
    tx: { deposit: 'Пополнение', withdraw: 'Вывод', stake: 'Ставка 1v1', win: 'Победа 1v1', loss: 'Поражение 1v1' }, fee: 'комиссия {a}', match: 'Матч {n}' },
  es: { title: 'Cartera', bal: 'Saldo', dep: 'Depositar', wd: 'Retirar', hist: 'Historial', earn: 'Ganancias', swap: 'Cambiar dólares y SOL', rate: '1 SOL = {p}',
    depInfo: 'La dirección de tu cartera en el juego. Envía solo SOL en la red Solana{net}. El depósito aparece en tu saldo en unos 15–30 segundos.',
    copy: 'Copiar dirección', copied: 'Dirección copiada', faucet: 'Obtener SOL de prueba', faucetInfo: 'Red de prueba: SOL gratis en faucet.solana.com – tu dirección ya está copiada, pégala allí.',
    check: 'Comprobar depósitos', checking: 'Comprobando…', to: 'Dirección de destino (Solana)', amount: 'Importe', max: 'MÁX', youGet: 'El destinatario recibe ≈ {s}', feeNote: 'La comisión de red la paga el juego.',
    send: 'Retirar', sending: 'Enviando…', sent: 'Retiro enviado', view: 'Ver en el explorador', errAddr: 'Dirección de Solana no válida', errAmt: 'Introduce un importe', errFunds: 'Fondos insuficientes',
    empty: 'Sin operaciones', pending: 'en curso', failed: 'fallido', net: 'Resultado', won: 'Ganado', lost: 'Perdido', wr: 'Victorias', games: 'Partidas', noGames: 'Juega una partida con apuesta y aquí verás tu resultado en el tiempo.',
    all: 'Todo', d7: '7 días', d30: '30 días', profit: 'Beneficio', loss: 'Pérdida', live: 'Conectado a Solana', offline: 'El servidor de carteras no responde',
    tx: { deposit: 'Depósito', withdraw: 'Retiro', stake: 'Apuesta 1v1', win: 'Victoria 1v1', loss: 'Derrota 1v1' }, fee: 'comisión {a}', match: 'Partida {n}' },
};

const CSS = `
#bl-w{position:fixed;inset:0;z-index:60;display:grid;place-items:center;padding:16px;background:rgba(4,7,14,.62);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);pointer-events:auto;
  font:500 14px/1.45 Inter,system-ui,sans-serif;color:#eef1f7;--bw-acc:#ffc629;--bw-ok:#2fd27a;--bw-bad:#ff6b5e;--bw-mut:#8e9ab0;--bw-line:rgba(255,255,255,.09)}
#bl-w[hidden]{display:none}
#bl-w *{box-sizing:border-box}#bl-w button{font:inherit;color:inherit;cursor:pointer}
#bl-w .bw{position:relative;width:min(480px,100%);max-height:calc(100dvh - 32px);overflow:auto;border-radius:22px;border:1px solid rgba(255,255,255,.12);
  background:linear-gradient(180deg,#121a2c,#0b111e);box-shadow:0 30px 80px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.06);animation:bw-in .22s ease}
@keyframes bw-in{from{opacity:0;transform:translateY(10px) scale(.985)}}
#bl-w .bw-top{display:flex;align-items:center;gap:10px;padding:18px 20px 0}
#bl-w .bw-top h2{margin:0;font:700 17px/1 Inter,sans-serif;letter-spacing:.01em}
#bl-w .bw-net{font:700 10px/1 Inter,sans-serif;letter-spacing:.14em;padding:5px 8px;border-radius:999px;color:#c9b6ff;background:rgba(153,69,255,.16);border:1px solid rgba(153,69,255,.35)}
#bl-w .bw-sp{flex:1}
#bl-w .bw-x{width:34px;height:34px;border-radius:10px;border:1px solid var(--bw-line);background:rgba(255,255,255,.04);display:grid;place-items:center}
#bl-w .bw-x:hover{background:rgba(255,255,255,.09)}
#bl-w .bw-hero{position:relative;margin:16px 20px 0;padding:20px 20px 18px;border-radius:18px;overflow:hidden;
  background:radial-gradient(120% 140% at 0% 0%,rgba(153,69,255,.35),transparent 55%),radial-gradient(120% 140% at 100% 100%,rgba(20,241,149,.22),transparent 55%),#141c30;border:1px solid rgba(255,255,255,.08)}
#bl-w .bw-hero small{display:block;font:600 11px/1 Inter,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(230,236,250,.62)}
#bl-w .bw-amt{display:flex;align-items:flex-end;gap:10px;margin-top:10px}
#bl-w .bw-main{font:800 40px/1 Inter,sans-serif;letter-spacing:-.02em;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#bl-w .bw-sub{display:flex;align-items:center;gap:6px;margin-top:8px;font:600 13px/1 Inter,sans-serif;color:var(--bw-mut);font-variant-numeric:tabular-nums}
#bl-w .bw-swap{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:8px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#cfd8ea;transition:transform .2s,background .15s}
#bl-w .bw-swap:hover{background:rgba(255,255,255,.14);transform:rotate(180deg)}
#bl-w .bw-swap svg{width:14px;height:14px}
#bl-w .bw-rate{position:absolute;top:18px;right:18px;font:600 11px/1 Inter,sans-serif;color:rgba(230,236,250,.6);display:flex;align-items:center;gap:6px}
#bl-w .bw-rate i{width:7px;height:7px;border-radius:50%;background:var(--bw-ok);box-shadow:0 0 8px var(--bw-ok)}
#bl-w .bw-rate.off i{background:var(--bw-bad);box-shadow:none}
#bl-w .bw-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:16px 20px 0;padding:4px;border-radius:13px;background:rgba(255,255,255,.04);border:1px solid var(--bw-line)}
#bl-w .bw-tabs button{height:36px;border:0;border-radius:10px;background:none;font:600 13px/1 Inter,sans-serif;color:var(--bw-mut);display:flex;align-items:center;justify-content:center;gap:6px}
#bl-w .bw-tabs button svg{width:15px;height:15px}
#bl-w .bw-tabs button.on{background:rgba(255,198,41,.14);color:#ffe08a;box-shadow:inset 0 0 0 1px rgba(255,198,41,.4)}
#bl-w .bw-pane{padding:18px 20px 20px}
#bl-w .bw-pane[hidden]{display:none}
#bl-w .bw-qr{display:flex;gap:16px;align-items:center}
#bl-w .bw-qrimg{flex:none;width:132px;height:132px;padding:8px;border-radius:14px;background:#fff;display:grid;place-items:center}
#bl-w .bw-qrimg svg{width:100%;height:100%;display:block}
#bl-w .bw-qr p{margin:0;font-size:13px;color:#c3cbdb}
#bl-w .bw-addr{display:flex;align-items:center;gap:8px;margin-top:14px;padding:10px 10px 10px 14px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid var(--bw-line)}
#bl-w .bw-addr code{flex:1;min-width:0;font:600 13px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all;color:#f2f5fb}
#bl-w .bw-btn{height:42px;padding:0 16px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);font:700 13px/1 Inter,sans-serif;display:inline-flex;align-items:center;justify-content:center;gap:8px}
#bl-w .bw-btn:hover{background:rgba(255,255,255,.11)}
#bl-w .bw-btn.pri{border:0;background:linear-gradient(180deg,#ffd84d,#ffb411);color:#1d1300;box-shadow:0 8px 22px rgba(255,180,17,.25)}
#bl-w .bw-btn.pri:hover{filter:brightness(1.06)}
#bl-w .bw-btn:disabled{opacity:.6;cursor:progress}
#bl-w .bw-btn.sm{height:34px;padding:0 12px;font-size:12px}
#bl-w .bw-row{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
#bl-w .bw-row .bw-btn{flex:1}
#bl-w .bw-note{margin:12px 0 0;font-size:12px;color:var(--bw-mut)}
#bl-w .bw-note a{color:#ffd36a}
#bl-w label.bw-f{display:block;margin-bottom:12px}
#bl-w label.bw-f>span{display:block;margin-bottom:6px;font:600 12px/1 Inter,sans-serif;color:#aeb8cc}
#bl-w .bw-in{display:flex;align-items:center;gap:6px;height:48px;padding:0 6px 0 14px;border-radius:12px;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.12)}
#bl-w .bw-in:focus-within{border-color:rgba(255,198,41,.6);box-shadow:0 0 0 3px rgba(255,198,41,.12)}
#bl-w .bw-in input{flex:1;min-width:0;height:100%;border:0;background:none;outline:none;color:#fff;font:600 15px/1 Inter,sans-serif}
#bl-w .bw-in input.mono{font:600 13px/1 ui-monospace,Menlo,monospace}
#bl-w .bw-unit{height:34px;padding:0 10px;border-radius:9px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);font:700 12px/1 Inter,sans-serif;display:flex;align-items:center;gap:5px}
#bl-w .bw-unit svg{width:12px;height:12px}
#bl-w .bw-calc{display:flex;justify-content:space-between;gap:10px;margin:-4px 0 14px;font-size:12px;color:var(--bw-mut);font-variant-numeric:tabular-nums}
#bl-w .bw-ok{margin-top:12px;padding:12px 14px;border-radius:12px;background:rgba(47,210,122,.1);border:1px solid rgba(47,210,122,.35);font-size:13px}
#bl-w .bw-ok a{color:#8ef0b9}
#bl-w .bw-err{margin-top:12px;padding:10px 14px;border-radius:12px;background:rgba(255,107,94,.1);border:1px solid rgba(255,107,94,.35);color:#ffd2cc;font-size:13px}
#bl-w ul.bw-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
#bl-w .bw-list li{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.05)}
#bl-w .bw-ic{flex:none;width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:rgba(255,255,255,.07)}
#bl-w .bw-ic svg{width:16px;height:16px}
#bl-w .bw-ic.in{background:rgba(47,210,122,.14);color:var(--bw-ok)}#bl-w .bw-ic.out{background:rgba(255,107,94,.13);color:var(--bw-bad)}#bl-w .bw-ic.game{background:rgba(255,198,41,.13);color:var(--bw-acc)}
#bl-w .bw-list .tx{flex:1;min-width:0}
#bl-w .bw-list b{display:block;font:600 13px/1.3 Inter,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#bl-w .bw-list small{display:block;font-size:11px;color:var(--bw-mut)}
#bl-w .bw-list small a{color:#b9a2ff}
#bl-w .bw-list .v{text-align:right;font:700 13px/1.3 Inter,sans-serif;font-variant-numeric:tabular-nums;white-space:nowrap}
#bl-w .bw-list .v small{font-weight:600}
#bl-w .pos{color:var(--bw-ok)}#bl-w .neg{color:var(--bw-bad)}
#bl-w .bw-empty{padding:26px 10px;text-align:center;color:var(--bw-mut);font-size:13px}
@media (max-width:460px){#bl-w .bw-main{font-size:32px}#bl-w .bw-qr{flex-direction:column;align-items:stretch}#bl-w .bw-qrimg{margin:0 auto}#bl-w .bw-tabs button span{display:none}}
@media (prefers-reduced-motion:reduce){#bl-w .bw{animation:none}#bl-w .bw-swap{transition:none}}
`;

const I = {
  x: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v16M3 8l4-4 4 4M17 20V4M21 16l-4 4-4-4"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v14M6 12l6 6 6-6"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V6M6 12l6-6 6 6"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8M14 7h7v7"/></svg>',
  copy: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  game: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/></svg>',
};

export function createWallet({ api, root, getLang, toast, onChange }) {
  const L = () => TXT[getLang()] || TXT.en, T = (k, v) => { let s = L()[k] ?? TXT.en[k] ?? k; if (v) for (const n in v) s = s.replace('{' + n + '}', v[n]); return s; };
  const loc = () => ({ pl: 'pl-PL', en: 'en-US', ru: 'ru-RU', es: 'es-ES' })[getLang()] || 'en-US';
  const fmtUsd = v => (v < 0 ? '−' : '') + '$' + Math.abs(v).toLocaleString(loc(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtSol = (s, d = 4) => s.toLocaleString(loc(), { minimumFractionDigits: 2, maximumFractionDigits: d }) + ' SOL';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let token = null, acct = null, hist = [], earn = null, solFirst = false, online = true, tab = 'dep', pollT = 0;
  try { token = localStorage.getItem('bl-token'); solFirst = localStorage.getItem('bl-solfirst') === '1'; } catch {}

  async function call(method, p, body) {
    const r = await fetch(api + '/api' + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    let j = {}; try { j = await r.json(); } catch {}
    if (!r.ok) { const e = new Error(j.message || 'Błąd serwera'); e.code = j.error; e.status = r.status; if (r.status === 401 && j.error === 'auth') setSession(null); throw e; }
    online = true; return j;
  }
  function setSession(tok) { token = tok; try { tok ? localStorage.setItem('bl-token', tok) : localStorage.removeItem('bl-token'); } catch {} if (!tok) { acct = null; hist = []; earn = null; emit(); } }
  const toLobby = () => acct && { username: acct.username, email: acct.email || '', avatar: acct.avatar || '', createdAt: acct.createdAt, balance: acct.balance, wallet: acct.address, address: acct.address, sol: acct.sol, lamports: acct.lamports,
    price: acct.price, cluster: acct.cluster, admin: acct.admin, stats: acct.stats, history: hist };
  function emit() { onChange(toLobby()); render(); }
  function take(j) { if (j.account) acct = j.account; if (j.history) hist = j.history; emit(); return toLobby(); }

  const api$ = {
    get on() { return true; }, get acct() { return toLobby(); }, get token() { return token; }, api,
    async register(username, password) { const j = await call('POST', '/register', { username, password }); setSession(j.token); return take(j); },
    async google(accessToken) { const j = await call('POST', '/google', { accessToken }); setSession(j.token); take(j); return j; },
    async login(username, password) { const j = await call('POST', '/login', { username, password }); setSession(j.token); return take(j); },
    async restore() { if (!token) return null; try { return take(await call('GET', '/me')); } catch (e) { if (e.status !== 401) online = false; return null; } },
    async logout() { try { await call('POST', '/logout'); } catch {} setSession(null); },
    async refresh(scan) { if (!token) return; try { take(await call(scan ? 'POST' : 'GET', scan ? '/scan' : '/me')); } catch { online = false; render(); } },
    async startMatch(stakeUsd) { const j = await call('POST', '/match/start', { stakeUsd }); take(j); return j.matchId; },
    async endMatch(matchId, won, forfeit, map) { const j = await call('POST', '/match/end', { matchId, won, forfeit, map }); earn = null; take(j); },
    async stats(o) { try { await call('POST', '/stats', o); } catch {} },
    async earnings() { try { earn = (await call('GET', '/earnings')).points; } catch { earn = earn || []; } return earn; },
    async profile(body) { const j = await call('POST', '/profile', body); return take(j); },
    async password(oldPassword, newPassword) { await call('POST', '/password', { oldPassword, newPassword }); },
    open, close,
  };
  // co 12 s świeże saldo (wpłaty wykrywa serwer); przy otwartym portfelu – co 8 s z wymuszeniem skanu
  const loop = () => { clearTimeout(pollT); pollT = setTimeout(async () => { if (token && !document.hidden) await api$.refresh(!wrap.hidden); loop(); }, wrap && !wrap.hidden ? 8000 : 12000); };

  // ---------- okno ----------
  if (!document.getElementById('bl-w-css')) { const st = document.createElement('style'); st.id = 'bl-w-css'; st.textContent = CSS; document.head.appendChild(st); }
  const wrap = document.createElement('div'); wrap.id = 'bl-w'; wrap.hidden = true; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true');
  wrap.innerHTML = `<div class="bw"><div class="bw-top"><h2 data-t="title"></h2><span class="bw-net" id="bw-net"></span><span class="bw-sp"></span><button class="bw-x" type="button" data-x aria-label="Zamknij">${I.x}</button></div>
    <div class="bw-hero"><small data-t="bal"></small><span class="bw-rate" id="bw-rate"><i></i><span></span></span>
      <div class="bw-amt"><span class="bw-main" id="bw-main">—</span></div>
      <div class="bw-sub"><span id="bw-sub"></span><button class="bw-swap" type="button" id="bw-swap">${I.swap}</button></div></div>
    <div class="bw-tabs" role="tablist"><button type="button" data-tab="dep">${I.down}<span data-t="dep"></span></button><button type="button" data-tab="wd">${I.up}<span data-t="wd"></span></button>
      <button type="button" data-tab="hist">${I.list}<span data-t="hist"></span></button><button type="button" data-tab="earn">${I.chart}<span data-t="earn"></span></button></div>
    <div class="bw-pane" data-pane="dep"><div class="bw-qr"><div class="bw-qrimg" id="bw-qr"></div><p id="bw-depinfo"></p></div>
      <div class="bw-addr"><code id="bw-addr"></code><button class="bw-btn sm" type="button" id="bw-copy">${I.copy}<span data-t="copy"></span></button></div>
      <div class="bw-row"><button class="bw-btn" type="button" id="bw-check" data-t="check"></button><button class="bw-btn pri" type="button" id="bw-faucet" data-t="faucet"></button></div>
      <p class="bw-note" id="bw-fnote"></p></div>
    <form class="bw-pane" data-pane="wd" novalidate>
      <label class="bw-f"><span data-t="to"></span><div class="bw-in"><input class="mono" id="bw-to" autocomplete="off" spellcheck="false" autocapitalize="off" placeholder="7xKX…"></div></label>
      <label class="bw-f"><span data-t="amount"></span><div class="bw-in"><input id="bw-amt" inputmode="decimal" autocomplete="off" placeholder="0.00"><button class="bw-unit" type="button" id="bw-unit"></button><button class="bw-btn sm" type="button" id="bw-max" data-t="max"></button></div></label>
      <div class="bw-calc"><span id="bw-get"></span><span data-t="feeNote"></span></div>
      <button class="bw-btn pri" type="submit" id="bw-send" style="width:100%" data-t="send"></button><div id="bw-wdmsg"></div></form>
    <div class="bw-pane" data-pane="hist"><ul class="bw-list" id="bw-hist"></ul></div>
    <div class="bw-pane" data-pane="earn"><div id="bw-earn"></div></div></div>`;
  root.appendChild(wrap);
  const $ = id => wrap.querySelector('#' + id);
  wrap.addEventListener('click', e => { if (e.target === wrap || e.target.closest('[data-x]')) close(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !wrap.hidden) { e.stopImmediatePropagation(); close(); } }, true);
  wrap.querySelector('.bw-tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; render(); if (tab === 'earn') loadEarn(); } });
  $('bw-swap').addEventListener('click', () => { solFirst = !solFirst; try { localStorage.setItem('bl-solfirst', solFirst ? '1' : '0'); } catch {} render(); });
  const copyAddr = async () => { try { await navigator.clipboard.writeText(acct.address); } catch { const r = document.createRange(); r.selectNodeContents($('bw-addr')); getSelection().removeAllRanges(); getSelection().addRange(r); document.execCommand('copy'); } toast(T('copied'), 'ok'); };
  $('bw-copy').addEventListener('click', copyAddr);
  $('bw-check').addEventListener('click', async e => { const b = e.currentTarget; b.disabled = true; b.textContent = T('checking'); await api$.refresh(true); b.disabled = false; b.textContent = T('check'); });
  $('bw-faucet').addEventListener('click', async () => {
    await copyAddr();
    try { const j = await call('POST', '/faucet'); toast('+1 SOL', 'ok'); setTimeout(() => api$.refresh(true), 2000); return j; }
    catch { window.open('https://faucet.solana.com/', '_blank', 'noopener'); }
  });
  // wypłata: kwota w dolarach albo w SOL (przycisk jednostki), MAX = całe saldo
  let wdSol = false;
  const amtLamports = () => { const v = parseFloat(String($('bw-amt').value).replace(',', '.')); if (!(v > 0) || !acct) return 0; return Math.floor(wdSol ? v * 1e9 : v / (acct.price || 1) * 1e9); };
  const calc = () => { const l = amtLamports(); $('bw-get').textContent = l ? T('youGet', { s: wdSol ? fmtUsd(l / 1e9 * (acct.price || 0)) : fmtSol(l / 1e9, 6) }) : ''; };
  $('bw-amt').addEventListener('input', calc);
  $('bw-unit').addEventListener('click', () => { const l = amtLamports(); wdSol = !wdSol; if (l) $('bw-amt').value = wdSol ? +(l / 1e9).toFixed(6) : (l / 1e9 * acct.price).toFixed(2); render(); calc(); });
  $('bw-max').addEventListener('click', () => { if (!acct) return; $('bw-amt').value = wdSol ? +(acct.lamports / 1e9).toFixed(9) : (Math.floor(acct.lamports / 1e9 * acct.price * 100) / 100).toFixed(2); calc(); });
  wrap.querySelector('[data-pane="wd"]').addEventListener('submit', async e => {
    e.preventDefault(); const msg = $('bw-wdmsg'), to = $('bw-to').value.trim(), l = $('bw-amt').value && $('bw-max') ? amtLamports() : 0;
    msg.innerHTML = '';
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(to)) return (msg.innerHTML = `<div class="bw-err">${esc(T('errAddr'))}</div>`);
    if (!l) return (msg.innerHTML = `<div class="bw-err">${esc(T('errAmt'))}</div>`);
    if (l > acct.lamports) return (msg.innerHTML = `<div class="bw-err">${esc(T('errFunds'))}</div>`);
    const b = $('bw-send'); b.disabled = true; b.textContent = T('sending');
    try { const j = await call('POST', '/withdraw', { to, lamports: l }); take(j); $('bw-amt').value = ''; calc();
      msg.innerHTML = `<div class="bw-ok">✓ ${esc(T('sent'))} · <a href="${esc(j.url)}" target="_blank" rel="noopener">${esc(T('view'))} ↗</a></div>`; }
    catch (er) { msg.innerHTML = `<div class="bw-err">${esc(er.message)}</div>`; }
    b.disabled = false; b.textContent = T('send');
  });

  function open(t = 'dep') { tab = t === 'deposit' ? 'dep' : t === 'withdraw' ? 'wd' : t === 'history' ? 'hist' : t; wrap.hidden = false; render(); api$.refresh(true); if (tab === 'earn') loadEarn(); loop(); }
  function close() { wrap.hidden = true; loop(); }
  async function loadEarn() { try { earn = (await call('GET', '/earnings')).points; } catch { earn = earn || []; } renderEarn(); }

  // ---------- rysowanie ----------
  function render() {
    wrap.querySelectorAll('[data-t]').forEach(el => { el.textContent = T(el.dataset.t); });
    if (wrap.hidden || !acct) return;
    const usd = acct.balance, sol = acct.sol;
    $('bw-main').textContent = solFirst ? fmtSol(sol) : fmtUsd(usd);
    $('bw-sub').textContent = solFirst ? '≈ ' + fmtUsd(usd) : '≈ ' + fmtSol(sol);
    $('bw-swap').title = $('bw-swap').ariaLabel = T('swap');
    const rate = $('bw-rate'); rate.classList.toggle('off', !online); rate.querySelector('span').textContent = online ? (acct.price ? T('rate', { p: fmtUsd(acct.price) }) : '') : T('offline');
    const testnet = acct.cluster && acct.cluster !== 'mainnet-beta';
    $('bw-net').textContent = testnet ? acct.cluster.toUpperCase() : 'SOLANA'; $('bw-net').hidden = false;
    wrap.querySelectorAll('[data-tab]').forEach(b => { b.classList.toggle('on', b.dataset.tab === tab); b.setAttribute('aria-selected', b.dataset.tab === tab); });
    wrap.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== tab; });
    // wpłata
    if ($('bw-addr').textContent !== acct.address) {
      $('bw-addr').textContent = acct.address;
      try { const qr = qrcode(0, 'M'); qr.addData('solana:' + acct.address); qr.make(); $('bw-qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); } catch { $('bw-qr').textContent = ''; }
    }
    $('bw-depinfo').textContent = T('depInfo', { net: testnet ? ' (' + acct.cluster + ')' : '' });
    $('bw-faucet').hidden = !testnet; $('bw-fnote').innerHTML = testnet ? esc(T('faucetInfo')).replace('faucet.solana.com', '<a href="https://faucet.solana.com/" target="_blank" rel="noopener">faucet.solana.com</a>') : '';
    // wypłata
    $('bw-unit').innerHTML = (wdSol ? 'SOL' : 'USD') + I.swap;
    $('bw-amt').placeholder = wdSol ? '0.0000' : '0.00';
    // historia
    const list = $('bw-hist');
    list.innerHTML = hist.length ? hist.map(h => {
      const kind = h.type === 'deposit' ? 'in' : h.type === 'withdraw' ? 'out' : 'game', ic = h.type === 'deposit' ? I.down : h.type === 'withdraw' ? I.up : I.game;
      const sub = [new Date(h.t).toLocaleString(loc(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })];
      if (h.status === 'pending') sub.push(T('pending')); if (h.status === 'failed') sub.push(T('failed'));
      if (h.sig) sub.push(`<a href="https://explorer.solana.com/tx/${esc(h.sig)}${testnet ? '?cluster=' + esc(acct.cluster) : ''}" target="_blank" rel="noopener">${esc(h.sig.slice(0, 6))}… ↗</a>`);
      const note = h.fee ? T('fee', { a: fmtUsd(h.fee) }) : h.note;
      const v = h.amount ? `<span class="${h.amount > 0 ? 'pos' : 'neg'}">${h.amount > 0 ? '+' : ''}${fmtUsd(h.amount)}</span><small>${h.lamports ? (h.lamports > 0 ? '+' : '−') + fmtSol(Math.abs(h.lamports) / 1e9) : ''}</small>` : '<span>—</span>';
      return `<li><span class="bw-ic ${kind}">${ic}</span><div class="tx"><b>${esc((L().tx || TXT.en.tx)[h.type] || h.type)}${note ? ' · ' + esc(note) : ''}</b><small>${sub.join(' · ')}</small></div><div class="v">${v}</div></li>`;
    }).join('') : `<li class="bw-empty">${esc(T('empty'))}</li>`;
    if (tab === 'earn') renderEarn();
  }

  const earnState = {};
  function renderEarn() { renderEarnings($('bw-earn'), earn, getLang(), earnState); }

  loop();
  return api$;
}
