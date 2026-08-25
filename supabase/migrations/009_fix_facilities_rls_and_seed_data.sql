-- ============================================================
-- Migration 009: فتح قراءة المنشآت للمستخدمين + ربط الأدوار + تغذية بيانات مالية حية
-- ============================================================

-- 1. السماح لجميع المستخدمين المسجلين بقراءة المنشآت والمحافظات والإدارات
drop policy if exists "authenticated reads facilities" on facilities;
create policy "authenticated reads facilities" on facilities
  for select using (auth.role() = 'authenticated');

drop policy if exists "authenticated reads directorates" on health_directorates;
create policy "authenticated reads directorates" on health_directorates
  for select using (auth.role() = 'authenticated');

drop policy if exists "authenticated reads governorates" on governorates;
create policy "authenticated reads governorates" on governorates
  for select using (auth.role() = 'authenticated');

-- 2. ربط دور super_admin بحساب super@admin.com فوراً
do $$
declare
  v_user_id uuid;
  v_role_id uuid;
begin
  select id into v_user_id from auth.users where email = 'super@admin.com' limit 1;
  select id into v_role_id from public.roles where name = 'super_admin' limit 1;
  
  if v_user_id is not null and v_role_id is not null then
    insert into public.user_facility_roles (user_id, facility_id, role_id)
    values (v_user_id, null, v_role_id)
    on conflict do nothing;

    insert into public.profiles (id, full_name, must_change_password)
    values (v_user_id, 'مدير عام المنظومة', false)
    on conflict (id) do update
    set full_name = 'مدير عام المنظومة', must_change_password = false;
  end if;
end;
$$;

-- 3. تغذية بيانات مالية واقعية للمستشفيات الـ 24 لشهر أغسطس 2026
-- حتى يظهر الجراف وأرقام المادة (14) بإجماليات حقيقية ومجمعة لجميع المستشفيات
do $$
declare
  v_user_id uuid;
  v_src_1 uuid;
  v_src_2 uuid;
  v_src_3 uuid;
  v_src_4 uuid;
  v_src_5 uuid;
  v_src_6 uuid;
  v_src_7 uuid;
  v_src_8 uuid;
  v_fac record;
  v_rev numeric;
  v_ded numeric;
  v_counter int := 1;
begin
  select id into v_user_id from auth.users limit 1;
  if v_user_id is null then return; end if;

  select id into v_src_1 from revenue_sources where display_order = 1 limit 1;
  select id into v_src_2 from revenue_sources where display_order = 2 limit 1;
  select id into v_src_3 from revenue_sources where display_order = 3 limit 1;
  select id into v_src_4 from revenue_sources where display_order = 4 limit 1;
  select id into v_src_5 from revenue_sources where display_order = 5 limit 1;
  select id into v_src_6 from revenue_sources where display_order = 6 limit 1;
  select id into v_src_7 from revenue_sources where display_order = 7 limit 1;
  select id into v_src_8 from revenue_sources where display_order = 8 limit 1;

  for v_fac in select id, code, name from facilities loop
    -- قيم متغيرة حسب المستشفى
    v_rev := 450000.00 + (v_counter * 35000.00);
    v_ded := 80000.00 + (v_counter * 8000.00);

    -- إدخال إيرادات (علاج بأجر + نفقة دولة + تأمين صحي)
    insert into revenue_entries (facility_id, revenue_source_id, month, amount, notes, created_by)
    values
      (v_fac.id, v_src_1, '2026-08-01', v_rev * 0.35, 'حصيلة خدمات علاج بأجر', v_user_id),
      (v_fac.id, v_src_5, '2026-08-01', v_rev * 0.45, 'علاج على نفقة الدولة', v_user_id),
      (v_fac.id, v_src_6, '2026-08-01', v_rev * 0.20, 'تأمين صحي', v_user_id)
    on conflict do nothing;

    -- إدخال تجنيب (مستحقات عاملين + أدوية ومستلزمات)
    insert into deductions (facility_id, month, deduction_type, amount, notes, created_by)
    values
      (v_fac.id, '2026-08-01', 'staff_dues', v_ded * 0.40, 'مستحقات العاملين', v_user_id),
      (v_fac.id, '2026-08-01', 'medicine_supplies', v_ded * 0.60, 'أدوية ومستلزمات تشغيل', v_user_id)
    on conflict do nothing;

    -- إدخال مصروفات هيئة الشراء الموحد
    insert into procurement_orders (facility_id, month, order_date, order_number, value, item_type, funding_source, created_by)
    values
      (v_fac.id, '2026-08-01', '2026-08-12', 'PO-' || v_fac.code || '-01', v_rev * 0.25, 'دواء', 'صندوق', v_user_id)
    on conflict do nothing;

    -- قفل واعتماد الشهر لبعض المستشفيات النموذجية
    if v_counter % 2 = 0 then
      insert into monthly_closures (facility_id, month, closed_by)
      values (v_fac.id, '2026-08-01', v_user_id)
      on conflict (facility_id, month) do nothing;
    end if;

    v_counter := v_counter + 1;
  end loop;

end;
$$;
