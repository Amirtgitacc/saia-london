const test = require('node:test');
const assert = require('node:assert');
const { cartPermalink, cartPayload, cartCourierMissing } = require('../js/shopify-cart.js');

const CFG = { matHireVariant: '111', extraDayVariant: '222', depositVariant: '333',
  courierBandAVariant: '444', courierBandBVariant: '777', pickupVariant: '666' };

test('a Band A delivery adds the Band A courier line, not Band B', () => {
  const url = cartPermalink({ mats: 20, days: 2, method: 'deliver', zone: 'bandA', postcode: 'EC2Y 8DS' }, CFG);
  assert.ok(url.includes('444:1'));
  assert.ok(!url.includes('777:1'));
});

test('a Band B delivery adds the Band B courier line, not Band A', () => {
  const payload = cartPayload({ mats: 20, days: 2, method: 'deliver', zone: 'bandB', postcode: 'SE1 9TG' }, CFG);
  assert.ok(payload.items.some(i => i.id === 777 && i.quantity === 1));
  assert.ok(!payload.items.some(i => i.id === 444), 'the Band A variant must not be added to a Band B hire');
});

test('a stale collection:"one" still gets the full band courier line', () => {
  const payload = cartPayload({ mats: 20, days: 2, method: 'deliver', zone: 'bandB', collection: 'one', postcode: 'SE1 9TG' }, CFG);
  assert.ok(payload.items.some(i => i.id === 777 && i.quantity === 1));
  assert.strictEqual(payload.attributes['Return journey'], undefined);
});

// Band C and outside London are quoted, so their carts must carry NO courier line —
// otherwise a guest could check out at a band price we never quoted them.
test('Band C (outer London) adds no courier line at all', () => {
  const payload = cartPayload({ mats: 20, days: 2, method: 'deliver', zone: 'outer', postcode: 'BR1 1DN' }, CFG);
  assert.ok(!payload.items.some(i => i.id === 444 || i.id === 777));
});

/* A PRICED band with no Shopify variant configured is the live shape of
   settings_data.json today (variant_courier_band_a is ""). Left unguarded it builds a
   cart with no courier line: the guest pays nothing for the £80 delivery we quoted, and
   the 0g cart takes the paid fallback shipping rate. cartCourierMissing() flags it so
   checkout-handoff.js sends the booking to the WhatsApp quote instead. */
const NO_BAND_A = Object.assign({}, CFG, { courierBandAVariant: '' });

test('a priced band with no configured variant is flagged as unsellable', () => {
  assert.strictEqual(cartCourierMissing({ mats: 20, days: 2, method: 'deliver', zone: 'bandA', postcode: 'EC2Y 8DS' }, NO_BAND_A), true);
});

test('a priced band WITH its variant is sellable', () => {
  assert.strictEqual(cartCourierMissing({ mats: 20, days: 2, method: 'deliver', zone: 'bandA', postcode: 'EC2Y 8DS' }, CFG), false);
  assert.strictEqual(cartCourierMissing({ mats: 20, days: 2, method: 'deliver', zone: 'bandB', postcode: 'SE1 9TG' }, CFG), false);
});

test('quote-only bands are NOT flagged — they carry no courier line by design', () => {
  assert.strictEqual(cartCourierMissing({ mats: 20, days: 2, method: 'deliver', zone: 'outer', postcode: 'BR1 1DN' }, CFG), false);
  assert.strictEqual(cartCourierMissing({ mats: 20, days: 2, method: 'deliver', zone: 'outside' }, CFG), false);
});

test('pickup is never flagged — it needs no courier variant', () => {
  assert.strictEqual(cartCourierMissing({ mats: 20, days: 2, method: 'pickup' }, NO_BAND_A), false);
});

test('a missing Band A variant still never fabricates a Band B courier line', () => {
  const payload = cartPayload({ mats: 20, days: 2, method: 'deliver', zone: 'bandA', postcode: 'EC2Y 8DS' }, NO_BAND_A);
  assert.ok(!payload.items.some((i) => i.id === 777), 'must not substitute the £110 band');
  assert.ok(!payload.items.some((i) => i.id === 444));
});

test('a delivery cart carries all four dates', () => {
  const payload = cartPayload(
    { mats: 20, days: 2, method: 'deliver', zone: 'bandA', postcode: 'EC2Y 8DS', date: '2026-03-14' },
    Object.assign({ todayISO: '2026-03-03' }, CFG));
  assert.strictEqual(payload.attributes['Booking date'], 'Tue 3 Mar 2026');
  assert.strictEqual(payload.attributes['Event date'], 'Sat 14 Mar 2026');
  assert.strictEqual(payload.attributes['Delivery date'], 'Fri 13 Mar 2026');
  assert.strictEqual(payload.attributes['Collection date'], 'Sat 14 Mar 2026');
});

test('a pickup cart relabels the two journey dates', () => {
  const payload = cartPayload(
    { mats: 20, days: 2, method: 'pickup', date: '2026-03-14' },
    Object.assign({ todayISO: '2026-03-03' }, CFG));
  assert.strictEqual(payload.attributes['Pickup from NW3'], 'Fri 13 Mar 2026');
  assert.strictEqual(payload.attributes['Return to NW3'], 'Sat 14 Mar 2026');
  assert.strictEqual(payload.attributes['Delivery date'], undefined);
});

test('a hire with a non-ISO date still builds a cart, with no derived dates', () => {
  const payload = cartPayload({ mats: 20, days: 2, method: 'pickup', date: 'Saturday' }, CFG);
  assert.ok(payload.items.length > 0);
  assert.strictEqual(payload.attributes['Event date'], 'Saturday');
  assert.strictEqual(payload.attributes['Delivery date'], undefined);
});

test('pickup and outside-London carts get NO courier line', () => {
  const pk = cartPayload({ mats: 20, days: 2, method: 'pickup' }, CFG);
  assert.ok(!pk.items.some(i => i.id === 444 || i.id === 555));
  const out = cartPayload({ mats: 20, days: 2, method: 'deliver', zone: 'outside' }, CFG);
  assert.ok(!out.items.some(i => i.id === 444 || i.id === 555));
});

test('pickup hire adds the qty-1 pickup line', () => {
  const pk = cartPayload({ mats: 20, days: 2, method: 'pickup' }, CFG);
  assert.ok(pk.items.some(i => i.id === 666 && i.quantity === 1));
});

test('pickup hire adds the pickup line even when zone is null (pickup needs no postcode)', () => {
  const pk = cartPayload({ mats: 20, days: 2, method: 'pickup', zone: null }, CFG);
  assert.ok(pk.items.some(i => i.id === 666 && i.quantity === 1));
});

test('delivery hires do NOT include the pickup line', () => {
  const del = cartPayload({ mats: 20, days: 2, method: 'deliver', zone: 'bandA', postcode: 'EC2Y 8DS' }, CFG);
  assert.ok(!del.items.some(i => i.id === 666));
  const bandB = cartPayload({ mats: 20, days: 2, method: 'deliver', zone: 'bandB', collection: 'one', postcode: 'SE1 9TG' }, CFG);
  assert.ok(!bandB.items.some(i => i.id === 666));
});

test('outside-London quote-only hires do NOT include the pickup line', () => {
  const out = cartPayload({ mats: 20, days: 2, method: 'deliver', zone: 'outside' }, CFG);
  assert.ok(!out.items.some(i => i.id === 666));
});

test('base 2-day hire: mats + deposit lines only', () => {
  const url = cartPermalink({ mats: 20, days: 2 }, CFG);
  assert.ok(url.startsWith('/cart/111:20,333:20'));
  assert.ok(!url.includes('222:'));
});

test('extra days add mats×extraDays of the extra-day variant', () => {
  const url = cartPermalink({ mats: 15, days: 4 }, CFG);
  assert.ok(url.startsWith('/cart/111:15,222:30,333:15'));
});

test('quantity clamps to min 10 / max 50', () => {
  assert.ok(cartPermalink({ mats: 3, days: 2 }, CFG).startsWith('/cart/111:10,'));
  assert.ok(cartPermalink({ mats: 80, days: 2 }, CFG).startsWith('/cart/111:50,'));
});

test('booking context rides as encoded cart attributes', () => {
  const url = cartPermalink({ mats: 12, days: 2, date: '2 Aug', method: 'deliver', postcode: 'ec2y 8ds' }, CFG);
  assert.ok(url.includes('attributes[Event%20date]=2%20Aug'));
  assert.ok(url.includes('attributes[Postcode]=EC2Y%208DS'));
  assert.ok(url.includes('attributes[Method]=Delivery'));
});

test('pickup is labelled as pickup from NW3', () => {
  const url = cartPermalink({ mats: 12, days: 2, method: 'pickup' }, CFG);
  assert.ok(url.includes('attributes[Method]=Pickup%20from%20NW3'));
});

test('cartPayload: base 2-day hire has mats + deposit lines only', () => {
  const payload = cartPayload({ mats: 20, days: 2 }, CFG);
  assert.deepStrictEqual(payload.items, [
    { id: 111, quantity: 20 },
    { id: 333, quantity: 20 },
  ]);
});

test('cartPayload: extra days add mats×extraDays of the extra-day variant', () => {
  const payload = cartPayload({ mats: 15, days: 4 }, CFG);
  assert.deepStrictEqual(payload.items, [
    { id: 111, quantity: 15 },
    { id: 222, quantity: 30 },
    { id: 333, quantity: 15 },
  ]);
});

test('cartPayload: quantity clamps to min 10 / max 50', () => {
  assert.strictEqual(cartPayload({ mats: 3, days: 2 }, CFG).items[0].quantity, 10);
  assert.strictEqual(cartPayload({ mats: 80, days: 2 }, CFG).items[0].quantity, 50);
});

test('cartPayload: attributes present when values are given', () => {
  const payload = cartPayload({ mats: 12, days: 2, date: '2 Aug', method: 'deliver', postcode: 'ec2y 8ds', zone: 'bandA' }, CFG);
  assert.strictEqual(payload.attributes['Event date'], '2 Aug');
  assert.strictEqual(payload.attributes['Postcode'], 'EC2Y 8DS');
  assert.strictEqual(payload.attributes['Method'], 'Delivery');
  assert.ok('Delivery estimate' in payload.attributes);
});

test('cartPayload: pickup is labelled as pickup from NW3', () => {
  const payload = cartPayload({ mats: 12, days: 2, method: 'pickup' }, CFG);
  assert.strictEqual(payload.attributes['Method'], 'Pickup from NW3');
});

test('cartPayload: empty values are skipped from attributes', () => {
  const payload = cartPayload({ mats: 12, days: 2 }, CFG);
  assert.ok(!('Event date' in payload.attributes));
  assert.ok(!('Postcode' in payload.attributes));
});

test('cartPayload: item ids are numeric', () => {
  const payload = cartPayload({ mats: 12, days: 4 }, CFG);
  payload.items.forEach((item) => {
    assert.strictEqual(typeof item.id, 'number');
    assert.ok(!Number.isNaN(item.id));
  });
});
