// Сквозной сценарий покупателя: node e2e.mjs <baseUrl> <width> [outDir]
// Не отправляет SMS и не создаёт заказов на боевом сервере.
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.argv[2] || 'http://localhost:5190';
const w = Number(process.argv[3] || 1440);
const out = process.argv[4] || `../docs/BEFORE_AFTER/after/flow-${w}`;
fs.mkdirSync(out, { recursive: true });
const mobile = w < 1024;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: w, height: w < 800 ? 812 : 900 }, locale: 'ru-RU', isMobile: w < 500, hasTouch: w < 800 });
await ctx.route((u) => /(^|\.)(mc|mdd)\.yandex\.(ru|net)$/.test(u.hostname), (r) => r.abort());
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error' && !/yandex/.test(m.location()?.url ?? '')) errors.push(m.text().slice(0, 200)); });
let n = 0;
const shot = async (name) => p.screenshot({ path: `${out}/${String(++n).padStart(2, '0')}-${name}.png` });
const step = (s) => console.log('✓', s);
const fail = (s) => { console.log('✗', s); process.exitCode = 1; };

try {
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  await p.getByRole('dialog', { name: 'Выберите регион доставки' }).waitFor({ timeout: 10000 });
  await shot('region-prompt');
  await p.getByRole('button', { name: 'Удмуртия', exact: true }).click();
  step('регион выбран');
  await p.getByRole('button', { name: 'OK', exact: true }).click();
  step('cookie приняты');

  await p.goto(base + '/category/8b23600b-d61b-415f-85b9-952b011d7932', { waitUntil: 'networkidle' });
  const firstCard = p.locator('.pcard').first();
  const title = (await firstCard.locator('.pcard__title').innerText()).trim();
  await firstCard.getByRole('button', { name: 'В корзину' }).click();
  const dlg = p.getByRole('dialog', { name: 'Адрес доставки' });
  await dlg.waitFor();
  await p.waitForTimeout(400);
  await shot('address-sheet');
  step('без адреса открылся выбор способа получения');

  await dlg.getByLabel('Новый адрес').fill('Ижевск, Пушкинская 154');
  await dlg.getByRole('option').first().waitFor({ timeout: 15000 });
  await shot('address-suggestions');
  await dlg.getByRole('option').first().locator('button').click();
  await dlg.getByLabel('Кв/офис').fill('1');
  await shot('address-extra');
  await dlg.getByRole('button', { name: 'Выбрать', exact: true }).click();
  await dlg.waitFor({ state: 'hidden', timeout: 15000 });
  step('адрес доставки создан');

  const stepper = firstCard.locator('.stepper');
  await stepper.waitFor({ timeout: 10000 });
  const v1 = await stepper.locator('output').innerText();
  await p.waitForTimeout(1500);
  await shot('added');
  step(`товар «${title.slice(0, 40)}…» в корзине: ${v1}`);

  await stepper.getByRole('button', { name: /Добавить/ }).click();
  await p.waitForTimeout(1500);
  const v2 = await stepper.locator('output').innerText();
  v2 !== v1 ? step(`степпер с кратностью: ${v1} → ${v2}`) : fail('степпер не изменил количество');

  if (mobile) {
    await p.getByRole('link', { name: /Корзина/ }).click();
    await p.waitForURL('**/cart');
  } else {
    await p.locator('.cart-btn').click();
    await p.getByRole('dialog', { name: 'Корзина' }).waitFor();
  }
  await p.waitForTimeout(1500);
  await shot('cart');
  const meter = await p.locator('.tape__text').first().innerText().catch(() => '');
  step('корзина открыта; ' + (meter || 'без порога'));
  const total = await p.locator('.summary__total dd').first().innerText();
  step('итого: ' + total);

  const cta = p.getByRole('button', { name: /Перейти к оформлению/ });
  for (let i = 0; i < 8 && (await cta.isDisabled()); i++) {
    await p.locator('.cline .stepper').first().getByRole('button', { name: /Добавить/ }).click();
    await p.waitForTimeout(900);
  }
  await p.waitForTimeout(800);
  await shot('cart-min-reached');
  step('минимальная сумма набрана: ' + (await p.locator('.tape__text').first().innerText()).replace(/s+/g, ' '));
  await cta.click();
  const auth = p.getByRole('dialog', { name: 'Введите номер телефона' });
  if (await auth.isVisible().catch(() => false) || (await auth.waitFor({ timeout: 4000 }).then(() => true).catch(() => false))) {
    await auth.getByLabel('Номер телефона').fill('9990000000');
    const btn = auth.getByRole('button', { name: 'Войти', exact: true });
    const disabledBefore = await btn.isDisabled();
    await auth.locator('input[type=checkbox]').first().check();
    const disabledAfter = await btn.isDisabled();
    await shot('auth');
    disabledBefore && !disabledAfter ? step('вход: кнопка активна только после согласия (SMS не отправляли)') : fail('логика согласия на вход');
    await p.keyboard.press('Escape');
  } else step('кнопка оформления неактивна — сумма ниже минимальной');

  await p.goto(base + '/product/b39464d0c6714472add98099e5794abe', { waitUntil: 'networkidle' });
  await shot('product');
  const h1 = await p.locator('h1').innerText();
  step('карточка товара: ' + h1.slice(0, 50));
  const ld = await p.locator('#jsonld').textContent();
  ld && ld.includes('"@type":"Product"') ? step('JSON-LD Product на месте') : fail('нет JSON-LD');
  const docTitle = await p.title();
  step('title: ' + docTitle.slice(0, 70));

  const search = p.locator(mobile ? '.hdr__search-row input[type=search]' : '.hdr__search input[type=search]');
  await search.fill('стакан');
  await p.locator('.search__panel').waitFor({ timeout: 10000 });
  await p.waitForTimeout(800);
  await shot('search-suggest');
  step('подсказки поиска');
  await search.press('Enter');
  await p.waitForURL('**/search?q=*');
  await p.locator('.pcard').first().waitFor();
  await shot('search-page');
  step('страница поиска: ' + (await p.locator('.page__count').first().innerText()));

  if (!mobile) {
    await p.locator('.hdr__catalog').click();
    await p.locator('.mega').waitFor();
    await p.waitForTimeout(500);
    await shot('mega-menu');
    step('мега-меню каталога');
    await p.keyboard.press('Escape');
  }

  await p.goto(base + '/old-route-that-does-not-exist', { waitUntil: 'networkidle' });
  (await p.locator('text=Такой страницы не существует').count()) ? step('404') : fail('404');
} catch (e) {
  fail('сценарий прерван: ' + e.message.split('\n')[0]);
  await shot('error');
}
console.log(errors.length ? 'Ошибки консоли:\n' + errors.join('\n') : 'Консоль без ошибок');
await b.close();
