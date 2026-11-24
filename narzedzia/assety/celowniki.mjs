// Bronie z celownikami w lepszej jakości: odbudowa modelu z wersji sprzed odchudzania (odchudz-bronie.mjs ściął tekstury
// do 384 px i uprościł siatkę M4A1 – znak kolimatora zniknął, a drobne części celowników się rozmyły).
//  • tekstury materiałów z celownikiem (SIGHT) zostają w 1024 px, pozostałe → 512 px (zamiast 384), WebP,
//  • siatka: bez upraszczania albo z bardzo małym błędem (opcja ratio), meshopt + kwantyzacja jak wcześniej,
//  • węzły części (mag / slide / pump) bez zmian – kotwice w zrodla/weapons/<id>.js dalej pasują.
// Użycie: node celowniki.mjs <id> <źródło: plik <id>-glb.js sprzed odchudzania> [ratio=1] [tekstura_reszty=512]
// Źródło sprzed odchudzania: git show 587f74a:zrodla/weapons/<id>-glb.js > /tmp/<id>-glb.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, meshopt, dequantize, weld, simplify } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(here, '../../zrodla/weapons');
// materiały, na których są celowniki (kolimator M4A1 z szybką i znakiem; MP5K: komora z przeziernikiem i muszką)
const SIGHT = { m4a1: ['material'], mp5k: ['material'] };
const [id, srcFile, ratioArg = '1', restArg = '512'] = process.argv.slice(2);
if (!id || !srcFile) throw new Error('Użycie: node celowniki.mjs <id> <źródło-glb.js> [ratio] [tekstura_reszty]');
const RATIO = +ratioArg, REST = +restArg;

await MeshoptDecoder.ready; await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const tris = (doc) => { let n = 0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) { const ix = p.getIndices(), po = p.getAttribute('POSITION'); n += Math.round((ix ? ix.getCount() : po.getCount()) / 3); } return n; };
const b64 = (f) => { const m = fs.readFileSync(f, 'utf8').match(/export default '([A-Za-z0-9+/=]+)'/); if (!m) throw new Error('nie rozpoznaję ' + f); return Buffer.from(m[1], 'base64'); };

const doc = await io.readBinary(new Uint8Array(b64(srcFile)));
const t0 = tris(doc);
await doc.transform(dequantize());
if (RATIO < 1) await doc.transform(weld({ tolerance: 0.00005 }), simplify({ simplifier: MeshoptSimplifier, ratio: RATIO, error: 0.0004, lockBorder: true }));
// tekstury: rozmiar zależnie od materiału (celownik 1024 px, reszta REST px)
const keep = new Set(SIGHT[id] || []);
for (const tex of doc.getRoot().listTextures()) {
  const mats = tex.listParents().filter((p) => p.propertyType === 'Material').map((m) => m.getName());
  const isNormal = doc.getRoot().listMaterials().some((m) => m.getNormalTexture() === tex);
  const T = mats.some((n) => keep.has(n)) ? 1024 : REST;
  const img = tex.getImage(); if (!img) continue;
  const out = await sharp(Buffer.from(img)).resize(T, T, { fit: 'inside', withoutEnlargement: true }).webp({ quality: isNormal ? 82 : 78, effort: 6 }).toBuffer();
  tex.setImage(new Uint8Array(out)).setMimeType('image/webp');
}
await doc.transform(prune(), dedup(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
const out = await io.writeBinary(doc);
const target = path.join(DIR, id + '-glb.js'), cur = fs.readFileSync(target, 'utf8'), head = cur.match(/^([\s\S]*?export default ')/)[1];
fs.writeFileSync(target, head + Buffer.from(out).toString('base64') + "';\n");
console.log(`${id}: ${(out.byteLength / 1024).toFixed(0)} KB, trójkąty ${t0} -> ${tris(doc)}, tekstury celownika 1024 px, reszta ${REST} px`);
