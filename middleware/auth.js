'use strict';
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies.token;
  if (!token) return _deny(req, res);

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return _deny(req, res);
  }
}

function requireAdmin(req, res, next) {
  return requireAuth(req, res, () => {
    if (req.user && req.user.role === 'admin') return next();
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(403).json({ ok: false, error: 'Admin-Rolle erforderlich.' });
    }
    return res.status(403).send('Forbidden — Admin-Rolle erforderlich.');
  });
}

/**
 * Optional auth: sets req.user if a valid token exists, otherwise continues
 * without failing. Used for pages that render differently for logged-in users
 * (e.g. rendering the nav with a "Logout" button).
 */
function optionalAuth(req, res, next) {
  const token = req.cookies && req.cookies.token;
  if (!token) return next();
  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch {
    // ignore
  }
  return next();
}

function _deny(req, res) {
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  return res.redirect('/login.html');
}

module.exports = { requireAuth, requireAdmin, optionalAuth };
