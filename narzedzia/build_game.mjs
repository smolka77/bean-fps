// Składa Bean FPS (pliki z artefaktu gry) w jeden samodzielny plik HTML:
// three.js, wszystkie moduły, mapy (GLB w base64) i zdjęcia map są wbudowane; działa offline i bez serwera.
// Użycie: node build_game.mjs <folder_z_plikami_gry> <wynik.html>
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const [srcDir, outFile] = process.argv.slice(2);
if (!srcDir || !outFile) throw new Error('Użycie: node build_game.mjs <folder_gry> <wynik.html>');

// kopia robocza (łatki nie zmieniają oryginałów)
const work = path.join(here, 'work');
fs.rmSync(work, { recursive: true, force: true });
fs.cpSync(srcDir, work, { recursive: true });
const rd = (f) => fs.readFileSync(path.join(work, f), 'utf8');
const wr = (f, s) => fs.writeFileSync(path.join(work, f), s);
const patch = (f, from, to) => {
  const s = rd(f);
  if (!s.includes(from)) throw new Error(`Łatka nie pasuje w ${f}: ${from.slice(0, 60)}`);
  wr(f, s.split(from).join(to));
};

// 1) skrypt modułu ze strony -> main.js
let html = rd('index.html');
const open = '<script type="module">';
const a = html.indexOf(open), b = html.indexOf('</script>', a);
if (a < 0 || b < 0) throw new Error('Nie znaleziono skryptu modułu w index.html');
wr('main.js', html.slice(a + open.length, b));
html = html.slice(0, a) + '@@BUNDLE@@' + html.slice(b + '</script>'.length);
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '');

// 2) mapy: dynamiczny import(M.src) -> statyczne importy (esbuild wbudowuje je w plik)
const maps = ['oaza', 'magazyn', 'baza', 'strzelnica'];
patch('main.js', 'const MAPS=[', 'const MAP_MODS={' + maps.map((m) => `'./${m}-data.js':()=>import('./${m}-data.js')`).join(',') + '};\nconst MAPS=[');
patch('main.js', 'await import(M.src)', 'await MAP_MODS[M.src]()');

// 3) bronie: import(`./weapons/${id}.js`) -> mapa statycznych importów
const weapons = fs.readdirSync(path.join(work, 'weapons')).filter((f) => /^[a-z0-9]+\.js$/.test(f)).map((f) => f.slice(0, -3));
patch('weaponry.js', 'const MODELS = {};', 'const MODELS = {};\nconst WEAPON_MODS = {' + weapons.map((w) => `${w}: () => import('./weapons/${w}.js')`).join(', ') + '};');
patch('weaponry.js', 'await import(`./weapons/${id}.js`)', 'await WEAPON_MODS[id]()');

// 4) zdjęcia map w lobby: new URL('./maps/x.jpg', import.meta.url) -> data-URI
const imgs = fs.readdirSync(path.join(work, 'maps')).filter((f) => f.endsWith('.jpg'));
let ui = rd('lobby-ui.js');
const imports = imgs.map((f, i) => `import __IMG${i} from './maps/${f}';`).join('\n');
imgs.forEach((f, i) => { ui = ui.split(`new URL('./maps/${f}', import.meta.url)`).join(`new URL(__IMG${i})`); });
if (ui.includes('import.meta.url')) throw new Error('lobby-ui.js nadal używa import.meta.url');
wr('lobby-ui.js', imports + '\n' + ui);

// 5) bundel
const res = await build({
  entryPoints: [path.join(work, 'main.js')],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: true,
  write: false,
  loader: { '.jpg': 'dataurl' },
  nodePaths: [path.join(here, 'node_modules')],
  legalComments: 'none',
  logLevel: 'warning',
});
const js = res.outputFiles[0].text;
for (const bad of ['import(M.src)', 'import.meta.url', 'cdn.jsdelivr']) if (js.includes(bad)) console.warn('UWAGA: w bundlu zostało', bad);

const body = '<script type="module">\n' + js.replace(/<\/script/gi, '<\\/script') + '\n</script>';
html = html.replace('@@BUNDLE@@', () => body);
html = html.replace(/^<!doctype html>/i, '<!doctype html>\n<!-- Bean FPS — cała gra w jednym pliku (three.js, mapy, bronie, lobby). Otwórz dwuklikiem w Chrome/Edge/Firefox. -->');
fs.writeFileSync(outFile, html);
console.log('OK', outFile, (Buffer.byteLength(html) / 1048576).toFixed(2) + ' MB', 'bronie:', weapons.join(','), 'zdjęcia:', imgs.join(','));
