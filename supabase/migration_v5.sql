-- ============================================================
-- Road Asset Tracker — v5 migration
-- Admin-managed asset catalog: L1 assets → L2..L6 levels → options (+ price)
--
-- The catalog is edited in the app (Dashboard → Catalog): admins add an asset,
-- give it the levels it needs (feeder pillars only use L2, a lamp might use
-- L2..L5) and fill in the selectable values with their prices. Prices live on an
-- option and are inherited by everything under it, so a combination's price is
-- the deepest non-null price on the picked path. The Excel import is a secondary
-- way to load/refresh this data and only ever ADDS what is missing.
--
-- Run after schema.sql / migration_v2.sql / migration_v3.sql / migration_v4.sql
-- in the Supabase SQL editor.
-- ============================================================

-- Remove the earlier drafts of this migration (the "hardcoded structure" ones).
-- Guarded so re-running never touches the current tables.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'catalog_options'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'catalog_options'
      and column_name = 'parent_id'
  ) then
    drop table public.catalog_options cascade;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'catalog_prices'
  ) then
    drop table public.catalog_prices cascade;
  end if;
end $$;

alter table public.inspections drop column if exists catalog_asset_key;

-- L1 — the asset itself, e.g. "LAMPU JALAN".
create table if not exists public.catalog_assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  -- heading of the price column ("HARGA", "PRICE", …)
  price_label text,
  created_at timestamptz not null default now()
);

alter table public.catalog_assets
  add column if not exists price_label text;

create unique index if not exists catalog_assets_name_uniq
  on public.catalog_assets (lower(name));

-- One row per level the asset actually uses (2..6, any subset).
create table if not exists public.catalog_levels (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.catalog_assets(id) on delete cascade,
  level_no integer not null check (level_no between 2 and 6),
  label text not null,
  unique (asset_id, level_no)
);

-- The option tree. `parent_id` is the option picked one level above (null = the
-- first level); the price sits on the LAST value of a combination (a node with
-- no children), i.e. the "price column" of the sheet.
create table if not exists public.catalog_options (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.catalog_assets(id) on delete cascade,
  level_no integer not null check (level_no between 2 and 6),
  parent_id uuid references public.catalog_options(id) on delete cascade,
  value text not null,
  price numeric(14,2),
  raw_price text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Older drafts stored a price on every node; keep it only on the leaf values.
update public.catalog_options as child
   set price = null, raw_price = null
 where child.price is not null
   and exists (select 1 from public.catalog_options as parent where parent.parent_id = child.id);

create index if not exists catalog_options_asset_idx
  on public.catalog_options (asset_id);
create index if not exists catalog_options_parent_idx
  on public.catalog_options (parent_id);

-- A plain unique constraint treats NULL parents as distinct, so root and child
-- rows are guarded by two partial indexes.
create unique index if not exists catalog_options_root_uniq
  on public.catalog_options (asset_id, lower(value)) where parent_id is null;
create unique index if not exists catalog_options_child_uniq
  on public.catalog_options (parent_id, lower(value)) where parent_id is not null;

-- Snapshot of what the inspector picked — kept even if the catalog changes.
alter table public.inspections
  add column if not exists catalog_asset_id uuid references public.catalog_assets(id) on delete set null,
  add column if not exists asset_category text,
  add column if not exists catalog_path jsonb,
  add column if not exists l2 text,
  add column if not exists l3 text,
  add column if not exists l4 text,
  add column if not exists l5 text,
  add column if not exists l6 text,
  add column if not exists price numeric(14,2),
  add column if not exists price_manual boolean not null default false,
  add column if not exists other_description text;

-- RLS: the catalog is readable by every signed-in user, writable by admins only.
alter table public.catalog_assets enable row level security;
alter table public.catalog_levels enable row level security;
alter table public.catalog_options enable row level security;

drop policy if exists "read catalog assets" on public.catalog_assets;
create policy "read catalog assets" on public.catalog_assets
  for select to authenticated using (true);
drop policy if exists "admin manages catalog assets" on public.catalog_assets;
create policy "admin manages catalog assets" on public.catalog_assets
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "read catalog levels" on public.catalog_levels;
create policy "read catalog levels" on public.catalog_levels
  for select to authenticated using (true);
drop policy if exists "admin manages catalog levels" on public.catalog_levels;
create policy "admin manages catalog levels" on public.catalog_levels
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "read catalog options" on public.catalog_options;
create policy "read catalog options" on public.catalog_options
  for select to authenticated using (true);
drop policy if exists "admin manages catalog options" on public.catalog_options;
create policy "admin manages catalog options" on public.catalog_options
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
