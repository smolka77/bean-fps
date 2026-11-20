// Portfel gry BEANLADEN połączony z serwerem portfeli (serwer/): konto, własny adres depozytu SOL,
// wpłaty z dowolnego portfela, wypłaty na dowolny adres, historia i zakładka Zarobki (wykres zysku w dolarach).
// Saldo domyślnie w dolarach, pod spodem małym szarym drukiem ilość SOL; strzałki zamieniają kolejność.
import qrcode from 'qrcode-generator';
import { renderEarnings, pointsFromHistory } from './earnings.js';

const TXT = {
  pl: { close: 'Zamknij', demoAddr: 'Tryb testowy – adres portfela Solana pojawi się, gdy gra będzie połączona z serwerem. Nie wysyłaj tu prawdziwych SOL.', demoFaucet: 'Dodaj testowe $50', demoNet: 'TEST', title: 'Portfel', bal: 'Saldo', dep: 'Wpłać', wd: 'Wypłać', hist: 'Historia', earn: 'Zarobki', swap: 'Zamień dolary i SOL', rate: '1 SOL = {p}',
    depInfo: 'Twój adres portfela w grze. Wysyłaj tylko SOL w sieci Solana{net}. Wpłata pojawi się na saldzie po około 15–30 sekundach.',
    copy: 'Kopiuj adres', copied: 'Adres skopiowany', copyManual: 'Zaznaczono adres – naciśnij Ctrl+C', faucet: 'Pobierz testowe SOL', faucetInfo: 'Sieć testowa: darmowe SOL weźmiesz z faucet.solana.com – adres jest już skopiowany, wklej go tam.',
    check: 'Sprawdź wpłaty', checking: 'Sprawdzanie…', to: 'Adres odbiorcy (Solana)', amount: 'Kwota', max: 'MAX', youGet: 'Odbiorca dostanie ≈ {s}', feeNote: 'Opłatę sieci pokrywa gra.',
    send: 'Wypłać', sending: 'Wysyłanie…', sent: 'Wypłata wysłana', view: 'Zobacz w eksploratorze', errAddr: 'Nieprawidłowy adres Solana', errAmt: 'Podaj kwotę', errFunds: 'Za mało środków',
    empty: 'Brak operacji', pending: 'w toku', failed: 'nieudana', review: 'czeka na akceptację', rejected: 'odrzucona – środki wróciły', sentReview: 'Wypłata czeka na akceptację (duże kwoty sprawdzamy ręcznie)', net: 'Wynik', won: 'Wygrane', lost: 'Przegrane', wr: 'Skuteczność', games: 'Mecze', noGames: 'Zagraj mecz o stawkę, a tu zobaczysz swój wynik w czasie.',
    all: 'Wszystko', d7: '7 dni', d30: '30 dni', profit: 'Zysk', loss: 'Strata', live: 'Połączono z siecią Solana', offline: 'Serwer portfeli nie odpowiada',
    tx: { deposit: 'Wpłata', withdraw: 'Wypłata', stake: 'Stawka 1v1', win: 'Wygrana 1v1', loss: 'Przegrana 1v1' }, fee: 'prowizja {a}', match: 'Mecz {n}' },
  en: { close: 'Close', demoAddr: 'Test mode – your Solana wallet address appears once the game is connected to its server. Do not send real SOL here.', demoFaucet: 'Add test $50', demoNet: 'TEST', title: 'Wallet', bal: 'Balance', dep: 'Deposit', wd: 'Withdraw', hist: 'History', earn: 'Earnings', swap: 'Swap dollars and SOL', rate: '1 SOL = {p}',
    depInfo: 'Your in-game wallet address. Send only SOL on the Solana network{net}. Deposits show up in your balance in about 15–30 seconds.',
    copy: 'Copy address', copied: 'Address copied', copyManual: 'Address selected – press Ctrl+C', faucet: 'Get test SOL', faucetInfo: 'Test network: get free SOL at faucet.solana.com – your address is copied, paste it there.',
    check: 'Check deposits', checking: 'Checking…', to: 'Recipient address (Solana)', amount: 'Amount', max: 'MAX', youGet: 'Recipient gets ≈ {s}', feeNote: 'Network fee is covered by the game.',
    send: 'Withdraw', sending: 'Sending…', sent: 'Withdrawal sent', view: 'View in explorer', errAddr: 'Invalid Solana address', errAmt: 'Enter an amount', errFunds: 'Insufficient funds',
    empty: 'No transactions', pending: 'pending', failed: 'failed', review: 'awaiting approval', rejected: 'rejected – funds returned', sentReview: 'Withdrawal awaiting approval (large amounts are checked manually)', net: 'Net result', won: 'Won', lost: 'Lost', wr: 'Win rate', games: 'Matches', noGames: 'Play a staked match and your results over time will show up here.',
    all: 'All', d7: '7 days', d30: '30 days', profit: 'Profit', loss: 'Loss', live: 'Connected to Solana', offline: 'Wallet server is not responding',
    tx: { deposit: 'Deposit', withdraw: 'Withdrawal', stake: '1v1 stake', win: '1v1 win', loss: '1v1 loss' }, fee: 'fee {a}', match: 'Match {n}' },
  ru: { close: 'Закрыть', demoAddr: 'Тестовый режим – адрес кошелька Solana появится, когда игра подключится к серверу. Не отправляй сюда настоящие SOL.', demoFaucet: 'Добавить тестовые $50', demoNet: 'TEST', title: 'Кошелёк', bal: 'Баланс', dep: 'Пополнить', wd: 'Вывести', hist: 'История', earn: 'Доход', swap: 'Поменять доллары и SOL', rate: '1 SOL = {p}',
    depInfo: 'Адрес твоего игрового кошелька. Отправляй только SOL в сети Solana{net}. Пополнение появится на балансе примерно через 15–30 секунд.',
    copy: 'Копировать адрес', copied: 'Адрес скопирован', copyManual: 'Адрес выделен – нажмите Ctrl+C', faucet: 'Получить тестовые SOL', faucetInfo: 'Тестовая сеть: бесплатные SOL на faucet.solana.com – адрес уже скопирован, вставь его там.',
    check: 'Проверить пополнения', checking: 'Проверка…', to: 'Адрес получателя (Solana)', amount: 'Сумма', max: 'МАКС', youGet: 'Получатель получит ≈ {s}', feeNote: 'Комиссию сети платит игра.',
    send: 'Вывести', sending: 'Отправка…', sent: 'Вывод отправлен', view: 'Открыть в обозревателе', errAddr: 'Неверный адрес Solana', errAmt: 'Введите сумму', errFunds: 'Недостаточно средств',
    empty: 'Операций нет', pending: 'в процессе', failed: 'не удалось', review: 'ждёт подтверждения', rejected: 'отклонён – средства возвращены', sentReview: 'Вывод ждёт подтверждения (крупные суммы проверяем вручную)', net: 'Итог', won: 'Выиграно', lost: 'Проиграно', wr: 'Побед', games: 'Матчи', noGames: 'Сыграй матч на ставку – здесь появится твой результат.',
    all: 'Всё', d7: '7 дней', d30: '30 дней', profit: 'Прибыль', loss: 'Убыток', live: 'Подключено к Solana', offline: 'Сервер кошельков не отвечает',
    tx: { deposit: 'Пополнение', withdraw: 'Вывод', stake: 'Ставка 1v1', win: 'Победа 1v1', loss: 'Поражение 1v1' }, fee: 'комиссия {a}', match: 'Матч {n}' },
  es: { close: 'Cerrar', demoAddr: 'Modo de prueba – la dirección de tu cartera Solana aparece cuando el juego se conecta al servidor. No envíes SOL reales aquí.', demoFaucet: 'Añadir $50 de prueba', demoNet: 'TEST', title: 'Cartera', bal: 'Saldo', dep: 'Depositar', wd: 'Retirar', hist: 'Historial', earn: 'Ganancias', swap: 'Cambiar dólares y SOL', rate: '1 SOL = {p}',
    depInfo: 'La dirección de tu cartera en el juego. Envía solo SOL en la red Solana{net}. El depósito aparece en tu saldo en unos 15–30 segundos.',
    copy: 'Copiar dirección', copied: 'Dirección copiada', copyManual: 'Dirección seleccionada – pulsa Ctrl+C', faucet: 'Obtener SOL de prueba', faucetInfo: 'Red de prueba: SOL gratis en faucet.solana.com – tu dirección ya está copiada, pégala allí.',
    check: 'Comprobar depósitos', checking: 'Comprobando…', to: 'Dirección de destino (Solana)', amount: 'Importe', max: 'MÁX', youGet: 'El destinatario recibe ≈ {s}', feeNote: 'La comisión de red la paga el juego.',
    send: 'Retirar', sending: 'Enviando…', sent: 'Retiro enviado', view: 'Ver en el explorador', errAddr: 'Dirección de Solana no válida', errAmt: 'Introduce un importe', errFunds: 'Fondos insuficientes',
    empty: 'Sin operaciones', pending: 'en curso', failed: 'fallido', review: 'pendiente de aprobación', rejected: 'rechazado – fondos devueltos', sentReview: 'Retiro pendiente de aprobación (los importes grandes se revisan a mano)', net: 'Resultado', won: 'Ganado', lost: 'Perdido', wr: 'Victorias', games: 'Partidas', noGames: 'Juega una partida con apuesta y aquí verás tu resultado en el tiempo.',
    all: 'Todo', d7: '7 días', d30: '30 días', profit: 'Beneficio', loss: 'Pérdida', live: 'Conectado a Solana', offline: 'El servidor de carteras no responde',
    tx: { deposit: 'Depósito', withdraw: 'Retiro', stake: 'Apuesta 1v1', win: 'Victoria 1v1', loss: 'Derrota 1v1' }, fee: 'comisión {a}', match: 'Partida {n}' },
};

const CSS = `
/* portfel w stylu gry: ciemne szkło jak okno logowania, nagłówki Anton (jak logo i LOG IN), liczby 'Barlow Condensed',
   karta salda w kolorach zachodu słońca z lobby, złote akcenty jak stawki */
#bl-w{position:fixed;inset:0;z-index:60;display:grid;place-items:center;padding:16px;background:rgba(6,4,10,.66);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);pointer-events:auto;
  font:500 14px/1.45 Barlow,Barlow,system-ui,sans-serif;color:#f4eff6;--bw-acc:#ff2e93;--bw-ok:#34d27f;--bw-bad:#ff6b5e;--bw-mut:#a39aae;--bw-line:rgba(255,255,255,.08);--bw-line2:rgba(255,255,255,.15)}
#bl-w[hidden]{display:none}
#bl-w [hidden]{display:none!important}
#bl-w *{box-sizing:border-box}#bl-w button{font:inherit;color:inherit;cursor:pointer}
#bl-w .bw{position:relative;width:min(500px,100%);max-height:calc(100dvh - 32px);overflow:auto;border-radius:0;border:1px solid rgba(255,255,255,.12);
  background:linear-gradient(180deg,#140a1c,#0b0610);box-shadow:0 40px 100px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.06);animation:bw-in .25s cubic-bezier(.2,.9,.3,1.2)}
@keyframes bw-in{from{opacity:0;transform:translateY(14px) scale(.97)}}
#bl-w .bw-top{display:flex;align-items:center;gap:12px;padding:20px 22px 0}
#bl-w .bw-top h2{margin:0;font:400 30px/1 Anton,Oswald,Impact,sans-serif;letter-spacing:.05em;text-transform:uppercase;transform:skewX(-6deg);color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.35)}
#bl-w .bw-net{font:700 10px/1 Barlow,sans-serif;letter-spacing:.16em;padding:5px 9px;border-radius:0;color:#ff7ec0;background:rgba(255,46,147,.1);border:1px solid rgba(255,46,147,.4)}
#bl-w .bw-sp{flex:1}
#bl-w .bw-x{width:36px;height:36px;border-radius:0;border:1px solid var(--bw-line2);background:rgba(255,255,255,.04);display:grid;place-items:center;color:var(--bw-mut);transition:background .15s,color .15s}
#bl-w .bw-x:hover{background:rgba(255,255,255,.1);color:#fff}
/* karta salda: niebo z lobby (pomarańcz – magenta – fiolet) z ukośnymi pasami jak panel logowania */
#bl-w .bw-hero{position:relative;margin:16px 22px 0;padding:20px 22px 18px;border-radius:0;overflow:hidden;isolation:isolate;
  background:linear-gradient(135deg,#ff9d3c 0%,#e2552b 30%,#a8275a 62%,#3a1648 100%);border:1px solid rgba(255,214,150,.35);
  box-shadow:0 18px 40px rgba(120,20,60,.35),inset 0 1px 0 rgba(255,240,210,.35)}
#bl-w .bw-hero::before{content:"";position:absolute;inset:0;z-index:-1;background:repeating-linear-gradient(115deg,rgba(255,255,255,.07) 0 2px,transparent 2px 14px)}
#bl-w .bw-hero::after{content:"";position:absolute;right:-60px;top:-80px;z-index:-1;width:240px;height:240px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,190,225,.55),transparent)}
#bl-w .bw-hero small{display:block;font:700 11px/1 Barlow,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,236,220,.85)}
#bl-w .bw-amt{display:flex;align-items:flex-end;gap:10px;margin-top:12px}
#bl-w .bw-main{font:400 52px/1 Anton,Oswald,Impact,sans-serif;letter-spacing:.02em;transform:skewX(-6deg);transform-origin:left bottom;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  color:#fff;text-shadow:0 3px 0 rgba(70,10,40,.45),0 10px 30px rgba(60,0,30,.35)}
#bl-w .bw-sub{display:flex;align-items:center;gap:8px;margin-top:10px;font:700 15px/1 'Barlow Condensed',Oswald,sans-serif;letter-spacing:.04em;color:rgba(255,236,220,.8);font-variant-numeric:tabular-nums}
#bl-w .bw-swap{display:inline-grid;place-items:center;width:28px;height:28px;border-radius:0;border:1px solid rgba(255,255,255,.3);background:rgba(30,6,24,.35);color:#fff;transition:transform .25s,background .15s}
#bl-w .bw-swap:hover{background:rgba(30,6,24,.6);transform:rotate(180deg)}
#bl-w .bw-swap svg{width:14px;height:14px}
#bl-w .bw-rate{position:absolute;top:16px;right:16px;font:700 12px/1 'Barlow Condensed',Oswald,sans-serif;letter-spacing:.05em;color:#fff;display:flex;align-items:center;gap:7px;
  padding:6px 10px;border-radius:0;background:rgba(20,4,18,.4);border:1px solid rgba(255,255,255,.18)}
#bl-w .bw-rate i{width:7px;height:7px;border-radius:50%;background:var(--bw-ok);box-shadow:0 0 8px var(--bw-ok)}
#bl-w .bw-rate.off i{background:var(--bw-bad);box-shadow:none}
/* zakładki: jak przełącznik w oknie logowania i kafelki stawek */
#bl-w .bw-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:16px 22px 0;padding:4px;border-radius:0;background:rgba(255,255,255,.04);border:1px solid var(--bw-line)}
#bl-w .bw-tabs button{height:40px;border:0;border-radius:0;background:none;font:700 13px/1 'Barlow Condensed',Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--bw-mut);
  display:flex;align-items:center;justify-content:center;gap:7px;transition:background .15s,color .15s}
#bl-w .bw-tabs button:hover{color:#fff}
#bl-w .bw-tabs button svg{width:15px;height:15px}
#bl-w .bw-tabs button.on{color:#ff9fd0;background:linear-gradient(180deg,rgba(255,46,147,.24),rgba(255,46,147,.07));box-shadow:inset 0 0 0 1px rgba(255,46,147,.85),0 6px 18px rgba(255,46,147,.18)}
#bl-w .bw-pane{padding:18px 22px 22px}
#bl-w .bw-pane[hidden]{display:none}
/* wpłata */
#bl-w .bw-qr{display:flex;gap:16px;align-items:center;padding:14px;border-radius:0;background:rgba(0,0,0,.24);border:1px solid var(--bw-line)}
#bl-w .bw-qrimg{flex:none;width:128px;height:128px;padding:9px;border-radius:0;background:#fff;display:grid;place-items:center;box-shadow:0 0 0 3px rgba(255,46,147,.55),0 10px 24px rgba(0,0,0,.4)}
#bl-w .bw-qrimg svg{width:100%;height:100%;display:block}
#bl-w .bw-qr p{margin:0;font:500 13px/1.5 Barlow,sans-serif;color:#d0c8d6}
#bl-w .bw-addr{display:flex;align-items:center;gap:10px;margin-top:12px;padding:10px 10px 10px 14px;border-radius:0;background:rgba(0,0,0,.28);border:1px dashed rgba(255,46,147,.35)}
#bl-w .bw-addr code{flex:1;min-width:0;-webkit-user-select:all;user-select:all;cursor:copy;font:600 13px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all;color:#f6f1f7}
/* przyciski: złoty jak LOG IN / PLAY, drugi – szkło */
#bl-w .bw-btn{height:46px;padding:0 18px;border-radius:0;border:1px solid var(--bw-line2);background:rgba(255,255,255,.05);font:700 14px/1 'Barlow Condensed',Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;
  display:inline-flex;align-items:center;justify-content:center;gap:8px;transition:background .15s,transform .15s,filter .15s}
#bl-w .bw-btn:hover{background:rgba(255,255,255,.1);transform:translateY(-1px)}
#bl-w .bw-btn.pri{border:0;color:#fff;background:linear-gradient(100deg,#ff2e93 0%,#ff5470 48%,#ff9a3c 100%);box-shadow:0 1px 0 rgba(255,255,255,.6) inset,0 10px 26px rgba(255,46,147,.3)}
#bl-w .bw-btn.pri:hover{filter:brightness(1.06)}
#bl-w .bw-btn:disabled{opacity:.6;cursor:progress;transform:none}
#bl-w .bw-btn.sm{height:36px;padding:0 12px;font-size:12px}
#bl-w .bw-row{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
#bl-w .bw-row .bw-btn{flex:1}
#bl-w .bw-note{margin:12px 2px 0;font-size:12px;line-height:1.45;color:var(--bw-mut)}
#bl-w .bw-note a{color:#ff7ec0}
/* wypłata */
#bl-w label.bw-f{display:block;margin-bottom:13px}
#bl-w label.bw-f>span{display:block;margin-bottom:6px;font:600 12px/1 Barlow,sans-serif;color:#c4bccc}
#bl-w .bw-in{display:flex;align-items:center;gap:6px;height:50px;padding:0 6px 0 14px;border-radius:0;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.12);transition:border-color .15s,box-shadow .15s}
#bl-w .bw-in:focus-within{border-color:rgba(255,46,147,.65);box-shadow:0 0 0 3px rgba(255,46,147,.13)}
#bl-w .bw-in input{flex:1;min-width:0;height:100%;border:0;background:none;outline:none;color:#fff;font:700 18px/1 'Barlow Condensed',Oswald,sans-serif;letter-spacing:.03em}
#bl-w .bw-in input::placeholder{color:#7a7084}
#bl-w .bw-in input.mono{font:600 13px/1 ui-monospace,Menlo,monospace;letter-spacing:0}
#bl-w .bw-unit{height:36px;padding:0 10px;border-radius:0;border:1px solid var(--bw-line2);background:rgba(255,255,255,.06);font:700 12px/1 'Barlow Condensed',Oswald,sans-serif;letter-spacing:.08em;display:flex;align-items:center;gap:5px}
#bl-w .bw-unit svg{width:12px;height:12px}
#bl-w .bw-calc{display:flex;justify-content:space-between;gap:10px;margin:-4px 2px 14px;font-size:12px;color:var(--bw-mut);font-variant-numeric:tabular-nums}
#bl-w .bw-ok{margin-top:12px;padding:12px 14px;border-radius:0;background:rgba(52,210,127,.1);border:1px solid rgba(52,210,127,.35);font-size:13px}
#bl-w .bw-ok a{color:#8ef0b9}
#bl-w .bw-err{margin-top:12px;padding:10px 14px;border-radius:0;background:rgba(255,107,94,.1);border:1px solid rgba(255,107,94,.35);color:#ffd2cc;font-size:13px}
/* historia: karty jak kupon stawki */
#bl-w ul.bw-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px}
#bl-w .bw-list li{display:flex;align-items:center;gap:12px;padding:11px 13px;border-radius:0;background:rgba(0,0,0,.24);border:1px solid var(--bw-line)}
#bl-w .bw-ic{flex:none;width:36px;height:36px;border-radius:0;display:grid;place-items:center;background:rgba(255,255,255,.07)}
#bl-w .bw-ic svg{width:16px;height:16px}
#bl-w .bw-ic.in{background:rgba(52,210,127,.14);color:var(--bw-ok)}#bl-w .bw-ic.out{background:rgba(255,107,94,.13);color:var(--bw-bad)}#bl-w .bw-ic.game{background:rgba(255,46,147,.14);color:var(--bw-acc)}
#bl-w .bw-list .tx{flex:1;min-width:0}
#bl-w .bw-list b{display:block;font:600 13.5px/1.3 Barlow,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#bl-w .bw-list small{display:block;font-size:11px;color:var(--bw-mut)}
#bl-w .bw-list small a{color:#ff7ec0}
#bl-w .bw-list .v{text-align:right;font:700 17px/1.15 'Barlow Condensed',Oswald,sans-serif;letter-spacing:.02em;font-variant-numeric:tabular-nums;white-space:nowrap}
#bl-w .bw-list .v small{font:600 11px/1.3 Barlow,sans-serif;letter-spacing:0}
#bl-w .pos{color:var(--bw-ok)}#bl-w .neg{color:var(--bw-bad)}
#bl-w .bw-empty{padding:28px 10px;text-align:center;color:var(--bw-mut);font-size:13px;border-radius:0;background:rgba(0,0,0,.18);border:1px dashed var(--bw-line2)}
/* zarobki (wspólny wykres) w tym samym stylu */
#bl-w .be-kpi{background:rgba(0,0,0,.24);border-color:var(--bw-line)}
#bl-w .be-kpi b{font:700 21px/1 'Barlow Condensed',Oswald,sans-serif;letter-spacing:.02em}
#bl-w .be-kpi.big b{font:400 26px/1 Anton,Oswald,Impact,sans-serif;letter-spacing:.03em}
#bl-w .be-rng button.on{color:#ff9fd0;background:rgba(255,46,147,.14);border-color:rgba(255,46,147,.6)}
#bl-w .be-chart{background:rgba(0,0,0,.24);border-color:var(--bw-line)}
@media (max-width:460px){#bl-w .bw-main{font-size:40px}#bl-w .bw-top h2{font-size:26px}#bl-w .bw-qr{flex-direction:column;align-items:stretch}#bl-w .bw-qrimg{margin:0 auto}#bl-w .bw-tabs button span{display:none}
  #bl-w .bw-hero,#bl-w .bw-tabs{margin-left:16px;margin-right:16px}#bl-w .bw-pane{padding:16px}}
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

// local: tryb bez serwera (artefakt, GitHub Pages) – ten sam wygląd portfela, saldo i historia z konta lokalnego (testowe)
// Serwer zwraca komunikaty błędów po polsku – tu ich tłumaczenia (EN, RU, ES); nieznany komunikat zostaje bez zmian.
const SRV = {
  'Zaloguj się': ['Log in', 'Войди в аккаунт', 'Inicia sesión'],
  'Nazwa: 3–16 znaków (litery, cyfry, _)': ['Name: 3–16 characters (letters, digits, _)', 'Имя: 3–16 символов (буквы, цифры, _)', 'Nombre: 3–16 caracteres (letras, números, _)'],
  'Hasło: co najmniej 10 znaków': ['Password: at least 10 characters', 'Пароль: минимум 10 символов', 'Contraseña: al menos 10 caracteres'],
  'Nowe hasło: co najmniej 10 znaków': ['New password: at least 10 characters', 'Новый пароль: минимум 10 символов', 'Nueva contraseña: al menos 10 caracteres'],
  'Ta nazwa jest zastrzeżona': ['This name is reserved', 'Это имя зарезервировано', 'Ese nombre está reservado'],
  'Wypłaty są wstrzymane przez 24 h po zmianie hasła lub e-maila': ['Withdrawals are paused for 24 h after a password or e-mail change', 'Выводы приостановлены на 24 ч после смены пароля или e-mail', 'Los retiros se pausan 24 h tras cambiar la contraseña o el e-mail'],
  'Ta nazwa jest zajęta': ['This name is taken', 'Это имя занято', 'Ese nombre ya está en uso'],
  'Za dużo prób – odczekaj minutę': ['Too many attempts – wait a minute', 'Слишком много попыток – подожди минуту', 'Demasiados intentos – espera un minuto'],
  'Za dużo prób': ['Too many attempts', 'Слишком много попыток', 'Demasiados intentos'],
  'Zła nazwa lub hasło': ['Wrong name or password', 'Неверное имя или пароль', 'Nombre o contraseña incorrectos'],
  'Faucet w RPC jest zamknięty – pobierz testowe SOL na faucet.solana.com (adres jest skopiowany).': ['The RPC faucet is closed – get test SOL at faucet.solana.com (the address is copied).', 'Кран RPC закрыт – получи тестовые SOL на faucet.solana.com (адрес скопирован).', 'El faucet del RPC está cerrado – consigue SOL de prueba en faucet.solana.com (la dirección está copiada).'],
  'Nieprawidłowy adres Solana': ['Invalid Solana address', 'Неверный адрес Solana', 'Dirección de Solana no válida'],
  'To adres Twojego portfela w grze': ['This is your in-game wallet address', 'Это адрес твоего игрового кошелька', 'Esta es la dirección de tu cartera del juego'],
  'Za mało środków': ['Insufficient funds', 'Недостаточно средств', 'Fondos insuficientes'],
  'Za mało środków na stawkę': ['Not enough funds for this stake', 'Недостаточно средств для ставки', 'Fondos insuficientes para la apuesta'],
  'Wypłata nie przeszła – środki wróciły na saldo. Spróbuj za chwilę.': ['The withdrawal failed – the funds are back in your balance. Try again shortly.', 'Вывод не прошёл – средства вернулись на баланс. Попробуй чуть позже.', 'El retiro falló – los fondos han vuelto a tu saldo. Inténtalo en un momento.'],
  'Brak kursu SOL – spróbuj za chwilę': ['No SOL price – try again shortly', 'Нет курса SOL – попробуй чуть позже', 'No hay cotización de SOL – inténtalo en un momento'],
  'Brak dostępu do panelu admina': ['No access to the admin panel', 'Нет доступа к админ-панели', 'Sin acceso al panel de admin'],
  'Nieprawidłowy obrazek (PNG/JPG do ~60 KB)': ['Invalid image (PNG/JPG up to ~60 KB)', 'Неверное изображение (PNG/JPG до ~60 КБ)', 'Imagen no válida (PNG/JPG hasta ~60 KB)'],
  'Nieprawidłowy adres e-mail': ['Invalid e-mail address', 'Неверный адрес e-mail', 'Dirección de e-mail no válida'],
  'Konto Google bez potwierdzonego e-maila': ['Google account without a verified e-mail', 'Аккаунт Google без подтверждённого e-mail', 'Cuenta de Google sin e-mail verificado'],
  'Token Google nie jest dla tej gry': ['The Google token is not for this game', 'Токен Google не для этой игры', 'El token de Google no es para este juego'],
  'Google nie potwierdził logowania – spróbuj ponownie': ['Google did not confirm the sign-in – try again', 'Google не подтвердил вход – попробуй ещё раз', 'Google no confirmó el inicio de sesión – inténtalo de nuevo'],
  'Logowanie przez Google nie jest skonfigurowane': ['Google sign-in is not configured', 'Вход через Google не настроен', 'El inicio de sesión con Google no está configurado'],
  'Nie ma takiego meczu': ['No such match', 'Такого матча нет', 'No existe esa partida'],
  'Tylko w sieci testowej': ['Test network only', 'Только в тестовой сети', 'Solo en la red de prueba'],
  'Obecne hasło jest nieprawidłowe': ['The current password is wrong', 'Текущий пароль неверный', 'La contraseña actual es incorrecta'],
  'Szukasz meczu w innej karcie.': ['You are already searching for a match in another tab.', 'Ты уже ищешь матч в другой вкладке.', 'Ya estás buscando partida en otra pestaña.'],
  'Brak opłaconej stawki – zagraj jeszcze raz z lobby.': ['No paid stake – play again from the lobby.', 'Нет оплаченной ставки – сыграй ещё раз из лобби.', 'No hay apuesta pagada – juega de nuevo desde el lobby.'],
  'Jest nowa wersja gry – odśwież stronę (Ctrl+F5) i zagraj jeszcze raz.': ['A new version of the game is out – refresh the page (Ctrl+F5) and play again.', 'Вышла новая версия игры – обнови страницу (Ctrl+F5) и сыграй ещё раз.', 'Hay una nueva versión del juego: recarga la página (Ctrl+F5) y vuelve a jugar.'],
  'Nie udało się otworzyć lobby Deathmatch.': ['Could not open the Deathmatch lobby.', 'Не удалось открыть лобби Deathmatch.', 'No se pudo abrir el lobby de Deathmatch.'],
  'Zły poziom': ['Invalid lobby tier', 'Неверный уровень лобби', 'Nivel de lobby no válido'],
  'Środki już wydane': ['Funds already spent', 'Средства уже потрачены', 'Fondos ya gastados'],
  'Nie ma takiej ścieżki': ['Not found', 'Не найдено', 'No encontrado'],
  'To nie jest link do posta na X (np. https://x.com/twojekonto/status/123…)': ['This is not a link to a post on X (e.g. https://x.com/youraccount/status/123…)', 'Это не ссылка на пост в X (например, https://x.com/твойаккаунт/status/123…)', 'Esto no es un enlace a un post de X (p. ej. https://x.com/tucuenta/status/123…)'],
  'Błąd serwera': ['Server error', 'Ошибка сервера', 'Error del servidor'],
  'Konto zablokowane za oszukiwanie – gra o stawki i wypłaty są wyłączone.': ['Account blocked for cheating – staked games and withdrawals are disabled.', 'Аккаунт заблокирован за читерство – игры на ставки и вывод отключены.', 'Cuenta bloqueada por trampas – las partidas con apuesta y los retiros están desactivados.'],
  'Nowe konto: stawka najwyżej $5 (więcej po 5 meczach)': ['New account: max stake $5 (more after 5 matches)', 'Новый аккаунт: ставка до $5 (больше после 5 матчей)', 'Cuenta nueva: apuesta máxima $5 (más tras 5 partidas)'],
  'Stawka najwyżej $25 – więcej po 20 meczach': ['Max stake $25 – more after 20 matches', 'Ставка до $25 – больше после 20 матчей', 'Apuesta máxima $25 – más tras 20 partidas'],
  'Stawka najwyżej $100 – więcej po 50 meczach': ['Max stake $100 – more after 50 matches', 'Ставка до $100 – больше после 50 матчей', 'Apuesta máxima $100 – más tras 50 partidas'],
  'Za dużo prób – odczekaj chwilę': ['Too many attempts – wait a moment', 'Слишком много попыток – подожди немного', 'Demasiados intentos – espera un momento'],
  'Nie ma takiego konta': ['No such account', 'Такого аккаунта нет', 'No existe esa cuenta'],
  'Strona jest zablokowana hasłem': ['This site is password-protected', 'Сайт защищён паролем', 'El sitio está protegido con contraseña'],
  'Nie udało się sprawdzić salda tokenu – spróbuj za chwilę': ['Could not check the token balance – try again shortly', 'Не удалось проверить баланс токена – попробуй чуть позже', 'No se pudo comprobar el saldo del token – inténtalo en un momento'],
  'Za mało środków na wpisowe': ['Not enough funds for the entry fee', 'Недостаточно средств для взноса', 'Fondos insuficientes para la inscripción'],
  'Zła kategoria zgłoszenia': ['Invalid report category', 'Неверная категория жалобы', 'Categoría de denuncia no válida'],
  'Za późno na zgłoszenie tego meczu': ['Too late to report this match', 'Слишком поздно жаловаться на этот матч', 'Es demasiado tarde para denunciar esta partida'],
  'Nie grałeś w tym meczu': ['You did not play in this match', 'Ты не играл в этом матче', 'No jugaste en esta partida'],
  'Tego gracza nie było w meczu': ['This player was not in the match', 'Этого игрока не было в матче', 'Ese jugador no estaba en la partida'],
  'Nie można zgłosić siebie': ['You cannot report yourself', 'Нельзя пожаловаться на себя', 'No puedes denunciarte a ti mismo'],
  'Ten gracz jest już przez Ciebie zgłoszony w tym meczu': ['You have already reported this player in this match', 'Ты уже пожаловался на этого игрока в этом матче', 'Ya denunciaste a este jugador en esta partida'],
  'Wyrzucono z meczu: serwer wykrył niedozwolony ruch.': ['Kicked from the match: the server detected illegal movement.', 'Выброшен из матча: сервер обнаружил недопустимое движение.', 'Expulsado de la partida: el servidor detectó un movimiento no permitido.'],
  'Za długo na ekranie śmierci – wróciłeś do lobby.': ['Too long on the death screen – you are back in the lobby.', 'Слишком долго на экране смерти – ты вернулся в лобби.', 'Demasiado tiempo en la pantalla de muerte – has vuelto al lobby.'],
  'Mecz przerwany: serwer wykrył niedozwolony ruch.': ['Match stopped: the server detected illegal movement.', 'Матч прерван: сервер обнаружил недопустимое движение.', 'Partida interrumpida: el servidor detectó un movimiento no permitido.'],
  'Ten mecz już trwa w innej karcie.': ['This match is already running in another tab.', 'Этот матч уже идёт в другой вкладке.', 'Esta partida ya está en curso en otra pestaña.'],
  'Żeby zagrać w Deathmatch, udostępnij grę na X.': ['To play Deathmatch, share the game on X.', 'Чтобы играть в Deathmatch, поделись игрой в X.', 'Para jugar Deathmatch, comparte el juego en X.'],
  'Twój post o grze zniknął z X – udostępnij grę jeszcze raz.': ['Your post about the game is gone from X – share the game again.', 'Твой пост об игре пропал из X – поделись игрой ещё раз.', 'Tu publicación sobre el juego ya no está en X – compártelo de nuevo.'],
  'Już szukasz meczu albo grasz.': ['You are already searching for a match or playing.', 'Ты уже ищешь матч или играешь.', 'Ya estás buscando partida o jugando.'],
  'Grasz już mecz 1v1.': ['You are already playing a 1v1 match.', 'Ты уже играешь матч 1v1.', 'Ya estás jugando una partida 1v1.'],
  'Wszedłeś do Deathmatch w innej karcie.': ['You joined Deathmatch in another tab.', 'Ты вошёл в Deathmatch в другой вкладке.', 'Entraste en Deathmatch en otra pestaña.'],
  'Jesteś w kolejce Deathmatch albo w meczu.': ['You are in the Deathmatch queue or in a match.', 'Ты в очереди Deathmatch или в матче.', 'Estás en la cola de Deathmatch o en una partida.'],
  'Ten post jest już przypisany do innego konta.': ['This post is already linked to another account.', 'Этот пост уже привязан к другому аккаунту.', 'Esta publicación ya está vinculada a otra cuenta.'],
  'Nie widać tego posta – sprawdź link i czy konto na X jest publiczne.': ['This post is not visible – check the link and that your X account is public.', 'Пост не виден – проверь ссылку и что аккаунт в X публичный.', 'No se ve la publicación – revisa el enlace y que tu cuenta de X sea pública.'],
  'X nie odpowiada – spróbuj za chwilę.': ['X is not responding – try again shortly.', 'X не отвечает – попробуй чуть позже.', 'X no responde – inténtalo en un momento.'],
  'W poście nie ma adresu CA – opublikuj gotowy tekst z przycisku.': ['The post has no CA address – publish the ready text from the button.', 'В посте нет адреса CA – опубликуй готовый текст с кнопки.', 'La publicación no tiene la dirección CA – publica el texto listo del botón.'],
};
// komunikaty z liczbami (limity, progi) – wzorzec i tłumaczenia z $1, $2… w miejscu liczb
const SRV_RE = [
  [/^Hasło: co najmniej (\d+) znaków$/, ['Password: at least $1 characters', 'Пароль: минимум $1 символов', 'Contraseña: al menos $1 caracteres']],
  [/^Nowe hasło: co najmniej (\d+) znaków$/, ['New password: at least $1 characters', 'Новый пароль: минимум $1 символов', 'Nueva contraseña: al menos $1 caracteres']],
  [/^Wypłaty są wstrzymane przez (\d+) h po zmianie hasła lub e-maila$/, ['Withdrawals are paused for $1 h after a password or e-mail change', 'Выводы приостановлены на $1 ч после смены пароля или e-mail', 'Los retiros se pausan $1 h tras cambiar la contraseña o el e-mail']],
  [/^Minimalna wypłata: (.+) SOL$/, ['Minimum withdrawal: $1 SOL', 'Минимальный вывод: $1 SOL', 'Retiro mínimo: $1 SOL']],
  [/^Dzienny limit wypłat to \$(.+) – zostało \$(.+)$/, ['Daily withdrawal limit is $$$1 – $$$2 left', 'Дневной лимит вывода $$$1 – осталось $$$2', 'El límite diario de retiro es $$$1 – quedan $$$2']],
  [/^Stawka od \$(.+) do \$(.+)$/, ['Stake from $$$1 to $$$2', 'Ставка от $$$1 до $$$2', 'Apuesta de $$$1 a $$$2']],
  [/^Stawka najwyżej \$([\d.]+)$/, ['Max stake $$$1', 'Ставка до $$$1', 'Apuesta máxima $$$1']],
  [/^Lobby Deathmatch jest pełne \((\d+)\/(\d+)\)\. Spróbuj za chwilę\.$/, ['The Deathmatch lobby is full ($1/$2). Try again shortly.', 'Лобби Deathmatch заполнено ($1/$2). Попробуй чуть позже.', 'El lobby de Deathmatch está lleno ($1/$2). Inténtalo en un momento.']],
  [/^W poście nie ma Twojego kodu (\S+) – opublikuj gotowy tekst z przycisku\.$/, ['Your code $1 is not in the post – publish the ready text from the button.', 'В посте нет твоего кода $1 – опубликуй готовый текст с кнопки.', 'Tu código $1 no está en la publicación – publica el texto listo del botón.']],
];
export function srvText(msg, lang) {
  const i = { en: 0, ru: 1, es: 2 }[lang]; if (i == null || !msg) return msg;
  if (SRV[msg]) return SRV[msg][i];
  for (const [re, tr] of SRV_RE) if (re.test(msg)) return msg.replace(re, tr[i]);
  return msg;
}
export function createWallet({ api, root, getLang, toast, onChange, local = null }) {
  const L = () => TXT[getLang()] || TXT.en, T = (k, v) => { let s = L()[k] ?? TXT.en[k] ?? k; if (v) for (const n in v) s = s.replace('{' + n + '}', v[n]); return s; };
  const loc = () => ({ pl: 'pl-PL', en: 'en-US', ru: 'ru-RU', es: 'es-ES' })[getLang()] || 'en-US';
  const fmtUsd = v => (v < 0 ? '−' : '') + '$' + Math.abs(v).toLocaleString(loc(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtSol = (s, d = 4) => s.toLocaleString(loc(), { minimumFractionDigits: 2, maximumFractionDigits: d }) + ' SOL';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let token = null, acct = null, hist = [], earn = null, solFirst = false, online = true, tab = 'dep', pollT = 0;
  try { token = localStorage.getItem('bl-token'); solFirst = localStorage.getItem('bl-solfirst') === '1'; } catch {}
  const DEMO_PRICE = 150;   // tryb testowy bez serwera: stały kurs tylko do pokazania ilości SOL
  async function localCall(method, p, body) {
    const a = local.acct(); if (!a) { const e = new Error(srvText('Zaloguj się', getLang())); e.status = 401; throw e; }
    const pack = () => { const b = local.acct(), h = b.history || [];
      return { account: { username: b.username, email: b.email || '', avatar: b.avatar || '', createdAt: b.createdAt, address: '', lamports: Math.round(b.balance / DEMO_PRICE * 1e9), sol: b.balance / DEMO_PRICE,
          balance: b.balance, price: DEMO_PRICE, cluster: 'test', admin: false, stats: b.stats || {} },
        history: h.map(x => ({ ...x, lamports: x.amount ? Math.round(x.amount / DEMO_PRICE * 1e9) : 0 })) }; };
    if (p === '/me' || p === '/scan') return pack();
    if (p === '/earnings') return { points: pointsFromHistory(a.history) };
    if (p === '/faucet') { await local.addTx(50, 'deposit', 'TEST'); return { ok: true }; }
    if (p === '/withdraw') { const usd = Math.round(body.lamports / 1e9 * DEMO_PRICE * 100) / 100;
      if (usd > a.balance) { const e = new Error(T('errFunds')); throw e; }
      await local.addTx(-usd, 'withdraw', String(body.to).slice(0, 4) + '…' + String(body.to).slice(-4)); return { ...pack(), ok: true, url: '' }; }
    throw new Error('Tryb testowy');
  }
  if (local) token = 'local';

  // identyfikator urządzenia (losowy, zapisany w tej przeglądarce): serwer łączy po nim konta jednej osoby (multikonta, omijanie blokady)
  const devId = () => { try { let d = localStorage.getItem('bl-dev'); if (!d) { d = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem('bl-dev', d); } return d; } catch { return ''; } };
  async function call(method, p, body) {
    if (local) return localCall(method, p, body);
    const r = await fetch(api + '/api' + p, { method, headers: { 'Content-Type': 'application/json', 'X-Dev': devId(), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    let j = {}; try { j = await r.json(); } catch {}
    if (!r.ok) { const e = new Error(srvText(j.message || 'Błąd serwera', getLang())); e.code = j.error; e.status = r.status; if (r.status === 401 && j.error === 'auth') setSession(null); throw e; }
    online = true; return j;
  }
  function setSession(tok) { if (local) return; token = tok; try { tok ? localStorage.setItem('bl-token', tok) : localStorage.removeItem('bl-token'); } catch {} if (!tok) { acct = null; hist = []; earn = null; emit(); } }
  const toLobby = () => acct && { username: acct.username, email: acct.email || '', avatar: acct.avatar || '', createdAt: acct.createdAt, balance: acct.balance, wallet: acct.address, address: acct.address, sol: acct.sol, lamports: acct.lamports,
    price: acct.price, cluster: acct.cluster, admin: acct.admin, stats: acct.stats, history: hist };
  function emit() { if (!local) onChange(toLobby()); render(); }
  function take(j) { if (j.account) acct = j.account; if (j.history) hist = j.history; emit(); return toLobby(); }

  const api$ = {
    get on() { return true; }, get acct() { return toLobby(); }, get token() { return token; }, api,
    async register(username, password) { const j = await call('POST', '/register', { username, password }); setSession(j.token); return take(j); },
    async google(accessToken) { const j = await call('POST', '/google', { accessToken }); setSession(j.token); take(j); return j; },
    async login(username, password) { const j = await call('POST', '/login', { username, password }); setSession(j.token); return take(j); },
    async restore() { if (!token) return null; try { return take(await call('GET', '/me')); } catch (e) { if (e.status !== 401) online = false; return null; } },
    async logout() { try { await call('POST', '/logout'); } catch {} setSession(null); },
    async refresh(scan) { if (!token) return; try { take(await call(scan ? 'POST' : 'GET', scan ? '/scan' : '/me')); } catch { online = false; render(); } },
    async startMatch(stakeUsd) { const j = await call('POST', '/match/start', { stakeUsd, pv: 2 /* wersja gry, serwer: GAME_PROTO */ }); take(j); return j.matchId; },
    async endMatch(matchId, won, forfeit, map) { const j = await call('POST', '/match/end', { matchId, won, forfeit, map }); earn = null; take(j); },
    async stats(o) { try { await call('POST', '/stats', o); } catch {} },
    async earnings() { try { earn = (await call('GET', '/earnings')).points; } catch { earn = earn || []; } return earn; },
    async profile(body) { const j = await call('POST', '/profile', body); return take(j); },
    async password(oldPassword, newPassword) { await call('POST', '/password', { oldPassword, newPassword }); },
    open, close,
  };
  // bez cyklicznego odpytywania: saldo z bazy przy otwarciu portfela i powrocie do lobby, skan wpłat (RPC) tylko po kliknięciu „Sprawdź”

  // ---------- okno ----------
  if (!document.getElementById('bl-w-css')) { const st = document.createElement('style'); st.id = 'bl-w-css'; st.textContent = CSS; document.head.appendChild(st); }
  const wrap = document.createElement('div'); wrap.id = 'bl-w'; wrap.hidden = true; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true');
  wrap.innerHTML = `<div class="bw"><div class="bw-top"><h2 data-t="title"></h2><span class="bw-net" id="bw-net"></span><span class="bw-sp"></span><button class="bw-x" type="button" data-x aria-label="Close">${I.x}</button></div>
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
  // kopiowanie adresu: nowoczesny schowek (tylko https/localhost), a na zwykłym http ukryte pole tekstowe + execCommand
  const copyText = async txt => {
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(txt); return true; } } catch {}
    try {
      const ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;user-select:text;-webkit-user-select:text';
      wrap.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0, txt.length); const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch { return false; }
  };
  const selectAddr = () => { const r = document.createRange(); r.selectNodeContents($('bw-addr')); const g = getSelection(); g.removeAllRanges(); g.addRange(r); };
  const copyAddr = async () => { const ok = await copyText(acct.address); if (ok) toast(T('copied'), 'ok'); else { selectAddr(); toast(T('copyManual'), 'err'); } return ok; };
  $('bw-addr').addEventListener('click', () => { selectAddr(); copyAddr(); });
  $('bw-copy').addEventListener('click', copyAddr);
  $('bw-check').addEventListener('click', async e => { const b = e.currentTarget; b.disabled = true; b.textContent = T('checking'); await api$.refresh(true); b.disabled = false; b.textContent = T('check'); });
  $('bw-faucet').addEventListener('click', async () => {
    await copyAddr();
    try { const j = await call('POST', '/faucet'); toast('+1 SOL', 'ok'); setTimeout(() => api$.refresh(true), local ? 0 : 2000); return j; }
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
      msg.innerHTML = `<div class="bw-ok">✓ ${esc(T(j.review ? 'sentReview' : 'sent'))}${j.url ? ` · <a href="${esc(j.url)}" target="_blank" rel="noopener">${esc(T('view'))} ↗</a>` : ''}</div>`; }
    catch (er) { msg.innerHTML = `<div class="bw-err">${esc(er.message)}</div>`; }
    b.disabled = false; b.textContent = T('send');
  });

  function open(t = 'dep') { tab = t === 'deposit' ? 'dep' : t === 'withdraw' ? 'wd' : t === 'history' ? 'hist' : t; wrap.hidden = false; render(); api$.refresh(false); if (tab === 'earn') loadEarn(); }
  function close() { wrap.hidden = true; }
  async function loadEarn() { try { earn = (await call('GET', '/earnings')).points; } catch { earn = earn || []; } renderEarn(); }

  // ---------- rysowanie ----------
  function render() {
    wrap.querySelectorAll('[data-t]').forEach(el => { el.textContent = T(el.dataset.t); });
    wrap.querySelectorAll('[data-x]').forEach(el => el.setAttribute('aria-label', T('close')));   // przycisk ✕ w języku gry
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
    const demo = !acct.address; wrap.querySelector('.bw-qr').hidden = demo; $('bw-copy').hidden = demo; $('bw-check').hidden = demo;
    $('bw-addr').style.font = demo ? '500 13px/1.45 Barlow,sans-serif' : ''; $('bw-addr').style.color = demo ? '#c4bccc' : ''; $('bw-addr').style.wordBreak = demo ? 'normal' : '';
    if (demo) { $('bw-addr').textContent = T('demoAddr'); $('bw-faucet').textContent = T('demoFaucet'); }
    else if ($('bw-addr').textContent !== acct.address) {
      $('bw-addr').textContent = acct.address;
      try { const qr = qrcode(0, 'M'); qr.addData('solana:' + acct.address); qr.make(); $('bw-qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); } catch { $('bw-qr').textContent = ''; }
    }
    $('bw-depinfo').textContent = T('depInfo', { net: testnet ? ' (' + acct.cluster + ')' : '' });
    $('bw-faucet').hidden = !testnet; $('bw-fnote').innerHTML = demo ? '' : testnet ? esc(T('faucetInfo')).replace('faucet.solana.com', '<a href="https://faucet.solana.com/" target="_blank" rel="noopener">faucet.solana.com</a>') : '';
    // wypłata
    $('bw-unit').innerHTML = (wdSol ? 'SOL' : 'USD') + I.swap;
    $('bw-amt').placeholder = wdSol ? '0.0000' : '0.00';
    // historia
    const list = $('bw-hist');
    list.innerHTML = hist.length ? hist.map(h => {
      const kind = h.type === 'deposit' ? 'in' : h.type === 'withdraw' ? 'out' : 'game', ic = h.type === 'deposit' ? I.down : h.type === 'withdraw' ? I.up : I.game;
      const sub = [new Date(h.t).toLocaleString(loc(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })];
      if (['pending', 'failed', 'review', 'rejected'].includes(h.status)) sub.push(T(h.status));
      if (h.sig) sub.push(`<a href="https://explorer.solana.com/tx/${esc(h.sig)}${testnet ? '?cluster=' + esc(acct.cluster) : ''}" target="_blank" rel="noopener">${esc(h.sig.slice(0, 6))}… ↗</a>`);
      const note = h.fee ? T('fee', { a: fmtUsd(h.fee) }) : h.note;
      const v = h.amount ? `<span class="${h.amount > 0 ? 'pos' : 'neg'}">${h.amount > 0 ? '+' : ''}${fmtUsd(h.amount)}</span><small>${h.lamports ? (h.lamports > 0 ? '+' : '−') + fmtSol(Math.abs(h.lamports) / 1e9) : ''}</small>` : '<span>—</span>';
      return `<li><span class="bw-ic ${kind}">${ic}</span><div class="tx"><b>${esc((L().tx || TXT.en.tx)[h.type] || h.type)}${note ? ' · ' + esc(note) : ''}</b><small>${sub.join(' · ')}</small></div><div class="v">${v}</div></li>`;
    }).join('') : `<li class="bw-empty">${esc(T('empty'))}</li>`;
    if (tab === 'earn') renderEarn();
  }

  const earnState = {};
  function renderEarn() { renderEarnings($('bw-earn'), earn, getLang(), earnState); }

  return api$;
}
