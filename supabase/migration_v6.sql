-- ============================================================
-- Road Asset Tracker — v6 migration
-- Inspection photos become Supabase Storage objects (public URL) instead of a
-- base64 blob on the row.
--
-- Uploaded as:  <bucket>/<username>/<marker seq>_<epoch ms>.webp
-- Read back as: https://<project>.supabase.co/storage/v1/object/public/tree-photos/sitechecker1/3_1783477395101.webp
--
-- Run after schema.sql / migration_v2.sql / v3 / v4 / v5 in the Supabase SQL
-- editor. Safe to re-run.
-- ============================================================

-- Public bucket: images load straight from the object URL (no signing needed).
insert into storage.buckets (id, name, public)
values ('tree-photos', 'tree-photos', true)
on conflict (id) do nothing;

-- Anyone can view, signed-in users can upload, uploaders can delete their own.
drop policy if exists "read tree photos" on storage.objects;
create policy "read tree photos" on storage.objects
  for select using (bucket_id = 'tree-photos');

drop policy if exists "upload tree photos" on storage.objects;
create policy "upload tree photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'tree-photos');

drop policy if exists "delete own tree photos" on storage.objects;
create policy "delete own tree photos" on storage.objects
  for delete to authenticated using (bucket_id = 'tree-photos' and owner = auth.uid());

-- Where the photo lives: the URL to display + the object path so the file can be
-- replaced or removed later. (`photo_webp` keeps its old base64 rows working.)
alter table public.inspections
  add column if not exists photo_url text,
  add column if not exists photo_path text;

-- Optional: if you ever stored a full URL in photo_webp (older drafts), copy it
-- across so the new readers pick it up.
update public.inspections
   set photo_url = photo_webp,
       photo_path = coalesce(photo_path, split_part(photo_webp, '/tree-photos/', 2))
 where photo_url is null
   and photo_webp like 'http%';
