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

const { blobKey, storeChatLogs } = require('../js/log-core.js');

test('blobKey groups by date then session', () => {
  assert.strictEqual(
    blobKey('a91f', Date.UTC(2026, 7, 6, 9, 30), 'zz9'),
    'chats/2026-08-06/a91f/' + Date.UTC(2026, 7, 6, 9, 30) + '-zz9.json');
});

test('blobKey strips path separators out of a hostile session id', () => {
  const k = blobKey('../../etc/passwd', Date.UTC(2026, 7, 6), 'aa1');
  assert.ok(!k.includes('..'), 'no parent-directory segments');
  assert.strictEqual(k.split('/').length, 4, 'always chats/<date>/<session>/<file>');
});

test('storeChatLogs writes one blob containing every row', async () => {
  const written = [];
  const fake = { put: async (key, body, opts) => { written.push({ key, body, opts }); return { url: 'x' }; } };
  const rows = [
    { session_id: 's1', role: 'user', tier: null, message: 'hello', page: '/' },
    { session_id: 's1', role: 'bot', tier: 'local', message: 'hi there', page: '/' },
  ];
  const res = await storeChatLogs(rows, fake);
  assert.strictEqual(res.stored, true);
  assert.strictEqual(written.length, 1, 'one blob per request, never one per row');
  const parsed = JSON.parse(written[0].body);
  assert.strictEqual(parsed.session, 's1');
  assert.strictEqual(parsed.turns.length, 2);
  assert.strictEqual(parsed.turns[1].message, 'hi there');
  assert.ok(typeof parsed.at === 'number', 'the batch carries a timestamp');
});

test('storeChatLogs writes public blobs with a random suffix', async () => {
  const written = [];
  const fake = { put: async (key, body, opts) => { written.push(opts); return { url: 'x' }; } };
  await storeChatLogs([{ session_id: 's1', role: 'user', tier: null, message: 'hi', page: '/' }], fake);
  assert.strictEqual(written[0].addRandomSuffix, true, 'pathnames must not be guessable');
  assert.strictEqual(written[0].contentType, 'application/json');
});

test('storeChatLogs drops rows when the store is not configured', async () => {
  const res = await storeChatLogs([{ session_id: 's1', role: 'user', tier: null, message: 'hi', page: '/' }], null);
  assert.deepStrictEqual(res, { stored: false, reason: 'no_blob_env' });
});

test('storeChatLogs accepts an empty batch without calling the store', async () => {
  let called = false;
  const fake = { put: async () => { called = true; } };
  const res = await storeChatLogs([], fake);
  assert.strictEqual(called, false);
  assert.strictEqual(res.stored, false);
});

const { readChatSessions, readChatSession } = require('../js/log-core.js');

const FAKE_BLOBS = [
  { pathname: 'chats/2026-08-06/a91f/1000-aaa.json', url: 'https://blob/1', uploadedAt: '2026-08-06T09:00:00Z' },
  { pathname: 'chats/2026-08-06/a91f/2000-bbb.json', url: 'https://blob/2', uploadedAt: '2026-08-06T09:01:00Z' },
  { pathname: 'chats/2026-08-05/b7e4/500-ccc.json',  url: 'https://blob/3', uploadedAt: '2026-08-05T18:00:00Z' },
];

test('readChatSessions groups blobs by session, newest first', async () => {
  const fake = { list: async () => ({ blobs: FAKE_BLOBS }) };
  const out = await readChatSessions(fake);
  assert.strictEqual(out.length, 2);
  assert.strictEqual(out[0].session, 'a91f');
  assert.strictEqual(out[0].date, '2026-08-06');
  assert.strictEqual(out[0].batches, 2);
  assert.strictEqual(out[1].session, 'b7e4');
});

test('readChatSessions returns an empty list when the store is unconfigured', async () => {
  assert.deepStrictEqual(await readChatSessions(null), []);
});

test('readChatSession merges batches into one time-ordered transcript', async () => {
  const fake = { list: async () => ({ blobs: FAKE_BLOBS }) };
  const bodies = {
    'https://blob/2': { session: 'a91f', at: 2000, turns: [{ role: 'bot', tier: 'local', message: 'second' }] },
    'https://blob/1': { session: 'a91f', at: 1000, turns: [{ role: 'user', tier: null, message: 'first' }] },
  };
  const fetchFn = async (url) => ({ ok: true, json: async () => bodies[url] });
  const out = await readChatSession('a91f', fake, fetchFn);
  assert.strictEqual(out.session, 'a91f');
  assert.deepStrictEqual(out.turns.map(t => t.message), ['first', 'second']);
  assert.strictEqual(out.turns[0].at, 1000);
});

test('readChatSession ignores a batch that fails to load', async () => {
  const fake = { list: async () => ({ blobs: FAKE_BLOBS }) };
  const fetchFn = async (url) => (url === 'https://blob/1'
    ? { ok: false }
    : { ok: true, json: async () => ({ session: 'a91f', at: 2000, turns: [{ role: 'bot', tier: 'local', message: 'second' }] }) });
  const out = await readChatSession('a91f', fake, fetchFn);
  assert.deepStrictEqual(out.turns.map(t => t.message), ['second']);
});
