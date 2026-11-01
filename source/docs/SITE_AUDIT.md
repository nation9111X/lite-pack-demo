# Аудит lite-pack.ru (до редизайна)

Дата разведки: 18–19.10.2026. Источник: живой сайт + сетевые запросы + бандл `main.dart-20260825041210.js`.

## 1. Что это за сайт технически

- **Flutter Web, рендерер CanvasKit.** Весь интерфейс рисуется в `<canvas>`; HTML-разметки нет.
  `main.dart.js` ≈ 5 МБ + `canvaskit.wasm` ≈ 7 МБ. До загрузки — экран «Загрузка...».
- Это тот же код, что и мобильные приложения (iOS `litepack_shop/6452720286`, Android `com.litepack.shop`).
- Исходников в папке нет → фронтенд пересобран заново на тех же API и данных.
- Хостинг: nginx на `lite-pack.ru`, API на том же домене: `https://lite-pack.ru/api/v1/*`.
- Картинки товаров и категорий: `https://storage.yandexcloud.net/litepack-production/...` (PNG с прозрачностью).
- Аналитика: Яндекс Метрика `104107498` (webvisor, clickmap, ecommerce: dataLayer, `defer:true`), запуск через
  `window.startYandexMetrika()` после согласия с cookie.

## 2. Карта страниц (маршруты старого приложения)

| URL | Что там |
|---|---|
| `/` | Каталог: дерево категорий слева, разделы с подкатегориями по центру, корзина справа; на мобиле — 4 вкладки снизу (Каталог, Корзина, Заказы, Профиль) |
| `/category/:id` | Категория: подкатегории (чипы + плитки) или сетка товаров |
| `/product/:id` | Карточка товара (на десктопе — модалка поверх каталога) |
| `/products` | Список товаров категории (внутренний маршрут) |
| `/contact-us` | Контакты: Ижевск / Нефтекамск, телефоны, почта, карта Яндекса |
| `/help`, `/faq` | Справка: частые вопросы, правовая информация |
| `/legal`, `/legal/:doc` | 6 правовых документов (PDF) |
| `/profile` | Профиль / вход по SMS |
| `/orders`, `/order/:id` | Заказы: «Активные», «История», детали заказа |
| `/add-company` | Добавление компании по ИНН |
| `/paymentForm`, `/paymentCompleted`, `/confirm`, `/cancel`, `/receipts` | Шаги оплаты и чеки |
| любой другой | 404: «Такой страницы не существует или она была удалена» + «Перейти на главную» |

Скриншоты «было»: `docs/BEFORE_AFTER/before/*` (375 и 1440 px, плюс сценарии `flow1`, `flow2`).

## 3. Каталог (снимок `data/snapshot.json`)

- 9 корневых категорий: Одноразовая посуда, Бытовая химия, Личная гигиена, Для детей, Хозтовары и уборка,
  Упаковка и пакеты, Бумажная продукция, Сезонные товары, Канцелярия.
- 160 конечных категорий, **1975 товаров** (1503 в Удмуртии, остальные — только в Башкортостане).
- Цены и остатки зависят от региона (`regionId`): Удмуртия `e0239224…`, Башкортостан `420be176…`.
- Товар: `info.title/description/imageUrls/packageInfo`, `price`, `finalPrice`, `discounts[]`,
  `quantityOfUnitsLeft`, `outOfStock`, `chestnyZnak`, `properties[]` (в карточке), `brands[]`, `plants[]`.
- Кратность: `packageInfo.element.quantity` (например, 45 шт в упаковке → «кратно 45 шт», цена «733,50 ₽ / 45 шт»).

## 4. API-контракт (не меняется)

Заголовки всех запросов: `authorization: Bearer <token>`, `package: lite_pack`, `app-type: web`, `system`,
`client-id`, `locale: ru-RU`, `system-version`, `version: 1.0.18`, `build-number: 70`, `content-type: application/json`.
Ошибки: `{message, developerMessage, errors:[{code, message}]}`.

**Авторизация**
- `POST v1/auth/signupAnonymous` `{appId:"lite_pack", clientId, appType:"shop"}` → `{clientId, profileId, profileKind, accessToken}`
- `POST v1/auth/requestSmsCode` `{appType, phone}` → `{verificationId, codeLength, secondsToResend}`
- `POST v1/auth/loginWithSms` `{appType, verificationId, code, acceptPromotionalMailings}` → `{clientId, profileId, profileKind, accessToken, isNew}`
- `GET v1/auth/logout`, `GET v1/auth/delete`

**Каталог** (query: `q`, `regionId`, `departmentId`)
- `GET v1/categories` → `{mode:"tree", categories[]}`
- `GET v1/categories/:id/products` → `{mode, category, categories[], products[]}`
- `GET v1/products/:id` (`regionId`, `departmentId`) → `{product}`
- `GET v1/search` (`page`, `pageSize`, `q`, `regionId`, `departmentId`) → `{categories[], products[]}`
- `GET v1/brands/:id`, `GET v1/plants/:id` → `{mode, brand|plant, categories, products}`

**Доставка и адреса**
- `GET v1/deliveries/anonym_regions` → `{regions:[{name, regionId, sourceDepartmentIds}]}`
- `GET v1/deliveries/regions` (зоны доставки с полигонами), `GET v1/deliveries/departments[/:id]` (пункты самовывоза)
- `GET v1/users/addresses` → `{addresses:[{id, namedAddress:{name, address, departmentId, regionId, workingStatus, workingStatusMessage, sourceDepartmentIds}}], activeAddressId, addNewDeniedMessage}` — поля самовывоза/зоны лежат **внутри** `namedAddress`
- `POST v1/users/addresses` `{departmentId}` (самовывоз) или `{courierAddress:{coordinates:{lat,lng}, flat, entrance, floor}}` (доставка; вне зоны — 404 «В данный регион доставка пока не работает»); `PATCH v1/users/addresses/:id` `{flat, entrance, floor}`; `DELETE v1/users/addresses/:id`
- `POST v1/users/addresses/setActive` `{addressId}`, `POST …/search` `{text}`, `POST …/coordinateInfo` `{lng, lat}`

**Корзина и заказ**
- `GET v1/cart?addressId=` / `POST v1/cart` `{userAddressId, items:[{productId, quantityOfUnits}], promoCode, promoCodeToRemove}` / `DELETE v1/cart`
  → `{cart:{items, price, priceLeftover, deliveryPriceInfo:{price, freeDeliveryPrice, minOrderPrice}, status}, appMessage}`
  (`items` — дельта: присланные позиции обновляются, остальные сохраняются; проверено на анонимном профиле)
- `POST v1/cart/checkout` `{earlyDelivery, suggestSplit, shouldMakeAsOneOrder}` → `{cart, order, appMessage, additionalPaymentMethods, leftoversItems, splitSuggestion}`; `DELETE v1/cart/checkout`
- `PATCH v1/orders/checkout` `{orderId, comment, paymentMethod, deliveryParts}` → `{order, checkoutId, additionalPaymentMethods}`
- `POST v1/orders/:id` `{paymentMethod, comment, deliveryParts}`, `POST …/:id/confirm` `{paymentMethod, comment}`, `POST …/:id/cancel`
- `POST …/:id/paymentForm` → `{paymentForm:{paymentId, formUrl, returnUrl, failUrl}, fullyPaid, qrCode}`; `POST …/:id/paymentCompleted` `{paymentId}`
- `GET v1/orders`, `GET v1/orders/history?page&pageSize&all`, `GET v1/orders/latest`, `GET v1/orders/:id?checkPayment=true`, `GET …/:id/receipts`, `GET v1/orders/confirmationCode`
- `POST|DELETE v1/orders/receiver` `{orderReceiver}` / `{phone}`

**Профиль**: `PATCH v1/profiles` `{name, email}`, `GET v1/profiles/shopProfiles`, `POST v1/profiles/switchShopProfile` `{profileId}`,
`POST v1/profiles/company` `{inn, kpp, userAddressId}`, `POST v1/companies/find` `{query}`, `GET|POST v1/wishes` `{products}`.

**Параметры каталога**: самовывоз → `departmentId`, доставка → `regionId` зоны из адреса, без адреса → `regionId` выбранного региона. Сервер не проверяет кратность — шаг `packageInfo.element.quantity` соблюдает клиент; `quantityOfUnits: 0` удаляет позицию.

**Картинки**: сервис ресайза `https://lite-pack.ru/{80|180|506},fit/{url}` (PNG, без кэша), им пользовалось и старое приложение.

**Контент**: `GET v1/contents/settings` (реквизиты, контакты, ссылки на приложения), `GET v1/contents/faq`,
`/assets/assets/content/legal_docs_links.json` (PDF-документы), контакты двух офисов зашиты в приложение.

**Метрика (сохраняется)**: `hit` на смену маршрута, `hit /internal-search?q=` на поиск, цели `category_view`,
`search_category_click`, `begin_checkout`, `repeat_order_*`; ecommerce `detail`, `add`, `remove`, `purchase`.

## 5. Бренд

- Логотип: растровый (PNG 312×162, лучшая версия — внутри `web-app-manifest-512x512.png`). Вектора на сайте нет
  (`favicon.svg` — обёртка над PNG). → `public/brand/`.
- Цвета (сняты попиксельно): зелёный логотипа `#00671E`, чёрный `#000000`; кнопки `#19B236`; иконки/ссылки `#0D6E20`;
  баннер `#158B2D`; светлая подложка `#E1F7E0`; текст `#00201E`; фон `#F8F8F8`.

## 6. Проблемы UX и производительности

1. **SEO ≈ ноль.** Весь сайт — один canvas: у всех страниц title «Лайт Пак», нет текста для поисковиков, нет
   индексируемых карточек товаров, нет микроразметки, нет sitemap.
2. **Тяжёлый старт.** ~12 МБ JS+WASM до первого полезного пикселя; на мобильном 4G — долгий экран «Загрузка...».
3. **Первый экран перекрыт:** модалка выбора региона + плашка cookie поверх неё.
4. **Добавить в корзину нельзя без адреса:** клик «В корзину» открывает полноэкранный выбор адреса с картой.
5. Нет хлебных крошек, сортировки, фильтра «в наличии»; названия товаров обрезаются до двух строк.
6. Блок с контактами занимает лучшее место главной вместо товаров.
7. Доступность: семантика включается только по скрытой кнопке; нельзя выделить текст, искать по странице (Ctrl+F),
   открыть товар в новой вкладке.
8. Манифест не настроен: описание «A new Flutter project.», цвет темы — флаттеровский синий `#0175C2`.
9. Зелёные кнопки `#19B236` с белым текстом — контраст 2.8:1, ниже нормы WCAG AA.
