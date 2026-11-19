// Złoty AKM – ten sam model co AKM („AKM”, mcmxcg, Sketchfab, CC-BY 4.0), metal pozłacany przez
// narzedzia/assety/przygotuj-bronie.mjs (goldify). Broń z ograniczonym dostępem: weaponAllowed() w weaponry.js.
import { loadGlb, assemble } from './_glb.js';
import { SPEC } from './akm.js';
import GLB from './akmgold-glb.js';

let N = null;
export const ready = loadGlb(GLB).then((n) => { N = n; });
export function build() {
  return assemble(N, { ...SPEC, id: 'akmgold', name: 'AKM Gold' });
}
