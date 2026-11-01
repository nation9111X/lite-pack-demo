import {anon,get} from './api.mjs';
const a = await anon(); console.log(Object.keys(a), a.profileKind);
const c = await get('v1/categories', a.accessToken);
const leaf = c.json.categories[0].subCategories[0].subCategories[0];
console.log('top products', c.json.products?.length, 'leaf', leaf.title, leaf.products?.length, leaf.hasSubcategories);
const r = await get('v1/categories/'+leaf.id, a.accessToken);
console.log(r.status, JSON.stringify(r.json||r.text).slice(0,2500));
