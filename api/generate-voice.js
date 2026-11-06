const { put } = require('@vercel/blob');
const { session } = require('../lib/auth');

const allowedVoices = new Set(['alloy', 'coral', 'nova', 'onyx']);

function safeName(value) {
  return String(value || 'clipforge-voz').toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72) || 'clipforge-voz';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });
  if (!session(req)) return res.status(401).json({ error: 'Inicia sesión para generar voz.' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'La clave de OpenAI no está disponible.' });
  const { script, voice = 'coral', title = 'clipforge-voz', language = 'Español latino' } = req.body || {};
  if (typeof script !== 'string' || script.trim().length < 10) return res.status(400).json({ error: 'Necesitamos un guion para crear la narración.' });
  if (script.length > 14_000) return res.status(400).json({ error: 'El guion es demasiado extenso para una sola narración.' });
  if (!allowedVoices.has(voice)) return res.status(400).json({ error: 'Voz no válida.' });
  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice, input: script, response_format: 'mp3', instructions: `Narra en ${language}, de forma clara, cálida y natural para video social.` })
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return res.status(502).json({ error: error?.error?.message || 'OpenAI no pudo crear la narración.' });
    }
    const audio = Buffer.from(await response.arrayBuffer());
    const blob = await put(`audio/${Date.now()}-${safeName(title)}.mp3`, audio, { access: 'public', addRandomSuffix: true, contentType: 'audio/mpeg', cacheControlMaxAge: 31_536_000 });
    return res.status(201).json({ url: blob.url, downloadUrl: blob.downloadUrl });
  } catch (error) {
    console.error('ClipForge voice generation failed:', error.message);
    return res.status(502).json({ error: 'No pudimos generar la voz IA.' });
  }
};
