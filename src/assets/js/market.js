/* Marketplace browse page: filters + grid of published listings */
(function () {
  var grid = document.getElementById('marketGrid');
  if (!grid) return;
  var M = window.OTMarket, el = M.el, all = [];
  var f = { cat: '', kind: '', q: '', city: '', max: '' };
  var chips = document.getElementById('marketCats');

  function card(l) {
    var a = el('a', 'ad-card'); a.href = '/listing.html?ref=' + encodeURIComponent(l.ref);
    var fr = el('div', 'frame');
    if (l.public_images && l.public_images.length) {
      var im = el('img'); im.src = M.media(l.public_images[0].path); im.alt = l.title; im.loading = 'lazy'; im.decoding = 'async'; fr.appendChild(im);
    } else fr.appendChild(el('div', 'art art-office', (M.CATS[l.category] || ['📦'])[0]));
    a.appendChild(fr);
    var b = el('div', 'ad-body');
    b.appendChild(el('span', 'chip', M.KINDS[l.kind]));
    b.appendChild(el('h3', null, l.title));
    b.appendChild(el('p', 'ad-price', M.price(l)));
    b.appendChild(el('p', 'ad-meta', '📍 ' + l.city));
    a.appendChild(b);
    return a;
  }
  function draw() {
    var q = f.q.trim().toLowerCase(), c = f.city.trim().toLowerCase(), max = Number(f.max) || 0;
    var rows = all.filter(function (l) {
      return (!f.cat || l.category === f.cat) && (!f.kind || l.kind === f.kind) &&
        (!q || (l.title + ' ' + l.description).toLowerCase().indexOf(q) >= 0) &&
        (!c || l.city.toLowerCase().indexOf(c) >= 0) && (!max || l.price == null || Number(l.price) <= max);
    });
    grid.textContent = '';
    if (!rows.length) {
      var e = el('div', 'empty-state');
      e.appendChild(el('span', null, '🛒'));
      e.appendChild(el('h2', null, all.length ? 'لا نتائج مطابقة' : 'السوق جديد وينتظر أول إعلان'));
      e.appendChild(el('p', null, all.length ? 'غيّر الفلاتر أو ابحث بكلمة أخرى.' : 'كن أول من يعلن عن غرض للبيع أو الإيجار.'));
      var s = el('a', 'btn btn-primary', 'أضف إعلانك'); s.href = '/sell.html'; e.appendChild(s);
      grid.appendChild(e); return;
    }
    rows.forEach(function (l) { grid.appendChild(card(l)); });
  }
  function chip(k, text) {
    var b = el('button', 'chip-btn' + (f.cat === k ? ' on' : ''), text); b.type = 'button';
    b.addEventListener('click', function () { f.cat = k; buildChips(); draw(); });
    return b;
  }
  function buildChips() {
    chips.textContent = ''; chips.appendChild(chip('', 'الكل'));
    Object.keys(M.CATS).forEach(function (k) { chips.appendChild(chip(k, M.CATS[k][0] + ' ' + M.CATS[k][1])); });
  }
  buildChips();
  document.querySelectorAll('[data-mf]').forEach(function (i) {
    i.addEventListener('input', function () { f[i.getAttribute('data-mf')] = i.value; draw(); });
  });
  var cs = new URLSearchParams(location.search).get('cat');
  if (cs && M.CATS[cs]) { f.cat = cs; buildChips(); }

  OTAPI.select('listings', 'select=id,ref,kind,category,title,description,price,currency,negotiable,city,public_images,published_at&order=published_at.desc&limit=200')
    .then(function (r) { all = r || []; draw(); })
    .catch(function () { grid.textContent = ''; grid.appendChild(el('p', 'form-msg err', 'تعذّر تحميل الإعلانات الآن. حاول بعد قليل.')); });
})();
