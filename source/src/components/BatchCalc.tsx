import { useRef, useState } from 'react';
import type { Product } from '../api/types';
import { Icon } from './Icon';
import { maxQty, money, n, perUnit, stepOf, unitOf } from '../lib/format';
import { Rolling } from './Rolling';
import { setQty } from '../store/cart';
import { activeAddress, sessionStore } from '../store/session';
import { toast } from '../store/ui';
import { burst, flyToCart } from '../lib/motion';
import './batch-calc.css';

/**
 * Калькулятор партии: сколько упаковок взять под нужное количество, сколько это стоит,
 * сколько весит и сколько места займёт. Все цифры — из данных товара (цена региона, кратность, packageInfo).
 */
export function BatchCalc({ product }: { product: Product }) {
  const step = stepOf(product);
  const unit = unitOf(product);
  const max = maxQty(product);
  const [need, setNeed] = useState(step > 1 ? step * 10 : 100);
  const btn = useRef<HTMLButtonElement>(null);

  const packs = Math.max(1, Math.ceil(need / step));
  const units = packs * step;
  const total = units * product.finalPrice;
  const pkg = product.info.packageInfo;
  const kgPer = perUnit(pkg?.weight);
  const m3Per = perUnit(pkg?.volume);
  const over = units > max;
  const presets = [100, 500, 1000, 5000].map((x) => Math.ceil(x / step) * step).filter((x, i, a) => a.indexOf(x) === i);

  const add = () => {
    const qty = Math.min(units, max);
    if (qty <= 0) return;
    if (activeAddress(sessionStore.get())) {
      burst(undefined, undefined, btn.current);
      flyToCart(btn.current);
      toast(`В корзине ${n(qty)} ${unit}`, 'ok');
    }
    setQty(product, qty);
  };

  return (
    <section className="calc" aria-labelledby="calc-title">
      <header className="calc__head">
        <span className="calc__icon" aria-hidden="true"><Icon name="calc" size={22} /></span>
        <div>
          <h2 id="calc-title" className="calc__title">Калькулятор партии</h2>
          <p className="muted">Округлим до целых упаковок{step > 1 ? ` по ${n(step)} ${unit}` : ''} и посчитаем вес и объём</p>
        </div>
      </header>

      <div className="calc__input">
        <label htmlFor="calc-need" className="field__label">Сколько нужно, {unit}</label>
        <div className="calc__row">
          <button type="button" className="icon-btn calc__pm" aria-label="Меньше" onClick={() => setNeed((v) => Math.max(1, v - step))}>
            <Icon name="minus" />
          </button>
          <input
            id="calc-need"
            className="input calc__num"
            type="number"
            inputMode="numeric"
            min={1}
            value={need}
            onChange={(e) => setNeed(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
          />
          <button type="button" className="icon-btn calc__pm" aria-label="Больше" onClick={() => setNeed((v) => v + step)}>
            <Icon name="plus" />
          </button>
        </div>
        <div className="calc__presets">
          {presets.map((p) => (
            <button key={p} type="button" className={`chip${p === need ? ' is-on' : ''}`} onClick={() => setNeed(p)}>
              {n(p)}
            </button>
          ))}
        </div>
      </div>

      <dl className="calc__out">
        <div>
          <dt>Упаковок</dt>
          <dd><Rolling value={packs} format={(v) => n(Math.round(v))} /></dd>
        </div>
        <div>
          <dt>Итого, {unit}</dt>
          <dd><Rolling value={units} format={(v) => n(Math.round(v))} /></dd>
        </div>
        {kgPer && (
          <div>
            <dt>Вес</dt>
            <dd>≈ <Rolling value={units * kgPer} format={(v) => n(Math.round(v * 10) / 10)} /> {pkg?.weight?.unit ?? 'кг'}</dd>
          </div>
        )}
        {m3Per && (
          <div>
            <dt>Объём</dt>
            <dd>≈ <Rolling value={units * m3Per} format={(v) => n(Math.round(v * 1000) / 1000)} /> {pkg?.volume?.unit ?? 'м³'}</dd>
          </div>
        )}
        <div className="calc__sum">
          <dt>Стоимость</dt>
          <dd><Rolling value={total} format={(v) => money(Math.round(v * 100) / 100)} /></dd>
        </div>
      </dl>

      {over && (
        <p className="notice notice--warn calc__warn">
          <Icon name="alert" /> Сейчас в наличии {n(max)} {unit} — в корзину положим доступное количество.
        </p>
      )}
      <button ref={btn} type="button" className="btn btn--lg btn--block" onClick={add} disabled={max <= 0} data-magnetic>
        <Icon name="box" /> Положить {n(Math.min(units, max))} {unit} в корзину
      </button>
    </section>
  );
}
