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
test('quoteLines: one-way delivery shows £45 and the delivery-only label', () => {
  const q = KB.quoteLines({ mats: 15, days: 2, method: 'deliver', zone: 'central', collection: 'one', date: 'Sat' });
  assert.strictEqual(q.total, 195);          // 127.50 + 45 + 22.50
  assert.ok(q.lines.some(l => l.label === 'Delivery only' && l.value === '£45.00'));
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
  assert.ok(q.lines.some(l => /Delivery/.test(l.label) && l.value === 'confirmed by Cristina'));
});
test('buildWhatsAppText mentions mats, days and the postcode', () => {
  const t = KB.buildWhatsAppText({ mats: 15, days: 2, method: 'deliver', zone: 'outside', postcode: 'M1 1AA', date: 'Saturday' });
  assert.ok(/15 mats/.test(t) && /2 days/.test(t) && /M1 1AA/i.test(t));
});
