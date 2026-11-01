// Демо-версия без сервера (npm run preview:static): тот же контракт, что у API lite-pack.ru, но
//  • каталог, цены и остатки — из снимка data/snapshot.json (файлы /demo/catalog.json и /demo/p/<id>.json);
//  • адреса, корзина, вход и «заказы» живут в браузере (localStorage) и никуда не отправляются.
// Подключается только при VITE_DEMO=1 (см. api() в client.ts); в обычную сборку не попадает.
import { ApiError, type RequestOptions } from './client';
import type {
  AddressSuggestion, AnonRegion, Cart, CartResponse, Category, DeliveryRegion, Department, Money, Order, Product, ProductInfo, Ref, UserAddress,
} from './types';
import { asset } from '../lib/base';
import { zoneAt } from '../lib/geo';

type RegionPrice = { price: number; finalPrice: number; quantityLeft: number; quantityOfUnitsLeft: number; outOfStock: boolean };
type Lite = Omit<Product, 'price' | 'finalPrice' | 'quantityLeft' | 'quantityOfUnitsLeft' | 'outOfStock'> & { r: Record<string, RegionPrice> };
interface Catalog {
  fetchedAt: string;
  settings: unknown;
  faq: unknown;
  regions: AnonRegion[];
  departments: Department[];
  deliveryRegions?: DeliveryRegion[];
  tree: Category[];
  leaves: Record<string, string[]>;
  products: Record<string, Lite>;
}
type Query = NonNullable<RequestOptions['query']>;

let catalogP: Promise<Catalog> | null = null;
// Каталог лежит и сжатым (.bin, gzip, ~в 6 раз меньше), и обычным JSON: не все хостинги сжимают файлы сами
async function loadCatalog(): Promise<Catalog> {
  if (typeof DecompressionStream !== 'undefined') {
    try {
      const r = await fetch(asset('/demo/catalog.bin'));
      if (r.ok && r.body) return (await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).json()) as Catalog;
    } catch {
      /* старый браузер или хостинг уже распаковал — берём обычный JSON */
    }
  }
  const r = await fetch(asset('/demo/catalog.json'));
  if (!r.ok) throw new ApiError(r.status, 'Не удалось загрузить каталог');
  return r.json() as Promise<Catalog>;
}
const catalog = () => (catalogP ??= loadCatalog());

const details = new Map<string, Promise<{ description?: string; short?: string; properties?: Product['properties']; brands?: Ref[]; plants?: Ref[] } | null>>();
const detailsOf = (id: string) => {
  if (!details.has(id)) details.set(id, fetch(asset(`/demo/p/${id}.json`)).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  return details.get(id)!;
};

// ---------- состояние покупателя (только в этом браузере) ----------
interface State {
  addresses: UserAddress[];
  active: string | null;
  cart: { productId: string; quantityOfUnits: number }[];
  orders: Order[];
  draft: Order | null;
  authorized: boolean;
  seq: number;
}
const KEY = 'lp.demo.v1';
function load(): State {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && Array.isArray(s.addresses)) return s;
  } catch {
    /* пусто или недоступно */
  }
  return { addresses: [], active: null, cart: [], orders: [], draft: null, authorized: false, seq: 1 };
}
const save = (s: State) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* приватный режим — живём в памяти */
  }
};
const uid = (s: State, p: string) => `${p}-${Date.now().toString(36)}-${s.seq++}`;

// ---------- каталог ----------
const norm = (t: string) => t.toLowerCase().replace(/ё/g, 'е');

/** Регион по параметрам запроса; без региона (покупатель его не выбрал) — весь каталог, как у живого API. */
function regionOf(c: Catalog, q: Query): AnonRegion | null {
  const rid = q.regionId ? String(q.regionId) : '';
  const did = q.departmentId ? String(q.departmentId) : '';
  const zone = rid ? c.deliveryRegions?.find((z) => z.id === rid) : undefined;
  if (zone) return anonForZone(c, zone);
  return (rid && c.regions.find((r) => r.regionId === rid)) || (did && c.regions.find((r) => r.sourceDepartmentIds.includes(did))) || null;
}

/** Зона доставки → регион цен (Удмуртия или Башкортостан): какой склад ближе к зоне. */
function anonForZone(c: Catalog, z: DeliveryRegion): AnonRegion {
  const ring = z.positivePolygon[0]?.coordinates ?? [];
  const lat = ring.reduce((a, p) => a + p.lat, 0) / (ring.length || 1);
  const lng = ring.reduce((a, p) => a + p.lng, 0) / (ring.length || 1);
  const d = (k: (typeof CITY)[number]) => Math.hypot(lat - k.lat, (lng - k.lng) * 0.56);
  return c.regions[d(CITY[0]) < d(CITY[1]) ? CITY[0].region : CITY[1].region] ?? c.regions[0];
}

function productIn(c: Catalog, id: string, region: string | null, anyRegion = false): Product | null {
  const l = c.products[id];
  if (!l) return null;
  let pr = region ? l.r[region] : (l.r[c.regions[0]?.name] ?? Object.values(l.r)[0]);
  if (!pr) {
    if (!anyRegion) return null;
    const other = Object.values(l.r)[0];
    if (!other) return null;
    pr = { ...other, quantityLeft: 0, quantityOfUnitsLeft: 0, outOfStock: true };
  }
  const { r: _r, ...rest } = l;
  return { ...rest, ...pr } as Product;
}

const index = new WeakMap<Catalog, Map<string, { node: Category; parent: Category | null }>>();
function categoryIndex(c: Catalog) {
  let m = index.get(c);
  if (!m) {
    m = new Map();
    const walk = (list: Category[], parent: Category | null) =>
      list.forEach((n) => {
        m!.set(n.id, { node: n, parent });
        walk(n.subCategories ?? [], n);
      });
    walk(c.tree, null);
    index.set(c, m);
  }
  return m;
}
const bare = (n: Category): Category => ({ ...n, subCategories: [], products: [], hasSubcategories: false });

function matches(title: string, words: string[]) {
  const t = norm(title);
  return words.every((w) => t.includes(w));
}

// ---------- адреса ----------
const CITY = [
  { re: /нефтекамск|башк|уфа|агидел|янаул|дюртюл/i, city: 'Нефтекамск', lat: 56.088, lng: 54.248, region: 1 },
  { re: /./, city: 'Ижевск', lat: 56.852, lng: 53.204, region: 0 },
];
const suggestions = new Map<string, AddressSuggestion>();
const CLOSED = 'В данный регион доставка пока не работает.'; // текст живого API

/** Как у API магазина: поиск зону не знает, адрес по точке — знает (зона доставки = regionId). */
function remember(c: Catalog, s: AddressSuggestion, withZone: boolean): AddressSuggestion {
  if (withZone) {
    const z = zoneAt(c.deliveryRegions, s.address.lat, s.address.lng);
    Object.assign(s, { regionId: z?.id ?? null, workingStatus: z ? 'working' : 'closed', workingStatusMessage: z ? null : CLOSED });
  }
  suggestions.set(`${s.address.lat},${s.address.lng}`, s);
  return s;
}

// У демо нет сервера магазина — адреса подсказывает открытый геокодер Photon (данные OpenStreetMap)
type PhotonF = { geometry: { coordinates: [number, number] }; properties: Record<string, string | undefined> };
async function photon(url: string): Promise<PhotonF[]> {
  const r = await fetch('https://photon.komoot.io' + url + '&lang=default');
  if (!r.ok) throw new Error('photon');
  return ((await r.json()).features ?? []) as PhotonF[];
}
function fromPhoton(f: PhotonF): AddressSuggestion | null {
  const p = f.properties;
  if (p.countrycode && p.countrycode !== 'RU') return null;
  const [lng, lat] = f.geometry.coordinates;
  const locality = p.city || p.town || p.village || p.county || null;
  const street = p.street || (p.type === 'street' ? p.name : null) || null;
  const house = p.housenumber || null;
  const value = [p.postcode, p.state, locality, street, house].filter(Boolean).join(', ') || p.name || 'Точка на карте';
  return { address: { value, postalCode: p.postcode ?? null, region: p.state ?? null, locality, street, house, lat, lng }, departmentId: null, regionId: null, workingStatus: 'closed', workingStatusMessage: CLOSED };
}
async function searchAddresses(c: Catalog, text: string): Promise<AddressSuggestion[]> {
  if (text.length < 3) return [];
  try {
    const list = (await photon(`/api/?q=${encodeURIComponent(text)}&limit=6&lat=56.6&lon=53.6&location_bias_scale=0.3`)).map(fromPhoton).filter((x): x is AddressSuggestion => !!x);
    return list.slice(0, 5).map((s) => remember(c, s, false));
  } catch {
    return suggest(c, text);
  }
}
async function addressAt(c: Catalog, lat: number, lng: number): Promise<AddressSuggestion> {
  try {
    const f = (await photon(`/reverse?lat=${lat}&lon=${lng}&limit=1`))[0];
    const s = f && fromPhoton(f);
    if (s) return remember(c, s, true);
  } catch {
    /* геокодер недоступен — ниже точка без адреса */
  }
  const value = `Точка на карте ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  return remember(c, { address: { value, lat, lng }, departmentId: null, regionId: null, workingStatus: 'closed', workingStatusMessage: null }, true);
}

/** Запасной вариант без сети: адрес «как ввели» с примерными координатами. */
function suggest(c: Catalog, text: string): AddressSuggestion[] {
  const t = text.trim().replace(/\s+/g, ' ');
  if (t.length < 3) return [];
  const k = CITY.find((x) => x.re.test(t))!;
  const region = c.regions[k.region] ?? c.regions[0];
  const hasCity = /ижевск|нефтекамск|уфа|сарапул|воткинск|глазов|можга|агидел|янаул/i.test(t);
  let h = 0;
  for (const ch of t) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const lat = +(k.lat + ((h % 1000) - 500) / 40000).toFixed(6);
  const lng = +(k.lng + ((Math.floor(h / 1000) % 1000) - 500) / 40000).toFixed(6);
  const s: AddressSuggestion = {
    address: { value: hasCity ? t : `${k.city}, ${t}`, locality: k.city, region: region.name, lat, lng },
    departmentId: null,
    regionId: region.regionId,
    workingStatus: 'working',
    workingStatusMessage: null,
  };
  return [remember(c, s, true)];
}

function regionOfAddress(c: Catalog, a: UserAddress | undefined): AnonRegion {
  const n = a?.namedAddress;
  return regionOf(c, { regionId: n?.regionId ?? undefined, departmentId: n?.departmentId ?? n?.sourceDepartmentIds?.[0] }) ?? c.regions[0];
}

// ---------- корзина и заказы ----------
const MIN_ORDER = 1000;
const money = (total: number, final: number): Money => ({
  totalForItems: +total.toFixed(2), finalForItems: +final.toFixed(2), final: +final.toFixed(2), promoCode: null, discount: +(total - final).toFixed(2), deliveryPrice: 0,
});

function cartOf(c: Catalog, s: State, addressId?: string): CartResponse {
  const addr = s.addresses.find((a) => a.id === (addressId || s.active));
  const region = regionOfAddress(c, addr).name;
  const items = s.cart
    .map((it) => {
      const p = productIn(c, it.productId, region);
      if (!p) return null;
      const step = (p.info as ProductInfo & { packageInfo?: { element?: { quantity?: number } } }).packageInfo?.element?.quantity || 1;
      return {
        id: 'ci-' + it.productId,
        product: p,
        quantityOfUnits: it.quantityOfUnits,
        quantity: Math.round(it.quantityOfUnits / step),
        price: { total: +(p.price * it.quantityOfUnits).toFixed(2), final: +(p.finalPrice * it.quantityOfUnits).toFixed(2), finalPerUnit: p.finalPrice, originalPerUnit: p.price },
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  if (!items.length) return { cart: null, appMessage: null };
  const total = items.reduce((a, i) => a + i.price.total, 0);
  const final = items.reduce((a, i) => a + i.price.final, 0);
  const cart: Cart = {
    id: 'demo-cart',
    items,
    deliveryAddress: addr ? { id: addr.id, sourceDepartmentIds: addr.namedAddress.sourceDepartmentIds } : null,
    price: money(total, final),
    priceLeftover: money(total, final),
    deliveryPriceInfo: { price: 0, freeDeliveryPrice: 0, minOrderPrice: MIN_ORDER },
    status: 'pending',
    deleted: false,
  };
  const below = final < MIN_ORDER;
  return {
    cart,
    appMessage: below ? { code: 'cart', title: null, text: null, data: null, changes: [{ entityId: cart.id, entityType: 'cart', code: 'cart_price_less_min_order_price', oldValue: '', newValue: '' }] } : null,
  };
}

const day = (d: number, h: number) => {
  const x = new Date();
  x.setDate(x.getDate() + d);
  x.setHours(h, 0, 0, 0);
  return x.toISOString();
};
const slots = () => [1, 2].flatMap((d) => [10, 12, 14, 16].map((h) => ({ start: day(d, h), end: day(d, h + 2) })));
const PAYMENTS = [
  { method: 'card', startPaymentNow: true, comment: null },
  { method: 'paymentAccount', startPaymentNow: false, comment: null, notAvailableMessage: 'Доступно для юр. лиц' },
];

function draftOrder(c: Catalog, s: State): Order {
  const { cart } = cartOf(c, s);
  if (!cart) throw new ApiError(400, 'Корзина пуста');
  const addr = s.addresses.find((a) => a.id === s.active);
  const n = s.orders.length + 1;
  return {
    id: uid(s, 'o'), orderNumber: String(1000 + n), createdOn: new Date().toISOString(), status: 'draft', callAfterOrder: false, confirmedDate: null, cancelAfterDate: null,
    price: cart.price,
    paymentMethodInfo: { method: 'inPlaceAll', startPaymentNow: false, comment: null },
    paymentInfo: { paymentStatus: 'notPaid', waitingForBankConfirmation: false },
    editFlags: { edit: true, cancel: true, repeat: false, paymentMethod: true, comment: true, callAfterOrder: true },
    deliveryParts: [{
      position: 1, status: 'created',
      items: cart.items.map((i) => ({ product: { id: i.product.id, info: i.product.info }, quantityOfUnits: i.quantityOfUnits, price: i.price })),
      orderReceiver: null,
      deliveryAddress: addr ? { name: addr.namedAddress.name, address: addr.namedAddress.address, departmentId: addr.namedAddress.departmentId, regionId: addr.namedAddress.regionId } : null,
      possibleDeliveryTime: slots(), deliveryTime: null, editFlags: { deliveryTime: true, receiver: true },
    }],
  };
}

function applyOrderPatch(o: Order, b: { paymentMethod?: string; comment?: string; deliveryParts?: { position: number; deliveryTime?: unknown; orderReceiver?: unknown }[] }) {
  o.deliveryParts.forEach((part) => {
    const pp = b.deliveryParts?.find((x) => x.position === part.position);
    if (pp?.deliveryTime) part.deliveryTime = pp.deliveryTime as typeof part.deliveryTime;
    if (pp?.orderReceiver) part.orderReceiver = pp.orderReceiver as typeof part.orderReceiver;
  });
  if (b.paymentMethod) o.paymentMethodInfo = [{ method: 'inPlaceAll', startPaymentNow: false, comment: null }, ...PAYMENTS].find((x) => x.method === b.paymentMethod) ?? o.paymentMethodInfo;
  if (b.comment !== undefined) o.comment = b.comment;
}

const DEMO_ORDER_SENT = 'Демо-версия: заказ сохранён только в этом браузере и никуда не отправлен.';

// ---------- маршрутизатор ----------
export async function demoApi<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const q = opts.query ?? {};
  const b = (opts.body ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const c = await catalog();
  const s = load();
  const done = <R>(r: R) => {
    save(s);
    return r as unknown as T;
  };
  let m: RegExpMatchArray | null;

  // контент и справочники
  if (path === 'v1/contents/settings') return c.settings as T;
  if (path === 'v1/contents/faq') return c.faq as T;
  if (path === 'v1/deliveries/anonym_regions') return { regions: c.regions } as T;
  if (path === 'v1/deliveries/departments') return { departments: c.departments } as T;
  if (path === 'v1/deliveries/regions') return { regions: c.deliveryRegions ?? [] } as T;

  // каталог
  if (path === 'v1/categories') return { mode: 'tree', category: null, categories: c.tree, products: [] } as T;
  if ((m = path.match(/^v1\/categories\/([^/]+)\/products$/))) {
    const id = decodeURIComponent(m[1]);
    const hit = categoryIndex(c).get(id);
    if (!hit) throw new ApiError(404, 'Категория не найдена');
    if (hit.node.subCategories?.length) return { mode: 'tree', category: bare(hit.node), categories: hit.node.subCategories, products: [] } as T;
    const region = regionOf(c, q)?.name ?? null;
    const words = q.q ? norm(String(q.q)).split(/\s+/).filter(Boolean) : [];
    const products = (c.leaves[id] ?? []).map((pid) => productIn(c, pid, region)).filter((p): p is Product => !!p && (!words.length || matches(p.info.title, words)));
    return { mode: 'products', category: bare(hit.node), categories: [], products } as T;
  }
  if ((m = path.match(/^v1\/products\/([^/]+)$/))) {
    const id = decodeURIComponent(m[1]);
    const p = productIn(c, id, regionOf(c, q)?.name ?? null, true);
    if (!p) throw new ApiError(404, 'Товар не найден');
    const d = await detailsOf(id);
    return { product: { ...p, info: { ...p.info, description: d?.description ?? '', short: d?.short ?? '' }, properties: d?.properties ?? [], brands: d?.brands ?? p.brands ?? [], plants: d?.plants ?? p.plants ?? [] } } as T;
  }
  if (path === 'v1/search') {
    const words = norm(String(q.q ?? '')).split(/\s+/).filter(Boolean);
    const region = regionOf(c, q)?.name ?? null;
    const page = Number(q.page ?? 1);
    const size = Number(q.pageSize ?? 40);
    if (!words.length) return { categories: [], products: [] } as T;
    const cats = [...categoryIndex(c).values()]
      .filter(({ node }) => matches(node.title, words))
      .slice(0, 6)
      .map(({ node, parent }) => ({ id: node.id, kind: 'category', title: node.title, imageUrl: node.imageUrl, parentId: parent?.id ?? null, parentTitle: parent?.title ?? null }));
    const first = words[0];
    const all = Object.keys(c.products)
      .map((id) => productIn(c, id, region))
      .filter((p): p is Product => !!p && matches(p.info.title, words))
      .sort((a, z) => Number(a.outOfStock) - Number(z.outOfStock) || Number(!norm(a.info.title).startsWith(first)) - Number(!norm(z.info.title).startsWith(first)));
    return { categories: page === 1 ? cats : [], products: all.slice((page - 1) * size, page * size) } as T;
  }
  if ((m = path.match(/^v1\/(brands|plants)\/([^/]+)$/))) {
    const kind = m[1] as 'brands' | 'plants';
    const id = decodeURIComponent(m[2]);
    const region = regionOf(c, q)?.name ?? null;
    let title = '';
    const products = Object.values(c.products)
      .filter((l) => (l[kind] ?? []).some((r) => (r.id === id ? ((title = r.title), true) : false)))
      .map((l) => productIn(c, l.id, region))
      .filter((p): p is Product => !!p);
    return { mode: 'products', category: null, categories: [], products, [kind === 'brands' ? 'brand' : 'plant']: { title } } as T;
  }

  // адреса
  if (path === 'v1/users/addresses' && method === 'GET') return { addresses: s.addresses, activeAddressId: s.active, addNewDeniedMessage: null } as T;
  if (path === 'v1/users/addresses' && method === 'POST') {
    let a: UserAddress;
    if (b.departmentId) {
      const d = c.departments.find((x) => x.id === b.departmentId);
      if (!d) throw new ApiError(400, 'Пункт самовывоза не найден');
      a = { id: uid(s, 'a'), namedAddress: { name: d.title, address: d.address, departmentId: d.id, regionId: null, workingStatus: d.workingStatus ?? 'working', workingStatusMessage: null, sourceDepartmentIds: [d.id] } };
    } else {
      const k = b.courierAddress?.coordinates;
      const sg = k && suggestions.get(`${k.lat},${k.lng}`);
      const zone = k ? zoneAt(c.deliveryRegions, k.lat, k.lng) : null;
      if (c.deliveryRegions?.length && !zone) throw new ApiError(400, CLOSED);
      const region = zone ? anonForZone(c, zone) : c.regions[0];
      const address = { ...(sg?.address ?? { value: 'Адрес доставки', lat: k?.lat ?? 0, lng: k?.lng ?? 0 }), flat: b.courierAddress?.flat ?? null, entrance: b.courierAddress?.entrance ?? null, floor: b.courierAddress?.floor ?? null };
      a = { id: uid(s, 'a'), namedAddress: { name: null, address, departmentId: null, regionId: zone?.id ?? region.regionId, workingStatus: 'working', workingStatusMessage: null, sourceDepartmentIds: region.sourceDepartmentIds } };
    }
    s.addresses.push(a);
    s.active = a.id;
    return done(a);
  }
  if (path === 'v1/users/addresses/setActive') {
    if (s.addresses.some((a) => a.id === b.addressId)) s.active = b.addressId;
    return done({});
  }
  if (path === 'v1/users/addresses/search') return { addresses: await searchAddresses(c, String(b.text ?? '').trim()) } as T;
  if (path === 'v1/users/addresses/coordinateInfo') return { address: await addressAt(c, Number(b.lat), Number(b.lng)) } as T;
  if ((m = path.match(/^v1\/users\/addresses\/([^/]+)$/))) {
    const id = decodeURIComponent(m[1]);
    const a = s.addresses.find((x) => x.id === id);
    if (method === 'DELETE') {
      s.addresses = s.addresses.filter((x) => x.id !== id);
      if (s.active === id) s.active = s.addresses[0]?.id ?? null;
      return done({});
    }
    if (a) Object.assign(a.namedAddress.address, { flat: b.flat ?? a.namedAddress.address.flat, entrance: b.entrance ?? a.namedAddress.address.entrance, floor: b.floor ?? a.namedAddress.address.floor });
    return done(a);
  }

  // корзина
  if (path === 'v1/cart' && method === 'GET') return cartOf(c, s, q.addressId ? String(q.addressId) : undefined) as T;
  if (path === 'v1/cart' && method === 'POST') {
    for (const it of (b.items ?? []) as { productId: string; quantityOfUnits: number }[]) {
      s.cart = s.cart.filter((x) => x.productId !== it.productId);
      if (it.quantityOfUnits > 0) s.cart.push({ productId: it.productId, quantityOfUnits: it.quantityOfUnits });
    }
    if (b.promoCode) {
      save(s);
      throw new ApiError(400, 'В демо-версии промокоды не применяются');
    }
    return done(cartOf(c, s, b.userAddressId));
  }
  if (path === 'v1/cart' && method === 'DELETE') {
    s.cart = [];
    return done({});
  }

  // вход (без SMS)
  if (path === 'v1/auth/requestSmsCode') return { verificationId: 'demo', codeLength: 4, secondsToResend: 30 } as T;
  if (path === 'v1/auth/loginWithSms') {
    s.authorized = true;
    return done({ clientId: 'demo', profileId: 'demo-person', profileKind: 'shopPerson', accessToken: 'demo-auth', isNew: false });
  }
  if (path === 'v1/auth/logout' || path === 'v1/auth/delete') {
    s.authorized = false;
    return done({});
  }
  if (path === 'v1/profiles/shopProfiles')
    return { activeProfileId: 'demo-person', suggestions: [], profiles: [{ id: 'demo-person', kind: 'shopPerson', name: 'Покупатель (демо)', phone: null, email: null, company: null }] } as T;
  if (path === 'v1/profiles' || path === 'v1/profiles/company' || path === 'v1/orders/receiver') return {} as T;
  if (path === 'v1/companies/find') return { companies: [] } as T;
  if (path === 'v1/wishes') return { products: [] } as T;

  // оформление и заказы — только в браузере
  if (path === 'v1/cart/checkout' && method === 'POST') {
    s.draft = draftOrder(c, s);
    const { cart } = cartOf(c, s);
    return done({ cart, order: s.draft, additionalPaymentMethods: PAYMENTS, appMessage: null, leftoversItems: null, splitSuggestion: null });
  }
  if (path === 'v1/cart/checkout' && method === 'DELETE') {
    s.draft = null;
    return done({});
  }
  if (path === 'v1/orders/checkout') {
    if (!s.draft) throw new ApiError(400, 'Нет оформляемого заказа');
    applyOrderPatch(s.draft, b);
    return done({ order: s.draft, checkoutId: 'demo-checkout', additionalPaymentMethods: PAYMENTS });
  }
  if (path === 'v1/orders/confirmationCode') return { code: '0000', validTo: day(1, 12) } as T;
  if (path === 'v1/orders') return { orders: s.orders.filter((o) => !['canceled', 'completed'].includes(String(o.status))) } as T;
  if (path === 'v1/orders/history' || path === 'v1/orders/latest') return { orders: [...s.orders].reverse() } as T;
  if ((m = path.match(/^v1\/orders\/([^/]+)(?:\/(confirm|cancel|paymentForm|paymentCompleted|receipts))?$/))) {
    const id = decodeURIComponent(m[1]);
    const action = m[2];
    let o = s.orders.find((x) => x.id === id) ?? (s.draft?.id === id ? s.draft : null);
    if (!o) throw new ApiError(404, 'Заказ не найден');
    if (action === 'confirm') {
      applyOrderPatch(o, b);
      o = { ...o, status: 'confirmed', confirmedDate: new Date().toISOString(), comment: [o.comment, DEMO_ORDER_SENT].filter(Boolean).join('\n') };
      o.deliveryParts = o.deliveryParts.map((x) => ({ ...x, status: 'confirmed' }));
      s.orders.push(o);
      s.draft = null;
      s.cart = [];
      return done({ order: o });
    }
    if (action === 'cancel') {
      o.status = 'canceled';
      o.editFlags = o.editFlags ? { ...o.editFlags, cancel: false } : o.editFlags;
      return done({ order: o });
    }
    if (action === 'paymentForm') return done({ paymentForm: { paymentId: 'demo-pay', formUrl: `${location.origin}${asset('/paymentCompleted')}?orderId=${encodeURIComponent(id)}&paymentId=demo-pay`, returnUrl: '', failUrl: '' }, fullyPaid: false, qrCode: null });
    if (action === 'paymentCompleted') {
      o.paymentInfo = { paymentStatus: 'fullyPaid', waitingForBankConfirmation: false };
      return done({});
    }
    if (action === 'receipts') return { receipts: [] } as T;
    if (method === 'POST') applyOrderPatch(o, b);
    return done({ order: o });
  }

  throw new ApiError(404, 'В демо-версии это действие недоступно');
}
