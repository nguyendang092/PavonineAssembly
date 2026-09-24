import { INVENTORY_AUDIT_SOURCE_MIN_COLS } from "./constants";

/**
 * Sheet kiểm toán tồn kho (Tag #, Location, ERP Code, Qty…).
 * Header có thể 1 hàng song ngữ hoặc 2 hàng EN + VI.
 */

const COLUMN_MATCHERS = [
  { key: "tag", tests: [/^tag\b/i, /^tag\s*#/i] },
  {
    key: "locationName",
    tests: [/location\s*name/i, /tên\s*vị\s*trí/i],
  },
  {
    key: "locationCode",
    tests: [
      /location\s*code/i,
      /(?<!tên\s)vị\s*trí\s*để\s*hàng/i,
      /mã\s*kho/i,
      /창고(?!명|금액)/,
      /warehouse/i,
      /\bw\/h\b/i,
      /^wh$/i,
      /bin\s*code/i,
      /loc(ation)?\s*code/i,
    ],
  },
  {
    key: "inventoryType",
    tests: [/type\s*of\s*inventory/i, /loại\s*hàng\s*tồn/i],
  },
  {
    key: "erpCode",
    tests: [
      /^erp(\s*code)?$/i,
      /erp\s*code/i,
      /mã\s*(hàng|erp)/i,
      /품목코드/,
      /품번/,
      /item\s*code/i,
      /^code$/,
    ],
  },
  {
    key: "itemName",
    tests: [
      /item\s*name/i,
      /^mục\s*\/\s*loại$/i,
      /mục\s*\/\s*loại/i,
      /품명/,
      /tên\s*(hàng|vật\s*tư)/i,
    ],
  },
  {
    key: "unit",
    tests: [/^unit$/i, /đơn\s*vị\s*tính/i],
  },
  {
    key: "qty",
    tests: [/^qty$/i, /^quantity$/i, /số\s*lượng/i],
  },
  {
    key: "remarks",
    tests: [/^remarks?$/i, /ghi\s*chú/i],
  },
];

function cellText(v) {
  return String(v ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function headerBlob(v) {
  return cellText(v).toLowerCase();
}

export function resolveInventoryAuditColumns(headers) {
  /** @type {Record<string, number>} */
  const cols = {};
  headers.forEach((raw, i) => {
    const blob = headerBlob(raw);
    if (!blob) return;
    for (const { key, tests } of COLUMN_MATCHERS) {
      if (cols[key] !== undefined) continue;
      if (tests.some((re) => re.test(blob))) {
        cols[key] = i;
        break;
      }
    }
  });
  return cols;
}

function pick(cells, colMap, key) {
  const i = colMap[key];
  if (i === undefined) return "";
  return cellText(cells[i]);
}

function parseQty(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).replace(/\s/g, "").replace(/,/g, "");
  if (s === "-" || s === "—") return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function isPlaceholder(v) {
  const s = cellText(v);
  return !s || s === "-" || s === "—";
}

function mergeHeaderRows(rowA, rowB) {
  const len = Math.max(rowA?.length ?? 0, rowB?.length ?? 0);
  const out = [];
  for (let i = 0; i < len; i += 1) {
    const a = cellText(rowA?.[i]);
    const b = cellText(rowB?.[i]);
    out.push([a, b].filter(Boolean).join(" "));
  }
  return out;
}

function looksLikeHeaderRow(row) {
  if (!Array.isArray(row)) return false;
  const blob = row.map(headerBlob).join(" | ");
  return /location\s*code|tag\s*#|\btag\b|erp\s*code|item\s*name|type of inventory|창고|품번|품명|mã\s*kho|mã\s*hàng|warehouse/i.test(
    blob,
  );
}

function looksLikeGenericHeaderRow(row) {
  if (!Array.isArray(row)) return false;
  return row.filter((cell) => cellText(cell)).length >= 2;
}

function looksLikeViSubheader(row) {
  if (!Array.isArray(row)) return false;
  const blob = row.map(headerBlob).join(" | ");
  return /vị\s*trí|tên\s*vị\s*trí|loại\s*hàng|đơn\s*vị|số\s*lượng|ghi\s*chú|mục/.test(
    blob,
  );
}

/**
 * @param {unknown[][]} matrix
 * @param {{ requireAuditColumns?: boolean }} [options]
 */
export function parseInventoryAuditMatrix(matrix, options = {}) {
  const requireAuditColumns = options.requireAuditColumns !== false;
  if (!matrix?.length) throw new Error("EMPTY_SHEET");

  let headerIndex = matrix.findIndex(looksLikeHeaderRow);
  if (headerIndex < 0) headerIndex = matrix.findIndex(looksLikeGenericHeaderRow);
  if (headerIndex < 0) headerIndex = 0;

  const headerRow = matrix[headerIndex] ?? [];
  const nextRow = matrix[headerIndex + 1];
  const hasViSub =
    nextRow &&
    looksLikeViSubheader(nextRow) &&
    !looksLikeHeaderRow(nextRow);
  const headers = hasViSub
    ? mergeHeaderRows(headerRow, nextRow)
    : headerRow.map(cellText);
  const colMap = resolveInventoryAuditColumns(headers);

  if (
    requireAuditColumns &&
    colMap.locationCode === undefined &&
    colMap.erpCode === undefined &&
    colMap.itemName === undefined
  ) {
    throw new Error("MISSING_AUDIT_COLUMNS");
  }

  const dataStart = headerIndex + (hasViSub ? 2 : 1);
  let colCount = Math.max(headers.length, INVENTORY_AUDIT_SOURCE_MIN_COLS);
  for (const cells of matrix.slice(dataStart)) {
    if (Array.isArray(cells) && cells.length > colCount) colCount = cells.length;
  }
  if (headers.length < colCount) {
    for (let i = headers.length; i < colCount; i += 1) headers.push("");
  }
  const rows = [];
  const records = [];
  for (const cells of matrix.slice(dataStart)) {
    if (!Array.isArray(cells)) continue;
    const record = [];
    let any = false;
    for (let i = 0; i < colCount; i += 1) {
      const value = cellText(cells[i]);
      record.push(value);
      if (!isPlaceholder(value)) any = true;
    }
    if (!any) continue;
    records.push(record);
    const qtyRaw = colMap.qty !== undefined ? cells[colMap.qty] : "";
    const row = {
      tag: pick(cells, colMap, "tag"),
      locationCode: pick(cells, colMap, "locationCode"),
      locationName: pick(cells, colMap, "locationName"),
      inventoryType: pick(cells, colMap, "inventoryType"),
      erpCode: pick(cells, colMap, "erpCode"),
      itemName: pick(cells, colMap, "itemName"),
      unit: pick(cells, colMap, "unit"),
      qty: parseQty(qtyRaw),
      remarks: pick(cells, colMap, "remarks"),
    };
    rows.push(row);
  }

  if (records.length === 0) throw new Error("EMPTY_SHEET");
  return { rows, records, colMap, headers };
}

async function readExcelFirstSheetMatrix(file) {
  const XLSX = await import("@e965/xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const sheetName = wb.SheetNames?.[0];
  if (!sheetName) throw new Error("EMPTY_SHEET");
  const sheet = wb.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: "",
    blankrows: false,
  });
}

export async function parseInventoryAuditFile(file) {
  return parseInventoryAuditMatrix(await readExcelFirstSheetMatrix(file));
}

/** File nguồn: lưu đủ cột, không bắt buộc header mẫu kiểm toán. */
export async function parseInventorySourceFile(file) {
  return parseInventoryAuditMatrix(await readExcelFirstSheetMatrix(file), {
    requireAuditColumns: false,
  });
}
