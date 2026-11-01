import type { Order, PaymentMethodInfo } from '../api/types';

// Подписи — из строк старого приложения.
export const ORDER_STATUS: Record<string, { label: string; tone: 'ok' | 'warn' | 'off' | '' }> = {
  draft: { label: 'Создан', tone: '' },
  reserved: { label: 'Ожидает подтверждения', tone: 'warn' },
  waitingForPayment: { label: 'Ожидает оплаты', tone: 'warn' },
  confirmed: { label: 'Принято в работу', tone: 'ok' },
  completed: { label: 'Выполнен', tone: 'ok' },
  canceled: { label: 'Отменён', tone: 'off' },
  unknown: { label: 'Неизвестно', tone: '' },
};

export const PART_STATUS: Record<string, string> = {
  created: 'Создан',
  waitingPayment: 'Ожидает оплаты',
  confirmed: 'Принято в работу',
  assemblyStarted: 'Собирается',
  assemblyFinished: 'Собран',
  shipmentStarted: 'Готовиться к отправке',
  onTheRoad: 'В пути',
  shipmentFinished: 'Приёмка в пункте выдачи',
  inDestination: 'Готов к выдаче',
  received: 'Получено',
  canceled: 'Отменено',
  unknown: 'Неизвестно',
};

export const PAYMENT_STATUS: Record<string, string> = {
  notPaid: 'Не оплачено',
  fullyPaid: 'Оплачено',
  partlyPaid: 'Частично оплачено',
  unknown: 'Неизвестно',
};

export const PAYMENT_METHOD: Record<string, string> = {
  card: 'Картой онлайн',
  inPlaceCard: 'При получении: картой',
  inPlaceCash: 'При получении: наличными',
  inPlaceAll: 'Наличные или карта',
  paymentAccount: 'Оплата на расчетный счет',
  postPayment: 'Пост-оплата',
  none: 'Не указано',
};

export const methodLabel = (m: PaymentMethodInfo | null | undefined) => (m ? PAYMENT_METHOD[m.method] ?? String(m.method) : 'Не указано');
export const statusOf = (o: Order) => ORDER_STATUS[o.status] ?? { label: String(o.status), tone: '' as const };

export function orderItemsCount(o: Order) {
  return o.deliveryParts.reduce((s, p) => s + p.items.length, 0);
}

export const isActiveOrder = (o: Order) => !['completed', 'canceled'].includes(o.status);

export function timeLeft(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}
