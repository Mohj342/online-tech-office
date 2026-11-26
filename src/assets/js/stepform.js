/* Multi-step forms (job application, employer request): step navigation, file checks,
   uploads to private storage, then one row in the form's table. */
(function () {
  Array.prototype.forEach.call(document.querySelectorAll('form[data-stepform]'), init);

  function init(form) {
  var TABLE = form.getAttribute('data-stepform');
  var C = window.OT || {};
  var MAX = (parseInt(form.getAttribute('data-max-mb'), 10) || 15) * 1024 * 1024;
  var MAX_EXTRA = 5;
  var COOLDOWN_MS = 20000;
  var steps = Array.prototype.slice.call(form.querySelectorAll('.step'));
  var dots = Array.prototype.slice.call(form.querySelectorAll('.steps-bar li'));
  var prevBtn = form.querySelector('[data-prev]');
  var nextBtn = form.querySelector('[data-next]');
  var sendBtn = form.querySelector('button[type="submit"]');
  var box = form.querySelector('.form-msg');
  var cur = 0;

  var TYPES = {
    pdf: 'application/pdf', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif'
  };
  var DOCS = ['pdf', 'doc', 'docx'];
  var IMGS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
  var ALLOWED = { cv: DOCS, photo: IMGS, certificate: IMGS.concat(['pdf']), extra: IMGS.concat(['pdf']) };

  function msg(kind, text, withWa) {
    box.hidden = !text;
    box.className = 'form-msg ' + kind;
    box.textContent = text || '';
    if (withWa) {
      var a = document.createElement('a');
      a.href = 'https://wa.me/' + C.WHATSAPP;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = 'تواصل معنا عبر واتساب';
      box.appendChild(document.createTextNode(' '));
      box.appendChild(a);
    }
  }

  function ext(name) { var m = /\.([a-z0-9]+)$/i.exec(name || ''); return m ? m[1].toLowerCase() : ''; }
  function mb(n) { return (n / 1048576).toFixed(1) + ' ميجابايت'; }

  /* ---------- step navigation ---------- */
  function show(i) {
    cur = i;
    steps.forEach(function (s, k) { s.hidden = k !== i; });
    dots.forEach(function (d, k) {
      d.classList.toggle('done', k < i);
      if (k === i) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current');
    });
    prevBtn.hidden = i === 0;
    nextBtn.hidden = i === steps.length - 1;
    sendBtn.hidden = i !== steps.length - 1;
    msg('ok', '');
  }

  function fileProblem(input) {
    var kind = input.getAttribute('data-kind');
    var files = Array.prototype.slice.call(input.files || []);
    if (kind === 'extra' && files.length > MAX_EXTRA) return 'يمكنك اختيار ' + MAX_EXTRA + ' ملفات كحد أقصى في «' + input.getAttribute('data-l') + '».';
    for (var i = 0; i < files.length; i++) {
      if (files[i].size > MAX) return 'الملف «' + files[i].name + '» حجمه ' + mb(files[i].size) + '، والحد الأقصى ' + mb(MAX) + '.';
      if (ALLOWED[kind].indexOf(ext(files[i].name)) < 0) return 'نوع الملف «' + files[i].name + '» غير مدعوم في «' + input.getAttribute('data-l') + '».';
    }
    return '';
  }

  function validStep(i) {
    var ctls = steps[i].querySelectorAll('input, select, textarea');
    for (var k = 0; k < ctls.length; k++) {
      var c = ctls[k];
      if (c.type === 'file') {
        var p = fileProblem(c);
        if (p) { msg('err', p); c.focus(); return false; }
        continue;
      }
      if (c.required && c.type !== 'checkbox' && !String(c.value).trim()) c.value = '';
      if (!c.checkValidity()) { c.reportValidity(); return false; }
    }
    return true;
  }

  nextBtn.addEventListener('click', function () {
    if (!validStep(cur)) return;
    show(cur + 1);
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  prevBtn.addEventListener('click', function () { show(cur - 1); form.scrollIntoView({ behavior: 'smooth', block: 'start' }); });

  // List chosen files under each picker
  Array.prototype.forEach.call(form.querySelectorAll('input[type="file"]'), function (input) {
    input.addEventListener('change', function () {
      var list = form.querySelector('.file-list[data-for="' + input.id + '"]');
      list.textContent = '';
      Array.prototype.forEach.call(input.files || [], function (fl) {
        var li = document.createElement('li');
        li.textContent = fl.name + ' — ' + mb(fl.size);
        if (fl.size > MAX) li.className = 'bad';
        list.appendChild(li);
      });
      var p = fileProblem(input);
      msg(p ? 'err' : 'ok', p);
    });
  });

  // Prefill the desired job when arriving from a vacancy card: /register.html?job=...
  try {
    var job = new URLSearchParams(location.search).get('job');
    if (job && form.elements.desired_job) form.elements.desired_job.value = job.slice(0, 150);
  } catch (e) {}

  /* ---------- submit ---------- */
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }
  function lastSent() { try { return +localStorage.getItem('ot_last_' + TABLE) || 0; } catch (e) { return 0; } }
  function markSent() { try { localStorage.setItem('ot_last_' + TABLE, String(Date.now())); } catch (e) {} }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    for (var s = 0; s < steps.length; s++) {
      if (!validStep(s)) { if (s !== cur) { show(s); validStep(s); } return; }
    }
    if (form.elements.website.value) { msg('ok', 'تم استلام طلبك. شكرًا لتواصلك.'); form.reset(); show(0); return; }
    if (Date.now() - lastSent() < COOLDOWN_MS) { msg('err', 'تم إرسال طلب قبل قليل. انتظر لحظات ثم أعد المحاولة.'); return; }

    var id = uuid();
    var row = { id: id, consent: true, details: [], attachments: [] };
    var get = function (n) { var c = form.elements[n]; return c ? String(c.value || '').trim() : ''; };

    Array.prototype.forEach.call(form.querySelectorAll('[data-l]:not([type="file"])'), function (c) {
      var v = String(c.value || '').trim();
      if (c.hasAttribute('data-core')) { if (v) row[c.name] = v; return; }
      if (v) row.details.push({ k: c.name, l: c.getAttribute('data-l'), v: v });
    });
    if (TABLE === 'job_seekers') {
      row.qualification = [get('highest'), get('specialization')].filter(Boolean).join(' – ').slice(0, 200);
      var exp = [];
      if (get('has_exp') === 'نعم') {
        if (get('exp_years')) exp.push(get('exp_years') + ' سنوات خبرة');
        if (get('prev_title')) exp.push(get('prev_title'));
        if (get('prev_employer')) exp.push('لدى ' + get('prev_employer'));
      } else if (get('has_exp')) exp.push('بدون خبرة سابقة');
      if (exp.length) row.experience = exp.join(' – ').slice(0, 2000);
    } else if (TABLE === 'employer_requests') {
      delete row.attachments;
      row.positions = (get('job_title') + ' – العدد: ' + get('count')).slice(0, 1000);
      var req = [];
      if (get('qualification') && get('qualification') !== 'غير مشترط') req.push(get('qualification'));
      if (get('specialization')) req.push('تخصص ' + get('specialization'));
      if (get('exp_years')) req.push(get('exp_years'));
      if (get('skills')) req.push(get('skills'));
      if (req.length) row.requirements = req.join(' – ').slice(0, 2000);
    }

    var uploads = [];
    Array.prototype.forEach.call(form.querySelectorAll('input[type="file"]'), function (input) {
      var kind = input.getAttribute('data-kind');
      Array.prototype.forEach.call(input.files || [], function (fl, n) {
        var x = ext(fl.name);
        uploads.push({ file: fl, kind: kind, label: input.getAttribute('data-l'), type: TYPES[x] || fl.type,
          path: 'uploads/' + id + '/' + kind + (n ? '-' + (n + 1) : '') + '.' + x });
      });
    });

    var label = sendBtn.textContent;
    sendBtn.disabled = true; prevBtn.disabled = true;
    try {
      for (var u = 0; u < uploads.length; u++) {
        sendBtn.textContent = 'جارٍ رفع الملفات (' + (u + 1) + ' من ' + uploads.length + ')…';
        await OTAPI.upload('seeker-files', uploads[u].path, uploads[u].file, uploads[u].type);
        row.attachments.push({ kind: uploads[u].kind, label: uploads[u].label, path: uploads[u].path,
          name: uploads[u].file.name.slice(0, 200), size: uploads[u].file.size });
      }
      sendBtn.textContent = 'جارٍ إرسال الطلب…';
      await OTAPI.insert(TABLE, row);
      markSent();
      form.reset();
      Array.prototype.forEach.call(form.querySelectorAll('.file-list'), function (l) { l.textContent = ''; });
      show(0);
      msg('ok', TABLE === 'employer_requests'
        ? 'تم استلام طلبكم بنجاح. سنراجع الطلب ونتواصل معكم لترشيح الكفاءات المناسبة.'
        : 'تم استلام طلبك بنجاح. سنراجع بياناتك ونتواصل معك عند توفر فرصة مناسبة.');
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
      var t = err && err.status === 413 ? 'أحد الملفات أكبر من المسموح. صغّر حجمه وأعد المحاولة، أو' : 'تعذّر إرسال الطلب الآن. أعد المحاولة بعد قليل، أو';
      msg('err', t, true);
    } finally {
      sendBtn.disabled = false; prevBtn.disabled = false;
      sendBtn.textContent = label;
    }
  });

  show(0);
  }
})();
