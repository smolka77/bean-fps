# Bean FPS

Strzelanka FPS z fasolką (three.js). **Zagraj w przeglądarce: https://smolka77.github.io/bean-fps/**

Gra to mała strona [`index.html`](index.html) (ok. 60 KB) i folder `gra/` z kodem, modelami i zdjęciami.
Przy wejściu przez sieć idzie ok. 0,45 MB kodu (skompresowane), bronie ok. 1,4 MB, a mapy, dźwięki i tryby doczytują się w tle.
Pliki w `gra/` mają w nazwie skrót treści, więc przy kolejnych wejściach przeglądarka bierze je z cache.
Wersja w jednym pliku do otwarcia dwuklikiem (bez serwera): `npm run build:offline` w `narzedzia/` → `gra-offline.html`.

## Co jest w środku

- **Lobby:** konto i testowy portfel USDT (zapisywane w przeglądarce), stawki, losowanie mapy, skiny, ustawienia (dźwięk, FOV, język).
- **Tryby:**
  - **Strzelnica:** trening solo w podziemnym bunkrze (tunel w skale, tory, świetlówki), tarcze-fasolki na stojakach i tablica ustawień.
  - **Z botem:** mecz 1v1 z botem do 3 wygranych rund, bez serwera i stawki.
  - **1v1:** mecz z prawdziwym graczem o stawkę do 3 wygranych rund (serwer meczów), na jednej z trzech map.
  - **Deathmatch:** za darmo, stałe lobby do 20 graczy (wchodzisz i wychodzisz kiedy chcesz), widok z 3. osoby (wymaga serwera gry – szczegóły niżej).
- **Mapy:** Bagno (dawna Oaza), Magazyn, Salon (dawna Baza), Strzelnica.
  Bagno to przystań na bagnie budowana w kodzie (`zrodla/oaza-data.js` – kolizje i spawny, `zrodla/bagno-scena.js` – wygląd): sklepik z przynętą na palach,
  pomosty, dwa hydroplany, przyczepy kempingowe, dęby z korzeniami, beczki i rozlewisko, którym się brodzi; niebo i światło ustawia `zrodla/klimaty.js`.
  Po zmianie kolizji mapy serwer meczów trzeba zrestartować (czyta `zrodla/*-data.js` przy starcie).
  Salon to wielka hala salonu luksusowych aut w klimacie Vice City: auta sportowe na wystawie, obrotowa platforma, witryna na wieczorną ulicę,
  serwisy na obu końcach (tu startują gracze) i pokoje (szatnia z szafkami, biuro, poczekalnia, gabinet). Hala i kolizje są budowane w kodzie
  w `zrodla/baza-data.js` (serwer czyta tę samą mapę, w kodzie nadal „Baza”), ulica i miasto wokół są w `zrodla/klimaty.js`.
- **Bronie:** AKM, M4A1 (z kolimatorem), Glock-17, Desert Eagle, SPAS-12, MP5K – modele 3D (GLB) i dźwięki z biblioteki gry
  (strzał, strzał z daleka, wyjęcie, magazynek, zamek, pompka, naboje); oglądanie broni pod klawiszem F.
  - 1v1: drużyna niebieska M4A1 + Desert Eagle, czerwona AKM + Glock-17. Deathmatch: start z Glockiem-17, każde zabójstwo daje kolejną broń.
  - **AKM Gold** (złoty AKM): ta sama broń co AKM, pozłacany model; tylko dla wybranych graczy – kryteria dostępu do ustalenia,
    na razie widzi go tylko admin w Strzelnicy (`weaponAccessFor` w `zrodla/weaponry.js`).

## Deathmatch

Wszystko, co ważne, liczy serwer (`serwer/dm.mjs`): ruch, strzały (szybkostrzelność, amunicja, rozrzut, śruciny, spadek obrażeń),
trafienia w głowę i tułów z kompensacją opóźnienia, zabójstwa, WANTED, kolejną broń za zabójstwo i odrodzenia.

- **Za darmo:** bez wpisowego i nagród, bez sklepu.
- **Stałe lobby:** jedno lobby, cały czas otwarte – wchodzisz od razu do trwającej gry, bez kolejki i bez końca meczu.
  Najwyżej 20 graczy; przy komplecie lobby jest **pełne** (kafelek w lobby gry pokazuje `n/20`, serwer nie wpuszcza 21.).
  Pokój powstaje przy pierwszym graczu (losowa mapa) i znika, gdy wyjdzie ostatni.
- **Broń za zabójstwa:** Glock-17 → Desert Eagle → SPAS-12 → MP5K → AKM → M4A1; każde zabójstwo od razu daje następną (pełny magazynek),
  śmierć cofa na Glocka. Pierwsze miejsce w rankingu (zabójstwa, potem obrażenia) = **WANTED** (czerwona czaszka nad postacią i na minimapie).
- **Śmierć:** ekran WASTED, potem małym drukiem: **Spacja** – odrodzenie, **Esc** – wyjście do lobby.
  Kto zostanie na ekranie śmierci dłużej niż 2 min, wraca do lobby sam (zwalnia miejsce).
- **Panel admina → Deathmatch:** liczby trybu (gracze, czasy, statystyki broni, mapy).
- **Boty testowe:** `node narzedzia/dm-boty.mjs 22 http://127.0.0.1:8787 60` – zakładają konta, wchodzą do lobby (20 wejdzie, 2 dostaną „pełne”),
  grają 60 s i wypisują wynik.
- Dawny sklep po śmierci (broń i pancerz za kasę meczu) jest zachowany w gicie na gałęzi `archiwum/dm-sklep-po-smierci`.

Sterowanie w Deathmatch: jak wyżej, do tego Tab – tabela wyników, G – emotka (machanie / taniec / radość); na ekranie śmierci Spacja – odrodzenie, Esc – lobby.

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
| `index.html` + `gra/` | zbudowana gra: strona i pliki gry (kod podzielony na części, modele `.glb`, zdjęcia map `.jpg`) |
| `zrodla/` | pliki źródłowe gry, osobne moduły (tak jak w artefakcie gry na claude.ai) |
| `narzedzia/build_game.mjs` | skrypt, który składa `zrodla/` w `index.html` + `gra/` (esbuild; `--offline` = jeden plik) |
| `narzedzia/assety/odchudz-bronie.mjs` | odchudza gotowe modele broni (tekstury 384–512 px, uproszczone siatki, meshopt) |
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
npm run build            # index.html + gra/
npm run build:offline    # gra-offline.html (wszystko w jednym pliku)
```

Płynność: rozdzielczość renderu dopasowuje się sama (jak w CryptoStrike) – gdy klatki są wolniejsze niż ok. 45 FPS,
gra renderuje mniej pikseli (do 0,55 ekranu), a gdy jest zapas, wraca do pełnej ostrości. Serwer VPS trzyma pliki gry w pamięci,
kompresuje je raz (brotli/gzip) i nie czyta dysku przy każdym wejściu, więc nowi gracze nie przycinają trwających meczów.

Źródło: artefakt gry na claude.ai, wersja z 13.11.2026 (Strzelnica w kolorystyce lobby: wersja 52). Zawiera zmiany ze wszystkich czatów:
mapy Oaza (poprawki kolizji i okien), Magazyn, Baza i Strzelnica, mecz 1v1, nowe lobby i choreografie oglądania broni.
