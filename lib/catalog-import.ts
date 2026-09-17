/**
 * Parses the "Aset perabot jalan" price sheet.
 *
 * Layout (as provided):
 *   A = NO   B = ASET   C..F = level values (L2..L5)   G = HARGA (L6)
 *
 * The sheet contains several blocks. Each block starts with a header row whose
 * column B is "ASET"; the labels in columns C..F of that row name the levels
 * (e.g. KETERANGAN / ARM / WATT / TIANG). Level cells are sparse — they only
 * appear when the value changes — so values are forward-filled per column.
 * Prices are always in column G and may be plain numbers or text such as
 * "RM45,000.00/TIANG"; blank means "no price" (the inspector may type one, else
 * the price is saved as skipped).
 */

import { matchCatalogAsset } from "@/lib/catalog-data";

export interface CatalogImportRow {
  l2: string | null;
  l3: string | null;
  l4: string | null;
  l5: string | null;
  price: number | null;
  rawPrice: string | null;
}

export interface CatalogImportAsset {
  name: string;
  sortOrder: number;
  /** level number (2..5) → label from the block header */
  labels: Record<number, string>;
  /** level number → distinct values seen in the sheet */
  options: Record<number, string[]>;
  rows: CatalogImportRow[];
}

export interface CatalogImportResult {
  assets: CatalogImportAsset[];
  warnings: string[];
  sheetName: string;
}

interface PriceParse {
  price: number | null;
  raw: string | null;
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "number" ? String(value) : String(value).trim();
}

/** "RM45,000.00/TIANG" → 45000, 3745 → 3745, "" → null */
function parsePrice(value: unknown): PriceParse {
  const raw = text(value);
  if (!raw) return { price: null, raw: null };

  if (typeof value === "number" && Number.isFinite(value)) {
    return { price: value, raw };
  }
  const cleaned = raw.replace(/[^0-9.\-]/g, "").replace(/(\..*)\./g, "$1");
  if (!cleaned || cleaned === "-" || cleaned === ".") {
    return { price: null, raw };
  }
  const n = Number(cleaned);
  return { price: Number.isFinite(n) ? n : null, raw };
}

export async function parseCatalogFile(
  buffer: ArrayBuffer,
): Promise<CatalogImportResult> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames[0] ?? "";
  const ws = wb.Sheets[sheetName];
  const warnings: string[] = [];
  if (!ws) {
    return { assets: [], warnings: ["The file has no readable sheet."], sheetName };
  }

  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: true,
  });

  const assets: CatalogImportAsset[] = [];
  let current: CatalogImportAsset | null = null;
  /** physical column index (2..5) → level number */
  let columnLevels: number[] = [];
  /** level number → label taken from the current block's header row */
  let blockLabels: Record<number, string> = {};
  /** physical column index → current forward-filled value */
  const filled: Record<number, string> = {};

  const ensureOptions = (asset: CatalogImportAsset, level: number, value: string) => {
    const list = asset.options[level] ?? [];
    if (!list.includes(value)) list.push(value);
    asset.options[level] = list;
  };

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    const first = text(row[1]);

    /* block header: B = "ASET"; C..F hold this block's level labels */
    if (first.toUpperCase() === "ASET") {
      columnLevels = [];
      blockLabels = {};
      for (let c = 2; c <= 5; c += 1) {
        const label = text(row[c]);
        if (label) {
          columnLevels.push(c);
          blockLabels[columnLevels.length + 1] = label;
        }
      }
      for (let c = 2; c <= 5; c += 1) delete filled[c];
      current = null;
      continue;
    }

    /* a new asset name starts a new asset inside the current block */
    if (first) {
      current = {
        name: first,
        sortOrder: assets.length,
        labels: { ...blockLabels },
        options: {},
        rows: [],
      };
      if (columnLevels.length === 0) {
        warnings.push(`Row ${i + 1}: "${first}" has no level labels (skipped).`);
        current = null;
        continue;
      }
      assets.push(current);
      for (let c = 2; c <= 5; c += 1) delete filled[c];
    }

    if (!current) continue;

    /* forward-fill the level cells for this row */
    let changed = false;
    for (let c = 2; c <= 5; c += 1) {
      const v = text(row[c]);
      if (v) {
        filled[c] = v;
        changed = true;
      }
    }
    if (!changed) continue;

    const parsed = parsePrice(row[6]);

    const valueFor = (column: number): string | null => filled[column] ?? null;
    const rowOut: CatalogImportRow = {
      l2: columnLevels[0] ? valueFor(columnLevels[0]) : null,
      l3: columnLevels[1] ? valueFor(columnLevels[1]) : null,
      l4: columnLevels[2] ? valueFor(columnLevels[2]) : null,
      l5: columnLevels[3] ? valueFor(columnLevels[3]) : null,
      price: parsed.price,
      rawPrice: parsed.raw,
    };

    if (!rowOut.l2 && !rowOut.l3 && !rowOut.l4 && !rowOut.l5) continue;

    /* collect selectable options for the cascading lists */
    ([2, 3, 4, 5] as const).forEach((level) => {
      const value = rowOut[`l${level}` as "l2" | "l3" | "l4" | "l5"];
      if (value) ensureOptions(current!, level, value);
    });

    current.rows.push(rowOut);
  }

  if (assets.length === 0) {
    warnings.push(
      "No assets found. Expected blocks with a header row where column B is \"ASET\".",
    );
  }

  return { assets, warnings, sheetName };
}

/* ---------- flatten the parsed sheet into `catalog_prices` rows ---------- */

export interface CatalogPriceImportRow {
  asset_key: string;
  l2: string;
  l3: string;
  l4: string;
  l5: string;
  price: number | null;
  raw_price: string | null;
}

export interface FlatCatalogImport {
  rows: CatalogPriceImportRow[];
  /** asset names found in the sheet that lib/catalog-data.ts does not know */
  unknownAssets: string[];
  /** option values the hardcoded structure does not know (regenerate + commit) */
  newOptions: string[];
  /** duplicate L1..L5 combinations in the sheet (merged — a priced row wins) */
  duplicates: number;
  pricedCount: number;
  missingPriceCount: number;
}

export function flattenToPriceRows(
  result: CatalogImportResult,
): FlatCatalogImport {
  const byKey = new Map<string, CatalogPriceImportRow>();
  const unknownAssets: string[] = [];
  const newOptions: string[] = [];
  let duplicates = 0;

  for (const asset of result.assets) {
    const def = matchCatalogAsset(asset.name);
    if (!def) {
      unknownAssets.push(asset.name);
      continue;
    }

    for (const [level, values] of Object.entries(asset.options)) {
      const known = def.options[Number(level) as 2 | 3 | 4 | 5] ?? [];
      for (const value of values) {
        if (!known.includes(value)) {
          newOptions.push(`${def.name} · L${level} · ${value}`);
        }
      }
    }

    for (const row of asset.rows) {
      const entry: CatalogPriceImportRow = {
        asset_key: def.key,
        l2: row.l2 ?? "",
        l3: row.l3 ?? "",
        l4: row.l4 ?? "",
        l5: row.l5 ?? "",
        price: row.price,
        raw_price: row.rawPrice,
      };
      const key = [
        entry.asset_key,
        entry.l2,
        entry.l3,
        entry.l4,
        entry.l5,
      ].join("|");
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, entry);
      } else {
        duplicates += 1;
        /* keep whatever price we have — a filled row beats a blank one */
        if (existing.price === null && entry.price !== null) byKey.set(key, entry);
      }
    }
  }

  const rows = [...byKey.values()];
  return {
    rows,
    unknownAssets,
    newOptions,
    duplicates,
    pricedCount: rows.filter((r) => r.price !== null).length,
    missingPriceCount: rows.filter((r) => r.price === null).length,
  };
}
