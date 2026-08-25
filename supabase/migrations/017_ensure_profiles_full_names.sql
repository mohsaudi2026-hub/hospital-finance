-- ============================================================
-- Migration 017 — التأكد من ملء وتحديث الأسماء لكافة الحسابات
-- ============================================================

-- 1. تحديث الحسابات التجريبية بالأسماء الرسمية
update public.profiles
set full_name = 'مدير عام المنظومة (ديوان الوزارة)'
where id in (select id from auth.users where email = 'super@admin.com')
  and (full_name is null or full_name = '' or full_name = 'super');

update public.profiles
set full_name = 'د. مسؤول المتابعة والتقارير بالوزارة'
where id in (select id from auth.users where email = 'viewer@health.gov.eg')
  and (full_name is null or full_name = '' or full_name = 'viewer');

update public.profiles
set full_name = 'د. مدير المستشفى والمنشأة الطبية'
where id in (select id from auth.users where email like 'admin@%')
  and (full_name is null or full_name = '');

update public.profiles
set full_name = 'أ. مسؤول تسجيل البيانات والإيرادات'
where id in (select id from auth.users where email like 'entry@%')
  and (full_name is null or full_name = '');

update public.profiles
set full_name = 'أ. مراقب الحسابات والمصروفات'
where id in (select id from auth.users where email like 'viewer@%')
  and (full_name is null or full_name = '');

notify pgrst, 'reload schema';
