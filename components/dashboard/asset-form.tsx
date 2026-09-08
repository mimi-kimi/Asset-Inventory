"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PHOTO_BUCKET } from "@/lib/env";
import type { AssetRow, AssetType } from "@/lib/types";
import {
  btnPrimary,
  btnSecondary,
  Card,
  FieldLabel,
  inputCls,
  selectCls,
  textareaCls,
} from "@/components/ui";

export function AssetForm({
  assetTypes,
  asset,
}: {
  assetTypes: AssetType[];
  asset?: AssetRow;
}) {
  const router = useRouter();
  const supabase = createClient();
  const isEdit = Boolean(asset);

  const [code, setCode] = useState(asset?.code ?? "");
  const [typeId, setTypeId] = useState(asset?.type_id ?? assetTypes[0]?.id ?? "");
  const [location, setLocation] = useState(asset?.location ?? "");
  const [lat, setLat] = useState(asset?.lat?.toString() ?? "");
  const [lng, setLng] = useState(asset?.lng?.toString() ?? "");
  const [status, setStatus] = useState(asset?.status ?? "ACTIVE");
  const [installedDate, setInstalledDate] = useState(
    asset?.installed_date?.slice(0, 10) ?? "",
  );
  const [notes, setNotes] = useState(asset?.notes ?? "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toNumber(raw: string): number | null {
    if (!raw.trim()) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
  }

  async function uploadPhoto(id: string, file: File): Promise<string | null> {
    const path = `assets/${id}/cover-${Date.now()}.jpg`;
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const latN = toNumber(lat);
    const lngN = toNumber(lng);
    if (Number.isNaN(latN as number) || Number.isNaN(lngN as number)) {
      setError("Latitude and longitude must be numbers.");
      return;
    }
    if (!code.trim()) {
      setError("Asset code is required.");
      return;
    }
    if (!typeId) {
      setError("Please choose an asset type.");
      return;
    }

    const payload = {
      code: code.trim().toUpperCase(),
      type_id: typeId,
      location: location.trim() || null,
      lat: latN,
      lng: lngN,
      status,
      installed_date: installedDate || null,
      notes: notes.trim() || null,
    };

    setBusy(true);
    try {
      if (isEdit && asset) {
        const { error: updateError } = await supabase
          .from("assets")
          .update(payload)
          .eq("id", asset.id);
        if (updateError) throw updateError;
        if (photoFile) {
          const url = await uploadPhoto(asset.id, photoFile);
          if (url) {
            const { error } = await supabase
              .from("assets")
              .update({ photo_url: url })
              .eq("id", asset.id);
            if (error) throw error;
          }
        }
      } else {
        const { data: created, error: insertError } = await supabase
          .from("assets")
          .insert(payload)
          .select("id")
          .single();
        if (insertError) throw insertError;
        if (photoFile && created) {
          const url = await uploadPhoto(created.id, photoFile);
          if (url) {
            const { error } = await supabase
              .from("assets")
              .update({ photo_url: url })
              .eq("id", created.id);
            if (error) throw error;
          }
        }
      }
      router.push("/dashboard/assets");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the asset.");
      setBusy(false);
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="code" required>Asset code</FieldLabel>
            <input id="code" className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. TL-0007" disabled={isEdit} />
          </div>
          <div>
            <FieldLabel htmlFor="type" required>Asset type</FieldLabel>
            <select id="type" className={selectCls} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              {assetTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.icon ? `${t.icon} ` : ""}
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="location">Location / address</FieldLabel>
            <input id="location" className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. National Highway, near KM marker 12" />
          </div>
          <div>
            <FieldLabel htmlFor="lat">Latitude</FieldLabel>
            <input id="lat" className={inputCls} value={lat} onChange={(e) => setLat(e.target.value)} placeholder="14.5995" inputMode="decimal" />
          </div>
          <div>
            <FieldLabel htmlFor="lng">Longitude</FieldLabel>
            <input id="lng" className={inputCls} value={lng} onChange={(e) => setLng(e.target.value)} placeholder="120.9842" inputMode="decimal" />
          </div>
          <div>
            <FieldLabel htmlFor="status">Status</FieldLabel>
            <select id="status" className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as "ACTIVE" | "INACTIVE")}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive / removed</option>
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="installed">Installed date</FieldLabel>
            <input id="installed" type="date" className={inputCls} value={installedDate} onChange={(e) => setInstalledDate(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="notes">Notes</FieldLabel>
            <textarea id="notes" className={textareaCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything worth noting about this asset." />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="photo">Photo</FieldLabel>
            <input id="photo" type="file" accept="image/*" className={inputCls} onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-zinc-100 pt-4">
          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEdit ? "Save changes" : "Create asset"}
          </button>
          <Link href="/dashboard/assets" className={btnSecondary}>
            Cancel
          </Link>
        </div>
      </form>
    </Card>
  );
}
