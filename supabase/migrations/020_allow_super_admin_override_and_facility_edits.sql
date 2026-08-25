-- ============================================================
-- Migration 020 — السماح للسوبر أدمن بالتعديل الاستثنائي وتعديل المنشآت
-- ============================================================

-- 1. تحديث دالة منع الكتابة للشهر المقفل للسماح للسوبر أدمن بالتعديل الاستثنائي
create or replace function public.prevent_write_to_closed_month()
returns trigger language plpgsql security definer as $$
begin
  -- إذا كان المستخدم سوبر أدمن، يُسمح له بالتعديل الاستثنائي
  if public.is_super_admin() then
    return new;
  end if;

  if exists (
    select 1 from public.monthly_closures mc
    where mc.facility_id = new.facility_id
      and mc.month = new.month
  ) then
    raise exception 'هذا الشهر مقفل بعد الاعتماد النهائي — أي تعديل يتطلب موافقة وتدخل السوبر أدمن بالوزارة';
  end if;
  return new;
end;
$$;

-- 2. سياسات RLS على جدول facilities للتأكد من سماح التعديل للسوبر أدمن
alter table public.facilities enable row level security;

drop policy if exists "super_admin manages facilities" on public.facilities;
create policy "super_admin manages facilities" on public.facilities
  for all using (public.is_super_admin());

drop policy if exists "authenticated reads facilities" on public.facilities;
create policy "authenticated reads facilities" on public.facilities
  for select using (auth.role() = 'authenticated');

-- 3. سياسات RLS على جدول revenue_entries
drop policy if exists "super_admin manages revenue_entries" on public.revenue_entries;
create policy "super_admin manages revenue_entries" on public.revenue_entries
  for all using (public.is_super_admin());

-- 4. سياسات RLS على جدول deductions
drop policy if exists "super_admin manages deductions" on public.deductions;
create policy "super_admin manages deductions" on public.deductions
  for all using (public.is_super_admin());

-- 5. سياسات RLS على جدول contracts
drop policy if exists "super_admin manages contracts" on public.contracts;
create policy "super_admin manages contracts" on public.contracts
  for all using (public.is_super_admin());

notify pgrst, 'reload schema';
