// Пререндер статического HTML первого экрана: главная, все категории и товары, справочные страницы.
// Данные — из data/snapshot.json (обновляется: npm run snapshot). Цены и остатки в HTML скрыты до запуска скрипта
// (они зависят от региона покупателя), их подставляет приложение из живого API.
// Запуск после сборки клиента и SSR-бандла: node scripts/prerender.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const { render } = await import(pathToFileURL(path.join(root, 'dist-ssr/entry-server.js')).href);
const snap = JSON.parse(fs.readFileSync(path.join(root, 'data/snapshot.json'), 'utf8'));
const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const legal = JSON.parse(fs.readFileSync(path.join(root, 'public/assets/assets/content/legal_docs_links.json'), 'utf8'));
const SITE = 'https://lite-pack.ru';

const TITLES = {
  'user-agreement': 'Пользовательское соглашение', 'privacy-policy': 'Политика конфиденциальности', 'personal-data-policy': 'Согласие на обработку персональных данных',
  'marketing-communications': 'Согласие на рекламную рассылку', 'public-offer-individuals': 'Публичная оферта для физ. лиц', 'public-offer-companies': 'Публичная оферта для юрид. лиц', 'cookie-policy': 'Политика использования cookie',
};
const legalDocs = Object.keys(TITLES).filter((k) => legal[k]).map((k) => ({ key: k, title: TITLES[k], url: legal[k] }));

const sortCats = (list) => [...list].sort((a, b) => a.order - b.order).map((c) => ({ ...c, subCategories: c.subCategories?.length ? sortCats(c.subCategories) : [] }));
const tree = sortCats(snap.categoryTree);
const byId = new Map();
const parents = new Map();
const walk = (list, parent) => list.forEach((c) => { byId.set(c.id, c); parents.set(c.id, parent); walk(c.subCategories, c); });
walk(tree, null);
const leafProducts = new Map(snap.leafCategories.map((l) => [l.id, l.productIds]));
const productCategory = new Map();
for (const l of snap.leafCategories) for (const pid of l.productIds) if (!productCategory.has(pid)) productCategory.set(pid, l.id);

const base = { 'cat:tree:all': tree, settings: snap.settings, legal: legalDocs, faq: snap.faq };

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (s, n = 300) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const crumbsOf = (id) => { const out = []; let c = byId.get(id); while (c) { out.unshift(c); c = parents.get(c.id); } return out; };
const breadcrumbsLd = (items) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: SITE + it.path })) });

function page(html, seo) {
  const title = seo.title ? `${seo.title} — Лайт Пак` : 'Лайт Пак';
  const desc = clip(seo.description || 'Производство и продажа упаковки');
  const url = SITE + seo.path;
  let out = template
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(desc)}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(seo.title || 'Лайт-Пак')}" />`)
    .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${esc(url)}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(desc)}" />`)
    .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${esc(url)}" />`);
  if (seo.image) out = out.replace(/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${esc(seo.image)}" />`);
  if (seo.jsonLd) out = out.replace('</head>', `<script type="application/ld+json" id="jsonld">${JSON.stringify(seo.jsonLd).replace(/</g, '\\u003c')}</script>\n</head>`);
  if (seo.preload) out = out.replace('</head>', `${seo.preload}\n</head>`);
  return out.replace(/<div id="root">[\s\S]*?<\/div>\s*<\/div>\s*<noscript>/, `<div id="root" data-ssr>${html}</div>\n  <noscript>`);
}

function write(urlPath, html) {
  const file = urlPath === '/' ? path.join(dist, 'index.html') : path.join(dist, urlPath, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

const t0 = Date.now();
let count = 0;
// Те же правила, что в src/lib/img.ts: улучшенная копия /pimg/…, иначе сервис ресайза
const PIMG = fs.existsSync(path.join(dist, 'pimg/1000'));
const pimgId = (u) => (PIMG && u && (u.match(/^https:\/\/storage\.yandexcloud\.net\/[^/]+\/(?:products|categories)\/([0-9a-f]{32})(?:\.(?:png|jpe?g|webp))?$/i) || [])[1]?.toLowerCase()) || null;
const BASE = process.env.VITE_BASE || '/'; // сайт в подпапке (демо на SourceCraft)
const bigImg = (u) => (pimgId(u) ? `${BASE}pimg/1000/${pimgId(u)}.webp` : `/506,fit/${esc(u)}`);
const cardSrcSet = (u) => (pimgId(u) ? `${BASE}pimg/480/${pimgId(u)}.webp 480w, ${bigImg(u)} 1000w` : `/180,fit/${esc(u)} 180w, ${bigImg(u)} 506w`);
const imgPreload = (u) => (u && /^https:\/\/storage\.yandexcloud\.net\//.test(u) ? `<link rel="preload" as="image" href="${bigImg(u)}" fetchpriority="high">` : '');

// Категории
for (const [id, c] of byId) {
  const pids = leafProducts.get(id);
  const products = (pids ?? []).map((pid) => snap.products[pid]).filter(Boolean);
  const data = c.subCategories.length
    ? { mode: 'tree', category: c, categories: c.subCategories, products: [] }
    : { mode: 'products', category: { ...c, subCategories: [], products: [] }, categories: [], products };
  const path_ = `/category/${id}`;
  const crumbs = [{ name: 'Каталог', path: '/' }, ...crumbsOf(id).map((x) => ({ name: x.title, path: `/category/${x.id}` }))];
  const html = await render(path_, { ...base, [`cat:${id}:all`]: data });
  const first = products.find((p) => !p.outOfStock && p.quantityOfUnitsLeft > 0);
  write(path_, page(html, {
    title: c.title,
    description: `${c.title} — купить в интернет-магазине Лайт-Пак${products.length ? `: ${products.length} товаров с ценами и наличием` : ''}. Производство и продажа упаковки.`,
    path: path_, image: c.imageUrl, jsonLd: breadcrumbsLd(crumbs),
    preload: first?.info.imageUrls[0] ? `<link rel="preload" as="image" imagesrcset="${cardSrcSet(first.info.imageUrls[0])}" imagesizes="(min-width: 1280px) 220px, (min-width: 768px) 30vw, 45vw" fetchpriority="high">` : '',
  }));
  count++;
}

// Товары
for (const [id, p] of Object.entries(snap.products)) {
  const d = snap.productDetails[id] ?? {};
  const product = { ...p, properties: d.properties ?? [], brands: d.brands ?? [], plants: d.plants ?? [] };
  const path_ = `/product/${id}`;
  const html = await render(path_, { ...base, [`product:${id}:all`]: product });
  const catId = productCategory.get(id);
  const crumbs = [{ name: 'Каталог', path: '/' }, ...(catId ? crumbsOf(catId).map((x) => ({ name: x.title, path: `/category/${x.id}` })) : []), { name: p.info.title, path: path_ }];
  write(path_, page(html, {
    title: p.info.title,
    description: p.info.short || p.info.description || `${p.info.title} — купить в Лайт-Пак`,
    path: path_, image: p.info.imageUrls[0],
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'Product', name: p.info.title, description: p.info.description || undefined, image: p.info.imageUrls, sku: id, brand: product.brands[0] ? { '@type': 'Brand', name: product.brands[0].title } : undefined },
      breadcrumbsLd(crumbs),
    ],
    preload: imgPreload(p.info.imageUrls[0]),
  }));
  count++;
}

// Справочные страницы и главная (главная — последней: перезаписывает dist/index.html)
const statics = [
  ['/faq', { title: 'Частые вопросы', description: (snap.faq?.items ?? []).map((i) => i.title).join(' ') }],
  ['/podbor', { title: 'Подбор упаковки', description: 'Консультант Лайт-Пак: ответьте на три вопроса — соберём комплект упаковки для суши, пиццы, фастфуда, супов, десертов и кофе с ценами вашего региона.' }],
];
for (const [p, seo] of statics) {
  write(p, page(await render(p, base), { ...seo, path: p }));
  count++;
}
const homeLd = { '@context': 'https://schema.org', '@type': 'Organization', name: snap.settings.companyDetails.name, url: SITE, logo: 'https://storage.yandexcloud.net/litepack-staging/assets/logo.png', telephone: snap.settings.companyDetails.phone, email: snap.settings.contactUs?.email, sameAs: [snap.settings.contactUs?.vk_0].filter(Boolean) };
fs.writeFileSync(path.join(dist, 'app.html'), template); // чистый шаблон SPA для остальных маршрутов
write('/', page(await render('/', base), { path: '/', description: 'Производство и продажа упаковки', jsonLd: homeLd }));
count++;
console.log(`prerender: ${count} страниц за ${((Date.now() - t0) / 1000).toFixed(1)} с`);
