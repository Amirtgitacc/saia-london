const test = require('node:test');
const assert = require('node:assert');
const Planner = require('../js/planner.js');

const base = () => ({ mats: 0, guests: null, date: null, days: null, method: null, postcode: null, zone: null, total: null, status: null });

test('set_days then quote prices extra days + deposit', () => {
  let h = base();
  h = Planner.applyActions(h, [{ tool: 'add_mats', args: { n: 20 } }]).hire;
  h = Planner.applyActions(h, [{ tool: 'set_days', args: { n: 3 } }]).hire;
  h = Planner.applyActions(h, [{ tool: 'set_method', args: { method: 'pickup' } }]).hire;
  h = Planner.applyActions(h, [{ tool: 'quote' }]).hire;
  assert.strictEqual(h.days, 3);
  assert.strictEqual(h.method, 'pickup');
  assert.strictEqual(h.total, 230);          // 200 mats + 0 courier + 30 deposit
});

test('set_postcode classifies the zone and prices courier', () => {
  let h = base();
  h = Planner.applyActions(h, [{ tool: 'add_mats', args: { n: 50 } }]).hire;
  h = Planner.applyActions(h, [{ tool: 'set_postcode', args: { pc: 'EC2Y 8DS' } }]).hire;
  h = Planner.applyActions(h, [{ tool: 'quote' }]).hire;
  assert.strictEqual(h.zone, 'central');
  assert.strictEqual(h.method, 'deliver');
  assert.strictEqual(h.total, 535);          // 425 + 35 + 75
});
