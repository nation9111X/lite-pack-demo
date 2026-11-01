import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 375, height: 800 }, isMobile: true, hasTouch: true });
await ctx.route((u) => /(^|\.)(mc|mdd)\.yandex\.(ru|net)$/.test(u.hostname), (r) => r.abort());
await ctx.addInitScript(() => { localStorage.setItem('lp.cookieAccepted', 'true'); localStorage.setItem('lp.regionSkipped', 'true'); });
const p = await ctx.newPage();
await p.goto('http://localhost:5190/profile', { waitUntil: 'networkidle' });
await p.getByRole('button', { name: 'Войти или зарегистрироваться' }).click();
await p.waitForTimeout(600);
console.log(await p.evaluate(() => {
  const d = document.querySelector('dialog[open]');
  const out = [['dialog', d.getBoundingClientRect().width, getComputedStyle(d).width, getComputedStyle(d).maxWidth]];
  d.querySelectorAll('.dlg__panel, .dlg__body, form, .auth__phone, .auth__phone input, .check, .btn').forEach((el) => out.push([el.className || el.tagName, Math.round(el.getBoundingClientRect().width), Math.round(el.scrollWidth)]));
  return JSON.stringify(out);
}));
await p.screenshot({ path: '../docs/review/auth-375.png' });
await b.close();
