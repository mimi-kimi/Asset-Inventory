-- ============================================================
-- Road Asset Tracker — v5 migration
-- Aset perabot jalan price catalog (L1 asset → L2..L5 options → L6 price)
-- Run after schema.sql / v2 / v3 / v4 in the Supabase SQL editor.
-- Safe to re-run (everything is IF NOT EXISTS).
-- ============================================================

create table if not exists public.catalog_assets (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- level labels per asset (e.g. LAMPU JALAN → L2 = KETERANGAN, L3 = ARM, …)
create table if not exists public.catalog_levels (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.catalog_assets(id) on delete cascade,
  level_no integer not null check (level_no between 2 and 5),
  label text not null,
  unique (asset_id, level_no)
);

-- selectable values per level (feeds the cascading lists in the app)
create table if not exists public.catalog_options (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.catalog_assets(id) on delete cascade,
  level_no integer not null check (level_no between 2 and 5),
  value text not null,
  unique (asset_id, level_no, value)
);

-- price for each L1..L5 combination (price may be null → inspector types it or skips)
create table if not exists public.catalog_prices (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.catalog_assets(id) on delete cascade,
  l2 text,
  l3 text,
  l4 text,
  l5 text,
  price numeric(14,2),
  raw_price text,
  unique (asset_id, l2, l3, l4, l5)
);

create index if not exists catalog_prices_lookup_idx
  on public.catalog_prices (asset_id, l2, l3, l4, l5);

-- what the inspector picked during an inspection (L1..L6 snapshot)
alter table public.inspections
  add column if not exists catalog_asset_id uuid references public.catalog_assets(id) on delete set null,
  add column if not exists asset_category text,
  add column if not exists l2 text,
  add column if not exists l3 text,
  add column if not exists l4 text,
  add column if not exists l5 text,
  add column if not exists price numeric(14,2),
  add column if not exists price_manual boolean not null default false,
  add column if not exists other_description text;

-- RLS: catalog readable by every signed-in user, writable by admins only
alter table public.catalog_assets enable row level security;
alter table public.catalog_levels enable row level security;
alter table public.catalog_options enable row level security;
alter table public.catalog_prices enable row level security;

create policy "read catalog assets" on public.catalog_assets
  for select to authenticated using (true);
create policy "admin manages catalog assets" on public.catalog_assets
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "read catalog levels" on public.catalog_levels
  for select to authenticated using (true);
create policy "admin manages catalog levels" on public.catalog_levels
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "read catalog options" on public.catalog_options
  for select to authenticated using (true);
create policy "admin manages catalog options" on public.catalog_options
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "read catalog prices" on public.catalog_prices
  for select to authenticated using (true);
create policy "admin manages catalog prices" on public.catalog_prices
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
