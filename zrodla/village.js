// Wioska na drugim planie: małe chatki z białym tynkiem i strzechą (low poly jak drzewa), przy skraju lasu, lekko we mgle.
// Ciepłe światło w oknach, dym z komina. buildVillage(scene, heightAt) -> { zones: [{x, z, r}], update(t, dt) }
import * as THREE from 'three';

function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function buildVillage(scene, heightAt) {
  const rnd = rng(77), R = (a, b) => a + (b - a) * rnd();
  const flat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .95, flatShading: true, ...extra });
  const add = (parent, geo, mat, x, y, z, o = {}) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

  const hash3 = (x, y, z) => { const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return v - Math.floor(v); };
  const jitter = (g, amt, droopY = null) => { const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = o => hash3(x * 4.1 + o, y * 3.3 + o, z * 4.7) - .5;
      p.setXYZ(i, x + n(1) * amt, y + n(5) * amt + (droopY !== null && y < droopY ? -hash3(x * 9, 0, z * 9) * .12 : 0), z + n(9) * amt); }
    g.computeVertexNormals(); return g; };

  // ---------- materiały (płaskie cieniowanie jak drzewa) ----------
  const plaster = flat(0xffffff, { map: canvasTex(128, 128, (x, w, h) => { const r = rng(3); x.fillStyle = '#f1ebdf'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(${r() < .5 ? '190,175,150' : '255,252,245'},${.25 + r() * .3})`; x.fillRect(r() * w, r() * h, 3 + r() * 9, 1 + r() * 2); } }) });
  const strawTex = canvasTex(256, 128, (x, w, h) => { const r = rng(21); x.fillStyle = '#c99a45'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${r() < .45 ? '120,82,30' : '238,206,130'},${.25 + r() * .45})`; x.fillRect(r() * w, r() * h, 10 + r() * 40, 1 + r() * 1.5); } });
  strawTex.repeat.set(1.2, 1.2);
  const THATCH = [0xffffff, 0xf2e6d2, 0xe8dcc0, 0xfff0d8].map(c => flat(c, { map: strawTex }));
  const stoneTex = canvasTex(128, 64, (x, w, h) => { const r = rng(13); x.fillStyle = '#7c6a55'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { const g = 120 + r() * 50 | 0; x.fillStyle = `rgb(${g},${g - 12},${g - 28})`; x.beginPath(); x.ellipse(r() * w, r() * h, 6 + r() * 9, 4 + r() * 5, r(), 0, 7); x.fill(); } });
  stoneTex.repeat.set(2, 1);
  const baseM = flat(0xffffff, { map: stoneTex }), quoinM = flat(0xa4a29c), woodM = flat(0x7a4c26), darkWood = flat(0x5a3518);
  const doorTex = canvasTex(64, 128, (x, w, h) => { const r = rng(4); for (let i = 0; i < 4; i++) { x.fillStyle = `hsl(32,${45 + r() * 10}%,${40 + r() * 8}%)`; x.fillRect(i * 16, 0, 16, h); x.fillStyle = 'rgba(50,28,10,.6)'; x.fillRect(i * 16, 0, 2, h); }
    x.fillStyle = 'rgba(60,35,15,.8)'; x.fillRect(0, h * .3, w, 6); x.fillRect(0, h * .7, w, 6); });
  const doorM = flat(0xffffff, { map: doorTex }), chimM = flat(0xb59a78), cobbleM = flat(0xe9e2d2), bushMs = [0x4f8f3a, 0x5fa043, 0x467f33].map(c => flat(c));
  const winM = new THREE.MeshStandardMaterial({ color: 0xffc46b, emissive: 0xffa040, emissiveIntensity: 2.4, flatShading: true, side: THREE.DoubleSide });
  const glowTex = canvasTex(64, 64, (x, w, h) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,190,100,.85)'); g.addColorStop(.45, 'rgba(255,160,70,.3)'); g.addColorStop(1, 'rgba(255,150,60,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const glowM = new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .42 });
  const glow = (p, x, y, z, sx, sy) => { const s = new THREE.Sprite(glowM); s.position.set(x, y, z); s.scale.set(sx, sy, 1); p.add(s); };

  // okno: drewniana rama, szprosy, belka nadproża
  function windowAt(g, x, y, z, ry, w = .44, h = .5) {
    const p = new THREE.Group(); p.position.set(x, y, z); p.rotation.y = ry; g.add(p);
    add(p, box(w + .1, h + .1, .06), woodM, 0, 0, 0);
    add(p, new THREE.PlaneGeometry(w, h), winM, 0, 0, .032);
    add(p, box(w, .03, .02), darkWood, 0, 0, .045); add(p, box(.03, h, .02), darkWood, 0, 0, .045);
    add(p, box(w + .3, .1, .1), darkWood, 0, h / 2 + .1, .03);
    glow(p, 0, 0, .15, w * 2.6, h * 2.4);
  }

  // chatka jak na obrazku: biały tynk, strzecha, kamienne narożniki, drzwi w łuku, okrągłe okno w szczycie
  function cottage({ L = 3.6, D = 3.0, H = 2.1, thatch = 0, chimney = 1, dormer = true }) {
    const g = new THREE.Group();
    add(g, box(L, H, D), plaster, 0, H / 2, 0);
    add(g, box(L + .08, .36, D + .08), baseM, 0, .18, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let i = 0; i < 6; i++) {          // kamienne narożniki
      const y = .5 + i * .27, long = i % 2 === 0;
      add(g, box(long ? .3 : .18, .17, .04), quoinM, sx * (L / 2 - (long ? .15 : .09)), y, sz * (D / 2 + .02));
      add(g, box(.04, .17, long ? .18 : .3), quoinM, sx * (L / 2 + .02), y, sz * (D / 2 - (long ? .09 : .15)));
    }
    // szczyty (trójkąty) z belką i deskami wiatrowymi
    const rise = D * .58, pitch = Math.atan2(rise, D / 2), top = H;
    const tri = new THREE.Shape(); tri.moveTo(-D / 2, 0); tri.lineTo(D / 2, 0); tri.lineTo(0, rise); tri.lineTo(-D / 2, 0);
    for (const s of [-1, 1]) {
      const tg = new THREE.ShapeGeometry(tri); tg.rotateY(s * Math.PI / 2); add(g, tg, plaster, s * L / 2, top, 0);
      add(g, box(.12, .14, D + .4), woodM, s * (L / 2 + .05), top + .02, 0);
      for (const zz of [-1, 1]) { const len = Math.hypot(D / 2, rise); add(g, box(.08, .1, len + .2), woodM, s * (L / 2 + .05), top + rise / 2, zz * D / 4, { rx: zz * pitch }); }
      const rw = new THREE.Group(); rw.position.set(s * (L / 2 + .03), top + rise * .4, 0); rw.rotation.y = s * Math.PI / 2; g.add(rw);   // okrągłe okno
      add(rw, new THREE.TorusGeometry(.2, .05, 5, 12), woodM, 0, 0, 0);
      add(rw, new THREE.CircleGeometry(.18, 12), winM, 0, 0, .01);
      add(rw, box(.36, .03, .02), darkWood, 0, 0, .025); add(rw, box(.03, .36, .02), darkWood, 0, 0, .025);
      glow(rw, 0, 0, .12, .9, .9);
      windowAt(g, s * (L / 2 + .01), H * .55, -D * .1, s * Math.PI / 2);
    }
    // strzecha: gruby, nieregularny płaszcz z okapem i opadającymi brzegami
    const over = .45, half = D / 2 + over, T = .38, eaveY = top - over * Math.tan(pitch), ridgeY = top + rise;
    const sh = new THREE.Shape();
    sh.moveTo(-half, eaveY); sh.lineTo(-half - .06, eaveY + T * .55); sh.lineTo(-half * .5, (eaveY + ridgeY) / 2 + T);
    sh.lineTo(0, ridgeY + T); sh.lineTo(half * .5, (eaveY + ridgeY) / 2 + T); sh.lineTo(half + .06, eaveY + T * .55); sh.lineTo(half, eaveY);
    sh.lineTo(0, ridgeY - .05); sh.lineTo(-half, eaveY);
    const tg = new THREE.ExtrudeGeometry(sh, { depth: L + .7, bevelEnabled: true, bevelThickness: .12, bevelSize: .06, bevelSegments: 2, steps: 4 });
    tg.translate(0, 0, -(L + .7) / 2); tg.rotateY(Math.PI / 2); jitter(tg, .09, eaveY + .05);
    add(g, tg, THATCH[thatch], 0, 0, 0);
    const ridge = new THREE.CylinderGeometry(.22, .22, L + .9, 8, 1, false, -Math.PI / 2, Math.PI); ridge.rotateZ(Math.PI / 2);
    add(g, ridge, woodM, 0, ridgeY + T - .06, 0);
    for (let i = 0; i < 5; i++) add(g, box(.04, .03, .46), darkWood, -L / 2 + .1 + i * (L / 4.4), ridgeY + T + .1, 0, { cast: false });
    // komin z daszkiem
    if (chimney) { const cx = chimney * L * .26, chH = .95;
      add(g, box(.42, chH + .6, .42), chimM, cx, ridgeY + T + chH / 2 - .3, -.05);
      add(g, box(.58, .07, .58), woodM, cx, ridgeY + T + chH + .04, -.05);
      add(g, box(.2, .14, .2), chimM, cx, ridgeY + T + chH + .14, -.05);
      g.userData.smoke = new THREE.Vector3(cx, ridgeY + T + chH + .25, -.05); }
    // okienko „brwiowe” w strzesze
    if (dormer) { const dz = half * .5, dy = (eaveY + ridgeY) / 2 + T * .9, r = .3, dg = new THREE.Group(); dg.position.set(-L * .22, dy, dz - .1); g.add(dg);
      const hc = new THREE.CylinderGeometry(r, r, .9, 9, 1, false, -Math.PI / 2, Math.PI); hc.rotateX(-Math.PI / 2); jitter(hc, .04);
      add(dg, hc, THATCH[thatch], 0, 0, 0); add(dg, box(r * 2, .5, .5), THATCH[thatch], 0, -.25, .1);
      add(dg, new THREE.CircleGeometry(r * .7, 9, 0, Math.PI), winM, 0, -.02, .46);
      add(dg, new THREE.TorusGeometry(r * .74, .035, 4, 9, Math.PI), woodM, 0, -.02, .46);
      glow(dg, 0, .05, .6, .7, .5); }
    // przód: drzwi w kamiennym łuku, okna, schodek
    const fz = D / 2 + .01, dx = -L * .05, dw = .7, dh = 1.05;
    const ds = new THREE.Shape(); ds.moveTo(-dw / 2, 0); ds.lineTo(dw / 2, 0); ds.lineTo(dw / 2, dh); ds.absarc(0, dh, dw / 2, 0, Math.PI, false); ds.lineTo(-dw / 2, 0);
    const dgm = new THREE.ExtrudeGeometry(ds, { depth: .06, bevelEnabled: false, curveSegments: 6 }); const du = dgm.attributes.uv;
    for (let i = 0; i < du.count; i++) du.setXY(i, du.getX(i) / dw + .5, du.getY(i) / (dh + dw / 2));
    add(g, dgm, doorM, dx, .2, fz);
    add(g, new THREE.TorusGeometry(dw / 2 + .08, .085, 4, 8, Math.PI), quoinM, dx, .2 + dh, fz + .03);
    for (const s of [-1, 1]) add(g, box(.16, dh, .1), quoinM, dx + s * (dw / 2 + .08), .2 + dh / 2, fz + .03);
    add(g, new THREE.SphereGeometry(.04, 6, 4), darkWood, dx + .22, .2 + .62, fz + .08);
    add(g, box(.95, .14, .5), quoinM, dx, .07, fz + .28);
    windowAt(g, -L * .33, H * .55, fz); windowAt(g, L * .3, H * .55, fz);
    windowAt(g, L * .1, H * .55, -fz, Math.PI);
    // ścieżka z kamyków przed drzwiami i krzaki
    for (let i = 0; i < 9; i++) { const c = new THREE.IcosahedronGeometry(1, 0); const m = add(g, c, cobbleM, dx + R(-.45, .45), .02, fz + .7 + i * .32 + R(-.08, .08));
      m.scale.set(R(.1, .16), .03, R(.07, .11)); m.rotation.y = R(0, 3); m.castShadow = false; }
    for (const [bx, bz, bs] of [[L / 2 + .3, D / 2 - .2, .5], [-L / 2 - .3, D / 2 + .1, .4], [L / 2 + .1, -D / 2 - .2, .45]]) {
      const bg = new THREE.IcosahedronGeometry(bs, 1); jitter(bg, bs * .25); add(g, bg, bushMs[(rnd() * 3) | 0], bx, bs * .7, bz); }
    return g;
  }

  // ---------- rozstawienie: drugi plan, przy skraju lasu; każda chatka pokazuje przód i szczyt ----------
  const HOUSES = [
    { x: -15.5, z: -36, ry: .95, o: { thatch: 0, chimney: 1 } },
    { x: -7.5, z: -42, ry: -.3, o: { L: 4.0, D: 3.2, H: 2.2, thatch: 1, chimney: -1, dormer: false } },
    { x: 5.5, z: -43.5, ry: .6, o: { L: 3.4, D: 2.9, thatch: 2, chimney: 0 } },
    { x: 14, z: -37, ry: -.95, o: { thatch: 3, chimney: 1, dormer: false } },
  ];
  const zones = [], smokers = [], village = new THREE.Group(); scene.add(village);
  for (const hh of HOUSES) {
    const c = cottage(hh.o); c.position.set(hh.x, heightAt(hh.x, hh.z) - .05, hh.z); c.rotation.y = hh.ry; village.add(c);
    zones.push({ x: hh.x, z: hh.z, r: 4 });
    if (c.userData.smoke) { c.updateMatrixWorld(true); smokers.push(c.localToWorld(c.userData.smoke.clone())); }
  }
  // drobiazgi między chatkami: płotki i ścieżka
  const fenceM = flat(0x7a5534);
  const fence = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(len / 1.1)), a = Math.atan2(z1 - z0, x1 - x0);
    for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n; add(village, box(.09, .7, .09), fenceM, x, heightAt(x, z) + .35, z); }
    for (const y of [.28, .55]) add(village, box(len, .06, .04), fenceM, (x0 + x1) / 2, heightAt((x0 + x1) / 2, (z0 + z1) / 2) + y, (z0 + z1) / 2, { ry: -a });
  };
  fence(-19.8, -33, -18.5, -39.5); fence(1.6, -47, 8.8, -47.4); fence(17.8, -33.5, 19, -40);
  const dirtTex = canvasTex(128, 128, (x, w, h) => { const g = x.createRadialGradient(64, 64, 10, 64, 64, 64);
    g.addColorStop(0, 'rgba(176,140,92,.9)'); g.addColorStop(.7, 'rgba(160,128,84,.6)'); g.addColorStop(1, 'rgba(150,120,80,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const dirtM = new THREE.MeshStandardMaterial({ map: dirtTex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 });
  for (const [x, z] of [[-12.6, -33.4], [-9, -35.8], [-5.5, -38.2], [-1, -39.6], [3.5, -40.2], [8.5, -38.6], [11.8, -35]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(R(3, 4), R(2.2, 2.8)), dirtM); m.rotation.set(-Math.PI / 2, 0, R(0, 3)); m.position.set(x, heightAt(x, z) + .02, z); village.add(m);
  }
  // ciepłe światło z wnętrz
  for (const [x, z] of [[-13.6, -34.2], [12.4, -35.2]]) { const l = new THREE.PointLight(0xffa64a, 3, 5, 1.6); l.position.set(x, 1.2, z); village.add(l); }

  // ---------- dym z komina ----------
  const smokeTex = canvasTex(64, 64, (x, w, h) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(240,240,240,.85)'); g.addColorStop(.55, 'rgba(230,230,232,.35)'); g.addColorStop(1, 'rgba(225,225,230,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const puffs = [];
  for (const at of smokers) for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 }));
    s.userData = { at, life: i / 14, rot: R(-.6, .6), drift: R(.6, 1.1) }; village.add(s); puffs.push(s);
  }

  return {
    zones,
    update(t, dt) {
      for (const s of puffs) {
        const u = s.userData; u.life += dt * .16; if (u.life > 1) u.life -= 1;
        const L = u.life;
        s.position.set(u.at.x + L * 2.2 * u.drift + Math.sin(t * .8 + L * 6) * .2, u.at.y + L * 4.2, u.at.z - L * .5);
        s.scale.setScalar(.35 + L * 2.4);
        s.material.opacity = Math.min(1, L * 14) * (1 - L) * .7;
        s.material.rotation = u.rot * L * 3;
      }
    },
  };
}
