import { chromium } from 'playwright';
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.route((u) => /(^|\.)(mc|mdd)\.yandex\.(ru|net)$/.test(u.hostname), (r) => r.abort());
await ctx.addInitScript(() => { localStorage.setItem('lp.cookieAccepted','true'); localStorage.setItem('lp.regionSkipped','true'); });
const p = await ctx.newPage();
for (const [name, id] of [['round','b39464d0c6714472add98099e5794abe'],['box','ea49268c326742599ae66d79fb8bb50f']]) {
  await p.goto((process.argv[2] || 'http://localhost:5191') + '/product/' + id, { waitUntil: 'networkidle' });
  const d = p.locator('.dims3d'); await d.scrollIntoViewIfNeeded(); await p.waitForTimeout(700);
  await d.screenshot({ path: '../docs/review/v2/d-' + name + '-1.png' });
  const cv = await p.locator('.dims3d__canvas').boundingBox();
  await p.mouse.move(cv.x + cv.width/2, cv.y + cv.height/2); await p.mouse.down();
  await p.mouse.move(cv.x + cv.width/2 + 220, cv.y + cv.height/2 + 60, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(200);
  await d.screenshot({ path: '../docs/review/v2/d-' + name + '-2.png' });
}
await b.close();
