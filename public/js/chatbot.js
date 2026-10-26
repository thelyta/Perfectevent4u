// Perfectevent4u assistant: a simple rule-based chatbot (no AI service needed).
// To change what it says, edit the TOPICS list below.
(function () {
  'use strict';

  var CONTACT = { email: 'hello@perfectevent4u.co.uk', phone: '+44 (0) 7700 000000', instagram: '@perfectevent4u' };

  // Each topic: words that trigger it (keys), the answer, and optional buttons (links).
  var TOPICS = [
    { id: 'greet', keys: ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy'],
      answer: 'Hello! Welcome to Perfectevent4u. I can help with our services, booking, pricing, locations and more. What would you like to know?' },
    { id: 'booking', keys: ['advance', 'how far', 'how early', 'how soon', 'when should', 'book', 'booking', 'availability', 'available', 'date', 'reserve', 'timeline', 'how long before'],
      answer: 'We recommend booking 12-18 months in advance for full-service planning. For day-of coordination, 3-6 months is usually enough. Popular dates go quickly, so get in touch as early as you can to check availability.',
      links: [{ label: 'Check availability', href: 'contact.html' }] },
    { id: 'travel', keys: ['travel', 'location', 'where', 'based', 'area', 'areas', 'london', 'essex', 'uk', 'destination', 'abroad', 'outside', 'venue', 'cover'],
      answer: 'We are based in Essex and serve clients throughout London, Essex and across the UK. Destination weddings can also be arranged.' },
    { id: 'pricing', keys: ['price', 'prices', 'pricing', 'cost', 'costs', 'how much', 'quote', 'budget', 'package', 'packages', 'rates', 'fee', 'fees', 'afford', 'expensive'],
      answer: 'Our packages are tailored to each client, so there is no fixed price list. We offer full-service planning, partial planning and day-of coordination. Tell us about your event and we will send a bespoke quote.',
      links: [{ label: 'Request a quote', href: 'contact.html' }] },
    { id: 'vendors', keys: ['vendor', 'vendors', 'supplier', 'suppliers', 'own', 'existing', 'photographer', 'caterer', 'catering', 'florist', 'dj', 'band', 'partners'],
      answer: 'Yes, we are happy to work with vendors you have already chosen. We also have a curated list of trusted partners we can recommend if you need them.' },
    { id: 'services', keys: ['service', 'services', 'offer', 'what do you do', 'help with', 'plan', 'planning', 'design', 'floral', 'flowers', 'coordination', 'day management', 'full service', 'partial'],
      answer: null, // filled in live from the website's services list
      links: [{ label: 'See all services', href: 'services.html' }] },
    { id: 'events', keys: ['wedding', 'weddings', 'birthday', 'party', 'parties', 'corporate', 'anniversary', 'baby shower', 'engagement', 'celebration', 'celebrations', 'event', 'events', 'reception'],
      answer: 'We plan and design weddings and a wide range of celebrations, including receptions, parties and corporate events. If you have something special in mind, just tell us about it.',
      links: [{ label: 'View our portfolio', href: 'portfolio.html' }] },
    { id: 'portfolio', keys: ['portfolio', 'photos', 'pictures', 'gallery', 'examples', 'previous', 'past work', 'lookbook', 'work'],
      answer: 'You can see our recent events in the portfolio, and you can filter by weddings, receptions, corporate events and celebrations.',
      links: [{ label: 'View portfolio', href: 'portfolio.html' }] },
    { id: 'about', keys: ['abi', 'founder', 'who', 'about', 'team', 'owner', 'experience', 'years', 'company', 'story'],
      answer: 'Perfectevent4u was founded by Abi Shobowale, a wedding and event planner and designer with over 10 years of experience. Abi is known for her calm, patient and professional approach, and treats every client like family.',
      links: [{ label: 'About us', href: 'about.html' }] },
    { id: 'consult', keys: ['consultation', 'consult', 'meeting', 'meet', 'call', 'speak', 'talk', 'free', 'first step', 'get started', 'start'],
      answer: 'The first step is a complimentary consultation. Share a few details about your event through the contact form and we will be in touch to arrange it.',
      links: [{ label: 'Book a consultation', href: 'contact.html' }] },
    { id: 'contact', keys: ['contact', 'email', 'phone', 'number', 'reach', 'instagram', 'message', 'enquire', 'inquire', 'enquiry', 'inquiry', 'get in touch'],
      answer: 'You can reach us at ' + CONTACT.email + ' or ' + CONTACT.phone + ', or message us on Instagram ' + CONTACT.instagram + '. The contact form is the quickest way to share your event details.',
      links: [{ label: 'Contact us', href: 'contact.html' }] },
    { id: 'awards', keys: ['award', 'awards', 'reviews', 'review', 'rated', 'testimonial', 'testimonials', 'hitched', 'winner'],
      answer: 'We are proud to be a Hitched Wedding Awards winner, with a number of lovely client reviews. You can read what couples say about us on the home page.',
      links: [{ label: 'See reviews', href: 'index.html' }] },
    { id: 'thanks', keys: ['thanks', 'thank you', 'thankyou', 'cheers', 'great', 'perfect', 'awesome'],
      answer: 'You are very welcome! Is there anything else I can help with?' },
    { id: 'bye', keys: ['bye', 'goodbye', 'see you', 'that is all', 'no thanks'],
      answer: 'Thank you for visiting Perfectevent4u. We would love to hear from you whenever you are ready.' }
  ];

  var QUICK = [
    { label: 'Our services', q: 'What services do you offer?' },
    { label: 'Pricing', q: 'How much does it cost?' },
    { label: 'Booking', q: 'How far in advance should we book?' },
    { label: 'Where do you work?', q: 'Do you travel outside Essex?' },
    { label: 'Contact', q: 'How can I contact you?' }
  ];

  var FALLBACK = 'I am not sure about that one. The team will be happy to help personally. You can send us a message and we will reply soon.';

  // ---------------------------------------------------------------------
  function norm(s) { return ' ' + String(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim() + ' '; }

  function match(text) {
    var t = norm(text);
    var best = null, bestScore = 0;
    TOPICS.forEach(function (topic) {
      var score = 0;
      topic.keys.forEach(function (k) {
        var nk = norm(k);
        if (t.indexOf(nk) !== -1) score += nk.trim().split(' ').length + (nk.length > 8 ? 1 : 0);
      });
      // short greetings should only win when nothing else matched
      if (topic.id === 'greet' || topic.id === 'thanks' || topic.id === 'bye') score = score * 0.6;
      if (score > bestScore) { bestScore = score; best = topic; }
    });
    return bestScore > 0 ? best : null;
  }

  function servicesAnswer() {
    return fetch('/api/services', { headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (items) {
        if (!Array.isArray(items) || !items.length) throw 0;
        return 'Here is what we offer: ' + items.map(function (s) { return s.title; }).join('; ') + '. Each one is tailored to your celebration.';
      })
      .catch(function () {
        return 'Here is what we offer: Full-Service Planning & Design; Customised Floral Design; and Celebration Day Management. Each one is tailored to your celebration.';
      });
  }

  // ---------------------------------------------------------------------
  var css = '' +
    '.pe-chat-btn{position:fixed;right:1.25rem;bottom:1.25rem;z-index:2000;width:3.5rem;height:3.5rem;border-radius:50%;border:none;background:#202946;color:#F9F8F6;cursor:pointer;box-shadow:0 6px 24px rgba(32,41,70,.3);display:flex;align-items:center;justify-content:center;transition:transform .2s}' +
    '.pe-chat-btn:hover{transform:scale(1.06)}.pe-chat-btn svg{width:1.5rem;height:1.5rem}' +
    '.pe-chat-nudge{position:fixed;right:5.5rem;bottom:1.9rem;z-index:2000;background:#fff;color:#202946;font:400 .85rem Lato,sans-serif;padding:.6rem .9rem;border-radius:.6rem;box-shadow:0 4px 18px rgba(32,41,70,.18);max-width:12rem}' +
    '.pe-chat{position:fixed;right:1.25rem;bottom:5.5rem;z-index:2000;width:22rem;max-width:calc(100vw - 2rem);height:34rem;max-height:calc(100vh - 7rem);background:#F9F8F6;border:1px solid rgba(32,41,70,.15);box-shadow:0 12px 40px rgba(32,41,70,.25);display:none;flex-direction:column;font-family:Lato,sans-serif;color:#202946}' +
    '.pe-chat.open{display:flex}' +
    '.pe-chat-head{background:#202946;color:#F9F8F6;padding:1rem 1.1rem;display:flex;justify-content:space-between;align-items:center}' +
    '.pe-chat-title{font-family:"Playfair Display",serif;font-size:1.05rem;letter-spacing:.04em}.pe-chat-sub{font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;opacity:.65;margin-top:.15rem}' +
    '.pe-chat-x{background:none;border:none;color:#F9F8F6;font-size:1.4rem;cursor:pointer;line-height:1}' +
    '.pe-chat-log{flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:.7rem}' +
    '.pe-msg{max-width:85%;padding:.65rem .85rem;font-size:.9rem;line-height:1.55;border-radius:.7rem;white-space:pre-line}' +
    '.pe-msg.bot{background:#fff;border:1px solid rgba(32,41,70,.12);align-self:flex-start;border-bottom-left-radius:.15rem}' +
    '.pe-msg.me{background:#202946;color:#F9F8F6;align-self:flex-end;border-bottom-right-radius:.15rem}' +
    '.pe-chips{display:flex;flex-wrap:wrap;gap:.4rem;align-self:flex-start;max-width:95%}' +
    '.pe-chip{background:transparent;border:1px solid #202946;color:#202946;font:400 .75rem Lato,sans-serif;padding:.4rem .7rem;border-radius:2rem;cursor:pointer;text-decoration:none;transition:all .2s}' +
    '.pe-chip:hover{background:#202946;color:#F9F8F6}' +
    '.pe-form{display:flex;border-top:1px solid rgba(32,41,70,.15);background:#fff}' +
    '.pe-form input{flex:1;border:none;outline:none;padding:.9rem 1rem;font:400 .9rem Lato,sans-serif;background:transparent;color:#202946}' +
    '.pe-form button{border:none;background:none;color:#202946;padding:0 1rem;cursor:pointer;font:700 .72rem Lato,sans-serif;letter-spacing:.14em;text-transform:uppercase}' +
    '.pe-typing{color:rgba(32,41,70,.5);font-size:.85rem}' +
    '@media (max-width:480px){.pe-chat{right:.5rem;left:.5rem;width:auto;bottom:5rem}.pe-chat-nudge{display:none}}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  var btn = el('button', 'pe-chat-btn');
  btn.setAttribute('aria-label', 'Open chat');
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/></svg>';

  var box = el('div', 'pe-chat');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', 'Chat with Perfectevent4u');
  var head = el('div', 'pe-chat-head');
  var ht = el('div');
  ht.appendChild(el('div', 'pe-chat-title', 'Perfectevent4u'));
  ht.appendChild(el('div', 'pe-chat-sub', 'Ask us anything'));
  var close = el('button', 'pe-chat-x', '×');
  close.setAttribute('aria-label', 'Close chat');
  head.appendChild(ht); head.appendChild(close);
  var log = el('div', 'pe-chat-log');
  log.setAttribute('aria-live', 'polite');
  var form = el('form', 'pe-form');
  var input = el('input'); input.type = 'text'; input.placeholder = 'Type your question...'; input.maxLength = 200;
  input.setAttribute('aria-label', 'Your question');
  var send = el('button', null, 'Send'); send.type = 'submit';
  form.appendChild(input); form.appendChild(send);
  box.appendChild(head); box.appendChild(log); box.appendChild(form);

  var nudge = el('div', 'pe-chat-nudge', 'Have a question? Ask us here.');

  function scroll() { log.scrollTop = log.scrollHeight; }
  function say(text, who) { var m = el('div', 'pe-msg ' + who, text); log.appendChild(m); scroll(); return m; }
  function chips(items) {
    var row = el('div', 'pe-chips');
    items.forEach(function (it) {
      if (it.href) {
        var a = el('a', 'pe-chip', it.label); a.href = it.href; row.appendChild(a);
      } else {
        var b = el('button', 'pe-chip', it.label); b.type = 'button';
        b.addEventListener('click', function () { ask(it.q, it.label); });
        row.appendChild(b);
      }
    });
    log.appendChild(row); scroll();
  }

  function reply(topic) {
    var typing = say('...', 'bot'); typing.classList.add('pe-typing');
    var done = function (text) {
      setTimeout(function () {
        typing.remove();
        say(text, 'bot');
        if (topic && topic.links) chips(topic.links);
        else if (!topic) chips([{ label: 'Contact us', href: 'contact.html' }, { label: 'Email us', href: 'mailto:' + CONTACT.email }]);
        if (topic && ['greet', 'thanks'].indexOf(topic.id) !== -1) chips(QUICK);
      }, 450);
    };
    if (!topic) return done(FALLBACK);
    if (topic.id === 'services') return servicesAnswer().then(done);
    done(topic.answer);
  }

  function ask(q, shown) {
    q = String(q || '').trim();
    if (!q) return;
    say(shown || q, 'me');
    reply(match(q));
  }

  var started = false;
  function open() {
    box.classList.add('open'); nudge.remove();
    if (!started) {
      started = true;
      say('Hello! I am the Perfectevent4u assistant. Choose a topic or type your question below.', 'bot');
      chips(QUICK);
    }
    setTimeout(function () { input.focus(); }, 50);
  }
  function shut() { box.classList.remove('open'); }

  btn.addEventListener('click', function () { box.classList.contains('open') ? shut() : open(); });
  close.addEventListener('click', shut);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') shut(); });
  form.addEventListener('submit', function (e) { e.preventDefault(); var v = input.value; input.value = ''; ask(v); });

  document.body.appendChild(box);
  document.body.appendChild(btn);
  setTimeout(function () {
    if (!started && !box.classList.contains('open')) { document.body.appendChild(nudge); setTimeout(function () { nudge.remove(); }, 8000); }
  }, 4000);
})();
