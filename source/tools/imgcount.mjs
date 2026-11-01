import { chromium } from 'playwright';
const url = process.argv[2]; const js = process.argv[3] !== 'nojs';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, javaScriptEnabled: js });
const p = await ctx.newPage(); let n = 0, kb = 0; const urls = [];
p.on('requestfinished', async (r) => { if (/,fit\//.test(r.url())) { n++; const s = await r.sizes().catch(() => null); kb += (s?.responseBodySize ?? 0) / 1024; urls.push(r.url().slice(0, 50)); } });
await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
console.log(js ? 'JS on' : 'JS off', 'images:', n, Math.round(kb) + 'KB');
await b.close();
