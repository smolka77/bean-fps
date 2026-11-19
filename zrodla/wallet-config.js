// Adres serwera portfeli (katalog serwer/ w repo). Pusty = gra bez serwera: konta i saldo tylko testowe (jak dawniej).
// Po wdrożeniu serwera wpisz tu jego adres, np. 'https://beanladen-portfele.onrender.com'.
// Do testów można też dopisać do adresu gry ?api=https://adres-serwera (zapamiętuje się w przeglądarce; ?api=off czyści).
export const WALLET_API = '';
// Serwery portfeli, które wolno podać w ?api= bez pytania gracza (np. oficjalny serwer, gdy gra działa z GitHub Pages).
// localhost / 127.0.0.1 są zawsze dozwolone (testy).
export const TRUSTED_APIS = [];

// Bezpieczeństwo: link do gry z ?api=https://obcy-serwer przekierowałby logowanie, hasło, token sesji, kody 2FA admina
// i adres wpłat na cudzy serwer. Dlatego:
//  - gra podana przez sam serwer portfeli (window.BEANLADEN_API) zawsze używa własnego adresu; ?api= jest ignorowane i czyszczone,
//  - na hostingu statycznym adres spoza listy zaufanych gracz musi potwierdzić – przy każdym wczytaniu strony (odmowa = gra bez serwera),
//  - tylko adresy http(s); wynik jest liczony raz na wczytanie strony.
const originOf = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.origin : ''; } catch { return ''; } };
const isLocal = (o) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(o);
const trusted = (o) => !!o && (isLocal(o) || [WALLET_API, ...TRUSTED_APIS].some((t) => t && originOf(t) === o));
let cached = null;

export function walletApi() {
  if (cached !== null) return cached;
  const own = typeof window !== 'undefined' && window.BEANLADEN_API;   // gra podana przez sam serwer portfeli
  let v = '';
  try {
    if (own) localStorage.removeItem('bl-api');
    else {
      const p = new URLSearchParams(location.search).get('api');
      if (p === 'off') localStorage.removeItem('bl-api');
      else if (p && originOf(p)) localStorage.setItem('bl-api', p.trim());
      const s = (localStorage.getItem('bl-api') || '').trim(), o = originOf(s);
      if (o && (trusted(o) || confirm(`Gra połączy się z serwerem portfela:\n\n${o}\n\nLogowanie, hasło i wpłaty pójdą na ten adres. Kontynuuj tylko, jeśli to oficjalny serwer gry.`))) v = s;
      else if (s) localStorage.removeItem('bl-api');
    }
  } catch {}
  return cached = (own || v || WALLET_API || '').replace(/\/+$/, '');
}
