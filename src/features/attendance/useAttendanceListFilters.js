import { useCallback, useDeferredValue, useMemo } from "react";
import { ATTENDANCE_LOAI_PHEP_OPTIONS } from "./attendanceGioVaoTypeOptions";
import {
  employeeMatchesLoaiPhepFilterSet,
  isEmployeeQuickUnattended,
} from "./attendanceListShared";
import { sortEmployeesStableAsc } from "./attendanceListSort";

/**
 * Pipeline lọc danh sách NV — deferred loại phép giảm đơ khi tick nhiều checkbox.
 */
export function useAttendanceListFilters({
  employees,
  searchTerm,
  departmentFilter,
  departmentListFilter,
  loaiPhepFilter,
  showOnlyUnattendedFilter,
}) {
  const normalizeDepartment = useCallback((value) => {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  }, []);

  const loaiPhepFilterSet = useMemo(
    () => new Set(loaiPhepFilter),
    [loaiPhepFilter],
  );

  const deferredSearchTerm = useDeferredValue(searchTerm);
  const deferredLoaiPhepFilter = useDeferredValue(loaiPhepFilter);
  const deferredLoaiPhepFilterSet = useMemo(
    () => new Set(deferredLoaiPhepFilter),
    [deferredLoaiPhepFilter],
  );

  const filterAttendanceListRows = useCallback(
    (list, opts = {}) => {
      const {
        omitQuickUnattendedFilter = false,
        omitLoaiPhepFilter = false,
        omitDepartmentFilters = false,
        omitSearch = false,
      } = opts;
      const q = deferredSearchTerm.trim().toLowerCase();
      const selectedDeptKeys = new Set(
        departmentListFilter.map((dept) => normalizeDepartment(dept)),
      );
      return list.filter((emp) => {
        const empDeptKey = normalizeDepartment(emp.boPhan);
        const departmentFilterKey = normalizeDepartment(departmentFilter);

        if (
          !omitDepartmentFilters &&
          departmentFilterKey &&
          empDeptKey !== departmentFilterKey
        )
          return false;
        if (
          !omitDepartmentFilters &&
          selectedDeptKeys.size > 0 &&
          !selectedDeptKeys.has(empDeptKey)
        )
          return false;
        if (
          !omitQuickUnattendedFilter &&
          showOnlyUnattendedFilter &&
          !isEmployeeQuickUnattended(emp)
        )
          return false;
        if (
          !omitLoaiPhepFilter &&
          deferredLoaiPhepFilterSet.size > 0 &&
          !employeeMatchesLoaiPhepFilterSet(emp, deferredLoaiPhepFilterSet)
        )
          return false;
        if (omitSearch || !q) return true;
        const qn = q;
        return (
          (emp.hoVaTen || "").toLowerCase().includes(qn) ||
          String(emp.mnv ?? "")
            .toLowerCase()
            .includes(qn) ||
          String(emp.mvt ?? "")
            .toLowerCase()
            .includes(qn) ||
          (emp.boPhan || "").toLowerCase().includes(qn)
        );
      });
    },
    [
      deferredSearchTerm,
      departmentFilter,
      departmentListFilter,
      deferredLoaiPhepFilterSet,
      showOnlyUnattendedFilter,
      normalizeDepartment,
    ],
  );

  const filteredEmployees = useMemo(
    () => sortEmployeesStableAsc(filterAttendanceListRows(employees)),
    [employees, filterAttendanceListRows],
  );

  const deferredFilteredEmployees = useDeferredValue(filteredEmployees);

  const allLeaveTypeFilterValues = useMemo(
    () => ATTENDANCE_LOAI_PHEP_OPTIONS.map((o) => o.value),
    [],
  );

  const allLeaveTypesSelectAllChecked = useMemo(
    () =>
      allLeaveTypeFilterValues.length > 0 &&
      allLeaveTypeFilterValues.every((v) => loaiPhepFilterSet.has(v)),
    [allLeaveTypeFilterValues, loaiPhepFilterSet],
  );

  return {
    normalizeDepartment,
    deferredLoaiPhepFilterSet,
    filterAttendanceListRows,
    filteredEmployees,
    deferredFilteredEmployees,
    allLeaveTypeFilterValues,
    allLeaveTypesSelectAllChecked,
  };
}
