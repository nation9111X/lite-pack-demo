// Генерация public/sitemap.xml: главная, все категории и товары каталога.
// node scripts/sitemap.mjs            — из живого API
// node scripts/sitemap.mjs --snapshot — из data/snapshot.json (без сети)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://lite-pack.ru';
const API = 'https://lite-pack.ru/api/';
const H = { 'content-type': 'application/json', package: 'lite_pack', system: 'windows', 'app-type': 'web', 'client-id': '', locale: 'ru-RU', 'system-version': '', version: '1.0.18', 'build-number': '70' };

async function fromApi() {
  const a = await (await fetch(API + 'v1/auth/signupAnonymous', { method: 'POST', headers: H, body: JSON.stringify({ appId: 'lite_pack', clientId: null, appType: 'shop' }) })).json();
  const get = async (p) => (await fetch(API + p, { headers: { ...H, authorization: 'Bearer ' + a.accessToken } })).json();
  const tree = (await get('v1/categories')).categories;
  const cats = [];
  const leaves = [];
  const walk = (list) => list.forEach((c) => { cats.push(c.id); c.subCategories?.length ? walk(c.subCategories) : leaves.push(c.id); });
  walk(tree);
  const products = new Set();
  for (const id of leaves) {
    const r = await get(`v1/categories/${id}/products`);
    (r.products ?? []).forEach((p) => products.add(p.id));
  }
  return { cats, products: [...products] };
}

function fromSnapshot() {
  const s = JSON.parse(fs.readFileSync(path.join(root, 'data/snapshot.json'), 'utf8'));
  const cats = [];
  const walk = (list) => list.forEach((c) => { cats.push(c.id); if (c.subCategories?.length) walk(c.subCategories); });
  walk(s.categoryTree);
  return { cats, products: Object.keys(s.products) };
}

const { cats, products } = process.argv.includes('--snapshot') ? fromSnapshot() : await fromApi();
const today = new Date().toISOString().slice(0, 10);
const url = (loc, pr) => `  <url><loc>${SITE}${loc}</loc><lastmod>${today}</lastmod><priority>${pr}</priority></url>`;
const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  url('/', '1.0'),
  ...['/podbor', '/contact-us', '/faq', '/help', '/legal'].map((p) => url(p, '0.4')),
  ...cats.map((id) => url(`/category/${id}`, '0.8')),
  ...products.map((id) => url(`/product/${id}`, '0.6')),
  '</urlset>',
  '',
].join('\n');
fs.writeFileSync(path.join(root, 'public/sitemap.xml'), xml);
console.log(`sitemap.xml: ${cats.length} категорий, ${products.length} товаров`);
