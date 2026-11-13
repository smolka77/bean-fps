// M4A1-S – karabinek typu AR z tłumikiem (model proceduralny, kontrakt: SPEC.md). Początek układu = dłoń na chwycie pistoletowym.
import { THREE, box, side, front, lathe, cyl, tube, rbox, sweep, metalNoise, merged, placed, mesh, V3 } from './_kit.js';

const BORE = 0.0775;
const SIGHT_Y = 0.141;
const REAR_Z = 0.058, FRONT_Z = -0.4555, MUZZLE_Z = -0.688, BUTT_Z = 0.294;

let M = null, G = null;
function shared() {
  if (M) return;
  const noise = metalNoise([3, 3]);
  M = {
    alu: new THREE.MeshStandardMaterial({ color: 0x41444a, metalness: 0.5, roughness: 0.5, roughnessMap: noise }),
    poly: new THREE.MeshStandardMaterial({ color: 0x383a40, metalness: 0.05, roughness: 0.7 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x5b6068, metalness: 0.85, roughness: 0.4 }),
    supp: new THREE.MeshStandardMaterial({ color: 0x5f646c, metalness: 0.85, roughness: 0.36, roughnessMap: noise }),
  };
  const alu = [], poly = [], steel = [], supp = [];

  // ---------- górna komora z szyną ----------
  alu.push(side([[0.1, 0.1035], [0.1, 0.056], [-0.4, 0.056], [-0.4, 0.1035]].reverse(), 0.0335, 0.002));                  // korpus górnej komory (szeroki = 2 × 0.0167)
  alu.push(placed(rbox(0.026, 0.0035, 0.5, 0.0012, 2), 0, 0.1052, -0.15));                                                // płyta szyny
  for (let i = 0; i < 31; i++) alu.push(placed(box(0.0215, 0.0036, 0.0058), 0, 0.1085, 0.09 - i * 0.0158));   // zęby szyny picatinny
  alu.push(placed(rbox(0.0345, 0.0475, 0.045, 0.004), 0, 0.078, 0.08));                                                   // tył górnej komory (zaczep rączki)
  poly.push(placed(rbox(0.0042, 0.019, 0.05, 0.0012, 2), 0.0172, 0.082, -0.03));                                          // osłona okna wyrzutowego (prawa strona)
  steel.push(placed(rbox(0.0016, 0.0145, 0.033, 0.0005, 2), 0.0193, 0.08, -0.03));                                        // krawędź zawiasu
  steel.push(placed(new THREE.CylinderGeometry(0.0085, 0.0085, 0.012, 20).rotateZ(Math.PI / 2), 0.0225, 0.067, 0.0275));  // przycisk forward assist
  steel.push(placed(rbox(0.006, 0.006, 0.014, 0.001, 2), 0.0185, 0.066, 0.0235));
  // rączka przeładowania (T) – tył
  steel.push(placed(rbox(0.036, 0.0075, 0.034, 0.002), 0, 0.0975, 0.114));
  steel.push(placed(rbox(0.0046, 0.0095, 0.02, 0.0012, 2), -0.0125, 0.0905, 0.119));
  steel.push(placed(rbox(0.0046, 0.0095, 0.02, 0.0012, 2), 0.0125, 0.0905, 0.119));
  // ---------- dolna komora ----------
  alu.push(side([[0.1, 0.056], [0.1, 0.008], [0.055, 0.0], [-0.02, 0.0], [-0.045, 0.004], [-0.145, 0.004], [-0.145, 0.056]], 0.032, 0.002));
  alu.push(placed(rbox(0.0355, 0.04, 0.074, 0.004), 0, 0.004, -0.099));                                                   // rozszerzone gniazdo magazynka
  // spust, kabłąk, przełącznik, zatrzaski
  steel.push(side([[-0.026, 0.006], [-0.028, -0.02], [-0.035, -0.0235], [-0.092, -0.0235], [-0.098, -0.012], [-0.104, 0.006]], 0.0035, 0.0007,
    [[[-0.034, 0.002], [-0.036, -0.014], [-0.043, -0.0165], [-0.087, -0.0165], [-0.092, -0.01], [-0.096, 0.002]]]));
  steel.push(placed(side([[-0.058, 0.01], [-0.063, 0.01], [-0.061, -0.004], [-0.057, -0.011], [-0.053, -0.008]], 0.0045, 0.0007), 0, 0, 0));
  steel.push(placed(side([[0.012, 0.033], [-0.016, 0.033], [-0.02, 0.028], [-0.016, 0.021], [0.008, 0.021]], 0.0022, 0.0006), 0.0171, 0, 0)); // przełącznik
  steel.push(placed(new THREE.CylinderGeometry(0.0055, 0.0055, 0.009, 14).rotateZ(Math.PI / 2), 0.0205, 0.019, -0.044));  // przycisk zwalniający magazynek
  steel.push(placed(side([[-0.018, 0.028], [-0.045, 0.028], [-0.049, 0.021], [-0.022, 0.021]], 0.003, 0.0006), 0.0167, 0, 0));         // zatrzask zamka
  for (const z of [0.088, -0.115]) steel.push(placed(new THREE.CylinderGeometry(0.0034, 0.0034, 0.037, 12).rotateZ(Math.PI / 2), 0, 0.055, z)); // kołki łączące
  // ---------- chwyt pistoletowy + kolba ----------
  poly.push(side([[-0.034, 0.0345], [0.03, 0.037], [0.0505, -0.082], [0.0135, -0.092], [0.002, -0.07], [-0.014, -0.022]], 0.032, 0.0042));
  for (let i = 0; i < 5; i++) poly.push(placed(box(0.034, 0.0017, 0.0035), 0, -0.01 - i * 0.015, 0.0285 + i * 0.0042, 0.21, 0, 0));   // nacięcia chwytu
  steel.push(placed(rbox(0.015, 0.006, 0.026, 0.002), 0, -0.0925, 0.0305, 0.2));                                          // śruba chwytu
  poly.push(placed(cyl(0.0128, 0.1, 0.205, 28), 0, BORE - 0.0125, 0));                                                    // rura bufora
  poly.push(side([[0.115, 0.064], [0.2, 0.066], [0.287, 0.056], [0.287, -0.04], [0.225, -0.03], [0.15, -0.004], [0.115, 0.01]], 0.036, 0.0045));   // kolba
  poly.push(placed(rbox(0.0385, 0.108, 0.0085, 0.003), 0, 0.011, 0.2905));                                                // stopka gumowa (zaokrąglona)
  for (let i = 0; i < 6; i++) poly.push(placed(box(0.0372, 0.0016, 0.0042), 0, -0.02 + i * 0.016, 0.2955));    // żebra stopki
  steel.push(placed(rbox(0.0155, 0.005, 0.04, 0.0015), 0, -0.0345, 0.17));                                                // dźwignia regulacji kolby
  steel.push(placed(new THREE.CylinderGeometry(0.0034, 0.0034, 0.046, 12).rotateZ(Math.PI / 2), 0, -0.0175, 0.285));      // oczko pasa
  steel.push(placed(new THREE.TorusGeometry(0.006, 0.0013, 6, 16), 0, -0.0215, 0.134, 0, Math.PI / 2));

  // ---------- łoże, lufa, przyrządy ----------
  const hg = [[0, -0.105], [0.9, -0.105], [1, -0.108]];                                                                    // profil okrągłego łoża z żebrowaniem (r znormalizowane)
  for (let z = -0.118; z > -0.395; z -= 0.0185) hg.push([1, z], [1, z - 0.0125], [0.955, z - 0.0125], [0.955, z - 0.0185]);
  hg.push([1, -0.4], [0.9, -0.405], [0, -0.405]);
  poly.push(lathe(hg, 26).scale(0.0235, 0.0235, 1).translate(0, BORE, 0));
  steel.push(lathe([[0.0245, -0.1], [0.0305, -0.1], [0.0305, -0.111], [0.0245, -0.111]], 32).translate(0, BORE, 0));                  // pierścień delta
  alu.push(placed(rbox(0.0118, 0.006, 0.31, 0.0012, 2), 0, BORE + 0.0243, -0.25));                                         // szyna górna łoża (płaska, zlicowana z szyną komory)
  steel.push(cyl(0.0088, -0.4, -0.505, 24).translate(0, BORE, 0));                                                         // lufa
  steel.push(placed(rbox(0.021, 0.034, 0.036, 0.004), 0, BORE + 0.008, -0.4435));                                          // blok gazowy
  steel.push(side([[-0.446, 0.1025], [-0.4538, 0.1385], [-0.4572, 0.1385], [-0.465, 0.1025]], 0.0026, 0.0004));            // A-frame muszki
  for (const x of [-0.0072, 0.0072]) steel.push(placed(rbox(0.0017, 0.034, 0.0105, 0.0005, 2), x, 0.12, FRONT_Z));          // skrzydełka osłony muszki
  steel.push(placed(rbox(0.018, 0.0045, 0.02, 0.0012, 2), 0, 0.1048, FRONT_Z));
  // przeziernik: podstawa, skrzydełka, pierścień (otwór = środek linii celownika)
  steel.push(placed(rbox(0.0155, 0.017, 0.02, 0.0018), 0, 0.1155, REAR_Z + 0.0015));
  for (const x of [-0.0105, 0.0105]) steel.push(placed(rbox(0.0034, 0.0185, 0.014, 0.0009, 2), x, 0.1295, REAR_Z + 0.006));
  steel.push(placed(new THREE.TorusGeometry(0.0072, 0.0022, 8, 24), 0, SIGHT_Y, REAR_Z));

  // ---------- tłumik ----------
  const sp = [[0.0125, -0.5], [0.0125, -0.51], [0.0205, -0.52], [0.0205, -0.538]];
  for (let z = -0.538; z > -0.668; z -= 0.012) sp.push([0.0212, z], [0.0212, z - 0.0065], [0.0204, z - 0.0065], [0.0204, z - 0.012]);
  sp.push([0.0205, -0.676], [0.0188, -0.686], [0.0188, -0.688], [0.0105, -0.688]);
  supp.push(lathe(sp, 30).translate(0, BORE, 0));
  steel.push(lathe([[0.0125, -0.5], [0.0185, -0.5], [0.0185, -0.505], [0.0125, -0.505]], 28).translate(0, BORE, 0));
  steel.push(tube(0.0104, 0.0055, -0.6865, -0.688, 24).translate(0, BORE, 0));                                              // otwór wylotowy (ciemny)

  G = {
    alu: merged(alu), poly: merged(poly), steel: merged(steel), supp: merged(supp),
    mag: sweep([[0.012, 0], [-0.05, -0.003], [-0.1, -0.012], [-0.15, -0.027]], 30, () => 0.0262, (i, t) => 0.0625 - 0.001 * t),
    magBase: rbox(0.0285, 0.007, 0.0655, 0.002, 3), magLip: rbox(0.0286, 0.0065, 0.0625, 0.0012, 2),
    carrier: rbox(0.003, 0.0125, 0.026, 0.0008, 2),
  };
}

export function build(opts = {}) {
  shared();
  const g = new THREE.Group();
  mesh(G.alu, M.alu, g); mesh(G.poly, M.poly, g); mesh(G.steel, M.steel, g); mesh(G.supp, M.supp, g);

  const mag = new THREE.Group(); mag.position.set(0, 0.0, -0.1); g.add(mag);
  mesh(G.mag, M.alu, mag);
  const base = mesh(G.magBase, M.poly, mag); base.position.set(0, -0.1525, -0.0275); base.rotation.x = 0.22;
  mesh(G.magLip, M.steel, mag).position.set(0, 0.0, 0.0);

  // zamek widoczny w oknie wyrzutowym – cofa się przy strzale
  const slide = new THREE.Group(); g.add(slide);
  mesh(G.carrier, M.steel, slide).position.set(0.0178, 0.0795, -0.0275);

  return {
    id: 'm4a1s', name: 'M4A1-S', hands: 'rifle', suppressed: true, group: g,
    parts: { mag, slide },
    anchors: {
      gripR: V3(0, 0, 0),
      gripL: V3(0, 0.028, -0.29),
      muzzle: V3(0, BORE, MUZZLE_Z),
      sightRear: V3(0, SIGHT_Y, REAR_Z),
      sightFront: V3(0, SIGHT_Y, FRONT_Z),
      magWell: V3(0, 0.02, -0.1),
      ejectPort: V3(0.0195, 0.082, -0.03),
      stockEnd: V3(0, 0.011, BUTT_Z),
    },
    boreY: BORE, flashScale: 0.3,
  };
}
