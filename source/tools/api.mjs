export const BASE = 'https://lite-pack.ru/api/';
export const H = { 'content-type':'application/json', package:'lite_pack', system:'windows', 'app-type':'web', 'client-id':'', locale:'ru-RU', 'system-version':'10.0;', version:'1.0.18', 'build-number':'70' };
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
async function f(url,opt,tries=4){
  for(let i=0;i<tries;i++){
    try{ const r=await fetch(url,{...opt,signal:AbortSignal.timeout(30000)}); return r; }
    catch(e){ if(i===tries-1) throw e; await sleep(1500*(i+1)); }
  }
}
export async function anon() {
  const r = await f(BASE+'v1/auth/signupAnonymous',{method:'POST',headers:H,body:JSON.stringify({appId:'lite_pack',clientId:null,appType:'shop'})});
  return r.json();
}
export async function get(path, token, extra={}) {
  try {
    const r = await f(BASE+path,{headers:{...H, authorization:'Bearer '+token, ...extra}});
    const t = await r.text(); try { return {status:r.status, json:JSON.parse(t)} } catch { return {status:r.status, text:t} }
  } catch (e) { return {status:0, error:String(e)} }
}
