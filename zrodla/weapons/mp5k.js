// MP5K – model GLB „MP5K” (Shorty_Digitan, Sketchfab, CC-BY 4.0). Ustawienie, skala i części: narzedzia/assety/przygotuj-bronie.mjs.
// Bez kolby: lewa dłoń na pionowym chwycie, przy celowaniu oko ~7 cm za przeziernikiem (eyeZ).
import { V3, loadGlb, assemble, carveSight } from './_glb.js';
import GLB from './mp5k-glb.js';

let N = null;
// przeziernik bębnowy miał otwór < 1 mm (przy oku 20 cm za nim nic nie było widać) – okrągła przeziernia 6,8 mm wokół linii celowania;
// muszka (czubek na y = 0,1415) w osłonie wypada na środku przeziernika
export const ready = loadGlb(GLB).then((n) => { N = n; carveSight(N, { y: 0.1415, r: 0.0034, z0: -0.03, z1: 0.012 }); });
export function build() {
  return assemble(N, {
    id: 'mp5k', name: 'MP5K', hands: 'rifle',
    anchors: {
      gripR: V3(0, 0, 0),
      gripL: V3(0, 0.03, -0.215),                  // pionowy chwyt przedni
      muzzle: V3(0, 0.087, -0.223),
      sightRear: V3(0, 0.1415, -0.001),             // przeziernik bębnowy → muszka w osłonie
      sightFront: V3(0, 0.1415, -0.266),
      magWell: V3(0, 0.07, -0.138),
      ejectPort: V3(0.0112, 0.1086, -0.117),
      stockEnd: V3(0, 0.095, 0.0515),
    },
    boreY: 0.087, flashScale: 0.7,
    magDir: V3(0, -1, -0.3),                       // zakrzywiony magazynek wysuwa się w dół i do przodu
    eyeZ: 0.07,                                     // oko blisko przeziernika: pierścień przeziernika obejmuje osłonę muszki
  });
}
