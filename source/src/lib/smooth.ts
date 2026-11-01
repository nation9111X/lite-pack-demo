import { reducedMotion } from './motion';
type ScrollSub = (y: number) => void;
const subs = new Set<ScrollSub>();
let curY = 0, frame = 0, bound = false;
function bindNative() {
  if (bound || typeof window === 'undefined') return;
  bound = true; curY = window.scrollY;
  window.addEventListener('scroll', () => {
    curY = window.scrollY;
    if (!frame) frame = requestAnimationFrame(() => {
      frame = 0; subs.forEach(f => f(curY));
    });
  }, { passive: true });
}
export function onScrollY(f: ScrollSub): () => void {
  bindNative(); subs.add(f); f(curY);
  return () => { subs.delete(f); };
}
export function currentScrollY() { bindNative(); return curY; }
export function initSmoothScroll() { bindNative(); }
export function resetSmoothScroll() { /* Native scrolling has no synthetic inertia. */ }
export function syncScrollLock() {
  document.documentElement.classList.toggle('has-dialog', !!document.querySelector('dialog[open]'));
}
export function scrollToTop() {
  window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
}
export function scrollToEl(el: Element, offset = -96) {
  const header = document.querySelector('.hdr')?.getBoundingClientRect().height ?? 80;
  const gap = Math.max(-offset, header + 12);
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - gap, behavior: reducedMotion() ? 'auto' : 'smooth' });
}
