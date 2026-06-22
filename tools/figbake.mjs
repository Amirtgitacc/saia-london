/* SAÏA — figbake v3: lift Cristina off the mat + synthesize contact shadow.
   The WebGL mesh IS the mat now, so each figure PNG must contain Cristina ONLY
   (no mat pixels). Pipeline:
     1. border flood-fill → remove cream background
     2. connectivity flood → remove the cool-grey mat (keyed on warm-body / cool-mat contrast)
     3. synthesize a soft ground contact shadow from her lower silhouette
     4. register by silhouette (contact anchor + height normalise) so all 15 share ONE contact line

   in : tools/figsrc/pose-01..15.{png,jpeg}
   out: assets/figure/figure-1..15.png       (transparent, Cristina + soft shadow)
        assets/figure/figure-1..15.debug.png (silhouette box + contact dot overlay)
   Usage: node tools/figbake.mjs            # bakes every file in tools/figsrc
          node tools/figbake.mjs a.png b.png  # bakes just those (paths or basenames)
*/
import { chromium } from 'playwright';
import { readdirSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const SRC_DIR = 'tools/figsrc';
const OUT_DIR = 'assets/figure';

/* canonical output frame — identical for all 15 poses. */
const OUT_W = 1400, OUT_H = 1500;
const TARGET = { cx: 700, bottomY: 1380, area: 222238 }; // contact centre + figure area in output (tuned to median standing figArea)

mkdirSync(OUT_DIR, { recursive: true });

const args = process.argv.slice(2);
let files;
if (args.length) {
  files = args.map(a => (a.includes('/') ? a : path.join(SRC_DIR, a)));
} else {
  files = readdirSync(SRC_DIR).filter(f => /\.(png|jpe?g)$/i.test(f)).sort()
    .map(f => path.join(SRC_DIR, f));
}
if (!files.length) { console.log('no source frames in', SRC_DIR); process.exit(0); }

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 200, height: 200 } });

function dataURL(file) {
  const ext = path.extname(file).slice(1).toLowerCase();
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${readFileSync(file).toString('base64')}`;
}

const summary = [];
for (const file of files) {
  if (!existsSync(file)) { console.log('skip (missing):', file); continue; }
  const basename = path.basename(file).replace(/\.(png|jpe?g)$/i, '');
  // Map pose-NN → figure-N (strip leading zero)
  const name = `figure-${parseInt(basename.replace(/[^0-9]/g, ''), 10)}`;

  const res = await page.evaluate(async ({ src, OUT_W, OUT_H, TARGET }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const cx = c.getContext('2d');
    cx.fillStyle = '#F4F0E6'; cx.fillRect(0, 0, W, H);  // cream behind → handles transparent sources
    cx.drawImage(img, 0, 0);
    const sd = cx.getImageData(0, 0, W, H), px = sd.data;

    const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
    const sat = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx ? (mx - mn) / mx : 0; };

    // background colour = median-ish of the four corners
    const corner = (x0, y0) => { let r = 0, g = 0, b = 0, n = 0;
      for (let y = y0; y < y0 + 18; y++) for (let x = x0; x < x0 + 18; x++) { const i = (y * W + x) * 4; r += px[i]; g += px[i + 1]; b += px[i + 2]; n++; }
      return [r / n, g / n, b / n]; };
    const cs = [corner(2, 2), corner(W - 20, 2), corner(2, H - 20), corner(W - 20, H - 20)];
    const bg = [0, 1, 2].map(k => cs.reduce((s, c) => s + c[k], 0) / cs.length);
    const dist = (r, g, b) => Math.hypot(r - bg[0], g - bg[1], b - bg[2]);

    // --- STEP 1: border flood-fill to remove cream background ---
    // Only cream CONNECTED to the image edge is background.
    // Her cream top/sleeves are enclosed by hair/limbs/ink outline, so they stay opaque.
    const Tf = 32;            // cream-likeness used by the flood (slightly wider to consume near-cream mat edges)
    const outside = new Uint8Array(W * H);
    const stack = [];
    const bgLike = (idx) => { const i = idx * 4; return dist(px[i], px[i + 1], px[i + 2]) < Tf; };
    const seed = (idx) => { if (!outside[idx] && bgLike(idx)) { outside[idx] = 1; stack.push(idx); } };
    for (let x = 0; x < W; x++) { seed(x); seed((H - 1) * W + x); }
    for (let y = 0; y < H; y++) { seed(y * W); seed(y * W + W - 1); }
    while (stack.length) {
      const idx = stack.pop(), x = idx % W, y = (idx / W) | 0;
      if (x > 0) seed(idx - 1); if (x < W - 1) seed(idx + 1);
      if (y > 0) seed(idx - W); if (y < H - 1) seed(idx + W);
    }

    // --- STEP 2: remove the mat by a connectivity flood ---
    // Mat is cool/neutral grey with some terracotta wash; Cristina has warm skin, terracotta
    // leggings (sat ~0.55), cream top (lum ~220), dark hair (connected body, isolated from mat).
    // Strategy: DUAL matLike predicate — primary (strict, for internal flooding) + secondary
    // (looser, only for boundary pixels adjacent to already-confirmed mat pixels).
    // This lets the flood eat the terracotta mat wash without initially seeding into her leggings.
    const satOf = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx ? (mx - mn) / mx : 0; };
    const lumOf = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

    // Sample mat colour from lower wings for reporting
    let mr = 0, mg = 0, mb = 0, mn2 = 0;
    for (let y = Math.floor(H * 0.84); y < Math.floor(H * 0.97); y++) {
      let xl = -1, xr = -1;
      for (let x = 0; x < W; x++) { const idx = y * W + x; if (!outside[idx]) { if (xl < 0) xl = x; xr = x; } }
      if (xl < 0) continue;
      for (const x of [xl, xl + 8, xr - 8, xr]) { if (x < 0 || x >= W) continue; const i = (y * W + x) * 4; mr += px[i]; mg += px[i + 1]; mb += px[i + 2]; mn2++; }
    }
    const matC = mn2 ? [mr / mn2, mg / mn2, mb / mn2] : [110, 108, 104];

    // TWO-PASS mat removal strategy:
    //
    // Pass 1 — strict: flood only the clearly-grey mat pixels.
    //   sat < 0.32, lum > 82 (hair is ~40-70 → protected), lum < 185 (won't touch cream body)
    //   This is safe: won't eat her hair even in bent poses where braid touches mat.
    //
    // Pass 2 — expand: from confirmed mat pixels, grow into adjacent lighter/warmer mat areas.
    //   sat < 0.42, lum > 82, lum < 205. The "adjacent to already-confirmed mat" constraint
    //   prevents seeding into her body from scratch — expansion only crosses the mat surface.
    //
    // Final knobs:
    //   strictSat 0.32 / strictLum [82,185]  — grey mat core
    //   looseSat  0.42 / looseLum  [82,205]  — terracotta wash + lighter mat patches
    //   lumFloor  82               — protect dark hair (lum 40-70)

    const isMat = new Uint8Array(W * H);
    const mstack = [];

    const isStrictMat = (idx) => {
      if (outside[idx] || isMat[idx]) return false;
      const i = idx * 4, r = px[i], g = px[i + 1], b = px[i + 2];
      const l = lumOf(r, g, b);
      return satOf(r, g, b) < 0.32 && l > 82 && l < 185;
    };
    const isLooseMat = (idx) => {
      if (outside[idx] || isMat[idx]) return false;
      const y = (idx / W) | 0;
      if (y < Math.floor(H * 0.62)) return false;  // don't expand into upper body / cream top area
      const i = idx * 4, r = px[i], g = px[i + 1], b = px[i + 2];
      const l = lumOf(r, g, b);
      return satOf(r, g, b) < 0.42 && l > 82 && l < 218;
    };

    const mseedS = (idx) => { if (!isMat[idx] && isStrictMat(idx)) { isMat[idx] = 1; mstack.push(idx); } };

    // Seed from image edges + wing tips for strict pass
    for (let x = 0; x < W; x++) { mseedS((H-1)*W+x); mseedS(Math.floor(H*0.95)*W+x); }
    for (let y = Math.floor(H*0.50); y < H; y++) { mseedS(y*W); mseedS(y*W+W-1); }
    for (let y = Math.floor(H * 0.60); y < H; y++) {
      let xl = -1, xr = -1;
      for (let x = 0; x < W; x++) { const idx = y*W+x; if (!outside[idx]) { if (xl<0) xl=x; xr=x; } }
      if (xl >= 0) {
        for (let dx = 0; dx < 20; dx++) {
          mseedS(y*W + Math.min(xl+dx, W-1));
          mseedS(y*W + Math.max(xr-dx, 0));
        }
      }
    }

    // Run pass 1
    while (mstack.length) {
      const idx = mstack.pop(), x = idx%W, y = (idx/W)|0;
      if (x>0) mseedS(idx-1); if (x<W-1) mseedS(idx+1);
      if (y>0) mseedS(idx-W); if (y<H-1) mseedS(idx+W);
    }

    // Pass 2: expand from confirmed mat pixels using loose predicate
    const mseedL = (idx) => { if (!isMat[idx] && isLooseMat(idx)) { isMat[idx] = 1; mstack.push(idx); } };
    for (let idx = 0; idx < W*H; idx++) {
      if (!isMat[idx]) continue;
      const x = idx%W, y = (idx/W)|0;
      if (x>0) mseedL(idx-1); if (x<W-1) mseedL(idx+1);
      if (y>0) mseedL(idx-W); if (y<H-1) mseedL(idx+W);
    }
    while (mstack.length) {
      const idx = mstack.pop(), x = idx%W, y = (idx/W)|0;
      if (x>0) mseedL(idx-1); if (x<W-1) mseedL(idx+1);
      if (y>0) mseedL(idx-W); if (y<H-1) mseedL(idx+W);
    }

    // fold mat into "transparent"
    for (let idx = 0; idx < W*H; idx++) if (isMat[idx]) outside[idx] = 1;

    // write alpha: 0 outside+mat, opaque inside, 1px feather at boundary
    for (let idx = 0; idx < W * H; idx++) {
      if (outside[idx]) { px[idx * 4 + 3] = 0; continue; }
      const x = idx % W, y = (idx / W) | 0;
      const edge = (x > 0 && outside[idx - 1]) || (x < W - 1 && outside[idx + 1]) ||
                   (y > 0 && outside[idx - W]) || (y < H - 1 && outside[idx + W]);
      if (edge) px[idx * 4 + 3] = 150;
    }
    cx.putImageData(sd, 0, 0);

    // --- STEP 3: scan figure silhouette (Cristina only, post-mat-removal) ---
    let top = H, bottom = -1, minX = W, maxX = -1, figArea = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (!outside[idx]) { if (y < top) top = y; if (y > bottom) bottom = y; if (x < minX) minX = x; if (x > maxX) maxX = x; figArea++; }
    }
    if (bottom < 0) return { ok: false, bg };
    // contact anchor: bottom-centre of her lower 10% silhouette band
    const bandTop = bottom - Math.max(1, Math.round((bottom - top) * 0.10));
    let sumX = 0, nX = 0;
    for (let y = bandTop; y <= bottom; y++) for (let x = 0; x < W; x++) { const idx = y * W + x; if (!outside[idx]) { sumX += x; nX++; } }
    const contactX = nX ? sumX / nX : (minX + maxX) / 2;
    const contactY = bottom, figH = bottom - top;
    const conf = Math.max(0, Math.min(1, (figH / H - 0.45) / 0.5));

    // --- STEP 4: synthesize soft ground shadow + draw figure on top ---
    const s = Math.sqrt(TARGET.area / figArea);
    const out = document.createElement('canvas'); out.width = OUT_W; out.height = OUT_H;
    const oc = out.getContext('2d'); oc.imageSmoothingQuality = 'high';

    // contact shadow: clip to bottom 5% of silhouette (actual ground contact line only)
    const contactBand = document.createElement('canvas'); contactBand.width = W; contactBand.height = H;
    const cbc = contactBand.getContext('2d');
    // draw only the contact band rows (bottom 5% of fig height)
    const bandH5 = Math.max(4, Math.round((bottom - top) * 0.05));
    const bandY5 = bottom - bandH5;
    cbc.drawImage(c, 0, bandY5, W, bandH5, 0, bandY5, W, bandH5);
    // recolor to ink-dark
    cbc.globalCompositeOperation = 'source-in';
    cbc.fillStyle = 'rgb(46,40,33)'; cbc.fillRect(0, 0, W, H);

    // draw shadow: squashed + blurred + faint, anchored at contact point
    oc.save();
    oc.globalAlpha = 0.16; oc.filter = 'blur(20px)';
    oc.translate(TARGET.cx, TARGET.bottomY); oc.scale(s, s * 0.12); oc.translate(-contactX, -contactY);
    oc.drawImage(contactBand, 0, 0);
    oc.restore();

    // Cristina on top
    oc.save();
    oc.translate(TARGET.cx, TARGET.bottomY); oc.scale(s, s); oc.translate(-contactX, -contactY);
    oc.drawImage(c, 0, 0);
    oc.restore();

    // --- debug overlay ---
    const dbg = document.createElement('canvas'); dbg.width = OUT_W; dbg.height = OUT_H;
    const dc = dbg.getContext('2d'); dc.fillStyle = '#1b1b1b'; dc.fillRect(0, 0, OUT_W, OUT_H);
    const ds = Math.min(OUT_W / W, OUT_H / H); dc.save(); dc.scale(ds, ds); dc.drawImage(img, 0, 0); dc.restore();
    dc.lineWidth = 4; dc.strokeStyle = '#36d399';
    dc.strokeRect(minX * ds, top * ds, (maxX - minX) * ds, (bottom - top) * ds);
    dc.fillStyle = '#ff5a36'; dc.beginPath(); dc.arc(contactX * ds, contactY * ds, 7, 0, 7); dc.fill();

    return { ok: true, conf, contactX, contactY, figH, figArea, matC, s, bg, H, W,
      png: out.toDataURL('image/png'), debug: dbg.toDataURL('image/png') };
  }, { src: dataURL(file), OUT_W, OUT_H, TARGET });

  if (!res.ok) { console.log(`✗ ${name}  FIGURE NOT DETECTED — bg≈${res.bg.map(n=>n|0)}`); summary.push({ name, conf: 0 }); continue; }
  const b64 = (u) => Buffer.from(u.split(',')[1], 'base64');
  writeFileSync(path.join(OUT_DIR, `${name}.png`), b64(res.png));
  writeFileSync(path.join(OUT_DIR, `${name}.debug.png`), b64(res.debug));
  const flag = res.conf < 0.55 ? '  ⚠ LOW' : '';
  console.log(`✓ ${name}  conf=${res.conf.toFixed(2)} figH=${res.figH|0} figArea=${res.figArea|0} cx=${res.contactX|0} matC=${res.matC.map(n=>n|0)} s=${res.s.toFixed(3)}${flag}`);
  summary.push({ name, conf: res.conf });
}

await browser.close();
const low = summary.filter(s => s.conf < 0.55);
console.log(`\nbaked ${summary.length} → ${OUT_DIR}/  (${low.length} low-confidence${low.length ? ': ' + low.map(s=>s.name).join(', ') : ''})`);
