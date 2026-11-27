"""Сборка анатомического тела для 3D-примерки из открытых данных MakeHuman (CC0 1.0).

Скрипт скачивает из репозитория MakeHuman (зафиксированный коммит) только данные:
базовую сетку тела, морф-цели и веса костей. Код MakeHuman (AGPL) не используется.
На выходе — компактный бинарный файл и JSON-описание для фронтенда:

    frontend/public/models/body-v1.bin
    frontend/public/models/body-v1.json

Что попадает в файл:
- вершины и треугольники группы «body» (без глаз, зубов, ресниц и вспомогательной геометрии);
- центры суставов (joint-*): по ним фронтенд находит уровни колена, локтя, плеча и т. д.;
- морфы: пол (поровну из трёх этнических вариантов, чтобы тело не изображало конкретную
  внешность), вес, обхваты груди, талии и бёдер, а также сглаживание лица «как у манекена»;
- номер части тела для каждой вершины (туловище, голова, руки, ноги) — по весам костей.

Запуск из корня репозитория: python3 tools/build_body_model.py
"""

from __future__ import annotations

import json
import math
import struct
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path

# Зафиксированный коммит MakeHuman: данные не поменяются без явного обновления.
MAKEHUMAN_COMMIT = "a8bc2d54ff0ac92e78ff71431b1023eda42bf482"
DATA_URL = (
    "https://raw.githubusercontent.com/makehumancommunity/makehuman/"
    f"{MAKEHUMAN_COMMIT}/makehuman/data"
)
ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "frontend" / "public" / "models"
CACHE_DIR = ROOT / "tools" / ".cache"
MODEL_NAME = "body-v1"

# Базовая сетка MakeHuman задана в дециметрах; фронтенд работает в сантиметрах.
UNIT_TO_CM = 10.0
# Шаг квантования смещений морфов: 0,01 см — точнее, чем видно на экране.
DELTA_STEP_CM = 0.01
# Сдвиги меньше этого порога отбрасываются, чтобы файл был компактнее.
DELTA_EPSILON_CM = 0.02

ETHNICITIES = ("african", "asian", "caucasian")
GENDERS = ("female", "male")
MEASURES = ("bust", "waist", "hips")

# Части тела: номер в файле и признаки костей, которые к ней относятся.
PART_IDS = {
    "torso": 0,
    "head": 1,
    "leftArm": 2,
    "rightArm": 3,
    "leftLeg": 4,
    "rightLeg": 5,
}
ARM_BONES = ("upperarm", "lowerarm", "wrist", "finger", "metacarpal")
LEG_BONES = ("upperleg", "lowerleg", "foot", "toe")
TORSO_BONES = ("root", "spine", "pelvis", "clavicle", "shoulder", "breast", "neck")

# Суставы, нужные фронтенду для уровней тела.
JOINTS = (
    "neck",
    "head",
    "head-2",
    "jaw",
    "pelvis",
    "spine-1",
    "spine-2",
    "spine-3",
    "l-shoulder",
    "r-shoulder",
    "l-clavicle",
    "r-clavicle",
    "l-elbow",
    "r-elbow",
    "l-hand",
    "r-hand",
    "l-upper-leg",
    "r-upper-leg",
    "l-knee",
    "r-knee",
    "l-ankle",
    "r-ankle",
    "ground",
)

# Сглаживание лица и сосков: число шагов Таубина и их коэффициенты (без усадки объёма).
FACE_SMOOTH_STEPS = 300
TAUBIN_LAMBDA = 0.5
TAUBIN_MU = -0.53
# Поиск сосков (в дециметрах базовой сетки): окно по высоте и по расстоянию от середины,
# полное сглаживание в радиусе NIPPLE_CORE и плавный спад до NIPPLE_EDGE.
NIPPLE_Y = (2.5, 5.0)
NIPPLE_X = (0.4, 1.8)
NIPPLE_CORE = 0.35
NIPPLE_EDGE = 0.7

Vec = tuple[float, float, float]


def fetch(relative: str) -> bytes:
    """Скачивает файл данных MakeHuman (с локальным кэшем, чтобы не качать повторно)."""
    cached = CACHE_DIR / MAKEHUMAN_COMMIT / relative
    if cached.exists():
        return cached.read_bytes()
    with urllib.request.urlopen(f"{DATA_URL}/{relative}", timeout=60) as response:
        data: bytes = response.read()
    cached.parent.mkdir(parents=True, exist_ok=True)
    cached.write_bytes(data)
    return data


def parse_obj(text: str) -> tuple[list[Vec], dict[str, list[list[int]]]]:
    """Читает вершины и грани OBJ, сгруппированные по `g`."""
    vertices: list[Vec] = []
    faces: dict[str, list[list[int]]] = defaultdict(list)
    group = ""
    for line in text.splitlines():
        if line.startswith("v "):
            x, y, z = (float(value) for value in line.split()[1:4])
            vertices.append((x, y, z))
        elif line.startswith("g "):
            group = line.split()[1]
        elif line.startswith("f "):
            faces[group].append(
                [int(token.split("/")[0]) - 1 for token in line.split()[1:]]
            )
    return vertices, faces


def parse_target(text: str) -> dict[int, Vec]:
    """Читает морф-цель: строки «индекс dx dy dz» в единицах базовой сетки."""
    deltas: dict[int, Vec] = {}
    for line in text.splitlines():
        if not line or line.startswith("#"):
            continue
        index, dx, dy, dz = line.split()
        deltas[int(index)] = (float(dx), float(dy), float(dz))
    return deltas


def load_target(relative: str) -> dict[int, Vec]:
    """Скачивает и разбирает одну морф-цель."""
    return parse_target(fetch(f"targets/{relative}").decode("utf-8"))


def average_targets(targets: list[dict[int, Vec]]) -> dict[int, Vec]:
    """Среднее нескольких морфов (каждый с весом 1/n)."""
    total: dict[int, list[float]] = defaultdict(lambda: [0.0, 0.0, 0.0])
    for target in targets:
        for index, delta in target.items():
            for axis in range(3):
                total[index][axis] += delta[axis] / len(targets)
    return {index: (value[0], value[1], value[2]) for index, value in total.items()}


def joint_centers(
    vertices: list[Vec], faces: dict[str, list[list[int]]]
) -> dict[str, list[int]]:
    """Вершины каждого сустава: центр сустава — среднее этих вершин после морфов."""
    joints: dict[str, list[int]] = {}
    for name in JOINTS:
        group = faces.get(f"joint-{name}")
        if not group:
            raise ValueError(f"В сетке нет сустава joint-{name}")
        joints[name] = sorted({index for face in group for index in face})
    return joints


def part_of_bone(bone: str) -> str:
    """Часть тела, к которой относится кость скелета MakeHuman."""
    side = "left" if bone.endswith(".L") else "right" if bone.endswith(".R") else ""
    if side and any(bone.startswith(prefix) for prefix in ARM_BONES):
        return f"{side}Arm"
    if side and any(bone.startswith(prefix) for prefix in LEG_BONES):
        return f"{side}Leg"
    if any(bone.startswith(prefix) for prefix in TORSO_BONES):
        return "torso"
    return "head"


def vertex_parts(
    weights: dict[str, list[list[float]]], count: int
) -> tuple[list[int], list[float], list[float]]:
    """
    Часть тела каждой вершины по наибольшему суммарному весу костей, доля веса головы
    и доля веса руки (по ней фронтенд опускает руки из A-позы, как при скиннинге).
    """
    by_part: list[dict[str, float]] = [defaultdict(float) for _ in range(count)]
    for bone, bone_weights in weights.items():
        part = part_of_bone(bone)
        for index, weight in bone_weights:
            vertex = int(index)
            if vertex < count:
                by_part[vertex][part] += weight
    parts: list[int] = []
    head_share: list[float] = []
    arm_share: list[float] = []
    for shares in by_part:
        total = sum(shares.values()) or 1.0
        best = max(shares, key=lambda name: shares[name]) if shares else "torso"
        parts.append(PART_IDS[best])
        head_share.append(shares.get("head", 0.0) / total)
        arm = shares.get("leftArm", 0.0) + shares.get("rightArm", 0.0)
        arm_share.append(arm / total)
    return parts, head_share, arm_share


def neighbours(triangles: list[tuple[int, int, int]], count: int) -> list[set[int]]:
    """Соседние вершины по рёбрам треугольников."""
    result: list[set[int]] = [set() for _ in range(count)]
    for a, b, c in triangles:
        result[a].update((b, c))
        result[b].update((a, c))
        result[c].update((a, b))
    return result


def nipple_strength(positions: list[Vec], parts: list[int]) -> list[float]:
    """Сила сглаживания вокруг сосков: у каждой стороны — самая выступающая вперёд точка груди."""
    centers: list[Vec] = []
    for side in (1, -1):
        candidates = [
            point
            for point, part in zip(positions, parts, strict=True)
            if part == PART_IDS["torso"]
            and NIPPLE_Y[0] < point[1] < NIPPLE_Y[1]
            and NIPPLE_X[0] < point[0] * side < NIPPLE_X[1]
        ]
        centers.append(max(candidates, key=lambda point: point[2]))
    strength = []
    for point in positions:
        distance = min(math.dist(point, center) for center in centers)
        share = (NIPPLE_EDGE - distance) / (NIPPLE_EDGE - NIPPLE_CORE)
        strength.append(min(max(share, 0.0), 1.0))
    return strength


def mannequin_delta(
    positions: list[Vec],
    triangles: list[tuple[int, int, int]],
    head_share: list[float],
    parts: list[int],
) -> dict[int, Vec]:
    """
    Морф «манекен»: сглаживание Таубина головы и сосков. Нос, губы, глаза, уши и соски
    растворяются в гладкой форме, а размер и очертания головы и груди сохраняются.
    """
    head = [min(max((share - 0.2) / 0.6, 0.0), 1.0) for share in head_share]
    nipples = nipple_strength(positions, parts)
    strength = [max(first, second) for first, second in zip(head, nipples, strict=True)]
    links = neighbours(triangles, len(positions))
    current = [list(point) for point in positions]
    moving = [index for index, value in enumerate(strength) if value > 0]
    for step in range(FACE_SMOOTH_STEPS * 2):
        factor = TAUBIN_LAMBDA if step % 2 == 0 else TAUBIN_MU
        updated = {}
        for index in moving:
            around = links[index]
            if not around:
                continue
            mean = [
                sum(current[other][axis] for other in around) / len(around)
                for axis in range(3)
            ]
            weight = factor * strength[index]
            updated[index] = [
                current[index][axis] + weight * (mean[axis] - current[index][axis])
                for axis in range(3)
            ]
        for index, point in updated.items():
            current[index] = point
    return {
        index: (
            current[index][0] - positions[index][0],
            current[index][1] - positions[index][1],
            current[index][2] - positions[index][2],
        )
        for index in moving
    }


def joint_deltas(target: dict[int, Vec], joints: dict[str, list[int]]) -> list[Vec]:
    """Смещение центров суставов морфом: среднее смещение вершин сустава."""
    result: list[Vec] = []
    for name in JOINTS:
        indices = joints[name]
        sums = [0.0, 0.0, 0.0]
        for index in indices:
            delta = target.get(index, (0.0, 0.0, 0.0))
            for axis in range(3):
                sums[axis] += delta[axis] / len(indices)
        result.append((sums[0], sums[1], sums[2]))
    return result


def pack_target(
    target: dict[int, Vec],
    remap: dict[int, int],
    joints: dict[str, list[int]],
    body_count: int,
) -> bytes:
    """
    Упаковывает морф: число записей (uint32), индексы (uint16) и смещения (int16 × 3)
    в шагах DELTA_STEP_CM. Суставы идут виртуальными вершинами после вершин тела.
    """
    entries: list[tuple[int, Vec]] = []
    for source, delta in target.items():
        if source in remap:
            entries.append((remap[source], delta))
    for offset, delta in enumerate(joint_deltas(target, joints)):
        entries.append((body_count + offset, delta))
    packed_indices: list[int] = []
    packed_deltas: list[int] = []
    for index, delta in sorted(entries):
        scaled = [value * UNIT_TO_CM for value in delta]
        if max(abs(value) for value in scaled) < DELTA_EPSILON_CM:
            continue
        packed_indices.append(index)
        packed_deltas.extend(round(value / DELTA_STEP_CM) for value in scaled)
    count = len(packed_indices)
    data = struct.pack("<I", count)
    data += struct.pack(f"<{count}H", *packed_indices)
    data += struct.pack(f"<{count * 3}h", *packed_deltas)
    return data + b"\0" * (-len(data) % 4)


def build_targets() -> dict[str, dict[int, Vec]]:
    """Морфы, которые нужны фронтенду, в единицах базовой сетки."""
    targets: dict[str, dict[int, Vec]] = {}
    for gender in GENDERS:
        ethnic = [
            load_target(f"macrodetails/{e}-{gender}-young.target") for e in ETHNICITIES
        ]
        targets[f"{gender}"] = average_targets(ethnic)
        for weight in ("min", "max"):
            targets[f"{gender}-weight-{weight}"] = load_target(
                f"macrodetails/universal-{gender}-young-averagemuscle-{weight}weight.target"
            )
    for measure in MEASURES:
        for direction in ("decr", "incr"):
            targets[f"{measure}-{direction}"] = load_target(
                f"measure/measure-{measure}-circ-{direction}.target"
            )
    return targets


def main() -> int:
    """Собирает тело и пишет файлы модели во frontend/public/models."""
    vertices, faces = parse_obj(fetch("3dobjs/base.obj").decode("utf-8"))
    body_faces = faces["body"]
    body_vertices = sorted({index for face in body_faces for index in face})
    remap = {source: target for target, source in enumerate(body_vertices)}
    triangles: list[tuple[int, int, int]] = []
    for face in body_faces:
        local = [remap[index] for index in face]
        for corner in range(1, len(local) - 1):
            triangles.append((local[0], local[corner], local[corner + 1]))
    positions = [vertices[index] for index in body_vertices]
    joints = joint_centers(vertices, faces)
    weights = json.loads(fetch("rigs/default_weights.mhw").decode("utf-8"))["weights"]
    parts, head_share, arm_share = vertex_parts(weights, len(vertices))
    body_parts = [parts[index] for index in body_vertices]
    body_arm_share = [arm_share[index] for index in body_vertices]
    body_head_share = [head_share[index] for index in body_vertices]

    targets = build_targets()
    # Лицо и соски сглаживаются на теле своего пола: у женского и мужского тела они разные.
    for gender in GENDERS:
        shaped = [
            tuple(
                p + d
                for p, d in zip(
                    positions[i],
                    targets[gender].get(body_vertices[i], (0.0, 0.0, 0.0)),
                    strict=True,
                )
            )
            for i in range(len(positions))
        ]
        smooth = mannequin_delta(shaped, triangles, body_head_share, body_parts)  # type: ignore[arg-type]
        targets[f"mannequin-{gender}"] = {
            body_vertices[index]: delta for index, delta in smooth.items()
        }

    count = len(body_vertices)
    joint_positions = []
    for name in JOINTS:
        indices = joints[name]
        joint_positions.append(
            tuple(
                sum(vertices[i][axis] for i in indices) / len(indices)
                for axis in range(3)
            )
        )
    all_positions = positions + joint_positions
    blob = bytearray()
    layout: dict[str, object] = {}
    blob += struct.pack(
        f"<{len(all_positions) * 3}f",
        *(v * UNIT_TO_CM for p in all_positions for v in p),
    )
    layout["positions"] = {"offset": 0, "count": len(all_positions)}
    offset = len(blob)
    flat = [index for triangle in triangles for index in triangle]
    blob += struct.pack(f"<{len(flat)}H", *flat)
    blob += b"\0" * (-len(blob) % 4)
    layout["indices"] = {"offset": offset, "count": len(flat)}
    offset = len(blob)
    blob += bytes(body_parts)
    blob += b"\0" * (-len(blob) % 4)
    layout["parts"] = {"offset": offset, "count": count}
    offset = len(blob)
    blob += bytes(round(share * 255) for share in body_arm_share)
    blob += b"\0" * (-len(blob) % 4)
    layout["armWeights"] = {"offset": offset, "count": count}
    target_layout: dict[str, int] = {}
    for name, target in targets.items():
        target_layout[name] = len(blob)
        blob += pack_target(target, remap, joints, count)
    header = {
        "version": 1,
        "source": {
            "project": "MakeHuman (makehumancommunity.org)",
            "commit": MAKEHUMAN_COMMIT,
            "license": "CC0 1.0 Universal",
        },
        "unit": "cm",
        "deltaStepCm": DELTA_STEP_CM,
        "vertexCount": count,
        "joints": list(JOINTS),
        "partIds": PART_IDS,
        "layout": layout,
        "targets": target_layout,
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / f"{MODEL_NAME}.bin").write_bytes(bytes(blob))
    (OUT_DIR / f"{MODEL_NAME}.json").write_text(
        json.dumps(header, indent=2), encoding="utf-8"
    )
    print(
        f"{MODEL_NAME}: {count} вершин, {len(triangles)} треугольников, {len(blob)} байт"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
