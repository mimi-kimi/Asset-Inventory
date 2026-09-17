"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { combinations, priceHeading } from "@/lib/catalog-tree";
import type { CatalogAssetTree } from "@/lib/catalog-tree";
import type { CatalogOptionRow } from "@/lib/types";
import { describeError } from "@/lib/format";

function money(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function levelValue(nodes: CatalogOptionRow[], levelNo: number): string {
  return nodes.find((node) => node.level_no === levelNo)?.value ?? "";
}

/**
 * The price sheet of one asset: one row per combination, one column per level
 * and the price in the last column — the same shape as the spreadsheet.
 */
export function CatalogCombinations({ asset }: { asset: CatalogAssetTree }) {
  const router = useRouter();
  const supabase = createClient();

  const rows = combinations(asset);
  const columns = asset.levels;
  const heading = priceHeading(asset);

  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");

  async function savePrice(option: CatalogOptionRow, key: string) {
    const raw = (edits[key] ?? "").trim();
    const cleaned = raw.replace(/[^0-9.\-]/g, "");
    const value =
      raw === "" ? null : Number.isFinite(Number(cleaned)) ? Number(cleaned) : NaN;
    if (Number.isNaN(value)) {
      setError("Prices must be numbers (empty clears it).");
      return;
    }

    setBusy(key);
    setError("");
    try {
      const { error: updateError } = await supabase
        .from("catalog_options")
        .update({ price: value, raw_price: null })
        .eq("id", option.id);
      if (updateError) throw updateError;
      setEdits((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setSaved(key);
      router.refresh();
    } catch (err) {
      setError(describeError(err, "Could not save that price."));
    } finally {
      setBusy("");
    }
  }

  const priced = rows.filter((row) => row.price !== null).length;

  if (rows.length === 0) {
    return (
      <p className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
        No combinations yet — add the values in the editor and the rows appear here.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-zinc-200">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              {columns.map((column) => (
                <th key={column.level_no} className="px-4 py-2">
                  {column.label}
                </th>
              ))}
              <th className="px-4 py-2">{heading}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((row, index) => {
              const leaf = row.nodes[row.nodes.length - 1]!;
              const key = leaf.id;
              const value =
                edits[key] ?? (leaf.price === null ? "" : String(leaf.price));
              const dirty = edits[key] !== undefined;
              return (
                <tr key={`${key}-${index}`} className="hover:bg-zinc-50">
                  {columns.map((column) => (
                    <td key={column.level_no} className="px-4 py-1.5 text-zinc-700">
                      {levelValue(row.nodes, column.level_no) || "—"}
                    </td>
                  ))}
                  <td className="px-4 py-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        className="w-28 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                        value={value}
                        placeholder="no price"
                        inputMode="decimal"
                        onChange={(e) =>
                          setEdits((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        aria-label={`${heading} for ${row.nodes
                          .map((node) => node.value)
                          .join(" / ")}`}
                      />
                      {dirty ? (
                        <button
                          type="button"
                          disabled={busy === key}
                          onClick={() => void savePrice(leaf, key)}
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-bold text-zinc-950 disabled:opacity-60"
                        >
                          {busy === key ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                          Save
                        </button>
                      ) : saved === key ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                          <Check className="h-3.5 w-3.5" /> saved
                        </span>
                      ) : leaf.price !== null ? (
                        <span className="text-xs text-zinc-400">
                          {money(leaf.price)}
                        </span>
                      ) : leaf.raw_price ? (
                        <span className="text-xs text-zinc-400">{leaf.raw_price}</span>
                      ) : (
                        <span className="text-xs font-semibold text-amber-600">
                          missing
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-400">
        {priced}/{rows.length} combination(s) priced · empty = no price (the inspector
        types it or skips it)
      </p>
    </div>
  );
}
