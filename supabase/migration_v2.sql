-- ============================================================
-- Road Asset Tracker — v2 migration (tasks + map dashboard)
-- Run this after supabase/schema.sql in the Supabase SQL editor.
-- Safe to re-run.
-- ============================================================

-- Task batches imported from CSV/Excel (survey work orders)
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  imported_by uuid references auth.users(id) on delete set null,
  row_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- Extend assets with task/import metadata
alter table public.assets
  add column if not exists task_id uuid references public.tasks(id) on delete cascade,
  add column if not exists seq_no text,
  add column if not exists inventory_id text,
  add column if not exists price numeric(14,2),
  add column if not exists type_text text;

create unique index if not exists assets_inventory_id_key
  on public.assets (inventory_id) where inventory_id is not null;

create index if not exists assets_task_idx on public.assets (task_id);
create index if not exists assets_lat_lng_idx on public.assets (lat, lng);

-- Fallback asset type used for imported rows until an inspector
-- confirms the real type on site.
insert into public.asset_types (code, name, icon)
values ('UNCAT', 'Uncategorised', '📦')
on conflict (code) do nothing;

-- RLS for tasks: every signed-in user can see tasks; only admins create/delete
alter table public.tasks enable row level security;

create policy "read tasks"
  on public.tasks for select to authenticated
  using (true);

create policy "admin inserts tasks"
  on public.tasks for insert to authenticated
  with check (public.is_admin());

create policy "admin updates tasks"
  on public.tasks for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "admin deletes tasks"
  on public.tasks for delete to authenticated
  using (public.is_admin());
