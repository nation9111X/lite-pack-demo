// Бренды: главная (лента), карточка бренда на товаре, страница бренда. node brand-check.mjs <base> <productId>
import { chromium } from 'playwright';
const base = (process.argv[2] || 'http://localhost:5190').replace(/\/$/, '');
const pid = process.argv[3];
const b = await chromium.launch({ channel: 'chromium' });
for (const [w, h, mobile] of [[1280, 860, false], [390, 844, true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, locale: 'ru-RU' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  const sec = p.locator('.makers-sec');
  await sec.scrollIntoViewIfNeeded();
  await p.waitForTimeout(900);
  await sec.screenshot({ path: `../docs/review/brands-${w}-home.png` });
  await p.goto(base + '/product/' + pid, { waitUntil: 'networkidle' });
  await p.waitForSelector('.maker');
  const mk = p.locator('.makers');
  await mk.scrollIntoViewIfNeeded();
  if (!mobile) await p.locator('.maker').first().hover();
  await p.waitForTimeout(500);
  await p.locator('.prod__info').screenshot({ path: `../docs/review/brands-${w}-product.png` });
  await p.locator('.maker').first().click();
  await p.waitForSelector('.colhead__meta', { timeout: 15000 });
  await p.waitForTimeout(900);
  await p.screenshot({ path: `../docs/review/brands-${w}-page.png` });
  const info = await p.evaluate(() => ({ url: location.pathname, h1: document.querySelector('h1')?.textContent, meta: document.querySelector('.colhead__meta')?.textContent, cards: document.querySelectorAll('.pcard').length, others: document.querySelectorAll('.mchip').length }));
  console.log(w, JSON.stringify(info), 'ошибки:', errs.join(' | ') || 'нет');
  await ctx.close();
}
await b.close();
