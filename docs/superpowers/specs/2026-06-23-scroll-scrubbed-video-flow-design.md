# Scroll-Scrubbed Video Flow — Design

**Date:** 2026-06-23
**Status:** validated (motion test passed); ready for implementation plan
**Supersedes:** the cross-dissolved-stills part of `2026-06-23-perspective-matched-figures-design.md`. KEPT from that work: the camera ease + mesh handoff (Task 1, already shipped) and the 15 perspective-matched pose stills (now used as video **keyframes**).

## 1. Problem with the still-crossfade approach

Cross-dissolving 15 static pose stills had two flaws the owner caught: (1) each still's mat sits at a slightly different angle/position, so the mat **visibly jumps** during a dissolve (affine registration can't reconcile differing perspective); (2) a dissolve between static frames is a **slideshow, not motion** — the owner wants a seamless motion-picture flow.

## 2. Validated solution

**Seedance 2.0 start+end keyframe interpolation** between consecutive pose stills generates the real motion *between* them. Test clip (`tools/lab/assets/test-flow.mp4`, pose 3 stand → pose 4 arms-rise) confirmed: the hand-painted watercolour style holds, her identity holds, **the mat stays completely still** (Seedance holds one mat and animates only her), and the motion is smooth and continuous. Both endpoints being our approved stills is what anchors style+identity.

This fixes both flaws at once: one continuous video has **one stable mat**, and it is **true motion**.

## 3. Architecture

```
UNROLL (p0→0.22)   MORPH+EASE (p0.50→0.56)   HANDOFF (~p0.56→0.585)   FLOW (p0.585→1.0)
unchanged       →  mesh: photoreal→water-  →  mesh canvas fades out,  →  ONE stitched video of
                   colour + ease to gentle    video fades in (video      Cristina flowing through
                   (already shipped)          frame 0 = pose-1 on the     all 15 poses; scroll
                                              same mat → invisible)       SCRUBS its timeline
```

- **14 transition clips** (`clip-NN` = pose NN → pose NN+1), 720p, ~5s, generated via Seedance start+end keyframes.
- **Stitched into ONE continuous mp4.** Joins are seamless by construction: clip N ends on pose N+1's still and clip N+1 starts on the same still.
- **Scroll scrubs the video timeline:** `video.currentTime = clamp((p - HANDOFF)/(1 - HANDOFF)) * video.duration` over the pose range.
- **The mesh hands off to the video** (Task 1's `handoffFor` already fades the canvas; the video fades in over the same window). During the flow only the video shows — the 3D mesh is gone, the old `#figureLayer` PNG crossfade is removed.

## 4. Compositing / background

The clips render Cristina + the dark mat on a flat **warm-cream** background. Primary approach (simplest, robust): during the flow (p≈0.56→1.0) set the sticky-stage background to the **video's exact cream** (sampled from a frame) and show the video positioned over the mat region; the video's cream edges blend invisibly into the matched page cream — no keying, no hard seam. Trade-off: the mood-track background variation pauses during the flow (a calm constant cream suits the flow). Fallback if a seam still shows: a soft CSS edge-feather mask on the video, or per-frame canvas luma-key (cream→transparent) to composite over the live mood bg.

## 5. Scrub performance

Seeking a video every scroll frame is only smooth if the file has dense keyframes. Re-encode the stitched mp4 with a short GOP (e.g. `ffmpeg -g 6` or all-intra) and `+faststart`, 720p, no audio, so `currentTime` seeks are fast. `preload="auto"`, `muted`, `playsinline`. Damp the scrubbed time toward target (like the existing `current`/`target` damp) to smooth jitter.

## 6. Mobile / reduced-motion

Unchanged: `goStatic()` (mobile / `prefers-reduced-motion`) keeps the static poster, no WebGL, no video.

## 7. Risks

- **Hard transitions** (fold→dog, dog→lunge, lunge→seat): Seedance may produce slightly fluid/morphy mid-motion since the poses differ a lot. Endpoints are anchored, so the joins are safe; mid-clip oddness is the risk. Mitigation: review every clip in the lab; regenerate any bad transition (optionally via an intermediate keyframe pose). This is the QA gate before stitching.
- **Identity drift across 14 clips:** each clip is anchored by two real stills, so drift is bounded; review in the lab.
- **Scrub jank / file weight:** mitigated by dense-keyframe 720p re-encode + time damping; mobile uses the static path.
- **Cream mismatch / seam:** primary matched-cream approach; feather/luma-key fallback (§4).

## 8. Validation gate

Motion test passed. Before merge: review all 14 clips → stitch → re-encode → wire → scroll through the flow in the lab + `tools/matshot.mjs`, confirming one stable mat, true continuous motion, seamless joins, a clean handoff from the mesh, and a graceful mobile static fallback.

## 9. Out of scope / unchanged

3D unroll, mood track (pauses during the flow per §4 but otherwise intact), hire-only copy, English-only, dependency-free runtime (Three.js + Playwright/ffmpeg tooling only). The 15 pose stills and `figbake` are retained as source assets but `figbake` registration is no longer used at runtime.
