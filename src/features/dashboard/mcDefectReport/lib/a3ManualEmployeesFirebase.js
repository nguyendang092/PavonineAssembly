import { MC_DEFECT_A3_MANUAL_PATH, MC_DEFECT_FILTER_ALL } from "./constants";
import { makeFirebaseSafeKey, normalizeText } from "./dataAggregations";

export function normalizeA3ManualEmployeeEntry(entry) {
  if (typeof entry === "string") {
    return {
      employee: normalizeText(entry),
      errorCount: 0,
    };
  }
  return {
    employee: normalizeText(entry?.employee),
    errorCount: Math.max(0, Number(entry?.errorCount || 0)),
  };
}

export function buildMcDefectA3ManualEmployeesPath(reportMonth, reportDepartment) {
  const monthKey = makeFirebaseSafeKey(reportMonth) || "unknown-month";
  const deptKey =
    !reportDepartment || reportDepartment === MC_DEFECT_FILTER_ALL
      ? "all-departments"
      : makeFirebaseSafeKey(reportDepartment);
  return `${MC_DEFECT_A3_MANUAL_PATH}/${monthKey}/${deptKey}`;
}

export function parseMcDefectA3ManualEmployeesSnapshot(raw) {
  if (!raw || typeof raw !== "object") return [];
  const byEmployeeKey = new Map();
  Object.values(raw).forEach((value) => {
    const normalized = normalizeA3ManualEmployeeEntry(value);
    if (!normalized.employee) return;
    const dedupeKey = normalized.employee.toLowerCase();
    const existing = byEmployeeKey.get(dedupeKey);
    if (
      !existing ||
      Number(value?.updatedAt || 0) >= Number(existing.updatedAt || 0)
    ) {
      byEmployeeKey.set(dedupeKey, {
        ...normalized,
        updatedAt: Number(value?.updatedAt || 0),
      });
    }
  });
  return [...byEmployeeKey.values()]
    .map(({ employee, errorCount }) => ({ employee, errorCount }))
    .sort((a, b) => a.employee.localeCompare(b.employee));
}

export function serializeMcDefectA3ManualEmployees(entries) {
  const payload = {};
  const seen = new Set();
  (entries || []).forEach((entry) => {
    const normalized = normalizeA3ManualEmployeeEntry(entry);
    if (!normalized.employee) return;
    const dedupeKey = normalized.employee.toLowerCase();
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    const recordKey = makeFirebaseSafeKey(normalized.employee);
    payload[recordKey] = {
      employee: normalized.employee,
      errorCount: normalized.errorCount,
      updatedAt: Date.now(),
    };
  });
  return payload;
}
