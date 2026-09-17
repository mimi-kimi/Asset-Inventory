-- ============================================================
-- Road Asset Tracker — v8 migration
-- The inspector's condition is now an explicit choice: Good / Fair / Bad
-- (it used to be derived from the working toggle, on a five-value scale).
--
-- Run after schema.sql / migration_v2..v7 in the Supabase SQL editor.
-- Safe to re-run.
-- ============================================================

-- 1. fold the old five-value scale onto the new one
update public.inspections
   set condition = 'BAD'
 where condition in ('POOR', 'DAMAGED', 'NOT_FUNCTIONAL');

-- 2. only Good / Fair / Bad are allowed from now on
alter table public.inspections drop constraint if exists inspections_condition_check;
alter table public.inspections
  add constraint inspections_condition_check
  check (condition in ('GOOD', 'FAIR', 'BAD'));

-- 3. a new record defaults to Good when nothing is picked
alter table public.inspections alter column condition set default 'GOOD';
