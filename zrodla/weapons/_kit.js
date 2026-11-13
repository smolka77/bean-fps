// Wspólne narzędzia do modelowania broni (patrz SPEC.md). Układ: metry, −Z do przodu, +Y w górę, +X w prawo.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export { THREE, mergeGeometries };

const V2 = (a, b) => new THREE.Vector2(a, b);

// Zaokrągla narożniki wielokąta [[a,b],...]: radii = liczba lub tablica (0 = ostry narożnik), seg = podział łuku.
export function roundPoly(pts, radii = 0.002, seg = 4) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n], r = Array.isArray(radii) ? radii[i] : radii;
    if (!r) { out.push(p1); continue; }
    const d1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), d2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), t1 = Math.min(r, d1 / 2), t2 = Math.min(r, d2 / 2);
    const a = [p1[0] + (p0[0] - p1[0]) * t1 / d1, p1[1] + (p0[1] - p1[1]) * t1 / d1], b = [p1[0] + (p2[0] - p1[0]) * t2 / d2, p1[1] + (p2[1] - p1[1]) * t2 / d2];
    for (let k = 0; k <= seg; k++) { const u = k / seg, v = 1 - u; out.push([v * v * a[0] + 2 * u * v * p1[0] + u * u * b[0], v * v * a[1] + 2 * u * v * p1[1] + u * u * b[1]]); }
  }
  return out;
}

// Profil boczny: punkty [z, y] (jak patrzysz z prawej strony), wyciągnięty wzdłuż X, wyśrodkowany w x = 0.
// holes: tablice punktów [z,y] otworów. bevel: promień fazki (całkowita szerokość = width).
export function side(pts, width, bevel = 0.0015, holes = [], curveSeg = 10) {
  const sh = new THREE.Shape(pts.map(p => V2(p[0], p[1])));
  for (const h of holes) sh.holes.push(new THREE.Path(h.map(p => V2(p[0], p[1]))));
  const bt = Math.min(bevel, width / 2 - 1e-4), depth = Math.max(1e-4, width - 2 * bt);
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bt > 0, bevelThickness: bt, bevelSize: bt, bevelSegments: 2, curveSegments: curveSeg });
  g.rotateY(-Math.PI / 2); g.translate(depth / 2, 0, 0); g.computeVertexNormals();
  return g;
}

// Profil czołowy: punkty [x, y] wyciągnięte wzdłuż Z na długość len, wyśrodkowane w z = 0.
export function front(pts, len, bevel = 0.0012, holes = [], curveSeg = 12) {
  const sh = new THREE.Shape(pts.map(p => V2(p[0], p[1])));
  for (const h of holes) sh.holes.push(new THREE.Path(h.map(p => V2(p[0], p[1]))));
  const bt = Math.min(bevel, len / 2 - 1e-4), depth = Math.max(1e-4, len - 2 * bt);
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bt > 0, bevelThickness: bt, bevelSize: bt, bevelSegments: 2, curveSegments: curveSeg });
  g.translate(0, 0, -depth / 2); g.computeVertexNormals();
  return g;
}

// Bryła obrotowa wokół osi Z. Profil: [r, z] od TYŁU do PRZODU (z malejące). Zamyka końce, jeśli r > 0.
export function lathe(profile, segs = 32) {
  const pts = profile.map(p => V2(p[0], -p[1]));
  const g = new THREE.LatheGeometry(pts, segs);
  g.rotateX(-Math.PI / 2); g.computeVertexNormals();
  return g;
}

// Walec wzdłuż Z od z0 do z1 (promień r, opcjonalnie r1 na końcu z1), z zaślepkami.
export function cyl(r, z0, z1, segs = 24, r1 = r) {
  const len = Math.abs(z1 - z0), g = new THREE.CylinderGeometry(r1, r, len, segs);   // góra = r1 (przód), dół = r (tył)
  g.rotateX(-Math.PI / 2); g.translate(0, 0, (z0 + z1) / 2); return g;
}

// Rura (pierścień) wzdłuż Z: zewnętrzny rOut, wewnętrzny rIn – do otworów lufy / tłumika.
export function tube(rOut, rIn, z0, z1, segs = 32) {
  const g = lathe([[rIn, z0], [rOut, z0], [rOut, z1], [rIn, z1]], segs); return g;
}

export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
// Zaokrąglona skrzynka (wymiary w, h, d; promień zaokrąglenia r)
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export function rbox(w, h, d, r = 0.002, seg = 3) { return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-5, h / 2 - 1e-5, d / 2 - 1e-5)); }

// Przeciągnięcie prostokątnego przekroju wzdłuż krzywej w płaszczyźnie YZ (magazynek łukowy, kabłąk itp.).
// path: tablica punktów [y, z] od góry; wid(i, t) i dep(i, t) → szerokość (x) i głębokość (wzdłuż normalnej) w kroku i.
export function sweep(path, steps, wid, dep, capEnds = true) {
  const curve = new THREE.CatmullRomCurve3(path.map(p => new THREE.Vector3(0, p[0], p[1])));
  const rings = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, c = curve.getPoint(t), tg = curve.getTangent(t), n = new THREE.Vector3(1, 0, 0).cross(tg).normalize();   // n leży w płaszczyźnie YZ
    const w = wid(i, t) / 2, d = dep(i, t) / 2;
    rings.push([
      new THREE.Vector3(-w, 0, 0).addScaledVector(n, -d).add(c), new THREE.Vector3(w, 0, 0).addScaledVector(n, -d).add(c),
      new THREE.Vector3(w, 0, 0).addScaledVector(n, d).add(c), new THREE.Vector3(-w, 0, 0).addScaledVector(n, d).add(c)]);
  }
  const pos = [], tri = (a, b, c) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let i = 0; i < steps; i++) for (let k = 0; k < 4; k++) {
    const a = rings[i][k], b = rings[i][(k + 1) % 4], c = rings[i + 1][(k + 1) % 4], d = rings[i + 1][k];
    tri(a, c, b); tri(a, d, c);
  }
  if (capEnds) for (const [ring, flip] of [[rings[0], false], [rings[steps], true]]) {
    if (!flip) { tri(ring[0], ring[1], ring[2]); tri(ring[0], ring[2], ring[3]); } else { tri(ring[0], ring[2], ring[1]); tri(ring[0], ring[3], ring[2]); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}

// Proceduralne tekstury
export function canvasTex(w, h, draw, repeat = [1, 1], srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}
let _seed = 7; const rnd = () => (_seed = (_seed * 16807) % 2147483647) / 2147483647;
export function woodTexture(base = [122, 74, 38], dark = [74, 40, 18], repeat = [1, 3]) {
  return canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = `rgb(${base})`; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {                                // słoje: długie, lekko faliste linie
      const px = rnd() * w, a = .05 + rnd() * .22, wd = .6 + rnd() * 2.2;
      x.strokeStyle = `rgba(${dark},${a})`; x.lineWidth = wd; x.beginPath(); x.moveTo(px, 0);
      for (let y = 0; y <= h; y += 16) x.lineTo(px + Math.sin(y * .03 + i) * 3 + (rnd() - .5) * 1.4, y); x.stroke();
    }
    for (let i = 0; i < 220; i++) { x.fillStyle = `rgba(${dark},${rnd() * .09})`; x.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 3 + rnd() * 22) }
  }, repeat);
}
// Faktura „stipple” (kropki) jako mapa nierówności – dla polimerowych chwytów
export function stippleBump(cell = 0.0042) {
  const t = canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#7a7a7a'; x.fillRect(0, 0, w, h);
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { const cx = i * 16 + 8 + (j % 2) * 8, cy = j * 16 + 8, g = x.createRadialGradient(cx, cy, 0, cx, cy, 6); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#7a7a7a'); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, 6, 0, 7); x.fill(); }
  }, [1 / (cell * 8), 1 / (cell * 8)], false);
  return t;
}
// Delikatna tekstura nierówności metalu (parkeryzacja)
export function metalNoise(repeat = [4, 4]) {
  return canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#808080'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) { const v = 100 + rnd() * 60; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(rnd() * w, rnd() * h, 1, 1) }
  }, repeat, false);
}

// Scal wiele geometrii w jedną (jedna siatka, jeden materiał). keepUv: zostaw UV (np. dla drewna).
export function merged(list, keepUv = false) {
  const out = list.map(g => {
    g = g.index ? g.toNonIndexed() : g.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && !(keepUv && k === 'uv')) g.deleteAttribute(k);
    if (keepUv && !g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    return g;
  });
  return mergeGeometries(out);
}
// Pomocniki ułożenia
export function placed(g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  g = g.clone(); const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(m); return g;
}
export function mesh(g, m, parent, shadow = true) { const o = new THREE.Mesh(g, m); o.castShadow = shadow; if (parent) parent.add(o); return o; }
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
