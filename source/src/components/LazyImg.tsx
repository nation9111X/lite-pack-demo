import type { ImgHTMLAttributes } from 'react';

/**
 * Нативная ленивая загрузка. Порядок атрибутов важен для Preact: loading и srcSet выставляются
 * до src, иначе браузер начинает загрузку сразу. (Своя загрузка через IntersectionObserver
 * не прошла проверку прокруткой — вернуться к ней можно после отладки.)
 */
export function LazyImg({ src, srcSet, ...rest }: ImgHTMLAttributes<HTMLImageElement> & { src: string }) {
  return <img loading="lazy" decoding="async" {...rest} alt={rest.alt ?? ''} srcSet={srcSet} src={src} />;
}
