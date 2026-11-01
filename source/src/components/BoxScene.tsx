import { useEffect, useRef } from 'react';
import { reducedMotion } from '../lib/motion';
import { buzz } from '../lib/alive';
import { currentScrollY, onScrollY } from '../lib/smooth';
import './box.css';
import { asset } from '../lib/base';

/**
 * Крафтовая коробка на CSS 3D. На компьютере покачивается за курсором; на телефоне живёт сама:
 * слегка покачивается (анимация CSS на видеокарте, box.css), следует за наклоном телефона, крутится пальцем,
 * на касание подпрыгивает и приоткрывается.
 * При прокрутке раскрывает клапаны, изнутри поднимаются товары каталога. Чисто декоративная (aria-hidden).
 */
// Картинки — статичные WebP (scripts/hero-images.mjs): первый экран не ждёт API.
const HERO = [0, 1, 2];

export function BoxScene() {
  const scene = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scene.current;
    if (!el) return;
    if (reducedMotion()) {
      el.style.setProperty('--open', '0.72');
      return;
    }
    const touch = matchMedia('(hover: none)').matches;
    let tx = 0, ty = 0, cx = 0, cy = 0, open = 0.6, targetOpen = 0.6, kick = 0, raf = 0, visible = false;
    let spin = 0, spinV = 0, dragging = false, dragX = 0, hop = 0, lastOpen = '', lastHop = '';
    const host = (el.closest('.hero') as HTMLElement | null) ?? el;
    const boxEl = el.querySelector<HTMLElement>('.box');
    const floatEl = el.querySelector<HTMLElement>('.box-float');

    // Геометрию первого экрана меряем только при изменении размеров, а не на каждое движение мыши/прокрутку
    let top = 0, left = 0, w = 1, h = 600, sy = currentScrollY();
    const measure = () => {
      const r = host.getBoundingClientRect();
      top = r.top + currentScrollY();
      left = r.left;
      w = r.width || 1;
      h = r.height || 600;
    };
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    measure();

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || !visible) return;
      tx = ((e.clientX - left) / w - 0.5) * 2;
      ty = ((e.clientY - (top - sy)) / h - 0.5) * 2;
      wake();
    };
    const onScroll = (y: number) => {
      sy = y;
      targetOpen = Math.min(1, 0.6 + (y / (h * 0.7)) * 0.4);
      wake();
    };

    // Палец: вбок — крутит коробку (вертикальная прокрутка страницы остаётся за браузером: touch-action), касание — подпрыгивает
    let startX = 0, moved = 0;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      dragging = true;
      dragX = startX = e.clientX;
      moved = 0;
      spinV = 0;
      el.classList.add('is-touched');
      wake();
    };
    const onDrag = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - dragX;
      dragX = e.clientX;
      moved = Math.max(moved, Math.abs(e.clientX - startX));
      spin += dx * 0.75;
      spinV = dx * 0.75;
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      if (moved < 6) {
        kick = 0.34; // касание: клапаны хлопают
        hop = 1;
        buzz(10);
      }
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      const x = Math.max(-1, Math.min(1, e.gamma / 26));
      const y = Math.max(-1, Math.min(1, (e.beta - 50) / 26)) * 0.8;
      if (Math.abs(x - tx) + Math.abs(y - ty) < 0.03) return; // дрожание руки не будит цикл
      tx = x;
      ty = y;
      wake();
    };

    // Цикл крутится, только пока значения не сошлись: в покое коробка не занимает главный поток
    const tick = () => {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      if (!dragging) {
        spin += spinV;
        spinV *= 0.94;
        // отпустили — коробка сама поворачивается лицом вперёд самым коротким путём
        if (Math.abs(spinV) < 0.4) {
          const home = Math.round(spin / 360) * 360;
          spin += (home - spin) * 0.035;
        }
      }
      kick *= 0.94;
      hop *= 0.9;
      open += (Math.min(1.12, targetOpen + kick) - open) * 0.12;
      // Поворот и прыжок пишем прямо в свои элементы: переменная на сцене пересчитывала бы стили всех граней
      if (boxEl) boxEl.style.transform = `translateY(30px) rotateX(${(-16 - cy * 6).toFixed(2)}deg) rotateY(${(-28 + cx * 14 + spin).toFixed(2)}deg)`;
      const hopY = (-Math.sin(hop * Math.PI) * 26).toFixed(1);
      if (floatEl && hopY !== lastHop) {
        floatEl.style.translate = `0 ${hopY}px`;
        lastHop = hopY;
      }
      const openV = open.toFixed(3);
      if (openV !== lastOpen) {
        el.style.setProperty('--open', openV);
        lastOpen = openV;
      }
      const settled = !dragging && Math.abs(tx - cx) < 0.002 && Math.abs(ty - cy) < 0.002 && Math.abs(targetOpen - open) < 0.001 && Math.abs(spinV) < 0.01 && Math.abs(spin - Math.round(spin / 360) * 360) < 0.05 && kick < 0.001 && hop < 0.01;
      raf = settled ? 0 : requestAnimationFrame(tick);
    };
    function wake() {
      if (visible && !raf) raf = requestAnimationFrame(tick);
    }
    // Анимируем только когда сцена видна; вдали от экрана коробка не держит слои на видеокарте
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      el.classList.toggle('is-away', !visible);
      cancelAnimationFrame(raf);
      raf = 0;
      wake();
    }, { rootMargin: '160px 0px' });
    io.observe(el);
    const ioHost = new IntersectionObserver(([e]) => host.classList.toggle('is-away', !e.isIntersecting), { rootMargin: '100px 0px' });
    ioHost.observe(host);
    window.addEventListener('pointermove', onMove, { passive: true });
    el.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointermove', onDrag, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', onUp, { passive: true });
    if (touch) window.addEventListener('deviceorientation', onTilt, { passive: true });
    const offScroll = onScrollY(onScroll);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ioHost.disconnect();
      ro.disconnect();
      offScroll();
      window.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onDrag);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('deviceorientation', onTilt);
    };
  }, []);

  return (
    <div className="box-scene" ref={scene} aria-hidden="true">
      <div className="box-float">
        <div className="box">
          <div className="box__face box__front">
            <span className="box__dieline" />
          </div>
          <div className="box__sticker">
            <img alt="" width={451} height={237} src={asset('/brand/logo.png')} />
          </div>
          <div className="box__face box__back" />
          <div className="box__face box__left">
            <span className="box__tape-v" />
          </div>
          <div className="box__face box__right">
            <span className="box__tape-v" />
            <svg className="box__marks" viewBox="0 0 120 40" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              {/* Манипуляционные знаки: «Верх» и «Беречь от влаги» */}
              <path d="M10 34V8m-7 8 7-8 7 8M26 34V8m-7 8 7-8 7 8" />
              <path d="M50 22a14 14 0 0 1 28 0Zm14 0v9a4 4 0 0 1-8 0" />
              <path d="M92 8h18l-3 12a6 6 0 0 1-12 0Zm9 18v8m-6 0h12" />
            </svg>
          </div>
          <div className="box__face box__bottom" />
          <div className="box__items">
            {HERO.map((i) => (
              <picture key={i}>
                <source media="(min-width: 768px)" srcSet={asset(`/hero/box-${i}-180.webp`)} />
                <img className={`box__item box__item--${i}`} alt="" width={80} height={80} decoding="async" src={asset(`/hero/box-${i}-80.webp`)} />
              </picture>
            ))}
          </div>
          <div className="box__flap box__flap--front"><span className="box__tape-h" /></div>
          <div className="box__flap box__flap--back"><span className="box__tape-h" /></div>
        </div>
      </div>
      <div className="box-shadow" />
    </div>
  );
}
