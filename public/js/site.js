// Loads portfolio photos and services from the admin-managed data.
// The pages ship with fallback markup, so if the API can't be reached
// (for example when opening the HTML files directly) nothing breaks.
(function () {
  'use strict';

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) e.target.classList.add('visible');
    });
  }, { threshold: 0.1, rootMargin: '-50px' });

  function reveal(root) {
    root.querySelectorAll('.fade-in').forEach(function (el) { observer.observe(el); });
  }

  function getJSON(url) {
    return fetch(url, { headers: { Accept: 'application/json' } }).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.json();
    });
  }

  function imageSrc(p) {
    // external URLs and absolute paths stay as they are
    return p.image;
  }

  function card(p) {
    return '<div class="masonry-item fade-in" data-category="' + esc(p.category) + '">' +
      '<img src="' + esc(imageSrc(p)) + '" alt="' + esc(p.title) + '" loading="lazy">' +
      '<div class="masonry-overlay"><div class="masonry-info">' +
      (p.location ? '<p class="masonry-location">' + esc(p.location) + '</p>' : '') +
      '<h3 class="masonry-name">' + esc(p.title) + '</h3>' +
      '</div></div></div>';
  }

  // ---- Portfolio ----------------------------------------------------------
  var grid = document.querySelector('[data-portfolio]');
  if (grid) {
    var mode = grid.getAttribute('data-portfolio');
    getJSON('/api/portfolio').then(function (items) {
      if (!Array.isArray(items) || !items.length) return;

      if (mode === 'home') {
        var featured = items.filter(function (i) { return i.featured; });
        var others = items.filter(function (i) { return !i.featured; });
        items = featured.concat(others).slice(0, 6);
      }

      grid.innerHTML = items.map(card).join('');
      reveal(grid);

      var buttons = document.querySelectorAll('[data-filter]');
      if (!buttons.length) return;

      var empty = document.createElement('p');
      empty.style.cssText = 'text-align:center;color:var(--text-light);padding:3rem 0;display:none;';
      empty.textContent = 'No photos in this category yet. Please check back soon.';
      grid.parentNode.appendChild(empty);

      buttons.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var f = btn.getAttribute('data-filter');
          buttons.forEach(function (b) { b.classList.toggle('active', b === btn); });
          var shown = 0;
          grid.querySelectorAll('.masonry-item').forEach(function (el) {
            var match = f === 'all' || el.getAttribute('data-category') === f;
            el.style.display = match ? '' : 'none';
            if (match) { shown++; el.classList.add('visible'); }
          });
          empty.style.display = shown ? 'none' : 'block';
        });
      });
    }).catch(function () { /* keep fallback markup */ });
  }

  // ---- Services -----------------------------------------------------------
  var services = document.querySelector('[data-services]');
  if (services) {
    getJSON('/api/services').then(function (items) {
      if (!Array.isArray(items) || !items.length) return;
      services.innerHTML = items.map(function (s) {
        return '<div class="service-card fade-in">' +
          '<div class="service-icon">' + window.peIcon(s.icon) + '</div>' +
          '<h3 class="service-title">' + esc(s.title) + '</h3>' +
          '<p class="service-desc">' + esc(s.description) + '</p>' +
          '</div>';
      }).join('');
      reveal(services);
    }).catch(function () { /* keep fallback markup */ });
  }
})();
