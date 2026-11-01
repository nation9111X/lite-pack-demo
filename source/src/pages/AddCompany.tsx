import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as api from '../api/endpoints';
import { errorText } from '../api/client';
import type { Company } from '../api/types';
import { useStore } from '../lib/store';
import { isAuthorized, sessionStore } from '../store/session';
import { toast } from '../store/ui';
import { invalidate } from '../lib/query';
import { LoginPrompt } from '../components/LoginPrompt';
import { Icon } from '../components/Icon';
import { useSeo } from '../lib/seo';
import './account.css';

export default function AddCompanyPage() {
  const s = useStore(sessionStore, (x) => x);
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [list, setList] = useState<Company[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useSeo({ title: 'Добавление компании', noindex: true });

  useEffect(() => {
    const term = q.trim();
    if (term.length < 3) {
      setList(null);
      return;
    }
    const t = window.setTimeout(async () => {
      setBusy(true);
      setErr(null);
      try {
        const r = await api.findCompanies(term);
        setList(Array.isArray(r) ? r : r.companies ?? []);
      } catch (e) {
        setErr(errorText(e));
      } finally {
        setBusy(false);
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [q]);

  if (!isAuthorized(s)) return <div className="container page"><LoginPrompt next="/add-company" /></div>;

  return (
    <div className="container page" style={{ maxWidth: 760 }}>
      <Link to="/profile" className="back-link"><Icon name="arrowLeft" size={18} /> Профиль</Link>
      <header className="page__head">
        <h1 className="page__title">Добавление компании</h1>
        <p className="page__sub">Если это ваша компания, добавьте её и сможете заказывать как юр.лицо, либо добавьте компанию позже.</p>
      </header>
      <div className="panel company">
        <div className="field">
          <label className="field__label" htmlFor="inn">Введите ИНН вашей компании</label>
          <input id="inn" className="input" inputMode="search" placeholder="Введите номер ИНН или название" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </div>
        {busy && <div className="cart-state"><span className="spinner" /></div>}
        {err && <p className="notice notice--error">{err}</p>}
        {list && !busy && !list.length && <p className="muted">Компании не найдены</p>}
        <ul className="plist" role="list">
          {list?.map((c) => (
            <li key={c.inn + (c.kpp ?? '')} className="plist__item">
              <Icon name="building" />
              <span>
                <b>{c.shortName || c.fullName}</b>
                <span className="muted mono">ИНН {c.inn}{c.kpp ? ` · КПП ${c.kpp}` : ''}{c.ogrn ? ` · ОГРН ${c.ogrn}` : ''}</span>
                {c.fullAddress && <span className="muted">{c.fullAddress}</span>}
              </span>
              <button
                type="button"
                className="btn btn--sm"
                disabled={saving !== null}
                onClick={async () => {
                  setSaving(c.inn);
                  try {
                    await api.addCompany({ inn: c.inn, kpp: c.kpp ?? undefined, userAddressId: s.activeAddressId ?? undefined });
                    invalidate('profiles');
                    toast('Компания добавлена', 'ok');
                    nav('/profile');
                  } catch (e) {
                    const msg = errorText(e);
                    toast(/already|уже/i.test(msg) ? 'Такая компания уже добавлена.' : msg || 'Ошибка добавления компании', 'error');
                  } finally {
                    setSaving(null);
                  }
                }}
              >
                {saving === c.inn ? <span className="spinner" /> : 'Добавить'}
              </button>
            </li>
          ))}
        </ul>
        <p className="muted company__note">
          Я - владелец компании. Для подтверждения того, что вы являетесь владельцем компании, пожалуйста, напишите или позвоните в службу поддержки.{' '}
          <Link to="/contact-us" className="link">Связаться с нами</Link>
        </p>
      </div>
    </div>
  );
}
