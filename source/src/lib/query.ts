import { useCallback, useEffect, useRef, useState } from 'react';
import { errorText } from '../api/client';

// Простой кэш запросов: stale-while-revalidate, дедупликация, инвалидация по префиксу.
interface Entry<T> {
  data?: T;
  error?: string;
  ts: number;
  promise?: Promise<T>;
}
const cache = new Map<string, Entry<unknown>>();
const listeners = new Map<string, Set<() => void>>();
const STALE_MS = 60_000;
if (import.meta.env.DEV) (window as unknown as { __lpCache: unknown }).__lpCache = cache;

function notify(key: string) {
  listeners.get(key)?.forEach((fn) => fn());
}

export function fetchQuery<T>(key: string, fn: () => Promise<T>, force = false): Promise<T> {
  const e = cache.get(key) as Entry<T> | undefined;
  if (e?.promise) return e.promise;
  if (!force && e?.data !== undefined && Date.now() - e.ts < STALE_MS) return Promise.resolve(e.data);
  const promise = fn()
    .then((data) => {
      cache.set(key, { data, ts: Date.now() });
      notify(key);
      return data;
    })
    .catch((err) => {
      cache.set(key, { data: e?.data, error: errorText(err), ts: Date.now() });
      notify(key);
      throw err;
    });
  cache.set(key, { ...(e ?? { ts: 0 }), promise });
  return promise;
}

export function setQueryData<T>(key: string, data: T) {
  cache.set(key, { data, ts: Date.now() });
  notify(key);
}

/** Показать данные сразу, но считать их устаревшими: запрос всё равно уйдёт и обновит страницу. */
export function seedQuery<T>(key: string, data: T) {
  if (cache.get(key)?.data === undefined) cache.set(key, { data, ts: 0 });
}

export function peekQuery<T>(key: string): T | undefined {
  return cache.get(key)?.data as T | undefined;
}

export function invalidate(prefix: string) {
  for (const k of [...cache.keys()]) if (k.startsWith(prefix)) {
    cache.delete(k);
    notify(k);
  }
}

export interface QueryResult<T> {
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
  reload: () => void;
}

export function useQuery<T>(key: string | null, fn: () => Promise<T>): QueryResult<T> {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const [, force] = useState(0);
  const e = key ? (cache.get(key) as Entry<T> | undefined) : undefined;

  useEffect(() => {
    if (!key) return;
    const set = listeners.get(key) ?? new Set();
    const fn2 = () => {
      // Запись сброшена (invalidate) — перезапрашиваем для активных подписчиков.
      if (!cache.has(key)) fetchQuery(key, () => fnRef.current()).catch(() => {});
      force((x) => x + 1);
    };
    set.add(fn2);
    listeners.set(key, set);
    fetchQuery(key, () => fnRef.current()).catch(() => {});
    return () => {
      set.delete(fn2);
    };
  }, [key]);

  const reload = useCallback(() => {
    if (key) fetchQuery(key, () => fnRef.current(), true).catch(() => {});
  }, [key]);

  return {
    data: e?.data,
    error: e?.data === undefined ? e?.error : undefined,
    loading: !!key && e?.data === undefined && !e?.error,
    reload,
  };
}
