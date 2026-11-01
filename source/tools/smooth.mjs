// Замер плавности: прокрутка колесом + наведение на карточки; считаем кадры и кто их задерживает.
//   node smooth.mjs http://localhost:5191 [cpuSlowdown]
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://localhost:5191';
const cpu = Number(process.argv[3] || 1);
const all = [['главная', '/'], ['категория', '/category/8b23600b-d61b-415f-85b9-952b011d7932'], ['товар', '/product/b39464d0c6714472add98099e5794abe']];
const only = process.argv[4];
const pages = only ? all.filter(([n]) => n === only) : all;
// полноценный headless Chrome с настоящей видеокартой (headless-shell рисует процессором и искажает замер)
const b = await chromium.launch({ channel: 'chromium', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU', reducedMotion: process.env.RM ? 'reduce' : 'no-preference' });
await ctx.route((u) => /(^|\.)(mc|mdd)\.yandex\.(ru|net)$/.test(u.hostname), (r) => r.abort());
await ctx.addInitScript(() => {
  localStorage.setItem('lp.cookieAccepted', 'true'); localStorage.setItem('lp.regionSkipped', 'true');
  window.__loaf = [];
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__loaf.push(e.toJSON()))).observe({ type: 'long-animation-frame', buffered: true }); } catch {}
});
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
for (const [name, path] of pages) {
  await p.goto(base + path, { waitUntil: 'load' });
  await p.waitForTimeout(2500);
  if (process.env.CSS) await p.addStyleTag({ content: process.env.CSS });
  const mode = process.env.MODE || 'both';
  await p.evaluate(() => {
    window.__loaf = [];
    const d = (window.__frames = []);
    let last = performance.now();
    const tick = (t) => { d.push(t - last); last = t; if (!window.__stop) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await p.mouse.move(720, 500);
  // плавная прокрутка вниз колесом, как рукой
  if (mode !== 'hover') for (let i = 0; i < 45; i++) { await p.mouse.wheel(0, 110); await p.waitForTimeout(30); }
  await p.waitForTimeout(700);
  // наведение на карточки/плитки по сетке
  if (mode !== 'scroll') for (let y = 250; y <= 750; y += 125) for (let x = 200; x <= 1240; x += 260) { await p.mouse.move(x, y, { steps: 4 }); await p.waitForTimeout(40); }
  if (mode !== 'hover') for (let i = 0; i < 45; i++) { await p.mouse.wheel(0, -110); await p.waitForTimeout(30); }
  await p.waitForTimeout(700);
  const r = await p.evaluate(() => {
    window.__stop = true;
    const f = window.__frames.slice(1);
    const sorted = [...f].sort((a, b) => a - b);
    const q = (x) => sorted[Math.floor(sorted.length * x)];
    const scripts = {};
    for (const e of window.__loaf) for (const s of e.scripts || []) {
      const k = (s.sourceURL || '').split('/').pop().split('?')[0].slice(0, 28) + ' ' + (s.sourceFunctionName || '') + ' / ' + (s.invoker || '').slice(0, 40);
      scripts[k] = scripts[k] || [0, 0]; scripts[k][0] += s.duration; scripts[k][1] += s.forcedStyleAndLayoutDuration || 0;
    }
    const loafStyle = window.__loaf.reduce((a, e) => a + Math.max(0, e.startTime + e.duration - e.styleAndLayoutStart), 0);
    return {
      frames: f.length, avg: +(f.reduce((a, b) => a + b, 0) / f.length).toFixed(1), p95: +q(0.95).toFixed(1), p99: +q(0.99).toFixed(1), max: Math.round(sorted[sorted.length - 1]),
      over25: f.filter((x) => x > 25).length, over50: f.filter((x) => x > 50).length,
      loaf: window.__loaf.length, loafMs: Math.round(window.__loaf.reduce((a, e) => a + e.duration, 0)), styleLayoutMs: Math.round(loafStyle),
      worst: [...window.__loaf].sort((a, b) => b.duration - a.duration).slice(0, 3).map((e) => ({ dur: Math.round(e.duration), block: Math.round(e.blockingDuration), render: Math.round(e.startTime + e.duration - (e.renderStart || e.startTime)), style: Math.round(e.startTime + e.duration - (e.styleAndLayoutStart || e.startTime + e.duration)), scripts: (e.scripts || []).map((x) => (x.sourceFunctionName || '?') + '@' + (x.sourceURL || '').split('/').pop().split('?')[0] + ' ' + x.invoker + ' ' + Math.round(x.duration) + 'мс/раскл ' + Math.round(x.forcedStyleAndLayoutDuration)) })),
      top: Object.entries(scripts).sort((a, b) => b[1][0] - a[1][0]).slice(0, 6).map(([k, v]) => `${Math.round(v[0])}мс (раскладка ${Math.round(v[1])}) ${k}`),
    };
  });
  console.log(`== ${name}: кадров ${r.frames}, средний ${r.avg} мс, p95 ${r.p95}, p99 ${r.p99}, макс ${r.max} | >25мс: ${r.over25}, >50мс: ${r.over50} | долгих кадров ${r.loaf} (${r.loafMs} мс, из них стили/раскладка ${r.styleLayoutMs} мс)`);
  if (r.top.length) console.log('   скрипты:', r.top.join(' | '));
  if (process.env.DETAIL) console.log('   худшие кадры:', JSON.stringify(r.worst, null, 1));
}
await b.close();
