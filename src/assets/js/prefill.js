/* Fills form fields from ?p_<name>=<value> (used by the chat assistant). Text fields only; the visitor reviews and submits. */
(function () {
  var q;
  try { q = new URLSearchParams(location.search); } catch (e) { return; }
  q.forEach(function (v, k) {
    if (k.indexOf('p_') !== 0) return;
    var name = k.slice(2);
    if (!/^[a-z_]+$/.test(name)) return;
    var f = document.querySelector('form [name="' + name + '"]');
    if (!f || f.value) return;
    var tag = f.tagName.toLowerCase(), type = (f.type || '').toLowerCase();
    if (['file', 'checkbox', 'radio', 'hidden', 'password'].indexOf(type) >= 0 || f.closest('.hp')) return;
    v = String(v).slice(0, +f.maxLength > 0 ? f.maxLength : 300);
    if (tag === 'select') {
      Array.prototype.some.call(f.options, function (o) { if (o.value === v || o.text === v) { f.value = o.value; return true; } return false; });
    } else f.value = v;
  });
})();
