'use strict';
/**
 * Public form API: render forms and accept submissions based on the
 * access_level configured in form_templates.
 *
 * Mounted at /api/forms by server.js with optionalAuth so req.user is
 * available when logged in but unauthenticated access is also possible
 * (for public forms).
 *
 * Endpoints:
 *   GET  /api/forms/:slug          — form definition (fields, title)
 *   GET  /api/forms/:slug/rows     — read data (if access allows)
 *   POST /api/forms/:slug/rows     — submit/insert row
 *   PUT  /api/forms/:slug/rows/:id — update row
 *   DELETE /api/forms/:slug/rows/:id — delete row
 */
const express = require('express');
const { pool }    = require('../db/connection');
const logger      = require('../lib/logger');
const { hasRole } = require('../middleware/auth');

const router = express.Router();

// ── Helpers ──────────────────────────────────────────────────────────────────
function safeName(name) {
  if (!name || !/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/.test(name)) return null;
  return name;
}

/** Load form template and check access. Returns { form, denied } or throws. */
async function loadForm(slug, user) {
  const [rows] = await pool.query('SELECT * FROM form_templates WHERE slug = ?', [slug]);
  if (!rows.length) return { form: null };
  const form = rows[0];
  form.fields = typeof form.fields_json === 'string' ? JSON.parse(form.fields_json) : form.fields_json;
  // Access check
  const level = form.access_level || 'dbadmin';
  if (level === 'public') return { form };
  if (!user) return { form: null, denied: true };
  if (!hasRole(user, level)) return { form: null, denied: true };
  return { form };
}

// ── Get form definition ──────────────────────────────────────────────────────
router.get('/:slug', async (req, res) => {
  try {
    const { form, denied } = await loadForm(req.params.slug, req.user);
    if (denied) return res.status(403).json({ ok: false, error: 'Kein Zugriff.' });
    if (!form) return res.status(404).json({ ok: false, error: 'Formular nicht gefunden.' });
    res.json({
      ok: true,
      form: {
        slug: form.slug,
        title: form.title,
        description: form.description,
        table_name: form.table_name,
        fields: form.fields,
        access_level: form.access_level,
      },
    });
  } catch (err) {
    logger.error(err, 'forms: get form failed');
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Read rows ────────────────────────────────────────────────────────────────
router.get('/:slug/rows', async (req, res) => {
  try {
    const { form, denied } = await loadForm(req.params.slug, req.user);
    if (denied) return res.status(403).json({ ok: false, error: 'Kein Zugriff.' });
    if (!form) return res.status(404).json({ ok: false, error: 'Formular nicht gefunden.' });
    const table = safeName(form.table_name);
    if (!table) return res.status(400).json({ ok: false, error: 'Ungültiger Tabellenname.' });
    const limit  = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 500);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    // Only select the fields defined in the template
    const fieldKeys = form.fields.map(f => f.key).filter(k => safeName(k));
    // Also try to get the primary key
    const [cols] = await pool.query(`DESCRIBE \`${table}\``);
    const pk = (cols.find(c => c.Key === 'PRI') || {}).Field || null;
    const selectCols = pk && !fieldKeys.includes(pk) ? [pk, ...fieldKeys] : fieldKeys;
    const colList = selectCols.map(k => `\`${k}\``).join(', ');
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
    const [rows] = await pool.query(`SELECT ${colList} FROM \`${table}\` LIMIT ? OFFSET ?`, [limit, offset]);
    res.json({ ok: true, pk, rows, total, limit, offset });
  } catch (err) {
    logger.error(err, 'forms: read rows failed');
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Insert row ───────────────────────────────────────────────────────────────
router.post('/:slug/rows', async (req, res) => {
  try {
    const { form, denied } = await loadForm(req.params.slug, req.user);
    if (denied) return res.status(403).json({ ok: false, error: 'Kein Zugriff.' });
    if (!form) return res.status(404).json({ ok: false, error: 'Formular nicht gefunden.' });
    const table = safeName(form.table_name);
    if (!table) return res.status(400).json({ ok: false, error: 'Ungültiger Tabellenname.' });
    const data = req.body && req.body.data;
    if (!data || typeof data !== 'object') return res.status(400).json({ ok: false, error: 'data-Objekt fehlt.' });
    // Only allow fields that are in the template
    const allowed = new Set(form.fields.map(f => f.key));
    const keys = Object.keys(data).filter(k => allowed.has(k) && safeName(k));
    // Validate required fields
    for (const f of form.fields) {
      if (f.required && (!data[f.key] || String(data[f.key]).trim() === '')) {
        return res.status(400).json({ ok: false, error: `Feld "${f.label || f.key}" ist Pflicht.` });
      }
    }
    if (!keys.length) return res.status(400).json({ ok: false, error: 'Keine gültigen Felder.' });
    const placeholders = keys.map(() => '?').join(', ');
    const colList = keys.map(k => `\`${k}\``).join(', ');
    const vals = keys.map(k => data[k] === '' ? null : data[k]);
    const [result] = await pool.query(`INSERT INTO \`${table}\` (${colList}) VALUES (${placeholders})`, vals);
    logger.info({ form: form.slug, insertId: result.insertId, userId: req.user && req.user.id }, 'forms: row inserted');
    res.json({ ok: true, insertId: result.insertId });
  } catch (err) {
    logger.error(err, 'forms: insert failed');
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Update row ───────────────────────────────────────────────────────────────
router.put('/:slug/rows/:id', async (req, res) => {
  try {
    const { form, denied } = await loadForm(req.params.slug, req.user);
    if (denied) return res.status(403).json({ ok: false, error: 'Kein Zugriff.' });
    if (!form) return res.status(404).json({ ok: false, error: 'Formular nicht gefunden.' });
    const table = safeName(form.table_name);
    if (!table) return res.status(400).json({ ok: false, error: 'Ungültiger Tabellenname.' });
    const data = req.body && req.body.data;
    if (!data || typeof data !== 'object') return res.status(400).json({ ok: false, error: 'data-Objekt fehlt.' });
    // Find primary key
    const [cols] = await pool.query(`DESCRIBE \`${table}\``);
    const pk = (cols.find(c => c.Key === 'PRI') || {}).Field;
    if (!pk) return res.status(400).json({ ok: false, error: 'Tabelle hat keinen Primärschlüssel.' });
    const allowed = new Set(form.fields.map(f => f.key));
    const keys = Object.keys(data).filter(k => allowed.has(k) && safeName(k));
    if (!keys.length) return res.status(400).json({ ok: false, error: 'Keine gültigen Felder.' });
    const sets = keys.map(k => `\`${k}\` = ?`).join(', ');
    const vals = keys.map(k => data[k] === '' ? null : data[k]);
    vals.push(req.params.id);
    await pool.query(`UPDATE \`${table}\` SET ${sets} WHERE \`${pk}\` = ? LIMIT 1`, vals);
    logger.info({ form: form.slug, id: req.params.id, userId: req.user && req.user.id }, 'forms: row updated');
    res.json({ ok: true });
  } catch (err) {
    logger.error(err, 'forms: update failed');
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Delete row ───────────────────────────────────────────────────────────────
router.delete('/:slug/rows/:id', async (req, res) => {
  try {
    const { form, denied } = await loadForm(req.params.slug, req.user);
    if (denied) return res.status(403).json({ ok: false, error: 'Kein Zugriff.' });
    if (!form) return res.status(404).json({ ok: false, error: 'Formular nicht gefunden.' });
    const table = safeName(form.table_name);
    if (!table) return res.status(400).json({ ok: false, error: 'Ungültiger Tabellenname.' });
    const [cols] = await pool.query(`DESCRIBE \`${table}\``);
    const pk = (cols.find(c => c.Key === 'PRI') || {}).Field;
    if (!pk) return res.status(400).json({ ok: false, error: 'Tabelle hat keinen Primärschlüssel.' });
    await pool.query(`DELETE FROM \`${table}\` WHERE \`${pk}\` = ? LIMIT 1`, [req.params.id]);
    logger.info({ form: form.slug, id: req.params.id, userId: req.user && req.user.id }, 'forms: row deleted');
    res.json({ ok: true });
  } catch (err) {
    logger.error(err, 'forms: delete failed');
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
