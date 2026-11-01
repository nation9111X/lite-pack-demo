// Типы ответов API lite-pack.ru (сняты с живых ответов и из старого приложения).

export type ProfileKind = 'anonym' | 'shopPerson' | 'shopCompany' | 'driver' | 'admin' | 'unknown';
export type WorkingStatus = 'working' | 'closed' | 'building' | 'unknown';

export interface Session {
  accessToken: string;
  clientId: string | null;
  profileId: string;
  profileKind: ProfileKind;
}

export interface UnitValue {
  unit: string | null;
  value: number;
  quantity: number;
}

export interface PackageInfo {
  element: UnitValue | null;
  volume: UnitValue | null;
  weight: UnitValue | null;
  unit: string | null;
  description: string | null;
}

export interface ProductInfo {
  title: string;
  description: string;
  short: string;
  imageUrls: string[];
  order: number;
  packageInfo: PackageInfo | null;
}

export interface Discount {
  amount: number;
  kind: 'simple' | 'wholeSale' | 'agreement' | 'promotion' | 'unknown';
  isPercent: boolean;
  minQuantity: number | null;
  maxQuantity: number | null;
}

export interface Property {
  title: string;
  data: string;
  sortOrder: number;
}

export interface Ref {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
}

export interface Product {
  id: string;
  info: ProductInfo;
  quantityOfUnitsLeft: number;
  quantityLeft?: number;
  price: number;
  finalPrice: number;
  discounts: Discount[];
  outOfStock: boolean;
  chestnyZnak: unknown | null;
  chestnyZnakCategory: string | null;
  properties?: Property[];
  plants?: Ref[];
  brands?: Ref[];
}

export interface Category {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  order: number;
  subCategories: Category[];
  products: Product[];
  hasSubcategories: boolean;
}

export interface CategoryResponse {
  mode: 'tree' | 'products';
  category: Category | null;
  categories: Category[];
  products: Product[];
}

export interface SearchCategory {
  id: string;
  kind: 'category' | 'brand' | 'plant' | 'unknown';
  title: string;
  imageUrl: string | null;
  parentId: string | null;
  parentTitle: string | null;
}

export interface SearchResponse {
  categories: SearchCategory[];
  products: Product[];
}

export interface AnonRegion {
  name: string;
  regionId: string;
  sourceDepartmentIds: string[];
}

/** Зона доставки (v1/deliveries/regions): контуры, внутри которых работает курьерская доставка. */
export interface DeliveryRegion {
  id: string;
  title: string;
  description: string | null;
  workingStatus: WorkingStatus;
  workingStatusMessage: string | null;
  positivePolygon: { coordinates: { lat: number; lng: number }[] }[];
  negativePolygon: { coordinates: { lat: number; lng: number }[] }[];
}

export interface Address {
  postalCode?: string | null;
  region?: string | null;
  locality?: string | null;
  city?: string | null;
  street?: string | null;
  house?: string | null;
  flat?: string | null;
  entrance?: string | null;
  floor?: string | null;
  lat: number;
  lng: number;
  value: string;
  [k: string]: unknown;
}

export interface WorkingDay {
  enabled: boolean;
  open: number;
  close: number;
}

export interface Department {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  address: Address;
  phone: string;
  workingStatus: WorkingStatus;
  workingStatusMessage: string | null;
  workingTimes: Partial<Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', WorkingDay>> | null;
}

/** Именованный адрес: самовывоз (departmentId) или доставка (regionId зоны). */
export interface NamedAddress {
  name: string | null;
  address: Address;
  departmentId: string | null;
  regionId: string | null;
  workingStatus: WorkingStatus;
  workingStatusMessage: string | null;
  sourceDepartmentIds: string[];
}

export interface UserAddress {
  id: string;
  namedAddress: NamedAddress;
}

export interface AddressesResponse {
  addresses: UserAddress[];
  activeAddressId: string | null;
  addNewDeniedMessage: string | null;
}

export interface AddressSuggestion {
  address: Address;
  departmentId: string | null;
  regionId: string | null;
  workingStatus: WorkingStatus;
  workingStatusMessage: string | null;
}

export interface Money {
  totalForItems: number;
  finalForItems: number;
  final: number;
  promoCode: string | null;
  discount: number;
  deliveryPrice: number | null;
}

export interface CartItem {
  id: string;
  product: Product;
  quantityOfUnits: number;
  quantity: number;
  price: { total: number; final: number; finalPerUnit: number; originalPerUnit: number };
}

export interface Cart {
  id: string;
  items: CartItem[];
  deliveryAddress: { id: string; sourceDepartmentIds: string[] } | null;
  price: Money;
  priceLeftover: Money | null;
  deliveryPriceInfo: { price: number; freeDeliveryPrice: number; minOrderPrice: number } | null;
  status: 'unknown' | 'pending' | 'checkout' | 'confirmed' | 'canceled';
  deleted: boolean;
}

export interface AppMessage {
  code?: string | null;
  title?: string | null;
  text?: string | null;
  changes?: unknown;
  data?: unknown;
}

export interface CartResponse {
  cart: Cart | null;
  appMessage: AppMessage | null;
}

// ---- Заказы ----

export type PaymentMethodKind =
  | 'none' | 'card' | 'inPlaceCard' | 'inPlaceCash' | 'inPlaceAll' | 'paymentAccount' | 'postPayment' | string;

export interface PaymentMethodInfo {
  method: PaymentMethodKind;
  startPaymentNow: boolean;
  comment: string | null;
  notAvailableMessage?: string | null;
  messageCode?: string | null;
}

export interface TimeSlot {
  start: string;
  end: string;
}

export interface OrderItem {
  product: { id: string; info: ProductInfo };
  quantityOfUnits: number;
  price: { total: number; final: number; finalPerUnit: number; originalPerUnit: number };
  adjustment?: { sumDelta: number; quantityDelta: number } | null;
}

export interface OrderReceiver {
  name?: string | null;
  phone?: string | null;
  [k: string]: unknown;
}

export interface DeliveryPart {
  position: number;
  status: string;
  items: OrderItem[];
  orderReceiver: OrderReceiver | null;
  deliveryAddress: { name: string | null; address: Address; departmentId: string | null; regionId: string | null } | null;
  possibleDeliveryTime: TimeSlot[];
  deliveryTime: TimeSlot | null;
  editFlags: { deliveryTime: boolean; receiver: boolean } | null;
}

export interface Order {
  id: string;
  orderNumber: string | number;
  price: Money;
  createdOn: string;
  callAfterOrder: boolean | null;
  status: 'unknown' | 'draft' | 'reserved' | 'waitingForPayment' | 'confirmed' | 'completed' | 'canceled' | string;
  deliveryParts: DeliveryPart[];
  confirmedDate: string | null;
  paymentMethodInfo: PaymentMethodInfo | null;
  cancelAfterDate: string | null;
  editFlags: {
    edit: boolean; cancel: boolean; repeat: boolean; paymentMethod: boolean; comment: boolean; callAfterOrder: boolean;
  } | null;
  paymentInfo: { paymentStatus: 'unknown' | 'notPaid' | 'fullyPaid' | 'partlyPaid' | string; waitingForBankConfirmation: boolean } | null;
  comment?: string | null;
}

export interface CheckoutResponse {
  cart: Cart;
  order: Order | null;
  appMessage: AppMessage | null;
  additionalPaymentMethods: PaymentMethodInfo[] | null;
  leftoversItems: { productId: string; quantity: number }[] | null;
  splitSuggestion: {
    firstPart: { position: number; productQuantities: { productId: string; quantity: number }[]; deliveryTime: TimeSlot };
    secondPart: { position: number; productQuantities: { productId: string; quantity: number }[]; deliveryTime: TimeSlot };
  } | null;
}

export interface OrderCheckoutResponse {
  order: Order;
  checkoutId: string;
  additionalPaymentMethods: PaymentMethodInfo[] | null;
}

export interface PaymentFormResponse {
  paymentForm: { paymentId: string; formUrl: string; returnUrl: string; failUrl: string } | null;
  fullyPaid: boolean;
  qrCode: string | null;
}

export interface Receipt {
  link: string;
  date: string;
  kindTitle: string;
  kind: string;
}

// ---- Профиль ----

export interface Company {
  id?: string;
  inn: string;
  ogrn?: string | null;
  kpp?: string | null;
  shortName?: string | null;
  fullName?: string | null;
  fullAddress?: string | null;
}

export interface ShopProfile {
  id: string;
  kind: ProfileKind;
  name: string | null;
  phone: string | null;
  email: string | null;
  company: Company | null;
}

export interface ShopProfilesResponse {
  profiles: ShopProfile[];
  suggestions: Company[] | null;
  activeProfileId: string | null;
}

export interface Settings {
  companyDetails: {
    name: string;
    inn: string;
    kpp: string;
    ogrn: string;
    legalAddress: { text: string };
    actualAddress: { text: string };
    phone: string;
  };
  contactUs: {
    address: { text: string; lat: number; lng: number };
    phone: string;
    email: string;
    vk_0?: string;
    telegram?: string;
    whatsup?: string;
  };
  iosapp: string;
  androidapp: string;
  privacy: string;
  eula: string;
}

export interface FaqResponse {
  items: { title: string; text: string }[];
}
