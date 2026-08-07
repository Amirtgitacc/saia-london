const test = require('node:test');
const assert = require('node:assert');
const { signToken, verifyToken } = require('../api/chat-log.js');

const SECRET = 'a-long-random-test-secret';

test('a freshly signed token verifies', () => {
  const exp = 2_000_000_000_000;
  assert.strictEqual(verifyToken(signToken(exp, SECRET), SECRET, exp - 1000), true);
});

test('an expired token is rejected', () => {
  const exp = 1_000;
  assert.strictEqual(verifyToken(signToken(exp, SECRET), SECRET, exp + 1), false);
});

test('a token signed with another secret is rejected', () => {
  const exp = 2_000_000_000_000;
  assert.strictEqual(verifyToken(signToken(exp, 'other-secret'), SECRET, exp - 1000), false);
});

test('a tampered expiry is rejected', () => {
  const t = signToken(1_000, SECRET);
  const forged = '9999999999999.' + t.split('.')[1];
  assert.strictEqual(verifyToken(forged, SECRET, 2_000), false);
});

test('malformed tokens are rejected without throwing', () => {
  ['', null, 'nonsense', 'a.b.c', '123.'].forEach((t) => {
    assert.strictEqual(verifyToken(t, SECRET, 1_000), false);
  });
});
