-- ============================================================
-- كود التحديث الشامل لقاعدة البيانات (مواعيد الإقفال + تصاريح العقود)
-- يرجى نسخ هذا الكود بالكامل ولصقه وتشغيله في Supabase SQL Editor
-- ============================================================

-- 1. إنشاء جدول مواعيد وإقفالات الشهور (monthly_deadlines)
create table if not exists public.monthly_deadlines (
  month          date primary key,                  -- أول يوم في الشهر (YYYY-MM-01)
  deadline_date  date not null,                     -- تاريخ انتهاء المهلة المحددة للتسجيل
  is_locked      boolean not null default false,    -- قفل عام استثنائي للشهر بقرار وزاري
  lock_scope     text not null default 'all' check (lock_scope in ('all', 'revenue', 'expenses', 'deductions', 'contracts', 'none')),
  notes          text,                              -- ملاحظات أو توجيهات وزارية
  created_by     uuid references profiles(id),
  updated_at     timestamptz not null default now()
);

-- تفعيل سياسات الأمان RLS
alter table public.monthly_deadlines enable row level security;

drop policy if exists "الكل يمكنه قراءة مواعيد الإقفال" on public.monthly_deadlines;
create policy "الكل يمكنه قراءة مواعيد الإقفال"
  on public.monthly_deadlines for select
  to authenticated
  using (true);

drop policy if exists "السوبر أدمن فقط يمكنه تعديل مواعيد الإقفال" on public.monthly_deadlines;
create policy "السوبر أدمن فقط يمكنه تعديل مواعيد الإقفال"
  on public.monthly_deadlines for all
  to authenticated
  using (
    exists (
      select 1 from user_facility_roles ufr
      join roles r on r.id = ufr.role_id
      where ufr.user_id = auth.uid()
        and r.name = 'super_admin'
    )
    or auth.jwt() ->> 'email' = 'super@admin.com'
  );

-- بذر المواعيد الافتراضية لشهور السنة المالية 2026/2027
insert into public.monthly_deadlines (month, deadline_date, is_locked, lock_scope, notes)
values
  ('2026-07-01', '2026-08-10', false, 'all', 'مهلة تسجيل شهر يوليو'),
  ('2026-08-01', '2026-09-10', false, 'all', 'مهلة تسجيل شهر أغسطس'),
  ('2026-09-01', '2026-10-10', false, 'all', 'مهلة تسجيل شهر سبتمبر'),
  ('2026-10-01', '2026-11-10', false, 'all', 'مهلة تسجيل شهر أكتوبر'),
  ('2026-11-01', '2026-12-10', false, 'all', 'مهلة تسجيل شهر نوفمبر'),
  ('2026-12-01', '2027-01-10', false, 'all', 'مهلة تسجيل شهر ديسمبر'),
  ('2027-01-01', '2027-02-10', false, 'all', 'مهلة تسجيل شهر يناير'),
  ('2027-02-01', '2027-03-10', false, 'all', 'مهلة تسجيل شهر فبراير'),
  ('2027-03-01', '2027-04-10', false, 'all', 'مهلة تسجيل شهر مارس'),
  ('2027-04-01', '2027-05-10', false, 'all', 'مهلة تسجيل شهر أبريل'),
  ('2027-05-01', '2027-06-10', false, 'all', 'مهلة تسجيل شهر مايو'),
  ('2027-06-01', '2027-07-10', false, 'all', 'مهلة تسجيل شهر يونيو والحساب الختامي')
on conflict (month) do update set
  lock_scope = excluded.lock_scope;

-- 2. إضافة حقول إذن فتح تعديل العقود الاستثنائي في جدول contracts
alter table if exists public.contracts 
  add column if not exists allow_hospital_edit boolean not null default false,
  add column if not exists unlocked_by uuid references profiles(id),
  add column if not exists unlocked_at timestamptz;

-- 3. تحديث الكاش التلقائي لواجهة برمجة تطبيقات Supabase (PostgREST Schema Reload)
notify pgrst, 'reload schema';
