-- ============================================================
-- Migration 008: بيانات مالية تجريبية نموذجية لشهر أغسطس 2026
-- لتعبئة الداشبورد والتقارير بمؤشرات حية واقعية فوراً
-- ============================================================

do $$
declare
  v_user_id uuid;
  v_src_1 uuid;
  v_src_5 uuid;
  v_src_6 uuid;
  v_fac record;
  v_contract_id uuid;
begin
  select id into v_user_id from auth.users limit 1;
  if v_user_id is null then return; end if;

  select id into v_src_1 from revenue_sources where display_order = 1 limit 1;
  select id into v_src_5 from revenue_sources where display_order = 5 limit 1;
  select id into v_src_6 from revenue_sources where display_order = 6 limit 1;

  -- إدخال إيرادات ونفقات نموذجية لعدد من المستشفيات التجريبية
  for v_fac in select id, code from facilities limit 10 loop
    -- 1. إيرادات
    insert into revenue_entries (facility_id, revenue_source_id, month, amount, notes, created_by)
    values
      (v_fac.id, v_src_1, '2026-08-01', 350000.00, 'حصيلة خدمات علاج بأجر', v_user_id),
      (v_fac.id, v_src_5, '2026-08-01', 820000.00, 'علاج على نفقة الدولة', v_user_id),
      (v_fac.id, v_src_6, '2026-08-01', 430000.00, 'تأمين صحي', v_user_id)
    on conflict do nothing;

    -- 2. تجنيب
    insert into deductions (facility_id, month, deduction_type, amount, notes, created_by)
    values
      (v_fac.id, '2026-08-01', 'staff_dues', 120000.00, 'مستحقات أطباء وتمريض وإداريين', v_user_id),
      (v_fac.id, '2026-08-01', 'medicine_supplies', 240000.00, 'أدوية ومستلزمات عاجلة', v_user_id)
    on conflict do nothing;

    -- 3. أوامر هيئة الشراء
    insert into procurement_orders (facility_id, month, order_date, order_number, value, item_type, funding_source, created_by)
    values
      (v_fac.id, '2026-08-01', '2026-08-10', 'PO-' || v_fac.code || '-01', 280000.00, 'دواء', 'صندوق', v_user_id),
      (v_fac.id, '2026-08-01', '2026-08-15', 'PO-' || v_fac.code || '-02', 150000.00, 'مستلزمات', 'صندوق', v_user_id)
    on conflict do nothing;

    -- 4. عقود خدمات وسداد
    insert into contracts (
      facility_id, contract_type, company_name, start_date, duration_months,
      individual_value, supervisor_value, total_individuals, total_supervisors,
      total_contract_value, created_by
    )
    values (
      v_fac.id, 'security', 'شركة الحراسة الوطنية', '2026-07-01', 12,
      4500.00, 6000.00, 10, 1, 612000.00, v_user_id
    )
    returning id into v_contract_id;

    if v_contract_id is not null then
      insert into contract_payments (contract_id, facility_id, month, amount_paid, notes, created_by)
      values (v_contract_id, v_fac.id, '2026-08-01', 51000.00, 'سداد قسط شهر أغسطس', v_user_id)
      on conflict do nothing;
    end if;

  end loop;

end;
$$;
