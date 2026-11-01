import { useEffect, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { findPath, useCategory, useCategoryTree } from '../hooks/data';
import { Breadcrumbs } from '../components/Footer';
import { ProductCard, ProductGridSkeleton } from '../components/ProductCard';
import { Icon } from '../components/Icon';
import { LazyImg } from '../components/LazyImg';
import { Select } from '../components/Select';
import { NotFoundPage } from './NotFound';
import { breadcrumbsLd, useSeo } from '../lib/seo';
import { goal } from '../lib/metrika';
import { imgUrl } from '../lib/img';
import { goodsCount, inStock } from '../lib/format';
import type { Category, Product } from '../api/types';
import './category.css';

type Sort = 'default' | 'price-asc' | 'price-desc' | 'name';
const SORTS: { v: Sort; label: string }[] = [
  { v: 'default', label: 'По умолчанию' },
  { v: 'price-asc', label: 'Сначала дешевле' },
  { v: 'price-desc', label: 'Сначала дороже' },
  { v: 'name', label: 'По названию' },
];

export function sortProducts(list: Product[], sort: Sort, stockOnly: boolean): Product[] {
  let out = stockOnly ? list.filter(inStock) : [...list];
  if (sort === 'price-asc') out.sort((a, b) => a.finalPrice - b.finalPrice);
  else if (sort === 'price-desc') out.sort((a, b) => b.finalPrice - a.finalPrice);
  else if (sort === 'name') out.sort((a, b) => a.info.title.localeCompare(b.info.title, 'ru'));
  else out = out.sort((a, b) => Number(inStock(b)) - Number(inStock(a)));
  return out;
}

export function ProductToolbar({ total, shown }: { total: number; shown: number }) {
  const [sp, setSp] = useSearchParams();
  const sort = (sp.get('sort') as Sort) || 'default';
  const stock = sp.get('stock') === '1';
  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(sp);
    if (v === null) next.delete(k);
    else next.set(k, v);
    setSp(next, { replace: true, preventScrollReset: true });
  };
  return (
    <div className="ptool">
      <span className="page__count">
        {shown === total ? goodsCount(total) : `${goodsCount(shown)} из ${total}`}
      </span>
      <div className="ptool__ctl">
        <label className="switch">
          <input type="checkbox" checked={stock} onChange={(e) => set('stock', e.target.checked ? '1' : null)} />
          <span className="switch__track" aria-hidden="true" />
          Только в наличии
        </label>
        <Select
          label="Сортировка"
          icon="sliders"
          value={sort}
          options={SORTS.map((s) => ({ value: s.v, label: s.label }))}
          onChange={(v) => set('sort', v === 'default' ? null : v)}
        />
      </div>
    </div>
  );
}

function SubTiles({ cats }: { cats: Category[] }) {
  return (
    <ul className="subtiles" role="list">
      {cats.map((c) => (
        <li key={c.id}>
          <Link to={`/category/${c.id}`} className="subtile">
            <span className="subtile__title">{c.title}</span>
            {c.imageUrl && <LazyImg alt="" width={180} height={180} src={imgUrl(c.imageUrl, 180)} />}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SideTree({ root, activeId }: { root: Category; activeId: string }) {
  return (
    <nav className="sidetree" aria-label={`Разделы: ${root.title}`}>
      <Link to={`/category/${root.id}`} className={`sidetree__root${root.id === activeId ? ' is-on' : ''}`}>{root.title}</Link>
      <ul role="list">
        {root.subCategories.map((s) => (
          <li key={s.id}>
            <Link to={`/category/${s.id}`} className={s.id === activeId ? 'is-on' : ''}>{s.title}</Link>
            {s.subCategories.length > 0 && (s.id === activeId || s.subCategories.some((x) => x.id === activeId)) && (
              <ul role="list">
                {s.subCategories.map((x) => (
                  <li key={x.id}>
                    <Link to={`/category/${x.id}`} className={x.id === activeId ? 'is-on' : ''}>{x.title}</Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function CategoryPage() {
  const { id = '' } = useParams();
  const [sp] = useSearchParams();
  const tree = useCategoryTree();
  const q = useCategory(id);
  const path = useMemo(() => findPath(tree.data, id), [tree.data, id]);
  const node = path[path.length - 1];
  const cat = q.data?.category ?? node;
  const title = cat?.title ?? '';

  const subs = useMemo(() => {
    const fromApi = q.data?.categories?.length ? q.data.categories : q.data?.category?.subCategories ?? [];
    const list = fromApi.length ? fromApi : node?.subCategories ?? [];
    return [...list].sort((a, b) => a.order - b.order);
  }, [q.data, node]);

  const products = q.data?.products ?? [];
  const sort = (sp.get('sort') as Sort) || 'default';
  const stockOnly = sp.get('stock') === '1';
  const shown = useMemo(() => sortProducts(products, sort, stockOnly), [products, sort, stockOnly]);

  useEffect(() => {
    if (title) goal('category_view', { category: title });
  }, [title]);

  const crumbs = [{ name: 'Каталог', to: '/' }, ...path.map((c) => ({ name: c.title, to: `/category/${c.id}` }))];
  if (!path.length && title) crumbs.push({ name: title, to: `/category/${id}` });

  useSeo(
    title
      ? {
          title,
          description: `${title} — купить в интернет-магазине Лайт-Пак${products.length ? `: ${goodsCount(products.length)} с ценами и наличием` : ''}. Производство и продажа упаковки.`,
          path: `/category/${id}`,
          image: cat?.imageUrl,
          jsonLd: breadcrumbsLd(crumbs.map((c) => ({ name: c.name, path: c.to ?? '/' }))),
        }
      : null,
  );

  if (q.error && !q.data && !node) return <NotFoundPage />;

  const root = path[0];
  const loading = q.loading && !q.data;

  return (
    <div className="container page catpage">
      <Breadcrumbs items={crumbs} />
      <div className={`catpage__layout${root && root.subCategories.length ? ' has-side' : ''}`}>
        {root && root.subCategories.length > 0 && (
          <aside className="catpage__side">
            <SideTree root={root} activeId={id} />
          </aside>
        )}
        <div className="catpage__main">
          <header className="page__head catpage__head">
            <h1 className="page__title">{title || <span className="skeleton" style={{ display: 'inline-block', width: 260, height: '1em' }} />}</h1>
          </header>

          {subs.length > 0 && (
            <>
              <nav className="chips catpage__chips" aria-label="Подкатегории">
                {subs.map((s) => (
                  <Link key={s.id} to={`/category/${s.id}`} className="chip">{s.title}</Link>
                ))}
              </nav>
              {subs.some((s) => s.subCategories?.length) ? (
                subs.map((s) => (
                  <section key={s.id} className="catpage__group" aria-labelledby={`g-${s.id}`}>
                    <div className="section__head">
                      <h2 className="catpage__gtitle" id={`g-${s.id}`}>{s.title}</h2>
                      <Link to={`/category/${s.id}`} className="section__link">Все <Icon name="arrowRight" size={18} /></Link>
                    </div>
                    <SubTiles cats={s.subCategories?.length ? s.subCategories : [s]} />
                  </section>
                ))
              ) : (
                <SubTiles cats={subs} />
              )}
            </>
          )}

          {loading && !subs.length && <ProductGridSkeleton />}

          {products.length > 0 && (
            <section aria-labelledby="goods-h" className="catpage__products">
              <h2 id="goods-h" className="sr-only">Товары</h2>
              <ProductToolbar total={products.length} shown={shown.length} />
              {shown.length ? (
                <div className="pgrid">
                  {shown.map((p, i) => (
                    <ProductCard key={p.id} product={p} categoryId={id} priority={i < 2} />
                  ))}
                </div>
              ) : (
                <div className="empty"><p>Товары в данной категории закончились</p></div>
              )}
            </section>
          )}

          {!loading && !subs.length && !products.length && q.data && (
            <div className="empty">
              <h2>Ничего не найдено</h2>
              <p>Товары для выбранного адреса не найдены</p>
              <Link to="/" className="btn">Перейти в каталог</Link>
            </div>
          )}
          {q.error && !q.data && (
            <div className="empty">
              <h2>Что-то пошло не так</h2>
              <p>{q.error}</p>
              <button type="button" className="btn" onClick={q.reload}>Обновить</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
