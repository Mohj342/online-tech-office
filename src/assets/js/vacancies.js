/* Renders published vacancies into #vacancies (RLS lets visitors read published rows only). */
(function () {
  var box = document.getElementById('vacancies');
  if (!box) return;
  var limit = parseInt(box.getAttribute('data-limit'), 10) || 20;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function empty(text) {
    box.textContent = '';
    var p = el('p', 'vac-empty', text + ' ');
    var a = el('a', null, 'سجّل بياناتك كباحث عن عمل');
    a.href = '/register.html';
    p.appendChild(a);
    box.appendChild(p);
  }

  OTAPI.select('vacancies',
    'select=id,title,company,location,job_type,description,requirements,created_at&is_published=eq.true&order=created_at.desc&limit=' + limit)
    .then(function (rows) {
      if (!rows.length) { empty('لا توجد وظائف منشورة حاليًا. سنراجع بياناتك عند توفر فرص مناسبة.'); return; }
      box.textContent = '';
      var list = el('div', 'vac-list');
      rows.forEach(function (r) {
        var card = el('article', 'vac');
        card.appendChild(el('h3', null, r.title));
        var meta = el('div', 'vac-meta');
        [r.company, r.location, r.job_type].forEach(function (m) { if (m) meta.appendChild(el('span', 'chip', m)); });
        card.appendChild(meta);
        if (r.description) card.appendChild(el('p', null, r.description));
        if (r.requirements) {
          var req = el('p', 'vac-req');
          req.appendChild(el('strong', null, 'المتطلبات: '));
          req.appendChild(document.createTextNode(r.requirements));
          card.appendChild(req);
        }
        var a = el('a', 'btn btn-primary btn-sm', 'التقديم على الوظيفة');
        a.href = '/register.html?job=' + encodeURIComponent(r.title);
        card.appendChild(a);
        list.appendChild(card);
      });
      box.appendChild(list);
    })
    .catch(function () { empty('تعذّر تحميل الوظائف الآن.'); });
})();
