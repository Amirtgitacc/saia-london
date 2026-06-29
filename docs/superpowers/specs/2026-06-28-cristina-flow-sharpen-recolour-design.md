# Cristina flow — sharpen + recolour (one final render pass)

**Date:** 2026-06-28
**Branch target:** new branch off current work
**Status:** design approved (lab + colour pick done); ready for implementation plan

## Goal

The home.html pinned watercolour journey of Cristina looks (1) not sharp and (2) not smooth,
and the outfit colour should change. Fix all three in **one** Higgsfield render pass — spend as
little credit as possible by combining them, and never spend twice.

## Diagnosis (why it's soft) — confirmed

The artwork is fine; softness is downstream of generation:

```
Kling rendered at mode "std" (~720p)   ← the resolution ceiling
   → frames normalized to 1104×756      ← both live webp AND jpg "masters" are 1104px
   → WebP quality 0.82 (lossy)
   → displayed full-bleed on a retina hero → browser upscales ~2× → soft
```

The single biggest lever is **Kling mode**: every clip was `std`. Kling 3.0 also offers `pro`
and `4k`. Moving to `pro` is the real detail win.

## Decisions locked

| Decision | Choice |
|---|---|
| Path | One re-render of the 4 clips at Kling 3.0 **`pro`** mode (not `std`) |
| Outfit | **Charcoal · graphite** — deep ink cami crop top + lighter graphite/slate leggings |
| Recolour method | Colour-only `nano_banana_pro` edit on the 5 keyframes (no pose/face/hair drift) |
| Working resolution | Raise normalize target ~1.4–1.5× (≈1550–1656 px wide) so retina stops upscaling |
| WebP quality | 0.82 → **0.90** |
| Smoothness | Denser frame subsample in assemble + existing JS fractional blending |
| Page weight | **No preloader** — rely on existing progressive load (eager 0–24, idle-batch rest) + nearest-frame fallback; keep frame weight modest via the levers below |
| Matte config | Known-good: `FEATHER=5`, `MEDIAN` off, `DECON` off |

Outfit proof already generated and reviewed in `tools/lab/outfit-lab.html` (6 colourways on the
seated keyframe). Charcoal·graphite chosen because its legs separate cleanly from the dark mat
even in the worst-case seated frame.

## Pipeline (reuses existing tools/seam tooling — no new generators)

1. **Recolour the 5 keyframes** — `nano_banana_pro` colour-only edit on each of
   `tools/seam/anchors-soul/KEY-{stand,reach,dog,lunge,seated}.png` (or the FINAL-* sources,
   then re-normalize to KEY). Prompt: "change ONLY the outfit colour → deep ink top + graphite
   leggings; keep face, pose, hair, mat, background identical." ~5 cheap image gens.
   - **Identity gate:** verify each recoloured keyframe still reads as Cristina before rendering.

2. **Re-render the 4 clips** — `kling3_0`, **`mode:"pro"`**, `sound:"off"`, all-Kling, chained
   keyframes (each clip's start = previous clip's actual last extracted frame, end = next clean
   anchor). Clips: stand→reach, reach→dog, dog→lunge, lunge→seated. All-Kling = 0-outlier recipe.
   - **Credit gate:** call `generate_video` with `get_cost` (or render clip 1 only) to confirm the
     `pro` per-clip cost BEFORE firing all four. Budget against 194 credits. Stop and report if a
     single clip is unexpectedly expensive.

3. **Re-assemble** — `tools/seam/assemble.mjs`: extract → normalize at the new ~1.5× target →
   denser even-subsample (more frames for smoother motion) → concatenate dropping each later
   clip's first frame → insert ~8 crossfade frames at boundaries. Emits anchor indices +
   FLOW_COUNT.

4. **Cutout** — `tools/seam/cutout.mjs` with WebP quality 0.82→0.90, `FEATHER=5`, `MEDIAN` off,
   `DECON` off. Outputs `assets/flow-frames/fNNN.webp`.

5. **No preloader** — page loads straight into the journey. The existing `initFlowFrames` already
   eager-loads frames 0–24 (entrance + Level-1 hold) and idle-batches the rest; `drawFlowFrame`
   walks to the nearest decoded neighbour if a frame isn't ready, so scrolling ahead of the load
   degrades gracefully. Keep total frame weight modest so streaming keeps up (see levers below).

6. **Wire + verify**
   - Update `window.SAIA_ASSETS.flowFrameCount` in **home.html** (the known gotcha — it overrides
     the JS default and silently caps loading).
   - Update anchor indices in `js/home-journey.js` (`A_STAND/A_REACH/A_DOG/A_LUNGE/A_SEATED`,
     `FLOW_STOPS`) only if assemble reports different indices.
   - `node tools/morphtest.mjs` (structural, exit 0)
   - `node tools/seam/flowdiff.mjs` — **gate: 0 outliers**
   - `node tools/seam/faces.mjs` — identity holds (still Cristina, charcoal outfit)
   - `_rig.at(p)` real-page screenshots: confirm sharpness improved AND graphite legs separate
     from the mat in the seated frame; confirm preloader → journey hand-off is clean.
   - Measure final `assets/flow-frames/` total size; if it pushes the hero too heavy, dial the
     resolution (1.5×→1.3×) and/or WebP quality down and re-cutout (no re-render needed).

## Resolution vs page weight (the trade-off, explicit)

Current sequence ≈ 10.6 MB at 1104px. At ~1.5× + WebP 0.90 it will grow (rough est ~18–24 MB).
Levers, cheapest first (none require re-rendering video):
- WebP quality 0.90 → 0.86
- Resolution target 1.5× → 1.3×
- Frame count (subsample density) — trades smoothness back
No preloader: the existing eager-load + idle-batch + nearest-frame fallback covers in-flight
loading, so keeping weight modest is what matters (target staying close to today's ~10–15 MB feel).

## Credits

Balance: **194** (Plus). This pass = ~5 `nano_banana` keyframe edits + 4 Kling `pro` clips.
Preflight the `pro` clip cost before committing all four. This is the "one last time" — do not
re-render again for sharpness or colour separately.

## Risks / mitigations

| Risk | Mitigation |
|---|---|
| `pro` cost higher than expected | Preflight cost / render clip 1 first, confirm against budget |
| Recolour drifts face/pose | Colour-only edit is the safest possible; identity-gate each keyframe |
| Charcoal legs merge with mat (seated) | Graphite (lighter) leggings — already proven in the lab |
| Higher-res frames hitch on scroll | Keep weight modest; existing eager-load + idle-batch + nearest-frame fallback covers in-flight loading |
| Page too heavy | Resolution/quality/frame-count levers, re-cutout only (no re-render) |
| Seam ghosting between clips | Keep all-Kling + chained keyframes (the 0-outlier recipe) |

## Out of scope

- No garment **shape** change (colour only).
- No change to the mat material morph, hire road, estimator, or concierge.
- Route B (live Addison Lee API) and payment wiring remain parked.
