# StyleIt AI

ИИ-стилист и виртуальная 3D-примерка одежды по параметрам тела.
Экзаменационный проект по «Основам ИИ», команда StyleIt (АЖИОЗ 25-24).

- Архитектура: [docs/architecture.md](docs/architecture.md)
- Правила разработки: [CLAUDE.md](CLAUDE.md)
- Как заполнять каталог: [data/README.md](data/README.md)

## Что умеет

1. **Мерки** — рост, вес, обхваты; хранятся только в браузере.
2. **Цветотип** — сезон по подтону, цветам кожи, волос и глаз и подходящая палитра.
3. **Капсула** — ИИ-стилист (Claude) собирает образы из каталога магазинов РК в рамках бюджета;
   ответ ИИ проверяется кодом, размер каждой вещи считается по размерной сетке.
4. **3D-примерка** — анатомическое тело-манекен (MakeHuman, CC0) подгоняется под ваши мерки прямо в браузере, вещь — по размерной сетке магазина;
   посадка по зонам подсвечивается цветом, можно сравнить любой размер.
5. **Смета** — итог по капсуле и остаток бюджета.

## Приватность

Регистрации нет. Мерки хранятся только в браузере пользователя, фото не покидает устройство.
На сервере хранится только каталог товаров.

## Локальный запуск

Нужны Python 3.12+ и Node.js 22+. Ключ Claude API: https://console.anthropic.com → Settings → API Keys
(сначала пополнить баланс в Billing; капсула на Haiku стоит около $0.001).

### macOS / Linux

```bash
cp .env.example backend/.env          # затем вписать ANTHROPIC_API_KEY в backend/.env
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
python -m scripts.import_catalog      # собрать каталог из data/*.csv
uvicorn app.main:app --reload         # API: http://localhost:8000/docs

# во втором терминале
cd frontend
npm install
npm run dev                           # http://localhost:5173
```

### Windows (PowerShell)

```powershell
copy .env.example backend\.env        # затем открыть backend\.env в Блокноте и вписать ANTHROPIC_API_KEY
cd backend
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1             # если ругается на политику: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
pip install -e ".[dev]"
python -m scripts.import_catalog
uvicorn app.main:app --reload

# во втором окне PowerShell
cd frontend
npm install
npm run dev
```

### Бэкенд в Docker (по желанию)

```bash
cp .env.example backend/.env          # вписать ANTHROPIC_API_KEY
docker compose up --build             # API: http://localhost:8000/docs
```

## Проверки

```bash
cd backend && ruff check . && mypy app scripts && pytest
cd frontend && npm run lint && npm run typecheck && npm test && npm run build
```

## Деплой (бесплатно, по ссылке)

Порядок важен: сначала бэкенд (нужен его адрес), потом фронтенд, потом CORS.

1. **Бэкенд на Render** (https://render.com, вход через GitHub).
   Быстрый путь: New → Blueprint → выбрать репозиторий; Render прочитает `render.yaml`
   и спросит `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` (можно оставить пустым) и `CORS_ORIGINS` (CORS можно оставить пустым до шага 3).
   Ручной путь: New → Web Service → выбрать репозиторий → Language: **Docker**,
   Dockerfile Path: `backend/Dockerfile`, Docker Build Context: `.` (корень), Instance Type: **Free**.
   Environment Variables: `ANTHROPIC_API_KEY` (ключ), `CLAUDE_MODEL` = `claude-haiku-5-5`, `AI_PROVIDER` = `claude`.
   После сборки скопировать адрес вида `https://styleit-api.onrender.com` и проверить `.../health`.
2. **Фронтенд на Vercel** (https://vercel.com, вход через GitHub):
   Add New → Project → репозиторий → Root Directory: `frontend` (Vite определится сам).
   Environment Variable: `VITE_API_URL` = адрес бэкенда из шага 1. Deploy.
3. **CORS**: в Render добавить переменную `CORS_ORIGINS` = адрес сайта Vercel
   (например `https://styleit-ai.vercel.app`) и нажать Save — сервис перезапустится.
   Чтобы работали и превью веток Vercel, добавить `CORS_ORIGIN_REGEX` вида
   `https://styleit-ai-[a-z0-9-]+-<команда>\.vercel\.app` (часть адреса превью после имени ветки).
   В Vercel переменная `VITE_API_URL` должна быть отмечена и для **Production**, и для **Preview**.

Модель меняется переменной `CLAUDE_MODEL` на Render без правки кода (например, `claude-sonnet-5-5`:
сильнее, но примерно в 20 раз дороже). Запасной Gemini включается `AI_PROVIDER` = `gemini` и `GEMINI_API_KEY`.

Если капсула отвечает «Anthropic отклонил ключ Claude»: создайте ключ заново в консоли Anthropic,
вставьте в `ANTHROPIC_API_KEY` на Render и нажмите Save. «Закончились средства» — пополните Billing.
Причину отказа видно в логах Render (строка `Claude API error`).

Бесплатный Render «засыпает» после 15 минут без запросов, первый запрос после этого идёт ~1 минуту.
Перед показом откройте `/health`, чтобы разбудить сервис.

## Лицензия

MIT. Сторонние компоненты — в [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
