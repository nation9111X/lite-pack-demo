import { useEffect, useRef, useState } from 'react';
import { CARD_MM, type Dims } from '../lib/dims';
import { n } from '../lib/format';
import { reducedMotion } from '../lib/motion';
import { Icon } from './Icon';
import './dims3d.css';

type V3 = [number, number, number];
type Face = { pts: V3[]; base: [number, number, number]; kind?: 'card' | 'inner' };

const KRAFT: [number, number, number] = [201, 165, 122];
const CARD: [number, number, number] = [214, 226, 222];
const LIGHT: V3 = norm([-0.45, 0.8, -0.4]);

function norm(v: V3): V3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Геометрия: круглая форма — усечённый конус, прямоугольная — короб. Плюс карта для масштаба. */
function buildFaces(d: Dims): { faces: Face[]; size: number; height: number } {
  const faces: Face[] = [];
  let size: number;
  const h = d.height;
  if (d.kind === 'round') {
    const rt = d.top / 2, rb = d.bottom / 2, N = 56;
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
      faces.push({ pts: [[rb * Math.cos(a0), 0, rb * Math.sin(a0)], [rb * Math.cos(a1), 0, rb * Math.sin(a1)], [rt * Math.cos(a1), h, rt * Math.sin(a1)], [rt * Math.cos(a0), h, rt * Math.sin(a0)]], base: KRAFT });
    }
    // дно изнутри (видно через открытый верх)
    faces.push({ pts: Array.from({ length: N }, (_, i) => [rb * Math.cos((i / N) * Math.PI * 2), 0.5, rb * Math.sin((i / N) * Math.PI * 2)] as V3).reverse(), base: [150, 118, 82], kind: 'inner' });
    size = Math.max(d.top, d.bottom, h);
  } else if (d.kind === 'wedge') {
    // треугольная призма: прямой угол справа внизу (как у коробки на фото), центр тяжести треугольника — на оси
    const a = d.legA, b = d.legB, z = d.depth / 2, x0 = a / 3, x1 = (-2 * a) / 3;
    const v: V3[] = [[x0, 0, -z], [x1, 0, -z], [x0, b, -z], [x0, 0, z], [x1, 0, z], [x0, b, z]];
    const tri = (i: number, j: number, k: number): Face => ({ pts: [v[i], v[j], v[k]], base: KRAFT });
    const quad = (i: number, j: number, k: number, l: number): Face => ({ pts: [v[i], v[j], v[k], v[l]], base: KRAFT });
    faces.push(tri(0, 1, 2), tri(3, 5, 4), quad(0, 3, 4, 1), quad(0, 2, 5, 3), quad(1, 4, 5, 2));
    size = Math.max(a, b, d.depth);
  } else {
    const x = d.length / 2, z = d.width / 2;
    const v: V3[] = [[-x, 0, -z], [x, 0, -z], [x, 0, z], [-x, 0, z], [-x, h, -z], [x, h, -z], [x, h, z], [-x, h, z]];
    const q = (a: number, b: number, c: number, e: number): Face => ({ pts: [v[a], v[b], v[c], v[e]], base: KRAFT });
    faces.push(q(0, 1, 5, 4), q(1, 2, 6, 5), q(2, 3, 7, 6), q(3, 0, 4, 7), q(4, 5, 6, 7), q(3, 2, 1, 0));
    size = Math.max(d.length, d.width, h);
  }
  // Банковская карта лежит рядом на «столе»
  const off = (d.kind === 'round' ? Math.max(d.top, d.bottom) / 2 : d.kind === 'wedge' ? d.legA / 3 : d.length / 2) + 18;
  const cw = CARD_MM.w, ch = CARD_MM.h;
  faces.push({ pts: [[off, 0.2, -ch / 2], [off + cw, 0.2, -ch / 2], [off + cw, 0.2, ch / 2], [off, 0.2, ch / 2]].reverse() as V3[], base: CARD, kind: 'card' });
  return { faces, size: Math.max(size, off + cw), height: h };
}

export function Dims3D({ dims, title }: { dims: Dims; title: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef({ yaw: -0.65, pitch: 0.42, auto: true });
  const [hint, setHint] = useState(true);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const { faces, height } = buildFaces(dims);
    let W = 0, H = 0, dpr = 1, raf = 0, visible = false, last = 0;
    const reduce = reducedMotion();
    const font = getComputedStyle(document.body).fontFamily;

    const resize = () => {
      const r = cv.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width;
      H = r.height;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      draw();
    };

    // Вращаем вокруг центра сцены (фигура + карта); масштаб — по описанной сфере, чтобы при любом повороте всё помещалось
    const all = faces.flatMap((fc) => fc.pts);
    const mid = (i: 0 | 1 | 2) => (Math.min(...all.map((p) => p[i])) + Math.max(...all.map((p) => p[i]))) / 2;
    const C: V3 = [mid(0), height / 2, mid(2)];
    const R = Math.max(...all.map((p) => Math.hypot(p[0] - C[0], p[1] - C[1], p[2] - C[2]))) + 24;
    const F = R * 6;
    const project = (p: V3) => {
      const { yaw, pitch } = view.current;
      const x = p[0] - C[0], y = p[1] - C[1], z = p[2] - C[2];
      const x1 = x * Math.cos(yaw) - z * Math.sin(yaw);
      const z1 = x * Math.sin(yaw) + z * Math.cos(yaw);
      // взгляд сверху: ближние точки ниже на экране
      const y2 = y * Math.cos(pitch) + z1 * Math.sin(pitch);
      const z2 = -y * Math.sin(pitch) + z1 * Math.cos(pitch);
      const scale = (Math.min(W / 2 - 30, (H / 2 - 22) / 0.7) / R) * ((F - R) / F);
      const k = (F / (F + z2)) * scale;
      return { x: W / 2 + x1 * k, y: H / 2 - y2 * k, d: z2, cam: [x1, y2, z2] as V3 };
    };

    const label = (text: string, x: number, y: number, align: CanvasTextAlign = 'center') => {
      ctx.font = `700 ${13}px ${font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const w = ctx.measureText(text).width + 14;
      // при любом повороте подпись остаётся внутри сцены: на узком экране коробка доходит до края
      const lx = Math.max(4, Math.min(W - w - 4, align === 'left' ? x : align === 'right' ? x - w : x - w / 2));
      const ly = Math.max(13, Math.min(H - 13, y));
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath();
      ctx.roundRect(lx, ly - 11, w, 22, 11);
      ctx.fill();
      ctx.fillStyle = '#0d6e20';
      ctx.fillText(text, lx + w / 2, ly + 0.5);
    };

    type Pt = { x: number; y: number };
    /** Размерная линия в экранных координатах, сдвинутая наружу от фигуры на (ox, oy). */
    const dimLine = (A: Pt, B: Pt, text: string, ox: number, oy: number, labelSide: 'mid' | 'left' | 'below' | 'above' = 'mid') => {
      ctx.strokeStyle = '#0d6e20';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(A.x + ox, A.y + oy);
      ctx.lineTo(B.x + ox, B.y + oy);
      ctx.stroke();
      ctx.setLineDash([]);
      // выносные линии от фигуры к размерной
      ctx.strokeStyle = 'rgba(13,110,32,0.35)';
      ctx.lineWidth = 1;
      for (const P of [A, B]) {
        ctx.beginPath();
        ctx.moveTo(P.x, P.y);
        ctx.lineTo(P.x + ox * 1.25, P.y + oy * 1.25);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(P.x + ox, P.y + oy, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = '#0d6e20';
        ctx.fill();
      }
      const mx = (A.x + B.x) / 2 + ox, my = (A.y + B.y) / 2 + oy;
      if (labelSide === 'left') label(text, mx - 8, my, 'right');
      else if (labelSide === 'below') label(text, mx, my + 16);
      else if (labelSide === 'above') label(text, mx, my - 16);
      else label(text, mx, my);
    };
    const ring = (r: number, y: number, k = 72) => Array.from({ length: k }, (_, i) => project([r * Math.cos((i / k) * Math.PI * 2), y, r * Math.sin((i / k) * Math.PI * 2)]));
    const extremes = (pts: Pt[]) => {
      let l = pts[0], r = pts[0], t = pts[0], btm = pts[0];
      for (const p of pts) {
        if (p.x < l.x) l = p;
        if (p.x > r.x) r = p;
        if (p.y < t.y) t = p;
        if (p.y > btm.y) btm = p;
      }
      return { l, r, t, b: btm };
    };

    function draw() {
      if (!W) return;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, W, H);
      // тень на столе
      const c = project([dims.kind === 'round' ? 0 : 0, 0, 0]);
      const g = ctx!.createRadialGradient(c.x, c.y + 6, 4, c.x, c.y + 6, W * 0.32);
      g.addColorStop(0, 'rgba(70,50,20,0.22)');
      g.addColorStop(1, 'rgba(70,50,20,0)');
      ctx!.fillStyle = g;
      ctx!.fillRect(0, 0, W, H);

      const axis = (y: number): V3 => project([0, y, 0]).cam;
      const items = faces.map((f) => {
        const P = f.pts.map(project);
        let nrm = norm(cross(sub(P[1].cam, P[0].cam), sub(P[2].cam, P[0].cam)));
        // нормаль наружу: от оси объекта к центру грани
        const cy = f.pts.reduce((s2, p) => s2 + p[1], 0) / f.pts.length;
        const center = P.reduce((s2, p) => [s2[0] + p.cam[0] / P.length, s2[1] + p.cam[1] / P.length, s2[2] + p.cam[2] / P.length] as V3, [0, 0, 0] as V3);
        // точка на оси — центр тяжести фигуры (у треугольной призмы — на трети высоты)
        const axisY = dims.kind === 'box' ? height / 2 : dims.kind === 'wedge' ? height / 3 : cy;
        if (!f.kind && dot(nrm, sub(center, axis(axisY))) < 0) nrm = [-nrm[0], -nrm[1], -nrm[2]];
        const depth = P.reduce((s2, p) => s2 + p.d, 0) / P.length;
        return { f, P, nrm, depth, facing: nrm[2] < 0 };
      });
      const byDepth = (x: typeof items) => x.sort((p, q) => q.depth - p.depth);
      const card = items.filter((i) => i.f.kind === 'card');
      const inner = items.filter((i) => i.f.kind === 'inner');
      const walls = items.filter((i) => !i.f.kind);
      const list =
        dims.kind === 'round'
          ? [...card, ...byDepth(walls.filter((i) => !i.facing)).map((i) => ({ ...i, back: true })), ...inner, ...byDepth(walls.filter((i) => i.facing))]
          : [...card, ...byDepth(walls.filter((i) => i.facing))];

      for (const item of list) {
        const { f, P, nrm } = item;
        const back = 'back' in item;
        const lit = f.kind === 'card' ? 1 : back ? 0.62 + 0.18 * Math.max(0, dot(nrm, LIGHT)) : 0.78 + 0.26 * Math.max(0, dot(nrm, LIGHT));
        const [r, gg, b] = f.base;
        ctx!.beginPath();
        P.forEach((p, i) => (i ? ctx!.lineTo(p.x, p.y) : ctx!.moveTo(p.x, p.y)));
        ctx!.closePath();
        ctx!.fillStyle = `rgb(${Math.min(255, Math.round(r * lit))},${Math.min(255, Math.round(gg * lit))},${Math.min(255, Math.round(b * lit))})`;
        ctx!.fill();
        if (dims.kind !== 'round' || f.kind === 'card') {
          ctx!.strokeStyle = f.kind === 'card' ? 'rgba(80,100,95,0.5)' : 'rgba(110,78,40,0.55)';
          ctx!.lineWidth = 1;
          ctx!.stroke();
        }
        if (f.kind === 'card') {
          const m = P.reduce((s, p) => [s[0] + p.x / 4, s[1] + p.y / 4], [0, 0]);
          ctx!.font = `600 11px ${font}`;
          ctx!.fillStyle = '#3e4f4b';
          ctx!.textAlign = 'center';
          ctx!.fillText('карта', m[0], m[1]);
        }
      }

      if (dims.kind === 'round') {
        // ободок горловины
        ctx!.strokeStyle = 'rgba(110,78,40,0.7)';
        ctx!.lineWidth = 1.5;
        ctx!.beginPath();
        for (let i = 0; i <= 64; i++) {
          const a = (i / 64) * Math.PI * 2;
          const p = project([(dims.top / 2) * Math.cos(a), dims.height, (dims.top / 2) * Math.sin(a)]);
          i ? ctx!.lineTo(p.x, p.y) : ctx!.moveTo(p.x, p.y);
        }
        ctx!.stroke();
        // Размеры привязаны к экранным границам фигуры — читаемы при любом повороте
        const topE = extremes(ring(dims.top / 2, dims.height));
        const botE = extremes(ring(dims.bottom / 2, 0));
        dimLine({ x: topE.l.x, y: topE.t.y }, { x: topE.r.x, y: topE.t.y }, `Ø ${n(dims.top)} мм`, 0, -16, 'above');
        dimLine({ x: botE.l.x, y: botE.b.y }, { x: botE.r.x, y: botE.b.y }, `Ø дна ${n(dims.bottom)} мм`, 0, 16, 'below');
        const leftX = Math.min(topE.l.x, botE.l.x);
        dimLine({ x: leftX, y: botE.b.y }, { x: leftX, y: topE.b.y }, `${n(dims.height)} мм`, -18, 0, 'left');
      } else if (dims.kind === 'wedge') {
        const a = dims.legA, b = dims.legB, z = dims.depth / 2, x0 = a / 3, x1 = (-2 * a) / 3;
        const c0 = project([0, b / 3, 0]);
        // ближняя к зрителю сторона по толщине
        const zn = project([x0, 0, z]).y > project([x0, 0, -z]).y ? z : -z;
        const A = project([x1, 0, zn]), R = project([x0, 0, zn]), T = project([x0, b, zn]), D = project([x0, 0, -zn]);
        const outward = (p: Pt, q: Pt) => {
          const mx = (p.x + q.x) / 2 - c0.x, my = (p.y + q.y) / 2 - c0.y;
          const l = Math.hypot(mx, my) || 1;
          return [(mx / l) * 18, (my / l) * 18] as const;
        };
        dimLine(A, R, `${n(a)} мм`, ...outward(A, R));
        dimLine(R, T, `${n(b)} мм`, ...outward(R, T));
        dimLine(R, D, `${n(dims.depth)} мм`, ...outward(R, D));
      } else {
        const x = dims.length / 2, z = dims.width / 2, h = dims.height;
        const V = ([[-x, 0, -z], [x, 0, -z], [x, 0, z], [-x, 0, z]] as V3[]).map((p) => ({ w: p, s: project(p) }));
        const c0 = project([0, 0, 0]);
        // ближайшая к зрителю нижняя вершина и её соседи по длине и ширине
        const near = V.reduce((m, v) => (v.s.y > m.s.y ? v : m), V[0]);
        const alongX = V.find((v) => v.w[2] === near.w[2] && v.w[0] !== near.w[0])!;
        const alongZ = V.find((v) => v.w[0] === near.w[0] && v.w[2] !== near.w[2])!;
        const outward = (a: Pt, b2: Pt) => {
          const mx = (a.x + b2.x) / 2 - c0.x, my = (a.y + b2.y) / 2 - c0.y;
          const l = Math.hypot(mx, my) || 1;
          return [(mx / l) * 18, (my / l) * 18] as const;
        };
        const [lx, ly] = outward(near.s, alongX.s);
        dimLine(near.s, alongX.s, `${n(dims.length)} мм`, lx, ly);
        const [wx, wy] = outward(near.s, alongZ.s);
        dimLine(near.s, alongZ.s, `${n(dims.width)} мм`, wx, wy);
        const left = V.reduce((m, v) => (v.s.x < m.s.x ? v : m), V[0]);
        const topL = project([left.w[0], h, left.w[2]]);
        dimLine(left.s, topL, `${n(h)} мм`, -18, 0, 'left');
      }
    }

    const tick = (t: number) => {
      raf = 0;
      const dt = last ? Math.min(50, t - last) : 16;
      last = t;
      if (view.current.auto && !reduce) {
        view.current.yaw += dt * 0.00035;
        draw();
        if (visible) raf = requestAnimationFrame(tick);
      }
    };
    const wake = () => {
      if (!raf && visible && view.current.auto && !reduce) {
        last = 0;
        raf = requestAnimationFrame(tick);
      }
    };

    // перетаскивание: поворот и наклон
    let drag: { x: number; y: number; yaw: number; pitch: number } | null = null;
    const down = (e: PointerEvent) => {
      cv.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, y: e.clientY, yaw: view.current.yaw, pitch: view.current.pitch };
      view.current.auto = false;
      setHint(false);
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      view.current.yaw = drag.yaw + (e.clientX - drag.x) * 0.012;
      view.current.pitch = Math.max(0.22, Math.min(1.1, drag.pitch + (e.clientY - drag.y) * 0.008));
      draw();
    };
    const up = () => {
      drag = null;
    };
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);

    const ro = new ResizeObserver(resize);
    ro.observe(cv);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) wake();
    });
    io.observe(cv);
    resize();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      cv.removeEventListener('pointerdown', down);
      cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerup', up);
      cv.removeEventListener('pointercancel', up);
    };
    // зависим от значений, а не от объекта: страница товара пересоздаёт его при каждом обновлении
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(dims)]);

  const caption =
    dims.kind === 'round'
      ? `Верх Ø ${n(dims.top)} мм · дно Ø ${n(dims.bottom)} мм · высота ${n(dims.height)} мм`
      : dims.kind === 'wedge'
        ? `Треугольная коробка: ${n(dims.legA)} × ${n(dims.legB)} мм, толщина ${n(dims.depth)} мм`
        : `${dims.source === 'title' ? 'Габариты: ' : ''}${n(dims.length)} × ${n(dims.width)} × ${n(dims.height)} мм (Д × Ш × В)`;

  return (
    <figure className="dims3d">
      <div className="dims3d__stage">
        <canvas ref={canvas} className="dims3d__canvas" role="img" aria-label={`3D-схема габаритов: ${title}. ${caption}`} />
        {hint && (
          <span className="dims3d__hint" aria-hidden="true">
            <Icon name="refresh" size={16} /> Потяните, чтобы повернуть
          </span>
        )}
      </div>
      <figcaption>
        <b>{caption}</b>
        <span className="muted">
          {dims.kind === 'wedge'
            ? 'Размеры взяты из названия товара: стороны прямого угла треугольника и толщина коробки. Для масштаба рядом банковская карта 85,6 × 54 мм.'
            : dims.source === 'title'
            ? 'Габариты взяты из названия товара. Модель упрощённая: показан прямоугольный короб в этих размерах, настоящая форма может отличаться (например, сужаться ко дну). Для масштаба рядом банковская карта 85,6 × 54 мм.'
            : 'Схема построена по характеристикам товара; для масштаба рядом банковская карта 85,6 × 54 мм.'}
        </span>
      </figcaption>
    </figure>
  );
}
