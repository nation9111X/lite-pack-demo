import { useEffect, useRef, useState } from 'react';
import type { DeliveryRegion, Department } from '../api/types';
import { loadYmaps, type YMaps } from '../lib/ymaps';
import { Icon } from './Icon';

export type LatLng = { lat: number; lng: number };
export type Fly = LatLng & { zoom?: number; seq: number; /** не определять адрес после перелёта (он уже известен) */ quiet?: boolean };
export type Bubble = { tone: 'hint' | 'busy' | 'ok' | 'bad'; title: string; text?: string | null };

const IZHEVSK: LatLng = { lat: 56.8527, lng: 53.2045 };
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Метка склада в стиле сайта: зелёная капля, внутри — коробка
const depIcon = (on: boolean) =>
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="54" viewBox="0 0 44 54"><ellipse cx="22" cy="51" rx="8" ry="2.5" fill="rgba(0,32,30,.25)"/><path d="M22 2C11.5 2 4 9.8 4 19.6 4 32.5 22 49 22 49s18-16.5 18-29.4C40 9.8 32.5 2 22 2Z" fill="${on ? '#0d6e20' : '#00671e'}" stroke="#fff" stroke-width="2.5"/><path d="M14 15.5 22 11.5l8 4v9l-8 4-8-4v-9Zm0 0 8 4m0 0 8-4m-8 4v9" fill="none" stroke="${on ? '#dcc19b' : '#fff'}" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  );

type Props = {
  zones?: DeliveryRegion[];
  departments?: Department[];
  activeDepartment?: string | null;
  onDepartment?: (id: string) => void;
  /** центральная булавка: выбор точки доставки */
  pin?: boolean;
  start?: LatLng & { zoom: number };
  fly?: Fly | null;
  bubble?: Bubble | null;
  onMoveStart?: () => void;
  onSettle?: (p: LatLng) => void;
  onLocate?: () => void;
  locating?: boolean;
  onFail?: () => void;
};

export function AddressMap(props: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<YMaps>(null);
  const ym = useRef<YMaps>(null);
  const cb = useRef(props);
  cb.current = props;
  const quiet = useRef(0); // до этого момента движение карты — наше (перелёт), а не пользователя
  const settleT = useRef(0);
  const [state, setState] = useState<'load' | 'ok' | 'fail'>('load');
  const [moving, setMoving] = useState(false);

  // создаём карту один раз
  useEffect(() => {
    let dead = false;
    loadYmaps()
      .then((Y) => {
        if (dead || !box.current) return;
        ym.current = Y;
        const s = cb.current.start ?? { ...IZHEVSK, zoom: 12 };
        const m = new Y.Map(
          box.current,
          { center: [s.lat, s.lng], zoom: s.zoom, controls: [] },
          { suppressMapOpenBlock: true, yandexMapDisablePoiInteractivity: true, minZoom: 6 },
        );
        map.current = m;
        if (!cb.current.pin) m.behaviors.disable('scrollZoom');
        m.events.add('actionbegin', () => {
          if (Date.now() < quiet.current) return;
          setMoving(true);
          cb.current.onMoveStart?.();
        });
        m.events.add('boundschange', () => {
          const ours = Date.now() < quiet.current;
          window.clearTimeout(settleT.current);
          settleT.current = window.setTimeout(() => {
            setMoving(false);
            if (ours) return;
            const [lat, lng] = m.getCenter();
            cb.current.onSettle?.({ lat, lng });
          }, 280);
        });
        // касание карты — булавка переезжает в эту точку
        if (cb.current.pin) m.events.add('click', (e: YMaps) => m.panTo(e.get('coords'), { duration: reduced() ? 0 : 320 }));
        setState('ok');
      })
      .catch(() => {
        if (dead) return;
        setState('fail');
        cb.current.onFail?.();
      });
    return () => {
      dead = true;
      window.clearTimeout(settleT.current);
      map.current?.destroy();
      map.current = null;
    };
  }, []);

  // зоны доставки — полупрозрачная заливка в цвет бренда; клики проходят сквозь них к карте
  useEffect(() => {
    const m = map.current, Y = ym.current;
    if (!m || !Y || !props.zones?.length) return;
    const col = new Y.GeoObjectCollection(null, {
      fillColor: '#19b2361f', strokeColor: '#0d6e20', strokeOpacity: 0.55, strokeWidth: 1.5, interactivityModel: 'default#transparent',
    });
    for (const z of props.zones) {
      for (const p of z.positivePolygon) {
        col.add(new Y.Polygon([p.coordinates.map((c) => [c.lat, c.lng])], {}, {}));
      }
    }
    m.geoObjects.add(col);
    return () => {
      m.geoObjects.remove(col);
    };
  }, [state, props.zones]);

  // пункты самовывоза
  useEffect(() => {
    const m = map.current, Y = ym.current;
    const deps = (props.departments ?? []).filter((d) => d.address?.lat && d.address?.lng);
    if (!m || !Y || !deps.length) return;
    const col = new Y.GeoObjectCollection();
    for (const d of deps) {
      const on = d.id === props.activeDepartment;
      const pm = new Y.Placemark(
        [d.address.lat, d.address.lng],
        { hintContent: d.title },
        { iconLayout: 'default#image', iconImageHref: depIcon(on), iconImageSize: on ? [52, 64] : [44, 54], iconImageOffset: on ? [-26, -60] : [-22, -50], zIndex: on ? 10 : 1 },
      );
      pm.events.add('click', () => cb.current.onDepartment?.(d.id));
      col.add(pm);
    }
    m.geoObjects.add(col);
    if (!props.pin) {
      quiet.current = Date.now() + 300;
      if (deps.length === 1) m.setCenter([deps[0].address.lat, deps[0].address.lng], 14);
      else m.setBounds(col.getBounds(), { checkZoomRange: true, zoomMargin: 48 });
    }
    return () => {
      m.geoObjects.remove(col);
    };
  }, [state, props.departments, props.activeDepartment, props.pin]);

  // перелёт по запросу (выбор подсказки, геолокация)
  useEffect(() => {
    const m = map.current, f = props.fly;
    if (!m || !f) return;
    const ms = reduced() ? 0 : 450;
    quiet.current = f.quiet ? Date.now() + ms + 200 : 0;
    m.setCenter([f.lat, f.lng], f.zoom ?? Math.max(m.getZoom(), 16), { duration: ms });
  }, [state, props.fly?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  // у логотипа-ссылки Яндекса в углу карты нет подписи — добавляем для экранного диктора
  useEffect(() => {
    if (state !== 'ok') return;
    const t = window.setTimeout(() => box.current?.querySelectorAll('a[class*="copyright__logo"]').forEach((a) => a.setAttribute('aria-label', 'Яндекс Карты')), 600);
    return () => window.clearTimeout(t);
  }, [state]);

  const zoom = (d: number) => {
    const m = map.current;
    if (m) m.setZoom(m.getZoom() + d, { duration: reduced() ? 0 : 220 });
  };

  if (state === 'fail') return null;
  const b = props.bubble;
  return (
    <div className={`amap${state === 'ok' ? ' is-ready' : ''}${moving ? ' is-moving' : ''}`}>
      <div ref={box} className="amap__canvas" aria-label="Карта: передвиньте её, чтобы булавка указала адрес" role="application" />
      {state === 'load' && (
        <div className="amap__load">
          <span className="spinner" /> Загружаем карту…
        </div>
      )}
      {props.pin && state === 'ok' && (
        <div className="amap__pin" aria-hidden="true">
          {b && (
            <div className={`amap__bubble is-${moving ? 'busy' : b.tone}`}>
              {moving ? (
                <span className="amap__bubble-t">Отпустите карту, когда булавка укажет на дом</span>
              ) : (
                <>
                  {b.tone === 'busy' && <span className="spinner" />}
                  <span className="amap__bubble-t">{b.title}</span>
                  {b.text && <span className="amap__bubble-s">{b.text}</span>}
                </>
              )}
            </div>
          )}
          <svg className="amap__needle" width="44" height="56" viewBox="0 0 44 56">
            <path d="M22 2C11.5 2 4 9.8 4 19.6 4 32.5 22 50 22 50s18-17.5 18-30.4C40 9.8 32.5 2 22 2Z" fill="currentColor" stroke="#fff" strokeWidth="2.5" />
            <path d="M14 15.5 22 11.5l8 4v9l-8 4-8-4v-9Zm0 0 8 4m0 0 8-4m-8 4v9" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
          <span className="amap__shadow" />
        </div>
      )}
      {state === 'ok' && (
        <div className="amap__ctl">
          <button type="button" onClick={() => zoom(1)} aria-label="Приблизить"><Icon name="plus" size={20} /></button>
          <button type="button" onClick={() => zoom(-1)} aria-label="Отдалить"><Icon name="minus" size={20} /></button>
          {props.onLocate && (
            <button type="button" className="amap__me" onClick={props.onLocate} disabled={props.locating} aria-label="Моё местоположение" title="Моё местоположение">
              {props.locating ? <span className="spinner" /> : <Icon name="target" size={20} />}
            </button>
          )}
        </div>
      )}
      {state === 'ok' && !!props.zones?.length && (
        <span className="amap__legend">
          <i aria-hidden="true" /> Зоны доставки
        </span>
      )}
    </div>
  );
}
