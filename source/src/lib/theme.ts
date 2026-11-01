import { createStore } from './store';
import { reducedMotion } from './motion';

// Тема сайта. Первый выбор — по настройке телефона, дальше — как выбрал покупатель.
// Раннее применение (до первой отрисовки, без вспышки) — в скрипте в index.html.
export type Theme = 'light' | 'dark';
const KEY = 'lp.theme';
const META = { light: '#f6f3ec', dark: '#0e1512' };

function initial(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export const themeStore = createStore<{ theme: Theme }>({ theme: initial() });

function apply(t: Theme) {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META[t]);
  themeStore.set({ theme: t });
}

type VTDocument = Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> } };

/** Смена темы расходится кругом от точки касания. */
export function toggleTheme(x?: number, y?: number) {
  const next: Theme = themeStore.get().theme === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* приватный режим — тема до конца визита */
  }
  const doc = document as VTDocument;
  if (!doc.startViewTransition || reducedMotion()) return apply(next);
  const root = document.documentElement;
  root.classList.add('vt-theme');
  const vt = doc.startViewTransition(() => apply(next));
  const cx = x ?? innerWidth / 2;
  const cy = y ?? 0;
  const rad = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy));
  vt.ready
    .then(() => root.animate({ clipPath: [`circle(0px at ${cx}px ${cy}px)`, `circle(${rad}px at ${cx}px ${cy}px)`] }, { duration: 560, easing: 'cubic-bezier(.2,.8,.2,1)', pseudoElement: '::view-transition-new(root)' }))
    .catch(() => {});
  vt.finished.finally(() => root.classList.remove('vt-theme'));
}
