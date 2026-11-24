# Сторонние компоненты и лицензии

Все используемые компоненты распространяются под разрешительными лицензиями.
Внешних 3D-моделей, фото и текстов магазинов в проекте нет: манекен и одежда генерируются нашим кодом,
каталог содержит только факты (название, цена, цвет, размерная сетка, ссылка).

## Бэкенд (Python)

| Компонент | Лицензия | Ссылка |
|---|---|---|
| FastAPI | MIT | https://github.com/fastapi/fastapi |
| Starlette | BSD-3-Clause | https://github.com/encode/starlette |
| Uvicorn | BSD-3-Clause | https://github.com/encode/uvicorn |
| Pydantic, pydantic-settings | MIT | https://github.com/pydantic/pydantic |
| SQLAlchemy | MIT | https://github.com/sqlalchemy/sqlalchemy |
| Anthropic Python SDK | Apache 2.0 (SDK; использование API — по условиям Anthropic) | https://github.com/anthropics/anthropic-sdk-python |
| SlowAPI, limits | MIT | https://github.com/laurentS/slowapi |
| httpx | BSD-3-Clause | https://github.com/encode/httpx |
| SQLite | Public domain | https://sqlite.org/copyright.html |

## Фронтенд (JavaScript)

| Компонент | Лицензия | Ссылка |
|---|---|---|
| React, React DOM | MIT | https://github.com/facebook/react |
| React Router | MIT | https://github.com/remix-run/react-router |
| TanStack Query | MIT | https://github.com/TanStack/query |
| three.js | MIT | https://github.com/mrdoob/three.js |
| @react-three/fiber, @react-three/drei | MIT | https://github.com/pmndrs |
| Tailwind CSS | MIT | https://github.com/tailwindlabs/tailwindcss |
| Lucide (иконки) | ISC | https://github.com/lucide-icons/lucide |
| Vite | MIT | https://github.com/vitejs/vite |
| Шрифт Inter (подключается из системы, если установлен) | SIL OFL 1.1 | https://github.com/rsms/inter |

Полный список транзитивных зависимостей проверяется в CI: `npm run licenses` и `pip-licenses`.
