import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as api from '../api/endpoints';
import type { Product, SearchCategory } from '../api/types';
import { useCatalogParams } from '../hooks/data';
import { ProductCard, ProductGridSkeleton } from '../components/ProductCard';
import { ProductToolbar, sortProducts } from './Category';
import { EmptyBox } from '../components/EmptyBox';
import { SearchBox } from '../components/SearchBox';
import { useSeo } from '../lib/seo';
import { goal, hitSearch } from '../lib/metrika';
import { errorText } from '../api/client';
import './category.css';

const PAGE = 40;

export default function SearchPage() {
  const [sp] = useSearchParams();
  const q = (sp.get('q') ?? '').trim();
  const { key, params } = useCatalogParams();
  const [cats, setCats] = useState<SearchCategory[]>([]);
  const [items, setItems] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useSeo({ title: q ? `Поиск: ${q}` : 'Поиск', noindex: true });

  useEffect(() => {
    setItems([]);
    setCats([]);
    setPage(1);
    if (!q) return;
    let alive = true;
    setBusy(true);
    setErr(null);
    api
      .search(q, params, 1, PAGE)
      .then((r) => {
        if (!alive) return;
        setCats(r.categories);
        setItems(r.products);
        setMore(r.products.length >= PAGE);
        hitSearch(q, r.products.length + r.categories.length);
      })
      .catch((e) => alive && setErr(errorText(e)))
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, key]);

  const loadMore = async () => {
    setBusy(true);
    try {
      const r = await api.search(q, params, page + 1, PAGE);
      const seen = new Set(items.map((p) => p.id));
      setItems([...items, ...r.products.filter((p) => !seen.has(p.id))]);
      setPage(page + 1);
      setMore(r.products.length >= PAGE);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const sort = (sp.get('sort') as never) || 'default';
  const stockOnly = sp.get('stock') === '1';
  const shown = useMemo(() => sortProducts(items, sort, stockOnly), [items, sort, stockOnly]);

  return (
    <div className="container page">
      <header className="page__head">
        <p className="label">Поиск</p>
        <h1 className="page__title">{q ? `«${q}»` : 'Искать товары и категории'}</h1>
      </header>
      {!q && <div style={{ maxWidth: 640 }}><SearchBox autoFocus /></div>}
      {cats.length > 0 && (
        <nav className="chips catpage__chips" aria-label="Найденные категории">
          {cats.map((c) => (
            <Link
              key={c.id}
              to={c.kind === 'brand' ? `/brand/${c.id}` : c.kind === 'plant' ? `/plant/${c.id}` : `/category/${c.id}`}
              className="chip"
              onClick={() => goal('search_category_click', { category: c.title, search: q })}
            >
              {c.parentTitle && <span className="chip__n">{c.parentTitle} /</span>} {c.title}
            </Link>
          ))}
        </nav>
      )}
      {busy && !items.length && <ProductGridSkeleton />}
      {err && <p className="notice notice--error">{err}</p>}
      {items.length > 0 && (
        <>
          <h2 className="sr-only">Товары</h2>
          <ProductToolbar total={items.length} shown={shown.length} />
          <div className="pgrid">
            {shown.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          {more && (
            <div style={{ display: 'grid', placeItems: 'center', marginTop: 24 }}>
              <button type="button" className="btn btn--ghost btn--lg" onClick={loadMore} disabled={busy}>
                {busy ? <span className="spinner" /> : 'Показать ещё'}
              </button>
            </div>
          )}
        </>
      )}
      {q && !busy && !err && !items.length && !cats.length && (
        <div className="empty">
          <EmptyBox className="empty__art" />
          <h2>Ничего не найдено</h2>
          <p>По Вашему запросу ничего не найдено</p>
          <Link to="/" className="btn">Перейти в каталог</Link>
        </div>
      )}
    </div>
  );
}
