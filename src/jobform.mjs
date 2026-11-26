// Multi-step job application (استمارة طلب توظيف) — markup only; behaviour lives in assets/js/seeker.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const TITLES = JSON.parse(fs.readFileSync(path.join(here, 'job-titles.json'), 'utf8'));

export const MAX_MB = 15;

// Inputs saved into their own table columns (everything else goes into details[])
const CORE = new Set(['full_name', 'residence', 'phone', 'desired_job', 'org_name', 'work_location']);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const YESNO = ['نعم', 'لا'];
const LEVEL = ['ممتاز', 'جيد جدًا', 'جيد', 'متوسط', 'ضعيف'];

/*
  f(name, label, opts)
  name: a job_seekers column (full_name, residence, phone, desired_job) or a detail key (saved into details[])
  opts: type (text|tel|email|date|select|textarea|number), req, max, options, wide, ac, list, hint, ph
*/
function f(name, label, o = {}) {
  const id = (o.prefix || 'j_') + name;
  const star = o.req ? ' <span class="req" aria-hidden="true">*</span>' : '';
  const core = CORE.has(name);
  const attrs = `id="${id}" name="${name}" data-l="${esc(label)}"${core ? ' data-core' : ''}${o.req ? ' required' : ''}${o.max ? ` maxlength="${o.max}"` : ''}${o.ac ? ` autocomplete="${o.ac}"` : ''}${o.hint ? ` aria-describedby="${id}_h"` : ''}`;
  let ctl;
  const t = o.type || 'text';
  if (t === 'select') {
    ctl = `<select ${attrs}><option value="">اختر…</option>${o.options.map((v) => `<option>${esc(v)}</option>`).join('')}</select>`;
  } else if (t === 'textarea') {
    ctl = `<textarea ${attrs} rows="${o.rows || 3}"></textarea>`;
  } else if (t === 'tel') {
    ctl = `<input type="tel" inputmode="tel" dir="ltr" minlength="6" pattern="[0-9+\\s\\-]{6,30}" title="أرقام فقط، من 6 إلى 30 خانة" ${attrs}>`;
  } else if (t === 'email') {
    ctl = `<input type="email" dir="ltr" ${attrs}>`;
  } else if (t === 'date') {
    ctl = `<input type="date" ${attrs}>`;
  } else if (t === 'number') {
    ctl = `<input type="text" inputmode="numeric" pattern="[0-9٠-٩]+" title="أرقام فقط" ${attrs}>`;
  } else {
    ctl = `<input type="text"${o.req ? ' minlength="2"' : ''}${o.list ? ` list="${o.list}"` : ''}${o.ph ? ` placeholder="${esc(o.ph)}"` : ''} ${attrs}>`;
  }
  const hint = o.hint ? `<small class="hint" id="${id}_h">${esc(o.hint)}</small>` : '';
  return `<div class="field${o.wide ? ' wide' : ''}"><label for="${id}">${label}${star}</label>${ctl}${hint}</div>`;
}

function file(kind, label, accept, o = {}) {
  const id = 'j_file_' + kind;
  return `<div class="field wide file-field"><label for="${id}">${label}</label>
  <input type="file" id="${id}" data-kind="${kind}" data-l="${esc(label)}" accept="${accept}"${o.multiple ? ' multiple' : ''} aria-describedby="${id}_h">
  <small class="hint" id="${id}_h">${esc(o.hint || '')}</small><ul class="file-list" data-for="${id}"></ul></div>`;
}

const STEPS = [
  ['البيانات الشخصية', [
    f('full_name', 'الاسم الرباعي', { req: 1, max: 120, ac: 'name', wide: 1 }),
    f('birth_date', 'تاريخ الميلاد', { type: 'date' }),
    f('gender', 'الجنس', { type: 'select', req: 1, options: ['ذكر', 'أنثى'] }),
    f('marital', 'الحالة الاجتماعية', { type: 'select', options: ['أعزب / عزباء', 'متزوج / متزوجة', 'مطلق / مطلقة', 'أرمل / أرملة'] }),
    f('residence', 'مكان الإقامة', { req: 1, max: 120, ac: 'address-level2', ph: 'المحافظة – المديرية – المنطقة' }),
    f('phone', 'رقم الهاتف', { type: 'tel', req: 1, max: 30, ac: 'tel' }),
    f('whatsapp', 'رقم واتساب', { type: 'tel', max: 30, hint: 'اتركه فارغًا إذا كان نفس رقم الهاتف.' }),
    f('email', 'البريد الإلكتروني', { type: 'email', max: 120, ac: 'email', wide: 1 })
  ]],
  ['المؤهلات العلمية', [
    f('highest', 'أعلى مؤهل علمي', { type: 'select', req: 1, options: ['أساسي', 'ثانوي', 'دبلوم', 'بكالوريوس', 'ماجستير', 'دكتوراه', 'أخرى'] }),
    f('specialization', 'التخصص', { req: 1, max: 120 }),
    f('university', 'اسم الجامعة أو المعهد', { max: 150 }),
    f('grad_year', 'سنة التخرج', { type: 'number', max: 4 }),
    f('grade', 'التقدير العام', { type: 'select', options: ['ممتاز', 'جيد جدًا', 'جيد', 'مقبول'] }),
    f('courses', 'المؤهلات والدورات التدريبية الإضافية', { type: 'textarea', max: 1500, wide: 1 })
  ]],
  ['الخبرات العملية', [
    f('has_exp', 'هل لديك خبرة عملية سابقة؟', { type: 'select', req: 1, options: YESNO }),
    f('exp_years', 'عدد سنوات الخبرة', { type: 'number', max: 3 }),
    f('prev_employer', 'اسم جهة العمل السابقة', { max: 150 }),
    f('prev_title', 'المسمى الوظيفي السابق', { max: 150 }),
    f('prev_tasks', 'طبيعة المهام التي كنت تقوم بها', { type: 'textarea', max: 1500, wide: 1 }),
    f('same_field', 'هل سبق لك العمل في المجال المتقدم إليه؟', { type: 'select', options: YESNO, wide: 1 })
  ]],
  ['الوظيفة المطلوبة', [
    f('desired_job', 'المسمى الوظيفي الذي ترغب في التقدم إليه', { req: 1, max: 150, list: 'job-titles', wide: 1, hint: 'اكتب أو اختر من القائمة.' }),
    f('job_field', 'المجال الذي ترغب في العمل فيه', { type: 'select', options: Object.keys(TITLES).concat(['أخرى']) }),
    f('work_type', 'نوع العمل', { type: 'select', options: ['دوام كامل', 'دوام جزئي', 'عمل عن بُعد'] }),
    f('salary', 'الراتب المتوقع', { max: 60 }),
    f('start_when', 'موعد إمكانية المباشرة', { max: 60, ph: 'مثال: فورًا، بعد شهر' })
  ]],
  ['المهارات والقدرات', [
    f('sk_computer', 'مهارات استخدام الحاسوب', { type: 'select', options: LEVEL }),
    f('sk_office', 'إجادة برامج Microsoft Office', { type: 'select', options: LEVEL }),
    f('sk_comm', 'مهارات التواصل والإقناع', { type: 'select', options: LEVEL }),
    f('sk_team', 'مهارات العمل الجماعي', { type: 'select', options: LEVEL }),
    f('sk_sales', 'مهارات التسويق والمبيعات', { type: 'select', options: LEVEL }),
    f('languages', 'اللغات التي تجيدها', { max: 150 }),
    f('sk_other', 'مهارات أخرى', { type: 'textarea', max: 1000, wide: 1 })
  ]],
  ['المرفقات', [
    `<p class="wide step-note">الملفات اختيارية لكنها تسرّع مراجعة طلبك. الحد الأقصى ${MAX_MB} ميجابايت لكل ملف.</p>`,
    file('cv', 'السيرة الذاتية (CV)', '.pdf,.doc,.docx', { hint: 'PDF أو Word.' }),
    file('photo', 'صورة شخصية حديثة', 'image/*', { hint: 'صورة JPG أو PNG.' }),
    file('certificate', 'صورة المؤهل العلمي', 'image/*,.pdf', { hint: 'صورة أو PDF.' }),
    file('extra', 'شهادات الخبرة والدورات التدريبية', 'image/*,.pdf', { multiple: 1, hint: 'يمكنك اختيار حتى 5 ملفات (صور أو PDF).' })
  ]],
  ['أسئلة إضافية والإقرار', [
    f('heard_from', 'كيف عرفت عن الوظيفة؟', { type: 'select', options: ['فيسبوك', 'واتساب', 'صديق أو معارف', 'زيارة المكتب', 'بحث Google', 'أخرى'] }),
    f('pressure', 'هل تستطيع العمل تحت ضغط؟', { type: 'select', options: YESNO }),
    f('why_us', 'لماذا ترغب في العمل معنا؟', { type: 'textarea', max: 1000, wide: 1 }),
    f('why_you', 'ما الذي يجعلك الشخص المناسب لهذه الوظيفة؟', { type: 'textarea', max: 1000, wide: 1 }),
    f('interview_ok', 'هل توافق على إجراء مقابلة شخصية؟', { type: 'select', options: YESNO }),
    f('trial_ok', 'هل توافق على فترة اختبار أو تدريب قبل التوظيف؟', { type: 'select', options: YESNO }),
    `<div class="wide consent"><label class="check"><input type="checkbox" name="consent" id="j_consent" required> <span>أقر بأن جميع البيانات والمعلومات المقدمة صحيحة، وأتحمل المسؤولية عن أي معلومات غير صحيحة، وأوافق على استخدام بياناتي لأغراض التوظيف والتواصل معي بشأن الفرص الوظيفية المتاحة لدى المكتب. <span class="req" aria-hidden="true">*</span></span></label>
    <p class="hint">التسجيل لا يعني ضمان الحصول على وظيفة.</p></div>`
  ]]
];

const e = (name, label, o = {}) => f(name, label, Object.assign({ prefix: 'e_' }, o));

const EMPLOYER_STEPS = [
  ['بيانات الجهة', [
    e('org_name', 'اسم الشركة أو المؤسسة', { req: 1, max: 150, ac: 'organization', wide: 1 }),
    e('contact_name', 'اسم الشخص المسؤول', { req: 1, max: 120, ac: 'name' }),
    e('contact_title', 'المسمى الوظيفي للمسؤول', { max: 100, ac: 'organization-title' }),
    e('phone', 'رقم التواصل', { type: 'tel', req: 1, max: 30, ac: 'tel' }),
    e('whatsapp', 'رقم واتساب', { type: 'tel', max: 30, hint: 'اتركه فارغًا إذا كان نفس رقم التواصل.' }),
    e('email', 'البريد الإلكتروني', { type: 'email', max: 120, ac: 'email' }),
    e('org_field', 'مجال نشاط الجهة', { max: 120, ph: 'مثال: مطاعم، تعليم، تجارة' }),
    e('org_address', 'عنوان الجهة وموقعها', { max: 200, wide: 1 })
  ]],
  ['الوظيفة المطلوبة', [
    e('job_title', 'المسمى الوظيفي المطلوب', { req: 1, max: 150, list: 'job-titles', hint: 'اكتب أو اختر من القائمة.' }),
    e('count', 'عدد الموظفين المطلوبين', { type: 'number', req: 1, max: 4 }),
    e('qualification', 'المؤهل المطلوب', { type: 'select', options: ['غير مشترط', 'أساسي', 'ثانوي', 'دبلوم', 'بكالوريوس', 'ماجستير فأعلى'] }),
    e('specialization', 'التخصص المطلوب', { max: 120 }),
    e('exp_years', 'سنوات الخبرة المطلوبة', { type: 'select', options: ['بدون خبرة', 'أقل من سنة', 'من سنة إلى 3 سنوات', 'من 3 إلى 5 سنوات', 'أكثر من 5 سنوات'] }),
    e('gender_pref', 'الجنس المطلوب', { type: 'select', options: ['لا فرق', 'ذكور', 'إناث'] }),
    e('skills', 'المهارات المطلوبة', { type: 'textarea', max: 1000, wide: 1 }),
    e('tasks', 'وصف المهام والمسؤوليات', { type: 'textarea', max: 2000, wide: 1, rows: 4 })
  ]],
  ['ظروف العمل والتقديم', [
    e('work_location', 'مكان العمل', { req: 1, max: 150 }),
    e('work_type', 'نوع الدوام', { type: 'select', req: 1, options: ['دوام كامل', 'دوام جزئي', 'دوام مؤقت', 'عمل عن بُعد'] }),
    e('hours', 'ساعات العمل', { max: 80, ph: 'مثال: من 8 صباحًا إلى 4 عصرًا' }),
    e('salary', 'الراتب أو نطاق الراتب', { max: 80 }),
    e('benefits', 'المزايا', { max: 200, wide: 1, ph: 'مثال: سكن، مواصلات، وجبات' }),
    e('start_date', 'موعد بدء العمل', { type: 'date' }),
    e('deadline', 'آخر موعد للتقديم', { type: 'date' }),
    e('receive_via', 'طريقة استقبال الترشيحات', { type: 'select', options: ['واتساب', 'اتصال هاتفي', 'البريد الإلكتروني', 'عبر المكتب مباشرة'] }),
    e('publish_ok', 'هل توافق على نشر الإعلان في الموقع وقناة الوظائف؟', { type: 'select', options: ['نعم، بدون أرقام التواصل', 'لا، أفضّل الترشيح المباشر فقط'], wide: 1, hint: 'لا ننشر أرقام التواصل الخاصة بالجهة في الإعلانات.' }),
    e('notes', 'ملاحظات إضافية', { type: 'textarea', max: 1000, wide: 1 }),
    `<div class="wide consent"><label class="check"><input type="checkbox" name="consent" id="e_consent" required> <span>أقر بصحة البيانات المقدمة، وأوافق على تواصل مكتب أونلاين تك معنا بشأن هذا الطلب وترشيح الكفاءات المناسبة. <span class="req" aria-hidden="true">*</span></span></label></div>`
  ]]
];

function stepForm({ id, table, label, steps, maxMb }) {
  const n = steps.length;
  const body = steps.map(([name, items], i) => `<fieldset class="step" data-step="${i + 1}"${i ? ' hidden' : ''}>
  <legend><span class="step-num">الخطوة ${i + 1} من ${n}</span> ${esc(name)}</legend>
  <div class="grid2">${items.join('\n')}</div>
</fieldset>`).join('\n');
  const dots = steps.map(([name], i) => `<li${i ? '' : ' aria-current="step"'}><span>${i + 1}</span><em>${esc(name)}</em></li>`).join('');
  return `<form class="form jobform" id="${id}" data-stepform="${table}"${maxMb ? ` data-max-mb="${maxMb}"` : ''} novalidate aria-label="${esc(label)}">
  <ol class="steps-bar" aria-hidden="true">${dots}</ol>
  ${body}
  <div class="hp" aria-hidden="true"><label>لا تملأ هذا الحقل<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
  <div class="form-msg" role="status" aria-live="polite" hidden></div>
  <div class="step-nav">
    <button class="btn btn-ghost" type="button" data-prev hidden>السابق</button>
    <button class="btn btn-primary" type="button" data-next>التالي</button>
    <button class="btn btn-primary" type="submit" hidden>إرسال الطلب</button>
  </div>
  <noscript><p class="form-msg err">تحتاج الاستمارة إلى تفعيل JavaScript في المتصفح. يمكنك بدلًا من ذلك التواصل معنا عبر واتساب.</p></noscript>
</form>`;
}

const titlesList = () => `<datalist id="job-titles">${Object.values(TITLES).flat().map((t) => `<option value="${esc(t)}"></option>`).join('')}</datalist>`;

export function jobApplicationForm() {
  return stepForm({ id: 'jobForm', table: 'job_seekers', label: 'استمارة طلب توظيف', steps: STEPS, maxMb: MAX_MB }) + titlesList();
}

export function employerRequestForm() {
  return stepForm({ id: 'empForm', table: 'employer_requests', label: 'استمارة طلب موظفين', steps: EMPLOYER_STEPS }) + titlesList();
}
