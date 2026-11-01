import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as api from '../api/endpoints';
import { errorText } from '../api/client';
import { useQuery, invalidate } from '../lib/query';
import { useStore } from '../lib/store';
import { activeAddress, isAuthorized, sessionStore } from '../store/session';
import { loadCart } from '../store/cart';
import { setCartOpen, toast } from '../store/ui';
import { LoginPrompt } from '../components/LoginPrompt';
import { Dialog } from '../components/Dialog';
import { Icon } from '../components/Icon';
import { dateLong, money, n, slotLabel } from '../lib/format';
import { imgUrl } from '../lib/img';
import { PART_STATUS, PAYMENT_STATUS, methodLabel, statusOf, timeLeft } from '../lib/orders';
import { goal } from '../lib/metrika';
import { useSeo } from '../lib/seo';
import type { Order } from '../api/types';
import './account.css';

export async function startPayment(orderId: string) {
  const r = await api.paymentForm(orderId);
  if (r.paymentForm?.formUrl) {
    window.location.href = r.paymentForm.formUrl;
    return 'redirect';
  }
  if (r.fullyPaid) return 'paid';
  if (r.qrCode) return r.qrCode;
  return 'none';
}

function Receipts({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const q = useQuery(open ? `receipts:${id}` : null, () => api.getReceipts(id));
  return (
    <>
      <button type="button" className="btn btn--ghost" onClick={() => setOpen(true)}><Icon name="doc" size={18} /> Скачать чек</button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Выберите чек">
        {q.loading && <div className="cart-state"><span className="spinner" /></div>}
        {q.error && <p className="notice notice--error">{q.error}</p>}
        {q.data && !q.data.receipts?.length && <p className="muted">Чеки не найдены</p>}
        <ul className="info__links" role="list">
          {q.data?.receipts?.map((r, k) => (
            <li key={k}>
              <a className="info__link" href={r.link} target="_blank" rel="noopener">
                <Icon name="doc" />
                <span><b>{r.kindTitle}</b><span className="muted">{dateLong(r.date)}</span></span>
                <Icon name="external" />
              </a>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}

function PickupCode() {
  const [open, setOpen] = useState(false);
  const q = useQuery(open ? 'pickup-code' : null, api.getConfirmationCode);
  return (
    <>
      <button type="button" className="btn btn--soft" onClick={() => setOpen(true)}><Icon name="qr" size={18} /> Код выдачи</button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Код выдачи">
        <p className="muted">Для получения готовых заказов, покажите код</p>
        {q.loading && <div className="cart-state"><span className="spinner" /></div>}
        {q.error && <p className="notice notice--error">{q.error}</p>}
        {q.data?.code && <p className="pickup-code mono">{q.data.code}</p>}
        <p className="muted">Предъявите для получения заказа</p>
      </Dialog>
    </>
  );
}

export default function OrderPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const authorized = useStore(sessionStore, isAuthorized);
  const q = useQuery(authorized ? `order:${id}` : null, () => api.getOrder(id).then((r) => r.order));
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  useSeo({ title: 'Детали заказа', noindex: true });

  if (!authorized) return <div className="container page"><LoginPrompt next={`/order/${id}`} /></div>;
  if (q.loading) return <div className="container page"><div className="cart-state"><span className="spinner" /></div></div>;
  if (!q.data)
    return (
      <div className="container page">
        <div className="empty">
          <h2>Что-то пошло не так</h2>
          <p>{q.error}</p>
          <Link to="/orders" className="btn">Все заказы</Link>
        </div>
      </div>
    );

  const o: Order = q.data;
  const st = statusOf(o);
  const left = o.status === 'waitingForPayment' ? timeLeft(o.cancelAfterDate) : null;
  const needPay = o.paymentInfo?.paymentStatus !== 'fullyPaid' && o.paymentMethodInfo?.method === 'card' && o.status !== 'canceled';

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const repeat = () =>
    run('repeat', async () => {
      goal('repeat_order_click');
      const addr = activeAddress(sessionStore.get());
      if (!addr) throw new Error('Выберите адрес');
      const items = o.deliveryParts.flatMap((p) => p.items).map((i) => ({ productId: i.product.id, quantityOfUnits: i.quantityOfUnits }));
      try {
        await api.updateCart({ userAddressId: addr.id, items });
        goal('repeat_order_success');
      } catch (e) {
        goal('repeat_order_failed');
        throw e;
      }
      await loadCart();
      toast(`Заказ от ${dateLong(o.createdOn)} добавлен в корзину`, 'ok', { label: 'Открыть корзину', run: () => setCartOpen(true) });
    });

  return (
    <div className="container page order">
      <Link to="/orders" className="back-link"><Icon name="arrowLeft" size={18} /> Мои заказы</Link>
      <header className="order__head">
        <div>
          <h1 className="page__title">Заказ №{o.orderNumber}</h1>
          <p className="muted">Создан {dateLong(o.createdOn)}</p>
        </div>
        <span className={`status status--${st.tone}`}>{st.label}</span>
      </header>

      {left && <p className="notice notice--warn"><Icon name="alert" /> Заказ ожидает оплаты и будет отменен через {left}</p>}
      {o.paymentInfo?.waitingForBankConfirmation && <p className="notice notice--info"><Icon name="info" /> Ожидаем подтверждения оплаты от банка</p>}
      {qr && (
        <div className="notice notice--info">
          <Icon name="qr" />
          <div>
            <p>Оплату по QR коду производить от юр.лица (через бизнес-приложение банка)! Оплата от физического лица засчитана не будет!</p>
            {/^https?:|^data:image/.test(qr) ? <img alt="QR-код для оплаты" width={220} height={220} src={qr} /> : <p className="mono">{qr}</p>}
          </div>
        </div>
      )}

      <div className="split">
        <div className="order__parts">
          {o.deliveryParts.map((p) => (
            <section key={p.position} className="panel opart">
              <div className="opart__head">
                <h2>{o.deliveryParts.length > 1 ? `${p.position} часть заказа` : 'Получение заказа'}</h2>
                <span className="status">{PART_STATUS[p.status] ?? p.status}</span>
              </div>
              {p.deliveryAddress && (
                <p className="opart__row">
                  <Icon name={p.deliveryAddress.departmentId ? 'store' : 'truck'} size={20} />
                  <span>
                    <span className="label">{p.deliveryAddress.departmentId ? 'Получение по адресу:' : 'Доставка по адресу:'}</span>
                    {p.deliveryAddress.name ? `${p.deliveryAddress.name}, ` : ''}{p.deliveryAddress.address?.value}
                  </span>
                </p>
              )}
              {p.deliveryTime && (
                <p className="opart__row"><Icon name="info" size={20} /> <span><span className="label">Дата и время доставки:</span>{slotLabel(p.deliveryTime)}</span></p>
              )}
              {p.orderReceiver?.name && (
                <p className="opart__row"><Icon name="user" size={20} /> <span><span className="label">Получатель</span>{p.orderReceiver.name} {p.orderReceiver.phone ?? ''}</span></p>
              )}
              <ul className="oitems" role="list">
                {p.items.map((i) => (
                  <li key={i.product.id} className="oitem">
                    <span className="oitem__img">{i.product.info.imageUrls[0] && <img loading="lazy" alt="" width={48} height={48} src={imgUrl(i.product.info.imageUrls[0], 80)} />}</span>
                    <Link to={`/product/${i.product.id}`} className="oitem__title">{i.product.info.title}</Link>
                    <span className="mono oitem__qty">{n(i.quantityOfUnits)} {i.product.info.packageInfo?.unit || 'шт'}</span>
                    <b className="oitem__sum">{money(i.price.final)}</b>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <aside className="split__aside">
          <div className="panel order__side">
            <dl className="summary">
              <div><dt>Товары</dt><dd>{money(o.price.totalForItems)}</dd></div>
              {!!o.price.discount && <div className="summary__discount"><dt>Скидка:</dt><dd>−{money(o.price.discount)}</dd></div>}
              {o.price.deliveryPrice != null && <div><dt>Доставка:</dt><dd>{o.price.deliveryPrice > 0 ? money(o.price.deliveryPrice) : 'Бесплатно'}</dd></div>}
              <div className="summary__total"><dt>Итого:</dt><dd>{money(o.price.final)}</dd></div>
            </dl>
            <dl className="spec">
              <div><dt>Способ оплаты</dt><dd>{methodLabel(o.paymentMethodInfo)}</dd></div>
              {o.paymentInfo && <div><dt>Статус оплаты</dt><dd>{PAYMENT_STATUS[o.paymentInfo.paymentStatus] ?? o.paymentInfo.paymentStatus}</dd></div>}
              {o.comment && <div><dt>Комментарий</dt><dd>{o.comment}</dd></div>}
            </dl>
            <div className="order__actions">
              {needPay && (
                <button type="button" className="btn btn--lg btn--block" disabled={busy !== null} onClick={() => run('pay', async () => {
                  const r = await startPayment(o.id);
                  if (r === 'paid') { toast('Заказ уже оплачен', 'ok'); invalidate(`order:${o.id}`); q.reload(); }
                  else if (r !== 'redirect' && r !== 'none') setQr(r);
                })}>
                  {busy === 'pay' ? <span className="spinner" /> : 'Оплатить заказ'}
                </button>
              )}
              {o.editFlags?.repeat && (
                <button type="button" className="btn btn--soft btn--block" disabled={busy !== null} onClick={repeat}>
                  {busy === 'repeat' ? <span className="spinner" /> : <><Icon name="refresh" size={18} /> Повторить заказ</>}
                </button>
              )}
              {o.deliveryParts.some((p) => p.status === 'inDestination') && <PickupCode />}
              <Receipts id={o.id} />
              {o.editFlags?.cancel && (
                <button type="button" className="btn btn--danger btn--block" onClick={() => setConfirmCancel(true)}>Отменить заказ</button>
              )}
            </div>
          </div>
        </aside>
      </div>

      <Dialog open={confirmCancel} onClose={() => setConfirmCancel(false)} title="Отмена заказа"
        footer={
          <div className="dlg-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setConfirmCancel(false)}>Нет</button>
            <button type="button" className="btn btn--danger" disabled={busy !== null} onClick={() => run('cancel', async () => {
              await api.cancelOrder(o.id);
              setConfirmCancel(false);
              toast(`Ваш заказ №${o.orderNumber} был отменен`, 'info');
              invalidate('orders:');
              q.reload();
              nav(`/order/${o.id}`, { replace: true });
            })}>Да, отменить</button>
          </div>
        }>
        <p>Вы уверены, что хотите отменить Ваш заказ?</p>
      </Dialog>
    </div>
  );
}
