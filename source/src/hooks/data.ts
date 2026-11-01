import * as api from '../api/endpoints';
import type { Category } from '../api/types';
import { useEffect, useState } from 'react';
import { peekQuery, useQuery } from '../lib/query';
import { useStore } from '../lib/store';
import { catalogKey, catalogParams, sessionStore } from '../store/session';
import { asset } from '../lib/base';

export function useCatalogParams() {
  const key = useStore(sessionStore, catalogKey);
  const params = catalogParams(sessionStore.get());
  return { key, params };
}

let idle = false;
const idleSubs = new Set<() => void>();
if (typeof window !== 'undefined') {
  const done = () => {
    idle = true;
    idleSubs.forEach((f) => f());
  };
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  const later = () => (w.requestIdleCallback ? w.requestIdleCallback(done, { timeout: 3000 }) : setTimeout(done, 1500));
  if (document.readyState === 'complete') later();
  else window.addEventListener('load', later, { once: true });
}

/** true после загрузки страницы и простоя браузера — для некритичных запросов. */
export function useIdle() {
  const [v, setV] = useState(idle);
  useEffect(() => {
    if (idle) return setV(true);
    const f = () => setV(true);
    idleSubs.add(f);
    return () => {
      idleSubs.delete(f);
    };
  }, []);
  return v;
}

/**
 * Дерево категорий (~170 КБ без сжатия на стороне API). defer — не тянуть до простоя браузера,
 * чтобы не конкурировать с главным контентом страницы (подвал, закрытое меню).
 */
export function useCategoryTree(opts: { defer?: boolean } = {}) {
  const { key, params } = useCatalogParams();
  const ready = useIdle();
  const qk = 'cat:tree:' + key;
  const wait = opts.defer && !ready && peekQuery(qk) === undefined;
  return useQuery(wait ? null : qk, () => api.getCategories(params).then((r) => sortCats(r.categories)));
}

export function useCategory(id: string | undefined) {
  const { key, params } = useCatalogParams();
  return useQuery(id ? `cat:${id}:${key}` : null, () => api.getCategoryProducts(id!, params));
}

export function useProduct(id: string | undefined) {
  const { key, params } = useCatalogParams();
  return useQuery(id ? `product:${id}:${key}` : null, () => api.getProduct(id!, params));
}

export const useSettings = () => useQuery('settings', api.getSettings);
export const useFaq = () => useQuery('faq', api.getFaq);
export const useAnonRegions = () => useQuery('regions', api.getAnonRegions);
export const useDepartments = () => useQuery('departments', api.getDepartments);
export const useDeliveryRegions = () => useQuery('delivery-regions', api.getDeliveryRegions);

export function sortCats(list: Category[]): Category[] {
  return [...list]
    .sort((a, b) => a.order - b.order)
    .map((c) => ({ ...c, subCategories: c.subCategories?.length ? sortCats(c.subCategories) : [] }));
}

/** Путь от корня до категории (для хлебных крошек). */
export function findPath(tree: Category[] | undefined, id: string): Category[] {
  if (!tree) return [];
  for (const c of tree) {
    if (c.id === id) return [c];
    const sub = findPath(c.subCategories, id);
    if (sub.length) return [c, ...sub];
  }
  return [];
}

export interface LegalDoc {
  key: string;
  title: string;
  url: string;
}

// Названия документов — из старого приложения, ссылки — из legal_docs_links.json.
const LEGAL_TITLES: Record<string, string> = {
  'user-agreement': 'Пользовательское соглашение',
  'privacy-policy': 'Политика конфиденциальности',
  'personal-data-policy': 'Согласие на обработку персональных данных',
  'marketing-communications': 'Согласие на рекламную рассылку',
  'public-offer-individuals': 'Публичная оферта для физ. лиц',
  'public-offer-companies': 'Публичная оферта для юрид. лиц',
  'cookie-policy': 'Политика использования cookie',
};
const LEGAL_ORDER = Object.keys(LEGAL_TITLES);

export function useLegalDocs() {
  return useQuery('legal', async () => {
    const r = await fetch(asset('/assets/assets/content/legal_docs_links.json'));
    const j = (await r.json()) as Record<string, string>;
    return LEGAL_ORDER.filter((k) => j[k]).map((k) => ({ key: k, title: LEGAL_TITLES[k], url: j[k] }));
  });
}

export interface Office {
  city: string;
  address: string;
  phone: string;
  email: string;
  lat: number;
  lng: number;
}

// Контакты двух офисов зашиты в старом приложении (contactUsList) — переносим как есть.
export const OFFICES: Office[] = [
  { city: 'Ижевск', address: 'г. Ижевск, ул. Пойма 33Б, Удмуртия', phone: '8 (922) 687-15-67', email: 'elena.dunaeva.litepack@mail.ru', lat: 56.798433, lng: 53.194889 },
  { city: 'Нефтекамск', address: 'г. Нефтекамск, ул. Промышленная 5, Башкортостан', phone: '8 (927) 955-55-91', email: 'lite-pack@mail.ru', lat: 56.098195, lng: 54.266921 },
];
