import { useEffect, useId, useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';
import './select.css';

interface Option<T extends string> {
  value: T;
  label: string;
}

/** Выпадающий список в стиле сайта (WAI-ARIA listbox): мышь, тач и клавиатура. */
export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
  icon,
}: {
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  label: string;
  icon?: IconName;
}) {
  const [open, setOpen] = useState(false);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const [active, setActive] = useState(idx);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    setActive(idx);
    const onDoc = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDoc);
    requestAnimationFrame(() => list.current?.focus());
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [open, idx]);

  const pick = (i: number) => {
    onChange(options[i].value);
    setOpen(false);
    btn.current?.focus();
  };

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(options.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(options.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(active); }
    else if (e.key === 'Escape' || e.key === 'Tab') { setOpen(false); btn.current?.focus(); }
  };

  return (
    <div className={`select${open ? ' is-open' : ''}`} ref={wrap}>
      <button
        ref={btn}
        type="button"
        className="select__btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`${label}: ${options[idx]?.label}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {icon && <Icon name={icon} size={18} className="select__icon" />}
        <span className="select__value">{options[idx]?.label}</span>
        <Icon name="chevronDown" size={16} className="select__caret" />
      </button>
      {open && (
        <ul
          ref={list}
          id={id}
          className="select__list"
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${id}-${active}`}
          onKeyDown={onListKey}
          data-lenis-prevent
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === idx}
              className={`select__opt${i === active ? ' is-active' : ''}${i === idx ? ' is-selected' : ''}`}
              style={{ ['--d' as string]: `${i * 30}ms` }}
              onPointerEnter={() => setActive(i)}
              onClick={() => pick(i)}
            >
              <span>{o.label}</span>
              {i === idx && <Icon name="check" size={18} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
