import { getDateKeyBySubtractDays } from "@/utils/dateKey";
import {
  attendanceProductionDeptMatchKey,
  COMBO_STATS_PRODUCTION_DEPT_DEFAULT_ORDER,
  COMBO_STATS_PRODUCTION_DEPT_PICKER_LABELS,
  mergeComboProductionDeptPickerKeys,
  resolveComboChartDepartmentLabel,
} from "./attendanceComboChartConfig";
import { sortEmployeesStableAsc } from "./attendanceListSort";
import { resolveAttendanceDisplayStt } from "./attendanceSeasonalStt";

const ALLOWED_PRODUCTION_MATCH_KEYS = new Set(
  COMBO_STATS_PRODUCTION_DEPT_DEFAULT_ORDER,
);

export function previousDateOf(dateKey) {
  const key = String(dateKey || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return "";
  return getDateKeyBySubtractDays(key, 1);
}

export function resolveOrderedProductionMatchKeys(
  comboProductionDeptOrder,
  comboProductionDeptCatalog,
) {
  const ordered =
    comboProductionDeptOrder.length > 0
      ? comboProductionDeptOrder
      : mergeComboProductionDeptPickerKeys(comboProductionDeptCatalog);
  return ordered.filter((mk) => ALLOWED_PRODUCTION_MATCH_KEYS.has(mk));
}

function compareEmployeeIdentity(emp) {
  const mnv = String(emp?.mnv || "").trim();
  const mvt = String(emp?.mvt || "").trim();
  const name = String(emp?.hoVaTen || "").trim() || "Không tên";
  const key = mnv || mvt || name;
  const label = mnv ? `${name} (${mnv})` : name;
  return { key, label };
}

/** Thứ tự STT theo ngày — cùng sort với bảng điểm danh (`sortEmployeesStableAsc`). */
export function buildCompareSttRankMap(
  rows,
  seasonal = false,
  { alreadySorted = false } = {},
) {
  const sorted = alreadySorted
    ? rows || []
    : sortEmployeesStableAsc(rows || [], { seasonal });
  const map = new Map();
  sorted.forEach((emp, idx) => {
    const { key } = compareEmployeeIdentity(emp);
    if (!key || map.has(key)) return;
    map.set(key, resolveAttendanceDisplayStt(emp, idx + 1, seasonal));
  });
  return map;
}

/** @typedef {{ stt: number | string | null, label: string }} CompareEmployeeListEntry */

function appendEmployeeToDeptBucket(
  bucketMap,
  deptLabel,
  emp,
  sttRankByKey,
  seasonal = false,
) {
  const { key, label } = compareEmployeeIdentity(emp);
  const stt = sttRankByKey?.has(key)
    ? sttRankByKey.get(key)
    : resolveAttendanceDisplayStt(emp, null, seasonal);
  if (!bucketMap.has(deptLabel)) bucketMap.set(deptLabel, new Map());
  bucketMap.get(deptLabel).set(key, { stt, label });
}

function sortCompareEmployeeEntries(entries) {
  entries.sort((a, b) => {
    const labelA = typeof a === "string" ? a : a?.label || "";
    const labelB = typeof b === "string" ? b : b?.label || "";
    const sttA = typeof a === "string" ? null : a?.stt;
    const sttB = typeof b === "string" ? null : b?.stt;
    const numA = typeof sttA === "number" ? sttA : Number(sttA);
    const numB = typeof sttB === "number" ? sttB : Number(sttB);
    const aValid = Number.isFinite(numA);
    const bValid = Number.isFinite(numB);
    if (aValid && bValid && numA !== numB) return numA - numB;
    if (aValid && !bValid) return -1;
    if (!aValid && bValid) return 1;
    return labelA.localeCompare(labelB, "vi", { sensitivity: "base" });
  });
  return entries;
}

/**
 * Điểm danh chính thức: chỉ BP sản xuất đã cấu hình (không gộp HR / BP ngoài SX).
 */
export function buildOfficialCompareDeptEmployeeMap(
  rows,
  normalizeDepartment,
  sttRankByKey,
  seasonal = false,
) {
  const out = new Map();
  for (const emp of rows || []) {
    const matchKey = attendanceProductionDeptMatchKey(
      normalizeDepartment,
      emp?.boPhan,
    );
    if (!matchKey || !ALLOWED_PRODUCTION_MATCH_KEYS.has(matchKey)) continue;
    const dept =
      COMBO_STATS_PRODUCTION_DEPT_PICKER_LABELS[matchKey] ||
      String(emp?.boPhan || "").trim() ||
      "—";
    appendEmployeeToDeptBucket(out, dept, emp, sttRankByKey, seasonal);
  }
  return out;
}

/**
 * Thời vụ: gộp NV theo nhãn bộ phận — cùng `resolveComboChartDepartmentLabel` với biểu đồ.
 */
export function buildCompareChartAlignedDeptEmployeeMap(
  rows,
  normalizeDepartment,
  sttRankByKey,
  seasonal = false,
  unknownDepartmentLabel = "Chưa phân bộ phận",
) {
  const out = new Map();
  for (const emp of rows || []) {
    const dept = resolveComboChartDepartmentLabel(
      normalizeDepartment,
      emp?.boPhan,
      unknownDepartmentLabel,
    );
    appendEmployeeToDeptBucket(out, dept, emp, sttRankByKey, seasonal);
  }
  return out;
}

/**
 * Chính thức: thứ tự BP theo cấu hình picker (kể cả BP chưa có NV trong ngày so sánh).
 */
export function mergeCompareDepartmentListOfficial(
  orderedProductionMatchKeys,
  prevByDept,
  currByDept,
) {
  const productionDeptLabels = orderedProductionMatchKeys.map(
    (matchKey) =>
      COMBO_STATS_PRODUCTION_DEPT_PICKER_LABELS[matchKey] || matchKey,
  );
  return Array.from(
    new Set([
      ...productionDeptLabels,
      ...prevByDept.keys(),
      ...currByDept.keys(),
    ]),
  );
}

/**
 * Thời vụ: thứ tự bộ phận — khớp `applyProductionStatsRowOrder` trên biểu đồ combo.
 */
export function mergeCompareDepartmentListChartAligned(
  orderedProductionMatchKeys,
  prevByDept,
  currByDept,
  normalizeDepartment,
) {
  const allDepts = Array.from(
    new Set([...prevByDept.keys(), ...currByDept.keys()]),
  );
  if (!orderedProductionMatchKeys?.length) {
    return [...allDepts].sort((a, b) =>
      a.localeCompare(b, "vi", { sensitivity: "base" }),
    );
  }
  const seen = new Set();
  const out = [];
  for (const mk of orderedProductionMatchKeys) {
    const preferredLabel =
      COMBO_STATS_PRODUCTION_DEPT_PICKER_LABELS[mk] || mk;
    for (const dept of allDepts) {
      if (seen.has(dept)) continue;
      const deptMk = attendanceProductionDeptMatchKey(
        normalizeDepartment,
        dept,
      );
      if (deptMk === mk || dept === preferredLabel) {
        out.push(dept);
        seen.add(dept);
      }
    }
  }
  const rest = allDepts.filter((d) => !seen.has(d));
  rest.sort((a, b) => a.localeCompare(b, "vi", { sensitivity: "base" }));
  return [...out, ...rest];
}

export function computeCompareRows(allDepts, prevByDept, currByDept) {
  return allDepts.map((department) => {
    const prevEmpMap = prevByDept.get(department) || new Map();
    const currEmpMap = currByDept.get(department) || new Map();
    const previousOnly = [];
    const currentOnly = [];
    let sameCount = 0;

    for (const [k, entry] of prevEmpMap.entries()) {
      if (currEmpMap.has(k)) sameCount += 1;
      else previousOnly.push(entry);
    }
    for (const [k, entry] of currEmpMap.entries()) {
      if (!prevEmpMap.has(k)) currentOnly.push(entry);
    }

    sortCompareEmployeeEntries(previousOnly);
    sortCompareEmployeeEntries(currentOnly);

    const previousCount = prevEmpMap.size;
    const currentCount = currEmpMap.size;
    return {
      department,
      previousCount,
      currentCount,
      delta: currentCount - previousCount,
      sameCount,
      previousOnly,
      currentOnly,
      hasDiff: previousOnly.length > 0 || currentOnly.length > 0,
    };
  });
}

export function sumCompareRowsTotals(rows) {
  const totals = {
    previous: 0,
    current: 0,
    same: 0,
    previousOnly: 0,
    currentOnly: 0,
  };
  for (const row of rows || []) {
    totals.previous += Number(row.previousCount) || 0;
    totals.current += Number(row.currentCount) || 0;
    totals.same += Number(row.sameCount) || 0;
    totals.previousOnly += row.previousOnly?.length || 0;
    totals.currentOnly += row.currentOnly?.length || 0;
  }
  return totals;
}

function filterCompareRowsByDepartment(rows, departmentFilter) {
  if (!departmentFilter) return rows;
  return rows.filter((x) => x.department === departmentFilter);
}

export function buildCompareEmployeesResult({
  previousDate,
  currentDate,
  allRows,
  departments,
  departmentFilter,
}) {
  return {
    previousDate,
    currentDate,
    allRows,
    rows: filterCompareRowsByDepartment(allRows, departmentFilter),
    departments,
  };
}
