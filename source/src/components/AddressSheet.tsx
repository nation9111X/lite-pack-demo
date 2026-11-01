import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Dialog } from './Dialog';
import { Icon } from './Icon';
import { useStore } from '../lib/store';
import { activeAddress, currentRegion, sessionStore } from '../store/session';
import { closeAddress, toast, uiStore } from '../store/ui';
import { addCourier, addPickup, chooseAddress, removeAddress, switchRegion } from '../store/actions';
import { useAnonRegions, useDeliveryRegions, useDepartments } from '../hooks/data';
import * as api from '../api/endpoints';
import { errorText } from '../api/client';
import type { AddressSuggestion, DeliveryRegion, Department } from '../api/types';
import { hhmm, shortAddress } from '../lib/format';
import { nearestZone, zoneAt } from '../lib/geo';
import type { Bubble, Fly } from './AddressMap';
import './address-map.css';

// карта — отдельным файлом: нужна только в открытом окне адреса
const AddressMap = lazy(() => import('./AddressMap').then((m) => ({ default: m.AddressMap })));
const MapPlaceholder = () => (
  <div className="amap">
    <div className="amap__load"><span className="spinner" /> Загружаем карту…</div>
  </div>
);
const MapFailed = (
  <div className="amap">
    <div className="amap__load" role="alert">
      Карта не загрузилась. <button type="button" className="link" onClick={() => location.reload()}>Обновить страницу</button>
    </div>
  </div>
);
import { ChunkBoundary } from './ChunkBoundary';
import './address.css';

const DAYS: [keyof NonNullable<Department['workingTimes']>, string][] = [
  ['mon', 'Пн'], ['tue', 'Вт'], ['wed', 'Ср'], ['thu', 'Чт'], ['fri', 'Пт'], ['sat', 'Сб'], ['sun', 'Вс'],
];

/** «Пн–Пт 09:00–17:30 · Сб, Вс — Выходной» из workingTimes. */
function scheduleLines(wt: Department['workingTimes']): string[] {
  if (!wt) return [];
  const groups: { days: string[]; text: string }[] = [];
  for (const [k, label] of DAYS) {
    const d = wt[k];
    const text = d?.enabled ? `${hhmm(d.open)}–${hhmm(d.close)}` : 'Выходной';
    const last = groups[groups.length - 1];
    if (last && last.text === text) last.days.push(label);
    else groups.push({ days: [label], text });
  }
  return groups.map((g) => `${g.days.length > 2 ? `${g.days[0]}–${g.days[g.days.length - 1]}` : g.days.join(', ')}: ${g.text}`);
}

/** Переключатель региона: от него зависят ассортимент, цены и наличие. */
export function RegionSwitch() {
  const s = useStore(sessionStore, (x) => x);
  const regions = useAnonRegions().data;
  if (!regions || regions.length < 2) return null;
  const cur = currentRegion(s, regions);
  const i = regions.findIndex((r) => r.regionId === cur?.regionId);
  return (
    <div className="regsw">
      <p className="regsw__label label">Регион: ассортимент и цены</p>
      <div className={`seg regsw__seg${i < 0 ? ' is-empty' : ''}`} role="radiogroup" aria-label="Регион" style={{ ['--i' as string]: Math.max(0, i), ['--n' as string]: regions.length }}>
        {regions.map((r) => (
          <button
            key={r.regionId}
            type="button"
            role="radio"
            aria-checked={r.regionId === cur?.regionId}
            className={`seg__btn${r.regionId === cur?.regionId ? ' is-on' : ''}`}
            onClick={() => {
              if (r.regionId === cur?.regionId) return closeAddress();
              switchRegion(r).catch(() => {});
              // окно закрывается, как только бегунок доехал: покупатель сразу видит обновлённый каталог
              window.setTimeout(closeAddress, 420);
            }}
          >
            {r.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function SavedAddresses({ kind }: { kind: 'delivery' | 'pickup' }) {
  const s = useStore(sessionStore, (x) => x);
  const [busy, setBusy] = useState<string | null>(null);
  const list = s.addresses.filter((a) => (kind === 'pickup' ? !!a.namedAddress.departmentId : !a.namedAddress.departmentId));
  if (!list.length) return null;
  return (
    <div className="addr-saved">
      <p className="label">Мои адреса</p>
      <ul role="list">
        {list.map((a) => {
          const active = a.id === s.activeAddressId;
          const closed = a.namedAddress.workingStatus === 'closed';
          return (
            <li key={a.id} className={`addr-item${active ? ' is-active' : ''}`}>
              <button
                type="button"
                className="addr-item__main"
                aria-pressed={active}
                disabled={busy !== null}
                onClick={async () => {
                  setBusy(a.id);
                  try {
                    await chooseAddress(a.id);
                  } catch (e) {
                    toast(errorText(e), 'error');
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                <span className="addr-item__radio" aria-hidden="true" />
                <span className="addr-item__text">
                  {a.namedAddress.name && <b>{a.namedAddress.name}</b>}
                  <span>{a.namedAddress.address.value}</span>
                  {closed && a.namedAddress.workingStatusMessage && <span className="addr-item__warn">{a.namedAddress.workingStatusMessage}</span>}
                </span>
                {busy === a.id && <span className="spinner" />}
              </button>
              {!active && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Удалить адрес"
                  onClick={() => removeAddress(a.id).catch((e) => toast(errorText(e), 'error'))}
                >
                  <Icon name="trash" size={18} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const HINT: Bubble = { tone: 'hint', title: 'Передвиньте карту', text: 'Булавка укажет адрес доставки' };

/** Можно ли везти по адресу: статус от API + попадание в опубликованные зоны доставки. */
function verdict(s: AddressSuggestion, zones: DeliveryRegion[] | undefined) {
  const { lat, lng } = s.address;
  const zone = zoneAt(zones, lat, lng);
  const outside = !!zones?.length && !zone;
  const near = outside ? nearestZone(zones, lat, lng) : null;
  const ok = s.workingStatus === 'working' && !outside;
  const why = s.workingStatus !== 'working'
    ? s.workingStatusMessage || 'Сюда пока не доставляем'
    : near
      ? `Вне зон доставки · ближайшая «${near.zone.title}», ~${Math.max(1, Math.round(near.km))} км`
      : null;
  return { ok, zone, why };
}

function DeliveryTab() {
  const [q, setQ] = useState('');
  const [list, setList] = useState<AddressSuggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<AddressSuggestion | null>(null);
  const [resolving, setResolving] = useState(false);
  const [extra, setExtra] = useState({ flat: '', entrance: '', floor: '' });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapOk, setMapOk] = useState(true);
  const [fly, setFly] = useState<Fly | null>(null);
  const [bubble, setBubble] = useState<Bubble>(HINT);
  const seq = useRef(0);
  const denied = useStore(sessionStore, (s) => s.addNewDeniedMessage);
  const zones = useDeliveryRegions().data;
  const regionName = useStore(sessionStore, (x) => x.region?.name);
  const [start] = useState(() => {
    const a = activeAddress(sessionStore.get())?.namedAddress;
    if (a && !a.departmentId && a.address.lat) return { lat: a.address.lat, lng: a.address.lng, zoom: 16 };
    return /башк/i.test(sessionStore.get().region?.name ?? '') ? { lat: 56.0884, lng: 54.2486, zoom: 12 } : undefined;
  });
  // сменили регион — карта перелетает в его главный город
  const firstRegion = useRef(regionName);
  useEffect(() => {
    if (regionName === firstRegion.current) return;
    firstRegion.current = regionName;
    const c = /башк/i.test(regionName ?? '') ? { lat: 56.0884, lng: 54.2486 } : { lat: 56.8527, lng: 53.2045 };
    setFly({ ...c, zoom: 12, seq: Date.now(), quiet: true });
    setPicked(null);
    setQ('');
    setBubble(HINT);
  }, [regionName]);

  useEffect(() => {
    if (picked || q.trim().length < 3) {
      setList([]);
      return;
    }
    const t = window.setTimeout(async () => {
      setBusy(true);
      try {
        setList(await api.searchAddress(q.trim()));
      } catch {
        setList([]);
      } finally {
        setBusy(false);
      }
    }, 320);
    return () => window.clearTimeout(t);
  }, [q, picked]);

  const show = (s: AddressSuggestion) => {
    const v = verdict(s, zones);
    setPicked(s);
    setQ(s.address.value);
    setList([]);
    setBubble({ tone: v.ok ? 'ok' : 'bad', title: shortAddress(s.address), text: v.ok ? (v.zone ? `Доставляем · ${v.zone.title}` : 'Доставляем') : v.why });
  };

  // точка на карте → адрес у API магазина
  const resolve = async (lat: number, lng: number) => {
    const my = ++seq.current;
    setResolving(true);
    setErr(null);
    setBubble({ tone: 'busy', title: 'Определяем адрес…' });
    try {
      const r = await api.addressByCoordinates(lat, lng);
      if (my === seq.current) show(r.address);
    } catch {
      if (my !== seq.current) return;
      setPicked(null);
      setBubble({ tone: 'bad', title: 'Не удалось определить адрес', text: 'Сдвиньте карту или введите адрес' });
    } finally {
      if (my === seq.current) setResolving(false);
    }
  };

  const locate = () => {
    if (!navigator.geolocation) {
      setErr('Невозможно определить вашу геолокацию');
      return;
    }
    setLocating(true);
    setErr(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setLocating(false);
        if (mapOk) {
          setFly({ lat, lng, zoom: 17, seq: Date.now() }); // карта долетит и сама спросит адрес
          return;
        }
        try {
          show((await api.addressByCoordinates(lat, lng)).address);
        } catch {
          setErr('Невозможно определить адрес, введите адрес в ручную');
        }
      },
      () => {
        setLocating(false);
        setErr('Не можем вас найти. Включите местоположение в настройках браузера, чтобы не вводить адрес вручную');
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  };

  if (denied) return <p className="notice notice--warn">{denied}</p>;

  const v = picked ? verdict(picked, zones) : null;
  return (
    <div className="addr-new">
      <div className="field">
        <label className="field__label" htmlFor="addr-q">Новый адрес</label>
        <div className="addr-new__box">
          <div className={`addr-new__row${mapOk ? ' is-solo' : ''}`}>
            <input
              id="addr-q"
              className="input"
              placeholder="Введите адрес или передвиньте карту"
              value={q}
              autoComplete="street-address"
              onChange={(e) => {
                setQ(e.target.value);
                setPicked(null);
                setErr(null);
              }}
            />
            {!mapOk && (
              <button type="button" className="btn btn--ghost addr-new__geo" onClick={locate} disabled={locating} aria-label="Определить моё местоположение" title="Определить моё местоположение">
                {locating ? <span className="spinner" /> : <Icon name="target" />}
              </button>
            )}
          </div>
          {!picked && (busy || list.length > 0) && (
            <ul className={`addr-sugg${mapOk ? ' addr-sugg--float' : ''}`} role="listbox" aria-label="Найденные адреса">
              {busy && !list.length && <li className="addr-sugg__state"><span className="spinner" /></li>}
              {list.map((s, i) => (
                <li key={i} role="option" aria-selected="false">
                  <button
                    type="button"
                    onClick={() => {
                      // поиск API не считает зону (статус всегда «не работает») — уточняем адрес по точке
                      setPicked(s);
                      setQ(s.address.value);
                      setList([]);
                      if (mapOk) setFly({ lat: s.address.lat, lng: s.address.lng, zoom: 17, seq: Date.now(), quiet: true });
                      resolve(s.address.lat, s.address.lng);
                    }}
                  >
                    <Icon name="pin" size={18} />
                    <span>
                      {s.address.value}
                      {!!zones?.length && <small className={zoneAt(zones, s.address.lat, s.address.lng) ? 'is-in' : 'is-out'}>{zoneAt(zones, s.address.lat, s.address.lng)?.title ?? 'вне зон доставки'}</small>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {!picked && !busy && q.trim().length >= 3 && list.length === 0 ? (
          <p className="muted addr-new__hint">Ничего не найдено — попробуйте указать точку на карте</p>
        ) : (
          <p className="muted addr-new__hint">Например: Ижевск, Пушкинская 154</p>
        )}
      </div>

      {mapOk && (
        <ChunkBoundary fallback={MapFailed}>
        <Suspense fallback={<MapPlaceholder />}>
          <AddressMap
            pin
            start={start}
            zones={zones}
            fly={fly}
            bubble={bubble}
            onMoveStart={() => {
              seq.current++;
              setResolving(true);
              setErr(null);
            }}
            onSettle={(p) => resolve(p.lat, p.lng)}
            onLocate={locate}
            locating={locating}
            onFail={() => setMapOk(false)}
          />
        </Suspense>
        </ChunkBoundary>
      )}

      {picked && (
        <form
          className={`addr-extra${resolving ? ' is-busy' : ''}`}
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            setErr(null);
            try {
              await addCourier({ lat: picked.address.lat, lng: picked.address.lng, ...extra });
              toast('Адрес доставки сохранён', 'ok');
            } catch (e2) {
              setErr(errorText(e2));
            } finally {
              setSaving(false);
            }
          }}
        >
          <p className="addr-extra__picked"><Icon name="pin" size={18} /> {picked.address.value}</p>
          {v && !resolving && (v.ok ? (
            v.zone && <p className="addr-extra__zone"><Icon name="check" size={16} /> Зона доставки «{v.zone.title}»</p>
          ) : (
            <p className="notice notice--warn"><Icon name="alert" /> <span>{v.why} Выберите другой адрес или самовывоз.</span></p>
          ))}
          <div className="addr-extra__grid">
            <div className="field">
              <label className="field__label" htmlFor="a-flat">Кв/офис</label>
              <input id="a-flat" className="input" value={extra.flat} onChange={(e) => setExtra({ ...extra, flat: e.target.value })} />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="a-ent">Подъезд</label>
              <input id="a-ent" className="input" inputMode="numeric" value={extra.entrance} onChange={(e) => setExtra({ ...extra, entrance: e.target.value })} />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="a-floor">Этаж</label>
              <input id="a-floor" className="input" inputMode="numeric" value={extra.floor} onChange={(e) => setExtra({ ...extra, floor: e.target.value })} />
            </div>
          </div>
          <button type="submit" className="btn btn--lg btn--block" disabled={saving || resolving || !v?.ok}>
            {saving ? <span className="spinner" /> : 'Доставить сюда'}
          </button>
        </form>
      )}
      {err && <p className="notice notice--error" role="alert"><Icon name="alert" /> {err}</p>}
    </div>
  );
}

function PickupTab() {
  const deps = useDepartments();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [mapOk, setMapOk] = useState(true);
  if (deps.loading) return <div className="cart-state"><span className="spinner" /></div>;
  if (!deps.data?.length) return <p className="muted">Пока пунктов для самовывоза нет</p>;
  return (
    <div className="deps">
      {mapOk && (
        <ChunkBoundary fallback={MapFailed}>
        <Suspense fallback={<MapPlaceholder />}>
          <AddressMap
            departments={deps.data}
            activeDepartment={focus}
            onDepartment={(id) => {
              setFocus(id);
              document.getElementById('dep-' + id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }}
            onFail={() => setMapOk(false)}
          />
        </Suspense>
        </ChunkBoundary>
      )}
      {deps.data.map((d) => {
        const closed = d.workingStatus !== 'working';
        return (
          <article key={d.id} id={'dep-' + d.id} className={`dep${closed ? ' is-closed' : ''}${focus === d.id ? ' is-focus' : ''}`} onMouseEnter={() => setFocus(d.id)}>
            <h3 className="dep__title">{d.title}</h3>
            <p className="dep__addr">{d.address.value}</p>
            {scheduleLines(d.workingTimes).length > 0 && (
              <div className="dep__hours">
                <span className="label">Режим работы</span>
                {scheduleLines(d.workingTimes).map((l) => (
                  <span key={l} className="mono">{l}</span>
                ))}
              </div>
            )}
            {closed && d.workingStatusMessage && <p className="notice notice--warn"><Icon name="alert" /> {d.workingStatusMessage}</p>}
            <button
              type="button"
              className="btn btn--block"
              disabled={closed || busy !== null}
              onClick={async () => {
                setBusy(d.id);
                setErr(null);
                try {
                  await addPickup(d.id);
                  toast('Пункт самовывоза выбран', 'ok');
                } catch (e) {
                  setErr(errorText(e));
                } finally {
                  setBusy(null);
                }
              }}
            >
              {busy === d.id ? <span className="spinner" /> : 'Выбрать'}
            </button>
          </article>
        );
      })}
      {err && <p className="notice notice--error" role="alert">{err}</p>}
    </div>
  );
}

export function AddressSheet() {
  const st = useStore(uiStore, (s) => s.address);
  const [tab, setTab] = useState<'delivery' | 'pickup'>(st.tab);
  useEffect(() => {
    if (st.open) setTab(st.tab);
  }, [st.open, st.tab]);
  return (
    <Dialog open={st.open} onClose={closeAddress} variant="side" title={tab === 'pickup' ? 'Адрес самовывоза' : 'Адрес доставки'} wide>
      <div className="addr-sheet">
        <div className="seg" role="tablist" aria-label="Способ получения" style={{ ['--i' as string]: tab === 'pickup' ? 1 : 0 }}>
          <button type="button" role="tab" aria-selected={tab === 'delivery'} className={`seg__btn${tab === 'delivery' ? ' is-on' : ''}`} onClick={() => setTab('delivery')}>
            <Icon name="truck" size={20} /> Доставка
          </button>
          <button type="button" role="tab" aria-selected={tab === 'pickup'} className={`seg__btn${tab === 'pickup' ? ' is-on' : ''}`} onClick={() => setTab('pickup')}>
            <Icon name="store" size={20} /> Самовывоз
          </button>
        </div>
        <RegionSwitch />
        <p className="muted addr-sheet__lead">От указанного адреса и способа получения зависят ассортимент и время доставки</p>
        {st.pending && (
          <p className="notice notice--info">
            <Icon name="box" /> После выбора адреса «{st.pending.product.info.title}» добавится в корзину
          </p>
        )}
        <SavedAddresses kind={tab} />
        {tab === 'delivery' ? <DeliveryTab /> : <PickupTab />}
      </div>
    </Dialog>
  );
}
