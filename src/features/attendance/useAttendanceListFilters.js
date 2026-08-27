import { useCallback, useMemo } from "react";
import { ATTENDANCE_LOAI_PHEP_OPTIONS } from "./attendanceGioVaoTypeOptions";
import {
  employeeMatchesLoaiPhepFilterSet,
  isEmployeeQuickUnattended,
} from "./attendanceListShared";
import { sortEmployeesByDepartmentAsc, sortEmployeesStableAsc } from "./attendanceListSort";
import { isSeasonalAttendanceRoot } from "./attendanceSeasonalStt";

function normalizeDepartmentListFilter(departmentListFilter) {
  if (Array.isArray(departmentListFilter)) return departmentListFilter;
  const single = String(departmentListFilter ?? "").trim();
  return single ? [single] : [];
}

function buildSelectedDeptKeys(departmentListFilter, normalizeDepartment) {
  return new Set(
    normalizeDepartmentListFilter(departmentListFilter).map((dept) =>
      normalizeDepartment(dept),
    ),
  );
}

function buildLoaiPhepFilterSet(loaiPhepFilter) {
  return new Set(loaiPhepFilter);
}

function hasAdvancedListFilters({
  departmentListFilter,
  loaiPhepFilter,
  joinDateYearFilter,
  joinDateMonthFilter,
}) {
  return (
    normalizeDepartmentListFilter(departmentListFilter).length > 0 ||
    loaiPhepFilter.length > 0 ||
    Boolean(String(joinDateYearFilter || "").trim()) ||
    Boolean(String(joinDateMonthFilter || "").trim())
  );
}

function applyAttendanceListFiltersCore(
  list,
  {
    searchQuery,
    departmentListFilter,
    loaiPhepFilter,
    joinDateYearFilter,
    joinDateMonthFilter,
    showOnlyUnattendedFilter,
    normalizeDepartment,
  },
  opts = {},
) {
  const {
    omitQuickUnattendedFilter = false,
    omitLoaiPhepFilter = false,
    omitDepartmentFilters = false,
    omitSearch = false,
  } = opts;

  const q = String(searchQuery ?? "").trim().toLowerCase();
  const selectedDeptKeys = buildSelectedDeptKeys(
    departmentListFilter,
    normalizeDepartment,
  );
  const loaiPhepFilterSet = buildLoaiPhepFilterSet(loaiPhepFilter);
  const joinYear = String(joinDateYearFilter || "").trim();
  const joinMonth = joinYear ? String(joinDateMonthFilter || "").trim() : "";

  return list.filter((emp) => {
    const empDeptKey = normalizeDepartment(emp.boPhan);

    const joinRaw = String(emp.ngayVaoLam || "").trim();
    const joinYearOfEmp = joinRaw.length >= 4 ? joinRaw.slice(0, 4) : "";
    const joinMonthOfEmp = joinRaw.length >= 7 ? joinRaw.slice(5, 7) : "";

    if (
      !omitDepartmentFilters &&
      selectedDeptKeys.size > 0 &&
      !selectedDeptKeys.has(empDeptKey)
    ) {
      return false;
    }
    if (
      !omitQuickUnattendedFilter &&
      showOnlyUnattendedFilter &&
      !isEmployeeQuickUnattended(emp)
    ) {
      return false;
    }
    if (
      !omitLoaiPhepFilter &&
      loaiPhepFilterSet.size > 0 &&
      !employeeMatchesLoaiPhepFilterSet(emp, loaiPhepFilterSet)
    ) {
      return false;
    }

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
}

/**
 * Pipeline lọc danh sách NV.
 * `searchTerm` nên là giá trị debounce từ parent (ô tìm gõ mượt, lọc sau ~220ms).
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
    () => buildLoaiPhepFilterSet(loaiPhepFilter),
    [loaiPhepFilter],
  );

  const applyAttendanceListFilters = useCallback(
    (list, queryText, filterOverrides = {}, opts = {}) =>
      applyAttendanceListFiltersCore(
        list,
        {
          searchQuery: queryText,
          departmentListFilter,
          loaiPhepFilter,
          joinDateYearFilter,
          joinDateMonthFilter,
          showOnlyUnattendedFilter,
          normalizeDepartment,
          ...filterOverrides,
        },
        opts,
      ),
    [
      departmentListFilter,
      loaiPhepFilter,
      joinDateYearFilter,
      joinDateMonthFilter,
      showOnlyUnattendedFilter,
      normalizeDepartment,
    ],
  );

  const filterAttendanceListRows = useCallback(
    (list, opts = {}) => applyAttendanceListFilters(list, searchTerm, {}, opts),
    [applyAttendanceListFilters, searchTerm],
  );

  const filteredEmployees = useMemo(
    () => {
      const filtered = applyAttendanceListFiltersCore(employees, {
        searchQuery: searchTerm,
        departmentListFilter,
        loaiPhepFilter,
        joinDateYearFilter,
        joinDateMonthFilter,
        showOnlyUnattendedFilter,
        normalizeDepartment,
      });
      const advancedActive = hasAdvancedListFilters({
        departmentListFilter,
        loaiPhepFilter,
        joinDateYearFilter,
        joinDateMonthFilter,
      });
      return advancedActive
        ? sortEmployeesByDepartmentAsc(filtered, { seasonal })
        : sortEmployeesStableAsc(filtered, { seasonal });
    },
    [
      employees,
      searchTerm,
      departmentListFilter,
      loaiPhepFilter,
      joinDateYearFilter,
      joinDateMonthFilter,
      showOnlyUnattendedFilter,
      normalizeDepartment,
      seasonal,
    ],
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
    deferredFilteredEmployees: filteredEmployees,
    allLeaveTypeFilterValues,
    allLeaveTypesSelectAllChecked,
  };
}
