# Cristina Cel-Shaded Flow Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `index.html` pinned scroll-flow (`#flowCanvas`, ~303 frames) so the moving figure is the new **cel-shaded Cristina on the SAÏA mat**, replacing the current charcoal watercolour flow.

**Architecture:** Reuse the proven seam-free pipeline unchanged: 5 approved on-mat anchors → normalize to cream keyframes → 4 chained Kling 3.0 i2v clips (one per pose transition, seams land on the frozen holds) → `assemble.mjs` concatenates + cross-fades → `cutout.mjs` removes the cream paper to transparent WebP → wire the emitted anchor indices into `home-journey.js` + `index.html`. No JS architecture change — the live journey already draws baked-mat frames to `#flowCanvas`.

**Tech Stack:** Higgsfield MCP (Kling 3.0 video, media upload), ffmpeg, Node 20 + Playwright (`cutout.mjs`), Python 3 + PIL (anchor normalize), vanilla JS front end.

## Global Constraints

- **Source anchors (approved, final):** `tools/figsrc/avatar-anchors/with-mat/{stand,reach,dog,lunge,seated}.png` (1264×848, cel-shaded, dusty-rose cami + greige leggings, top-bun + front braid, gentle natural smile, on the dark charcoal SAÏA mat, cream bg).
- **Keyframe canvas:** 1104×756, background cream `#ece8dc` (matches the proven recipe; `flowdiff.mjs` assumes this 1104:756 ratio).
- **One model for every clip:** Kling 3.0 `mode:"pro"`, `sound:"off"`, duration 5 (mixing models ghosts the shared anchors — see memory `cristina-figure-pipeline`).
- **Chaining rule:** clip *k*'s `start_image` = clip *k-1*'s actual extracted last frame; `end_image` = the next clean KEY anchor. Endpoints re-anchor so identity can't drift.
- **`cutout.mjs` GOTCHA:** it `rm`s OUTD first → SRC must ≠ OUTD, or the source jpgs are wiped. Run it in the background (>2 min for 303 frames @ 1544px).
- **Higgsfield element IDs (already created):** character `cristina-avatar` = `2decf708-46f4-468b-aea1-5792017e8227`; prop `saia-mat` = `6a9b86a7-f2f9-4713-ab89-a68fdfcf3095`.
- **Verification gate:** `flowdiff.mjs` must report **0 outliers** at COUNT=303 before wiring.
- **Don't touch live frames until verified:** back up `assets/flow-frames/` first; keep the charcoal flow recoverable.
- **Cache-bust:** after editing `js/home-journey.js`, force the browser to reload it (see Task 9).
- **Est. cost:** ~4 Kling pro clips × ~8.75 credits ≈ 35 credits + retries; balance ~120.

---

### Task 1: Back up the live flow + normalize the 5 anchors to cream keyframes

**Files:**
- Read: `tools/figsrc/avatar-anchors/with-mat/{stand,reach,dog,lunge,seated}.png`
- Create: `tools/seam/anchors-cel/KEY-{stand,reach,dog,lunge,seated}.png`
- Create (backup): `tools/seam/flow-frames-backup-charcoal/` (copy of current `assets/flow-frames/`)
- Create (script): `tools/seam/normalize-cel.py`

**Interfaces:**
- Produces: 5 keyframes named `KEY-<pose>.png`, each 1104×756, cream `#ece8dc` background, figure+mat scaled to fit with margin. These are the i2v endpoints consumed by Tasks 2–5.

- [ ] **Step 1: Back up the current live flow (recoverable charcoal version)**

```bash
cd "/Users/at/Projects/site 2"
cp -r assets/flow-frames tools/seam/flow-frames-backup-charcoal
ls tools/seam/flow-frames-backup-charcoal | wc -l   # expect 303
```

- [ ] **Step 2: Write the normalize script**

```python
# tools/seam/normalize-cel.py — scale each anchor to fit a 1104x756 cream canvas, centred.
from PIL import Image
import os
SRC = "tools/figsrc/avatar-anchors/with-mat"
OUT = "tools/seam/anchors-cel"
W, H = 1104, 756
CREAM = (236, 232, 220)  # #ece8dc
os.makedirs(OUT, exist_ok=True)
for pose in ["stand", "reach", "dog", "lunge", "seated"]:
    im = Image.open(os.path.join(SRC, f"{pose}.png")).convert("RGB")
    fit = im.copy()
    fit.thumbnail((W, H), Image.LANCZOS)
    canvas = Image.new("RGB", (W, H), CREAM)
    canvas.paste(fit, ((W - fit.width) // 2, (H - fit.height) // 2))
    canvas.save(os.path.join(OUT, f"KEY-{pose}.png"))
    print(f"KEY-{pose}.png  {im.size} -> {canvas.size}")
```

- [ ] **Step 3: Run it**

Run: `python3 tools/seam/normalize-cel.py`
Expected: 5 lines printed, each ending `-> (1104, 756)`.

- [ ] **Step 4: Visual alignment gate (critical)**

Build a quick overlay contact sheet and eyeball that the **mat sits in a consistent place** and the figure is fully in-frame with margin across all 5 (so the i2v motion and the mat don't jump between holds):

```python
# inline check — append to a scratch file or run via python3 -c equivalent
from PIL import Image
ims = [Image.open(f"tools/seam/anchors-cel/KEY-{p}.png") for p in ["stand","reach","dog","lunge","seated"]]
sheet = Image.new("RGB", (1104, 756*5), (236,232,220))
for i,im in enumerate(ims): sheet.paste(im, (0, 756*i))
sheet.save("tools/seam/anchors-cel/_stack.png")
```

Open `tools/seam/anchors-cel/_stack.png`. **Gate:** mat roughly centred-bottom in every frame, no figure clipped at edges. If a pose's mat/figure is badly off, re-normalize that one (adjust paste offset) before continuing — misalignment here causes pops later.

- [ ] **Step 5: Commit**

```bash
git add tools/seam/normalize-cel.py tools/seam/anchors-cel/
git commit -m "build(flow): normalize cel-shaded Cristina anchors to cream keyframes"
```

---

### Task 2: Generate clip 1 — stand → reach (Kling 3.0 pro)

**Files:**
- Read: `tools/seam/anchors-cel/KEY-stand.png`, `tools/seam/anchors-cel/KEY-reach.png`
- Create: `tools/seam/clips/clip1.mp4`
- Create: `tools/seam/anchors-cel/_last-clip1.png` (extracted last frame, for chaining)

**Interfaces:**
- Consumes: `KEY-stand.png`, `KEY-reach.png` (Task 1).
- Produces: `tools/seam/clips/clip1.mp4`; `_last-clip1.png` (the reach hold as Kling rendered it) consumed by Task 3.

- [ ] **Step 1: Upload both keyframes to Higgsfield**

For each of `KEY-stand.png` and `KEY-reach.png`: call `media_upload` (filename, content_type `image/png`) → `curl -X PUT --data-binary @<file> '<upload_url>'` (expect `HTTP 200`) → `media_confirm` (type `image`). Record the two `media_id`s.

- [ ] **Step 2: Generate the clip**

Call Higgsfield `generate_video`:
- `model`: `kling3_0`
- `mode`: `pro`
- `sound`: `off`
- `duration`: 5
- `start_image`: KEY-stand media_id
- `end_image`: KEY-reach media_id
- prompt: `"A calm cel-shaded illustrated woman flows smoothly from standing in namaste to reaching both arms overhead in an upward salute, on a dark charcoal SAIA yoga mat, steady locked camera, flat cream background, gentle continuous motion."`
- If a preset prompt is offered, decline it via `declined_preset_id`.

Poll `job_status` (sync) until `completed`.

- [ ] **Step 3: Download the clip**

```bash
cd "/Users/at/Projects/site 2" && mkdir -p tools/seam/clips
curl -sS -o tools/seam/clips/clip1.mp4 "<rawUrl from job_status>" -w "HTTP %{http_code}\n"
```
Expected: `HTTP 200`.

- [ ] **Step 4: Motion + identity gate (visual)**

```bash
ffmpeg -y -loglevel error -i tools/seam/clips/clip1.mp4 -vf "fps=4,scale=276:189,tile=5x2" tools/seam/clips/_clip1_strip.png
```
Open `tools/seam/clips/_clip1_strip.png`. **Gate:** smooth stand→reach, her face/outfit/bun+braid stable, the mat does not warp or pop, no scale jump. If it pops, regenerate (Kling occasionally drops a job — just resubmit).

- [ ] **Step 5: Extract the actual last frame (for chaining)**

```bash
ffmpeg -y -loglevel error -sseof -0.1 -i tools/seam/clips/clip1.mp4 -update 1 -q:v 2 tools/seam/anchors-cel/_last-clip1.png
```

- [ ] **Step 6: Commit**

```bash
git add tools/seam/clips/clip1.mp4 tools/seam/anchors-cel/_last-clip1.png
git commit -m "build(flow): clip1 stand->reach (kling3.0 pro, cel)"
```

---

### Task 3: Generate clip 2 — reach → dog (chained)

**Files:**
- Read: `tools/seam/anchors-cel/_last-clip1.png`, `tools/seam/anchors-cel/KEY-dog.png`
- Create: `tools/seam/clips/clip2.mp4`, `tools/seam/anchors-cel/_last-clip2.png`

**Interfaces:**
- Consumes: `_last-clip1.png` (Task 2, = clip start), `KEY-dog.png` (Task 1, = clip end).
- Produces: `clip2.mp4`, `_last-clip2.png` (dog hold) consumed by Task 4.

- [ ] **Step 1: Upload the two keyframes**

Upload `_last-clip1.png` and `KEY-dog.png` (same upload→PUT→confirm flow as Task 2 Step 1). Record media_ids.

- [ ] **Step 2: Generate**

`generate_video`, model `kling3_0`, mode `pro`, sound `off`, duration 5, `start_image`=_last-clip1 id, `end_image`=KEY-dog id, prompt: `"A calm cel-shaded illustrated woman flows smoothly from arms reaching overhead down into a forward fold and into downward-facing dog (inverted V, head hanging straight down) on a dark charcoal SAIA yoga mat, steady locked camera, flat cream background, gentle continuous motion."` Poll to `completed`.

- [ ] **Step 3: Download**

```bash
curl -sS -o tools/seam/clips/clip2.mp4 "<rawUrl>" -w "HTTP %{http_code}\n"
```

- [ ] **Step 4: Motion gate**

```bash
ffmpeg -y -loglevel error -i tools/seam/clips/clip2.mp4 -vf "fps=4,scale=276:189,tile=5x2" tools/seam/clips/_clip2_strip.png
```
Open `_clip2_strip.png`. **Gate:** smooth descent, no figure SCALE pop on the low descent (the historic failure mode), mat stable. Regenerate if it pops.

- [ ] **Step 5: Extract last frame**

```bash
ffmpeg -y -loglevel error -sseof -0.1 -i tools/seam/clips/clip2.mp4 -update 1 -q:v 2 tools/seam/anchors-cel/_last-clip2.png
```

- [ ] **Step 6: Commit**

```bash
git add tools/seam/clips/clip2.mp4 tools/seam/anchors-cel/_last-clip2.png
git commit -m "build(flow): clip2 reach->dog (chained, cel)"
```

---

### Task 4: Generate clip 3 — dog → lunge (chained)

**Files:**
- Read: `tools/seam/anchors-cel/_last-clip2.png`, `tools/seam/anchors-cel/KEY-lunge.png`
- Create: `tools/seam/clips/clip3.mp4`, `tools/seam/anchors-cel/_last-clip3.png`

**Interfaces:**
- Consumes: `_last-clip2.png` (Task 3), `KEY-lunge.png` (Task 1).
- Produces: `clip3.mp4`, `_last-clip3.png` (lunge hold) consumed by Task 5.

- [ ] **Step 1: Upload** `_last-clip2.png` and `KEY-lunge.png` (upload→PUT→confirm). Record media_ids.

- [ ] **Step 2: Generate** `generate_video`, `kling3_0`, `pro`, sound `off`, duration 5, start=_last-clip2, end=KEY-lunge, prompt: `"A calm cel-shaded illustrated woman transitions smoothly from downward dog into a crescent low lunge with both arms reaching straight up overhead, on a dark charcoal SAIA yoga mat, steady locked camera, flat cream background, gentle continuous motion."` Poll to `completed`.

- [ ] **Step 3: Download**

```bash
curl -sS -o tools/seam/clips/clip3.mp4 "<rawUrl>" -w "HTTP %{http_code}\n"
```

- [ ] **Step 4: Motion gate**

```bash
ffmpeg -y -loglevel error -i tools/seam/clips/clip3.mp4 -vf "fps=4,scale=276:189,tile=5x2" tools/seam/clips/_clip3_strip.png
```
Open `_clip3_strip.png`. **Gate:** smooth dog→lunge, arms end raised overhead, mat stable, no pop. Regenerate if needed.

- [ ] **Step 5: Extract last frame**

```bash
ffmpeg -y -loglevel error -sseof -0.1 -i tools/seam/clips/clip3.mp4 -update 1 -q:v 2 tools/seam/anchors-cel/_last-clip3.png
```

- [ ] **Step 6: Commit**

```bash
git add tools/seam/clips/clip3.mp4 tools/seam/anchors-cel/_last-clip3.png
git commit -m "build(flow): clip3 dog->lunge (chained, cel)"
```

---

### Task 5: Generate clip 4 — lunge → seated (chained)

**Files:**
- Read: `tools/seam/anchors-cel/_last-clip3.png`, `tools/seam/anchors-cel/KEY-seated.png`
- Create: `tools/seam/clips/clip4.mp4`

**Interfaces:**
- Consumes: `_last-clip3.png` (Task 4), `KEY-seated.png` (Task 1).
- Produces: `clip4.mp4` (final clip) consumed by Task 6.

- [ ] **Step 1: Upload** `_last-clip3.png` and `KEY-seated.png`. Record media_ids.

- [ ] **Step 2: Generate** `generate_video`, `kling3_0`, `pro`, sound `off`, duration 5, start=_last-clip3, end=KEY-seated, prompt: `"A calm cel-shaded illustrated woman lowers smoothly from a low lunge down to sitting cross-legged with hands resting on her knees, on a dark charcoal SAIA yoga mat, steady locked camera, flat cream background, gentle continuous motion."` Poll to `completed`.

- [ ] **Step 3: Download**

```bash
curl -sS -o tools/seam/clips/clip4.mp4 "<rawUrl>" -w "HTTP %{http_code}\n"
```

- [ ] **Step 4: Motion gate**

```bash
ffmpeg -y -loglevel error -i tools/seam/clips/clip4.mp4 -vf "fps=4,scale=276:189,tile=5x2" tools/seam/clips/_clip4_strip.png
```
Open `_clip4_strip.png`. **Gate:** smooth lower-to-seat, ends seated cross-legged, mat stable. Regenerate if needed.

- [ ] **Step 5: Commit**

```bash
git add tools/seam/clips/clip4.mp4
git commit -m "build(flow): clip4 lunge->seated (chained, cel)"
```

---

### Task 6: Assemble the frame sequence

**Files:**
- Modify (if labels desired only): `tools/seam/assemble.mjs:13-18` (clip labels; params already correct)
- Read: `tools/seam/clips/clip{1,2,3,4}.mp4`
- Create: `assets/flow-frames/f001.jpg … fNNN.jpg` (assemble output, jpg)

**Interfaces:**
- Consumes: the 4 clips (Tasks 2–5).
- Produces: `assets/flow-frames/*.jpg` + printed anchor indices `A_STAND/A_REACH/A_DOG/A_LUNGE/A_SEATED` and `FLOW_COUNT` (consumed by Task 9). Sample counts (70/80/72/60) and W/H (1544×1058) are already set in `assemble.mjs`.

- [ ] **Step 1: Remove the stale auto-backup guard so assemble can run cleanly**

`assemble.mjs` only auto-backs-up to `tools/seam/flow-frames-backup` if that dir is absent. The live charcoal frames are already backed up in Task 1, so leave the stale dir alone; assemble will skip its own backup. No edit needed unless updating clip `label:` strings for clarity.

- [ ] **Step 2: Run assemble**

Run: `node tools/seam/assemble.mjs`
Expected: it extracts each clip, normalises bg to cream, subsamples, concatenates with 8-frame cross-fades, writes `assets/flow-frames/fNNN.jpg`, and prints a block like:
```
A_STAND=0 A_REACH=69 A_DOG=156 A_LUNGE=235 A_SEATED=302
FLOW_COUNT=303
```
**Record these printed numbers** — Task 9 needs them.

- [ ] **Step 3: Sanity-check the count**

```bash
ls assets/flow-frames/*.jpg | wc -l   # should equal the printed FLOW_COUNT (~303)
```

- [ ] **Step 4: Spot-check a few frames**

Open `assets/flow-frames/f001.jpg`, the printed A_DOG frame, and the last frame. **Gate:** cel-shaded Cristina on the mat, cream bg, no garbage frames at boundaries.

- [ ] **Step 5: Commit**

```bash
git add tools/seam/assemble.mjs assets/flow-frames
git commit -m "build(flow): assemble cel flow frames (jpg masters)"
```

---

### Task 7: Cut out the cream paper → transparent WebP

**Files:**
- Read: `assets/flow-frames/*.jpg`
- Create: `assets/flow-frames/*.webp` (transparent cutouts, overwrites the dir)

**Interfaces:**
- Consumes: the jpg masters (Task 6) — but moved to a temp SRC dir first (cutout rm's OUTD).
- Produces: `assets/flow-frames/fNNN.webp` (alpha cutouts) consumed by Task 8 + the live page.

- [ ] **Step 1: Start the static server (cutout loads the page for Canvas)**

```bash
cd "/Users/at/Projects/site 2" && python3 -m http.server 8000
```
Run this in the background; `cutout.mjs` navigates to `http://localhost:8000/`.

- [ ] **Step 2: Move jpgs to a temp SRC (avoid the SRC==OUTD wipe gotcha)**

```bash
cd "/Users/at/Projects/site 2"
rm -rf tools/seam/_celsrc && mkdir -p tools/seam/_celsrc
mv assets/flow-frames/*.jpg tools/seam/_celsrc/
```

- [ ] **Step 3: Run cutout in the background (>2 min at 1544px)**

```bash
node tools/seam/cutout.mjs tools/seam/_celsrc assets/flow-frames 303
```
Run in background. Expected: writes `assets/flow-frames/fNNN.webp` with alpha; logs any frame whose border still had alpha (a pose painting to the edge — fine if only the lunge/seated reach frames).

- [ ] **Step 4: Verify the cutout dir**

```bash
ls assets/flow-frames/*.webp | wc -l   # expect 303
```

- [ ] **Step 5: Composite-over-contrast gate (cream-on-cream hides defects)**

```bash
# composite frame 1, A_DOG, and last over terracotta to check the matte edge
python3 - <<'PY'
from PIL import Image
for n in ["001","156","303"]:
    fg = Image.open(f"assets/flow-frames/f{n}.webp").convert("RGBA")
    bg = Image.new("RGBA", fg.size, (184,98,74,255))
    bg.alpha_composite(fg); bg.convert("RGB").save(f"tools/seam/_matte_{n}.png")
print("ok")
PY
```
Open the three `tools/seam/_matte_*.png`. **Gate:** clean silhouette, no cream halo / panel rectangle / comb fringe. If a panel rectangle appears, check `bgLike` threshold (memory note: darker border paper needs `mn>188`).

- [ ] **Step 6: Commit**

```bash
git add assets/flow-frames
git commit -m "build(flow): cutout cel flow frames to transparent webp"
```

---

### Task 8: Verify the sequence (flowdiff gate)

**Files:**
- Read: `assets/flow-frames/*.webp`
- Uses: `tools/seam/flowdiff.mjs`, `tools/seam/faces.mjs`

**Interfaces:**
- Consumes: the cutout webp frames (Task 7).
- Produces: a pass/fail signal. **Gate to proceed to wiring: 0 outliers.**

- [ ] **Step 1: Run flowdiff at the full count**

Run: `node tools/seam/flowdiff.mjs assets/flow-frames/ 303`
Expected: prints median / p90 and an outlier count. **Gate: 0 outliers.** (Pass COUNT=303 explicitly — the default 150 silently skips the back half.)

- [ ] **Step 2: If outliers exist, locate + fix the seam**

The report names the offending frame indices. An outlier at a clip boundary = a bad hold match → regenerate that clip (Task 2–5) and re-run Tasks 6–8. An outlier mid-clip = a Kling pop → regenerate that clip. Do not proceed until 0.

- [ ] **Step 3: Identity check across the flow**

Run: `node tools/seam/faces.mjs` (emits a face strip across the sequence)
Expected: same face/bun+braid throughout; **Gate:** no identity drift between clips.

- [ ] **Step 4: Commit any regenerated artifacts** (only if clips changed)

```bash
git add tools/seam/clips assets/flow-frames
git commit -m "build(flow): fix seam outliers, flowdiff clean"
```

---

### Task 9: Wire the indices + flowFrameCount and verify on the real page

**Files:**
- Modify: `js/home-journey.js:132` (anchor indices), `:148` (FLOW_COUNT default)
- Modify: `index.html:540` (`flowFrameCount`)
- Modify: `index.html:1301` (cache-bust the script tag)

**Interfaces:**
- Consumes: the anchor indices + FLOW_COUNT printed by Task 6 Step 2.
- Produces: the live `index.html` journey driving the cel-shaded flow.

- [ ] **Step 1: Update the anchor indices in `home-journey.js`**

Replace line 132 with the exact values assemble printed (example shown; use the real numbers):
```js
  const A_STAND = 0, A_REACH = 69, A_DOG = 156, A_LUNGE = 235, A_SEATED = 302;
```
And line 148 if FLOW_COUNT changed:
```js
  const FLOW_COUNT = ASSETS.flowFrameCount || 303;
```

- [ ] **Step 2: Update `flowFrameCount` in `index.html` (it OVERRIDES the JS default)**

Line 540:
```js
    flowFrameCount: 303
```
Set to the real FLOW_COUNT. (Memory gotcha: a stale low value silently stops loading the back half of the sequence.)

- [ ] **Step 3: Cache-bust the script so the browser reloads it**

Change `index.html:1301` from `<script src="js/home-journey.js"></script>` to a bumped query, e.g.:
```html
<script src="js/home-journey.js?v=cel1"></script>
```

- [ ] **Step 4: Real-page verification (server already running from Task 7)**

Open `http://localhost:8000/` and scroll the pinned journey start→end. **Gate:**
- stand → reach → dog → lunge → seated plays smoothly while scrubbing,
- the figure is the cel-shaded Cristina on the SAÏA mat throughout,
- holds land cleanly (no jump-cut at the 5 anchors),
- nothing clipped; frames composite seamlessly onto the cream page (no panel/border).

If frames look blank in a scripted/headless shot, that's the known canvas-rAF screenshot lag — verify by manual scroll in a real browser (`window.SAIA._rig.at(p)` + canvas `getImageData` proves content is drawn).

- [ ] **Step 5: Commit**

```bash
git add js/home-journey.js index.html
git commit -m "feat(flow): wire cel-shaded Cristina flow into index.html"
```

---

## Out of scope

- No changes to the concierge, nav, events, or estimator.
- No retraining of the Higgsfield Soul (the cel look comes from the `cristina-avatar` Element, not a Soul).
- The retired `#figureLayer` FIG system stays retired.
- Dial-back levers if 303 webp is too heavy (~20MB): WebP 0.90→0.86, assemble W/H 1.4×→1.3×, fewer samples — all re-cutout/re-assemble only, no re-render.

## Verify (end-to-end)

1. `node tools/seam/flowdiff.mjs assets/flow-frames/ 303` → **0 outliers**.
2. `ls assets/flow-frames/*.webp | wc -l` → matches FLOW_COUNT.
3. Manual scroll of `http://localhost:8000/` → smooth cel-shaded flow on the SAÏA mat, clean holds.
4. Rollback if needed: `rm -rf assets/flow-frames && cp -r tools/seam/flow-frames-backup-charcoal assets/flow-frames`.
