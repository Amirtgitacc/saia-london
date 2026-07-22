const test = require('node:test');
const assert = require('node:assert');
const { rateLimit, clientIp } = require('../js/rate-limit.js');

// No store env is set in tests, so rateLimit uses the in-memory window.
// A fixed `now` keeps the window boundary deterministic.
const reqFor = (ip) => ({ headers: { 'x-forwarded-for': ip }, socket: {} });

test('clientIp prefers x-real-ip, then the first x-forwarded-for hop', () => {
  // x-real-ip (edge-set, unspoofable) wins over a client-injected x-forwarded-for
  assert.strictEqual(clientIp({ headers: { 'x-real-ip': '4.4.4.4', 'x-forwarded-for': '1.2.3.4' } }), '4.4.4.4');
  assert.strictEqual(clientIp({ headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } }), '1.2.3.4');
  assert.strictEqual(clientIp({ headers: {}, socket: { remoteAddress: '9.9.9.9' } }), '9.9.9.9');
});

test('allows up to the limit, then blocks with a Retry-After', async () => {
  const now = 60000; // window start
  const opts = { name: 'test-block', limit: 3, windowMs: 60000, now };
  const req = reqFor('10.0.0.1');
  for (let i = 1; i <= 3; i++) {
    const r = await rateLimit(req, opts);
    assert.strictEqual(r.ok, true, 'request ' + i + ' should pass');
    assert.strictEqual(r.remaining, 3 - i);
  }
  const blocked = await rateLimit(req, opts);
  assert.strictEqual(blocked.ok, false, '4th request is blocked');
  assert.strictEqual(blocked.remaining, 0);
  assert.ok(blocked.retryAfter >= 1, 'gives a Retry-After hint');
});

test('separate IPs get separate buckets', async () => {
  const opts = { name: 'test-iso', limit: 1, windowMs: 60000, now: 120000 };
  const a = await rateLimit(reqFor('10.0.0.2'), opts);
  const b = await rateLimit(reqFor('10.0.0.3'), opts);
  assert.strictEqual(a.ok, true);
  assert.strictEqual(b.ok, true, 'a different IP is not affected by the first');
});

test('the counter resets in the next window', async () => {
  const base = { name: 'test-reset', limit: 1, windowMs: 60000 };
  const req = reqFor('10.0.0.4');
  const first = await rateLimit(req, { ...base, now: 60000 });
  const again = await rateLimit(req, { ...base, now: 60000 });
  assert.strictEqual(first.ok, true);
  assert.strictEqual(again.ok, false, 'second hit in the same window is blocked');
  const nextWindow = await rateLimit(req, { ...base, now: 120000 });
  assert.strictEqual(nextWindow.ok, true, 'a hit in the next window passes again');
});
