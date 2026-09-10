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
- **Map dashboard** (desktop): map always visible under the header — colored markers (🔵 not inspected · 🟢 working · 🔴 not working), task selector, total price + asset distribution panel, status panel
- **Mobile app** with 4 tabs — Map · Task · Record · Profile — and a **QR-scanner/manual** inspection flow (plate ID → asset type → working? → remarks)
- **Desktop header “Mobile” button** opens the inspector app; mobile users get
  back to the dashboard from *Profile → Open desktop dashboard*
- Asset catalog with types (signboards, signals, lamps, guardrails, …)
- Row Level Security on every table; photos in a public Supabase bucket

## Project layout

```
app/            routes (dashboard/*, inspect/*, login)
components/     UI primitives, charts, map, forms, wizard
lib/            supabase clients, auth, queries, types, formatting
supabase/schema.sql   one-time database setup
```

## Local setup

1. **Supabase project** — create a free project at supabase.com.
2. **Run the schema** — open *SQL Editor* and run `supabase/schema.sql`,
   then `supabase/migration_v2.sql` (adds tasks + import columns) and
   `supabase/migration_v3.sql` (inspection WebP/base64 photo column).
   A sample import file lives at `public/sample-task.csv`.
3. **Env vars** — copy `.env.example` to `.env.local` and paste your values
   from Supabase → *Project Settings → API*:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
4. **Install & run**
   ```bash
   npm install
   npm run dev
   ```
   Open http://localhost:3000.
5. **First user** — sign up through the app (role = INSPECTOR by default).
   To become an ADMIN, run in the Supabase SQL editor:
   ```sql
   update public.profiles set role = 'ADMIN'
   where id = (select id from auth.users where email = 'YOUR_EMAIL');
   ```
   > Tip: for fast testing, turn **off email confirmation** in Supabase →
   > Authentication → Providers → Email.

## Roles

- **ADMIN** lands on `/dashboard` — full asset CRUD, asset-type manager,
  all inspections, CSV export.
- **INSPECTOR** lands on `/inspect` — record inspections from a phone;
  can also open the dashboard read-only.

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
- **Photo upload fails** — check the `inspection-photos` bucket + its storage
  policies exist.
- **Sign in loops** — email confirmation is on; confirm the email or disable
  confirmation in Supabase Auth settings for development.

## Known limitations (v1/v2)

- No offline mode (field app needs a connection).
- Landings: desktops go to `/dashboard`; phones go to `/mobile` (toggle buttons both ways).
- Import upsert is sequential (fine for typical task sizes).
- Old v1 features (asset CRUD, photo uploads) remain under the dashboard
  manage menu and the legacy `/inspect` routes.
- Role management is via SQL (no admin UI yet).
- Login left panel background image: place any photo at `public/login-bg.jpg`.

