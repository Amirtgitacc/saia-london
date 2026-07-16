# Report — SAÏA home hero "Cristina flow": remaining problems

Date 2026-06-25. Branch `mat-transform-single-mat`. This is a **problem report only** —
it states the two open problems and lists everything tried so far that did **not** solve
them. It deliberately does **not** propose new solutions.

---

## What the feature is (context)

`home.html` has a pinned, scroll-scrubbed hero. After a 3D mat unrolls and morphs to
watercolour, it hands off to a **watercolour illustration of the founder Cristina** that
"flows" through 5 yoga poses (stand → reach → downward dog → low lunge → seated). It is an
**image sequence** (`assets/flow-frames/f001..f303`) drawn to a `<canvas id="flowCanvas">`,
where **scroll position picks which frame is shown**. Each pose is a "hold" (frame frozen,
section text reads); scrolling between holds steps through the in-between frames = the motion.

Two problems remain, reported below.

---

## PROBLEM 1 — A visible "border" / cut-out edge around Cristina

**What is seen:** Cristina (and her mat) look like a picture *placed on top of* the page
rather than part of it. There is a visible edge/outline around her, most noticeable in the
standing poses (the first two transitions) where there is a lot of empty space around the
figure.

**What it is, technically:** the source frames are watercolour paintings of Cristina on a
**cream paper background**. The page is a flat cream. Anything that makes the painting's
background region distinguishable from the flat page reads as a rectangular "panel" or, after
cutting the background out, as an **outline around the figure**. So the border has taken two
different forms across attempts:
- when the cream paper background was *kept*: a faint rectangle/panel (the paper's tone &
  texture differ from the flat page), with soft mask edges.
- when the background was *removed* (current state): a thin halo / hard rim around the figure
  and mat where the cut-out boundary is, i.e. it now "looks like a cut-out."

**Why it is hard:** the watercolour has **soft, painterly, semi-transparent edges** that fade
into the paper. There is no clean boundary between "figure" and "background" — so any cut
leaves either leftover cream pixels (a light halo) or eats into the soft edge (a hard rim).
Her **cream top is nearly the same colour as the cream background**, which makes separating
figure from background by colour unreliable. The figure also sits on cream **paper texture**
that is not present on the flat page.

### Tried for Problem 1 — did NOT solve it
1. **Removed `mix-blend-mode: multiply`** from the canvas and matched the page cream to the
   frame cream (earlier session). Removed an obvious dark rectangle but a panel remained.
2. **Matched the page background colour to the frame background** (`#ece8dc`). Closer, but a
   border was still visible.
3. **Per-clip background tone normalisation** (scaled each clip's colours so its background
   met `#ece8dc`). Reduced it but background tone *drifted within a clip*, so it never fully
   matched.
4. **Per-frame background tone normalisation** (measured each frame's background, scaled it to
   `#ece8dc`; backgrounds ended up uniform ~`#ebe9dc`). The tone matched to ~1 level — but the
   **paper texture** still differed from the flat page, so a faint rectangle remained.
5. **Radial mask + vertical fade** on the canvas to feather the frame edges into the page.
   Softened the rectangle's edges but could not hide the textured region in the middle, and
   risked clipping wide poses (dog/lunge).
6. **Full background removal** (current): edge flood-fill that deletes the cream paper
   (classified as bright + low-saturation), removes small enclosed pockets, and outputs
   transparent WebP so only Cristina + mat + contact shadow remain; the mask/fade were dropped.
   This removed the *panel*, but the user still reports a **border** — i.e. the cut-out edge
   itself is visible, and/or faint leftover halo remains in places. **Not solved.**

---

## PROBLEM 2 — The motion is not smooth

**What is felt:** scrolling from one pose to the next does not read as a smooth, continuous
animation. It can look stepped/juddery, and/or like a cut-out being moved rather than a
fluid drawing flowing.

**Possible contributing factors (observations, not fixes):**
- It is a **discrete image sequence** (303 frames). Smoothness depends on how many frames are
  shown per unit of scroll. When the flow was **slowed down** (the page was lengthened so each
  transition spans more scroll), the **same number of frames now covers more scroll distance**,
  so each frame is held over a longer scroll → the steps between frames become **coarser/more
  visible**, not finer. Slowing the motion and increasing per-frame smoothness pull in opposite
  directions with a fixed frame count.
- The **cut-out edge differs slightly from frame to frame** (each frame's background is removed
  independently), which can make the outline **shimmer/crawl** during motion — read as
  non-smooth.
- The in-between frames are extracted from **AI-generated video tweens** (Seedance / Kling);
  their internal motion is not perfectly even, and the **figure's size/position can wobble**
  slightly between frames.
- The scroll is **damped** (the displayed position eases toward the scroll position). Changing
  the damping changes the feel (snappier vs. floatier); the current softer setting can feel
  laggy to some.
- An automated adjacent-frame difference check reports **0 "jump-cut" outliers**, yet the user
  still perceives it as not smooth — so the **measurement does not capture what the eye sees**
  here (e.g. coarse stepping or edge shimmer are not flagged as outliers).

### Tried for Problem 2 — did NOT (fully) solve it
1. **Rebuilt the sequence so each transition is one continuous generated clip** (instead of 14
   stitched clips), with shared/chained keyframes and cross-fades at boundaries. Removed the
   hard jump-cuts (measured 14 → 0 outliers) but the result is still judged not smooth enough.
2. **Lengthened the pinned section** (`#top` 1100 → 1500 → 1800 → 2000vh) and re-weighted the
   timing so the moves take most of the scroll (each move ~25–51vh → ~135vh). Made it slower
   but, per above, coarser per-frame; still "not smooth."
3. **Softened the scroll damping** (4.5 → 3.4 → 3.0) so the motion eases out after scrolling.
   Changed the feel but did not resolve the smoothness complaint.
4. **Increased/retuned the number of extracted frames per clip** during assembly. Helped seam
   metrics but did not resolve perceived smoothness.

---

## Current state (where it stands)

- 303 transparent WebP frames (`assets/flow-frames/`, ~9.5 MB); JPG masters backed up at
  `tools/seam/flow-frames-jpg-backup`.
- Automated checks: adjacent-frame perceptual diff = **0 outliers**; structural `morphtest`
  green; the 5 poses land on their holds and stay synced to the section text.
- **User-perceived, still open:** (1) a border/cut-out edge around Cristina is still visible;
  (2) the pose-to-pose motion is still not smooth enough.
- Net: the two remaining problems are **perceptual/visual quality** issues that the current
  automated measures do not capture, on an **AI-generated watercolour image sequence with soft
  edges**, scrubbed as a **discrete frame sequence** over a long scroll.
