"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { btnPrimary, inputCls, labelCls } from "@/components/ui";

type Mode = "signin" | "signup";

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
          Open the SQL editor and run the script in{" "}
          <code className="rounded bg-amber-100 px-1">supabase/schema.sql</code>
        </li>
        <li>
          Copy your Project URL &amp; anon key into{" "}
          <code className="rounded bg-amber-100 px-1">.env.local</code> (see{" "}
          <code className="rounded bg-amber-100 px-1">.env.example</code>)
        </li>
        <li>Restart the dev server and reload this page</li>
      </ol>
    </div>
  );
}

function AuthCard() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setNotice("");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName.trim() || null },
            emailRedirectTo: `${window.location.origin}/login`,
          },
        });
        if (error) throw error;
        if (data.session) {
          router.refresh();
          router.push("/");
        } else if (data.user) {
          setNotice(
            "Account created! Check your inbox and confirm your email, then sign in.",
          );
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.refresh();
        router.push("/");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">
        {mode === "signin" ? "Welcome back" : "Create an account"}
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        {mode === "signin"
          ? "Sign in to your dashboard or inspector app."
          : "New inspectors are created with the INSPECTOR role."}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {mode === "signup" && (
          <div>
            <label className={labelCls} htmlFor="full-name">
              Full name
            </label>
            <input
              id="full-name"
              className={inputCls}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Juan Dela Cruz"
              autoComplete="name"
              required
            />
          </div>
        )}
        <div>
          <label className={labelCls} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className={inputCls}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
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
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={6}
            required
          />
        </div>

        {error && (
          <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className={`${btnPrimary} w-full py-2.5`}
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        {mode === "signin" ? "New inspector?" : "Already have an account?"}{" "}
        <button
          type="button"
          onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
          className="font-semibold text-amber-700 hover:text-amber-600"
        >
          {mode === "signin" ? "Create an account" : "Sign in instead"}
        </button>
      </p>
    </div>
  );
}