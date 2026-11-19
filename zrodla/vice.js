// Lobby "Vice Bay": nocny zachód słońca nad zatoką (low-poly, retro-synthwave).
// Kamera stoi na +Z i patrzy na -Z. Fasolka stoi na mokrym tarasie nad wodą; po drugiej stronie zatoki świeci miasto,
// z lewej most, na wodzie jacht, nad wodą helikopter. Kadr zamykają ciemne sylwetki palm, a z lewej świeci neon.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const C = hex => new THREE.Color(hex);
const WY = -2.5;                                   // poziom wody
const EDGE = -2.6;                                 // krawędź tarasu (z)

// wspólny GLSL: szum, gradient nieba z łuną słońca, smugi świateł miasta odbite w mokrych powierzchniach
const COMMON = `
uniform vec3 c0,c1,c2,c3,c4,c5,uGlow,uSunDir; uniform float uTime;
float h11(float n){return fract(sin(n*127.1)*43758.5453);}
float h12(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h12(i),h12(i+vec2(1,0)),f.x),mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.03+vec2(17.,9.);a*=.5;}return s;}
vec3 skyBase(vec3 d){
  float h=max(d.y,0.);
  vec3 c=mix(c0,c1,smoothstep(0.,.07,h));
  c=mix(c,c2,smoothstep(.05,.2,h));
  c=mix(c,c3,smoothstep(.16,.4,h));
  c=mix(c,c4,smoothstep(.34,.65,h));
  c=mix(c,c5,smoothstep(.6,1.,h));
  float s=max(dot(normalize(vec3(d.x,h,d.z)),uSunDir),0.);
  c+=uGlow*(pow(s,5.)*.45+pow(s,30.)*.7)*smoothstep(.4,0.,h);
  return c;
}
vec3 cityStreak(vec3 r,float dist){
  float az=atan(r.x,-r.z),el=max(r.y,0.);
  float x=az*95.+vn(vec2(az*40.,3.))*1.5,id=floor(x),f=fract(x),hh=h11(id);
  vec3 lc=hh<.3?vec3(1.,.25,.6):hh<.55?vec3(.3,.85,1.):hh<.8?vec3(1.,.72,.4):vec3(.7,.35,1.);
  float lit=step(.5,h11(id+7.31))*smoothstep(-1.3,-.9,az)*smoothstep(1.35,1.05,az);
  float br=smoothstep(.25,.8,vn(vec2(id*3.7,dist*.22-uTime*.9)));
  return lc*lit*exp(-el*10.)*br*smoothstep(0.,.3,f)*smoothstep(1.,.7,f);
}`;

// ---------- geometria z kolorami wierzchołków ----------
function soup() {
  const pos = [], col = [];
  return {
    tri(a, b, c, ca, cb = ca, cc = ca) { pos.push(...a, ...b, ...c); col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b); },
    quad(a, b, c, d, ca, cb = ca, cc = ca, cd = ca) { this.tri(a, b, c, ca, cb, cc); this.tri(a, c, d, ca, cc, cd); },
    build() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g; },
  };
}
// palma-sylwetka: wygięty pień i korona z ząbkowanych, opadających liści; crownOnly = sama korona (do ramki kadru i krzewów)
function palmGeo(seed, h, lean, crownOnly = false, frondL = 3.1) {
  const r = rng(seed), s = soup(), SIDES = 6, SEG = 9, scale = h / 8;
  const TA = C(0x2c1249), TB = C(0x150727);
  let top = new THREE.Vector3();
  if (!crownOnly) {
    const centers = [], radii = [];
    for (let i = 0; i <= SEG; i++) { const t = i / SEG; centers.push(new THREE.Vector3(lean * t * t * h * .42, t * h, Math.sin(t * 2.4 + seed) * .1 * scale)); radii.push(THREE.MathUtils.lerp(.26, .12, t) * (1 + (i % 2 ? .12 : 0)) * scale); }
    const ring = (c, rad) => { const p = []; for (let j = 0; j < SIDES; j++) { const a = j / SIDES * Math.PI * 2; p.push([c.x + Math.cos(a) * rad, c.y, c.z + Math.sin(a) * rad]); } return p; };
    for (let i = 0; i < SEG; i++) {
      const a = ring(centers[i], radii[i]), b = ring(centers[i + 1], radii[i + 1]), ca = TA.clone().lerp(TB, (i % 2) * .6), cb = TA.clone().lerp(TB, ((i + 1) % 2) * .6);
      for (let j = 0; j < SIDES; j++) { const j2 = (j + 1) % SIDES; s.quad(a[j], a[j2], b[j2], b[j], ca, ca, cb, cb); }
    }
    top = centers[SEG];
  }
  const N = 14, DARK = C(0x100620), MID = C(0x231040), TIP = C(0x4c1873);
  for (let k = 0; k < N; k++) {
    const ang = k / N * Math.PI * 2 + r() * .45, L = frondL * (.85 + r() * .4) * scale, W = (.62 + r() * .2) * scale;
    const dx = Math.cos(ang), dz = Math.sin(ang), px = -dz, pz = dx, low = k % 2;
    const rise = low ? .28 + r() * .2 : .6 + r() * .3, droop = low ? 1.05 + r() * .4 : .95 + r() * .45;
    let prev = null;
    for (let j = 0; j <= 8; j++) {
      const t = j / 8, out = L * t, y = L * (rise * t - droop * t * t), w = W * Math.sin(Math.PI * (t * .9 + .05)) * (1 - t * .3) * (j % 2 ? 1 : .68);
      const c = DARK.clone().lerp(MID, Math.min(1, t * 1.5)).lerp(TIP, Math.max(0, t - .55) * 1.6);
      const b = [top.x + dx * out, top.y + y, top.z + dz * out];
      const row = [[b[0] + px * w * .5, b[1] + w * .14, b[2] + pz * w * .5], [b[0], b[1] - w * .1, b[2]], [b[0] - px * w * .5, b[1] + w * .14, b[2] - pz * w * .5], c];
      if (prev) { s.quad(prev[0], prev[1], row[1], row[0], prev[3], prev[3], row[3], row[3]); s.quad(prev[1], prev[2], row[2], row[1], prev[3], prev[3], row[3], row[3]); }
      prev = row;
    }
  }
  return s.build();
}

export function buildVice(scene) {
  const rnd = rng(11), R = (a, b) => a + (b - a) * rnd();
  scene.fog = new THREE.FogExp2(0x7a2a9a, 0.0016);

  const SUN_DIR = new THREE.Vector3(-.2, .02, -.98).normalize();
  const U = { uTime: { value: 0 }, uSunDir: { value: SUN_DIR }, uGlow: { value: C(0xffa030) } };
  [0xff7a45, 0xff3d7f, 0xd9259a, 0x8a2bc2, 0x4a1f9a, 0x1c0e52].forEach((h, i) => { U['c' + i] = { value: C(h) }; });
  const VS = 'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}';

  // ---------- niebo: gradient, łuna, pasma chmur podświetlone od dołu, gwiazdy ----------
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { ...U, cDark: { value: C(0x35176e) }, cLit: { value: C(0xff4f8f) } },
    vertexShader: 'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `${COMMON} uniform vec3 cDark,cLit; varying vec3 vP;
      void main(){
        vec3 d=normalize(vP); float h=max(d.y,0.); vec3 col=skyBase(d);
        col+=step(.9975,h12(floor(d.xz/(d.y+.3)*90.)))*smoothstep(.45,.85,h)*.7;
        vec2 p=d.xz/(d.y+.16); p=vec2(p.x*.55+uTime*.006,p.y*1.5);
        vec2 sd=normalize(uSunDir.xz)*.22;
        float n=fbm(p*.9+vec2(3.,11.)), n2=fbm((p+vec2(sd.x*.55,sd.y*1.5))*.9+vec2(3.,11.));
        float m=smoothstep(.46,.68,n)*smoothstep(.015,.09,h)*smoothstep(.95,.5,h);
        float lit=clamp((n-n2)*5.+.3,0.,1.)*smoothstep(.7,.03,h);
        float s=max(dot(normalize(vec3(d.x,0.,d.z)),normalize(vec3(uSunDir.x,0.,uSunDir.z))),0.);
        col=mix(col,mix(cDark,mix(cLit,uGlow,pow(s,3.)*.8),lit),m*.88);
        gl_FragColor=vec4(col,1.);
        #include <colorspace_fragment>
      }`,
  })));

  // ---------- światła (fasolka, auto, jacht) ----------
  scene.add(new THREE.HemisphereLight(0xff7ac8, 0x3a1466, 1.15));
  const key = new THREE.DirectionalLight(0xff7a5a, 2.2); key.position.copy(SUN_DIR).multiplyScalar(30).setY(9); scene.add(key);      // ciepły kontur od łuny
  const fill = new THREE.DirectionalLight(0xff6ab8, 1.25); fill.position.set(-3, 4, 10); scene.add(fill);                              // róż od przodu
  const rim = new THREE.DirectionalLight(0x4de0ff, 1.5); rim.position.set(8, 3, -3); scene.add(rim);                                   // turkus z prawej

  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.2, 'rgba(255,255,255,.6)'); g.addColorStop(.5, 'rgba(255,255,255,.16)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const glowSprite = (color, x, y, z, size, op = 1) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, opacity: op, fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending, toneMapped: false })); s.position.set(x, y, z); s.scale.setScalar(size); scene.add(s); return s; };

  // ---------- woda zatoki ----------
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2800, 2800), new THREE.ShaderMaterial({
    fog: false, uniforms: { ...U, uDeep: { value: C(0x3a1478) } }, vertexShader: VS,
    fragmentShader: `${COMMON} uniform vec3 uDeep; varying vec3 vW;
      void main(){
        vec3 tc=cameraPosition-vW; float dist=length(tc); vec3 v=tc/dist;
        float w1=vn(vW.xz*vec2(.35,1.1)+vec2(uTime*.3,uTime*.5)), w2=vn(vW.xz*vec2(.9,2.7)-vec2(uTime*.25,uTime*.8));
        vec3 n=normalize(vec3((w1-.5)*.1,1.,(w2-.5)*.28));
        vec3 r=reflect(-v,n); r.y=abs(r.y);
        float fres=.12+.7*pow(1.-max(v.y,0.),9.);
        vec3 col=mix(uDeep,skyBase(r),fres)+cityStreak(r,dist)*.8;
        col+=vec3(1.,.5,.75)*smoothstep(.72,.95,vn(vW.xz*vec2(1.2,5.)+vec2(uTime*.4,-uTime)))*.1*smoothstep(160.,20.,dist);   // drobne błyski na falach
        col=mix(col,skyBase(vec3(-v.x,0.,-v.z)),smoothstep(260.,800.,dist));
        gl_FragColor=vec4(col,1.);
        #include <colorspace_fragment>
      }`,
  }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, WY, -500); scene.add(water);

  // ---------- taras: mokry asfalt z odbiciami, murek, barierka ----------
  const CAR = { x: -3.5, z: -.3, ry: Math.PI / 2 + .35 };
  const carRear = new THREE.Vector2(CAR.x - 2.5 * Math.cos(CAR.ry), CAR.z + 2.5 * Math.sin(CAR.ry));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 18), new THREE.ShaderMaterial({
    fog: false, uniforms: { ...U, uAsphalt: { value: C(0x1d0c33) }, uCurb: { value: C(0x6a4a9a) }, uRear: { value: carRear } }, vertexShader: VS,
    fragmentShader: `${COMMON} uniform vec3 uAsphalt,uCurb; uniform vec2 uRear; varying vec3 vW;
      void main(){
        vec3 tc=cameraPosition-vW; float dist=length(tc); vec3 v=tc/dist;
        float pud=smoothstep(.38,.66,fbm(vW.xz*.33+4.));                          // kałuże: gładsze i mocniej odbijają
        vec3 n=normalize(vec3((vn(vW.xz*3.)-.5)*.07*(1.-pud*.8),1.,(vn(vW.xz*3.+9.)-.5)*.12*(1.-pud*.8)));
        vec3 r=reflect(-v,n); r.y=abs(r.y);
        float fres=(.12+.5*pud)*(.25+.75*pow(1.-max(v.y,0.),3.));
        vec3 col=mix(uAsphalt*(.8+.4*vn(vW.xz*14.)),skyBase(r),fres)+cityStreak(r,dist)*fres;
        vec2 b=vW.xz-vec2(-4.5,-2.); col+=vec3(1.,.15,.6)*exp(-dot(b,b)/14.)*.16;  // róż neonu
        col=mix(col,uCurb,smoothstep(-2.2,-2.32,vW.z)*.75);                       // krawężnik
        gl_FragColor=vec4(col,1.);
        #include <colorspace_fragment>
      }`,
  }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, EDGE + 9); scene.add(ground);
  const darkMat = new THREE.MeshBasicMaterial({ color: 0x150827, fog: false });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(120, 3.4, .4), darkMat); wall.position.set(0, -1.7, EDGE - .2); scene.add(wall);
  {
    const metal = new THREE.MeshStandardMaterial({ color: 0xa894d8, roughness: .35, metalness: .3 });
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(.07, .95, .07), metal, 41), o = new THREE.Object3D();
    for (let i = 0; i < 41; i++) { o.position.set(-40 + i * 2, .475, EDGE + .25); o.updateMatrix(); posts.setMatrixAt(i, o.matrix); }
    scene.add(posts);
    for (const y of [.95, .55]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(82, .05, .06), metal); rail.position.set(0, y, EDGE + .25); scene.add(rail); }
  }

  // ---------- miasto po drugiej stronie zatoki ----------
  const winTex = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 512; const x = c.getContext('2d'), r = rng(9);
    x.fillStyle = '#1c0e42'; x.fillRect(0, 0, 256, 512);
    const lit = ['#ffd9a0', '#ff8fc8', '#8fe8ff', '#ffffff', '#c9a0ff', '#ffd9a0'];
    for (let row = 0; row < 32; row++) for (let q = 0; q < 16; q++) { x.fillStyle = r() < .36 ? lit[Math.floor(r() * lit.length)] : '#130830'; x.fillRect(q * 16 + 4, row * 16 + 4, 9, 8); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  })();
  const TINTS = [[1.5, .8, 1.25], [.8, .95, 1.7], [1.15, .8, 1.6], [1.6, .75, .95], [1, 1, 1.25]];
  const NEON = [C(0xff2d95), C(0x3de8ff), C(0xb04dff), C(0xff6a3d)];
  const bld = [], strips = [], antennas = [];
  function cityBox(w, h, d, x, y, z, tint) {
    const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y + h / 2, z);
    const uv = g.attributes.uv, sc = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]], ou = Math.floor(R(0, 16)) / 16, ov = Math.floor(R(0, 32)) / 32;
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, Math.round(sc[f][0] / 2.2) / 16 * uv.getX(k) + ou, Math.round(sc[f][1] / 2.6) / 32 * uv.getY(k) + ov); }
    const p = g.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const f = THREE.MathUtils.clamp((p.getY(i) - WY) / 55, 0, 1), m = THREE.MathUtils.lerp(1.25, .75, f), gl = (1 - f) * (1 - f); c.set([tint[0] * m + .3 * gl, tint[1] * m + .05 * gl, tint[2] * m + .2 * gl], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
  }
  function strip(w, h, d, x, y, z, col) { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y + h / 2, z); g.deleteAttribute('uv'); const n = g.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.set([col.r, col.g, col.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); strips.push(g); }
  function tower(x, z, w, h, d) {
    const tint = TINTS[Math.floor(R(0, TINTS.length))], neon = NEON[Math.floor(R(0, NEON.length))];
    bld.push(cityBox(w, h, d, x, WY, z, tint));
    let topY = WY + h;
    if (h > 26 && rnd() < .65) { const h2 = h * R(.14, .26); bld.push(cityBox(w * .62, h2, d * .62, x, topY, z, tint)); topY += h2; }
    if (rnd() < .4) { strip(.9, h, .5, x - w / 2 + .4, WY, z + d / 2 + .3, neon); strip(.9, h, .5, x + w / 2 - .4, WY, z + d / 2 + .3, neon); }
    if (rnd() < .5) strip(w + .6, 1.1, d + .6, x, WY + h - 1.1, z, neon);
    if (h > 36) { strip(.3, 6, .3, x, topY, z, C(0x2a1650)); antennas.push(x, topY + 6.5, z); }
  }
  const profile = x => 10 + 30 * Math.exp(-(((x - 110) / 170) ** 2)) + 10 * Math.exp(-(((x + 230) / 90) ** 2));
  for (let x = -460; x < 520; x += R(15, 27)) tower(x, -338 - 30 * Math.cos(x / 260) + R(-8, 14), R(13, 24), profile(x) * R(.55, 1.25), R(14, 22));
  for (let x = -440; x < 500; x += R(20, 34)) tower(x, -400 + R(-10, 20), R(16, 28), profile(x) * R(.9, 1.4) + 5, R(16, 24));
  scene.add(new THREE.Mesh(mergeGeometries(bld), new THREE.MeshBasicMaterial({ map: winTex, vertexColors: true, fog: false })));
  scene.add(new THREE.Mesh(mergeGeometries(strips), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false })));
  { const shore = new THREE.Mesh(new THREE.BoxGeometry(1200, 2.4, 30), darkMat); shore.position.set(20, WY + .6, -322); scene.add(shore); }
  // światła nabrzeża i czerwone lampki na antenach
  const pointsOf = (arr, colors, size) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); if (colors) g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const m = new THREE.PointsMaterial({ size, map: glowTex, vertexColors: !!colors, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false });
    const p = new THREE.Points(g, m); scene.add(p); return p;
  };
  { const pos = [], col = [], pal = [C(0xffb060), C(0xff4fa3), C(0x4de0ff), C(0xffe0b0), C(0xb86bff)];
    for (let i = 0; i < 260; i++) { const x = R(-470, 520), c = pal[Math.floor(R(0, pal.length))]; pos.push(x, WY + R(1.5, 7), -306 + R(-3, 3)); col.push(c.r, c.g, c.b); }
    pointsOf(pos, col, 11); }
  const antennaPts = pointsOf(antennas, null, 13); antennaPts.material.color.set(0xff2a3a);
  // różowa mgiełka świateł u podstawy miasta
  { const c = document.createElement('canvas'); c.width = 4; c.height = 64; const x = c.getContext('2d'), g = x.createLinearGradient(0, 64, 0, 0);
    g.addColorStop(0, 'rgba(255,110,170,.75)'); g.addColorStop(.35, 'rgba(255,70,160,.3)'); g.addColorStop(1, 'rgba(255,70,160,0)'); x.fillStyle = g; x.fillRect(0, 0, 4, 64);
    const haze = new THREE.Mesh(new THREE.PlaneGeometry(1500, 34), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }));
    haze.position.set(20, WY + 17, -300); scene.add(haze); }

  // ---------- most z lampami (z lewej) ----------
  {
    const A = new THREE.Vector3(-470, 0, -262), B = new THREE.Vector3(-70, 0, -318), N = 30, parts = [], lamps = [], dir = B.clone().sub(A), len = dir.length() / N, yaw = Math.atan2(-dir.z, dir.x);
    const yAt = t => WY + 7 + 7.5 * Math.sin(Math.PI * t);
    for (let i = 0; i < N; i++) {
      const t0 = i / N, t1 = (i + 1) / N, tm = (t0 + t1) / 2, p = A.clone().lerp(B, tm), y = yAt(tm);
      const deck = new THREE.BoxGeometry(len + .6, 1.5, 9); deck.rotateZ(Math.atan2(yAt(t1) - yAt(t0), len)); deck.rotateY(yaw); deck.translate(p.x, y, p.z); parts.push(deck);
      if (i % 3 === 1) { const pier = new THREE.BoxGeometry(3, y - WY, 6); pier.rotateY(yaw); pier.translate(p.x, WY + (y - WY) / 2, p.z); parts.push(pier); }
      lamps.push(p.x, y + 3.6, p.z);
    }
    scene.add(new THREE.Mesh(mergeGeometries(parts), new THREE.MeshBasicMaterial({ color: 0x2c1558, fog: false })));
    pointsOf(lamps, null, 9).material.color.set(0xffc27a);
  }

  // ---------- ciemne cyple z krzakami i palmy ----------
  {
    const parts = [], ico = new THREE.IcosahedronGeometry(1, 1);
    const mound = (x, z, sx, sy, sz) => { const g = ico.clone(); g.scale(sx, sy, sz); g.rotateY(R(0, 3)); g.translate(x, WY, z); parts.push(g); };
    mound(-10.5, -15, 7, 1.5, 6); mound(-15, -24, 9, 1.5, 7);
    mound(11, -16, 7, 1.5, 6); mound(16, -25, 9, 1.5, 7);
    mound(-58, -48, 30, 1.5, 7); mound(58, -50, 32, 1.5, 8); mound(-100, -80, 40, 1.4, 8); mound(105, -90, 44, 1.4, 9);
    for (let i = 0; i < 34; i++) { const side = i % 2 ? 1 : -1, z = R(-30, -12), x = side * R(6, 4 - z * .55), s = R(.6, 1.2); mound(x, z, s * 1.4, s * .7 + 1.3, s * 1.2); }   // krzaki
    scene.add(new THREE.Mesh(mergeGeometries(parts), new THREE.MeshBasicMaterial({ color: 0x120622, fog: false })));
  }
  const wind = U.uTime;
  const palmMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false });
  palmMat.onBeforeCompile = sh => {
    sh.uniforms.uTime = wind;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 wp=(instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
      #else
        vec3 wp=(modelMatrix*vec4(0.,0.,0.,1.)).xyz;
      #endif
      float k=(max(position.y,0.)*max(position.y,0.)+dot(position.xz,position.xz))*.004;
      transformed.x+=sin(uTime*1.2+wp.x*.2+wp.z*.1)*k;
      transformed.z+=cos(uTime*.9+wp.z*.17)*k*.6;`);
  };
  const variants = [palmGeo(3, 6.5, .5), palmGeo(7, 8, .38), palmGeo(13, 5.5, .7)];
  const PI = Math.PI;
  const palms = [   // [x, z, wariant, skala, obrót]: lewe pochylają się w prawo, prawe w lewo (do środka kadru)
    [-9, -13, 1, 1, .1], [-12, -18, 0, 1.15, -.2], [-8, -22, 2, 1.1, .3], [-15.5, -26, 1, 1.15, .1], [-5.6, -17, 2, .8, -.2],
    [8, -12, 1, .95, PI + .15], [10.5, -16.5, 0, 1.15, PI - .2], [14, -21, 2, 1.15, PI + .3], [17, -28, 1, 1.2, PI], [6.5, -19, 2, .8, PI - .3],
    [-42, -44, 1, 1.1, .2], [-55, -47, 0, 1.2, -.3], [-70, -49, 2, 1.2, .5], [44, -45, 0, 1.2, PI], [60, -50, 1, 1.15, PI + .4], [78, -52, 2, 1.2, PI - .3], [36, -47, 2, 1, PI + .2],
    [-90, -80, 1, 1.3, 0], [-112, -82, 0, 1.3, .4], [95, -90, 1, 1.3, PI], [120, -92, 0, 1.3, PI - .4],
  ];
  variants.forEach((geo, v) => {
    const list = palms.filter(p => p[2] === v), m = new THREE.InstancedMesh(geo, palmMat, list.length), o = new THREE.Object3D();
    list.forEach((p, i) => { o.position.set(p[0], WY + 1.1, p[1]); o.rotation.set(0, p[4], 0); o.scale.setScalar(p[3]); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    m.frustumCulled = false; scene.add(m);
  });
  // liście w górnych rogach kadru i niskie rośliny za barierką
  const crownGeo = palmGeo(41, 8, 0, true, 3.4);
  [[-5.2, 5.0, 1.5, 1, .4], [5.5, 5.3, 1.0, 1, 2.2], [-7.6, -.7, -3.7, .5, 1], [-5.7, -.9, -4, .42, 2], [6.4, -.8, -3.8, .46, 3], [8.7, -.7, -3.6, .5, .5], [-10, -.6, -3.9, .55, 4], [11, -.6, -4, .55, 5]]
    .forEach(([x, y, z, s, ry]) => { const m = new THREE.Mesh(crownGeo, palmMat); m.position.set(x, y, z); m.scale.setScalar(s); m.rotation.y = ry; m.frustumCulled = false; scene.add(m); });

  // ---------- neon powitalny ----------
  let sign;
  {
    if (!document.getElementById('vice-font')) { const l = document.createElement('link'); l.id = 'vice-font'; l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Yellowtail&display=swap'; document.head.appendChild(l); }
    const cv = document.createElement('canvas'); cv.width = 768; cv.height = 384; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const draw = () => {
      const x = cv.getContext('2d'); x.clearRect(0, 0, 768, 384);
      const bg = x.createLinearGradient(0, 0, 0, 384); bg.addColorStop(0, '#2a0f5c'); bg.addColorStop(1, '#4a1478'); x.fillStyle = bg; x.fillRect(0, 0, 768, 384);
      x.lineWidth = 8; x.strokeStyle = '#ff5fb4'; x.shadowColor = '#ff2d95'; x.shadowBlur = 30; x.strokeRect(22, 22, 724, 340);
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = '72px Yellowtail, "Brush Script MT", cursive'; x.shadowColor = '#37e6ff'; x.shadowBlur = 26; x.fillStyle = '#b8f6ff'; x.fillText('Welcome to', 384, 112);
      x.font = '150px Yellowtail, "Brush Script MT", cursive';
      x.shadowColor = '#ff2d95'; x.shadowBlur = 44; x.fillStyle = '#ff4fa8'; x.fillText('Beanladen', 384, 240);
      x.shadowBlur = 14; x.fillStyle = '#ffd0ea'; x.fillText('Beanladen', 384, 240);
      tex.needsUpdate = true;
    };
    draw(); try { document.fonts.load('150px Yellowtail').then(draw).catch(() => {}); } catch {}
    const g = new THREE.Group();
    sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.8), new THREE.MeshBasicMaterial({ map: tex, fog: false, toneMapped: false })); sign.position.z = .08; g.add(sign);
    const back = new THREE.Mesh(new THREE.BoxGeometry(3.8, 2, .14), darkMat); g.add(back);
    for (const dx of [-1.3, 1.3]) { const post = new THREE.Mesh(new THREE.BoxGeometry(.14, 5, .14), darkMat); post.position.set(dx, -3.4, 0); g.add(post); }
    g.scale.setScalar(1.25); g.position.set(-6.4, 2.5, -11.5); g.rotation.y = .3; scene.add(g);
    glowSprite(0xff2d95, -6.4, 2.5, -11.2, 10, .4);
  }

  // ---------- jacht ----------
  const yacht = new THREE.Group();
  {
    const white = new THREE.MeshBasicMaterial({ color: 0xfff4ff, fog: false, toneMapped: false }), warm = new THREE.MeshBasicMaterial({ color: 0x1c1040, fog: false });
    const hull = new THREE.BoxGeometry(30, 2.6, 6, 8, 1, 1), p = hull.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i); let z = p.getZ(i); if (x > 3) z *= 1 - Math.pow(Math.min(1, (x - 3) / 12), 1.6); if (p.getY(i) < 0) z *= .7; p.setZ(i, z); if (x > 3 && p.getY(i) > 0) p.setY(i, p.getY(i) + (x - 3) * .05); }
    hull.computeVertexNormals(); const hm = new THREE.Mesh(hull, white); hm.position.y = 1; yacht.add(hm);
    for (const [w, h, d, x, y] of [[16, 1.5, 5, -3, 3.05], [11, 1.4, 4.4, -4, 4.5], [6, 1.1, 3.6, -5, 5.75]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), white); m.position.set(x, y, 0); yacht.add(m); }
    for (const [w, d, x, y] of [[15, 5.06, -3, 3.1], [10, 4.46, -4, 4.55], [5, 3.66, -5, 5.8]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, .5, d), warm); m.position.set(x, y, 0); yacht.add(m); }
    const mast = new THREE.Mesh(new THREE.BoxGeometry(.2, 3, .2), white); mast.position.set(-5, 7.6, 0); yacht.add(mast);
    yacht.position.set(27, WY, -98); yacht.rotation.y = .28; scene.add(yacht);
    glowSprite(0xffc27a, 24, WY + 3.6, -96, 16, .5); glowSprite(0xffc27a, 30, WY + 1.2, -95, 20, .3);
  }

  // ---------- helikopter ----------
  const heli = new THREE.Group(); let rotor, heliLamp;
  {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), darkMat); b.scale.set(2.2, 1.15, 1.15); heli.add(b);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(3.4, .28, .28), darkMat); tail.position.set(-3.2, .25, 0); heli.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(.5, 1.1, .1), darkMat); fin.position.set(-4.8, .7, 0); heli.add(fin);
    for (const z of [-.7, .7]) { const skid = new THREE.Mesh(new THREE.BoxGeometry(2.6, .08, .08), darkMat); skid.position.set(.1, -1.35, z); heli.add(skid); }
    rotor = new THREE.Mesh(new THREE.BoxGeometry(7.6, .05, .32), darkMat); rotor.position.y = 1.3; heli.add(rotor);
    heli.scale.setScalar(1.5); scene.add(heli);
    heliLamp = glowSprite(0xff2a3a, 0, 0, 0, 5, 1);
  }

  return (t, dt) => {
    U.uTime.value = t;
    yacht.position.y = WY + Math.sin(t * .7) * .12; yacht.rotation.z = Math.sin(t * .5) * .012;
    const hx = -70 + ((t * 3.2) % 190);                                             // powolny przelot z lewej na prawo
    heli.position.set(hx, 23 + Math.sin(t * .6) * .8, -150); heli.rotation.z = -.06; rotor.rotation.y = t * 30;
    heliLamp.position.set(hx, 21, -149); heliLamp.material.opacity = Math.sin(t * 6) > .5 ? 1 : .08;
    antennaPts.material.opacity = .55 + .45 * Math.sin(t * 2.2);
    sign.material.color.setScalar(.93 + .07 * Math.sin(t * 23) * Math.sin(t * 2.7));    // lekkie migotanie neonu
  };
}
