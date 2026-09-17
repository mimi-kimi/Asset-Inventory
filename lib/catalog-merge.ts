import { buildTree, matchAsset, optionPathKey, pathKey } from "@/lib/catalog-tree";
import type { CatalogImportResult } from "@/lib/catalog-import";
import type { CatalogData } from "@/lib/types";

/** An option the import would create. */
export interface PlannedOption {
  /** id the planner assigned to this node (`new:…`) — used to resolve children */
  placeholder: string;
  assetName: string;
  level_no: number;
  /** values of the levels above, root first */
  parentPath: string[];
  /** id of the parent option (real or placeholder) */
  parentOptionId: string | null;
  value: string;
  price: number | null;
  raw_price: string | null;
  sort_order: number;
}

export interface PlannedPriceUpdate {
  id: string;
  assetName: string;
  path: string;
  price: number;
  raw_price: string | null;
}

export interface CatalogMergePlan {
  newAssets: { name: string; sort_order: number }[];
  newLevels: { assetName: string; level_no: number; label: string }[];
  newOptions: PlannedOption[];
  /** existing rows whose price differs from the sheet (only applied on request) */
  priceUpdates: PlannedPriceUpdate[];
  /** sheet paths that are already in the catalog */
  skippedPaths: number;
  sheetPaths: number;
  sheetPriced: number;
  unparsedPrices: number;
  touchedAssets: string[];
  warnings: string[];
}

/**
 * Works out what an Excel import would ADD to the catalog. Anything that already
 * exists (asset by name, level by number, option by parent + value) is skipped,
 * so importing the same sheet twice changes nothing.
 */
export function planCatalogMerge(
  parsed: CatalogImportResult,
  current: CatalogData,
): CatalogMergePlan {
  const tree = buildTree(current);
  const plan: CatalogMergePlan = {
    newAssets: [],
    newLevels: [],
    newOptions: [],
    priceUpdates: [],
    skippedPaths: 0,
    sheetPaths: 0,
    sheetPriced: 0,
    unparsedPrices: 0,
    touchedAssets: [],
    warnings: [],
  };

  /** path key → option id (real, or `new:` placeholder for nodes we'll insert) */
  const idByKey = new Map<string, string>();
  const orderCounters = new Map<string, number>();
  let placeholder = 0;

  for (const sheetAsset of parsed.assets) {
    const existing = matchAsset(tree, sheetAsset.name);
    const assetName = existing?.name ?? sheetAsset.name;
    const assetId = existing?.id ?? `new:${sheetAsset.name.trim().toLowerCase()}`;
    if (!plan.touchedAssets.includes(assetName)) plan.touchedAssets.push(assetName);

    if (!existing) {
      plan.newAssets.push({
        name: sheetAsset.name,
        sort_order: current.assets.length + plan.newAssets.length,
      });
    } else {
      for (const option of existing.options) {
        idByKey.set(optionPathKey(existing, option), option.id);
      }
    }

    for (const [levelRaw, label] of Object.entries(sheetAsset.labels)) {
      const levelNo = Number(levelRaw);
      if (existing?.levels.some((level) => level.level_no === levelNo)) continue;
      plan.newLevels.push({ assetName, level_no: levelNo, label });
    }

    for (const row of sheetAsset.rows) {
      const values = [row.l2, row.l3, row.l4, row.l5].filter(
        (value): value is string => Boolean(value),
      );
      if (values.length === 0) continue;

      plan.sheetPaths += 1;
      if (row.price !== null) plan.sheetPriced += 1;
      else if (row.rawPrice) plan.unparsedPrices += 1;

      const ancestors: string[] = [];
      let parentId: string | null = null;
      let created = 0;

      for (let index = 0; index < values.length; index += 1) {
        const value = values[index]!;
        const levelNo = 2 + index;
        const key = pathKey(assetId, ancestors, value);
        const known = idByKey.get(key);

        if (known) {
          parentId = known;
        } else {
          const counterKey = pathKey(assetId, ancestors, "");
          const sortOrder = orderCounters.get(counterKey) ?? 0;
          orderCounters.set(counterKey, sortOrder + 1);

          const newId = `new:${assetId}:${(placeholder += 1)}`;
          idByKey.set(key, newId);
          plan.newOptions.push({
            placeholder: newId,
            assetName,
            level_no: levelNo,
            parentPath: [...ancestors],
            parentOptionId: parentId,
            value,
            price: row.price,
            raw_price: row.rawPrice,
            sort_order: sortOrder,
          });
          parentId = newId;
          created += 1;
        }
        ancestors.push(value);
      }

      if (created === 0) {
        plan.skippedPaths += 1;
        /* optional: refresh the leaf price of an existing path */
        const leafId = parentId;
        if (leafId && !leafId.startsWith("new:") && row.price !== null && existing) {
          const leaf = existing.optionById.get(leafId);
          if (leaf && leaf.price !== row.price) {
            plan.priceUpdates.push({
              id: leafId,
              assetName,
              path: values.join(" / "),
              price: row.price,
              raw_price: row.rawPrice,
            });
          }
        }
      }
    }
  }

  if (plan.unparsedPrices > 0) {
    plan.warnings.push(
      `${plan.unparsedPrices} row(s) have a price the sheet cannot express as a number — they import without a price.`,
    );
  }

  return plan;
}
