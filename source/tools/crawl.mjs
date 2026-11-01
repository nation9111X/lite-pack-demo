// Полный снимок каталога в data/snapshot.json
import {anon,get} from './api.mjs';
import {zonesForSnapshot} from './zones.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data');
const SNAP = path.join(DATA, 'snapshot.json');
const a=await anon(); const T=a.accessToken;
const settings=(await get('v1/contents/settings',T)).json;
const regions=(await get('v1/deliveries/anonym_regions',T)).json.regions;
const departments=(await get('v1/deliveries/departments',T)).json.departments;
const deliveryRegions=zonesForSnapshot((await get('v1/deliveries/regions',T)).json.regions??[]);
const faq=(await get('v1/contents/faq',T)).json;
const tree=(await get('v1/categories',T)).json;
const leaves=[]; const walk=(arr,path)=>arr.forEach(c=>{ if(c.subCategories?.length) walk(c.subCategories,[...path,c.title]); else leaves.push({id:c.id,title:c.title,path}); });
walk(tree.categories,[]);
console.log('leaves',leaves.length);
const products={}; const byCat={}; const priceByRegion={};
async function pool(items,n,fn){let i=0;await Promise.all(Array.from({length:n},async()=>{while(i<items.length){const k=i++;await fn(items[k],k)}}))}
for(const r of regions){
  await pool(leaves,4,async(l)=>{
    const res=await get(`v1/categories/${l.id}/products?regionId=${r.regionId}`,T);
    const ps=res.json?.products||[];
    byCat[l.id]=byCat[l.id]||new Set();
    for(const p of ps){ byCat[l.id].add(p.id); products[p.id]=products[p.id]||p; (priceByRegion[p.id]=priceByRegion[p.id]||{})[r.name]={price:p.price,finalPrice:p.finalPrice,quantityLeft:p.quantityLeft,quantityOfUnitsLeft:p.quantityOfUnitsLeft,outOfStock:p.outOfStock}; }
  });
  console.log('region',r.name,'products so far',Object.keys(products).length);
}
const ids=Object.keys(products); const details={}; fs.mkdirSync(DATA,{recursive:true}); const save=()=>fs.writeFileSync(SNAP,JSON.stringify({fetchedAt:new Date().toISOString(),source:'https://lite-pack.ru/api/v1',settings,regions,departments,deliveryRegions,faq,categoryTree:tree.categories,leafCategories:leaves.map(l=>({...l,productIds:[...(byCat[l.id]||[])]})),products,priceByRegion,productDetails:details})); save();
await pool(ids,3,async(id,k)=>{const d=await get(`v1/products/${id}?regionId=${regions[0].regionId}`,T); if(d.json?.product) details[id]={properties:d.json.product.properties,plants:d.json.product.plants,brands:d.json.product.brands}; if(k%200===0){console.log('details',k);save()}});
const snap={fetchedAt:new Date().toISOString(),source:"https://lite-pack.ru/api/v1",settings,regions,departments,deliveryRegions,faq,categoryTree:tree.categories,leafCategories:leaves.map(l=>({...l,productIds:[...(byCat[l.id]||[])]})),products,priceByRegion,productDetails:details};
fs.mkdirSync(DATA,{recursive:true});
fs.writeFileSync(SNAP,JSON.stringify(snap));
console.log('saved', ids.length,'products', (fs.statSync(SNAP).size/1e6).toFixed(1)+'MB');
