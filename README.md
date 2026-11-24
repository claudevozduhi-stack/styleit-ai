# StyleIt AI

ИИ-стилист и виртуальная 3D-примерка одежды по параметрам тела.
Экзаменационный проект по «Основам ИИ», команда StyleIt (АЖИОЗ 25-24).

- Архитектура: [docs/architecture.md](docs/architecture.md)
- Правила разработки: [CLAUDE.md](CLAUDE.md)
- Как заполнять каталог: [data/README.md](data/README.md)

## Приватность

Регистрации нет. Мерки хранятся только в браузере пользователя, фото не покидает устройство.
На сервере хранится только каталог товаров.

## Локальный запуск

Нужны Python 3.12+ и Node.js 22+. Бесплатный ключ Gemini: https://aistudio.google.com/apikey

### macOS / Linux

```bash
cp .env.example backend/.env          # затем вписать GEMINI_API_KEY в backend/.env
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
copy .env.example backend\.env        # затем открыть backend\.env в Блокноте и вписать GEMINI_API_KEY
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

## Проверки

```bash
cd backend && ruff check . && mypy app scripts && pytest
cd frontend && npm run lint && npm run typecheck && npm test && npm run build
```

## Деплой (бесплатно, по ссылке)

Порядок важен: сначала бэкенд (нужен его адрес), потом фронтенд, потом CORS.

1. **Бэкенд на Render** (https://render.com, вход через GitHub):
   New → Web Service → выбрать репозиторий → Language: **Docker**,
   Dockerfile Path: `backend/Dockerfile`, Docker Build Context: `.` (корень), Instance Type: **Free**.
   Environment Variables: `GEMINI_API_KEY` (ключ), `GEMINI_MODEL` = `gemini-3.5-flash`.
   После сборки скопировать адрес вида `https://styleit-api.onrender.com` и проверить `.../health`.
2. **Фронтенд на Vercel** (https://vercel.com, вход через GitHub):
   Add New → Project → репозиторий → Root Directory: `frontend` (Vite определится сам).
   Environment Variable: `VITE_API_URL` = адрес бэкенда из шага 1. Deploy.
3. **CORS**: в Render добавить переменную `CORS_ORIGINS` = адрес сайта Vercel
   (например `https://styleit-ai.vercel.app`) и нажать Save — сервис перезапустится.

Бесплатный Render «засыпает» после 15 минут без запросов, первый запрос после этого идёт ~1 минуту.
Перед показом откройте `/health`, чтобы разбудить сервис.

## Лицензия

MIT. Сторонние компоненты — в [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
