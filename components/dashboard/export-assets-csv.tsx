"use client";

import { Download } from "lucide-react";
import { downloadFile } from "@/lib/format";
import { btnSecondary } from "@/components/ui";

export interface ExportableAsset {
  code: string;
  type: string;
  location: string | null;
  status: string;
  lat: number | null;
  lng: number | null;
  installed_date: string | null;
}

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function ExportAssetsCsv({
  rows,
  filename = "road-assets.csv",
}: {
  rows: ExportableAsset[];
  filename?: string;
}) {
  const header = ["Code", "Type", "Location", "Status", "Latitude", "Longitude", "Installed"];
  const body = rows.map((r) =>
    [r.code, r.type, r.location, r.status, r.lat, r.lng, r.installed_date]
      .map(csvCell)
      .join(","),
  );
  const csv = [header.join(","), ...body].join("\n");

  return (
    <button
      type="button"
      className={btnSecondary}
      onClick={() => downloadFile(filename, csv)}
      disabled={rows.length === 0}
      title="Download as CSV"
    >
      <Download className="h-4 w-4" />
      Export CSV
    </button>
  );
}
