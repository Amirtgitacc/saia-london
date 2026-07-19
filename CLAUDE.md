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
(shared by `api/log.js` + `server.js`) validates and inserts into the Supabase `chat_logs`
table — needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env vars; without them rows are
printed to the local server console / dropped in prod. Review conversations in the Supabase
dashboard, grouped by `session_id`.

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
- **Booking math** lives in `applyActions()` in `planner.js` — shared by both tiers; the 13
  tools are: `add_mats, set_event, recommend, set_date, set_collection, quote, book_delivery,
  checkout, confirm, rsvp_event, request_pilates, join_pilates_list, join_newsletter`. Pilates is
  **not** instant-booked: 1-2-1 → `request_pilates` (request to Cristina); group classes are
  occasional events → `join_pilates_list` (email waitlist, updates when a session opens).
  For delivery, the return journey (`set_collection`, two-way vs one-way) is a **required slot**
  asked before quoting — slot order: mats → days → method → postcode → collection → date.

## The concierge front end

- `index.html` (the site root) → FAQ concierge inside `home.js` (no hire panel). Escalates to the
  same `/api/concierge` endpoint on a miss.

> The old agentic front end (`index.html` + `hero.html` with a live hire panel via `concierge-ui.js`
> + `journey.js`) was removed. Its booking brain — `planner.js` + `applyActions()` — lives on and is
> still shared by the concierge here.

## Brand rules (always)

- Mats are **HIRE ONLY — never "buy"/"for sale"**. £8.50/mat, 2-day hire, **min 10, max 50**
  (our current stock — no bulk discount; over 50 → suggest staggered/reused sessions, never book past 50).
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

## Delivery — flat London courier, chosen BEFORE checkout

Delivery is by **Addison Lee** courier from the NW3 base (pickup from NW3 is free). Hire facts:
£8.50/mat, 2-day base, **+£1.50/mat per extra day**, **min 10, max 50** (no bulk discount).

- **Pricing model (LIVE):** flat across London — **£90 delivery + same-day collection** (the
  DEFAULT, "two-way") or **£45 delivery-only** ("one-way", customer returns mats to NW3).
  Outside London → WhatsApp quote. Old per-zone "from £35/£45" estimates are gone; postcode
  zones now only pick the label + the outside-London case. Prices live in
  `KB.delivery.twoWay/oneWay` in `js/saia-knowledge.js`.
- **The choice is made in the estimator/assistant, never at checkout.** The `index.html`
  estimator (`.saia-est-stage` "Spotlight" section) has an "After your event" toggle
  (two-way pre-selected); the concierge asks via `set_collection`; `hire.collection` =
  `'two' | 'one'`.
- **In the cart it's a real line item** — `js/shopify-cart.js` adds the hidden "Courier
  delivery" product (variant IDs in theme settings `variant_courier_two_way` /
  `variant_courier_one_way`, exposed via `saia-boot.liquid`). Courier variants weigh 1kg,
  everything else 0g, and the shipping profile is **weight-gated**: carts WITH a courier line
  get the free "Courier — already included in your hire total" rate; carts without one (direct
  product-page buys) get paid £90/£45 rates. No free-shipping loophole from either side.
- **Changing the courier price = three places, all must match:** `KB.delivery` in
  `js/saia-knowledge.js`, the two Shopify variant prices, and the paid fallback rates in the
  "SAÏA mat hire (checkout plumbing)" shipping profile.
- **LATER — live Addison Lee rates:** the official **AL Shopify app** is installed but in TEST
  mode (real zonal prices ≈ £14–20 +VAT per leg). Blockers: AL must answer the van question
  (app has no vehicle-size concept; 10–50 mats need a van), and live *dynamic* rates need the
  carrier-service API (Advanced plan / yearly billing / paid add-on). Alternative remains the
  AL "Quickbook" API (quote + `POST /booking/create`; needs an AL business account).

## Shopify theme

`theme/` is the on-brand Shopify theme (store `saialondon`, draft theme **182035448187**; live
theme is still the old "Motion" until publish day). `theme/assets/` carries copies of the shared
`js/` files (knowledge, planner, shopify-cart, checkout-handoff) — **re-copy them after editing
the originals**; `concierge-core.js`/`saia-examples.js` are server-side only. `index.liquid`
mirrors the `index.html` estimator — estimator edits must land in both. Push with
`npx shopify theme push --store saialondon --theme 182035448187 --path theme --only <files>`.
