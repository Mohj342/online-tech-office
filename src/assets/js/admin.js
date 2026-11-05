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
      ['description', 'الوصف'], ['requirements', 'المتطلبات']] },
    { key: 'settings', label: 'الإعدادات', settings: true }
  ];
  var BGS = [
    ['none', 'الافتراضية'], ['sand', 'رملي'], ['sky', 'سماوي'], ['mint', 'نعناعي'],
    ['rose', 'وردي'], ['lilac', 'بنفسجي'], ['dawn', 'فجر'], ['slate', 'رمادي']
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
          email: (r.user && r.user.email) || (S && S.email) || '',
          meta: (r.user && r.user.user_metadata) || (S && S.meta) || {} };
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
    document.body.removeAttribute('data-admbg');
    $('dash').hidden = true;
    $('login').hidden = false;
    var m = $('loginMsg');
    m.hidden = !msg;
    m.className = 'form-msg err';
    m.textContent = msg || '';
  }
  function applyPrefs() {
    var m = (S && S.meta) || {};
    $('who').textContent = m.name || S.email || '';
    var bg = BGS.some(function (b) { return b[0] === m.bg; }) ? m.bg : 'none';
    if (bg === 'none') document.body.removeAttribute('data-admbg'); else document.body.setAttribute('data-admbg', bg);
  }
  function showDash() {
    $('login').hidden = true;
    $('dash').hidden = false;
    applyPrefs();
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
    note('');
    if (t.settings) { renderSettings(); return; }
    view.textContent = 'جارٍ التحميل…';
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

  /* ---------- settings ---------- */
  function authMsg(err, fallback) {
    var b = {};
    try { b = JSON.parse(err.body || '{}'); } catch (e) {}
    var code = b.error_code || b.code || '';
    if (err.status === 401 || err.status === 403 && code === 'session_not_found') return 'انتهت الجلسة. سجّل الدخول من جديد.';
    if (err.status === 429 || code === 'over_email_send_rate_limit') return 'محاولات كثيرة. انتظر دقيقة ثم حاول مرة أخرى.';
    if (code === 'same_password') return 'كلمة المرور الجديدة يجب أن تختلف عن الحالية.';
    if (code === 'weak_password') return 'كلمة المرور ضعيفة. استخدم 8 خانات على الأقل بحروف وأرقام.';
    if (code === 'reauth_nonce_missing' || code === 'reauthentication_needed' || code === 'reauthentication_not_valid') return 'رمز التأكيد غير صحيح أو انتهت صلاحيته. اطلب رمزًا جديدًا.';
    return fallback;
  }
  async function saveMeta(patch) {
    var u = await OTAPI.updateUser({ data: patch }, await token());
    S.meta = (u && u.user_metadata) || Object.assign({}, S.meta, patch);
    save();
    applyPrefs();
  }
  function field(id, label, type, extra) {
    var w = el('div', 'field');
    var l = el('label', null, label); l.setAttribute('for', id);
    var i = el('input'); i.id = id; i.type = type;
    if (extra) for (var k in extra) i[k] = extra[k];
    w.appendChild(l); w.appendChild(i);
    return { wrap: w, input: i };
  }
  function msgBox(f) {
    var m = el('div', 'form-msg'); m.hidden = true; m.setAttribute('role', 'status');
    f.appendChild(m);
    return function (text, kind) { m.hidden = !text; m.className = 'form-msg ' + (kind || 'ok'); m.textContent = text || ''; };
  }

  function renderSettings() {
    var view = $('view');
    view.textContent = '';
    var grid = el('div', 'set-grid');

    /* profile */
    var c1 = el('section', 'set-card');
    c1.appendChild(el('h3', null, 'الملف الشخصي'));
    c1.appendChild(el('p', 'hint', 'الاسم الذي يظهر أعلى اللوحة.'));
    var f1 = el('form', 'form');
    var nm = field('s_name', 'الاسم', 'text', { maxLength: 60, autocomplete: 'name', value: (S.meta && S.meta.name) || '' });
    var em = field('s_email', 'البريد الإلكتروني', 'email', { value: S.email || '', readOnly: true, dir: 'ltr' });
    f1.appendChild(nm.wrap); f1.appendChild(em.wrap);
    var say1 = msgBox(f1);
    var b1 = el('button', 'btn btn-primary', 'حفظ الاسم'); b1.type = 'submit';
    f1.appendChild(b1);
    f1.addEventListener('submit', async function (e) {
      e.preventDefault();
      b1.disabled = true;
      try { await saveMeta({ name: nm.input.value.trim() }); say1('تم حفظ الاسم.', 'ok'); }
      catch (err) { say1(authMsg(err, 'تعذّر حفظ الاسم.'), 'err'); }
      finally { b1.disabled = false; }
    });
    c1.appendChild(f1);
    grid.appendChild(c1);

    /* background */
    var c2 = el('section', 'set-card');
    c2.appendChild(el('h3', null, 'خلفية اللوحة'));
    c2.appendChild(el('p', 'hint', 'اختر لونًا لخلفية لوحة الإدارة. يُحفظ في حسابك ويظهر لك على أي جهاز.'));
    var sw = el('div', 'swatches'); sw.setAttribute('role', 'group'); sw.setAttribute('aria-label', 'خلفية اللوحة');
    var cur = (S.meta && S.meta.bg) || 'none';
    var say2 = el('div', 'form-msg'); say2.hidden = true; say2.setAttribute('role', 'status');
    BGS.forEach(function (b) {
      var btn = el('button', 'swatch'); btn.type = 'button';
      btn.setAttribute('data-bg', b[0]); btn.setAttribute('aria-label', b[1]); btn.title = b[1];
      btn.setAttribute('aria-pressed', b[0] === cur ? 'true' : 'false');
      btn.addEventListener('click', async function () {
        try {
          await saveMeta({ bg: b[0] });
          Array.prototype.forEach.call(sw.children, function (x) { x.setAttribute('aria-pressed', x === btn ? 'true' : 'false'); });
          say2.hidden = true;
        } catch (err) { say2.hidden = false; say2.className = 'form-msg err'; say2.textContent = authMsg(err, 'تعذّر حفظ الخلفية.'); }
      });
      sw.appendChild(btn);
    });
    c2.appendChild(sw); c2.appendChild(say2);
    grid.appendChild(c2);

    /* password (confirmed with a code emailed to the account) */
    var c3 = el('section', 'set-card');
    c3.appendChild(el('h3', null, 'تغيير كلمة المرور'));
    c3.appendChild(el('p', 'hint', 'للأمان نرسل رمز تأكيد من 6 أرقام إلى بريدك (' + (S.email || '') + ') ولا تُغيَّر كلمة المرور إلا به.'));
    var box = el('div', 'steps-pw');
    var ask = el('button', 'btn btn-ghost', 'إرسال رمز التأكيد إلى بريدي'); ask.type = 'button';
    var say3 = el('div', 'form-msg'); say3.hidden = true; say3.setAttribute('role', 'status');
    var f3 = el('form', 'form'); f3.hidden = true;
    var code = field('s_code', 'رمز التأكيد', 'text', { inputMode: 'numeric', autocomplete: 'one-time-code', maxLength: 10, required: true, dir: 'ltr' });
    code.input.className = 'code-in';
    var p1 = field('s_p1', 'كلمة المرور الجديدة', 'password', { minLength: 8, maxLength: 72, required: true, autocomplete: 'new-password', dir: 'ltr' });
    var p2 = field('s_p2', 'تأكيد كلمة المرور الجديدة', 'password', { minLength: 8, maxLength: 72, required: true, autocomplete: 'new-password', dir: 'ltr' });
    var sub = el('button', 'btn btn-primary', 'تغيير كلمة المرور'); sub.type = 'submit';
    f3.appendChild(code.wrap); f3.appendChild(p1.wrap); f3.appendChild(p2.wrap); f3.appendChild(sub);
    function say(text, kind) { say3.hidden = !text; say3.className = 'form-msg ' + (kind || 'ok'); say3.textContent = text || ''; }
    var cool = null;
    ask.addEventListener('click', async function () {
      ask.disabled = true;
      try {
        await OTAPI.reauthenticate(await token());
        f3.hidden = false; code.input.focus();
        say('أرسلنا الرمز إلى ' + (S.email || 'بريدك') + '. قد يتأخر دقيقة، وتحقق من البريد غير الهام أيضًا.', 'ok');
        var left = 60;
        ask.textContent = 'إعادة الإرسال بعد ' + left + ' ث';
        cool = setInterval(function () {
          left--;
          if (left <= 0) { clearInterval(cool); ask.disabled = false; ask.textContent = 'إعادة إرسال الرمز'; }
          else ask.textContent = 'إعادة الإرسال بعد ' + left + ' ث';
        }, 1000);
      } catch (err) {
        say(authMsg(err, 'تعذّر إرسال الرمز الآن. تأكد من إعداد البريد في Supabase أو تواصل مع المطوّر.'), 'err');
        ask.disabled = false;
      }
    });
    f3.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!f3.checkValidity()) { f3.reportValidity(); return; }
      if (p1.input.value !== p2.input.value) { say('كلمتا المرور غير متطابقتين.', 'err'); return; }
      if (!/[A-Za-z؀-ۿ]/.test(p1.input.value) || !/\d/.test(p1.input.value)) { say('استخدم حروفًا وأرقامًا معًا في كلمة المرور.', 'err'); return; }
      sub.disabled = true;
      try {
        await OTAPI.updateUser({ password: p1.input.value, nonce: code.input.value.trim() }, await token());
        code.input.value = ''; p1.input.value = ''; p2.input.value = '';
        f3.hidden = true;
        say('تم تغيير كلمة المرور بنجاح.', 'ok');
      } catch (err) { say(authMsg(err, 'تعذّر تغيير كلمة المرور.'), 'err'); }
      finally { sub.disabled = false; }
    });
    box.appendChild(ask); box.appendChild(say3); box.appendChild(f3);
    c3.appendChild(box);
    grid.appendChild(c3);

    view.appendChild(grid);
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
  $('gear').addEventListener('click', function () {
    tab = TABS[TABS.length - 1]; renderTabs(); loadTab();
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
