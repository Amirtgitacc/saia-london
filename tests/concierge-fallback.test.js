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
      null, { timeout: 5000 });
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
      null, { timeout: 5000 });
  } finally {
    await browser.close();
  }
});

test('C: an opaque mid-flow message with Claude down never renders a blank bubble', async () => {
  const browser = await chromium.launch();
  try {
    const page = await boot(browser,
      "window.fetch = () => Promise.reject(new Error('offline'));");
    // Enter the booking flow, then send gibberish localPlan can't parse (it returns say:'' to hand off).
    await sendMessage(page, 'I want to hire mats');
    await page.waitForFunction(
      () => /mats/i.test(document.getElementById('homeInlineConcierge').textContent),
      null, { timeout: 5000 });
    await sendMessage(page, 'asdf qwerty');
    // The fallback must substitute the generic line, not push an empty bot bubble.
    await page.waitForFunction(
      () => /Happy to help/.test(document.getElementById('homeInlineConcierge').textContent),
      null, { timeout: 5000 });
    // And there must be no empty bot bubble in the thread.
    const blanks = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#homeInlineConcierge > div'))
        .filter((d) => d.textContent.trim() === '').length);
    assert.strictEqual(blanks, 0, 'no blank bubbles');
  } finally {
    await browser.close();
  }
});
