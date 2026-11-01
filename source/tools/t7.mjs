import {anon,get} from './api.mjs';
const a=await anon();const T=a.accessToken;
for (const q of ['regionId=96b5a49e3931443a944604671a1ce516','regionId=e02392242878498087b248fe5e21e043']) {
  const t0=Date.now(); const r=await get('v1/categories/8b23600b-d61b-415f-85b9-952b011d7932/products?'+q,T); console.log(q, r.status, (r.json?.products||[]).length, Date.now()-t0+'ms', r.error||'');
  const t1=Date.now(); const c=await get('v1/categories?'+q,T); console.log(' tree', c.status, (c.json?.categories||[]).length, Date.now()-t1+'ms');
}
