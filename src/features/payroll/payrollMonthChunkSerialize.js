export function serializePayrollMonthChunkForWorker(chunk) {
  if (!chunk) return null;
  const employeesById = {};
  for (const emp of chunk.employees ?? []) {
    const rowKey = emp.monthEmployeeKey || emp.id;
    if (rowKey != null) employeesById[rowKey] = emp;
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
    const byMonthEmployeeKey = new Map(
      Object.entries(raw.employeesById ?? {}),
    );
    const byId = new Map();
    for (const emp of Object.values(raw.employeesById ?? {})) {
      if (emp?.id != null) byId.set(emp.id, emp);
    }
    map.set(raw.dateKey, {
      ...raw,
      employees: Object.values(raw.employeesById ?? {}),
      byId,
      byMonthEmployeeKey,
    });
  }
  return map;
}
