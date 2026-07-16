# SAÏA Full Move to Shopify — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the live saialondon.com theme with this repo's redesigned site as a faithful Shopify theme, with a real mat-hire checkout (mats + extra days + refundable deposit), the Noor concierge still talking to the Vercel endpoint.

**Architecture:** A from-scratch custom theme in `theme/` inside this repo. A port script converts each static HTML page into a Liquid template (asset paths → `asset_url`, internal links → `/pages/...`), assets are flattened into `theme/assets/`. The concierge Tier-2 endpoint stays on Vercel. Checkout is a cart permalink built from the existing `hire` object by a new `js/shopify-cart.js` (booking math in `planner.js`/`saia-knowledge.js` is untouched).

**Tech Stack:** Shopify CLI 4.1.0 (installed), Liquid, vanilla JS (ES5 style, dual-mode modules), `node:test` for JS tests, Chrome DevTools MCP for browser verification.

**Spec:** `docs/superpowers/specs/2026-07-16-shopify-full-move-design.md`

## Global Constraints

- Mats are **HIRE ONLY** — copy never says "buy"/"for sale". £8.50/mat 2-day hire, **min 10, max 50**, extra days £1.50/mat/day, deposit £1.50/mat (refundable).
- Delivery is **never charged at checkout** — free £0 shipping rate labelled as confirmed by Cristina.
- No computed price ever appears in concierge `say` text.
- Palette cream `#F5F1E8`, ink `#2B2620`, terracotta `#B8624A`; Playfair Display + Inter; warm British English; English-only.
- All theme pushes go to the **unpublished draft theme only**. NEVER run `shopify theme publish` or push to the live theme — publishing is Amir's manual action.
- Never remove existing UI elements while porting.
- Git: Amir reviews before commits land — at each commit step, show the diff summary and get his OK first (his standing git rule).
- Store handle: ask Amir for the `*.myshopify.com` handle at Task 2; export it as `$STORE` for all CLI commands. CLI auth is interactive — Amir runs the first `shopify theme dev` himself via `! <command>` if browser login is needed.
- Sample/lab pages (`samples.html`, `sample-*.html`, `tools/lab/*`) are NOT ported.

---

## Phase 1 — Theme scaffold + store connection

### Task 1: Minimal valid theme scaffold

**Files:**
- Create: `theme/layout/theme.liquid`
- Create: `theme/config/settings_schema.json`
- Create: `theme/locales/en.default.json`
- Create: `theme/snippets/saia-boot.liquid`
- Create: `theme/templates/index.liquid` (placeholder, replaced in Task 5)
- Create: `theme/templates/404.liquid`, `theme/templates/page.liquid`, `theme/templates/product.liquid`, `theme/templates/cart.liquid` (placeholder, real one in Task 10), `theme/templates/collection.liquid`, `theme/templates/search.liquid`, `theme/templates/blog.liquid`, `theme/templates/article.liquid`, `theme/templates/list-collections.liquid`
- Modify: `.gitignore` (nothing to add — theme/ is committed)

**Interfaces:**
- Produces: `theme/` directory passing `shopify theme check`; `saia-boot.liquid` snippet defining `window.SAIA_ASSETS` (with `.base`), `window.SAIA_CONFIG` (with `conciergeEndpoint`, `matHireVariant`, `extraDayVariant`, `depositVariant`), and `window.SAIA.assetUrl(path)`.

- [ ] **Step 1: Create the layout**

`theme/layout/theme.liquid`:

```liquid
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{ page_title | default: shop.name }}</title>
  <link rel="icon" href="{{ 'saia-logo.avif' | asset_url }}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Inter:wght@100..900&display=swap" rel="stylesheet">
  {{ content_for_header }}
  {% render 'saia-boot' %}
</head>
<body>
  {{ content_for_layout }}
</body>
</html>
```

Note: page-specific `<style>`/`<link>` tags travel inside each template (the port script keeps them), so the layout stays minimal and pages stay pixel-identical.

- [ ] **Step 2: Create the boot snippet**

`theme/snippets/saia-boot.liquid` — the Shopify twin of the boot-config block in `index.html` (marked there with `<!-- SAÏA boot config -->`; the port script strips the local one):

```liquid
<script>
  window.SAIA = window.SAIA || {};
  {%- assign asset_base = 'saia-logo.avif' | asset_url | split: 'saia-logo.avif' | first %}
  window.SAIA_ASSETS = {
    base:        {{ asset_base | json }},
    matGlb:      {{ 'saia-mat.glb' | asset_url | json }},
    matTexture:  {{ 'saia-mat-texture.png' | asset_url | json }},
    matFlatPng:  {{ 'mat-flat.png' | asset_url | json }},
    flowFrameDir: {{ asset_base | json }},
    flowFrameCount: 303
  };
  window.SAIA.assetUrl = function (p) {
    var base = (window.SAIA_ASSETS || {}).base;
    if (!base) return p;
    return base + p.split('/').pop().replace(/\s+/g, '-');
  };
  window.SAIA_CONFIG = {
    conciergeEndpoint: {{ settings.concierge_endpoint | json }},
    matHireVariant:    {{ settings.variant_mat_hire | json }},
    extraDayVariant:   {{ settings.variant_extra_day | json }},
    depositVariant:    {{ settings.variant_deposit | json }}
  };
</script>
```

- [ ] **Step 3: Create the settings schema**

`theme/config/settings_schema.json`:

```json
[
  {
    "name": "theme_info",
    "theme_name": "SAÏA London",
    "theme_version": "1.0.0",
    "theme_author": "SAÏA",
    "theme_documentation_url": "https://saia-london.vercel.app",
    "theme_support_url": "https://saia-london.vercel.app"
  },
  {
    "name": "SAÏA concierge & checkout",
    "settings": [
      { "type": "text", "id": "concierge_endpoint", "label": "Concierge endpoint URL", "default": "https://saia-london.vercel.app/api/concierge" },
      { "type": "text", "id": "variant_mat_hire", "label": "Variant ID — Mat hire (2-day)", "info": "From Products → Mat hire → variant ID (Task 8)" },
      { "type": "text", "id": "variant_extra_day", "label": "Variant ID — Extra hire day" },
      { "type": "text", "id": "variant_deposit", "label": "Variant ID — Refundable deposit" }
    ]
  }
]
```

- [ ] **Step 4: Create locale + stub templates**

`theme/locales/en.default.json`:

```json
{ "general": { "meta": { "title": "SAÏA London" } } }
```

`theme/templates/index.liquid` (placeholder):

```liquid
<main style="font-family:'Playfair Display',serif; background:#F5F1E8; color:#2B2620; min-height:60vh; display:grid; place-items:center;">
  <h1>SAÏA — draft theme scaffold OK</h1>
</main>
```

`theme/templates/404.liquid`:

```liquid
<main style="background:#F5F1E8; color:#2B2620; min-height:60vh; display:grid; place-items:center; text-align:center; font-family:'Inter',sans-serif;">
  <div>
    <h1 style="font-family:'Playfair Display',serif;">Page not found</h1>
    <p><a href="/" style="color:#B8624A;">Back to SAÏA London</a></p>
  </div>
</main>
```

Each remaining stub (`page`, `product`, `cart`, `collection`, `search`, `blog`, `article`, `list-collections`) gets the minimal valid body — Shopify needs the templates to exist even though we don't browse them:

```liquid
{% comment %} stub — SAÏA does not use this template {% endcomment %}
<main style="background:#F5F1E8; min-height:40vh;"></main>
```

(`page.liquid` instead renders `{{ page.content }}` inside the `<main>`; `product.liquid` renders `{{ product.title }}` and `{{ product.price | money }}`.)

- [ ] **Step 5: Run theme check**

Run: `cd "/Users/at/Projects/site 2/theme" && shopify theme check`
Expected: no errors (warnings about missing sections/schema are acceptable for a non-Theme-Store theme; fix anything flagged `error`).

- [ ] **Step 6: Commit (after Amir's OK)**

```bash
git add theme/
git commit -m "feat(shopify): minimal valid SAÏA theme scaffold"
```

### Task 2: Connect to the store, push as draft

**Files:** none created — CLI/state only.

**Interfaces:**
- Consumes: `theme/` from Task 1.
- Produces: an unpublished theme named **"SAÏA v2 (draft)"** on the live store; `$STORE` handle known for all later tasks.

- [ ] **Step 1: Get the store handle from Amir** — ask for the `*.myshopify.com` handle (or read it from `shopify theme list` output if already authenticated).

- [ ] **Step 2: Authenticate + live preview**

Run: `cd "/Users/at/Projects/site 2/theme" && shopify theme dev --store=$STORE`
If it needs browser login, have Amir run it: `! cd "/Users/at/Projects/site 2/theme" && shopify theme dev --store=<handle>`
Expected: a `http://127.0.0.1:9292` preview URL. Open it (Chrome DevTools MCP) — the placeholder index renders with cream background.

- [ ] **Step 3: Push as unpublished draft**

Run: `shopify theme push --unpublished --theme "SAÏA v2 (draft)"`
Expected: "Your theme was pushed successfully" + a preview link. **Verify with `shopify theme list` that the live theme's role is still `[live]` and "SAÏA v2 (draft)" is `[unpublished]`.**

- [ ] **Step 4: Note the draft theme ID** — record the ID from `shopify theme list`; later pushes use `shopify theme push --theme <ID>` so we can never hit the live theme by accident.

---

## Phase 2 — Port `index.html`

### Task 3: The port script

**Files:**
- Create: `tools/shopify-port/port.mjs`
- Test: run against `index.html`, inspect output (script is tooling; no unit tests — its output is verified in the browser each time it's used)

**Interfaces:**
- Produces: `node tools/shopify-port/port.mjs <source.html> <template-name>` → writes `theme/templates/<template-name>.liquid`, copies every referenced asset (flattened, spaces→dashes) into `theme/assets/`, warns on files >10 MB (those go to Shopify Files by hand), throws on flatten-name collisions.

- [ ] **Step 1: Write the script**

`tools/shopify-port/port.mjs`:

```js
#!/usr/bin/env node
// Port a static SAÏA page to a Shopify Liquid template.
// Usage: node tools/shopify-port/port.mjs <source.html> <template-name>
//   e.g. node tools/shopify-port/port.mjs index.html index
//        node tools/shopify-port/port.mjs events.html page.events
import fs from 'node:fs';
import path from 'node:path';

const [,, src, tpl] = process.argv;
if (!src || !tpl) { console.error('usage: port.mjs <source.html> <template-name>'); process.exit(1); }

const ROOT = process.cwd();
const THEME = path.join(ROOT, 'theme');
const html = fs.readFileSync(path.join(ROOT, src), 'utf8');

const LINKS = {
  'index.html': '/',
  'events.html': '/pages/events',
  'story.html': '/pages/story',
  'pilates-with-cristina.html': '/pages/pilates-with-cristina',
  'contact-us.html': '/pages/contact-us',
  'guest-list.html': '/pages/guest-list',
  'terms-and-conditions.html': '/pages/terms-and-conditions',
  'event-book-club-petersham.html': '/pages/event-book-club-petersham',
  'event-morena-self-love.html': '/pages/event-morena-self-love',
  'event-mortimer-house.html': '/pages/event-mortimer-house',
  'event-the-nest.html': '/pages/event-the-nest',
  'event-watercolour-regents-park.html': '/pages/event-watercolour-regents-park',
  'checkout.html': '/cart',
};

// 1. keep page-specific <head> extras (styles/scripts); the layout owns meta/title/fonts
const head = (html.match(/<head[^>]*>([\s\S]*?)<\/head>/i) || [, ''])[1]
  .replace(/<meta[^>]*(charset|viewport)[^>]*>\s*/gi, '')
  .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
  .replace(/<link[^>]*fonts\.g(oogleapis|static)[^>]*>\s*/gi, '')
  .replace(/<link[^>]*rel="preconnect"[^>]*>\s*/gi, '');
const body = (html.match(/<body[^>]*>([\s\S]*?)<\/body>/i) || [, ''])[1];
let out = head + '\n' + body;

// 2. drop the local boot-config block — theme/snippets/saia-boot.liquid replaces it
out = out.replace(/<!-- SAÏA boot config[\s\S]*?<\/script>\s*/, '');

// 3. asset paths → {{ 'flat-name' | asset_url }}
const assets = new Set();
out = out.replace(/(src|href)="(?:\.\/)?((?:css|js|assets|vendor|photos)\/[^"?]+)(\?[^"]*)?"/g,
  (m, attr, p) => {
    assets.add(p);
    const flat = path.basename(p).replace(/\s+/g, '-');
    return `${attr}="{{ '${flat}' | asset_url }}"`;
  });

// 4. internal page links → Shopify paths
out = out.replace(/href="([a-z0-9-]+\.html)(#[^"]*)?"/gi,
  (m, page, hash) => LINKS[page] ? `href="${LINKS[page]}${hash || ''}"` : m);

// 5. protect inline JS/CSS containing {{ or {% from Liquid
out = out.replace(/<(script|style)(\s[^>]*)?>([\s\S]*?)<\/\1>/g, (m, tag, at, inner) =>
  /{{|{%/.test(inner) ? `<${tag}${at || ''}>{% raw %}${inner}{% endraw %}</${tag}>` : m);

// 6. copy referenced assets (flattened); >10MB → warn (Shopify Files by hand)
fs.mkdirSync(path.join(THEME, 'assets'), { recursive: true });
fs.mkdirSync(path.join(THEME, 'templates'), { recursive: true });
for (const p of assets) {
  const from = path.join(ROOT, p);
  if (!fs.existsSync(from)) { console.warn('MISSING asset:', p); continue; }
  const flat = path.basename(p).replace(/\s+/g, '-');
  const to = path.join(THEME, 'assets', flat);
  if (fs.existsSync(to) && fs.statSync(to).size !== fs.statSync(from).size)
    throw new Error('asset name collision after flattening: ' + flat);
  const mb = fs.statSync(from).size / 1048576;
  if (mb > 10) { console.warn(`SKIPPED >10MB (upload to Shopify Files): ${p} (${mb.toFixed(1)}MB)`); continue; }
  fs.copyFileSync(from, to);
}

fs.writeFileSync(path.join(THEME, 'templates', `${tpl}.liquid`), out);
console.log(`wrote theme/templates/${tpl}.liquid — ${assets.size} assets referenced`);
```

- [ ] **Step 2: Smoke-run against index.html**

Run: `cd "/Users/at/Projects/site 2" && node tools/shopify-port/port.mjs index.html index`
Expected: `wrote theme/templates/index.liquid` and `theme/assets/` fills with css/js/pngs. Any `SKIPPED >10MB` or `MISSING asset` lines get resolved before Task 5 finishes.

- [ ] **Step 3: Check CSS for url() asset references**

Run: `grep -n 'url(' css/*.css`
Expected: if any hit points at `assets/`/`photos/`, rename that stylesheet copy in the theme to `<name>.css.liquid` and change the `url(...)` to `url({{ '<flat-name>' | asset_url }})`. If no hits, nothing to do.

- [ ] **Step 4: Commit (after Amir's OK)**

```bash
git add tools/shopify-port/port.mjs
git commit -m "feat(shopify): page→Liquid port script"
```

### Task 4: JS asset paths go through `SAIA.assetUrl()`

The JS loads ~25 assets by relative string (`'assets/figure/figure-1.png'`, `'assets/mat yoga.glb'`, `assets/flow-frames/`) — those paths don't exist on Shopify's CDN. Every such load site is wrapped in the `SAIA.assetUrl()` helper (no-op locally, CDN-flattening on Shopify).

**Files:**
- Modify: `index.html` (boot-config block gains the helper + `base:''`)
- Modify: every `js/*.js` load site found by the grep below (expected: `js/home-journey.js`, `js/mat-core.js`, possibly `js/home.js`)
- Test: existing `node --test tests/` still passes; browser check on localhost.

**Interfaces:**
- Consumes: `window.SAIA.assetUrl` shape from Task 1's snippet.
- Produces: all runtime asset loads route through `SAIA.assetUrl(path)`.

- [ ] **Step 1: Add the helper to the local boot block in `index.html`** — inside the existing `<!-- SAÏA boot config -->` script, after `window.SAIA_ASSETS = {...}`, add exactly the same function as the snippet (so local/Vercel behaviour is unchanged — `base` is absent locally):

```js
  window.SAIA.assetUrl = function (p) {
    var base = (window.SAIA_ASSETS || {}).base;
    if (!base) return p;
    return base + p.split('/').pop().replace(/\s+/g, '-');
  };
```

- [ ] **Step 2: Find every load site**

Run: `grep -n "['\\\"]assets/" js/*.js`
Expected: list of string literals (GLBs, textures, figure pngs, swipe-hand, watercolour png).

- [ ] **Step 3: Wrap each one** — e.g. before: `loader.load('assets/mat yoga.glb', …)` → after: `loader.load(SAIA.assetUrl('assets/mat yoga.glb'), …)`. Where a file builds frame URLs from `SAIA_ASSETS.flowFrameDir` it already resolves correctly — leave those. Do not rename the local files.

- [ ] **Step 4: Verify locally** — run `python3 -m http.server 8000`, open `http://localhost:8000/`, confirm (DevTools network tab) figures/GLB/flow frames all load with 200s and the journey scrolls exactly as before. Run `node --test tests/` → all pass.

- [ ] **Step 5: Bump `?v=` cache-busters in `index.html`** for every js file touched (per repo convention).

- [ ] **Step 6: Commit (after Amir's OK)**

```bash
git add index.html js/
git commit -m "feat(shopify): route JS asset loads through SAIA.assetUrl helper"
```

### Task 5: Generate + verify the real `index.liquid`

**Files:**
- Create (generated): `theme/templates/index.liquid`, `theme/assets/*`
- Modify: `theme/assets/mat-yoga.glb` arrives via the flatten rename (source `assets/mat yoga.glb` keeps its space locally)

**Interfaces:**
- Consumes: port script (Task 3), assetUrl-wrapped JS (Task 4), boot snippet (Task 1).

- [ ] **Step 1: Regenerate**: `node tools/shopify-port/port.mjs index.html index` (re-run after Task 4's JS edits so the theme gets the wrapped files).
- [ ] **Step 2: Push to the draft**: `cd theme && shopify theme push --theme <DRAFT_ID>`; expected success with asset count.
- [ ] **Step 3: Browser-verify the preview** (Chrome DevTools MCP on the `shopify theme dev` URL): announcement bar, hero, pinned scroll journey plays with figure frames, estimator Spotlight counts a total, mobile-width GLB mat unrolls, fonts are Playfair/Inter, zero 404s in the network tab. Screenshot for Amir.
- [ ] **Step 4: Fix what the screenshot contradicts** (this is where flattening/raw-wrapping issues surface). Re-run port → push → re-verify until clean.
- [ ] **Step 5: Commit (after Amir's OK)**

```bash
git add theme/
git commit -m "feat(shopify): index.html ported to index.liquid, verified on draft theme"
```

---

## Phase 3 — Port the remaining pages

### Task 6: Port the 11 content pages + create their admin Pages

**Files:**
- Create (generated): `theme/templates/page.events.liquid`, `page.story.liquid`, `page.pilates-with-cristina.liquid`, `page.contact-us.liquid`, `page.guest-list.liquid`, `page.terms-and-conditions.liquid`, `page.event-book-club-petersham.liquid`, `page.event-morena-self-love.liquid`, `page.event-mortimer-house.liquid`, `page.event-the-nest.liquid`, `page.event-watercolour-regents-park.liquid`

**Interfaces:**
- Consumes: port script; LINKS map (handles must match it exactly).

- [ ] **Step 1: Generate all templates**

```bash
for p in events story pilates-with-cristina contact-us guest-list terms-and-conditions \
         event-book-club-petersham event-morena-self-love event-mortimer-house \
         event-the-nest event-watercolour-regents-park; do
  src="$p.html"; node tools/shopify-port/port.mjs "$src" "page.$p"
done
```
Expected: 11 `wrote theme/templates/…` lines; resolve any MISSING/SKIPPED warnings (>10 MB photos → upload via admin Content → Files, swap the template ref to the Files CDN URL).

- [ ] **Step 2: Push**: `cd theme && shopify theme push --theme <DRAFT_ID>`

- [ ] **Step 3: Create the pages in Shopify admin** (one-time, manual — Amir or via `! shopify ...` is not available for pages, so admin UI): Online Store → Pages → Add page. For each of the 11 names above: title = the page's `<h1>`/nav name, **handle = exactly the template suffix** (e.g. `events`, `event-the-nest`), Theme template = the matching `page.*` (visible only when the draft theme is previewed/published — if the template dropdown doesn't show them, set them after publish via the same screen, or temporarily via "Preview" theme context). Leave page content empty — the template renders everything.

- [ ] **Step 4: Verify each page on the preview** — for all 11: renders identically to the static original, nav links route to `/pages/...` (no `.html` anywhere: `grep -c '\.html"' theme/templates/*.liquid` → 0), no 404s in network tab.

- [ ] **Step 5: Commit (after Amir's OK)**

```bash
git add theme/
git commit -m "feat(shopify): all content pages ported as page templates"
```

---

## Phase 4 — Concierge on Shopify

### Task 7: Verify Noor end-to-end from the draft theme

**Files:** none expected (config already flows: `settings_schema.json` default → `saia-boot.liquid` → `SAIA_CONFIG.conciergeEndpoint`).

- [ ] **Step 1: Tier 1** — on the preview, ask the concierge "how much are 20 mats?" → instant scripted answer (no network call to Vercel in the network tab).
- [ ] **Step 2: Tier 2** — ask something long-tail (e.g. "can I hire mats for a rooftop gong bath?") → network tab shows a POST to `https://saia-london.vercel.app/api/concierge` returning 200, and a warm on-brand reply.
- [ ] **Step 3: Offline fallback** — temporarily set the endpoint setting to a garbage URL in the theme editor, ask a long-tail question → Tier-1 catch-all answers, site never breaks. Restore the setting.
- [ ] **Step 4 (only if Tier 2 fails):** check the browser console for a CORS error; the Vercel function already sends `Access-Control-Allow-Origin: *` (`api/concierge.js:13`), so a failure means something else — debug from the actual error, don't touch CORS blindly.

---

## Phase 5 — Real checkout

### Task 8: Create the products + free delivery rate (admin)

**Files:** none — Shopify admin state. Variant IDs land in theme settings.

**Interfaces:**
- Produces: three numeric variant IDs stored in theme settings `variant_mat_hire`, `variant_extra_day`, `variant_deposit`.

- [ ] **Step 1: Create three products** (admin → Products → Add product), all: status Active, **hidden from all sales channels' catalogs/search where possible** (they're checkout plumbing, not browsable listings), inventory not tracked, physical product = yes (so checkout collects the delivery address):

| Title | Price | Description line |
|---|---|---|
| Mat hire — 2-day hire | £8.50 | Per mat, 2-day hire. Minimum 10, maximum 50. Hire only. |
| Extra hire day | £1.50 | Per mat per day beyond the 2-day hire. |
| Refundable deposit | £1.50 | Per mat, refunded once the mats come back. |

- [ ] **Step 2: One free shipping rate** — Settings → Shipping and delivery → the general profile → zone UK: remove/avoid priced rates for these products (use a dedicated shipping profile for the three products if the store already has priced rates) and add rate: name **"Delivery & collection — confirmed by Cristina after booking"**, price **£0.00**.
- [ ] **Step 3: Record the three variant IDs** (each product's default variant ID from the URL or `shopify theme console`/admin API) and paste them into the draft theme's settings (theme editor → SAÏA concierge & checkout), and into `theme/config/settings_data.json` so pushes keep them.
- [ ] **Step 4: Test-mode payments** — confirm with Amir whether the store can run test mode (Settings → Payments → Shopify Payments test mode, or the Bogus gateway). Needed for Task 10's end-to-end order.

### Task 9: `js/shopify-cart.js` — cart permalink builder (TDD)

**Files:**
- Create: `js/shopify-cart.js`
- Test: `tests/shopify-cart.test.js`

**Interfaces:**
- Consumes: `KB.hire` facts (`minMats` 10, `maxMats` 50, `hireDays` 2), `KB.quoteLines(hire)` → `{ deliveryLabel, … }` from `js/saia-knowledge.js`.
- Produces: `SAIA.cartPermalink(hire, cfg)` → string. `hire = {mats, days, date, method, postcode}`; `cfg = {matHireVariant, extraDayVariant, depositVariant}` (strings). Dual-mode: `module.exports = { cartPermalink }` in Node.

- [ ] **Step 1: Write the failing tests**

`tests/shopify-cart.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { cartPermalink } = require('../js/shopify-cart.js');

const CFG = { matHireVariant: '111', extraDayVariant: '222', depositVariant: '333' };

test('base 2-day hire: mats + deposit lines only', () => {
  const url = cartPermalink({ mats: 20, days: 2 }, CFG);
  assert.ok(url.startsWith('/cart/111:20,333:20'));
  assert.ok(!url.includes('222:'));
});

test('extra days add mats×extraDays of the extra-day variant', () => {
  const url = cartPermalink({ mats: 15, days: 4 }, CFG);
  assert.ok(url.startsWith('/cart/111:15,222:30,333:15'));
});

test('quantity clamps to min 10 / max 50', () => {
  assert.ok(cartPermalink({ mats: 3, days: 2 }, CFG).startsWith('/cart/111:10,'));
  assert.ok(cartPermalink({ mats: 80, days: 2 }, CFG).startsWith('/cart/111:50,'));
});

test('booking context rides as encoded cart attributes', () => {
  const url = cartPermalink({ mats: 12, days: 2, date: '2 Aug', method: 'deliver', postcode: 'ec2y 8ds' }, CFG);
  assert.ok(url.includes('attributes[Event%20date]=2%20Aug'));
  assert.ok(url.includes('attributes[Postcode]=EC2Y%208DS'));
  assert.ok(url.includes('attributes[Method]=Delivery'));
});

test('pickup is labelled as pickup from NW3', () => {
  const url = cartPermalink({ mats: 12, days: 2, method: 'pickup' }, CFG);
  assert.ok(url.includes('attributes[Method]=Pickup%20from%20NW3'));
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/shopify-cart.test.js`
Expected: FAIL — `Cannot find module '../js/shopify-cart.js'`

- [ ] **Step 3: Implement**

`js/shopify-cart.js`:

```js
/* SAÏA — builds a real Shopify cart permalink from a hire object.
   Line quantities: mats (2-day hire) + mats×extraDays (extra day) + mats (deposit).
   Never computes a price — Shopify's own line prices do the money. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./saia-knowledge.js'));
  } else {
    root.SAIA = root.SAIA || {};
    root.SAIA.cartPermalink = factory(root.SAIA.KB).cartPermalink;
  }
}(typeof self !== 'undefined' ? self : this, function (KB) {
  function cartPermalink(hire, cfg) {
    hire = hire || {}; cfg = cfg || {};
    var H = KB.hire;
    var mats = Math.min(H.maxMats, Math.max(H.minMats, parseInt(hire.mats, 10) || 0));
    var days = parseInt(hire.days, 10) || H.hireDays;
    var extraDays = Math.max(0, days - H.hireDays);
    var items = [cfg.matHireVariant + ':' + mats];
    if (extraDays > 0) items.push(cfg.extraDayVariant + ':' + (mats * extraDays));
    items.push(cfg.depositVariant + ':' + mats);
    var attrs = [];
    function attr(k, v) {
      if (v) attrs.push('attributes[' + encodeURIComponent(k) + ']=' + encodeURIComponent(v));
    }
    attr('Event date', hire.date);
    attr('Method', hire.method === 'pickup' ? 'Pickup from NW3' : 'Delivery');
    attr('Postcode', String(hire.postcode || '').toUpperCase() || null);
    var q = KB.quoteLines(hire);
    attr('Delivery estimate', q.deliveryLabel);
    return '/cart/' + items.join(',') + (attrs.length ? '?' + attrs.join('&') : '');
  }
  return { cartPermalink: cartPermalink };
}));
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/`
Expected: all PASS (new file + the four existing test files).

- [ ] **Step 5: Commit (after Amir's OK)**

```bash
git add js/shopify-cart.js tests/shopify-cart.test.js
git commit -m "feat(shopify): cart permalink builder with clamped quantities + booking attributes"
```

### Task 10: Wire the handoff + build `cart.liquid`, complete a test order

**Files:**
- Modify: `js/checkout-handoff.js` (branch to the real cart when variant IDs are configured)
- Create: `theme/templates/cart.liquid` (replaces the Task-1 stub)
- Modify: `index.html` (script tag for `js/shopify-cart.js` + `?v=` bumps)

**Interfaces:**
- Consumes: `SAIA.cartPermalink` (Task 9), `SAIA_CONFIG.{matHireVariant,extraDayVariant,depositVariant}` (Task 1 snippet, values from Task 8).

- [ ] **Step 1: Branch in the handoff** — in `js/checkout-handoff.js`, replace the final redirect:

Before:
```js
    try { sessionStorage.setItem('saia_hire', JSON.stringify(hire)); } catch (e) { /* ignore */ }
    window.location.href = 'checkout.html';
```
After:
```js
    try { sessionStorage.setItem('saia_hire', JSON.stringify(hire)); } catch (e) { /* ignore */ }
    var cfg = window.SAIA_CONFIG || {};
    if (cfg.matHireVariant && cfg.depositVariant && NS.cartPermalink) {
      window.location.href = NS.cartPermalink(hire, cfg);   // real Shopify cart
      return;
    }
    window.location.href = 'checkout.html';                 // local/Vercel demo
```
(The WhatsApp quote-only branch above it is untouched.) Add `<script src="js/shopify-cart.js?v=20260716a"></script>` before `checkout-handoff.js` in `index.html`, bump handoff's `?v=`.

- [ ] **Step 2: Write `theme/templates/cart.liquid`** — on-brand summary in the checkout.html style:

```liquid
<main style="background:#F5F1E8; color:#2B2620; min-height:100vh; font-family:'Inter',system-ui,sans-serif; padding:48px 20px;">
  <div style="max-width:560px; margin:0 auto;">
    <a class="saia-back" href="/" style="display:inline-flex; align-items:center; gap:8px; min-height:44px; padding:8px 16px 8px 12px; margin-bottom:14px; border:1px solid #E4DDCF; border-radius:999px; background:#FBF8F1; color:#2B2620; font-size:13px; text-decoration:none;">← Back to SAÏA</a>
    <div style="font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:#B8624A; margin-bottom:18px;">Your hire</div>

    {% if cart.item_count == 0 %}
      <p>Your cart is empty. <a href="/" style="color:#B8624A;">Plan a hire with Noor</a>.</p>
    {% else %}
      <form action="/cart" method="post" novalidate
            style="background:#FFFDF8; border:1px solid #E4DDCF; border-radius:8px; padding:24px;">
        {% for item in cart.items %}
          <div style="display:flex; justify-content:space-between; gap:12px; padding:10px 0; border-bottom:1px solid #F0EADC;">
            <span>{{ item.product.title }} <span style="color:#6B6358;">× {{ item.quantity }}</span></span>
            <span>{{ item.original_line_price | money }}</span>
          </div>
        {% endfor %}
        <div style="display:flex; justify-content:space-between; gap:12px; padding:10px 0; color:#6B6358;">
          <span>Delivery &amp; collection</span><span>confirmed by Cristina</span>
        </div>
        {% for attribute in cart.attributes %}
          <div style="display:flex; justify-content:space-between; gap:12px; padding:4px 0; font-size:13px; color:#6B6358;">
            <span>{{ attribute.first }}</span><span>{{ attribute.last }}</span>
          </div>
        {% endfor %}
        <div style="display:flex; justify-content:space-between; border-top:1px solid #E4DDCF; margin-top:8px; padding-top:12px; font-family:'Playfair Display',serif; font-size:20px; color:#B8624A;">
          <span>Total today</span><span>{{ cart.total_price | money }}</span>
        </div>
        <p style="font-size:12px; color:#6B6358;">Includes the refundable deposit — returned once the mats come back. Courier cost is confirmed by Cristina before your event.</p>
        <button type="submit" name="checkout"
          style="width:100%; margin-top:20px; background:#2B2620; color:#F5F1E8; border:none; border-radius:4px; padding:15px; font-size:12px; letter-spacing:.18em; text-transform:uppercase; cursor:pointer;">
          Continue to payment
        </button>
      </form>
    {% endif %}
  </div>
</main>

<script>
  // backstop: clamp a hand-edited mat quantity back to 10–50 (front end already enforces this)
  (function () {
    var MIN = 10, MAX = 50, MAT_HANDLE = 'mat-hire-2-day-hire';
    var lines = [];
    {% for item in cart.items %}
      lines.push({ handle: {{ item.product.handle | json }}, line: {{ forloop.index }}, qty: {{ item.quantity }} });
    {% endfor %}
    lines.forEach(function (l) {
      if (l.handle !== MAT_HANDLE) return;
      var q = Math.min(MAX, Math.max(MIN, l.qty));
      if (q === l.qty) return;
      fetch('/cart/change.js', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line: l.line, quantity: q })
      }).then(function () { location.reload(); });
    });
  })();
</script>
```
(Adjust `MAT_HANDLE` to the real product handle from Task 8.)

- [ ] **Step 3: Push + regenerate index** (`node tools/shopify-port/port.mjs index.html index && cd theme && shopify theme push --theme <DRAFT_ID>`).

- [ ] **Step 4: End-to-end test order** — on the preview: plan a hire with Noor (e.g. 20 mats, 3 days, EC2 delivery) → Book → lands on `/cart` with 3 correct lines (20 × £8.50, 20 × £1.50, 20 × £1.50), attributes visible, total £230.00 → Continue to payment → shipping shows the £0 "confirmed by Cristina" rate → pay with test card → order appears in admin with cart attributes on it. Screenshot the order for Amir.

- [ ] **Step 5: Run all tests**: `node --test tests/` → PASS. Also verify the Vercel/local site still uses the demo checkout (no variant IDs configured there).

- [ ] **Step 6: Commit (after Amir's OK)**

```bash
git add js/checkout-handoff.js index.html theme/templates/cart.liquid theme/
git commit -m "feat(shopify): real cart + checkout wired from the hire flow"
```

---

## Phase 6 — Launch

### Task 11: Final sweep, publish (Amir), post-launch cleanup

**Files:**
- Modify: `vercel.json` (redirects), `CLAUDE.md` (run/deploy notes)

- [ ] **Step 1: Full sweep on the draft preview** — every page from the LINKS map + `/cart`, desktop and mobile width: rendering, console errors, 404s, concierge Tier 1 + Tier 2, estimator, a fresh test order. `shopify theme check` → no errors.
- [ ] **Step 2: Amir publishes** — he does it in admin (Online Store → Themes → "SAÏA v2 (draft)" → Publish) or approves me running `shopify theme publish --theme <DRAFT_ID>`. **Blocked on his explicit go.** Re-check the 11 pages' template assignments immediately after publish (Step 3 of Task 6 noted they may only be assignable then). Turn payment test mode OFF (if used).
- [ ] **Step 3: Redirect the Vercel pages** — in `vercel.json`, add permanent redirects from every page path to `https://saialondon.com/...` per the LINKS map (`/` → `https://saialondon.com/`, `/events.html` → `.../pages/events`, …) while **keeping `/api/*` serving as-is** (the concierge endpoint must stay). Deploy, verify `curl -I` shows 308s for pages and 200 for `/api/health`.
- [ ] **Step 4: Update `CLAUDE.md`** — new "Shopify theme" section: `theme/` layout, port script usage, draft-push workflow, variant-ID settings, and that saialondon.com is now the live surface (Vercel = concierge API + redirects).
- [ ] **Step 5: Commit (after Amir's OK)**

```bash
git add vercel.json CLAUDE.md
git commit -m "chore(shopify): launch cleanup — Vercel redirects + docs"
```
