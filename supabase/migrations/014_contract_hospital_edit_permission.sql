-- ============================================================
-- Migration 014 — منح إذن التعديل الاستثنائي للعقود وتتبع الفتح
-- ============================================================

alter table if exists contracts 
  add column if not exists allow_hospital_edit boolean not null default false,
  add column if not exists unlocked_by uuid references profiles(id),
  add column if not exists unlocked_at timestamptz;
