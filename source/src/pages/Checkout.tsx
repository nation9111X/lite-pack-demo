import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import * as api from '../api/endpoints';
import { errorText } from '../api/client';
import type { CheckoutResponse, DeliveryPart, Order, PaymentMethodInfo, TimeSlot } from '../api/types';
import { useStore } from '../lib/store';
import { isAuthorized, sessionStore } from '../store/session';
import { cartStore, loadCart } from '../store/cart';
import { toast } from '../store/ui';
import { Icon } from '../components/Icon';
import { EmptyBox } from '../components/EmptyBox';
import { dayLabel, money, n, time } from '../lib/format';
import { imgUrl } from '../lib/img';
import { methodLabel } from '../lib/orders';
import { ecPurchase, goal } from '../lib/metrika';
import { invalidate } from '../lib/query';
import { useSeo } from '../lib/seo';
import { startPayment } from './Order';
import './account.css';
import './checkout.css';

let pendingCancel: number | undefined;

type PartState = { slot: TimeSlot | null; receiverName: string; receiverPhone: string; other: boolean };

function SlotPicker({ part, value, onChange }: { part: DeliveryPart; value: TimeSlot | null; onChange: (s: TimeSlot) => void }) {
  const days = useMemo(() => {
    const m = new Map<string, TimeSlot[]>();
    for (const s of part.possibleDeliveryTime ?? []) {
      const k = new Date(s.start).toDateString();
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return [...m.values()];
  }, [part.possibleDeliveryTime]);
  const [day, setDay] = useState(0);
  if (!days.length) return part.deliveryTime ? <p className="mono">{dayLabel(part.deliveryTime.start)}, {time(part.deliveryTime.start)}–{time(part.deliveryTime.end)}</p> : null;
  return (
    <div className="slots">
      <div className="chips" role="tablist" aria-label="Дата доставки">
        {days.map((d, i) => (
          <button key={i} type="button" role="tab" aria-selected={day === i} className={`chip${day === i ? ' is-on' : ''}`} onClick={() => setDay(i)}>
            {dayLabel(d[0].start)}
          </button>
        ))}
      </div>
      <div className="slots__grid" role="radiogroup" aria-label="Время доставки">
        {days[day]?.map((s) => {
          const on = value?.start === s.start && value?.end === s.end;
          return (
            <button key={s.start} type="button" role="radio" aria-checked={on} className={`slot${on ? ' is-on' : ''}`} onClick={() => onChange(s)}>
              {time(s.start)}–{time(s.end)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function methodsOf(order: Order | null, extra: PaymentMethodInfo[] | null): PaymentMethodInfo[] {
  const all = [...(order?.paymentMethodInfo ? [order.paymentMethodInfo] : []), ...(extra ?? [])];
  const seen = new Set<string>();
  return all.filter((m) => m.method !== 'none' && !seen.has(m.method) && seen.add(m.method));
}

export default function CheckoutPage() {
  const s = useStore(sessionStore, (x) => x);
  const cart = useStore(cartStore, (x) => x.cart);
  const nav = useNavigate();
  const [res, setRes] = useState<CheckoutResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [parts, setParts] = useState<Record<number, PartState>>({});
  const [method, setMethod] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [done, setDone] = useState<Order | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const confirmed = useRef(false);
  const started = useRef(false);
  useSeo({ title: 'Оформление заказа', noindex: true });

  const start = async (body: { earlyDelivery?: boolean; suggestSplit: boolean; shouldMakeAsOneOrder: boolean }) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.cartCheckout(body);
      setRes(r);
      if (r.order) {
        goal('begin_checkout', { order_id: r.order.id, order_price: r.order.price.final, currency: 'RUB' });
        const init: Record<number, PartState> = {};
        r.order.deliveryParts.forEach((p) => {
          init[p.position] = { slot: p.deliveryTime ?? null, receiverName: p.orderReceiver?.name ?? '', receiverPhone: p.orderReceiver?.phone ?? '', other: false };
        });
        setParts(init);
        const ms = methodsOf(r.order, r.additionalPaymentMethods);
        setMethod(r.order.paymentMethodInfo?.method && r.order.paymentMethodInfo.method !== 'none' ? r.order.paymentMethodInfo.method : ms.find((m) => !m.notAvailableMessage)?.method ?? null);
      }
    } catch (e) {
      setErr(errorText(e) || 'Ошибка при оформлении заказа (возможно, часть товара закончилась). Попробуйте снова.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!isAuthorized(sessionStore.get())) return;
    window.clearTimeout(pendingCancel);
    if (!started.current) {
      started.current = true;
      start({ suggestSplit: true, shouldMakeAsOneOrder: false });
    }
    return () => {
      // Ушли со страницы, не подтвердив — возвращаем корзину в обычный режим (с задержкой: StrictMode перемонтирует).
      pendingCancel = window.setTimeout(() => {
        if (!confirmed.current) api.cancelCartCheckout().catch(() => {}).finally(() => loadCart());
      }, 400);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isAuthorized(s)) return <Navigate to="/cart" replace />;

  if (done)
    return (
      <div className="container page">
        <div className="empty done">
          <span className="done__check"><Icon name="check" size={44} strokeWidth={2.4} /></span>
          <h1 className="page__title">Спасибо за заказ</h1>
          <p>Заказ оформлен. Ваш заказ №{done.orderNumber}</p>
          {qr && (
            <div className="notice notice--info">
              <Icon name="qr" />
              <div>
                <p>Оплату по QR коду производить от юр.лица (через бизнес-приложение банка)! Оплата от физического лица засчитана не будет!</p>
                {/^https?:|^data:image/.test(qr) ? <img alt="QR-код для оплаты" width={220} height={220} src={qr} /> : <p className="mono">{qr}</p>}
              </div>
            </div>
          )}
          <div className="done__actions">
            <Link to={`/order/${done.id}`} className="btn btn--lg">Детали заказа</Link>
            <Link to="/" className="btn btn--lg btn--ghost">Перейти в каталог</Link>
          </div>
        </div>
      </div>
    );

  const order = res?.order ?? null;
  const methods = methodsOf(order, res?.additionalPaymentMethods ?? null);
  const chosen = methods.find((m) => m.method === method) ?? null;
  const leftovers = res?.leftoversItems ?? [];
  const nameOf = (id: string) => res?.cart.items.find((i) => i.product.id === id)?.product.info.title ?? cart?.items.find((i) => i.product.id === id)?.product.info.title ?? id;

  const submit = async () => {
    if (!order || !method) return;
    setBusy(true);
    setErr(null);
    try {
      const deliveryParts = order.deliveryParts.map((p) => {
        const st = parts[p.position];
        return {
          position: p.position,
          ...(st?.slot ? { deliveryTime: st.slot } : {}),
          ...(st?.other && st.receiverName && st.receiverPhone ? { orderReceiver: { name: st.receiverName, phone: st.receiverPhone } } : {}),
        };
      });
      const patched = await api.orderCheckout({ orderId: order.id, comment: comment || undefined, paymentMethod: method, deliveryParts });
      const r = await api.confirmOrder(patched.order?.id ?? order.id, { paymentMethod: method, comment: comment || undefined });
      confirmed.current = true;
      const final = r.order ?? patched.order ?? order;
      ecPurchase(
        final.id,
        final.price.final,
        final.deliveryParts.flatMap((p) => p.items).map((i) => ({ product: { id: i.product.id, info: i.product.info, finalPrice: i.price.finalPerUnit } as never, qty: i.quantityOfUnits })),
        final.price.promoCode,
      );
      invalidate('orders:');
      await loadCart();
      if (chosen?.startPaymentNow) {
        const pay = await startPayment(final.id);
        if (pay === 'redirect') return;
        if (pay !== 'paid' && pay !== 'none') setQr(pay);
      }
      setDone(final);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setErr(errorText(e) || 'Ошибка при оформлении заказа (возможно, часть товара закончилась). Попробуйте снова.');
      toast('Ошибка при оформлении заказа', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page checkout">
      <Link to="/cart" className="back-link"><Icon name="arrowLeft" size={18} /> Вернуться в корзину</Link>
      <header className="page__head">
        <h1 className="page__title">Оформление заказа</h1>
      </header>

      {busy && !res && <div className="cart-state"><span className="spinner" /></div>}
      {err && (
        <div className="notice notice--error" role="alert">
          <Icon name="alert" />
          <div>
            <p>{err}</p>
            {!res && <button type="button" className="link" onClick={() => start({ suggestSplit: true, shouldMakeAsOneOrder: false })}>Повторить</button>}
          </div>
        </div>
      )}
      {res?.appMessage && (res.appMessage.title || res.appMessage.text) && (
        <div className="notice notice--warn"><Icon name="info" /><div>{res.appMessage.title && <b>{res.appMessage.title}</b>}<p>{res.appMessage.text}</p></div></div>
      )}
      {leftovers.length > 0 && (
        <div className="notice notice--warn">
          <Icon name="alert" />
          <div>
            <p>Следующие товары есть не в полном количестве:</p>
            <ul>{leftovers.map((l) => <li key={l.productId}>{nameOf(l.productId)} — {n(l.quantity)}</li>)}</ul>
          </div>
        </div>
      )}
      {res?.splitSuggestion && (
        <section className="panel split-offer">
          <h2 className="account__h">Получение заказа</h2>
          <p>Часть товаров из заказа вы можете получить сегодня в ближайшее время.</p>
          <div className="split-offer__acts">
            <button type="button" className="btn" disabled={busy} onClick={() => start({ earlyDelivery: true, suggestSplit: false, shouldMakeAsOneOrder: false })}>Забрать часть сегодня</button>
            <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => start({ suggestSplit: false, shouldMakeAsOneOrder: true })}>Нет, заберу все вместе</button>
          </div>
        </section>
      )}

      {res && !order && !res.splitSuggestion && !err && (
        <div className="empty">
          <EmptyBox className="empty__art" />
          <h2>Корзина изменилась</h2>
          <p>Количество товаров или общая стоиомость корзины изменилась.</p>
          <button type="button" className="btn" onClick={() => nav('/cart')}>Вернуться в корзину</button>
        </div>
      )}

      {order && (
        <div className="split">
          <div className="checkout__main">
            {order.deliveryParts.map((p) => {
              const st = parts[p.position] ?? { slot: null, receiverName: '', receiverPhone: '', other: false };
              const set = (patch: Partial<PartState>) => setParts((x) => ({ ...x, [p.position]: { ...st, ...patch } }));
              return (
                <section key={p.position} className="panel opart">
                  <div className="opart__head">
                    <h2>{order.deliveryParts.length > 1 ? `${p.position} часть заказа` : 'Получение заказа'}</h2>
                    <span className="mono muted">{p.items.length} поз.</span>
                  </div>
                  {p.deliveryAddress && (
                    <p className="opart__row">
                      <Icon name={p.deliveryAddress.departmentId ? 'store' : 'truck'} size={20} />
                      <span>
                        <span className="label">{p.deliveryAddress.departmentId ? 'Адрес самовывоза' : 'Адрес доставки'}</span>
                        {p.deliveryAddress.name ? `${p.deliveryAddress.name}, ` : ''}{p.deliveryAddress.address?.value}
                      </span>
                    </p>
                  )}
                  <div className="ostrip" aria-label="Товары">
                    {p.items.map((i) => (
                      <span key={i.product.id} className="ostrip__item" title={`${i.product.info.title} — ${n(i.quantityOfUnits)} шт`}>
                        {i.product.info.imageUrls[0] && <img loading="lazy" alt={i.product.info.title} width={52} height={52} src={imgUrl(i.product.info.imageUrls[0], 80)} />}
                        <span className="ostrip__qty mono">{n(i.quantityOfUnits)}</span>
                      </span>
                    ))}
                  </div>
                  {(p.possibleDeliveryTime?.length > 0 || p.deliveryTime) && (
                    <div className="checkout__block">
                      <h3 className="checkout__h">{p.deliveryAddress?.departmentId ? 'Выберите дату и время получения заказа' : 'Когда доставить заказ?'}</h3>
                      <SlotPicker part={p} value={st.slot} onChange={(slot) => set({ slot })} />
                    </div>
                  )}
                  <div className="checkout__block">
                    <h3 className="checkout__h">Получатель</h3>
                    <div className="seg seg--inline" role="radiogroup" aria-label="Получатель" style={{ ['--i' as string]: st.other ? 1 : 0 }}>
                      <button type="button" role="radio" aria-checked={!st.other} className={`seg__btn${!st.other ? ' is-on' : ''}`} onClick={() => set({ other: false })}>Получу сам</button>
                      <button type="button" role="radio" aria-checked={st.other} className={`seg__btn${st.other ? ' is-on' : ''}`} onClick={() => set({ other: true })}>Новый получатель</button>
                    </div>
                    {st.other && (
                      <div className="checkout__receiver">
                        <div className="field">
                          <label className="field__label" htmlFor={`rn-${p.position}`}>Имя</label>
                          <input id={`rn-${p.position}`} className="input" autoComplete="name" value={st.receiverName} onChange={(e) => set({ receiverName: e.target.value })} />
                        </div>
                        <div className="field">
                          <label className="field__label" htmlFor={`rp-${p.position}`}>Телефон</label>
                          <input id={`rp-${p.position}`} className="input" type="tel" autoComplete="tel" placeholder="+7 (999) 000-00-00" value={st.receiverPhone} onChange={(e) => set({ receiverPhone: e.target.value })} />
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              );
            })}

            <section className="panel">
              <h2 className="account__h">Способ оплаты</h2>
              {!methods.length && <p className="muted">Нет доступных методов оплаты</p>}
              <div className="paym" role="radiogroup" aria-label="Способ оплаты">
                {methods.map((m) => {
                  const off = !!m.notAvailableMessage;
                  const on = method === m.method;
                  return (
                    <button key={m.method} type="button" role="radio" aria-checked={on} disabled={off} className={`paym__opt${on ? ' is-on' : ''}`} onClick={() => setMethod(m.method)}>
                      <span className="addr-item__radio" aria-hidden="true" />
                      <Icon name={m.method === 'card' ? 'card' : m.method === 'paymentAccount' ? 'building' : 'box'} />
                      <span className="paym__text">
                        <b>{methodLabel(m)}</b>
                        {(m.notAvailableMessage || m.comment) && <span className="muted">{m.notAvailableMessage || m.comment}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="field checkout__comment">
                <label className="field__label" htmlFor="comment">Комментарий к заказу</label>
                <textarea id="comment" className="input" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} />
              </div>
            </section>
          </div>

          <aside className="split__aside">
            <div className="panel checkout__side">
              <h2 className="account__h">Итого</h2>
              <dl className="summary">
                <div><dt>Товары</dt><dd>{money(order.price.totalForItems)}</dd></div>
                {!!order.price.discount && <div className="summary__discount"><dt>Скидка:</dt><dd>−{money(order.price.discount)}</dd></div>}
                {order.price.deliveryPrice != null && <div><dt>Доставка:</dt><dd>{order.price.deliveryPrice > 0 ? money(order.price.deliveryPrice) : 'Бесплатно'}</dd></div>}
                <div className="summary__total"><dt>Сумма к оплате</dt><dd>{money(order.price.final)}</dd></div>
              </dl>
              <button type="button" className="btn btn--lg btn--block" disabled={busy || !method} onClick={submit}>
                {busy ? <span className="spinner" /> : chosen?.startPaymentNow ? 'Перейти к оплате' : 'Оформить заказ'}
              </button>
              <p className="muted checkout__legal">
                Нажимая кнопку, я подтверждаю, что ознакомлен и принимаю условия <Link to="/legal" className="link">публичной оферты</Link>
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
