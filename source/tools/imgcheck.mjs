// Проверка картинок: откуда грузятся (улучшенные /pimg или сервис ресайза) и нет ли битых.
//   node imgcheck.mjs http://localhost:5191
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://localhost:5191';
const pages = ['/', '/category/8b23600b-d61b-415f-85b9-952b011d7932', '/category/a1b2c3d4-e5f6-4000-8000-000000000003', '/product/c87708b3a86740079070f5c055b9db77', '/product/6f4131c4fa6e4a57af7abfc337763a1b'];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'ru-RU' });
await ctx.route((u) => /(^|\.)(mc|mdd)\.yandex\.(ru|net)$/.test(u.hostname), (r) => r.abort());
await ctx.addInitScript(() => { localStorage.setItem('lp.cookieAccepted', 'true'); localStorage.setItem('lp.regionSkipped', 'true'); });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
for (const path of pages) {
  await p.goto(base + path, { waitUntil: 'load', timeout: 60000 }); await p.waitForTimeout(1500);
  // прокрутка, чтобы догрузились ленивые картинки
  for (let y = 0; y < 6; y++) { await p.mouse.wheel(0, 900); await p.waitForTimeout(250); }
  await p.waitForTimeout(1500);
  const r = await p.evaluate(() => {
    const imgs = [...document.querySelectorAll('main img')].filter((i) => i.complete && i.getBoundingClientRect().width > 0);
    const src = (i) => i.currentSrc || i.src;
    return {
      total: imgs.length,
      pimg: imgs.filter((i) => src(i).includes('/pimg/')).length,
      service: imgs.filter((i) => /,fit\//.test(src(i))).length,
      broken: imgs.filter((i) => i.naturalWidth === 0).map((i) => src(i).slice(-60)),
    };
  });
  console.log(path.padEnd(52), JSON.stringify(r));
}
console.log(errors.length ? 'Ошибки: ' + errors.join(' | ') : 'Консоль без ошибок');
await b.close();
