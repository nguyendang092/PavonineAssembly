import * as XLSX from "@e965/xlsx";

/**
 * Báo cáo tồn kho (file giống bảng: THỰC TẾ, STATUS, 재고금액, WH010, …).
 * Đọc sheet đầu tiên dạng ma trận (header row 1) để tránh gộp cột trùng tên trong `sheet_to_json`.
 */

/** @typedef {Record<string, number>} ColumnIndexMap */

/** @param {unknown} v */
export function parseFlexibleNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v)
    .replace(/[\u20a9₩$€¥]/g, "")
    .replace(/\s/g, "")
    .replace(/,/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** @param {unknown} v */
export function parseFlexibleBool(v) {
  if (v === true) return true;
  if (v === false) return false;
  const s = String(v).trim().toUpperCase();
  if (s === "TRUE" || s === "1") return true;
  if (s === "FALSE" || s === "0") return false;
  return null;
}

/**
 * Ánh xạ tiêu đề cột → index (thiên về báo cáo gốc KR/VN như trong mẫu).
 * @param {string[]} headers
 * @returns {ColumnIndexMap}
 */
export function resolveWarehouseInventoryColumns(headers) {
  /** @type {ColumnIndexMap} */
  const cols = {};

  /** @param {string} key @param {number} i */
  const setOnce = (key, i) => {
    if (cols[key] === undefined) cols[key] = i;
  };

  headers.forEach((cell, i) => {
    const r = String(cell ?? "").trim();
    const rLower = r.toLowerCase();

    if (/재고금액\s*\(\s*erp\s*\)/i.test(r) || /inventory.*erp/i.test(rLower)) {
      setOnce("amountErp", i);
      return;
    }
    if (/thực\s*tế|thựctế/i.test(r) || /thuc\s*te/i.test(rLower)) {
      setOnce("actualQty", i);
      return;
    }
    if (r.includes("전산수량")) {
      setOnce("sysQty", i);
      return;
    }
    if (r.includes("현재고량")) {
      setOnce("currentQty", i);
      return;
    }
    if (/gap\s*\(\s*abs\s*\)/i.test(r) || rLower.replace(/\s/g, "") === "gap(abs)") {
      setOnce("gapAbs", i);
      return;
    }
    if (
      /^gap$/i.test(r.trim()) ||
      rLower === "gap" ||
      /^gap[^\w]/i.test(r)
    ) {
      if (!/abs/i.test(r)) setOnce("gap", i);
      return;
    }
    if (/lý\s*do|ly\s*do|^reason$/i.test(r)) {
      setOnce("reason", i);
      return;
    }
    if (rLower === "status") {
      setOnce("status", i);
      return;
    }
    if (rLower === "code") {
      setOnce("code", i);
      return;
    }
    if (rLower === "item") {
      setOnce("item", i);
      return;
    }
    if (r === "구분") {
      setOnce("category", i);
      return;
    }
    if (rLower === "model") {
      setOnce("model", i);
      return;
    }
    if (rLower === "spec") {
      setOnce("spec", i);
      return;
    }
    if (rLower === "unit" || r === "단위" || /đơn\s*vị/i.test(r)) {
      setOnce("unit", i);
      return;
    }
    if (rLower === "warehouse" || /^warehouse$/i.test(rLower)) {
      setOnce("warehouseName", i);
      return;
    }
    if (/창고|mã\s*kho|ma\s*kho/i.test(r)) {
      setOnce("whCode", i);
      return;
    }
    if (
      rLower === "month" ||
      /^tháng/i.test(r) ||
      /^월$/i.test(r) ||
      /기준\s*월/.test(r) ||
      /재고\s*월/.test(r)
    ) {
      setOnce("month", i);
      return;
    }
    if (/^no\.?$/i.test(r) || r === "STT" || rLower === "no") {
      setOnce("rowNo", i);
      return;
    }
    if (/단가|đơn\s*giá|don\s*gi/i.test(r)) {
      setOnce("unitPrice", i);
      return;
    }
    if ((/số\s*tiền|so\s*tien/i.test(r) || rLower === "amount") && !/재고/.test(r)) {
      setOnce("lineAmount", i);
      return;
    }
    if (
      /차이\s*금액/.test(r) ||
      /so\s*tien\s*cl/i.test(rLower) ||
      /số\s*tiền\s*cl/i.test(r) ||
      /chenh\s*lech\s*tien/i.test(rLower)
    ) {
      setOnce("diffAmount", i);
      return;
    }
    if (/ghi\s*chú|ghi\s*chu|notes/i.test(r)) {
      setOnce("notes", i);
      return;
    }
    if (/^check$/i.test(r) || (rLower.startsWith("check") && r.length < 14 && !/in\s*\d/i.test(rLower))) {
      setOnce("checkFlag", i);
      return;
    }
    if (/재고금액/.test(r) && (/실|thực|actual|current/i.test(r) || /\(실/i.test(r))) {
      setOnce("amountActual", i);
      return;
    }
  });

  if (cols.amountActual === undefined) {
    headers.forEach((cell, i) => {
      const r = String(cell ?? "").trim();
      if (/재고금액/.test(r) && !/erp/i.test(r) && cols.amountErp !== i) {
        setOnce("amountActual", i);
      }
    });
  }

  return cols;
}

/** @param {unknown[]} row @param {ColumnIndexMap} cols */
function pick(row, cols, key) {
  const idx = cols[key];
  if (typeof idx !== "number" || idx < 0 || idx >= row.length) return null;
  return row[idx];
}

/**
 * @param {unknown[][]} matrix — include header row as matrix[0]
 * @returns {{ rows: object[]; colMap: ColumnIndexMap; headers: string[] }}
 */
export function parseWarehouseInventoryMatrix(matrix) {
  if (!matrix?.length || matrix.length < 2) {
    throw new Error("EMPTY_SHEET");
  }
  const headers = matrix[0].map((c) => String(c ?? "").trim());
  const colMap = resolveWarehouseInventoryColumns(headers);
  if (colMap.actualQty === undefined) {
    throw new Error("MISSING_ACTUAL_COLUMN");
  }

  const dataRows = matrix
    .slice(1)
    .filter((r) =>
      Array.isArray(r)
        ? r.some((cell) => String(cell ?? "").trim() !== "")
        : false,
    );

  const rows = dataRows.map((cells) => {
    const actualQty = parseFlexibleNumber(pick(cells, colMap, "actualQty"));
    const sysQty = parseFlexibleNumber(pick(cells, colMap, "sysQty"));
    const currentQty = parseFlexibleNumber(pick(cells, colMap, "currentQty"));
    const gap = parseFlexibleNumber(pick(cells, colMap, "gap"));
    const gapAbs = parseFlexibleNumber(pick(cells, colMap, "gapAbs"));
    const unitPrice = parseFlexibleNumber(pick(cells, colMap, "unitPrice"));
    let amountActual = parseFlexibleNumber(pick(cells, colMap, "amountActual"));
    const amountErp = parseFlexibleNumber(pick(cells, colMap, "amountErp"));
    const lineAmount = parseFlexibleNumber(pick(cells, colMap, "lineAmount"));
    const diffAmount = parseFlexibleNumber(pick(cells, colMap, "diffAmount"));

    if (amountActual == null && unitPrice != null && actualQty != null) {
      amountActual = unitPrice * actualQty;
    }
    if (amountActual == null && lineAmount != null) amountActual = lineAmount;

    return {
      month: pick(cells, colMap, "month"),
      rowNo: pick(cells, colMap, "rowNo"),
      category: pick(cells, colMap, "category"),
      warehouseName: pick(cells, colMap, "warehouseName"),
      item: pick(cells, colMap, "item"),
      spec: pick(cells, colMap, "spec"),
      model: pick(cells, colMap, "model"),
      unit: pick(cells, colMap, "unit"),
      whCode: pick(cells, colMap, "whCode"),
      status: pick(cells, colMap, "status"),
      code: pick(cells, colMap, "code"),
      actualQty,
      sysQty,
      currentQty,
      gap,
      gapAbs,
      checkFlag: parseFlexibleBool(pick(cells, colMap, "checkFlag")),
      reason: pick(cells, colMap, "reason"),
      notes: pick(cells, colMap, "notes"),
      unitPrice,
      amountActual,
      amountErp,
      diffAmount,
    };
  });

  return { rows, colMap, headers };
}

/**
 * @param {File} file
 * @returns {Promise<{ rows: object[]; colMap: ColumnIndexMap; headers: string[] }>}
 */
export function parseWarehouseInventoryFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        if (typeof bstr !== "string") {
          reject(new Error("READ_FAIL"));
          return;
        }
        const workbook = XLSX.read(bstr, { type: "binary" });
        const firstName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstName];
        const matrix = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          raw: false,
          defval: "",
        });
        resolve(parseWarehouseInventoryMatrix(matrix));
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    };
    reader.onerror = () => reject(new Error("READ_FAIL"));
    reader.readAsBinaryString(file);
  });
}

/**
 * @param {object[]} rows
 */
export function computeWarehouseInventoryStats(rows) {
  const months = [];
  for (const r of rows) {
    const m = String(r.month ?? "").trim();
    if (m) months.push(m);
  }
  const uniqMonths = [...new Set(months)];
  const periodLabel =
    uniqMonths.length === 1
      ? uniqMonths[0]
      : uniqMonths.length > 1
        ? uniqMonths.join(" · ")
        : "—";
  return { periodLabel };
}

export function formatKRW(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

/**
 * Chuẩn hóa nhãn tháng (vd. 03-2026, 2026-03) → sortKey YYYY-MM + hiển thị.
 * @param {unknown} raw
 * @returns {{ sortKey: string; display: string }}
 */
export function normalizeMonthSortKey(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return { sortKey: "_", display: "—" };

  let m = t.match(/^(\d{1,2})[-/](\d{4})$/);
  if (m) {
    const mm = String(m[1]).padStart(2, "0");
    const yyyy = m[2];
    return { sortKey: `${yyyy}-${mm}`, display: `${mm}-${yyyy}` };
  }
  m = t.match(/^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?$/);
  if (m) {
    const yyyy = m[1];
    const mm = String(m[2]).padStart(2, "0");
    return { sortKey: `${yyyy}-${mm}`, display: `${mm}-${yyyy}` };
  }

  const compact = t.replace(/\s+/g, " ");
  return {
    sortKey: compact.toLowerCase(),
    display: compact,
  };
}

/** Năm từ monthKey `YYYY-MM` hoặc nhãn `MM-YYYY`. */
export function yearFromMonthKey(monthKey) {
  const t = String(monthKey ?? "").trim();
  const yyyyMm = t.match(/^(\d{4})-(\d{2})$/);
  if (yyyyMm) return yyyyMm[1];
  const mmYyyy = t.match(/^(\d{2})-(\d{4})$/);
  if (mmYyyy) return mmYyyy[2];
  const y = t.match(/(?:^|[^\d])(\d{4})(?:[^\d]|$)/);
  return y ? y[1] : "";
}

/** Tháng xuất hiện nhiều nhất trong dữ liệu (gợi ý khi lưu kỳ). */
export function dominantMonthLabel(rows) {
  const counts = new Map();
  for (const r of rows) {
    const m = String(r.month ?? "").trim();
    if (!m) continue;
    counts.set(m, (counts.get(m) || 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? "";
}
