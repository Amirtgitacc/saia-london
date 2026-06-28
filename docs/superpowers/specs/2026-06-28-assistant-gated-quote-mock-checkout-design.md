# SAÏA Assistant — gated quote + mock checkout

**Date:** 2026-06-28
**Status:** Approved design, ready for implementation plan
**Builds on:** `2026-06-28-saia-assistant-slot-filling-brain-design.md` (the slot-filling brain)

## Problem

The assistant quotes too early and presents a confusing, half-finished booking.

- The home basket card renders the instant a mat count exists (`basketEl`:
  `if (!h.mats && !h.status) return null;`). So typing "15 mats" immediately shows a
  card with a `To checkout →` button — before days, delivery, or date are known.
- With delivery unknown, the total line reads `£127.50 + quote` (15 × £8.50, plus
  "+ quote" because `priceHire` returns `total: null`). This is meaningless to a user.
- The CTA says "checkout", implying payment, when nothing is gathered or payable.

The user wants: **ask all the proper questions first, gather every element, and only
then present a single clear quote with a Book button** — and Book should lead to a
(mock) payment page, not a bare "checkout".

## Goals

1. Show **nothing priced** (no card, no total, no button) until every required detail is
   collected. Collect them one question at a time.
2. When complete, show **one clearly-itemised quote** with a single **Total to pay** — no
   "+ quote" ambiguity for London zones.
3. The CTA is **Book this hire**, leading to a **mock pre-filled payment page** that
   demonstrates the checkout flow (no real processing).
4. Apply to **both** surfaces: `home.html` and `index.html`/`hero.html`.

Non-goals: real payment processing, live courier API, real order persistence. The
checkout page is an explicitly-labelled demo.

## Decisions (locked)

- **Gating:** during collection, render nothing priced. The quote card appears only when
  the hire is complete.
- **Book action:** firm-total hires (pickup / Central / Greater) → navigate to a mock
  payment page pre-filled from the conversation. Outside-London (no firm courier price) →
  WhatsApp Cristina handoff instead (you cannot mock-pay an unknown total).
- **Checkout page fields:** Name (required), Address (required), Email (optional), Phone
  (optional) — at least one of email/phone encouraged. Card fields are demo-only.
- **Button label:** "Book this hire →".
- **Scope:** both front ends.

## What "complete" means

```
hireComplete(hire) === true  ⟺
  mats   present and ≥ KB.hire.minMats (10)
  days   present (≥ KB.hire.hireDays, default 2)
  method present:  'pickup'  OR  ('deliver' AND zone resolved)
  date   present
```

`zone resolved` includes `'outside'` (it is a known answer — courier is just by quote).
A shared `hireComplete(hire)` helper is the single gate used by both front ends and by the
planner to decide when to present the quote.

## The conversation (unchanged order, later reveal)

The slot-filling order is unchanged, but the date is now asked **before** any quote, and
the quote is revealed only at the end:

```
mats → days → delivery method → (postcode if deliver) → date → [COMPLETE → quote + Book]
```

```
USER: "15 mats"
ASSISTANT: "Lovely — 15 mats. How many days do you need them? (2-day hire is standard.)"
   (no card)
USER: "2"        ASSISTANT: "Deliver by courier, or collect from our NW3 warehouse?"
USER: "deliver"  ASSISTANT: "What's the event postcode?"
USER: "NW1 4RY"  ASSISTANT: "And what date is your event?"
USER: "next Saturday"
   → hireComplete → ASSISTANT: "That's everything. Here's your full quote below —
                                press Book this hire when you're ready."
   → quote card renders, with the Book button
```

The planner's end-state changes: when only the date is missing it asks for the date
(no quote). When all slots are in, it emits the `quote` action (to compute the total) and
returns a "ready" message with `awaiting: null`. The old standalone "confirm" text step is
removed from the happy path — the **Book button** replaces it.

## The quote card (rendered only when complete)

Itemised, using the **correct** `priceHire` math (£8.50 is the **2-day** rate, not
per-day):

```
matCost   = mats × £8.50  +  mats × £1.50 × max(0, days − 2)
deposit   = mats × £1.50            (refundable, returned after collection)
courier   = pickup 0 | Central £35 | Greater £45 | outside → by quote
total     = matCost + courier + deposit        (null when outside London)
```

Example — **15 mats, 2 days, Central delivery**:

```
┌─ YOUR HIRE ─────────────────────────────────────┐
│ 15 mats · 2-day hire                             │
│ Mats (2-day hire)        15 × £8.50      £127.50 │
│ Extra days               none                  — │
│ Delivery & collection    Courier · Central £35.00│
│ Refundable deposit       15 × £1.50       £22.50 │
│ ──────────────────────────────────────────────  │
│ TOTAL TO PAY                             £185.00 │
│ £22.50 of that is returned after collection      │
│ Event: Sat · delivered the day before, collected │
│        the day after                             │
│                                                  │
│              [  Book this hire →  ]               │
└──────────────────────────────────────────────────┘
```

A 3-day hire adds an "Extra days" line: `15 × £1.50 × 1 = £22.50`, total £207.50.

**Outside London** variant (no firm courier price):

```
│ Mats (2-day hire)        15 × £8.50      £127.50 │
│ Delivery & collection    confirmed by Cristina   │   ← not a number
│ Refundable deposit       15 × £1.50       £22.50 │
│ ──────────────────────────────────────────────  │
│ SUBTOTAL (excl. courier)                 £150.00 │   ← clear subtotal, not "+ quote"
│ Cristina will confirm your courier and total.    │
│              [  Book this hire →  ]               │   → WhatsApp handoff
```

Date handling: dates are free text ("Saturday", "next week"). The card shows the event
date and the phrase "delivered the day before, collected the day after" — it does **not**
compute exact calendar dates from vague input.

## Book → mock payment page

New `checkout.html` + `js/checkout.js`, on-brand (cream `#F5F1E8`, ink `#2B2620`,
terracotta `#B8624A`; same fonts as `home.html`: Playfair Display + Inter). Clearly marked
**Demo — no real payment is taken.**

Flow: the Book button writes the hire to `sessionStorage` under key `saia_hire`
(JSON: `{mats, days, method, postcode, zone, date, matCost, deliveryCost, deliveryLabel,
deposit, total, quoteOnly}`) then navigates to `checkout.html`. `checkout.js` reads it and
renders:

```
┌─ CHECKOUT · demo ───────────────────────────────┐
│  ORDER SUMMARY  (pre-filled, read-only)          │
│  15 mats · 2-day hire · courier Central · Sat    │
│  Mats £127.50 · Courier £35.00 · Deposit £22.50  │
│  TOTAL TO PAY .......................... £185.00  │
│  (£22.50 refundable deposit included)            │
│                                                  │
│  YOUR DETAILS                                    │
│  Name*     [__________________]                  │
│  Address*  [__________________]                  │
│  Email     [__________________]                  │
│  Phone     [__________________]                  │
│  (* required · add an email or phone so Cristina │
│   can confirm)                                   │
│                                                  │
│  PAYMENT · demo, no real charge                  │
│  Card [____ ____ ____ ____]  Exp [__/__] CVC [__]│
│                                                  │
│             [  Pay £185.00 →  ]                   │
└──────────────────────────────────────────────────┘
        → mock success panel: "Booking received.
          Cristina will confirm your courier and be
          in touch shortly."
```

Behaviour:

- **Pre-fill:** order summary is filled from `saia_hire`. Contact/card fields start empty
  for the user to type.
- **Validation (light, client-side):** Name and Address required; the Pay button is
  disabled until both are filled. Card fields are not validated (demo).
- **Pay button:** shows the mock success panel; nothing is sent anywhere. No real charge.
- **Direct visit / empty `saia_hire`:** show a gentle "Start your hire with the assistant"
  message + link back to `home.html`, rather than an empty form.
- **Outside-London hires never reach this page** — their Book button goes to WhatsApp
  (`https://wa.me/447444611914?text=...` pre-filled with the hire details), because the
  total isn't firm.

## Shared helpers (single source)

In `js/saia-knowledge.js` (so both front ends + the planner agree):

- `KB.hireComplete(hire)` → boolean, per the rules above.
- `KB.quoteLines(hire)` → an ordered array of `{label, value}` display rows
  (mats line, extra-days line if any, delivery line, deposit line) plus a resolved
  `{total, subtotal, quoteOnly}` — built from `KB.priceHire`. Both the card and the
  checkout page render from this, so they can never disagree.

## Files

| File | Change |
|---|---|
| `js/saia-knowledge.js` | add `hireComplete(hire)` + `quoteLines(hire)` (shared) |
| `js/planner.js` | ask date before quoting; end-state returns "ready" (quote + Book), drop the happy-path "confirm" text step |
| `js/home-concierge.js` | gate `basketEl` behind `hireComplete`; richer itemised card; Book button → `gotoCheckout`/WhatsApp |
| `js/concierge-ui.js` | gate the index/hero hire panel behind `hireComplete`; add Book button |
| `index.html` / `hero.html` | add a hidden-until-complete Book button to the hire panel |
| `checkout.html` *(new)* | mock payment page markup (on-brand, Demo-labelled) |
| `js/checkout.js` *(new)* | read `saia_hire`, render summary, light validation, mock success |
| `server.js` | Tier-2 wording: collect all details before quoting; say "Book", not "checkout" |

A small shared `gotoCheckout(hire)` (writes `sessionStorage` + navigates) lives in a place
both front ends can call — e.g. on `window.SAIA` from `saia-knowledge.js` or a tiny
`js/checkout-handoff.js`. The plan will pick the exact location.

## Verification

- Manual: `python3 -m http.server 8000`, open `home.html`, type "15 mats" — **no card
  appears**; it asks days → delivery → postcode → date; only then does the itemised card
  with **Total to pay £185.00** and **Book this hire** show. Book → `checkout.html`
  pre-filled; Name+Address required to enable Pay; Pay → mock success.
- Outside-London postcode (e.g. `M1 1AA`) → card shows subtotal + "confirmed by Cristina";
  Book → WhatsApp with details.
- Same gating + Book on index/hero.
- `hireComplete` / `quoteLines` unit-tested (`node --test`): incomplete hire → false / no
  card; complete hire → correct line items and total.
- Existing 29 brain tests still pass.
