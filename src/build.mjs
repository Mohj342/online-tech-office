// Static site generator for مكتب أونلاين تك. Run: node src/build.mjs  → writes ./dist
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { jobApplicationForm, employerRequestForm } from './jobform.mjs';
import { ABOUT, SERVICE_DETAILS, FAQ, PRIVACY, TERMS } from './content.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const dist = path.join(root, 'dist');
const S = JSON.parse(fs.readFileSync(path.join(here, 'site.json'), 'utf8'));
const SV = S.services;

// One build id over every asset + site.json → ?v= on css/js/logo URLs so browsers never keep a stale copy
const BUILD = (() => {
  const h = crypto.createHash('md5');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).forEach((e) => {
    const f = path.join(d, e.name);
    e.isDirectory() ? walk(f) : h.update(e.name).update(fs.readFileSync(f));
  });
  walk(path.join(here, 'assets'));
  h.update(fs.readFileSync(path.join(here, 'site.json')));
  return h.digest('hex').slice(0, 8);
})();
const asset = (p) => `${p}?v=${BUILD}`;
const CSS = fs.readFileSync(path.join(here, 'assets/css/style.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n+/g, '\n').trim();

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const svcUrl = (s) => `/services/${s.slug}.html`;

// Illustrative images (AI-generated, 16:9 WebP in 640/1280 widths). Frames crop to their own aspect ratio, so any image fits.
const AI_ALT = {
  employment: 'مقابلة توظيف ومصافحة بين باحث عن عمل وصاحب عمل',
  students: 'طالب يستلم بحثه المطبوع والمجلّد من موظفة الخدمات الطلابية',
  design: 'مصممة تعمل على هوية بصرية ومطبوعات إعلانية',
  marketing: 'هاتف يعرض منشورات تسويقية وحاسوب يعرض نمو الأداء',
  events: 'قاعة احتفالات مزينة بالكوشة والزهور والإضاءة',
  travel: 'طائرة تقلع وقت الغروب وحقيبة سفر عليها جواز وتذكرة',
  realestate: 'يد تحمل مفاتيح منزل أمام فيلا وعمارة سكنية حديثة',
  'office-service': 'موظفة خدمة عملاء تستقبل عميلًا وتساعده في طلبه'
};
function aiImg(key, { eager = false, sizes = '(max-width: 760px) 100vw, 50vw', cls = '' } = {}) {
  const b = `/assets/img/ai/${key}`;
  return `<img class="${cls}" src="${b}-1280.webp" srcset="${b}-640.webp 640w, ${b}-1280.webp 1280w" sizes="${sizes}" width="1280" height="720" alt="${esc(AI_ALT[key] || '')}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">`;
}
const nb = (s) => s.replace(/ /g, ' '); // keep each number on one line
const tel = (p) => `<a href="tel:${p.intl}" dir="ltr">${nb(p.display)}</a>`;
const ORD = ['الأول', 'الثاني', 'الثالث', 'الرابع'];

/* ---------- icons ---------- */
const ICON = {
  employment: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  students: '<path d="M2 9l10-5 10 5-10 5-10-5z"/><path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5M22 9v6"/>',
  design: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.8 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/>',
  marketing: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  events: '<path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"/>',
  travel: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  realestate: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10M10 20v-6h4v6"/>'
};
const icon = (k, size = 26) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;
const logoImg = (cls = 'logo', dual = true) => {
  const base = `class="${cls}${dual ? ' logo-l' : ''}"${cls === 'hero-logo' ? ' fetchpriority="high"' : ''} src="${asset('/assets/img/logo.svg')}" alt="${esc(S.fullName)}" width="2190" height="823"`;
  const dark = dual ? `<img class="${cls} logo-d" src="${asset('/assets/img/logo-dark.svg')}" alt="${esc(S.fullName)}" width="2190" height="823" loading="lazy" decoding="async">` : '';
  return `<img ${base}>${dark}`;
};

/* ---------- theme (light / dark / follow the device) ---------- */
// theme-init.js runs in <head> before first paint so there is no flash. Public pages inline it (no CSP there); /admin loads it as a file so its CSP needs no hashes.
const THEME_INIT = fs.readFileSync(path.join(here, 'assets/js/theme-init.js'), 'utf8').trim();
const THEME_SVG = (cls, d) => `<svg class="${cls}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I_LIGHT = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
const I_DARK = '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>';
const I_AUTO = '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>';
const THEME_CTL = `<div class="theme"><button class="theme-btn" type="button" id="themeBtn" aria-haspopup="true" aria-expanded="false" aria-controls="themeMenu" aria-label="مظهر الموقع">${THEME_SVG('i-light', I_LIGHT)}${THEME_SVG('i-dark', I_DARK)}${THEME_SVG('i-auto', I_AUTO)}</button>
<div class="theme-menu" id="themeMenu" role="group" aria-label="مظهر الموقع" hidden>
<button type="button" data-theme-set="light">${THEME_SVG('', I_LIGHT)} فاتح</button>
<button type="button" data-theme-set="dark">${THEME_SVG('', I_DARK)} داكن</button>
<button type="button" data-theme-set="auto">${THEME_SVG('', I_AUTO)} تلقائي (حسب جهازك)</button>
</div></div>`;

/* ---------- shared layout ---------- */
const NAV = [
  ['الرئيسية', '/index.html'],
  ['من نحن', '/about.html'],
  ['خدماتنا', '/services.html'],
  ['التوظيف', '/services/employment.html'],
  ['السوق', '/market.html'],
  ['تابع طلبك', '/track.html'],
  ['تواصل معنا', '/contact.html']
];

function layout({ file, title, desc, body, scripts = [], noindex = false, chat = true, minimal = false, extraLd = null }) {
  const fullTitle = file === 'index.html' ? `${S.fullName} | ${S.altName} – ذمار، اليمن` : `${title} | ${S.name}`;
  const url = '/' + file;
  const canon = S.siteUrl + (file === 'index.html' ? '/' : url);
  const ld = file === 'index.html' ? `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: S.fullName,
    alternateName: [S.name, S.altName],
    slogan: S.tagline,
    url: S.siteUrl + '/',
    logo: S.siteUrl + '/assets/img/icon-512.png',
    image: S.siteUrl + '/assets/img/icon-512.png',
    telephone: S.phones.map((x) => x.intl),
    address: { '@type': 'PostalAddress', streetAddress: S.address, addressLocality: 'ذمار', addressCountry: 'YE' },
    sameAs: [S.facebook],
    areaServed: 'YE',
    knowsLanguage: 'ar'
  }).replace(/</g, '\\u003c')}</script>\n` : '';
  const ldTag = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>\n`;
  const crumbList = (items) => ldTag({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([n, u], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: S.siteUrl + u }))
  });
  let ld2 = extraLd ? ldTag(extraLd) : '';
  if (!noindex && file !== 'index.html') {
    const trail = [['الرئيسية', '/']];
    if (file.startsWith('services/')) trail.push(['خدماتنا', '/services.html']);
    trail.push([title, '/' + file]);
    ld2 = crumbList(trail);
    if (file.startsWith('services/')) {
      ld2 += ldTag({
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: title,
        description: desc,
        url: canon,
        areaServed: 'YE',
        provider: { '@type': 'ProfessionalService', name: S.fullName, url: S.siteUrl + '/' }
      });
    }
  }
  const nav = NAV.map(([t, u]) => `<a href="${u}"${u === url ? ' aria-current="page"' : ''}>${t}</a>`).join('');
  const header = minimal
    ? `<header class="site-header"><div class="container bar"><a class="brand" href="/index.html">${logoImg()}</a><div class="bar-end"><span class="brand-note">لوحة الإدارة</span>${THEME_CTL}</div></div></header>`
    : `<header class="site-header"><div class="container bar">
  <a class="brand" href="/index.html" aria-label="${esc(S.name)} — الرئيسية">${logoImg()}</a>
  <nav class="nav" id="nav" aria-label="القائمة الرئيسية">${nav}<button class="btn btn-primary btn-sm" type="button" data-open-chat>تحدث معنا</button></nav>
  <div class="bar-end">${THEME_CTL}
  <button class="menu-btn" type="button" id="menuBtn" aria-expanded="false" aria-controls="nav"><span class="sr">القائمة</span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button></div>
</div></header>`;
  const footer = minimal ? '' : `<footer class="site-footer">
  <div class="container foot-grid">
    <div><img class="foot-logo" src="${asset('/assets/img/logo-dark.svg')}" alt="${esc(S.fullName)}" width="2190" height="823" loading="lazy" decoding="async"><p>${esc(S.tagline)}.</p></div>
    <div><h2>أقسامنا</h2><ul>${SV.map((s) => `<li><a href="${svcUrl(s)}">${esc(s.title)}</a></li>`).join('')}</ul></div>
    <div><h2>تواصل معنا</h2><ul>
      ${S.phones.map((p) => `<li class="num">${tel(p)}</li>`).join('')}
      <li>${esc(S.address)}</li>
      <li><a href="${S.facebook}" target="_blank" rel="noopener noreferrer">صفحتنا على فيسبوك</a></li>
      <li><a href="${S.whatsappGroup}" target="_blank" rel="noopener noreferrer">قناة الوظائف على واتساب</a></li>
      <li><a href="/register.html">التسجيل كباحث عن عمل</a></li>
      <li><a href="/employers.html">طلب موظفين</a></li>
    </ul></div>
  </div>
  <div class="container foot-bottom"><span>© ${S.year} ${esc(S.fullName)}. جميع الحقوق محفوظة.</span><nav class="foot-links" aria-label="روابط السياسات"><a href="/market.html">سوق الإعلانات</a><a href="/track.html">تابع طلبك</a><a href="/works.html">أعمالنا</a><a href="/reviews.html">آراء العملاء</a><a href="/news.html">الأخبار والإعلانات</a><a href="/faq.html">الأسئلة الشائعة</a><a href="/privacy.html">سياسة الخصوصية</a><a href="/terms.html">شروط الاستخدام</a></nav></div>
</footer>`;
  const scriptTags = ['/assets/js/theme.js', '/assets/js/config.js', '/assets/js/api.js']
    .concat(minimal ? [] : ['/assets/js/nav.js'])
    .concat(body.includes('data-table=') ? ['/assets/js/forms.js'] : [])
    .concat(body.includes('<form') && !minimal ? ['/assets/js/prefill.js'] : [])
    .concat(scripts)
    .concat(chat && !minimal ? ['/assets/js/chat.js'] : [])
    .map((s) => `<script src="${asset(s)}" defer></script>`).join('\n');

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#FF8F1F">
${noindex ? '<meta name="robots" content="noindex, nofollow">\n' : `<link rel="canonical" href="${canon}">\n`}<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(S.fullName)}">
<meta property="og:url" content="${canon}">
<meta property="og:image" content="${S.siteUrl}/assets/img/icon-512.png">
<meta property="og:locale" content="ar_AR">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
<link rel="icon" type="image/png" sizes="48x48" href="${asset('/assets/img/favicon-48.png')}">
<link rel="icon" type="image/png" sizes="192x192" href="${asset('/assets/img/icon-192.png')}">
<link rel="apple-touch-icon" href="${asset('/assets/img/apple-touch-icon.png')}">
<link rel="preload" href="/assets/fonts/plex-ar-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/reem-ar-700.woff2" as="font" type="font/woff2" crossorigin>
${minimal ? `<script src="${asset('/assets/js/theme-init.js')}"></script>\n<link rel="stylesheet" href="${asset('/assets/css/style.css')}">` : `<script>${THEME_INIT}</script>\n<style>${CSS}</style>`}
${ld}${ld2}</head>
<body>
<a class="skip" href="#main">تخطَّ إلى المحتوى</a>
${header}
<main id="main">
${body}
</main>
${footer}
${scriptTags}
</body>
</html>
`;
}

/* ---------- building blocks ---------- */
function field(name, label, o = {}) {
  const id = 'f_' + name;
  const star = o.req ? ' <span class="req" aria-hidden="true">*</span>' : '';
  const base = `id="${id}" name="${name}"${o.req ? ' required' : ''}${o.max ? ` maxlength="${o.max}"` : ''}${o.ac ? ` autocomplete="${o.ac}"` : ''}`;
  let ctl;
  if (o.textarea) ctl = `<textarea ${base}${o.req ? ' minlength="2"' : ''} rows="${o.rows || 4}"></textarea>`;
  else if (o.type === 'tel') ctl = `<input type="tel" inputmode="tel" dir="ltr" minlength="6" pattern="[0-9+\\s\\-]{6,30}" title="أرقام فقط، من 6 إلى 30 خانة" ${base}>`;
  else ctl = `<input type="text"${o.req ? ' minlength="2"' : ''} ${base}>`;
  return `<div class="field"><label for="${id}">${label}${star}</label>${ctl}</div>`;
}

function formBlock({ table, fields, submit, hidden = '', plain = false, ok = '' }) {
  return `<form class="form" data-table="${table}"${plain ? ' data-plain' : ''}${ok ? ` data-ok="${esc(ok)}"` : ''} aria-label="${esc(submit)}">
  ${hidden}
  ${fields.join('\n  ')}
  <div class="hp" aria-hidden="true"><label>لا تملأ هذا الحقل<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
  <div class="form-msg" role="status" aria-live="polite" hidden></div>
  <button class="btn btn-primary" type="submit">${esc(submit)}</button>
</form>`;
}

function pageHero({ title, lead, crumbs = [], img = '' }) {
  const trail = [['الرئيسية', '/index.html'], ...crumbs].map(([t, u]) => `<a href="${u}">${esc(t)}</a>`).join(' / ');
  const text = `<div class="crumbs">${trail}</div>
  <h1>${esc(title)}</h1>
  ${lead ? `<p>${esc(lead)}</p>` : ''}`;
  if (!img) return `<section class="page-hero"><div class="container">
  ${text}
</div></section>`;
  return `<section class="page-hero has-img"><div class="container hero-split">
  <div class="hero-text">${text}</div>
  <figure class="frame hero-frame">${aiImg(img, { eager: true, sizes: '(max-width: 760px) 100vw, 46vw' })}</figure>
</div></section>`;
}

function serviceCards() {
  return `<div class="cards">${SV.map((s, i) => `<a class="card has-media${i === 0 ? ' feat' : ''}" href="${svcUrl(s)}">
  <span class="card-media">${aiImg(s.slug, { sizes: i === 0 ? '(max-width: 560px) 100vw, (max-width: 1000px) 100vw, 50vw' : '(max-width: 560px) 100vw, (max-width: 1000px) 50vw, 25vw' })}</span>
  <span class="ico-wrap">${icon(s.slug, 28)}</span>
  <h3>${esc(s.title)}</h3>
  <p>${esc(s.short)}</p>
  <span class="more">التفاصيل ←</span>
</a>`).join('\n')}</div>`;
}

// Yemeni mobiles start with 7 after the country code; landlines can't receive WhatsApp
const isMobile = (p) => /^\+9677/.test(p.intl);

const contactSide = () => `<aside class="side">
  <div class="panel">
    <h3>للتواصل المباشر</h3>
    ${S.phones.map((p, i) => `<div class="kv"><span class="k">رقم التواصل ${ORD[i]}</span><span class="num">${tel(p)}</span>${isMobile(p) ? `<span class="btn-row mini"><a class="btn btn-ghost btn-sm" href="tel:${p.intl}" aria-label="اتصال على ${p.display}">اتصال</a><a class="btn btn-ghost btn-sm" href="https://wa.me/${p.intl.replace('+', '')}" target="_blank" rel="noopener noreferrer" aria-label="واتساب ${p.display}">واتساب</a></span>` : ''}</div>`).join('')}
  </div>
  <div class="panel">
    <h3>زيارة المكتب</h3>
    <p>${esc(S.address)}</p>
  </div>
  <div class="panel">
    <h3>تابعنا</h3>
    <div class="btn-row">
      <a class="btn btn-ghost btn-sm" href="${S.facebook}" target="_blank" rel="noopener noreferrer">صفحتنا على فيسبوك</a>
      <a class="btn btn-ghost btn-sm" href="${S.whatsappGroup}" target="_blank" rel="noopener noreferrer">قناة الوظائف على واتساب</a>
    </div>
  </div>
</aside>`;

// Static fallback is the empty state, so readers/crawlers without JavaScript never see an endless "loading" text; vacancies.js replaces it.
const vacanciesBlock = (limit) => `<div id="vacancies" data-limit="${limit}" aria-live="polite"><p class="vac-empty">لا توجد وظائف منشورة حاليًا. <a href="/register.html">سجّل بياناتك كباحث عن عمل</a> وسنراجعها عند توفر فرص مناسبة.</p></div>`;

/* ---------- pages ---------- */
const pages = {};

pages['index.html'] = layout({
  file: 'index.html',
  title: S.name,
  desc: `${S.fullName}: التوظيف، الخدمات الطلابية، الدعاية والتصميم، التسويق الإلكتروني، تعهد الحفلات، السفريات والسياحة، والخدمات العقارية.`,
  scripts: ['/assets/js/vacancies.js', '/assets/js/feeds.js'],
  body: `<section class="hero"><div class="container">
  <h1 class="sr">${esc(S.fullName)}</h1>
  ${logoImg('hero-logo')}
  <p class="hero-slogan">نربط <em>الكفاءات</em> بالفرص المناسبة</p>
    <p>${esc(S.fullName)}. سبعة أقسام في مكان واحد: التوظيف، الخدمات الطلابية، الدعاية والتصميم، التسويق الإلكتروني، تعهد الحفلات، السفريات والسياحة، والخدمات العقارية.</p>
  <div class="hero-cta">
    <a class="btn btn-primary" href="/register.html">أبحث عن وظيفة</a>
    <a class="btn btn-dark" href="/employers.html">أحتاج موظفين</a>
  </div>
</div></section>

<section class="section"><div class="container">
  <h2>أقسام المكتب</h2>
  <p class="sub">اختر القسم المناسب لتعرف تفاصيل الخدمة وترسل طلبك.</p>
  ${serviceCards()}
</div></section>

<section class="section alt"><div class="container">
  <h2>كيف نخدمك</h2>
  <p class="sub">ثلاث خطوات من الطلب إلى الاتفاق على التفاصيل.</p>
  <ol class="steps">
    <li><span class="n">1</span><h3>أرسل طلبك</h3><p>عبر نموذج القسم، أو المحادثة، أو الاتصال بنا مباشرة.</p></li>
    <li><span class="n">2</span><h3>نراجع طلبك</h3><p>يطّلع فريق المكتب على طلبك ويتواصل معك.</p></li>
    <li><span class="n">3</span><h3>نتفق على التفاصيل</h3><p>نوضح لك الخدمة المتاحة ونرتب الخطوات التالية معك.</p></li>
  </ol>
</div></section>

<section class="section why"><div class="container">
  <h2>لماذا أونلاين تك؟</h2>
  <p class="sub">مكتب واحد يختصر عليك المشاوير، ويتابع طلبك حتى يكتمل.</p>
  <ul class="why-grid">
    <li><span class="why-ico" aria-hidden="true">🧭</span><h3>سبعة أقسام في مكان واحد</h3><p>من التوظيف والطباعة إلى السفر والعقار والمناسبات، بدون ما تلف على أكثر من جهة.</p></li>
    <li><span class="why-ico" aria-hidden="true">🔎</span><h3>تابع طلبك برقمه</h3><p>كل طلب ياخذ رقمًا، وتقدر تعرف حالته في أي وقت من صفحة «تابع طلبك».</p></li>
    <li><span class="why-ico" aria-hidden="true">🔒</span><h3>بياناتك في أمان</h3><p>ملفاتك وبياناتك محفوظة بخصوصية، ولا يطّلع عليها إلا فريق المكتب المختص.</p></li>
    <li><span class="why-ico" aria-hidden="true">🤝</span><h3>تواصل مباشر وسريع</h3><p>اتصال وواتساب ومحادثة في الموقع، وفريق يرد عليك ويتابع معك.</p></li>
  </ul>
</div></section>

<section class="section alt" data-feed-section hidden><div class="container">
  <h2>من أعمالنا</h2>
  <p class="sub">نماذج من مشاريع وخدمات نفذها المكتب.</p>
  <div class="works-grid" data-feed="works" data-limit="6"></div>
  <p class="after"><a class="btn btn-ghost" href="/works.html">كل الأعمال</a></p>
</div></section>

<section class="section" data-feed-section hidden><div class="container">
  <h2>آراء عملائنا</h2>
  <p class="sub">تجارب حقيقية من عملاء تعاملوا مع المكتب.</p>
  <div class="reviews-grid" data-feed="reviews" data-limit="3"></div>
  <p class="after"><a class="btn btn-ghost" href="/reviews.html">كل الآراء وأضف رأيك</a></p>
</div></section>

<section class="section alt" data-feed-section hidden><div class="container">
  <h2>شركاء النجاح</h2>
  <div class="partners-grid" data-feed="partners" data-limit="12"></div>
</div></section>

<section class="section"><div class="container">
  <h2>التوظيف</h2>
  <p class="sub">للباحثين عن عمل وللجهات الراغبة في توظيف كفاءات.</p>
  <div class="split">
    <div class="box"><h3>أبحث عن وظيفة</h3><p>املأ استمارة التوظيف وأرفق سيرتك الذاتية ليراجعها المكتب عند توفر فرص مناسبة.</p><a class="btn btn-primary" href="/register.html">سجّل بياناتك</a></div>
    <div class="box"><h3>أحتاج موظفين</h3><p>أرسل طلب جهتك والوظائف المطلوبة لننسّق معك بخصوص الكفاءات المتاحة.</p><a class="btn btn-primary" href="/employers.html">أرسل طلب موظفين</a></div>
  </div>
</div></section>

<section class="section alt"><div class="container">
  <h2>أحدث الوظائف</h2>
  <p class="sub">الوظائف المنشورة حاليًا في المكتب.</p>
  ${vacanciesBlock(3)}
  <p><a href="/services/employment.html">كل الوظائف وخدمات التوظيف ←</a></p>
</div></section>

<section class="band"><div class="container">
  <div><h2>للتواصل المباشر مع فريق المكتب</h2><p>${esc(S.address)}</p></div>
  <div class="phones">${S.phones.map(tel).join('')}</div>
</div></section>`
});

const listItems = (arr) => arr.map((t) => `<li>${esc(t)}</li>`).join('');
const docSections = (secs) => secs.map(([h, ps]) => `<h2>${esc(h)}</h2><ul class="list">${listItems(ps)}</ul>`).join('\n');

pages['about.html'] = layout({
  file: 'about.html',
  scripts: ['/assets/js/feeds.js'],
  title: 'من نحن',
  desc: `${S.fullName} في ذمار: رسالتنا ورؤيتنا وقيمنا وكلمة الإدارة ومجالات الشراكة. ${S.tagline}.`,
  body: `${pageHero({ title: 'من نحن', lead: ABOUT.lead, crumbs: [] })}
<section class="section"><div class="container about-intro">
  <div class="prose">
    <h2>نبذة عنا</h2>
    ${ABOUT.intro.map((p) => `<p>${esc(p)}</p>`).join('')}
    <p class="tagline-quote">${esc(S.tagline)}.</p>
    <div class="btn-row"><a class="btn btn-primary" href="/services.html">تعرّف على خدماتنا</a><a class="btn btn-ghost" href="#contact">تواصل معنا ↓</a></div>
  </div>
  <figure class="frame about-frame">${aiImg('office-service', { sizes: '(max-width: 900px) 100vw, 48vw' })}</figure>
</div></section>

<section class="section alt"><div class="container">
  <div class="mvp">
    <article class="mvp-card"><h2>رسالتنا</h2><p>${esc(ABOUT.mission)}</p></article>
    <article class="mvp-card"><h2>رؤيتنا</h2><p>${esc(ABOUT.vision)}</p></article>
    <article class="mvp-card"><h2>غايتنا</h2><p>${esc(ABOUT.purpose)}</p></article>
  </div>
</div></section>

<section class="section"><div class="container">
  <h2>قيمنا</h2>
  <p class="sub">المبادئ التي تحكم كل تعامل معنا.</p>
  <ul class="values">${ABOUT.values.map(([h, p]) => `<li><h3>${esc(h)}</h3><p>${esc(p)}</p></li>`).join('')}</ul>
</div></section>

<section class="section alt"><div class="container split">
  <div class="box"><h2>أهدافنا</h2><ul class="check-list">${listItems(ABOUT.goals)}</ul></div>
  <div class="box"><h2>سياستنا في العمل</h2><dl class="policy">${ABOUT.policy.map(([h, p]) => `<dt>${esc(h)}</dt><dd>${esc(p)}</dd>`).join('')}</dl></div>
</div></section>

<section class="section" id="management"><div class="container">
  <article class="word">
    <h2>${esc(ABOUT.word.title)}</h2>
    <p class="basmala">${esc(ABOUT.word.opening)}</p>
    ${ABOUT.word.paras.map((p) => `<p>${esc(p)}</p>`).join('')}
    <p class="sign">${esc(ABOUT.word.sign)}<br><span>${esc(S.tagline)}.</span></p>
  </article>
</div></section>

<section class="section" id="office" data-feed-section hidden><div class="container">
  <h2>المكتب وفريق العمل</h2>
  <p class="sub">جولة في مكتبنا وفريقنا.</p>
  <div class="works-grid" data-feed="works" data-category="office" data-limit="12"></div>
</div></section>

<section class="section alt" id="partners"><div class="container">
  <h2>شركاء النجاح والتطوير</h2>
  <p class="sub">${esc(ABOUT.partners.lead)}</p>
  <div class="partners-grid feed-gap" data-feed="partners" data-limit="40"></div>
  <ul class="fields">${listItems(ABOUT.partners.fields)}</ul>
  <div class="after btn-row"><strong class="closing">${esc(ABOUT.partners.closing)}</strong><a class="btn btn-primary" href="#contact">تواصل معنا للشراكة</a></div>
</div></section>

<section class="section about-cta" id="contact"><div class="container">
  <h2>تواصل معنا</h2>
  <p class="sub">عندك سؤال أو طلب أو فكرة شراكة؟ فريقنا جاهز يسمعك.</p>
  ${contactSide().replace('<aside class="side">', '<div class="contact-row">').replace('</aside>', '</div>')}
  <p class="after"><a class="btn btn-primary" href="/contact.html">أرسل رسالة من صفحة التواصل</a></p>
</div></section>`
});

pages['services.html'] = layout({
  file: 'services.html',
  title: 'خدماتنا',
  desc: `أقسام ${S.fullName}.`,
  body: `${pageHero({ title: 'خدماتنا', lead: 'اختر القسم المناسب لتعرف التفاصيل وترسل طلبك.' })}
<section class="section"><div class="container"><h2 class="sr">أقسام المكتب</h2>${serviceCards()}</div></section>`
});

pages['services/employment.html'] = layout({
  file: 'services/employment.html',
  title: SV[0].title,
  desc: SV[0].intro,
  scripts: ['/assets/js/vacancies.js'],
  body: `${pageHero({ title: SV[0].title, lead: SV[0].intro, crumbs: [['خدماتنا', '/services.html']], img: 'employment' })}
<section class="section"><div class="container">
  <div class="split">
    <div class="box"><h2>أبحث عن وظيفة</h2><p>املأ استمارة طلب التوظيف بياناتك ومؤهلاتك وخبراتك، وأرفق سيرتك الذاتية وشهاداتك. سنراجع طلبك عند توفر فرص وظيفية مناسبة.</p><a class="btn btn-primary" href="/register.html">التسجيل كباحث عن عمل</a></div>
    <div class="box"><h2>طلب موظفين</h2><p>أرسل تفاصيل الوظيفة التي تحتاجها جهتك والعدد والمؤهلات وظروف العمل، ونرشّح لك الكفاءات المناسبة.</p><a class="btn btn-primary" href="/employers.html">أرسل طلب موظفين</a></div>
  </div>
</div></section>
<section class="section"><div class="container">
  <h2>ماذا نقدم في قسم التوظيف</h2>
  <ul class="svc-items">${listItems(SERVICE_DETAILS.employment.items)}</ul>
</div></section>
<section class="section alt"><div class="container">
  <h2>الوظائف المنشورة</h2>
  <p class="sub">اضغط على «التقديم» لتسجيل بياناتك مع تحديد الوظيفة.</p>
  ${vacanciesBlock(30)}
  <p class="after"><a class="btn btn-ghost" href="${S.whatsappGroup}" target="_blank" rel="noopener noreferrer">انضم لقناة الوظائف على واتساب</a></p>
</div></section>`
});

for (const s of SV.slice(1)) {
  const D = SERVICE_DETAILS[s.slug];
  const intro = D.intro;
  const opts = D.items.map((it) => `<option value="${esc(s.title + ' – ' + it)}">${esc(it)}</option>`).join('');
  pages[`services/${s.slug}.html`] = layout({
    file: `services/${s.slug}.html`,
    title: s.title,
    desc: intro,
    body: `${pageHero({ title: s.title, lead: intro, crumbs: [['خدماتنا', '/services.html']], img: s.slug })}
<section class="section"><div class="container">
  <h2>خدماتنا في هذا القسم</h2>
  <p class="sub">اختر الخدمة التي تحتاجها وأرسل طلبك، أو تواصل معنا مباشرة لنتفق على التفاصيل.</p>
  <ul class="svc-items">${listItems(D.items)}</ul>
</div></section>
<section class="section alt"><div class="container layout2">
  <div class="panel" id="request">
    <h2>اطلب الخدمة</h2>
    <p>اكتب تفاصيل طلبك، وسيتواصل معك فريق القسم لتوضيح التكلفة والمدة والتفاصيل.</p>
    ${formBlock({
      table: 'inquiries',
      submit: 'إرسال الطلب',
      fields: [
        `<div class="field"><label for="f_service_${s.slug}">الخدمة المطلوبة <span class="req" aria-hidden="true">*</span></label><select id="f_service_${s.slug}" name="service" required><option value="${esc(s.title)}">استفسار عام عن ${esc(s.title)}</option>${opts}</select></div>`,
        field('full_name', 'الاسم', { req: 1, max: 120, ac: 'name' }),
        field('phone', 'رقم التواصل', { type: 'tel', req: 1, max: 30, ac: 'tel' }),
        field('message', 'تفاصيل طلبك', { textarea: 1, req: 1, max: 3000, rows: 5 })
      ]
    })}
  </div>
  ${contactSide()}
</div></section>`
  });
}

pages['register.html'] = layout({
  file: 'register.html',
  title: 'استمارة طلب توظيف',
  desc: 'استمارة طلب توظيف في مكتب أونلاين تك: بياناتك ومؤهلاتك وخبراتك، مع إرفاق السيرة الذاتية والصور والشهادات.',
  scripts: ['/assets/js/stepform.js'],
  body: `${pageHero({ title: 'استمارة طلب توظيف', lead: 'املأ بياناتك على مراحل، وأرفق سيرتك الذاتية وشهاداتك. نراجع الطلبات ونتواصل معك عند توفر فرصة مناسبة.', crumbs: [['التوظيف', '/services/employment.html']] })}
<section class="section"><div class="container layout2">
  <div class="panel">
    ${jobApplicationForm()}
  </div>
  ${contactSide()}
</div></section>`
});

pages['employers.html'] = layout({
  file: 'employers.html',
  title: 'طلب موظفين',
  desc: 'أرسل طلب موظفين لجهتك إلى مكتب أونلاين تك: الوظيفة المطلوبة والعدد والمؤهلات وظروف العمل، ونرشّح لك الكفاءات المناسبة.',
  scripts: ['/assets/js/stepform.js'],
  body: `${pageHero({ title: 'طلب موظفين', lead: 'أرسل تفاصيل الوظيفة التي تحتاجها جهتك على ثلاث خطوات، ونرشّح لك الكفاءات المناسبة من قاعدة الباحثين عن عمل لدينا.', crumbs: [['التوظيف', '/services/employment.html']] })}
<section class="section"><div class="container layout2">
  <div class="panel">
    ${employerRequestForm()}
  </div>
  ${contactSide()}
</div></section>`
});

pages['works.html'] = layout({
  file: 'works.html',
  title: 'أعمالنا',
  desc: `نماذج من أعمال ${S.fullName} في التصميم والدعاية والتسويق والمناسبات وغيرها.`,
  scripts: ['/assets/js/feeds.js'],
  body: `${pageHero({ title: 'أعمالنا', lead: 'نماذج من المشاريع والخدمات التي نفذها المكتب لعملائه.' })}
<section class="section"><div class="container">
  <div class="chip-row" data-filter-for="worksAll" hidden role="group" aria-label="تصفية حسب القسم"></div>
  <div class="works-grid" id="worksAll" data-feed="works">
    <div class="empty-state"><span aria-hidden="true">🛠️</span><h2>نجهّز معرض أعمالنا</h2><p>قريبًا نعرض هنا نماذج من أعمالنا. وإلى ذلك الحين، تواصل معنا ونرسل لك نماذج تناسب طلبك.</p><a class="btn btn-primary" href="/contact.html">تواصل معنا</a></div>
  </div>
</div></section>`
});

pages['reviews.html'] = layout({
  file: 'reviews.html',
  title: 'آراء العملاء',
  desc: `آراء وتقييمات عملاء ${S.fullName}، وأضف تقييمك لتجربتك معنا.`,
  scripts: ['/assets/js/feeds.js'],
  body: `${pageHero({ title: 'آراء العملاء', lead: 'تجارب حقيقية من عملاء تعاملوا معنا. رأيك يهمنا ويساعدنا نتحسن.' })}
<section class="section"><div class="container">
  <div class="review-summary" data-review-summary hidden></div>
  <div class="reviews-grid" data-feed="reviews">
    <div class="empty-state"><span aria-hidden="true">⭐</span><h2>كن أول من يقيّم</h2><p>تعاملت مع المكتب؟ شاركنا تجربتك من النموذج بالأسفل.</p></div>
  </div>
</div></section>
<section class="section alt" id="add-review"><div class="container layout2">
  <div class="panel">
    <h2>أضف رأيك</h2>
    <p>يظهر رأيك في الموقع بعد مراجعته من المكتب. لا ننشر رقم جوالك أو رقم طلبك.</p>
    ${formBlock({
      table: 'reviews',
      plain: true,
      ok: 'شكرًا لك! وصلنا رأيك، وسيظهر في الموقع بعد المراجعة.',
      submit: 'إرسال التقييم',
      fields: [
        `<fieldset class="field rating-field"><legend>تقييمك <span class="req" aria-hidden="true">*</span></legend><div class="rating">${[5, 4, 3, 2, 1].map((n) => `<input type="radio" id="rate${n}" name="rating" value="${n}" required${n === 5 ? ' checked' : ''}><label for="rate${n}" title="${n} من 5"><span class="sr">${n} من 5</span>★</label>`).join('')}</div></fieldset>`,
        field('name', 'الاسم كما تحب أن يظهر', { req: 1, max: 80, ac: 'name' }),
        `<div class="grid2">${field('city', 'المدينة', { max: 60, ac: 'address-level2' })}<div class="field"><label for="f_rsvc">الخدمة التي تعاملت معها</label><select id="f_rsvc" name="service"><option value="">اختر…</option>${SV.map((x) => `<option>${esc(x.title)}</option>`).join('')}</select></div></div>`,
        field('body', 'رأيك وتجربتك', { textarea: 1, req: 1, max: 1000, rows: 4 }),
        `<div class="grid2">${field('ref', 'رقم الطلب (اختياري)', { max: 12 })}${field('phone', 'رقم الجوال (اختياري، للتحقق فقط)', { type: 'tel', max: 30, ac: 'tel' })}</div>`,
        `<label class="check"><input type="checkbox" name="consent" required> <span>أوافق على نشر اسمي ورأيي في موقع المكتب.</span></label>`
      ]
    })}
  </div>
  ${contactSide()}
</div></section>`
});

pages['news.html'] = layout({
  file: 'news.html',
  title: 'الأخبار والإعلانات',
  desc: `آخر أخبار وإعلانات ${S.fullName}.`,
  scripts: ['/assets/js/feeds.js'],
  body: `${pageHero({ title: 'الأخبار والإعلانات', lead: 'آخر أخبار المكتب وعروضه وإعلاناته.' })}
<section class="section"><div class="container">
  <div class="news-list" data-feed="news">
    <div class="empty-state"><span aria-hidden="true">📣</span><h2>لا توجد أخبار حاليًا</h2><p>تابع قناة الوظائف وصفحتنا على فيسبوك ليصلك كل جديد.</p><div class="btn-row"><a class="btn btn-ghost" href="${S.whatsappGroup}" target="_blank" rel="noopener noreferrer">قناة الوظائف</a><a class="btn btn-ghost" href="${S.facebook}" target="_blank" rel="noopener noreferrer">فيسبوك</a></div></div>
  </div>
</div></section>`
});

pages['track.html'] = layout({
  file: 'track.html',
  title: 'تابع طلبك',
  desc: `تابع حالة طلبك لدى ${S.fullName} برقم الطلب ورقم الجوال.`,
  scripts: ['/assets/js/track.js'],
  body: `${pageHero({ title: 'تابع طلبك', lead: 'اكتب رقم الطلب الذي ظهر لك بعد الإرسال، ورقم الجوال الذي أرسلت به الطلب.' })}
<section class="section"><div class="container layout2">
  <div class="grid-stack">
    <div class="panel">
      <form class="form track-form" id="trackForm" novalidate aria-label="متابعة الطلب">
        <div class="grid2">
          <div class="field"><label for="t_ref">رقم الطلب <span class="req" aria-hidden="true">*</span></label><input type="text" id="t_ref" name="ref" dir="ltr" required maxlength="12" placeholder="OT-000000" autocomplete="off" autocapitalize="characters" spellcheck="false"></div>
          <div class="field"><label for="t_phone">رقم الجوال <span class="req" aria-hidden="true">*</span></label><input type="tel" id="t_phone" name="phone" dir="ltr" inputmode="tel" required minlength="6" maxlength="30" pattern="[0-9+\\s\\-٠-٩]{6,30}" title="أرقام فقط" autocomplete="tel"></div>
        </div>
        <button class="btn btn-primary" type="submit">تابع الطلب</button>
        <noscript><p class="form-msg err">تحتاج صفحة المتابعة إلى تفعيل JavaScript، أو تواصل معنا مباشرة.</p></noscript>
      </form>
    </div>
    <div id="trackResult" tabindex="-1" aria-live="polite" hidden></div>
    <div class="panel">
      <h2>مراحل الطلب</h2>
      <ul class="check-list"><li><strong>قيد الطلب:</strong> استلمنا طلبك وهو في انتظار المراجعة.</li><li><strong>تحت المعالجة:</strong> فريق المكتب يعمل على طلبك.</li><li><strong>في الطريق:</strong> للطلبات التي تُسلَّم، مثل المطبوعات واللوحات.</li><li><strong>تم بنجاح</strong> أو <strong>مرفوض:</strong> النتيجة النهائية لطلبك.</li></ul>
      <p class="hint">نسيت رقم الطلب؟ تواصل معنا عبر واتساب واذكر اسمك ونوع طلبك.</p>
    </div>
  </div>
  ${contactSide()}
</div></section>`
});


const MARKET_CATS = [["cars", "🚗", "سيارات ومركبات"], ["realestate", "🏠", "عقارات وأراضي"], ["furniture", "🛋️", "أثاث ومفروشات"], ["electronics", "📱", "إلكترونيات وجوالات"], ["appliances", "🧊", "أجهزة كهربائية ومنزلية"], ["fashion", "👕", "ملابس وأزياء"], ["equipment", "🛠️", "معدات وأدوات"], ["animals", "🐑", "حيوانات ومواشي"], ["other", "📦", "أخرى"]];
const opts = MARKET_CATS.map(([k, e, t]) => `<option value="${k}">${e} ${t}</option>`).join('');
const MARKET_SCRIPTS = ['/assets/js/market-common.js'];
pages['market.html'] = layout({
  file: 'market.html',
  title: 'سوق الإعلانات',
  desc: `سوق ${S.fullName}: بيع وشراء وإيجار سيارات وعقارات وأثاث وإلكترونيات وكل ما تحتاجه في ذمار واليمن.`,
  scripts: [...MARKET_SCRIPTS, '/assets/js/market.js'],
  body: `${pageHero({ title: 'سوق الإعلانات', lead: 'بيع واشترِ وأجّر كل ما تحتاجه: سيارات، عقارات، أثاث، إلكترونيات وغيرها. كل إعلان يراجعه المكتب قبل نشره.' })}
<section class="section"><div class="container">
  <div class="btn-row market-top"><a class="btn btn-primary" href="/sell.html">+ أضف إعلانك مجانًا</a><a class="btn btn-ghost" href="/track.html">تابع إعلانك</a></div>
  <div class="chip-row" id="marketCats" role="group" aria-label="الأقسام"></div>
  <div class="market-filters">
    <div class="field"><label for="m_q">ابحث</label><input type="search" id="m_q" data-mf="q" placeholder="مثال: غسالة، هايلكس…"></div>
    <div class="field"><label for="m_kind">النوع</label><select id="m_kind" data-mf="kind"><option value="">الكل</option><option value="sale">للبيع</option><option value="rent">للإيجار</option><option value="wanted">مطلوب</option></select></div>
    <div class="field"><label for="m_city">المدينة</label><input type="text" id="m_city" data-mf="city" placeholder="ذمار"></div>
    <div class="field"><label for="m_max">أعلى سعر</label><input type="number" id="m_max" data-mf="max" min="0" inputmode="numeric" dir="ltr"></div>
  </div>
  <div class="ads-grid" id="marketGrid" aria-live="polite"></div>
</div></section>`
});

pages['listing.html'] = layout({
  file: 'listing.html',
  title: 'تفاصيل الإعلان',
  desc: `تفاصيل إعلان في سوق ${S.fullName}.`,
  scripts: [...MARKET_SCRIPTS, '/assets/js/listing.js'],
  body: `${pageHero({ title: 'تفاصيل الإعلان', crumbs: [['سوق الإعلانات', '/market.html']] })}
<section class="section"><div class="container"><div id="listingBox"><p>جارٍ التحميل…</p></div></div></section>`
});

pages['sell.html'] = layout({
  file: 'sell.html',
  title: 'أضف إعلانك',
  desc: `أضف إعلانك مجانًا في سوق ${S.fullName}. يراجعه المكتب وينشره.`,
  scripts: [...MARKET_SCRIPTS, '/assets/js/sell.js'],
  body: `${pageHero({ title: 'أضف إعلانك', lead: 'أضف بيانات الغرض وصوره. يراجعه المكتب وينشره بعد الموافقة. بدون حساب، وتتابع إعلانك برقم الطلب.' })}
<section class="section"><div class="container layout2">
  <div class="panel">
    <div class="form-msg" id="sellDone" hidden></div>
    <form class="form" id="sellForm" novalidate aria-label="إضافة إعلان">
      <div class="grid2">
        <div class="field"><label for="s_kind">نوع الإعلان <span class="req">*</span></label><select id="s_kind" name="kind" required><option value="sale">للبيع</option><option value="rent">للإيجار</option><option value="wanted">مطلوب (أبحث عن)</option></select></div>
        <div class="field"><label for="s_cat">القسم <span class="req">*</span></label><select id="s_cat" name="category" required><option value="">اختر…</option>${opts}</select></div>
      </div>
      ${field('title', 'عنوان الإعلان', { req: 1, max: 120 }).replaceAll('f_title', 's_title')}
      ${field('description', 'الوصف (الحالة، المواصفات، أي تفاصيل)', { textarea: 1, req: 1, max: 3000, rows: 5 }).replaceAll('f_description', 's_desc')}
      <div class="grid2">
        <div class="field"><label for="s_price">السعر (اتركه فارغًا إن أردت التواصل)</label><input type="text" id="s_price" name="price" inputmode="numeric" dir="ltr" maxlength="14"></div>
        <div class="field"><label for="s_cur">العملة</label><select id="s_cur" name="currency"><option value="YER">ريال يمني</option><option value="SAR">ريال سعودي</option><option value="USD">دولار</option></select></div>
      </div>
      <div class="grid2">
        <div class="field"><label for="s_cond">الحالة</label><select id="s_cond" name="condition"><option value="">غير محدد</option><option value="new">جديد</option><option value="used">مستعمل</option></select></div>
        <label class="check"><input type="checkbox" name="negotiable"> <span>السعر قابل للتفاوض</span></label>
      </div>
      <div class="field"><label>الصور <span class="req">*</span> <small id="photoCount">0 / 8</small></label>
        <input type="file" id="photoInput" accept="image/*" multiple>
        <p class="hint">الصور الواضحة والمضيئة تبيع أسرع. نفحص الصور تلقائيًا وننبهك إن كانت غير واضحة، والمكتب يراجعها أيضًا. أول صورة هي الرئيسية.</p>
        <ul class="photo-list" id="photoList"></ul>
      </div>
      <div class="grid2">
        <div class="field"><label for="s_name">اسمك <span class="req">*</span></label><input type="text" id="s_name" name="seller_name" required minlength="2" maxlength="80" autocomplete="name"></div>
        <div class="field"><label for="s_city">المدينة <span class="req">*</span></label><input type="text" id="s_city" name="city" required minlength="2" maxlength="80" value="ذمار"></div>
      </div>
      <div class="field"><label for="s_phone">رقم جوالك <span class="req">*</span></label><input type="tel" id="s_phone" name="phone" dir="ltr" inputmode="tel" required minlength="6" maxlength="30" autocomplete="tel"></div>
      <label class="check"><input type="checkbox" name="show_phone" checked> <span>أظهر رقمي في الإعلان ليتصل بي المشترون مباشرة (يمكنك إلغاء التحديد ويتواصل المشترون عبر واتساب المكتب).</span></label>
      <label class="check"><input type="checkbox" name="consent" required> <span>أؤكد أن بياناتي صحيحة وأن الغرض مملوك لي، وأوافق على نشر الإعلان بعد المراجعة.</span></label>
      <div class="hp" aria-hidden="true"><label>لا تملأ هذا الحقل<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
      <div class="form-msg" role="status" aria-live="polite" hidden></div>
      <button class="btn btn-primary" type="submit">إرسال الإعلان للمراجعة</button>
    </form>
  </div>
  ${contactSide()}
</div></section>`
});

pages['faq.html'] = layout({
  file: 'faq.html',
  title: 'الأسئلة الشائعة',
  desc: `إجابات عن أكثر الأسئلة شيوعًا حول خدمات ${S.fullName}: التوظيف وطلب الموظفين والخدمات والخصوصية والتواصل.`,
  extraLd: { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  body: `${pageHero({ title: 'الأسئلة الشائعة', lead: 'إجابات سريعة عن أكثر ما يسألنا عنه عملاؤنا.' })}
<section class="section"><div class="container layout2">
  <div class="faq">${FAQ.map(([q, a], i) => `<details${i ? '' : ' open'}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
  ${contactSide()}
</div></section>`
});

pages['privacy.html'] = layout({
  file: 'privacy.html',
  title: 'سياسة الخصوصية',
  desc: `كيف يجمع ${S.fullName} بياناتك ويستخدمها ويحميها، وما حقوقك عليها.`,
  body: `${pageHero({ title: 'سياسة الخصوصية', lead: 'نحترم خصوصيتك، ونتعامل مع بياناتك وملفاتك كأمانة.' })}
<section class="section"><div class="container layout2">
  <div class="panel prose doc">${docSections(PRIVACY)}</div>
  ${contactSide()}
</div></section>`
});

pages['terms.html'] = layout({
  file: 'terms.html',
  title: 'شروط الاستخدام',
  desc: `شروط استخدام موقع ${S.fullName} وخدماته.`,
  body: `${pageHero({ title: 'شروط الاستخدام', lead: 'يرجى قراءة هذه الشروط قبل استخدام الموقع أو إرسال أي طلب.' })}
<section class="section"><div class="container layout2">
  <div class="panel prose doc">${docSections(TERMS)}</div>
  ${contactSide()}
</div></section>`
});

pages['contact.html'] = layout({
  file: 'contact.html',
  title: 'تواصل معنا',
  desc: `أرقام التواصل وعنوان ${S.fullName}، ونموذج إرسال الاستفسارات.`,
  body: `${pageHero({ title: 'تواصل معنا', lead: 'للتواصل المباشر مع فريق المكتب، اتصل بنا أو أرسل استفسارك من النموذج.' })}
<section class="section"><div class="container layout2">
  <div class="panel">
    <h2>أرسل استفسارك</h2>
    <p>عندك اقتراح يطوّر خدماتنا أو ملاحظة على تجربتك؟ اختر «اقتراح» أو «ملاحظة» من القائمة، فرأيك يهمنا.</p>
    ${formBlock({
      table: 'inquiries',
      submit: 'إرسال الاستفسار',
      fields: [
        `<div class="field"><label for="f_service">القسم <span class="req" aria-hidden="true">*</span></label><select id="f_service" name="service" required>
      <option value="استفسار عام">استفسار عام</option>
      ${SV.map((s) => `<option value="${esc(s.title)}">${esc(s.title)}</option>`).join('')}
      <option value="اقتراحات العملاء">اقتراح لتطوير خدماتنا</option>
      <option value="ملاحظة أو شكوى">ملاحظة أو شكوى</option>
    </select></div>`,
        field('full_name', 'الاسم', { req: 1, max: 120, ac: 'name' }),
        field('phone', 'رقم التواصل', { type: 'tel', req: 1, max: 30, ac: 'tel' }),
        field('message', 'استفسارك', { textarea: 1, req: 1, max: 3000, rows: 5 })
      ]
    })}
  </div>
  ${contactSide()}
</div></section>`
});

pages['404.html'] = layout({
  file: '404.html',
  title: 'الصفحة غير موجودة',
  desc: 'الصفحة المطلوبة غير موجودة.',
  noindex: true,
  body: `${pageHero({ title: 'الصفحة غير موجودة', lead: 'قد يكون الرابط قديمًا أو غير صحيح.' })}
<section class="section"><div class="container"><a class="btn btn-primary" href="/index.html">العودة إلى الرئيسية</a></div></section>`
});

pages['admin/index.html'] = layout({
  file: 'admin/index.html',
  title: 'لوحة الإدارة',
  desc: 'لوحة إدارة مكتب أونلاين تك.',
  noindex: true,
  minimal: true,
  scripts: ['/assets/js/admin-cms.js', '/assets/js/admin-market.js', '/assets/js/admin.js'],
  body: `<div class="admin-wrap">
  <section id="login" class="panel login-card" hidden>
    <h1 class="sr">تسجيل الدخول</h1>
    <h2>تسجيل دخول الإدارة</h2>
    <form class="form" id="loginForm">
      <div class="field"><label for="email">البريد الإلكتروني</label><input id="email" type="email" required autocomplete="username" dir="ltr"></div>
      <div class="field"><label for="password">كلمة المرور</label><input id="password" type="password" required autocomplete="current-password" dir="ltr"></div>
      <div class="form-msg err" id="loginMsg" role="alert" hidden></div>
      <button class="btn btn-primary" type="submit">دخول</button>
    </form>
  </section>
  <section id="dash" hidden>
    <div class="admin-top"><h1>لوحة الإدارة</h1><div class="admin-who"><span id="who"></span> <button class="btn btn-ghost btn-sm" type="button" id="gear" aria-label="الإعدادات"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg> <span>الإعدادات</span></button> <button class="btn btn-ghost btn-sm" type="button" id="logout">تسجيل الخروج</button></div></div>
    <div class="tabs" id="tabs" role="group" aria-label="الأقسام"></div>
    <div class="form-msg ok" id="note" role="status" aria-live="polite" hidden></div>
    <div id="view"></div>
  </section>
</div>`
});

/* ---------- write ---------- */
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.cpSync(path.join(here, 'assets'), path.join(dist, 'assets'), { recursive: true });

for (const [file, html] of Object.entries(pages)) {
  const out = path.join(dist, file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
}

const cfg = {
  SUPABASE_URL: S.supabase.url,
  SUPABASE_KEY: S.supabase.key,
  WHATSAPP: S.whatsapp,
  GROUP: S.whatsappGroup,
  FACEBOOK: S.facebook,
  PHONES: S.phones.map((p) => p.display),
  ADDRESS: S.address,
  SERVICES: SV.map((s) => ({ n: s.n, slug: s.slug, title: s.title, emoji: s.emoji })),
  CATEGORIES: Object.assign(Object.fromEntries(SV.map((s) => [s.slug, s.title])), { office: 'المكتب وفريق العمل' })
};
fs.writeFileSync(path.join(dist, 'assets/js/config.js'), `window.OT=${JSON.stringify(cfg)};\n`);
fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\nDisallow: /admin/\n\nSitemap: ${S.siteUrl}/sitemap.xml\n`);
const today = new Date().toISOString().slice(0, 10);
const urls = Object.keys(pages).filter((f) => f !== '404.html' && !f.startsWith('admin/'));
fs.writeFileSync(path.join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((f) => `  <url><loc>${S.siteUrl}${f === 'index.html' ? '/' : '/' + f}</loc><lastmod>${today}</lastmod></url>`).join('\n') + `\n</urlset>\n`);

// Strict CSP is applied to the admin area only: PageSpeed Insights injects its own inline style/script into public pages and logs CSP violations that cost 8 Best-Practices points.
// Netlify reads _headers from the published folder, so security headers also apply to drag-and-drop deploys.
const csp = `default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: ${S.supabase.url}; connect-src 'self' ${S.supabase.url}; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`;
fs.writeFileSync(path.join(dist, '_headers'), `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
/assets/*
  Cache-Control: public, max-age=31536000, immutable
/admin/*
  X-Robots-Tag: noindex, nofollow
  Cache-Control: no-store
  Content-Security-Policy: ${csp}
`);

console.log('built', Object.keys(pages).length, 'pages →', dist);
