// Серверный рендер для пререндера (scripts/prerender.mjs): HTML первого экрана без JS.
import { renderToStringAsync } from 'preact-render-to-string';
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from 'react-router-dom/server';
import { routes } from './app/routes';
import { setQueryData } from './lib/query';
import { ROUTER_BASE } from './lib/base';

export async function render(url: string, data: Record<string, unknown>): Promise<string> {
  for (const [k, v] of Object.entries(data)) setQueryData(k, v);
  const handler = createStaticHandler(routes, { basename: ROUTER_BASE });
  const ctx = await handler.query(new Request('https://lite-pack.ru' + (ROUTER_BASE ?? '') + url));
  if (ctx instanceof Response) throw new Error('redirect ' + url);
  const router = createStaticRouter(handler.dataRoutes, ctx);
  return renderToStringAsync(<StaticRouterProvider router={router} context={ctx} hydrate={false} />);
}
