# Handover — SAÏA home hero: the "5 yoga levels" scroll redesign

Paste this into a new chat to continue. Self-contained.

## What you're working on
SAÏA London static site (`/Users/at/Projects/site 2`). The `home.html` hero is a pinned, scroll-driven
3D yoga mat that unrolls, morphs to watercolour, and hands off to a **watercolour image-sequence of the
founder Cristina** flowing through yoga poses. The CURRENT TASK is a pacing/UX redesign: turn the flow
into **5 "levels"** where each level = one pose Cristina holds + that section's text, and scrolling
plays a slow pose-to-pose transition as the text swaps. **A plan is agreed; do NOT start coding until
the owner confirms the one open decision (the 5-level pose↔section table) — see "Agreed plan" below.**

## How we got here (evolution — important context)
1. Mat morph photoreal→watercolour + camera ease/handoff: shipped earlier.
2. Tried a scroll-scrubbed **`<video>`** (`assets/flow.mp4`) — **abandoned**: `<video>.currentTime`
   scrubbing froze like a PNG (dev server has no HTTP range support; paused video stalls buffering;
   seeks don't land). See `docs/report-video-flow-issues.md`.
3. **Option A adopted (Codex + this session): image-sequence scrub.** 150 cropped JPG frames in
   `assets/flow-frames/f001..f150.jpg` (~6.6 MB) drawn to a `<canvas id="flowCanvas">`, scrubbed by
   scroll. This is committed (`250e37e`) and WORKS — smooth, reaches every pose.
4. **Mat-alignment pass** (committed in `250e37e`): glided the 3D mat to the flow mat and crossfaded —
   then **REVERTED** in the working tree because it caused a visible double-mat and the owner asked for
   a simpler sequential fade.
5. **Uncommitted working-tree changes (current):** sequential handoff + seamless background:
   - Mat fades fully OUT in place → brief cream beat → Cristina fades IN (no overlap, no double mat).
   - Removed `mix-blend-mode:multiply` from `#flowCanvas` (it darkened the cream frame bg into a visible
     rectangle) and matched the page cream to the frame cream (`#ece8dc`). The "pasted painting" border
     is gone. Removed the now-dead alignment code (kept `meshMatRect()` for the rig).

## Current status
- **Branch:** `mat-transform-single-mat`. **HEAD:** `250e37e`. Repo IS git; `.env`+`node_modules`
  gitignored.
- **Committed (`250e37e`):** image-sequence flow scrub (frozen-PNG fix) + the (now-reverted) alignment.
- **UNCOMMITTED in working tree (working + verified, NOT yet committed):**
  - `home.html` — `#flowCanvas` element (no multiply now), `.is-static #flowCanvas{display:none}`.
  - `js/home-journey.js` — sequential handoff (`handoffFor` mesh-out [0.556→0.570], `videoFadeFor`
    flow-in from 0.576, `FLOW_FROM=0.576`), frame drawer (`drawFlowFrame`/`scrubFlow`/`initFlowFrames`/
    `loadFlowFrame`/`warmFlowAround`/`flowFrameFor`), page cream override `if(p>=0.556) bg='#ece8dc'`.
  - `docs/report-flow-pacing-and-bg.md` — the two reports below.
  - `tools/lab/handoff.html` — an iframe-scrub lab (owner couldn't use it; ignore/optional).
  - These changes are GOOD (they fixed the double-mat + the border). Decide with the owner whether to
    commit them as-is before the redesign, or fold into the redesign commit.
- `tools/seam/*` = scratch verification scripts (uncommitted, fine to ignore/delete).

## The three problems the owner reported (this is what the redesign fixes)
See `docs/report-flow-pacing-and-bg.md` for full detail. Summary:
- **P1 — background snaps warm→pale** when Cristina appears. Cause: hard cut
  `if (p>=0.556) sticky.bg='#ece8dc'` in `applyMood()` steps straight from the warm mood
  (p0.51 `#EBDCBF`, p0.65 `#E2CFA8`) to flat cream. Fix: ease warm→cream smoothly; hold one calm tone.
- **P2 — inconsistent at the start.** Causes: frames may not be loaded when you reach the flow
  (fallback to nearest frame); the walk-in entrance resolves over too little scroll; integer
  frame-rounding stutter. Fix: eager preload + the entrance becomes Level 1's settle.
- **P3 — flow too fast, poses flash by.** Cause: 150 frames mapped LINEARLY across only ~0.424 of the
  scroll (~3 screens), with NO hold zones and text NOT synced to poses. **This is the main redesign.**

## Agreed plan (owner confirmed the core; ONE decision still open)
**Core requirement (owner's words, "very very important"):** 5 sections. Each = one pose Cristina holds
+ that section's text. Scroll down → the animation plays and she flows slowly into the NEXT pose → the
text swaps to the next section. Pose and copy advance together, one level per scroll.

**Mechanic — "stepped scrub" (Option A):** map scroll→frame index NON-linearly as alternating zones:
`[HOLD pose: frame fixed, text in] → [TRANSITION: frames advance slowly, text swaps] → [HOLD] → ...`
Re-align the `[data-band]` text bands to the holds. Lengthen `#top` (currently `700vh`) to ~1000–1200vh
so each transition plays slowly. Smooth paced scroll (NOT hard CSS snap) is the chosen feel.

**Proposed 5 levels (THE OPEN DECISION — owner must confirm/adjust this table before coding):**
| Level | Pose (from the 15) | Section + text |
|---|---|---|
| 1 | Stands tall on the mat | For every gathering (mat hire) |
| 2 | Reaches up / heart opens | We curate unforgettable experiences (events) |
| 3 | Forward fold → downward dog | Move with Cristina (Pilates) |
| 4 | Low lunge | *(needs a 5th theme + line — e.g. community/strength)* |
| 5 | Seated → hands to heart | Get on the guest list (join) |

**Defaults agreed unless owner changes them:** smooth paced (not snap) · reuse existing copy + draft
Level-4 line · page grows to ~1000–1200vh.

**FIRST ACTION in the new chat:** ask the owner to confirm/adjust the 5-level table (which 5 sections,
which pose each, the 5th theme/copy). THEN write the build steps and implement. Do not code before that.

## Key facts for implementation
- **The 15 poses (frame order):** walk in, step on, stand, arms rise, reach up, heart open, hinge,
  forward fold, downward dog, low lunge, lower to seat, seated cross, seated twist, seated reach,
  hands to heart. 150 frames span these; pick the 5 representative frame indices per the table.
- **Existing text bands** (`home.html`, `data-band="a,b"`): `0,0.10` hero · `0.10,0.28` "Made for grip,
  made to last." · `0.28,0.44` "Hiring is effortless." · `0.44,0.58` "For every gathering." ·
  `0.58,0.72` "We curate unforgettable experiences." · `0.72,0.86` "Move with Cristina." ·
  `0.86,1` "Get on the guest list." The flow (Cristina) currently spans p0.576→1.0.
- **Flow drawer (in `js/home-journey.js`):** `FLOW_DIR='assets/flow-frames/'`, `FLOW_COUNT=150`,
  `flowFrameFor(p)=round(flowFor(p)*149)`, `flowFor(p)=(p-FLOW_FROM)/(FLOW_TO-FLOW_FROM)` with
  `FLOW_FROM=0.576, FLOW_TO=1.0`. To pace it, replace this linear map with a hold/transition piecewise
  map and re-time the text bands + `videoFadeFor`/`handoffFor`. `#flowCanvas` CSS: `left:57%; top:53%;
  height:76vh; aspect-ratio:1104/756; object-fit:contain;` + a radial mask (feathers edges).
- **`applyMood(p)`** drives `sticky.style.backgroundColor` from the `MOODS` array + the cream override
  line — this is where P1 (background) gets fixed.
- **Debug rig `window.SAIA._rig`** (`home-journey.js`): `at(p)` renders the exact scroll frame
  (used by all headless shots); `matRect()`→`meshMatRect()`; `peek()`.
- Desktop only for WebGL/canvas; mobile + `prefers-reduced-motion` → `goStatic()` (poster). Keep working.

## How to run / verify
```bash
cd "/Users/at/Projects/site 2"
python3 -m http.server 8000          # open http://localhost:8000/home.html
node --check js/home-journey.js
node tools/morphtest.mjs             # structural: morph 0→1, canvas opaque@0.55, faded@0.80 — keep green
node tools/matshot.mjs               # screenshots → tools/matshot/*.png (uses _rig.at; canvas-backed now)
```
- Headless scrub shots: `_rig.at(p)` then screenshot. For ad-hoc checks, copy a `tools/seam/*.mjs`
  pattern (load → wait `window.SAIA._rig` + `#flowCanvas.width>1` → `_rig.at(p)` → screenshot).
- Commits per-task, scoped `git add <files>` (never `-A`), message trailer
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Do NOT merge to `main` or push
  without asking.

## Pitfalls / notes
- Don't reintroduce `mix-blend-mode:multiply` on `#flowCanvas` (it darkens the cream bg → the rectangle).
- Don't reintroduce the mesh→flow alignment glide unless the owner asks (it caused a double-mat).
- The dev server (`python3 -m http.server`) has NO range support — irrelevant now (image sequence), but
  it means `<video>` scrubbing will never work here. Stay with the frame sequence.
- Frame-load timing: on a cold load, reaching the flow before frames decode shows the nearest frame
  briefly. Eager preload mitigates it; note this when building the level pacing.
- `assets/flow.mp4` (29 MB) is the abandoned video — no longer referenced; can be deleted later (ask).
