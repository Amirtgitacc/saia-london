/* ============================================================
   SAÏA — chat transcript logging endpoint (VERCEL serverless function)
   The browser fires each chat turn here so conversations can be
   reviewed later in Supabase (table `chat_logs`). Shares its brain
   with the local dev server (server.js) via js/log-core.js.

     POST /api/log  { session, page, turns:[{role, tier, message}] } -> 204
   ============================================================ */
const { normalizeLogPayload, insertChatLogs } = require('../js/log-core.js');
const { applyCors } = require('../js/http-guard.js');
const { rateLimit } = require('../js/rate-limit.js');

const RL = { name: 'log', limit: parseInt(process.env.RL_LOG_PER_MIN, 10) || 60, windowMs: 60000 };

module.exports = async (req, res) => {
  const cors = applyCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(404).end(); return; }
  if (!cors.allowed) { res.status(403).json({ error: 'forbidden_origin' }); return; }

  const rl = await rateLimit(req, RL);
  if (!rl.ok) { res.setHeader('Retry-After', String(rl.retryAfter)); res.status(429).json({ error: 'rate_limited' }); return; }

  let payload = req.body;
  if (typeof payload === 'string') { try { payload = JSON.parse(payload || '{}'); } catch (e) { payload = {}; } }

  const rows = normalizeLogPayload(payload);
  if (!rows) { res.status(400).json({ error: 'bad_payload' }); return; }

  try {
    await insertChatLogs(rows);
    res.status(204).end();
  } catch (err) {
    console.error('[chat-log]', err && err.message ? err.message : err);
    res.status(502).json({ error: 'log_failed' });
  }
};
