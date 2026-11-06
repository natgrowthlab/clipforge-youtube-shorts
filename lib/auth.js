const crypto = require('crypto');

const cookieName = 'clipforge_session';
const encode = value => Buffer.from(value).toString('base64url');
const decode = value => Buffer.from(value, 'base64url').toString();

function secureEqual(left, right) {
  const a = Buffer.from(left || '');
  const b = Buffer.from(right || '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function passwordMatches(password) {
  const [algorithm, salt, stored] = (process.env.AUTH_PASSWORD_HASH || '').split('$');
  if (algorithm !== 'scrypt' || !salt || !stored) return false;
  const derived = crypto.scryptSync(password, Buffer.from(salt, 'base64url'), 64);
  return secureEqual(derived.toString('base64url'), stored);
}

function sign(payload) {
  return crypto.createHmac('sha256', process.env.AUTH_SECRET || '').update(payload).digest('base64url');
}

function createSession(email) {
  const payload = encode(JSON.stringify({ email, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 }));
  return `${payload}.${sign(payload)}`;
}

function readCookie(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(part => part.trim().split('=').map(decodeURIComponent)).filter(([key]) => key));
}

function session(req) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : readCookie(req)[cookieName];
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !secureEqual(sign(payload), signature)) return null;
  try { const value = JSON.parse(decode(payload)); return value.exp > Date.now() ? value : null; } catch { return null; }
}

function cookie(value, maxAge = 0) {
  return `${cookieName}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

module.exports = { cookie, cookieName, createSession, passwordMatches, session, secureEqual };
