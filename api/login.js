const { cookie, createSession, passwordMatches, secureEqual } = require('../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });
  const { email = '', password = '' } = req.body || {};
  if (!secureEqual(email.trim().toLowerCase(), (process.env.AUTH_EMAIL || '').toLowerCase()) || !passwordMatches(password)) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  }
  const token = createSession(process.env.AUTH_EMAIL);
  res.setHeader('Set-Cookie', cookie(token, 60 * 60 * 24 * 7));
  return res.status(200).json({ ok: true, token });
};
