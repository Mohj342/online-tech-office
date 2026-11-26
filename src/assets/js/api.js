/* Minimal Supabase REST client (no dependencies). Uses only the publishable key; access is limited by Row Level Security. */
(function () {
  var C = window.OT || {};

  function headers(token, extra) {
    var h = { apikey: C.SUPABASE_KEY, 'Content-Type': 'application/json' };
    if (token) h.Authorization = 'Bearer ' + token;
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }

  async function check(res) {
    if (res.ok) return res;
    var body = '';
    try { body = await res.text(); } catch (e) {}
    var err = new Error('HTTP ' + res.status);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  function newRef() {
    var n = new Uint32Array(1);
    (window.crypto || window.msCrypto).getRandomValues(n);
    return 'OT-' + String(100000 + (n[0] % 900000));
  }

  window.OTAPI = {
    newRef: newRef,
    /* insert a request with a fresh request number; retries if the number is already taken */
    insertRequest: async function (table, row) {
      for (var i = 0; i < 4; i++) {
        row.ref = newRef();
        try { await window.OTAPI.insert(table, row); return row.ref; }
        catch (e) { if (e.status !== 409 || i === 3) throw e; }
      }
    },
    rpc: async function (fn, args, token) {
      var res = await fetch(C.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
        method: 'POST',
        headers: headers(token),
        body: JSON.stringify(args || {})
      });
      await check(res);
      return res.json();
    },
    insert: async function (table, row) {
      var res = await fetch(C.SUPABASE_URL + '/rest/v1/' + table, {
        method: 'POST',
        headers: headers(null, { Prefer: 'return=minimal' }),
        body: JSON.stringify(row)
      });
      await check(res);
    },
    select: async function (table, query, token) {
      var res = await fetch(C.SUPABASE_URL + '/rest/v1/' + table + '?' + query, { headers: headers(token) });
      await check(res);
      return res.json();
    },
    insertAuth: async function (table, row, token) {
      var res = await fetch(C.SUPABASE_URL + '/rest/v1/' + table, {
        method: 'POST',
        headers: headers(token, { Prefer: 'return=minimal' }),
        body: JSON.stringify(row)
      });
      await check(res);
    },
    patch: async function (table, id, body, token) {
      var res = await fetch(C.SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: headers(token, { Prefer: 'return=minimal' }),
        body: JSON.stringify(body)
      });
      await check(res);
    },
    remove: async function (table, id, token) {
      var res = await fetch(C.SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + encodeURIComponent(id), {
        method: 'DELETE',
        headers: headers(token, { Prefer: 'return=minimal' })
      });
      await check(res);
    },
    /* private file storage: visitors may only add new files; admins read through short-lived signed links */
    upload: async function (bucket, path, file, type) {
      var res = await fetch(C.SUPABASE_URL + '/storage/v1/object/' + bucket + '/' + path, {
        method: 'POST',
        headers: { apikey: C.SUPABASE_KEY, Authorization: 'Bearer ' + C.SUPABASE_KEY, 'Content-Type': type || 'application/octet-stream', 'x-upsert': 'false', 'cache-control': '3600' },
        body: file
      });
      await check(res);
    },
    signUrl: async function (bucket, path, token, download) {
      var res = await fetch(C.SUPABASE_URL + '/storage/v1/object/sign/' + bucket + '/' + path, {
        method: 'POST',
        headers: headers(token),
        body: JSON.stringify({ expiresIn: 600 })
      });
      await check(res);
      var j = await res.json();
      var u = C.SUPABASE_URL + '/storage/v1' + (j.signedURL || j.signedUrl);
      return download ? u + (u.indexOf('?') < 0 ? '?' : '&') + 'download=' : u;
    },
    removeFiles: async function (bucket, paths, token) {
      var res = await fetch(C.SUPABASE_URL + '/storage/v1/object/' + bucket, {
        method: 'DELETE',
        headers: headers(token),
        body: JSON.stringify({ prefixes: paths })
      });
      await check(res);
    },
    login: async function (email, password) {
      var res = await fetch(C.SUPABASE_URL + '/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: headers(null),
        body: JSON.stringify({ email: email, password: password })
      });
      await check(res);
      return res.json();
    },
    /* update the signed-in user: { data: {name,...} } and/or { password, nonce } */
    updateUser: async function (body, token) {
      var res = await fetch(C.SUPABASE_URL + '/auth/v1/user', { method: 'PUT', headers: headers(token), body: JSON.stringify(body) });
      await check(res);
      return res.json();
    },
    /* emails a one-time confirmation code (nonce) to the signed-in user */
    reauthenticate: async function (token) {
      var res = await fetch(C.SUPABASE_URL + '/auth/v1/reauthenticate', { headers: headers(token) });
      await check(res);
    },
    refresh: async function (refreshToken) {
      var res = await fetch(C.SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: headers(null),
        body: JSON.stringify({ refresh_token: refreshToken })
      });
      await check(res);
      return res.json();
    }
  };
})();

/* Success receipt shown after any request: big request number, copy, save to WhatsApp, track link. */
(function () {
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  window.OTReceipt = function (box, ref, lead) {
    box.hidden = false;
    box.className = 'form-msg ok receipt';
    box.textContent = '';
    box.appendChild(el('p', 'receipt-lead', lead));
    var row = el('p', 'receipt-ref');
    row.appendChild(el('span', null, 'رقم طلبك: '));
    var code = el('strong', null, ref);
    code.dir = 'ltr';
    row.appendChild(code);
    box.appendChild(row);
    box.appendChild(el('p', 'receipt-hint', 'احتفظ بهذا الرقم لمتابعة حالة طلبك.'));
    var acts = el('div', 'btn-row');
    var copy = el('button', 'btn btn-ghost btn-sm', 'نسخ الرقم');
    copy.type = 'button';
    copy.addEventListener('click', function () {
      var done = function () { copy.textContent = 'تم النسخ ✓'; setTimeout(function () { copy.textContent = 'نسخ الرقم'; }, 2000); };
      if (navigator.clipboard) navigator.clipboard.writeText(ref).then(done, function () {});
    });
    var url = location.origin + '/track.html?ref=' + encodeURIComponent(ref);
    var wa = el('a', 'btn btn-ghost btn-sm', 'احفظه في واتساب');
    wa.href = 'https://wa.me/?text=' + encodeURIComponent('رقم طلبي لدى مكتب أونلاين تك: ' + ref + '\nمتابعة الطلب: ' + url);
    wa.target = '_blank'; wa.rel = 'noopener noreferrer';
    var tr = el('a', 'btn btn-primary btn-sm', 'تابع طلبك');
    tr.href = '/track.html?ref=' + encodeURIComponent(ref);
    acts.appendChild(copy); acts.appendChild(wa); acts.appendChild(tr);
    box.appendChild(acts);
  };
})();
