// Adres serwera portfeli (katalog serwer/ w repo). Pusty = gra bez serwera: konta i saldo tylko testowe (jak dawniej).
// Po wdrożeniu serwera wpisz tu jego adres, np. 'https://beanladen-portfele.onrender.com'.
// Do testów można też dopisać do adresu gry ?api=https://adres-serwera (zapamiętuje się w przeglądarce; ?api=off czyści).
export const WALLET_API = '';

export function walletApi() {
  let v = '';
  try {
    const p = new URLSearchParams(location.search).get('api');
    if (p === 'off') localStorage.removeItem('bl-api');
    else if (p) localStorage.setItem('bl-api', p);
    v = localStorage.getItem('bl-api') || '';
  } catch {}
  const own = typeof window !== 'undefined' && window.BEANLADEN_API;   // gra podana przez sam serwer portfeli
  return (v || own || WALLET_API || '').replace(/\/+$/, '');
}
