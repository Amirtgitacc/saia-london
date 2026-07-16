const test = require('node:test');
const assert = require('node:assert');
const { cartPermalink } = require('../js/shopify-cart.js');

const CFG = { matHireVariant: '111', extraDayVariant: '222', depositVariant: '333' };

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
