// Проверка выложенной сборки для показа: node live-check.mjs https://lite-pack-redesign.netlify.app
// Каталог и цены через прокси на lite-pack.ru, улучшенные фото, плашка, noindex, без Метрики.
import { chromium } from 'playwright';

const base = (process.argv[2] || '').replace(/\/$/, '');
const res = await fetch(base + '/', { redirect: 'manual' });
const robots = await (await fetch(base + '/robots.txt')).text();
// прокси до API lite-pack.ru: любой ответ сервера в JSON (даже «нужна авторизация») значит, что прокси работает
const api = await fetch(base + '/api/v1/contents/settings');
console.log('главная:', res.status, '| X-Robots-Tag:', res.headers.get('x-robots-tag'), '| robots.txt:', robots.trim().split('\n').join(' / '));
console.log('прокси API:', api.status, api.headers.get('content-type'));

const b = await chromium.launch();
for (const [w, h, mobile] of [[1440, 900, false], [390, 844, true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, locale: 'ru-RU' });
  // согласие с cookie — чтобы проверить, что Метрика не стартует даже после него
  await ctx.addInitScript(() => localStorage.setItem('lp.cookieAccepted', 'true'));
  const p = await ctx.newPage();
  const errors = [];
  const metrika = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('request', (r) => /mc\.yandex/.test(r.url()) && metrika.push(r.url()));
  for (const path of ['/', '/category/8b23600b-d61b-415f-85b9-952b011d7932', '/product/d000b67d3cb6479b99ee3f7f76baa07f']) {
    await p.goto(base + path, { waitUntil: 'load', timeout: 60000 });
    await p.waitForTimeout(3500);
    const r = await p.evaluate(() => {
      const imgs = [...document.querySelectorAll('main img')].filter((i) => i.complete && i.getBoundingClientRect().width > 0);
      return {
        strip: !!document.querySelector('.preview-strip'),
        noindex: !!document.querySelector('meta[name="robots"][content*="noindex"]'),
        prices: [...document.querySelectorAll('.price, .pcard__price, .prod__price')].filter((e) => /\d/.test(e.textContent)).length,
        imgs: imgs.length, pimg: imgs.filter((i) => (i.currentSrc || i.src).includes('/pimg/')).length, broken: imgs.filter((i) => !i.naturalWidth).length,
      };
    });
    console.log(`${w}px ${path.slice(0, 30).padEnd(30)}`, JSON.stringify(r));
  }
  await p.screenshot({ path: `../docs/review/live-${w}.png` });
  console.log(`${w}px:`, errors.length ? 'ошибки: ' + errors.join(' | ') : 'без ошибок', '| запросов к Метрике:', metrika.length);
  await ctx.close();
}
await b.close();
