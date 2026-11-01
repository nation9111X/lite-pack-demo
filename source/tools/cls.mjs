import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => {
  window.__cls = [];
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__cls.push({ t: Math.round(e.startTime), v: +e.value.toFixed(4), src: e.sources.map((s) => (s.node?.className || s.node?.nodeName || '?') + ` ${Math.round(s.previousRect.y)}→${Math.round(s.currentRect.y)} h${Math.round(s.previousRect.height)}→${Math.round(s.currentRect.height)}`) }))).observe({ type: 'layout-shift', buffered: true });
});
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await p.goto(process.argv[2], { waitUntil: 'networkidle', timeout: 90000 });
await p.waitForTimeout(1500);
console.log(JSON.stringify(await p.evaluate(() => window.__cls), null, 1));
await b.close();
