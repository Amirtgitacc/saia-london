# SAÏA London — site + "Noor" concierge

Static site for SAÏA London (a female-led women's club — **mat hire is the priority**, then
community, then Yoga/Pilates). Dependency-free front end; one tiny Node endpoint powers the
Claude side of the concierge. See `README.md` for the site internals (3D pages, GLB, etc.).

> **Current design state** of the `index.html` redesign (what's live, decided, and open) lives in
> `docs/HANDOVER-home-redesign.md` — check there before touching `index.html` layout/flow.
> (`index.html` is the page formerly known as `home.html`; it is now the site root.)

## Run / verify

```bash
# 1. one-time: paste your key
cp .env.example .env      # then edit .env → ANTHROPIC_API_KEY=sk-ant-...
npm install

# 2. terminal A — the concierge assist endpoint (:8787)
npm start                 # = node --env-file=.env server.js

# 3. terminal B — the static site (:8000)
python3 -m http.server 8000     # open http://localhost:8000/
```

Without a running endpoint (or key) the site still works — the concierge just uses its
deterministic brain and skips the Claude assist. `curl localhost:8787/health` shows status.

Tests: `node --test tests/*.test.js` (pricing, quotes, planner, cart, logging — keep green).

## The concierge: a two-tier brain

The concierge is **dedicated to SAÏA**, not a generic chatbot. Two tiers, same output shape
`{say, actions}`, consumed by one deterministic executor:

```
send(text)
  └─ Tier 1  js/planner.js  localPlan() → {say, actions, matched}
        matched? ── yes ─► use it (instant, free, on-brand, no network)
                  └─ no ──► Tier 2  POST /api/concierge (server.js, Claude Haiku 4.5)
                              returns {say, actions}; on any error → Tier 1 catch-all
        both feed ─► Planner.applyActions(hire, actions)  ← deterministic booking math
```

- **Tier 1 = the product.** Curated, scripted answers for the common situations. Fast, free,
  never off-brand. Claude never touches these.
- **Tier 2 = the safety net.** Only fires on the long tail. Scoped hard to SAÏA, can answer
  *and* book, but never computes a price itself — it emits an action and the app does the math.

## Conversation logging

Every chat turn (user, bot + tier, action lines) is fired from `js/home-concierge.js` to
`POST /api/log` (fire-and-forget; endpoint derived from `conciergeEndpoint`). `js/log-core.js`
(shared by `api/log.js` + `server.js`) validates and writes each turn to **Vercel Blob** —
needs `BLOB_READ_WRITE_TOKEN`; without it rows are printed to the local server console /
dropped in prod.

Cristina reads conversations at **`/chat-log.html`**, a password-gated page backed by
`GET /api/chat-log`. It needs `CHAT_LOG_PASSWORD` + `CHAT_LOG_SECRET` (and optionally
`RL_CHATLOG_PER_15`, default 10 attempts per 15 min); without them the endpoint returns 503.
The password buys an 8-hour HMAC cookie, so she types it once a day.

> **Privacy — do not weaken.** Vercel Blob URLs are public-but-unguessable, and transcripts
> carry names, postcodes and email addresses. Two mitigations are load-bearing: blobs are
> written with `addRandomSuffix: true`, and **no blob URL is ever returned to the browser**
> (`/api/chat-log` serves transcript *content* only). Never add a "download the raw file" link.

## Single source of truth: `js/saia-knowledge.js`

All SAÏA facts (hire terms, classes, events, founder, contact) live here. It feeds **both**
tiers — Tier 1 interpolates the values, Tier 2 gets `KB.factSheet` in its system prompt — so
they can never disagree. **Change a fact once, here, and both brains update.** Dual-mode:
`window.SAIA.KB` in the browser, `require()` in Node.

## Editing the concierge

- **Add a known situation (Tier 1):** add a branch in `localPlan()` in `js/planner.js`,
  return via the `m(say, actions)` helper (sets `matched:true`). Pull facts from `KB`.
- **Change Claude's scope/voice (Tier 2):** edit `systemPrompt()` in `server.js`.
- **Improve Claude's answer quality (Tier 2):** add/refine gold Q→A examples in
  `js/saia-examples.js` — these are injected as few-shot teaching of voice + the right action.
  This is the file to *grow* over time; Claude generalises from it, so a handful of good
  examples beats hundreds of hardcoded scripts. Keep `say` to 1–3 warm British sentences and
  never put a computed price in it (emit an action instead).
- **Change a fact/price/number:** edit `js/saia-knowledge.js` only.
- **Booking math** lives in `applyActions()` in `planner.js` — shared by both tiers; the 15
  tools are: `add_mats, set_days, set_method, set_postcode, set_event, recommend, set_date,
  quote, book_delivery, checkout, confirm, rsvp_event, request_pilates, join_pilates_list,
  join_newsletter`. Pilates is **not** instant-booked: 1-2-1 → `request_pilates` (request to
  Cristina); group classes are occasional events → `join_pilates_list` (email waitlist,
  updates when a session opens).
  There is **no return-journey slot**: `set_collection` was removed and `hire.collection` no
  longer exists, because the delivery method already decides both journeys. Slot order:
  mats → days → method → postcode → date.
  Keep this list in sync with `TOOLS` in `js/concierge-core.js` — that array is what Tier 2 is
  allowed to emit, and a tool advertised there but missing from `applyActions()` is silently
  ignored at runtime.

## The concierge front end

- `index.html` (the site root) → FAQ concierge inside `home.js` (no hire panel). Escalates to the
  same `/api/concierge` endpoint on a miss.

> The old agentic front end (`index.html` + `hero.html` with a live hire panel via `concierge-ui.js`
> + `journey.js`) was removed. Its booking brain — `planner.js` + `applyActions()` — lives on and is
> still shared by the concierge here.

## Brand rules (always)

- Mats are **HIRE ONLY — never "buy"/"for sale"**. £8.50/mat, 2-day hire, **min 10, max 50**
  (our current stock — no bulk discount; over 50 → suggest staggered/reused sessions, never book past 50).
  **One exception:** studios can commission **bespoke mats made to order**, in their own colours
  and branding — **enquiry only, by email** to Cristina@saialondon.com. No price, no online
  purchase, no checkout path. The concierge must never quote or invent a bespoke price.
- Say **"us"/"we"** in every contact instruction and service promise ("email us", "talk to us",
  "we confirm timings"). Keep Cristina's name for biography, her role as the Pilates instructor,
  page/nav titles, filenames and the email address itself. She is a person, not a mascot.
- Collection is **same day, after the event** (mats rolled, bagged, stacked; waiting charge if the
  courier waits) — **not** "the day after". Even same-day delivery+collection is charged as the 2-day hire.
- Voice: warm, female-led, unpretentious, British English. English-only project.
- Contact = **Cristina@saialondon.com** (bot's primary channel, site-wide) + WhatsApp Cristina
  (founder + Pilates instructor) on 07444 611 914; NW3 area. (`marketing@`/`press@` on contact-us.html
  are separate department channels.)
- Palette: cream `#F5F1E8`, ink `#2B2620`, terracotta accent `#B8624A`.
- Fonts are per-page (not yet unified): `index.html` uses **Playfair Display + Inter**;
  the sample pages (`samples.html`, `sample-film.html`, `sample-hybrid.html`) still on
  **Cormorant Garamond + Hanken Grotesk**.
- Don't remove existing UI elements when making changes.

## Model

Tier-2 assist uses `claude-haiku-4-5` (fast, fires only on the long tail). Override with
`SAIA_MODEL` in `.env`. Key stays server-side; it never reaches the browser.

## Delivery — symmetric, flat London courier, chosen BEFORE checkout

Delivery is by **Addison Lee** courier from the NW3 base (pickup from NW3 is free). Hire facts:
£8.50/mat, 2-day base, **+£1.50/mat per extra day**, **min 10, max 50** (no bulk discount).

- **Pricing model (LIVE): delivery is symmetric and banded by postcode.** Either **we handle
  both journeys** (delivery + same-day collection, one price) or **the customer handles both**
  (free pickup from, and return to, NW3). There is **no mixed option** — the old £45
  delivery-only price is gone. The flat £90 is gone too: it lost money outside Zone 2.

  | Band | Price | Where | Real AL Small Van cost (round trip) |
  |---|---|---|---|
  | `bandA` | **£80** | NW1–3, NW5/6/8/10/11, N1–N8, N19, N22, W1, W2, W9–W11, EC1–EC4 | £65–78 |
  | `bandB` | **£110** | WC, SW1–SW11, most SE + E, W3–W14, N9–N18, NW4, NW9 | £84–104 |
  | `outer` | **quote** | rest of London + BR CR DA EN HA IG KT RM SM TW UB WD | £129–192 |
  | `outside` | **quote** | not London | — |

  Prices live in `KB.delivery.bands` in `js/saia-knowledge.js`; the district→band maps are
  `bandADistricts`/`bandBDistricts` there. Band C has **no price on purpose** — its real cost
  spans £129 (Harrow) to £192 (Bromley), so one number would either gouge or lose. It sets
  `quoteOnly`, which routes the booking to the WhatsApp quote via `js/checkout-handoff.js`
  and adds **no courier cart line**. Never give Band C a price without re-quoting AL.

  > Band figures come from live Addison Lee **Small Van** quotes out of NW3, Aug 2026, inc VAT.
  > They exclude AL's **waiting-time charge**. Re-quote all four corners when AL moves its tariff.
- **The choice IS the delivery method**, made in the estimator or the assistant, never at
  checkout. `hire.method` is `'deliver' | 'pickup'`. `hire.collection` and the `set_collection`
  tool no longer exist; a stale `hire.collection` on an old saved hire is deliberately ignored
  and still prices as two-way.
- **In the cart it's a real line item** — `js/shopify-cart.js` adds the hidden "Courier
  delivery" product, **one variant per priced band** (theme settings `variant_courier_band_a`
  and `variant_courier_band_b`, exposed via `saia-boot.liquid`). Courier variants weigh 1kg,
  everything else 0g, and the shipping profile is **weight-gated**: carts WITH a courier line
  get the free "Courier — already included in your hire total" rate; carts without one (direct
  product-page buys) get the paid fallback rate. No free-shipping loophole from either side.
- **Changing a band price = three places, all must match** (get one wrong and a customer sees
  a different delivery price depending on how they reached checkout):
  1. `KB.delivery.bands.<band>` in `js/saia-knowledge.js`
  2. that band's Shopify courier variant price
  3. the paid fallback rate in the "SAÏA mat hire (checkout plumbing)" shipping profile
- **A priced band with no configured variant is refused, not silently discounted.**
  `cartCourierMissing()` in `js/shopify-cart.js` returns true when `KB.delivery.bands[zone]`
  has a price but the matching theme setting is empty; `js/checkout-handoff.js` then sends the
  booking to the WhatsApp quote instead of building a cart. Without this the guest pays nothing
  for the delivery we just quoted **and** the 0g cart takes the paid fallback shipping rate.
  Band C/outside are quote-only by design and never trip it.
- **Publish order when band prices change** (the bot and the storefront read *different*
  deployments, so the wrong order leaves them quoting different numbers):
  1. create/point the Shopify courier variant **first**
  2. `npx shopify theme push …` — storefront estimator + cart move to the new prices
  3. `git push` — Vercel redeploys, and the Tier-2 bot starts quoting them too

  Push git first and the bot quotes the new price while the cart still charges the old one.
- **LATER — live Addison Lee rates:** the official **AL Shopify app** is installed but in TEST
  mode (real zonal prices ≈ £14–20 +VAT per leg). Blockers: AL must answer the van question
  (app has no vehicle-size concept; 10–50 mats need a van), and live *dynamic* rates need the
  carrier-service API (Advanced plan / yearly billing / paid add-on). Alternative remains the
  AL "Quickbook" API (quote + `POST /booking/create`; needs an AL business account).

## Shopify theme

`theme/` is the on-brand Shopify theme (store `saialondon`, draft theme **182035448187**; live
theme is still the old "Motion" until publish day). `theme/assets/` carries copies of the shared
`js/` files (knowledge, planner, shopify-cart, checkout-handoff) — **re-copy them after editing
the originals**; `concierge-core.js`/`saia-examples.js`/`log-core.js`/`http-guard.js` are
server-side only and must never appear in `theme/assets/`. `index.liquid` mirrors the
`index.html` estimator — estimator edits must land in both. Push with
`npx shopify theme push --store saialondon --theme 182035448187 --path theme --only <files>`.

> ⚠️ **`home-mobile-journey.js` is NOT a plain copy.** A bare `cp js/… theme/assets/…` breaks
> the mobile storefront silently. `tools/shopify-port/port.mjs` rewrites two literals in it,
> and they must survive every re-copy:
>
> | in `js/` | in `theme/assets/` |
> |---|---|
> | `import { GLTFLoader } from '../vendor/GLTFLoader.js';` | `from './GLTFLoader.js';` |
> | `window.location.href = 'guest-list.html';` | `= '/pages/guest-list';` |
>
> There is no `theme/vendor/`, so the unported import 404s, `initMobileJourney()` never runs,
> and on ≤767px the home page loses the journey that *replaces* its hero and hire bands — an
> empty page, with nothing in the console pointing at the cause. After any sync, check:
> `grep -n "vendor/\|guest-list.html" theme/assets/home-mobile-journey.js` must return nothing.
