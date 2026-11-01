import { useEffect } from 'react';
import { Link, useRouteError } from 'react-router-dom';
import { EmptyBox } from '../components/EmptyBox';
import { isChunkError } from '../components/ChunkBoundary';

const RELOADED_AT = 'lp.chunkReloadAt';

/** Один раз обновляем страницу сами: после новой выкладки этого достаточно. Защита от бесконечной перезагрузки — метка времени. */
function reloadOnce() {
  try {
    if (Date.now() - Number(sessionStorage.getItem(RELOADED_AT) || 0) < 30000) return;
    sessionStorage.setItem(RELOADED_AT, String(Date.now()));
  } catch {
    return;
  }
  location.reload();
}

/** Экран вместо стандартной ошибки роутера: покупатель видит понятный текст, шапка и меню остаются рабочими. */
export function RouteError() {
  const error = useRouteError();
  const chunk = isChunkError(error);

  useEffect(() => {
    console.error(error);
    if (!chunk) return;
    if (navigator.onLine) reloadOnce();
    const onOnline = () => location.reload();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [chunk, error]);

  return (
    <div className="container empty" role="alert">
      <EmptyBox className="empty__art" />
      <h2>{chunk ? 'Страница не загрузилась' : 'Что-то пошло не так'}</h2>
      <p>{chunk ? 'Похоже, прервалась связь. Проверьте интернет и обновите страницу.' : 'Обновите страницу. Если не поможет, вернитесь на главную.'}</p>
      <button type="button" className="btn" onClick={() => location.reload()}>Обновить</button>
      <Link to="/" className="link" reloadDocument>На главную</Link>
    </div>
  );
}
