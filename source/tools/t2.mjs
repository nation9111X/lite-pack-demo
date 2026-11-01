import {anon,get} from './api.mjs';
const a = await anon();
const c = await get('v1/categories', a.accessToken);
const leaf = c.json.categories[0].subCategories[0].subCategories[0];
let r = await get('v1/categories/'+leaf.id+'/products', a.accessToken);
console.log(r.status, JSON.stringify(r.json||r.text).slice(0,3000));
const pid = r.json?.products?.[0]?.id;
if (pid) { const p = await get('v1/products/'+pid, a.accessToken); console.log('\nPRODUCT', p.status, JSON.stringify(p.json||p.text).slice(0,4000)); }
