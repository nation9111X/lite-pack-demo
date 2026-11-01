import { Link } from 'react-router-dom';
import { useCategoryTree, useLegalDocs, useSettings, OFFICES } from '../hooks/data';
import { phoneHref } from '../lib/format';
import { Icon } from './Icon';
import './footer.css';
import { asset } from '../lib/base';

export function Footer() {
  const settings = useSettings();
  const tree = useCategoryTree({ defer: true });
  const docs = useLegalDocs();
  const c = settings.data?.companyDetails;
  const vk = settings.data?.contactUs?.vk_0;
  return (
    <footer className="ftr">
      <div className="ftr__tape" aria-hidden="true">
        {/* Две одинаковые половины: сдвиг ровно на 50% — бесшовный цикл без рывка */}
        <div className="ftr__track">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i}>ЛАЙТ ПАК · УПАКОВКА · ПОСУДА · ХОЗТОВАРЫ ·</span>
          ))}
        </div>
      </div>
      <div className="container ftr__grid">
        <div className="ftr__brand">
          <Link to="/" className="ftr__logo" aria-label="Лайт-Пак — на главную">
            <img loading="lazy" alt="Лайт-Пак" width={451} height={237} src={asset('/brand/logo.png')} />
          </Link>
          <p className="ftr__tagline">Производство и продажа упаковки</p>
          <div className="ftr__apps">
            {settings.data?.iosapp && (
              <a href={settings.data.iosapp} target="_blank" rel="noopener" className="ftr__app">App Store</a>
            )}
            {settings.data?.androidapp && (
              <a href={settings.data.androidapp} target="_blank" rel="noopener" className="ftr__app">Google Play</a>
            )}
            {vk && (
              <a href={vk} target="_blank" rel="noopener" className="ftr__app ftr__app--icon" aria-label="Лайт-Пак во ВКонтакте">
                <Icon name="vk" />
              </a>
            )}
          </div>
        </div>

        <nav className="ftr__col" aria-label="Каталог">
          <h2 className="ftr__h">Каталог</h2>
          <ul role="list">
            {(tree.data ?? []).map((cat) => (
              <li key={cat.id}>
                <Link to={`/category/${cat.id}`}>{cat.title}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav className="ftr__col" aria-label="Покупателям">
          <h2 className="ftr__h">Покупателям</h2>
          <ul role="list">
            <li><Link to="/faq">Частые вопросы</Link></li>
            <li><Link to="/contact-us">Связаться с нами</Link></li>
            <li><Link to="/orders">Мои заказы</Link></li>
            <li><Link to="/profile">Профиль</Link></li>
            <li><Link to="/legal">Правовая информация</Link></li>
          </ul>
        </nav>

        <div className="ftr__col">
          <h2 className="ftr__h">Поддержка клиентов</h2>
          {OFFICES.map((o) => (
            <div key={o.city} className="ftr__office">
              <span className="label">{o.city}</span>
              <a href={phoneHref(o.phone)} className="ftr__phone">{o.phone}</a>
              <a href={`mailto:${o.email}`} className="ftr__mail">{o.email}</a>
            </div>
          ))}
        </div>
      </div>

      <div className="container ftr__legal">
        {c && (
          <p className="mono">
            {c.name} · ИНН {c.inn} · КПП {c.kpp} · ОГРН {c.ogrn} · {c.legalAddress.text}
          </p>
        )}
        <ul role="list" className="ftr__docs">
          {(docs.data ?? []).filter((d) => d.key !== 'cookie-policy').slice(0, 3).map((d) => (
            <li key={d.key}><a href={d.url} target="_blank" rel="noopener">{d.title}</a></li>
          ))}
        </ul>
        <p className="muted">© {new Date().getFullYear()} Лайт-Пак</p>
      </div>
    </footer>
  );
}

export function Breadcrumbs({ items }: { items: { name: string; to?: string }[] }) {
  return (
    <nav aria-label="Навигационная цепочка" className="crumbs">
      <ol>
        {items.map((it, i) => (
          <li key={i}>
            {it.to && i < items.length - 1 ? <Link to={it.to}>{it.name}</Link> : <span aria-current={i === items.length - 1 ? 'page' : undefined}>{it.name}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
