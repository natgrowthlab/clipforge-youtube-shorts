const { handleUpload } = require('@vercel/blob/client');
const { session } = require('../lib/auth');

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });
  if (!session(req)) return res.status(401).json({ error: 'Inicia sesión para subir un video.' });
  try {
    const response = await handleUpload({
      token: process.env.BLOB_READ_WRITE_TOKEN,
      request: req,
      body: await readJson(req),
      onBeforeGenerateToken: async pathname => {
        if (!pathname.toLowerCase().endsWith('.mp4')) throw new Error('Solo se aceptan archivos MP4.');
        return { allowedContentTypes: ['video/mp4'], maximumSizeInBytes: 5 * 1024 * 1024 * 1024, addRandomSuffix: true };
      },
      onUploadCompleted: async () => {},
    });
    return res.status(200).json(response);
  } catch (error) { return res.status(400).json({ error: error.message || 'No se pudo preparar la carga.' }); }
};
module.exports.config = { api: { bodyParser: false } };
