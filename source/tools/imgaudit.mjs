// Аудит исходных фото товаров: разрешение и вес оригиналов (читаем только заголовок PNG/JPEG).
import fs from 'node:fs';

const snap = JSON.parse(fs.readFileSync('../data/snapshot.json', 'utf8'));
const urls = [...new Set(Object.values(snap.products).flatMap((p) => p.info.imageUrls))];
const out = [];
let i = 0;
async function dims(u) {
  const r = await fetch(u, { headers: { Range: 'bytes=0-65535' }, signal: AbortSignal.timeout(20000) });
  const total = Number((r.headers.get('content-range') || '').split('/')[1] || r.headers.get('content-length') || 0);
  const b = Buffer.from(await r.arrayBuffer());
  if (b.slice(1, 4).toString() === 'PNG') return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), type: 'png', bytes: total };
  // JPEG: ищем маркер SOF
  for (let o = 2; o < b.length - 9; ) {
    if (b[o] !== 0xff) { o++; continue; }
    const m = b[o + 1];
    const len = b.readUInt16BE(o + 2);
    if (m >= 0xc0 && m <= 0xc3) return { w: b.readUInt16BE(o + 7), h: b.readUInt16BE(o + 5), type: 'jpeg', bytes: total };
    o += 2 + len;
  }
  return { w: 0, h: 0, type: 'other', bytes: total };
}
await Promise.all(Array.from({ length: 10 }, async () => {
  while (i < urls.length) {
    const u = urls[i++];
    try { out.push({ u, ...(await dims(u)) }); } catch { out.push({ u, w: -1, h: -1, type: 'err', bytes: 0 }); }
  }
}));
fs.writeFileSync('../data/image-audit.json', JSON.stringify(out));
const by = (f) => out.filter(f).length;
const minSide = (x) => Math.min(x.w, x.h);
console.log('всего фото:', out.length);
console.log('< 300 px:', by((x) => x.w > 0 && minSide(x) < 300), '| 300–599:', by((x) => minSide(x) >= 300 && minSide(x) < 600), '| 600–999:', by((x) => minSide(x) >= 600 && minSide(x) < 1000), '| ≥1000:', by((x) => minSide(x) >= 1000), '| ошибки:', by((x) => x.w <= 0));
console.log('типы:', JSON.stringify(out.reduce((a, x) => ((a[x.type] = (a[x.type] || 0) + 1), a), {})));
const mb = out.reduce((s, x) => s + x.bytes, 0) / 1e6;
console.log('суммарный вес оригиналов:', mb.toFixed(0), 'МБ');
