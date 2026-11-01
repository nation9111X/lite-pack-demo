// Улучшение фото товаров: качественное масштабирование (Lanczos), адаптивная резкость, WebP в двух размерах.
// Никакой «дорисовки» нейросетью: цвета, надписи и форма товара не меняются.
//   node enhance-images.mjs                 — все фото из data/snapshot.json
//   node enhance-images.mjs --only <id,...> — отдельные фото (имя файла без расширения)
// Результат: public/pimg/{480,1000}/<id>.webp (в git не хранится, собирается перед деплоем).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(root, 'tools/.cache/orig');
const OUT = path.join(root, 'public/pimg');
const SIZES = [480, 1000];
const MAX_UP = 2.5; // сильнее увеличивать нет смысла — появляется «мыло»
fs.mkdirSync(CACHE, { recursive: true });
for (const s of SIZES) fs.mkdirSync(path.join(OUT, String(s)), { recursive: true });

const snap = JSON.parse(fs.readFileSync(path.join(root, 'data/snapshot.json'), 'utf8'));
// Фото товаров и картинки категорий — те же правила, что в src/lib/img.ts
const STORAGE_ID = /^https:\/\/storage\.yandexcloud\.net\/[^/]+\/(?:products|categories)\/[0-9a-f]{32}(?:\.(?:png|jpe?g|webp))?$/i;
let urls = [...new Set(JSON.stringify(snap).match(/https:\/\/storage\.yandexcloud\.net\/[^"]+/g))].filter((u) => STORAGE_ID.test(u));
const onlyIdx = process.argv.indexOf('--only');
if (onlyIdx > 0) {
  const ids = new Set(process.argv[onlyIdx + 1].split(','));
  urls = urls.filter((u) => ids.has(path.basename(u).replace(/\.\w+$/, '')));
}
const force = process.argv.includes('--force');

const idOf = (u) => path.basename(new URL(u).pathname).replace(/\.\w+$/, '').toLowerCase();

async function original(u) {
  const file = path.join(CACHE, path.basename(new URL(u).pathname));
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return fs.readFileSync(file);
  for (let t = 0; t < 4; t++) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(file, buf);
      return buf;
    } catch (e) {
      if (t === 3) throw e;
      await new Promise((res) => setTimeout(res, 1500 * (t + 1)));
    }
  }
}

async function enhance(u) {
  const id = idOf(u);
  const targets = SIZES.map((s) => ({ s, file: path.join(OUT, String(s), id + '.webp') }));
  if (!force && targets.every((t) => fs.existsSync(t.file))) return 'skip';
  const buf = await original(u);
  const meta = await sharp(buf).metadata();
  const long = Math.max(meta.width ?? 0, meta.height ?? 0);
  if (!long) throw new Error('нет размеров');
  const isCategory = /\/categories\//.test(u);
  const opts = { limitInputPixels: 80e6 };
  // Прозрачный фон: резкость только по цвету (поверх белого), а маска прозрачности — простым Lanczos и без потерь.
  // Иначе резкость «звенит» по краю маски и вокруг товара появляется пунктирная обводка.
  const flat = meta.hasAlpha ? await sharp(buf, opts).rotate().flatten({ background: '#ffffff' }).toColourspace('srgb').png().toBuffer() : null;
  const alphaSrc = meta.hasAlpha ? await sharp(buf, opts).rotate().ensureAlpha().extractChannel(3).png().toBuffer() : null;
  for (const { s, file } of targets) {
    const target = Math.min(s, Math.round(long * MAX_UP));
    const f = target / long;
    const resize = { width: target, height: target, fit: 'inside', kernel: sharp.kernel.lanczos3, withoutEnlargement: false };
    let img;
    if (isCategory) {
      // картинки разделов лежат на цветных плитках — только масштаб, без резкости
      img = sharp(buf, opts).rotate().resize(resize);
    } else {
      img = sharp(flat ?? buf, opts).rotate().resize(resize).toColourspace('srgb');
      // Резкость: при увеличении сильнее (компенсирует размытие интерполяции), при уменьшении — лёгкая
      img = f > 1 ? img.sharpen({ sigma: 0.55 + 0.3 * Math.min(f, MAX_UP), m1: 0.8, m2: 2.4 }) : img.sharpen({ sigma: 0.5, m1: 0.6, m2: 1.6 });
      if (alphaSrc) {
        const rgb = await img.removeAlpha().png().toBuffer();
        const { width, height } = await sharp(rgb).metadata();
        const alpha = await sharp(alphaSrc).resize(width, height, { fit: 'fill', kernel: sharp.kernel.lanczos3 }).toColourspace('b-w').raw().toBuffer();
        img = sharp(rgb).joinChannel(alpha, { raw: { width, height, channels: 1 } });
      }
    }
    await img.webp({ quality: 85, alphaQuality: 100, effort: 5, smartSubsample: true }).toFile(file);
  }
  return long < 600 ? 'up' : 'ok';
}

const t0 = Date.now();
const stats = { ok: 0, up: 0, skip: 0, err: 0 };
let i = 0;
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (i < urls.length) {
      const u = urls[i++];
      try {
        stats[await enhance(u)]++;
      } catch (e) {
        stats.err++;
        console.log('ошибка', u.slice(-40), String(e.message || e).slice(0, 80));
      }
      const done = stats.ok + stats.up + stats.skip + stats.err;
      if (done % 200 === 0) console.log(`${done}/${urls.length}`, JSON.stringify(stats), `${((Date.now() - t0) / 1000).toFixed(0)} с`);
    }
  }),
);
const bytes = SIZES.map((s) => fs.readdirSync(path.join(OUT, String(s))).reduce((a, f) => a + fs.statSync(path.join(OUT, String(s), f)).size, 0));
console.log('готово', JSON.stringify(stats), `за ${((Date.now() - t0) / 1000).toFixed(0)} с;`, SIZES.map((s, k) => `${s}px: ${(bytes[k] / 1e6).toFixed(0)} МБ`).join(', '));
