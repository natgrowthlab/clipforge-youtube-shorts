const { handleUpload } = require('@vercel/blob/client');
const { session } = require('../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });
  if (!session(req)) return res.status(401).json({ error: 'Inicia sesión para guardar el render.' });
  try {
    const response = await handleUpload({
      request: req,
      body: req.body,
      onBeforeGenerateToken: async pathname => {
        if (!pathname.startsWith('renders/') || !pathname.endsWith('.mp4')) throw new Error('Ruta de archivo no permitida.');
        return { allowedContentTypes: ['video/mp4'], maximumSizeInBytes: 40 * 1024 * 1024, addRandomSuffix: true, cacheControlMaxAge: 31_536_000 };
      }
    });
    return res.status(200).json(response);
  } catch (error) {
    console.error('ClipForge client upload failed:', error.message);
    return res.status(502).json({ error: 'No pudimos preparar la subida del render.' });
  }
};
