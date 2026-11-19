// Odchudza gotowe modele broni (zrodla/weapons/<id>-glb.js) bez ponownego przygotowania z plików źródłowych:
//  • tekstury → WebP, najwyżej 512 px (bronie z wieloma teksturami: 384 px), mocniejsza kompresja,
//  • siatki z dużą liczbą trójkątów upraszczane (meshoptimizer) do ok. 16 tys. trójkątów na broń przy małym błędzie kształtu,
//  • meshopt + kwantyzacja jak wcześniej; węzły części (mag / slide / pump) i kotwice zostają bez zmian.
// Użycie: node odchudz-bronie.mjs [id ...]   (bez argumentów: wszystkie bronie)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, textureCompress, meshopt, dequantize, weld, simplify } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(here, '../../zrodla/weapons');
const TRI_TARGET = 16000;
const only = process.argv.slice(2);

await MeshoptDecoder.ready; await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const tris = (doc) => { let n = 0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) { const ix = p.getIndices(), po = p.getAttribute('POSITION'); n += Math.round((ix ? ix.getCount() : po.getCount()) / 3); } return n; };

for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith('-glb.js')).sort()) {
  const id = f.slice(0, -7);
  if (only.length && !only.includes(id)) continue;
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');
  const m = src.match(/^([\s\S]*?export default ')([A-Za-z0-9+/=]+)(';\s*)$/);
  if (!m) { console.warn(id, '– nie rozpoznaję pliku, pomijam'); continue; }
  const before = Buffer.from(m[2], 'base64');
  const doc = await io.readBinary(new Uint8Array(before));
  const t0 = tris(doc), nTex = doc.getRoot().listTextures().length, T = nTex > 6 ? 384 : 512;
  await doc.transform(dequantize());
  if (t0 > TRI_TARGET * 1.15) {
    await doc.transform(weld({ tolerance: 0.0001 }), simplify({ simplifier: MeshoptSimplifier, ratio: TRI_TARGET / t0, error: 0.0012, lockBorder: true }));
  }
  await doc.transform(
    prune(), dedup(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [T, T], slots: /^(?!normalTexture).*$/, quality: 72, effort: 90 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [T, T], slots: /^normalTexture$/, quality: 80, effort: 90 }),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),            // 'high': filtry (normalne oktaedryczne, kwaterniony) – mniejsze bufory, ten sam wygląd
  );
  const out = await io.writeBinary(doc);
  fs.writeFileSync(path.join(DIR, f), m[1] + Buffer.from(out).toString('base64') + m[3]);
  console.log(`${id}: ${(before.length / 1024).toFixed(0)} KB -> ${(out.byteLength / 1024).toFixed(0)} KB, trójkąty ${t0} -> ${tris(doc)}, tekstury ${nTex} × ${T}px`);
}
