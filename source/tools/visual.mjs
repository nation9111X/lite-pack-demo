// Визуальная проверка правок: node visual.mjs http://localhost:5191 outDir
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.argv[2] || 'http://localhost:5191';
const out = process.argv[3] || '../docs/review/v2';
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU' });
await ctx.route((u) => /(^|\.)(mc|mdd)\.yandex\.(ru|net)$/.test(u.hostname), (r) => r.abort());
await ctx.addInitScript(() => localStorage.setItem('lp.cookieAccepted', 'true'));
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/yandex/.test(m.location()?.url ?? '') && errors.push(m.text()));
const clip = async (name, sel, pad = 16) => {
  const bb = await p.locator(sel).first().boundingBox();
  if (!bb) return console.log('no', sel);
  await p.screenshot({ path: `${out}/${name}.png`, clip: { x: Math.max(0, bb.x - pad), y: Math.max(0, bb.y - pad), width: bb.width + pad * 2, height: bb.height + pad * 2 } });
};

await p.goto(base + '/', { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
// 1. Окно региона: ховер по кнопке
await p.getByRole('button', { name: 'Удмуртия', exact: true }).hover();
await p.waitForTimeout(450);
await clip('01-region-hover', '.region', 24);
await p.getByRole('button', { name: 'Удмуртия', exact: true }).click();
// 4. Корзина в шапке + ховер «Каталог»
await p.locator('.hdr__catalog').hover();
await p.waitForTimeout(450);
await clip('02-header-hover-catalog', '.hdr__bar', 4);
await p.locator('.cart-btn').hover();
await p.waitForTimeout(450);
await clip('03-header-hover-cart', '.hdr__actions', 12);
// CTA hover
await p.locator('.hero__cta .btn').first().hover();
await p.waitForTimeout(450);
await clip('04-cta-hover', '.hero__cta', 16);
// 3/13. Коробка в разных положениях курсора
for (const [i, pos] of [[0, [200, 200]], [1, [1400, 150]], [2, [1100, 800]], [3, [300, 850]]].entries()) {
  await p.mouse.move(pos[1][0], pos[1][1]);
  await p.waitForTimeout(900);
  await clip(`05-box-${i}`, '.box-scene', 0);
}
// 7. лента в подвале
await p.locator('.ftr__tape').scrollIntoViewIfNeeded();
await p.waitForTimeout(600);
await clip('06-footer-tape', '.ftr__tape', 0);
// 6. логотип → наверх
await p.locator('.hdr .logo').click();
await p.waitForTimeout(1500);
console.log('scrollY после клика по логотипу:', await p.evaluate(() => Math.round(scrollY)));

// Категория: сортировка, активный пункт меню, карточка
const root = { id: 'a1b2c3d4-e5f6-4000-8000-000000000003' };
await p.goto(base + '/category/' + root.id, { waitUntil: 'networkidle' });
await p.waitForTimeout(600);
await clip('07-sidetree-active-root', '.catpage__side', 8);
await p.goto(base + '/category/8b23600b-d61b-415f-85b9-952b011d7932', { waitUntil: 'networkidle' });
await p.waitForTimeout(600);
await p.locator('.select__btn').click();
await p.waitForTimeout(400);
await clip('08-select-open', '.ptool', 120);
await p.keyboard.press('Escape');
const card = p.locator('.pcard').nth(1);
await card.locator('.addctl').hover();
await p.waitForTimeout(500);
await clip('09-card-hover', '.pgrid', 0);

// Товар: калькулятор и 3D-габариты
await p.goto(base + '/product/b39464d0c6714472add98099e5794abe', { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
await clip('10-calc', '.calc', 8);
await p.locator('.dims3d').scrollIntoViewIfNeeded();
await p.waitForTimeout(800);
await clip('11-dims3d', '.dims3d', 8);
const cv = await p.locator('.dims3d__canvas').boundingBox();
await p.mouse.move(cv.x + cv.width / 2, cv.y + cv.height / 2);
await p.mouse.down();
await p.mouse.move(cv.x + cv.width / 2 + 160, cv.y + cv.height / 2 - 60, { steps: 8 });
await p.mouse.up();
await p.waitForTimeout(300);
await clip('12-dims3d-rotated', '.dims3d', 8);

// Скролл после закрытия диалога (был баг)
await p.goto(base + '/', { waitUntil: 'networkidle' });
await p.locator('.addr-chip').first().click();
await p.waitForTimeout(500);
await p.keyboard.press('Escape');
await p.waitForTimeout(400);
const before = await p.evaluate(() => scrollY);
await p.mouse.move(700, 500);
await p.mouse.wheel(0, 1500);
await p.waitForTimeout(1500);
const after = await p.evaluate(() => scrollY);
console.log('скролл после закрытия окна:', before, '→', Math.round(after), (await p.evaluate(() => document.documentElement.className)) || '(нет классов)');
console.log(errors.length ? 'Ошибки: ' + errors.join(' | ') : 'Консоль без ошибок');
await b.close();
