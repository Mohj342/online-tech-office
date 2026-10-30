/* Floating auto-reply widget. Copy follows the office's own auto-reply text. */
(function () {
  var C = window.OT || {};
  var SV = C.SERVICES || [];
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function key(n) { return n + '️⃣'; }
  function waLink(t) { return 'https://wa.me/' + C.WHATSAPP + '?text=' + encodeURIComponent(t); }
  function toEn(s) {
    return s.replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 1632); })
            .replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 1776); });
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, reduce ? 0 : ms); }); }

  /* ---------- copy ---------- */
  function welcome() {
    return '🌟 مرحبًا بك في مكتب أونلاين تك 🌟 للخدمات التكنولوجية والتسويقية\n' +
      '🤝 يسعدنا تواصلك معنا، ونتطلع إلى تقديم أفضل الخدمات لك.\n' +
      '📌 كيف يمكننا مساعدتك اليوم؟\n' +
      'يرجى اختيار القسم المناسب وإرسال رقمه:\n' +
      SV.map(function (s) { return key(s.n) + ' ' + s.title + ' ' + s.emoji; }).join('\n') + '\n' +
      '💬 أرسل رقم الخدمة المطلوبة، وسنساعدك في معرفة التفاصيل.\n' +
      '⏳ إذا لم تجد الخدمة التي تبحث عنها ضمن القائمة، اكتب استفسارك مباشرة، وسنتواصل معك في أقرب وقت ممكن.\n' +
      '✨ أونلاين تك — نربط الكفاءات بالفرص المناسبة.';
  }
  var JOBS = {
    title: 'خدمات التوظيف – مكتب أونلاين تك',
    text: 'أهلًا وسهلًا بك في قسم التوظيف بمكتب أونلاين تك للخدمات التكنولوجية والتسويقية.\nنسعد بخدمتك، يرجى تحديد طلبك:\n✨ أبحث عن وظيفة\n✨ طلب موظفين\nأونلاين تك — نربط الكفاءات بالفرص المناسبة.'
  };
  var SEEKER = {
    title: 'التسجيل كباحث عن عمل',
    text: 'أهلًا بك في مكتب أونلاين تك للخدمات التكنولوجية والتسويقية. 🌟\nإذا كنت تبحث عن فرصة عمل، يرجى إرسال بياناتك التالية:\n' +
      ['الاسم الكامل.', 'المؤهل العلمي والتخصص.', 'الخبرات السابقة.', 'الوظيفة المطلوبة.', 'مكان الإقامة.', 'رقم التواصل.']
        .map(function (t, i) { return key(i + 1) + ' ' + t; }).join('\n') +
      '\n📌 سنراجع بياناتك للاستفادة منها عند توفر فرص وظيفية مناسبة.\n📢 لمتابعة إعلانات الوظائف الجديدة، تابع قناتنا على واتساب.'
  };
  var EMPLOYER = {
    title: 'طلب موظفين',
    text: 'أهلًا بك في مكتب أونلاين تك للخدمات التكنولوجية والتسويقية. 🌟\nإذا كنت تبحث عن موظفين لجهتك، يرجى إرسال البيانات التالية:\n' +
      ['اسم الجهة.', 'الوظائف المطلوبة وعدد كل وظيفة.', 'المؤهلات والخبرات المطلوبة.', 'مكان العمل.', 'رقم التواصل.']
        .map(function (t, i) { return key(i + 1) + ' ' + t; }).join('\n') +
      '\n📌 سنراجع طلبك وننسّق معك بخصوص الكفاءات المتاحة.'
  };
  // Isolate each number (LRI…PDI) so "+967 …" keeps its order inside RTL text
  function ltr(t) { return '\u2066' + String(t).replace(/ /g, '\u00A0') + '\u2069'; }
  var CONTACT = 'للتواصل المباشر مع فريق المكتب، يمكنك الاتصال أو مراسلتنا عبر الأرقام التالية:\n' +
    (C.PHONES || []).map(function (p) { return '📞 ' + ltr(p); }).join('\n') +
    '\n📍 العنوان:\n' + (C.ADDRESS || '') +
    '\nمكتب أونلاين تك نربط الكفاءات بالفرص المناسبة.';

  /* ---------- DOM ---------- */
  var fab = el('button', 'chat-fab');
  fab.type = 'button';
  fab.setAttribute('aria-haspopup', 'dialog');
  fab.setAttribute('aria-expanded', 'false');
  fab.appendChild(el('span', null, 'تحدث معنا'));

  var panel = el('section', 'chat-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'الرد التلقائي لمكتب أونلاين تك');
  panel.hidden = true;

  var head = el('div', 'chat-h');
  var ht = el('div');
  ht.appendChild(el('strong', null, 'مكتب أونلاين تك'));
  ht.appendChild(el('span', null, 'الرد التلقائي'));
  var close = el('button', 'chat-x', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'إغلاق المحادثة');
  head.appendChild(ht);
  head.appendChild(close);

  var log = el('div', 'chat-log');
  log.setAttribute('role', 'log');
  log.setAttribute('aria-live', 'polite');
  var chipsEl = el('div', 'chat-chips');
  var form = el('form', 'chat-form');
  form.autocomplete = 'off';
  var inp = el('input');
  inp.type = 'text';
  inp.id = 'chatMsg';
  inp.placeholder = 'أرسل رقم القسم أو اكتب استفسارك';
  inp.setAttribute('aria-label', 'رسالتك');
  var sendBtn = el('button', 'chat-send', 'إرسال');
  sendBtn.type = 'submit';
  form.appendChild(inp);
  form.appendChild(sendBtn);

  panel.appendChild(head);
  panel.appendChild(log);
  panel.appendChild(chipsEl);
  panel.appendChild(form);
  document.body.appendChild(fab);
  document.body.appendChild(panel);

  function toEnd() { log.scrollTop = log.scrollHeight; }

  function bot(text, o) {
    o = o || {};
    var b = el('div', 'msg bot');
    if (o.title) b.appendChild(el('strong', null, o.title));
    b.appendChild(document.createTextNode(text));
    if (o.acts && o.acts.length) {
      var a = el('div', 'msg-acts');
      o.acts.forEach(function (x) {
        var n = el('a', 'btn btn-sm ' + (x.ghost ? 'btn-ghost' : 'btn-primary'), x.label);
        n.href = x.href;
        if (/^https?:/.test(x.href)) { n.target = '_blank'; n.rel = 'noopener noreferrer'; }
        a.appendChild(n);
      });
      b.appendChild(a);
    }
    log.appendChild(b);
    toEnd();
    return b;
  }
  function userMsg(t) { log.appendChild(el('div', 'msg user', t)); toEnd(); }
  async function say(text, o) {
    var t = el('div', 'msg bot typing');
    t.setAttribute('aria-hidden', 'true');
    t.appendChild(el('i')); t.appendChild(el('i')); t.appendChild(el('i'));
    log.appendChild(t); toEnd();
    await sleep((o && o.ms) || 550);
    t.remove();
    return bot(text, o);
  }

  var BACK = [{ label: 'القائمة الرئيسية', send: 'القائمة الرئيسية' }];
  function menuChips() { return SV.map(function (s) { return { label: s.n + ' · ' + s.title, send: String(s.n) }; }); }
  var JOBCHIPS = [
    { label: 'أبحث عن وظيفة', send: 'أبحث عن وظيفة' },
    { label: 'طلب موظفين', send: 'طلب موظفين' },
    { label: 'القائمة الرئيسية', send: 'القائمة الرئيسية' }
  ];
  function setChips(list) {
    chipsEl.textContent = '';
    list.forEach(function (c) {
      var b = el('button', 'chat-chip', c.label);
      b.type = 'button';
      b.addEventListener('click', function () { send(c.send); });
      chipsEl.appendChild(b);
    });
  }

  /* ---------- flow ---------- */
  var state = 'menu', current = null, chain = Promise.resolve();
  function enqueue(fn) { chain = chain.then(fn).catch(function (e) { console.error(e); }); return chain; }

  async function showMenu() { state = 'menu'; current = null; await say(welcome(), { ms: 450 }); setChips(menuChips()); }
  async function jobs() { state = 'jobs'; current = SV[0]; await say(JOBS.text, { title: JOBS.title }); setChips(JOBCHIPS); }
  async function section(n) {
    if (n === 1) return jobs();
    var s = SV[n - 1];
    if (!s) return showMenu();
    state = 'section'; current = s;
    await say('أهلًا وسهلًا بك في قسم ' + s.title + ' ' + s.emoji + ' بمكتب أونلاين تك للخدمات التكنولوجية والتسويقية.\nاكتب طلبك أو استفسارك، أو افتح صفحة القسم لإرسال الطلب.',
      { acts: [
        { label: 'صفحة القسم', href: '/services/' + s.slug + '.html' },
        { label: 'واتساب', ghost: true, href: waLink('مرحبًا، أرغب بالاستفسار عن قسم ' + s.title) }
      ] });
    setChips(BACK);
  }
  async function seeker() {
    state = 'menu';
    await say(SEEKER.text, { title: SEEKER.title, acts: [{ label: 'تعبئة نموذج التسجيل', href: '/register.html' }].concat(C.GROUP ? [{ label: 'انضم لقناة الوظائف', href: C.GROUP, ghost: true }] : []) });
    await say(CONTACT, { ms: 650 });
    setChips(BACK);
  }
  async function employer() {
    state = 'menu';
    await say(EMPLOYER.text, { title: EMPLOYER.title, acts: [{ label: 'تعبئة طلب الموظفين', href: '/employers.html' }] });
    await say(CONTACT, { ms: 650 });
    setChips(BACK);
  }
  async function free(text) {
    var ctx = current ? ('القسم: ' + current.title + '\n') : '';
    await say('هذه المحادثة لا ترسل رسائلك إلى المكتب. لإيصال استفسارك إلى الفريق أرسله عبر واتساب، أو استخدم نموذج صفحة التواصل.',
      { acts: [
        { label: 'إرسال عبر واتساب', href: waLink('استفسار من موقع أونلاين تك\n' + ctx + text) },
        { label: 'صفحة التواصل', ghost: true, href: '/contact.html' }
      ], ms: 450 });
    setChips(BACK);
  }

  async function respond(raw) {
    var t = toEn(raw).replace(/[.؟!،\s]+$/, '').trim();
    if (/^(0|القائمة|القائمه|القائمة الرئيسية|القائمه الرئيسيه|الرئيسية|رجوع|menu)$/i.test(t)) return showMenu();
    if (state === 'jobs') {
      if (t === '2' || /موظف/.test(t)) return employer();
      if (t === '1' || /وظيف|ابحث|أبحث/.test(t)) return seeker();
    }
    if (/^[1-7]$/.test(t)) return section(+t);
    return free(raw);
  }
  function send(text) {
    text = (text || '').trim();
    if (!text) return;
    userMsg(text);
    enqueue(function () { return respond(text); });
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); var v = inp.value; inp.value = ''; send(v); });

  var started = false;
  function open() {
    panel.hidden = false;
    fab.hidden = true;
    fab.setAttribute('aria-expanded', 'true');
    if (!started) { started = true; bot(welcome()); setChips(menuChips()); }
    if (window.matchMedia('(hover: hover)').matches) inp.focus({ preventScroll: true });
  }
  function shut() {
    panel.hidden = true;
    fab.hidden = false;
    fab.setAttribute('aria-expanded', 'false');
    fab.focus({ preventScroll: true });
  }
  fab.addEventListener('click', open);
  close.addEventListener('click', shut);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) shut(); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-open-chat]'), function (b) {
    b.addEventListener('click', open);
  });
})();
