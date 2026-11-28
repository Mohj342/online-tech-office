/* Admin assistant "رفيق". The question is understood (by the assistant function, or locally as a fallback) and turned into a READ-ONLY query plan.
   The plan runs here in the browser with the admin's own session, so names, phones and request details are never sent to any AI model. */
(function () {
  var C = window.OT || {};
  var T = {
    job_seekers: { label: 'الباحثون عن عمل', cols: 'ref,full_name,desired_job,phone,status,created_at', title: function (r) { return r.full_name + (r.desired_job ? ' · ' + r.desired_job : ''); }, search: ['full_name', 'phone', 'ref', 'desired_job'] },
    employer_requests: { label: 'طلبات الموظفين', cols: 'ref,org_name,positions,phone,status,created_at', title: function (r) { return r.org_name + (r.positions ? ' · ' + r.positions : ''); }, search: ['org_name', 'phone', 'ref', 'positions'] },
    inquiries: { label: 'طلبات الخدمات', cols: 'ref,service,full_name,phone,status,created_at', title: function (r) { return (r.full_name || '') + ' · ' + (r.service || ''); }, search: ['full_name', 'phone', 'ref', 'service'] },
    listings: { label: 'إعلانات السوق', cols: 'ref,title,seller_name,phone,status,source,created_at', title: function (r) { return r.title + ' · ' + (r.seller_name || ''); }, search: ['title', 'seller_name', 'phone', 'ref'] },
    reviews: { label: 'آراء العملاء', cols: 'id,name,rating,body,status,created_at', title: function (r) { return r.name + ' · ' + r.rating + '★ · ' + String(r.body || '').slice(0, 60); }, search: ['name', 'body'] }
  };
  var ST = { new: 'جديد', reviewed: 'قيد المراجعة', contacted: 'تم التواصل', processing: 'تحت المعالجة', shipping: 'في الطريق', done: 'تم', accepted: 'مقبول', rejected: 'مرفوض', archived: 'مؤرشف', pending: 'تنتظر المراجعة', published: 'منشور', sold: 'مباع', approved: 'معتمد' };
  var PER = { today: 'اليوم', yesterday: 'أمس', week: 'آخر 7 أيام', month: 'آخر 30 يومًا', all: 'الكل' };
  var AR = '٠١٢٣٤٥٦٧٨٩';

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function en(s) { return String(s).replace(/[٠-٩]/g, function (d) { return AR.indexOf(d); }); }

  /* names (in quotes) and numbers never leave the browser: they are swapped for placeholders before the question is sent */
  function mask(text) {
    var map = {}, qi = 0, ni = 0;
    var t = text.replace(/["«“'](.+?)["»”']/g, function (m, g) { var k = '‹q' + (++qi) + '›'; map[k] = g.trim(); return k; });
    t = t.replace(/[0-9٠-٩][0-9٠-٩\s\-]{2,}[0-9٠-٩]/g, function (m) { var k = '‹n' + (++ni) + '›'; map[k] = en(m).replace(/[^\d]/g, ''); return k; });
    return { text: t, map: map };
  }

  /* fallback understanding without any model */
  function localPlan(text) {
    var t = en(text).replace(/[ًٌٍَُِّْ]/g, ''), m = mask(text), out = { reply: '', queries: [], open_tab: null };
    var per = /امس|البارحة/.test(t) ? 'yesterday' : /اليوم/.test(t) ? 'today' : /اسبوع/.test(t) ? 'week' : /شهر/.test(t) ? 'month' : null;
    var tabs = [];
    if (/باحث|توظيف|وظيف|سيرة|يبحث عن عمل|يبغى وظيفة|يبي وظيفة/.test(t) && !/موظفين/.test(t)) tabs.push('job_seekers');
    if (/موظفين|شركات|جهات|مؤسس/.test(t)) tabs.push('employer_requests');
    if (/خدمات|طلبات الخدمة|استفسار|طلاب|دعاية|تسويق|سفر|عقار|حفل/.test(t)) tabs.push('inquiries');
    if (/اعلان|سوق|بيع|للبيع/.test(t)) tabs.push('listings');
    if (/تقييم|رايك|اراء|رأي|تعليق/.test(t)) tabs.push('reviews');
    var all = !tabs.length;
    if (all) tabs = ['job_seekers', 'employer_requests', 'inquiries', 'listings', 'reviews'];
    var wantNew = /جديد|جديدة|لم تُراجع|ما انراجع|معلق|ينتظر|تنتظر|مراجعة/.test(t) || (all && !per);
    var s = null, k = /‹[qn]\d+›/.exec(m.text);
    tabs.forEach(function (tb) {
      out.queries.push({ table: tb, period: per || (all && !wantNew ? 'today' : 'all'), status: wantNew ? (tb === 'listings' || tb === 'reviews' ? 'pending' : 'new') : null, search: k ? k[0] : null, count_only: /كم|عدد/.test(t) });
    });
    out.reply = 'تمام، هذا اللي لقيته:';
    return { plan: out, map: m.map };
  }

  function startOf(days) { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - days); return d.toISOString(); }
  function filters(q, map) {
    var p = [];
    if (q.period === 'today') p.push('created_at=gte.' + startOf(0));
    else if (q.period === 'yesterday') { p.push('created_at=gte.' + startOf(1)); p.push('created_at=lt.' + startOf(0)); }
    else if (q.period === 'week') p.push('created_at=gte.' + startOf(7));
    else if (q.period === 'month') p.push('created_at=gte.' + startOf(30));
    if (q.status) p.push('status=eq.' + encodeURIComponent(q.status));
    if (q.search && map[q.search]) {
      var term = String(map[q.search]).replace(/[*(),%]/g, ' ').trim();
      if (term) p.push('or=(' + T[q.table].search.map(function (c) { return c + '.ilike.*' + encodeURIComponent(term) + '*'; }).join(',') + ')');
    }
    return p;
  }
  async function run(q, map, token) {
    var tb = T[q.table], f = filters(q, map);
    var url = C.SUPABASE_URL + '/rest/v1/' + q.table + '?select=' + tb.cols + '&order=created_at.desc&limit=' + (q.count_only ? 1 : 12) + (f.length ? '&' + f.join('&') : '');
    var res = await fetch(url, { headers: { apikey: C.SUPABASE_KEY, Authorization: 'Bearer ' + token, Prefer: 'count=exact' } });
    if (!res.ok) throw new Error('q ' + res.status);
    var cr = /\/(\d+)$/.exec(res.headers.get('content-range') || '');
    var rows = await res.json();
    return { total: cr ? +cr[1] : rows.length, rows: q.count_only ? [] : rows };
  }

  function fdate(iso) { try { return new Date(iso).toLocaleString('ar-u-nu-latn', { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return ''; } }

  function block(q, r, ctx) {
    var tb = T[q.table], b = el('section', 'rq-block');
    var h = el('h3', null, tb.label + ' · ' + PER[q.period] + (q.status ? ' · ' + (ST[q.status] || q.status) : '') + ' (' + r.total + ')');
    b.appendChild(h);
    if (!r.total) b.appendChild(el('p', 'hint', 'لا يوجد شيء.'));
    r.rows.forEach(function (row) {
      var c = el('div', 'rq-row');
      c.appendChild(el('strong', null, tb.title(row)));
      var meta = [row.ref, ST[row.status] || row.status, row.phone, fdate(row.created_at)].filter(Boolean);
      c.appendChild(el('span', 'hint', meta.join(' · ')));
      b.appendChild(c);
    });
    if (r.total > r.rows.length && !q.count_only) b.appendChild(el('p', 'hint', 'يوجد ' + (r.total - r.rows.length) + ' أكثر، افتح التبويب لعرض الكل.'));
    var go = el('button', 'btn btn-ghost btn-sm', 'افتح تبويب ' + tb.label); go.type = 'button';
    go.addEventListener('click', function () { if (window.OTAdmin) window.OTAdmin.open(q.table); });
    b.appendChild(go);
    return b;
  }

  window.OTRAFEEQ = {
    render: function (view, ctx) {
      view.textContent = '';
      var wrap = el('div', 'rq');
      wrap.appendChild(el('h2', null, 'اسأل رفيق'));
      wrap.appendChild(el('p', 'hint', 'اكتب سؤالك عن الموقع: وش الجديد اليوم؟ كم باحث عن عمل سجّل هذا الأسبوع؟ أي إعلانات تنتظر المراجعة؟ رفيق للقراءة فقط، ولا يعدّل شيئًا. الأسماء والأرقام والتفاصيل تُعرض لك مباشرة من قاعدة بياناتكم ولا تُرسل لأي نموذج ذكاء اصطناعي. إذا كتبت اسم شخص ضعه بين علامتي اقتباس "هكذا" ليبقى عندك.'));
      var chips = el('div', 'chat-chips');
      [['وش عندنا اليوم؟'], ['وش الجديد اللي ما انراجع؟'], ['الباحثين عن عمل هذا الأسبوع'], ['إعلانات تنتظر المراجعة'], ['طلبات الموظفين الجديدة']].forEach(function (c) {
        var b = el('button', 'chat-chip', c[0]); b.type = 'button'; b.addEventListener('click', function () { ask(c[0]); }); chips.appendChild(b);
      });
      var log = el('div', 'rq-log'); log.setAttribute('role', 'log'); log.setAttribute('aria-live', 'polite');
      var form = el('form', 'chat-form'); var inp = el('input'); inp.type = 'text'; inp.placeholder = 'اسأل رفيق…'; inp.setAttribute('aria-label', 'سؤالك'); inp.maxLength = 300;
      var send = el('button', 'chat-send', 'إرسال'); send.type = 'submit'; form.appendChild(inp); form.appendChild(send);
      wrap.appendChild(chips); wrap.appendChild(log); wrap.appendChild(form); view.appendChild(wrap);
      var history = [], busy = false;

      async function ask(text) {
        text = (text || '').trim(); if (!text || busy) return;
        busy = true; send.disabled = true; inp.value = '';
        log.appendChild(el('div', 'msg user', text));
        var wait = el('div', 'msg bot', 'لحظة…'); log.appendChild(wait);
        try {
          var token = await ctx.token(), m = mask(text), plan = null, map = m.map;
          history.push({ role: 'user', content: m.text }); history = history.slice(-4);
          try {
            var ctl = new AbortController(), to = setTimeout(function () { ctl.abort(); }, 15000);
            var res = await fetch(C.SUPABASE_URL + '/functions/v1/admin-assistant', { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json', apikey: C.SUPABASE_KEY, Authorization: 'Bearer ' + token }, body: JSON.stringify({ messages: history }) });
            clearTimeout(to);
            if (res.ok) plan = await res.json();
          } catch (e) {}
          if (!plan || !plan.queries) { var lp = localPlan(text); plan = lp.plan; map = lp.map; }
          wait.remove();
          if (plan.reply) log.appendChild(el('div', 'msg bot', plan.reply));
          if (!plan.queries.length && !plan.open_tab && !plan.reply) log.appendChild(el('div', 'msg bot', 'ما فهمت السؤال. جرّب مثلًا: وش الجديد اليوم؟'));
          for (var i = 0; i < plan.queries.length; i++) {
            var q = plan.queries[i];
            if (!T[q.table]) continue;
            try { var r = await run(q, map, token); var d = el('div', 'msg bot rq-msg'); d.appendChild(block(q, r, ctx)); log.appendChild(d); }
            catch (e) { log.appendChild(el('div', 'msg bot', 'تعذّر جلب ' + T[q.table].label + '.')); }
          }
          if (plan.open_tab && window.OTAdmin) window.OTAdmin.open(plan.open_tab);
        } catch (e) { wait.remove(); log.appendChild(el('div', 'msg bot', 'تعذّر تنفيذ السؤال الآن. حاول مرة أخرى.')); }
        busy = false; send.disabled = false; log.scrollTop = log.scrollHeight; inp.focus();
      }
      form.addEventListener('submit', function (e) { e.preventDefault(); ask(inp.value); });
    }
  };
})();
