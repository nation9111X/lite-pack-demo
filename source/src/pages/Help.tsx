import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../components/Icon';
import { useSeo } from '../lib/seo';
import './info.css';

const LINKS: { to: string; icon: IconName; title: string; text: string }[] = [
  { to: '/faq', icon: 'help', title: 'Частые вопросы', text: 'Доставка, возврат и брак' },
  { to: '/legal', icon: 'doc', title: 'Правовая информация', text: 'Соглашения, оферты и политики' },
  { to: '/contact-us', icon: 'phone', title: 'Связаться с нами', text: 'Ижевск и Нефтекамск' },
];

export default function HelpPage() {
  useSeo({ title: 'Справка', path: '/help' });
  return (
    <div className="container page info">
      <header className="page__head">
        <h1 className="page__title">Справка</h1>
      </header>
      <ul className="info__links" role="list">
        {LINKS.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="info__link">
              <Icon name={l.icon} size={26} />
              <span>
                <b>{l.title}</b>
                <span className="muted">{l.text}</span>
              </span>
              <Icon name="chevronRight" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
