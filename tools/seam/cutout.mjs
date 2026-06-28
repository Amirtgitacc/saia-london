/* SAÏA — remove the cream paper background from flow frames via edge flood-fill,
   leaving Cristina + mat + contact shadow on transparency. Composited over the
   page cream this is fully seamless (no frame panel/border).
   Edge flood = only cream CONNECTED to the border is bg; her enclosed cream top
   stays. Then THREE matte fixes so no rim survives the composite:
     1. alpha DECONTAMINATION — the feather band keeps cream RGB and composites as a
        light halo; we bleed FOREGROUND colour outward into that band so the soft edge
        is Cristina's colour, not paper.
     2. PERIMETER cleanup — force the outer ring to alpha 0 (and log any frame whose
        border still has alpha, i.e. a pose that paints to the canvas edge).
     3. TEMPORAL MEDIAN — median the binary mask across ±1 neighbour frames so the
        silhouette stops crawling/shimmering during motion (median, not mean → keeps
        the real motion, kills 1-frame jitter).
   Usage: node tools/seam/cutout.mjs <srcDir> <outDir> <count> [test f1,f2,..] */
import { chromium } from 'playwright';
import { mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

const SRC = process.argv[2] || 'assets/flow-frames';
const OUTD = process.argv[3] || 'assets/flow-frames';
const COUNT = parseInt(process.argv[4] || '303', 10);
const TESTLIST = process.argv[5] ? process.argv[5].split(',').map(Number) : null;
const T = 34;        // flood cream-likeness threshold (Euclidean from sampled bg)
const FEATHER = parseInt(process.env.FEATHER || '5', 10);   // alpha blur radius (px) — wider = softer silhouette
const PAD = parseInt(process.env.PAD || '7', 10);           // decontamination bleed distance (>= FEATHER)
const PERIM = parseInt(process.env.PERIM || '5', 10);       // perimeter ring (px) forced to alpha 0 (>= FEATHER)
// MEDIAN off by default: medianing the mask across ±1 frames serrated the edge into a "stitched"
// comb fringe (the AI frames wobble ~1-2px, so 3 offset silhouettes disagree all along the edge).
// Motion smoothness is handled by fractional frame blending in home-journey.js instead.
const MEDIAN = process.env.MEDIAN === '1';                  // temporal median of mask across ±1 frames
// DECON off by default: alpha decontamination is invisible on the cream page (cream-on-cream) and
// adds no benefit; kept as an opt-in toggle in case the hero background ever stops being cream.
const DECON = process.env.DECON === '1';                    // alpha decontamination (foreground bleed)

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:8000/', { waitUntil: 'domcontentloaded' });
if (!TESTLIST) { rmSync(OUTD, { recursive: true, force: true }); mkdirSync(OUTD, { recursive: true }); }
else mkdirSync(OUTD, { recursive: true });

const pad3 = n => String(n).padStart(3, '0');
const list = TESTLIST || Array.from({ length: COUNT }, (_, i) => i + 1);
const readB64 = n => (n >= 1 && n <= COUNT && existsSync(`${SRC}/f${pad3(n)}.jpg`))
  ? readFileSync(`${SRC}/f${pad3(n)}.jpg`).toString('base64') : null;

for (const n of list) {
  const cur = readB64(n), prev = readB64(n - 1) || cur, next = readB64(n + 1) || cur;
  const res = await page.evaluate(async ({ cur, prev, next, FEATHER, PAD, PERIM, MEDIAN, DECON }) => {
    const decode = async (b64) => {
      const img = new Image(); img.src = 'data:image/jpeg;base64,' + b64; await img.decode();
      const W = img.naturalWidth, H = img.naturalHeight;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const cx = c.getContext('2d', { willReadFrequently: true });
      cx.drawImage(img, 0, 0);
      return { W, H, sd: cx.getImageData(0, 0, W, H), cx, c };
    };

    // binary "outside" (border-connected paper) for one image's pixel buffer
    const computeOutside = (px, W, H) => {
      // bright + low-saturation paper. mn>188 (was 198) catches the slightly DARKER paper in the
      // fold→dog transition frames (border mn dips to ~192) whose seeds the old bar rejected,
      // leaving a full cream panel. Skin/leggings (saturated) and hair/mat (dark) stay excluded.
      const bgLike = idx => { const i = idx * 4, r = px[i], g = px[i + 1], b = px[i + 2]; const mn = Math.min(r, g, b), mx = Math.max(r, g, b); return mn > 188 && (mx - mn) < 44; };
      const outside = new Uint8Array(W * H), stack = [];
      const seed = idx => { if (!outside[idx] && bgLike(idx)) { outside[idx] = 1; stack.push(idx); } };
      for (let x = 0; x < W; x++) { seed(x); seed((H - 1) * W + x); }
      for (let y = 0; y < H; y++) { seed(y * W); seed(y * W + W - 1); }
      while (stack.length) {
        const idx = stack.pop(), x = idx % W, y = (idx / W) | 0;
        if (x > 0) seed(idx - 1); if (x < W - 1) seed(idx + 1);
        if (y > 0) seed(idx - W); if (y < H - 1) seed(idx + W);
      }
      // remove SMALL enclosed bg pockets (gaps between limbs); keep large (her cream top)
      const MINKEEP = 5000, visited = new Uint8Array(W * H);
      for (let s0 = 0; s0 < W * H; s0++) {
        if (outside[s0] || visited[s0] || !bgLike(s0)) continue;
        const comp = [s0]; visited[s0] = 1; let qi = 0;
        while (qi < comp.length) {
          const p = comp[qi++], x = p % W, y = (p / W) | 0;
          const nb = []; if (x > 0) nb.push(p - 1); if (x < W - 1) nb.push(p + 1); if (y > 0) nb.push(p - W); if (y < H - 1) nb.push(p + W);
          for (const q of nb) if (!visited[q] && !outside[q] && bgLike(q)) { visited[q] = 1; comp.push(q); }
        }
        if (comp.length < MINKEEP) for (const p of comp) outside[p] = 1;
      }
      return outside;
    };

    const C = await decode(cur), P = await decode(prev), N = await decode(next);
    const W = C.W, H = C.H, WH = W * H, px = C.sd.data;

    // --- 3. TEMPORAL MEDIAN of the binary inside-mask across the 3 frames (optional) ---
    const oC = computeOutside(px, W, H);
    const outside = new Uint8Array(WH);
    if (MEDIAN) {                                 // median: outside if >=2 of 3 say outside
      const oP = (P.W === W && P.H === H) ? computeOutside(P.sd.data, W, H) : oC;
      const oN = (N.W === W && N.H === H) ? computeOutside(N.sd.data, W, H) : oC;
      for (let i = 0; i < WH; i++) outside[i] = (oC[i] + oP[i] + oN[i]) >= 2 ? 1 : 0;
    } else {
      outside.set(oC);
    }

    // --- 1. DECONTAMINATION: bleed foreground RGB outward into the (to-become) feather band ---
    // known = definite foreground; iteratively assign unknown border pixels the mean of their
    // known 4-neighbours, so the soft edge carries Cristina's colour instead of cream paper.
    if (DECON) {
      const known = new Uint8Array(WH);
      for (let i = 0; i < WH; i++) known[i] = outside[i] ? 0 : 1;
      for (let pass = 0; pass < PAD; pass++) {
        const add = [];                            // collect then apply (no in-pass bias)
        for (let idx = 0; idx < WH; idx++) {
          if (known[idx]) continue;
          const x = idx % W, y = (idx / W) | 0;
          let r = 0, g = 0, b = 0, k = 0;
          if (x > 0 && known[idx - 1]) { const j = (idx - 1) * 4; r += px[j]; g += px[j + 1]; b += px[j + 2]; k++; }
          if (x < W - 1 && known[idx + 1]) { const j = (idx + 1) * 4; r += px[j]; g += px[j + 1]; b += px[j + 2]; k++; }
          if (y > 0 && known[idx - W]) { const j = (idx - W) * 4; r += px[j]; g += px[j + 1]; b += px[j + 2]; k++; }
          if (y < H - 1 && known[idx + W]) { const j = (idx + W) * 4; r += px[j]; g += px[j + 1]; b += px[j + 2]; k++; }
          if (k) add.push(idx, (r / k) | 0, (g / k) | 0, (b / k) | 0);
        }
        for (let a = 0; a < add.length; a += 4) { const idx = add[a], j = idx * 4; px[j] = add[a + 1]; px[j + 1] = add[a + 2]; px[j + 2] = add[a + 3]; known[idx] = 1; }
      }
    }

    // alpha: 255 inside, 0 outside, then feathered for soft watercolour edges
    const alpha = new Float32Array(WH);
    for (let i = 0; i < WH; i++) alpha[i] = outside[i] ? 0 : 255;
    const blur = (src) => {
      const tmp = new Float32Array(WH), R = FEATHER;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0, k = 0; for (let d = -R; d <= R; d++) { const xx = x + d; if (xx >= 0 && xx < W) { s += src[y * W + xx]; k++; } } tmp[y * W + x] = s / k; }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0, k = 0; for (let d = -R; d <= R; d++) { const yy = y + d; if (yy >= 0 && yy < H) { s += tmp[yy * W + x]; k++; } } src[y * W + x] = s / k; }
    };
    blur(alpha);

    // --- 2. PERIMETER cleanup: measure the max border alpha (to flag edge-touching poses),
    // then force the outer ring to 0 so no faint panel/dirty-edge survives. ---
    let borderMax = 0;
    for (let x = 0; x < W; x++) { borderMax = Math.max(borderMax, alpha[x], alpha[(H - 1) * W + x]); }
    for (let y = 0; y < H; y++) { borderMax = Math.max(borderMax, alpha[y * W], alpha[y * W + W - 1]); }
    // zero ONLY where the pixel was classified background — kills feathered-bg border bleed
    // (faint panel/dirty edge) WITHOUT clipping a hand/limb that genuinely paints to the edge.
    const zap = idx => { if (outside[idx]) alpha[idx] = 0; };
    for (let r = 0; r < PERIM; r++) {
      for (let x = 0; x < W; x++) { zap(r * W + x); zap((H - 1 - r) * W + x); }
      for (let y = 0; y < H; y++) { zap(y * W + r); zap(y * W + (W - 1 - r)); }
    }

    for (let i = 0; i < WH; i++) px[i * 4 + 3] = Math.round(alpha[i]);
    C.cx.putImageData(C.sd, 0, 0);
    return { url: C.c.toDataURL('image/webp', 0.90), borderMax: Math.round(borderMax) };
  }, { cur, prev, next, FEATHER, PAD, PERIM, MEDIAN, DECON });

  const data = res.url.replace(/^data:image\/webp;base64,/, '');
  writeFileSync(`${OUTD}/f${pad3(n)}.webp`, Buffer.from(data, 'base64'));
  if (res.borderMax > 10) console.log(`  ! f${pad3(n)} border alpha ${res.borderMax} (pose paints to edge — check for clipping)`);
}
await browser.close();
console.log(`cutout: ${list.length} frame(s) -> ${OUTD} (WebP, decontaminated + median + perimeter-clean)`);
