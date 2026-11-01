import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api/endpoints';
import { errorText } from '../api/client';
import { useQuery, invalidate } from '../lib/query';
import { useStore } from '../lib/store';
import { isAuthorized, sessionStore } from '../store/session';
import { logoutAll, removeAddress, chooseAddress, switchProfile } from '../store/actions';
import { openAddress, toast } from '../store/ui';
import { LoginPrompt } from '../components/LoginPrompt';
import { Dialog } from '../components/Dialog';
import { Icon } from '../components/Icon';
import { useSeo } from '../lib/seo';
import type { ShopProfile } from '../api/types';
import './account.css';
import './info.css';

function ProfileForm({ profile }: { profile: ShopProfile }) {
  const [name, setName] = useState(profile.name ?? '');
  const [email, setEmail] = useState(profile.email ?? '');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setName(profile.name ?? '');
    setEmail(profile.email ?? '');
  }, [profile.id, profile.name, profile.email]);
  const dirty = name !== (profile.name ?? '') || email !== (profile.email ?? '');
  return (
    <form
      className="pform"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api.updateProfile({ name: name.trim(), email: email.trim() });
          invalidate('profiles');
          toast('Профиль сохранён', 'ok');
        } catch (e2) {
          toast(errorText(e2), 'error');
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="field">
        <label className="field__label" htmlFor="p-name">Имя</label>
        <input id="p-name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="p-phone">Телефон</label>
        <input id="p-phone" className="input" value={profile.phone ?? ''} readOnly disabled />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="p-email">Почта <span className="muted">(необязательно)</span></label>
        <input id="p-email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <button type="submit" className="btn" disabled={!dirty || busy}>{busy ? <span className="spinner" /> : 'Сохранить'}</button>
    </form>
  );
}

export default function ProfilePage() {
  const s = useStore(sessionStore, (x) => x);
  const authorized = isAuthorized(s);
  const profiles = useQuery(authorized ? 'profiles' : null, api.getShopProfiles);
  const [ask, setAsk] = useState<'logout' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);
  useSeo({ title: 'Профиль', noindex: true });

  if (!authorized)
    return (
      <div className="container page">
        <header className="page__head"><h1 className="page__title">Профиль</h1></header>
        <LoginPrompt next="/profile" />
      </div>
    );

  const list = profiles.data?.profiles ?? [];
  const activeId = profiles.data?.activeProfileId ?? s.session?.profileId;
  const active = list.find((p) => p.id === activeId) ?? list[0];

  return (
    <div className="container page account">
      <header className="page__head">
        <p className="label">{active?.kind === 'shopCompany' ? 'Компания' : 'Профиль и настройки'}</p>
        <h1 className="page__title">{active?.company?.shortName || active?.name || active?.phone || 'Профиль'}</h1>
      </header>

      <div className="account__grid">
        <section className="panel" aria-labelledby="ps-title">
          <h2 id="ps-title" className="account__h">Настройки профиля</h2>
          {profiles.loading && <div className="cart-state"><span className="spinner" /></div>}
          {profiles.error && <p className="notice notice--error">{profiles.error}</p>}
          {active && <ProfileForm profile={active} />}
        </section>

        <section className="panel" aria-labelledby="pp-title">
          <h2 id="pp-title" className="account__h">Аккаунт</h2>
          <ul className="plist" role="list">
            {list.map((p) => (
              <li key={p.id} className={`plist__item${p.id === activeId ? ' is-on' : ''}`}>
                <Icon name={p.kind === 'shopCompany' ? 'building' : 'user'} />
                <span>
                  <b>{p.company?.shortName || p.name || p.phone}</b>
                  <span className="muted">{p.kind === 'shopCompany' ? `ИНН ${p.company?.inn ?? ''}` : 'Физическое лицо'}</span>
                </span>
                {p.id === activeId ? (
                  <span className="status status--ok">Активен</span>
                ) : (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => switchProfile(p.id).then(() => profiles.reload()).catch((e) => toast(errorText(e), 'error'))}>
                    {p.kind === 'shopCompany' ? 'Переключиться на компанию' : 'Сменить профиль'}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <Link to="/add-company" className="btn btn--soft btn--block"><Icon name="plus" size={18} /> Добавить компанию</Link>
        </section>

        <section className="panel" aria-labelledby="pa-title">
          <h2 id="pa-title" className="account__h">Мои адреса</h2>
          {!s.addresses.length && <p className="muted">Нет адресов</p>}
          <ul className="plist" role="list">
            {s.addresses.map((a) => (
              <li key={a.id} className={`plist__item${a.id === s.activeAddressId ? ' is-on' : ''}`}>
                <Icon name={a.namedAddress.departmentId ? 'store' : 'pin'} />
                <span>
                  <b>{a.namedAddress.name || (a.namedAddress.departmentId ? 'Самовывоз' : 'Доставка')}</b>
                  <span className="muted">{a.namedAddress.address.value}</span>
                </span>
                {a.id === s.activeAddressId ? (
                  <span className="status status--ok">Выбран</span>
                ) : (
                  <span className="plist__acts">
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => chooseAddress(a.id).catch((e) => toast(errorText(e), 'error'))}>Выбрать</button>
                    <button type="button" className="icon-btn" aria-label="Удалить адрес" onClick={() => removeAddress(a.id).catch((e) => toast(errorText(e), 'error'))}><Icon name="trash" size={18} /></button>
                  </span>
                )}
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn--soft btn--block" onClick={() => openAddress()}><Icon name="plus" size={18} /> Добавить адрес</button>
        </section>

        <section className="panel" aria-labelledby="ph-title">
          <h2 id="ph-title" className="account__h">Покупателям</h2>
          <ul className="info__links" role="list">
            <li><Link to="/orders" className="info__link"><Icon name="doc" /><span><b>Мои заказы</b></span><Icon name="chevronRight" /></Link></li>
            <li><Link to="/help" className="info__link"><Icon name="help" /><span><b>Справка</b></span><Icon name="chevronRight" /></Link></li>
            <li><Link to="/contact-us" className="info__link"><Icon name="phone" /><span><b>Связаться с нами</b></span><Icon name="chevronRight" /></Link></li>
          </ul>
          <div className="account__danger">
            <button type="button" className="btn btn--ghost" onClick={() => setAsk('logout')}><Icon name="logout" size={18} /> Выйти</button>
            <button type="button" className="btn btn--danger" onClick={() => setAsk('delete')}>Удалить аккаунт</button>
          </div>
        </section>
      </div>

      <Dialog open={ask !== null} onClose={() => setAsk(null)} title={ask === 'delete' ? 'Управление аккаунтом' : 'Выйти'}
        footer={
          <div className="dlg-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setAsk(null)}>Отмена</button>
            <button type="button" className={`btn${ask === 'delete' ? ' btn--danger' : ''}`} disabled={busy} onClick={async () => {
              setBusy(true);
              try {
                if (ask === 'delete') {
                  await api.deleteAccount();
                  toast('Запрос на удаление аккаунта отправлен, аккаунт будет удалён в течение нескольких дней', 'info', undefined, 7000);
                }
                await logoutAll();
                setAsk(null);
              } catch (e) {
                toast(errorText(e), 'error');
              } finally {
                setBusy(false);
              }
            }}>{ask === 'delete' ? 'Удалить' : 'Выйти'}</button>
          </div>
        }>
        <p>{ask === 'delete' ? 'Вы действительно хотите удалить аккаунт?' : 'Вы хотите выйти из аккаунта?'}</p>
      </Dialog>
    </div>
  );
}
