import { createBrowserRouter } from 'react-router-dom';
import { routes } from './routes';
import { ROUTER_BASE } from '../lib/base';
import { reducedMotion } from '../lib/motion';

export const router = createBrowserRouter(routes, { basename: ROUTER_BASE });

// Плавный переход между страницами (View Transitions): там, где браузер не умеет, страницы меняются как раньше.
if ('startViewTransition' in document && !reducedMotion()) {
  const go = router.navigate;
  router.navigate = ((to: never, opts?: Record<string, unknown>) => (typeof to === 'number' ? go(to) : go(to, { ...opts, viewTransition: true } as never))) as typeof router.navigate;
}
