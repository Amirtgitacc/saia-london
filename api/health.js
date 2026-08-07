/* SAÏA — concierge health check (Vercel serverless function).
   GET /api/health -> { ok, model, hasKey, hasBlobStore }
   hasBlobStore tells you whether chat logging is actually STORING rows: /api/log
   returns 204 even with no Blob env, silently dropping the row, so this is the
   only way to confirm BLOB_READ_WRITE_TOKEN is set in the env. */
const { MODEL } = require('../js/concierge-core.js');

module.exports = (req, res) => {
  res.status(200).json({
    ok: true,
    model: MODEL,
    hasKey: !!process.env.ANTHROPIC_API_KEY,
    hasBlobStore: !!process.env.BLOB_READ_WRITE_TOKEN,
  });
};
