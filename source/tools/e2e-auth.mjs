// Закрытые сценарии на мок-API (tools/mock-api.mjs): node e2e-auth.mjs http://localhost:5192 1440
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.argv[2] || 'http://localhost:5192';
const w = Number(process.argv[3] || 1440);
const out = process.argv[4] || `../docs/BEFORE_AFTER/after/auth-${w}`;
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: w, height: w < 800 ? 812 : 900 }, locale: 'ru-RU', isMobile: w < 500, hasTouch: w < 800 });
await ctx.route((u) => /(^|\.)(mc|mdd)\.yandex\.(ru|net)$/.test(u.hostname), (r) => r.abort());
await ctx.addInitScript(() => { localStorage.setItem('lp.cookieAccepted', 'true'); localStorage.setItem('lp.regionSkipped', 'true'); });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error' && !/yandex/.test(m.location()?.url ?? '')) errors.push(m.text().slice(0, 200) + ' @' + (m.location()?.url ?? '').slice(0, 80)); });
let n = 0;
const shot = (name) => p.screenshot({ path: `${out}/${String(++n).padStart(2, '0')}-${name}.png` });
const ok = (s) => console.log('✓', s);
const fail = (s) => { console.log('✗', s); process.exitCode = 1; };

try {
  // Вход
  await p.goto(base + '/profile', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: 'Войти или зарегистрироваться' }).click();
  const auth = p.getByRole('dialog', { name: 'Введите номер телефона' });
  await auth.getByLabel('Номер телефона').fill('9990000000');
  await auth.locator('input[type=checkbox]').first().check();
  await auth.getByRole('button', { name: 'Войти', exact: true }).click();
  const codeDlg = p.getByRole('dialog', { name: 'Введите код' });
  await codeDlg.waitFor();
  await codeDlg.getByLabel('Код из SMS').fill('0000');
  await codeDlg.getByText('Неверный смс код').waitFor({ timeout: 5000 });
  await shot('wrong-code');
  ok('неверный код показывает ошибку');
  await codeDlg.getByLabel('Код из SMS').fill('1234');
  await codeDlg.waitFor({ state: 'hidden' });
  await p.getByRole('heading', { name: 'Тестовый покупатель' }).waitFor();
  await shot('profile');
  ok('вход выполнен, профиль загружен');

  // Адрес и корзина
  await p.goto(base + '/category/8b23600b-d61b-415f-85b9-952b011d7932', { waitUntil: 'networkidle' });
  const card = p.locator('.pcard').filter({ has: p.getByRole('button', { name: 'В корзину' }) }).first();
  await card.getByRole('button', { name: 'В корзину' }).click();
  const dlg = p.getByRole('dialog', { name: 'Адрес доставки' });
  if (await dlg.waitFor({ timeout: 3000 }).then(() => true).catch(() => false)) {
    await dlg.getByLabel('Новый адрес').fill('Ижевск, Пушкинская 154');
    await dlg.getByRole('option').first().locator('button').click();
    await dlg.getByRole('button', { name: 'Выбрать', exact: true }).click();
    await dlg.waitFor({ state: 'hidden', timeout: 15000 });
  }
  await p.waitForTimeout(1500);
  await p.waitForTimeout(1500);
  await p.goto(base + '/cart', { waitUntil: 'networkidle' });
  const cta = p.getByRole('button', { name: /Перейти к оформлению/ });
  for (let i = 0; i < 8 && (await cta.isDisabled()); i++) { await p.locator('.cline .stepper').first().getByRole('button', { name: /Добавить/ }).click(); await p.waitForTimeout(900); }
  await cta.click();
  await p.waitForURL('**/checkout');
  await p.getByRole('heading', { name: 'Оформление заказа' }).waitFor();
  await p.locator('.slot').first().waitFor();
  await p.locator('.slot').nth(1).click();
  await p.getByRole('radio', { name: 'Новый получатель' }).click();
  await p.getByLabel('Имя').fill('Иван');
  await p.getByLabel('Телефон').fill('+79990000001');
  await p.getByLabel('Комментарий к заказу').fill('Тестовый комментарий');
  await shot('checkout');
  ok('оформление: слот, получатель, комментарий');
  await p.getByRole('button', { name: 'Оформить заказ' }).click();
  await p.getByRole('heading', { name: 'Спасибо за заказ' }).waitFor({ timeout: 15000 });
  await shot('done');
  ok('заказ оформлен: ' + (await p.locator('.done p').first().innerText()));

  // Детали заказа, чек, отмена
  await p.getByRole('link', { name: 'Детали заказа' }).click();
  await p.getByRole('heading', { name: /Заказ №/ }).waitFor();
  await shot('order');
  (await p.getByText('Дата и время доставки:').count()) ? ok('в заказе выбранный слот доставки') : fail('нет слота в деталях');
  await p.getByRole('button', { name: 'Скачать чек' }).click();
  await p.getByRole('dialog', { name: 'Выберите чек' }).getByText('Чек (тест)').waitFor();
  ok('чеки загружаются');
  await p.keyboard.press('Escape');
  await p.getByRole('button', { name: 'Отменить заказ' }).click();
  await p.getByRole('button', { name: 'Да, отменить' }).click();
  await p.getByText('Отменён', { exact: true }).first().waitFor({ timeout: 8000 });
  await shot('order-canceled');
  ok('отмена заказа');

  // Списки заказов
  await p.goto(base + '/orders', { waitUntil: 'networkidle' });
  await shot('orders-active');
  await p.getByRole('tab', { name: 'История' }).click();
  await p.locator('.ocard').first().waitFor();
  await shot('orders-history');
  ok('история заказов: ' + (await p.locator('.ocard').count()));

  // Повтор заказа из истории
  await p.locator('.ocard').first().click();
  await p.getByRole('heading', { name: /Заказ №/ }).waitFor();
  ok('карточка заказа из истории открывается');

  // Компания
  await p.goto(base + '/add-company', { waitUntil: 'networkidle' });
  await p.getByLabel('Введите ИНН вашей компании').fill('0000000000');
  await p.getByText('ООО «Тестовая компания»').waitFor({ timeout: 8000 });
  await shot('add-company');
  await p.getByRole('button', { name: 'Добавить', exact: true }).click();
  await p.waitForURL('**/profile');
  ok('добавление компании → профиль');

  // Второй заказ с оплатой картой → возврат с платёжной формы
  await p.goto(base + '/cart', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: /Перейти к оформлению/ }).click();
  await p.waitForURL('**/checkout');
  await p.getByRole('radio', { name: /Картой онлайн/ }).click();
  await shot('checkout-card');
  await p.getByRole('button', { name: 'Перейти к оплате' }).click();
  await p.waitForURL('**/order/**', { timeout: 15000 });
  await p.getByRole('heading', { name: /Заказ №/ }).waitFor();
  (await p.getByText('Оплачено', { exact: true }).count()) ? ok('оплата картой: возврат из формы, статус «Оплачено»') : fail('статус оплаты');
  await shot('paid');

  // Выход
  await p.goto(base + '/profile', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: 'Выйти' }).first().click();
  await p.getByRole('dialog', { name: 'Выйти' }).getByRole('button', { name: 'Выйти' }).click();
  await p.getByRole('button', { name: 'Войти или зарегистрироваться' }).waitFor({ timeout: 10000 });
  ok('выход из аккаунта');
} catch (e) {
  fail('сценарий прерван: ' + e.message.split('\n')[0]);
  await shot('error');
}
console.log(errors.length ? 'Ошибки консоли:\n' + errors.join('\n') : 'Консоль без ошибок');
await b.close();
