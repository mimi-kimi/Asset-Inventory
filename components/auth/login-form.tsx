"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { resolveLoginEmail } from "@/lib/auth-username";
import { btnPrimary, inputCls, labelCls } from "@/components/ui";

export function LoginForm() {
  const configured = isSupabaseConfigured();
  return configured ? <AuthCard /> : <SetupNotice />;
}

function SetupNotice() {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
      <p className="flex items-center gap-2 font-semibold">
        <AlertCircle className="h-4 w-4" /> Supabase is not configured yet
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5">
        <li>Create a free project at supabase.com</li>
        <li>
          Run <code className="rounded bg-amber-100 px-1">supabase/schema.sql</code>{" "}
          and the migrations in the SQL editor
        </li>
        <li>
          Copy your Project URL &amp; anon key into{" "}
          <code className="rounded bg-amber-100 px-1">.env.local</code>
        </li>
        <li>Restart the dev server and reload this page</li>
      </ol>
    </div>
  );
}

function AuthCard() {
  const router = useRouter();
  const supabase = createClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: resolveLoginEmail(username),
        password,
      });
      if (signInError) throw signInError;
      router.refresh();
      router.push("/");
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      setError(
        /invalid login credentials/i.test(raw)
          ? "Wrong username or password."
          : raw || "Could not sign in. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">Sign in</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Use the username and password given to you by your administrator.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className={labelCls} htmlFor="username">
            Username
          </label>
          <input
            id="username"
            className={inputCls}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. jdelacruz"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            required
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className={inputCls}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </div>

        {error && (
          <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className={`${btnPrimary} w-full py-2.5`}
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Sign in
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-zinc-400">
        Accounts are created by an administrator — ask your admin if you need
        access.
      </p>
    </div>
  );
}
