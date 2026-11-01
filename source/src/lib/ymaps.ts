// Яндекс Карты (JS API 2.1) — как в старом приложении. Скрипт грузится только когда карта нужна.
// Ключ — VITE_YMAPS_KEY (ключ заказчика для lite-pack.ru). Без ключа карта показывается, но геокодер
// Яндекса недоступен — адрес по точке всё равно берётся у API магазина (v1/users/addresses/coordinateInfo).
/* eslint-disable @typescript-eslint/no-explicit-any */
export type YMaps = any;

let p: Promise<YMaps> | null = null;

export function loadYmaps(): Promise<YMaps> {
  if (typeof window === 'undefined') return Promise.reject(new Error('ssr'));
  const w = window as any;
  if (w.ymaps?.Map) return Promise.resolve(w.ymaps);
  p ??= new Promise<YMaps>((resolve, reject) => {
    const key = import.meta.env.VITE_YMAPS_KEY as string | undefined;
    const s = document.createElement('script');
    s.src = `https://api-maps.yandex.ru/2.1/?lang=ru_RU${key ? '&apikey=' + encodeURIComponent(key) : ''}`;
    s.async = true;
    const fail = (e: unknown) => {
      p = null;
      s.remove();
      reject(e instanceof Error ? e : new Error('ymaps'));
    };
    const t = window.setTimeout(() => fail(new Error('timeout')), 15000);
    s.onload = () => w.ymaps.ready(() => (window.clearTimeout(t), resolve(w.ymaps)), fail);
    s.onerror = () => (window.clearTimeout(t), fail(new Error('load')));
    document.head.appendChild(s);
  });
  return p;
}
