# Claude-first Concierge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route every concierge message to Claude first, demoting the Tier-1 regex planner (`localPlan`) to an offline-only fallback.

**Architecture:** One inversion inside `js/home-concierge.js`: `send()` calls `askAssist()` on every message instead of gating on `localPlan`; `askAssist()` re-plans through `localPlan` only when the Claude call fails or times out. The deterministic price rail (`applyActions`) and the model (Haiku 4.5) are untouched.

**Tech Stack:** Dependency-free browser JS (IIFE on `window.SAIA`); Node `node:test` + the `playwright` library (already installed) for an integration test.

## Global Constraints

- Frontend stays **dependency-free** — no new runtime libraries in the browser bundle.
- Model stays **`claude-haiku-4-5`** — do not touch `concierge-core.js`, `server.js`, or `api/`.
- **Mats are HIRE ONLY** — never "buy"/"for sale" in any copy.
- British English; warm, unpretentious voice.
- **Do not remove existing UI elements** (greeting, intent chips, basket, mobile-keyboard handling).
- When editing any `js/*` file, **bump its `?v=` cache-buster in `index.html`** or the browser serves stale code.
- Run the test suite with `node --test tests/`.

---

### Task 1: Invert send → Claude-first, with localPlan as fallback

**Files:**
- Test: `tests/concierge-fallback.test.js` (create)
- Modify: `js/home-concierge.js` — `send()` (lines ~119-134) and `askAssist()` (lines ~104-117)
- Modify: `index.html:1431` — bump `home-concierge.js` cache version

**Interfaces:**
- Consumes (unchanged, already in `js/planner.js`):
  - `NS.Planner.localPlan(text, hire) -> { say, actions, matched, awaiting }`
  - `NS.Planner.applyActions(hire, actions) -> { hire, acts }`
- Produces: no new exported symbols. `send(text)` and `askAssist(text)` keep their names; `askAssist` gains a `text` parameter so the fallback can re-plan from the raw message.

- [ ] **Step 1: Write the failing test**

Create `tests/concierge-fallback.test.js`. It loads the real `planner.js` + `home-concierge.js` into a headless page over a minimal DOM, then drives one message under two `window.fetch` stubs. Test A proves Claude now runs even for an input the old regex would have matched; Test B proves the offline fallback still answers.

```javascript
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const HARNESS = `<!doctype html><html><body>
  <div id="homeInlineConcierge"></div>
  <input id="homeInlineInput" />
  <button id="homeInlineSend">Send</button>
</body></html>`;

// Boot a page with the harness DOM + the two real browser modules, fetch stubbed.
async function boot(browser, fetchStub) {
  const page = await browser.newPage();
  await page.setContent(HARNESS, { waitUntil: 'domcontentloaded' });
  // Stub fetch BEFORE the concierge script runs so init/send see the stub.
  await page.evaluate(fetchStub);
  await page.addScriptTag({ path: path.join(ROOT, 'js/saia-knowledge.js') });
  await page.addScriptTag({ path: path.join(ROOT, 'js/planner.js') });
  await page.addScriptTag({ path: path.join(ROOT, 'js/home-concierge.js') });
  return page;
}

async function sendMessage(page, text) {
  await page.fill('#homeInlineInput', text);
  await page.click('#homeInlineSend');
}

test('A: a message Tier-1 would have matched now goes to Claude', async () => {
  const browser = await chromium.launch();
  try {
    // Claude responds with a sentinel the regex planner would never produce.
    const page = await boot(browser,
      "window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ say: 'SENTINEL_CLAUDE_REPLY', actions: [] }) });");
    await sendMessage(page, 'who is Cristina?');
    await page.waitForFunction(
      () => document.getElementById('homeInlineConcierge').textContent.includes('SENTINEL_CLAUDE_REPLY'),
      { timeout: 5000 });
  } finally {
    await browser.close();
  }
});

test('B: when Claude fails, localPlan answers (offline fallback)', async () => {
  const browser = await chromium.launch();
  try {
    const page = await boot(browser,
      "window.fetch = () => Promise.reject(new Error('offline'));");
    await sendMessage(page, 'who is Cristina?');
    // localPlan's Cristina reply mentions her by name; the greeting does not.
    await page.waitForFunction(
      () => /Cristina/.test(document.getElementById('homeInlineConcierge').textContent),
      { timeout: 5000 });
  } finally {
    await browser.close();
  }
});
```

- [ ] **Step 2: Run the test to verify Test A fails**

Run: `node --test tests/concierge-fallback.test.js`
Expected: **Test A FAILS** (times out — old `send()` matches `localPlan` for "who is Cristina?" and never calls `fetch`, so the sentinel never appears). Test B passes (old code already answers via Tier 1). The failure of A confirms the test exercises the change.

- [ ] **Step 3: Rewrite `send()` to always call Claude**

In `js/home-concierge.js`, replace the whole `send` function (currently lines ~119-134):

```javascript
  function send(text) {
    if (!text || !text.trim()) return;
    const clean = text.trim();
    state.msgs.push({ from: 'user', text: clean });
    state.turns++;
    state.typing = true;
    render();
    askAssist(clean);   // Claude reads EVERY message; localPlan is the offline fallback
  }
```

- [ ] **Step 4: Rewrite `askAssist()` to fall back to `localPlan` on failure**

In `js/home-concierge.js`, replace the whole `askAssist` function (currently lines ~104-117):

```javascript
  function askAssist(text) {
    const history = state.msgs.filter((m) => m.from === 'user' || m.from === 'bot')
      .map((m) => ({ role: m.from === 'user' ? 'user' : 'bot', text: m.text }));
    let done = false;
    const finish = (say, actions) => { if (done) return; done = true; applyAndShow({ say: say || GENERIC, actions: actions || [] }); };
    // Offline safety net: Claude unreachable → re-plan the raw message through the Tier-1
    // regex planner; if even that is missing, a single graceful generic line.
    const fallback = () => {
      if (done) return;
      if (NS.Planner && NS.Planner.localPlan) { done = true; applyAndShow(NS.Planner.localPlan(text, state.hire)); }
      else finish(GENERIC);
    };
    const guard = setTimeout(fallback, 12000);
    fetch((window.SAIA_CONFIG && window.SAIA_CONFIG.conciergeEndpoint) || '/api/concierge', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history, hire: state.hire }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http ' + r.status))))
      .then((d) => { clearTimeout(guard); finish((d && d.say) || GENERIC, (d && d.actions) || []); })
      .catch(() => { clearTimeout(guard); fallback(); });
  }
```

Note: `applyAndShow` already reads `plan.actions`, `plan.say`, and `'awaiting' in plan`, so a raw `localPlan` result is a valid argument — no shaping needed.

- [ ] **Step 5: Bump the cache-buster**

In `index.html` line 1431, change the version so browsers fetch the new file:

```html
<script src="js/home-concierge.js?v=20260629g"></script>
```

- [ ] **Step 6: Run the test to verify both pass**

Run: `node --test tests/concierge-fallback.test.js`
Expected: **PASS** (2 tests). A: the sentinel Claude reply renders. B: the localPlan Cristina reply renders when fetch rejects.

- [ ] **Step 7: Run the full suite (no regressions)**

Run: `node --test tests/`
Expected: all existing `planner.test.js`, `pricing.test.js`, `quote.test.js` tests still PASS (those cover the untouched `localPlan`/`applyActions` logic) plus the 2 new tests.

- [ ] **Step 8: Manual smoke (the verify line from the spec)**

Run `npm start` (terminal A) and `python3 -m http.server 8000` (terminal B). Open `http://localhost:8000/`, send a normal hire question → it should show typing dots, then a Claude reply (a brief network pause, not the instant old behaviour). Then stop `server.js` and send another message → the offline fallback should still answer.

- [ ] **Step 9: Commit** (only if the user has asked to commit — otherwise leave staged for review)

```bash
git add js/home-concierge.js index.html tests/concierge-fallback.test.js docs/superpowers/
git commit -m "feat(concierge): route every message to Claude, demote localPlan to offline fallback"
```

---

## Self-Review

**Spec coverage:**
- "Claude reads every message" → Task 1 Steps 3-4 (send → askAssist always) + Test A. ✓
- "Keep full Tier 1 as offline backup" → Step 4 `fallback()` + Test B. ✓
- "applyActions / model / prompt unchanged" → Global Constraints + nothing in the plan touches `concierge-core.js`/`server.js`/`api/`/`planner.js`. ✓
- "One focused fallback test" → Task 1 (delivered as two tests: the happy-path proof A and the fallback proof B; B is the spec's required one). ✓
- "Preset phrases left as-is" → `saia-examples.js` and `planner.js` scripts untouched. ✓
- Cache-bust rule (project memory) → Step 5. ✓

**Placeholder scan:** none — all steps carry real code/commands.

**Type consistency:** `localPlan(text, hire)`, `applyActions(hire, actions)`, `applyAndShow(plan)`, and `askAssist(text)` names/shapes match across the plan and the existing files.
