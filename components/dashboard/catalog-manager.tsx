"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Package, Save, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { parseCatalogFile, flattenToPriceRows } from "@/lib/catalog-import";
import type { FlatCatalogImport } from "@/lib/catalog-import";
import { CATALOG_ASSETS, CATALOG_META, levelsOf } from "@/lib/catalog-data";
import { describeError } from "@/lib/format";
import type { CatalogPrice } from "@/lib/types";
import { btnPrimary, btnSecondary, Card, EmptyState, inputCls } from "@/components/ui";

interface ImportReport {
  rows: number;
  priced: number;
  missing: number;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function rowKey(assetKey: string, parts: (string | null | undefined)[]): string {
  return [assetKey, ...parts.map((p) => p ?? "")].join("|");
}

export function CatalogManager({ prices }: { prices: CatalogPrice[] }) {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [flat, setFlat] = useState<FlatCatalogImport | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [report, setReport] = useState<ImportReport | null>(null);

  /** unsaved price inputs, keyed by rowKey() */
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [savingRow, setSavingRow] = useState("");
  const [savedRow, setSavedRow] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [search, setSearch] = useState("");

  const groups = useMemo(() => {
    const byAsset = new Map<string, CatalogPrice[]>();
    for (const row of prices) {
      const list = byAsset.get(row.asset_key) ?? [];
      list.push(row);
      byAsset.set(row.asset_key, list);
    }
    return CATALOG_ASSETS.map((asset) => {
      const rows = [...(byAsset.get(asset.key) ?? [])].sort((a, b) =>
        [a.l2, a.l3, a.l4, a.l5].join("|").localeCompare([b.l2, b.l3, b.l4, b.l5].join("|")),
      );
      const priced = rows.filter((r) => r.price !== null).length;
      return { asset, rows, priced };
    });
  }, [prices]);

  const totalRows = groups.reduce((n, g) => n + g.rows.length, 0);
  const totalPriced = groups.reduce((n, g) => n + g.priced, 0);
  const untracked = prices.filter(
    (p) => !CATALOG_ASSETS.some((a) => a.key === p.asset_key),
  ).length;

  const needle = search.trim().toLowerCase();

  async function handleFile(file: File | null | undefined) {
    if (!file) return;
    setError("");
    setNotice("");
    setReport(null);
    setFileName(file.name);
    try {
      const result = await parseCatalogFile(await file.arrayBuffer());
      setFlat(flattenToPriceRows(result));
    } catch (err) {
      setError(describeError(err, "Could not read that file."));
      setFlat(null);
    }
  }

  async function runImport() {
    if (!flat || flat.rows.length === 0) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { error: delError } = await supabase
        .from("catalog_prices")
        .delete()
        .not("id", "is", null);
      if (delError) throw delError;

      for (const part of chunk(flat.rows, 500)) {
        const { error: insError } = await supabase.from("catalog_prices").insert(part);
        if (insError) throw insError;
      }

      setReport({
        rows: flat.rows.length,
        priced: flat.pricedCount,
        missing: flat.missingPriceCount,
      });
      setNotice("Prices imported.");
      setFlat(null);
      setFileName("");
      setEdits({});
      router.refresh();
    } catch (err) {
      setError(describeError(err, "Could not import the prices."));
    } finally {
      setBusy(false);
    }
  }

  async function saveRow(row: CatalogPrice, key: string) {
    const raw = (edits[key] ?? "").trim();
    const cleaned = raw.replace(/[^0-9.\-]/g, "");
    const value =
      raw === "" ? null : Number.isFinite(Number(cleaned)) ? Number(cleaned) : NaN;
    if (Number.isNaN(value)) {
      setError("Prices must be numbers (or empty to clear).");
      return;
    }

    setSavingRow(key);
    setError("");
    setNotice("");
    try {
      const { error: upError } = await supabase.from("catalog_prices").upsert(
        {
          asset_key: row.asset_key,
          l2: row.l2,
          l3: row.l3,
          l4: row.l4,
          l5: row.l5,
          price: value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "asset_key,l2,l3,l4,l5" },
      );
      if (upError) throw upError;
      setSavedRow(key);
      setEdits((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      router.refresh();
    } catch (err) {
      setError(describeError(err, "Could not save that price."));
    } finally {
      setSavingRow("");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Price catalog</h1>
          <p className="mt-0.5 max-w-3xl text-sm text-zinc-500">
            The asset/level structure (L1 → L2–L5) is built into the app —
            {" "}
            <code className="rounded bg-zinc-100 px-1">{CATALOG_META.assetCount} assets</code>,{" "}
            <code className="rounded bg-zinc-100 px-1">
              {CATALOG_META.combinationCount} combinations
            </code>
            {" "}from <strong>{CATALOG_META.sourceFile}</strong>. Only the prices live in
            Supabase, so you can edit them here or re-import the Excel file any time
            without redeploying the app.
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            Structure generated {new Date(CATALOG_META.generatedAt).toLocaleString()} ·
            change the spreadsheet → <code>npm run catalog:gen</code> → commit.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={btnPrimary}
          >
            <Upload className="h-4 w-4" /> Import Excel prices
          </button>
        </div>
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
      {report && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Imported {report.rows} prices ({report.priced} with a price
          {report.missing > 0 ? `, ${report.missing} left empty → manual/skip` : ""}).
        </div>
      )}

      {(fileName || flat) && (
        <Card className="space-y-3 p-5">
          <p className="text-sm font-semibold text-zinc-900">
            {fileName ? `File: ${fileName}` : "Ready to import"}
          </p>
          {flat && (
            <>
              <p className="text-sm text-zinc-600">
                {flat.rows.length} price rows · {flat.pricedCount} priced ·{" "}
                {flat.missingPriceCount} without a price.
              </p>
              {flat.duplicates > 0 && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {flat.duplicates} duplicate L1–L5 row(s) in the sheet were merged.
                </p>
              )}
              {flat.unknownAssets.length > 0 && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Not in the app structure (skipped): {flat.unknownAssets.join(", ")}.
                  Run <code>npm run catalog:gen</code> and redeploy to add them.
                </p>
              )}
              {flat.newOptions.length > 0 && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {flat.newOptions.length} option value(s) are unknown to the app (prices
                  still import, but inspectors cannot pick them yet):{" "}
                  {flat.newOptions.slice(0, 5).join(" · ")}
                  {flat.newOptions.length > 5 ? " …" : ""}
                </p>
              )}
              <p className="text-xs text-amber-700">
                Importing replaces <strong>all</strong> stored prices (existing inspections
                keep their own snapshot).
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={runImport}
                className={btnPrimary}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {busy ? "Importing…" : "Import now"}
              </button>
            </>
          )}
        </Card>
      )}

      <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 p-5 text-sm">
        <span className="text-zinc-500">
          Stored prices:{" "}
          <strong className="text-zinc-900">
            {totalPriced}/{totalRows}
          </strong>
        </span>
        <span className="text-zinc-500">
          Without a price:{" "}
          <strong className={totalRows - totalPriced > 0 ? "text-amber-700" : "text-zinc-900"}>
            {totalRows - totalPriced}
          </strong>{" "}
          <span className="text-xs text-zinc-400">(inspectors type them or skip)</span>
        </span>
        {untracked > 0 && (
          <span className="text-xs text-amber-700">
            {untracked} stored row(s) belong to assets that are not in the structure.
          </span>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputCls} max-w-xs`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search asset, level value…"
        />
        <button
          type="button"
          onClick={() => setOnlyMissing((v) => !v)}
          className={`${btnSecondary} ${
            onlyMissing ? "border-amber-400 bg-amber-50 text-amber-800" : ""
          }`}
        >
          {onlyMissing ? "Showing rows without a price" : "Show only rows without a price"}
        </button>
      </div>

      {totalRows === 0 && (
        <Card className="p-6">
          <EmptyState
            icon={<Package className="h-8 w-8" />}
            title="No prices stored yet"
            hint="Press “Import Excel prices” and pick the Aset perabot jalan file. Until then inspectors type the price manually or skip it."
            action={
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={btnPrimary}
              >
                <Upload className="h-4 w-4" /> Import Excel prices
              </button>
            }
          />
        </Card>
      )}

      {groups.map(({ asset, rows, priced }) => {
        const levels = levelsOf(asset);
        const visible = rows.filter((row) => {
          if (onlyMissing && row.price !== null) return false;
          if (!needle) return true;
          return [asset.name, row.l2, row.l3, row.l4, row.l5]
            .join(" ")
            .toLowerCase()
            .includes(needle);
        });
        if (visible.length === 0) return null;

        return (
          <Card key={asset.key} className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-5 py-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-bold text-zinc-900">
                  <Package className="h-4 w-4 text-amber-600" />
                  {asset.name}
                  <span className="text-xs font-normal text-zinc-400">{asset.key}</span>
                </p>
                <p className="text-xs text-zinc-500">
                  {levels.map((l) => `L${l.level} ${l.label}`).join(" · ") || "—"}
                </p>
              </div>
              <span
                className={
                  priced === rows.length
                    ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800"
                    : "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800"
                }
              >
                {priced}/{rows.length} priced
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="border-b border-zinc-200 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <tr>
                    {levels.map((l) => (
                      <th key={l.level} className="px-5 py-2">
                        L{l.level} · {l.label}
                      </th>
                    ))}
                    <th className="px-5 py-2">Price (L6)</th>
                    <th className="px-5 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {visible.map((row) => {
                    const key = rowKey(row.asset_key, [row.l2, row.l3, row.l4, row.l5]);
                    const value =
                      edits[key] ?? (row.price === null ? "" : String(row.price));
                    const dirty = edits[key] !== undefined;
                    return (
                      <tr key={key} className="hover:bg-zinc-50">
                        {levels.map((l) => (
                          <td key={l.level} className="px-5 py-2 text-zinc-700">
                            {(l.level === 2
                              ? row.l2
                              : l.level === 3
                                ? row.l3
                                : l.level === 4
                                  ? row.l4
                                  : row.l5) || "—"}
                          </td>
                        ))}
                        <td className="px-5 py-2">
                          <input
                            className="w-36 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                            value={value}
                            onChange={(e) =>
                              setEdits((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                            placeholder="no price"
                            inputMode="decimal"
                          />
                          {row.raw_price && row.price === null ? (
                            <span className="ml-2 text-xs text-zinc-400">
                              {row.raw_price}
                            </span>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-5 py-2 text-right">
                          {dirty ? (
                            <button
                              type="button"
                              disabled={savingRow === key}
                              onClick={() => void saveRow(row, key)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-zinc-950 disabled:opacity-60"
                            >
                              {savingRow === key ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Save className="h-3.5 w-3.5" />
                              )}
                              Save
                            </button>
                          ) : savedRow === key ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                              <Check className="h-3.5 w-3.5" /> saved
                            </span>
                          ) : row.price === null ? (
                            <span className="text-xs font-semibold text-amber-600">
                              missing
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-400">
                              {row.updated_at
                                ? new Date(row.updated_at).toLocaleDateString()
                                : ""}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
