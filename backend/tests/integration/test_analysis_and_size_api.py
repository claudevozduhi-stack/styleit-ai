"""Проверки эндпоинтов анализа фигуры и подбора размера."""

from typing import Any

from fastapi.testclient import TestClient

BODY: dict[str, Any] = {
    "gender": "female",
    "height_cm": 168,
    "weight_kg": 58,
    "chest_cm": 94,
    "waist_cm": 78,
    "hips_cm": 96,
}


def product_id(client: TestClient, title: str) -> int:
    """Находит ID тестового товара по названию."""
    items = client.get("/catalog").json()["items"]
    return next(item["id"] for item in items if item["title"] == title)


def test_body_analysis(client: TestClient) -> None:
    response = client.post("/analysis/body", json=BODY)
    assert response.status_code == 200
    assert response.json()["body_type"] == "rectangle"


def test_body_analysis_rejects_unknown_fields(client: TestClient) -> None:
    response = client.post("/analysis/body", json={**BODY, "email": "a@b.c"})
    assert response.status_code == 422


def test_body_analysis_rejects_out_of_range(client: TestClient) -> None:
    response = client.post("/analysis/body", json={**BODY, "height_cm": 300})
    assert response.status_code == 422


def test_size_recommend(client: TestClient) -> None:
    pid = product_id(client, "Футболка базовая")
    response = client.post("/size/recommend", json={"product_id": pid, "measurements": BODY})
    assert response.status_code == 200
    body = response.json()
    # Тестовая сетка: M — грудь 92–98, талия 76–82.
    assert body["recommended"]["size_label"] == "M"
    assert body["confidence"] == "high"
    assert [option["size_label"] for option in body["options"]] == ["S", "M", "L"]


def test_size_recommend_unknown_product(client: TestClient) -> None:
    response = client.post("/size/recommend", json={"product_id": 9999, "measurements": BODY})
    assert response.status_code == 404


def test_color_analysis(client: TestClient) -> None:
    body = {"undertone": "cool", "skin_hex": "#F1D3C2", "hair_hex": "#1b1612", "eye_hex": "#4a6b8a"}
    response = client.post("/analysis/color", json=body)
    assert response.status_code == 200
    assert response.json()["season"] == "winter"


def test_color_analysis_rejects_bad_hex(client: TestClient) -> None:
    body = {"undertone": "cool", "skin_hex": "red", "hair_hex": "#1b1612", "eye_hex": "#4a6b8a"}
    assert client.post("/analysis/color", json=body).status_code == 422
