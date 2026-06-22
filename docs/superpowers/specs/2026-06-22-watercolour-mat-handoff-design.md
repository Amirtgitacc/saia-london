# Watercolour mat handoff — "wash into the mat she works on"

**Date:** 2026-06-22
**Page:** `home.html` (pinned scroll-driven 3D journey)
**Driver:** `js/home-journey.js`

## Problem

On the home journey, when the scroll reaches the "Move with Cristina" beat, the mat is
supposed to "become watercolour to match Cristina's style." It currently does this wrong:

| Element | What it is | Why it reads wrong |
|---|---|---|
| Big diagonal mat | The real 3D `saia-mat.glb` mesh; a second mesh (`wcMaterial`) fades in `saia-mat-watercolour.png` — a **dark** wash — at p≈0.5 | Dark, 3D-lit, floats behind/around her at the wrong angle. A lit 3D mesh never matches her flat, light watercolour medium. |
| Small mat under feet | Baked **into a few figure PNGs** (e.g. `figure-2` walking); most poses (`figure-9`, `figure-12`) have none | A separate, light, tiny mat — disconnected from the big one, and inconsistent across poses. |

Two different mats fight, and neither reads as "the mat she's working on."

## Goal

The mat we've been showcasing should **wash into watercolour and become the single, flat
watercolour mat that sits under Cristina's feet** while she flows through her poses — one
continuous, believable mat in her exact painted style.

## Approach (chosen: B — 3D→2D handoff)

The realistic 3D mat finishes its unroll showcase, then **crossfades at the same screen
spot into one flat 2D watercolour "stage" mat** painted in Cristina's style. Because the 2D
mat lives in the same DOM coordinate system as the figures, it is *always* perfectly under
her feet — no fragile 3D-to-2D alignment math. The mat is **fixed** (a calm stage), not
per-pose.

```
p:  0.44        0.50            0.54              0.58 ───────────► 0.96
    │ 3D mat    │ 3D canvas      │ 2D watercolour   │ Cristina walks in and
    │ showcased │ fades OUT  ╳   │ mat fully in,    │ flows through 15 poses
    │ (real)    │ 2D mat fades IN│ under foot line  │ ON the one 2D stage mat
    └───────────┴────────────────┴──────────────────┴────────────────────────
         realistic 3D  ──crossfade──►  flat watercolour mat (her style)
```

## Components

### 1. Retire the dark wash (`js/home-journey.js`)
Remove the watercolour-overlay mesh and its fade:
- Delete `wcMaterial`, `wcMesh`, and the `WC_URL` load.
- Delete `washFor(p)` and its call in `paint()`/`_rig.at()`.
- Keep the realistic `meshMaterial` mat exactly as-is for the showcase bands.

### 2. New asset — flat watercolour stage mat (`assets/figure/mat-stage.png`)
A single flat yoga mat, painted in Cristina's watercolour-and-ink style, in **gentle 3/4
perspective** (long edge roughly horizontal, receding slightly away from the viewer), so her
barefoot poses rest near its front edge. Transparent background, soft contact shadow.
Visually consistent with the small mat already baked into `figure-2`.

**Generation (Higgsfield MCP)** — reuse the figure pipeline so the medium matches:
- Model `nano_banana_pro`, aspect ratio chosen for a wide mat (e.g. `16:9` or `3:2`), 1k.
- Prompt: same watercolour/ink/cream-paper style descriptors as the figures, but subject is
  the mat only — e.g. *"A refined hand-painted editorial watercolour-and-ink illustration of
  a single yoga/Pilates exercise mat lying flat on the floor, seen in gentle three-quarter
  perspective, long edge horizontal and receding slightly. Warm terracotta, charcoal and
  cream palette; soft watercolour shading with delicate ink lines; subtle paper grain; flat
  plain cream background; soft contact shadow beneath the mat. The mat has a faint centre
  line and a small 'SAÏA' wordmark near one end. No people."*
- Then `remove_background` → download → autocrop to alpha bbox (zero alpha < 24 to drop soft
  halos) → save as `assets/figure/mat-stage.png`.
- If the first result's perspective/proportions are off, iterate the prompt; pick the take
  that best matches `figure-2`'s baked mat angle.

### 3. New DOM layer — `#matStage` (`home.html`)
A single `<img id="matStage" src="assets/figure/mat-stage.png" alt="">` placed **behind the
figures and above the canvas**:
- DOM/z-order: `#homeCanvas` (z-index 1) < **`#matStage`** < `#figureLayer` (z-index 2) <
  `#stage` (z-index 3). Give `#matStage`'s wrapper a z-index that sits below `#figureLayer`
  (e.g. its own layer at z-index 2 placed *before* `#figureLayer` in the DOM, or z-index
  1 with the canvas left at 1 and matStage after it). Result: Cristina's body renders in
  front of the mat; the mat renders in front of the canvas.
- Positioning mirrors the figures so it's locked under her feet: `position:absolute`,
  `left:55%`, `transform:translateX(-50%)`, anchored to the figure foot line
  (`bottom:~12vh`, matching `FIG.foot = 0.88`), `width` sized so the mat reads as her stage
  (tune on view; start ~46vw), `height:auto`, `transform-origin:bottom center`,
  `opacity:0`, `pointer-events:none`, soft `drop-shadow`.

### 4. Canvas handoff + `matStage(p)` (`js/home-journey.js`)
- Add `const matStageEl = document.getElementById('matStage');`
- Add `function matStageFor(p)` returning a smooth 0→1 ramp across the handoff window
  (p≈0.50→0.56), e.g. the same `smoothstep` shape used by `washFor`.
- In `paint(p)` (and `_rig.at(p)`):
  - `canvas.style.opacity = (1 - matStageFor(p)).toFixed(3)` — 3D canvas fades out as the
    2D mat fades in. (The rAF loop keeps running so `applyMood` still drives the page
    background/scrim tones after the canvas is hidden.)
  - `if (matStageEl) matStageEl.style.opacity = matStageFor(p).toFixed(3)`
- The mat stays at full opacity from p≈0.56 through the end of the section (it is her stage
  for every pose). No fade-out at the end unless tuning shows it's needed.
- Note: `canvas` already has `transition: opacity .8s ease` set after init for the initial
  reveal — set it inline per-frame here, or clear that transition before driving opacity
  per-frame so the scroll-linked fade isn't lagged by the CSS transition.

### 5. Clean the figures
Audit all 15 `assets/figure/figure-*.png`. Any pose with a **baked-in mat** (confirmed:
`figure-2`; check the other walking frames `figure-1`, `figure-3`, and the rest) must be
regenerated (or erased) to **transparent under the feet**, so `#matStage` is the only mat.
Regeneration uses the existing figure recipe from the project memory
(`cristina-figure-pipeline`), with the pose prompt and **no mat / plain cream floor**.
Back up originals to `tools/figbak/` first (that dir already holds the original 7).

## Data flow

```
scroll → updateTarget() → current (damped) → paint(current)
  paint(p):
    mat.deform / camAt / applyMood        ← unchanged (3D showcase + page mood)
    canvas.opacity   = 1 - matStageFor(p) ← NEW: 3D fades out at handoff
    matStageEl.opacity = matStageFor(p)   ← NEW: 2D watercolour mat fades in
    bands(p) / figures(p)                 ← unchanged (text chapters + Cristina poses)
```

## Tuning checklist (live, on view)
- `#matStage` `width` / `bottom` so its surface sits convincingly under her foot line across
  the profile poses (walk, hinge, dog) and the front poses (seated).
- `matStageFor` window so the crossfade peaks right as she walks in (~p0.56) with no visible
  gap where neither mat is present.
- Confirm `#matStage` renders behind Cristina but in front of the (now fading) canvas.

## Out of scope
- Per-pose mats / mat that scales with her poses (explicitly chosen: fixed stage).
- Changes to `index.html` / `hero.html` (different concierge front end).
- Any change to the unroll showcase choreography before p≈0.44.

## Risks
- **Style match of the new mat asset.** Mitigation: same Higgsfield recipe/palette as the
  figures; iterate prompt against `figure-2`'s baked mat until it matches.
- **Figure regen drift** (character/pose). Mitigation: only regen figures that actually have
  a baked mat; reuse the locked reference IDs from the figure-pipeline memory; keep
  `tools/figbak/` backups.
- **Crossfade gap.** Mitigation: overlap the two opacity ramps over the same window so total
  coverage never drops to zero.

## Verify
Run `python3 -m http.server 8000`, open `http://localhost:8000/home.html`, scroll to the
"Move with Cristina" beat (≈70% down): the 3D mat should wash out as a single flat
watercolour mat fades in under Cristina's feet, and she should flow through every pose on
that one mat — no dark floating mat, no second tiny mat.
