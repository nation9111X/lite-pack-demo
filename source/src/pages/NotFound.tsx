import { Link } from 'react-router-dom';
import { useSeo } from '../lib/seo';
import { EmptyBox } from '../components/EmptyBox';

export function NotFoundPage() {
  useSeo({ title: 'Страница не найдена', noindex: true });
  return (
    <div className="container page">
      <div className="empty nf">
        <EmptyBox className="empty__art" label="404" />
        <h1 className="page__title">Страница не найдена</h1>
        <p>Такой страницы не существует или она была удалена</p>
        <Link to="/" className="btn btn--lg">Перейти на главную</Link>
      </div>
    </div>
  );
}
