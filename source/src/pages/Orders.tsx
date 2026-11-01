import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api/endpoints';
import type { Order } from '../api/types';
import { useStore } from '../lib/store';
import { isAuthorized, sessionStore } from '../store/session';
import { LoginPrompt } from '../components/LoginPrompt';
import { EmptyBox } from '../components/EmptyBox';
import { Icon } from '../components/Icon';
import { useQuery } from '../lib/query';
import { dateLong, money } from '../lib/format';
import { imgUrl } from '../lib/img';
import { PAYMENT_STATUS, orderItemsCount, statusOf } from '../lib/orders';
import { useSeo } from '../lib/seo';
import { errorText } from '../api/client';
import './account.css';
import './info.css';

export function OrderCard({ o }: { o: Order }) {
  const st = statusOf(o);
  const thumbs = o.deliveryParts.flatMap((p) => p.items).slice(0, 5);
  const count = orderItemsCount(o);
  return (
    <Link to={`/order/${o.id}`} className="ocard">
      <div className="ocard__top">
        <span className="ocard__num">Заказ №{o.orderNumber}</span>
        <span className={`status status--${st.tone}`}>{st.label}</span>
      </div>
      <span className="muted ocard__date">от {dateLong(o.createdOn)}</span>
      <div className="ocard__thumbs" aria-hidden="true">
        {thumbs.map((i, k) => (
          <span key={k} className="ocard__thumb">
            {i.product.info.imageUrls[0] && <img loading="lazy" alt="" width={44} height={44} src={imgUrl(i.product.info.imageUrls[0], 80)} />}
          </span>
        ))}
        {count > thumbs.length && <span className="ocard__more mono">+{count - thumbs.length}</span>}
      </div>
      <div className="ocard__bottom">
        <b className="ocard__sum">{money(o.price.final)}</b>
        {o.paymentInfo && <span className="muted">{PAYMENT_STATUS[o.paymentInfo.paymentStatus] ?? ''}</span>}
        <Icon name="chevronRight" />
      </div>
    </Link>
  );
}

function History() {
  const [page, setPage] = useState(1);
  const [list, setList] = useState<Order[]>([]);
  const [more, setMore] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const load = async (p: number) => {
    setBusy(true);
    try {
      const r = await api.getOrdersHistory(p, 20, true);
      setList((l) => (p === 1 ? r.orders : [...l, ...r.orders]));
      setMore((r.orders?.length ?? 0) >= 20);
      setPage(p);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    load(1);
  }, []);
  if (err) return <p className="notice notice--error">{err}</p>;
  if (!busy && !list.length)
    return (
      <div className="empty">
        <EmptyBox className="empty__art" />
        <h2>Заказы не найдены</h2>
        <p>В данном разделе будут выполненные или отменённые заказы</p>
      </div>
    );
  return (
    <>
      <div className="ogrid">{list.map((o) => <OrderCard key={o.id} o={o} />)}</div>
      {busy && <div className="cart-state"><span className="spinner" /></div>}
      {more && !busy && (
        <div style={{ display: 'grid', placeItems: 'center', marginTop: 20 }}>
          <button type="button" className="btn btn--ghost" onClick={() => load(page + 1)}>Показать ещё</button>
        </div>
      )}
    </>
  );
}

function Active() {
  const q = useQuery('orders:active', api.getActiveOrders);
  if (q.loading) return <div className="cart-state"><span className="spinner" /></div>;
  if (q.error) return <p className="notice notice--error">{q.error}</p>;
  const list = q.data?.orders ?? [];
  if (!list.length)
    return (
      <div className="empty">
        <EmptyBox className="empty__art" />
        <h2>Заказы не найдены</h2>
        <p>В данном разделе можно следить за статусами своих активных заказов</p>
        <Link to="/" className="btn">Перейти в каталог</Link>
      </div>
    );
  return <div className="ogrid">{list.map((o) => <OrderCard key={o.id} o={o} />)}</div>;
}

export default function OrdersPage() {
  const authorized = useStore(sessionStore, isAuthorized);
  const [tab, setTab] = useState<'active' | 'history'>('active');
  useSeo({ title: 'Мои заказы', noindex: true });
  return (
    <div className="container page">
      <header className="page__head">
        <h1 className="page__title">Мои заказы</h1>
      </header>
      {!authorized ? (
        <LoginPrompt next="/orders" text="Чтобы делать покупки, отслеживать свои заказы, добавлять в избранное и следить за бонусами." />
      ) : (
        <>
          <div className="tabs" role="tablist">
            <button type="button" role="tab" className="tabs__btn" aria-selected={tab === 'active'} onClick={() => setTab('active')}>Активные</button>
            <button type="button" role="tab" className="tabs__btn" aria-selected={tab === 'history'} onClick={() => setTab('history')}>История</button>
          </div>
          {tab === 'active' ? <Active /> : <History />}
        </>
      )}
    </div>
  );
}
