// Lobby "Vice Beach": plaża o zachodzie słońca w stylu retro-synthwave (low-poly).
// Kamera stoi na +Z i patrzy na -Z. Fasolka stoi na piasku w (0,0,0), za nią morze, słońce nisko po lewej,
// a linia brzegowa ucieka po przekątnej w prawo, w stronę miasta na horyzoncie (hotele art deco, wieżowce, palmy).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// linia brzegu: dla danego x zwraca z granicy wody (woda: z < S(x), ląd: z > S(x)); ten sam wzór jest w shaderze wody
const S = x => -6 + 2 * Math.sin(x * 0.06) - Math.max(x, 0) * 1.6 + Math.max(-x, 0) * 0.08;
const sstep = THREE.MathUtils.smoothstep;
const heightAt = (x, z) => {
  const d = z - S(x);
  let h = THREE.MathUtils.lerp(-3.2, 0, sstep(d, -14, 4));
  h += 0.35 * Math.sin(x * 0.11) * Math.sin(z * 0.09) * sstep(d, 12, 30) * sstep(Math.hypot(x, z), 18, 40);   // łagodne wydmy w głębi lądu
  return h;
};

// ---------- paleta ----------
const SKY = [0xffc36e, 0xff8a5c, 0xff4f93, 0xb04ad0, 0x5a2fa8, 0x1a1450];   // od horyzontu do zenitu
const FOG = 0xff9a82;
const PASTEL = [0xffb3d1, 0x9fe8ff, 0xc9b3ff, 0xffcba0, 0xffffff, 0xb8ffe0, 0xff9ec7];

// ---------- pomocnicze: geometria "zupa trójkątów" z kolorami wierzchołków ----------
function soup() {
  const pos = [], col = [];
  return {
    tri(a, b, c, ca, cb = ca, cc = ca) { pos.push(...a, ...b, ...c); col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b); },
    quad(a, b, c, d, ca, cb = ca, cc = ca, cd = ca) { this.tri(a, b, c, ca, cb, cc); this.tri(a, c, d, ca, cc, cd); },
    build() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.computeVertexNormals(); return g;
    },
  };
}
const C = hex => new THREE.Color(hex);

// palma: wygięty pień z pierścieniami i korona z opadających liści
function palmGeo(seed, h, lean) {
  const r = rng(seed), s = soup(), SIDES = 7, SEG = 9;
  const TRUNK_A = C(0x9a7458), TRUNK_B = C(0x5d4036);
  const centers = [], radii = [];
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG;
    centers.push(new THREE.Vector3(lean * t * t * h * 0.42, t * h, Math.sin(t * 2.4 + seed) * 0.12 * h * 0.1));
    radii.push(THREE.MathUtils.lerp(0.26, 0.11, t) * (1 + (i % 2 ? 0.1 : 0)) * h / 8);
  }
  const ring = (c, rad, k) => { const p = []; for (let j = 0; j < SIDES; j++) { const a = j / SIDES * Math.PI * 2; p.push([c.x + Math.cos(a) * rad, c.y, c.z + Math.sin(a) * rad]); } return p; };
  for (let i = 0; i < SEG; i++) {
    const a = ring(centers[i], radii[i]), b = ring(centers[i + 1], radii[i + 1]);
    const ca = TRUNK_A.clone().lerp(TRUNK_B, (i % 2) * .55 + i / SEG * .25), cb = TRUNK_A.clone().lerp(TRUNK_B, ((i + 1) % 2) * .55 + (i + 1) / SEG * .25);
    for (let j = 0; j < SIDES; j++) { const j2 = (j + 1) % SIDES; s.quad(a[j], a[j2], b[j2], b[j], ca, ca, cb, cb); }
  }
  // korona
  const top = centers[SEG], N = 11, scale = h / 8;
  const DARK = C(0x1b5d4b), MID = C(0x2fae78), TIP = C(0x7ee0a4);
  for (let k = 0; k < N; k++) {
    const ang = k / N * Math.PI * 2 + r() * .4, L = (2.7 + r() * 1.0) * scale, W = (0.5 + r() * .15) * scale;
    const dx = Math.cos(ang), dz = Math.sin(ang), px = -dz, pz = dx;
    const rise = 0.55 + r() * .3, droop = 0.9 + r() * .5;
    let prev = null;
    for (let j = 0; j <= 6; j++) {
      const t = j / 6, out = L * t, y = L * (rise * t - droop * t * t), w = W * Math.sin(Math.PI * (t * .92 + .04)) * (1 - t * .25);
      const c = j === 0 ? DARK : DARK.clone().lerp(MID, Math.min(1, t * 1.6)).lerp(TIP, Math.max(0, t - .6) * 1.2);
      const base = [top.x + dx * out, top.y + y, top.z + dz * out];
      const row = [[base[0] + px * w * .5, base[1] + w * .12, base[2] + pz * w * .5], [base[0], base[1] - w * .08, base[2]], [base[0] - px * w * .5, base[1] + w * .12, base[2] - pz * w * .5], c];
      if (prev) {
        s.quad(prev[0], prev[1], row[1], row[0], prev[3], prev[3], row[3], row[3]);
        s.quad(prev[1], prev[2], row[2], row[1], prev[3], prev[3], row[3], row[3]);
        // spód liścia, żeby było widać z dołu
        s.quad(prev[1], prev[0], row[0], row[1], prev[3], prev[3], row[3], row[3]);
        s.quad(prev[2], prev[1], row[1], row[2], prev[3], prev[3], row[3], row[3]);
      }
      prev = row;
    }
  }
  return s.build();
}

// pudełko z UV skalowanymi do rozmiaru (okna powtarzają się co ~12 m) i jednolitym kolorem ścian
function boxGeo(w, h, d, x, y, z, color) {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y + h / 2, z);
  const uv = g.attributes.uv, T = 12;
  const scales = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];   // +x -x +y -y +z -z
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * scales[f][0] / T, uv.getY(k) * scales[f][1] / T); }
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set([color.r, color.g, color.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}

export function buildVice(scene) {
  const rnd = rng(11), R = (a, b) => a + (b - a) * rnd();
  scene.fog = new THREE.FogExp2(FOG, 0.0036);

  const SUN_POS = new THREE.Vector3(-135, 26, -430);
  const SUN_DIR = SUN_POS.clone().normalize();

  // ---------- niebo: 6-pasmowy gradient + gwiazdy ----------
  const skyU = {}; SKY.forEach((h, i) => { skyU['c' + i] = { value: C(h) }; });
  const SKY_GLSL = `uniform vec3 c0,c1,c2,c3,c4,c5;
    vec3 skyCol(float h){
      vec3 c=mix(c0,c1,smoothstep(0.,.05,h));
      c=mix(c,c2,smoothstep(.04,.16,h));
      c=mix(c,c3,smoothstep(.14,.32,h));
      c=mix(c,c4,smoothstep(.3,.6,h));
      return mix(c,c5,smoothstep(.55,1.,h));
    }`;
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(600, 32, 20), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `${SKY_GLSL} varying vec3 vP;
      float h13(vec3 p){p=fract(p*.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}
      void main(){
        float h=max(vP.y,0.); vec3 col=skyCol(h);
        float st=step(.9972,h13(floor(vP*210.)))*smoothstep(.42,.8,h); col+=vec3(st*.85);
        gl_FragColor=vec4(col,1.);
        #include <colorspace_fragment>
      }`,
  })));

  // ---------- słońce: tarcza z paskami (retro) + poświata ----------
  const sunM = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    vertexShader: 'varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 vU;
      void main(){
        vec2 p=vU*2.-1.; float r=length(p); if(r>1.)discard;
        float y=vU.y;
        vec3 col=mix(vec3(1.,.28,.5),vec3(1.,.92,.42),smoothstep(.1,.95,y));
        float gap=mix(0.,.62,clamp((.55-y)/.55,0.,1.));
        float vis=(y>.55)?1.:step(gap,fract(y*17.));
        gl_FragColor=vec4(col,vis*smoothstep(1.,.97,r));
        #include <colorspace_fragment>
      }`,
  });
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(40, 64), sunM); sunDisc.position.copy(SUN_POS); sunDisc.renderOrder = 0; scene.add(sunDisc);
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,190,110,.95)'); g.addColorStop(.25, 'rgba(255,110,150,.55)'); g.addColorStop(.6, 'rgba(210,70,190,.18)'); g.addColorStop(1, 'rgba(210,70,190,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending, toneMapped: false }));
  glow.position.copy(SUN_POS).multiplyScalar(.99); glow.scale.setScalar(520); scene.add(glow);

  // ---------- światła ----------
  scene.add(new THREE.HemisphereLight(0xff9fc8, 0xa8587a, 1.15));
  const sun = new THREE.DirectionalLight(0xff8a4a, 2.5);
  sun.target.position.set(0, 0, 0); sun.position.copy(SUN_DIR).multiplyScalar(34); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 80 });
  scene.add(sun, sun.target);
  const fillPink = new THREE.DirectionalLight(0xff7ab8, 1.0); fillPink.position.set(-4, 3, 10); scene.add(fillPink);   // różowe światło z przodu
  const rimCyan = new THREE.DirectionalLight(0x4de0ff, 1.35); rimCyan.position.set(7, 3, -4); scene.add(rimCyan);     // turkusowy kontur z prawej

  // ---------- teren: piasek ----------
  const sandTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), r = rng(5);
    x.fillStyle = '#f3cfa6'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1400; i++) { x.fillStyle = r() < .5 ? `rgba(255,236,205,${.18 + r() * .25})` : `rgba(206,150,130,${.12 + r() * .2})`; x.beginPath(); x.arc(r() * 256, r() * 256, .8 + r() * 2.6, 0, 7); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(110, 110); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  })();
  const groundGeo = new THREE.PlaneGeometry(900, 900, 200, 200); groundGeo.rotateX(-Math.PI / 2); groundGeo.translate(120, 0, -130);
  {
    const p = groundGeo.attributes.position, cols = new Float32Array(p.count * 3), dry = C(0xfff0e0), wet = C(0xb68aa0), under = C(0x5a6aa0), tmp = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), d = z - S(x);
      p.setY(i, heightAt(x, z));
      tmp.copy(under).lerp(wet, sstep(d, -3, 0)).lerp(dry, sstep(d, 0.5, 4.5)); cols.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    groundGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); groundGeo.computeVertexNormals();
  }
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ map: sandTex, vertexColors: true, roughness: 1, emissive: 0x6a3a5a, emissiveIntensity: .55 }));
  ground.receiveShadow = true; scene.add(ground);

  // ---------- morze: shader (odbicie nieba, piaszczysta płycizna, piana, ścieżka słońca) ----------
  const waterU = { ...skyU, uTime: { value: 0 }, uSun: { value: SUN_POS.clone() },
    deep: { value: C(0x1a1058) }, shallow: { value: C(0x3fd8d0) } };
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600), new THREE.ShaderMaterial({
    transparent: true, fog: false, depthWrite: false, uniforms: waterU,
    vertexShader: 'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: `${SKY_GLSL} uniform float uTime; uniform vec3 uSun,deep,shallow; varying vec3 vW;
      float S(float x){return -6.+2.*sin(x*.06)-max(x,0.)*1.6+max(-x,0.)*.08;}
      float h12(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
      float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h12(i),h12(i+vec2(1,0)),f.x),mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),f.x),f.y);}
      void main(){
        vec3 toCam=cameraPosition-vW; float dist=length(toCam); vec3 v=toCam/dist;
        float d=S(vW.x)-vW.z;                                  // >0: głębokość od linii brzegu (w stronę morza)
        // drobne fale zaburzają odbicie
        float wv=vn(vW.xz*vec2(.55,1.6)+vec2(uTime*.25,uTime*.6))+vn(vW.xz*vec2(1.3,3.2)-vec2(uTime*.2,uTime*.9))*.5;
        float refl=clamp(v.y+(wv-.7)*.03,0.,1.);
        vec3 sky=skyCol(refl*1.4);
        float fres=.22+.78*pow(1.-clamp(v.y*6.,0.,1.),2.);
        vec3 body=mix(deep,shallow,smoothstep(16.,0.,d)*.75);
        vec3 col=mix(body,sky,clamp(fres,0.,1.));
        // ścieżka słońca: poszarpane błyski, szerokie bliżej słońca
        vec2 cs=cameraPosition.xz, dir=normalize(uSun.xz-cs), rel=vW.xz-cs;
        float along=dot(rel,dir), across=dot(rel,vec2(-dir.y,dir.x));
        float width=2.5+along*.045;
        float path=exp(-pow(across/width,2.))*smoothstep(8.,60.,along);
        float sp=smoothstep(.62,.9,vn(vec2(across*.9,along*.22-uTime*.7))+vn(vec2(across*2.1,along*.5+uTime*.5))*.3);
        col+=vec3(1.,.78,.45)*path*(.22+sp*1.15);
        // piana na brzegu: pulsujące fale i cienka kreska
        float surge=.5+.5*sin(uTime*.7+vW.x*.12);
        float foam=smoothstep(1.6+surge*1.3,0.,d)*step(0.,d)*(.55+.45*vn(vW.xz*2.5+uTime*.3));
        col=mix(col,vec3(1.,.9,.95),clamp(foam,0.,1.)*.85);
        col=mix(col,skyCol(0.),smoothstep(180.,900.,dist));
        float a=mix(.62,1.,smoothstep(0.,10.,d)); a=(d<0.)?.0:a;   // nad lądem woda jest niewidoczna
        gl_FragColor=vec4(col,a);
        #include <colorspace_fragment>
      }`,
  }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, -0.3, -400); water.renderOrder = 1; scene.add(water);

  // ---------- chmury ----------
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffb0c8, emissive: 0xc0407a, emissiveIntensity: .7, roughness: 1, fog: false });
  const cloudGeo = new THREE.IcosahedronGeometry(1, 1), clouds = [];
  for (let i = 0; i < 16; i++) {
    const c = new THREE.Group(), n = 5 + Math.floor(R(0, 4));
    for (let j = 0; j < n; j++) { const p = new THREE.Mesh(cloudGeo, cloudMat), s = R(4, 9) * (1 - Math.abs(j - n / 2) / n); p.scale.set(s * 1.8, s * .5, s); p.position.set((j - n / 2) * 7 + R(-2, 2), R(0, 2), R(-3, 3)); c.add(p); }
    c.position.set(R(-340, 340), R(40, 130), R(-420, -200)); c.scale.setScalar(R(.8, 1.7)); c.userData.v = R(.5, 1.4); scene.add(c); clouds.push(c);
  }

  // ---------- palmy (instancje, kołysanie) ----------
  const palmVariants = [palmGeo(3, 8.5, .55), palmGeo(7, 10.5, -.4), palmGeo(13, 7, .75), palmGeo(21, 12, .3)];
  const wind = { value: 0 };
  const palmMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .9, side: THREE.DoubleSide });
  palmMat.onBeforeCompile = sh => {
    sh.uniforms.uTime = wind;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 wp=(instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
      float k=max(position.y,0.)*max(position.y,0.)*.004;
      transformed.x+=sin(uTime*1.2+wp.x*.2+wp.z*.1)*k;
      transformed.z+=cos(uTime*.9+wp.z*.17)*k*.6;`);
  };
  const palmList = palmVariants.map(() => []);
  // palmy blisko kamery są niższe: dzięki temu korona mieści się w kadrze, a nie widać samego pnia
  const palmAt = (x, z, s, v) => { const d = Math.hypot(x, z - 6); palmList[v ?? Math.floor(R(0, 4))].push({ x, z, y: heightAt(x, z) - .05, s: s * THREE.MathUtils.clamp(d / 26, .38, 1), ry: R(0, 6.28) }); };
  // wprost przy fasolce: ramka kadru
  palmAt(-14, -13, .95, 0); palmAt(13, -14, .9, 1); palmAt(-22, -16, 1, 3); palmAt(20, -19, 1, 0);
  // wzdłuż brzegu: po lewej (za fasolką) i po prawej (po przekątnej w głąb)
  for (let x = -34; x < 0; x += R(3.5, 6)) palmAt(x, S(x) + R(.8, 2.6), R(.85, 1.2));
  for (let x = 4; x < 150; x += R(5, 9)) palmAt(x + R(-1, 1), S(x) + R(3, 7), R(.9, 1.4));
  palmList.forEach((list, v) => {
    if (!list.length) return;
    const m = new THREE.InstancedMesh(palmVariants[v], palmMat, list.length), o = new THREE.Object3D();
    list.forEach((p, i) => { o.position.set(p.x, p.y, p.z); o.rotation.set(0, p.ry, 0); o.scale.setScalar(p.s); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    m.castShadow = true; m.receiveShadow = true; scene.add(m);
  });

  // ---------- budynki: hotele art deco wzdłuż brzegu + wieżowce na horyzoncie ----------
  const winTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 256, 256);
    for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) { x.fillStyle = '#3a3470'; x.fillRect(q * 64 + 14, r * 64 + 12, 36, 38); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  })();
  const emTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), r = rng(9);
    x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256);
    const lit = ['#ffc27a', '#ff7ab8', '#7ae8ff', '#ffe9a0'];
    for (let row = 0; row < 4; row++) for (let q = 0; q < 4; q++) if (r() < .62) { x.fillStyle = lit[Math.floor(r() * lit.length)]; x.fillRect(q * 64 + 14, row * 64 + 12, 36, 38); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const bldMat = new THREE.MeshStandardMaterial({ map: winTex, vertexColors: true, emissive: 0xffffff, emissiveMap: emTex, emissiveIntensity: .85, roughness: .9, flatShading: true });
  const bld = [], trim = [], pink = C(0xff3d9a), cyan = C(0x3de8ff);
  const addTrim = (w, h, d, x, y, z, col) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y + h / 2, z); const n = g.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.set([col.r, col.g, col.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.deleteAttribute('uv'); trim.push(g); };
  function building(x, z, w, h, d, tall) {
    const y = heightAt(x, z), col = C(PASTEL[Math.floor(R(0, PASTEL.length))]);
    bld.push(boxGeo(w, h, d, x, y, z, col));
    if (!tall) {                                                        // art deco: uskoki na dachu i neonowe paski
      bld.push(boxGeo(w * .72, h * .22, d * .72, x, y + h, z, col));
      bld.push(boxGeo(w * .4, h * .12, d * .4, x, y + h * 1.22, z, col));
      addTrim(w + .3, .35, d + .3, x, y + h - .35, z, rnd() < .5 ? pink : cyan);
      addTrim(w + .3, .3, d + .3, x, y + h * .5, z, rnd() < .5 ? cyan : pink);
    } else { bld.push(boxGeo(w * .6, h * .15, d * .6, x, y + h, z, col)); addTrim(w * .62, .5, d * .62, x, y + h * 1.14, z, rnd() < .5 ? pink : cyan); }
  }
  const skip = (x, z) => Math.hypot(x - -10, z - -22) < 1;                  // miejsce na molo (nic tam nie stawiamy)
  for (let x = 30; x < 80; x += R(11, 16)) building(x, S(x) + R(12, 17), R(9, 13), R(11, 20), R(9, 13), false);       // pierwszy rząd, niskie hotele
  for (let x = 44; x < 130; x += R(13, 19)) building(x, S(x) + R(30, 38), R(10, 15), R(20, 38), R(10, 15), false);   // drugi rząd
  for (let x = 70; x < 240; x += R(12, 17)) building(x, S(x) + R(24, 46), R(13, 20), R(46, 120), R(13, 20), true);    // wieżowce w oddali
  for (let x = 140; x < 330; x += R(14, 22)) building(x, S(x) + R(44, 90), R(16, 26), R(70, 150), R(16, 26), true);
  void skip;
  const bldMesh = new THREE.Mesh(mergeGeometries(bld), bldMat); bldMesh.castShadow = true; bldMesh.receiveShadow = true; scene.add(bldMesh);
  scene.add(new THREE.Mesh(mergeGeometries(trim), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })));

  // ---------- molo z latarniami ----------
  {
    const x0 = -10, zEnd = S(x0) - 34, zStart = S(x0) + 2, len = zStart - zEnd, deckY = .35;
    const wood = new THREE.MeshStandardMaterial({ color: 0xb07a5e, roughness: 1, flatShading: true });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.3, .16, len), wood); deck.position.set(x0, deckY, (zStart + zEnd) / 2); deck.castShadow = deck.receiveShadow = true; scene.add(deck);
    const postG = new THREE.BoxGeometry(.18, 2.4, .18);
    const lampGlow = new THREE.SpriteMaterial({ map: glowTex, fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending, color: 0xffc27a, toneMapped: false });
    for (let z = zStart - 1; z > zEnd; z -= 4) {
      for (const sx of [-1, 1]) { const p = new THREE.Mesh(postG, wood); p.position.set(x0 + sx * 1.0, deckY - 1.1, z); scene.add(p); }
      if (Math.round((zStart - z) / 4) % 2 === 0) {
        const pole = new THREE.Mesh(new THREE.BoxGeometry(.08, 1.7, .08), wood); pole.position.set(x0 + 1.05, deckY + .9, z); scene.add(pole);
        const bulb = new THREE.Mesh(new THREE.IcosahedronGeometry(.13, 0), new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false })); bulb.position.set(x0 + 1.05, deckY + 1.78, z); scene.add(bulb);
        const g = new THREE.Sprite(lampGlow); g.position.copy(bulb.position); g.scale.setScalar(2.4); scene.add(g);
      }
    }
  }

  // ---------- rekwizyty na plaży: parasole, deski surfingowe, wieża ratownika ----------
  function umbrella(x, z, c1, c2, tilt) {
    const g = new THREE.Group(), pole = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 2.3, 6), new THREE.MeshStandardMaterial({ color: 0xf3e6d8, roughness: .8 }));
    pole.position.y = 1.15; g.add(pole);
    const cone = new THREE.ConeGeometry(1.35, .65, 8, 1, true); const cc = [C(c1), C(c2)], cols = new Float32Array(cone.attributes.position.count * 3);
    // 8 klinów naprzemiennie w dwóch kolorach (po kącie wierzchołka)
    for (let i = 0; i < cone.attributes.position.count; i++) { const a = Math.atan2(cone.attributes.position.getZ(i), cone.attributes.position.getX(i)), k = Math.floor((a + Math.PI) / (Math.PI / 4)) % 2; cols.set([cc[k].r, cc[k].g, cc[k].b], i * 3); }
    cone.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const top = new THREE.Mesh(cone, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9, flatShading: true, side: THREE.DoubleSide })); top.position.y = 2.35; top.castShadow = true; g.add(top);
    g.position.set(x, heightAt(x, z), z); g.rotation.z = tilt; scene.add(g);
  }
  umbrella(-5.4, -4.2, 0xff4f93, 0xffffff, .12); umbrella(5.8, -6.5, 0x3de8ff, 0xffffff, -.1); umbrella(-13, -3, 0xffc36e, 0xff4f93, .08);
  [[4.6, -1.8, 0x3de8ff, .15], [5.1, -1.5, 0xff4f93, -.1], [-4.4, -.8, 0xffd23d, .2]].forEach(([x, z, col, tilt]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(.28, 1.9, .06), new THREE.MeshStandardMaterial({ color: col, roughness: .6, flatShading: true }));
    b.position.set(x, heightAt(x, z) + .85, z); b.rotation.z = tilt; b.castShadow = true; scene.add(b);
  });
  {
    const g = new THREE.Group(), pastelWall = new THREE.MeshStandardMaterial({ color: 0xffd0e4, roughness: .9, flatShading: true }), cy = new THREE.MeshStandardMaterial({ color: 0x4de0ff, roughness: .6, flatShading: true });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(.14, 2, .14), pastelWall); l.position.set(sx * .8, 1, sz * .8); g.add(l); }
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.5, 2.2), pastelWall); cab.position.y = 2.75; g.add(cab);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.8, .25, 2.8), cy); roof.position.y = 3.65; g.add(roof);
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.5, .6, .05), new THREE.MeshBasicMaterial({ color: 0xffc27a, toneMapped: false })); win.position.set(0, 2.85, 1.12); g.add(win);
    g.children.forEach(o => { o.castShadow = true; }); g.position.set(-17, heightAt(-17, -6), -6); g.rotation.y = .5; scene.add(g);
  }

  // ---------- neon "BEANLADEN" na słupie ----------
  const neonCanvas = document.createElement('canvas'); neonCanvas.width = 768; neonCanvas.height = 192;
  const neonTex = new THREE.CanvasTexture(neonCanvas); neonTex.colorSpace = THREE.SRGBColorSpace;
  const drawNeon = () => {
    const x = neonCanvas.getContext('2d'); x.clearRect(0, 0, 768, 192); x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '700 104px Anton, Impact, sans-serif';
    x.shadowColor = '#ff2d95'; x.shadowBlur = 40; x.fillStyle = '#ff3d9a'; x.fillText('BEANLADEN', 384, 84);
    x.shadowBlur = 16; x.fillStyle = '#ff9fd2'; x.fillText('BEANLADEN', 384, 84);
    x.shadowColor = '#37e6ff'; x.shadowBlur = 20; x.strokeStyle = '#7af0ff'; x.lineWidth = 5; x.beginPath(); x.moveTo(110, 158); x.lineTo(658, 158); x.stroke();
    neonTex.needsUpdate = true;
  };
  drawNeon(); try { document.fonts.load('104px Anton').then(drawNeon).catch(() => {}); } catch {}
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.25), new THREE.MeshBasicMaterial({ map: neonTex, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  sign.position.set(7.2, 3.9, -9); sign.rotation.y = -.3; scene.add(sign);
  for (const dx of [-2, 2]) { const post = new THREE.Mesh(new THREE.BoxGeometry(.12, 3.4, .12), new THREE.MeshStandardMaterial({ color: 0x4a3a5a, roughness: .8 })); post.position.set(7.2 + dx * Math.cos(.3), 1.7, -9 + dx * Math.sin(.3)); scene.add(post); }

  // ---------- jacht i łódka na wodzie ----------
  function yacht(x, z, s, ry) {
    const g = new THREE.Group(), white = new THREE.MeshStandardMaterial({ color: 0xfff4f8, roughness: .6, flatShading: true });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, .8, 8), white); hull.position.y = .4; g.add(hull);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, .9, 3), white); cab.position.set(0, 1.2, .6); g.add(cab);
    const flyb = new THREE.Mesh(new THREE.BoxGeometry(1.2, .5, 2), new THREE.MeshStandardMaterial({ color: 0xff4f93, roughness: .6 })); flyb.position.set(0, 1.9, .4); g.add(flyb);
    const lamp = new THREE.Mesh(new THREE.IcosahedronGeometry(.18, 0), new THREE.MeshBasicMaterial({ color: 0xffe4a8, toneMapped: false })); lamp.position.set(0, 2.5, .4); g.add(lamp);
    g.scale.setScalar(s); g.position.set(x, -.3, z); g.rotation.y = ry; g.userData = { by: -.3, ph: R(0, 6) }; scene.add(g); return g;
  }
  const boats = [yacht(30, -80, 3.2, 1.2), yacht(-60, -150, 4.5, -.7), yacht(110, -230, 5, 2.4)];

  // ---------- mewy ----------
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x3a1f55, side: THREE.DoubleSide, fog: false });
  const wingGeo = new THREE.BufferGeometry(); wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([.24, 0, 0, -.22, 0, 0, -.16, 0, .82], 3));
  const birdBody = new THREE.ConeGeometry(.07, .5, 5); birdBody.rotateZ(-Math.PI / 2);
  const flocks = [];
  for (let i = 0; i < 3; i++) {
    const group = new THREE.Group(), birds = [], n = 3 + Math.floor(R(0, 4));
    for (let j = 0; j < n; j++) {
      const b = new THREE.Group(), L = new THREE.Mesh(wingGeo, birdMat), Rw = new THREE.Mesh(wingGeo, birdMat); Rw.scale.z = -1; b.add(new THREE.Mesh(birdBody, birdMat), L, Rw);
      const row = Math.ceil(j / 2), side = j % 2 ? 1 : -1; b.position.set(-row * 1.7 + R(-.3, .3), R(-.3, .3), row * side * 1.5); b.scale.setScalar(R(2, 2.6));
      b.userData = { L, R: Rw, ph: R(0, 6), f: R(8, 10) }; group.add(b); birds.push(b);
    }
    const f = { group, birds, x: R(-120, 120), y: R(16, 30), z: R(-110, -60), v: (i % 2 ? 1 : -1) * R(4, 6.5), bob: R(0, 6) }; group.rotation.y = f.v > 0 ? 0 : Math.PI; scene.add(group); flocks.push(f);
  }

  return (t, dt) => {
    wind.value = t; waterU.uTime.value = t;
    clouds.forEach(c => { c.position.x += c.userData.v * dt; if (c.position.x > 380) c.position.x = -380; });
    boats.forEach(b => { b.position.y = b.userData.by + Math.sin(t * .8 + b.userData.ph) * .07; b.rotation.z = Math.sin(t * .6 + b.userData.ph) * .02; });
    flocks.forEach(f => {
      f.x += f.v * dt; if (f.x > 170) f.x = -170; if (f.x < -170) f.x = 170;
      f.group.position.set(f.x, f.y + Math.sin(t * .45 + f.bob) * .8, f.z);
      f.birds.forEach(b => { const u = b.userData, a = .15 + Math.sin(t * u.f + u.ph) * .6; u.L.rotation.x = -a; u.R.rotation.x = a; });
    });
    sign.material.opacity = .94 + .06 * Math.sin(t * 23) * Math.sin(t * 2.7);                    // lekkie migotanie neonu
  };
}
