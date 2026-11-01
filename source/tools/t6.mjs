import {anon,BASE,H} from './api.mjs';
const a=await anon();const T=a.accessToken;
const post=async(p,b,m='POST')=>{const r=await fetch(BASE+p,{method:m,headers:{...H,authorization:'Bearer '+T},body:b?JSON.stringify(b):undefined});const t=await r.text();return {status:r.status,body:t}};
const s=JSON.parse((await post('v1/users/addresses/search',{text:'Ижевск, Пушкинская 154'})).body).addresses[0];
console.log('search hit dep/region/status', s.departmentId, s.regionId, s.workingStatus, s.workingStatusMessage);
let r=await post('v1/users/addresses',{courierAddress:{coordinates:{lat:s.address.lat,lng:s.address.lng},flat:'12',entrance:'2',floor:'3'}});console.log('create',r.status,r.body.slice(0,200), '...', r.body.slice(-400));
const far=JSON.parse((await post('v1/users/addresses/search',{text:'Москва, Тверская 1'})).body).addresses[0];
console.log('far status',far.departmentId,far.regionId,far.workingStatus,far.workingStatusMessage);
const r2=await post('v1/users/addresses',{courierAddress:{coordinates:{lat:far.address.lat,lng:far.address.lng}}});console.log('far create',r2.status,r2.body.slice(0,300));
