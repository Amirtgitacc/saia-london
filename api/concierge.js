/* ============================================================
   SAÏA — Tier 2 assistant endpoint (VERCEL serverless function)
   Production transport for the concierge. Shares its brain with the
   local dev server (server.js) via js/concierge-core.js, so the two
   never drift. The ANTHROPIC_API_KEY is read from Vercel env vars and
   never reaches the browser.

     POST /api/concierge  { messages, hire } -> { say, actions }
   ============================================================ */
const { processConcierge } = require('../js/concierge-core.js');
const { applyCors } = require('../js/http-guard.js');

module.exports = async (req, res) => {
  const cors = applyCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(404).end(); return; }
  if (!cors.allowed) { res.status(403).json({ error: 'forbidden_origin' }); return; }

  // Vercel parses a JSON body into req.body; fall back to manual parse just in case.
  let payload = req.body;
  if (typeof payload === 'string') { try { payload = JSON.parse(payload || '{}'); } catch (e) { payload = {}; } }
  if (!payload || typeof payload !== 'object') payload = {};

  try {
    const out = await processConcierge(payload);
    res.status(200).json(out);
  } catch (err) {
    if (err && err.code === 'no_api_key') { res.status(500).json({ error: 'no_api_key' }); return; }
    console.error('[concierge]', err && err.message ? err.message : err);
    res.status(502).json({ error: 'assist_failed' });
  }
};
