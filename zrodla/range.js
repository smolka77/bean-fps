// Strzelnica (tryb solo): mapa treningowa z celami-fasolkami + tablica ustawień na ścianie stanowiska.
//
// Gracz stoi w budce strzeleckiej i strzela do czerwonych fasolek, które pojawiają się w punktach mapy
// (map.targets z strzelnica-data.js: x,y,z = stopy fasolki, zone = near/mid/far, strafe = amplituda ruchu bocznego).
// Obrócony do tylnej ściany, gracz widzi tablicę z ustawieniami (zakres celów, ile naraz, jak często się pojawiają,
// jak długo stoją, ruchome cele, dźwięk, reset statystyk, trening wł./wył.) i klika w nią celownikiem.
//
// Użycie: const range = createRange(hooks); range.enter(map) przy wejściu w tryb, range.leave() przy wyjściu,
// range.update(dt, playing) w każdej klatce, range.press() przy kliknięciu (true = kliknięcie poszło w tablicę),
// range.onShot() przy każdym strzale i range.onHit(wróg, głowa, zabity) przy trafieniu. Haki opisane przy createRange.
import * as THREE from 'three';
import { t as tr } from './lobby-ui.js';   // słownik i aktualny język gry (PL/EN/RU/ES)

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
const easeOutBack = (x) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const RATE = { slow: 2.2, normal: 1, fast: 0.45 };    // mnożnik odstępu między pojawieniami (bazowo 0,25–0,8 s)
const PACE = { slow: 1.6, normal: 1, fast: 0.65 };    // mnożnik czasu, przez jaki fasolka stoi

// hooki gry:
//   scene, camera, player, enemies      – scena, kamera, gracz (pos, yaw, pitch) i pula fasolek-wrogów (root, hp, dead, fall, flash, mats…)
//   pose(e, chodzi, dt)                 – ustawia nogi/ręce/karabin fasolki (poza stojąca albo krok)
//   click()                             – dźwięk kliknięcia w tablicę
//   isSound() / setSound(on)            – dźwięk gry (to samo co klawisz M)
//   resetKills()                        – zeruje licznik „Trafione fasolki”
export function createRange(g) {
  const { scene, camera, player, enemies } = g;
  const api = { active: false };
  const cfg = { zone: 'all', count: 3, pace: 'normal', rate: 'normal', moving: true };
  const stats = {};
  let langSig = '', enabled = true, spots = [], panel = null, t = 0, nextSpawn = 0, hover = -2, dirty = true, frozen = false, lastPress = 0;
  const recent = [];

  // ------------------------------------------------------------- niebo, mgła i światło jak w lobby (zachód słońca)
  // Wejście w Strzelnicę zmienia tylko scenę gry, a wyjście przywraca poprzednie wartości (mapy 1v1 zostają jak były).
  const SUNSET = {
    sky: [[0, '#2b2f6b'], [0.27, '#5a4580'], [0.4, '#c8657c'], [0.5, '#f4a46e'], [0.56, '#d4875a'], [1, '#5a4a30']],   // zenit → róż → bursztyn przy horyzoncie
    horizon: 0xf4a46e, fog: [90, 290],                       // plac ma 70 m głębokości, wzgórza bledną w bursztynowej mgle
    hemi: [0xffc2a6, 0x3d3324, 1.2], sun: [0xffb070, 2.7],   // ciepłe światło zza pleców strzelca
  };
  let env = null, skyTex = null;
  function makeSky() {
    const cv = document.createElement('canvas');
    cv.width = 4; cv.height = 512;
    const c = cv.getContext('2d'), gr = c.createLinearGradient(0, 0, 0, 512);
    for (const [p, col] of SUNSET.sky) gr.addColorStop(p, col);
    c.fillStyle = gr; c.fillRect(0, 0, 4, 512);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace; tex.mapping = THREE.EquirectangularReflectionMapping;
    return tex;
  }
  function applyEnv() {
    if (env) return;
    const hemi = scene.children.find((o) => o.isHemisphereLight), sun = scene.children.find((o) => o.isDirectionalLight && o.castShadow);
    env = {
      bg: scene.background, hemi, sun,
      fog: scene.fog ? [scene.fog.color.getHex(), scene.fog.near, scene.fog.far] : null,
      hemiV: hemi ? [hemi.color.getHex(), hemi.groundColor.getHex(), hemi.intensity] : null,
      sunV: sun ? [sun.color.getHex(), sun.intensity] : null,
    };
    skyTex = skyTex || makeSky();
    scene.background = skyTex;
    if (scene.fog) { scene.fog.color.setHex(SUNSET.horizon); scene.fog.near = SUNSET.fog[0]; scene.fog.far = SUNSET.fog[1]; }
    if (hemi) { hemi.color.setHex(SUNSET.hemi[0]); hemi.groundColor.setHex(SUNSET.hemi[1]); hemi.intensity = SUNSET.hemi[2]; }
    if (sun) { sun.color.setHex(SUNSET.sun[0]); sun.intensity = SUNSET.sun[1]; }
  }
  function restoreEnv() {
    if (!env) return;
    scene.background = env.bg;
    if (env.fog && scene.fog) { scene.fog.color.setHex(env.fog[0]); scene.fog.near = env.fog[1]; scene.fog.far = env.fog[2]; }
    if (env.hemi && env.hemiV) { env.hemi.color.setHex(env.hemiV[0]); env.hemi.groundColor.setHex(env.hemiV[1]); env.hemi.intensity = env.hemiV[2]; }
    if (env.sun && env.sunV) { env.sun.color.setHex(env.sunV[0]); env.sun.intensity = env.sunV[1]; }
    env = null;
  }

  // ------------------------------------------------------------- statystyki
  function resetStats() {
    Object.assign(stats, { shots: 0, hits: 0, heads: 0, expired: 0, streak: 0, best: 0, rt: 0 });
    g.resetKills();
    renderHud();
  }
  function renderHud() {
    dirty = true;
    const el = document.getElementById('rgAcc');
    if (el) el.textContent = stats.shots ? '· celność ' + Math.round((stats.hits / stats.shots) * 100) + '%' : '';
  }

  // ------------------------------------------------------------- cele
  function pickSpot() {
    const busy = new Set(enemies.filter((e) => e.rg).map((e) => e.rg.spot.id));
    const ok = (s) => !busy.has(s.id) && !recent.includes(s.id);
    const zones = cfg.zone === 'all' ? ['near', 'mid', 'far'] : [cfg.zone];
    const avail = zones.filter((z) => spots.some((s) => s.zone === z && ok(s)));
    if (!avail.length) return null;
    const z = avail[Math.floor(Math.random() * avail.length)];
    const list = spots.filter((s) => s.zone === z && ok(s));
    return list[Math.floor(Math.random() * list.length)];
  }
  function spawn() {
    const spot = pickSpot(), e = enemies.find((q) => !q.rg);
    if (!spot || !e) return false;
    recent.push(spot.id);
    if (recent.length > Math.min(8, Math.floor(spots.length / 3))) recent.shift();
    const r = e.root;
    Object.assign(e, { off: false, hp: 1, dead: 0, fall: 0, flash: 0 });   // hp 1: każde trafienie zabija (trening celności)
    r.visible = true; r.rotation.z = 0; r.position.set(spot.x, spot.y, spot.z); r.scale.setScalar(0.01);
    e.rg = { spot, born: t, tState: t, state: 'in', ttl: (1.8 + spot.dist / 16) * PACE[cfg.pace], amp: cfg.moving ? spot.strafe : 0, w: rnd(0.9, 1.35), ph: rnd(0, 6.28) };
    return true;
  }
  function release(e) {
    e.rg = null; e.off = true; e.dead = 0; e.fall = 0; e.flash = 0;
    e.root.visible = false; e.root.rotation.z = 0; e.root.position.y = 0; e.root.scale.setScalar(1); e.mats.skin.emissive.setScalar(0);
  }
  function clearActive() { for (const e of enemies) if (e.rg) release(e); }

  function step(dt, playing) {
    const run = playing && !frozen;
    const rdt = run ? dt : 0;
    if (run && enabled) {
      t += dt;
      const living = enemies.filter((e) => e.rg && (e.rg.state === 'in' || e.rg.state === 'alive') && e.dead === 0).length;
      if (living < cfg.count && t >= nextSpawn && spawn()) nextSpawn = t + rnd(0.25, 0.8) * RATE[cfg.rate];
    }
    for (const e of enemies) {
      const a = e.rg;
      if (!a) continue;
      const r = e.root;
      if (e.flash > 0) { e.flash -= rdt; e.mats.skin.emissive.setScalar(0.9); } else e.mats.skin.emissive.setScalar(0);
      if (e.dead > 0) {                                  // trafiona: przewraca się i znika
        e.dead -= rdt; e.fall = Math.min(1, e.fall + rdt * 3);
        r.rotation.z = e.fall * (Math.PI / 2); r.position.y = a.spot.y + Math.sin(e.fall * Math.PI / 2) * 0.28;
        if (e.dead < 2.8 - 0.65) release(e);
        continue;
      }
      if (!run) continue;
      const age = t - a.tState;
      if (a.state === 'in' || a.state === 'alive') {
        if (a.state === 'in') {
          const k = clamp(age / 0.2, 0, 1), s = easeOutBack(k);
          r.scale.set(0.7 + 0.3 * s, Math.max(0.01, s), 0.7 + 0.3 * s);
          if (k >= 1) { a.state = 'alive'; r.scale.setScalar(1); }
        }
        const life = t - a.born;
        const x = a.spot.x + (a.amp ? a.amp * Math.sin(a.w * life + a.ph) : 0);
        r.position.x = x; r.position.y = a.spot.y;
        r.rotation.y = Math.atan2(player.pos.x - x, player.pos.z - a.spot.z) + Math.PI;   // zawsze patrzy na gracza
        g.pose(e, a.amp ? 1 : 0, dt);
        if (life > a.ttl) { a.state = 'out'; a.tState = t; stats.expired++; stats.streak = 0; renderHud(); }
      } else if (a.state === 'out') {
        const k = clamp(age / 0.15, 0, 1);
        r.scale.set(1 - k * 0.3, Math.max(0.01, 1 - k), 1 - k * 0.3);
        if (k >= 1) release(e);
      }
    }
  }

  // wywoływane przez grę
  api.onShot = () => { stats.shots++; renderHud(); };
  api.onHit = (e, head) => {
    const a = e.rg;
    stats.hits++; if (head) stats.heads++;
    stats.streak++; stats.best = Math.max(stats.best, stats.streak);
    if (a) stats.rt += t - a.born;
    renderHud();
  };

  // ------------------------------------------------------------- ustawienia
  function setCfg(k, v) {
    cfg[k] = v;
    if (k === 'zone' || k === 'count') clearActive();
    dirty = true;
  }
  function toggleTraining() { enabled = !enabled; if (!enabled) clearActive(); dirty = true; }
  function resetAll() { resetStats(); clearActive(); }

  // ------------------------------------------------------------- tablica ustawień na ścianie
  // Plansza rysowana na canvasie, w stylu interfejsu gry (Anton, pochylone napisy, żółte przyciski-równoległoboki, granat).
  function makePanel(PN) {
    const W = 1520, H = Math.round((W * PN.h) / PN.w);
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(PN.w, PN.h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, fog: false }));
    mesh.position.set(PN.x, PN.y, PN.z - 0.045);
    mesh.rotation.y = Math.PI;                    // przodem do gracza (patrzy w stronę +Z)
    mesh.updateMatrixWorld(true);
    mesh.visible = false;
    scene.add(mesh);

    const FD = "Anton, Impact, 'Arial Narrow Bold', sans-serif", FS = 'system-ui, "Segoe UI", sans-serif';
    if (document.fonts && document.fonts.load) document.fonts.load('40px Anton').then(() => { dirty = true; }).catch(() => {});

    const ROWS = [
      ['rg.zone', 'zone', [['rg.all', 'all'], ['rg.near', 'near'], ['rg.mid', 'mid'], ['rg.far', 'far']]],
      ['rg.count', 'count', [['1', 1], ['2', 2], ['3', 3], ['5', 5]]],
      ['rg.rate', 'rate', [['rg.rate.slow', 'slow'], ['rg.rate.normal', 'normal'], ['rg.rate.fast', 'fast']]],
      ['rg.pace', 'pace', [['rg.pace.slow', 'slow'], ['rg.pace.normal', 'normal'], ['rg.pace.fast', 'fast']]],
      ['rg.moving', 'moving', [['rg.yes', true], ['rg.no', false]]],
      ['rg.sound', 'sound', [['rg.yes', true], ['rg.no', false]]],
    ];
    const btns = [];
    const rowY0 = 182, pitch = 74, bh = 56, bx0 = 568, bw = 205, gap = 12;
    ROWS.forEach(([, key, opts], r) => opts.forEach(([txt, val], i) => btns.push({
      x: bx0 + i * (bw + gap), y: rowY0 + r * pitch, w: bw, h: bh, label: () => tr(txt),
      on: () => (key === 'sound' ? g.isSound() === val : cfg[key] === val),
      act: () => (key === 'sound' ? g.setSound(val) : setCfg(key, val)),
    })));
    btns.push({ x: 60, y: 640, w: 440, h: 66, label: () => tr('rg.reset'), on: () => false, act: resetAll });
    btns.push({ x: 530, y: 640, w: 500, h: 66, label: () => tr(enabled ? 'rg.on' : 'rg.off'), on: () => enabled, act: toggleTraining, warn: true });

    const para = (x, y, w, h, s = 0.06) => {      // równoległobok jak clip-path w grze: polygon(6% 0,100% 0,94% 100%,0 100%)
      c.beginPath(); c.moveTo(x + w * s, y); c.lineTo(x + w, y); c.lineTo(x + w * (1 - s), y + h); c.lineTo(x, y + h); c.closePath();
    };
    const vgrad = (y, h, stops) => { const gr = c.createLinearGradient(0, y, 0, y + h); stops.forEach(([p, col]) => gr.addColorStop(p, col)); return gr; };
    const YELLOW = [[0, '#fff7a8'], [0.38, '#ffe437'], [0.7, '#ffc800'], [1, '#f5ad00']];
    const RED = [[0, '#ff9a88'], [0.45, '#ee4d38'], [1, '#b92a1e']];
    const text = (s, x, y, font, color, align = 'left', ls = 0, maxW = 0) => {
      c.font = font; c.fillStyle = color; c.textAlign = align; c.textBaseline = 'middle';
      if ('letterSpacing' in c) c.letterSpacing = ls + 'px';
      if (maxW) c.fillText(s, x, y, maxW); else c.fillText(s, x, y);
      if ('letterSpacing' in c) c.letterSpacing = '0px';
    };
    const skewed = (fn) => { c.save(); c.transform(1, 0, -0.14, 1, 0, 0); fn(); c.restore(); };   // skewX(-8deg)

    function draw(hv) {
      c.clearRect(0, 0, W, H);
      c.fillStyle = vgrad(0, H, [[0, '#0f2147'], [1, '#08122b']]); c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(255,255,255,0.16)'; c.lineWidth = 8; c.strokeRect(4, 4, W - 8, H - 8);
      for (const y of [16, H - 16]) {
        const gl = c.createLinearGradient(60, 0, W - 60, 0);
        gl.addColorStop(0, 'rgba(255,225,74,0)'); gl.addColorStop(0.5, '#ffe14a'); gl.addColorStop(1, 'rgba(255,225,74,0)');
        c.fillStyle = gl; c.fillRect(60, y - 2, W - 120, 4);
      }
      c.fillStyle = '#ffe14a'; para(60, 30, 236, 38, 0.1); c.fill();
      text(tr('rg.tag'), 60 + 118, 50, `800 21px ${FS}`, '#1d1400', 'center', 4, 210);
      skewed(() => {
        const ty = 122, tx = 60 + 0.14 * ty;
        text(tr('rg.title'), tx, ty + 8, `400 72px ${FD}`, '#6e4c00', 'left', 3, 840);
        text(tr('rg.title'), tx, ty + 4, `400 72px ${FD}`, '#a87400', 'left', 3, 840);
        text(tr('rg.title'), tx, ty, `400 72px ${FD}`, '#ffe14a', 'left', 3, 840);
      });
      const acc = stats.shots ? Math.round((stats.hits / stats.shots) * 100) : 0;
      [[tr('rg.hits'), String(stats.hits)], [tr('rg.acc'), acc + '%']].forEach(([lab, val], i) => {
        const cx = W - 60 - 2 * 250 - 12 + i * 262;
        c.fillStyle = 'rgba(10,22,48,0.9)'; para(cx, 46, 250, 66, 0.06); c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 3; para(cx, 46, 250, 66, 0.06); c.stroke();
        text(lab, cx + 28, 79, `700 21px ${FS}`, '#9fc2ff', 'left', 3, 140);
        text(val, cx + 232, 80, `400 40px ${FD}`, '#ffffff', 'right', 1);
      });
      ROWS.forEach(([label], r) => text(tr(label).toUpperCase(), 60, rowY0 + r * pitch + bh / 2 + 3, `400 33px ${FD}`, '#cfe0ff', 'left', 2, 490));
      btns.forEach((b, i) => {
        const on = b.on(), hov = i === hv, red = b.warn && !on;
        if (on || red) {
          c.fillStyle = vgrad(b.y, b.h, red ? RED : YELLOW); para(b.x, b.y, b.w, b.h); c.fill();
          if (hov) { c.fillStyle = 'rgba(255,255,255,0.28)'; para(b.x, b.y, b.w, b.h); c.fill(); }
        } else {
          c.fillStyle = hov ? 'rgba(52,86,150,0.98)' : 'rgba(18,36,76,0.96)'; para(b.x, b.y, b.w, b.h); c.fill();
          c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 3; para(b.x + 2, b.y + 2, b.w - 4, b.h - 4); c.stroke();
        }
        if (hov) { c.strokeStyle = '#ffffff'; c.lineWidth = 5; para(b.x, b.y, b.w, b.h); c.stroke(); }
        text(b.label().toUpperCase(), b.x + b.w / 2, b.y + b.h / 2 + 3, `400 ${b.h > 60 ? 36 : 34}px ${FD}`, red ? '#ffffff' : on ? '#2a1c00' : '#ffffff', 'center', 2, b.w - 40);
      });
      text(tr('rg.hint').toUpperCase(), 60, 750, `700 21px ${FS}`, '#9fc2ff', 'left', 3, 1400);
      tex.needsUpdate = true;
    }
    const btnAt = (px, py) => btns.findIndex((b) => px >= b.x - 6 && px <= b.x + b.w + 6 && py >= b.y - 6 && py <= b.y + b.h + 6);
    return { mesh, W, H, btns, draw, btnAt };
  }

  // promień ze środka ekranu (tak jak strzał, bez rozrzutu) w tablicę, do 9 m
  const ray = new THREE.Raycaster(), O = new THREE.Vector3(), D = new THREE.Vector3(), E = new THREE.Euler();
  function aimAtPanel() {
    if (!panel) return null;
    camera.updateMatrixWorld();
    camera.getWorldPosition(O);
    D.set(0, 0, -1).applyEuler(E.set(player.pitch, player.yaw, 0, 'YXZ'));
    ray.set(O, D); ray.far = 9;
    return ray.intersectObject(panel.mesh, false)[0] || null;
  }
  api.press = () => {
    if (!api.active) return false;
    const hit = aimAtPanel();
    if (!hit) return false;
    const now = performance.now();
    if (now - lastPress > 160) {
      lastPress = now;
      const i = panel.btnAt(hit.uv.x * panel.W, (1 - hit.uv.y) * panel.H);
      if (i >= 0) { panel.btns[i].act(); dirty = true; g.click(); }
    }
    return true;
  };

  // ------------------------------------------------------------- cykl życia
  api.enter = (map) => {
    api.active = true;
    spots = map.targets || [];
    if (!panel && map.panel) panel = makePanel(map.panel);
    if (panel) panel.mesh.visible = true;
    applyEnv();
    enabled = true; t = 0; nextSpawn = 0.6; recent.length = 0; hover = -2;
    for (const e of enemies) { e.rg = null; e.off = true; e.dead = 0; e.root.visible = false; e.root.scale.setScalar(1); }
    resetStats();
  };
  api.leave = () => {
    api.active = false;
    if (panel) panel.mesh.visible = false;
    restoreEnv();
    for (const e of enemies) { e.rg = null; e.root.scale.setScalar(1); e.mats.skin.emissive.setScalar(0); }
  };
  api.update = (dt, playing) => {
    if (!api.active) return;
    const sig = tr('rg.title');   // zmiana języka w ustawieniach lobby: przerysuj tablicę
    if (sig !== langSig) { langSig = sig; dirty = true; }
    frozen = -Math.cos(player.yaw) > 0.3;            // gracz patrzy w tył (na tablicę): trening stoi, nic nie ucieka
    step(dt, playing);
    if (panel) {
      let h = -1;
      if (playing) { const hit = aimAtPanel(); if (hit) h = panel.btnAt(hit.uv.x * panel.W, (1 - hit.uv.y) * panel.H); }
      if (h !== hover || dirty) { hover = h; dirty = false; panel.draw(h); }
    }
  };
  api.cfg = cfg;
  api.stats = stats;
  api.debug = () => ({ t, nextSpawn, enabled, frozen, living: enemies.filter((e) => e.rg).map((e) => e.rg.spot.id + ':' + e.rg.state), yaw: player.yaw });   // do testów
  api.spots = () => spots;
  api.setCfg = setCfg;
  api.panel = () => panel;
  return api;
}
