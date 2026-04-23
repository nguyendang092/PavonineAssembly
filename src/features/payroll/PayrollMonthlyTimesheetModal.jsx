import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import * as XLSX from "@e965/xlsx";
import ExcelJS from "exceljs";
import { db, ref, get } from "@/services/firebase";
import { buildPayrollMonthDayChunkFromRaw } from "@/features/payroll/buildPayrollDayFromRaw";
import {
  formatCoeffHoursForDisplay,
  formatCoeffLabel,
  getPayrollMonthlyCoeffHoursMap,
  getPayrollMonthlyMainRowCell,
  PAYROLL_MONTHLY_SUBROWS,
} from "@/features/payroll/payrollMonthlyCoefficientBuckets";
import {
  enumerateDateKeysInclusive,
  getFirstDayOfMonthKey,
  getLastDayOfMonthKey,
  parseLocalDateKey,
} from "@/utils/dateKey";
import { roundHoursForPayrollDisplay } from "@/features/attendance/attendanceWorkingHours";

function collectSortedEmployeeIds(dayChunks) {
  const meta = new Map();
  for (const chunk of dayChunks) {
    for (const emp of chunk.employees) {
      const id = emp.id;
      const sttNum = Number(emp.stt);
      const stt = Number.isFinite(sttNum) ? sttNum : 99999;
      const prev = meta.get(id);
      if (!prev) {
        meta.set(id, {
          sttMin: stt,
          mnv: String(emp.mnv ?? ""),
          hoVaTen: String(emp.hoVaTen ?? ""),
          boPhan: String(emp.boPhan ?? ""),
          ngayVaoLam: String(emp.ngayVaoLam ?? "").trim(),
        });
      } else {
        meta.set(id, {
          sttMin: Math.min(prev.sttMin, stt),
          mnv: prev.mnv || String(emp.mnv ?? ""),
          hoVaTen: prev.hoVaTen || String(emp.hoVaTen ?? ""),
          boPhan: prev.boPhan || String(emp.boPhan ?? ""),
          ngayVaoLam: prev.ngayVaoLam || String(emp.ngayVaoLam ?? "").trim(),
        });
      }
    }
  }
  return [...meta.entries()]
    .sort((a, b) => {
      if (a[1].sttMin !== b[1].sttMin) return a[1].sttMin - b[1].sttMin;
      return String(a[1].mnv).localeCompare(String(b[1].mnv), "vi", {
        numeric: true,
      });
    })
    .map(([id]) => id);
}

function representativeEmployee(dayChunks, id) {
  let out = null;
  for (const ch of dayChunks) {
    const e = ch.byId.get(id);
    if (!e) continue;
    if (!out) out = { ...e };
    else {
      out = {
        ...out,
        hoVaTen: out.hoVaTen || e.hoVaTen,
        boPhan: out.boPhan || e.boPhan,
        mnv: out.mnv || e.mnv,
        ngayVaoLam: out.ngayVaoLam || e.ngayVaoLam,
        stt: out.stt != null && String(out.stt).trim() !== "" ? out.stt : e.stt,
      };
    }
  }
  return out;
}

/** Cột cố định trái: [px] — tổng ~564px trước cột ngày. */
const STICKY_COL_WIDTHS = [36, 176, 92, 92, 30, 30];
const MONTH_DAY_COL_WIDTH = 35;
const MONTH_DETAIL_COL_WIDTH = 45;
const MONTH_DETAIL_COLS_PER_BLOCK = 15;
const DETAIL_GROUP_KEYS = ["total", "trial", "official"];
const MONTH_HEADER_ROW_TOPS_DEFAULT = {
  row1: 0,
  row2: 28,
  row3: 76,
};

function stickyColStyle(colIndex) {
  let left = 0;
  for (let i = 0; i < colIndex; i++) left += STICKY_COL_WIDTHS[i];
  const isLastStickyCol = colIndex === STICKY_COL_WIDTHS.length - 1;
  return {
    position: "sticky",
    left,
    zIndex: 120 - colIndex,
    width: STICKY_COL_WIDTHS[colIndex],
    minWidth: STICKY_COL_WIDTHS[colIndex],
    maxWidth: colIndex === 1 ? 220 : STICKY_COL_WIDTHS[colIndex],
    boxSizing: "border-box",
    backgroundClip: "padding-box",
    transform: "translateZ(0)",
    borderRight: isLastStickyCol ? "2px solid #000" : "1px dashed #94a3b8",
  };
}

function monthDayCellStyle() {
  return {
    width: MONTH_DAY_COL_WIDTH,
    minWidth: MONTH_DAY_COL_WIDTH,
    maxWidth: MONTH_DAY_COL_WIDTH,
    boxSizing: "border-box",
  };
}

function monthDetailCellStyle() {
  return {
    width: MONTH_DETAIL_COL_WIDTH,
    minWidth: MONTH_DETAIL_COL_WIDTH,
    maxWidth: MONTH_DETAIL_COL_WIDTH,
    boxSizing: "border-box",
  };
}

function monthHeaderStickyStyle(top, zIndex) {
  return {
    position: "sticky",
    top,
    zIndex,
    backgroundClip: "padding-box",
    isolation: "isolate",
  };
}

function detailGroupHeaderTone(groupKey) {
  if (groupKey === "total") return "bg-slate-200 dark:bg-slate-700";
  if (groupKey === "trial") return "bg-cyan-100 dark:bg-cyan-900";
  return "bg-violet-100 dark:bg-violet-900";
}

function detailGroupBodyTone(groupIndex) {
  if (groupIndex === 0) return "bg-slate-50 dark:bg-slate-900";
  if (groupIndex === 1) return "bg-cyan-50/60 dark:bg-cyan-950/20";
  return "bg-violet-50/60 dark:bg-violet-950/20";
}

function parseHtmlTableToGrid(tableEl) {
  const rows = [...tableEl.querySelectorAll("tr")];
  const grid = [];
  const merges = [];
  const cellStyles = [];
  const occupied = new Map();

  const mark = (r, c) => occupied.set(`${r}:${c}`, true);
  const isOcc = (r, c) => occupied.has(`${r}:${c}`);

  rows.forEach((tr, rIdx) => {
    if (!grid[rIdx]) grid[rIdx] = [];
    const cells = [...tr.querySelectorAll("th,td")];
    let cIdx = 0;
    cells.forEach((cell) => {
      while (isOcc(rIdx, cIdx)) cIdx += 1;
      const rs = Math.max(1, Number(cell.getAttribute("rowspan") || 1));
      const cs = Math.max(1, Number(cell.getAttribute("colspan") || 1));
      const text = String(cell.innerText ?? cell.textContent ?? "")
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter(
          (line, idx, arr) => line !== "" || (idx > 0 && idx < arr.length - 1),
        )
        .join("\n")
        .trim();
      const csObj = window.getComputedStyle(cell);

      grid[rIdx][cIdx] = text;
      cellStyles.push({
        row: rIdx + 1,
        col: cIdx + 1,
        style: {
          backgroundColor: csObj.backgroundColor,
          color: csObj.color,
          fontSize: csObj.fontSize,
          fontWeight: csObj.fontWeight,
          textAlign: csObj.textAlign,
          verticalAlign: csObj.verticalAlign,
          borderTop: csObj.borderTop,
          borderRight: csObj.borderRight,
          borderBottom: csObj.borderBottom,
          borderLeft: csObj.borderLeft,
          whiteSpace: csObj.whiteSpace,
        },
      });
      for (let rr = rIdx; rr < rIdx + rs; rr += 1) {
        if (!grid[rr]) grid[rr] = [];
        for (let cc = cIdx; cc < cIdx + cs; cc += 1) {
          mark(rr, cc);
          if (!(rr === rIdx && cc === cIdx)) grid[rr][cc] = null;
        }
      }
      if (rs > 1 || cs > 1) {
        merges.push({
          from: { row: rIdx + 1, col: cIdx + 1 },
          to: { row: rIdx + rs, col: cIdx + cs },
        });
      }
      cIdx += cs;
    });
  });

  return { grid, merges, cellStyles };
}

function rgbStringToArgb(rgbString, fallback = "FF000000") {
  const s = String(rgbString || "").trim();
  if (!s || s === "transparent") return null;
  const m = s.match(
    /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:[\s,\/]+([0-9.]+))?\s*\)$/i,
  );
  if (!m) return fallback;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  const a =
    m[4] == null ? 1 : Math.max(0, Math.min(1, Number.parseFloat(m[4]) || 0));
  const alpha = Math.round(a * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  const rr = Math.max(0, Math.min(255, r))
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  const gg = Math.max(0, Math.min(255, g))
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  const bb = Math.max(0, Math.min(255, b))
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  if (alpha === "00") return null;
  return `${alpha}${rr}${gg}${bb}`;
}

function cssBorderToExcelBorder(borderValue, fallbackArgb = "FF94A3B8") {
  const raw = String(borderValue || "").trim();
  if (!raw || raw === "none" || raw === "0px") return null;
  const widthMatch = raw.match(/(\d+(?:\.\d+)?)px/);
  const styleMatch = raw.match(
    /\b(solid|dashed|dotted|double|groove|ridge|inset|outset)\b/i,
  );
  const colorMatch = raw.match(/rgba?\([^)]+\)/i);
  const px = widthMatch ? Number.parseFloat(widthMatch[1]) : 1;
  const cssStyle = styleMatch ? styleMatch[1].toLowerCase() : "solid";
  const excelStyle =
    cssStyle === "dashed"
      ? "dashed"
      : cssStyle === "dotted"
        ? "dotted"
        : cssStyle === "double"
          ? "double"
          : px >= 2
            ? "medium"
            : "thin";
  const argb = rgbStringToArgb(colorMatch?.[0], fallbackArgb) || fallbackArgb;
  return { style: excelStyle, color: { argb } };
}

function isProbationStatus(raw) {
  return String(raw ?? "").trim() === "thu_viec";
}

function formatProfileDateKey(raw, displayLocale) {
  const s = String(raw ?? "").trim();
  if (!s) return "—";
  const d = parseLocalDateKey(s.slice(0, 10));
  if (!d) return s.slice(0, 10);
  return d.toLocaleDateString(displayLocale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatEnglishWeekday3(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
}

function leaveUnitsByCode(leaveShort, code) {
  const t = String(leaveShort ?? "")
    .trim()
    .toUpperCase();
  const c = String(code ?? "")
    .trim()
    .toUpperCase();
  if (!t || !c) return 0;
  if (t === c) return 1;
  if (t === `1/2${c}` || t === `1/2 ${c}`) return 0.5;
  return 0;
}

function buildMonthlyRuleSummary(dayChunks, monthKeys, id) {
  const out = {
    workDays: 0,
    unpaidDays: 0,
    pnDays: 0,
    nbDays: 0,
    klDays: 0,
    kpDays: 0,
    coeff03: 0,
    coeff15: 0,
    coeff20: 0,
    coeff27: 0,
    coeff30: 0,
    coeff39: 0,
    sats20: 0,
    sats27: 0,
  };
  for (const dk of monthKeys) {
    const ch = dayChunks.get(dk);
    if (!ch) continue;
    const emp = ch.byId.get(id);
    if (!emp) continue;
    const main = getPayrollMonthlyMainRowCell(emp, ch);
    if (main.kind === "hours" && Number.isFinite(main.hours)) {
      out.workDays += Number(main.hours) / 8;
    }
    if (main.kind === "leave") {
      const pnUnits = leaveUnitsByCode(main.leaveShort, "PN");
      out.pnDays += pnUnits;
      // Quy ước bảng này: Tổng ngày công = ngày có giờ công + phép năm (PN, 1/2PN).
      out.workDays += pnUnits;
      out.nbDays += leaveUnitsByCode(main.leaveShort, "NB");
      out.klDays += leaveUnitsByCode(main.leaveShort, "KL");
      out.kpDays += leaveUnitsByCode(main.leaveShort, "KP");
    }
    const coeffMap = getPayrollMonthlyCoeffHoursMap({
      gioVao: emp.gioVao,
      gioRa: emp.gioRa,
      isOffDay: ch.isOffDay,
      isHolidayDay: ch.isHolidayDay,
      caLamViec: emp.caLamViec,
      payrollEarlyOtPaperwork: emp.payrollEarlyOtPaperwork,
    });
    out.coeff03 += Number(coeffMap.get(0.3) || 0);
    out.coeff15 += Number(coeffMap.get(1.5) || 0);
    out.coeff20 += Number(coeffMap.get(2.0) || 0);
    out.coeff27 += Number(coeffMap.get(2.7) || 0);
    out.coeff30 += Number(coeffMap.get(3.0) || 0);
    out.coeff39 += Number(coeffMap.get(3.9) || 0);
  }
  out.unpaidDays = out.klDays + out.kpDays;
  return out;
}

function matchesRowFilter(
  emp,
  { searchTerm, departmentFilter, normalizeDepartment },
) {
  const empDeptKey = normalizeDepartment(emp.boPhan);
  const departmentFilterKey = normalizeDepartment(departmentFilter);
  if (departmentFilterKey && empDeptKey !== departmentFilterKey) return false;
  const q = searchTerm.trim().toLowerCase();
  if (!q) return true;
  return (
    (emp.hoVaTen || "").toLowerCase().includes(q) ||
    (emp.mnv || "").toLowerCase().includes(q) ||
    (emp.boPhan || "").toLowerCase().includes(q)
  );
}

/**
 * Modal: lưới theo dõi cả tháng — dữ liệu mỗi ngày qua `buildPayrollMonthDayChunkFromRaw`
 * (cùng pipeline bảng lương: merge + `payrollEarlyOtPaperwork` trên dòng).
 */
export default function PayrollMonthlyTimesheetModal({
  open,
  onClose,
  anchorDateKey,
  displayLocale = "vi-VN",
  tlPage,
  searchTerm = "",
  departmentFilter = "",
  normalizeDepartment = (v) =>
    String(v || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase(),
}) {
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [dayChunks, setDayChunks] = useState([]);
  const [localDepartmentFilter, setLocalDepartmentFilter] = useState("");
  const [localNameFilter, setLocalNameFilter] = useState("");
  const [headerRowTops, setHeaderRowTops] = useState(
    MONTH_HEADER_ROW_TOPS_DEFAULT,
  );
  const tableWrapRef = useRef(null);
  const loadSeqRef = useRef(0);

  const monthRange = useMemo(() => {
    const first = getFirstDayOfMonthKey(anchorDateKey);
    const last = getLastDayOfMonthKey(anchorDateKey);
    const keys = enumerateDateKeysInclusive(first, last);
    return { first, last, keys };
  }, [anchorDateKey]);

  const monthTitle = useMemo(() => {
    const d = parseLocalDateKey(monthRange.first);
    if (!d) return anchorDateKey;
    return d.toLocaleDateString(displayLocale, {
      month: "long",
      year: "numeric",
    });
  }, [monthRange.first, anchorDateKey, displayLocale]);

  const loadMonth = useCallback(async () => {
    const currentLoadSeq = loadSeqRef.current + 1;
    loadSeqRef.current = currentLoadSeq;
    setLoading(true);
    setLoadingMore(false);
    setError("");
    setDayChunks([]);
    try {
      const allChunks = [];
      const batchSize = 4;
      for (let i = 0; i < monthRange.keys.length; i += batchSize) {
        const batchKeys = monthRange.keys.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batchKeys.map(async (dateKey) => {
            const snap = await get(ref(db, `attendance/${dateKey}`));
            return buildPayrollMonthDayChunkFromRaw(snap.val(), dateKey);
          }),
        );
        if (loadSeqRef.current !== currentLoadSeq) return;
        const validBatch = batchResults.filter(Boolean);
        allChunks.push(...validBatch);
        setDayChunks([...allChunks]);
        if (i === 0) {
          setLoading(false);
        }
        if (i + batchSize < monthRange.keys.length) {
          setLoadingMore(true);
        }
      }
      if (loadSeqRef.current !== currentLoadSeq) return;
      if (!allChunks.length) {
        setError(
          tlPage(
            "monthlyTimesheetEmpty",
            "Không có dữ liệu điểm danh nào trong tháng này.",
          ),
        );
      }
    } catch (e) {
      if (loadSeqRef.current !== currentLoadSeq) return;
      setError(
        tlPage("monthlyTimesheetError", "Không tải được dữ liệu: {{error}}", {
          error: e?.message || String(e),
        }),
      );
    } finally {
      if (loadSeqRef.current === currentLoadSeq) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [monthRange.keys, tlPage]);

  useEffect(() => {
    if (!open) return;
    void loadMonth();
  }, [open, loadMonth]);

  const sortedIds = useMemo(
    () => collectSortedEmployeeIds(dayChunks),
    [dayChunks],
  );

  const departmentOptions = useMemo(() => {
    const set = new Set();
    sortedIds.forEach((id) => {
      const rep = representativeEmployee(dayChunks, id);
      const d = String(rep?.boPhan ?? "").trim();
      if (d) set.add(d);
    });
    return [...set].sort((a, b) => a.localeCompare(b, "vi"));
  }, [sortedIds, dayChunks]);

  const effectiveDepartmentFilter =
    localDepartmentFilter || departmentFilter || "";
  const effectiveSearchTerm = localNameFilter || searchTerm || "";

  const filteredIds = useMemo(() => {
    return sortedIds.filter((id) => {
      const rep = representativeEmployee(dayChunks, id);
      return (
        rep &&
        matchesRowFilter(rep, {
          searchTerm: effectiveSearchTerm,
          departmentFilter: effectiveDepartmentFilter,
          normalizeDepartment,
        })
      );
    });
  }, [
    sortedIds,
    dayChunks,
    effectiveSearchTerm,
    effectiveDepartmentFilter,
    normalizeDepartment,
  ]);

  const chunkByDate = useMemo(
    () => new Map(dayChunks.map((c) => [c.dateKey, c])),
    [dayChunks],
  );
  const stickyColsTotalWidth = useMemo(
    () => STICKY_COL_WIDTHS.reduce((sum, w) => sum + w, 0),
    [],
  );
  const monthDaysWidth = monthRange.keys.length * MONTH_DAY_COL_WIDTH;
  const modalMonthViewportWidth = stickyColsTotalWidth + monthDaysWidth + 320;
  const tableViewportHeight = 184 + PAYROLL_MONTHLY_SUBROWS.length * 24 * 4;

  useEffect(() => {
    if (!open) return;
    const computeHeaderTops = () => {
      const root = tableWrapRef.current;
      if (!root) return;
      const rows = root.querySelectorAll("thead tr");
      if (!rows || rows.length < 3) return;
      const h1 = rows[0].getBoundingClientRect().height || 0;
      const h2 = rows[1].getBoundingClientRect().height || 0;
      const nextTops = {
        row1: 0,
        row2: Math.round(h1),
        row3: Math.round(h1 + h2),
      };
      setHeaderRowTops((prev) =>
        prev.row2 === nextTops.row2 && prev.row3 === nextTops.row3
          ? prev
          : nextTops,
      );
    };
    computeHeaderTops();
    const rafId = window.requestAnimationFrame(computeHeaderTops);
    window.addEventListener("resize", computeHeaderTops);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", computeHeaderTops);
    };
  }, [open, monthRange.keys.length, filteredIds.length, loading, loadingMore]);

  const stickyThBase =
    "relative border border-r-0 !border-solid border-[1px] border-slate-400 !bg-slate-100 bg-clip-padding px-1.5 py-1.5 text-left text-[10px] font-bold text-slate-900 dark:border-slate-500 dark:!bg-slate-800 dark:text-slate-100";
  const stickyTdBase =
    "relative border border-r-0 !border-solid border-[1px] border-slate-300 !bg-white bg-clip-padding px-1.5 py-1 align-middle text-[10px] font-medium text-slate-900 dark:border-slate-700 dark:!bg-slate-900 dark:text-slate-100";
  const strongBorder = "!border-2 !border-black !border-solid";
  const strongBorderBottom = "!border-b-2 !border-b-black !border-solid";
  const strongBorderLeft = "!border-l-2 !border-l-black !border-solid";
  const thinHeadBorder =
    "border !border-solid border-[1px] border-slate-400 dark:border-slate-600";
  const thinBodyBorder =
    "border !border-solid border-[1px] border-slate-300 dark:border-slate-700";
  const noTopBorder = "!border-t-0";
  const detailHeaders = [
    tlPage("monthlyRuleColWorkHours", "Tổng giờ công"),
    tlPage("monthlyRuleColWorkDays", "Tổng ngày công bao gồm PN"),
    tlPage("monthlyRuleColUnpaid", "Tổng ngày nghỉ không lương"),
    tlPage("monthlyRuleColPn", "Phép năm (PN)"),
    tlPage("monthlyRuleColNb", "Nghỉ bù (NB)"),
    tlPage("monthlyRuleColKl", "Nghỉ KL (KL)"),
    tlPage("monthlyRuleColKp", "Nghỉ KP (KP)"),
    "Giờ làm (x0.3)",
    "TC ngày thường (x1.5)",
    "TC đêm/TC ngày nghỉ (x2.0)",
    "TC đêm ngày nghỉ (x2.7)",
    "TC ngày lễ (x3.0)",
    "TC đêm ngày lễ (x3.9)",
    "Sat.S (x2.0)",
    "Sat.S (x2.7)",
  ];

  const getTableElement = useCallback(() => {
    const root = tableWrapRef.current;
    if (!root) return null;
    return root.querySelector("table");
  }, []);

  const handleExportExcel = useCallback(async () => {
    const tableEl = getTableElement();
    if (!tableEl) return;
    try {
      const { grid, merges, cellStyles } = parseHtmlTableToGrid(tableEl);
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("MonthlyTimesheet");

      grid.forEach((row) => {
        const values = row.map((v) => (v == null ? "" : v));
        sheet.addRow(values);
      });

      merges.forEach((m) => {
        sheet.mergeCells(m.from.row, m.from.col, m.to.row, m.to.col);
      });

      const maxCols = grid.reduce((m, r) => Math.max(m, r.length), 0);
      const headerRows = 3;
      const fixedCols = 6;
      const daysCols = monthRange.keys.length;
      const detailBlock = MONTH_DETAIL_COLS_PER_BLOCK;
      const firstTotalCol = fixedCols + daysCols + 1;
      const firstTrialCol = firstTotalCol + detailBlock;
      const firstOfficialCol = firstTrialCol + detailBlock;

      for (let c = 1; c <= maxCols; c += 1) {
        sheet.getColumn(c).width = c <= 6 ? 16 : 6;
      }

      const setSide = (cell, side, style, argb = "FF000000") => {
        const cur = cell.border || {};
        cell.border = {
          ...cur,
          [side]: { style, color: { argb } },
        };
      };

      for (let r = 1; r <= sheet.rowCount; r += 1) {
        for (let c = 1; c <= maxCols; c += 1) {
          const cell = sheet.getCell(r, c);
          cell.border = {
            top: { style: "thin", color: { argb: "FFB8C1CC" } },
            left: { style: "thin", color: { argb: "FFB8C1CC" } },
            bottom: { style: "thin", color: { argb: "FFB8C1CC" } },
            right: { style: "thin", color: { argb: "FFB8C1CC" } },
          };
          cell.alignment = {
            vertical: "middle",
            horizontal: c <= 2 ? "left" : "center",
            wrapText: true,
          };
          cell.font = { size: r <= 3 ? 10 : 9, bold: r <= 3 };
        }
      }
      cellStyles.forEach(({ row, col, style }) => {
        const cell = sheet.getCell(row, col);
        const fillArgb = rgbStringToArgb(style.backgroundColor);
        if (fillArgb) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: fillArgb },
          };
        }
        const textArgb = rgbStringToArgb(style.color, "FF000000") || "FF000000";
        const parsedFontSize = Number.parseFloat(style.fontSize || "");
        const parsedWeight = Number.parseInt(style.fontWeight || "400", 10);
        cell.font = {
          ...(cell.font || {}),
          color: { argb: textArgb },
          size: Number.isFinite(parsedFontSize)
            ? Math.max(8, Math.min(14, parsedFontSize))
            : cell.font?.size || 9,
          bold: parsedWeight >= 600,
        };
        const alignMap = {
          left: "left",
          center: "center",
          right: "right",
          start: "left",
          end: "right",
          justify: "justify",
        };
        const vAlignMap = {
          top: "top",
          middle: "middle",
          bottom: "bottom",
        };
        cell.alignment = {
          ...(cell.alignment || {}),
          horizontal: alignMap[style.textAlign] || cell.alignment?.horizontal,
          vertical: vAlignMap[style.verticalAlign] || cell.alignment?.vertical,
          wrapText: style.whiteSpace !== "nowrap",
        };
        cell.border = {
          top:
            cssBorderToExcelBorder(style.borderTop, "FFB8C1CC") ||
            cell.border?.top,
          right:
            cssBorderToExcelBorder(style.borderRight, "FFB8C1CC") ||
            cell.border?.right,
          bottom:
            cssBorderToExcelBorder(style.borderBottom, "FFB8C1CC") ||
            cell.border?.bottom,
          left:
            cssBorderToExcelBorder(style.borderLeft, "FFB8C1CC") ||
            cell.border?.left,
        };
      });

      // Viền đậm ngoài bảng (giống giao diện)
      for (let c = 1; c <= maxCols; c += 1) {
        setSide(sheet.getCell(1, c), "top", "medium");
        setSide(sheet.getCell(sheet.rowCount, c), "bottom", "medium");
      }
      for (let r = 1; r <= sheet.rowCount; r += 1) {
        setSide(sheet.getCell(r, 1), "left", "medium");
        setSide(sheet.getCell(r, maxCols), "right", "medium");
      }

      // Viền dọc đậm phân khối: trước Tổng / Thử việc / Hợp đồng
      [firstTotalCol, firstTrialCol, firstOfficialCol].forEach((col) => {
        if (col > maxCols) return;
        for (let r = 1; r <= sheet.rowCount; r += 1) {
          setSide(sheet.getCell(r, col), "left", "medium");
        }
      });

      // Viền ngang đậm sau mỗi block nhân viên (7 dòng / NV)
      const bodyRows = filteredIds.length * PAYROLL_MONTHLY_SUBROWS.length;
      for (let i = 1; i <= filteredIds.length; i += 1) {
        const row = headerRows + i * PAYROLL_MONTHLY_SUBROWS.length;
        if (row > headerRows + bodyRows) continue;
        for (let c = 1; c <= maxCols; c += 1) {
          setSide(sheet.getCell(row, c), "bottom", "medium");
        }
      }

      const buf = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const d = new Date();
      const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(
        2,
        "0",
      )}${String(d.getDate()).padStart(2, "0")}_${String(d.getHours()).padStart(
        2,
        "0",
      )}${String(d.getMinutes()).padStart(2, "0")}`;
      a.href = url;
      a.download = `BangChamCongThang_${stamp}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(
        tlPage(
          "monthlyTimesheetExportError",
          "Không xuất được Excel: {{error}}",
          {
            error: e?.message || String(e),
          },
        ),
      );
    }
  }, [filteredIds.length, getTableElement, monthRange.keys.length, tlPage]);

  if (!open) return null;

  const portal = (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-black/50 p-2 backdrop-blur-[1px] sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payroll-monthly-timesheet-title"
    >
      <div
        className="mx-auto flex w-full flex-col overflow-hidden rounded-xl border border-indigo-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900"
        style={{
          maxWidth: `min(calc(100vw - 1rem), ${modalMonthViewportWidth}px)`,
          maxHeight: "calc(100vh - 1rem)",
        }}
      >
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2 dark:border-slate-700">
          <div className="min-w-0">
            <h2
              id="payroll-monthly-timesheet-title"
              className="truncate text-sm font-extrabold uppercase tracking-wide text-white sm:text-base"
            >
              {tlPage("monthlyTimesheetTitle", "Bảng chấm công tháng")}
              {` (${monthTitle})`}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void loadMonth()}
              disabled={loading}
              className="rounded-lg border border-white/40 bg-white/15 px-2.5 py-1 text-xs font-bold text-white transition hover:bg-white/25 disabled:opacity-50"
            >
              {tlPage("monthlyTimesheetReload", "Tải lại")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border-2 border-white/80 bg-white px-3 py-1 text-xs font-bold text-indigo-700 shadow-sm hover:bg-indigo-50"
            >
              {tlPage("monthlyTimesheetClose", "Đóng")}
            </button>
          </div>
        </div>

        <div className="min-h-0 flex flex-1 flex-col p-2 sm:p-3">
          <div className="mb-2 flex flex-wrap items-center justify-end gap-2 rounded-lg border border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-sky-50 px-2 py-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
            <input
              type="text"
              value={localNameFilter}
              onChange={(e) => setLocalNameFilter(e.target.value)}
              placeholder={tlPage(
                "monthlyTimesheetFilterNamePlaceholder",
                "Lọc theo tên / MNV / bộ phận",
              )}
              className="w-[220px] rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <select
              value={localDepartmentFilter}
              onChange={(e) => setLocalDepartmentFilter(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">
                {tlPage("monthlyTimesheetDeptAll", "Tất cả bộ phận")}
              </option>
              {departmentOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleExportExcel}
              className="rounded-md border border-emerald-300 bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 shadow-sm hover:bg-emerald-200"
            >
              {tlPage("monthlyTimesheetExportExcel", "Xuất Excel")}
            </button>
          </div>
          <div
            className="min-h-0 overflow-auto"
            style={{
              height: `min(calc(100vh - 11.5rem), ${tableViewportHeight}px)`,
            }}
          >
            {loading && !dayChunks.length ? (
              <p className="py-8 text-center text-sm font-semibold text-slate-600 dark:text-slate-300">
                {tlPage(
                  "monthlyTimesheetLoading",
                  "Đang tải dữ liệu điểm danh…",
                )}
              </p>
            ) : error && !dayChunks.length ? (
              <p className="py-8 text-center text-sm font-semibold text-red-600 dark:text-red-400">
                {error}
              </p>
            ) : (
              <div
                ref={tableWrapRef}
                className="inline-block min-w-full align-middle"
              >
                <table
                className={`w-max min-w-full border-collapse text-left text-[10px] text-slate-900 dark:text-slate-100 ${strongBorder}`}
                >
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800">
                      {[0, 1, 2, 3, 4, 5].map((ci) => (
                        <th
                          key={`h1-${ci}`}
                          rowSpan={3}
                          style={{
                            ...stickyColStyle(ci),
                            ...monthHeaderStickyStyle(
                              headerRowTops.row1,
                              180 - ci,
                            ),
                          }}
                          className={`${stickyThBase} text-center align-middle`}
                        >
                          {ci === 4 ? (
                            <div className="flex h-[56px] items-center justify-center overflow-visible">
                              <div className="flex -rotate-90 items-center whitespace-nowrap text-center font-bold leading-tight tracking-[0.12em]">
                                {tlPage("monthlyTimesheetColDept", "BP")}
                              </div>
                            </div>
                          ) : ci === 5 ? (
                            <div className="flex h-[56px] items-center justify-center overflow-visible">
                              <div className="flex -rotate-90 items-center whitespace-nowrap text-center font-bold leading-tight tracking-[0.12em]">
                                {tlPage("monthlyTimesheetColCoeff", "Hệ số TC")}
                              </div>
                            </div>
                          ) : ci === 0 ? (
                            tlPage("monthlyTimesheetColStt", "STT")
                          ) : ci === 1 ? (
                            tlPage("monthlyTimesheetColName", "Họ và tên")
                          ) : ci === 2 ? (
                            tlPage(
                              "monthlyTimesheetColJoinDate",
                              "Ngày vào làm",
                            )
                          ) : (
                            tlPage("monthlyTimesheetColContract", "Ngày HĐ")
                          )}
                        </th>
                      ))}
                      <th
                        colSpan={monthRange.keys.length}
                        style={monthHeaderStickyStyle(headerRowTops.row1, 90)}
                        className={`${thinHeadBorder} bg-slate-200 px-1 py-1.5 text-center text-[10px] font-extrabold uppercase tracking-wide text-slate-900 dark:bg-slate-700 dark:text-slate-100`}
                      >
                        {tlPage(
                          "monthlyTimesheetDaysInMonth",
                          "Ngày trong tháng",
                        )}
                      </th>
                      <th
                        colSpan={MONTH_DETAIL_COLS_PER_BLOCK}
                        style={monthHeaderStickyStyle(headerRowTops.row1, 90)}
                        className={`${thinHeadBorder} ${strongBorderLeft} bg-slate-200 px-1 py-1.5 text-center text-[10px] font-extrabold text-slate-900 dark:bg-slate-700 dark:text-slate-100`}
                      >
                        {tlPage("monthlyRuleTotalTitle", "THỜI GIAN LÀM VIỆC")}
                      </th>
                      <th
                        colSpan={MONTH_DETAIL_COLS_PER_BLOCK}
                        style={monthHeaderStickyStyle(headerRowTops.row1, 90)}
                        className={`${thinHeadBorder} ${strongBorderLeft} bg-slate-200 px-1 py-1.5 text-center text-[10px] font-extrabold text-slate-900 dark:bg-slate-700 dark:text-slate-100`}
                      >
                        {tlPage("monthlyRuleTrialTitle", "THỜI GIAN THỬ VIỆC")}
                      </th>
                      <th
                        colSpan={MONTH_DETAIL_COLS_PER_BLOCK}
                        style={monthHeaderStickyStyle(headerRowTops.row1, 90)}
                        className={`${thinHeadBorder} ${strongBorderLeft} bg-slate-200 px-1 py-1.5 text-center text-[10px] font-extrabold text-slate-900 dark:bg-slate-700 dark:text-slate-100`}
                      >
                        {tlPage(
                          "monthlyRuleOfficialTitle",
                          "THỜI GIAN HỢP ĐỒNG",
                        )}
                      </th>
                    </tr>
                    <tr>
                      {monthRange.keys.map((dk) => {
                        const pd = parseLocalDateKey(dk);
                        const dom = pd ? pd.getDate() : "";
                        const sun = pd && pd.getDay() === 0;
                        const hol = chunkByDate.get(dk);
                        const offCol = sun
                          ? "bg-amber-100 dark:bg-amber-900/55"
                          : hol?.isHolidayDay
                            ? "bg-rose-100 dark:bg-rose-900/40"
                            : hol?.isOffDay
                              ? "bg-cyan-100 dark:bg-cyan-900/35"
                              : "bg-slate-100 dark:bg-slate-800";
                        return (
                          <th
                            key={dk}
                            rowSpan={2}
                            style={{
                              ...monthDayCellStyle(),
                              ...monthHeaderStickyStyle(headerRowTops.row2, 85),
                            }}
                            className={`${thinHeadBorder} ${noTopBorder} px-0.5 py-0.5 text-center text-[9px] font-bold leading-tight text-slate-900 dark:text-slate-100 ${offCol}`}
                          >
                            <div className="flex h-[52px] items-center justify-center overflow-visible">
                              <div className="flex -rotate-90 items-center whitespace-nowrap text-center font-bold leading-tight tracking-[0.12em]">
                                <span className="font-bold">
                                  {String(dom).padStart(2, "0")}
                                </span>
                                <span className="ml-3 text-[9px] font-bold tracking-[0.16em] text-slate-900 dark:text-slate-100">
                                  {formatEnglishWeekday3(pd)}
                                </span>
                              </div>
                            </div>
                          </th>
                        );
                      })}
                      {DETAIL_GROUP_KEYS.flatMap((groupKey) => {
                        const groupBg = detailGroupHeaderTone(groupKey);
                        return [
                          <th
                            key={`${groupKey}-workday`}
                            colSpan={7}
                            style={monthHeaderStickyStyle(
                              headerRowTops.row2,
                              85,
                            )}
                            className={`${thinHeadBorder} ${noTopBorder} ${groupBg} ${strongBorderLeft} px-1 py-1 text-center text-[9px] font-extrabold uppercase tracking-wide text-slate-900 dark:text-slate-100`}
                          >
                            {tlPage("monthlyRuleGroupWorkday", "NGÀY LÀM VIỆC")}
                          </th>,
                          <th
                            key={`${groupKey}-ot`}
                            colSpan={6}
                            style={monthHeaderStickyStyle(
                              headerRowTops.row2,
                              85,
                            )}
                            className={`${thinHeadBorder} ${noTopBorder} ${groupBg} px-1 py-1 text-center text-[9px] font-extrabold uppercase tracking-wide text-slate-900 dark:text-slate-100`}
                          >
                            {tlPage("monthlyRuleGroupOt", "TĂNG CA (Hrs)")}
                          </th>,
                          <th
                            key={`${groupKey}-sats`}
                            colSpan={2}
                            style={monthHeaderStickyStyle(
                              headerRowTops.row2,
                              85,
                            )}
                            className={`${thinHeadBorder} ${noTopBorder} ${groupBg} px-1 py-1 text-center text-[9px] font-extrabold uppercase tracking-wide text-slate-900 dark:text-slate-100`}
                          >
                            SAT.S
                          </th>,
                        ];
                      })}
                    </tr>
                    <tr>
                      {DETAIL_GROUP_KEYS.map((groupKey) =>
                        detailHeaders.map((h, idx) => (
                          <th
                            key={`${groupKey}-${h}`}
                            style={{
                              ...monthDetailCellStyle(idx),
                              ...monthHeaderStickyStyle(headerRowTops.row3, 80),
                            }}
                            className={`${thinHeadBorder} ${noTopBorder} ${detailGroupHeaderTone(groupKey)} ${idx === 0 ? strongBorderLeft : ""} px-1 py-1 text-center text-[9px] font-bold text-slate-900 dark:text-slate-100`}
                          >
                            {h}
                          </th>
                        )),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIds.map((id, empBlockIdx) => {
                      const rep = representativeEmployee(dayChunks, id);
                      const summary = buildMonthlyRuleSummary(
                        chunkByDate,
                        monthRange.keys,
                        id,
                      );
                      const sttDisp =
                        rep?.stt != null && String(rep.stt).trim() !== ""
                          ? rep.stt
                          : empBlockIdx + 1;
                      const joinStr = formatProfileDateKey(
                        rep?.ngayVaoLam,
                        displayLocale,
                      );
                      const fmt = (n) =>
                        Number.isFinite(n) &&
                        roundHoursForPayrollDisplay(n) !== 0
                          ? formatCoeffHoursForDisplay(n)
                          : " ";
                      return PAYROLL_MONTHLY_SUBROWS.map((sr, si) => {
                        const isLastSub =
                          si === PAYROLL_MONTHLY_SUBROWS.length - 1;
                        const isFirstSub = si === 0;
                        const subrowEdgeClass = isLastSub
                          ? strongBorderBottom
                          : "";
                        const blockStartClass =
                          isFirstSub && empBlockIdx > 0 ? "!border-t-0" : "";
                        const employeeStripe =
                          empBlockIdx % 2 === 0
                            ? "bg-white dark:bg-slate-900"
                            : "bg-slate-50 dark:bg-slate-900/80";
                        return (
                          <tr
                            key={`${id}-${sr.key}`}
                            className={`${employeeStripe} hover:bg-slate-50/70 dark:hover:bg-slate-800/35`}
                          >
                            {si === 0 ? (
                              <td
                                rowSpan={PAYROLL_MONTHLY_SUBROWS.length}
                                style={stickyColStyle(0)}
                                className={`${stickyTdBase} text-center font-semibold tabular-nums ${strongBorderBottom}`}
                              >
                                {sttDisp}
                              </td>
                            ) : null}
                            {si === 0 ? (
                              <td
                                rowSpan={PAYROLL_MONTHLY_SUBROWS.length}
                                style={stickyColStyle(1)}
                                className={`${stickyTdBase} leading-tight ${strongBorderBottom}`}
                                title={rep?.hoVaTen ?? ""}
                              >
                                <div className="text-[11px] font-bold text-black dark:text-black">
                                  {rep?.hoVaTen ?? "—"}
                                </div>
                                {rep?.mnv ? (
                                  <div className="mt-0.5 font-mono text-[10px] font-bold text-black dark:text-black">
                                    {rep.mnv}
                                  </div>
                                ) : null}
                              </td>
                            ) : null}
                            {si === 0 ? (
                              <td
                                rowSpan={PAYROLL_MONTHLY_SUBROWS.length}
                                style={stickyColStyle(2)}
                                className={`${stickyTdBase} text-center tabular-nums ${strongBorderBottom}`}
                              >
                                {joinStr}
                              </td>
                            ) : null}
                            {si === 0 ? (
                              <td
                                rowSpan={PAYROLL_MONTHLY_SUBROWS.length}
                                style={stickyColStyle(3)}
                            className={`${stickyTdBase} text-center text-slate-900 dark:text-slate-100 ${strongBorderBottom}`}
                              >
                                {tlPage("monthlyTimesheetContractDash", "—")}
                              </td>
                            ) : null}
                            {si === 0 ? (
                              <td
                                rowSpan={PAYROLL_MONTHLY_SUBROWS.length}
                                style={stickyColStyle(4)}
                                className={`${stickyTdBase} text-center ${strongBorderBottom}`}
                              >
                                <div className="flex h-full items-center justify-center overflow-visible">
                                  <div className="flex -rotate-90 items-center whitespace-nowrap text-center font-medium leading-tight tracking-[0.05em]">
                                    {rep?.boPhan ? (
                                      <span className="font-medium">
                                        {rep.boPhan}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">—</span>
                                    )}
                                  </div>
                                </div>
                              </td>
                            ) : null}
                            <td
                              style={{
                                ...stickyColStyle(5),
                                ...(isLastSub
                                  ? { borderBottom: "2px solid #000" }
                                  : null),
                              }}
                              className={`${stickyTdBase} text-center font-mono font-semibold text-black dark:text-black ${subrowEdgeClass} ${blockStartClass}`}
                            >
                            <span className="text-[10px]">
                              {sr.coeff == null
                                ? "\u00a0"
                                : Number(sr.coeff).toFixed(1)}
                            </span>
                            </td>
                            {monthRange.keys.map((dk) => {
                              const ch = chunkByDate.get(dk);
                              const pd = parseLocalDateKey(dk);
                              const sun = pd && pd.getDay() === 0;
                              let baseBg = "";
                              if (sun) {
                                baseBg = "bg-amber-100 dark:bg-amber-900/35";
                              } else if (ch?.isHolidayDay) {
                                baseBg = "bg-amber-50/90 dark:bg-amber-950/25";
                              } else if (ch?.isOffDay) {
                                baseBg = "bg-sky-50/80 dark:bg-sky-950/20";
                              }
                              if (!ch) {
                                return (
                                  <td
                                    key={dk}
                                    style={{
                                      ...monthDayCellStyle(),
                                      ...(isLastSub
                                        ? { borderBottom: "2px solid #000" }
                                        : null),
                                    }}
                                  className={`${thinBodyBorder} px-0.5 py-0.5 text-center text-[10px] text-slate-400 ${baseBg} ${subrowEdgeClass} ${blockStartClass}`}
                                  >
                                    {" "}
                                  </td>
                                );
                              }
                              const emp = ch.byId.get(id);
                              if (!emp) {
                                return (
                                  <td
                                    key={dk}
                                    style={{
                                      ...monthDayCellStyle(),
                                      ...(isLastSub
                                        ? { borderBottom: "2px solid #000" }
                                        : null),
                                    }}
                                    className={`${thinBodyBorder} px-0.5 py-0.5 ${baseBg} ${subrowEdgeClass} ${blockStartClass}`}
                                  />
                                );
                              }
                              if (sr.coeff == null) {
                                const main = getPayrollMonthlyMainRowCell(
                                  emp,
                                  ch,
                                );
                                let inner;
                                if (main.kind === "leave") {
                                  inner = (
                                    <span
                                      className={`inline-flex max-w-full justify-center rounded border px-1 py-0.5 text-[10px] font-bold ${main.badgeClass}`}
                                      title={main.leaveRaw}
                                    >
                                      {main.leaveShort}
                                    </span>
                                  );
                                } else if (main.kind === "hours") {
                                  inner = (
                                    <span className="font-bold tabular-nums text-black dark:text-black">
                                      {formatCoeffHoursForDisplay(main.hours)}
                                    </span>
                                  );
                                } else {
                                  inner = (
                                    <span className="text-slate-300"> </span>
                                  );
                                }
                                return (
                                  <td
                                    key={dk}
                                    style={{
                                      ...monthDayCellStyle(),
                                      ...(isLastSub
                                        ? { borderBottom: "2px solid #000" }
                                        : null),
                                    }}
                                    className={`${thinBodyBorder} px-0.5 py-0.5 text-center align-middle text-[10px] font-bold text-slate-900 dark:text-slate-100 ${baseBg} ${subrowEdgeClass} ${blockStartClass}`}
                                  >
                                    {inner}
                                  </td>
                                );
                              }
                              const coeffMap = getPayrollMonthlyCoeffHoursMap({
                                gioVao: emp.gioVao,
                                gioRa: emp.gioRa,
                                isOffDay: ch.isOffDay,
                                isHolidayDay: ch.isHolidayDay,
                                caLamViec: emp.caLamViec,
                                payrollEarlyOtPaperwork:
                                  emp.payrollEarlyOtPaperwork,
                              });
                              const h = coeffMap.get(sr.coeff);
                              const show =
                                h != null &&
                                Number.isFinite(h) &&
                                roundHoursForPayrollDisplay(h) !== 0;
                              return (
                                <td
                                  key={dk}
                                  style={{
                                    ...monthDayCellStyle(),
                                    ...(isLastSub
                                      ? { borderBottom: "2px solid #000" }
                                      : null),
                                  }}
                                className={`${thinBodyBorder} px-0.5 py-0.5 text-center align-middle font-mono text-[10px] font-bold tabular-nums text-slate-900 dark:text-slate-100 ${baseBg} ${subrowEdgeClass} ${blockStartClass}`}
                                >
                                  {show ? (
                                    <span className="font-bold text-black dark:text-black">
                                      {formatCoeffHoursForDisplay(h)}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300"> </span>
                                  )}
                                </td>
                              );
                            })}
                            {(() => {
                              const isTrial = isProbationStatus(
                                rep?.trangThaiLamViec,
                              );
                              const tcByRow = [
                                summary.coeff03,
                                summary.coeff15,
                                summary.coeff20,
                                summary.coeff27,
                                summary.coeff30,
                                summary.coeff39,
                              ];
                              const coeffColBySubrow = {
                                1: 0,
                                2: 1,
                                3: 2,
                                4: 3,
                                5: 4,
                                6: 5,
                              };
                              const valuesForStatus = (enabled) =>
                                Array.from(
                                  { length: MONTH_DETAIL_COLS_PER_BLOCK },
                                  (_, idx) => {
                                    if (!enabled) return " ";
                                    if (si === 0) {
                                      if (idx === 0)
                                        return fmt(summary.workDays * 8);
                                      if (idx === 1)
                                        return fmt(summary.workDays);
                                      if (idx === 2)
                                        return fmt(summary.unpaidDays);
                                      if (idx === 3) return fmt(summary.pnDays);
                                      if (idx === 4) return fmt(summary.nbDays);
                                      if (idx === 5) return fmt(summary.klDays);
                                      if (idx === 6) return fmt(summary.kpDays);
                                    }
                                    const coeffIdx = coeffColBySubrow[si];
                                    if (
                                      coeffIdx != null &&
                                      idx === 7 + coeffIdx
                                    ) {
                                      return fmt(tcByRow[coeffIdx]);
                                    }
                                    return " ";
                                  },
                                );
                              const detailValues = [
                                ...valuesForStatus(true),
                                ...valuesForStatus(isTrial),
                                ...valuesForStatus(!isTrial),
                              ];
                              const oneRow = detailValues.map((v, idx) => {
                                const group = Math.floor(
                                  idx / MONTH_DETAIL_COLS_PER_BLOCK,
                                );
                                const groupBg = detailGroupBodyTone(group);
                                return (
                                  <td
                                    key={`detail-${id}-${sr.key}-${idx}`}
                                    style={{
                                      ...monthDetailCellStyle(idx),
                                      ...(isLastSub
                                        ? { borderBottom: "2px solid #000" }
                                        : null),
                                    }}
                                    className={`${thinBodyBorder} ${groupBg} ${subrowEdgeClass} ${
                                      idx % MONTH_DETAIL_COLS_PER_BLOCK === 0
                                        ? strongBorderLeft
                                        : ""
                                    } ${blockStartClass} px-1 py-0.5 text-center text-[10px] font-bold text-slate-900 dark:text-slate-100`}
                                  >
                                    {v}
                                  </td>
                                );
                              });
                              return oneRow;
                            })()}
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
                {error && dayChunks.length ? (
                  <p className="mt-2 text-center text-xs text-amber-700 dark:text-amber-300">
                    {error}
                  </p>
                ) : null}
                {loadingMore ? (
                  <p className="mt-2 text-center text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                    {tlPage(
                      "monthlyTimesheetLoadingMore",
                      "Đang tải thêm dữ liệu của tháng...",
                    )}
                  </p>
                ) : null}
                {!filteredIds.length && dayChunks.length ? (
                  <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-300">
                    {tlPage(
                      "monthlyTimesheetNoRowsAfterFilter",
                      "Không có nhân viên nào khớp bộ lọc tìm kiếm / bộ phận.",
                    )}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(portal, document.body);
}
