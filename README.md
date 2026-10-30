# موقع مكتب أونلاين تك

موقع ثابت متعدد الصفحات (HTML/CSS/JS) مع قاعدة بيانات Supabase.

## بنية الملفات

```
src/site.json        بيانات المكتب (الأرقام، العنوان، الأقسام، مفاتيح Supabase العامة)
src/build.mjs        مولّد الصفحات:  node src/build.mjs  ← ينتج المجلد dist
src/assets/css       التصميم
src/assets/js        api.js (الاتصال بالقاعدة) · forms.js (النماذج) · vacancies.js (الوظائف)
                     chat.js (الرد التلقائي) · admin.js (لوحة الإدارة) · nav.js
supabase/schema.sql  مخطط قاعدة البيانات وسياسات الأمان (مطبّق فعلًا على المشروع)
netlify.toml         إعدادات Netlify ورؤوس الأمان
dist/                الموقع الجاهز للنشر (يتولّد تلقائيًا)
```

## قاعدة البيانات

مشروع Supabase باسم `online-tech-office`. الجداول:
`job_seekers` (الباحثون عن عمل) · `employer_requests` (طلبات الموظفين) · `inquiries` (الاستفسارات) · `vacancies` (الوظائف المنشورة) · `admin_users` (المدراء).

الزائر يستطيع فقط **إضافة** طلب جديد وقراءة الوظائف المنشورة. قراءة الطلبات وتعديلها وحذفها للمدراء المسجلين في `admin_users` فقط.

## النشر على Netlify

الموقع مربوط بهذا المستودع: كل تعديل يُرفع على الفرع `main` يبنيه Netlify تلقائيًا (`node src/build.mjs`) وينشر المجلد `dist`.

ربط المستودع (مرة واحدة): Netlify ← الموقع ← Project configuration ← Build & deploy ← Link repository ← GitHub ← `online-tech-office`. إعدادات البناء تُقرأ من `netlify.toml`.

للدومين الخاص: Domain management ← Add a custom domain.

## تفعيل لوحة الإدارة (`/admin/`)

1. في Supabase: Authentication ← Users ← Add user (بريد وكلمة مرور قوية).
2. في SQL Editor نفّذ:

```sql
insert into public.admin_users (user_id)
select id from auth.users where email = 'بريدك@example.com';
```

3. في Authentication ← Sign In / Providers أوقف «Allow new users to sign up» حتى لا يسجّل أحد غيرك حسابًا.

من اللوحة: متابعة الطلبات وتغيير حالتها، التواصل عبر واتساب، التصدير CSV، ونشر الوظائف أو إخفاؤها.

## تعديل المحتوى

عدّل `src/site.json` أو `src/build.mjs` ثم شغّل `node src/build.mjs` وأعد رفع `dist`.
الروابط جذرية (`/about.html`) فالموقع يعمل على جذر الدومين وليس داخل مجلد فرعي.
