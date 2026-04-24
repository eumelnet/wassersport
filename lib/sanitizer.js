'use strict';
/**
 * Server-side sanitizer for WYSIWYG content from the admin.
 *
 * Even though only admins can edit, we still sanitize:
 *   - defence in depth (stolen admin cookie can't inject <script>)
 *   - prevents accidental markup disasters from pasted Word content
 *
 * The whitelist is deliberately generous because the admin is trusted to style,
 * but anything that can execute JS (script, event handlers, javascript: URLs)
 * is stripped.
 */
const sanitizeHtml = require('sanitize-html');

const RICHTEXT_OPTIONS = {
  allowedTags: [
    'h1','h2','h3','h4','h5','h6',
    'p','br','hr','blockquote','pre','code','kbd','mark','sub','sup',
    'ul','ol','li',
    'strong','em','b','i','u','s','del','ins','small',
    'a','img','figure','figcaption',
    'table','thead','tbody','tfoot','tr','th','td','caption','colgroup','col',
    'div','span',
  ],
  allowedAttributes: {
    '*':       ['class', 'id', 'style', 'title', 'dir', 'lang'],
    'a':       ['href', 'target', 'rel'],
    'img':     ['src', 'alt', 'width', 'height', 'loading'],
    'td':      ['colspan', 'rowspan', 'align', 'valign'],
    'th':      ['colspan', 'rowspan', 'align', 'valign', 'scope'],
    'col':     ['span', 'width'],
    'colgroup':['span'],
  },
  // Only allow a narrow subset of inline styles that the CKEditor toolbar produces.
  allowedStyles: {
    '*': {
      'color':            [/^#(0x)?[0-9a-f]+$/i, /^rgb\(/, /^rgba\(/, /^[a-z]+$/i],
      'background-color': [/^#(0x)?[0-9a-f]+$/i, /^rgb\(/, /^rgba\(/, /^[a-z]+$/i],
      'text-align':       [/^left$|^right$|^center$|^justify$/],
      'font-weight':      [/^\d+$|^bold$|^normal$/],
      'font-style':       [/^italic$|^normal$/],
      'text-decoration':  [/^underline$|^line-through$|^none$/],
      'width':            [/^\d+(?:px|%|em|rem)$/],
      'height':           [/^\d+(?:px|%|em|rem)$/],
    },
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  allowProtocolRelative: false,
  transformTags: {
    // Force safe defaults on user-authored links
    'a': (tagName, attribs) => {
      const out = { ...attribs };
      if (out.target === '_blank') {
        const existing = (out.rel || '').split(/\s+/).filter(Boolean);
        if (!existing.includes('noopener')) existing.push('noopener');
        if (!existing.includes('noreferrer')) existing.push('noreferrer');
        out.rel = existing.join(' ');
      }
      return { tagName, attribs: out };
    },
  },
};

function sanitizeRichtext(html) {
  if (typeof html !== 'string') return '';
  return sanitizeHtml(html, RICHTEXT_OPTIONS);
}

/**
 * Sanitize a full block list in-place: only richtext blocks need cleaning,
 * other block types have structured data which is escaped at render time.
 * The `hero.headline` field is an intentional exception (may contain
 * inline <span class="accent">…</span>) — we sanitize it too but with a
 * very narrow whitelist.
 */
const HEADLINE_OPTS = {
  allowedTags: ['span', 'em', 'strong', 'br'],
  allowedAttributes: { 'span': ['class'] },
};

function sanitizeBlocks(blocks) {
  if (!Array.isArray(blocks)) return [];
  return blocks.map(b => {
    const out = { type: String(b.type || ''), data: { ...(b.data || {}) } };
    if (out.type === 'richtext' && typeof out.data.html === 'string') {
      out.data.html = sanitizeRichtext(out.data.html);
    }
    if (out.type === 'hero' && typeof out.data.headline === 'string') {
      out.data.headline = sanitizeHtml(out.data.headline, HEADLINE_OPTS);
    }
    if (out.type === 'members_table') {
      if (typeof out.data.intro_html === 'string') out.data.intro_html = sanitizeRichtext(out.data.intro_html);
      if (typeof out.data.outro_html === 'string') out.data.outro_html = sanitizeRichtext(out.data.outro_html);
    }
    // ⚠️ SECURITY: html_raw block is intentionally un-sanitized.
    // It allows <script> and arbitrary HTML. Admins only.
    //
    // To lock this down again (recommended for production hardening):
    //   1. In this function, run out.data.html through sanitizeRichtext()
    //      instead of keeping it raw.
    //   2. Remove the warning banner in data/admin/admin.js (search for
    //      'html_raw' → 'renderHtmlRawField').
    //   3. Optionally remove the block type from BLOCK_TYPES in
    //      lib/cms-renderer.js so editors can no longer insert new ones.
    //      Existing blocks will then render as "unknown block type".
    if (out.type === 'html_raw' && typeof out.data.html !== 'string') {
      out.data.html = '';
    }
    // ⚠️ SECURITY: same story for page_html — rendered as the full
    // document, including <script>, when a page is in full-HTML mode.
    if (out.type === 'page_html' && typeof out.data.html !== 'string') {
      out.data.html = '';
    }
    return out;
  });
}

module.exports = { sanitizeRichtext, sanitizeBlocks };
