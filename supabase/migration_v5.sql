-- ============================================================
-- Road Asset Tracker — v5 migration
-- Price catalog for the "Aset perabot jalan" inventory.
--
-- The L1..L5 *structure* (assets, level labels, selectable options) is
-- hardcoded in `lib/catalog-data.ts`, so only PRICES live in the database and
-- admins can update them from Dashboard → Catalog without a redeploy.
--
-- Run after schema.sql / migration_v2.sql / migration_v3.sql / migration_v4.sql
-- in the Supabase SQL editor. Safe to re-run (imported prices are preserved).
-- ============================================================

-- Clean up the first draft of this migration, if it was already applied:
-- back then `catalog_prices` was keyed by a `catalog_assets` UUID foreign key.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'catalog_prices'
      and column_name = 'asset_id'
  ) then
    drop table public.catalog_prices cascade;
  end if;
end $$;

drop table if exists public.catalog_options cascade;
drop table if exists public.catalog_levels cascade;
drop table if exists public.catalog_assets cascade;
alter table public.inspections drop column if exists catalog_asset_id;

-- One row per L1..L5 combination; `asset_key` matches lib/catalog-data.ts
-- (e.g. 'lampu-jalan'). Level columns are '' (never NULL) so the unique key
-- and upserts work for assets that only use L2.
create table if not exists public.catalog_prices (
  id uuid primary key default gen_random_uuid(),
  asset_key text not null,
  l2 text not null default '',
  l3 text not null default '',
  l4 text not null default '',
  l5 text not null default '',
  price numeric(14,2),
  raw_price text,
  updated_at timestamptz not null default now(),
  unique (asset_key, l2, l3, l4, l5)
);

create index if not exists catalog_prices_asset_idx
  on public.catalog_prices (asset_key);

-- L1..L6 snapshot of what the inspector picked (kept even if prices change).
alter table public.inspections
  add column if not exists catalog_asset_key text,
  add column if not exists asset_category text,
  add column if not exists l2 text,
  add column if not exists l3 text,
  add column if not exists l4 text,
  add column if not exists l5 text,
  add column if not exists price numeric(14,2),
  add column if not exists price_manual boolean not null default false,
  add column if not exists other_description text;

-- RLS: prices readable by every signed-in user, writable by admins only.
alter table public.catalog_prices enable row level security;

drop policy if exists "read catalog prices" on public.catalog_prices;
create policy "read catalog prices" on public.catalog_prices
  for select to authenticated using (true);

drop policy if exists "admin manages catalog prices" on public.catalog_prices;
create policy "admin manages catalog prices" on public.catalog_prices
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
