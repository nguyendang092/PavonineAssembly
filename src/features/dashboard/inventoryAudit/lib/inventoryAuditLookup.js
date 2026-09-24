import { INVENTORY_AUDIT_SOURCE_LOCATION_NAME_COL } from "./constants";
import { resolveInventoryAuditColumns } from "./parseInventoryAudit";
import {
  sourceRecordsToAuditRows,
  unpackInventoryAuditSourceTable,
} from "./inventoryAuditSourceTable";

export const INVENTORY_AUDIT_SOURCE_PACK_VERSION = 2;
const MAX_CODE = 48;
const MAX_NAME = 80;
const MAX_ITEM = 100;
const MAX_UNIT = 16;
const MAX_TYPE = 32;
const MAX_PAYLOAD_CHARS = 8_000_000;

export function inventoryAuditLookupKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function inventoryAuditLocationKeys(value) {
  const base = inventoryAuditLookupKey(value);
  if (!base) return [];
  const compact = base.replace(/[\s-]/g, "");
  return compact && compact !== base ? [base, compact] : [base];
}

function looksLikeLocationCode(value) {
  const s = String(value ?? "").trim();
  if (s.length < 2 || s.length > 24) return false;
  return /^(wh|kho|loc|bin)?[-_]?\d{2,8}$/i.test(s) || /^[a-z]{1,6}[-_]?\d{2,8}$/i.test(s);
}

function registerLocation(locations, code, locationName) {
  const locationCode = text(code, MAX_CODE);
  if (!locationCode) return;
  const entry = {
    locationCode,
    locationName: text(locationName, MAX_NAME),
  };
  for (const key of inventoryAuditLocationKeys(locationCode)) {
    const prev = locations.get(key);
    locations.set(key, {
      locationCode: prev?.locationCode || entry.locationCode,
      locationName: pickFilled(entry.locationName, prev?.locationName),
    });
  }
}

function mergeLocationsFromSourceTable(locations, table) {
  const headers = table?.headers ?? [];
  const locCol = resolveInventoryAuditColumns(headers).locationCode;
  const nameCol = INVENTORY_AUDIT_SOURCE_LOCATION_NAME_COL;
  for (const record of table?.records ?? []) {
    const locationName = record?.[nameCol];
    const codes = new Set();
    if (locCol !== undefined) codes.add(record?.[locCol]);
    for (const cell of record ?? []) {
      if (looksLikeLocationCode(cell)) codes.add(cell);
    }
    for (const code of codes) registerLocation(locations, code, locationName);
  }
}

function text(value, max = 0) {
  const s = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!max || s.length <= max) return s;
  return s.slice(0, max);
}

function pickFilled(next, prev) {
  return next || prev || "";
}

function tsvCell(value) {
  return String(value ?? "")
    .replace(/[\t\r\n]+/g, " ")
    .trim();
}

function packRows(rows) {
  return rows
    .map((cols) => cols.map(tsvCell).join("\t"))
    .filter((line) => line.replace(/\t/g, "").length > 0)
    .join("\n");
}

function unpackRows(raw) {
  const s = String(raw ?? "");
  if (!s) return [];
  return s.split("\n").reduce((out, line) => {
    if (!line) return out;
    out.push(line.split("\t"));
    return out;
  }, []);
}

/**
 * Gộp file nguồn: chỉ giữ mã kho / code và 4 trường tra cứu, bỏ trùng.
 */
export function compactInventoryAuditSource(rows) {
  const locations = new Map();
  const items = new Map();
  const locToItems = new Map();
  const itemToLocs = new Map();

  for (const raw of rows ?? []) {
    const locationCode = text(raw.locationCode ?? raw.location, MAX_CODE);
    const locationName = text(raw.locationName, MAX_NAME);
    const inventoryType = text(raw.inventoryType ?? raw.type, MAX_TYPE);
    const erpCode = text(raw.erpCode ?? raw.code, MAX_CODE);
    const itemName = text(raw.itemName ?? raw.item, MAX_ITEM);
    const unit = text(raw.unit, MAX_UNIT);
    const locKey = inventoryAuditLookupKey(locationCode);
    const itemKey = inventoryAuditLookupKey(erpCode);

    if (locKey) {
      const prev = locations.get(locKey) || {
        locationCode: "",
        locationName: "",
      };
      locations.set(locKey, {
        locationCode: prev.locationCode || locationCode,
        locationName: pickFilled(locationName, prev.locationName),
      });
    }

    if (itemKey) {
      const prev = items.get(itemKey) || {
        erpCode: "",
        itemName: "",
        unit: "",
        inventoryType: "",
      };
      items.set(itemKey, {
        erpCode: prev.erpCode || erpCode,
        itemName: pickFilled(itemName, prev.itemName),
        unit: pickFilled(unit, prev.unit),
        inventoryType: pickFilled(inventoryType, prev.inventoryType),
      });
    }

    if (locKey && itemKey) {
      if (!locToItems.has(locKey)) locToItems.set(locKey, new Set());
      locToItems.get(locKey).add(itemKey);
      if (!itemToLocs.has(itemKey)) itemToLocs.set(itemKey, new Set());
      itemToLocs.get(itemKey).add(locKey);
    }
  }

  const uniqueByLocation = [];
  for (const [locationKey, set] of locToItems) {
    if (set.size === 1) {
      uniqueByLocation.push({
        locationKey,
        itemKey: [...set][0],
      });
    }
  }

  const uniqueByItem = [];
  for (const [itemKey, set] of itemToLocs) {
    if (set.size === 1) {
      uniqueByItem.push({
        itemKey,
        locationKey: [...set][0],
      });
    }
  }

  return {
    sourceRows: Array.isArray(rows) ? rows.length : 0,
    locations: [...locations.entries()].map(([key, value]) => ({
      key,
      ...value,
    })),
    items: [...items.entries()].map(([key, value]) => ({ key, ...value })),
    uniqueByLocation,
    uniqueByItem,
  };
}

/** Đóng gói TSV: không lặp tên cột, không lưu 11k dòng gốc. */
export function packInventoryAuditSource(compact, extra = {}) {
  const locByKey = new Map(
    (compact.locations ?? []).map((row) => [row.key, row]),
  );
  const itemByKey = new Map((compact.items ?? []).map((row) => [row.key, row]));

  return {
    v: INVENTORY_AUDIT_SOURCE_PACK_VERSION,
    n: extra.sourceRows ?? compact.sourceRows ?? 0,
    lc: compact.locations?.length ?? 0,
    ic: compact.items?.length ?? 0,
    L: packRows(
      (compact.locations ?? []).map((row) => [
        row.locationCode,
        row.locationName,
      ]),
    ),
    I: packRows(
      (compact.items ?? []).map((row) => [
        row.erpCode,
        row.itemName,
        row.unit,
        row.inventoryType,
      ]),
    ),
    U: packRows(
      (compact.uniqueByLocation ?? []).map((pair) => [
        locByKey.get(pair.locationKey)?.locationCode || pair.locationKey,
        itemByKey.get(pair.itemKey)?.erpCode || pair.itemKey,
      ]),
    ),
    W: packRows(
      (compact.uniqueByItem ?? []).map((pair) => [
        itemByKey.get(pair.itemKey)?.erpCode || pair.itemKey,
        locByKey.get(pair.locationKey)?.locationCode || pair.locationKey,
      ]),
    ),
  };
}

export function estimateInventoryAuditSourceSize(payload) {
  try {
    return JSON.stringify(payload).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function assertInventoryAuditSourceSize(payload) {
  const chars = estimateInventoryAuditSourceSize(payload);
  if (chars > MAX_PAYLOAD_CHARS) {
    const err = new Error("SOURCE_TOO_LARGE");
    err.chars = chars;
    throw err;
  }
  return chars;
}

function unpackPackedCatalog(catalog) {
  const locations = unpackRows(catalog.L).map(([locationCode, locationName]) => ({
    key: inventoryAuditLookupKey(locationCode),
    locationCode: locationCode || "",
    locationName: locationName || "",
  }));
  const items = unpackRows(catalog.I).map(
    ([erpCode, itemName, unit, inventoryType]) => ({
      key: inventoryAuditLookupKey(erpCode),
      erpCode: erpCode || "",
      itemName: itemName || "",
      unit: unit || "",
      inventoryType: inventoryType || "",
    }),
  );
  const uniqueByLocation = unpackRows(catalog.U).map(([locCode, itemCode]) => ({
    locationKey: inventoryAuditLookupKey(locCode),
    itemKey: inventoryAuditLookupKey(itemCode),
  }));
  const uniqueByItem = unpackRows(catalog.W).map(([itemCode, locCode]) => ({
    itemKey: inventoryAuditLookupKey(itemCode),
    locationKey: inventoryAuditLookupKey(locCode),
  }));
  return {
    sourceRows: catalog.n ?? 0,
    locations,
    items,
    uniqueByLocation,
    uniqueByItem,
  };
}

export function unpackInventoryAuditSource(catalog) {
  if (!catalog || typeof catalog !== "object") return null;
  if (catalog.v === INVENTORY_AUDIT_SOURCE_PACK_VERSION || typeof catalog.L === "string") {
    return unpackPackedCatalog(catalog);
  }
  return catalog;
}

export function buildInventoryAuditLookupIndex(catalog) {
  const table = unpackInventoryAuditSourceTable(catalog);
  const packedOrCompact = table?.records?.length
    ? compactInventoryAuditSource(sourceRecordsToAuditRows(table))
    : unpackInventoryAuditSource(catalog);
  const unpacked = packedOrCompact;
  const locations = new Map();
  const items = new Map();
  const uniqueItemByLocation = new Map();
  const uniqueLocationByItem = new Map();

  for (const loc of unpacked?.locations ?? []) {
    registerLocation(
      locations,
      loc.locationCode || loc.key,
      loc.locationName,
    );
  }
  if (table?.records?.length) {
    mergeLocationsFromSourceTable(locations, table);
  }
  for (const item of unpacked?.items ?? []) {
    if (item?.key) items.set(item.key, item);
  }
  for (const pair of unpacked?.uniqueByLocation ?? []) {
    if (pair?.locationKey && items.has(pair.itemKey)) {
      uniqueItemByLocation.set(pair.locationKey, items.get(pair.itemKey));
    }
  }
  for (const pair of unpacked?.uniqueByItem ?? []) {
    if (pair?.itemKey && locations.has(pair.locationKey)) {
      uniqueLocationByItem.set(pair.itemKey, locations.get(pair.locationKey));
    }
  }

  return { locations, items, uniqueItemByLocation, uniqueLocationByItem };
}

export function applyInventoryAuditLookup(row, index) {
  const loc = findLocation(index, row?.locationCode);
  const locKey = inventoryAuditLookupKey(row?.locationCode);
  const typedItemKey = inventoryAuditLookupKey(row?.erpCode);
  const typedItem = typedItemKey ? index?.items.get(typedItemKey) : null;
  const uniqueItem =
    !typedItem && locKey ? index?.uniqueItemByLocation.get(locKey) : null;
  const item = typedItem || uniqueItem || null;

  return {
    ...row,
    locationCode: text(row?.locationCode, MAX_CODE),
    erpCode: text(row?.erpCode, MAX_CODE) || uniqueItem?.erpCode || "",
    locationName: locKey ? loc?.locationName || "" : "",
    inventoryType: item?.inventoryType || "",
    itemName: item?.itemName || "",
    unit: item?.unit || "",
  };
}

function findLocation(index, typed) {
  for (const key of inventoryAuditLocationKeys(typed)) {
    const loc = index?.locations.get(key);
    if (loc) return loc;
  }
  return null;
}
