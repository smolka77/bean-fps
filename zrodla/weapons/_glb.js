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
