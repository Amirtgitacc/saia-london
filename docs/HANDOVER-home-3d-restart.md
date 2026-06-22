# Handover: SAÏA London — Home "scroll-driven 3D" redesign (RESTART)

## TL;DR
Two workstreams: **(1) DESIGN — active**, **(2) AI CONCIERGE — done, parked**.
We're on DESIGN. The first attempt at making **Home (`home.html`) "mostly 3D"** was built and
**rejected** — it bolted a 3D hero onto an otherwise-flat page. This handover restarts it the
right way: rebuild Home as **one continuous, pinned, scroll-driven 3D journey** (the pattern that
already works on `index.html` / `js/journey.js`), but light/editorial and **mat-hire-first**.

Repo: `~/Projects/site 2` (NOT a git repo). Static, dependency-free front end.
Run: `cd "site 2" && python3 -m http.server 8000` → http://localhost:8000/home.html
(The page `fetch()`es the `.glb`, so a static server is required — `file://` won't work.)

---

## The problem (diagnosed from the user's screenshots + words)
The hero is a 230vh sticky block. The mat unrolls inside it — then the pin releases and **the
open mat scrolls up and out into empty cream space**, while the rest of `home.html` is the OLD
flat editorial sections, disconnected from the 3D. Result:
- You never get to **dwell on / see the open mat**.
- The mat does **not carry you through the site** revealing new info as it transforms.
- Mid-scroll the dark mat sits **behind the headline with poor contrast** (text/mat fight).
- Minor: the **SAÏA logo on the mat renders mirrored**; mat is slightly **oversized / runs off
  the right edge**.

The 3D itself is fine (renders, unrolls, light studio reads well). The **scroll/pin architecture
is the failure.**

## What the user actually wants
> "As we roll down, the mat keeps opening, and then we get new information, and then maybe it
> rolls another way and we get more information — we go through the site in this 3D thing."

A **single pinned 3D scene** for Home: scroll progress drives a continuous mat performance
(unroll → lie open → rotate → roll → …) and **content bands reveal at successive scroll ranges**.
One scene, the whole page. Think `index.html` (the Journey) — but light cream editorial studio,
real copy, mat-hire as priority #1.

---

## The fix — correct architecture (copy the Journey)
`js/journey.js` + `index.html` are the **working blueprint**. Port that pattern to Home:
- One tall scroll wrapper `#top` (e.g. **600–900vh**) with a **sticky full-viewport `<canvas>`**
  pinned for the entire journey.
- A damped scroll progress `p` (0..1) drives, every frame:
  - **mat deform** (continuous unroll/roll — `mat.deform(ctx, d)`),
  - **camera keyframes** (`frames[]` table, smoothstepped),
  - **`[data-band]` content overlays** that fade/slide in at scroll ranges (see `journey.js`
    `bands()`),
- Each band = one **chapter** of content over the transforming mat. Suggested order
  (mat-hire first, then community, then Pilates):
  1. Hero — "Yoga mat hire, across London." (rolled coil → starts unrolling)
  2. The open mat + specs — dwell on the flat mat, show 68×185×4mm / rubber / non-slip
  3. How hire works — £8.50/mat, 2-day, min 10, same-day London delivery
  4. For every gathering — events/retreats use case
  5. Community / The SAÏA Club — "We curate unforgettable experiences"
  6. Pilates with Cristina
  7. Join — "Get on the Guest List"
  then release the pin into a short flat **footer/contact** region.
- **Light cream studio** (already built in `home3d.js` — reuse its lighting): transparent
  renderer (`alpha:true`), `HemisphereLight` + soft warm key with PCF soft shadow, `ShadowMaterial`
  contact shadow so the mat "floats" on the cream. NOT Journey's dark day-arc.
- **Composition rule per band:** mat on one side, text on the other (or add a soft scrim) so the
  dark mat never sits behind dark text. Design each band's layout deliberately.
- **Mobile / `prefers-reduced-motion`:** skip WebGL; show a static stacked editorial layout +
  the flat PNG. Detect with `matchMedia`.

Likely cleanest path: write a new **`js/home-journey.js`** modeled on `journey.js` (replacing the
current hero-only `js/home3d.js`), reusing `js/mat-core.js` unchanged.

---

## Decisions already locked (keep these)
- Editorial **cream `#F5F1E8` / stone `#E9E6DF`**, Cormorant Garamond serif, terracotta `#B8624A`.
- **Light** studio, not dark.
- **Mat hire = priority #1**, then community, then Pilates/yoga.
- **Real copy from saialondon.com** (verbatim — below). No invented headlines.
- Keep the existing ~section content set; reframe it as bands. Concierge untouched.

## Real copy (verbatim, gathered from saialondon.com — use this, don't invent)
**Hero / rentals:** "Yoga mat hire across London — same-week delivery from £8.50 a mat" ·
"If you are looking to organise a wellness event, you have landed in the right place! You can
rent our mats for £8.50 each with same day delivery from our warehouse in Central London."
**Mat-hire facts:** £8.50/mat, **2-day** hire (from the day before the event), **min 10**, extra
day **£1.50/mat**, **60+ → reduced quote**, delivery via Addison Lee **£35–£55 each way** from a
**Central London** warehouse, pickup at **NW3**, urgent → **WhatsApp Cristina 07444 611 914**.
Mat: **68 × 185 cm × 4 mm, black**, ethically sourced all-natural rubber base + PU surface,
non-slip, anti-odour, non-toxic, PVC-free, retail **£79** (reference only — **HIRE ONLY**).
**Brand:** "We are a female-led lifestyle brand empowering women through Fitness, Community and
Mindset." · "The SAÏA Club" · "We curate unforgettable experiences" · "Join the SAÏA Community"
· body: "Join us for a series of events in London for like-minded women to come together to
support each other, feel inspired and celebrate sisterhood."
**Events (2023, may refresh):** SAÏA Brunch Club at Mortimer House · Watercolour Painting in
Regent's Park · SAÏA Book Club & Afternoon Tea at Petersham Nurseries.
**Testimonials (verbatim):** Diana — "I love attending SAÏA events, the locations are always
beautiful and each event has a unique and thoughtful activity. Cristina has a special skill of
gathering like minded girls and creating amazing space for connection…" · Georgina (Olympic
Rhythmic Gymnast) — "A SAÏA Woman is not afraid to speak her truth, and is someone who inspires
and lifts up other women around her" · Tamta — "The SAÏA community is a celebration of women's
empowerment and networking with determined women who share similar values…"
**Founder:** Cristina (English-Mexican, founded SAÏA 2020; also the Pilates instructor & WhatsApp
contact). "SAÏA means 'A Woman Who Wins'." **Pilates:** Classical + Reformer, 1-2-1 in NW3, group
in Hampstead. **Footer CTA:** "Get on the Guest List of our upcoming events."
(Full structured facts also live in `js/saia-knowledge.js`.)

---

## Files
- `home.html` — Home. Hero currently has `#homeCanvas` + loads `three.min.js`, `mat-core.js`,
  `home.js`, `home3d.js`. To be rebuilt to the pinned-journey model.
- `js/home3d.js` — **first 3D attempt (hero-only). The light studio + GLB setup is reusable;
  the hero-only scroll model is what to replace.**
- `js/journey.js` + `index.html` — **the WORKING reference** for pinned 3D scroll (sticky canvas,
  camera `frames[]`, `deformFor(p)` phases, `bands()` reveal, damped `current→target`). Copy this.
- `js/mat-core.js` — engine: `loadGlb`, `buildGeometry`, `deform(ctx, 0=rolled..1=flat)`,
  `makeEnv`, `makeNormalMap`, `loadColorMap`. **Reuse as-is.** (Note: `loadColorMap` mirrors the
  U axis — check the logo isn't reversed for Home's mat pose.)
- `js/home.js` — Home nav + (parked) FAQ concierge. Its old flat-PNG parallax `tick()` should be
  removed once the journey replaces the hero.
- `assets/saia-mat.glb`, `assets/saia-mat-texture.png`, `assets/mat-flat.png` (fallback).
- `css/base.css` — tokens + helpers (`.saia-slot`, `.btn-ink`, keyframes).
- `docs/superpowers/specs/2026-06-20-home-3d-redesign-design.md` — the design spec. **UPDATE it:**
  the "3D hero + flat sections" choreography is superseded by this pinned-journey model.
- `CLAUDE.md` — project map (two-tier concierge + brand rules).

## Concierge (Phase 2 — DONE, do not touch unless asked)
Two-tier "Noor": deterministic `js/planner.js` (Tier 1) → Claude Haiku assist `server.js`
(Tier 2) on a miss, shared facts in `js/saia-knowledge.js`. Works; verified. Off-topic for the
design work.

---

## Your task (new chat)
Rebuild **Home** as a single **pinned, scroll-driven 3D journey**: the mat stays on-screen and
**continuously transforms** while **content bands reveal new info** at each scroll range — light
editorial studio, **mat-hire first**, **real saialondon.com copy**. Reuse `mat-core.js` and copy
the `journey.js` architecture.

**Process:** (1) study `journey.js` + `index.html`; (2) propose the **band-by-band scroll
choreography** (mat transform + camera + which content at each `p` range) as a short spec for
approval; (3) build incrementally — one band at a time, the user views each in the browser before
the next. Also fix: the pin model (don't let the mat scroll away), text/mat contrast per band,
the mirrored-logo texture, and mat sizing.
