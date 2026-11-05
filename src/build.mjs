// Static site generator for مكتب أونلاين تك. Run: node src/build.mjs  → writes ./dist
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

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
const CSS_HASH = crypto.createHash('sha256').update(CSS).digest('base64');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const svcUrl = (s) => `/services/${s.slug}.html`;
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
const logoImg = (cls = 'logo') =>
  `<img class="${cls}"${cls === 'hero-logo' ? ' fetchpriority="high"' : ''} src="${asset('/assets/img/logo.svg')}" alt="${esc(S.fullName)}" width="2190" height="823">`;

/* ---------- shared layout ---------- */
const NAV = [
  ['الرئيسية', '/index.html'],
  ['من نحن', '/about.html'],
  ['خدماتنا', '/services.html'],
  ['التوظيف', '/services/employment.html'],
  ['تواصل معنا', '/contact.html']
];

function layout({ file, title, desc, body, scripts = [], noindex = false, chat = true, minimal = false }) {
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
  let ld2 = '';
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
    ? `<header class="site-header"><div class="container bar"><a class="brand" href="/index.html">${logoImg()}</a><span class="brand-note">لوحة الإدارة</span></div></header>`
    : `<header class="site-header"><div class="container bar">
  <a class="brand" href="/index.html" aria-label="${esc(S.name)} — الرئيسية">${logoImg()}</a>
  <button class="menu-btn" type="button" id="menuBtn" aria-expanded="false" aria-controls="nav"><span class="sr">القائمة</span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
  <nav class="nav" id="nav" aria-label="القائمة الرئيسية">${nav}<button class="btn btn-primary btn-sm" type="button" data-open-chat>تحدث معنا</button></nav>
</div></header>`;
  const footer = minimal ? '' : `<footer class="site-footer">
  <div class="container foot-grid">
    <div><span class="foot-plate">${logoImg('foot-logo')}</span><p>${esc(S.tagline)}.</p></div>
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
  <div class="container foot-bottom">© ${S.year} ${esc(S.fullName)}. جميع الحقوق محفوظة.</div>
</footer>`;
  const scriptTags = ['/assets/js/config.js', '/assets/js/api.js']
    .concat(minimal ? [] : ['/assets/js/nav.js'])
    .concat(body.includes('data-table=') ? ['/assets/js/forms.js'] : [])
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
<style>${CSS}</style>
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

function formBlock({ table, fields, submit, hidden = '' }) {
  return `<form class="form" data-table="${table}" aria-label="${esc(submit)}">
  ${hidden}
  ${fields.join('\n  ')}
  <div class="hp" aria-hidden="true"><label>لا تملأ هذا الحقل<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
  <div class="form-msg" role="status" aria-live="polite" hidden></div>
  <button class="btn btn-primary" type="submit">${esc(submit)}</button>
</form>`;
}

function pageHero({ title, lead, crumbs = [] }) {
  const trail = [['الرئيسية', '/index.html'], ...crumbs].map(([t, u]) => `<a href="${u}">${esc(t)}</a>`).join(' / ');
  return `<section class="page-hero"><div class="container">
  <div class="crumbs">${trail}</div>
  <h1>${esc(title)}</h1>
  ${lead ? `<p>${esc(lead)}</p>` : ''}
</div></section>`;
}

function serviceCards() {
  return `<div class="cards">${SV.map((s, i) => `<a class="card${i === 0 ? ' feat' : ''}" href="${svcUrl(s)}">
  <span class="ico-wrap">${icon(s.slug, 28)}</span>
  <h3>${esc(s.title)}</h3>
  <p>${esc(s.short)}</p>
  <span class="more">التفاصيل ←</span>
</a>`).join('\n')}</div>`;
}

const contactSide = () => `<aside class="side">
  <div class="panel">
    <h3>للتواصل المباشر</h3>
    ${S.phones.map((p, i) => `<div class="kv"><span class="k">رقم التواصل ${ORD[i]}</span><span class="num">${tel(p)}</span></div>`).join('')}
    <a class="btn btn-ghost btn-sm" href="https://wa.me/${S.whatsapp}" target="_blank" rel="noopener noreferrer">راسلنا عبر واتساب</a>
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

const vacanciesBlock = (limit) => `<div id="vacancies" data-limit="${limit}"><p class="vac-empty">جارٍ تحميل الوظائف…</p></div>`;

/* ---------- pages ---------- */
const pages = {};

pages['index.html'] = layout({
  file: 'index.html',
  title: S.name,
  desc: `${S.fullName}: التوظيف، الخدمات الطلابية، الدعاية والتصميم، التسويق الإلكتروني، تعهد الحفلات، السفريات والسياحة، والخدمات العقارية.`,
  scripts: ['/assets/js/vacancies.js'],
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

<section class="section"><div class="container">
  <h2>التوظيف</h2>
  <p class="sub">للباحثين عن عمل وللجهات الراغبة في توظيف كفاءات.</p>
  <div class="split">
    <div class="box"><h3>أبحث عن وظيفة</h3><p>سجّل بياناتك ليراجعها المكتب عند توفر فرص وظيفية مناسبة.</p><a class="btn btn-primary" href="/register.html">سجّل بياناتك</a></div>
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

pages['about.html'] = layout({
  file: 'about.html',
  title: 'من نحن',
  desc: `${S.fullName}. ${S.tagline}.`,
  body: `${pageHero({ title: 'من نحن', lead: S.tagline + '.', crumbs: [] })}
<section class="section"><div class="container layout2">
  <div class="panel prose">
    <h2>${esc(S.fullName)}</h2>
    <p>يضم المكتب سبعة أقسام تجمع التوظيف والخدمات الطلابية والدعاية والإعلان والتصميم والتسويق الإلكتروني وتعهد الحفلات والمناسبات والسفريات والسياحة والخدمات العقارية.</p>
    <p>رسالتنا ${esc(S.tagline)}: نستقبل طلبك، ونراجعه، ونتواصل معك لنتفق على التفاصيل.</p>
    <h3>أقسام المكتب</h3>
    <ul class="list">${SV.map((s) => `<li><a href="${svcUrl(s)}">${esc(s.title)}</a></li>`).join('')}</ul>
  </div>
  ${contactSide()}
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
  body: `${pageHero({ title: SV[0].title, lead: SV[0].intro, crumbs: [['خدماتنا', '/services.html']] })}
<section class="section"><div class="container">
  <div class="split">
    <div class="box"><h2>أبحث عن وظيفة</h2><p>أرسل الاسم الكامل والمؤهل والخبرات والوظيفة المطلوبة ومكان الإقامة ورقم التواصل. سنراجع بياناتك للاستفادة منها عند توفر فرص وظيفية مناسبة.</p><a class="btn btn-primary" href="/register.html">التسجيل كباحث عن عمل</a></div>
    <div class="box"><h2>طلب موظفين</h2><p>أرسل اسم الجهة والوظائف المطلوبة وعدد كل وظيفة والمؤهلات ومكان العمل ورقم التواصل.</p><a class="btn btn-primary" href="/employers.html">أرسل طلب موظفين</a></div>
  </div>
</div></section>
<section class="section alt"><div class="container">
  <h2>الوظائف المنشورة</h2>
  <p class="sub">اضغط على «التقديم» لتسجيل بياناتك مع تحديد الوظيفة.</p>
  ${vacanciesBlock(30)}
  <p class="after"><a class="btn btn-ghost" href="${S.whatsappGroup}" target="_blank" rel="noopener noreferrer">انضم لقناة الوظائف على واتساب</a></p>
</div></section>`
});

for (const s of SV.slice(1)) {
  const intro = `قسم ${s.title} في ${S.fullName}. اكتب لنا طلبك أو استفسارك وسنتواصل معك لتوضيح الخدمات المتاحة والتفاصيل.`;
  pages[`services/${s.slug}.html`] = layout({
    file: `services/${s.slug}.html`,
    title: s.title,
    desc: intro,
    body: `${pageHero({ title: s.title, lead: s.short, crumbs: [['خدماتنا', '/services.html']] })}
<section class="section"><div class="container layout2">
  <div class="grid-stack">
    <div class="panel">
      <h2>أرسل طلبك أو استفسارك</h2>
      <p>${esc(intro)}</p>
      ${formBlock({
        table: 'inquiries',
        submit: 'إرسال الطلب',
        hidden: `<input type="hidden" name="service" value="${esc(s.title)}">`,
        fields: [
          field('full_name', 'الاسم', { req: 1, max: 120, ac: 'name' }),
          field('phone', 'رقم التواصل', { type: 'tel', req: 1, max: 30, ac: 'tel' }),
          field('message', 'طلبك أو استفسارك', { textarea: 1, req: 1, max: 3000, rows: 5 })
        ]
      })}
    </div>
  </div>
  ${contactSide()}
</div></section>`
  });
}

pages['register.html'] = layout({
  file: 'register.html',
  title: 'التسجيل كباحث عن عمل',
  desc: 'سجّل بياناتك كباحث عن عمل في مكتب أونلاين تك لنراجعها عند توفر فرص وظيفية مناسبة.',
  body: `${pageHero({ title: 'التسجيل كباحث عن عمل', lead: 'إذا كنت تبحث عن فرصة عمل، يرجى إرسال بياناتك التالية.', crumbs: [['التوظيف', '/services/employment.html']] })}
<section class="section"><div class="container layout2">
  <div class="panel">
    <h2>بياناتك</h2>
    <p>سنراجع بياناتك للاستفادة منها عند توفر فرص وظيفية مناسبة.</p>
    ${formBlock({
      table: 'job_seekers',
      submit: 'إرسال البيانات',
      fields: [
        field('full_name', 'الاسم الكامل', { req: 1, max: 120, ac: 'name' }),
        field('qualification', 'المؤهل العلمي والتخصص', { req: 1, max: 200 }),
        field('experience', 'الخبرات السابقة', { textarea: 1, max: 2000 }),
        field('desired_job', 'الوظيفة المطلوبة', { req: 1, max: 150 }),
        field('residence', 'مكان الإقامة', { req: 1, max: 120, ac: 'address-level2' }),
        field('phone', 'رقم التواصل', { type: 'tel', req: 1, max: 30, ac: 'tel' })
      ]
    })}
  </div>
  ${contactSide()}
</div></section>`
});

pages['employers.html'] = layout({
  file: 'employers.html',
  title: 'طلب موظفين',
  desc: 'أرسل طلب موظفين لجهتك إلى مكتب أونلاين تك.',
  body: `${pageHero({ title: 'طلب موظفين', lead: 'إذا كنت تبحث عن موظفين لجهتك، يرجى إرسال البيانات التالية.', crumbs: [['التوظيف', '/services/employment.html']] })}
<section class="section"><div class="container layout2">
  <div class="panel">
    <h2>بيانات الطلب</h2>
    <p>سنراجع طلبك وننسّق معك بخصوص الكفاءات المتاحة.</p>
    ${formBlock({
      table: 'employer_requests',
      submit: 'إرسال الطلب',
      fields: [
        field('org_name', 'اسم الجهة', { req: 1, max: 150, ac: 'organization' }),
        field('positions', 'الوظائف المطلوبة وعدد كل وظيفة', { textarea: 1, req: 1, max: 1000, rows: 3 }),
        field('requirements', 'المؤهلات والخبرات المطلوبة', { textarea: 1, max: 2000 }),
        field('work_location', 'مكان العمل', { max: 150 }),
        field('phone', 'رقم التواصل', { type: 'tel', req: 1, max: 30, ac: 'tel' })
      ]
    })}
  </div>
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
    ${formBlock({
      table: 'inquiries',
      submit: 'إرسال الاستفسار',
      fields: [
        `<div class="field"><label for="f_service">القسم <span class="req" aria-hidden="true">*</span></label><select id="f_service" name="service" required>
      <option value="استفسار عام">استفسار عام</option>
      ${SV.map((s) => `<option value="${esc(s.title)}">${esc(s.title)}</option>`).join('')}
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
  scripts: ['/assets/js/admin.js'],
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
    <div class="admin-top"><h1>لوحة الإدارة</h1><div><span id="who"></span> <button class="btn btn-ghost btn-sm" type="button" id="logout">تسجيل الخروج</button></div></div>
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
fs.rmSync(path.join(dist, 'assets/css'), { recursive: true, force: true }); // CSS is inlined in each page

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
  SERVICES: SV.map((s) => ({ n: s.n, slug: s.slug, title: s.title, emoji: s.emoji }))
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
const csp = `default-src 'self'; script-src 'self'; style-src 'self' 'sha256-${CSS_HASH}'; font-src 'self'; img-src 'self' data:; connect-src 'self' ${S.supabase.url}; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`;
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
