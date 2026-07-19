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

test('set_postcode classifies the zone and prices courier (two-way default)', () => {
  let h = base();
  h = Planner.applyActions(h, [{ tool: 'add_mats', args: { n: 50 } }]).hire;
  h = Planner.applyActions(h, [{ tool: 'set_postcode', args: { pc: 'EC2Y 8DS' } }]).hire;
  h = Planner.applyActions(h, [{ tool: 'quote' }]).hire;
  assert.strictEqual(h.zone, 'central');
  assert.strictEqual(h.method, 'deliver');
  assert.strictEqual(h.total, 590);          // 425 + 90 two-way courier + 75
});

test('set_collection one-way reprices the courier to £45', () => {
  let h = base();
  h = Planner.applyActions(h, [{ tool: 'add_mats', args: { n: 50 } }]).hire;
  h = Planner.applyActions(h, [{ tool: 'set_postcode', args: { pc: 'EC2Y 8DS' } }]).hire;
  h = Planner.applyActions(h, [{ tool: 'set_collection', args: { collection: 'one-way' } }]).hire;
  assert.strictEqual(h.collection, 'one');
  assert.strictEqual(h.total, 545);          // 425 + 45 one-way courier + 75
});

test('add_mats clamps a request for 80 mats to the 50-mat cap, so the quote can never exceed it', () => {
  let h = base();
  h = Planner.applyActions(h, [{ tool: 'add_mats', args: { n: 80 } }]).hire;
  assert.strictEqual(h.mats, 50);
  h = Planner.applyActions(h, [{ tool: 'set_method', args: { method: 'pickup' } }]).hire;
  h = Planner.applyActions(h, [{ tool: 'quote' }]).hire;
  assert.strictEqual(h.total, 500);          // 50 mats × £8.50 + 0 courier + 75 deposit
});

test('recommend clamps a guest-count-driven recommendation to the 50-mat cap', () => {
  let h = base();
  h = Planner.applyActions(h, [{ tool: 'recommend', args: { guests: 100 } }]).hire;
  assert.strictEqual(h.mats, 50);
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

test('postcode given → asks the return-journey question next, no quote yet', () => {
  const r = Planner.localPlan('EC2Y 8DS', { mats: 50, days: 2, method: 'deliver', zone: null, date: null, awaiting: 'postcode' });
  assert.strictEqual(r.awaiting, 'collection');
  assert.ok(/collect|return/i.test(r.say));
  assert.ok(r.actions.some(a => a.tool === 'set_postcode'));
  assert.ok(!r.actions.some(a => a.tool === 'quote'));      // no quote until everything is in
});

test('collection answered "yes collect them" → two-way, asks date', () => {
  const r = Planner.localPlan('yes collect them please', { mats: 50, days: 2, method: 'deliver', zone: 'central', collection: null, date: null, awaiting: 'collection' });
  assert.strictEqual(r.awaiting, 'date');
  assert.ok(r.actions.some(a => a.tool === 'set_collection' && a.args.collection === 'two-way'));
});

test('collection answered "we\'ll bring them back ourselves" → one-way, asks date', () => {
  const r = Planner.localPlan("we'll bring them back ourselves", { mats: 50, days: 2, method: 'deliver', zone: 'central', collection: null, date: null, awaiting: 'collection' });
  assert.strictEqual(r.awaiting, 'date');
  assert.ok(r.actions.some(a => a.tool === 'set_collection' && a.args.collection === 'one-way'));
});

test('unclear collection answer hands off to Tier 2', () => {
  const r = Planner.localPlan('hmm whatever is easiest for the venue really', { mats: 50, days: 2, method: 'deliver', zone: 'central', collection: null, date: null, awaiting: 'collection' });
  assert.strictEqual(r.matched, false);
});

test('pickup but no date → asks date, no quote yet', () => {
  const r = Planner.localPlan('I will collect from NW3', { mats: 20, days: 2, method: null, date: null, awaiting: 'method' });
  assert.strictEqual(r.awaiting, 'date');
  assert.ok(r.actions.some(a => a.tool === 'set_method' && a.args.method === 'pickup'));
  assert.ok(!r.actions.some(a => a.tool === 'quote'));
});

test('all slots in (date answers the last question) → asks before quoting, no quote yet', () => {
  const r = Planner.localPlan('saturday', { mats: 15, days: 2, method: 'deliver', zone: 'central', collection: 'two', date: null, awaiting: 'date' });
  assert.strictEqual(r.awaiting, 'review');                 // gate: confirm before revealing
  assert.ok(r.actions.some(a => a.tool === 'set_date'));
  assert.ok(!r.actions.some(a => a.tool === 'quote'), 'must NOT quote until the guest opts in');
  assert.ok(/quote together|put your quote/i.test(r.say));
});

test('review gate: "yes" reveals the quote + Book prompt + closing', () => {
  const r = Planner.localPlan('yes please', { mats: 15, days: 2, method: 'deliver', zone: 'central', date: 'Saturday', awaiting: 'review' });
  assert.strictEqual(r.awaiting, null);
  assert.ok(r.actions.some(a => a.tool === 'quote'));
  assert.ok(/Book this hire/i.test(r.say));
  assert.ok(/anything else/i.test(r.say), 'should close warmly');
});

test('review gate: "not yet" holds without quoting', () => {
  const r = Planner.localPlan('not yet', { mats: 15, days: 2, method: 'deliver', zone: 'central', date: 'Saturday', awaiting: 'review' });
  assert.strictEqual(r.awaiting, 'review');
  assert.ok(!r.actions.some(a => a.tool === 'quote'));
});

test('quote action sets the reveal flag so the basket can show', () => {
  const h = Planner.applyActions({ mats: 15, days: 2, method: 'pickup', date: 'Saturday' }, [{ tool: 'quote' }]).hire;
  assert.strictEqual(h.quoted, true);
});

test('ready state outside London points to Cristina (after opting in)', () => {
  const r = Planner.localPlan('go ahead', { mats: 15, days: 2, method: 'deliver', zone: 'outside', date: 'Saturday', awaiting: 'review' });
  assert.strictEqual(r.awaiting, null);
  assert.ok(r.actions.some(a => a.tool === 'quote'));
  assert.ok(/Cristina/.test(r.say) && /Book this hire/i.test(r.say));
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

// === Finding 1: process questions must NOT enter the booking flow ===
test('how does hire work goes to FAQ not booking flow', () => {
  const r = Planner.localPlan('how does hire work?', { mats: 0, awaiting: null });
  assert.strictEqual(r.matched, true);
  assert.ok(!r.awaiting, 'awaiting should be falsy — not inside the booking flow');
  assert.ok(!/how many mats/i.test(r.say), 'should NOT ask "How many mats"');
  assert.ok(/day before|quote|min/i.test(r.say), 'should be the FAQ reply (mentions day before / quote / min)');
});

test('how do I rent mats goes to FAQ not booking flow', () => {
  const r = Planner.localPlan('how do I rent mats?', { mats: 0, awaiting: null });
  assert.strictEqual(r.matched, true);
  assert.ok(!r.awaiting, 'awaiting should be falsy — not inside the booking flow');
  assert.ok(!/how many mats/i.test(r.say), 'should NOT ask "How many mats"');
  assert.ok(/day before|quote|min/i.test(r.say), 'should be the FAQ reply');
});

// === Finding 1 sanity: booking trigger still works ===
test('I want to hire mats still enters the booking flow', () => {
  const r = Planner.localPlan('I want to hire mats', { mats: 0, awaiting: null });
  assert.strictEqual(r.matched, true);
  assert.strictEqual(r.awaiting, 'mats');
});

// === Finding 2: postcode false-positives ===
test('A1 in sentence does not trigger postcode when not awaiting', () => {
  const r = Planner.localPlan('30 mats for an A1 launch', { mats: 0, days: null, awaiting: null });
  assert.strictEqual(r.awaiting, 'days');
  assert.ok(!r.actions.some(a => a.tool === 'set_postcode'), 'set_postcode should NOT fire on "A1"');
});

// === Finding 3: escape from confirm ===
test('no cancels the confirm step instead of looping', () => {
  const r = Planner.localPlan('no not yet', { mats: 50, days: 2, method: 'deliver', zone: 'central', date: 'Saturday', awaiting: 'confirm' });
  assert.ok(!r.actions.some(a => a.tool === 'checkout' || a.tool === 'confirm'), 'should not fire checkout or confirm');
  assert.ok(!r.awaiting, 'awaiting should be null — user stepped back out');
});

// === Fix: standalone checkout/confirm intents (basket buttons) ===
test('basket checkout button fires checkout action', () => {
  const r = Planner.localPlan('checkout', { mats: 50, days: 2, method: 'deliver', zone: 'central', date: 'Saturday', awaiting: 'confirm' });
  assert.ok(r.actions.some(a => a.tool === 'checkout'), 'checkout action must be present');
});

test('basket confirm button fires confirm action', () => {
  const r = Planner.localPlan('confirm', { mats: 50, days: 2, method: 'deliver', zone: 'central', date: 'Saturday', status: 'Checkout link ready', awaiting: null });
  assert.ok(r.actions.some(a => a.tool === 'confirm'), 'confirm action must be present');
});

test('regression: typed yes at confirm still fires checkout', () => {
  const r = Planner.localPlan('yes please', { mats: 50, days: 2, method: 'deliver', zone: 'central', date: 'Saturday', awaiting: 'confirm' });
  assert.ok(r.actions.some(a => a.tool === 'checkout'), 'yes at confirm step must fire checkout');
});

test('checkout intent does not emit a quote action', () => {
  const r = Planner.localPlan('checkout', { mats: 50, days: 2, method: 'deliver', zone: 'central', date: 'Saturday', awaiting: 'confirm' });
  assert.ok(!r.actions.some(a => a.tool === 'quote'), 'checkout must not loop the quote');
});

// === Fix: sub-minimum mat count re-asks instead of advancing to a dead-end quote ===
test('below-minimum mats re-asks, does not quote', () => {
  const r = Planner.localPlan('6 mats', { mats: 0, awaiting: 'mats' });
  assert.strictEqual(r.awaiting, 'mats');
  assert.ok(!r.actions.some(a => a.tool === 'quote'));
});

test('sub-minimum hire never reaches ready quote', () => {
  const r = Planner.localPlan('saturday', { mats: 6, days: 2, method: 'pickup', date: null, awaiting: 'date' });
  assert.strictEqual(r.awaiting, 'mats');             // re-asks for a valid count
  assert.ok(!r.actions.some(a => a.tool === 'quote'));
});

test('valid hire reaches the review gate (then quote on yes)', () => {
  const r = Planner.localPlan('saturday', { mats: 15, days: 2, method: 'pickup', date: null, awaiting: 'date' });
  assert.strictEqual(r.awaiting, 'review');
  assert.ok(!r.actions.some(a => a.tool === 'quote'));
  const r2 = Planner.localPlan('yes', { mats: 15, days: 2, method: 'pickup', date: 'Saturday', awaiting: 'review' });
  assert.ok(r2.actions.some(a => a.tool === 'quote'));
  assert.ok(/Book this hire/i.test(r2.say));
});

// === Loop fix: negation must not be read as a positive method choice ===
test('"cant collect" does NOT select pickup', () => {
  const r = Planner.localPlan('cant collect', { mats: 28, days: 3, method: null, awaiting: 'method' });
  assert.ok(!r.actions.some(a => a.tool === 'set_method'), 'negation must not set a method');
  assert.strictEqual(r.matched, false, 'unparsed mid-flow message escalates to Tier 2');
});

// === Loop fix: natural delivery phrasing parses without Claude ===
test('"send to my address" selects deliver', () => {
  const r = Planner.localPlan('send to my address', { mats: 28, days: 3, method: null, awaiting: 'method' });
  assert.ok(r.actions.some(a => a.tool === 'set_method' && a.args.method === 'deliver'));
  assert.strictEqual(r.awaiting, 'postcode');
});

// === Loop fix: an unrecognised mid-flow message escalates instead of re-asking ===
test('unparsed answer mid-flow escalates to Tier 2 (no loop)', () => {
  const r = Planner.localPlan('I need it sent over somehow tomorrow-ish', { mats: 28, days: 3, method: null, awaiting: 'method' });
  // "sent over" matches deliver synonyms → handled; but a truly opaque message must escalate:
  const r2 = Planner.localPlan('whatever works best for you really', { mats: 28, days: 3, method: null, awaiting: 'method' });
  assert.strictEqual(r2.matched, false, 'opaque message must hand off to Claude, not loop');
  assert.strictEqual(r2.actions.length, 0);
});

// === Loop fix: a bare date the keyword parser misses ("the 5th" — no month) escalates, not loops ===
test('"the 5th" while awaiting date escalates to Tier 2', () => {
  const r = Planner.localPlan('the 5th', { mats: 28, days: 3, method: 'pickup', date: null, awaiting: 'date' });
  assert.strictEqual(r.matched, false, 'date the regex misses hands off to Claude');
});

// === Race fix (2026-07-19): mid-delivery "collect them after" is the courier's return journey,
// === never a switch to NW3 pickup — even when a stale `awaiting` skips the collection block ===
test('awaiting collection: "collect them after" → two-way collection, never pickup', () => {
  const r = Planner.localPlan('collect them after', { mats: 30, days: 2, method: 'deliver', zone: 'central', collection: null, date: null, awaiting: 'collection' });
  assert.ok(r.actions.some(a => a.tool === 'set_collection' && a.args.collection === 'two-way'), 'must set two-way collection');
  assert.ok(!r.actions.some(a => a.tool === 'set_method'), 'must not touch the method');
});

test('stale awaiting=date mid-delivery: "collect them after" must NOT flip to pickup', () => {
  const r = Planner.localPlan('collect them after', { mats: 30, days: 2, method: 'deliver', zone: 'central', collection: null, date: null, awaiting: 'date' });
  assert.ok(!r.actions.some(a => a.tool === 'set_method' && a.args.method === 'pickup'), 'must not switch a live delivery to pickup');
  assert.ok(r.actions.some(a => a.tool === 'set_collection' && a.args.collection === 'two-way'), 'reads it as the courier return journey');
});

test('stale awaiting=postcode mid-delivery: "you collect after the event" stays a delivery', () => {
  const r = Planner.localPlan('you collect after the event please', { mats: 30, days: 2, method: 'deliver', zone: 'central', collection: null, date: null, awaiting: 'postcode' });
  assert.ok(!r.actions.some(a => a.tool === 'set_method' && a.args.method === 'pickup'), 'must not switch a live delivery to pickup');
  assert.ok(r.actions.some(a => a.tool === 'set_collection' && a.args.collection === 'two-way'), 'reads it as the courier return journey');
});

// === Race fix sanity: a GENUINE pickup switch must still work ===
test('genuine pickup at the method step still works ("we\'ll pick up from NW3")', () => {
  const r = Planner.localPlan("we'll pick up from NW3", { mats: 30, days: 2, method: null, awaiting: 'method' });
  assert.ok(r.actions.some(a => a.tool === 'set_method' && a.args.method === 'pickup'));
});

test('explicit pickup phrasing mid-delivery still switches to pickup', () => {
  const r = Planner.localPlan("actually we'll collect from the warehouse instead", { mats: 30, days: 2, method: 'deliver', zone: 'central', collection: null, date: null, awaiting: 'postcode' });
  assert.ok(r.actions.some(a => a.tool === 'set_method' && a.args.method === 'pickup'), 'explicit "collect from the warehouse" is a real pickup switch');
});

test('"collect the mats from our venue" mid-delivery is the return journey, not pickup', () => {
  const r = Planner.localPlan('can you collect the mats from our venue?', { mats: 30, days: 2, method: 'deliver', zone: 'central', collection: null, date: null, awaiting: 'date' });
  assert.ok(!r.actions.some(a => a.tool === 'set_method' && a.args.method === 'pickup'), '"from our venue" is where the courier collects, not a warehouse pickup');
  assert.ok(r.actions.some(a => a.tool === 'set_collection' && a.args.collection === 'two-way'), 'reads it as two-way collection');
});

// === Adversarial-review regressions: the three confirmed parser inversions ===
test('"deliver and collect please" at the method question is a delivery, never a free pickup', () => {
  const r = Planner.localPlan('deliver and collect please', { mats: 20, days: 2, method: null, awaiting: 'method' });
  assert.ok(!r.actions.some(a => a.tool === 'set_method' && a.args.method === 'pickup'), 'must not book a free NW3 pickup');
  assert.ok(r.actions.some(a => a.tool === 'set_method' && a.args.method === 'deliver'), 'it is a courier delivery');
  assert.ok(r.actions.some(a => a.tool === 'set_collection' && a.args.collection === 'two-way'), 'with same-day collection');
});

test('fresh "can you deliver 20 mats and collect them after?" starts a delivery, not a pickup', () => {
  const r = Planner.localPlan('can you deliver 20 mats and collect them after?', { mats: null, days: null, method: null, awaiting: null });
  assert.ok(!r.actions.some(a => a.tool === 'set_method' && a.args.method === 'pickup'), 'must not book a pickup');
  assert.ok(r.actions.some(a => a.tool === 'set_method' && a.args.method === 'deliver'), 'sets delivery');
});

test('collection step: "drop them off at 9am and collect them after the event please" is two-way', () => {
  const r = Planner.localPlan('drop them off at 9am and collect them after the event please', { mats: 20, days: 2, method: 'deliver', zone: 'central', collection: null, date: null, awaiting: 'collection' });
  assert.ok(r.actions.some(a => a.tool === 'set_collection' && a.args.collection === 'two-way'), 'explicit same-day collection wins, not £45 one-way');
});

test('collection step: a pure timing question must not silently book one-way', () => {
  const r = Planner.localPlan('what time will you drop them off?', { mats: 20, days: 2, method: 'deliver', zone: 'central', collection: null, date: null, awaiting: 'collection' });
  assert.ok(!r.actions.some(a => a.tool === 'set_collection'), 'no collection choice was made');
  assert.strictEqual(r.matched, false, 'unclear answer goes to Tier 2 for a real reply');
});

test('collection step: "we\'ll return them ourselves" still books one-way', () => {
  const r = Planner.localPlan("we'll return them ourselves", { mats: 20, days: 2, method: 'deliver', zone: 'central', collection: null, date: null, awaiting: 'collection' });
  assert.ok(r.actions.some(a => a.tool === 'set_collection' && a.args.collection === 'one-way'));
});

test('mid-delivery "can we just collect them ourselves instead?" switches to pickup, not £90 two-way', () => {
  const r = Planner.localPlan('actually can we just collect them ourselves instead?', { mats: 20, days: 2, method: 'deliver', zone: 'central', collection: null, date: null, awaiting: 'date' });
  assert.ok(r.actions.some(a => a.tool === 'set_method' && a.args.method === 'pickup'), 'self-service wording is a genuine switch to pickup');
  assert.ok(!r.actions.some(a => a.tool === 'set_collection' && a.args.collection === 'two-way'), 'must not confirm the courier they are trying to avoid');
});

test('mid-delivery "can I collect them instead of delivery?" switches to pickup', () => {
  const r = Planner.localPlan('can I collect them instead of delivery?', { mats: 20, days: 2, method: 'deliver', zone: 'central', collection: null, date: null, awaiting: 'date' });
  assert.ok(r.actions.some(a => a.tool === 'set_method' && a.args.method === 'pickup'), '"instead of delivery" is pickup intent');
});
