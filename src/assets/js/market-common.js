/* Shared marketplace helpers */
(function () {
  var C = window.OT || {};
  var MEDIA = C.SUPABASE_URL + '/storage/v1/object/public/site-media/';
  window.OTMarket = {
    CATS: { cars: ['🚗', 'سيارات ومركبات'], realestate: ['🏠', 'عقارات وأراضي'], furniture: ['🛋️', 'أثاث ومفروشات'], electronics: ['📱', 'إلكترونيات وجوالات'], appliances: ['🧊', 'أجهزة كهربائية ومنزلية'], fashion: ['👕', 'ملابس وأزياء'], equipment: ['🛠️', 'معدات وأدوات'], animals: ['🐑', 'حيوانات ومواشي'], other: ['📦', 'أخرى'] },
    KINDS: { sale: 'للبيع', rent: 'للإيجار', wanted: 'مطلوب' },
    CUR: { YER: 'ريال يمني', SAR: 'ريال سعودي', USD: 'دولار' },
    media: function (path) { return MEDIA + path.split('/').map(encodeURIComponent).join('/'); },
    price: function (l) {
      if (l.price == null) return 'السعر عند التواصل';
      return Number(l.price).toLocaleString('en-US') + ' ' + (this.CUR[l.currency] || '') + (l.negotiable ? ' (قابل للتفاوض)' : '');
    },
    el: function (tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; },
    wa: function (l) {
      var msg = 'مرحبًا، أريد الاستفسار عن الإعلان رقم ' + l.ref + ' (' + l.title + ') في سوق أونلاين تك.';
      return 'https://wa.me/' + C.WHATSAPP + '?text=' + encodeURIComponent(msg);
    }
  };
})();
