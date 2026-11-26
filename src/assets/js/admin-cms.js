/* Admin content manager: works (portfolio), partners, news, and customer-review moderation.
   Images go to the public "site-media" bucket; only admins can write there. */
(function () {
  var C = window.OT || {};
  var MEDIA = C.SUPABASE_URL + '/storage/v1/object/public/site-media/';
  var MAX_IMG = 5 * 1024 * 1024;
  var CATS = C.CATEGORIES || {};

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function uid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
  function fmt(iso) { try { return new Date(iso).toLocaleDateString('ar-u-nu-latn', { dateStyle: 'medium' }); } catch (e) { return ''; } }

  var DEFS = {
    works: {
      title: 'عمل', img: 'image_path', imgLabel: 'صورة العمل (JPG أو PNG أو WebP، حتى 5 ميجا)',
      hint: 'أضف نماذج حقيقية من أعمال المكتب. العنصر بدون صورة يظهر بتصميم ملوّن حسب القسم. اختر قسم «المكتب وفريق العمل» لصور المكتب، وتظهر في صفحة «من نحن».',
      order: 'sort.asc,created_at.desc',
      fields: [
        ['title', 'عنوان العمل', 'text', 150, true],
        ['category', 'القسم', 'select', null, true, Object.keys(CATS).map(function (k) { return [k, CATS[k]]; })],
        ['client', 'العميل أو الجهة (اختياري)', 'text', 120],
        ['description', 'وصف مختصر', 'textarea', 1500],
        ['sort', 'الترتيب (الأصغر يظهر أولًا)', 'number']
      ],
      line: function (r) { return [CATS[r.category], r.client].filter(Boolean).join(' · '); }
    },
    partners: {
      title: 'شريك', img: 'logo_path', imgLabel: 'شعار الجهة (PNG بخلفية شفافة يفضّل، حتى 5 ميجا)',
      hint: 'أضف فقط الجهات المتعاونة فعليًا مع المكتب. الجهة بدون شعار تظهر بالحرف الأول من اسمها.',
      order: 'sort.asc,created_at.asc',
      fields: [
        ['name', 'اسم الجهة', 'text', 150, true],
        ['field', 'مجال الشراكة (اختياري)', 'text', 120],
        ['url', 'رابط موقعها أو صفحتها (اختياري)', 'url', 300],
        ['sort', 'الترتيب (الأصغر يظهر أولًا)', 'number']
      ],
      line: function (r) { return r.field || ''; }
    },
    news: {
      title: 'خبر', img: 'image_path', imgLabel: 'صورة الخبر (اختيارية، حتى 5 ميجا)',
      hint: 'الأخبار والإعلانات والعروض. تظهر في صفحة «الأخبار والإعلانات» بترتيب الأحدث.',
      order: 'created_at.desc',
      fields: [
        ['title', 'عنوان الخبر', 'text', 200, true],
        ['body', 'نص الخبر', 'textarea', 5000, true]
      ],
      line: function (r) { return fmt(r.created_at); }
    }
  };

  /* ---------- works / partners / news ---------- */
  function contentTab(view, t, rows, ctx) {
    var D = DEFS[t.key];
    view.textContent = '';
    var bar = el('div', 'bar2');
    bar.appendChild(el('strong', null, t.label + ' (' + rows.length + ')'));
    view.appendChild(bar);
    view.appendChild(el('p', 'hint', D.hint));

    var editing = null;
    var f = el('form', 'form vac-form cms-form');
    var h = el('h3', null, 'إضافة ' + D.title);
    f.appendChild(h);
    var grid = el('div', 'grid2');
    var inputs = {};
    D.fields.forEach(function (d) {
      var wrap = el('div', 'field' + (d[2] === 'textarea' ? ' wide' : ''));
      var id = 'c_' + t.key + '_' + d[0];
      var l = el('label', null, d[1] + (d[4] ? ' *' : ''));
      l.htmlFor = id;
      var c;
      if (d[2] === 'select') {
        c = el('select');
        d[5].forEach(function (o) { var op = el('option', null, o[1]); op.value = o[0]; c.appendChild(op); });
      } else if (d[2] === 'textarea') { c = el('textarea'); c.rows = 4; }
      else { c = el('input'); c.type = d[2] === 'number' ? 'number' : d[2] === 'url' ? 'url' : 'text'; }
      c.id = id; c.name = d[0];
      if (d[3]) c.maxLength = d[3];
      if (d[4]) { c.required = true; if (d[2] !== 'select') c.minLength = 2; }
      if (d[2] === 'number') { c.value = '0'; c.step = '1'; }
      if (d[2] === 'url') c.placeholder = 'https://';
      inputs[d[0]] = c;
      wrap.appendChild(l); wrap.appendChild(c);
      grid.appendChild(wrap);
    });
    // image
    var iw = el('div', 'field wide');
    var il = el('label', null, D.imgLabel);
    var fi = el('input'); fi.type = 'file'; fi.accept = 'image/jpeg,image/png,image/webp'; fi.id = 'c_' + t.key + '_img'; il.htmlFor = fi.id;
    var prev = el('div', 'cms-preview');
    var rmImg = el('label', 'check'); var rmCb = el('input'); rmCb.type = 'checkbox';
    rmImg.appendChild(rmCb); rmImg.appendChild(document.createTextNode(' حذف الصورة الحالية')); rmImg.hidden = true;
    fi.addEventListener('change', function () {
      prev.textContent = '';
      var file = fi.files[0];
      if (!file) return;
      if (file.size > MAX_IMG) { ctx.note('حجم الصورة أكبر من 5 ميجا.', 'err'); fi.value = ''; return; }
      var im = el('img'); im.alt = ''; im.src = URL.createObjectURL(file); prev.appendChild(im);
    });
    iw.appendChild(il); iw.appendChild(fi); iw.appendChild(prev); iw.appendChild(rmImg);
    grid.appendChild(iw);
    f.appendChild(grid);

    var pubL = el('label', 'check'); var pub = el('input'); pub.type = 'checkbox'; pub.checked = true;
    pubL.appendChild(pub); pubL.appendChild(document.createTextNode(' منشور في الموقع'));
    f.appendChild(pubL);
    var acts = el('div', 'btn-row');
    var save = el('button', 'btn btn-primary', 'حفظ'); save.type = 'submit';
    var cancel = el('button', 'btn btn-ghost', 'إلغاء التعديل'); cancel.type = 'button'; cancel.hidden = true;
    acts.appendChild(save); acts.appendChild(cancel);
    f.appendChild(acts);
    view.appendChild(f);

    function resetForm() {
      editing = null; f.reset(); prev.textContent = ''; rmImg.hidden = true; rmCb.checked = false; pub.checked = true;
      if (inputs.sort) inputs.sort.value = '0';
      h.textContent = 'إضافة ' + D.title; cancel.hidden = true;
    }
    cancel.addEventListener('click', resetForm);

    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!f.checkValidity()) { f.reportValidity(); return; }
      save.disabled = true; save.textContent = 'جارٍ الحفظ…';
      try {
        var tok = await ctx.token();
        var body = { is_published: pub.checked };
        D.fields.forEach(function (d) {
          var v = inputs[d[0]].value.trim();
          body[d[0]] = d[2] === 'number' ? (parseInt(v, 10) || 0) : (v || null);
        });
        var oldPath = editing && editing[D.img];
        var file = fi.files[0];
        if (file) {
          var ext = (/\.([a-z0-9]+)$/i.exec(file.name) || [, 'jpg'])[1].toLowerCase();
          var path = t.key + '/' + uid() + '.' + ext;
          await OTAPI.uploadAuth('site-media', path, file, file.type, tok);
          body[D.img] = path;
        } else if (editing && rmCb.checked) body[D.img] = null;
        if (editing) await OTAPI.patch(t.key, editing.id, body, tok);
        else await OTAPI.insertAuth(t.key, body, tok);
        if (oldPath && (file || rmCb.checked)) { try { await OTAPI.removeFiles('site-media', [oldPath], tok); } catch (e2) {} }
        ctx.note(editing ? 'تم حفظ التعديلات.' : 'تمت الإضافة.', 'ok');
        ctx.reload();
      } catch (err) {
        ctx.note('تعذّر الحفظ. تأكد من البيانات وحجم الصورة.', 'err');
        save.disabled = false; save.textContent = 'حفظ';
      }
    });

    if (!rows.length) { view.appendChild(el('p', 'vac-empty', 'لا توجد عناصر بعد. أضف أول ' + D.title + ' من النموذج بالأعلى.')); return; }
    var list = el('div', 'cms-list');
    rows.forEach(function (r) {
      var card = el('div', 'cms-item' + (r.is_published ? '' : ' off'));
      var th = el('div', 'cms-thumb');
      if (r[D.img]) { var im = el('img'); im.alt = ''; im.loading = 'lazy'; im.src = MEDIA + r[D.img]; th.appendChild(im); }
      else th.appendChild(el('span', null, 'بدون صورة'));
      card.appendChild(th);
      var b = el('div', 'cms-body');
      b.appendChild(el('strong', null, r.title || r.name));
      var ln = D.line(r); if (ln) b.appendChild(el('span', 'hint', ln));
      b.appendChild(el('span', 'chip', r.is_published ? 'منشور' : 'مخفي'));
      card.appendChild(b);
      var a = el('div', 'btn-row');
      var ed = el('button', 'btn btn-ghost btn-sm', 'تعديل'); ed.type = 'button';
      ed.addEventListener('click', function () {
        editing = r;
        D.fields.forEach(function (d) { inputs[d[0]].value = r[d[0]] == null ? (d[2] === 'number' ? '0' : '') : r[d[0]]; });
        pub.checked = !!r.is_published;
        prev.textContent = '';
        if (r[D.img]) { var pi = el('img'); pi.alt = ''; pi.src = MEDIA + r[D.img]; prev.appendChild(pi); rmImg.hidden = false; }
        h.textContent = 'تعديل: ' + (r.title || r.name); cancel.hidden = false;
        f.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      var tg = el('button', 'btn btn-ghost btn-sm', r.is_published ? 'إخفاء' : 'نشر'); tg.type = 'button';
      tg.addEventListener('click', async function () {
        try { await OTAPI.patch(t.key, r.id, { is_published: !r.is_published }, await ctx.token()); ctx.reload(); }
        catch (e) { ctx.note('تعذّر التحديث.', 'err'); }
      });
      var del = el('button', 'btn btn-ghost btn-sm danger', 'حذف'); del.type = 'button';
      del.addEventListener('click', async function () {
        if (del.getAttribute('data-c') !== '1') { del.setAttribute('data-c', '1'); del.textContent = 'تأكيد الحذف'; return; }
        try {
          var tok = await ctx.token();
          if (r[D.img]) { try { await OTAPI.removeFiles('site-media', [r[D.img]], tok); } catch (e2) {} }
          await OTAPI.remove(t.key, r.id, tok); ctx.reload();
        } catch (e) { ctx.note('تعذّر الحذف.', 'err'); }
      });
      a.appendChild(ed); a.appendChild(tg); a.appendChild(del);
      card.appendChild(a);
      list.appendChild(card);
    });
    view.appendChild(list);
  }

  /* ---------- reviews moderation ---------- */
  var RSTAT = { pending: 'بانتظار المراجعة', approved: 'منشور', hidden: 'مخفي' };
  function reviewsTab(view, t, rows, ctx) {
    view.textContent = '';
    var pending = rows.filter(function (r) { return r.status === 'pending'; }).length;
    var bar = el('div', 'bar2');
    bar.appendChild(el('strong', null, t.label + ' (' + rows.length + ')' + (pending ? ' · ' + pending + ' بانتظار المراجعة' : '')));
    view.appendChild(bar);
    view.appendChild(el('p', 'hint', 'الآراء يكتبها العملاء من صفحة «آراء العملاء»، ولا تظهر إلا بعد ما تضغط «نشر». رقم الجوال ورقم الطلب للتحقق فقط ولا يظهران للزوار.'));
    if (!rows.length) { view.appendChild(el('p', 'vac-empty', 'لا توجد آراء بعد. شارك رابط صفحة «آراء العملاء» مع عملائك بعد إنجاز طلباتهم.')); return; }
    var list = el('div', 'cms-list');
    rows.forEach(function (r) {
      var card = el('div', 'cms-item review-mod' + (r.status === 'approved' ? '' : ' off'));
      var b = el('div', 'cms-body');
      var top = el('div', 'btn-row');
      top.appendChild(el('strong', null, r.name));
      top.appendChild(el('span', 'stars', '★★★★★'.slice(0, r.rating) + '☆☆☆☆☆'.slice(0, 5 - r.rating)));
      top.appendChild(el('span', 'chip', RSTAT[r.status]));
      b.appendChild(top);
      b.appendChild(el('p', null, r.body));
      var meta = [r.city, r.service, fmt(r.created_at), r.ref ? 'طلب ' + r.ref : '', r.phone ? 'جوال ' + r.phone : ''].filter(Boolean).join(' · ');
      b.appendChild(el('span', 'hint', meta));
      card.appendChild(b);
      var a = el('div', 'btn-row');
      [['approved', 'نشر'], ['hidden', 'إخفاء']].forEach(function (s) {
        if (r.status === s[0]) return;
        var x = el('button', 'btn btn-sm ' + (s[0] === 'approved' ? 'btn-primary' : 'btn-ghost'), s[1]); x.type = 'button';
        x.addEventListener('click', async function () {
          try { await OTAPI.patch('reviews', r.id, { status: s[0] }, await ctx.token()); ctx.reload(); }
          catch (e) { ctx.note('تعذّر التحديث.', 'err'); }
        });
        a.appendChild(x);
      });
      var del = el('button', 'btn btn-ghost btn-sm danger', 'حذف'); del.type = 'button';
      del.addEventListener('click', async function () {
        if (del.getAttribute('data-c') !== '1') { del.setAttribute('data-c', '1'); del.textContent = 'تأكيد الحذف'; return; }
        try { await OTAPI.remove('reviews', r.id, await ctx.token()); ctx.reload(); } catch (e) { ctx.note('تعذّر الحذف.', 'err'); }
      });
      a.appendChild(del);
      card.appendChild(a);
      list.appendChild(card);
    });
    view.appendChild(list);
  }

  window.OTCMS = {
    order: function (key) { return key === 'reviews' ? 'status.desc,created_at.desc' : DEFS[key].order; },
    render: function (view, t, rows, ctx) { (t.key === 'reviews' ? reviewsTab : contentTab)(view, t, rows, ctx); }
  };
})();
