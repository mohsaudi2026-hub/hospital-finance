-- ============================================================
-- Migration 012 — مواعيد الإقفال الشهرية وإدارة مهل التسجيل
-- ============================================================

create table if not exists monthly_deadlines (
  month          date primary key,                  -- أول يوم في الشهر (YYYY-MM-01)
  deadline_date  date not null,                     -- تاريخ انتهاء المهلة المحددة للتسجيل
  is_locked      boolean not null default false,    -- قفل عام استثنائي للشهر بقرار وزاري
  notes          text,                              -- ملاحظات أو توجيهات وزارية
  created_by     uuid references profiles(id),
  updated_at     timestamptz not null default now()
);

-- RLS
alter table monthly_deadlines enable row level security;

create policy "الكل يمكنه قراءة مواعيد الإقفال"
  on monthly_deadlines for select
  to authenticated
  using (true);

create policy "السوبر أدمن فقط يمكنه تعديل مواعيد الإقفال"
  on monthly_deadlines for all
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

-- بذر مواعيد افتراضية لشهور السنة المالية 2026/2027 (المهلة يوم 10 من الشهر التالي)
insert into monthly_deadlines (month, deadline_date, is_locked, notes)
values
  ('2026-07-01', '2026-08-10', false, 'مهلة تسجيل شهر يوليو'),
  ('2026-08-01', '2026-09-10', false, 'مهلة تسجيل شهر أغسطس'),
  ('2026-09-01', '2026-10-10', false, 'مهلة تسجيل شهر سبتمبر'),
  ('2026-10-01', '2026-11-10', false, 'مهلة تسجيل شهر أكتوبر'),
  ('2026-11-01', '2026-12-10', false, 'مهلة تسجيل شهر نوفمبر'),
  ('2026-12-01', '2027-01-10', false, 'مهلة تسجيل شهر ديسمبر'),
  ('2027-01-01', '2027-02-10', false, 'مهلة تسجيل شهر يناير'),
  ('2027-02-01', '2027-03-10', false, 'مهلة تسجيل شهر فبراير'),
  ('2027-03-01', '2027-04-10', false, 'مهلة تسجيل شهر مارس'),
  ('2027-04-01', '2027-05-10', false, 'مهلة تسجيل شهر أبريل'),
  ('2027-05-01', '2027-06-10', false, 'مهلة تسجيل شهر مايو'),
  ('2027-06-01', '2027-07-10', false, 'مهلة تسجيل شهر يونيو والحساب الختامي')
on conflict (month) do nothing;
