import { Suspense, useEffect } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import { BottomNav, Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { CookieBar, RegionPrompt, Toasts } from '../components/Overlays';
import { AddressSheet } from '../components/AddressSheet';
import { AuthModal } from '../components/AuthModal';
import { CartView } from '../components/CartView';
import { Dialog } from '../components/Dialog';
import { useStore } from '../lib/store';
import { setCartOpen, uiStore } from '../store/ui';
import { initSession } from '../store/actions';
import { initSmoothScroll, onScrollY, resetSmoothScroll } from '../lib/smooth';
import { initInteractions } from '../lib/interactions';
import { initAlive } from '../lib/alive';

/** Полоса над шапкой в сборке для показа заказчику: что это за сайт и что заказы здесь настоящие. */
function PreviewStrip() {
  const demo = import.meta.env.VITE_DEMO === '1';
  return (
    <div className="preview-strip" role="note">
      <b>{demo ? 'Демо-версия' : 'Предпросмотр'} нового дизайна lite-pack.ru</b>
      <span>
        {demo
          ? `Цены и наличие — на ${import.meta.env.VITE_DEMO_DATE} ${import.meta.env.VITE_DEMO_SAFE === '1' ? 'Корзина работает только в этом браузере, вход и оформление заказа отключены.' : 'Корзина и заказы работают только в этом браузере и никуда не отправляются.'}`
          : 'Каталог, цены и наличие — с действующего сайта. Заказы, оформленные здесь, настоящие.'}
      </span>
    </div>
  );
}

/** Тонкая «упаковочная лента» прогресса прокрутки под шапкой. */
function ScrollProgress() {
  useEffect(() => {
    const el = document.querySelector<HTMLElement>('.scroll-tape');
    // Где браузер умеет анимацию по прокрутке (Chrome, Edge, Яндекс Браузер) — она целиком в CSS, без JS
    if (!el || (typeof CSS !== 'undefined' && CSS.supports?.('animation-timeline: scroll()'))) return;
    // Высоту страницы меряем только когда она меняется, а не в каждом кадре
    let max = 1;
    const measure = () => {
      max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    window.addEventListener('resize', measure, { passive: true });
    measure();
    const off = onScrollY((y) => {
      el.style.transform = `scaleX(${Math.min(1, y / max).toFixed(4)})`;
    });
    return () => {
      off();
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);
  return <div className="scroll-tape" aria-hidden="true" />;
}

function RouteEffects() {
  const loc = useLocation();
  useEffect(() => resetSmoothScroll(), [loc.pathname]);
  return null;
}

function CartDrawer() {
  const open = useStore(uiStore, (s) => s.cartOpen);
  const loc = useLocation();
  useEffect(() => setCartOpen(false), [loc.pathname]);
  return (
    <Dialog open={open} onClose={() => setCartOpen(false)} variant="side" title="Корзина">
      <CartView onNavigate={() => setCartOpen(false)} />
    </Dialog>
  );
}

export function PageFallback() {
  return (
    <div className="page-fallback" aria-busy="true">
      <span className="spinner" />
    </div>
  );
}

let started = false;

export function Layout() {
  useEffect(() => {
    if (started) return;
    started = true;
    initSession();
    initSmoothScroll();
    initInteractions();
    initAlive();
  }, []);
  return (
    <>
      <a href="#main" className="skip-link">Перейти к содержимому</a>
      {import.meta.env.VITE_PREVIEW === '1' && <PreviewStrip />}
      <Header />
      <main id="main" tabIndex={-1}>
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <BottomNav />
      <CartDrawer />
      <AddressSheet />
      <AuthModal />
      <RegionPrompt />
      <CookieBar />
      <Toasts />
      <ScrollProgress />
      <RouteEffects />
      {/* Ключ по записи истории: «Назад» возвращает позицию, новый переход (в т.ч. по логотипу) — наверх */}
      <ScrollRestoration />
    </>
  );
}
