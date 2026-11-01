// Телефон (демо-режим): первый экран, история из точек, каталог, корзина, консультант, окно адреса — в обеих темах.
//   node phone-check.mjs [http://localhost:5193] [light|dark] — снимки в docs/review/phone-*.png
import { chromium } from 'playwright';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const base = (process.argv[2] || 'http://localhost:5193').replace(/\/$/, '');
const themes = process.argv[3] ? [process.argv[3]] : ['light', 'dark'];
const out = new URL('../docs/review/', import.meta.url);
fs.mkdirSync(out, { recursive: true });
const ADDR = { addresses: [{ id: 'a1', namedAddress: { name: null, address: { value: 'Ижевск, Пушкинская улица, 154', locality: 'Ижевск', street: 'Пушкинская улица', house: '154', lat: 56.842, lng: 53.216 }, departmentId: null, regionId: null, workingStatus: 'working', workingStatusMessage: null, sourceDepartmentIds: ['8a6e7295'] } }], active: 'a1', cart: [], orders: [], draft: null, authorized: false, seq: 2 };
const snap = JSON.parse(fs.readFileSync(new URL('../data/snapshot.json', import.meta.url), 'utf8'));
const someProduct = Object.keys(snap.products).find((id) => /Стакан Бумажный 250/.test(snap.products[id].info.title));
const b = await chromium.launch({ channel: 'chromium', args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const theme of themes) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'ru-RU' });
  await ctx.addInitScript((t) => {
    localStorage.setItem('lp.theme', t);
    localStorage.setItem('lp.cookieAccepted', 'true');
    localStorage.setItem('lp.regionSkipped', 'true');
  }, theme);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('page: ' + e.message));
  p.on('console', (m) => m.type() === 'error' && !/ERR_|Failed to load/.test(m.text()) && errs.push(m.text().slice(0, 200)));
  const shot = (n) => p.screenshot({ path: fileURLToPath(new URL(`phone-${theme}-${n}.png`, out)) });
  await p.goto(base + '/', { waitUntil: 'load' });
  await p.waitForTimeout(3200);
  await shot('1-top');
  const stat = await p.evaluate(() => ({
    belt: document.querySelectorAll('.conv__item:not(.skeleton)').length,
    canvasOn: document.querySelector('.pack-canvas')?.classList.contains('is-on'),
    width: document.documentElement.scrollWidth,
    theme: document.documentElement.dataset.theme,
    ctaVisible: getComputedStyle(document.querySelector('.hero__cta')).display,
  }));
  // касание коробки
  const boxR = await p.locator('.box-scene').boundingBox();
  await p.touchscreen.tap(boxR.x + boxR.width / 2, boxR.y + boxR.height / 2);
  await p.waitForTimeout(250);
  await shot('2-box-tap');
  // каталог
  const toY = (sel) => p.evaluate((s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top + scrollY : 0; }, sel);
  await p.evaluate(async (y) => window.scrollTo(0, y), (await toY('#catalog')) - 80);
  await p.waitForTimeout(1200);
  await shot('3-catalog');
  // история
  await p.locator('.conv').evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await p.waitForSelector('.conv__item.is-at', { timeout: 15000 });
  await p.waitForTimeout(900);
  await shot('4-belt');
  const steps = await p.locator('.conv__item.is-stamped').count();
  await p.evaluate(async (y) => window.scrollTo(0, y), (await toY('.podpromo')) - 100);
  await p.waitForTimeout(1200);
  await shot('5-promo');
  // адрес + регион
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(300);
  await p.locator('.hdr__mobile-addr .addr-chip').click();
  await p.waitForSelector('.regsw', { timeout: 15000 });
  await p.waitForTimeout(1800);
  await shot('6-address');
  const bash = p.locator('.regsw .seg__btn').nth(1);
  const regionBefore = await p.locator('.hdr__mobile-addr .addr-chip__value').textContent();
  await bash.click();
  await p.waitForTimeout(1200);
  const regionAfter = await p.locator('.hdr__mobile-addr .addr-chip__value').textContent();
  await shot('7-region');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);
  // товар и корзина
  await p.goto(base + '/', { waitUntil: 'load' });
  await p.evaluate((s) => localStorage.setItem('lp.demo.v1', JSON.stringify(s)), ADDR);
  await p.goto(base + '/product/' + someProduct, { waitUntil: 'load' });
  await p.waitForSelector('.prod__buy .addctl--add', { timeout: 15000 });
  await p.waitForTimeout(600);
  await shot('8-product');
  await p.locator('.prod__buy .addctl--add').click();
  await p.waitForTimeout(800);
  await p.goto(base + '/cart', { waitUntil: 'load' });
  await p.waitForSelector('.cline', { timeout: 15000 });
  await p.waitForTimeout(900);
  await shot('9-cart');
  await p.goto(base + '/podbor?s=coffee', { waitUntil: 'load' });
  await p.waitForSelector('.opt', { timeout: 15000 });
  await p.locator('.opt').nth(1).click();
  await p.waitForSelector('.opt--num');
  await p.locator('.opt--num').nth(1).click();
  await p.waitForSelector('.kitrow', { timeout: 15000 });
  await p.locator('.slip').scrollIntoViewIfNeeded();
  await p.waitForTimeout(900);
  await shot('10-podbor');
  console.log(theme, JSON.stringify({ ...stat, steps, regionBefore, regionAfter }), 'ошибки:', errs.length ? errs.join(' | ') : 'нет');
  await ctx.close();
}
await b.close();
