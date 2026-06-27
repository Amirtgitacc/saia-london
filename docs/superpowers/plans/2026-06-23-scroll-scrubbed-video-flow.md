# Scroll-Scrubbed Video Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the cross-dissolved pose stills with ONE continuous watercolour video of Cristina flowing through all 15 poses, scrubbed by scroll — one stable mat, true motion.

**Architecture:** The 3D mesh morphs photoreal→watercolour and eases to the gentle angle (already shipped), then hands off to a stitched video (14 Seedance pose→pose clips). Scroll drives `video.currentTime`. The mesh canvas fades out as the video fades in; the old `#figureLayer` PNG crossfade is removed.

**Tech Stack:** Vanilla JS + Three.js (runtime), HTML5 `<video>` scrubbing, ffmpeg (stitch/re-encode, tooling), Higgsfield Seedance 2.0 (clip gen). No new runtime deps.

**Spec:** `docs/superpowers/specs/2026-06-23-scroll-scrubbed-video-flow-design.md`

## Global Constraints
- Already shipped & unchanged: the camera ease to C-gentle + `handoffFor` canvas fade (Task 1 of the prior plan, commit `69986f5`). Do NOT touch the unroll (`deformFor`) or `makeMatMaterial` morph.
- The 15 pose stills `tools/figsrc/onmat-01..15.png` are the video KEYFRAMES (already approved). 14 clips: `clip-NN` = pose NN→NN+1.
- Video: 720p, silent, scrub-friendly (dense keyframes), `muted playsinline preload="auto"`.
- Mobile / `prefers-reduced-motion`: `goStatic()` static poster stays — no video.
- Mat palette muted charcoal/taupe, never orange. Cream `#F5F1E8`, ink `#2B2620`, terracotta `#B8624A`.
- No unit tests: verify with `tools/matshot.mjs` screenshots + reading frames + the lab.

**Env:** static server on `http://localhost:8000`. ffmpeg is installed (`which ffmpeg` → yes).

---

### Task V1: Review the 14 clips; regenerate any broken transition

**Files:** `tools/lab/assets/clips/clip-01..14.mp4` (produced by the clip-gen subagent)

- [ ] **Step 1: Extract a mid frame from each clip and review**
```bash
cd "/Users/at/Projects/site 2" && mkdir -p tools/lab/assets/clipmid
for i in $(seq -w 1 14); do ffmpeg -nostdin -loglevel error -i tools/lab/assets/clips/clip-$i.mp4 -vf "select='eq(n\,40)'" -vframes 1 tools/lab/assets/clipmid/mid-$i.png 2>/dev/null; done
ls tools/lab/assets/clipmid/
```
Read each `mid-NN.png`. A clip is BAD if mid-motion: the art style breaks (turns photo/3D), her identity warps badly, the mat moves/morphs, or a limb does something anatomically broken. Note bad clip numbers. (Hard transitions to scrutinize: clip-08 fold→dog, clip-09 dog→lunge, clip-10 lunge→seat.)

- [ ] **Step 2: Regenerate bad clips (if any)**

For each bad `clip-NN` (pose NN→NN+1): re-run Seedance `generate_video` (model `seedance_2_0`, `resolution:"720p"`, `duration:5`, `generate_audio:false`, start_image = onmat-NN media, end_image = onmat-(NN+1) media) — the keyframe media_ids are in `.superpowers/sdd/clipgen-report.md`. If a transition is too large for one clip, insert an intermediate pose still (generate a mid-pose with the on-mat recipe + mat ref `afa6bd4c`) and split into two clips. Download to `tools/lab/assets/clips/clip-NN.mp4` (re-stitch will renumber if split — keep clip order = motion order). Re-review.

- [ ] **Step 3: Commit the clips**
```bash
cd "/Users/at/Projects/site 2" && git add tools/lab/assets/clips/*.mp4 && git commit -m "assets: 14 watercolour pose-transition clips (Seedance keyframe interp)"
```

---

### Task V2: Stitch + re-encode into one scrub-friendly flow video

**Files:** Create `assets/flow.mp4`

**Interfaces:** Produces `assets/flow.mp4` — one continuous 720p silent mp4, dense keyframes (fast `currentTime` seeks).

- [ ] **Step 1: Concatenate all 14 clips and re-encode for scrubbing**

Normalize + concat + dense-keyframe encode in one pass (handles any per-clip dim/fps differences):
```bash
cd "/Users/at/Projects/site 2"
IN=$(for i in $(seq -w 1 14); do printf -- "-i tools/lab/assets/clips/clip-%s.mp4 " "$i"; done)
FC=$(for i in $(seq 0 13); do printf "[%d:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v%d];" "$i" "$i"; done)
MAPS=$(for i in $(seq 0 13); do printf "[v%d]" "$i"; done)
ffmpeg -nostdin -loglevel error $IN -filter_complex "${FC}${MAPS}concat=n=14:v=1:a=0[out]" -map "[out]" \
  -an -c:v libx264 -preset slow -crf 22 -g 6 -keyint_min 6 -sc_threshold 0 -pix_fmt yuv420p -movflags +faststart assets/flow.mp4
echo "built assets/flow.mp4:"; ls -la assets/flow.mp4
ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 assets/flow.mp4
```
Expected: `assets/flow.mp4` written; duration ≈ 14 × clip length (~70s at 5s clips).

- [ ] **Step 2: Sanity-check the stitched video**
```bash
cd "/Users/at/Projects/site 2" && mkdir -p tools/lab/assets/flowcheck
ffmpeg -nostdin -loglevel error -i assets/flow.mp4 -vf "fps=1/5" tools/lab/assets/flowcheck/s%02d.png && ls tools/lab/assets/flowcheck/
```
Read a few `sNN.png` — the flow should progress pose→pose with the mat stable and style consistent across the whole timeline. Note the video's background cream colour from any frame (sample a corner pixel) — needed in V3 (`#flowcream`).

- [ ] **Step 3: Sample the exact cream + commit**
```bash
cd "/Users/at/Projects/site 2" && node -e '
const { chromium } = require("playwright");
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.goto("data:text/html,<img id=i src=http://localhost:8000/tools/lab/assets/flowcheck/s02.png>");
  await p.waitForSelector("#i");
  const c = await p.evaluate(() => { const img=document.getElementById("i"); const cv=document.createElement("canvas"); cv.width=img.naturalWidth; cv.height=img.naturalHeight; const x=cv.getContext("2d"); x.drawImage(img,0,0); const d=x.getImageData(6,6,1,1).data; return "#"+[d[0],d[1],d[2]].map(n=>n.toString(16).padStart(2,"0")).join(""); });
  console.log("flow cream =", c); await b.close(); })();'
git add assets/flow.mp4 && git commit -m "assets: stitched scroll-scrubbable flow video (720p, dense keyframes)"
```
Record the printed `flow cream` hex for V3.

---

### Task V3: Wire the scroll-scrubbed video into the page

**Files:** Modify `home.html` (add `#flowVideo`, retire `#figureLayer`), `js/home-journey.js` (scrub + handoff fade-in; remove the PNG crossfade)

**Interfaces:** Consumes `assets/flow.mp4` (V2), the shipped `handoffFor(p)` (Task 1).

- [ ] **Step 1: Add the video element to `home.html`**

In the sticky stage, alongside `#figureLayer`, add (and you will retire `#figureLayer` in Step 4):
```html
      <video id="flowVideo" aria-hidden="true" muted playsinline preload="auto"
        src="assets/flow.mp4"
        style="position:absolute; inset:0; width:100%; height:100%; object-fit:contain;
               object-position:72% 60%; z-index:2; opacity:0; pointer-events:none;"></video>
```
(`object-position` roughly places the mat/figure on the right; tuned visually in V4.)

- [ ] **Step 2: Grab the element + drive the scrub in `home-journey.js`**

Near the other element lookups (top of the IIFE), add:
```js
  const flowVideo = document.getElementById('flowVideo');
```
Add a flow constant + scrub function near `handoffFor`:
```js
  const FLOW_FROM = 0.560, FLOW_TO = 1.0;   // scrub window (starts as the mesh hands off)
  function flowFor(p) { let t = (p - FLOW_FROM) / (FLOW_TO - FLOW_FROM); return Math.max(0, Math.min(1, t)); }
  let _flowDur = 0;
  function scrubFlow(p) {
    if (!flowVideo) return;
    flowVideo.style.opacity = handoffFor(p).toFixed(3);   // fades in as the mesh canvas fades out
    if (_flowDur && flowVideo.readyState >= 1) flowVideo.currentTime = flowFor(p) * _flowDur;
  }
```
When the video metadata loads, cache its duration — after the `flowVideo` lookup:
```js
  if (flowVideo) flowVideo.addEventListener('loadedmetadata', () => { _flowDur = flowVideo.duration || 0; });
```

- [ ] **Step 3: Call `scrubFlow` in `paint` and `_rig.at`; pause the mood bg during the flow**

In `paint(p)` and `_rig.at(p)`, AFTER the existing `figures(p)` call (which you remove in Step 4), call `scrubFlow(p)`. Also, so the page cream matches the video during the flow, in `applyMood(p)` override the background once the flow is active — at the end of `applyMood`, before it returns, add:
```js
    if (p >= 0.585 && sticky) { sticky.style.backgroundColor = '<FLOWCREAM>'; if (root) root.style.setProperty('--scrim', '<FLOWCREAM_RGB>'); }
```
Replace `<FLOWCREAM>` with the hex from V2 Step 3, and `<FLOWCREAM_RGB>` with its `r,g,b` (lifted ~0.62 toward white, as the existing scrim does). This holds a constant cream behind the flow so the video's cream edges blend in.

- [ ] **Step 4: Retire the `#figureLayer` PNG crossfade**

The 15-PNG crossfade is replaced by the video. In `home-journey.js`: in `initFigures()` hide the layer (`const fl = document.getElementById('figureLayer'); if (fl) fl.style.display = 'none';`) and make `figures(p)` a no-op (or remove its call from `paint`/`_rig.at`, replacing with `scrubFlow(p)`). Keep `FIG`/`FIG_LABELS` only if still referenced elsewhere; otherwise leave them unused (harmless). Do NOT delete `#figureLayer` from `home.html` (the `.is-static` poster may use the first frame) — just `display:none` on the WebGL path.

- [ ] **Step 5: Verify it scrubs + handoff works**
```bash
cd "/Users/at/Projects/site 2" && node --check js/home-journey.js && node tools/morphtest.mjs && node tools/matshot.mjs
```
`morphtest` must still pass (the canvas still fades at handoff). Read `tools/matshot/` frames `c2-0.578-handoff.png` (add it if missing per the prior plan), `d-0.634`, `g-0.797`, `i-0.878`, `j-0.960`: the video should show a DIFFERENT pose at each progress (proving the scrub maps scroll→time), the mat stable, no mesh doubling. (Headless `_rig.at` sets `currentTime`; the frame shown depends on the browser having decoded that time — if matshot frames look blank/black, add a short `await page.waitForTimeout(250)` after `_rig.at` in matshot, and seek via `flowVideo` before screenshot.)

- [ ] **Step 6: Commit**
```bash
cd "/Users/at/Projects/site 2" && git add home.html js/home-journey.js tools/matshot.mjs && git commit -m "feat(home): scroll-scrubbed video flow replaces still crossfade"
```

---

### Task V4: Compositing/seam tune + full acceptance + mobile

**Files:** Modify `js/home-journey.js` / `home.html` (video `object-position`/size, cream) as needed

- [ ] **Step 1: Tune placement + seam**

Scroll the live page (or matshot frames) through p0.56→1.0. Adjust the video's `object-position` / size so the mat sits where the mesh mat was at handoff (seamless mesh→video), and confirm the video's cream blends into the page cream with no visible rectangle. If a seam persists, apply a soft edge feather to `#flowVideo`:
```css
  -webkit-mask-image: radial-gradient(120% 120% at 70% 55%, #000 60%, transparent 92%);
          mask-image: radial-gradient(120% 120% at 70% 55%, #000 60%, transparent 92%);
```
(fallback per spec §4; only if needed).

- [ ] **Step 2: Smooth the scrub (if janky)**

If scrubbing jitters, damp the target time: keep a `flowTarget`/`flowCurrent` and ease `flowVideo.currentTime` toward `flowFor(current)*_flowDur` in the rAF loop, mirroring the existing `current`/`target` damp. Confirm scrolling feels like a smooth flow, not stepped.

- [ ] **Step 3: Full acceptance gate**

Live page (desktop): scroll the hero — unroll → mat morphs+eases → hands off to the video → Cristina flows continuously through the poses on ONE stable mat → ends on hands-to-heart. Confirm: motion is continuous (no fades between poses), the mat never jumps, the handoff from the 3D mesh is invisible, no console errors (`node tools/matshot.mjs` → CONSOLE ERRORS none).

- [ ] **Step 4: Mobile static fallback**
```bash
cd "/Users/at/Projects/site 2" && node -e '
const { chromium } = require("playwright");
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:390,height:844} });
  await p.goto("http://localhost:8000/home.html", { waitUntil:"networkidle" });
  await p.screenshot({ path:"tools/matshot/static-mobile.png" }); await b.close(); })();'
```
Read it: static poster renders, no video, no broken layout.

- [ ] **Step 5: Commit + refresh the lab**

Update `tools/lab/lab.html` to embed `assets/flow.mp4` as the headline "final flow" for the owner to watch, then:
```bash
cd "/Users/at/Projects/site 2" && git add js/home-journey.js home.html tools/lab/lab.html && git commit -m "feat(home): tune video flow placement, seam, scrub; final acceptance"
```

---

## Self-review

- Spec §3 architecture (mesh handoff → scrubbed video) → V3. ✓
- §2 clips from keyframes → V1 (review/regen). ✓
- §3 stitch, seamless joins → V2. ✓
- §4 compositing/cream → V3 Step 3 + V4 Step 1. ✓
- §5 scrub performance (dense keyframes + damp) → V2 Step 1 + V4 Step 2. ✓
- §6 mobile fallback → V4 Step 4 (unchanged path). ✓
- §7 hard-transition risk → V1 Step 1–2 (review + regen gate). ✓
- Carried-over camera ease + handoff (Task 1) untouched → V3 builds on `handoffFor`. ✓

**Placeholders:** `<FLOWCREAM>` / `<FLOWCREAM_RGB>` are filled from V2 Step 3's measured value within V3 Step 3 — a measurement, not a TBD.

**Open risk surfaced, not hidden:** if matshot can't capture scrubbed video frames headlessly (decode timing), V3 Step 5 notes the fix; if that proves flaky, the acceptance gate falls back to live-page review in the lab.
