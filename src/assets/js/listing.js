/* Single listing page: ?ref=OT-000000 */
(function () {
  var box = document.getElementById('listingBox');
  if (!box) return;
  var M = window.OTMarket, el = M.el;
  var ref = (new URLSearchParams(location.search).get('ref') || '').toUpperCase().trim();
  function none() {
    box.textContent = '';
    var e = el('div', 'empty-state');
    e.appendChild(el('h2', null, 'هذا الإعلان غير متاح'));
    e.appendChild(el('p', null, 'ربما تم بيعه أو انتهت مدته.'));
    var a = el('a', 'btn btn-primary', 'تصفح السوق'); a.href = '/market.html'; e.appendChild(a);
    box.appendChild(e);
  }
  if (!/^OT-\d{6}$/.test(ref)) return none();
  OTAPI.select('listings', 'select=id,ref,kind,category,title,description,price,currency,negotiable,condition,city,seller_name,public_phone,public_images,published_at,expires_at&ref=eq.' + ref + '&limit=1')
    .then(function (rows) {
      var l = rows && rows[0]; if (!l) return none();
      document.title = l.title + ' | سوق أونلاين تك';
      box.textContent = '';
      var wrap = el('div', 'ad-detail');
      var gal = el('div', 'ad-gallery'), main = el('div', 'frame ad-main');
      var imgs = l.public_images || [];
      var big = el('img'); big.alt = l.title;
      if (imgs.length) { big.src = M.media(imgs[0].path); main.appendChild(big); main.addEventListener('click', function () { window.open(big.src, '_blank', 'noopener'); }); }
      else main.appendChild(el('div', 'art art-office', (M.CATS[l.category] || ['📦'])[0]));
      gal.appendChild(main);
      if (imgs.length > 1) {
        var th = el('div', 'ad-thumbs');
        imgs.forEach(function (im, i) {
          var t = el('img'); t.src = M.media(im.path); t.alt = 'صورة ' + (i + 1); t.loading = 'lazy';
          t.addEventListener('click', function () { big.src = t.src; });
          th.appendChild(t);
        });
        gal.appendChild(th);
      }
      wrap.appendChild(gal);
      var info = el('div', 'ad-info panel');
      info.appendChild(el('span', 'chip', M.KINDS[l.kind] + ' · ' + (M.CATS[l.category] || ['', ''])[1]));
      info.appendChild(el('h1', null, l.title));
      info.appendChild(el('p', 'ad-price', M.price(l)));
      var meta = [['📍', l.city], ['الحالة', l.condition === 'new' ? 'جديد' : l.condition === 'used' ? 'مستعمل' : null], ['المعلن', l.seller_name], ['رقم الإعلان', l.ref]];
      meta.forEach(function (m) { if (m[1]) { var p = el('p', 'ad-meta'); p.appendChild(document.createTextNode(m[0] + ' ' + m[1])); info.appendChild(p); } });
      info.appendChild(el('p', 'ad-desc', l.description));
      var row = el('div', 'btn-row');
      var wa = el('a', 'btn btn-primary', 'تواصل عبر واتساب المكتب'); wa.href = M.wa(l); wa.target = '_blank'; wa.rel = 'noopener noreferrer'; row.appendChild(wa);
      if (l.public_phone) { var c = el('a', 'btn btn-ghost', 'اتصل بالمعلن: ' + l.public_phone); c.href = 'tel:' + l.public_phone.replace(/[^\d+]/g, ''); c.dir = 'ltr'; row.appendChild(c); }
      info.appendChild(row);
      info.appendChild(el('p', 'hint', 'نصيحة: عاين الغرض بنفسك قبل الدفع، ولا تحوّل مبالغ مقدمًا لشخص لا تعرفه. المكتب وسيط للتواصل فقط ولا يضمن الصفقة.'));
      wrap.appendChild(info);
      box.appendChild(wrap);
    })
    .catch(function () { none(); });
})();
