// Szybkie trafienia promieniem w siatki mapy (strzał gracza): drzewo prostopadłościanów (BVH) dla każdej statycznej siatki.
//
// Problem: Raycaster z three.js sprawdza KAŻDY trójkąt siatki, w którą trafi jej kula otaczająca. Mapy mają po 30–190 tys.
// trójkątów w kilku dużych siatkach (teren, hala), więc jeden strzał kosztował 3–14 ms na szybkim komputerze, a 40–60 ms
// na słabszym laptopie – przy serii z karabinu gra przycinała przy każdym strzale.
//
// Rozwiązanie: raz, przy wczytaniu mapy (pod ekranem wczytywania), budujemy dla geometrii drzewo prostopadłościanów;
// przy strzale sprawdzamy tylko trójkąty z gałęzi, przez które przechodzi promień. Wynik jest taki sam jak w three.js:
// ten sam test trójkąta (Ray.intersectTriangle, strona materiału, near/far), te same pola trafienia (punkt, odległość,
// face z normalną, faceIndex, uv, normal, barycoord) i ta sama kolejność (rosnący numer trójkąta w siatce).
// Wstępne testy (kula w świecie, prostopadłościan lokalnie) zostają w Mesh.raycast – podmieniamy tylko _computeIntersections.
// Siatki z animacją kształtu, skórą, instancjami, wieloma materiałami albo z drawRange liczą się jak dawniej.
import * as THREE from 'three';

const LEAF = 8;                       // najwięcej trójkątów w liściu drzewa
const MIN_TRIS = 256;                 // mniejsze siatki: zwykły Raycaster jest wystarczająco szybki
const TREES = new WeakMap();          // geometria -> drzewo (geometria bywa wspólna dla kilku siatek)

function build(geo) {
  const pos = geo.attributes.position, idx = geo.index, n = Math.floor((idx ? idx.count : pos.count) / 3);
  const B = new Float64Array(n * 6), C = new Float64Array(n * 3), T = new Uint32Array(n);
  for (let t = 0; t < n; t++) {
    T[t] = t;
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let k = 0; k < 3; k++) {
      const v = idx ? idx.getX(t * 3 + k) : t * 3 + k, x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    const q = t * 6; B[q] = x0; B[q + 1] = y0; B[q + 2] = z0; B[q + 3] = x1; B[q + 4] = y1; B[q + 5] = z1; C[t * 3] = (x0 + x1) / 2; C[t * 3 + 1] = (y0 + y1) / 2; C[t * 3 + 2] = (z0 + z1) / 2;
  }
  const NB = [], NI = [];             // węzły: prostopadłościan (6 liczb) i [lewy, prawy, początek, liczba] (liść: lewy = -1)
  const make = (s, e) => {
    const id = NI.length / 4; NI.push(-1, -1, s, e - s);
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity, c0 = [Infinity, Infinity, Infinity], c1 = [-Infinity, -Infinity, -Infinity];
    for (let i = s; i < e; i++) {
      const t = T[i], b = t * 6;
      if (B[b] < x0) x0 = B[b]; if (B[b + 1] < y0) y0 = B[b + 1]; if (B[b + 2] < z0) z0 = B[b + 2];
      if (B[b + 3] > x1) x1 = B[b + 3]; if (B[b + 4] > y1) y1 = B[b + 4]; if (B[b + 5] > z1) z1 = B[b + 5];
      for (let a = 0; a < 3; a++) { const c = C[t * 3 + a]; if (c < c0[a]) c0[a] = c; if (c > c1[a]) c1[a] = c; }
    }
    const pad = 1e-5 * Math.max(1, x1 - x0, y1 - y0, z1 - z0);   // zapas: trójkąt leżący na ściance pudełka nie wypada z testu
    NB.push(x0 - pad, y0 - pad, z0 - pad, x1 + pad, y1 + pad, z1 + pad);
    if (e - s <= LEAF) return id;
    // podział w połowie rozpiętości środków trójkątów wzdłuż najdłuższej osi (gdy wszystko po jednej stronie – po połowie listy)
    let ax = 0; for (let a = 1; a < 3; a++) if (c1[a] - c0[a] > c1[ax] - c0[ax]) ax = a;
    const mid = (c0[ax] + c1[ax]) / 2;
    let i = s, j = e - 1;
    while (i <= j) { if (C[T[i] * 3 + ax] < mid) i++; else { const x = T[i]; T[i] = T[j]; T[j] = x; j--; } }
    let m = i; if (m === s || m === e) m = (s + e) >> 1;
    const l = make(s, m), r = make(m, e);
    NI[id * 4] = l; NI[id * 4 + 1] = r;
    return id;
  };
  make(0, n);
  return { n, B: new Float64Array(NB), I: new Int32Array(NI), T, idx: !!idx, count: idx ? idx.count : pos.count };
}

// promień (lokalny) przecina prostopadłościan węzła w części t >= 0 (oś z zerowym kierunkiem: tylko sprawdzenie, czy początek jest w pasie)
function hitsBox(B, k, o, d, inv) {
  let t0 = 0, t1 = Infinity;
  for (let a = 0; a < 3; a++) {
    const lo = B[k + a], hi = B[k + 3 + a];
    if (d[a] === 0) { if (o[a] < lo || o[a] > hi) return false; continue; }
    let p = (lo - o[a]) * inv[a], q = (hi - o[a]) * inv[a]; if (p > q) { const x = p; p = q; q = x; }
    if (p > t0) t0 = p; if (q < t1) t1 = q; if (t0 > t1) return false;
  }
  return true;
}

// ---- test trójkąta: wiernie jak checkGeometryIntersection / checkIntersection w three.js r170 (Mesh.js) ----
const _vA = new THREE.Vector3(), _vB = new THREE.Vector3(), _vC = new THREE.Vector3(), _pt = new THREE.Vector3(), _pw = new THREE.Vector3();
function hitTri(obj, mat, raycaster, ray, uv, uv1, normal, a, b, c) {
  obj.getVertexPosition(a, _vA); obj.getVertexPosition(b, _vB); obj.getVertexPosition(c, _vC);
  const r = mat.side === THREE.BackSide ? ray.intersectTriangle(_vC, _vB, _vA, true, _pt) : ray.intersectTriangle(_vA, _vB, _vC, mat.side === THREE.FrontSide, _pt);
  if (r === null) return null;
  _pw.copy(_pt).applyMatrix4(obj.matrixWorld);
  const distance = raycaster.ray.origin.distanceTo(_pw);
  if (distance < raycaster.near || distance > raycaster.far) return null;
  const hit = { distance, point: _pw.clone(), object: obj };
  const bary = new THREE.Vector3(); THREE.Triangle.getBarycoord(_pt, _vA, _vB, _vC, bary);
  if (uv) hit.uv = THREE.Triangle.getInterpolatedAttribute(uv, a, b, c, bary, new THREE.Vector2());
  if (uv1) hit.uv1 = THREE.Triangle.getInterpolatedAttribute(uv1, a, b, c, bary, new THREE.Vector2());
  if (normal) { hit.normal = THREE.Triangle.getInterpolatedAttribute(normal, a, b, c, bary, new THREE.Vector3()); if (hit.normal.dot(ray.direction) > 0) hit.normal.multiplyScalar(-1); }
  const face = { a, b, c, normal: new THREE.Vector3(), materialIndex: 0 };
  THREE.Triangle.getNormal(_vA, _vB, _vC, face.normal);
  hit.face = face; hit.barycoord = bary;
  return hit;
}

const STACK = [], FOUND = [];
function computeIntersections(raycaster, intersects, ray) {
  const geo = this.geometry, mat = this.material, tree = TREES.get(geo), dr = geo.drawRange;
  if (!tree || Array.isArray(mat) || dr.start !== 0 || dr.count !== Infinity || (geo.index ? geo.index.count : geo.attributes.position.count) !== tree.count)
    return THREE.Mesh.prototype._computeIntersections.call(this, raycaster, intersects, ray);
  const { B, I, T } = tree, idx = geo.index, uv = geo.attributes.uv, uv1 = geo.attributes.uv1, normal = geo.attributes.normal;
  const o = [ray.origin.x, ray.origin.y, ray.origin.z], d = [ray.direction.x, ray.direction.y, ray.direction.z], inv = [1 / d[0], 1 / d[1], 1 / d[2]];
  FOUND.length = 0; STACK.length = 0; STACK.push(0);
  while (STACK.length) {
    const nd = STACK.pop();
    if (!hitsBox(B, nd * 6, o, d, inv)) continue;
    const l = I[nd * 4];
    if (l >= 0) { STACK.push(I[nd * 4 + 1], l); continue; }
    for (let i = I[nd * 4 + 2], e = i + I[nd * 4 + 3]; i < e; i++) {
      const t = T[i], j = t * 3;
      const a = idx ? idx.getX(j) : j, b = idx ? idx.getX(j + 1) : j + 1, c = idx ? idx.getX(j + 2) : j + 2;
      const hit = hitTri(this, mat, raycaster, ray, uv, uv1, normal, a, b, c);
      if (hit) { hit.faceIndex = t; FOUND.push(hit); }
    }
  }
  if (FOUND.length > 1) FOUND.sort((p, q) => p.faceIndex - q.faceIndex);   // kolejność jak w three.js (rosnący numer trójkąta)
  for (const h of FOUND) intersects.push(h);
  FOUND.length = 0;
}

// Podpina szybkie trafienia do siatki (zwraca true, gdy się udało). Geometria nie może się potem zmieniać
// (drzewo liczone raz; przy zmianie liczby wierzchołków/indeksów siatka sama wraca do zwykłego Raycastera).
export function przyspieszPromien(mesh) {
  if (!mesh || !mesh.isMesh || mesh.isSkinnedMesh || mesh.isInstancedMesh || Array.isArray(mesh.material)) return false;
  const geo = mesh.geometry; if (!geo || !geo.attributes.position) return false;
  if (geo.morphAttributes && Object.keys(geo.morphAttributes).length) return false;
  const n = (geo.index ? geo.index.count : geo.attributes.position.count) / 3; if (n < MIN_TRIS) return false;
  if (!TREES.has(geo)) TREES.set(geo, build(geo));
  mesh._computeIntersections = computeIntersections;
  return true;
}
