// Скриншоты нового сайта: node shots.mjs <baseUrl> <outDir> [widths] [routes] [--full] [--fresh]
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.argv[2] || 'http://localhost:5190';
const out = process.argv[3] || '../docs/BEFORE_AFTER/after';
const widths = (process.argv[4] || '375,768,1440').split(',').map(Number);
const ROUTES = {
  home: '/',
  category: '/category/a1b2c3d4-e5f6-4000-8000-000000000001',
  leaf: '/category/8b23600b-d61b-415f-85b9-952b011d7932',
  product: '/product/b39464d0c6714472add98099e5794abe',
  search: '/search?q=стакан',
  cart: '/cart',
  contacts: '/contact-us',
  faq: '/faq',
  legal: '/legal',
  profile: '/profile',
  orders: '/orders',
  notfound: '/this-page-does-not-exist',
};
const only = process.argv[5] && !process.argv[5].startsWith('--') ? process.argv[5].split(',') : Object.keys(ROUTES);
const full = process.argv.includes('--full');
const fresh = process.argv.includes('--fresh');
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const blockMetrika = (ctx) => ctx.route((url) => /(^|\.)(mc|mdd)\.yandex\.(ru|net)$/.test(url.hostname), (r) => r.abort());
for (const w of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 800 ? 812 : 900 }, locale: 'ru-RU', isMobile: w < 500, hasTouch: w < 800, deviceScaleFactor: 1 });
  await blockMetrika(ctx);
  if (!fresh) {
    await ctx.addInitScript(() => {
      localStorage.setItem('lp.cookieAccepted', 'true');
      localStorage.setItem('lp.region', JSON.stringify({ name: 'Удмуртия', regionId: 'e02392242878498087b248fe5e21e043', sourceDepartmentIds: ['8a6e7295d4cd4b3784edaf6729255035'] }));
    });
  }
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 90) + ' @' + (m.location()?.url || '').slice(0, 120)));
  page.on('pageerror', (e) => errors.push(String(e)));
  for (const name of only) {
    await page.goto(base + ROUTES[name], { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1200);
    if (full) {
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); });
      await page.waitForTimeout(900);
    }
    await page.screenshot({ path: `${out}/${name}-${w}.png`, fullPage: full });
    console.log(w, name, errors.length ? 'ERR ' + errors.splice(0).join(' | ').slice(0, 300) : 'ok');
  }
  await ctx.close();
}
await browser.close();
