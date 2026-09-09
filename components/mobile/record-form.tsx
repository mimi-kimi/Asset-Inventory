"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, Loader2, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/format";
import type { AssetRow, AssetType, InspectionRow } from "@/lib/types";
import { btnSecondary, Card, inputCls, labelCls, selectCls } from "@/components/ui";
import { QrScannerOverlay } from "@/components/mobile/qr-scanner";

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

  const initialTypeId =
    asset?.type_id ||
    (asset?.type_text
      ? assetTypes.find(
          (t) =>
            t.name.toLowerCase() === (asset.type_text ?? "").toLowerCase(),
        )?.id
      : undefined) ||
    assetTypes[0]?.id ||
    "";

  const needsIdCapture = Boolean(asset && !asset.inventory_id && !inspection);

  const [step, setStep] = useState(needsIdCapture ? 0 : 1);
  const [inventoryId, setInventoryId] = useState(asset?.inventory_id ?? "");
  const [typeId, setTypeId] = useState(initialTypeId);
  const [working, setWorking] = useState(inspection?.functional ?? true);
  const [remarks, setRemarks] = useState(inspection?.remarks ?? "");
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  function onScanned(text: string) {
    setScanning(false);
    setError("");
    setInventoryId(text.trim());
    setStep(1);
  }

  async function handleSave() {
    if (!asset) return;
    setError("");
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("You must be signed in.");

      const chosenType = assetTypes.find((t) => t.id === typeId);
      const typeText = chosenType?.name ?? null;

      // associate the plate ID + type with the marker/asset
      const { error: assetError } = await supabase
        .from("assets")
        .update({
          inventory_id: inventoryId.trim() || null,
          type_id: typeId,
          type_text: typeText,
          status: "ACTIVE",
        })
        .eq("id", asset.id);
      if (assetError) throw assetError;

      const payload = {
        asset_id: asset.id,
        inspector_id: user.id,
        functional: working,
        condition: (working ? "GOOD" : "NOT_FUNCTIONAL") as
          | "GOOD"
          | "NOT_FUNCTIONAL",
        remarks: remarks.trim() || null,
      };

      if (inspection) {
        const { error: upErr } = await supabase
          .from("inspections")
          .update({
            functional: working,
            condition: payload.condition,
            remarks: remarks.trim() || null,
          })
          .eq("id", inspection.id);
        if (upErr) throw upErr;
      } else {
        const { error: inErr } = await supabase
          .from("inspections")
          .insert(payload);
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
          {asset.seq_no ? `Marker No. ${asset.seq_no} · ` : ""}
          {inventoryId || asset.inventory_id || asset.code} —{" "}
          {working ? "working" : "not working"}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              setDone(false);
              router.push("/mobile");
              router.refresh();
            }}
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
      <Link
        href="/mobile"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500 hover:text-zinc-800"
      >
        ← Back to map
      </Link>

      {inspection && (
        <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700">
          ✏️ Editing the existing record for this marker.
        </p>
      )}

      <Card className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
          Marker · No. {asset.seq_no ?? asset.code}
        </p>
        <p className="mt-0.5 truncate text-lg font-bold text-zinc-900">
          {inventoryId || asset.inventory_id || "No ID-Inventory yet"}
        </p>
        <p className="text-xs text-zinc-500">
          {asset.type_text || asset.asset_types?.name || "Type not set"}
          {asset.lat != null && asset.lng != null
            ? ` · ${asset.lat.toFixed(5)}, ${asset.lng.toFixed(5)}`
            : ""}
        </p>
      </Card>

      {step === 0 ? (
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
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            type="button"
            disabled={!inventoryId.trim()}
            onClick={() => setStep(1)}
            className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </Card>
      ) : (
        <div className="space-y-3">
          <Card className="space-y-3 p-5">
            <div>
              <p className="text-sm font-bold text-zinc-900">Asset type</p>
              <p className="text-xs text-zinc-500">
                Confirm what kind of asset this is.
              </p>
            </div>
            <select
              className={selectCls}
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
            >
              {assetTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.icon ? `${t.icon} ` : ""}
                  {t.name}
                </option>
              ))}
            </select>
          </Card>

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
              <p className="text-xs text-zinc-500">
                Optional notes for this record.
              </p>
            </div>
            <textarea
              className={`${inputCls} min-h-24 resize-y`}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Bulb flickers at night, post is leaning…"
            />
          </Card>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3.5 text-sm font-bold text-zinc-950 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {busy ? "Saving…" : inspection ? "Save changes" : "Save record"}
          </button>
        </div>
      )}

      {scanning && (
        <QrScannerOverlay
          onDecoded={onScanned}
          onClose={() => setScanning(false)}
        />
      )}
    </div>
  );
}
