// Prosty serwer plików do podglądu map Vice: node narzedzia/podglad-serwer.mjs [port]
// Otwórz http://localhost:8123/zrodla/podglad-map.html?map=sunset  (albo ?map=downtown)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = +(process.argv[2] || process.env.PORT || 8123);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.css': 'text/css', '.svg': 'image/svg+xml' };
// strona podglądu wysyła tu pomiary (POST /__raport?map=...) – zapis do %TEMP%/vice-raport-<mapa>.json (narzędzia i zrzuty bez okna)
const REPORT_DIR = process.env.VICE_RAPORT_DIR || (await import('node:os')).tmpdir();
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (req.method === 'POST' && p === '/__raport') {
    let body = ''; req.on('data', (d) => { body += d; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      const m = (new URL(req.url, 'http://x').searchParams.get('map') || 'mapa').replace(/[^a-z0-9_-]/gi, '');
      try { fs.writeFileSync(path.join(REPORT_DIR, `vice-raport-${m}.json`), body); console.log('RAPORT', m, body.slice(0, 400)); } catch (e) { console.error(e); }
      res.writeHead(204); res.end();
    });
    return;
  }
  if (p === '/') p = '/zrodla/podglad-map.html';
  const f = path.join(root, p);
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.stat(f, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('404 ' + p); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
}).listen(port, () => console.log(`podgląd map: http://localhost:${port}/zrodla/podglad-map.html?map=sunset`));
