# 🚸 Road Asset Tracker

Inventory & inspection system for road assets — traffic signboards, traffic
lights, stop lights, road lamps and more.

- **Desktop** → a dashboard for managing assets, reviewing field reports,
  charts and a map.
- **Mobile** → a fast 3-step inspection flow with camera + GPS capture.

## Stack

| Layer    | Tech                                        |
| -------- | ------------------------------------------- |
| Frontend | Next.js (App Router) · React · Tailwind CSS |
| Backend  | Supabase (Postgres + Auth + RLS + Storage)  |
| Hosting  | Vercel (free Hobby plan, custom domain)     |

## Features

- Email/password auth with two roles: **ADMIN** and **INSPECTOR**
- **Tasks page** (`/dashboard/tasks`): import CSV/Excel batches + list all imported tasks with progress
- **Task import** (CSV/Excel): `No, ID-Inventory, Position_X(lng), Position_Y(lat), Price, Type, Remarks`
- **CSV export** (mobile *Task* tab and the dashboard *Tasks* page): the inspected markers **or the full report history** — columns: `No · ID-Inventory · Photo URL · Latitude · Longitude · Category · L2 · L3 · L4 · L5 · Catalog path · Lain-lain · Price · Condition · Working · Remarks · Inspected at`
- **Map dashboard** (desktop): map always visible under the header — colored markers (🔵 not inspected · 🟢 working · 🔴 not working), task selector, total price + asset distribution panel, status panel
- **Mobile app** with 4 tabs — Map · Task · Record · Profile — and a **QR-scanner/manual** inspection flow: ID-Inventory → photo → **asset → its values per level → price** (from the catalog, optional override) → **working? and condition (Good / Fair / Bad)** → remarks
- **Asset catalog** (`/dashboard/catalog`, admin): manage each asset, give it the named levels it needs (`KETERANGAN · ARM · WATT · TIANG`, or just `AMP` for a feeder pillar), edit the values and the price of each combination; importing the *Aset perabot jalan* sheet is a helper that only adds what is missing
- **Desktop header “Mobile” button** opens the inspector app; mobile users get
  back to the dashboard from *Profile → Open desktop dashboard*
- Row Level Security on every table; inspection photos are downscaled WebP files in a public Supabase Storage bucket, and the row keeps the public URL

## Project layout

```
app/            routes (dashboard/*, mobile/*, login)
components/     UI primitives, charts, map, forms, catalog editor
lib/            supabase clients, auth, queries, types, formatting,
                catalog-tree.ts (asset → levels → options tree + price walk),
                catalog-merge.ts (insert-only Excel merge planner),
                storage.ts (inspection photo uploads)
supabase/schema.sql   one-time database setup
```

## Local setup

1. **Supabase project** — create a free project at supabase.com.
2. **Run the schema** — open *SQL Editor* and run, in order:
   `supabase/schema.sql`, `supabase/migration_v2.sql` (tasks + import columns),
   `supabase/migration_v3.sql` (inspection photo column),
   `supabase/migration_v4.sql` (username login + admin-managed users) and
   `supabase/migration_v5.sql` (asset catalog + inspection snapshot columns),
   `supabase/migration_v6.sql` (photo bucket + photo_url/photo_path),
   `supabase/migration_v7.sql` (retire the old asset types) and
   `supabase/migration_v8.sql` (condition = Good / Fair / Bad).
   A sample import file lives at `public/sample-task.csv`.
3. **Disable self sign-up** — Supabase → *Authentication → Providers → Email* →
   turn **off** "Allow new users to sign up". Accounts are created by admins only.
4. **Env vars** — copy `.env.example` to `.env.local` and paste your values
   from Supabase → *Project Settings → API*:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # server-only, admin user management
   NEXT_PUBLIC_AUTH_EMAIL_DOMAIN=assets.local        # optional
   ```
5. **Install & run**
   ```bash
   npm install
   npm run dev
   ```
   Open http://localhost:3000.
6. **Create the first admin** (one time):
   - Supabase → *Authentication → Users → Add user* → enter any email + password,
     tick "Auto confirm".
   - Then in the SQL editor, give that account a username and the ADMIN role:
     ```sql
     update public.profiles
     set username = 'admin', role = 'ADMIN'
     where id = (select id from auth.users where email = 'YOUR_EMAIL');
     ```
   - Sign in with username `admin` + that password. From then on, create every
     other account from **Dashboard → Users**.

## Roles

- **ADMIN** lands on `/dashboard` — map, tasks & import, inspections, the asset
  catalog, user management.
- **INSPECTOR** lands on `/mobile` — record inspections from a phone; can also
  open the dashboard read-only.

## User management

Sign-in is **username + password** (no email needed). Behind the scenes the app
maps `username` → `username@<NEXT_PUBLIC_AUTH_EMAIL_DOMAIN>` for Supabase Auth.

- **Inspectors** — Dashboard → **Users** → *Add inspector* (username, full name,
  temporary password, optional "must change password"). You can also reset
  passwords, deactivate/reactivate, edit names and delete accounts there.
- **Admins** — created/promoted with **SQL only** (deliberately, so admin rights
  can't be handed out by accident from the UI):

```sql
-- promote to admin
update public.profiles set role = 'ADMIN' where username = 'juan';

-- demote back to inspector
update public.profiles set role = 'INSPECTOR' where username = 'juan';

-- list everyone
select username, full_name, role, active, email, must_change_password
from public.profiles order by role desc, username;
```

- Users sign in and can change their own **name and password** at `/account`
  (also linked from the mobile Profile tab). If `must_change_password` is set,
  they are redirected there right after signing in.
- Deleting a user is blocked when they already have inspection records —
  **deactivate** them instead (they can no longer sign in).

### Create an admin entirely with SQL (optional)

> Supabase's own dashboard (*Authentication → Users → Add user*) is the safest
> way, but you can do it in SQL too — this is what the Admin API does internally.

```sql
-- 1) create the auth user with a bcrypt-hashed password
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@assets.local',
  extensions.crypt('ChangeMe123', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Administrator","username":"admin"}'::jsonb,
  now(), now(), '', '', '', ''
)
on conflict (email) do nothing;

-- 2) link the email identity (needed for email/password sign-in)
insert into auth.identities (
  id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, provider_id
)
select
  gen_random_uuid(), u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', now(), now(), now(), u.email
from auth.users u
where u.email = 'admin@assets.local'
on conflict do nothing;

-- 3) make sure the profile is ADMIN with the username you want
update public.profiles p
set username = 'admin', role = 'ADMIN'
from auth.users u
where u.id = p.id and u.email = 'admin@assets.local';
```

Sign in with username `admin` + password `ChangeMe123` (then change it in
`/account`). To reset any password with SQL later:

```sql
update auth.users
set encrypted_password = extensions.crypt('NewPassword123', extensions.gen_salt('bf')),
    updated_at = now()
where email = 'admin@assets.local';
```

*Older Supabase projects may not have the `provider_id` column on
`auth.identities` — if the statement errors about it, delete that column from
the insert list.*

## Asset catalog

`supabase/migration_v5.sql` adds three tables plus the matching snapshot columns
on `inspections`, so the catalog is data you manage in the app:

```
catalog_assets   the assets — 'LAMPU JALAN', 'KIOSK', … (+ the price heading, e.g. "HARGA")
catalog_levels   the named levels an asset uses, in order (as many as it needs)
catalog_options  the value tree: parent_id links a value to the one above it
                 the price sits on the value that ENDS a combination
```

Design points:

- **Depth is per asset.** A feeder pillar only needs `AMP`; a lamp might use
  `KETERANGAN → ARM → WATT → TIANG`. Levels are shown by name — no "L2/L3…"
  numbering anywhere in the UI.
- **The price belongs to the ending value** (the sheet's `HARGA` column): the
  last value of a combination is the only row with a price box, so one
  combination = one price. Intermediate values carry no price.
- Each asset has a **price heading** (defaults to `HARGA`, editable) that labels
  the price column in the catalog and the price box on the phone.
- **Read = any signed-in user, write = admins** (`public.is_admin()`).

### Managing it — Dashboard → Catalog
- Every asset is listed with a **price sheet**: one row per combination, a column
  per level and the price in the last column — the same shape as the spreadsheet
  (`KETERANGAN | ARM | WATT | TIANG | HARGA`). Type in the price cell and press
  **Save**; empty means *no price* (the inspector types it or skips it).
- **Edit** (per asset) opens `/dashboard/catalog/<id>` for the structure: rename
  the asset, change its price heading, add/rename/remove levels, add values under
  a chosen parent, delete values and multi-line entry (`8M | 8500`, `GAL 12000` …).
  The same price sheet sits underneath.
- **Import Excel** is a *helper, not a reset*: matching assets (by name), levels
  (by number) and values (by parent + value) are **skipped**, only missing rows
  are inserted, and prices are only written on those new rows unless you tick
  *also refresh the price of existing rows*. The preview lists exactly what would
  be added vs. skipped, so importing the same sheet twice changes nothing. It
  also picks up each block's price heading from the sheet.
- Deleting catalog rows never touches recorded inspections: each inspection keeps
  its own snapshot (`catalog_path` with labels + values, `l2`…`l6`, `price`,
  `price_manual`, `other_description`).

### On the phone
The **Asset** step shows the asset buttons → chips for each level the asset defines
(titled with the level's name) → a single price box labelled with the asset's
price heading (`HARGA`). A price is **skipped by default**: leave the box empty,
or type a number to override/fill it. Anything not in the catalog is recorded
through **Lain-lain** with a manual description and optional price.

The last step records the **working / not working** status, then the **condition**
(**Good · Fair · Bad**, default Good) and free-text remarks. Older records that used
the previous five-value scale are folded onto Good/Fair/Bad when they are opened.

### Re-inspecting a marker
Nobody re-types a marker from scratch. Tapping a marker that already has a report
opens a drawer with two actions:

| Drawer action | What it does |
| --- | --- |
| **Edit this report** | opens the newest report for that marker with every answer already in place — photo, catalog chips, price, working, condition, remarks — and **updates that same row** (`Save changes`) |
| **Add a new report** | only for markers never inspected, or when a fresh visit must be kept next to the old one: the new form is **pre-filled from the last report**, saves as a new row, and the earlier report stays in the history |

Either way the **ID step is skipped** and the wizard starts on the **Photo** step
(the earlier photo is shown, so it is only changed if needed), with a banner saying
where the values came from. The **Record** tab's list and the desktop drawer keep
the same behaviour — a saved photo is never deleted while an older report still
points at it.

Prices show up in the map drawer, the inspections list, the mobile records list
and the CSV exports (the drawer and lists tag a price that was typed on site as
`manual`).

## Inspection photos

The phone's **Photo** step shrinks the snapshot to a **1280 px WebP** (quality 0.7,
~100 KB) and uploads it to Storage; the record stores the object's **public URL**:

```
tree-photos/<username>/<marker seq>_<epoch ms>.webp
https://<project>.supabase.co/storage/v1/object/public/tree-photos/sitechecker1/3_1783477395101.webp
```

- `supabase/migration_v6.sql` creates the bucket + policies and adds
  `inspections.photo_url` / `photo_path`.
- Bucket name comes from `NEXT_PUBLIC_PHOTO_BUCKET` (default `tree-photos`); the
  username folder is the signed-in inspector's `profiles.username` and the number
  is the marker's `seq_no`.
- The bucket is public (anyone with the link can view), uploads require a signed-in
  user and only the uploader can delete. Replacing or removing a photo deletes the
  old object.
- Records saved before this change keep their base64 `photo_webp`; the UI prefers
  `photo_url` when both exist, so nothing has to be migrated to keep working.

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. In Vercel → *Add New → Project* → import the repo (framework auto-detects
   Next.js). No build settings to change.
3. Add the two environment variables from `.env.local` to the project.
4. Deploy. On the free Hobby plan you can attach your own domain under
   *Project → Settings → Domains* (no cost, no PHP involved 😉).

## Troubleshooting

- **“relation does not exist” / permission errors** — the `schema.sql` script
  was not run (or RLS was changed). Re-run it.
- **Photo upload fails** — check the `tree-photos` bucket + its storage policies
  exist (run `supabase/migration_v6.sql`).
- **Sign in loops** — email confirmation is on; confirm the email or disable
  confirmation in Supabase Auth settings for development.

## Known limitations (v1/v2)

- No offline mode (field app needs a connection).
- Landings: desktops go to `/dashboard`; phones go to `/mobile` (toggle buttons both ways).
- Import upsert is sequential (fine for typical task sizes).
- The old asset CRUD, the asset-type manager and the legacy `/inspect` routes are
  gone — the catalog page manages the categories/values and the mobile app
  records the inspections (run `supabase/migration_v7.sql` to retire the old
  `asset_types` table).
- Role management is via SQL (no admin UI yet).
- The catalog lives in Supabase: build it in the app or import the sheet once —
  the phone form needs a connection to read it (prices fall back to "skipped"
  if the fetch fails).
- Login left panel background image: place any photo at `public/login-bg.jpg`.

