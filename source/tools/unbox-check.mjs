// Распаковка карточек: появляется при переходе и при прямой загрузке, не залипает, лимит соблюдается. node unbox-check.mjs [база]
import { chromium } from 'playwright';

const base = (process.argv[2] || 'http://localhost:5193').replace(/\/$/, '');
const CAT = '/category/8b23600b-d61b-415f-85b9-952b011d7932';
const b = await chromium.launch({ channel: 'chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ru-RU' });
await ctx.addInitScript(() => {
  localStorage.setItem('lp.cookieAccepted', 'true');
  localStorage.setItem('lp.regionSkipped', 'true');
});
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
const state = () => p.evaluate(() => {
  const vh = innerHeight;
  const visible = [...document.querySelectorAll('.pcard')].filter((c) => { const r = c.getBoundingClientRect(); return r.bottom > 0 && r.top < vh; });
  return { cards: document.querySelectorAll('.pcard').length, boxed: document.querySelectorAll('.pcard.boxed').length, visibleBoxed: visible.filter((c) => c.classList.contains('boxed')).length };
});

// переход внутри сайта
await p.goto(base + '/', { waitUntil: 'load' });
await p.waitForTimeout(1500);
await p.evaluate((u) => {
  history.pushState({}, '', u);
  dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}, new URL(base + CAT).pathname);
await p.waitForSelector('.pcard.boxed', { timeout: 15000 });
const inApp0 = await state();
await p.waitForTimeout(2200);
const inApp1 = await state();
console.log('переход:', JSON.stringify({ сразу: inApp0, спустя: inApp1 }));

// прокрутка: отложенные карточки открываются, когда доходят до экрана, и ничего не залипает
for (let i = 0; i < 8; i++) {
  await p.evaluate(() => window.scrollBy(0, 600));
  await p.waitForTimeout(250);
}
await p.waitForTimeout(1800);
console.log('после прокрутки:', JSON.stringify(await state()));

// прямая загрузка
await p.goto(base + CAT, { waitUntil: 'load' });
await p.waitForSelector('.pcard', { timeout: 15000 });
await p.waitForTimeout(2500);
console.log('прямая загрузка:', JSON.stringify(await state()));
console.log('ошибки:', errs.join(' | ') || 'нет');
await b.close();
