// Bean FPS – system broni: statystyki, instancje modeli, animacje (strzał, przeładowanie, zmiana), łuski, dźwięki.
// Modele broni są w ./weapons/<id>.js (modele GLB z ./weapons/<id>-glb.js, składane przez ./weapons/_glb.js),
// dźwięki – próbki z biblioteki gry w ./weapons/<id>-snd.js (odtwarzanie: ./weapons/_audio.js).
import * as THREE from 'three';
import { weaponAudio } from './weapons/_audio.js';
export { weaponAudio };

// kolejność = indeksy w paczkach sieciowych (serwer: serwer/dm.mjs WIDS, pierwsze cztery także serwer/mecz.mjs)
export const WEAPON_IDS = ['akm', 'm4a1', 'glock17', 'deagle', 'spas12', 'mp5k', 'akmgold', 'p90'];
export const PISTOL_ID = 'glock17';                  // pistolet startowy (Deathmatch)

// Statystyki. recoil.pitch/yaw w radianach na strzał, spread w radianach (połowa kąta stożka). snd = klucz próbek w _audio.js.
export const WEAPON_STATS = {
  // obrażenia (ciało / głowa) wspólne dla wszystkich trybów – te same liczby są w serwer/mecz.mjs (1v1) i serwer/dm.mjs (Deathmatch):
  // AKM 25/75, AKM Gold 34/90, M4A1 25/75, Glock-17 20/60, Desert Eagle 33/99, SPAS-12 10/15 na śrucinę, MP5K 18/54, P90 17/51
  akm:     { name: 'AKM',          slot: 1, auto: true,  rpm: 600, dmg: 25, head: 3,   mag: 30, reserve: 90,  reload: 2.45, draw: .55,
             recoil: { pitch: .0125, yaw: .0045, kick: .045, rot: .06 }, spread: { hip: .0075, ads: .0016, move: 1.15, bloom: .14 }, snd: 'akm',
             fov: 52, relief: .085, recoilTravel: .055 },
  m4a1:    { name: 'M4A1',         slot: 2, auto: true,  rpm: 700, dmg: 25, head: 3,   mag: 30, reserve: 90,  reload: 2.3,  draw: .55,
             recoil: { pitch: .0092, yaw: .0032, kick: .036, rot: .045 }, spread: { hip: .0065, ads: .0011, move: 1.0, bloom: .11 }, snd: 'm4a1',
             fov: 48, relief: .085, recoilTravel: 0 },
  glock17: { name: 'Glock-17',     slot: 3, auto: false, rpm: 400, dmg: 20, head: 3,   mag: 17, reserve: 102, reload: 1.75, draw: .4,
             recoil: { pitch: .0065, yaw: .0028, kick: .028, rot: .09 }, spread: { hip: .006, ads: .002, move: .7, bloom: .12 }, snd: 'glock17',
             fov: 62, relief: .3, recoilTravel: .022 },
  deagle:  { name: 'Desert Eagle', slot: 4, auto: false, rpm: 267, dmg: 33, head: 3,   mag: 7, reserve: 35,  reload: 2.2,  draw: .5,
             recoil: { pitch: .021, yaw: .006, kick: .05, rot: .2 },  spread: { hip: .009, ads: .0016, move: 1.0, bloom: .32 }, snd: 'deagle',
             fov: 60, relief: .3, recoilTravel: .03 },
  // strzelba (śruciny, pompka) i pistolet maszynowy; w Deathmatch dokładne liczby podaje serwer
  spas12:  { name: 'SPAS-12',      slot: 5, auto: false, rpm: 72,  dmg: 10, head: 1.5, mag: 8, reserve: 32,  reload: 2.6,  draw: .6, pellets: 9, pelletSpread: .052, pump: true,
             recoil: { pitch: .045, yaw: .008, kick: .09, rot: .16 }, spread: { hip: .004, ads: .003, move: .4, bloom: .1 }, snd: 'spas12',
             fov: 60, relief: .1, recoilTravel: 0 },
  mp5k:    { name: 'MP5K',         slot: 6, auto: true,  rpm: 900, dmg: 18, head: 3,   mag: 30, reserve: 120, reload: 2.1,  draw: .45,
             recoil: { pitch: .0072, yaw: .004, kick: .03, rot: .05 }, spread: { hip: .0075, ads: .0022, move: .8, bloom: .09 }, snd: 'mp5k',
             fov: 58, relief: .085, recoilTravel: 0 },
};
// Złoty AKM: ta sama broń co AKM (dźwięki, animacje, odrzut), inny model i mocniejszy strzał (34 / 90); tylko dla wybranych graczy (restricted)
WEAPON_STATS.akmgold = { ...WEAPON_STATS.akm, name: 'AKM Gold', slot: 7, restricted: true, dmg: 34, head: 90 / 34 };
// P90: darmowa broń za grę w Deathmatch (serwer: konto.limited zawiera 'p90'); pistolet maszynowy z magazynkiem na 50 naboi
WEAPON_STATS.p90 = { name: 'P90', slot: 8, auto: true, rpm: 900, dmg: 17, head: 3, mag: 50, reserve: 100, reload: 3.1, draw: .45, restricted: true,
  recoil: { pitch: .006, yaw: .0035, kick: .028, rot: .045 }, spread: { hip: .0075, ads: .0022, move: .8, bloom: .09 }, snd: 'p90',
  fov: 56, relief: .085, recoilTravel: 0 };

// ---------------- dostęp do broni z ograniczeniami ----------------
// Broń z restricted: true widać (w slotach, później w sklepie) tylko u graczy, którym dano do niej dostęp.
// Dostęp daje serwer: konto.limited (np. ['akmgold'] – złoty AKM dla pierwszych 100 kont z meczem 1v1, 'p90' – za grę w Deathmatch) albo admin. Lobby woła setWeaponAccess(weaponAccessFor(konto))
// przy każdej zmianie konta, a gra dostaje zdarzenie 'fasolka:weapon-access'.
const ACCESS = new Set();
export function weaponAccessFor(acct) {
  const own = new Set((acct && acct.limited) || []);
  return Object.keys(WEAPON_STATS).filter((id) => WEAPON_STATS[id].restricted && acct && (acct.admin || own.has(id)));
}
export function setWeaponAccess(ids) {
  const next = new Set(ids || []); if (next.size === ACCESS.size && [...next].every((id) => ACCESS.has(id))) return;
  ACCESS.clear(); for (const id of next) ACCESS.add(id);
  try { dispatchEvent(new CustomEvent('fasolka:weapon-access', { detail: [...ACCESS] })); } catch {}
}
export const weaponAllowed = (id) => !!WEAPON_STATS[id] && (!WEAPON_STATS[id].restricted || ACCESS.has(id));

// ---------------- modele ----------------
const MODELS = {};
export async function loadWeaponModels() {
  await Promise.all(WEAPON_IDS.map(async id => {
    try { MODELS[id] = await import(`./weapons/${id}.js`); if (typeof MODELS[id].build !== 'function') throw new Error('brak build()'); if (MODELS[id].ready) await MODELS[id].ready; }
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
    pump: (m.parts && m.parts.pump) || null, pumpRest: m.parts && m.parts.pump ? m.parts.pump.position.clone() : null,
    bolt: (m.parts && m.parts.bolt) || null, boltRest: m.parts && m.parts.bolt ? { p: m.parts.bolt.position.clone(), q: m.parts.bolt.quaternion.clone() } : null, cycle: 0,
    // pompka / zamek: skok z modelu; dłonie wracają do pozycji spoczynkowych (gripR/gripL zmieniają się w trakcie przeładowania)
    pumpStroke: m.pumpStroke || .085, boltLift: m.boltLift || 1.1, boltTravel: m.boltTravel || .09,
    boltKnob: A.boltKnob ? A.boltKnob.clone() : null, gripRRest: A.gripR.clone(), gripLRest: A.gripL.clone(),
    reloadKind: m.parts && m.parts.pump ? 'shells' : 'mag', rack: 0, rackT: 0,
    slideBack: 0, slideLocked: false,
    // kierunek wysuwania magazynka (układ inner): z modelu albo w dół wzdłuż osi magazynka, lekko do tyłu
    magDir: (m.magDir ? m.magDir.clone() : new THREE.Vector3(0, -1, m.hands === 'pistol' ? .06 : .18)).normalize(),
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

// Przebieg pompki / zamka, c ∈ [0,1] – po strzale (inst.cycle) i na końcu przeładowania pustej broni (inst.rack).
// pompka: szybko do tyłu (łuska wylatuje w tylnym położeniu), krótka pauza, do przodu
const pumpBack = c => ss(0, .36, c) * (1 - ss(.5, .88, c));
// zamek: prawa dłoń na kulę rączki → w górę → do tyłu (wyrzut łuski) → do przodu → w dół → dłoń wraca na chwyt
const boltPhase = c => ({ hand: ss(0, .14, c) * (1 - ss(.86, 1, c)), lift: ss(.11, .27, c) * (1 - ss(.72, .86, c)), back: ss(.28, .45, c) * (1 - ss(.54, .7, c)) });
export const EJECT_AT = { pump: .3, bolt: .42 };                 // chwila wyrzutu łuski w przebiegu (tylne położenie)
const cycleNow = inst => Math.max(inst.cycle || 0, inst.rackT && performance.now() - inst.rackT < 150 ? inst.rack : 0);
// Ruch całej broni przy pompowaniu / pracy zamkiem (dodawany do pozy w widoku z 1. osoby i w 3. osobie)
const _cp = { pitch: 0, roll: 0, yaw: 0, lift: 0, back: 0, hand: 0 };
export function cyclePose(inst) {
  _cp.pitch = _cp.roll = _cp.yaw = _cp.lift = _cp.back = _cp.hand = 0;
  const c = cycleNow(inst); if (c <= 0 || c >= 1) return _cp;
  if (inst.pump) { const k = pumpBack(c); _cp.pitch = -.04 * k; _cp.roll = .05 * k; _cp.back = .014 * k; _cp.lift = -.006 * k; }
  else if (inst.bolt) { const b = boltPhase(c); _cp.hand = b.hand; _cp.roll = .16 * b.hand; _cp.pitch = -.05 * b.hand + .025 * b.back; _cp.yaw = .05 * b.hand; _cp.lift = -.014 * b.hand; _cp.back = .012 * b.back; }
  return _cp;
}

const _kn = new THREE.Vector3();
export function applyParts(inst, magOff, magVisible, magRot = 0) {
  if (inst.slide && inst.slideRest) inst.slide.position.set(inst.slideRest.x, inst.slideRest.y, inst.slideRest.z + inst.slideBack);
  const c = cycleNow(inst);
  // strzelba: czółenko do tyłu i do przodu, lewa dłoń jedzie razem z nim
  if (inst.pump && inst.pumpRest) {
    const s = inst.pumpStroke * pumpBack(c);
    inst.pump.position.set(inst.pumpRest.x, inst.pumpRest.y, inst.pumpRest.z + s);
    inst.gripL.copy(inst.gripLRest); inst.gripL.z += s;
  }
  // AWP: rączka w górę (rotateZ w układzie zamka obróconym o π), zamek do tyłu i z powrotem; prawa dłoń trzyma kulę rączki
  if (inst.bolt && inst.boltRest) {
    const b = boltPhase(c);
    inst.bolt.position.set(inst.boltRest.p.x, inst.boltRest.p.y, inst.boltRest.p.z + inst.boltTravel * b.back);
    inst.bolt.quaternion.copy(inst.boltRest.q); inst.bolt.rotateZ(-inst.boltLift * b.lift);
    inst.gripR.copy(inst.gripRRest);
    if (inst.boltKnob && b.hand > 0) {
      _kn.copy(inst.boltKnob).applyQuaternion(inst.bolt.quaternion).add(inst.bolt.position); _kn.y -= .014; _kn.z += .012;   // dłoń obejmuje kulę od dołu
      inst.gripR.lerp(_kn, b.hand);
    }
  }
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
  const r = { roll: 0, pitch: 0, yaw: 0, lift: 0, side: 0, magOff: _off.set(0, 0, 0), magVisible: true, magRot: 0, hand: 'grip', handBlend: 0, click: 0, slideBack: null, shell: 0 };
  const d = inst.magDir;
  if (inst.reloadKind === 'shells') return shellReload(inst, t, empty, r);
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
    if (inst.bolt && empty && t > .72 && t < .98) { inst.rack = (t - .72) / .25; inst.rackT = performance.now(); }   // AWP: pusty – przeładowanie zamkiem po nowym magazynku
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

// Strzelba: nabój po naboju. Broń przechylona oknem ładowania do lewej dłoni; dłoń bierze nabój z ładownicy,
// podaje pod okno i wciska kciukiem do rury magazynka (SHELLS razy), na końcu – gdy była pusta – przeładowanie pompką.
// „Magazynek” modelu to pojedynczy nabój: magOff przesuwa go, a dłoń (tryb 'mag') trzyma go od spodu.
const SHELLS = 4, S0 = .1, S1 = .78, _pe = new THREE.Vector3();
function shellReload(inst, t, empty, r) {
  const d = inst.magDir, tilt = ss(0, .1, t) * (1 - ss(.86, .97, t));
  r.roll = -.55 * tilt; r.pitch = .12 * tilt; r.yaw = .12 * tilt; r.lift = .05 * tilt; r.side = -.05 * tilt;   // górą w prawo: okno ładowania do lewej dłoni, w kadrze
  pouchPoint(inst, _pp).sub(inst.anchors.magWell).addScaledVector(d, -.1);    // przesunięcie naboju, gdy dłoń jest przy ładownicy
  _pe.copy(d).multiplyScalar(.045);                                         // nabój tuż pod oknem ładowania
  r.hand = 'mag'; r.magVisible = false;
  if (t < S0) { r.magOff.copy(_pp); r.handBlend = ss(.02, S0, t); }
  else if (t < S1) {
    const f = (t - S0) / (S1 - S0) * SHELLS, k = Math.min(SHELLS - 1, Math.floor(f)), u = f - k;
    if (u < .42) r.magOff.copy(_pp).lerp(_pe, ss(0, .42, u));                                // z ładownicy pod okno
    else if (u < .64) r.magOff.copy(_pe).multiplyScalar(1 - ss(.42, .64, u));                // wciśnięcie do rury
    else if (k < SHELLS - 1) r.magOff.set(0, 0, 0).lerp(_pp, ss(.64, 1, u));                 // po następny nabój
    else r.magOff.set(0, 0, 0);
    r.magVisible = u < .62; r.handBlend = 1; r.shell = k + (u >= .6 ? 1 : 0);
  } else { r.handBlend = 1 - ss(S1, S1 + .07, t); r.shell = SHELLS; }                         // dłoń wraca na czółenko
  r.click = t >= .7 ? 1 : 0;
  if (empty && t > .86 && t < .99) { inst.rack = (t - .86) / .12; inst.rackT = performance.now(); }
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
  const brass = new THREE.MeshStandardMaterial({ color: 0xd2a84c, metalness: 1, roughness: .28 }), hull = new THREE.MeshStandardMaterial({ color: 0xa61d16, metalness: 0, roughness: .45 });
  const gRifle = new THREE.CylinderGeometry(.0055, .0058, .039, 12), gPistol = new THREE.CylinderGeometry(.0048, .005, .019, 12);
  const gShot = new THREE.CylinderGeometry(.0102, .0102, .062, 14), gMag = new THREE.CylinderGeometry(.0068, .0076, .066, 12);   // łuska śrutowa, .338 (AWP)
  const pool = [];
  for (let i = 0; i < 48; i++) { const m = new THREE.Mesh(gRifle, brass); m.visible = false; m.castShadow = true; scene.add(m); pool.push({ m, v: new THREE.Vector3(), w: new THREE.Vector3(), life: 0, bounced: false }); }
  let k = 0;
  const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _r = new THREE.Vector3();
  return {
    pool,
    spawn(inst, rnd = Math.random, layer = 0) {
      const s = pool[k = (k + 1) % pool.length]; const m = s.m;
      m.geometry = inst.pump ? gShot : inst.bolt ? gMag : inst.pistol ? gPistol : gRifle; m.material = inst.pump ? hull : brass; m.layers.set(layer);
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
// Próbki z biblioteki gry (weapons/_audio.js); głośności względem siebie dobrane do nagrań. Dopóki próbki się dekodują
// (pierwsze ułamki sekundy po włączeniu dźwięku), strzał jest syntezowany jak dawniej.
const SAMPLE_VOL = { shot: .5, far: .75, draw: .4, magOut: .5, magIn: .55, magHit: .45, bolt: .5, boltFwd: .5, pump: .6, shell: .9, dryPistol: .45, dryRifle: .45 };
// odtwórz próbkę broni: weaponSfx(AC, master, 'akm', 'magIn'); zwraca false, gdy próbki brak (jeszcze się dekoduje)
export function weaponSfx(AC, out, id, key, { vol = 1, rate = 1, lp = 0, at = 0 } = {}) {
  if (!AC || !out) return false;
  const B = weaponAudio(AC), bank = soundBank(id), src = B.has(bank, key) ? bank : 'common';
  return B.play(src, key, { out, vol: vol * (SAMPLE_VOL[key] || .5), rate, lp, at });
}
weaponSfx.has = (AC, id, key) => !!AC && weaponAudio(AC).has(soundBank(id), key);
const soundBank = (id) => (WEAPON_STATS[id] && WEAPON_STATS[id].snd) || id;   // złoty AKM gra próbkami AKM
// strzał: kind = WEAPON_STATS[id].snd; dist [m] – strzał innego gracza (z daleka: nagranie „distant” i stłumione wysokie tony)
export function weaponSound(AC, out, noiseBuf, kind, vol = 1, dist = 0) {
  if (!AC) return;
  const rate = .97 + Math.random() * .06;
  if (dist > 22 && weaponSfx(AC, out, kind, 'far', { vol, rate, lp: dist > 45 ? 2600 : 0 })) return;
  if (weaponSfx(AC, out, kind, 'shot', { vol, rate, lp: dist > 10 ? Math.max(2200, 9000 - dist * 260) : 0 })) return;
  weaponSynth(AC, out, noiseBuf, SYNTH[kind] || 'ak', vol);
}
const SYNTH = { akm: 'ak', m4a1: 'ak', glock17: 'pistol', deagle: 'pistol', spas12: 'shotgun', mp5k: 'pistol' };
function weaponSynth(AC, out, noiseBuf, kind, vol = 1) {
  if (!AC || !noiseBuf) return;
  const t = AC.currentTime;
  const P = {
    ak:        { lp0: 4600, lp1: 380, g: .62, dec: .26, th: 115, tg: .7, td: .16, click: 0 },
    pistol:    { lp0: 6200, lp1: 700, g: .48, dec: .17, th: 175, tg: .45, td: .1, click: 0 },
    shotgun:   { lp0: 3800, lp1: 220, g: .78, dec: .36, th: 80,  tg: .9,  td: .2,  click: 0 },
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
