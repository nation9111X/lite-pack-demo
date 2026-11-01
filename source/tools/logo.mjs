// Анализ логотипов: прозрачность фона и рамка содержимого
import { chromium } from 'playwright';
import fs from 'node:fs';
const b=await chromium.launch(); const p=await b.newPage();
for (const f of ['logo-og.png','logo-app.png','web-app-manifest-512x512.png']) {
  const data='data:image/png;base64,'+fs.readFileSync('public/brand/'+f).toString('base64');
  console.log(f, await p.evaluate(async(data)=>{const img=new Image();img.src=data;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);const d=x.getImageData(0,0,c.width,c.height).data;
   let transp=0,minx=1e9,miny=1e9,maxx=0,maxy=0;for(let y=0;y<c.height;y++)for(let X=0;X<c.width;X++){const i=(y*c.width+X)*4;if(d[i+3]<10){transp++;continue}const lum=d[i]+d[i+1]+d[i+2];if(lum<740){minx=Math.min(minx,X);maxx=Math.max(maxx,X);miny=Math.min(miny,y);maxy=Math.max(maxy,y)}}
   return {w:c.width,h:c.height,transparentPx:transp,corner:Array.from(d.slice(0,4)),bbox:[minx,miny,maxx,maxy]}},data));
}
await b.close();
