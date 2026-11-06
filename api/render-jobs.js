const { put, list } = require('@vercel/blob');
const { session } = require('../lib/auth');

function estimateCredits({ format, kind }) {
  const base = format === 'long' ? 8 : 3;
  return kind === 'clip-reedit' ? base + 4 : base;
}

function safeTitle(value) {
  return String(value || 'proyecto').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'proyecto';
}

module.exports = async (req, res) => {
  if (!session(req)) return res.status(401).json({ error: 'Inicia sesión para acceder a la cola.' });
  if (req.method === 'POST') {
    const { title, format, sourceType, youtubeMode, sourceAsset, scenes, maxCredits } = req.body || {};
    if (!title || !['short', 'long'].includes(format) || !Array.isArray(scenes)) return res.status(400).json({ error: 'El proyecto de render no está completo.' });
    const kind = sourceType === 'youtube' && youtubeMode === 'clip' ? 'clip-reedit' : 'generated-video';
    if (kind === 'clip-reedit' && !sourceAsset) return res.status(400).json({ error: 'Para clips, sube primero el MP4 autorizado.' });
    const estimatedCredits = estimateCredits({ format, kind });
    const budget = Number(maxCredits);
    if (!Number.isFinite(budget) || budget < estimatedCredits) return res.status(409).json({ error: `Este render estima ${estimatedCredits} créditos y supera tu límite.` });
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const job = { id, title: String(title).slice(0, 120), status: 'queued', kind, format, estimatedCredits, maxCredits: budget, createdAt: new Date().toISOString(), sourceAsset: sourceAsset || null, scenes: scenes.map(scene => ({ time: scene.time, title: scene.title, script: scene.script })) };
    const blob = await put(`jobs/${id}-${safeTitle(title)}.json`, JSON.stringify(job), { access: 'public', addRandomSuffix: true, contentType: 'application/json', cacheControlMaxAge: 60 });
    return res.status(201).json({ job: { ...job, manifestUrl: blob.url } });
  }
  if (req.method === 'GET') {
    const { blobs } = await list({ prefix: 'jobs/', limit: 20 });
    const jobs = await Promise.all(blobs.map(async blob => {
      try { const response = await fetch(blob.url); return await response.json(); } catch { return null; }
    }));
    return res.status(200).json({ jobs: jobs.filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
  }
  return res.status(405).json({ error: 'Método no permitido.' });
};
