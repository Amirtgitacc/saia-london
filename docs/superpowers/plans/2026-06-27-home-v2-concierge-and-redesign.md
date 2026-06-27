# Home v2 — Concierge integration + scroll/estimator/map redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `home.html` into a clearer scroll experience that converts through an integrated, agentic concierge.

**Architecture:** All work is in the existing dependency-free static front end on the `gh-pages` branch. The concierge brain (`js/planner.js` — `localPlan` + `applyActions`) already exists and is reused unchanged; only a new home-tailored UI layer (`js/home-concierge.js`) is built. Everything else is markup/CSS edits to `home.html` plus one throwaway lab page.

**Tech Stack:** Hand-written HTML/CSS/vanilla JS. No build step, no framework, no test runner. Tier-2 assist is the existing Node endpoint (`server.js`, `POST /api/concierge`). Verification is by **browser observation** (this project has no automated tests and `CLAUDE.md` says don't add tests for UI).

## Global Constraints

- Mats are **HIRE ONLY** — never "buy" / "for sale". £8.50/mat, 2-day base hire, +£1.50/mat per extra day, minimum 10, 60+ → reduced quote.
- Palette: cream `#F5F1E8`, paper `#FBF8F1`, ink `#2B2620`, muted `#6B6358`, terracotta `#B8624A`, line `#DAD4C8`.
- Home fonts: **Playfair Display** (display) + **Inter** (body).
- Voice: warm, female-led, British English. **No em/en dashes in any new copy** (humanizer rule) — use periods, commas, colons, or `·`.
- Accessibility on everything new: semantic HTML, `aria-label`, alt text, keyboard operable, visible focus, **`prefers-reduced-motion` guard on every new animation**.
- Dependency-free front end. Do not add libraries. Do not remove existing UI elements unless a task says so.
- Single source of truth is `js/saia-knowledge.js`; do not hardcode facts that live there.
- Commit after each task. Branch is `gh-pages`; do not push or merge without the user asking.

## File structure

| File | Responsibility | Action |
|------|----------------|--------|
| `home.html` | Markup + page CSS + inline page scripts | Modify (all phases) |
| `js/home.js` | Mobile nav drawer + hire entry hooks | Modify (drop FAQ engine, keep drawer) |
| `js/home-concierge.js` | Agentic concierge UI for home (inline block + launcher, one shared brain) | **Create** (Phase 4) |
| `js/planner.js` | Tier-1 brain + booking executor | Reuse unchanged |
| `js/saia-knowledge.js` | Facts | Reuse unchanged |
| `server.js` | Tier-2 endpoint | Reuse unchanged |
| `tools/lab/maps.html` | Throwaway lab: 4 map directions side by side | **Create** (Phase 3) |

Reference anchors in `home.html` as it stands today (line numbers shift as you edit; match on text):
- Bands live inside `#stage` (which is `pointer-events:none`), each `<div data-band="start,end" ...>`: Band 1 hero `data-band="0,0.14"` (~L401), Band 2 specs `0.14,0.30` (~L411), Band 3 how-hire `0.30,0.44` (~L428), Band 4 cards `0.44,...` (~L451).
- Flow Level 3 "NW3 & Hampstead" `data-band="0.778,0.86"` (~L506).
- Estimator `<section class="saia-est-stage">` (~L550), its "Book the hire" CTA is `<a class="cta" data-cta ...>` (~L579), disclaimer `.disc` (~L580).
- Redundant `<section id="mat-hire">` (~L588–602).
- Footer `<footer id="hire">` (~L657): "Hire a mat" button (~L664, keep), "Yoga mat hire" link `href="#mat-hire"` (~L678), **WhatsApp Cristina** link (~L674, remove), "A Woman Who Wins." (~L689, keep).
- Scroll hint `#homeHint` "Scroll to unroll ↓" (~L543), progress bar `#homeBar` (~L542).
- Concierge launcher/panel block (~L694–716): `#homeChatPanel`, `#homeThread`, `#homeChatInput`, `#homeChatSend`, `#homeChatClose`, `#homeChatLauncher`, `.home-chip` buttons.

---

## PHASE 1 — Cleanup, CTAs, footer, scroll cue, hero polish

Low risk, no new files. Each task is independently verifiable in the browser.

### Task 1.1: Remove the redundant mat-hire section and repoint its anchor

**Files:** Modify `home.html`

- [ ] **Step 1: Add an `id` to the estimator so the footer link has a target.** Change `<section class="saia-est-stage" aria-label="Estimate your mat hire">` to:
```html
<section id="estimate" class="saia-est-stage" aria-label="Estimate your mat hire">
```

- [ ] **Step 2: Delete the entire redundant section.** Remove the block from `<!-- ============ HIRE YOGA MATS — clear CTA ============ -->` through its closing `</section>` (the `<section id="mat-hire">…</section>`, ~L587–602 inclusive of the comment).

- [ ] **Step 3: Repoint the footer "Yoga mat hire" link.** Change `<a href="#mat-hire" ...>Yoga mat hire</a>` (~L678) to `href="#estimate"`.

- [ ] **Step 4: Verify in browser.** Run `python3 -m http.server 8000`, open `http://localhost:8000/home.html`. Expected: no "Hire yoga mats for your event." section between the estimator and the gallery; footer "Yoga mat hire" link scrolls to the estimator; no console errors.

- [ ] **Step 5: Commit.**
```bash
git add home.html
git commit -m "feat(home): remove redundant mat-hire section, repoint footer anchor to #estimate"
```

### Task 1.2: Footer — remove WhatsApp Cristina, keep "A Woman Who Wins"

**Files:** Modify `home.html`

- [ ] **Step 1: Remove the WhatsApp anchor only.** In the "Customer care" column (~L674), delete just this anchor, leaving "Contact us" and "Terms & conditions" intact:
```html
<a href="https://wa.me/447444611914" style="color:rgba(245,241,232,.78); text-decoration:none;">WhatsApp Cristina</a>
```

- [ ] **Step 2: Confirm "A Woman Who Wins." stays.** The bottom bar line `<span style="letter-spacing:.16em; text-transform:uppercase;">A Woman Who Wins.</span>` (~L689) is unchanged.

- [ ] **Step 3: Verify.** Footer "Customer care" now lists only "Contact us" and "Terms & conditions"; no "WhatsApp Cristina" anywhere in the footer; "A Woman Who Wins." still shows in the bottom bar. (Note: the Pilates section's "Train with Cristina" wa.me link is NOT the footer and stays.)

- [ ] **Step 4: Commit.**
```bash
git add home.html
git commit -m "feat(home): drop WhatsApp Cristina from footer, keep A Woman Who Wins"
```

### Task 1.3: Persistent + per-band Hire CTAs through the opening bands

The opening bands sit inside `#stage` which is `pointer-events:none`, so any button needs `pointer-events:auto`. Add a bold `data-hire-cta` button into bands 1, 2 and 3, plus a studio variant in band 1. (Band 4 cards already have CTAs — leave them.)

**Files:** Modify `home.html`

- [ ] **Step 1: Add the CTA row to Band 1 (hero).** Immediately after the band-1 `Fitness · Community · Mindset` line (~L406, the `<div ...>Fitness · Community · Mindset</div>`), inside the same `.band-inner`, add:
```html
<div style="display:flex; flex-wrap:wrap; gap:14px; margin-top:30px; pointer-events:auto;">
  <button data-hire-cta style="background:#2B2620; color:#F5F1E8; border:none; font-family:'Inter',sans-serif; font-size:12px; letter-spacing:.18em; text-transform:uppercase; padding:16px 34px; border-radius:2px; cursor:pointer;">Hire a mat</button>
  <button data-hire-cta="studio" style="background:none; color:#2B2620; border:1px solid #2B2620; font-family:'Inter',sans-serif; font-size:12px; letter-spacing:.18em; text-transform:uppercase; padding:16px 28px; border-radius:2px; cursor:pointer;">Run a studio? Talk to us</button>
</div>
```

- [ ] **Step 2: Add a Hire button to Band 2 (specs).** After the band-2 "For hire only." line (~L422 `<div ...>Retail value £79 each. <strong ...>For hire only.</strong></div>`), inside the same `.band-inner`, add:
```html
<div style="margin-top:24px; pointer-events:auto;">
  <button data-hire-cta style="background:#2B2620; color:#F5F1E8; border:none; font-family:'Inter',sans-serif; font-size:12px; letter-spacing:.18em; text-transform:uppercase; padding:15px 32px; border-radius:2px; cursor:pointer;">Hire a mat</button>
</div>
```

- [ ] **Step 3: Add a Hire button to Band 3 (how hire works).** After the band-3 `.hire-road` closing `</div>` (~L444, the van-road block) and before the `.band-inner` closing `</div>`, add:
```html
<div style="margin-top:28px; pointer-events:auto;">
  <button data-hire-cta style="background:#2B2620; color:#F5F1E8; border:none; font-family:'Inter',sans-serif; font-size:12px; letter-spacing:.18em; text-transform:uppercase; padding:15px 32px; border-radius:2px; cursor:pointer;">Hire a mat</button>
</div>
```

- [ ] **Step 4: Verify (Phase-1 behavior).** Until Phase 4 lands, `data-hire-cta` buttons are wired by the existing `js/home.js` `startHire()` (opens the current chat panel). Expected now: scrolling the pinned journey, each opening band shows a bold "Hire a mat" button; band 1 also shows "Run a studio? Talk to us"; clicking any opens the concierge panel; buttons are clickable (pointer-events works) and keyboard-focusable.

- [ ] **Step 5: Commit.**
```bash
git add home.html
git commit -m "feat(home): bold persistent Hire CTAs across opening bands + studio variant"
```

### Task 1.4: Bolder scroll cue on entry

**Files:** Modify `home.html` (markup ~L543 + add CSS near the page `<style>`)

- [ ] **Step 1: Replace the subtle hint with a bolder animated cue.** Change `#homeHint` (~L543) to add an animated chevron and a stronger label:
```html
<div id="homeHint" style="position:absolute; bottom:4vh; right:4vw; display:flex; flex-direction:column; align-items:center; gap:8px; z-index:4;">
  <span style="font-size:11px; letter-spacing:.28em; text-transform:uppercase; color:#2B2620; font-weight:500;">Scroll to unroll</span>
  <span class="home-cue-arrow" aria-hidden="true" style="width:18px; height:18px; border-right:2px solid #B8624A; border-bottom:2px solid #B8624A; transform:rotate(45deg);"></span>
</div>
```

- [ ] **Step 2: Add the bounce animation + reduced-motion guard.** In the page `<style>` block, add:
```css
@keyframes homeCueBounce { 0%,100%{ transform:rotate(45deg) translate(0,0); opacity:.5; } 50%{ transform:rotate(45deg) translate(3px,3px); opacity:1; } }
.home-cue-arrow{ animation:homeCueBounce 1.4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce){ .home-cue-arrow{ animation:none; } }
```

- [ ] **Step 3: Verify.** On entry (desktop, top of the pinned journey) the scroll cue is clearly visible with a bouncing terracotta chevron; it hides once scrolled (the existing `.is-static #homeHint{display:none}` rule still applies); with OS "reduce motion" on, the chevron is static.

- [ ] **Step 4: Commit.**
```bash
git add home.html
git commit -m "feat(home): bolder animated scroll cue on entry (reduced-motion safe)"
```

### Task 1.5: Top hero polish + entrance animation

Design lift only — do not change band-1 copy (already humanized). Refine type/spacing and add a soft entrance.

**Files:** Modify `home.html` (band-1 markup + page CSS)

- [ ] **Step 1: Add an entrance-animation class to band-1 inner.** On the band-1 `.band-inner` (~L402), add `home-hero-in` to its class list: `<div class="band-inner home-hero-in" style="max-width:620px;">`.

- [ ] **Step 2: Add the CSS (staggered rise/fade) + reduced-motion guard.** In the page `<style>`:
```css
@keyframes homeHeroIn { from{ opacity:0; transform:translateY(16px); } to{ opacity:1; transform:translateY(0); } }
.home-hero-in > *{ animation:homeHeroIn .7s cubic-bezier(.22,.61,.36,1) both; }
.home-hero-in > *:nth-child(1){ animation-delay:.05s; }
.home-hero-in > *:nth-child(2){ animation-delay:.15s; }
.home-hero-in > *:nth-child(3){ animation-delay:.27s; }
.home-hero-in > *:nth-child(4){ animation-delay:.39s; }
.home-hero-in > *:nth-child(5){ animation-delay:.5s; }
@media (prefers-reduced-motion: reduce){ .home-hero-in > *{ animation:none; } }
```

- [ ] **Step 3: Refine spacing/type (light touch).** Increase the hero `<h1>` letter spacing slightly and the lead paragraph top margin for breathing room: on the `<h1>` add `letter-spacing:-.01em;` and on the lead `<p>` change `margin:26px 0 0` to `margin:30px 0 0`. Do not alter the text.

- [ ] **Step 4: Verify.** On load, the hero eyebrow, headline, paragraph, tagline and CTA row rise and fade in in sequence; layout matches the rest of the page; reduced-motion shows them statically; copy unchanged.

- [ ] **Step 5: Commit.**
```bash
git add home.html
git commit -m "feat(home): hero entrance animation + spacing polish (reduced-motion safe)"
```

---

## PHASE 2 — Estimator redesign + concierge handoff hook

The estimator math/JS stays; this is a restyle + entrance + a handoff button. The section already uses cream CSS vars (`--cream`, `--paper`, `--terra`) and a self-drawing route; the goal is to make it read as a **seamless, clearly-labelled estimate moment**, not a separate dark template.

### Task 2.1: Make the estimate stage seamless + clearly an ESTIMATE

**Files:** Modify `home.html` (the `.saia-est-stage` CSS ~L154+ and its markup ~L550–585)

- [ ] **Step 1: Soften the section into the page flow.** In `.saia-est-stage` CSS, ensure the section background transitions from the preceding section's tone rather than a hard dark block: set the stage background to a themed gradient using the palette (cream → paper), add `border-top:1px solid #DAD4C8;`. (If the current background is dark, replace it with the cream/paper themed treatment.) Keep contrast accessible (ink text on cream).

- [ ] **Step 2: Add an unmistakable ESTIMATE frame.** Add a labelled border treatment around the quote card: a 1px terracotta inset frame with an "ESTIMATE" tab. Add markup at the top of the `.result` block (~L574) and CSS:
```html
<span class="est-flag">Estimate</span>
```
```css
.saia-est-stage .result{ position:relative; border:1px solid var(--terra); border-radius:4px; padding-top:34px; }
.saia-est-stage .est-flag{ position:absolute; top:-11px; left:18px; background:var(--terra); color:#F5F1E8; font-family:var(--body); font-size:10px; letter-spacing:.22em; text-transform:uppercase; padding:4px 12px; border-radius:2px; }
```
Keep the existing `.disc` "Estimate only. Cristina confirms on booking." line.

- [ ] **Step 3: Verify.** The estimate section visually belongs to the page (cream/paper, themed border); the quote card is clearly framed with an "Estimate" tab; the disclaimer remains; numbers still compute when you type mats/days/postcode.

- [ ] **Step 4: Commit.**
```bash
git add home.html
git commit -m "feat(home): reskin estimate stage seamless + clear ESTIMATE framing"
```

### Task 2.2: Entrance animation (fade + rise) + background boxes and car

**Files:** Modify `home.html` (CSS + a small inline IntersectionObserver script near the estimator JS)

- [ ] **Step 1: Add decorative background layer markup.** Just inside `<div class="vb">` (~L551), add a non-interactive backdrop:
```html
<div class="est-deco" aria-hidden="true">
  <span class="est-box b1"></span><span class="est-box b2"></span><span class="est-box b3"></span>
  <span class="est-car"><svg viewBox="0 0 48 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14h30l8 .5 4 3.5H3z"/><path d="M9 14l3-6h12l5 6"/><circle cx="14" cy="17" r="2.2"/><circle cx="34" cy="17" r="2.2"/></svg></span>
</div>
```

- [ ] **Step 2: Add CSS for boxes, car drive-by, and the fade+rise, all reduced-motion guarded.**
```css
.saia-est-stage .est-deco{ position:absolute; inset:0; overflow:hidden; pointer-events:none; z-index:0; color:var(--terra); }
.saia-est-stage .stagewrap{ position:relative; z-index:1; }
.saia-est-stage .est-box{ position:absolute; border:1px solid rgba(43,38,32,.10); border-radius:3px; }
.saia-est-stage .est-box.b1{ width:120px; height:80px; top:12%; left:8%; }
.saia-est-stage .est-box.b2{ width:90px; height:90px; bottom:14%; left:20%; }
.saia-est-stage .est-box.b3{ width:140px; height:70px; top:22%; right:10%; }
.saia-est-stage .est-car{ position:absolute; bottom:9%; left:-60px; width:48px; opacity:.55; }
.saia-est-stage.in .est-car{ animation:estCar 6s linear .3s both; }
@keyframes estCar{ from{ transform:translateX(0); } to{ transform:translateX(120vw); } }
.saia-est-stage .stagewrap{ opacity:0; transform:translateY(24px); transition:opacity .8s ease, transform .8s cubic-bezier(.22,.61,.36,1); }
.saia-est-stage.in .stagewrap{ opacity:1; transform:translateY(0); }
@media (prefers-reduced-motion: reduce){
  .saia-est-stage .stagewrap{ opacity:1; transform:none; transition:none; }
  .saia-est-stage.in .est-car{ animation:none; }
}
```

- [ ] **Step 3: Trigger `.in` on scroll into view.** Add a small script (near the estimator's existing inline JS):
```html
<script>(function(){var s=document.getElementById('estimate');if(!s)return;
  if(!('IntersectionObserver'in window)){s.classList.add('in');return;}
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){s.classList.add('in');io.disconnect();}});},{threshold:.25});
  io.observe(s);})();</script>
```

- [ ] **Step 4: Verify.** Scrolling into the estimator plays a one-time fade+rise; faint boxes sit behind; a terracotta car drives across once; with reduce-motion on, content is shown statically with no car motion. Estimator inputs still work.

- [ ] **Step 5: Commit.**
```bash
git add home.html
git commit -m "feat(home): estimate stage entrance (fade+rise, bg boxes, car drive-by)"
```

### Task 2.3: "Book this with the concierge" handoff (hook now, full flow in Phase 4)

**Files:** Modify `home.html` (the `.cta` "Book the hire" element ~L579 + estimator JS)

- [ ] **Step 1: Replace the wa.me "Book the hire" link with a concierge button.** Change the `<a class="cta" data-cta href="#" ...> Book the hire</a>` to:
```html
<button type="button" class="cta" data-est-book><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 5h16v11H7l-3 3z"/></svg> Book this with the concierge</button>
```

- [ ] **Step 2: Wire the handoff.** In the estimator's inline JS, add a click handler that reads the current estimate state and calls the concierge API (defined in Phase 4). Until Phase 4 exists, guard the call:
```js
var bookBtn = document.querySelector('[data-est-book]');
if (bookBtn) bookBtn.addEventListener('click', function(){
  var seed = {
    mats: parseInt((document.querySelector('[data-mats]')||{}).value,10) || null,
    days: parseInt((document.querySelector('[data-days]')||{}).value,10) || null,
    postcode: ((document.querySelector('[data-pc]')||{}).value||'').toUpperCase() || null
  };
  if (window.SAIA && window.SAIA.Concierge && window.SAIA.Concierge.open) {
    window.SAIA.Concierge.open({ mode:'estimate', seed:seed });
  } else if (window.SAIA && window.SAIA.startHire) {
    window.SAIA.startHire();   // fallback before Phase 4
  }
});
```

- [ ] **Step 3: Verify.** Clicking "Book this with the concierge" opens the concierge (in Phase 1–3 it just opens the panel via fallback; after Phase 4 it opens seeded with the estimate). No console errors when the concierge API is absent.

- [ ] **Step 4: Commit.**
```bash
git add home.html
git commit -m "feat(home): estimate hands off to concierge (book button + seed payload)"
```

---

## PHASE 3 — Map directions lab → pick → integrate

### Task 3.1: Build the map directions lab

**Files:** Create `tools/lab/maps.html`

- [ ] **Step 1: Create a standalone page showing 4 animated NW3 map directions side by side.** Self-contained, dependency-free, palette-themed (cream bg, ink/terracotta lines). Each tile is ~400px, labelled, with a simplified North-London / NW3 outline, a marker pin on NW3/Hampstead, self-drawing SVG lines (use `stroke-dasharray`/`stroke-dashoffset` CSS animation), and subtle idle motion. The four directions:
  1. **Ink line-art** — Heath/roads outline strokes draw in sequentially.
  2. **Tube-map geometric** — nodes (dots) + straight connector lines, transit style.
  3. **Topographic** — concentric contour rings radiating from the NW3 marker.
  4. **Hand-drawn** — slightly irregular, sketchy linework to match the watercolour theme.
- [ ] Each tile guards animation behind `@media (prefers-reduced-motion: reduce)`.
- [ ] Include a short caption under each: which direction it is, one line on the feel.

- [ ] **Step 2: Verify.** Open `http://localhost:8000/tools/lab/maps.html`. Expected: four labelled map tiles render side by side (wrap on narrow screens), each animates its lines in once on load, all on-palette, each with an NW3 marker.

- [ ] **Step 3: Commit.**
```bash
git add tools/lab/maps.html
git commit -m "feat(lab): 4 animated NW3 map directions for review"
```

- [ ] **Step 4: STOP and ask the user to pick one direction (1–4) before Task 3.2.** This is a human decision gate. Do not integrate a map until the user chooses.

### Task 3.2: Integrate the chosen map into the NW3 & Hampstead band

**Files:** Modify `home.html` (Flow Level 3 band ~L506)

- [ ] **Step 1: Add the chosen map into the band.** Inside the Flow Level 3 `.band-inner` (the "NW3 & Hampstead." band), after the `<p>` (~L510), insert the chosen direction's SVG + its scoped CSS (ported from the lab). Constrain to ~360px wide, `pointer-events:none`, themed. Mark decorative SVG `aria-hidden="true"` (the heading already conveys "NW3 & Hampstead").

- [ ] **Step 2: Animate on band reveal.** The band uses scroll-progress reveal (`data-band`); trigger the map's line-draw when the band becomes active (reuse the band's existing reveal mechanism / an IntersectionObserver on the band-inner). Guard with reduced-motion.

- [ ] **Step 3: Verify.** Scrolling to the NW3 & Hampstead band shows the chosen animated map drawing in; it sits cleanly beside the copy on desktop and stacks on mobile; reduced-motion shows it static; no layout shift to other bands.

- [ ] **Step 4: Commit.**
```bash
git add home.html
git commit -m "feat(home): integrate chosen NW3 map into the Where band"
```

---

## PHASE 4 — Concierge upgrade (the big one)

Bring the agentic brain to home and weave it into the page: an inline designed block plus the floating launcher, one shared conversation and hire basket, intent chips, hire/studio/estimate modes, and a mockup checkout path.

### Task 4.1: Build `js/home-concierge.js` (controller + brain wiring)

**Files:** Create `js/home-concierge.js`; it will be mounted in Task 4.2/4.3.

**Interfaces:**
- Consumes: `window.SAIA.Planner.localPlan(text) -> {say, actions, matched}` and `window.SAIA.Planner.applyActions(hireState, actions) -> {hire, acts}` (from `js/planner.js`); `window.SAIA_CONFIG.conciergeEndpoint` (optional, defaults `http://localhost:8787/api/concierge`).
- Produces (global API other code calls):
  - `window.SAIA.Concierge.open({mode, seed})` — `mode` ∈ `'default'|'hire'|'studio'|'estimate'`; `seed` optional `{mats?, days?, postcode?, guests?}`. Opens the floating panel, sets mode, seeds context, focuses input.
  - `window.SAIA.Concierge.close()`
  - `window.SAIA.Concierge.send(text)` — push a user message through the brain.
  - `window.SAIA.Concierge.mount(node, kind)` — render the conversation into a container; `kind` ∈ `'panel'|'inline'`. Multiple mounts share one state.
  - `window.SAIA.startHire(opts)` — backward-compatible alias → `Concierge.open({mode:'hire', ...opts})`.

- [ ] **Step 1: Implement shared state + brain pipeline.** One module-level state: `msgs` (array of `{from:'bot'|'user', text, chips?}`), `hire` (the booking state object passed to `applyActions`), `mounts` (array of `{node, kind}`), `mode`. The send pipeline:
  1. push user msg, show typing, render all mounts;
  2. `var p = SAIA.Planner.localPlan(text)`;
  3. if `p.matched` use `p`; else POST `{messages, hire}` to the endpoint (reuse the existing fetch+timeout pattern from the current `js/home.js askAssist`) and use its `{say, actions}`, falling back to a generic on error;
  4. `var r = SAIA.Planner.applyActions(hire, plan.actions); hire = r.hire;`
  5. push bot `say` (+ any `r.acts` summarised into the basket), render all mounts.

- [ ] **Step 2: Implement intent chips + modes.**
  - `default` mode seeds the first bot message with chips: `[{label:'Hosting ~30', q:'I am hosting 30 women'}, {label:'I run a studio', q:'I run a studio and need mats regularly'}, {label:'Just browsing', q:'Just browsing'}]`. Clicking a chip calls `send(q)`.
  - `hire` mode: open with "Tell me your event and I will sort the mats." + the same chips.
  - `studio` mode: open collecting studio name, typical dates, mat count; include one subtle line "or WhatsApp Cristina on 07444 611 914" (pull number from `window.SAIA.KB.contact.whatsapp` when present).
  - `estimate` mode: when `seed` has mats/days/postcode, pre-fill a first user-style summary (e.g. "Hire `<mats>` mats for `<days>` days, delivering to `<postcode>`") and run it through the pipeline so the basket pre-populates.

- [ ] **Step 3: Implement the live hire basket renderer.** From `hire` (`{mats, guests, date, total, status}`) render a compact basket line in both mounts: `"<mats> mats · <days/2>-day · from <total>"` and a `to checkout →` button that calls `send('checkout')`. Show `status` (Quoted / Confirmed / etc.) when present. Use `window.SAIA.KB` for price facts; never hardcode £8.50.

- [ ] **Step 4: Render function targets every mount.** `render()` iterates `mounts` and paints `msgs` + typing + chips + basket into each `node`, scoping styles to the home palette (Playfair/Inter, cream/ink/terracotta). Reuse the bubble styles already in `js/home.js` (`BOT`/`USER`/`TYPING`/`DOT`).

- [ ] **Step 5: Verify (console smoke test).** Temporarily load the module on `home.html`, open devtools: `SAIA.Concierge.open({mode:'hire'})` opens the panel with chips; `SAIA.Concierge.send('30 women on Saturday')` yields a recommended mat count and a populated basket; `SAIA.Concierge.send('checkout')` → "secure checkout link ready"; `SAIA.Concierge.send('confirm')` → "Confirmed. Welcome to SAÏA." No console errors with the endpoint down (falls back to Tier-1).

- [ ] **Step 6: Commit.**
```bash
git add js/home-concierge.js
git commit -m "feat(concierge): home agentic controller (shared brain, basket, modes)"
```

### Task 4.2: Swap the floating launcher onto the new controller; retire the FAQ engine

**Files:** Modify `home.html` (script tag + launcher wiring) and `js/home.js` (remove FAQ)

- [ ] **Step 1: Load the modules in order.** In `home.html` before `js/home.js`, ensure load order: `js/saia-knowledge.js`, `js/planner.js`, `js/home-concierge.js`, then `js/home.js`. Add the `<script src="js/home-concierge.js"></script>` tag.

- [ ] **Step 2: Mount the panel.** Have `home-concierge.js` mount into `#homeThread` as `kind:'panel'`, and wire `#homeChatLauncher`/`#homeChatClose`/`#homeChatSend`/`#homeChatInput`/`.home-chip` to `Concierge.open/close/send`. Update the panel quick-chips (~L706–708) to the intent chips (Hosting ~30 / I run a studio / Just browsing).

- [ ] **Step 3: Remove the dead FAQ code from `js/home.js`.** Delete `reply()`, `askAssist()`, `GENERIC`, the local `msgs`/`render`/`send`/`typing` concierge block, and the panel/launcher listeners that the controller now owns. **Keep** the mobile nav drawer code and a thin `NS.startHire` that delegates to `SAIA.Concierge.open({mode:'hire'})`. Keep the `data-hire-cta` wiring but route it through the controller (default click → `Concierge.open({mode:'hire'})`; `data-hire-cta="studio"` → `Concierge.open({mode:'studio'})`).

- [ ] **Step 4: Verify.** Launcher opens the smart concierge (intent chips, basket, mockup checkout); every `data-hire-cta` button opens it in hire mode; the studio button opens studio mode; the old keyword FAQ is gone; mobile nav drawer still works; no duplicate listeners / console errors.

- [ ] **Step 5: Commit.**
```bash
git add home.html js/home.js
git commit -m "feat(concierge): route launcher + hire CTAs through agentic controller, drop FAQ engine"
```

### Task 4.3: Add the inline concierge block (designed-in section)

**Files:** Modify `home.html` (insert a section where `#mat-hire` used to be, i.e. between `#estimate` and `#events`)

- [ ] **Step 1: Add the inline block markup.** Insert a themed section with an intro, an inline mount node, and the input, e.g.:
```html
<section id="concierge-hire" aria-label="Plan your hire with the concierge" style="background:#EFEADF; padding:clamp(64px,8vw,110px) 6vw; border-top:1px solid #DAD4C8;">
  <div style="max-width:760px; margin:0 auto;">
    <div style="font-size:12px; letter-spacing:.3em; text-transform:uppercase; color:#B8624A; margin-bottom:16px; text-align:center;">The SAÏA concierge</div>
    <h2 style="font-family:'Playfair Display',serif; font-weight:500; font-size:clamp(32px,4.6vw,54px); line-height:1.04; margin:0 0 18px; color:#2B2620; text-align:center;">Tell me about your event.</h2>
    <p style="font-size:clamp(15px,1.5vw,18px); line-height:1.7; color:#4A443B; max-width:520px; margin:0 auto 28px; text-align:center;">I will sort the mats, give you a quote, and take you all the way to a checkout link. Ask me anything.</p>
    <div id="homeInlineConcierge" class="saia-thread" style="background:#F5F1E8; border:1px solid #DAD4C8; border-radius:6px; min-height:220px; padding:20px; display:flex; flex-direction:column; gap:13px;"></div>
    <div style="display:flex; gap:10px; align-items:center; margin-top:12px; border:1px solid #DAD4C8; border-radius:30px; padding:10px 16px; background:#fff;">
      <input id="homeInlineInput" type="text" placeholder="e.g. 30 women, Saturday, NW3…" aria-label="Message the concierge" style="flex:1; border:none; background:transparent; font-family:'Inter',sans-serif; font-size:14px; color:#2B2620; outline:none;">
      <button id="homeInlineSend" style="background:none; border:none; cursor:pointer; font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:#B8624A;">Send</button>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Mount it and update the footer anchor.** In `home-concierge.js` mount `#homeInlineConcierge` as `kind:'inline'` and wire `#homeInlineInput`/`#homeInlineSend` to `Concierge.send`. Repoint the footer "Yoga mat hire" link from `#estimate` to `#concierge-hire` (more action-oriented), and consider the inline block the primary on-page conversion moment.

- [ ] **Step 3: Verify shared state.** Typing in the inline block updates the same conversation/basket as the floating panel (open the launcher and confirm it shows the same messages). The inline block shows intent chips on first view; reaching "Confirmed" works from the inline block. Estimator "Book this" (Task 2.3) opens the panel seeded and the inline block reflects the same basket.

- [ ] **Step 4: Commit.**
```bash
git add home.html js/home-concierge.js
git commit -m "feat(concierge): inline designed-in concierge block sharing the launcher brain"
```

---

## Self-review notes (coverage map)

| Spec section | Task(s) |
|--------------|---------|
| 5.1 Concierge two surfaces, modes, basket, contact | 4.1, 4.2, 4.3 (+ CTA wiring 1.3, handoff 2.3) |
| 5.2 Estimator restyle + handoff | 2.1, 2.2, 2.3 |
| 5.3 Map lab → pick → integrate | 3.1, 3.2 |
| 5.4 Remove redundant section | 1.1 |
| 5.5 Hire CTAs everywhere + studio | 1.3 |
| 5.6 Footer (remove WhatsApp, keep AWW) | 1.2 |
| 5.7 Bolder scroll cue | 1.4 |
| 5.8 Top hero polish | 1.5 |

Human decision gate: Task 3.1 Step 4 (user picks a map direction before 3.2).
Phasing matches spec §6: Phase 1 (1.1–1.5), Phase 2 (2.1–2.3), Phase 3 (3.1–3.2), Phase 4 (4.1–4.3). Each phase is independently shippable and browser-verifiable.
