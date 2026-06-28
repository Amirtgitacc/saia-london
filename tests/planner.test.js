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

test('mats given, asks for days next', () => {
  const r = Planner.localPlan('I need 50 mats for next saturday', { mats: 0, days: null, awaiting: null });
  assert.strictEqual(r.matched, true);
  assert.strictEqual(r.awaiting, 'days');
  assert.ok(/day/i.test(r.say));
  assert.ok(r.actions.some(a => a.tool === 'add_mats' && a.args.n === 50));
});

test('bare number while awaiting days is read as days', () => {
  const r = Planner.localPlan('just the 2', { mats: 50, days: null, awaiting: 'days' });
  assert.strictEqual(r.awaiting, 'method');     // days now known → ask delivery method
  assert.ok(r.actions.some(a => a.tool === 'set_days' && a.args.n === 2));
});

test('after method=deliver, asks for postcode', () => {
  const r = Planner.localPlan('delivered please', { mats: 50, days: 2, method: null, awaiting: 'method' });
  assert.strictEqual(r.awaiting, 'postcode');
  assert.ok(r.actions.some(a => a.tool === 'set_method' && a.args.method === 'deliver'));
});

test('postcode completes priced slots → quote + asks date', () => {
  const r = Planner.localPlan('EC2Y 8DS', { mats: 50, days: 2, method: 'deliver', zone: null, date: null, awaiting: 'postcode' });
  assert.strictEqual(r.awaiting, 'date');
  assert.ok(r.actions.some(a => a.tool === 'set_postcode'));
  assert.ok(r.actions.some(a => a.tool === 'quote'));
});

test('pickup skips postcode → quote + asks date', () => {
  const r = Planner.localPlan('I will collect from NW3', { mats: 20, days: 2, method: null, date: null, awaiting: 'method' });
  assert.strictEqual(r.awaiting, 'date');
  assert.ok(r.actions.some(a => a.tool === 'set_method' && a.args.method === 'pickup'));
  assert.ok(r.actions.some(a => a.tool === 'quote'));
});

test('confirm books it', () => {
  const r = Planner.localPlan('yes please', { mats: 50, days: 2, method: 'deliver', zone: 'central', date: 'Saturday', awaiting: 'confirm' });
  assert.ok(r.actions.some(a => a.tool === 'checkout' || a.tool === 'confirm'));
});

test('guests recommend a mat count', () => {
  const r = Planner.localPlan('I am hosting 30 women', { mats: 0, awaiting: null });
  assert.ok(r.actions.some(a => a.tool === 'recommend' && a.args.guests === 30));
  assert.strictEqual(r.awaiting, 'days');
});

test('non-hire question still answered (founder)', () => {
  const r = Planner.localPlan('who is Cristina?', {});
  assert.strictEqual(r.matched, true);
  assert.ok(/Cristina/i.test(r.say));
});
