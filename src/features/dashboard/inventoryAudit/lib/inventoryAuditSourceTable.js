import {
  INVENTORY_AUDIT_SOURCE_INVENTORY_TYPE_COL,
  INVENTORY_AUDIT_SOURCE_ITEM_NAME_COL,
  INVENTORY_AUDIT_SOURCE_LOCATION_NAME_COL,
  INVENTORY_AUDIT_SOURCE_UNIT_COL,
} from "./constants";
import { resolveInventoryAuditColumns } from "./parseInventoryAudit";

export const INVENTORY_AUDIT_SOURCE_TABLE_VERSION = 3;
const ROWS_PER_PART = 1500;
const MAX_PART_CHARS = 7_500_000;

function tsvCell(value) {
  return String(value ?? "")
    .replace(/[\t\r\n]+/g, " ");
}

function recordsToTsv(records) {
  return records.map((row) => (row ?? []).map(tsvCell).join("\t")).join("\n");
}

function parseTsv(tsv) {
  const raw = String(tsv ?? "");
  if (!raw) return [];
  return raw.split("\n").map((line) => line.split("\t"));
}

function cellAt(record, index) {
  if (index == null || index < 0) return "";
  return String(record?.[index] ?? "").trim();
}

function pickCell(record, colMap, key) {
  return cellAt(record, colMap?.[key]);
}

export function packInventoryAuditSourceTable({
  headers = [],
  records = [],
  extra = {},
} = {}) {
  const h = (headers ?? []).map(tsvCell);
  const recs = Array.isArray(records) ? records : [];
  const parts = {};
  for (let i = 0; i < recs.length; i += ROWS_PER_PART) {
    const chunk = recs.slice(i, i + ROWS_PER_PART);
    const tsv = recordsToTsv(chunk);
    if (tsv.length > MAX_PART_CHARS) {
      throw new Error("SOURCE_TOO_LARGE");
    }
    parts[String(Math.floor(i / ROWS_PER_PART))] = tsv;
  }
  return {
    meta: {
      v: INVENTORY_AUDIT_SOURCE_TABLE_VERSION,
      n: recs.length,
      c: Math.max(h.length, ...recs.map((row) => row?.length ?? 0), 0),
      h,
      ...extra,
    },
    parts,
  };
}

export function unpackInventoryAuditSourceTable(catalog) {
  if (!catalog || typeof catalog !== "object") {
    return { headers: [], records: [] };
  }
  const meta = catalog.meta && typeof catalog.meta === "object" ? catalog.meta : catalog;
  const parts = catalog.parts && typeof catalog.parts === "object" ? catalog.parts : {};
  const headers = Array.isArray(meta.h) ? meta.h.map((v) => String(v ?? "")) : [];
  const records = [];
  const keys = Object.keys(parts).sort((a, b) => Number(a) - Number(b));
  for (const key of keys) {
    const tsv = parts[key];
    if (typeof tsv !== "string" || !tsv) continue;
    records.push(...parseTsv(tsv));
  }
  return { headers, records };
}

export function sourceRecordsToObjects(table) {
  const headers = table?.headers ?? [];
  return (table?.records ?? []).map((record) => {
    const obj = {};
    headers.forEach((header, i) => {
      if (!header) return;
      obj[header] = record?.[i] ?? "";
    });
    return obj;
  });
}

export function sourceRecordsToAuditRows(table) {
  const headers = table?.headers ?? [];
  const colMap = resolveInventoryAuditColumns(headers);
  return (table?.records ?? []).map((record) => ({
    locationCode: pickCell(record, colMap, "locationCode"),
    locationName: cellAt(record, INVENTORY_AUDIT_SOURCE_LOCATION_NAME_COL),
    inventoryType: cellAt(record, INVENTORY_AUDIT_SOURCE_INVENTORY_TYPE_COL),
    erpCode: pickCell(record, colMap, "erpCode"),
    itemName: cellAt(record, INVENTORY_AUDIT_SOURCE_ITEM_NAME_COL),
    unit: cellAt(record, INVENTORY_AUDIT_SOURCE_UNIT_COL),
    qty: pickCell(record, colMap, "qty"),
    remarks: pickCell(record, colMap, "remarks"),
    tag: pickCell(record, colMap, "tag"),
  }));
}
