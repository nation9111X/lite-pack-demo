import { useEffect } from 'react';
import { hit } from './metrika';
import { BASE } from './base';

const SITE = 'https://lite-pack.ru';
const DEFAULT_TITLE = 'Лайт Пак';
const DEFAULT_DESC = 'Производство и продажа упаковки';
const DEFAULT_IMAGE = 'https://storage.yandexcloud.net/litepack-staging/assets/logo.png';

function setMeta(attr: 'name' | 'property', key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = value;
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

export interface Seo {
  title?: string;
  description?: string;
  image?: string | null;
  path?: string;
  jsonLd?: object | object[] | null;
  noindex?: boolean;
}

/** Заголовок, описание, canonical, OpenGraph и JSON-LD для каждой страницы SPA. */
export function useSeo(seo: Seo | null) {
  const json = seo ? JSON.stringify(seo) : null;
  useEffect(() => {
    if (!seo) return;
    const title = seo.title ? `${seo.title} — Лайт Пак` : DEFAULT_TITLE;
    const desc = (seo.description || DEFAULT_DESC).replace(/\s+/g, ' ').trim().slice(0, 300);
    const url = SITE + (seo.path ?? location.pathname.replace(BASE, '/'));
    document.title = title;
    setMeta('name', 'description', desc);
    setMeta('property', 'og:title', seo.title || 'Лайт-Пак');
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', seo.image || DEFAULT_IMAGE);
    // в сборке для показа заказчику сайт закрыт от поисковиков целиком
    const preview = import.meta.env.VITE_PREVIEW === '1';
    setMeta('name', 'robots', preview ? 'noindex, nofollow' : seo.noindex ? 'noindex, follow' : 'index, follow');
    setLink('canonical', url);

    let script = document.getElementById('jsonld') as HTMLScriptElement | null;
    if (seo.jsonLd) {
      if (!script) {
        script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = 'jsonld';
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(seo.jsonLd);
    } else script?.remove();

    hit(title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [json]);
}

export const orgJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'ООО «Лайт Пак Групп»',
  url: SITE,
  logo: DEFAULT_IMAGE,
  telephone: '8 (927) 955-55-91',
  email: 'lite-pack@mail.ru',
  address: { '@type': 'PostalAddress', streetAddress: 'ул. Индустриальная, д. 6', addressLocality: 'Нефтекамск', postalCode: '452680', addressCountry: 'RU' },
  sameAs: ['https://vk.com/public216924557'],
};

export function breadcrumbsLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: SITE + it.path })),
  };
}
