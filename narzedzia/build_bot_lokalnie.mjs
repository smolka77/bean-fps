// LOKALNA wersja gry z botem do oglądania map (nie trafia na serwer ani do repo jako gra).
// Bierze ../zrodla i dodaje szybki start meczu z botem
// na wybranej mapie bez lobby i logowania, potem skleja wszystko build_game.mjs w jeden plik.
// Użycie: node build_bot_lokalnie.mjs <wynik.html>
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.argv[2] || path.join(here, '..', 'gra-z-botem.html'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bean-bot-'));
fs.cpSync(path.join(here, '..', 'zrodla'), tmp, { recursive: true });
const f = path.join(tmp, 'index.html');
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('Nie pasuje: ' + a.slice(0, 70)); s = s.replace(a, () => b); };

// 1) bot jest już w grze (tryb „Z botem” w lobby) – tu tylko szybki start bez lobby

// 2) szybki start: przyciski map na górze ekranu (bez lobby i logowania)
const LAUNCH = `
{const box=document.createElement('div');box.id='botpick';
 box.style.cssText='position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:50;display:flex;gap:8px;align-items:center;background:rgba(10,12,17,.85);border:1px solid rgba(255,255,255,.2);border-radius:10px;padding:8px 12px;font:600 13px system-ui;color:#fff';
 box.innerHTML='<span style="opacity:.75">Mecz z botem (lokalnie):</span>';
 const go=i=>{if(!MAPS[i].ready){box.querySelector('span').textContent='Wczytywanie '+MAPS[i].name+'…';setTimeout(()=>go(i),300);return}
   BOT.on=true;lobby.hide();document.body.classList.remove('in-lobby');setMode('1v1',i);startPlay();box.querySelector('span').textContent='Mecz z botem (lokalnie):'};
 MAPS.forEach((M,i)=>{const b=document.createElement('button');b.textContent=M.name;b.style.cssText='font:700 13px system-ui;padding:6px 12px;border-radius:7px;border:0;background:#ffd400;color:#1a1405;cursor:pointer';b.onclick=e=>{e.stopPropagation();go(i)};box.appendChild(b)});
 document.body.appendChild(box);
 const want=new URLSearchParams(location.search).get('mapa');if(want){const i=MAPS.findIndex(M=>M.name.toLowerCase()===want.toLowerCase());if(i>=0)go(i)}}
</script>`;
const last = s.lastIndexOf('</script>');
s = s.slice(0, last) + LAUNCH + s.slice(last + '</script>'.length);
fs.writeFileSync(f, s);

execFileSync(process.execPath, [path.join(here, 'build_game.mjs'), tmp, out], { cwd: here, stdio: 'inherit' });
fs.rmSync(tmp, { recursive: true, force: true });
console.log('Gotowe:', out);
