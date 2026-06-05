import {
  attendanceProductionDeptMatchKey,
  COMBO_STATS_PRODUCTION_DEPT_DEFAULT_ORDER,
  COMBO_STATS_PRODUCTION_DEPT_PICKER_LABELS,
  mergeComboProductionDeptPickerKeys,
} from "./attendanceComboChartConfig";
import { sortEmployeesStableAsc } from "./attendanceListSort";
import { resolveAttendanceDisplayStt } from "./attendanceSeasonalStt";

const ALLOWED_PRODUCTION_MATCH_KEYS = new Set(
  COMBO_STATS_PRODUCTION_DEPT_DEFAULT_ORDER,
);

export function previousDateOf(dateKey) {
  const d = new Date(`${String(dateKey || "").trim()}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
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
export function buildCompareSttRankMap(rows, seasonal = false) {
  const sorted = sortEmployeesStableAsc(rows || [], { seasonal });
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

export function sortCompareEmployeeEntries(entries) {
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

export function buildProductionDeptEmployeeMap(
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
 * Điểm danh thời vụ: gộp theo `boPhan` thực tế trên Firebase — không map sang nhãn BP sản xuất.
 */
export function buildSeasonalDeptEmployeeMap(
  rows,
  normalizeDepartment,
  sttRankByKey,
  seasonal = true,
) {
  const labelByKey = new Map();
  const out = new Map();

  for (const emp of rows || []) {
    const boPhanRaw = String(emp?.boPhan ?? "").trim();
    const deptKey = normalizeDepartment(boPhanRaw);
    if (!deptKey) continue;

    if (!labelByKey.has(deptKey)) {
      labelByKey.set(deptKey, boPhanRaw || "—");
    } else if (boPhanRaw && labelByKey.get(deptKey) === "—") {
      labelByKey.set(deptKey, boPhanRaw);
    }

    appendEmployeeToDeptBucket(
      out,
      labelByKey.get(deptKey),
      emp,
      sttRankByKey,
      seasonal,
    );
  }
  return out;
}

export function mergeCompareDepartmentListSeasonal(prevByDept, currByDept) {
  return Array.from(
    new Set([...prevByDept.keys(), ...currByDept.keys()]),
  ).sort((a, b) => a.localeCompare(b, "vi", { sensitivity: "base" }));
}

export function mergeCompareDepartmentList(
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

    return {
      department,
      previousCount: prevEmpMap.size,
      currentCount: currEmpMap.size,
      sameCount,
      previousOnly,
      currentOnly,
    };
  });
}

export function filterCompareRowsByDepartment(rows, departmentFilter) {
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
