// Склейка скриншотов в одну картинку для быстрого просмотра: node montage.mjs out.png a.png b.png ...
import { chromium } from 'playwright';
import fs from 'node:fs';
const [out, ...files] = process.argv.slice(2);
const imgs = files.map((f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'));
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400 * imgs.length, height: 820 } });
await p.setContent(`<body style="margin:0;display:flex;gap:6px;background:#333">${imgs.map((s) => `<img src="${s}" style="width:390px;height:auto;align-self:flex-start">`).join('')}</body>`);
await p.waitForTimeout(300);
await p.screenshot({ path: out, fullPage: true });
await b.close();
