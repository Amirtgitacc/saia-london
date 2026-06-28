# SAÏA Assistant — slot-filling brain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single-shot concierge into a stateful, deterministic "SAÏA Assistant" that collects a hire's details one at a time (mats → days → delivery → date → confirm) and shows a correct, itemised quote including a refundable deposit.

**Architecture:** A shared knowledge module (`saia-knowledge.js`) becomes the single source of pricing truth (`classify`, `priceHire`). The Tier-1 brain (`planner.js`) becomes stateful — it reads the in-progress `hire` object, fills whatever the latest message provides, and asks for the next missing slot. The two front ends pass `hire` into the brain and persist the returned `awaiting` hint. Tier-2 (Claude, `server.js`) stays the off-script fallback. The existing `applyActions` stays the one deterministic booking executor for both tiers.

**Tech Stack:** Vanilla JS (dual-mode IIFE modules), Node http + `@anthropic-ai/sdk` (server), `node --test` (built-in, no new deps) for the pricing/brain unit tests. No build step.

## Global Constraints

- **Mats are HIRE ONLY** — never "buy"/"for sale". Copy must never imply sale.
- **Prices (verbatim):** £8.50/mat, 2-day base hire, +£1.50/mat per extra day, min 10 mats, 60+ → reduced quote. **Refundable deposit £1.50/mat.**
- **Courier (placeholder estimates):** Central from £35, Greater London from £45, outside London → WhatsApp quote. NW3 pickup is free.
- **Voice:** warm, female-led, unpretentious, British English. English-only.
- **Naming:** user-facing label is **"SAÏA Assistant"** — drop the word "Concierge" and the persona name "Noor" from anything a user sees. (Internal identifiers like `NS.Concierge`, `home-concierge.js`, `/api/concierge` stay unchanged — code only.)
- **Contact:** WhatsApp Cristina 07444 611 914; NW3 area.
- **Single source of truth:** all facts/prices live in `js/saia-knowledge.js`. Never hard-code a price anywhere else.
- **No new runtime dependencies.** Tests use `node --test`.
- Don't remove existing UI elements; only modify what these tasks name.

---

## File structure

| File | Responsibility |
|---|---|
| `js/saia-knowledge.js` | Facts + **pricing single source**: `classify(postcode)`, `priceHire(hire)`, `KB.delivery`, `KB.hire.depositPerMat` |
| `js/planner.js` | Stateful Tier-1 brain: `localPlan(text, hire)` slot-filling + `applyActions` executor (dual-mode) |
| `server.js` | Tier-2 Claude fallback: extended schema + slot-asking system prompt |
| `js/home-concierge.js` | home.html UI: pass hire to brain, itemised quote card, confirm, fix `seedEstimate`, rename |
| `js/concierge-ui.js` | index/hero UI: pass hire to brain, persist `awaiting`, correct total, rename |
| `home.html` | estimator reuses shared math + shows deposit; header rename |
| `index.html` / `hero.html` | header + placeholder renames |
| `tests/pricing.test.js` | unit tests for `classify` + `priceHire` |
| `tests/planner.test.js` | unit tests for slot-filling `localPlan` + `applyActions` |

---

## Task 1: Shared delivery zones + `classify()`

**Files:**
- Modify: `js/saia-knowledge.js` (add `KB.hire.depositPerMat`, `KB.delivery`, `KB.classify`)
- Test: `tests/pricing.test.js`

**Interfaces:**
- Produces: `KB.classify(raw)` → returns a zone object `{ key:'central'|'greater', label, round }`, or `{ key:'outside', label:'outside', round:null }`, or `null` if unparseable. `KB.delivery = { zones, central[], london[], outer[] }`. `KB.hire.depositPerMat = 1.5`.

- [ ] **Step 1: Write the failing test**

Create `tests/pricing.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const KB = require('../js/saia-knowledge.js');

test('depositPerMat fact present', () => {
  assert.strictEqual(KB.hire.depositPerMat, 1.5);
});

test('classify maps central postcodes', () => {
  assert.strictEqual(KB.classify('EC2Y 8DS').key, 'central');
  assert.strictEqual(KB.classify('SW1A 1AA').key, 'central');
  assert.strictEqual(KB.classify('NW1 4RY').key, 'central');
});

test('classify maps greater-London postcodes', () => {
  assert.strictEqual(KB.classify('E17 9AA').key, 'greater');   // E area, not in central list
  assert.strictEqual(KB.classify('BR1 1AA').key, 'greater');   // outer borough
});

test('classify flags outside London', () => {
  assert.strictEqual(KB.classify('M1 1AA').key, 'outside');
  assert.strictEqual(KB.classify('CB1 1AA').key, 'outside');
});

test('classify returns null for junk', () => {
  assert.strictEqual(KB.classify('x'), null);
  assert.strictEqual(KB.classify(''), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/pricing.test.js`
Expected: FAIL — `KB.classify is not a function` / `depositPerMat` undefined.

- [ ] **Step 3: Implement in `js/saia-knowledge.js`**

In the `hire` object, add the deposit fact right after `extraDayPerMat`:

```js
      extraDayPerMat: 1.5,                  // £ per mat per additional day
      depositPerMat: 1.5,                   // £ per mat, REFUNDABLE — returned after collection
```

Then, immediately **before** `KB.factSheet = [` (after the `KB` object literal closes), add the delivery zones, classifier and pricing helper:

```js
  /* ---- delivery zones + pricing (single source, lifted from the home estimator) ---- */
  KB.delivery = {
    zones: {
      central: { key: 'central', label: 'Zone 1 · Central London', round: 35 },
      greater: { key: 'greater', label: 'Zone 2 · Greater London', round: 45 },
    },
    central: ['EC1', 'EC2', 'EC3', 'EC4', 'WC1', 'WC2', 'W1', 'SW1', 'SE1', 'N1', 'NW1', 'E1', 'W2'],
    london: ['E', 'EC', 'N', 'NW', 'SE', 'SW', 'W', 'WC'],
    outer: ['BR', 'CR', 'DA', 'EN', 'HA', 'IG', 'KT', 'RM', 'SM', 'TW', 'UB', 'WD'],
  };

  // postcode -> zone object (or null if it can't be read)
  KB.classify = function (raw) {
    var D = KB.delivery;
    var pc = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (pc.length < 2) return null;
    var ow = pc.length > 3 ? pc.slice(0, pc.length - 3) : pc;
    var m = ow.match(/^([A-Z]{1,2})(\d{1,2})?/);
    if (!m) return null;
    var area = m[1], key = area + (m[2] ? m[2] : '');
    if (D.central.indexOf(key) !== -1) return D.zones.central;
    if (D.london.indexOf(area) !== -1 || D.outer.indexOf(area) !== -1) return D.zones.greater;
    return { key: 'outside', label: 'outside', round: null };
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/pricing.test.js`
Expected: PASS (the `priceHire` test does not exist yet; all `classify`/deposit tests pass).

- [ ] **Step 5: Commit**

```bash
git add js/saia-knowledge.js tests/pricing.test.js
git commit -m "feat(kb): shared delivery zones + postcode classifier"
```

---

## Task 2: `priceHire()` with refundable deposit

**Files:**
- Modify: `js/saia-knowledge.js` (add `KB.priceHire`)
- Test: `tests/pricing.test.js` (extend)

**Interfaces:**
- Consumes: `KB.hire` facts, `KB.classify`.
- Produces: `KB.priceHire(hire)` → `{ matCost, deliveryCost, deliveryLabel, deposit, total, quoteOnly }`.
  - `matCost = mats*8.50 + mats*1.50*max(0, days-2)` (days defaults to 2).
  - `deposit = mats*1.50`.
  - When `hire.method==='pickup'`: `deliveryCost=0`, `deliveryLabel='Pickup from NW3 · free'`.
  - When zone central/greater: `deliveryCost=round`, `deliveryLabel='Courier · Central London'|'Courier · Greater London'`.
  - When zone outside: `deliveryCost=null`, `deliveryLabel='Courier · by quote'`, `quoteOnly=true`.
  - When delivery not yet chosen: `deliveryCost=null`, `deliveryLabel=null`.
  - `total = matCost + deliveryCost + deposit`, or `null` whenever `deliveryCost` is `null` (quote-only / undecided).

- [ ] **Step 1: Write the failing test**

Append to `tests/pricing.test.js`:

```js
test('priceHire — 50 mats, 2 days, central delivery', () => {
  const q = KB.priceHire({ mats: 50, days: 2, method: 'deliver', zone: 'central' });
  assert.strictEqual(q.matCost, 425);
  assert.strictEqual(q.deposit, 75);
  assert.strictEqual(q.deliveryCost, 35);
  assert.strictEqual(q.total, 535);          // 425 + 35 + 75
  assert.strictEqual(q.quoteOnly, false);
});

test('priceHire — extra days add £1.50/mat/day', () => {
  const q = KB.priceHire({ mats: 20, days: 3, method: 'pickup' });
  assert.strictEqual(q.matCost, 200);        // 20*8.5 + 20*1.5*1
  assert.strictEqual(q.deliveryCost, 0);
  assert.strictEqual(q.deposit, 30);
  assert.strictEqual(q.total, 230);          // 200 + 0 + 30
});

test('priceHire — outside London is quote-only', () => {
  const q = KB.priceHire({ mats: 10, days: 2, method: 'deliver', zone: 'outside' });
  assert.strictEqual(q.matCost, 85);
  assert.strictEqual(q.deposit, 15);
  assert.strictEqual(q.deliveryCost, null);
  assert.strictEqual(q.total, null);
  assert.strictEqual(q.quoteOnly, true);
});

test('priceHire — delivery undecided has null total', () => {
  const q = KB.priceHire({ mats: 50, days: 2 });
  assert.strictEqual(q.matCost, 425);
  assert.strictEqual(q.deliveryLabel, null);
  assert.strictEqual(q.total, null);
});

test('priceHire — defaults days to 2 when absent', () => {
  const q = KB.priceHire({ mats: 10, method: 'pickup' });
  assert.strictEqual(q.matCost, 85);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/pricing.test.js`
Expected: FAIL — `KB.priceHire is not a function`.

- [ ] **Step 3: Implement in `js/saia-knowledge.js`**

Immediately after `KB.classify = function ... };` add:

```js
  // full hire price — the ONE place totals are computed
  KB.priceHire = function (hire) {
    var H = KB.hire;
    hire = hire || {};
    var mats = parseInt(hire.mats, 10) || 0;
    var days = parseInt(hire.days, 10) || H.hireDays;
    var matCost = mats * H.pricePerMat + mats * H.extraDayPerMat * Math.max(0, days - H.hireDays);
    var deposit = mats * H.depositPerMat;

    var deliveryCost = null, deliveryLabel = null, quoteOnly = false;
    if (hire.method === 'pickup') {
      deliveryCost = 0; deliveryLabel = 'Pickup from NW3 · free';
    } else if (hire.zone === 'outside') {
      deliveryCost = null; deliveryLabel = 'Courier · by quote'; quoteOnly = true;
    } else if (hire.zone === 'central' || hire.zone === 'greater') {
      var z = KB.delivery.zones[hire.zone];
      deliveryCost = z.round;
      deliveryLabel = 'Courier · ' + (hire.zone === 'central' ? 'Central London' : 'Greater London');
    }

    var total = (deliveryCost == null) ? null : matCost + deliveryCost + deposit;
    return { matCost: matCost, deliveryCost: deliveryCost, deliveryLabel: deliveryLabel, deposit: deposit, total: total, quoteOnly: quoteOnly };
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/pricing.test.js`
Expected: PASS — all pricing tests green.

- [ ] **Step 5: Commit**

```bash
git add js/saia-knowledge.js tests/pricing.test.js
git commit -m "feat(kb): priceHire with refundable deposit + courier"
```

---

## Task 3: home.html estimator reuses shared math

**Files:**
- Modify: `home.html` (estimator script, ~lines 1004-1101) — replace private `classify`/formula with `KB.classify`/`KB.priceHire`, add deposit line.

**Interfaces:**
- Consumes: `window.SAIA.KB.classify`, `window.SAIA.KB.priceHire`. (saia-knowledge.js is already loaded on home.html before this script.)

There is no automated test (DOM rendering). Verify manually.

- [ ] **Step 1: Point the estimator at the shared classifier**

In `home.html`, inside the estimator IIFE, delete the local `CENTRAL`/`LONDON`/`OUTER`/`ZONES` consts and the local `function classify(raw){...}` (lines ~1006-1019). Replace the `classify` reference in `render()` with the shared one. At the top of the IIFE keep `MAT_RATE`/etc only if still referenced; otherwise replace the cost line.

Replace the mat-cost + zone lines in `render()`:

```js
      var z=method==='deliver'?classify(els.pc.value):null;
```
with:
```js
      var z=method==='deliver'?window.SAIA.KB.classify(els.pc.value):null;
```

- [ ] **Step 2: Use `priceHire` for the totals and add the deposit line**

In `render()`, replace the block that computes `matCost` and the per-branch totals with a single `priceHire` call. Find:

```js
      var matCost=mats*MAT_RATE+mats*EXTRA_DAY*Math.max(0,days-BASE_DAYS);
      els.matCost.textContent=gbp(matCost); if(els.matSub) els.matSub.textContent=mats+' mats · '+days+' days';
```
and compute via the KB instead:
```js
      var zoneKey = method==='pickup' ? null : (z ? z.key : null);
      var q = window.SAIA.KB.priceHire({ mats:mats, days:days, method:method, zone:zoneKey });
      var matCost = q.matCost;
      els.matCost.textContent=gbp(matCost); if(els.matSub) els.matSub.textContent=mats+' mats · '+days+' days';
```

Then in the same function, after the existing delivery-cost branch sets `totalNum`, **fold in the deposit** so the displayed total matches the assistant. Replace the final total assignment so it uses `q.total` when available:

```js
      // courier label/text branch above still sets delText/zoneShow/wa as before, but the
      // numeric total now comes from priceHire (it includes the refundable deposit):
      var totalNum = q.total;            // null when outside London / pickup-undecided
      var prefix = (q.total!=null && method!=='pickup') ? '<span class="pre">from</span>' : '';
```

Add a deposit line to the result card. Find the markup around `[data-matcost]` (the mats cost row, ~home.html line 793) and add a sibling row for the deposit (use the existing row classes — copy the structure of the mats row, label "Refundable deposit", value `gbp(q.deposit)`, and a small note "returned after collection"). Render it in `render()`:

```js
      if (els.deposit) els.deposit.textContent = gbp(q.deposit);
```
and add `deposit:q('[data-deposit]')` to the `els` map.

- [ ] **Step 3: Manual verification**

Run: `python3 -m http.server 8000` (from project root), open `http://localhost:8000/home.html`, scroll to the estimate spotlight.
Expected: with the prefilled 20 mats / 2 days / EC2Y 8DS, the card shows mats £170.00, courier from £35.00, **refundable deposit £30.00**, total **from £235.00** (170 + 35 + 30). Change postcode to `M1 1AA` → courier "By quote", total shows mats + quote.

- [ ] **Step 4: Commit**

```bash
git add home.html
git commit -m "refactor(home): estimator uses shared priceHire + deposit line"
```

---

## Task 4: Dual-mode planner + extended `applyActions`

**Files:**
- Modify: `js/planner.js` (wrap dual-mode; extend `applyActions`; route totals through `KB.priceHire`)
- Test: `tests/planner.test.js`

**Interfaces:**
- Consumes: `KB.priceHire`, `KB.classify`, `KB.hire`.
- Produces: `module.exports = { total, applyActions, localPlan }` (also `window.SAIA.Planner`). New `applyActions` tools: `set_days {n}`, `set_method {method}`, `set_postcode {pc}`. `quote`/`checkout`/`confirm` totals come from `KB.priceHire`.

- [ ] **Step 1: Write the failing test**

Create `tests/planner.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const Planner = require('../js/planner.js');

const base = () => ({ mats: 0, guests: null, date: null, days: null, method: null, postcode: null, zone: null, total: null, status: null });

test('set_days then quote prices extra days + deposit', () => {
  let h = base();
  h = Planner.applyActions(h, [{ tool: 'add_mats', args: { n: 20 } }]).hire;
  h = Planner.applyActions(h, [{ tool: 'set_days', args: { n: 3 } }]).hire;
  h = Planner.applyActions(h, [{ tool: 'set_method', args: { method: 'pickup' } }]).hire;
  h = Planner.applyActions(h, [{ tool: 'quote' }]).hire;
  assert.strictEqual(h.days, 3);
  assert.strictEqual(h.method, 'pickup');
  assert.strictEqual(h.total, 230);          // 200 mats + 0 courier + 30 deposit
});

test('set_postcode classifies the zone and prices courier', () => {
  let h = base();
  h = Planner.applyActions(h, [{ tool: 'add_mats', args: { n: 50 } }]).hire;
  h = Planner.applyActions(h, [{ tool: 'set_postcode', args: { pc: 'EC2Y 8DS' } }]).hire;
  h = Planner.applyActions(h, [{ tool: 'quote' }]).hire;
  assert.strictEqual(h.zone, 'central');
  assert.strictEqual(h.method, 'deliver');
  assert.strictEqual(h.total, 535);          // 425 + 35 + 75
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/planner.test.js`
Expected: FAIL — `Cannot find module` / `Planner.applyActions` undefined (planner.js is browser-only IIFE).

- [ ] **Step 3: Make planner.js dual-mode**

Replace the file's opening wrapper. Change the current top:

```js
(function () {
  const NS = (window.SAIA = window.SAIA || {});

  // Minimal fallback so scripted replies still work if the KB ever fails to load.
  const KB = NS.KB || {
```
to:
```js
(function (root, factory) {
  var P = factory(typeof require === 'function'
    ? require('./saia-knowledge.js')
    : ((root.SAIA && root.SAIA.KB) || null));
  if (typeof module !== 'undefined' && module.exports) module.exports = P;
  if (typeof window !== 'undefined') { (window.SAIA = window.SAIA || {}).Planner = P; }
})(typeof self !== 'undefined' ? self : this, function (KBin) {
  // Minimal fallback so scripted replies still work if the KB ever fails to load.
  const KB = KBin || {
```

And change the file's closing:

```js
  NS.Planner = { total, applyActions, localPlan };
})();
```
to:
```js
  return { total, applyActions, localPlan };
});
```

> The fallback `KB` literal stays as-is for resilience, but pricing now depends on `KB.priceHire`/`KB.classify` which the real module always provides (loaded before planner on every page, and via `require` in Node).

- [ ] **Step 4: Route totals through `priceHire` and add the new tools**

Replace the `total` helper (line ~31):

```js
  function total(h) { return h.mats ? h.mats * H.pricePerMat : null; }
```
with:
```js
  function total(h) { return KB.priceHire ? KB.priceHire(h).total : (h.mats ? h.mats * H.pricePerMat : null); }
```

In `applyActions`, update these cases and add three new ones. Replace the `add_mats`, `recommend`, `quote`, `checkout`, `confirm` cases and add `set_days`/`set_method`/`set_postcode`:

```js
        case 'add_mats':
          hire.mats = Math.max(0, parseInt(args.n, 10) || 0); hire.total = total(hire);
          acts.push('Added ' + hire.mats + ' mats to your hire'); break;
        case 'set_days':
          hire.days = Math.max(H.hireDays, parseInt(args.n, 10) || H.hireDays); hire.total = total(hire);
          acts.push('Set hire length to ' + hire.days + ' days'); break;
        case 'set_method':
          hire.method = (args.method === 'pickup') ? 'pickup' : 'deliver';
          if (hire.method === 'pickup') { hire.postcode = null; hire.zone = null; }
          hire.total = total(hire);
          acts.push(hire.method === 'pickup' ? 'Collection from NW3 selected' : 'Courier delivery selected'); break;
        case 'set_postcode': {
          hire.postcode = args.pc || hire.postcode; hire.method = 'deliver';
          const z = KB.classify ? KB.classify(hire.postcode) : null;
          hire.zone = z ? z.key : null; hire.total = total(hire);
          acts.push('Delivery to ' + String(hire.postcode || '').toUpperCase() + (z && z.key !== 'outside' ? ' · ' + z.label : '')); break;
        }
        case 'recommend': {
          const g = parseInt(args.guests, 10) || hire.guests || 0;
          const rec = Math.max(H.minMats, Math.ceil(g * 1.1));
          hire.guests = g || hire.guests; hire.mats = rec; hire.total = total(hire);
          acts.push('Recommended ' + rec + ' mats for ' + (g || '—') + ' guests'); break;
        }
        case 'quote': hire.total = total(hire); hire.status = 'Quoted'; acts.push('Prepared your quote'); break;
```

And update `checkout`/`confirm` to use the new total:

```js
        case 'checkout': if (hire.total == null) hire.total = total(hire); hire.status = 'Checkout link ready'; acts.push('Generated a secure Shopify checkout link'); break;
        case 'confirm': if (hire.total == null) hire.total = total(hire); hire.status = 'Confirmed'; acts.push('Hire confirmed. Confirmation on its way'); break;
```

Leave `set_event`, `set_date`, `book_delivery`, `rsvp_event`, `book_pilates`, `join_newsletter` unchanged.

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/planner.test.js`
Expected: PASS (the slot-filling `localPlan` tests are added in Task 5).

- [ ] **Step 6: Commit**

```bash
git add js/planner.js tests/planner.test.js
git commit -m "feat(brain): dual-mode planner + set_days/method/postcode + priceHire totals"
```

---

## Task 5: Stateful slot-filling `localPlan(text, hire)`

**Files:**
- Modify: `js/planner.js` (`localPlan` rewrite — add the hire flow; keep all existing FAQ intents)
- Test: `tests/planner.test.js` (extend)

**Interfaces:**
- Consumes: `KB.classify`, `KB.priceHire`, `KB.hire`.
- Produces: `localPlan(text, hire)` → `{ say, actions, matched, awaiting }`. `awaiting` is one of `'mats'|'days'|'method'|'postcode'|'date'|'confirm'|null`. Front ends apply `actions` via `applyActions`, then set `hire.awaiting = result.awaiting`.

- [ ] **Step 1: Write the failing test**

Append to `tests/planner.test.js`:

```js
test('mats given, asks for days next', () => {
  const r = Planner.localPlan('I need 50 mats for next saturday', { mats: 0, days: null, awaiting: null });
  assert.strictEqual(r.matched, true);
  assert.strictEqual(r.awaiting, 'days');
  assert.ok(/day/i.test(r.say));
  assert.ok(r.actions.some(a => a.tool === 'add_mats' && a.args.n === 50));
});

test('bare number while awaiting days is read as days', () => {
  const r = Planner.localPlan('just the 2', { mats: 50, days: null, awaiting: 'days' });
  assert.strictEqual(r.awaiting, 'method');     // days now known → ask delivery method
  assert.ok(r.actions.some(a => a.tool === 'set_days' && a.args.n === 2));
});

test('after method=deliver, asks for postcode', () => {
  const r = Planner.localPlan('delivered please', { mats: 50, days: 2, method: null, awaiting: 'method' });
  assert.strictEqual(r.awaiting, 'postcode');
  assert.ok(r.actions.some(a => a.tool === 'set_method' && a.args.method === 'deliver'));
});

test('postcode completes priced slots → quote + asks date', () => {
  const r = Planner.localPlan('EC2Y 8DS', { mats: 50, days: 2, method: 'deliver', zone: null, date: null, awaiting: 'postcode' });
  assert.strictEqual(r.awaiting, 'date');
  assert.ok(r.actions.some(a => a.tool === 'set_postcode'));
  assert.ok(r.actions.some(a => a.tool === 'quote'));
});

test('pickup skips postcode → quote + asks date', () => {
  const r = Planner.localPlan('I will collect from NW3', { mats: 20, days: 2, method: null, date: null, awaiting: 'method' });
  assert.strictEqual(r.awaiting, 'date');
  assert.ok(r.actions.some(a => a.tool === 'set_method' && a.args.method === 'pickup'));
  assert.ok(r.actions.some(a => a.tool === 'quote'));
});

test('confirm books it', () => {
  const r = Planner.localPlan('yes please', { mats: 50, days: 2, method: 'deliver', zone: 'central', date: 'Saturday', awaiting: 'confirm' });
  assert.ok(r.actions.some(a => a.tool === 'checkout' || a.tool === 'confirm'));
});

test('guests recommend a mat count', () => {
  const r = Planner.localPlan('I am hosting 30 women', { mats: 0, awaiting: null });
  assert.ok(r.actions.some(a => a.tool === 'recommend' && a.args.guests === 30));
  assert.strictEqual(r.awaiting, 'days');
});

test('non-hire question still answered (founder)', () => {
  const r = Planner.localPlan('who is Cristina?', {});
  assert.strictEqual(r.matched, true);
  assert.ok(/Cristina/i.test(r.say));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/planner.test.js`
Expected: FAIL — `localPlan` ignores the second arg; `awaiting` undefined; old code adds mats and asks for a price instead of days.

- [ ] **Step 3: Rewrite `localPlan` in `js/planner.js`**

Replace the entire `function localPlan(text) { ... }` block with the version below. It keeps every existing FAQ intent and adds the stateful hire flow at the top.

```js
  /* ---- the brain: stateful for the hire flow, scripted for everything else ---- */
  function localPlan(text, hire) {
    const t = (text || '').toLowerCase().trim();
    hire = hire || {};
    const has = (re) => re.test(t);
    const nb = (re) => { const mm = t.match(re); return mm ? parseInt(mm[1], 10) : null; };
    const rec = (g) => Math.max(H.minMats, Math.ceil(g * 1.1));
    const m = (say, actions) => ({ say, actions: actions || [], matched: true, awaiting: null });
    const mk = (say, actions, awaiting) => ({ say, actions: actions || [], matched: true, awaiting: awaiting || null });

    // --- parse signals from this message ---
    const guests = nb(/(\d+)\s*(?:people|guests|persons|pax|attendees|women|ladies|of us|girls)/);
    const matsN = nb(/(\d+)\s*mats?/);
    const daysN = nb(/(\d+)\s*(?:day|days|nights?)/);
    const dateWord = (t.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|this weekend|next weekend|next week|next month)\b/) || [])[1];
    const wantsDeliver = has(/deliver|drop ?off|courier|bring them|ship/);
    const wantsPickup = has(/pick.?up|collect|warehouse|\bnw3\b/);
    const pcMatch = (text || '').match(/\b([A-Za-z]{1,2}\d[A-Za-z\d]?(?:\s*\d[A-Za-z]{2})?)\b/);
    const looksPostcode = pcMatch && KB.classify && KB.classify(pcMatch[1]);

    const aw = hire.awaiting;
    const inHireFlow = !!(aw && /^(mats|days|method|postcode|date|confirm)$/.test(aw));

    // --- bare answers interpreted in the context of what we just asked ---
    const bareNum = (t.match(/^(?:just\s+)?(?:the\s+)?(\d+)\b/) || [])[1];

    // ===== confirm step =====
    if (aw === 'confirm' && has(/^(yes|yep|yeah|sure|go ahead|do it|lock it|confirm|book it|sounds good|please|ok|okay|perfect)\b/))
      return mk('Wonderful. Your secure checkout link is in the panel — that’s you booked. Delivery the day before, collection after. Welcome to SAÏA.', [{ tool: 'checkout' }], null);

    // ===== build / continue the hire flow =====
    // Trigger: mid-flow, or a fresh hire signal (a count, "hire", "book", "rent", "event with mats")
    const freshHire = (matsN != null) || (guests != null) || has(/\bhire\b|\brent\b|book .*mats|mat hire|quote/);
    if (inHireFlow || freshHire) {
      const h = Object.assign({}, hire);
      const actions = [];

      // mats / guests
      if (matsN != null) { h.mats = matsN; actions.push({ tool: 'add_mats', args: { n: matsN } }); }
      else if (guests != null && !h.mats) { h.guests = guests; h.mats = rec(guests); actions.push({ tool: 'recommend', args: { guests } }); }
      else if (aw === 'mats' && bareNum) { h.mats = parseInt(bareNum, 10); actions.push({ tool: 'add_mats', args: { n: h.mats } }); }

      // days
      if (daysN != null) { h.days = Math.max(H.hireDays, daysN); actions.push({ tool: 'set_days', args: { n: h.days } }); }
      else if (aw === 'days' && bareNum) { h.days = Math.max(H.hireDays, parseInt(bareNum, 10)); actions.push({ tool: 'set_days', args: { n: h.days } }); }

      // delivery method + postcode
      if (looksPostcode) { h.method = 'deliver'; h.postcode = pcMatch[1]; h.zone = looksPostcode.key; actions.push({ tool: 'set_postcode', args: { pc: pcMatch[1] } }); }
      else if (wantsPickup) { h.method = 'pickup'; h.zone = null; h.postcode = null; actions.push({ tool: 'set_method', args: { method: 'pickup' } }); }
      else if (wantsDeliver) { h.method = 'deliver'; actions.push({ tool: 'set_method', args: { method: 'deliver' } }); }

      // date
      if (dateWord) { h.date = dateWord; actions.push({ tool: 'set_date', args: { date: dateWord } }); }

      // decide the next missing slot
      const need = (function (x) {
        if (!x.mats) return 'mats';
        if (!x.days) return 'days';
        if (!x.method) return 'method';
        if (x.method === 'deliver' && !x.zone) return 'postcode';
        if (!x.date) return 'date';
        return 'confirm';
      })(h);

      if (need === 'mats') return mk('Lovely — let’s plan your hire. How many mats do you need? (Minimum ' + H.minMats + '.)', actions, 'mats');
      if (need === 'days') return mk((h.mats ? h.mats + ' mats — perfect. ' : '') + 'How many days do you need them? Our standard hire is ' + H.hireDays + ' days.', actions, 'days');
      if (need === 'method') return mk('Shall we deliver by courier, or will you collect from our NW3 warehouse?', actions, 'method');
      if (need === 'postcode') return mk('What’s the event postcode? I’ll work out the courier from there.', actions, 'postcode');

      // priced slots complete → quote
      actions.push({ tool: 'quote' });
      const q = KB.priceHire ? KB.priceHire(h) : { total: null, deposit: 0, quoteOnly: false };
      const headline = q.quoteOnly
        ? (money(q.matCost) + ' for the mats, plus a courier quote for outside London'
            + (h.postcode ? ' — WhatsApp ' + KB.contact.person + ' on ' + KB.contact.whatsapp + ' and she’ll confirm it' : ''))
        : ('from ' + money(q.total) + ' all in — ' + money(q.deposit) + ' of that is a refundable deposit, returned after collection');
      const lead = 'Here’s your estimate: ' + headline + '. ';
      if (need === 'date') return mk(lead + 'What date is your event? I’ll line up delivery the day before.', actions, 'date');
      return mk(lead + 'Shall I pencil it in for ' + h.date + ' and make your checkout link?', actions, 'confirm');
    }

    // ===== everything below: the existing scripted FAQ intents (unchanged behaviour) =====

    // greeting / thanks
    if (has(/^(hi|hey|hello|good (morning|afternoon|evening)|yo|hiya)\b/))
      return m('Hello, lovely. I can plan mat hire for an event, share what’s on, or book you in for Pilates with Cristina. What brings you in?');
    if (has(/\b(thanks|thank you|cheers|ta)\b/))
      return m('Any time. Anything else I can sort for your day?');

    // who we are / founder / the name
    if (has(/who (runs|started|made|owns|is behind|founded)|founder|sa[ïi]a mean|meaning of|story behind|who'?s cristina|about cristina/))
      return m(KB.founder.bio + ' ' + KB.founder.meaning);
    if (has(/what is sa[ïi]a|what'?s sa[ïi]a|about sa[ïi]a|tell me about (you|saia|saïa)|what do you (do|offer)/))
      return m((KB.club.what || 'SAÏA is a female-led club for women in London.') + ' Mostly I help with mat hire for events, plus community gatherings and Pilates with Cristina. Where shall we start?');

    // Pilates / classes
    if (has(/pilates|reformer|class(es)?|yoga session|work ?out|sessions?\b/) && !has(/mat/)) {
      return m('Pilates with Cristina is ' + KB.pilates.method + '. ' + KB.pilates.format + '. Shall I hold you a place' + (dateWord ? ' for ' + dateWord : '') + '?',
        [{ tool: 'book_pilates', args: { date: dateWord || null } }]);
    }

    // events / community
    if (has(/what'?s on|whats on|upcoming|any events?|events\b|this month|brunch|book club|watercolou?r|gathering|community/))
      return m('This season: ' + KB.events.slice(0, 3).join(', ') + '. Want me to reserve you a place?',
        [{ tool: 'rsvp_event', args: { event: KB.events[0] } }]);

    // membership / join
    if (has(/right for me|is (it|this) for me|join\b|member|belong|guest list|newsletter|sign ?up/))
      return m('If you want to move, gather and breathe with women who lift each other up, yes — it’s for you. No pressure, no performing. ' + KB.club.join + ' and I’ll send the next gathering.',
        [{ tool: 'join_newsletter', args: {} }]);

    // mat spec
    if (has(/what (are|kind|type)|material|rubber|thick|how big|dimension|size|spec|pvc|slip|odou?r|smell|made of/) && (has(/mat/) || has(/rubber|thick|pvc|slip|odou?r/)))
      return m('Our mat is ' + H.mat.size + ', ' + H.mat.colour + ', ' + H.mat.material + ', ' + H.mat.features + '. We hire it from ' + money(H.pricePerMat) + ' a mat. How many are you expecting?');

    // how hire works
    if (has(/how (does|do|to)\s?(it|this|the hire|i|we)?\s?(work|hire|rent)|how does (it|hire) work|process/))
      return m('Simple: tell me your numbers and date, we deliver the day before (min ' + H.minMats + ' mats, from ' + money(H.pricePerMat) + ' each for a ' + H.hireDays + '-day hire) and collect after. Shall I start a quote?');

    // delivery / collection facts
    if (has(/deliver|courier|ship|drop ?off|bring them/))
      return m(H.delivery + ' Tell me your numbers and postcode and I’ll price it.');
    if (has(/collect|return|pick.?up|pick them|after the event|clean|wash/))
      return m(H.collection);

    // location / contact
    if (has(/where|location|nw3|warehouse|address|whats ?app|phone|number|contact|call|reach|email/))
      return m('We’re ' + (KB.contact.pickup || 'in London') + '. For the quickest service, WhatsApp ' + KB.contact.person + ' on ' + KB.contact.whatsapp + '. Or tell me your numbers and I’ll start your hire right here.');

    // pricing FAQ (no count yet)
    if (has(/price|quote|cost|how much|rate|charge/))
      return mk(money(H.pricePerMat) + ' per mat for a ' + H.hireDays + '-day hire, minimum ' + H.minMats + ', plus a refundable ' + money(H.depositPerMat) + '/mat deposit and courier across London. How many mats do you need?', [], 'mats');

    // not recognised → Tier 2
    return {
      say: 'I can plan your mat hire and make a checkout link, share what’s on, book Pilates with Cristina, or help you decide if SAÏA is for you. Where shall we start?',
      actions: [],
      matched: false,
      awaiting: null,
    };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/planner.test.js`
Expected: PASS — all slot-filling + FAQ tests green.

- [ ] **Step 5: Run the full suite**

Run: `node --test tests/`
Expected: PASS — pricing + planner suites both green.

- [ ] **Step 6: Commit**

```bash
git add js/planner.js tests/planner.test.js
git commit -m "feat(brain): stateful slot-filling hire flow (mats→days→delivery→date→confirm)"
```

---

## Task 6: Tier-2 (server.js) asks for missing slots

**Files:**
- Modify: `server.js` (TOOLS, SCHEMA enum + args, systemPrompt)

No automated test (network call). Verify with `curl`.

- [ ] **Step 1: Add the new tools + schema args**

In `server.js`, extend `TOOLS` (line ~21):

```js
const TOOLS = ['add_mats', 'set_event', 'recommend', 'set_days', 'set_method', 'set_postcode', 'set_date', 'quote',
  'book_delivery', 'checkout', 'confirm', 'rsvp_event', 'book_pilates', 'join_newsletter'];
```

In `SCHEMA.properties.actions.items.properties.args.properties`, add `method` and `pc`:

```js
            properties: {
              n: { type: 'integer', description: 'number of mats (add_mats) or days (set_days)' },
              guests: { type: 'integer', description: 'headcount (set_event/recommend)' },
              date: { type: 'string', description: 'a day, e.g. "Saturday"' },
              method: { type: 'string', enum: ['deliver', 'pickup'], description: 'delivery method (set_method)' },
              pc: { type: 'string', description: 'event postcode (set_postcode)' },
              event: { type: 'string', description: 'event name (rsvp_event)' },
              email: { type: 'string', description: 'email (join_newsletter)' },
            },
```

- [ ] **Step 2: Update the system prompt to ask, not assume**

In `systemPrompt()`, replace the ACTIONS block and add a slot-filling rule. Change the RULES list to include:

```js
    'RULES:',
    '- Mats are for HIRE ONLY. Never say they are for sale.',
    '- Never invent a price, term, date, or fact that is not in your knowledge below. If you don’t know, say so and point to WhatsApp ' + KB.contact.person + ' on ' + KB.contact.whatsapp + '.',
    '- You do NOT calculate totals yourself. To price or recommend a count, emit an action and the app computes it deterministically (mats + extra days + courier + a refundable £' + KB.hire.depositPerMat.toFixed(2) + '/mat deposit).',
    '- For a mat hire, COLLECT THE DETAILS ONE AT A TIME before quoting: number of mats (or guests → recommend), number of days (never assume — ask), delivery (courier + postcode, or free NW3 pickup), then the event date. Ask for the next missing detail in a single warm sentence.',
    '- Courier is an estimate: ' + KB.hire.currency + '35 Central, ' + KB.hire.currency + '45 Greater London, outside London → WhatsApp quote. NW3 pickup is free.',
```

Replace the ACTIONS block:

```js
    'ACTIONS you may emit (only when they match the user’s intent, otherwise return an empty actions array):',
    '- add_mats {n} · recommend {guests} (app picks a sensible count) · set_days {n} · set_method {method:"deliver"|"pickup"} · set_postcode {pc} · set_date {date} · set_event {guests,date}',
    '- quote {} (price once mats+days+delivery are known) · book_delivery {date} · checkout {} (payment link) · confirm {}',
    '- rsvp_event {event} · book_pilates {date} · join_newsletter {email}',
    'Prefer recommend over guessing a mat count. Emit set_days/set_method/set_postcode as the user supplies them. For a plain question, return actions: [].',
```

- [ ] **Step 3: Manual verification**

Run (terminal A): `npm start`
Run (terminal B):
```bash
curl -s localhost:8787/api/concierge -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","text":"can I get mats for a retreat"}],"hire":{"mats":0}}'
```
Expected: JSON `{say, actions}` where `say` asks for a count/days (not a finished quote), and actions are empty or a single slot action. (Requires `ANTHROPIC_API_KEY` in `.env`.)

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "feat(server): tier-2 asks for missing hire slots, new slot tools"
```

---

## Task 7: home.html UI — itemised quote, confirm, rename

**Files:**
- Modify: `js/home-concierge.js` (`send`, `applyAndShow`, `basketEl`, `greet`, `seedEstimate`)
- Modify: `home.html` (header text line 922, launcher/aria labels, estimator handoff comment)

No automated test (DOM). Verify manually.

**Interfaces:**
- Consumes: `NS.Planner.localPlan(text, hire)` returning `awaiting`; `NS.KB.priceHire`.

- [ ] **Step 1: Pass hire into the brain and persist `awaiting`**

In `js/home-concierge.js` `send()` (line ~124), change the localPlan call to pass hire and store awaiting:

```js
    const plan = (NS.Planner && NS.Planner.localPlan)
      ? NS.Planner.localPlan(text, state.hire)
      : { say: GENERIC, actions: [], matched: false, awaiting: null };
    if (plan.matched) {
      clearTimeout(replyTimer);
      replyTimer = setTimeout(() => applyAndShow(plan), 650);
      return;
    }
    askAssist();
```

In `applyAndShow(plan)` (line ~92), persist the awaiting hint after applying actions:

```js
  function applyAndShow(plan) {
    state.typing = false;
    const exec = (NS.Planner && NS.Planner.applyActions)
      ? NS.Planner.applyActions(state.hire, plan.actions || [])
      : { hire: state.hire, acts: [] };
    state.hire = exec.hire;
    state.hire.awaiting = (plan && 'awaiting' in plan) ? plan.awaiting : state.hire.awaiting;
    state.msgs.push({ from: 'bot', text: plan.say });
    (exec.acts || []).forEach((a) => state.msgs.push({ from: 'act', text: a }));
    render();
  }
```

- [ ] **Step 2: Itemised quote card in `basketEl()`**

Replace the whole `basketEl()` function (lines ~136-157) with:

```js
  function basketEl() {
    const h = state.hire;
    if (!h.mats && !h.status) return null;
    const days = h.days || H.hireDays;
    const q = (NS.KB && NS.KB.priceHire) ? NS.KB.priceHire(h)
      : { matCost: (h.mats || 0) * H.pricePerMat, deposit: (h.mats || 0) * (H.depositPerMat || 1.5), deliveryCost: null, deliveryLabel: null, total: h.total, quoteOnly: false };
    const wrap = el('div', BASKET);
    wrap.appendChild(el('div', BASKET_T, 'Your hire'));

    const row = (label, value) => {
      const r = el('div', BASKET_LINE);
      r.appendChild(el('span', '', label));
      r.appendChild(el('span', '', value));
      return r;
    };

    wrap.appendChild(row((h.mats || 0) + ' mats · ' + days + '-day hire', money(q.matCost)));
    if (q.deliveryLabel) wrap.appendChild(row(q.deliveryLabel, q.deliveryCost == null ? 'by quote' : (q.deliveryCost === 0 ? 'free' : 'from ' + money(q.deliveryCost))));
    if (h.mats) wrap.appendChild(row('Refundable deposit', money(q.deposit)));

    const totalLine = el('div', BASKET_LINE);
    totalLine.appendChild(el('span', BASKET_T, q.quoteOnly ? 'Mats + courier quote' : 'Total to pay'));
    totalLine.appendChild(el('span', BASKET_TOTAL, q.total != null ? 'from ' + money(q.total) : money(q.matCost) + ' + quote'));
    wrap.appendChild(totalLine);
    if (q.total != null && h.mats) wrap.appendChild(el('div', BASKET_STATUS, money(q.deposit) + ' of that is returned after collection'));
    if (h.status) wrap.appendChild(el('div', BASKET_STATUS, h.status));

    if (h.status === 'Confirmed') {
      wrap.appendChild(el('div', BASKET_DONE, '✓ Confirmed. Welcome to SAÏA.'));
    } else if (h.mats) {
      const isCheckout = h.status === 'Checkout link ready';
      const btn = el('button', BASKET_BTN, isCheckout ? 'Confirm booking →' : 'To checkout →');
      btn.setAttribute('type', 'button');
      btn.addEventListener('click', () => send(isCheckout ? 'confirm' : 'checkout'));
      wrap.appendChild(btn);
    }
    return wrap;
  }
```

- [ ] **Step 3: Update greeting + fix `seedEstimate`**

In `greet()` (line ~79), drop "Noor"/"concierge" from the default text:

```js
      text = 'Hello, lovely. I can plan mat hire for your event, share what’s on, or book Pilates with Cristina. What brings you in?';
```

Replace `seedEstimate()` (lines ~198-222) so a handed-over estimate pre-fills the slots and drops into the flow at the next missing step:

```js
  function seedEstimate(seed) {
    seed = seed || {};
    const mats = parseInt(seed.mats, 10) || 0;
    const days = parseInt(seed.days, 10) || null;
    const acts = [];
    if (mats) acts.push({ tool: 'add_mats', args: { n: mats } });
    if (days) acts.push({ tool: 'set_days', args: { n: days } });
    if (seed.postcode) acts.push({ tool: 'set_postcode', args: { pc: seed.postcode } });
    if (acts.length && NS.Planner && NS.Planner.applyActions) {
      const exec = NS.Planner.applyActions(state.hire, acts);
      state.hire = exec.hire;
    }
    const parts = [];
    if (mats) parts.push(mats + ' mats');
    if (days) parts.push('for ' + days + ' days');
    if (seed.postcode) parts.push('delivering to ' + seed.postcode);
    state.msgs.push({ from: 'user', text: 'From my estimate: ' + (parts.join(' ') || 'mat hire') + '.' });
    state.turns++;
    // ask the brain for the next missing slot, seeded with what we already know
    const plan = (NS.Planner && NS.Planner.localPlan)
      ? NS.Planner.localPlan('continue', state.hire)
      : { say: 'Tell me your event date and I’ll finish your quote.', actions: [], awaiting: null };
    state.hire.awaiting = plan.awaiting || state.hire.awaiting;
    state.msgs.push({ from: 'bot', text: plan.say });
    render();
  }
```

- [ ] **Step 4: Rename the header + labels in `home.html`**

Line ~922: change `SAÏA Concierge` → `SAÏA Assistant`.
Line ~924: `aria-label="Close concierge"` → `aria-label="Close assistant"`.
Line ~928 & ~813: `aria-label="Message the concierge"` → `aria-label="Message the assistant"`.
Line ~932: `aria-label="Open the SAÏA concierge"` → `aria-label="Open the SAÏA assistant"`.
Line ~797: button `Book this with the concierge` → `Book this with the assistant`.
Line ~806/808: section `aria-label`/eyebrow `The SAÏA concierge`/`Plan your hire with the SAÏA concierge` → `…assistant`.
Line ~90 (index reference is Task 8) — leave index/hero for Task 8.

- [ ] **Step 5: Manual verification**

Run: `npm start` (terminal A) + `python3 -m http.server 8000` (terminal B). Open `http://localhost:8000/home.html`, open the assistant (launcher bottom-right), type **"I need 50 mats for next saturday"**.
Expected sequence: asks days → asks deliver/collect → asks postcode → shows itemised card (50 mats·2-day £425, courier from £35, refundable deposit £75, total **from £535.00**, "£75.00 of that is returned after collection") → asks to confirm Saturday → "yes" shows checkout. Header reads **SAÏA Assistant**, no "Noor".

- [ ] **Step 6: Commit**

```bash
git add js/home-concierge.js home.html
git commit -m "feat(home): itemised quote card + slot-filling UI + Assistant rename"
```

---

## Task 8: index/hero UI — brain wiring + rename

**Files:**
- Modify: `js/concierge-ui.js` (`send`, `applyAndRender`)
- Modify: `index.html` (lines 90, 141, 150, 170) and `hero.html` (line 73, 91) — rename + greeting

No automated test (DOM). Verify manually.

- [ ] **Step 1: Pass hire into the brain and persist `awaiting`**

In `js/concierge-ui.js` `send()` (line ~95-108), pass hire and store awaiting:

```js
    function send(text) {
      if (!text || !text.trim()) return;
      const t = text.trim();
      state.msgs.push({ from: 'user', text: t });
      state.typing = true; renderThread();
      const plan = Planner.localPlan(t, state.hire);
      if (plan.matched) {
        clearTimeout(replyTimer);
        replyTimer = setTimeout(() => applyAndRender(plan.say, plan.actions, plan.awaiting), opts.replyDelay || 720);
        return;
      }
      askAssist(plan);
    }
```

Update `applyAndRender` (line ~67) to accept + store awaiting:

```js
    function applyAndRender(say, actions, awaiting) {
      const res = Planner.applyActions(state.hire, actions || []);
      state.typing = false;
      state.hire = res.hire;
      if (awaiting !== undefined) state.hire.awaiting = awaiting;
      state.msgs.push({ from: 'bot', text: say });
      res.acts.forEach((a) => state.msgs.push({ from: 'act', text: a }));
      renderThread(); renderHire(); flashHire();
    }
```

The two `askAssist` fallbacks call `applyAndRender(plan.say, [])` / `applyAndRender(data.say || plan.say, data.actions || [])` — these still work (awaiting stays as-is). Leave them.

- [ ] **Step 2: Initialise the new hire fields**

In the `state` object (line ~29), extend the hire shape so the brain has the slots:

```js
      hire: { mats: 0, guests: null, date: null, days: null, method: null, postcode: null, zone: null, total: null, status: 'No hire yet', awaiting: null },
```

- [ ] **Step 3: Rename in `index.html` + `hero.html`**

`index.html`:
- Line 90: `Hire a mat with the concierge →` → `Hire a mat with the assistant →`
- Line 141: `Ask the concierge` → `Ask the assistant`
- Line 150: `Noor · SAÏA concierge` → `SAÏA Assistant`
- Line 170: placeholder `Ask Noor anything…` → `Ask the assistant anything…`

`hero.html`:
- Line 73: `SAÏA Concierge` → `SAÏA Assistant`
- Line 91: placeholder `Ask the agent to do something…` → `Ask the assistant anything…`

Also grep for the greeting passed to `createAgenticConcierge` and drop "Noor":

Run: `grep -rn "greeting" index.html hero.html`
For each `greeting:` string mentioning Noor/concierge, reword to e.g. `'Hello, lovely. Tell me your event and numbers and I’ll plan your mat hire — or ask me anything about SAÏA.'`

- [ ] **Step 4: Manual verification**

Open `http://localhost:8000/index.html`, open the concierge panel, type **"40 mats"** → it should ask for days, then delivery, then postcode, then quote (the right-hand hire panel total reflects mats + courier + deposit). Header reads **SAÏA Assistant**.

- [ ] **Step 5: Commit**

```bash
git add js/concierge-ui.js index.html hero.html
git commit -m "feat(hero): wire slot-filling brain into index/hero + Assistant rename"
```

---

## Final verification

- [ ] Run the full unit suite: `node --test tests/` → all green.
- [ ] `grep -rni "noor" home.html index.html hero.html js/*.js` → no user-facing matches (comments-only is fine, but prefer none).
- [ ] `grep -rni "concierge" home.html index.html hero.html` → only internal IDs/anchors/endpoints remain (no visible "Concierge" labels).
- [ ] Manual end-to-end on home.html: "50 mats for next saturday" → days → delivery → postcode → itemised quote (£535 from, £75 refundable) → confirm.
- [ ] With the endpoint OFF (stop `npm start`): Tier 1 still drives the whole flow with no network.
- [ ] home.html estimator still totals correctly and now shows the deposit line.

## Self-review notes (addressed)

- **Spec coverage:** stateful brain (T5), shared math (T1–T2), deposit (T2/T3/T5/T7), itemised quote (T7), both surfaces (T7+T8), rename (T7+T8), Tier-2 slot-asking (T6), estimator reuse (T3) — all mapped.
- **Type consistency:** `awaiting` values `mats|days|method|postcode|date|confirm|null` used identically across planner, home-concierge, concierge-ui. `priceHire` return keys (`matCost,deliveryCost,deliveryLabel,deposit,total,quoteOnly`) consistent in T2/T3/T5/T7. `classify().key` (`central|greater|outside`) consistent T1/T4/T5.
- **No placeholders:** every code step shows full code; the one "placeholder" branch in T2 Step 3 is explicitly called out and the final clean form is given.
