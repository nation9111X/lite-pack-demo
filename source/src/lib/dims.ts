import type { Property } from '../api/types';

// Габариты товара — из характеристик API, а для контейнеров, коробок и лотков без размеров в характеристиках —
// из названия товара («…121х106х55 мм»). Ничего не угадываем: нет чисел — нет схемы.
// Круглая форма: верхний/нижний диаметр + высота; прямоугольная: длина × ширина × высота.
export type DimsSource = 'props' | 'title';
export type Dims =
  | { kind: 'round'; top: number; bottom: number; height: number; source?: DimsSource }
  | { kind: 'box'; length: number; width: number; height: number; source?: DimsSource }
  // треугольная коробка под сэндвич: стороны прямого угла legA (по столу) и legB (вверх), толщина depth
  | { kind: 'wedge'; legA: number; legB: number; depth: number; height: number; source?: DimsSource };

/** Коробки под сэндвич — треугольные: «ECO Sandwich 126х126х40» = стороны прямого угла 126 и 126, толщина 40. */
const WEDGE = /sandwich|сэндвич|сендвич|треугольн/i;

/** «150 мм», «3.8 см», «12,5 см» → миллиметры. Всё, что сложнее (диапазоны, «100х85 мм»), — не берём. */
export function toMm(raw: string | undefined): number | null {
  if (!raw) return null;
  const m = raw.trim().replace(',', '.').match(/^(\d+(?:\.\d+)?)\s*(мм|см|м)?\.?$/i);
  if (!m) return null;
  const v = Number(m[1]);
  const u = (m[2] ?? '').toLowerCase();
  if (!v || !Number.isFinite(v)) return null;
  if (u === 'см') return v * 10;
  if (u === 'м') return v * 1000;
  if (u === 'мм') return v;
  return null; // без единицы — неоднозначно
}

// Только упаковка «коробом»: контейнеры, коробки, лотки, подложки, ланч-боксы.
// Пакеты, плёнка, мешки и т. п. — нет: у них три числа значат ширину, длину и толщину.
// (\b в JS не работает с кириллицей — границы слова через просмотр соседних букв)
const BOXY = /контейнер|коробк|коробочк|короб(?![а-яё])|лот(?:ок|ки|ка|ков)|подложк|ланч-?бокс|(?<![а-яё])бокс(?![а-яё])|салатник/i;
// сам товар — не короб (название начинается с крышки, пакета и т. п.); «контейнер (без крышки)» при этом подходит
const NOT_BOXY = /^\s*(?:крышк|пакет|пл[её]нк|мешк|мешок|губк|салфет|ручк|стрейч|фольг|бумаг|скотч|перчат|вкладыш)/i;
const TITLE_DIMS = /(\d+(?:[.,]\d+)?)\s*[xхХ×*]\s*(\d+(?:[.,]\d+)?)\s*[xхХ×*]\s*(\d+(?:[.,]\d+)?)\s*(мм|см)?/i;

/** «Контейнер OpSalad 350 мл, 121х106х55 мм» → короб 121 × 106 × 55 мм (последнее число — высота). */
export function titleDims(title: string | undefined): Dims | null {
  if (!title || !BOXY.test(title) || NOT_BOXY.test(title)) return null;
  const m = title.match(TITLE_DIMS);
  if (!m) return null;
  const k = (m[4] ?? '').toLowerCase() === 'см' ? 10 : 1;
  const [length, width, height] = [m[1], m[2], m[3]].map((x) => Number(x.replace(',', '.')) * k);
  // без единиц принимаем только правдоподобные миллиметры
  const ok = (v: number) => Number.isFinite(v) && v >= (m[4] ? 3 : 10) && v <= 1200;
  if (![length, width, height].every(ok)) return null;
  if (WEDGE.test(title)) return { kind: 'wedge', legA: length, legB: width, depth: height, height: width, source: 'title' };
  return { kind: 'box', length, width, height, source: 'title' };
}

export function parseDims(props: Property[] | undefined, title?: string): Dims | null {
  const fromProps = propsDims(props);
  return fromProps ? { ...fromProps, source: 'props' } : titleDims(title);
}

function propsDims(props: Property[] | undefined): Dims | null {
  if (!props?.length) return null;
  const get = (...names: string[]) => {
    for (const n of names) {
      const p = props.find((x) => x.title.trim().toLowerCase() === n.toLowerCase());
      const v = toMm(p?.data);
      if (v) return v;
    }
    return null;
  };
  const height = get('Высота', 'Внешняя высота', 'Высота, мм', 'Внешняя высота, мм');
  const top = get('Верхний диаметр', 'Диаметр');
  const bottom = get('Нижний диаметр') ?? (top && get('Диаметр') ? top : null);
  if (top && bottom && height) return { kind: 'round', top, bottom, height };
  const length = get('Длина', 'Внешняя длина', 'Длина, мм');
  const width = get('Ширина', 'Внешняя ширина', 'Ширина, мм');
  if (length && width && height) return { kind: 'box', length, width, height };
  return null;
}

/** Банковская карта ID-1 по ISO/IEC 7810 — для наглядного масштаба. */
export const CARD_MM = { w: 85.6, h: 53.98 };
