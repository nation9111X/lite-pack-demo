import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as api from '../api/endpoints';
import type { Category, Product } from '../api/types';
import { useCatalogParams, useCategoryTree } from '../hooks/data';
import { useQuery } from '../lib/query';
import { useSeo } from '../lib/seo';
import { useStore } from '../lib/store';
import { Icon } from '../components/Icon';
import { Rolling } from '../components/Rolling';
import { imgUrl } from '../lib/img';
import { inStock, maxQty, money, n, plural, stepOf, unitOf } from '../lib/format';
import { cartStore, qtyIn, setQty } from '../store/cart';
import { activeAddress, sessionStore } from '../store/session';
import { openAddress, setCartOpen, toast } from '../store/ui';
import { burst, flyToCart } from '../lib/motion';
import { scrollToEl } from '../lib/smooth';
import { LIDS_CAT, PRIORITIES, SCENARIOS, VOLUMES, piecesPerUnit, rank, type KitRole, type Priority, type Scenario } from '../lib/kits';
import './podbor.css';

type Answers = { scn?: string; pri?: Priority; vol?: number };

function findCat(list: Category[] | undefined, id: string): Category | null {
  for (const c of list ?? []) {
    if (c.id === id) return c;
    const sub = findCat(c.subCategories, id);
    if (sub) return sub;
  }
  return null;
}

/** «Консультант печатает…» перед каждой новой репликой. */
function useReveal(target: number) {
  return { shown: target, typing: false };
}

function Bot({ children, last }: { children: ReactNode; last?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (last && ref.current && ref.current.getBoundingClientRect().bottom > window.innerHeight - 40) scrollToEl(ref.current, -120);
  }, [last]);
  return (
    <div className="msg msg--bot" ref={ref}>
      <span className="msg__ava" aria-hidden="true"><Icon name="box" size={20} /></span>
      <div className="msg__body">{children}</div>
    </div>
  );
}

function Me({ text, onEdit }: { text: string; onEdit: () => void }) {
  return (
    <div className="msg msg--me">
      <p className="msg__bubble">{text}</p>
      <button type="button" className="msg__edit" onClick={onEdit}>Изменить</button>
    </div>
  );
}

type Row = { role: KitRole; list: Product[]; p: Product | null; i: number };

/** Комплект: товары по ролям сценария — из живого каталога для адреса покупателя. */
function Kit({ scn, pri, vol, onRestart }: { scn: Scenario; pri: Priority; vol: number; onRestart: () => void }) {
  const { key, params } = useCatalogParams();
  const [lids, setLids] = useState<Record<string, string[]> | null>(null);
  const [days, setDays] = useState(7);
  const [pick, setPick] = useState<Record<string, number>>({});
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(scn.roles.map((r) => [r.key, !r.optional])));
  const [over, setOver] = useState<Record<string, number>>({});
  const btn = useRef<HTMLButtonElement>(null);
  useStore(cartStore, (s) => s.bump); // перерисовать после «в корзину»

  useEffect(() => {
    import('../lib/lids').then((m) => setLids(m.LIDS)).catch(() => setLids({}));
  }, []);

  const cats = useMemo(() => [...new Set([...scn.roles.flatMap((r) => r.cats), ...(scn.roles.some((r) => r.lidFor) ? [LIDS_CAT] : [])])], [scn]);
  const q = useQuery(`kit:${scn.key}:${key}`, async () => {
    const lists = await Promise.all(cats.map((id) => api.getCategoryProducts(id, params).then((r) => r.products ?? []).catch(() => [] as Product[])));
    return Object.fromEntries(cats.map((id, i) => [id, lists[i]])) as Record<string, Product[]>;
  });

  const rows = useMemo<Row[]>(() => {
    const byCat = q.data;
    if (!byCat || !lids) return [];
    const pool = new Map<string, Product>();
    Object.values(byCat).forEach((l) => l.forEach((p) => pool.set(p.id, p)));
    const lidsOf = (p: Product | null) => (p ? (lids[p.id] ?? []).map((id) => pool.get(id)).filter((x): x is Product => !!x && inStock(x)) : []);
    // уже закрывается: «с крышкой», коробки с клапаном
    const complete = (p: Product) => /(^|\s)(с|со)\s+(\S+\s+){0,2}\S*крышк|^коробк/i.test(p.info.title);
    const out: Row[] = [];
    const chosen: Record<string, Product | null> = {};
    for (const role of scn.roles) {
      let list: Product[];
      if (role.lidFor) {
        const base = chosen[role.lidFor];
        list = base && !complete(base) ? rank(lidsOf(base), pri) : [];
      } else {
        const seen = new Set<string>();
        list = role.cats
          .flatMap((c) => byCat[c] ?? [])
          .filter((p) => !seen.has(p.id) && (seen.add(p.id), true))
          .filter((p) => inStock(p) && (!role.inc || role.inc.test(p.info.title)) && (!role.exc || !role.exc.test(p.info.title)));
        list = rank(list, pri, vol * 7, role.prefer);
        // к основанию нужна крышка — сначала те, к которым она есть в наличии (или уже в комплекте)
        if (scn.roles.some((r) => r.lidFor === role.key)) list = [...list.filter((p) => complete(p) || lidsOf(p).length), ...list.filter((p) => !complete(p) && !lidsOf(p).length)];
      }
      const i = list.length ? (pick[role.key] ?? 0) % list.length : 0;
      const p = list[i] ?? null;
      chosen[role.key] = on[role.key] ? p : null;
      out.push({ role, list, p, i });
    }
    return out.filter((r) => r.list.length && (!r.role.lidFor || chosen[r.role.lidFor]));
  }, [q.data, lids, scn, pri, vol, pick, on]);

  /** Сколько штук: по 1 на заказ, округлить до целых упаковок; крышек — не меньше, чем оснований. */
  const need = (r: Row): number => {
    const step = stepOf(r.p!);
    const base = r.role.lidFor ? rows.find((x) => x.role.key === r.role.lidFor) : null;
    const pieces = base?.p ? units(base) * piecesPerUnit(base.p) : vol * days;
    return over[`${r.role.key}:${r.p!.id}`] ?? Math.ceil(pieces / piecesPerUnit(r.p!) / step) * step;
  };
  const cap = (r: Row) => Math.floor(maxQty(r.p!) / stepOf(r.p!)) * stepOf(r.p!) || stepOf(r.p!);
  const units = (r: Row): number => (r.p ? Math.max(stepOf(r.p), Math.min(need(r), cap(r))) : 0);
  const active = rows.filter((r) => r.p && on[r.role.key]);
  const total = active.reduce((a, r) => a + units(r) * r.p!.finalPrice, 0);

  const addAll = () => {
    if (!activeAddress(sessionStore.get())) {
      openAddress();
      toast('Выберите адрес — от него зависят цены и наличие. Потом нажмите «В корзину» ещё раз', 'info');
      return;
    }
    const st = cartStore.get();
    for (const r of active) setQty(r.p!, qtyIn(st, r.p!.id) + units(r));
    burst(undefined, undefined, btn.current);
    flyToCart(btn.current);
    toast(`Комплект в корзине: ${n(active.length)} ${plural(active.length, 'товар', 'товара', 'товаров')}`, 'ok', { label: 'Открыть', run: () => setCartOpen(true) });
  };

  if (q.loading || !lids) {
    return (
      <div className="slip slip--load" aria-busy="true">
        <span className="spinner" /> Собираю комплект из каталога…
      </div>
    );
  }
  if (!rows.some((r) => !r.role.lidFor)) {
    return (
      <div className="slip">
        <p>Сейчас подходящих товаров нет в наличии для вашего адреса. Загляните в каталог или выберите другой адрес.</p>
        <button type="button" className="btn btn--ghost" onClick={onRestart}>Подобрать заново</button>
      </div>
    );
  }

  return (
    <section className="slip" aria-label="Комплект упаковки">
      <header className="slip__head">
        <div>
          <p className="slip__kicker mono">Упаковочный лист</p>
          <h2 className="slip__title">{scn.title}</h2>
        </div>
        <div className="slip__days" role="group" aria-label="Запас">
          {[[7, 'на неделю'], [30, 'на месяц']].map(([d, t]) => (
            <button key={d} type="button" className={`chip${days === d ? ' is-on' : ''}`} aria-pressed={days === d} onClick={() => { setDays(d as number); setOver({}); }}>
              {t}
            </button>
          ))}
        </div>
      </header>
      <p className="slip__lead">≈ {n(vol)} заказов в день · по 1 шт. на заказ, округлено до целых упаковок. Количество можно поменять.</p>

      <ol className="slip__list">
        {rows.map((r) => {
          const p = r.p!;
          const isOn = !!on[r.role.key];
          const u = units(r);
          const step = stepOf(p);
          const setU = (v: number) => setOver((o) => ({ ...o, [`${r.role.key}:${p.id}`]: v }));
          return (
            <li key={r.role.key} className={`kitrow${isOn ? '' : ' is-off'}${r.role.lidFor ? ' is-lid' : ''}`}>
              <label className="kitrow__chk">
                <input type="checkbox" checked={isOn} onChange={(e) => setOn((o) => ({ ...o, [r.role.key]: e.target.checked }))} />
                <span className="sr-only">Добавить в комплект: {r.role.title}</span>
              </label>
              <Link to={`/product/${p.id}`} className="kitrow__img" tabIndex={-1} aria-hidden="true">
                {p.info.imageUrls[0] && <img key={p.id} src={imgUrl(p.info.imageUrls[0], 180)} alt="" width={64} height={64} loading="lazy" />}
              </Link>
              <div className="kitrow__info">
                <span className="kitrow__role mono">{r.role.lidFor ? '↳ ' : ''}{r.role.title}</span>
                <Link to={`/product/${p.id}`} className="kitrow__name" key={p.id}>{p.info.title}</Link>
                <span className="kitrow__meta mono">
                  {money(p.finalPrice)}/{unitOf(p)}{step > 1 && ` · уп. ${n(step)} ${unitOf(p)}`}
                  {piecesPerUnit(p) > 1 && ` · в упаковке ${n(piecesPerUnit(p))}`}
                </span>
                {isOn && need(r) > cap(r) && <span className="kitrow__warn">В наличии только {n(cap(r))} {unitOf(p)}</span>}
                {r.list.length > 1 && (
                  <button type="button" className="kitrow__swap" onClick={() => setPick((x) => ({ ...x, [r.role.key]: r.i + 1 }))} disabled={!isOn}>
                    <Icon name="refresh" size={16} /> Другой вариант <span className="mono">{r.i + 1}/{r.list.length}</span>
                  </button>
                )}
              </div>
              {isOn && (
                <div className="kitrow__qty">
                  <div className="kstep" role="group" aria-label={`Количество: ${p.info.title}`}>
                    <button type="button" onClick={() => setU(u - step)} disabled={u <= step} aria-label="Меньше на упаковку"><Icon name="minus" size={16} /></button>
                    <output>{n(u)} <small>{unitOf(p)}</small></output>
                    <button type="button" onClick={() => setU(u + step)} disabled={u + step > maxQty(p)} aria-label="Больше на упаковку"><Icon name="plus" size={16} /></button>
                  </div>
                  <b className="kitrow__sum"><Rolling value={u * p.finalPrice} format={money} /></b>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <footer className="slip__foot">
        <div className="slip__total">
          <span className="label">Итого за комплект</span>
          <b><Rolling value={total} format={money} /></b>
        </div>
        <button ref={btn} type="button" className="btn btn--lg slip__cta" onClick={addAll} disabled={!active.length}>
          <Icon name="box" /> Положить всё в корзину
        </button>
        <button type="button" className="link slip__again" onClick={onRestart}>Подобрать заново</button>
      </footer>
      <p className="slip__note muted">Цены и наличие — для {activeAddress(sessionStore.get()) ? 'вашего адреса' : 'региона по умолчанию; выберите адрес, чтобы увидеть свои'}. Перед оформлением всё можно поправить в корзине.</p>
    </section>
  );
}

export default function PodborPage() {
  const [sp] = useSearchParams();
  const tree = useCategoryTree();
  const [a, setA] = useState<Answers>(() => {
    const s = sp.get('s');
    return SCENARIOS.some((x) => x.key === s) ? { scn: s! } : {};
  });
  const scn = SCENARIOS.find((x) => x.key === a.scn);
  const answered = a.scn ? (a.pri ? (a.vol ? 3 : 2) : 1) : 0;
  const { shown, typing } = useReveal(answered + 1);

  useSeo({
    title: 'Подбор упаковки',
    description: 'Консультант Лайт-Пак: ответьте на три вопроса — соберём комплект упаковки для суши, пиццы, фастфуда, супов, десертов и кофе с ценами вашего региона.',
    path: '/podbor',
  });

  return (
    <div className="container page podbor">
      <header className="podbor__head">
        <p className="hero__stamp mono"><Icon name="box" size={16} /> Консультант</p>
        <h1 className="page__title">Подбор упаковки</h1>
        <p className="podbor__lead">Три вопроса — и комплект из нашего каталога с ценами и количеством под ваш объём.</p>
      </header>

      <div className="chat" aria-live="polite">
        {shown >= 1 && (
          <Bot last={shown === 1}>
            <p className="msg__bubble">Здравствуйте! Соберу упаковку под ваше заведение. Что вы упаковываете?</p>
            {!a.scn && (
              <div className="scn">
                {SCENARIOS.map((s) => {
                  const img = findCat(tree.data, s.cover)?.imageUrl;
                  return (
                    <button key={s.key} type="button" className="scn__tile" onClick={() => setA({ scn: s.key })}>
                      <span className="scn__img">{img && <img src={imgUrl(img, 180)} alt="" width={96} height={96} loading="lazy" />}</span>
                      <span className="scn__t">{s.title}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </Bot>
        )}
        {scn && <Me text={scn.title} onEdit={() => setA({})} />}

        {scn && shown >= 2 && (
          <Bot last={shown === 2}>
            <p className="msg__bubble">{scn.tip}</p>
            <p className="msg__bubble">Что для вас важнее?</p>
            {!a.pri && (
              <div className="opts">
                {PRIORITIES.map((x) => (
                  <button key={x.key} type="button" className="opt" onClick={() => setA({ ...a, pri: x.key })}>
                    <b>{x.title}</b>
                    <span>{x.text}</span>
                  </button>
                ))}
              </div>
            )}
          </Bot>
        )}
        {a.pri && <Me text={PRIORITIES.find((x) => x.key === a.pri)!.title} onEdit={() => setA({ scn: a.scn })} />}

        {a.pri && shown >= 3 && (
          <Bot last={shown === 3}>
            <p className="msg__bubble">Сколько примерно заказов в день? Посчитаю количество с запасом на неделю.</p>
            {!a.vol && (
              <div className="opts opts--row">
                {VOLUMES.map((v) => (
                  <button key={v} type="button" className="opt opt--num" onClick={() => setA({ ...a, vol: v })}>
                    <b>{v === VOLUMES[VOLUMES.length - 1] ? `${v}+` : v}</b>
                    <span>{plural(v, 'заказ', 'заказа', 'заказов')}</span>
                  </button>
                ))}
              </div>
            )}
          </Bot>
        )}
        {a.vol && <Me text={`≈ ${a.vol} ${plural(a.vol, 'заказ', 'заказа', 'заказов')} в день`} onEdit={() => setA({ scn: a.scn, pri: a.pri })} />}

        {scn && a.pri && a.vol && shown >= 4 && (
          <Bot last={shown === 4}>
            <p className="msg__bubble">Готово! Вот что я бы взял. Любую позицию можно заменить, убрать или поменять количество.</p>
            <Kit key={`${scn.key}:${a.pri}:${a.vol}`} scn={scn} pri={a.pri} vol={a.vol} onRestart={() => setA({})} />
          </Bot>
        )}

        {typing && (
          <div className="msg msg--bot">
            <span className="msg__ava" aria-hidden="true"><Icon name="box" size={20} /></span>
            <span className="typing" aria-label="Консультант печатает"><i /><i /><i /></span>
          </div>
        )}
      </div>
    </div>
  );
}
