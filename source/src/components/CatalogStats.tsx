import { useEffect, useRef, useState } from 'react';
import { reducedMotion } from '../lib/motion';
import { n, plural } from '../lib/format';

declare const __STATS__: { products: number; makers: number; zones: number };
const STATS = typeof __STATS__ !== 'undefined' ? __STATS__ : { products: 0, makers: 0, zones: 0 };

/** Число докручивается от нуля, когда блок попадает на экран. */
function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [v, setV] = useState(value);
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion() || !value || !('IntersectionObserver' in window)) return;
    setV(0);
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, Math.max(0, (now - t0) / 1200));
        setV(Math.round(value * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value]);
  return <b ref={ref}>{n(v)}{suffix}</b>;
}

/** Цифры каталога: из снимка на момент сборки, товары — округлённо вниз до сотен. */
export function CatalogStats({ className = '' }: { className?: string }) {
  if (!STATS.products) return null;
  const products = Math.floor(STATS.products / 100) * 100;
  return (
    <ul className={`cstats ${className}`} role="list">
      <li><CountUp value={products} suffix="+" /><span>{plural(products, 'товар', 'товара', 'товаров')}</span></li>
      <li><CountUp value={STATS.makers} /><span>{plural(STATS.makers, 'бренд', 'бренда', 'брендов')} и заводов</span></li>
      <li><CountUp value={STATS.zones} /><span>{plural(STATS.zones, 'зона', 'зоны', 'зон')} доставки</span></li>
    </ul>
  );
}
