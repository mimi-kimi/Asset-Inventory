import type { Condition } from "@/lib/types";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export const CONDITION_ORDER: Condition[] = [
  "GOOD",
  "FAIR",
  "POOR",
  "DAMAGED",
  "NOT_FUNCTIONAL",
];

export const CONDITION_META: Record<
  Condition,
  { label: string; badge: string; dot: string; hex: string; emoji: string }
> = {
  GOOD: {
    label: "Good",
    badge: "bg-emerald-100 text-emerald-800",
    dot: "bg-emerald-500",
    hex: "#10b981",
    emoji: "✅",
  },
  FAIR: {
    label: "Fair",
    badge: "bg-lime-100 text-lime-800",
    dot: "bg-lime-500",
    hex: "#84cc16",
    emoji: "👍",
  },
  POOR: {
    label: "Poor",
    badge: "bg-amber-100 text-amber-800",
    dot: "bg-amber-500",
    hex: "#f59e0b",
    emoji: "⚠️",
  },
  DAMAGED: {
    label: "Damaged",
    badge: "bg-orange-100 text-orange-800",
    dot: "bg-orange-500",
    hex: "#f97316",
    emoji: "🔧",
  },
  NOT_FUNCTIONAL: {
    label: "Not functional",
    badge: "bg-red-100 text-red-700",
    dot: "bg-red-500",
    hex: "#ef4444",
    emoji: "⛔",
  },
};

export function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtCoords(
  lat: number | null | undefined,
  lng: number | null | undefined,
): string {
  if (lat == null || lng == null) return "—";
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + second).toUpperCase();
}

export function describeError(
  err: unknown,
  fallback = "Unexpected error.",
): string {
  if (err && typeof err === "object") {
    const e = err as {
      message?: unknown;
      code?: unknown;
      details?: unknown;
      hint?: unknown;
    };
    if (typeof e.message === "string" && e.message) {
      const parts = [e.message];
      if (typeof e.code === "string" && e.code) parts.push(`(${e.code})`);
      if (typeof e.details === "string" && e.details) parts.push(e.details);
      if (typeof e.hint === "string" && e.hint) parts.push(`Hint: ${e.hint}`);
      return parts.join(" ");
    }
  }
  return err instanceof Error && err.message ? err.message : fallback;
}

export function downloadFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Escapes a single CSV cell, quoting it only when it needs it. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Builds a CSV document from a header row plus data rows. */
export function buildCsv(
  header: string[],
  rows: Array<Array<string | number | null | undefined>>,
): string {
  return [
    header.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\n");
}
