// Loads portfolio photos, services, journal posts, the Instagram feed and
// announcements from the admin-managed data. The pages ship with fallback
// markup, so if the API can't be reached (for example when opening the HTML
// files directly) nothing breaks.
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

  var PAGE_LINKS = [
    { key: 'home', href: 'index.html' },
    { key: 'portfolio', href: 'portfolio.html' },
    { key: 'services', href: 'services.html' },
    { key: 'about', href: 'about.html' },
    { key: 'testimonials', href: 'testimonials.html' },
    { key: 'faqs', href: 'faqs.html' },
    { key: 'blog', href: 'blog.html' },
    { key: 'contact', href: 'contact.html' }
  ];
  var DEFAULT_NAV_LABELS = { home: 'Home', portfolio: 'Portfolio', services: 'Services', about: 'About', testimonials: 'Testimonials', faqs: 'FAQs', blog: 'Blog', contact: 'Contact' };

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

  function pageSlug() {
    var file = window.location.pathname.split('/').pop().replace(/\.html$/, '');
    return !file || file === 'index' ? 'home' : file;
  }

  function publicImageUrl(image) {
    if (!image) return '';
    try { return new URL(image, window.location.origin + '/').href; }
    catch (_) { return ''; }
  }

  var heroRevealed = false;
  function revealHero() {
    if (heroRevealed) return;
    heroRevealed = true;
    document.body.classList.add('pe-hero-ready');
  }

  function replaceImageWhenLoaded(image, source, done) {
    var url = publicImageUrl(source);
    if (!url || url === image.src) { if (done) done(); return; }
    var candidate = new Image();
    candidate.onload = function () { image.src = url; if (done) done(); };
    candidate.onerror = function () { if (done) done(); };
    candidate.src = url;
  }

  function buildHeroSlideshow(container, urls) {
    ensureStyles();
    container.replaceChildren();
    var slides = urls.map(function (url, index) {
      var slide = document.createElement('div');
      slide.className = 'pe-slide' + (index === 0 ? ' active' : '');
      slide.style.backgroundImage = 'url("' + publicImageUrl(url) + '")';
      container.appendChild(slide);
      return slide;
    });
    var current = 0;
    setInterval(function () {
      slides[current].classList.remove('active');
      current = (current + 1) % slides.length;
      slides[current].classList.add('active');
    }, 5000);
  }

  function loadPageContent() {
    var slug = pageSlug();
    var image = document.querySelector('.hero-bg img, .page-header-bg img, .hero > img');
    if (!image) { revealHero(); return; }

    getJSON('/api/content/page?slug=' + encodeURIComponent(slug)).then(function (page) {
      if (!page) { revealHero(); return; }
      var slides = Array.isArray(page.heroImages)
        ? page.heroImages.filter(function (url) { return url && String(url).trim(); })
        : [];
      var heroBg = document.querySelector('.hero-bg');
      if (slug === 'home' && heroBg && slides.length > 1) {
        buildHeroSlideshow(heroBg, slides);
        revealHero();
      } else if (page.heroImage) {
        replaceImageWhenLoaded(image, page.heroImage, revealHero);
      } else {
        revealHero();
      }
      var kicker = document.querySelector(slug === 'home' ? '.hero-subtitle' : '.page-header-subtitle');
      var title = document.querySelector(slug === 'home' ? '.hero-title' : '.page-header-title');
      if (kicker && page.heroKicker) kicker.textContent = page.heroKicker;
      if (title && page.heroTitle) {
        title.textContent = page.heroTitle;
        title.style.whiteSpace = 'pre-line';
      }
      Object.keys(page.copy || {}).forEach(function (key) {
        document.querySelectorAll('[data-cms-copy="' + key + '"]').forEach(function (element) {
          element.textContent = page.copy[key] == null ? '' : String(page.copy[key]);
          element.style.whiteSpace = 'pre-line';
        });
      });
      var cta = document.querySelector('.hero-content .hero-btn');
      if (cta && slug === 'home') {
        if (page.heroCtaText) cta.textContent = page.heroCtaText;
        if (page.heroCtaHref) cta.href = page.heroCtaHref;
      }
    }).catch(function () { revealHero(); /* keep legacy hero markup */ });
  }

  function loadFaqs() {
    var section = document.querySelector('#faq');
    if (!section) return;
    var list = section.querySelector('.container > div:last-child');
    if (!list) return;

    getJSON('/api/content/faq').then(function (items) {
      if (!Array.isArray(items) || !items.length) return;
      list.replaceChildren();
      items.slice(0, 6).forEach(function (item, index) {
        var row = document.createElement('div');
        row.className = 'fade-in';
        row.style.cssText = 'border-bottom:1px solid var(--border);padding:1.5rem 0';
        var question = document.createElement('h3');
        question.textContent = item.question || '';
        question.style.cssText = 'font-size:1.1rem;margin-bottom:.5rem';
        var answer = document.createElement('p');
        answer.textContent = item.answer || '';
        answer.style.cssText = 'color:var(--text-light);line-height:1.7;font-size:.95rem';
        row.append(question, answer);
        list.appendChild(row);
        observer.observe(row);
      });
      if (items.length > 6) {
        ensureStyles();
        var more = document.createElement('div');
        more.style.textAlign = 'center';
        var link = document.createElement('a');
        link.className = 'testimonial-read';
        link.href = 'faqs.html';
        link.textContent = 'View all FAQs';
        more.appendChild(link);
        list.appendChild(more);
      }
    }).catch(function () { /* keep legacy FAQ markup */ });
  }

  function loadFaqPage() {
    var list = document.querySelector('[data-faq-list]');
    if (!list) return;
    getJSON('/api/content/faq').then(function (items) {
      if (!Array.isArray(items) || !items.length) return;
      ensureStyles();
      var groups = [];
      items.forEach(function (item) {
        var name = (item.category && String(item.category).trim()) || 'General';
        var group = groups.find(function (entry) { return entry.name === name; });
        if (!group) { group = { name: name, items: [] }; groups.push(group); }
        group.items.push(item);
      });
      var chips = document.querySelector('[data-faq-categories]');
      if (chips) {
        chips.innerHTML = ['All'].concat(groups.map(function (group) { return group.name; })).map(function (name, index) {
          return '<button type="button" class="faq-chip' + (index === 0 ? ' active' : '') + '" data-faq-cat="' + esc(name) + '">' + esc(name) + '</button>';
        }).join('');
      }
      list.innerHTML = groups.map(function (group) {
        return '<div class="faq-group" data-faq-group="' + esc(group.name) + '">' +
          '<h2 class="faq-group-title">' + esc(group.name) + '</h2>' +
          group.items.map(function (item) {
            return '<details class="faq-item"><summary>' + esc(item.question || '') + '</summary><p>' + esc(item.answer || '') + '</p></details>';
          }).join('') +
          '</div>';
      }).join('');
      if (chips) {
        chips.addEventListener('click', function (event) {
          var button = event.target.closest('button[data-faq-cat]');
          if (!button) return;
          var category = button.getAttribute('data-faq-cat');
          chips.querySelectorAll('button').forEach(function (item) { item.classList.toggle('active', item === button); });
          list.querySelectorAll('[data-faq-group]').forEach(function (group) {
            group.hidden = category !== 'All' && group.getAttribute('data-faq-group') !== category;
          });
        });
      }
      reveal(list);
    }).catch(function () { /* keep empty state */ });
  }

  function enhanceNavigation() {
    var extras = [
      { href: 'testimonials.html', label: DEFAULT_NAV_LABELS.testimonials },
      { href: 'faqs.html', label: DEFAULT_NAV_LABELS.faqs },
      { href: 'blog.html', label: DEFAULT_NAV_LABELS.blog }
    ];
    document.querySelectorAll('.nav-links, .mobile-menu').forEach(function (nav) {
      extras.forEach(function (extra) {
        if (nav.querySelector('a[href="' + extra.href + '"]')) return;
        var link = document.createElement('a');
        link.href = extra.href;
        link.textContent = extra.label;
        if (nav.classList.contains('mobile-menu')) {
          link.setAttribute('onclick', 'toggleMenu()');
          link.setAttribute('target', '_self');
        }
        nav.appendChild(link);
      });
    });
    document.querySelectorAll('.footer-links').forEach(function (list) {
      extras.forEach(function (extra) {
        if (list.querySelector('a[href="' + extra.href + '"]')) return;
        var item = document.createElement('li');
        var link = document.createElement('a');
        link.href = extra.href;
        link.textContent = extra.label;
        item.appendChild(link);
        list.appendChild(item);
      });
    });

    var toggle = document.querySelector('.mobile-toggle');
    var menu = document.getElementById('mobileMenu');
    if (toggle && menu) {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', 'mobileMenu');
      new MutationObserver(function () {
        toggle.setAttribute('aria-expanded', menu.classList.contains('active') ? 'true' : 'false');
      }).observe(menu, { attributes: true, attributeFilter: ['class'] });
      document.addEventListener('click', function (event) {
        if (!menu.classList.contains('active')) return;
        if (menu.contains(event.target) || toggle.contains(event.target)) return;
        menu.classList.remove('active');
      });
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') menu.classList.remove('active');
      });
      if (!menu.querySelector('a.nav-toggle-cta')) {
        var cta = document.createElement('a');
        cta.href = 'contact.html';
        cta.className = 'nav-toggle-cta';
        cta.textContent = 'Inquire';
        cta.setAttribute('onclick', 'toggleMenu()');
        menu.appendChild(cta);
      }
    }
  }

  function loadBlog() {
    var grid = document.querySelector('[data-blog-list]');
    if (!grid) return;

    getJSON('/api/content/blog').then(function (posts) {
      if (!Array.isArray(posts)) return;
      var slug = new URLSearchParams(window.location.search).get('post');
      if (slug) {
        var post = posts.find(function (item) { return item.slug === slug; });
        if (!post) return;
        grid.classList.add('is-article');
        var article = document.createElement('article');
        article.className = 'blog-article';
        if (post.coverImage) {
          var image = document.createElement('img');
          image.src = publicImageUrl(post.coverImage);
          image.alt = post.title || '';
          image.className = 'blog-cover';
          article.appendChild(image);
        }
        var title = document.createElement('h1');
        title.textContent = post.title || '';
        article.appendChild(title);
        var date = document.createElement('p');
        date.className = 'blog-date';
        date.textContent = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : '';
        article.appendChild(date);
        String(post.body || '').split(/\n{2,}/).filter(Boolean).forEach(function (text) {
          var paragraph = document.createElement('p');
          paragraph.textContent = text;
          article.appendChild(paragraph);
        });
        grid.replaceChildren(article);
        return;
      }

      if (!posts.length) return;
      grid.replaceChildren();
      posts.forEach(function (post) {
        var card = document.createElement('article');
        card.className = 'blog-card';
        if (post.coverImage) {
          var image = document.createElement('img');
          image.src = publicImageUrl(post.coverImage);
          image.alt = post.title || '';
          card.appendChild(image);
        }
        var title = document.createElement('h2');
        title.textContent = post.title || '';
        var excerpt = document.createElement('p');
        excerpt.textContent = post.excerpt || '';
        var link = document.createElement('a');
        link.href = 'blog.html?post=' + encodeURIComponent(post.slug);
        link.textContent = 'Read story';
        card.append(title, excerpt, link);
        grid.appendChild(card);
      });
    }).catch(function () { /* keep empty state */ });
  }

  // ---- Instagram / "Follow Our Journey" -----------------------------------
  var ICON_HEART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
  var ICON_COMMENT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
  var ICON_SEND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
  var ICON_INSTA = '<svg class="instagram-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>';

  function instagramCard(post) {
    var card = document.createElement('div');
    card.className = 'instagram-card fade-in';
    var image = post.image ? (publicImageUrl(post.image) || post.image) : 'abi.png';
    var link = post.link ? esc(post.link) : '';
    var open = link ? '<a href="' + link + '" target="_blank" rel="noopener">' : '';
    var close = link ? '</a>' : '';
    card.innerHTML =
      '<div class="instagram-card-header">' +
        '<img src="abi.png" alt="Perfectevent4u" class="instagram-avatar">' +
        '<div class="instagram-user-info"><div class="instagram-username">perfectevent4u</div>' +
        '<div class="instagram-date">' + esc(post.dateLabel || '') + '</div></div>' +
        ICON_INSTA +
      '</div>' +
      open + '<img src="' + esc(image) + '" alt="' + esc(post.caption || '') + '" class="instagram-card-image">' + close +
      '<div class="instagram-card-caption">' + esc(post.caption || '') + '</div>' +
      '<div class="instagram-card-actions">' +
        '<div class="instagram-actions-left">' +
          '<span class="instagram-action-btn">' + ICON_HEART + esc(String(post.likes || 0)) + '</span>' +
          '<span class="instagram-action-btn">' + ICON_COMMENT + esc(String(post.comments || 0)) + '</span>' +
        '</div>' +
        (link ? '<a class="instagram-action-btn" href="' + link + '" target="_blank" rel="noopener">' + ICON_SEND + '</a>'
              : '<span class="instagram-action-btn">' + ICON_SEND + '</span>') +
      '</div>';
    return card;
  }

  function loadInstagram() {
    var feed = document.querySelector('[data-instagram]');
    if (!feed) return;
    getJSON('/api/instagram').then(function (data) {
      var posts = Array.isArray(data) ? data : (data && Array.isArray(data.posts) ? data.posts : []);
      if (!posts.length) return;
      feed.replaceChildren();
      posts.forEach(function (post) { feed.appendChild(instagramCard(post)); });
      reveal(feed);
    }).catch(function () { /* keep static fallback */ });
  }

  // ---- Announcements ------------------------------------------------------
  var SITE_CSS = [
    '.pe-announce-bar{position:fixed;top:0;left:0;right:0;height:42px;background:var(--text,#202946);color:#fff;z-index:1200;overflow:hidden;display:flex;align-items:center;font-size:.78rem;letter-spacing:.08em;text-transform:uppercase}',
    '.pe-announce-bar a{color:inherit;text-decoration:none;display:block;overflow:hidden;width:100%}',
    '.pe-announce-track{display:inline-flex;white-space:nowrap;animation:pe-marquee 30s linear infinite}',
    '.pe-announce-bar:hover .pe-announce-track{animation-play-state:paused}',
    '.pe-announce-msg{padding:0 .25rem}',
    '.pe-announce-dot{padding:0 1.25rem;opacity:.55}',
    '@keyframes pe-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}',
    'body.pe-announce-on{padding-top:42px}',
    'body.pe-announce-on #navbar,body.pe-announce-on nav{top:42px}',
    '.pe-album-badge{position:absolute;top:.75rem;right:.75rem;background:rgba(32,41,70,.85);color:#fff;font-size:.6rem;text-transform:uppercase;letter-spacing:.14em;padding:.3rem .6rem;z-index:2}',
    '.pe-album-item::after{content:"View album";position:absolute;left:1rem;bottom:1rem;background:rgba(255,255,255,.92);color:#202946;font-size:.6rem;text-transform:uppercase;letter-spacing:.14em;padding:.35rem .7rem;opacity:0;transform:translateY(.5rem);transition:all .4s ease;z-index:2}',
    '.pe-album-item:hover::after{opacity:1;transform:translateY(0)}',
    '.pe-popup{position:fixed;inset:0;z-index:2100;display:flex;align-items:center;justify-content:center;padding:1.5rem;background:rgba(32,41,70,.55)}',
    '.pe-popup[hidden]{display:none}',
    '.pe-popup-panel{background:#fff;max-width:440px;width:100%;position:relative;box-shadow:0 20px 60px rgba(0,0,0,.35);overflow:hidden}',
    '.pe-popup-panel img{width:100%;display:block}',
    '.pe-popup-body{padding:1.5rem}',
    '.pe-popup-body h3{font-family:"Playfair Display",Georgia,serif;font-size:1.5rem;margin-bottom:.5rem;font-weight:400}',
    '.pe-popup-body p{color:#555;line-height:1.6;font-size:.92rem;margin-bottom:1rem}',
    '.pe-popup-cta{display:inline-block;padding:.75rem 1.5rem;background:var(--text,#202946);color:#fff;text-decoration:none;font-size:.7rem;text-transform:uppercase;letter-spacing:.18em}',
    '.pe-popup-close{position:absolute;top:.4rem;right:.4rem;width:2rem;height:2rem;border:none;border-radius:50%;background:rgba(255,255,255,.9);cursor:pointer;font-size:1.2rem;line-height:1;color:#202946}',
    '.pe-modal{position:fixed;inset:0;z-index:2050;display:flex;align-items:center;justify-content:center;padding:1rem}',
    '.pe-modal[hidden]{display:none}',
    '.pe-modal-backdrop{position:absolute;inset:0;background:rgba(20,25,45,.78)}',
    '.pe-modal-panel{position:relative;background:#fff;max-width:1100px;width:100%;max-height:92vh;display:flex;flex-direction:column;overflow:hidden}',
    '.pe-modal-head{padding:1.25rem 1.5rem;border-bottom:1px solid rgba(0,0,0,.08);display:flex;justify-content:space-between;align-items:flex-start;gap:1rem}',
    '.pe-modal-head h2{font-family:"Playfair Display",Georgia,serif;font-size:1.5rem;font-weight:400}',
    '.pe-modal-head p{color:#777;font-size:.78rem;text-transform:uppercase;letter-spacing:.15em;margin-top:.3rem}',
    '.pe-modal-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:.6rem;padding:1rem;overflow-y:auto}',
    '.pe-modal-grid img{width:100%;height:170px;object-fit:cover;cursor:zoom-in;display:block}',
    '.pe-modal-close{background:none;border:none;font-size:1.8rem;line-height:1;cursor:pointer;color:#202946}',
    '.pe-lightbox{position:fixed;inset:0;z-index:2200;display:flex;align-items:center;justify-content:center;background:rgba(10,12,20,.94)}',
    '.pe-lightbox[hidden]{display:none}',
    '.pe-lightbox img{max-width:90vw;max-height:82vh;object-fit:contain;display:block}',
    '.pe-lightbox-media{display:flex;align-items:center;justify-content:center}',
    '.pe-lightbox video{max-width:90vw;max-height:82vh;display:block;background:#000}',
    '.masonry-item video.pe-auto{width:100%;display:block;transition:transform .7s ease}',
    '.pe-modal-grid video{width:100%;height:170px;object-fit:cover;cursor:zoom-in;display:block;background:#000}',
    '.pe-slide{position:absolute;inset:0;background-size:cover;background-position:center;opacity:0;transition:opacity 1.4s ease;filter:blur(3px) brightness(.85)}',
    '.pe-slide.active{opacity:1}',
    '.pe-lightbox-cap{position:absolute;bottom:1.25rem;left:0;right:0;text-align:center;color:#fff;font-size:.85rem;letter-spacing:.05em;padding:0 1rem}',
    '.pe-lightbox button{position:absolute;background:rgba(255,255,255,.14);color:#fff;border:none;width:3rem;height:3rem;cursor:pointer;font-size:1.5rem;border-radius:50%;line-height:1}',
    '.pe-lightbox .pe-lb-close{top:1rem;right:1rem;width:2.5rem;height:2.5rem;font-size:1.2rem}',
    '.pe-lightbox .pe-lb-prev{left:1rem;top:50%;transform:translateY(-50%)}',
    '.pe-lightbox .pe-lb-next{right:1rem;top:50%;transform:translateY(-50%)}',
    '.portfolio-empty{text-align:center;color:var(--text-light);padding:3rem 0}',
    /* awards */
    '.award-item{display:block;text-decoration:none;color:inherit}',
    '.award-clone{display:none}',
    '@media (max-width:767px){.award-clone{display:block}}',
    /* socials */
    '.social-links{display:flex;gap:.6rem;flex-wrap:wrap}',
    '.social-link{display:inline-flex;align-items:center;justify-content:center;width:2.5rem;height:2.5rem;border-radius:50%;border:1px solid currentColor;color:inherit;transition:opacity .3s,background .3s;opacity:.8;text-decoration:none}',
    '.social-link:hover{opacity:1;background:rgba(128,128,128,.18)}',
    '.social-link svg{width:1rem;height:1rem}',
    /* google map */
    '.pe-map-wrap{position:relative;height:400px;width:100%}',
    '.pe-map{width:100%;height:100%;border:0;display:block;filter:grayscale(15%)}',
    '.pe-map-link{position:absolute;left:1rem;bottom:1rem;background:#fff;color:#202946;padding:.65rem 1.1rem;font-size:.68rem;text-transform:uppercase;letter-spacing:.16em;text-decoration:none;box-shadow:0 6px 18px rgba(0,0,0,.18)}',
    /* testimonials */
    '.testimonial-grid{display:grid;grid-template-columns:1fr;gap:2rem}',
    '@media (min-width:768px){.testimonial-grid{grid-template-columns:repeat(2,1fr)}}',
    '.testimonial-card{border:1px solid var(--border);background:#fff;padding:2rem;display:flex;flex-direction:column;gap:1rem}',
    '.testimonial-card .pe-quote{font-family:"Playfair Display",Georgia,serif;font-size:1.2rem;line-height:1.55;font-style:italic}',
    '.testimonial-card .pe-author{font-weight:700;text-transform:uppercase;letter-spacing:.18em;font-size:.75rem}',
    '.testimonial-card .pe-role{font-size:.7rem;text-transform:uppercase;letter-spacing:.15em;color:var(--text-light)}',
    '.testimonial-card .pe-review{font-size:.7rem;text-transform:uppercase;letter-spacing:.16em;color:var(--text);text-decoration:none;border-bottom:1px solid currentColor;align-self:flex-start;margin-top:auto}',
    '.testimonial-read{display:inline-block;margin-top:1.25rem;font-size:.7rem;letter-spacing:.16em;text-transform:uppercase;color:inherit;border-bottom:1px solid currentColor;text-decoration:none}',
    /* preferred suppliers */
    '.supplier-grid{display:grid;grid-template-columns:1fr;gap:2rem}',
    '@media (min-width:768px){.supplier-grid{grid-template-columns:repeat(3,1fr)}}',
    '.supplier-card{border-top:1px solid var(--border);padding-top:1.75rem;display:flex;flex-direction:column;gap:.55rem}',
    '.supplier-logo{width:56px;height:56px;object-fit:contain;margin-bottom:.35rem}',
    '.supplier-category{font-size:.64rem;text-transform:uppercase;letter-spacing:.2em;color:var(--text-light)}',
    '.supplier-name{font-family:"Playfair Display",Georgia,serif;font-size:1.3rem;font-weight:400}',
    '.supplier-desc{color:var(--text-light);line-height:1.7;font-size:.92rem}',
    '.supplier-link{font-size:.68rem;text-transform:uppercase;letter-spacing:.16em;color:inherit;text-decoration:none;border-bottom:1px solid currentColor;align-self:flex-start;margin-top:.5rem}',
    '.service-icon-img{width:52px;height:52px;object-fit:contain;display:block}',
    /* FAQ page */
    '.faq-tools{display:flex;gap:.5rem;flex-wrap:wrap;justify-content:center;margin-bottom:2.5rem}',
    '.faq-chip{font-family:inherit;font-size:.68rem;text-transform:uppercase;letter-spacing:.14em;padding:.5rem 1rem;border:1px solid var(--border);background:transparent;color:inherit;cursor:pointer}',
    '.faq-chip.active{border-color:currentColor;box-shadow:inset 0 0 0 1px currentColor}',
    '.faq-group{margin-bottom:3rem}',
    '.faq-group-title{font-family:"Playfair Display",Georgia,serif;font-size:1.5rem;font-weight:400;margin-bottom:1rem}',
    '.faq-item{border-bottom:1px solid var(--border);padding:1rem 0}',
    '.faq-item summary{cursor:pointer;font-size:1.05rem;font-family:"Playfair Display",Georgia,serif;list-style:none}',
    '.faq-item summary::-webkit-details-marker{display:none}',
    '.faq-item summary::after{content:"+";float:right;color:var(--text-light)}',
    '.faq-item[open] summary::after{content:"\\2212"}',
    '.faq-item p{margin-top:.75rem;color:var(--text-light);line-height:1.7;font-size:.95rem}',
    /* inquiry form */
    '.form-status{margin-top:.9rem;font-size:.85rem;min-height:1.2rem}',
    '.form-status.err{color:#a3302b}',
    '.form-status.ok{color:#2f6b4f}',
    /* mobile refinements */
    '.hero{height:100vh;height:100svh}',
    '.nav-toggle-cta{display:block;padding:1rem 0;text-decoration:none;color:var(--text);font-size:.85rem;text-transform:uppercase;letter-spacing:.15em}',
    '@media (max-width:640px){section{padding:3.5rem 1.25rem}.page-header{height:52vh;min-height:320px}.about-image img{height:320px}.about-story-image img{height:360px}.testimonial-slider{min-height:400px}.portfolio-search{min-width:0;width:100%}.portfolio-select{width:100%}.hero-content{margin-top:2rem}.pe-map-wrap{height:300px}.pe-modal-grid{grid-template-columns:repeat(auto-fill,minmax(120px,1fr))}.pe-modal-head h2{font-size:1.25rem}.instagram-header h2{font-size:1.8rem}}',
    '@media (hover:none){.masonry-info{opacity:1;transform:none}.masonry-overlay{background:linear-gradient(to top,rgba(32,41,70,.55),transparent 60%)}.pe-album-item::after{opacity:1;transform:none}}',
    '@media (prefers-reduced-motion:reduce){.pe-announce-track,.awards-track{animation:none!important}.fade-in{opacity:1!important;transform:none!important}}'
  ].join('\n');

  function ensureStyles() {
    if (document.getElementById('pe-site-styles')) return;
    var style = document.createElement('style');
    style.id = 'pe-site-styles';
    style.textContent = SITE_CSS;
    document.head.appendChild(style);
  }

  function renderAnnouncementBar(notice) {
    if (!notice || !notice.barEnabled) return;
    var messages = (notice.barMessages || []).map(function (m) { return String(m || '').trim(); }).filter(Boolean);
    if (!messages.length) return;
    ensureStyles();
    var seq = messages.map(function (m) {
      return '<span class="pe-announce-msg">' + esc(m) + '</span>';
    }).join('<span class="pe-announce-dot">&#9670;</span>');
    var track = document.createElement('div');
    track.className = 'pe-announce-track';
    track.style.animationDuration = String(Math.max(10, Number(notice.barSpeed) || 34)) + 's';
    track.innerHTML = seq + seq;
    var bar = document.createElement('div');
    bar.className = 'pe-announce-bar';
    if (notice.barLink) {
      var link = document.createElement('a');
      link.href = notice.barLink;
      if (/^https?:/i.test(notice.barLink)) { link.target = '_blank'; link.rel = 'noopener'; }
      link.appendChild(track);
      bar.appendChild(link);
    } else {
      bar.appendChild(track);
    }
    document.body.classList.add('pe-announce-on');
    document.body.insertBefore(bar, document.body.firstChild);
  }

  function renderAnnouncementPopup(notice) {
    if (!notice || !notice.popupEnabled || !notice.popupImage) return;
    var key = 'pe_popup_' + notice.popupImage;
    try { if (localStorage.getItem(key)) return; } catch (_) { /* storage may be blocked */ }
    ensureStyles();
    var delay = Math.max(0, Number(notice.popupDelay) || 1) * 1000;
    setTimeout(function () {
      try { localStorage.setItem(key, '1'); } catch (_) { /* ignore */ }
      var overlay = document.createElement('div');
      overlay.className = 'pe-popup';
      var cta = notice.popupLink
        ? '<a class="pe-popup-cta" href="' + esc(notice.popupLink) + '"' + (/^https?:/i.test(notice.popupLink) ? ' target="_blank" rel="noopener"' : '') + '>' + esc(notice.popupCtaText || 'Learn more') + '</a>'
        : '';
      var body = (notice.popupTitle || notice.popupText || cta)
        ? '<div class="pe-popup-body">' +
            (notice.popupTitle ? '<h3>' + esc(notice.popupTitle) + '</h3>' : '') +
            (notice.popupText ? '<p>' + esc(notice.popupText) + '</p>' : '') + cta +
          '</div>'
        : '';
      overlay.innerHTML =
        '<div class="pe-popup-panel">' +
          '<button class="pe-popup-close" type="button" aria-label="Close">&times;</button>' +
          '<img src="' + esc(publicImageUrl(notice.popupImage) || notice.popupImage) + '" alt="' + esc(notice.popupTitle || 'Announcement') + '">' +
          body +
        '</div>';
      overlay.querySelector('.pe-popup-close').addEventListener('click', function () { overlay.remove(); });
      overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
      document.body.appendChild(overlay);
    }, delay);
  }

  function loadAnnouncement() {
    getJSON('/api/content/announcement?slug=site').then(function (notice) {
      if (!notice) return;
      renderAnnouncementBar(notice);
      renderAnnouncementPopup(notice);
    }).catch(function () { /* no announcements configured */ });
  }

  // ---- Portfolio ----------------------------------------------------------
  function searchBlob(p) {
    var parts = [p.title, p.location, p.category];
    if (p.type === 'album' && Array.isArray(p.photos)) {
      p.photos.forEach(function (photo) { parts.push(photo.title, photo.location, photo.category); });
    }
    return parts.filter(Boolean).join(' ').toLowerCase();
  }

  function locationList(p) {
    var list = [];
    if (p.location) list.push(p.location);
    if (p.type === 'album' && Array.isArray(p.photos)) {
      p.photos.forEach(function (photo) {
        if (photo.location && list.indexOf(photo.location) === -1) list.push(photo.location);
      });
    }
    return list.join('|');
  }

  function isVideo(item) {
    return Boolean(item) && item.mediaType === 'video';
  }

  var videoObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var video = entry.target;
      if (entry.isIntersecting) {
        var result = video.play();
        if (result && result.catch) result.catch(function () {});
      } else {
        video.pause();
      }
    });
  }, { threshold: 0.35 });

  function activateVideos(root) {
    root.querySelectorAll('video.pe-auto').forEach(function (video) { videoObserver.observe(video); });
  }

  function card(p) {
    var isAlbum = p.type === 'album';
    var video = isVideo(p);
    var attrs = 'class="masonry-item fade-in' + (isAlbum ? ' pe-album-item' : '') + '"' +
      ' data-category="' + esc(p.category) + '"' +
      ' data-type="' + (isAlbum ? 'album' : 'photo') + '"' +
      ' data-id="' + esc(p.id) + '"' +
      ' data-search="' + esc(searchBlob(p)) + '"' +
      ' data-locations="' + esc(locationList(p)) + '"' +
      (isAlbum ? ' data-album-id="' + esc(p.id) + '" role="button" tabindex="0"' : '');
    var badge = isAlbum
      ? '<span class="pe-album-badge">' + (p.photos ? p.photos.length : 0) + (video ? ' clips' : ' photos') + '</span>'
      : (video ? '<span class="pe-album-badge">Video</span>' : '');
    var media = video
      ? '<video class="pe-auto" src="' + esc(publicImageUrl(p.image) || p.image) + '" muted loop playsinline preload="metadata"></video>'
      : '<img src="' + esc(imageSrc(p)) + '" alt="' + esc(p.title) + '" loading="lazy">';
    return '<div ' + attrs + '>' + media + badge +
      '<div class="masonry-overlay"><div class="masonry-info">' +
      (p.location ? '<p class="masonry-location">' + esc(p.location) + '</p>' : '') +
      '<h3 class="masonry-name">' + esc(p.title) + '</h3>' +
      '</div></div></div>';
  }

  var albumModal = null;
  var lightbox = null;

  function ensureAlbumModal() {
    if (albumModal) return albumModal;
    ensureStyles();
    albumModal = document.createElement('div');
    albumModal.className = 'pe-modal';
    albumModal.hidden = true;
    albumModal.innerHTML =
      '<div class="pe-modal-backdrop"></div>' +
      '<div class="pe-modal-panel" role="dialog" aria-modal="true">' +
        '<div class="pe-modal-head"><div><h2></h2><p></p></div>' +
        '<button class="pe-modal-close" type="button" aria-label="Close">&times;</button></div>' +
        '<div class="pe-modal-grid"></div>' +
      '</div>';
    albumModal.querySelector('.pe-modal-close').addEventListener('click', closeAlbumModal);
    albumModal.querySelector('.pe-modal-backdrop').addEventListener('click', closeAlbumModal);
    document.body.appendChild(albumModal);
    return albumModal;
  }

  function openAlbumModal(album) {
    var modal = ensureAlbumModal();
    var photos = (album.photos || []).slice();
    if (photos.length) {
      var coverIndex = photos.findIndex(function (photo) { return photo.image === album.image; });
      if (coverIndex > 0) photos.unshift(photos.splice(coverIndex, 1)[0]);
    }
    modal.querySelector('.pe-modal-head h2').textContent = album.title || '';
    modal.querySelector('.pe-modal-head p').textContent = [album.location, photos.length + (photos.length === 1 ? ' photo' : ' photos')]
      .filter(Boolean).join(' \u00b7 ');
    var box = modal.querySelector('.pe-modal-grid');
    box.replaceChildren();
    photos.forEach(function (photo, index) {
      var media;
      if (isVideo(photo)) {
        media = document.createElement('video');
        media.src = publicImageUrl(photo.image) || photo.image || '';
        media.muted = true;
        media.loop = true;
        media.playsInline = true;
        media.preload = 'metadata';
        media.className = 'pe-modal-video';
      } else {
        media = document.createElement('img');
        media.src = publicImageUrl(photo.image) || photo.image || '';
        media.alt = photo.title || album.title || '';
        media.loading = 'lazy';
      }
      media.addEventListener('click', function () { openLightbox(photos, index); });
      box.appendChild(media);
    });
    activateVideos(box);
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeAlbumModal() {
    if (!albumModal) return;
    albumModal.hidden = true;
    document.body.style.overflow = '';
  }

  function ensureLightbox() {
    if (lightbox) return lightbox;
    ensureStyles();
    lightbox = document.createElement('div');
    lightbox.className = 'pe-lightbox';
    lightbox.hidden = true;
    lightbox.innerHTML =
      '<button class="pe-lb-close" type="button" aria-label="Close">&times;</button>' +
      '<button class="pe-lb-prev" type="button" aria-label="Previous">&#8249;</button>' +
      '<div class="pe-lightbox-media"></div>' +
      '<button class="pe-lb-next" type="button" aria-label="Next">&#8250;</button>' +
      '<div class="pe-lightbox-cap"></div>';
    lightbox.querySelector('.pe-lb-close').addEventListener('click', closeLightbox);
    lightbox.querySelector('.pe-lb-prev').addEventListener('click', function () { stepLightbox(-1); });
    lightbox.querySelector('.pe-lb-next').addEventListener('click', function () { stepLightbox(1); });
    lightbox.addEventListener('click', function (e) { if (e.target === lightbox) closeLightbox(); });
    document.addEventListener('keydown', function (e) {
      if (lightbox.hidden) return;
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') stepLightbox(-1);
      else if (e.key === 'ArrowRight') stepLightbox(1);
    });
    document.body.appendChild(lightbox);
    return lightbox;
  }

  var lightboxPhotos = [];
  var lightboxIndex = 0;

  function showLightboxPhoto() {
    var photo = lightboxPhotos[lightboxIndex];
    if (!photo) return;
    var container = lightbox.querySelector('.pe-lightbox-media');
    container.replaceChildren();
    if (isVideo(photo)) {
      var video = document.createElement('video');
      video.src = publicImageUrl(photo.image) || photo.image || '';
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      container.appendChild(video);
    } else {
      var image = document.createElement('img');
      image.src = publicImageUrl(photo.image) || photo.image || '';
      image.alt = photo.title || '';
      container.appendChild(image);
    }
    lightbox.querySelector('.pe-lightbox-cap').textContent =
      [photo.title, photo.location].filter(Boolean).join(' \u00b7 ');
    var many = lightboxPhotos.length > 1;
    lightbox.querySelector('.pe-lb-prev').hidden = !many;
    lightbox.querySelector('.pe-lb-next').hidden = !many;
  }

  function openLightbox(photos, index) {
    ensureLightbox();
    lightboxPhotos = photos.slice();
    lightboxIndex = index;
    showLightboxPhoto();
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function stepLightbox(direction) {
    if (lightboxPhotos.length < 2) return;
    lightboxIndex = (lightboxIndex + direction + lightboxPhotos.length) % lightboxPhotos.length;
    showLightboxPhoto();
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.hidden = true;
    if (!albumModal || albumModal.hidden) document.body.style.overflow = '';
  }

  function wirePortfolioInteractions(grid, allItems) {
    var photoList = allItems.filter(function (item) { return item.type !== 'album'; });
    var albumById = {};
    allItems.forEach(function (item) { if (item.type === 'album') albumById[item.id] = item; });

    function activate(el) {
      var albumId = el.getAttribute('data-album-id') || (el.getAttribute('data-type') === 'album' ? el.getAttribute('data-id') : null);
      if (albumId && albumById[albumId]) { openAlbumModal(albumById[albumId]); return; }
      var index = -1;
      for (var i = 0; i < photoList.length; i++) {
        if (photoList[i].id === el.getAttribute('data-id')) { index = i; break; }
      }
      if (index !== -1) openLightbox(photoList, index);
    }

    grid.addEventListener('click', function (e) {
      var el = e.target.closest('.masonry-item');
      if (el) activate(el);
    });
    grid.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var el = e.target.closest('.masonry-item');
      if (el) { e.preventDefault(); activate(el); }
    });
  }

  function wirePortfolioFilters(grid, displayed) {
    var buttons = document.querySelectorAll('[data-filter]');
    var search = document.getElementById('portfolioSearch');
    var locationSelect = document.getElementById('portfolioLocation');
    if (!buttons.length && !search && !locationSelect) return;

    var locations = [];
    displayed.forEach(function (item) {
      var values = [item.location];
      if (item.type === 'album' && Array.isArray(item.photos)) {
        item.photos.forEach(function (photo) { values.push(photo.location); });
      }
      values.forEach(function (value) {
        if (value && locations.indexOf(value) === -1) locations.push(value);
      });
    });
    locations.sort();
    if (locationSelect) {
      locations.forEach(function (value) {
        var option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        locationSelect.appendChild(option);
      });
    }

    var empty = document.createElement('p');
    empty.className = 'portfolio-empty';
    empty.textContent = 'No photos match your search yet.';
    empty.hidden = true;
    grid.parentNode.appendChild(empty);

    var activeCategory = 'all';
    function apply() {
      var query = search ? search.value.trim().toLowerCase() : '';
      var location = locationSelect ? locationSelect.value : 'all';
      var shown = 0;
      grid.querySelectorAll('.masonry-item').forEach(function (el) {
        var matchCategory = activeCategory === 'all' || el.getAttribute('data-category') === activeCategory;
        var matchLocation = location === 'all' || (el.getAttribute('data-locations') || '').split('|').indexOf(location) !== -1;
        var matchQuery = !query || (el.getAttribute('data-search') || '').indexOf(query) !== -1;
        var match = matchCategory && matchLocation && matchQuery;
        el.style.display = match ? '' : 'none';
        if (match) { shown++; el.classList.add('visible'); }
      });
      empty.hidden = shown > 0;
    }

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeCategory = btn.getAttribute('data-filter');
        buttons.forEach(function (b) { b.classList.toggle('active', b === btn); });
        apply();
      });
    });
    if (search) search.addEventListener('input', apply);
    if (locationSelect) locationSelect.addEventListener('change', apply);
    apply();
  }

  var grid = document.querySelector('[data-portfolio]');
  if (grid) {
    var mode = grid.getAttribute('data-portfolio');
    getJSON('/api/portfolio').then(function (items) {
      if (!Array.isArray(items) || !items.length) return;

      var displayed = items;
      if (mode === 'home') {
        var featured = items.filter(function (i) { return i.featured; }).slice().sort(function (a, b) {
          var ao = a.featuredOrder === null || a.featuredOrder === undefined ? Infinity : a.featuredOrder;
          var bo = b.featuredOrder === null || b.featuredOrder === undefined ? Infinity : b.featuredOrder;
          if (ao !== bo) return ao - bo;
          return (a.sortOrder || 0) - (b.sortOrder || 0);
        });
        var others = items.filter(function (i) { return !i.featured; });
        displayed = featured.concat(others).slice(0, 6);
      }

      grid.innerHTML = displayed.map(card).join('');
      reveal(grid);
      activateVideos(grid);
      wirePortfolioInteractions(grid, items);
      if (mode !== 'home') wirePortfolioFilters(grid, displayed);
    }).catch(function () { /* keep fallback markup */ });
  }

  // ---- Services -----------------------------------------------------------
  var services = document.querySelector('[data-services]');
  if (services) {
    getJSON('/api/services').then(function (items) {
      if (!Array.isArray(items) || !items.length) return;
      services.innerHTML = items.map(function (s) {
        var icon = s.image
          ? '<img class="service-icon-img" src="' + esc(publicImageUrl(s.image) || s.image) + '" alt="" loading="lazy">'
          : window.peIcon(s.icon);
        return '<div class="service-card fade-in">' +
          '<div class="service-icon">' + icon + '</div>' +
          '<h3 class="service-title">' + esc(s.title) + '</h3>' +
          '<p class="service-desc">' + esc(s.description) + '</p>' +
          '</div>';
      }).join('');
      reveal(services);
    }).catch(function () { /* keep fallback markup */ });
  }

  // ---- Social links, settings and Google map ------------------------------
  var SOCIAL_ICONS = {
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-1.92 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/></svg>'
  };
  var SOCIAL_LABELS = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube' };

  function applyNavLabels(labels) {
    PAGE_LINKS.forEach(function (page) {
      var label = labels[page.key];
      if (!label) return;
      document.querySelectorAll('.nav-links a[href="' + page.href + '"], .mobile-menu a[href="' + page.href + '"], .links a[href="' + page.href + '"], .footer-links a[href="' + page.href + '"]').forEach(function (link) {
        if (link.classList.contains('nav-btn') || link.classList.contains('nav-toggle-cta')) return;
        link.textContent = label;
      });
    });
    var slug = pageSlug();
    if (labels[slug]) document.title = labels[slug] + ' | Perfectevent4u';
  }

  function applySettings(settings) {
    if (!settings || typeof settings !== 'object') return;
    ensureStyles();

    applyNavLabels(Object.assign({}, DEFAULT_NAV_LABELS, settings.navLabels || {}));

    var networks = ['instagram', 'facebook', 'tiktok', 'youtube'].filter(function (network) {
      return typeof settings[network] === 'string' && settings[network].trim();
    });
    document.querySelectorAll('[data-socials]').forEach(function (container) {
      if (!networks.length) return;
      container.replaceChildren();
      networks.forEach(function (network) {
        var link = document.createElement('a');
        link.className = 'social-link';
        link.href = String(settings[network]).trim();
        link.target = '_blank';
        link.rel = 'noopener';
        link.setAttribute('aria-label', SOCIAL_LABELS[network]);
        link.innerHTML = SOCIAL_ICONS[network];
        container.appendChild(link);
      });
    });

    var mapWrap = document.querySelector('[data-map]');
    if (mapWrap) {
      var query = (typeof settings.mapLocation === 'string' && settings.mapLocation.trim()) || 'Harlow, Essex, United Kingdom';
      var directions = (typeof settings.mapDirectionsUrl === 'string' && settings.mapDirectionsUrl.trim()) ||
        ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query));
      mapWrap.innerHTML =
        '<div class="pe-map-wrap">' +
          '<iframe class="pe-map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=' + encodeURIComponent(query) + '&output=embed" title="Perfectevent4u location"></iframe>' +
          '<a class="pe-map-link" href="' + esc(directions) + '" target="_blank" rel="noopener">Get directions</a>' +
        '</div>';
    }

    if (typeof settings.mapLocation === 'string' && settings.mapLocation.trim()) {
      document.querySelectorAll('[data-cms-copy="location"]').forEach(function (element) {
        element.textContent = settings.mapLocation.trim();
      });
    }
  }

  function loadSettings() {
    getJSON('/api/content/settings?slug=site').then(applySettings).catch(function () { /* keep static */ });
  }

  function loadPageVisibility() {
    getJSON('/api/content/page').then(function (pages) {
      if (!Array.isArray(pages)) return;
      var offline = {};
      pages.forEach(function (page) { if (page && page.offline) offline[page.slug] = true; });
      var slug = pageSlug();
      if (slug !== 'home' && offline[slug]) { window.location.replace('index.html'); return; }
      PAGE_LINKS.forEach(function (page) {
        if (!offline[page.key]) return;
        document.querySelectorAll('.nav-links a[href="' + page.href + '"], .mobile-menu a[href="' + page.href + '"], .links a[href="' + page.href + '"], .footer-links a[href="' + page.href + '"]').forEach(function (link) { link.remove(); });
      });
    }).catch(function () { /* keep pages online */ });
  }

  // ---- Awards -------------------------------------------------------------
  function loadAwards() {
    var track = document.querySelector('[data-awards]');
    if (!track) return;
    getJSON('/api/content/award').then(function (awards) {
      if (!Array.isArray(awards) || !awards.length) return;
      ensureStyles();
      track.replaceChildren();
      var build = function (award, clone) {
        var url = award.link ? String(award.link).trim() : '';
        var item = document.createElement(url ? 'a' : 'div');
        item.className = 'award-item' + (clone ? ' award-clone' : '');
        if (url) { item.href = url; item.target = '_blank'; item.rel = 'noopener'; }
        if (clone) item.setAttribute('aria-hidden', 'true');
        var image = award.image ? (publicImageUrl(award.image) || award.image) : '';
        item.innerHTML =
          (image ? '<img src="' + esc(image) + '" alt="' + esc(award.name || '') + '" loading="lazy">' : '') +
          (award.label ? '<p class="award-label">' + esc(award.label) + '</p>' : '') +
          '<p class="award-name">' + esc(award.name || '') + '</p>';
        return item;
      };
      awards.forEach(function (award) { track.appendChild(build(award, false)); });
      awards.forEach(function (award) { track.appendChild(build(award, true)); });
    }).catch(function () { /* keep static */ });
  }

  // ---- Testimonials -------------------------------------------------------
  function testimonialLink(item) {
    if (!item.link || !String(item.link).trim()) return '';
    return '<a class="pe-review" href="' + esc(String(item.link).trim()) + '" target="_blank" rel="noopener">' + esc(item.linkLabel || 'Read the review') + '</a>';
  }

  function renderTestimonialSlider(container, items) {
    ensureStyles();
    container.innerHTML = items.map(function (item, index) {
      return '<div class="testimonial-item' + (index === 0 ? ' active' : '') + '">' +
        '<p class="testimonial-quote">' + esc(item.quote || '') + '</p>' +
        '<p class="testimonial-author">' + esc(item.author || '') + '</p>' +
        (item.role ? '<p class="testimonial-role">' + esc(item.role) + '</p>' : '') +
        testimonialLink(item) +
        '</div>';
    }).join('');

    var dots = container.parentNode ? container.parentNode.querySelector('.testimonial-dots') : null;
    var slides = container.querySelectorAll('.testimonial-item');
    var current = 0;
    function show(index) {
      slides[current].classList.remove('active');
      if (dots && dots.children[current]) dots.children[current].classList.remove('active');
      current = index;
      slides[current].classList.add('active');
      if (dots && dots.children[current]) dots.children[current].classList.add('active');
    }
    if (dots) {
      dots.innerHTML = items.map(function (item, index) {
        return '<button class="testimonial-dot' + (index === 0 ? ' active' : '') + '" type="button" aria-label="Testimonial ' + (index + 1) + '"></button>';
      }).join('');
      dots.querySelectorAll('.testimonial-dot').forEach(function (dot, index) {
        dot.addEventListener('click', function () { show(index); });
      });
    }
    if (slides.length > 1) {
      setInterval(function () { show((current + 1) % slides.length); }, 7000);
    }
  }

  function renderTestimonialList(grid, items) {
    ensureStyles();
    grid.innerHTML = items.map(function (item) {
      return '<article class="testimonial-card fade-in">' +
        '<p class="pe-quote">' + esc(item.quote || '') + '</p>' +
        '<p class="pe-author">' + esc(item.author || '') + '</p>' +
        (item.role ? '<p class="pe-role">' + esc(item.role) + '</p>' : '') +
        testimonialLink(item) +
        '</article>';
    }).join('');
    reveal(grid);
  }

  function loadTestimonials() {
    var slider = document.querySelector('[data-testimonial-slider]');
    var grid = document.querySelector('[data-testimonials-list]');
    if (!slider && !grid) return;
    getJSON('/api/content/testimonial').then(function (items) {
      if (!Array.isArray(items) || !items.length) return;
      if (slider) renderTestimonialSlider(slider, items);
      if (grid) renderTestimonialList(grid, items);
    }).catch(function () { /* keep static */ });
  }

  // ---- Inquiry forms ------------------------------------------------------
  function wireInquiryForms() {
    document.querySelectorAll('form[data-inquiry]').forEach(function (form) {
      var status = form.querySelector('.form-status');
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var button = form.querySelector('[type="submit"]');
        var payload = {};
        new FormData(form).forEach(function (value, key) { payload[key] = value; });
        payload.name = [(payload.firstName || '').trim(), (payload.lastName || '').trim()].filter(Boolean).join(' ').trim();
        function setStatus(text, kind) {
          if (!status) { status = document.createElement('p'); status.className = 'form-status'; form.appendChild(status); }
          status.textContent = text;
          status.className = 'form-status ' + kind;
        }
        if (!payload.name || !payload.email) { setStatus('Please add your name and email address.', 'err'); return; }
        var label = button ? button.textContent : '';
        if (button) { button.disabled = true; button.textContent = 'Sending…'; }
        setStatus('', '');
        fetch('/api/inquiries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).then(function (response) {
          return response.json().catch(function () { return {}; }).then(function (result) {
            if (!response.ok) throw new Error(result.error || 'We could not send your enquiry.');
            form.reset();
            setStatus('Thank you — your enquiry has been sent. We will be in touch soon.', 'ok');
          });
        }).catch(function (error) {
          setStatus(error.message || 'Something went wrong. Please email us directly.', 'err');
        }).then(function () {
          if (button) { button.disabled = false; button.textContent = label || 'Send Inquiry'; }
        });
      });
    });
  }

  // ---- Preferred suppliers ------------------------------------------------
  function supplierCard(supplier) {
    var image = supplier.image ? (publicImageUrl(supplier.image) || supplier.image) : '';
    var link = supplier.link && String(supplier.link).trim();
    return '<article class="supplier-card fade-in">' +
      (image ? '<img class="supplier-logo" src="' + esc(image) + '" alt="' + esc(supplier.name || '') + '" loading="lazy">' : '') +
      (supplier.category ? '<p class="supplier-category">' + esc(supplier.category) + '</p>' : '') +
      '<h3 class="supplier-name">' + esc(supplier.name || '') + '</h3>' +
      (supplier.description ? '<p class="supplier-desc">' + esc(supplier.description) + '</p>' : '') +
      (link ? '<a class="supplier-link" href="' + esc(link) + '" target="_blank" rel="noopener">' + esc(supplier.linkLabel || 'Visit website') + '</a>' : '') +
      '</article>';
  }

  function loadSuppliers() {
    var section = document.querySelector('[data-suppliers-section]');
    if (!section) return;
    var grid = section.querySelector('[data-suppliers]');
    if (!grid) return;
    getJSON('/api/content/supplier').then(function (items) {
      if (!Array.isArray(items) || !items.length) return;
      ensureStyles();
      section.hidden = false;
      grid.innerHTML = items.map(supplierCard).join('');
      reveal(grid);
    }).catch(function () { /* keep hidden */ });
  }

  enhanceNavigation();
  loadPageContent();
  loadFaqs();
  loadFaqPage();
  loadBlog();
  loadInstagram();
  loadAnnouncement();
  loadSettings();
  loadPageVisibility();
  loadAwards();
  loadTestimonials();
  loadSuppliers();
  wireInquiryForms();

  setTimeout(revealHero, 1500);
})();
