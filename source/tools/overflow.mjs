import { chromium } from 'playwright';
const base = process.argv[2] || 'http://localhost:5190';
const routes = ['/', '/category/a1b2c3d4-e5f6-4000-8000-000000000001', '/category/8b23600b-d61b-415f-85b9-952b011d7932', '/product/b39464d0c6714472add98099e5794abe', '/search?q=стакан', '/cart', '/contact-us', '/faq', '/legal', '/profile', '/orders', '/help', '/nope'];
const b = await chromium.launch();
for (const w of [320, 375]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 800 }, isMobile: true, hasTouch: true });
  await ctx.route((u) => /(^|\.)(mc|mdd)\.yandex\.(ru|net)$/.test(u.hostname), (r) => r.abort());
  await ctx.addInitScript(() => { localStorage.setItem('lp.cookieAccepted', 'true'); localStorage.setItem('lp.regionSkipped', 'true'); });
  const p = await ctx.newPage();
  for (const r of routes) {
    await p.goto(base + r, { waitUntil: 'networkidle' });
    await p.waitForTimeout(500);
    const res = await p.evaluate((w) => {
      const sw = document.documentElement.scrollWidth;
      const bad = [];
      document.querySelectorAll('body *').forEach((el) => {
        const rc = el.getBoundingClientRect();
        if (rc.right > w + 1 && rc.width > 0) {
          let a = el.parentElement, clipped = false;
          while (a) { const o = getComputedStyle(a); if (/(hidden|auto|scroll|clip)/.test(o.overflowX) && a !== document.body && a !== document.documentElement) { clipped = true; break; } a = a.parentElement; }
          if (!clipped) bad.push((el.className?.toString() || el.tagName).slice(0, 40) + ':' + Math.round(rc.right));
        }
      });
      return { sw, bad: [...new Set(bad)].slice(0, 6) };
    }, w);
    console.log(w, r.slice(0, 40), 'scrollWidth=' + res.sw, res.bad.join(' | '));
  }
  await ctx.close();
}
await b.close();
