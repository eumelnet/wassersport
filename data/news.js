/* Homepage "News" section — loads posts from /api/blog translated to current lang. */
(function () {
  'use strict';

  var i18n = window.WassersportI18n;
  var grid = document.getElementById('news-grid');
  if (!grid) return;

  function escHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    var lang = i18n.getLanguage();
    var locales = { de: 'de-DE', en: 'en-GB', pl: 'pl-PL', nl: 'nl-NL' };
    try {
      return d.toLocaleDateString(locales[lang] || 'de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (_) {
      return iso;
    }
  }

  function render(posts) {
    if (!Array.isArray(posts) || !posts.length) {
      grid.innerHTML = '<p class="news-empty">' + escHtml(i18n.t('home.news.empty')) + '</p>';
      return;
    }
    var html = posts.map(function (p) {
      var href = '/blog/' + encodeURIComponent(p.slug);
      return (
        '<a class="news-card" href="' + href + '">' +
          (p.hero ? '<div class="news-thumb"><img src="' + escHtml(p.hero) + '" alt="' + escHtml(p.heroAlt || p.title || '') + '" /></div>' : '') +
          '<div class="news-body">' +
            (p.category ? '<span class="news-cat">' + escHtml(p.category) + '</span>' : '') +
            '<h3>' + escHtml(p.title) + '</h3>' +
            '<p class="news-date">' + escHtml(fmtDate(p.date)) + '</p>' +
            (p.excerpt ? '<p class="news-excerpt">' + escHtml(p.excerpt) + '</p>' : '') +
          '</div>' +
          '<div class="news-more">' + escHtml(i18n.t('home.news.readMore')) + ' →</div>' +
        '</a>'
      );
    }).join('');
    grid.innerHTML = html;
  }

  function load() {
    var lang = i18n.getLanguage();
    grid.innerHTML = '<p class="news-empty">' + escHtml(i18n.t('home.news.loading')) + '</p>';
    fetch('/api/blog?lang=' + encodeURIComponent(lang))
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(render)
      .catch(function () {
        grid.innerHTML = '<p class="news-empty">' + escHtml(i18n.t('home.news.empty')) + '</p>';
      });
  }

  load();
  document.addEventListener(i18n.eventName, load);
})();
