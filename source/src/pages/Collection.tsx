import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import * as api from '../api/endpoints';
import { useCatalogParams } from '../hooks/data';
import { useQuery } from '../lib/query';
import { Breadcrumbs } from '../components/Footer';
import { ProductCard, ProductGridSkeleton } from '../components/ProductCard';
import { ProductToolbar, sortProducts } from './Category';
import { NotFoundPage } from './NotFound';
import { MAKERS, MakerStamp, MakerTape, makerLabel } from '../components/Maker';
import { inStock, money, n } from '../lib/format';
import { useSeo } from '../lib/seo';
import './category.css';

/** Товары бренда или производителя (v1/brands/:id, v1/plants/:id). */
export default function CollectionPage({ kind }: { kind: 'brand' | 'plant' }) {
  const { id = '' } = useParams();
  const [sp] = useSearchParams();
  const { key, params } = useCatalogParams();
  const q = useQuery(`cat:${kind}:${id}:${key}`, () => (kind === 'brand' ? api.getBrand(id, params) : api.getPlant(id, params)));
  const r = q.data as (typeof q.data & { brand?: { title: string; imageUrl?: string | null }; plant?: { title: string; imageUrl?: string | null } }) | undefined;
  const title = (kind === 'brand' ? r?.brand?.title : r?.plant?.title) ?? r?.category?.title ?? '';
  const label = makerLabel(kind);
  const products = r?.products ?? [];
  const sort = (sp.get('sort') as never) || 'default';
  const stockOnly = sp.get('stock') === '1';
  const shown = useMemo(() => sortProducts(products, sort, stockOnly), [products, sort, stockOnly]);
  const stats = useMemo(() => {
    const live = products.filter(inStock);
    return { live: live.length, from: live.length ? Math.min(...live.map((p) => p.finalPrice)) : 0 };
  }, [products]);

  useSeo(title ? { title: `${label} ${title}`, description: `${label} ${title}: товары в каталоге Лайт-Пак`, path: `/${kind}/${id}` } : null);

  if (q.error && !r) return <NotFoundPage />;
  return (
    <div className="container page catpage">
      <Breadcrumbs items={[{ name: 'Каталог', to: '/' }, { name: title ? `${label}: ${title}` : label }]} />
      <header className="page__head colhead">
        {title ? <MakerStamp key={id} r={{ id, title, imageUrl: (kind === 'brand' ? r?.brand : r?.plant)?.imageUrl ?? MAKERS.find((m) => m.id === id)?.imageUrl }} size={88} /> : <span className="mstamp skeleton" style={{ width: 88, height: 88 }} />}
        <div>
          <p className="label">{label}</p>
          <h1 className="page__title">{title || '…'}</h1>
          {stats.live > 0 && (
            <p className="colhead__meta">
              {stats.live > 0 && <span>в наличии <b>{n(stats.live)}</b></span>}
              {stats.from > 0 && <span>цены от <b>{money(stats.from)}</b></span>}
            </p>
          )}
        </div>
      </header>
      {q.loading && <ProductGridSkeleton />}
      {products.length > 0 && (
        <>
          <h2 className="sr-only">Товары</h2>
          <ProductToolbar total={products.length} shown={shown.length} />
          <div className="pgrid pgrid--wide">
            {shown.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </>
      )}
      {r && !products.length && <div className="empty"><p>Товары для выбранного адреса не найдены</p></div>}
      {!q.loading && <MakerTape inner exclude={id} title="Другие бренды и производители" />}
    </div>
  );
}
