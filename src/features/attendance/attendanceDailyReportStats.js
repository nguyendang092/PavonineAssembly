import { classifyAttendanceDashboardEmployee } from "./attendanceDashboardMetrics";
import { getAttendanceComboFlags } from "./attendanceComboStats";
import {
  getAttendanceLeaveTypeRaw,
  normalizeAttendanceDayRecord,
} from "./attendanceGioVaoTypeOptions";
import { isNightShiftCaLamViec } from "./attendanceWorkingHours";
import { pickAttendanceEmployeeDayFields } from "./attendanceEmployeeFields";
import {
  ATTENDANCE_DAILY_REPORT_PROCESSES,
  getDailyReportRemarkLabels,
  resolveDailyReportEmployeeProcessId,
} from "./attendanceDailyReportConfig";

export const ATTENDANCE_DAILY_REPORT_ANDON_WARN = 5;
export const ATTENDANCE_DAILY_REPORT_ANDON_BAD = 15;
export const ATTENDANCE_DAILY_REPORT_RATE_BAR_MAX = 20;

export function getDailyReportAndonTier(rate) {
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return "ok";
  if (rate > ATTENDANCE_DAILY_REPORT_ANDON_BAD) return "bad";
  if (rate >= ATTENDANCE_DAILY_REPORT_ANDON_WARN) return "warn";
  return "ok";
}

export function getDailyReportRateBarWidth(
  rate,
  maxScale = ATTENDANCE_DAILY_REPORT_RATE_BAR_MAX,
) {
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return 0;
  return Math.min(100, Math.round((rate / maxScale) * 100));
}

export function getDailyReportProcessMaxAbsentRate(row) {
  const rates = [
    row.regular?.day?.absentRate,
    row.regular?.night?.absentRate,
    row.seasonal?.day?.absentRate,
    row.seasonal?.night?.absentRate,
  ].filter((rate) => rate != null && Number.isFinite(rate));
  return rates.length ? Math.max(...rates) : 0;
}

export function getDailyReportRemarkTags(counts = {}, locale = "vi-VN") {
  const labels = getDailyReportRemarkLabels(locale);
  const keyOrder = [
    "annualLeave",
    "halfAnnualLeave",
    "sickLeave",
    "noPermit",
    "unpaidLeave",
    "maternity",
    "funeralLeave",
    "weddingLeave",
    "laborAccident",
    "recuperationLeave",
    "absent",
  ];
  const tags = [];
  for (const key of keyOrder) {
    const count = counts[key] ?? 0;
    if (count <= 0) continue;
    const code = labels[key];
    if (!code) continue;
    tags.push({ key, code, count });
  }
  return tags;
}

export function buildDailyReportDashboardMetrics(rows = [], summary = {}) {
  const grandDay = summary.grand?.day ?? emptyShiftCell();
  const grandNight = summary.grand?.night ?? emptyShiftCell();
  const regularDay = summary.regular?.day ?? emptyShiftCell();
  const regularNight = summary.regular?.night ?? emptyShiftCell();
  const seasonalDay = summary.seasonal?.day ?? emptyShiftCell();
  const seasonalNight = summary.seasonal?.night ?? emptyShiftCell();

  // KPI «Tổng nhân sự» khớp cột Tổng NS ca ngày ở dòng TỔNG CỘNG (không cộng thêm ca đêm).
  const totalHeadcount = grandDay.total;
  const regularHeadcount = regularDay.total;
  const seasonalHeadcount = seasonalDay.total;
  const totalPresent = grandDay.present + grandNight.present;
  const dayPresent = regularDay.present + seasonalDay.present;
  const nightPresent = regularNight.present + seasonalNight.present;
  const totalAbsent = grandDay.absent + grandNight.absent;
  const totalPending =
    (grandDay.pendingAttendance ?? 0) + (grandNight.pendingAttendance ?? 0);
  const absenceRate =
    totalHeadcount > 0 ? (totalAbsent / totalHeadcount) * 100 : null;

  const attentionRows = rows.filter(
    (row) =>
      getDailyReportProcessMaxAbsentRate(row) >=
      ATTENDANCE_DAILY_REPORT_ANDON_WARN,
  );

  return {
    totalHeadcount,
    regularHeadcount,
    seasonalHeadcount,
    totalPresent,
    dayPresent,
    nightPresent,
    totalAbsent,
    totalPending,
    absenceRate,
    attentionCount: attentionRows.length,
    attentionLabels: attentionRows.map((row) => row.labelKo),
  };
}


function emptyShiftCell() {
  return {
    total: 0,
    absent: 0,
    pendingAttendance: 0,
    present: 0,
    absentRate: null,
    remarkCounts: {},
  };
}

function finalizeShiftCell(cell, locale) {
  const total = cell.total;
  const absent = cell.absent;
  const pendingAttendance = cell.pendingAttendance ?? 0;
  const present = Math.max(0, total - absent - pendingAttendance);
  const absentRate = total > 0 ? (absent / total) * 100 : null;
  const remarks = formatDailyReportRemarkCounts(cell.remarkCounts, locale);
  return {
    total,
    absent,
    pendingAttendance,
    present,
    absentRate,
    remarks,
    remarkCounts: { ...cell.remarkCounts },
  };
}

function resolveRemarkKey(flags, category) {
  if (category === "absent") return "absent";
  const order = [
    "annualLeave",
    "halfAnnualLeave",
    "sickLeave",
    "noPermit",
    "unpaidLeave",
    "maternity",
    "funeralLeave",
    "weddingLeave",
    "laborAccident",
    "recuperationLeave",
  ];
  for (const key of order) {
    if (flags[key]) return key;
  }
  if (category === "onLeave") return "annualLeave";
  return "absent";
}

function isResignedLeaveEmployee(flags) {
  return Boolean(flags?.resignedLeave);
}

function employeeHasLeaveTypeForDailyReport(emp) {
  return String(getAttendanceLeaveTypeRaw(emp) ?? "").trim() !== "";
}

function bumpRemarkCount(map, key) {
  map[key] = (map[key] ?? 0) + 1;
}

export function formatDailyReportRemarkCounts(counts, locale = "vi-VN") {
  const labels = getDailyReportRemarkLabels(locale);
  const keyOrder = [
    "annualLeave",
    "halfAnnualLeave",
    "sickLeave",
    "noPermit",
    "unpaidLeave",
    "maternity",
    "funeralLeave",
    "weddingLeave",
    "laborAccident",
    "recuperationLeave",
    "absent",
  ];
  const parts = [];
  for (const key of keyOrder) {
    const n = counts[key] ?? 0;
    if (n <= 0) continue;
    const label = labels[key];
    if (!label) continue;
    parts.push(`${label} ${n}`);
  }
  return parts.join(" - ");
}

function isEmployeeAbsentForDailyReport(category) {
  return category === "onLeave" || category === "absent" || category === "nightPending";
}

function classifyEmployeeShift(emp) {
  const day = pickAttendanceEmployeeDayFields(emp);
  const flags = getAttendanceComboFlags(emp);
  return isNightShiftCaLamViec(day.shiftCode) || flags.nightShift ? "night" : "day";
}

function createReportGrid() {
  const grid = new Map();
  for (const process of ATTENDANCE_DAILY_REPORT_PROCESSES) {
    grid.set(process.id, {
      regular: { day: emptyShiftCell(), night: emptyShiftCell() },
      seasonal: { day: emptyShiftCell(), night: emptyShiftCell() },
    });
  }
  return grid;
}

function addEmployeeToCell(cell, category, remarkKey, flags, emp) {
  if (isResignedLeaveEmployee(flags)) return;
  cell.total += 1;
  if (!isEmployeeAbsentForDailyReport(category)) return;
  if (!employeeHasLeaveTypeForDailyReport(emp)) {
    cell.pendingAttendance = (cell.pendingAttendance ?? 0) + 1;
    return;
  }
  cell.absent += 1;
  bumpRemarkCount(cell.remarkCounts, remarkKey);
}

/** Gom NV theo công đoạn × loại (정규직/일용직) × ca (주간/야간). */
export function buildAttendanceDailyReportGrid(
  regularEmployees = [],
  seasonalEmployees = [],
  options = {},
) {
  const locale = options.locale ?? "vi-VN";
  const grid = createReportGrid();

  const ingest = (employees, workerType) => {
    for (const emp of employees) {
      const normalized = normalizeAttendanceDayRecord(emp);
      const processId = resolveDailyReportEmployeeProcessId(normalized);
      if (!processId || !grid.has(processId)) continue;

      const { category, flags } =
        classifyAttendanceDashboardEmployee(normalized);
      const shift = classifyEmployeeShift(normalized);
      const remarkKey = resolveRemarkKey(flags, category);
      const bucket = grid.get(processId)[workerType][shift];
      addEmployeeToCell(bucket, category, remarkKey, flags, normalized);
    }
  };

  ingest(regularEmployees, "regular");
  ingest(seasonalEmployees, "seasonal");

  const rows = ATTENDANCE_DAILY_REPORT_PROCESSES.map((process) => {
    const entry = grid.get(process.id);
    return {
      processId: process.id,
      labelKo: process.labelKo,
      labelEn: process.labelEn,
      regular: {
        day: finalizeShiftCell(entry.regular.day, locale),
        night: finalizeShiftCell(entry.regular.night, locale),
      },
      seasonal: {
        day: finalizeShiftCell(entry.seasonal.day, locale),
        night: finalizeShiftCell(entry.seasonal.night, locale),
      },
    };
  });

  const summary = buildDailyReportSummary(rows, locale);
  return { rows, summary };
}

function sumShiftCells(cells, locale) {
  const merged = emptyShiftCell();
  for (const cell of cells) {
    merged.total += cell.total;
    merged.absent += cell.absent;
    merged.pendingAttendance =
      (merged.pendingAttendance ?? 0) + (cell.pendingAttendance ?? 0);
    for (const [key, n] of Object.entries(cell.remarkCounts ?? {})) {
      merged.remarkCounts[key] = (merged.remarkCounts[key] ?? 0) + n;
    }
  }
  return finalizeShiftCell(merged, locale);
}

function sumFromRows(rows, workerType, shift, locale) {
  return sumShiftCells(rows.map((row) => row[workerType][shift]), locale);
}

export function buildDailyReportSummary(rows, locale = "vi-VN") {
  const regularDay = sumFromRows(rows, "regular", "day", locale);
  const regularNight = sumFromRows(rows, "regular", "night", locale);
  const seasonalDay = sumFromRows(rows, "seasonal", "day", locale);
  const seasonalNight = sumFromRows(rows, "seasonal", "night", locale);

  const grandDay = sumShiftCells([regularDay, seasonalDay], locale);
  const grandNight = sumShiftCells([regularNight, seasonalNight], locale);

  return {
    regular: { day: regularDay, night: regularNight },
    seasonal: { day: seasonalDay, night: seasonalNight },
    grand: { day: grandDay, night: grandNight },
  };
}

export function formatDailyReportAbsentRate(rate) {
  if (rate == null || !Number.isFinite(rate)) return "—";
  if (rate === 0) return "0%";
  const rounded = Math.round(rate * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

export function formatDailyReportHeaderDate(dateKey, locale = "ko-KR") {
  if (!dateKey) return "";
  const [y, m, d] = String(dateKey).split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  if (locale.startsWith("ko")) {
    return `${String(m).padStart(2, "0")}.${String(d).padStart(2, "0")}`;
  }
  return new Date(y, m - 1, d).toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
  });
}
