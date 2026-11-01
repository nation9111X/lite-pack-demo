// node flow.mjs steps.json outDir width
import { chromium } from 'playwright';
import fs from 'node:fs';
const steps = JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const out = process.argv[3]; const w = Number(process.argv[4]||1440);
fs.mkdirSync(out,{recursive:true});
const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport:{width:w,height:w<800?812:900}, locale:'ru-RU', hasTouch: w<800, isMobile: w<500, deviceScaleFactor: 1 });
const p = await ctx.newPage();
const log=[];
p.on('response', async r=>{const u=r.url(); if(!u.includes('/api/'))return; let body='';try{body=await r.text()}catch{}; log.push({t:Date.now(),method:r.request().method(),url:u,status:r.status(),reqBody:r.request().postData(),body:body.slice(0,20000)});});
await p.goto('https://lite-pack.ru'+(steps.start||'/'),{waitUntil:'load',timeout:90000});
await p.waitForTimeout(12000);
let i=0;
for (const s of steps.steps) {
  i++;
  if (s.click) await p.mouse.click(s.click[0], s.click[1]);
  if (s.type) await p.keyboard.type(s.type, {delay:60});
  if (s.key) await p.keyboard.press(s.key);
  if (s.scroll) { await p.mouse.move(s.scroll[0], s.scroll[1]); await p.mouse.wheel(0, s.scroll[2]); }
  if (s.goto) await p.goto('https://lite-pack.ru'+s.goto,{waitUntil:'load'});
  await p.waitForTimeout(s.wait||2500);
  if (s.shot!==false) await p.screenshot({path:`${out}/${String(i).padStart(2,'0')}-${s.name||'step'}.png`, fullPage:false});
  log.push({step:i, name:s.name, url:p.url()});
}
fs.writeFileSync(out+'/api.json', JSON.stringify(log,null,1));
await b.close();
