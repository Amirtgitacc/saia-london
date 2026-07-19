const test = require('node:test');
const assert = require('node:assert');
const { cartPermalink, cartPayload } = require('../js/shopify-cart.js');

const CFG = { matHireVariant: '111', extraDayVariant: '222', depositVariant: '333',
  courierTwoWayVariant: '444', courierOneWayVariant: '555', pickupVariant: '666' };

test('London delivery adds the two-way courier line by default', () => {
  const url = cartPermalink({ mats: 20, days: 2, method: 'deliver', zone: 'central', postcode: 'EC2Y 8DS' }, CFG);
  assert.ok(url.includes('444:1'));
  assert.ok(!url.includes('555:1'));
});

test('one-way collection choice adds the delivery-only courier line', () => {
  const payload = cartPayload({ mats: 20, days: 2, method: 'deliver', zone: 'greater', collection: 'one', postcode: 'TW5 9QA' }, CFG);
  assert.ok(payload.items.some(i => i.id === 555 && i.quantity === 1));
  assert.ok(!payload.items.some(i => i.id === 444));
  assert.strictEqual(payload.attributes['Return journey'], 'You return the mats to NW3');
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
  const del = cartPayload({ mats: 20, days: 2, method: 'deliver', zone: 'central', postcode: 'EC2Y 8DS' }, CFG);
  assert.ok(!del.items.some(i => i.id === 666));
  const oneWay = cartPayload({ mats: 20, days: 2, method: 'deliver', zone: 'greater', collection: 'one', postcode: 'TW5 9QA' }, CFG);
  assert.ok(!oneWay.items.some(i => i.id === 666));
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
  const payload = cartPayload({ mats: 12, days: 2, date: '2 Aug', method: 'deliver', postcode: 'ec2y 8ds', zone: 'central' }, CFG);
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
