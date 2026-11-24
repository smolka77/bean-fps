// FN P90 – model GLB „P90” (Rotuma, Sketchfab, CC-BY 4.0). Ustawienie, skala, części i naprawa materiału: narzedzia/assety/przygotuj-bronie.mjs.
// Bullpup: prawa dłoń na chwycie między otworami (spust w przednim otworze), lewa pod przodem korpusu przed osłoną spustu,
// magazynek leży poziomo na górze komory (przy przeładowaniu idzie w górę i do tyłu), celownik na szynie nad magazynkiem.
import { V3, loadGlb, assemble, glassLens, reticle } from './_glb.js';
import GLB from './p90-glb.js';

let N = null;
// celownik kolimatorowy: szybka była częścią nieprzezroczystego materiału korpusu (fioletowa płytka zasłaniała cel) –
// wychodzi do osobnego, przezroczystego szkła; na linii celowania świeci czerwona kropka
export const ready = loadGlb(GLB).then((n) => { N = n; glassLens(N, [-0.0115, 0.1505, -0.1003, 0.0115, 0.1725, -0.0992], { color: 0xb6bcff, opacity: 0.1 }); });
export function build() {
  return assemble(N, {
    id: 'p90', name: 'P90', hands: 'rifle',
    anchors: {
      gripR: V3(0, 0, 0),
      gripL: V3(0, 0.02, -0.12),                    // spód przodu korpusu, przed osłoną spustu
      muzzle: V3(0, 0.061, -0.202),
      sightRear: V3(0, 0.1615, 0),                  // środek szybki kolimatora (szyna nad magazynkiem)
      sightFront: V3(0, 0.1615, -0.096),
      magWell: V3(0, 0.089, 0.022),                 // środek magazynka na górze komory
      ejectPort: V3(0, -0.03, 0.05),                // P90 wyrzuca łuski w dół, za chwytem
      stockEnd: V3(0, 0.045, 0.3),
    },
    boreY: 0.061, flashScale: 0.7,
    magDir: V3(0, 1, 0.4),                          // magazynek zdejmowany w górę i do tyłu
    eyeZ: 0.15,                                     // oko przy policzku na kolbie bullpupa – szybka kolimatora wypełnia celownik
    extra: (g) => g.add(reticle('dot', 0.1615, -0.0985, 0.0078)),   // kropka ~5 mrad z delikatną poświatą
  });
}
