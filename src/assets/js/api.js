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

  window.OTAPI = {
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
