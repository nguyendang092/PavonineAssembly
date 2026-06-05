import { useCallback, useMemo } from "react";
import { ATTENDANCE_LOAI_PHEP_OPTIONS } from "./attendanceGioVaoTypeOptions";
import {
  employeeMatchesLoaiPhepFilterSet,
  isEmployeeQuickUnattended,
} from "./attendanceListShared";
import { sortEmployeesStableAsc } from "./attendanceListSort";
import { isSeasonalAttendanceRoot } from "./attendanceSeasonalStt";

/**
 * Pipeline lọc danh sách NV.
 */
export function useAttendanceListFilters({
  employees,
  searchTerm,
  departmentListFilter,
  loaiPhepFilter,
  joinDateYearFilter,
  joinDateMonthFilter,
  showOnlyUnattendedFilter,
  attendanceRootPath = "attendance",
}) {
  const seasonal = isSeasonalAttendanceRoot(attendanceRootPath);
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

  const filterAttendanceListRows = useCallback(
    (list, opts = {}) => {
      const {
        omitQuickUnattendedFilter = false,
        omitLoaiPhepFilter = false,
        omitDepartmentFilters = false,
        omitSearch = false,
      } = opts;
      const q = searchTerm.trim().toLowerCase();
      const selectedDeptKeys = new Set(
        departmentListFilter.map((dept) => normalizeDepartment(dept)),
      );

      const joinYear = String(joinDateYearFilter || "").trim();
      const joinMonth = joinYear
        ? String(joinDateMonthFilter || "").trim()
        : "";
      return list.filter((emp) => {
        const empDeptKey = normalizeDepartment(emp.boPhan);

        const joinRaw = String(emp.ngayVaoLam || "").trim();
        const joinYearOfEmp = joinRaw.length >= 4 ? joinRaw.slice(0, 4) : "";
        const joinMonthOfEmp =
          joinRaw.length >= 7 ? joinRaw.slice(5, 7) : "";

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
          loaiPhepFilterSet.size > 0 &&
          !employeeMatchesLoaiPhepFilterSet(emp, loaiPhepFilterSet)
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
      searchTerm,
      departmentListFilter,
      loaiPhepFilterSet,
      joinDateYearFilter,
      joinDateMonthFilter,
      showOnlyUnattendedFilter,
      normalizeDepartment,
    ],
  );

  const filteredEmployees = useMemo(
    () =>
      sortEmployeesStableAsc(filterAttendanceListRows(employees), { seasonal }),
    [employees, filterAttendanceListRows, seasonal],
  );

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
    /** @deprecated alias — dùng `loaiPhepFilterSet` */
    deferredLoaiPhepFilterSet: loaiPhepFilterSet,
    loaiPhepFilterSet,
    filterAttendanceListRows,
    filteredEmployees,
    /** @deprecated alias — dùng `filteredEmployees` */
    deferredFilteredEmployees: filteredEmployees,
    allLeaveTypeFilterValues,
    allLeaveTypesSelectAllChecked,
  };
}
