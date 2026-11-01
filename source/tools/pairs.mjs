// Пары «основание ↔ крышка» по названиям товаров (подсказка в корзине «Не забудьте крышки»).
// Совпадение — только по сильным признакам: код модели с дефисом (C-19, ПР-СТ-80, М-195)
// или размеры основания «108х82» (±1 мм). Объём («500 мл») не считается: по нему пары ложные.
//   node tools/pairs.mjs — показать все найденные пары по снимку каталога
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const norm = (t) => t.toLowerCase().replace(/ё/g, 'е');
// «с крышкой», «с неразъёмной крышкой», «со сопряжённой прозрачной крышкой» — товар уже с крышкой
const withLid = (t) => /(^|\s)(с|со)\s+(\S+\s+){0,2}\S*крышк|в комплекте|\+\s*крышк/.test(norm(t));
// у тортниц крышка — буква «К» в коде: «Тортница Т-019 К», «Т-022 КН», «Т-1010К (ПЭТ)»; дно — «ДШ», «ДН»
const cakeLid = (t) => /тортниц\S*\s+\S+?\s?к[нв]?(\s|\(|$)/.test(norm(t));
export const isLid = (t) => (/крышк/.test(norm(t)) || cakeLid(t)) && !withLid(t) && !/без\s+крышк/.test(norm(t));
const isBase = (t) => !isLid(t) && !withLid(t) && /(^|\s)дно|контейнер|стакан|миск|салатник|ланч|емкост|соусник|креманк|форма|тарелк|тортниц/.test(norm(t));
const LAT = { A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х' };
const cyr = (s) => s.replace(/[ABCEHKMOPTX]/g, (c) => LAT[c]);
// код модели без буквы исполнения: «Т-1010ДН» и «Т-1010К» — одна модель «Т-1010»
// «d-233», «h-91» — диаметр и высота, а не модель: такие «коды» не считаются
const codes = (t) => (cyr(t.toUpperCase()).match(/(?<![А-ЯA-Z0-9])[А-ЯA-Z]{1,4}(?:-[А-ЯA-Z]{1,4})*-\d{2,4}(?![0-9])/g) || []).filter((c) => !/^[DДНHØ]-\d+$/.test(c));
const dims = (t) => {
  const m = norm(t).match(/(\d{2,3})\s*[хx*]\s*(\d{2,3})/);
  return m ? [Number(m[1]), Number(m[2])] : null;
};
const sameDims = (a, b) => !!a && !!b && Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1;
// Стаканы — по диаметру («D80», «TLS-D80», «D-95»): горячие бумажные — крышки с клапаном, холодные — для холодных напитков
const diam = (t) => {
  const m = cyr(t.toUpperCase()).match(/(?:^|[^А-ЯA-Z])[DДØ]\s?-?\s?(\d{2,3})(?!\d)/);
  return m ? Number(m[1]) : null;
};
const isCup = (t) => /стакан|креманк/.test(norm(t));
const cupFits = (cup, lid) => {
  const c = norm(cup), l = norm(lid);
  if (/холодн/.test(l) && /горяч|бумажн/.test(c)) return false;
  if (/tls|клапан/.test(l) && /холодн|пэт|пласт/.test(c)) return false;
  return true;
};

/** { idОснования: [idКрышки, …] } */
export function lidPairs(products) {
  const lids = products.filter((p) => isLid(p.info.title)).map((p) => ({ p, c: codes(p.info.title), d: dims(p.info.title), dm: diam(p.info.title) }));
  const out = {};
  for (const b of products) {
    const t = b.info.title;
    if (!isBase(t)) continue;
    const c = codes(t), d = dims(t), dm = isCup(t) ? diam(t) : null;
    if (!c.length && !d && !dm) continue;
    const fits = (l) => l.c.some((x) => c.includes(x)) || sameDims(l.d, d) || (!!dm && l.dm === dm && cupFits(t, l.p.info.title));
    const hit = lids.filter((l) => l.p.id !== b.id && fits(l)).map((l) => l.p.id);
    if (hit.length) out[b.id] = hit.slice(0, 3);
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fs = await import('node:fs');
  const s = JSON.parse(fs.readFileSync(new URL('../data/snapshot.json', import.meta.url), 'utf8'));
  const P = Object.values(s.products);
  const pairs = lidPairs(P);
  const T = Object.fromEntries(P.map((p) => [p.id, p.info.title]));
  const keys = Object.keys(pairs);
  console.log('оснований с крышкой:', keys.length, 'из', P.length);
  for (const k of keys) console.log(T[k], ' → ', pairs[k].map((x) => T[x]).join(' | '));
}
