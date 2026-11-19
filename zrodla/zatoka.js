// Zatoka w tle lobby (mapa lobby „Zatoka” w panelu admina): słoneczne tropikalne miasto nad zatoką, klimat pocztówki z Florydy.
// Fasolka stoi na wysokiej estakadzie autostrady (widać tylko wąski pas jezdni), 5 m za nią bariera z poręczą,
// a za barierą, 30 m niżej, turkusowa zatoka widziana z góry: wyspa z willą, palmami i pomostem, mniejsze wysepki,
// jacht, motorówki i skutery z białym kilwaterem, żaglówki, cienie chmur na wodzie, grobla z autami;
// na drugim brzegu plaża z palmami, pastelowe kamienice, marina i kilka planów wieżowców (szkło odbija niebo),
// dalej zamglone miasto i wielkie kłębiaste chmury. Obraz przechodzi przez bloom, tone mapping ACES i lekką korekcję kolorów.
// buildBay(scene, renderer) -> { update(t, dt), render(camera), cam }   (fasolka stoi w (0,0,0), kamera patrzy w stronę -Z)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
const hash3 = (x, y, z) => { const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return v - Math.floor(v); };
const jitter = (g, amt, seed) => { const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = o => hash3(x * 3.1 + o + seed, y * 3.7 + o, z * 2.9) - .5;
    p.setXYZ(i, x + n(1) * amt, y + n(5) * amt * .6, z + n(9) * amt); } return g; };
const paint = (g, fn) => { const p = g.attributes.position, c = new Float32Array(p.count * 3), col = new THREE.Color();
  for (let i = 0; i < p.count; i++) { fn(p.getX(i), p.getY(i), p.getZ(i), col); c.set([col.r, col.g, col.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; };
const prep = g => { g = g.index ? g.toNonIndexed() : g; if (g.attributes.uv) g.deleteAttribute('uv'); return g; };
function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

const WY = -30;          // poziom wody: estakada stoi 30 m nad zatoką
const BZ = -5.2;         // bariera 5 m za fasolką
const FOG = 0.00025;     // mgła powietrzna: każdy plan miasta jest trochę bledszy od poprzedniego
const ROAD_L = 400;
// kamera „pocztówkowa”: dalej od fasolki i z wąskim kątem, więc jezdnia to tylko pasek, a zatoka i miasto są duże
export const BAY_CAM = { fov: 30, fovP: 44, z: 7.2, zP: 6.4, y: 2.15, ty: 1.55, tyP: 1.35, near: .3, far: 7500 };   // kamera blisko fasolki, nad barierą widać wodę
const SUN_DIR = new THREE.Vector3(-.3, .11, -.95).normalize();   // zachód słońca: nisko nad miastem, lekko z lewej, w kadrze

const SKY_GLSL = `uniform vec3 uTop,uMid,uBot,uWarm,uSun;
  vec3 skyCol(vec3 d){float h=max(d.y,0.);vec3 c=mix(uBot,uMid,smoothstep(0.,.13,h));c=mix(c,uTop,smoothstep(.13,.62,h));
    float s=max(dot(normalize(vec3(d.x,0.,d.z)+1e-4),normalize(vec3(uSun.x,0.,uSun.z))),0.);c+=uWarm*pow(s,3.)*exp(-h*5.)*.55;float sd=max(dot(d,normalize(uSun)),0.);c+=uWarm*(pow(sd,900.)*5.+pow(sd,40.)*.35);return c;}`;

// palma: wygięty pień w słojach i gęsta korona opadających liści (kolory w wierzchołkach, low poly)
function palmGeo(h, lean, seed) {
  const r = rng(seed), parts = [];
  const tr = new THREE.CylinderGeometry(.2, .36, h, 7, 10, true); tr.translate(0, h / 2, 0);
  { const p = tr.attributes.position; for (let i = 0; i < p.count; i++) { const k = p.getY(i) / h; p.setX(i, p.getX(i) + lean * k * k); } }
  const BARK = new THREE.Color(0x9a7650);
  parts.push(paint(prep(jitter(tr, .05, seed)), (x, y, z, c) => c.copy(BARK).multiplyScalar((.62 + .5 * y / h) * (Math.floor(y / .5) % 2 ? .9 : 1.04))));
  const G = new THREE.Color(0x1d7a34), L = new THREE.Color(0x9ad655), top = [lean, h - .1, 0];
  const nF = 11;
  for (let f = 0; f < nF; f++) {
    const a = f / nF * Math.PI * 2 + r() * .4, len = 3.4 + r() * 1.6, up = .4 + r() * .7, droop = 2.0 + r() * 1.3;
    const dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx, S = 7, pts = [];
    for (let s = 0; s <= S; s++) {
      const u = s / S, w = Math.sin(Math.min(1, u * 1.1) * Math.PI) * .7 + .04;
      const y = top[1] + up * Math.sin(u * Math.PI * .8) - droop * u * u, d = len * u, cx = top[0] + dx * d, cz = top[2] + dz * d;
      pts.push([[cx + px * w, y - .24 * w, cz + pz * w], [cx, y + .08, cz], [cx - px * w, y - .24 * w, cz - pz * w]]);
    }
    const pos = [], col = [], cc = new THREE.Color();
    const v = ([q, u, rib]) => { pos.push(...q); cc.lerpColors(G, L, Math.min(1, u * .75 + rib * .3)); col.push(cc.r, cc.g, cc.b); };
    for (let s = 0; s < S; s++) {
      const A = pts[s], B = pts[s + 1], ua = s / S, ub = (s + 1) / S;
      for (const [i, j] of [[0, 1], [1, 2]]) { v([A[i], ua, i === 1]); v([B[i], ub, i === 1]); v([B[j], ub, j === 1]); v([A[i], ua, i === 1]); v([B[j], ub, j === 1]); v([A[j], ua, j === 1]); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals(); parts.push(g);
  }
  for (let k = 0; k < 4; k++) { const g = new THREE.IcosahedronGeometry(.22, 0), a = k * 1.7 + r(); g.translate(top[0] + Math.cos(a) * .28, top[1] - .25, Math.sin(a) * .28); parts.push(paint(prep(g), (x, y, z, c) => c.setHex(0x6a4a22))); }
  return mergeGeometries(parts);
}
function bushGeo(seed, base) {
  const g = jitter(new THREE.IcosahedronGeometry(1, 1), .32, seed), B = new THREE.Color(base);
  return paint(prep(g), (x, y, z, c) => c.copy(B).multiplyScalar(.55 + .6 * (y * .5 + .5)));
}
// kadłub łodzi: obrys z góry (dziób w -Z) wyciągnięty w górę, dno węższe (kształt V)
function hullGeo(L, W, H, bow = .34, vee = .55) {
  const s = new THREE.Shape();
  s.moveTo(-W / 2, -L / 2); s.lineTo(W / 2, -L / 2); s.lineTo(W / 2, L * (.5 - bow));
  s.quadraticCurveTo(W / 2 * .92, L * .44, 0, L / 2); s.quadraticCurveTo(-W / 2 * .92, L * .44, -W / 2, L * (.5 - bow)); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: H, bevelEnabled: false, curveSegments: 5 });
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < H * .01) p.setX(i, p.getX(i) * vee);
  g.computeVertexNormals(); return g;
}

export function buildBay(scene, renderer) {
  const rnd = rng(23), R = (a, b) => a + (b - a) * rnd(), pick = a => a[Math.floor(rnd() * a.length)];
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .8, flatShading: true, ...o });
  const add = (geo, mat, x, y, z, o = {}) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
    m.castShadow = !!o.cast; m.receiveShadow = o.recv !== false; (o.parent || scene).add(m); return m;
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

  // ---------- niebo, mgła, otoczenie (odbicia nieba w szkle i na fasolce) ----------
  const HORIZON = new THREE.Color(0xf6a585);   // pomarańczowo-różowa mgiełka zachodu
  scene.fog = new THREE.FogExp2(HORIZON, FOG);
  const skyU = {
    uTop: { value: new THREE.Color(0x221650) }, uMid: { value: new THREE.Color(0xc24a86) }, uBot: { value: HORIZON },
    uWarm: { value: new THREE.Color(2.2, 1.05, .35) }, uSun: { value: SUN_DIR },
  };
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `${SKY_GLSL} varying vec3 vP;
      void main(){gl_FragColor=vec4(skyCol(normalize(vP)),1.);
      #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(6500, 32, 16), skyMat);
  sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky);
  {
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyMat));
    const sunBall = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(14, 7.5, 3) }));
    sunBall.position.copy(SUN_DIR).multiplyScalar(40); env.add(sunBall);
    const sea = new THREE.Mesh(new THREE.CircleGeometry(48, 24), new THREE.MeshBasicMaterial({ color: 0x3a3f72 })); sea.rotation.x = -Math.PI / 2; sea.position.y = -6; env.add(sea);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, .02, .1, 100).texture; scene.environmentIntensity = .5; pm.dispose();
  }

  // światło: ciepłe słońce z cieniem przy fasolce, niebieskawe niebo i odbite od wody turkusowe światło z dołu
  scene.add(new THREE.HemisphereLight(0xff9fc0, 0x4a3a72, .55));
  const fill = new THREE.DirectionalLight(0xd6b8ff, .7); fill.position.set(2, 3, 10); scene.add(fill);   // chłodne fioletowe światło od strony kamery: twarz fasolki pod słońce
  const sun = new THREE.DirectionalLight(0xff9a55, 3.4);
  sun.target.position.set(0, 0, -2); sun.position.copy(SUN_DIR).multiplyScalar(30).add(sun.target.position); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 70 });
  scene.add(sun, sun.target);

  // ---------- estakada: asfalt, pasy, bariera z poręczą, latarnia ----------
  const RZ0 = BZ - .45, RZ1 = 30, RD = RZ1 - RZ0;
  const asphalt = canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#55595f'; x.fillRect(0, 0, w, h); const r = rng(5);
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(${r() < .5 ? '34,36,40' : '128,130,134'},${.05 + r() * .07})`; x.beginPath(); x.ellipse(r() * w, r() * h, 20 + r() * 80, 8 + r() * 30, r() * 3, 0, 7); x.fill(); }
    for (let i = 0; i < 7000; i++) { const v = r(); x.fillStyle = v < .55 ? `rgba(28,30,34,${.25 + r() * .4})` : `rgba(170,170,172,${.15 + r() * .35})`; x.fillRect(r() * w, r() * h, 1 + r() * 2.5, 1 + r() * 2.5); }
  }, [ROAD_L / 6, RD / 6]);
  add(new THREE.PlaneGeometry(ROAD_L, RD), new THREE.MeshStandardMaterial({ map: asphalt, roughness: .9 }), 0, 0, (RZ0 + RZ1) / 2, { rx: -Math.PI / 2 });
  add(box(ROAD_L, 2.2, RD), std(0xc2bcb0), 0, -1.11, (RZ0 + RZ1) / 2, { recv: false });
  const trackM = new THREE.MeshBasicMaterial({ color: 0x1c1e22, transparent: true, opacity: .14, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  for (const z of [-3.85, -2.15, -.35, 1.35]) add(new THREE.PlaneGeometry(ROAD_L, .55), trackM, 0, .003, z, { rx: -Math.PI / 2 });
  const paintM = new THREE.MeshStandardMaterial({ color: 0xf4f2ea, roughness: .55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  add(new THREE.PlaneGeometry(ROAD_L, .16), paintM, 0, .006, BZ + .55, { rx: -Math.PI / 2 });
  const dashes = [];
  for (const z of [-1.25, 2.35]) for (let x = -150; x <= 150; x += 9) { const g = new THREE.PlaneGeometry(3, .14); g.rotateX(-Math.PI / 2); g.translate(x - 2 + (z > 0 ? 4.5 : 0), .006, z); dashes.push(g); }
  add(mergeGeometries(dashes), paintM, 0, 0, 0);
  {
    const s = new THREE.Shape([[-.3, 0], [.3, 0], [.25, .07], [.13, .19], [.1, .3], [-.1, .3], [-.13, .19], [-.25, .07]].map(([a, b]) => new THREE.Vector2(a, b)));
    const g = new THREE.ExtrudeGeometry(s, { depth: ROAD_L, bevelEnabled: false }); g.rotateY(Math.PI / 2); g.translate(-ROAD_L / 2, 0, BZ);
    add(g, std(0xe2ddd2, { roughness: .9 }), 0, 0, 0, { cast: true });
    const metal = new THREE.MeshStandardMaterial({ color: 0xdde3e8, roughness: .28, metalness: .7 });
    const posts = [];
    for (let x = -60; x <= 60; x += 2) { const p = box(.07, .8, .07); p.translate(x, .3 + .4, BZ); posts.push(p); }
    add(mergeGeometries(posts), metal, 0, 0, 0, { cast: true });
    for (const [y, r] of [[1.1, .042], [.72, .028]]) add(new THREE.CylinderGeometry(r, r, 120, 8), metal, 0, y, BZ, { rz: Math.PI / 2, cast: true });
    const refl = new THREE.MeshStandardMaterial({ color: 0xffc629, emissive: 0x8a5d00, roughness: .4 });
    for (let x = -60; x <= 60; x += 6) add(box(.16, .08, .02), refl, x + 1, .21, BZ + .2, { rx: -.35 });
    const pole = new THREE.MeshStandardMaterial({ color: 0xc9cfd5, roughness: .35, metalness: .7 });
    for (const x of [-7.4, 30]) {
      add(new THREE.CylinderGeometry(.11, .18, 10.6, 10), pole, x, 5.6, BZ, { cast: true });
      add(box(.26, .55, .26), pole, x, .55, BZ);
      add(new THREE.CylinderGeometry(.07, .08, 2.9, 8), pole, x, 10.65, BZ + 1.35, { rx: Math.PI / 2 - .12, cast: true });
      add(box(.42, .16, .95), std(0x9aa2ab, { roughness: .5 }), x, 10.78, BZ + 2.75, { cast: true });
    }
  }

  // ---------- woda ----------
  const ISLANDS = [
    { x: -78, z: -330, r: 56, w: .5 }, { x: 98, z: -470, r: 30, w: .62 }, { x: -255, z: -640, r: 74, w: .5 },
    { x: 235, z: -820, r: 42, w: .6 }, { x: 22, z: -980, r: 38, w: .6 }, { x: -150, z: -1120, r: 48, w: .55 }, { x: 430, z: -560, r: 36, w: .6 },
  ];
  const waterU = {
    uT: { value: 0 }, uSun: { value: SUN_DIR }, uFog: { value: HORIZON }, uFogD: { value: FOG },
    uDeep: { value: new THREE.Color(0x1c2f62) }, uMid: { value: new THREE.Color(0x2a6f96) }, uShal: { value: new THREE.Color(0x4fb8b8) }, uSand: { value: new THREE.Color(0xd8b8a0) },
    uSkyH: { value: new THREE.Color(0xffa27a) }, uSkyT: { value: new THREE.Color(0x8a3f86) },
    uIsl: { value: ISLANDS.map(I => new THREE.Vector4(I.x, I.z, I.r, I.w)) },
  };
  const NI = ISLANDS.length;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(9000, 5200), new THREE.ShaderMaterial({
    uniforms: waterU, fog: false,
    vertexShader: 'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: `uniform float uT,uFogD;uniform vec3 uSun,uFog,uDeep,uMid,uShal,uSand,uSkyH,uSkyT;uniform vec4 uIsl[${NI}];varying vec3 vW;
      float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
      // fale: kilka sinusoid w różnych kierunkach (gradient liczony dokładnie) i drobna zmarszczka z szumu
      vec2 waves(vec2 p){
        vec2 g=vec2(0.);
        vec2 D[6];D[0]=vec2(.8,.6);D[1]=vec2(-.5,.86);D[2]=vec2(.96,-.28);D[3]=vec2(-.2,-.98);D[4]=vec2(.6,.8);D[5]=vec2(-.9,.43);
        float L[6];L[0]=34.;L[1]=21.;L[2]=13.;L[3]=8.5;L[4]=5.3;L[5]=3.4;
        for(int i=0;i<6;i++){float k=6.2832/L[i],a=L[i]*.012,ph=dot(D[i],p)*k+uT*sqrt(9.8*k)*.8;g+=D[i]*a*k*cos(ph);}
        return g;}
      void main(){
        vec3 V=cameraPosition-vW;float d=length(V);V/=d;vec2 p=vW.xz;
        float att=1./(1.+d/320.);
        vec2 g=waves(p)*att;
        float e=.9;vec2 q=p*.9+vec2(uT*.35,uT*.22);
        g+=vec2(vn(q+vec2(e,0.))-vn(q-vec2(e,0.)),vn(q+vec2(0.,e))-vn(q-vec2(0.,e)))*.35*att*att;
        vec3 N=normalize(vec3(-g.x,1.,-g.y));
        float sh=0.,beach=0.,foam=0.;
        for(int i=0;i<${NI};i++){vec4 s=uIsl[i];vec2 o=(p-s.xy)/vec2(s.z,s.z*s.w);float r=length(o)+(vn(p*.06+float(i)*7.)-.5)*.18;
          sh=max(sh,smoothstep(2.6,1.2,r));beach=max(beach,smoothstep(1.55,1.25,r));
          foam=max(foam,smoothstep(1.4,1.3,r)*step(1.26,r)*(.5+.5*vn(p*.5+uT*.5)));}
        // mielizny i głębsze rynny (duży szum), dalej coraz głębszy błękit
        float bar=smoothstep(.58,.82,vn(p*.0035+3.)*.7+vn(p*.011)*.3);
        vec3 base=mix(uMid,uDeep,smoothstep(380.,1700.,d));
        base=mix(base,uShal,bar*.45*(1.-smoothstep(500.,1500.,d)));
        base=mix(base,uShal,sh);base=mix(base,uSand,beach*.8);
        // światło na falach, kaustyki na płyciznach, cienie chmur sunące po wodzie
        float sl=clamp(dot(N,uSun),0.,1.);
        base*=.72+.42*sl;
        float ca=vn(p*.32+uT*.25)*vn(p*.47-uT*.2);
        base+=vec3(.75,1.,.95)*smoothstep(.3,.55,ca)*(sh*.8+bar*.25)*.12*att;
        float cs=smoothstep(.5,.72,vn(p*.0021+vec2(uT*.006,uT*.002))*.75+vn(p*.006)*.25);
        base*=1.-.28*cs;
        float F=.02+.98*pow(1.-max(dot(N,V),0.),5.);
        vec3 Rf=reflect(-V,N);
        vec3 col=mix(base,mix(uSkyH,uSkyT,smoothstep(0.,.45,Rf.y))*(1.-.2*cs),F*.42*(1.-sh*.6));
        float sp=vn(p*1.9+vec2(uT*.8,-uT*.45))*vn(p*1.05-vec2(uT*.3,uT*.55));
        col+=vec3(1.,.62,.32)*smoothstep(.64,.82,sp)*att*1.4*(.4+.6*sl);
        col=mix(col,vec3(.97,1.,1.),foam*.9);
        float f=1.-exp(-pow(d*uFogD,2.));
        gl_FragColor=vec4(mix(col,uFog,f),1.);
        #include <colorspace_fragment>
      }`,
  }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, WY, -2580); scene.add(water);

  // ---------- roślinność (instancje) ----------
  const vegMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .85, side: THREE.DoubleSide });
  const PALMS = [palmGeo(11, 1.5, 3), palmGeo(13, -2.0, 7), palmGeo(9.5, .9, 11), palmGeo(12, 2.4, 19)];
  const BUSHES = [bushGeo(5, 0x3f9a3d), bushGeo(9, 0x2c7d35), bushGeo(13, 0x63b84a), bushGeo(17, 0x4ea84a)];
  const palmList = PALMS.map(() => []), bushList = BUSHES.map(() => []);
  const palm = (x, y, z, s) => palmList[Math.floor(rnd() * PALMS.length)].push({ x, y, z, s, ry: rnd() * 6.28 });
  const bush = (x, y, z, s) => bushList[Math.floor(rnd() * BUSHES.length)].push({ x, y, z, s, ry: rnd() * 6.28 });

  // ---------- wyspy ----------
  const sandM = std(0xf3e2b3), grassM = std(0x5aad48), wobble = (x, z, seed) => { const a = Math.atan2(z, x); return 1 + .11 * Math.sin(a * 3 + seed) + .06 * Math.sin(a * 7 + seed * .7); };
  const blobXZ = (g, r, w, seed) => { const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), f = wobble(x, z, seed); p.setXYZ(i, x * f * r, p.getY(i), z * f * r * w); }
    g.computeVertexNormals(); return g; };
  ISLANDS.forEach((I, n) => {
    const seed = n * 1.7 + 2;
    add(blobXZ(new THREE.CylinderGeometry(1, 1.32, 2.2, 30), I.r, I.w, seed), sandM, I.x, WY - .1, I.z);
    add(blobXZ(new THREE.CylinderGeometry(.74, .9, 1.4, 26), I.r, I.w, seed), grassM, I.x, WY + 1.2, I.z);
    const inside = k => { const a = R(0, 6.283), d = Math.sqrt(rnd()) * k, f = wobble(Math.cos(a), Math.sin(a), seed); return [I.x + Math.cos(a) * d * I.r * f, I.z + Math.sin(a) * d * I.r * I.w * f]; };
    for (let k = 0; k < I.r * .9; k++) { const [x, z] = inside(.66); bush(x, WY + 1.9, z, R(2, 4.5)); }
    for (let k = 0; k < I.r * .75; k++) { const [x, z] = inside(.72); palm(x, WY + 1.7, z, R(1.1, 1.55)); }
  });
  const white = std(0xfdfdf9, { roughness: .6, flatShading: false }), glassDark = new THREE.MeshStandardMaterial({ color: 0x5f8fb3, roughness: .08, metalness: .85 });
  {   // willa na pierwszej wyspie: dwa białe piętra, szklane pasy, taras z basenem, pomost w stronę estakady
    const I = ISLANDS[0], vx = I.x + 10, vz = I.z + 2, base = WY + 1.9;
    add(box(26, 4.2, 13), white, vx, base + 2.1, vz);
    add(box(25.2, 3.2, 13.6), glassDark, vx, base + 2, vz);
    add(box(16, 3.8, 10), white, vx - 4, base + 6.1, vz - 1);
    add(box(15.4, 2.8, 10.5), glassDark, vx - 4, base + 6, vz - 1);
    add(box(28, .45, 15), white, vx, base + 4.4, vz);
    add(box(17.5, .4, 11.6), white, vx - 4, base + 8.2, vz - 1);
    add(box(12, .3, 6), std(0x39d8ea, { roughness: .05, metalness: .1, flatShading: false }), vx + 3, base + .2, vz + 11);
    add(box(16, .25, 10), std(0xeadcbd), vx + 3, base + .05, vz + 11);
    const wood = std(0xa07a4c), dz0 = I.z + I.r * I.w * .92;
    add(box(3.2, .4, 34), wood, I.x - 14, WY + 1.1, dz0 + 15);
    add(box(14, .4, 3.2), wood, I.x - 14, WY + 1.1, dz0 + 30);
    for (let k = 0; k < 9; k++) for (const s of [-1, 1]) add(new THREE.CylinderGeometry(.2, .2, 3, 6), wood, I.x - 14 + s * 1.5, WY + .3, dz0 + 1 + k * 4);
  }

  // ---------- drugi brzeg: kilka planów zabudowy ----------
  const TILE_W = 14, TILE_H = 27.2;   // kafel tekstury: 4 przęsła po 3,5 m, 8 pięter po 3,4 m
  const texGlass = canvasTex(512, 512, (x, w, h) => {
    const r = rng(17);
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f2f8fc'); g.addColorStop(1, '#bcd2e2'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let fy = 0; fy < 8; fy++) for (let bx = 0; bx < 16; bx++) { const v = r(); x.fillStyle = v < .28 ? 'rgba(40,70,100,.22)' : v > .82 ? 'rgba(255,255,255,.45)' : 'rgba(120,150,175,.08)'; x.fillRect(bx * 32, fy * 64, 32, 64); }
    for (let y = 0; y < h; y += 64) { x.fillStyle = 'rgba(55,78,100,.7)'; x.fillRect(0, y + 52, w, 12); x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(0, y + 51, w, 1); }
    x.fillStyle = 'rgba(235,244,250,.75)'; for (let i = 0; i < w; i += 32) x.fillRect(i, 0, 2, h);
  });
  const texCondo = canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#f6f5f1'; x.fillRect(0, 0, w, h); const r = rng(29);
    for (let y = 0; y < h; y += 64) {
      for (let i = 0; i < w; i += 64) { const v = r(); x.fillStyle = v < .2 ? '#3d5f7e' : v < .6 ? '#4f7596' : '#6a90ad'; x.fillRect(i + 4, y + 18, 56, 36); }
      x.fillStyle = 'rgba(255,255,255,.28)'; x.fillRect(0, y + 18, w, 8);
      x.fillStyle = 'rgba(30,40,50,.45)'; x.fillRect(0, y + 54, w, 4);          // cień pod płytą balkonu
      x.fillStyle = '#ffffff'; x.fillRect(0, y + 58, w, 6);
      x.fillStyle = 'rgba(200,210,218,.9)'; for (let i = 0; i < w; i += 8) x.fillRect(i, y + 40, 2, 14);   // balustrady
      x.fillStyle = 'rgba(210,214,218,.9)'; x.fillRect(0, y + 40, w, 2);
    }
  });
  const texOffice = canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#efe7d8'; x.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 64) for (let i = 0; i < w; i += 32) { x.fillStyle = '#4e6680'; x.fillRect(i + 6, y + 14, 20, 40); x.fillStyle = 'rgba(255,255,255,.3)'; x.fillRect(i + 6, y + 14, 20, 7); x.fillStyle = 'rgba(80,70,60,.25)'; x.fillRect(i + 6, y + 54, 20, 3); }
  });
  const ROOF_V = 1 - 8 / 512;   // punkt gładkiej ściany w teksturach (dachy)
  const bins = new Map();
  const binFor = (tex, color) => {
    const k = (tex ? tex.uuid : 'plain') + ':' + color;
    if (!bins.has(k)) {
      const glass = tex === texGlass;
      bins.set(k, { mat: new THREE.MeshStandardMaterial({ map: tex || null, color, vertexColors: true, roughness: glass ? .1 : tex ? .72 : .6, metalness: glass ? .62 : 0, envMapIntensity: glass ? 1.2 : .5 }), geos: [] });
    }
    return bins.get(k).geos;
  };
  // ciemniejszy dół budynku (cień od sąsiednich, miękkie AO), jaśniejsza góra
  const shadeY = (g, h, lo = .58) => { const p = g.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const k = Math.min(1, Math.max(0, (p.getY(i) + h / 2) / h)), v = lo + (1 - lo) * Math.pow(k, .55); c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = v; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; };
  const boxUV = (w, h, d, u0) => {
    const g = box(w, h, d), uv = g.attributes.uv;
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      if (f === 2 || f === 3) { uv.setXY(i, .5, ROOF_V); continue; }
      const fw = f < 2 ? d : w; uv.setXY(i, u0 + uv.getX(i) * fw / TILE_W, uv.getY(i) * h / TILE_H);
    }
    return shadeY(g, h);
  };
  const cylUV = (r, h, u0, seg) => {
    const g = new THREE.CylinderGeometry(r, r, h, seg), uv = g.attributes.uv, nr = g.attributes.normal;
    for (let i = 0; i < uv.count; i++) {
      if (Math.abs(nr.getY(i)) > .5) uv.setXY(i, .5, ROOF_V);
      else uv.setXY(i, u0 + uv.getX(i) * 2 * Math.PI * r / TILE_W, uv.getY(i) * h / TILE_H);
    }
    if (seg === 8) g.rotateY(Math.PI / 8);
    return shadeY(g, h);
  };
  const plainG = (g, h) => shadeY(g, h, .8);
  const place = (g, x, y, z, ry) => { if (ry) g.rotateY(ry); return g.translate(x, y, z); };
  const GROUND = WY + 2.6;
  const GLASS = [0x8cc6e8, 0x72d0d2, 0xa8c8ea, 0x6aa0dc, 0xb2dfe8, 0x84b8d8], CONDO = [0xffffff, 0xfaf6ec, 0xeaf4f6], OFFICE = [0xf3e5cb, 0xeadcc4];
  const PASTEL = [0xf9c2cc, 0xb8ecdc, 0xfce4a0, 0xf8f3ea, 0xc4dbf5, 0xfbcfae, 0xe0c8f0];
  const ROOF = 0xe4e9ed;
  function tower(x, z, w, d, h, kind, o = {}) {
    const tex = kind === 'glass' ? texGlass : kind === 'condo' ? texCondo : texOffice;
    const col = o.col || (kind === 'glass' ? pick(GLASS) : kind === 'condo' ? pick(CONDO) : pick(OFFICE));
    const geos = binFor(tex, col), u0 = rnd(), ry = o.ry ?? (rnd() < .35 ? R(-.35, .35) : 0), roof = binFor(null, ROOF);
    const shape = o.shape || (kind === 'glass' ? (rnd() < .18 ? 'cyl' : rnd() < .2 ? 'oct' : rnd() < .35 ? 'step' : 'box') : rnd() < .3 ? 'step' : 'box');
    let topY = GROUND + h, topW = w, topD = d;
    if (shape === 'cyl' || shape === 'oct') {
      const r = Math.min(w, d) / 2, seg = shape === 'oct' ? 8 : 20;
      geos.push(place(cylUV(r, h, u0, seg), x, GROUND + h / 2, z, ry));
      roof.push(place(plainG(new THREE.CylinderGeometry(r * 1.03, r * 1.03, 1.6, seg), 1.6), x, topY + .4, z, ry));
      topW = topD = r * 1.2;
    } else if (shape === 'step') {
      const h1 = h * R(.55, .72), h2 = h - h1, s1 = R(.66, .8);
      geos.push(place(boxUV(w, h1, d, u0), x, GROUND + h1 / 2, z, ry));
      roof.push(place(plainG(box(w * 1.02, 1.4, d * 1.02), 1.4), x, GROUND + h1 - .3, z, ry));
      geos.push(place(boxUV(w * s1, h2 + 1, d * s1, u0), x, GROUND + h1 + h2 / 2 - .5, z, ry));
      topW = w * s1; topD = d * s1;
    } else geos.push(place(boxUV(w, h, d, u0), x, GROUND + h / 2, z, ry));
    // korona: maszynownia, piramidka, iglica albo lądowisko
    const c = o.crown || (rnd() < .22 ? 'spire' : rnd() < .2 ? 'pyr' : rnd() < .25 ? 'heli' : 'pent');
    if (c === 'pyr') roof.push(place(plainG(new THREE.ConeGeometry(Math.min(topW, topD) * .62, h * .09, 4), h * .09).rotateY(Math.PI / 4), x, topY + h * .045, z, ry));
    else {
      roof.push(place(plainG(box(topW * .62, 4, topD * .62), 4), x, topY + 2, z, ry));
      if (c === 'spire') roof.push(place(plainG(new THREE.CylinderGeometry(.35, 1.1, h * .16, 6), h * .16), x, topY + 4 + h * .08, z, 0));
      if (c === 'heli') binFor(null, 0xd2463c).push(place(plainG(new THREE.CylinderGeometry(topW * .32, topW * .32, .4, 16), .4), x, topY + 4.2, z, 0));
    }
  }
  // ląd: główny brzeg, wysunięcie po lewej i półwysep po prawej
  const landM = std(0xdacfb2, { flatShading: false }), beachM = std(0xf4e4b8, { flatShading: false }), parkM = std(0x6cb850, { flatShading: false }), wallM = std(0xd4ccb8);
  const SHORE = [[-2600, 2600, -3200, -1300], [-2600, -560, -1300, -1180], [380, 2600, -1300, -930]];
  for (const [x0, x1, z0, z1] of SHORE) {
    add(box(x1 - x0, 4, z1 - z0), landM, (x0 + x1) / 2, WY + .6, (z0 + z1) / 2);
    add(box(x1 - x0, 1.4, 16), beachM, (x0 + x1) / 2, WY + .3, z1 + 6);
    add(box(x1 - x0, .5, 22), parkM, (x0 + x1) / 2, GROUND + .05, z1 - 12);
    add(box(x1 - x0, 2, 2.5), wallM, (x0 + x1) / 2, WY + 1.6, z1 - .5);
    for (let x = x0 + R(4, 12); x < x1; x += R(7, 14)) if (Math.abs(x) < 1300) palm(x, GROUND, z1 - R(3, 18), R(1.35, 1.8));
  }
  // pastelowe kamienice art déco przy plaży
  const lowRise = (x0, x1, zf, zr = [26, 42]) => { for (let x = x0; x < x1;) { const w = R(18, 44); if (rnd() < .86) {
    const h = R(10, 28), d = R(16, 28), cx = x + w / 2, cz = zf - d / 2 - R(...zr), col = pick(PASTEL);
    binFor(texCondo, col).push(place(boxUV(w, h, d, rnd()), cx, GROUND + h / 2, cz));
    binFor(null, 0xffffff).push(place(plainG(box(w + .8, 1, d + .8), 1), cx, GROUND + h + .2, cz));
    if (rnd() < .4) binFor(null, col).push(place(plainG(box(w * .28, 7, d * .5), 7), cx + R(-w / 4, w / 4), GROUND + h + 3.5, cz));
  } x += w + R(3, 10); } };
  lowRise(-1400, 1400, -1300); lowRise(-1800, -580, -1180); lowRise(380, 900, -930);
  // śródmieście: cztery rzędy, najgęściej i najwyżej w środku i trochę na prawo, drugie skupisko po lewej
  const bell = x => Math.exp(-(((x - 120) / 430) ** 2)) * .9 + Math.exp(-(((x + 640) / 230) ** 2)) * .55;
  const rows = [[-1395, 60, 28, 100, .25], [-1470, 52, 45, 180, .2], [-1570, 46, 60, 240, .18], [-1690, 58, 55, 200, .25]];
  rows.forEach(([z, step, hMin, hMax, skip]) => {
    for (let x = -1350 + R(0, step); x < 1350; x += step * R(.7, 1.35)) {
      const k = bell(x);
      if (rnd() < skip + (1 - k) * .3) continue;
      const h = hMin * R(.7, 1.1) + (hMax - hMin) * k * R(.35, 1.05);
      const kind = rnd() < .5 ? 'glass' : rnd() < .7 ? 'condo' : 'office';
      tower(x + R(-8, 8), z + R(-16, 16), R(20, 38), R(20, 34), Math.max(24, h), kind);
    }
  });
  tower(170, -1585, 36, 36, 255, 'glass', { col: 0x7fc8e6, crown: 'spire', shape: 'step', ry: .1 });   // znaki rozpoznawcze miasta
  tower(-70, -1520, 34, 34, 220, 'glass', { col: 0x76d6d4, shape: 'cyl', crown: 'pent' });
  tower(390, -1500, 40, 30, 205, 'condo', { shape: 'step', crown: 'pyr', ry: -.2 });
  tower(-260, -1600, 30, 30, 200, 'glass', { col: 0x6aa0dc, shape: 'oct', crown: 'spire' });
  // apartamentowce na półwyspie po prawej (bliżej wody, jak na zdjęciu)
  for (let k = 0; k < 9; k++) tower(410 + k * 40 + R(-6, 6), -965 - R(0, 70), R(20, 28), R(18, 26), R(48, 135), rnd() < .65 ? 'condo' : 'glass');
  // dalekie miasto we mgle (czwarty plan)
  for (let x = -2400; x < 2400; x += R(40, 90)) { const h = R(30, 150) * (.6 + bell(x * .6)); binFor(null, 0xbfd0dc).push(place(plainG(box(R(30, 60), h, R(30, 60)), h), x, GROUND + h / 2, R(-2300, -2700))); }
  // marina przy brzegu: pomosty i jachty
  { const wood = binFor(null, 0xd8d2c4), boatsW = binFor(null, 0xffffff);
    for (let k = 0; k < 6; k++) { const px = 90 + k * 36; wood.push(place(plainG(box(3, .5, 70), .5), px, WY + 1.2, -1262));
      for (let j = 0; j < 7; j++) for (const s of [-1, 1]) if (rnd() < .8) boatsW.push(place(plainG(box(4.5, 2.2, R(10, 16)), 2.2), px + s * 6, WY + 1.1, -1235 - j * 9)); } }
  // grobla z autami: od lewej strony kadru do brzegu
  const CA = [-560, -760], CB = [-330, -1300], cdx = CB[0] - CA[0], cdz = CB[1] - CA[1], CL = Math.hypot(cdx, cdz), cyaw = Math.atan2(-cdx, -cdz);
  {
    const deck = binFor(null, 0xe7e2d6), cx = (CA[0] + CB[0]) / 2, cz = (CA[1] + CB[1]) / 2;
    deck.push(place(plainG(box(16, 2.2, CL), 2.2), 0, 0, 0, cyaw).translate(cx, WY + 9, cz));
    for (const s of [-1, 1]) deck.push(place(plainG(box(.5, 1.2, CL), 1.2), s * 7.8, 0, 0, 0).rotateY(cyaw).translate(cx, WY + 10.7, cz));
    for (let u = 0; u <= 1; u += 40 / CL) deck.push(place(plainG(box(10, 8.5, 3.5), 8.5), 0, 0, 0, cyaw).translate(CA[0] + cdx * u, WY + 3.8, CA[1] + cdz * u));
  }
  for (const m of bins.values()) add(mergeGeometries(m.geos), m.mat, 0, 0, 0, { recv: false });
  const cars = [], carCols = [0xe2343c, 0xffffff, 0x1e7fd6, 0x222831, 0xffc629, 0x7a8590, 0x10a39c, 0xf05aa6];
  for (let i = 0; i < 18; i++) { const m = add(box(2, 1.5, 4.6), std(pick(carCols), { roughness: .3, metalness: .4 }), 0, 0, 0, { recv: false }); m.rotation.y = cyaw; cars.push({ m, u: rnd(), lane: i % 2 ? 1 : -1, v: R(18, 26) / CL }); }

  // instancje roślin
  const dummy = new THREE.Object3D(), tint = new THREE.Color();
  const instance = (geos, lists) => lists.forEach((L, i) => { if (!L.length) return;
    const m = new THREE.InstancedMesh(geos[i], vegMat, L.length);
    L.forEach((p, j) => { dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(0, p.ry, 0); dummy.scale.set(p.s, p.s * R(.9, 1.12), p.s); dummy.updateMatrix();
      m.setMatrixAt(j, dummy.matrix); m.setColorAt(j, tint.setRGB(R(.86, 1.06), R(.9, 1.08), R(.84, 1.02))); });
    m.receiveShadow = false; scene.add(m); });
  instance(PALMS, palmList); instance(BUSHES, bushList);

  // ---------- łodzie z kilwaterem ----------
  const wakeMat = new THREE.ShaderMaterial({
    uniforms: { uFog: { value: HORIZON }, uFogD: { value: FOG } }, transparent: true, depthWrite: false, fog: false,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    vertexShader: 'attribute float aA,aU;varying float vA,vU;varying vec3 vW;void main(){vA=aA;vU=aU;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: `uniform vec3 uFog;uniform float uFogD;varying float vA,vU;varying vec3 vW;
      float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
      void main(){float e=abs(vU*2.-1.);float n=vn(vW.xz*.45);
        float rim=smoothstep(.55,.95,e)*(1.-smoothstep(.97,1.,e));
        float a=vA*(rim*.95+(1.-e)*.55*vA)*(.55+.6*n);
        float d=length(vW-cameraPosition),f=1.-exp(-pow(d*uFogD,2.));
        gl_FragColor=vec4(mix(vec3(1.),uFog,f*.7),clamp(a,0.,1.)*(1.-f*.4));
        #include <colorspace_fragment>
      }`,
  });
  function makeWake(w0, w1, life, step) {
    const N = 80, pos = new Float32Array((N + 1) * 6), aA = new Float32Array((N + 1) * 2), aU = new Float32Array((N + 1) * 2), idx = [];
    for (let i = 0; i <= N; i++) { aU[i * 2] = 0; aU[i * 2 + 1] = 1; }
    for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aA', new THREE.BufferAttribute(aA, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aU', new THREE.BufferAttribute(aU, 1)); geo.setIndex(idx); geo.setDrawRange(0, 0);
    const mesh = new THREE.Mesh(geo, wakeMat); mesh.frustumCulled = false; scene.add(mesh);
    const pts = [];
    return (t, x, z) => {
      if (pts.length && Math.hypot(x - pts[0].x, z - pts[0].z) > 120) pts.length = 0;
      if (!pts.length || Math.hypot(x - pts[0].x, z - pts[0].z) > step) pts.unshift({ x, z, t });
      while (pts.length > N || (pts.length && t - pts[pts.length - 1].t > life)) pts.pop();
      const list = [{ x, z, t }, ...pts];
      let dx = 0, dz = 1;
      for (let i = 0; i < list.length; i++) {
        const a = list[i], b = list[Math.min(i + 1, list.length - 1)], ex = a.x - b.x, ez = a.z - b.z, l = Math.hypot(ex, ez);
        if (l > .01) { dx = ex / l; dz = ez / l; }
        const age = Math.min(1, (t - a.t) / life), wd = (w0 + (w1 - w0) * Math.sqrt(age)) / 2;
        pos.set([a.x - dz * wd, WY + .12, a.z + dx * wd, a.x + dz * wd, WY + .12, a.z - dx * wd], i * 6);
        aA[i * 2] = aA[i * 2 + 1] = Math.pow(1 - age, 1.3) * Math.min(1, i * .5 + .5);
      }
      geo.attributes.position.needsUpdate = geo.attributes.aA.needsUpdate = true;
      geo.setDrawRange(0, Math.max(0, list.length - 1) * 6);
    };
  }
  const hullW = std(0xffffff, { roughness: .35, flatShading: false }), dark = new THREE.MeshStandardMaterial({ color: 0x1b2836, roughness: .08, metalness: .6 }), grey = std(0x9aa3ad, { roughness: .4 });
  function speedboat(stripe) {
    const g = new THREE.Group(), L = 11, W = 3.2;
    add(hullGeo(L, W, 1.2), hullW, 0, 0, 0, { parent: g });
    add(hullGeo(L * 1.01, W * 1.03, .28, .34, 1), std(stripe, { roughness: .3 }), 0, .65, 0, { parent: g });
    add(box(W * .8, .6, .3), dark, 0, 1.5, -.6, { parent: g, rx: -.55 });
    add(box(W * .72, .45, 2.8), std(0xece4d4), 0, 1.4, 2, { parent: g });
    add(box(.7, 1.1, .6), std(0x1a1d22), 0, 1.1, L / 2 + .2, { parent: g });
    return { g, L };
  }
  function jetski(col, bean) {
    const g = new THREE.Group(), L = 3.4;
    add(hullGeo(L, 1.25, .6, .4, .7), std(col, { roughness: .35 }), 0, 0, 0, { parent: g });
    add(box(.55, .28, 1.4), std(0x22262c), 0, .72, .3, { parent: g });
    add(new THREE.CapsuleGeometry(.34, .6, 4, 10), std(bean, { flatShading: false, roughness: .45 }), 0, 1.5, .25, { parent: g, rx: -.25 });   // fasolka za sterem
    return { g, L };
  }
  function yacht() {
    const g = new THREE.Group(), L = 46, W = 9;
    add(hullGeo(L, W, 3.2, .36, .5), hullW, 0, 0, 0, { parent: g });
    add(hullGeo(L * 1.004, W * 1.02, .6, .36, 1), dark, 0, 1.4, 0, { parent: g });
    add(hullGeo(L * .66, W * .86, 2.6, .4, 1), hullW, 0, 3.2, 2.5, { parent: g });
    add(hullGeo(L * .64, W * .885, 1.1, .4, 1), dark, 0, 4, 2.5, { parent: g });
    add(hullGeo(L * .42, W * .7, 2.3, .42, 1), hullW, 0, 5.8, 4.5, { parent: g });
    add(hullGeo(L * .4, W * .72, .9, .42, 1), dark, 0, 6.5, 4.5, { parent: g });
    add(box(W * .5, .3, 6), hullW, 0, 8.25, 6, { parent: g });
    add(new THREE.CylinderGeometry(.14, .14, 3.4, 6), grey, 0, 9.9, 7, { parent: g });
    add(box(4, .1, 3), std(0x45d9e6, { roughness: .1 }), 0, 3.25, 17, { parent: g });   // jacuzzi na rufie
    return { g, L };
  }
  function sailboat() {
    const g = new THREE.Group(), L = 13;
    add(hullGeo(L, 3.8, 1.4, .38, .5), hullW, 0, 0, 0, { parent: g });
    add(box(2, .9, 4), std(0xf1ede3), 0, 1.8, 1, { parent: g });
    add(new THREE.CylinderGeometry(.1, .12, 17, 6), grey, 0, 9.4, -.7, { parent: g });
    const sail = new THREE.BufferGeometry(); sail.setAttribute('position', new THREE.Float32BufferAttribute([0, 2, -.5, 0, 17.6, -.7, 0, 2, 5.4, 0, 14.6, -1, 0, 1.8, -6, 0, 2.2, -1], 3)); sail.computeVertexNormals();
    add(sail, std(0xfdfcf6, { side: THREE.DoubleSide, flatShading: false }), 0, 0, 0, { parent: g });
    return { g, L };
  }
  const boats = [];
  const fleet = (b, path, wake, ph = 0) => { b.g.rotation.order = 'YXZ'; scene.add(b.g); boats.push({ ...b, path, wake, ph }); };
  const wrap = (a, b, v, off) => t => { const D = Math.hypot(b[0] - a[0], b[1] - a[1]), u = ((t * v + off) % D) / D; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; };
  const loop = (cx, cz, rx, rz, v, dir = 1, off = 0) => t => { const a = dir * t * v / ((rx + rz) / 2) + off; return [cx + Math.cos(a) * rx, cz + Math.sin(a) * rz]; };
  const eight = (cx, cz, rx, rz, v, off = 0) => t => { const a = t * v / ((rx + rz) / 1.4) + off; return [cx + Math.sin(a) * rx, cz + Math.sin(a * 2) * rz]; };
  fleet(yacht(), wrap([-460, -575], [420, -575], 4.2, 300), makeWake(10, 52, 34, 4));
  fleet(speedboat(0x1e7fd6), loop(60, -300, 62, 34, 17, 1), makeWake(3, 30, 13, 2));
  fleet(speedboat(0xe2343c), wrap([520, -415], [-520, -415], 19, 260), makeWake(3, 34, 14, 2.2));
  fleet(speedboat(0x111827), loop(-200, -490, 95, 40, 16, -1, 2), makeWake(3, 30, 13, 2.2));
  fleet(speedboat(0x10a39c), wrap([-760, -940], [680, -700], 16, 700), makeWake(3, 30, 14, 2.5));
  fleet(speedboat(0xffffff), loop(185, -660, 74, 30, 18, 1, 4), makeWake(3, 30, 13, 2.2));
  fleet(jetski(0xffc629, 0xff8a3d), eight(-20, -262, 34, 15, 9), makeWake(1.2, 9, 7, 1));
  fleet(jetski(0xe2343c, 0x67c94a), loop(140, -360, 26, 13, 10, -1, 1), makeWake(1.2, 9, 7, 1));
  fleet(jetski(0x1e7fd6, 0xf05aa6), eight(-170, -405, 38, 16, 10, 2), makeWake(1.2, 9, 7, 1));
  fleet(sailboat(), loop(-340, -770, 40, 12, 1.4, 1), null, 1.3);
  fleet(sailboat(), loop(300, -1030, 34, 10, 1.2, -1, 2), null, .4);
  fleet(sailboat(), loop(-40, -1160, 30, 10, 1.1, 1, 4), null, 2.2);
  { const I = ISLANDS[0], dz = I.z + I.r * I.w * .92;
    for (const [dx, oz, ry, c] of [[-18.5, 14, .03, 0xf2f1ea], [-9.5, 22, -.05, 0x1e7fd6]]) { const b = speedboat(c); b.g.position.set(I.x + dx, WY, dz + oz); b.g.rotation.y = ry; scene.add(b.g); boats.push({ ...b, moored: true, ph: oz }); } }

  // ---------- mewy ----------
  const gullMat = new THREE.MeshStandardMaterial({ color: 0xf6f7f8, roughness: 1, side: THREE.DoubleSide });
  const tipMat = new THREE.MeshStandardMaterial({ color: 0x8e98a2, roughness: 1, side: THREE.DoubleSide });
  const wingGeo = new THREE.BufferGeometry(); wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([.24, 0, 0, -.2, 0, 0, -.12, 0, .62, .24, 0, 0, -.12, 0, .62, .05, 0, .55], 3)); wingGeo.computeVertexNormals();
  const tipGeo = new THREE.BufferGeometry(); tipGeo.setAttribute('position', new THREE.Float32BufferAttribute([-.12, 0, .62, .05, 0, .55, -.2, 0, .95], 3)); tipGeo.computeVertexNormals();
  const gullBody = new THREE.CapsuleGeometry(.07, .34, 3, 6); gullBody.rotateZ(Math.PI / 2);
  const gulls = [];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group(), wings = [];
    g.add(new THREE.Mesh(gullBody, gullMat));
    for (const s of [1, -1]) { const w = new THREE.Group(); w.add(new THREE.Mesh(wingGeo, gullMat), new THREE.Mesh(tipGeo, tipMat)); w.scale.z = s; g.add(w); wings.push(w); }
    g.scale.setScalar(R(1.5, 1.9)); g.rotation.order = 'YXZ'; scene.add(g);
    gulls.push({ g, wings, c: [R(-30, 30), R(6, 14), R(-45, -110)], r: R(9, 20), v: R(.22, .36) * (rnd() < .5 ? 1 : -1), ph: R(0, 6.28), f: R(6, 8) });
  }

  // ---------- chmury: wielkie kłęby, jasne od słońca, niebieskawo cieniowane od spodu ----------
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffc8a8, emissive: 0xc0608a, emissiveIntensity: .6, roughness: 1, fog: false, envMapIntensity: .6 });
  const cloudGeo = new THREE.IcosahedronGeometry(1, 3);
  const clouds = [];
  function cloud(x, y, z, size, n) {
    const c = new THREE.Group();
    for (let j = 0; j < n; j++) {
      const t = j / (n - 1) - .5, s = size * (1 - Math.abs(t) * 1.1) * R(.75, 1.2);
      const m = new THREE.Mesh(cloudGeo, cloudMat); m.scale.set(s, s * .85, s * .8);
      m.position.set(t * size * n * .55 + R(-.2, .2) * size, R(.05, .5) * size * (1 - Math.abs(t)), R(-.3, .3) * size); c.add(m);
    }
    for (let j = 0; j < n * .6; j++) {   // mniejsze kłębki na wierzchu
      const s = size * R(.35, .6), m = new THREE.Mesh(cloudGeo, cloudMat); m.scale.set(s, s * .9, s * .8);
      m.position.set(R(-.35, .35) * size * n * .5, size * R(.55, .95), R(-.2, .2) * size); c.add(m);
    }
    const flat = new THREE.Mesh(cloudGeo, cloudMat); flat.scale.set(n * size * .36, size * .22, size * .7); flat.position.y = -size * .15; c.add(flat);
    c.position.set(x, y, z); c.userData.v = R(1.5, 4); scene.add(c); clouds.push(c);
  }
  for (let i = 0; i < 9; i++) cloud(R(-3200, 3200), R(350, 900), R(-3600, -4300), R(110, 190), 5 + Math.floor(R(0, 4)));
  for (let i = 0; i < 6; i++) cloud(R(-2000, 2000), R(520, 900), R(-2700, -3200), R(80, 130), 4 + Math.floor(R(0, 4)));
  cloud(-1500, 760, -3000, 160, 7); cloud(1700, 640, -3300, 170, 6);   // duże kłęby po bokach kadru, jak na zdjęciu

  // ---------- obraz: bloom, ACES, korekcja (nasycenie, ciepło, winieta) ----------
  let composer = null, renderPass = null;
  const size = new THREE.Vector2();
  const GRADE = {
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform sampler2D tDiffuse;varying vec2 vUv;
      void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;float l=dot(c,vec3(.299,.587,.114));
        c=mix(vec3(l),c,1.16);c=(c-.5)*1.05+.5;c*=vec3(1.06,.98,.95);
        float v=smoothstep(1.05,.35,length((vUv-.5)*vec2(1.15,1.)));c*=mix(.8,1.,v);
        gl_FragColor=vec4(clamp(c,0.,1.),1.);}`,
  };
  // bufor half-float: bardzo ostry refleks (np. na fasolce) potrafi dać Inf/NaN, a rozmycie bloomu rozlewa go w migający czarny kwadrat.
  // Ten krok przed bloomem zeruje NaN i przycina zbyt jasne piksele (na ekranie i tak są białe), więc nic się nie rozlewa.
  const SANITIZE = {
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform sampler2D tDiffuse;varying vec2 vUv;
      void main(){vec4 c=texture2D(tDiffuse,vUv);
        if(any(isnan(c))||any(isinf(c))||any(notEqual(c,c)))c=vec4(0.,0.,0.,1.);
        gl_FragColor=vec4(clamp(c.rgb,0.,64.),clamp(c.a,0.,1.));}`,
  };
  function ensureComposer(camera) {
    renderer.getSize(size);
    const pr = Math.min(renderer.getPixelRatio(), 1.5);
    if (!composer) {
      const rt = new THREE.WebGLRenderTarget(size.x * pr, size.y * pr, { type: THREE.HalfFloatType, samples: 4 });
      composer = new EffectComposer(renderer, rt);
      renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);
      composer.addPass(new ShaderPass(SANITIZE));
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(size.x, size.y), .22, .5, .92));
      composer.addPass(new OutputPass());
      composer.addPass(new ShaderPass(GRADE));
      composer._w = 0;
    }
    if (composer._w !== size.x || composer._h !== size.y || composer._pr !== pr) { composer.setPixelRatio(pr); composer.setSize(size.x, size.y); composer._w = size.x; composer._h = size.y; composer._pr = pr; }
    renderPass.camera = camera;
  }

  return {
    cam: BAY_CAM,
    render(camera) {
      ensureComposer(camera);
      const tm = renderer.toneMapping, te = renderer.toneMappingExposure;
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
      composer.render();
      renderer.toneMapping = tm; renderer.toneMappingExposure = te;
    },
    update(t, dt) {
      waterU.uT.value = t;
      for (const b of boats) {
        if (b.moored) { b.g.position.y = WY + Math.sin(t * 1.1 + b.ph) * .07; b.g.rotation.z = Math.sin(t * .9 + b.ph) * .025; continue; }
        const [x, z] = b.path(t), [x2, z2] = b.path(t + .05), vx = x2 - x, vz = z2 - z, l = Math.hypot(vx, vz) || 1;
        b.g.position.set(x, WY + Math.sin(t * 1.4 + b.ph) * .08 * b.L / 10, z);
        if (l < 30) b.g.rotation.set(-.035 + Math.sin(t * 1.7 + b.ph) * .02, Math.atan2(-vx, -vz), Math.sin(t * 1.2 + b.ph) * .025);
        if (b.wake) b.wake(t, x - vx / l * b.L * .45, z - vz / l * b.L * .45);
      }
      for (const c of cars) {
        c.u = (c.u + c.v * dt * c.lane + 1) % 1;
        c.m.position.set(CA[0] + cdx * c.u + Math.cos(cyaw) * c.lane * 3.2, WY + 10.9, CA[1] + cdz * c.u - Math.sin(cyaw) * c.lane * 3.2);
      }
      for (const G of gulls) {
        const a = G.ph + t * G.v, g = G.g;
        g.position.set(G.c[0] + Math.cos(a) * G.r, G.c[1] + Math.sin(t * .5 + G.ph) * .8, G.c[2] + Math.sin(a) * G.r);
        const vx = -Math.sin(a) * Math.sign(G.v), vz = Math.cos(a) * Math.sign(G.v);
        g.rotation.y = Math.atan2(-vz, vx); g.rotation.x = -.35 * Math.sign(G.v);
        const glide = THREE.MathUtils.smoothstep(Math.sin(t * .4 + G.ph), .3, .7);
        const flap = THREE.MathUtils.lerp(.15 + Math.sin(t * G.f + G.ph) * .55, .12, glide);
        G.wings[0].rotation.x = -flap; G.wings[1].rotation.x = flap;
      }
      for (const c of clouds) { c.position.x += c.userData.v * dt; if (c.position.x > 3600) c.position.x = -3600; }
    },
  };
}
