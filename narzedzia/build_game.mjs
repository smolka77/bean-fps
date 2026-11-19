// Składa Bean FPS (pliki z artefaktu gry) do wdrożenia.
//  • domyślnie: mały index.html + folder gra/ obok niego (kod podzielony na części, modele .glb, zdjęcia .jpg):
//    przy wejściu pobiera się tylko kod gry i lobby, mapy / dźwięki / tryby doczytują się w tle, a wszystkie pliki w gra/
//    mają w nazwie skrót treści, więc przeglądarka trzyma je w cache aż do następnej zmiany.
//  • --offline: jak dawniej, cała gra w jednym pliku HTML (three.js, mapy, bronie, zdjęcia w base64; działa z dysku dwuklikiem).
// Użycie: node build_game.mjs <folder_z_plikami_gry> <wynik.html> [--offline]
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), OFFLINE = args.includes('--offline');
const [srcDir, outFile] = args.filter((a) => !a.startsWith('--'));
if (!srcDir || !outFile) throw new Error('Użycie: node build_game.mjs <folder_gry> <wynik.html> [--offline]');
const outDir = path.join(path.dirname(path.resolve(outFile)), 'gra');   // pliki gry obok strony (tylko zwykły build)

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

// 0) skiny z kreatora NIE są wbudowywane w plik gry: lobby pobiera je przy starcie z ./skins.json (serwer, GitHub Pages).
//    Wcześniej leżały w obu plikach i każdy gracz pobierał je dwa razy. Gra otwarta z dysku (bez serwera) ma tylko skiny wbudowane.
wr('skins-data.js', '// skiny z kreatora wczytuje lobby z ./skins.json\nexport default [];\n');

// 1) skrypt modułu ze strony -> main.js
let html = rd('index.html');
const open = '<script type="module">';
const a = html.indexOf(open), b = html.indexOf('</script>', a);
if (a < 0 || b < 0) throw new Error('Nie znaleziono skryptu modułu w index.html');
wr('main.js', html.slice(a + open.length, b));
html = html.slice(0, a) + '@@BUNDLE@@' + html.slice(b + '</script>'.length);
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '');

// 2) mapy: dynamiczny import(M.src) -> mapa importów (w zwykłym buildzie każda mapa to osobny plik, pobierany w tle)
const maps = ['oaza', 'magazyn', 'baza', 'bunkier'];
patch('main.js', 'const MAPS=[', 'const MAP_MODS={' + maps.map((m) => `'./${m}-data.js':()=>import('./${m}-data.js')`).join(',') + '};\nconst MAPS=[');
patch('main.js', 'await import(M.src)', 'await MAP_MODS[M.src]()');

// 3) bronie: import(`./weapons/${id}.js`) -> mapa importów
const weapons = fs.readdirSync(path.join(work, 'weapons')).filter((f) => /^[a-z0-9]+\.js$/.test(f)).map((f) => f.slice(0, -3));
patch('weaponry.js', 'const MODELS = {};', 'const MODELS = {};\nconst WEAPON_MODS = {' + weapons.map((w) => `${w}: () => import('./weapons/${w}.js')`).join(', ') + '};');
patch('weaponry.js', 'await import(`./weapons/${id}.js`)', 'await WEAPON_MODS[id]()');

// 3b) zwykły build: modele GLB (base64 w *-glb.js i bean-data.js) jako osobne pliki binarne – o 1/3 mniejsze niż base64 i w cache przeglądarki
if (!OFFLINE) {
  const toFile = (jsFile, glbName) => {
    const s = rd(jsFile), m = s.match(/export default\s*['"]([A-Za-z0-9+/=]+)['"]/);
    if (!m) throw new Error(`Nie ma modelu base64 w ${jsFile}`);
    fs.writeFileSync(path.join(work, path.dirname(jsFile), glbName), Buffer.from(m[1], 'base64'));
    wr(jsFile, `import url from './${glbName}';\nexport default new URL(url, import.meta.url).href;\n`);   // ścieżka względem pliku w gra/
  };
  for (const f of fs.readdirSync(path.join(work, 'weapons')).filter((f) => f.endsWith('-glb.js'))) toFile(`weapons/${f}`, f.replace('-glb.js', '.glb'));
  toFile('bean-data.js', 'fasolka.glb');
  patch('main.js', 'const bytes=Uint8Array.from(atob(glbB64),c=>c.charCodeAt(0));', 'const bytes=new Uint8Array(await(await fetch(glbB64)).arrayBuffer());');
}

// 4) zdjęcia map w lobby: new URL('./maps/x.jpg', import.meta.url) -> plik obok gry albo data-URI (offline)
const imgs = fs.readdirSync(path.join(work, 'maps')).filter((f) => f.endsWith('.jpg'));
let ui = rd('lobby-ui.js');
const imports = imgs.map((f, i) => `import __IMG${i} from './maps/${f}';`).join('\n');
imgs.forEach((f, i) => { ui = ui.split(`new URL('./maps/${f}', import.meta.url)`).join(OFFLINE ? `new URL(__IMG${i})` : `new URL(__IMG${i}, import.meta.url)`); });
if (ui.includes("new URL('./maps/")) throw new Error('lobby-ui.js nadal używa import.meta.url');
wr('lobby-ui.js', imports + '\n' + ui);

// 5) bundel
const common = {
  entryPoints: [path.join(work, 'main.js')], bundle: true, format: 'esm', target: 'es2022', minify: true,
  nodePaths: [path.join(here, 'node_modules')], legalComments: 'none', logLevel: 'warning',
};
const bad = (js) => { for (const s of ['import(M.src)', 'cdn.jsdelivr', ...(OFFLINE ? ['import.meta.url'] : [])]) if (js.includes(s)) console.warn('UWAGA: w bundlu zostało', s); };
let body, info;
if (OFFLINE) {
  const res = await build({ ...common, write: false, loader: { '.jpg': 'dataurl' } });
  const js = res.outputFiles[0].text; bad(js);
  body = '<script type="module">\n' + js.replace(/<\/script/gi, '<\\/script') + '\n</script>';
  html = html.replace(/^<!doctype html>/i, '<!doctype html>\n<!-- Bean FPS — cała gra w jednym pliku (three.js, mapy, bronie, lobby). Otwórz dwuklikiem w Chrome/Edge/Firefox. -->');
} else {
  fs.rmSync(outDir, { recursive: true, force: true });
  const res = await build({
    ...common, splitting: true, outdir: outDir, write: true, metafile: true,
    entryNames: 'gra-[hash]', chunkNames: 'c-[hash]', assetNames: '[name]-[hash]',
    loader: { '.jpg': 'file', '.glb': 'file' },
  });
  const outs = res.metafile.outputs, rel = (p) => path.relative(path.dirname(path.resolve(outFile)), path.resolve(p)).split(path.sep).join('/');
  const entry = Object.keys(outs).find((p) => /(^|[\\/])gra-[A-Z0-9]+\.js$/.test(p));   // główny plik (pozostałe części mają przedrostek c-)
  for (const p of Object.keys(outs)) if (p.endsWith('.js')) bad(fs.readFileSync(p, 'utf8'));
  // pliki potrzebne od razu (statyczne importy głównego pliku) – przeglądarka pobiera je równolegle
  const pre = (outs[entry].imports || []).filter((i) => i.kind === 'import-statement' && !i.external).map((i) => `<link rel="modulepreload" href="${rel(i.path)}">`);
  body = pre.join('') + `<script type="module" src="${rel(entry)}"></script>`;
  html = html.replace(/^<!doctype html>/i, '<!doctype html>\n<!-- Bean FPS — strona gry; kod, mapy, bronie i zdjęcia leżą w gra/ (nazwy ze skrótem treści – cache przeglądarki). -->');
  const sum = (f) => Object.keys(outs).filter(f).reduce((s, p) => s + outs[p].bytes, 0), MB = (n) => (n / 1048576).toFixed(2) + ' MB';
  const startIds = new Set([entry, ...(outs[entry].imports || []).filter((i) => i.kind === 'import-statement').map((i) => i.path)]);
  info = `start ${MB(sum((p) => startIds.has(p)))}, razem w gra/ ${MB(sum(() => true))} (${Object.keys(outs).length} plików)`;
}
html = html.replace('@@BUNDLE@@', () => body);
fs.writeFileSync(outFile, html);
// kreator skinów (panel admina otwiera go w okienku) leży obok gry
if (fs.existsSync(path.join(srcDir, 'kreator-skinow.html'))) fs.copyFileSync(path.join(srcDir, 'kreator-skinow.html'), path.join(path.dirname(outFile), 'kreator-skinow.html'));
console.log('OK', outFile, (Buffer.byteLength(html) / 1048576).toFixed(2) + ' MB', info || '(jeden plik)', 'bronie:', weapons.join(','), 'zdjęcia:', imgs.length);
