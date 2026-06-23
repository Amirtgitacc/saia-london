# Perspective-Matched On-Mat Figures — Design

**Date:** 2026-06-23
**Status:** validated (lab test passed); ready for implementation plan
**Supersedes:** the mat-free-figures direction in `2026-06-22-mat-transform-single-mat.md` (figures only — the mat material-morph from that work is KEPT).

## 1. Problem

The previous build composited a **flat, eye-level watercolour illustration of Cristina** over a **3D mat rendered in steep perspective**. Two different cameras → she floated/pasted, her scale vs the mat made no sense, feet weren't grounded, she spilled past the mat edges, and the extraction left white artifacts at her feet. Root cause: a 2D frontal drawing and a 3D-perspective floor can never share perspective, scale, or ground.

## 2. Decisions (locked with the user via the lab)

- **Visual world:** Cristina is drawn **in the 3D mat's perspective** (foreshortened, on the mat) — not flattened, and not a flat figure over a perspective mat.
- **Mat angle:** **C — gentle** (a mat-on-the-floor view from standing height), eased from the steep showcase angle. Camera: `px 2.30, py 2.15, pz 9.20`, target `(-0.66, 0.12, 2.16)`.
- **Scale:** as in the validated test (she sits naturally on the mat — do not change).
- **Grounding/contact:** validated as believable in the test.

Validation: `tools/lab/lab.html` — the standing + downward-dog test renders (drawn to the C-gentle mat reference) are grounded and correct, vs the broken "before" composites.

## 3. Architecture

```
UNROLL (p0→0.22)     MORPH + EASE (p0.50→0.56)        HANDOFF (~p0.56→0.585)      POSES (p0.585→1.0)
unchanged       →    3D mesh does BOTH:           →   watercolour mesh (gentle)  →  15 on-mat illustrations
                     • photoreal→watercolour          cross-dissolves to the        cross-dissolve; each is
                       (material morph, in place)      first on-mat illustration     Cristina in the C-gentle
                     • camera eases steep→C-gentle     (they match → invisible);     perspective ON her mat;
                                                        the 3D canvas fades out      mats registered to ONE rect
```

- **The mat is the single 3D mesh through the morph** (so the transform happens in place — R1 preserved).
- **At the handoff**, the watercolour mesh (now at the gentle angle) cross-dissolves into the first figure illustration. Because every figure is drawn from a render of *this exact mesh at this exact camera*, the mats coincide → the swap is invisible.
- **During poses, only the figure illustrations show.** The 3D canvas is faded out; there is no separate floor PNG and no live mesh under the figures.

## 4. Why R1 and R2 hold

- **R1 (transform, not cross-fade):** the photoreal→watercolour change happens **in place on the one mesh** during the morph window (existing `makeMatMaterial` + `morphFor`). The subsequent handoff is mat→*identical* mat, so the viewer perceives one continuous transform, then poses begin on a mat that looks unchanged.
- **R2 (exactly one mat):** all 15 figures are generated from **one shared mat reference**, so their mats are consistent (same angle/texture). `figbake` registers each mat to **one canonical on-screen rect**, so adjacent poses' mats coincide during cross-dissolve → no doubling/shimmer. The mesh is hidden during poses, so there is never a second mat. This is the key difference from the original on-mat attempt, where each pose invented its own mat angle and registration could not align them.

## 5. Asset pipeline

1. **Canonical mat reference** = a clean render of the watercolour mesh at the C-gentle camera. Already produced: `tools/lab/assets/mat-C-gentle.png` (uploaded to Higgsfield as media `afa6bd4c-3166-4369-ad8a-4ae1e97c1d0c`). Re-render via `tools/lab-render.mjs` if the camera is retuned.
2. **Generate 15 poses** (Higgsfield `nano_banana_pro`, aspect `3:2`) on the mat reference: identity refs (portrait `0029c54c…`, stand `765be296…`, front `02230f93…`) + the mat reference as the **last** media, with the validated perspective prompt — Cristina drawn from the same elevated angle as the mat, foreshortened, on the mat, with contact shadow; keep the mat's angle/size/position identical to the reference. Pose order = the 15 `FIG_LABELS`. The two test renders (stand, dog) are reused as poses 3 and 9.
3. **Register** with `figbake` in **mat-detection mode** (the v1/v2 silhouette-registration that aligns each frame's mat to one canonical rect) — NOT the v3 mat-free extraction. This version is recoverable from git (the baseline `figbake.mjs` at the branch start, commit `1496aa9`, before the v3 rewrite). Because all mats share the C-gentle perspective now, affine registration (bottom-centre + width) aligns them tightly. Output `assets/figure/figure-1..15.png`.
4. **Back up** the current mat-free figures (`assets/figure/` → a backup dir) before overwriting.

## 6. Wiring changes (`js/home-journey.js`)

- **Camera:** ease the pose-section keyframes from the showcase angle to **C-gentle** over `p0.50→0.56`, hold `0.56→1.0`. (Edit the `frames` array entries at `p≥0.50`.)
- **Handoff:** canvas opacity stays `1` through the morph, then fades `1→0` over `~p0.56→0.585` as figure-1 fades in (re-introduce a small canvas-fade at the handoff; the mesh is not shown during poses).
- **Figure placement / registration target** (`FIG_BOX` + `figbake` `TARGET`): set so the figures' mats land exactly where the eased mesh mat sits at `p≈0.56`, for a seamless handoff.
- **Keep** the `makeMatMaterial` morph (R1), the unroll, the mood track, and the `.is-static` mobile poster.

## 7. Risks & mitigations

- **Residual cross-dissolve shimmer** between adjacent figure mats. Mitigation: registration + mats are consistent (one reference). If it still shimmers visibly, fallback to test **mat-free perspective** generation (Cristina foreshortened + contact shadow, no mat) composited over the live mesh = structurally zero doubling. (Not chosen now because on-mat is proven and mat-free perspective is untested.)
- **Identity drift across 15 generations.** Mitigation: soft identity gate ("keep her recognisable", not "exact person"); regenerate outliers.
- **Foreshortening awkwardness on some poses.** Mitigation: the gentle C angle keeps foreshortening mild; the test confirmed standing and dog both read well.

## 8. Validation gate

Lab test passed for standing + dog. Before merge: regenerate all 15, register, wire, and review the full sequence in the lab + via `tools/matshot.mjs` — confirming one mat per frame, no doubling/shimmer, grounded contact, and a seamless morph→handoff.

## 9. Out of scope / unchanged

3D unroll (`deformFor`, p0→0.22), mood/lighting track (`MOODS`/`applyMood`), hire-only copy, English-only, mobile/reduced-motion static poster, dependency-free runtime (Three.js + Playwright tooling only).
