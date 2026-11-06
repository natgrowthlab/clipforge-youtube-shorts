const { cookie } = require('../lib/auth');

module.exports = (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });
  res.setHeader('Set-Cookie', cookie('', 0));
  return res.status(200).json({ ok: true });
};
