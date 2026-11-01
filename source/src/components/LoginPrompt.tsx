import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { openAuth } from '../store/ui';

export function LoginPrompt({ next, text }: { next?: string; text?: string }) {
  return (
    <div className="login-prompt panel">
      <span className="login-prompt__icon"><Icon name="user" size={30} /></span>
      <h2>Войдите или зарегистрируйтесь</h2>
      <p className="muted">{text ?? 'Чтобы делать покупки, отслеживать свои заказы, добавлять в избранное и следить за бонусами.'}</p>
      <button type="button" className="btn btn--lg" onClick={() => openAuth(next ?? null)}>
        Войти или зарегистрироваться
      </button>
      <div className="login-prompt__links">
        <Link to="/help" className="info__link"><Icon name="help" /> <span><b>Справка</b></span> <Icon name="chevronRight" /></Link>
        <Link to="/contact-us" className="info__link"><Icon name="phone" /> <span><b>Связаться с нами</b></span> <Icon name="chevronRight" /></Link>
      </div>
    </div>
  );
}
