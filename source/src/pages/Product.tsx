import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { ChunkBoundary } from '../components/ChunkBoundary';
import { Link, useLocation, useParams } from 'react-router-dom';
import { findPath, useCategory, useCategoryTree, useProduct } from '../hooks/data';
import { Breadcrumbs } from '../components/Footer';
import { AddControl, PriceTag, ProductCard } from '../components/ProductCard';
import { Icon } from '../components/Icon';
import { MakerCard } from '../components/Maker';
import { morphName } from '../lib/motion';
import { Dialog } from '../components/Dialog';
import { NotFoundPage } from './NotFound';
import { breadcrumbsLd, useSeo } from '../lib/seo';
import { ecDetail } from '../lib/metrika';
import { imgUrl } from '../lib/img';
import { inStock, n, stepOf, stockLine, unitOf } from '../lib/format';
import { useStore } from '../lib/store';
import { isAuthorized, sessionStore } from '../store/session';
import { openAuth, toast } from '../store/ui';
import * as api from '../api/endpoints';
import { errorText } from '../api/client';
import type { Product, UnitValue } from '../api/types';
import { BatchCalc } from '../components/BatchCalc';
// 3D-просмотр габаритов — ниже первого экрана, грузим отдельным файлом только на странице товара
const Dims3D = lazy(() => import('../components/Dims3D').then((m) => ({ default: m.Dims3D })));
import { parseDims } from '../lib/dims';
import './product.css';

function Gallery({ p }: { p: Product }) {
  const imgs = p.info.imageUrls;
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(false);
  useEffect(() => setI(0), [p.id]);
  if (!imgs.length)
    return (
      <div className="gallery">
        <div className="gallery__stage"><Icon name="box" size={80} /></div>
      </div>
    );
  return (
    <div className="gallery">
      <button type="button" className="gallery__stage" onClick={() => setZoom(true)} aria-label="Увеличить фото">
        <img key={imgs[i]} style={i === 0 && morphName(p.id) ? ({ viewTransitionName: morphName(p.id) } as never) : undefined} alt={p.info.title} width={506} height={506} {...{ fetchpriority: "high" }} decoding="async" src={imgUrl(imgs[i], 506)} />
        <span className="gallery__zoom"><Icon name="search" size={18} /></span>
      </button>
      {imgs.length > 1 && (
        <div className="gallery__thumbs" role="tablist" aria-label="Фотографии товара">
          {imgs.map((u, k) => (
            <button key={u} type="button" role="tab" aria-selected={k === i} className={`gallery__thumb${k === i ? ' is-on' : ''}`} onClick={() => setI(k)} aria-label={`Фото ${k + 1}`}>
              <img loading="lazy" alt="" width={64} height={64} src={imgUrl(u, 80)} />
            </button>
          ))}
        </div>
      )}
      <Dialog open={zoom} onClose={() => setZoom(false)} title={p.info.title} wide hideTitle>
        <img className="gallery__full" alt={p.info.title} width={1200} height={1200} src={imgUrl(imgs[i], 506).includes('/pimg/') ? imgUrl(imgs[i], 506) : imgs[i]} />
      </Dialog>
    </div>
  );
}

const per = (v: UnitValue | null | undefined, unit: string) =>
  v && v.value ? `${n(v.value)} ${v.unit ?? ''}${v.quantity && v.quantity !== 1 ? ` / ${n(v.quantity)} ${unit}` : ''}` : null;

function NotifyButton({ p }: { p: Product }) {
  const authorized = useStore(sessionStore, isAuthorized);
  const profileId = useStore(sessionStore, (s) => s.session?.profileId);
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn--ghost btn--block"
      disabled={done}
      onClick={async () => {
        if (!authorized) return openAuth();
        try {
          await api.setWishes([{ profileId, productId: p.id, subscribed: true } as never]);
          setDone(true);
          toast('Мы вас уведомим когда товар снова появится в продаже', 'ok');
        } catch (e) {
          toast(errorText(e), 'error');
        }
      }}
    >
      <Icon name="heart" size={18} /> {done ? 'Подписка оформлена' : 'Уведомить'}
    </button>
  );
}

export function ProductPage() {
  const { id = '' } = useParams();
  const loc = useLocation();
  const stateCat = (loc.state as { categoryId?: string } | null)?.categoryId;
  const q = useProduct(id);
  const tree = useCategoryTree({ defer: !stateCat });
  const p = q.data;
  const path = useMemo(() => (stateCat ? findPath(tree.data, stateCat) : []), [tree.data, stateCat]);
  const related = useCategory(stateCat);

  useEffect(() => {
    if (p) ecDetail(p);
  }, [p?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const crumbs = [{ name: 'Каталог', to: '/' }, ...path.map((c) => ({ name: c.title, to: `/category/${c.id}` })), ...(p ? [{ name: p.info.title }] : [])];

  useSeo(
    p
      ? {
          title: p.info.title,
          description: p.info.short || p.info.description || `${p.info.title} — купить в Лайт-Пак`,
          path: `/product/${p.id}`,
          image: p.info.imageUrls[0],
          jsonLd: [
            {
              '@context': 'https://schema.org',
              '@type': 'Product',
              name: p.info.title,
              description: p.info.description || undefined,
              image: p.info.imageUrls,
              sku: p.id,
              brand: p.brands?.[0] ? { '@type': 'Brand', name: p.brands[0].title } : undefined,
              offers: {
                '@type': 'Offer',
                url: `https://lite-pack.ru/product/${p.id}`,
                priceCurrency: 'RUB',
                price: p.finalPrice,
                availability: inStock(p) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
              },
            },
            breadcrumbsLd(crumbs.map((c) => ({ name: c.name, path: 'to' in c && c.to ? c.to : `/product/${p.id}` }))),
          ],
        }
      : null,
  );

  if (q.error && !p) return <NotFoundPage />;
  if (!p)
    return (
      <div className="container page prod" key="loading">
        <Breadcrumbs items={[{ name: 'Каталог', to: '/' }, { name: '…' }]} />
        <div className="prod__grid">
          <div className="skeleton" style={{ aspectRatio: '1', borderRadius: 28 }} />
          <div>
            <div className="skeleton" style={{ height: 40, width: '90%' }} />
            <div className="skeleton" style={{ height: 40, width: '60%', marginTop: 12 }} />
            <div className="skeleton" style={{ height: 120, marginTop: 32 }} />
          </div>
        </div>
      </div>
    );

  const unit = unitOf(p);
  const step = stepOf(p);
  const props = [...(p.properties ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const dims = parseDims(props, p.info.title);
  const pkg = p.info.packageInfo;
  const relatedList = (related.data?.products ?? []).filter((x) => x.id !== p.id).slice(0, 10);
  const available = inStock(p);

  return (
    <div className="container page prod" key={p.id}>
      <Breadcrumbs items={crumbs} />
      <div className="prod__grid">
        <Gallery p={p} />
        <div className="prod__info">
          <h1 className="prod__title">{p.info.title}</h1>
          <p className={`prod__stock mono${available ? '' : ' is-off'}`}>
            <span className="prod__dot" aria-hidden="true" /> {stockLine(p)}
          </p>

          <div className="prod__buy panel">
            <PriceTag product={p} big />
            <div className="prod__buy-ctl">
              {available ? <AddControl product={p} size="lg" /> : <NotifyButton p={p} />}
            </div>
            <ul className="prod__facts" role="list">
              {step > 1 && (
                <li><span className="label">В упаковке</span><b>{n(step)} {unit}</b></li>
              )}
              {per(pkg?.volume, unit) && (
                <li><span className="label">Объём</span><b>{per(pkg?.volume, unit)}</b></li>
              )}
              {per(pkg?.weight, unit) && (
                <li><span className="label">Вес</span><b>{per(pkg?.weight, unit)}</b></li>
              )}
            </ul>
          </div>

          {!!p.chestnyZnak && (
            <div className="notice notice--warn prod__cz">
              <span className="prod__cz-logo" aria-hidden="true">ЧЗ</span>
              <p>
                Товар подлежит маркировке в национальной системе «Честный ЗНАК»
                {p.chestnyZnakCategory ? ` (${p.chestnyZnakCategory})` : ''}.
              </p>
            </div>
          )}

          {(p.brands?.length || p.plants?.length) ? (
            <div className="makers">
              {p.brands?.map((b) => <MakerCard key={b.id} kind="brand" r={b} />)}
              {p.plants?.map((b) => <MakerCard key={b.id} kind="plant" r={b} />)}
            </div>
          ) : null}

          {available && <BatchCalc product={p} />}
        </div>
      </div>

      {dims && (
        <section className="section prod__dims" aria-labelledby="dims-title">
          <div className="section__head">
            <h2 className="section__title" id="dims-title"><Icon name="cube" size={26} /> Размеры в 3D</h2>
          </div>
          <ChunkBoundary fallback={null}>
            <Suspense fallback={<div className="dims3d-ph" aria-hidden="true" />}>
              <Dims3D dims={dims} title={p.info.title} />
            </Suspense>
          </ChunkBoundary>
        </section>
      )}

      <div className="prod__details">
        {props.length > 0 && (
          <section className="prod__sec" aria-labelledby="spec-title">
            <h2 id="spec-title" className="prod__h">Характеристики</h2>
            <dl className="spec">
              {props.map((x) => (
                <div key={x.title + x.sortOrder}>
                  <dt>{x.title}</dt>
                  <dd>{x.data}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
        {p.info.description && (
          <section className="prod__sec" aria-labelledby="desc-title">
            <h2 id="desc-title" className="prod__h">Описание</h2>
            <div className="prod__desc">
              {p.info.description.split(/\n+/).map((para, k) => (
                <p key={k}>{para}</p>
              ))}
            </div>
          </section>
        )}
      </div>

      {relatedList.length > 0 && (
        <section className="section" aria-labelledby="rel-title">
          <div className="section__head">
            <h2 className="section__title" id="rel-title">Ещё в разделе «{related.data?.category?.title ?? path[path.length - 1]?.title}»</h2>
            {stateCat && <Link to={`/category/${stateCat}`} className="section__link">Все товары <Icon name="arrowRight" size={18} /></Link>}
          </div>
          <div className="prod__related">
            {relatedList.map((x) => (
              <ProductCard key={x.id} product={x} categoryId={stateCat} />
            ))}
          </div>
        </section>
      )}

      {/* Липкая панель покупки на мобильном */}
      {available && (
        <div className="prod__sticky">
          <PriceTag product={p} />
          <div className="prod__sticky-ctl"><AddControl product={p} /></div>
        </div>
      )}
    </div>
  );
}
