"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, Loader2, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fileToWebpDataUrl } from "@/lib/image";
import { cn } from "@/lib/format";
import type {
  AssetRow,
  AssetType,
  CatalogAssetRow,
  CatalogData,
  CatalogLevelRow,
  CatalogOptionRow,
  InspectionRow,
} from "@/lib/types";
import {
  buildTree,
  childrenOf,
  leafPrice,
  levelLabel,
  MAX_LEVEL,
  pathSteps,
  priceHeading,
  selectionPath,
} from "@/lib/catalog-tree";
import type { CatalogAssetTree } from "@/lib/catalog-tree";
import { btnSecondary, Card, inputCls, labelCls } from "@/components/ui";
import { QrScannerOverlay } from "@/components/mobile/qr-scanner";

const STEPS = ["ID", "Photo", "Asset", "Status"];
const OTHER = "__other__";

function money(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
}

export function RecordForm({
  asset,
  inspection,
  assetTypes,
}: {
  asset: AssetRow | null;
  inspection: InspectionRow | null;
  assetTypes: AssetType[];
}) {
  const router = useRouter();
  const supabase = createClient();

  /* ---------- wizard state ---------- */
  const [step, setStep] = useState(inspection ? 1 : 0);
  const [inventoryId, setInventoryId] = useState(asset?.inventory_id ?? "");
  const [photoData, setPhotoData] = useState<string | null>(
    inspection?.photo_webp ?? null,
  );
  const [working, setWorking] = useState(inspection?.functional ?? true);
  const [remarks, setRemarks] = useState(inspection?.remarks ?? "");

  /* ---------- catalog: assets → levels → values (+ the price of a combination) ---------- */
  const [catalogAssets, setCatalogAssets] = useState<CatalogAssetRow[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [assetId, setAssetId] = useState<string>(
    inspection?.catalog_asset_id ?? "",
  );
  const [assetTree, setAssetTree] = useState<CatalogAssetTree | null>(null);
  const [loadedAssetId, setLoadedAssetId] = useState("");
  const [selection, setSelection] = useState<Record<number, string>>({});
  const prefillRef = useRef(false);
  const [manualPrice, setManualPrice] = useState(
    inspection?.price_manual &&
      inspection.price !== null &&
      inspection.price !== undefined
      ? String(inspection.price)
      : "",
  );
  const [otherName, setOtherName] = useState(inspection?.other_description ?? "");

  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  /* ---------- load the catalog: the asset list, then the picked asset's branch ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase
          .from("catalog_assets")
          .select("id, name, sort_order")
          .order("sort_order");
        if (!alive) return;
        setCatalogAssets((data ?? []) as CatalogAssetRow[]);
      } catch {
        /* no catalog yet — the Asset step explains what to do */
      } finally {
        if (alive) setCatalogLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!assetId || assetId === OTHER) return;
    let alive = true;
    (async () => {
      try {
        const [levels, options] = await Promise.all([
          supabase
            .from("catalog_levels")
            .select("id, asset_id, level_no, label")
            .eq("asset_id", assetId),
          supabase
            .from("catalog_options")
            .select("id, asset_id, level_no, parent_id, value, price, raw_price, sort_order")
            .eq("asset_id", assetId),
        ]);
        if (!alive) return;
        const summary = catalogAssets.find((item) => item.id === assetId);
        const data: CatalogData = {
          assets: summary ? [summary] : [],
          levels: (levels.data ?? []) as CatalogLevelRow[],
          options: (options.data ?? []) as CatalogOptionRow[],
        };
        const tree = buildTree(data).assets[0] ?? null;
        setAssetTree(tree);

        /* editing an existing record: rebuild the picked chain */
        if (tree && inspection && !prefillRef.current) {
          prefillRef.current = true;
          const next: Record<number, string> = {};
          for (const step of inspection.catalog_path ?? []) {
            if (step.option_id && tree.optionById.has(step.option_id)) {
              next[step.level_no] = step.option_id;
            }
          }
          if (Object.keys(next).length === 0) {
            const texts = [
              inspection.l2,
              inspection.l3,
              inspection.l4,
              inspection.l5,
              inspection.l6,
            ];
            let parentId: string | null = null;
            texts.forEach((text, index) => {
              if (!text) return;
              const level = index + 2;
              const match = childrenOf(tree, parentId).find(
                (option) => option.value.toLowerCase() === text.toLowerCase(),
              );
              if (match) {
                next[level] = match.id;
                parentId = match.id;
              }
            });
          }
          setSelection(next);
        }
      } catch {
        if (alive) setAssetTree(null);
      } finally {
        if (alive) setLoadedAssetId(assetId);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId, catalogAssets.length, inspection]);

/*__RF_DERIVED__*/

  /* ---------- derived: cascade, price and summary ---------- */
  /** only trust the fetched tree when it belongs to the currently picked asset */
  const activeAsset =
    assetId && assetId !== OTHER && loadedAssetId === assetId ? assetTree : null;
  const isOther = assetId === OTHER;
  const assetLoading = Boolean(assetId) && !isOther && loadedAssetId !== assetId;
  const chain = activeAsset ? selectionPath(activeAsset, selection) : [];
  /* the price sits on the value that ends the combination */
  const autoPrice = leafPrice(chain[chain.length - 1]);
  const priceLabel = activeAsset ? priceHeading(activeAsset) : "HARGA";
  const selectedSteps = activeAsset && !isOther ? pathSteps(activeAsset, chain) : [];

  /** Levels to show: the first one, then every level the picked chain reaches. */
  const levelBlocks: {
    level: number;
    label: string | null;
    options: CatalogOptionRow[];
  }[] = [];
  if (activeAsset) {
    let parentId: string | null = null;
    for (let level = 2; level <= MAX_LEVEL; level += 1) {
      const options = childrenOf(activeAsset, parentId);
      if (options.length === 0) break;
      levelBlocks.push({ level, label: levelLabel(activeAsset, level), options });
      const picked = selection[level];
      if (!picked) break;
      parentId = picked;
    }
  }

  /* ---------- handlers ---------- */
  function onScanned(text: string) {
    setScanning(false);
    setError("");
    setInventoryId(text.trim());
    setStep(1);
  }

  async function handlePhotoFile(file: File | null | undefined) {
    if (!file) return;
    setError("");
    try {
      setPhotoData(await fileToWebpDataUrl(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process that photo.");
    }
  }

  function chooseAsset(nextId: string) {
    setAssetId(nextId);
    setSelection({});
    setManualPrice("");
    setError("");
  }

  /** picking a value at a level clears everything below it */
  function chooseValue(level: number, optionId: string) {
    setSelection((prev) => {
      const next: Record<number, string> = { ...prev, [level]: optionId };
      for (let deeper = level + 1; deeper <= MAX_LEVEL; deeper += 1) {
        delete next[deeper];
      }
      return next;
    });
    setError("");
  }

  /* a typed price overrides the listed one; an empty box means "skipped" */
  const manualPriceNumber = Number(manualPrice.replace(/[^0-9.\-]/g, ""));
  const typedPrice =
    manualPrice.trim() !== "" && Number.isFinite(manualPriceNumber)
      ? manualPriceNumber
      : null;
  const effectivePrice = typedPrice ?? autoPrice;

  async function handleSave() {
    if (!asset) return;
    setError("");

    if (!isOther) {
      if (!activeAsset) {
        setError("Choose an asset first.");
        setStep(2);
        return;
      }
      const missing = levelBlocks.find((block) => !selection[block.level]);
      if (missing) {
        setError(
          `Please choose L${missing.level}${missing.label ? ` (${missing.label})` : ""}.`,
        );
        setStep(2);
        return;
      }
    } else if (!otherName.trim()) {
      setError("Describe the asset (Lain-lain).");
      setStep(2);
      return;
    }

    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("You must be signed in.");

      const category = isOther ? "LAIN-LAIN" : activeAsset!.name;
      const match = assetTypes.find(
        (t) => t.name.toLowerCase() === category.toLowerCase(),
      );
      const uncat = assetTypes.find((t) => t.code === "UNCAT");
      const nextTypeId = match?.id ?? uncat?.id ?? asset.type_id;

      const { error: assetError } = await supabase
        .from("assets")
        .update({
          inventory_id: inventoryId.trim() || null,
          type_id: nextTypeId,
          type_text: category,
          status: "ACTIVE",
        })
        .eq("id", asset.id);
      if (assetError) throw assetError;

      const stepValue = (level: number) =>
        selectedSteps.find((step) => step.level_no === level)?.value ?? null;

      const catalogFields = {
        catalog_asset_id: isOther ? null : activeAsset!.id,
        asset_category: category,
        catalog_path: isOther ? null : selectedSteps,
        l2: stepValue(2),
        l3: stepValue(3),
        l4: stepValue(4),
        l5: stepValue(5),
        l6: stepValue(6),
        price: effectivePrice,
        price_manual: typedPrice !== null,
        other_description: isOther ? otherName.trim() : null,
      };

      const base = {
        functional: working,
        condition: (working ? "GOOD" : "NOT_FUNCTIONAL") as
          | "GOOD"
          | "NOT_FUNCTIONAL",
        remarks: remarks.trim() || null,
        photo_webp: photoData,
      };

      if (inspection) {
        const { error: upErr } = await supabase
          .from("inspections")
          .update({ ...base, ...catalogFields })
          .eq("id", inspection.id);
        if (upErr) throw upErr;
      } else {
        const { error: inErr } = await supabase
          .from("inspections")
          .insert({
            asset_id: asset.id,
            inspector_id: user.id,
            ...base,
            ...catalogFields,
          });
        if (inErr) throw inErr;
      }

      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the record.");
    } finally {
      setBusy(false);
    }
  }

  if (!asset) {
    return (
      <Card className="p-6 text-center">
        <p className="text-2xl">🗺️</p>
        <p className="mt-2 font-bold text-zinc-900">No marker selected</p>
        <p className="mt-1 text-sm text-zinc-500">
          Open the Map tab and tap a marker, then press Inspect or Edit.
        </p>
        <Link href="/mobile" className={cn(btnSecondary, "mt-4")}>
          Back to map
        </Link>
      </Card>
    );
  }

  if (done) {
    return (
      <Card className="p-8 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
        <h2 className="mt-3 text-2xl font-bold text-zinc-900">
          {inspection ? "Record updated!" : "Record saved!"}
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          {inventoryId || asset.inventory_id || "No ID-Inventory"} —{" "}
          {assetId === OTHER ? otherName : activeAsset?.name ?? "—"}
          {effectivePrice !== null ? ` · ${money(effectivePrice)}` : ""}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void router.push("/mobile")}
            className="rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
          >
            Back to map
          </button>
          <Link href="/mobile/record" className="text-sm font-semibold text-zinc-500">
            View my records
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4 px-4 pt-4">
      <ol className="flex items-center gap-1">
        {STEPS.map((label, idx) => {
          const state = idx < step ? "done" : idx === step ? "current" : "todo";
          return (
            <li key={label} className="flex flex-1 items-center gap-1">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  state === "done" && "bg-emerald-500 text-white",
                  state === "current" && "bg-amber-500 text-zinc-950",
                  state === "todo" && "bg-zinc-200 text-zinc-500",
                )}
              >
                {state === "done" ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
              </span>
              <span
                className={cn(
                  "text-xs font-semibold",
                  state === "todo" ? "text-zinc-400" : "text-zinc-800",
                )}
              >
                {label}
              </span>
              {idx < STEPS.length - 1 && (
                <span
                  className={cn(
                    "h-px flex-1",
                    idx < step ? "bg-emerald-400" : "bg-zinc-200",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>

      <Card className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
          Marker · No. {asset.seq_no ?? asset.code}
        </p>
        <p className="mt-0.5 truncate text-lg font-bold text-zinc-900">
          {inventoryId || asset.inventory_id || "No ID-Inventory"}
        </p>
      </Card>

      {step === 0 && (
        <Card className="space-y-3 p-5">
          <div>
            <p className="text-sm font-bold text-zinc-900">Enter the ID-Inventory</p>
            <p className="text-xs text-zinc-500">
              Scan the QR plate on the asset, or type its ID manually.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setScanning(true);
              setError("");
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white active:scale-[0.99]"
          >
            <Camera className="h-4 w-4" /> Open QR scanner
          </button>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="h-px flex-1 bg-zinc-200" /> or{" "}
            <span className="h-px flex-1 bg-zinc-200" />
          </div>
          <div>
            <label className={labelCls} htmlFor="inv-id">
              ID-Inventory (manual)
            </label>
            <input
              id="inv-id"
              className={inputCls}
              value={inventoryId}
              onChange={(e) => setInventoryId(e.target.value)}
              placeholder="e.g. INV-0001"
            />
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card className="space-y-3 p-5">
          <div>
            <p className="text-sm font-bold text-zinc-900">Photo</p>
            <p className="text-xs text-zinc-500">
              Take or pick a picture — it is converted to a small WebP image.
            </p>
          </div>
          {photoData ? (
            <div className="flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoData}
                alt="Inspection"
                className="h-24 w-24 rounded-xl border border-zinc-200 object-cover"
              />
              <div className="flex flex-col gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">
                  Replace photo
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      handlePhotoFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setPhotoData(null)}
                  className="rounded-lg px-3 py-1.5 text-left text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  Remove photo
                </button>
              </div>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center hover:border-amber-400 hover:bg-amber-50/40">
              <Camera className="h-7 w-7 text-zinc-400" />
              <span className="text-sm font-semibold text-zinc-700">
                Add / take a photo
              </span>
              <span className="text-xs text-zinc-400">Opens your camera on a phone</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  handlePhotoFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </Card>
      )}
      {step === 2 && (
        <div className="space-y-3">
          {catalogLoading && (
            <Card className="p-3 text-xs text-zinc-500">Loading the catalog…</Card>
          )}

          {!catalogLoading && catalogAssets.length === 0 && (
            <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              The catalog is empty — an admin can build it in{" "}
              <strong>Dashboard → Catalog</strong> (add assets, levels and values) or
              load the <strong>Aset perabot jalan</strong> sheet there.
            </Card>
          )}

          <Card className="space-y-3 p-5">
            <p className="text-sm font-bold text-zinc-900">Asset</p>
            <div className="grid gap-2">
              {catalogAssets.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => chooseAsset(item.id)}
                  className={cn(
                    "rounded-xl border-2 px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                    assetId === item.id
                      ? "border-amber-500 bg-amber-50 text-zinc-900"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300",
                  )}
                >
                  {item.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => chooseAsset(OTHER)}
                className={cn(
                  "rounded-xl border-2 border-dashed px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                  assetId === OTHER
                    ? "border-amber-500 bg-amber-50 text-zinc-900"
                    : "border-zinc-300 text-zinc-600 hover:border-zinc-400",
                )}
              >
                Lain-lain (not in the list)
              </button>
            </div>
          </Card>

          {assetLoading && (
            <Card className="p-3 text-xs text-zinc-500">Loading that asset…</Card>
          )}

          {levelBlocks.map((block) => (
            <Card key={block.level} className="space-y-3 p-5">
              <p className="text-sm font-bold text-zinc-900">
                {block.label ?? `Level ${block.level}`}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {block.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => chooseValue(block.level, option.id)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                      selection[block.level] === option.id
                        ? "bg-amber-500 text-zinc-950"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
                    )}
                  >
                    {option.value}
                  </button>
                ))}
              </div>
            </Card>
          ))}

          {activeAsset && (
            <Card className="space-y-3 p-5">
              <p className="text-sm font-bold text-zinc-900">{priceLabel}</p>
              {autoPrice !== null ? (
                <>
                  <p className="text-2xl font-bold text-emerald-600">
                    {money(autoPrice)}
                  </p>
                  <p className="text-xs text-zinc-500">
                    From the price list — type below only to override it.
                  </p>
                </>
              ) : (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  No price for this combination — leave it empty to skip, or type a
                  price to fill it in.
                </p>
              )}
              <input
                className={inputCls}
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
                placeholder={
                  autoPrice !== null ? "Override price (optional)" : "Price (optional)"
                }
                inputMode="decimal"
              />
              {typedPrice !== null && autoPrice !== null && typedPrice !== autoPrice ? (
                <p className="text-xs font-semibold text-amber-700">
                  Saving {money(typedPrice)} instead of the listed {money(autoPrice)}.
                </p>
              ) : null}
            </Card>
          )}

          {assetId === OTHER && (
            <Card className="space-y-3 p-5">
              <p className="text-sm font-bold text-zinc-900">
                Lain-lain — describe it
              </p>
              <div>
                <label className={labelCls} htmlFor="other-name">
                  Asset / keterangan (manual)
                </label>
                <input
                  id="other-name"
                  className={inputCls}
                  value={otherName}
                  onChange={(e) => setOtherName(e.target.value)}
                  placeholder="e.g. Custom bollard"
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="other-price">
                  Price (manual, optional)
                </label>
                <input
                  id="other-price"
                  className={inputCls}
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                  placeholder="Leave empty to skip"
                  inputMode="decimal"
                />
              </div>
            </Card>
          )}
        </div>
      )}
      {step === 3 && (
        <div className="space-y-3">
          <Card className="space-y-3 p-5">
            <p className="text-sm font-bold text-zinc-900">Is it working?</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setWorking(true)}
                className={cn(
                  "rounded-xl border-2 px-3 py-4 text-sm font-bold transition-colors",
                  working
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                    : "border-zinc-200 text-zinc-500 hover:border-zinc-300",
                )}
              >
                ✅ Working
              </button>
              <button
                type="button"
                onClick={() => setWorking(false)}
                className={cn(
                  "rounded-xl border-2 px-3 py-4 text-sm font-bold transition-colors",
                  !working
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-zinc-200 text-zinc-500 hover:border-zinc-300",
                )}
              >
                ⛔ Not working
              </button>
            </div>
          </Card>

          <Card className="space-y-3 p-5">
            <div>
              <p className="text-sm font-bold text-zinc-900">Remarks</p>
              <p className="text-xs text-zinc-500">Optional notes for this record.</p>
            </div>
            <textarea
              className={`${inputCls} min-h-24 resize-y`}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Bulb flickers at night, post is leaning…"
            />
          </Card>

          <Card className="space-y-1.5 p-4 text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Summary
            </p>
            <div className="flex justify-between gap-3">
              <span className="text-zinc-500">Asset</span>
              <span className="text-right font-semibold text-zinc-800">
                {assetId === OTHER
                  ? otherName || "Lain-lain"
                  : activeAsset?.name ?? "—"}
              </span>
            </div>
            {selectedSteps.map((step) => (
              <div key={step.level_no} className="flex justify-between gap-3">
                <span className="text-zinc-500">
                  {step.label ?? `Level ${step.level_no}`}
                </span>
                <span className="text-right text-zinc-800">{step.value}</span>
              </div>
            ))}
            <div className="flex justify-between gap-3 border-t border-zinc-100 pt-1.5">
              <span className="text-zinc-500">{priceLabel}</span>
              <span className="text-right font-bold text-zinc-900">
                {effectivePrice !== null ? money(effectivePrice) : "Skipped"}
              </span>
            </div>
          </Card>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="sticky bottom-3 z-30 flex gap-2 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || busy}
          className="rounded-lg px-4 py-2.5 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-40"
        >
          Back
        </button>
        <div className="flex-1" />
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            disabled={
              busy ||
              (step === 0 && inventoryId.trim() === "") ||
              (step === 2 &&
                (assetId === ""
                  ? true
                  : assetId === OTHER
                    ? otherName.trim() === ""
                    : !activeAsset ||
                      levelBlocks.some((block) => !selection[block.level])))
            }
            className="rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-bold text-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-bold text-zinc-950 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {busy ? "Saving…" : inspection ? "Save changes" : "Save record"}
          </button>
        )}
      </div>

      {scanning && (
        <QrScannerOverlay
          onDecoded={onScanned}
          onClose={() => setScanning(false)}
        />
      )}
    </div>
  );
}

