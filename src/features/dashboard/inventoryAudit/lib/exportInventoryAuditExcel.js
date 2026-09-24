import { INVENTORY_AUDIT_WORKSPACE_COLUMNS } from "./constants";

const COL_WIDTHS = {
  tag: 12,
  locationCode: 16,
  locationName: 22,
  inventoryType: 18,
  erpCode: 16,
  itemName: 28,
  unit: 10,
  qty: 12,
  remarks: 24,
};

const COLORS = {
  ink: "FF1F2A30",
  muted: "FF66757D",
  header: "FFEEF2F1",
  cta: "FF3F6F66",
  onCta: "FFFFFFFF",
  rowOdd: "FFFFFFFF",
  rowEven: "FFF3F7F5",
  autofillOdd: "FFF7F8F8",
  autofillEven: "FFEEF3F1",
  line: "FFC5CED3",
};

const QTY_NUM_FMT = "#,##0.###";
const QTY_COL_INDEX =
  INVENTORY_AUDIT_WORKSPACE_COLUMNS.findIndex((col) => col.key === "qty") + 1;

const THIN_BORDER = {
  style: "thin",
  color: { argb: COLORS.line },
};
const CELL_BORDER = {
  top: THIN_BORDER,
  left: THIN_BORDER,
  bottom: THIN_BORDER,
  right: THIN_BORDER,
};

export function sanitizeInventoryAuditFilenamePart(value) {
  const cleaned = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[\\/:*?"<>|+]+/g, "-")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .trim();
  return (cleaned || "kiem-ke").slice(0, 40);
}

export function sanitizeExcelSheetName(name) {
  const cleaned = String(name ?? "")
    .replace(/[:\\/?*[\]]+/g, " ")
    .replace(/'/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31);
  return cleaned || "Kiem ke";
}

export function inventoryAuditExportFilename(label, now = new Date()) {
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const time = [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
  ].join("");
  return `kiem-ke_${sanitizeInventoryAuditFilenamePart(label)}_${stamp}_${time}.xlsx`;
}

export function excelBufferToUint8Array(buffer) {
  if (buffer instanceof Uint8Array) return buffer;
  if (buffer instanceof ArrayBuffer) return new Uint8Array(buffer);
  if (ArrayBuffer.isView(buffer)) {
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }
  return Uint8Array.from(buffer);
}

export function qtyCell(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number(String(value).replace(/\s/g, "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function sumInventoryAuditQty(rows = []) {
  return (Array.isArray(rows) ? rows : []).reduce((sum, row) => {
    const n = qtyCell(row?.qty);
    return sum + (n == null ? 0 : n);
  }, 0);
}

export function buildInventoryAuditExportSheet(rows = []) {
  const columns = INVENTORY_AUDIT_WORKSPACE_COLUMNS;
  return {
    headersEn: columns.map((col) => col.en),
    headersVi: columns.map((col) => col.vi || ""),
    headerLabels: columns.map((col) =>
      col.vi ? `${col.en}\n${col.vi}` : col.en,
    ),
    records: (Array.isArray(rows) ? rows : []).map((row) =>
      columns.map((col) =>
        col.key === "qty" ? qtyCell(row?.[col.key]) : String(row?.[col.key] ?? ""),
      ),
    ),
    qtyTotal: sumInventoryAuditQty(rows),
    qtyColIndex: QTY_COL_INDEX,
  };
}

function paintCell(cell, { fill, font, numFmt, alignment } = {}) {
  cell.border = CELL_BORDER;
  cell.alignment = alignment || {
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
  };
  if (fill) {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
  }
  if (font) cell.font = font;
  if (numFmt) cell.numFmt = numFmt;
}

function dataFill(col, rowIndex) {
  const even = rowIndex % 2 === 0;
  if (col.autoFill) return even ? COLORS.autofillEven : COLORS.autofillOdd;
  return even ? COLORS.rowEven : COLORS.rowOdd;
}

export async function buildInventoryAuditWorkbook({
  rows,
  sheetName = "Kiem ke",
} = {}) {
  const { headerLabels, records, qtyTotal, qtyColIndex } =
    buildInventoryAuditExportSheet(rows);
  const colCount = INVENTORY_AUDIT_WORKSPACE_COLUMNS.length;
  const lastDataRow = 2 + records.length;
  const mod = await import("exceljs");
  const ExcelJS = mod.default ?? mod;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sanitizeExcelSheetName(sheetName), {
    views: [{ state: "frozen", ySplit: 2, showGridLines: false }],
  });

  const totalRow = sheet.addRow(Array(colCount).fill(null));
  totalRow.height = 28;
  for (let c = 1; c <= colCount; c += 1) {
    const cell = totalRow.getCell(c);
    if (c === qtyColIndex) {
      cell.value =
        records.length > 0
          ? {
              formula: `SUM(${sheet.getColumn(qtyColIndex).letter}3:${sheet.getColumn(qtyColIndex).letter}${lastDataRow})`,
              result: qtyTotal,
            }
          : qtyTotal;
      paintCell(cell, {
        fill: COLORS.cta,
        font: { bold: true, color: { argb: COLORS.onCta }, size: 12 },
        numFmt: QTY_NUM_FMT,
      });
    } else {
      paintCell(cell, { fill: COLORS.rowOdd, font: { size: 10 } });
    }
  }

  const headerRow = sheet.addRow(headerLabels);
  headerRow.height = 36;
  for (let c = 1; c <= colCount; c += 1) {
    paintCell(headerRow.getCell(c), {
      fill: COLORS.header,
      font: { bold: true, color: { argb: COLORS.ink }, size: 10 },
    });
    headerRow.getCell(c).border = {
      ...CELL_BORDER,
      bottom: { style: "medium", color: { argb: COLORS.cta } },
    };
  }

  records.forEach((record, i) => {
    const excelRow = sheet.addRow(record);
    excelRow.height = 22;
    INVENTORY_AUDIT_WORKSPACE_COLUMNS.forEach((col, colIdx) => {
      const cell = excelRow.getCell(colIdx + 1);
      paintCell(cell, {
        fill: dataFill(col, i),
        font: {
          color: { argb: col.autoFill ? COLORS.muted : COLORS.ink },
          size: 10,
        },
        numFmt: col.key === "qty" ? QTY_NUM_FMT : undefined,
      });
    });
  });

  INVENTORY_AUDIT_WORKSPACE_COLUMNS.forEach((col, i) => {
    const column = sheet.getColumn(i + 1);
    column.width = COL_WIDTHS[col.key] ?? 14;
    if (col.key === "qty") column.numFmt = QTY_NUM_FMT;
  });

  if (records.length) {
    sheet.autoFilter = {
      from: { row: 2, column: 1 },
      to: { row: lastDataRow, column: colCount },
    };
  }

  return workbook;
}

function triggerXlsxDownload(buffer, filename) {
  const bytes = excelBufferToUint8Array(buffer);
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2500);
}

export async function downloadInventoryAuditExcel({
  rows,
  title,
  sheetName = "Kiem ke",
} = {}) {
  const workbook = await buildInventoryAuditWorkbook({ rows, sheetName });
  const buffer = await workbook.xlsx.writeBuffer();
  triggerXlsxDownload(buffer, inventoryAuditExportFilename(title));
}
