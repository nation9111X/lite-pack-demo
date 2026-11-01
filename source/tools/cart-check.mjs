// Корзина в демо-режиме (npm run dev:demo): адрес через карту → основание с крышкой → подсказка крышек →
// удаление с «Вернуть» → панель и страница корзины. node cart-check.mjs [http://localhost:5193]
import { chromium } from 'playwright';
import fs from 'node:fs';
import { lidPairs } from './pairs.mjs';

const base = (process.argv[2] || 'http://localhost:5193').replace(/\/$/, '');
const snap = JSON.parse(fs.readFileSync(new URL('../data/snapshot.json', import.meta.url), 'utf8'));
const P = Object.values(snap.products);
const live = (id) => Object.values(snap.priceByRegion[id] ?? {}).some((r) => !r.outOfStock && r.quantityOfUnitsLeft > 0);
const pairs = lidPairs(P);
const T = Object.fromEntries(P.map((p) => [p.id, p.info.title]));
const baseIds = Object.keys(pairs).filter((id) => live(id) && pairs[id].some(live)).slice(0, 2);
console.log('основания:', baseIds.map((id) => T[id]).join(' | '));

const b = await chromium.launch({ channel: 'chromium' });
for (const [w, h, mobile] of [[1280, 860, false], [390, 844, true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, locale: 'ru-RU' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 160)));
  // клик по центру элемента после прокрутки к нему (шапка сжимается при прокрутке — штатный click «промахивается»)
  const tapCenter = async (loc) => {
    await loc.evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(400);
    const r = await loc.boundingBox();
    await p.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  };
  const shot = (name) => p.screenshot({ path: `../docs/review/cart-${w}-${name}.png` });

  // адрес — через карту (в демо адрес даёт Photon, зона — из снимка)
  await p.goto(base + '/cart', { waitUntil: 'networkidle' });
  await p.locator('.cookie__ok').click({ timeout: 4000 }).catch(() => {}); // плашка cookie
  await p.getByRole('button', { name: 'Выбрать адрес' }).first().click();
  await p.waitForSelector('.amap.is-ready', { timeout: 20000 });
  const box = await p.locator('.amap__canvas').boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  await p.mouse.move(box.x + box.width / 2 - 40, box.y + box.height / 2 + 20, { steps: 6 });
  await p.mouse.up();
  await p.waitForSelector('.amap__bubble.is-ok, .amap__bubble.is-bad', { timeout: 15000 }).catch(() => {});
  const bubble = await p.locator('.amap__bubble').textContent().catch(() => '');
  await shot('0-map');
  await p.getByRole('button', { name: 'Доставить сюда' }).click();
  await p.waitForTimeout(800);

  // основания с крышками — в корзину
  for (const id of baseIds) {
    await p.goto(base + '/product/' + id, { waitUntil: 'networkidle' });
    await p.locator('.prod__buy .addctl--add').click();
    await p.waitForTimeout(700);
  }
  await p.goto(base + '/cart', { waitUntil: 'networkidle' });
  await p.waitForSelector('.cline', { timeout: 10000 });
  await p.waitForSelector('.lid', { timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(600);
  await shot('1-page');
  const lidsBefore = await p.locator('.lid').count();
  if (lidsBefore) {
    const add = p.locator('.lid .addctl--add').first();
    await add.evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(400);
    await shot('1b-lids');
    await tapCenter(add);
    await p.waitForTimeout(1200);
  }
  const lines = await p.locator('.cline').count();
  await shot('2-lid-added');

  // убрать строку и вернуть
  await tapCenter(p.locator('.cline__del').first());
  await p.waitForTimeout(500);
  const afterDel = await p.locator('.cline').count();
  await shot('3-removed');
  await p.locator('.toast__act').first().click();
  await p.waitForTimeout(1200);
  const afterUndo = await p.locator('.cline').count();
  const passport = await p.locator('.passport').textContent().catch(() => '');

  // компьютер — выезжающая панель; телефон — страница /cart. Кнопка оформления должна быть видна сразу
  let bar;
  if (!mobile) {
    await p.goto(base + '/', { waitUntil: 'networkidle' });
    await p.locator('.cart-btn').first().click();
    await p.waitForSelector('dialog[open] .cartv', { timeout: 10000 });
  } else {
    await p.evaluate(() => window.scrollTo(0, 0));
  }
  await p.waitForTimeout(700);
  await shot('4-first-screen');
  bar = await p.evaluate(() => {
    const el = document.querySelector((document.querySelector('dialog[open]') ? 'dialog[open] ' : '') + '.cartv__bar');
    const r = el?.getBoundingClientRect();
    return r ? { barTop: Math.round(r.top), barBottom: Math.round(r.bottom), viewport: innerHeight } : null;
  });
  console.log(`${w}px`, JSON.stringify({ bubble, lidsBefore, lines, afterDel, afterUndo, passport, bar }));
  console.log('   ошибки:', errs.length ? errs.join(' | ') : 'нет');
  await ctx.close();
}
await b.close();
