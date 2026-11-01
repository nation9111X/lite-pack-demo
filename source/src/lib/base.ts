// Сайт может жить не в корне домена, а в подпапке (демо на SourceCraft: /demo/) — npm run preview:static с VITE_BASE.
// Все пути к файлам из public/ строим через asset(), а роутер получает basename.
export const BASE = import.meta.env.BASE_URL || '/';
/** basename для роутера: '' для корня, '/demo' для подпапки */
export const ROUTER_BASE = BASE === '/' ? undefined : BASE.replace(/\/$/, '');
/** '/pimg/480/x.webp' → '/demo/pimg/480/x.webp' */
export const asset = (p: string) => BASE + p.replace(/^\//, '');
