'use strict';

const crypto = require('crypto');

const DEFAULT_SOURCE_LANG = 'DE';
const API_URL = process.env.DEEPL_API_URL || 'https://api-free.deepl.com/v2/translate';
const API_KEY = process.env.DEEPL_API_KEY;

const translationCache = new Map();

function normalizeTargetLanguage(language) {
  if (!language) return 'de';

  const normalized = String(language).trim().toLowerCase();
  return normalized === 'en' ? 'en' : 'de';
}

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
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  const params = new URLSearchParams();
  params.set('text', text);
  params.set('source_lang', sourceLanguage || DEFAULT_SOURCE_LANG);
  params.set('target_lang', target.toUpperCase());

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

  translationCache.set(cacheKey, translated);
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
