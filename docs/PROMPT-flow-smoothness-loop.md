# LOOP PROMPT — Make Cristina's scroll-flow genuinely smooth (no jump cuts)

> Paste everything below into a fresh chat. Recommended: run it as a self-paced loop —
> type `/loop` then paste the whole brief. The loop must keep iterating until the
> SUCCESS CRITERIA pass; it self-verifies every round and re-does whatever fails.

---

## ROLE & MISSION
You are continuing work on the **SAÏA London** static site (`/Users/at/Projects/site 2`).
The `home.html` hero is a pinned, scroll-scrubbed sequence of the founder **Cristina** as a
hand-painted watercolour figure who flows through 5 yoga poses (stand → reach/heart →
forward-fold/dog → low-lunge → seated, hands to heart). Each pose is a "hold" where the
section's text reads; scrolling between holds plays the pose-to-pose motion.

**Your mission:** make that motion **buttery smooth and realistic — zero jump cuts** — and keep
the poses and text perfectly synced. This almost certainly means **regenerating the frame
sequence with many more, identity-consistent, continuous frames**, then re-wiring the scrub.
Iterate until it is genuinely seamless. Do not stop at "better"; stop at "smooth".

## READ THESE FIRST (do not skip)
1. `docs/HANDOVER-flow-levels.md` — how the 5-level stepped scrub was built.
2. The memory file `cristina-figure-pipeline.md` (in the user's Claude memory) — the **exact
   Higgsfield generation recipe**, the locked reference IDs, the identity gate, and the
   mat-free figure pipeline. Reuse this recipe so the new frames look identical to the brand.
3. `js/home-journey.js` — the scrub engine. Key symbols: `FLOW_STOPS` (the 5-level map),
   `flowFrameFor(p)`, `scrubFlow(p)`, `drawFlowFrame(idx)`, `FLOW_FROM=0.576`, `FLOW_TO=1.0`,
   `FLOW_COUNT`, `FLOW_DIR='assets/flow-frames/'`. Asset paths/counts are overridable via
   `window.SAIA_ASSETS.flowFrameDir` / `.flowFrameCount`.
4. `home.html` — the `#flowCanvas` element (`left:57% top:53% height:76vh aspect 1104/756`,
   radial mask) and the 5 flow `[data-band]` text bands at p ranges
   `0.585–0.685 / 0.705–0.792 / 0.812–0.880 / 0.890–0.946 / 0.958–1`.

## THE PROBLEM (precise)
- Current frames: `assets/flow-frames/f001..f150.jpg`, **1104×756**, each a full watercolour
  scene (Cristina + a dark charcoal mat + cream `#ece8dc` background).
- They were **stitched from ~14 independently-generated transition clips** (Seedance keyframe
  interp) → at every clip seam Cristina is a *different drawing*: linework, face, shading and
  proportions visibly shift. Scrubbing across a seam reads as a **jump cut / cross-fade pop**,
  not motion. (The user's two example screenshots are two adjacent "stand" frames that are
  clearly two different illustrations.)
- Even inside a clip the frame count is too sparse for slow scroll, so motion stutters.

## ROOT CAUSE
The source motion is not continuous. Fixing pacing/easing in JS cannot help — the **pixels
between adjacent frames jump**. You must produce a frame sequence where **every adjacent pair
is a true in-between of the same drawing**, and where **clip boundaries are continuous** (the
last frame of one transition must be the exact same still that starts the next).

## SUCCESS CRITERIA — these are the loop's EXIT GATE (all must pass)
1. **No jump cut anywhere.** Run the adjacent-frame diff harness (below) across the whole flow:
   no diff spike — i.e. no adjacent pair whose perceptual diff is an outlier (> ~2.2× the local
   median of its neighbours) AND above an absolute floor. Zero outliers across 0.576→1.0.
2. **Identity is stable.** Cristina's face, braid, cream top, terracotta leggings, body
   proportions and the mat read as the SAME person/drawing from the first flow frame to the
   last. No morph/flicker of identity. (Eyeball a face-crop strip + the contact sheet.)
3. **Smooth at scroll speed.** A dense scrub sweep (≥150 samples 0.576→1.0) assembled into a
   preview video plays as continuous motion at normal scroll velocity — no stutter, no pop.
4. **Poses still land on the holds and the text still syncs.** At the 5 hold p-centres
   (~0.640, 0.749, 0.846, 0.918, 0.979) the pose is exactly stand / reach-up(hands-to-heart) /
   forward-fold→dog / low-lunge / seated-hands-to-heart, and the matching band text is fully
   readable. Adjust `FLOW_STOPS` + band ranges together if anchors move.
5. **Nothing else regressed.** `node tools/morphtest.mjs` stays green (mat morph 0→1, canvas
   opaque@0.55, faded@0.80, no console errors). Mat intro (p0→0.576) untouched. The page still
   falls back cleanly on mobile / `prefers-reduced-motion` (`.is-static`).
6. **Weight is sane.** New sequence loads without jank on the dev server; total added bytes
   reported. Prefer ~quality-tuned JPGs; lazy/idle-load beyond the first hold (the engine
   already batches — keep eager-loading the entrance + L1).

## STRATEGY (recommended — adapt if you find better)
**Per-transition keyframe interpolation with shared boundary stills.**
1. Establish **6 canonical anchor stills** (full watercolour scene: Cristina + dark mat + cream
   bg, matching the current look) — one per hold pose, in order:
   `A0 walk-in/enter → A1 stand → A2 reach-up/heart → A3 forward-fold→dog → A4 low-lunge →
   A5 seated hands-to-heart`. Sources to start from: `tools/lab/assets/onmat-01..15.png`
   (1264×848, on-mat poses) and/or `assets/figure/figure-1..15.png` (mat-free cutouts). If an
   anchor still isn't clean/consistent, regenerate it with the memory's Higgsfield recipe
   (`nano_banana_pro`, locked portrait ref `0029c54c-354d-47f8-a79f-95bb8c49cfd9`, soft identity
   gate — NEVER the emphatic "THIS EXACT person" wording, it hangs jobs).
2. For each of the **5 segments** (`A0→A1, A1→A2, A2→A3, A3→A4, A4→A5`) generate a **smooth
   image-to-video tween** using **start frame = anchor[k], end frame = anchor[k+1]** with the
   identity reference locked. Use Higgsfield `generate_video`; before picking a model call
   `models_explore(action:'recommend')` describing "smooth slow watercolour character pose
   interpolation between two keyframes, no style flicker, consistent illustration." Low motion,
   slow, no camera move. Because consecutive segments **share the boundary anchor**, the seams
   are continuous by construction.
3. **Extract frames** from each segment video (ffmpeg) at a density matched to that segment's
   scroll length (longer transitions → more frames; aim so adjacent frames differ only slightly,
   ~30–80 per segment). Normalise every frame to the canvas aspect/look (1104×756, cream
   `#ece8dc` bg, same crop) so they composite identically.
4. **Re-assemble** into `assets/flow-frames/` as a clean `f001..fNNN.jpg` sequence: hold poses =
   the single anchor still (repeat is fine, the engine skips redundant redraws), transitions =
   the dense tween frames. Update `FLOW_COUNT` (or `window.SAIA_ASSETS.flowFrameCount`) and the
   anchor indices inside `FLOW_STOPS` so each hold lands on its anchor frame and each transition
   spans its tween range. Keep `FLOW_FROM/FLOW_TO` and the 5-level fp structure.
5. If a segment still flickers identity or pops: **regenerate just that segment** (different
   model / lower motion / better anchors / `upscale_video` or a frame-interpolation pass to
   multiply frames). Re-verify. Repeat per-segment — don't redo good segments.

**Alternatives if keyframe-tween underperforms:** (a) generate one continuous slow video of the
whole stand→seated descent with the character locked, then extract — risks identity drift across
its length, verify hard; (b) take the existing/!new sparse-but-clean anchor stills and run a
dedicated frame-interpolation model (RIFE/FILM-style) to synthesise in-betweens — cheap, but only
works if the two ends are the same drawing. Pick whatever passes the gate.

## TOOLS TO USE (use the MCPs and skills — don't hand-roll)
- **Higgsfield MCP** — the generation engine. Likely tools: `balance`/`show_plans_and_credits`
  (check credits first), `models_explore` (recommend a model), `generate_image` (fix/redo an
  anchor still), `generate_video` (the keyframe tweens — pass start+end keyframes), `media_*`
  (upload local anchor stills → get media_ids to feed as keyframes/refs), `upscale_video`,
  `motion_control`, `remove_background`, `job_status`/`show_generations` (poll). Watch the memory
  notes: MCP drops ~2/9 parallel calls (resubmit); plank-type poses stall (avoid/retry).
- **chrome-devtools MCP and/or playwright MCP** — drive `http://localhost:8000/home.html`, call
  `window.SAIA._rig.at(p)` and screenshot for the verify harness; record/scrub; read console.
- **ffmpeg (Bash)** — extract frames from segment videos, build preview videos, recompress JPGs.
- **Skills:** `gsap-scrolltrigger` and `locomotive-scroll` (if you decide the scrub mechanic
  itself needs smoothing — e.g. easing/lerp of the scroll value), `frontend-design` /
  `ui-ux-pro-max` (polish), `web3d-integration-patterns` (only if you touch the WebGL handoff),
  `systematic-debugging` (when a fix attempt fails — stop and reassess, don't retry variations),
  `verification-before-completion` (never claim smooth without running the harness).

## THE LOOP (repeat until the EXIT GATE passes)
Each iteration:
1. **State the target of this round** (which segment(s) you're improving and why — cite the
   harness output from last round). On round 1, build the baseline: run the verify harness on
   the CURRENT 150 frames and record every jump-cut p-location + diff score.
2. **Generate / regenerate** the failing segment(s) per the strategy. Check Higgsfield credits
   first; work segment-by-segment to control cost; resubmit dropped jobs.
3. **Assemble** the new frames into `assets/flow-frames/` and update `FLOW_COUNT`/`FLOW_STOPS`/
   band ranges as needed.
4. **VERIFY (mandatory gate every round):**
   a. `node tools/morphtest.mjs` → must stay green.
   b. Adjacent-frame diff harness over 0.576→1.0 → report worst pairs + whether any are outliers.
   c. Dense scrub sweep → assemble preview video → watch for stutter/pop.
   d. Face-crop identity strip + full contact sheet → eyeball identity stability.
   e. Re-screenshot the 5 hold p-centres → confirm pose↔text still correct.
5. **Decide:** if all SUCCESS CRITERIA pass → DONE, write a short summary + before/after. If not
   → log exactly which criterion failed and at which p, and loop back to step 1 targeting that.
   If the same approach fails twice, switch strategy (don't tune the same knob a third time —
   invoke `systematic-debugging`).

## VERIFICATION HARNESS (build these once, reuse every round)
Put scripts in `tools/seam/` (untracked scratch). Pattern already there: load page → wait for
`window.SAIA._rig` and `#flowCanvas.width>1` → `_rig.at(p)` → screenshot. Build:
- **`flowdiff.mjs`** — sweep p from 0.576→1.0 in ~160 steps; for each, force-load the exact
  frame, `_rig.at(p)`, screenshot a fixed crop around `#flowCanvas`. Compute mean abs pixel diff
  between consecutive screenshots. Flag **outliers**: diff > 2.2× the median of its 6 neighbours
  AND > an absolute floor. Print the worst 10 with p and frame index. (Outliers = jump cuts.)
- **`flowpreview.mjs`** — same sweep, then `ffmpeg` the screenshots into an mp4 at ~30fps to
  eyeball motion. (Also handy to attach for the user.)
- **`faces.mjs`** — crop the head region across ~12 evenly-spaced p and tile into one strip to
  check identity drift.
Keep using `node tools/matshot.mjs` for the mat-intro sanity shots.

## GUARDRAILS / DO-NOT
- **Brand:** mats are HIRE ONLY (never "buy"). Voice warm, female-led, British English,
  English-only. Palette cream `#F5F1E8`/`#ece8dc`, ink `#2B2620`, terracotta `#B8624A`. Don't
  remove existing UI elements.
- **Keep the mat intro (p0→0.576) and its timing untouched** — `morphtest` encodes it
  (morph 0.50→0.56, canvas faded by 0.80). Do all work inside the flow range.
- **No `<video>` scrubbing.** The dev server (`python3 -m http.server`) has no HTTP range
  support; paused-video `currentTime` scrubbing froze before (see history). Stay with an image
  sequence drawn to `#flowCanvas`.
- **Don't reintroduce** `mix-blend-mode:multiply` on `#flowCanvas` (darkens the cream into a
  visible rectangle) or the mesh→flow alignment glide (caused a double-mat).
- **Cost:** Higgsfield burns credits. Check balance, generate per-segment, don't regenerate
  segments that already pass. Confirm any large/expensive batch with the user if unsure.
- **Git:** commit per-task with scoped `git add <files>` (never `-A`), trailer
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Do NOT merge to `main`
  or push without asking. Don't commit until the gate passes.

## HOW TO RUN / VERIFY
```bash
cd "/Users/at/Projects/site 2"
python3 -m http.server 8000            # open http://localhost:8000/home.html
node --check js/home-journey.js
node tools/morphtest.mjs               # keep green
node tools/seam/flowdiff.mjs           # your jump-cut detector — must report 0 outliers
node tools/seam/flowpreview.mjs        # eyeball the motion
```
Definition of done: `flowdiff` reports **0 outliers**, the preview video is continuous, identity
is stable, the 5 holds sync to their text, and `morphtest` is green. Then summarise with a
before/after and the new frame count / added weight.

Branch: `mat-transform-single-mat`. The current 5-level scrub + bands are already in the working
tree (uncommitted). Your job is purely to make the motion between poses seamless.
