"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, Loader2, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fileToWebpDataUrl } from "@/lib/image";
import { cn } from "@/lib/format";
import type { AssetRow, AssetType, CatalogPrice, InspectionRow } from "@/lib/types";
import {
  CATALOG_ASSETS,
  CATALOG_BY_KEY,
  levelsOf,
  matchCatalogAsset,
} from "@/lib/catalog-data";
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

  /* ---------- prices (structure comes from lib/catalog-data.ts) ---------- */
  const [prices, setPrices] = useState<CatalogPrice[]>([]);
  const [pricesLoading, setPricesLoading] = useState(true);
  const [assetId, setAssetId] = useState<string>(
    inspection?.catalog_asset_key ??
      matchCatalogAsset(inspection?.asset_category)?.key ??
      "",
  );
  const [selection, setSelection] = useState<Record<number, string>>({
    2: inspection?.l2 ?? "",
    3: inspection?.l3 ?? "",
    4: inspection?.l4 ?? "",
    5: inspection?.l5 ?? "",
  });
  const [manualPrice, setManualPrice] = useState(
    inspection?.price_manual &&
      inspection.price !== null &&
      inspection.price !== undefined
      ? String(inspection.price)
      : "",
  );
  const [skipPrice, setSkipPrice] = useState(
    Boolean(inspection) && inspection?.price === null && !inspection?.price_manual,
  );
  const [otherName, setOtherName] = useState(inspection?.other_description ?? "");

  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  /* ---------- load the stored prices once ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase
          .from("catalog_prices")
          .select("id, asset_key, l2, l3, l4, l5, price");
        if (!alive) return;
        setPrices((data ?? []) as CatalogPrice[]);
      } catch {
        /* prices not imported yet — the Asset step asks for a manual price */
      } finally {
        if (alive) setPricesLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- derived catalog helpers ---------- */
  /** selectable values for a level (hardcoded structure) */
  function optionsFor(assetKey: string, level: number): string[] {
    const def = CATALOG_BY_KEY[assetKey];
    if (!def) return [];
    return [...(def.options[level as 2 | 3 | 4 | 5] ?? [])];
  }

  /** price for the whole L1..L5 combination (null = not in the price table) */
  function priceFor(assetKey: string, levels: { level: number }[]): number | null {
    const wanted = (k: number) =>
      levels.some((l) => l.level === k) ? selection[k] ?? "" : "";
    const row = prices.find(
      (p) =>
        p.asset_key === assetKey &&
        p.l2 === wanted(2) &&
        p.l3 === wanted(3) &&
        p.l4 === wanted(4) &&
        p.l5 === wanted(5),
    );
    return row ? row.price : null;
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
    setSelection({ 2: "", 3: "", 4: "", 5: "" });
    setManualPrice("");
    setSkipPrice(false);
    setError("");
  }

  function chooseValue(level: number, value: string) {
    setSelection((prev) => {
      const next: Record<number, string> = { ...prev, [level]: value };
      for (let k = level + 1; k <= 5; k += 1) next[k] = "";
      return next;
    });
    setError("");
  }

  const chosenAsset =
    assetId && assetId !== OTHER ? CATALOG_BY_KEY[assetId] ?? null : null;
  const activeLevels = chosenAsset ? levelsOf(chosenAsset) : [];
  const autoPrice = chosenAsset ? priceFor(chosenAsset.key, activeLevels) : null;
  const manualPriceNumber = Number(manualPrice.replace(/[^0-9.\-]/g, ""));
  const effectivePrice =
    autoPrice !== null
      ? autoPrice
      : skipPrice
        ? null
        : Number.isFinite(manualPriceNumber) && manualPrice.trim() !== ""
          ? manualPriceNumber
          : null;

  async function handleSave() {
    if (!asset) return;
    setError("");

    const isOther = assetId === OTHER;
    if (!isOther) {
      if (!chosenAsset) {
        setError("Choose an asset first.");
        setStep(2);
        return;
      }
      for (const l of activeLevels) {
        if (!selection[l.level]) {
          setError(`Please choose L${l.level} (${l.label}).`);
          setStep(2);
          return;
        }
      }
      if (autoPrice === null && !skipPrice && manualPrice.trim() === "") {
        setError(
          "This combination has no price in the sheet — enter a price or press Skip price.",
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

      const category = isOther ? "LAIN-LAIN" : chosenAsset!.name;
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

      const catalogFields = {
        catalog_asset_key: isOther ? null : chosenAsset!.key,
        asset_category: category,
        l2: isOther ? null : selection[2] || null,
        l3: isOther ? null : selection[3] || null,
        l4: isOther ? null : selection[4] || null,
        l5: isOther ? null : selection[5] || null,
        price: effectivePrice,
        price_manual: autoPrice === null && effectivePrice !== null,
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
          {assetId === OTHER ? otherName : chosenAsset?.name ?? "—"}
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
          {pricesLoading && (
            <Card className="p-3 text-xs text-zinc-500">Loading stored prices…</Card>
          )}

          {!pricesLoading && prices.length === 0 && (
            <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              No prices imported yet — pick the values below, then type the price or press{" "}
              <strong>Skip price</strong>. An admin can import the{" "}
              <strong>Aset perabot jalan</strong> sheet from{" "}
              <strong>Dashboard → Catalog</strong>.
            </Card>
          )}

          <Card className="space-y-3 p-5">
            <p className="text-sm font-bold text-zinc-900">L1 · Asset</p>
            <div className="grid gap-2">
              {CATALOG_ASSETS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => chooseAsset(a.key)}
                  className={cn(
                    "rounded-xl border-2 px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                    assetId === a.key
                      ? "border-amber-500 bg-amber-50 text-zinc-900"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300",
                  )}
                >
                  {a.name}
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

          {chosenAsset &&
            activeLevels.map((l) => {
              if (l.level > 2 && !selection[l.level - 1]) return null;
              const options = optionsFor(chosenAsset.key, l.level);
              return (
                <Card key={l.level} className="space-y-3 p-5">
                  <p className="text-sm font-bold text-zinc-900">
                    L{l.level} · {l.label}
                  </p>
                  {options.length === 0 ? (
                    <p className="text-xs text-zinc-400">
                      No options available for the choices above.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {options.map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => chooseValue(l.level, value)}
                          className={cn(
                            "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                            selection[l.level] === value
                              ? "bg-amber-500 text-zinc-950"
                              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
                          )}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          {chosenAsset && (
            <Card className="space-y-3 p-5">
              <p className="text-sm font-bold text-zinc-900">L6 · Price</p>
              {autoPrice !== null ? (
                <>
                  <p className="text-2xl font-bold text-emerald-600">
                    {money(autoPrice)}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Filled automatically from the price list.
                  </p>
                </>
              ) : (
                <>
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    This combination has no price in the list — enter it, or skip.
                  </p>
                  <input
                    className={inputCls}
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)}
                    placeholder="e.g. 45000"
                    inputMode="decimal"
                    disabled={skipPrice}
                  />
                  <label className="flex items-center gap-2 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      checked={skipPrice}
                      onChange={(e) => setSkipPrice(e.target.checked)}
                      className="h-4 w-4 rounded border-zinc-300"
                    />
                    Skip price
                  </label>
                </>
              )}
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
                  Price (manual)
                </label>
                <input
                  id="other-price"
                  className={inputCls}
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                  placeholder="e.g. 300"
                  inputMode="decimal"
                  disabled={skipPrice}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={skipPrice}
                  onChange={(e) => setSkipPrice(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                Skip price
              </label>
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
                  : chosenAsset?.name ?? "—"}
              </span>
            </div>
            {activeLevels.map((l) => (
              <div key={l.level} className="flex justify-between gap-3">
                <span className="text-zinc-500">
                  L{l.level} · {l.label}
                </span>
                <span className="text-right text-zinc-800">
                  {selection[l.level] || "—"}
                </span>
              </div>
            ))}
            <div className="flex justify-between gap-3 border-t border-zinc-100 pt-1.5">
              <span className="text-zinc-500">Price (L6)</span>
              <span className="text-right font-bold text-zinc-900">
                {effectivePrice !== null
                  ? money(effectivePrice)
                  : skipPrice
                    ? "Skipped"
                    : "—"}
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
                    : !chosenAsset ||
                      activeLevels.some((l) => !selection[l.level]) ||
                      (autoPrice === null &&
                        !skipPrice &&
                        manualPrice.trim() === "")))
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

