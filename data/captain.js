/* Captain banner + footer year — independent of gsap/module loading.
 * Fetches /api/captain?lang= for DeepL-translated announcements and
 * re-fetches when the language switcher fires its event. */
(function () {
  'use strict';

  var i18n = window.WassersportI18n;

  /* footer year */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  var el = document.getElementById('captain-text');
  if (!el || !i18n) return;

  // Remove the data-i18n attribute so the i18n auto-apply doesn't overwrite
  // the fetched captain text every time the language changes.
  el.removeAttribute('data-i18n');

  function renderFallback() {
    el.textContent = i18n.t('home.banner.empty');
  }

  function load() {
    var language = i18n.getLanguage();
    el.textContent = i18n.t('home.banner.loading');

    fetch('/api/captain?lang=' + encodeURIComponent(language))
      .then(function (r) {
        if (!r.ok) throw new Error('fetch failed: ' + r.status);
        return r.json();
      })
      .then(function (data) {
        var text = (data && data.text || '').trim();
        el.textContent = text || i18n.t('home.banner.empty');
      })
      .catch(function (err) {
        if (window.console && console.warn) {
          console.warn('captain: load failed', err);
        }
        renderFallback();
      });
  }

  load();
  document.addEventListener(i18n.eventName, load);
})();
