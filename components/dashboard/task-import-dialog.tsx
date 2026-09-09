"use client";

import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { parseTaskFile } from "@/lib/import";
import { btnSecondary, inputCls, labelCls } from "@/components/ui";
import type { ImportRow } from "@/lib/import";

interface Result {
  inserted: number;
  updated: number;
  errors: string[];
}

function normalize(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function TaskImportDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  if (!open) return null;

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    setResult(null);
    setRows(null);
    setParseErrors([]);
    setFileName(file.name);
    const buffer = await file.arrayBuffer();
    const parsed = parseTaskFile(buffer);
    setRows(parsed.rows);
    setParseErrors(parsed.errors);
    if (!name) {
      const d = new Date();
      setName(`Task ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`);
    }
  }

  async function typeLookup(): Promise<{ byName: Map<string, string>; fallbackId: string | null }> {
    const { data } = await supabase.from("asset_types").select("id, code, name");
    const byName = new Map<string, string>();
    let fallbackId: string | null = null;
    for (const t of (data ?? []) as { id: string; code: string; name: string }[]) {
      byName.set(normalize(t.name), t.id);
      if (t.code === "UNCAT") fallbackId = t.id;
    }
    return { byName, fallbackId };
  }

  async function runImport() {
    if (!rows || rows.length === 0) return;
    setBusy(true);
    setResult(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const types = await typeLookup();
      const finalName = name.trim() || `Task ${new Date().toISOString().slice(0, 10)}`;

      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .insert({
          name: finalName,
          imported_by: userData.user?.id ?? null,
          row_count: rows.length,
        })
        .select("id")
        .single();
      if (taskError) throw taskError;
      const taskId: string = task?.id ?? "";
      const taskRef = taskId.replace(/-/g, "").slice(0, 8);

      const counts = { inserted: 0, updated: 0, errors: [] as string[] };
      for (let i = 0; i < rows.length; i += 1) {
        const r = rows[i];
        const latN = r.lat;
        const lngN = r.lng;
        const typeId = r.type_text
          ? types.byName.get(normalize(r.type_text)) ?? types.fallbackId ?? null
          : null;
        const payload = {
          seq_no: r.seq_no || null,
          inventory_id: r.inventory_id || null,
          lat: latN,
          lng: lngN,
          price: r.price,
          type_text: r.type_text || null,
          notes: r.remarks || null,
          type_id: typeId,
          task_id: taskId,
        };

        if (r.inventory_id) {
          const { data: existing } = await supabase
            .from("assets")
            .select("id, task_id")
            .eq("inventory_id", r.inventory_id)
            .limit(1);
          if (existing && existing.length > 0) {
            const { error: upErr } = await supabase
              .from("assets")
              .update({
                seq_no: r.seq_no || null,
                lat: latN,
                lng: lngN,
                price: r.price,
                type_text: r.type_text || null,
                notes: r.remarks || null,
                type_id: typeId,
              })
              .eq("id", existing[0].id);
            if (upErr) {
              counts.errors.push(`Row ${r.line}: update failed (${upErr.message}).`);
            } else {
              counts.updated += 1;
            }
            continue;
          }
        }

        const code = r.inventory_id || `${taskRef}-${i + 1}`;
        const { error: inErr } = await supabase.from("assets").insert({
          ...payload,
          code: r.inventory_id ? r.inventory_id : code,
        });
        if (inErr) {
          counts.errors.push(`Row ${r.line}: insert failed (${inErr.message}).`);
        } else {
          counts.inserted += 1;
        }
      }
      setResult(counts);
      if (counts.errors.length === 0) onImported();
    } catch (err) {
      setResult({
        inserted: 0,
        updated: 0,
        errors: [
          err instanceof Error ? err.message : "Import failed unexpectedly.",
        ],
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-950/50 p-4 sm:items-center">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">Import a task</h2>
            <p className="text-xs text-zinc-500">
              Columns: No · ID-Inventory · Position_X(lng) · Position_Y(lat) · Price · Type · Remarks
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <label className={labelCls} htmlFor="task-name">Task name</label>
            <input
              id="task-name"
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Task – District 3 survey"
            />
          </div>

          <div>
            <label className={labelCls}>File (CSV or Excel)</label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center transition-colors hover:border-amber-400 hover:bg-amber-50/40"
            >
              <Upload className="h-8 w-8 text-zinc-400" />
              <span className="text-sm font-semibold text-zinc-700">
                {fileName || "Click to choose a file"}
              </span>
              <span className="text-xs text-zinc-400">
                Download a <span className="text-zinc-500 underline">sample</span> below
              </span>
            </button>
            <a
              href="/sample-task.csv"
              download
              className="mt-2 inline-block text-xs font-semibold text-amber-700 hover:text-amber-600"
            >
              ⬇️ sample-task.csv
            </a>
          </div>

          {rows && rows.length > 0 && !busy && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              ✅ {rows.length} row{rows.length === 1 ? "" : "s"} ready to import.
            </p>
          )}
          {parseErrors.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <p className="font-semibold">Skipped {parseErrors.length} invalid row(s):</p>
              <ul className="mt-1 max-h-28 list-disc overflow-y-auto pl-5 text-xs">
                {parseErrors.slice(0, 8).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {parseErrors.length > 8 && <li>… and {parseErrors.length - 8} more</li>}
              </ul>
            </div>
          )}

          {result && (
            <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm">
              <p className="flex items-center gap-2 font-semibold text-zinc-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                {result.inserted} inserted · {result.updated} updated
              </p>
              {result.errors.length > 0 && (
                <ul className="flex items-start gap-1.5 text-xs text-red-600">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="max-h-24 overflow-y-auto">
                    {result.errors.slice(0, 6).join(" ")}
                    {result.errors.length > 6 ? ` (+${result.errors.length - 6} more)` : ""}
                  </span>
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-100 px-5 py-4">
          <button type="button" onClick={onClose} disabled={busy} className={btnSecondary}>
            Close
          </button>
          <button
            type="button"
            onClick={runImport}
            disabled={busy || !rows || rows.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {busy ? "Importing…" : "Import now"}
          </button>
        </div>
      </div>
    </div>
  );
}
