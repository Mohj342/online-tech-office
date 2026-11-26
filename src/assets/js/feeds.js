/* Public trust content: works (portfolio), partners, approved reviews, news.
   Each container: <div data-feed="works|partners|reviews|news" data-limit="6" data-category="office">.
   A container inside [data-feed-section] keeps that section hidden until there is something to show. */
(function () {
  var C = window.OT || {};
  var CATS = C.CATEGORIES || {};
  var MEDIA = C.SUPABASE_URL + '/storage/v1/object/public/site-media/';
  var ART = { employment: '💼', students: '🎓', design: '🎨', marketing: '📱', events: '🎉', travel: '✈️', realestate: '🏠', office: '🏢' };

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function img(path, alt, cls) {
    var i = el('img', cls);
    i.src = MEDIA + path.split('/').map(encodeURIComponent).join('/');
    i.alt = alt || '';
    i.loading = 'lazy';
    i.decoding = 'async';
    return i;
  }
  // Designed placeholder (no photo yet): category colour, icon and title
  function art(cat, title) {
    var a = el('div', 'art art-' + (cat || 'office'));
    a.setAttribute('aria-hidden', 'true');
    a.appendChild(el('span', 'art-ico', ART[cat] || '✨'));
    a.appendChild(el('span', 'art-t', title));
    return a;
  }
  // Full-size view: the grid crops images to a fixed frame; tapping shows the whole image at its own proportions
  var lb = null;
  function zoom(src, title) {
    if (!lb) {
      lb = el('dialog', 'lightbox');
      lb.setAttribute('aria-label', 'عرض الصورة');
      var x = el('button', 'lb-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'إغلاق');
      x.addEventListener('click', function () { lb.close(); });
      lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });
      lb.appendChild(x); lb.appendChild(el('img')); lb.appendChild(el('p'));
      document.body.appendChild(lb);
    }
    var im = lb.querySelector('img'); im.src = src; im.alt = title || '';
    lb.querySelector('p').textContent = title || '';
    if (lb.showModal) lb.showModal(); else window.open(src, '_blank', 'noopener');
  }
  function zoomable(i, title) {
    i.classList.add('zoomable');
    i.tabIndex = 0;
    i.setAttribute('role', 'button');
    i.setAttribute('aria-label', 'تكبير الصورة: ' + (title || ''));
    var go = function () { zoom(i.src, title); };
    i.addEventListener('click', go);
    i.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    return i;
  }
  function date(s) { try { return new Date(s).toLocaleDateString('ar-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' }); } catch (e) { return ''; } }
  function stars(n) {
    var s = el('span', 'stars');
    s.setAttribute('role', 'img');
    s.setAttribute('aria-label', 'التقييم ' + n + ' من 5');
    s.textContent = '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
    return s;
  }
  function reveal(box) {
    var sec = box.closest('[data-feed-section]');
    if (sec) sec.hidden = false;
  }

  var R = {
    works: {
      q: function (box) {
        var cat = box.getAttribute('data-category');
        return 'select=id,title,category,description,client,image_path&is_published=eq.true' +
          (cat ? '&category=eq.' + encodeURIComponent(cat) : '&category=neq.office') + '&order=sort.asc,created_at.desc';
      },
      item: function (w) {
        var c = el('article', 'work');
        c.setAttribute('data-cat', w.category);
        var fig = el('div', 'work-media');
        fig.appendChild(w.image_path ? zoomable(img(w.image_path, w.title), w.title) : art(w.category, CATS[w.category] || ''));
        c.appendChild(fig);
        var b = el('div', 'work-body');
        if (CATS[w.category]) b.appendChild(el('span', 'chip', CATS[w.category]));
        b.appendChild(el('h3', null, w.title));
        if (w.client) b.appendChild(el('p', 'work-client', w.client));
        if (w.description) b.appendChild(el('p', null, w.description));
        c.appendChild(b);
        return c;
      }
    },
    partners: {
      q: function () { return 'select=id,name,field,url,logo_path&is_published=eq.true&order=sort.asc,created_at.asc'; },
      item: function (p) {
        var c = el(p.url ? 'a' : 'div', 'partner');
        if (p.url) { c.href = p.url; c.target = '_blank'; c.rel = 'noopener noreferrer'; }
        var m = el('div', 'partner-logo');
        if (p.logo_path) m.appendChild(img(p.logo_path, 'شعار ' + p.name));
        else m.appendChild(el('span', 'partner-initial', p.name.trim().charAt(0)));
        c.appendChild(m);
        c.appendChild(el('strong', null, p.name));
        if (p.field) c.appendChild(el('span', 'partner-field', p.field));
        return c;
      }
    },
    reviews: {
      q: function () { return 'select=id,name,city,service,rating,body,created_at&order=created_at.desc'; },
      item: function (r) {
        var c = el('figure', 'review');
        c.appendChild(stars(r.rating));
        var bq = el('blockquote'); bq.appendChild(el('p', null, r.body)); c.appendChild(bq);
        var cap = el('figcaption');
        cap.appendChild(el('strong', null, r.name));
        var meta = [r.city, r.service].filter(Boolean).join(' · ');
        if (meta) cap.appendChild(el('span', null, meta));
        c.appendChild(cap);
        return c;
      },
      after: function (box, rows) {
        var sum = document.querySelector('[data-review-summary]');
        if (!sum || !rows.length) return;
        var avg = rows.reduce(function (a, r) { return a + r.rating; }, 0) / rows.length;
        sum.hidden = false;
        sum.textContent = '';
        sum.appendChild(el('strong', 'avg', avg.toFixed(1)));
        sum.appendChild(stars(Math.round(avg)));
        sum.appendChild(el('span', null, 'بناءً على ' + rows.length + ' تقييم'));
      }
    },
    news: {
      q: function () { return 'select=id,title,body,image_path,created_at&is_published=eq.true&order=created_at.desc'; },
      item: function (n) {
        var c = el('article', 'news-item');
        if (n.image_path) { var f = el('div', 'news-media'); f.appendChild(zoomable(img(n.image_path, n.title), n.title)); c.appendChild(f); }
        var b = el('div', 'news-body');
        b.appendChild(el('time', null, date(n.created_at)));
        b.appendChild(el('h3', null, n.title));
        b.appendChild(el('p', null, n.body));
        c.appendChild(b);
        return c;
      }
    }
  };

  function filters(box, rows) {
    var bar = document.querySelector('[data-filter-for="' + box.id + '"]');
    if (!bar) return;
    var cats = [];
    rows.forEach(function (r) { if (cats.indexOf(r.category) < 0) cats.push(r.category); });
    if (cats.length < 2) return;
    bar.hidden = false;
    var all = [['', 'الكل']].concat(cats.map(function (c) { return [c, CATS[c] || c]; }));
    all.forEach(function (c, i) {
      var b = el('button', 'chip-btn', c[1]);
      b.type = 'button';
      b.setAttribute('aria-pressed', i ? 'false' : 'true');
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(bar.children, function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        Array.prototype.forEach.call(box.children, function (w) { w.hidden = !!c[0] && w.getAttribute('data-cat') !== c[0]; });
      });
      bar.appendChild(b);
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-feed]'), async function (box) {
    var kind = box.getAttribute('data-feed');
    var def = R[kind];
    if (!def) return;
    var limit = parseInt(box.getAttribute('data-limit'), 10) || 60;
    try {
      var rows = await OTAPI.select(kind, def.q(box) + '&limit=' + limit);
      if (!rows.length) return; // keep the static empty state / hidden section
      box.textContent = '';
      rows.forEach(function (r) { box.appendChild(def.item(r)); });
      box.classList.add('loaded');
      reveal(box);
      if (def.after) def.after(box, rows);
      if (kind === 'works') filters(box, rows);
    } catch (e) { /* leave the static fallback in place */ }
  });
})();
