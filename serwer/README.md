# Serwer portfeli BEENLADEN

Prawdziwe portfele SOL dla gry: konto gracza, własny adres depozytu, wpłaty z dowolnego portfela,
wypłaty na dowolny adres, stawki meczów 1v1 i dane dla panelu admina. Domyślnie działa na **devnecie** Solany.

## Jak to działa

- Każde konto dostaje adres depozytu wyprowadzony z jednej frazy (BIP39, ścieżka jak w Phantomie `m/44'/501'/i'/0'`).
  Indeks `0` to **skarbiec**, a gracze mają indeksy od `1`.
- Serwer co kilkanaście sekund sprawdza adresy graczy. Nową wpłatę dopisuje do salda (księga w bazie, w lamportach),
  a środki przenosi do skarbca.
- Wypłaty idą ze skarbca. Opłatę sieci (0,000005 SOL) płaci gra.
- Stawki są w dolarach i pobierane w SOL po bieżącym kursie (CoinGecko, zapasowo Binance).
  Wygrana to 2 × stawka − 10% prowizji.
- Klucze prywatne nie są zapisywane nigdzie. Wylicza się je z frazy tylko w chwili podpisu.

## Uruchomienie

```bash
cd serwer && npm install
```

```bash
ADMIN_USERS=twojanazwa node serwer.mjs
```

Serwer podaje też zbudowaną grę (`../index.html`) pod tym samym adresem: wejdź na `http://localhost:8787`.
Gra sama wie, gdzie jest API. Grę z innego adresu (np. GitHub Pages) podłączasz, wpisując adres serwera
w `zrodla/wallet-config.js` (`WALLET_API`) albo dopisując do adresu gry `?api=https://adres-serwera`.

Testowe SOL na devnecie: <https://faucet.solana.com> (wklej adres z zakładki **Wpłać** w portfelu).

### Zmienne środowiskowe

| Zmienna | Domyślnie | Opis |
|---|---|---|
| `PORT` | `8787` | port HTTP |
| `SOLANA_CLUSTER` | `devnet` | `devnet`, `testnet` albo `mainnet-beta` (zablokowany, patrz niżej) |
| `SOLANA_RPC_URL` | publiczny RPC sieci | własny RPC (Helius, QuickNode…) – zalecany przy większym ruchu |
| `WALLET_MNEMONIC` | — | fraza 24 słów. Bez niej (tylko sieć testowa) serwer tworzy ją raz w `dane/fraza.txt` |
| `ADMIN_USERS` | — | nazwy kont z dostępem do panelu admina, po przecinku |
| `CORS_ORIGINS` | `*` | adresy gry, np. `https://smolka77.github.io` |
| `DATA_DIR` | `serwer/dane` | baza SQLite i fraza – **musi być na trwałym dysku** |
| `HOUSE_FEE` | `0.10` | prowizja od puli |
| `MIN_WITHDRAW_SOL` | `0.001` | minimalna wypłata |

Wymagany Node.js 22.5 lub nowszy (wbudowany `node:sqlite`).

## Wdrożenie

Każdy hosting Node z trwałym dyskiem, np. Railway (wolumen), Fly.io (volume), Render (persistent disk) albo VPS.

1. Ustaw `npm install` jako komendę budowania i `node serwer.mjs` jako komendę startu, katalog `serwer/`.
2. Podłącz trwały dysk i ustaw `DATA_DIR` na jego ścieżkę.
3. Ustaw `ADMIN_USERS` i `CORS_ORIGINS`. `WALLET_MNEMONIC` ustaw jako sekret: wygeneruj frazę i zapisz jej kopię w bezpiecznym miejscu.
4. Wpisz adres serwera w `zrodla/wallet-config.js` i przebuduj grę.

**Fraza = wszystkie środki.** Kto ją zna, ma dostęp do skarbca i wszystkich adresów depozytów.
Nie wrzucaj jej do repozytorium (katalog `dane/` jest w `.gitignore`).

## Przed mainnetem (prawdziwe pieniądze)

Serwer odmawia startu na `mainnet-beta`, dopóki nie ustawisz `ALLOW_MAINNET=tak`. Wcześniej trzeba zrobić trzy rzeczy:

- **Wynik meczu liczy dziś przeglądarka gracza** i wysyła go do serwera. Na prawdziwe pieniądze każdy mógłby
  wysłać „wygrałem”. Potrzebny jest serwer gry, który sam rozstrzyga mecz.
- **Gorący portfel:** trzymaj w skarbcu tylko tyle, ile potrzeba na bieżące wypłaty, a resztę na osobnym portfelu.
  Dodaj limity i ręczną akceptację dużych wypłat.
- **Prawo:** gry o pieniądze wymagają w wielu krajach licencji. Sprawdź to przed startem.
