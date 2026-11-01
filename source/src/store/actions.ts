import * as api from '../api/endpoints';
import { onAuthLost, signupAnonymous } from '../api/client';
import type { Product } from '../api/types';
import type { AnonRegion } from '../api/types';
import { isDetached, saveRegion, saveSession, sessionStore, setDetached } from './session';
import { cartStore, loadCart, setQty } from './cart';
import { closeAddress, toast, uiStore } from './ui';
import { invalidate } from '../lib/query';
import { setUserId } from '../lib/metrika';

export async function loadAddresses() {
  try {
    const r = await api.getAddresses();
    sessionStore.set({
      addresses: r.addresses ?? [],
      activeAddressId: isDetached() ? null : r.activeAddressId,
      addNewDeniedMessage: r.addNewDeniedMessage,
      addressesLoaded: true,
    });
  } catch {
    sessionStore.set({ addressesLoaded: true });
  }
}

/** После смены адреса: каталог (цены/наличие) и корзина перечитываются. */
async function afterAddressChange(pending?: { product: Product; qty: number } | null) {
  invalidate('cat:');
  invalidate('product:');
  invalidate('search:');
  await loadCart();
  if (pending) setQty(pending.product, pending.qty);
}

/**
 * Переключатель региона: каталог, цены и наличие сразу пересчитываются.
 * Если выбран адрес в другом регионе — он отпускается (корзина привязана к адресу и вернётся вместе с ним).
 */
export async function switchRegion(region: AnonRegion) {
  const s = sessionStore.get();
  const prev = s.activeAddressId;
  saveRegion(region);
  if (prev) {
    setDetached(true);
    sessionStore.set({ activeAddressId: null });
  }
  await afterAddressChange();
  toast(`Показываем цены и наличие: ${region.name}`, 'ok', prev ? { label: 'Вернуть адрес', run: () => { chooseAddress(prev).catch(() => {}); } } : undefined, prev ? 8000 : 4200);
}

export async function chooseAddress(addressId: string) {
  setDetached(false);
  await api.setActiveAddress(addressId);
  sessionStore.set({ activeAddressId: addressId });
  const pending = uiStore.get().address.pending;
  closeAddress();
  await afterAddressChange(pending);
}

export async function addPickup(departmentId: string) {
  setDetached(false);
  const a = await api.addPickupAddress(departmentId);
  await api.setActiveAddress(a.id).catch(() => {});
  await loadAddresses();
  sessionStore.set({ activeAddressId: a.id });
  const pending = uiStore.get().address.pending;
  closeAddress();
  await afterAddressChange(pending);
  return a;
}

export async function addCourier(c: { lat: number; lng: number; flat?: string; entrance?: string; floor?: string }) {
  setDetached(false);
  const a = await api.addCourierAddress(c);
  await api.setActiveAddress(a.id).catch(() => {});
  await loadAddresses();
  sessionStore.set({ activeAddressId: a.id });
  const pending = uiStore.get().address.pending;
  closeAddress();
  await afterAddressChange(pending);
  return a;
}

export async function removeAddress(id: string) {
  await api.deleteAddress(id);
  await loadAddresses();
  await afterAddressChange();
}

/** Полная переинициализация после входа/выхода. */
async function reloadAll() {
  invalidate('');
  cartStore.set({ cart: null, local: {}, loaded: false });
  await loadAddresses();
  await loadCart();
}

export async function completeLogin(r: { clientId: string; profileId: string; profileKind: string; accessToken: string }) {
  saveSession({ accessToken: r.accessToken, clientId: r.clientId ?? null, profileId: r.profileId, profileKind: (r.profileKind as never) ?? 'shopPerson' });
  setUserId(r.profileId);
  await reloadAll();
}

export async function logoutAll() {
  try {
    await api.logout();
  } catch {
    /* токен уже недействителен */
  }
  saveSession(null);
  await signupAnonymous().catch(() => {});
  await reloadAll();
}

export async function switchProfile(profileId: string) {
  const r = await api.switchShopProfile(profileId);
  if (r?.accessToken) {
    const s = sessionStore.get().session;
    if (s) saveSession({ ...s, accessToken: r.accessToken, profileId });
  }
  await reloadAll();
}

export function initSession() {
  onAuthLost(() => {
    toast('Сессия истекла. Войдите снова.', 'info');
    reloadAll();
  });
  loadAddresses().then(loadCart);
}
