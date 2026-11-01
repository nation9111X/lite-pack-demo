// Картинки товаров и категорий.
import { asset } from './base';
//  • Улучшенные копии (tools/enhance-images.mjs): /pimg/{480|1000}/<id>.webp — чётче и легче оригиналов.
//  • Сервис ресайза на lite-pack.ru (использует и старое приложение): /{80|180|506},fit/{url} — запасной путь,
//    если копии нет (например, товар добавлен после сборки).
export type ImgSize = 80 | 180 | 506;

declare const __PIMG__: boolean;
const PIMG_ON = typeof __PIMG__ !== 'undefined' && __PIMG__;

const RESIZABLE = /^https:\/\/storage\.yandexcloud\.net\//;
const STORAGE_ID = /^https:\/\/storage\.yandexcloud\.net\/[^/]+\/(?:products|categories)\/([0-9a-f]{32})(?:\.(?:png|jpe?g|webp))?$/i;
const PIMG_PATH = /\/pimg\/(480|1000)\/([0-9a-f]{32})\.webp/;

const origById = new Map<string, string>();
const missing = new Set<string>();

function pimgId(url: string): string | null {
  if (!PIMG_ON) return null;
  const m = url.match(STORAGE_ID);
  if (!m) return null;
  const id = m[1].toLowerCase();
  if (missing.has(id)) return null;
  origById.set(id, url);
  return id;
}

// В демо без сервера ресайз берётся прямо с lite-pack.ru (картинкам запросы с чужого адреса не запрещены)
const SVC_ORIGIN = import.meta.env.VITE_DEMO === '1' ? 'https://lite-pack.ru' : '';
const svc = (url: string, size: ImgSize) => `${SVC_ORIGIN}/${size},fit/${url}`;

export function imgUrl(url: string | null | undefined, size?: ImgSize): string {
  if (!url) return '';
  if (!size || !RESIZABLE.test(url)) return url;
  const id = pimgId(url);
  if (id) return asset(`/pimg/${size === 506 ? 1000 : 480}/${id}.webp`);
  return svc(url, size);
}

export function imgSrcSet(url: string | null | undefined, sizes: ImgSize[] = [180, 506]): string | undefined {
  if (!url || !RESIZABLE.test(url)) return undefined;
  const id = pimgId(url);
  if (id) return `${asset(`/pimg/480/${id}.webp`)} 480w, ${asset(`/pimg/1000/${id}.webp`)} 1000w`;
  return sizes.map((s) => `${svc(url, s)} ${s}w`).join(', ');
}

// Если улучшенной копии нет — тихо переключаемся на сервис ресайза (один обработчик на весь документ).
let fallbackOn = false;
export function initImageFallback() {
  if (fallbackOn || typeof document === 'undefined' || !PIMG_ON) return;
  fallbackOn = true;
  document.addEventListener(
    'error',
    (e) => {
      const img = e.target as HTMLImageElement;
      if (img?.tagName !== 'IMG') return;
      const m = (img.currentSrc || img.src).match(PIMG_PATH);
      if (!m) return;
      const id = m[2];
      missing.add(id);
      const orig = origById.get(id);
      if (!orig) return;
      if (img.sizes) img.srcset = `${svc(orig, 180)} 180w, ${svc(orig, 506)} 506w`;
      else img.removeAttribute('srcset');
      img.src = svc(orig, m[1] === '1000' ? 506 : 180);
    },
    true,
  );
}
