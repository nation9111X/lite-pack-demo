import { Link } from 'react-router-dom';
import { BoxScene } from '../components/BoxScene';
import { LazyImg } from '../components/LazyImg';
import { scrollToEl } from '../lib/smooth';
import { Icon } from '../components/Icon';
import { MakerTape } from '../components/Maker';
import { CatalogStats } from '../components/CatalogStats';
import { Conveyor } from '../components/Conveyor';
import { Dieline } from '../components/Dieline';
import { SCENARIOS } from '../lib/kits';
import { OFFICES, useCategoryTree, useSettings } from '../hooks/data';
import { orgJsonLd, useSeo } from '../lib/seo';
import { useReveal } from '../lib/motion';
import { imgSrcSet, imgUrl } from '../lib/img';
import { phoneHref, plural } from '../lib/format';
import type { Category } from '../api/types';
import './home.css';

function CategoryTile({ c, big, index }: { c: Category; big?: boolean; index: number }) {
  const subs = c.subCategories;
  return (
    <article className={`ctile${big ? ' ctile--big' : ''}`} data-reveal style={{ transitionDelay: `${(index % 4) * 60}ms` }}>
      <div className="ctile__text">
        <span className="ctile__n mono">{String(index + 1).padStart(2, '0')}</span>
        <h3 className="ctile__title">
          <Link to={`/category/${c.id}`}>{c.title}</Link>
        </h3>
        {subs.length > 0 && (
          <span className="ctile__meta mono">
            {subs.length} {plural(subs.length, 'раздел', 'раздела', 'разделов')}
          </span>
        )}
        {big && subs.length > 0 && (
          <ul className="ctile__subs" role="list">
            {subs.slice(0, 6).map((s) => (
              <li key={s.id}>
                <Link to={`/category/${s.id}`}>{s.title}</Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      {c.imageUrl && (
        // Иллюстрации разделов — тяжёлые PNG (506 px ≈ 290 КБ): крупная только для главной плитки
        <LazyImg
          className="ctile__img"
          srcSet={big ? imgSrcSet(c.imageUrl) : undefined}
          sizes={big ? '(min-width: 1024px) 40vw, 90vw' : undefined}
          alt=""
          width={big ? 506 : 180}
          height={big ? 506 : 180}
          src={imgUrl(c.imageUrl, big ? 506 : 180)}
        />
      )}
      <span className="ctile__go" aria-hidden="true"><Icon name="arrowRight" size={20} /></span>
    </article>
  );
}

function RootSection({ c }: { c: Category }) {
  if (!c.subCategories.length) return null;
  return (
    <section className="rsec" aria-labelledby={`rs-${c.id}`} data-reveal>
      <div className="section__head">
        <h2 className="section__title" id={`rs-${c.id}`}>{c.title}</h2>
        <Link to={`/category/${c.id}`} className="section__link">
          Показать все <Icon name="arrowRight" size={18} />
        </Link>
      </div>
      <ul className="rsec__row" role="list">
        {c.subCategories.map((s) => (
          <li key={s.id}>
            <Link to={`/category/${s.id}`} className="stile">
              <span className="stile__title">{s.title}</span>
              {s.imageUrl && <LazyImg alt="" width={180} height={180} src={imgUrl(s.imageUrl, 180)} />}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const STEPS = [
  { icon: 'pin' as const, title: 'Укажите адрес или самовывоз', text: 'От указанного адреса и способа получения зависят ассортимент и время доставки.' },
  { icon: 'box' as const, title: 'Соберите корзину', text: 'Товары продаются упаковками — кратность и остаток указаны на каждой карточке.' },
  { icon: 'check' as const, title: 'Оформите заказ', text: 'Войдите по номеру телефона, выберите время получения и способ оплаты.' },
];

export function HomePage() {
  const tree = useCategoryTree();
  const settings = useSettings();
  const cats = tree.data ?? [];
  useSeo({ path: '/', description: 'Производство и продажа упаковки', jsonLd: { ...orgJsonLd, '@type': 'Organization' } });
  useReveal([cats.length]);

  return (
    <div className="home">
      <section className="hero" aria-labelledby="hero-title">
        <div className="container hero__grid">
          <div className="hero__text">
            <p className="hero__stamp mono">
              <Icon name="pin" size={16} /> Ижевск · Нефтекамск
            </p>
            <h1 id="hero-title" className="hero__title">
              Производство и&nbsp;продажа <span className="hero__tag">упаковки</span>
            </h1>
            <p className="hero__lead">
              Одноразовая посуда, упаковка и пакеты, бытовая химия и хозтовары — в одном каталоге с ценами и остатками вашего региона.
            </p>
            <div className="hero__cta">
              <a
                href="#catalog"
                className="btn btn--lg"
                data-magnetic
                onClick={(e) => {
                  const el = document.getElementById('catalog');
                  if (!el) return;
                  e.preventDefault();
                  scrollToEl(el);
                }}
              >
                <span className="hero__cta-long">Перейти в каталог</span>
                <span className="hero__cta-short">В каталог</span>
                <Icon name="arrowRight" />
              </a>
              <Link to="/podbor" className="btn btn--lg btn--ghost" data-magnetic>
                <span className="btn__ring" aria-hidden="true"><i /></span>
                <Icon name="box" /> Подобрать упаковку
              </Link>
            </div>
            <CatalogStats className="hero__stats" />
          </div>
          <div className="hero__art">
            <Dieline />
            <BoxScene />
            <span className="hero__hint" aria-hidden="true">↔ покрутите коробку</span>
          </div>
          <nav className="hero__chips chips" aria-label="Разделы каталога">
            {cats.map((c) => (
              <Link key={c.id} to={`/category/${c.id}`} className="chip">
                {c.title}
              </Link>
            ))}
            {tree.loading && Array.from({ length: 6 }, (_, i) => <span key={i} className="chip skeleton" style={{ width: 140 }} />)}
          </nav>
        </div>
      </section>

      <Conveyor />

      <section className="container section" id="catalog" aria-labelledby="catalog-title">
        <div className="section__head">
          <h2 className="section__title" id="catalog-title">Каталог товаров</h2>
          {cats.length > 0 && <span className="page__count">{cats.length} {plural(cats.length, 'раздел', 'раздела', 'разделов')}</span>}
        </div>
        {tree.error && (
          <div className="empty">
            <h2>Что-то пошло не так</h2>
            <p>{tree.error}</p>
            <button type="button" className="btn" onClick={tree.reload}>Обновить</button>
          </div>
        )}
        <div className="bento">
          {cats.map((c, i) => (
            <CategoryTile key={c.id} c={c} big={i === 0} index={i} />
          ))}
          {tree.loading && Array.from({ length: 9 }, (_, i) => <div key={i} className={`ctile skeleton${i === 0 ? ' ctile--big' : ''}`} />)}
        </div>
      </section>

      <section className="container section" aria-labelledby="podpromo-title" data-reveal>
        <div className="podpromo">
          <div className="podpromo__text">
            <p className="podpromo__kicker mono"><Icon name="box" size={16} /> Консультант</p>
            <h2 className="podpromo__title" id="podpromo-title">Не знаете, что взять? Соберём комплект за&nbsp;полминуты</h2>
            <p>Три вопроса — и упаковка из каталога с ценами и количеством под ваш объём заказов.</p>
          </div>
          <nav className="podpromo__chips" aria-label="Что упаковываете">
            {SCENARIOS.map((s) => (
              <Link key={s.key} to={`/podbor?s=${s.key}`} className="chip">{s.title}</Link>
            ))}
          </nav>
          <Link to="/podbor" className="btn btn--lg btn--accent podpromo__cta" data-magnetic>
            Подобрать упаковку <Icon name="arrowRight" />
          </Link>
        </div>
      </section>

      <MakerTape />

      <section className="container section steps" aria-labelledby="steps-title">
        <h2 className="section__title" id="steps-title">Как заказать</h2>
        <ol className="steps__list">
          {STEPS.map((s, i) => (
            <li key={s.title} className="step" data-reveal style={{ transitionDelay: `${i * 80}ms` }}>
              <span className="step__n">{i + 1}</span>
              <Icon name={s.icon} size={28} className="step__icon" />
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="container">
        {cats.map((c) => (
          <RootSection key={c.id} c={c} />
        ))}
      </div>

      <section className="container section contacts-band" aria-labelledby="contacts-title" data-reveal>
        <div className="contacts-band__head">
          <h2 className="section__title" id="contacts-title">Связаться с нами</h2>
          <p className="muted">Поддержка клиентов в Ижевске и Нефтекамске.</p>
        </div>
        <div className="contacts-band__grid">
          {OFFICES.map((o) => (
            <article key={o.city} className="office regmarks">
              <span className="label">{o.city}</span>
              <p className="office__addr">{o.address}</p>
              <a href={phoneHref(o.phone)} className="office__phone">{o.phone}</a>
              <a href={`mailto:${o.email}`} className="office__mail">{o.email}</a>
              <a className="link office__map" href={`https://yandex.ru/maps/?pt=${o.lng},${o.lat}&z=17&l=map`} target="_blank" rel="noopener">
                Открыть на карте <Icon name="external" size={16} />
              </a>
            </article>
          ))}
        </div>
      </section>

      {(settings.data?.iosapp || settings.data?.androidapp) && (
        <section className="container section apps" aria-labelledby="apps-title" data-reveal>
          <div className="apps__card">
            <div>
              <h2 className="section__title" id="apps-title">Скачайте приложение</h2>
              <p className="muted">Каталог, корзина и заказы — в телефоне.</p>
            </div>
            <div className="apps__links">
              {settings.data?.iosapp && <a className="btn btn--ghost" href={settings.data.iosapp} target="_blank" rel="noopener">App Store</a>}
              {settings.data?.androidapp && <a className="btn btn--ghost" href={settings.data.androidapp} target="_blank" rel="noopener">Google Play</a>}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
