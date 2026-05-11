'use strict';
/**
 * DB-Admin API: raw table explorer for dbadmin+ users.
 *
 * ⚠️ SECURITY: This gives dbadmin users direct read/write access to ALL
 * database tables (including users, pages, site_settings). The intent is a
 * power-user tool for a trusted internal admin. Do NOT expose to untrusted
 * users. The route is gated by requireRole('dbadmin') in server.js.
 *
 * Endpoints:
 *   GET    /tables                 — list all tables
 *   GET    /tables/:name/schema    — DESCRIBE table
 *   GET    /tables/:name/rows      — paginated SELECT *
 *   POST   /tables/:name/rows      — INSERT row
 *   PUT    /tables/:name/rows/:id  — UPDATE row by primary key
 *   DELETE /tables/:name/rows/:id  — DELETE row by primary key
 */
const express = require('express');
const { pool } = require('../db/connection');
const logger   = require('../lib/logger');

const router = express.Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Validate that a table name is a safe SQL identifier (alphanumeric + underscore). */
function safeName(name) {
  if (!name || !/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/.test(name)) return null;
  return name;
}

// ── List tables ──────────────────────────────────────────────────────────────
router.get('/tables', async (req, res) => {
  try {
    const [rows] = await pool.query('SHOW TABLES');
    const key = Object.keys(rows[0] || {})[0];
    const tables = rows.map(r => r[key]);
    res.json({ ok: true, tables });
  } catch (err) {
    logger.error(err, 'dbadmin: list tables failed');
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Describe table ───────────────────────────────────────────────────────────
router.get('/tables/:name/schema', async (req, res) => {
  const table = safeName(req.params.name);
  if (!table) return res.status(400).json({ ok: false, error: 'Ungültiger Tabellenname.' });
  try {
    const [cols] = await pool.query(`DESCRIBE \`${table}\``);
    res.json({ ok: true, table, columns: cols });
  } catch (err) {
    logger.error(err, 'dbadmin: describe failed');
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Select rows (paginated) ─────────────────────────────────────────────────
router.get('/tables/:name/rows', async (req, res) => {
  const table = safeName(req.params.name);
  if (!table) return res.status(400).json({ ok: false, error: 'Ungültiger Tabellenname.' });
  const limit  = Math.min(Math.max(parseInt(req.query.limit)  || 50, 1), 500);
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);
  const search = (req.query.search || '').trim();
  try {
    // Get primary key for reference
    const [cols] = await pool.query(`DESCRIBE \`${table}\``);
    const pk = (cols.find(c => c.Key === 'PRI') || {}).Field || null;

    let where = '';
    const params = [];
    if (search) {
      // Search across all varchar/text columns
      const searchCols = cols.filter(c => /char|text|varchar/i.test(c.Type));
      if (searchCols.length) {
        where = ' WHERE ' + searchCols.map(c => `\`${c.Field}\` LIKE ?`).join(' OR ');
        searchCols.forEach(() => params.push(`%${search}%`));
      }
    }

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM \`${table}\`${where}`, params);
    const [rows] = await pool.query(
      `SELECT * FROM \`${table}\`${where} LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json({ ok: true, table, pk, columns: cols, rows, total, limit, offset });
  } catch (err) {
    logger.error(err, 'dbadmin: select rows failed');
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Insert row ───────────────────────────────────────────────────────────────
router.post('/tables/:name/rows', async (req, res) => {
  const table = safeName(req.params.name);
  if (!table) return res.status(400).json({ ok: false, error: 'Ungültiger Tabellenname.' });
  const data = req.body && req.body.data;
  if (!data || typeof data !== 'object') return res.status(400).json({ ok: false, error: 'data-Objekt fehlt.' });
  try {
    const keys = Object.keys(data).filter(k => safeName(k));
    if (!keys.length) return res.status(400).json({ ok: false, error: 'Keine gültigen Felder.' });
    const placeholders = keys.map(() => '?').join(', ');
    const cols = keys.map(k => `\`${k}\``).join(', ');
    const vals = keys.map(k => data[k] === '' ? null : data[k]);
    const [result] = await pool.query(`INSERT INTO \`${table}\` (${cols}) VALUES (${placeholders})`, vals);
    logger.info({ table, insertId: result.insertId, userId: req.user.id }, 'dbadmin: row inserted');
    res.json({ ok: true, insertId: result.insertId });
  } catch (err) {
    logger.error(err, 'dbadmin: insert failed');
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Update row ───────────────────────────────────────────────────────────────
router.put('/tables/:name/rows/:id', async (req, res) => {
  const table = safeName(req.params.name);
  if (!table) return res.status(400).json({ ok: false, error: 'Ungültiger Tabellenname.' });
  const data = req.body && req.body.data;
  const pkCol = req.body && req.body.pk;
  if (!data || typeof data !== 'object') return res.status(400).json({ ok: false, error: 'data-Objekt fehlt.' });
  if (!safeName(pkCol)) return res.status(400).json({ ok: false, error: 'pk fehlt.' });
  try {
    const keys = Object.keys(data).filter(k => safeName(k));
    if (!keys.length) return res.status(400).json({ ok: false, error: 'Keine gültigen Felder.' });
    const sets = keys.map(k => `\`${k}\` = ?`).join(', ');
    const vals = keys.map(k => data[k] === '' ? null : data[k]);
    vals.push(req.params.id);
    await pool.query(`UPDATE \`${table}\` SET ${sets} WHERE \`${pkCol}\` = ? LIMIT 1`, vals);
    logger.info({ table, pk: pkCol, id: req.params.id, userId: req.user.id }, 'dbadmin: row updated');
    res.json({ ok: true });
  } catch (err) {
    logger.error(err, 'dbadmin: update failed');
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Delete row ───────────────────────────────────────────────────────────────
router.delete('/tables/:name/rows/:id', async (req, res) => {
  const table = safeName(req.params.name);
  if (!table) return res.status(400).json({ ok: false, error: 'Ungültiger Tabellenname.' });
  const pkCol = req.query.pk;
  if (!safeName(pkCol)) return res.status(400).json({ ok: false, error: 'pk Query-Parameter fehlt.' });
  try {
    await pool.query(`DELETE FROM \`${table}\` WHERE \`${pkCol}\` = ? LIMIT 1`, [req.params.id]);
    logger.info({ table, pk: pkCol, id: req.params.id, userId: req.user.id }, 'dbadmin: row deleted');
    res.json({ ok: true });
  } catch (err) {
    logger.error(err, 'dbadmin: delete failed');
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// Form Templates CRUD
// ══════════════════════════════════════════════════════════════════════════════

const VALID_ACCESS_LEVELS = ['public', 'member', 'webadmin', 'dbadmin'];

// ── List all form templates ─────────────────────────────────────────────────
router.get('/forms', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, slug, title, description, table_name, access_level, created_at, updated_at FROM form_templates ORDER BY title'
    );
    res.json({ ok: true, forms: rows });
  } catch (err) {
    logger.error(err, 'dbadmin: list forms failed');
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Get single form template ────────────────────────────────────────────────
router.get('/forms/:slug', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM form_templates WHERE slug = ?', [req.params.slug]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Formular nicht gefunden.' });
    const form = rows[0];
    form.fields = typeof form.fields_json === 'string' ? JSON.parse(form.fields_json) : form.fields_json;
    res.json({ ok: true, form });
  } catch (err) {
    logger.error(err, 'dbadmin: get form failed');
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Create form template ────────────────────────────────────────────────────
router.post('/forms', async (req, res) => {
  const { slug, title, description, table_name, fields, access_level } = req.body || {};
  if (!slug || !title || !table_name || !Array.isArray(fields) || !fields.length) {
    return res.status(400).json({ ok: false, error: 'slug, title, table_name und fields[] sind Pflicht.' });
  }
  if (!safeName(slug)) return res.status(400).json({ ok: false, error: 'Ungültiger Slug (nur a-z, 0-9, _).' });
  const level = VALID_ACCESS_LEVELS.includes(access_level) ? access_level : 'dbadmin';
  try {
    const [result] = await pool.query(
      `INSERT INTO form_templates (slug, title, description, table_name, fields_json, access_level, created_by)
       VALUES (?, ?, ?, ?, CAST(? AS JSON), ?, ?)`,
      [slug, title, description || '', table_name, JSON.stringify(fields), level, req.user.id]
    );
    logger.info({ slug, userId: req.user.id }, 'dbadmin: form created');
    res.json({ ok: true, id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ ok: false, error: 'Slug existiert bereits.' });
    logger.error(err, 'dbadmin: create form failed');
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Update form template ────────────────────────────────────────────────────
router.put('/forms/:slug', async (req, res) => {
  const { title, description, table_name, fields, access_level } = req.body || {};
  if (!title || !table_name || !Array.isArray(fields) || !fields.length) {
    return res.status(400).json({ ok: false, error: 'title, table_name und fields[] sind Pflicht.' });
  }
  const level = VALID_ACCESS_LEVELS.includes(access_level) ? access_level : 'dbadmin';
  try {
    const [result] = await pool.query(
      `UPDATE form_templates SET title = ?, description = ?, table_name = ?, fields_json = CAST(? AS JSON), access_level = ?
       WHERE slug = ?`,
      [title, description || '', table_name, JSON.stringify(fields), level, req.params.slug]
    );
    if (!result.affectedRows) return res.status(404).json({ ok: false, error: 'Formular nicht gefunden.' });
    logger.info({ slug: req.params.slug, userId: req.user.id }, 'dbadmin: form updated');
    res.json({ ok: true });
  } catch (err) {
    logger.error(err, 'dbadmin: update form failed');
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Delete form template ────────────────────────────────────────────────────
router.delete('/forms/:slug', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM form_templates WHERE slug = ?', [req.params.slug]);
    if (!result.affectedRows) return res.status(404).json({ ok: false, error: 'Formular nicht gefunden.' });
    logger.info({ slug: req.params.slug, userId: req.user.id }, 'dbadmin: form deleted');
    res.json({ ok: true });
  } catch (err) {
    logger.error(err, 'dbadmin: delete form failed');
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
