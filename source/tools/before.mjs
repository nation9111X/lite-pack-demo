// Скриншоты «было» по маршрутам и ширинам
import { chromium } from 'playwright';
import fs from 'node:fs';
const routes={home:'/',category:'/category/a1b2c3d4-e5f6-4000-8000-000000000001',leaf:'/category/8b23600b-d61b-415f-85b9-952b011d7932',product:'/product/b39464d0c6714472add98099e5794abe',contacts:'/contact-us',faq:'/faq',help:'/help',legal:'/legal',profile:'/profile',orders:'/orders',notfound:'/this-page-does-not-exist'};
const widths=(process.argv[2]||'375,768,1440').split(',').map(Number);
const only=process.argv[3]?process.argv[3].split(','):Object.keys(routes);
const out='../docs/BEFORE_AFTER/before'; fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
for(const w of widths){
  const ctx=await b.newContext({viewport:{width:w,height:w<800?812:900},locale:'ru-RU',isMobile:w<500,hasTouch:w<800});
  const p=await ctx.newPage(); let first=true;
  for(const name of only){
    await p.goto('https://lite-pack.ru'+routes[name],{waitUntil:'load',timeout:90000}); await p.waitForTimeout(first?12000:7000);
    await p.evaluate(()=>document.querySelector('flt-semantics-placeholder')?.click()); await p.waitForTimeout(800);
    for(const t of ['Удмуртия','OK','ОК']){const el=p.getByText(t,{exact:true}).first(); if(await el.count()){await el.click({timeout:2000}).catch(()=>{}); await p.waitForTimeout(1500)}}
    first=false;
    await p.screenshot({path:`${out}/${name}-${w}.png`});
    const sem=await p.evaluate(()=>[...document.querySelectorAll('flt-semantics')].map(n=>(n.getAttribute('aria-label')||(n.childElementCount?'':n.textContent)||'').trim()).filter(Boolean));
    fs.writeFileSync(`${out}/${name}-${w}.txt`, p.url()+'\n'+[...new Set(sem)].join('\n'));
    console.log(w,name,p.url());
  }
  await ctx.close();
}
await b.close();
