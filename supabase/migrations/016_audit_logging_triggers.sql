-- ============================================================
-- Migration 016 — تفعيل التسجيل التلقائي الشامل لسجل التدقيق المالي
-- ============================================================

-- 1. دالة معالجة التدقيق التلقائي (Audit Log Trigger Function)
create or replace function public.log_financial_audit()
returns trigger language plpgsql security definer as $$
declare
  v_user_id uuid;
  v_facility_id uuid;
  v_action text;
  v_old jsonb := null;
  v_new jsonb := null;
  v_record_id uuid := null;
begin
  v_user_id := auth.uid();

  if (TG_OP = 'INSERT') then
    v_action := 'create';
    v_new := to_jsonb(NEW);
    v_facility_id := case when (v_new ? 'facility_id') then (NEW.facility_id) else null end;
    if (v_new ? 'id') then v_record_id := NEW.id; end if;
  elsif (TG_OP = 'UPDATE') then
    v_action := 'update';
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_facility_id := case when (v_new ? 'facility_id') then (NEW.facility_id) else null end;
    if (v_new ? 'id') then v_record_id := NEW.id; end if;
  elsif (TG_OP = 'DELETE') then
    v_action := 'delete';
    v_old := to_jsonb(OLD);
    v_facility_id := case when (v_old ? 'facility_id') then (OLD.facility_id) else null end;
    if (v_old ? 'id') then v_record_id := OLD.id; end if;
  end if;

  insert into public.audit_log (
    user_id,
    facility_id,
    action,
    table_name,
    record_id,
    old_value,
    new_value,
    created_at
  ) values (
    v_user_id,
    v_facility_id,
    v_action,
    TG_TABLE_NAME,
    v_record_id,
    v_old,
    v_new,
    now()
  );

  if (TG_OP = 'DELETE') then
    return OLD;
  else
    return NEW;
  end if;
end;
$$;

-- 2. ربط التريجر بجداول الإيرادات والتجنيب والعقود والشراء
drop trigger if exists trg_audit_revenue_entries on public.revenue_entries;
create trigger trg_audit_revenue_entries
  after insert or update or delete on public.revenue_entries
  for each row execute function public.log_financial_audit();

drop trigger if exists trg_audit_deductions on public.deductions;
create trigger trg_audit_deductions
  after insert or update or delete on public.deductions
  for each row execute function public.log_financial_audit();

drop trigger if exists trg_audit_contracts on public.contracts;
create trigger trg_audit_contracts
  after insert or update or delete on public.contracts
  for each row execute function public.log_financial_audit();

drop trigger if exists trg_audit_procurement_orders on public.procurement_orders;
create trigger trg_audit_procurement_orders
  after insert or update or delete on public.procurement_orders
  for each row execute function public.log_financial_audit();

drop trigger if exists trg_audit_monthly_closures on public.monthly_closures;
create trigger trg_audit_monthly_closures
  after insert or update or delete on public.monthly_closures
  for each row execute function public.log_financial_audit();

drop trigger if exists trg_audit_monthly_deadlines on public.monthly_deadlines;
create trigger trg_audit_monthly_deadlines
  after insert or update or delete on public.monthly_deadlines
  for each row execute function public.log_financial_audit();

notify pgrst, 'reload schema';
