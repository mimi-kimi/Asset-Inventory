-- ============================================================
-- Road Asset Tracker — v10 migration
-- One shared field inventory.
--
-- Until now a signed-in user could only read their OWN inspections
-- ("read inspections" = inspector_id = auth.uid() or is_admin()), so:
--   * an inspector's map showed markers another account had already done as
--     "not yet inspected" — the work looked out of sync between accounts,
--   * the mobile Records tab and the CSV exports disagreed per account,
--   * profiles were self-only, so no report could say who inspected it.
--
-- This migration shares READING of the field data between every signed-in
-- account, and fixes the writes RLS was silently dropping:
--   * inspections / inspection_photos / profiles → readable by all users
--   * the marker fields an inspector fills in (ID-Inventory, category, status)
--     may be written by whoever inspects the marker; the rest of the marker row
--     (coordinates, code, task, location, notes…) stays admin-only
--   * an admin may correct or remove any report
--
-- Editing stays with the author, so nobody rewrites somebody else's findings:
-- the app offers "Add a new report" in that case.
--
-- Run after schema.sql / migration_v2..v9 in the Supabase SQL editor.
-- Safe to re-run.
-- ============================================================

-- 1. everyone sees the same field data --------------------------------------
drop policy if exists "read inspections" on public.inspections;
create policy "read inspections" on public.inspections
  for select to authenticated using (true);

drop policy if exists "read inspection photos" on public.inspection_photos;
create policy "read inspection photos" on public.inspection_photos
  for select to authenticated using (true);

-- so a report can show "inspected by …". The email column holds the synthetic
-- <username>@<domain> address, so nothing private is exposed.
drop policy if exists "read own profile" on public.profiles;
create policy "read profiles" on public.profiles
  for select to authenticated using (true);

-- 2. writing a report stays with its author; admins may fix anything ---------
drop policy if exists "update own inspections" on public.inspections;
create policy "update inspections" on public.inspections
  for update to authenticated
  using (public.is_admin() or inspector_id = auth.uid())
  with check (public.is_admin() or inspector_id = auth.uid());

drop policy if exists "delete own inspections" on public.inspections;
create policy "delete inspections" on public.inspections
  for delete to authenticated
  using (public.is_admin() or inspector_id = auth.uid());

-- 3. the marker fields an inspector actually fills in -----------------------
-- (before: "admin manages assets" for update, so the app's update of the
--  marker row was silently ignored for inspectors — the admin kept seeing the
--  imported ID-Inventory / no category.)
drop policy if exists "admin manages assets" on public.assets;
create policy "update assets in the field" on public.assets
  for update to authenticated using (true) with check (true);

create or replace function public.protect_asset_columns()
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
    -- only these three columns may differ for a non-admin writer
    if (to_jsonb(new) - 'inventory_id' - 'type_text' - 'status')
       is distinct from
       (to_jsonb(old) - 'inventory_id' - 'type_text' - 'status') then
      raise exception
        'Only an administrator can change a marker''s position, code or import data.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_asset_columns on public.assets;
create trigger protect_asset_columns
  before update on public.assets
  for each row execute function public.protect_asset_columns();

-- To undo the hardening (reading stays shared):
--   drop trigger if exists protect_asset_columns on public.assets;
--   drop policy if exists "update assets in the field" on public.assets;
--   create policy "admin manages assets" on public.assets
--     for update to authenticated using (public.is_admin()) with check (public.is_admin());
