# PushTracker

Учебный **self-hosted affiliate-трекер** для приёма трафика с пуш-сетей (EvaDav, PropellerAds и т. п.):
учёт кликов и конверсий, блек/вайт-листы, автобан за частоту, статистика в админке.

MVP v1.0. Соответствует ТЗ (`zadanie.docx`).

---

## Возможности

- **Приём кликов** — `GET /clk?sub1=...&sub2=...&sub3=...`
  - проверка блек-листа (IP и подсети `/24`) и **приоритетный вайт-лист**;
  - rate-limit через Redis: более N кликов/мин с одного IP → авто-бан на 24 часа;
  - создание записи `clicks` и **302-редирект** на оффер с подстановкой
    `{click_id}`, `{sub1}`, `{sub2}`, `{sub3}`, `{offer_id}`.
- **Приём postback** — `GET /postback?click_id=...&payout=...&status=...&external_id=...&token=...`
  - защита секретным токеном, создание/обновление `conversions`.
- **Блек/вайт-листы** — ручное управление + авто-бан по частоте (TTL 24 ч).
- **Админка (React + Tailwind):**
  - Дашборд: клики, конверсии, payout, eCPM, ROI за период, с группировкой по офферу/sub1/дню;
  - Офферы (CRUD); Блек/вайт-листы; Клики и Конверсии с фильтрами; страница Spend;
  - вход по паролю (из `.env`), сессия в **httpOnly cookie**, защита от brute-force
    (не более 5 попыток за 10 минут с одного IP).
- **Логирование** всех кликов и postback'ов (pino, stdout + файл).

## Стек

| Слой      | Технология |
|-----------|------------|
| Бэкенд    | Node.js (22.5+) + Express + TypeScript |
| База      | SQLite (встроенный модуль `node:sqlite`) |
| Кэш       | Redis (счётчики частоты и TTL-баны); in-memory fallback для разработки без Redis |
| Фронтенд  | React 18 + Vite + TypeScript + Tailwind |
| Инфра     | Docker Compose (app + redis + nginx) |

## Быстрый старт

### 1. Локальная разработка (без Docker)

Требуется: Node.js **22.5+** (рекомендуется 24+).

```bash
# один раз
npm install                                    # корневые скрипты (concurrently)
npm --prefix backend install
npm --prefix frontend install

# настройка
cp backend/.env.example backend/.env           # задайте пароли/секреты

# (рекомендуется) локальный Redis, например в Docker:
#   docker run -d -p 6379:6379 redis:7-alpine
# если Redis недоступен — приложение переключится на in-memory счётчики (только для разработки)

# запуск фронтенда (:5173) и бэкенда (:3000) одновременно
npm run dev
```

Откройте **http://localhost:5173** и войдите с паролем из `backend/.env`
(`ADMIN_PASSWORD`). Фронтенд проксирует `/admin`, `/clk`, `/postback` на `:3000`.

> В `npm run dev` бэкенд уже отдаёт собранный фронтенд (`frontend/dist`),
> но в разработке удобнее Vite dev server (hot reload).

### 2. Production через Docker Compose

Требуется: Docker + Docker Compose.

```bash
cp .env.example .env       # и заполните ADMIN_PASSWORD, SESSION_SECRET, POSTBACK_TOKEN,
                           # при необходимости HTTP_PORT / APP_PORT / TRACKER_DOMAIN
docker compose up --build -d
```

- Сайт: **http://host:HTTP_PORT** (nginx; по умолчанию `HTTP_PORT=8080`).
- Менеджер: `docker compose ps`, логи: `docker compose logs -f app`.

### 2.1 Деплой на VPS (рядом с уже работающим трекером на :3000)

Наш контейнер **не занимает порт 3000 хоста**: `app` доступен только внутри сети
compose (`expose`), а наружу смотрит только nginx на настроенном `HTTP_PORT`.
Поэтому уже существующий трекер на `:3000` не конфликтует.

```bash
# 1. Клонируйте свежий код
git clone https://github.com/RioolGB/push-tracker.git
cd push-tracker

# 2. Настройте окружение
cp .env.example .env
nano .env
#   ADMIN_PASSWORD  — пароль админки
#   SESSION_SECRET  — случайная строка
#   POSTBACK_TOKEN  — секрет postback (должен совпадать с настройкой CPA-сети)
#   HTTP_PORT=8080  — если 80-й порт занят другим сервисом, задайте другой
#   TRACKER_DOMAIN  — домен/поддомен трекера (например hub.my-domain.ru)

# 3. Поднимите
docker compose up --build -d
```

Проверка:

```bash
curl -I http://ваш-домен/health        # nginx -> app -> {"ok":true,...}
curl 'http://127.0.0.1:8080/clk?sub1=test'   # 302/200 заглушка
```

> HTTPS: за nginx с открытым портом 80 можно поставить свой внешний прокси
> (Caddy/certbot). Быстрый вариант — `HTTP_PORT=80` + шифрование через внешний
> nginx, который уже обслуживает ваш сервер.

### 3. Одиночный production-процесс (без Docker)

```bash
npm install                        # корень
npm --prefix backend install       # и dev-зависимости
npm --prefix frontend install

cp backend/.env.example backend/.env

npm run build                      # соберёт backend/dist и frontend/dist
npm start                          # запустит backend:3000, который отдаёт и API, и фронтенд
```

## Конфигурация

Все настройки — через переменные окружения, см. [`backend/.env.example`](backend/.env.example):

| Переменная | Описание | По умолчанию |
|---|---|---|
| `PORT` | Порт HTTP-сервера | `3000` |
| `ADMIN_PASSWORD` | Пароль администратора (обязателен) | `admin` |
| `SESSION_SECRET` | Секрет подписи cookie-сессии | `dev-session-secret` |
| `POSTBACK_TOKEN` | Секретный токен postback | `postback-secret` |
| `RATE_LIMIT_PER_MIN` | Порог кликов/мин с одного IP | `30` |
| `REDIS_URL` | URL Redis | `redis://localhost:6379` |
| `DATABASE_PATH` | Путь к файлу SQLite | `backend/data/tracker.db` |
| `LOG_FILE_ENABLED` / `LOG_DIR` | Файловое логирование | `true` / `logs` |
| `TRUST_PROXY` | Читать первый hop из `X-Forwarded-For` (за nginx) | `false` (в docker: `true`) |

В `.env` для Docker Compose (корень проекта) — настройки приложения
(`ADMIN_PASSWORD`, `SESSION_SECRET`, `POSTBACK_TOKEN`, `RATE_LIMIT_PER_MIN`)
и публикации (`HTTP_PORT`, `APP_PORT`, `TRACKER_DOMAIN`), см. [`.env.example`](.env.example).

## API

### Публичные (для трафика и CPA-сети)

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/clk?sub1=&sub2=&sub3=&offer_id=` | Приём клика → 302 на оффер. Заглушка (200, пустая) для заблокированных. |
| `GET` | `/postback?click_id=&payout=&status=&external_id=&token=` | Приём конверсии. Ответ: `OK` / `ERROR`. |
| `GET` | `/health` | Статус сервиса и режим Redis. |

### Админка (httpOnly cookie после `/admin/login`)

| Метод | Путь | Описание |
|---|---|---|
| `POST` | `/admin/login` | `{ "password": "..." }` |
| `POST` | `/admin/logout` | выход |
| `GET` | `/admin/me` | проверка сессии |
| `GET` | `/admin/stats?period=&group_by=&from=&to=` | метрики; `period`: `today\|yesterday\|7d\|30d\|custom`; `group_by`: `none\|offer\|sub1\|day` |
| `GET/POST` | `/admin/offers` | список / создание |
| `PUT/DELETE` | `/admin/offers/:id` | обновление / удаление |
| `GET/POST` | `/admin/blacklist`, `/admin/whitelist` | списки / добавление |
| `DELETE` | `/admin/blacklist/:id`, `/admin/whitelist/:id` | удаление записи |
| `GET` | `/admin/clicks?offer_id=&sub1=&from=&to=` | клики с фильтрами |
| `GET` | `/admin/conversions?offer_id=&status=` | конверсии с фильтрами |
| `GET/POST` | `/admin/spend` | затраты для расчёта ROI; `DELETE /admin/spend/:id` |

## Метрики

- **Клики** — записи в `clicks`;
- **Конверсии** — записи в `conversions` со статусом `approved`;
- **Payout** — сумма `payout` по approved-конверсиям;
- **eCPM** = `payout / клики * 1000`;
- **ROI** = `(payout − spend) / spend × 100%`, где **spend** задаётся вручную в админке
  (на оффер, на sub1 или общий).

## Проверка вручную

```bash
# оффер должен быть добавлен в админке
URL=$(curl -s -o /dev/null -w '%{redirect_url}' 'http://localhost:3000/clk?sub1=eva_123&sub2=push_us&sub3=creative_a')
echo "$URL"                       # == https://offers.example/click?id=<click_id>&s1=eva_123&...

# postback по этому click_id
curl 'http://localhost:3000/postback?click_id=1&payout=2.5&status=approved&token=change-me-postback-secret'
# -> OK
```

## Структура проекта

```
push-tracker/
├── backend/                  # Express + TypeScript
│   ├── src/
│   │   ├── routes/           # click.ts, postback.ts, admin/*
│   │   ├── services/         # clickService, postbackService, listService, statsService
│   │   ├── middleware/       # auth, ipExtractor
│   │   ├── utils/            # subnet (CIDR), urlTemplate, session
│   │   ├── db/               # схема SQLite + инициализация
│   │   └── index.ts
│   ├── prisma/schema.prisma  # справочная схема (не обязательна, БД ведёт node:sqlite)
│   └── .env.example
├── frontend/                 # React 18 + Vite + Tailwind
│   └── src/
│       ├── pages/            # Dashboard, Offers, ListPage, Clicks, Conversions, Spend, Login
│       ├── components/       # Layout, ui
│       └── api/client.ts
├── Dockerfile
├── docker-compose.yml        # app + redis + nginx (порты из .env)
├── nginx/
│   └── default.conf.template # шаблон конфига nginx (порт/домен из env)
└── README.md
```

## Примечания

- SQLite ведётся встроенным модулем Node.js `node:sqlite` — никаких нативных зависимостей.
- Redis нужен только для счётчиков частоты и TTL-банов; при недоступности автоматически
  используются in-memory счётчики (в production рекомендуется реальный Redis).
- Трекер-ссылка обрабатывается синхронно (`better-sqlite3`-подобный API) и держит
  задержку < 50 мс без учёта сети.