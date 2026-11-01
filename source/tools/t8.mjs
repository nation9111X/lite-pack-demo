import {anon,BASE,H,get} from './api.mjs';
const a=await anon();const T=a.accessToken;
const post=async(p,b,m='POST')=>{const r=await fetch(BASE+p,{method:m,headers:{...H,authorization:'Bearer '+T},body:b?JSON.stringify(b):undefined});return r.json()};
const c=await post('v1/users/addresses',{courierAddress:{coordinates:{lat:56.842004,lng:53.215946}}});
console.log('POST', c.id, 'region', c.regionId, 'dep', c.departmentId);
const g=await get('v1/users/addresses',T);
console.log('GET', JSON.stringify(g.json.addresses.map(x=>({id:x.id,regionId:x.regionId,departmentId:x.departmentId,src:x.sourceDepartmentIds}))), 'active', g.json.activeAddressId);
