/* Admin: marketplace listings. Review, publish (copies photos to the public bucket), reject with a note, sold, renew, archive, delete, and add on behalf of a client. */
(function () {
  var C = window.OT || {};
  var ST = { pending: 'قيد المراجعة', published: 'منشور', rejected: 'مرفوض', sold: 'مباع', archived: 'مؤرشف' };
  var CATS = { cars: 'سيارات ومركبات', realestate: 'عقارات وأراضي', furniture: 'أثاث ومفروشات', electronics: 'إلكترونيات وجوالات', appliances: 'أجهزة كهربائية ومنزلية', fashion: 'ملابس وأزياء', equipment: 'معدات وأدوات', animals: 'حيوانات ومواشي', other: 'أخرى' };
  var KINDS = { sale: 'للبيع', rent: 'للإيجار', wanted: 'مطلوب' };
  var WARN = { blur: 'غير واضحة', dark: 'مظلمة', bright: 'شديدة الإضاءة' };
  var filter = 'pending';

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function fmt(iso) { try { return new Date(iso).toLocaleDateString('ar-u-nu-latn', { dateStyle: 'medium' }); } catch (e) { return ''; } }
  function uid() { return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2); }
  function waLink(l, text) {
    var p = String(l.phone || '').replace(/\D/g, '');
    if (p.length === 9) p = '967' + p; else if (p.charAt(0) === '0') p = '967' + p.slice(1);
    return 'https://wa.me/' + p + '?text=' + encodeURIComponent(text);
  }
  function compress(file) {
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(file), i = new Image();
      i.onload = function () {
        URL.revokeObjectURL(u);
        var sc = Math.min(1, 1600 / Math.max(i.width, i.height)), c = document.createElement('canvas');
        c.width = Math.round(i.width * sc); c.height = Math.round(i.height * sc);
        c.getContext('2d').drawImage(i, 0, 0, c.width, c.height);
        c.toBlob(function (b) { b ? res(b) : rej(new Error('blob')); }, 'image/jpeg', 0.85);
      };
      i.onerror = function () { URL.revokeObjectURL(u); rej(new Error('bad')); };
      i.src = u;
    });
  }

  async function publish(l, ctx) {
    var tk = await ctx.token(), out = [];
    for (var i = 0; i < l.images.length; i++) {
      var url = await OTAPI.signUrl('listing-uploads', l.images[i].path, tk, false);
      var blob = await (await fetch(url)).blob();
      var p = 'listings/' + l.id + '/' + (i + 1) + '.jpg';
      try { await OTAPI.uploadAuth('site-media', p, blob, 'image/jpeg', tk); }
      catch (e) { if (e.status !== 400 && e.status !== 409) throw e; } // already copied on an earlier try
      out.push({ path: p });
    }
    await OTAPI.patch('listings', l.id, { status: 'published', public_images: out, public_note: null, expires_at: new Date(Date.now() + 30 * 864e5).toISOString() }, tk);
  }

  function card(l, ctx) {
    var c = el('article', 'cms-item');
    var head = el('div', 'cms-head');
    head.appendChild(el('strong', null, l.title));
    var ref = el('span', 'chip', l.ref); ref.dir = 'ltr'; head.appendChild(ref);
    head.appendChild(el('span', 'chip', ST[l.status] || l.status));
    if (l.source === 'office') head.appendChild(el('span', 'chip', 'من المكتب'));
    c.appendChild(head);
    var price = l.price == null ? 'بدون سعر' : Number(l.price).toLocaleString('en-US') + ' ' + l.currency;
    c.appendChild(el('p', null, [KINDS[l.kind], CATS[l.category], price, l.city, l.seller_name, l.phone, l.show_phone ? 'الرقم ظاهر' : 'الرقم مخفي', fmt(l.created_at)].join(' · ')));
    c.appendChild(el('p', null, l.description));
    var strip = el('div', 'ad-thumbs');
    c.appendChild(strip);
    var flagged = false;
    (l.images || []).forEach(async function (im) {
      var t = el('img'); t.alt = '';
      strip.appendChild(t);
      if (im.warn && im.warn.length) { flagged = true; t.title = im.warn.map(function (w) { return WARN[w]; }).join('، '); t.style.outline = '3px solid #FF8F1F'; }
      try { t.src = await OTAPI.signUrl('listing-uploads', im.path, await ctx.token(), false); t.addEventListener('click', function () { window.open(t.src, '_blank', 'noopener'); }); } catch (e) {}
    });
    (l.images || []).forEach(function (im) { if (im.warn && im.warn.length) flagged = true; });
    if (flagged) c.appendChild(el('p', 'form-msg err', 'تنبيه: الفحص التلقائي وجد صورًا غير واضحة أو سيئة الإضاءة (إطارها برتقالي). راجعها قبل النشر.'));
    if (!(l.images || []).length && l.public_images && l.public_images.length) {
      l.public_images.forEach(function (im) { var t = el('img'); t.alt = ''; t.src = C.SUPABASE_URL + '/storage/v1/object/public/site-media/' + im.path; strip.appendChild(t); });
    }
    if (l.public_note) c.appendChild(el('p', 'hint', 'ملاحظة للبائع: ' + l.public_note));

    var row = el('div', 'btn-row');
    function act(label, cls, fn) {
      var b = el('button', 'btn btn-sm ' + cls, label); b.type = 'button';
      b.addEventListener('click', async function () {
        b.disabled = true;
        try { await fn(); ctx.reload(); } catch (e) { b.disabled = false; ctx.note('تعذّر تنفيذ الإجراء. حاول مرة أخرى.', 'err'); }
      });
      row.appendChild(b);
    }
    if (l.status === 'pending' || l.status === 'rejected' || l.status === 'archived') act('نشر', 'btn-primary', function () { return publish(l, ctx); });
    if (l.status === 'pending' || l.status === 'published') act('رفض / طلب تعديل', 'btn-ghost', async function () {
      var n = prompt('اكتب ملاحظة تظهر للبائع في صفحة تابع طلبك (مثال: الصور غير واضحة، أعد رفعها):', l.public_note || '');
      if (n === null) throw new Error('cancel');
      await OTAPI.patch('listings', l.id, { status: 'rejected', public_note: n.slice(0, 500) || null }, await ctx.token());
    });
    if (l.status === 'published') act('تم البيع', 'btn-ghost', async function () { await OTAPI.patch('listings', l.id, { status: 'sold' }, await ctx.token()); });
    if (l.status === 'published' || l.status === 'sold') act('تجديد 30 يومًا', 'btn-ghost', async function () {
      await OTAPI.patch('listings', l.id, { status: 'published', expires_at: new Date(Date.now() + 30 * 864e5).toISOString() }, await ctx.token());
    });
    if (l.status !== 'archived') act('أرشفة', 'btn-ghost', async function () { await OTAPI.patch('listings', l.id, { status: 'archived' }, await ctx.token()); });
    var wa = el('a', 'btn btn-sm btn-ghost', 'واتساب البائع'); wa.target = '_blank'; wa.rel = 'noopener noreferrer';
    var msg = l.status === 'published' ? 'تم نشر إعلانك «' + l.title + '» في سوق أونلاين تك. رقم الإعلان ' + l.ref + '.'
      : l.status === 'rejected' ? 'بخصوص إعلانك «' + l.title + '» (' + l.ref + '): ' + (l.public_note || 'نحتاج تعديلًا بسيطًا') + '. تابعه من صفحة تابع طلبك.'
      : 'بخصوص إعلانك «' + l.title + '» (' + l.ref + ') في سوق أونلاين تك.';
    wa.href = waLink(l, msg); row.appendChild(wa);
    var del = el('button', 'btn btn-sm btn-ghost', 'حذف'); del.type = 'button';
    del.addEventListener('click', async function () {
      if (!confirm('حذف الإعلان وصوره نهائيًا؟')) return;
      try {
        var tk = await ctx.token();
        if ((l.images || []).length) await OTAPI.removeFiles('listing-uploads', l.images.map(function (x) { return x.path; }), tk);
        if ((l.public_images || []).length) await OTAPI.removeFiles('site-media', l.public_images.map(function (x) { return x.path; }), tk);
        await OTAPI.remove('listings', l.id, tk); ctx.reload();
      } catch (e) { ctx.note('تعذّر الحذف.', 'err'); }
    });
    row.appendChild(del);
    c.appendChild(row);
    return c;
  }

  function addForm(ctx) {
    var d = el('details', 'cms-add'); d.appendChild(el('summary', null, '+ أضف إعلانًا نيابة عن عميل (يُنشر مباشرة)'));
    var f = el('form', 'form'); f.noValidate = false;
    function inp(name, label, type, req, opts) {
      var w = el('div', 'field'); w.appendChild(el('label', null, label)); var i;
      if (type === 'select') { i = el('select'); opts.forEach(function (o) { var op = el('option', null, o[1]); op.value = o[0]; i.appendChild(op); }); }
      else if (type === 'textarea') { i = el('textarea'); i.rows = 4; }
      else { i = el('input'); i.type = type; }
      i.name = name; if (req) i.required = true; w.appendChild(i); f.appendChild(w); return i;
    }
    inp('kind', 'النوع', 'select', 1, Object.keys(KINDS).map(function (k) { return [k, KINDS[k]]; }));
    inp('category', 'القسم', 'select', 1, Object.keys(CATS).map(function (k) { return [k, CATS[k]]; }));
    inp('title', 'العنوان', 'text', 1); inp('description', 'الوصف', 'textarea', 1);
    inp('price', 'السعر (اختياري)', 'number'); inp('currency', 'العملة', 'select', 1, [['YER', 'ريال يمني'], ['SAR', 'ريال سعودي'], ['USD', 'دولار']]);
    inp('city', 'المدينة', 'text', 1).value = 'ذمار'; inp('seller_name', 'اسم صاحب الإعلان', 'text', 1); inp('phone', 'رقم صاحب الإعلان', 'tel', 1);
    var files = inp('photos', 'الصور (حتى 8)', 'file', 0); files.multiple = true; files.accept = 'image/*';
    var sp = el('label', 'check'); var cb = el('input'); cb.type = 'checkbox'; cb.name = 'show_phone'; cb.checked = true; sp.appendChild(cb); sp.appendChild(el('span', null, ' إظهار الرقم في الإعلان')); f.appendChild(sp);
    var go = el('button', 'btn btn-primary', 'نشر الإعلان'); go.type = 'submit'; f.appendChild(go);
    f.addEventListener('submit', async function (e) {
      e.preventDefault(); if (!f.checkValidity()) { f.reportValidity(); return; }
      go.disabled = true;
      try {
        var tk = await ctx.token(), id = uid(), pub = [], list = Array.prototype.slice.call(files.files, 0, 8);
        for (var i = 0; i < list.length; i++) {
          var p = 'listings/' + id + '/' + (i + 1) + '.jpg';
          await OTAPI.uploadAuth('site-media', p, await compress(list[i]), 'image/jpeg', tk); pub.push({ path: p });
        }
        var e2 = f.elements;
        await OTAPI.insertAuth('listings', { id: id, kind: e2.kind.value, category: e2.category.value, title: e2.title.value.trim(), description: e2.description.value.trim(),
          price: e2.price.value ? Number(e2.price.value) : null, currency: e2.currency.value, city: e2.city.value.trim(), seller_name: e2.seller_name.value.trim(),
          phone: e2.phone.value.trim(), show_phone: cb.checked, public_images: pub, consent: true, source: 'office', status: 'published' }, tk);
        ctx.reload();
      } catch (err) { go.disabled = false; ctx.note('تعذّر نشر الإعلان. تأكد من الحقول وحاول مجددًا.', 'err'); }
    });
    d.appendChild(f); return d;
  }

  window.OTMARKET = {
    render: function (view, rows, ctx) {
      view.textContent = '';
      var counts = {}; rows.forEach(function (r) { counts[r.status] = (counts[r.status] || 0) + 1; });
      var bar = el('div', 'chip-row');
      Object.keys(ST).forEach(function (k) {
        var b = el('button', 'chip-btn' + (filter === k ? ' on' : ''), ST[k] + ' (' + (counts[k] || 0) + ')'); b.type = 'button';
        b.addEventListener('click', function () { filter = k; window.OTMARKET.render(view, rows, ctx); });
        bar.appendChild(b);
      });
      view.appendChild(bar);
      view.appendChild(addForm(ctx));
      var shown = rows.filter(function (r) { return r.status === filter; });
      if (!shown.length) view.appendChild(el('p', 'hint', 'لا توجد إعلانات في هذه الحالة.'));
      shown.forEach(function (l) { view.appendChild(card(l, ctx)); });
    }
  };
})();
