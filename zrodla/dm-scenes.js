// Deathmatch – sceny 3D poza areną: sklep po śmierci (pokaz broni / pancerza i fasolka gracza) oraz podium po meczu
// (trzy miejsca, każdy z trójki tańczy własną emotkę, konfetti). Rysuje je ten sam renderer co grę, z własną kamerą.
import * as THREE from 'three';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const damp = THREE.MathUtils.damp;

// ---------------- pancerz na fasolce: kamizelka (pas wokół tułowia) i hełm (czasza na czubku) ----------------
// Kształt z profilu korpusu (profAt: półosie przekroju na wysokości y), więc kamizelka przylega do fasolki.
export function makeGear(ctx) {
  const { profAt, BODY } = ctx, pr = [0, 0];
  function shell(y0, y1, grow, segY = 10, segA = 28, cap = false) {
    const pos = [], idx = [];
    for (let j = 0; j <= segY; j++) {
      const y = y0 + (y1 - y0) * (j / segY); profAt(y, pr);
      for (let i = 0; i <= segA; i++) { const a = (i / segA) * Math.PI * 2; pos.push(BODY.cx + Math.sin(a) * pr[0] * grow, y, BODY.cz - Math.cos(a) * pr[1] * grow); }
    }
    for (let j = 0; j < segY; j++) for (let i = 0; i < segA; i++) { const a = j * (segA + 1) + i, b = a + segA + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    if (cap) { const top = pos.length / 3; pos.push(BODY.cx, y1 + 0.012, BODY.cz); for (let i = 0; i < segA; i++) { const a = segY * (segA + 1) + i; idx.push(a, top, a + 1); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  const h = BODY.y1 - BODY.y0;
  const vestGeo = shell(BODY.y0 + h * 0.34, BODY.y0 + h * 0.70, 1.075, 8, 30);
  const strapGeo = shell(BODY.y0 + h * 0.66, BODY.y0 + h * 0.715, 1.09, 1, 30);
  const helmGeo = shell(BODY.y0 + h * 0.86, BODY.y1, 1.12, 8, 30, true);
  const rimGeo = shell(BODY.y0 + h * 0.855, BODY.y0 + h * 0.875, 1.17, 1, 30);
  const vestMat = new THREE.MeshStandardMaterial({ color: 0x2c3326, roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide });
  const strapMat = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.7 });
  const helmMat = new THREE.MeshStandardMaterial({ color: 0x3a4230, roughness: 0.6, metalness: 0.1, side: THREE.DoubleSide });
  const plateGeo = new THREE.BoxGeometry(0.2, 0.17, 0.025);
  return function attach(bean) {
    const t = bean.userData.torso, g = new THREE.Group(), vest = new THREE.Group(), helm = new THREE.Group();
    vest.add(new THREE.Mesh(vestGeo, vestMat), new THREE.Mesh(strapGeo, strapMat));
    profAt(BODY.y0 + h * 0.52, pr);
    const plate = new THREE.Mesh(plateGeo, strapMat); plate.position.set(BODY.cx, BODY.y0 + h * 0.52, BODY.cz - pr[1] * 1.1); vest.add(plate);
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.04), vestMat); pouch.position.set(BODY.cx + 0.09, BODY.y0 + h * 0.42, BODY.cz - pr[1] * 1.12); vest.add(pouch);
    const p2 = pouch.clone(); p2.position.x = BODY.cx - 0.09; vest.add(p2);
    helm.add(new THREE.Mesh(helmGeo, helmMat), new THREE.Mesh(rimGeo, strapMat));
    for (const m of [...vest.children, ...helm.children]) { m.castShadow = true; m.userData.gear = true; }
    g.add(vest, helm); t.add(g); vest.visible = helm.visible = false;
    bean.userData.gear = { vest, helm, set(v, hm) { vest.visible = !!v; helm.visible = !!hm; } };
    return bean.userData.gear;
  };
}

// ---------------- emotki (pozy rąk przez IK, ruch tułowia) ----------------
const _t = V3();
function armsAt(ctx, ud, fR, fL) { for (const [i, def, f] of [[0, ctx.armR, fR], [1, ctx.armL, fL]]) { f(_t, def.shoulder, def.a + def.b, i ? -1 : 1); ctx.solveArm(ud.arms[i], def, _t, { avoid: false }); } }
const down = (o, S, L, side) => o.set(S.x + side * 0.13, S.y - L * 0.8, S.z - 0.02);
export const EMOTES = {
  // 1. miejsce: radość – skoki z rękami w górze
  cheer(ctx, b, t) {
    const ud = b.userData, j = Math.max(0, Math.sin(t * 6)); b.position.y = (b.userData.baseY || 0) + j * 0.32;
    ctx.poseLegs(ud, 0, 0, j > 0.2 ? 0.7 : 0, 0); ud.upper.position.y = 0; ctx.leanTorso(ud, 0.08, 0, Math.sin(t * 3) * 0.06);
    armsAt(ctx, ud, (o, S, L, s) => o.set(S.x + s * 0.2, S.y + L * (0.75 + 0.12 * Math.sin(t * 12)), S.z - 0.05), (o, S, L, s) => o.set(S.x + s * 0.2, S.y + L * (0.75 + 0.12 * Math.sin(t * 12 + 1)), S.z - 0.05));
  },
  // 2. miejsce: machanie ręką
  wave(ctx, b, t) {
    const ud = b.userData; b.position.y = b.userData.baseY || 0; ctx.poseLegs(ud, 0, 0, 0, 0);
    ud.upper.position.y = Math.sin(t * 2) * 0.01; ctx.leanTorso(ud, 0.02, Math.sin(t * 1.3) * 0.12, -0.08);
    armsAt(ctx, ud, (o, S, L, s) => o.set(S.x + s * (0.28 + Math.sin(t * 9) * 0.14), S.y + L * 0.7, S.z - 0.08), down);
  },
  // 3. miejsce: taniec – kołysanie biodrami, ręce na zmianę w górę
  dance(ctx, b, t) {
    const ud = b.userData; b.position.y = (b.userData.baseY || 0) + Math.abs(Math.sin(t * 5)) * 0.06; ctx.poseLegs(ud, t * 5, 0.25, 0, 0.15 + Math.sin(t * 10) * 0.1);
    ud.upper.position.y = -0.04 + Math.abs(Math.sin(t * 5)) * 0.03; ctx.leanTorso(ud, 0.04, Math.sin(t * 2.5) * 0.35, Math.sin(t * 5) * 0.14);
    const a = Math.sin(t * 5) > 0;
    armsAt(ctx, ud, (o, S, L, s) => a ? o.set(S.x + s * 0.15, S.y + L * 0.8, S.z - 0.1) : o.set(S.x + s * 0.05, S.y - L * 0.1, S.z - L * 0.6),
      (o, S, L, s) => !a ? o.set(S.x + s * 0.15, S.y + L * 0.8, S.z - 0.1) : o.set(S.x + s * 0.05, S.y - L * 0.1, S.z - L * 0.6));
  },
  // oklaski (pozostali)
  clap(ctx, b, t) {
    const ud = b.userData, k = (Math.sin(t * 14) + 1) * 0.5; b.position.y = b.userData.baseY || 0; ctx.poseLegs(ud, 0, 0, 0, 0); ctx.leanTorso(ud, 0.05, 0, 0);
    armsAt(ctx, ud, (o, S, L, s) => o.set(s * (0.02 + k * 0.1), S.y - 0.12, S.z - L * 0.62), (o, S, L, s) => o.set(s * (0.02 + k * 0.1), S.y - 0.12, S.z - L * 0.62));
  },
  idle(ctx, b, t) {
    const ud = b.userData, br = Math.sin(t * 2.1); b.position.y = b.userData.baseY || 0; ctx.poseLegs(ud, 0, 0, 0, 0); ud.upper.position.y = br * 0.006;
    ctx.leanTorso(ud, 0.02 + br * 0.012, Math.sin(t * 0.7) * 0.07, Math.sin(t * 1.1) * 0.025); ud.body.scale.set(1 + br * 0.012, 1 - br * 0.012, 1 + br * 0.012);
    armsAt(ctx, ud, down, down);
  },
};

// ---------------- tło: gradient nieba (zachód jak w lobby Vice Beach) ----------------
function skyDome(top, mid, bot) {
  return new THREE.Mesh(new THREE.SphereGeometry(80, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, mid: { value: new THREE.Color(mid) }, bot: { value: new THREE.Color(bot) } },
    vertexShader: 'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 top,mid,bot;varying vec3 vP;void main(){float h=vP.y;vec3 c=mix(bot,mid,smoothstep(-.1,.25,h));c=mix(c,top,smoothstep(.25,.85,h));gl_FragColor=vec4(c,1.);\n#include <colorspace_fragment>\n}' }));
}
function floorMat(c1, c2) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d');
  const g = x.createRadialGradient(128, 128, 10, 128, 128, 128); g.addColorStop(0, c1); g.addColorStop(1, c2); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.35, metalness: 0.2 });
}

// ---------------- sklep ----------------
export function createShopScene(ctx) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0b0f); scene.fog = new THREE.Fog(0x0b0b0f, 9, 22);
  const cam = new THREE.PerspectiveCamera(32, 16 / 9, 0.05, 60); cam.position.set(4.6, 1.25, 0.25); cam.lookAt(0, 1.05, 0.25);
  scene.add(new THREE.HemisphereLight(0xd8d8ff, 0x181820, 0.75));
  const key = new THREE.SpotLight(0xffffff, 40, 14, 0.55, 0.6, 1.4); key.position.set(3.5, 5, 1.5); key.target.position.set(0, 1, 0); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); scene.add(key, key.target);
  const rimP = new THREE.PointLight(0xff4fa3, 9, 9, 1.6); rimP.position.set(-2.2, 2.2, 2.6); scene.add(rimP);
  const rimC = new THREE.PointLight(0x47d6ff, 6, 9, 1.6); rimC.position.set(-2.2, 1.6, -2.8); scene.add(rimC);
  scene.add(new THREE.DirectionalLight(0xffffff, 0.6).translateX(4).translateY(2));
  const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 48), floorMat('#2a2a33', '#0b0b0f')); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  // neonowa linia na podłodze (styl Vice)
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.55, 1.6, 64), new THREE.MeshBasicMaterial({ color: 0xff4fa3, transparent: true, opacity: 0.55, fog: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(-3.2, 0.005, -2.75); scene.add(ring);
  // fasolka gracza (po prawej z tyłu) w aktualnym wyposażeniu
  const bean = ctx.makeBean(ctx.color()); bean.position.set(-3.2, 0, -2.75); bean.rotation.y = -Math.PI / 2 - 0.55; bean.traverse((o) => { if (o.isMesh) o.castShadow = true; }); scene.add(bean);
  ctx.gear(bean);
  // pokaz: broń obracająca się na środku albo fasolka w pancerzu
  const stage = new THREE.Group(); stage.position.set(0, 1.18, 0.55); scene.add(stage);
  const guns = {}; let cur = null, curId = '', tAnim = 0, spinT = 0;
  const armorBean = ctx.makeBean(ctx.color()); armorBean.visible = false; armorBean.position.set(0.2, 0, 0.55); armorBean.rotation.y = -Math.PI / 2 + 0.35; scene.add(armorBean); ctx.gear(armorBean);
  function gunModel(id) {
    if (guns[id]) return guns[id];
    const w = ctx.createWeapon(id, { fx: false }), g = w.group; const box = new THREE.Box3().setFromObject(g), len = box.max.z - box.min.z || 1;
    const k = (w.pistol ? 1.2 : 2.6) / len; g.scale.setScalar(k);
    const c = box.getCenter(V3()); const holder = new THREE.Group(); g.position.set(-c.x * k, -c.y * k, -c.z * k); holder.add(g);
    holder.traverse((o) => { if (o.isMesh) o.castShadow = true; }); guns[id] = holder; return holder;
  }
  function preview(id) {
    if (id === curId) return; curId = id; tAnim = 0;
    if (cur) stage.remove(cur); cur = null; armorBean.visible = false;
    if (id === 'vest' || id === 'helmet') { armorBean.visible = true; armorBean.userData.gear.set(true, id === 'helmet'); return; }
    cur = gunModel(id); stage.add(cur);
  }
  function setLoadout(color, armor, helmet, skin) { if (skin) ctx.skin(bean, skin); bean.userData.gear.set(armor > 0, helmet && armor > 0); if (skin) ctx.skin(armorBean, skin); }
  function render(renderer, dt) {
    tAnim += dt; spinT += dt;
    const w = renderer.domElement.width, h = renderer.domElement.height; if (w && h && Math.abs(cam.aspect - w / h) > 1e-3) { cam.aspect = w / h; cam.updateProjectionMatrix(); }
    if (cur) { cur.rotation.y = Math.sin(spinT * 0.6) * 0.35; cur.rotation.x = Math.sin(spinT * 0.45) * 0.05; cur.position.y = Math.sin(spinT * 1.1) * 0.02; const s = Math.min(1, tAnim * 4); cur.scale.setScalar(0.85 + 0.15 * s); }
    if (armorBean.visible) { armorBean.rotation.y = -Math.PI / 2 + 0.35 + Math.sin(spinT * 0.6) * 0.5; EMOTES.idle(ctx, armorBean, spinT); }
    EMOTES.idle(ctx, bean, spinT + 1.3);
    renderer.render(scene, cam);
  }
  return { preview, setLoadout, render };
}

// ---------------- podium ----------------
export function createPodiumScene(ctx) {
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x4a2a6a, 18, 60);
  scene.add(skyDome(0x2a1650, 0xc04a8c, 0xffa25e));
  const cam = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 120);
  scene.add(new THREE.HemisphereLight(0xffd0e8, 0x2a1840, 1.1));
  const sun = new THREE.DirectionalLight(0xffb07a, 2.4); sun.position.set(-6, 9, 8); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 }); scene.add(sun);
  const pink = new THREE.PointLight(0xff4fa3, 18, 14, 1.5); pink.position.set(4, 3, 3); scene.add(pink);
  const cyan = new THREE.PointLight(0x47d6ff, 12, 14, 1.5); cyan.position.set(-4, 3, 2); scene.add(cyan);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), floorMat('#5a3a6a', '#1e1028')); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  // stopnie podium: 2 – 1 – 3
  const H = [1.2, 0.85, 0.6], X = [0, 1.9, -1.9], cols = [0xffd55a, 0xdfe3ea, 0xe39a62];
  const numTex = (n, c) => { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const x = cv.getContext('2d'); x.fillStyle = '#16121f'; x.fillRect(0, 0, 256, 256);
    x.fillStyle = c; x.font = '700 170px "Barlow Condensed", Oswald, Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(n), 128, 140);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const steps = [];
  for (let i = 0; i < 3; i++) {
    const top = new THREE.MeshStandardMaterial({ color: cols[i], roughness: 0.35, metalness: 0.5 }), side = new THREE.MeshStandardMaterial({ color: 0x16121f, roughness: 0.6 });
    const front = new THREE.MeshStandardMaterial({ map: numTex(i + 1, '#' + cols[i].toString(16).padStart(6, '0')), roughness: 0.6 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.7, H[i], 1.5), [side, side, top, side, side, front]); m.position.set(X[i], H[i] / 2, 0); m.castShadow = m.receiveShadow = true; scene.add(m); steps.push(m);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.03, 1.52), new THREE.MeshBasicMaterial({ color: cols[i] })); edge.position.set(X[i], H[i] + 0.005, 0); scene.add(edge);
  }
  // konfetti
  const N = 260, cg = new THREE.PlaneGeometry(0.06, 0.035), cm = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, vertexColors: false });
  const conf = new THREE.InstancedMesh(cg, cm, N), cd = [], palette = [0xff4fa3, 0xffd55a, 0x47d6ff, 0xffffff, 0x9b8cf4, 0x7dffb0], _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = V3(1, 1, 1), _p = V3();
  for (let i = 0; i < N; i++) { cd.push({ p: V3((Math.random() - 0.5) * 9, 4 + Math.random() * 6, (Math.random() - 0.5) * 4), v: V3((Math.random() - 0.5) * 0.4, -0.6 - Math.random() * 0.8, (Math.random() - 0.5) * 0.4), r: V3(Math.random() * 6, Math.random() * 6, Math.random() * 6), w: V3(Math.random() * 6, Math.random() * 6, Math.random() * 6) }); conf.setColorAt(i, new THREE.Color(palette[i % palette.length])); }
  scene.add(conf);
  let beans = [], t = 0;
  const EM = ['cheer', 'wave', 'dance'];
  function setup(top3) {     // top3: [{skin, color}] w kolejności miejsc 1, 2, 3
    for (const b of beans) scene.remove(b); beans = [];
    top3.forEach((s, i) => { if (!s) return; const b = ctx.makeBean(s.color || 0xf0b440); if (s.skin) ctx.skin(b, s.skin); b.userData.baseY = H[i]; b.position.set(X[i], H[i], 0); b.rotation.y = 0; b.traverse((o) => { if (o.isMesh) o.castShadow = true; }); scene.add(b); beans.push(b); b.userData.emote = EM[i]; b.userData.slot = i; });
    t = 0;
  }
  const _v = V3();
  function render(renderer, dt) {
    t += dt;
    const w = renderer.domElement.width, h = renderer.domElement.height; if (w && h && Math.abs(cam.aspect - w / h) > 1e-3) { cam.aspect = w / h; cam.updateProjectionMatrix(); }
    // kamera: najazd i powolny łuk
    const k = Math.min(1, t / 3.5), e = 1 - Math.pow(1 - k, 3), a = Math.sin(t * 0.18) * 0.22;
    const dist = 12.5 - e * 4.3; cam.position.set(Math.sin(a) * dist - 1.35, 2.1 + (1 - e) * 1.6, -Math.cos(a) * dist); cam.lookAt(-1.35, 1.35, 0);   // podium po lewej, po prawej miejsce na tabelę
    for (const b of beans) { const em = t > 0.6 + b.userData.slot * 0.35 ? b.userData.emote : 'idle'; EMOTES[em](ctx, b, t + b.userData.slot); }
    for (let i = 0; i < N; i++) { const c = cd[i]; c.p.addScaledVector(c.v, dt); c.p.x += Math.sin(t * 2 + i) * dt * 0.2; c.r.addScaledVector(c.w, dt); if (c.p.y < 0.02) { c.p.y = 7 + Math.random() * 3; }
      _e.set(c.r.x, c.r.y, c.r.z); _q.setFromEuler(_e); _m.compose(c.p, _q, _s); conf.setMatrixAt(i, _m); }
    conf.instanceMatrix.needsUpdate = true;
    renderer.render(scene, cam);
    // pozycje tabliczek z nazwami nad głowami (piksele CSS)
    const cw = renderer.domElement.clientWidth, ch = renderer.domElement.clientHeight;
    return beans.map((b) => { _v.set(b.position.x, H[b.userData.slot] + 1.95, 0).project(cam); return [(_v.x * 0.5 + 0.5) * cw, (-_v.y * 0.5 + 0.5) * ch]; });
  }
  function positions() { return [0, 1, 2]; }
  return { setup, render, positions };
}
