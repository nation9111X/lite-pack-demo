// Разведка живого сайта: сеть + скриншоты + semantics-дерево Flutter.
// node recon.mjs <path> <outDir> [width]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const target = process.argv[2] || '/';
const outDir = process.argv[3] || 'out';
const widths = process.argv[4] ? [Number(process.argv[4])] : [375, 768, 1440];
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const net = [];
for (const w of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 800 ? 812 : 900 }, deviceScaleFactor: 1, locale: 'ru-RU' });
  const page = await ctx.newPage();
  page.on('response', async (r) => {
    const u = r.url();
    if (!/lite-pack|yandexcloud/.test(u) || /\.(js|wasm|png|jpg|webp|svg|ttf|otf|woff2?|gif|ico)(\?|$)/.test(u)) return;
    let body = '';
    try { body = (await r.text()).slice(0, 200000); } catch {}
    net.push({ w, method: r.request().method(), url: u, status: r.status(), reqBody: r.request().postData(), headers: r.request().headers(), body });
  });
  await page.goto('https://lite-pack.ru' + target, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(6000);
  await page.screenshot({ path: path.join(outDir, `w${w}.png`), fullPage: false });
  // Включаем semantics-дерево Flutter, чтобы прочитать текст
  await page.evaluate(() => {
    const p = document.querySelector('flt-semantics-placeholder');
    if (p) p.click();
  });
  await page.waitForTimeout(1500);
  const sem = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('flt-semantics').forEach((n) => {
      const label = n.getAttribute('aria-label') || '';
      const role = n.getAttribute('role') || '';
      const txt = (n.childElementCount === 0 ? n.textContent : '').trim();
      const r = n.getBoundingClientRect();
      if (label || txt) out.push(`${role}|${label || txt}|${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)}x${Math.round(r.height)}`);
    });
    return out;
  });
  fs.writeFileSync(path.join(outDir, `sem${w}.txt`), sem.join('\n'));
  fs.writeFileSync(path.join(outDir, `url${w}.txt`), page.url());
  await ctx.close();
}
fs.writeFileSync(path.join(outDir, 'net.json'), JSON.stringify(net, null, 1));
await browser.close();
console.log('ok', net.length, 'requests');
