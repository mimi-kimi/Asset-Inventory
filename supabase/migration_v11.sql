-- ============================================================
-- Road Asset Tracker — v11 migration
-- Open co-editing of reports.
--
-- Every signed-in account already reads every report (v10). From now on every
-- account may also EDIT any report, so a colleague can fix a marker without
-- adding a duplicate report. The report keeps its original `inspector_id`, so
-- "who first recorded it" is unchanged even after someone else edits it.
--
-- Deleting stays with the author (or an admin) so findings are not lost by
-- accident — "update inspections" is the only policy this migration changes.
--
-- Run after schema.sql / migration_v2..v10 in the Supabase SQL editor.
-- Safe to re-run.
-- ============================================================

-- 1. any signed-in user may update any report -------------------------------
drop policy if exists "update inspections" on public.inspections;
create policy "update inspections" on public.inspections
  for update to authenticated
  using (true)
  with check (true);

-- 2. …but not the bits that identify or move the report ----------------------
-- (author, marker and timestamps stay as recorded; a non-admin can only edit
--  the content: photo, condition, price, catalog snapshot, remarks, etc.)
create or replace function public.protect_inspection_columns()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not (
    public.is_admin()
    or coalesce(auth.role(), '') = 'service_role'
    or (auth.uid() is null and auth.role() is null)
  ) then
    if new.inspector_id is distinct from old.inspector_id
       or new.asset_id is distinct from old.asset_id
       or new.inspected_at is distinct from old.inspected_at
       or new.created_at is distinct from old.created_at then
      raise exception
        'Only an administrator can change a report''s author, marker or timestamps.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_inspection_columns on public.inspections;
create trigger protect_inspection_columns
  before update on public.inspections
  for each row execute function public.protect_inspection_columns();

-- To undo the hardening (updates stay open):
--   drop trigger if exists protect_inspection_columns on public.inspections;
--   drop policy if exists "update inspections" on public.inspections;
--   create policy "update inspections" on public.inspections
--     for update to authenticated
--     using (public.is_admin() or inspector_id = auth.uid())
--     with check (public.is_admin() or inspector_id = auth.uid());
