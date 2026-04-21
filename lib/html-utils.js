'use strict';
/**
 * HTML escaping helpers.
 * - escapeHtml: for text nodes (escapes &, <, >, ", ')
 * - attr:       for attribute values (same rules, different name for clarity)
 */

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// For attribute values, escaping is the same as text content in practice.
const attr = escapeHtml;

module.exports = { escapeHtml, attr };
