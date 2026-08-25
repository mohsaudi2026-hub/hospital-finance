-- ============================================================
-- Migration 013 — تخصيص نطاق الإقفال الشهري (Granular Locking)
-- ============================================================

alter table if exists monthly_deadlines 
  add column if not exists lock_scope text not null default 'all' 
  check (lock_scope in ('all', 'revenue', 'expenses', 'deductions', 'contracts', 'none'));

-- تحديث السجلات القائمة
update monthly_deadlines set lock_scope = 'all' where lock_scope is null;
