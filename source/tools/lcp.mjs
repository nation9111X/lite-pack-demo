import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => {
  window.__lcp = [];
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lcp.push({ t: Math.round(e.startTime), size: e.size, el: e.element ? (e.element.className || e.element.tagName) + ':' + (e.element.textContent || '').slice(0, 30) : e.url?.slice(0, 60) }))).observe({ type: 'largest-contentful-paint', buffered: true });
});
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await p.goto(process.argv[2] || 'http://localhost:5193/', { waitUntil: 'networkidle', timeout: 90000 });
await p.waitForTimeout(2000);
console.log(JSON.stringify(await p.evaluate(() => window.__lcp), null, 0));
await b.close();
