import { chromium } from 'playwright';
import fs from 'node:fs';
const b=await chromium.launch(); const p=await b.newPage();
async function sample(file, pts){
  const data='data:image/png;base64,'+fs.readFileSync(file).toString('base64');
  return p.evaluate(async({data,pts})=>{const img=new Image();img.src=data;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);
   const hex=(a)=>'#'+[a[0],a[1],a[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
   const out={};for(const [k,px,py] of pts){out[k]=hex(x.getImageData(px,py,1,1).data)}
   // histogram of dominant colors
   const d=x.getImageData(0,0,c.width,c.height).data;const h={};for(let i=0;i<d.length;i+=4){if(d[i+3]<250)continue;const k=hex([d[i],d[i+1],d[i+2]]);h[k]=(h[k]||0)+1}
   out.top=Object.entries(h).sort((a,b)=>b[1]-a[1]).slice(0,8);return out},{data,pts});
}
console.log('logo512', JSON.stringify(await sample('../public/brand/web-app-manifest-512x512.png',[['green',120,300],['black',60,220]])));
console.log('home', JSON.stringify(await sample('../docs/BEFORE_AFTER/before/flow1/04-sub-containers.png',[['btn',340,340],['bg',10,10],['card',320,200],['title',365,140],['backBtnBg',318,128],['arrow',328,139],['panel',200,600],['price',330,310]])));
console.log('probe', JSON.stringify(await sample('probe.png',[['banner',700,120],['skipBtn',600,571]])));
await b.close();
