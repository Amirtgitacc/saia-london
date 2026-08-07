# SAÏA London — site adjustments, August 2026

**Date:** 2026-08-06
**Status:** approved design, ready for implementation planning

Nine client-requested adjustments to the SAÏA London site, the Shopify theme and the
concierge. Decisions below were settled with the client on 2026-08-06; where a request
collided with an existing rule, the resolution is recorded inline.

---

## 0. Context that shapes the work

Three facts discovered during design that change how the work must be split:

**Shopify is (becoming) the live site.** `vercel.json` 301-redirects `/`, `/events.html`,
`/story.html`, `/checkout.html` and the rest to `www.saialondon.com`. The Vercel deployment
now serves only `/api/*` functions plus any path not in the redirect list. `theme/` is no
longer a mirror of the static site — it is the product. Both are edited, but the theme is
what customers see.

**The estimator is inline in the page.** Its markup *and* its JavaScript live inside
`index.html` (script at ~line 1329), duplicated wholesale in
`theme/templates/index.liquid`. So markup, logic, the section swap and the gallery restyle
all touch one file, twice. That file gets a single owner.

**`maxMats` is already 50.** `js/saia-knowledge.js:37` is correct. Only display copy is
stale.

---

## 1. Mat cap: 60 → 50 in all copy

`KB.hire.maxMats` is already `50` and every calculation already clamps to it. The change is
copy-only.

| File | Line | Before | After |
|---|---|---|---|
| `index.html` | 795 | `60+ mats` | `Bespoke, made to order` (see §3) |
| `index.html` | 804 | `10 to 60 mats` | `10 to 50 mats` |
| `theme/templates/index.liquid` | ~767, ~776 | same two | same two |

Out of scope by client decision: `sample-film.html`, `sample-hybrid.html`, `tools/lab/*`.
These retain stale "60" text; they are not linked from the live nav and `vercel.json`
redirects the sample pages to the Shopify homepage.

**Acceptance:** `grep -rn "60" index.html theme/templates/index.liquid` returns no
mat-quantity matches (z-index and viewBox values are expected and fine).

---

## 2. Gallery heading → "Gallery"

The gallery block (`index.html:1069-1088`, `#events`) currently reads:

```
kicker:  Our community
heading: SAÏA Club & Community
lead:    Community classes, retreats and the mornings in between, across North West London.
```

Becomes a simple gallery heading. The kicker/heading/lead structure and the frosted card
stay; only the words change. Proposed copy:

```
kicker:  Gallery
heading: Moments from SAÏA
lead:    Community classes, retreats and the mornings in between, across North West London.
```

The `<em>` inside the heading (Bodoni Moda italic second line) may be dropped if the new
heading is a single line; if so remove the `#events .gl-intro h2 em` rule too.

The section keeps `id="events"` — the footer links to `#events` and `aria-label="SAÏA women
gallery"` should become `aria-label="Gallery"`.

**Acceptance:** no "club" or "community" wording in the `#events` heading block; footer
`#events` link still scrolls there.

---

## 3. Studio card → "Buy mats for your studio"

### The rule change

`CLAUDE.md` currently states: *Mats are **HIRE ONLY — never "buy"/"for sale"***. The client
has decided studios may **buy bespoke mats made to order**. The rule is amended, not
removed:

> Mats are **HIRE ONLY** for events, classes and individuals — never "buy"/"for sale".
> **One exception:** studios can commission **bespoke mats made to order** — enquiry only,
> by email. No price, no online purchase, no checkout path. The concierge must never quote
> a bespoke price.

### The card

`index.html:790-797` (mirrored `index.liquid`), first card in the `.s4grid`:

| Field | Before | After |
|---|---|---|
| `.s4nm` | Studios & partners | Buy mats for your studio |
| `.s4who` | 60+ mats | Bespoke, made to order |
| `.s4ds` | A reduced rate with recurring delivery to keep your studio stocked. | Bespoke mats made to order for studios — your colours, your branding, your quantities. Tell us what you need and we will come back with a quote. |
| `.s4pr` | Reduced rate | By enquiry |
| CTA | `<button data-hire-cta>Hire mats for your studio</button>` | `<a href="mailto:Cristina@saialondon.com?subject=Bespoke%20studio%20mats">Email us</a>` |

The CTA changes from a button that opens the concierge to a `mailto:` link, because the
client asked for studios to "contact us by email". Keep the existing button classes
(`btn-line saia-btn saia-btn--ghost`) so it looks identical; an `<a>` styled as a button
needs `display:inline-flex` and matching padding, and must keep a visible focus ring.

**Known overlap, accepted:** the third card is "Brand partnerships / Bespoke / Work with
us". Both cards now say "bespoke". They stay differentiated by subject — card 1 is *buying
mats for your own studio*, card 3 is *partnerships, press days and activations*. No card is
removed.

### The concierge

The bot must not contradict the new card.

- `js/home-concierge.js:117` — chip `{ label: 'I run a studio', mode: 'studio' }` stays; its
  answer changes.
- `js/planner.js` — the studio branch answers: we hire mats for studio events, **and** we
  make bespoke mats to order for studios, by email enquiry. Never a price.
- `js/saia-examples.js:162` — the `'I run a studio and need mats regularly'` gold example is
  rewritten to teach the new answer. **Also:** two existing lines in this file still promise
  a bulk discount, which contradicts `KB.hire` (no bulk discount, hard 50 cap). Both are
  corrected as part of this change.
- `js/saia-knowledge.js` — add `KB.hire.bespoke` describing the studio offer in one
  sentence, so Tier 1 and Tier 2 read it from the same place.

**Acceptance:** asking the bot "can I buy mats for my studio?" returns an email-us answer
with no price and no bulk-discount claim.

---

## 4. "Cristina" → "us", CTAs and contact phrasing only

### The rule

Change `Cristina` to `us`/`we` **only** where the sentence is an instruction to make contact
or a promise about service delivery.

**Keep every mention where Cristina is:**
- the subject of biography — `story.html`, the "Run by Cristina" / "The person behind SAÏA"
  journey bands
- the Pilates instructor — `KB.pilates.instructor`, `pilates-with-cristina.html` body copy
- part of a page title, nav label, URL or filename — "Pilates with Cristina",
  `pilates-with-cristina.html`, the Shopify page handle
- the email address — `Cristina@saialondon.com` stays exactly as it is

### Known instances to change

| File | Line | Before | After |
|---|---|---|---|
| `index.html` | 987 | Cristina confirms timings with you before your event. | We confirm timings with you before your event. |
| `guest-list.html` | 37 | Message Cristina directly and she'll find you a spot. | Message us directly and we'll find you a spot. |
| `guest-list.html` | 39 | WhatsApp Cristina | WhatsApp us |
| `sample-film.html` | 270 | WhatsApp Cristina | *(out of scope — sample page)* |
| all page footers + `theme/snippets/*` | — | WhatsApp Cristina | WhatsApp us |
| `js/planner.js`, `js/saia-examples.js`, `js/saia-knowledge.js` | — | any "Cristina will…", "email Cristina", "Cristina gets back to you" in bot replies | "we will…", "email us", "we get back to you" |

This table is a starting set, not an exhaustive list — the implementing agent applies the
rule above across every `.html` in the repo root and every `theme/snippets/*.liquid`, and
reports anything ambiguous rather than guessing.

`KB.contact.person` stays `'Cristina'` (it identifies the founder to the model); the bot's
*phrasing* is what changes.

**Acceptance:** no user-facing string reads "Talk to Cristina", "email Cristina",
"Message Cristina", "WhatsApp Cristina", or "Cristina will/confirms/looks after"; the
Pilates page, the founder bands and the email address are untouched.

---

## 5. Delivery symmetry — delete the £45 one-way option

### The decision

Delivery becomes a binary. Either **we** handle both legs, or **you** handle both legs. The
mixed "we deliver, you return" option is removed everywhere.

```
BEFORE — 3 outcomes                  AFTER — 2 outcomes
  Deliver + we collect ...... £90      Deliver, both legs, us ..... £90
  Deliver + you return ...... £45  ✗   Collect from NW3, both legs  free
  Pickup from NW3 .......... free
```

`hire.collection` ceases to exist. `hire.method` (`'deliver' | 'pickup'`) is the only
delivery state.

### Code changes

| File | Change |
|---|---|
| `js/saia-knowledge.js` | delete `KB.delivery.oneWay`; rewrite `KB.hire.delivery` prose to describe two options; `quoteLines()` always uses `twoWay` for `method === 'deliver'` |
| `js/planner.js` | delete the `set_collection` tool (13 tools → 12); delete `'collection'` from the slot ladder in `need()`; delete the `aw === 'collection'` block; delete the `RETURN_ONE` / `RETURN_TWO` regexes and `collectReturn`; keep `explicitPickup` and the pickup-vs-delivery disambiguation, which is still load-bearing |
| `js/shopify-cart.js` | delete the `oneWay` branch and `cfg.courierOneWayVariant`; always use `courierTwoWayVariant` for London deliveries; the `Return journey` cart attribute becomes a constant `Same-day collection by courier` for deliveries, and is omitted for pickup |
| `index.html` + `index.liquid` | delete the entire `[data-colwrap]` "After your event" block (markup) and the `colwrap` / `collectionSeg` entries and `collection` state variable in `wire()` (logic) |
| `theme/snippets/saia-boot.liquid` | delete `courierOneWayVariant` (line 23) |
| `theme/config/settings_schema.json` | delete the `variant_courier_one_way` setting if present |
| `js/saia-examples.js` | remove/rewrite any gold example teaching the one-way choice |
| `tests/quote.test.js`, `tests/planner.test.js`, `tests/shopify-cart.test.js` | update expectations; add a regression test that a `hire` object carrying a stale `collection: 'one'` still produces the £90 two-way cart |
| `CLAUDE.md` | rewrite the delivery section: "three places must match" becomes two; remove the one-way price from the brand rules |

### Backwards compatibility

An old `sessionStorage.saia_hire` may still carry `collection: 'one'`. `applyActions()` and
`buildCart()` must **ignore** the field rather than trust it — otherwise a returning visitor
silently gets a £45 courier line that no longer has a matching Shopify variant.

### Shopify admin work (cannot be done from code)

Documented in `docs/MANUAL-shopify-steps.md`, must ship at the same time as the code:

1. Archive the one-way courier variant on the hidden "Courier delivery" product.
2. Delete the paid **£45** fallback rate from the "SAÏA mat hire (checkout plumbing)"
   shipping profile. Leave the £90 rate.
3. Confirm the free "Courier — already included in your hire total" weight-gated rate still
   applies to carts containing a courier line.

> ⚠️ If the code ships without step 2, a stale £45 rate reappears at checkout and undercuts
> the £90 line item. Code and admin must land together.

**Acceptance:** the estimator shows only Deliver / Collect NW3; the concierge never asks
about the return journey; a **London** delivery cart contains exactly one courier line at
£90; an outside-London postcode still produces no courier line and the WhatsApp-quote path;
a pickup cart still carries the £0 `pickupVariant` weight line; `node --test tests/*.test.js`
is green.

---

## 6. Four dates on every booking

### The dates

| Date | Source |
|---|---|
| Booking date | automatic — the moment the cart is built |
| Event date | asked — the only date the customer enters |
| Delivery date | derived — event date − 1 day |
| Collection date | derived — event date + (days − 2) |

For the standard 2-day hire that gives *delivered the day before, collected on the event
day*, matching `KB.hire.twoDayBasis` and the same-day collection rule. For a longer hire the
event date is treated as the **start** of the event, so a 4-day hire is delivered the day
before and collected two days after the start.

For `method === 'pickup'` the same two derived dates are labelled **Pickup from NW3** and
**Return to NW3**.

### Implementation

- New `KB.deriveDates(hire)` in `js/saia-knowledge.js`, returning
  `{ booking, event, delivery, collection }` as `YYYY-MM-DD` strings, plus a
  `KB.formatDate()` for display (`Sat 14 Mar 2026`).
- Date arithmetic operates on the **date parts only** — no `Date` UTC round-tripping, which
  shifts London dates across the DST boundary. Add a test at a BST/GMT crossover.
- `js/shopify-cart.js` writes all four as cart attributes, replacing today's single
  `Event date`.
- `js/checkout.js` renders all four in the order summary.
- `js/planner.js`: the `confirm` reply states the delivery and collection dates rather than
  the vague "delivery the day before, collection on the day".

### Event date becomes required

Today the estimator never asks for an event date; `checkout.js` collects it late as a
fallback. Because three dates now derive from it, the estimator gains a **required Event
date field** and *Book now* stays disabled until it is filled — the same gate `checkout.js`
already applies. The concierge already asks for `date` as a slot; that is unchanged.

**Acceptance:** a Shopify cart built from the estimator carries four dated attributes; a
hire with no event date cannot reach checkout; DST-crossover test passes.

---

## 7. Phone number required at checkout

**Documentation only — no code.** The real money path is Shopify's own checkout, which is
configured in the admin, not in this repo.

Added to `docs/MANUAL-shopify-steps.md`:

> Shopify admin → **Settings → Checkout → Customer contact method** → set
> **Shipping address phone number** to **Required**.

**Scope note, flagged for the client:** with only this toggle, the concierge can still say
"confirmed" without ever collecting a phone number, and the demo `checkout.html` still reads
"add an email *or* phone". That is acceptable if Shopify checkout is the only real order
path — which it is today. If the concierge should also ask, that is a follow-up change to
the slot ladder in `js/planner.js`.

---

## 8. Chat log — Vercel Blob behind a password-protected page

### Why it is changing

Logging currently posts to `/api/log` → `js/log-core.js` → the Supabase `chat_logs` table.
It has never worked in production: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` were never
set, so `insertChatLogs()` returns `{ stored: false }` and every row is dropped. The client
wants the log off Supabase and readable by Cristina without a developer.

### Architecture

```
browser (js/home-concierge.js)
   │  POST /api/log  { session, page, turns:[…] }
   ▼
normalizeLogPayload()          ← unchanged: validates, clamps, caps 20 turns / 4000 chars
   │
   ▼
storeChatLogs()                ← NEW: replaces insertChatLogs()
   │  writes ONE blob per request — never read-modify-write
   ▼
Vercel Blob
   chats/2026-08-06/<session>/<epoch>-<rand>.json
   │
   ▼
GET /api/chat-log              ← NEW: password-gated reader
   ?list=1        → sessions, newest first
   ?session=<id>  → every blob for that session, merged and time-ordered
   │
   ▼
/chat-log.html                 ← NEW: password form → session list → transcript
```

### Why one blob per request, not one per session

Two chat turns can post concurrently. A read-modify-write against a single per-session blob
would silently lose one of them. Writing an immutable blob per request and merging at read
time removes the race entirely, at the cost of a slightly slower read.

### Auth

- `POST /api/chat-log` with `{ password }`, compared against `CHAT_LOG_PASSWORD` using
  `crypto.timingSafeEqual` on equal-length hashes.
- On success, set an `HttpOnly`, `Secure`, `SameSite=Strict` cookie holding an HMAC of
  `expiry` signed with `CHAT_LOG_SECRET`, valid 8 hours, so Cristina enters the password
  once a day.
- Rate-limit the password endpoint via the existing `js/rate-limit.js` (reuse the pattern in
  `api/log.js`) to stop brute force. Suggested: 10 attempts per 15 minutes per IP.
- The page is `noindex` (meta tag) and added to `robots.txt` as `Disallow: /chat-log.html`.

### Where the page lives

Because `vercel.json` redirects the site root to Shopify, the page is served from the Vercel
deployment at a path **not** in the redirect list:
`https://saia-london.vercel.app/chat-log.html`. Cristina bookmarks it. Confirm no new
redirect rule shadows it.

### Files

| File | Change |
|---|---|
| `js/log-core.js` | keep `normalizeLogPayload` as-is; replace `insertChatLogs` with `storeChatLogs` (Vercel Blob) and add `readChatSessions` / `readChatSession`; keep the "no env → accept and drop" behaviour so local dev needs zero setup |
| `api/log.js` | call `storeChatLogs`; unchanged transport, CORS, rate limit |
| `api/chat-log.js` | **new** — password POST + gated list/read GET |
| `chat-log.html` | **new** — vanilla, brand palette (cream `#F5F1E8`, ink `#2B2620`, terracotta `#B8624A`), semantic HTML, labelled password input, keyboard-navigable session list |
| `server.js` | same storage path locally so dev and prod cannot drift |
| `api/health.js` | `hasSupabase` → `hasBlobStore` |
| `tests/log-core.test.js` | rewrite against the Blob adapter, injected/faked — no network in tests |
| `package.json` | add `@vercel/blob` |
| `CLAUDE.md` | rewrite the "Conversation logging" section |
| `robots.txt` | disallow `/chat-log.html` |

### Env vars the client must set in Vercel

| Var | Where from |
|---|---|
| `BLOB_READ_WRITE_TOKEN` | auto-added by Vercel dashboard → Storage → Blob → Create |
| `CHAT_LOG_PASSWORD` | chosen by the client |
| `CHAT_LOG_SECRET` | any long random string |

Documented in `docs/MANUAL-shopify-steps.md` alongside the Shopify steps. **Without these
the log silently drops rows exactly as it does today** — the acceptance check below must be
run against the deployed site, not just locally.

**Acceptance:** a chat on the live site produces a blob; `/chat-log.html` refuses a wrong
password, accepts the right one, lists the session and renders the transcript in order;
`node --test tests/log-core.test.js` is green.

---

## 9. Swap the quotation and the range grid; flatten the gallery

### 9a. The swap

```
BEFORE                                AFTER
── pinned 3D journey (p 0→1) ──       ── pinned 3D journey (p 0→1) ──
   0.000 hero                            0.000 hero
   0.260 open mat + specs                0.260 open mat + specs
   0.410 how hire works                  0.410 how hire works
   0.520 HIRE THE RANGE ────────┐        0.520 INSTANT QUOTATION ←──┐
   0.600 pilates flow L1        │        0.600 pilates flow L1      │
   …                            │        …                          │
── flat sections ───────────────│──   ── flat sections ─────────────│──
   INSTANT QUOTATION ───────────┘         HIRE THE RANGE ───────────┘
   concierge                              concierge
   gallery                                gallery
```

The band is `data-band="0.44,0.556"`; the chapter stop is `STOPS[3] = 0.520` in
`js/home-journey.js:344`, whose comment updates from *"for every gathering — range grid"* to
*"instant quotation — estimator"*.

### The mobile problem, and the resolution

`index.html:518` already hides `[data-band="0.44,0.556"]` below 767px — on mobile the whole
`#top` pinned journey is replaced by `#mobileJourney`, and the range grid and estimator
appear as ordinary flat sections. So after the swap the estimator must exist **in the pinned
band on desktop and as a flat section on mobile**.

**Resolution: one markup template, two mount points.** The estimator markup is extracted
into a single JS template string and rendered into two `[data-est-mount]` containers — one
inside the pinned band, one in the flat tail. `wire(root)` is already scoped to a root
element (`index.html:1329`), so wiring both instances is a one-line change from
`querySelector` to `querySelectorAll(...).map(wire)`.

Rejected alternatives: duplicating the markup in the HTML (guarantees drift between two
copies in two files — four copies total), and moving one instance with JS at breakpoint
(fragile across resize and orientation change).

Element ids inside the estimator (`estMats`, `estDays`, `estPc`) must be **unique per
instance** — the template takes an instance suffix and `<label for>` is generated to match.
Duplicate ids would silently break every label association and the accessibility of the
form.

### The pinned-typing hazard

Inside a pinned band the wheel and touch handlers are hijacked to snap chapters. Typing a
postcode while the wheel is live would scroll the estimator out from under the user.

**Requirement:** while any focusable element inside the estimator band has focus, the
journey suspends chapter snapping — the wheel/touch/arrow handlers in `js/home-journey.js`
bail out early and native scrolling resumes. Focus leaves, snapping resumes. Implement as a
`journeyPaused` flag set on `focusin` / cleared on `focusout` within the band, checked at
the top of the existing wheel, touch and keydown handlers.

Arrow keys deserve particular care: they currently advance chapters, and they must move the
caret inside a text input instead.

### Accessibility requirement

Bands are absolutely positioned and cross-faded, so an inactive band is invisible but still
in the tab order. With a full form now in a band, an invisible estimator would trap
keyboard focus. **Inactive bands must be `inert`** (or `visibility:hidden`), so Tab cannot
reach a band the user cannot see. Verify by tabbing from the nav through the whole journey.

### The `#estimate` anchor

The nav CTA and drawer link to `href="#estimate"`. Keep `id="estimate"` on the **flat**
section, which is the mobile-visible one. On desktop, intercept clicks on `[href="#estimate"]`
and scroll to the pinned chapter's scroll position — `yForP(0.520)`, using the existing
helper in `js/home-journey.js`. Without this, "Hire mats" on desktop jumps past the journey
to a hidden section.

### 9b. Gallery restyle

Remove the colour treatment and the 3D tilt. **Keep** the scroll pan, the hover zoom and the
warm background glow.

| Remove | Where |
|---|---|
| terracotta/purple multiply tint | `#events .gl-tile::after` + the `--gl-tint` custom property + the JS that sets it |
| white glass sheen over each photo | `#events .gl-tile::before` |
| black-and-white drain on exit | the `grayscale(var(--gl-exit))` filter on `#events .gl-tile img`, the `--gl-exit` opacity/shadow terms, and the JS that sets `--gl-exit` |
| 62° perspective tilt | `rotateX(62deg)` in `#events .gl-stage`; also drop `transform-style:preserve-3d` and the `perspective` / `perspective-origin` on `.gl-sticky` once nothing is in 3D |

| Keep |
|---|
| the per-column scroll pan (`.gl-col` `data-y` transforms) |
| `#events .gl-tile:hover` scale + the image `transform:scale(1.07)` zoom — but the hover applies **no filter change at all**, since `saturate/contrast/brightness` are colour effects |
| `--gl-warm` background glow, `.gl-grain`, the frosted heading card and `--gl-ht` heading dissolve |

The stage keeps a modest `scale()` if it still reads well flat; otherwise `scale(1)`. Tile
`border-radius`, shadow and outline stay — these are what make them read as "proper cards".

Because the tilt is gone, the tiles occupy more vertical space; check the 3-column desktop
grid and the 2-column ≤680px grid still fit `100vh` without clipping, and adjust
`.gl-stage` width or gap rather than reintroducing scale tricks.

The section's `760vh` scroll length is unchanged — the client asked to keep the scroll.

**Acceptance:** photos render in natural colour at every scroll position; no tile is
tilted; the grid still pans on scroll; nothing clips at 1440px, 1024px and 375px.

---

## Implementation split — five agents, ownership by file

Agents are bounded by **file ownership** so two of them can never edit the same file.

```
WAVE 1 — parallel, disjoint file sets
┌─ Agent A · THE BIG PAGE ────────────────────────────────────┐
│ owns  index.html, theme/templates/index.liquid              │
│ does  §1 §2 §3(markup) §4(index only) §5(markup)            │
│       §6(estimator event-date field) §9a swap §9b gallery   │
│ note  largest and riskiest; isolate in a git worktree       │
└─────────────────────────────────────────────────────────────┘
┌─ Agent B · THE BRAIN ───────────────────────────────────────┐
│ owns  js/saia-knowledge.js, js/planner.js,                  │
│       js/saia-examples.js, js/shopify-cart.js,              │
│       js/checkout.js, js/home-concierge.js,                 │
│       js/home-journey.js, tests/{planner,quote,pricing,     │
│       shopify-cart}.test.js                                 │
│ does  §5(logic) §6(dates) §3(bot answers) §4(bot phrasing)  │
│       §9a(journey stops, focus-pause, #estimate intercept)  │
└─────────────────────────────────────────────────────────────┘
┌─ Agent C · THE LOG ─────────────────────────────────────────┐
│ owns  js/log-core.js, api/log.js, api/chat-log.js,          │
│       api/health.js, chat-log.html, server.js,              │
│       robots.txt, package.json, tests/log-core.test.js      │
│ does  §8                                                     │
└─────────────────────────────────────────────────────────────┘
┌─ Agent D · THE SWEEP ───────────────────────────────────────┐
│ owns  every *.html in the repo root EXCEPT index.html and   │
│       chat-log.html; every theme/snippets/*.liquid          │
│ does  §4 across all pages and snippets                      │
└─────────────────────────────────────────────────────────────┘

WAVE 2 — after A, B, C and D land
┌─ Agent E · SYNC, DOCS, VERIFY ──────────────────────────────┐
│ owns  theme/assets/*, theme/snippets/saia-boot.liquid,      │
│       theme/config/settings_schema.json, CLAUDE.md,         │
│       docs/MANUAL-shopify-steps.md                          │
│ does  re-copy js/* → theme/assets/*; drop the one-way       │
│       variant from boot + settings; rewrite the CLAUDE.md    │
│       brand, delivery and logging sections; write the        │
│       manual-steps doc (§5 admin, §7 phone, §8 env vars);    │
│       run node --test tests/*.test.js                        │
└─────────────────────────────────────────────────────────────┘
```

### Cross-agent contracts

These are the only places two agents' work has to meet. Each is stated in both briefs.

1. **`[data-colwrap]`** — Agent A deletes the "After your event" markup block. Agent B must
   not require it: `wire()` drops `colwrap`, `collectionSeg` and the `collection` variable,
   and nothing reads `hire.collection`.
2. **`[data-est-mount]`** — Agent A creates two mount points and the template. Agent B's
   `#estimate` anchor interceptor targets the pinned instance by band, not by id.
3. **`journeyPaused`** — Agent B adds the flag and the handler guards in
   `js/home-journey.js`; Agent A adds the band markup whose `focusin`/`focusout` sets it.
   Agree the flag name before either starts.
4. **`KB.deriveDates()`** — Agent B defines it; Agent A calls it from the estimator to show
   the derived dates back to the customer before *Book now*.
5. **`theme/assets/*` is Agent E's alone.** Agents B and C edit `js/*` only and never copy
   forward — otherwise two agents write the same asset copy.

### Verification, in order

```bash
node --test tests/*.test.js                 # all green — non-negotiable gate
python3 -m http.server 8000                 # then walk index.html at 1440 / 1024 / 375
npm start                                   # concierge on :8787
curl localhost:8787/health                  # hasBlobStore reported
```

Manual walk-through: tab from the nav through the entire journey without focus vanishing
into an invisible band; type a postcode inside the pinned estimator without the page
scrolling away; build a delivery quote and confirm one £90 courier line and four dated cart
attributes; ask the bot "can I buy mats for my studio" and "do you do a discount for 80
mats".

---

## Risks

| Risk | Mitigation |
|---|---|
| Shopify admin not updated → stale £45 rate at checkout | `docs/MANUAL-shopify-steps.md` ships with the code; the client confirms all three steps before the theme is published |
| Vercel env vars not set → chat log silently drops rows, exactly as Supabase did | acceptance check runs against the **deployed** site, not localhost; `/health` reports `hasBlobStore` so it is verifiable at a glance |
| The pinned estimator is unusable on a trackpad | `journeyPaused` on focus; if it still fights the user, fall back to un-pinning the band entirely (the range grid returns to the pin and the estimator stays flat) — decide from the live walk-through, not in advance |
| Two estimator instances drift | single template string, rendered twice; ids suffixed per instance |
| Stale `sessionStorage.saia_hire` carrying `collection:'one'` | ignored rather than trusted, with a regression test |
| Gallery tiles clip once untilted | check 1440 / 1024 / 375 and adjust grid width or gap, not scale |

## Out of scope

- `sample-film.html`, `sample-hybrid.html`, `samples.html`, `tools/lab/*` — stale "60 mats"
  and "A women's club" copy remains; not linked from live nav, redirected on Vercel.
- Renaming the Pilates page or the `Cristina@saialondon.com` address.
- Any purchasable studio-mat product in Shopify — bespoke is enquiry-only.
- Requiring a phone number in the concierge or the demo checkout page (§7 note).
