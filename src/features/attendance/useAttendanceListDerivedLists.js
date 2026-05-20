import { useMemo } from "react";
import { isGioVaoLeaveOrStatusType } from "./attendanceGioVaoTypeOptions";
import {
  employeeMatchesLoaiPhepFilterSet,
  isEmployeeQuickUnattended,
} from "./attendanceListShared";

/**
 * Danh sách phụ: bộ phận (lọc cascade), bù công.
 */
export function useAttendanceListDerivedLists({
  employees,
  deferredFilteredEmployees,
  deferredLoaiPhepFilterSet,
  showOnlyUnattendedFilter,
  normalizeDepartment,
}) {
  const departments = useMemo(() => {
    const deptMap = new Map();
    for (const emp of employees) {
      if (showOnlyUnattendedFilter && !isEmployeeQuickUnattended(emp)) continue;
      if (!employeeMatchesLoaiPhepFilterSet(emp, deferredLoaiPhepFilterSet))
        continue;
      const deptLabel = String(emp.boPhan || "").trim();
      const deptKey = normalizeDepartment(deptLabel);
      if (!deptKey) continue;
      if (!deptMap.has(deptKey)) {
        deptMap.set(deptKey, deptLabel);
      }
    }
    return Array.from(deptMap.values());
  }, [
    employees,
    deferredLoaiPhepFilterSet,
    showOnlyUnattendedFilter,
    normalizeDepartment,
  ]);

  const buCongEmployees = useMemo(() => {
    const timeRegex = /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
    return deferredFilteredEmployees.filter((emp) => {
      const gioVaoRaw = (emp.gioVao || "").trim();
      const gioRa = (emp.gioRa || "").trim();
      if (!gioVaoRaw || isGioVaoLeaveOrStatusType(gioVaoRaw)) return false;
      if (!timeRegex.test(gioVaoRaw)) return false;
      if (gioVaoRaw && gioRa && timeRegex.test(gioRa)) return false;
      if ((gioVaoRaw && !gioRa) || (!gioVaoRaw && gioRa)) return true;
      return false;
    });
  }, [deferredFilteredEmployees]);

  return {
    departments,
    buCongEmployees,
  };
}
