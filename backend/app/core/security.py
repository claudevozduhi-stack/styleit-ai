"""Защитные механизмы API: CORS, заголовки безопасности и лимит частоты запросов.

Лимитер считает запросы по IP только в памяти процесса. IP нигде не
сохраняется и не пишется в логи.
"""

from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.core.config import Settings

# API отдаёт только JSON, поэтому политика CSP максимально строгая.
SECURITY_HEADERS: dict[str, str] = {
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Frame-Options": "DENY",
}

# Страница /docs подгружает Swagger UI со своими скриптами, ей нужна мягкая CSP.
DOCS_PATHS = ("/docs", "/redoc", "/openapi.json")


async def add_security_headers(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Middleware: добавляет заголовки безопасности к каждому ответу."""
    response = await call_next(request)
    for name, value in SECURITY_HEADERS.items():
        if name == "Content-Security-Policy" and request.url.path.startswith(DOCS_PATHS):
            continue
        response.headers.setdefault(name, value)
    return response


def build_limiter(settings: Settings) -> Limiter:
    """Создаёт лимитер частоты запросов с общим лимитом из настроек."""
    return Limiter(key_func=get_remote_address, default_limits=[settings.rate_limit])


def install_security(app: FastAPI, settings: Settings) -> None:
    """Подключает к приложению CORS, заголовки безопасности и лимит запросов."""
    limiter = build_limiter(settings)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]
    app.add_middleware(SlowAPIMiddleware)
    app.middleware("http")(add_security_headers)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_origin_regex=settings.cors_origin_regex or None,
        allow_methods=["GET", "POST"],
        expose_headers=["X-Capsules-Remaining"],
        allow_headers=["Content-Type", "X-Client-Id"],
    )
