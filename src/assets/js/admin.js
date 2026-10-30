/* Admin dashboard. Sign-in uses Supabase Auth; data access is enforced by Row Level Security (admin_users). */
(function () {
  var C = window.OT || {};
  var S = null;

  var STATUS = { new: 'جديد', reviewed: 'تمت المراجعة', contacted: 'تم التواصل', archived: 'مؤرشف' };
  var TABS = [
    { key: 'job_seekers', label: 'الباحثون عن عمل', status: true, cols: [
      ['full_name', 'الاسم'], ['qualification', 'المؤهل والتخصص'], ['experience', 'الخبرات'],
      ['desired_job', 'الوظيفة المطلوبة'], ['residence', 'الإقامة'], ['phone', 'الهاتف']] },
    { key: 'employer_requests', label: 'طلبات الموظفين', status: true, cols: [
      ['org_name', 'الجهة'], ['positions', 'الوظائف المطلوبة'], ['requirements', 'المؤهلات'],
      ['work_location', 'مكان العمل'], ['phone', 'الهاتف']] },
    { key: 'inquiries', label: 'الاستفسارات', status: true, cols: [
      ['service', 'القسم'], ['full_name', 'الاسم'], ['phone', 'الهاتف'], ['message', 'الرسالة']] },
    { key: 'vacancies', label: 'الوظائف المنشورة', vacancies: true, cols: [
      ['title', 'المسمى'], ['company', 'الجهة'], ['location', 'المكان'], ['job_type', 'النوع'],
      ['description', 'الوصف'], ['requirements', 'المتطلبات']] }
  ];
  var tab = TABS[0];

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  /* ---------- session ---------- */
  function load() { try { S = JSON.parse(sessionStorage.getItem('ot_s') || 'null'); } catch (e) { S = null; } }
  function save() { try { sessionStorage.setItem('ot_s', JSON.stringify(S)); } catch (e) {} }
  function clear() { S = null; try { sessionStorage.removeItem('ot_s'); } catch (e) {} }
  function setSession(r) {
    S = { access: r.access_token, refresh: r.refresh_token, exp: Date.now() + (r.expires_in || 3600) * 1000,
          email: (r.user && r.user.email) || (S && S.email) || '' };
    save();
  }
  async function token() {
    if (!S) throw new Error('no session');
    if (Date.now() > S.exp - 30000) setSession(await OTAPI.refresh(S.refresh));
    return S.access;
  }

  /* ---------- helpers ---------- */
  function waFor(phone) {
    var d = String(phone || '').replace(/\D/g, '');
    if (d.indexOf('00') === 0) d = d.slice(2);
    if (d.length === 9 && d.charAt(0) === '7') d = '967' + d;
    return 'https://wa.me/' + d;
  }
  function fmtDate(iso) {
    try { return new Date(iso).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return iso; }
  }
  function csvCell(v) {
    v = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; // neutralise spreadsheet formulas
    return '"' + v.replace(/"/g, '""') + '"';
  }
  function exportCsv(t, rows) {
    var heads = ['created_at'].concat(t.cols.map(function (c) { return c[0]; }));
    heads.push(t.vacancies ? 'is_published' : 'status');
    var lines = [heads.map(csvCell).join(',')];
    rows.forEach(function (r) {
      lines.push(heads.map(function (h) { return csvCell(r[h]); }).join(','));
    });
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = t.key + '-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function note(text, kind) {
    var n = $('note');
    n.hidden = !text;
    n.className = 'form-msg ' + (kind || 'ok');
    n.textContent = text || '';
  }

  /* ---------- views ---------- */
  function showLogin(msg) {
    $('dash').hidden = true;
    $('login').hidden = false;
    var m = $('loginMsg');
    m.hidden = !msg;
    m.className = 'form-msg err';
    m.textContent = msg || '';
  }
  function showDash() {
    $('login').hidden = true;
    $('dash').hidden = false;
    $('who').textContent = S.email || '';
    renderTabs();
    loadTab();
  }

  function renderTabs() {
    var bar = $('tabs');
    bar.textContent = '';
    TABS.forEach(function (t) {
      var b = el('button', 'tab' + (t === tab ? ' on' : ''), t.label);
      b.type = 'button';
      b.setAttribute('aria-pressed', t === tab ? 'true' : 'false');
      b.addEventListener('click', function () { tab = t; renderTabs(); loadTab(); });
      bar.appendChild(b);
    });
  }

  async function loadTab() {
    var t = tab;
    var view = $('view');
    view.textContent = 'جارٍ التحميل…';
    note('');
    try {
      var rows = await OTAPI.select(t.key, 'select=*&order=created_at.desc&limit=300', await token());
      if (t !== tab) return;
      render(t, rows);
    } catch (err) {
      if (err.status === 401 || err.status === 403) { clear(); showLogin('انتهت الجلسة. سجّل الدخول من جديد.'); return; }
      view.textContent = 'تعذّر تحميل البيانات.';
    }
  }

  function render(t, rows) {
    var view = $('view');
    view.textContent = '';

    var bar = el('div', 'bar2');
    bar.appendChild(el('strong', null, t.label + ' (' + rows.length + ')'));
    var ex = el('button', 'btn btn-ghost btn-sm', 'تصدير CSV');
    ex.type = 'button';
    ex.disabled = !rows.length;
    ex.addEventListener('click', function () { exportCsv(t, rows); });
    bar.appendChild(ex);
    view.appendChild(bar);

    if (t.vacancies) view.appendChild(vacancyForm());

    if (!rows.length) { view.appendChild(el('p', 'vac-empty', 'لا توجد سجلات بعد.')); return; }

    var wrap = el('div', 'tbl-wrap');
    var table = el('table', 'tbl');
    var thead = el('thead');
    var hr = el('tr');
    ['التاريخ'].concat(t.cols.map(function (c) { return c[1]; })).concat([t.vacancies ? 'النشر' : 'الحالة', 'إجراءات'])
      .forEach(function (h) { hr.appendChild(el('th', null, h)); });
    thead.appendChild(hr);
    table.appendChild(thead);

    var tb = el('tbody');
    rows.forEach(function (r) {
      var tr = el('tr');
      tr.appendChild(el('td', 'nowrap', fmtDate(r.created_at)));
      t.cols.forEach(function (c) {
        var td = el('td', c[0] === 'phone' ? 'nowrap' : null, r[c[0]] || '—');
        if (c[0] === 'phone') td.setAttribute('dir', 'ltr');
        tr.appendChild(td);
      });

      var st = el('td');
      if (t.vacancies) {
        var pub = el('button', 'btn btn-sm ' + (r.is_published ? 'btn-primary' : 'btn-ghost'), r.is_published ? 'منشورة' : 'مخفية');
        pub.type = 'button';
        pub.addEventListener('click', async function () {
          try { await OTAPI.patch('vacancies', r.id, { is_published: !r.is_published }, await token()); loadTab(); }
          catch (e) { note('تعذّر التحديث.', 'err'); }
        });
        st.appendChild(pub);
      } else {
        var sel = el('select', 'sel');
        sel.setAttribute('aria-label', 'الحالة');
        Object.keys(STATUS).forEach(function (k) {
          var o = el('option', null, STATUS[k]);
          o.value = k;
          if (r.status === k) o.selected = true;
          sel.appendChild(o);
        });
        sel.addEventListener('change', async function () {
          try { await OTAPI.patch(t.key, r.id, { status: sel.value }, await token()); note('تم تحديث الحالة.', 'ok'); }
          catch (e) { note('تعذّر تحديث الحالة.', 'err'); }
        });
        st.appendChild(sel);
      }
      tr.appendChild(st);

      var act = el('td', 'nowrap');
      if (r.phone) {
        var wa = el('a', 'btn btn-ghost btn-sm', 'واتساب');
        wa.href = waFor(r.phone);
        wa.target = '_blank';
        wa.rel = 'noopener noreferrer';
        act.appendChild(wa);
        act.appendChild(document.createTextNode(' '));
      }
      var del = el('button', 'btn btn-ghost btn-sm danger', 'حذف');
      del.type = 'button';
      var armed = false, timer = null;
      del.addEventListener('click', async function () {
        if (!armed) {
          armed = true;
          del.textContent = 'تأكيد الحذف';
          timer = setTimeout(function () { armed = false; del.textContent = 'حذف'; }, 4000);
          return;
        }
        clearTimeout(timer);
        try { await OTAPI.remove(t.key, r.id, await token()); loadTab(); }
        catch (e) { note('تعذّر الحذف.', 'err'); armed = false; del.textContent = 'حذف'; }
      });
      act.appendChild(del);
      tr.appendChild(act);
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    wrap.appendChild(table);
    view.appendChild(wrap);
  }

  function vacancyForm() {
    var f = el('form', 'form vac-form');
    f.appendChild(el('h3', null, 'إضافة وظيفة'));
    var defs = [
      ['title', 'المسمى الوظيفي', 'text', true, 150],
      ['company', 'الجهة', 'text', false, 150],
      ['location', 'مكان العمل', 'text', false, 150],
      ['job_type', 'نوع الدوام', 'text', false, 60],
      ['description', 'الوصف', 'textarea', false, 4000],
      ['requirements', 'المتطلبات', 'textarea', false, 4000]
    ];
    var grid = el('div', 'grid2');
    defs.forEach(function (d) {
      var wrap = el('div', 'field' + (d[2] === 'textarea' ? ' wide' : ''));
      var id = 'v_' + d[0];
      var l = el('label', null, d[1] + (d[3] ? ' *' : ''));
      l.setAttribute('for', id);
      var c = d[2] === 'textarea' ? el('textarea') : el('input');
      if (d[2] !== 'textarea') c.type = 'text'; else c.rows = 3;
      c.id = id; c.name = d[0]; c.maxLength = d[4];
      if (d[3]) { c.required = true; c.minLength = 2; }
      wrap.appendChild(l); wrap.appendChild(c);
      grid.appendChild(wrap);
    });
    f.appendChild(grid);

    var chk = el('label', 'check');
    var cb = el('input'); cb.type = 'checkbox'; cb.name = 'is_published'; cb.id = 'v_pub';
    chk.appendChild(cb);
    chk.appendChild(document.createTextNode(' نشر الوظيفة في الموقع مباشرة'));
    f.appendChild(chk);

    var sub = el('button', 'btn btn-primary', 'حفظ الوظيفة');
    sub.type = 'submit';
    f.appendChild(sub);

    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!f.checkValidity()) { f.reportValidity(); return; }
      var row = { is_published: cb.checked };
      defs.forEach(function (d) { var v = f.elements[d[0]].value.trim(); if (v) row[d[0]] = v; });
      sub.disabled = true;
      try { await OTAPI.insertAuth('vacancies', row, await token()); note('تمت إضافة الوظيفة.', 'ok'); loadTab(); }
      catch (err) { note('تعذّر حفظ الوظيفة.', 'err'); }
      finally { sub.disabled = false; }
    });
    return f;
  }

  /* ---------- boot ---------- */
  $('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      setSession(await OTAPI.login($('email').value.trim(), $('password').value));
      $('password').value = '';
      // must be listed in admin_users (RLS shows a user only their own row)
      var me = await OTAPI.select('admin_users', 'select=user_id', await token());
      if (!me.length) { clear(); showLogin('هذا الحساب غير مفعّل كمدير للوحة.'); return; }
      showDash();
    } catch (err) {
      clear();
      showLogin(err.status === 400 ? 'البريد أو كلمة المرور غير صحيحة.' : 'تعذّر تسجيل الدخول الآن.');
    } finally { btn.disabled = false; }
  });
  $('logout').addEventListener('click', function () { clear(); showLogin(''); });

  load();
  if (S) {
    token().then(function () { return OTAPI.select('admin_users', 'select=user_id', S.access); })
      .then(function (me) { if (me.length) showDash(); else { clear(); showLogin(''); } })
      .catch(function () { clear(); showLogin(''); });
  } else {
    showLogin('');
  }
})();
