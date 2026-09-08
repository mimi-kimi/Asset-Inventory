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
- Asset catalog with types (signboards, signals, lamps, guardrails, …)
- Field inspections: pick or register an asset → rate condition →
  functional? → remarks → up to 4 photos → GPS coordinates
- Desktop dashboard: KPI cards, charts (Recharts), Leaflet map, searchable
  asset/inspection tables, CSV export
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
2. **Run the schema** — open *SQL Editor* and run everything in
   `supabase/schema.sql` (creates tables, RLS, storage bucket + seed types).
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

## Known limitations (v1)

- No offline mode (field app needs a connection).
- Asset photos are optional single-image; inspection photos up to 4.
- Role management is via SQL (no admin UI yet).

