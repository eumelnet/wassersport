'use strict';
/**
 * Admin API: pages, media, site-settings management.
 * All endpoints require admin role; mounted under /api/admin by server.js.
 */
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const express = require('express');
const multer  = require('multer');
const sharp   = require('sharp');

const { pool }           = require('../db/connection');
const logger             = require('../lib/logger');
const { sanitizeBlocks } = require('../lib/sanitizer');
const { BLOCK_TYPES, THEME_FONTS, THEME_DEFAULTS } = require('../lib/cms-renderer');
const { invalidateSettingsCache } = require('./pages');

const router = express.Router();

// ── Current user info (role) for the admin SPA ───────────────────────────────
router.get('/me', (req, res) => {
  res.json({ ok: true, user: { id: req.user.id, username: req.user.username, role: req.user.role } });
});

// ── Upload handling ──────────────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, '..', 'data', 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter(req, file, cb) {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) return cb(null, true);
    cb(new Error('Nur Bildformate (JPEG, PNG, WEBP, GIF) sind erlaubt.'));
  },
});

// ── Block validation ─────────────────────────────────────────────────────────
const ALLOWED_BLOCK_TYPES = new Set(BLOCK_TYPES.map(b => b.type));

function validateBlocks(input) {
  if (!Array.isArray(input)) throw new Error('blocks muss ein Array sein.');
  for (const b of input) {
    if (!b || typeof b !== 'object' || !b.type) throw new Error('Jeder Block braucht ein "type"-Feld.');
    if (!ALLOWED_BLOCK_TYPES.has(b.type)) throw new Error(`Unbekannter Block-Typ: ${b.type}`);
  }
  return sanitizeBlocks(input);
}

// ── Pages: list / get / save / delete ────────────────────────────────────────
router.get('/pages', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT slug, title, draft_title, requires_auth, is_listed,
            published_at, draft_updated_at,
            (draft_blocks_json IS NOT NULL) AS has_draft
     FROM pages ORDER BY slug`
  );
  // MySQL returns has_draft as 0/1; normalise to boolean
  res.json({ ok: true, pages: rows.map(r => ({ ...r, has_draft: !!r.has_draft })) });
});

router.get('/pages/:slug', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT slug, title, draft_title, requires_auth, is_listed,
            blocks_json, draft_blocks_json,
            published_at, draft_updated_at
     FROM pages WHERE slug = ?`,
    [req.params.slug]
  );
  if (!rows[0]) return res.status(404).json({ ok: false, error: 'Seite nicht gefunden.' });
  const p = rows[0];
  // mysql2 returns JSON columns as parsed JS objects already
  p.blocks       = p.blocks_json;
  p.draft_blocks = p.draft_blocks_json;       // may be null
  p.has_draft    = p.draft_blocks !== null;
  delete p.blocks_json;
  delete p.draft_blocks_json;
  res.json({ ok: true, page: p });
});

/**
 * PUT /pages/:slug
 * Saves an autosave-style DRAFT. Does not publish.
 * If the page does not exist yet, it is created with the same content
 * as draft AND live (so the URL is reachable immediately).
 */
router.put('/pages/:slug', async (req, res) => {
  const slugRaw = req.params.slug;
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(slugRaw)) {
    return res.status(400).json({ ok: false, error: 'Slug muss klein, alphanumerisch, mit Bindestrichen sein.' });
  }
  const { title, requires_auth, is_listed, blocks } = req.body || {};
  if (!title || typeof title !== 'string') {
    return res.status(400).json({ ok: false, error: 'title ist erforderlich.' });
  }

  let cleanBlocks;
  try {
    cleanBlocks = validateBlocks(blocks);
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.query(
      'SELECT slug FROM pages WHERE slug = ?', [slugRaw]
    );

    if (!existing[0]) {
      // New page: create live + draft in one shot (same content)
      await conn.query(
        `INSERT INTO pages (slug, title, draft_title, requires_auth, is_listed,
                            blocks_json, draft_blocks_json,
                            published_at, draft_updated_at,
                            updated_by, draft_updated_by)
         VALUES (?, ?, ?, ?, ?, CAST(? AS JSON), CAST(? AS JSON), NOW(), NOW(), ?, ?)`,
        [slugRaw, title, title, requires_auth ? 1 : 0, is_listed ? 1 : 0,
         JSON.stringify(cleanBlocks), JSON.stringify(cleanBlocks),
         req.user.id, req.user.id]
      );
    } else {
      // Existing page: update draft only, keep live untouched
      // requires_auth / is_listed are page-level flags, not draft-level — update immediately
      await conn.query(
        `UPDATE pages
         SET draft_title       = ?,
             requires_auth     = ?,
             is_listed         = ?,
             draft_blocks_json = CAST(? AS JSON),
             draft_updated_at  = NOW(),
             draft_updated_by  = ?
         WHERE slug = ?`,
        [title, requires_auth ? 1 : 0, is_listed ? 1 : 0,
         JSON.stringify(cleanBlocks), req.user.id, slugRaw]
      );
    }

    await conn.commit();
    logger.info({ slug: slugRaw, userId: req.user.id }, 'cms: draft saved');
    res.json({ ok: true, mode: existing[0] ? 'draft' : 'created' });
  } catch (err) {
    await conn.rollback();
    logger.error({ err, slug: slugRaw }, 'cms: draft save failed');
    res.status(500).json({ ok: false, error: 'Speichern fehlgeschlagen.' });
  } finally {
    conn.release();
  }
});

/**
 * POST /pages/:slug/publish
 * Copies draft → live, snapshots previous live as a revision,
 * and prunes old revisions (keep most recent 50).
 */
router.post('/pages/:slug/publish', async (req, res) => {
  const slug = req.params.slug;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT title, draft_title, blocks_json, draft_blocks_json
       FROM pages WHERE slug = ?`,
      [slug]
    );
    if (!rows[0]) {
      await conn.rollback();
      return res.status(404).json({ ok: false, error: 'Seite nicht gefunden.' });
    }
    if (rows[0].draft_blocks_json === null) {
      await conn.rollback();
      return res.status(400).json({ ok: false, error: 'Kein Entwurf vorhanden.' });
    }

    // Snapshot currently-live as a revision (not the draft)
    await conn.query(
      `INSERT INTO page_revisions (slug, title, blocks_json, created_by)
       VALUES (?, ?, CAST(? AS JSON), ?)`,
      [slug, rows[0].title, JSON.stringify(rows[0].blocks_json), req.user.id]
    );

    // Prune: keep newest 50
    await conn.query(
      `DELETE FROM page_revisions
       WHERE slug = ?
         AND id NOT IN (
           SELECT id FROM (
             SELECT id FROM page_revisions WHERE slug = ?
             ORDER BY created_at DESC LIMIT 50
           ) t
         )`,
      [slug, slug]
    );

    // Promote draft → live
    await conn.query(
      `UPDATE pages
       SET title             = COALESCE(draft_title, title),
           blocks_json       = draft_blocks_json,
           published_at      = NOW(),
           updated_by        = ?,
           draft_blocks_json = NULL,
           draft_title       = NULL,
           draft_updated_at  = NULL,
           draft_updated_by  = NULL
       WHERE slug = ?`,
      [req.user.id, slug]
    );

    await conn.commit();
    logger.info({ slug, userId: req.user.id }, 'cms: page published');
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    logger.error({ err, slug }, 'cms: publish failed');
    res.status(500).json({ ok: false, error: 'Veröffentlichen fehlgeschlagen.' });
  } finally {
    conn.release();
  }
});

/**
 * POST /pages/:slug/discard-draft
 * Throws away the pending draft, keeps live untouched.
 */
router.post('/pages/:slug/discard-draft', async (req, res) => {
  const [r] = await pool.query(
    `UPDATE pages
     SET draft_blocks_json = NULL,
         draft_title       = NULL,
         draft_updated_at  = NULL,
         draft_updated_by  = NULL
     WHERE slug = ?`,
    [req.params.slug]
  );
  if (!r.affectedRows) return res.status(404).json({ ok: false, error: 'Seite nicht gefunden.' });
  logger.info({ slug: req.params.slug, userId: req.user.id }, 'cms: draft discarded');
  res.json({ ok: true });
});

router.delete('/pages/:slug', async (req, res) => {
  if (['home', 'mitglieder'].includes(req.params.slug)) {
    return res.status(400).json({ ok: false, error: 'Kern-Seiten können nicht gelöscht werden.' });
  }
  await pool.query('DELETE FROM pages WHERE slug = ?', [req.params.slug]);
  logger.info({ slug: req.params.slug, userId: req.user.id }, 'cms: page deleted');
  res.json({ ok: true });
});

/**
 * POST /pages/:slug/duplicate  { new_slug, new_title? }
 * Copies the LIVE version (title + blocks_json) of the source page to a new
 * slug. The copy is created as both live and draft (no pending draft),
 * mirroring how PUT /pages/:slug handles new-page creation.
 * `is_listed` and `requires_auth` are carried over.
 */
router.post('/pages/:slug/duplicate', async (req, res) => {
  const srcSlug = req.params.slug;
  const newSlug = (req.body && typeof req.body.new_slug === 'string') ? req.body.new_slug.trim().toLowerCase() : '';
  const newTitle = (req.body && typeof req.body.new_title === 'string') ? req.body.new_title.trim() : '';

  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(newSlug)) {
    return res.status(400).json({ ok: false, error: 'Neuer Slug muss klein, alphanumerisch, mit Bindestrichen sein.' });
  }
  if (newSlug === srcSlug) {
    return res.status(400).json({ ok: false, error: 'Neuer Slug muss sich vom Original unterscheiden.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [src] = await conn.query(
      'SELECT title, requires_auth, is_listed, blocks_json FROM pages WHERE slug = ?',
      [srcSlug]
    );
    if (!src[0]) {
      await conn.rollback();
      return res.status(404).json({ ok: false, error: 'Quellseite nicht gefunden.' });
    }

    const [existing] = await conn.query('SELECT slug FROM pages WHERE slug = ?', [newSlug]);
    if (existing[0]) {
      await conn.rollback();
      return res.status(409).json({ ok: false, error: 'Ein Seite mit diesem Slug existiert bereits.' });
    }

    const title = newTitle || `${src[0].title} (Kopie)`;
    await conn.query(
      `INSERT INTO pages (slug, title, draft_title, requires_auth, is_listed,
                          blocks_json, draft_blocks_json,
                          published_at, draft_updated_at,
                          updated_by, draft_updated_by)
       VALUES (?, ?, NULL, ?, ?, CAST(? AS JSON), NULL, NOW(), NULL, ?, NULL)`,
      [newSlug, title, src[0].requires_auth, src[0].is_listed,
       JSON.stringify(src[0].blocks_json), req.user.id]
    );

    await conn.commit();
    logger.info({ srcSlug, newSlug, userId: req.user.id }, 'cms: page duplicated');
    res.json({ ok: true, slug: newSlug });
  } catch (err) {
    await conn.rollback();
    logger.error({ err, srcSlug, newSlug }, 'cms: duplicate failed');
    res.status(500).json({ ok: false, error: 'Duplizieren fehlgeschlagen.' });
  } finally {
    conn.release();
  }
});

// Revisions
router.get('/pages/:slug/revisions', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT r.id, r.title, r.created_at, r.created_by, u.username AS created_by_name
     FROM page_revisions r
     LEFT JOIN users u ON u.id = r.created_by
     WHERE r.slug = ? ORDER BY r.created_at DESC LIMIT 50`,
    [req.params.slug]
  );
  res.json({ ok: true, revisions: rows });
});

router.get('/pages/:slug/revisions/:id', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, slug, title, blocks_json, created_at FROM page_revisions WHERE id = ? AND slug = ?',
    [req.params.id, req.params.slug]
  );
  if (!rows[0]) return res.status(404).json({ ok: false, error: 'Revision nicht gefunden.' });
  const r = rows[0];
  r.blocks = r.blocks_json; delete r.blocks_json;
  res.json({ ok: true, revision: r });
});

/**
 * Restoring a revision stages it as a DRAFT so the admin can review
 * before publishing. The current live version remains until publish.
 */
router.post('/pages/:slug/revisions/:id/restore', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT title, blocks_json FROM page_revisions WHERE id = ? AND slug = ?',
    [req.params.id, req.params.slug]
  );
  if (!rows[0]) return res.status(404).json({ ok: false, error: 'Revision nicht gefunden.' });

  await pool.query(
    `UPDATE pages
     SET draft_title       = ?,
         draft_blocks_json = CAST(? AS JSON),
         draft_updated_at  = NOW(),
         draft_updated_by  = ?
     WHERE slug = ?`,
    [rows[0].title, JSON.stringify(rows[0].blocks_json), req.user.id, req.params.slug]
  );
  logger.info({ slug: req.params.slug, revId: req.params.id, userId: req.user.id }, 'cms: revision restored to draft');
  res.json({ ok: true });
});

// ── Media: upload / list / delete ────────────────────────────────────────────
router.post('/media', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'Keine Datei hochgeladen.' });

  try {
    const img = sharp(req.file.buffer, { failOn: 'error' });
    const meta = await img.metadata();

    // Generate a safe unique filename
    const id   = crypto.randomBytes(8).toString('hex');
    const ext  = meta.format === 'jpeg' ? 'jpg' : (meta.format || 'bin');
    const base = `${Date.now()}-${id}`;

    // Original (re-encoded to strip EXIF)
    const outFull = path.join(UPLOADS_DIR, `${base}.${ext}`);
    await img.clone().rotate().toFile(outFull);

    // Thumbnails (only if source is larger)
    const variants = [];
    for (const w of [400, 800, 1600]) {
      if ((meta.width || 0) > w) {
        const fn = `${base}-${w}.${ext}`;
        await img.clone().rotate().resize({ width: w, withoutEnlargement: true }).toFile(path.join(UPLOADS_DIR, fn));
        variants.push({ width: w, filename: fn });
      }
    }

    const filename = `${base}.${ext}`;
    const [result] = await pool.query(
      `INSERT INTO media (filename, orig_name, mime, width, height, bytes, alt, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [filename, req.file.originalname, req.file.mimetype, meta.width || null, meta.height || null,
       req.file.size, req.body.alt || null, req.user.id]
    );

    logger.info({ filename, userId: req.user.id }, 'cms: media uploaded');
    res.json({
      ok: true,
      media: {
        id: result.insertId,
        filename,
        url: `/uploads/${filename}`,
        width: meta.width, height: meta.height,
        variants,
      },
    });
  } catch (err) {
    logger.error({ err }, 'cms: upload failed');
    res.status(400).json({ ok: false, error: 'Bild konnte nicht verarbeitet werden: ' + err.message });
  }
});

router.get('/media', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, filename, orig_name, mime, width, height, bytes, alt, created_at FROM media ORDER BY created_at DESC LIMIT 200'
  );
  res.json({
    ok: true,
    media: rows.map(r => ({ ...r, url: `/uploads/${r.filename}` })),
  });
});

router.patch('/media/:id', async (req, res) => {
  const alt = (req.body && typeof req.body.alt === 'string') ? req.body.alt.slice(0, 255) : null;
  if (alt == null) return res.status(400).json({ ok: false, error: 'alt erforderlich.' });
  const [r] = await pool.query('UPDATE media SET alt = ? WHERE id = ?', [alt, req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ ok: false, error: 'Nicht gefunden.' });
  res.json({ ok: true });
});

router.delete('/media/:id', async (req, res) => {
  const [rows] = await pool.query('SELECT filename FROM media WHERE id = ?', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ ok: false, error: 'Nicht gefunden.' });
  const fn = rows[0].filename;
  await pool.query('DELETE FROM media WHERE id = ?', [req.params.id]);
  // Best-effort delete of files
  try {
    const base = path.parse(fn).name;
    const ext  = path.parse(fn).ext;
    for (const f of fs.readdirSync(UPLOADS_DIR)) {
      if (f === fn || f.startsWith(base + '-') && f.endsWith(ext)) {
        fs.unlinkSync(path.join(UPLOADS_DIR, f));
      }
    }
  } catch (e) { logger.warn({ err: e }, 'media: file cleanup failed'); }
  res.json({ ok: true });
});

// ── Site settings (nav, footer, branding) ────────────────────────────────────
router.get('/settings', async (req, res) => {
  const [rows] = await pool.query('SELECT setting_key, value_json FROM site_settings');
  const out = {};
  for (const r of rows) out[r.setting_key] = r.value_json;
  res.json({ ok: true, settings: out });
});

router.put('/settings/:key', async (req, res) => {
  const allowed = ['nav', 'footer_nav', 'branding'];
  if (!allowed.includes(req.params.key)) {
    return res.status(400).json({ ok: false, error: 'Unbekannter Settings-Schlüssel.' });
  }
  const value = req.body && req.body.value;
  if (value == null) return res.status(400).json({ ok: false, error: 'value fehlt.' });

  await pool.query(
    `INSERT INTO site_settings (setting_key, value_json)
     VALUES (?, CAST(? AS JSON))
     ON DUPLICATE KEY UPDATE value_json = VALUES(value_json)`,
    [req.params.key, JSON.stringify(value)]
  );
  invalidateSettingsCache();
  logger.info({ key: req.params.key, userId: req.user.id }, 'cms: setting updated');
  res.json({ ok: true });
});

// Expose block-type registry to the admin UI
router.get('/block-types', (req, res) => {
  res.json({ ok: true, types: BLOCK_TYPES });
});

// Expose theme options (font list + defaults) to the admin UI
router.get('/theme-options', (req, res) => {
  res.json({ ok: true, fonts: Object.keys(THEME_FONTS), defaults: THEME_DEFAULTS });
});

module.exports = router;
