// AK-47 z drewnianymi okładzinami – model proceduralny (kontrakt: SPEC.md). Początek układu = dłoń na chwycie pistoletowym.
import { THREE, side, front, lathe, cyl, tube, rbox, sweep, woodTexture, metalNoise, merged, placed, mesh, V3 } from './_kit.js';

const BORE = 0.078;                 // oś lufy nad dłonią
const SIGHT_Y = 0.136;              // linia celownika (czubek muszki = dno szczerbinki + ~3.5 mm)
const REAR_Z = -0.205, FRONT_Z = -0.5375, MUZZLE_Z = -0.57, BUTT_Z = 0.314;

let M = null, G = null;
function shared() {
  if (M) return;
  const noise = metalNoise([3, 3]);
  M = {
    steel: new THREE.MeshStandardMaterial({ color: 0x5a5f67, metalness: 0.6, roughness: 0.62, roughnessMap: noise }),
    dark: new THREE.MeshStandardMaterial({ color: 0x34373c, metalness: 0.8, roughness: 0.4 }),
    wood: new THREE.MeshStandardMaterial({ color: 0xffffff, map: woodTexture([128, 76, 38], [70, 36, 16], [1, 2]), metalness: 0, roughness: 0.52 }),
    bake: new THREE.MeshStandardMaterial({ color: 0x8a4a1e, metalness: 0.06, roughness: 0.42 }),
    black: new THREE.MeshStandardMaterial({ color: 0x0e0f11, metalness: 0.3, roughness: 0.75 }),
  };
  const steel = [], dark = [], wood = [], black = [];

  // ---------- skrzynia zamkowa (tłoczona) ----------
  steel.push(side([[0.058, 0.1], [0.052, 0.1], [-0.31, 0.1], [-0.31, 0.025], [0.058, 0.025]], 0.044, 0.0018));                   // ściany
  steel.push(placed(front([[-0.0215, 0.098], [-0.0215, 0.108], [-0.0165, 0.118], [0.0165, 0.118], [0.0215, 0.108], [0.0215, 0.098]], 0.245, 0.001), 0, 0, -0.0675)); // pokrywa
  for (const x of [-0.0072, 0.0072]) steel.push(placed(rbox(0.0016, 0.0012, 0.22, 0.0005, 2), x, 0.1185, -0.0675));              // przetłoczenia pokrywy
  steel.push(placed(rbox(0.036, 0.022, 0.12, 0.004), 0, 0.109, -0.25));                                                          // przód skrzyni pod szczerbinką
  steel.push(placed(rbox(0.04, 0.026, 0.052, 0.003), 0, 0.0115, -0.14));                                                         // gniazdo magazynka
  steel.push(placed(rbox(0.03, 0.004, 0.07, 0.0015), 0, 0.1005, 0.082));                                                         // tył pokrywy / zaczep kolby
  // spust + kabłąk
  steel.push(side([[0.012, 0.026], [0.012, -0.006], [0.005, -0.018], [-0.02, -0.021], [-0.07, -0.017], [-0.097, -0.004], [-0.101, 0.026]], 0.007, 0.0012,
    [[[0.003, 0.02], [0.003, -0.002], [-0.003, -0.012], [-0.07, -0.0125], [-0.089, -0.0015], [-0.093, 0.02]]]));
  dark.push(placed(side([[-0.05, 0.022], [-0.058, 0.022], [-0.0585, 0.004], [-0.0545, -0.007], [-0.047, -0.004]], 0.005, 0.0008), 0, 0, 0));       // spust
  dark.push(placed(side([[-0.165, 0.014], [-0.176, 0.016], [-0.2, 0.006], [-0.2, -0.004], [-0.19, -0.006], [-0.17, 0.003]], 0.009, 0.001), 0, 0, 0)); // zatrzask magazynka
  // przełącznik ognia (prawa strona) + szczelina rączki przeładowania
  steel.push(placed(side([[0.034, 0.066], [-0.074, 0.066], [-0.082, 0.058], [-0.082, 0.05], [-0.07, 0.044], [0.0, 0.042], [0.026, 0.046]], 0.0022, 0.0006), 0.0229, 0, 0));
  black.push(placed(rbox(0.0012, 0.008, 0.19, 0.0004, 2), 0.0222, 0.0845, -0.04));
  // nity i wgłębienia
  const rivet = new THREE.SphereGeometry(0.0026, 10, 6); rivet.scale(1, 1, 0.55);
  const rvt = [];
  for (const sx of [-1, 1]) {
    for (const [z, y] of [[-0.285, 0.04], [-0.285, 0.06], [-0.285, 0.083], [-0.255, 0.032], [0.04, 0.04], [0.04, 0.06], [0.04, 0.083], [-0.2, 0.032], [-0.09, 0.032]])
      rvt.push(placed(rivet, sx * 0.0225, y, z, 0, sx * Math.PI / 2));
    for (const z of [-0.12, -0.16]) rvt.push(placed(new THREE.CylinderGeometry(0.0045, 0.0045, 0.002, 12).rotateZ(Math.PI / 2), sx * 0.022, 0.058, z));   // wgłębienia nad magazynkiem
  }
  dark.push(...rvt);

  // ---------- lufa, tuleja gazowa, przyrządy ----------
  dark.push(cyl(0.0078, -0.29, -0.553, 28).translate(0, BORE, 0));                                                                                      // lufa
  dark.push(placed(cyl(0.0088, -0.30, -0.465, 24), 0, BORE + 0.0215, 0));                                                                // rura gazowa (nad lufą)
  steel.push(placed(rbox(0.021, 0.036, 0.046, 0.004), 0, BORE + 0.0075, -0.4625));                                                // blok gazowy
  steel.push(placed(rbox(0.016, 0.044, 0.016, 0.0025), 0, 0.0955, FRONT_Z));                                                      // podstawa muszki
  black.push(placed(rbox(0.002, 0.02, 0.0035, 0.0006, 2), 0, SIGHT_Y - 0.01, FRONT_Z));                                           // muszka (cienka, ≤ 2.5 mm)
  for (const x of [-0.0078, 0.0078]) steel.push(placed(rbox(0.002, 0.034, 0.013, 0.0006, 2), x, 0.119, FRONT_Z));                // osłona muszki – otwarta od góry
  dark.push(placed(cyl(0.0035, -0.43, -0.548, 12), 0, BORE - 0.0235, 0));                                                         // pręt czyszczący
  dark.push(placed(new THREE.SphereGeometry(0.0042, 10, 8), 0, BORE - 0.0235, -0.548));
  dark.push(lathe([[0.0105, -0.552], [0.0108, -0.5545], [0.0112, -0.5575], [0.0108, -0.5605], [0.0112, -0.563], [0.0108, -0.5655], [0.0105, -0.57]], 28).translate(0, BORE, 0));   // hamulec wylotowy
  dark.push(tube(0.0105, 0.0042, -0.5695, -0.57, 24).translate(0, BORE, 0));
  dark.push(placed(rbox(0.0035, 0.012, 0.012, 0.001, 2), 0, BORE + 0.0105, -0.5625));                                             // szczelina hamulca
  // szczerbinka: podstawa, listek, suwak z wycięciem
  steel.push(placed(rbox(0.03, 0.03, 0.05, 0.004), 0, 0.096, -0.29));
  steel.push(placed(rbox(0.024, 0.0026, 0.115, 0.0008, 2), 0, 0.1235, -0.247, -0.115));                                           // listek
  steel.push(placed(front([[-0.014, 0.121], [0.014, 0.121], [0.014, 0.141], [0.0066, 0.141], [0.0016, 0.1325], [-0.0016, 0.1325], [-0.0066, 0.141], [-0.014, 0.141]], 0.006, 0.0006), 0, 0, REAR_Z));
  dark.push(placed(rbox(0.0235, 0.004, 0.012, 0.0008, 2), 0, 0.1225, -0.265));                                                    // zawias listka

  // ---------- okładziny drewniane ----------
  const lowerProfile = [[0, -0.31], [0.8, -0.31], [0.95, -0.3135], [1, -0.318], [1, -0.345], [0.93, -0.3485], [0.93, -0.358], [1, -0.3615], [1, -0.382], [0.93, -0.3855], [0.93, -0.395], [1, -0.3985], [1, -0.428], [0.955, -0.4365], [0.84, -0.44], [0, -0.44]];
  wood.push(lathe(lowerProfile, 36).scale(0.0215, 0.0275, 1).translate(0, BORE - 0.0095, 0));                                     // dolna okładzina
  wood.push(lathe([[0, -0.31], [0.82, -0.31], [0.97, -0.3135], [1, -0.318], [1, -0.4225], [0.95, -0.4295], [0.8, -0.433], [0, -0.433]], 36).scale(0.0185, 0.0215, 1).translate(0, BORE + 0.0145, 0)); // górna
  steel.push(lathe([[0.0225, -0.3085], [0.0225, -0.3165]], 28).translate(0, BORE, 0));
  wood.push(side([[-0.028, 0.028], [0.028, 0.03], [0.052, -0.092], [0.004, -0.099], [-0.001, -0.08]], 0.034, 0.0045));             // chwyt pistoletowy
  steel.push(placed(cyl(0.011, 0, 0.0035, 20), 0, -0.1002, 0.0285).translate(0, 0, 0));                                          // dolna nakrętka chwytu
  wood.push(side([[0.055, 0.098], [0.12, 0.096], [0.2, 0.088], [0.306, 0.079], [0.31, 0.079], [0.31, -0.044], [0.2, -0.018], [0.12, 0.012], [0.055, 0.025]], 0.034, 0.0035)); // kolba
  steel.push(side([[0.3095, 0.083], [0.3145, 0.083], [0.3145, -0.047], [0.3055, -0.047]], 0.037, 0.0012));                       // stopka
  for (const y of [0.066, -0.03]) dark.push(placed(new THREE.CylinderGeometry(0.0032, 0.0032, 0.002, 12).rotateX(Math.PI / 2), 0, y, 0.3145));   // śruby stopki
  dark.push(placed(new THREE.TorusGeometry(0.0075, 0.0013, 6, 18), 0, -0.036, 0.258, 0, Math.PI / 2));                          // obejma pasa (kolba)
  dark.push(placed(new THREE.TorusGeometry(0.0075, 0.0013, 6, 18), 0, BORE - 0.0125, -0.47, 0, Math.PI / 2));                     // obejma pasa (przód)

  G = {
    steel: merged(steel), dark: merged(dark), black: merged(black), wood: merged(wood, true),
    mag: sweep([[0.012, 0], [-0.04, -0.002], [-0.095, -0.015], [-0.145, -0.037], [-0.188, -0.068]], 44,
      (i) => 0.0372 + (i % 4 < 2 ? 0.0011 : 0) + (i > 40 ? 0.001 : 0), (i, t) => 0.046 + 0.004 * t),
    magBase: rbox(0.0405, 0.0065, 0.06, 0.0018, 3),
    magLug: rbox(0.012, 0.006, 0.006, 0.001, 2),
    knob: rbox(0.0125, 0.019, 0.015, 0.003), stem: new THREE.CylinderGeometry(0.0034, 0.0034, 0.02, 12).rotateZ(Math.PI / 2),
  };
}

export function build(opts = {}) {
  shared();
  const g = new THREE.Group();
  mesh(G.steel, M.steel, g); mesh(G.dark, M.dark, g); mesh(G.black, M.black, g); mesh(G.wood, M.wood, g);

  // magazynek: początek = środek góry w gnieździe
  const mag = new THREE.Group(); mag.position.set(0, 0.025, -0.14); g.add(mag);
  mesh(G.mag, M.bake, mag);
  const base = mesh(G.magBase, M.dark, mag); base.position.set(0, -0.191, -0.0705); base.rotation.x = 0.63;
  mesh(G.magLug, M.dark, mag).position.set(0, 0.005, 0.0255);

  // rączka przeładowania (prawa strona) – porusza się razem z suwadłem przy strzale
  const slide = new THREE.Group(); g.add(slide);
  const stem = mesh(G.stem, M.dark, slide); stem.position.set(0.0305, 0.0845, -0.075);
  const knob = mesh(G.knob, M.dark, slide); knob.position.set(0.0415, 0.0905, -0.075); knob.rotation.z = -0.35;

  return {
    id: 'ak47', name: 'AK-47', hands: 'rifle', suppressed: false, group: g,
    parts: { mag, slide },
    anchors: {
      gripR: V3(0, 0, 0),
      gripL: V3(0, 0.034, -0.372),
      muzzle: V3(0, BORE, MUZZLE_Z),
      sightRear: V3(0, SIGHT_Y, REAR_Z),
      sightFront: V3(0, SIGHT_Y, FRONT_Z),
      magWell: V3(0, 0.025, -0.14),
      ejectPort: V3(0.0225, 0.086, -0.045),
      stockEnd: V3(0, 0.02, BUTT_Z),
    },
    boreY: BORE, flashScale: 1.15,
  };
}
