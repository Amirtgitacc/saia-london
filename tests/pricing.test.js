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

test('priceHire — 50 mats, 2 days, central delivery (two-way default)', () => {
  const q = KB.priceHire({ mats: 50, days: 2, method: 'deliver', zone: 'central' });
  assert.strictEqual(q.matCost, 425);
  assert.strictEqual(q.deposit, 75);
  assert.strictEqual(q.deliveryCost, 90);    // flat London, delivery + same-day collection
  assert.strictEqual(q.total, 590);          // 425 + 90 + 75
  assert.strictEqual(q.quoteOnly, false);
});

test('priceHire — one-way delivery (guest returns the mats) is £45', () => {
  const q = KB.priceHire({ mats: 50, days: 2, method: 'deliver', zone: 'greater', collection: 'one' });
  assert.strictEqual(q.deliveryCost, 45);
  assert.strictEqual(q.total, 545);          // 425 + 45 + 75
  assert.ok(/delivery only/i.test(q.deliveryLabel));
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

test('priceHire — 80 mats clamps to the 50-mat max (same total as 50)', () => {
  const over = KB.priceHire({ mats: 80, days: 2, method: 'deliver', zone: 'central' });
  const cap = KB.priceHire({ mats: 50, days: 2, method: 'deliver', zone: 'central' });
  assert.strictEqual(over.matCost, cap.matCost);
  assert.strictEqual(over.deposit, cap.deposit);
  assert.strictEqual(over.total, cap.total);
  assert.strictEqual(over.total, 590);
});

test('priceHire — 5 mats clamps up to the 10-mat minimum', () => {
  const under = KB.priceHire({ mats: 5, days: 2, method: 'pickup' });
  const min = KB.priceHire({ mats: 10, days: 2, method: 'pickup' });
  assert.strictEqual(under.matCost, min.matCost);
  assert.strictEqual(under.deposit, min.deposit);
  assert.strictEqual(under.matCost, 85);
});

test('quoteLines — 80-mat hire displays 50 mats, never 80', () => {
  const q = KB.quoteLines({ mats: 80, days: 2, method: 'deliver', zone: 'central', collection: 'two' });
  const matsLine = q.lines.find((l) => l.label.indexOf('Mats') === 0);
  assert.ok(matsLine, 'expected a Mats line');
  assert.ok(/^50 /.test(matsLine.detail), 'expected detail to start with "50 ", got ' + matsLine.detail);
  assert.ok(!/80/.test(matsLine.detail));
  assert.strictEqual(q.total, 590);
});
