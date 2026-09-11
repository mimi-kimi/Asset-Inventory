-- ============================================================
-- Road Asset Tracker — v4 migration
-- Username-based login, admin-managed users
-- Run after schema.sql / v2 / v3 in the Supabase SQL editor.
-- ============================================================

alter table public.profiles
  add column if not exists username text,
  add column if not exists email text,
  add column if not exists active boolean not null default true,
  add column if not exists must_change_password boolean not null default false;

-- usernames are unique (case-insensitive)
create unique index if not exists profiles_username_key
  on public.profiles (lower(username))
  where username is not null;

-- keep the signup trigger in sync (username may come from user metadata)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, username, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(lower(coalesce(new.raw_user_meta_data ->> 'username', '')), ''),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- backfill the technical email for profiles that already exist
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and (p.email is null or p.email = '');

-- admins may update any profile (name / username / active / role)
create policy "admin updates profiles"
  on public.profiles for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------------
-- NOTE: admins are created/promoted with SQL only, e.g.
--   update public.profiles set role = 'ADMIN' where username = 'your-name';
-- ------------------------------------------------------------------
