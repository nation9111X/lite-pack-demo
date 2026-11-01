import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 412, height: 823 }, isMobile: true });
await ctx.route('**/api/v1/products/**', async (r) => { await new Promise((x) => setTimeout(x, 2500)); r.continue(); });
const p = await ctx.newPage();
await p.goto('http://localhost:5193/product/b39464d0c6714472add98099e5794abe');
await p.waitForTimeout(1200);
console.log(await p.evaluate(() => [...document.querySelectorAll('.prod__grid > *')].map((e) => e.className + ' ' + JSON.stringify(e.getBoundingClientRect().toJSON()) + ' style=' + e.getAttribute('style'))));
await b.close();
