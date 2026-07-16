#!/usr/bin/env python3
"""Pack the realistic yoga-person cutout into a lightweight textured GLB."""

from __future__ import annotations

import json
import struct
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "saia-yoga-person-cutout.png"
CROPPED = ROOT / "assets" / "saia-yoga-person-cutout-cropped.png"
OUT = ROOT / "assets" / "saia-yoga-person.glb"


def align4(buffer: bytearray, pad: int = 0) -> None:
    while len(buffer) % 4:
        buffer.append(pad)


def crop_source() -> tuple[int, int]:
    image = Image.open(SOURCE).convert("RGBA")
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        raise RuntimeError(f"{SOURCE} has no opaque pixels")
    pad = 8
    left = max(0, bbox[0] - pad)
    top = max(0, bbox[1] - pad)
    right = min(image.width, bbox[2] + pad)
    bottom = min(image.height, bbox[3] + pad)
    cropped = image.crop((left, top, right, bottom))
    cropped.save(CROPPED, optimize=True)
    return cropped.size


def main() -> None:
    width_px, height_px = crop_source()
    human_height_m = 1.72
    human_width_m = human_height_m * width_px / height_px
    half_w = human_width_m / 2

    # A very thin front-facing card: photoreal from the intended website camera,
    # and still a proper GLB with embedded texture and alpha.
    positions = np.array(
        [
            [-half_w, 0.0, 0.0],
            [half_w, 0.0, 0.0],
            [half_w, human_height_m, 0.0],
            [-half_w, human_height_m, 0.0],
        ],
        dtype=np.float32,
    )
    normals = np.array([[0.0, 0.0, 1.0]] * 4, dtype=np.float32)
    texcoords = np.array([[0.0, 1.0], [1.0, 1.0], [1.0, 0.0], [0.0, 0.0]], dtype=np.float32)
    indices = np.array([0, 1, 2, 0, 2, 3], dtype=np.uint16)
    image_bytes = CROPPED.read_bytes()

    binary = bytearray()
    views: list[dict] = []

    def add_blob(data: bytes, target: int | None = None, pad: int = 0) -> int:
        align4(binary, pad)
        offset = len(binary)
        binary.extend(data)
        view = {"buffer": 0, "byteOffset": offset, "byteLength": len(data)}
        if target is not None:
            view["target"] = target
        views.append(view)
        return len(views) - 1

    pos_view = add_blob(positions.tobytes(), 34962)
    norm_view = add_blob(normals.tobytes(), 34962)
    uv_view = add_blob(texcoords.tobytes(), 34962)
    idx_view = add_blob(indices.tobytes(), 34963)
    img_view = add_blob(image_bytes, None, 0)

    accessors = [
        {
            "bufferView": pos_view,
            "componentType": 5126,
            "count": 4,
            "type": "VEC3",
            "min": positions.min(axis=0).round(6).tolist(),
            "max": positions.max(axis=0).round(6).tolist(),
        },
        {"bufferView": norm_view, "componentType": 5126, "count": 4, "type": "VEC3"},
        {"bufferView": uv_view, "componentType": 5126, "count": 4, "type": "VEC2"},
        {"bufferView": idx_view, "componentType": 5123, "count": 6, "type": "SCALAR"},
    ]

    doc = {
        "asset": {
            "version": "2.0",
            "generator": "tools/generate-yoga-person-cutout-glb.py",
            "copyright": "Original AI-assisted front-facing 3D site asset generated for SAIA London.",
        },
        "scene": 0,
        "scenes": [{"name": "Scene", "nodes": [0]}],
        "nodes": [{"name": "SAIA realistic yoga person cutout", "mesh": 0}],
        "meshes": [
            {
                "name": "photorealistic yoga person",
                "primitives": [
                    {
                        "attributes": {"POSITION": 0, "NORMAL": 1, "TEXCOORD_0": 2},
                        "indices": 3,
                        "material": 0,
                    }
                ],
            }
        ],
        "materials": [
            {
                "name": "embedded realistic yoga person",
                "doubleSided": True,
                "alphaMode": "BLEND",
                "pbrMetallicRoughness": {
                    "baseColorTexture": {"index": 0},
                    "baseColorFactor": [1, 1, 1, 1],
                    "metallicFactor": 0,
                    "roughnessFactor": 0.78,
                },
            }
        ],
        "textures": [{"sampler": 0, "source": 0}],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
        "images": [{"name": "saia-yoga-person-cutout", "mimeType": "image/png", "bufferView": img_view}],
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": views,
        "accessors": accessors,
    }

    json_bytes = json.dumps(doc, separators=(",", ":")).encode("utf-8")
    json_bytes += b" " * ((4 - len(json_bytes) % 4) % 4)
    bin_bytes = bytes(binary)
    bin_bytes += b"\x00" * ((4 - len(bin_bytes) % 4) % 4)

    total_len = 12 + 8 + len(json_bytes) + 8 + len(bin_bytes)
    with OUT.open("wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total_len))
        f.write(struct.pack("<I4s", len(json_bytes), b"JSON"))
        f.write(json_bytes)
        f.write(struct.pack("<I4s", len(bin_bytes), b"BIN\x00"))
        f.write(bin_bytes)

    print(f"Wrote {OUT.relative_to(ROOT)}")
    print(f"Embedded texture: {CROPPED.relative_to(ROOT)} ({width_px}x{height_px})")
    print(f"Plane size: {human_width_m:.3f}m x {human_height_m:.3f}m")


if __name__ == "__main__":
    main()
