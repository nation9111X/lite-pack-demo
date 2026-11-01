import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { lidPairs } from './tools/pairs.mjs';

// API живёт на том же домене (/api). В разработке проксируем на боевой сервер.
const API_TARGET = process.env.LITEPACK_API ?? 'https://lite-pack.ru';

// Улучшенные фото товаров (npm run images) подключаются, только если они собраны.
const PIMG = fs.existsSync('public/pimg/1000') && fs.readdirSync('public/pimg/1000').length > 0;
process.env.VITE_PIMG = PIMG ? '1' : '0';

// Сборка для показа заказчику (npm run preview:netlify): без Метрики, закрыта от поисковиков, с плашкой «Предпросмотр»
const PREVIEW = process.env.VITE_PREVIEW === '1';
process.env.VITE_PREVIEW = PREVIEW ? '1' : '0';
// Демо без сервера (npm run preview:static): каталог, цены и остатки из data/snapshot.json, корзина и заказы — в браузере
process.env.VITE_DEMO = process.env.VITE_DEMO === '1' ? '1' : '0';
if (process.env.VITE_DEMO === '1') {
  const snap = JSON.parse(fs.readFileSync('data/snapshot.json', 'utf8'));
  process.env.VITE_DEMO_DATE = new Date(snap.fetchedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Samara' });
}

// Снимок каталога (npm run snapshot): из него — списки, которых нет в API одним запросом
const SNAP = (() => {
  try {
    return JSON.parse(fs.readFileSync('data/snapshot.json', 'utf8'));
  } catch {
    return null;
  }
})();

// Бренды и производители для главной и страниц брендов
function makers(snap = SNAP) {
  if (!snap) return [];
  const n = new Map<string, { id: string; title: string; kind: 'brand' | 'plant'; imageUrl: string | null; n: number }>();
  type R = { id: string; title: string; imageUrl?: string | null };
  for (const d of Object.values(snap.productDetails ?? {}) as { brands?: R[]; plants?: R[] }[]) {
    for (const [kind, list] of [['brand', d.brands], ['plant', d.plants]] as const) {
      for (const r of list ?? []) {
        const m = n.get(r.id) ?? { id: r.id, title: r.title.trim(), kind, imageUrl: r.imageUrl || null, n: 0 };
        m.n++;
        n.set(r.id, m);
      }
    }
  }
  return [...n.values()].sort((x, y) => y.n - x.n).map(({ id, title, kind, imageUrl }) => ({ id, title, kind, imageUrl }));
}

export default defineConfig({
  // подпапка для демо на SourceCraft (VITE_BASE=/demo/); обычная сборка — корень домена
  base: process.env.VITE_BASE || '/',
  plugins: [
    react(),
    {
      // VITE_DEMO=1 npm run dev: данные демо из tools/.cache/demo (node scripts/demo-data.mjs), в сборку не попадают
      name: 'demo-dev-data',
      apply: 'serve',
      configureServer(server) {
        if (process.env.VITE_DEMO !== '1') return;
        const dir = path.resolve('tools/.cache/demo');
        server.middlewares.use((req, res, next) => {
          const m = req.url?.match(/^\/demo\/([\w./-]+?)(\?.*)?$/);
          const file = m && path.join(dir, m[1]);
          if (!file || !file.startsWith(dir) || !fs.existsSync(file)) return next();
          res.setHeader('content-type', file.endsWith('.json') ? 'application/json' : 'application/octet-stream');
          fs.createReadStream(file).pipe(res);
        });
      },
    },
    {
      name: 'preview-noindex',
      transformIndexHtml: (html) => (PREVIEW ? html.replace('<head>', '<head>\n  <meta name="robots" content="noindex, nofollow">') : html),
    },
  ],
  define: {
    __PIMG__: JSON.stringify(PIMG),
    __MAKERS__: JSON.stringify(makers()),
    __STATS__: JSON.stringify({ products: Object.keys(SNAP?.products ?? {}).length, makers: makers().length, zones: (SNAP?.deliveryRegions ?? []).length }),
    // «к этому контейнеру подходит крышка» — пары по коду модели и размерам основания (tools/pairs.mjs)
    __LIDS__: JSON.stringify(SNAP ? lidPairs(Object.values(SNAP.products)) : {}),
  },
  // Preact в режиме совместимости вместо react-dom: −55 КБ gzip, быстрее старт на слабых телефонах.
  resolve: {
    alias: {
      react: 'preact/compat',
      'react-dom/test-utils': 'preact/test-utils',
      'react-dom/client': 'preact/compat/client',
      'react-dom': 'preact/compat',
      'react/jsx-runtime': 'preact/jsx-runtime',
      'react/jsx-dev-runtime': 'preact/jsx-runtime',
    },
  },
  server: {
    port: 5173,
    // тысячи сгенерированных фото не нужно отслеживать на изменения
    watch: { ignored: ['**/public/pimg/**', '**/tools/**', '**/dist*/**'] },
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true, secure: true },
      '/static': { target: API_TARGET, changeOrigin: true, secure: true },
      '^/(80|180|506),fit/': { target: API_TARGET, changeOrigin: true, secure: true },
    },
  },
  preview: {
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true, secure: true },
      '/static': { target: API_TARGET, changeOrigin: true, secure: true },
      '^/(80|180|506),fit/': { target: API_TARGET, changeOrigin: true, secure: true },
    },
  },
  // SSR-бандл для пререндера собирает зависимости внутрь (иначе в Node подтянется настоящий react вместо preact)
  ssr: { noExternal: true },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    assetsInlineLimit: 2048,
    rollupOptions: {
      output: {
        manualChunks: { vendor: ['preact', 'preact/compat', 'react-router-dom'] },
      },
    },
  },
});
