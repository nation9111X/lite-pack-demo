import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import * as api from '../api/endpoints';
import { errorText } from '../api/client';
import { Icon } from '../components/Icon';
import { useSeo } from '../lib/seo';
import './checkout.css';

/**
 * Возврат из платёжной формы банка. Старое приложение использовало маршруты
 * /paymentForm, /paymentCompleted, /confirm, /cancel — сохраняем их.
 */
export default function PaymentPage({ mode }: { mode: 'form' | 'completed' | 'cancel' }) {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const orderId = sp.get('orderId') ?? sp.get('order') ?? sp.get('id');
  const paymentId = sp.get('paymentId') ?? sp.get('payment_id') ?? sp.get('mdOrder');
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'error'>('idle');
  const [err, setErr] = useState<string | null>(null);
  useSeo({ title: 'Оплата заказа', noindex: true });

  useEffect(() => {
    if (mode === 'cancel') return;
    if (!orderId) return;
    let alive = true;
    (async () => {
      setState('busy');
      try {
        if (mode === 'form') {
          const r = await api.paymentForm(orderId);
          if (r.paymentForm?.formUrl) {
            window.location.href = r.paymentForm.formUrl;
            return;
          }
        } else if (paymentId) {
          await api.paymentCompleted(orderId, paymentId);
        }
        if (alive) {
          setState('ok');
          nav(`/order/${orderId}`, { replace: true });
        }
      } catch (e) {
        if (alive) {
          setErr(errorText(e));
          setState('error');
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [mode, orderId, paymentId, nav]);

  return (
    <div className="container page">
      <div className="empty">
        {state === 'busy' && <span className="spinner" />}
        <h1 className="page__title">{mode === 'cancel' ? 'Оплата отменена' : 'Оплата заказа'}</h1>
        {state === 'error' && <p className="notice notice--error"><Icon name="alert" /> {err}</p>}
        {mode === 'cancel' && <p>Заказ сохранён — оплатить его можно в разделе «Мои заказы».</p>}
        {!orderId && mode !== 'cancel' && <p>Статус оплаты отображается в деталях заказа.</p>}
        <div className="done__actions">
          {orderId ? <Link to={`/order/${orderId}`} className="btn">Вернуться к заказу</Link> : <Link to="/orders" className="btn">Мои заказы</Link>}
          <Link to="/" className="btn btn--ghost">В каталог</Link>
        </div>
      </div>
    </div>
  );
}
