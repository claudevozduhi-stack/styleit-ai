"""Проверки API каталога и защитных заголовков."""

from fastapi.testclient import TestClient


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
    assert body["total"] == 3
    prices = [item["price_kzt"] for item in body["items"]]
    assert prices == sorted(prices)
    assert body["items"][0]["store"] == "Тестовый магазин"


def test_catalog_filters(client: TestClient) -> None:
    body = client.get("/catalog", params={"style": "street"}).json()
    assert [item["title"] for item in body["items"]] == ["Футболка оверсайз"]

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
