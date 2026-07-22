/* SAÏA — concierge health check (Vercel serverless function).
   GET /api/health -> { ok, model, hasKey, hasSupabase }
   hasSupabase tells you whether chat logging is actually STORING rows: /api/log
   returns 204 even with no Supabase env, silently dropping the row, so this is the
   only way to confirm SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set in the env. */
const { MODEL } = require('../js/concierge-core.js');

module.exports = (req, res) => {
  res.status(200).json({
    ok: true,
    model: MODEL,
    hasKey: !!process.env.ANTHROPIC_API_KEY,
    hasSupabase: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  });
};
