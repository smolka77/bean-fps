// Walidator map Vice (Deathmatch): node narzedzia/sprawdz-mapy.mjs [sunset] [downtown] [--json]
// Sprawdza dane, z których korzystają gra i serwer (zrodla/<mapa>-data.js):
//  - budżet: trójkąty (≤ 350 tys.), siatki (draw calls ≤ 100), liczba brył kolizji, wysokości (serwer: y > 30 = poza mapą)
//  - spawny: ≥ 24, nie w ścianie, stoją na podłożu, żaden nie widzi innego (linie od oka do sylwetki, w obie strony)
//  - dostępność (2,5D, siatka 0,5 m, fizyka gracza: stopień 0,5 m, skok ~1 m, drabiny, zeskok): czy da się dojść wszędzie,
//    czy żadne miejsce na ziemi nie jest zamknięte, czy nie da się wyjść poza obszar gry
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), asJson = args.includes('--json');
const names = args.filter((a) => !a.startsWith('--'));
if (!names.length) names.push('sunset', 'downtown');

const R = 0.3, HEAD = 1.75, STEP = 0.5, JUMP = 1.0, CELL = 0.5, EYE = 1.3;
let exitCode = 0;
for (const name of names) {
  const file = path.join(root, 'zrodla', name.toLowerCase() + '-data.js');
  if (!fs.existsSync(file)) { console.log(`\n== ${name}: brak pliku ${file}`); exitCode = 1; continue; }
  const t0 = Date.now();
  const mod = await import(pathToFileURL(file).href + '?t=' + Date.now());
  const V = mod.VICE, D = mod.MAP, out = { name: D.name, errors: [], warns: [], info: [] };
  const E = (s) => out.errors.push(s), W = (s) => out.warns.push(s), I = (s) => out.info.push(s);
  // ---------- budżet ----------
  const G = V.geometry();
  const chans = {}; for (const b of G.bufs) { chans[b.chan] = chans[b.chan] || { meshes: 0, tris: 0 }; chans[b.chan].meshes++; chans[b.chan].tris += b.tris; }
  const meshes = G.bufs.length + 3 + (V.env && V.env.ocean ? 1 : 0);
  const kb = (f) => (fs.statSync(f).size / 1024).toFixed(1);
  I(`trójkąty: ${G.tris.toLocaleString('pl-PL')} (op ${chans.op?.tris || 0}, cut ${chans.cut?.tris || 0}, far ${chans.far?.tris || 0}, glow ${chans.glow?.tris || 0})`);
  I(`siatki (maks. draw calls mapy): ${meshes}  [op ${chans.op?.meshes || 0}, cut ${chans.cut?.meshes || 0}, far ${chans.far?.meshes || 0}, glow ${chans.glow?.meshes || 0}, + niebo/ziemia/ocean]`);
  I(`kolizje: ${D.colliders.length}, clipy: ${D.clips.length}, drabiny: ${D.ladders.length}, spawny: ${D.spawns.length}, cienie (dodatkowe): ${G.casters.length}`);
  I(`plik mapy: ${kb(file)} KB; vice-kit.js ${kb(path.join(root, 'zrodla/vice-kit.js'))} KB; vice-render.js ${kb(path.join(root, 'zrodla/vice-render.js'))} KB`);
  if (G.tris > 350000) E(`za dużo trójkątów: ${G.tris} > 350 000`); else if (G.tris > 250000) W(`dużo trójkątów: ${G.tris}`);
  if (meshes > 100) E(`za dużo siatek: ${meshes} > 100`);
  if (D.colliders.length > 1200) W(`dużo brył kolizji: ${D.colliders.length} (fizyka klienta sprawdza wszystkie co klatkę)`);
  const bx = Math.max(...D.colliders.map((c) => Math.max(-c[0], c[3]))), bz = Math.max(...D.colliders.map((c) => Math.max(-c[2], c[5])));
  I(`granice serwera (z kolizji): |x| ≤ ${bx.toFixed(1)}, |z| ≤ ${bz.toFixed(1)}; obszar gry ${V.bounds.join(', ')}`);
  for (const c of D.colliders) { if (c.some((v) => !Number.isFinite(v))) E('kolizja z NaN: ' + c); if (c[3] - c[0] < 0.01 || c[4] - c[1] < 0.01 || c[5] - c[2] < 0.01) W('bardzo cienka bryła: ' + c); }
  // ---------- siatka przestrzenna brył ----------
  const C2 = 2, grid = new Map();
  D.colliders.forEach((b, i) => { for (let x = Math.floor(b[0] / C2); x <= Math.floor(b[3] / C2); x++) for (let z = Math.floor(b[2] / C2); z <= Math.floor(b[5] / C2); z++) { const k = x * 100000 + z; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); } });
  const mov = D.colliders.concat(D.clips);   // ruch gracza: kolizje + clipy
  const gridM = new Map(); mov.forEach((b, i) => { for (let x = Math.floor(b[0] / C2); x <= Math.floor(b[3] / C2); x++) for (let z = Math.floor(b[2] / C2); z <= Math.floor(b[5] / C2); z++) { const k = x * 100000 + z; if (!gridM.has(k)) gridM.set(k, []); gridM.get(k).push(i); } });
  const near = (g, list, x, z, r) => { const s = new Set(); for (let a = Math.floor((x - r) / C2); a <= Math.floor((x + r) / C2); a++) for (let b = Math.floor((z - r) / C2); b <= Math.floor((z + r) / C2); b++) { const l = g.get(a * 100000 + b); if (l) for (const i of l) s.add(i); } return [...s].map((i) => list[i]); };
  const boxT = (o, d, b) => { let t0 = 0, t1 = Infinity; for (let k = 0; k < 3; k++) { const oo = o[k], dd = d[k], lo = b[k], hi = b[k + 3]; if (Math.abs(dd) < 1e-12) { if (oo < lo || oo > hi) return Infinity; continue; } let a = (lo - oo) / dd, c = (hi - oo) / dd; if (a > c) [a, c] = [c, a]; if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) return Infinity; } return t0; };
  const clear = (a, b) => {          // linia a->b bez kolizji (jak kule na serwerze; clipy nie zatrzymują)
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d); if (L < 1e-6) return true; const u = d.map((v) => v / L);
    const n = Math.ceil(L / 1.5); const seen = new Set();
    for (let k = 0; k <= n; k++) { const x = a[0] + (d[0] * k) / n, z = a[2] + (d[2] * k) / n; for (const bb of near(grid, D.colliders, x, z, 1.6)) { if (seen.has(bb)) continue; seen.add(bb); if (boxT(a, u, bb) < L - 0.05) return false; } }
    return true;
  };
  const blocked = (x, y, z, list = mov, g = gridM) => near(g, list, x, z, R + 0.05).some((b) => b[1] < y + HEAD && b[4] > y + 0.06 && x > b[0] - R && x < b[3] + R && z > b[2] - R && z < b[5] + R);
  // ---------- spawny ----------
  const S = D.spawns;
  if (S.length < 24) E(`za mało spawnów: ${S.length} < 24`);
  for (const s of S) {
    if (s.x < V.bounds[0] || s.x > V.bounds[2] || s.z < V.bounds[1] || s.z > V.bounds[3]) E(`spawn ${s.name} poza obszarem gry (${s.x}, ${s.z})`);
    if (blocked(s.x, s.y || 0, s.z)) E(`spawn ${s.name} w ścianie / bryle (${s.x}, ${s.y || 0}, ${s.z})`);
    const y = s.y || 0; if (y > 0.01) { const sup = near(grid, D.colliders, s.x, s.z, 0.1).some((b) => Math.abs(b[4] - y) < 0.06 && s.x > b[0] - 0.1 && s.x < b[3] + 0.1 && s.z > b[2] - 0.1 && s.z < b[5] + 0.1); if (!sup) E(`spawn ${s.name} wisi w powietrzu (y = ${y})`); }
  }
  let visPairs = 0; const visList = [];
  for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
    const A = S[i], B = S[j], dist = Math.hypot(A.x - B.x, A.z - B.z);
    if (dist > 140) continue;
    const pts = (P) => { const y = P.y || 0; return [[P.x, y + 1.45, P.z], [P.x, y + 1.0, P.z], [P.x + 0.3, y + 1.0, P.z], [P.x - 0.3, y + 1.0, P.z], [P.x, y + 1.0, P.z + 0.3], [P.x, y + 1.0, P.z - 0.3], [P.x, y + 0.3, P.z]]; };
    const eye = (P) => [P.x, (P.y || 0) + EYE, P.z];
    const sees = pts(B).some((p) => clear(eye(A), p)) || pts(A).some((p) => clear(eye(B), p));
    if (sees) { visPairs++; visList.push(`${A.name}↔${B.name} (${dist.toFixed(0)} m)`); }
  }
  if (visPairs) E(`spawny widzą się nawzajem: ${visPairs} par: ${visList.slice(0, 30).join(', ')}${visList.length > 30 ? '…' : ''}`);
  // rozrzut spawnów: siatka 3×3 obszaru gry
  { const [x0, z0, x1, z1] = V.bounds, cnt = Array(9).fill(0); for (const s of S) { const i = Math.min(2, Math.floor(((s.x - x0) / (x1 - x0)) * 3)), j = Math.min(2, Math.floor(((s.z - z0) / (z1 - z0)) * 3)); cnt[j * 3 + i]++; } I(`spawny w siatce 3×3 (wiersze od -Z): ${[0, 1, 2].map((j) => cnt.slice(j * 3, j * 3 + 3).join(' ')).join(' | ')}`); if (cnt.some((c) => c === 0)) W('pusta komórka 3×3 bez spawnu (nierówny rozkład)'); }
  // ---------- dostępność 2,5D ----------
  const [bx0, bz0, bx1, bz1] = V.bounds, M = 6;
  const X0 = bx0 - M, Z0 = bz0 - M, NX = Math.ceil((bx1 - bx0 + 2 * M) / CELL), NZ = Math.ceil((bz1 - bz0 + 2 * M) / CELL);
  const nodes = [], cellNodes = new Map();      // węzeł: { i, j, y }
  const tops = (x, z) => { const ys = [0]; for (const b of near(gridM, mov, x, z, 0.05)) if (x > b[0] && x < b[3] && z > b[2] && z < b[5]) ys.push(b[4]); return [...new Set(ys.map((v) => Math.round(v * 1000) / 1000))]; };
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const x = X0 + (i + 0.5) * CELL, z = Z0 + (j + 0.5) * CELL, list = [];
    for (const y of tops(x, z)) { if (y > 40) continue; if (!blocked(x, y, z)) { list.push(nodes.length); nodes.push({ i, j, y, x, z }); } }
    if (list.length) cellNodes.set(j * NX + i, list);
  }
  const ladderLinks = [];
  for (const l of D.ladders) {
    const [x0, y0, z0, x1, y1, z1, nx, nz] = l, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, top = y1 - 0.35;
    const findNode = (x, z, y, tol, r) => { let best = -1, bd = 1e9; for (let dj = -Math.ceil(r / CELL); dj <= Math.ceil(r / CELL); dj++) for (let di = -Math.ceil(r / CELL); di <= Math.ceil(r / CELL); di++) { const i = Math.floor((x - X0) / CELL) + di, j = Math.floor((z - Z0) / CELL) + dj, L = cellNodes.get(j * NX + i); if (!L) continue; for (const n of L) { const N = nodes[n], d = Math.hypot(N.x - x, N.z - z); if (Math.abs(N.y - y) <= tol && d <= r && d < bd) { bd = d; best = n; } } } return best; };
    const bot = findNode(cx + nx * 0.6, cz + nz * 0.6, y0, 0.3, 1.0), up = findNode(cx - nx * 0.6, cz - nz * 0.6, top, 0.3, 1.2);
    if (bot < 0 || up < 0) W(`drabina przy (${cx.toFixed(1)}, ${cz.toFixed(1)}) do ${top.toFixed(2)} m: brak miejsca ${bot < 0 ? 'na dole' : 'na górze (lądowanie)'}`);
    else ladderLinks.push([bot, up]);
  }
  const adj = (n) => {
    const N = nodes[n], res = [];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const L = cellNodes.get((N.j + dj) * NX + N.i + di); if (!L) continue;
      if (di && dj) { const a = cellNodes.get(N.j * NX + N.i + di), b = cellNodes.get((N.j + dj) * NX + N.i); if (!a || !b) continue; }   // bez przenikania po skosie przez narożnik
      for (const m of L) { const dy = nodes[m].y - N.y; if (dy <= STEP + 1e-3 || (dy <= JUMP && !blocked(N.x, N.y + JUMP, N.z))) res.push(m); }   // stopień, skok albo zeskok
    }
    return res;
  };
  const ladderAdj = new Map(); for (const [a, b] of ladderLinks) { (ladderAdj.get(a) || ladderAdj.set(a, []).get(a)).push(b); (ladderAdj.get(b) || ladderAdj.set(b, []).get(b)).push(a); }
  const reach = new Uint8Array(nodes.length), q = [];
  for (const s of S) { const i = Math.floor((s.x - X0) / CELL), j = Math.floor((s.z - Z0) / CELL), L = cellNodes.get(j * NX + i); if (!L) continue; let best = -1; for (const n of L) if (Math.abs(nodes[n].y - (s.y || 0)) < 0.6) best = n; if (best >= 0 && !reach[best]) { reach[best] = 1; q.push(best); } }
  while (q.length) { const n = q.pop(); for (const m of adj(n).concat(ladderAdj.get(n) || [])) if (!reach[m]) { reach[m] = 1; q.push(m); } }
  // wyjście poza obszar gry
  const leak = nodes.filter((N, k) => reach[k] && (N.x < bx0 - 0.5 || N.x > bx1 + 0.5 || N.z < bz0 - 0.5 || N.z > bz1 + 0.5));
  if (leak.length) E(`da się wyjść poza obszar gry (${leak.length} komórek), np. ${leak.slice(0, 5).map((N) => `(${N.x.toFixed(1)}, ${N.y.toFixed(1)}, ${N.z.toFixed(1)})`).join(' ')}`);
  const tooHigh = nodes.filter((N, k) => reach[k] && N.y > 27); if (tooHigh.length) E(`osiągalne miejsca wyżej niż 27 m (serwer odrzuca y > 30): ${tooHigh.length}`);
  // spójne obszary nieosiągalne (bez przenikania pionowego)
  const seen = new Uint8Array(nodes.length), comps = [];
  for (let k = 0; k < nodes.length; k++) {
    if (reach[k] || seen[k]) continue; const N0 = nodes[k]; if (N0.x < bx0 || N0.x > bx1 || N0.z < bz0 || N0.z > bz1) continue;
    const st = [k]; seen[k] = 1; let n = 0, minY = 1e9, maxY = -1e9, sx = 0, sz = 0;
    while (st.length) { const a = st.pop(), A = nodes[a]; n++; minY = Math.min(minY, A.y); maxY = Math.max(maxY, A.y); sx += A.x; sz += A.z; for (const m of adj(a)) if (!reach[m] && !seen[m] && Math.abs(nodes[m].y - A.y) <= STEP) { seen[m] = 1; st.push(m); } }
    comps.push({ area: n * CELL * CELL, minY, maxY, x: sx / n, z: sz / n });
  }
  const ground = comps.filter((c) => c.minY < 0.6 && c.area >= 3).sort((a, b) => b.area - a.area);
  const high = comps.filter((c) => c.minY >= 0.6 && c.area >= 8).sort((a, b) => b.area - a.area);
  if (ground.length) E(`zamknięte miejsca na ziemi, do których nie da się dojść: ${ground.slice(0, 12).map((c) => `${c.area.toFixed(0)} m² przy (${c.x.toFixed(0)}, ${c.z.toFixed(0)})`).join('; ')}`);
  if (high.length) I(`nieosiągalne powierzchnie wyżej (dachy dekoracyjne, gzymsy – OK, jeśli celowo): ${high.slice(0, 16).map((c) => `${c.area.toFixed(0)} m² y≈${c.minY.toFixed(1)} przy (${c.x.toFixed(0)}, ${c.z.toFixed(0)})`).join('; ')}`);
  const reachArea = reach.reduce((a, b) => a + b, 0) * CELL * CELL, levels = {};
  nodes.forEach((N, k) => { if (reach[k]) { const b = N.y < 0.6 ? 'ziemia' : N.y < 3 ? '0,6–3 m' : N.y < 6 ? '3–6 m' : N.y < 10 ? '6–10 m' : '10+ m'; levels[b] = (levels[b] || 0) + CELL * CELL; } });
  I(`powierzchnia osiągalna: ${reachArea.toFixed(0)} m² (${Object.entries(levels).map(([k, v]) => `${k}: ${v.toFixed(0)}`).join(', ')})`);
  const unreachedSpawns = S.filter((s) => { const i = Math.floor((s.x - X0) / CELL), j = Math.floor((s.z - Z0) / CELL), L = cellNodes.get(j * NX + i) || []; return !L.some((n) => reach[n]); });
  if (unreachedSpawns.length) E(`spawny bez miejsca do stania: ${unreachedSpawns.map((s) => s.name).join(', ')}`);
  // ---------- najdłuższe otwarte linie strzału (informacyjnie) ----------
  const reachNodes = nodes.filter((N, k) => reach[k] && N.y < 0.6 && ((N.i * 7 + N.j * 13) % 97 === 0));
  let longest = []; for (const N of reachNodes) for (let a = 0; a < 16; a++) {
    const ang = (a / 16) * Math.PI * 2, o = [N.x, N.y + EYE, N.z], d = [Math.sin(ang), 0, Math.cos(ang)];
    let t = 0; for (; t < 150; t += 2) { const p = [o[0] + d[0] * t, o[1], o[2] + d[2] * t]; if (p[0] < bx0 || p[0] > bx1 || p[2] < bz0 || p[2] > bz1) break; if (!clear([o[0] + d[0] * Math.max(0, t - 2), o[1], o[2] + d[2] * Math.max(0, t - 2)], p)) break; }
    longest.push({ t, x: N.x, z: N.z, ang: Math.round((ang * 180) / Math.PI) });
  }
  longest.sort((a, b) => b.t - a.t);
  I(`najdłuższe otwarte linie na wysokości oczu: ${longest.slice(0, 6).map((l) => `${l.t} m z (${l.x.toFixed(0)}, ${l.z.toFixed(0)}) kier. ${l.ang}°`).join('; ')}`);
  const lens = longest.map((l) => l.t); I(`rozkład linii (próbki ${lens.length}): mediana ${lens[lens.length >> 1] || 0} m, >60 m: ${lens.filter((v) => v > 60).length}, >90 m: ${lens.filter((v) => v > 90).length}`);
  out.ms = Date.now() - t0;
  if (out.errors.length) exitCode = 1;
  if (asJson) console.log(JSON.stringify(out, null, 1));
  else {
    console.log(`\n================ ${D.name} (${out.ms} ms) ================`);
    for (const s of out.info) console.log('  · ' + s);
    for (const s of out.warns) console.log('  ! UWAGA: ' + s);
    for (const s of out.errors) console.log('  ✗ BŁĄD: ' + s);
    if (!out.errors.length) console.log('  ✓ bez błędów');
  }
}
process.exit(exitCode);
