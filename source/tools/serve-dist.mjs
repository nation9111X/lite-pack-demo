// Продакшен-подобный сервер для замеров: node serve-dist.mjs [port] [--gzip-api]
// Повторяет рекомендуемый nginx-конфиг (docs/nginx.conf): gzip/brotli статики, долгий кэш хешированных файлов,
// SPA-фолбэк на index.html, прокси /api, /static и ресайза картинок на lite-pack.ru.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const port = Number(process.argv[2] || 5193);
const gzipApi = process.argv.includes('--gzip-api');
const cacheImages = process.argv.includes('--cache-images');
const imgCache = new Map();
const rootArg = process.argv.indexOf('--root');
const root = rootArg > 0 ? path.resolve(process.argv[rootArg + 1]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
// Сжатую статику кэшируем, как gzip_static в nginx: иначе замер упирается в сжатие на каждом запросе
const packed = new Map();
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain', '.gif': 'image/gif' };
const COMPRESSIBLE = /text|javascript|json|xml|svg/;

function send(req, res, status, type, buf, headers = {}, key) {
  const ae = req.headers['accept-encoding'] || '';
  if (COMPRESSIBLE.test(type) && buf.length > 1024) {
    const enc = /\bbr\b/.test(ae) ? 'br' : /gzip/.test(ae) ? 'gzip' : null;
    if (enc) {
      const k = key && key + ':' + enc;
      let out = k && packed.get(k);
      if (!out) {
        out = enc === 'br' ? zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: key ? 11 : 5 } }) : zlib.gzipSync(buf, { level: 6 });
        if (k) packed.set(k, out);
      }
      buf = out;
      headers['content-encoding'] = enc;
    }
    headers.vary = 'Accept-Encoding';
  }
  res.writeHead(status, { 'content-type': type, 'content-length': buf.length, ...headers });
  res.end(buf);
}

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const proxied = u.pathname.startsWith('/api/') || u.pathname.startsWith('/static/') || /^\/(80|180|506),fit\//.test(u.pathname);
  if (proxied) {
    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await new Promise((r) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => r(Buffer.concat(c))); });
    const h = { ...req.headers };
    delete h.host; delete h['accept-encoding']; delete h.connection; delete h.origin; delete h.referer;
    const isImg = /^\/(80|180|506),fit\//.test(u.pathname);
    if (cacheImages && isImg && imgCache.has(req.url)) {
      const c = imgCache.get(req.url);
      res.writeHead(200, { 'content-type': c.type, 'content-length': c.buf.length, 'cache-control': 'public, max-age=604800' });
      return res.end(c.buf);
    }
    try {
      const r = await fetch('https://lite-pack.ru' + req.url, { method: req.method, headers: h, body });
      const buf = Buffer.from(await r.arrayBuffer());
      const type = r.headers.get('content-type') || 'application/octet-stream';
      if (cacheImages && isImg && r.ok) imgCache.set(req.url, { type, buf });
      if (gzipApi) return send(req, res, r.status, type, buf);
      res.writeHead(r.status, { 'content-type': type, 'content-length': buf.length });
      return res.end(buf);
    } catch (e) {
      res.writeHead(502); return res.end(String(e));
    }
  }
  let file = path.join(root, decodeURIComponent(u.pathname));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
  const ext = path.extname(file);
  const type = TYPES[ext] || 'application/octet-stream';
  const cache = file.includes(path.sep + 'assets' + path.sep) ? 'public, max-age=31536000, immutable' : ext === '.html' ? 'no-cache' : 'public, max-age=86400';
  const st = fs.statSync(file);
  send(req, res, 200, type, fs.readFileSync(file), { 'cache-control': cache }, file + ':' + st.mtimeMs);
}).listen(port, () => console.log('dist on http://localhost:' + port + (gzipApi ? ' (gzip api)' : '') + (cacheImages ? ' (image cache)' : '')));
