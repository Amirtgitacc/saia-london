const test = require('node:test');
const assert = require('node:assert');
const { normalizeLogPayload } = require('../js/log-core.js');

test('a valid turn becomes an insert-ready row', () => {
  const rows = normalizeLogPayload({
    session: 'abc-123',
    page: '/',
    turns: [{ role: 'user', message: 'I need 20 mats' }],
  });
  assert.deepStrictEqual(rows, [{
    session_id: 'abc-123', role: 'user', tier: null, message: 'I need 20 mats', page: '/',
  }]);
});

test('bot turns keep their tier', () => {
  const rows = normalizeLogPayload({
    session: 's1',
    turns: [{ role: 'bot', tier: 'claude', message: 'Lovely — 20 mats it is.' }],
  });
  assert.strictEqual(rows[0].tier, 'claude');
  assert.strictEqual(rows[0].page, null);
});

test('missing session, unknown roles and empty messages are rejected', () => {
  assert.strictEqual(normalizeLogPayload({ turns: [{ role: 'user', message: 'hi' }] }), null);
  assert.strictEqual(normalizeLogPayload({ session: 's', turns: [{ role: 'admin', message: 'hi' }] }), null);
  assert.strictEqual(normalizeLogPayload({ session: 's', turns: [{ role: 'user', message: '   ' }] }), null);
  assert.strictEqual(normalizeLogPayload(null), null);
  assert.strictEqual(normalizeLogPayload({ session: 's', turns: 'junk' }), null);
});

test('bad turns are dropped but good ones survive', () => {
  const rows = normalizeLogPayload({
    session: 's',
    turns: [{ role: 'ghost', message: 'x' }, { role: 'act', message: 'Added 25 mats' }, null],
  });
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].role, 'act');
});

test('oversized messages are clamped, oversized batches truncated', () => {
  const long = 'x'.repeat(9000);
  const many = Array.from({ length: 60 }, () => ({ role: 'user', message: 'hi' }));
  const rows = normalizeLogPayload({ session: 's', turns: [{ role: 'user', message: long }].concat(many) });
  assert.strictEqual(rows[0].message.length, 4000);
  assert.ok(rows.length <= 20);
});
