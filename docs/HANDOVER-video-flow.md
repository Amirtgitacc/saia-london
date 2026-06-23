# Handover — SAÏA home hero: scroll-scrubbed video flow

Paste this into a new chat to continue. It is self-contained.

## What you're working on
SAÏA London static site (`/Users/at/Projects/site 2`). The `home.html` hero is a pinned, scroll-driven 3D yoga mat. Goal of THIS work: after the mat unrolls and morphs to watercolour, the founder **Cristina** should flow through ~15 yoga poses **on the mat** as a seamless motion-picture, not a slideshow.

We went through several approaches (cross-dissolved stills caused a "mat jumps between poses" problem). The **validated, chosen** solution is a **scroll-scrubbed video flow**: one continuous watercolour video of Cristina flowing through all poses, with `video.currentTime` driven by scroll. The owner has seen it in the lab and approved ("pretty good").

## Current status
- **Branch:** `mat-transform-single-mat` (off `main`). HEAD `cacbd9a`. Repo IS git (was `git init`'d this work; `main` is the untouched baseline). `.env` + `node_modules` are gitignored.
- **DONE & committed:**
  - Mat material morph photoreal→watercolour in place (R1). `js/mat-core.js` `makeMatMaterial`, driven by `morphFor(p)`.
  - Camera **eases** from the steep showcase angle to a gentle "C" angle during the morph (p0.50→0.56), then the 3D mesh **hands off** (canvas fades via `handoffFor(p)`) — `js/home-journey.js` (commit `69986f5`).
  - 15 perspective-matched pose **stills** drawn ON the gentle mat: `tools/figsrc/onmat-01..15.png` (these are the video KEYFRAMES).
  - 14 **transition clips** (Seedance 2.0 keyframe interp, poseN→N+1): `tools/lab/assets/clips/clip-01..14.mp4`. All 14 reviewed — clean, no regen needed.
  - **Stitched flow:** `assets/flow.mp4` (70.6s, 1112×834, dense keyframes for scrubbing, ~30MB).
  - Lab page: `tools/lab/lab.html` (serves the flow + the 15 keyframes + before/after) at `http://localhost:8000/tools/lab/lab.html`.
- **NEXT — not started:** wire the video into the page. Follow the plan:
  - **Plan:** `docs/superpowers/plans/2026-06-23-scroll-scrubbed-video-flow.md` — Tasks **V3** (wire scrub + handoff fade-in + retire the old `#figureLayer` PNG crossfade + match page cream) and **V4** (placement/seam tune + acceptance + mobile). The plan has exact code.
  - **Spec:** `docs/superpowers/specs/2026-06-23-scroll-scrubbed-video-flow-design.md`.
  - **Progress ledger:** `.superpowers/sdd/progress.md`.

## Architecture (target)
```
UNROLL (p0→0.22)   MORPH+EASE (p0.50→0.56)        HANDOFF (~p0.56→0.585)   FLOW (p0.585→1.0)
unchanged       →  mesh: photoreal→watercolour  →  mesh canvas fades out,  →  assets/flow.mp4 SCRUBBED:
                   + ease to C-gentle (DONE)        video fades in            video.currentTime =
                                                    (handoffFor already        flowFor(p) * duration
                                                     fades the canvas)         (one stable mat, true motion)
```
The flow video's first frame = pose-1 on the same gentle mat, so the mesh→video handoff is invisible. During the flow only the video shows; the 3D mesh is gone and the old 15-PNG `#figureLayer` crossfade is retired (display:none on the WebGL path; keep it for the `.is-static` mobile poster).

## How to run / verify
```bash
cd "/Users/at/Projects/site 2"
npm install              # if needed
python3 -m http.server 8000   # serves the site + lab; open http://localhost:8000/home.html
node tools/morphtest.mjs      # structural checks (morph 0→1, canvas opaque@0.55, faded@0.80) — must stay green
node tools/matshot.mjs        # screenshots → tools/matshot/*.png
```
- Desktop only for the WebGL/video; mobile + `prefers-reduced-motion` use `goStatic()` (static poster) — keep that working.
- `ffmpeg` is installed (used to stitch/re-encode).

## Key constants / IDs (needed if regenerating)
- **C-gentle camera (exact):** position `px2.30, py2.15, pz9.20`, lookAt `(-0.66, 0.12, 2.16)`. The live pose-section `frames` use this; the mat reference + stills were drawn from it.
- **FLOWCREAM (video bg, for the page cream match in V3):** `#f2ede4` (rgb 242,237,228).
- **Higgsfield (MCP, connected in-session; ~668 credits, plus plan, max 6 concurrent video jobs):**
  - Identity refs (role image, this order): portrait `0029c54c-354d-47f8-a79f-95bb8c49cfd9`, stand `765be296-a4f1-4ac4-95c6-f755f236ebaa`, front `02230f93-c9ce-4fc6-a891-66a91e62d3a4`.
  - Mat reference (C-gentle render): `afa6bd4c-3166-4369-ad8a-4ae1e97c1d0c`.
  - 15 keyframe still media_ids: in `.superpowers/sdd/clipgen-report.md`.
  - Models: stills = `nano_banana_pro`; clips = `seedance_2_0` (start_image + end_image keyframe interp, 720p, duration 5, generate_audio false). Cost ≈ 45 credits/clip.
- **Debug rig** (`window.SAIA._rig` in `home-journey.js`): `at(p)` renders the exact scroll frame; `shotMorph(d,morph,px,py,pz,tx,ty,tz)` renders mat at a camera with the watercolour morph; `matSilhouette()` is specced (pixel-accurate mat bbox) if needed.

## Important context / pitfalls
- Keep `makeMatMaterial` morph (R1) and the camera ease/handoff — they're shipped and correct.
- `tools/figbake.mjs` is currently the restored **mat-detection** version, but it's **no longer used at runtime** for the video approach (it was for the abandoned still-registration path). Ignore unless you revert to stills.
- `assets/figure/figure-1..15.png` are the OLD mat-free stills (from an abandoned approach) — the video replaces them; V3 just hides `#figureLayer`. Don't spend time on them.
- **Scrub headless capture:** `_rig.at()` sets `video.currentTime`, but a headless browser may not have decoded that time before screenshot — `tools/matshot.mjs` may need a `waitForTimeout(250)` after seeking (noted in plan V3 Step 5). If headless video frames stay blank, fall back to live-page review in the lab.
- Scrub smoothness: `flow.mp4` was encoded with dense keyframes (`-g 6`); damp `currentTime` toward target in the rAF loop if it jitters (plan V4 Step 2).
- Commits are per-task, scoped `git add <files>` (never `-A`), messages end with the Co-Authored-By trailer. Do NOT merge to `main` without asking.

## Resolved/open
- **Mat "breathing":** in the flow the mat gradually changes size (smaller standing, larger seated) — it never JUMPS (the old bug), it drifts smoothly. Owner reviewed and is OK with it ("pretty good"). Option if ever wanted: regenerate clips with stronger "mat fixed size/position" prompting. Treat as accepted unless the owner revisits.
- Final integration (V3/V4) is the remaining work, then a whole-branch review + ask the owner before merging to `main`.

## First action in the new chat
Read the plan `docs/superpowers/plans/2026-06-23-scroll-scrubbed-video-flow.md`, confirm `python3 -m http.server 8000` is running, then execute **Task V3** (subagent-driven or inline). The flow video already exists at `assets/flow.mp4` — V3 is pure wiring.
