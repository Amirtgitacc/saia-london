# SAÏA London — August 2026 Site Adjustments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship nine client-requested changes — a 50-mat cap in all copy, simplified gallery and studio copy, "Cristina"→"us" in CTAs, a symmetric delivery model, four dates on every booking, a phone number required at checkout, chat logs on Vercel Blob behind a password page, and a swap of the quotation and range-grid sections with a flattened gallery.

**Architecture:** Five agent tracks bounded by **file ownership**, so no two agents ever edit the same file. Track B (shared JS brain) and Track C (logging) are independent and run first; Track A (the homepage) consumes two interfaces from B; Track D (copy sweep) is independent throughout; Track E syncs the Shopify theme assets, rewrites docs and runs the final gate.

**Tech Stack:** Dependency-free vanilla JS (ES5 style in `js/*`, ES6 in `js/home-journey.js`), Node 18+ with `node:test`, Vercel serverless functions (CommonJS), `@vercel/blob`, Shopify Liquid.

**Spec:** `docs/superpowers/specs/2026-08-06-site-adjustments-design.md`

---

## Global Constraints

Every task's requirements implicitly include this section.

- **Mat cap is 50.** `KB.hire.maxMats = 50`. Never write a number above 50 as a bookable mat quantity. Over 50 → suggest staggered/reused sessions.
- **Mats are HIRE ONLY**, with one new exception: studios may commission **bespoke mats made to order — enquiry only, by email**. No price, no online purchase, no checkout path for bespoke. The concierge must never quote a bespoke price.
- **No bulk discount.** £8.50/mat flat, whatever the size of the booking.
- **Delivery is symmetric.** Either we handle both legs (£90 flat London) or the customer handles both legs (free NW3 pickup). `hire.collection` no longer exists. The £45 one-way option is deleted.
- **Voice:** warm, female-led, unpretentious, **British English**. English-only project. **No em dashes** in bot-facing copy. No gushing openers.
- **Contact:** `Cristina@saialondon.com` (unchanged) + WhatsApp `07444 611 914`. NW3 area.
- **Palette:** cream `#F5F1E8`, ink `#2B2620`, terracotta `#B8624A`.
- **Cristina→us rule:** change `Cristina` to `us`/`we` **only** in contact instructions and service promises. Keep every biographical mention, the Pilates instructor role, page/nav titles, filenames and the email address.
- **Never remove existing UI elements** unless the task says to.
- **Accessibility is mandatory:** semantic HTML, `aria-label`s, alt text, keyboard navigation, visible focus indicators, sufficient contrast.
- **Prices live in exactly two places now** and must match: `KB.delivery.twoWay` in `js/saia-knowledge.js` and the Shopify courier variant price.
- **Test gate:** `node --test tests/*.test.js` must be green before any commit that touches `js/*` or `api/*`.
- **Cache-busting:** when editing any file under `js/`, bump its `?v=` query string in `index.html` (and `theme/templates/index.liquid`) or browsers run stale code.

---

## File Structure

| File | Owner | Responsibility after this plan |
|---|---|---|
| `js/saia-knowledge.js` | B | Single source of facts; adds `deriveDates`/`formatDate`/`hire.bespoke`; loses `delivery.oneWay` |
| `js/planner.js` | B | Tier-1 brain; loses the `collection` slot and `set_collection` tool (13→12) |
| `js/shopify-cart.js` | B | Cart builder; one courier variant, four dated attributes |
| `js/saia-examples.js` | B | Tier-2 gold examples; studio-bespoke answer, no bulk-discount claims |
| `js/checkout.js` | B | Demo checkout; renders four dates |
| `js/home-concierge.js` | B | Concierge UI chips + canned mode replies |
| `js/home-journey.js` | B | Pinned scroll; adds `journeyPaused`, `#estimate` interception |
| `js/log-core.js` | C | Log validation + **Vercel Blob** storage and reads |
| `api/log.js`, `api/health.js` | C | Write endpoint, health report |
| `api/chat-log.js` | C | **new** — password auth + gated read endpoint |
| `chat-log.html` | C | **new** — Cristina's transcript viewer |
| `index.html` | A | Homepage: copy, estimator template, the swap, the gallery |
| `theme/templates/index.liquid` | A | Shopify mirror of the above |
| all other root `*.html`, `theme/snippets/*.liquid` | D | Cristina→us copy sweep |
| `theme/assets/*`, `theme/snippets/saia-boot.liquid`, `theme/config/settings_schema.json` | E | Theme sync + variant config |
| `CLAUDE.md`, `docs/MANUAL-shopify-steps.md` | E | Rules and the client's manual checklist |

### Dependency graph

```
WAVE 1 (parallel)          WAVE 2              WAVE 3
┌─ Track B (B1…B9) ─┐──────► Track A (A1…A8) ──┐
├─ Track C (C1…C6) ─┤                          ├──► Track E (E1…E5)
└─ Track D (D1…D2) ─┘──────────────────────────┘
```

Track A cannot start until **B2** (`KB.deriveDates`), **B8** (`journeyPaused`) and **B9** (`inert` bands) are committed. A1 and A2 are safe to start earlier if useful — only A4 and A5 touch those interfaces.

### Cross-agent contracts

1. **`[data-colwrap]`** — A deletes the markup (A2); B must not require it. `wire()` drops `colwrap`, `collectionSeg`, the `collection` variable.
2. **`KB.deriveDates(hire)`** — B2 defines it, A4 consumes it. Exact signature in B2's Interfaces block.
3. **`window.SAIA.journeyPaused` + `[data-journey-pause]`** — B8 defines the flag and the handler guards; A5 adds `data-journey-pause` to the band. Names are fixed, do not rename. B9 makes faded bands `inert`; A5 verifies it landed rather than editing that file.
4. **`[data-est-mount]`** — A3 creates two mount points; B8's `#estimate` interceptor targets the pinned band by `data-band`, never by id.
5. **`theme/assets/*` belongs to E alone.** B and C edit `js/*` and never copy forward.

---

# TRACK B — THE BRAIN

**Owns:** `js/saia-knowledge.js`, `js/planner.js`, `js/saia-examples.js`, `js/shopify-cart.js`, `js/checkout.js`, `js/home-concierge.js`, `js/home-journey.js`, `tests/{quote,pricing,planner,shopify-cart}.test.js`

---

### Task B1: Delete the one-way delivery price

**Files:**
- Modify: `js/saia-knowledge.js:97-107` (`KB.delivery`), `js/saia-knowledge.js:173-186` (`priceHire`), `js/saia-knowledge.js:186-190` (`quoteLines` delivery row), `js/saia-knowledge.js:38` (`KB.hire.delivery` prose)
- Test: `tests/quote.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `KB.delivery` with `twoWay: 90` and **no** `oneWay`. `KB.priceHire(hire)` ignores `hire.collection` entirely.

- [ ] **Step 1: Write the failing tests**

Append to `tests/quote.test.js`:

```js
test('KB.delivery no longer carries a one-way price', () => {
  assert.strictEqual(KB.delivery.oneWay, undefined);
  assert.strictEqual(KB.delivery.twoWay, 90);
});

test('a stale collection:"one" is ignored and still prices as two-way', () => {
  const q = KB.priceHire({ mats: 20, days: 2, method: 'deliver', zone: 'central', collection: 'one' });
  assert.strictEqual(q.deliveryCost, 90);
  assert.strictEqual(q.deliveryLabel, 'Courier · delivery + same-day collection · Central London');
});

test('a stale collection:"one" does not change the quote line label', () => {
  const q = KB.quoteLines({ mats: 20, days: 2, method: 'deliver', zone: 'greater', collection: 'one', date: 'Sat' });
  const row = q.lines.find(l => l.label === 'Delivery & collection');
  assert.ok(row, 'delivery row should always read "Delivery & collection"');
  assert.strictEqual(row.value, '£90.00');
  assert.ok(!q.lines.some(l => l.label === 'Delivery only'));
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/quote.test.js`
Expected: FAIL — `KB.delivery.oneWay` is `45`, and the stale-collection quote returns `45`.

- [ ] **Step 3: Delete `oneWay` from `KB.delivery`**

In `js/saia-knowledge.js`, replace the `KB.delivery` block header comment and the object:

```js
  /* ---- delivery zones + pricing (single source, lifted from the home estimator) ----
     Flat London courier pricing, matched 1:1 to the Shopify "Courier delivery" product:
       twoWay £90 = delivery + same-day collection. This is the ONLY courier option —
       either we handle both legs, or the customer handles both legs by collecting from
       and returning to NW3 (free). There is no mixed "we deliver, you return" option.
     Zones only decide the label and the outside-London → quote-by-WhatsApp case. */
  KB.delivery = {
    twoWay: 90,
    zones: {
      central: { key: 'central', label: 'Zone 1 · Central London' },
      greater: { key: 'greater', label: 'Zone 2 · Greater London' },
    },
    central: ['EC1', 'EC2', 'EC3', 'EC4', 'WC1', 'WC2', 'W1', 'SW1', 'SE1', 'N1', 'NW1', 'E1', 'W2'],
    london: ['E', 'EC', 'N', 'NW', 'SE', 'SW', 'W', 'WC'],
    outer: ['BR', 'CR', 'DA', 'EN', 'HA', 'IG', 'KT', 'RM', 'SM', 'TW', 'UB', 'WD'],
  };
```

- [ ] **Step 4: Strip `oneWay` out of `priceHire`**

Replace the collection block inside `KB.priceHire`:

```js
    // Delivery is symmetric: we do both legs (£90 flat London) or the customer does both
    // legs (free NW3 pickup). hire.collection is legacy and deliberately ignored — an old
    // sessionStorage hire carrying collection:'one' must not resurrect a £45 price.
    var deliveryCost = null, deliveryLabel = null, quoteOnly = false;
    if (hire.method === 'pickup') {
      deliveryCost = 0; deliveryLabel = 'Pickup from NW3 · free';
    } else if (hire.zone === 'outside') {
      deliveryCost = null; deliveryLabel = 'Courier · by quote'; quoteOnly = true;
    } else if (hire.zone === 'central' || hire.zone === 'greater') {
      deliveryCost = KB.delivery.twoWay;
      deliveryLabel = 'Courier · delivery + same-day collection · '
        + (hire.zone === 'central' ? 'Central London' : 'Greater London');
    }
```

- [ ] **Step 5: Fix the `quoteLines` delivery row**

Replace the `if (q.deliveryLabel)` block:

```js
    if (q.deliveryLabel) {
      lines.push({
        label: 'Delivery & collection',
        detail: q.deliveryLabel,
        value: q.deliveryCost == null ? 'confirmed by us' : (q.deliveryCost === 0 ? 'free' : money(q.deliveryCost)),
      });
    }
```

Note `'confirmed by Cristina'` → `'confirmed by us'` — this is the §4 rule applied in place.

- [ ] **Step 6: Rewrite the delivery prose**

Replace `KB.hire.delivery` (line ~38):

```js
      delivery: 'Same-day Addison Lee courier from our NW3 base — £90 flat across London for delivery plus same-day collection after your event. Or collect from and return to our NW3 base yourself, which is free. It is one or the other: either we handle both journeys or you do. We work to a 6-hour delivery window, so early or morning events are usually delivered the day before.',
```

- [ ] **Step 7: Run the tests**

Run: `node --test tests/quote.test.js tests/pricing.test.js`
Expected: PASS. If `tests/pricing.test.js` has a one-way case, delete that test — the option no longer exists.

- [ ] **Step 8: Commit**

```bash
git add js/saia-knowledge.js tests/quote.test.js tests/pricing.test.js
git commit -m "feat(delivery): delete the one-way courier option, delivery is now symmetric"
```

---

### Task B2: Add `KB.deriveDates()` and `KB.formatDate()`

**Files:**
- Modify: `js/saia-knowledge.js` (add after `KB.classify`)
- Test: `tests/quote.test.js`

**Interfaces:**
- Consumes: nothing
- Produces — **Track A consumes these exact signatures:**
  - `KB.deriveDates(hire, todayISO?) -> { booking, event, delivery, collection } | null`
    All values are `'YYYY-MM-DD'` strings. Returns `null` when `hire.date` is not an ISO date.
    `booking` = `todayISO` or today in Europe/London. `delivery` = event − 1 day. `collection` = event + (days − 2), minimum the event date.
  - `KB.formatDate(iso) -> 'Sat 14 Mar 2026'`, or `''` for a falsy/invalid input.
  - `KB.dateLabels(hire) -> { delivery, collection }` — human labels that swap for pickup:
    `{ delivery: 'Delivery date', collection: 'Collection date' }` for `method !== 'pickup'`,
    `{ delivery: 'Pickup from NW3', collection: 'Return to NW3' }` for pickup.

- [ ] **Step 1: Write the failing tests**

Append to `tests/quote.test.js`:

```js
test('deriveDates: standard 2-day hire is delivered the day before, collected on the day', () => {
  const d = KB.deriveDates({ date: '2026-03-14', days: 2, method: 'deliver' }, '2026-03-03');
  assert.deepStrictEqual(d, {
    booking: '2026-03-03', event: '2026-03-14', delivery: '2026-03-13', collection: '2026-03-14',
  });
});

test('deriveDates: a 4-day hire treats the event date as the start', () => {
  const d = KB.deriveDates({ date: '2026-03-14', days: 4, method: 'deliver' }, '2026-03-03');
  assert.strictEqual(d.delivery, '2026-03-13');
  assert.strictEqual(d.collection, '2026-03-16');
});

test('deriveDates: crossing the BST boundary does not shift a date', () => {
  // 29 Mar 2026 is the UK clock change. Naive UTC maths slips this by a day.
  const d = KB.deriveDates({ date: '2026-03-29', days: 2, method: 'deliver' }, '2026-03-01');
  assert.strictEqual(d.delivery, '2026-03-28');
  assert.strictEqual(d.collection, '2026-03-29');
});

test('deriveDates: crossing a month and a leap day', () => {
  const d = KB.deriveDates({ date: '2028-03-01', days: 2, method: 'deliver' }, '2028-02-01');
  assert.strictEqual(d.delivery, '2028-02-29');
});

test('deriveDates: no usable event date returns null', () => {
  assert.strictEqual(KB.deriveDates({ date: 'Saturday', days: 2 }, '2026-03-03'), null);
  assert.strictEqual(KB.deriveDates({ days: 2 }, '2026-03-03'), null);
});

test('formatDate renders a British short date', () => {
  assert.strictEqual(KB.formatDate('2026-03-14'), 'Sat 14 Mar 2026');
  assert.strictEqual(KB.formatDate(''), '');
});

test('dateLabels swap for a pickup hire', () => {
  assert.deepStrictEqual(KB.dateLabels({ method: 'deliver' }), { delivery: 'Delivery date', collection: 'Collection date' });
  assert.deepStrictEqual(KB.dateLabels({ method: 'pickup' }), { delivery: 'Pickup from NW3', collection: 'Return to NW3' });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/quote.test.js`
Expected: FAIL — `KB.deriveDates is not a function`.

- [ ] **Step 3: Implement**

Add to `js/saia-knowledge.js`, after `KB.classify`:

```js
  /* ---- booking dates ----------------------------------------------------------
     Every booking carries four dates. The customer enters ONE (the event date);
     the other three are derived, so there is nothing extra to ask for.
       booking    = the day the order was placed
       event      = what the customer told us (the START of the event)
       delivery   = the day before the event (our 2-day hire basis)
       collection = the event day, plus any extra days beyond the 2-day base
     All maths runs on the Y/M/D parts as plain integers. Do NOT round-trip these
     through Date.toISOString(): a London date near a clock change slips by a day. */
  var DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

  // 'YYYY-MM-DD' + n days -> 'YYYY-MM-DD'. Uses UTC internally so no DST shift is possible.
  function shiftISO(iso, n) {
    var m = ISO_RE.exec(iso || '');
    if (!m) return null;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    d.setUTCDate(d.getUTCDate() + n);
    var mm = d.getUTCMonth() + 1, dd = d.getUTCDate();
    return d.getUTCFullYear() + '-' + (mm < 10 ? '0' : '') + mm + '-' + (dd < 10 ? '0' : '') + dd;
  }

  KB.todayISO = function () {
    // 'en-CA' formats as YYYY-MM-DD; the timeZone keeps it a London date, not a UTC one.
    try {
      return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  };

  KB.deriveDates = function (hire, todayISO) {
    hire = hire || {};
    var event = ISO_RE.test(String(hire.date || '')) ? hire.date : null;
    if (!event) return null;
    var days = Math.max(KB.hire.hireDays, parseInt(hire.days, 10) || KB.hire.hireDays);
    return {
      booking: ISO_RE.test(String(todayISO || '')) ? todayISO : KB.todayISO(),
      event: event,
      delivery: shiftISO(event, -1),
      collection: shiftISO(event, days - KB.hire.hireDays),
    };
  };

  KB.formatDate = function (iso) {
    var m = ISO_RE.exec(iso || '');
    if (!m) return '';
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return DAY_NAMES[d.getUTCDay()] + ' ' + (+m[3]) + ' ' + MONTH_NAMES[+m[2] - 1] + ' ' + m[1];
  };

  KB.dateLabels = function (hire) {
    return (hire && hire.method === 'pickup')
      ? { delivery: 'Pickup from NW3', collection: 'Return to NW3' }
      : { delivery: 'Delivery date', collection: 'Collection date' };
  };
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/quote.test.js`
Expected: PASS, all seven new tests included.

- [ ] **Step 5: Commit**

```bash
git add js/saia-knowledge.js tests/quote.test.js
git commit -m "feat(dates): derive booking/event/delivery/collection dates from one event date"
```

---

### Task B3: Remove the `collection` slot from the planner

**Files:**
- Modify: `js/planner.js` — `applyActions` case at :77-81, `RETURN_ONE`/`RETURN_TWO`/`collectReturn` at :145-151, `inHireFlow` regex at :165, the `aw === 'collection'` block at :170-186, the mid-flow one-way branch at :271-275, the `need()` ladder at :290, the `confirm` reply at :214
- Test: `tests/planner.test.js`

**Interfaces:**
- Consumes: `KB.delivery` without `oneWay` (B1)
- Produces: 12 tools — `add_mats, set_event, recommend, set_date, set_collection` **removed**, leaving `add_mats, set_event, recommend, set_date, set_method, set_postcode, quote, book_delivery, checkout, confirm, rsvp_event, request_pilates, join_pilates_list, join_newsletter`. Slot ladder is `mats → days → method → postcode → date → confirm`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/planner.test.js` (match the file's existing import/helper style — read the top of the file first and reuse whatever `localPlan`/`applyActions` handles it already defines):

```js
test('the hire ladder goes straight from postcode to date, with no collection step', () => {
  const hire = { mats: 20, days: 2, method: 'deliver', zone: 'central', postcode: 'EC2Y 8DS', awaiting: 'postcode' };
  const r = localPlan('EC2Y 8DS', hire);
  assert.ok(r.matched);
  assert.strictEqual(r.awaiting, 'date', 'after a postcode the next question is the event date');
  assert.ok(!/collect|return the mats|both ways/i.test(r.say), 'must not ask about the return journey');
});

test('set_collection is no longer a tool', () => {
  const hire = { mats: 20, days: 2, method: 'deliver', zone: 'central' };
  applyActions(hire, [{ tool: 'set_collection', args: { collection: 'one-way' } }]);
  assert.strictEqual(hire.collection, undefined, 'an unknown tool must not set collection');
});

test('"I will bring them back myself" is read as NW3 pickup, not a one-way delivery', () => {
  const hire = { mats: 20, days: 2, awaiting: 'method' };
  const r = localPlan("we'll collect them ourselves from NW3", hire);
  assert.ok(r.actions.some(a => a.tool === 'set_method' && a.args.method === 'pickup'));
  assert.ok(!r.actions.some(a => a.tool === 'set_collection'));
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/planner.test.js`
Expected: FAIL — the ladder still returns `awaiting: 'collection'`.

- [ ] **Step 3: Delete the `set_collection` case from `applyActions`**

Remove lines 77-81 of `js/planner.js` entirely (the `case 'set_collection':` block). Leave `case 'set_method':` but drop its `hire.collection = null;` assignment:

```js
        case 'set_method':
          hire.method = (args.method === 'pickup') ? 'pickup' : 'deliver';
          if (hire.method === 'pickup') { hire.postcode = null; hire.zone = null; }
          acts.push(hire.method === 'pickup' ? 'Collection from NW3 selected' : 'Courier delivery selected'); break;
```

(Keep whatever line 75 currently does between the assignment and `acts.push` — do not delete it.)

- [ ] **Step 4: Delete the return-journey matchers**

Remove the `RETURN_ONE` and `RETURN_TWO` constants and the `collectReturn` const (lines ~143-151). **Keep** `explicitPickup` and `selfCollect` — the pickup-vs-delivery disambiguation is still load-bearing. Remove `collectReturn` from the `hasSlotSignal` expression at line ~161:

```js
    const hasSlotSignal = (matsN != null) || (guests != null) || (daysN != null) || !!dateVal || wantsPickup || !!looksPostcode || wantsDeliver;
```

- [ ] **Step 5: Delete the `aw === 'collection'` block and the mid-flow branch**

Remove the whole `if (aw === 'collection') { … }` block (lines ~170-186) and the whole one-way/two-way `if/else if` at lines ~271-275.

Update the `inHireFlow` regex (line ~165):

```js
    const inHireFlow = !!(aw && /^(mats|days|method|postcode|date|confirm)$/.test(aw));
```

- [ ] **Step 6: Shorten the slot ladder**

In `need()` (line ~286-294), delete the collection line:

```js
      const need = (function (x) {
        if (!x.mats || x.mats < H.minMats) return 'mats';
        if (!x.days) return 'days';
        if (!x.method) return 'method';
        if (x.method === 'deliver' && !x.zone) return 'postcode';
        if (!x.date) return 'date';
        return 'confirm';
      })(h);
```

Then find the `if (need === 'collection') return mk(…)` prompt further down and delete it too. Search: `grep -n "need === 'collection'" js/planner.js`.

- [ ] **Step 7: Update the confirm reply**

Line ~214 currently reads `'Confirmed. Delivery the day before, collection on the day once your event has finished. Welcome to SAÏA.'`. Make it state the real dates:

```js
    if (aw === 'confirm' && has(/^(yes|yep|confirm|book|go ahead|do it|please)\b/)) {
      const dd = KB.deriveDates ? KB.deriveDates(hire) : null;
      const when = dd
        ? 'We deliver on ' + KB.formatDate(dd.delivery) + ' and collect on ' + KB.formatDate(dd.collection) + '. '
        : 'Delivery the day before, collection on the day once your event has finished. ';
      return mk('Confirmed. ' + when + 'Welcome to SAÏA.', [{ tool: 'confirm' }], null);
    }
```

Match the surrounding code's existing guard condition exactly — read line 214 in context and keep its `if` intact, changing only the returned string.

- [ ] **Step 8: Run the tests**

Run: `node --test tests/planner.test.js`
Expected: PASS. Existing tests that assert a `collection` question or a `set_collection` action will fail — delete those tests, they cover a removed feature.

- [ ] **Step 9: Commit**

```bash
git add js/planner.js tests/planner.test.js
git commit -m "feat(planner): drop the collection slot and set_collection tool"
```

---

### Task B4: One courier variant, four dated cart attributes

**Files:**
- Modify: `js/shopify-cart.js:33-50`
- Test: `tests/shopify-cart.test.js`

**Interfaces:**
- Consumes: `KB.deriveDates`, `KB.formatDate`, `KB.dateLabels` (B2)
- Produces: cart attributes `Booking date`, `Event date`, `Delivery date` / `Pickup from NW3`, `Collection date` / `Return to NW3`, `Method`, `Postcode`, `Delivery estimate`. **`Return journey` is removed.**

- [ ] **Step 1: Write the failing tests**

Replace the `one-way collection choice…` test in `tests/shopify-cart.test.js` with:

```js
test('a stale collection:"one" still gets the two-way courier line', () => {
  const payload = cartPayload({ mats: 20, days: 2, method: 'deliver', zone: 'greater', collection: 'one', postcode: 'TW5 9QA' }, CFG);
  assert.ok(payload.items.some(i => i.id === 444 && i.quantity === 1));
  assert.ok(!payload.items.some(i => i.id === 555), 'the one-way variant must never be added');
  assert.strictEqual(payload.attributes['Return journey'], undefined);
});

test('a delivery cart carries all four dates', () => {
  const payload = cartPayload(
    { mats: 20, days: 2, method: 'deliver', zone: 'central', postcode: 'EC2Y 8DS', date: '2026-03-14' },
    Object.assign({ todayISO: '2026-03-03' }, CFG));
  assert.strictEqual(payload.attributes['Booking date'], 'Tue 3 Mar 2026');
  assert.strictEqual(payload.attributes['Event date'], 'Sat 14 Mar 2026');
  assert.strictEqual(payload.attributes['Delivery date'], 'Fri 13 Mar 2026');
  assert.strictEqual(payload.attributes['Collection date'], 'Sat 14 Mar 2026');
});

test('a pickup cart relabels the two journey dates', () => {
  const payload = cartPayload(
    { mats: 20, days: 2, method: 'pickup', date: '2026-03-14' },
    Object.assign({ todayISO: '2026-03-03' }, CFG));
  assert.strictEqual(payload.attributes['Pickup from NW3'], 'Fri 13 Mar 2026');
  assert.strictEqual(payload.attributes['Return to NW3'], 'Sat 14 Mar 2026');
  assert.strictEqual(payload.attributes['Delivery date'], undefined);
});

test('a hire with a non-ISO date still builds a cart, with no derived dates', () => {
  const payload = cartPayload({ mats: 20, days: 2, method: 'pickup', date: 'Saturday' }, CFG);
  assert.ok(payload.items.length > 0);
  assert.strictEqual(payload.attributes['Event date'], 'Saturday');
  assert.strictEqual(payload.attributes['Delivery date'], undefined);
});
```

Also update the shared `CFG` at the top of the file — leave `courierOneWayVariant: '555'` in place deliberately, so the tests prove the code ignores it even when configured.

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/shopify-cart.test.js`
Expected: FAIL — the one-way variant is still added and no date attributes exist.

- [ ] **Step 3: Implement**

In `js/shopify-cart.js`, replace the courier block and the attribute block inside `buildCart`:

```js
    // courier as a REAL cart line (priced by its Shopify variant), so the delivery the
    // guest chose in the estimator/assistant is in the total before checkout — the
    // checkout shipping rate is then the free "already included" one (weight-gated).
    // There is exactly ONE courier option: we do both legs. hire.collection is legacy
    // and ignored, so a stale session can never resurrect the deleted one-way variant.
    var inLondon = hire.zone === 'central' || hire.zone === 'greater';
    if (hire.method !== 'pickup' && inLondon && cfg.courierTwoWayVariant) {
      lines.push({ variant: cfg.courierTwoWayVariant, qty: 1 });
    }
    // pickup hires weigh 0g without a plumbing line, which wrongly shows the paid
    // £90 fallback shipping rate (weight-gated checkout) — this hidden £0 variant
    // gives pickup carts the same 1kg signal the courier line gives delivery carts.
    if (hire.method === 'pickup' && cfg.pickupVariant) lines.push({ variant: cfg.pickupVariant, qty: 1 });

    var pairs = [];
    function attr(k, v) {
      if (v) pairs.push([k, v]);
    }
    // four dates on every booking: one asked for, three derived (js/saia-knowledge.js)
    var dates = kb.deriveDates ? kb.deriveDates(hire, cfg.todayISO) : null;
    var labels = kb.dateLabels ? kb.dateLabels(hire) : { delivery: 'Delivery date', collection: 'Collection date' };
    if (dates) {
      attr('Booking date', kb.formatDate(dates.booking));
      attr('Event date', kb.formatDate(dates.event));
      attr(labels.delivery, kb.formatDate(dates.delivery));
      attr(labels.collection, kb.formatDate(dates.collection));
    } else {
      attr('Event date', hire.date);   // free-text date ("Saturday") — pass it through as given
    }
    attr('Method', hire.method === 'pickup' ? 'Pickup from NW3' : 'Delivery');
    attr('Postcode', String(hire.postcode || '').toUpperCase() || null);
    var q = kb.quoteLines(hire);
    attr('Delivery estimate', q.deliveryLabel);
    return { lines: lines, attrPairs: pairs };
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/shopify-cart.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/shopify-cart.js tests/shopify-cart.test.js
git commit -m "feat(cart): single courier variant + four dated order attributes"
```

---

### Task B5: Show the four dates on the demo checkout

**Files:**
- Modify: `js/checkout.js:36-40` (summary header), `:57-63` (form)

**Interfaces:**
- Consumes: `KB.deriveDates`, `KB.formatDate`, `KB.dateLabels` (B2)
- Produces: nothing downstream

- [ ] **Step 1: Replace the summary header with a dated block**

In `js/checkout.js`, replace lines 36-40:

```js
  var head = (hire.mats || 0) + ' mats · ' + (hire.days || 2) + '-day hire · ' +
    (hire.method === 'pickup' ? 'collect from NW3' : ('delivery ' + String(hire.postcode || '').toUpperCase()));
  // head carries a user-supplied postcode — set as text, never innerHTML.
  var headEl = el('div', 'muted'); headEl.textContent = head; sum.appendChild(headEl);

  // four dates on every booking: one entered, three derived
  var dates = KB.deriveDates ? KB.deriveDates(hire) : null;
  if (dates) {
    var labels = KB.dateLabels(hire);
    [['Booked', dates.booking], ['Event', dates.event],
      [labels.delivery, dates.delivery], [labels.collection, dates.collection]].forEach(function (pair) {
      var r = el('div', 'row');
      r.appendChild(el('span', null, pair[0]));
      var v = el('span'); v.textContent = KB.formatDate(pair[1]); r.appendChild(v);
      sum.appendChild(r);
    });
  }
```

- [ ] **Step 2: Make the event date an ISO date field**

The derived dates need an ISO date, so `needDate` must produce one. Replace lines 57-63:

```js
  var needDate = !/^\d{4}-\d{2}-\d{2}$/.test(String(hire.date || ''));   // need a real ISO date to derive from
  form.innerHTML += '<label>Name *</label><input id="f-name" autocomplete="name">' +
    (needDate ? '<label for="f-date">Event date *</label><input id="f-date" type="date">' : '') +
    '<label for="f-addr">Address *</label><input id="f-addr" autocomplete="street-address">' +
    '<label for="f-email">Email</label><input id="f-email" type="email" autocomplete="email">' +
    '<label for="f-phone">Phone *</label><input id="f-phone" type="tel" autocomplete="tel" required>' +
    '<div class="muted">* required. We need a phone number so the courier can reach you on the day.</div>' +
```

Keep the rest of the string (the payment heading and grid) exactly as it is.

- [ ] **Step 3: Gate the pay button on the phone number**

Replace the `check()` function and its listeners (lines ~76-82):

```js
  var name = document.getElementById('f-name');
  var addr = document.getElementById('f-addr');
  var phone = document.getElementById('f-phone');
  var date = document.getElementById('f-date');   // null unless needDate
  function check() {
    pay.disabled = !(name.value.trim() && addr.value.trim() && phone.value.trim() && (!date || date.value));
  }
  [name, addr, phone].forEach(function (f) { f.addEventListener('input', check); });
  if (date) { date.addEventListener('input', check); date.addEventListener('change', check); }
```

> This makes the phone number required on the demo page as well as at Shopify checkout. It costs one line and removes the inconsistency flagged in the spec.

- [ ] **Step 4: Verify by hand**

Run: `python3 -m http.server 8000`, then in the browser console on `http://localhost:8000/`:

```js
sessionStorage.setItem('saia_hire', JSON.stringify({mats:20,days:2,method:'deliver',zone:'central',postcode:'EC2Y 8DS',date:'2026-03-14'}));
location.href = 'checkout.html';
```

Expected: the summary lists Booked / Event / Delivery date / Collection date; Pay stays disabled until Name, Address and Phone are all filled.

- [ ] **Step 5: Commit**

```bash
git add js/checkout.js
git commit -m "feat(checkout): show all four booking dates and require a phone number"
```

---

### Task B6: Studio bespoke answers, no bulk discount

**Files:**
- Modify: `js/saia-knowledge.js` (add `KB.hire.bespoke`, update `KB.factSheet`), `js/planner.js:228`, `js/saia-examples.js:50-58,162-164,226-228`, `js/home-concierge.js:128-129`
- Test: `tests/planner.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `KB.hire.bespoke` — one sentence, read by both tiers

- [ ] **Step 1: Write the failing test**

Append to `tests/planner.test.js`:

```js
test('asking to buy mats offers bespoke studio mats by email, with no price', () => {
  const r = localPlan('can I buy mats for my studio?', {});
  assert.ok(r.matched);
  assert.ok(/bespoke/i.test(r.say), 'must mention the bespoke made-to-order option');
  assert.ok(/Cristina@saialondon\.com/.test(r.say), 'must point at the email address');
  assert.ok(!/£/.test(r.say), 'must never quote a bespoke price');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/planner.test.js`
Expected: FAIL — the current reply says "We don't sell the mats."

- [ ] **Step 3: Add the fact**

In `js/saia-knowledge.js`, inside the `KB.hire` object next to `noSale`, add:

```js
      bespoke: 'Studios can commission bespoke mats made to order, in their own colours and branding. That is by enquiry only, by email to Cristina@saialondon.com, and never priced online.',
```

Then in `KB.factSheet`, directly after the `'- Mats are for HIRE ONLY. Never for sale.'` line, insert:

```js
    '- ONE exception to hire-only: studios can commission BESPOKE mats made to order. ' + KB.hire.bespoke + ' Never quote a price for bespoke mats, and never invent one.',
```

- [ ] **Step 4: Rewrite the planner's buy branch**

Replace `js/planner.js:228`:

```js
      return m("We keep our mats hire-only for events, so you always get them clean and event-ready. For a studio it is different: we make bespoke mats to order in your own colours and branding. Email us at Cristina@saialondon.com with what you have in mind and we will come back to you. Happy to set up a hire in the meantime; how many are you after?");
```

- [ ] **Step 5: Fix the gold examples**

In `js/saia-examples.js`, replace the three entries:

```js
    { u: 'can I just buy the mats instead?',
      say: "We keep them hire-only for events, so they are always cared for and event-ready. If you run a studio we do make bespoke mats to order, in your colours and branding, by email to Cristina@saialondon.com. Otherwise you can hire as many as you like from £8.50 a mat. How many were you thinking?",
      actions: [] },
    { u: 'any chance of a discount?',
      say: "Our rate stays a friendly £8.50 a mat whatever the size of the booking, and the deposit comes back to you in full after your event. How many mats were you thinking?",
      actions: [] },
```

```js
    { u: 'I run a studio and need mats regularly',
      say: 'Of course. We hire mats for studio events on the same £8.50 rate, and for studios we also make bespoke mats to order in your own colours and branding. Email us at Cristina@saialondon.com with roughly how many and how often, and we will come back to you.',
      actions: [] },
```

```js
    { u: 'can I try just one first?',
      say: "Our hire starts at 10 mats so we do not do single trials, but the spec is studio-quality and we are glad to answer anything by email. Shall I prepare a hire?",
      actions: [] },
```

Then check line ~56 (`'seems a bit pricey'`) — it says *"same fair £8.50 rate whatever the size of your booking"*, which is already correct. Leave it.

- [ ] **Step 6: Fix the concierge studio chip reply**

Replace `js/home-concierge.js:129`:

```js
      text = 'A studio, wonderful. We hire mats for studio events on the same £8.50 rate, and for studios we also make bespoke mats to order in your own colours and branding. Tell me your studio name, the days you need mats and roughly how many. For bespoke, email us at ' + EMAIL + '.';
```

- [ ] **Step 7: Verify no bulk-discount claim survives**

Run: `grep -rniE "reduced rate|bulk|volume rate|studio rate|recurring rate" js/`
Expected: no matches in `planner.js`, `saia-examples.js`, `home-concierge.js`, `saia-knowledge.js`.

- [ ] **Step 8: Run the tests**

Run: `node --test tests/*.test.js`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add js/saia-knowledge.js js/planner.js js/saia-examples.js js/home-concierge.js tests/planner.test.js
git commit -m "feat(studio): bespoke mats to order by email; remove every bulk-discount claim"
```

---

### Task B7: "Cristina" → "us" in bot copy

**Files:**
- Modify: `js/planner.js`, `js/saia-examples.js`, `js/saia-knowledge.js`, `js/home-concierge.js`

**Interfaces:** none

- [ ] **Step 1: List every candidate**

Run: `grep -rn "Cristina" js/ | grep -v "Cristina@saialondon.com"`

Read each hit and classify against the Global Constraints rule. Expected keepers: `KB.contact.person`, `KB.pilates.instructor`, and any factSheet line that tells the model *who Cristina is*. Everything else that instructs the reader to contact her, or promises she will do something, changes.

- [ ] **Step 2: Apply the rule**

Known rewrites (there may be more — apply the rule, do not stop at this list):

| Before | After |
|---|---|
| `Cristina will confirm the courier` | `we will confirm the courier` |
| `Cristina handles invoices and any company details with you by email` | `we handle invoices and any company details with you by email` |
| `it's always worth a word with Cristina by email` | `it is always worth a word with us by email` |
| `ask Cristina directly by email, and she'll set that up` | `ask us directly by email and we will set that up` |
| `Cristina's glad to answer anything by email` | `we are glad to answer anything by email` |
| `I'll pass your details to her` | `I'll pass your details on` |
| `Hi Cristina! I would like to book…` (WhatsApp text) | `Hi! I would like to book…` |

- [ ] **Step 3: Check for em dashes and gushing openers while you are in here**

Run: `grep -rn "—" js/planner.js js/saia-examples.js js/home-concierge.js`
Any em dash inside a user-facing `say:` string becomes a comma or a full stop. (Em dashes in code comments are fine.)

- [ ] **Step 4: Run the tests**

Run: `node --test tests/*.test.js`
Expected: PASS. If a test asserts a string containing "Cristina", update the assertion.

- [ ] **Step 5: Commit**

```bash
git add js/
git commit -m "copy(bot): say 'us' instead of 'Cristina' in every contact instruction"
```

---

### Task B8: Journey pause on focus, and the `#estimate` interceptor

**Files:**
- Modify: `js/home-journey.js:344` (STOPS comment), `:382-384` (`typing`), `:385-423` (`bindSnap`), plus a new block at the end of the IIFE

**Interfaces:**
- Consumes: nothing
- Produces — **Track A depends on these:**
  - `window.SAIA.journeyPaused` — boolean; when `true`, wheel/touch/keydown snapping is suspended and native scrolling resumes.
  - Any element carrying `data-journey-pause` inside the pinned wrapper sets the flag on `focusin` and clears it on `focusout`.
  - `[href="#estimate"]` clicks are intercepted on desktop and scroll to `STOPS[3]`.

- [ ] **Step 1: Rename the chapter-4 comment**

`js/home-journey.js:344`:

```js
    0.520,   // 4 instant quotation — the estimator, at the end of the mat-hire scroll
```

- [ ] **Step 2: Add the pause flag and widen `typing()`**

Replace the `typing()` helper (lines ~382-384):

```js
  /* A form now lives inside a pinned band (the estimator, chapter 4). While the guest is
     using it, chapter snapping must get out of the way or the page scrolls out from under
     them mid-postcode. Any [data-journey-pause] subtree sets this on focusin. */
  window.SAIA = window.SAIA || {};
  window.SAIA.journeyPaused = false;

  function typing(el) {
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT' || el.isContentEditable);
  }
  function paused() { return !!window.SAIA.journeyPaused; }

  function bindPause() {
    const zone = wrap.querySelector('[data-journey-pause]');
    if (!zone) return;
    zone.addEventListener('focusin', () => { window.SAIA.journeyPaused = true; });
    zone.addEventListener('focusout', (e) => {
      // focusout fires before the new element has focus — defer so a tab between two
      // fields inside the estimator doesn't flicker the flag off and on.
      setTimeout(() => {
        if (!zone.contains(document.activeElement)) window.SAIA.journeyPaused = false;
      }, 0);
    });
  }
```

- [ ] **Step 3: Guard the three snap handlers**

In `bindSnap()`, add `|| paused()` to each early return:

```js
    window.addEventListener('wheel', (e) => {
      if (!pinned() || e.ctrlKey || paused()) return;
```

```js
    window.addEventListener('keydown', (e) => {
      if (!pinned() || typing(e.target) || paused()) return;
```

```js
    window.addEventListener('touchmove', (e) => {
      if (touchY == null || !pinned() || paused()) return;
```

Leave every other line in those handlers untouched.

- [ ] **Step 4: Intercept `#estimate` on desktop**

Add a new block immediately after the `bindSnap()` call site (find it with `grep -n "bindSnap()" js/home-journey.js`):

```js
  /* The nav CTA links to #estimate. On desktop the estimator now lives INSIDE the pinned
     journey (chapter 4), so a plain anchor jump would sail past it to the mobile-only flat
     copy. Scroll to the chapter instead. Below 767px the pin doesn't run, so the native
     anchor is correct and we leave it alone. */
  function bindEstimateLinks() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href="#estimate"]');
      if (!a) return;
      if (window.matchMedia('(max-width: 767px)').matches) return;   // mobile: native anchor
      e.preventDefault();
      window.scrollTo({ top: yForP(STOPS[3]), behavior: 'smooth' });
    });
  }
  bindEstimateLinks();
  bindPause();
```

- [ ] **Step 5: Verify by hand**

Run: `python3 -m http.server 8000` and open `http://localhost:8000/` at a viewport ≥1024px.

Expected right now (before Track A lands, the band still holds the range grid):
- The journey still snaps one chapter per wheel gesture.
- In the console, `window.SAIA.journeyPaused` is `false`.
- Setting `window.SAIA.journeyPaused = true` by hand stops wheel snapping; setting it back to `false` restores it.
- Clicking "Hire mats" in the nav scrolls to chapter 4 rather than jumping to the flat section.

- [ ] **Step 6: Commit**

```bash
git add js/home-journey.js
git commit -m "feat(journey): pause chapter snap while a band form has focus; route #estimate to chapter 4"
```

---

### Task B9: Make invisible bands unreachable by keyboard

**Files:**
- Modify: `js/home-journey.js:445` (inside `bands()`)

**Interfaces:**
- Consumes: nothing
- Produces — **Track A depends on this:** every `[data-band]` whose opacity is effectively zero carries the `inert` attribute.

**Why:** bands are absolutely positioned and cross-faded, so a faded-out band is invisible but still in the tab order. Today they hold headings and links, which is merely untidy. After Task A5 one of them holds the estimator — a full form with number inputs, a postcode field and a Book now button. Without `inert`, tabbing through the page drops focus into a form nobody can see.

- [ ] **Step 1: Set `inert` alongside the opacity write**

In `bands(p)`, immediately after the existing opacity line:

```js
      e.style.opacity = k.toFixed(3);
      // A faded-out band is invisible but still tabbable. One of these bands holds the
      // estimator form, so leaving it focusable would drop keyboard users into a form they
      // cannot see. inert removes the whole subtree from the tab order and the a11y tree.
      e.toggleAttribute('inert', k < 0.02);
```

- [ ] **Step 2: Release focus when a band goes inert**

Making the element holding `document.activeElement` inert leaves focus nowhere. Add directly beneath:

```js
      if (k < 0.02 && e.contains(document.activeElement)) document.activeElement.blur();
```

- [ ] **Step 3: Verify**

Run: `python3 -m http.server 8000` at ≥1024px.

- Load the page, press Tab repeatedly from the address bar. Expected: focus moves through the nav, then the visible chapter only, then out to the flat sections below. It must never disappear.
- In the console at the top of the page: `document.querySelectorAll('[data-band][inert]').length` — expected: every band except the active one.
- Scroll to chapter 2 and re-check. Expected: the count shifts so chapter 2 is the one without `inert`.

- [ ] **Step 4: Confirm the polyfill question**

`inert` is supported in Safari 15.5+, Chrome 102+ and Firefox 112+. Run: `grep -rn "inert" index.html` — if the page already ships an inert polyfill, nothing more is needed. If not, accept the gap: on an older browser the only symptom is the pre-existing tab-order untidiness, not a broken page. Do not add a polyfill dependency for this.

- [ ] **Step 5: Commit**

```bash
git add js/home-journey.js
git commit -m "a11y(journey): mark faded-out bands inert so Tab cannot enter them"
```

---

# TRACK C — THE LOG

**Owns:** `js/log-core.js`, `api/log.js`, `api/chat-log.js`, `api/health.js`, `chat-log.html`, `server.js`, `robots.txt`, `package.json`, `tests/log-core.test.js`

> **Privacy note, state it in the code comments:** `@vercel/blob` stores objects with public, unguessable URLs. Chat transcripts contain names, postcodes and email addresses. Two mitigations are mandatory: write with `addRandomSuffix: true` so a pathname alone cannot be guessed, and **never return a blob URL to the browser** — `/api/chat-log` returns transcript *content* only. Do not add a "download the raw file" link.

---

### Task C1: Store chat rows in Vercel Blob

**Files:**
- Modify: `js/log-core.js` (replace `insertChatLogs`), `package.json`
- Test: `tests/log-core.test.js`

**Interfaces:**
- Consumes: `normalizeLogPayload` (unchanged)
- Produces:
  - `blobKey(session, atMs, rand) -> 'chats/YYYY-MM-DD/<session>/<atMs>-<rand>.json'`
  - `storeChatLogs(rows, client?) -> Promise<{stored:boolean, reason?:string, key?:string}>` — `client` defaults to the real Blob client; `{stored:false, reason:'no_blob_env'}` when unconfigured.

- [ ] **Step 1: Add the dependency**

Run: `npm install @vercel/blob`

- [ ] **Step 2: Write the failing tests**

Append to `tests/log-core.test.js`:

```js
const { blobKey, storeChatLogs } = require('../js/log-core.js');

test('blobKey groups by date then session', () => {
  assert.strictEqual(
    blobKey('a91f', Date.UTC(2026, 7, 6, 9, 30), 'zz9'),
    'chats/2026-08-06/a91f/' + Date.UTC(2026, 7, 6, 9, 30) + '-zz9.json');
});

test('blobKey strips path separators out of a hostile session id', () => {
  const k = blobKey('../../etc/passwd', Date.UTC(2026, 7, 6), 'aa1');
  assert.ok(!k.includes('..'), 'no parent-directory segments');
  assert.strictEqual(k.split('/').length, 4, 'always chats/<date>/<session>/<file>');
});

test('storeChatLogs writes one blob containing every row', async () => {
  const written = [];
  const fake = { put: async (key, body, opts) => { written.push({ key, body, opts }); return { url: 'x' }; } };
  const rows = [
    { session_id: 's1', role: 'user', tier: null, message: 'hello', page: '/' },
    { session_id: 's1', role: 'bot', tier: 'local', message: 'hi there', page: '/' },
  ];
  const res = await storeChatLogs(rows, fake);
  assert.strictEqual(res.stored, true);
  assert.strictEqual(written.length, 1, 'one blob per request, never one per row');
  const parsed = JSON.parse(written[0].body);
  assert.strictEqual(parsed.session, 's1');
  assert.strictEqual(parsed.turns.length, 2);
  assert.strictEqual(parsed.turns[1].message, 'hi there');
  assert.ok(typeof parsed.at === 'number', 'the batch carries a timestamp');
});

test('storeChatLogs writes public blobs with a random suffix', async () => {
  const written = [];
  const fake = { put: async (key, body, opts) => { written.push(opts); return { url: 'x' }; } };
  await storeChatLogs([{ session_id: 's1', role: 'user', tier: null, message: 'hi', page: '/' }], fake);
  assert.strictEqual(written[0].addRandomSuffix, true, 'pathnames must not be guessable');
  assert.strictEqual(written[0].contentType, 'application/json');
});

test('storeChatLogs drops rows when the store is not configured', async () => {
  const res = await storeChatLogs([{ session_id: 's1', role: 'user', tier: null, message: 'hi', page: '/' }], null);
  assert.deepStrictEqual(res, { stored: false, reason: 'no_blob_env' });
});

test('storeChatLogs accepts an empty batch without calling the store', async () => {
  let called = false;
  const fake = { put: async () => { called = true; } };
  const res = await storeChatLogs([], fake);
  assert.strictEqual(called, false);
  assert.strictEqual(res.stored, false);
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `node --test tests/log-core.test.js`
Expected: FAIL — `blobKey is not a function`.

- [ ] **Step 4: Implement**

In `js/log-core.js`, rewrite the header comment and replace `insertChatLogs` wholesale:

```js
/* ============================================================
   SAÏA — chat transcript logging core (shared brain)
   Used by BOTH transports so they never drift:
     • api/log.js  — Vercel serverless function (prod)
     • server.js   — local dev server

   normalizeLogPayload() validates/clamps what the browser sent;
   storeChatLogs() writes ONE immutable blob per request to Vercel
   Blob. Never read-modify-write a per-session file: two chat turns
   can post at once and one would be silently lost. Reads merge the
   batches back together (readChatSession).

   PRIVACY: Vercel Blob URLs are public but unguessable. Transcripts
   carry names, postcodes and emails, so blobs are written with
   addRandomSuffix:true and their URLs are NEVER returned to the
   browser — api/chat-log.js serves content, not links.

   No BLOB_READ_WRITE_TOKEN → rows are accepted and dropped, so the
   site needs zero setup to work locally.
   ============================================================ */
```

Then, replacing `insertChatLogs`:

```js
// A session id is attacker-controlled, so it can never reach a path unescaped.
function safeSegment(s) {
  return String(s || '').replace(/[^A-Za-z0-9._-]/g, '-').replace(/^\.+/, '').slice(0, 64) || 'unknown';
}

function blobKey(session, atMs, rand) {
  const day = new Date(atMs).toISOString().slice(0, 10);
  return 'chats/' + day + '/' + safeSegment(session) + '/' + atMs + '-' + rand + '.json';
}

// Real client, resolved lazily so `require` of this module never needs the package
// present at import time (server.js runs without it in a bare checkout).
function blobClient() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  // eslint-disable-next-line global-require
  return require('@vercel/blob');
}

async function storeChatLogs(rows, client) {
  if (!rows || !rows.length) return { stored: false, reason: 'empty' };
  const c = client === undefined ? blobClient() : client;
  if (!c) return { stored: false, reason: 'no_blob_env' };
  const at = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const session = rows[0].session_id;
  const body = JSON.stringify({
    session: session,
    page: rows[0].page || null,
    at: at,
    turns: rows.map((r) => ({ role: r.role, tier: r.tier, message: r.message })),
  });
  const key = blobKey(session, at, rand);
  await c.put(key, body, {
    access: 'public',
    addRandomSuffix: true,     // the pathname alone must not be guessable
    contentType: 'application/json',
  });
  return { stored: true, key: key };
}
```

Update the exports line at the bottom:

```js
module.exports = { normalizeLogPayload, blobKey, storeChatLogs, blobClient };
```

- [ ] **Step 5: Run the tests**

Run: `node --test tests/log-core.test.js`
Expected: PASS. Any surviving Supabase test fails — delete it, that path is gone.

- [ ] **Step 6: Commit**

```bash
git add js/log-core.js tests/log-core.test.js package.json package-lock.json
git commit -m "feat(log): store chat transcripts in Vercel Blob, one immutable blob per request"
```

---

### Task C2: Read sessions and transcripts back

**Files:**
- Modify: `js/log-core.js`
- Test: `tests/log-core.test.js`

**Interfaces:**
- Consumes: `blobKey` (C1)
- Produces:
  - `readChatSessions(client?, limit?) -> Promise<Array<{session, date, lastAt, batches}>>` — newest first, `limit` defaults to 200
  - `readChatSession(session, client?, fetchFn?) -> Promise<{session, turns: Array<{at, role, tier, message}>}>` — turns in time order across every batch

- [ ] **Step 1: Write the failing tests**

Append to `tests/log-core.test.js`:

```js
const { readChatSessions, readChatSession } = require('../js/log-core.js');

const FAKE_BLOBS = [
  { pathname: 'chats/2026-08-06/a91f/1000-aaa.json', url: 'https://blob/1', uploadedAt: '2026-08-06T09:00:00Z' },
  { pathname: 'chats/2026-08-06/a91f/2000-bbb.json', url: 'https://blob/2', uploadedAt: '2026-08-06T09:01:00Z' },
  { pathname: 'chats/2026-08-05/b7e4/500-ccc.json',  url: 'https://blob/3', uploadedAt: '2026-08-05T18:00:00Z' },
];

test('readChatSessions groups blobs by session, newest first', async () => {
  const fake = { list: async () => ({ blobs: FAKE_BLOBS }) };
  const out = await readChatSessions(fake);
  assert.strictEqual(out.length, 2);
  assert.strictEqual(out[0].session, 'a91f');
  assert.strictEqual(out[0].date, '2026-08-06');
  assert.strictEqual(out[0].batches, 2);
  assert.strictEqual(out[1].session, 'b7e4');
});

test('readChatSessions returns an empty list when the store is unconfigured', async () => {
  assert.deepStrictEqual(await readChatSessions(null), []);
});

test('readChatSession merges batches into one time-ordered transcript', async () => {
  const fake = { list: async () => ({ blobs: FAKE_BLOBS }) };
  const bodies = {
    'https://blob/2': { session: 'a91f', at: 2000, turns: [{ role: 'bot', tier: 'local', message: 'second' }] },
    'https://blob/1': { session: 'a91f', at: 1000, turns: [{ role: 'user', tier: null, message: 'first' }] },
  };
  const fetchFn = async (url) => ({ ok: true, json: async () => bodies[url] });
  const out = await readChatSession('a91f', fake, fetchFn);
  assert.strictEqual(out.session, 'a91f');
  assert.deepStrictEqual(out.turns.map(t => t.message), ['first', 'second']);
  assert.strictEqual(out.turns[0].at, 1000);
});

test('readChatSession ignores a batch that fails to load', async () => {
  const fake = { list: async () => ({ blobs: FAKE_BLOBS }) };
  const fetchFn = async (url) => (url === 'https://blob/1'
    ? { ok: false }
    : { ok: true, json: async () => ({ session: 'a91f', at: 2000, turns: [{ role: 'bot', tier: 'local', message: 'second' }] }) });
  const out = await readChatSession('a91f', fake, fetchFn);
  assert.deepStrictEqual(out.turns.map(t => t.message), ['second']);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/log-core.test.js`
Expected: FAIL — `readChatSessions is not a function`.

- [ ] **Step 3: Implement**

Add to `js/log-core.js` above the exports:

```js
// chats/<date>/<session>/<at>-<rand>.json  ->  { date, session, at }
function parseKey(pathname) {
  const p = String(pathname || '').split('/');
  if (p.length !== 4 || p[0] !== 'chats') return null;
  const at = parseInt(String(p[3]).split('-')[0], 10);
  return { date: p[1], session: p[2], at: Number.isFinite(at) ? at : 0 };
}

async function readChatSessions(client, limit) {
  const c = client === undefined ? blobClient() : client;
  if (!c) return [];
  const res = await c.list({ prefix: 'chats/', limit: 1000 });
  const bySession = new Map();
  (res.blobs || []).forEach((b) => {
    const k = parseKey(b.pathname);
    if (!k) return;
    const cur = bySession.get(k.session);
    if (!cur) bySession.set(k.session, { session: k.session, date: k.date, lastAt: k.at, batches: 1 });
    else { cur.batches += 1; if (k.at > cur.lastAt) { cur.lastAt = k.at; cur.date = k.date; } }
  });
  return Array.from(bySession.values())
    .sort((a, b) => b.lastAt - a.lastAt)
    .slice(0, limit || 200);
}

async function readChatSession(session, client, fetchFn) {
  const c = client === undefined ? blobClient() : client;
  if (!c) return { session: session, turns: [] };
  const get = fetchFn || fetch;
  const res = await c.list({ prefix: 'chats/', limit: 1000 });
  const mine = (res.blobs || [])
    .map((b) => ({ b: b, k: parseKey(b.pathname) }))
    .filter((x) => x.k && x.k.session === session)
    .sort((a, b) => a.k.at - b.k.at);
  const turns = [];
  for (const x of mine) {
    let body = null;
    try {
      const r = await get(x.b.url);
      if (r && r.ok) body = await r.json();
    } catch (e) { body = null; }          // a single unreadable batch must not lose the rest
    if (!body || !Array.isArray(body.turns)) continue;
    body.turns.forEach((t) => turns.push({
      at: body.at || x.k.at, role: t.role, tier: t.tier || null, message: t.message,
    }));
  }
  return { session: session, turns: turns };
}
```

Update the exports:

```js
module.exports = { normalizeLogPayload, blobKey, storeChatLogs, blobClient, readChatSessions, readChatSession };
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/log-core.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/log-core.js tests/log-core.test.js
git commit -m "feat(log): read sessions and merge batched transcripts back out of Blob"
```

---

### Task C3: Point the write endpoints at Blob

**Files:**
- Modify: `api/log.js:9`, `api/log.js:30-36`, `api/health.js`, `server.js`

**Interfaces:**
- Consumes: `storeChatLogs` (C1)
- Produces: `/health` reports `hasBlobStore`

- [ ] **Step 1: Swap the import and the call in `api/log.js`**

```js
const { normalizeLogPayload, storeChatLogs } = require('../js/log-core.js');
```

```js
  try {
    await storeChatLogs(rows);
    res.status(204).end();
  } catch (err) {
    console.error('[chat-log]', err && err.message ? err.message : err);
    res.status(502).json({ error: 'log_failed' });
  }
```

Also update the file header comment: *"so conversations can be reviewed later in Supabase (table `chat_logs`)"* → *"so conversations can be reviewed later at /chat-log.html (stored in Vercel Blob)"*.

- [ ] **Step 2: Do the same in `server.js`**

Run: `grep -n "insertChatLogs\|Supabase\|SUPABASE" server.js` and apply the identical swap so local dev and prod cannot drift.

- [ ] **Step 3: Report the new store in health**

In `api/health.js`, replace the `hasSupabase` field:

```js
    hasBlobStore: !!process.env.BLOB_READ_WRITE_TOKEN,
```

Run `grep -n "hasSupabase" server.js` and make the same change there if the local server mirrors it.

- [ ] **Step 4: Verify no Supabase reference survives in the log path**

Run: `grep -rn "SUPABASE\|supabase" js/ api/ server.js`
Expected: no matches.

- [ ] **Step 5: Verify locally**

Run in terminal A: `npm start`
Run in terminal B:

```bash
curl -s localhost:8787/health
curl -s -X POST localhost:8787/api/log -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:8000' \
  -d '{"session":"test-1","page":"/","turns":[{"role":"user","message":"20 mats please"}]}' -o /dev/null -w '%{http_code}\n'
```

Expected: `/health` shows `"hasBlobStore":false` (no token locally); the POST returns `204` and drops the row without erroring.

- [ ] **Step 6: Commit**

```bash
git add api/log.js api/health.js server.js
git commit -m "feat(log): write through Vercel Blob; /health reports hasBlobStore"
```

---

### Task C4: The password-gated read endpoint

**Files:**
- Create: `api/chat-log.js`
- Test: `tests/chat-log-auth.test.js`

**Interfaces:**
- Consumes: `readChatSessions`, `readChatSession` (C2), `rateLimit` (`js/rate-limit.js`), `applyCors` (`js/http-guard.js`)
- Produces: `signToken(expMs, secret)`, `verifyToken(token, secret, nowMs)` exported for tests

- [ ] **Step 1: Write the failing tests**

Create `tests/chat-log-auth.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { signToken, verifyToken } = require('../api/chat-log.js');

const SECRET = 'a-long-random-test-secret';

test('a freshly signed token verifies', () => {
  const exp = 2_000_000_000_000;
  assert.strictEqual(verifyToken(signToken(exp, SECRET), SECRET, exp - 1000), true);
});

test('an expired token is rejected', () => {
  const exp = 1_000;
  assert.strictEqual(verifyToken(signToken(exp, SECRET), SECRET, exp + 1), false);
});

test('a token signed with another secret is rejected', () => {
  const exp = 2_000_000_000_000;
  assert.strictEqual(verifyToken(signToken(exp, 'other-secret'), SECRET, exp - 1000), false);
});

test('a tampered expiry is rejected', () => {
  const t = signToken(1_000, SECRET);
  const forged = '9999999999999.' + t.split('.')[1];
  assert.strictEqual(verifyToken(forged, SECRET, 2_000), false);
});

test('malformed tokens are rejected without throwing', () => {
  ['', null, 'nonsense', 'a.b.c', '123.'].forEach((t) => {
    assert.strictEqual(verifyToken(t, SECRET, 1_000), false);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/chat-log-auth.test.js`
Expected: FAIL — `Cannot find module '../api/chat-log.js'`.

- [ ] **Step 3: Implement**

Create `api/chat-log.js`:

```js
/* ============================================================
   SAÏA — chat transcript READER (Vercel serverless function)
   Cristina's window onto the AI conversations. Password-gated;
   the password buys an 8-hour HMAC cookie so she types it once
   a day.

     POST /api/chat-log            { password }        -> 204 + cookie
     GET  /api/chat-log?list=1                         -> { sessions:[…] }
     GET  /api/chat-log?session=<id>                   -> { session, turns:[…] }

   PRIVACY: returns transcript CONTENT only. Never return a blob
   URL — those are public-but-unguessable and would leak the
   transcript to anyone the link reached.
   ============================================================ */
const crypto = require('crypto');
const { readChatSessions, readChatSession } = require('../js/log-core.js');
const { applyCors } = require('../js/http-guard.js');
const { rateLimit } = require('../js/rate-limit.js');

const COOKIE = 'saia_log';
const TTL_MS = 8 * 60 * 60 * 1000;
const RL = { name: 'chat-log-auth', limit: parseInt(process.env.RL_CHATLOG_PER_15, 10) || 10, windowMs: 15 * 60 * 1000 };

function signToken(expMs, secret) {
  const mac = crypto.createHmac('sha256', String(secret)).update(String(expMs)).digest('hex');
  return expMs + '.' + mac;
}

function verifyToken(token, secret, nowMs) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return false;
  const exp = parseInt(parts[0], 10);
  if (!Number.isFinite(exp) || exp <= nowMs) return false;
  const expected = crypto.createHmac('sha256', String(secret)).update(parts[0]).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(parts[1], 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function readCookie(req, name) {
  const raw = (req.headers && req.headers.cookie) || '';
  const hit = raw.split(';').map((s) => s.trim()).find((s) => s.indexOf(name + '=') === 0);
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : '';
}

// constant-time password compare that doesn't leak the length
function passwordMatches(given, expected) {
  const a = crypto.createHash('sha256').update(String(given || '')).digest();
  const b = crypto.createHash('sha256').update(String(expected || '')).digest();
  return crypto.timingSafeEqual(a, b);
}

module.exports = async (req, res) => {
  const cors = applyCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!cors.allowed) { res.status(403).json({ error: 'forbidden_origin' }); return; }

  const password = process.env.CHAT_LOG_PASSWORD;
  const secret = process.env.CHAT_LOG_SECRET;
  if (!password || !secret) { res.status(503).json({ error: 'not_configured' }); return; }

  if (req.method === 'POST') {
    const rl = await rateLimit(req, RL);
    if (!rl.ok) { res.setHeader('Retry-After', String(rl.retryAfter)); res.status(429).json({ error: 'rate_limited' }); return; }
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body || '{}'); } catch (e) { body = {}; } }
    if (!passwordMatches(body && body.password, password)) { res.status(401).json({ error: 'bad_password' }); return; }
    const token = signToken(Date.now() + TTL_MS, secret);
    res.setHeader('Set-Cookie', COOKIE + '=' + encodeURIComponent(token)
      + '; Path=/; Max-Age=' + Math.floor(TTL_MS / 1000) + '; HttpOnly; Secure; SameSite=Strict');
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') { res.status(404).end(); return; }
  if (!verifyToken(readCookie(req, COOKIE), secret, Date.now())) { res.status(401).json({ error: 'unauthorised' }); return; }

  try {
    const session = req.query && req.query.session;
    if (session) { res.status(200).json(await readChatSession(String(session))); return; }
    res.status(200).json({ sessions: await readChatSessions() });
  } catch (err) {
    console.error('[chat-log-read]', err && err.message ? err.message : err);
    res.status(502).json({ error: 'read_failed' });
  }
};

module.exports.signToken = signToken;
module.exports.verifyToken = verifyToken;
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/chat-log-auth.test.js`
Expected: PASS, all five.

- [ ] **Step 5: Confirm `applyCors` allows the Vercel origin**

Read `js/http-guard.js` and check the allowlist covers the deployment origin the page will be served from. If it only lists `saialondon.com` and `localhost`, add the Vercel deployment host — otherwise the page's own fetches are rejected as a forbidden origin.

- [ ] **Step 6: Commit**

```bash
git add api/chat-log.js tests/chat-log-auth.test.js js/http-guard.js
git commit -m "feat(log): password-gated chat transcript read endpoint"
```

---

### Task C5: Cristina's transcript page

**Files:**
- Create: `chat-log.html`
- Modify: `robots.txt`

**Interfaces:**
- Consumes: `/api/chat-log` (C4)

- [ ] **Step 1: Create the page**

Create `chat-log.html`. Brand palette, semantic markup, a real `<label>` on the password field, focus-visible outlines, and `noindex`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Chat log · SAÏA London</title>
  <style>
    :root{ --cream:#F5F1E8; --ink:#2B2620; --terra:#B8624A; --muted:#6B6358; --line:#DAD4C8; }
    *{ box-sizing:border-box; }
    body{ margin:0; background:var(--cream); color:var(--ink);
      font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif; }
    main{ max-width:900px; margin:0 auto; padding:40px 20px 80px; }
    h1{ font-size:26px; font-weight:600; margin:0 0 6px; }
    .sub{ color:var(--muted); font-size:14px; margin:0 0 32px; }
    label{ display:block; font-size:13px; letter-spacing:.08em; text-transform:uppercase;
      color:var(--muted); margin-bottom:8px; }
    input[type=password]{ width:100%; max-width:340px; padding:12px 14px; font-size:16px;
      border:1px solid var(--line); border-radius:8px; background:#fff; color:var(--ink); }
    button{ font:inherit; cursor:pointer; border-radius:8px; }
    .go{ margin-top:14px; padding:12px 24px; border:0; background:var(--ink); color:var(--cream); }
    .go:hover{ background:var(--terra); }
    :focus-visible{ outline:2px solid var(--terra); outline-offset:2px; }
    .err{ color:var(--terra); font-size:14px; margin-top:12px; min-height:1.4em; }
    ul{ list-style:none; margin:0; padding:0; }
    li{ border-bottom:1px solid var(--line); }
    .row{ display:flex; gap:14px; align-items:baseline; width:100%; text-align:left;
      padding:14px 4px; background:none; border:0; color:inherit; }
    .row:hover{ background:rgba(184,98,74,.06); }
    .sid{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:14px; }
    .meta{ color:var(--muted); font-size:13px; margin-left:auto; }
    .turn{ padding:12px 0; border-bottom:1px solid var(--line); }
    .who{ font-size:12px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); }
    .who.user{ color:var(--terra); }
    .msg{ margin-top:4px; white-space:pre-wrap; }
    .back{ display:inline-block; margin-bottom:20px; color:var(--terra); background:none;
      border:0; padding:0; font-size:14px; }
    [hidden]{ display:none !important; }
  </style>
</head>
<body>
  <main>
    <h1>Chat log</h1>
    <p class="sub">Conversations between visitors and the SAÏA assistant.</p>

    <section id="gate" aria-labelledby="gate-h">
      <h2 id="gate-h" class="sub" style="margin:0 0 12px;">Enter the password to continue</h2>
      <form id="gate-form">
        <label for="pw">Password</label>
        <input id="pw" type="password" autocomplete="current-password" required>
        <button class="go" type="submit">Open the log</button>
        <p class="err" id="gate-err" role="alert" aria-live="polite"></p>
      </form>
    </section>

    <section id="list" hidden aria-labelledby="list-h">
      <h2 id="list-h" class="sub" style="margin:0 0 12px;">Conversations, most recent first</h2>
      <ul id="sessions"></ul>
      <p class="err" id="list-err" role="alert" aria-live="polite"></p>
    </section>

    <section id="detail" hidden aria-labelledby="detail-h">
      <button class="back" id="back" type="button">&larr; All conversations</button>
      <h2 id="detail-h" class="sub" style="margin:0 0 12px;"></h2>
      <div id="turns"></div>
    </section>
  </main>

  <script>
  (function () {
    var API = '/api/chat-log';
    var gate = document.getElementById('gate'), list = document.getElementById('list'),
        detail = document.getElementById('detail'), sessions = document.getElementById('sessions'),
        turns = document.getElementById('turns'), gateErr = document.getElementById('gate-err'),
        listErr = document.getElementById('list-err'), detailH = document.getElementById('detail-h');

    function show(el) {
      [gate, list, detail].forEach(function (s) { s.hidden = s !== el; });
    }
    function fmt(ms) {
      var d = new Date(ms);
      return isNaN(d) ? '' : d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
    }

    document.getElementById('gate-form').addEventListener('submit', function (e) {
      e.preventDefault();
      gateErr.textContent = '';
      fetch(API, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: document.getElementById('pw').value }),
      }).then(function (r) {
        if (r.status === 204) { loadList(); return; }
        if (r.status === 429) { gateErr.textContent = 'Too many attempts. Try again in a few minutes.'; return; }
        if (r.status === 503) { gateErr.textContent = 'The log is not configured yet. The password and secret need setting in Vercel.'; return; }
        gateErr.textContent = 'That password was not right.';
      }).catch(function () { gateErr.textContent = 'Could not reach the server.'; });
    });

    function loadList() {
      fetch(API + '?list=1', { credentials: 'same-origin' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (data) {
          sessions.textContent = '';
          if (!data.sessions.length) { listErr.textContent = 'No conversations recorded yet.'; }
          data.sessions.forEach(function (s) {
            var li = document.createElement('li');
            var b = document.createElement('button');
            b.type = 'button'; b.className = 'row';
            var id = document.createElement('span'); id.className = 'sid'; id.textContent = s.session;
            var meta = document.createElement('span'); meta.className = 'meta';
            meta.textContent = fmt(s.lastAt) + ' · ' + s.batches + (s.batches === 1 ? ' entry' : ' entries');
            b.appendChild(id); b.appendChild(meta);
            b.addEventListener('click', function () { loadOne(s.session); });
            li.appendChild(b); sessions.appendChild(li);
          });
          show(list);
        })
        .catch(function () { gateErr.textContent = 'Could not load the conversations.'; show(gate); });
    }

    function loadOne(id) {
      fetch(API + '?session=' + encodeURIComponent(id), { credentials: 'same-origin' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (data) {
          detailH.textContent = 'Session ' + data.session;
          turns.textContent = '';
          data.turns.forEach(function (t) {
            var wrap = document.createElement('div'); wrap.className = 'turn';
            var who = document.createElement('div');
            who.className = 'who' + (t.role === 'user' ? ' user' : '');
            who.textContent = (t.role === 'user' ? 'Visitor' : t.role === 'bot' ? 'Assistant' : 'Action')
              + (t.tier ? ' · ' + t.tier : '') + ' · ' + fmt(t.at);
            var msg = document.createElement('div');
            msg.className = 'msg';
            msg.textContent = t.message;      // textContent, never innerHTML — this is visitor input
            wrap.appendChild(who); wrap.appendChild(msg); turns.appendChild(wrap);
          });
          show(detail);
          document.getElementById('back').focus();
        })
        .catch(function () { listErr.textContent = 'Could not load that conversation.'; });
    }

    document.getElementById('back').addEventListener('click', loadList);
    // an unexpired cookie from earlier today skips the password
    fetch(API + '?list=1', { credentials: 'same-origin' }).then(function (r) { if (r.ok) loadList(); });
  })();
  </script>
</body>
</html>
```

- [ ] **Step 2: Keep it out of search results**

Append to `robots.txt`:

```
Disallow: /chat-log.html
```

- [ ] **Step 3: Confirm no redirect shadows the page**

Run: `grep -n "chat-log" vercel.json`
Expected: no matches. If a catch-all redirect is ever added to `vercel.json`, `/chat-log.html` must be excluded — the page is only reachable on the Vercel deployment.

- [ ] **Step 4: Verify locally**

Run: `npm start` in terminal A, `python3 -m http.server 8000` in terminal B, open `http://localhost:8000/chat-log.html`.

Expected without env vars: the password form renders, submitting shows *"The log is not configured yet…"*. Then set them and retry:

```bash
CHAT_LOG_PASSWORD=test123 CHAT_LOG_SECRET=dev-secret npm start
```

Expected: a wrong password shows *"That password was not right."*; the right one reaches the empty-list state. Tab through the page — every control takes focus with a visible terracotta outline.

- [ ] **Step 5: Commit**

```bash
git add chat-log.html robots.txt
git commit -m "feat(log): password-protected chat transcript viewer at /chat-log.html"
```

---

### Task C6: Retire every Supabase reference

**Files:**
- Modify: `js/log-core.js` (comments), `.env.example`, `README.md` if it mentions Supabase

**Interfaces:** none

- [ ] **Step 1: Find them**

Run: `grep -rniE "supabase" --include="*.js" --include="*.md" --include="*.example" --include="*.json" . | grep -v node_modules`

- [ ] **Step 2: Replace the env template**

In `.env.example`, remove `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; add:

```
# Chat log — transcripts are stored in Vercel Blob and read at /chat-log.html
BLOB_READ_WRITE_TOKEN=
CHAT_LOG_PASSWORD=
CHAT_LOG_SECRET=
```

- [ ] **Step 3: Leave `CLAUDE.md` alone**

`CLAUDE.md` belongs to Track E. Do not edit it here.

- [ ] **Step 4: Verify**

Run: `grep -rniE "supabase" --include="*.js" --include="*.example" . | grep -v node_modules`
Expected: no matches.

Run: `node --test tests/*.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .env.example README.md js/log-core.js
git commit -m "chore(log): remove the Supabase path entirely"
```

---

# TRACK D — THE SWEEP

**Owns:** every `*.html` in the repo root **except** `index.html` and `chat-log.html`; every `theme/snippets/*.liquid`

---

### Task D1: Audit and report

**Files:** read-only

- [ ] **Step 1: Collect every candidate**

```bash
grep -rn "Cristina" --include="*.html" --include="*.liquid" . \
  | grep -v node_modules | grep -v "^./index.html" | grep -v "Cristina@saialondon.com"
```

- [ ] **Step 2: Classify each hit into one of three buckets**

| Bucket | Action | Examples |
|---|---|---|
| **CHANGE** — contact instruction or service promise | rewrite to us/we | "WhatsApp Cristina", "Message Cristina directly and she'll find you a spot" |
| **KEEP** — biography, instructor role | untouched | `story.html` founder copy, "Pilates with Cristina" body text |
| **KEEP** — title, nav label, filename, `href`, `<title>`, meta description, `aria-current` | untouched | `<a href="pilates-with-cristina.html">Pilates with Cristina</a>` |

- [ ] **Step 3: Write the classification to a scratch file and stop**

Save it, then present the CHANGE list for confirmation before editing. Anything genuinely ambiguous goes in a fourth "ASK" bucket rather than being guessed at.

---

### Task D2: Apply the rewrites

**Files:** as listed in D1's CHANGE bucket

- [ ] **Step 1: Rewrite the known footer link**

Every page footer and the matching `theme/snippets/*.liquid` carry:

```html
<a href="https://wa.me/447444611914" …>WhatsApp Cristina</a>
```

becomes

```html
<a href="https://wa.me/447444611914" …>WhatsApp us</a>
```

Leave the `href`, the styles and every sibling link exactly as they are.

- [ ] **Step 2: Rewrite `guest-list.html`**

Line 37:

```html
<p>Want to start sooner? Message us directly and we'll find you a spot.</p>
```

Line 39:

```html
<a class="btn btn-ink" href="https://wa.me/447444611914">WhatsApp us</a>
```

Keep the `.eyebrow` "Pilates with Cristina" on line 34 — that is a section title.

- [ ] **Step 3: Apply the rest of the CHANGE list**

Work file by file. For each edit, keep surrounding markup, classes and attributes byte-identical.

- [ ] **Step 4: Verify nothing in the KEEP bucket moved**

```bash
grep -rn "Pilates with Cristina" --include="*.html" --include="*.liquid" . | grep -v node_modules | wc -l
```

Expected: the same count as before the task. Record it in D1 first.

Then confirm no CTA survives:

```bash
grep -rniE "(talk to|email|message|whatsapp|ask|contact) cristina|cristina (will|confirms|arranges|handles|looks after|gets back|replies|sets)" \
  --include="*.html" --include="*.liquid" . | grep -v node_modules
```

Expected: no matches outside `index.html` (Track A's file) and the sample pages (out of scope).

- [ ] **Step 5: Spot-check in a browser**

Run: `python3 -m http.server 8000`, open `guest-list.html`, `contact-us.html`, `story.html`, `events.html`. Confirm no visual regressions and that the Pilates page still names Cristina throughout.

- [ ] **Step 6: Commit**

```bash
git add *.html theme/snippets/
git commit -m "copy(site): say 'us' instead of 'Cristina' in contact CTAs"
```

---

# TRACK A — THE BIG PAGE

**Owns:** `index.html`, `theme/templates/index.liquid`

**Blocked until:** B2, B8 and B9 are committed (A4 and A5 specifically; A1 and A2 can run earlier).

> **Every task in this track edits BOTH files.** `theme/templates/index.liquid` is a near-identical copy of `index.html` at a ~30-line offset. Never edit one and leave the other — the Shopify theme is what customers see. Each task ends with a diff check.

---

### Task A1: Copy fixes — 50 mats, the gallery heading, the studio card

**Files:**
- Modify: `index.html:795`, `:804`, `:790-797`, `:1069-1088`, `:987`; `theme/templates/index.liquid` (same blocks, ~line 767, 776, 762-769, mirror of the gallery)

**Interfaces:** none

- [ ] **Step 1: Fix the mat counts**

`index.html:804`:

```html
                <div class="s4who">10 to 50 mats</div>
```

- [ ] **Step 2: Rewrite the studio card**

Replace the first `.s4card` block (`index.html:790-797`), keeping the `<span class="s4ic">…</span>` SVG exactly as it is:

```html
              <div class="s4card">
                <span class="s4ic"><!-- keep the existing SVG here, unchanged --></span>
                <div class="s4nm">Buy mats for your studio</div>
                <div class="s4who">Bespoke, made to order</div>
                <p class="s4ds">Bespoke mats made to order for studios, in your colours and your branding. Tell us what you need and we will come back with a quote.</p>
                <div class="s4pr">By enquiry</div>
                <a class="btn-line saia-btn saia-btn--ghost" style="display:inline-flex; align-items:center; justify-content:center;" href="mailto:Cristina@saialondon.com?subject=Bespoke%20studio%20mats">Email us</a>
              </div>
```

Note the CTA changes from `<button data-hire-cta>` to an `<a>` — this card no longer opens the concierge. `display:inline-flex` keeps an anchor looking like the sibling buttons.

- [ ] **Step 3: Simplify the gallery heading**

`index.html:1069` and `:1075-1077`:

```html
  <section id="events" aria-label="Gallery">
```

```html
          <div class="gl-kicker">Gallery</div>
          <h2>Moments from SAÏA</h2>
          <p>Community classes, retreats and the mornings in between, across North West London.</p>
```

The `<em>` sub-line is gone, so also delete the now-dead CSS rule `#events .gl-intro h2 em{…}` (`index.html:131-132`).

- [ ] **Step 4: Cristina → us in this file**

`index.html:987`:

```html
            <p class="disc"><b>Flat London courier rate</b> — charged exactly as shown. We confirm timings with you before your event.</p>
```

Then run `grep -n "Cristina" index.html` and apply the Global Constraints rule to anything left. Keep the nav/drawer links to `pilates-with-cristina.html`, the "Run by Cristina" band (~line 866), and the `ca-id` subtitle "Mat hire · classes · Pilates with Cristina".

- [ ] **Step 5: Mirror into the theme**

Apply all four steps to `theme/templates/index.liquid`. Find each block with `grep -n`, not by line number — the offsets differ.

- [ ] **Step 6: Verify both files agree**

```bash
grep -c "10 to 50 mats" index.html theme/templates/index.liquid
grep -c "Buy mats for your studio" index.html theme/templates/index.liquid
grep -c "gl-kicker\">Gallery" index.html theme/templates/index.liquid
```

Expected: `1` for every file on every line.

```bash
grep -nE "\b60\+? mats|10 to 60" index.html theme/templates/index.liquid
```

Expected: no matches.

- [ ] **Step 7: Look at it**

Run: `python3 -m http.server 8000`. Scroll to the range grid and the gallery. Confirm the three cards still sit level, the "Email us" anchor looks like the sibling buttons and takes a visible focus ring on Tab.

- [ ] **Step 8: Commit**

```bash
git add index.html theme/templates/index.liquid
git commit -m "copy(home): 50-mat cap, plain gallery heading, bespoke studio card"
```

---

### Task A2: Delete the collection toggle

**Files:**
- Modify: `index.html:970-976` (markup), `:1332` (`els`), `:1337` (state), `:1374` (`colwrap` toggle), `:1388` (one-way render branch), `:1401-1403` (listener), `:1435-1436`, `:1444` (bookHire handoff); same blocks in `theme/templates/index.liquid`

**Interfaces:**
- Consumes: `KB.priceHire` ignoring `collection` (B1)
- Contract: this is cross-agent contract #1 — after this task nothing in the page references `collection`

- [ ] **Step 1: Delete the markup**

Remove the entire `<div class="pcwrap" data-colwrap>…</div>` block (`index.html:970-976`). Leave the postcode `data-pcwrap` block above it and the `.result` block below it untouched.

- [ ] **Step 2: Drop it from `els` and the state**

`index.html:1332`:

```js
      method:q('[data-method]'),
```

`index.html:1337`:

```js
    var method=null, curT=0, raf=null;
```

- [ ] **Step 3: Delete the `colwrap` show toggle**

Remove this line from `render()` (~line 1374):

```js
      if(els.colwrap) els.colwrap.classList.toggle('show',method==='deliver');
```

- [ ] **Step 4: Collapse the delivery-label branches**

Replace the three-way `if/else if/else` in `render()` (~lines 1386-1389) with two branches:

```js
      if(method==='pickup'){els.delK.innerHTML='Collection<small>Pick up from NW3, free</small>';delText='Free';wa='collect from NW3';}
      else if(z.label==='outside'){els.delK.innerHTML='Delivery &amp; collection<small>Addison Lee, by quote</small>';delText='By quote';els.zoneTxt.textContent='Outside London';zoneShow=true;wa='delivery to '+els.pc.value.toUpperCase()+' (outside London)';}
      else {els.delK.innerHTML='Delivery &amp; collection<small>Addison Lee, same-day collection</small>';delText=gbp(q.deliveryCost);els.zoneTxt.textContent=z.label;zoneShow=true;wa='delivery to '+els.pc.value.toUpperCase()+' ('+z.label+', with same-day collection)';}
```

- [ ] **Step 5: Drop `collection` from the `priceHire` call**

~line 1380:

```js
      var q=window.SAIA.KB.priceHire({mats:pricedMats,days:days,method:method,zone:zoneKey});
```

- [ ] **Step 6: Delete the segment listener**

Remove the whole `if(els.collectionSeg) els.collectionSeg.addEventListener(…)` block (~lines 1401-1403).

- [ ] **Step 7: Drop it from the booking handoff**

In the `[data-est-book]` click handler, delete the two `colEl`/`collection` lines and the `collection:` property:

```js
    var hire={
      mats:rawMats?Math.min(50,Math.max(10,rawMats)):null,
      days:parseInt((stage.querySelector('[data-days]')||{}).value,10)||null,
      method:method||null,
      postcode:method==='deliver'?(pc||null):null,
      zone:zoneObj?zoneObj.key:null
    };
```

- [ ] **Step 8: Update the WhatsApp message greeting**

Same handler, the `msg` string built in `render()` (~line 1394) opens `'Hi Cristina! I\'d like to book …'`. Change to `'Hi! I\'d like to book …'`.

- [ ] **Step 9: Verify nothing references collection**

```bash
grep -nE "collection|colwrap|data-c=" index.html theme/templates/index.liquid
```

Expected: only the words "Delivery & collection", "same-day collection" and "Collection" as display copy. No `data-colwrap`, no `data-collection`, no `data-c=`.

- [ ] **Step 10: Mirror and test in the browser**

Apply steps 1-8 to `theme/templates/index.liquid`. Then run `python3 -m http.server 8000` and build a quote: 20 mats, 2 days, Deliver, `EC2Y 8DS`. Expected: no "After your event" toggle appears; the total is £170 + £90 + £30 = £290.

- [ ] **Step 11: Commit**

```bash
git add index.html theme/templates/index.liquid
git commit -m "feat(estimator): remove the one-way collection toggle"
```

---

### Task A3: One estimator template, two mount points

**Files:**
- Modify: `index.html:943-991` (the `#estimate` section), `:1412-1413` (the wire call); mirror in `theme/templates/index.liquid`

**Interfaces:**
- Produces — **contract #4:** two `[data-est-mount]` containers, each populated from one template; ids suffixed per instance.

- [ ] **Step 1: Extract the form markup into a template function**

Add above the `wire(root)` definition in the estimator script:

```js
  /* ONE template, rendered into every [data-est-mount]. The estimator appears twice on the
     page: inside the pinned journey (desktop, chapter 4) and as a flat section (mobile).
     Duplicating the markup in the HTML would guarantee the two copies drift, and drift here
     means two different prices on one page. Ids are suffixed per instance because duplicate
     ids silently break every <label for> on the page. */
  function estMarkup(sfx) {
    return '' +
      '<p class="eyebrow">Build your quote</p>' +
      '<div class="grid2" style="margin-top:14px;">' +
        '<div class="field"><label for="estMats' + sfx + '">Mats</label>' +
        '<input id="estMats' + sfx + '" data-mats type="number" min="10" max="50" step="1" placeholder="10+" inputmode="numeric"></div>' +
        '<div class="field"><label for="estDays' + sfx + '">Days</label>' +
        '<input id="estDays' + sfx + '" data-days type="number" min="2" step="1" placeholder="2" inputmode="numeric"></div>' +
      '</div>' +
      '<div class="note" data-note aria-live="polite"></div>' +
      '<div class="field full"><label>Getting the mats</label>' +
        '<div class="seg" data-method data-m="" role="group" aria-label="Delivery method">' +
          '<span class="thumb" aria-hidden="true"></span>' +
          '<button type="button" data-m="deliver">Deliver</button>' +
          '<button type="button" data-m="pickup">Collect NW3 (free)</button>' +
        '</div>' +
      '</div>' +
      '<div class="pcwrap" data-pcwrap><div class="field full"><label for="estPc' + sfx + '">Event postcode</label>' +
        '<input id="estPc' + sfx + '" data-pc type="text" placeholder="e.g. EC2Y 8DS" autocomplete="postal-code" maxlength="9"></div></div>' +
      '<div class="result" data-result>' +
        '<span class="est-flag" aria-hidden="true">Estimate</span>' +
        '<span class="zone" data-zone><span class="dot"></span><span data-zonetxt></span></span>' +
        '<div class="line"><span class="kk">Mat hire<small data-matsub></small></span><span class="vv" data-matcost>—</span></div>' +
        '<div class="line"><span class="kk" data-delk>Delivery &amp; collection</span><span class="vv" data-delcost>—</span></div>' +
        '<div class="line"><span class="kk">Refundable deposit<small data-depsub></small></span><span class="vv" data-depcost>—</span></div>' +
        '<div class="total"><span class="kk">Due today</span><span class="vv" data-total>—</span></div>' +
        '<p class="disc" data-depback style="margin-top:8px;"></p>' +
        '<button type="button" class="cta saia-btn saia-btn--terra" data-cta data-est-book>' +
          '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 5h16v11H7l-3 3z"/></svg> Book now</button>' +
        '<p class="disc"><b>Flat London courier rate</b> — charged exactly as shown. We confirm timings with you before your event.</p>' +
      '</div>';
  }
```

(The event-date field is added in A4 — do not add it yet.)

- [ ] **Step 2: Replace the inline form with a mount point**

In the `#estimate` section, replace the whole `<form class="est b" data-est …>…</form>` with:

```html
        <form class="est b" data-est data-est-mount data-est-sfx="" onsubmit="return false"></form>
```

- [ ] **Step 3: Render into every mount and wire each one**

Replace `index.html:1412-1413`:

```js
  var mounts=[].slice.call(document.querySelectorAll('[data-est-mount]'));
  mounts.forEach(function(m){ m.innerHTML=estMarkup(m.getAttribute('data-est-sfx')||''); });
  var roots=[].slice.call(document.querySelectorAll('[data-est]'));
  var ctrls=roots.map(wire);
  var ctrl=ctrls[0];
  ctrls.forEach(function(c){ c.prefill(); c.render(); });
```

Then find every later use of the single `ctrl` (`ctrl.reset()` in `play()`, and anything else — `grep -n "ctrl\." index.html`) and fan it out across `ctrls`:

```js
  function play(){ if(played) return; played=true;
    vb.classList.add('play'); stage.classList.add('in'); ctrls.forEach(function(c){ c.reset(); });
```

- [ ] **Step 4: Scope the book handler per instance**

The `[data-est-book]` handler currently queries `stage`, which will find the wrong instance once there are two. Move it inside `wire(root)` and query `root` instead of `stage`. Replace every `stage.querySelector('[data-…]')` inside that handler with the matching `els.*` reference already resolved by `wire`:

```js
    // hand THIS instance's estimate to the shared booking flow
    var bookBtn=root.querySelector('[data-est-book]');
    if(bookBtn) bookBtn.addEventListener('click',function(){
      var K=window.SAIA&&window.SAIA.KB;
      var pc=(els.pc.value||'').toUpperCase();
      var zoneObj=(K&&method==='deliver'&&pc)?K.classify(pc):null;
      var rawMats=parseInt(els.mats.value,10)||0;
      var hire={
        mats:rawMats?Math.min(50,Math.max(10,rawMats)):null,
        days:parseInt(els.days.value,10)||null,
        method:method||null,
        postcode:method==='deliver'?(pc||null):null,
        zone:zoneObj?zoneObj.key:null
      };
      if(window.SAIA&&window.SAIA.bookHire){ window.SAIA.bookHire(hire); return; }
      try{ sessionStorage.setItem('saia_hire', JSON.stringify(hire)); }catch(e){ /* ignore */ }
      window.location.href='checkout.html';
    });
```

Delete the old standalone handler that sat after the IntersectionObserver block.

- [ ] **Step 5: Verify a single instance still works**

Run: `python3 -m http.server 8000`. There is still only one mount point at this stage. Build a quote and press Book now. Expected: identical behaviour to before this task; no console errors; `document.querySelectorAll('#estMats').length === 1`.

- [ ] **Step 6: Mirror and commit**

Apply every step to `theme/templates/index.liquid`.

```bash
git add index.html theme/templates/index.liquid
git commit -m "refactor(estimator): render one template into mount points so it can appear twice"
```

---

### Task A4: Require an event date, show the derived dates

**Files:**
- Modify: `index.html` — `estMarkup()` (A3), `wire()`'s `els`/`render()`, the book handler; mirror in `theme/templates/index.liquid`

**Interfaces:**
- Consumes: `KB.deriveDates(hire, todayISO?)`, `KB.formatDate(iso)`, `KB.dateLabels(hire)` (B2)

- [ ] **Step 1: Add the field to the template**

In `estMarkup()`, insert immediately after the `grid2` block and before the `data-note` div:

```js
      '<div class="field full"><label for="estDate' + sfx + '">Event date</label>' +
        '<input id="estDate' + sfx + '" data-date type="date" required></div>' +
```

- [ ] **Step 2: Add the derived-dates readout**

In `estMarkup()`, inside `data-result`, immediately before the `data-est-book` button:

```js
        '<p class="disc" data-dates style="margin-top:8px;"></p>' +
```

- [ ] **Step 3: Resolve the new elements**

In `wire()`'s `els` object add:

```js
      date:q('[data-date]'),dates:q('[data-dates]'),
```

- [ ] **Step 4: Gate the quote on the date and render the readout**

Inside `render()`, after `var s3=…`, extend the completeness check:

```js
      var hasDate=!!(els.date&&els.date.value);
      var s3=s2&&(method==='pickup'||(method==='deliver'&&z!==null))&&hasDate;
```

Then, just before the WhatsApp `msg` is built, add:

```js
      // four dates on every booking: one entered, three derived (js/saia-knowledge.js)
      if(els.dates){
        var dd=window.SAIA.KB.deriveDates({date:els.date?els.date.value:null,days:days,method:method});
        if(dd){
          var lb=window.SAIA.KB.dateLabels({method:method});
          els.dates.textContent=lb.delivery+' '+window.SAIA.KB.formatDate(dd.delivery)
            +' · '+lb.collection+' '+window.SAIA.KB.formatDate(dd.collection)+'.';
        } else { els.dates.textContent=''; }
      }
```

- [ ] **Step 5: Re-render when the date changes**

Add `els.date` to the input listener list:

```js
    ['input','change'].forEach(function(ev){els.mats.addEventListener(ev,render);els.days.addEventListener(ev,render);els.pc.addEventListener(ev,render);if(els.date)els.date.addEventListener(ev,render);});
```

- [ ] **Step 6: Pass the date into the booking handoff**

In the book handler from A3, add to the `hire` object:

```js
        date:(els.date&&els.date.value)||null,
```

- [ ] **Step 7: Keep the prefill honest**

`prefill()` sets demo values. Leave the date **empty** — a prefilled event date would let someone book a date they never chose. If the demo needs the result panel visible on load, that is what `data-note` copy is for; do not fake a date.

- [ ] **Step 8: Verify**

Run: `python3 -m http.server 8000`. Enter 20 mats, 2 days, Deliver, `EC2Y 8DS`, no date. Expected: the result panel stays hidden. Add a date of 14 March 2026. Expected: the panel appears, the total is £290, and the readout reads `Delivery date Fri 13 Mar 2026 · Collection date Sat 14 Mar 2026.` Switch to Collect NW3. Expected: the labels change to `Pickup from NW3` / `Return to NW3`.

Tab through the form. Expected: the date input is reachable, its label is associated (clicking "Event date" focuses it), and the focus ring is visible.

- [ ] **Step 9: Mirror and commit**

```bash
git add index.html theme/templates/index.liquid
git commit -m "feat(estimator): require an event date and show the derived delivery/collection dates"
```

---

### Task A5: The swap

**Files:**
- Modify: `index.html:784-816` (band 4), `:943-991` (the `#estimate` section), `:518` (the mobile band-hiding rule); mirror in `theme/templates/index.liquid`

**Interfaces:**
- Consumes: `window.SAIA.journeyPaused` + `[data-journey-pause]` (B8)

- [ ] **Step 1: Move the estimator into the band**

Replace the whole contents of `<div data-band="0.44,0.556" …>` with the estimator's inner markup — the `.stagewrap`, its `.pitch` column and a mount point. Keep the band's own wrapper `<div>` and its `style` attribute exactly as they are, and add `data-journey-pause` to the band so B8's focus handler finds it:

```html
        <!-- BAND 4 — INSTANT QUOTATION (the estimator, at the end of the mat-hire scroll) -->
        <div data-band="0.44,0.556" data-journey-pause style="position:absolute; inset:0; display:flex; align-items:flex-start; justify-content:center; padding:13vh 6vw 0;">
          <div class="band-inner saia-est-stage is-inband" style="width:100%; max-width:1000px;">
            <div class="stagewrap">
              <div class="pitch">
                <p class="eyebrow">Mat hire · instant estimate</p>
                <h2><span class="word">Get</span> <span class="word">an</span> <span class="word">instant</span> <span class="word">Quotation.</span></h2>
                <p class="lead">From our NW3 base to your event: mats, days and courier, totalled live.</p>
                <div class="bigroute" data-route-wrap data-big></div>
              </div>
              <form class="est b" data-est data-est-mount data-est-sfx="" onsubmit="return false"></form>
            </div>
          </div>
        </div>
```

- [ ] **Step 2: Move the range grid out**

Replace the whole `<section id="estimate" class="saia-est-stage" …>…</section>` with a flat section carrying the three-card grid *and* the mobile estimator. Keep `id="estimate"` here — it is the mobile-visible instance, and B8 intercepts the desktop case:

```html
  <!-- ============ INSTANT QUOTATION — mobile flat copy (desktop shows it in the pin) ====== -->
  <section id="estimate" class="saia-est-stage est-flat" aria-label="Estimate your mat hire">
    <div class="vb">
      <div class="est-deco" aria-hidden="true">
        <span class="est-blob b1"></span><span class="est-blob b2"></span>
      </div>
      <div class="stagewrap">
        <div class="pitch">
          <p class="eyebrow">Mat hire · instant estimate</p>
          <h2><span class="word">Get</span> <span class="word">an</span> <span class="word">instant</span> <span class="word">Quotation.</span></h2>
          <p class="lead">From our NW3 base to your event: mats, days and courier, totalled live.</p>
          <div class="bigroute" data-route-wrap data-big></div>
        </div>
        <form class="est b" data-est data-est-mount data-est-sfx="-m" onsubmit="return false"></form>
      </div>
    </div>
  </section>

  <!-- ============ HIRE THE RANGE — for every gathering ============ -->
  <section aria-label="Hire the range" style="background:#F5F1E8; padding:clamp(48px,7vw,96px) 6vw;">
    <div style="max-width:1000px; margin:0 auto;">
      <div style="text-align:center; margin-bottom:36px;">
        <div style="font-size:12px; letter-spacing:.3em; text-transform:uppercase; color:#6B6358; margin-bottom:14px;">Hire the range</div>
        <h2 style="font-family:'Playfair Display',serif; font-weight:500; font-size:clamp(32px,4.4vw,52px); line-height:1.03; margin:0; color:#2B2620;">For every gathering.</h2>
      </div>
      <div class="s4grid">
        <!-- the three .s4card blocks, moved here verbatim from band 4 (A1's edits included) -->
      </div>
    </div>
  </section>
```

Move the three `.s4card` blocks across **verbatim**, including A1's rewritten studio card.

- [ ] **Step 3: Show each instance at the right breakpoint**

Add to the estimator's `<style>` block:

```css
  /* The estimator appears twice: inside the pinned journey on desktop (chapter 4) and as a
     flat section on mobile, where the pin does not run. Exactly one is ever visible. */
  @media (min-width:768px){ .saia-est-stage.est-flat{ display:none; } }
  @media (max-width:767px){ .saia-est-stage.is-inband{ display:none; } }
  /* in-band: the pinned band supplies its own height and padding, so drop the
     full-viewport stage sizing the flat section needs */
  .saia-est-stage.is-inband{ min-height:0; padding:0; background:none; }
```

- [ ] **Step 4: Update the mobile band-hiding comment**

`index.html:514-518` — the comment still says the band is the range grid. Correct it:

```css
    #top [data-band="0.44,0.556"],   /* instant quotation — desktop only, mobile gets the flat copy */
```

- [ ] **Step 5: Confirm Task B9 has landed**

A form inside a cross-faded band is invisible but still tabbable. Task **B9** makes inactive bands `inert`. That file belongs to Track B — do not edit it here.

Run: `grep -n "inert" js/home-journey.js`
Expected: one match inside `bands()`. If there is none, stop and ask for B9 before continuing, because without it Tab drops focus into an invisible estimator.

- [ ] **Step 6: Verify on desktop**

Run: `python3 -m http.server 8000` at ≥1024px.

- Scroll to chapter 4. Expected: the estimator, not the three cards.
- Click into the postcode field and type. Expected: the page does **not** scroll; `window.SAIA.journeyPaused` reads `true` in the console.
- Click outside the form and scroll. Expected: snapping resumes.
- Press Tab from the nav repeatedly. Expected: focus never lands in an invisible band.
- Click "Hire mats" in the nav. Expected: a smooth scroll to chapter 4.
- Scroll past the journey. Expected: the "Hire the range" three-card section, then the concierge, then the gallery.

- [ ] **Step 7: Verify on mobile**

Resize to 375px. Expected: the mobile journey runs; below it the flat estimator appears, then the range grid; `document.querySelectorAll('#estMats-m').length === 1`; building a quote works and Book now hands off.

- [ ] **Step 8: Mirror and commit**

```bash
git add index.html theme/templates/index.liquid
git commit -m "feat(home): swap the instant quotation into the pinned journey, range grid to a flat section"
```

> **If the pinned estimator fights the user** — the page still scrolls while typing, or trackpad momentum keeps stealing focus — stop and report. The spec's recorded fallback is to revert this task alone: the range grid goes back into the band and the estimator stays flat. Do not spend more than one attempt tuning it.

---

### Task A6: Flatten the gallery

**Files:**
- Modify: `index.html:161-184` (tile + stage CSS), `:100-102` (`.gl-sticky` perspective), `:92` (the `--gl-tint` var), and the gallery script's var writes; mirror in `theme/templates/index.liquid`

**Interfaces:** none

- [ ] **Step 1: Drop the tint and the sheen**

Delete both pseudo-elements entirely (`index.html:174-178`):

```css
  #events .gl-tile::before{ … }   /* delete */
  #events .gl-tile::after{ … }    /* delete */
```

- [ ] **Step 2: Remove the exit drain from the tiles**

Replace the tile and image rules:

```css
  #events .gl-tile{ position:relative; overflow:hidden; border-radius:14px; background:#EBE3D5;
    box-shadow:0 26px 60px -28px rgba(43,38,32,.55), 0 2px 8px rgba(43,38,32,.10);
    outline:1px solid rgba(255,255,255,.35); outline-offset:-1px;
    transition:transform .6s cubic-bezier(.16,1,.3,1), box-shadow .6s ease; }
  #events .gl-tile img{ width:100%; aspect-ratio:4/5; object-fit:cover;
    transition:transform 1.1s cubic-bezier(.16,1,.3,1); }
```

- [ ] **Step 3: Flatten the stage**

```css
  #events .gl-stage{ display:grid; grid-template-columns:repeat(3,1fr); gap:1rem; width:min(1080px,88vw);
    will-change:transform; margin:0 auto; z-index:10; }
```

`transform-style`, `rotateX(62deg)` and `scale(1.18)` all go. Then remove the now-dead 3D context from `.gl-sticky` (line ~101):

```css
  #events .gl-sticky{ position:sticky; top:0; height:100vh; width:100%; overflow:hidden;
    display:flex; flex-direction:column; align-items:center; justify-content:center; }
```

- [ ] **Step 4: Strip the colour change out of hover**

```css
  #events .gl-tile:hover img{ transform:scale(1.07); }
```

The `filter:saturate(1.08) contrast(1.04) brightness(1.02)` is gone; the `#events .gl-tile:hover` transform/shadow rule above it stays exactly as it is.

- [ ] **Step 5: Remove the dead custom properties**

Line 92: drop `--gl-tint:1` and `--gl-exit:0` from the `#events` var list. Then find every write in the gallery script — `grep -n "gl-tint\|gl-exit" index.html` — and delete those `style.setProperty` calls. **Keep** `--gl-warm` and `--gl-ht`; the background glow and the heading dissolve stay.

- [ ] **Step 6: Verify the tiles fit**

Run: `python3 -m http.server 8000` and scroll the gallery at 1440px, 1024px and 375px.

Expected: photos in natural colour at every scroll position, no tilt, cards still pan on scroll, nothing clipped at the top or bottom of the 100vh sticky viewport.

If tiles overflow now that the tilt no longer foreshortens them, reduce `.gl-stage` `width` or `gap` — do **not** reintroduce a `scale()` transform, which would undo the flattening.

- [ ] **Step 7: Check reduced motion still works**

In DevTools, emulate `prefers-reduced-motion: reduce`. Expected: the section collapses to `height:auto` per the existing rule at `index.html:191-192`, and no animation runs.

- [ ] **Step 8: Mirror and commit**

```bash
git add index.html theme/templates/index.liquid
git commit -m "style(gallery): straight cards, no tint, no grayscale, no 3D tilt"
```

---

### Task A7: Bump the cache-busting versions

**Files:**
- Modify: `index.html` (every `<script src="js/…?v=">`), `theme/templates/index.liquid`

- [ ] **Step 1: Find every versioned script tag**

Run: `grep -n "js/.*?v=" index.html`

- [ ] **Step 2: Bump each `?v=` value**

Every `js/*` file changed in this release: `saia-knowledge.js`, `planner.js`, `shopify-cart.js`, `checkout.js`, `home-concierge.js`, `home-journey.js`, `saia-examples.js`. Increment each tag's version. Without this, returning visitors run the old brain against the new markup and the estimator breaks silently.

- [ ] **Step 3: Verify**

Run: `python3 -m http.server 8000`, hard-reload, and confirm in DevTools → Network that every `js/*` request carries the new version string.

- [ ] **Step 4: Commit**

```bash
git add index.html theme/templates/index.liquid
git commit -m "chore(cache): bump js asset versions"
```

---

### Task A8: Confirm the two homepages agree

**Files:** read-only check across `index.html` and `theme/templates/index.liquid`

- [ ] **Step 1: Diff the two files structurally**

```bash
diff <(grep -oE 'data-[a-z-]+' index.html | sort | uniq -c) \
     <(grep -oE 'data-[a-z-]+' theme/templates/index.liquid | sort | uniq -c)
```

Expected: no differences. Any `data-` hook present in one file and not the other is a missed mirror.

- [ ] **Step 2: Check the copy landed in both**

```bash
for s in "10 to 50 mats" "Buy mats for your studio" "gl-kicker\">Gallery" "data-est-mount" "data-journey-pause" "est-flat" "data-date"; do
  echo "$s: $(grep -c "$s" index.html) / $(grep -c "$s" theme/templates/index.liquid)"
done
```

Expected: matching non-zero counts on every line.

- [ ] **Step 3: Confirm nothing removed came back**

```bash
grep -nE "data-colwrap|data-collection|rotateX\(62deg\)|gl-tint|gl-exit|10 to 60|60\+ mats" \
  index.html theme/templates/index.liquid
```

Expected: no matches.

- [ ] **Step 4: Commit any fixes**

```bash
git add index.html theme/templates/index.liquid
git commit -m "fix(theme): sync index.liquid with index.html"
```

---

# TRACK E — SYNC, DOCS, VERIFY

**Owns:** `theme/assets/*`, `theme/snippets/saia-boot.liquid`, `theme/config/settings_schema.json`, `CLAUDE.md`, `docs/MANUAL-shopify-steps.md`

**Blocked until:** Tracks A, B, C and D are all committed.

---

### Task E1: Re-copy the shared JS into the theme

**Files:**
- Modify: `theme/assets/saia-knowledge.js`, `planner.js`, `shopify-cart.js`, `checkout-handoff.js`, `home-journey.js`, `home-mobile-journey.js`, `home-concierge.js`, `checkout.js`

- [ ] **Step 1: List what the theme currently carries**

Run: `ls theme/assets/*.js`

- [ ] **Step 2: Copy each file that exists in both places**

```bash
cd "/Users/at/Projects/site 2"
for f in theme/assets/*.js; do
  b=$(basename "$f")
  if [ -f "js/$b" ]; then cp "js/$b" "$f"; echo "synced $b"; fi
done
```

`concierge-core.js` and `saia-examples.js` are **server-side only** — they must not appear in `theme/assets/`. If the loop reports either, delete it from the theme.

- [ ] **Step 3: Verify no drift remains**

```bash
for f in theme/assets/*.js; do
  b=$(basename "$f"); [ -f "js/$b" ] && (diff -q "js/$b" "$f" || echo "DRIFT: $b")
done
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add theme/assets/
git commit -m "chore(theme): re-copy shared js into theme assets"
```

---

### Task E2: Drop the one-way variant from the theme config

**Files:**
- Modify: `theme/snippets/saia-boot.liquid:23`, `theme/config/settings_schema.json`

- [ ] **Step 1: Remove the boot line**

Delete line 23 of `theme/snippets/saia-boot.liquid`:

```liquid
    courierOneWayVariant: {{ settings.variant_courier_one_way | json }},
```

Check the trailing comma on the line above it still parses — `courierTwoWayVariant` must end with a comma only if `pickupVariant` follows.

- [ ] **Step 2: Remove the theme setting**

Run: `grep -n "variant_courier_one_way" theme/config/settings_schema.json`

Delete the whole setting object, watching the surrounding JSON commas.

- [ ] **Step 3: Validate the JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('theme/config/settings_schema.json','utf8')); console.log('valid')"
```

Expected: `valid`.

- [ ] **Step 4: Verify nothing references it**

Run: `grep -rn "courierOneWayVariant\|variant_courier_one_way" . | grep -v node_modules | grep -v tests/`

Expected: no matches outside `tests/shopify-cart.test.js`, where `CFG` keeps it deliberately to prove the code ignores it.

- [ ] **Step 5: Commit**

```bash
git add theme/snippets/saia-boot.liquid theme/config/settings_schema.json
git commit -m "chore(theme): remove the one-way courier variant setting"
```

---

### Task E3: Rewrite the project rules

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Amend the brand rule**

Replace the HIRE ONLY bullet under "Brand rules (always)":

```markdown
- Mats are **HIRE ONLY** for events, classes and individuals — never "buy"/"for sale".
  £8.50/mat, 2-day hire, **min 10, max 50** (our current stock — no bulk discount; over 50 →
  suggest staggered/reused sessions, never book past 50).
  **One exception:** studios can commission **bespoke mats made to order** — enquiry only, by
  email to Cristina@saialondon.com. No price, no online purchase, no checkout path. The
  concierge must never quote a bespoke price.
- Say **"us"/"we"** in every contact instruction and service promise ("email us", "talk to
  us", "we confirm timings"). Keep Cristina's name for biography, the Pilates instructor
  role, page/nav titles and the email address itself.
```

- [ ] **Step 2: Rewrite the delivery section**

Replace the "Delivery — flat London courier" section's pricing model paragraph:

```markdown
- **Pricing model (LIVE):** delivery is **symmetric** — either we handle both journeys
  (**£90 flat across London**, delivery + same-day collection) or you handle both
  (free pickup from and return to NW3). There is no mixed option; the old £45 delivery-only
  price is gone. Outside London → WhatsApp quote. Postcode zones now only pick the label and
  the outside-London case. The price lives in `KB.delivery.twoWay` in `js/saia-knowledge.js`.
- **The choice is the delivery method itself**, made in the estimator or the assistant —
  `hire.method` is `'deliver' | 'pickup'`. `hire.collection` no longer exists.
- **Changing the courier price = two places, both must match:** `KB.delivery.twoWay` in
  `js/saia-knowledge.js` and the Shopify two-way courier variant price (plus the £90 paid
  fallback rate in the "SAÏA mat hire (checkout plumbing)" shipping profile).
```

Then update the booking-math paragraph: **12 tools**, `set_collection` removed, and the slot order becomes `mats → days → method → postcode → date`.

- [ ] **Step 3: Rewrite the logging section**

Replace "## Conversation logging" wholesale:

```markdown
## Conversation logging

Every chat turn (user, bot + tier, action lines) is fired from `js/home-concierge.js` to
`POST /api/log` (fire-and-forget; endpoint derived from `conciergeEndpoint`). `js/log-core.js`
(shared by `api/log.js` + `server.js`) validates it and writes **one immutable JSON blob per
request** to **Vercel Blob** under `chats/<date>/<session>/`. Never read-modify-write a
per-session file: concurrent turns would lose each other.

Cristina reads conversations at **`/chat-log.html`** on the Vercel deployment, behind a
password (`CHAT_LOG_PASSWORD`, which buys an 8-hour HMAC cookie signed with
`CHAT_LOG_SECRET`). The reader returns transcript *content* only, never a blob URL — Blob
URLs are public-but-unguessable and transcripts carry names, postcodes and emails.

Needs `BLOB_READ_WRITE_TOKEN`, `CHAT_LOG_PASSWORD` and `CHAT_LOG_SECRET` in Vercel. Without
them rows are accepted and dropped, so local dev needs zero setup. `curl /health` reports
`hasBlobStore` so it is verifiable at a glance.
```

- [ ] **Step 4: Note the four dates**

Add under the delivery section:

```markdown
- **Every booking carries four dates.** The customer enters the event date only;
  `KB.deriveDates()` in `js/saia-knowledge.js` derives booking (today), delivery (event − 1)
  and collection (event + days − 2). All four land on the Shopify cart as attributes.
```

- [ ] **Step 5: Note the two estimator instances**

In the "Shopify theme" section, add:

```markdown
The estimator markup is a single JS template rendered into every `[data-est-mount]`. It
appears **twice** per page: inside the pinned journey (desktop, chapter 4) and as a flat
section (mobile). Ids are suffixed per instance. Edit the template, never the rendered
output, and land the change in both `index.html` and `theme/templates/index.liquid`.
```

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update project rules for symmetric delivery, bespoke studios, blob logging"
```

---

### Task E4: The client's manual checklist

**Files:**
- Create: `docs/MANUAL-shopify-steps.md`

- [ ] **Step 1: Write the doc**

```markdown
# Manual steps — August 2026 release

Code alone does not finish this release. These four groups of settings live in Shopify
and Vercel dashboards and must be done by hand. **Do the Shopify steps at the same time
as the code goes live, not after.**

## 1. Require a phone number at checkout

Shopify admin → **Settings → Checkout → Customer contact method** →
set **Shipping address phone number** to **Required** → Save.

Why: the courier needs to reach the customer on the day. This is the only place a real
order can be gated, so without this toggle we can still take an order with no phone number.

## 2. Retire the £45 one-way courier option

The site no longer offers "we deliver, you return". Two things must change:

- [ ] **Products → Courier delivery** (the hidden product) → archive the **one-way / £45**
      variant. Leave the two-way £90 variant published.
- [ ] **Settings → Shipping and delivery → SAÏA mat hire (checkout plumbing)** → delete the
      paid **£45** rate. Leave the **£90** rate and the free
      "Courier — already included in your hire total" rate.

> ⚠️ If the £45 rate is left in place it reappears at checkout and undercuts the £90 line
> item that is already in the cart. This is the single highest-risk step in the release.

- [ ] **Theme settings** → the "Courier one-way variant" field is gone from the schema.
      Confirm the theme still saves without error after pushing.

## 3. Turn the chat log on

Vercel dashboard → the SAÏA project.

- [ ] **Storage → Blob → Create.** This adds `BLOB_READ_WRITE_TOKEN` automatically.
- [ ] **Settings → Environment Variables →** add `CHAT_LOG_PASSWORD` (the password Cristina
      will type) and `CHAT_LOG_SECRET` (any long random string; generate one with
      `openssl rand -hex 32`).
- [ ] Redeploy so the new variables take effect.
- [ ] Check `https://<deployment>/api/health` reports `"hasBlobStore": true`.
- [ ] Have a short chat on the live site, then open `https://<deployment>/chat-log.html`,
      enter the password and confirm the conversation appears.

Cristina bookmarks `/chat-log.html`. The password lasts 8 hours per browser, so she types
it about once a day.

## 4. Verify the release end to end

- [ ] Estimator: 20 mats, 2 days, Deliver, EC2Y 8DS, an event date → total **£290**
      (£170 mats + £90 courier + £30 deposit).
- [ ] There is no "After your event" toggle anywhere.
- [ ] Book now → the Shopify cart shows one **£90** courier line and four dated attributes
      (Booking date, Event date, Delivery date, Collection date).
- [ ] Checkout will not complete without a phone number.
- [ ] Ask the assistant "can I buy mats for my studio?" → a bespoke, email-us answer with
      no price.
- [ ] Ask it "any discount for 80 mats?" → no discount offered, and it never books past 50.
- [ ] Nowhere on the site says 60 mats.
```

- [ ] **Step 2: Commit**

```bash
git add docs/MANUAL-shopify-steps.md
git commit -m "docs: manual Shopify and Vercel steps for the August release"
```

---

### Task E5: The gate

**Files:** none modified unless a check fails

- [ ] **Step 1: Run every test**

```bash
node --test tests/*.test.js
```

Expected: all pass. This is the release gate — nothing ships red.

- [ ] **Step 2: Grep for anything the release was supposed to remove**

```bash
grep -rnE "10 to 60|60\+ mats|oneWay|courierOneWayVariant|data-colwrap|set_collection|SUPABASE|rotateX\(62deg\)" \
  --include="*.js" --include="*.html" --include="*.liquid" --include="*.json" . \
  | grep -v node_modules | grep -v tools/lab | grep -v sample- | grep -v tests/
```

Expected: no output.

- [ ] **Step 3: Grep for anything the release was supposed to add**

```bash
grep -rln "deriveDates" js/ | sort
grep -rln "storeChatLogs" js/ api/ | sort
grep -c "data-est-mount" index.html theme/templates/index.liquid
```

Expected: `deriveDates` in `saia-knowledge.js`, `shopify-cart.js`, `checkout.js`, `planner.js`; `storeChatLogs` in `log-core.js`, `api/log.js`, `server.js`; `data-est-mount` twice in each homepage.

- [ ] **Step 4: Walk the site**

Run: `npm start` in terminal A, `python3 -m http.server 8000` in terminal B.

At 1440px:
- [ ] Journey chapter 4 shows the estimator; typing a postcode does not scroll the page
- [ ] Tab from the nav through the journey — focus never enters an invisible band
- [ ] "Hire mats" in the nav scrolls to chapter 4
- [ ] Below the journey: quotation, then the range grid, then the concierge, then the gallery
- [ ] Gallery photos are full colour, flat, and still pan on scroll
- [ ] The studio card reads "Buy mats for your studio" and its Email us link opens a mail client

At 375px:
- [ ] The mobile journey runs, then the flat estimator, then the range grid
- [ ] The estimator builds a quote and Book now hands off

Concierge:
- [ ] "20 mats saturday NW3" walks mats → days → method → postcode → date, with no
      return-journey question
- [ ] "can I buy mats for my studio?" gives the bespoke email answer with no price
- [ ] "discount for 80 mats?" offers no discount and never books past 50

- [ ] **Step 5: Report**

Write a short pass/fail list for every checkbox above. Anything failing goes back to its
owning track — do not patch another track's file to make a check pass.
