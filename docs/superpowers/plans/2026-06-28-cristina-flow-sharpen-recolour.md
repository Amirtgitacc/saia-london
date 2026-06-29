# Cristina Flow — Sharpen + Recolour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recolour Cristina's home.html watercolour journey to a charcoal/graphite outfit and make it visibly sharper + smoother, in ONE Kling `pro` render pass.

**Architecture:** Reuse the existing `tools/seam` pipeline unchanged in shape: (1) colour-only edit the 5 watercolour keyframes, (2) re-render the 4 pose-to-pose clips at Kling 3.0 `pro` (higher res = the real sharpness win), (3) re-assemble at ~1.4× resolution, (4) cut out to WebP 0.90, (5) re-wire frame count/indices and verify. No new generators, no new JS subsystems. No preloader.

**Tech Stack:** Higgsfield MCP (`nano_banana_pro` image edits, `kling3_0` video), Node ESM scripts (`tools/seam/*.mjs`), ffmpeg, Playwright/Canvas cutout, vanilla JS engine (`js/home-journey.js`), static `home.html`.

## Global Constraints

- **Outfit:** deep ink/charcoal cami crop top + slightly lighter **graphite/slate leggings** (legs must stay distinct from the near-black mat). Colour-only — same garment shapes, same pose/face/hair/mat/background.
- **Brand:** mats are HIRE ONLY (irrelevant to art but never imply "buy"). Palette cream `#F5F1E8`, ink `#2B2620`, terracotta `#B8624A`. Page/frame cream is `#ece8dc`. English only.
- **One render pass only.** Preflight `pro` cost before firing all four clips. Balance ≈ 194 credits (Plus). Do not re-render for sharpness or colour a second time.
- **Identity gate:** every recoloured keyframe and the final frames must still read as Cristina.
- **Matte config (known-good):** `FEATHER=5`, `MEDIAN` off, `DECON` off.
- **Verify gates:** `node tools/morphtest.mjs` exit 0 · `node tools/seam/flowdiff.mjs` = **0 outliers** · `node tools/seam/faces.mjs` identity holds · real-page `_rig.at(p)` screenshots.
- **The flowFrameCount gotcha:** `window.SAIA_ASSETS.flowFrameCount` in `home.html` OVERRIDES the JS default and silently caps loading — it MUST be updated to the new total.
- **No commits or pushes without the user's go-ahead** (per project rule). Steps below stage + commit locally; treat each `git commit` as "commit when the user has said to."

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `tools/seam/anchors-soul/KEY-{stand,reach,dog,lunge,seated}.png` | the 5 i2v keyframes (1104×756 cream) | recoloured in place (backup first) |
| `tools/seam/clips/clip1..4.mp4` | the 4 re-rendered Kling `pro` clips | replaced (backup first) |
| `tools/seam/assemble.mjs` | extract→normalise→subsample→concat→xfade; prints anchor indices | edit `W/H` (resolution); optional `samples` |
| `tools/seam/cutout.mjs` | flood-fill cream → WebP cutout frames | edit WebP quality 0.82→0.90 |
| `assets/flow-frames/fNNN.webp` | the live scroll frames | regenerated |
| `home.html` | sets `SAIA_ASSETS.flowFrameCount` | update count if total changed |
| `js/home-journey.js` | `A_STAND/A_REACH/A_DOG/A_LUNGE/A_SEATED`, `FLOW_STOPS` | update indices only if assemble reports new ones |
| memory `cristina-figure-pipeline.md` | pipeline record | append the charcoal/pro pass |

---

## Task 1: Branch + recolour the 5 keyframes (charcoal · graphite)

**Files:**
- Create: `tools/seam/anchors-soul/_backup-mauve/` (copies of the 5 KEY-*.png)
- Modify: `tools/seam/anchors-soul/KEY-{stand,reach,dog,lunge,seated}.png`

**Interfaces:**
- Produces: 5 recoloured cream 1104×756 keyframes at the SAME paths the render task reads.

- [ ] **Step 1: Branch + back up the current keyframes**

```bash
cd "/Users/at/Projects/site 2"
git checkout -b cristina-charcoal-sharpen
mkdir -p tools/seam/anchors-soul/_backup-mauve
cp tools/seam/anchors-soul/KEY-stand.png tools/seam/anchors-soul/KEY-reach.png \
   tools/seam/anchors-soul/KEY-dog.png tools/seam/anchors-soul/KEY-lunge.png \
   tools/seam/anchors-soul/KEY-seated.png tools/seam/anchors-soul/_backup-mauve/
ls tools/seam/anchors-soul/_backup-mauve/   # expect 5 files
```

- [ ] **Step 2: Upload all 5 keyframes to Higgsfield**

For each of the 5 KEY-*.png: call `media_upload` (filename, content_type image/png) → run the returned curl `PUT` from `tools/seam/anchors-soul` → `media_confirm` (type image, the media_id). Record the 5 media_ids. (Confirmed working flow: `media_upload` returns a presigned URL + media_id; `curl -X PUT -H "Content-Type: image/png" --data-binary @KEY-stand.png '<url>'` returns HTTP 200; then `media_confirm`.)

- [ ] **Step 3: Recolour each keyframe (colour-only `nano_banana_pro`)**

For EACH keyframe, call `generate_image` with `params.model = "nano_banana_pro"`, `params.aspect_ratio` matching the source (these KEY frames are 3:2 → `"3:2"`), `params.count = 1`, `params.medias = [{role:"image", value:"<that frame's media_id>"}]`, and this prompt (adjust the pose words per frame):

```
Recolour ONLY the woman's outfit in this watercolour illustration. Change her cami crop top
to a deep charcoal-ink colour, and change her leggings to a slightly lighter graphite/slate
grey (clearly lighter than the dark mat so her legs stay visible against it). Keep the SAME
watercolour-and-ink painting style, the SAME garment shapes (fitted cami crop top + high-waist
leggings), and keep absolutely everything else identical and unchanged: her exact face, smile,
skin tone, the dark braid over one shoulder, her [POSE: standing / reaching arms overhead /
downward dog / low lunge / seated cross-legged] pose, the dark yoga mat, the contact shadow,
and the plain cream paper background. Do not alter her body, proportions, or position. Only the
two garments change colour.
```

Poll each with `job_status` (`sync:true`). (Proven on the seated frame — clean recolour, no drift.)

- [ ] **Step 4: Download results and identity-gate them**

Download each result PNG to a temp dir and view all 5. CHECK: face still Cristina; pose/hair/mat/background unchanged; top = deep ink, leggings = clearly lighter graphite; leggings separate from the mat in dog/lunge/seated. If any frame drifted (face idealised, pose changed, colour wrong), re-run Step 3 for that frame only. Do NOT proceed until all 5 pass.

- [ ] **Step 5: Normalise the recoloured results back into KEY-*.png**

The KEY-*.png must stay cream `#ece8dc`, 1104×756. If a recoloured result is already that size/bg, copy it over the KEY path. If not, normalise (same as the original KEY build):

```bash
# per frame, fit+pad to 1104x756 on cream, overwrite the KEY path:
ffmpeg -y -loglevel error -i <recoloured-stand.png> \
  -vf "scale=1104:756:force_original_aspect_ratio=decrease,pad=1104:756:(ow-iw)/2:(oh-ih)/2:color=0xece8dc" \
  tools/seam/anchors-soul/KEY-stand.png
# repeat for reach, dog, lunge, seated
```

Verify dims: `sips -g pixelWidth -g pixelHeight tools/seam/anchors-soul/KEY-seated.png` → 1104 × 756.

- [ ] **Step 6: Commit**

```bash
git add tools/seam/anchors-soul/KEY-*.png tools/seam/anchors-soul/_backup-mauve
git commit -m "feat(flow): recolour Cristina keyframes to charcoal + graphite"
```

---

## Task 2: Re-render the 4 clips at Kling 3.0 `pro` (cost-gated)

**Files:**
- Create: `tools/seam/clips/_backup-std/` (copies of current clip1..4.mp4)
- Modify: `tools/seam/clips/clip1.mp4`, `clip2.mp4`, `clip3.mp4`, `clip4.mp4`

**Interfaces:**
- Consumes: the 5 recoloured `KEY-*.png` from Task 1.
- Produces: 4 higher-res `pro` clips at the exact paths `assemble.mjs` reads (`tools/seam/clips/clipN.mp4`).

- [ ] **Step 1: Back up the current clips**

```bash
cd "/Users/at/Projects/site 2"
mkdir -p tools/seam/clips/_backup-std
cp tools/seam/clips/clip1.mp4 tools/seam/clips/clip2.mp4 \
   tools/seam/clips/clip3.mp4 tools/seam/clips/clip4.mp4 tools/seam/clips/_backup-std/
```

- [ ] **Step 2: Confirm the exact `pro` param name + cost (THE CREDIT GATE)**

Call `models_explore` `action:"get"`, `model_id:"kling3_0"` and read its params — find the quality/mode field (the old run used a `std` value; we want the `pro`/high tier) and the keyframe roles (`start_image`/`end_image`) and the sound/audio flag. Then preflight cost: call `generate_video` with `params.get_cost = true`, `model "kling3_0"`, the `pro` mode value, `medias` = clip1's start/end keyframes (below), `duration 5`. Record the per-clip credit cost. **If 4× that cost would exceed a comfortable share of the 194 balance, STOP and report the number to the user before rendering.**

- [ ] **Step 3: Upload the 5 KEY keyframes (fresh media_ids for video)**

Same `media_upload`→curl PUT→`media_confirm` flow as Task 1 Step 2, on the now-recoloured `KEY-*.png`. Record media_ids: `MID_STAND, MID_REACH, MID_DOG, MID_LUNGE, MID_SEATED`.

- [ ] **Step 4: Render clip 1 (stand→reach) and sanity-check it**

```
generate_video  params:
  model: "kling3_0"
  <mode/quality param>: <pro value from Step 2>
  <sound/audio flag>: off
  duration: 5
  aspect_ratio: "auto"   (the 3:2 keyframes yield ~3:2; matches prior run)
  medias: [ {role:"start_image", value: MID_STAND}, {role:"end_image", value: MID_REACH} ]
  prompt: "A refined watercolour illustration of the same woman moving smoothly and continuously
           from standing upright to reaching both arms overhead. Slow, graceful, even motion;
           consistent character, outfit, and dark mat throughout; no cuts, no camera moves."
```

Poll `job_status` (`sync:true`). Download the mp4 and eyeball it: continuous motion, no scale pop, outfit charcoal/graphite, identity holds. If Kling stalls/drops (known: occasional drop on a call), resubmit the same call. Save to `tools/seam/clips/clip1.mp4`.

- [ ] **Step 5: Render clips 2–4 (same model + mode = the 0-outlier recipe)**

All four use the SAME model + mode so shared anchors match (the all-Kling fix that gave 0 outliers). Endpoints are the clean recoloured anchors:

```
clip2  reach->dog:    start=MID_REACH end=MID_DOG    prompt: "...continuously from reaching arms
        overhead down into a downward-dog pose, hips lifting back and up..."
clip3  dog->lunge:    start=MID_DOG   end=MID_LUNGE  prompt: "...continuously from downward dog
        stepping one foot forward into a low lunge..."
clip4  lunge->seated: start=MID_LUNGE end=MID_SEATED prompt: "...continuously from a low lunge
        lowering down to sit cross-legged, hands coming to prayer at the chest..."
```

Same `duration 5`, `pro` mode, sound off, `aspect_ratio auto`. Poll, eyeball each, resubmit any drop. Save to `tools/seam/clips/clip2.mp4`, `clip3.mp4`, `clip4.mp4`.

- [ ] **Step 6: Commit**

```bash
git add tools/seam/clips/clip1.mp4 tools/seam/clips/clip2.mp4 tools/seam/clips/clip3.mp4 tools/seam/clips/clip4.mp4
git commit -m "feat(flow): re-render 4 pose clips at Kling pro (charcoal outfit)"
```
(Backup dir `_backup-std/` is gitignore-able / can be added separately; do not let it bloat the commit if the repo avoids large binaries — match how the existing clips are tracked.)

---

## Task 3: Re-assemble at higher resolution

**Files:**
- Create: `tools/seam/flow-frames-backup-mauve/` (manual backup of current live frames)
- Modify: `tools/seam/assemble.mjs:18` (the `W`/`H` constants)

**Interfaces:**
- Consumes: `tools/seam/clips/clip1..4.mp4` from Task 2.
- Produces: `assets/flow-frames/fNNN.jpg` at the new resolution, and a printed line `SET: A_STAND=0 A_REACH=… A_DOG=… A_LUNGE=… A_SEATED=… FLOW_COUNT=…`.

- [ ] **Step 1: Manually back up the current live frames**

`assemble.mjs` only auto-backs-up if `tools/seam/flow-frames-backup` does NOT already exist (it does), so back up the current good frames explicitly so we can revert:

```bash
cd "/Users/at/Projects/site 2"
rm -rf tools/seam/flow-frames-backup-mauve
cp -r assets/flow-frames tools/seam/flow-frames-backup-mauve
ls tools/seam/flow-frames-backup-mauve | wc -l   # expect 303
```

- [ ] **Step 2: Raise the assemble resolution ~1.4×**

Edit `tools/seam/assemble.mjs` line 18. Change ONLY `W` and `H` (keep the 1104:756 ≈ 1.46 aspect):

```js
// before:
const W = 1104, H = 756, BG = '0xece8dc', Q = 4;
// after (~1.4×, even numbers, same aspect):
const W = 1544, H = 1058, BG = '0xece8dc', Q = 4;
```

Leave `samples` (70/80/72/60) unchanged for now — frame-count is a smoothness lever held in reserve (Task 5) to keep page weight down; JS fractional blending already smooths motion.

- [ ] **Step 3: Run assemble**

```bash
node tools/seam/assemble.mjs
```
Expected: per-clip lines, then `TOTAL FRAMES: …  weight: …` and the `SET: A_STAND=0 A_REACH=… A_DOG=… A_LUNGE=… A_SEATED=… FLOW_COUNT=…` line. **Copy that SET line — Task 5 needs it.** Frames now live at `assets/flow-frames/fNNN.jpg`.

- [ ] **Step 4: Spot-check a resized frame**

```bash
sips -g pixelWidth -g pixelHeight assets/flow-frames/f001.jpg   # expect 1544 × 1058
```
Open `assets/flow-frames/f150.jpg` and confirm: charcoal/graphite outfit, sharper than the old 1104px frame, cream bg.

- [ ] **Step 5: Commit**

```bash
git add tools/seam/assemble.mjs
git commit -m "build(flow): assemble flow frames at ~1.4x resolution"
```

---

## Task 4: Cut out to WebP 0.90

**Files:**
- Modify: `tools/seam/cutout.mjs:148` (WebP quality)

**Interfaces:**
- Consumes: `assets/flow-frames/fNNN.jpg` from Task 3 + the `FLOW_COUNT` total.
- Produces: `assets/flow-frames/fNNN.webp` transparent cutouts.

- [ ] **Step 1: Raise WebP quality 0.82 → 0.90**

Edit `tools/seam/cutout.mjs` line 148:

```js
// before:
return { url: C.c.toDataURL('image/webp', 0.82), borderMax: Math.round(borderMax) };
// after:
return { url: C.c.toDataURL('image/webp', 0.90), borderMax: Math.round(borderMax) };
```

- [ ] **Step 2: Run cutout over the new frames**

Use the `FLOW_COUNT` from Task 3 Step 3 as the count (e.g. 303). Default matte config is already correct (`FEATHER=5`, `MEDIAN` off, `DECON` off — no env vars needed):

```bash
node tools/seam/cutout.mjs assets/flow-frames assets/flow-frames <FLOW_COUNT>
```
Expected: `cutout: <FLOW_COUNT> frame(s) -> assets/flow-frames (WebP, …)`. The `.jpg` inputs are read and `.webp` written into the same dir.

- [ ] **Step 3: Measure total weight (the page-weight gate)**

```bash
du -sh assets/flow-frames
ls assets/flow-frames/*.webp | wc -l    # expect FLOW_COUNT
```
Record the size. Today's baseline ≈ 10.6 MB. If it's much heavier than ~15–18 MB, note it — Task 5 Step 5 has the dial-back levers (no re-render needed).

- [ ] **Step 4: Composite-check one frame on a contrast background**

The cream page hides cream-on-cream matte defects; check a frame over a dark/terracotta bg (open `f274.webp` — the lunge→seated limb-to-edge zone — over a dark swatch, e.g. in the browser with a `background:#2B2620` wrapper). CHECK: no comb/stitch fringe, no hard cutout line, hands not clipped. If a fringe appears, confirm `MEDIAN` is OFF (it must be) and re-run.

- [ ] **Step 5: Commit**

```bash
git add tools/seam/cutout.mjs assets/flow-frames
git commit -m "build(flow): cut out charcoal frames to WebP 0.90"
```

---

## Task 5: Wire frame count/indices + verify on the real page

**Files:**
- Modify: `home.html` (the `SAIA_ASSETS.flowFrameCount` value)
- Modify: `js/home-journey.js` (`A_STAND/A_REACH/A_DOG/A_LUNGE/A_SEATED`, `FLOW_STOPS`) — only if indices changed

**Interfaces:**
- Consumes: the `SET:` line from Task 3 Step 3 and the `.webp` frames from Task 4.

- [ ] **Step 1: Read the current wired values**

```bash
cd "/Users/at/Projects/site 2"
grep -n "flowFrameCount" home.html
grep -nE "A_STAND|A_REACH|A_DOG|A_LUNGE|A_SEATED|FLOW_STOPS" js/home-journey.js
```

- [ ] **Step 2: Update `flowFrameCount` in home.html (THE GOTCHA)**

Set `window.SAIA_ASSETS.flowFrameCount` to the new `FLOW_COUNT`. If unchanged from 303, still confirm it matches. Example edit:

```js
// home.html, in the SAIA_ASSETS block:
flowFrameCount: <FLOW_COUNT>,   // was 303
```

- [ ] **Step 3: Update anchor indices in home-journey.js IF they changed**

Compare the `SET:` line's `A_REACH/A_DOG/A_LUNGE/A_SEATED` to the current values. With `samples` unchanged the indices should match the recorded `A_STAND=0 A_REACH=69 A_DOG=156 A_LUNGE=235 A_SEATED=302`. If any differ, update them (and `FLOW_STOPS` if it derives from them). If identical, no JS edit.

- [ ] **Step 4: Structural verify**

```bash
node tools/morphtest.mjs
```
Expected: exit 0 (morph 0→1, canvas opaque, no console errors).

- [ ] **Step 5: Motion + identity verify (the gates)**

```bash
node tools/seam/flowdiff.mjs        # adjacent-frame perceptual diff at 96–120px
node tools/seam/faces.mjs           # identity across the holds
```
Expected: flowdiff reports **0 outliers** (median low, p90 single digits). faces shows a consistent, recognisable Cristina in the charcoal outfit. If flowdiff shows outliers at a clip boundary → a render/scale mismatch slipped in; re-eyeball that clip (Task 2) before continuing. If motion still reads stepped (subjective) → bump `samples` in `assemble.mjs` ~25% (70→88, 80→100, 72→90, 60→75), re-run Tasks 3–4, re-measure weight.

- [ ] **Step 6: Real-page screenshots (start the servers first)**

```bash
# server likely already up; if not:
python3 -m http.server 8000   # terminal B
```
Drive the real page (Chrome DevTools / claude-in-chrome) and `_rig.at(p)` headless shots at the journey poses (warm-sweep + wait for decode first, or you get the cold-load nearest-frame fallback). CHECK on the live page: (a) frames look sharper than before on a retina viewport; (b) in the SEATED frame the graphite legs separate clearly from the dark mat; (c) scroll feels smooth; (d) no half-loaded gaps on a normal-speed scroll (progressive load keeps up).

- [ ] **Step 7: Page-weight dial-back (only if Task 4 Step 3 was too heavy)**

If total > comfortable: lower WebP quality 0.90→0.86 (`cutout.mjs:148`) and/or resolution 1544×1058→1432×980 (`assemble.mjs:18`, ~1.3×), re-run Tasks 3–4, re-measure. **No video re-render needed.**

- [ ] **Step 8: Commit**

```bash
git add home.html js/home-journey.js
git commit -m "feat(flow): wire sharper charcoal flow (frame count + indices)"
```

---

## Task 6: Record + finish

**Files:**
- Modify: memory `cristina-figure-pipeline.md` + `MEMORY.md` pointer (already indexed)

- [ ] **Step 1: Append the pass to memory**

Add a dated block to `/Users/at/.claude/projects/-Users-at-Projects-site-2/memory/cristina-figure-pipeline.md`: charcoal-ink top + graphite leggings; one Kling `pro` re-render (vs old `std`); assemble `W/H` raised to 1544×1058 (~1.4×); cutout WebP 0.82→0.90; final FLOW_COUNT + anchor indices + final `du -sh` weight; backups at `_backup-mauve/`, `_backup-std/`, `flow-frames-backup-mauve/`; no preloader.

- [ ] **Step 2: Offer the finishing-a-development-branch flow**

Per `superpowers:finishing-a-development-branch`, present merge/PR/cleanup options to the user. Do NOT merge or push without explicit go-ahead.

---

## Self-Review (done)

- **Spec coverage:** recolour (T1) · `pro` re-render w/ cost gate (T2) · ~1.5× resolution (T3) · WebP 0.90 (T4) · smoothness frames+blending (T3 reserve / T5 S5) · no preloader (none added; T5 S6c checks progressive load) · flowFrameCount gotcha (T5 S2) · all verify gates (T5 S4–6) · weight levers (T4 S3, T5 S7) · identity gate (T1 S4, T5 S5). All covered.
- **Placeholders:** the only deliberately-deferred values are the exact `pro` mode param name + cost (T2 S2 resolves them live via `models_explore` because the catalog is authoritative) and `FLOW_COUNT`/media_ids (produced at runtime). No hand-wavy "add error handling".
- **Consistency:** keyframe paths `tools/seam/anchors-soul/KEY-*.png`, clip paths `tools/seam/clips/clipN.mp4`, dirs in `assemble.mjs`/`cutout.mjs` match the actual scripts (verified). Anchor index names match `home-journey.js`.
