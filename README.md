# Bean FPS

Strzelanka FPS z fasolką (three.js). **Zagraj w przeglądarce: https://smolka77.github.io/bean-fps/**

Cała gra jest w **jednym pliku: [`index.html`](index.html)**.
Pobierz go i otwórz dwuklikiem w Chrome, Edge albo Firefoksie. Działa bez serwera i bez internetu.

## Co jest w środku

- **Lobby:** konto i testowy portfel USDT (zapisywane w przeglądarce), stawki, losowanie mapy, skiny, ustawienia (dźwięk, FOV, język).
- **Tryby:**
  - **Strzelnica:** trening solo z celami-fasolkami i tablicą ustawień.
  - **1v1:** mecz z botem do 3 wygranych rund, na jednej z trzech map.
- **Mapy:** Oaza, Magazyn, Baza, Strzelnica.
- **Bronie:** AK-47, M4A1-S, Glock-18, USP-S (z oglądaniem broni pod klawiszem F).

Sterowanie: WASD ruch, Shift bieg, Spacja skok, C kucanie/slide, LPM strzał, PPM celowanie, R przeładowanie,
F oglądanie broni, 1–4 / kółko zmiana broni, V widok, M dźwięk, Esc pauza.

## Struktura

| Ścieżka | Co to jest |
|---|---|
| `index.html` | gotowa gra w jednym pliku (three.js r170, moduły, mapy i zdjęcia map wbudowane) |
| `zrodla/` | pliki źródłowe gry, osobne moduły (tak jak w artefakcie gry na claude.ai) |
| `narzedzia/build_game.mjs` | skrypt, który skleja `zrodla/` w `index.html` (esbuild) |

## Przebudowanie po zmianach w `zrodla/`

```bash
cd narzedzia
npm install
npm run build
```

Źródło: artefakt gry na claude.ai, wersja z 13.11.2026. Zawiera zmiany ze wszystkich czatów:
mapy Oaza (poprawki kolizji i okien), Magazyn, Baza i Strzelnica, mecz 1v1, nowe lobby i choreografie oglądania broni.
