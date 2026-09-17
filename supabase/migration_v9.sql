-- ============================================================
-- Road Asset Tracker — v9 migration
--
-- Admins are now created and promoted from Dashboard → Users, so the database
-- must refuse self-service role changes. Without this, any signed-in user could
-- promote themselves with a client call like
--   update public.profiles set role = 'ADMIN' where id = auth.uid();
-- (the "update own profile" policy allows the row, not the column).
--
-- Run after schema.sql / migration_v2..v8. Safe to re-run.
-- ============================================================

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role
     or new.active is distinct from old.active then
    -- allowed for: an admin using the app, the service-role key (the server
    -- actions in Dashboard → Users) and direct SQL (SQL editor / psql), where
    -- there is no request user at all.
    if not (
      public.is_admin()
      or coalesce(auth.role(), '') = 'service_role'
      or (auth.uid() is null and auth.role() is null)
    ) then
      raise exception
        'Only an administrator can change a role or the active flag.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();

-- To undo this hardening:
--   drop trigger if exists protect_profile_privileges on public.profiles;
