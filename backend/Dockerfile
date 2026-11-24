# Образ API для Render. Каталог собирается из CSV при сборке образа.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv/backend

COPY backend/pyproject.toml ./
COPY backend/app ./app
COPY backend/scripts ./scripts
RUN pip install --no-cache-dir .

COPY data /srv/data
RUN python -m scripts.import_catalog --data-dir /srv/data --db /srv/backend/catalog.db

# Запуск не от root.
RUN useradd --create-home appuser
USER appuser

ENV CATALOG_DB_PATH=/srv/backend/catalog.db
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --no-access-log"]
