// Bean FPS – system broni: statystyki, instancje modeli, animacje (strzał, przeładowanie, zmiana), łuski, dźwięki.
// Modele broni są w ./weapons/<id>.js (kontrakt: ./weapons/SPEC.md).
import * as THREE from 'three';

export const WEAPON_IDS = ['ak47', 'm4a1s', 'glock', 'usps'];

// Statystyki. recoil.pitch/yaw w radianach na strzał, spread w radianach (połowa kąta stożka).
export const WEAPON_STATS = {
  ak47:  { name: 'AK-47',    slot: 1, auto: true,  rpm: 600, dmg: 36, head: 3,   mag: 30, reserve: 90,  reload: 2.45, draw: .55,
           recoil: { pitch: .0125, yaw: .0045, kick: .045, rot: .06 }, spread: { hip: .0075, ads: .0016, move: 1.15, bloom: .14 }, snd: 'ak',
           fov: 52, relief: .085, recoilTravel: .055 },
  m4a1s: { name: 'M4A1-S',   slot: 2, auto: true,  rpm: 600, dmg: 33, head: 3,   mag: 25, reserve: 75,  reload: 2.3,  draw: .55,
           recoil: { pitch: .0088, yaw: .003,  kick: .034, rot: .045 }, spread: { hip: .0065, ads: .0012, move: 1.0, bloom: .11 }, snd: 'rifleSup',
           fov: 52, relief: .085, recoilTravel: .02 },
  glock: { name: 'Glock-18', slot: 3, auto: false, rpm: 400, dmg: 22, head: 2.5, mag: 20, reserve: 120, reload: 1.75, draw: .4,
           recoil: { pitch: .0065, yaw: .0028, kick: .028, rot: .09 }, spread: { hip: .006, ads: .002, move: .7, bloom: .12 }, snd: 'pistol',
           fov: 62, relief: .3, recoilTravel: .022 },
  usps:  { name: 'USP-S',    slot: 4, auto: false, rpm: 350, dmg: 35, head: 2.5, mag: 12, reserve: 24,  reload: 1.95, draw: .4,
           recoil: { pitch: .0085, yaw: .003,  kick: .03,  rot: .1 },  spread: { hip: .005, ads: .0012, move: .7, bloom: .13 }, snd: 'pistolSup',
           fov: 62, relief: .3, recoilTravel: .024 },
};

// ---------------- modele ----------------
const MODELS = {};
export async function loadWeaponModels() {
  await Promise.all(WEAPON_IDS.map(async id => {
    try { MODELS[id] = await import(`./weapons/${id}.js`); if (typeof MODELS[id].build !== 'function') throw new Error('brak build()'); }
    catch (e) { console.warn('Broń', id, '– używam modelu zastępczego:', e && e.message); MODELS[id] = await import('./weapons/_example.js'); }
  }));
}

let flashTex = null;
function flashTexture() {
  if (flashTex) return flashTex;
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,235,1)'); g.addColorStop(.25, 'rgba(255,214,120,.95)'); g.addColorStop(.6, 'rgba(255,140,40,.35)'); g.addColorStop(1, 'rgba(255,110,20,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  // promienie
  x.globalCompositeOperation = 'lighter'; x.strokeStyle = 'rgba(255,200,110,.5)'; x.lineWidth = 3;
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; x.beginPath(); x.moveTo(64, 64); x.lineTo(64 + Math.cos(a) * 60, 64 + Math.sin(a) * 60); x.stroke(); }
  flashTex = new THREE.CanvasTexture(c); flashTex.colorSpace = THREE.SRGBColorSpace; return flashTex;
}

// Instancja broni: group (skalowany wrapper) → inner (model). Kotwice w układzie inner = wrapper przed skalą,
// więc group.localToWorld(anchor) daje pozycję w świecie.
export function createWeapon(id, { fx = true } = {}) {
  const mod = MODELS[id] || MODELS[WEAPON_IDS[0]];
  const m = mod.build({});
  const A = m.anchors, st = WEAPON_STATS[id];
  const group = new THREE.Group(); group.add(m.group);
  const muzzle = new THREE.Object3D(); muzzle.position.copy(A.muzzle); m.group.add(muzzle);
  const magPivot = m.parts && m.parts.mag || null, slide = m.parts && m.parts.slide || null;
  const inst = {
    id, stats: st, model: m, group, inner: m.group, hands: m.hands, pistol: m.hands === 'pistol', suppressed: !!m.suppressed,
    anchors: A, muzzle, mag: magPivot || new THREE.Object3D(), slide,
    gripR: A.gripR.clone(), gripL: A.gripL.clone(), gripLTP: A.gripL.clone(), stockEnd: A.stockEnd.clone(),
    sightY: A.sightRear.y, boreY: m.boreY, flashScale: m.flashScale || 1,
    magRest: magPivot ? { p: magPivot.position.clone(), q: magPivot.quaternion.clone() } : null,
    slideRest: slide ? slide.position.clone() : null,
    slideBack: 0, slideLocked: false,
    // kierunek wysuwania magazynka (układ inner): w dół wzdłuż osi magazynka, lekko do przodu
    magDir: new THREE.Vector3(0, -1, m.hands === 'pistol' ? .06 : .18).normalize(),
  };
  if (fx) {
    const mat = new THREE.MeshBasicMaterial({ map: flashTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const flash = new THREE.Group(), s = .2 * inst.flashScale;
    for (let i = 0; i < 2; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(s, s), mat); p.rotation.z = i * Math.PI / 2; flash.add(p); }
    const side = new THREE.Mesh(new THREE.PlaneGeometry(s * .8, s * 1.9), mat); side.rotation.x = Math.PI / 2; side.position.z = -s * .55; flash.add(side);
    const side2 = side.clone(); side2.rotation.y = Math.PI / 2; flash.add(side2);
    flash.position.copy(A.muzzle).add(new THREE.Vector3(0, 0, -s * .3)); flash.visible = false; m.group.add(flash);
    const light = new THREE.PointLight(0xffb45a, 0, 5, 2); light.position.copy(A.muzzle).add(new THREE.Vector3(0, 0, -.08)); m.group.add(light);
    inst.flash = flash; inst.flashLight = light;
  }
  group.userData.weapon = inst;
  return inst;
}

// ---------------- animacje części ----------------
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export { ss as smoothstep };

export function applyParts(inst, magOff, magVisible, magRot = 0) {
  if (inst.slide && inst.slideRest) inst.slide.position.set(inst.slideRest.x, inst.slideRest.y, inst.slideRest.z + inst.slideBack);
  if (inst.magRest) {
    inst.mag.position.copy(inst.magRest.p);
    if (magOff) inst.mag.position.add(magOff);
    inst.mag.quaternion.copy(inst.magRest.q);
    if (magRot) inst.mag.rotateX(magRot);
    inst.mag.visible = magVisible !== false;
  }
}

// Przeładowanie: t ∈ [0,1]. Zwraca pozę broni (przechył, uniesienie), przesunięcie magazynka (układ inner)
// i cel lewej dłoni: {mode:'grip'|'mag'|'pouch', blend} – blend = waga celu "mag/pouch" względem chwytu.
const _off = new THREE.Vector3(), _pp = new THREE.Vector3(), _dd = new THREE.Vector3();
export function reloadPose(inst, t, empty) {
  const r = { roll: 0, pitch: 0, yaw: 0, lift: 0, side: 0, magOff: _off.set(0, 0, 0), magVisible: true, magRot: 0, hand: 'grip', handBlend: 0, click: 0, slideBack: null };
  const d = inst.magDir;
  if (!inst.pistol) {
    const tilt = ss(0, .14, t) * (1 - ss(.82, .97, t));
    r.roll = .42 * tilt; r.pitch = -.12 * tilt; r.yaw = .1 * tilt; r.lift = -.02 * tilt; r.side = -.015 * tilt;
    if (t < .47) {                                    // wyjęcie starego magazynka
      const out = ss(.14, .3, t), drop = ss(.3, .46, t);
      r.magOff.copy(d).multiplyScalar(.1 * out + .3 * drop); r.magRot = .25 * drop;
      r.magVisible = t < .45;
    } else {                                          // nowy magazynek z dołu → w gniazdo
      const up = ss(.48, .62, t), ins = ss(.62, .7, t);
      r.magOff.copy(d).multiplyScalar(.3 * (1 - up) + .1 * (1 - ins)); r.magRot = .25 * (1 - up);
    }
    r.hand = 'mag'; r.handBlend = ss(.05, .14, t) * (1 - ss(.72, .84, t));
    r.click = t >= .7 ? 1 : 0;
  } else {
    const tilt = ss(0, .12, t) * (1 - ss(.86, .98, t));
    r.roll = -.32 * tilt; r.pitch = .22 * tilt; r.lift = .015 * tilt;
    if (t < .4) {                                     // magazynek wypada sam
      const out = ss(.08, .2, t), fall = ss(.2, .34, t);
      r.magOff.copy(d).multiplyScalar(.12 * out + .35 * fall); r.magVisible = t < .3;
      r.hand = 'pouch'; r.handBlend = ss(.12, .32, t);
    } else {                                          // lewa dłoń przynosi nowy magazynek: startuje dokładnie z ładownicy
      const up = ss(.4, .6, t), ins = ss(.6, .7, t);
      if (t < .6) {
        pouchPoint(inst, _pp).sub(inst.anchors.magWell).addScaledVector(d, -.085);     // przesunięcie magazynka, gdy dłoń jest przy ładownicy
        r.magOff.copy(_pp).lerp(_dd.copy(d).multiplyScalar(.08), up);
      } else r.magOff.copy(d).multiplyScalar(.08 * (1 - ins));
      r.hand = 'mag'; r.handBlend = 1 - ss(.72, .84, t);
    }
    r.click = t >= .7 ? 1 : 0;
    if (empty) r.slideBack = t < .86 ? 1 : 1 - ss(.86, .91, t);   // pusty: zamek w tylnym położeniu do końca przeładowania
  }
  return r;
}

// Zmiana broni: t ∈ [0,1] (0 = schowana, 1 = gotowa)
export function drawPose(t) {
  const k = 1 - ss(0, 1, t);
  return { drop: .26 * k, pitch: -.95 * k, roll: .35 * k };
}

// Punkt chwytu magazynka (układ inner) – tu trzyma lewa dłoń przy przeładowaniu
const _g = new THREE.Vector3();
export function magGrabPoint(inst, magOff, out = new THREE.Vector3()) {
  const A = inst.anchors;
  return out.copy(A.magWell).add(magOff).addScaledVector(inst.magDir, inst.pistol ? .085 : .1);
}
export function pouchPoint(inst, out = new THREE.Vector3()) {
  return inst.pistol ? out.set(-.17, -.3, .12) : out.set(-.16, -.34, .08);
}

// ---------------- łuski ----------------
export function createShells(scene) {
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a043, metalness: 1, roughness: .32 });
  const gRifle = new THREE.CylinderGeometry(.0055, .0058, .039, 10), gPistol = new THREE.CylinderGeometry(.0048, .005, .019, 10);
  const pool = [];
  for (let i = 0; i < 48; i++) { const m = new THREE.Mesh(gRifle, brass); m.visible = false; m.castShadow = true; scene.add(m); pool.push({ m, v: new THREE.Vector3(), w: new THREE.Vector3(), life: 0, bounced: false }); }
  let k = 0;
  const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _r = new THREE.Vector3();
  return {
    pool,
    spawn(inst, rnd = Math.random, layer = 0) {
      const s = pool[k = (k + 1) % pool.length]; const m = s.m;
      m.geometry = inst.pistol ? gPistol : gRifle; m.layers.set(layer);
      inst.inner.updateWorldMatrix(true, false);
      m.position.copy(inst.anchors.ejectPort).applyMatrix4(inst.inner.matrixWorld);
      inst.inner.getWorldQuaternion(_q);
      m.quaternion.copy(_q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
      _r.set(1, 0, 0).applyQuaternion(_q);
      s.v.copy(_r).multiplyScalar(1.6 + rnd() * .8).add(new THREE.Vector3(0, 1.3 + rnd() * .6, 0).applyQuaternion(_q)).add(new THREE.Vector3(0, 0, .25).applyQuaternion(_q));
      s.w.set((rnd() - .5) * 30, (rnd() - .5) * 30, (rnd() - .5) * 30);
      s.life = 1.6; s.bounced = false; m.visible = true;
    },
    update(dt, groundY = 0) {
      for (const s of pool) {
        if (s.life <= 0) continue; s.life -= dt;
        s.v.y -= 9.8 * dt; s.m.position.addScaledVector(s.v, dt);
        s.m.rotation.x += s.w.x * dt; s.m.rotation.y += s.w.y * dt; s.m.rotation.z += s.w.z * dt;
        if (s.m.position.y < groundY + .006) { s.m.position.y = groundY + .006; if (!s.bounced) { s.v.multiplyScalar(.35); s.v.y = Math.abs(s.v.y) * .6 + .6; s.bounced = true; s.w.multiplyScalar(.4); } else { s.v.set(0, 0, 0); s.w.multiplyScalar(.9); } }
        if (s.life <= 0) s.m.visible = false;
      }
    },
  };
}

// ---------------- dźwięk ----------------
// out: węzeł docelowy (np. master gain), noise(): bufor szumu
export function weaponSound(AC, out, noiseBuf, kind, vol = 1) {
  if (!AC || !noiseBuf) return;
  const t = AC.currentTime;
  const P = {
    ak:        { lp0: 4600, lp1: 380, g: .62, dec: .26, th: 115, tg: .7, td: .16, click: 0 },
    rifleSup:  { lp0: 1500, lp1: 260, g: .26, dec: .12, th: 90,  tg: .3, td: .09, click: .14 },
    pistol:    { lp0: 6200, lp1: 700, g: .48, dec: .17, th: 175, tg: .45, td: .1, click: 0 },
    pistolSup: { lp0: 1800, lp1: 320, g: .22, dec: .1,  th: 120, tg: .22, td: .07, click: .16 },
  }[kind] || {};
  const s = AC.createBufferSource(); s.buffer = noiseBuf;
  const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(P.lp0, t); f.frequency.exponentialRampToValueAtTime(P.lp1, t + P.dec * .85);
  const g = AC.createGain(); g.gain.setValueAtTime(P.g * vol, t); g.gain.exponentialRampToValueAtTime(.001, t + P.dec);
  s.connect(f).connect(g).connect(out); s.start(t, Math.random() * .2); s.stop(t + P.dec + .05);
  const o = AC.createOscillator(); o.frequency.setValueAtTime(P.th * 1.4, t); o.frequency.exponentialRampToValueAtTime(P.th * .35, t + P.td);
  const g2 = AC.createGain(); g2.gain.setValueAtTime(P.tg * vol, t); g2.gain.exponentialRampToValueAtTime(.001, t + P.td + .02);
  o.connect(g2).connect(out); o.start(t); o.stop(t + P.td + .05);
  if (P.click) {                                     // mechanika zamka słyszalna przy tłumiku
    const c = AC.createBufferSource(); c.buffer = noiseBuf; const bf = AC.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 2600; bf.Q.value = 4;
    const cg = AC.createGain(); cg.gain.setValueAtTime(P.click * vol, t + .012); cg.gain.exponentialRampToValueAtTime(.001, t + .06);
    c.connect(bf).connect(cg).connect(out); c.start(t + .01, .1); c.stop(t + .08);
  }
}
