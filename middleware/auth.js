'use strict';
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

// ── Role hierarchy ────────────────────────────────────────────────────────────
// Higher number = more privileges. Every role implicitly has the permissions of
// all roles below it.
const ROLE_LEVEL = {
  public:   0,
  member:   1,
  webadmin: 2,
  dbadmin:  3,
  admin:    4,
};

/** Return the numeric level for a role string. Unknown roles → 0. */
function roleLevel(role) {
  return ROLE_LEVEL[role] || 0;
}

/** Returns true when the user's role is at least `minRole`. */
function hasRole(user, minRole) {
  return user && roleLevel(user.role) >= roleLevel(minRole);
}

// ── Middleware factories ──────────────────────────────────────────────────────

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

/**
 * Factory: require at least `minRole` (e.g. 'webadmin', 'dbadmin', 'admin').
 * The old `requireAdmin` is kept as a convenience alias for requireRole('webadmin')
 * so the existing admin routes (page editing, media, settings) become accessible
 * to webadmin and above.
 */
function requireRole(minRole) {
  return function (req, res, next) {
    return requireAuth(req, res, () => {
      if (hasRole(req.user, minRole)) return next();
      const label = minRole.charAt(0).toUpperCase() + minRole.slice(1);
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(403).json({ ok: false, error: `${label}-Rolle erforderlich.` });
      }
      return res.status(403).send(`Forbidden — ${label}-Rolle erforderlich.`);
    });
  };
}

// Legacy alias — admin routes (CMS, media, settings) now require webadmin+.
const requireAdmin = requireRole('webadmin');

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

module.exports = { requireAuth, requireAdmin, requireRole, optionalAuth, hasRole, roleLevel, ROLE_LEVEL };
