const { session } = require('../lib/auth');

function parseJson(text) {
  const cleaned = String(text || '').trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });
  if (!session(req)) return res.status(401).json({ error: 'Inicia sesión para generar un guion.' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'La clave de OpenAI no está disponible en producción.' });

  const { sourceType, source, youtubeMode = 'reference', format, language, visualStyle } = req.body || {};
  if (!sourceType || typeof source !== 'string' || source.trim().length < 10) return res.status(400).json({ error: 'Necesitamos una idea o referencia más concreta.' });
  if (!['short', 'long'].includes(format)) return res.status(400).json({ error: 'Formato no válido.' });

  const duration = format === 'short' ? '45 a 60 segundos' : '4 a 5 minutos';
  const sceneCount = format === 'short' ? 4 : 5;
  const scriptSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'brief', 'hook', 'scenes'],
    properties: {
      title: { type: 'string' },
      brief: { type: 'string' },
      hook: { type: 'string' },
      scenes: {
        type: 'array', minItems: sceneCount, maxItems: sceneCount,
        items: {
          type: 'object', additionalProperties: false,
          required: ['time', 'title', 'script', 'direction', 'visual_prompt', 'subtitle', 'cta'],
          properties: {
            time: { type: 'string' }, title: { type: 'string' }, script: { type: 'string' },
            direction: { type: 'string' }, visual_prompt: { type: 'string' }, subtitle: { type: 'string' }, cta: { type: 'string' }
          }
        }
      }
    }
  };
  const sourceNote = sourceType === 'youtube'
    ? `La fuente es esta URL de YouTube: ${source}. Modo solicitado: ${youtubeMode === 'clip' ? 'recorte y reedición de material autorizado' : 'referencia creativa para contenido nuevo'}. No inventes citas o escenas concretas del video; si faltan datos, usa el tema implícito de la referencia.`
    : `Material proporcionado: ${source}`;
  const prompt = `Eres un estratega y guionista experto en video social. Crea un guion listo para revisión humana.

${sourceNote}
Formato: ${format === 'short' ? 'Short/Reel vertical' : 'Video de YouTube horizontal'}.
Duración objetivo: ${duration}.
Idioma: ${language}; adapta expresiones y ritmo culturalmente, no traduzcas de forma literal.
Estilo visual: ${visualStyle}.

Devuelve SOLO JSON válido, sin Markdown, con esta estructura exacta:
{"title":"string","brief":"string","hook":"string","scenes":[{"time":"string","title":"string","script":"string","direction":"string","visual_prompt":"string","subtitle":"string","cta":"string"}]}

Debes devolver exactamente ${sceneCount} escenas. El texto hablado debe caber en la duración. Incluye un hook potente, una idea útil, una dirección de producción concreta y un CTA natural. No uses promesas engañosas.`;

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini', input: prompt, max_output_tokens: format === 'short' ? 1100 : 2200,
        text: { format: { type: 'json_schema', name: 'clipforge_script', strict: true, schema: scriptSchema } }
      })
    });
    const result = await response.json();
    if (!response.ok) return res.status(502).json({ error: result?.error?.message || 'OpenAI no pudo generar el guion.' });
    const script = parseJson(result.output_text);
    if (!script?.title || !Array.isArray(script.scenes) || script.scenes.length !== sceneCount) throw new Error('Respuesta incompleta');
    return res.status(200).json({ script });
  } catch (error) {
    return res.status(502).json({ error: 'No pudimos convertir la respuesta de IA en un guion. Inténtalo otra vez.' });
  }
};
