const { put } = require('@vercel/blob');
const { session } = require('../lib/auth');

function safeName(value) {
  return String(value || 'clipforge-prueba').toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72) || 'clipforge-prueba';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });
  if (!session(req)) return res.status(401).json({ error: 'Inicia sesión para guardar el render.' });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ error: 'Vercel Blob todavía no está disponible.' });
  if (req.headers['content-type'] !== 'video/mp4') return res.status(415).json({ error: 'Solo se aceptan archivos MP4.' });
  if (Number(req.headers['content-length'] || 0) > 12 * 1024 * 1024) return res.status(413).json({ error: 'La prueba MP4 supera el límite de 12 MB.' });

  try {
    const blob = await put(`renders/${Date.now()}-${safeName(req.headers['x-project-title'])}.mp4`, req, {
      access: 'public', addRandomSuffix: true, contentType: 'video/mp4', cacheControlMaxAge: 31_536_000
    });
    return res.status(201).json({ url: blob.url, downloadUrl: blob.downloadUrl });
  } catch (error) {
    console.error('ClipForge render upload failed:', error.message);
    return res.status(502).json({ error: 'No pudimos guardar el MP4 de prueba.' });
  }
};

module.exports.config = { api: { bodyParser: false } };
