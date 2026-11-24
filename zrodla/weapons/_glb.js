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
      (drop(c, _n, _a, _b, _c) ? gone : keep).push(ia, ib, ic);
    }
    if (!gone.length) return;
    g.setIndex(keep); g.computeBoundingSphere();
    removed.push({ mesh: o, idx: gone });
  });
  return removed;
}
const count = (removed) => removed.reduce((s, q) => s + q.idx.length / 3, 0);
const inBox = ([x0, y0, z0, x1, y1, z1]) => (c) => c.x > x0 && c.x < x1 && c.y > y0 && c.y < y1 && c.z > z0 && c.z < z1;
// otwór o promieniu r wokół linii celowania w zakresie z (model miał dziurkę < 1 mm – nie dało się przez nią celować):
// znika każdy trójkąt, który choć jednym punktem (wierzchołek, środek krawędzi, środek) sięga do otworu – duże trójkąty
// nie zostają w środku przeziernika
const _m = new THREE.Vector3();
export function carveSight(nodes, { y, r, z0, z1 }) {
  const near = (p) => Math.hypot(p.x, p.y - y) < r;
  return count(filterTris(nodes.body, (c, n, a, b, d) => c.z > z0 && c.z < z1 &&
    (near(c) || near(a) || near(b) || near(d) || near(_m.addVectors(a, b).multiplyScalar(0.5)) || near(_m.addVectors(b, d).multiplyScalar(0.5)) || near(_m.addVectors(a, d).multiplyScalar(0.5)))));
}
// usuwa trójkąty w pudełku [x0,y0,z0,x1,y1,z1] – np. znak celowniczy narysowany w teksturze modelu (rozmyty i nie na linii celowania)
export const dropBox = (nodes, box) => count(filterTris(nodes.body, inBox(box)));
// grupa w układzie broni, doczepiona do węzła korpusu (klonuje się razem z nim do każdej instancji broni)
function bodySpace(nodes, name) {
  const body = nodes.body, g = new THREE.Group(); g.name = name;
  body.updateMatrixWorld(true); new THREE.Matrix4().copy(body.matrixWorld).invert().decompose(g.position, g.quaternion, g.scale);
  body.add(g); return g;
}
// przeziernik pierścieniowy wytoczony na czysto (przód w z, grubość depth, otwór r, zewnętrzny promień outer) –
// zakrywa poszarpane brzegi po carveSight na ściance, w której siedzi; stem – płaska stopka pod pierścieniem
// (szerokość pierścienia, stem metrów w dół od osi), zasłania ściankę wyciętą razem z dużymi trójkątami
export function peepSight(nodes, { y, z, depth, r, outer, stem = 0, color = 0x2b2c30 }) {
  const g = bodySpace(nodes, 'peep');
  const face = new THREE.MeshStandardMaterial({ name: 'gun:peep', color, roughness: 0.45, metalness: 0.55 });
  const bore = new THREE.MeshStandardMaterial({ name: 'gun:peep-bore', color: 0x0c0c0d, roughness: 0.9, metalness: 0, side: THREE.BackSide });
  const add = (geo, mat, at, flip) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(0, y, at); if (flip) m.rotation.y = Math.PI;
    m.userData.gear = true; m.castShadow = false; g.add(m);
  };
  add(new THREE.RingGeometry(r, outer, 56), face, z, false);                   // przód pierścienia (do oka, normalna +Z)
  add(new THREE.RingGeometry(r, outer, 56), face, z - depth, true);            // tył pierścienia (normalna −Z)
  add(new THREE.CylinderGeometry(outer, outer, depth, 56, 1, true).rotateX(Math.PI / 2), face, z - depth / 2, false);   // obwód
  add(new THREE.CylinderGeometry(r, r, depth, 56, 1, true).rotateX(Math.PI / 2), bore, z - depth / 2, false);           // wnętrze otworu
  if (stem) {   // stopka: prostokąt pod osią z półkolistym wycięciem na otwór, tuż za przodem pierścienia
    const s = new THREE.Shape().moveTo(-outer, 0).lineTo(-r, 0).absarc(0, 0, r, Math.PI, Math.PI * 2, false)
      .lineTo(outer, 0).lineTo(outer, -stem).lineTo(-outer, -stem).lineTo(-outer, 0);
    const plate = new THREE.MeshStandardMaterial({ name: 'gun:peep-stem', color, roughness: 0.45, metalness: 0.55, side: THREE.DoubleSide });
    add(new THREE.ShapeGeometry(s, 24), plate, z - depth / 2, false);
  }
  return g;
}
// szybka kolimatora: trójkąty w pudełku [x0,y0,z0,x1,y1,z1] wychodzą z korpusu do osobnej, przezroczystej siatki (gear – skiny jej nie malują)
export function glassLens(nodes, box, { color = 0x9a90ff, opacity = 0.16 } = {}) {
  const mat = new THREE.MeshStandardMaterial({ name: 'gun:lens', color, roughness: 0.04, metalness: 0.1, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
  let n = 0;
  const body = nodes.body, inv = new THREE.Matrix4().copy(body.matrixWorld).invert();
  for (const { mesh, idx } of filterTris(body, inBox(box))) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', mesh.geometry.attributes.position); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.name = 'lens'; m.userData.gear = true; m.renderOrder = 3; m.castShadow = false;
    // szkło jest dzieckiem węzła korpusu (klonuje się razem z nim do każdej instancji broni), w miejscu siatki, z której wyszło
    new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld).decompose(m.position, m.quaternion, m.scale);
    body.add(m); n += idx.length / 3;
  }
  return n;
}
// znak celowniczy na linii celowania (z – płaszczyzna znaku, size – bok kwadratu w metrach):
//  'holo' – cienkie kółko z małą kropką (proporcje kolimatora holograficznego: kółko = 0,78 boku),
//  'dot'  – mała, ostra czerwona kropka (rdzeń = 0,17 boku) z delikatną poświatą
const RT = {};
function reticleTex(kind) {
  if (RT[kind]) return RT[kind];
  const S = kind === 'holo' ? 512 : 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const x = cv.getContext('2d'), C = S / 2;
  if (kind === 'holo') {
    x.strokeStyle = x.fillStyle = 'rgb(255,62,46)'; x.shadowColor = 'rgba(255,36,20,.85)'; x.shadowBlur = 7;
    x.lineWidth = 14; x.beginPath(); x.arc(C, C, 200, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.arc(C, C, 19, 0, Math.PI * 2); x.fill();
  } else {
    const g = x.createRadialGradient(C, C, 0, C, C, C);
    g.addColorStop(0, 'rgba(255,190,170,1)'); g.addColorStop(0.1, 'rgba(255,72,50,1)'); g.addColorStop(0.17, 'rgba(255,50,32,.9)');
    g.addColorStop(0.23, 'rgba(255,40,24,.16)'); g.addColorStop(0.5, 'rgba(255,40,24,.035)'); g.addColorStop(1, 'rgba(255,40,24,0)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
  }
  // premultiplied alpha: mipmapy bez ciemnej obwódki na przezroczystym tle (znak jest mały na ekranie)
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.premultiplyAlpha = true; t.anisotropy = 4;
  return (RT[kind] = t);
}
export function reticle(kind, y, z, size) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: reticleTex(kind), transparent: true, premultipliedAlpha: true, depthWrite: false, fog: false, toneMapped: false }));
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
