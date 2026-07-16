#!/usr/bin/env node
'use strict';

/*
 * Build a self-contained, scroll-scrubbable SAÏA mat GLB without Blender.
 *
 * The exported animation runs from rolled (time 0) to open (time 4). It uses
 * closely spaced morph poses along an Archimedean spiral, which keeps reverse
 * playback smooth when a site maps scroll position directly to clip time.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TEXTURE = path.join(ROOT, 'assets', 'mat-flat.png');
const OUTPUT = path.join(ROOT, 'assets', 'saia-mat-roll-open.glb');

const WIDTH = 0.68;
const LENGTH = 1.83;
const THICKNESS = 0.008;
const CORE_RADIUS = 0.035;
const X_SEGMENTS = 20;
const Q_SEGMENTS = 180;
const POSE_COUNT = 12;
const DURATION = 4;
const MOBILE_CAMERA_DISTANCE = 3.55;
const MOBILE_VERTICAL_FOV = 32;
const MOBILE_ASPECT = 390 / 844;

// Transparent margins in the exact 887 × 1774 supplied image.
const UV_CROP = {
  u0: 115 / 887,
  u1: 773 / 887,
  v0: 69 / 1774,
  v1: 1706 / 1774,
};

function align4(n) {
  return (n + 3) & ~3;
}

function solveTheta(arc) {
  // Arc-length approximation for r(t) = CORE_RADIUS + k*t.
  const k = THICKNESS / (2 * Math.PI);
  return (-CORE_RADIUS + Math.sqrt(CORE_RADIUS ** 2 + 2 * k * arc)) / k;
}

function centreline(q, rollFraction) {
  const rolledLength = rollFraction * LENGTH;
  if (rolledLength < 1e-8 || q >= rolledLength) {
    return { y: 0, z: q - LENGTH / 2 };
  }

  const k = THICKNESS / (2 * Math.PI);
  const endTheta = solveTheta(rolledLength);
  const theta = solveTheta(q);
  const radius = CORE_RADIUS + k * theta;
  const outerRadius = CORE_RADIUS + k * endTheta;
  const angle = theta - endTheta;

  return {
    y: outerRadius - radius * Math.cos(angle),
    z: rolledLength - LENGTH / 2 + radius * Math.sin(angle),
  };
}

function surfaceSample(q, rollFraction) {
  const eps = LENGTH / (Q_SEGMENTS * 8);
  const a = centreline(Math.max(0, q - eps), rollFraction);
  const b = centreline(Math.min(LENGTH, q + eps), rollFraction);
  let dy = b.y - a.y;
  let dz = b.z - a.z;
  const tangentLength = Math.hypot(dy, dz) || 1;
  dy /= tangentLength;
  dz /= tangentLength;

  // Normal in glTF's Y-up space. Flat state is (0, 1, 0).
  const ny = dz;
  const nz = -dy;
  const c = centreline(q, rollFraction);
  return {
    y: c.y + ny * THICKNESS / 2,
    z: c.z + nz * THICKNESS / 2,
    ny,
    nz,
  };
}

function halfWidthAt(q) {
  const half = WIDTH / 2;
  const radius = 0.045;
  const endDistance = Math.min(q, LENGTH - q);
  if (endDistance >= radius) return half;
  const d = endDistance - radius;
  return half - radius + Math.sqrt(Math.max(0, radius * radius - d * d));
}

function buildPose(rollFraction) {
  const count = (X_SEGMENTS + 1) * (Q_SEGMENTS + 1);
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  let p = 0;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (let row = 0; row <= Q_SEGMENTS; row++) {
    const q = LENGTH * row / Q_SEGMENTS;
    const surface = surfaceSample(q, rollFraction);
    const halfWidth = halfWidthAt(q);
    for (let col = 0; col <= X_SEGMENTS; col++) {
      positions[p] = halfWidth * (2 * col / X_SEGMENTS - 1);
      positions[p + 1] = surface.y;
      positions[p + 2] = surface.z;
      minZ = Math.min(minZ, surface.z);
      maxZ = Math.max(maxZ, surface.z);
      normals[p] = 0;
      normals[p + 1] = surface.ny;
      normals[p + 2] = surface.nz;
      p += 3;
    }
  }

  // Keep the object centred in generic GLB viewers throughout the animation.
  // Without this, a physically pinned far edge makes the compact rolled pose
  // sit at the edge of the open pose's much larger bounding box.
  const centreZ = (minZ + maxZ) / 2;
  for (let i = 2; i < positions.length; i += 3) positions[i] -= centreZ;

  return { positions, normals };
}

function buildUvs() {
  const count = (X_SEGMENTS + 1) * (Q_SEGMENTS + 1);
  const uvs = new Float32Array(count * 2);
  let p = 0;
  for (let row = 0; row <= Q_SEGMENTS; row++) {
    const v = UV_CROP.v0 + (UV_CROP.v1 - UV_CROP.v0) * row / Q_SEGMENTS;
    for (let col = 0; col <= X_SEGMENTS; col++) {
      uvs[p++] = UV_CROP.u0 + (UV_CROP.u1 - UV_CROP.u0) * col / X_SEGMENTS;
      uvs[p++] = v;
    }
  }
  return uvs;
}

function buildIndices() {
  const values = [];
  const stride = X_SEGMENTS + 1;
  for (let row = 0; row < Q_SEGMENTS; row++) {
    for (let col = 0; col < X_SEGMENTS; col++) {
      const a = row * stride + col;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      values.push(a, c, b, b, c, d);
    }
  }
  return Uint16Array.from(values);
}

function subtract(a, b) {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] - b[i];
  return out;
}

function minMax3(values) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < values.length; i += 3) {
    for (let j = 0; j < 3; j++) {
      min[j] = Math.min(min[j], values[i + j]);
      max[j] = Math.max(max[j], values[i + j]);
    }
  }
  return { min, max };
}

function main() {
  const texture = fs.readFileSync(TEXTURE);
  const open = buildPose(0);
  const targets = [];
  for (let i = 0; i < POSE_COUNT; i++) {
    const rollFraction = 1 - i / POSE_COUNT;
    const pose = buildPose(rollFraction);
    targets.push({
      positions: subtract(pose.positions, open.positions),
      normals: subtract(pose.normals, open.normals),
    });
  }
  // Explicit open target. Some viewers mishandle an animated endpoint where
  // every morph weight is zero, despite that being valid glTF.
  targets.push({
    positions: new Float32Array(open.positions.length),
    normals: new Float32Array(open.normals.length),
  });

  const uvs = buildUvs();
  const indices = buildIndices();
  const targetCount = targets.length;
  const times = new Float32Array(targetCount);
  const weights = new Float32Array(targetCount * targetCount);
  for (let frame = 0; frame < targetCount; frame++) {
    times[frame] = DURATION * frame / (targetCount - 1);
    weights[frame * targetCount + frame] = 1;
  }

  const chunks = [];
  const bufferViews = [];
  const accessors = [];
  let byteOffset = 0;

  function addBuffer(data, target) {
    const raw = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    const padded = Buffer.alloc(align4(raw.length));
    raw.copy(padded);
    const index = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: raw.length,
      ...(target ? { target } : {}),
    });
    chunks.push(padded);
    byteOffset += padded.length;
    return index;
  }

  function addAccessor(data, type, componentType, options = {}) {
    const componentCount = { SCALAR: 1, VEC2: 2, VEC3: 3 }[type];
    const bufferView = addBuffer(data, options.target);
    const accessor = {
      bufferView,
      componentType,
      count: data.length / componentCount,
      type,
    };
    if (options.min) accessor.min = options.min;
    if (options.max) accessor.max = options.max;
    const index = accessors.length;
    accessors.push(accessor);
    return index;
  }

  const bounds = minMax3(open.positions);
  const positionAccessor = addAccessor(open.positions, 'VEC3', 5126, {
    target: 34962,
    min: bounds.min,
    max: bounds.max,
  });
  const normalAccessor = addAccessor(open.normals, 'VEC3', 5126, { target: 34962 });
  const uvAccessor = addAccessor(uvs, 'VEC2', 5126, { target: 34962 });
  const indexAccessor = addAccessor(indices, 'SCALAR', 5123, { target: 34963 });

  const targetDefs = targets.map((target) => ({
    POSITION: addAccessor(target.positions, 'VEC3', 5126, { target: 34962 }),
    NORMAL: addAccessor(target.normals, 'VEC3', 5126, { target: 34962 }),
  }));

  const timeAccessor = addAccessor(times, 'SCALAR', 5126, {
    min: [0],
    max: [DURATION],
  });
  const weightAccessor = addAccessor(weights, 'SCALAR', 5126);
  const imageView = addBuffer(texture);

  const json = {
    asset: {
      version: '2.0',
      generator: 'SAIA animated mat generator',
      copyright: 'SAÏA London',
    },
    scene: 0,
    scenes: [{ name: 'SAIA Mat — Mobile Portrait', nodes: [0, 1] }],
    nodes: [{
      name: 'SAIA_Mat_Roll_Open',
      mesh: 0,
      // Stand the mat upright in portrait orientation. +90° around X maps
      // its length to screen-vertical, keeps the logo at the bottom, and
      // makes the roll project toward a front-facing camera.
      rotation: [Math.SQRT1_2, 0, 0, Math.SQRT1_2],
    }, {
      name: 'SAIA_Mobile_Portrait_Camera',
      camera: 0,
      translation: [0, 0, MOBILE_CAMERA_DISTANCE],
    }],
    cameras: [{
      name: 'SAIA Mobile Portrait 390x844',
      type: 'perspective',
      perspective: {
        aspectRatio: MOBILE_ASPECT,
        yfov: MOBILE_VERTICAL_FOV * Math.PI / 180,
        znear: 0.1,
        zfar: 100,
      },
    }],
    meshes: [{
      name: 'SAIA_Mat',
      weights: Array(targetCount).fill(0),
      extras: {
        usage: 'Scrub animation time from 0 (rolled) to 4 (open); reverse to close.',
        dimensions_metres: [WIDTH, LENGTH, THICKNESS],
        presentation: 'Upright portrait orientation for mobile screens.',
        recommended_mobile_camera: {
          aspect_ratio: MOBILE_ASPECT,
          distance_metres: MOBILE_CAMERA_DISTANCE,
          vertical_fov_degrees: MOBILE_VERTICAL_FOV,
        },
      },
      primitives: [{
        attributes: {
          POSITION: positionAccessor,
          NORMAL: normalAccessor,
          TEXCOORD_0: uvAccessor,
        },
        indices: indexAccessor,
        material: 0,
        targets: targetDefs,
      }],
    }],
    materials: [{
      name: 'SAIA_Rubber',
      pbrMetallicRoughness: {
        baseColorTexture: { index: 0 },
        metallicFactor: 0,
        roughnessFactor: 0.88,
      },
      alphaMode: 'OPAQUE',
      doubleSided: true,
    }],
    textures: [{ sampler: 0, source: 0 }],
    samplers: [{
      magFilter: 9729,
      minFilter: 9987,
      wrapS: 33071,
      wrapT: 33071,
    }],
    images: [{ name: 'SAIA_Mat_Artwork', bufferView: imageView, mimeType: 'image/png' }],
    animations: [{
      name: 'SAIA_Mat_Unroll',
      extras: {
        scroll_mapping: 'clip.time = scrollProgress * clip.duration',
        reversible: true,
      },
      samplers: [{ input: timeAccessor, output: weightAccessor, interpolation: 'LINEAR' }],
      channels: [{ sampler: 0, target: { node: 0, path: 'weights' } }],
    }],
    accessors,
    bufferViews,
    buffers: [{ byteLength: byteOffset }],
  };

  const jsonBytes = Buffer.from(JSON.stringify(json));
  const jsonChunk = Buffer.alloc(align4(jsonBytes.length), 0x20);
  jsonBytes.copy(jsonChunk);
  const binChunk = Buffer.concat(chunks);
  const totalLength = 12 + 8 + jsonChunk.length + 8 + binChunk.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonChunk.length, 0);
  jsonHeader.writeUInt32LE(0x4E4F534A, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binChunk.length, 0);
  binHeader.writeUInt32LE(0x004E4942, 4);

  fs.writeFileSync(OUTPUT, Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk]));
  console.log(`Created ${OUTPUT}`);
  console.log(`Vertices: ${open.positions.length / 3}; triangles: ${indices.length / 3}; morph poses: ${targets.length}`);
  console.log(`Animation: SAIA_Mat_Unroll, 0s rolled → ${DURATION}s open`);
}

main();
