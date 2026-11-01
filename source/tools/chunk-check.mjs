// Обрыв связи: файл страницы или карты не загрузился. Сайт не должен падать на экран разработчика. node chunk-check.mjs [база]
import { chromium } from 'playwright';

const base = (process.argv[2] || 'http://localhost:5193').replace(/\/$/, '');
const b = await chromium.launch({ channel: 'chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ru-RU' });
await ctx.addInitScript(() => {
  localStorage.setItem('lp.cookieAccepted', 'true');
  localStorage.setItem('lp.regionSkipped', 'true');
  sessionStorage.setItem('lp.chunkReloadAt', String(Date.now())); // автоперезагрузка уже была: видим сам экран
});
const p = await ctx.newPage();
const dev = (t) => /Hey developer|Unexpected Application Error/.test(t);

// карта адреса: падает только карта, окно адреса и страница живы
await p.route(/AddressMap/, (r) => r.abort());
await p.goto(base + '/', { waitUntil: 'load' });
await p.waitForTimeout(800);
await p.locator('.hdr__mobile-addr .addr-chip').click();
await p.waitForTimeout(2200);
const map = await p.evaluate(() => ({ dialog: !!document.querySelector('dialog[open]'), text: document.querySelector('dialog[open] .amap__load')?.textContent ?? '', body: document.body.innerText }));
console.log('карта:', JSON.stringify({ dialog: map.dialog, text: map.text, devScreen: dev(map.body) }));

// страница: сообщение внутри сайта, шапка и меню на месте
await p.unroute(/AddressMap/);
await p.goto(base + '/', { waitUntil: 'load' });
await p.waitForTimeout(800);
await p.route(/(pages\/Faq|assets\/Faq)/, (r) => r.abort());
await p.evaluate(() => {
  history.pushState({}, '', location.pathname.replace(/\/$/, '') + '/faq');
  dispatchEvent(new PopStateEvent('popstate'));
});
await p.waitForTimeout(1500);
const page = await p.evaluate(() => ({ h: document.querySelector('[role=alert] h2')?.textContent ?? '', header: !!document.querySelector('.hdr'), nav: !!document.querySelector('.bnav'), body: document.body.innerText }));
console.log('страница:', JSON.stringify({ h: page.h, header: page.header, nav: page.nav, devScreen: dev(page.body) }));
await b.close();
