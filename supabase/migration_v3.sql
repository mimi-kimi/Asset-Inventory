-- ============================================================
-- Road Asset Tracker — v3 migration
-- Adds a small WebP/base64 photo column on inspections
-- (stored directly in the row to avoid extra storage uploads).
-- Safe to re-run.
-- ============================================================
alter table public.inspections
  add column if not exists photo_webp text;
