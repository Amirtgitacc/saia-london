/* ============================================================
   SAÏA — shared WebGL mat helpers
   Ported verbatim (logic-for-logic) from the Claude Design
   prototypes: real GLB parse, Archimedean-spiral unroll deform,
   and the procedural rubber normal map.
   Exposed on window.SAIA.mat
   ============================================================ */
(function () {
  const NS = (window.SAIA = window.SAIA || {});

  /* ---- parse the real SAÏA mat .glb directly (1 mesh, indexed grid, baked tex) ---- */
  async function loadGlb(url) {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    const dv = new DataView(buf);
    if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a glb');
    const c0len = dv.getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, c0len)));
    const binOff = 20 + c0len;
    const c1len = dv.getUint32(binOff, true);
    const bin = new Uint8Array(buf, binOff + 8, c1len);
    const prim = json.meshes[0].primitives[0];
    const readAcc = (idx, comps) => {
      const acc = json.accessors[idx];
      const bv = json.bufferViews[acc.bufferView];
      const off = (bv.byteOffset || 0) + (acc.byteOffset || 0);
      const start = bin.byteOffset + off, n = acc.count * comps;
      if (acc.componentType === 5126) return new Float32Array(bin.buffer, start, n).slice();
      if (acc.componentType === 5125) return new Uint32Array(bin.buffer, start, n).slice();
      if (acc.componentType === 5123) return new Uint16Array(bin.buffer, start, n).slice();
      throw new Error('unsupported componentType');
    };
    return {
      pos: readAcc(prim.attributes.POSITION, 3),
      uv: readAcc(prim.attributes.TEXCOORD_0, 2),
      indices: readAcc(prim.indices, 1),
    };
  }

  /* ---- Archimedean-spiral roll ---- */
  function buildSpiralTable(totalArc, R0, b) {
    const thetas = [0], arcs = [0]; let theta = 0, s = 0; const step = 0.05;
    while (s < totalArc && theta < 600) {
      const r = R0 + b * theta;
      s += Math.sqrt(r * r + b * b) * step; theta += step;
      thetas.push(theta); arcs.push(s);
    }
    return { thetas, arcs, R0, b };
  }
  function spiralPoint(table, arc) {
    const arcs = table.arcs, thetas = table.thetas; let lo = 0, hi = arcs.length - 1;
    if (arc <= 0) return { x: table.R0, y: 0 };
    if (arc >= arcs[hi]) { lo = hi; }
    else { while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arcs[m] < arc) lo = m; else hi = m; } }
    const t0 = arcs[lo], t1 = arcs[Math.min(lo + 1, arcs.length - 1)];
    const f = t1 > t0 ? (arc - t0) / (t1 - t0) : 0;
    const theta = thetas[lo] + (thetas[Math.min(lo + 1, thetas.length - 1)] - thetas[lo]) * f;
    const r = table.R0 + table.b * theta;
    return { x: r * Math.cos(theta), y: r * Math.sin(theta) };
  }

  /* progress 0=fully rolled .. 1=flat. Mutates geometry.position in place. */
  function deform(ctx, progress) {
    const geometry = ctx.geometry;
    if (!geometry) return;
    const pos = geometry.attributes.position.array, base = ctx.basePositions, L = ctx.length;
    const unrolled = progress * L, b = ctx.thickness / (2 * Math.PI);
    const table = buildSpiralTable(L - unrolled, ctx.R0, b);
    /* Orient the coil so the mat peels off the BOTTOM of the roll: rotate the
       spiral so its outer end (the peel point) points straight down, then sit
       it on the ground. The peel lands at (0,0) — flush and tangent with the
       flat run — so there's no seam/lip and the roll rests on the floor. */
    const thetaE = table.thetas[table.thetas.length - 1];
    const rE = table.R0 + table.b * thetaE;            // current roll radius
    const psi = -Math.PI / 2 - thetaE;
    const cosP = Math.cos(psi), sinP = Math.sin(psi);
    const count = pos.length / 3;
    for (let i = 0; i < count; i++) {
      const bx = base[i * 3], bz = base[i * 3 + 2];
      const sLen = bx - ctx.minL; const wc = bz; let lp, hp;
      if (sLen <= unrolled) { lp = (sLen - unrolled); hp = 0; }
      else {
        const sp = spiralPoint(table, L - sLen);
        const rx = sp.x * cosP - sp.y * sinP;
        const ry = sp.x * sinP + sp.y * cosP;
        lp = -rx;          // coil curls up onto the +X side, away from the flat run
        hp = rE + ry;      // outer wrap rests on the ground (hp = 0 at the peel)
      }
      pos[i * 3] = lp; pos[i * 3 + 1] = hp; pos[i * 3 + 2] = wc;
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  /* ---- smooth, even studio environment (keeps the rubber matte) ---- */
  function makeEnv(renderer) {
    const THREE = window.THREE;
    const W = 256, H = 128;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const x = cv.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0.0, '#f3efe6'); g.addColorStop(0.5, '#c9c4ba'); g.addColorStop(1.0, '#6f6c66');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    const tex = new THREE.CanvasTexture(cv);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    const pm = new THREE.PMREMGenerator(renderer);
    const env = pm.fromEquirectangular(tex).texture;
    tex.dispose(); pm.dispose();
    return env;
  }

  /* ---- procedural normal map: fine rubber grain ---- */
  function makeNormalMap() {
    const THREE = window.THREE;
    const W = 1024, H = 384;
    const h = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) h[i] = (Math.random() - 0.5) * 0.5;
    for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
      h[y * W + xx] += Math.sin(xx * 1.6 + y * 0.7) * Math.sin(y * 1.6 - xx * 0.5) * 0.12;
    }
    for (let pass = 0; pass < 2; pass++) {
      const bb = new Float32Array(W * H);
      for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
        let a = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
          a += h[((y + dy + H) % H) * W + ((xx + dx + W) % W)];
        bb[y * W + xx] = a / 9;
      }
      h.set(bb);
    }
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'); const img = ctx.createImageData(W, H), dd = img.data;
    const idx = (a, b) => ((b + H) % H) * W + ((a + W) % W); const s = 1.2;
    for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
      let nx = (h[idx(xx - 1, y)] - h[idx(xx + 1, y)]) * s;
      let ny = (h[idx(xx, y - 1)] - h[idx(xx, y + 1)]) * s; let nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1; nx /= len; ny /= len; nz /= len;
      const o = (y * W + xx) * 4;
      dd[o] = (nx * 0.5 + 0.5) * 255; dd[o + 1] = (ny * 0.5 + 0.5) * 255;
      dd[o + 2] = (nz * 0.5 + 0.5) * 255; dd[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = 8;
    return tex;
  }

  /* ---- build the mat geometry from the GLB (flat grid, length->X), with the
         180° in-plane orientation + axis-swap from the final prototypes ---- */
  function buildGeometry(glb, length) {
    const THREE = window.THREE;
    if (glb) {
      const src = glb.pos, n = src.length / 3;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (let i = 0; i < n; i++) {
        const x = src[i * 3], z = src[i * 3 + 2];
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
      }
      const scale = length / (maxZ - minZ), cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
      const out = new Float32Array(src.length);
      for (let i = 0; i < n; i++) {
        out[i * 3]     = -(src[i * 3 + 2] - cz) * scale; // length axis -> X (flipped end-to-end)
        out[i * 3 + 1] = 0;                              // flat
        out[i * 3 + 2] = -(src[i * 3]     - cx) * scale; // width axis -> Z (180° in-plane)
      }
      /* soften the four corners so the mat doesn't read as a hard rectangle:
         clamp any vertex in a corner zone onto a quarter-circle of radius cr */
      let halfL = 0, halfW = 0;
      for (let i = 0; i < n; i++) {
        const ax = Math.abs(out[i * 3]), az = Math.abs(out[i * 3 + 2]);
        if (ax > halfL) halfL = ax; if (az > halfW) halfW = az;
      }
      const cr = halfW * 0.22, ix = halfL - cr, iz = halfW - cr;
      for (let i = 0; i < n; i++) {
        const x = out[i * 3], z = out[i * 3 + 2];
        const ax = Math.abs(x), az = Math.abs(z);
        if (ax > ix && az > iz) {
          const dx = ax - ix, dz = az - iz, d = Math.sqrt(dx * dx + dz * dz);
          if (d > cr) { const f = cr / d; out[i * 3] = Math.sign(x) * (ix + dx * f); out[i * 3 + 2] = Math.sign(z) * (iz + dz * f); }
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(out, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(glb.uv, 2));
      geo.setIndex(new THREE.BufferAttribute(glb.indices, 1));
      geo.computeVertexNormals();
      return geo;
    }
    const geo = new THREE.PlaneGeometry(length, 1.15, 760, 20);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }

  /* ---- baked colour map, with the U-axis mirror that un-reverses the brand ---- */
  function loadColorMap(url) {
    const THREE = window.THREE;
    const tex = new THREE.TextureLoader().load(url);
    tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = -1; tex.offset.x = 1;
    return tex;
  }

  NS.mat = { loadGlb, buildSpiralTable, spiralPoint, deform, makeEnv, makeNormalMap, buildGeometry, loadColorMap };
})();
