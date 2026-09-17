"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Package, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { parseCatalogFile } from "@/lib/catalog-import";
import type { CatalogImportResult } from "@/lib/catalog-import";
import { describeError } from "@/lib/format";
import type { CatalogData } from "@/lib/types";
import { btnPrimary, Card, EmptyState } from "@/components/ui";

interface ImportReport {
  assets: number;
  levels: number;
  options: number;
  prices: number;
  withoutPrice: number;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function CatalogManager({ catalog }: { catalog: CatalogData }) {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [parsed, setParsed] = useState<CatalogImportResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [report, setReport] = useState<ImportReport | null>(null);

  const rows = useMemo(() => {
    const labelMap = new Map<string, string[]>();
    const optionMap = new Map<string, Map<number, number>>();
    const priceMap = new Map<
      string,
      { count: number; min: number; max: number; missing: number }
    >();

    for (const l of catalog.levels) {
      const list = labelMap.get(l.asset_id) ?? [];
      list[l.level_no - 2] = l.label;
      labelMap.set(l.asset_id, list);
    }
    for (const o of catalog.options) {
      const perAsset = optionMap.get(o.asset_id) ?? new Map<number, number>();
      perAsset.set(o.level_no, (perAsset.get(o.level_no) ?? 0) + 1);
      optionMap.set(o.asset_id, perAsset);
    }
    for (const p of catalog.prices) {
      const entry = priceMap.get(p.asset_id) ?? {
        count: 0,
        min: Number.POSITIVE_INFINITY,
        max: Number.NEGATIVE_INFINITY,
        missing: 0,
      };
      entry.count += 1;
      if (p.price === null || p.price === undefined) entry.missing += 1;
      else {
        entry.min = Math.min(entry.min, Number(p.price));
        entry.max = Math.max(entry.max, Number(p.price));
      }
      priceMap.set(p.asset_id, entry);
    }

    return catalog.assets.map((a) => ({
      id: a.id,
      name: a.name,
      labels: (labelMap.get(a.id) ?? []).filter(Boolean),
      options: optionMap.get(a.id) ?? new Map<number, number>(),
      prices: priceMap.get(a.id) ?? null,
    }));
  }, [catalog]);

  async function handleFile(file: File | null | undefined) {
    if (!file) return;
    setError("");
    setNotice("");
    setReport(null);
    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const result = await parseCatalogFile(buffer);
      setParsed(result);
    } catch (err) {
      setError(describeError(err, "Could not read that file."));
    }
  }

  async function runImport() {
    if (!parsed || parsed.assets.length === 0) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      /* replace the catalog — inspections keep their own text snapshot */
      await supabase.from("catalog_prices").delete().not("id", "is", null);
      await supabase.from("catalog_options").delete().not("id", "is", null);
      await supabase.from("catalog_levels").delete().not("id", "is", null);
      const { error: delAssets } = await supabase
        .from("catalog_assets")
        .delete()
        .not("id", "is", null);
      if (delAssets) throw delAssets;

      const { data: inserted, error: assetError } = await supabase
        .from("catalog_assets")
        .insert(
          parsed.assets.map((a) => ({ name: a.name, sort_order: a.sortOrder })),
        )
        .select("id, name");
      if (assetError) throw assetError;

      const idByName = new Map<string, string>();
      for (const a of (inserted ?? []) as { id: string; name: string }[]) {
        idByName.set(a.name, a.id);
      }

      const levelRows: { asset_id: string; level_no: number; label: string }[] = [];
      const optionRows: { asset_id: string; level_no: number; value: string }[] = [];
      const priceRows: {
        asset_id: string;
        l2: string | null;
        l3: string | null;
        l4: string | null;
        l5: string | null;
        price: number | null;
        raw_price: string | null;
      }[] = [];

      for (const a of parsed.assets) {
        const id = idByName.get(a.name);
        if (!id) continue;
        for (const [level, label] of Object.entries(a.labels)) {
          levelRows.push({ asset_id: id, level_no: Number(level), label });
        }
        for (const [level, values] of Object.entries(a.options)) {
          for (const value of values) {
            optionRows.push({ asset_id: id, level_no: Number(level), value });
          }
        }
        for (const r of a.rows) {
          priceRows.push({
            asset_id: id,
            l2: r.l2,
            l3: r.l3,
            l4: r.l4,
            l5: r.l5,
            price: r.price,
            raw_price: r.rawPrice,
          });
        }
      }

      for (const part of chunk(levelRows, 500)) {
        const { error: e1 } = await supabase.from("catalog_levels").insert(part);
        if (e1) throw e1;
      }
      for (const part of chunk(optionRows, 500)) {
        const { error: e2 } = await supabase.from("catalog_options").insert(part);
        if (e2) throw e2;
      }
      for (const part of chunk(priceRows, 500)) {
        const { error: e3 } = await supabase.from("catalog_prices").insert(part);
        if (e3) throw e3;
      }

      setReport({
        assets: parsed.assets.length,
        levels: levelRows.length,
        options: optionRows.length,
        prices: priceRows.length,
        withoutPrice: priceRows.filter((r) => r.price === null).length,
      });
      setNotice("Catalog imported.");
      setParsed(null);
      setFileName("");
      router.refresh();
    } catch (err) {
      setError(describeError(err, "Could not import the catalog."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Asset catalog</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Import <strong>Aset perabot jalan</strong> (L1 asset → L2–L5 options →
            L6 price). Inspectors pick these values during an inspection and the
            price is filled in automatically.
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
            <Upload className="h-4 w-4" /> Choose Excel file
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

      {(fileName || parsed) && (
        <Card className="space-y-3 p-5">
          <p className="text-sm font-semibold text-zinc-900">
            {fileName ? `File: ${fileName}` : "Ready to import"}
          </p>
          {parsed && (
            <>
              <p className="text-sm text-zinc-600">
                Found <strong>{parsed.assets.length}</strong> asset
                {parsed.assets.length === 1 ? "" : "s"} in{" "}
                <strong>{parsed.sheetName}</strong> —{" "}
                {parsed.assets.reduce((n, a) => n + a.rows.length, 0)} price rows.
              </p>
              <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-zinc-500">
                {parsed.assets.map((a) => {
                  const priced = a.rows.filter((r) => r.price !== null).length;
                  const labels = Object.entries(a.labels)
                    .map(([lvl, label]) => `L${lvl} ${label}`)
                    .join(" · ");
                  return (
                    <li key={a.name}>
                      <span className="font-semibold text-zinc-700">{a.name}</span>{" "}
                      — {labels} · {priced}/{a.rows.length} priced
                    </li>
                  );
                })}
              </ul>
              {parsed.warnings.length > 0 && (
                <ul className="list-disc pl-5 text-xs text-amber-700">
                  {parsed.warnings.slice(0, 5).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-amber-700">
                Importing replaces the current catalog (existing inspections keep
                the values they already saved).
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
      {report && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Imported {report.assets} assets · {report.levels} level labels ·{" "}
          {report.options} options · {report.prices} price rows
          {report.withoutPrice > 0
            ? ` (${report.withoutPrice} without a price → manual/skip)`
            : ""}
          .
        </div>
      )}

      {rows.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={<Package className="h-8 w-8" />}
            title="No catalog yet"
            hint="Choose your Aset perabot jalan Excel file above and press Import now."
            action={
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={btnPrimary}
              >
                <Upload className="h-4 w-4" /> Choose Excel file
              </button>
            }
          />
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-5 py-3">Asset (L1)</th>
                <th className="px-5 py-3">Levels</th>
                <th className="px-5 py-3">Options</th>
                <th className="px-5 py-3">Prices</th>
                <th className="px-5 py-3">Range</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((a) => (
                <tr key={a.id} className="hover:bg-zinc-50">
                  <td className="px-5 py-3">
                    <p className="flex items-center gap-2 font-semibold text-zinc-900">
                      <Package className="h-4 w-4 text-amber-600" />
                      {a.name}
                    </p>
                  </td>
                  <td className="px-5 py-3 text-zinc-600">
                    {a.labels.length === 0
                      ? "—"
                      : a.labels.map((l, i) => `L${i + 2} ${l}`).join(" · ")}
                  </td>
                  <td className="px-5 py-3 text-zinc-600">
                    {[...a.options.entries()]
                      .sort((x, y) => x[0] - y[0])
                      .map(([level, count]) => `L${level}: ${count}`)
                      .join(" · ") || "—"}
                  </td>
                  <td className="px-5 py-3 text-zinc-600">
                    {a.prices
                      ? `${a.prices.count} rows${
                          a.prices.missing > 0
                            ? ` · ${a.prices.missing} without price`
                            : ""
                        }`
                      : "—"}
                  </td>
                  <td className="px-5 py-3 text-zinc-500">
                    {a.prices && a.prices.count > a.prices.missing
                      ? `${a.prices.min.toLocaleString()} – ${a.prices.max.toLocaleString()}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
