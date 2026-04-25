'use strict';
/**
 * Server-side renderer for CMS pages.
 *
 * A page is a list of blocks. Each block has a `type` and `data`.
 * This module exports:
 *   - renderBlocks(blocks)  → HTML string (concatenation of per-block renders)
 *   - renderLayout({ title, body, nav, footerNav, branding, user }) → full HTML doc
 *   - BLOCK_TYPES           → list of supported block type descriptors (for admin UI)
 *
 * Adding a new block type:
 *   1. add an entry to BLOCK_TYPES with `fields` describing the editor form
 *   2. add a case in renderBlock() below
 */

const fs   = require('fs');
const path = require('path');

const { escapeHtml, attr } = require('./html-utils');

// Path on disk where uploads + sharp-generated thumbnails live. Mirrors the
// constant in routes/admin.js (kept local to avoid a circular import).
const UPLOADS_DIR = path.join(__dirname, '..', 'data', 'uploads');
const THUMB_WIDTHS = [400, 800, 1600];

// Given a URL like "/uploads/1737-foo.jpg" return:
//   { src, srcset, full }
// where:
//   - `full`   = the original URL (used as the lightbox target)
//   - `srcset` = comma-list of <thumb-url> <width>w  (only existing thumbs)
//   - `src`    = a sane default (the 800px thumb if present, else the original)
// For URLs that don't follow our /uploads/ pattern (external CDN, legacy data,
// CKEditor-inserted images, etc.) we fall back to {src: url, srcset:'', full:url}
// so the renderer never breaks.
function imageVariants(url) {
  const empty = { src: url || '', srcset: '', full: url || '' };
  if (!url || typeof url !== 'string') return empty;
  if (!url.startsWith('/uploads/')) return empty;

  const filename = url.slice('/uploads/'.length);
  const dot = filename.lastIndexOf('.');
  if (dot < 1) return empty;
  const base = filename.slice(0, dot);
  const ext  = filename.slice(dot); // includes leading "."

  const variants = [];
  for (const w of THUMB_WIDTHS) {
    const fn = `${base}-${w}${ext}`;
    try {
      if (fs.existsSync(path.join(UPLOADS_DIR, fn))) {
        variants.push({ width: w, url: `/uploads/${fn}` });
      }
    } catch { /* ignore fs errors, fall through */ }
  }
  if (!variants.length) return empty;

  // Prefer 800w as the default <img src=> (good middle-ground); else largest.
  const def = variants.find(v => v.width === 800) || variants[variants.length - 1];
  const srcset = variants.map(v => `${v.url} ${v.width}w`).join(', ');
  return { src: def.url, srcset, full: url };
}

// ── Block type registry (used by admin UI to render edit forms) ─────────────
const BLOCK_TYPES = [
  {
    type:  'richtext',
    label: 'Text (WYSIWYG)',
    icon:  '¶',
    fields: [
      { key: 'anchor', label: 'Anker (optional)', type: 'text' },
      { key: 'html',   label: 'Inhalt',            type: 'wysiwyg' },
    ],
  },
  {
    type:  'hero',
    label: 'Hero-Bereich',
    icon:  '★',
    fields: [
      { key: 'image_url',   label: 'Hintergrundbild', type: 'image' },
      { key: 'image_alt',   label: 'Alt-Text',        type: 'text' },
      { key: 'headline',    label: 'Überschrift (HTML erlaubt)', type: 'text' },
      { key: 'subheadline', label: 'Untertitel',      type: 'textarea' },
      { key: 'cta_primary', label: 'Primärer Button', type: 'link' },
      { key: 'cta_ghost',   label: 'Sekundärer Button', type: 'link' },
    ],
  },
  {
    type:  'image',
    label: 'Einzelbild',
    icon:  '▣',
    fields: [
      { key: 'image_url', label: 'Bild',     type: 'image' },
      { key: 'alt',       label: 'Alt-Text', type: 'text' },
      { key: 'caption',   label: 'Bildunterschrift', type: 'text' },
      { key: 'align',     label: 'Ausrichtung', type: 'select', options: ['left','center','right'] },
    ],
  },
  {
    type:  'gallery',
    label: 'Galerie',
    icon:  '▦',
    fields: [
      { key: 'images', label: 'Bilder', type: 'image_list' },
    ],
  },
  {
    type:  'boats',
    label: 'Boot-/Aktivitätskacheln',
    icon:  '⛵',
    fields: [
      { key: 'anchor',      label: 'Anker (optional)', type: 'text' },
      { key: 'headline',    label: 'Überschrift',      type: 'text' },
      { key: 'subheadline', label: 'Untertitel',       type: 'text' },
      { key: 'items',       label: 'Kacheln',          type: 'boat_items' },
    ],
  },
  {
    type:  'events',
    label: 'Veranstaltungskalender',
    icon:  '📅',
    fields: [
      { key: 'anchor',      label: 'Anker (optional)', type: 'text' },
      { key: 'headline',    label: 'Überschrift',      type: 'text' },
      { key: 'subheadline', label: 'Untertitel',       type: 'text' },
    ],
  },
  {
    type:  'cta',
    label: 'Call-to-Action',
    icon:  '➤',
    fields: [
      { key: 'headline', label: 'Überschrift', type: 'text' },
      { key: 'text',     label: 'Fließtext',   type: 'textarea' },
      { key: 'button',   label: 'Button',      type: 'link' },
    ],
  },
  {
    type:  'banner',
    label: 'Ankündigungs-Banner',
    icon:  '📢',
    fields: [
      { key: 'label',  label: 'Präfix-Label',                 type: 'text' },
      { key: 'source', label: 'Quelle (captain|inline)',      type: 'select', options: ['captain','inline'] },
      { key: 'text',   label: 'Text (nur wenn Quelle=inline)', type: 'text' },
    ],
  },
  {
    type:  'members_table',
    label: 'Mitgliedertabelle (geschützt)',
    icon:  '👥',
    fields: [
      { key: 'intro_html', label: 'Einleitungstext (optional)',  type: 'wysiwyg' },
      { key: 'columns',    label: 'Spalten',                     type: 'members_columns' },
      { key: 'sort',       label: 'Sortierung',                  type: 'select',
        options: ['none', 'name', 'sport', 'since'] },
      { key: 'outro_html', label: 'Text unter der Tabelle (optional)', type: 'wysiwyg' },
    ],
  },
  {
    type:  'video',
    label: 'Video (YouTube)',
    icon:  '▶',
    fields: [
      { key: 'url',     label: 'YouTube-URL (z.B. https://youtu.be/… oder https://www.youtube.com/watch?v=…)', type: 'text' },
      { key: 'caption', label: 'Bildunterschrift (optional)', type: 'text' },
    ],
  },
  {
    type:  'livestream',
    label: 'Livestream (HLS / .m3u8)',
    icon:  '🔴',
    fields: [
      { key: 'url',         label: 'Stream-URL (.m3u8)', type: 'text' },
      { key: 'title',       label: 'Titel (optional)', type: 'text' },
      { key: 'description', label: 'Beschreibung (optional)', type: 'text' },
      { key: 'poster_url',  label: 'Vorschaubild (vor Start)', type: 'image' },
      { key: 'autoplay_muted', label: 'Stumm starten', type: 'checkbox' },
    ],
  },
  {
    // ⚠️ SECURITY: this block stores HTML as-is, including <script>.
    // See lib/sanitizer.js → sanitizeBlocks() for how to disable/harden.
    type:  'html_raw',
    label: 'HTML (Rohcode, inkl. <script>) ⚠️',
    icon:  '⟨⟩',
    fields: [
      { key: 'html', label: 'HTML-Quelltext', type: 'code' },
    ],
  },
  {
    // ⚠️ SECURITY: whole-page HTML mode. When a page's blocks is a single
    // page_html block, routes/pages.js bypasses the layout shell entirely
    // and serves this content as the full HTML document.
    // See lib/sanitizer.js and routes/pages.js for how to harden.
    type:  'page_html',
    label: 'Ganze Seite als HTML ⚠️',
    icon:  '📄',
    fields: [
      { key: 'html', label: 'Komplettes HTML-Dokument (inkl. <!doctype html>, <head>, <body>)', type: 'code' },
    ],
  },
];

// ── Per-block rendering ──────────────────────────────────────────────────────

function anchorAttr(a) {
  return a ? ` id="${attr(a)}"` : '';
}

function renderRichtext(d) {
  // html is already sanitized at save-time; still wrap in a section
  return `<section class="cms-richtext"${anchorAttr(d.anchor)}>
<div class="about-content">${d.html || ''}</div>
</section>`;
}

function renderHero(d) {
  const cta1 = d.cta_primary && d.cta_primary.label
    ? `<a class="btn primary" href="${attr(d.cta_primary.href || '#')}">${escapeHtml(d.cta_primary.label)}</a>` : '';
  const cta2 = d.cta_ghost && d.cta_ghost.label
    ? `<a class="btn ghost" href="${attr(d.cta_ghost.href || '#')}">${escapeHtml(d.cta_ghost.label)}</a>` : '';
  const ripples = d.interactive_ripples ? '<div class="ripples" aria-hidden="true"></div>' : '';
  // headline may contain <span class="accent">…</span> — kept as-is from trusted author
  return `<section class="hero">
<div class="hero-media">
<img src="${attr(d.image_url || '')}" alt="${attr(d.image_alt || '')}" />
${ripples}
</div>
<div class="hero-copy">
<h1>${d.headline || ''}</h1>
<p>${escapeHtml(d.subheadline || '')}</p>
<div class="hero-cta">${cta1}${cta2}</div>
</div>
</section>`;
}

function renderImage(d) {
  const cap = d.caption ? `<figcaption>${escapeHtml(d.caption)}</figcaption>` : '';
  const align = ['left','center','right'].includes(d.align) ? d.align : 'center';
  const v = imageVariants(d.image_url || '');
  const srcsetAttr = v.srcset
    ? ` srcset="${attr(v.srcset)}" sizes="(max-width: 768px) 100vw, 800px"` : '';
  return `<figure class="cms-image cms-image--${align}">
<img class="cms-zoomable" src="${attr(v.src)}"${srcsetAttr} data-fullsrc="${attr(v.full)}" alt="${attr(d.alt || '')}" loading="lazy" />
${cap}
</figure>`;
}

function renderGallery(d) {
  const imgs = Array.isArray(d.images) ? d.images : [];
  const items = imgs.map(i => {
    const v = imageVariants(i.image_url || '');
    const srcsetAttr = v.srcset
      ? ` srcset="${attr(v.srcset)}" sizes="(max-width: 768px) 50vw, 400px"` : '';
    return `<a href="${attr(v.full)}" class="cms-zoomable-link"><img class="cms-zoomable" src="${attr(v.src)}"${srcsetAttr} data-fullsrc="${attr(v.full)}" alt="${attr(i.alt || '')}" loading="lazy" /></a>`;
  }).join('');
  return `<section class="cms-gallery"><div class="cms-gallery-grid">${items}</div></section>`;
}

function renderBoats(d) {
  const items = Array.isArray(d.items) ? d.items : [];
  const cards = items.map(it => {
    const meta = Array.isArray(it.meta) ? it.meta.map(m => `<span>${escapeHtml(m)}</span>`).join('') : '';
    const cta = it.cta && it.cta.label
      ? `<a class="btn tiny" href="${attr(it.cta.href || '#')}">${escapeHtml(it.cta.label)}</a>` : '';
    const v = imageVariants(it.image_url || '');
    const srcsetAttr = v.srcset
      ? ` srcset="${attr(v.srcset)}" sizes="(max-width: 768px) 100vw, 400px"` : '';
    return `<article class="card">
<img class="cms-zoomable" src="${attr(v.src)}"${srcsetAttr} data-fullsrc="${attr(v.full)}" alt="${attr(it.image_alt || '')}" loading="lazy" />
<h3>${escapeHtml(it.title || '')}</h3>
<p>${escapeHtml(it.text || '')}</p>
<div class="meta">${meta}</div>
${cta}
</article>`;
  }).join('');
  const header = (d.headline || d.subheadline)
    ? `<header class="section-header"><h2>${escapeHtml(d.headline || '')}</h2><p>${escapeHtml(d.subheadline || '')}</p></header>` : '';
  return `<section class="activities"${anchorAttr(d.anchor)}>
${header}
<div class="grid">${cards}</div>
</section>`;
}

function renderEvents(d) {
  const header = (d.headline || d.subheadline)
    ? `<header class="section-header"><h2>${escapeHtml(d.headline || 'Veranstaltungskalender')}</h2><p>${escapeHtml(d.subheadline || '')}</p></header>` : '';
  return `<section class="kalender"${anchorAttr(d.anchor)}>
${header}
<div class="cal-nav">
<button class="btn" id="cal-prev" aria-label="Vorheriger Monat">&#8249;</button>
<span class="cal-month-label" id="cal-month-label"></span>
<button class="btn" id="cal-next" aria-label="Nächster Monat">&#8250;</button>
</div>
<div class="cal-grid-wrap"><div class="cal-grid" id="cal-grid" role="grid" aria-label="Kalender"></div></div>
<div class="cal-events" id="cal-events"><p class="cal-empty">Wähle einen Tag, um Termine zu sehen.</p></div>
<div class="cal-legend"><span class="cal-legend-dot"></span> Termin vorhanden</div>
</section>`;
}

function renderCta(d) {
  const btn = d.button && d.button.label
    ? `<a class="btn primary" href="${attr(d.button.href || '#')}">${escapeHtml(d.button.label)}</a>` : '';
  return `<section class="cms-cta">
<div class="cms-cta-inner">
<h2>${escapeHtml(d.headline || '')}</h2>
<p>${escapeHtml(d.text || '')}</p>
${btn}
</div>
</section>`;
}

function renderBanner(d) {
  const label = escapeHtml(d.label || '');
  if (d.source === 'inline') {
    return `<section class="banner" aria-live="polite"><div class="banner-inner"><strong>${label}</strong> <span>${escapeHtml(d.text || '')}</span></div></section>`;
  }
  // captain: filled client-side by existing app.js via captain.txt
  return `<section id="captain-banner" class="banner" aria-live="polite">
<div class="banner-inner"><strong>${label}</strong> <span id="captain-text">Loading…</span></div>
</section>`;
}

const MEMBERS_DEFAULT_COLUMNS = [
  { key: 'name',  label: 'Name',          visible: true },
  { key: 'sport', label: 'Sport',         visible: true },
  { key: 'since', label: 'Mitglied seit', visible: true },
];
const MEMBERS_VALID_KEYS = new Set(['name', 'sport', 'since']);
const MEMBERS_VALID_SORT = new Set(['none', 'name', 'sport', 'since']);

function defaultLabelFor(key) {
  const d = MEMBERS_DEFAULT_COLUMNS.find(c => c.key === key);
  return d ? d.label : key;
}

function normalizeMembersColumns(raw) {
  // Accept saved config; drop unknown keys, dedupe, then append any missing
  // defaults (invisible) so the editor can always toggle them on later.
  const out = [];
  const seen = new Set();
  if (Array.isArray(raw)) {
    for (const c of raw) {
      if (!c || typeof c !== 'object') continue;
      if (!MEMBERS_VALID_KEYS.has(c.key) || seen.has(c.key)) continue;
      seen.add(c.key);
      out.push({
        key: c.key,
        label: typeof c.label === 'string' && c.label.trim() ? c.label : defaultLabelFor(c.key),
        visible: c.visible !== false,
      });
    }
  }
  for (const d of MEMBERS_DEFAULT_COLUMNS) {
    if (!seen.has(d.key)) out.push({ ...d, visible: false });
  }
  return out;
}

function renderMembersTable(d) {
  d = d || {};
  const columnsAll = normalizeMembersColumns(d.columns);
  let   columns    = columnsAll.filter(c => c.visible);
  // Guard: never render an empty <thead>
  if (!columns.length) columns = MEMBERS_DEFAULT_COLUMNS.slice();
  const sort    = MEMBERS_VALID_SORT.has(d.sort) ? d.sort : 'none';
  const intro   = typeof d.intro_html === 'string' ? d.intro_html : '';
  const outro   = typeof d.outro_html === 'string' ? d.outro_html : '';

  const ths = columns.map(c => `<th>${escapeHtml(c.label)}</th>`).join('');
  const colspan  = columns.length;
  const dataKeys = columns.map(c => c.key).join(',');

  const introHtml = intro ? `<div class="members-intro">${intro}</div>` : '';
  const outroHtml = outro ? `<div class="members-outro">${outro}</div>` : '';

  return `<section class="members-section">
<header class="section-header"><h1>Mitgliederbereich</h1><p id="welcome-msg">Willkommen!</p></header>
<div class="members-content"><div class="about-content">
${introHtml}
<table class="members-table" id="members-table" data-keys="${attr(dataKeys)}" data-sort="${attr(sort)}">
<thead><tr>${ths}</tr></thead>
<tbody id="members-tbody"><tr><td colspan="${colspan}">Lade Daten…</td></tr></tbody>
</table>
${outroHtml}
</div></div>
</section>`;
}

// Extract YouTube video ID from common URL shapes. Returns null if not recognised.
function parseYouTubeId(url) {
  if (!url || typeof url !== 'string') return null;
  // Accept: youtu.be/ID, youtube.com/watch?v=ID, youtube.com/embed/ID, youtube.com/shorts/ID
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function renderVideo(d) {
  const id = parseYouTubeId(d.url);
  if (!id) {
    return `<section class="cms-video cms-video--invalid"><p><em>Video-URL nicht erkannt.</em></p></section>`;
  }
  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`;
  const cap = d.caption ? `<figcaption>${escapeHtml(d.caption)}</figcaption>` : '';
  return `<figure class="cms-video" style="max-width:900px;margin:2rem auto;">
<div class="cms-video-frame" style="position:relative;width:100%;aspect-ratio:16/9;background:#000;">
<iframe src="${attr(src)}"
  title="${attr(d.caption || 'Video')}"
  loading="lazy"
  referrerpolicy="strict-origin-when-cross-origin"
  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  allowfullscreen
  style="position:absolute;inset:0;width:100%;height:100%;border:0;"></iframe>
</div>
${cap}
</figure>`;
}

// HLS livestream block. Renders a <video> shell tagged with data-hls-src and
// optional data-poster; the layout-level loader (gated on needsLivestream)
// downloads /vendor/hls.js/hls.min.js once and wires up the player. Safari
// and iOS play .m3u8 natively so hls.js is only used as a fallback for the
// other browsers.
function renderLivestream(d) {
  const url = (d.url || '').trim();
  // Only allow http(s) URLs. <video src> doesn't execute javascript: but we
  // also feed the URL into hls.js's fetch(), which would happily request
  // anything — keeping it strict avoids surprises.
  if (!url || !/^https?:\/\//i.test(url)) {
    return `<section class="cms-livestream cms-livestream--invalid"><p><em>Stream-URL ungültig oder fehlt (nur http/https erlaubt).</em></p></section>`;
  }
  const title = d.title ? `<h3 class="cms-livestream-title">${escapeHtml(d.title)}</h3>` : '';
  const desc  = d.description ? `<p class="cms-livestream-desc">${escapeHtml(d.description)}</p>` : '';
  const poster = d.poster_url ? ` poster="${attr(d.poster_url)}"` : '';
  const muted = d.autoplay_muted ? ' muted' : '';
  // controls is always on; users need play/pause/volume. autoplay is only
  // safe with muted (browsers block sound-on autoplay), so we only set it
  // when the editor explicitly opted in.
  const auto  = d.autoplay_muted ? ' autoplay' : '';
  return `<figure class="cms-livestream">
${title}
<div class="cms-livestream-frame">
<video class="cms-livestream-video" data-hls-src="${attr(url)}" controls playsinline${muted}${auto}${poster}></video>
</div>
${desc}
</figure>`;
}

function renderBlock(block) {
  const d = block.data || {};
  switch (block.type) {
    case 'richtext':      return renderRichtext(d);
    case 'hero':          return renderHero(d);
    case 'image':         return renderImage(d);
    case 'gallery':       return renderGallery(d);
    case 'boats':         return renderBoats(d);
    case 'events':        return renderEvents(d);
    case 'cta':           return renderCta(d);
    case 'banner':        return renderBanner(d);
    case 'members_table': return renderMembersTable(d);
    case 'video':         return renderVideo(d);
    case 'livestream':    return renderLivestream(d);
    // ⚠️ SECURITY: renders stored HTML as-is, including <script> tags.
    // See lib/sanitizer.js for how to disable/harden.
    case 'html_raw':      return `<section class="cms-html-raw">${typeof d.html === 'string' ? d.html : ''}</section>`;
    // page_html is handled at route level (bypasses layout). If ever rendered
    // inline (e.g. preview with mixed blocks), fall back to rendering raw.
    case 'page_html':     return typeof d.html === 'string' ? d.html : '';
    default:              return `<!-- unknown block type: ${escapeHtml(block.type)} -->`;
  }
}

function renderBlocks(blocks) {
  if (!Array.isArray(blocks)) return '';
  return blocks.map(renderBlock).join('\n');
}

// ── Layout shell ─────────────────────────────────────────────────────────────

function renderNav(nav, user) {
  const links = (nav || []).map(n =>
    `<a href="${attr(n.href)}">${escapeHtml(n.label)}</a>`
  ).join('');
  const auth = user
    ? `<span class="auth-user">${escapeHtml(user.username)}</span>
       ${user.role === 'admin' ? '<a class="btn" href="/admin">Admin</a>' : ''}
       <button class="btn" id="logout-btn" type="button">Abmelden</button>`
    : `<a class="btn" href="/login.html">Anmelden</a>`;
  return `<nav class="nav">${links}${auth}</nav>`;
}

function renderFooter(footerNav, branding) {
  const links = (footerNav || []).map(n =>
    `<a href="${attr(n.href)}">${escapeHtml(n.label)}</a>`
  ).join('');
  const note = escapeHtml(branding.footer_note || '');
  return `<footer class="site-footer">
<div>${note} <span id="year"></span></div>
<nav class="foot-nav">${links}</nav>
</footer>`;
}

function renderLayout({ title, body, nav, footerNav, branding, user, needsCalendar, needsMembersData, needsHeroFx, needsLightbox, needsLivestream }) {
  const scripts = [];
  // runtime helper: year + logout + optional member-data loader
  scripts.push(`<script>
(function(){
  var y=document.getElementById('year'); if(y) y.textContent=new Date().getFullYear();
  var lb=document.getElementById('logout-btn');
  if(lb) lb.addEventListener('click', async function(){
    await fetch('/api/logout',{method:'POST'}); window.location.href='/';
  });
  ${needsMembersData ? `
  (async function(){
    try {
      var me = await fetch('/api/me'); if(!me.ok) return;
      var meData = await me.json();
      var welcome = document.getElementById('welcome-msg');
      if(welcome) welcome.textContent = 'Willkommen, ' + meData.username + '!';
      var r = await fetch('/api/members/data'); if(!r.ok) return;
      var j = await r.json();
      var table = document.getElementById('members-table');
      var tbody = document.getElementById('members-tbody'); if(!tbody) return;
      var keysAttr = (table && table.getAttribute('data-keys')) || 'name,sport,since';
      var sortKey  = (table && table.getAttribute('data-sort')) || 'none';
      var keys = keysAttr.split(',').map(function(s){ return s.trim(); }).filter(Boolean);
      var members = (j.members||[]).slice();
      if (sortKey !== 'none') {
        members.sort(function(a,b){
          var av = (a[sortKey]||'').toString();
          var bv = (b[sortKey]||'').toString();
          return av.localeCompare(bv, 'de', { numeric: true });
        });
      }
      function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
      }); }
      tbody.innerHTML = members.map(function(m){
        return '<tr>' + keys.map(function(k){ return '<td>'+esc(m[k])+'</td>'; }).join('') + '</tr>';
      }).join('');
      if (!members.length) {
        tbody.innerHTML = '<tr><td colspan="'+keys.length+'">Keine Einträge.</td></tr>';
      }
    } catch(e){}
  })();` : ''}
  ${needsHeroFx ? `
  (function(){
    var media = document.querySelector('.hero-media');
    var ripples = document.querySelector('.ripples');
    if(media && ripples){
      function setR(e){
        var rect = media.getBoundingClientRect();
        var x = (((e.clientX!=null?e.clientX:(e.touches&&e.touches[0]?e.touches[0].clientX:0)) - rect.left) / rect.width) * 100;
        var y = (((e.clientY!=null?e.clientY:(e.touches&&e.touches[0]?e.touches[0].clientY:0)) - rect.top) / rect.height) * 100;
        ripples.style.setProperty('--x', x+'%');
        ripples.style.setProperty('--y', y+'%');
      }
      ['mousemove','touchmove'].forEach(function(ev){ media.addEventListener(ev,setR,{passive:true}); });
    }
    fetch('/captain.txt').then(function(r){return r.text();}).then(function(t){
      var el = document.getElementById('captain-text'); if(el) el.textContent = t.trim() || 'Keine Ankündigungen.';
    }).catch(function(){
      var el = document.getElementById('captain-text'); if(el) el.textContent = 'Keine Ankündigungen.';
    });
  })();` : ''}
  ${needsLightbox ? `
  (function(){
    // Click-to-zoom lightbox for CMS images. When the clicked image is part
    // of a .cms-gallery, the lightbox additionally collects every sibling
    // image inside that same gallery so the user can step through them with
    // the arrow buttons or keys. For lone images (cms-image, boats card,
    // richtext-embedded <img>) navigation is hidden and only the single
    // image is shown.
    function findClickedImg(target){
      if (!target || !target.closest) return null;
      var img = target.closest('.cms-zoomable');
      if (img) return img;
      // Generic fallback: any reasonably-sized <img> inside CMS content.
      var rawImg = target.closest('img');
      if (rawImg && rawImg.naturalWidth > 200
          && rawImg.closest('.cms-richtext, .cms-image, .cms-gallery, .boats-grid')) {
        return rawImg;
      }
      return null;
    }
    function srcFor(img){
      if (img.dataset && img.dataset.fullsrc) return img.dataset.fullsrc;
      var a = img.closest && img.closest('a.cms-zoomable-link');
      if (a && a.getAttribute('href')) return a.getAttribute('href');
      return img.currentSrc || img.src;
    }
    function altFor(img){ return img.getAttribute('alt') || ''; }
    function siblingsOf(img){
      var gallery = img.closest && img.closest('.cms-gallery');
      if (!gallery) return [img];
      var nodes = gallery.querySelectorAll('.cms-zoomable');
      return Array.prototype.slice.call(nodes);
    }

    var overlay = null;
    var imgEl = null;
    var captionEl = null;
    var counterEl = null;
    var prevBtn = null;
    var nextBtn = null;
    var current = [];
    var idx = 0;

    function close(){
      if (!overlay) return;
      overlay.remove(); overlay = null; imgEl = null;
      document.removeEventListener('keydown', onKey);
    }
    function show(i){
      if (!current.length) return;
      idx = (i + current.length) % current.length;
      var img = current[idx];
      imgEl.src = srcFor(img);
      imgEl.alt = altFor(img);
      var cap = altFor(img);
      captionEl.textContent = cap;
      captionEl.style.display = cap ? '' : 'none';
      var multi = current.length > 1;
      counterEl.textContent = multi ? (idx + 1) + ' / ' + current.length : '';
      prevBtn.style.display = multi ? '' : 'none';
      nextBtn.style.display = multi ? '' : 'none';
    }
    function next(){ show(idx + 1); }
    function prev(){ show(idx - 1); }
    function onKey(e){
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    }
    function open(siblings, startIdx){
      close();
      current = siblings;
      overlay = document.createElement('div');
      overlay.className = 'lightbox-overlay';
      overlay.setAttribute('role','dialog');
      overlay.setAttribute('aria-modal','true');
      overlay.innerHTML =
          '<button class="lightbox-close" aria-label="Schließen">×</button>'
        + '<button class="lightbox-prev"  aria-label="Zurück">‹</button>'
        + '<button class="lightbox-next"  aria-label="Weiter">›</button>'
        + '<div class="lightbox-counter"></div>'
        + '<img class="lightbox-img" alt="" />'
        + '<div class="lightbox-caption"></div>';
      imgEl     = overlay.querySelector('.lightbox-img');
      captionEl = overlay.querySelector('.lightbox-caption');
      counterEl = overlay.querySelector('.lightbox-counter');
      prevBtn   = overlay.querySelector('.lightbox-prev');
      nextBtn   = overlay.querySelector('.lightbox-next');
      prevBtn.addEventListener('click', function(e){ e.stopPropagation(); prev(); });
      nextBtn.addEventListener('click', function(e){ e.stopPropagation(); next(); });
      overlay.addEventListener('click', function(e){
        if (e.target === overlay || e.target.classList.contains('lightbox-close')) close();
      });
      document.body.appendChild(overlay);
      document.addEventListener('keydown', onKey);
      show(startIdx);
    }
    document.addEventListener('click', function(e){
      var img = findClickedImg(e.target);
      if (!img) return;
      e.preventDefault();
      var sibs = siblingsOf(img);
      var start = sibs.indexOf(img);
      open(sibs, start < 0 ? 0 : start);
    });
  })();` : ''}
})();
</script>`);
  if (needsCalendar) scripts.push('<script src="/calendar.js"></script>');
  if (needsLivestream) {
    // Loader for HLS livestream blocks. Strategy:
    //   1. If the browser plays .m3u8 natively (Safari/iOS), just set src.
    //   2. Otherwise lazy-load /vendor/hls.js/hls.min.js (~130 KB gz) and
    //      attach an Hls() instance per <video data-hls-src>.
    // hls.min.js exposes window.Hls.
    scripts.push(`<script>
(function(){
  var vids = document.querySelectorAll('video[data-hls-src]');
  if (!vids.length) return;
  function attachNative(v){ v.src = v.dataset.hlsSrc; }
  function attachHls(v){
    var hls = new window.Hls({ liveDurationInfinity: true });
    hls.loadSource(v.dataset.hlsSrc);
    hls.attachMedia(v);
    hls.on(window.Hls.Events.ERROR, function(_e, data){
      if (data && data.fatal) {
        v.insertAdjacentHTML('afterend',
          '<p class="cms-livestream-error">Stream nicht erreichbar.</p>');
      }
    });
  }
  // Native HLS: Safari, iOS, some smart TVs.
  var native = vids[0].canPlayType('application/vnd.apple.mpegurl');
  if (native) {
    Array.prototype.forEach.call(vids, attachNative);
    return;
  }
  // Lazy-load hls.js once for the whole page.
  var s = document.createElement('script');
  s.src = '/vendor/hls.js/hls.min.js';
  s.onload = function(){
    if (!window.Hls || !window.Hls.isSupported()) {
      Array.prototype.forEach.call(vids, function(v){
        v.insertAdjacentHTML('afterend',
          '<p class="cms-livestream-error">Livestream wird in diesem Browser nicht unterstützt.</p>');
      });
      return;
    }
    Array.prototype.forEach.call(vids, attachHls);
  };
  s.onerror = function(){
    Array.prototype.forEach.call(vids, function(v){
      v.insertAdjacentHTML('afterend',
        '<p class="cms-livestream-error">Player konnte nicht geladen werden.</p>');
    });
  };
  document.head.appendChild(s);
})();
</script>`);
  }

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css" />
</head>
<body>
<header class="site-header">
<a class="brand" href="/">
<img class="brand-mark" src="${attr(branding.logo_url || '/logo.png')}" alt="${attr(branding.site_name || '')} Logo" />
<span class="brand-name">${escapeHtml(branding.site_name || '')}</span>
</a>
${renderNav(nav, user)}
</header>
<main>
${body}
</main>
${renderFooter(footerNav, branding)}
${scripts.join('\n')}
</body>
</html>`;
}

/**
 * Inspect blocks to decide which runtime features the page needs.
 * This keeps the JS payload minimal for simple pages.
 */
function pageFeatures(blocks) {
  const types = new Set((blocks || []).map(b => b.type));
  return {
    needsCalendar:    types.has('events'),
    needsMembersData: types.has('members_table'),
    needsHeroFx:      types.has('hero') || types.has('banner'),
    needsLivestream:  types.has('livestream'),
    // Lightbox is cheap (~1 KB); enable whenever the page might contain
    // images. Block types that never render <img> are excluded so very
    // simple text-only pages don't ship the script.
    needsLightbox:    types.has('image') || types.has('gallery')
                   || types.has('boats') || types.has('richtext')
                   || types.has('hero')  || types.has('html_raw'),
  };
}

/**
 * A page is in "full HTML" mode when its blocks are exactly one page_html
 * block. In that case routes/pages.js serves the HTML directly, without
 * any layout wrapping.
 */
function isFullHtmlPage(blocks) {
  return Array.isArray(blocks)
      && blocks.length === 1
      && blocks[0] && blocks[0].type === 'page_html';
}

module.exports = { BLOCK_TYPES, renderBlocks, renderLayout, pageFeatures, isFullHtmlPage };
