"""Сборка карт тканей для 3D-примерки из открытой библиотеки Poly Haven (CC0 1.0).

Для каждой ткани берутся две карты (цвет не берётся: цвет вещи задаёт каталог):
- карта нормалей (OpenGL-формат): рельеф нитей и петель;
- карта шероховатости: где ткань матовее, а где блестит ворс или выделанная кожа.

Исходники — JPG 1K с dl.polyhaven.org. Контрольные суммы MD5 закреплены ниже: если файл
на сервере изменится, сборка остановится, а не подменит текстуру молча. Карты
уменьшаются до 512 px (лёгкие для телефона) и сохраняются в
frontend/public/textures/fabric-<ткань>-normal.jpg и fabric-<ткань>-rough.jpg.

Шероховатость приводится к среднему ROUGHNESS_MEAN: тогда сила матовости задаётся одним
множителем в коде (FABRIC_LOOK), а карта даёт только разброс вокруг него.

Требуется Pillow (MIT-CMU): pip install pillow.
Запуск из корня репозитория: python3 tools/build_fabric_textures.py
"""

from __future__ import annotations

import hashlib
import io
import sys
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageStat

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "frontend" / "public" / "textures"
CACHE_DIR = ROOT / "tools" / ".cache" / "polyhaven"
BASE_URL = "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k"

# Сторона итоговой карты: 512 px хватает для крупного плана и легко грузится с телефона.
OUTPUT_SIZE = 512
# Средняя яркость карты шероховатости после выравнивания (0..1).
ROUGHNESS_MEAN = 0.8
JPEG_QUALITY = 88


@dataclass(frozen=True)
class FabricSource:
    """Материал Poly Haven для ткани и закреплённые MD5 его карт."""

    kind: str
    asset: str
    normal_md5: str
    rough_md5: str


SOURCES = (
    FabricSource(
        "knit",
        "cotton_jersey",
        "2dcc9dda3b726477f607c808e52f1833",
        "ac691d215d3aca34dcd6ea2d03937286",
    ),
    FabricSource(
        "woven",
        "stretch_poplin",
        "930a92aa642c2c4c196cc8c9d26bf65d",
        "88a1fad107109b61fce5ae316ddb7363",
    ),
    FabricSource(
        "denim",
        "denim_fabric_03",
        "5178f20974cb959c88ecf40dc8010bee",
        "5c4a7da91600e1cab87bba0f8d6311ed",
    ),
    FabricSource(
        "wool",
        "poly_wool_herringbone",
        "a6371d03b033a1c20e1c2758136ac757",
        "9f85f667517ee9c7f3cc85214058a7d8",
    ),
    FabricSource(
        "leather",
        "leather_white",
        "4226eb91e17693722f3368cd41a3b1c9",
        "db1052bac557bb6b03fdde325a853af4",
    ),
)


def fetch(asset: str, map_name: str, expected_md5: str) -> bytes:
    """Скачивает карту (с локальным кэшем) и проверяет её MD5."""
    file_name = f"{asset}_{map_name}_1k.jpg"
    cached = CACHE_DIR / file_name
    if cached.exists():
        data = cached.read_bytes()
    else:
        url = f"{BASE_URL}/{asset}/{file_name}"
        with urllib.request.urlopen(url, timeout=60) as response:
            data = response.read()
        cached.parent.mkdir(parents=True, exist_ok=True)
        cached.write_bytes(data)
    actual = hashlib.md5(data).hexdigest()
    if actual != expected_md5:
        raise ValueError(f"{file_name}: MD5 {actual}, ожидался {expected_md5}")
    return data


def resized(data: bytes, mode: str) -> Image.Image:
    """Открывает JPG и уменьшает до квадрата OUTPUT_SIZE (карты бесшовные целиком)."""
    image = Image.open(io.BytesIO(data)).convert(mode)
    return image.resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.Resampling.LANCZOS)


def normalized_roughness(image: Image.Image) -> Image.Image:
    """Сдвигает яркость карты шероховатости так, чтобы среднее стало ROUGHNESS_MEAN."""
    mean = ImageStat.Stat(image).mean[0] / 255
    shift = round((ROUGHNESS_MEAN - mean) * 255)
    return image.point(lambda value: min(max(value + shift, 0), 255))


def build(source: FabricSource) -> None:
    """Собирает обе карты одной ткани."""
    normal = resized(fetch(source.asset, "nor_gl", source.normal_md5), "RGB")
    rough = resized(fetch(source.asset, "rough", source.rough_md5), "L")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    normal.save(OUT_DIR / f"fabric-{source.kind}-normal.jpg", quality=JPEG_QUALITY)
    normalized_roughness(rough).save(
        OUT_DIR / f"fabric-{source.kind}-rough.jpg", quality=JPEG_QUALITY
    )


def main() -> int:
    """Собирает карты всех тканей и печатает размер получившихся файлов."""
    for source in SOURCES:
        build(source)
    total = sum(path.stat().st_size for path in OUT_DIR.glob("fabric-*.jpg"))
    print(f"Карты тканей: {OUT_DIR} ({total // 1024} КБ)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
