# Bean FPS

Strzelanka FPS z fasolką (three.js). **Zagraj w przeglądarce: https://smolka77.github.io/bean-fps/**

Cała gra jest w **jednym pliku: [`index.html`](index.html)**.
Pobierz go i otwórz dwuklikiem w Chrome, Edge albo Firefoksie. Działa bez serwera i bez internetu.

## Co jest w środku

- **Lobby:** konto i testowy portfel USDT (zapisywane w przeglądarce), stawki, losowanie mapy, skiny, ustawienia (dźwięk, FOV, język).
- **Tryby:**
  - **Strzelnica:** trening solo w podziemnym bunkrze (tunel w skale, tory, świetlówki), tarcze-fasolki na stojakach i tablica ustawień.
  - **Z botem:** mecz 1v1 z botem do 3 wygranych rund, bez serwera i stawki.
  - **1v1:** mecz z prawdziwym graczem o stawkę do 3 wygranych rund (serwer meczów), na jednej z trzech map.
  - **Deathmatch:** do 20 graczy, 3 minuty, widok z 3. osoby (wymaga serwera gry – szczegóły niżej).
- **Mapy:** Bagno (dawna Oaza), Magazyn, Salon (dawna Baza), Strzelnica.
  Bagno to przystań na bagnie budowana w kodzie (`zrodla/oaza-data.js` – kolizje i spawny, `zrodla/bagno-scena.js` – wygląd): sklepik z przynętą na palach,
  pomosty, dwa hydroplany, przyczepy kempingowe, dęby z korzeniami, beczki i rozlewisko, którym się brodzi; niebo i światło ustawia `zrodla/klimaty.js`.
  Po zmianie kolizji mapy serwer meczów trzeba zrestartować (czyta `zrodla/*-data.js` przy starcie).
  Salon to wielka hala salonu luksusowych aut w klimacie Vice City: auta sportowe na wystawie, obrotowa platforma, witryna na wieczorną ulicę,
  serwisy na obu końcach (tu startują gracze) i pokoje (szatnia z szafkami, biuro, poczekalnia, gabinet). Hala i kolizje są budowane w kodzie
  w `zrodla/baza-data.js` (serwer czyta tę samą mapę, w kodzie nadal „Baza”), ulica i miasto wokół są w `zrodla/klimaty.js`.
- **Bronie:** AKM, M4A1 (z kolimatorem), Glock-17, Desert Eagle, SPAS-12, MP5K – modele 3D (GLB) i dźwięki z biblioteki gry
  (strzał, strzał z daleka, wyjęcie, magazynek, zamek, pompka, naboje); oglądanie broni pod klawiszem F.
  - 1v1: drużyna niebieska M4A1 + Desert Eagle, czerwona AKM + Glock-17. Deathmatch: start z Glockiem-17, reszta w sklepie.
  - **AKM Gold** (złoty AKM): ta sama broń co AKM, pozłacany model; tylko dla wybranych graczy – kryteria dostępu do ustalenia,
    na razie widzi go tylko admin w Strzelnicy (`weaponAccessFor` w `zrodla/weaponry.js`).

## Deathmatch

Wszystko, co ważne, liczy serwer (`serwer/dm.mjs`): ruch, strzały (szybkostrzelność, amunicja, rozrzut, śruciny, spadek obrażeń),
trafienia w głowę i tułów z kompensacją opóźnienia, pancerz, zabójstwa, kasę meczu, WANTED, zakupy, odrodzenia, zegar i wynik.

- **Kolejka:** poziomy (wpisowe, np. Free / $1 / $5 / $20), osobna kolejka dla każdego. Komplet (20) startuje od razu;
  po 60 s mecz rusza z tyloma graczami, ilu czeka (najmniej 2). Wyjście z kolejki = zwrot wpisowego.
- **Mecz:** każdy zaczyna z pistoletem. Ranking: zabójstwa, przy remisie zadane obrażenia. Pierwsze miejsce = **WANTED**
  (czerwona czaszka nad postacią i na minimapie, za jego zabójstwo ×3 nagrody).
- **Śmierć:** ekran WASTED, potem sklep (broń i kamizelka / kamizelka z hełmem za kasę meczu), powrót do walki od razu.
  Zakupy przepadają po śmierci, kasa zostaje.
- **Koniec:** podium z trzema najlepszymi (emotki), pula wpisowego minus prowizja dzielona 50/30/20.
- **Panel admina → Deathmatch:** wszystkie liczby trybu (gracze, czasy, nagrody, ceny i statystyki broni, pancerz, poziomy, podział puli).
- **Boty testowe:** `node narzedzia/dm-boty.mjs 8 http://127.0.0.1:8787 free` – zakładają konta, grają mecz i wypisują wynik.

Sterowanie w Deathmatch: jak wyżej, do tego Tab – tabela wyników, G – emotka (machanie / taniec / radość); w sklepie Q/E zakładki, W/S lista, A/D przedmioty,
Enter kup, Spacja powrót do walki.

Sterowanie: WASD ruch, Shift bieg, Spacja skok, C kucanie/slide, LPM strzał, PPM celowanie, R przeładowanie,
F oglądanie broni, 1–4 / kółko zmiana broni, V widok, M dźwięk, Esc pauza.

## Bronie: modele i dźwięki

Modele i dźwięki broni przygotowuje [`narzedzia/assety/przygotuj-bronie.mjs`](narzedzia/assety/przygotuj-bronie.mjs) (osobne `npm install` w tym folderze):
ustawia każdy model jak w grze (metry, lufa w −Z, początek w dłoni na chwycie), wycina ruchome części (magazynek, zamek, czółenko),
zmniejsza tekstury (WebP) i kompresuje siatkę (meshopt), a wybrane nagrania WAV zamienia na MP3. Wynik: `zrodla/weapons/<id>-glb.js` i `<id>-snd.js`.
Punkty chwytu, celowania i dłoni są w `zrodla/weapons/<id>.js`.

```bash
cd narzedzia/assety
npm install
node przygotuj-bronie.mjs
```

Modele 3D (licencja [CC-BY 4.0](http://creativecommons.org/licenses/by/4.0/), zmienione: skala, ustawienie, podział na części, kompresja):

| Broń | Model | Autor |
|---|---|---|
| AKM | [AKM](https://sketchfab.com/3d-models/akm-93b9714e15a14dba849d2912e4b8e39d) | [mcmxcg](https://sketchfab.com/mcmxcg) |
| M4A1 | [Assault rifle M4A1](https://sketchfab.com/3d-models/assault-rifle-m4a1-1b858701dd7142d9b82bbe3fd121a97b) | [bobeer](https://sketchfab.com/bobeer) |
| Glock-17 | [9mm Pistol](https://sketchfab.com/3d-models/9mm-pistol-43bc09f5aace4346a8a2b6e1580fc03f) | [TORI106](https://sketchfab.com/TORI106) |
| Desert Eagle | [Desert Eagle](https://sketchfab.com/3d-models/desert-eagle-4be942b4b2004a6c9cc47e2961b8e6fd) | [Bagason](https://sketchfab.com/Bagason) |
| SPAS-12 | [Half-Life 2 RTX Shotgun (Spas-12)](https://sketchfab.com/3d-models/half-life-2-rtx-shotgun-spas-12-bc0dfd824ccb4d5ebf007c654b42d428) | [carrilloriscomatias](https://sketchfab.com/carrilloriscomatias) |
| MP5K | [MP5K](https://sketchfab.com/3d-models/mp5k-b47fa4053c1e4cfabe91b0046689f8c9) | [Shorty_Digitan](https://sketchfab.com/Shorty_Digitan) |

## Struktura

| Ścieżka | Co to jest |
|---|---|
| `index.html` | gotowa gra w jednym pliku (three.js r170, moduły, mapy i zdjęcia map wbudowane) |
| `zrodla/` | pliki źródłowe gry, osobne moduły (tak jak w artefakcie gry na claude.ai) |
| `narzedzia/build_game.mjs` | skrypt, który skleja `zrodla/` w `index.html` (esbuild) |
| `skins.json` | skiny z kreatora (gra wczytuje je przy starcie; panel admina zapisuje tu zmiany) |
| `kreator-skinow.html` | kreator skinów (otwierany z panelu admina, działa też samodzielnie) |

## Skiny z kreatora

Panel admina (menu ☰ albo Ctrl+Shift+A) ma zakładkę **Skiny**: dodawanie, edycja w kreatorze, usuwanie i kolejność.
„Opublikuj w grze” zapisuje `skins.json` w tym repo przez GitHub API (token z dostępem Contents: zapis), więc zmiany widzą wszyscy po odświeżeniu strony.
Skiny z kreatora nie są wbudowane w `index.html`: gra pobiera je z `skins.json` (obrazki w WebP). Gra otwarta prosto z dysku, bez serwera, pokazuje tylko skiny wbudowane.

## Przebudowanie po zmianach w `zrodla/`

```bash
cd narzedzia
npm install
npm run build
```

Źródło: artefakt gry na claude.ai, wersja z 13.11.2026 (Strzelnica w kolorystyce lobby: wersja 52). Zawiera zmiany ze wszystkich czatów:
mapy Oaza (poprawki kolizji i okien), Magazyn, Baza i Strzelnica, mecz 1v1, nowe lobby i choreografie oglądania broni.
