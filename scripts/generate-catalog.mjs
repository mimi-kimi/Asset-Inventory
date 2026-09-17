#!/usr/bin/env node
/**
 * Generates `lib/catalog-data.ts` — the hardcoded L1..L5 *structure* of the
 * price catalog (assets, level labels and selectable options). Prices are NOT
 * included: they live in Supabase (`public.catalog_prices`) so an admin can
 * update them from the browser without a redeploy.
 *
 * Usage:  npm run catalog:gen -- "Aset perambot jalan.xlsx"
 *
 * The sheet layout is the same one `lib/catalog-import.ts` (the browser price
 * importer) understands — keep the two parsers in sync:
 *   column B = "ASET" starts a block, C..F = that block's level labels,
 *   column G = price, level cells are forward-filled when blank.
 */
import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const DEFAULT_FILE = "Aset perambot jalan.xlsx";
const OUT_FILE = path.join("lib", "catalog-data.ts");

const source = process.argv[2] ?? DEFAULT_FILE;
const abs = path.resolve(source);
if (!fs.existsSync(abs)) {
  console.error(`x File not found: ${source}`);
  process.exit(1);
}

const text = (value) =>
  value === null || value === undefined
    ? ""
    : typeof value === "number"
      ? String(value)
      : String(value).trim();

function parsePrice(value) {
  const raw = text(value);
  if (!raw) return { price: null, raw: null };
  if (typeof value === "number" && Number.isFinite(value)) {
    return { price: value, raw };
  }
  const cleaned = raw.replace(/[^0-9.\-]/g, "").replace(/(\..*)\./g, "$1");
  if (!cleaned || cleaned === "-" || cleaned === ".") return { price: null, raw };
  const n = Number(cleaned);
  return { price: Number.isFinite(n) ? n : null, raw };
}

const slug = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const wb = XLSX.readFile(abs);
const sheetName = wb.SheetNames[0];
const ws = wb.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(ws, {
  header: 1,
  raw: true,
  defval: null,
  blankrows: true,
});

const assets = [];
const warnings = [];
let current = null;
let columnLevels = [];
let blockLabels = {};
const filled = {};

for (let i = 0; i < rows.length; i += 1) {
  const row = rows[i] ?? [];
  const first = text(row[1]);

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

  if (first) {
    if (columnLevels.length === 0) {
      /* the "L1..L6" strip above the first block is not an asset */
      if (assets.length > 0) {
        warnings.push(`Row ${i + 1}: "${first}" has no level labels (skipped).`);
      }
      current = null;
      continue;
    }
    current = {
      key: slug(first),
      name: first,
      labels: { ...blockLabels },
      options: {},
      rows: [],
    };
    assets.push(current);
    for (let c = 2; c <= 5; c += 1) delete filled[c];
  }

  if (!current) continue;

  let changed = false;
  for (let c = 2; c <= 5; c += 1) {
    const value = text(row[c]);
    if (value) {
      filled[c] = value;
      changed = true;
    }
  }
  if (!changed) continue;

  const valueOf = (column) => filled[column] ?? null;
  const entry = {
    l2: columnLevels[0] ? valueOf(columnLevels[0]) : null,
    l3: columnLevels[1] ? valueOf(columnLevels[1]) : null,
    l4: columnLevels[2] ? valueOf(columnLevels[2]) : null,
    l5: columnLevels[3] ? valueOf(columnLevels[3]) : null,
    price: parsePrice(row[6]),
  };
  if (!entry.l2 && !entry.l3 && !entry.l4 && !entry.l5) continue;

  for (const level of [2, 3, 4, 5]) {
    const value = entry[`l${level}`];
    if (!value) continue;
    const list = current.options[level] ?? [];
    if (!list.includes(value)) list.push(value);
    current.options[level] = list;
  }
  current.rows.push(entry);
}

if (assets.length === 0) {
  console.error("x No assets found — is this really the `Aset perabot jalan` sheet?");
  process.exit(1);
}

const keys = new Set(assets.map((a) => a.key));
if (keys.size !== assets.length) {
  console.error("x Two assets collapse to the same key — rename one of them.");
  process.exit(1);
}

const totalRows = assets.reduce((n, a) => n + a.rows.length, 0);
const priced = assets.reduce(
  (n, a) => n + a.rows.filter((r) => r.price.price !== null).length,
  0,
);

const q = (value) => JSON.stringify(value);
const labelBlock = (labels) =>
  Object.entries(labels)
    .map(([level, label]) => `      ${level}: ${q(label)},`)
    .join("\n");
const optionBlock = (options) =>
  Object.entries(options)
    .map(
      ([level, values]) =>
        `      ${level}: [\n${values
          .map((v) => `        ${q(v)},`)
          .join("\n")}\n      ],`,
    )
    .join("\n");

const assetBlocks = assets
  .map(
    (asset) => `  {
    key: ${q(asset.key)},
    name: ${q(asset.name)},
    labels: {
${labelBlock(asset.labels)}
    },
    options: {
${optionBlock(asset.options)}
    },
  },`,
  )
  .join("\n");

const stamp = new Date().toISOString();
const out = `/**
 * AUTO-GENERATED — do not edit by hand.
 *
 * Source:      ${path.basename(abs)}
 * Sheet:       ${sheetName}
 * Generated:   ${stamp}
 * Structure:   ${assets.length} assets · ${totalRows} combinations · ${totalRows - priced} without a price
 *
 * Only the L1..L5 *structure* lives here. Prices are stored in Supabase
 * (\`public.catalog_prices\`, keyed by \`asset_key\` + l2..l5) so admins can update
 * them from Dashboard → Catalog without a redeploy.
 *
 * Regenerate after changing the spreadsheet:  npm run catalog:gen -- "${path.basename(abs)}"
 */

export interface CatalogAssetDef {
  /** stable slug used as \`catalog_prices.asset_key\` and \`inspections.catalog_asset_key\` */
  key: string;
  /** display name, also stored on \`inspections.asset_category\` */
  name: string;
  /** level number (2..5) → label from the sheet's block header */
  labels: Partial<Record<2 | 3 | 4 | 5, string>>;
  /** level number → selectable values, in sheet order */
  options: Partial<Record<2 | 3 | 4 | 5, string[]>>;
}

export const CATALOG_META = {
  sourceFile: ${q(path.basename(abs))},
  sheet: ${q(sheetName)},
  generatedAt: ${q(stamp)},
  assetCount: ${assets.length},
  combinationCount: ${totalRows},
  pricedCount: ${priced},
} as const;

export const CATALOG_ASSETS: CatalogAssetDef[] = [
${assetBlocks}
];

export const CATALOG_BY_KEY: Record<string, CatalogAssetDef> = Object.fromEntries(
  CATALOG_ASSETS.map((asset) => [asset.key, asset]),
);

/** Find an asset by its (case/space-insensitive) name, or by its key. */
export function matchCatalogAsset(
  name: string | null | undefined,
): CatalogAssetDef | null {
  if (!name) return null;
  const wanted = name.trim().toLowerCase().replace(/\\s+/g, " ");
  for (const asset of CATALOG_ASSETS) {
    if (asset.name.toLowerCase().replace(/\\s+/g, " ") === wanted) return asset;
    if (asset.key === name.trim().toLowerCase()) return asset;
  }
  return null;
}

/** Levels that exist for an asset, ascending. */
export function levelsOf(
  asset: CatalogAssetDef,
): { level: 2 | 3 | 4 | 5; label: string }[] {
  return ([2, 3, 4, 5] as const)
    .filter((level) => asset.labels[level] !== undefined)
    .map((level) => ({ level, label: asset.labels[level] as string }));
}
`;

fs.writeFileSync(OUT_FILE, out, "utf8");

console.log(`OK  Wrote ${OUT_FILE}`);
console.log(
  `    ${assets.length} assets · ${totalRows} combinations · ${priced} priced · ${totalRows - priced} without price`,
);
for (const asset of assets) {
  const options = Object.entries(asset.options)
    .map(([level, values]) => `L${level}:${values.length}`)
    .join(" ");
  console.log(`    - ${asset.key.padEnd(26)} ${options}`);
}
for (const warning of warnings) console.log(`    ! ${warning}`);
console.log(
  "\nNext: commit the file. Prices stay in Supabase — import them on /dashboard/catalog.",
);
