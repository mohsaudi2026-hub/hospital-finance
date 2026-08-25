-- ============================================================
-- Migration 004 — Phase 4: Views التجميع (السنة المالية يوليو-يونيو)
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. دوال السنة المالية الحكومية المصرية
-- Q1: يوليو-سبتمبر | Q2: أكتوبر-ديسمبر | Q3: يناير-مارس | Q4: أبريل-يونيو
-- ─────────────────────────────────────────────
create or replace function public.fiscal_year(d date)
returns int language sql immutable as $$
  select case
    when extract(month from d) >= 7
    then extract(year from d)::int
    else extract(year from d)::int - 1
  end;
$$;

create or replace function public.fiscal_quarter(d date)
returns int language sql immutable as $$
  select case
    when extract(month from d) in (7, 8, 9)   then 1
    when extract(month from d) in (10, 11, 12) then 2
    when extract(month from d) in (1, 2, 3)    then 3
    else 4
  end;
$$;

-- ─────────────────────────────────────────────
-- 2. View: ملخص شهري لكل منشأة
-- ─────────────────────────────────────────────
create or replace view monthly_facility_summary as
select
  f.id                             as facility_id,
  f.name                           as facility_name,
  f.code                           as facility_code,
  f.institutional_code,
  f.facility_type,
  d.name                           as directorate_name,
  g.name                           as governorate_name,
  g.code                           as governorate_code,
  re_agg.month,
  public.fiscal_year(re_agg.month)    as fiscal_year,
  public.fiscal_quarter(re_agg.month) as fiscal_quarter,
  coalesce(re_agg.total_revenue, 0)   as total_revenue,
  coalesce(ded_agg.total_deductions, 0) as total_deductions,
  coalesce(re_agg.total_revenue, 0) - coalesce(ded_agg.total_deductions, 0) as net_revenue,
  coalesce(po_agg.total_procurement, 0)  as total_procurement,
  coalesce(cp_agg.total_contracts, 0)    as total_contract_payments,
  coalesce(po_agg.total_procurement, 0) + coalesce(cp_agg.total_contracts, 0) as total_expenses,
  exists(select 1 from monthly_closures mc where mc.facility_id = f.id and mc.month = re_agg.month) as is_closed
from facilities f
join health_directorates d on d.id = f.directorate_id
join governorates g on g.id = d.governorate_id
left join (
  select facility_id, month, sum(amount) as total_revenue
  from revenue_entries
  group by facility_id, month
) re_agg on re_agg.facility_id = f.id
left join (
  select facility_id, month, sum(amount) as total_deductions
  from deductions
  group by facility_id, month
) ded_agg on ded_agg.facility_id = f.id and ded_agg.month = re_agg.month
left join (
  select facility_id, month, sum(value) as total_procurement
  from procurement_orders
  group by facility_id, month
) po_agg on po_agg.facility_id = f.id and po_agg.month = re_agg.month
left join (
  select facility_id, month, sum(amount_paid) as total_contracts
  from contract_payments
  group by facility_id, month
) cp_agg on cp_agg.facility_id = f.id and cp_agg.month = re_agg.month
where re_agg.month is not null;

-- ─────────────────────────────────────────────
-- 3. View: تجميع ربعي (السنة المالية يوليو-يونيو)
-- ─────────────────────────────────────────────
create or replace view quarterly_summary as
select
  facility_id,
  facility_name,
  facility_code,
  directorate_name,
  governorate_name,
  fiscal_year,
  fiscal_quarter,
  sum(total_revenue)           as total_revenue,
  sum(total_deductions)        as total_deductions,
  sum(net_revenue)             as net_revenue,
  sum(total_procurement)       as total_procurement,
  sum(total_contract_payments) as total_contract_payments,
  sum(total_expenses)          as total_expenses
from monthly_facility_summary
group by facility_id, facility_name, facility_code,
         directorate_name, governorate_name, fiscal_year, fiscal_quarter;

-- ─────────────────────────────────────────────
-- 4. View: تجميع سنوي (السنة المالية)
-- ─────────────────────────────────────────────
create or replace view annual_summary as
select
  facility_id,
  facility_name,
  facility_code,
  directorate_name,
  governorate_name,
  fiscal_year,
  sum(total_revenue)           as total_revenue,
  sum(total_deductions)        as total_deductions,
  sum(net_revenue)             as net_revenue,
  sum(total_procurement)       as total_procurement,
  sum(total_contract_payments) as total_contract_payments,
  sum(total_expenses)          as total_expenses
from monthly_facility_summary
group by facility_id, facility_name, facility_code,
         directorate_name, governorate_name, fiscal_year;

-- ─────────────────────────────────────────────
-- 5. View: داشبورد الوزارة — مقارنة إجمالية لكل المنشآت
-- ─────────────────────────────────────────────
create or replace view ministry_overview as
select
  g.id                    as governorate_id,
  g.name                  as governorate_name,
  g.code                  as governorate_code,
  count(distinct f.id)    as total_facilities,
  mfs.month,
  public.fiscal_year(mfs.month)    as fiscal_year,
  public.fiscal_quarter(mfs.month) as fiscal_quarter,
  sum(mfs.total_revenue)           as total_revenue,
  sum(mfs.total_deductions)        as total_deductions,
  sum(mfs.net_revenue)             as net_revenue,
  sum(mfs.total_expenses)          as total_expenses,
  count(distinct case when mfs.is_closed then f.id end) as closed_facilities,
  count(distinct case when not mfs.is_closed then f.id end) as open_facilities
from governorates g
join health_directorates d on d.governorate_id = g.id
join facilities f on f.directorate_id = d.id and f.is_active = true
left join monthly_facility_summary mfs on mfs.facility_id = f.id
group by g.id, g.name, g.code, mfs.month;

-- ─────────────────────────────────────────────
-- 6. View: مقارنة الإيرادات بالتجنيب لكل مصدر
-- ─────────────────────────────────────────────
create or replace view revenue_by_source as
select
  re.facility_id,
  f.name   as facility_name,
  f.code   as facility_code,
  rs.label as revenue_source,
  re.month,
  public.fiscal_year(re.month)    as fiscal_year,
  public.fiscal_quarter(re.month) as fiscal_quarter,
  re.amount,
  re.ref_number
from revenue_entries re
join facilities f on f.id = re.facility_id
join revenue_sources rs on rs.id = re.revenue_source_id;
