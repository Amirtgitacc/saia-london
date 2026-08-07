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

test('quoteLines: 15 mats / 2 days / central (two-way default)', () => {
  const q = KB.quoteLines({ mats: 15, days: 2, method: 'deliver', zone: 'central', date: 'Sat' });
  assert.strictEqual(q.total, 240);          // 127.50 + 90 + 22.50
  assert.strictEqual(q.deposit, 22.5);
  assert.strictEqual(q.quoteOnly, false);
  assert.strictEqual(q.lines[0].value, '£127.50');           // mats base
  assert.ok(q.lines.some(l => l.label === 'Refundable deposit' && l.value === '£22.50'));
  assert.ok(q.lines.some(l => /Delivery/.test(l.label) && l.value === '£90.00'));
  assert.ok(!q.lines.some(l => l.label === 'Extra days'));    // no extra days at 2 days
});
test('quoteLines: 3 days adds an Extra days line', () => {
  const q = KB.quoteLines({ mats: 15, days: 3, method: 'deliver', zone: 'central', date: 'Sat' });
  assert.strictEqual(q.total, 262.5);        // 127.50 + 22.50 extra + 90 + 22.50
  assert.ok(q.lines.some(l => l.label === 'Extra days' && l.value === '£22.50'));
});
test('quoteLines: outside London is quote-only with a subtotal', () => {
  const q = KB.quoteLines({ mats: 15, days: 2, method: 'deliver', zone: 'outside', date: 'Sat' });
  assert.strictEqual(q.total, null);
  assert.strictEqual(q.quoteOnly, true);
  assert.strictEqual(q.subtotal, 150);       // 127.50 mats + 22.50 deposit
  assert.ok(q.lines.some(l => /Delivery/.test(l.label) && l.value === 'confirmed by us'));
});
test('buildWhatsAppText mentions mats, days and the postcode', () => {
  const t = KB.buildWhatsAppText({ mats: 15, days: 2, method: 'deliver', zone: 'outside', postcode: 'M1 1AA', date: 'Saturday' });
  assert.ok(/15 mats/.test(t) && /2 days/.test(t) && /M1 1AA/i.test(t));
});

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
