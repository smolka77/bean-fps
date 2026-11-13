// Przykład zgodny z SPEC.md – prosta, ale poprawna geometrycznie broń (wzór interfejsu, nie do gry).
import * as THREE from 'three';

let M = null, G = null;
function shared() {
  if (M) return;
  M = {
    steel: new THREE.MeshStandardMaterial({ color: 0x2c2f35, metalness: 0.9, roughness: 0.4 }),
    poly: new THREE.MeshStandardMaterial({ color: 0x232427, metalness: 0, roughness: 0.7 }),
  };
  const cyl = (r, l) => { const g = new THREE.CylinderGeometry(r, r, l, 24); g.rotateX(Math.PI / 2); return g; };
  G = {
    receiver: new THREE.BoxGeometry(0.05, 0.06, 0.3),
    barrel: cyl(0.01, 0.35),
    grip: new THREE.BoxGeometry(0.035, 0.11, 0.045),
    mag: new THREE.BoxGeometry(0.03, 0.15, 0.06),
    stock: new THREE.BoxGeometry(0.04, 0.09, 0.22),
    post: new THREE.BoxGeometry(0.002, 0.03, 0.004),
    notch: new THREE.BoxGeometry(0.012, 0.012, 0.006),
  };
}

export function build(opts = {}) {
  shared();
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const boreY = 0.06;
  add(G.receiver, M.steel, 0, boreY - 0.01, -0.08);
  add(G.barrel, M.steel, 0, boreY, -0.4);
  add(G.grip, M.poly, 0, -0.02, 0.01);
  add(G.stock, M.poly, 0, boreY - 0.02, 0.17);
  const mag = new THREE.Group(); mag.position.set(0, boreY - 0.04, -0.12); g.add(mag);
  add(G.mag, M.steel, 0, -0.075, 0, mag);                       // magazynek wisi pod swoim początkiem
  const sightY = boreY + 0.05;
  add(G.post, M.steel, 0, sightY - 0.015, -0.5);                // czubek muszki = sightY
  add(G.notch, M.steel, -0.009, sightY, -0.02); add(G.notch, M.steel, 0.009, sightY, -0.02);
  return {
    id: 'example', name: 'Example', hands: 'rifle', suppressed: false, group: g,
    parts: { mag, slide: null },
    anchors: {
      gripR: new THREE.Vector3(0, 0, 0),
      gripL: new THREE.Vector3(0, boreY - 0.04, -0.3),
      muzzle: new THREE.Vector3(0, boreY, -0.575),
      sightRear: new THREE.Vector3(0, sightY, -0.02),
      sightFront: new THREE.Vector3(0, sightY, -0.5),
      magWell: new THREE.Vector3(0, boreY - 0.04, -0.12),
      ejectPort: new THREE.Vector3(0.026, boreY, -0.06),
      stockEnd: new THREE.Vector3(0, boreY - 0.02, 0.28),
    },
    boreY, flashScale: 1,
  };
}
