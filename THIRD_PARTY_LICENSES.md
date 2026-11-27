# Сторонние компоненты и лицензии

Все используемые компоненты распространяются под разрешительными лицензиями.
Фото и текстов магазинов в проекте нет: каталог содержит только факты (название, цена, цвет,
размерная сетка, ссылка). Одежда генерируется нашим кодом. Единственная внешняя 3D-модель —
базовое тело MakeHuman (CC0, раздел «3D-данные» ниже); код MakeHuman (AGPL) не используется.

## 3D-данные

| Компонент | Автор | Лицензия | Ссылка |
|---|---|---|---|
| Базовая сетка тела (`3dobjs/base.obj`), морфы (`targets/macrodetails`, `targets/measure`) и веса скелета (`rigs/default_weights.mhw`) MakeHuman | MakeHuman Team и сообщество | CC0 1.0 Universal (public domain) | https://github.com/makehumancommunity/makehuman/tree/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data |

Из этих данных скрипт `tools/build_body_model.py` собирает `frontend/public/models/body-v1.*`:
только тело (без глаз, зубов и волос), части тела, морфы пола, веса и обхватов, а также наш
морф «манекен», который сглаживает лицо и соски.

## Бэкенд (Python)

| Компонент | Лицензия | Ссылка |
|---|---|---|
| FastAPI | MIT | https://github.com/fastapi/fastapi |
| Starlette | BSD-3-Clause | https://github.com/encode/starlette |
| Uvicorn | BSD-3-Clause | https://github.com/encode/uvicorn |
| Pydantic, pydantic-settings | MIT | https://github.com/pydantic/pydantic |
| SQLAlchemy | MIT | https://github.com/sqlalchemy/sqlalchemy |
| Anthropic Python SDK (anthropic) | MIT (SDK; использование API — по коммерческим условиям Anthropic) | https://github.com/anthropics/anthropic-sdk-python |
| httpx2, jiter, distro, docstring-parser (зависимости anthropic) | BSD-3-Clause, MIT, Apache 2.0, MIT | https://pypi.org/project/httpx2/ |
| Google Gen AI SDK (google-genai) | Apache 2.0 (SDK; использование API — по условиям Gemini API) | https://github.com/googleapis/python-genai |
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
| @react-three/fiber | MIT | https://github.com/pmndrs/react-three-fiber |
| Tailwind CSS | MIT | https://github.com/tailwindlabs/tailwindcss |
| Lucide (иконки) | ISC | https://github.com/lucide-icons/lucide |
| Vite | MIT | https://github.com/vitejs/vite |
| Шрифт Inter (подключается из системы, если установлен) | SIL OFL 1.1 | https://github.com/rsms/inter |

Полный список транзитивных зависимостей проверяется в CI: `npm run licenses` и `pip-licenses`.
