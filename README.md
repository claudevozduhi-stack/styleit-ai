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

Нужны Python 3.12+ и Node.js 22+.

```bash
cp .env.example backend/.env          # и вписать ANTHROPIC_API_KEY
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
python -m scripts.import_catalog      # собрать каталог из data/*.csv
uvicorn app.main:app --reload         # API: http://localhost:8000/docs

cd ../frontend
npm install
npm run dev                           # http://localhost:5173
```

## Проверки

```bash
cd backend && ruff check . && mypy app scripts && pytest
cd frontend && npm run lint && npm run typecheck && npm test && npm run build
```

## Деплой

- Бэкенд: Render → New Web Service → Docker, Dockerfile `backend/Dockerfile`, корень сборки — корень репозитория.
  Переменные: `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`, `CORS_ORIGINS` (адрес фронтенда).
- Фронтенд: Vercel → корень `frontend`, переменная `VITE_API_URL` (адрес бэкенда).

## Лицензия

MIT. Сторонние компоненты — в [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
