import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Product } from '../api/types';
import { useCategory } from '../hooks/data';
import { hasDiscount, inStock, money } from '../lib/format';
import { imgUrl } from '../lib/img';
import { markMorph, reducedMotion } from '../lib/motion';
import { seedQuery } from '../lib/query';
import { currentScrollY, onScrollY } from '../lib/smooth';
import { buzz } from '../lib/alive';
import { catalogKey, sessionStore } from '../store/session';
import { Icon } from './Icon';
import { LazyImg } from './LazyImg';
import { AddControl, PriceTag } from './ProductCard';
import './conveyor.css';

// Бумажные стаканы, бумажные контейнеры, коробки для пиццы: товары и цены живые, для выбранного региона
const SOURCES = ['0d140123-f974-4ee9-b5f0-1aa8a868733b', '8b23600b-d61b-415f-85b9-952b011d7932', '2e332285-a81a-4bf2-a932-62d96c1b2231'];
const PER_SOURCE = 4;
const ROLLERS = Array.from({ length: 13 }, (_, i) => i);
/** Сколько товаров проезжает под прессом, пока лента пересекает экран при прокрутке. */
const SCROLL_SPAN = 5;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Товары из разных разделов вперемешку: только те, что есть в наличии и с фото. */
function mix(lists: (Product[] | undefined)[]) {
  const picked = lists.map((l) => (l ?? []).filter((p) => inStock(p) && p.info.imageUrls[0]).slice(0, PER_SOURCE));
  const out: Product[] = [];
  for (let i = 0; i < PER_SOURCE; i++) picked.forEach((l) => l[i] && out.push(l[i]));
  return out;
}

/** Страница товара открывается сразу с тем, что уже известно, а фото перелетает на неё. */
function openProduct(p: Product, img: HTMLElement | null) {
  seedQuery(`product:${p.id}:${catalogKey(sessionStore.get())}`, p);
  markMorph(p.id, img);
}

const Plate = memo(function Plate({ product, onClick }: { product: Product; onClick: (e: { currentTarget: EventTarget; preventDefault(): void }, p: Product) => void }) {
  return (
    <Link to={`/product/${product.id}`} className="conv__item" tabIndex={-1} aria-hidden="true" draggable={false} onClick={(e) => onClick(e, product)}>
      <LazyImg alt="" width={180} height={180} draggable={false} src={imgUrl(product.info.imageUrls[0], 180)} />
      <span className="conv__price">{money(product.finalPrice)}</span>
      {hasDiscount(product) && <span className="conv__sale">скидка</span>}
    </Link>
  );
});

/**
 * Конвейер на главной: настоящие товары едут по ленте от прокрутки или пальца, пресс ставит на них цену.
 * Цикл работает только пока лента движется; в покое страница свободна. Движется один элемент (transform), поэтому легко.
 */
export function Conveyor() {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const rollers = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLSpanElement>(null);
  const ink = useRef<HTMLSpanElement>(null);
  const move = useRef<(d: number) => void>(() => {});
  const dragged = useRef(false);
  const [near, setNear] = useState(false);
  const [at, setAt] = useState(0);

  // Запросы — когда лента подъезжает к экрану: первый экран их не ждёт
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      setNear(true);
      io.disconnect();
    }, { rootMargin: '700px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const a = useCategory(near ? SOURCES[0] : undefined);
  const b = useCategory(near ? SOURCES[1] : undefined);
  const c = useCategory(near ? SOURCES[2] : undefined);
  const items = useMemo(() => mix([a.data?.products, b.data?.products, c.data?.products]), [a.data, b.data, c.data]);
  const count = items.length;
  const failed = near && !count && !a.loading && !b.loading && !c.loading;

  useEffect(() => {
    const sec = root.current, st = stage.current, tr = track.current, sf = surface.current, ro = rollers.current;
    if (!sec || !st || !tr || !sf || !ro || !count) return;
    const reduce = reducedMotion();
    const last = count - 1;
    let top = 0, secH = 1, vh = 700, pitch = 160, x0 = 0;
    let pos = 0, manual = 0, scrollPart = 0, target = 0, stamped = -1, raf = 0, snapTimer = 0, touching = false;
    const plate = (i: number) => tr.children[i] as HTMLElement | undefined;

    const write = () => {
      tr.style.transform = `translate3d(${(x0 - pos * pitch).toFixed(1)}px,0,0)`;
      sf.style.transform = `translate3d(${(-(pos * pitch) % 24).toFixed(1)}px,0,0)`;
      ro.style.setProperty('--r', `${(-pos * pitch * 1.4).toFixed(0)}deg`);
    };
    const stamp = (i: number) => {
      stamped = i;
      setAt(i);
      for (let k = 0; k < count; k++) plate(k)?.classList.toggle('is-at', k === i);
      const el = plate(i);
      el?.classList.add('is-stamped');
      if (reduce) return;
      head.current?.animate(
        [{ transform: 'translateY(0)' }, { transform: 'translateY(var(--stroke))', offset: 0.42 }, { transform: 'translateY(var(--stroke))', offset: 0.55 }, { transform: 'translateY(0)' }],
        { duration: 340, easing: 'cubic-bezier(.4,0,.2,1)' },
      );
      ink.current?.animate([{ transform: 'scale(.4)', opacity: 0.55 }, { transform: 'scale(1.5)', opacity: 0 }], { duration: 380, delay: 130, easing: 'ease-out' });
      el?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.05,.95)', offset: 0.5 }, { transform: 'scale(1)' }], { duration: 300, delay: 120, easing: 'ease-out' });
      if (touching) buzz(6);
    };
    const tick = () => {
      raf = 0;
      pos += (target - pos) * (touching ? 0.3 : 0.14);
      const settled = Math.abs(target - pos) < 0.002;
      if (settled) pos = target;
      write();
      const i = Math.round(pos);
      if (i !== stamped && Math.abs(pos - i) < 0.14) stamp(i);
      if (!settled) raf = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const aim = () => {
      const t = manual + scrollPart;
      const c0 = clamp(t, 0, last);
      manual += c0 - t; // упёрлись в край ленты: запас прокрутки не копится
      target = c0;
      wake();
    };
    // Остановились: товар встаёт точно под пресс
    const snapLater = () => {
      window.clearTimeout(snapTimer);
      snapTimer = window.setTimeout(() => {
        manual += Math.round(target) - target;
        aim();
      }, 130);
    };
    const measure = () => {
      const r = sec.getBoundingClientRect();
      top = r.top + currentScrollY();
      secH = r.height || 1;
      vh = window.innerHeight || 700;
      const first = plate(0), second = plate(1);
      if (first) {
        pitch = second ? second.offsetLeft - first.offsetLeft : first.offsetWidth + 16;
        x0 = st.clientWidth / 2 - first.offsetLeft - first.offsetWidth / 2;
      }
    };
    const fromScroll = (y: number) => {
      const p = clamp((y + vh - top) / (vh + secH), 0, 1);
      scrollPart = p * Math.min(SCROLL_SPAN, last);
    };
    const onScroll = (y: number) => {
      if (y + vh < top - 300 || y > top + secH + 300) return;
      fromScroll(y);
      aim();
      snapLater();
    };
    const ro2 = new ResizeObserver(() => {
      measure();
      if (!reduce) fromScroll(currentScrollY());
      aim();
      write();
    });
    ro2.observe(st);
    ro2.observe(document.body);
    measure();
    if (reduce) items.forEach((_, i) => plate(i)?.classList.add('is-stamped'));
    else fromScroll(currentScrollY());
    target = pos = clamp(Math.round(scrollPart), 0, last);
    manual = target - scrollPart;
    write();
    stamp(target);
    const off = reduce ? () => {} : onScrollY(onScroll);

    // Палец и мышь: вбок двигают ленту, вертикальная прокрутка остаётся за браузером (touch-action)
    let startX = 0, lastX = 0, speed = 0, down = false;
    const onDown = (e: PointerEvent) => {
      down = true;
      touching = e.pointerType !== 'mouse';
      startX = lastX = e.clientX;
      speed = 0;
      dragged.current = false;
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      if (Math.abs(e.clientX - startX) > 6) dragged.current = true;
      speed = dx;
      manual -= dx / pitch;
      aim();
    };
    const onUp = () => {
      if (!down) return;
      down = false;
      manual -= (speed * 7) / pitch; // инерция броска
      aim();
      touching = false;
      snapLater();
    };
    st.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', onUp, { passive: true });

    move.current = (d) => {
      manual += d;
      aim();
      snapLater();
    };

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(snapTimer);
      ro2.disconnect();
      off();
      st.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [items, count]);

  const onPlate = useRef((e: { currentTarget: EventTarget; preventDefault(): void }, p: Product) => {
    if (dragged.current) {
      e.preventDefault();
      return;
    }
    openProduct(p, (e.currentTarget as HTMLElement).querySelector('img'));
  }).current;

  const plates = useMemoPlates(items, onPlate);
  if (failed) return null;
  const current = items[Math.min(at, count - 1)];

  return (
    <section className="conv" aria-labelledby="conv-title" ref={root}>
      <div className="container section__head">
        <h2 className="section__title" id="conv-title">Товары на ленте</h2>
        {count > 1 && (
          <div className="conv__navs">
            <button type="button" className="conv__nav conv__nav--prev" aria-label="Предыдущий товар" disabled={at === 0} onClick={() => move.current(-1)}>
              <Icon name="arrowRight" size={20} />
            </button>
            <button type="button" className="conv__nav conv__nav--next" aria-label="Следующий товар" disabled={at === count - 1} onClick={() => move.current(1)}>
              <Icon name="arrowRight" size={20} />
            </button>
          </div>
        )}
      </div>
      <div className="conv__stage" ref={stage}>
        <div className="conv__press" aria-hidden="true">
          <span className="conv__head" ref={head}><Icon name="box" size={20} /></span>
        </div>
        <span className="conv__ink" ref={ink} aria-hidden="true" />
        <div className="conv__track" ref={track}>
          {count ? plates : Array.from({ length: 5 }, (_, i) => <div key={i} className="conv__item skeleton" />)}
        </div>
        <div className="conv__belt" aria-hidden="true"><div className="conv__surface" ref={surface} /></div>
        <div className="conv__rollers" ref={rollers} aria-hidden="true">{ROLLERS.map((i) => <i key={i} />)}</div>
      </div>
      <div className="container conv__read" aria-live="polite">
        {current ? (
          <div className="conv__card" key={current.id}>
            <h3 className="conv__title">
              <Link to={`/product/${current.id}`} onClick={() => openProduct(current, stage.current?.querySelector('.conv__item.is-at img') ?? null)}>
                {current.info.title}
              </Link>
            </h3>
            <PriceTag product={current} />
            <AddControl product={current} />
          </div>
        ) : (
          <div className="conv__card" aria-hidden="true">
            <div className="skeleton conv__title-skel" />
          </div>
        )}
      </div>
    </section>
  );
}

function useMemoPlates(items: Product[], onPlate: (e: { currentTarget: EventTarget; preventDefault(): void }, p: Product) => void) {
  return useMemo(() => items.map((p) => <Plate key={p.id} product={p} onClick={onPlate} />), [items, onPlate]);
}
