# SAÏA Assistant — slot-filling brain redesign

**Date:** 2026-06-28
**Status:** Approved design, ready for implementation plan

## Problem

The concierge gives premature, incomplete answers. Asked *"I need 50 mats for next
Saturday"*, it immediately replied *"Added 50 mats. Want a price?"* and showed
`from £425.00` — silently assuming a 2-day hire and ignoring delivery entirely.

Root cause: the brain is **single-shot and stateless**.

- `localPlan(text)` in `js/planner.js` pattern-matches *one* message and fires booking
  actions at once. There is no conversation memory and no concept of "what is still
  missing", so it can never ask a follow-up question.
- The quote math is incomplete: `total()` is literally `mats × £8.50`. Extra days
  (+£1.50/mat/day) and courier (£35–55) never reach the price.
- Tier 2 (Claude, `server.js`) is the same shape — one reply, no slot-filling.

A second issue: the full, correct pricing (including extra-day cost and a postcode→zone
courier classifier) already exists, but **only as a private copy inside the `home.html`
estimator**. The brain and the estimator can drift.

## Goals

1. A **deterministic, stateful slot-filling** hire flow: collect the required details one
   at a time, like a real booking, before showing a price — never assume.
2. **One source of truth for the math**, shared by the estimator, the assistant (Tier 1),
   and Claude (Tier 2).
3. An **itemised quote + explicit confirmation** step instead of a bare total.
4. Rename the user-facing **"Concierge" → "Assistant"** (hard to pronounce); retire the
   "Noor" persona name from anything the user sees, keep the warm British voice.
5. Apply to **both** concierge surfaces (`home.html` and `index.html`/`hero.html`) — the
   brain is shared, so both benefit.

Non-goals: live Addison Lee API quotes (still placeholder zone estimates), payment
processing (checkout link stays a placeholder), changing brand facts/prices.

## Decisions (locked)

- **Architecture:** deterministic guided flow (state machine in the brain). Claude stays
  the Tier-2 fallback for off-script questions only.
- **Name:** "SAÏA Assistant". Drop the word "Concierge" and the persona name "Noor" from
  all user-facing text.
- **Required slots (in order):** mats (or guests → recommend) → days → delivery method
  (deliver + postcode, or NW3 pickup) → **show itemised quote** → event date → confirm.
  Date is asked after the quote because it does not affect the price.

## The conversation flow

```
USER: "I need 50 mats for next Saturday"
  brain parses: mats=50, date="Saturday"; missing: days, method/postcode
ASSISTANT: "Lovely — 50 mats. How many days do you need them? (2-day hire is standard)"
  USER: "just the 2"                  → days=2
ASSISTANT: "Delivered, or collect from our NW3 warehouse?"
  USER: "delivered"                   → method=deliver
ASSISTANT: "What's the event postcode?"
  USER: "EC2Y 8DS"                    → classify → zone=Central
  all priced slots filled → ITEMISED QUOTE
ASSISTANT: "Here's your estimate:
            50 mats · 2 days .............. £425.00
            Courier (Central, both ways) .. from £35.00
            ──────────────────────────────────────────
            from £460.00
            Shall I pencil it in for Saturday and make your checkout link?"
  USER: "yes"                         → confirm → checkout link
```

### State machine

The `hire` object (already persisted by both front ends) gains fields:

| Field | Meaning |
|---|---|
| `mats`, `guests` | existing |
| `days` | hire length (drives extra-day cost) |
| `method` | `'deliver'` \| `'pickup'` |
| `postcode` | raw event postcode (when delivering) |
| `zone` | classifier result: `'central'` \| `'greater'` \| `'outside'` |
| `date` | event date string |
| `total` | computed via `priceHire` |
| `status` | existing |
| `awaiting` | the slot the brain just asked for (`'mats'`,`'days'`,`'method'`,`'postcode'`,`'date'`,`'confirm'`, or null) |

Each turn the brain:

1. **Parses** the message. If `awaiting` is set, interpret bare answers in that context —
   a lone number while awaiting `days` means days, not mats; a day word while awaiting
   `date` means the date; deliver/pickup/collect keywords set the method; a postcode
   regex sets the postcode.
2. **Fills** the matched slot(s) and recomputes the quote.
3. **Finds the next missing required slot**, sets `awaiting`, and asks for it. When all
   priced slots are filled it presents the itemised quote and asks for the date, then
   confirmation.

This is idempotent and gap-driven: the brain always asks for the first still-missing
slot, so a user who volunteers several details in one sentence skips ahead naturally.

### Disambiguation rules

| Incoming | When `awaiting` is… | Interpreted as |
|---|---|---|
| bare number (`"3"`, `"the 2"`) | `days` | days |
| bare number | `mats` (or none) | mats |
| `deliver`/`drop off`/`pickup`/`collect` | any | method |
| postcode regex (`/^[A-Z]{1,2}\d/i`) | any | postcode → classify |
| day word (`saturday`, `tomorrow`, `next week`) | any | date |
| `yes`/`confirm`/`book it` | `confirm` | confirm |

## Pricing — single source of truth

Lift the estimator's math into the shared layer (`js/saia-knowledge.js`), exported for
both browser (`window.SAIA.KB`) and Node (`require`).

```
KB.delivery = {
  zones: { central: { label: 'Zone 1 · Central London', round: 35 },
           greater: { label: 'Zone 2 · Greater London', round: 45 } },
  central: ['EC1','EC2','EC3','EC4','WC1','WC2','W1','SW1','SE1','N1','NW1','E1','W2'],
  london:  ['E','EC','N','NW','SE','SW','W','WC'],
  outer:   ['BR','CR','DA','EN','HA','IG','KT','RM','SM','TW','UB','WD'],
}
```

Two shared helpers (lifted verbatim in behaviour from the current estimator):

- `classify(postcode)` → `{ label, round }` for central/greater, `{ label:'outside',
  round:null }` for outside London, or `null` if unparseable.
- `priceHire(hire)` → returns:

  ```
  {
    matCost,           // mats*8.50 + mats*1.50*max(0, days-2)
    deliveryLabel,     // "Central, both ways" | "Greater London" | "Pickup (free)" | "By quote"
    deliveryCost,      // number, 0 for pickup, or null when outside London (quote only)
    total,             // matCost + deliveryCost, or null when quoteOnly
    quoteOnly,         // true when zone is outside London
  }
  ```

`home.html`'s estimator is refactored to call `classify`/`priceHire` instead of its
private `classify()`/inline formula. Behaviour and numbers stay identical.

## applyActions — extended executor

`applyActions(hire, actions)` stays the single deterministic booking executor for both
tiers. New/changed tools:

| Tool | Args | Effect |
|---|---|---|
| `set_days` | `{ n }` | sets `hire.days` |
| `set_method` | `{ method }` | sets `hire.method` (`deliver`/`pickup`) |
| `set_postcode` | `{ pc }` | sets `hire.postcode`, runs `classify` → `hire.zone` |
| `quote` (changed) | — | recomputes `hire.total` via `priceHire` (mats + days + delivery) |
| existing | — | `add_mats, set_event, recommend, set_date, book_delivery, checkout, confirm, rsvp_event, book_pilates, join_newsletter` unchanged |

Tool count grows from 11 to 14.

## Tier 2 (server.js) — fallback only

- Extend the JSON-schema `enum` and the action list with `set_days`, `set_method`,
  `set_postcode`.
- Update `systemPrompt()`: instruct Claude to **ask for missing slots one at a time and
  never assume the number of days**, give it the zone facts, and keep it computing nothing
  itself (still emits actions; the app does the math via `priceHire`).
- Still fires only when Tier 1 misses; on any error the front end falls back to Tier 1.

## UI changes (both surfaces)

- Replace the bare "from £X" basket with an **itemised quote card**: mats·days line,
  courier/zone line, total (or "+ delivery quote" when outside London).
- Render the **confirm** step (date prompt → confirm → checkout link).
- `js/home-concierge.js` and `js/concierge-ui.js`: pass the current `hire` into the brain
  (`localPlan(text, hire)`), persist the new slots, and store the returned `awaiting`.
- Fix `seedEstimate` in `home-concierge.js` so an estimate handed over from the
  `home.html` estimator drops the user straight into the flow with slots pre-filled.
- Rename headers/greetings: `SAÏA CONCIERGE` → `SAÏA ASSISTANT`; drop "Noor".

## Files touched

| File | Change |
|---|---|
| `js/saia-knowledge.js` | delivery zones + `classify()` + `priceHire()` (single source) |
| `js/planner.js` | `localPlan(text, hire)` stateful slot-filling; new actions; `quote` uses `priceHire` |
| `js/home-concierge.js` | pass hire to brain, persist slots, itemised quote + confirm UI, fix `seedEstimate`, rename |
| `js/concierge-ui.js` | same brain wiring + itemised quote UI for index/hero |
| `server.js` | Tier-2 schema + prompt updates |
| `home.html` | estimator reuses shared math; header rename |
| `index.html` / `hero.html` | header rename |

## Phasing

1. **Shared math** — zones + `classify` + `priceHire` in `saia-knowledge.js`; refactor
   `home.html` estimator to use it (verify estimator numbers unchanged).
2. **Brain** — stateful `localPlan(text, hire)` + extended `applyActions` in `planner.js`.
3. **Tier 2** — `server.js` schema + prompt.
4. **home.html UI** — wire brain, itemised quote, confirm, `seedEstimate`, rename.
5. **index/hero UI** — same wiring in `concierge-ui.js`, rename headers.

Each phase is verified before the next.

## Verification

- Manual: run `npm start` + `python3 -m http.server 8000`, open the assistant, type
  *"I need 50 mats for next Saturday"* and confirm it asks for days → delivery → postcode,
  then shows an itemised quote (mats+days+courier) and asks to confirm.
- Estimator on `home.html` still produces identical totals after the refactor.
- With the endpoint off, Tier 1 still drives the whole flow (no network needed).
