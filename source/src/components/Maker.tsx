import { Link } from 'react-router-dom';
import type { Ref } from '../api/types';
import { Icon } from './Icon';
import './maker.css';

export type MakerKind = 'brand' | 'plant';
type Maker = { id: string; title: string; kind: MakerKind; imageUrl?: string | null };

declare const __MAKERS__: Maker[];
/** Все бренды и производители каталога (из снимка на момент сборки), самые крупные — первыми. */
export const MAKERS: Maker[] = typeof __MAKERS__ !== 'undefined' ? __MAKERS__ : [];

export const makerLabel = (k: MakerKind) => (k === 'brand' ? 'Бренд' : 'Производитель');

/** «Упакс-Юнити» → «УЮ», «Комус» → «К», «ONE EARTH 1EA» → «OE». */
function initials(t: string) {
  const w = t.replace(/[«»"']/g, '').split(/[\s\-/]+/).filter((x) => /\p{L}/u.test(x));
  return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] ?? '?').slice(0, 1)).toUpperCase();
}
function tone(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ['green', 'kraft', 'ink'][h % 3];
}

/** Круглый «штамп» бренда: логотипов в каталоге нет, поэтому инициалы в стиле маркировки на коробке. */
export function MakerStamp({ r, size = 56 }: { r: { id: string; title: string; imageUrl?: string | null }; size?: number }) {
  return (
    <span className={`mstamp mstamp--${r.imageUrl ? 'img' : tone(r.id)}`} style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden="true">
      {r.imageUrl ? <img src={r.imageUrl} alt="" loading="lazy" /> : initials(r.title)}
    </span>
  );
}

/** Карточка-ссылка «Бренд Комус → все товары» на странице товара. */
export function MakerCard({ kind, r }: { kind: MakerKind; r: Ref }) {
  return (
    <Link to={`/${kind}/${r.id}`} className="maker">
      <MakerStamp r={r} size={48} />
      <span className="maker__txt">
        <span className="label">{makerLabel(kind)}</span>
        <b>{r.title}</b>
      </span>
      <span className="maker__go">
        Все товары <Icon name="arrowRight" size={18} />
      </span>
    </Link>
  );
}

/** Лента штампов брендов (главная, страница бренда). */
export function MakerTape({ exclude, title = 'Бренды и производители', inner }: { exclude?: string; title?: string; inner?: boolean }) {
  const list = MAKERS.filter((m) => m.id !== exclude);
  if (list.length < 3) return null;
  return (
    <section className={`${inner ? '' : 'container '}section makers-sec`} aria-labelledby="makers-title" data-reveal>
      <div className="section__head">
        <h2 className="section__title" id="makers-title">{title}</h2>
        <span className="page__count">{list.length}</span>
      </div>
      <ul className="mtape" role="list">
        {list.map((m) => (
          <li key={m.id}>
            <Link to={`/${m.kind}/${m.id}`} className="mchip" title={`${makerLabel(m.kind)} ${m.title}: все товары`}>
              <MakerStamp r={m} size={34} />
              <span>{m.title}</span>
              {m.kind === 'plant' && <span className="mchip__k">завод</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
