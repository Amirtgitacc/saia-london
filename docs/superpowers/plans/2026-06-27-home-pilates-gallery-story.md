# Home Pilates / Gallery / Story Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-theme the Cristina avatar scroll on `home.html` into the Pilates-with-Cristina story, relabel the photo reel as the Gallery, move Our Story to its own page, turn the Join band into a Pilates guest list (with a mockup confirmation page), and add a clear mat-hire CTA section.

**Architecture:** Static, dependency-free site. Edits are HTML + inline CSS/JS in `home.html`, one new `story.html`, one new mockup `guest-list.html`, and a `tools/lab/` preview. No build, no framework, no new libraries. The custom scroll engine (`js/home-journey.js`) and reel engine are untouched.

**Tech Stack:** Plain HTML5, inline CSS, vanilla JS. Fonts: Playfair Display + Inter (Google Fonts, already linked). Local serve: `python3 -m http.server 8000`. Verify via Chrome DevTools MCP.

## Global Constraints

- **Mats are HIRE ONLY** — never "buy"/"for sale". £8.50/mat · 2-day base · +£1.50/mat per extra day · min 10 · 60+ = reduced quote.
- **Delivery:** same-day London (Addison Lee courier); free collection from NW3.
- **Contact:** WhatsApp Cristina 07444 611 914 (`https://wa.me/447444611914`).
- **Palette:** cream `#F5F1E8`, ink `#2B2620`, terracotta `#B8624A`, secondary cream `#EFEADF`, muted `#6B6358`, body `#4A443B`, border `#DAD4C8`.
- **Fonts:** Playfair Display (serif headings) + Inter (sans body) — `home.html` and `story.html` only.
- **English only.** British English. Voice: warm, female-led, unpretentious.
- **No new JS libraries.** Scroll stays custom vanilla.
- **Don't remove existing UI elements** beyond what this plan explicitly removes (`#story` section, Club/Community band copy).
- **Do NOT rename `id="events"`** — keep it; only labels change.
- **Footer keeps `id="hire"`**; new mat-hire section uses `id="mat-hire"`.
- **Commits deferred:** the user commits manually. Each task ends with a verify checkpoint, not a commit. Do not run `git commit` unless the user asks.
- **No automated tests** for this UI work (user rule). "Verify" = browser screenshot (Chrome DevTools MCP) + `grep` assertions.

---

### Task 1: Build the options lab (lab-first, per project rule)

Build a standalone lab showing 2–3 options each for the three NEW visual pieces, so the user picks before any live edit. Use the `frontend-design` and `ui-ux-pro-max` skills for the option designs.

**Files:**
- Create: `tools/lab/pilates-redesign-lab.html`

**Interfaces:**
- Produces: the user's chosen option (A/B/C) for each of: (1) "Hire yoga mats" CTA section, (2) Pilates guest list band, (3) Gallery header. Later tasks consume the chosen markup.

- [ ] **Step 1: Create the lab file** with three labelled groups, each rendering 2–3 variants stacked, on a cream `#F5F1E8` backdrop, using the brand palette + Playfair/Inter. Each variant is a self-contained block of the real markup it proposes (so the chosen one can be lifted verbatim).

  Group 1 — "Hire yoga mats" CTA section, 3 variants:
  - **A — Centered chips:** centered headline + 5 fact chips (`£8.50 / mat`, `2-day hire`, `Minimum 10`, `Same-day London delivery`, `Free NW3 collection`) + one ink "Enquire to hire" button.
  - **B — Split two-column:** left copy + button, right a stacked fact list with the mat thumbnail (`assets/mat-flat.png`).
  - **C — Banner strip:** terracotta-bordered full-width band, headline left, button right, chips beneath.

  Group 2 — Pilates guest list band (the L5 content), 2 variants:
  - **A — Inline field:** eyebrow "Join the Pilates guest list", "Reserve your spot.", one-line email + "Join the list".
  - **B — Card:** same copy inside a soft cream card with a subtle border and helper line.

  Group 3 — Gallery header (the reel section heading), 2 variants:
  - **A:** eyebrow "SAÏA women" → h2 "Gallery".
  - **B:** eyebrow "The SAÏA Gallery" → h2 "Moments on the mat".

- [ ] **Step 2: Serve and screenshot.** Start the static server if not running: `python3 -m http.server 8000`. Use Chrome DevTools MCP: navigate to `http://localhost:8000/tools/lab/pilates-redesign-lab.html`, screenshot full page at width 1280 and width 390 (mobile).
  Expected: all 7 variants render on-brand with no layout overflow.

- [ ] **Step 3: CHECKPOINT — user picks.** Present the screenshots and ask the user to choose one variant per group. Record choices. Do not proceed to Task 3 (CTA), Task 5 (guest list), Task 4 (gallery) styling until chosen. (Task 2 can proceed in parallel — it's copy-only.)

---

### Task 2: Re-theme the avatar scroll bands to Pilates (copy-only)

Replace the four avatar bands (L1–L4) and reframe L5. No engine/CSS change — only the text inside the existing `[data-band]` divs. `data-band` ranges, classes, and inline layout styles stay exactly as-is.

**Files:**
- Modify: `home.html:424-459` (flow levels L1–L4)

**Interfaces:**
- Consumes: nothing. Produces: nothing later tasks depend on.

- [ ] **Step 1: Replace L1 (`home.html:424-432`)** — keep the wrapper `<div class="flow-rail" data-band="0.576,0.66" ...>` and `<div class="band-inner" ...>` exactly; replace only the inner eyebrow/h2/p (and keep the existing `data-hire-cta` button removed here since this band is now Pilates, not hire):

```html
        <!-- FLOW LEVEL 1 — CRISTINA STANDS · PILATES INTRO -->
        <div class="flow-rail" data-band="0.576,0.66" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:flex-start; padding:0 7vw;">
          <div class="band-inner" style="max-width:460px;">
            <div style="font-size:12px; letter-spacing:.3em; text-transform:uppercase; color:#B8624A; margin-bottom:16px;">Fitness</div>
            <h2 style="font-family:'Playfair Display',serif; font-weight:500; font-size:clamp(34px,4.6vw,58px); line-height:1.0; margin:0 0 22px; color:#2B2620;">Move with<br>Cristina.</h2>
            <p style="font-size:16px; line-height:1.75; color:#6B6358; margin:0; max-width:400px;">Founder-led Pilates for women in London — small, strong and slow, on the same mat you'll come to know by heart.</p>
          </div>
        </div>
```

- [ ] **Step 2: Replace L2 (`home.html:434-441`)** — was "The SAÏA Club"; becomes "The method":

```html
        <!-- FLOW LEVEL 2 — CRISTINA REACHES UP · THE METHOD -->
        <div class="flow-rail" data-band="0.675,0.755" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:flex-start; padding:0 7vw;">
          <div class="band-inner" style="max-width:460px;">
            <div style="font-size:12px; letter-spacing:.3em; text-transform:uppercase; color:#B8624A; margin-bottom:16px;">The method</div>
            <h2 style="font-family:'Playfair Display',serif; font-weight:500; font-size:clamp(34px,4.6vw,58px); line-height:1.02; margin:0 0 22px; color:#2B2620;">Strength from<br>the inside out.</h2>
            <p style="font-size:17px; line-height:1.8; color:#6B6358; margin:0; max-width:460px;">Classical Pilates and Reformer, drawn from Joseph Pilates' own system, Contrology. Breath-led and built for every level.</p>
          </div>
        </div>
```

- [ ] **Step 3: Replace L3 (`home.html:443-450`)** — was "Move with Cristina"; becomes "Where":

```html
        <!-- FLOW LEVEL 3 — CRISTINA FOLDS → DOWNWARD DOG · WHERE -->
        <div class="flow-rail" data-band="0.778,0.86" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:flex-start; padding:0 7vw;">
          <div class="band-inner" style="max-width:460px;">
            <div style="font-size:12px; letter-spacing:.3em; text-transform:uppercase; color:#6B6358; margin-bottom:16px;">Where</div>
            <h2 style="font-family:'Playfair Display',serif; font-weight:500; font-size:clamp(34px,4.6vw,58px); line-height:1.0; margin:0 0 22px; color:#2B2620;">NW3 &amp;<br>Hampstead.</h2>
            <p style="font-size:16px; line-height:1.75; color:#6B6358; margin:0; max-width:400px;">One-to-one in NW3, or group classes in Hampstead. Wherever you start, Cristina meets you there.</p>
          </div>
        </div>
```

- [ ] **Step 4: Replace L4 (`home.html:452-459`)** — was "Community"; becomes "Why":

```html
        <!-- FLOW LEVEL 4 — CRISTINA LOW LUNGE · WHY -->
        <div class="flow-rail" data-band="0.882,0.955" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:flex-start; padding:0 7vw;">
          <div class="band-inner" style="max-width:460px;">
            <div style="font-size:12px; letter-spacing:.3em; text-transform:uppercase; color:#B8624A; margin-bottom:16px;">Why</div>
            <h2 style="font-family:'Playfair Display',serif; font-weight:500; font-size:clamp(34px,4.6vw,58px); line-height:1.0; margin:0 0 22px; color:#2B2620;">Breath-led,<br>for every body.</h2>
            <p style="font-size:16px; line-height:1.75; color:#6B6358; margin:0; max-width:400px;">Train for how you feel, not just how you look. Show up, breathe, build control — session by session.</p>
          </div>
        </div>
```

- [ ] **Step 5: Verify.** Chrome DevTools MCP: navigate `http://localhost:8000/home.html`, scroll the pinned section through p≈0.58→0.96 (scroll to ~60–96% of `#top`), screenshot each band. `grep -n "The SAÏA Club\|Stronger,\|Roll it out" home.html` → Expected: no matches (old band copy gone). `grep -c "Move with\|The method\|NW3 &amp;\|Breath-led" home.html` → Expected: ≥4.

- [ ] **Step 6: CHECKPOINT** — show screenshots; confirm copy + fades read well before moving on.

---

### Task 3: Add the "Hire yoga mats" CTA section

Insert the chosen Task 1 / Group 1 variant as a new flat section immediately after the estimator section, before the reel. (Markup below shows variant **A — Centered chips** as the default; substitute the user's chosen variant verbatim if different.)

**Files:**
- Modify: `home.html` — insert after `home.html:520` (`</section>` of `.saia-est-stage`); add one CSS rule in the `<style>` block (the `241` block head styles).

**Interfaces:**
- Consumes: Task 1 chosen variant. Produces: `id="mat-hire"` anchor used by Task 7 nav/footer links.

- [ ] **Step 1: Add the `.hire-chip` CSS rule** inside the existing `<style>` (after the `#events ...` rules, before `@media`):

```css
  .hire-chip{ font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:#6B6358; border:1px solid #C9C2B4; border-radius:30px; padding:7px 15px; }
```

- [ ] **Step 2: Insert the section** right after the estimator's closing `</section>` (currently line 520) and before `<!-- ============ PHOTO REEL ... -->`:

```html
  <!-- ============ HIRE YOGA MATS — clear CTA ============ -->
  <section id="mat-hire" aria-label="Hire yoga mats" style="background:#EFEADF; padding:clamp(64px,8vw,110px) 6vw; border-top:1px solid #DAD4C8;">
    <div style="max-width:920px; margin:0 auto; text-align:center;">
      <div style="font-size:12px; letter-spacing:.3em; text-transform:uppercase; color:#B8624A; margin-bottom:18px;">Mat hire</div>
      <h2 style="font-family:'Playfair Display',serif; font-weight:500; font-size:clamp(34px,4.8vw,58px); line-height:1.02; margin:0 0 22px; color:#2B2620;">Hire yoga mats<br>for your event.</h2>
      <p style="font-size:clamp(16px,1.5vw,18px); line-height:1.8; color:#4A443B; max-width:560px; margin:0 auto 32px;">Our signature mat, delivered across London and collected after — from a 10-mat morning class to a 200-person retreat. You simply unroll and begin.</p>
      <div style="display:flex; flex-wrap:wrap; gap:10px; justify-content:center; margin-bottom:36px;">
        <span class="hire-chip">£8.50 / mat</span>
        <span class="hire-chip">2-day hire</span>
        <span class="hire-chip">Minimum 10</span>
        <span class="hire-chip">Same-day London delivery</span>
        <span class="hire-chip">Free NW3 collection</span>
      </div>
      <button data-hire-cta style="background:#2B2620; color:#F5F1E8; border:none; font-family:'Inter',sans-serif; font-size:11px; letter-spacing:.2em; text-transform:uppercase; padding:16px 38px; border-radius:2px; cursor:pointer;">Enquire to hire</button>
    </div>
  </section>
```

- [ ] **Step 3: Verify.** Reload `http://localhost:8000/home.html`, scroll to the new section (right after the dark estimator), screenshot at 1280 and 390. Click "Enquire to hire" → Expected: the concierge panel opens (auto-wired by `home.js` `[data-hire-cta]` handler). `grep -c 'id="mat-hire"' home.html` → Expected: 1.

- [ ] **Step 4: CHECKPOINT** — confirm section reads as the clear mat-hire block.

---

### Task 4: Relabel the photo reel as "Gallery" (labels only, keep `#events`)

**Files:**
- Modify: `home.html:528` (reel head text). Nav/footer label changes happen in Task 7.

**Interfaces:**
- Consumes: Task 1 / Group 3 chosen header variant. Produces: nothing.

- [ ] **Step 1: Change the reel head** (currently `<div class="t">SAÏA women</div><h2>In their words</h2>` at line 528). Default = variant A:

```html
        <div class="rl-head"><div class="t">SAÏA women</div><h2>Gallery</h2></div>
```

(If the user chose variant B, use `<div class="t">The SAÏA Gallery</div><h2>Moments on the mat</h2>` instead.)

- [ ] **Step 2: Verify.** Reload, scroll to reel, screenshot. `grep -n "In their words" home.html` → Expected: no match. `grep -c 'id="events"' home.html` → Expected: 1 (id untouched).

---

### Task 5: Pilates guest list + mockup confirmation page

Reframe the L5 band as a Pilates guest list with a working client-side form that redirects to a **mockup backend page** (`guest-list.html`) on valid submit. (Markup shows guest-list variant **A — Inline field**; substitute chosen variant.)

**Files:**
- Modify: `home.html:461-472` (L5 band) + add a small inline `<script>` near the other inline scripts (before `</body>`, alongside the block at `734`).
- Create: `guest-list.html` (mockup confirmation page).

**Interfaces:**
- Consumes: Task 1 / Group 2 chosen variant. Produces: `guest-list.html` (redirect target).

- [ ] **Step 1: Replace the L5 band** (`home.html:461-472`), wrapping the field in a `<form data-guest-form>`:

```html
        <!-- FLOW LEVEL 5 — CRISTINA SEATED, HANDS TO HEART · PILATES GUEST LIST -->
        <div class="flow-rail" data-band="0.972,1" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:flex-start; padding:0 7vw;">
          <div class="band-inner" style="max-width:500px;">
            <div style="font-size:12px; letter-spacing:.3em; text-transform:uppercase; color:#B8624A; margin-bottom:18px;">Join the Pilates guest list</div>
            <h2 style="font-family:'Playfair Display',serif; font-weight:500; font-size:clamp(36px,5vw,62px); line-height:1.02; margin:0 0 20px; color:#2B2620;">Reserve your spot.</h2>
            <p style="font-size:16px; line-height:1.7; color:#6B6358; margin:0 0 30px;">First word when Cristina opens new Pilates classes in NW3 &amp; Hampstead — and a place held for you.</p>
            <form data-guest-form novalidate style="pointer-events:auto; display:flex; flex-wrap:wrap; gap:12px; justify-content:flex-start; max-width:440px;">
              <input type="email" name="email" required placeholder="Enter your email" aria-label="Email address" class="input-focus" style="flex:1 1 240px; font-family:'Inter',sans-serif; font-size:15px; padding:15px 18px; background:#fff; border-radius:2px; color:#2B2620;">
              <button type="submit" class="btn-ink" style="flex:0 0 auto; border:none; font-family:'Inter',sans-serif; font-size:12px; letter-spacing:.22em; text-transform:uppercase; padding:15px 34px; border-radius:2px; cursor:pointer;">Join the list</button>
              <p data-guest-msg aria-live="polite" style="flex:1 1 100%; margin:6px 0 0; font-size:13px; color:#B8624A; min-height:1.1em;"></p>
            </form>
          </div>
        </div>
```

- [ ] **Step 2: Add the handler** as a new `<script>` just before `<script src="vendor/three.min.js">` (line 870):

```html
  <script>
  /* Pilates guest list — front-end only (no backend yet). Valid email → mockup confirmation page. */
  (function () {
    var form = document.querySelector('[data-guest-form]');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var field = form.querySelector('input[type=email]');
      var msg = form.querySelector('[data-guest-msg]');
      var email = (field && field.value || '').trim();
      var valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!valid) { if (msg) msg.textContent = 'Please enter a valid email address.'; if (field) field.focus(); return; }
      window.location.href = 'guest-list.html';
    });
  })();
  </script>
```

- [ ] **Step 3: Create `guest-list.html`** — a mockup of the page a real backend would render after signup. Self-contained, dependency-free, on-brand, with a clear "mockup" honesty note and links home:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're on the Pilates guest list — SAÏA London</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=Inter:wght@400;500&display=swap" rel="stylesheet">
  <style>
    *{ box-sizing:border-box; margin:0; padding:0; }
    body{ font-family:'Inter',sans-serif; background:#F5F1E8; color:#2B2620; min-height:100vh; display:flex; flex-direction:column; }
    header{ padding:22px 6vw; border-bottom:1px solid #DAD4C8; }
    header a{ text-decoration:none; color:#2B2620; font-family:'Playfair Display',serif; font-size:26px; letter-spacing:.2em; }
    main{ flex:1; display:flex; align-items:center; justify-content:center; padding:clamp(48px,8vw,96px) 6vw; }
    .card{ max-width:560px; text-align:center; }
    .tick{ width:64px; height:64px; border-radius:50%; border:1.5px solid #B8624A; display:flex; align-items:center; justify-content:center; margin:0 auto 28px; }
    .eyebrow{ font-size:12px; letter-spacing:.3em; text-transform:uppercase; color:#B8624A; margin-bottom:16px; }
    h1{ font-family:'Playfair Display',serif; font-weight:500; font-size:clamp(34px,5vw,56px); line-height:1.04; margin-bottom:22px; }
    p{ font-size:clamp(15px,1.5vw,17px); line-height:1.8; color:#4A443B; margin-bottom:16px; }
    .actions{ display:flex; flex-wrap:wrap; gap:12px; justify-content:center; margin-top:32px; }
    .btn{ font-size:11px; letter-spacing:.2em; text-transform:uppercase; padding:15px 30px; border-radius:2px; text-decoration:none; }
    .btn-ink{ background:#2B2620; color:#F5F1E8; }
    .btn-line{ border:1px solid #2B2620; color:#2B2620; }
    .note{ margin-top:40px; font-size:12px; color:#6B6358; opacity:.8; }
    footer{ padding:24px 6vw; border-top:1px solid #DAD4C8; font-size:12px; color:#6B6358; text-align:center; }
  </style>
</head>
<body>
  <header><a href="home.html#top">SAÏA</a></header>
  <main>
    <div class="card">
      <div class="tick" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#B8624A" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg></div>
      <div class="eyebrow">Pilates with Cristina</div>
      <h1>You're on the guest list.</h1>
      <p>Thank you for joining. You'll be first to hear when Cristina opens new Pilates classes in NW3 &amp; Hampstead, with a place held for you.</p>
      <p>Want to start sooner? Message Cristina directly and she'll find you a spot.</p>
      <div class="actions">
        <a class="btn btn-ink" href="https://wa.me/447444611914">WhatsApp Cristina</a>
        <a class="btn btn-line" href="home.html#top">Back to home</a>
      </div>
      <p class="note">Mockup confirmation — no live newsletter backend yet; nothing was sent or stored.</p>
    </div>
  </main>
  <footer>© 2026 SAÏA London — A Woman Who Wins.</footer>
</body>
</html>
```

- [ ] **Step 4: Verify.** Reload `home.html`, scroll to L5. Submit with empty/invalid email → Expected: inline "Please enter a valid email address." and no navigation. Submit `test@example.com` → Expected: navigates to `guest-list.html` showing the confirmation. Chrome DevTools MCP screenshot both states + the mockup page (1280 + 390). `grep -c "Join the Pilates guest list" home.html` → Expected: 1.

- [ ] **Step 5: CHECKPOINT** — confirm the guest-list flow + mockup page.

---

### Task 6: Create `story.html`; remove `#story` from home

**Files:**
- Create: `story.html`
- Modify: `home.html:536-548` (remove the `#story` section)

**Interfaces:**
- Consumes: nothing. Produces: `story.html` (linked by Task 7 nav/footer).

- [ ] **Step 1: Create `story.html`** — full story, own lightweight header (with inline drawer), footer, no `home.js`, cross-page links use `home.html#…`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Our Story — A Woman Who Wins — SAÏA London</title>
  <meta name="description" content="The story of SAÏA London — founded in 2020 by Cristina, named for her great-grandmother Calandita. SAÏA means 'a woman who wins.'">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;500&display=swap" rel="stylesheet">
  <style>
    *{ box-sizing:border-box; margin:0; padding:0; }
    body{ font-family:'Inter',sans-serif; background:#F5F1E8; color:#2B2620; }
    a{ color:inherit; }
    .nav{ position:sticky; top:0; z-index:50; background:rgba(245,241,232,.92); backdrop-filter:blur(10px); border-bottom:1px solid #DAD4C8; }
    .nav-in{ display:flex; align-items:center; justify-content:space-between; padding:20px 6vw; max-width:1320px; margin:0 auto; }
    .nav-links{ display:flex; gap:30px; font-size:12px; letter-spacing:.18em; text-transform:uppercase; }
    .nav-links a{ text-decoration:none; }
    .brand{ font-family:'Playfair Display',serif; font-size:28px; letter-spacing:.2em; text-decoration:none; }
    .menu-btn{ display:none; background:none; border:none; cursor:pointer; }
    .drawer{ display:none; position:fixed; inset:0; z-index:60; background:#F5F1E8; padding:24px 6vw; }
    .drawer nav{ display:flex; flex-direction:column; gap:6px; margin-top:48px; }
    .drawer a{ font-family:'Playfair Display',serif; font-size:34px; text-decoration:none; padding:10px 0; border-bottom:1px solid #DAD4C8; }
    main{ padding:clamp(72px,9vw,128px) 6vw; }
    .wrap{ max-width:760px; margin:0 auto; text-align:center; }
    .eyebrow{ font-size:12px; letter-spacing:.3em; text-transform:uppercase; color:#B8624A; margin-bottom:18px; }
    h1{ font-family:'Playfair Display',serif; font-weight:500; font-size:clamp(34px,5vw,60px); line-height:1.02; margin-bottom:36px; }
    .body{ font-size:clamp(16px,1.5vw,18px); line-height:1.85; color:#4A443B; text-align:left; display:flex; flex-direction:column; gap:22px; }
    .sig{ font-family:'Playfair Display',serif; font-style:italic; font-size:20px; margin-top:32px; }
    footer{ background:#2B2620; color:#F5F1E8; padding:clamp(48px,6vw,72px) 6vw 32px; margin-top:24px; }
    .foot-in{ max-width:1320px; margin:0 auto; display:flex; flex-wrap:wrap; gap:24px; justify-content:space-between; align-items:center; }
    .foot-links{ display:flex; flex-wrap:wrap; gap:24px; font-size:13px; }
    .foot-links a{ color:rgba(245,241,232,.78); text-decoration:none; }
    @media (max-width:760px){ .nav-links{ display:none; } .menu-btn{ display:flex; } }
  </style>
</head>
<body>
  <header class="nav">
    <div class="nav-in">
      <nav class="nav-links">
        <a href="home.html#mat-hire">Mat Hire</a>
        <a href="home.html#pilates">Pilates</a>
        <a href="home.html#events">Gallery</a>
        <a href="story.html">Our Story</a>
      </nav>
      <a class="brand" href="home.html#top">SAÏA</a>
      <button class="menu-btn" id="navToggle" aria-label="Open menu"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2B2620" stroke-width="1.3"><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/></svg></button>
    </div>
  </header>
  <div class="drawer" id="drawer">
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <span style="font-family:'Playfair Display',serif; font-size:26px; letter-spacing:.2em;">SAÏA</span>
      <button id="navClose" aria-label="Close menu" style="background:none; border:none; cursor:pointer;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2B2620" stroke-width="1.3"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg></button>
    </div>
    <nav>
      <a href="home.html#mat-hire">Mat Hire</a>
      <a href="home.html#pilates">Pilates</a>
      <a href="home.html#events">Gallery</a>
      <a href="home.html#top">Home</a>
    </nav>
  </div>
  <main>
    <div class="wrap">
      <div class="eyebrow">Our story</div>
      <h1>A Woman Who Wins.</h1>
      <div class="body">
        <p>SAÏA started in 2020, when our founder Cristina began making her own yoga mats and bags. To bring her customers together, she ran a monthly Brunch Club: a morning of movement and good food in a beautiful London venue.</p>
        <p>Women began travelling in from outside the city just to be in the room, and a community formed around it. That community is now the heart of SAÏA. Cristina is English-Mexican, lives in London, and still welcomes every guest herself.</p>
        <p>The name comes from her great-grandmother, Calandita, who worked a small farm in Mexico and sold a cow to fund her move to the city. SAÏA means 'a woman who wins,' and Calandita is who it is named for.</p>
      </div>
      <div class="sig">Cristina, founder of SAÏA</div>
    </div>
  </main>
  <footer>
    <div class="foot-in">
      <span style="font-family:'Playfair Display',serif; font-size:26px; letter-spacing:.2em;">SAÏA <span style="font-size:11px; letter-spacing:.4em; opacity:.6;">LONDON</span></span>
      <div class="foot-links">
        <a href="home.html#mat-hire">Yoga mat hire</a>
        <a href="home.html#events">Gallery</a>
        <a href="https://wa.me/447444611914">WhatsApp Cristina</a>
        <a href="home.html#top">Home</a>
      </div>
    </div>
  </footer>
  <script>
    (function () {
      var d = document.getElementById('drawer');
      var open = document.getElementById('navToggle');
      var close = document.getElementById('navClose');
      if (open) open.addEventListener('click', function () { d.style.display = 'block'; });
      if (close) close.addEventListener('click', function () { d.style.display = 'none'; });
      Array.prototype.slice.call(d.querySelectorAll('a')).forEach(function (a) {
        a.addEventListener('click', function () { d.style.display = 'none'; });
      });
    })();
  </script>
</body>
</html>
```

- [ ] **Step 2: Remove the `#story` section from `home.html`** — delete the whole block `home.html:536-548` (`<!-- OUR STORY -->` `<section id="story" ...> … </section>`).

- [ ] **Step 3: Verify.** `grep -c 'id="story"' home.html` → Expected: 0. Navigate `http://localhost:8000/story.html`, screenshot 1280 + 390; click each nav link → Expected: lands on the right `home.html#…` anchor. Open mobile drawer (390 width) → Expected: opens/closes, links navigate. `grep -c "home.html#" story.html` → Expected: ≥6.

- [ ] **Step 4: CHECKPOINT** — confirm story page + removal.

---

### Task 7: Update home nav + footer links/labels

Consolidated link pass so all anchors point to the new structure.

**Files:**
- Modify: `home.html:262-264` (desktop nav), `home.html:289-291` (mobile drawer), `home.html:610` (footer About-us links).

**Interfaces:**
- Consumes: `#mat-hire` (Task 3), `story.html` (Task 6), Gallery label (Task 4).

- [ ] **Step 1: Desktop nav (`home.html:262-264`)** — set links to mat-hire, pilates, gallery, story:

```html
        <a href="#mat-hire" class="saia-link" style="color:#2B2620; text-decoration:none;">Mat Hire</a>
        <a href="#pilates" class="saia-link" style="color:#2B2620; text-decoration:none;">Pilates</a>
        <a href="#events" class="saia-link" style="color:#2B2620; text-decoration:none;">Gallery</a>
        <a href="story.html" class="saia-link" style="color:#2B2620; text-decoration:none;">Our Story</a>
```

- [ ] **Step 2: Mobile drawer (`home.html:289-291`)** — same four links (keep the existing inline `style` + `data-drawer-link` on each):

```html
      <a href="#mat-hire" data-drawer-link style="font-family:'Playfair Display',serif; font-size:38px; color:#2B2620; text-decoration:none; padding:10px 0; border-bottom:1px solid #DAD4C8;">Mat Hire</a>
      <a href="#pilates" data-drawer-link style="font-family:'Playfair Display',serif; font-size:38px; color:#2B2620; text-decoration:none; padding:10px 0; border-bottom:1px solid #DAD4C8;">Pilates</a>
      <a href="#events" data-drawer-link style="font-family:'Playfair Display',serif; font-size:38px; color:#2B2620; text-decoration:none; padding:10px 0; border-bottom:1px solid #DAD4C8;">Gallery</a>
      <a href="story.html" data-drawer-link style="font-family:'Playfair Display',serif; font-size:38px; color:#2B2620; text-decoration:none; padding:10px 0; border-bottom:1px solid #DAD4C8;">Our Story</a>
```

- [ ] **Step 3: Footer About-us links (`home.html:610`)** — Our Story → `story.html`, hire → `#mat-hire`, Events label → Gallery (`#events`):

```html
            <div style="display:flex; flex-direction:column; gap:12px; font-size:14px;"><a href="story.html" style="color:rgba(245,241,232,.78); text-decoration:none;">Our story</a><a href="#mat-hire" style="color:rgba(245,241,232,.78); text-decoration:none;">Yoga mat hire</a><a href="#events" style="color:rgba(245,241,232,.78); text-decoration:none;">Gallery</a></div>
```

- [ ] **Step 4: Verify.** `grep -c 'href="#story"' home.html` → Expected: 0. `grep -c 'href="story.html"' home.html` → Expected: 2 (nav + footer; mobile drawer makes 3 total — Expected ≥2). `grep -c 'href="#mat-hire"' home.html` → Expected: ≥2. Click each nav link in the browser → Expected: scrolls/navigates correctly.

---

### Task 8: Docs consistency + optional KB enrichment

**Files:**
- Modify: `AGENTS.md:72-73` (font line). Optional: `js/saia-knowledge.js` (`KB.pilates`).

- [ ] **Step 1: Fix `AGENTS.md` font line (`AGENTS.md:72-73`)** to match `CLAUDE.md`'s per-page rule:

```markdown
- Palette: cream `#F5F1E8`, ink `#2B2620`, terracotta accent `#B8624A`.
- Fonts are per-page (not yet unified): `home.html`/`story.html` use **Playfair Display + Inter**;
  `index.html`/`hero.html` still on **Cormorant Garamond + Hanken Grotesk**.
- Don't remove existing UI elements when making changes.
```

- [ ] **Step 2 (optional): Enrich `KB.pilates`** so the concierge can use the band facts. Update the `pilates` object's `method`:

```javascript
      method: 'Classical Pilates and Reformer — small, slow and breath-led, drawn from Joseph Pilates’ Contrology. Pilates for women, every level; Cristina meets you where you are.',
```

- [ ] **Step 3: Verify.** `grep -n "per-page" AGENTS.md` → Expected: match. If KB edited: `node -e "require('./js/saia-knowledge.js'); console.log('ok')"` → Expected: `ok` (no syntax error).

---

### Task 9: Final verification + a11y review

**Files:** none (review only).

- [ ] **Step 1: Full-page screenshots.** Chrome DevTools MCP at 1280 and 390: `home.html` top→bottom (hero, mat bands, Pilates avatar bands, guest list, estimator, mat-hire CTA, Gallery, Pilates section, press, footer), `story.html`, `guest-list.html`.

- [ ] **Step 2: Run the `web-design-guidelines` skill** over the changed markup. Check: every `<section>` has a heading or `aria-label`; the guest-list input has a label; the new buttons are keyboard-focusable with visible focus; contrast of `#6B6358`/`#4A443B` on cream passes; `story.html` headings are a single `<h1>` + ordered structure; mockup page tick SVG is `aria-hidden`.

- [ ] **Step 3: Pillar check.** `grep -ic "community" home.html` → Expected: ≥1 (footer/hero still carry the pillar). Confirm hero eyebrow still reads "Fitness · Community · Mindset".

- [ ] **Step 4: Final CHECKPOINT** — present all screenshots; confirm the redesign is complete and on-brand. Then ask the user whether to commit.

---

## Self-Review

**Spec coverage:**
- Re-themed avatar bands (spec §1) → Task 2 ✅
- Mat-hire CTA section (spec §2) → Task 3 ✅
- Guest-list behaviour + mockup page (spec §1a + user instruction) → Task 5 ✅
- Gallery relabel, keep `#events` (spec §3) → Task 4 + Task 7 ✅
- `story.html` + inline drawer + cross-page links (spec §4) → Task 6 ✅
- Nav/footer updates (spec §5) → Task 7 ✅
- Typography docs fix (spec §6) → Task 8 ✅
- Lab deliverable (spec Deliverables) → Task 1 ✅
- Optional KB enrichment (spec §1 note) → Task 8 ✅
- Verification + a11y (spec Workflow) → Task 9 ✅
- Keep flat `#pilates` section (decision #1 = choice C) → untouched by all tasks ✅

**Placeholder scan:** No TBD/TODO. Default variants given verbatim for every lab-dependent task, with a note to substitute the chosen one. All code blocks complete.

**Type/name consistency:** `id="mat-hire"` (Task 3) matches links in Task 7 + story.html (Task 6). `id="events"` kept everywhere. `data-guest-form` / `[data-guest-msg]` consistent between Task 5 markup and handler. `data-hire-cta` reuses the existing `home.js` handler. `guest-list.html` redirect target matches the created file.

**Open dependency note:** Tasks 3, 4, 5 styling depend on Task 1's user choice. Task 2 (copy-only) and Tasks 6–8 do not and can proceed independently.
