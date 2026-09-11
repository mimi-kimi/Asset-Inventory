"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  KeyRound,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { cn, fmtDate } from "@/lib/format";
import {
  createInspector,
  deleteUserById,
  resetUserPassword,
  setUserActive,
  updateUserProfile,
  type ActionResult,
} from "@/lib/actions/users";
import { Badge, btnPrimary, btnSecondary, Card, inputCls, labelCls } from "@/components/ui";

export interface UserRow {
  id: string;
  username: string | null;
  full_name: string | null;
  role: string;
  active: boolean;
  email: string | null;
  created_at: string;
  inspections: number;
}

function randomPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 10; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function UsersManager({ rows }: { rows: UserRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    username: "",
    fullName: "",
    password: "",
    mustChange: true,
  });

  const [resetFor, setResetFor] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const [editFor, setEditFor] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ username: "", fullName: "" });

  async function run(action: () => Promise<ActionResult>): Promise<boolean> {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await action();
      if (!res.ok) {
        setError(res.error ?? "Something went wrong.");
        return false;
      }
      setNotice(res.message ?? "Done.");
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  function closeAll() {
    setAddOpen(false);
    setResetFor(null);
    setEditFor(null);
    setError("");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Users</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Create inspectors here. Admins are promoted with SQL only (see the
            README).
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setForm({
              username: "",
              fullName: "",
              password: randomPassword(),
              mustChange: true,
            });
            setError("");
            setNotice("");
            setAddOpen(true);
          }}
          className={btnPrimary}
        >
          <Plus className="h-4 w-4" /> Add inspector
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-5 py-3">User</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Inspections</th>
              <th className="px-5 py-3">Joined</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((u) => (
              <tr
                key={u.id}
                className={cn("hover:bg-zinc-50", !u.active && "opacity-60")}
              >
                <td className="px-5 py-3">
                  <p className="font-semibold text-zinc-900">
                    {u.username ?? "(no username)"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {u.full_name || "—"}
                    {u.email ? ` · ${u.email}` : ""}
                  </p>
                </td>
                <td className="px-5 py-3">
                  {u.role === "ADMIN" ? (
                    <Badge className="bg-amber-100 text-amber-800">
                      <ShieldCheck className="h-3 w-3" /> Admin
                    </Badge>
                  ) : (
                    <Badge className="bg-sky-100 text-sky-800">Inspector</Badge>
                  )}
                </td>
                <td className="px-5 py-3">
                  {u.active ? (
                    <Badge className="bg-emerald-100 text-emerald-800">Active</Badge>
                  ) : (
                    <Badge className="bg-zinc-200 text-zinc-600">Inactive</Badge>
                  )}
                </td>
                <td className="px-5 py-3 text-zinc-600">{u.inspections}</td>
                <td className="px-5 py-3 text-zinc-500">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {fmtDate(u.created_at)}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      title="Edit name / username"
                      onClick={() => {
                        setEditForm({
                          username: u.username ?? "",
                          fullName: u.full_name ?? "",
                        });
                        setError("");
                        setNotice("");
                        setEditFor(u);
                      }}
                      className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="Set a new password"
                      onClick={() => {
                        setNewPassword(randomPassword());
                        setError("");
                        setNotice("");
                        setResetFor(u);
                      }}
                      className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
                    >
                      <KeyRound className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title={u.active ? "Deactivate" : "Reactivate"}
                      disabled={busy}
                      onClick={() => run(() => setUserActive(u.id, !u.active))}
                      className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
                    >
                      {u.active ? (
                        <UserX className="h-4 w-4" />
                      ) : (
                        <UserCheck className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      title={
                        u.inspections > 0
                          ? "Has inspections — deactivate instead"
                          : "Delete user"
                      }
                      disabled={busy || u.inspections > 0}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete "${u.username}"? This cannot be undone.`,
                          )
                        ) {
                          run(() => deleteUserById(u.id));
                        }
                      }}
                      className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-950/50 p-4 sm:items-center">
          <div className="absolute inset-0" onClick={closeAll} />
          <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
              <h2 className="text-lg font-bold text-zinc-900">Add inspector</h2>
              <button
                type="button"
                onClick={closeAll}
                className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div>
                <label className={labelCls} htmlFor="u-username">
                  Username
                </label>
                <input
                  id="u-username"
                  className={inputCls}
                  value={form.username}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, username: e.target.value }))
                  }
                  placeholder="e.g. jdelacruz"
                  autoCapitalize="none"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  They will sign in with this username and password.
                </p>
              </div>
              <div>
                <label className={labelCls} htmlFor="u-name">
                  Full name
                </label>
                <input
                  id="u-name"
                  className={inputCls}
                  value={form.fullName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, fullName: e.target.value }))
                  }
                  placeholder="Juan Dela Cruz"
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="u-pass">
                  Temporary password
                </label>
                <div className="flex gap-2">
                  <input
                    id="u-pass"
                    className={inputCls}
                    value={form.password}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, password: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, password: randomPassword() }))
                    }
                    className={btnSecondary}
                  >
                    Regenerate
                  </button>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={form.mustChange}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, mustChange: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-zinc-300"
                />
                Require a new password on first sign-in
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-4">
              <button type="button" onClick={closeAll} className={btnSecondary}>
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const ok = await run(() =>
                    createInspector({
                      username: form.username,
                      fullName: form.fullName,
                      password: form.password,
                      mustChange: form.mustChange,
                    }),
                  );
                  if (ok) setAddOpen(false);
                }}
                className={btnPrimary}
              >
                {busy ? "Creating…" : "Create inspector"}
              </button>
            </div>
          </div>
        </div>
      )}
      {resetFor && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-950/50 p-4 sm:items-center">
          <div className="absolute inset-0" onClick={closeAll} />
          <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
              <h2 className="text-lg font-bold text-zinc-900">
                Set password · {resetFor.username}
              </h2>
              <button
                type="button"
                onClick={closeAll}
                className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div>
                <label className={labelCls} htmlFor="r-pass">
                  New password
                </label>
                <div className="flex gap-2">
                  <input
                    id="r-pass"
                    className={inputCls}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setNewPassword(randomPassword())}
                    className={btnSecondary}
                  >
                    Regenerate
                  </button>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  They will be asked to change it on their next sign-in.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-4">
              <button type="button" onClick={closeAll} className={btnSecondary}>
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const ok = await run(() =>
                    resetUserPassword(resetFor.id, newPassword),
                  );
                  if (ok) setResetFor(null);
                }}
                className={btnPrimary}
              >
                {busy ? "Saving…" : "Save password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editFor && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-950/50 p-4 sm:items-center">
          <div className="absolute inset-0" onClick={closeAll} />
          <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
              <h2 className="text-lg font-bold text-zinc-900">Edit user</h2>
              <button
                type="button"
                onClick={closeAll}
                className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div>
                <label className={labelCls} htmlFor="e-username">
                  Username
                </label>
                <input
                  id="e-username"
                  className={inputCls}
                  value={editForm.username}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, username: e.target.value }))
                  }
                  autoCapitalize="none"
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="e-name">
                  Full name
                </label>
                <input
                  id="e-name"
                  className={inputCls}
                  value={editForm.fullName}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, fullName: e.target.value }))
                  }
                />
              </div>
              <p className="text-xs text-zinc-500">
                Role changes (admin promotion) are done with SQL — see the README.
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-4">
              <button type="button" onClick={closeAll} className={btnSecondary}>
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const ok = await run(() =>
                    updateUserProfile({
                      userId: editFor.id,
                      username: editForm.username,
                      fullName: editForm.fullName,
                    }),
                  );
                  if (ok) setEditFor(null);
                }}
                className={btnPrimary}
              >
                {busy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
