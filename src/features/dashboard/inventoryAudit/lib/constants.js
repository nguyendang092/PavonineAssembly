export const INVENTORY_AUDIT_WORKSPACE_ROOT = "inventoryAudit/workspaces";
export const INVENTORY_AUDIT_SOURCE_PATH = "inventoryAudit/sourceCatalog";
export const INVENTORY_AUDIT_SOURCE_ROOT = "inventoryAudit/sourceData";

/** A=0, Z=25, AA=26, BF=57 */
export function excelColumnToIndex(col) {
  let n = 0;
  for (const ch of String(col ?? "").toUpperCase()) {
    if (ch < "A" || ch > "Z") continue;
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

/** Cột B → Mục / Loại. */
export const INVENTORY_AUDIT_SOURCE_ITEM_NAME_COL = excelColumnToIndex("B");
/** Cột E → Loại hàng tồn kho. */
export const INVENTORY_AUDIT_SOURCE_INVENTORY_TYPE_COL = excelColumnToIndex("E");
/** Cột V → Đơn vị tính. */
export const INVENTORY_AUDIT_SOURCE_UNIT_COL = excelColumnToIndex("V");
/** Cột BF → Tên vị trí để hàng. */
export const INVENTORY_AUDIT_SOURCE_LOCATION_NAME_COL = excelColumnToIndex("BF");
export const INVENTORY_AUDIT_SOURCE_MIN_COLS =
  Math.max(
    INVENTORY_AUDIT_SOURCE_ITEM_NAME_COL,
    INVENTORY_AUDIT_SOURCE_INVENTORY_TYPE_COL,
    INVENTORY_AUDIT_SOURCE_UNIT_COL,
    INVENTORY_AUDIT_SOURCE_LOCATION_NAME_COL,
  ) + 1;

export const INVENTORY_AUDIT_WORKSPACE_COLUMNS = [
  { key: "tag", en: "Tag #", vi: "", colClass: "inv-audit-col-tag" },
  {
    key: "locationCode",
    en: "Location code",
    vi: "Vị trí để hàng",
    colClass: "inv-audit-col-loc-code",
    pink: true,
  },
  {
    key: "locationName",
    en: "Location name",
    vi: "Tên vị trí để hàng",
    colClass: "inv-audit-col-loc-name",
    autoFill: true,
  },
  {
    key: "inventoryType",
    en: "Type of inventory",
    vi: "Loại hàng tồn kho",
    colClass: "inv-audit-col-type",
    autoFill: true,
  },
  { key: "erpCode", en: "ERP Code", vi: "", colClass: "inv-audit-col-erp" },
  {
    key: "itemName",
    en: "Item name",
    vi: "Mục / Loại",
    colClass: "inv-audit-col-item",
    autoFill: true,
  },
  {
    key: "unit",
    en: "Unit",
    vi: "Đơn vị tính",
    colClass: "inv-audit-col-unit",
    autoFill: true,
  },
  { key: "qty", en: "Qty", vi: "số lượng", colClass: "inv-audit-col-qty" },
  {
    key: "remarks",
    en: "Remarks",
    vi: "Ghi chú",
    colClass: "inv-audit-col-remarks",
  },
];

export const INVENTORY_AUDIT_AUTO_FILL_KEYS = new Set(
  INVENTORY_AUDIT_WORKSPACE_COLUMNS.filter((col) => col.autoFill).map(
    (col) => col.key,
  ),
);

const EMPTY_TEXT_FIELDS = {
  tag: "",
  locationCode: "",
  locationName: "",
  inventoryType: "",
  erpCode: "",
  itemName: "",
  unit: "",
  remarks: "",
};

export function createInventoryAuditRow() {
  return {
    id: `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    ...EMPTY_TEXT_FIELDS,
    qty: "",
  };
}

export function formatInventoryAuditRemarks(value) {
  const s = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return "";
  return s.charAt(0).toLocaleUpperCase("vi-VN") + s.slice(1);
}

export function normalizeInventoryAuditRow(raw) {
  if (!raw || typeof raw !== "object") return createInventoryAuditRow();
  const qty = raw.qty;
  return {
    id: String(raw.id ?? "").trim() || createInventoryAuditRow().id,
    tag: String(raw.tag ?? "").trim(),
    locationCode: String(raw.locationCode ?? raw.location ?? "").trim(),
    locationName: String(raw.locationName ?? "").trim(),
    inventoryType: String(raw.inventoryType ?? raw.type ?? "").trim(),
    erpCode: String(raw.erpCode ?? raw.code ?? "").trim(),
    itemName: String(raw.itemName ?? raw.item ?? "").trim(),
    unit: String(raw.unit ?? "").trim(),
    qty:
      typeof qty === "number" && Number.isFinite(qty)
        ? qty
        : String(qty ?? "").trim(),
    remarks: formatInventoryAuditRemarks(raw.remarks),
  };
}

const AUDIT_ROW_CONTENT_KEYS = [
  "tag",
  "locationCode",
  "locationName",
  "inventoryType",
  "erpCode",
  "itemName",
  "unit",
  "qty",
  "remarks",
];

export function isEmptyInventoryAuditRow(row) {
  const n = normalizeInventoryAuditRow(row);
  return AUDIT_ROW_CONTENT_KEYS.every((key) => {
    const v = n[key];
    return v == null || String(v).trim() === "";
  });
}

export function cloneInventoryAuditRow(row) {
  return normalizeInventoryAuditRow({
    ...row,
    id: createInventoryAuditRow().id,
  });
}

export function payloadToInventoryAuditRows(payload) {
  const cloudRows = Array.isArray(payload?.rows) ? payload.rows : [];
  return cloudRows.map(normalizeInventoryAuditRow);
}

export function mergeInventoryAuditRowLists(destRows, sourceLists) {
  const out = Array.isArray(destRows)
    ? destRows.map(normalizeInventoryAuditRow)
    : [];
  for (const list of sourceLists) {
    if (!Array.isArray(list)) continue;
    for (const row of list) {
      const cloned = cloneInventoryAuditRow(row);
      if (isEmptyInventoryAuditRow(cloned)) continue;
      out.push(cloned);
    }
  }
  return out;
}
