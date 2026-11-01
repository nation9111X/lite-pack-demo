// Данные демо-версии (src/api/demo.ts) из data/snapshot.json: каталог (json + gzip) и карточки товаров.
//   node scripts/demo-data.mjs — для разработки: данные в tools/.cache/demo, затем VITE_DEMO=1 npm run dev
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function writeDemoData(out) {
  const snap = JSON.parse(fs.readFileSync(path.join(root, 'data/snapshot.json'), 'utf8'));
  fs.mkdirSync(path.join(out, 'p'), { recursive: true });
  const products = {};
  for (const [id, p] of Object.entries(snap.products)) {
    const { description, short, ...info } = p.info;
    const d = snap.productDetails[id] ?? {};
    fs.writeFileSync(path.join(out, 'p', id + '.json'), JSON.stringify({ description, short, properties: d.properties ?? [], brands: d.brands ?? [], plants: d.plants ?? [] }));
    products[id] = {
      id, info: { ...info, description: '', short: '' }, discounts: p.discounts ?? [], chestnyZnak: p.chestnyZnak ?? null, chestnyZnakCategory: p.chestnyZnakCategory ?? null,
      brands: d.brands ?? [], plants: d.plants ?? [], r: snap.priceByRegion[id] ?? {},
    };
  }
  const leaves = Object.fromEntries(snap.leafCategories.map((l) => [l.id, l.productIds]));
  const json = JSON.stringify({
    fetchedAt: snap.fetchedAt, settings: snap.settings, faq: snap.faq, regions: snap.regions, departments: snap.departments,
    deliveryRegions: snap.deliveryRegions ?? [], tree: snap.categoryTree, leaves, products,
  });
  fs.writeFileSync(path.join(out, 'catalog.json'), json);
  // сжатая копия каталога: хостинги без gzip (SourceCraft) отдают 2 МБ JSON медленно
  fs.writeFileSync(path.join(out, 'catalog.bin'), zlib.gzipSync(json, { level: 9 }));
  return { snap, count: Object.keys(products).length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = path.resolve(process.argv[2] || path.join(root, 'tools/.cache/demo'));
  const { count } = writeDemoData(out);
  console.log(`демо-данные: ${out} (${count} товаров)`);
}
