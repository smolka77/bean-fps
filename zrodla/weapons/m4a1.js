// M4A1 z kolimatorem i chwytem przednim – model GLB „Assault rifle M4A1” (bobeer, Sketchfab, CC-BY 4.0).
// Ustawienie, skala i części: narzedzia/assety/przygotuj-bronie.mjs (oświetlacz z szyny usunięty – zasłaniał kolimator).
import { V3, loadGlb, assemble, reticle } from './_glb.js';
import GLB from './m4a1-glb.js';

let N = null;
export const ready = loadGlb(GLB).then((n) => { N = n; });
export function build() {
  return assemble(N, {
    id: 'm4a1', name: 'M4A1', hands: 'rifle',
    anchors: {
      gripR: V3(0, 0, 0),
      gripL: V3(0, 0, -0.268),                     // pionowy chwyt przedni
      muzzle: V3(0, 0.077, -0.556),
      sightRear: V3(0, 0.1495, -0.046),            // znak celowniczy kolimatora na środku ekranu
      sightFront: V3(0, 0.1495, -0.121),
      magWell: V3(0, 0.02, -0.126),
      ejectPort: V3(0.014, 0.08, -0.09),
      stockEnd: V3(0, 0.025, 0.284),
    },
    boreY: 0.077, flashScale: 0.9,
    extra: (g) => g.add(reticle('holo', 0.1495, -0.051, 0.012)),   // świecący znak kolimatora holograficznego (kółko z kropką) – wyraźny przy każdej jakości tekstur
  });
}
