# Reports — flow pacing, background, and the "level by level" idea

Date 2026-06-24. Branch `mat-transform-single-mat`. These are discussion documents — **no code changed.**

---

## REPORT 1 — Problems & causes

### P1. The background snaps from warm to pale when Cristina appears
As you scroll, the studio **warms up** (cream → tan/gold) through the "gathering/club" beats, then the
moment Cristina fades in it **jumps** to a pale cream.

**Cause — a hard cut, not a transition.** In `applyMood()` the warm mood track runs:

| p | background |
|---|---|
| 0.51 | `#EBDCBF` (warm glow) |
| 0.55 | ~`#E9D8B8` (warmer) |
| **0.556** | **`#ece8dc` — hard override** |

There's a single line: `if (p >= 0.556) bg = '#ece8dc'`. It **steps** straight from the warm tan to a
flat pale cream at one scroll point. Nothing eases between them, so it reads as a sudden colour change
exactly when she fades in.

### P2. The flow feels inconsistent right at the start
Likely a combination (to be pinned down when we fix it):
- **Frame-load timing** — if the 150 frames haven't finished loading when you reach the flow, the
  drawer falls back to the *nearest loaded* frame, so the first poses can stutter or stick.
- **The entrance is compressed** — frame 1 is a *walk-in* (mid-stride), and it resolves to standing
  over very little scroll, so the "arrival" feels abrupt rather than settled.
- **Damped scroll + integer frame rounding** — the first few frames can step unevenly.

### P3. The flow is too fast — poses flash past, no sense of motion
**Cause — the whole 70-second flow is crammed into ~3 screen-heights of scroll, linearly.**

| | value |
|---|---|
| pinned section height | 700vh |
| flow occupies | p0.576 → 1.0 = **~3 screens** |
| frames in that span | **150** (15 poses, 14 transitions) |
| mapping | **linear** — every bit of scroll advances frames at the same rate |

So one normal scroll gesture rips through many frames/poses. There are **no "hold" zones** (nothing
pauses on a pose) and the **text is not synced to the poses**, so it never feels like "watch this pose,
read this, move on."

---

## REPORT 2 — Potential solutions

### For P1 (background) — ease the warm out instead of cutting
Replace the hard override with a **smooth blend** from the warm mood into the flow cream over a range
(e.g. p0.50 → p0.64), or redefine the late mood stops so they ease warm → cream gradually. Result: the
warmth **fades out** continuously; no snap. Small, low-risk change.

### For P3 (pacing) — the "level by level" idea. Three ways to build it

**Option A — Stepped scrub (recommended).** Keep one pinned section, but map scroll → frames
**non-linearly** as alternating zones:

```
scroll ─►  [ HOLD pose 1 ]  [ TRANSITION 1→2 ]  [ HOLD pose 2 ]  [ TRANSITION 2→3 ]  ...
            frame fixed,      frames advance       frame fixed,     frames advance
            text 1 shown      slowly (motion)      text 2 shown     slowly
```
- During a **hold**, the frame stays on a pose and its **text is shown** — you read.
- During a **transition**, scroll slowly plays the pose-to-pose motion — you *see* the movement.
- Feels exactly like "scroll → pose + text (level 1) → scroll → slow motion → next pose + text (level 2)."
- We lengthen the pinned section so each transition has room to be slow and smooth.

**Option B — Scroll-snap sections.** Each pose is a full-height snap stop; the transition plays as you
move between stops. More literally "levels," but snap + scrubbed animation tends to feel laggy/fighting
the user; harder to get buttery.

**Option C — Just slow it down globally.** Stretch the flow across much more scroll (taller section).
Simplest; fixes "too fast" but **not** the per-pose text pairing or the hold/read rhythm.

→ **Recommendation: Option A.** It delivers the level-by-level rhythm, keeps the smooth scrub we just
fixed, and avoids snap jank.

### For P2 (start inconsistency) — mostly folds into A
- **Preload eagerly** (decode frames ahead) so the flow is ready before you arrive.
- Give the **entrance its own slow hold** (walk-in → settle into standing) as "level 1."
- Once stepped zones exist, the integer-rounding stutter disappears (holds are flat, transitions are paced).

---

## Open questions (need your answers to write the build plan)

1. **How many levels?** All 15 poses as steps, or a curated ~6–7 key poses (the rest just provide
   smooth in-between motion)?
2. **Scroll feel:** smooth free-scroll with paced motion + holds (Option A), or hard snap to each level
   (Option B)?
3. **Text per level:** reuse the existing brand copy (Hire / Events / Club / Pilates / Join), or write a
   short new line per pose?
4. **Page length:** OK for the hero to become much taller (more scrolling) so each pose can move slowly?
