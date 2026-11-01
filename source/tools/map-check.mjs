// Проверка карты выбора адреса: открыть окно адреса, подвигать карту, найти адрес, вкладка самовывоза.
//   node map-check.mjs [http://localhost:5190] — скриншоты в docs/review/map-*.png
import { chromium } from 'playwright';

const base = (process.argv[2] || 'http://localhost:5190').replace(/\/$/, '');
const out = '../docs/review/';
const b = await chromium.launch({ channel: 'chromium' });
for (const [w, h, mobile] of [[1280, 860, false], [390, 844, true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, locale: 'ru-RU', geolocation: { latitude: 56.8466, longitude: 53.2194 }, permissions: ['geolocation'] });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 160)));
  await p.goto(base + '/cart', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: 'Выбрать адрес' }).first().click();
  await p.waitForSelector('.amap.is-ready', { timeout: 20000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}map-${w}-1-open.png` });

  // двигаем карту мышью/пальцем
  const box = await p.locator('.amap__canvas').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await p.mouse.move(cx, cy);
  await p.mouse.down();
  await p.mouse.move(cx - 160, cy - 60, { steps: 12 });
  await p.screenshot({ path: `${out}map-${w}-2-drag.png` });
  await p.mouse.up();
  await p.waitForSelector('.amap__bubble.is-ok, .amap__bubble.is-bad', { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(400);
  const after = await p.evaluate(() => ({ bubble: document.querySelector('.amap__bubble')?.className + ' | ' + document.querySelector('.amap__bubble')?.textContent, q: document.querySelector('#addr-q')?.value, form: !!document.querySelector('.addr-extra') }));
  await p.screenshot({ path: `${out}map-${w}-3-settled.png` });

  // геолокация
  await p.getByRole('button', { name: 'Моё местоположение' }).click();
  await p.waitForTimeout(2500);
  const geo = await p.evaluate(() => document.querySelector('.amap__bubble')?.textContent);

  // поиск по строке
  await p.fill('#addr-q', 'Ижевск, Пушкинская 154');
  await p.waitForSelector('.addr-sugg button', { timeout: 10000 }).catch(() => {});
  await p.screenshot({ path: `${out}map-${w}-4-suggest.png` });
  const sugg = await p.locator('.addr-sugg button').count();
  if (sugg) {
    await p.locator('.addr-sugg button').first().click();
    await p.waitForTimeout(1200);
  }
  const picked = await p.evaluate(() => document.querySelector('.amap__bubble')?.textContent + ' | form:' + !!document.querySelector('.addr-extra'));
  await p.screenshot({ path: `${out}map-${w}-5-picked.png` });

  // самовывоз
  await p.getByRole('tab', { name: /Самовывоз/ }).click();
  await p.waitForSelector('.deps .amap.is-ready', { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${out}map-${w}-6-pickup.png` });
  console.log(`${w}px`, JSON.stringify({ after, geo, sugg, picked }));
  console.log('   ошибки:', errs.length ? errs.join(' | ') : 'нет');
  await ctx.close();
}
await b.close();
