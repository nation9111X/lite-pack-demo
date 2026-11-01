// Сценарии консультанта «Подбор упаковки». Здесь только правила: в каких разделах каталога искать и по каким
// словам в названии отбирать. Сами товары, цены и наличие — живые, из API для адреса покупателя.
// Крышки подбираются к выбранному основанию по парам из tools/pairs.mjs (код модели, размер, диаметр).

export type Priority = 'cheap' | 'eco' | 'premium';

export interface KitRole {
  key: string;
  title: string;
  cats: string[];
  inc?: RegExp;
  exc?: RegExp;
  /** крышка к товару роли с этим ключом */
  lidFor?: string;
  /** выключена по умолчанию — покупатель включит сам */
  optional?: boolean;
  /** что подходит по смыслу лучше (размер, объём) — идёт первым, но не исключает остальное */
  prefer?: RegExp;
}

export interface Scenario {
  key: string;
  title: string;
  /** раздел, чья картинка на плитке */
  cover: string;
  /** реплика консультанта после выбора: общий практический совет, без обещаний о конкретных товарах */
  tip: string;
  roles: KitRole[];
}

const C = {
  plastic: '718df16e-60e7-4a96-a58b-ab475c6e4c28',
  paper: '8b23600b-d61b-415f-85b9-952b011d7932',
  fastfood: '66cd7b54-d2f1-4da7-a073-40ae301d6754',
  sauce: '61973332-961a-44cb-927c-11579a6088a4',
  serving: 'afcfc165-8166-4752-b87b-875f5f6a79e2',
  tshirt: '752a32ef-5265-4626-8769-c84f0b0bf0ce',
  bags: 'c742a7ba-a5c7-45e7-8045-cc2cba190a86',
  pizza: '2e332285-a81a-4bf2-a932-62d96c1b2231',
  pizzaFix: '9351a396-3d1e-409b-bd51-ebffbb9d17a2',
  corners: 'd089b870-4f1c-4990-8d50-0e3a80eb0ca6',
  soup: '3c46fba8-8c17-4bda-82a4-042c694f205d',
  lunch: 'f958f48d-d86c-41c1-9232-9ebc8151e0ec',
  sets: '869008ad-a7a2-40d0-98b3-b7d92b37d613',
  forks: 'c338f018-fee0-4618-a034-bd235817d8a6',
  spoons: 'ea64a2ef-3611-495c-8597-9208966ba473',
  cakes: 'c994d292-6354-4476-89b7-b62a3fb045f5',
  cakeBoxes: '4f6472ab-d33a-42c0-a46b-d32570551ef4',
  cups: '0d140123-f974-4ee9-b5f0-1aa8a868733b',
  stirrers: '014817e0-48c6-4f87-9014-f624fe76d772',
  sugar: '4ced837b-bf2d-4130-8699-f9d21ca76d38',
  cupAcc: '1a0224d7-9618-4517-bb04-8df4fde5c1dc',
  lids: '304fe7d9-a6ea-4447-a88f-7175706aaa87',
};
/** Раздел крышек: грузится всегда, когда в комплекте есть крышка. */
export const LIDS_CAT = C.lids;

/** «Контейнер C-19 Крышка прозрачная» — сама крышка, а не основание («без крышки» и «с крышкой» — основания). */
const LID_TITLE = /(^|\s)крышка(\s|,|\)|$)/i;
const BAG: KitRole ={ key: 'bag', title: 'Пакет для выдачи', cats: [C.tshirt, C.bags], inc: /майка|пакет-сумка|на вынос/i };
const LID = (forKey: string, title = 'Крышка'): KitRole => ({ key: `lid-${forKey}`, title, cats: [C.lids], lidFor: forKey });

export const SCENARIOS: Scenario[] = [
  {
    key: 'sushi', title: 'Суши и роллы', cover: C.serving,
    tip: 'Для роллов главное — плотная крышка той же модели, что и дно, и соус отдельно: так ничего не помнётся и не протечёт в дороге.',
    roles: [
      { key: 'base', title: 'Контейнер для роллов', cats: [C.plastic, C.fastfood], inc: /суши|ролл|^контейнер [cс]-(19|25)\b/i, exc: LID_TITLE },
      LID('base'),
      { key: 'sauce', title: 'Соусник', cats: [C.sauce] },
      { key: 'sticks', title: 'Палочки', cats: [C.serving], inc: /палочк/i },
      BAG,
    ],
  },
  {
    key: 'pizza', title: 'Пицца', cover: C.pizza,
    tip: 'Коробку берите по диаметру пиццы с запасом в 1–2 см, а фиксатор не даст крышке прилипнуть к сыру. Размер можно сменить кнопкой «Другой вариант».',
    roles: [
      { key: 'box', title: 'Коробка для пиццы', cats: [C.pizza], prefer: /3[0-3]\d\s?[хx]\s?3[0-3]\d/i },
      { key: 'fix', title: 'Фиксатор', cats: [C.pizzaFix] },
      { key: 'sauce', title: 'Соусник', cats: [C.sauce], optional: true },
    ],
  },
  {
    key: 'burger', title: 'Бургеры и фастфуд', cover: C.fastfood,
    tip: 'Для бургеров и фри лучше картон: он «дышит», и булка не размокает. Соусы — в отдельных соусниках.',
    roles: [
      { key: 'box', title: 'Коробка для бургера', cats: [C.fastfood], inc: /бургер/i },
      { key: 'fry', title: 'Упаковка для фри', cats: [C.fastfood], inc: /фри/i },
      { key: 'sauce', title: 'Соусник', cats: [C.sauce] },
      { key: 'corner', title: 'Уголок для хот-дога или шаурмы', cats: [C.corners], inc: /уголок/i, optional: true },
      BAG,
    ],
  },
  {
    key: 'salad', title: 'Салаты и вторые блюда', cover: C.plastic,
    tip: 'Для готовой еды подберу контейнер, к которому в каталоге есть крышка той же модели или размера, — чтобы не гадать с совместимостью.',
    roles: [
      { key: 'base', title: 'Контейнер', cats: [C.plastic, C.paper], inc: /контейнер/i, exc: /суш|ролл|десерт|секц|пирог|торт|(^|\s)крышка(\s|,|\)|$)|^контейнер [cс]-(19|25)\b/i, prefer: /(3[5-9]\d|[4-9]\d\d|1000)\s?мл/i },
      LID('base'),
      { key: 'fork', title: 'Вилка', cats: [C.forks] },
      BAG,
    ],
  },
  {
    key: 'soup', title: 'Супы', cover: C.soup,
    tip: 'Для супа важна герметичность: берите ёмкость с крышкой в комплекте или крышку той же модели. Ложку положите сразу.',
    roles: [
      { key: 'base', title: 'Суповая ёмкость', cats: [C.soup], prefer: /(5\d\d|7[05]0)\s?мл/i },
      LID('base'),
      { key: 'spoon', title: 'Ложка', cats: [C.spoons], exc: /чайн/i, prefer: /суп/i },
      BAG,
    ],
  },
  {
    key: 'lunch', title: 'Бизнес-ланчи', cover: C.lunch,
    tip: 'В ланч-боксе с секциями блюда не смешиваются. Набор приборов с салфеткой экономит время на выдаче.',
    roles: [
      { key: 'box', title: 'Ланч-бокс', cats: [C.lunch] },
      { key: 'set', title: 'Набор приборов', cats: [C.sets] },
      { key: 'soup', title: 'Ёмкость для супа', cats: [C.soup], prefer: /(5\d\d|7[05]0)\s?мл/i, optional: true },
      LID('soup'),
      BAG,
    ],
  },
  {
    key: 'dessert', title: 'Торты и десерты', cover: C.cakes,
    tip: 'Для торта нужна пара «дно + крышка» одной модели — подберу её. Порционные десерты удобнее в прозрачных контейнерах.',
    roles: [
      { key: 'cake', title: 'Тортница (дно)', cats: [C.cakes], inc: /тортниц.*(дно|[\s\d/]д[шн])|дно.*тортниц/i },
      LID('cake', 'Крышка тортницы'),
      { key: 'dessert', title: 'Контейнер для десертов', cats: [C.plastic], inc: /десерт|креманк/i, exc: LID_TITLE, optional: true },
      LID('dessert', 'Крышка для десертов'),
      { key: 'spoon', title: 'Ложка', cats: [C.spoons], optional: true },
    ],
  },
  {
    key: 'coffee', title: 'Кофе с собой', cover: C.cups,
    tip: 'Для горячих напитков — бумажный стакан и крышка того же диаметра с клапаном. Диаметр подберу автоматически.',
    roles: [
      { key: 'cup', title: 'Стакан', cats: [C.cups], inc: /стакан/i, exc: /холодн/i },
      LID('cup'),
      { key: 'stir', title: 'Размешиватель', cats: [C.stirrers] },
      { key: 'sugar', title: 'Сахар в стиках', cats: [C.sugar], inc: /сахар/i, optional: true },
      { key: 'holder', title: 'Держатель для стаканов', cats: [C.cupAcc], inc: /держател/i, optional: true },
    ],
  },
];

export const PRIORITIES: { key: Priority; title: string; text: string }[] = [
  { key: 'cheap', title: 'Подешевле', text: 'Самые доступные варианты' },
  { key: 'eco', title: 'Экологично', text: 'Крафт, бумага, дерево и бамбук' },
  { key: 'premium', title: 'Выглядит дороже', text: 'Чёрный, прозрачный, «премиум»' },
];

export const VOLUMES = [20, 50, 100, 200];

const ECO = /крафт|бумаж|картон|eco|эко|дерев|бамбук|осин/i;
const PREMIUM = /черн|black|премиум|premium|глянец|матов|прозр/i;

type Rankable = { info: { title: string; packageInfo: { element: { quantity: number } | null } | null }; finalPrice: number; quantityOfUnitsLeft: number };

/** «Размешиватели 12,5 см (500 шт)» продаются штукой-пачкой: сколько изделий в одной единице продажи. */
export function piecesPerUnit(p: Rankable): number {
  if ((p.info.packageInfo?.element?.quantity ?? 1) > 1) return 1;
  const m = p.info.title.match(/(\d{2,5})\s?(шт|пар)(?![а-яё])/i);
  return m ? Number(m[1]) : 1;
}

/**
 * Порядок кандидатов роли: подходит по смыслу (prefer) → по приоритету покупателя → хватает на складе →
 * сколько придётся заплатить за недельную потребность с округлением до целых упаковок
 * (так коробка на 3 456 шт при 350 нужных сама уходит вниз).
 */
export function rank<T extends Rankable>(list: T[], pri: Priority, need = 0, prefer?: RegExp): T[] {
  const fit = (p: T) => (pri === 'eco' ? ECO.test(p.info.title) : pri === 'premium' ? PREMIUM.test(p.info.title) : true);
  const pref = (p: T) => !prefer || prefer.test(p.info.title);
  const stock = (p: T) => !need || p.quantityOfUnitsLeft * piecesPerUnit(p) >= need;
  const step = (p: T) => p.info.packageInfo?.element?.quantity || 1;
  const huge = (p: T) => !!need && step(p) * piecesPerUnit(p) > need * 3; // упаковка втрое больше нужного
  const score = (p: T) => Number(pref(p)) * 8 + Number(stock(p)) * 2 + Number(fit(p)) * 2 - Number(huge(p)) * 2;
  const cost = (p: T) => (need ? Math.ceil(need / piecesPerUnit(p) / step(p)) * step(p) * p.finalPrice : p.finalPrice);
  return [...list].sort((a, b) => score(b) - score(a) || cost(a) - cost(b));
}
