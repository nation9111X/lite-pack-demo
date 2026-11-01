import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useLegalDocs } from '../hooks/data';
import { Breadcrumbs } from '../components/Footer';
import { Icon } from '../components/Icon';
import { useSeo } from '../lib/seo';
import './info.css';

export default function LegalPage() {
  const { doc } = useParams();
  const docs = useLegalDocs();
  useSeo({ title: 'Правовая информация', path: '/legal' });

  // Старые ссылки /legal/:doc ведут прямо на PDF-документ.
  useEffect(() => {
    if (!doc || !docs.data) return;
    const d = docs.data.find((x) => x.key === doc);
    if (d) window.location.replace(d.url);
  }, [doc, docs.data]);

  const list = (docs.data ?? []).filter((d) => d.key !== 'cookie-policy');
  return (
    <div className="container page info">
      <Breadcrumbs items={[{ name: 'Справка', to: '/help' }, { name: 'Правовая информация' }]} />
      <header className="page__head">
        <h1 className="page__title">Правовая информация</h1>
      </header>
      <ul className="info__links" role="list">
        {list.map((d) => (
          <li key={d.key}>
            <a href={d.url} target="_blank" rel="noopener" className="info__link">
              <Icon name="doc" size={26} />
              <span>
                <b>{d.title}</b>
                <span className="muted mono">PDF</span>
              </span>
              <Icon name="external" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
