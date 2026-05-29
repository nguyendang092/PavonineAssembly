import {
  DEFAULT_DEPARTMENT,
  DEFAULT_ERROR_TYPE,
  MC_DEFECT_ERROR_TYPE_COLORS,
  MC_DEFECT_FILTER_ALL,
} from "./constants";

export const toMonthKey = (date) => String(date || "").slice(0, 7);

export const normalizeText = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

export const makeFirebaseSafeKey = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[.#$[\]/]/g, "_")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "unknown";

export const makeCompositeKey = ({
  date,
  employee,
  department = DEFAULT_DEPARTMENT,
  errorType = DEFAULT_ERROR_TYPE,
}) =>
  [
    String(date || "").trim(),
    normalizeText(employee).toLowerCase(),
    normalizeText(department || DEFAULT_DEPARTMENT).toLowerCase(),
    normalizeText(errorType || DEFAULT_ERROR_TYPE).toLowerCase(),
  ].join("||");

export const makeReadableRecordKey = ({ employee, department, errorType }) =>
  `${makeFirebaseSafeKey(employee)}__${makeFirebaseSafeKey(
    department || DEFAULT_DEPARTMENT,
  )}__${makeFirebaseSafeKey(errorType || DEFAULT_ERROR_TYPE)}`;

export function parseMcDefectReportSnapshot(raw) {
  if (!raw || typeof raw !== "object") return [];
  return Object.entries(raw)
    .flatMap(([dateKey, byRecordKey]) => {
      if (!byRecordKey || typeof byRecordKey !== "object") return [];
      return Object.entries(byRecordKey).map(([recordKey, value]) => {
        const v = value || {};
        return {
          id: `${dateKey}/${recordKey}`,
          date: String(v.date || dateKey || "").slice(0, 10),
          recordKey,
          employee: normalizeText(v.employee),
          department: normalizeText(v.department || DEFAULT_DEPARTMENT),
          errorType: normalizeText(v.errorType || DEFAULT_ERROR_TYPE),
          errorCount: Number(v.errorCount || 0),
          note: normalizeText(v.note),
          updatedAt: Number(v.updatedAt || 0),
        };
      });
    })
    .filter((row) => row.date && row.employee)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export function filterMcDefectRows(rows, filters) {
  const { reportMonth, reportDepartment, reportEmployee, reportErrorType } =
    filters;
  return rows.filter((row) => {
    if (reportMonth !== MC_DEFECT_FILTER_ALL && toMonthKey(row.date) !== reportMonth)
      return false;
    if (
      reportDepartment !== MC_DEFECT_FILTER_ALL &&
      row.department !== reportDepartment
    )
      return false;
    if (reportEmployee !== MC_DEFECT_FILTER_ALL && row.employee !== reportEmployee)
      return false;
    if (reportErrorType !== MC_DEFECT_FILTER_ALL && row.errorType !== reportErrorType)
      return false;
    return true;
  });
}

export function buildMonthOptions(rows) {
  const options = [
    ...new Set(rows.map((row) => toMonthKey(row.date)).filter(Boolean)),
  ].sort();
  if (!options.length) {
    const now = new Date();
    return [
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    ];
  }
  return options;
}

export function buildByDateData(filteredRows) {
  const dateMap = new Map();
  filteredRows.forEach((row) => {
    const key = row.date || "";
    dateMap.set(
      key,
      Number(dateMap.get(key) || 0) + Number(row.errorCount || 0),
    );
  });
  return [...dateMap.entries()]
    .map(([date, errorCount]) => ({ date, errorCount }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function normalizeMcDefectEmployeeName(value) {
  return String(value ?? "").trim() || "Unknown";
}

export function buildByEmployeeData(filteredRows, limit = 10) {
  const employeeMap = new Map();
  filteredRows.forEach((row) => {
    const key = normalizeMcDefectEmployeeName(row.employee);
    employeeMap.set(
      key,
      Number(employeeMap.get(key) || 0) + Number(row.errorCount || 0),
    );
  });
  return [...employeeMap.entries()]
    .map(([employee, errorCount]) => ({ employee, errorCount }))
    .sort((a, b) => b.errorCount - a.errorCount)
    .slice(0, limit);
}

export function buildDonutByErrorTypeData(filteredRows) {
  const groupMap = new Map();
  filteredRows.forEach((row) => {
    const key = row.errorType || DEFAULT_ERROR_TYPE;
    groupMap.set(
      key,
      Number(groupMap.get(key) || 0) + Number(row.errorCount || 0),
    );
  });
  const sorted = [...groupMap.entries()]
    .map(([name, value]) => ({ name, value: Number(value) }))
    .sort((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, item) => sum + item.value, 0);
  return sorted.map((item) => ({
    ...item,
    percent: total > 0 ? (item.value / total) * 100 : 0,
  }));
}

export function buildHeatmapData(filteredRows, _byEmployeeData, byDateData) {
  const employeeMap = new Map();
  filteredRows.forEach((row) => {
    const employee = normalizeMcDefectEmployeeName(row.employee);
    employeeMap.set(
      employee,
      Number(employeeMap.get(employee) || 0) + Number(row.errorCount || 0),
    );
  });
  const employees = [...employeeMap.entries()]
    .sort(
      (a, b) =>
        Number(b[1] || 0) - Number(a[1] || 0) || a[0].localeCompare(b[0]),
    )
    .map(([employee]) => employee);
  const days = byDateData.map((x) => x.date);
  const map = new Map();
  filteredRows.forEach((row) => {
    const employee = normalizeMcDefectEmployeeName(row.employee);
    const key = `${employee}__${row.date}`;
    map.set(key, Number(map.get(key) || 0) + Number(row.errorCount || 0));
  });
  return { employees, days, map, employeeTotals: employeeMap };
}

export function buildDetailRows(filteredRows) {
  const map = new Map();
  filteredRows.forEach((row) => {
    const key = `${row.employee}__${row.department}`;
    const prev = map.get(key) || {
      employee: row.employee,
      department: row.department,
      totalError: 0,
      latestDate: row.date,
      note: row.note || "",
    };
    prev.totalError += Number(row.errorCount || 0);
    if (String(row.date) > String(prev.latestDate)) prev.latestDate = row.date;
    if (!prev.note && row.note) prev.note = row.note;
    map.set(key, prev);
  });
  return [...map.values()].sort((a, b) => b.totalError - a.totalError);
}

export function buildPreviousMonthRows(rows, reportMonth) {
  if (reportMonth === MC_DEFECT_FILTER_ALL) return [];
  const [yy, mm] = reportMonth.split("-").map(Number);
  const prevMonth =
    mm === 1 ? `${yy - 1}-12` : `${yy}-${String(mm - 1).padStart(2, "0")}`;
  return rows.filter((row) => toMonthKey(row.date) === prevMonth);
}

export function mcDefectErrorTypeColor(index) {
  return MC_DEFECT_ERROR_TYPE_COLORS[
    index % MC_DEFECT_ERROR_TYPE_COLORS.length
  ];
}

export function formatMcDefectPercent(percent) {
  const n = Number(percent);
  if (!Number.isFinite(n)) return "0%";
  return `${n.toFixed(1)}%`;
}

export function formatMcDefectChartPeriodLabel(reportMonth, dateRows, locale = "vi") {
  const isKo = String(locale || "").startsWith("ko");
  if (reportMonth && reportMonth !== MC_DEFECT_FILTER_ALL) {
    const [yy, mm] = String(reportMonth).split("-");
    if (yy && mm) {
      if (isKo) return `${yy}년 · ${Number(mm)}월`;
      return `Năm ${yy} · Tháng ${Number(mm)}/${yy}`;
    }
    if (yy) return isKo ? `${yy}년` : `Năm ${yy}`;
  }
  const monthKeys = [
    ...new Set(
      (dateRows || [])
        .map((d) => toMonthKey(d.date))
        .filter((key) => /^\d{4}-\d{2}$/.test(key)),
    ),
  ].sort();
  if (monthKeys.length === 1) {
    const [yy, mm] = monthKeys[0].split("-");
    if (isKo) return `${yy}년 · ${Number(mm)}월`;
    return `Năm ${yy} · Tháng ${Number(mm)}/${yy}`;
  }

  const years = [
    ...new Set(
      (dateRows || [])
        .map((d) => String(d.date || "").slice(0, 4))
        .filter((y) => /^\d{4}$/.test(y)),
    ),
  ].sort();
  if (!years.length) return "";
  if (years.length === 1) return isKo ? `${years[0]}년` : `Năm ${years[0]}`;
  return isKo
    ? `${years[0]}년 – ${years[years.length - 1]}년`
    : `Năm ${years[0]} – ${years[years.length - 1]}`;
}

export function parseMcDefectIsoDate(dateKey) {
  const match = String(dateKey || "")
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return { year: match[1], month: match[2], day: match[3] };
}

/** Nhãn tháng ngắn trên trục (T5, 5월). */
export function formatMcDefectChartMonthTick(month, locale = "vi") {
  const mm = Number(month);
  if (!mm) return "";
  if (String(locale || "").startsWith("ko")) return `${mm}월`;
  return `T${mm}`;
}

/** Chỉ số ngày trên trục (1, 2, … 31). */
export function formatMcDefectChartDayTick(dateKey) {
  const parsed = parseMcDefectIsoDate(dateKey);
  if (parsed) return String(Number(parsed.day));
  return String(dateKey || "").trim();
}

export function shouldShowMcDefectMonthOnAxis(dateKey, previousDateKey) {
  if (!dateKey) return false;
  if (!previousDateKey) return true;
  return toMonthKey(dateKey) !== toMonthKey(previousDateKey);
}

/** Ngày đầy đủ cho tooltip (dd/mm/yyyy). */
/** Header bảng heatmap: nhóm theo tháng + cột chỉ hiển thị ngày. */
export function buildMcDefectHeatmapColumnHeader(days, locale = "vi") {
  const sortedDays = [...(days || [])].filter(Boolean).sort();
  const monthGroups = [];

  sortedDays.forEach((dateKey) => {
    const monthKey = toMonthKey(dateKey);
    let group = monthGroups[monthGroups.length - 1];
    if (!group || group.monthKey !== monthKey) {
      group = {
        monthKey,
        label: formatMcDefectHeatmapMonthHeader(monthKey, locale),
        dayColumns: [],
      };
      monthGroups.push(group);
    }
    group.dayColumns.push({
      dateKey,
      dayLabel: formatMcDefectChartDayTick(dateKey),
      fullLabel: formatMcDefectChartFullDate(dateKey, locale),
    });
  });

  return {
    monthGroups,
    spansMultipleMonths: monthGroups.length > 1,
  };
}

export function formatMcDefectHeatmapMonthHeader(monthKey, locale = "vi") {
  const [yy, mm] = String(monthKey || "").split("-");
  if (!yy || !mm) return "";
  if (String(locale || "").startsWith("ko")) {
    return `${yy}년 ${Number(mm)}월`;
  }
  return `Tháng ${Number(mm)}/${yy}`;
}

export function formatMcDefectChartFullDate(dateKey, locale = "vi") {
  const parsed = parseMcDefectIsoDate(dateKey);
  if (!parsed) return String(dateKey || "").trim();
  const day = String(Number(parsed.day)).padStart(2, "0");
  const month = String(Number(parsed.month)).padStart(2, "0");
  if (String(locale || "").startsWith("ko")) {
    return `${parsed.year}년 ${month}월 ${day}일`;
  }
  return `${day}/${month}/${parsed.year}`;
}

/** @deprecated Dùng formatMcDefectChartDayTick + formatMcDefectChartMonthTick */
export function formatMcDefectChartDayMonth(dateKey) {
  const parsed = parseMcDefectIsoDate(dateKey);
  if (parsed) {
    return `${String(Number(parsed.day)).padStart(2, "0")}/${parsed.month}`;
  }
  const s = String(dateKey || "").trim();
  return s.length > 5 ? s.slice(5).replace(/-/g, "/") : s;
}

export function formatMcDefectEmployeeAxisLabel(name) {
  const s = String(name || "");
  return s.length > 40 ? `${s.slice(0, 40)}...` : s;
}

export function estimateMcDefectEmployeeAxisWidth(names) {
  if (!names?.length) return 96;
  const maxLen = Math.max(
    ...names.map((n) => formatMcDefectEmployeeAxisLabel(n).length),
  );
  return Math.min(200, Math.max(72, Math.ceil(maxLen * 6.5) + 8));
}

export function estimateMcDefectHeatmapTableHeightPx(employeeRowCount) {
  const rows = Math.min(8, Math.max(1, employeeRowCount));
  return 28 + rows * 27;
}

export function heatColor(value) {
  if (value <= 0) return "#ffffff";
  if (value <= 1) return "#fef9c3";
  if (value <= 3) return "#fde68a";
  if (value <= 5) return "#fca5a5";
  return "#ef4444";
}

export function resetMcDefectFilters(setters) {
  const {
    setReportMonth,
    setReportDepartment,
    setReportEmployee,
    setReportErrorType,
  } = setters;
  setReportMonth(MC_DEFECT_FILTER_ALL);
  setReportDepartment(MC_DEFECT_FILTER_ALL);
  setReportEmployee(MC_DEFECT_FILTER_ALL);
  setReportErrorType(MC_DEFECT_FILTER_ALL);
}
