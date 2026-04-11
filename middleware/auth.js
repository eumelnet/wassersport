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

  const SUPPORTED = ['de', 'en', 'pl', 'nl'];
  const lang = req.query && req.query.lang;
  const language = SUPPORTED.includes(lang) ? lang : 'de';
  return res.redirect(`/login.html?lang=${encodeURIComponent(language)}`);
}

module.exports = { requireAuth };
