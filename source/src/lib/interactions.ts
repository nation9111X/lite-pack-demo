import { reducedMotion } from './motion';
import { currentScrollY } from './smooth';

// Глобальные «живые» эффекты через делегирование событий — без обработчиков на каждом элементе.
//  • волна от точки нажатия на кнопках (везде, включая тач);
//  • «магнитные» кнопки [data-magnetic] слегка тянутся к курсору;
//  • карточки и плитки наклоняются за курсором (лёгкий 3D).

const RIPPLE = '.btn, .addctl, .chip, .seg__btn, .stepper__btn, .cart-btn, .region__opt, .maker, .mchip, .scn__tile, .opt';
const TILT = '.pcard, .ctile, .stile, .subtile, .gallery__stage';

let started = false;

// Размеры элемента под курсором меряем один раз — при входе на него или после прокрутки, —
// а не на каждое движение мыши: getBoundingClientRect посреди кадра заставляет пересчитывать раскладку.
type Cached = { el: Element | null; r: DOMRect | null; y: number };
const cMag: Cached = { el: null, r: null, y: 0 };
const cHero: Cached = { el: null, r: null, y: 0 };
const cTilt: Cached = { el: null, r: null, y: 0 };
function rectOf(c: Cached, el: Element) {
  const y = currentScrollY();
  if (c.el !== el || !c.r || c.y !== y) {
    c.el = el;
    c.r = el.getBoundingClientRect();
    c.y = y;
  }
  return c.r;
}

export function initInteractions() {
  if (started || typeof window === 'undefined') return;
  started = true;

  document.addEventListener(
    'pointerdown',
    (e) => {
      if (reducedMotion()) return;
      const t = (e.target as Element)?.closest?.(RIPPLE) as HTMLElement | null;
      if (!t || (t as HTMLButtonElement).disabled) return;
      const r = t.getBoundingClientRect();
      const size = Math.max(r.width, r.height) * 2.2;
      const s = document.createElement('span');
      s.className = 'ripple';
      s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
      t.appendChild(s);
      s.addEventListener('animationend', () => s.remove(), { once: true });
    },
    { passive: true },
  );

  if (reducedMotion() || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  let mag: HTMLElement | null = null;
  let tilt: HTMLElement | null = null;
  let last: PointerEvent | null = null;
  let raf = 0;

  const frame = () => {
    raf = 0;
    const e = last;
    if (!e) return;
    const el = e.target as Element;

    const m = el?.closest?.('[data-magnetic]') as HTMLElement | null;
    if (mag && mag !== m) mag.style.translate = '';
    mag = m;
    if (m) {
      const r = rectOf(cMag, m);
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      m.style.translate = `${(dx * 10).toFixed(1)}px ${(dy * 7).toFixed(1)}px`;
    }

    // подсветка печатной сетки первого экрана вокруг курсора
    const hero = el?.closest?.('.hero') as HTMLElement | null;
    if (hero) {
      const r = rectOf(cHero, hero);
      hero.style.setProperty('--hx', `${(e.clientX - r.left).toFixed(0)}px`);
      hero.style.setProperty('--hy', `${(e.clientY - r.top).toFixed(0)}px`);
    }

    const t = el?.closest?.(TILT) as HTMLElement | null;
    if (tilt && tilt !== t) {
      tilt.style.removeProperty('--tx');
      tilt.style.removeProperty('--ty');
      tilt.style.removeProperty('--gx');
      tilt.style.removeProperty('--gy');
      tilt.style.removeProperty('--px');
      tilt.style.removeProperty('--py');
    }
    tilt = t;
    if (t) {
      const r = rectOf(cTilt, t);
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      t.style.setProperty('--ty', `${((px - 0.5) * 7).toFixed(2)}deg`);
      t.style.setProperty('--tx', `${((0.5 - py) * 6).toFixed(2)}deg`);
      t.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
      t.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
      t.style.setProperty('--px', (px - 0.5).toFixed(3));
      t.style.setProperty('--py', (py - 0.5).toFixed(3));
    }
  };

  document.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      last = e;
      if (!raf) raf = requestAnimationFrame(frame);
    },
    { passive: true },
  );
  document.addEventListener('pointerleave', () => {
    if (mag) mag.style.translate = '';
    mag = null;
  });
}
