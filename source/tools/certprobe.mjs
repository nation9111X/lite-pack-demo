import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage();
p.on('console', m => { if (m.type()==='error') console.log('CONSOLE', m.text().slice(0,120), JSON.stringify(m.location())); });
p.on('requestfailed', r => console.log('FAILED', r.url().slice(0,160), r.failure()?.errorText));
p.on('response', r => { if (r.status()>=400) console.log('HTTP', r.status(), r.url().slice(0,160)); });
await p.goto('http://localhost:5190/', { waitUntil: 'networkidle' });
await p.waitForTimeout(2000);
await b.close();
