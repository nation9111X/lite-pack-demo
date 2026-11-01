// Переключатель региона при выбранном адресе: ассортимент меняется, «Вернуть адрес» возвращает всё обратно.
// Плюс снимки редких экранов в тёмной теме. node region-check.mjs [база]
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const base = (process.argv[2] || 'http://localhost:5193').replace(/\/$/, '');
const shotPath = (n) => fileURLToPath(new URL(`../docs/review/${n}.png`, import.meta.url));
const CAT = '/category/8b23600b-d61b-415f-85b9-952b011d7932';
const b = await chromium.launch({ channel: 'chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'ru-RU' });
await ctx.addInitScript(() => {
  localStorage.setItem('lp.theme', 'dark');
  localStorage.setItem('lp.cookieAccepted', 'true');
});
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
const info = () => p.evaluate(() => ({ chip: document.querySelector('.hdr__mobile-addr .addr-chip__value')?.textContent, cards: document.querySelectorAll('.pcard').length, firstPrice: document.querySelector('.pcard .price__main b')?.textContent, badge: document.querySelector('.bnav .badge')?.textContent ?? '0' }));
// первый вход: выбор региона
await p.goto(base + CAT, { waitUntil: 'load' });
await p.waitForSelector('.region__opt', { timeout: 15000 });
await p.screenshot({ path: shotPath('dark-region-prompt') });
await p.locator('.region__opt', { hasText: 'Удмуртия' }).click();
await p.waitForTimeout(900);
const udm = await info();
// переключатель в окне адреса
await p.locator('.hdr__mobile-addr .addr-chip').click();
await p.waitForSelector('.regsw');
await p.locator('.regsw .seg__btn', { hasText: 'Башкортостан' }).click();
await p.waitForTimeout(900);
const bas = await info();
const toast = await p.locator('.toast').first().textContent().catch(() => '');
await p.screenshot({ path: shotPath('dark-region-switch') });
await p.locator('.hdr__mobile-addr .addr-chip').click();
await p.waitForSelector('.regsw');
await p.locator('.regsw .seg__btn', { hasText: 'Удмуртия' }).click();
await p.waitForTimeout(900);
// адрес на карте в Удмуртии и товар в корзину
await p.locator('.hdr__mobile-addr .addr-chip').click();
await p.waitForSelector('.regsw');
await p.waitForSelector('.amap.is-ready', { timeout: 25000 });
await p.waitForTimeout(1500);
const c = await p.locator('.amap__canvas').boundingBox();
await p.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
await p.mouse.down();
await p.mouse.move(c.x + c.width / 2 - 20, c.y + c.height / 2 + 10, { steps: 5 });
await p.mouse.up();
await p.waitForSelector('.amap__bubble.is-ok', { timeout: 15000 });
const addr = await p.locator('.amap__bubble').textContent();
await p.getByRole('button', { name: 'Доставить сюда' }).click();
await p.waitForTimeout(1000);
await p.locator('.pcard .addctl--add').first().evaluate((e) => e.scrollIntoView({ block: 'center' }));
await p.waitForTimeout(300);
await p.locator('.pcard .addctl--add').first().click();
await p.waitForTimeout(1100);
const withAddr = await info();
// смена региона при выбранном адресе и обратно
await p.locator('.hdr__mobile-addr .addr-chip').click();
await p.waitForSelector('.regsw');
await p.locator('.regsw .seg__btn', { hasText: 'Башкортостан' }).click();
await p.waitForTimeout(1000);
const switched = await info();
const hasBack = await p.locator('.toast__act', { hasText: 'Вернуть адрес' }).count();
await p.locator('.toast__act', { hasText: 'Вернуть адрес' }).click();
await p.waitForTimeout(1200);
const back = await info();
console.log(JSON.stringify({ udm, bas, toast, addr, withAddr, switched, hasBack, back }, null, 0));
// редкие экраны
await ctx.addCookies([]);
for (const [name, url, wait] of [['faq', '/faq', '.faq__item, .faq'], ['contacts', '/contact-us', 'h1'], ['profile', '/profile', 'h1'], ['orders', '/orders', 'h1']]) {
  await p.goto(base + url, { waitUntil: 'load' });
  await p.waitForSelector(wait, { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(700);
  await p.screenshot({ path: shotPath(`dark-${name}`) });
}
const id = await p.evaluate(async () => (await (await fetch('/demo/catalog.json')).json()).leaves['2e332285-a81a-4bf2-a932-62d96c1b2231'][3]);
await p.goto(base + '/product/' + id, { waitUntil: 'load' });
await p.waitForSelector('.prod__title', { timeout: 15000 });
await p.waitForTimeout(800);
await p.locator('.prod__dims, .makers, .prod__details').first().evaluate((e) => e.scrollIntoView({ block: 'start' }));
await p.waitForTimeout(1000);
await p.screenshot({ path: shotPath('dark-product-3d') });
console.log('ошибки:', errs.length ? errs.join(' | ') : 'нет');
await b.close();
