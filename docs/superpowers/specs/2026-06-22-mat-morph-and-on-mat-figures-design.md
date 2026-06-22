# SAÏA Home — Mat morph + Cristina on the mat (design)

**Date:** 2026-06-22
**Page:** `home.html` (pinned 3D journey)
**Owner files:** `js/home-journey.js`, `home.html`, `assets/figure/*`, `tools/*`

## Problem

The pinned home journey unrolls a real 3D mat, then hands off to a flat watercolour scene
where Cristina flows through poses. Two defects in that handoff:

1. **The mat "fades away to a new one" instead of transforming.** The WebGL canvas (3D mat,
   framed at `right:6%`) crossfades to `#matStage` (flat PNG at `left:55%`). Two different
   objects in two different screen positions → the eye reads *disappear + reappear*, not
   *turn into*.
2. **Cristina is beside the mat, not on it.** Figures anchor feet at `bottom:12vh`; the mat's
   *front lip* is also at `bottom:12vh`, so her feet land on the mat's nearest edge and — given
   the mat's 3/4 perspective — she reads as standing in front of it. Spread poses (down-dog,
   lunge) also overflow the fixed mat.

## Goals

- One continuous mat **identity** through the whole journey: real 3D mat → blooms into
  watercolour in place → stays put while Cristina is painted onto it pose by pose.
- Cristina is convincingly **on** the mat in every pose, including spread poses, with natural
  contact (weight, shadow, hands/feet pressing into the surface).
- The pose-to-pose flow stays **smooth** — no mat shimmer, jump, or "breathing."
- Subtle paint **bloom** at the morph moment (not a flashy flourish).

## Non-goals

- No change to the 3D unroll itself (p0→0.22) or the mood/lighting track.
- No replacement of the still-sequence approach with video.
- No mobile/reduced-motion change (still falls back to the static PNG).

## Architecture: one mat, three lives

```
 p 0 ─────────── 0.50      0.50 → 0.56            0.56 ─────────────── 1.0
 ┌────────────────┐     ┌────────────────┐     ┌──────────────────────────┐
 │ 3D mat unrolls  │     │ MORPH in place  │     │ Cristina flows through    │
 │ + showcases     │ ──▶ │ canvas → PNG at │ ──▶ │ poses, each GENERATED     │
 │ (WebGL)         │     │ same rect+bloom │     │ on the SAME mat           │
 └────────────────┘     └────────────────┘     └──────────────────────────┘
   real mat               morph target =          15 baked figures; mat region
                          empty hero mat          registered to one fixed rect
```

The "hero mat" (one watercolour mat asset, generated at a deliberate 3/4 angle) is used three
ways so there is never a second mat:
- as the **morph target** (rendered empty, the PNG the 3D mat blooms into),
- as the **locked reference** fed into every pose generation (keeps the mat's art consistent),
- as the **registration template** the build tool aligns each baked frame to.

## Mechanism 1 — In-place morph (chosen approach A)

The morph only reads as "turns into" when both mats share the same screen rectangle.

1. **Land the 3D mat on the PNG's rect.** Retune the camera `frames` around `p≈0.50` in
   `home-journey.js` so the rendered 3D mat's on-screen footprint matches the empty hero-mat
   PNG's position/scale. Lever A: tune the camera to the PNG. Lever B: generate the PNG to the
   camera's natural end-frame. We use both — generate the hero mat at a chosen 3/4 angle, then
   fine-tune the camera frame to register against it (iterate via `tools/matshot.mjs`).
2. **Crossfade in place.** Keep `matStageFor(p)` (canvas opacity `1→0`, `#matStage` `0→1` over
   p0.50→0.56).
3. **Subtle bloom.** On the incoming PNG only, add a short watercolour bloom: a brief
   `filter: blur()` + `saturate()` pulse that resolves to crisp as opacity reaches 1 — paint
   blooming over the real mat. Transform/opacity/filter only (no layout, respects
   `layout-shift-avoid`). Honour `prefers-reduced-motion` (already short-circuits to static).

## Mechanism 2 — Mat generated into each pose (chosen approach D), made smooth

Per-pose generation gives the most beautiful integration; stability is engineered in the build.

### Asset pipeline (Higgsfield MCP + Node build tool)

1. **Hero mat.** Generate one watercolour mat at the morph's 3/4 angle (extends the existing
   `mat-stage.png` recipe in the pipeline memory: `nano_banana_pro`, muted charcoal/taupe +
   faint terracotta, no reference photos) → `remove_background` → autocrop. This is the morph
   target, the reference, and the registration template. Save as `assets/figure/mat-stage.png`.
2. **Per-pose generation.** For each of the 15 poses, generate Cristina **on the hero mat**:
   feed the hero mat as a **locked reference image** alongside the existing portrait/stand
   references (figure recipe in the pipeline memory) so the mat's art, colour, and angle stay
   constant pose-to-pose. Prompt the pose to make contact with the mat (weight on feet/hands,
   soft contact shadow on the mat surface). Avoid the emphatic identity gate (per memory it
   stalls jobs); expect to resubmit dropped/stalled jobs (notably plank-like poses).
3. **Registration + normalise (new build tool, `tools/figbake.mjs`).** Each generation frames
   the mat slightly differently. The tool:
   - detects the mat region in each generated frame (consistent shape/colour vs. the template),
   - computes the 2D transform (translate/scale) that aligns that mat region to the hero mat's
     fixed position,
   - applies it so the **mat sits at a pixel-stable on-screen rect across all 15 frames**,
   - exports `assets/figure/figure-1..15.png` (mat + pose as one image, mat registered).
   Result: during crossfades only Cristina changes; the mat is effectively static → no shimmer.
4. **Backups.** Existing figures backed up under `tools/figbak/` (already present); back up the
   current 15 + `mat-stage.png` before overwrite.

### Why generate-and-register over flat compositing

Flat compositing (paste mat-free figure onto one mat) is pixel-stable but the contact is
synthetic — she looks pasted. Generation integrates her weight, shadow, and the mat's response
naturally (the brand's hand-painted look). Registration recovers the stability that raw
generation loses. Credits are not a constraint; spend them on the integration that compositing
can't fake.

## Code changes

| File | Change |
|---|---|
| `js/home-journey.js` | Retune `frames` near p0.50 to land the 3D mat on the hero-mat rect; add the bloom (blur/saturate pulse on `#matStage` during p0.50→0.56) in `paint()` / `matStageFor`; figures now carry the mat, so `#matStage` fades out as figures take over — guard against showing both mats at once (matStage opacity → 0 once figure opacity rises) |
| `home.html` | `#matStage` keeps its rect but is now purely the morph bridge; `will-change` add `filter`. No new DOM (figures already in `#figureLayer`) |
| `js/home-journey.js` `FIG[]` | Re-verify `foot`/`h`/`x` now that the mat is baked into each figure: the figure image's own foot line already sits on its baked mat, so `foot` aligns the **baked mat** to a consistent screen line; spread poses inherit a mat wide enough to cover them |
| `tools/figbake.mjs` (new) | Registration + normalise build tool (above) |
| `assets/figure/*` | New `mat-stage.png` (hero mat); 15 rebaked `figure-N.png` |

## Verification

- `node tools/matshot.mjs` renders the handoff window (0.48 showcase / 0.52 handoff / 0.56
  walk-in) + pose flow (stand, heart, hinge, dog, lunge, seated, close). Confirm: (a) the 3D
  mat and PNG register at the handoff (no positional jump), (b) the bloom is subtle, (c) her
  feet/hands sit on the mat surface at every pose, (d) the mat does not shift between poses.
- Manual scroll check on `http://localhost:8000/home.html` (the morph must read as one mat
  transforming; verify on a slow scrub and a fast scroll).
- Console-error check is built into `matshot.mjs`.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Higgsfield won't hold the mat identical across 15 gens | Locked mat reference + registration step normalises position; minor colour drift is hidden by the narrow crossfade window (`FIG_W=0.032`) |
| Mat-region detection fails on a frame | Tool logs per-frame registration confidence; low-confidence frames flagged for manual transform or regeneration |
| 3D-mat ↔ PNG perspective never matches perfectly | Generate the hero mat to the camera's natural end-frame, then fine-tune the camera; the subtle bloom masks small residual mismatch |
| Pose generations stall (plank-like) | Per memory: soft identity phrasing, resubmit dropped jobs |

## Decisions resolved

- On-the-mat fix: **D (generated per-pose), made smooth via locked reference + registration.**
- Morph: **A (in-place + subtle bloom).**
- Bloom intensity: **subtle.**
- Credits: not a constraint — optimise for the most beautiful, smooth result.
