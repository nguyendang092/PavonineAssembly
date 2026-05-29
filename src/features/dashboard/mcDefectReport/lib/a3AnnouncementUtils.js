import { normalizeText } from "./dataAggregations";
import { normalizeA3ManualEmployeeEntry } from "./a3ManualEmployeesFirebase";

export const a3EmployeeKey = (name) => normalizeText(name).toLowerCase();

/** Dropdown: nhân viên từ dữ liệu lỗi + nhân viên đã thêm thủ công (Firebase A3). */
export function buildA3EmployeePickerOptions(employeePickerOptions, manualEmployees) {
  const byKey = new Map();
  (employeePickerOptions || []).forEach((name) => {
    const employee = normalizeText(name);
    if (employee) byKey.set(a3EmployeeKey(employee), employee);
  });
  (manualEmployees || []).forEach((entry) => {
    const { employee } = normalizeA3ManualEmployeeEntry(entry);
    if (employee) byKey.set(a3EmployeeKey(employee), employee);
  });
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}

export function buildA3ErrorCountLookup(employeeRows, manualEmployees) {
  const map = new Map();
  (employeeRows || []).forEach((row) => {
    const employee = normalizeText(row.employee);
    if (employee) {
      map.set(a3EmployeeKey(employee), Math.max(0, Number(row.errorCount || 0)));
    }
  });
  (manualEmployees || []).forEach((entry) => {
    const { employee, errorCount } = normalizeA3ManualEmployeeEntry(entry);
    if (employee) map.set(a3EmployeeKey(employee), errorCount);
  });
  return map;
}

export function mergeAnnouncementEmployeeRows(employeeRows, manualEmployees) {
  const rowMap = new Map();
  employeeRows.forEach((row) => {
    const employee = normalizeText(row.employee);
    if (!employee) return;
    rowMap.set(a3EmployeeKey(employee), {
      employee,
      errorCount: Number(row.errorCount || 0),
    });
  });
  manualEmployees.forEach((entry) => {
    const { employee, errorCount } = normalizeA3ManualEmployeeEntry(entry);
    if (employee) {
      rowMap.set(a3EmployeeKey(employee), { employee, errorCount });
    }
  });
  return [...rowMap.values()].sort(
    (a, b) =>
      Number(b.errorCount || 0) - Number(a.errorCount || 0) ||
      a.employee.localeCompare(b.employee),
  );
}

export function sumA3ErrorCounts(entries) {
  return (entries || []).reduce(
    (sum, entry) =>
      sum +
      Math.max(0, Number(normalizeA3ManualEmployeeEntry(entry).errorCount || 0)),
    0,
  );
}

export function upsertA3ManualEmployeeEntries(prevEmployees, additions) {
  const employeeMap = new Map();
  prevEmployees.forEach((entry) => {
    const normalized = normalizeA3ManualEmployeeEntry(entry);
    if (normalized.employee) {
      employeeMap.set(a3EmployeeKey(normalized.employee), normalized);
    }
  });
  additions.forEach((entry) => {
    const normalized = normalizeA3ManualEmployeeEntry(entry);
    if (normalized.employee) {
      employeeMap.set(a3EmployeeKey(normalized.employee), normalized);
    }
  });
  return [...employeeMap.values()].sort((a, b) =>
    a.employee.localeCompare(b.employee),
  );
}

export function removeA3ManualEmployeeEntry(prevEmployees, employeeName) {
  const targetKey = a3EmployeeKey(employeeName);
  return prevEmployees.filter(
    (entry) =>
      a3EmployeeKey(normalizeA3ManualEmployeeEntry(entry).employee) !==
      targetKey,
  );
}

export function updateA3ManualEmployeeErrorCount(
  prevEmployees,
  employeeName,
  nextValue,
) {
  const targetKey = a3EmployeeKey(employeeName);
  const nextErrorCount = Math.max(0, Number(nextValue || 0));
  return prevEmployees.map((entry) => {
    const normalized = normalizeA3ManualEmployeeEntry(entry);
    if (a3EmployeeKey(normalized.employee) !== targetKey) {
      return normalized;
    }
    return { ...normalized, errorCount: nextErrorCount };
  });
}
