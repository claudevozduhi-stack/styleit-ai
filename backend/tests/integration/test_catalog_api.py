"""Проверки API каталога и защитных заголовков."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings
from app.main import create_app
from tests.fakes import FakeLLM


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_security_headers_present(client: TestClient) -> None:
    response = client.get("/health")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert "default-src 'none'" in response.headers["Content-Security-Policy"]
    assert response.headers["Referrer-Policy"] == "no-referrer"


def test_catalog_sorted_by_price(client: TestClient) -> None:
    body = client.get("/catalog").json()
    assert body["total"] == 4
    prices = [item["price_kzt"] for item in body["items"]]
    assert prices == sorted(prices)
    assert body["items"][0]["store"] == "Тестовый магазин"


def test_catalog_filters(client: TestClient) -> None:
    body = client.get("/catalog", params={"style": "street"}).json()
    assert [item["title"] for item in body["items"]] == ["Футболка оверсайз", "Брюки карго"]

    body = client.get("/catalog", params={"gender": "male"}).json()
    # Мужчине подходят унисекс-футболки, но не женские брюки.
    assert {item["category"] for item in body["items"]} == {"tshirt"}

    body = client.get("/catalog", params={"max_price": 5000}).json()
    assert body["total"] == 1


def test_catalog_rejects_unknown_category(client: TestClient) -> None:
    assert client.get("/catalog", params={"category": "hat"}).status_code == 422


def test_cors_allows_only_configured_origin(client: TestClient) -> None:
    allowed = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert allowed.headers.get("access-control-allow-origin") == "http://localhost:5173"
    denied = client.get("/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in denied.headers


def test_cors_regex_allows_only_matching_preview_origins(catalog_db: Path) -> None:
    settings = Settings(
        catalog_db_path=catalog_db,
        cors_origin_regex=r"https://styleit-ai-[a-z0-9-]+-styleit1\.vercel\.app",
    )
    client = TestClient(create_app(settings, llm=FakeLLM([])))
    preview = "https://styleit-ai-git-feature-x-styleit1.vercel.app"
    allowed = client.get("/health", headers={"Origin": preview})
    assert allowed.headers.get("access-control-allow-origin") == preview
    for origin in (
        "https://other-project.vercel.app",
        "https://styleit-ai-git-x-styleit1.vercel.app.evil.example",
    ):
        denied = client.get("/health", headers={"Origin": origin})
        assert "access-control-allow-origin" not in denied.headers


def test_invalid_cors_regex_fails_at_startup(catalog_db: Path) -> None:
    with pytest.raises(ValidationError):
        Settings(catalog_db_path=catalog_db, cors_origin_regex="(")
