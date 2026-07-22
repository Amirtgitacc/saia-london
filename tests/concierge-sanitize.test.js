const test = require('node:test');
const assert = require('node:assert');
const { sanitizeSay } = require('../js/concierge-core.js');

// The deterministic voice guard on Tier-2 prose: Haiku ignores the "no em dash / no
// gushing opener" prompt rule, so sanitizeSay enforces it in code. These lock the behaviour.

test('em dash used as a dash becomes a comma', () => {
  assert.strictEqual(
    sanitizeSay("So we'll deliver on the day — and collect once you finish."),
    "So we'll deliver on the day, and collect once you finish."
  );
});

test('en dash used as a dash becomes a comma', () => {
  assert.strictEqual(
    sanitizeSay("That's 33 mats – delivery to EC2."),
    "That's 33 mats, delivery to EC2."
  );
});

test('leading gushing opener is dropped and the next word recapitalised', () => {
  assert.strictEqual(
    sanitizeSay("Perfect — that's locked in. How many days?"),
    "That's locked in. How many days?"
  );
  assert.strictEqual(
    sanitizeSay("How lovely, for 30 guests I'd suggest 33 mats."),
    "For 30 guests I'd suggest 33 mats."
  );
  assert.strictEqual(
    sanitizeSay("Wonderful. Your checkout link is in the panel."),
    "Your checkout link is in the panel."
  );
});

test('adjectival use of a gushing word (no punctuation after) is left intact', () => {
  assert.strictEqual(
    sanitizeSay("Perfect for a morning class. How many mats?"),
    "Perfect for a morning class. How many mats?"
  );
});

test('hyphens inside words are never touched', () => {
  assert.strictEqual(
    sanitizeSay("Just to confirm it's spot-on, that's 26 August 2026?"),
    "Just to confirm it's spot-on, that's 26 August 2026?"
  );
});

test('a clean reply passes through unchanged', () => {
  const s = "Our rate stays a friendly £8.50 a mat. How many were you thinking?";
  assert.strictEqual(sanitizeSay(s), s);
});

test('empty / nullish input is safe', () => {
  assert.strictEqual(sanitizeSay(''), '');
  assert.strictEqual(sanitizeSay(null), '');
  assert.strictEqual(sanitizeSay(undefined), '');
});

test('a bare gushing word is not stripped to nothing', () => {
  // stripping would leave < 8 chars, so the (dash-normalised) original is kept
  assert.strictEqual(sanitizeSay('Perfect.'), 'Perfect.');
});
