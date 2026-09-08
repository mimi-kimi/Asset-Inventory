"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { AssetType } from "@/lib/types";
import {
  btnPrimary,
  btnSecondary,
  FieldLabel,
  inputCls,
} from "@/components/ui";

export function AssetTypeManager({
  initial,
}: {
  initial: AssetType[];
}) {
  const supabase = createClient();
  const [types, setTypes] = useState<AssetType[]>(initial);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [icon, setIcon] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function addType(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!name.trim() || !code.trim()) {
      setError("Name and code are required.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("asset_types")
        .insert({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          icon: icon.trim() || null,
        })
        .select("id, code, name, icon, created_at")
        .single();
      if (error) throw error;
      setTypes((prev) => [...prev, data as AssetType].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      setCode("");
      setIcon("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add type.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteType(id: string) {
    if (!window.confirm("Delete this asset type? Assets using it must be re-typed first.")) return;
    try {
      const { error } = await createClient().from("asset_types").delete().eq("id", id);
      if (error) throw error;
      setTypes((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div>
        <form onSubmit={addType} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-zinc-900">Add an asset type</h2>
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <div>
            <FieldLabel htmlFor="type-name" required>Name</FieldLabel>
            <input id="type-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Road lamp" />
          </div>
          <div>
            <FieldLabel htmlFor="type-code" required>Code prefix</FieldLabel>
            <input id="type-code" className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. RL" />
          </div>
          <div>
            <FieldLabel htmlFor="type-icon">Icon (emoji)</FieldLabel>
            <input id="type-icon" className={inputCls} value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="e.g. 💡" maxLength={4} />
          </div>
          <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
            <Plus className="h-4 w-4" /> Add type
          </button>
        </form>
      </div>

      <div className="lg:col-span-2">
        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm">
          {types.length === 0 && (
            <li className="px-5 py-10 text-center text-sm text-zinc-500">
              No asset types yet — add your first one.
            </li>
          )}
          {types.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-5 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-lg">
                {t.icon ?? "🏷️"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-zinc-900">{t.name}</p>
                <p className="text-xs text-zinc-500">
                  Prefix <code className="rounded bg-zinc-100 px-1">{t.code}</code>
                </p>
              </div>
              <button
                type="button"
                onClick={() => deleteType(t.id)}
                className={`${btnSecondary} border-transparent px-2 py-2 text-red-600 hover:bg-red-50`}
                title={`Delete ${t.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
