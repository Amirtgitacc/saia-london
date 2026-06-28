# Gated Quote + Mock Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the assistant quoting early — gather every detail first, then show one clear itemised quote with a **Book this hire** button that leads to a mock, pre-filled payment page.

**Architecture:** A shared `hireComplete(hire)` gate + `quoteLines(hire)` builder live in `js/saia-knowledge.js` (single source). The planner asks for the date before quoting and reveals the quote only when the hire is complete. Both front ends gate their quote UI on `hireComplete` and route the Book button through a shared browser helper `window.SAIA.bookHire(hire)` — to a new mock `checkout.html` for firm-total hires, or WhatsApp for outside-London.

**Tech Stack:** Vanilla JS (dual-mode IIFE modules), `node --test` (built-in, no new deps) for the pure helpers + planner flow. No build step.

## Global Constraints

- **Mats are HIRE ONLY** — never "buy"/"for sale".
- **Prices (verbatim):** £8.50/mat is the **2-day** base rate, +£1.50/mat per extra day, min 10 mats, refundable deposit £1.50/mat. Courier: Central £35, Greater £45, outside London → quote; NW3 pickup free.
- **Pricing math:** `matCost = mats*8.50 + mats*1.50*max(0, days-2)`, `deposit = mats*1.50`, `total = matCost + courier + deposit` (null outside London). All from `KB.priceHire` — never recomputed elsewhere.
- **Gating:** show nothing priced (no card, no total, no button) until `hireComplete(hire)` is true.
- **Required slots:** mats ≥ 10, days, delivery (pickup OR deliver+zone), date.
- **Button label:** "Book this hire →".
- **Checkout page:** mock only, clearly "Demo — no real payment". Fields: Name (required), Address (required), Email (optional), Phone (optional).
- **Outside-London Book → WhatsApp** `https://wa.me/447444611914` (no firm total to mock-pay).
- **Voice:** warm, female-led, British English. No user-facing "Noor"/"Concierge".
- **No new runtime dependencies.** Tests via `node --test tests/*.test.js` (glob — the directory form misbehaves on this Node).
- Don't remove existing UI elements beyond what these tasks name.

---

## File structure

| File | Responsibility |
|---|---|
| `js/saia-knowledge.js` | add `hireComplete`, `quoteLines`, `buildWhatsAppText` (pure, shared, testable) |
| `js/planner.js` | ask date before quoting; reveal quote + Book prompt only when complete |
| `js/checkout-handoff.js` *(new)* | browser-only `window.SAIA.bookHire(hire)` → checkout.html or WhatsApp |
| `checkout.html` *(new)* | mock payment page markup (on-brand, Demo-labelled) |
| `js/checkout.js` *(new)* | read `saia_hire`, render summary via `quoteLines`, light validation, mock success |
| `js/home-concierge.js` | gate `basketEl` on `hireComplete`; itemised card via `quoteLines`; Book → `bookHire` |
| `js/concierge-ui.js` | gate index/hero hire panel on `hireComplete`; Book button → `bookHire` |
| `index.html` / `hero.html` | add hidden-until-complete `[data-hire-book]` button; load `checkout-handoff.js` |
| `home.html` | load `checkout-handoff.js` |
| `server.js` | Tier-2 wording: gather all before quoting; say "Book" |
| `tests/quote.test.js` *(new)* | unit tests for `hireComplete` + `quoteLines` + `buildWhatsAppText` |
| `tests/planner.test.js` | update flow tests (date-before-quote, ready state) |

---

## Task 1: Shared gate + quote-line helpers

**Files:**
- Modify: `js/saia-knowledge.js` (add `KB.hireComplete`, `KB.quoteLines`, `KB.buildWhatsAppText`)
- Test: `tests/quote.test.js`

**Interfaces:**
- Consumes: `KB.hire`, `KB.priceHire`.
- Produces:
  - `KB.hireComplete(hire)` → boolean.
  - `KB.quoteLines(hire)` → `{ lines:[{label,detail,value}], total, subtotal, deposit, quoteOnly, deliveryLabel }`.
  - `KB.buildWhatsAppText(hire)` → string.

- [ ] **Step 1: Write the failing test**

Create `tests/quote.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const KB = require('../js/saia-knowledge.js');

test('hireComplete: full deliver hire is complete', () => {
  assert.strictEqual(KB.hireComplete({ mats: 15, days: 2, method: 'deliver', zone: 'central', date: 'Sat' }), true);
});
test('hireComplete: pickup needs no zone', () => {
  assert.strictEqual(KB.hireComplete({ mats: 15, days: 2, method: 'pickup', date: 'Sat' }), true);
});
test('hireComplete: deliver without zone is incomplete', () => {
  assert.strictEqual(KB.hireComplete({ mats: 15, days: 2, method: 'deliver', zone: null, date: 'Sat' }), false);
});
test('hireComplete: missing date is incomplete', () => {
  assert.strictEqual(KB.hireComplete({ mats: 15, days: 2, method: 'deliver', zone: 'central', date: null }), false);
});
test('hireComplete: below minimum mats is incomplete', () => {
  assert.strictEqual(KB.hireComplete({ mats: 8, days: 2, method: 'pickup', date: 'Sat' }), false);
});

test('quoteLines: 15 mats / 2 days / central', () => {
  const q = KB.quoteLines({ mats: 15, days: 2, method: 'deliver', zone: 'central', date: 'Sat' });
  assert.strictEqual(q.total, 185);          // 127.50 + 35 + 22.50
  assert.strictEqual(q.deposit, 22.5);
  assert.strictEqual(q.quoteOnly, false);
  assert.strictEqual(q.lines[0].value, '£127.50');           // mats base
  assert.ok(q.lines.some(l => l.label === 'Refundable deposit' && l.value === '£22.50'));
  assert.ok(q.lines.some(l => /Delivery/.test(l.label) && l.value === '£35.00'));
  assert.ok(!q.lines.some(l => l.label === 'Extra days'));    // no extra days at 2 days
});
test('quoteLines: 3 days adds an Extra days line', () => {
  const q = KB.quoteLines({ mats: 15, days: 3, method: 'deliver', zone: 'central', date: 'Sat' });
  assert.strictEqual(q.total, 207.5);        // 127.50 + 22.50 extra + 35 + 22.50
  assert.ok(q.lines.some(l => l.label === 'Extra days' && l.value === '£22.50'));
});
test('quoteLines: outside London is quote-only with a subtotal', () => {
  const q = KB.quoteLines({ mats: 15, days: 2, method: 'deliver', zone: 'outside', date: 'Sat' });
  assert.strictEqual(q.total, null);
  assert.strictEqual(q.quoteOnly, true);
  assert.strictEqual(q.subtotal, 150);       // 127.50 mats + 22.50 deposit
  assert.ok(q.lines.some(l => /Delivery/.test(l.label) && l.value === 'confirmed by Cristina'));
});
test('buildWhatsAppText mentions mats, days and the postcode', () => {
  const t = KB.buildWhatsAppText({ mats: 15, days: 2, method: 'deliver', zone: 'outside', postcode: 'M1 1AA', date: 'Saturday' });
  assert.ok(/15 mats/.test(t) && /2 days/.test(t) && /M1 1AA/i.test(t));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/quote.test.js`
Expected: FAIL — `KB.hireComplete is not a function`.

- [ ] **Step 3: Implement in `js/saia-knowledge.js`**

Immediately after `KB.priceHire = function ... };` add:

```js
  // is the hire ready to quote/book? (all required slots collected)
  KB.hireComplete = function (hire) {
    hire = hire || {};
    var H = KB.hire;
    var mats = parseInt(hire.mats, 10) || 0;
    var days = parseInt(hire.days, 10) || 0;
    if (mats < H.minMats) return false;
    if (days < H.hireDays) return false;
    if (hire.method === 'pickup') { /* no zone needed */ }
    else if (hire.method === 'deliver') { if (!hire.zone) return false; }
    else return false;
    if (!hire.date) return false;
    return true;
  };

  // itemised display rows for the quote card + checkout page (built from priceHire)
  KB.quoteLines = function (hire) {
    var H = KB.hire;
    hire = hire || {};
    var q = KB.priceHire(hire);
    var mats = parseInt(hire.mats, 10) || 0;
    var days = parseInt(hire.days, 10) || H.hireDays;
    var money = function (v) { return H.currency + Number(v).toFixed(2); };
    var lines = [];
    lines.push({ label: 'Mats (' + H.hireDays + '-day hire)', detail: mats + ' × ' + money(H.pricePerMat), value: money(mats * H.pricePerMat) });
    if (days > H.hireDays) {
      lines.push({ label: 'Extra days', detail: mats + ' × ' + money(H.extraDayPerMat) + ' × ' + (days - H.hireDays), value: money(mats * H.extraDayPerMat * (days - H.hireDays)) });
    }
    if (q.deliveryLabel) {
      lines.push({ label: 'Delivery & collection', detail: q.deliveryLabel, value: q.deliveryCost == null ? 'confirmed by Cristina' : (q.deliveryCost === 0 ? 'free' : money(q.deliveryCost)) });
    }
    lines.push({ label: 'Refundable deposit', detail: mats + ' × ' + money(H.depositPerMat), value: money(q.deposit) });
    return { lines: lines, total: q.total, subtotal: q.matCost + q.deposit, deposit: q.deposit, quoteOnly: q.quoteOnly, deliveryLabel: q.deliveryLabel };
  };

  // a pre-filled WhatsApp enquiry for hires we can't price firmly (outside London)
  KB.buildWhatsAppText = function (hire) {
    var H = KB.hire;
    hire = hire || {};
    var q = KB.quoteLines(hire);
    var money = function (v) { return H.currency + Number(v).toFixed(2); };
    var mats = parseInt(hire.mats, 10) || 0;
    var days = parseInt(hire.days, 10) || H.hireDays;
    var loc = hire.method === 'pickup' ? 'collecting from NW3' : ('delivery to ' + String(hire.postcode || '').toUpperCase());
    var sum = q.total != null ? (money(q.total) + ' total') : (money(q.subtotal) + ' plus courier to confirm');
    return 'Hi Cristina! I would like to book ' + mats + ' mats for ' + days + ' days, ' + loc +
      (hire.date ? (', on ' + hire.date) : '') + '. ' + sum + '. Please confirm availability.';
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/quote.test.js`
Expected: PASS — all 10 assertions green.

- [ ] **Step 5: Run the whole suite (no regressions)**

Run: `node --test tests/*.test.js`
Expected: PASS — quote + pricing + planner suites all green.

- [ ] **Step 6: Commit**

```bash
git add js/saia-knowledge.js tests/quote.test.js
git commit -m "feat(kb): hireComplete + quoteLines + buildWhatsAppText helpers"
```

---

## Task 2: Planner asks the date before quoting, reveals quote at the end

**Files:**
- Modify: `js/planner.js` (the hire-flow end block — ask date before quote, ready-state message)
- Test: `tests/planner.test.js` (update two tests, add two)

**Interfaces:**
- Consumes: `KB.priceHire`, `KB.hire`.
- Produces: `localPlan` end-state — when only the date is missing it asks for the date with **no** `quote` action; when all slots are present it emits `quote` and returns a "ready" message (`awaiting: null`) prompting **Book this hire**. No happy-path "confirm" text step.

- [ ] **Step 1: Update the failing tests**

In `tests/planner.test.js`, REPLACE the test named `postcode completes priced slots → quote + asks date` with:

```js
test('postcode given but no date → asks date, no quote yet', () => {
  const r = Planner.localPlan('EC2Y 8DS', { mats: 50, days: 2, method: 'deliver', zone: null, date: null, awaiting: 'postcode' });
  assert.strictEqual(r.awaiting, 'date');
  assert.ok(r.actions.some(a => a.tool === 'set_postcode'));
  assert.ok(!r.actions.some(a => a.tool === 'quote'));      // no quote until the date is in
});
```

REPLACE the test named `pickup skips postcode → quote + asks date` with:

```js
test('pickup but no date → asks date, no quote yet', () => {
  const r = Planner.localPlan('I will collect from NW3', { mats: 20, days: 2, method: null, date: null, awaiting: 'method' });
  assert.strictEqual(r.awaiting, 'date');
  assert.ok(r.actions.some(a => a.tool === 'set_method' && a.args.method === 'pickup'));
  assert.ok(!r.actions.some(a => a.tool === 'quote'));
});
```

ADD two new tests:

```js
test('all slots in (date answers the last question) → ready: quote + Book prompt', () => {
  const r = Planner.localPlan('saturday', { mats: 15, days: 2, method: 'deliver', zone: 'central', date: null, awaiting: 'date' });
  assert.strictEqual(r.awaiting, null);
  assert.ok(r.actions.some(a => a.tool === 'set_date'));
  assert.ok(r.actions.some(a => a.tool === 'quote'));
  assert.ok(/Book this hire/i.test(r.say));
});
test('ready state outside London points to Cristina', () => {
  const r = Planner.localPlan('saturday', { mats: 15, days: 2, method: 'deliver', zone: 'outside', date: null, awaiting: 'date' });
  assert.strictEqual(r.awaiting, null);
  assert.ok(r.actions.some(a => a.tool === 'quote'));
  assert.ok(/Cristina/.test(r.say) && /Book this hire/i.test(r.say));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/planner.test.js`
Expected: FAIL — the old flow emits `quote` at the postcode/pickup step and asks "confirm", so the new assertions fail.

- [ ] **Step 3: Implement in `js/planner.js`**

Find the block that begins `// priced slots complete → quote` (the `actions.push({ tool: 'quote' });` through the `return mk(lead + 'Shall I pencil it in ...` line) and REPLACE that whole block with:

```js
      // need the date before we quote anything
      if (need === 'date') return mk('And what date is your event? We deliver the day before and collect the day after.', actions, 'date');

      // everything gathered → compute the quote (for the card) and reveal it with the Book button
      actions.push({ tool: 'quote' });
      const q = KB.priceHire ? KB.priceHire(h) : { total: null, matCost: 0, deposit: 0, quoteOnly: false };
      const ready = q.quoteOnly
        ? "That's everything I need. Your mats and deposit come to " + money(q.matCost + q.deposit) + "; as you're outside London, Cristina will confirm the courier. Press Book this hire and I'll pass your details to her."
        : "That's everything — your full quote is below: " + money(q.total) + " all in, including a " + money(q.deposit) + " refundable deposit returned after collection. Press Book this hire when you're ready.";
      return mk(ready, actions, null);
```

(The `need` helper above this block is unchanged — it still returns `'date'` when the date is missing and `'confirm'` when all slots are present; the `'confirm'` case now falls through to the ready block.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/planner.test.js`
Expected: PASS — updated + new flow tests green.

- [ ] **Step 5: Whole suite**

Run: `node --test tests/*.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add js/planner.js tests/planner.test.js
git commit -m "feat(brain): ask date before quoting, reveal quote + Book at the end"
```

---

## Task 3: Browser Book handoff helper

**Files:**
- Create: `js/checkout-handoff.js`
- Modify: `home.html`, `index.html`, `hero.html` (add the script tag)

**Interfaces:**
- Consumes: `window.SAIA.KB.quoteLines`, `window.SAIA.KB.buildWhatsAppText`.
- Produces: `window.SAIA.bookHire(hire)` — firm total → store hire in `sessionStorage.saia_hire` and go to `checkout.html`; quote-only → open a pre-filled WhatsApp chat.

No automated test (browser navigation). Verify with `node --check` + grep.

- [ ] **Step 1: Create `js/checkout-handoff.js`**

```js
/* SAÏA — Book handoff. Firm-total hires go to the mock checkout page;
   outside-London (quote-only) hires open a pre-filled WhatsApp to Cristina. */
(function () {
  var NS = (window.SAIA = window.SAIA || {});
  NS.bookHire = function (hire) {
    var KB = NS.KB;
    if (!KB || !KB.quoteLines) return;
    var q = KB.quoteLines(hire);
    if (q.quoteOnly) {
      var text = KB.buildWhatsAppText(hire);
      window.open('https://wa.me/447444611914?text=' + encodeURIComponent(text), '_blank');
      return;
    }
    try { sessionStorage.setItem('saia_hire', JSON.stringify(hire)); } catch (e) { /* ignore */ }
    window.location.href = 'checkout.html';
  };
})();
```

- [ ] **Step 2: Load it on all three pages (after planner.js, before the concierge UI script)**

In `home.html` add after the `js/planner.js` script tag and before `js/home-concierge.js`:
```html
<script src="js/checkout-handoff.js"></script>
```
In `index.html` add after `js/planner.js` and before `js/concierge-ui.js`:
```html
<script src="js/checkout-handoff.js"></script>
```
In `hero.html` add after `js/planner.js` and before `js/concierge-ui.js`:
```html
<script src="js/checkout-handoff.js"></script>
```

- [ ] **Step 3: Verify**

Run: `node --check js/checkout-handoff.js` → clean.
Run: `grep -c "checkout-handoff.js" home.html index.html hero.html` → each returns 1.

- [ ] **Step 4: Commit**

```bash
git add js/checkout-handoff.js home.html index.html hero.html
git commit -m "feat(checkout): bookHire handoff (checkout page or WhatsApp) + load on pages"
```

---

## Task 4: Mock checkout page

**Files:**
- Create: `checkout.html`, `js/checkout.js`

**Interfaces:**
- Consumes: `sessionStorage.saia_hire`, `window.SAIA.KB.quoteLines`.

No automated test (DOM). Verify in a browser.

- [ ] **Step 1: Create `checkout.html`**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Checkout · SAÏA (demo)</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root{ --cream:#F5F1E8; --ink:#2B2620; --terra:#B8624A; --line:#DAD4C8; }
  *{ box-sizing:border-box; }
  body{ margin:0; background:var(--cream); color:var(--ink); font-family:'Inter',sans-serif; line-height:1.5; }
  .wrap{ max-width:640px; margin:0 auto; padding:clamp(24px,5vw,56px) 20px 80px; }
  .demo{ font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:var(--terra); }
  h1{ font-family:'Playfair Display',serif; font-weight:600; font-size:clamp(26px,4vw,34px); margin:6px 0 24px; }
  .card{ background:#FBF8F1; border:1px solid var(--line); border-radius:10px; padding:20px 22px; margin-bottom:22px; }
  .card h2{ font-size:11px; letter-spacing:.2em; text-transform:uppercase; color:#6B6358; margin:0 0 14px; font-weight:600; }
  .row{ display:flex; justify-content:space-between; gap:16px; align-items:baseline; padding:5px 0; font-size:14px; }
  .row .d{ color:#6B6358; font-size:12px; }
  .row.total{ border-top:1px solid var(--line); margin-top:8px; padding-top:12px; font-family:'Playfair Display',serif; font-size:20px; color:var(--terra); }
  label{ display:block; font-size:12px; color:#6B6358; margin:12px 0 5px; }
  input{ width:100%; padding:11px 13px; border:1px solid var(--line); border-radius:6px; background:#fff; font:inherit; color:var(--ink); }
  .grid{ display:grid; grid-template-columns:1fr 90px 70px; gap:10px; }
  .pay{ width:100%; margin-top:20px; background:var(--ink); color:var(--cream); border:none; border-radius:4px; padding:15px; font-size:12px; letter-spacing:.18em; text-transform:uppercase; cursor:pointer; }
  .pay:disabled{ opacity:.45; cursor:not-allowed; }
  .ok{ display:none; background:#EAF2EA; border:1px solid #BcD4Bc; border-radius:10px; padding:22px; text-align:center; }
  .ok h2{ font-family:'Playfair Display',serif; color:var(--ink); font-size:20px; margin:0 0 8px; letter-spacing:0; text-transform:none; }
  .muted{ font-size:12px; color:#6B6358; }
  a.back{ color:var(--terra); font-size:13px; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="demo">Checkout · demo — no real payment is taken</div>
    <h1>Confirm your hire</h1>
    <div id="content"></div>
  </div>
  <script src="js/saia-knowledge.js"></script>
  <script src="js/checkout.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `js/checkout.js`**

```js
/* SAÏA — mock checkout. Reads the hire handed over from the assistant
   (sessionStorage.saia_hire) and renders a pre-filled, demo-only order. */
(function () {
  var KB = (window.SAIA && window.SAIA.KB) || null;
  var root = document.getElementById('content');
  var money = function (v) { return '£' + Number(v).toFixed(2); };

  var hire = null;
  try { hire = JSON.parse(sessionStorage.getItem('saia_hire') || 'null'); } catch (e) { hire = null; }

  if (!hire || !KB || !KB.hireComplete || !KB.hireComplete(hire)) {
    root.innerHTML = '<div class="card"><p>Let’s build your hire first. Tell the SAÏA assistant your numbers and date and it will bring you back here.</p>' +
      '<p><a class="back" href="home.html">← Start with the assistant</a></p></div>';
    return;
  }

  var q = KB.quoteLines(hire);
  var el = function (tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };

  // order summary
  var sum = el('div', 'card');
  sum.appendChild(el('h2', null, 'Order summary'));
  var head = (hire.mats || 0) + ' mats · ' + (hire.days || 2) + '-day hire · ' +
    (hire.method === 'pickup' ? 'collect from NW3' : ('delivery ' + String(hire.postcode || '').toUpperCase())) +
    (hire.date ? (' · ' + hire.date) : '');
  sum.appendChild(el('div', 'muted', head));
  q.lines.forEach(function (l) {
    var r = el('div', 'row');
    r.appendChild(el('span', null, l.label + ' <span class="d">' + l.detail + '</span>'));
    r.appendChild(el('span', null, l.value));
    sum.appendChild(r);
  });
  var t = el('div', 'row total');
  t.appendChild(el('span', null, 'Total to pay'));
  t.appendChild(el('span', null, money(q.total)));
  sum.appendChild(t);
  sum.appendChild(el('div', 'muted', money(q.deposit) + ' of that is a refundable deposit, returned after collection.'));
  root.appendChild(sum);

  // details + payment form
  var form = el('div', 'card');
  form.appendChild(el('h2', null, 'Your details'));
  form.innerHTML += '<label>Name *</label><input id="f-name" autocomplete="name">' +
    '<label>Address *</label><input id="f-addr" autocomplete="street-address">' +
    '<label>Email</label><input id="f-email" type="email" autocomplete="email">' +
    '<label>Phone</label><input id="f-phone" type="tel" autocomplete="tel">' +
    '<div class="muted">* required · add an email or phone so Cristina can confirm.</div>' +
    '<h2 style="margin-top:18px">Payment · demo, no real charge</h2>' +
    '<div class="grid"><input placeholder="Card number" inputmode="numeric"><input placeholder="MM/YY"><input placeholder="CVC"></div>';
  var pay = el('button', 'pay', 'Pay ' + money(q.total) + ' →');
  pay.disabled = true;
  form.appendChild(pay);
  root.appendChild(form);

  // success panel
  var ok = el('div', 'ok');
  ok.innerHTML = '<h2>Booking received</h2><p class="muted">Thank you. Cristina will confirm your courier and be in touch shortly. (This is a demo — no payment was taken.)</p>';
  root.appendChild(ok);

  var name = document.getElementById('f-name');
  var addr = document.getElementById('f-addr');
  function check() { pay.disabled = !(name.value.trim() && addr.value.trim()); }
  name.addEventListener('input', check);
  addr.addEventListener('input', check);

  pay.addEventListener('click', function () {
    form.style.display = 'none';
    ok.style.display = 'block';
    try { sessionStorage.removeItem('saia_hire'); } catch (e) { /* ignore */ }
  });
})();
```

- [ ] **Step 3: Verify in a browser**

Run: `python3 -m http.server 8000` (project root). In a browser console at `http://localhost:8000/checkout.html` first seed a hire:
```js
sessionStorage.setItem('saia_hire', JSON.stringify({mats:15,days:2,method:'deliver',postcode:'EC2Y 8DS',zone:'central',date:'Saturday'})); location.reload();
```
Expected: order summary shows Mats £127.50, Courier £35.00, Deposit £22.50, **Total to pay £185.00**; Pay button disabled until Name + Address filled; clicking Pay shows "Booking received". Visiting `checkout.html` with no `saia_hire` shows the "Start with the assistant" message.

- [ ] **Step 4: Commit**

```bash
git add checkout.html js/checkout.js
git commit -m "feat(checkout): mock pre-filled payment page"
```

---

## Task 5: home.html — gate the card, itemise, Book button

**Files:**
- Modify: `js/home-concierge.js` (`basketEl`)

No automated test (DOM). Verify in a browser.

**Interfaces:**
- Consumes: `NS.KB.hireComplete`, `NS.KB.quoteLines`, `NS.bookHire`.

- [ ] **Step 1: Replace `basketEl()` with a gated, itemised card**

In `js/home-concierge.js`, replace the entire `function basketEl() { ... }` with:

```js
  function basketEl() {
    const h = state.hire;
    if (!NS.KB || !NS.KB.hireComplete || !NS.KB.hireComplete(h)) return null;   // nothing until complete
    const q = NS.KB.quoteLines(h);
    const wrap = el('div', BASKET);
    wrap.appendChild(el('div', BASKET_T, 'Your hire'));
    wrap.appendChild(el('div', BASKET_STATUS, (h.mats || 0) + ' mats · ' + (h.days || H.hireDays) + '-day hire' + (h.date ? ' · ' + h.date : '')));

    q.lines.forEach((l) => {
      const r = el('div', BASKET_LINE);
      r.appendChild(el('span', '', l.label));
      r.appendChild(el('span', '', l.value));
      wrap.appendChild(r);
    });

    const totalLine = el('div', BASKET_LINE);
    totalLine.appendChild(el('span', BASKET_T, q.quoteOnly ? 'Subtotal (excl. courier)' : 'Total to pay'));
    totalLine.appendChild(el('span', BASKET_TOTAL, q.quoteOnly ? money(q.subtotal) : money(q.total)));
    wrap.appendChild(totalLine);
    wrap.appendChild(el('div', BASKET_STATUS, q.quoteOnly
      ? 'Cristina will confirm your courier and total.'
      : money(q.deposit) + ' of that is returned after collection.'));

    const btn = el('button', BASKET_BTN, q.quoteOnly ? 'Book — confirm with Cristina →' : 'Book this hire →');
    btn.setAttribute('type', 'button');
    btn.addEventListener('click', () => { if (NS.bookHire) NS.bookHire(state.hire); });
    wrap.appendChild(btn);
    return wrap;
  }
```

- [ ] **Step 2: Verify in a browser**

Run: `python3 -m http.server 8000`, open `http://localhost:8000/home.html`, open the assistant, type **"15 mats"**.
Expected: NO card appears; it asks days → delivery → postcode → date. Only after the date does the itemised card appear with **Total to pay £185.00** and **Book this hire →**. Clicking Book goes to `checkout.html` pre-filled. Try an outside-London postcode (`M1 1AA`): card shows "Subtotal (excl. courier)" + "confirmed by Cristina", Book opens WhatsApp.

- [ ] **Step 3: Commit**

```bash
git add js/home-concierge.js
git commit -m "feat(home): gate quote card until complete, itemise, Book this hire"
```

---

## Task 6: index/hero — gate the panel, add Book button

**Files:**
- Modify: `js/concierge-ui.js` (`renderHire`), `index.html`, `hero.html`

No automated test (DOM). Verify in a browser.

**Interfaces:**
- Consumes: `NS.KB.hireComplete`, `NS.KB.quoteLines`, `window.SAIA.bookHire`.

- [ ] **Step 1: Add a hidden Book button to both hire panels**

In `index.html`, immediately after the `data-hire="status"` span (line ~160), add:
```html
        <button data-hire-book type="button" style="display:none; width:100%; margin-top:10px; background:#2B2620; color:#F5F1E8; border:none; border-radius:4px; padding:12px; font-size:11px; letter-spacing:.18em; text-transform:uppercase; cursor:pointer;">Book this hire →</button>
```
In `hero.html`, immediately after the `data-hire="status"` span (line ~82), add the same button markup.

- [ ] **Step 2: Gate the priced chips + wire the Book button in `js/concierge-ui.js`**

Replace `renderHire()` (the function at line ~54) with:

```js
    function renderHire() {
      const h = state.hire, v = opts.hireValueEls || {};
      const complete = !!(NS.KB && NS.KB.hireComplete && NS.KB.hireComplete(h));
      const q = complete && NS.KB.quoteLines ? NS.KB.quoteLines(h) : null;   // total/deposit from the single source
      if (v.mats) v.mats.textContent = String(h.mats || 0);
      if (v.date) v.date.textContent = h.date || 'No date';
      // priced chips appear only when the hire is complete
      if (v.total) {
        const showTotal = !!(q && q.total != null);
        v.total.textContent = showTotal ? '£' + q.total.toFixed(2) : '£—';
        v.total.style.display = showTotal ? '' : 'none';
      }
      if (v.deposit) {
        const showDep = !!(q && q.deposit != null);
        v.deposit.textContent = showDep ? '+£' + q.deposit.toFixed(2) + ' deposit (refundable)' : '';
        v.deposit.style.display = showDep ? '' : 'none';
      }
      if (v.status) v.status.textContent = complete ? (q && q.quoteOnly ? 'Ready — confirm with Cristina' : 'Ready to book') : (h.mats ? 'Collecting your details…' : h.status);
      const bookEl = opts.bookEl || document.querySelector('[data-hire-book]');
      if (bookEl) bookEl.style.display = complete ? '' : 'none';
    }
```

Then wire the button click once, near the other wiring (after the `chipEls` forEach at line ~128), add:

```js
    const bookBtn = opts.bookEl || document.querySelector('[data-hire-book]');
    if (bookBtn) bookBtn.addEventListener('click', () => { if (window.SAIA && window.SAIA.bookHire) window.SAIA.bookHire(state.hire); });
```

(`state.hire` carries `mats, days, method, postcode, zone, date` from the slot-filling brain; `total`/`deposit` for display come from `NS.KB.quoteLines(h)`, not bare hire fields, so they always match the home card and checkout page.)

- [ ] **Step 3: Verify in a browser**

Run: `python3 -m http.server 8000`, open `http://localhost:8000/index.html`, open the concierge, type **"40 mats"** then answer days → delivery → postcode → date.
Expected: the total/deposit chips and the **Book this hire →** button stay hidden until all answers are in (status shows "Collecting your details…"); once complete, the total shows and the Book button appears and navigates to `checkout.html`. Repeat on `hero.html`.

- [ ] **Step 4: Commit**

```bash
git add js/concierge-ui.js index.html hero.html
git commit -m "feat(hero): gate hire panel until complete + Book this hire button"
```

---

## Task 7: Tier-2 wording

**Files:**
- Modify: `server.js` (`systemPrompt`)

No automated test (network). Verify with `node --check`.

- [ ] **Step 1: Update the slot-filling rule + booking wording**

In `server.js` `systemPrompt()`, in the RULES list, replace the slot-collection rule with one that defers the quote and uses "Book":

```js
    '- For a mat hire, COLLECT EVERY DETAIL ONE AT A TIME before showing any price: number of mats (or guests → recommend), number of days (never assume — ask), delivery (courier + postcode, or free NW3 pickup), AND the event date. Do not quote a total until you have all of them. Ask for the next missing detail in a single warm sentence.',
    '- Once every detail is gathered, tell them their quote is ready and to press “Book this hire”. Say “Book”, never “checkout”.',
```

- [ ] **Step 2: Verify**

Run: `node --check server.js` → clean.
Run: `grep -c "Book this hire" server.js` → ≥ 1.

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat(server): tier-2 gathers all details before quoting, says Book"
```

---

## Final verification

- [ ] `node --test tests/*.test.js` → all green (quote + pricing + planner suites).
- [ ] `node --check js/checkout-handoff.js js/checkout.js js/saia-knowledge.js js/planner.js js/home-concierge.js js/concierge-ui.js server.js` → clean.
- [ ] Manual home.html: "15 mats" shows NO card; after days→delivery→postcode→date it shows itemised **£185.00 Total to pay** + **Book this hire** → `checkout.html` pre-filled → Pay (after Name+Address) → "Booking received".
- [ ] Manual outside-London (`M1 1AA`): card shows subtotal + "confirmed by Cristina"; Book opens WhatsApp.
- [ ] Manual index.html + hero.html: priced chips + Book button hidden until complete, then Book → checkout.
- [ ] `grep -c "checkout-handoff.js" home.html index.html hero.html` → 1 each.

## Self-review notes (addressed)

- **Spec coverage:** gating (T5/T6 + T1 helper), itemised quote with single total (T1/T5), Book→mock page (T3/T4), outside-London→WhatsApp (T1/T3/T5), both surfaces (T5/T6), ask-date-before-quote (T2), Tier-2 wording (T7), contact fields Name/Address required + Email/Phone optional (T4). All mapped.
- **Type consistency:** `hireComplete(hire)→bool`, `quoteLines(hire)→{lines:[{label,detail,value}],total,subtotal,deposit,quoteOnly,deliveryLabel}`, `window.SAIA.bookHire(hire)` used identically in T3/T5/T6. `sessionStorage` key `saia_hire` consistent in T3/T4.
- **No placeholders:** every code step shows complete code; helper location for `bookHire` resolved to `js/checkout-handoff.js`.
