import {
  attendanceProductionDeptMatchKey,
  COMBO_STATS_PRODUCTION_DEPT_DEFAULT_ORDER,
  COMBO_STATS_PRODUCTION_DEPT_PICKER_LABELS,
  mergeComboProductionDeptPickerKeys,
} from "./attendanceComboChartConfig";

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

export function buildProductionDeptEmployeeMap(rows, normalizeDepartment) {
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
    const mnv = String(emp?.mnv || "").trim();
    const mvt = String(emp?.mvt || "").trim();
    const name = String(emp?.hoVaTen || "").trim() || "Không tên";
    const key = mnv || mvt || name;
    const label = mnv ? `${name} (${mnv})` : name;
    if (!out.has(dept)) out.set(dept, new Map());
    out.get(dept).set(key, label);
  }
  return out;
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

    for (const [k, label] of prevEmpMap.entries()) {
      if (currEmpMap.has(k)) sameCount += 1;
      else previousOnly.push(label);
    }
    for (const [k, label] of currEmpMap.entries()) {
      if (!prevEmpMap.has(k)) currentOnly.push(label);
    }

    previousOnly.sort((a, b) => a.localeCompare(b, "vi"));
    currentOnly.sort((a, b) => a.localeCompare(b, "vi"));

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
