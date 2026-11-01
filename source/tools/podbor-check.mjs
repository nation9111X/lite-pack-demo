// Консультант «Подбор упаковки» (демо-режим: npm run dev:demo). Проходит диалог во всех сценариях и приоритетах,
// печатает собранные комплекты, проверяет «Другой вариант», количество и «Положить всё в корзину».
//   node podbor-check.mjs [http://localhost:5193] [--all]
import { chromium } from 'playwright';

const base = (process.argv[2] || 'http://localhost:5193').replace(/\/$/, '');
const all = process.argv.includes('--all');
const ADDR = { addresses: [{ id: 'a1', namedAddress: { name: null, address: { value: 'Ижевск, Пушкинская улица, 154', locality: 'Ижевск', street: 'Пушкинская улица', house: '154', lat: 56.842, lng: 53.216 }, departmentId: null, regionId: null, workingStatus: 'working', workingStatusMessage: null, sourceDepartmentIds: [] } }], active: 'a1', cart: [], orders: [], draft: null, authorized: false, seq: 2 };

const b = await chromium.launch({ channel: 'chromium' });
const kitText = (p) => p.evaluate(() => [...document.querySelectorAll('.kitrow')].map((r) => `${r.classList.contains('is-off') ? '  (выкл) ' : '  '}${r.querySelector('.kitrow__role')?.textContent}: ${r.querySelector('.kitrow__name')?.textContent} — ${r.querySelector('.kstep output')?.textContent ?? ''} ${r.querySelector('.kitrow__sum')?.textContent ?? ''}`).join('\n') + `\n  ИТОГО ${document.querySelector('.slip__total b')?.textContent}`);

async function run(p, scnTitle, pri, vol) {
  await p.goto(base + '/podbor', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: scnTitle, exact: true }).click();
  await p.locator('.opt', { hasText: pri }).click();
  await p.locator('.opt--num', { hasText: String(vol) }).first().click();
  await p.waitForSelector('.kitrow', { timeout: 15000 });
  await p.waitForTimeout(500);
}

{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ru-RU' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  await p.evaluate((s) => { localStorage.setItem('lp.demo.v1', JSON.stringify(s)); localStorage.setItem('lp.cookieAccepted', 'true'); }, ADDR);

  await p.goto(base + '/podbor', { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  await p.screenshot({ path: '../docs/review/podbor-1280-1-start.png' });

  const scns = await p.locator('.scn__t').allTextContents();
  const pris = all ? ['Подешевле', 'Экологично', 'Выглядит дороже'] : ['Экологично'];
  for (const s of all ? scns : ['Суши и роллы', 'Кофе с собой']) {
    for (const pri of pris) {
      await run(p, s, pri, 50);
      console.log(`\n== ${s} · ${pri} · 50/день`);
      console.log(await kitText(p));
    }
  }

  // подробно: суши, «выглядит дороже», 100 в день
  await run(p, 'Суши и роллы', 'Выглядит дороже', 100);
  await p.screenshot({ path: '../docs/review/podbor-1280-2-kit.png', fullPage: true });
  const before = await kitText(p);
  await p.locator('.kitrow__swap').first().click();
  await p.waitForTimeout(400);
  const after = await kitText(p);
  console.log('\n== «Другой вариант» у основания:\n' + before.split('\n').slice(0, 2).join('\n') + '\n  →\n' + after.split('\n').slice(0, 2).join('\n'));
  await p.locator('.kitrow .kstep button[aria-label="Больше на упаковку"]').first().click();
  await p.locator('.slip__days .chip', { hasText: 'на месяц' }).click();
  await p.waitForTimeout(500);
  console.log('\n== на месяц:\n' + (await kitText(p)));
  await p.locator('.slip__cta').click();
  await p.waitForTimeout(1500);
  const cart = await p.evaluate(() => document.querySelector('.cart-btn')?.getAttribute('aria-label'));
  const toastText = await p.locator('.toast').first().textContent().catch(() => '');
  await p.screenshot({ path: '../docs/review/podbor-1280-3-added.png' });
  console.log('\nкорзина:', cart, '| тост:', toastText);
  console.log('ошибки:', errs.length ? errs.join(' | ') : 'нет');
  await ctx.close();
}
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ru-RU' });
  const p = await ctx.newPage();
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  await p.evaluate((s) => { localStorage.setItem('lp.demo.v1', JSON.stringify(s)); localStorage.setItem('lp.cookieAccepted', 'true'); }, ADDR);
  await p.goto(base + '/podbor', { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  await p.screenshot({ path: '../docs/review/podbor-390-1-start.png' });
  await run(p, 'Пицца', 'Подешевле', 100);
  await p.locator('.slip').scrollIntoViewIfNeeded();
  await p.waitForTimeout(500);
  await p.screenshot({ path: '../docs/review/podbor-390-2-kit.png' });
  const w = await p.evaluate(() => document.documentElement.scrollWidth);
  console.log('\nтелефон: ширина страницы', w);
  await ctx.close();
}
await b.close();
