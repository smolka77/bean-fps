// SPAS-12 – model GLB „Half-Life 2 RTX Shotgun (Spas-12)” (carrilloriscomatias, Sketchfab, CC-BY 4.0).
// Ustawienie, skala i czółenko (kość szkieletu modelu): narzedzia/assety/przygotuj-bronie.mjs. Bez kolby – oko przy celowaniu: eyeZ.
// „Magazynek” dla animacji przeładowania = pojedynczy nabój wsuwany oknem ładowania (w spoczynku schowany w komorze),
// magWell leży 0,1 m nad oknem (weaponry.js trzyma lewą dłoń w magWell + 0,1 · kierunek wysuwania).
import * as THREE from 'three';
import { V3, loadGlb, assemble } from './_glb.js';
import GLB from './spas12-glb.js';

const MAG_DIR = V3(0, -1, 0.18).normalize();
const PORT = V3(0, 0.053, -0.337), WELL = PORT.clone().addScaledVector(MAG_DIR, -0.1), SHELL = V3(0, 0.085, -0.337);
let N = null, G = null;
export const ready = loadGlb(GLB).then((n) => { N = n; });
function shell() {
  if (G) return G;
  const hull = new THREE.CylinderGeometry(0.0102, 0.0102, 0.062, 16).rotateX(Math.PI / 2);
  const head = new THREE.CylinderGeometry(0.0109, 0.0109, 0.012, 16).rotateX(Math.PI / 2).translate(0, 0, 0.031);
  return G = { hull, head, mHull: new THREE.MeshStandardMaterial({ color: 0xa61d16, roughness: 0.45 }), mHead: new THREE.MeshStandardMaterial({ color: 0xd2a84c, metalness: 1, roughness: 0.3 }) };
}
export function build() {
  return assemble(N, {
    id: 'spas12', name: 'SPAS-12', hands: 'rifle',
    anchors: {
      gripR: V3(0, 0, 0),
      gripL: V3(0, 0.038, -0.487),                 // pod czółenkiem
      muzzle: V3(0, 0.112, -0.777),
      sightRear: V3(0, 0.138, -0.267),             // nad grzbietem komory → muszka
      sightFront: V3(0, 0.138, -0.757),
      magWell: WELL,
      ejectPort: V3(0.025, 0.105, -0.3),
      stockEnd: V3(0, 0.02, 0.043),
    },
    boreY: 0.112, flashScale: 1.5, pumpStroke: 0.075, eyeZ: 0.06,
    extra(g, parts) {                              // nabój do animacji przeładowania
      const S = shell(), mag = new THREE.Group(); mag.name = 'mag'; mag.position.copy(WELL); g.add(mag);
      const off = SHELL.clone().sub(WELL);
      for (const [geo, mat] of [[S.hull, S.mHull], [S.head, S.mHead]]) { const m = new THREE.Mesh(geo, mat); m.position.copy(off); m.castShadow = true; mag.add(m); }
      parts.mag = mag;
    },
  });
}
