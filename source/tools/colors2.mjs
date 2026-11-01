import { chromium } from 'playwright';
import fs from 'node:fs';
const b=await chromium.launch(); const p=await b.newPage();
const [file,...pts]=process.argv.slice(2);
const data='data:image/png;base64,'+fs.readFileSync(file).toString('base64');
console.log(await p.evaluate(async({data,pts})=>{const img=new Image();img.src=data;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);
 return pts.map(s=>{const [px,py]=s.split(',').map(Number);const a=x.getImageData(px,py,1,1).data;return s+'='+'#'+[a[0],a[1],a[2]].map(v=>v.toString(16).padStart(2,'0')).join('')}).join('  ')},{data,pts}));
await b.close();
