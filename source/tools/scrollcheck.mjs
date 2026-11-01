import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.route((u) => /(^|\.)(mc|mdd)\.yandex\.(ru|net)$/.test(u.hostname), (r) => r.abort());
await ctx.addInitScript(() => { localStorage.setItem('lp.cookieAccepted', 'true'); localStorage.setItem('lp.regionSkipped', 'true'); });
const p = await ctx.newPage();
await p.goto('http://localhost:5196/', { waitUntil: 'networkidle' });
for (const y of [2400, 4000]) {
  await p.mouse.wheel(0, y - (await p.evaluate(() => scrollY)));
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `../docs/review/scroll-${y}.png` });
}
await b.close();
