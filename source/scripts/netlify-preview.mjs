// Сборка для показа заказчику на Netlify: npm run preview:netlify → папка dist/ готова к `netlify deploy --dir dist`.
// Отличия от боевой сборки: плашка «Предпросмотр», без Метрики, закрыта от поисковиков (noindex + robots.txt).
// API, служебные файлы и ресайз картинок Netlify пересылает на действующий lite-pack.ru (_redirects).
// После показа соберите обычную версию: npm run build.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const ORIGIN = 'https://lite-pack.ru';

const r = spawnSync('npm run build', { cwd: root, stdio: 'inherit', shell: true, env: { ...process.env, VITE_PREVIEW: '1' } });
if (r.status !== 0) process.exit(r.status ?? 1);

fs.writeFileSync(
  path.join(dist, '_redirects'),
  [
    `/api/*      ${ORIGIN}/api/:splat      200`,
    `/static/*   ${ORIGIN}/static/:splat   200`,
    `/80,fit/*   ${ORIGIN}/80,fit/:splat   200`,
    `/180,fit/*  ${ORIGIN}/180,fit/:splat  200`,
    `/506,fit/*  ${ORIGIN}/506,fit/:splat  200`,
    // нет улучшенной копии фото — честный 404, сайт сам возьмёт картинку из ресайза
    `/pimg/*     /pimg/404                404`,
    // страницы без пререндера (новые товары, личный кабинет) — оболочка приложения
    `/*          /app.html                200`,
    '',
  ].join('\n'),
);
fs.writeFileSync(
  path.join(dist, '_headers'),
  [
    '/*',
    '  X-Robots-Tag: noindex, nofollow',
    '/assets/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '/pimg/*',
    '  Cache-Control: public, max-age=2592000',
    '',
  ].join('\n'),
);
fs.writeFileSync(path.join(dist, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
fs.rmSync(path.join(dist, 'sitemap.xml'), { force: true });
console.log('Сборка для показа готова: dist/ (плашка «Предпросмотр», без Метрики, noindex, прокси API на ' + ORIGIN + ')');
