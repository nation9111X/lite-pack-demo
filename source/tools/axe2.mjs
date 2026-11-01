// Доступность (axe, WCAG 2.2 AA) в обеих темах на телефоне и компьютере + снимки компьютера. node axe2.mjs [база]
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { fileURLToPath } from 'node:url';

const base = (process.argv[2] || 'http://localhost:5193').replace(/\/$/, '');
const shotPath = (n) => fileURLToPath(new URL(`../docs/review/${n}.png`, import.meta.url));
const b = await chromium.launch({ channel: 'chromium' });
const ADDR = { addresses: [{ id: 'a1', namedAddress: { name: null, address: { value: 'Ижевск, Пушкинская улица, 154', locality: 'Ижевск', street: 'Пушкинская улица', house: '154', lat: 56.842, lng: 53.216 }, departmentId: null, regionId: null, workingStatus: 'working', workingStatusMessage: null, sourceDepartmentIds: [] } }], active: 'a1', cart: [{ productId: 'ac0c434bbbaf4cf1a96451ca2d3a6fd9', quantityOfUnits: 420 }], orders: [], draft: null, authorized: false, seq: 2 };
let bad = 0;
for (const theme of ['light', 'dark']) {
  for (const w of [390, 1280]) {
    const ctx = await b.newContext({ viewport: { width: w, height: w < 500 ? 844 : 860 }, isMobile: w < 500, hasTouch: w < 500, locale: 'ru-RU' });
    await ctx.addInitScript(([t, s]) => {
      localStorage.setItem('lp.theme', t);
      localStorage.setItem('lp.cookieAccepted', 'true');
      localStorage.setItem('lp.regionSkipped', 'true');
      if (!localStorage.getItem('lp.demo.v1')) localStorage.setItem('lp.demo.v1', JSON.stringify(s));
    }, [theme, ADDR]);
    const p = await ctx.newPage();
    const run = async (name, include) => {
      await p.waitForTimeout(1100); // появление и анимации завершились
      let a = new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);
      if (include) a = a.include(include);
      const r = await a.analyze();
      const v = r.violations.map((x) => `${x.impact}:${x.id}(${x.nodes.length}) ${x.nodes[0]?.target?.join(' ')} ${(x.nodes[0]?.any?.[0]?.message || '').slice(0, 110)}`);
      bad += v.length;
      console.log(theme, w, name.padEnd(16), v.length ? v.join(' | ') : 'OK');
    };
    await p.goto(base + '/', { waitUntil: 'load' });
    await p.waitForTimeout(2600);
    if (w > 500) await p.screenshot({ path: shotPath(`desk-${theme}-1-top`) });
    await run('главная');
    await p.evaluate(() => document.querySelector('.conv')?.scrollIntoView({ block: 'center' }));
    await p.waitForSelector('.conv__item.is-at', { timeout: 15000 });
    await p.waitForTimeout(1500);
    if (w > 500) await p.screenshot({ path: shotPath(`desk-${theme}-2-belt`) });
    await run('лента');
    await p.evaluate(() => { const e = document.querySelector('.podpromo'); if (e) window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 120); });
    await p.waitForTimeout(1200);
    if (w > 500) await p.screenshot({ path: shotPath(`desk-${theme}-3-promo`) });
    await p.goto(base + '/podbor?s=coffee', { waitUntil: 'load' });
    await p.waitForSelector('.opt', { timeout: 15000 });
    await p.locator('.opt').nth(1).click();
    await p.waitForSelector('.opt--num');
    await p.locator('.opt--num').nth(1).click();
    await p.waitForSelector('.kitrow', { timeout: 15000 });
    await run('подбор');
    await p.goto(base + '/category/0d140123-f974-4ee9-b5f0-1aa8a868733b', { waitUntil: 'load' });
    await p.waitForSelector('.pcard', { timeout: 15000 });
    await run('раздел');
    if (w > 500) await p.screenshot({ path: shotPath(`desk-${theme}-4-cat`) });
    await p.goto(base + '/cart', { waitUntil: 'load' });
    await p.waitForSelector('.cline', { timeout: 15000 });
    await run('корзина');
    if (w > 500) await p.screenshot({ path: shotPath(`desk-${theme}-5-cart`) });
    await p.locator('.cartv__addr').click();
    await p.waitForSelector('.amap.is-ready', { timeout: 25000 });
    await p.waitForTimeout(1500);
    await run('адрес', 'dialog[open]');
    await p.screenshot({ path: shotPath(`map-${theme}-${w}`) });
    await ctx.close();
  }
}
console.log('нарушений:', bad);
await b.close();
