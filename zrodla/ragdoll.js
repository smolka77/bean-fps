// Efekty walki fasolek: reakcja na trafienie, upadek po śmierci i krople przy trafieniu.
//  • react(root, dir, head, point) – szarpnięcie tułowia (sprężyna) w stronę lotu kuli; w głowę mocniej i szybciej, uginają się kolana.
//  • pose(root, dt)                 – dokłada szarpnięcie do pozy z gry (wywołać po pozowaniu postaci, co klatkę).
//  • die(root, o)                   – zamiast obrotu na bok: prosta fizyka Verlet (miednica, czubek głowy, stopy, broń) z kolizją
//                                     z bryłami mapy (te same AABB co ruch gracza) i podłogą – postać osuwa się na kolana i pada
//                                     w kierunku strzału, ręce i nogi bezwładnie; nigdy nie wchodzi w ściany ani pod podłogę.
//  • stepDeath(root, dt)            – krok upadku; zwraca false, gdy ciało już zniknęło (płynne wygaszenie pod koniec życia).
//  • clear(root)                    – po odrodzeniu: poza, przezroczystość i broń w rękach jak przed śmiercią.
//  • hitFx(point, normal, dir, head)– krople z puli (jedna siatka instancyjna, zero nowych obiektów w trakcie walki).
//  • flash(mats, k)                 – błysk trafienia na materiałach fasolki (k: 1 -> 0).
// Koszt: 3 punkty ciała + 1 broń na martwą postać, ~120 kroków/s tylko do czasu, aż ciało się uspokoi (potem nic nie liczy),
// kolizje tylko z bryłami z najbliższego otoczenia (lista zbierana raz, przy śmierci).
import * as THREE from 'three';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const G = -17;                  // grawitacja ciała (trochę mocniejsza niż prawdziwa: upadek ma być szybki i ciężki)
const STEP = 1 / 120;           // krok fizyki
const NEAR = 2.8;               // promień zbierania brył wokół ciała (m)
const VMAX = 9;                 // limit prędkości punktu (m/s): wypchnięcie z bryły nigdy nie wystrzeli ciała w powietrze

export function createCombatFx(ctx) {
  const { scene, boxes, leanTorso, solveArm, armR, armL, BODY, legLen } = ctx;
  // kapsuła korpusu: dwie kule (miednica A, głowa B) o promieniu R; stopy F; dłoń nie schodzi pod najniższy punkt ciała
  const R = Math.min(BODY.rx, BODY.rz) * 0.96;
  const AY = BODY.y0 + R, BY = BODY.y1 - R, AB = BY - AY;
  const FR = 0.09;                                   // promień „stóp”
  const LEG = legLen;                                // długość nogi (biodro -> stopa)
  const FOOT_SPAN = AY - FR;                         // odległość miednica – stopy w staniu
  const GUN_R = 0.06;

  // ---------------------------------------------------------------- reakcja na trafienie
  const _q = new THREE.Quaternion(), _v = V3(), _w = V3(), _u = V3();
  function hitState(root) {
    const ud = root.userData;
    return ud.hr || (ud.hr = { x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0, dip: 0, vd: 0, on: false, lastDir: V3(0, 0, 1), lastHead: false, lastT: -9 });
  }
  function react(root, dir, head, point) {
    const h = hitState(root);
    if (!dir) return;
    h.lastDir.copy(dir); h.lastDir.y = 0; if (h.lastDir.lengthSq() < 1e-6) h.lastDir.set(0, 0, 1); h.lastDir.normalize();
    h.lastHead = !!head; h.lastT = performance.now();
    // kierunek kuli w układzie postaci (przód fasolki = −Z)
    _q.copy(root.quaternion).invert(); _v.copy(dir).applyQuaternion(_q); _v.y = 0; if (_v.lengthSq() < 1e-6) return; _v.normalize();
    const k = head ? 7.5 : 4.2;
    h.vx += _v.z * k;                                  // obrót wokół X: + = góra do tyłu (+Z)
    h.vz += -_v.x * k;                                 // obrót wokół Z: − = góra w stronę +X
    if (point) {                                       // trafienie z boku osi skręca tułów
      _w.copy(point).sub(root.position).applyQuaternion(_q);
      h.vy += clamp(_w.x * _v.z - _w.z * _v.x, -0.4, 0.4) * (head ? 9 : 6);
    }
    h.vd += head ? 0.9 : 0.55;                         // kolana lekko się uginają
    h.on = true;
  }
  function pose(root, dt) {
    const h = root.userData.hr; if (!h || !h.on) return;
    // sprężyna z tłumieniem (lekko niedotłumiona: krótkie odbicie i powrót)
    const K = 210, C = 15, KD = 260, CD = 24;
    h.vx += (-K * h.x - C * h.vx) * dt; h.vz += (-K * h.z - C * h.vz) * dt; h.vy += (-K * h.y - C * h.vy) * dt; h.vd += (-KD * h.dip - CD * h.vd) * dt;
    h.x = clamp(h.x + h.vx * dt, -0.45, 0.45); h.z = clamp(h.z + h.vz * dt, -0.45, 0.45); h.y = clamp(h.y + h.vy * dt, -0.5, 0.5); h.dip = clamp(h.dip + h.vd * dt, 0, 0.12);
    if (Math.abs(h.x) + Math.abs(h.z) + Math.abs(h.y) + h.dip + Math.abs(h.vx) + Math.abs(h.vz) + Math.abs(h.vy) + Math.abs(h.vd) < 1e-3) { h.on = false; h.x = h.z = h.y = h.dip = h.vx = h.vz = h.vy = h.vd = 0; return; }
    const ud = root.userData, t = ud.torso.rotation;
    leanTorso(ud, t.x + h.x, t.y + h.y, t.z + h.z);
    ud.upper.position.y -= h.dip;
  }

  // ---------------------------------------------------------------- błysk trafienia
  function flash(mats, k) {
    const e = mats.skin.emissive;
    if (k > 0) { k = Math.min(1, k); e.setRGB(0.62 * k, 0.2 * k * k, 0.16 * k * k); } else e.setScalar(0);
    if (mats.body && mats.body.emissive !== e) mats.body.emissive.copy(e);
  }

  // ---------------------------------------------------------------- krople (pula)
  const DROPS = 72;
  const dropMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), DROPS);
  dropMesh.frustumCulled = false; dropMesh.castShadow = false; dropMesh.receiveShadow = false;
  dropMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const drops = [], _m = new THREE.Matrix4(), _c = new THREE.Color(), _s = V3(), _qi = new THREE.Quaternion();
  for (let i = 0; i < DROPS; i++) { drops.push({ p: V3(), v: V3(), life: 0, max: 1, size: 0.02 }); dropMesh.setColorAt(i, _c.set(0xb3262b)); }
  // jedna niewidoczna (zerowa) instancja od startu: shader kompiluje się przy wczytaniu, nie przy pierwszym trafieniu
  dropMesh.count = 1; _m.makeScale(0, 0, 0); dropMesh.setMatrixAt(0, _m); dropMesh.instanceMatrix.needsUpdate = true;
  scene.add(dropMesh);
  let dropNext = 0;
  const COLS = [0x9e1d24, 0xc22f33, 0xe0524a, 0x7d151b];
  function hitFx(point, normal, dir, head) {
    const n = head ? 12 : 7;
    for (let i = 0; i < n; i++) {
      const d = drops[dropNext]; const idx = dropNext; dropNext = (dropNext + 1) % DROPS;
      d.p.copy(point);
      // część kropel leci z kulą (wylot), część odbija się od powierzchni
      const out = Math.random() < 0.55;
      d.v.set(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).multiplyScalar(1.6);
      if (out && dir) d.v.addScaledVector(dir, 2.2 + Math.random() * 2.2); else if (normal) d.v.addScaledVector(normal, 1 + Math.random() * 1.6);
      d.life = d.max = 0.32 + Math.random() * 0.3; d.size = (head ? 0.022 : 0.017) * (0.6 + Math.random() * 0.8);
      dropMesh.setColorAt(idx, _c.set(COLS[(Math.random() * COLS.length) | 0]));
    }
    dropMesh.instanceColor.needsUpdate = true;
  }
  function stepDrops(dt) {
    let last = 0;
    for (let i = 0; i < DROPS; i++) {
      const d = drops[i];
      if (d.life <= 0) { _m.makeScale(0, 0, 0); dropMesh.setMatrixAt(i, _m); continue; }
      d.life -= dt; d.v.y += -11 * dt; d.v.multiplyScalar(1 - 1.5 * dt); d.p.addScaledVector(d.v, dt);
      if (d.p.y < 0.01) { d.p.y = 0.01; d.v.set(0, 0, 0); }
      const k = Math.max(0, d.life / d.max), s = d.size * (0.35 + 0.65 * k);
      _s.set(s, s, s * (1 + Math.min(2, d.v.length() * 0.25)));
      _qi.setFromUnitVectors(_u.set(0, 0, 1), _w.copy(d.v).normalize().lengthSq() > 0 ? _w : _u.set(0, 0, 1));
      _m.compose(d.p, _qi, _s); dropMesh.setMatrixAt(i, _m); last = i + 1;
    }
    dropMesh.count = Math.max(1, last); dropMesh.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- upadek: fizyka Verlet
  const P = () => ({ p: V3(), o: V3(), n: V3(), hit: false });
  function deathState(root) {
    const ud = root.userData;
    return ud.rd || (ud.rd = { on: false, t: 0, life: 3, h: STEP, acc: 0, sleep: false, still: 0, A: P(), B: P(), F: P(), Gp: P(), fwd: V3(), near: [],
      gun: null, gunParent: null, gunPos: V3(), gunQuat: new THREE.Quaternion(), gunScale: V3(), gunSpin: V3(), gunRest: false, gunQ: new THREE.Quaternion(),
      buckle: 0.35, legMin: 0.3, alpha: 1, hidden: [], armT: [V3(), V3()], armInit: false, fadeDone: false });
  }
  // kula (c, r) kontra podłoga y = 0 i bryły z listy: wypchnięcie; zapisuje normalną kontaktu
  function collide(pt, r, list) {
    const p = pt.p; let hit = false;
    if (p.y < r) { p.y = r; pt.n.set(0, 1, 0); hit = true; }
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (p.x < b.minX - r || p.x > b.maxX + r || p.z < b.minZ - r || p.z > b.maxZ + r || p.y < b.bottom - r || p.y > b.top + r) continue;
      const qx = clamp(p.x, b.minX, b.maxX), qy = clamp(p.y, b.bottom, b.top), qz = clamp(p.z, b.minZ, b.maxZ);
      const dx = p.x - qx, dy = p.y - qy, dz = p.z - qz, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-10) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.y += dy * k; p.z += dz * k; pt.n.set(dx / d, dy / d, dz / d); }
      else {                                            // środek w bryle: wyjście najkrótszą drogą (z lekką preferencją góry)
        const l = p.x - b.minX, rr = b.maxX - p.x, f = p.z - b.minZ, bk = b.maxZ - p.z, up = (b.top - p.y) * 0.8, dn = p.y - b.bottom;
        const m = Math.min(l, rr, f, bk, up, dn);
        if (m === up) { p.y = b.top + r; pt.n.set(0, 1, 0); } else if (m === l) { p.x = b.minX - r; pt.n.set(-1, 0, 0); } else if (m === rr) { p.x = b.maxX + r; pt.n.set(1, 0, 0); }
        else if (m === f) { p.z = b.minZ - r; pt.n.set(0, 0, -1); } else if (m === bk) { p.z = b.maxZ + r; pt.n.set(0, 0, 1); } else { p.y = b.bottom - r; pt.n.set(0, -1, 0); }
      }
      hit = true;
    }
    if (hit) pt.hit = true;
    return hit;
  }
  const _dd = V3(), _a = V3(), _b = V3(), _d = V3(), _mid = V3(), _x = V3(), _f = V3(), _lp = V3();
  function integrate(pt, h, ratio, damp) {
    const p = pt.p, o = pt.o;
    let vx = (p.x - o.x) * ratio * damp, vy = (p.y - o.y) * ratio * damp, vz = (p.z - o.z) * ratio * damp;
    const v2 = vx * vx + vy * vy + vz * vz, vm = VMAX * h;
    if (v2 > vm * vm) { const k = vm / Math.sqrt(v2); vx *= k; vy *= k; vz *= k; }
    o.copy(p); p.x += vx; p.y += vy + G * h * h; p.z += vz; pt.hit = false;
  }
  function friction(pt, fr, bounce) {
    if (!pt.hit) return;
    const p = pt.p, o = pt.o, n = pt.n;
    _d.copy(p).sub(o); const vn = _d.dot(n);
    _x.copy(_d).addScaledVector(n, -vn).multiplyScalar(1 - fr);   // styczna z tarciem
    if (vn < 0) _x.addScaledVector(n, -vn * bounce); else _x.addScaledVector(n, vn);
    o.copy(p).sub(_x);
  }
  function constrainDist(a, b, len, wa, wb) {
    _d.copy(b.p).sub(a.p); const d = _d.length() || 1e-6, k = (d - len) / d;
    a.p.addScaledVector(_d, k * wa); b.p.addScaledVector(_d, -k * wb);
  }
  function simStep(rd, h) {
    const ratio = h / rd.h; rd.h = h;
    integrate(rd.A, h, ratio, 0.998); integrate(rd.B, h, ratio, 0.998); integrate(rd.F, h, ratio, 0.995);
    const t = rd.t, list = rd.near;
    for (let it = 0; it < 3; it++) {
      // korpus jest sztywny
      constrainDist(rd.A, rd.B, AB, 0.5, 0.5);
      // nogi: najpierw trzymają ciało (coraz słabiej – kolana się uginają), potem tylko ograniczają rozkrok
      _d.copy(rd.F.p).sub(rd.A.p); const dl = _d.length() || 1e-6;
      if (t < rd.buckle) {
        const k = t / rd.buckle, want = FOOT_SPAN + (rd.legMin - FOOT_SPAN) * (k * k);
        constrainDist(rd.A, rd.F, want, 0.85, 0.15);
      } else if (dl > FOOT_SPAN + 0.03) constrainDist(rd.A, rd.F, FOOT_SPAN + 0.03, 0.3, 0.7);
      else if (t > rd.buckle + 0.25) { _a.copy(_d).multiplyScalar((FOOT_SPAN - dl) / dl * 0.04); rd.F.p.add(_a); }   // leżąc: nogi powoli się prostują
      else if (dl < 0.26) constrainDist(rd.A, rd.F, 0.26, 0.3, 0.7);
      // zakres ruchu w biodrze (w układzie korpusu): do przodu do ~95°, do tyłu ~25°, na boki ~30°
      _u.copy(rd.B.p).sub(rd.A.p).normalize();
      _f.copy(rd.fwd).addScaledVector(_u, -rd.fwd.dot(_u)); if (_f.lengthSq() < 1e-6) _f.set(1, 0, 0); _f.normalize();
      _x.crossVectors(_f, _u);
      _d.copy(rd.F.p).sub(rd.A.p); const len = _d.length() || 1e-6;
      const down = -_d.dot(_u), fw = _d.dot(_f), sd = _d.dot(_x);
      let af = Math.atan2(fw, down), as = Math.atan2(sd, Math.hypot(down, fw));
      const af2 = clamp(af, -0.45, 1.65), as2 = clamp(as, -0.5, 0.5);
      if (af2 !== af || as2 !== as) {
        const cs = Math.cos(as2);
        _lp.set(0, 0, 0).addScaledVector(_u, -Math.cos(af2) * cs).addScaledVector(_f, Math.sin(af2) * cs).addScaledVector(_x, Math.sin(as2)).multiplyScalar(len);
        _a.copy(rd.A.p).add(_lp).sub(rd.F.p);
        rd.F.p.addScaledVector(_a, 0.8); rd.A.p.addScaledVector(_a, -0.1); rd.B.p.addScaledVector(_a, -0.1);
      }
      // kolizje: miednica, głowa, środek korpusu (przesuwa obie kule) i stopy
      collide(rd.A, R, list); collide(rd.B, R, list);
      _mid.copy(rd.A.p).add(rd.B.p).multiplyScalar(0.5); _a.copy(_mid);
      const M = rd.mid; M.p.copy(_mid); M.hit = false;
      if (collide(M, R, list)) { _a.subVectors(M.p, _a); rd.A.p.add(_a); rd.B.p.add(_a); if (!rd.A.hit) { rd.A.hit = true; rd.A.n.copy(M.n); } if (!rd.B.hit) { rd.B.hit = true; rd.B.n.copy(M.n); } }
      collide(rd.F, FR, list);
    }
    friction(rd.A, 0.16, 0.12); friction(rd.B, 0.12, 0.18); friction(rd.F, 0.3, 0.05);
    // broń: punkt z obrotem; po kontakcie z podłożem kładzie się na boku
    if (rd.gun) {
      const g = rd.Gp; integrate(g, h, ratio, 0.997);
      if (collide(g, GUN_R, list)) { friction(g, 0.25, 0.2); if (g.n.y > 0.5) rd.gunRest = true; }
    }
    rd.t += h;
  }
  const _eu = new THREE.Euler(), _m4 = new THREE.Matrix4(), _y = V3(), _z = V3(), _bx = V3();
  function applyPose(root, rd, dt) {
    const ud = root.userData;
    // orientacja ciała: oś Y = miednica -> głowa, przód (−Z) transportowany z poprzedniej klatki (bez skrętu wokół osi)
    _y.copy(rd.B.p).sub(rd.A.p).normalize();
    rd.fwd.addScaledVector(_y, -rd.fwd.dot(_y)); if (rd.fwd.lengthSq() < 1e-6) rd.fwd.set(1, 0, 0).addScaledVector(_y, -_y.x); rd.fwd.normalize();
    _z.copy(rd.fwd).negate(); _bx.crossVectors(_y, _z).normalize(); _z.crossVectors(_bx, _y);
    _m4.makeBasis(_bx, _y, _z); root.quaternion.setFromRotationMatrix(_m4);
    root.position.copy(rd.A.p).addScaledVector(_y, -AY);
    ud.upper.position.set(0, 0, 0); ud.pelvis.rotation.set(0, 0, 0); leanTorso(ud, 0, 0, 0);
    root.updateMatrixWorld(true);
    // nogi: IK dwóch równych odcinków do punktu stóp (w układzie postaci), lekki rozkrok
    _a.copy(rd.F.p); root.worldToLocal(_a);
    for (let i = 0; i < 2; i++) {
      const leg = ud.legs[i], { hip, knee } = leg.userData, side = leg.position.x > 0 ? 1 : -1;
      _d.set(_a.x + side * 0.1, _a.y, _a.z).sub(leg.position);
      const D = clamp(_d.length() + FR * 0.8, 0.12, LEG * 0.995), half = Math.acos(clamp(D / LEG, -1, 1));
      const th = Math.atan2(-_d.z, -_d.y), sz = clamp(Math.atan2(_d.x, Math.hypot(_d.y, _d.z)), -0.7, 0.7);
      hip.rotation.set(th + half, 0, sz); knee.rotation.set(-2 * half, 0, 0);
    }
    // ręce: bezwładne – dłonie zwisają z grawitacją (w świecie), lekko na bok i do przodu ciała; nie wchodzą w korpus ani pod ciało
    const floorY = Math.min(rd.A.p.y - R, rd.B.p.y - R, rd.F.p.y - FR) + 0.05;
    for (let i = 0; i < 2; i++) {
      const def = i ? armL : armR, sh = i ? ud.shoulderL : ud.shoulderR, side = def.side;
      _w.copy(sh); root.localToWorld(_w);                                    // bark w świecie
      _v.copy(_bx).multiplyScalar(side); _v.y = 0;                           // bok (poziomo)
      _u.copy(_z).negate(); _u.y = 0;                                        // przód ciała (poziomo)
      _v.multiplyScalar(0.9).addScaledVector(_u, 0.45); _v.y -= 1; _v.normalize().multiplyScalar(def.reach * 0.86).add(_w);
      if (_v.y < floorY) _v.y = floorY;
      root.worldToLocal(_v);
      const rr = Math.hypot(_v.x - BODY.cx, _v.z - BODY.cz), rmin = R + 0.1;   // poza korpusem
      if (_v.y > BODY.y0 - 0.05 && _v.y < BODY.y1 + 0.05 && rr < rmin) { const k = rr > 1e-4 ? rmin / rr : 1; _v.x = BODY.cx + (_v.x - BODY.cx) * k + (rr > 1e-4 ? 0 : side * rmin); _v.z = BODY.cz + (_v.z - BODY.cz) * k; }
      const T = rd.armT[i];
      if (!rd.armInit) T.copy(_v); else T.lerp(_v, Math.min(1, dt * 9));
      solveArm(ud.arms[i], def, T);
    }
    rd.armInit = true;
    // broń
    if (rd.gun) {
      const g = rd.gun; g.position.copy(rd.Gp.p);
      if (rd.gunRest) g.quaternion.slerp(rd.gunQ, Math.min(1, dt * 10));
      else { _v.copy(rd.gunSpin).multiplyScalar(dt); const a = _v.length(); if (a > 1e-6) { _qi.setFromAxisAngle(_v.normalize(), a); g.quaternion.premultiply(_qi); } }
    }
  }
  function setAlpha(root, rd, a) {
    if (a === rd.alpha) return; rd.alpha = a;
    const M = root.userData.mats;
    for (const k of ['skin', 'body', 'eyeW', 'eyeB']) if (M[k]) M[k].opacity = a;
    if (a < 0.7 && !rd.hidden.length) {                  // dodatki (kamizelka, hełm) i broń: znikają w połowie wygaszania
      root.traverse((o) => { if (o.isMesh && o.visible && !o.userData.beanPart) { rd.hidden.push(o); o.visible = false; } });
      if (rd.gun && rd.gun.visible) { rd.hidden.push(rd.gun); rd.gun.visible = false; }
    }
  }
  // dir: kierunek lotu kuli (świat); from: skąd strzelano (gdy brak dir); head: strzał w głowę; gun: grupa broni w rękach; life: czas do zniknięcia
  function die(root, o = {}) {
    const rd = deathState(root), ud = root.userData, h = hitState(root);
    if (rd.on) clear(root);
    h.on = false; h.x = h.z = h.y = h.dip = h.vx = h.vz = h.vy = h.vd = 0;
    rd.on = true; rd.t = 0; rd.age = 0; rd.acc = 0; rd.h = STEP; rd.sleep = false; rd.still = 0; rd.alpha = 1; rd.armInit = false; rd.fadeDone = false;
    rd.life = o.life || 3; rd.mid = rd.mid || P();
    const head = o.head != null ? !!o.head : (performance.now() - h.lastT < 1500 && h.lastHead);
    const force = clamp(o.force || 1, 0.6, 1.8);
    // kierunek upadku: z kuli; bez informacji – z ostatniego trafienia albo od strzelca
    const dir = _dd;
    if (o.dir) dir.copy(o.dir); else if (o.from) dir.copy(root.position).sub(o.from); else if (performance.now() - h.lastT < 3000) dir.copy(h.lastDir); else dir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    dir.y = 0; if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1); dir.normalize();
    _f.set(0, 0, -1).applyQuaternion(root.quaternion); _f.y = 0; if (_f.lengthSq() < 1e-6) _f.set(0, 0, -1); rd.fwd.copy(_f.normalize());
    // pozycja startowa: obecna poza (kucanie obniża miednicę)
    const up = clamp(ud.upper.position.y, -0.35, 0.1), base = root.position; rd.baseY = base.y;
    rd.A.p.set(base.x, base.y + AY + up, base.z); rd.B.p.set(base.x, base.y + BY + up, base.z); rd.F.p.set(base.x, base.y + FR, base.z);
    // trochę odchylenia z ostatniej pozy tułowia (nie zaczyna od idealnego pionu)
    rd.B.p.addScaledVector(dir, 0.04);
    // bryły w pobliżu (raz)
    rd.near.length = 0;
    for (const b of boxes) if (b.minX < base.x + NEAR && b.maxX > base.x - NEAR && b.minZ < base.z + NEAR && b.maxZ > base.z - NEAR && b.bottom < base.y + 2.6) rd.near.push(b);   // także wszystko niżej: ciało może spaść z podestu
    // start w bryle (np. obraz przeciwnika z sieci wszedł w ścianę): najpierw wyjście bez nadawania prędkości
    for (let it = 0; it < 4; it++) {
      constrainDist(rd.A, rd.B, AB, 0.5, 0.5);
      collide(rd.A, R, rd.near); collide(rd.B, R, rd.near); collide(rd.F, FR, rd.near);
      _mid.copy(rd.A.p).add(rd.B.p).multiplyScalar(0.5); rd.mid.p.copy(_mid);
      if (collide(rd.mid, R, rd.near)) { _a.subVectors(rd.mid.p, _mid); rd.A.p.add(_a); rd.B.p.add(_a); }
    }
    if (rd.A.p.distanceTo(rd.F.p) > FOOT_SPAN + 0.2) rd.F.p.copy(rd.A.p).y -= FOOT_SPAN;   // stopy zostały w bryle: pod miednicą
    collide(rd.F, FR, rd.near);
    // rodzaj upadku: w głowę – nogi od razu miękną, głowa leci z kulą; w tułów – zatoczenie, kolana, a czasem upadek do przodu
    const v = 1 / STEP, side = (Math.random() - 0.5) * 0.9;
    _x.set(-dir.z, 0, dir.x);                              // bok względem kierunku kuli
    let vb, va;
    if (head) { rd.buckle = 0.1; rd.legMin = 0.3; vb = 3.6 * force; va = 1.1 * force; }
    else if (Math.random() < 0.3) { rd.buckle = 0.32; rd.legMin = 0.28; vb = -1.5; va = 0.35; }      // osuwa się na kolana i pada twarzą
    else { rd.buckle = 0.3 + Math.random() * 0.12; rd.legMin = 0.3; vb = 2.3 * force; va = 0.75 * force; }
    rd.B.o.copy(rd.B.p).addScaledVector(dir, -vb / v).addScaledVector(_x, -side * 0.6 / v); if (head) rd.B.o.y -= 0.4 / v;
    rd.A.o.copy(rd.A.p).addScaledVector(dir, -va / v).addScaledVector(_x, -side * 0.25 / v);
    rd.F.o.copy(rd.F.p).addScaledVector(dir, -(head ? 0.5 : 0.15) * force / v);
    // broń wypada z rąk
    rd.gun = null; rd.gunRest = false;
    const gun = o.gun;
    if (gun && gun.parent) {
      rd.gun = gun; rd.gunParent = gun.parent; rd.gunPos.copy(gun.position); rd.gunQuat.copy(gun.quaternion); rd.gunScale.copy(gun.scale);
      scene.attach(gun);
      const g = rd.Gp; g.p.copy(gun.position);
      if (g.p.y < GUN_R) g.p.y = GUN_R;
      for (let it = 0; it < 3; it++) collide(g, GUN_R + 0.04, rd.near);   // lufa w ścianie: najpierw na zewnątrz, bez prędkości
      g.o.copy(g.p).addScaledVector(dir, -(0.3 + Math.random() * 0.5) * force / v).addScaledVector(_x, -(Math.random() - 0.5) * 1.2 / v); g.o.y -= (0.2 + Math.random() * 0.5) / v;
      rd.gunSpin.set((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 7, (Math.random() - 0.5) * 5);
      // spoczynek: lufa poziomo, broń na boku
      _f.set(0, 0, -1).applyQuaternion(gun.quaternion); const yaw = Math.atan2(-_f.x, -_f.z) + (Math.random() - 0.5) * 1.2;
      rd.gunQ.setFromEuler(_eu.set(0, yaw, (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2, 'YXZ'));
    }
    applyPose(root, rd, 0);
    return rd;
  }
  function stepDeath(root, dt) {
    const rd = root.userData.rd; if (!rd || !rd.on) return false;
    if (rd.fadeDone) return false;
    rd.age += dt;
    if (!rd.sleep) {
      const n = Math.min(6, Math.max(1, Math.ceil(dt / STEP))), h = dt / n;
      for (let i = 0; i < n; i++) simStep(rd, h);
      // uspokojenie: ciało prawie się nie rusza -> koniec liczenia
      const sp = (rd.A.p.distanceToSquared(rd.A.o) + rd.B.p.distanceToSquared(rd.B.o) + rd.F.p.distanceToSquared(rd.F.o)) / (h * h);
      if (sp < 0.02 && rd.t > 0.8 && (!rd.gun || rd.gunRest)) { rd.still += dt; if (rd.still > 0.35) rd.sleep = true; } else rd.still = 0;
      applyPose(root, rd, dt);
    }
    // płynne wygaszenie w ostatnich 0,55 s życia ciała
    const a = clamp((rd.life - rd.age) / 0.55, 0, 1);
    setAlpha(root, rd, a);
    if (a <= 0) { root.visible = false; rd.fadeDone = true; return false; }
    return true;
  }
  function clear(root) {
    const ud = root.userData, rd = ud.rd, h = ud.hr;
    if (h) { h.on = false; h.x = h.z = h.y = h.dip = h.vx = h.vz = h.vy = h.vd = 0; }
    if (!rd || !rd.on) return;
    rd.on = false; rd.sleep = false; rd.fadeDone = false;
    for (const o of rd.hidden) o.visible = true; rd.hidden.length = 0;
    setAlpha(root, rd, 1);
    if (rd.gun) {
      const g = rd.gun; if (rd.gunParent) rd.gunParent.add(g);
      g.position.copy(rd.gunPos); g.quaternion.copy(rd.gunQuat); g.scale.copy(rd.gunScale); rd.gun = null;
    }
    const ry = Math.atan2(-rd.fwd.x, -rd.fwd.z);
    root.rotation.set(0, ry, 0); root.position.y = rd.baseY;
    for (const leg of ud.legs) { leg.userData.hip.rotation.set(0, 0, 0); leg.userData.knee.rotation.set(0, 0, 0); }
    ud.upper.position.set(0, 0, 0); ud.pelvis.rotation.set(0, 0, 0); leanTorso(ud, 0, 0, 0);
  }
  const dying = (root) => !!(root.userData.rd && root.userData.rd.on);
  return { react, pose, flash, hitFx, die, stepDeath, clear, dying, update: stepDrops };
}
