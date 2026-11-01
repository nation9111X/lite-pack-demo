// Проверка выложенного демо «как у босса»: браузер без прокси/VPN, компьютер и телефон.
//   node boss-check.mjs https://ioskakuss-cell.github.io
import { chromium } from 'playwright';

const base = (process.argv[2] || 'https://ioskakuss-cell.github.io').replace(/\/$/, '');
const b = await chromium.launch({ args: ['--no-proxy-server'] });
for (const [w, h, mobile] of [[1440, 900, false], [390, 844, true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, locale: 'ru-RU' });
  const p = await ctx.newPage();
  const errs = [];
  const failed = [];
  const api = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('requestfailed', (r) => failed.push(r.url().slice(-60)));
  p.on('request', (r) => r.url().includes('/api/') && api.push(r.url()));
  const t0 = Date.now();
  await p.goto(base + '/', { waitUntil: 'load', timeout: 90000 });
  const tLoad = Date.now() - t0;
  await p.waitForTimeout(2500);
  const home = await p.evaluate(() => ({ strip: document.querySelector('.preview-strip')?.textContent.replace(/\s+/g, ' ').slice(0, 60), tiles: document.querySelectorAll('.ctile').length }));
  await p.goto(base + '/category/8b23600b-d61b-415f-85b9-952b011d7932', { waitUntil: 'load', timeout: 90000 });
  await p.waitForTimeout(3000);
  const cat = await p.evaluate(() => ({
    cards: document.querySelectorAll('.pcard').length,
    priced: [...document.querySelectorAll('.pcard')].filter((c) => /₽/.test(c.textContent)).length,
    imgsOk: [...document.querySelectorAll('.pcard img')].filter((i) => i.complete && i.naturalWidth > 0).length,
  }));
  await p.goto(base + '/product/d000b67d3cb6479b99ee3f7f76baa07f', { waitUntil: 'load', timeout: 90000 });
  await p.waitForTimeout(3000);
  const prod = await p.evaluate(() => {
    const i = document.querySelector('.gallery__stage img');
    return { title: document.querySelector('h1')?.textContent.slice(0, 30), photo: i ? i.naturalWidth + 'px' : 'нет', price: /₽/.test(document.querySelector('main')?.textContent ?? '') };
  });
  // страница без пререндера (корзина) — должна открыться оболочка приложения
  await p.goto(base + '/cart', { waitUntil: 'load', timeout: 90000 });
  await p.waitForTimeout(2000);
  const cartTitle = await p.title();
  await p.goto(base + '/', { waitUntil: 'load', timeout: 90000 });
  await p.waitForTimeout(2000);
  await p.screenshot({ path: `../docs/review/boss-${w}.png` });
  console.log(`${w}px: главная за ${tLoad} мс`, JSON.stringify(home), '| категория', JSON.stringify(cat), '| товар', JSON.stringify(prod), '| /cart:', cartTitle);
  console.log(`   ошибок: ${errs.length ? errs.join(' | ') : 'нет'}; неудачных запросов: ${failed.length} ${failed.slice(0, 3).join(' ')}; запросов к API: ${api.length}`);
  await ctx.close();
}
await b.close();
