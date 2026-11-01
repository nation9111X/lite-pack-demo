// Lighthouse (мобильный профиль) по списку страниц: node lh.mjs http://localhost:5191 out-prefix [paths...]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://localhost:5191';
const prefix = process.argv[3] || 'after';
const paths = process.argv.slice(4).length ? process.argv.slice(4) : ['/', '/category/8b23600b-d61b-415f-85b9-952b011d7932', '/product/b39464d0c6714472add98099e5794abe'];
fs.mkdirSync('../docs/lighthouse', { recursive: true });
const chrome = chromium.executablePath();
const rows = [];
for (const p of paths) {
  const name = p === '/' ? 'home' : p.split('/')[1];
  const out = `../docs/lighthouse/${prefix}-${name}.json`;
  try {
    execFileSync(process.execPath, [
      'node_modules/lighthouse/cli/index.js', base + p, '--quiet', '--output=json', `--output-path=${out}`,
      '--only-categories=performance,accessibility,seo,best-practices',
      '--chrome-flags=--headless=new --disable-gpu',
      '--blocked-url-patterns=*mc.yandex.ru*', '--blocked-url-patterns=*mdd.yandex.net*',
    ], { env: { ...process.env, CHROME_PATH: chrome }, stdio: 'pipe', timeout: 180000 });
  } catch (e) {
    if (!fs.existsSync(out)) { console.log('LH failed', p, String(e.stderr || e).slice(0, 300)); continue; }
  }
  const r = JSON.parse(fs.readFileSync(out, 'utf8'));
  const c = r.categories;
  const a = r.audits;
  rows.push({
    page: p.slice(0, 40), perf: Math.round(c.performance.score * 100), a11y: Math.round(c.accessibility.score * 100), bp: Math.round(c['best-practices'].score * 100), seo: Math.round(c.seo.score * 100),
    LCP: a['largest-contentful-paint'].displayValue, FCP: a['first-contentful-paint'].displayValue, TBT: a['total-blocking-time'].displayValue, CLS: a['cumulative-layout-shift'].displayValue, KB: Math.round(a['total-byte-weight'].numericValue / 1024),
  });
  const fails = Object.values(a).filter((x) => x.score !== null && x.score < 0.9 && x.scoreDisplayMode !== 'informative' && x.scoreDisplayMode !== 'manual' && x.scoreDisplayMode !== 'notApplicable');
  console.log(p, '— проблемные аудиты:', fails.map((x) => `${x.id}(${x.displayValue ?? x.score})`).join(', ').slice(0, 900));
}
console.table(rows);
