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
  let totalActualValue = 0;
  let totalErpValue = 0;
  let totalActualQty = 0;
  let rowsWithQty = 0;

  /** @type {Map<string, number>} */
  const statusCounts = new Map();
  /** @type {Map<string, number>} */
  const warehouseValue = new Map();
  /** @type {Map<string, number>} */
  const categoryQty = new Map();

  let discrepancyLines = 0;
  /** @type {string[]} */
  const months = [];

  for (const r of rows) {
    const aq = typeof r.actualQty === "number" ? r.actualQty : 0;
    if (r.actualQty != null) rowsWithQty += 1;
    totalActualQty += aq;

    const av =
      typeof r.amountActual === "number" ? r.amountActual : 0;
    const ev = typeof r.amountErp === "number" ? r.amountErp : 0;
    totalActualValue += av;
    totalErpValue += ev;

    const st =
      String(r.status ?? "").trim() || "—";
    statusCounts.set(st, (statusCounts.get(st) || 0) + 1);

    const wh = String(r.whCode ?? r.warehouseName ?? "").trim() || "—";
    warehouseValue.set(wh, (warehouseValue.get(wh) || 0) + av);

    const cat = String(r.category ?? "").trim() || "—";
    categoryQty.set(cat, (categoryQty.get(cat) || 0) + aq);

    const ga = typeof r.gapAbs === "number" ? r.gapAbs : null;
    const g = typeof r.gap === "number" ? r.gap : null;
    const disc =
      (ga != null && Math.abs(ga) > 1e-6) ||
      (g != null && Math.abs(g) > 1e-6) ||
      r.checkFlag === false;
    if (disc) discrepancyLines += 1;

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

  const topLines = [...rows]
    .map((r, i) => ({
      i,
      label: [r.item, r.code].filter(Boolean).join(" · ") || `#${i + 1}`,
      value: typeof r.amountActual === "number" ? r.amountActual : 0,
      qty: typeof r.actualQty === "number" ? r.actualQty : 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);

  return {
    rowCount: rows.length,
    periodLabel,
    totalActualQty,
    rowsWithQty,
    totalActualValue,
    totalErpValue,
    valueDelta: totalActualValue - totalErpValue,
    statusCounts,
    warehouseValue,
    categoryQty,
    discrepancyLines,
    topLines,
  };
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

/** Gap có dấu: ưu tiên cột Gap (đúng như file); thiếu thì fallback Thực tế − 전산 (sys). */
export function getSignedGap(row) {
  if (row == null || typeof row !== "object") return null;
  const gapNumeric =
    typeof row.gap === "number" ? row.gap : parseFlexibleNumber(row.gap);
  if (gapNumeric != null && Number.isFinite(gapNumeric)) return gapNumeric;
  const a = row.actualQty;
  const s = row.sysQty;
  if (typeof a === "number" && typeof s === "number" && Number.isFinite(a) && Number.isFinite(s)) {
    return a - s;
  }
  return null;
}

export function getAbsGap(row) {
  if (row == null || typeof row !== "object") return null;
  if (typeof row.gapAbs === "number" && Number.isFinite(row.gapAbs)) {
    return row.gapAbs;
  }
  const sg = getSignedGap(row);
  if (sg != null) return Math.abs(sg);
  return null;
}

function valueDeltaRow(row) {
  const av = typeof row.amountActual === "number" ? row.amountActual : 0;
  const ev = typeof row.amountErp === "number" ? row.amountErp : 0;
  return av - ev;
}

/**
 * Pivot: mỗi CODE × từng tháng — tổng Gap (có dấu), tổng |Gap|, chênh giá trị TT−ERP.
 * @param {object[]} rows — mỗi dòng có `month` (khuyến nghị), `code`, …
 */
export function buildMonthCodeGapPivot(rows) {
  /** @type {Map<string, string>} */
  const monthDisplay = new Map();
  /** @type {Map<string, Map<string, { signedSum: number; absSum: number; vdSum: number; n: number }>>} */
  const byCode = new Map();
  /** @type {Map<string, string>} */
  const codeItem = new Map();

  for (const r of rows) {
    const mRaw = String(r.month ?? "").trim();
    const { sortKey, display } = normalizeMonthSortKey(mRaw || "—");
    monthDisplay.set(sortKey, mRaw && display !== "—" ? display : mRaw || display);

    const codeRaw = String(r.code ?? "").trim();
    const code = codeRaw || `∅`;
    const item = String(r.item ?? "").trim();
    if (item && !codeItem.has(code)) codeItem.set(code, item);

    const sg = getSignedGap(r);
    const ab = getAbsGap(r);
    const vd = valueDeltaRow(r);

    if (!byCode.has(code)) byCode.set(code, new Map());
    const byM = byCode.get(code);
    if (!byM.has(sortKey)) {
      byM.set(sortKey, { signedSum: 0, absSum: 0, vdSum: 0, n: 0 });
    }
    const cell = byM.get(sortKey);
    if (sg != null && Number.isFinite(sg)) cell.signedSum += sg;
    if (ab != null && Number.isFinite(ab)) cell.absSum += ab;
    cell.vdSum += vd;
    cell.n += 1;
  }

  const monthOrder = [...monthDisplay.keys()].filter((k) => k !== "_").sort();
  if (monthOrder.length === 0 && monthDisplay.has("_")) {
    monthOrder.push("_");
  }

  const months = monthOrder.map((sortKey) => ({
    sortKey,
    display: monthDisplay.get(sortKey) ?? sortKey,
  }));

  /** @type {Array<{ code: string; item: string; byMonth: Record<string, { signedSum: number; absSum: number; vdSum: number; n: number }>; swingSigned: number | null; swingValue: number | null }>} */
  const pivotRows = [];

  for (const [code, byM] of byCode) {
    const presentMonths = monthOrder.filter((mk) => byM.has(mk));
    const byMonth = {};
    for (const mk of monthOrder) {
      const c = byM.get(mk);
      if (c) byMonth[mk] = { ...c };
    }

    let swingSigned = null;
    let swingValue = null;
    if (presentMonths.length >= 2) {
      const first = presentMonths[0];
      const last = presentMonths[presentMonths.length - 1];
      const a = byM.get(first);
      const b = byM.get(last);
      if (a && b) {
        swingSigned = b.signedSum - a.signedSum;
        swingValue = b.vdSum - a.vdSum;
      }
    }

    pivotRows.push({
      code,
      item: codeItem.get(code) ?? "",
      byMonth,
      swingSigned,
      swingValue,
    });
  }

  pivotRows.sort((a, b) => {
    const av = Math.abs(a.swingSigned ?? 0);
    const bv = Math.abs(b.swingSigned ?? 0);
    if (bv !== av) return bv - av;
    return String(a.code).localeCompare(String(b.code), "vi");
  });

  const monthTotalsSigned = monthOrder.map((sortKey) => {
    let s = 0;
    for (const r of rows) {
      const mRaw = String(r.month ?? "").trim();
      const { sortKey: sk } = normalizeMonthSortKey(mRaw || "—");
      if (sk !== sortKey) continue;
      const g = getSignedGap(r);
      if (g != null) s += g;
    }
    return s;
  });
  const monthTotalsAbs = monthOrder.map((sortKey) => {
    let s = 0;
    for (const r of rows) {
      const mRaw = String(r.month ?? "").trim();
      const { sortKey: sk } = normalizeMonthSortKey(mRaw || "—");
      if (sk !== sortKey) continue;
      const g = getAbsGap(r);
      if (g != null) s += g;
    }
    return s;
  });

  return { months, pivotRows, monthTotalsSigned, monthTotalsAbs };
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
