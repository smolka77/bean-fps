// LOKALNA wersja gry z botem do oglądania map (nie trafia na serwer ani do repo jako gra).
// Bierze ../zrodla, w kopii przywraca bota 1v1 (sprzed meczów online) i dodaje szybki start meczu
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

// 1) bot 1v1 (ten sam, który był w grze przed meczami z prawdziwymi graczami)
const BOT = `const _be=V3(),_bp=V3(),_bt=V3(),_bm=V3(),losRay=new THREE.Raycaster();
function stepDuelBot(e,dt){
  const r=e.root,ud=r.userData;
  if(e.flash>0){e.flash-=dt;e.mats.skin.emissive.setScalar(.9)}else e.mats.skin.emissive.setScalar(0);
  if(e.dead>0){
    if(!e.counted){e.counted=true;if(kills>=WIN){endMatch(true);return}banner('TRAFIONY!','#ffe14a')}
    e.dead-=dt;e.fall=Math.min(1,e.fall+dt*3);r.rotation.z=e.fall*(Math.PI/2);r.position.y=Math.sin(e.fall*Math.PI/2)*.28;
    if(e.dead<=0)duelSpawn(e);
    return;
  }
  const dx=player.pos.x-r.position.x,dz=player.pos.z-r.position.z,dist=Math.hypot(dx,dz)||1;
  _be.set(r.position.x,1.25,r.position.z);_bp.set(player.pos.x,player.pos.y+1.1-player.crouch*.4,player.pos.z);
  _bt.copy(_bp).sub(_be);const L=_bt.length();_bt.multiplyScalar(1/L);losRay.set(_be,_bt);losRay.far=L;
  const see=oaza.active?!segHitsBoxes(_be,_bp,oaza.boxes):losRay.intersectObjects(boxMeshes,false).length===0;
  let moving=0;
  if(playing){
    duel.inv=Math.max(0,duel.inv-dt);
    e.turn-=dt;if(e.turn<=0){e.turn=1.2+rnd()*2.2;e.strafe*=-1}
    const radial=clamp((dist-(see?13:6))*.25,-1,1);
    let mx=-dz/dist*e.strafe*.9+dx/dist*radial,mz=dx/dist*e.strafe*.9+dz/dist*radial;const ml=Math.hypot(mx,mz)||1;
    // ruch z kolizjami: najpierw pełny krok, potem ślizg wzdłuż ściany (osobno X i Z);
    // jeśli bot już stoi w marginesie przeszkody, pozwalamy na krok, który go z niej wyprowadza
    const ox=r.position.x,oz=r.position.z,sx=mx/ml*2.6*dt,sz=mz/ml*2.6*dt;
    const blocked=(x,z,m=.45)=>(oaza.active?(Math.abs(x)>oaza.bx||Math.abs(z)>oaza.bz):Math.hypot(x,z)>ARENA-2)||boxes.some(b=>x>b.minX-m&&x<b.maxX+m&&z>b.minZ-m&&z<b.maxZ+m&&b.top>.5&&!(b.bottom>1.6));
    const stuck=blocked(ox,oz);
    // w marginesie przy ścianie: można się przesuwać, byle nie wejść w samą przeszkodę
    const tryMove=(x,z)=>{if(!blocked(x,z)||(stuck&&!blocked(x,z,.3))){r.position.x=x;r.position.z=z;moving=1;return true}return false};
    if(!tryMove(ox+sx,oz+sz)&&!tryMove(ox+sx,oz)&&!tryMove(ox,oz+sz)){e.strafe*=-1;e.turn=1}
    e.react=see?e.react-dt:.55;e.cd-=dt;
    if(see&&e.react<=0&&e.cd<=0&&dist<45){
      e.cd=.32+rnd()*.35;
      const pHit=clamp(.62-dist*.011-player.speed01*.25-player.crouch*.1-(player.onGround?0:.15),.1,.6),hit=rnd()<pHit;
      e.rifle.muzzle.getWorldPosition(_bm);_bt.copy(_bp);if(!hit)_bt.add(V3((rnd()-.5)*2.2,(rnd()-.3)*1.4,(rnd()-.5)*2.2));
      spawnTracer(_bm,_bt);sndFar();if(hit)playerHit(rnd()<.18?24:12);
    }
  }
  r.rotation.y+=angDiff(Math.atan2(dx,dz)+Math.PI,r.rotation.y)*Math.min(1,dt*8);
  e.phase+=dt*9.7*moving;poseLegs(ud,e.phase,.42*moving,0,0);
  ud.upper.position.y=Math.abs(Math.sin(e.phase))*.03*moving;leanTorso(ud,-.04,0,Math.sin(e.phase)*.04*moving);
  e.holder.rotation.x=clamp(Math.atan2(_bp.y-1.0,dist),-.3,.3);e.holder.rotation.y=0;
  keepRifleOut(ud,e.rifle.group);r.updateWorldMatrix(true,true);
  _gr.copy(e.rifle.gripR);e.rifle.group.localToWorld(_gr);ud.torso.worldToLocal(_gr);
  _gl.copy(e.rifle.gripLTP);e.rifle.group.localToWorld(_gl);ud.torso.worldToLocal(_gl);
  poseArmsTo(ud,_gr,_gl);
}
const _ra=V3();`;
rep('const _ra=V3();', BOT);
rep('if(e===duel.bot)stepRemote(e,dt)', 'if(e===duel.bot)stepDuelBot(e,dt)');

// 2) szybki start: przyciski map na górze ekranu (bez lobby i logowania)
const LAUNCH = `
{const box=document.createElement('div');box.id='botpick';
 box.style.cssText='position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:50;display:flex;gap:8px;align-items:center;background:rgba(10,12,17,.85);border:1px solid rgba(255,255,255,.2);border-radius:10px;padding:8px 12px;font:600 13px system-ui;color:#fff';
 box.innerHTML='<span style="opacity:.75">Mecz z botem (lokalnie):</span>';
 const go=i=>{if(!MAPS[i].ready){box.querySelector('span').textContent='Wczytywanie '+MAPS[i].name+'…';setTimeout(()=>go(i),300);return}
   lobby.hide();document.body.classList.remove('in-lobby');setMode('1v1',i);startPlay();box.querySelector('span').textContent='Mecz z botem (lokalnie):'};
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
