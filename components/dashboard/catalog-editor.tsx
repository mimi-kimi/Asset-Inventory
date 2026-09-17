"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn, describeError } from "@/lib/format";
import {
  childrenOf,
  coverageOf,
  levelLabel,
  nextLevelNo,
  optionsAtLevel,
  priceHeading,
} from "@/lib/catalog-tree";
import type { CatalogAssetTree } from "@/lib/catalog-tree";
import type { CatalogOptionRow } from "@/lib/types";
import { btnPrimary, btnSecondary, Card, inputCls } from "@/components/ui";

const LEVEL_SUGGESTIONS: Record<number, string> = {
  2: "KETERANGAN",
  3: "JENIS",
  4: "WATAK",
  5: "SAIZ",
  6: "LAIN-LAIN",
};

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

/** "" → null (clear the price), a number → its value, undefined → invalid input. */
export function parsePriceInput(raw: string): number | null | undefined {
  const text = raw.trim();
  if (text === "") return null;
  const value = Number(text.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(value) ? value : undefined;
}

export function AssetCatalogEditor({
  asset,
  mode = "compact",
}: {
  asset: CatalogAssetTree;
  mode?: "compact" | "full";
}) {
  const router = useRouter();
  const supabase = createClient();
  const full = mode === "full";

  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [valueEdits, setValueEdits] = useState<Record<string, string>>({});
  const [savedId, setSavedId] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [nameDraft, setNameDraft] = useState(asset.name);
  const [sortDraft, setSortDraft] = useState(String(asset.sort_order));
  const [priceLabelDraft, setPriceLabelDraft] = useState(priceHeading(asset));

  const coverage = useMemo(() => coverageOf(asset), [asset]);
  const priceLabel = priceHeading(asset);

  async function saveAsset() {
    const name = nameDraft.trim();
    if (!name) {
      setError("The asset needs a name.");
      return;
    }
    setBusy("asset");
    setError("");
    try {
      const { error: updateError } = await supabase
        .from("catalog_assets")
        .update({
          name,
          sort_order: Number(sortDraft) || 0,
          price_label: priceLabelDraft.trim() || null,
        })
        .eq("id", asset.id);
      if (updateError) throw updateError;
      setNotice("Asset saved.");
      router.refresh();
    } catch (err) {
      setError(describeError(err, "Could not save the asset."));
    } finally {
      setBusy("");
    }
  }

  async function removeAsset() {
    if (
      !window.confirm(
        `Delete "${asset.name}" with all of its levels and options? Recorded inspections keep their own copy.`,
      )
    ) {
      return;
    }
    setBusy("asset-delete");
    setError("");
    try {
      const { error: deleteError } = await supabase
        .from("catalog_assets")
        .delete()
        .eq("id", asset.id);
      if (deleteError) throw deleteError;
      router.push("/dashboard/catalog");
      router.refresh();
    } catch (err) {
      setError(describeError(err, "Could not delete the asset."));
      setBusy("");
    }
  }

  async function saveOption(option: CatalogOptionRow) {
    const value = (valueEdits[option.id] ?? option.value).trim();
    if (!value) {
      setError("An option needs a value.");
      return;
    }
    const rawPrice = priceEdits[option.id];
    const parsed = rawPrice === undefined ? undefined : parsePriceInput(rawPrice);
    if (rawPrice !== undefined && parsed === undefined) {
      setError("Prices must be numbers (leave empty to clear).");
      return;
    }

    setBusy(option.id);
    setError("");
    try {
      const patch: {
        value: string;
        price?: number | null;
        raw_price?: string | null;
      } = { value };
      if (rawPrice !== undefined && parsed !== undefined) {
        patch.price = parsed;
        patch.raw_price = null;
      }
      const { error: updateError } = await supabase
        .from("catalog_options")
        .update(patch)
        .eq("id", option.id);
      if (updateError) throw updateError;
      setPriceEdits((prev) => {
        const next = { ...prev };
        delete next[option.id];
        return next;
      });
      setValueEdits((prev) => {
        const next = { ...prev };
        delete next[option.id];
        return next;
      });
      setSavedId(option.id);
      router.refresh();
    } catch (err) {
      setError(describeError(err, "Could not save that option."));
    } finally {
      setBusy("");
    }
  }

  async function removeOption(option: CatalogOptionRow) {
    const kids = childrenOf(asset, option.id).length;
    if (
      !window.confirm(
        `Delete "${option.value}"${kids > 0 ? ` and ${kids} option(s) under it` : ""}?`,
      )
    ) {
      return;
    }
    setBusy(option.id);
    setError("");
    try {
      const { error: deleteError } = await supabase
        .from("catalog_options")
        .delete()
        .eq("id", option.id);
      if (deleteError) throw deleteError;
      router.refresh();
    } catch (err) {
      setError(describeError(err, "Could not delete that option."));
    } finally {
      setBusy("");
    }
  }

  /** "30A | 10975", "30A<TAB>10975" or "30A 10975" → { value, price } */
  function parseLines(lines: string) {
    return lines
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line
          .split(/[|\t]/)
          .map((part) => part.trim())
          .filter((part) => part !== "");
        if (parts.length >= 2) {
          return { value: parts[0]!, price: parts.slice(1).join(" ") };
        }
        const match = line.match(/^(.*?)[\s:]+(\d[\d.,\-]*)$/);
        if (match) return { value: match[1]!.trim(), price: match[2]! };
        return { value: line, price: "" };
      })
      .map(({ value, price }) => ({ value, price: parsePriceInput(price) }))
      .filter((row) => row.value !== "");
  }

  async function insertOptions(
    levelNo: number,
    parent: CatalogOptionRow | null,
    lines: string,
  ) {
    const parsed = parseLines(lines);
    if (parsed.length === 0) return;
    if (parsed.some((row) => row.price === undefined)) {
      setError("Prices must be numbers — leave a line without one to store no price.");
      return;
    }

    setBusy(`add-${levelNo}-${parent?.id ?? "root"}`);
    setError("");
    setNotice("");
    try {
      const siblings = childrenOf(asset, parent?.id ?? null).length;
      const rows = parsed.map((row, index) => ({
        asset_id: asset.id,
        level_no: levelNo,
        parent_id: parent?.id ?? null,
        value: row.value,
        price: row.price ?? null,
        raw_price: null,
        sort_order: siblings + index,
      }));
      const { error: insertError } = await supabase
        .from("catalog_options")
        .insert(rows);
      if (insertError) throw insertError;
      setNotice(`Added ${rows.length} option(s).`);
      router.refresh();
    } catch (err) {
      setError(describeError(err, "Could not add those options."));
    } finally {
      setBusy("");
    }
  }

  async function addLevel() {
    const label = (newLabel.trim() || LEVEL_SUGGESTIONS[nextLevelNo(asset)] || "").trim();
    if (!label) {
      setError("Give the new level a name.");
      return;
    }
    const levelNo = nextLevelNo(asset);
    setBusy("level");
    setError("");
    try {
      const { error: insertError } = await supabase
        .from("catalog_levels")
        .insert({ asset_id: asset.id, level_no: levelNo, label });
      if (insertError) throw insertError;
      setNewLabel("");
      setNotice(`"${label}" added as the next level.`);
      router.refresh();
    } catch (err) {
      setError(describeError(err, "Could not add the level."));
    } finally {
      setBusy("");
    }
  }

  async function renameLevel(levelNo: number, label: string) {
    const value = label.trim();
    if (!value) return;
    setBusy(`level-${levelNo}`);
    setError("");
    try {
      const { error: updateError } = await supabase
        .from("catalog_levels")
        .update({ label: value })
        .eq("asset_id", asset.id)
        .eq("level_no", levelNo);
      if (updateError) throw updateError;
      router.refresh();
    } catch (err) {
      setError(describeError(err, "Could not rename the level."));
    } finally {
      setBusy("");
    }
  }

  async function removeLevel(levelNo: number) {
    if (
      !window.confirm(
        `Remove L${levelNo} and every option at that level (and deeper)? Recorded inspections keep their own copy.`,
      )
    ) {
      return;
    }
    setBusy(`level-${levelNo}`);
    setError("");
    try {
      const { error: optionError } = await supabase
        .from("catalog_options")
        .delete()
        .eq("asset_id", asset.id)
        .eq("level_no", levelNo);
      if (optionError) throw optionError;
      const { error: levelError } = await supabase
        .from("catalog_levels")
        .delete()
        .eq("asset_id", asset.id)
        .gte("level_no", levelNo);
      if (levelError) throw levelError;
      setNotice(`Level L${levelNo} removed.`);
      router.refresh();
    } catch (err) {
      setError(describeError(err, "Could not remove the level."));
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {notice}
        </p>
      )}

      {full && (
        <Card className="space-y-3 p-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <label className="mb-1 block text-xs font-semibold text-zinc-500">
                Asset name (L1)
              </label>
              <input
                className={inputCls}
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
              />
            </div>
            <div className="w-24">
              <label className="mb-1 block text-xs font-semibold text-zinc-500">
                Sort
              </label>
              <input
                className={inputCls}
                value={sortDraft}
                onChange={(e) => setSortDraft(e.target.value)}
                inputMode="numeric"
              />
            </div>
            <div className="w-32">
              <label className="mb-1 block text-xs font-semibold text-zinc-500">
                Price heading
              </label>
              <input
                className={inputCls}
                value={priceLabelDraft}
                onChange={(e) => setPriceLabelDraft(e.target.value)}
                placeholder="HARGA"
              />
            </div>
            <button
              type="button"
              onClick={() => void saveAsset()}
              disabled={busy === "asset"}
              className={btnPrimary}
            >
              {busy === "asset" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save asset
            </button>
            <button
              type="button"
              onClick={() => void removeAsset()}
              disabled={busy === "asset-delete"}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" /> Delete asset
            </button>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
            <span className="rounded-full bg-zinc-100 px-2.5 py-1">
              {asset.levels.length} level(s) · {asset.options.length} option(s)
            </span>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 font-semibold",
                coverage.combinations > 0 && coverage.priced === coverage.combinations
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800",
              )}
            >
              {coverage.priced}/{coverage.combinations} combination(s) priced
            </span>
            <span className="rounded-full bg-zinc-100 px-2.5 py-1">
              price column: {priceLabel}
            </span>
          </div>
        </Card>
      )}

      {asset.levels.length === 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          No levels yet. Add the first one below (then more only if this asset needs
          them) or load everything from the <strong>Aset perabot jalan</strong> sheet.
        </p>
      )}

      {asset.levels.map((level) => {
        const options = optionsAtLevel(asset, level.level_no);
        const levelBusy = busy === `level-${level.level_no}`;
        return (
          <div
            key={level.level_no}
            className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50 px-4 py-2.5">
              <div className="flex items-center gap-2">
                {full ? (
                  <input
                    className="w-52 rounded border border-zinc-300 px-2 py-1 text-xs font-bold"
                    defaultValue={level.label}
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (value && value !== level.label) {
                        void renameLevel(level.level_no, value);
                      }
                    }}
                    aria-label={`Level ${level.level_no} name`}
                  />
                ) : (
                  <span className="text-xs font-bold text-zinc-800">{level.label}</span>
                )}
                <span className="text-[11px] text-zinc-400">
                  {options.length} option(s)
                </span>
              </div>
              {full && (
                <button
                  type="button"
                  onClick={() => void removeLevel(level.level_no)}
                  disabled={levelBusy}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {levelBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Remove level
                </button>
              )}
            </div>

            <div className="divide-y divide-zinc-100">
              {options.length === 0 && (
                <p className="px-4 py-3 text-xs text-zinc-400">No options yet.</p>
              )}
              {options.map((option) => {
                const parent = option.parent_id
                  ? asset.optionById.get(option.parent_id) ?? null
                  : null;
                const kids = childrenOf(asset, option.id).length;
                const rowBusy = busy === option.id;
                const value = valueEdits[option.id] ?? option.value;
                const price =
                  priceEdits[option.id] ??
                  (option.price === null ? "" : String(option.price));
                const dirty =
                  valueEdits[option.id] !== undefined ||
                  priceEdits[option.id] !== undefined;
                return (
                  <div
                    key={option.id}
                    className="flex flex-wrap items-center gap-2 px-4 py-2"
                  >
                    {parent && (
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500">
                        {parent.value}
                      </span>
                    )}
                    <input
                      className="min-w-40 flex-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                      value={value}
                      onChange={(e) =>
                        setValueEdits((prev) => ({
                          ...prev,
                          [option.id]: e.target.value,
                        }))
                      }
                      aria-label="Option value"
                    />
                    {kids === 0 ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-semibold uppercase text-zinc-400">
                          {priceLabel}
                        </span>
                        <input
                          className="w-28 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                          value={price}
                          placeholder="no price"
                          inputMode="decimal"
                          onChange={(e) =>
                            setPriceEdits((prev) => ({
                              ...prev,
                              [option.id]: e.target.value,
                            }))
                          }
                          aria-label={priceLabel}
                        />
                      </div>
                    ) : null}
                    {dirty ? (
                      <button
                        type="button"
                        disabled={rowBusy}
                        onClick={() => void saveOption(option)}
                        className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-bold text-zinc-950 disabled:opacity-60"
                      >
                        {rowBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        Save
                      </button>
                    ) : savedId === option.id ? (
                      <span className="text-[11px] font-semibold text-emerald-600">
                        saved
                      </span>
                    ) : null}
                    {full && (
                      <button
                        type="button"
                        disabled={rowBusy}
                        onClick={() => void removeOption(option)}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="Delete option"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <AddOptionsForm
              asset={asset}
              levelNo={level.level_no}
              priceHeading={priceLabel}
              busy={busy}
              onAdd={insertOptions}
            />
          </div>
        );
      })}
      {asset.levels.length > 0 && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3">
          <div className="min-w-56 flex-1">
            <label className="mb-1 block text-xs font-semibold text-zinc-500">
              New level name
            </label>
            <input
              className={inputCls}
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder={LEVEL_SUGGESTIONS[nextLevelNo(asset)] ?? "e.g. KETERANGAN"}
            />
          </div>
          <button
            type="button"
            onClick={() => void addLevel()}
            disabled={busy === "level"}
            className={btnSecondary}
          >
            {busy === "level" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add level
          </button>
        </div>
      )}

      {!full && (
        <Link
          href={`/dashboard/catalog/${asset.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:underline"
        >
          Open full editor <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

function AddOptionsForm({
  asset,
  levelNo,
  priceHeading,
  busy,
  onAdd,
}: {
  asset: CatalogAssetTree;
  levelNo: number;
  priceHeading: string;
  busy: string;
  onAdd: (
    levelNo: number,
    parent: CatalogOptionRow | null,
    lines: string,
  ) => Promise<void> | void;
}) {
  const parents =
    levelNo === 2
      ? []
      : asset.options.filter((option) => option.level_no === levelNo - 1);
  const [parentId, setParentId] = useState(parents[0]?.id ?? "");
  const [lines, setLines] = useState("");
  const parent = parents.find((item) => item.id === parentId) ?? null;
  const key = `add-${levelNo}-${parent?.id ?? "root"}`;
  const previous = levelLabel(asset, levelNo - 1);

  if (levelNo > 2 && parents.length === 0) {
    return (
      <p className="border-t border-zinc-100 bg-zinc-50/60 px-4 py-3 text-xs text-zinc-400">
        Add {previous ? `"${previous}"` : "the level above"} values first — these hang
        under them.
      </p>
    );
  }

  return (
    <div className="space-y-2 border-t border-zinc-100 bg-zinc-50/60 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {levelNo > 2 && (
          <label className="flex items-center gap-1 text-xs text-zinc-500">
            under
            <select
              className="rounded-lg border border-zinc-300 px-2 py-1 text-xs"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              {parents.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.value}
                </option>
              ))}
            </select>
          </label>
        )}
        <span className="text-[11px] text-zinc-400">
          one per line — <code>value</code> or <code>value | price</code> ({priceHeading}{" "}
          is optional)
        </span>
      </div>
      <textarea
        className="min-h-16 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
        value={lines}
        onChange={(e) => setLines(e.target.value)}
        placeholder={levelNo === 2 ? "8M | 8500" : "GAL | 12000"}
      />
      <button
        type="button"
        disabled={!lines.trim() || busy === key || (levelNo > 2 && !parent)}
        onClick={() => {
          void onAdd(levelNo, parent, lines);
          setLines("");
        }}
        className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
      >
        {busy === key ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Plus className="h-3.5 w-3.5" />
        )}
        Add option(s)
      </button>
    </div>
  );
}


