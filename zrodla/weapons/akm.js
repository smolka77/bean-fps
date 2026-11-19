// AKM – model GLB „AKM” (mcmxcg, Sketchfab, CC-BY 4.0). Ustawienie, skala i części: narzedzia/assety/przygotuj-bronie.mjs.
// Początek układu = prawa dłoń na chwycie pistoletowym; wymiary w metrach (długość 0,88 m).
import { V3, loadGlb, assemble } from './_glb.js';
import GLB from './akm-glb.js';

// punkty chwytu i celowania – wspólne z akmgold.js (ten sam model, inne tekstury)
export const SPEC = {
  hands: 'rifle',
  anchors: {
    gripR: V3(0, 0, 0),
    gripL: V3(0, 0.034, -0.422),                 // pod dolną okładziną łoża
    muzzle: V3(0, 0.061, -0.597),
    sightRear: V3(0, 0.1085, -0.272),            // szczerbinka (linia celowania na wysokości czubka muszki)
    sightFront: V3(0, 0.1085, -0.5605),
    magWell: V3(0, 0.028, -0.133),
    ejectPort: V3(0.018, 0.073, -0.13),
    stockEnd: V3(0, 0.023, 0.283),
  },
  boreY: 0.061, flashScale: 1.15,
};
let N = null;
export const ready = loadGlb(GLB).then((n) => { N = n; });
export function build() {
  return assemble(N, { ...SPEC, id: 'akm', name: 'AKM' });
}
