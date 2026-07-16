#!/usr/bin/env python3
"""Retexture the downloaded volumetric reference GLB into the SAIA yoga palette."""

from __future__ import annotations

import json
import struct
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_GLB = Path("/Users/at/Downloads/sporty_woman_practising_gymnastics_134.glb")
BASECOLOR = ROOT / "assets" / "yoga-person-reference-extracted" / "saia-yoga-person-volumetric-basecolor.jpg"
OUT = ROOT / "assets" / "saia-yoga-person-volumetric.glb"


def read_glb(path: Path) -> tuple[dict, bytes]:
    data = path.read_bytes()
    magic, version, length = struct.unpack("<III", data[:12])
    if magic != 0x46546C67 or version != 2 or length != len(data):
        raise ValueError(f"{path} is not a valid GLB v2")
    offset = 12
    json_chunk = None
    bin_chunk = None
    while offset < len(data):
        chunk_len, chunk_type = struct.unpack("<I4s", data[offset : offset + 8])
        offset += 8
        chunk = data[offset : offset + chunk_len]
        offset += chunk_len
        if chunk_type == b"JSON":
            json_chunk = chunk
        elif chunk_type == b"BIN\x00":
            bin_chunk = chunk
    if json_chunk is None or bin_chunk is None:
        raise ValueError(f"{path} is missing JSON or BIN chunks")
    return json.loads(json_chunk.decode("utf-8")), bin_chunk


def align4(buffer: bytearray) -> None:
    while len(buffer) % 4:
        buffer.append(0)


def main() -> None:
    doc, bin_chunk = read_glb(SOURCE_GLB)
    replacement = BASECOLOR.read_bytes()

    image_index = doc["materials"][0]["pbrMetallicRoughness"]["baseColorTexture"]["index"]
    source_index = doc["textures"][image_index]["source"]
    base_view_index = doc["images"][source_index]["bufferView"]

    new_bin = bytearray()
    for index, view in enumerate(doc["bufferViews"]):
        offset = view.get("byteOffset", 0)
        blob = bin_chunk[offset : offset + view["byteLength"]]
        if index == base_view_index:
            blob = replacement
            doc["images"][source_index]["mimeType"] = "image/jpeg"
            doc["images"][source_index]["name"] = "saia-yoga-person-volumetric-basecolor"
        align4(new_bin)
        view["byteOffset"] = len(new_bin)
        view["byteLength"] = len(blob)
        new_bin.extend(blob)

    doc["buffers"][0]["byteLength"] = len(new_bin)
    doc["materials"][0]["name"] = "SAIA mauve top and stone leggings"
    doc["meshes"][0]["name"] = "SAIA volumetric yoga person"
    doc["nodes"][2]["name"] = "SAIA volumetric yoga person"
    doc["asset"]["generator"] = "tools/retexture-reference-yoga-glb.py"

    json_bytes = json.dumps(doc, separators=(",", ":")).encode("utf-8")
    json_bytes += b" " * ((4 - len(json_bytes) % 4) % 4)
    bin_bytes = bytes(new_bin)
    bin_bytes += b"\x00" * ((4 - len(bin_bytes) % 4) % 4)

    total_len = 12 + 8 + len(json_bytes) + 8 + len(bin_bytes)
    with OUT.open("wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total_len))
        f.write(struct.pack("<I4s", len(json_bytes), b"JSON"))
        f.write(json_bytes)
        f.write(struct.pack("<I4s", len(bin_bytes), b"BIN\x00"))
        f.write(bin_bytes)

    print(f"Wrote {OUT.relative_to(ROOT)}")
    print(f"Replaced base colour image bufferView {base_view_index}")


if __name__ == "__main__":
    main()
