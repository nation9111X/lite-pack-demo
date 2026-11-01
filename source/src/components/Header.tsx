import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { SearchBox } from './SearchBox';
import { useStore } from '../lib/store';
import { activeAddress, isAuthorized, sessionStore } from '../store/session';
import { cartCount, cartStore, cartTotal } from '../store/cart';
import { openAddress, setCartOpen, setCatalogOpen, uiStore } from '../store/ui';
import { useCategoryTree } from '../hooks/data';
import { themeStore, toggleTheme } from '../lib/theme';
import { moneyShort, plural } from '../lib/format';
import { imgUrl } from '../lib/img';
import type { Category } from '../api/types';
import { onScrollY, scrollToTop } from '../lib/smooth';
import './header.css';
import { asset } from '../lib/base';

export function Logo({ className = '' }: { className?: string }) {
  const loc = useLocation();
  return (
    <Link
      to="/"
      className={`logo ${className}`}
      aria-label="Лайт-Пак — на главную"
      onClick={(e) => {
        // На главной — плавно наверх к первому экрану; с других страниц переход сам начинается сверху
        if (loc.pathname === '/') {
          e.preventDefault();
          scrollToTop();
        }
      }}
    >
      <picture>
        <source srcSet={asset('/brand/logo.webp')} type="image/webp" />
        <img alt="Лайт-Пак" width={451} height={237} src={asset('/brand/logo.png')} />
      </picture>
    </Link>
  );
}

/** Короткая подпись адреса: самовывоз / улица и дом / регион. */
export function useAddressLabel() {
  const s = useStore(sessionStore, (x) => x);
  const a = activeAddress(s);
  if (a) {
    if (a.namedAddress.departmentId) return { kind: 'Самовывоз', text: a.namedAddress.name || a.namedAddress.address.value };
    const ad = a.namedAddress.address;
    const short = [ad.street, ad.house].filter(Boolean).join(', ');
    return { kind: 'Доставка', text: short || ad.value };
  }
  if (s.region) return { kind: 'Регион', text: s.region.name };
  return { kind: 'Адрес', text: 'Способ доставки' };
}

/** Переключатель темы: новая тема расходится кругом от точки касания. */
export function ThemeToggle() {
  const dark = useStore(themeStore, (s) => s.theme === 'dark');
  return (
    <button type="button" className="theme-btn" onClick={(e) => toggleTheme(e.clientX, e.clientY)} aria-label={dark ? 'Включить светлую тему' : 'Включить тёмную тему'} title={dark ? 'Светлая тема' : 'Тёмная тема'}>
      <span key={dark ? 'd' : 'l'} className="theme-btn__ico"><Icon name={dark ? 'sun' : 'moon'} size={20} /></span>
    </button>
  );
}

export function AddressChip({ compact }: { compact?: boolean }) {
  const { kind, text } = useAddressLabel();
  const missing = kind === 'Адрес';
  return (
    <button type="button" className={`addr-chip${compact ? ' addr-chip--compact' : ''}${missing ? ' is-missing' : ''}`} onClick={() => openAddress()}>
      <Icon name={kind === 'Самовывоз' ? 'store' : 'pin'} size={20} className="addr-chip__icon" />
      <span className="addr-chip__text">
        <span className="addr-chip__kind">{kind}</span>
        <span key={text} className="addr-chip__value">{text}</span>
      </span>
      <Icon name="chevronDown" size={16} className="addr-chip__caret" />
    </button>
  );
}

/** Корзина-короб: наполняется по мере приближения к минимальной сумме заказа. */
export function CartBox({ size = 30 }: { size?: number }) {
  const st = useStore(cartStore, (x) => x);
  const min = st.cart?.deliveryPriceInfo?.minOrderPrice ?? 0;
  const total = cartTotal(st);
  const level = total <= 0 ? 0 : min > 0 ? Math.min(1, total / min) : 1;
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!st.bump || !ref.current) return;
    ref.current.classList.remove('is-bump');
    void ref.current.getBoundingClientRect();
    ref.current.classList.add('is-bump');
  }, [st.bump]);
  const h = 11 * level;
  return (
    <svg ref={ref} className={`cartbox${level >= 1 ? ' is-full' : ''}`} viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <path className="cartbox__flap" d="M5 11 9 5h14l4 6" />
      <rect className="cartbox__body" x="5" y="11" width="22" height="16" rx="2.5" />
      <rect className="cartbox__fill" x="6.5" y={25.5 - h} width="19" height={h} rx="1.2" />
      <path className="cartbox__tape" d="M13 11h6v5h-6z" />
    </svg>
  );
}

function CartButton() {
  const st = useStore(cartStore, (x) => x);
  const count = cartCount(st);
  const total = cartTotal(st);
  return (
    <button type="button" className="cart-btn" onClick={() => setCartOpen(true)} data-cart-target data-magnetic aria-label={`Корзина: ${count} ${plural(count, 'товар', 'товара', 'товаров')}`}>
      <span className="cart-btn__icon">
        <CartBox />
        {count > 0 && <span className="badge">{count}</span>}
      </span>
      <span className="cart-btn__text">
        <span className="cart-btn__label">Корзина</span>
        <span className="cart-btn__sum">{count > 0 ? moneyShort(Math.round(total * 100) / 100) : 'пуста'}</span>
      </span>
    </button>
  );
}

function MegaMenu() {
  const open = useStore(uiStore, (s) => s.catalogOpen);
  const tree = useCategoryTree({ defer: !open });
  const [cur, setCur] = useState<Category | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const loc = useLocation();

  useEffect(() => setCatalogOpen(false), [loc.pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setCatalogOpen(false);
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!panel.current?.contains(t) && !t.closest('.hdr__catalog')) setCatalogOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDoc);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [open]);

  const cats = tree.data ?? [];
  const active = cur ?? cats[0] ?? null;
  if (!open) return null;
  return (
    <div className="mega" ref={panel} id="mega-menu">
      <div className="container mega__inner">
        <ul className="mega__roots" role="list">
          {cats.map((c) => (
            <li key={c.id}>
              <Link
                to={`/category/${c.id}`}
                className={`mega__root${active?.id === c.id ? ' is-active' : ''}`}
                onMouseEnter={() => setCur(c)}
                onFocus={() => setCur(c)}
              >
                {c.imageUrl && <img loading="lazy" alt="" width={36} height={36} src={imgUrl(c.imageUrl, 80)} />}
                <span>{c.title}</span>
                <Icon name="chevronRight" size={16} />
              </Link>
            </li>
          ))}
        </ul>
        {active && (
          <div className="mega__subs">
            <Link to={`/category/${active.id}`} className="mega__title">
              {active.title} <Icon name="arrowRight" size={20} />
            </Link>
            <div className="mega__cols">
              {active.subCategories.map((s) => (
                <div key={s.id} className="mega__group">
                  <Link to={`/category/${s.id}`} className="mega__group-title">
                    {s.title}
                  </Link>
                  {s.subCategories.length > 0 && (
                    <ul role="list">
                      {s.subCategories.slice(0, 8).map((x) => (
                        <li key={x.id}>
                          <Link to={`/category/${x.id}`}>{x.title}</Link>
                        </li>
                      ))}
                      {s.subCategories.length > 8 && (
                        <li>
                          <Link to={`/category/${s.id}`} className="mega__more">
                            Показать все
                          </Link>
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {tree.loading && <div className="mega__loading"><span className="spinner" /></div>}
      </div>
    </div>
  );
}

export function Header() {
  const catalogOpen = useStore(uiStore, (s) => s.catalogOpen);
  const authorized = useStore(sessionStore, isAuthorized);
  const [compact, setCompact] = useState(false);
  const [searching, setSearching] = useState(false);
  const row = useRef<HTMLDivElement>(null);
  const loc = useLocation();

  // Положение прокрутки — из общего источника (lib/smooth), без чтения scrollY в каждом кадре
  useEffect(() => onScrollY((y) => setCompact(y > 24)), []);
  useEffect(() => setSearching(false), [loc.pathname, loc.search]);
  useEffect(() => {
    if (!searching) return;
    const close = (e: Event) => {
      if (!row.current?.contains(e.target as Node) && !(e.target as Element).closest?.('.hdr__find')) setSearching(false);
    };
    document.addEventListener('pointerdown', close, { passive: true });
    return () => document.removeEventListener('pointerdown', close);
  }, [searching]);

  return (
    <>
    <header className={`hdr${compact ? ' is-compact' : ''}`}>
      <div className="container hdr__bar">
        <Logo className="hdr__logo" />
        <button
          type="button"
          className={`btn hdr__catalog${catalogOpen ? ' is-open' : ''}`}
          data-magnetic
          aria-expanded={catalogOpen}
          aria-controls="mega-menu"
          onClick={() => setCatalogOpen(!catalogOpen)}
        >
          <span className="burger" aria-hidden="true"><i /><i /><i /></span>
          Каталог
        </button>
        <div className="hdr__search">
          <SearchBox />
        </div>
        <div className="hdr__addr">
          <AddressChip />
        </div>
        <nav className="hdr__actions" aria-label="Личный кабинет">
          <ThemeToggle />
          <NavLink to="/orders" className="hdr__act">
            <Icon name="doc" />
            <span>Заказы</span>
          </NavLink>
          <NavLink to="/profile" className="hdr__act">
            <Icon name="user" />
            <span>{authorized ? 'Профиль' : 'Войти'}</span>
          </NavLink>
          <CartButton />
        </nav>
        <div className="hdr__mobile-addr">
          <AddressChip compact />
        </div>
        <button
          type="button"
          className={`hdr__find${compact ? ' is-on' : ''}`}
          aria-label="Поиск по каталогу"
          tabIndex={compact ? 0 : -1}
          onClick={() => {
            // фокус — сразу в обработчике касания, иначе телефон не покажет клавиатуру
            row.current?.querySelector('input')?.focus({ preventScroll: true });
            setSearching((v) => !v);
          }}
        >
          <Icon name="search" size={20} />
        </button>
        <div className="hdr__mobile-theme"><ThemeToggle /></div>
      </div>
      <MegaMenu />
    </header>
    <div ref={row} className={`container hdr__search-row${searching && compact ? ' is-floating' : ''}`}>
      <SearchBox />
    </div>
    </>
  );
}

export function BottomNav() {
  const st = useStore(cartStore, (x) => x);
  const count = cartCount(st);
  const nav = useNavigate();
  const loc = useLocation();
  const isCatalog = loc.pathname === '/' || loc.pathname.startsWith('/category') || loc.pathname.startsWith('/product') || loc.pathname.startsWith('/search');
  const at = isCatalog ? 0 : loc.pathname === '/cart' ? 1 : loc.pathname.startsWith('/order') ? 2 : loc.pathname.startsWith('/profile') ? 3 : -1;
  return (
    <nav className={`bnav${at < 0 ? ' is-none' : ''}`} style={{ ['--bn-i' as string]: Math.max(0, at) }} aria-label="Основная навигация">
      <NavLink to="/" className={() => `bnav__item${isCatalog ? ' active' : ''}`} end>
        <Icon name="grid" />
        <span>Каталог</span>
      </NavLink>
      <NavLink to="/cart" className="bnav__item" data-cart-target onClick={(e) => { if (loc.pathname === '/cart') { e.preventDefault(); nav('/cart'); } }}>
        <span className="bnav__icon">
          <CartBox size={26} />
          {count > 0 && <span className="badge">{count}</span>}
        </span>
        <span>Корзина</span>
      </NavLink>
      <NavLink to="/orders" className="bnav__item">
        <Icon name="doc" />
        <span>Заказы</span>
      </NavLink>
      <NavLink to="/profile" className="bnav__item">
        <Icon name="user" />
        <span>Профиль</span>
      </NavLink>
    </nav>
  );
}
