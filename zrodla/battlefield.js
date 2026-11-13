// Pole bitwy w lobby: okopy z workami z piaskiem, barykady (jeże, zasieki, drut kolczasty), 2 czołgi, leje z dymem
// i płonąca beczka. Styl low poly z płaskim cieniowaniem, jak drzewa. buildBattlefield(scene, heightAt) -> { zones, update }
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const hash3 = (x, y, z) => { const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return v - Math.floor(v); };

export function buildBattlefield(scene, heightAt) {
  const rnd = rng(31), R = (a, b) => a + (b - a) * rnd();
  const flat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .9, flatShading: true, ...extra });
  const add = (parent, geo, mat, x, y, z, o = {}) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
    m.castShadow = o.cast !== false; m.receiveShadow = true; parent.add(m); return m;
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (r0, r1, h, s = 10) => new THREE.CylinderGeometry(r1, r0, h, s);
  const jitter = (g, amt) => { const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = o => hash3(x * 3.3 + o, y * 2.7 + o, z * 3.9) - .5;
      p.setXYZ(i, x + n(1) * amt, y + n(5) * amt * .6, z + n(9) * amt); } g.computeVertexNormals(); return g; };
  const group = new THREE.Group(); scene.add(group);
  const zones = [];

  const dirtM = flat(0x6b5235), mudM = flat(0x5a4630), woodM = flat(0x7a5634), steelM = flat(0x6a5544, { metalness: .3, roughness: .75 });
  const wireM = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: .6, roughness: .5 });

  // ---------- worki z piaskiem (instancje) ----------
  const bagGeo = new RoundedBoxGeometry(.56, .2, .32, 2, .07); jitter(bagGeo, .025);
  const bags = [];
  const bag = (x, y, z, ry) => bags.push({ x, y, z, ry: ry + R(-.12, .12), t: R(.82, 1.08) });
  const bagRow = (x0, z0, x1, z1, layers, baseY = 0) => {            // ściana z worków wzdłuż odcinka
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / .54)), ry = -Math.atan2(z1 - z0, x1 - x0);
    for (let l = 0; l < layers; l++) for (let i = 0; i < n - (l % 2); i++) {
      const t = (i + .5 + (l % 2) * .5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      bag(x, heightAt(x, z) + baseY + .1 + l * .18, z, ry);
    }
  };
  const bagArc = (cx, cz, r, a0, a1, layers) => {                    // półkole z worków (gniazdo)
    const n = Math.round(Math.abs(a1 - a0) * r / .52);
    for (let l = 0; l < layers; l++) for (let i = 0; i < n - (l % 2); i++) {
      const a = a0 + (a1 - a0) * (i + .5 + (l % 2) * .5) / n, x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r;
      bag(x, heightAt(x, z) + .1 + l * .18, z, a);
    }
  };

  // ---------- okopy: wał ziemi + worki + rów + kołki ----------
  const moundShape = new THREE.Shape([[-1.1, 0], [-.6, .42], [.1, .58], [.7, .35], [1.15, 0]].map(p => new THREE.Vector2(...p)));
  function trench(pts) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], len = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(z1 - z0, x1 - x0);
      const g = new THREE.ExtrudeGeometry(moundShape, { depth: len + 1, bevelEnabled: false, steps: Math.ceil(len / 1.2) });
      g.translate(0, 0, -(len + 1) / 2); g.rotateY(Math.PI / 2); jitter(g, .16);
      add(group, g, dirtM, (x0 + x1) / 2, heightAt((x0 + x1) / 2, (z0 + z1) / 2) - .04, (z0 + z1) / 2, { ry: -a });
      // worki na grzbiecie wału (strona wroga = -Z)
      const nx = Math.sin(a), nz = -Math.cos(a), s = nz < 0 ? 1 : -1;      // normalna w stronę -Z
      bagRow(x0 + nx * s * .15, z0 + nz * s * .15, x1 + nx * s * .15, z1 + nz * s * .15, 2, .42);
      // rów po stronie gracza (+Z): ciemna, ubita ziemia + kołki
      const ditch = new THREE.Mesh(new THREE.PlaneGeometry(len + .6, 1.3), ditchM); ditch.rotation.set(-Math.PI / 2, 0, -a);
      ditch.position.set((x0 + x1) / 2 - nx * s * 1.55, heightAt((x0 + x1) / 2, (z0 + z1) / 2) + .025, (z0 + z1) / 2 - nz * s * 1.55); ditch.receiveShadow = true; group.add(ditch);
      for (let k = 0; k <= len; k += 1.1) { const t = k / len, x = x0 + (x1 - x0) * t - nx * s * .95, z = z0 + (z1 - z0) * t - nz * s * .95;
        add(group, box(.08, .7, .08), woodM, x, heightAt(x, z) + .3, z, { rx: R(-.12, .12), rz: R(-.12, .12) }); }
      for (let k = 0; k <= len; k += 3.4) zones.push({ x: x0 + (x1 - x0) * k / len, z: z0 + (z1 - z0) * k / len, r: 2.2 });
    }
  }
  const ditchM = new THREE.MeshStandardMaterial({ roughness: 1, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
    map: canvasTex(128, 64, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(60,44,28,0)'); g.addColorStop(.25, 'rgba(58,42,26,.9)');
      g.addColorStop(.75, 'rgba(50,36,22,.95)'); g.addColorStop(1, 'rgba(60,44,28,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }) });
  trench([[-21, -15.5], [-16.5, -17.5], [-12, -16.6]]); trench([[-3.5, -17.2], [-1.5, -16]]);
  trench([[2.5, -14.8], [6.5, -16.5], [10.5, -14.2], [15, -16.4], [19.5, -14]]);

  // ---------- barykady ----------
  // jeż przeciwczołgowy: 3 skrzyżowane belki
  const beam = box(.2, .2, 1.7);
  function hedgehog(x, z, ry) {
    const g = new THREE.Group(); g.position.set(x, heightAt(x, z) + .48, z); g.rotation.y = ry; group.add(g);
    add(g, beam, steelM, 0, 0, 0, { rx: .62 }); add(g, beam, steelM, 0, 0, 0, { rx: -.62, ry: Math.PI / 2 }); add(g, beam, steelM, 0, 0, 0, { rz: Math.PI / 2, ry: .4, rx: .2 });
    zones.push({ x, z, r: 1.4 });
  }
  [[3.2, -9.8], [-2.6, -9.6], [8.5, -11.5], [-11.5, -21], [12.5, -22.5], [.5, -24], [-6, -26.5], [5.5, -28]].forEach(([x, z]) => hedgehog(x, z, R(0, 3)));
  // drut kolczasty: spirala na palikach
  function wire(x0, z0, x1, z1) {
    const len = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(z1 - z0, x1 - x0), turns = Math.round(len * 2.2), pts = [];
    for (let i = 0; i <= turns * 12; i++) { const t = i / (turns * 12), th = t * turns * Math.PI * 2;
      pts.push(new THREE.Vector3(t * len - len / 2, .38 + Math.sin(th) * .34, Math.cos(th) * .34)); }
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 12, .012, 3);
    add(group, g, wireM, (x0 + x1) / 2, heightAt((x0 + x1) / 2, (z0 + z1) / 2), (z0 + z1) / 2, { ry: -a, cast: false });
    for (let k = 0; k <= len; k += 2) { const t = k / len, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; add(group, box(.07, 1, .07), woodM, x, heightAt(x, z) + .45, z, { rz: R(-.15, .15) }); }
  }
  wire(-17, -19.5, -9, -20.5); wire(-6, -19.8, 1, -20.6); wire(4, -20.3, 11, -19.4); wire(13, -19.8, 19, -20.8);
  // kozioł hiszpański (drewniany, z kolcami)
  function cheval(x, z, ry) {
    const g = new THREE.Group(); g.position.set(x, heightAt(x, z), z); g.rotation.y = ry; group.add(g);
    add(g, cyl(.09, .09, 3.2, 7), woodM, 0, .55, 0, { rz: Math.PI / 2 });
    for (let i = 0; i < 4; i++) { const px = -1.3 + i * .87; add(g, cyl(.05, .05, 1.6, 6), woodM, px, .55, 0, { rx: .78 }); add(g, cyl(.05, .05, 1.6, 6), woodM, px, .55, 0, { rx: -.78 }); }
    zones.push({ x, z, r: 2 });
  }
  cheval(-8.5, -23.5, .1); cheval(9.5, -25.5, -.2);
  // gniazdo z worków przy graczu (prawa strona) z płonącą beczką
  bagArc(5.3, -5.4, 1.5, -1.9, 1.6, 3);
  bagRow(-13.2, -8.8, -11.2, -9.6, 3); bagRow(12, -10.6, 14.6, -9.6, 2);
  zones.push({ x: 5.3, z: -5.4, r: 2.5 });
  const barrel = new THREE.Group(); barrel.position.set(4.3, 0, -6.6); group.add(barrel);
  add(barrel, cyl(.3, .3, .9, 12), flat(0x3b4a33), 0, .45, 0);
  for (const y of [.18, .72]) add(barrel, new THREE.TorusGeometry(.305, .025, 4, 12), flat(0x2a2a28), 0, y, 0, { rx: Math.PI / 2, cast: false });
  add(barrel, new THREE.CircleGeometry(.29, 12), flat(0x1a1410), 0, .88, 0, { rx: -Math.PI / 2, cast: false });
  // skrzynie z amunicją i beczki
  const ammoM = flat(0x4f5a34), crateM = flat(0x8a6a42);
  [[6.6, -6.4, .4], [-12.4, -11.3, .1], [13.5, -11.5, -.3]].forEach(([x, z, ry]) => { add(group, box(.8, .4, .45), ammoM, x, heightAt(x, z) + .2, z, { ry }); add(group, box(.8, .4, .45), ammoM, x + .1, heightAt(x, z) + .6, z, { ry: ry + .2 }); });
  [[-15.5, -11, .3], [16.5, -12, -.2]].forEach(([x, z, ry]) => add(group, box(1, 1, 1), crateM, x, heightAt(x, z) + .5, z, { ry }));

  // ---------- czołgi ----------
  const olive = flat(0x56603a), oliveD = flat(0x434b2d), trackM = flat(0x25262a), wheelM = flat(0x3a3d36), muddy = flat(0x5d4f38), metalD = flat(0x2c2e30, { metalness: .5 });
  function sideExtrude(pts, width) { const sh = new THREE.Shape(pts.map(p => new THREE.Vector2(...p)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: width, bevelEnabled: false }); g.translate(0, 0, -width / 2); g.rotateY(-Math.PI / 2); return g; }   // profil [z, y] wyciągnięty na szerokość (oś X)
  function tank({ turretYaw = 0, barrelPitch = .04, number = '07' } = {}) {
    const g = new THREE.Group();                                       // przód czołgu = -Z
    // gąsienice z kołami
    const trackShape = [[-3.15, .55], [-2.95, .2], [-2.6, .02], [2.6, .02], [3.0, .25], [3.2, .62], [3.0, .86], [-3.0, .86]];
    for (const s of [-1, 1]) {
      const tg = sideExtrude(trackShape, .66); add(g, tg, trackM, s * 1.36, 0, 0);
      for (let i = 0; i < 6; i++) { const w = add(g, cyl(.33, .33, .14, 10), wheelM, s * 1.72, .36, -2.15 + i * .86, { rz: Math.PI / 2 }); }
      add(g, cyl(.3, .3, .16, 10), metalD, s * 1.72, .58, -2.9, { rz: Math.PI / 2 });           // koło napędowe
      add(g, cyl(.27, .27, .16, 10), metalD, s * 1.72, .6, 2.95, { rz: Math.PI / 2 });
      for (let i = 0; i < 4; i++) add(g, cyl(.09, .09, .12, 8), wheelM, s * 1.7, .86, -1.9 + i * 1.3, { rz: Math.PI / 2 });   // rolki podtrzymujące
      add(g, box(.75, .06, 6.5), oliveD, s * 1.36, .95, 0);                                   // błotnik
      add(g, box(.04, .3, 5.6), olive, s * 1.73, .78, .1);                                    // osłona boczna
    }
    // kadłub: dolny + pochyły górny pancerz
    add(g, box(2.1, .55, 5.9), muddy, 0, .62, 0);
    add(g, sideExtrude([[-3.05, .9], [-2.0, 1.45], [2.4, 1.45], [3.05, 1.15], [3.05, .9]], 2.6), olive, 0, 0, 0);
    // detale kadłuba: zapasowe ogniwa gąsienic, światła, skrzynie, kanistry, wydechy
    for (let i = 0; i < 3; i++) add(g, box(.55, .05, .22), trackM, -.65 + i * .65, 1.2, -2.55, { rx: -.47 });
    for (const s of [-1, 1]) { add(g, cyl(.09, .1, .12, 8), metalD, s * .95, 1.26, -2.82, { rx: Math.PI / 2 + .4 }); add(g, box(.5, .3, .5), oliveD, s * 1.36, 1.13, 2.2); add(g, box(.18, .42, .3), olive, s * 1.36, 1.17, 1.4); }
    for (const s of [-1, 1]) add(g, cyl(.08, .1, .45, 8), metalD, s * .6, 1.2, 3.05, { rx: Math.PI / 2 });
    add(g, cyl(.04, .04, 2.2, 6), metalD, .9, 1.5, .4, { rz: Math.PI / 2, ry: Math.PI / 2 });      // linka holownicza
    // wieża (płaskie ściany jak w low poly), jarzmo, lufa
    const turret = new THREE.Group(); turret.position.set(0, 1.45, .35); turret.rotation.y = turretYaw; g.add(turret);
    const tGeo = new THREE.CylinderGeometry(.95, 1.22, .72, 7); tGeo.scale(1, 1, 1.28); tGeo.rotateY(Math.PI / 14);
    add(turret, tGeo, olive, 0, .36, .1);
    add(turret, box(.85, .5, .45), oliveD, 0, .34, -1.42);                                    // jarzmo
    const gun = new THREE.Group(); gun.position.set(0, .36, -1.6); gun.rotation.x = barrelPitch; turret.add(gun);
    add(gun, cyl(.11, .1, 3.9, 10), metalD, 0, 0, -1.95, { rx: Math.PI / 2 });
    add(gun, cyl(.17, .17, .55, 10), metalD, 0, 0, -1.6, { rx: Math.PI / 2 });              // przedmuchiwacz
    add(gun, cyl(.15, .15, .3, 8), metalD, 0, 0, -3.95, { rx: Math.PI / 2 });                // hamulec wylotowy
    add(turret, cyl(.38, .42, .32, 9), oliveD, .42, .86, .45);                                // wieżyczka dowódcy
    add(turret, cyl(.33, .33, .06, 9), olive, .42, 1.05, .45, { rx: -.35 });                  // właz
    add(turret, cyl(.012, .012, 2.4, 4), metalD, -.55, 1.9, .9, { rz: .12, cast: false });    // antena
    add(turret, cyl(.04, .04, .9, 6), metalD, .42, 1.15, -.1, { rx: Math.PI / 2 });           // karabin maszynowy
    add(turret, box(1.7, .32, .5), oliveD, 0, .3, 1.55);                                      // kosz z tyłu wieży
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) add(turret, cyl(.06, .06, .22, 6), metalD, s * .98, .45, -.55 + k * .14, { rz: Math.PI / 2 });   // granatniki dymne
    // numer taktyczny na wieży
    const numTex = canvasTex(128, 64, (x, w, h) => { x.clearRect(0, 0, w, h); x.font = 'bold 50px Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = 'rgba(235,230,215,.9)'; x.fillText(number, w / 2, h / 2 + 2); });
    const numM = new THREE.MeshStandardMaterial({ map: numTex, transparent: true, roughness: .8, polygonOffset: true, polygonOffsetFactor: -2 });
    for (const s of [-1, 1]) add(turret, new THREE.PlaneGeometry(.6, .3), numM, s * 1.14, .38, .3, { ry: s * Math.PI / 2, cast: false });
    return g;
  }
  const t1 = tank({ turretYaw: -.35, barrelPitch: .05, number: '07' }); t1.position.set(-7.4, heightAt(-7.4, -12) - .02, -12); t1.rotation.y = -.55; group.add(t1);
  zones.push({ x: -7.4, z: -12, r: 4.8 });
  const t2 = tank({ turretYaw: .7, barrelPitch: .02, number: '12' }); t2.position.set(9, heightAt(9, -33.5) - .02, -33.5); t2.rotation.y = .9; group.add(t2);
  zones.push({ x: 9, z: -33.5, r: 4.8 });

  // ---------- leje po wybuchach z dymem ----------
  const scorch = new THREE.MeshStandardMaterial({ roughness: 1, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3,
    map: canvasTex(128, 128, (x, w, h) => { const g = x.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, 'rgba(22,16,10,.95)'); g.addColorStop(.45, 'rgba(45,32,20,.8)'); g.addColorStop(1, 'rgba(60,45,28,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }) });
  const smokers = [];
  function crater(x, z, r, smoke) {
    const s = new THREE.Mesh(new THREE.CircleGeometry(r * 1.6, 16), scorch); s.rotation.x = -Math.PI / 2; s.position.set(x, heightAt(x, z) + .03, z); group.add(s);
    const ring = new THREE.TorusGeometry(r, r * .28, 4, 12); ring.rotateX(Math.PI / 2); ring.scale(1, .45, 1); jitter(ring, r * .18);
    add(group, ring, mudM, x, heightAt(x, z) + .02, z);
    if (smoke) smokers.push(new THREE.Vector3(x, heightAt(x, z) + .2, z));
    zones.push({ x, z, r: r + 1 });
  }
  crater(-4.5, -18.5, 1.3, true); crater(7, -21.5, 1.1, false); crater(-13.5, -26, 1.5, true); crater(14.5, -28.5, 1.2, false); crater(2, -31, 1.4, true);

  // dym (lej, wrak) – szary, unosi się i rozpływa
  const smokeTex = canvasTex(64, 64, (x, w, h) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(120,112,108,.8)'); g.addColorStop(.55, 'rgba(110,104,100,.32)'); g.addColorStop(1, 'rgba(100,95,92,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const puffs = [];
  for (const at of smokers) for (let i = 0; i < 18; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 }));
    s.userData = { at, life: i / 18, rot: R(-.8, .8), drift: R(.6, 1.3) }; group.add(s); puffs.push(s);
  }
  // ogień w beczce: migoczące płomienie + ciepłe światło
  const fireTex = canvasTex(64, 64, (x, w, h) => { const g = x.createRadialGradient(32, 40, 0, 32, 36, 30);
    g.addColorStop(0, 'rgba(255,240,180,1)'); g.addColorStop(.35, 'rgba(255,160,50,.9)'); g.addColorStop(.75, 'rgba(220,60,10,.35)'); g.addColorStop(1, 'rgba(200,40,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const flames = [];
  for (let i = 0; i < 9; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.userData = { life: i / 9, ox: R(-.12, .12), oz: R(-.12, .12) }; barrel.add(s); flames.push(s); }
  const fireLight = new THREE.PointLight(0xff8a30, 6, 7, 1.6); fireLight.position.set(0, 1.4, 0); barrel.add(fireLight);
  for (let i = 0; i < 8; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 }));
    s.userData = { at: new THREE.Vector3(4.3, 1.4, -6.6), life: i / 8, rot: R(-.8, .8), drift: R(.4, .8) }; group.add(s); puffs.push(s); }

  // worki jako jedna instancja
  const bagMesh = new THREE.InstancedMesh(bagGeo, flat(0xb19f78), bags.length), dm = new THREE.Object3D(), col = new THREE.Color();
  bags.forEach((b, i) => { dm.position.set(b.x, b.y, b.z); dm.rotation.set(R(-.06, .06), b.ry, R(-.06, .06)); dm.scale.set(R(.95, 1.05), R(.9, 1.1), 1); dm.updateMatrix();
    bagMesh.setMatrixAt(i, dm.matrix); bagMesh.setColorAt(i, col.setRGB(b.t, b.t * .97, b.t * .9)); });
  bagMesh.castShadow = bagMesh.receiveShadow = true; group.add(bagMesh);

  return {
    zones,
    update(t, dt) {
      for (const s of puffs) {
        const u = s.userData; u.life += dt * .11; if (u.life > 1) u.life -= 1;
        const L = u.life;
        s.position.set(u.at.x + L * 3 * u.drift + Math.sin(t * .6 + L * 5) * .3, u.at.y + L * 6.5, u.at.z - L * .8);
        s.scale.setScalar(.6 + L * 3.6);
        s.material.opacity = Math.min(1, L * 8) * (1 - L) * .55;
        s.material.rotation = u.rot * L * 3;
      }
      for (const f of flames) {
        const u = f.userData; u.life += dt * 1.6; if (u.life > 1) u.life -= 1;
        const L = u.life; f.position.set(u.ox * (1 - L), .95 + L * .7, u.oz * (1 - L)); f.scale.setScalar(.55 * (1 - L * .6)); f.material.opacity = (1 - L) * .9;
      }
      fireLight.intensity = 5 + Math.sin(t * 17) * 1.2 + Math.sin(t * 7.3) * .8;
    },
  };
}
