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
