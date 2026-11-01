import { useEffect, useRef, useState } from 'react';
import { reducedMotion } from '../lib/motion';

/** Число плавно «докручивается» до нового значения (суммы, вес, объём). */
export function Rolling({ value, format }: { value: number; format: (v: number) => string }) {
  const [shown, setShown] = useState(value);
  const cur = useRef(value);
  useEffect(() => {
    if (reducedMotion()) {
      cur.current = value;
      return setShown(value);
    }
    const start = performance.now();
    const a = cur.current; // прерванная анимация продолжается с того места, где была
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 420);
      cur.current = a + (value - a) * (1 - Math.pow(1 - k, 3));
      setShown(cur.current);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(shown)}</>;
}
