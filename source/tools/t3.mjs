import {anon,get,BASE,H} from './api.mjs';
const a = await anon(); const T=a.accessToken;
const post=async(p,b,m='POST')=>{const r=await fetch(BASE+p,{method:m,headers:{...H,authorization:'Bearer '+T},body:b?JSON.stringify(b):undefined});const t=await r.text();return {status:r.status,body:t}};
const sh=(x,n=1500)=>console.log(typeof x==='string'?x.slice(0,n):JSON.stringify(x).slice(0,n));
const dep=await get('v1/deliveries/departments',T); sh(dep.json.departments.map(d=>({id:d.id,kind:d.kind,title:d.title,keys:Object.keys(d)})));
sh(JSON.stringify(dep.json.departments[0]),3000);
const izh=dep.json.departments.find(d=>/Ижевск/.test(d.title))||dep.json.departments[0];
const ad=await post('v1/users/addresses',{departmentId:izh.id}); console.log('\nADDR',ad.status); sh(ad.body,2500);
const addrs=await get('v1/users/addresses',T); console.log('\nADDRS'); sh(addrs.json,2500);
const aid=addrs.json.activeAddressId||addrs.json.addresses?.[0]?.id;
const c1=await post('v1/cart',{userAddressId:aid,items:[{productId:'b39464d0c6714472add98099e5794abe',quantityOfUnits:45}]}); console.log('\nCART1',c1.status); sh(c1.body,4000);
const c2=await post('v1/cart',{userAddressId:aid,items:[{productId:'69db228d251140d8924f18d9c3c7338f',quantityOfUnits:100}]}); console.log('\nCART2',c2.status); sh(c2.body,600);
const g=await get('v1/cart?addressId='+aid,T); console.log('\nGETCART',g.status, (g.json?.cart?.items||g.json?.items||[]).length); sh(g.json,800);
const s=await get('v1/search?q='+encodeURIComponent('стакан')+'&page=1&pageSize=5&regionId=e02392242878498087b248fe5e21e043',T); console.log('\nSEARCH',s.status); sh(s.json,1500);
for(const p of ['v1/wishes','v1/orders','v1/orders/latest','v1/profiles/shopProfiles','v1/contents/faq','v1/orders/history?page=1&pageSize=10&all=true']){const r=await get(p,T);console.log('\n'+p,r.status);sh(r.json||r.text,700)}
