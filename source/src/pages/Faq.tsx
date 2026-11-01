import { Link } from 'react-router-dom';
import { useFaq } from '../hooks/data';
import { Breadcrumbs } from '../components/Footer';
import { useSeo } from '../lib/seo';
import './info.css';

export default function FaqPage() {
  const faq = useFaq();
  const items = faq.data?.items ?? [];
  useSeo({
    title: 'Частые вопросы',
    path: '/faq',
    description: items.map((i) => i.title).join(' ') || 'Частые вопросы',
    jsonLd: items.length
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: items.map((i) => ({ '@type': 'Question', name: i.title, acceptedAnswer: { '@type': 'Answer', text: i.text } })),
        }
      : null,
  });
  return (
    <div className="container page info">
      <Breadcrumbs items={[{ name: 'Справка', to: '/help' }, { name: 'Частые вопросы' }]} />
      <header className="page__head">
        <h1 className="page__title">Частые вопросы</h1>
      </header>
      {faq.loading && <div className="skeleton" style={{ height: 180 }} />}
      <div className="faq">
        {items.map((i, k) => (
          <details key={k} className="faq__item" open={k === 0}>
            <summary>
              <span className="faq__n mono">{String(k + 1).padStart(2, '0')}</span>
              {i.title}
            </summary>
            <p>{i.text}</p>
          </details>
        ))}
      </div>
      <p className="info__more">
        Не нашли ответ? <Link to="/contact-us" className="link">Задать вопрос</Link>
      </p>
    </div>
  );
}
