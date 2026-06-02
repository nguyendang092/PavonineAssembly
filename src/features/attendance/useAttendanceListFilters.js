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
  joinDateYearFilter,
  joinDateMonthFilter,
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

  const deferredJoinDateYearFilter = useDeferredValue(joinDateYearFilter);
  const deferredJoinDateMonthFilter = useDeferredValue(joinDateMonthFilter);

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

      const joinYear = String(deferredJoinDateYearFilter || "").trim();
      // Chỉ áp dụng tháng khi đã chọn năm.
      const joinMonth = joinYear
        ? String(deferredJoinDateMonthFilter || "").trim()
        : "";
      return list.filter((emp) => {
        const empDeptKey = normalizeDepartment(emp.boPhan);
        const departmentFilterKey = normalizeDepartment(departmentFilter);

        const joinRaw = String(emp.ngayVaoLam || "").trim();
        const joinYearOfEmp = joinRaw.length >= 4 ? joinRaw.slice(0, 4) : "";
        const joinMonthOfEmp =
          joinRaw.length >= 7 ? joinRaw.slice(5, 7) : "";

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

        if (joinYear && joinYearOfEmp !== joinYear) return false;
        if (joinMonth && joinMonthOfEmp !== joinMonth) return false;
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
      deferredJoinDateYearFilter,
      deferredJoinDateMonthFilter,
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
