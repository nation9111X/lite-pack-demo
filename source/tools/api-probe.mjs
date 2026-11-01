import { chromium } from 'playwright';
import fs from 'node:fs';
const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const log = [];
p.on('response', async r => { const u=r.url(); if(!u.includes('/api/') && !u.includes('assets/assets/content')) return;
  let body=''; try{body=await r.text()}catch{}
  log.push({method:r.request().method(), url:u, status:r.status(), reqHeaders:r.request().headers(), reqBody:r.request().postData(), resHeaders:r.headers(), body: body.slice(0,300000)}); });
await p.goto('https://lite-pack.ru/', { waitUntil: 'load', timeout: 90000 });
await p.waitForTimeout(15000);
fs.writeFileSync('api-probe.json', JSON.stringify(log,null,1));
await b.close();
