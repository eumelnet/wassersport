'use strict';

(function () {
  const SUPPORTED = ['de', 'en'];

  function normalizeLanguage(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return SUPPORTED.includes(normalized) ? normalized : 'de';
  }

  function getLanguage() {
    const params = new URLSearchParams(window.location.search);
    return normalizeLanguage(params.get('lang'));
  }

  function withLanguage(url, lang) {
    const targetLanguage = normalizeLanguage(lang || getLanguage());
    if (!url || url.startsWith('#')) {
      return url;
    }

    const resolved = new URL(url, window.location.origin);
    resolved.searchParams.set('lang', targetLanguage);
    return resolved.pathname + resolved.search + resolved.hash;
  }

  function updateLanguageSelect() {
    const select = document.querySelector('[data-language-select]');
    if (select) {
      select.value = getLanguage();
    }
  }

  function rewriteLinks() {
    const language = getLanguage();
    document.querySelectorAll('a[href]').forEach((link) => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) {
        return;
      }

      link.setAttribute('href', withLanguage(href, language));
    });
  }

  function bindLanguageSelect() {
    const select = document.querySelector('[data-language-select]');
    if (!select) return;

    select.addEventListener('change', () => {
      const nextUrl = withLanguage(window.location.pathname + window.location.search + window.location.hash, select.value);
      window.location.href = nextUrl;
    });
  }

  window.WassersportLang = {
    getLanguage,
    withLanguage,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      updateLanguageSelect();
      rewriteLinks();
      bindLanguageSelect();
    });
  } else {
    updateLanguageSelect();
    rewriteLinks();
    bindLanguageSelect();
  }
})();
