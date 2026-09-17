-- ============================================================
-- Road Asset Tracker — v7 migration
-- Retire the old "Asset types" lookup: the catalog (catalog_assets) is the
-- category source now, and the mobile app + catalog pages replace the legacy
-- asset CRUD and /inspect routes.
--
-- Run after schema.sql / migration_v2..v6 in the Supabase SQL editor.
-- Irreversible: the type name is copied into assets.type_text first.
-- ============================================================

-- 1. keep the information: turn the old type into plain text on the asset
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'asset_types'
  ) then
    execute $sql$
      update public.assets a
         set type_text = t.name
        from public.asset_types t
       where a.type_id = t.id
         and (a.type_text is null or a.type_text = '')
    $sql$;
  end if;
end $$;

-- 2. drop the column + the lookup table (their policies go with it)
alter table public.assets drop column if exists type_id;
drop table if exists public.asset_types cascade;
