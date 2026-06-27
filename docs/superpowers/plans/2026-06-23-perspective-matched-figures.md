# Perspective-Matched On-Mat Figures — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken flat-figure-over-perspective-mat composite with Cristina drawn *in* the mat's perspective on a gentle-angle mat — so she sits believably in the scene across all 15 poses.

**Architecture:** The single 3D mesh morphs photoreal→watercolour AND eases from the steep angle to a gentle "C" angle during the morph window; at ~p0.56 it hands off (fades out) to 15 on-mat watercolour illustrations of Cristina drawn from a render of that exact mat. All figures share one mat reference, so their mats are consistent and register to one on-screen rect — no doubling.

**Tech Stack:** Vanilla JS + Three.js (runtime), Playwright (headless render/verify), Higgsfield `nano_banana_pro` (figure generation). No new runtime deps.

**Spec:** `docs/superpowers/specs/2026-06-23-perspective-matched-figures-design.md`

## Global Constraints

- **Mat angle "C-gentle" camera (exact):** position `px 2.30, py 2.15, pz 9.20`, lookAt target `(-0.66, 0.12, 2.16)`. The live camera AND the mat reference the figures are drawn from MUST use these exact numbers.
- **R1 — transform in place:** the photoreal→watercolour change stays an in-place material morph on the one mesh (`makeMatMaterial` + `morphFor`). Do NOT turn it back into a cross-fade between two surfaces.
- **R2 — exactly one mat:** during poses, only the figure illustrations show; the 3D canvas is faded out; no separate floor PNG; no mesh under the figures.
- Mat palette muted charcoal/taupe + faint terracotta, never saturated orange. Page palette cream `#F5F1E8`, ink `#2B2620`, terracotta `#B8624A`.
- Do NOT touch the unroll (`deformFor`, p0→0.22) or the mood track (`MOODS`/`applyMood`).
- Mats are HIRE-ONLY in copy (visual work only). English-only. Mobile / `prefers-reduced-motion` `.is-static` poster must keep working (`goStatic()` returns before figure init).
- No unit-test framework: verification is `node tools/morphtest.mjs` (structural, exit 0) + `node tools/matshot.mjs` (screenshots) + reading PNGs.

**Environment (every verification step):** static server already runs on `http://localhost:8000` (start with `cd "/Users/at/Projects/site 2" && python3 -m http.server 8000` if down).

**Commits:** per-task commits follow this session's approved feature-branch workflow (`mat-transform-single-mat`). Each commit step uses a **scoped `git add <specific files>`** (never `git add -A`) so untracked scratch (e.g. `tools/angleshot/`, `tools/lab/`) is never swept in. If the workflow changes, treat the commit steps as "commit when approved."

**Higgsfield identity refs (role `image`, this order), mat reference last:**
- portrait `0029c54c-354d-47f8-a79f-95bb8c49cfd9`
- stand `765be296-a4f1-4ac4-95c6-f755f236ebaa`
- front `02230f93-c9ce-4fc6-a891-66a91e62d3a4`
- **mat reference (C-gentle render, already uploaded):** `afa6bd4c-3166-4369-ad8a-4ae1e97c1d0c`

---

## File map

| File | Responsibility | Change |
|---|---|---|
| `js/home-journey.js` | scroll engine | Ease camera to C-gentle; add handoff canvas-fade; tune `FIG_BOX` |
| `tools/figbake.mjs` | figure registration | Restore mat-detection registration (from git baseline) + keep `assets/figure` output |
| `tools/figsrc/onmat-01..15.png` | on-mat pose sources | New (generate 13, reuse 2 from the lab test) |
| `assets/figure/figure-1..15.png` | registered figures | Regenerated (perspective-matched, on-mat) |
| `tools/figsrc/onmat-backup-matfree/` | backup | Move the current mat-free figures here |

---

### Task 1: Ease the camera to C-gentle + hand off the mesh to the figures

**Files:**
- Modify: `js/home-journey.js` (camera `frames` ~lines 47–55; add `handoffFor`; `paint` and `_rig.at` canvas-opacity lines)

**Interfaces:**
- Produces: pose-section camera that eases steep→C-gentle over p0.50→0.56 and holds; `handoffFor(p)` (0 before p0.560, 1 by p0.585); canvas fades out at the handoff.

- [ ] **Step 1: Re-angle the pose-section camera keyframes**

In `js/home-journey.js`, the `frames` array currently holds the steep showcase camera from p0.50→1.00 (the four entries at p 0.50/0.66/0.80/1.00 are identical `px2.30,py3.78,pz8.00`). Replace those four entries so the camera eases from the steep angle at p0.50 to C-gentle by p0.56, then holds. Find:

```js
    { p: 0.50, px: 2.30, py: 3.78, pz: 8.00, tx: -0.66, ty: 0.12, tz: 2.16 }, // 4 settle so the 3D mat lands on
    { p: 0.66, px: 2.30, py: 3.78, pz: 8.00, tx: -0.66, ty: 0.12, tz: 2.16 }, //   the hero-mat PNG's rect (the
    { p: 0.80, px: 2.30, py: 3.78, pz: 8.00, tx: -0.66, ty: 0.12, tz: 2.16 }, //   3D mat is hidden past ~0.56,
    { p: 1.00, px: 2.30, py: 3.78, pz: 8.00, tx: -0.66, ty: 0.12, tz: 2.16 }, //   so these just hold it steady)
```
Replace with:
```js
    { p: 0.50, px: 2.30, py: 3.78, pz: 8.00, tx: -0.66, ty: 0.12, tz: 2.16 }, // morph begins — steep showcase angle
    { p: 0.56, px: 2.30, py: 2.15, pz: 9.20, tx: -0.66, ty: 0.12, tz: 2.16 }, // eased to C-gentle (figures' angle)
    { p: 0.66, px: 2.30, py: 2.15, pz: 9.20, tx: -0.66, ty: 0.12, tz: 2.16 }, // hold C-gentle for the pose flow
    { p: 0.80, px: 2.30, py: 2.15, pz: 9.20, tx: -0.66, ty: 0.12, tz: 2.16 },
    { p: 1.00, px: 2.30, py: 2.15, pz: 9.20, tx: -0.66, ty: 0.12, tz: 2.16 },
```

- [ ] **Step 2: Add `handoffFor(p)` next to `morphFor`**

After the `morphFor`/`bloomFor` definitions (the block around the comment "The mat is ONE mesh the whole way"), add:

```js
  /* hand-off: once the mat is watercolour AND eased to C-gentle, the mesh fades out and the
     on-mat figure illustrations take over (they were drawn from this exact mat, so it's invisible).
     canvas opacity = 1 - handoffFor(p): full through the morph, gone by p0.585 as figure-1 fades in. */
  function handoffFor(p) { let t = (p - 0.560) / 0.025; t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
```

- [ ] **Step 3: Fade the canvas at the handoff in `paint` and `_rig.at`**

In `paint(p)`, replace `canvas.style.opacity = '1';` with:
```js
    canvas.style.opacity = (1 - handoffFor(p)).toFixed(3);
```
In `_rig.at(p)`, replace its `canvas.style.opacity = '1';` line with the same:
```js
        canvas.style.opacity = (1 - handoffFor(p)).toFixed(3);
```

- [ ] **Step 4: Extend `morphtest.mjs` to assert the handoff + verify syntax**

Add two checks to `tools/morphtest.mjs` (after the existing `canvasOpaque@0.80` check, before the errors check). Replace the line:
```js
checks.push(['canvasOpaque@0.80', c.canvasOpacity === '1' || c.canvasOpacity === '']);
```
with:
```js
// canvas is opaque through the morph, faded out during the pose flow (handoff)
const mid = await probe(0.55); checks.push(['canvasOpaque@0.55', mid.canvasOpacity === '1' || mid.canvasOpacity === '']);
checks.push(['canvasFadedOut@0.80', parseFloat(c.canvasOpacity || '1') < 0.02]);
```
Run:
```bash
cd "/Users/at/Projects/site 2" && node --check js/home-journey.js && node tools/morphtest.mjs
```
Expected: `node --check` clean; morphtest all `✓` (morph 0→1 at the window, canvas opaque at 0.55, faded at 0.80, no console errors).

- [ ] **Step 5: Visual gate — the ease + handoff mechanics**

```bash
cd "/Users/at/Projects/site 2" && node tools/matshot.mjs
```
Read `tools/matshot/a-0.48-showcase.png` (steep photoreal), `b-0.52-handoff.png` (mid morph+ease), `c-0.56-walkin.png` (watercolour, now at the GENTLE angle). Confirm: the mat clearly **eases to the gentler angle** by ~0.56 and is fully watercolour. At `d-0.634-stand.png` the WebGL mat (mesh) is gone (canvas faded) — only the figure layer shows. (Figures are still the OLD mat-free ones here; that's expected — we replace them in Tasks 3–4. We're only verifying camera-ease + handoff-fade.)

- [ ] **Step 6: Commit**
```bash
git add js/home-journey.js tools/morphtest.mjs && git commit -m "feat(home): ease mat to C-gentle + hand off mesh to figures"
```

---

### Task 2: Restore the mat-detection `figbake` (registers each frame's mat to one rect)

**Files:**
- Modify: `tools/figbake.mjs` (replace the v3 mat-free extraction with the baseline mat-detection registration, kept pointed at `assets/figure` with `figure-N` naming)

**Interfaces:**
- Consumes: source frames in `tools/figsrc/*.{png,jpg,jpeg}` (Cristina ON a mat).
- Produces: `assets/figure/figure-N.png` — each frame translated+scaled so its mat lands on the canonical rect `TARGET = {cx:700, bottomY:1380, width:1120}` in a `1400×1500` transparent canvas. `figure-N.debug.png` overlays.

- [ ] **Step 1: Restore the baseline mat-detection version from git**

The branch-baseline `figbake.mjs` (commit `1496aa9`) is the mat-detection registration we want (it detects each frame's mat silhouette vs the cream background and aligns the mat's bottom-centre + width to a canonical rect). Restore it:
```bash
cd "/Users/at/Projects/site 2" && git show 1496aa9:tools/figbake.mjs > tools/figbake.mjs
```

- [ ] **Step 2: Point output at `assets/figure` with `figure-N` naming**

The baseline writes `tools/figbaked/<basename>.png`. Two edits so it writes `assets/figure/figure-N.png` (where N is the number in the source filename, e.g. `onmat-03` → `figure-3`):

Change `const OUT_DIR = 'tools/figbaked';` to:
```js
const OUT_DIR = 'assets/figure';
```
Find where the output basename is derived. The baseline computes `const name = path.basename(file).replace(/\.(png|jpe?g)$/i, '');` and writes `${name}.png`. Replace that `name` assignment with:
```js
  const name = 'figure-' + parseInt(path.basename(file).replace(/[^0-9]/g, ''), 10);
```
(so `onmat-03.png` → `figure-3.png`; the rest of the script's `${name}.png` / `${name}.debug.png` writes are unchanged.)

- [ ] **Step 3: Syntax check + dry-run on the existing lab test images**

Copy the two lab test images into `tools/figsrc` with the pose-numbered names so figbake can register them as a smoke test:
```bash
cd "/Users/at/Projects/site 2" && mkdir -p tools/figsrc && cp tools/lab/assets/test-stand-onmat.png tools/figsrc/onmat-03.png && cp tools/lab/assets/test-dog-onmat.png tools/figsrc/onmat-09.png
node --check tools/figbake.mjs && node tools/figbake.mjs tools/figsrc/onmat-03.png tools/figsrc/onmat-09.png
```
Expected: two `✓` lines reporting a detected mat (`conf`, `matW`, etc.), and `assets/figure/figure-3.png` + `figure-9.png` + `.debug.png` written. Open `assets/figure/figure-3.debug.png` — the green box should hug the detected mat and the yellow line mark its front edge.

- [ ] **Step 4: Commit**
```bash
git add tools/figbake.mjs && git commit -m "feat(figbake): restore mat-detection registration for consistent on-mat figures"
```

---

### Task 3: Generate the 15 on-mat perspective poses

**Files:**
- Create: `tools/figsrc/onmat-01..15.png` (13 generated now; `onmat-03` stand + `onmat-09` dog reused from Task 2 Step 3)
- Move: current mat-free figures → `tools/figsrc/onmat-backup-matfree/`

**Interfaces:**
- Produces: 15 source frames of Cristina drawn in the C-gentle perspective, on her matching mat, plain cream background.

> **Tooling dependency:** this task requires the **Higgsfield MCP** (`generate_image`, `job_status`) with model `nano_banana_pro`. It is connected in this session (the two lab test poses were generated with it). If executed where that MCP is absent, the task is blocked — supply the 15 `onmat-*.png` by hand or run it in this session.

- [ ] **Step 1: Back up the current mat-free figures AND move the old `free-*` sources out of `tools/figsrc`**

The old `free-01..15.png` sources currently live in `tools/figsrc/` and would be picked up by figbake (it globs the whole dir), colliding with the new `onmat-*` on the `figure-N` naming. Move them out, and back up the baked figures:
```bash
cd "/Users/at/Projects/site 2" && mkdir -p tools/figsrc/onmat-backup-matfree
cp assets/figure/figure-*.png tools/figsrc/onmat-backup-matfree/ 2>/dev/null
mv tools/figsrc/free-*.png tools/figsrc/onmat-backup-matfree/ 2>/dev/null
echo "figsrc top-level pngs remaining (should be ONLY onmat-03, onmat-09 from Task 2 so far):"; ls tools/figsrc/*.png 2>/dev/null | xargs -n1 basename
```

- [ ] **Step 2: Generate the 13 remaining poses (Higgsfield `nano_banana_pro`, aspect `3:2`)**

Use the global identity refs + the mat reference `afa6bd4c-3166-4369-ad8a-4ae1e97c1d0c` as the LAST media. Prompt = this PREFIX + the per-pose sentence:

PREFIX (verbatim — this is the validated wording):
> "Hand-painted watercolour-and-ink illustration of Cristina (keep her recognisable: warm light-tan skin, long dark brown hair in a loose braid over one shoulder, fitted terracotta-rust leggings, soft cream long-sleeve fitted top, barefoot). She is ON the dark charcoal yoga mat shown in the LAST reference image, and CRUCIALLY she is viewed from the SAME slightly-elevated angle as that mat — her whole body foreshortened to match that exact perspective, with a soft contact shadow where she meets the mat. Keep the mat's angle, size and position identical to the reference. Plain warm-cream background. Warm terracotta, charcoal and cream palette; soft watercolour shading, delicate ink lines, subtle paper grain. Pose: "

| File | pose sentence |
|---|---|
| onmat-01 | "walking onto the mat from the left, mid-stride, calm, arms relaxed, whole body in frame." |
| onmat-02 | "stepping forward onto the mat, weight shifting, arms relaxed, whole body in frame." |
| onmat-04 | "standing on the mat, both arms rising out to the sides to shoulder height, palms open, whole body in frame." |
| onmat-05 | "standing on the mat, both arms reaching straight up overhead, palms together, whole body in frame." |
| onmat-06 | "standing on the mat, hands together at heart centre in prayer, chest open, calm, whole body in frame." |
| onmat-07 | "a standing forward hinge at the hips on the mat, long flat back, hands reaching toward her shins, whole body in frame." |
| onmat-08 | "a deep standing forward fold on the mat, torso folded over her legs, hands toward her feet, whole body in frame." |
| onmat-10 | "a low lunge on the mat, one knee lowered, the other leg bent in front, both arms sweeping up overhead, whole body in frame." |
| onmat-11 | "kneeling and lowering gracefully toward a seated position on the mat, hands resting softly, whole body in frame." |
| onmat-12 | "seated cross-legged on the mat, upright and serene, hands resting on her knees, whole body in frame." |
| onmat-13 | "seated cross-legged on the mat with a gentle spinal twist, one hand resting behind her, looking softly over her shoulder, whole body in frame." |
| onmat-14 | "a seated forward fold on the mat, legs extended forward, torso reaching over her legs, hands toward her toes, whole body in frame." |
| onmat-15 | "seated cross-legged on the mat, hands together at heart centre in prayer, serene, whole body in frame." |

For each: `generate_image` (count 1) → poll `job_status({sync:true})` to `completed` → `curl` the `results.rawUrl` to `tools/figsrc/onmat-NN.png`. Resubmit once on failure/hang (>3 min). Soft identity phrasing only — never "exact person".

- [ ] **Step 3: Visual gate — perspective + identity**

Read several outputs (`onmat-01`, `onmat-07`, `onmat-12`, `onmat-14`). Each must show Cristina ON the mat, foreshortened to the gentle angle (grounded, not flat/floating), recognisable, mat angle/size matching the reference. Regenerate any that come out flat/frontal, off-mat, or off-identity.

- [ ] **Step 4: Commit**
```bash
cd "/Users/at/Projects/site 2" && git add tools/figsrc/onmat-*.png && git commit -m "assets: 15 on-mat perspective-matched Cristina poses"
```

---

### Task 4: Register all 15 into `assets/figure/`

**Files:**
- Output: `assets/figure/figure-1..15.png`

**Interfaces:**
- Consumes: `tools/figsrc/onmat-01..15.png` (Task 3) + the restored `figbake` (Task 2).

- [ ] **Step 1: Bake exactly the 15 `onmat-*` frames**

Pass the `onmat-*` sources explicitly so figbake processes ONLY them (never the backups or any stray file), and assert the input count first:
```bash
cd "/Users/at/Projects/site 2" && N=$(ls tools/figsrc/onmat-*.png | wc -l | tr -d ' '); echo "onmat inputs: $N"; [ "$N" = "15" ] || { echo "EXPECTED 15 — stop and fix"; exit 1; }
node tools/figbake.mjs tools/figsrc/onmat-*.png
```
Expected: input count `15`, then 15 `✓` lines (mat detected on each), `assets/figure/figure-1..15.png` + `.debug.png` written. Note any `⚠ LOW` confidence frames.

- [ ] **Step 2: Visual gate — mats land on ONE rect**

Read `assets/figure/figure-1.png`, `figure-3.png`, `figure-9.png`, `figure-12.png`. Across them the **mat must sit at the same on-screen position/size** (that's the registration working — and what kills doubling). Cristina sits on it. Open two `.debug.png` to confirm the detected-mat box is consistent. If a frame's mat is mis-detected (box wrong), inspect its source; regenerate that pose if its mat is cropped/odd. Low-confidence frames that still register correctly are fine.

- [ ] **Step 3: Commit**
```bash
cd "/Users/at/Projects/site 2" && git add assets/figure/figure-*.png && git commit -m "assets: register on-mat figures to one canonical rect"
```

---

### Task 5: Align the figures to the mesh handoff + full acceptance

**Files:**
- Modify: `js/home-journey.js:127` (`FIG_BOX`)

**Interfaces:**
- Consumes: registered figures (Task 4), eased camera + handoff (Task 1).
- Produces: `FIG_BOX` placing the figures' (registered) mat exactly over the live mesh mat at the handoff → seamless.

- [ ] **Step 1: Add a pixel-accurate mat-silhouette measurement, then measure the mesh mat**

`matRect()` (Box3 projection) does NOT measure the same thing figbake registers — figbake aligns the mat's **rendered silhouette** (full horizontal extent + frontmost row). Measure the mesh mat the SAME way so the two coincide. Add a rig method that reads the mat's silhouette from the canvas pixels (the renderer uses `preserveDrawingBuffer:true`, so the canvas is readable). Add it to the `_rig` object in `js/home-journey.js` (next to `matRect`):

```js
      /* pixel-accurate mat silhouette in CSS px (matches figbake's silhouette registration):
         cx = horizontal-extent centre, width = full extent, bottom = frontmost row */
      matSilhouette() {
        const cw = canvas.clientWidth, ch = canvas.clientHeight;
        const c2 = document.createElement('canvas'); c2.width = cw; c2.height = ch;
        const x2 = c2.getContext('2d'); x2.drawImage(canvas, 0, 0, cw, ch);
        const d = x2.getImageData(0, 0, cw, ch).data;
        let minX = cw, maxX = -1, minY = ch, maxY = -1;
        for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
          if (d[(y * cw + x) * 4 + 3] > 16) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
        }
        return { cx: (minX + maxX) / 2, width: maxX - minX, frontY: maxY, top: minY, left: minX, right: maxX };
      },
```
Measure the mesh mat at the handoff progress (mat fully watercolour + gentle, canvas still fully visible — use `p=0.555`, before `handoffFor` starts fading it):
```bash
cd "/Users/at/Projects/site 2" && node -e '
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto("http://localhost:8000/home.html", { waitUntil: "networkidle" });
  await p.waitForFunction(() => window.SAIA && window.SAIA._rig);
  const r = await p.evaluate(() => { window.SAIA._rig.at(0.555); return window.SAIA._rig.matSilhouette(); });
  console.log("mesh mat silhouette @0.555:", r, "(viewport 1440x900)");
  await b.close();
})();'
```
Record `cx`, `width`, `frontY` (px @ 1440×900).

- [ ] **Step 2: Compute `FIG_BOX` with the CORRECT baked-image geometry**

`FIG_BOX` (`js/home-journey.js`, the `FIG_BOX` const) sizes the **whole 1400×1500 figure image** via `width` + `height:auto`. But figbake puts the mat at only `width 1120` of the 1400 image (**80%**) with its front edge at `bottomY 1380` of 1500 (**120px** up from the image bottom). So the element must be bigger than the mat, and its bottom sits *below* the mat front edge:

Let `W = mat width px`, `Cx = mat extent-centre px`, `Fy = mat frontY px` (from Step 1). Then:
```
W_css_px   = W * (1400 / 1120)         // = W * 1.25   (element wider than the mat)
FIG_BOX.width  (vw) = W_css_px / 1440 * 100
FIG_BOX.left   (%)  = Cx / 1440 * 100                       // canvas centre ↔ mat extent-centre
FIG_BOX.bottom (vh) = (900 - Fy - (120/1400) * W_css_px) / 900 * 100   // element bottom is 120/1400·W_css below the mat front
```
The `(120/1400)*W_css_px` term is the displayed image-bottom-to-mat-front offset Codex flagged (`120/1500` of the displayed image height equals `120/1400·W_css`). Compute the three values and set:
```js
  const FIG_BOX = { left: '<computed>%', bottom: '<computed>vh', width: '<computed>vw' };
```

- [ ] **Step 3: Add a seam frame at the real handoff progress, then verify the seam**

The mesh→figure crossover is ~`p0.575–0.585` (at `p0.56` the mesh is still fully opaque and figure-1 is faint). Add a seam frame to `tools/matshot.mjs` — in its `ps` array, after the `['c-0.56-walkin', 0.56]` entry add:
```js
  ['c2-0.578-handoff', 0.578],
```
Then:
```bash
cd "/Users/at/Projects/site 2" && node --check js/home-journey.js && node tools/morphtest.mjs && node tools/matshot.mjs
```
Read `tools/matshot/c2-0.578-handoff.png` (mesh ~half-faded, figure-1 ~active): the mesh mat and figure-1's mat must **coincide** — no jump, no doubled edge, no size/position pop as one fades into the other. Tune `FIG_BOX` (Step 2) and re-run until the seam is invisible. (The Step 2 formula gets you close; the eye finalises.)

- [ ] **Step 4: Full acceptance gate (R1 + R2 + grounding)**

Read `tools/matshot/` frames `b-0.52` (morph+ease), `c2-0.578-handoff` (the seam), `d-0.634-stand`, `g-0.797-dog`, `h-0.824-lunge`, `i-0.878-seated`, `j-0.960`. Confirm:
- **R1:** mat transforms in place (photoreal→watercolour) and eases to gentle; no flat cross-fade of two different mats.
- **R2:** exactly ONE mat per frame; no second mat, no doubled edge; no shimmer between adjacent poses (registration holds).
- **Grounding:** Cristina sits ON the mat in correct perspective, contact believable, contained within the mat, no foot artifacts.
- `morphtest.mjs` exit 0; CONSOLE ERRORS none.

- [ ] **Step 5: Mobile static fallback check**
```bash
cd "/Users/at/Projects/site 2" && node -e '
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto("http://localhost:8000/home.html", { waitUntil: "networkidle" });
  await p.screenshot({ path: "tools/matshot/static-mobile.png" });
  await b.close();
})();'
```
Read it — the static poster must still render (mat + copy), no broken layout.

- [ ] **Step 6: Commit**
```bash
cd "/Users/at/Projects/site 2" && git add js/home-journey.js && git commit -m "feat(home): align on-mat figures to the mesh handoff; perspective-matched poses live"
```

---

## Self-review

**Spec coverage:**
- Camera ease steep→C-gentle (spec §3, §6) → Task 1. ✓
- Handoff mesh→figures, canvas fades (spec §3, §6) → Task 1 (`handoffFor`). ✓
- On-mat perspective figures from one shared reference (spec §3, §5) → Task 3 (mat ref `afa6bd4c`). ✓
- Mat-detection registration to one rect, not v3 extraction (spec §5) → Task 2 (restore from `1496aa9`). ✓
- Seamless handoff alignment (spec §6) → Task 5 (FIG_BOX vs `matRect`). ✓
- R1 in-place morph kept (spec §4) → Task 1 leaves `makeMatMaterial`/`morphFor` intact; only camera + canvas-opacity change. ✓
- R2 one mat, mesh hidden during poses (spec §4) → Task 1 handoff fade + Task 4 registration. ✓
- Backup current figures (spec §5) → Task 3 Step 1. ✓
- Unroll/mood/static-poster untouched (spec §9) → no task edits them; Task 5 Step 5 verifies static. ✓

**Placeholder scan:** the only intentional `<computed>` values are `FIG_BOX` in Task 5, which are derived from a measured rect in the same task (Steps 1–2) — not a placeholder, a measurement. No TBD/TODO.

**Type/name consistency:** `handoffFor`, `morphFor`, `FIG_BOX`, `TARGET = {cx,bottomY,width}`, `onmat-NN`→`figure-N` naming are used consistently across Tasks 1–5. Camera numbers (`2.30/2.15/9.20`, target `-0.66/0.12/2.16`) match the spec's Global Constraints and the uploaded reference.

**Risk note (carried from spec §7):** if adjacent poses shimmer at Task 5 Step 4 despite registration, the fallback is mat-free perspective figures over the live mesh — do not attempt silently; surface it for a decision.
