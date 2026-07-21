import * as XLSX from "@e965/xlsx";
import {
  S90D_DEFECT_COLUMNS,
  S90D_PROCESSES,
  normalizeS90dProcess,
} from "./s90dDefectColumns";
import {
  ensureDayEntry,
  DEFAULT_PRODUCT_CODE,
  ensureProcessBoardAtIndex,
  getProcessEntry,
  normalizeManualStore,
  parseNonNegativeInt,
  resolveProcessBoards,
  updateManualProductCode,
  updateManualShiftField,
} from "./s90dManualEntries";
import { S90D_SHIFT_SLOTS, resolveShiftSlotKey } from "./s90dShiftSlots";

const BASE_HEADERS = Object.freeze([
  "Ngày",
  "Công đoạn",
  "Bảng",
  "Ca",
  "Mã hàng",
  "SL đạt",
]);

export function buildS90dExcelHeaders() {
  return [...BASE_HEADERS, ...S90D_DEFECT_COLUMNS.map(({ vi }) => vi)];
}

function trimCell(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function normalizeHeader(value) {
  return trimCell(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function parseExcelDate(value, workbook) {
  if (value == null || value === "") return "";

  const fmt = (y, m, d) =>
    y && m && d
      ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      : "";

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value, {
      date1904: workbook?.Workbook?.WBProps?.date1904 || false,
    });
    if (parsed?.y && parsed?.m && parsed?.d) {
      return fmt(parsed.y, parsed.m, parsed.d);
    }
  }

  if (value instanceof Date && !Number.isNaN(value)) {
    return fmt(
      value.getFullYear(),
      value.getMonth() + 1,
      value.getDate(),
    );
  }

  const str = trimCell(value);
  if (!str) return "";

  const iso = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) return fmt(+iso[1], +iso[2], +iso[3]);

  const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) return fmt(+dmy[3], +dmy[2], +dmy[1]);

  return "";
}

export function normalizeExcelShiftSlot(value) {
  const text = trimCell(value).replace(/[–—]/g, "-");
  if (!text) return "";
  const withTilde = text.replace(/-/g, "~");
  const resolved = resolveShiftSlotKey(withTilde);
  return S90D_SHIFT_SLOTS.includes(resolved) ? resolved : "";
}

export function normalizeExcelProcess(value) {
  const raw = trimCell(value).toUpperCase();
  if (S90D_PROCESSES.includes(raw)) return raw;
  return normalizeS90dProcess(raw);
}

function buildHeaderIndexMap(headerRow) {
  const expected = buildS90dExcelHeaders();
  const matchesTemplate =
    headerRow.length >= expected.length &&
    expected.every(
      (label, index) => normalizeHeader(headerRow[index]) === normalizeHeader(label),
    );

  if (matchesTemplate) {
    return {
      dateKey: 0,
      process: 1,
      boardIndex: 2,
      shiftSlot: 3,
      productCode: 4,
      okQty: 5,
      defects: Object.fromEntries(
        S90D_DEFECT_COLUMNS.map(({ key }, index) => [key, index + 6]),
      ),
    };
  }

  const normalizedHeaders = headerRow.map((cell) => normalizeHeader(cell));
  if (
    normalizedHeaders[0] === "ngay" &&
    normalizedHeaders[1] === "cong doan" &&
    (normalizedHeaders[2] === "ca" || String(headerRow[2] ?? "").trim().toLowerCase() === "ca") &&
    normalizedHeaders[3] === "ma hang" &&
    (normalizedHeaders[4] === "sl dat" || normalizedHeaders[4]?.startsWith("sl"))
  ) {
    return {
      dateKey: 0,
      process: 1,
      boardIndex: -1,
      shiftSlot: 2,
      productCode: 3,
      okQty: 4,
      defects: Object.fromEntries(S90D_DEFECT_COLUMNS.map(({ key }) => [key, -1])),
    };
  }

  const map = {
    dateKey: -1,
    process: -1,
    boardIndex: -1,
    shiftSlot: -1,
    productCode: -1,
    okQty: -1,
    defects: Object.fromEntries(S90D_DEFECT_COLUMNS.map(({ key }) => [key, -1])),
  };

  headerRow.forEach((cell, index) => {
    const header = normalizeHeader(cell);
    if (!header) return;

    if (["ngay", "date", "ngay san xuat"].includes(header)) {
      map.dateKey = index;
      return;
    }
    if (["cong doan", "process", "bo phan"].includes(header)) {
      map.process = index;
      return;
    }
    if (["bang", "board", "table"].includes(header)) {
      map.boardIndex = index;
      return;
    }
    if (["ca", "shift", "khung gio", "line"].includes(header)) {
      map.shiftSlot = index;
      return;
    }
    if (["ma hang", "product code", "productcode"].includes(header)) {
      map.productCode = index;
      return;
    }
    if (["sl dat", "ok", "ok qty", "so luong dat"].includes(header)) {
      map.okQty = index;
      return;
    }

    S90D_DEFECT_COLUMNS.forEach(({ key, vi, shortVi }) => {
      const candidates = [
        normalizeHeader(vi),
        normalizeHeader(shortVi),
        normalizeHeader(key),
      ];
      if (candidates.includes(header)) {
        map.defects[key] = index;
      }
    });
  });

  if (normalizedHeaders.includes("ngay") && map.dateKey < 0) {
    map.dateKey = normalizedHeaders.indexOf("ngay");
  }
  if (normalizedHeaders.includes("cong doan") && map.process < 0) {
    map.process = normalizedHeaders.indexOf("cong doan");
  }
  if (normalizedHeaders.includes("ca") && map.shiftSlot < 0) {
    map.shiftSlot = normalizedHeaders.indexOf("ca");
  }
  if (normalizedHeaders.includes("ma hang") && map.productCode < 0) {
    map.productCode = normalizedHeaders.indexOf("ma hang");
  }
  if (normalizedHeaders.includes("sl dat") && map.okQty < 0) {
    map.okQty = normalizedHeaders.indexOf("sl dat");
  }

  return map;
}

export function buildS90dExcelRowsFromStore(store, monthDayKeys, options = {}) {
  const { processFilter = null } = options;
  const processes = processFilter
    ? S90D_PROCESSES.filter((process) => process === processFilter)
    : S90D_PROCESSES;

  const rows = [];
  monthDayKeys.forEach((dateKey) => {
    processes.forEach((process) => {
      const processDayEntry = getProcessEntry(store, dateKey, process);
      resolveProcessBoards(processDayEntry).forEach((board, boardIndex) => {
        S90D_SHIFT_SLOTS.forEach((shiftSlot) => {
          const shift = board.shifts[shiftSlot];
          rows.push([
            dateKey,
            process,
            boardIndex + 1,
            shiftSlot.replace(/~/g, "-"),
            board.productCode || DEFAULT_PRODUCT_CODE,
            shift?.okQty ?? 0,
            ...S90D_DEFECT_COLUMNS.map(({ key }) => shift?.defects?.[key] ?? 0),
          ]);
        });
      });
    });
  });

  return rows;
}

export function exportS90dManualMonthToExcel({
  store,
  monthDayKeys,
  monthKey,
  processFilter = null,
}) {
  const headers = buildS90dExcelHeaders();
  const rows = buildS90dExcelRowsFromStore(store, monthDayKeys, { processFilter });
  const guideRows = [
    ["Huong dan nhap Excel S90D"],
    ["Ngay: yyyy-MM-dd hoac dd/MM/yyyy"],
    [`Cong doan: ${S90D_PROCESSES.join(", ")}`],
    ["Bang: 1, 2, ... (neu mot ngay co nhieu bang du lieu)"],
    [`Ca: ${S90D_SHIFT_SLOTS.map((slot) => slot.replace(/~/g, "-")).join(", ")}`],
    ["SL dat + tong cot loi = SL NG tu dong khi luu tren web"],
  ];

  const dataSheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const guideSheet = XLSX.utils.aoa_to_sheet(guideRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, dataSheet, "S90D_Nhap");
  XLSX.utils.book_append_sheet(wb, guideSheet, "Huong_dan");

  const suffix = processFilter ? `_${processFilter}` : "";
  XLSX.writeFile(wb, `S90D_${monthKey}${suffix}.xlsx`);
}

export function parseS90dManualExcelRows(sheetRows, workbook) {
  if (!sheetRows?.length) return [];

  const headerRowIndex = sheetRows.findIndex((row) =>
    row.some((cell) => {
      const header = normalizeHeader(cell);
      return header === "ngay" || header === "date";
    }),
  );
  if (headerRowIndex < 0) {
    throw new Error("MISSING_HEADER");
  }

  const headerMap = buildHeaderIndexMap(sheetRows[headerRowIndex]);
  if (headerMap.dateKey < 0 || headerMap.process < 0 || headerMap.shiftSlot < 0) {
    throw new Error("MISSING_HEADER");
  }

  const parsedRows = [];
  for (let i = headerRowIndex + 1; i < sheetRows.length; i += 1) {
    const row = sheetRows[i] ?? [];
    const dateKey = parseExcelDate(row[headerMap.dateKey], workbook);
    const process = normalizeExcelProcess(row[headerMap.process]);
    const shiftSlot = normalizeExcelShiftSlot(row[headerMap.shiftSlot]);
    const boardIndex =
      headerMap.boardIndex >= 0
        ? Math.max(1, parseNonNegativeInt(row[headerMap.boardIndex]) || 1)
        : 1;

    if (!dateKey || !process || !shiftSlot) continue;

    const productCode =
      headerMap.productCode >= 0
        ? trimCell(row[headerMap.productCode]) || DEFAULT_PRODUCT_CODE
        : DEFAULT_PRODUCT_CODE;
    const okQty =
      headerMap.okQty >= 0 ? parseNonNegativeInt(row[headerMap.okQty]) : 0;

    const defects = Object.fromEntries(
      S90D_DEFECT_COLUMNS.map(({ key }) => {
        const col = headerMap.defects[key];
        return [key, col >= 0 ? parseNonNegativeInt(row[col]) : 0];
      }),
    );

    const hasQty =
      okQty > 0 || S90D_DEFECT_COLUMNS.some(({ key }) => defects[key] > 0);
    if (!hasQty) continue;

    parsedRows.push({
      dateKey,
      process,
      boardIndex,
      shiftSlot,
      productCode,
      okQty,
      defects,
    });
  }

  return parsedRows;
}

export async function readS90dManualExcelFile(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName =
    workbook.SheetNames.find((name) => name === "S90D_Nhap") ??
    workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const sheetRows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });

  return parseS90dManualExcelRows(sheetRows, workbook);
}

export function mergeImportedRowsIntoStore(store, rows) {
  let next = normalizeManualStore(store);

  rows.forEach(
    ({
      dateKey,
      process,
      boardIndex = 1,
      shiftSlot,
      productCode,
      okQty,
      defects,
    }) => {
      const day = { ...ensureDayEntry(next, dateKey) };
      const processDayEntry = ensureProcessBoardAtIndex(day[process], boardIndex);
      const boardId = processDayEntry.boards[boardIndex - 1]?.id;
      day[process] = processDayEntry;
      next[dateKey] = day;

      next = updateManualProductCode(
        next,
        dateKey,
        process,
        productCode,
        boardId,
      );
      next = updateManualShiftField(
        next,
        dateKey,
        process,
        shiftSlot,
        "okQty",
        okQty,
        boardId,
      );
      S90D_DEFECT_COLUMNS.forEach(({ key }) => {
        next = updateManualShiftField(
          next,
          dateKey,
          process,
          shiftSlot,
          key,
          defects[key] ?? 0,
          boardId,
        );
      });
    },
  );

  return normalizeManualStore(next);
}
