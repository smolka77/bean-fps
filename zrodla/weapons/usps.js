// USP-S – pistolet z tłumikiem i wysokimi przyrządami (model proceduralny, kontrakt: SPEC.md). Początek układu = dłoń na chwycie.
import { THREE, box, roundPoly, stippleBump, side, front, lathe, cyl, tube, rbox, metalNoise, merged, placed, mesh, V3 } from './_kit.js';

const BORE = 0.0415;
const SLIDE_TOP = 0.0565, SLIDE_BOT = 0.027;
const SIGHT_Y = 0.0685, REAR_Z = 0.0585, FRONT_Z = -0.1235;
const SLIDE_REAR = 0.065, SLIDE_FRONT = -0.1295;
const SUPP_FRONT = -0.325;
const TG = 0.3, RAKE = Math.atan(TG), GRIP_BOT = -0.0735;
const zc = y => 0.003 - TG * y;                                 // oś środkowa chwytu na wysokości y

let M = null, G = null;
function shared() {
  if (M) return;
  const noise = metalNoise([4, 4]);
  M = {
    slide: new THREE.MeshStandardMaterial({ color: 0x2c2e33, metalness: 0.62, roughness: 0.38, roughnessMap: noise }),
    frame: new THREE.MeshStandardMaterial({ color: 0x3b3d43, metalness: 0.04, roughness: 0.7, bumpMap: stippleBump(0.0045), bumpScale: 1.4 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x80858d, metalness: 0.9, roughness: 0.3 }),
    supp: new THREE.MeshStandardMaterial({ color: 0x4b5057, metalness: 0.86, roughness: 0.36, roughnessMap: noise }),
    black: new THREE.MeshStandardMaterial({ color: 0x0c0d0f, metalness: 0.2, roughness: 0.8 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf2f2ee, metalness: 0, roughness: 0.5, emissive: 0x303030 }),
  };
  const slide = [], frame = [], steel = [], supp = [], black = [], white = [];

  // ---------- zamek: zaokrąglony grzbiet, skośny przód ----------
  slide.push(side(roundPoly([[SLIDE_REAR, SLIDE_TOP - 0.004], [SLIDE_REAR - 0.003, SLIDE_TOP], [-0.113, SLIDE_TOP], [-0.123, SLIDE_TOP - 0.0045], [SLIDE_FRONT, SLIDE_TOP - 0.0125],
    [SLIDE_FRONT, SLIDE_BOT], [-0.088, SLIDE_BOT], [-0.086, SLIDE_BOT + 0.0035], [-0.028, SLIDE_BOT + 0.0035], [-0.026, SLIDE_BOT], [SLIDE_REAR, SLIDE_BOT]].reverse(), 0.0013, 3), 0.0275, 0.0032));
  slide.push(placed(rbox(0.016, 0.0022, 0.17, 0.001, 2), 0, SLIDE_TOP + 0.0005, -0.026));                                      // grzbiet
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 7; i++) black.push(placed(box(0.0016, 0.0215, 0.0016), sx * 0.0139, 0.0425, 0.05 - i * 0.0042));          // nacięcia z tyłu
    for (let i = 0; i < 3; i++) black.push(placed(box(0.0016, 0.0195, 0.0016), sx * 0.0139, 0.0415, -0.099 - i * 0.0042));       // nacięcia z przodu
  }
  black.push(placed(box(0.0016, 0.0135, 0.04), 0.0138, 0.0475, -0.004));                                                         // okno wyrzutowe
  steel.push(placed(rbox(0.0014, 0.0085, 0.018, 0.0006, 2), 0.0131, 0.0473, -0.0105));
  steel.push(placed(rbox(0.0014, 0.0062, 0.0045, 0.0005, 2), 0.0139, 0.0475, 0.0165));                                          // wyrzutnik
  // lufa gwintowana + wzmocnienie czoła zamka
  steel.push(lathe([[0.0079, -0.125], [0.0079, -0.16]], 24).translate(0, BORE, 0));
  for (let z = -0.133; z > -0.156; z -= 0.0035) steel.push(lathe([[0.0084, z], [0.0084, z - 0.0017]], 20).translate(0, BORE, 0));  // gwint
  steel.push(lathe([[0.0125, -0.1288], [0.0125, -0.1296]], 24).translate(0, BORE, 0));
  // wysokie przyrządy (ponad tłumikiem): muszka z kropką, szczerbinka z U i białymi kreskami
  slide.push(placed(rbox(0.0052, 0.0042, 0.011, 0.0008, 2), 0, SLIDE_TOP + 0.0016, FRONT_Z));
  slide.push(placed(rbox(0.0026, 0.0098, 0.0072, 0.0006, 2), 0, SLIDE_TOP + 0.0069, FRONT_Z));
  white.push(placed(new THREE.CylinderGeometry(0.00125, 0.00125, 0.0008, 12).rotateX(Math.PI / 2), 0, SIGHT_Y - 0.0028, FRONT_Z + 0.0044));
  slide.push(placed(front([[-0.0092, SLIDE_TOP - 0.001], [0.0092, SLIDE_TOP - 0.001], [0.0092, SIGHT_Y], [0.0039, SIGHT_Y], [0.0039, 0.0646], [-0.0039, 0.0646], [-0.0039, SIGHT_Y], [-0.0092, SIGHT_Y]], 0.0095, 0.0007), 0, 0, REAR_Z));
  for (const x of [-0.0066, 0.0066]) white.push(placed(box(0.0012, 0.004, 0.0006), x, SIGHT_Y - 0.002, REAR_Z + 0.0049));

  // ---------- kurek, dźwignie ----------
  steel.push(placed(side([[0.0655, 0.0555], [0.0695, 0.0525], [0.0695, 0.047], [0.0665, 0.0435], [0.0625, 0.0435], [0.0625, 0.0555]], 0.0082, 0.001), 0, 0, 0));       // kurek (ekspozycja przy tylnej ścianie zamka)
  for (let i = 0; i < 4; i++) black.push(placed(box(0.0084, 0.0012, 0.0012), 0, 0.0528 - i * 0.0026, 0.0694 - 0.0004));
  steel.push(placed(side([[0.048, 0.0405], [0.022, 0.0405], [0.0175, 0.0345], [0.021, 0.0285], [0.046, 0.031]], 0.0026, 0.0007), -0.0171, 0, 0));          // dźwignia bezpiecznika/odpalania (lewa)
  steel.push(placed(side([[-0.001, 0.025], [-0.052, 0.025], [-0.0545, 0.0215], [-0.052, 0.0175], [-0.002, 0.0175]], 0.002, 0.0005), -0.0172, 0, 0));       // zwalniacz zamka
  steel.push(placed(new THREE.CylinderGeometry(0.0048, 0.0048, 0.034, 16).rotateZ(Math.PI / 2), 0, 0.0005, -0.0235));                                        // przyciski magazynka (obustronne)
  steel.push(placed(new THREE.CylinderGeometry(0.0022, 0.0022, 0.0285, 12).rotateZ(Math.PI / 2), 0, 0.0268, -0.0945));                                      // sworzeń

  // ---------- rama ----------
  const gripPts = [[0.0595, 0.0275], [0.0625, 0.017], [0.0455, 0.0055], [0.0315, -0.003], [0.0535, GRIP_BOT], [0.0005, GRIP_BOT], [-0.024, 0.0], [-0.0315, 0.0125], [-0.0355, 0.0275]];
  frame.push(side(roundPoly(gripPts, [0.004, 0.014, 0.02, 0.016, 0.007, 0.0045, 0.015, 0.012, 0.004], 5), 0.0328, 0.0048));
  frame.push(side([[-0.1275, 0.0272], [-0.1275, 0.0132], [-0.092, 0.0132], [-0.086, 0.0098], [-0.052, 0.0098], [-0.036, 0.0098], [-0.036, 0.0272]], 0.0252, 0.0015));   // dust cover z szyną
  for (const z of [-0.118, -0.105, -0.092]) black.push(placed(box(0.0252, 0.0016, 0.0042), 0, 0.0124, z));                         // szyna – nacięcia
  frame.push(side([[-0.0775, 0.0132], [-0.0775, -0.0125], [-0.0735, -0.0165], [-0.0245, -0.0165], [-0.0195, -0.0115], [-0.0195, 0.0132]], 0.0235, 0.0017,
    [[[-0.0705, 0.0102], [-0.0705, -0.0095], [-0.0675, -0.0125], [-0.0335, -0.0125], [-0.0305, -0.0095], [-0.0305, 0.0102]]]));   // duży kabłąk spustu
  steel.push(side([[-0.0565, 0.0118], [-0.0525, 0.0118], [-0.0515, 0.0025], [-0.0555, -0.0085], [-0.0605, -0.0078], [-0.0575, 0.0]], 0.0042, 0.0006));    // spust
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) black.push(placed(box(0.0012, 0.0012, 0.0245), sx * 0.01645, -0.022 - i * 0.019, zc(-0.022 - i * 0.019) - 0.0125, -RAKE));
  frame.push(placed(rbox(0.0262, 0.0046, 0.056, 0.002), 0, GRIP_BOT + 0.0012, zc(GRIP_BOT), -RAKE * 0.2));                       // nasadka dna chwytu

  G = {
    slide: merged(slide), frame: merged(frame), steel: merged(steel), black: merged(black), white: merged(white),
    mag: rbox(0.0238, 0.0985, 0.0308, 0.003, 3), magBase: rbox(0.0292, 0.0075, 0.0405, 0.002, 3), magFollow: box(0.021, 0.002, 0.0272),
  };
  // tłumik
  const sp = [[0.0108, -0.15], [0.0158, -0.152], [0.0172, -0.158]];
  for (let z = -0.165; z > -0.312; z -= 0.012) sp.push([0.0174, z], [0.0174, z - 0.0058], [0.0166, z - 0.0058], [0.0166, z - 0.012]);
  sp.push([0.0172, -0.318], [0.016, -0.3245], [0.016, SUPP_FRONT], [0.0098, SUPP_FRONT]);
  G.supp = merged([lathe(sp, 36).translate(0, BORE, 0), tube(0.0098, 0.0046, SUPP_FRONT + 0.0004, SUPP_FRONT, 24).translate(0, BORE, 0)]);
}

export function build(opts = {}) {
  shared();
  const g = new THREE.Group();
  const slide = new THREE.Group(); g.add(slide);
  mesh(G.slide, M.slide, slide); mesh(G.steel, M.steel, slide); mesh(G.black, M.black, slide); mesh(G.white, M.white, slide);
  mesh(G.supp, M.supp, g);                                       // tłumik przykręcony do lufy – nie cofa się razem z zamkiem
  mesh(G.frame, M.frame, g);

  const tilt = new THREE.Group(); tilt.position.set(0, 0.02, zc(0.02)); tilt.rotation.x = -RAKE; g.add(tilt);
  const mag = tilt;
  mesh(G.mag, M.black, mag).position.set(0, -0.04925, 0);
  mesh(G.magBase, M.frame, mag).position.set(0, -0.1021, 0.0);
  mesh(G.magFollow, M.steel, mag).position.set(0, 0.0005, 0);

  return {
    id: 'usps', name: 'USP-S', hands: 'pistol', suppressed: true, group: g,
    parts: { mag, slide },
    anchors: {
      gripR: V3(0, 0, 0),
      gripL: V3(-0.0195, -0.04, zc(-0.04)),
      muzzle: V3(0, BORE, SUPP_FRONT),
      sightRear: V3(0, SIGHT_Y, REAR_Z),
      sightFront: V3(0, SIGHT_Y, FRONT_Z),
      magWell: V3(0, 0.02, zc(0.02)),
      ejectPort: V3(0.0139, 0.0475, -0.004),
      stockEnd: V3(0, 0.016, 0.0625),
    },
    boreY: BORE, flashScale: 0.25,
  };
}
