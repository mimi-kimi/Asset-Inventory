-- ============================================================
-- Road Asset Tracker — Supabase schema
-- Run this whole script in: Supabase Dashboard → SQL Editor
-- ============================================================

create extension if not exists pgcrypto;

-- Lookup: what kind of asset is it?
create table if not exists public.asset_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  icon text,
  created_at timestamptz not null default now()
);

-- Assets (signboards, signals, lamps, ...)
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type_id uuid not null references public.asset_types(id) on delete restrict,
  location text,
  lat double precision,
  lng double precision,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  photo_url text,
  installed_date date,
  notes text,
  created_at timestamptz not null default now()
);

-- Field inspection reports
create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  inspector_id uuid not null references auth.users(id) on delete cascade,
  inspected_at timestamptz not null default now(),
  condition text not null check (
    condition in ('GOOD', 'FAIR', 'POOR', 'DAMAGED', 'NOT_FUNCTIONAL')
  ),
  functional boolean not null default true,
  remarks text,
  created_at timestamptz not null default now()
);

create index if not exists inspections_asset_idx on public.inspections (asset_id);
create index if not exists inspections_inspector_idx on public.inspections (inspector_id);
create index if not exists inspections_inspected_at_idx on public.inspections (inspected_at desc);

-- Photos attached to an inspection
create table if not exists public.inspection_photos (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  photo_url text not null,
  created_at timestamptz not null default now()
);

-- Profiles mirror auth.users (created automatically on sign-up)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'INSPECTOR' check (role in ('ADMIN', 'INSPECTOR')),
  created_at timestamptz not null default now()
);

-- auto-create a profile row whenever a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- helper: is the current user an ADMIN?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'ADMIN'
  );
$$;

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table public.asset_types enable row level security;
alter table public.assets enable row level security;
alter table public.inspections enable row level security;
alter table public.inspection_photos enable row level security;
alter table public.profiles enable row level security;

-- asset_types: read for signed-in users; only admins write
create policy "read asset types"
  on public.asset_types for select to authenticated
  using (true);
create policy "admin manages asset types"
  on public.asset_types for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- assets: read for all; field workers can register new assets
-- during an inspection; editing/removing is admin-only
create policy "read assets"
  on public.assets for select to authenticated
  using (true);
create policy "register assets in the field"
  on public.assets for insert to authenticated
  with check (true);
create policy "admin manages assets"
  on public.assets for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin deletes assets"
  on public.assets for delete to authenticated
  using (public.is_admin());

-- inspections: read own (or any as admin); write your own only
create policy "read inspections"
  on public.inspections for select to authenticated
  using (public.is_admin() or inspector_id = auth.uid());
create policy "submit inspections"
  on public.inspections for insert to authenticated
  with check (inspector_id = auth.uid());
create policy "update own inspections"
  on public.inspections for update to authenticated
  using (inspector_id = auth.uid()) with check (inspector_id = auth.uid());
create policy "delete own inspections"
  on public.inspections for delete to authenticated
  using (inspector_id = auth.uid());

-- inspection_photos: visible with the parent inspection
create policy "read inspection photos"
  on public.inspection_photos for select to authenticated
  using (
    public.is_admin() or exists (
      select 1 from public.inspections i
      where i.id = inspection_id and i.inspector_id = auth.uid()
    )
  );
create policy "insert inspection photos"
  on public.inspection_photos for insert to authenticated
  with check (
    exists (
      select 1 from public.inspections i
      where i.id = inspection_id and i.inspector_id = auth.uid()
    )
  );

-- profiles: read/update yourself (role changes are made by an admin via SQL)
create policy "read own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id or public.is_admin());
create policy "update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- ------------------------------------------------------------
-- Public storage bucket for photos
-- (Public bucket: images load directly from a public URL.)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('inspection-photos', 'inspection-photos', true)
on conflict (id) do nothing;

create policy "public can view inspection photos"
  on storage.objects for select
  using (bucket_id = 'inspection-photos');

create policy "authenticated users can upload inspection photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'inspection-photos');

create policy "owners can delete their uploaded photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'inspection-photos' and owner = auth.uid());

-- ------------------------------------------------------------
-- Seed the default catalog of road assets
-- ------------------------------------------------------------
insert into public.asset_types (code, name, icon) values
  ('TS',  'Traffic Signboard', '🪧'),
  ('TL',  'Traffic Light',     '🚦'),
  ('SL',  'Stop Light',        '🚥'),
  ('RL',  'Road Lamp',         '💡'),
  ('GR',  'Guardrail',         '🛡️'),
  ('DN',  'Delineator',        '🪣'),
  ('RM',  'Road Marking',      '➖')
on conflict (code) do nothing;

-- ------------------------------------------------------------------
-- AFTER creating your account:
--   1) sign up through the app (you start as an INSPECTOR)
--   2) promote yourself to admin by running:
--      update public.profiles set role = 'ADMIN'
--      where id = (select id from auth.users where email = 'YOUR_EMAIL');
-- ------------------------------------------------------------------


