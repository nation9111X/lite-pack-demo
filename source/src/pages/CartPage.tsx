import { CartView } from '../components/CartView';
import { useSeo } from '../lib/seo';

export default function CartPage() {
  useSeo({ title: 'Корзина', noindex: true });
  return (
    <div className="container page" style={{ maxWidth: 1200 }}>
      <header className="page__head">
        <h1 className="page__title">Корзина</h1>
      </header>
      <CartView page />
    </div>
  );
}
