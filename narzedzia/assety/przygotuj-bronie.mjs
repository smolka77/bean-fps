// Bronie do gry: modele GLB (Sketchfab, CC-BY 4.0 – autorzy w README) i dźwięki (WAV) → moduły w zrodla/weapons/.
//
// Użycie (raz: npm install w tym folderze):
//   node przygotuj-bronie.mjs                 – modele i dźwięki wszystkich broni
//   node przygotuj-bronie.mjs akm deagle      – tylko wybrane bronie (modele + dźwięki)
//   node przygotuj-bronie.mjs --bez-dzwiekow  – tylko modele      (--bez-modeli: tylko dźwięki)
//   node przygotuj-bronie.mjs --raport        – dodatkowo: lista spójnych kawałków siatki (do ustawiania pudełek części)
//   node przygotuj-bronie.mjs --glb <folder>  – dodatkowo: gotowe GLB do podglądu
// Źródła: BRONIE_MODELE (domyślnie ~/Downloads) i BRONIE_DZWIEKI (domyślnie ~/Downloads/beangta sound library/…/sound).
//
// Co robi z modelem:
//  1. „wypieka” transformacje węzłów (i szkielet – SPAS-12 jest skórowany) do wierzchołków,
//  2. ustawia broń jak w grze: metry, lufa w −Z, góra +Y, prawa strona +X, początek = prawa dłoń na chwycie,
//  3. dzieli siatkę na spójne kawałki i odkłada ruchome części (magazynek, zamek, czółenko) do osobnych węzłów
//     „mag” / „slide” / „pump” – kawałek należy do części, jeśli środek jego pudełka leży w pudełku części,
//  4. tekstury → WebP (najwyżej 1024 px), siatka → meshopt (jak mapy), wynik w base64 → zrodla/weapons/<id>-glb.js.
// Dźwięki: wybrane pliki WAV → MP3 (mono, 44,1 kHz) w base64 → zrodla/weapons/<id>-snd.js.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, textureCompress, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import ffmpeg from 'ffmpeg-static';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '../../zrodla/weapons');
const MODELE = process.env.BRONIE_MODELE || path.join(os.homedir(), 'Downloads');
const DZWIEKI = process.env.BRONIE_DZWIEKI || path.join(os.homedir(), 'Downloads', 'beangta sound library', 'beangta sound library', 'sound');

// ---------------- konfiguracja broni ----------------
// rotY: obrót wokół osi pionowej [°] ustawiający lufę w −Z; length: długość całkowita [m] (pudełko wzdłuż Z);
// origin: prawa dłoń na chwycie w układzie „wyśrodkowanym” (środek pudełka modelu = 0) [m];
// parts: pudełka [x0,y0,z0,x1,y1,z1] w układzie końcowym (początek = dłoń) – kawałki siatki ze środkiem w pudełku idą do części.
// drop: pudełka kawałków do usunięcia; tex: największy rozmiar tekstur; gold: pozłacanie metalu (patrz goldify niżej).
const AKM = { src: 'akm.glb', rotY: 90, length: 0.88, origin: [-0.0038, 0.017, 0.157], tex: 1024,
  parts: { mag: [-1, -1, -0.277, 1, 0.023, -0.067], slide: [0.0208, 0.063, -0.197, 0.0338, 0.073, -0.177] } };              // magazynek, kula rączki zamka
export const WEAPONS = {
  akm: AKM,
  akmgold: { ...AKM, gold: { color: [236, 186, 84], rough: 0.2, woodRough: 0.42, woodMetal: 0.12 } },                     // złoty AKM: ten sam model, metal pozłacany
  m4a1: { src: 'assault_rifle_m4a1.glb', rotY: 180, length: 0.84, origin: [-0.0008, -0.025, 0.136], tex: 1024,
    parts: { mag: [-1, -1, -0.186, 1, 0.02, -0.066] },
    drop: [-1, 0.108, -0.416, 1, 0.155, -0.296] },                                                                       // oświetlacz na szynie zasłaniał kolimator
  glock17: { src: '9mm_pistol.glb', rotY: -90, length: 0.186, origin: [0, 0.002, 0.05], tex: 1024,
    parts: { slide: [-1, 0.033, -2, 1, 2, 2], mag: [-0.009, -0.072, -0.03, 0.009, -0.007, 0.05] } },
  deagle: { src: 'desert_eagle.glb', rotY: 180, length: 0.27, origin: [0, 0.004, 0.0705], tex: 1024,
    parts: { slide: [-1, 0.036, -2, 1, 2, 2], mag: [-0.013, -0.054, -0.0105, 0.013, -0.004, 0.0075] } },
  spas12: { src: 'half-life_2_rtx_shotgun_spas-12.glb', rotY: 180, length: 0.82, origin: [-0.0065, -0.045, 0.367], tex: 1024,
    parts: { pump: { joint: [49] } } },                                                                                  // czółenko: kość „joint47” szkieletu
  mp5k: { src: 'mp5k.glb', rotY: 0, length: 0.325, origin: [0.0061, -0.025, 0.111], tex: 1024,
    parts: { mag: [-0.0161, -0.025, -0.171, 0.0139, 0.015, -0.146] } },
};

// ---------------- macierze (kolumnowe, jak w glTF) ----------------
const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };
const tp = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
const td = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z];
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

// ---------------- 1. wypiekanie: lista prymitywów z wierzchołkami w układzie świata ----------------
const KEEP = ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0', 'TEXCOORD_1', 'COLOR_0'];
function bake(doc) {
  const out = [];
  for (const scene of doc.getRoot().listScenes()) scene.traverse((node) => {
    const mesh = node.getMesh(); if (!mesh) return;
    const skin = node.getSkin(), W = node.getWorldMatrix();
    let jm = null;
    if (skin) {                                                    // macierze stawów: świat(staw) · odwrotność wiązania
      const ibm = skin.getInverseBindMatrices(), el = new Array(16);
      jm = skin.listJoints().map((j, i) => { const b = ibm ? ibm.getElement(i, el).slice() : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; return mul(j.getWorldMatrix(), b); });
    }
    for (const prim of mesh.listPrimitives()) {
      if (prim.getMode() !== 4) continue;                          // tylko trójkąty
      const P = prim.getAttribute('POSITION'), n = P.getCount(), A = {};
      for (const k of KEEP) { const a = prim.getAttribute(k); if (a) A[k] = { type: a.getType(), size: a.getElementSize(), data: new Float32Array(n * a.getElementSize()) }; }
      const J = skin && prim.getAttribute('JOINTS_0'), Wt = skin && prim.getAttribute('WEIGHTS_0');
      const e = [], ej = [], ew = [], jt = J ? new Int16Array(n) : null;   // jt: staw o największej wadze (podział po kościach)
      for (let i = 0; i < n; i++) {
        let M = W;
        if (jm && J && Wt) {
          J.getElement(i, ej); Wt.getElement(i, ew); M = new Array(16).fill(0);
          for (let k = 0; k < 4; k++) { const w = ew[k]; if (!w) continue; const m = jm[ej[k]]; for (let q = 0; q < 16; q++) M[q] += w * m[q]; }
          let b = 0; for (let k = 1; k < 4; k++) if (ew[k] > ew[b]) b = k; jt[i] = ej[b];
        }
        for (const k in A) {
          prim.getAttribute(k).getElement(i, e); const s = A[k].size, d = A[k].data;
          let v = e.slice(0, s);
          if (k === 'POSITION') v = tp(M, v[0], v[1], v[2]);
          else if (k === 'NORMAL') v = norm(td(M, v[0], v[1], v[2]));
          else if (k === 'TANGENT') v = [...norm(td(M, v[0], v[1], v[2])), v[3]];
          for (let q = 0; q < s; q++) d[i * s + q] = v[q];
        }
      }
      const I = prim.getIndices(), idx = I ? Uint32Array.from(I.getArray()) : Uint32Array.from({ length: n }, (_, i) => i);
      // macierz z ujemnym wyznacznikiem odwraca kolejność wierzchołków trójkąta
      const det = M3det(W); if (!jm && det < 0) for (let t = 0; t < idx.length; t += 3) { const x = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = x; }
      out.push({ material: prim.getMaterial(), A, idx, jt, name: mesh.getName() || node.getName() });
    }
  });
  return out;
}
const M3det = (m) => m[0] * (m[5] * m[10] - m[9] * m[6]) - m[4] * (m[1] * m[10] - m[9] * m[2]) + m[8] * (m[1] * m[6] - m[5] * m[2]);

// ---------------- 2. ustawienie: obrót, skala, początek w dłoni ----------------
function align(prims, cfg) {
  const a = cfg.rotY * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const rot = (x, y, z) => [x * c + z * s, y, -x * s + z * c];
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of prims) {
    const P = p.A.POSITION.data;
    for (let i = 0; i < P.length; i += 3) { const v = rot(P[i], P[i + 1], P[i + 2]); P[i] = v[0]; P[i + 1] = v[1]; P[i + 2] = v[2]; for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); } }
    for (const k of ['NORMAL', 'TANGENT']) { const D = p.A[k]; if (!D) continue; const st = D.size; for (let i = 0; i < D.data.length; i += st) { const v = rot(D.data[i], D.data[i + 1], D.data[i + 2]); D.data[i] = v[0]; D.data[i + 1] = v[1]; D.data[i + 2] = v[2]; } }
  }
  const k = cfg.length / (hi[2] - lo[2]), ctr = lo.map((v, i) => (v + hi[i]) / 2), o = cfg.origin;
  for (const p of prims) { const P = p.A.POSITION.data; for (let i = 0; i < P.length; i += 3) for (let q = 0; q < 3; q++) P[i + q] = (P[i + q] - ctr[q]) * k - o[q]; }
  return { scale: k, size: hi.map((v, i) => (v - lo[i]) * k) };
}

// ---------------- 3. spójne kawałki i części ----------------
function components(p) {
  const P = p.A.POSITION.data, n = P.length / 3, key = new Map(), weld = new Int32Array(n);
  for (let i = 0; i < n; i++) { const kk = `${Math.round(P[i * 3] * 2e4)},${Math.round(P[i * 3 + 1] * 2e4)},${Math.round(P[i * 3 + 2] * 2e4)}`; let id = key.get(kk); if (id === undefined) { id = key.size; key.set(kk, id); } weld[i] = id; }
  const par = Int32Array.from({ length: key.size }, (_, i) => i), f = (x) => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
  const I = p.idx;
  for (let t = 0; t < I.length; t += 3) { const a = f(weld[I[t]]), b = f(weld[I[t + 1]]), c = f(weld[I[t + 2]]); par[b] = a; par[f(c)] = a; }
  const comp = new Map();
  for (let t = 0; t < I.length; t += 3) {
    const r = f(weld[I[t]]); let C = comp.get(r);
    if (!C) comp.set(r, C = { tris: [], lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity] });
    C.tris.push(t);
    for (let q = 0; q < 3; q++) { const v = I[t + q]; for (let k = 0; k < 3; k++) { C.lo[k] = Math.min(C.lo[k], P[v * 3 + k]); C.hi[k] = Math.max(C.hi[k], P[v * 3 + k]); } }
  }
  return [...comp.values()].map((C) => ({ ...C, c: C.lo.map((v, k) => (v + C.hi[k]) / 2) }));
}
const inBox = (c, b) => c[0] >= b[0] && c[1] >= b[1] && c[2] >= b[2] && c[0] <= b[3] && c[1] <= b[4] && c[2] <= b[5];
const boxes = (b) => (Array.isArray(b[0]) ? b : [b]);

// podzbiór trójkątów prymitywu → nowe tablice (tylko użyte wierzchołki)
function subset(p, tris) {
  const remap = new Map(), idx = new Uint32Array(tris.length * 3); let n = 0;
  tris.forEach((t, j) => { for (let q = 0; q < 3; q++) { const v = p.idx[t + q]; let r = remap.get(v); if (r === undefined) { r = n++; remap.set(v, r); } idx[j * 3 + q] = r; } });
  const A = {};
  for (const k in p.A) { const s = p.A[k].size, d = new Float32Array(n * s); for (const [v, r] of remap) for (let q = 0; q < s; q++) d[r * s + q] = p.A[k].data[v * s + q]; A[k] = { ...p.A[k], data: d }; }
  return { material: p.material, A, idx };
}

// ---------------- pozłacanie ----------------
// Szary (mało nasycony) metal z tekstury koloru → złoto z zachowaniem jasności (rysy, zużycie, napisy); nasycone drewno
// zostaje. Mapa metal/chropowatość od nowa: złoto gładkie i w pełni metaliczne, drewno lakierowane, prawie niemetaliczne
// (kanał R = okluzja zostaje). AKM ma metaliczność 1 na całej teksturze, więc metal od drewna odróżnia dopiero kolor.
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
async function goldify(doc, G) {
  for (const m of doc.getRoot().listMaterials()) {
    const bt = m.getBaseColorTexture(); if (!bt) continue;
    const base = sharp(Buffer.from(bt.getImage())), { width: W, height: H } = await base.metadata(), n = W * H;
    const px = await base.ensureAlpha().raw().toBuffer();
    const mrT = m.getMetallicRoughnessTexture();
    const mr = mrT ? await sharp(Buffer.from(mrT.getImage())).resize(W, H).ensureAlpha().raw().toBuffer() : null;
    const ob = Buffer.alloc(n * 3), om = Buffer.alloc(n * 3);
    for (let i = 0; i < n; i++) {
      const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2], mx = Math.max(r, g, b), s = mx ? (mx - Math.min(r, g, b)) / mx : 0;
      const k = 1 - smooth(0.16, 0.32, s);                                     // 1 = metal (szary), 0 = drewno
      const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255, f = Math.min(1.2, Math.max(0.3, 0.42 + 1.55 * L));
      for (let c = 0; c < 3; c++) ob[i * 3 + c] = Math.round(px[i * 4 + c] + (Math.min(255, G.color[c] * f) - px[i * 4 + c]) * k);
      om[i * 3] = mr ? mr[i * 4] : 255;
      om[i * 3 + 1] = Math.round(255 * (G.woodRough + (G.rough - G.woodRough) * k));
      om[i * 3 + 2] = Math.round(255 * (G.woodMetal + (1 - G.woodMetal) * k));
    }
    const png = (buf) => sharp(buf, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
    bt.setImage(await png(ob)).setMimeType('image/png');
    const mt = mrT || doc.createTexture('mr');
    mt.setImage(await png(om)).setMimeType('image/png');
    if (!mrT) m.setMetallicRoughnessTexture(mt);
    m.setRoughnessFactor(1).setMetallicFactor(1);
  }
}

// ---------------- model ----------------
async function buildModel(id, cfg, io, opt) {
  const doc = await io.read(path.join(MODELE, cfg.src));
  if (cfg.gold) await goldify(doc, cfg.gold);
  const root = doc.getRoot(), buffer = root.listBuffers()[0] || doc.createBuffer();
  const prims = bake(doc), info = align(prims, cfg);
  const groups = { body: [] }, report = [];
  for (const name in cfg.parts) groups[name] = [];
  const byJoint = Object.entries(cfg.parts).filter(([, s]) => s.joint), byBox = Object.entries(cfg.parts).filter(([, s]) => !s.joint);
  for (let p of prims) {
    // części wyznaczone kośćmi szkieletu: trójkąty, których wszystkie wierzchołki zależą głównie od podanych stawów
    if (p.jt && byJoint.length) {
      const pj = {}, rest = [];
      for (let t = 0; t < p.idx.length; t += 3) {
        const js = [p.jt[p.idx[t]], p.jt[p.idx[t + 1]], p.jt[p.idx[t + 2]]], hit = byJoint.find(([, s]) => js.every((j) => s.joint.includes(j)));
        if (hit) (pj[hit[0]] || (pj[hit[0]] = [])).push(t); else rest.push(t);
      }
      for (const name in pj) groups[name].push(subset(p, pj[name]));
      p = subset(p, rest);
    }
    const comps = components(p), pick = {};
    for (const C of comps) {
      let to = 'body';
      if (cfg.drop && boxes(cfg.drop).some((b) => inBox(C.c, b))) to = null;
      else for (const [name, s] of byBox) if (boxes(s).some((b) => inBox(C.c, b))) { to = name; break; }
      if (opt.raport) report.push({ mat: p.material && p.material.getName(), tris: C.tris.length, to, c: C.c.map((v) => +v.toFixed(4)), lo: C.lo.map((v) => +v.toFixed(4)), hi: C.hi.map((v) => +v.toFixed(4)) });
      if (to) (pick[to] || (pick[to] = [])).push(...C.tris);
    }
    for (const name in pick) groups[name].push(subset(p, pick[name].sort((a, b) => a - b)));
  }
  // stara scena precz, nowe węzły: body / mag / slide / pump (prymitywy z tym samym materiałem połączone)
  const scene = root.listScenes()[0];
  for (const n of root.listNodes()) n.dispose();
  for (const s of root.listSkins()) s.dispose();
  for (const m of root.listMeshes()) m.dispose();
  for (const a of root.listAnimations()) a.dispose();
  for (const name in groups) {
    if (!groups[name].length) continue;
    const byMat = new Map();
    for (const g of groups[name]) { const L = byMat.get(g.material) || []; L.push(g); byMat.set(g.material, L); }
    const mesh = doc.createMesh(name);
    for (const [mat, L] of byMat) {
      const prim = doc.createPrimitive().setMaterial(mat);
      const keys = Object.keys(L[0].A).filter((k) => L.every((g) => g.A[k]));
      let off = 0; const total = L.reduce((s, g) => s + g.A.POSITION.data.length / 3, 0), ni = L.reduce((s, g) => s + g.idx.length, 0);
      const idx = total > 65535 ? new Uint32Array(ni) : new Uint16Array(ni); let io2 = 0;
      for (const g of L) { for (const v of g.idx) idx[io2++] = v + off; off += g.A.POSITION.data.length / 3; }
      for (const k of keys) {
        const s = L[0].A[k].size, d = new Float32Array(total * s); let o = 0;
        for (const g of L) { d.set(g.A[k].data, o); o += g.A[k].data.length; }
        prim.setAttribute(k, doc.createAccessor().setType(L[0].A[k].type).setArray(d).setBuffer(buffer));
      }
      prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(idx).setBuffer(buffer));
      mesh.addPrimitive(prim);
    }
    scene.addChild(doc.createNode(name).setMesh(mesh));
  }
  root.getAsset().extras = { ...(root.getAsset().extras || {}), bron: id };
  await doc.transform(prune(), dedup());
  // tekstury: normalne łagodniej (artefakty WebP na mapach normalnych są widoczne w odbiciach)
  const T = cfg.tex || 1024;
  await doc.transform(
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [T, T], slots: /^(?!normalTexture).*$/, quality: 82, effort: 80 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [T, T], slots: /^normalTexture$/, quality: 88, effort: 80 }),
  );
  await MeshoptEncoder.ready;
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const glb = await io.writeBinary(doc);
  return { glb, info, report, groups: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.reduce((s, g) => s + g.idx.length / 3, 0)])) };
}

// ---------------- dźwięki ----------------
// klucz → plik(i) z biblioteki (warianty losowane w grze). shot = strzał z bliska, far = z daleka (inni gracze).
export const SOUNDS = {
  akm: { shot: ['ak47/ak47_01.wav'], far: ['ak47/ak47_distant.wav'], draw: 'ak47/ak47_draw.wav', magOut: 'ak47/ak47_clipout.wav', magIn: 'ak47/ak47_clipin.wav', bolt: 'ak47/ak47_boltpull.wav' },
  m4a1: { shot: ['m4a1/m4a1_01.wav', 'm4a1/m4a1_02.wav', 'm4a1/m4a1_03.wav', 'm4a1/m4a1_04.wav'], far: ['m4a1/m4a1_distant_01.wav'], draw: 'm4a1/m4a1_draw.wav',
    magOut: 'm4a1/m4a1_clipout.wav', magIn: 'm4a1/m4a1_clipin.wav', magHit: 'm4a1/m4a1_cliphit.wav', bolt: 'm4a1/m4a1_boltback.wav', boltFwd: 'm4a1/m4a1_boltforward.wav' },
  glock17: { shot: ['glock18/glock_01.wav', 'glock18/glock_02.wav'], far: ['glock18/glock18-1-distant.wav'], draw: 'glock18/glock_draw.wav',
    magOut: 'glock18/glock_clipout.wav', magIn: 'glock18/glock_clipin.wav', bolt: 'glock18/glock_slideback.wav', boltFwd: 'glock18/glock_sliderelease.wav' },
  deagle: { shot: ['deagle/deagle_01.wav', 'deagle/deagle_02.wav'], far: ['deagle/deagle-1-distant.wav'], draw: 'deagle/de_draw.wav',
    magOut: 'deagle/de_clipout.wav', magIn: 'deagle/de_clipin.wav', bolt: 'deagle/de_slideback.wav', boltFwd: 'deagle/de_slideforward.wav' },
  spas12: { shot: ['nova/nova-1.wav'], far: ['nova/nova-1-distant.wav'], draw: 'nova/nova_draw.wav', pump: 'nova/nova_pump.wav',
    shell: ['nova/nova_insertshell_01.wav', 'nova/nova_insertshell_02.wav', 'nova/nova_insertshell_03.wav', 'nova/nova_insertshell_04.wav'] },
  mp5k: { shot: ['mp5/mp5_01.wav'], far: ['mp7/mp7-1-distant.wav'], draw: 'mp5/mp5_draw.wav', magOut: 'mp5/mp5_clipout.wav', magIn: 'mp5/mp5_clipin.wav',
    bolt: 'mp5/mp5_slideback.wav', boltFwd: 'mp5/mp5_slideforward.wav' },
  // wspólne: suchy spust, zmiana broni
  _wspolne: { dryPistol: 'clipempty_pistol.wav', dryRifle: 'clipempty_rifle.wav' },
};
const MAX_LEN = { shot: 1.6, far: 1.8 };                           // dłuższe ogony ucinamy (z wyciszeniem)
function mp3(file, maxLen) {
  const src = path.join(DZWIEKI, 'weapons', file);
  if (!fs.existsSync(src)) throw new Error('Brak pliku dźwięku: ' + src);
  const af = maxLen ? ['-af', `atrim=0:${maxLen},afade=t=out:st=${(maxLen - 0.25).toFixed(2)}:d=0.25`] : [];
  return execFileSync(ffmpeg, ['-v', 'error', '-i', src, ...af, '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', maxLen ? '96k' : '80k', '-f', 'mp3', 'pipe:1'], { maxBuffer: 64 << 20 });
}
function buildSounds(id) {
  const S = SOUNDS[id], out = {}; let bytes = 0;
  for (const k in S) { const list = [].concat(S[k]).map((f) => { const b = mp3(f, MAX_LEN[k]); bytes += b.length; return b.toString('base64'); }); out[k] = list; }
  return { out, bytes };
}

// ---------------- główny program ----------------
const args = process.argv.slice(2), flag = (f) => args.includes(f);
const glbDir = args.includes('--glb') ? args[args.indexOf('--glb') + 1] : null;
const ids = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--glb');
const list = ids.length ? ids : Object.keys(WEAPONS);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
await MeshoptDecoder.ready;
const header = (what, id) => `// ${what} broni „${id}” – plik generowany przez narzedzia/assety/przygotuj-bronie.mjs (nie edytuj ręcznie)\n`;
for (const id of list) {
  const cfg = WEAPONS[id]; if (!cfg) throw new Error('Nieznana broń: ' + id);
  if (!flag('--bez-modeli')) {
    const r = await buildModel(id, cfg, io, { raport: flag('--raport') });
    fs.writeFileSync(path.join(OUT, `${id}-glb.js`), header('Model GLB (meshopt, WebP)', id) + `export default '${Buffer.from(r.glb).toString('base64')}';\n`);
    if (glbDir) { fs.mkdirSync(glbDir, { recursive: true }); fs.writeFileSync(path.join(glbDir, `${id}.glb`), r.glb); }
    if (flag('--raport')) fs.writeFileSync(path.join(glbDir || here, `${id}-raport.json`), JSON.stringify({ info: r.info, groups: r.groups, comps: r.report.sort((a, b) => b.tris - a.tris) }, null, 1));
    console.log(id, 'model', (r.glb.byteLength / 1024).toFixed(0) + ' KB', 'rozmiar [m]', r.info.size.map((v) => v.toFixed(3)).join(' × '), 'części', JSON.stringify(r.groups));
  }
  if (!flag('--bez-dzwiekow') && SOUNDS[id]) {          // akmgold: dźwięki AKM (WEAPON_STATS.snd)
    const s = buildSounds(id);
    fs.writeFileSync(path.join(OUT, `${id}-snd.js`), header('Dźwięki (MP3)', id) + `export default ${JSON.stringify(s.out)};\n`);
    console.log(id, 'dźwięki', (s.bytes / 1024).toFixed(0) + ' KB', Object.keys(s.out).join(','));
  }
}
if (!ids.length && !flag('--bez-dzwiekow')) {
  const s = buildSounds('_wspolne');
  fs.writeFileSync(path.join(OUT, '_wspolne-snd.js'), header('Dźwięki wspólne (MP3)', 'wszystkie') + `export default ${JSON.stringify(s.out)};\n`);
  console.log('wspólne dźwięki', (s.bytes / 1024).toFixed(0) + ' KB');
}
