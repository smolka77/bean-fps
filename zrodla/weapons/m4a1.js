// M4A1 z kolimatorem i chwytem przednim – model GLB „Assault rifle M4A1” (bobeer, Sketchfab, CC-BY 4.0).
// Ustawienie, skala i części: narzedzia/assety/przygotuj-bronie.mjs (oświetlacz z szyny usunięty – zasłaniał kolimator).
import { V3, loadGlb, assemble, reticle, dropBox, glassLens } from './_glb.js';
import GLB from './m4a1-glb.js';

let N = null;
// kolimator: znak z tekstury modelu (rozmyty, ~2 mm pod linią celowania) znika, obie szybki dostają czyste, lekko zielonkawe szkło
export const ready = loadGlb(GLB).then((n) => {
  N = n;
  dropBox(N, [-0.0035, 0.143, -0.0792, 0.0035, 0.152, -0.078]);
  for (const z of [[-0.0647, -0.0639], [-0.0874, -0.0841]]) glassLens(N, [-0.0147, 0.1362, z[0], 0.0138, 0.1518, z[1]], { color: 0xcdeee0, opacity: 0.09 });
});
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
    extra: (g) => g.add(reticle('holo', 0.1495, -0.0786, 0.0104)),   // znak kolimatora między szybkami: cienkie kółko ~38 mrad z kropką ~3 mrad
  });
}
