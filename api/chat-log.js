/* ============================================================
   SAÏA — chat transcript READER (Vercel serverless function)
   Cristina's window onto the AI conversations. Password-gated;
   the password buys an 8-hour HMAC cookie so she types it once
   a day.

     POST /api/chat-log            { password }        -> 204 + cookie
     GET  /api/chat-log?list=1                         -> { sessions:[…] }
     GET  /api/chat-log?session=<id>                   -> { session, turns:[…] }

   PRIVACY: returns transcript CONTENT only. Never return a blob
   URL — those are public-but-unguessable and would leak the
   transcript to anyone the link reached.
   ============================================================ */
const crypto = require('crypto');
const { readChatSessions, readChatSession } = require('../js/log-core.js');
const { applyCors } = require('../js/http-guard.js');
const { rateLimit } = require('../js/rate-limit.js');

const COOKIE = 'saia_log';
const TTL_MS = 8 * 60 * 60 * 1000;
const RL = { name: 'chat-log-auth', limit: parseInt(process.env.RL_CHATLOG_PER_15, 10) || 10, windowMs: 15 * 60 * 1000 };

function signToken(expMs, secret) {
  const mac = crypto.createHmac('sha256', String(secret)).update(String(expMs)).digest('hex');
  return expMs + '.' + mac;
}

function verifyToken(token, secret, nowMs) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return false;
  const exp = parseInt(parts[0], 10);
  if (!Number.isFinite(exp) || exp <= nowMs) return false;
  const expected = crypto.createHmac('sha256', String(secret)).update(parts[0]).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(parts[1], 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function readCookie(req, name) {
  const raw = (req.headers && req.headers.cookie) || '';
  const hit = raw.split(';').map((s) => s.trim()).find((s) => s.indexOf(name + '=') === 0);
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : '';
}

// constant-time password compare that doesn't leak the length
function passwordMatches(given, expected) {
  const a = crypto.createHash('sha256').update(String(given || '')).digest();
  const b = crypto.createHash('sha256').update(String(expected || '')).digest();
  return crypto.timingSafeEqual(a, b);
}

module.exports = async (req, res) => {
  const cors = applyCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!cors.allowed) { res.status(403).json({ error: 'forbidden_origin' }); return; }

  const password = process.env.CHAT_LOG_PASSWORD;
  const secret = process.env.CHAT_LOG_SECRET;
  if (!password || !secret) { res.status(503).json({ error: 'not_configured' }); return; }

  if (req.method === 'POST') {
    const rl = await rateLimit(req, RL);
    if (!rl.ok) { res.setHeader('Retry-After', String(rl.retryAfter)); res.status(429).json({ error: 'rate_limited' }); return; }
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body || '{}'); } catch (e) { body = {}; } }
    if (!passwordMatches(body && body.password, password)) { res.status(401).json({ error: 'bad_password' }); return; }
    const token = signToken(Date.now() + TTL_MS, secret);
    res.setHeader('Set-Cookie', COOKIE + '=' + encodeURIComponent(token)
      + '; Path=/; Max-Age=' + Math.floor(TTL_MS / 1000) + '; HttpOnly; Secure; SameSite=Strict');
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') { res.status(404).end(); return; }
  if (!verifyToken(readCookie(req, COOKIE), secret, Date.now())) { res.status(401).json({ error: 'unauthorised' }); return; }

  try {
    const session = req.query && req.query.session;
    if (session) { res.status(200).json(await readChatSession(String(session))); return; }
    res.status(200).json({ sessions: await readChatSessions() });
  } catch (err) {
    console.error('[chat-log-read]', err && err.message ? err.message : err);
    res.status(502).json({ error: 'read_failed' });
  }
};

module.exports.signToken = signToken;
module.exports.verifyToken = verifyToken;
// Exposed so server.js (local dev, plain node:http req/res — no Vercel
// req.query/res.status() sugar) can share this exact auth logic instead of
// re-implementing it and risking local/prod drift.
module.exports.passwordMatches = passwordMatches;
module.exports.readCookie = readCookie;
module.exports.COOKIE = COOKIE;
module.exports.TTL_MS = TTL_MS;
