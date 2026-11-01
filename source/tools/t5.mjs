import {anon,BASE,H} from './api.mjs';
const a=await anon();const T=a.accessToken;
const post=async(p,b,m='POST')=>{const r=await fetch(BASE+p,{method:m,headers:{...H,authorization:'Bearer '+T},body:b?JSON.stringify(b):undefined});const t=await r.text();return {status:r.status,body:t}};
const s=JSON.parse((await post('v1/users/addresses/search',{text:'Ижевск, Пушкинская 154'})).body);
console.log('keys',Object.keys(s.addresses[0]), s.addresses.slice(0,4).map(x=>x.address.value));
const first=s.addresses[0];
let r=await post('v1/users/addresses',{courierAddress:first.address});console.log('create(address)',r.status,r.body.slice(0,600));
if(r.status!==200){r=await post('v1/users/addresses',{courierAddress:first});console.log('create(whole)',r.status,r.body.slice(0,600));}
const id=JSON.parse(r.body).id;
const pa=await post('v1/users/addresses/'+id,{flat:'12',entrance:'2',floor:'3'},'PATCH');console.log('patch',pa.status,pa.body.slice(0,300));
const far=JSON.parse((await post('v1/users/addresses/search',{text:'Москва, Тверская 1'})).body).addresses[0];
const r2=await post('v1/users/addresses',{courierAddress:far.address});console.log('far',r2.status,r2.body.slice(0,400));
