'use strict';
const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const pool    = require('../db/connection');

const router = express.Router();
const JWT_SECRET  = process.env.JWT_SECRET  || 'change-me-in-production';
const COOKIE_OPTS = { httpOnly: true, sameSite: 'Strict', path: '/' };

// POST /api/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ ok: false, error: 'Benutzername und Passwort erforderlich.' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, username, email, password_hash FROM users WHERE username = ?',
      [username]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ ok: false, error: 'Ungültige Anmeldedaten.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '1d' }
    );
    res.cookie('token', token, COOKIE_OPTS);
    return res.json({ ok: true });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ ok: false, error: 'Interner Fehler.' });
  }
});

// POST /api/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token', { path: '/' });
  return res.json({ ok: true });
});

// GET /api/me  (protected)
const { requireAuth } = require('../middleware/auth');
router.get('/me', requireAuth, (req, res) => {
  return res.json({ username: req.user.username, email: req.user.email });
});

module.exports = router;
