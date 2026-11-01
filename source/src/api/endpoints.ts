import { api } from './client';
import type {
  AddressesResponse, AddressSuggestion, AnonRegion, CartResponse, CategoryResponse, CheckoutResponse, Company,
  DeliveryRegion, Department, FaqResponse, Order, OrderCheckoutResponse, PaymentFormResponse, Product, Receipt, SearchResponse,
  Settings, ShopProfilesResponse, TimeSlot, UserAddress, OrderReceiver,
} from './types';

type CatalogParams = { regionId?: string; departmentId?: string };

// ---- Контент ----
export const getSettings = () => api<Settings>('GET', 'v1/contents/settings');
export const getFaq = () => api<FaqResponse>('GET', 'v1/contents/faq');
export const getAnonRegions = () => api<{ regions: AnonRegion[] }>('GET', 'v1/deliveries/anonym_regions').then((r) => r.regions);

// ---- Каталог ----
export const getCategories = (p: CatalogParams) => api<CategoryResponse>('GET', 'v1/categories', { query: p });
export const getCategoryProducts = (id: string, p: CatalogParams, q?: string) =>
  api<CategoryResponse>('GET', `v1/categories/${encodeURIComponent(id)}/products`, { query: { q, ...p } });
export const getProduct = (id: string, p: CatalogParams) =>
  api<{ product: Product }>('GET', `v1/products/${encodeURIComponent(id)}`, { query: p }).then((r) => r.product);
export const search = (q: string, p: CatalogParams, page = 1, pageSize = 40, signal?: AbortSignal) =>
  api<SearchResponse>('GET', 'v1/search', { query: { page, pageSize, q, ...p }, signal });
export const getBrand = (id: string, p: CatalogParams) => api<CategoryResponse & { brand?: { title: string } }>('GET', `v1/brands/${encodeURIComponent(id)}`, { query: p });
export const getPlant = (id: string, p: CatalogParams) => api<CategoryResponse & { plant?: { title: string } }>('GET', `v1/plants/${encodeURIComponent(id)}`, { query: p });

// ---- Адреса и доставка ----
export const getDeliveryRegions = () => api<{ regions: DeliveryRegion[] }>('GET', 'v1/deliveries/regions').then((r) => r.regions ?? []);
export const getDepartments = () => api<{ departments: Department[] }>('GET', 'v1/deliveries/departments').then((r) => r.departments);
export const getAddresses = () => api<AddressesResponse>('GET', 'v1/users/addresses');
export const addPickupAddress = (departmentId: string) => api<UserAddress>('POST', 'v1/users/addresses', { body: { departmentId } });
export const addCourierAddress = (c: { lat: number; lng: number; flat?: string; entrance?: string; floor?: string }) =>
  api<UserAddress>('POST', 'v1/users/addresses', {
    body: { courierAddress: { coordinates: { lat: c.lat, lng: c.lng }, flat: c.flat || undefined, entrance: c.entrance || undefined, floor: c.floor || undefined } },
  });
export const patchAddress = (id: string, b: { flat?: string; entrance?: string; floor?: string }) =>
  api<UserAddress>('PATCH', `v1/users/addresses/${encodeURIComponent(id)}`, { body: b });
export const deleteAddress = (id: string) => api<unknown>('DELETE', `v1/users/addresses/${encodeURIComponent(id)}`);
export const setActiveAddress = (addressId: string) => api<unknown>('POST', 'v1/users/addresses/setActive', { body: { addressId } });
export const searchAddress = (text: string) =>
  api<{ addresses: AddressSuggestion[] }>('POST', 'v1/users/addresses/search', { body: { text } }).then((r) => r.addresses ?? []);
export const addressByCoordinates = (lat: number, lng: number) =>
  api<{ address: AddressSuggestion }>('POST', 'v1/users/addresses/coordinateInfo', { body: { lng, lat } });

// ---- Корзина ----
export const getCart = (addressId: string) => api<CartResponse>('GET', 'v1/cart', { query: { addressId } });
export const updateCart = (b: { userAddressId: string; items?: { productId: string; quantityOfUnits: number }[]; promoCode?: string; promoCodeToRemove?: string }) =>
  api<CartResponse>('POST', 'v1/cart', { body: b });
export const clearCart = () => api<unknown>('DELETE', 'v1/cart');

// ---- Оформление и заказы ----
export const cartCheckout = (b: { earlyDelivery?: boolean; suggestSplit: boolean; shouldMakeAsOneOrder: boolean }) =>
  api<CheckoutResponse>('POST', 'v1/cart/checkout', { body: b });
export const cancelCartCheckout = () => api<unknown>('DELETE', 'v1/cart/checkout');
export interface DeliveryPartPatch { position: number; orderReceiver?: OrderReceiver; deliveryTime?: TimeSlot }
export const orderCheckout = (b: { orderId: string; comment?: string; paymentMethod?: string; deliveryParts?: DeliveryPartPatch[] }) =>
  api<OrderCheckoutResponse>('PATCH', 'v1/orders/checkout', { body: b });
export const updateOrder = (id: string, b: { paymentMethod?: string; comment?: string; deliveryParts?: DeliveryPartPatch[] }) =>
  api<{ order: Order }>('POST', `v1/orders/${encodeURIComponent(id)}`, { body: b });
export const confirmOrder = (id: string, b: { paymentMethod: string; comment?: string }) =>
  api<{ order: Order }>('POST', `v1/orders/${encodeURIComponent(id)}/confirm`, { body: b });
export const cancelOrder = (id: string) => api<{ order: Order }>('POST', `v1/orders/${encodeURIComponent(id)}/cancel`);
export const paymentForm = (id: string) => api<PaymentFormResponse>('POST', `v1/orders/${encodeURIComponent(id)}/paymentForm`);
export const paymentCompleted = (id: string, paymentId: string) =>
  api<unknown>('POST', `v1/orders/${encodeURIComponent(id)}/paymentCompleted`, { body: { paymentId } });
export const getActiveOrders = () => api<{ orders: Order[] }>('GET', 'v1/orders');
export const getOrdersHistory = (page: number, pageSize = 20, all = true) =>
  api<{ orders: Order[] }>('GET', 'v1/orders/history', { query: { page, pageSize, all } });
export const getLatestOrders = () => api<{ orders: Order[] }>('GET', 'v1/orders/latest');
export const getOrder = (id: string) => api<{ order: Order }>('GET', `v1/orders/${encodeURIComponent(id)}`, { query: { checkPayment: true } });
export const getReceipts = (id: string) => api<{ receipts: Receipt[] }>('GET', `v1/orders/${encodeURIComponent(id)}/receipts`);
export const getConfirmationCode = () => api<{ code: string; validTo: string | null }>('GET', 'v1/orders/confirmationCode');
export const addOrderReceiver = (orderReceiver: OrderReceiver) => api<unknown>('POST', 'v1/orders/receiver', { body: { orderReceiver } });
export const deleteOrderReceiver = (phone: string) => api<unknown>('DELETE', 'v1/orders/receiver', { body: { phone } });

// ---- Авторизация и профиль ----
export const requestSmsCode = (phone: string) =>
  api<{ verificationId: string; codeLength: number; secondsToResend: number }>('POST', 'v1/auth/requestSmsCode', { body: { appType: 'shop', phone } });
export const loginWithSms = (b: { verificationId: string; code: string; acceptPromotionalMailings: boolean }) =>
  api<{ clientId: string; profileId: string; profileKind: string; accessToken: string; isNew: boolean }>('POST', 'v1/auth/loginWithSms', {
    body: { appType: 'shop', ...b },
  });
export const logout = () => api<unknown>('GET', 'v1/auth/logout');
export const deleteAccount = () => api<unknown>('GET', 'v1/auth/delete');
export const updateProfile = (b: { name?: string; email?: string }) => api<unknown>('PATCH', 'v1/profiles', { body: b });
export const getShopProfiles = () => api<ShopProfilesResponse>('GET', 'v1/profiles/shopProfiles');
export const switchShopProfile = (profileId: string) =>
  api<{ profile?: unknown; activeProfileId?: string; accessToken?: string }>('POST', 'v1/profiles/switchShopProfile', { body: { profileId } });
export const addCompany = (b: { inn: string; kpp?: string; userAddressId?: string }) => api<unknown>('POST', 'v1/profiles/company', { body: b });
export const findCompanies = (query: string) => api<{ companies?: Company[] } | Company[]>('POST', 'v1/companies/find', { body: { query } });
export const getWishes = () => api<{ products?: { profileId: string; productId: string; subscribed: boolean }[] }>('GET', 'v1/wishes');
export const setWishes = (products: { productId: string; subscribed: boolean }[]) => api<unknown>('POST', 'v1/wishes', { body: { products } });
