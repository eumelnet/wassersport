'use strict';
/**
 * Public page delivery: fetches pages from DB and renders them via the
 * CMS renderer. Handles:
 *   GET /           → page with slug 'home'
 *   GET /:slug      → any page (respects requires_auth)
 *
 * Static assets (CSS, images, calendar.js, etc.) are still served by the
 * express.static middleware in server.js.
 */
const express = require('express');
const { pool } = require('../db/connection');
const logger   = require('../lib/logger');
const { renderBlocks, renderLayout, pageFeatures } = require('../lib/cms-renderer');

const router = express.Router();

// Cache settings briefly to avoid hitting DB on every request
const SETTINGS_CACHE_MS = 30 * 1000;
let settingsCache = { at: 0, data: null };

async function getSettings() {
  if (settingsCache.data && (Date.now() - settingsCache.at) < SETTINGS_CACHE_MS) {
    return settingsCache.data;
  }
  const [rows] = await pool.query('SELECT setting_key, value_json FROM site_settings');
  const out = { nav: [], footer_nav: [], branding: {} };
  for (const r of rows) out[r.setting_key] = r.value_json;
  settingsCache = { at: Date.now(), data: out };
  return out;
}

function invalidateSettingsCache() { settingsCache = { at: 0, data: null }; }

async function renderPageBySlug(req, res, slug, { preview } = {}) {
  let page;
  try {
    const [rows] = await pool.query(
      `SELECT slug, title, draft_title, requires_auth, is_listed,
              blocks_json, draft_blocks_json
       FROM pages WHERE slug = ?`,
      [slug]
    );
    page = rows[0];
  } catch (err) {
    logger.error({ err, slug }, 'cms: failed to load page');
    return res.status(500).send('Interner Fehler.');
  }

  if (!page) return res.status(404).send('Seite nicht gefunden.');

  if (page.requires_auth && !req.user) {
    return res.redirect('/login.html');
  }

  // Preview mode: use draft if available, otherwise fall back to live
  const blocks = preview && page.draft_blocks_json ? page.draft_blocks_json : page.blocks_json;
  const title  = preview && page.draft_title      ? page.draft_title      : page.title;

  const settings = await getSettings();
  const feat = pageFeatures(blocks);
  const body = renderBlocks(blocks);

  let previewBanner = '';
  if (preview) {
    previewBanner = `<div style="position:fixed;top:0;left:0;right:0;z-index:9999;background:#ffa500;color:#000;padding:.4rem 1rem;text-align:center;font-family:sans-serif;font-weight:600;box-shadow:0 2px 4px rgba(0,0,0,.2)">
🔍 Vorschau-Modus — Entwurf (nicht veröffentlicht) ·
<a href="/admin#pages/${encodeURIComponent(slug)}" style="color:#000">zurück zum Editor</a> ·
<a href="/${slug === 'home' ? '' : encodeURIComponent(slug)}" style="color:#000">Live-Version ansehen</a>
</div><div style="height:2.5rem"></div>`;
  }

  const html = renderLayout({
    title:     preview ? `[Vorschau] ${title}` : title,
    body:      previewBanner + body,
    nav:       settings.nav || [],
    footerNav: settings.footer_nav || [],
    branding:  settings.branding || {},
    user:      req.user || null,
    ...feat,
  });

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

router.get('/', (req, res) => renderPageBySlug(req, res, 'home'));

// Match /<slug> but skip known static / API paths
router.get('/:slug', (req, res, next) => {
  const slug = req.params.slug;
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(slug)) return next();
  // Reserved prefixes are handled by other routers before us
  return renderPageBySlug(req, res, slug);
});

module.exports = { router, invalidateSettingsCache, renderPageBySlug };
