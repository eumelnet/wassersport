'use strict';
const crypto      = require('crypto');
const express     = require('express');
const bcrypt      = require('bcrypt');
const jwt         = require('jsonwebtoken');
const nodemailer  = require('nodemailer');
const pool        = require('../db/connection');

const router = express.Router();
const JWT_SECRET  = process.env.JWT_SECRET  || 'change-me-in-production';
const COOKIE_OPTS = { httpOnly: true, sameSite: 'Strict', path: '/' };

// ── Nodemailer transporter (configured via SMTP_* env vars) ─────────────────
const mailer = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

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

// POST /api/forgot-password
// Always responds with success to prevent email enumeration.
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ ok: false, error: 'E-Mail-Adresse erforderlich.' });
  }

  const ok = { ok: true, message: 'Falls ein Konto existiert, wurde eine E-Mail gesendet.' };

  try {
    const [rows] = await pool.query(
      'SELECT id, username FROM users WHERE email = ?', [email]
    );
    // Respond immediately — don't leak whether the address exists
    if (!rows[0]) return res.json(ok);
    const user = rows[0];

    // Generate a 256-bit random token; store only its SHA-256 hash
    const rawToken  = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE token_hash = VALUES(token_hash), expires_at = VALUES(expires_at), used_at = NULL`,
      [user.id, tokenHash, expiresAt]
    );

    const base = (process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
    const resetUrl = `${base}/reset-password.html?token=${rawToken}`;

    await mailer.sendMail({
      from:    process.env.SMTP_FROM || process.env.SMTP_USER,
      to:      email,
      subject: 'Passwort zurücksetzen — Havelkanal Wassersport',
      text:    `Hallo ${user.username},\n\nbitte klicke auf den folgenden Link, um Dein Passwort zurückzusetzen (gültig für 1 Stunde):\n\n${resetUrl}\n\nFalls Du diese Anfrage nicht gestellt hast, kannst Du diese E-Mail ignorieren.\n\n— Havelkanal Wassersport`,
      html:    `<p>Hallo <strong>${user.username}</strong>,</p>
               <p>bitte klicke auf den folgenden Link, um Dein Passwort zurückzusetzen <em>(gültig für 1 Stunde)</em>:</p>
               <p><a href="${resetUrl}">${resetUrl}</a></p>
               <p>Falls Du diese Anfrage nicht gestellt hast, kannst Du diese E-Mail ignorieren.</p>
               <p>— Havelkanal Wassersport</p>`,
    });
  } catch (err) {
    console.error('Forgot-password error:', err);
    // Still return ok to avoid leaking information
  }

  return res.json(ok);
});

// POST /api/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) {
    return res.status(400).json({ ok: false, error: 'Token und neues Passwort erforderlich.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ ok: false, error: 'Passwort muss mindestens 8 Zeichen lang sein.' });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const [rows] = await pool.query(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = ? AND expires_at > NOW() AND used_at IS NULL`,
      [tokenHash]
    );
    const record = rows[0];
    if (!record) {
      return res.status(400).json({ ok: false, error: 'Token ungültig oder abgelaufen.' });
    }

    const hash = await bcrypt.hash(password, 12);

    // Update password and mark token as used in one transaction
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, record.user_id]);
      await conn.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?', [record.id]);
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('Reset-password error:', err);
    return res.status(500).json({ ok: false, error: 'Interner Fehler.' });
  }
});

module.exports = router;
