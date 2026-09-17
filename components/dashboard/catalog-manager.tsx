"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Layers, Loader2, Package, Plus, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { buildTree, coverageOf } from "@/lib/catalog-tree";
import { planCatalogMerge } from "@/lib/catalog-merge";
import type { CatalogMergePlan } from "@/lib/catalog-merge";
import { parseCatalogFile } from "@/lib/catalog-import";
import { cn, describeError } from "@/lib/format";
import type { CatalogData } from "@/lib/types";
import { AssetCatalogEditor } from "@/components/dashboard/catalog-editor";
import { btnPrimary, btnSecondary, Card, EmptyState, inputCls, labelCls } from "@/components/ui";

interface ImportReport {
  assets: number;
  levels: number;
  options: number;
  prices: number;
  skipped: number;
  refreshed: number;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function CatalogManager({
  catalog,
  initialAssetId = "",
}: {
  catalog: CatalogData;
  initialAssetId?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [expanded, setExpanded] = useState<string[]>(
    initialAssetId ? [initialAssetId] : [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [report, setReport] = useState<ImportReport | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const [plan, setPlan] = useState<CatalogMergePlan | null>(null);
  const [fileName, setFileName] = useState("");
  const [refreshPrices, setRefreshPrices] = useState(false);
  const [search, setSearch] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);

  const tree = useMemo(() => buildTree(catalog), [catalog]);
  const totals = useMemo(() => {
    let levels = 0;
    let options = 0;
    let combinations = 0;
    let priced = 0;
    for (const asset of tree.assets) {
      levels += asset.levels.length;
      options += asset.options.length;
      const cover = coverageOf(asset);
      combinations += cover.combinations;
      priced += cover.priced;
    }
    return { levels, options, combinations, priced };
  }, [tree]);

  const needle = search.trim().toLowerCase();
  const visibleAssets = tree.assets.filter((asset) => {
    if (onlyMissing) {
      const cover = coverageOf(asset);
      if (cover.combinations > 0 && cover.priced === cover.combinations) return false;
    }
    if (!needle) return true;
    return [
      asset.name,
      ...asset.levels.map((level) => level.label),
      ...asset.options.map((option) => option.value),
    ]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });

  function toggle(assetId: string) {
    setExpanded((prev) =>
      prev.includes(assetId)
        ? prev.filter((id) => id !== assetId)
        : [...prev, assetId],
    );
  }

  async function addAsset() {
    const name = newName.trim();
    if (!name) {
      setError("Give the new asset a name.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const id = crypto.randomUUID();
      const { error: assetError } = await supabase
        .from("catalog_assets")
        .insert({ id, name, sort_order: catalog.assets.length });
      if (assetError) throw assetError;

      const label = newLabel.trim();
      if (label) {
        const { error: levelError } = await supabase
          .from("catalog_levels")
          .insert({ asset_id: id, level_no: 2, label });
        if (levelError) throw levelError;
      }

      setNewName("");
      setNewLabel("");
      setAddOpen(false);
      setExpanded((prev) => [...prev, id]);
      setNotice(`"${name}" created — add its levels and options below.`);
      router.refresh();
    } catch (err) {
      setError(describeError(err, "Could not create the asset."));
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(file: File | null | undefined) {
    if (!file) return;
    setError("");
    setNotice("");
    setReport(null);
    setFileName(file.name);
    try {
      const parsed = await parseCatalogFile(await file.arrayBuffer());
      setPlan(planCatalogMerge(parsed, catalog));
    } catch (err) {
      setPlan(null);
      setError(describeError(err, "Could not read that file."));
    }
  }

  /** Writes the merge plan: inserts only what is missing (ids generated here). */
  async function applyPlan() {
    if (!plan) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const nameToId = new Map<string, string>();
      for (const asset of catalog.assets) {
        nameToId.set(asset.name.trim().toLowerCase(), asset.id);
      }

      if (plan.newAssets.length > 0) {
        const rows = plan.newAssets.map((asset) => {
          const id = crypto.randomUUID();
          nameToId.set(asset.name.trim().toLowerCase(), id);
          return {
            id,
            name: asset.name,
            sort_order: asset.sort_order,
            price_label: asset.price_label,
          };
        });
        const { error: assetError } = await supabase
          .from("catalog_assets")
          .insert(rows);
        if (assetError) throw assetError;
      }

      if (plan.priceLabels.length > 0) {
        for (const entry of plan.priceLabels) {
          const assetId = nameToId.get(entry.assetName.trim().toLowerCase());
          if (!assetId) continue;
          const { error: labelError } = await supabase
            .from("catalog_assets")
            .update({ price_label: entry.label })
            .eq("id", assetId);
          if (labelError) throw labelError;
        }
      }

      if (plan.newLevels.length > 0) {
        const rows = plan.newLevels.map((level) => {
          const assetId = nameToId.get(level.assetName.trim().toLowerCase());
          if (!assetId) throw new Error(`Unknown asset: ${level.assetName}`);
          return { asset_id: assetId, level_no: level.level_no, label: level.label };
        });
        const { error: levelError } = await supabase
          .from("catalog_levels")
          .insert(rows);
        if (levelError) throw levelError;
      }

      const placeholderIds = new Map<string, string>();
      const levels = [...new Set(plan.newOptions.map((option) => option.level_no))].sort(
        (a, b) => a - b,
      );
      for (const levelNo of levels) {
        const batch = plan.newOptions.filter((option) => option.level_no === levelNo);
        const rows = batch.map((option) => {
          const assetId = nameToId.get(option.assetName.trim().toLowerCase());
          if (!assetId) throw new Error(`Unknown asset: ${option.assetName}`);
          const id = crypto.randomUUID();
          placeholderIds.set(option.placeholder, id);
          const parentId = option.parentOptionId
            ? option.parentOptionId.startsWith("new:")
              ? placeholderIds.get(option.parentOptionId) ?? null
              : option.parentOptionId
            : null;
          if (option.parentOptionId && !parentId) {
            throw new Error(`Could not resolve the parent of "${option.value}".`);
          }
          return {
            id,
            asset_id: assetId,
            level_no: levelNo,
            parent_id: parentId,
            value: option.value,
            price: option.price,
            raw_price: option.raw_price,
            sort_order: option.sort_order,
          };
        });
        const { error: optionError } = await supabase
          .from("catalog_options")
          .insert(rows);
        if (optionError) throw optionError;
      }

      let refreshed = 0;
      if (refreshPrices && plan.priceUpdates.length > 0) {
        for (const part of chunk(plan.priceUpdates, 100)) {
          const rows = part.map((update) => {
            const existing = catalog.options.find((option) => option.id === update.id);
            if (!existing) throw new Error("That price row no longer exists.");
            return {
              id: existing.id,
              asset_id: existing.asset_id,
              level_no: existing.level_no,
              parent_id: existing.parent_id,
              value: existing.value,
              price: update.price,
              raw_price: update.raw_price,
              sort_order: existing.sort_order,
            };
          });
          const { error: updateError } = await supabase
            .from("catalog_options")
            .upsert(rows, { onConflict: "id" });
          if (updateError) throw updateError;
          refreshed += rows.length;
        }
      }

      setReport({
        assets: plan.newAssets.length,
        levels: plan.newLevels.length,
        options: plan.newOptions.length,
        prices: plan.newOptions.filter((option) => option.price !== null).length,
        skipped: plan.skippedPaths,
        refreshed,
      });
      setNotice("Import finished — only the missing rows were added.");
      setPlan(null);
      setFileName("");
      router.refresh();
    } catch (err) {
      setError(describeError(err, "Could not import those rows."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Asset catalog</h1>
          <p className="mt-0.5 max-w-3xl text-sm text-zinc-500">
            The inspection options live here: each <strong>L1 asset</strong> gets the
            levels it needs (<strong>L2…L6</strong>), each level holds its values, and a
            value can carry the price — everything under it inherits that price.
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            {tree.assets.length} assets · {totals.levels} levels · {totals.options}{" "}
            options · {totals.priced}/{totals.combinations} combination(s) priced
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
            onClick={() => setAddOpen((value) => !value)}
            className={btnSecondary}
          >
            <Plus className="h-4 w-4" /> Add asset
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={btnPrimary}
          >
            <Upload className="h-4 w-4" /> Import Excel
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
          Added {report.assets} asset(s) · {report.levels} level(s) · {report.options}{" "}
          option(s) ({report.prices} with a price) · {report.skipped} existing row(s)
          skipped{report.refreshed > 0 ? ` · ${report.refreshed} price(s) refreshed` : ""}.
        </div>
      )}

      {addOpen && (
        <Card className="space-y-3 p-5">
          <p className="text-sm font-bold text-zinc-900">New asset (L1)</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <label className={labelCls}>Asset name</label>
              <input
                className={inputCls}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. LAMPU JALAN"
              />
            </div>
            <div className="min-w-56 flex-1">
              <label className={labelCls}>
                First level label (optional — becomes L2)
              </label>
              <input
                className={inputCls}
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. KETERANGAN"
              />
            </div>
            <button
              type="button"
              onClick={() => void addAsset()}
              disabled={busy}
              className={btnPrimary}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create asset
            </button>
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className={btnSecondary}
            >
              Cancel
            </button>
          </div>
        </Card>
      )}

      {fileName && (
        <Card className="space-y-3 p-5">
          <p className="text-sm font-semibold text-zinc-900">File: {fileName}</p>
          {!plan ? (
            <p className="text-sm text-zinc-500">Reading the sheet…</p>
          ) : (
            <>
              <p className="text-sm text-zinc-600">
                Would add <strong>{plan.newAssets.length}</strong> asset(s),{" "}
                <strong>{plan.newLevels.length}</strong> level(s) and{" "}
                <strong>{plan.newOptions.length}</strong> option(s) —{" "}
                <strong>{plan.skippedPaths}</strong> of {plan.sheetPaths} sheet row(s)
                already exist and will be skipped.
              </p>
              {plan.touchedAssets.length > 0 && (
                <p className="text-xs text-zinc-500">
                  Assets in the sheet: {plan.touchedAssets.join(" · ")}
                </p>
              )}
              {plan.priceUpdates.length > 0 && (
                <label className="flex items-center gap-2 text-xs text-zinc-600">
                  <input
                    type="checkbox"
                    checked={refreshPrices}
                    onChange={(e) => setRefreshPrices(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  Also refresh the price of {plan.priceUpdates.length} existing row(s)
                  (otherwise only new rows get prices)
                </label>
              )}
              {plan.warnings.map((warning) => (
                <p
                  key={warning}
                  className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800"
                >
                  {warning}
                </p>
              ))}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void applyPlan()}
                  disabled={busy || plan.newOptions.length === 0}
                  className={btnPrimary}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {busy ? "Importing…" : "Add missing rows"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPlan(null);
                    setFileName("");
                  }}
                  className={btnSecondary}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </Card>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputCls} max-w-xs`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search asset, level, value…"
        />
        <button
          type="button"
          onClick={() => setOnlyMissing((value) => !value)}
          className={cn(
            btnSecondary,
            onlyMissing && "border-amber-400 bg-amber-50 text-amber-800",
          )}
        >
          {onlyMissing
            ? "Showing assets with missing prices"
            : "Only assets with missing prices"}
        </button>
      </div>

      {tree.assets.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={<Package className="h-8 w-8" />}
            title="No assets yet"
            hint="Add your first L1 asset (then its L2…L6 levels and values), or import the Aset perabot jalan sheet — the import only adds what is missing."
            action={
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className={btnPrimary}
              >
                <Plus className="h-4 w-4" /> Add asset
              </button>
            }
          />
        </Card>
      ) : visibleAssets.length === 0 ? (
        <Card className="p-5 text-sm text-zinc-500">
          No asset matches the current search/filter.
        </Card>
      ) : (
        visibleAssets.map((asset) => {
          const cover = coverageOf(asset);
          const open = expanded.includes(asset.id);
          return (
            <Card key={asset.id} className="overflow-hidden">
              <button
                type="button"
                onClick={() => toggle(asset.id)}
                className="flex w-full flex-wrap items-center justify-between gap-2 px-5 py-3 text-left transition-colors hover:bg-zinc-50"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-bold text-zinc-900">
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 text-zinc-400 transition-transform",
                        open && "rotate-90",
                      )}
                    />
                    {asset.name}
                    <span className="text-[11px] font-normal text-zinc-400">L1</span>
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    {asset.levels.map((level) => level.label).join(" · ") ||
                      "No levels yet"}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-600">
                    {asset.options.length} option(s)
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 font-semibold",
                      cover.combinations > 0 && cover.priced === cover.combinations
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800",
                    )}
                  >
                    {cover.priced}/{cover.combinations} priced
                  </span>
                </div>
              </button>
              {open && (
                <div className="border-t border-zinc-100 px-5 py-4">
                  <AssetCatalogEditor asset={asset} mode="compact" />
                </div>
              )}
            </Card>
          );
        })
      )}

      <p className="flex items-start gap-2 text-xs text-zinc-400">
        <Layers className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        The Excel import is a helper, not a reset: matching assets, levels and values
        are left untouched, so re-importing the same sheet changes nothing.
      </p>
    </div>
  );
}

