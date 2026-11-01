// Тестовый API для закрытых сценариев (вход, оформление, заказы, профиль).
// Каталог, адреса и корзина проксируются на боевой lite-pack.ru от имени анонимного профиля мок-сервера.
// Ничего не оформляет и не отправляет SMS на боевом сервере.
// Запуск: node mock-api.mjs  (порт 5199), затем LITEPACK_API=http://localhost:5199 npx vite --port 5192
import http from 'node:http';
import { anon, BASE, H } from './api.mjs';

const PORT = 5199;
const MOCK_TOKEN = 'mock-auth-token';
const anonSession = await anon();
const realToken = anonSession.accessToken;
const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
const readBody = (req) => new Promise((r) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => { try { r(d ? JSON.parse(d) : null); } catch { r(null); } }); });

async function realGet(path) {
  const r = await fetch(BASE + path, { headers: { ...H, authorization: 'Bearer ' + realToken } });
  return r.json();
}

const day = (d, h) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, 0, 0, 0); return x.toISOString(); };
const slots = [1, 2].flatMap((d) => [10, 12, 14, 16].map((h) => ({ start: day(d, h), end: day(d, h + 2) })));
const orders = new Map();
const completed = {
  id: 'o-hist', orderNumber: '1000', createdOn: day(-12, 11), status: 'completed', callAfterOrder: false, confirmedDate: day(-12, 11), cancelAfterDate: null,
  price: { totalForItems: 3260, finalForItems: 3260, final: 3260, promoCode: null, discount: 0, deliveryPrice: 0 },
  paymentMethodInfo: { method: 'inPlaceCard', startPaymentNow: false, comment: null }, paymentInfo: { paymentStatus: 'fullyPaid', waitingForBankConfirmation: false },
  editFlags: { edit: false, cancel: false, repeat: true, paymentMethod: false, comment: false, callAfterOrder: false }, deliveryParts: [],
};

async function draftFromCart() {
  const addrs = await realGet('v1/users/addresses');
  const active = addrs.addresses.find((a) => a.id === addrs.activeAddressId);
  const cart = (await realGet('v1/cart?addressId=' + addrs.activeAddressId)).cart;
  const items = cart.items.map((i) => ({ product: { id: i.product.id, info: i.product.info }, quantityOfUnits: i.quantityOfUnits, price: i.price }));
  return {
    cart,
    order: {
      id: 'o-' + (orders.size + 1), orderNumber: String(1001 + orders.size), createdOn: new Date().toISOString(), status: 'draft', callAfterOrder: false, confirmedDate: null, cancelAfterDate: null,
      price: cart.price,
      paymentMethodInfo: { method: 'inPlaceAll', startPaymentNow: false, comment: null },
      paymentInfo: { paymentStatus: 'notPaid', waitingForBankConfirmation: false },
      editFlags: { edit: true, cancel: true, repeat: false, paymentMethod: true, comment: true, callAfterOrder: true },
      deliveryParts: [{ position: 1, status: 'created', items, orderReceiver: null, deliveryAddress: { name: active?.namedAddress.name ?? null, address: active?.namedAddress.address, departmentId: active?.namedAddress.departmentId ?? null, regionId: active?.namedAddress.regionId ?? null }, possibleDeliveryTime: slots, deliveryTime: null, editFlags: { deliveryTime: true, receiver: true } }],
    },
    additionalPaymentMethods: [
      { method: 'card', startPaymentNow: true, comment: null },
      { method: 'paymentAccount', startPaymentNow: false, comment: null, notAvailableMessage: 'Доступно для юр. лиц' },
    ],
    appMessage: null, leftoversItems: null, splitSuggestion: null,
  };
}

let current = null;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname.replace(/^\/api\//, '');
  const auth = req.headers.authorization === 'Bearer ' + MOCK_TOKEN;
  const m = req.method;
  try {
    if (url.pathname.startsWith('/api/')) {
      if (m === 'POST' && p === 'v1/auth/requestSmsCode') return json(res, 200, { verificationId: 'ver-1', codeLength: 4, secondsToResend: 30 });
      if (m === 'POST' && p === 'v1/auth/loginWithSms') {
        const b = await readBody(req);
        if (b?.code !== '1234') return json(res, 400, { message: 'Неверный смс код', errors: [{ code: 1, message: 'wrongSmsCode' }], developerMessage: null });
        return json(res, 200, { clientId: 'mock-client', profileId: 'p-person', profileKind: 'shopPerson', accessToken: MOCK_TOKEN, isNew: false });
      }
      if (auth) {
        if (p === 'v1/auth/logout' || p === 'v1/auth/delete') return json(res, 200, {});
        if (p === 'v1/profiles/shopProfiles') return json(res, 200, {
          activeProfileId: 'p-person', suggestions: [],
          profiles: [
            { id: 'p-person', kind: 'shopPerson', name: 'Тестовый покупатель', phone: '+7 999 000-00-00', email: null, company: null },
            { id: 'p-company', kind: 'shopCompany', name: null, phone: '+7 999 000-00-00', email: null, company: { inn: '0000000000', kpp: '000000000', shortName: 'ООО «Тестовая компания»' } },
          ],
        });
        if (m === 'PATCH' && p === 'v1/profiles') return json(res, 200, {});
        if (m === 'POST' && p === 'v1/companies/find') return json(res, 200, { companies: [{ inn: '0000000000', kpp: '000000000', ogrn: '0000000000000', shortName: 'ООО «Тестовая компания»', fullAddress: 'г. Тестовый, ул. Примерная, 1' }] });
        if (m === 'POST' && p === 'v1/profiles/company') return json(res, 200, {});
        if (m === 'POST' && p === 'v1/cart/checkout') { current = await draftFromCart(); return json(res, 200, current); }
        if (m === 'DELETE' && p === 'v1/cart/checkout') return json(res, 200, {});
        if (m === 'PATCH' && p === 'v1/orders/checkout') {
          const b = await readBody(req);
          const o = current.order;
          o.deliveryParts.forEach((part) => { const pp = b.deliveryParts?.find((x) => x.position === part.position); if (pp?.deliveryTime) part.deliveryTime = pp.deliveryTime; if (pp?.orderReceiver) part.orderReceiver = pp.orderReceiver; });
          o.paymentMethodInfo = [{ method: 'inPlaceAll', startPaymentNow: false }, ...current.additionalPaymentMethods].find((x) => x.method === b.paymentMethod);
          o.comment = b.comment ?? null;
          return json(res, 200, { order: o, checkoutId: 'ck-1', additionalPaymentMethods: current.additionalPaymentMethods });
        }
        let mm;
        if ((mm = p.match(/^v1\/orders\/([^/]+)\/confirm$/)) && m === 'POST') {
          const o = { ...current.order, status: 'confirmed', confirmedDate: new Date().toISOString() };
          o.deliveryParts = o.deliveryParts.map((x) => ({ ...x, status: 'confirmed' }));
          orders.set(o.id, o);
          return json(res, 200, { order: o });
        }
        if ((mm = p.match(/^v1\/orders\/([^/]+)\/paymentForm$/))) return json(res, 200, { paymentForm: { paymentId: 'pay-1', formUrl: `${req.headers.origin ?? 'http://localhost:5192'}/paymentCompleted?orderId=${mm[1]}&paymentId=pay-1`, returnUrl: '', failUrl: '' }, fullyPaid: false, qrCode: null });
        if ((mm = p.match(/^v1\/orders\/([^/]+)\/paymentCompleted$/))) { const o = orders.get(mm[1]); if (o) o.paymentInfo = { paymentStatus: 'fullyPaid', waitingForBankConfirmation: false }; return json(res, 200, {}); }
        if ((mm = p.match(/^v1\/orders\/([^/]+)\/cancel$/))) { const o = orders.get(mm[1]); if (o) { o.status = 'canceled'; o.editFlags = { ...o.editFlags, cancel: false }; } return json(res, 200, { order: o }); }
        if ((mm = p.match(/^v1\/orders\/([^/]+)\/receipts$/))) return json(res, 200, { receipts: [{ link: '/static/legal/privacy-policy.pdf', date: new Date().toISOString(), kindTitle: 'Чек (тест)', kind: 'prePayment' }] });
        if (p === 'v1/orders/confirmationCode') return json(res, 200, { code: '4821', validTo: day(1, 12) });
        if (p === 'v1/orders') return json(res, 200, { orders: [...orders.values()].filter((o) => o.status !== 'canceled') });
        if (p === 'v1/orders/history') return json(res, 200, { orders: [completed, ...[...orders.values()].filter((o) => o.status === 'canceled')] });
        if (p === 'v1/orders/latest') return json(res, 200, { orders: [...orders.values()] });
        if ((mm = p.match(/^v1\/orders\/([^/]+)$/))) return json(res, 200, { order: orders.get(mm[1]) ?? completed });
        if (p === 'v1/wishes') return json(res, 200, {});
      }
    }
    // Всё остальное — на боевой сервер (картинки ресайза, каталог, адреса, корзина)
    const body = m === 'GET' || m === 'HEAD' ? undefined : await new Promise((r) => { const ch = []; req.on('data', (c) => ch.push(c)); req.on('end', () => r(Buffer.concat(ch))); });
    const headers = { ...req.headers };
    delete headers.host; delete headers.origin; delete headers.referer; delete headers['accept-encoding']; delete headers.connection;
    if (auth) headers.authorization = 'Bearer ' + realToken;
    const r = await fetch('https://lite-pack.ru' + req.url, { method: m, headers, body });
    const buf = Buffer.from(await r.arrayBuffer());
    res.writeHead(r.status, { 'content-type': r.headers.get('content-type') ?? 'application/octet-stream' });
    res.end(buf);
  } catch (e) {
    json(res, 500, { message: 'mock error: ' + e.message });
  }
});
server.listen(PORT, () => console.log('mock api on', PORT));
