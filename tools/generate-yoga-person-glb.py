#!/usr/bin/env python3
"""Generate the older procedural yoga-person fallback GLB for the SAIA site.

No Blender dependency: this writes a binary glTF 2.0 file directly.
"""

from __future__ import annotations

import json
import math
import struct
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "saia-yoga-person-procedural.glb"


def v(x: float, y: float, z: float) -> np.ndarray:
    return np.array([x, y, z], dtype=np.float32)


def unit(a: np.ndarray) -> np.ndarray:
    n = float(np.linalg.norm(a))
    return a / n if n else a


def rot_x(a: float) -> np.ndarray:
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]], dtype=np.float32)


def rot_y(a: float) -> np.ndarray:
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]], dtype=np.float32)


def rot_z(a: float) -> np.ndarray:
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]], dtype=np.float32)


def basis_for_axis(axis: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    axis = unit(axis)
    ref = v(0, 1, 0) if abs(float(np.dot(axis, v(0, 1, 0)))) < 0.92 else v(1, 0, 0)
    u = unit(np.cross(axis, ref))
    w = unit(np.cross(axis, u))
    return u, w


def ellipsoid(
    center: np.ndarray,
    scale: tuple[float, float, float],
    rotation: np.ndarray | None = None,
    segments: int = 24,
    rings: int = 12,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    rotation = np.eye(3, dtype=np.float32) if rotation is None else rotation
    sx, sy, sz = scale
    positions = []
    normals = []

    for i in range(rings + 1):
        theta = math.pi * i / rings
        yy = math.cos(theta)
        rr = math.sin(theta)
        for j in range(segments + 1):
            phi = 2 * math.pi * j / segments
            base = np.array([rr * math.cos(phi), yy, rr * math.sin(phi)], dtype=np.float32)
            local = np.array([base[0] * sx, base[1] * sy, base[2] * sz], dtype=np.float32)
            positions.append(center + rotation @ local)
            normal_local = np.array([base[0] / sx, base[1] / sy, base[2] / sz], dtype=np.float32)
            normals.append(unit(rotation @ normal_local))

    indices = []
    stride = segments + 1
    for i in range(rings):
        for j in range(segments):
            a = i * stride + j
            b = a + 1
            c = (i + 1) * stride + j
            d = c + 1
            if i:
                indices.append((a, c, b))
            if i != rings - 1:
                indices.append((b, c, d))

    return (
        np.array(positions, dtype=np.float32),
        np.array(normals, dtype=np.float32),
        np.array(indices, dtype=np.uint32),
    )


def cylinder_between(
    p1: np.ndarray,
    p2: np.ndarray,
    r1: float,
    r2: float | None = None,
    segments: int = 18,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    r2 = r1 if r2 is None else r2
    axis = unit(p2 - p1)
    u, w = basis_for_axis(axis)
    positions = []
    normals = []

    for end, radius in ((p1, r1), (p2, r2)):
        for j in range(segments):
            a = 2 * math.pi * j / segments
            radial = math.cos(a) * u + math.sin(a) * w
            positions.append(end + radial * radius)
            normals.append(unit(radial))

    indices = []
    for j in range(segments):
        a = j
        b = (j + 1) % segments
        c = segments + j
        d = segments + ((j + 1) % segments)
        indices.append((a, c, b))
        indices.append((b, c, d))

    return (
        np.array(positions, dtype=np.float32),
        np.array(normals, dtype=np.float32),
        np.array(indices, dtype=np.uint32),
    )


def tube_between(
    p1: np.ndarray,
    p2: np.ndarray,
    r1: tuple[float, float],
    r2: tuple[float, float] | None = None,
    segments: int = 32,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Elliptical tapered tube between two points.

    The two radii are in the local cross-section basis. This is useful for
    limbs because it gives a softer, less pipe-like silhouette.
    """
    r2 = r1 if r2 is None else r2
    axis = unit(p2 - p1)
    u, w = basis_for_axis(axis)
    positions = []
    normals = []

    for end, radii in ((p1, r1), (p2, r2)):
        rx, rz = radii
        for j in range(segments):
            a = 2 * math.pi * j / segments
            radial = math.cos(a) * u * rx + math.sin(a) * w * rz
            positions.append(end + radial)
            n = math.cos(a) * u / max(rx, 1e-6) + math.sin(a) * w / max(rz, 1e-6)
            normals.append(unit(n))

    indices = []
    for j in range(segments):
        a = j
        b = (j + 1) % segments
        c = segments + j
        d = segments + ((j + 1) % segments)
        indices.append((a, c, b))
        indices.append((b, c, d))

    return (
        np.array(positions, dtype=np.float32),
        np.array(normals, dtype=np.float32),
        np.array(indices, dtype=np.uint32),
    )


def torus(
    center: np.ndarray,
    major: float,
    minor: float,
    rotation: np.ndarray | None = None,
    segments: int = 36,
    tube_segments: int = 10,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    rotation = np.eye(3, dtype=np.float32) if rotation is None else rotation
    positions = []
    normals = []
    for i in range(segments):
        u_ang = 2 * math.pi * i / segments
        for j in range(tube_segments):
            v_ang = 2 * math.pi * j / tube_segments
            local = np.array(
                [
                    (major + minor * math.cos(v_ang)) * math.cos(u_ang),
                    minor * math.sin(v_ang),
                    (major + minor * math.cos(v_ang)) * math.sin(u_ang),
                ],
                dtype=np.float32,
            )
            normal = np.array(
                [math.cos(v_ang) * math.cos(u_ang), math.sin(v_ang), math.cos(v_ang) * math.sin(u_ang)],
                dtype=np.float32,
            )
            positions.append(center + rotation @ local)
            normals.append(unit(rotation @ normal))

    indices = []
    for i in range(segments):
        for j in range(tube_segments):
            a = i * tube_segments + j
            b = i * tube_segments + ((j + 1) % tube_segments)
            c = ((i + 1) % segments) * tube_segments + j
            d = ((i + 1) % segments) * tube_segments + ((j + 1) % tube_segments)
            indices.append((a, c, b))
            indices.append((b, c, d))

    return (
        np.array(positions, dtype=np.float32),
        np.array(normals, dtype=np.float32),
        np.array(indices, dtype=np.uint32),
    )


class GlbBuilder:
    def __init__(self) -> None:
        self.parts: list[dict] = []
        self.materials: list[dict] = []
        self.material_index: dict[str, int] = {}

    def material(
        self,
        name: str,
        rgba: tuple[float, float, float, float],
        roughness: float = 0.82,
        metallic: float = 0.0,
    ) -> int:
        if name in self.material_index:
            return self.material_index[name]
        idx = len(self.materials)
        self.material_index[name] = idx
        self.materials.append(
            {
                "name": name,
                "pbrMetallicRoughness": {
                    "baseColorFactor": list(rgba),
                    "metallicFactor": metallic,
                    "roughnessFactor": roughness,
                },
                "doubleSided": False,
            }
        )
        return idx

    def add(
        self,
        name: str,
        material: str,
        positions: np.ndarray,
        normals: np.ndarray,
        indices: np.ndarray,
    ) -> None:
        self.parts.append(
            {
                "name": name,
                "material": self.material_index[material],
                "positions": positions.astype(np.float32),
                "normals": normals.astype(np.float32),
                "indices": indices.astype(np.uint32),
            }
        )

    def write(self, out: Path) -> None:
        buffer = bytearray()
        buffer_views = []
        accessors = []
        meshes = []
        nodes = []

        def align() -> None:
            while len(buffer) % 4:
                buffer.append(0)

        def add_blob(data: bytes, target: int) -> int:
            align()
            offset = len(buffer)
            buffer.extend(data)
            view = {"buffer": 0, "byteOffset": offset, "byteLength": len(data), "target": target}
            buffer_views.append(view)
            return len(buffer_views) - 1

        def accessor(view: int, component_type: int, count: int, kind: str, extra: dict | None = None) -> int:
            acc = {"bufferView": view, "componentType": component_type, "count": count, "type": kind}
            if extra:
                acc.update(extra)
            accessors.append(acc)
            return len(accessors) - 1

        for part in self.parts:
            positions = part["positions"]
            normals = part["normals"]
            indices = part["indices"]

            pos_view = add_blob(positions.tobytes(), 34962)
            norm_view = add_blob(normals.tobytes(), 34962)
            max_index = int(indices.max()) if len(indices) else 0
            if max_index < 65535:
                index_data = indices.astype(np.uint16)
                index_type = 5123
            else:
                index_data = indices.astype(np.uint32)
                index_type = 5125
            idx_view = add_blob(index_data.tobytes(), 34963)

            pos_acc = accessor(
                pos_view,
                5126,
                len(positions),
                "VEC3",
                {"min": positions.min(axis=0).round(6).tolist(), "max": positions.max(axis=0).round(6).tolist()},
            )
            norm_acc = accessor(norm_view, 5126, len(normals), "VEC3")
            idx_acc = accessor(idx_view, index_type, index_data.size, "SCALAR")

            meshes.append(
                {
                    "name": part["name"],
                    "primitives": [
                        {
                            "attributes": {"POSITION": pos_acc, "NORMAL": norm_acc},
                            "indices": idx_acc,
                            "material": part["material"],
                            "mode": 4,
                        }
                    ],
                }
            )
            nodes.append({"name": part["name"], "mesh": len(meshes) - 1})

        scene_node = {"name": "SAIA realistic yoga person", "children": list(range(len(nodes)))}
        nodes.append(scene_node)

        doc = {
            "asset": {
                "version": "2.0",
                "generator": "tools/generate-yoga-person-glb.py",
                "copyright": "Original lightweight 3D asset generated for SAIA London.",
            },
            "scene": 0,
            "scenes": [{"name": "Scene", "nodes": [len(nodes) - 1]}],
            "nodes": nodes,
            "meshes": meshes,
            "materials": self.materials,
            "buffers": [{"byteLength": len(buffer)}],
            "bufferViews": buffer_views,
            "accessors": accessors,
        }

        json_bytes = json.dumps(doc, separators=(",", ":")).encode("utf-8")
        json_bytes += b" " * ((4 - len(json_bytes) % 4) % 4)
        bin_bytes = bytes(buffer)
        bin_bytes += b"\x00" * ((4 - len(bin_bytes) % 4) % 4)

        total_len = 12 + 8 + len(json_bytes) + 8 + len(bin_bytes)
        with out.open("wb") as f:
            f.write(struct.pack("<III", 0x46546C67, 2, total_len))
            f.write(struct.pack("<I4s", len(json_bytes), b"JSON"))
            f.write(json_bytes)
            f.write(struct.pack("<I4s", len(bin_bytes), b"BIN\x00"))
            f.write(bin_bytes)


def add_shape(builder: GlbBuilder, name: str, material: str, shape: tuple[np.ndarray, np.ndarray, np.ndarray]) -> None:
    builder.add(name, material, *shape)


def main() -> None:
    b = GlbBuilder()
    b.material("warm skin", (0.74, 0.47, 0.35, 1.0), roughness=0.72)
    b.material("skin blush", (0.86, 0.54, 0.48, 1.0), roughness=0.78)
    b.material("mauve fitted yoga top", (0.53, 0.39, 0.43, 1.0), roughness=0.86)
    b.material("mauve seam", (0.34, 0.25, 0.28, 1.0), roughness=0.9)
    b.material("stone high-waist leggings", (0.63, 0.61, 0.56, 1.0), roughness=0.88)
    b.material("legging seam", (0.48, 0.46, 0.42, 1.0), roughness=0.9)
    b.material("dark brunette hair", (0.055, 0.038, 0.032, 1.0), roughness=0.7)
    b.material("eye and brow", (0.018, 0.014, 0.012, 1.0), roughness=0.6)
    b.material("natural lip", (0.49, 0.17, 0.15, 1.0), roughness=0.78)
    b.material("gold jewellery", (0.95, 0.68, 0.28, 1.0), roughness=0.35, metallic=0.6)
    b.material("blue ring stone", (0.07, 0.14, 0.48, 1.0), roughness=0.32)

    # Overall scale is human-like: roughly 1.7 m to the head, plus a high bun.
    # Fitted clothing is modelled as geometry on top of the body rather than a flat colour swap.
    add_shape(b, "high waist leggings pelvis and hips", "stone high-waist leggings", ellipsoid(v(0, 0.82, 0), (0.18, 0.115, 0.105), rot_z(0.015), 40, 18))
    add_shape(b, "lower abdomen skin gap", "warm skin", ellipsoid(v(0, 0.995, 0.025), (0.138, 0.07, 0.072), None, 32, 12))
    add_shape(b, "rib cage under crop top", "mauve fitted yoga top", ellipsoid(v(0, 1.19, 0.01), (0.178, 0.215, 0.086), None, 44, 20))
    add_shape(b, "left fitted bust volume", "mauve fitted yoga top", ellipsoid(v(-0.062, 1.245, 0.066), (0.064, 0.06, 0.039), rot_z(-0.12), 28, 12))
    add_shape(b, "right fitted bust volume", "mauve fitted yoga top", ellipsoid(v(0.062, 1.245, 0.066), (0.064, 0.06, 0.039), rot_z(0.12), 28, 12))
    add_shape(b, "bare shoulder line", "warm skin", ellipsoid(v(0, 1.44, 0), (0.215, 0.039, 0.056), None, 36, 10))
    add_shape(b, "neck", "warm skin", tube_between(v(0, 1.45, 0.015), v(0, 1.56, 0.016), (0.042, 0.034), (0.052, 0.04), 28))
    add_shape(b, "head natural oval", "warm skin", ellipsoid(v(0, 1.675, 0.025), (0.095, 0.128, 0.077), rot_z(-0.035), 44, 22))
    add_shape(b, "chin softness", "warm skin", ellipsoid(v(0, 1.565, 0.055), (0.064, 0.035, 0.044), None, 24, 10))

    # Hair: smooth cap, high bun, and a front braid falling over the right shoulder.
    add_shape(b, "smooth hair cap", "dark brunette hair", ellipsoid(v(0, 1.755, -0.005), (0.099, 0.079, 0.079), rot_z(-0.035), 36, 14))
    add_shape(b, "pulled back side hair left", "dark brunette hair", ellipsoid(v(-0.072, 1.68, 0.01), (0.025, 0.083, 0.04), rot_z(0.08), 18, 10))
    add_shape(b, "pulled back side hair right", "dark brunette hair", ellipsoid(v(0.072, 1.68, 0.01), (0.025, 0.083, 0.04), rot_z(-0.08), 18, 10))
    add_shape(b, "high bun", "dark brunette hair", ellipsoid(v(0.018, 1.865, -0.018), (0.052, 0.047, 0.052), rot_z(0.2), 32, 14))
    for i, c in enumerate([v(0.105, 1.61, 0.092), v(0.132, 1.51, 0.105), v(0.125, 1.405, 0.105), v(0.098, 1.30, 0.096), v(0.074, 1.205, 0.087)]):
        add_shape(
            b,
            f"front braid segment {i + 1}",
            "dark brunette hair",
            ellipsoid(c, (0.026, 0.036, 0.022), rot_z(0.52 if i % 2 else -0.52), 22, 10),
        )

    # Face details are subtle and physically placed on the face plane.
    add_shape(b, "left brow", "eye and brow", tube_between(v(-0.058, 1.702, 0.096), v(-0.018, 1.705, 0.101), (0.0028, 0.0022), (0.0028, 0.0022), 8))
    add_shape(b, "right brow", "eye and brow", tube_between(v(0.018, 1.705, 0.101), v(0.058, 1.702, 0.096), (0.0028, 0.0022), (0.0028, 0.0022), 8))
    add_shape(b, "left almond eye", "eye and brow", ellipsoid(v(-0.04, 1.672, 0.101), (0.011, 0.0038, 0.0028), None, 16, 6))
    add_shape(b, "right almond eye", "eye and brow", ellipsoid(v(0.04, 1.672, 0.101), (0.011, 0.0038, 0.0028), None, 16, 6))
    add_shape(b, "nose bridge", "warm skin", tube_between(v(0, 1.665, 0.095), v(0.003, 1.615, 0.113), (0.009, 0.006), (0.012, 0.008), 14))
    add_shape(b, "nose tip", "warm skin", ellipsoid(v(0.002, 1.606, 0.122), (0.019, 0.013, 0.012), None, 16, 8))
    add_shape(b, "upper lip", "natural lip", ellipsoid(v(0, 1.565, 0.111), (0.023, 0.0042, 0.003), None, 18, 5))
    add_shape(b, "lower lip", "natural lip", ellipsoid(v(0, 1.555, 0.112), (0.027, 0.005, 0.0033), None, 18, 5))
    add_shape(b, "left cheek warmth", "skin blush", ellipsoid(v(-0.058, 1.62, 0.095), (0.014, 0.006, 0.003), None, 14, 5))
    add_shape(b, "right cheek warmth", "skin blush", ellipsoid(v(0.058, 1.62, 0.095), (0.014, 0.006, 0.003), None, 14, 5))
    add_shape(b, "left hoop earring", "gold jewellery", torus(v(-0.104, 1.635, 0.025), 0.018, 0.0027, rot_x(math.pi / 2), 24, 8))
    add_shape(b, "right hoop earring", "gold jewellery", torus(v(0.104, 1.635, 0.025), 0.018, 0.0027, rot_x(math.pi / 2), 24, 8))
    add_shape(b, "fine necklace left chain", "gold jewellery", tube_between(v(-0.052, 1.47, 0.064), v(-0.012, 1.445, 0.078), (0.0018, 0.0014), (0.0018, 0.0014), 8))
    add_shape(b, "fine necklace right chain", "gold jewellery", tube_between(v(0.052, 1.47, 0.064), v(0.012, 1.445, 0.078), (0.0018, 0.0014), (0.0018, 0.0014), 8))
    add_shape(b, "small necklace bar", "gold jewellery", tube_between(v(-0.016, 1.44, 0.082), v(0.016, 1.44, 0.082), (0.0022, 0.0016), (0.0022, 0.0016), 8))

    # Crop top straps, neckline, and hem.
    add_shape(b, "left narrow top strap", "mauve fitted yoga top", tube_between(v(-0.145, 1.365, 0.072), v(-0.19, 1.485, 0.012), (0.007, 0.004), (0.006, 0.004), 10))
    add_shape(b, "right narrow top strap", "mauve fitted yoga top", tube_between(v(0.145, 1.365, 0.072), v(0.19, 1.485, 0.012), (0.007, 0.004), (0.006, 0.004), 10))
    add_shape(b, "soft v neckline left", "mauve seam", tube_between(v(-0.135, 1.35, 0.101), v(0, 1.30, 0.115), (0.0045, 0.003), (0.004, 0.003), 8))
    add_shape(b, "soft v neckline right", "mauve seam", tube_between(v(0.135, 1.35, 0.101), v(0, 1.30, 0.115), (0.0045, 0.003), (0.004, 0.003), 8))
    add_shape(b, "crop top lower hem", "mauve seam", tube_between(v(-0.14, 1.02, 0.093), v(0.14, 1.02, 0.093), (0.0045, 0.003), (0.0045, 0.003), 12))
    add_shape(b, "leggings waistband", "legging seam", tube_between(v(-0.145, 0.94, 0.079), v(0.145, 0.94, 0.079), (0.005, 0.0035), (0.005, 0.0035), 12))

    # Arms are tapered and jointed under the shoulder ellipsoid to avoid the old wooden-stick read.
    add_shape(b, "left shoulder cap", "warm skin", ellipsoid(v(-0.205, 1.405, 0.0), (0.036, 0.034, 0.032), rot_z(-0.2), 24, 10))
    add_shape(b, "left upper arm", "warm skin", tube_between(v(-0.205, 1.39, 0.01), v(-0.34, 1.17, 0.045), (0.029, 0.024), (0.025, 0.021), 30))
    add_shape(b, "left elbow", "warm skin", ellipsoid(v(-0.34, 1.17, 0.045), (0.033, 0.028, 0.025), rot_z(0.2), 20, 8))
    add_shape(b, "left forearm", "warm skin", tube_between(v(-0.34, 1.17, 0.045), v(-0.15, 0.955, 0.115), (0.025, 0.022), (0.021, 0.018), 30))
    add_shape(b, "left palm at hip", "warm skin", ellipsoid(v(-0.134, 0.945, 0.125), (0.04, 0.026, 0.019), rot_z(-0.45), 20, 8))
    for i, x in enumerate([-0.164, -0.149, -0.134, -0.119]):
        add_shape(b, f"left finger {i + 1}", "warm skin", tube_between(v(x, 0.928, 0.142), v(x + 0.012, 0.902, 0.148), (0.0045, 0.0035), (0.0035, 0.0028), 8))

    add_shape(b, "right shoulder cap", "warm skin", ellipsoid(v(0.205, 1.405, 0.0), (0.036, 0.034, 0.032), rot_z(0.2), 24, 10))
    add_shape(b, "right upper arm", "warm skin", tube_between(v(0.205, 1.39, 0.01), v(0.325, 1.16, 0.045), (0.029, 0.024), (0.025, 0.021), 30))
    add_shape(b, "right elbow", "warm skin", ellipsoid(v(0.325, 1.16, 0.045), (0.033, 0.028, 0.025), rot_z(-0.2), 20, 8))
    add_shape(b, "right forearm across waist", "warm skin", tube_between(v(0.325, 1.16, 0.045), v(0.035, 0.965, 0.13), (0.025, 0.022), (0.021, 0.018), 30))
    add_shape(b, "right palm at waist", "warm skin", ellipsoid(v(0.03, 0.96, 0.14), (0.041, 0.026, 0.019), rot_z(0.2), 20, 8))
    for i, x in enumerate([0.004, 0.02, 0.036, 0.052]):
        add_shape(b, f"right finger {i + 1}", "warm skin", tube_between(v(x, 0.94, 0.158), v(x + 0.004, 0.91, 0.164), (0.0045, 0.0035), (0.0035, 0.0028), 8))
    add_shape(b, "gold ring", "gold jewellery", torus(v(-0.151, 0.916, 0.151), 0.008, 0.0018, rot_x(math.pi / 2), 16, 6))
    add_shape(b, "blue ring stone", "blue ring stone", ellipsoid(v(-0.151, 0.916, 0.159), (0.006, 0.0035, 0.0045), None, 10, 5))

    # Tree-pose legs: the standing leg carries weight; the bent foot presses toward the inner thigh.
    add_shape(b, "standing left thigh", "stone high-waist leggings", tube_between(v(-0.07, 0.73, 0.0), v(-0.085, 0.43, 0.012), (0.055, 0.047), (0.044, 0.038), 34))
    add_shape(b, "standing left knee", "stone high-waist leggings", ellipsoid(v(-0.085, 0.43, 0.012), (0.047, 0.035, 0.038), None, 22, 8))
    add_shape(b, "standing left calf", "stone high-waist leggings", tube_between(v(-0.085, 0.43, 0.012), v(-0.073, 0.105, 0.025), (0.041, 0.035), (0.029, 0.025), 34))
    add_shape(b, "left ankle", "warm skin", ellipsoid(v(-0.073, 0.09, 0.03), (0.026, 0.021, 0.022), None, 16, 8))
    add_shape(b, "standing bare left foot", "warm skin", ellipsoid(v(-0.07, 0.035, 0.108), (0.041, 0.024, 0.105), rot_y(-0.06), 24, 10))
    add_shape(b, "left toe line", "warm skin", ellipsoid(v(-0.07, 0.027, 0.197), (0.04, 0.011, 0.018), None, 16, 5))
    add_shape(b, "right bent thigh", "stone high-waist leggings", tube_between(v(0.075, 0.73, 0.0), v(0.34, 0.58, 0.035), (0.055, 0.047), (0.044, 0.036), 34))
    add_shape(b, "right bent knee", "stone high-waist leggings", ellipsoid(v(0.34, 0.58, 0.035), (0.047, 0.035, 0.037), rot_z(-0.5), 22, 8))
    add_shape(b, "right folded calf", "stone high-waist leggings", tube_between(v(0.34, 0.58, 0.035), v(0.085, 0.425, 0.105), (0.041, 0.034), (0.029, 0.025), 34))
    add_shape(b, "right ankle", "warm skin", ellipsoid(v(0.083, 0.42, 0.11), (0.025, 0.02, 0.021), None, 16, 8))
    add_shape(b, "right bare foot pressed to thigh", "warm skin", ellipsoid(v(0.025, 0.435, 0.13), (0.038, 0.022, 0.088), rot_y(1.25) @ rot_z(-0.18), 24, 10))
    add_shape(b, "right toe line", "warm skin", ellipsoid(v(-0.042, 0.433, 0.154), (0.014, 0.011, 0.035), rot_y(1.25), 16, 5))

    add_shape(b, "left ankle legging cuff", "legging seam", tube_between(v(-0.102, 0.13, 0.047), v(-0.044, 0.13, 0.047), (0.0035, 0.0028), (0.0035, 0.0028), 10))
    add_shape(b, "right ankle legging cuff", "legging seam", tube_between(v(0.054, 0.445, 0.127), v(0.112, 0.413, 0.108), (0.0035, 0.0028), (0.0035, 0.0028), 10))

    b.write(OUT)
    print(f"Wrote {OUT.relative_to(ROOT)}")
    print(f"Parts: {len(b.parts)}")
    print(f"Materials: {len(b.materials)}")


if __name__ == "__main__":
    main()
