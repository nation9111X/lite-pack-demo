// Загрузка главного потока на телефоне: в покое страница не должна его занимать, иначе на слабых устройствах подвисает.
// fps при замедлении сильно зависит от соседних программ, а эта цифра нет. node idle-check.mjs [база]
import { chromium } from 'playwright';

const base = (process.argv[2] || 'http://localhost:5193').replace(/\/$/, '');
const b = await chromium.launch({ channel: 'chromium', args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });

async function run(name, url, { webgl = true, at = 0, scroll = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'ru-RU' });
  await ctx.addInitScript((gl) => {
    localStorage.setItem('lp.theme', 'dark');
    localStorage.setItem('lp.cookieAccepted', 'true');
    localStorage.setItem('lp.regionSkipped', 'true');
    if (!gl) {
      const g = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/.test(t) ? null : g.call(this, t, ...a); };
    }
  }, webgl);
  const p = await ctx.newPage();
  await p.goto(base + url, { waitUntil: 'load' });
  await p.waitForTimeout(2500);
  if (at) await p.evaluate((y) => window.scrollTo(0, y), at);
  await p.waitForTimeout(800);
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Performance.enable');
  const get = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const m0 = await get();
  const dur = 5000;
  if (scroll) {
    await p.evaluate(async (d) => {
      const t0 = performance.now();
      await new Promise((res) => {
        const s = () => {
          const k = (performance.now() - t0) / d;
          window.scrollTo(0, Math.min(1, k) * 5000);
          if (k < 1) requestAnimationFrame(s); else res();
        };
        requestAnimationFrame(s);
      });
    }, dur);
  } else await p.waitForTimeout(dur);
  const m1 = await get();
  const d = (k) => m1[k] - m0[k];
  const t = d('Timestamp');
  console.log(name.padEnd(28), `поток ${Math.round((d('TaskDuration') / t) * 100)}% | стили ${Math.round((d('RecalcStyleDuration') / t) * 100)}% (${Math.round(d('RecalcStyleCount') / t)}/с) | код ${Math.round((d('ScriptDuration') / t) * 100)}%`);
  await ctx.close();
}
await run('главная, покой', '/');
await run('главная, покой, без сцены', '/', { webgl: false });
await run('лента, покой', '/', { at: 780 });
await run('низ главной, покой', '/', { at: 9000 });
await run('главная, прокрутка', '/', { scroll: true });
await run('раздел, покой', '/category/8b23600b-d61b-415f-85b9-952b011d7932');
await run('раздел, прокрутка', '/category/8b23600b-d61b-415f-85b9-952b011d7932', { scroll: true });
await run('корзина, покой', '/cart');
await b.close();
