/* Theme switcher: light / dark / follow the device. The first paint is handled by the inline script in <head>. */
(function () {
  var root = document.documentElement;
  var btn = document.getElementById('themeBtn');
  var menu = document.getElementById('themeMenu');
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var meta = document.querySelector('meta[name="theme-color"]');

  function saved() {
    try { var p = localStorage.getItem('ot-theme'); return p === 'light' || p === 'dark' ? p : 'auto'; } catch (e) { return 'auto'; }
  }
  function apply(pref) {
    var eff = pref === 'auto' ? (mq && mq.matches ? 'dark' : 'light') : pref;
    root.setAttribute('data-theme', eff);
    root.setAttribute('data-pref', pref);
    if (meta) meta.setAttribute('content', eff === 'dark' ? '#1C1A18' : '#FF8F1F');
    if (menu) Array.prototype.forEach.call(menu.querySelectorAll('[data-theme-set]'), function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-theme-set') === pref ? 'true' : 'false');
    });
  }
  function store(pref) {
    try { if (pref === 'auto') localStorage.removeItem('ot-theme'); else localStorage.setItem('ot-theme', pref); } catch (e) {}
  }

  apply(saved());
  if (mq) {
    var onChange = function () { if (saved() === 'auto') apply('auto'); };
    if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
  }
  window.addEventListener('storage', function (e) { if (e.key === 'ot-theme') apply(saved()); });

  if (!btn || !menu) return;
  function open(v) {
    menu.hidden = !v;
    btn.setAttribute('aria-expanded', v ? 'true' : 'false');
  }
  btn.addEventListener('click', function (e) { e.stopPropagation(); open(menu.hidden); });
  menu.addEventListener('click', function (e) {
    var b = e.target.closest('[data-theme-set]');
    if (!b) return;
    var pref = b.getAttribute('data-theme-set');
    store(pref);
    apply(pref);
    open(false);
    btn.focus();
  });
  document.addEventListener('click', function (e) { if (!menu.hidden && !menu.contains(e.target) && e.target !== btn) open(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { open(false); btn.focus(); } });
})();
