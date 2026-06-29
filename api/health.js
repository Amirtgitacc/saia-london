/* SAÏA — concierge health check (Vercel serverless function).
   GET /api/health -> { ok, model, hasKey } */
const { MODEL } = require('../js/concierge-core.js');

module.exports = (req, res) => {
  res.status(200).json({ ok: true, model: MODEL, hasKey: !!process.env.ANTHROPIC_API_KEY });
};
