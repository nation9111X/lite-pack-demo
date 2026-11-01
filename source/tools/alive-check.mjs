// Живые эффекты на телефоне: плавность главной (процессор замедлен ×4), переходы между страницами, смена темы,
// поворот коробки пальцем, появление блоков. node alive-check.mjs [http://localhost:5193]
import { chromium } from 'playwright';

const base = (process.argv[2] || 'http://localhost:5193').replace(/\/$/, '');
const b = await chromium.launch({ channel: 'chromium', args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'ru-RU' });
await ctx.addInitScript(() => {
  localStorage.setItem('lp.theme', 'dark');
  localStorage.setItem('lp.cookieAccepted', 'true');
  localStorage.setItem('lp.regionSkipped', 'true');
});
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push('page: ' + e.message));
p.on('console', (m) => m.type() === 'error' && !/ERR_|Failed to load/.test(m.text()) && errs.push(m.text().slice(0, 200)));
await p.goto(base + '/', { waitUntil: 'load' });
await p.waitForTimeout(3000);

// ---------- плавность ----------
const cdp = await ctx.newCDPSession(p);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const perf = await p.evaluate(async () => {
  const frames = [];
  let last = performance.now(), run = true;
  const tick = (t) => { frames.push(t - last); last = t; if (run) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  const max = document.documentElement.scrollHeight - innerHeight;
  const t0 = performance.now();
  const dur = 14000;
  await new Promise((res) => {
    const s = () => {
      const k = (performance.now() - t0) / dur;
      window.scrollTo(0, Math.min(1, k) * Math.min(max, 7000));
      if (k < 1) requestAnimationFrame(s); else res();
    };
    requestAnimationFrame(s);
  });
  run = false;
  const sorted = [...frames].sort((a, b) => a - b);
  return { frames: frames.length, fps: Math.round(frames.length / (dur / 1000)), p50: +sorted[sorted.length >> 1].toFixed(1), p95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1), over50: frames.filter((f) => f > 50).length };
});
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
console.log('плавность (×4 замедление):', JSON.stringify(perf));

// ---------- появление при прокрутке ----------
const rv = await p.evaluate(() => ({ hiddenLeft: document.querySelectorAll('.rv:not(.rv-in)').length, seen: document.querySelectorAll('.pcard, .stile, .step').length }));
console.log('появление:', JSON.stringify(rv));

// ---------- коробка пальцем ----------
await p.evaluate(() => window.scrollTo(0, 0));
await p.waitForTimeout(500);
const box = await p.locator('.box-scene').boundingBox();
const boxRy = () => p.evaluate(() => /rotateY\(([^)]+)\)/.exec(document.querySelector('.box').style.transform)?.[1] ?? '-');
const ry0 = await boxRy();
const touch = await ctx.newCDPSession(p);
const y = box.y + box.height / 2, x0 = box.x + 80;
await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
for (let i = 1; i <= 8; i++) {
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + i * 22, y }] });
  await p.waitForTimeout(16);
}
const ry1 = await boxRy();
await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
console.log('коробка: поворот', ry0, '→', ry1, '| подсказка скрыта:', await p.evaluate(() => document.querySelector('.box-scene').classList.contains('is-touched')));

// ---------- переход на страницу: перелёт фото ----------
const cat = '/category/0d140123-f974-4ee9-b5f0-1aa8a868733b';
await p.goto(base + cat, { waitUntil: 'load' });
await p.waitForSelector('.pcard__title a', { timeout: 15000 });
await p.waitForTimeout(600);
const trans = await p.evaluate(() => new Promise((res) => {
  const orig = document.startViewTransition.bind(document);
  let used = 0;
  document.startViewTransition = (cb) => { used++; return orig(cb); };
  const link = document.querySelector('.pcard__title a');
  const img = link.closest('.pcard').querySelector('.pcard__media img');
  link.click();
  const named = img.style.getPropertyValue('view-transition-name');
  const t0 = performance.now();
  const check = () => {
    const h1 = document.querySelector('.prod__title');
    if (h1 || performance.now() - t0 > 4000) res({ used, named, url: location.pathname.slice(0, 20), productShownMs: Math.round(performance.now() - t0), galleryName: document.querySelector('.gallery__stage img')?.style.viewTransitionName || '' });
    else requestAnimationFrame(check);
  };
  check();
}));
console.log('переход на товар:', JSON.stringify(trans));
await p.waitForTimeout(700);
await p.goBack();
await p.waitForSelector('.pcard__title a', { timeout: 15000 });

// ---------- смена темы ----------
const theme0 = await p.evaluate(() => document.documentElement.dataset.theme);
await p.locator('.hdr__mobile-theme .theme-btn').click();
await p.waitForTimeout(900);
const theme1 = await p.evaluate(() => ({ t: document.documentElement.dataset.theme, meta: document.querySelector('meta[name=theme-color]').content, cls: document.documentElement.className, saved: localStorage.getItem('lp.theme') }));
console.log('тема:', theme0, '→', JSON.stringify(theme1));
console.log('ошибки:', errs.length ? errs.join(' | ') : 'нет');
await b.close();
