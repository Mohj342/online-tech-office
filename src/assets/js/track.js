/* Track a request by number + phone. The database function returns only the stage, title and the office's note. */
(function () {
  var form = document.getElementById('trackForm');
  if (!form) return;
  var out = document.getElementById('trackResult');
  var btn = form.querySelector('button[type="submit"]');
  var label = btn.textContent;

  var STAGES = {
    new: ['قيد الطلب', 'استلمنا طلبك، وهو في انتظار المراجعة.'],
    processing: ['تحت المعالجة', 'فريق المكتب يعمل على طلبك الآن.'],
    shipping: ['في الطريق', 'طلبك جاهز وفي الطريق إليك.'],
    done: ['تم بنجاح', 'اكتمل طلبك بنجاح. شكرًا لثقتك بنا.'],
    rejected: ['مرفوض', 'نعتذر، تعذّر تنفيذ هذا الطلب. تواصل معنا لمعرفة التفاصيل.'],
    closed: ['مغلق', 'تم إغلاق هذا الطلب. تواصل معنا إذا احتجت أي مساعدة.']
  };
  var KIND = { job: 'طلب توظيف', employer: 'طلب موظفين', service: 'طلب خدمة' };

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function date(s) {
    try { return new Date(s).toLocaleDateString('ar-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' }); } catch (e) { return ''; }
  }
  function normRef(v) {
    v = String(v || '').replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).toUpperCase().replace(/\s+/g, '');
    var m = /(\d{6})$/.exec(v);
    return m ? 'OT-' + m[1] : v;
  }

  function render(r, ref) {
    out.textContent = '';
    out.hidden = false;
    var card = el('div', 'track-card');
    var head = el('div', 'track-head');
    head.appendChild(el('span', 'chip', KIND[r.kind] || 'طلب'));
    var code = el('strong', 'track-ref', ref); code.dir = 'ltr';
    head.appendChild(code);
    card.appendChild(head);
    card.appendChild(el('h2', 'track-title', r.title));

    var order = ['new', 'processing'].concat(r.delivery ? ['shipping'] : []).concat(['done']);
    var final = r.stage === 'rejected' || r.stage === 'closed';
    if (final) order[order.length - 1] = r.stage;
    var at = order.indexOf(r.stage);
    var bar = el('ol', 'track-steps');
    order.forEach(function (k, i) {
      var li = el('li', i < at ? 'done' : i === at ? 'now' : '');
      if (k === 'rejected' && i === at) li.className = 'now bad';
      li.appendChild(el('span', 'dot', i < at ? '✓' : String(i + 1)));
      li.appendChild(el('em', null, STAGES[k][0]));
      if (i === at) li.setAttribute('aria-current', 'step');
      bar.appendChild(li);
    });
    card.appendChild(bar);

    var st = el('p', 'track-status' + (r.stage === 'rejected' ? ' bad' : r.stage === 'done' ? ' good' : ''));
    st.appendChild(el('strong', null, 'الحالة الآن: ' + STAGES[r.stage][0] + '. '));
    st.appendChild(document.createTextNode(STAGES[r.stage][1]));
    card.appendChild(st);

    if (r.note) {
      var n = el('div', 'track-note');
      n.appendChild(el('strong', null, 'ملاحظة من المكتب'));
      n.appendChild(el('p', null, r.note));
      card.appendChild(n);
    }
    var meta = el('p', 'track-meta', 'تاريخ الطلب: ' + date(r.created_at) + ' · آخر تحديث: ' + date(r.updated_at));
    card.appendChild(meta);
    out.appendChild(card);
    out.focus();
  }

  function fail(text) {
    out.hidden = false;
    out.textContent = '';
    out.appendChild(el('p', 'form-msg err', text));
  }

  try {
    var q = new URLSearchParams(location.search).get('ref');
    if (q) form.elements.ref.value = normRef(q).slice(0, 12);
  } catch (e) {}

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var ref = normRef(form.elements.ref.value);
    form.elements.ref.value = ref;
    if (!/^OT-\d{6}$/.test(ref)) { fail('اكتب رقم الطلب كما وصلك، مثل OT-482175.'); form.elements.ref.focus(); return; }
    if (!form.checkValidity()) { form.reportValidity(); return; }
    btn.disabled = true; btn.textContent = 'جارٍ البحث…';
    try {
      var rows = await OTAPI.rpc('track_request', { p_ref: ref, p_phone: form.elements.phone.value });
      if (rows && rows.length) render(rows[0], ref);
      else fail('لم نجد طلبًا بهذا الرقم ورقم الجوال. تأكد من الرقمين، واكتب رقم الجوال نفسه الذي أرسلت به الطلب.');
    } catch (err) {
      if (err.body && /rate_limited|too many/.test(err.body)) fail('محاولات كثيرة على هذا الرقم. حاول مرة أخرى بعد ساعة، أو تواصل معنا مباشرة.');
      else fail('تعذّر الاتصال الآن. حاول بعد قليل.');
    } finally {
      btn.disabled = false; btn.textContent = label;
    }
  });
})();
