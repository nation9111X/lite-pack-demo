// Сравнение «было / стало»: node compare.mjs <out.png> <before.png> <after.png> [ширина колонки]
import { chromium } from 'playwright';
import fs from 'node:fs';
const [out, before, after, colW = '700'] = process.argv.slice(2);
const src = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: Number(colW) * 2 + 60, height: 600 } });
await p.setContent(`<body style="margin:0;padding:16px;background:#1d2422;font:600 18px system-ui;color:#fff;display:grid;grid-template-columns:repeat(2,${colW}px);gap:20px;align-items:start">
<div><div style="margin-bottom:8px;color:#e8a">Было (Flutter)</div><img src="${src(before)}" style="width:100%;border-radius:8px"></div>
<div><div style="margin-bottom:8px;color:#7d7">Стало</div><img src="${src(after)}" style="width:100%;border-radius:8px"></div></body>`);
await p.waitForTimeout(300);
await p.screenshot({ path: out, fullPage: true });
await b.close();
