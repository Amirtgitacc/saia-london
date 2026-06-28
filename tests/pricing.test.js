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
