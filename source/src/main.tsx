import { initAnimationVisibility } from './lib/performance';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import '@fontsource-variable/onest/wght.css';
import '@fontsource-variable/geologica/wght.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import { router } from './app/router';
import { signupAnonymous } from './api/client';
import { catalogKey, sessionStore } from './store/session';
import { setQueryData } from './lib/query';
import { sortCats } from './hooks/data';
import { initImageFallback } from './lib/img';
import type { CategoryResponse, Product } from './api/types';

// Анонимный токен запрашиваем сразу, параллельно с загрузкой интерфейса.
if (!sessionStore.get().session) signupAnonymous().catch(() => {});

document.documentElement.classList.add('js');
initImageFallback();

type Pre = Record<string, Promise<unknown>>;

/**
 * Ранние запросы из index.html: дожидаемся их (не дольше 2,5 с) и кладём ответ в кэш,
 * чтобы приложение отрисовало страницу сразу с данными — без скелетона поверх пререндера.
 */
async function primeFromEarlyFetch() {
  const pre = (window as Window & { __lpPre?: Pre }).__lpPre;
  if (!pre) return;
  const entries = Object.entries(pre);
  const results = await Promise.race([
    Promise.all(entries.map(([, p]) => p.catch(() => undefined))),
    new Promise<undefined>((r) => setTimeout(() => r(undefined), 2500)),
  ]);
  if (!results) return;
  const key = catalogKey(sessionStore.get());
  entries.forEach(([url], i) => {
    const data = results[i];
    if (!data) return;
    const params = new URL(url, location.origin).searchParams;
    const urlKey = params.get('departmentId') ? 'd:' + params.get('departmentId') : params.get('regionId') ? 'r:' + params.get('regionId') : 'all';
    if (urlKey !== key) return;
    let m: RegExpMatchArray | null;
    if ((m = url.match(/^\/api\/v1\/categories\/([^/?]+)\/products/))) setQueryData(`cat:${decodeURIComponent(m[1])}:${key}`, data as CategoryResponse);
    else if ((m = url.match(/^\/api\/v1\/products\/([^/?]+)/))) setQueryData(`product:${decodeURIComponent(m[1])}:${key}`, (data as { product: Product }).product);
    else if (/^\/api\/v1\/categories(\?|$)/.test(url)) setQueryData(`cat:tree:${key}`, sortCats((data as CategoryResponse).categories));
    else return;
    delete pre[url];
  });
}

async function start() {
  const rootEl = document.getElementById('root')!;
  if (rootEl.hasAttribute('data-ssr')) {
    await primeFromEarlyFetch();
    // Пререндеренный HTML (scripts/prerender.mjs) заменяется живым приложением в том же кадре.
    rootEl.textContent = '';
    rootEl.removeAttribute('data-ssr');
  }
  createRoot(rootEl).render(
    <StrictMode>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </StrictMode>,
  );
}

start();
initAnimationVisibility();
