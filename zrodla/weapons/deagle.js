// Desert Eagle – model GLB „Desert Eagle” (Bagason, Sketchfab, CC-BY 4.0). Ustawienie, skala i części: narzedzia/assety/przygotuj-bronie.mjs.
import { V3, loadGlb, assemble } from './_glb.js';
import GLB from './deagle-glb.js';

let N = null;
export const ready = loadGlb(GLB).then((n) => { N = n; });
export function build() {
  return assemble(N, {
    id: 'deagle', name: 'Desert Eagle', hands: 'pistol',
    anchors: {
      gripR: V3(0, 0, 0),
      gripL: V3(-0.021, -0.04, 0.01),
      muzzle: V3(0, 0.043, -0.2055),
      sightRear: V3(0, 0.0725, 0.017),
      sightFront: V3(0, 0.0725, -0.198),
      magWell: V3(0, 0.018, 0),
      ejectPort: V3(0.012, 0.055, -0.02),
      stockEnd: V3(0, 0.03, 0.0645),
    },
    boreY: 0.043, flashScale: 0.95,
    magDir: V3(0, -1, 0.2),
  });
}
