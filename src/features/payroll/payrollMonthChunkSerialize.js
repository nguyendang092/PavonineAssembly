import {
  buildPayrollMonthByMonthEmployeeKeyMap,
  buildPayrollMonthChunkRowLookup,
} from "@/features/payroll/payrollMonthlyGridData";

export function serializePayrollMonthChunkForWorker(chunk) {
  if (!chunk) return null;
  const employeesById = {};
  for (const emp of chunk.employees ?? []) {
    if (emp?.id == null) continue;
    employeesById[String(emp.id)] = emp;
  }
  return {
    dateKey: chunk.dateKey,
    isOffDay: chunk.isOffDay,
    isHolidayDay: chunk.isHolidayDay,
    isCompensatoryDay: chunk.isCompensatoryDay,
    employeesById,
  };
}

export function buildChunkByDateFromSerialized(serializedChunks) {
  const map = new Map();
  for (const raw of serializedChunks ?? []) {
    if (!raw?.dateKey) continue;
    const employees = Object.values(raw.employeesById ?? {});
    const byId = new Map();
    for (const emp of employees) {
      if (emp?.id != null) byId.set(String(emp.id), emp);
    }
    map.set(raw.dateKey, {
      ...raw,
      employees,
      byId,
      byMonthEmployeeKey: buildPayrollMonthByMonthEmployeeKeyMap(employees),
      rowLookup: buildPayrollMonthChunkRowLookup(employees),
    });
  }
  return map;
}
