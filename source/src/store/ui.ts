import { createStore } from '../lib/store';
import type { Product } from '../api/types';

export interface Toast {
  id: number;
  text: string;
  tone?: 'ok' | 'error' | 'info';
  action?: { label: string; run: () => void };
}

export interface UiState {
  cartOpen: boolean;
  address: { open: boolean; tab: 'delivery' | 'pickup'; pending: { product: Product; qty: number } | null };
  auth: { open: boolean; next: string | null };
  catalogOpen: boolean;
  toasts: Toast[];
}

export const uiStore = createStore<UiState>({
  cartOpen: false,
  address: { open: false, tab: 'delivery', pending: null },
  auth: { open: false, next: null },
  catalogOpen: false,
  toasts: [],
});

let toastId = 0;
export function toast(text: string, tone: Toast['tone'] = 'info', action?: Toast['action'], ms = 4200) {
  const id = ++toastId;
  uiStore.set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, tone, action }] }));
  window.setTimeout(() => dismissToast(id), ms);
}
export const dismissToast = (id: number) => uiStore.set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));

export const openAddress = (pending: UiState['address']['pending'] = null, tab: 'delivery' | 'pickup' = 'delivery') =>
  uiStore.set({ address: { open: true, tab, pending } });
export const closeAddress = () => uiStore.set((s) => ({ address: { ...s.address, open: false, pending: null } }));
export const openAuth = (next: string | null = null) => uiStore.set({ auth: { open: true, next } });
export const closeAuth = () => uiStore.set({ auth: { open: false, next: null } });
export const setCartOpen = (cartOpen: boolean) => uiStore.set({ cartOpen });
export const setCatalogOpen = (catalogOpen: boolean) => uiStore.set({ catalogOpen });
