// Dodaje skin(y) z kreatora skinów do gry: wpisuje je do zrodla/skins-data.js (ten sam id = podmiana).
// Użycie: node dodaj-skin.mjs skin-abc.json [skin-def.json ...]      (usuwanie: --usun <id>)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.join(here, '..', 'zrodla', 'skins-data.js');
const lobbyFile = path.join(here, '..', 'zrodla', 'lobby.js');
const HEAD = '// Skiny zrobione w kreatorze skinów (kreator-skinow/index.html), jeden skin na linię.\n// Dodawanie: node narzedzia/dodaj-skin.mjs ścieżka/do/skin-xxx.json\nexport default [\n';

const args = process.argv.slice(2);
if (!args.length) { console.log('Użycie: node dodaj-skin.mjs skin-abc.json [...]   |   node dodaj-skin.mjs --usun <id>'); process.exit(1); }

// obecne skiny: każda linia między "export default [" a "];" to jeden obiekt JSON z przecinkiem
const src = fs.existsSync(dataFile) ? fs.readFileSync(dataFile, 'utf8') : HEAD + '];\n';
const body = src.slice(src.indexOf('export default [') + 16, src.lastIndexOf('];'));
const skins = body.split('\n').map((l) => l.trim().replace(/,$/, '')).filter(Boolean).map((l) => JSON.parse(l));
const builtIn = [...fs.readFileSync(lobbyFile, 'utf8').matchAll(/\{ id: '([a-z0-9-]+)', name:/g)].map((m) => m[1]);

if (args[0] === '--usun') {
  const id = args[1], n = skins.length;
  const left = skins.filter((s) => s.id !== id);
  if (left.length === n) { console.error(`Nie ma skina "${id}". Są: ${skins.map((s) => s.id).join(', ') || '(brak)'}`); process.exit(1); }
  skins.splice(0, skins.length, ...left); console.log(`Usunięto ${id}`);
} else {
  for (const f of args) {
    const d = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (d.format !== 'fasolka-skin') throw new Error(`${f}: to nie jest plik z kreatora skinów`);
    if (d.version !== 1) throw new Error(`${f}: nieznana wersja formatu ${d.version}`);
    if (d.tex && (!d.proj || !['cylinder-y', 'arc-y'].includes(d.proj.type))) throw new Error(`${f}: brak mapowania proj`);
    if (d.proj && d.proj.type === 'arc-y' && (!Array.isArray(d.proj.vmap) || d.proj.vmap.length !== 129)) throw new Error(`${f}: zła tablica vmap`);
    if (!/^[a-z0-9-]+$/.test(d.id || '')) throw new Error(`${f}: złe id "${d.id}"`);
    if (builtIn.includes(d.id)) d.id += '-k';                       // nie nadpisujemy wbudowanych skinów
    const skin = { id: d.id, name: d.name || d.id, c: d.c || '#ffffff', eyes: d.eyes !== false, tag: d.tag || 'WŁASNY',
      ...(d.tex ? { tex: d.tex, proj: d.proj } : {}), ...(d.icon ? { icon: d.icon } : {}) };
    const i = skins.findIndex((s) => s.id === skin.id);
    if (i >= 0) skins[i] = skin; else skins.push(skin);
    console.log(`${i >= 0 ? 'Podmieniono' : 'Dodano'}: ${skin.id} (${skin.name}), ${Math.round(JSON.stringify(skin).length / 1024)} KB`);
  }
}
fs.writeFileSync(dataFile, HEAD + skins.map((s) => JSON.stringify(s) + ',\n').join('') + '];\n');
fs.writeFileSync(path.join(here, '..', 'skins.json'), '[\n' + skins.map((s) => JSON.stringify(s)).join(',\n') + '\n]\n');   // to czyta gra na stronie
console.log(`skins-data.js: ${skins.length} skin(ów). Teraz: npm run build`);
