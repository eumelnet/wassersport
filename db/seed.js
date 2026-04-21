'use strict';
/**
 * Seeds the database with:
 *   - demo user (role=member)
 *   - admin user (role=admin)
 *   - site_settings: navigation, footer, branding
 *   - pages: home, mitglieder, impressum (as block structures)
 *
 * Run once after first `docker compose up`:
 *   docker compose exec app node db/seed.js
 */
require('dotenv').config();
const bcrypt        = require('bcrypt');
const logger        = require('../lib/logger');
const { pool }      = require('./connection');

// ── Default site settings ────────────────────────────────────────────────────
const DEFAULT_NAV = [
  { label: 'Startseite',   href: '/' },
  { label: 'Aktivitäten',  href: '/#activities' },
  { label: 'Über uns',     href: '/#about' },
  { label: 'Kalender',     href: '/#kalender' },
];

const DEFAULT_FOOTER_NAV = [
  { label: 'Über uns',    href: '/#about' },
  { label: 'Aktivitäten', href: '/#activities' },
  { label: 'Kalender',    href: '/#kalender' },
  { label: 'Impressum',   href: '/impressum' },
];

const DEFAULT_BRANDING = {
  site_name:   'Havelkanal Wassersport',
  logo_url:    '/logo.png',
  footer_note: '© Havelkanal Wassersport',
};

// ── Default page: home ───────────────────────────────────────────────────────
const HOME_BLOCKS = [
  {
    type: 'banner',
    data: {
      label: 'Hafenmeister Ankündigungen:',
      source: 'captain',  // pulled from data/captain.txt
    },
  },
  {
    type: 'hero',
    data: {
      image_url:   '/havelkanal-winter.png',
      image_alt:   'Grüner Kanal mit Booten und Paddlern',
      headline:    'Sport, Spass und <span class="accent">grün</span> am Havelkanal.',
      subheadline: 'Wähle Deinen Sport: Motorboot, Paddeln, Drachenboot, SUP. Klares Wasser, freundliche Menschen und einfach teilzunehmen.',
      cta_primary: { label: 'Kalender', href: '#kalender' },
      cta_ghost:   { label: 'Aktivitäten erkunden', href: '#activities' },
      interactive_ripples: true,
    },
  },
  {
    type: 'boats',
    data: {
      anchor: 'activities',
      headline: 'Wähle Deinen Sport',
      subheadline: 'Allein, im Team, im Verein.',
      items: [
        { image_url: '/motorboat.png', image_alt: 'Motorboot', title: 'Motorboot',
          text: 'Bring Dein Motorboot und Motoryacht zum neuen Heimathafen.',
          meta: ['Bis zu 12 Meter', 'Bis zu 1 Boot'],
          cta: { label: 'Zum Bereich Motorboot', href: '#kalender' } },
        { image_url: '/paddleboat.png', image_alt: 'Paddelboot', title: 'Paddeln',
          text: 'Entspanntes Paddeln auf dem Havelkanal mit eigenem Boot.',
          meta: ['1er, 2er, 3er', 'Bis zu 1 Boot'],
          cta: { label: 'Zum Bereich Paddeln', href: '#kalender' } },
        { image_url: '/rowing.png', image_alt: 'Drachenboot', title: 'Drachenboot',
          text: 'Sportlicher Wettkampf auf dem Havelkanal.',
          meta: ['10-16 Personen', '4 Boote'],
          cta: { label: 'Zum Bereich Drachenboot', href: '#kalender' } },
        { image_url: '/sup.png', image_alt: 'SUP', title: 'Stand-up Paddeln',
          text: 'Allein auf dem Wasser schweben.',
          meta: ['Solo', '1 SUP'],
          cta: { label: 'Zum Bereich SUP', href: '#kalender' } },
      ],
    },
  },
  {
    type: 'richtext',
    data: {
      anchor: 'about',
      html: `<h2>Warum Havelkanal?</h2>
<ul>
<li>Klares, sauberes Wasser</li>
<li>Ruhiges Gewässer, wenig Schiffsverkehr</li>
<li>Gute Anbindung zur Havel und nach Berlin</li>
<li>Konstante Wassertiefe, wenig Strömung</li>
</ul>`,
    },
  },
  {
    type: 'events',
    data: {
      anchor: 'kalender',
      headline: 'Veranstaltungskalender',
      subheadline: 'Alle Termine auf einen Blick.',
    },
  },
];

// ── Default page: mitglieder (protected) ─────────────────────────────────────
const MEMBERS_BLOCKS = [
  {
    type: 'richtext',
    data: {
      html: `<h1>Mitgliederbereich</h1>
<p>Willkommen im geschlossenen Bereich. Hier findest Du die Mitgliederliste sowie interne Dokumente.</p>`,
    },
  },
  {
    type: 'members_table',
    data: {},
  },
];

const IMPRESSUM_BLOCKS = [
  {
    type: 'richtext',
    data: {
      html: `<h1>Impressum</h1>
<p>Angaben gemäß § 5 TMG.</p>
<p><em>Dieser Text kann über den Admin-Bereich bearbeitet werden.</em></p>`,
    },
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
async function upsertUser(conn, { username, email, password, role }) {
  const hash = await bcrypt.hash(password, 10);
  await conn.query(
    `INSERT INTO users (username, email, password_hash, role)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE role = VALUES(role)`,
    [username, email, hash, role]
  );
}

async function upsertPage(conn, { slug, title, requires_auth, is_listed, blocks }) {
  await conn.query(
    `INSERT INTO pages (slug, title, requires_auth, is_listed, blocks_json)
     VALUES (?, ?, ?, ?, CAST(? AS JSON))
     ON DUPLICATE KEY UPDATE
       title             = VALUES(title),
       requires_auth     = VALUES(requires_auth),
       is_listed         = VALUES(is_listed),
       blocks_json       = VALUES(blocks_json),
       draft_blocks_json = NULL,
       draft_title       = NULL,
       draft_updated_at  = NULL`,
    [slug, title, requires_auth ? 1 : 0, is_listed ? 1 : 0, JSON.stringify(blocks)]
  );
}

async function upsertSetting(conn, key, value) {
  await conn.query(
    `INSERT INTO site_settings (setting_key, value_json)
     VALUES (?, CAST(? AS JSON))
     ON DUPLICATE KEY UPDATE value_json = VALUES(value_json)`,
    [key, JSON.stringify(value)]
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  const conn = await pool.getConnection();
  try {
    // Users
    await upsertUser(conn, { username: 'demo',  email: 'demo@example.com',  password: 'demo1234',  role: 'member' });
    await upsertUser(conn, { username: 'admin', email: 'admin@example.com', password: 'admin1234', role: 'admin'  });
    logger.info('seed: users ready — demo/demo1234 (member), admin/admin1234 (admin)');

    // Site settings
    await upsertSetting(conn, 'nav',        DEFAULT_NAV);
    await upsertSetting(conn, 'footer_nav', DEFAULT_FOOTER_NAV);
    await upsertSetting(conn, 'branding',   DEFAULT_BRANDING);
    logger.info('seed: site_settings ready (nav, footer_nav, branding)');

    // Pages
    await upsertPage(conn, { slug: 'home',       title: 'Havelkanal Wassersport — Sport, Spass & Grün', requires_auth: false, is_listed: true,  blocks: HOME_BLOCKS });
    await upsertPage(conn, { slug: 'mitglieder', title: 'Mitgliederbereich',                            requires_auth: true,  is_listed: true,  blocks: MEMBERS_BLOCKS });
    await upsertPage(conn, { slug: 'impressum',  title: 'Impressum',                                    requires_auth: false, is_listed: false, blocks: IMPRESSUM_BLOCKS });
    logger.info('seed: pages ready — home, mitglieder, impressum');
  } finally {
    conn.release();
    await pool.end();
  }
})().catch((err) => {
  logger.error({ err }, 'seed: failed');
  process.exit(1);
});
