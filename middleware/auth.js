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

function _deny(req, res) {
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  return res.redirect('/login.html');
}

module.exports = { requireAuth };
