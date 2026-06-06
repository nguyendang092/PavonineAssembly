import { useCallback, useDeferredValue, useMemo } from "react";
import { ATTENDANCE_LOAI_PHEP_OPTIONS } from "./attendanceGioVaoTypeOptions";
import {
  employeeMatchesLoaiPhepFilterSet,
  isEmployeeQuickUnattended,
} from "./attendanceListShared";
import { sortEmployeesStableAsc } from "./attendanceListSort";
import { isSeasonalAttendanceRoot } from "./attendanceSeasonalStt";

/**
 * Pipeline lọc danh sách NV.
 * `deferredFilteredEmployees` — bảng / tóm tắt (search deferred để gõ mượt).
 * `filteredEmployees` — export / in (phản ánh search ngay).
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

  const selectedDeptKeys = useMemo(
    () =>
      new Set(
        departmentListFilter.map((dept) => normalizeDepartment(dept)),
      ),
    [departmentListFilter, normalizeDepartment],
  );

  const joinYear = String(joinDateYearFilter || "").trim();
  const joinMonth = joinYear ? String(joinDateMonthFilter || "").trim() : "";

  const applyAttendanceListFilters = useCallback(
    (list, queryText, opts = {}) => {
      const {
        omitQuickUnattendedFilter = false,
        omitLoaiPhepFilter = false,
        omitDepartmentFilters = false,
        omitSearch = false,
      } = opts;
      const q = String(queryText ?? "").trim().toLowerCase();

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
        return (
          (emp.hoVaTen || "").toLowerCase().includes(q) ||
          String(emp.mnv ?? "")
            .toLowerCase()
            .includes(q) ||
          String(emp.mvt ?? "")
            .toLowerCase()
            .includes(q) ||
          (emp.boPhan || "").toLowerCase().includes(q)
        );
      });
    },
    [
      selectedDeptKeys,
      loaiPhepFilterSet,
      joinYear,
      joinMonth,
      showOnlyUnattendedFilter,
      normalizeDepartment,
    ],
  );

  const filterAttendanceListRows = useCallback(
    (list, opts = {}) =>
      applyAttendanceListFilters(list, searchTerm, opts),
    [applyAttendanceListFilters, searchTerm],
  );

  const filteredEmployees = useMemo(
    () =>
      sortEmployeesStableAsc(
        applyAttendanceListFilters(employees, searchTerm),
        { seasonal },
      ),
    [employees, applyAttendanceListFilters, searchTerm, seasonal],
  );

  const deferredSearchTerm = useDeferredValue(searchTerm);

  const deferredFilteredEmployees = useMemo(
    () =>
      sortEmployeesStableAsc(
        applyAttendanceListFilters(employees, deferredSearchTerm),
        { seasonal },
      ),
    [employees, applyAttendanceListFilters, deferredSearchTerm, seasonal],
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
    loaiPhepFilterSet,
    filterAttendanceListRows,
    filteredEmployees,
    deferredFilteredEmployees,
    allLeaveTypeFilterValues,
    allLeaveTypesSelectAllChecked,
  };
}
