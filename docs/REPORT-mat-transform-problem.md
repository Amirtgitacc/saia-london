# Problem report: "mat transform" + "single mat under the figure" on SAÏA home.html

**Audience:** an AI/engineer asked to propose a solution. This is self-contained.
**Status:** two hard requirements remain UNSOLVED after several attempts (documented below).
**Constraint on credits/effort:** none — optimise for the most beautiful, correct result.

---

## 1. Context

`home.html` of the SAÏA London site is a **pinned, scroll-driven hero**. As you scroll a sticky
700vh section:

1. **p0 → 0.22** — a realistic **3D yoga mat** (a `saia-mat.glb` Three.js mesh, PBR material, lit,
   perspective camera) unrolls and is showcased from several angles. *(This part works and must
   not change.)*
2. **p ≈ 0.50 → 0.56** — the mat should **become a flat hand-painted watercolour mat** (the brand's
   illustration style).
3. **p0.56 → 1.0** — the founder **Cristina** (hand-painted watercolour figure) flows through ~15
   yoga/Pilates poses **on that one mat**, each pose cross-dissolving into the next.

Two things are broken (see screenshots the owner provided):

- **The hand-off is a cross-fade, not a transform.** It looks like one mat fades out while a
  different mat fades in (two objects), instead of the *same* mat **transforming** from realistic
  3D into watercolour in place.
- **There are two mats under the figure.** During the poses you can see a doubled mat — two
  offset outlines / two front edges — not one clean mat.

---

## 2. What we want (acceptance)

**R1 — The morph is a TRANSFORM, not a transition.**
The single mat object must appear to **continuously transform** from the realistic 3D mat into the
flat watercolour mat — same object, its geometry and/or surface style morphing in place. It must
NOT read as "object A dissolves while object B appears." A subtle watercolour "bloom" at the moment
of change is wanted, but as the finish on a real transform — not as a mask over a cross-fade.

**R2 — There is exactly ONE mat at all times.**
Through the entire pose sequence there must be a single, pixel-stable mat under Cristina. No second
mat, no doubled edges, no shimmer/jump/colour-change between poses. Her contact must be believable
(feet/hands resting on the surface, weight, soft contact shadow), including spread poses
(down-dog, lunge) which must stay fully on the mat.

Other invariants: warm female-led British brand; mat is the muted **charcoal/taupe + faint
terracotta** signature mat (NOT saturated orange); don't touch the 3D unroll (p0→0.22) or the
mood/lighting track; English-only; mat is **HIRE-ONLY** (copy, not visual).

---

## 3. Current architecture (how it works today)

DOM layers inside the sticky stage (`home.html`):

```
z1  #homeCanvas   — Three.js WebGL: the 3D mat mesh (GLB), perspective cam (FOV 34), PBR + lights
z2  #matStage     — a single DOM <img> of a flat watercolour mat PNG  (the "morph target"/"floor")
z2  #figureLayer  — 15 DOM <img> (figure-1..15.png), Cristina poses, cross-dissolved by opacity
z3  #stage        — the text bands ("For every gathering", etc.)
```

Driver: `js/home-journey.js`.
- `camAt(p)` interpolates camera keyframes; `matStageFor(p)` fades `#homeCanvas` opacity `1→0` and
  `#matStage` `0→1` over p0.50→0.56; `bloomFor(p)` adds a blur+saturate pulse on `#matStage`.
- `figures(p)` cross-dissolves the 15 figure PNGs by opacity only.

So the "morph" is literally **`#homeCanvas` opacity → 0 while `#matStage` opacity → 1`** — a
cross-fade between a WebGL render and a raster PNG.

---

## 4. What we tried — and exactly why it failed

### Attempt A (current): generate each pose ON a mat, register, layer over a "floor" mat
- **Assets.** A single "hero mat" watercolour PNG (`assets/figure/mat-stage.png`) was generated
  (Higgsfield `nano_banana_pro`). Then all 15 poses were generated with Cristina **on** that mat
  (the hero mat fed as a locked reference), so contact/shadow are real and spread poses are
  contained. *(This part looks good in isolation.)*
- **Registration.** A build tool (`tools/figbake.mjs`) detects each frame's mat by its silhouette
  against the cream background and **translates + uniformly scales the whole frame** so the mat's
  *bottom-centre* and *width* land on one canonical rect. Output: `figure-1..15.png`, plus a
  registered empty hero mat `mat-stage-baked.png`.
- **Compositing.** `#matStage` (the registered empty mat) is held at **opacity 1 as a "solid mat
  floor"** for the whole pose section, and the 15 figures (each carrying its own baked mat)
  cross-dissolve on top. Idea: the floor keeps the mat from dimming during cross-dissolves.

**Why R2 fails (two mats — see pose screenshot).** Each generated pose drew its mat at a slightly
**different 3/4 angle / perspective**. `figbake` only corrects **2 DOF** (translate + uniform
scale via bottom-centre + width). It does **not** correct rotation or perspective. So every
figure's baked mat sits at a subtly different angle than the fixed `#matStage` floor → when layered
you get **two offset mat outlines** (doubled front edge, doubled side, two SAÏA marks). The "floor"
I added to stop dimming is itself the visible second mat.

**Why R1 fails (still a transition).** The hand-off is unchanged: a WebGL render cross-fading to a
PNG. Even with the bloom blur, it's two distinct images dissolving — a transition, not a transform.

### Attempt A.1: camera tuning to align the 3D mat to the watercolour PNG
- Retuned the perspective camera at p0.50 so the 3D mat's screen footprint approaches the PNG's.
- **Result:** they overlap more, but the **3D mat is a perspective render and the PNG is a flat
  painting at a fixed projection** — their silhouettes differ in rotation/perspective, which an
  affine camera nudge can't reconcile. A cross-fade of two non-identical silhouettes always reads
  as two shapes. (This is the morph screenshot: blurry mat over a differently-angled mat.)

### Earlier (pre-this-report) approach that was abandoned
- Figures were **mat-free** cutouts over a **single** fixed flat mat PNG (`#matStage`). That gave
  ONE mat (good for R2-ish) but: (a) her feet landed on the mat's front lip → she read as standing
  *in front of* the mat, and (b) spread poses overflowed the fixed mat. That's why we switched to
  "generate her ON the mat" — which then created the doubled-mat problem above.

**Net:** we've oscillated between "one mat but bad/contactless" and "good contact but two mats,"
and the hand-off has never been a true transform.

---

## 5. Root-cause summary (the crux for a solver)

1. **A cross-fade between two different renderers/images is fundamentally a transition.** Achieving
   a *transform* requires the *same surface* to change continuously (geometry morph and/or
   style/material morph), or a genuine image-morph (warp + dissolve) between two **geometrically
   identical** silhouettes.

2. **The 3D mat (perspective mesh) and the watercolour mat (flat painting) do not share a
   silhouette,** and can't be made to via affine camera/transform tweaks. Any solution must make
   them share geometry at the transition instant (e.g. project the painting onto the mesh, or warp
   one to the other, or render the watercolour from the same camera).

3. **Per-pose generated mats are not geometrically identical,** so layering them (or layering them
   over a fixed floor) yields doubled mats. Either (a) the figures must contribute **no mat** and a
   single shared mat must serve every pose with correct per-pose contact, or (b) each pose's mat
   must be registered with a **full homography (4-point/perspective)**, not affine, so they truly
   coincide — and then NO separate floor is layered.

---

## 6. Directions considered (NOT yet validated — each has an open blocker)

These are starting points to evaluate/disprove, not answers.

| Direction | Idea | Open blocker to solve |
|---|---|---|
| **D1 — One 3D mesh throughout; morph its material** | Keep the mat as the Three.js mesh for the whole journey. Transition its **texture/shader** from photoreal → a watercolour texture (the painting projected onto the mesh) and flatten the lighting, so the *same mesh* "becomes" watercolour in place. True transform, one object. | Cristina is 2D art. Her feet/hands must sit on a **3D perspective** mat surface for 15 poses. How do 2D watercolour figures align to a moving/parallaxed 3D mat? (Maybe the camera is locked still during poses so the mesh is effectively a fixed 2D projection she can be placed on.) |
| **D2 — Homography registration, drop the floor** | Bake the mat into figures (current good contact), but register each with a **4-point perspective homography** so all 15 mats are pixel-identical; show figures only (no separate floor). Identical coincident mats → no doubled edge; cross-dissolve of identical mats → no dimming. | Need a robust 4-corner mat detector per pose (corners are occluded by the figure and the mat is hand-painted/irregular). Plus: does perspective-warping each frame distort Cristina unacceptably? |
| **D3 — Mat-free figures + one shared mat with per-pose contact** | Generate Cristina **without** a mat (just body + correct contact shadow), composite over ONE shared mat. One mat guaranteed. | Her contact (feet/hands pressing in, shadow) must match the single shared mat's exact surface/orientation for every pose, incl. spread poses — i.e. generate her to a fixed mat geometry, or warp the shared mat per pose. This is what failed before (looked pasted / off the mat). |
| **D4 — Image-morph the hand-off** | At the instant of change, geometrically align the 3D-mat render and the watercolour image to the **same silhouette**, then mesh-warp + dissolve (e.g. a displacement/"paint blooming over the surface" effect) so it reads as one surface restyling. | Requires the painting generated to **exactly** the 3D mat's final projected shape (generate-to-camera), and a warp/dissolve shader. Tooling? |
| **D5 — Render the whole sequence in 3D** | Project each watercolour pose (incl. Cristina) as a texture/billboard onto the 3D mat plane so everything shares one camera/geometry; the mat is always the one mesh. | How to keep the hand-painted look while 3D-projecting figures; per-pose billboards on a tilted plane may distort. |

A solver should feel free to propose something not listed.

---

## 7. Asset pipeline facts (so a solver knows what's cheap to regenerate)

- **Image generation:** Higgsfield MCP, model `nano_banana_pro`. Figures use locked face/stand
  reference images + soft identity phrasing ("keep her recognisable…"; emphatic "THIS EXACT
  person" makes jobs stall). Mats/poses are cheap to regenerate at will (credits not a constraint).
- **Hero mat recipe:** `nano_banana_pro`, no ref photos, "single flat yoga mat, gentle 3/4
  perspective, muted charcoal-grey + warm taupe, faint terracotta, understated not orange, SAÏA
  wordmark" → background removal → autocrop.
- **Pose recipe:** figure refs + hero mat as a locked reference + "she is posed ON the exact mat in
  the last reference … whole mat visible, plain cream background, contact shadow," aspect 4:3, 2k.
- **No 2D-image build deps available** beyond **Playwright** (used as a headless Canvas for pixel
  work in `figbake.mjs`). Front end is otherwise **dependency-free** (vanilla JS + Three.js via
  global). Any new pipeline should avoid heavy native deps or justify them.

---

## 8. Constraints / invariants

- Don't touch the 3D unroll (p0→0.22) or the mood/lighting track.
- Mat = muted charcoal/taupe + faint terracotta (never saturated orange; clashes with her
  terracotta leggings). Palette: cream `#F5F1E8`, ink `#2B2620`, terracotta `#B8624A`.
- Mobile / `prefers-reduced-motion` falls back to a static poster (no WebGL) — solution must
  degrade gracefully.
- Solo developer, self-taught; prefers getting it working and looking good. Credits/compute not a
  constraint.

---

## 9. Key files

- `home.html` — the sticky stage + the layers (`#homeCanvas`, `#matStage`, `#figureLayer`, `#stage`).
- `js/home-journey.js` — the whole scroll engine: 3D mat deform/unroll, camera keyframes, mood
  track, `matStageFor`/`bloomFor` (the cross-fade "morph"), `figures()` (pose cross-dissolve), and
  a `window.SAIA._rig.at(p)` debug hook used by the render harnesses.
- `assets/figure/figure-1..15.png` — the 15 baked pose figures (currently each with its own mat).
- `assets/figure/mat-stage.png` / `mat-stage-baked.png` — the watercolour hero mat (raw / registered).
- `assets/saia-mat.glb`, `assets/saia-mat-texture.png` — the 3D mat mesh + texture.
- `tools/figbake.mjs` — the (affine-only) registration build tool described in §4.
- `tools/matshot.mjs` — headless render of morph + pose frames via `_rig.at(p)` (verification).
- `tools/morphcheck.mjs` — renders the 3D mat and the watercolour mat **separately** at the morph
  point (for alignment debugging).
- `docs/superpowers/specs/2026-06-22-mat-morph-and-on-mat-figures-design.md` — the (now-insufficient)
  design that produced the current approach.

---

## 10. The single sentence to solve

> Make the realistic 3D mat **transform** (not cross-fade) into the flat watercolour mat in place,
> and have **exactly one** mat under Cristina for all 15 poses with believable per-pose contact —
> given that the 3D mat is a perspective mesh, the watercolour mats are flat paintings at differing
> per-pose geometry, and the front end is essentially dependency-free (Three.js + Playwright only).
