import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import { Layout } from './Layout';
import { RouteError } from './RouteError';
import { HomePage } from '../pages/Home';
import { CategoryPage } from '../pages/Category';
import { ProductPage } from '../pages/Product';
import { NotFoundPage } from '../pages/NotFound';
import '../styles/alive.css';
import '../styles/phone.css';

// Редкие страницы — отдельными чанками, чтобы первый экран грузился быстрее.
const SearchPage = lazy(() => import('../pages/Search'));
const CollectionPage = lazy(() => import('../pages/Collection'));
const CartPage = lazy(() => import('../pages/CartPage'));
const CheckoutPage = lazy(() => import('../pages/Checkout'));
const OrdersPage = lazy(() => import('../pages/Orders'));
const OrderPage = lazy(() => import('../pages/Order'));
const ProfilePage = lazy(() => import('../pages/Profile'));
const AddCompanyPage = lazy(() => import('../pages/AddCompany'));
const HelpPage = lazy(() => import('../pages/Help'));
const FaqPage = lazy(() => import('../pages/Faq'));
const LegalPage = lazy(() => import('../pages/Legal'));
const ContactsPage = lazy(() => import('../pages/Contacts'));
const PodborPage = lazy(() => import('../pages/Podbor'));
const PaymentPage = lazy(() => import('../pages/Payment'));

// Все маршруты старого приложения сохранены; новые: /search, /cart, /checkout, /brand/:id, /plant/:id, /podbor.
export const routes: RouteObject[] = [
  {
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      {
        // ошибка страницы показывается внутри Layout: шапка и меню остаются рабочими
        errorElement: <RouteError />,
        children: [
      { path: '/', element: <HomePage /> },
      { path: '/category/:id', element: <CategoryPage /> },
      { path: '/product/:id', element: <ProductPage /> },
      { path: '/products', element: <Navigate to="/" replace /> },
      { path: '/search', element: <SearchPage /> },
      { path: '/brand/:id', element: <CollectionPage kind="brand" /> },
      { path: '/plant/:id', element: <CollectionPage kind="plant" /> },
      { path: '/cart', element: <CartPage /> },
      { path: '/checkout', element: <CheckoutPage /> },
      { path: '/orders', element: <OrdersPage /> },
      { path: '/order/:id', element: <OrderPage /> },
      { path: '/receipts', element: <Navigate to="/orders" replace /> },
      { path: '/profile', element: <ProfilePage /> },
      { path: '/add-company', element: <AddCompanyPage /> },
      { path: '/help', element: <HelpPage /> },
      { path: '/faq', element: <FaqPage /> },
      { path: '/legal', element: <LegalPage /> },
      { path: '/legal/:doc', element: <LegalPage /> },
      { path: '/contact-us', element: <ContactsPage /> },
      { path: '/podbor', element: <PodborPage /> },
      { path: '/paymentForm', element: <PaymentPage mode="form" /> },
      { path: '/paymentCompleted', element: <PaymentPage mode="completed" /> },
      { path: '/confirm', element: <PaymentPage mode="completed" /> },
      { path: '/cancel', element: <PaymentPage mode="cancel" /> },
      { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
