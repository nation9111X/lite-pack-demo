// Вырезаем логотип из 512px-иконки 1:1 (без масштабирования, без перекраски)
import { chromium } from 'playwright';
import fs from 'node:fs';
const b=await chromium.launch(); const p=await b.newPage();
const data='data:image/png;base64,'+fs.readFileSync('public/brand/web-app-manifest-512x512.png').toString('base64');
const out=await p.evaluate(async(data)=>{const img=new Image();img.src=data;await img.decode();
  const [x0,y0,x1,y1]=[36-6,144-6,474+6,368+6]; const w=x1-x0+1,h=y1-y0+1;
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(img,-x0,-y0);
  return {w,h,png:c.toDataURL('image/png'),webp:c.toDataURL('image/webp',0.98)}},data);
fs.writeFileSync('public/brand/logo.png',Buffer.from(out.png.split(',')[1],'base64'));
fs.writeFileSync('public/brand/logo.webp',Buffer.from(out.webp.split(',')[1],'base64'));
console.log(out.w,out.h, fs.statSync('public/brand/logo.png').size, fs.statSync('public/brand/logo.webp').size);
await b.close();
