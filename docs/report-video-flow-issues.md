# Report — why the watercolour flow looks wrong, and how to fix it

Date: 2026-06-23. Branch `mat-transform-single-mat`.

Two separate problems were reported after wiring the scroll-scrubbed video:

1. **"Christina isn't moving — it looks like a static PNG."**
2. **"The mat should *become* the mat under her feet"** — i.e. during the photoreal→watercolour
   morph the 3D mat should move/align to where the video's mat is, then hand off, so the mat feels
   continuous instead of fading out and a differently-placed figure appearing.

---

## Part 1 — Why it looks like a frozen PNG (root cause, evidenced)

The HTML5 `<video>` + `currentTime` scrubbing approach is failing on the live page. I instrumented it
and found **three compounding causes**:

### 1a. The dev server ignores HTTP range requests
```
curl -H "Range: bytes=0-1023" .../assets/flow.mp4
→ HTTP/1.0 200 OK          (NOT 206 Partial Content)
→ Content-Length: 29628419 (the whole 29 MB; no Accept-Ranges, no Content-Range)
```
`python3 -m http.server` (SimpleHTTP) does **not** support range requests. A browser can only *seek* a
video by asking for byte ranges. With no range support it must download the entire 29 MB linearly, and
cannot jump to an arbitrary time until that download finishes.

### 1b. Seeks don't land — even inside the buffered region
Scrubbing immediately (as a user does when scrolling), every seek failed:

| requested time | actual currentTime | buffered to | readyState |
|---|---|---|---|
| 2s  | **0** | 14.4s | 1 |
| 12s | **0** | 14.4s | 1 |
| 25s | **0** | 14.4s | 1 |
| 40s | **0** | 14.4s | 1 |
| 55s | **0** | 14.4s | 1 |
| 65s | **0** | 14.4s | 1 |

`readyState: 1` = `HAVE_METADATA` (dimensions/duration only, **no decoded frame to display**). Setting
`currentTime` never produces a `seeked` event, so the element stays on frame 0 forever → **a frozen
PNG**. Note it failed even seeking to 2s, which is *inside* the 14.4s buffered — because a never-played,
paused video has no decoded "current frame".

### 1c. A paused video stops buffering at ~14s
`preload="auto"` only pulled ~14.4s and stalled there; it never reached the full 70.6s. Browsers
throttle preload for media that is never played. So the far poses (downward dog, seated, etc.) are
*never even downloaded*, let alone seekable.

### Why the screenshots looked fine but the live page doesn't
My verification screenshots waited for a `seeked` event (up to 450ms) per frame and ran on a fast
headless pass, so individual frames eventually decoded. A real user scrolling continuously gives the
video no time to seek/decode → it sticks on frame 0.

### The uncomfortable truth
Even if we fix the server (range support) and force buffering, **scrubbing a 70 s H.264 clip by
`currentTime` every animation frame is decode-heavy and janky** — it is not a smooth, "buttery"
interaction. Long scroll-scrubbed sites almost never use a real `<video>` for this reason.

---

## Part 2 — Why the mat handoff feels discontinuous

Measured screen positions at the handoff (1880×975):

| | mat centre Y | mat width |
|---|---|---|
| 3D mesh mat @ p0.56 | ~454px (upper-mid) | ~475px |
| Video's mat (under her feet) | ~748px (lower) | ~643px |

A **standing** figure needs her mat low on screen (room for the body above). The **empty** 3D mat sits
high. They occupy different places, so:
- The current "cream-wash" hides the mismatch by blanking to cream between them — but that is a
  *cover-up*, not the continuity you asked for. The mat appears to teleport across the wash.
- What you want: the 3D mat, as it turns watercolour, should **travel/reorient to where her mat will
  be**, so the same mat that unrolled is the one she stands on. That requires *animating the 3D mat
  (camera or transform) to the target*, not just cross-fading.

These two problems are **coupled**: fixing the "frozen" problem may change the rendering medium (video
vs. image frames), and that choice changes how we can align the mat.

---

## Solution options

### Option A — Image-sequence scrubbing (recommended)
Replace the `<video>` with a **preloaded sequence of stills** (e.g. 120–180 frames) drawn to a
`<canvas>`/`<img>` by scroll position. This is the technique real "scroll-video" sites use (Apple, etc.).

| | |
|---|---|
| Fixes "frozen PNG" | ✅ Completely. Each scroll position = one guaranteed-decoded image. Smooth both directions. |
| Server/range issues | ✅ Gone — plain images, work on any host. |
| Smoothness | ✅ Buttery; no decode/seek stalls. |
| Mat alignment | ✅ We control every frame + can freely transform/position the image, and animate the 3D mat to frame-0's mat. |
| Cost | We already have the 14 transition clips + 15 keyframes → extract frames with ffmpeg (no new generation). Total bytes can be *smaller* than 29 MB as compressed webp/jpeg. Need a preloader. |
| Effort | Medium. New scrubber + a preload step; retire the video element. |

### Option B — Autoplay watercolour reveal (simplest, drops scroll-scrub)
When the morph completes, the mesh fades and the video **plays once** (real motion), instead of being
scrubbed.

| | |
|---|---|
| Fixes "frozen PNG" | ✅ It literally plays — undeniable motion. |
| Server/range issues | ✅ Sequential playback doesn't need seeking. |
| Smoothness | ✅ Native playback is smooth. |
| Mat alignment | ⚠️ We can position it, but the flow is no longer "controlled by scroll." |
| Trade-off | Loses the scroll-driven interactivity. Pin the section and let her flow play as a short film. |
| Effort | Low. Position + play()/pause() on enter; remove the scrub. |

### Option C — Fix the video scrub in place (keep current asset)
Serve with a range-capable server, force-buffer by briefly playing muted, shrink/shorten the clip,
and animate the mesh mat to align.

| | |
|---|---|
| Fixes "frozen PNG" | ⚠️ Partially. Needs prod host with range support + a buffering hack; still decode-janky. |
| Smoothness | ❌ Long-video `currentTime` scrub remains stuttery; hard to make "professional". |
| Mat alignment | ✅ Same camera-animation work as A/B. |
| Effort | Medium, and fragile across environments. **Not recommended.** |

### Option D — Your "mat rolls up → becomes Christina" single hero film
One pre-rendered video from unroll through the whole flow.
**You said not now** — noted. (It is the most cinematic but loses the 3D interactivity and needs heavy
regeneration.) Parked.

### The mat-alignment fix (applies on top of A, B, or C)
Animate the 3D mat during the morph so it **lands exactly where her mat will be** before the crossfade:
- Keyframe the camera (or the mat group) from the current C-gentle pose to one whose rendered mat
  matches the target mat rect (we have `_rig.matRect()` to measure and tune this precisely).
- Then a short *in-place* crossfade (no cream blanking) — the same mat simply gains a figure.

---

## Recommendation

**Option A (image-sequence scrubbing) + the mat-alignment fix.** It is the only path that makes the
scrub genuinely smooth and robust on any host, keeps the scroll-driven interaction you designed, and
gives us frame-level control to make the 3D mat truly become the mat under her feet.

If you want the fastest path to "it moves and looks clean" and are willing to give up scroll-control of
the flow, **Option B** is much less work.
