import type { Product } from '../api/types';

// Яндекс Метрика 104107498 — те же события, что отправляло старое приложение.
const ID = 104107498;
type W = Window & { ym?: (...a: unknown[]) => void; startYandexMetrika?: () => void; yandexMetrikaStarted?: boolean; dataLayer?: unknown[] };
const w = () => window as W;

let enabled = false;
let lastUrl: string | undefined;

/** Запуск после согласия с cookie (как на старом сайте). */
export function startMetrika() {
  if (enabled) return;
  enabled = true;
  w().startYandexMetrika?.();
}

const call = (...args: unknown[]) => {
  if (!enabled) return;
  try {
    w().ym?.(ID, ...args);
  } catch {
    /* счётчик заблокирован */
  }
};

export function hit(title: string) {
  if (!enabled) return;
  const url = location.href;
  if (url === lastUrl) return;
  call('hit', url, { title, referer: lastUrl });
  lastUrl = url;
}

export function hitSearch(q: string, results: number) {
  call('hit', '/internal-search?q=' + encodeURIComponent(q), { title: 'Поиск: ' + q, params: { search: { query: q, results } } });
}

export const goal = (name: string, params?: Record<string, unknown>) => call('reachGoal', name, params);
export const setUserId = (id: string) => call('setUserID', id);

const ecoProduct = (p: Product, quantity?: number) => ({
  id: p.id,
  name: p.info.title,
  price: p.finalPrice,
  ...(quantity != null ? { quantity } : {}),
});

function push(action: 'detail' | 'add' | 'remove' | 'purchase', products: unknown[], actionField?: Record<string, unknown>) {
  if (!enabled) return;
  const dl = (w().dataLayer = w().dataLayer || []);
  dl.push({ ecommerce: { currencyCode: 'RUB', [action]: { products, ...(actionField ? { actionField } : {}) } } });
}

export const ecDetail = (p: Product) => push('detail', [ecoProduct(p)]);
export const ecAdd = (p: Product, qty: number) => push('add', [ecoProduct(p, qty)]);
export const ecRemove = (p: Product, qty: number) => push('remove', [ecoProduct(p, qty)]);
export const ecPurchase = (orderId: string, revenue: number, items: { product: Product; qty: number }[], coupon?: string | null) =>
  push('purchase', items.map((i) => ecoProduct(i.product, i.qty)), { id: orderId, revenue, ...(coupon ? { coupon } : {}) });
