import { createStore } from '../lib/store';
import * as api from '../api/endpoints';
import { errorText } from '../api/client';
import type { AppMessage, Cart, Product } from '../api/types';
import { activeAddress, sessionStore } from './session';
import { openAddress, toast } from './ui';
import { maxQty, stepOf } from '../lib/format';
import { ecAdd, ecRemove } from '../lib/metrika';

export interface CartState {
  cart: Cart | null;
  loaded: boolean;
  /** Оптимистичные количества, ещё не подтверждённые сервером. */
  local: Record<string, number>;
  /** Товары для мгновенного отображения до ответа сервера. */
  products: Record<string, Product>;
  message: AppMessage | null;
  /** Счётчик для анимации «короба» в шапке. */
  bump: number;
}

export const cartStore = createStore<CartState>({ cart: null, loaded: false, local: {}, products: {}, message: null, bump: 0 });

export function qtyIn(s: CartState, productId: string): number {
  if (productId in s.local) return s.local[productId];
  return s.cart?.items.find((i) => i.product.id === productId)?.quantityOfUnits ?? 0;
}

export function cartCount(s: CartState): number {
  const ids = new Set([...(s.cart?.items.map((i) => i.product.id) ?? []), ...Object.keys(s.local)]);
  let c = 0;
  ids.forEach((id) => {
    if (qtyIn(s, id) > 0) c++;
  });
  return c;
}

/** Сумма с учётом несохранённых изменений — для мгновенного отклика короба. */
export function cartTotal(s: CartState): number {
  let total = s.cart?.price.final ?? 0;
  for (const [id, q] of Object.entries(s.local)) {
    const item = s.cart?.items.find((i) => i.product.id === id);
    const prod = item?.product ?? s.products[id];
    if (!prod) continue;
    total += (q - (item?.quantityOfUnits ?? 0)) * prod.finalPrice;
  }
  return Math.max(0, total);
}

let loadSeq = 0;
export async function loadCart() {
  const seq = ++loadSeq;
  const a = activeAddress(sessionStore.get());
  if (!a) {
    cartStore.set({ cart: null, loaded: true });
    return;
  }
  try {
    const r = await api.getCart(a.id);
    if (seq !== loadSeq) return;
    cartStore.set({ cart: r.cart, loaded: true, message: r.appMessage });
  } catch {
    if (seq === loadSeq) cartStore.set({ loaded: true });
  }
}

const timers = new Map<string, number>();

/** Изменение количества с учётом кратности и остатков. Без адреса — сначала выбор способа получения. */
export function setQty(product: Product, wanted: number) {
  const s = sessionStore.get();
  const addr = activeAddress(s);
  if (!addr) {
    openAddress({ product, qty: wanted });
    return;
  }
  const step = stepOf(product);
  const max = maxQty(product);
  let qty = Math.round(wanted / step) * step;
  qty = Math.max(0, Math.min(qty, max));
  const st = cartStore.get();
  const prev = qtyIn(st, product.id);
  if (qty === prev) {
    if (wanted > prev && prev >= max) toast(`Доступно ${max} ${product.info.packageInfo?.unit || 'шт'}.`, 'info');
    return;
  }
  cartStore.set((c) => ({
    local: { ...c.local, [product.id]: qty },
    products: { ...c.products, [product.id]: product },
    bump: qty > prev ? c.bump + 1 : c.bump,
  }));
  if (qty > prev) ecAdd(product, qty - prev);
  else ecRemove(product, prev - qty);

  window.clearTimeout(timers.get(product.id));
  timers.set(
    product.id,
    window.setTimeout(() => flush(product.id, addr.id), 380),
  );
}

async function flush(productId: string, addressId: string) {
  timers.delete(productId);
  const qty = cartStore.get().local[productId];
  if (qty === undefined) return;
  try {
    const r = await api.updateCart({ userAddressId: addressId, items: [{ productId, quantityOfUnits: qty }] });
    cartStore.set((c) => {
      const local = { ...c.local };
      if (local[productId] === qty) delete local[productId];
      return { cart: r.cart, local, message: r.appMessage ?? c.message };
    });
    if (r.appMessage?.text || r.appMessage?.title) toast(r.appMessage.title || r.appMessage.text || '', 'info');
  } catch (e) {
    cartStore.set((c) => {
      const local = { ...c.local };
      delete local[productId];
      return { local };
    });
    toast(errorText(e), 'error');
  }
}

export async function applyPromo(code: string) {
  const a = activeAddress(sessionStore.get());
  if (!a) return;
  const r = await api.updateCart({ userAddressId: a.id, promoCode: code });
  cartStore.set({ cart: r.cart, message: r.appMessage });
  return r;
}

export async function removePromo(code: string) {
  const a = activeAddress(sessionStore.get());
  if (!a) return;
  const r = await api.updateCart({ userAddressId: a.id, promoCodeToRemove: code });
  cartStore.set({ cart: r.cart, message: r.appMessage });
}

export async function removeUnavailable() {
  const s = cartStore.get();
  const a = activeAddress(sessionStore.get());
  if (!a || !s.cart) return;
  const items = s.cart.items.filter((i) => i.product.outOfStock || i.product.quantityOfUnitsLeft <= 0).map((i) => ({ productId: i.product.id, quantityOfUnits: 0 }));
  if (!items.length) return;
  const r = await api.updateCart({ userAddressId: a.id, items });
  cartStore.set({ cart: r.cart, message: r.appMessage });
}

export async function clearCartAll() {
  try {
    await api.clearCart();
  } catch {
    /* корзины могло не быть */
  }
  cartStore.set({ cart: null, local: {} });
  await loadCart();
}
