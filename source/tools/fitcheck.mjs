// Проверка: помещается ли фото товара целиком в рамку (галерея, карточки) — особенно высокие и широкие.
//   node fitcheck.mjs http://localhost:5191
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.argv[2] || 'http://localhost:5191';
const snap = JSON.parse(fs.readFileSync('../data/snapshot.json', 'utf8'));
const audit = new Map(JSON.parse(fs.readFileSync('../data/image-audit.json', 'utf8')).map((x) => [x.u, x]));
const prods = Object.values(snap.products).filter((p) => audit.get(p.info.imageUrls[0])?.w > 0);
const ratio = (p) => { const a = audit.get(p.info.imageUrls[0]); return a.h / a.w; };
const tall = prods.filter((p) => ratio(p) > 2.2).slice(0, 4);
const wide = prods.filter((p) => ratio(p) < 0.45).slice(0, 3);
const dichlo = prods.find((p) => /Дихлофос "НЕО \+" без спирта 190/.test(p.info.title));
const sample = [dichlo, ...tall, ...wide].filter(Boolean);

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU' });
await ctx.route((u) => /(^|\.)(mc|mdd)\.yandex\.(ru|net)$/.test(u.hostname), (r) => r.abort());
await ctx.addInitScript(() => { localStorage.setItem('lp.cookieAccepted', 'true'); localStorage.setItem('lp.regionSkipped', 'true'); });
const p = await ctx.newPage();
const fit = (sel) => p.evaluate((sel) => [...document.querySelectorAll(sel)].map((img) => {
  const box = img.parentElement.getBoundingClientRect();
  // реальный размер картинки внутри элемента с учётом object-fit: contain
  const r = img.getBoundingClientRect();
  const k = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
  const w = img.naturalWidth * k, h = img.naturalHeight * k;
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const out = Math.max(box.left - (cx - w / 2), (cx + w / 2) - box.right, box.top - (cy - h / 2), (cy + h / 2) - box.bottom, 0);
  return { ok: out < 1, out: Math.round(out), el: `${Math.round(r.width)}×${Math.round(r.height)}`, box: `${Math.round(box.width)}×${Math.round(box.height)}` };
}).filter((x) => x.el !== '0×0'), sel);
let bad = 0;
for (const pr of sample) {
  await p.goto(`${base}/product/${pr.id}`, { waitUntil: 'load' });
  await p.waitForFunction(() => document.querySelector('.gallery__stage img')?.complete && document.querySelector('.gallery__stage img').naturalWidth > 0, null, { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(400);
  const [g] = await fit('.gallery__stage img');
  if (!g?.ok) bad++;
  console.log(g?.ok ? 'OK ' : 'ОБРЕЗ', 'h/w', ratio(pr).toFixed(2), 'выход', g?.out, 'px', g?.el, 'в рамке', g?.box, '—', pr.info.title.slice(0, 40));
}
// карточки в категории с высокими товарами (дихлофос)
const leaf = snap.leafCategories.find((c) => c.productIds.includes(dichlo?.id))?.id;
if (leaf) {
  await p.goto(`${base}/category/${leaf}`, { waitUntil: 'load' });
  for (let i = 0; i < 8; i++) { await p.mouse.wheel(0, 900); await p.waitForTimeout(200); }
  await p.waitForTimeout(800);
  const cards = await fit('.pcard__media img');
  console.log('карточки:', cards.length, 'обрезано:', cards.filter((x) => !x.ok).length, cards.filter((x) => !x.ok).slice(0, 3));
  bad += cards.filter((x) => !x.ok).length;
}
console.log(bad ? `ИТОГ: обрезано ${bad}` : 'ИТОГ: всё помещается');
await b.close();
