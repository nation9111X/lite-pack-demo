import { createStore, storage } from '../lib/store';
import type { AnonRegion, Session, UserAddress } from '../api/types';

// Ключи локального хранилища нового сайта.
const K = {
  session: 'lp.session',
  region: 'lp.region',
  regionSkipped: 'lp.regionSkipped',
  cookie: 'lp.cookieAccepted',
  detached: 'lp.addressDetached',
} as const;

export interface SessionState {
  session: Session | null;
  /** Регион анонимного покупателя («Выберите регион доставки»). */
  region: AnonRegion | null;
  regionSkipped: boolean;
  addresses: UserAddress[];
  activeAddressId: string | null;
  addNewDeniedMessage: string | null;
  addressesLoaded: boolean;
  cookieAccepted: boolean;
}

export const sessionStore = createStore<SessionState>({
  session: storage.get<Session | null>(K.session, null),
  region: storage.get<AnonRegion | null>(K.region, null),
  regionSkipped: storage.get<boolean>(K.regionSkipped, false),
  addresses: [],
  activeAddressId: null,
  addNewDeniedMessage: null,
  addressesLoaded: false,
  cookieAccepted: storage.get<boolean>(K.cookie, false),
});

export function saveSession(session: Session | null) {
  storage.set(K.session, session);
  sessionStore.set({ session });
}

export function saveRegion(region: AnonRegion | null, skipped = false) {
  storage.set(K.region, region);
  storage.set(K.regionSkipped, skipped || null);
  sessionStore.set({ region, regionSkipped: skipped });
}

export function acceptCookies() {
  storage.set(K.cookie, true);
  sessionStore.set({ cookieAccepted: true });
}

export const isAuthorized = (s: SessionState) => !!s.session && s.session.profileKind !== 'anonym';

/** Покупатель сменил регион вручную: активный адрес с сервера не применяем, пока он не выберет адрес сам. */
export const isDetached = () => storage.get<boolean>(K.detached, false);
export const setDetached = (v: boolean) => storage.set(K.detached, v || null);

/** Регион, цены которого сейчас на экране: по активному адресу, иначе — выбранный вручную. */
export function currentRegion(s: SessionState, regions: AnonRegion[] | undefined): AnonRegion | null {
  const a = activeAddress(s)?.namedAddress;
  if (a) {
    const hit = regions?.find((r) => r.regionId === a.regionId || (a.departmentId && r.sourceDepartmentIds.includes(a.departmentId)) || a.sourceDepartmentIds?.some((d) => r.sourceDepartmentIds.includes(d)));
    if (hit) return hit;
  }
  return s.region;
}

export function activeAddress(s: SessionState): UserAddress | null {
  return s.addresses.find((a) => a.id === s.activeAddressId) ?? null;
}

/**
 * Параметры каталога: цены и наличие зависят от адреса.
 * Самовывоз → departmentId, доставка → regionId зоны доставки, иначе — регион анонимного покупателя.
 */
type CatalogParams = { regionId?: string; departmentId?: string };
// Последние параметры каталога: пока адреса не загружены, используем их (и ими же пользуется ранний старт в index.html).
const persistedParams = storage.get<CatalogParams | null>('lp.catalogParams', null);

export function catalogParams(s: SessionState): CatalogParams {
  if (!s.addressesLoaded && persistedParams && s.session) return persistedParams;
  const a = activeAddress(s)?.namedAddress;
  if (a?.departmentId) return { departmentId: a.departmentId };
  if (a?.regionId) return { regionId: a.regionId };
  if (s.region) return { regionId: s.region.regionId };
  return {};
}

export const catalogKey = (s: SessionState) => {
  const p = catalogParams(s);
  return p.departmentId ? 'd:' + p.departmentId : p.regionId ? 'r:' + p.regionId : 'all';
};

let lastPersisted = JSON.stringify(persistedParams);
sessionStore.subscribe(() => {
  const s = sessionStore.get();
  if (!s.addressesLoaded) return;
  const next = JSON.stringify(catalogParams(s));
  if (next !== lastPersisted) {
    lastPersisted = next;
    storage.set('lp.catalogParams', JSON.parse(next));
  }
});
