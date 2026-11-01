// Картинки для 3D-коробки на главной: берём изображения первых трёх корневых категорий
// через сервис ресайза lite-pack.ru и сохраняем как WebP в public/hero/ (не зависят от API при загрузке).
// node scripts/hero-images.mjs   (нужен playwright из tools/)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'tools/package.json'));
const { chromium } = require('playwright');

const snap = JSON.parse(fs.readFileSync(path.join(root, 'data/snapshot.json'), 'utf8'));
const roots = [...snap.categoryTree].sort((a, b) => a.order - b.order).slice(0, 3);
fs.mkdirSync(path.join(root, 'public/hero'), { recursive: true });
const b = await chromium.launch();
const p = await b.newPage();
for (const [i, c] of roots.entries()) {
  for (const size of [80, 180]) {
    const r = await fetch(`https://lite-pack.ru/${size},fit/${c.imageUrl}`);
    const data = 'data:image/png;base64,' + Buffer.from(await r.arrayBuffer()).toString('base64');
    const webp = await p.evaluate(async (d) => {
      const img = new Image();
      img.src = d;
      await img.decode();
      const cv = document.createElement('canvas');
      cv.width = img.width;
      cv.height = img.height;
      cv.getContext('2d').drawImage(img, 0, 0);
      return cv.toDataURL('image/webp', 0.86);
    }, data);
    const out = path.join(root, `public/hero/box-${i}-${size}.webp`);
    fs.writeFileSync(out, Buffer.from(webp.split(',')[1], 'base64'));
    console.log(c.title, size, fs.statSync(out).size, 'B');
  }
}
await b.close();
