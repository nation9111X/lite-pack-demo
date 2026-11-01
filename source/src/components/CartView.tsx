import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { activeAddress, isAuthorized, sessionStore } from '../store/session';
import { applyPromo, cartStore, cartTotal, clearCartAll, qtyIn, removePromo, removeUnavailable, setQty, type CartState } from '../store/cart';
import { openAddress, openAuth, setCartOpen, toast } from '../store/ui';
import { errorText } from '../api/client';
import * as api from '../api/endpoints';
import type { CartItem, Product } from '../api/types';
import { AddControl } from './ProductCard';
import { Icon } from './Icon';
import { EmptyBox } from './EmptyBox';
import { Rolling } from './Rolling';
import { imgUrl } from '../lib/img';
import { useQuery } from '../lib/query';
import { useCatalogParams } from '../hooks/data';
import { goodsCount, inStock, money, n, perUnit, plural, shortAddress, stepOf, unitOf } from '../lib/format';
import './cart.css';

const clip = (t: string, max = 38) => (t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t);

function CartLine({ item, onNavigate }: { item: CartItem; onNavigate?: () => void }) {
  const qty = useStore(cartStore, (s) => qtyIn(s, item.product.id));
  const p = item.product;
  const step = stepOf(p);
  const unit = unitOf(p);
  const total = qty === item.quantityOfUnits ? item.price.final : qty * p.finalPrice;
  const fin = item.price.finalPerUnit || p.finalPrice;
  const orig = item.price.originalPerUnit;
  const off = !inStock(p);
  const remove = () => {
    setQty(p, 0);
    toast(`Убрали «${clip(p.info.title)}»`, 'info', { label: 'Вернуть', run: () => setQty(p, qty) }, 6000);
  };
  return (
    <li className={`cline${off ? ' is-off' : ''}`}>
      <Link to={`/product/${p.id}`} className="cline__img" onClick={onNavigate} tabIndex={-1} aria-hidden="true">
        {p.info.imageUrls[0] && <img loading="lazy" alt="" width={72} height={72} src={imgUrl(p.info.imageUrls[0], 180)} />}
      </Link>
      <div className="cline__info">
        <Link to={`/product/${p.id}`} className="cline__title" onClick={onNavigate}>
          {p.info.title}
        </Link>
        <span className="cline__unit mono">
          {orig > fin + 1e-9 && <s>{money(orig)}</s>} {money(fin)}/{unit}
          {step > 1 && qty > 0 && <> · {n(Math.round(qty / step))} уп. по {n(step)}</>}
          {off && <b className="cline__off"> · Нет в наличии</b>}
        </span>
      </div>
      <div className="cline__ctl">
        <AddControl product={p} />
      </div>
      <div className="cline__sum">
        <Rolling value={total} format={money} />
      </div>
      <button type="button" className="cline__del" onClick={remove} aria-label={`Убрать «${p.info.title}» из корзины`} title="Убрать из корзины">
        <Icon name="close" size={16} strokeWidth={2.2} />
      </button>
    </li>
  );
}

/** Полоса «упаковочной ленты» до минимальной суммы заказа. */
export function MinOrderMeter({ total, min }: { total: number; min: number }) {
  if (!min) return null;
  const left = Math.max(0, min - total);
  const pct = Math.min(100, (total / min) * 100);
  return (
    <div className={`tape${left <= 0 ? ' is-done' : ''}`}>
      <div className="tape__track" aria-hidden="true">
        <div className="tape__bar" style={{ width: pct + '%' }} />
      </div>
      <p className="tape__text">
        {left > 0 ? (
          <>
            Не хватает <b>{money(left)}</b> до мин. суммы заказа
          </>
        ) : (
          <>
            <Icon name="check" size={18} /> Минимальная сумма заказа набрана
          </>
        )}
      </p>
    </div>
  );
}

/** Сколько упаковок, какой вес и объём у заказа — из packageInfo товаров (для доставки и самовывоза). */
function Passport({ items, st }: { items: CartItem[]; st: CartState }) {
  let packs = 0;
  let kg = 0;
  let m3 = 0;
  for (const i of items) {
    const q = qtyIn(st, i.product.id);
    const pkg = i.product.info.packageInfo;
    const step = stepOf(i.product);
    if (step > 1) packs += Math.ceil(q / step);
    if (pkg?.weight?.unit === 'кг') kg += q * (perUnit(pkg.weight) ?? 0);
    if (pkg?.volume?.unit === 'м3') m3 += q * (perUnit(pkg.volume) ?? 0);
  }
  if (!packs && !kg && !m3) return null;
  return (
    <ul className="passport" role="list" aria-label="Параметры заказа">
      {packs > 0 && (
        <li>
          <Icon name="box" size={18} />
          <span><b>{n(packs)}</b> {plural(packs, 'упаковка', 'упаковки', 'упаковок')}</span>
        </li>
      )}
      {kg > 0 && (
        <li>
          <span className="passport__ico" aria-hidden="true">кг</span>
          <span>≈ <b><Rolling value={kg} format={(v) => n(v < 10 ? Math.round(v * 10) / 10 : Math.round(v))} /></b> кг</span>
        </li>
      )}
      {m3 > 0 && (
        <li>
          <Icon name="cube" size={18} />
          <span>≈ <b><Rolling value={m3} format={(v) => n(Math.round(v * 100) / 100 || 0.01)} /></b> м³</span>
        </li>
      )}
    </ul>
  );
}

/** «Не забудьте крышки»: к основаниям в корзине — крышки той же модели или того же размера. */
function LidHints({ items, onNavigate }: { items: CartItem[]; onNavigate?: () => void }) {
  const [lids, setLids] = useState<Record<string, string[]> | null>(null);
  const st = useStore(cartStore, (s) => s);
  const { key, params } = useCatalogParams();
  useEffect(() => {
    import('../lib/lids').then((m) => setLids(m.LIDS)).catch(() => setLids({}));
  }, []);
  // крышки ко всем основаниям в корзине (запрос не меняется, когда крышку добавили)
  const forBase = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of items) for (const id of lids?.[i.product.id] ?? []) if (!m.has(id)) m.set(id, i.product.info.title);
    return m;
  }, [items, lids]);
  const ids = [...forBase.keys()].slice(0, 8);
  const q = useQuery(ids.length ? `lids:${key}:${ids.join(',')}` : 'lids:none', () =>
    Promise.all(ids.map((id) => api.getProduct(id, params).catch(() => null))),
  );
  const shown = (q.data ?? [])
    .filter((p): p is Product => !!p && inStock(p) && qtyIn(st, p.id) === 0 && forBase.has(p.id))
    .slice(0, 3);
  if (!shown.length) return null;
  return (
    <section className="lids" aria-labelledby="lids-title">
      <h3 id="lids-title" className="lids__title">
        <Icon name="info" size={18} /> Не забудьте крышки
      </h3>
      <p className="lids__lead">Подходят по модели или размеру к товарам в вашей корзине</p>
      <ul className="lids__list" role="list">
        {shown.map((p) => (
          <li key={p.id} className="lid">
            <Link to={`/product/${p.id}`} className="lid__img" onClick={onNavigate} tabIndex={-1} aria-hidden="true">
              {p.info.imageUrls[0] && <img loading="lazy" alt="" width={48} height={48} src={imgUrl(p.info.imageUrls[0], 180)} />}
            </Link>
            <div className="lid__info">
              <Link to={`/product/${p.id}`} className="lid__name" onClick={onNavigate}>{p.info.title}</Link>
              <span className="lid__for">к «{clip(forBase.get(p.id) ?? '', 34)}»</span>
              <span className="lid__price mono">{money(p.finalPrice)}/{unitOf(p)}</span>
            </div>
            <div className="lid__ctl">
              <AddControl product={p} label="Добавить" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PromoField() {
  const promo = useStore(cartStore, (s) => s.cart?.price.promoCode ?? null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (promo)
    return (
      <div className="promo promo--on">
        <span className="promo__chip">
          <Icon name="check" size={16} /> Промокод {promo}
        </span>
        <button type="button" className="link" onClick={() => removePromo(promo).catch((e) => toast(errorText(e), 'error'))}>
          Удалить промокод
        </button>
      </div>
    );
  return (
    <form
      className="promo"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!code.trim()) return;
        setBusy(true);
        setErr(null);
        try {
          const r = await applyPromo(code.trim());
          if (r?.appMessage?.text || r?.appMessage?.title) setErr(r.appMessage.text || r.appMessage.title || null);
          else if (!r?.cart?.price.promoCode) setErr('Промокод не применён');
          else setCode('');
        } catch (e2) {
          setErr(errorText(e2));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="sr-only" htmlFor="promo-in">Промокод</label>
      <input id="promo-in" className="input promo__in" placeholder="Промокод" value={code} onChange={(e) => setCode(e.target.value)} aria-invalid={!!err} aria-describedby={err ? 'promo-err' : undefined} />
      <button type="submit" className="btn btn--ghost" disabled={busy || !code.trim()}>
        Применить
      </button>
      {err && <p id="promo-err" className="field__error promo__err">{err}</p>}
    </form>
  );
}

/** Корзина: в выезжающей панели (одна колонка, кнопка оформления прилипает к низу) и на странице /cart (итог справа). */
export function CartView({ onNavigate, page }: { onNavigate?: () => void; page?: boolean }) {
  const st = useStore(cartStore, (x) => x);
  const s = useStore(sessionStore, (x) => x);
  const nav = useNavigate();
  const addr = activeAddress(s);
  const [confirmClear, setConfirmClear] = useState(false);

  if (!s.addressesLoaded || (addr && !st.loaded)) {
    return <div className="cart-state"><span className="spinner" /></div>;
  }

  const items = (st.cart?.items ?? []).filter((i) => qtyIn(st, i.product.id) > 0);
  const pendingNew = Object.entries(st.local).filter(([id, q]) => q > 0 && !st.cart?.items.some((i) => i.product.id === id));

  if (!addr || (!items.length && !pendingNew.length)) {
    return (
      <div className="cart-empty">
        <EmptyBox className="cart-empty__art" />
        <h2>{addr ? 'Корзина пуста' : 'Куда доставить товары?'}</h2>
        <p className="muted">
          {addr ? 'Наполните свою корзину подходящими товарами из нашего каталога' : 'От указанного адреса и способа получения зависят ассортимент и время доставки'}
        </p>
        {addr ? (
          <div className="cart-empty__cta">
            <Link to="/" className="btn" onClick={onNavigate}>
              Перейти в каталог
            </Link>
            <Link to="/podbor" className="btn btn--ghost" onClick={onNavigate}>
              <Icon name="box" /> Подобрать комплект
            </Link>
          </div>
        ) : (
          <button type="button" className="btn" onClick={() => openAddress()}>
            Выбрать адрес
          </button>
        )}
      </div>
    );
  }

  const cart = st.cart;
  const price = cart?.price;
  const info = cart?.deliveryPriceInfo;
  const total = cartTotal(st);
  const min = info?.minOrderPrice ?? 0;
  const below = min > 0 && total < min;
  const unavailable = items.filter((i) => !inStock(i.product));
  const syncing = Object.keys(st.local).length > 0;
  const isPickup = !!addr.namedAddress.departmentId;
  const finalSum = syncing ? total : price?.final ?? total;

  const goCheckout = () => {
    if (!isAuthorized(sessionStore.get())) {
      openAuth('/checkout');
      return;
    }
    setCartOpen(false);
    onNavigate?.();
    nav('/checkout');
  };

  return (
    <div className={`cartv${page ? ' cartv--page' : ''}`}>
      <div className="cartv__main">
        <button type="button" className="cartv__addr" onClick={() => openAddress(null, isPickup ? 'pickup' : 'delivery')}>
          <Icon name={isPickup ? 'store' : 'truck'} />
          <span>
            <span className="label">{isPickup ? 'Адрес самовывоза' : 'Адрес доставки'}</span>
            <span className="cartv__addr-val">{addr.namedAddress.name || shortAddress(addr.namedAddress.address)}</span>
          </span>
          <span className="link">Изменить</span>
        </button>

        {unavailable.length > 0 && (
          <div className="notice notice--warn">
            <Icon name="alert" />
            <div>
              <p>Часть товара закончилось</p>
              <button type="button" className="link" onClick={() => removeUnavailable().catch((e) => toast(errorText(e), 'error'))}>
                Убрать отсутствующие товары из корзины
              </button>
            </div>
          </div>
        )}

        <div className="cartv__head">
          <h2 className="cartv__h">
            Товары <span className="mono">{n(items.length + pendingNew.length)}</span>
          </h2>
          {confirmClear ? (
            <div className="cartv__confirm" role="alertdialog" aria-label="Удаление корзины">
              <span>Удалить все товары?</span>
              <button type="button" className="btn btn--danger btn--sm" onClick={() => { setConfirmClear(false); clearCartAll(); }}>
                Очистить
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmClear(false)}>
                Отмена
              </button>
            </div>
          ) : (
            <button type="button" className="cartv__clear" onClick={() => setConfirmClear(true)}>
              <Icon name="trash" size={18} /> Очистить
            </button>
          )}
        </div>

        <ul className="cartv__list">
          {items.map((i) => (
            <CartLine key={i.id} item={i} onNavigate={onNavigate} />
          ))}
          {pendingNew.map(([id]) => {
            const p = st.products[id];
            return p ? <li key={id} className="cline cline--pending"><span className="spinner" /> <span className="cline__title">{p.info.title}</span></li> : null;
          })}
        </ul>

        <LidHints items={items} onNavigate={onNavigate} />
      </div>

      <aside className="cartv__side" aria-label="Итог заказа">
        <div className="cartv__sum">
          <PromoField />

          <dl className="summary">
            <div>
              <dt>Товары, {goodsCount(items.length)}</dt>
              <dd>{money(price?.totalForItems ?? total)}</dd>
            </div>
            {!!price?.discount && (
              <div className="summary__discount">
                <dt>Скидка:</dt>
                <dd>−{money(price.discount)}</dd>
              </div>
            )}
            {price?.deliveryPrice != null && !isPickup && (
              <div>
                <dt>Доставка:</dt>
                <dd>{price.deliveryPrice > 0 ? money(price.deliveryPrice) : 'Бесплатно'}</dd>
              </div>
            )}
            <div className="summary__total">
              <dt>Итого:</dt>
              <dd>
                <Rolling value={finalSum} format={money} />
                {syncing && <span className="spinner summary__sync" aria-label="Пересчёт" />}
              </dd>
            </div>
          </dl>

          <Passport items={items} st={st} />

          {!isPickup && !!info?.freeDeliveryPrice && total < info.freeDeliveryPrice && (
            <p className="cartv__free mono">Бесплатная доставка от {money(info.freeDeliveryPrice)}</p>
          )}
          <MinOrderMeter total={total} min={min} />
        </div>

        <div className="cartv__bar">
          <button type="button" className="btn btn--lg btn--block cartv__cta" disabled={below || syncing || unavailable.length > 0} onClick={goCheckout}>
            <span>Оформить заказ</span>
            <span className="cartv__cta-sum">{money(finalSum)}</span>
            <Icon name="arrowRight" />
          </button>
        </div>
      </aside>
    </div>
  );
}
