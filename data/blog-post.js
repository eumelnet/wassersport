/* Blog post page — reads slug from URL, fetches /api/blog/<slug>?lang=, renders it. */
(function () {
  'use strict';

  var i18n = window.WassersportI18n;
  var container = document.getElementById('blog-article');
  if (!container) return;

  // Expect URLs like /blog/<slug>
  var match = window.location.pathname.match(/^\/blog\/([a-z0-9][a-z0-9-]*)\/?$/i);
  var slug = match ? match[1] : null;

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

  function renderNotFound() {
    container.innerHTML =
      '<p class="news-empty">' + escHtml(i18n.t('blog.notFound')) + '</p>' +
      '<div class="article-footer">' +
        '<a class="btn ghost" href="/">' + escHtml(i18n.t('blog.backHome')) + '</a>' +
      '</div>';
  }

  function renderLoading() {
    container.innerHTML = '<p class="news-empty">' + escHtml(i18n.t('blog.loading')) + '</p>';
  }

  function renderPost(post) {
    if (!post) return renderNotFound();

    // Update document title + meta description (translated by server)
    if (post.title) document.title = post.title + ' — Havelkanal Wassersport';

    var metaParts = [];
    if (post.date) metaParts.push(i18n.t('blog.publishedOn', { date: fmtDate(post.date) }));
    if (post.author) metaParts.push(i18n.t('blog.author', { author: post.author }));
    if (post.readingMinutes) metaParts.push(i18n.t('blog.readingTime', { minutes: post.readingMinutes }));

    var gallery = '';
    if (Array.isArray(post.gallery) && post.gallery.length) {
      gallery = '<div class="article-gallery">' + post.gallery.map(function (g) {
        return '<figure>' +
                 '<img src="' + escHtml(g.src) + '" alt="' + escHtml(g.alt || '') + '" />' +
                 (g.caption ? '<figcaption>' + escHtml(g.caption) + '</figcaption>' : '') +
               '</figure>';
      }).join('') + '</div>';
    }

    container.innerHTML =
      '<p class="breadcrumb">' +
        '<a href="/">' + escHtml(i18n.t('blog.breadcrumbHome')) + '</a>' +
        '<span class="sep">/</span>' +
        '<a href="/#news">' + escHtml(i18n.t('blog.breadcrumbSection')) + '</a>' +
        '<span class="sep">/</span>' +
        '<span>' + escHtml(post.title || '') + '</span>' +
      '</p>' +
      '<header class="article-header">' +
        (post.category ? '<span class="article-kicker">' + escHtml(post.category) + '</span>' : '') +
        '<h1>' + escHtml(post.title || '') + '</h1>' +
        (metaParts.length ? '<p class="article-meta">' + metaParts.map(function (p, i) {
          return (i ? '<span class="dot">·</span>' : '') + '<span>' + escHtml(p) + '</span>';
        }).join('') + '</p>' : '') +
      '</header>' +
      (post.hero ? '<figure class="article-hero"><img src="' + escHtml(post.hero) + '" alt="' + escHtml(post.heroAlt || post.title || '') + '" /></figure>' : '') +
      '<div class="article-body">' + (post.bodyHtml || '') + '</div>' +
      gallery +
      '<footer class="article-footer">' +
        '<a class="btn ghost" href="/">' + escHtml(i18n.t('blog.backHome')) + '</a>' +
        '<a class="btn primary" href="/#kalender">' + escHtml(i18n.t('blog.toCalendar')) + '</a>' +
      '</footer>';
  }

  function load() {
    if (!slug) return renderNotFound();
    renderLoading();
    var lang = i18n.getLanguage();
    fetch('/api/blog/' + encodeURIComponent(slug) + '?lang=' + encodeURIComponent(lang))
      .then(function (r) {
        if (r.status === 404) return null;
        return r.ok ? r.json() : null;
      })
      .then(renderPost)
      .catch(renderNotFound);
  }

  load();
  document.addEventListener(i18n.eventName, load);
})();
