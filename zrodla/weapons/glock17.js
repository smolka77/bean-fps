// Glock-17 – model GLB „9mm Pistol” (TORI106, Sketchfab, CC-BY 4.0). Ustawienie, skala i części: narzedzia/assety/przygotuj-bronie.mjs.
import { V3, loadGlb, assemble } from './_glb.js';
import GLB from './glock17-glb.js';

let N = null;
export const ready = loadGlb(GLB).then((n) => { N = n; });
export function build() {
  return assemble(N, {
    id: 'glock17', name: 'Glock-17', hands: 'pistol',
    anchors: {
      gripR: V3(0, 0, 0),
      gripL: V3(-0.019, -0.04, 0.015),
      muzzle: V3(0, 0.0445, -0.143),
      sightRear: V3(0, 0.059, 0.02),
      sightFront: V3(0, 0.059, -0.1325),
      magWell: V3(0, 0.02, -0.005),
      ejectPort: V3(0.008, 0.05, -0.03),
      stockEnd: V3(0, 0.02, 0.043),
    },
    boreY: 0.0445, flashScale: 0.6,
    magDir: V3(0, -1, 0.33),                       // magazynek wypada wzdłuż pochylonego chwytu
  });
}
