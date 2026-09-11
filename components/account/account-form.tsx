"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { resolveLoginEmail } from "@/lib/auth-username";
import { Badge, btnPrimary, btnSecondary, Card, inputCls, labelCls } from "@/components/ui";
import { SignOutButton } from "@/components/sign-out-button";

export function AccountForm({
  fullName,
  username,
  email,
  role,
  mustChange,
}: {
  fullName: string | null;
  username: string | null;
  email: string | null;
  role: string;
  mustChange: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState(fullName ?? "");
  const [nameBusy, setNameBusy] = useState(false);
  const [nameMsg, setNameMsg] = useState("");

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passBusy, setPassBusy] = useState(false);
  const [passError, setPassError] = useState("");
  const [passMsg, setPassMsg] = useState("");

  async function saveName(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNameBusy(true);
    setNameMsg("");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You are not signed in.");
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: name.trim() || null })
        .eq("id", user.id);
      if (error) throw error;
      setNameMsg("Name saved.");
      router.refresh();
    } catch (err) {
      setNameMsg(err instanceof Error ? err.message : "Could not save your name.");
    } finally {
      setNameBusy(false);
    }
  }

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPassError("");
    setPassMsg("");
    if (next.length < 6) {
      setPassError("New password must be at least 6 characters.");
      return;
    }
    if (next !== confirm) {
      setPassError("The new passwords do not match.");
      return;
    }
    setPassBusy(true);
    try {
      const signInEmail = username ? resolveLoginEmail(username) : email ?? "";
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: signInEmail,
        password: current,
      });
      if (verifyError) throw new Error("Your current password is incorrect.");

      const { error: updateError } = await supabase.auth.updateUser({
        password: next,
      });
      if (updateError) throw updateError;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({ must_change_password: false })
          .eq("id", user.id);
      }

      setCurrent("");
      setNext("");
      setConfirm("");
      setPassMsg("Password changed.");
      router.refresh();
    } catch (err) {
      setPassError(
        err instanceof Error ? err.message : "Could not change the password.",
      );
    } finally {
      setPassBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {mustChange && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          🔐 Please choose a new password before continuing.
        </p>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-zinc-900">
              {name || "User"}
            </p>
            <p className="truncate text-sm text-zinc-500">
              {username ? `@${username}` : email}
            </p>
          </div>
          {role === "ADMIN" ? (
            <Badge className="bg-amber-100 text-amber-800">Admin</Badge>
          ) : (
            <Badge className="bg-sky-100 text-sky-800">Inspector</Badge>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <form onSubmit={saveName} className="space-y-3">
          <h2 className="text-sm font-bold text-zinc-900">Your details</h2>
          <div>
            <label className={labelCls} htmlFor="acc-name">
              Full name
            </label>
            <input
              id="acc-name"
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Juan Dela Cruz"
            />
          </div>
          <p className="text-xs text-zinc-500">
            Username changes are handled by an administrator.
          </p>
          {nameMsg && (
            <p className="flex items-center gap-1.5 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> {nameMsg}
            </p>
          )}
          <button type="submit" disabled={nameBusy} className={btnPrimary}>
            {nameBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save name
          </button>
        </form>
      </Card>

      <Card className="p-5">
        <form onSubmit={changePassword} className="space-y-3">
          <h2 className="text-sm font-bold text-zinc-900">Change password</h2>
          <div>
            <label className={labelCls} htmlFor="acc-current">
              Current password
            </label>
            <input
              id="acc-current"
              type="password"
              className={inputCls}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="acc-new">
                New password
              </label>
              <input
                id="acc-new"
                type="password"
                className={inputCls}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="acc-confirm">
                Confirm new password
              </label>
              <input
                id="acc-confirm"
                type="password"
                className={inputCls}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
          </div>
          {passError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {passError}
            </p>
          )}
          {passMsg && (
            <p className="flex items-center gap-1.5 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> {passMsg}
            </p>
          )}
          <button type="submit" disabled={passBusy} className={btnPrimary}>
            {passBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Change password
          </button>
        </form>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <SignOutButton compact={false} />
        <button
          type="button"
          onClick={() => router.push("/")}
          className={btnSecondary}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
