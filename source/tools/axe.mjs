// Проверка доступности axe-core (WCAG 2.2 AA): node axe.mjs http://localhost:5196
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';

const base = process.argv[2] || 'http://localhost:5196';
const pages = ['/', '/category/a1b2c3d4-e5f6-4000-8000-000000000001', '/category/8b23600b-d61b-415f-85b9-952b011d7932', '/product/b39464d0c6714472add98099e5794abe', '/search?q=стакан', '/cart', '/contact-us', '/faq', '/legal', '/help', '/profile', '/orders', '/nope'];
const b = await chromium.launch();
const report = [];
for (const w of [375, 1440]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 500 });
  await ctx.route((u) => /(^|\.)(mc|mdd)\.yandex\.(ru|net)$/.test(u.hostname), (r) => r.abort());
  await ctx.addInitScript(() => { localStorage.setItem('lp.cookieAccepted', 'true'); localStorage.setItem('lp.regionSkipped', 'true'); });
  const p = await ctx.newPage();
  const run = async (name) => {
    const r = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
    const v = r.violations.map((x) => ({ id: x.id, impact: x.impact, n: x.nodes.length, sample: x.nodes[0]?.target?.join(' ') }));
    report.push({ w, page: name, violations: v });
    console.log(w, name.padEnd(48), v.length ? v.map((x) => `${x.impact}:${x.id}(${x.n}) ${x.sample}`).join(' | ') : 'OK');
  };
  for (const path of pages) {
    await p.goto(base + path, { waitUntil: 'networkidle' });
    await p.waitForTimeout(600);
    await run(path.slice(0, 48));
  }
  // Диалоги
  await p.goto(base + '/category/8b23600b-d61b-415f-85b9-952b011d7932', { waitUntil: 'networkidle' });
  await p.locator('.pcard').first().getByRole('button', { name: 'В корзину' }).click();
  await p.waitForTimeout(500);
  await run('[dialog] Адрес доставки');
  await p.keyboard.press('Escape');
  await p.goto(base + '/profile', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: 'Войти или зарегистрироваться' }).click();
  await p.waitForTimeout(500);
  await run('[dialog] Вход');
  await ctx.close();
}
fs.writeFileSync('../docs/axe-report.json', JSON.stringify(report, null, 1));
await b.close();
