import type { Product } from '../api/types';

const rub2 = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 });

/** 733,50 ₽ — как в старом приложении (всегда две цифры после запятой). */
export const money = (v: number | null | undefined) => (v == null || Number.isNaN(v) ? '—' : rub2.format(v) + ' ₽');
/** Целые рубли без копеек, если копеек нет: 1 000 ₽ / 16,30 ₽. */
export const moneyShort = (v: number) => (Number.isInteger(v) ? num.format(v) : rub2.format(v)) + ' ₽';
export const n = (v: number) => num.format(v);

export function plural(count: number, one: string, few: string, many: string) {
  const a = Math.abs(count) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
export const goodsCount = (c: number) => `${n(c)} ${plural(c, 'товар', 'товара', 'товаров')}`;

// ---- Единицы и кратность (логика старого приложения) ----

/** Шаг заказа: количество штук в упаковке, иначе 1. */
export function stepOf(p: Product): number {
  const q = p.info.packageInfo?.element?.quantity;
  return q && q > 1e-10 ? q : 1;
}
/** Вес/объём на единицу товара из packageInfo (значение указано на упаковку из quantity единиц). */
export const perUnit = (v: { value: number; quantity: number } | null | undefined) => (v && v.value > 0 && v.quantity > 0 ? v.value / v.quantity : null);
export const unitOf = (p: Product) => p.info.packageInfo?.unit || 'шт';
export const inStock = (p: Product) => !p.outOfStock && p.quantityOfUnitsLeft > 0;

/** «Осталось 1 080 шт, кратно 45 шт» / «Осталось 120 шт» / «Нет в наличии». */
export function stockLine(p: Product): string {
  const unit = unitOf(p);
  const step = stepOf(p);
  if (!inStock(p)) return 'Нет в наличии';
  const left = `Осталось ${n(p.quantityOfUnitsLeft)} ${unit}`;
  return Math.abs(step - 1) <= 1e-10 ? left : `${left}, кратно ${n(step)} ${unit}`;
}

/** Максимальное заказываемое количество с учётом кратности. */
export function maxQty(p: Product): number {
  const step = stepOf(p);
  return Math.floor(p.quantityOfUnitsLeft / step + 1e-9) * step;
}

export const hasDiscount = (p: Product) => p.finalPrice < p.price - 1e-9;

// ---- Даты ----
const dDay = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
const dFull = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
const dTime = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
const dWeek = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' });

export const dateLong = (iso: string | null | undefined) => (iso ? dFull.format(new Date(iso)) : '');
export const time = (iso: string) => dTime.format(new Date(iso));

export function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((d0 - t0) / 86400000);
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Завтра';
  if (diff === -1) return 'Вчера';
  return `${dWeek.format(d)}, ${dDay.format(d)}`;
}

export const slotLabel = (s: { start: string; end: string }) => `${dayLabel(s.start)}, ${time(s.start)}–${time(s.end)}`;

/** Минуты от полуночи → «09:00». */
export const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export function phoneHref(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return 'tel:' + (digits.startsWith('8') && digits.length === 11 ? '+7' + digits.slice(1) : '+' + digits);
}

/** «Ижевск, Пушкинская улица, 154, кв. 1» — короткая форма адреса. */
export function shortAddress(a: { locality?: string | null; city?: string | null; street?: string | null; house?: string | null; flat?: string | null; value: string }) {
  const parts = [a.locality || a.city, a.street, a.house, a.flat ? 'кв. ' + a.flat : null].filter(Boolean);
  return parts.length >= 2 ? parts.join(', ') : a.value;
}
