const { put } = require('@vercel/blob');
const crypto = require('crypto');

function authorized(req) {
  const supplied = String(req.headers['x-worker-secret'] || '');
  const expected = String(process.env.WORKER_SECRET || '');
  return supplied.length === expected.length && supplied && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });
  if (!authorized(req)) return res.status(401).json({ error: 'Worker no autorizado.' });
  const { jobId, status, clips, error, phase, completedAt } = req.body || {};
  if (!jobId || !['completed', 'failed', 'processing'].includes(status)) return res.status(400).json({ error: 'Actualización inválida.' });
  const result = { jobId, status, phase: phase ? String(phase).slice(0, 160) : null, clips: Array.isArray(clips) ? clips.slice(0, 8) : [], error: error ? String(error).slice(0, 500) : null, completedAt: completedAt || new Date().toISOString() };
  await put(`job-status/${jobId}.json`, JSON.stringify(result), { access: 'public', allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 30 });
  return res.status(200).json({ ok: true });
};
