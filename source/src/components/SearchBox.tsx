import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import * as api from '../api/endpoints';
import type { Category, SearchCategory, SearchResponse } from '../api/types';
import { fetchQuery, peekQuery } from '../lib/query';
import { sortCats } from '../hooks/data';
import { useCatalogParams } from '../hooks/data';
import { Icon } from './Icon';
import { imgUrl } from '../lib/img';
import { money, unitOf } from '../lib/format';
import { goal, hitSearch } from '../lib/metrika';

const searchCache = new Map<string, SearchResponse>();

/** Категории из локального дерева, совпадающие с запросом (мгновенные подсказки). */
function localCategories(tree: Category[] | undefined, term: string): SearchCategory[] {
  if (!tree) return [];
  const t = term.toLowerCase();
  const out: SearchCategory[] = [];
  const walk = (list: Category[], parent: Category | null) => {
    for (const c of list) {
      if (out.length >= 4) return;
      if (c.title.toLowerCase().includes(t)) out.push({ id: c.id, kind: 'category', title: c.title, imageUrl: c.imageUrl, parentId: parent?.id ?? null, parentTitle: parent?.title ?? null });
      walk(c.subCategories, c);
    }
  };
  walk(tree, null);
  return out;
}

/** Подсветка совпадения в тексте подсказки. */
function Hl({ text, term }: { text: string; term: string }) {
  const i = term ? text.toLowerCase().indexOf(term.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + term.length)}</mark>
      {text.slice(i + term.length)}
    </>
  );
}

/** Живой поиск: подсказки категорий и товаров (combobox по WAI-ARIA). */
export function SearchBox({ autoFocus, onDone }: { autoFocus?: boolean; onDone?: () => void }) {
  const nav = useNavigate();
  const loc = useLocation();
  const { key, params } = useCatalogParams();
  const [q, setQ] = useState(() => new URLSearchParams(loc.search).get('q') ?? '');
  const [res, setRes] = useState<SearchResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const [instant, setInstant] = useState<SearchCategory[]>([]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setRes(null);
      setInstant([]);
      return;
    }
    // 1) мгновенно — категории из уже загруженного каталога, без ожидания сервера
    setInstant(localCategories(peekQuery<Category[]>('cat:tree:' + key), term));
    // 2) из кэша — сразу, если такой запрос уже был
    const ck = key + '|' + term.toLowerCase();
    const cached = searchCache.get(ck);
    if (cached) {
      setRes(cached);
      setActive(-1);
      return;
    }
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      setBusy(true);
      try {
        const r = await api.search(term, params, 1, 8, ctrl.signal);
        searchCache.set(ck, r);
        if (searchCache.size > 60) searchCache.delete(searchCache.keys().next().value as string);
        setRes(r);
        setActive(-1);
      } catch {
        /* отмена или сеть — подсказки не критичны */
      } finally {
        setBusy(false);
      }
    }, 110);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, key]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => setOpen(false), [loc.pathname]);

  const cats = (res?.categories.length ? res.categories : instant).slice(0, 4);
  const prods = res?.products.slice(0, 6) ?? [];
  const items: { href: string; onPick?: () => void }[] = [
    ...cats.map((c) => ({ href: c.kind === 'brand' ? `/brand/${c.id}` : c.kind === 'plant' ? `/plant/${c.id}` : `/category/${c.id}`, onPick: () => goal('search_category_click', { category: c.title, search: q.trim() }) })),
    ...prods.map((p) => ({ href: `/product/${p.id}` })),
  ];

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const term = q.trim();
    if (!term) return;
    if (active >= 0 && items[active]) {
      items[active].onPick?.();
      nav(items[active].href);
    } else {
      hitSearch(term, (res?.products.length ?? 0) + (res?.categories.length ?? 0));
      nav(`/search?q=${encodeURIComponent(term)}`);
    }
    setOpen(false);
    input.current?.blur();
    onDone?.();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(-1, a - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  };

  const showPanel = open && q.trim().length >= 2;
  const optId = (i: number) => `${listId}-o${i}`;

  return (
    <div className="search" ref={wrap}>
      <form role="search" onSubmit={submit} className="search__form">
        <label className="sr-only" htmlFor={listId + '-in'}>
          Искать товары и категории
        </label>
        <Icon name="search" size={20} className="search__icon" />
        <input
          ref={input}
          id={listId + '-in'}
          className="search__input"
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder="Искать товары и категории"
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            // дерево категорий для мгновенных подсказок — загружаем заранее, пока человек печатает
            fetchQuery('cat:tree:' + key, () => api.getCategories(params).then((r) => sortCats(r.categories))).catch(() => {});
          }}
          onKeyDown={onKey}
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? optId(active) : undefined}
        />
        {q && (
          <button type="button" className="search__clear" aria-label="Очистить поиск" onClick={() => { setQ(''); input.current?.focus(); }}>
            <Icon name="close" size={18} />
          </button>
        )}
        <button type="submit" className="search__go btn btn--sm">
          Найти
        </button>
      </form>

      {showPanel && (
        <div className="search__panel" id={listId} role="listbox" aria-label="Подсказки поиска">
          {busy && !res && <div className="search__state"><span className="spinner" /></div>}
          {res && !cats.length && !prods.length && <div className="search__state">По Вашему запросу ничего не найдено</div>}
          {cats.length > 0 && (
            <div className="search__cats">
              {cats.map((c, i) => (
                <Link
                  key={c.id}
                  id={optId(i)}
                  role="option"
                  aria-selected={active === i}
                  to={items[i].href}
                  className={`search__cat${active === i ? ' is-active' : ''}`}
                  onClick={() => { items[i].onPick?.(); onDone?.(); }}
                >
                  {c.parentTitle && <span className="search__cat-parent">{c.parentTitle}</span>}
                  <span><Hl text={c.title} term={q.trim()} /></span>
                </Link>
              ))}
            </div>
          )}
          {prods.map((p, j) => {
            const i = cats.length + j;
            return (
              <Link
                key={p.id}
                id={optId(i)}
                role="option"
                aria-selected={active === i}
                to={`/product/${p.id}`}
                className={`search__prod${active === i ? ' is-active' : ''}`}
                onClick={onDone}
              >
                <span className="search__thumb">
                  {p.info.imageUrls[0] && <img loading="lazy" alt="" width={48} height={48} src={imgUrl(p.info.imageUrls[0], 80)} />}
                </span>
                <span className="search__ptitle"><Hl text={p.info.title} term={q.trim()} /></span>
                <span className="search__price">
                  {money(p.finalPrice)}/{unitOf(p)}
                </span>
              </Link>
            );
          })}
          {res && (prods.length > 0 || cats.length > 0) && (
            <button type="button" className="search__all" onClick={() => submit()}>
              Показать все результаты <Icon name="arrowRight" size={18} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
