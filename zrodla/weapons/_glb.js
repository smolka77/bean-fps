// Bronie z modeli GLB (Sketchfab, CC-BY 4.0 – autorzy w README): wczytanie z base64 i złożenie instancji zgodnej
// z kontraktem broni (SPEC: group, parts, anchors, boreY, flashScale…). Modele przygotowuje narzedzia/assety/przygotuj-bronie.mjs:
// metry, lufa w −Z, góra +Y, początek = prawa dłoń na chwycie, ruchome części w węzłach „mag” / „slide” / „pump”.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const PARTS = ['body', 'mag', 'slide', 'pump'];

// base64 → węzły części modelu (raz na stronę; instancje to klony współdzielące siatki i materiały)
// src: base64 (gra w jednym pliku) albo ścieżka do pliku .glb (zwykły build: model leży obok gry i trafia do cache przeglądarki)
export async function loadGlb(src) {
  let buf;
  if (src.length < 2048 && /\.glb($|\?)/.test(src)) buf = await (await fetch(src)).arrayBuffer();
  else { const s = atob(src), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); buf = u.buffer; }
  const ld = new GLTFLoader(); ld.setMeshoptDecoder(MeshoptDecoder);
  const gl = await ld.parseAsync(buf, '');
  const nodes = {};
  gl.scene.traverse((o) => {
    if (PARTS.includes(o.name) && !nodes[o.name]) nodes[o.name] = o;
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; }
  });
  return nodes;
}

// ---------------- poprawki celowników (raz na model, przed składaniem instancji – siatki są współdzielone) ----------------
// Wszystkie liczby w układzie broni (metry, lufa w −Z, linia celowania: x = 0, y = sightRear.y), jak kotwice w <id>.js.
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3();
// przechodzi po trójkątach siatek węzła; drop(c, n) → true usuwa trójkąt (c – środek, n – normalna, układ broni); zwraca usunięte
function filterTris(root, drop) {
  const removed = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry, P = g.attributes.position, I = g.index, n = I ? I.count / 3 : P.count / 3, keep = [], gone = [];
    for (let t = 0; t < n; t++) {
      const ia = I ? I.getX(t * 3) : t * 3, ib = I ? I.getX(t * 3 + 1) : t * 3 + 1, ic = I ? I.getX(t * 3 + 2) : t * 3 + 2;
      _a.fromBufferAttribute(P, ia).applyMatrix4(o.matrixWorld); _b.fromBufferAttribute(P, ib).applyMatrix4(o.matrixWorld); _c.fromBufferAttribute(P, ic).applyMatrix4(o.matrixWorld);
      const c = new THREE.Vector3().add(_a).add(_b).add(_c).multiplyScalar(1 / 3);
      _n.subVectors(_b, _a).cross(_c.clone().sub(_a)).normalize();
      (drop(c, _n) ? gone : keep).push(ia, ib, ic);
    }
    if (!gone.length) return;
    g.setIndex(keep); g.computeBoundingSphere();
    removed.push({ mesh: o, idx: gone });
  });
  return removed;
}
// przeziernik: okrągły otwór o promieniu r wokół linii celowania w zakresie z (model miał dziurkę < 1 mm – nie dało się przez nią celować)
export function carveSight(nodes, { y, r, z0, z1 }) {
  return filterTris(nodes.body, (c) => c.z > z0 && c.z < z1 && Math.hypot(c.x, c.y - y) < r).reduce((s, q) => s + q.idx.length / 3, 0);
}
// szybka kolimatora: trójkąty w pudełku [x0,y0,z0,x1,y1,z1] wychodzą z korpusu do osobnej, przezroczystej siatki (gear – skiny jej nie malują)
export function glassLens(nodes, box, { color = 0x9a90ff, opacity = 0.16 } = {}) {
  const [x0, y0, z0, x1, y1, z1] = box, mat = new THREE.MeshStandardMaterial({ name: 'gun:lens', color, roughness: 0.04, metalness: 0.1, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
  let n = 0;
  const body = nodes.body, inv = new THREE.Matrix4().copy(body.matrixWorld).invert();
  for (const { mesh, idx } of filterTris(body, (c) => c.x > x0 && c.x < x1 && c.y > y0 && c.y < y1 && c.z > z0 && c.z < z1)) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', mesh.geometry.attributes.position); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.name = 'lens'; m.userData.gear = true; m.renderOrder = 3; m.castShadow = false;
    // szkło jest dzieckiem węzła korpusu (klonuje się razem z nim do każdej instancji broni), w miejscu siatki, z której wyszło
    new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld).decompose(m.position, m.quaternion, m.scale);
    body.add(m); n += idx.length / 3;
  }
  return n;
}
// świecący znak celowniczy na linii celowania (z – płaszczyzna znaku): 'dot' – czerwona kropka, 'holo' – kółko 65 MOA z kropką i kreskami
const RT = {};
function reticleTex(kind) {
  if (RT[kind]) return RT[kind];
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d'), C = 128;
  x.shadowColor = '#ff2a1a'; x.fillStyle = '#ff3b2a'; x.strokeStyle = '#ff3b2a';
  if (kind === 'holo') {
    x.shadowBlur = 10; x.lineWidth = 7; x.beginPath(); x.arc(C, C, 96, 0, Math.PI * 2); x.stroke();
    for (const [a, b] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { x.beginPath(); x.moveTo(C + a * 96, C + b * 96); x.lineTo(C + a * 120, C + b * 120); x.stroke(); }
    x.shadowBlur = 12; x.beginPath(); x.arc(C, C, 20, 0, Math.PI * 2); x.fill();
  } else {
    const g = x.createRadialGradient(C, C, 0, C, C, 64); g.addColorStop(0, 'rgba(255,120,100,1)'); g.addColorStop(0.3, 'rgba(255,45,30,1)'); g.addColorStop(0.36, 'rgba(255,35,25,.45)'); g.addColorStop(1, 'rgba(255,30,20,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return (RT[kind] = t);
}
export function reticle(kind, y, z, size) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: reticleTex(kind), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }));
  m.position.set(0, y, z); m.name = 'reticle'; m.userData.gear = true; m.renderOrder = 4; m.castShadow = false;
  return m;
}

// spec: { id, name, hands: 'rifle'|'pistol', anchors, boreY, flashScale, suppressed?, pumpStroke?, magDir?, eyeZ?, extra?(group, parts) }
//  magDir – kierunek wysuwania magazynka (układ broni; domyślnie z weaponry.js), eyeZ – gdzie jest oko przy celowaniu
//  (broń bez kolby; domyślnie kolba − 15 cm)
export function assemble(nodes, spec) {
  const g = new THREE.Group(), A = spec.anchors, parts = { mag: null, slide: null, pump: null };
  const put = (name, parent, pivot) => {
    const c = nodes[name].clone(true);
    if (pivot) c.position.sub(pivot);               // węzeł w układzie obrotnicy części (obrotnica = sam przesuw, bez obrotu)
    parent.add(c); return c;
  };
  const pivot = (name, at) => { const p = new THREE.Group(); p.name = name; if (at) p.position.copy(at); g.add(p); put(name, p, at); return p; };
  put('body', g);
  if (nodes.mag) parts.mag = pivot('mag', A.magWell);
  if (nodes.slide) parts.slide = pivot('slide');
  if (nodes.pump) parts.pump = pivot('pump');
  if (spec.extra) spec.extra(g, parts);
  const anchors = {}; for (const k in A) anchors[k] = A[k].clone();
  return {
    id: spec.id, name: spec.name, hands: spec.hands, suppressed: !!spec.suppressed, group: g, parts, anchors,
    boreY: spec.boreY, flashScale: spec.flashScale || 1, pumpStroke: spec.pumpStroke, magDir: spec.magDir || null, eyeZ: spec.eyeZ,
  };
}
