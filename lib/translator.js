'use strict';

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

const DEFAULT_SOURCE_LANG = 'DE';
const API_URL  = process.env.DEEPL_API_URL  || 'https://api-free.deepl.com/v2/translate';
const API_KEY  = process.env.DEEPL_API_KEY;
const CACHE_FILE = process.env.TRANSLATION_CACHE_FILE
  || path.join(__dirname, '..', 'data', 'translation-cache.json');

const SUPPORTED_TARGETS = ['en', 'pl', 'nl'];

// DeepL target-language codes (BCP-47 compatible tags expected by the API)
const DEEPL_LANG_MAP = {
  en: 'EN',
  pl: 'PL',
  nl: 'NL',
};

function normalizeTargetLanguage(language) {
  if (!language) return 'de';
  const normalized = String(language).trim().toLowerCase();
  return SUPPORTED_TARGETS.includes(normalized) ? normalized : 'de';
}

// ── File-backed cache ─────────────────────────────────────────────────────────

function loadCache() {
  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveCache(cache) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
  } catch (err) {
    // Non-fatal: log but continue — in-memory cache still works for this run
    console.warn('translator: could not write cache file:', err.message);
  }
}

// Load once at module initialisation; all writes go through saveCache()
let fileCache = loadCache();

function makeCacheKey(text, targetLanguage) {
  return crypto
    .createHash('sha256')
    .update(String(text))
    .update(':')
    .update(String(targetLanguage))
    .digest('hex');
}

async function translateText(text, targetLanguage, sourceLanguage) {
  const target = normalizeTargetLanguage(targetLanguage);
  if (!text || target === 'de' || !API_KEY) return text;

  const cacheKey = makeCacheKey(text, target);
  if (Object.prototype.hasOwnProperty.call(fileCache, cacheKey)) {
    return fileCache[cacheKey];
  }

  const params = new URLSearchParams();
  params.set('text', text);
  params.set('source_lang', sourceLanguage || DEFAULT_SOURCE_LANG);
  params.set('target_lang', DEEPL_LANG_MAP[target]);

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${API_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`deepl: translate failed with status ${response.status}`);
  }

  const data = await response.json();
  const translated = data && data.translations && data.translations[0] && data.translations[0].text
    ? data.translations[0].text
    : text;

  fileCache[cacheKey] = translated;
  saveCache(fileCache);
  return translated;
}

async function translateObjectFields(input, fields, targetLanguage) {
  if (!input || normalizeTargetLanguage(targetLanguage) === 'de') return input;

  const output = { ...input };
  for (const field of fields) {
    if (typeof output[field] !== 'string' || !output[field].trim()) continue;
    output[field] = await translateText(output[field], targetLanguage);
  }

  return output;
}

module.exports = {
  normalizeTargetLanguage,
  translateObjectFields,
  translateText,
};
