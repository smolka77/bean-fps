// Hangar w tle lobby (mapa lobby „Hangar” w panelu admina) (jasny, jak hangar lotniczy): białe ściany ze stężeniami, kratownice i panele LED pod dachem,
// lśniąca posadzka z odbiciami, 3 zaparkowane auta za graczem, skrzynie, ściana z bronią, torby i paleta z gotówką.
// buildHangar(scene, renderer) -> { update(t, dt), resize() }   (fasolka stoi w (0,0,0), kamera patrzy w stronę -Z)
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
function canvasTex(w, h, draw, { repeat = [1, 1], srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const sstep = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function buildHangar(scene, renderer) {
  const W = 16, BACK = -22, H = 11, FRONT = 8;
  const mirrorSize = () => [Math.min(1280, innerWidth * .6 * devicePixelRatio) | 0, Math.min(800, innerHeight * .6 * devicePixelRatio) | 0];

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  scene.environmentIntensity = .25;
  scene.background = new THREE.Color(0x15181d);
  scene.fog = new THREE.FogExp2(0x15181d, .028);

  const add = (geo, mat, x, y, z, o = {}) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
    m.castShadow = o.cast !== false; m.receiveShadow = o.recv !== false; (o.parent || scene).add(m); return m;
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const std = (color, roughness = .6, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // ---------- posadzka: lustro + półprzezroczysta żywica z dużymi płytami ----------
  const [mw, mh] = mirrorSize();
  const mirror = new Reflector(new THREE.PlaneGeometry(2 * W, FRONT - BACK), { clipBias: .003, color: 0x5a5e64, textureWidth: mw, textureHeight: mh });
  mirror.rotation.x = -Math.PI / 2; mirror.position.set(0, -.002, (FRONT + BACK) / 2); scene.add(mirror);
  const floorTex = canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#b9bec4'; x.fillRect(0, 0, w, h); const r = rng(11);
    for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${r() < .5 ? '120,126,134' : '230,233,236'},${.03 + r() * .05})`; x.beginPath(); x.arc(r() * w, r() * h, 3 + r() * 30, 0, 7); x.fill(); }
    x.strokeStyle = 'rgba(80,86,94,.45)'; x.lineWidth = 3; x.strokeRect(0, 0, w, h);
  }, { repeat: [8, 7.5] });
  add(new THREE.PlaneGeometry(2 * W, FRONT - BACK), std(0x5e636a, .3, 0, { map: floorTex, transparent: true, opacity: .86 }), 0, 0, (FRONT + BACK) / 2, { rx: -Math.PI / 2, cast: false });
  const lineM = std(0xf4f4f0, .5);
  const bay = (cx, cz, ry) => { const g = new THREE.Group(); g.position.set(cx, .003, cz); g.rotation.y = ry; scene.add(g);
    for (const z of [-1.55, 1.55]) add(box(6, .004, .1), lineM, 0, 0, z, { parent: g, cast: false });
    add(box(.1, .004, 3.2), lineM, 3, 0, 0, { parent: g, cast: false }); };

  // ---------- ściany: biała blacha, cokół, słupy, rygle, stężenia w X ----------
  const wallTex = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#7d848c'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < w; i += 16) { x.fillStyle = 'rgba(150,158,168,.18)'; x.fillRect(i, 0, 3, h); x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(i + 4, 0, 2, h); }
  }, { repeat: [16, 4] });
  const wallM = std(0xffffff, .55, .15, { map: wallTex });
  add(new THREE.PlaneGeometry(2 * W, H), wallM, 0, H / 2, BACK, { cast: false });
  for (const s of [-1, 1]) add(new THREE.PlaneGeometry(FRONT - BACK, H), wallM, s * W, H / 2, (FRONT + BACK) / 2, { ry: -s * Math.PI / 2, cast: false });
  add(new THREE.PlaneGeometry(2 * W, FRONT - BACK), std(0xe9ecef, .8), 0, H, (FRONT + BACK) / 2, { rx: Math.PI / 2, cast: false });
  const steelW = std(0xf1f3f5, .4, .5), steelG = std(0x9aa3ad, .4, .7), kick = std(0xaeb5bd, .6, .3);
  add(box(2 * W, 1.1, .1), kick, 0, .55, BACK + .05, { cast: false });
  for (const s of [-1, 1]) add(box(.1, 1.1, FRONT - BACK), kick, s * (W - .05), .55, (FRONT + BACK) / 2, { cast: false });
  const COLS = [-W, -10, -4, 2, 8, W];
  for (const x of COLS) add(box(.45, H, .45), steelW, x === -W ? x + .25 : x === W ? x - .25 : x, H / 2, BACK + .25);
  for (const y of [2.6, 5, 7.4, 9.6]) add(box(2 * W, .14, .14), steelG, 0, y, BACK + .12, { cast: false });
  const rod = (a, b, r = .035, mat = steelG) => { const d = new THREE.Vector3().subVectors(b, a), m = add(new THREE.CylinderGeometry(r, r, d.length(), 6), mat, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, { cast: false });
    m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); return m; };
  for (let i = 0; i < COLS.length - 1; i += 2) { const a = COLS[i] + .3, b = COLS[i + 1] - .3;
    rod(V(a, 1.2, BACK + .2), V(b, 9.4, BACK + .2)); rod(V(b, 1.2, BACK + .2), V(a, 9.4, BACK + .2)); }
  for (const s of [-1, 1]) for (const z of [-16, -10, -4, 2]) add(box(.45, H, .45), steelW, s * (W - .25), H / 2, z);

  // ---------- dach: kratownice i panele LED ----------
  const ledM = new THREE.MeshBasicMaterial({ color: 0x8a8f96 });   // wygaszone panele
  for (const z of [-19, -13, -7, -1, 5]) {
    add(box(2 * W, .3, .3), steelW, 0, H - 1.6, z, { cast: false }); add(box(2 * W, .3, .3), steelW, 0, H - .25, z, { cast: false });
    for (let i = 0; i < 16; i++) { const x0 = -W + i * 2; rod(V(x0, H - 1.6, z), V(x0 + 1, H - .25, z), .05, steelW); rod(V(x0 + 1, H - .25, z), V(x0 + 2, H - 1.6, z), .05, steelW); }
  }
  for (const z of [-16, -10, -4, 2]) for (const x of [-11, -5.5, 0, 5.5, 11]) add(box(2.2, .06, .9), ledM, x, H - 1.7, z, { cast: false, recv: false });
  for (const x of [-12, -6, 0, 6, 12]) add(box(.25, .25, FRONT - BACK), steelW, x, H - .9, (FRONT + BACK) / 2, { cast: false });

  // ---------- napis na tylnej ścianie ----------
  const logoTex = canvasTex(1024, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h); x.font = 'italic 900 170px Anton, Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = '#1f2a44'; x.fillText('FASOL', w / 2 - 95, h / 2); x.fillStyle = '#f2b51c'; x.fillText('KA', w / 2 + 250, h / 2);
  });
  add(new THREE.PlaneGeometry(9, 2.25), new THREE.MeshStandardMaterial({ map: logoTex, transparent: true, roughness: .6 }), -1, 7.8, BACK + .6, { cast: false });

  // ---------- ściana z bronią (prawa strona tylnej ściany) ----------
  const ars = new THREE.Group(); ars.position.set(3.0, 0, -9.6); ars.rotation.y = -.29; ars.scale.setScalar(.62); scene.add(ars);   // lekko po prawej, przodem do gracza
  for (const x of [-3.3, 3.3]) add(box(.25, .08, 1.4), std(0x15171b, .4, .7), x, .04, 0, { parent: ars });   // stopy wolnostojącej ściany
  add(box(7.2, 1.05, .12), std(0x1d2025, .6, .4), 0, .52, 0, { parent: ars });
  const tubeM = new THREE.MeshBasicMaterial({ color: 0xd8fff4, toneMapped: false });
  for (const y of [5.75, 5.95]) add(new THREE.CylinderGeometry(.035, .035, 6.6, 8), tubeM, 0, y, .45, { parent: ars, rz: Math.PI / 2, cast: false });   // świetlówki
  add(box(7, .08, .5), std(0x1a1c20, .5, .6), 0, 6.1, .4, { parent: ars });
  for (const x of [-2.4, 0, 2.4]) { const l = new THREE.PointLight(0xb8ffe8, 9, 6, 1.4); l.position.set(x, 5.2, 1.2); ars.add(l); }
  const glowF = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x9effe0, transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending,
    map: canvasTex(64, 32, (x, w, h) => { const g = x.createRadialGradient(32, 16, 0, 32, 16, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }) }));
  glowF.position.set(0, 5.85, .7); glowF.scale.set(9, 1.6, 1); ars.add(glowF);
  const peg = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#23272e'; x.fillRect(0, 0, w, h); x.fillStyle = '#121418';
    for (let i = 8; i < w; i += 16) for (let j = 8; j < h; j += 16) { x.beginPath(); x.arc(i, j, 2.4, 0, 7); x.fill(); } }, { repeat: [3, 2] });
  add(box(7, 4.2, .15), std(0xffffff, .8, .2, { map: peg }), 0, 3.2, 0, { parent: ars });
  for (const [w, h, x, y] of [[7.2, .16, 0, 1.05], [7.2, .16, 0, 5.35], [.16, 4.4, -3.58, 3.2], [.16, 4.4, 3.58, 3.2]]) add(box(w, h, .25), std(0x15171b, .4, .7), x, y, .05, { parent: ars });
  add(box(6.8, .06, .06), new THREE.MeshBasicMaterial({ color: 0xe8f6ff }), 0, 5.2, .16, { parent: ars, cast: false });
  const gunM = std(0x24272d, .35, .75), tanM = std(0xb39262, .6, .1), gunM2 = std(0x4f555e, .3, .85);
  function rifle(len, furn = gunM, scope = true) {
    const g = new THREE.Group(), s = len / 1.1;
    add(box(.42 * s, .09 * s, .05), gunM, 0, 0, 0, { parent: g });
    add(new THREE.CylinderGeometry(.018 * s, .018 * s, .45 * s, 8), gunM2, .43 * s, .01, 0, { parent: g, rz: Math.PI / 2 });
    add(box(.28 * s, .07 * s, .05), furn, .2 * s, -.005, 0, { parent: g });
    add(box(.26 * s, .12 * s, .045), furn, -.33 * s, -.03 * s, 0, { parent: g, rz: .08 });
    add(box(.06 * s, .16 * s, .04), gunM, .04 * s, -.11 * s, 0, { parent: g, rz: -.18 });
    add(box(.05 * s, .11 * s, .04), furn, -.12 * s, -.08 * s, 0, { parent: g, rz: .35 });
    if (scope) add(new THREE.CylinderGeometry(.026 * s, .026 * s, .2 * s, 10), gunM2, .02, .085 * s, 0, { parent: g, rz: Math.PI / 2 });
    return g;
  }
  const place = (g, x, y) => { g.position.set(x, y, .17); ars.add(g); };
  place(rifle(1.9), -1.7, 4.6); place(rifle(1.8, tanM), 1.7, 4.6);
  place(rifle(2.0, gunM, false), -1.7, 3.6); place(rifle(1.75, tanM, false), 1.7, 3.6);
  place(rifle(2.05), -1.7, 2.6); place(rifle(1.9), 1.7, 2.6);
  for (let i = 0; i < 5; i++) { const g = new THREE.Group(); add(box(.36, .1, .05), gunM2, 0, 0, 0, { parent: g }); add(box(.1, .22, .05), gunM, -.11, -.12, 0, { parent: g, rz: .25 }); place(g, -2.6 + i * 1.3, 1.55); }

  // ---------- drewniane skrzynie ----------
  const crateTex = canvasTex(256, 256, (x, w, h) => {
    const r = rng(23);
    for (let i = 0; i < 8; i++) { x.fillStyle = `hsl(33,${40 + r() * 10}%,${46 + r() * 8}%)`; x.fillRect(0, i * 32, w, 32); x.fillStyle = 'rgba(60,35,15,.35)'; x.fillRect(0, i * 32, w, 2); }
    for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(90,55,25,${r() * .2})`; x.fillRect(r() * w, r() * h, 20 + r() * 60, 1); }
    x.lineWidth = 22; x.strokeStyle = 'hsl(31,42%,38%)'; x.strokeRect(11, 11, w - 22, h - 22);
    x.beginPath(); x.moveTo(20, 20); x.lineTo(w - 20, h - 20); x.lineWidth = 20; x.stroke();
  });
  const crateM = std(0xffffff, .85, 0, { map: crateTex });
  const crate = (s, x, y, z, ry = 0) => add(box(s, s, s), crateM, x, y + s / 2, z, { ry });
  const cashTex = canvasTex(128, 64, (x, w, h) => { x.fillStyle = '#5c8a57'; x.fillRect(0, 0, w, h); x.fillStyle = '#7fa874'; x.fillRect(6, 6, w - 12, h - 12);
    x.fillStyle = '#ece4cc'; x.fillRect(w / 2 - 10, 0, 20, h); x.fillStyle = '#2f5a30'; x.font = 'bold 28px Georgia'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('$', w * .22, h / 2); x.fillText('$', w * .78, h / 2); });
  const edgeTex = canvasTex(64, 32, (x, w, h) => { x.fillStyle = '#b9c4a6'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(70,95,65,.55)'; for (let i = 0; i < h; i += 2) { x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); } });
  const cashM = std(0xffffff, .8, 0, { map: cashTex }), edgeM = std(0xffffff, .9, 0, { map: edgeTex });
  const brick = box(.32, .12, .15), brickMats = [edgeM, edgeM, cashM, edgeM, edgeM, edgeM];
  const cash = (x, y, z, ry = 0, parent = scene) => { const m = new THREE.Mesh(brick, brickMats); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
  // banderola na paczce banknotów
  const bandM = std(0xf1ead2, .7), band = box(.06, .125, .155);
  const bundle = (parent, x, y, z, ry = 0, rz = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.set(0, ry, rz); parent.add(g);
    const m = new THREE.Mesh(brick, brickMats); m.castShadow = true; g.add(m); const bb = new THREE.Mesh(band, bandM); g.add(bb); return g; };
  // torba sportowa z pieniędzmi: miękki korpus, wzmocnione boki, uchwyty, pasek, otwarty zamek z paczkami
  const nylon = std(0x16171a, .78, .05), trimB = std(0x2b2d33, .6, .1), zipM = std(0xb9bcc2, .3, .9), inside = std(0x050506, 1);
  function moneyBag(x, y, z, ry, open = true) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g);
    const bg = new THREE.CapsuleGeometry(.2, .44, 8, 18); bg.rotateZ(Math.PI / 2); bg.scale(1, .95, .8);
    { const p = bg.attributes.position; for (let i = 0; i < p.count; i++) { const yy = p.getY(i); if (yy < -.08) p.setY(i, -.08 + (yy + .08) * .35);   // płaskie dno
      p.setX(i, p.getX(i) * (1 + .04 * Math.sin(p.getY(i) * 20))); } bg.computeVertexNormals(); }
    add(bg, nylon, 0, .17, 0, { parent: g });
    for (const e of [-.42, .42]) { add(new THREE.CylinderGeometry(.165, .165, .03, 22), trimB, e, .2, 0, { parent: g, rz: Math.PI / 2 }); add(new THREE.CylinderGeometry(.07, .07, .035, 14), std(0x9a1f1f, .5), e * 1.02, .2, 0, { parent: g, rz: Math.PI / 2 }); }
    for (const zz of [-.075, .075]) { const h = add(new THREE.TorusGeometry(.11, .016, 6, 16, Math.PI), trimB, 0, .33, zz, { parent: g, rx: zz > 0 ? -.35 : .35 }); h.scale.set(1.3, 1, 1); }
    add(new THREE.CylinderGeometry(.05, .05, .07, 10), std(0x111214, .9), 0, .44, 0, { parent: g, rz: Math.PI / 2 });     // owijka uchwytów
    const strap = new THREE.TorusGeometry(.42, .012, 4, 24, Math.PI * .8); add(strap, trimB, 0, .2, -.17, { parent: g, rz: Math.PI * .1, rx: -.2 });
    if (open) {
      add(box(.6, .02, .17), inside, 0, .355, 0, { parent: g });                                                     // otwór
      for (const zz of [-.088, .088]) add(box(.62, .012, .012), zipM, 0, .36, zz, { parent: g });
      add(box(.04, .03, .015), zipM, .33, .35, .09, { parent: g });                                                  // suwak
      for (let i = 0; i < 5; i++) bundle(g, -.22 + i * .11, .38 + (i % 2) * .03, (i % 2 ? .025 : -.025), Math.PI / 2 + (i - 2) * .12, (i - 2) * .15);
    } else { add(box(.64, .01, .012), zipM, 0, .375, 0, { parent: g }); add(box(.04, .03, .015), zipM, -.2, .37, .01, { parent: g }); }
    return g;
  }
  // 3 skrzynie po prawej od ściany z bronią, na nich 2 torby, trzecia na podłodze
  crate(.85, 5.85, 0, -8.5, -.3); crate(.85, 6.7, 0, -8.1, -.25); crate(.75, 6.25, .85, -8.3, -.35);
  moneyBag(5.8, .85, -8.45, -.45, true); moneyBag(6.25, 1.6, -8.3, -.2, true); moneyBag(5.6, 0, -7.2, .35, false);
  bundle(scene, 6.0, .06, -6.85, .6); bundle(scene, 6.15, .06, -6.75, 1.1); bundle(scene, 6.07, .18, -6.8, .8);

  // ---------- auta ----------
  const paint = (c, r = .22) => new THREE.MeshPhysicalMaterial({ color: c, metalness: .55, roughness: r, clearcoat: 1, clearcoatRoughness: .04 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0b0f14, metalness: .7, roughness: .04, clearcoat: 1 });
  const black = std(0x0c0d0f, .5, .3), mesh = std(0x050506, .9, .1, { side: THREE.DoubleSide }), chrome = std(0xeef1f4, .08, 1), rubber = std(0x111214, .9);
  const headM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe6f4ff, emissiveIntensity: 2.4 });
  const tailM = new THREE.MeshStandardMaterial({ color: 0x500000, emissive: 0xff1c1c, emissiveIntensity: 2.4 });
  // bok auta: dół prosty, góra wygładzona splajnem; wyciągnięty na szerokość i zwężony funkcją f(x,y) (przód = -X)
  function sideShape(start, top, end) { const s = new THREE.Shape(); s.moveTo(...start); s.splineThru(top.map(p => new THREE.Vector2(...p))); s.lineTo(...end); s.lineTo(...start); return s; }
  function bodyGeo(shape, depth, bevel, f) {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 36 });
    g.translate(0, 0, -depth / 2); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * f(p.getX(i), p.getY(i)));
    g.computeVertexNormals(); return g;
  }
  const halfW = (depth, bevel, f, x, y) => (depth / 2 + bevel) * f(x, y);
  function wheel(rimM, spokes, opts = {}) {
    const g = new THREE.Group(), r = opts.r || .37;
    const tire = new THREE.LatheGeometry([[.27, -.14], [.33, -.15], [r - .01, -.135], [r, -.08], [r, .08], [r - .01, .135], [.33, .15], [.27, .14]].map(p => new THREE.Vector2(...p)), 32);
    tire.rotateX(Math.PI / 2); add(tire, rubber, 0, 0, 0, { parent: g });
    add(new THREE.CylinderGeometry(.275, .275, .24, 36), black, 0, 0, 0, { parent: g, rx: Math.PI / 2 });
    add(new THREE.TorusGeometry(.272, .012, 6, 36), rimM, 0, 0, .125, { parent: g });
    for (let k = 0; k < spokes; k++) { const a = k / spokes * Math.PI * 2;
      add(box(opts.sw || .045, .25, .03), rimM, Math.sin(a) * .135, Math.cos(a) * .135, .12, { parent: g, rz: -a + (opts.twist || 0) }); }
    add(new THREE.CylinderGeometry(.055, .055, .04, 14), rimM, 0, 0, .13, { parent: g, rx: Math.PI / 2 });
    if (opts.caliper) add(box(.06, .16, .05), std(0xc8a020, .5, .3), -.17, .1, .07, { parent: g, rz: .5, cast: false });
    return g;
  }
  function addWheels(g, xs, z, y, rimM, spokes, opts) {
    for (const s of [-1, 1]) for (const x of xs) {
      add(new THREE.CircleGeometry(.48, 28, 0, Math.PI), black, x, y - .06, s * (z + .045), { parent: g, ry: s > 0 ? 0 : Math.PI, cast: false });
      const w = wheel(rimM, spokes, opts); w.position.set(x, y, s * z); if (s < 0) w.rotation.y = Math.PI; g.add(w);
    }
  }
  const sideTube = (g, pts, depth, bevel, f, r, mat, s) => {      // listwa / łuk przyklejony do boku nadwozia
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => V(x, y, s * (halfW(depth, bevel, f, x, y) + .01))));
    add(new THREE.TubeGeometry(curve, 48, r, 6), mat, 0, 0, 0, { parent: g, cast: false });
  };
  const sidePlate = (g, pts, depth, bevel, f, mat, s) => {        // płaska wstawka na boku (wloty, panele)
    const sh = new THREE.Shape(); sh.moveTo(...pts[0]); pts.slice(1).forEach(p => sh.lineTo(...p));
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    const m = add(new THREE.ShapeGeometry(sh), mat, 0, 0, s * (halfW(depth, bevel, f, cx, cy) + .008), { parent: g, cast: false });
    if (s < 0) m.rotation.y = Math.PI, m.scale.x = -1;
    return m;
  };

  // ---------- supersportowe w stylu Aventadora: fasetowa bryła z przekrojów (loft), przód = -X ----------
  function loft(stations, caps = true) {          // stations: tablica przekrojów, każdy = punkty [x, z, y] połowy auta (od dołu środka do góry środka)
    const pos = [], P = (q, s) => [q[0], q[2], s * q[1]], tri = (a, b, c) => pos.push(...a, ...b, ...c);
    for (let i = 0; i < stations.length - 1; i++) for (let k = 0; k < stations[i].length - 1; k++) for (const s of [1, -1]) {
      const a = P(stations[i][k], s), b = P(stations[i][k + 1], s), c = P(stations[i + 1][k + 1], s), d = P(stations[i + 1][k], s);
      tri(a, b, c); tri(a, c, d);
    }
    if (caps) for (const st of [stations[0], stations[stations.length - 1]]) {
      const ring = [...st.map(q => P(q, 1)), ...st.slice().reverse().map(q => P(q, -1))], c = ring.reduce((m, q) => [m[0] + q[0] / ring.length, m[1] + q[1] / ring.length, m[2] + q[2] / ring.length], [0, 0, 0]);
      for (let k = 0; k < ring.length; k++) tri(c, ring[k], ring[(k + 1) % ring.length]);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
  }
  function plateAt(g, pts, mat, z, s) {           // płaska wstawka na boku: pts [x, y] w płaszczyźnie boku
    const sh = new THREE.Shape(); sh.moveTo(...pts[0]); pts.slice(1).forEach(q => sh.lineTo(...q));
    const m = add(new THREE.ShapeGeometry(sh), mat, 0, 0, s * z, { parent: g, cast: false }); if (s < 0) { m.scale.z = -1; } return m;
  }
  function lamboCar(color) {
    const g = new THREE.Group();
    const body = new THREE.MeshPhysicalMaterial({ color, metalness: .45, roughness: .25, clearcoat: 1, clearcoatRoughness: .05, flatShading: true, side: THREE.DoubleSide });
    const carbon = std(0x0b0c0e, .45, .4, { flatShading: true, side: THREE.DoubleSide }), glassF = new THREE.MeshPhysicalMaterial({ color: 0x0a0d12, metalness: .6, roughness: .05, clearcoat: 1, flatShading: true, side: THREE.DoubleSide });
    // nadwozie: nos spiczasty w rzucie z góry, wysokie błotniki, wcięty bok, szeroki tył
    const ST = [
      [[-2.44, 0, .27], [-2.36, .42, .26], [-2.18, .8, .3], [-2.1, .9, .4], [-2.14, .84, .5], [-2.3, .5, .52], [-2.44, 0, .5]],
      [[-1.8, 0, .17], [-1.8, .8, .17], [-1.8, .96, .3], [-1.8, 1.0, .5], [-1.8, .98, .66], [-1.8, .74, .71], [-1.8, 0, .64]],
      [[-1.05, 0, .17], [-1.05, .8, .17], [-1.05, .95, .3], [-1.05, .99, .52], [-1.05, .96, .75], [-1.05, .74, .81], [-1.05, 0, .8]],
      [[0, 0, .17], [0, .82, .17], [0, .89, .3], [0, .9, .48], [0, .94, .77], [0, .8, .87], [0, 0, .87]],
      [[1.0, 0, .17], [1.0, .84, .17], [1.0, .97, .3], [1.0, 1.04, .52], [1.0, 1.01, .83], [1.0, .78, .93], [1.0, 0, .93]],
      [[1.75, 0, .19], [1.75, .84, .19], [1.75, .99, .32], [1.75, 1.04, .56], [1.75, .99, .85], [1.75, .76, .91], [1.75, 0, .9]],
      [[2.36, 0, .3], [2.36, .74, .3], [2.4, .9, .38], [2.42, .95, .56], [2.38, .92, .8], [2.32, .7, .86], [2.32, 0, .86]],
    ];
    add(loft(ST), body, 0, 0, 0, { parent: g });
    const halfAt = (st, y) => { const pts = st.slice(1, 6); if (y <= pts[0][2]) return pts[0][1]; for (let k = 0; k < pts.length - 1; k++) { const [, z0, y0] = pts[k], [, z1, y1] = pts[k + 1];
      if (y <= y1) return z0 + (z1 - z0) * (y - y0) / (y1 - y0); } return pts[pts.length - 1][1]; };
    const surfZ = (x, y) => { let i = 0; while (i < ST.length - 2 && ST[i + 1][3][0] < x) i++; const xa = ST[i][3][0], xb = ST[i + 1][3][0], t = Math.min(1, Math.max(0, (x - xa) / (xb - xa)));
      return halfAt(ST[i], y) * (1 - t) + halfAt(ST[i + 1], y) * t; };
    const hug = (geo, mat, s, dx = 0, dy = 0, off = .008) => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, s * (surfZ(p.getX(i) + dx, p.getY(i) + dy) + off));
      geo.translate(dx, dy, 0); geo.computeVertexNormals(); return add(geo, mat, 0, 0, 0, { parent: g, cast: false }); };
    const shapeG = pts => { const sh = new THREE.Shape(); sh.moveTo(...pts[0]); pts.slice(1).forEach(q => sh.lineTo(...q)); const geo = new THREE.ShapeGeometry(sh); return geo; };

    // kabina ze szkła + lakierowany dach
    add(loft([
      [[-1.08, .73, .8], [-1.08, .6, .82], [-1.08, 0, .84]],
      [[-.22, .8, .86], [-.18, .56, 1.1], [-.18, 0, 1.13]],
      [[.55, .82, .88], [.55, .56, 1.1], [.55, 0, 1.12]],
      [[1.4, .74, .92], [1.4, .5, .97], [1.4, 0, .98]],
    ]), glassF, 0, 0, 0, { parent: g });
    add(loft([[[-.2, .5, 1.105], [-.2, 0, 1.135]], [[.57, .5, 1.105], [.57, 0, 1.125]]]), body, 0, .006, 0, { parent: g });
    for (let i = 0; i < 5; i++) add(box(.09, .02, .78 - i * .06), carbon, 1.55 + i * .16, .93 - i * .012, 0, { parent: g, cast: false });   // żaluzje nad silnikiem
    add(box(.06, .02, 1.6), carbon, 2.28, .88, 0, { parent: g, rz: .25 });                                   // spojler
    for (const s of [-1, 1]) {
      // duży wlot za drzwiami i mniejszy nad tylnym kołem
      hug(shapeG([[.25, .34], [.95, .36], [1.0, .78], [.62, .74]]), carbon, s);
      hug(shapeG([[1.12, .82], [1.18, .74], [1.55, .74], [1.62, .84]]), carbon, s);
      // sześciokątne nadkola (ciemne tło za kołem)
      for (const wx of [-1.42, 1.36]) hug(new THREE.CircleGeometry(.47, 6, 0, Math.PI), carbon, s, wx, .3, .006);   // sześciokątne nadkola
      add(box(2.0, .07, .06), carbon, .0, .22, s * .9, { parent: g });                                      // próg
      // przód: kanciaste wloty, światła Y
      add(box(.1, .13, .34), carbon, -2.24, .34, s * .58, { parent: g, ry: s * .55, cast: false });         // kanciaste wloty z przodu
      add(box(.1, .05, .22), carbon, -2.18, .43, s * .76, { parent: g, ry: s * 1.0, rz: -.3, cast: false });
      add(box(.36, .03, .05), headM, -2.16, .49, s * .66, { parent: g, ry: s * .62, rz: .06, cast: false });
      add(box(.16, .03, .05), headM, -2.25, .45, s * .56, { parent: g, ry: -s * .4, cast: false });
      add(box(.16, .03, .05), headM, -2.06, .45, s * .78, { parent: g, ry: s * 1.3, cast: false });
      // tył: światła Y, kratka
      add(box(.05, .03, .36), tailM, 2.4, .7, s * .64, { parent: g, ry: s * .25, rz: .2, cast: false });
      add(box(.05, .16, .03), tailM, 2.4, .63, s * .5, { parent: g, rz: .4, cast: false });
      add(box(.05, .03, .14), tailM, 2.4, .6, s * .78, { parent: g, ry: -s * .3, cast: false });
      // lusterko na wysięgniku
      add(box(.04, .03, .14), carbon, -.62, .95, s * .87, { parent: g });
      add(box(.18, .09, .07), body, -.66, .97, s * .97, { parent: g });
    }
    add(box(.4, .04, 1.5), carbon, -2.25, .2, 0, { parent: g });                                            // splitter
    add(box(.04, .26, 1.4), mesh, 2.42, .52, 0, { parent: g, cast: false });                                // kratka z tyłu
    for (let i = -3; i <= 3; i++) add(box(.3, .12, .02), carbon, 2.3, .24, i * .2, { parent: g, cast: false });   // dyfuzor
    add(new THREE.CylinderGeometry(.11, .11, .14, 6), std(0x2a2b2e, .3, .9), 2.43, .34, 0, { parent: g, rz: Math.PI / 2 });   // sześciokątny wydech
    add(new THREE.CylinderGeometry(.08, .08, .15, 6), std(0x050505, 1), 2.44, .34, 0, { parent: g, rz: Math.PI / 2, cast: false });
    // koła: duże, czarne felgi z żółtymi zaciskami (bez ciemnych półkoli z addWheels – nadkola są wyżej)
    for (const s of [-1, 1]) for (const [x, z] of [[-1.42, .9], [1.36, .94]]) {
      const w = wheel(std(0x141518, .25, .85), 10, { sw: .035, twist: .3, caliper: true, r: .37 }); w.position.set(x, .37, s * z); if (s < 0) w.rotation.y = Math.PI; g.add(w);
    }
    return g;
  }

  // 1) klinowe supersportowe (pomarańczowe, jak na zdjęciu nr 1)
  function wedgeCar(color) {
    const g = new THREE.Group(), body = paint(color), D = 1.84, B = .1;
    const f = (x, y) => (1 - .24 * sstep(y, .5, 1.12)) * (1 - .32 * sstep(x, -1.1, -2.45)) * (1 - .07 * sstep(x, 1.6, 2.45));
    add(bodyGeo(sideShape([-2.36, .25], [[-2.43, .36], [-2.38, .47], [-1.9, .58], [-1.35, .69], [-.95, .79], [.2, .86], [1.0, .92], [1.75, .935], [2.32, .89], [2.44, .76], [2.45, .5]], [2.22, .24]), D, B, f), body, 0, 0, 0, { parent: g });
    const fc = (x, y) => (1 - .43 * sstep(y, .84, 1.13)) * (1 - .1 * sstep(x, -.3, -1.0));
    add(bodyGeo(sideShape([-1.0, .74], [[-.55, .94], [-.12, 1.1], [.5, 1.125], [1.1, 1.0], [1.62, .9]], [1.62, .84]), 1.5, .08, fc), glass, 0, 0, 0, { parent: g });
    add(bodyGeo(sideShape([-.32, 1.0], [[-.14, 1.115], [.5, 1.138], [1.08, 1.015]], [1.0, .99]), .86, .03, () => 1), body, 0, 0, 0, { parent: g });
    for (const s of [-1, 1]) {
      sidePlate(g, [[.5, .4], [1.3, .47], [1.38, .84], [.72, .76]], D, B, f, mesh, s);                // duży wlot boczny
      sidePlate(g, [[1.45, .8], [1.9, .8], [1.95, .88], [1.45, .86]], D, B, f, black, s);
      add(box(1.9, .1, .05), black, .1, .33, s * .99, { parent: g, cast: false });                    // próg
      add(box(.42, .045, .05), headM, -2.0, .61, s * .6, { parent: g, ry: s * .55, rz: .12, cast: false });
      add(box(.2, .04, .05), headM, -2.13, .56, s * .5, { parent: g, ry: -s * .3, cast: false });
      add(box(.26, .16, .38), mesh, -2.28, .37, s * .55, { parent: g, ry: s * .25, cast: false });
      add(box(.05, .04, .42), tailM, 2.44, .74, s * .55, { parent: g, ry: s * .3, cast: false });
      add(box(.05, .2, .04), tailM, 2.43, .67, s * .38, { parent: g, rz: .5, cast: false });
      add(box(.16, .07, .05), body, -.62, .95, s * .88, { parent: g });
    }
    add(box(.06, .22, 1.3), mesh, 2.45, .5, 0, { parent: g, cast: false });
    for (let i = 0; i < 5; i++) add(box(.07, .025, .9), black, 1.55 + i * .15, .935, 0, { parent: g, cast: false });
    addWheels(g, [-1.38, 1.36], .87, .37, std(0x15161a, .2, .8), 10, { sw: .035, twist: .25, caliper: true });
    return g;
  }
  // 2) zaokrąglone hipersportowe, dwukolorowe z łukiem „C” (jak na zdjęciu nr 2)
  function hyperCar(c1, c2) {
    const g = new THREE.Group(), body = paint(c1, .2), dark = paint(c2, .25), D = 1.82, B = .1;
    const f = (x, y) => (1 - .22 * sstep(y, .55, 1.05)) * (1 - .2 * sstep(x, -1.3, -2.32)) * (1 - .1 * sstep(x, 1.6, 2.32));
    add(bodyGeo(sideShape([-2.2, .26], [[-2.31, .34], [-2.27, .62], [-1.7, .8], [-1.0, .88], [.2, .92], [1.25, 1.0], [2.0, .98], [2.3, .9], [2.32, .5]], [2.1, .25]), D, B, f), body, 0, 0, 0, { parent: g });
    add(bodyGeo(sideShape([-2.2, .25], [[-2.33, .3], [-2.31, .44], [-1.2, .47], [.5, .47], [1.6, .5], [2.33, .52]], [2.12, .24]), D + .02, B, f), dark, 0, 0, 0, { parent: g });
    const fc = (x, y) => (1 - .4 * sstep(y, .9, 1.22)) * (1 - .1 * sstep(x, -.4, -1.1));
    add(bodyGeo(sideShape([-1.05, .84], [[-.6, 1.02], [-.2, 1.17], [.6, 1.21], [1.3, 1.04], [1.7, .97]], [1.7, .9]), 1.52, .08, fc), glass, 0, 0, 0, { parent: g });
    add(bodyGeo(sideShape([-.35, 1.13], [[-.15, 1.2], [.6, 1.228], [1.25, 1.06]], [1.2, 1.04]), .92, .03, () => 1), body, 0, 0, 0, { parent: g });
    for (const s of [-1, 1]) {
      sidePlate(g, [[.3, .83], [.3, .5], [.85, .5], [.96, .68], [.76, .83]], D, B, f, dark, s);
      sideTube(g, [[.1, .85], [.78, .84], [1.06, .66], [.92, .44], [.28, .4]], D, B, f, .03, chrome, s);   // łuk C
      for (let k = 0; k < 4; k++) add(new THREE.TorusGeometry(.034, .012, 6, 14), headM, -2.02 + k * .07, .67 - k * .012, s * (.48 + k * .08), { parent: g, ry: Math.PI / 2, cast: false });
      add(box(.18, .07, .05), body, -.65, .99, s * .88, { parent: g });
      add(box(1.9, .08, .05), dark, .1, .3, s * .99, { parent: g, cast: false });
    }
    const hs = new THREE.Shape(); hs.moveTo(-.29, .66); hs.lineTo(-.29, .48); hs.quadraticCurveTo(-.29, .24, 0, .24); hs.quadraticCurveTo(.29, .24, .29, .48); hs.lineTo(.29, .66);
    hs.lineTo(.22, .66); hs.lineTo(.22, .48); hs.quadraticCurveTo(.22, .31, 0, .31); hs.quadraticCurveTo(-.22, .31, -.22, .48); hs.lineTo(-.22, .66); hs.lineTo(-.29, .66);
    const hg = new THREE.ExtrudeGeometry(hs, { depth: .08, bevelEnabled: true, bevelSize: .015, bevelThickness: .015, bevelSegments: 2 }); hg.rotateY(-Math.PI / 2);
    add(hg, dark, -2.27, 0, 0, { parent: g });                                                        // podkowa
    add(box(.04, .32, .42), mesh, -2.28, .48, 0, { parent: g, cast: false });
    for (const s of [-1, 1]) add(box(.06, .2, .55), mesh, -2.26, .38, s * .62, { parent: g, cast: false });
    add(box(.05, .05, 1.6), tailM, 2.33, .78, 0, { parent: g, cast: false });
    addWheels(g, [-1.35, 1.38], .86, .38, std(0x2a3a6a, .2, .85), 12, { sw: .03, twist: .35, r: .38 });
    return g;
  }
  // 3) luksusowa limuzyna, dwukolorowa z chromowanym grillem (jak na zdjęciu nr 3)
  function luxSedan(cTop, cBottom) {
    const g = new THREE.Group(), top = paint(cTop, .2), bot = paint(cBottom, .18), D = 1.74, B = .1;
    const f = (x, y) => (1 - .12 * sstep(y, .6, 1.08)) * (1 - .12 * sstep(x, -2.1, -2.78)) * (1 - .08 * sstep(x, 2.2, 2.8));
    add(bodyGeo(sideShape([-2.62, .3], [[-2.76, .42], [-2.77, .62], [-2.72, .8], [-2.3, .87], [-1.2, .905], [.5, .935], [1.9, .965], [2.62, .955], [2.78, .82], [2.79, .55]], [2.64, .3]), D, B, f), bot, 0, 0, 0, { parent: g });
    add(bodyGeo(sideShape([-2.72, .79], [[-2.62, .86], [-2.25, .94], [-1.4, .99], [-.62, 1.015]], [-.62, .9]), D, B, f), top, 0, 0, 0, { parent: g });
    add(bodyGeo(sideShape([1.72, .95], [[1.8, 1.07], [2.45, 1.08], [2.74, 1.0], [2.79, .9]], [2.79, .9]), D, B, f), top, 0, 0, 0, { parent: g });
    add(bodyGeo(sideShape([-.65, .9], [[-.62, .96]], [1.75, .97]), D - .02, B, f), top, 0, 0, 0, { parent: g });
    const fc = (x, y) => (1 - .28 * sstep(y, .98, 1.48)) * (1 - .06 * sstep(x, -.2, -.7));
    add(bodyGeo(sideShape([-.66, .96], [[-.3, 1.2], [.05, 1.45], [1.0, 1.48], [1.5, 1.32], [1.78, 1.07]], [1.78, .97]), 1.56, .08, fc), glass, 0, 0, 0, { parent: g });
    add(bodyGeo(sideShape([-.05, 1.42], [[.1, 1.488], [1.0, 1.505], [1.45, 1.36]], [1.4, 1.34]), 1.12, .04, () => 1), top, 0, 0, 0, { parent: g });
    for (const s of [-1, 1]) {
      sideTube(g, [[-2.6, .86], [-1.2, .9], [.5, .93], [1.9, .962], [2.68, .95]], D, B, f, .018, chrome, s);
      sideTube(g, [[-2.5, .36], [0, .37], [2.55, .38]], D, B, f, .014, chrome, s);
      const zG = s * (halfW(1.56, .08, fc, .5, 1.2) + .012);
      add(box(.07, .48, .03), top, .48, 1.21, zG * .99, { parent: g, cast: false });
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(-.5, 1.02, zG), V(.0, 1.38, zG * .93), V(1.0, 1.42, zG * .93), V(1.62, 1.08, zG)]), 30, .012, 5), chrome, 0, 0, 0, { parent: g, cast: false });
      add(box(.48, .05, .05), headM, -2.62, .77, s * .58, { parent: g, ry: s * .35, cast: false });
      add(box(.05, .06, .5), tailM, 2.77, .86, s * .55, { parent: g, cast: false });
      const ring = add(new THREE.TorusGeometry(.13, .02, 6, 20), chrome, -2.74, .42, s * .62, { parent: g, ry: Math.PI / 2, cast: false }); ring.scale.set(1.5, .8, 1);
      add(box(.03, .14, .36), mesh, -2.75, .42, s * .62, { parent: g, cast: false });
      add(box(.2, .1, .06), top, -.55, 1.06, s * .86, { parent: g });
    }
    const gr = new THREE.Group(); gr.position.set(-2.8, .62, 0); g.add(gr);
    add(box(.06, .34, .7), mesh, 0, 0, 0, { parent: gr, cast: false });
    for (const y of [.19, -.19]) add(box(.08, .04, .74), chrome, 0, y, 0, { parent: gr });
    for (const z of [-.37, .37]) add(box(.08, .42, .04), chrome, 0, 0, z, { parent: gr });
    for (let i = 0; i < 15; i++) add(box(.05, .34, .012), chrome, -.015, 0, -.32 + i * .0457, { parent: gr, cast: false });
    const plate = canvasTex(256, 56, (x, w, h) => { x.fillStyle = '#f4f4f0'; x.fillRect(0, 0, w, h); x.fillStyle = '#1d3f9c'; x.fillRect(0, 0, 22, h);
      x.fillStyle = '#111'; x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('FA 777', w / 2 + 10, h / 2 + 2); });
    add(new THREE.PlaneGeometry(.52, .115), new THREE.MeshStandardMaterial({ map: plate, roughness: .5 }), -2.83, .36, 0, { parent: g, ry: -Math.PI / 2, cast: false });
    addWheels(g, [-1.62, 1.62], .83, .37, chrome, 28, { sw: .014, r: .37 });
    return g;
  }

  // ustawienie: zaparkowane za graczem, nieruchome
  function gWagon(color) {
    const g = new THREE.Group(), body = paint(color, .3), rimM = std(0x1a1b1e, .3, .8);
    add(box(4.5, .82, 1.9), body, 0, .82, 0, { parent: g });                                               // dolna bryła
    add(box(2.85, .78, 1.84), body, .55, 1.62, 0, { parent: g });                                         // kabina
    add(box(2.95, .05, 1.88), body, .55, 2.03, 0, { parent: g });                                         // dach
    for (const xx of [-.15, .55, 1.25]) add(box(.04, .04, 1.9), black, xx, 2.08, 0, { parent: g });     // relingi dachowe
    add(box(.06, .72, 1.6), glass, -.86, 1.64, 0, { parent: g, rz: .04 });                                // szyba przednia (prawie pionowa)
    for (const sz of [-1, 1]) {
      for (const [x0, w] of [[-.3, .95], [.68, .95], [1.55, .55]]) add(box(w, .55, .03), glass, x0, 1.66, sz * .93, { parent: g });   // okna boczne
      for (const wx of [-1.42, 1.38]) add(box(1.08, .2, .22), black, wx, 1.12, sz * .95, { parent: g });  // poszerzenia nadkoli
      add(box(2.3, .05, .2), black, 0, .45, sz * 1.02, { parent: g });                                    // stopień
      add(box(.18, .07, .1), black, -.8, 1.55, sz * 1.0, { parent: g });                                  // lusterko
      add(new THREE.CylinderGeometry(.11, .11, .06, 18), headM, -2.26, 1.0, sz * .63, { parent: g, rz: Math.PI / 2, cast: false });   // okrągłe reflektory
      add(new THREE.TorusGeometry(.12, .018, 6, 18), chrome, -2.27, 1.0, sz * .63, { parent: g, ry: Math.PI / 2, cast: false });
      add(box(.14, .06, .12), std(0xffa21a, .4, 0, { emissive: 0x6a3a00 }), -2.0, 1.25, sz * .82, { parent: g, cast: false });   // kierunkowskazy na błotnikach
      add(box(.05, .32, .14), tailM, 2.27, .95, sz * .82, { parent: g, cast: false });
    }
    add(box(.06, .34, .78), mesh, -2.26, .98, 0, { parent: g, cast: false });                              // grill
    for (let i = 0; i < 3; i++) add(box(.03, .025, .78), chrome, -2.29, .88 + i * .1, 0, { parent: g, cast: false });
    add(box(.22, .2, 2.0), black, -2.32, .52, 0, { parent: g });                                          // zderzaki
    add(box(.2, .2, 2.0), black, 2.32, .52, 0, { parent: g });
    const spare = new THREE.Group(); spare.position.set(2.4, 1.2, 0); spare.rotation.y = Math.PI / 2; g.add(spare);   // koło zapasowe na tylnych drzwiach
    add(new THREE.TorusGeometry(.32, .13, 10, 22), rubber, 0, 0, 0, { parent: spare }); add(new THREE.CylinderGeometry(.33, .33, .2, 22), body, 0, 0, -.02, { parent: spare, rx: Math.PI / 2 });
    addWheels(g, [-1.42, 1.38], .9, .44, rimM, 6, { sw: .07, r: .44 });
    return g;
  }
  const park = (g, x, z, ry) => { g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g); };
  park(lamboCar(0xff5a0a), -4.6, -5.6, 1.99);       // sportowe z przodu, przodem do gracza
  park(gWagon(0x1d1f22), -3.2, -10.2, 2.2);      // terenowe z tyłu

  // ---------- światło ----------
  scene.add(new THREE.HemisphereLight(0x8a94a8, 0x2a2c30, .45));
  const sun = new THREE.DirectionalLight(0xcfd8ff, .35);
  sun.position.set(4, 18, 8); sun.target.position.set(0, 0, -6); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0004; sun.shadow.normalBias = .02;
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 2, far: 45 });
  scene.add(sun, sun.target);
  const key = new THREE.SpotLight(0xfff0dc, 40, 16, .4, .65, 1.2); key.position.set(0, 9, 3); key.target.position.set(0, .6, 0); scene.add(key, key.target);

  addEventListener('resize', () => mirror.getRenderTarget().setSize(...mirrorSize()));
  return { update() {} };
}
