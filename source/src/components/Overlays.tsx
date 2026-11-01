import { useEffect } from 'react';
import { useStore } from '../lib/store';
import { acceptCookies, activeAddress, saveRegion, sessionStore } from '../store/session';
import { dismissToast, uiStore } from '../store/ui';
import { useAnonRegions, useLegalDocs } from '../hooks/data';
import { invalidate } from '../lib/query';
import { startMetrika } from '../lib/metrika';
import { Icon } from './Icon';
import './overlays.css';

/** Плашка cookie: тексты старого сайта; Метрика стартует после «OK» (как раньше). */
export function CookieBar() {
  const accepted = useStore(sessionStore, (s) => s.cookieAccepted);
  const docs = useLegalDocs();
  useEffect(() => {
    if (accepted) startMetrika();
  }, [accepted]);
  if (accepted) return null;
  const doc = (k: string) => docs.data?.find((d) => d.key === k)?.url ?? '/legal';
  return (
    <section className="cookie" role="region" aria-label="Сайт использует cookies">
      <p className="cookie__title">Сайт использует cookies</p>
      <p className="cookie__text">
        Оставаясь с нами, вы{' '}
        <a href={doc('user-agreement')} target="_blank" rel="noopener">соглашаетесь</a> с{' '}
        <a href={doc('cookie-policy')} target="_blank" rel="noopener">условиями обработки</a> cookie и иных данных, собираемых метрическими программами.
      </p>
      <button type="button" className="btn btn--sm cookie__ok" onClick={acceptCookies}>
        OK
      </button>
    </section>
  );
}

/** Выбор региона — не блокирует экран, в отличие от старой модалки. */
export function RegionPrompt() {
  const s = useStore(sessionStore, (x) => x);
  const regions = useAnonRegions();
  const show = s.addressesLoaded && !s.region && !s.regionSkipped && !activeAddress(s);
  if (!show || !regions.data?.length) return null;
  return (
    <section className="region" role="dialog" aria-modal="false" aria-labelledby="region-title">
      <div className="region__head">
        <Icon name="pin" size={22} />
        <h2 id="region-title">Выберите регион доставки</h2>
      </div>
      <p className="region__text">От выбранного региона будет зависеть стоимость товара и их наличие</p>
      <div className="region__opts">
        {regions.data.map((r) => (
          <button
            key={r.regionId}
            type="button"
            className="btn btn--ghost region__opt"
            onClick={() => {
              saveRegion(r);
              invalidate('cat:');
              invalidate('product:');
            }}
          >
            {r.name}
          </button>
        ))}
      </div>
      <button type="button" className="region__skip" onClick={() => saveRegion(null, true)}>
        Пропустить
      </button>
    </section>
  );
}

export function Toasts() {
  const toasts = useStore(uiStore, (s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.tone ?? 'info'}`} role={t.tone === 'error' ? 'alert' : 'status'}>
          <Icon name={t.tone === 'error' ? 'alert' : t.tone === 'ok' ? 'check' : 'info'} size={20} />
          <span className="toast__text">{t.text}</span>
          {t.action && (
            <button type="button" className="toast__act" onClick={() => { t.action!.run(); dismissToast(t.id); }}>
              {t.action.label}
            </button>
          )}
          <button type="button" className="toast__x" aria-label="Закрыть" onClick={() => dismissToast(t.id)}>
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
