/* Sell form: client-side photo checks (size, sharpness, light, duplicates), compression, upload, then insert as "pending". */
(function () {
  var form = document.getElementById('sellForm');
  if (!form) return;
  var M = window.OTMarket, el = M.el;
  var MAX = 8, MIN_SIDE = 480, list = document.getElementById('photoList'), input = document.getElementById('photoInput');
  var msg = form.querySelector('.form-msg'), btn = form.querySelector('button[type="submit"]'), label = btn.textContent;
  var photos = []; // {blob, w, h, hash, warn[], thumb}
  var last = 0;

  function show(text, ok) { msg.hidden = false; msg.className = 'form-msg ' + (ok ? 'ok' : 'err'); msg.textContent = text; msg.scrollIntoView({ block: 'nearest' }); }

  function loadImg(file) {
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(file), i = new Image();
      i.onload = function () { URL.revokeObjectURL(u); res(i); };
      i.onerror = function () { URL.revokeObjectURL(u); rej(new Error('bad')); };
      i.src = u;
    });
  }
  function draw(img, w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); return c; }

  function analyse(img) {
    var s = 128, sc = Math.min(1, s / Math.max(img.width, img.height));
    var w = Math.max(8, Math.round(img.width * sc)), h = Math.max(8, Math.round(img.height * sc));
    var d = draw(img, w, h).getContext('2d').getImageData(0, 0, w, h).data, g = new Float32Array(w * h), sum = 0, i;
    for (i = 0; i < w * h; i++) { g[i] = d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114; sum += g[i]; }
    var mean = sum / (w * h), lap = 0, n = 0, x, y;
    for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) {
      var k = y * w + x, v = 4 * g[k] - g[k - 1] - g[k + 1] - g[k - w] - g[k + w];
      lap += v * v; n++;
    }
    var sharp = lap / n;
    // 8x8 average hash for duplicate detection
    var t = draw(img, 8, 8).getContext('2d').getImageData(0, 0, 8, 8).data, vals = [], m = 0;
    for (i = 0; i < 64; i++) { vals.push(t[i * 4] * 0.299 + t[i * 4 + 1] * 0.587 + t[i * 4 + 2] * 0.114); m += vals[i]; }
    m /= 64;
    return { mean: mean, sharp: sharp, hash: vals.map(function (v) { return v > m ? 1 : 0; }) };
  }
  function ham(a, b) { var n = 0; for (var i = 0; i < 64; i++) if (a[i] !== b[i]) n++; return n; }

  function toBlob(img) {
    var sc = Math.min(1, 1600 / Math.max(img.width, img.height));
    var c = draw(img, Math.round(img.width * sc), Math.round(img.height * sc));
    return new Promise(function (res) { c.toBlob(res, 'image/jpeg', 0.85); });
  }

  async function addFiles(files) {
    for (var f of Array.from(files)) {
      if (photos.length >= MAX) { show('الحد الأقصى ' + MAX + ' صور.', false); break; }
      if (!/^image\//.test(f.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(f.name)) { show('«' + f.name + '» ليس صورة.', false); continue; }
      try {
        var img = await loadImg(f);
        if (Math.min(img.width, img.height) < MIN_SIDE) { show('الصورة «' + f.name + '» صغيرة جدًا. التقط صورة أوضح (أقل من ' + MIN_SIDE + ' بكسل).', false); continue; }
        var a = analyse(img), warn = [];
        if (photos.some(function (p) { return ham(p.hash, a.hash) <= 4; })) { show('الصورة «' + f.name + '» مكررة، تم تجاهلها.', false); continue; }
        if (a.sharp < 40) warn.push('blur');
        if (a.mean < 45) warn.push('dark');
        if (a.mean > 225) warn.push('bright');
        var blob = await toBlob(img);
        if (!blob || blob.size > 8 * 1024 * 1024) { show('تعذّر تجهيز الصورة «' + f.name + '».', false); continue; }
        photos.push({ blob: blob, w: img.width, h: img.height, hash: a.hash, warn: warn, thumb: URL.createObjectURL(blob) });
      } catch (e) { show('تعذّر قراءة «' + f.name + '». جرّب صيغة JPG أو PNG.', false); }
    }
    render();
  }

  var WARN = { blur: 'الصورة غير واضحة، يفضّل إعادة التصوير', dark: 'الصورة مظلمة، صوّر في إضاءة أفضل', bright: 'الصورة شديدة الإضاءة' };
  function render() {
    list.textContent = '';
    photos.forEach(function (p, i) {
      var li = el('li', 'photo-item' + (p.warn.length ? ' warn' : ''));
      var im = el('img'); im.src = p.thumb; im.alt = 'صورة ' + (i + 1);
      li.appendChild(im);
      if (i === 0) li.appendChild(el('span', 'photo-main', 'الرئيسية'));
      if (p.warn.length) li.appendChild(el('span', 'photo-warn', p.warn.map(function (w) { return WARN[w]; }).join('، ')));
      var x = el('button', 'photo-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'حذف الصورة');
      x.addEventListener('click', function () { URL.revokeObjectURL(p.thumb); photos.splice(i, 1); render(); });
      li.appendChild(x);
      list.appendChild(li);
    });
    document.getElementById('photoCount').textContent = photos.length + ' / ' + MAX;
  }

  input.addEventListener('change', function () { addFiles(input.files); input.value = ''; });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (form.elements.website && form.elements.website.value) return;
    if (Date.now() - last < 20000) { show('انتظر قليلًا ثم أعد المحاولة.', false); return; }
    if (!form.checkValidity()) { form.reportValidity(); return; }
    if (!photos.length) { show('أضف صورة واحدة على الأقل. الإعلان بالصور أسرع بيعًا.', false); return; }
    var f = form.elements, id = (crypto.randomUUID ? crypto.randomUUID() : null);
    if (!id) { show('متصفحك قديم، حدّثه أو تواصل معنا عبر واتساب.', false); return; }
    btn.disabled = true; btn.textContent = 'جارٍ رفع الصور…';
    var uploaded = [];
    try {
      for (var i = 0; i < photos.length; i++) {
        var path = 'uploads/' + id + '/' + (i + 1) + '.jpg';
        await OTAPI.upload('listing-uploads', path, photos[i].blob, 'image/jpeg');
        uploaded.push({ path: path, w: photos[i].w, h: photos[i].h, warn: photos[i].warn });
        btn.textContent = 'جارٍ رفع الصور… ' + (i + 1) + '/' + photos.length;
      }
      btn.textContent = 'جارٍ الإرسال…';
      var price = f.price.value.trim() ? Number(f.price.value.replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); })) : null;
      var ref = await OTAPI.insertRequest('listings', {
        id: id, kind: f.kind.value, category: f.category.value, title: f.title.value.trim(), description: f.description.value.trim(),
        price: isFinite(price) ? price : null, currency: f.currency.value, negotiable: f.negotiable.checked,
        condition: f.condition.value || null, city: f.city.value.trim(), seller_name: f.seller_name.value.trim(),
        phone: f.phone.value.trim(), show_phone: f.show_phone.checked, images: uploaded, consent: true
      });
      last = Date.now();
      form.hidden = true;
      var box = document.getElementById('sellDone');
      OTReceipt(box, ref, 'وصلنا إعلانك! سيراجعه المكتب ويُنشر بعد الموافقة. إن احتجنا تعديلًا نخبرك عبر "تابع طلبك".');
      box.scrollIntoView({ block: 'start' });
    } catch (err) {
      btn.disabled = false; btn.textContent = label;
      show('تعذّر إرسال الإعلان الآن. تأكد من الاتصال وحاول مرة أخرى، أو أرسله لنا عبر واتساب.', false);
    }
  });
})();
