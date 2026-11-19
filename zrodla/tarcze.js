// Papierowe tarcze strzeleckie w kształcie fasolki (Strzelnica w bunkrze): biały karton z pierścieniami, czerwony środek,
// strefa głowy z oczami fasolki (powyżej 1,12 m od stóp = trafienie w głowę, jak u fasolek w grze) i stojak z betonową podstawą.
// Używają ich mapa bunkra (tarcze-dekoracje, wiszące i stojące) i range.js (tarcze, do których się strzela).
import * as THREE from 'three';

export const PAPER = { w: 0.82, h: 1.5, y0: 0.3 };       // szerokość, wysokość i spód kartonu nad podłogą (m)
let TEX = null, GEO = null;

function capsule(x, y, w, h) {                             // obrys fasolki: prostokąt z półkolami u góry i u dołu
  const r = w / 2, s = new THREE.Shape();
  s.moveTo(x - r, y + r); s.lineTo(x - r, y + h - r);
  s.absarc(x, y + h - r, r, Math.PI, 0, true);
  s.lineTo(x + r, y + r);
  s.absarc(x, y + r, r, 0, Math.PI, true);
  return s;
}

function paperTexture() {
  if (TEX) return TEX;
  const W = 256, H = Math.round((W * PAPER.h) / PAPER.w), cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d'), cap = (x, y, w, h) => { const r = w / 2; c.beginPath(); c.moveTo(x - r, y + r); c.lineTo(x - r, y + h - r); c.arc(x, y + h - r, r, Math.PI, 0, true); c.lineTo(x + r, y + r); c.arc(x, y + r, r, 0, Math.PI, true); c.closePath(); };
  // canvas: y w dół, więc „dół” fasolki to duże y
  c.fillStyle = '#f1f0ea'; c.fillRect(0, 0, W, H);
  c.save(); c.translate(0, H); c.scale(1, -1);             // od tej chwili y rośnie w górę (jak na tarczy)
  cap(W / 2, 10, W - 20, H - 20); c.fillStyle = '#dcdcd4'; c.fill(); c.lineWidth = 7; c.strokeStyle = '#2c3038'; c.stroke();
  const bx = W / 2, by = H * 0.33;                          // środek pierścieni: brzuch fasolki
  c.lineWidth = 3; c.strokeStyle = '#7a7d84';
  for (const k of [0.9, 0.72, 0.54, 0.36]) { c.beginPath(); c.ellipse(bx, by, W * 0.42 * k, W * 0.5 * k, 0, 0, Math.PI * 2); c.stroke(); }
  c.fillStyle = '#d6342c'; c.beginPath(); c.ellipse(bx, by, W * 0.13, W * 0.16, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#f1f0ea'; c.beginPath(); c.ellipse(bx, by, W * 0.04, W * 0.05, 0, 0, Math.PI * 2); c.fill();
  const hy = H * ((1.12 - PAPER.y0) / PAPER.h);             // granica strefy głowy
  c.setLineDash([10, 8]); c.strokeStyle = '#2c3038'; c.lineWidth = 3; c.beginPath(); c.moveTo(22, hy); c.lineTo(W - 22, hy); c.stroke(); c.setLineDash([]);
  const ey = H * 0.8;                                       // oczy fasolki
  for (const ex of [W / 2 - 34, W / 2 + 34]) {
    c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(ex, ey, 22, 30, 0, 0, Math.PI * 2); c.fill(); c.lineWidth = 4; c.strokeStyle = '#2c3038'; c.stroke();
    c.fillStyle = '#16171b'; c.beginPath(); c.ellipse(ex, ey - 6, 11, 15, 0, 0, Math.PI * 2); c.fill();
  }
  c.strokeStyle = '#d6342c'; c.lineWidth = 4; c.beginPath(); c.ellipse(W / 2, ey, 78, 52, 0, 0, Math.PI * 2); c.stroke();
  c.restore();
  c.fillStyle = '#2c3038'; c.font = '700 22px system-ui, sans-serif'; c.textAlign = 'center';
  c.fillText('10', bx, H - by + 8); c.fillText('5', bx + W * 0.33, H - by + 8); c.fillText('5', bx - W * 0.33, H - by + 8);
  TEX = new THREE.CanvasTexture(cv); TEX.colorSpace = THREE.SRGBColorSpace; TEX.anisotropy = 4;
  return TEX;
}

export function paperGeometry() {
  if (GEO) return GEO;
  const { w, h, y0 } = PAPER, g = new THREE.ShapeGeometry(capsule(0, y0, w, h), 10), P = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < P.count; i++) uv.setXY(i, (P.getX(i) + w / 2) / w, (P.getY(i) - y0) / h);
  g.rotateY(Math.PI);                                        // przodem do -Z (jak fasolki)
  GEO = g; return g;
}
export const paperMaterial = () => new THREE.MeshStandardMaterial({ map: paperTexture(), side: THREE.DoubleSide, roughness: 0.92 });

let STAND = null;
const standMats = () => STAND || (STAND = {
  steel: new THREE.MeshStandardMaterial({ color: '#3a3f48', roughness: 0.6, metalness: 0.4 }),
  base: new THREE.MeshStandardMaterial({ color: '#5d7a80', roughness: 0.85, flatShading: true }),
});
// stojak: betonowa podstawa (jak klocek) i dwie listwy trzymające karton
export function makeStand() {
  const M = standMats(), g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.24, 0.46), M.base); base.position.set(0, 0.12, 0.04);
  g.add(base);
  for (const x of [-0.3, 0.3]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.045, PAPER.y0 + 0.55, 0.045), M.steel); l.position.set(x, (PAPER.y0 + 0.55) / 2 + 0.1, 0.03); g.add(l); }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.05), M.steel); bar.position.set(0, PAPER.y0 + 0.06, 0.035); g.add(bar);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
// cała tarcza: karton (osobny materiał – może błysnąć po trafieniu) + stojak
export function makePaperTarget({ stand = true } = {}) {
  const group = new THREE.Group(), mat = paperMaterial(), paper = new THREE.Mesh(paperGeometry(), mat);
  paper.castShadow = true; paper.receiveShadow = true; group.add(paper);
  if (stand) group.add(makeStand());
  return { group, paper, mat };
}
