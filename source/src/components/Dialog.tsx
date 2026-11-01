import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';
import { syncScrollLock } from '../lib/smooth';
import './dialog.css';

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** center — модалка, side — шторка справа (на мобильном снизу), sheet — всегда снизу */
  variant?: 'center' | 'side' | 'sheet';
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  hideTitle?: boolean;
}

/** Нативный <dialog>: ловушка фокуса, Esc и верхний слой — силами браузера. */
export function Dialog({ open, onClose, title, variant = 'center', children, footer, wide, hideTitle }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
    // Проверяем ПОСЛЕ открытия/закрытия: раньше класс блокировки оставался и прокрутка пропадала
    syncScrollLock();
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    d.addEventListener('close', syncScrollLock);
    return () => {
      d.removeEventListener('close', syncScrollLock);
      if (d.open) d.close();
      queueMicrotask(syncScrollLock);
    };
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    const onClick = (e: MouseEvent) => {
      if (e.target === d) onClose();
    };
    d.addEventListener('cancel', onCancel);
    d.addEventListener('click', onClick);
    return () => {
      d.removeEventListener('cancel', onCancel);
      d.removeEventListener('click', onClick);
    };
  }, [onClose]);

  return (
    <dialog ref={ref} className={`dlg dlg--${variant}${wide ? ' dlg--wide' : ''}`} aria-labelledby={titleId}>
      {open && (
        <div className="dlg__panel">
          <header className={`dlg__head${hideTitle ? ' dlg__head--bare' : ''}`}>
            <h2 id={titleId} className={hideTitle ? 'sr-only' : 'dlg__title'}>
              {title}
            </h2>
            <button type="button" className="icon-btn dlg__close" onClick={onClose} aria-label="Закрыть">
              <Icon name="close" />
            </button>
          </header>
          <div className="dlg__body">{children}</div>
          {footer && <footer className="dlg__foot">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
