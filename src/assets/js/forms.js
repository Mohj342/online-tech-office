/* Generic handler: <form data-table="..."> posts its named fields as one row to that table. */
(function () {
  var C = window.OT || {};
  var COOLDOWN_MS = 20000;

  function waFallback() {
    return 'https://wa.me/' + C.WHATSAPP;
  }

  function showMsg(box, kind, text, withWa) {
    box.hidden = false;
    box.className = 'form-msg ' + kind;
    box.textContent = text;
    if (withWa) {
      box.appendChild(document.createTextNode(' '));
      var a = document.createElement('a');
      a.href = waFallback();
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = 'تواصل معنا عبر واتساب';
      box.appendChild(a);
    }
  }

  function lastSent(table) {
    try { return +localStorage.getItem('ot_last_' + table) || 0; } catch (e) { return 0; }
  }
  function markSent(table) {
    try { localStorage.setItem('ot_last_' + table, String(Date.now())); } catch (e) {}
  }

  // Prefill the desired job when arriving from a vacancy card: /register.html?job=...
  try {
    var job = new URLSearchParams(location.search).get('job');
    var jobField = document.querySelector('form[data-table="job_seekers"] [name="desired_job"]');
    if (job && jobField) jobField.value = job.slice(0, 150);
  } catch (e) {}

  Array.prototype.forEach.call(document.querySelectorAll('form[data-table]'), function (form) {
    var btn = form.querySelector('button[type="submit"]');
    var label = btn ? btn.textContent : '';
    var box = form.querySelector('.form-msg');

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }

      var table = form.getAttribute('data-table');
      var fd = new FormData(form);

      // honeypot: bots fill the hidden "website" field
      if (fd.get('website')) {
        showMsg(box, 'ok', 'تم استلام طلبك. شكرًا لتواصلك.');
        form.reset();
        return;
      }

      if (Date.now() - lastSent(table) < COOLDOWN_MS) {
        showMsg(box, 'err', 'تم إرسال طلب قبل قليل. انتظر لحظات ثم أعد المحاولة.');
        return;
      }

      var row = {};
      fd.forEach(function (v, k) {
        if (k === 'website') return;
        v = String(v).trim();
        if (v !== '') row[k] = v;
      });

      btn.disabled = true;
      btn.textContent = 'جارٍ الإرسال…';
      try {
        await OTAPI.insert(table, row);
        markSent(table);
        form.reset();
        showMsg(box, 'ok', 'تم استلام بياناتك بنجاح. سنراجعها ونتواصل معك عند الحاجة.');
        box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (err) {
        showMsg(box, 'err', 'تعذّر إرسال الطلب الآن. أعد المحاولة بعد قليل، أو', true);
      } finally {
        btn.disabled = false;
        btn.textContent = label;
      }
    });
  });
})();
