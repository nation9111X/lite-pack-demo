import { useState } from 'react';
import { OFFICES, useSettings } from '../hooks/data';
import { Icon } from '../components/Icon';
import { phoneHref } from '../lib/format';
import { useSeo } from '../lib/seo';
import './info.css';

/** Карта Яндекса подгружается только по клику — не тормозит страницу. */
function MapFacade({ lat, lng, title }: { lat: number; lng: number; title: string }) {
  const [on, setOn] = useState(false);
  const src = `https://yandex.ru/map-widget/v1/?ll=${lng}%2C${lat}&z=16&pt=${lng}%2C${lat}%2Cpm2gnm`;
  return (
    <div className="map">
      {on ? (
        <iframe src={src} title={`Карта: ${title}`} loading="lazy" allowFullScreen />
      ) : (
        <button type="button" className="map__facade" onClick={() => setOn(true)}>
          <span className="map__pin"><Icon name="pin" size={30} /></span>
          <span className="btn btn--ghost btn--sm">Показать карту</span>
        </button>
      )}
    </div>
  );
}

export default function ContactsPage() {
  const [tab, setTab] = useState(0);
  const settings = useSettings();
  const o = OFFICES[tab];
  const c = settings.data?.companyDetails;
  useSeo({
    title: 'Связаться с нами',
    path: '/contact-us',
    description: OFFICES.map((x) => `${x.city}: ${x.address}, ${x.phone}`).join('; '),
    jsonLd: OFFICES.map((x) => ({
      '@context': 'https://schema.org',
      '@type': 'Store',
      name: `Лайт-Пак, ${x.city}`,
      telephone: x.phone,
      email: x.email,
      address: { '@type': 'PostalAddress', streetAddress: x.address, addressLocality: x.city, addressCountry: 'RU' },
      geo: { '@type': 'GeoCoordinates', latitude: x.lat, longitude: x.lng },
    })),
  });
  return (
    <div className="container page info">
      <header className="page__head">
        <h1 className="page__title">Связаться с нами</h1>
      </header>
      <div className="seg contacts__seg" role="tablist" aria-label="Город" style={{ ['--i' as string]: tab, ['--n' as string]: OFFICES.length }}>
        {OFFICES.map((x, i) => (
          <button key={x.city} type="button" role="tab" aria-selected={tab === i} className={`seg__btn${tab === i ? ' is-on' : ''}`} onClick={() => setTab(i)}>
            {x.city}
          </button>
        ))}
      </div>
      <div className="contacts" role="tabpanel" aria-label={o.city}>
        <div className="contacts__card panel">
          <p className="label">{o.city}</p>
          <p className="contacts__addr">{o.address}</p>
          <a className="contacts__row" href={phoneHref(o.phone)}><Icon name="phone" /> <b>{o.phone}</b></a>
          <a className="contacts__row" href={`mailto:${o.email}`}><Icon name="mail" /> {o.email}</a>
          <a className="btn btn--block" href={phoneHref(o.phone)}>Позвонить в магазин</a>
          <a className="link contacts__route" href={`https://yandex.ru/maps/?rtext=~${o.lat},${o.lng}&rtt=auto`} target="_blank" rel="noopener">
            Построить маршрут <Icon name="external" size={16} />
          </a>
        </div>
        <MapFacade key={o.city} lat={o.lat} lng={o.lng} title={o.address} />
      </div>
      {c && (
        <section className="section" aria-labelledby="req-title">
          <h2 className="section__title" id="req-title">Реквизиты</h2>
          <dl className="spec requisites">
            <div><dt>Название организации</dt><dd>{c.name}</dd></div>
            <div><dt>ИНН</dt><dd className="mono">{c.inn}</dd></div>
            <div><dt>КПП</dt><dd className="mono">{c.kpp}</dd></div>
            <div><dt>ОГРН/ОГРНИП</dt><dd className="mono">{c.ogrn}</dd></div>
            <div><dt>Юридический адрес организации</dt><dd>{c.legalAddress.text}</dd></div>
            <div><dt>Телефон</dt><dd><a href={phoneHref(c.phone)}>{c.phone}</a></dd></div>
          </dl>
        </section>
      )}
    </div>
  );
}
