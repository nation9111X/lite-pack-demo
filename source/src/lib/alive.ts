import { reducedMotion } from './motion';
import { onScrollY } from './smooth';

// «Оживление» для телефона: всё, что на компьютере делает курсор, здесь делают палец и прокрутка.
//  • блоки появляются при прокрутке (единый наблюдатель на всю страницу);
//  • карточка наклоняется к пальцу при нажатии;
//  • картинки разделов плывут при прокрутке (CSS по прокрутке, а где его нет — лёгкая замена).

const REVEAL = '.stile, .subtile, .step, .office, .section__head, .apps__card, .podpromo, .mchip, .faq__item';
const PRESS = '.pcard, .ctile, .stile, .subtile, .gallery__stage, .maker, .step, .office, .scn__tile';

let started = false;

/** Короткий отклик вибрацией там, где телефон это умеет (Android; на iPhone браузер не даёт). */
export function buzz(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* не поддерживается */
  }
}

function initPress() {
  let cur: HTMLElement | null = null;
  const release = () => {
    cur?.classList.remove('is-press');
    cur = null;
  };
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'mouse') return;
      const target = e.target as Element;
      if (target.closest?.('button:not(.gallery__stage):not(.scn__tile), input, select, .stepper')) return; // у кнопок свой отклик
      const el = target.closest?.(PRESS) as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      el.style.setProperty('--tx', `${((0.5 - py) * 9).toFixed(2)}deg`);
      el.style.setProperty('--ty', `${((px - 0.5) * 11).toFixed(2)}deg`);
      el.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
      el.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
      el.classList.add('is-press');
      cur = el;
    },
    { passive: true },
  );
  document.addEventListener('pointerup', release, { passive: true });
  document.addEventListener('pointercancel', release, { passive: true });
}

function initReveal() {
  const known = new WeakSet<Element>();
  const io = new IntersectionObserver(
    (entries) => {
      let k = 0;
      for (const e of entries) {
        const el = e.target as HTMLElement;
        if (!known.has(el)) {
          // первое донесение: то, что уже на экране, не прячем; остальное прячем — оно за пределами экрана
          known.add(el);
          if (e.isIntersecting) io.unobserve(el);
          else el.classList.add('rv');
          continue;
        }
        if (!e.isIntersecting) continue;
        io.unobserve(el);
        el.style.setProperty('--rv-d', `${Math.min(k++, 5) * 60}ms`);
        el.classList.add('rv-in');
        window.setTimeout(() => {
          el.classList.remove('rv', 'rv-in');
          el.style.removeProperty('--rv-d');
        }, 1100);
      }
    },
    { rootMargin: '0px 0px -5% 0px', threshold: 0.01 },
  );
  const main = document.getElementById('main');
  if (!main) return;
  const scan = () => main.querySelectorAll(REVEAL).forEach((el) => {
    if (!known.has(el)) io.observe(el);
  });
  scan();
  let raf = 0;
  new MutationObserver(() => {
    if (!raf) raf = requestAnimationFrame(() => {
      raf = 0;
      scan();
    });
  }).observe(main, { childList: true, subtree: true });
}

/**
 * Распаковка карточек: новая карточка приезжает закрытой коробкой (это заодно заглушка на время загрузки фото),
 * на экране клапаны расходятся. Только первые на странице: в длинном списке эффект не должен мешать листать.
 * Что уже было на странице при загрузке, не трогаем: иначе готовая карточка мигнула бы коробкой.
 */
const UNBOX_LIMIT = 8;
function initUnbox() {
  const main = document.getElementById('main');
  if (!main) return;
  const known = new WeakSet<Element>();
  let count = 0;
  let path = location.pathname;
  const open = (card: Element) => {
    card.classList.add('is-open');
    window.setTimeout(() => card.classList.remove('boxed', 'is-open'), 800);
  };
  const io = new IntersectionObserver((es) => {
    let k = 0;
    for (const e of es) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      const card = e.target;
      const delay = Math.min(k++, 3) * 70;
      const img = card.querySelector('img');
      let done = false;
      const go = () => {
        if (done) return;
        done = true;
        window.setTimeout(() => open(card), delay);
      };
      if (!img || img.complete) go();
      else {
        img.addEventListener('load', go, { once: true });
        img.addEventListener('error', go, { once: true });
        window.setTimeout(go, 700);
      }
    }
  }, { threshold: 0.05 });
  const scan = (first: boolean) => {
    if (location.pathname !== path) {
      path = location.pathname;
      count = 0;
    }
    main.querySelectorAll('.pcard:not(.pcard--skel)').forEach((card) => {
      if (known.has(card)) return;
      known.add(card);
      if (first || count >= UNBOX_LIMIT) return;
      count++;
      card.classList.add('boxed');
      io.observe(card);
    });
  };
  scan(true);
  let raf = 0;
  new MutationObserver(() => {
    if (!raf) raf = requestAnimationFrame(() => {
      raf = 0;
      scan(false);
    });
  }).observe(main, { childList: true, subtree: true });
}

/**
 * Картинки разделов плывут при прокрутке, только пока они рядом с экраном: иначе каждая держит свой слой на видеокарте.
 * Где нет анимации по прокрутке на CSS, их двигает маленький обработчик.
 */
function initDrift() {
  if (!matchMedia('(hover: none)').matches) return;
  const main = document.getElementById('main');
  if (!main) return;
  const vis = new Set<HTMLElement>();
  const known = new WeakSet<Element>();
  const css = typeof CSS !== 'undefined' && CSS.supports?.('animation-timeline: view()');
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    const el = e.target as HTMLElement;
    if (css) el.classList.toggle('drift', e.isIntersecting);
    else if (e.isIntersecting) vis.add(el);
    else vis.delete(el);
  }), { rootMargin: '20% 0px' });
  const scan = () => main.querySelectorAll('.ctile__img, .stile img').forEach((el) => {
    if (!known.has(el)) {
      known.add(el);
      io.observe(el);
    }
  });
  scan();
  new MutationObserver(scan).observe(main, { childList: true, subtree: true });
  if (css) return;
  const vh = () => window.innerHeight || 700;
  onScrollY(() => {
    vis.forEach((el) => {
      const r = el.getBoundingClientRect();
      const p = (r.top + r.height / 2) / vh() - 0.5; // −0,5 вверху экрана … +0,5 внизу
      el.style.translate = `0 ${(p * 26).toFixed(1)}px`;
      el.style.rotate = `${(p * 5).toFixed(2)}deg`;
    });
  });
}

export function initAlive() {
  if (started || typeof window === 'undefined' || reducedMotion()) return;
  started = true;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  if (/Android/.test(navigator.userAgent) && (navigator.hardwareConcurrency <= 4 || mem <= 3)) document.documentElement.classList.add('low');
  initPress();
  if ('IntersectionObserver' in window) {
    initReveal();
    initUnbox();
    initDrift();
  }
}
