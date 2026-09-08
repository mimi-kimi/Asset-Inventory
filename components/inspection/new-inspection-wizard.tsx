"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  Loader2,
  MapPin,
  Navigation,
  Plus,
  Search,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PHOTO_BUCKET } from "@/lib/env";
import { CONDITION_META, CONDITION_ORDER, cn } from "@/lib/format";
import type { AssetType, Condition } from "@/lib/types";
import { btnGhost, btnPrimary, Card, inputCls, labelCls, selectCls } from "@/components/ui";

interface AssetLite {
  id: string;
  code: string;
  type_id: string;
  location: string | null;
  lat: number | null;
  lng: number | null;
}

const STEPS = ["Asset", "Findings", "Location & photo"];

function parseCoord(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function NewInspectionWizard({
  assetTypes,
}: {
  assetTypes: AssetType[];
}) {
  const supabase = createClient();

  /* wizard state */
  const [step, setStep] = useState(0);
  const [assetMode, setAssetMode] = useState<"existing" | "new">("existing");
  const [assets, setAssets] = useState<AssetLite[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [newAsset, setNewAsset] = useState({
    code: "",
    type_id: assetTypes[0]?.id ?? "",
    location: "",
  });
  const [condition, setCondition] = useState<Condition | null>(null);
  const [functional, setFunctional] = useState(true);
  const [remarks, setRemarks] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");
  const [gpsState, setGpsState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ inspectionId: string; code: string } | null>(null);

  /* load assets when the type filter changes */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let q = supabase
          .from("assets")
          .select("id, code, type_id, location, lat, lng")
          .eq("status", "ACTIVE")
          .order("code")
          .limit(500);
        if (typeFilter !== "all") q = q.eq("type_id", typeFilter);
        const { data, error: fetchError } = await q;
        if (alive) setAssets(fetchError ? [] : ((data ?? []) as AssetLite[]));
      } finally {
        if (alive) setLoadingAssets(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter]);

  const filteredAssets = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return assets;
    return assets.filter(
      (a) =>
        a.code.toLowerCase().includes(term) ||
        (a.location ?? "").toLowerCase().includes(term),
    );
  }, [assets, query]);

  const selectedAsset =
    assets.find((a) => a.id === selectedAssetId) ?? null;

  const typeName = (typeId: string): string => {
    const t = assetTypes.find((x) => x.id === typeId);
    return t ? `${t.icon ? t.icon + " " : ""}${t.name}` : "Unknown type";
  };

  function pickAsset(id: string) {
    setSelectedAssetId(id);
    setError("");
    const a = assets.find((x) => x.id === id);
    if (a) {
      setLatInput(a.lat?.toString() ?? "");
      setLngInput(a.lng?.toString() ?? "");
    }
  }

  function changeTypeFilter(value: string) {
    setTypeFilter(value);
    setLoadingAssets(true);
  }

  function resetAll() {
    setDone(null);
    setStep(0);
    setAssetMode("existing");
    setSelectedAssetId(null);
    setCondition(null);
    setFunctional(true);
    setRemarks("");
    setPhotos([]);
    setLatInput("");
    setLngInput("");
    setGpsState("idle");
    setNewAsset({ code: "", type_id: assetTypes[0]?.id ?? "", location: "" });
    setError("");
    setQuery("");
  }

  function handleUseGps() {
    setGpsState("loading");
    setError("");
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsState("error");
      setError("GPS is not available in this browser. Enter coordinates manually.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLatInput(latitude.toFixed(6));
        setLngInput(longitude.toFixed(6));
        setGpsState("ok");
      },
      () => {
        setGpsState("error");
        setError("Could not read your location. Enter coordinates manually.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function addPhotos(fileList: FileList | null) {
    if (!fileList) return;
    setError("");
    const files = Array.from(fileList).slice(0, 4 - photos.length);
    if (files.length) setPhotos((prev) => [...prev, ...files]);
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  function canNext(): boolean {
    if (step === 0) {
      return assetMode === "new"
        ? Boolean(newAsset.code.trim() && newAsset.type_id)
        : Boolean(selectedAssetId);
    }
    if (step === 1) return Boolean(condition);
    return true;
  }

  async function handleSave() {
    setError("");
    if (!condition) {
      setStep(1);
      setError("Pick the asset's condition first.");
      return;
    }

    setBusy(true);
    try {
      let assetId = "";
      let code = "";

      if (assetMode === "new") {
        code = newAsset.code.trim().toUpperCase();
        const latN = parseCoord(latInput);
        const lngN = parseCoord(lngInput);
        const { data, error: insertError } = await supabase
          .from("assets")
          .insert({
            code,
            type_id: newAsset.type_id,
            location: newAsset.location.trim() || null,
            lat: latN,
            lng: lngN,
            status: "ACTIVE",
          })
          .select("id")
          .single();
        if (insertError) throw insertError;
        assetId = data?.id ?? "";
      } else if (selectedAssetId) {
        assetId = selectedAssetId;
        code = selectedAsset?.code ?? "";
      }

      if (!assetId) throw new Error("No asset selected.");

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be signed in.");

      const { data: inspection, error: inspError } = await supabase
        .from("inspections")
        .insert({
          asset_id: assetId,
          inspector_id: user.id,
          condition,
          functional,
          remarks: remarks.trim() || null,
        })
        .select("id")
        .single();
      if (inspError) throw inspError;
      const inspectionId: string = inspection?.id ?? "";

      const uploaded: string[] = [];
      for (let i = 0; i < photos.length; i += 1) {
        const path = `inspections/${inspectionId}/${Date.now()}-${i}.jpg`;
        const { error: upErr } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(path, photos[i], { upsert: true, contentType: photos[i].type });
        if (upErr) throw upErr;
        const url = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
        uploaded.push(url);
      }
      if (uploaded.length) {
        const { error: photosError } = await supabase
          .from("inspection_photos")
          .insert(uploaded.map((photo_url) => ({ inspection_id: inspectionId, photo_url })));
        if (photosError) throw photosError;
      }

      setDone({ inspectionId, code: code || selectedAsset?.code || "" });
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the inspection.");
    } finally {
      setBusy(false);
    }
  }

  const goNext = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  if (done) {
    return (
      <Card className="p-8 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
        <h2 className="mt-3 text-2xl font-bold text-zinc-900">Report saved!</h2>
        <p className="mt-1 text-sm text-zinc-500">
          {done.code ? `Inspection for ${done.code}` : "Inspection"} recorded
          successfully.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href={`/inspect/${done.inspectionId}`}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
          >
            View this report
          </Link>
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Do another inspection
          </button>
          <Link
            href="/inspect"
            className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-zinc-500 hover:text-zinc-800"
          >
            Back to my reports
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Step progress */}
      <ol className="flex items-center gap-1">
        {STEPS.map((label, idx) => {
          const state =
            idx < step ? "done" : idx === step ? "current" : "todo";
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
                {state === "done" ? <Check className="h-4 w-4" /> : idx + 1}
              </span>
              <span
                className={cn(
                  "hidden text-xs font-semibold sm:inline",
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

      {error && (
        <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <Card className="p-4 sm:p-5">{step === 0 && (
  <div className="space-y-4">
    <div>
      <h2 className="text-lg font-bold text-zinc-900">
        Which asset are you inspecting?
      </h2>
      <p className="text-sm text-zinc-500">
        Find it in the list, or register a new one on the spot.
      </p>
    </div>

    <div className="flex rounded-xl bg-zinc-100 p-1">
      <button
        type="button"
        onClick={() => setAssetMode("existing")}
        className={cn(
          "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
          assetMode === "existing"
            ? "bg-white text-zinc-900 shadow-sm"
            : "text-zinc-500 hover:text-zinc-800",
        )}
      >
        <Search className="h-4 w-4" /> Use existing
      </button>
      <button
        type="button"
        onClick={() => setAssetMode("new")}
        className={cn(
          "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
          assetMode === "new"
            ? "bg-white text-zinc-900 shadow-sm"
            : "text-zinc-500 hover:text-zinc-800",
        )}
      >
        <Plus className="h-4 w-4" /> Register new
      </button>
    </div>

    {assetMode === "existing" ? (
      <>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-400" />
          <input
            className={`${inputCls} pl-9 pr-9`}
            placeholder="Search code or location…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-2 rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => changeTypeFilter("all")}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold",
              typeFilter === "all"
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-600",
            )}
          >
            All
          </button>
          {assetTypes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => changeTypeFilter(typeFilter === t.id ? "all" : t.id)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold",
                typeFilter === t.id
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-600",
              )}
            >
              {t.icon ? `${t.icon} ` : ""}
              {t.name}
            </button>
          ))}
        </div>

                {loadingAssets ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading assets…
          </p>
        ) : filteredAssets.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-400">
            No matching assets. Try another filter — or register it as new.
          </p>
        ) : (
          <ul className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
            {filteredAssets.map((a) => {
              const isSelected = selectedAssetId === a.id;
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => pickAsset(a.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-colors",
                      isSelected
                        ? "border-amber-500 bg-amber-50"
                        : "border-zinc-200 bg-white hover:border-zinc-300",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-zinc-900">
                        {a.code}{" "}
                        <span className="font-medium text-zinc-400">
                          · {typeName(a.type_id)}
                        </span>
                      </p>
                      <p className="flex items-center gap-1 truncate text-xs text-zinc-500">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {a.location ?? "No location recorded"}
                      </p>
                    </div>
                    {isSelected && (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-zinc-950">
                        <Check className="h-4 w-4" />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </>
    ) : (
      <div className="space-y-3 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/60 p-4">
        <p className="text-sm font-semibold text-zinc-900">New asset details</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="new-code">
              Code
            </label>
            <input
              id="new-code"
              className={inputCls}
              placeholder="e.g. SL-014"
              value={newAsset.code}
              onChange={(e) =>
                setNewAsset((prev) => ({ ...prev, code: e.target.value }))
              }
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="new-type">
              Type
            </label>
            <select
              id="new-type"
              className={selectCls}
              value={newAsset.type_id}
              onChange={(e) =>
                setNewAsset((prev) => ({ ...prev, type_id: e.target.value }))
              }
            >
              {assetTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls} htmlFor="new-location">
            Location / address
          </label>
          <input
            id="new-location"
            className={inputCls}
            placeholder="e.g. Corner of Mabini &amp; Rizal"
            value={newAsset.location}
            onChange={(e) =>
              setNewAsset((prev) => ({ ...prev, location: e.target.value }))
            }
          />
        </div>
        <p className="text-xs text-zinc-500">
          You can still add GPS coordinates in the last step.
        </p>
      </div>
    )}
  </div>
)}
{step === 1 && (
  <div className="space-y-5">
    <div>
      <h2 className="text-lg font-bold text-zinc-900">How is it looking?</h2>
      <p className="text-sm text-zinc-500">
        Rate the condition of{" "}
        <span className="font-semibold text-zinc-800">
          {(selectedAsset?.code ?? newAsset.code.toUpperCase()) || "this asset"}
        </span>
        .
      </p>
    </div>

    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {CONDITION_ORDER.map((c) => {
        const meta = CONDITION_META[c];
        const active = condition === c;
        return (
          <button
            key={c}
            type="button"
            onClick={() => {
              setCondition(c);
              setError("");
            }}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-2xl border-2 px-2 py-4 transition-all",
              active
                ? "border-amber-500 bg-amber-50 ring-2 ring-amber-500/30"
                : "border-zinc-200 bg-white hover:border-zinc-300 active:scale-95",
            )}
          >
            <span className="text-3xl">{meta.emoji}</span>
            <span className="text-sm font-bold text-zinc-900">{meta.label}</span>
          </button>
        );
      })}
    </div>

    <div>
      <p className={labelCls}>Is it working?</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setFunctional(true)}
          className={cn(
            "flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-bold transition-colors",
            functional
              ? "border-emerald-500 bg-emerald-50 text-emerald-800"
              : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300",
          )}
        >
          <span className="text-xl">✅</span> Functional
        </button>
        <button
          type="button"
          onClick={() => setFunctional(false)}
          className={cn(
            "flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-bold transition-colors",
            !functional
              ? "border-red-500 bg-red-50 text-red-700"
              : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300",
          )}
        >
          <span className="text-xl">⛔</span> Not functional
        </button>
      </div>
    </div>

    <div>
      <label className={labelCls} htmlFor="remarks">
        Remarks (optional)
      </label>
      <textarea
        id="remarks"
        className={`${inputCls} min-h-24 resize-y`}
        placeholder="Loose sign post, bulb flickering, faded paint…"
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
      />
    </div>
  </div>
)}
{step === 2 && (
  <div className="space-y-5">
    <div>
      <h2 className="text-lg font-bold text-zinc-900">Location &amp; photo</h2>
      <p className="text-sm text-zinc-500">
        The asset&apos;s position and a photo make the report much more useful.
      </p>
    </div>

    {/* Coordinates */}
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900">
        <MapPin className="h-4 w-4 text-zinc-400" /> GPS coordinates
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="lat">
            Latitude
          </label>
          <input
            id="lat"
            className={inputCls}
            value={latInput}
            onChange={(e) => setLatInput(e.target.value)}
            placeholder="14.599512"
            inputMode="decimal"
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="lng">
            Longitude
          </label>
          <input
            id="lng"
            className={inputCls}
            value={lngInput}
            onChange={(e) => setLngInput(e.target.value)}
            placeholder="120.984222"
            inputMode="decimal"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={handleUseGps}
        disabled={gpsState === "loading"}
        className={btnGhost}
      >
        {gpsState === "loading" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Navigation className="h-4 w-4" />
        )}
        {gpsState === "ok" ? "Location captured ✓" : "Use my current location"}
      </button>
      {selectedAsset?.location && (
        <p className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
          📍 {selectedAsset.location}
        </p>
      )}
    </div>

    {/* Photos */}
    <div className="space-y-3">
      <p className="text-sm font-semibold text-zinc-900">
        Photos <span className="font-normal text-zinc-400">({photos.length}/4)</span>
      </p>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center transition-colors hover:border-amber-400 hover:bg-amber-50/50">
        <Camera className="h-8 w-8 text-zinc-400" />
        <span className="text-sm font-semibold text-zinc-700">
          Take or upload photos
        </span>
        <span className="text-xs text-zinc-400">
          Opens your camera on a phone — up to 4 images
        </span>
        <input
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="hidden"
          onChange={(e) => {
            addPhotos(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((file, idx) => (
            <div
              key={`${file.name}-${idx}`}
              className="relative aspect-square overflow-hidden rounded-xl border border-zinc-200"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={URL.createObjectURL(file)}
                alt={`Photo ${idx + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removePhoto(idx)}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-950/70 text-white hover:bg-red-600"
                aria-label="Remove photo"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>

    {/* Summary */}
    <div className="flex items-center justify-between gap-3 rounded-xl bg-zinc-100 px-4 py-3 text-sm">
      <span className="min-w-0 truncate font-bold text-zinc-900">
        {(selectedAsset?.code ?? newAsset.code.toUpperCase()) || "New asset"}
      </span>
      <span className="shrink-0 font-semibold text-zinc-500">
        {condition ? CONDITION_META[condition].label : "No condition"}
        {!functional ? " · Not working" : ""}
      </span>
    </div>
  </div>
)}
</Card>

      {/* Nav buttons */}
      <div className="sticky bottom-3 z-10 flex gap-2 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0 || busy}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex-1" />
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={goNext}
            disabled={!canNext()}
            className={cn(
              btnPrimary,
              "px-6 py-2.5 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400",
            )}
          >
            Next <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSave}
            disabled={busy || !canNext()}
            className={cn(
              btnPrimary,
              "px-6 py-2.5 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400",
            )}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                Save report <Check className="h-4 w-4" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

