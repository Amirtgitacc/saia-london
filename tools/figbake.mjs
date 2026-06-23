/* SAÏA — figbake: register per-pose "Cristina on the hero mat" generations so the
   mat sits at ONE pixel-stable on-screen rect across every frame. Detection only
   needs the mat (not the figure): we find the mat's bottom-centre + width, then
   translate/scale the WHOLE frame so that mat lands on a canonical rect. The figure
   rides along, so her baked-in contact shadow stays glued to the mat.

   in : tools/figsrc/*.{png,jpg,jpeg}   (raw generations, mat + Cristina, cream bg)
   out: tools/figbaked/<name>.png       (fixed OUT_W×OUT_H, transparent, mat registered)
        tools/figbaked/<name>.debug.png (overlay: detected mat box + target rect)
   Usage: node tools/figbake.mjs            # bakes every file in tools/figsrc
          node tools/figbake.mjs a.png b.png  # bakes just those (paths or basenames)
   Prints per-frame registration confidence; flag/inspect low ones. */
import { chromium } from 'playwright';
import { readdirSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const SRC_DIR = 'tools/figsrc';
const OUT_DIR = 'assets/figure';

/* canonical output frame — identical for all 15 poses. The page shows figure-N.png
   at one fixed CSS rect, so the mat never moves and only Cristina crossfades. */
const OUT_W = 1400, OUT_H = 1500;
const TARGET = { cx: 700, bottomY: 1380, width: 1120 }; // mat front-edge centre + width in the output

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
  const name = 'figure-' + parseInt(path.basename(file).replace(/[^0-9]/g, ''), 10);
  const res = await page.evaluate(async ({ src, OUT_W, OUT_H, TARGET }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const cx = c.getContext('2d');
    cx.fillStyle = '#F4F0E6'; cx.fillRect(0, 0, W, H);  // cream behind → handles transparent sources (the empty hero mat)
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

    // Detect the mat by its SILHOUETTE against the cream background (not by mat colour —
    // the terracotta-washed front edge fooled colour masks). The mat's front (bottom) edge
    // against cream is clean and not where the figure sits, so bottom-centre + width are
    // measured there. We don't need the mat's far edge (legs cross it), only front + width.
    const yStart = Math.floor(H * 0.40);
    const FG = 34; // colour distance from cream that counts as "not background"
    const rowMinX = new Int32Array(H).fill(W), rowMaxX = new Int32Array(H).fill(-1), rowCount = new Float32Array(H);
    for (let y = yStart; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (dist(px[i], px[i + 1], px[i + 2]) > FG) { rowCount[y]++; if (x < rowMinX[y]) rowMinX[y] = x; if (x > rowMaxX[y]) rowMaxX[y] = x; }
    }
    const rowThresh = W * 0.05;
    let bottomY = -1, topY = -1;
    for (let y = yStart; y < H; y++) if (rowCount[y] > rowThresh) { if (topY < 0) topY = y; bottomY = y; }
    if (bottomY < 0) return { ok: false, bg };

    // width/centre = the mat's full horizontal extent across the lower region (tilt-invariant:
    // a 3/4 mat's front edge is diagonal, so a single bottom row underestimates it). Legs and
    // feet never reach past the mat's side edges, so the foreground extremes ARE the mat's.
    let matLeft = W, matRight = -1;
    for (let y = yStart; y < H; y++) if (rowCount[y] > rowThresh) {
      if (rowMinX[y] < matLeft) matLeft = rowMinX[y];
      if (rowMaxX[y] > matRight) matRight = rowMaxX[y];
    }
    const matW = matRight - matLeft, matCx = (matLeft + matRight) / 2;
    const matBottomY = bottomY; // front-most mat point → vertical anchor

    // confidence: a wide mat that reaches a clean front edge reads as a real detection
    const conf = Math.max(0, Math.min(1, (matW / W - 0.35) / 0.45));

    // alpha matte via border flood-fill: only cream CONNECTED to the image edge is background.
    // Her cream top/sleeves are cream too but enclosed by hair/limbs/ink outline, so they stay
    // opaque — a global colour-distance knockout (which erased her top) cannot do this.
    const Tf = 30;            // cream-likeness used by the flood
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
    // write alpha into the source: 0 outside, opaque inside, 1px feather at the boundary
    for (let idx = 0; idx < W * H; idx++) {
      if (outside[idx]) { px[idx * 4 + 3] = 0; continue; }
      const x = idx % W, y = (idx / W) | 0;
      let edge = (x > 0 && outside[idx - 1]) || (x < W - 1 && outside[idx + 1]) ||
                 (y > 0 && outside[idx - W]) || (y < H - 1 && outside[idx + W]);
      if (edge) px[idx * 4 + 3] = 150;
    }
    cx.putImageData(sd, 0, 0);

    // transform: map (matCx, matBottomY)→(TARGET.cx, TARGET.bottomY), scale by mat width
    const s = TARGET.width / matW;
    const out = document.createElement('canvas'); out.width = OUT_W; out.height = OUT_H;
    const oc = out.getContext('2d'); oc.imageSmoothingQuality = 'high';
    oc.translate(TARGET.cx, TARGET.bottomY); oc.scale(s, s); oc.translate(-matCx, -matBottomY);
    oc.drawImage(c, 0, 0);   // c now carries the alpha matte

    // debug: source scaled to fit, with detected box + front-centre + (mapped) target rect
    const dbg = document.createElement('canvas'); dbg.width = OUT_W; dbg.height = OUT_H;
    const dc = dbg.getContext('2d'); dc.fillStyle = '#1b1b1b'; dc.fillRect(0, 0, OUT_W, OUT_H);
    const ds = Math.min(OUT_W / W, OUT_H / H); dc.save(); dc.scale(ds, ds); dc.drawImage(img, 0, 0); dc.restore();
    dc.lineWidth = 4; dc.strokeStyle = '#36d399';     // detected front-edge width @ front y
    dc.strokeRect((matCx - matW / 2) * ds, topY * ds, matW * ds, (matBottomY - topY) * ds);
    dc.strokeStyle = '#ffd93d'; dc.beginPath(); dc.moveTo((matCx - matW / 2) * ds, matBottomY * ds); dc.lineTo((matCx + matW / 2) * ds, matBottomY * ds); dc.stroke();
    dc.fillStyle = '#ff5a36'; dc.beginPath(); dc.arc(matCx * ds, matBottomY * ds, 7, 0, 7); dc.fill();

    return { ok: true, conf, matCx, matW, topY, bottomY: matBottomY, s, bg, H, W,
      png: out.toDataURL('image/png'), debug: dbg.toDataURL('image/png') };
  }, { src: dataURL(file), OUT_W, OUT_H, TARGET });

  if (!res.ok) { console.log(`✗ ${name}  MAT NOT DETECTED — bg≈${res.bg.map(n=>n|0)}`); summary.push({ name, conf: 0 }); continue; }
  const b64 = (u) => Buffer.from(u.split(',')[1], 'base64');
  writeFileSync(path.join(OUT_DIR, `${name}.png`), b64(res.png));
  writeFileSync(path.join(OUT_DIR, `${name}.debug.png`), b64(res.debug));
  const flag = res.conf < 0.55 ? '  ⚠ LOW' : '';
  console.log(`✓ ${name}  conf=${res.conf.toFixed(2)} matW=${res.matW|0} cx=${res.matCx|0} y=${res.topY|0}..${res.bottomY|0} s=${res.s.toFixed(3)}${flag}`);
  summary.push({ name, conf: res.conf });
}

await browser.close();
const low = summary.filter(s => s.conf < 0.55);
console.log(`\nbaked ${summary.length} → ${OUT_DIR}/  (${low.length} low-confidence${low.length ? ': ' + low.map(s=>s.name).join(', ') : ''})`);
