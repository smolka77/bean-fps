// Glock-18 – pistolet z polimerową ramą (model proceduralny, kontrakt: SPEC.md). Początek układu = dłoń na chwycie.
import { THREE, box, roundPoly, stippleBump, side, front, lathe, cyl, tube, rbox, metalNoise, merged, placed, mesh, V3 } from './_kit.js';

const BORE = 0.0405;
const SLIDE_TOP = 0.0555, SLIDE_BOT = 0.026;
const SIGHT_Y = 0.062, REAR_Z = 0.0535, FRONT_Z = -0.1155;
const SLIDE_REAR = 0.062, SLIDE_FRONT = -0.1245, MUZZLE_Z = -0.1252;
const TG = 0.2974, RAKE = Math.atan(TG);                       // pochylenie chwytu: dół cofnięty do tyłu
const zc = y => 0.003 - TG * y;                                 // oś środkowa chwytu na wysokości y
const GRIP_BOT = -0.0765;

let M = null, G = null;
function shared() {
  if (M) return;
  const noise = metalNoise([4, 4]);
  M = {
    slide: new THREE.MeshStandardMaterial({ color: 0x2a2c31, metalness: 0.6, roughness: 0.4, roughnessMap: noise }),
    frame: new THREE.MeshStandardMaterial({ color: 0x3a3c42, metalness: 0.04, roughness: 0.7, bumpMap: stippleBump(0.0045), bumpScale: 1.4 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x7a7f87, metalness: 0.9, roughness: 0.3 }),
    black: new THREE.MeshStandardMaterial({ color: 0x0c0d0f, metalness: 0.2, roughness: 0.8 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf2f2ee, metalness: 0, roughness: 0.5, emissive: 0x303030 }),
  };
  const slide = [], frame = [], steel = [], black = [], white = [];

  // ---------- zamek (slide) ----------
  slide.push(side(roundPoly([[SLIDE_REAR, SLIDE_TOP - 0.003], [SLIDE_REAR - 0.002, SLIDE_TOP], [-0.1205, SLIDE_TOP], [SLIDE_FRONT, SLIDE_TOP - 0.003], [SLIDE_FRONT, SLIDE_BOT],
    [-0.085, SLIDE_BOT], [-0.083, SLIDE_BOT + 0.0035], [-0.026, SLIDE_BOT + 0.0035], [-0.024, SLIDE_BOT], [SLIDE_REAR, SLIDE_BOT]].reverse(), 0.0012, 3), 0.0255, 0.0017));
  slide.push(placed(rbox(0.0185, 0.0022, 0.176, 0.001, 2), 0, SLIDE_TOP + 0.0006, -0.0285));                                     // zaokrąglony grzbiet
  // nacięcia (serrations): tył i przód, po obu stronach
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 8; i++) black.push(placed(box(0.0016, 0.0215, 0.0016), sx * 0.01285, 0.0412, 0.0475 - i * 0.0042));
    for (let i = 0; i < 3; i++) black.push(placed(box(0.0016, 0.0215, 0.0016), sx * 0.01285, 0.0412, -0.098 - i * 0.0042));
  }
  // okno wyrzutowe (prawa strona) z widoczną komorą nabojową
  black.push(placed(box(0.0016, 0.0125, 0.036), 0.01275, 0.0465, 0.0));
  steel.push(placed(rbox(0.0014, 0.0075, 0.016, 0.0006, 2), 0.01215, 0.0463, -0.006));
  steel.push(placed(rbox(0.0014, 0.0058, 0.0042, 0.0005, 2), 0.01285, 0.0465, 0.0155));                                         // wyrzutnik (extractor)
  // lufa widoczna w wylocie + wzmocnienie czoła zamka
  steel.push(lathe([[0.0075, -0.1235], [0.0075, -0.1252]], 24).translate(0, BORE, 0));
  steel.push(tube(0.0075, 0.0044, -0.1245, -0.1252, 24).translate(0, BORE, 0));
  black.push(lathe([[0.0043, -0.1245], [0.0043, -0.1251]], 20).translate(0, BORE, 0));
  // przyrządy: muszka z kropką, szczerbinka U z białym obrysem
  slide.push(placed(rbox(0.0026, 0.0068, 0.0075, 0.0006, 2), 0, SLIDE_TOP + 0.0032, FRONT_Z));
  white.push(placed(new THREE.CylinderGeometry(0.00115, 0.00115, 0.0008, 12).rotateX(Math.PI / 2), 0, SIGHT_Y - 0.0027, FRONT_Z + 0.0041));
  slide.push(placed(front([[-0.0075, SLIDE_TOP - 0.001], [0.0075, SLIDE_TOP - 0.001], [0.0075, SIGHT_Y], [0.0036, SIGHT_Y], [0.0036, 0.0587], [-0.0036, 0.0587], [-0.0036, SIGHT_Y], [-0.0075, SIGHT_Y]], 0.0085, 0.0006), 0, 0, REAR_Z));
  for (const x of [-0.0054, 0.0054]) white.push(placed(box(0.0011, 0.0035, 0.0006), x, SIGHT_Y - 0.0018, REAR_Z + 0.0044));   // kreski szczerbinki

  // ---------- rama ----------
  const gripPts = [[0.0575, 0.0265], [0.0585, 0.016], [0.0425, 0.006], [0.0305, -0.002], [0.0513, GRIP_BOT], [0.0003, GRIP_BOT], [-0.0225, 0.0], [-0.0295, 0.0125], [-0.0345, 0.0265]];
  frame.push(side(roundPoly(gripPts, [0.004, 0.014, 0.02, 0.016, 0.007, 0.0045, 0.014, 0.012, 0.004], 5), 0.0315, 0.0045));
  frame.push(side([[-0.1235, 0.0262], [-0.1235, 0.0128], [-0.088, 0.0128], [-0.082, 0.0095], [-0.05, 0.0095], [-0.034, 0.0095], [-0.034, 0.0262]], 0.0238, 0.0014));   // dust cover
  frame.push(side([[-0.0745, 0.0128], [-0.0745, -0.0115], [-0.071, -0.0155], [-0.0255, -0.0155], [-0.0215, -0.0115], [-0.0215, 0.0128]], 0.0225, 0.0016,
    [[[-0.0675, 0.0098], [-0.0675, -0.0085], [-0.0645, -0.011], [-0.0335, -0.011], [-0.0305, -0.0085], [-0.0305, 0.0098]]]));  // kabłąk spustu
  for (const z of [-0.115, -0.1, -0.085]) black.push(placed(box(0.0235, 0.0016, 0.0042), 0, 0.0118, z));                          // szyna akcesoriów (nacięcia)
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) black.push(placed(box(0.0012, 0.0012, 0.0235), sx * 0.01585, -0.024 - i * 0.02, zc(-0.024 - i * 0.02) - 0.0125, -RAKE));   // rowki na przodzie chwytu
  // spust (z bezpiecznikiem), zwalniacz zamka, przycisk magazynka, zaczep rozbiórki
  steel.push(side([[-0.0535, 0.0112], [-0.0495, 0.0112], [-0.0485, 0.002], [-0.0525, -0.0073], [-0.0578, -0.0066], [-0.0548, 0.0]], 0.0042, 0.0006));
  black.push(placed(box(0.0014, 0.0085, 0.0036), 0, 0.0035, -0.0511));                                                          // blaszka bezpiecznika
  steel.push(placed(side([[-0.001, 0.0235], [-0.048, 0.0235], [-0.0505, 0.0205], [-0.0485, 0.0165], [-0.002, 0.0165]], 0.0019, 0.0005), -0.0164, 0, 0));      // zwalniacz zamka (lewa)
  steel.push(placed(new THREE.CylinderGeometry(0.0045, 0.0045, 0.0045, 16).rotateZ(Math.PI / 2), -0.0165, 0.0015, -0.022));         // przycisk magazynka
  steel.push(placed(rbox(0.0016, 0.0042, 0.011, 0.0006, 2), -0.0132, 0.0238, -0.0445));                                          // zaczep rozbiórki
  steel.push(placed(new THREE.CylinderGeometry(0.0021, 0.0021, 0.0255, 12).rotateZ(Math.PI / 2), 0, 0.0262, -0.0915));           // sworzeń
  frame.push(placed(rbox(0.0255, 0.0045, 0.0545, 0.002), 0, GRIP_BOT + 0.0012, zc(GRIP_BOT), -RAKE * 0.2));              // nasadka dna chwytu

  G = {
    slide: merged(slide), frame: merged(frame), steel: merged(steel), black: merged(black), white: merged(white),
    mag: rbox(0.0232, 0.1005, 0.0302, 0.003, 3),
    magBase: rbox(0.0285, 0.0075, 0.0395, 0.002, 3),
    magFollow: box(0.0206, 0.002, 0.0268),
  };
}

export function build(opts = {}) {
  shared();
  const g = new THREE.Group();
  const slide = new THREE.Group(); g.add(slide);
  mesh(G.slide, M.slide, slide); mesh(G.steel, M.steel, slide); mesh(G.black, M.black, slide); mesh(G.white, M.white, slide);
  mesh(G.frame, M.frame, g);

  // magazynek: początek = środek góry w gnieździe, oś pochylona jak chwyt
  const tilt = new THREE.Group(); tilt.position.set(0, 0.02, zc(0.02)); tilt.rotation.x = -RAKE; g.add(tilt);
  const mag = tilt;
  const body = mesh(G.mag, M.black, mag); body.position.set(0, -0.05025, 0);
  const base = mesh(G.magBase, M.frame, mag); base.position.set(0, -0.1041, 0.0);
  const fol = mesh(G.magFollow, M.steel, mag); fol.position.set(0, 0.0005, 0);

  return {
    id: 'glock', name: 'Glock-18', hands: 'pistol', suppressed: false, group: g,
    parts: { mag, slide },
    anchors: {
      gripR: V3(0, 0, 0),
      gripL: V3(-0.019, -0.04, zc(-0.04)),
      muzzle: V3(0, BORE, MUZZLE_Z),
      sightRear: V3(0, SIGHT_Y, REAR_Z),
      sightFront: V3(0, SIGHT_Y, FRONT_Z),
      magWell: V3(0, 0.02, zc(0.02)),
      ejectPort: V3(0.0128, 0.0465, 0.0),
      stockEnd: V3(0, 0.016, 0.0585),
    },
    boreY: BORE, flashScale: 0.6,
  };
}
