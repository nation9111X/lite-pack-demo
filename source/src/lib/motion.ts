import { useEffect } from 'react';

export const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Фото перелетает из карточки на страницу товара: имя перехода получает только нажатая картинка.
let morphId: string | null = null;
export function markMorph(id: string, img: HTMLElement | null) {
  if (!img || reducedMotion() || !('startViewTransition' in document)) return;
  morphId = id;
  img.style.setProperty('view-transition-name', 'pphoto');
  window.setTimeout(() => {
    img.style.removeProperty('view-transition-name');
    morphId = null;
  }, 900);
}
export const morphName = (id: string) => (morphId === id ? 'pphoto' : undefined);

/** Крафтовый мини-короб летит из кнопки в корзину (Web Animations API). */
export function flyToCart(from: Element | null) {
  if (!from || reducedMotion()) return;
  try {
    navigator.vibrate?.(10); // короткий отклик на Android
  } catch {
    /* не поддерживается */
  }
  const target = Array.from(document.querySelectorAll<HTMLElement>('[data-cart-target]')).find((el) => el.getClientRects().length > 0);
  if (!target) return;
  const a = from.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'fly-parcel';
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);
  const x0 = a.left + a.width / 2 - 14;
  const y0 = a.top + a.height / 2 - 14;
  const x1 = b.left + b.width / 2 - 14;
  const y1 = b.top + b.height / 2 - 14;
  const mx = (x0 + x1) / 2;
  const my = Math.min(y0, y1) - 120;
  const anim = el.animate(
    [
      { transform: `translate(${x0}px, ${y0}px) rotate(0deg) scale(1)`, opacity: 1 },
      { transform: `translate(${mx}px, ${my}px) rotate(-18deg) scale(1.15)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${x1}px, ${y1}px) rotate(8deg) scale(0.55)`, opacity: 0.2 },
    ],
    { duration: 640, easing: 'cubic-bezier(.2,.8,.2,1)' },
  );
  anim.onfinish = () => el.remove();
}

/** Разлёт крафтовых и зелёных «конфетти» из точки нажатия (Web Animations API, только transform/opacity). */
export function burst(x?: number, y?: number, from?: Element | null) {
  if (reducedMotion()) return;
  if (x === undefined || y === undefined) {
    const r = from?.getBoundingClientRect();
    if (!r) return;
    x = r.left + r.width / 2;
    y = r.top + r.height / 2;
  }
  const colors = ['#c9a57a', '#9c7a52', '#19b236', '#00671e', '#dcc19b'];
  for (let i = 0; i < 14; i++) {
    const el = document.createElement('i');
    el.className = 'burst-bit';
    el.setAttribute('aria-hidden', 'true');
    const size = 5 + Math.random() * 6;
    el.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size * (Math.random() > 0.5 ? 1 : 0.45)}px;background:${colors[i % colors.length]}`;
    document.body.appendChild(el);
    const ang = (Math.PI * 2 * i) / 14 + Math.random() * 0.4;
    const dist = 40 + Math.random() * 46;
    const dx = Math.cos(ang) * dist;
    const dy = Math.sin(ang) * dist - 24;
    el.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.4) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1) rotate(${Math.random() * 360}deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(calc(-50% + ${dx * 1.15}px), calc(-50% + ${dy + 40}px)) scale(0.6) rotate(${Math.random() * 540}deg)`, opacity: 0 },
      ],
      { duration: 700 + Math.random() * 250, easing: 'cubic-bezier(.2,.8,.2,1)' },
    ).onfinish = () => el.remove();
  }
}

/** Появление элементов при прокрутке. Без JS контент виден: класс .reveal ставит скрипт. */
export function useReveal(deps: unknown[] = []) {
  useEffect(() => {
    if (reducedMotion() || !('IntersectionObserver' in window)) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-in)'));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    els.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight) return; // уже на экране — не прячем
      el.classList.add('reveal');
      io.observe(el);
    });
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Переход между страницами через View Transitions API, если он есть. */
export function withViewTransition(fn: () => void) {
  const d = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (d.startViewTransition && !reducedMotion()) d.startViewTransition(fn);
  else fn();
}
