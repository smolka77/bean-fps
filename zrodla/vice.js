// Lobby "Vice Bay": kadr jak z pocztówki retro-synthwave, w low-poly.
// Kamera stoi na +Z i patrzy na -Z, lekko w górę. Fasolka stoi na środku, na mokrej drodze nad zatoką. Droga i barierka
// biegną po skosie (z prawego dołu w lewo, w głąb). Za barierką krzaki i woda; z lewej billboard z neonem, auto i wielkie
// palmy, w tle most, po prawej wieżowce i jacht, nad wodą helikopter. Niebo: fiolet → róż → pomarańcz, ciemne chmury.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const C = hex => new THREE.Color(hex);
const WY = -2.5;                                   // poziom wody
const PHI = 0.873;                                 // skręt drogi względem kamery (50°)
// układ drogi: z' wzdłuż drogi (ujemne = w głąb, w lewo), x' w poprzek (dodatnie = strona wody)
const RAIL_X = 3.6;

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
  c+=uGlow*(pow(s,5.)*.5+pow(s,30.)*.75)*smoothstep(.4,0.,h);
  return c;
}
vec3 cityStreak(vec3 r,float dist){
  float az=atan(r.x,-r.z),el=max(r.y,0.);
  float x=az*95.+vn(vec2(az*40.,3.))*1.5,id=floor(x),f=fract(x),hh=h11(id);
  vec3 lc=hh<.3?vec3(1.,.25,.6):hh<.55?vec3(.3,.85,1.):hh<.8?vec3(1.,.72,.4):vec3(.7,.35,1.);
  float lit=step(.5,h11(id+7.31))*smoothstep(-.5,-.1,az)*smoothstep(1.35,1.05,az);
  float br=smoothstep(.25,.8,vn(vec2(id*3.7,dist*.22-uTime*.9)));
  return lc*lit*exp(-el*10.)*br*smoothstep(0.,.3,f)*smoothstep(1.,.7,f);
}`;

function soup() {
  const pos = [], col = [];
  return {
    tri(a, b, c, ca, cb = ca, cc = ca) { pos.push(...a, ...b, ...c); col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b); },
    quad(a, b, c, d, ca, cb = ca, cc = ca, cd = ca) { this.tri(a, b, c, ca, cb, cc); this.tri(a, c, d, ca, cc, cd); },
    build() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g; },
  };
}
// palma-sylwetka: wygięty pień i gęsta korona z ząbkowanych, opadających liści; crownOnly = sama korona
function palmGeo(seed, h, lean, crownOnly = false, frondL = 3.3) {
  const r = rng(seed), s = soup(), SIDES = 6, SEG = 10, scale = Math.max(.8, h / 8);
  const TA = C(0x2c1249), TB = C(0x150727);
  let top = new THREE.Vector3();
  if (!crownOnly) {
    const centers = [], radii = [];
    for (let i = 0; i <= SEG; i++) { const t = i / SEG; centers.push(new THREE.Vector3(lean * t * t * h * .42, t * h, Math.sin(t * 2.4 + seed) * .1 * scale)); radii.push(THREE.MathUtils.lerp(.3, .14, t) * (1 + (i % 2 ? .12 : 0)) * scale); }
    const ring = (c, rad) => { const p = []; for (let j = 0; j < SIDES; j++) { const a = j / SIDES * Math.PI * 2; p.push([c.x + Math.cos(a) * rad, c.y, c.z + Math.sin(a) * rad]); } return p; };
    for (let i = 0; i < SEG; i++) {
      const a = ring(centers[i], radii[i]), b = ring(centers[i + 1], radii[i + 1]), ca = TA.clone().lerp(TB, (i % 2) * .6), cb = TA.clone().lerp(TB, ((i + 1) % 2) * .6);
      for (let j = 0; j < SIDES; j++) { const j2 = (j + 1) % SIDES; s.quad(a[j], a[j2], b[j2], b[j], ca, ca, cb, cb); }
    }
    top = centers[SEG];
  }
  const N = 17, DARK = C(0x0e051c), MID = C(0x1f0d3a), TIP = C(0x45166a);
  for (let k = 0; k < N; k++) {
    const ang = k / N * Math.PI * 2 + r() * .4, L = frondL * (.85 + r() * .4) * scale, W = (.7 + r() * .2) * scale;
    const dx = Math.cos(ang), dz = Math.sin(ang), px = -dz, pz = dx, low = k % 3;
    const rise = low === 0 ? .7 + r() * .25 : low === 1 ? .4 + r() * .2 : .15 + r() * .15, droop = low === 2 ? 1.15 + r() * .35 : .95 + r() * .4;
    let prev = null;
    for (let j = 0; j <= 9; j++) {
      const t = j / 9, out = L * t, y = L * (rise * t - droop * t * t), w = W * Math.sin(Math.PI * (t * .9 + .05)) * (1 - t * .3) * (j % 2 ? 1 : .6);
      const c = DARK.clone().lerp(MID, Math.min(1, t * 1.5)).lerp(TIP, Math.max(0, t - .55) * 1.6);
      const b = [top.x + dx * out, top.y + y, top.z + dz * out];
      const row = [[b[0] + px * w * .5, b[1] + w * .14, b[2] + pz * w * .5], [b[0], b[1] - w * .1, b[2]], [b[0] - px * w * .5, b[1] + w * .14, b[2] - pz * w * .5], c];
      if (prev) { s.quad(prev[0], prev[1], row[1], row[0], prev[3], prev[3], row[3], row[3]); s.quad(prev[1], prev[2], row[2], row[1], prev[3], prev[3], row[3], row[3]); }
      prev = row;
    }
  }
  return s.build();
}
const profile2d = pts => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); return s; };
// bryła z profilu bocznego (x = długość, y = wysokość), wyciągnięta na szerokość w (symetrycznie w osi z)
const slab = (pts, w) => { const g = new THREE.ExtrudeGeometry(profile2d(pts), { depth: w, bevelEnabled: false }); g.translate(0, 0, -w / 2); return g; };

export function buildVice(scene) {
  const rnd = rng(11), R = (a, b) => a + (b - a) * rnd();
  scene.fog = new THREE.FogExp2(0x8a3a9a, 0.003);

  const SUN_DIR = new THREE.Vector3(-.2, .02, -.98).normalize();
  const U = { uTime: { value: 0 }, uSunDir: { value: SUN_DIR }, uGlow: { value: C(0xffa030) } };
  [0xff7a45, 0xff3d7f, 0xd9259a, 0x8a2bc2, 0x4a1f9a, 0x1c0e52].forEach((h, i) => { U['c' + i] = { value: C(h) }; });
  const VS = 'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}';

  // ---------- niebo ----------
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

  // ---------- światła ----------
  scene.add(new THREE.HemisphereLight(0xff8ad0, 0x4a2070, 1.2));
  const key = new THREE.DirectionalLight(0xff8a5a, 2.4);
  key.target.position.set(0, 0, -2); key.position.set(SUN_DIR.x * 30, 9, SUN_DIR.z * 30); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
  Object.assign(key.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 80 });
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xff6ab8, 1.1); fill.position.set(-3, 4, 10); scene.add(fill);
  const rim = new THREE.DirectionalLight(0x4de0ff, 1.3); rim.position.set(8, 3, -3); scene.add(rim);

  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.2, 'rgba(255,255,255,.6)'); g.addColorStop(.5, 'rgba(255,255,255,.16)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const glowSprite = (color, x, y, z, size, op = 1, parent = scene) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, opacity: op, fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending, toneMapped: false })); s.position.set(x, y, z); s.scale.setScalar(size); parent.add(s); return s; };
  const decal = (color, w, h, op, parent) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: glowTex, color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false })); m.rotation.x = -Math.PI / 2; parent.add(m); return m; };
  const darkMat = new THREE.MeshBasicMaterial({ color: 0x120622, fog: false });

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
        vec3 col=mix(uDeep,skyBase(r),fres)+cityStreak(r,dist)*.85;
        col+=vec3(1.,.5,.75)*smoothstep(.72,.95,vn(vW.xz*vec2(1.2,5.)+vec2(uTime*.4,-uTime)))*.1*smoothstep(160.,20.,dist);
        col=mix(col,skyBase(vec3(-v.x,0.,-v.z)),smoothstep(260.,800.,dist));
        gl_FragColor=vec4(col,1.);
        #include <colorspace_fragment>
      }`,
  }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, WY, -500); scene.add(water);

  // ---------- droga nad zatoką: mokry asfalt, linie, barierka energochłonna, skarpa z krzakami, auto ----------
  const prom = new THREE.Group(); prom.rotation.y = PHI; scene.add(prom);
  const palmMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false });
  palmMat.onBeforeCompile = sh => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 wp=(modelMatrix*vec4(0.,0.,0.,1.)).xyz;
      float k=(max(position.y,0.)*max(position.y,0.)+dot(position.xz,position.xz))*.003;
      transformed.x+=sin(uTime*1.2+wp.x*.2+wp.z*.1)*k;
      transformed.z+=cos(uTime*.9+wp.z*.17)*k*.6;`);
  };
  const crownGeo = palmGeo(41, 8, 0, true, 3.4);
  {
    const asphaltTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'), r = rng(4);
      x.fillStyle = '#3a2c4e'; x.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 9000; i++) { const v = r(); x.fillStyle = v < .5 ? `rgba(18,10,30,${.1 + r() * .22})` : `rgba(190,160,220,${.04 + r() * .1})`; x.fillRect(r() * 512, r() * 512, 1 + r() * 2.5, 1 + r() * 2.5); }
      for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(20,10,34,${.06 + r() * .1})`; x.beginPath(); x.ellipse(r() * 512, r() * 512, 20 + r() * 60, 8 + r() * 22, r() * 3, 0, 7); x.fill(); }   // ciemniejsze, mokre plamy
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; return t;
    })();
    const LEN = 340, Z0 = -110, W = 46;
    asphaltTex.repeat.set(W / 4, LEN / 4);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(W, LEN), new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: .6 }));
    road.rotation.x = -Math.PI / 2; road.position.set(RAIL_X - .1 - W / 2, 0, Z0); road.receiveShadow = true; prom.add(road);
    const line = (x, w, color, op) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, LEN), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, fog: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, .012, Z0); prom.add(m); };
    line(RAIL_X - .75, .13, 0xd9c8f0, .7); line(-2.6, .12, 0xffc46a, .75); line(-2.85, .12, 0xffc46a, .75);
    // barierka: słupki i szeroka stalowa taśma
    const metal = new THREE.MeshStandardMaterial({ color: 0xb4a6d6, roughness: .35, metalness: .3 });
    const NP = 90, posts = new THREE.InstancedMesh(new THREE.BoxGeometry(.11, .8, .13), metal, NP), o = new THREE.Object3D();
    for (let i = 0; i < NP; i++) { o.position.set(RAIL_X, .4, 36 - i * 3); o.updateMatrix(); posts.setMatrixAt(i, o.matrix); }
    posts.castShadow = true; posts.frustumCulled = false; prom.add(posts);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(.07, .3, 290), metal); beam.position.set(RAIL_X - .09, .62, -100); beam.castShadow = true; prom.add(beam);
    // skarpa za barierką i gęste krzaki
    const bank = new THREE.Mesh(new THREE.BoxGeometry(5.4, 2.7, LEN), darkMat); bank.position.set(RAIL_X + 2.9, -1.8, Z0); prom.add(bank);
    const parts = [], ico = new THREE.IcosahedronGeometry(1, 1);
    for (let i = 0; i < 150; i++) { const s = R(.5, 1.05), g = ico.clone(); g.scale(s * 1.5, s * .85, s * 1.3); g.rotateY(R(0, 3)); g.translate(R(RAIL_X + .7, RAIL_X + 4.6), -.35, R(-120, 34)); parts.push(g); }
    prom.add(new THREE.Mesh(mergeGeometries(parts), darkMat));
    for (let z = 30; z > -70; z -= R(3.5, 6.5)) { const m = new THREE.Mesh(crownGeo, palmMat); m.position.set(RAIL_X + R(.9, 2.4), R(-.1, .2), z); m.scale.setScalar(R(.26, .42)); m.rotation.y = R(0, 6); m.frustumCulled = false; prom.add(m); }
    // auto: niskie coupé widziane od tyłu, z czerwonym pasem świateł
    const car = new THREE.Group(), paint = new THREE.MeshStandardMaterial({ color: 0x3a1466, roughness: .28, flatShading: true }), glass = new THREE.MeshStandardMaterial({ color: 0x0c0618, roughness: .12, flatShading: true });
    const addC = (g, m) => { const me = new THREE.Mesh(g, m); car.add(me); return me; };
    addC(slab([[-2.3, .3], [-2.3, .76], [-2.05, .86], [1.95, .8], [2.3, .6], [2.3, .3]], 1.9), paint);
    addC(slab([[-1.55, .86], [-.85, 1.28], [.4, 1.28], [1.05, .84]], 1.62), glass);
    addC(slab([[-.9, 1.27], [-.84, 1.32], [.38, 1.32], [.44, 1.27]], 1.64), paint);
    const wheel = new THREE.CylinderGeometry(.36, .36, .26, 12); wheel.rotateX(Math.PI / 2);
    for (const [x, z] of [[-1.4, .86], [-1.4, -.86], [1.4, .86], [1.4, -.86]]) { const w = addC(wheel, darkMat); w.position.set(x, .36, z); }
    const red = new THREE.MeshBasicMaterial({ color: 0xff2030, toneMapped: false, fog: false });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(.05, .13, 1.72), red); bar.position.set(-2.32, .66, 0); car.add(bar);
    for (const z of [-.62, .62]) glowSprite(0xff1830, -2.36, .66, z, 1.5, .85, car);
    decal(0xff1830, 6.5, 3.4, .32, car).position.set(-4.6, .02, 0);           // czerwona poświata na mokrym asfalcie
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.4), new THREE.MeshBasicMaterial({ map: glowTex, color: 0x000000, transparent: true, opacity: .55, depthWrite: false, fog: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = .015; car.add(shadow);   // miękki cień kontaktowy zamiast długiego cienia od słońca
    car.scale.setScalar(.92); car.position.set(.7, 0, -8); car.rotation.y = Math.PI / 2; prom.add(car);
  }
  decal(0xff3d9a, 16, 16, .13, scene).position.set(-5, .02, -6);              // róż neonu na drodze

  // ---------- miasto po drugiej stronie zatoki: niskie z lewej, wieżowce po prawej ----------
  const winTex = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 512; const x = c.getContext('2d'), r = rng(9);
    x.fillStyle = '#1c0e42'; x.fillRect(0, 0, 256, 512);
    const lit = ['#ffd9a0', '#ff8fc8', '#8fe8ff', '#ffffff', '#c9a0ff', '#ffd9a0'];
    for (let row = 0; row < 32; row++) for (let q = 0; q < 16; q++) { x.fillStyle = r() < .4 ? lit[Math.floor(r() * lit.length)] : '#130830'; x.fillRect(q * 16 + 4, row * 16 + 4, 9, 8); }
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
    for (let i = 0; i < p.count; i++) { const f = THREE.MathUtils.clamp((p.getY(i) - WY) / 80, 0, 1), m = THREE.MathUtils.lerp(1.3, .8, f), gl = (1 - f) * (1 - f); c.set([tint[0] * m + .3 * gl, tint[1] * m + .05 * gl, tint[2] * m + .2 * gl], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
  }
  function strip(w, h, d, x, y, z, col) { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y + h / 2, z); g.deleteAttribute('uv'); const n = g.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.set([col.r, col.g, col.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); strips.push(g); }
  function tower(x, z, w, h, d) {
    const tint = TINTS[Math.floor(R(0, TINTS.length))], neon = NEON[Math.floor(R(0, NEON.length))];
    bld.push(cityBox(w, h, d, x, WY, z, tint));
    let topY = WY + h;
    if (h > 30 && rnd() < .7) { const h2 = h * R(.12, .22); bld.push(cityBox(w * .62, h2, d * .62, x, topY, z, tint)); topY += h2; }
    if (rnd() < .45) { strip(.9, h, .5, x - w / 2 + .4, WY, z + d / 2 + .3, neon); strip(.9, h, .5, x + w / 2 - .4, WY, z + d / 2 + .3, neon); }
    if (rnd() < .5) strip(w + .6, 1.1, d + .6, x, WY + h - 1.1, z, neon);
    if (h > 50) { strip(.3, 7, .3, x, topY, z, C(0x2a1650)); antennas.push(x, topY + 7.5, z); }
  }
  const skyline = x => 13 + 62 * Math.exp(-(((x - 105) / 105) ** 2));
  for (let x = -260; x < 520; x += R(15, 25)) tower(x, -338 - 20 * Math.cos(x / 260) + R(-8, 14), R(13, 22), skyline(x) * R(.5, 1.15), R(14, 22));
  for (let x = -240; x < 500; x += R(20, 32)) tower(x, -395 + R(-10, 20), R(16, 26), skyline(x) * R(.8, 1.3) + 4, R(16, 24));
  scene.add(new THREE.Mesh(mergeGeometries(bld), new THREE.MeshBasicMaterial({ map: winTex, vertexColors: true, fog: false })));
  scene.add(new THREE.Mesh(mergeGeometries(strips), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false })));
  { const shore = new THREE.Mesh(new THREE.BoxGeometry(1200, 2.4, 30), darkMat); shore.position.set(20, WY + .6, -322); scene.add(shore); }
  const pointsOf = (arr, colors, size) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); if (colors) g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ size, map: glowTex, vertexColors: !!colors, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }));
    scene.add(p); return p;
  };
  { const pos = [], col = [], pal = [C(0xffb060), C(0xff4fa3), C(0x4de0ff), C(0xffe0b0), C(0xb86bff)];
    for (let i = 0; i < 260; i++) { const x = R(-300, 520), c = pal[Math.floor(R(0, pal.length))]; pos.push(x, WY + R(1.5, 7), -306 + R(-3, 3)); col.push(c.r, c.g, c.b); }
    pointsOf(pos, col, 11); }
  const antennaPts = pointsOf(antennas, null, 13); antennaPts.material.color.set(0xff2a3a);
  { const c = document.createElement('canvas'); c.width = 4; c.height = 64; const x = c.getContext('2d'), g = x.createLinearGradient(0, 64, 0, 0);
    g.addColorStop(0, 'rgba(255,110,170,.75)'); g.addColorStop(.35, 'rgba(255,70,160,.3)'); g.addColorStop(1, 'rgba(255,70,160,0)'); x.fillStyle = g; x.fillRect(0, 0, 4, 64);
    const haze = new THREE.Mesh(new THREE.PlaneGeometry(1500, 40), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }));
    haze.position.set(20, WY + 20, -300); scene.add(haze); }

  // ---------- most na filarach z lampami: od lewego brzegu do miasta ----------
  {
    const A = new THREE.Vector3(-150, 0, -250), B = new THREE.Vector3(60, 0, -275), N = 16, parts = [], lamps = [], dir = B.clone().sub(A), len = dir.length() / N, yaw = Math.atan2(-dir.z, dir.x);
    const yAt = t => WY + 5 + 3.2 * Math.sin(Math.PI * t);
    for (let i = 0; i < N; i++) {
      const t0 = i / N, t1 = (i + 1) / N, tm = (t0 + t1) / 2, p = A.clone().lerp(B, tm), y = yAt(tm);
      const deck = new THREE.BoxGeometry(len + .6, 1.3, 8); deck.rotateZ(Math.atan2(yAt(t1) - yAt(t0), len)); deck.rotateY(yaw); deck.translate(p.x, y, p.z); parts.push(deck);
      const pier = new THREE.BoxGeometry(2.4, y - WY, 5); pier.rotateY(yaw); pier.translate(p.x, WY + (y - WY) / 2, p.z); parts.push(pier);
      lamps.push(p.x - len * .25, y + 2.6, p.z, p.x + len * .25, y + 2.6, p.z);
    }
    scene.add(new THREE.Mesh(mergeGeometries(parts), new THREE.MeshBasicMaterial({ color: 0x6a3a96, fog: false })));
    pointsOf(lamps, null, 7).material.color.set(0xffc27a);
  }

  // ---------- ląd w tle (lewy brzeg, wysepka po prawej) i palmy ----------
  {
    const parts = [], ico = new THREE.IcosahedronGeometry(1, 1);
    const mound = (x, z, sx, sy, sz) => { const g = ico.clone(); g.scale(sx, sy, sz); g.rotateY(R(0, 3)); g.translate(x, WY, z); parts.push(g); };
    mound(-190, -240, 90, 4, 30); mound(-70, -120, 40, 2.2, 12); mound(95, -150, 38, 1.8, 10); mound(11, -22, 6, 1.8, 5); mound(-14, -19, 9, 2, 6);
    scene.add(new THREE.Mesh(mergeGeometries(parts), darkMat));
  }
  // [x, podstawa y, z, wysokość, pochylenie, obrót, ziarno]: duże palmy zamykają kadr z lewej i z prawej
  [[-10.4, -.7, -13.2, 9.2, .55, .1, 3], [-5.6, -.7, -15.6, 6.6, .5, .35, 7], [-15.5, -.7, -19.5, 7.6, .35, -.2, 13], [-8.2, -.7, -24, 5.6, .3, .6, 17],
    [6.1, -.7, -4.6, 7.4, .5, Math.PI + .1, 23], [11.4, -.7, -21.5, 6.2, .45, Math.PI + .3, 29], [9, -.7, -13, 4.6, .6, Math.PI - .2, 31],
    [-80, WY + 1.2, -118, 8, .3, 0, 37], [-62, WY + 1.2, -120, 9, .4, .4, 41], [-95, WY + 1.2, -122, 7, .5, -.3, 43], [84, WY + 1, -148, 8, .4, Math.PI, 47], [100, WY + 1, -150, 9, .3, Math.PI - .4, 53], [112, WY + 1, -152, 7, .5, Math.PI + .3, 59]]
    .forEach(([x, y, z, h, lean, ry, seed]) => { const m = new THREE.Mesh(palmGeo(seed, h, lean), palmMat); m.position.set(x, y, z); m.rotation.y = ry; m.frustumCulled = false; scene.add(m); });
  // liście palm w górnych rogach kadru
  [[-5.4, 5.6, 1.4, 1, .4], [5.6, 5.8, 1.0, 1, 2.2]].forEach(([x, y, z, s, ry]) => { const m = new THREE.Mesh(crownGeo, palmMat); m.position.set(x, y, z); m.scale.setScalar(s); m.rotation.y = ry; m.frustumCulled = false; scene.add(m); });

  // ---------- billboard z neonem (z lewej, za barierką) ----------
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
      x.font = '124px Yellowtail, "Brush Script MT", cursive';
      x.shadowColor = '#ff2d95'; x.shadowBlur = 44; x.fillStyle = '#ff4fa8'; x.fillText('Beanladen', 384, 240);
      x.shadowBlur = 14; x.fillStyle = '#ffd0ea'; x.fillText('Beanladen', 384, 240);
      tex.needsUpdate = true;
    };
    draw(); try { document.fonts.load('150px Yellowtail').then(draw).catch(() => {}); } catch {}
    const g = new THREE.Group();
    sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.8), new THREE.MeshBasicMaterial({ map: tex, fog: false, toneMapped: false })); sign.position.z = .08; g.add(sign);
    g.add(new THREE.Mesh(new THREE.BoxGeometry(3.8, 2, .14), darkMat));
    for (const dx of [-1.2, 1.2]) { const post = new THREE.Mesh(new THREE.BoxGeometry(.12, 3, .12), darkMat); post.position.set(dx, -2.4, 0); g.add(post); }
    g.scale.setScalar(1.15); g.position.set(-9.6, 3.5, -16.5); g.rotation.y = .4; scene.add(g);
    glowSprite(0xff2d95, -9.6, 3.5, -16.1, 10, .4);
  }

  // ---------- jacht motorowy ----------
  const yacht = new THREE.Group();
  {
    const s = soup(), WHITE = C(0xffffff), NAVY = C(0x1a1446), DECK = C(0xd9cfe6), ST = 16, X0 = -15, LENY = 31, pts = [];
    const halfW = t => 3.1 * Math.pow(Math.max(0, 1 - Math.pow(Math.max(0, (t - .42) / .58), 2.3)), .75);
    for (let i = 0; i <= ST; i++) { const t = i / ST, w = halfW(t); pts.push({ x: X0 + LENY * t, k: [.5 * w, -.25], b: [.84 * w, .6], t: [w, 2.15 + 1.25 * t * t] }); }
    for (let i = 0; i < ST; i++) {
      const a = pts[i], b = pts[i + 1];
      for (const sg of [1, -1]) { const P = (q, v) => [q.x, v[1], v[0] * sg]; s.quad(P(a, a.k), P(b, b.k), P(b, b.b), P(a, a.b), NAVY); s.quad(P(a, a.b), P(b, b.b), P(b, b.t), P(a, a.t), WHITE); }
      s.quad([a.x, a.t[1], a.t[0]], [b.x, b.t[1], b.t[0]], [b.x, b.t[1], -b.t[0]], [a.x, a.t[1], -a.t[0]], DECK);
    }
    { const a = pts[0]; s.quad([a.x, a.k[1], a.k[0]], [a.x, a.k[1], -a.k[0]], [a.x, a.t[1], -a.t[0]], [a.x, a.t[1], a.t[0]], WHITE); }
    const hullG = s.build(); hullG.computeVertexNormals();
    yacht.add(new THREE.Mesh(hullG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .45, side: THREE.DoubleSide, flatShading: true, emissive: 0x4a3566, fog: false })));
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .45, flatShading: true, emissive: 0x4a3566, fog: false });
    const glass = new THREE.MeshStandardMaterial({ color: 0x0e0a26, roughness: .15, flatShading: true, fog: false });
    const litGlass = new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false, toneMapped: false });
    const add = (g, m) => { const me = new THREE.Mesh(g, m); yacht.add(me); return me; };
    add(slab([[-11.5, 2.2], [-11.5, 4.15], [4.6, 4.15], [8.6, 2.75]], 4.9), white);
    add(slab([[-10.6, 2.95], [-10.6, 3.75], [4.9, 3.75], [6.9, 3.05]], 4.96), glass);
    add(slab([[-8.6, 4.15], [-8.6, 5.75], [1.8, 5.75], [4.6, 4.15]], 4.1), white);
    add(slab([[-7.9, 4.6], [-7.9, 5.35], [2.0, 5.35], [3.3, 4.6]], 4.16), litGlass);
    add(slab([[-7.2, 6.75], [-7.2, 6.98], [1.2, 6.98], [2.2, 6.75]], 3.9), white);
    for (const x of [-6.6, -2.4, .6]) for (const z of [-1.75, 1.75]) { const p = add(new THREE.BoxGeometry(.14, 1.0, .14), white); p.position.set(x, 6.25, z); }
    add(slab([[-6.4, 6.98], [-5.6, 8.3], [-4.9, 8.3], [-4.4, 6.98]], .5), white);
    for (const x of [-9, -5.5, -2, 1.5, 5, 8.5, 11.5]) for (const z of [-1, 1]) { const ph = add(new THREE.BoxGeometry(.5, .2, .06), litGlass); ph.position.set(x, 1.45, z * (halfW((x - X0) / LENY) * .93 + .02)); }
    yacht.position.set(22, WY, -128); yacht.rotation.y = .3; scene.add(yacht);
    glowSprite(0xffc27a, -3, 5, 0, 9, .32, yacht); glowSprite(0x6ad8ff, -15, .2, 0, 7, .5, yacht);
    decal(0xffd6f0, 26, 9, .34, yacht).position.set(-.5, .06, 3.2);
  }

  // ---------- helikopter ----------
  const heli = new THREE.Group(); let rotor, heliLamp;
  {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), darkMat); b.scale.set(2.2, 1.15, 1.15); heli.add(b);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(3.4, .28, .28), darkMat); tail.position.set(-3.2, .25, 0); heli.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(.5, 1.1, .1), darkMat); fin.position.set(-4.8, .7, 0); heli.add(fin);
    for (const z of [-.7, .7]) { const skid = new THREE.Mesh(new THREE.BoxGeometry(2.6, .08, .08), darkMat); skid.position.set(.1, -1.35, z); heli.add(skid); }
    rotor = new THREE.Mesh(new THREE.BoxGeometry(7.6, .05, .32), darkMat); rotor.position.y = 1.3; heli.add(rotor);
    heli.scale.setScalar(1.6); scene.add(heli);
    heliLamp = glowSprite(0xff2a3a, 0, 0, 0, 5, 1);
  }

  return (t, dt) => {
    U.uTime.value = t;
    yacht.position.y = WY + Math.sin(t * .7) * .1; yacht.rotation.z = Math.sin(t * .5) * .01;
    const hx = -17 + Math.sin(t * .07) * 14;                                       // helikopter krąży powoli nad zatoką
    heli.position.set(hx, 33 + Math.sin(t * .6) * .8, -150); heli.rotation.z = -.06; heli.rotation.y = Math.cos(t * .07) > 0 ? 0 : Math.PI; rotor.rotation.y = t * 30;
    heliLamp.position.set(hx, 31, -149); heliLamp.material.opacity = Math.sin(t * 6) > .5 ? 1 : .08;
    antennaPts.material.opacity = .55 + .45 * Math.sin(t * 2.2);
    sign.material.color.setScalar(.93 + .07 * Math.sin(t * 23) * Math.sin(t * 2.7));
  };
}
