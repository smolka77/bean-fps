// Odbicia dla broni w widoku z pierwszej osoby: ciemne „studio” z kilkoma miękkimi panelami światła.
// Mało światła rozproszonego (broń i ręce nie są prześwietlone), za to wyraźne, gładkie odblaski na metalu i lakierze.
// Używane tylko w przebiegu renderowania broni (vmCam) – świat ma swoje własne otoczenie.
import * as THREE from 'three';

let env = null;
export function gunEnvironment(renderer) {
  if (env) return env;
  const sc = new THREE.Scene();
  // kopuła: jaśniejsza góra, ciemny horyzont, prawie czarny dół
  const R = 20, geo = new THREE.SphereGeometry(R, 64, 32), P = geo.attributes.position, col = new Float32Array(P.count * 3);
  const top = new THREE.Color(.5, .53, .58), hor = new THREE.Color(.34, .34, .34), bot = new THREE.Color(.13, .12, .11), c = new THREE.Color();
  for (let i = 0; i < P.count; i++) {
    const y = P.getY(i) / R;
    if (y > 0) c.lerpColors(hor, top, Math.pow(y, .6)); else c.lerpColors(hor, bot, Math.pow(-y, .45));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  sc.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  // panele: (szerokość, wysokość, pozycja, jasność, barwa) – zwrócone do środka
  const panel = (w, h, x, y, z, k, tint = [1, 1, 1]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(tint[0] * k, tint[1] * k, tint[2] * k), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); sc.add(m);
  };
  panel(11, 5, 0, 14, -3, 5);                         // softbox nad głową – długi odblask na grzbiecie broni
  panel(16, 2.2, 0, 6, -15, 2.6, [1, .98, .95]);      // pas z przodu u góry – odbija się w płaskich górnych płaszczyznach przy celowaniu
  panel(2.4, 11, -14, 3, 1, 4.2, [.92, .96, 1]);      // chłodny pas z lewej
  panel(1.8, 9, 13, 2, 7, 3.4, [1, .9, .76]);         // ciepła kontra z prawej, z tyłu
  panel(2, 9, 14, 3, -5, 2.4, [.95, .97, 1]);         // pas z prawej z przodu – odblask na prawym boku broni
  panel(8, 3.5, 0, 3, 15, 1.1);                       // słaby panel za plecami – tylne ścianki przyrządów nie są czarne
  panel(6, 1.2, 6, -5, -10, .5, [1, .95, .9]);        // odbicie od podłogi
  // (otoczenie obraca się z kamerą: −Z = przód widoku) – boki broni przy biodrze odbijają kierunek przód-lewo-dół,
  // grzbiet przód-prawo-górę, a przy celowaniu górne płaszczyzny patrzą prosto w horyzont przed sobą
  panel(9, 5, -6, -5, -14, 1.5, [1, .97, .93]);       // szeroki, miękki odblask na prawym boku broni
  panel(7, 1.6, 5, 7, -14, 3.2);                      // ostra linia na grzbiecie (pokrywa, zamek)
  panel(18, .7, 0, .6, -16, 3.6, [1, .98, .95]);      // cienki pas na horyzoncie – połysk na górze broni przy celowaniu
  const pm = new THREE.PMREMGenerator(renderer);
  env = pm.fromScene(sc, .025).texture; pm.dispose();
  geo.dispose();
  return env;
}
