const test = require('node:test');
const assert = require('node:assert');
const KB = require('../js/saia-knowledge.js');

test('depositPerMat fact present', () => {
  assert.strictEqual(KB.hire.depositPerMat, 1.5);
});

test('classify maps Band A (local) postcodes', () => {
  assert.strictEqual(KB.classify('EC2Y 8DS').key, 'bandA');
  assert.strictEqual(KB.classify('NW1 4RY').key, 'bandA');
  assert.strictEqual(KB.classify('N8 8DU').key, 'bandA');
  assert.strictEqual(KB.classify('W1D 1BS').key, 'bandA');
});

test('classify maps Band B (central & inner) postcodes', () => {
  assert.strictEqual(KB.classify('SW1A 1AA').key, 'bandB');
  assert.strictEqual(KB.classify('SE1 9TG').key, 'bandB');
  assert.strictEqual(KB.classify('E17 9AA').key, 'bandB');
  assert.strictEqual(KB.classify('W6 9JT').key, 'bandB');
  assert.strictEqual(KB.classify('SW11 4NJ').key, 'bandB');
});

test('classify maps Band C (outer London) postcodes', () => {
  assert.strictEqual(KB.classify('BR1 1AA').key, 'outer');     // outer borough
  assert.strictEqual(KB.classify('TW9 1EH').key, 'outer');
  assert.strictEqual(KB.classify('HA1 1BD').key, 'outer');
  assert.strictEqual(KB.classify('CR0 1LH').key, 'outer');
  assert.strictEqual(KB.classify('SE28 8AA').key, 'outer');    // London area, no band -> quoted
});

// The district number is greedy (\d{1,2}), so a two-digit district must never be read as
// its one-digit prefix — NW1 and NW11 sit in the same band, but N1 and N19 vs N12 do not.
test('two-digit districts are not misread as their one-digit prefix', () => {
  assert.strictEqual(KB.classify('NW1 4RY').key, 'bandA');
  assert.strictEqual(KB.classify('NW11 7TL').key, 'bandA');
  assert.strictEqual(KB.classify('N1 9GU').key, 'bandA');
  assert.strictEqual(KB.classify('N12 8NP').key, 'bandB');   // not N1
  assert.strictEqual(KB.classify('W1D 1BS').key, 'bandA');
  assert.strictEqual(KB.classify('W12 7RJ').key, 'bandB');   // not W1
});

test('classify flags outside London', () => {
  assert.strictEqual(KB.classify('M1 1AA').key, 'outside');
  assert.strictEqual(KB.classify('CB1 1AA').key, 'outside');
});

test('classify returns null for junk', () => {
  assert.strictEqual(KB.classify('x'), null);
  assert.strictEqual(KB.classify(''), null);
});

test('priceHire — 50 mats, 2 days, Band A delivery', () => {
  const q = KB.priceHire({ mats: 50, days: 2, method: 'deliver', zone: 'bandA' });
  assert.strictEqual(q.matCost, 425);
  assert.strictEqual(q.deposit, 75);
  assert.strictEqual(q.deliveryCost, 80);    // both journeys, local London
  assert.strictEqual(q.total, 580);          // 425 + 80 + 75
  assert.strictEqual(q.quoteOnly, false);
});

test('priceHire — Band B costs £30 more than Band A on the same hire', () => {
  const a = KB.priceHire({ mats: 50, days: 2, method: 'deliver', zone: 'bandA' });
  const b = KB.priceHire({ mats: 50, days: 2, method: 'deliver', zone: 'bandB' });
  assert.strictEqual(b.deliveryCost, 110);
  assert.strictEqual(b.total - a.total, 30);
  assert.strictEqual(b.quoteOnly, false);
});

test('priceHire — Band C (outer London) is quote-only, never priced', () => {
  const q = KB.priceHire({ mats: 30, days: 2, method: 'deliver', zone: 'outer' });
  assert.strictEqual(q.deliveryCost, null);
  assert.strictEqual(q.total, null);
  assert.strictEqual(q.quoteOnly, true);
  assert.match(q.deliveryLabel, /quote/i);
});

test('the courier price never varies with mat count', () => {
  const small = KB.priceHire({ mats: 10, days: 2, method: 'deliver', zone: 'bandB' });
  const big = KB.priceHire({ mats: 50, days: 2, method: 'deliver', zone: 'bandB' });
  assert.strictEqual(small.deliveryCost, big.deliveryCost);
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
  const over = KB.priceHire({ mats: 80, days: 2, method: 'deliver', zone: 'bandA' });
  const cap = KB.priceHire({ mats: 50, days: 2, method: 'deliver', zone: 'bandA' });
  assert.strictEqual(over.matCost, cap.matCost);
  assert.strictEqual(over.deposit, cap.deposit);
  assert.strictEqual(over.total, cap.total);
  assert.strictEqual(over.total, 580);
});

test('priceHire — 5 mats clamps up to the 10-mat minimum', () => {
  const under = KB.priceHire({ mats: 5, days: 2, method: 'pickup' });
  const min = KB.priceHire({ mats: 10, days: 2, method: 'pickup' });
  assert.strictEqual(under.matCost, min.matCost);
  assert.strictEqual(under.deposit, min.deposit);
  assert.strictEqual(under.matCost, 85);
});

test('quoteLines — 80-mat hire displays 50 mats, never 80', () => {
  const q = KB.quoteLines({ mats: 80, days: 2, method: 'deliver', zone: 'bandA', collection: 'two' });
  const matsLine = q.lines.find((l) => l.label.indexOf('Mats') === 0);
  assert.ok(matsLine, 'expected a Mats line');
  assert.ok(/^50 /.test(matsLine.detail), 'expected detail to start with "50 ", got ' + matsLine.detail);
  assert.ok(!/80/.test(matsLine.detail));
  assert.strictEqual(q.total, 580);
});
