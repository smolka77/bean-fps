// Zrzuty ekranu map Vice z przeglądarki bez okna (Edge/Chrome headless, WebGL programowy) – do oglądania map bez otwierania gry.
// Wymaga działającego serwera: node narzedzia/podglad-serwer.mjs 8123
// Użycie:
//   node narzedzia/zrzut-mapy.mjs <mapa> <plik.png> [zapytanie]           np.  sunset out.png "pos=0,1.7,0&rot=90,0"
//   node narzedzia/zrzut-mapy.mjs --batch <widoki.json> <folder>           widoki: [{ "map": "sunset", "name": "ulica", "q": "pos=..&rot=..", "w": 1280, "h": 720 }]
// Zapytanie: pos=x,y,z (oko kamery), rot=yaw,pitch (stopnie; yaw 0 = patrzenie w -Z, 90 = w -X), fov=75, cols (kolizje), beans (fasolki na spawnach), spawn=N
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BROWSERS = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'];
const exe = BROWSERS.find((b) => fs.existsSync(b));
if (!exe) throw new Error('Nie znaleziono Edge ani Chrome');
const port = process.env.PORT || 8123;

// jedna przeglądarka naraz (równoległe Edge bez okna gubią zrzuty): blokada w pliku, wspólna dla wszystkich procesów
const LOCK = path.join(os.tmpdir(), 'vice-zrzut.lock');
async function lock() {
  for (;;) {
    try { fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' }); return; } catch {}
    try { if (Date.now() - fs.statSync(LOCK).mtimeMs > 60000) fs.rmSync(LOCK, { force: true }); } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
}
const unlock = () => { try { fs.rmSync(LOCK, { force: true }); } catch {} };
async function shot(map, out, q = '', w = 1280, h = 720, i = 0) {
  await lock();
  try { return await shot1(map, out, q, w, h, i); } finally { unlock(); }
}
function shot1(map, out, q = '', w = 1280, h = 720, i = 0) {
  return new Promise((resolve) => {
    const prof = path.join(os.tmpdir(), 'vice-zrzut-' + process.pid + '-' + i);
    const url = `http://localhost:${port}/zrodla/podglad-map.html?map=${map}&shot=1&${q}`;
    // WebGL na GPU (ANGLE/D3D11) – ok. 3 s na zrzut; programowy SwiftShader (VICE_SW=1) działa wszędzie, ale ~100 s
    const gl = process.env.VICE_SW ? ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] : ['--use-angle=d3d11', '--enable-gpu'];
    const args = ['--headless=new', ...gl, '--ignore-gpu-blocklist', '--hide-scrollbars', '--mute-audio', '--no-first-run',
      `--window-size=${w},${h}`, `--virtual-time-budget=${process.env.VICE_SW ? 9000 : 15000}`, `--user-data-dir=${prof}`, `--screenshot=${path.resolve(out)}`, url];
    const t0 = Date.now();
    execFile(exe, args, { timeout: 180000 }, (err) => {
      try { fs.rmSync(prof, { recursive: true, force: true }); } catch {}
      const ok = fs.existsSync(out);
      console.log(`${ok ? 'OK ' : 'BŁĄD'} ${out}  (${((Date.now() - t0) / 1000).toFixed(0)} s)${err && !ok ? ' ' + err.message : ''}`);
      resolve(ok);
    });
  });
}

const a = process.argv.slice(2);
if (a[0] === '--batch') {
  const views = JSON.parse(fs.readFileSync(a[1], 'utf8')), dir = a[2] || '.'; fs.mkdirSync(dir, { recursive: true });
  const par = 1;
  let next = 0; const run = async (k) => { while (next < views.length) { const i = next++, v = views[i]; await shot(v.map, path.join(dir, (v.name || 'widok' + i) + '.png'), v.q || '', v.w || 1280, v.h || 720, k * 1000 + i); } };
  await Promise.all(Array.from({ length: par }, (_, k) => run(k)));
} else {
  if (a.length < 2) { console.log('Użycie: node narzedzia/zrzut-mapy.mjs <mapa> <plik.png> [zapytanie]'); process.exit(1); }
  await shot(a[0], a[1], a[2] || '');
}
