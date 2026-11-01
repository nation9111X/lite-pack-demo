// Демо-версия для показа без сервера: npm run preview:static → dist/ можно положить на любой статический хостинг
// (GitHub Pages и т. п.). Каталог, цены и остатки зафиксированы из data/snapshot.json (обновить: npm run snapshot),
// корзина, адреса, вход и «заказы» работают в браузере и никуда не отправляются (src/api/demo.ts).
// После показа соберите обычную версию: npm run build.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeDemoData } from './demo-data.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

const r = spawnSync('npm run build', { cwd: root, stdio: 'inherit', shell: true, env: { ...process.env, VITE_PREVIEW: '1', VITE_DEMO: '1' } });
if (r.status !== 0) process.exit(r.status ?? 1);

// ---- данные каталога для демо ----
const out = path.join(dist, 'demo');
const { snap, count } = writeDemoData(out);

// ---- статический хостинг ----
for (const f of ['_redirects', '_headers', 'sitemap.xml']) fs.rmSync(path.join(dist, f), { force: true });
fs.writeFileSync(path.join(dist, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
fs.writeFileSync(path.join(dist, '.nojekyll'), ''); // GitHub Pages: отдавать файлы как есть
fs.copyFileSync(path.join(dist, 'app.html'), path.join(dist, '404.html')); // страницы без пререндера — оболочка приложения
const kb = (f) => (fs.statSync(f).size / 1024).toFixed(0);
console.log(`Демо готово: dist/ (каталог на ${new Date(snap.fetchedAt).toLocaleDateString('ru-RU')}, ${count} товаров; catalog.json ${kb(path.join(out, 'catalog.json'))} КБ, сжатый ${kb(path.join(out, 'catalog.bin'))} КБ)`);

const manifestPath = path.join(dist, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const base = process.env.VITE_BASE || '/';
manifest.start_url = base; manifest.scope = base;
manifest.icons.forEach(icon => { icon.src = base + icon.src.replace(/^\//, ''); });
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
