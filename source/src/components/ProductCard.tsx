import { memo, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Product } from '../api/types';
import { Icon } from './Icon';
import { useStore } from '../lib/store';
import { cartStore, qtyIn, setQty } from '../store/cart';
import { activeAddress, sessionStore } from '../store/session';
import { hasDiscount, inStock, maxQty, money, n, stepOf, stockLine, unitOf } from '../lib/format';
import { imgSrcSet, imgUrl } from '../lib/img';
import { burst, flyToCart, markMorph } from '../lib/motion';
import { seedQuery } from '../lib/query';
import { catalogKey } from '../store/session';
import { LazyImg } from './LazyImg';
import './product-card.css';

const CARD_SIZES = '(min-width: 1280px) 220px, (min-width: 768px) 30vw, 45vw';

/** Число в степпере «прокручивается» вверх/вниз при изменении, как на счётчике. */
function Ticker({ value, unit }: { value: number; unit: string }) {
  const prev = useRef(value);
  const dir = value >= prev.current ? 'up' : 'down';
  useEffect(() => {
    prev.current = value;
  }, [value]);
  return (
    <output className="stepper__val" aria-live="polite">
      <span key={value} className={`ticker ticker--${dir}`}>{n(value)}</span> <small>{unit}</small>
    </output>
  );
}

/** «В корзину» → степпер с шагом кратности. */
export function AddControl({ product, size = 'md', label = 'В корзину' }: { product: Product; size?: 'md' | 'lg'; label?: string }) {
  const qty = useStore(cartStore, (s) => qtyIn(s, product.id));
  const btn = useRef<HTMLButtonElement>(null);
  const [justAdded, setJustAdded] = useState(false);
  const step = stepOf(product);
  const unit = unitOf(product);
  const max = maxQty(product);
  const available = inStock(product) && max > 0;

  useEffect(() => {
    if (!justAdded) return;
    const t = window.setTimeout(() => setJustAdded(false), 1100);
    return () => window.clearTimeout(t);
  }, [justAdded]);

  if (!available && qty === 0) {
    return (
      <button type="button" className={`addctl addctl--${size} addctl--off`} disabled>
        Нет в наличии
      </button>
    );
  }
  if (qty === 0) {
    return (
      <button
        ref={btn}
        type="button"
        className={`addctl addctl--${size} addctl--add`}
        onClick={(e) => {
          // Анимации — только если товар реально ляжет в корзину (без адреса сначала откроется выбор адреса)
          if (activeAddress(sessionStore.get())) {
            burst(e.clientX || undefined, e.clientY || undefined, btn.current);
            flyToCart(btn.current);
            setJustAdded(true);
          }
          setQty(product, step);
        }}
      >
        <span className="addctl__icon" aria-hidden="true">
          <Icon name="plus" size={16} strokeWidth={2.6} />
        </span>
        <span className="addctl__label">{label}</span>
      </button>
    );
  }
  return (
    <div className={`stepper stepper--${size}${justAdded ? ' is-added' : ''}`} role="group" aria-label={`Количество: ${product.info.title}`}>
      <button type="button" className="stepper__btn" onClick={() => setQty(product, qty - step)} aria-label={qty - step <= 0 ? 'Убрать товар из корзины' : `Уменьшить на ${n(step)} ${unit}`}>
        <Icon name={qty - step <= 0 ? 'trash' : 'minus'} size={18} strokeWidth={2.2} />
      </button>
      <Ticker value={qty} unit={unit} />
      <button
        type="button"
        className="stepper__btn"
        onClick={(e) => {
          if (qty + step <= max) flyToCart(e.currentTarget);
          setQty(product, qty + step);
        }}
        disabled={qty + step > max}
        aria-label={`Добавить ${n(step)} ${unit}`}
      >
        <Icon name="plus" size={18} strokeWidth={2.2} />
      </button>
      {justAdded && (
        <span className="stepper__done" aria-hidden="true">
          <Icon name="check" size={18} strokeWidth={2.6} /> Добавлено
        </span>
      )}
    </div>
  );
}

export function PriceTag({ product, big }: { product: Product; big?: boolean }) {
  const unit = unitOf(product);
  const step = stepOf(product);
  return (
    <div className={`price${big ? ' price--big' : ''}`}>
      <div className="price__main">
        <b>{money(product.finalPrice)}</b>
        <span className="price__unit">/{unit}</span>
        {hasDiscount(product) && <s className="price__old">{money(product.price)}</s>}
      </div>
      {step > 1 && (
        <div className="price__pack mono">
          {money(product.finalPrice * step)} / {n(step)} {unit}
        </div>
      )}
    </div>
  );
}

function ProductCardImpl({ product, categoryId, priority }: { product: Product; categoryId?: string; priority?: boolean }) {
  const img = product.info.imageUrls[0];
  const off = !inStock(product);
  const discount = hasDiscount(product) ? Math.round((1 - product.finalPrice / product.price) * 100) : 0;
  return (
    <article className={`pcard${off ? ' is-off' : ''}`}>
      <div className="pcard__media">
        {img ? (
          priority ? (
            <img loading="eager" srcSet={imgSrcSet(img)} sizes={CARD_SIZES} alt="" width={180} height={180} decoding="async" {...{ fetchpriority: 'high' }} src={imgUrl(img, 180)} />
          ) : (
            <LazyImg srcSet={imgSrcSet(img)} sizes={CARD_SIZES} alt="" width={180} height={180} src={imgUrl(img, 180)} />
          )
        ) : (
          <span className="pcard__noimg"><Icon name="box" size={40} /></span>
        )}
        {discount > 0 && <span className="pcard__sale">−{discount}%</span>}
        {!!product.chestnyZnak && <span className="pcard__cz" title="Товар подлежит маркировке в национальной системе «Честный ЗНАК»">Честный ЗНАК</span>}
      </div>
      <div className="pcard__body">
        <h3 className="pcard__title">
          <Link
            to={`/product/${product.id}`}
            state={categoryId ? { categoryId } : undefined}
            onClick={(e) => {
              // страница товара открывается сразу с тем, что уже известно, а фото перелетает на неё из карточки
              seedQuery(`product:${product.id}:${catalogKey(sessionStore.get())}`, product);
              markMorph(product.id, (e.currentTarget as HTMLElement).closest('.pcard')?.querySelector<HTMLElement>('.pcard__media img') ?? null);
            }}
          >
            {product.info.title}
          </Link>
        </h3>
        <p className="pcard__stock mono">{stockLine(product)}</p>
      </div>
      <div className="pcard__stub">
        <PriceTag product={product} />
        <AddControl product={product} />
      </div>
    </article>
  );
}

export const ProductCard = memo(ProductCardImpl);

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="pgrid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="pcard pcard--skel">
          <div className="skeleton" style={{ aspectRatio: '1', borderRadius: 14 }} />
          <div className="skeleton" style={{ height: 16, marginTop: 14, width: '90%' }} />
          <div className="skeleton" style={{ height: 16, marginTop: 8, width: '60%' }} />
          <div className="skeleton" style={{ height: 44, marginTop: 18, borderRadius: 999 }} />
        </div>
      ))}
    </div>
  );
}
