/* ============================================================
   SAÏA — chat transcript logging core (shared brain)
   Used by BOTH transports so they never drift:
     • api/log.js  — Vercel serverless function (prod)
     • server.js   — local dev server

   normalizeLogPayload() validates/clamps what the browser sent;
   storeChatLogs() writes ONE immutable blob per request to Vercel
   Blob. Never read-modify-write a per-session file: two chat turns
   can post at once and one would be silently lost. Reads merge the
   batches back together (readChatSession).

   PRIVACY: Vercel Blob URLs are public but unguessable. Transcripts
   carry names, postcodes and emails, so blobs are written with
   addRandomSuffix:true and their URLs are NEVER returned to the
   browser — api/chat-log.js serves content, not links.

   No BLOB_READ_WRITE_TOKEN → rows are accepted and dropped, so the
   site needs zero setup to work locally.
   ============================================================ */
const ROLES = { user: true, bot: true, act: true };
const MAX_MESSAGE = 4000;
const MAX_TURNS = 20;

// { session, page, turns:[{role, tier, message}] } -> insert-ready rows (or null)
function normalizeLogPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const session = String(payload.session || '').slice(0, 64);
  if (!session.trim()) return null;
  const page = payload.page ? String(payload.page).slice(0, 200) : null;
  const turns = Array.isArray(payload.turns) ? payload.turns : [];
  const rows = [];
  turns.slice(0, MAX_TURNS).forEach((t) => {
    if (!t || typeof t !== 'object') return;
    const role = String(t.role || '');
    const message = String(t.message || '').slice(0, MAX_MESSAGE);
    if (!ROLES[role] || !message.trim()) return;
    rows.push({
      session_id: session,
      role: role,
      tier: t.tier ? String(t.tier).slice(0, 16) : null,
      message: message,
      page: page,
    });
  });
  return rows.length ? rows : null;
}

// A session id is attacker-controlled, so it can never reach a path unescaped.
// NOTE: the brief's original regex only stripped LEADING dots, which still let
// '../../etc/passwd' through with a '..' surviving mid-string once slashes were
// swapped for hyphens. This collapses every run of 2+ dots too, not just a
// leading run, so no '..' segment can ever appear anywhere in the result.
function safeSegment(s) {
  return String(s || '')
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/\.{2,}/g, '-')
    .replace(/^[.-]+/, '')
    .slice(0, 64) || 'unknown';
}

function blobKey(session, atMs, rand) {
  const day = new Date(atMs).toISOString().slice(0, 10);
  return 'chats/' + day + '/' + safeSegment(session) + '/' + atMs + '-' + rand + '.json';
}

// Real client, resolved lazily so `require` of this module never needs the package
// present at import time (server.js runs without it in a bare checkout).
function blobClient() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  // eslint-disable-next-line global-require
  return require('@vercel/blob');
}

async function storeChatLogs(rows, client) {
  if (!rows || !rows.length) return { stored: false, reason: 'empty' };
  const c = client === undefined ? blobClient() : client;
  if (!c) return { stored: false, reason: 'no_blob_env' };
  const at = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const session = rows[0].session_id;
  const body = JSON.stringify({
    session: session,
    page: rows[0].page || null,
    at: at,
    turns: rows.map((r) => ({ role: r.role, tier: r.tier, message: r.message })),
  });
  const key = blobKey(session, at, rand);
  await c.put(key, body, {
    access: 'public',
    addRandomSuffix: true,     // the pathname alone must not be guessable
    contentType: 'application/json',
  });
  return { stored: true, key: key };
}

/* ---- naming a conversation ------------------------------------
   A uuid tells Cristina nothing, so a session is named after the
   first thing the visitor said, plus a coarse topic. Both are
   derived here (not in the page) so the list and the transcript
   header can never disagree.
   Topic order is deliberate: mat hire is the product, so "20 mats
   delivered to NW5" reads as Mat hire, and only a chat with no mat
   words at all is filed under Delivery.                          */
const TOPIC_RULES = [
  { topic: 'Pilates',  re: /pilates|reformer|1-?2-?1|one[- ]to[- ]one|instructor|class/i },
  { topic: 'Events',   re: /\bevent|retreat|workshop|rsvp|guest ?list|social\b/i },
  { topic: 'Bespoke',  re: /bespoke|custom|branded|logo|commission/i },
  { topic: 'Mat hire', re: /\bmats?\b|hire|quote|price|book|£|\bdays?\b/i },
  { topic: 'Delivery', re: /deliver|courier|collect|postcode|drop ?off|pick ?up/i },
];

function titleFrom(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const cut = clean.length <= 68 ? clean : clean.slice(0, 68).replace(/\s+\S*$/, '') + '…';
  return cut.charAt(0).toUpperCase() + cut.slice(1);
}

// Topic reads the visitor's own words only — the assistant's action lines
// ("Delivery to NW5 · Band A") would file half the log under Delivery.
function topicFrom(turns) {
  const said = (Array.isArray(turns) ? turns : [])
    .filter((t) => t && t.role === 'user')
    .map((t) => String(t.message || '')).join('\n');
  const hit = TOPIC_RULES.find((r) => r.re.test(said));
  return hit ? hit.topic : 'General';
}

function summariseTurns(turns) {
  const list = Array.isArray(turns) ? turns : [];
  const opener = list.find((t) => t && t.role === 'user' && String(t.message || '').trim());
  return { title: titleFrom(opener && opener.message), topic: topicFrom(list) };
}

// chats/<date>/<session>/<at>-<rand>.json  ->  { date, session, at }
function parseKey(pathname) {
  const p = String(pathname || '').split('/');
  if (p.length !== 4 || p[0] !== 'chats') return null;
  const at = parseInt(String(p[3]).split('-')[0], 10);
  return { date: p[1], session: p[2], at: Number.isFinite(at) ? at : 0 };
}

async function readChatSessions(client, limit, fetchFn) {
  const c = client === undefined ? blobClient() : client;
  if (!c) return [];
  const res = await c.list({ prefix: 'chats/', limit: 1000 });
  const bySession = new Map();
  // Blob URLs stay in this local map and are NEVER copied onto a returned
  // row — see the privacy note at the top of the file.
  const openerUrl = new Map();
  const openerAt = new Map();
  (res.blobs || []).forEach((b) => {
    const k = parseKey(b.pathname);
    if (!k) return;
    const cur = bySession.get(k.session);
    if (!cur) {
      bySession.set(k.session, { session: k.session, date: k.date, lastAt: k.at, batches: 1, startedAt: k.at });
      openerUrl.set(k.session, b.url); openerAt.set(k.session, k.at);
    } else {
      cur.batches += 1;
      if (k.at > cur.lastAt) { cur.lastAt = k.at; cur.date = k.date; }
      if (k.at < openerAt.get(k.session)) {
        cur.startedAt = k.at;
        openerUrl.set(k.session, b.url); openerAt.set(k.session, k.at);
      }
    }
  });
  const rows = Array.from(bySession.values())
    .sort((a, b) => b.lastAt - a.lastAt)
    .slice(0, limit || 200);

  // The opening batch names the conversation: one extra fetch per session,
  // in small waves so a busy log never opens 200 sockets at once. A batch
  // that will not load just leaves the row unnamed.
  const get = fetchFn || fetch;
  for (let i = 0; i < rows.length; i += 12) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(rows.slice(i, i + 12).map(async (s) => {
      let turns = [];
      try {
        const r = await get(openerUrl.get(s.session));
        if (r && r.ok) { const body = await r.json(); if (body && Array.isArray(body.turns)) turns = body.turns; }
      } catch (e) { turns = []; }
      const sum = summariseTurns(turns);
      s.title = sum.title;
      s.topic = sum.topic;
    }));
  }
  return rows;
}

async function readChatSession(session, client, fetchFn) {
  const c = client === undefined ? blobClient() : client;
  if (!c) return { session: session, turns: [], title: '', topic: 'General' };
  const get = fetchFn || fetch;
  const res = await c.list({ prefix: 'chats/', limit: 1000 });
  const mine = (res.blobs || [])
    .map((b) => ({ b: b, k: parseKey(b.pathname) }))
    .filter((x) => x.k && x.k.session === session)
    .sort((a, b) => a.k.at - b.k.at);
  const turns = [];
  for (const x of mine) {
    let body = null;
    try {
      const r = await get(x.b.url);
      if (r && r.ok) body = await r.json();
    } catch (e) { body = null; }          // a single unreadable batch must not lose the rest
    if (!body || !Array.isArray(body.turns)) continue;
    body.turns.forEach((t) => turns.push({
      at: body.at || x.k.at, role: t.role, tier: t.tier || null, message: t.message,
    }));
  }
  const sum = summariseTurns(turns);
  return { session: session, turns: turns, title: sum.title, topic: sum.topic };
}

module.exports = {
  normalizeLogPayload, blobKey, storeChatLogs, blobClient,
  readChatSessions, readChatSession, summariseTurns,
};
