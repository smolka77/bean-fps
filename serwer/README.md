# Serwer portfeli BEANLADEN

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
node serwer.mjs
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
| `HOST` | `127.0.0.1` | adres nasłuchu: tylko ta maszyna (nginx przed serwerem). `0.0.0.0` wystawia port 8787 do internetu – niezalecane |
| `SESSION_DAYS` | `30` | po tylu dniach sesja gracza wygasa |
| `WITHDRAW_DAILY_USD` | `500` | limit wypłat jednego konta w ciągu 24 h |
| `WITHDRAW_REVIEW_USD` | `100` | wypłata powyżej tej kwoty czeka na akceptację w panelu admina |
| `SECURITY_HOLD_HOURS` | `24` | blokada wypłat po zmianie hasła albo e-maila |
| `CORS_ORIGINS` | `*` | adresy gry, np. `https://smolka77.github.io` |
| `DATA_DIR` | `serwer/dane` | baza SQLite i fraza – **musi być na trwałym dysku** |
| `HOUSE_FEE` | `0.10` | prowizja od puli |
| `REVIEW_STAKE_USD` | `250` | od takiej stawki każda wygrana czeka na sprawdzenie w `/admin-mecze` |
| `REPLAY_DAYS` | `60` | ile dni serwer trzyma powtórki (wstrzymane i odrzucone mecze zawsze) |
| `MIN_WITHDRAW_SOL` | `0.001` | minimalna wypłata |
| `GOOGLE_CLIENT_ID` | — | identyfikator klienta OAuth Google (logowanie „Kontynuuj z Google”) |
| `COVER_PASSWORD` | — | hasło bramki: czarny ekran z kotem (`cover.html`, jak na cryptostrike.pl) przed całą stroną i API; puste = bez bramki |

Wymagany Node.js 22.5 lub nowszy (wbudowany `node:sqlite`).

## Panel admina i bezpieczeństwo kont

- **Panel admina ma własne konta** (tabela `admins`), niezależne od kont graczy: login + hasło + kod 2FA (TOTP: Google
  Authenticator, Authy, 1Password). Konto zakłada się na serwerze: `node admin.mjs dodaj NAZWA` (na VPS: `bash beanladen-admin.sh dodaj NAZWA`),
  narzędzie pokazuje losowe hasło jeden raz. Przy pierwszym logowaniu panel pokazuje kod QR. Sesja panelu wygasa po 30 min bez ruchu (najwyżej 12 h)
  i jest tylko w tej karcie przeglądarki. `ADMIN_USERS` / `ADMIN_IDS` nie są już używane.
- **Dziennik admina** (tabela `audit`): logowania adminów, 2FA, zmiany ustawień, decyzje o wypłatach – widać go w panelu.
- **Wypłaty**: dzienny limit na konto, duże wypłaty czekają na akceptację (panel → „Wypłaty do akceptacji”), blokada po zmianie hasła/e-maila.
- **Hasła**: scrypt (N=2^14, r=8, p=5); nowe hasła min. 10 znaków. Starsze hashe są przepisywane przy logowaniu.
- **Limity prób**: na IP i na nick. `X-Forwarded-For` jest brany pod uwagę tylko z 127.0.0.1 (nginx).
- **WebSocket**: gra łączy się z `/ws?k=BILET` (jednorazowy, 30 s, z `POST /api/ws-ticket`), token sesji nie trafia do adresu.
- Kod: `ochrona.mjs` (hasła, TOTP, limity, bilety, zastrzeżone nicki).

Narzędzie `admin.mjs`: `lista`, `dodaj NAZWA`, `haslo NAZWA` (nowe losowe hasło), `reset-2fa NAZWA` (zgubiony telefon – przy następnym
logowaniu nowy kod QR), `usun NAZWA`. Działa przy włączonym serwerze, bez restartu.

## Logowanie przez Google

1. W Google Cloud Console utwórz projekt, a w „Interfejsy API i usługi → Dane logowania” identyfikator klienta OAuth typu **Aplikacja internetowa**.
2. W „Autoryzowane źródła JavaScriptu” wpisz adresy gry, np. `https://smolka77.github.io` i adres serwera.
3. Ustaw na serwerze `GOOGLE_CLIENT_ID` (np. `1234-abc.apps.googleusercontent.com`). Gra pobiera go z `/api/config`, więc w kodzie gry nic nie trzeba zmieniać.

Serwer sprawdza w Google, czy token jest wydany dla tej aplikacji i czy e-mail jest potwierdzony. Nowe konto dostaje nick z początku adresu e-mail (gracz może go zmienić w profilu).

## Wdrożenie

Każdy hosting Node z trwałym dyskiem, np. Railway (wolumen), Fly.io (volume), Render (persistent disk) albo VPS.

1. Ustaw `npm install` jako komendę budowania i `node serwer.mjs` jako komendę startu, katalog `serwer/`.
2. Podłącz trwały dysk i ustaw `DATA_DIR` na jego ścieżkę.
3. Ustaw `CORS_ORIGINS` i załóż konto panelu (`node admin.mjs dodaj NAZWA`). `WALLET_MNEMONIC` ustaw jako sekret: wygeneruj frazę i zapisz jej kopię w bezpiecznym miejscu.
4. Wpisz adres serwera w `zrodla/wallet-config.js` i przebuduj grę.

**Fraza = wszystkie środki.** Kto ją zna, ma dostęp do skarbca i wszystkich adresów depozytów.
Nie wrzucaj jej do repozytorium (katalog `dane/` jest w `.gitignore`).

## Antycheat: mecz liczy serwer

Mecz 1v1 rozstrzyga serwer (`mecz.mjs`), a nie przeglądarka gracza. Gracz wysyła tylko swój stan ruchu i „strzeliłem stąd w tę stronę”.

- **Trafienia i obrażenia:** serwer sam liczy rozrzut broni, lot pocisku po kolizjach mapy (`zrodla/*-data.js`) i trafienie w fasolkę
  przeciwnika (z cofnięciem jej pozycji o opóźnienie strzelającego). Odejmuje HP i ogłasza śmierć. Meldunki „trafiłem” i „zginąłem” od gracza nie istnieją.
- **Broń:** szybkostrzelność (rpm), magazynek, zapas i czas przeładowania każdej broni. Strzał ponad limit albo bez naboi przepada.
- **Ruch:** prędkość (chwilowa i średnia z 2 s), wysokość skoku, czas w powietrzu, wejście w ścianę i przejście przez nią, granice mapy.
  Złą pozycję serwer odrzuca i cofa gracza (`fix`). 25 ciężkich odrzuceń w 20 s (teleport, latanie, przenikanie) = walkower za oszukiwanie.
- **Wallhack:** pozycja przeciwnika idzie do gracza tylko wtedy, gdy ten może go zobaczyć (linie wzroku po kolizjach mapy, z wyprzedzeniem 0,15 s).
- **Rundy:** strzały i obrażenia działają dopiero po odliczaniu. Pozycje startowe i pełne HP ustawia serwer.
- **Wynik i pieniądze:** rozliczenie robi serwer po ostatniej rundzie. `POST /api/match/end` niczego już nie zmienia.

- **Lag switch:** strzał bez świeżych paczek ruchu (dłużej niż 0,35 s) przepada, a cofnięcie przeciwnika przy trafieniu jest ograniczone do 0,25 s.

## Antycheat: aimbot, triggerbot, silent aim (`antycheat.mjs`)

Celowania nie da się policzyć na serwerze, bo myszką rusza gracz. Dlatego gra wysyła kąty kamery z każdej klatki i z chwili
każdego strzału, a serwer porównuje je z tym, gdzie naprawdę był przeciwnik. Po meczu każdy gracz dostaje ocenę ryzyka 0–100%:

- **czas reakcji** od pojawienia się przeciwnika do pierwszego trafienia (człowiek 180–300 ms, aimbot kilkadziesiąt),
- **snap**: kamera skacze w jednej klatce z bezruchu prosto na cel,
- **silent aim**: kierunek strzału inny niż kamera w tej samej klatce albo kamera, która „skoczyła” na cel tylko na czas strzału,
- **śledzenie**: celownik przyklejony do biegnącego przeciwnika,
- **triggerbot**: strzały prawie wyłącznie z celownikiem na celu (człowiek strzela też, gdy celownik ucieka),
- **skrypt na odrzut**: długie serie bez żadnego drgnięcia celownika,
- trafienia w głowę (tylko gdy cała sylwetka była odsłonięta), celność, przerwy w paczkach (lag switch), odrzucone ruchy,
- brak danych o kamerze (zmieniony klient).

Jeden sygnał rzadko przesądza, więc serwer łączy je w jedno ryzyko. Progi sprawdza symulacja: ludzie (zwykły, bardzo dobry,
pre-aim) mają 0%, a rage aimbot, wygładzony aimbot, aimbot na tułów z ludzką reakcją, triggerbot i trzy odmiany silent aim
od 72% do 100%. To symulacja, nie dane z prawdziwych meczów: progi warto poprawić po pierwszych tygodniach gry.

## Wstrzymane wypłaty, powtórki i panel `/admin-mecze`

Wygrana nie trafia na saldo, tylko czeka na decyzję admina (w historii gracza jest „w toku”), gdy:

- ryzyko oszustwa zwycięzcy to co najmniej 50%,
- konto jest pod obserwacją (średnia ryzyka z kolejnych meczów od 35%),
- ta sama para gra ze sobą 4. raz w 24 h albo znów kończy mecz walkowerem bez gry,
- konta są powiązane (to samo urządzenie, adres wypłat albo IP),
- stawka jest wysoka (od `REVIEW_STAKE_USD`, domyślnie $250).

Serwer zapisuje powtórkę każdego meczu (`dane/powtorki`, gzip): ruch obu graczy, kierunek kamery, strzały, rundy i statystyki.
Panel `/admin-mecze` (konto panelu admina: login, hasło i kod 2FA – to samo co w panelu admina w grze) pokazuje mecze do sprawdzenia, sygnały, powiązane konta i powtórkę z góry mapy.
**Wypłać** dopisuje wygraną zwycięzcy. **Odrzuć i zablokuj** oddaje pulę przeciwnikowi i blokuje oszusta.

Zablokowane konto nie gra o stawki i nie wypłaca. Nowe konto z tego samego urządzenia albo z tym samym adresem wypłat jest
blokowane od razu.

## Multikonta i limity stawek

- Gra zapamiętuje losowy identyfikator urządzenia (w przeglądarce), a serwer zapisuje urządzenia, adresy IP i adresy wypłat każdego konta.
- Konta jednej osoby (wspólne urządzenie, adres wypłat albo IP z ostatnich 30 dni) nie trafiają na siebie w kolejce.
- Nowe konta grają o mniejsze stawki: do 5 meczów najwyżej $5, do 20 – $25, do 50 – $100, potem do $1000.
- Adres IP bierzemy z połączenia. `X-Forwarded-For` liczy się tylko od pośrednika na tym samym serwerze (np. nginx).

## Czego to nie zatrzyma

- Dobrze „uczłowieczonego” aimbota, który celuje z ludzkim opóźnieniem i błędem. Taki daje niewielką przewagę, ale go nie widać.
- Wallhacka w zasięgu wzroku: gracz dostaje pozycję przeciwnika 0,15 s przed wyjściem zza rogu (żeby nie „wyskakiwał”).
- Klienta, który podrabia całą ścieżkę kamery. Wtedy kamera i tak musi być na celu, więc łapią go statystyki, ale później.
- Samego skryptu na odrzut przy ludzkim celowaniu. Odrzut liczy gra, a serwer widzi tylko kamerę po kompensacji.
- Osoby, która czyści przeglądarkę i zmienia IP. Pomaga limit stawek nowych kont.

Gra jest w przeglądarce, więc kod klienta da się podejrzeć i zmienić. Dlatego wszystko, co ważne, liczy serwer, a reszta to wykrywanie i ręczna kontrola.

## Przed mainnetem (prawdziwe pieniądze)

Serwer odmawia startu na `mainnet-beta`, dopóki nie ustawisz `ALLOW_MAINNET=tak`. Wcześniej trzeba zrobić dwie rzeczy:

- **Gorący portfel:** trzymaj w skarbcu tylko tyle, ile potrzeba na bieżące wypłaty, a resztę na osobnym portfelu.
  Dodaj limity i ręczną akceptację dużych wypłat.
- **Prawo:** gry o pieniądze wymagają w wielu krajach licencji. Sprawdź to przed startem.
