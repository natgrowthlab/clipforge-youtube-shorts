const { session } = require('../lib/auth');

module.exports = (req, res) => {
  const current = session(req);
  if (!current) return res.status(401).json({ error: 'Sin sesión.' });
  return res.status(200).json({ email: current.email });
};
