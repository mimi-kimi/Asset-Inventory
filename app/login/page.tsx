import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const viewer = await getViewer();
  if (viewer) {
    redirect(viewer.profile.role === "ADMIN" ? "/dashboard" : "/inspect");
  }

  return (
    <main className="flex min-h-dvh">
      {/* Left marketing panel — hidden on small screens (inspectors log in on phones) */}
      <section className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-zinc-950 p-10 text-zinc-200 lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-amber-500/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl"
        />
        <div className="relative">
          <div className="flex items-center gap-2 text-lg font-bold text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-xl text-zinc-950">
              🚸
            </span>
            Road Asset Tracker
          </div>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-3xl font-bold leading-tight text-white">
            Inventory &amp; inspection for the assets that keep roads safe.
          </h1>
          <ul className="mt-6 space-y-3 text-sm text-zinc-300">
            <li>🪧 Traffic signboards, 🚦 traffic lights &amp; stop lights</li>
            <li>💡 Road lamps and other street furniture</li>
            <li>📱 On-site inspections from a phone camera + GPS</li>
            <li>📊 Desktop dashboard with maps, charts and reports</li>
          </ul>
        </div>
        <p className="relative text-xs text-zinc-500">
          Powered by Next.js · Supabase · Vercel
        </p>
      </section>

      {/* Form panel */}
      <section className="flex w-full flex-col items-center justify-center bg-zinc-100 px-4 py-10 sm:px-8 lg:max-w-xl">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-xl text-zinc-950">
              🚸
            </span>
            <div>
              <p className="font-bold text-zinc-900">Road Asset Tracker</p>
              <p className="text-xs text-zinc-500">Inventory &amp; inspection</p>
            </div>
          </div>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
