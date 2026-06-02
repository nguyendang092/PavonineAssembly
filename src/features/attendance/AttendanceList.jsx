import React, {
  memo,
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  startTransition,
} from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useSearchParams } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { db, get, ref } from "@/services/firebase";
import AlertMessage from "@/components/ui/AlertMessage";
import AttendanceExportRangeModal from "./AttendanceExportRangeModal";
import AttendanceCompareEmployeesModal from "./AttendanceCompareEmployeesModal";
import { useAttendanceDayFirebase } from "./useAttendanceDayFirebase";
import { useAttendanceListFilters } from "./useAttendanceListFilters";
import {
  useAttendanceFilterDropdownPlacement,
  useAttendanceActionDropdownPlacement,
  useAttendancePrintDropdownPlacement,
  useAttendanceOffHolidayDropdownPlacement,
} from "./useAttendanceToolbarDropdownPlacement";
import { useAttendanceListMutations } from "./useAttendanceListMutations";
import AttendanceListHeader from "./AttendanceListHeader";
import AttendanceUnattendedModal from "./AttendanceUnattendedModal";
import AttendanceListToolbarSection from "./AttendanceListToolbarSection";
import AttendanceListContentSection from "./AttendanceListContentSection";
import {
  useAttendanceListUiState,
  useAttendanceUnattendedPopupEffects,
} from "./useAttendanceListUiState";
import { useAttendanceComboChart } from "./useAttendanceComboChart";
import { useAttendanceListToolbarEffects } from "./useAttendanceListToolbarEffects";
import { useAttendanceChartOrderHydration } from "./useAttendanceChartOrderHydration";
import { useAttendanceMonthOffDays } from "./useAttendanceMonthOffDays";
import { useAttendanceListDerivedLists } from "./useAttendanceListDerivedLists";
import { useAttendanceListHandlers } from "./useAttendanceListHandlers";
import { useAttendanceListSetup } from "./useAttendanceListSetup";
import { useAttendanceListI18n } from "./useAttendanceListI18n";
import { reconcileAttendanceDayRowsFromRaw } from "./mergeAttendanceDayRows";
import {
  attendanceProductionDeptMatchKey,
  COMBO_STATS_PRODUCTION_DEPT_DEFAULT_ORDER,
  COMBO_STATS_PRODUCTION_DEPT_PICKER_LABELS,
  mergeComboProductionDeptPickerKeys,
} from "./attendanceComboChartConfig";
import {
  AttendanceListToolbarBranchContext,
  AttendanceListContentBranchContext,
  AttendanceListSearchBranchContext,
} from "./attendanceListBranchContexts";


const AttendanceList = memo(function AttendanceList({
  attendanceRootPath = "attendance",
  headerTitle,
  headerSubtitle,
  counterpartLinkTo = "/seasonal-staff-attendance",
  counterpartLinkLabelKey = "seasonalActiveEmployeesTitleShort",
  counterpartLinkLabelDefault = "Điểm danh nhân viên thời vụ",
  forceVirtualizedRows = false,
}) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const [alert, setAlert] = useState({ show: false, type: "", message: "" });
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [employeeModalRecord, setEmployeeModalRecord] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [offDaysModalOpen, setOffDaysModalOpen] = useState(false);
  const [compareEmployeesOpen, setCompareEmployeesOpen] = useState(false);
  const [compareEmployeesBusy, setCompareEmployeesBusy] = useState(false);
  const [compareEmployeesResult, setCompareEmployeesResult] = useState(null);
  const compareDayRowsCacheRef = useRef(new Map());
  const [compareCriteria, setCompareCriteria] = useState({
    compareDate: todayKey,
    previousDate: "",
    department: "",
  });

  const { t, i18n } = useTranslation();
  const { user, userDepartments, userRole } = useUser();
  const ui = useAttendanceListUiState(user);
  const {
    filterDepartmentSearch,
    setFilterDepartmentSearch,
    departmentListFilter,
    setDepartmentListFilter,
    loaiPhepFilter,
    setLoaiPhepFilter,
    joinDateYearFilter,
    setJoinDateYearFilter,
    joinDateMonthFilter,
    setJoinDateMonthFilter,
    showOnlyUnattendedFilter,
    setShowOnlyUnattendedFilter,
    expandedSections,
    setExpandedSections,
    showComboChartModal,
    setShowComboChartModal,
    comboDashboardGroup,
    setComboDashboardGroup,
    comboChartBodyReady,
    setComboChartBodyReady,
    comboChartCardsVisibleCount,
    setComboChartCardsVisibleCount,
    comboStatDetailKey,
    setComboStatDetailKey,
    comboChartDeptOrder,
    setComboChartDeptOrder,
    comboProductionDeptOrder,
    setComboProductionDeptOrder,
    printDropdownOpen,
    setPrintDropdownOpen,
    actionDropdownOpen,
    setActionDropdownOpen,
    isUploadingExcel,
    setIsUploadingExcel,
    showExportRangeModal,
    setShowExportRangeModal,
    exportRangeFrom,
    setExportRangeFrom,
    exportRangeTo,
    setExportRangeTo,
    exportRangeBusy,
    setExportRangeBusy,
    showUnattendedPopup,
    setShowUnattendedPopup,
    unattendedPopupDismissed,
    setUnattendedPopupDismissed,
    unattendedSessionSuppressed,
    setUnattendedSessionSuppressed,
    unattendedSuppressSessionCheckbox,
    setUnattendedSuppressSessionCheckbox,
    filterMenuDropdownOpen,
    setFilterMenuDropdownOpen,
    offHolidayDropdownOpen,
    setOffHolidayDropdownOpen,
    navbarMobileMenuOpen,
    setNavbarMobileMenuOpen,
    filterMenuRef,
    filterDropdownAnchorRef,
    filterMenuPanelRef,
    actionDropdownRef,
    printDropdownRef,
    actionDropdownAnchorRef,
    printDropdownAnchorRef,
    actionDropdownPanelRef,
    printDropdownPanelRef,
    offHolidayDropdownRef,
    offHolidayDropdownAnchorRef,
    offHolidayDropdownPanelRef,
    exportRangeModalInitializedRef,
    prevShowUnattendedPopupRef,
    isQuickNoCheckInActive,
    handleQuickNoCheckInFilter,
    closeUnattendedPopup,
  } = ui;

  const userEmailKey = useMemo(
    () => user?.email?.trim().toLowerCase() || "anonymous",
    [user?.email],
  );
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { tl, displayLocale } = useAttendanceListI18n(t, i18n);

  useAttendanceChartOrderHydration(
    userEmailKey,
    setComboChartDeptOrder,
    setComboProductionDeptOrder,
  );

  const {
    monthOffAndHoliday,
    monthOffDaysLoading,
    refreshMonthOffDays,
    dayOffToolbarButtonTitle,
  } = useAttendanceMonthOffDays({
    user,
    userRole,
    selectedDate,
    attendanceRootPath,
    tl,
  });

  const {
    employees,
    employeesRef,
    isOffDay,
    isHolidayDay,
    isCompensatoryDay,
  } = useAttendanceDayFirebase(attendanceRootPath, selectedDate);

  const {
    normalizeDepartment,
    deferredLoaiPhepFilterSet,
    filterAttendanceListRows,
    filteredEmployees,
    deferredFilteredEmployees,
    allLeaveTypesSelectAllChecked,
    allLeaveTypeFilterValues,
  } = useAttendanceListFilters({
    employees,
    searchTerm,
    departmentFilter: "",
    departmentListFilter,
    loaiPhepFilter,
    joinDateYearFilter,
    joinDateMonthFilter,
    showOnlyUnattendedFilter,
  });

  const unattendedEmployees = useAttendanceUnattendedPopupEffects({
    user,
    selectedDate,
    employees,
    showUnattendedPopup,
    setShowUnattendedPopup,
    unattendedPopupDismissed,
    unattendedSessionSuppressed,
    setUnattendedSessionSuppressed,
    setUnattendedPopupDismissed,
    setUnattendedSuppressSessionCheckbox,
    prevShowUnattendedPopupRef,
  });

  const { departments, buCongEmployees } = useAttendanceListDerivedLists({
    employees,
    deferredFilteredEmployees,
    deferredLoaiPhepFilterSet,
    showOnlyUnattendedFilter,
    normalizeDepartment,
  });

  const joinDateYearOptions = useMemo(() => {
    const s = new Set();
    for (const emp of employees) {
      const raw = String(emp.ngayVaoLam || "").trim();
      if (raw.length < 4) continue;
      const y = raw.slice(0, 4);
      if (/^\d{4}$/.test(y)) s.add(y);
    }
    return Array.from(s).sort((a, b) => Number(b) - Number(a));
  }, [employees]);

  const joinDateMonthOptions = useMemo(() => {
    const s = new Set();
    for (const emp of employees) {
      const raw = String(emp.ngayVaoLam || "").trim();
      if (raw.length < 7) continue;
      const y = raw.slice(0, 4);
      if (joinDateYearFilter && y !== joinDateYearFilter) continue;
      const m = raw.slice(5, 7);
      if (/^\d{2}$/.test(m)) s.add(m);
    }
    return Array.from(s).sort((a, b) => Number(a) - Number(b));
  }, [employees, joinDateYearFilter]);

  const {
    comboProductionDeptCatalog,
    getComboProductionDeptChartRank,
    persistComboProductionDeptOrder,
    comboChartData,
    comboChartDataOrdered,
    comboDashboardStats,
    comboChartRowsVisible,
    comboStatEmployeesByKey,
    comboStatLabelByKey,
  } = useAttendanceComboChart({
    deferredFilteredEmployees,
    comboDashboardGroup,
    comboProductionDeptOrder,
    setComboProductionDeptOrder,
    comboChartDeptOrder,
    userEmailKey,
    showComboChartModal,
    comboChartBodyReady,
    setComboChartBodyReady,
    comboChartCardsVisibleCount,
    setComboChartCardsVisibleCount,
    comboStatDetailKey,
    setComboStatDetailKey,
    normalizeDepartment,
    tl,
  });

  const {
    handleExportAttendanceDateRange,
    handleEdit,
    handleUploadExcelWrapper,
    handleDownloadAttendanceExcelTemplate,
    handlePrintOvertimeList,
    handlePrintAttendanceList,
    handleExportBuCongExcel,
  } = useAttendanceListHandlers({
    user,
    userRole,
    userDepartments,
    t,
    tl,
    displayLocale,
    selectedDate,
    attendanceRootPath,
    setAlert,
    setShowEmployeeModal,
    setEmployeeModalRecord,
    setIsUploadingExcel,
    filteredEmployees,
    filterAttendanceListRows,
    exportRangeBusy,
    exportRangeFrom,
    exportRangeTo,
    setExportRangeBusy,
    setShowExportRangeModal,
    showExportRangeModal,
    exportRangeModalInitializedRef,
    setExportRangeFrom,
    setExportRangeTo,
    buCongEmployees,
  });

  const {
    canEditEmployee,
    showRowModalActions,
    canDeleteDayRecord,
    columnPlan,
    attendanceGridTemplateColumns,
  } = useAttendanceListSetup({
    user,
    userRole,
    userDepartments,
    alert,
    setAlert,
    searchParams,
    setSearchParams,
    setSelectedDate,
    employees,
    handleEdit,
  });

  const { handleDelete, handleDeleteAllData } = useAttendanceListMutations({
    user,
    userRole,
    userDepartments,
    selectedDate,
    attendanceRootPath,
    employeesRef,
    employeesLength: employees.length,
    setAlert,
    t,
  });

  const closeActionDropdown = useCallback(() => {
    setActionDropdownOpen(false);
  }, [setActionDropdownOpen]);

  const closePrintDropdown = useCallback(() => {
    setPrintDropdownOpen(false);
  }, [setPrintDropdownOpen]);

  const closeOffHolidayDropdown = useCallback(() => {
    setOffHolidayDropdownOpen(false);
  }, [setOffHolidayDropdownOpen]);

  const closeExportRangeModal = useCallback(() => {
    setShowExportRangeModal(false);
  }, [setShowExportRangeModal]);

  const previousDateOf = useCallback((dateKey) => {
    const d = new Date(`${String(dateKey || "").trim()}T12:00:00`);
    if (Number.isNaN(d.getTime())) return "";
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);

  useEffect(() => {
    setCompareCriteria((prev) => {
      const compareDate = String(selectedDate || "").trim();
      return {
        ...prev,
        compareDate,
        previousDate: previousDateOf(compareDate),
      };
    });
  }, [selectedDate, previousDateOf]);

  const handleCompareEmployeesByDepartment = useCallback(async (criteria = {}) => {
    if (compareEmployeesBusy) return;
    const currentDate = String(
      criteria.compareDate || compareCriteria.compareDate || selectedDate || "",
    ).trim();
    const previousDate = String(
      criteria.previousDate ||
        compareCriteria.previousDate ||
        previousDateOf(currentDate),
    ).trim();
    const departmentFilter = String(
      criteria.department ?? compareCriteria.department ?? "",
    ).trim();

    if (!currentDate) {
      setAlert({
        show: true,
        type: "error",
        message: tl(
          "compareEmployeesFillDate",
          "Vui lòng chọn ngày để so sánh.",
        ),
      });
      return;
    }

    const currentDateObj = new Date(`${currentDate}T12:00:00`);
    const previousDateObj = new Date(`${previousDate}T12:00:00`);
    if (
      Number.isNaN(currentDateObj.getTime()) ||
      Number.isNaN(previousDateObj.getTime())
    ) {
      setAlert({
        show: true,
        type: "error",
        message: tl("compareEmployeesInvalidDate", "Ngày chọn không hợp lệ."),
      });
      return;
    }

    const allowedProductionMatchKeys = new Set(
      COMBO_STATS_PRODUCTION_DEPT_DEFAULT_ORDER,
    );
    const orderedProductionMatchKeys = (
      comboProductionDeptOrder.length > 0
        ? comboProductionDeptOrder
        : mergeComboProductionDeptPickerKeys(comboProductionDeptCatalog)
    ).filter((mk) => allowedProductionMatchKeys.has(mk));
    const buildDeptEmployeeMap = (rows) => {
      const out = new Map();
      for (const emp of rows || []) {
        const matchKey = attendanceProductionDeptMatchKey(
          normalizeDepartment,
          emp?.boPhan,
        );
        if (!matchKey || !allowedProductionMatchKeys.has(matchKey)) continue;
        const dept =
          COMBO_STATS_PRODUCTION_DEPT_PICKER_LABELS[matchKey] ||
          String(emp?.boPhan || "").trim() ||
          "—";
        const mnv = String(emp?.mnv || "").trim();
        const mvt = String(emp?.mvt || "").trim();
        const name = String(emp?.hoVaTen || "").trim() || "Không tên";
        const key = mnv || mvt || name;
        const label = mnv ? `${name} (${mnv})` : name;
        if (!out.has(dept)) out.set(dept, new Map());
        out.get(dept).set(key, label);
      }
      return out;
    };

    setCompareEmployeesBusy(true);
    try {
      const loadRowsByDate = async (dateKey) => {
        const key = `${attendanceRootPath}:${dateKey}`;
        const cached = compareDayRowsCacheRef.current.get(key);
        if (cached) return cached;
        const snap = await get(ref(db, `${attendanceRootPath}/${dateKey}`));
        const rows = reconcileAttendanceDayRowsFromRaw([], snap.val());
        compareDayRowsCacheRef.current.set(key, rows);
        if (compareDayRowsCacheRef.current.size > 12) {
          const oldestKey = compareDayRowsCacheRef.current.keys().next().value;
          if (oldestKey) compareDayRowsCacheRef.current.delete(oldestKey);
        }
        return rows;
      };

      const [previousRows, currentRows] = await Promise.all([
        loadRowsByDate(previousDate),
        loadRowsByDate(currentDate),
      ]);

      const prevByDept = buildDeptEmployeeMap(previousRows);
      const currByDept = buildDeptEmployeeMap(currentRows);
      const productionDeptLabels = orderedProductionMatchKeys.map(
        (matchKey) =>
          COMBO_STATS_PRODUCTION_DEPT_PICKER_LABELS[matchKey] || matchKey,
      );
      const allDepts = Array.from(
        new Set([
          ...productionDeptLabels,
          ...prevByDept.keys(),
          ...currByDept.keys(),
        ]),
      );

      const rows = allDepts.map((department) => {
        const prevEmpMap = prevByDept.get(department) || new Map();
        const currEmpMap = currByDept.get(department) || new Map();
        const previousOnly = [];
        const currentOnly = [];
        let sameCount = 0;

        for (const [k, label] of prevEmpMap.entries()) {
          if (currEmpMap.has(k)) sameCount += 1;
          else previousOnly.push(label);
        }
        for (const [k, label] of currEmpMap.entries()) {
          if (!prevEmpMap.has(k)) currentOnly.push(label);
        }

        previousOnly.sort((a, b) => a.localeCompare(b, "vi"));
        currentOnly.sort((a, b) => a.localeCompare(b, "vi"));

        return {
          department,
          previousCount: prevEmpMap.size,
          currentCount: currEmpMap.size,
          sameCount,
          previousOnly,
          currentOnly,
        };
      });

      const filteredRows = departmentFilter
        ? rows.filter((x) => x.department === departmentFilter)
        : rows;

      startTransition(() => {
        setCompareEmployeesResult({
          previousDate,
          currentDate,
          rows: filteredRows,
          departments: allDepts,
        });
        setCompareEmployeesOpen(true);
      });
    } catch (error) {
      setAlert({
        show: true,
        type: "error",
        message: tl("compareEmployeesError", "Không thể so sánh nhân viên: {{error}}", {
          error: error?.message || "unknown",
        }),
      });
    } finally {
      setCompareEmployeesBusy(false);
    }
  }, [
    selectedDate,
    compareCriteria,
    compareEmployeesBusy,
    previousDateOf,
    attendanceRootPath,
    comboProductionDeptOrder,
    comboProductionDeptCatalog,
    normalizeDepartment,
    setAlert,
    tl,
  ]);

  const handleOpenCompareEmployees = useCallback(async () => {
    setCompareEmployeesOpen(true);
    await handleCompareEmployeesByDepartment(compareCriteria);
  }, [handleCompareEmployeesByDepartment, compareCriteria]);

  const filterDropdownPlacement = useAttendanceFilterDropdownPlacement(
    filterMenuDropdownOpen,
    filterDropdownAnchorRef,
  );
  const actionDropdownPlacement = useAttendanceActionDropdownPlacement(
    actionDropdownOpen,
    actionDropdownAnchorRef,
    closeActionDropdown,
  );
  const printDropdownPlacement = useAttendancePrintDropdownPlacement(
    printDropdownOpen,
    printDropdownAnchorRef,
    closePrintDropdown,
  );
  const offHolidayDropdownPlacement = useAttendanceOffHolidayDropdownPlacement(
    offHolidayDropdownOpen,
    offHolidayDropdownAnchorRef,
    closeOffHolidayDropdown,
  );

  const toolbarBranchValue = useMemo(
    () => ({
      navbarMobileMenuOpen,
      user,
      userRole,
      selectedDate,
      setSelectedDate,
      isOffDay,
      isHolidayDay,
      isCompensatoryDay,
      dayOffToolbarButtonTitle,
      offHolidayDropdownOpen,
      setOffHolidayDropdownOpen,
      offHolidayDropdownRef,
      offHolidayDropdownAnchorRef,
      offHolidayDropdownPanelRef,
      offHolidayDropdownPlacement,
      monthOffAndHoliday,
      monthOffDaysLoading,
      setOffDaysModalOpen,
      tl,
      attendanceRootPath,
      deferredFilteredEmployees,
      buCongEmployees,
      handleExportBuCongExcel,
      t,
      filterMenuRef,
      filterDropdownAnchorRef,
      filterMenuPanelRef,
      filterMenuDropdownOpen,
      setFilterMenuDropdownOpen,
      filterDropdownPlacement,
      filterOpen,
      setFilterOpen,
      loaiPhepFilter,
      setLoaiPhepFilter,
      joinDateYearFilter,
      setJoinDateYearFilter,
      joinDateMonthFilter,
      setJoinDateMonthFilter,
      joinDateYearOptions,
      joinDateMonthOptions,
      departmentListFilter,
      setDepartmentListFilter,
      isQuickNoCheckInActive,
      handleQuickNoCheckInFilter,
      setShowOnlyUnattendedFilter,
      setComboDashboardGroup,
      setShowComboChartModal,
      expandedSections,
      setExpandedSections,
      filterDepartmentSearch,
      setFilterDepartmentSearch,
      departments,
      allLeaveTypesSelectAllChecked,
      allLeaveTypeFilterValues,
      filteredEmployees,
      setAlert,
      actionDropdownOpen,
      setActionDropdownOpen,
      actionDropdownRef,
      actionDropdownAnchorRef,
      actionDropdownPanelRef,
      actionDropdownPlacement,
      printDropdownOpen,
      setPrintDropdownOpen,
      printDropdownRef,
      printDropdownAnchorRef,
      printDropdownPanelRef,
      printDropdownPlacement,
      isUploadingExcel,
      handleUploadExcelWrapper,
      handleDownloadAttendanceExcelTemplate,
      setShowExportRangeModal,
      compareEmployeesBusy,
      handleCompareEmployeesByDepartment: handleOpenCompareEmployees,
      showRowModalActions,
      setEmployeeModalRecord,
      setShowEmployeeModal,
      handleDeleteAllData,
      handlePrintOvertimeList,
      handlePrintAttendanceList,
    }),
    [
      navbarMobileMenuOpen,
      user,
      userRole,
      selectedDate,
      setSelectedDate,
      isOffDay,
      isHolidayDay,
      isCompensatoryDay,
      dayOffToolbarButtonTitle,
      offHolidayDropdownOpen,
      setOffHolidayDropdownOpen,
      offHolidayDropdownRef,
      offHolidayDropdownAnchorRef,
      offHolidayDropdownPanelRef,
      offHolidayDropdownPlacement,
      monthOffAndHoliday,
      monthOffDaysLoading,
      setOffDaysModalOpen,
      tl,
      attendanceRootPath,
      deferredFilteredEmployees,
      buCongEmployees,
      handleExportBuCongExcel,
      t,
      filterMenuRef,
      filterDropdownAnchorRef,
      filterMenuPanelRef,
      filterMenuDropdownOpen,
      setFilterMenuDropdownOpen,
      filterDropdownPlacement,
      filterOpen,
      setFilterOpen,
      loaiPhepFilter,
      setLoaiPhepFilter,
      joinDateYearFilter,
      setJoinDateYearFilter,
      joinDateMonthFilter,
      setJoinDateMonthFilter,
      joinDateYearOptions,
      joinDateMonthOptions,
      departmentListFilter,
      setDepartmentListFilter,
      isQuickNoCheckInActive,
      handleQuickNoCheckInFilter,
      setShowOnlyUnattendedFilter,
      setComboDashboardGroup,
      setShowComboChartModal,
      expandedSections,
      setExpandedSections,
      filterDepartmentSearch,
      setFilterDepartmentSearch,
      departments,
      allLeaveTypesSelectAllChecked,
      allLeaveTypeFilterValues,
      filteredEmployees,
      setAlert,
      actionDropdownOpen,
      setActionDropdownOpen,
      actionDropdownRef,
      actionDropdownAnchorRef,
      actionDropdownPanelRef,
      actionDropdownPlacement,
      printDropdownOpen,
      setPrintDropdownOpen,
      printDropdownRef,
      printDropdownAnchorRef,
      printDropdownPanelRef,
      printDropdownPlacement,
      isUploadingExcel,
      handleUploadExcelWrapper,
      handleDownloadAttendanceExcelTemplate,
      compareEmployeesBusy,
      handleOpenCompareEmployees,
      setShowExportRangeModal,
      showRowModalActions,
      setEmployeeModalRecord,
      setShowEmployeeModal,
      handleDeleteAllData,
      handlePrintOvertimeList,
      handlePrintAttendanceList,
    ],
  );

  const searchBranchValue = useMemo(
    () => ({ searchTerm, setSearchTerm }),
    [searchTerm, setSearchTerm],
  );

  const contentBranchValue = useMemo(
    () => ({
      showEmployeeModal,
      setShowEmployeeModal,
      setEmployeeModalRecord,
      employeeModalRecord,
      selectedDate,
      setSelectedDate,
      employees,
      user,
      userRole,
      userDepartments,
      attendanceRootPath,
      setAlert,
      isCompensatoryDay,
      offDaysModalOpen,
      setOffDaysModalOpen,
      refreshMonthOffDays,
      tl,
      t,
      showComboChartModal,
      setShowComboChartModal,
      comboDashboardGroup,
      setComboDashboardGroup,
      comboProductionDeptCatalog,
      comboProductionDeptOrder,
      persistComboProductionDeptOrder,
      getComboProductionDeptChartRank,
      comboDashboardStats,
      comboChartData,
      comboChartBodyReady,
      comboChartRowsVisible,
      comboChartCardsVisibleCount,
      comboChartDataOrdered,
      comboStatDetailKey,
      setComboStatDetailKey,
      comboStatLabelByKey,
      comboStatEmployeesByKey,
      compareEmployeesBusy,
      handleCompareEmployeesByDepartment,
      columnPlan,
      forceVirtualizedRows,
      deferredFilteredEmployees,
      attendanceGridTemplateColumns,
      showRowModalActions,
      canDeleteDayRecord,
      canEditEmployee,
      handleEdit,
      handleDelete,
      isOffDay,
      isHolidayDay,
      displayLocale,
    }),
    [
      showEmployeeModal,
      setShowEmployeeModal,
      setEmployeeModalRecord,
      employeeModalRecord,
      selectedDate,
      setSelectedDate,
      employees,
      user,
      userRole,
      userDepartments,
      attendanceRootPath,
      setAlert,
      isCompensatoryDay,
      offDaysModalOpen,
      setOffDaysModalOpen,
      refreshMonthOffDays,
      tl,
      t,
      showComboChartModal,
      setShowComboChartModal,
      comboDashboardGroup,
      setComboDashboardGroup,
      comboProductionDeptCatalog,
      comboProductionDeptOrder,
      persistComboProductionDeptOrder,
      getComboProductionDeptChartRank,
      comboDashboardStats,
      comboChartData,
      comboChartBodyReady,
      comboChartRowsVisible,
      comboChartCardsVisibleCount,
      comboChartDataOrdered,
      comboStatDetailKey,
      setComboStatDetailKey,
      comboStatLabelByKey,
      comboStatEmployeesByKey,
      compareEmployeesBusy,
      handleCompareEmployeesByDepartment,
      columnPlan,
      forceVirtualizedRows,
      deferredFilteredEmployees,
      attendanceGridTemplateColumns,
      showRowModalActions,
      canDeleteDayRecord,
      canEditEmployee,
      handleEdit,
      handleDelete,
      isOffDay,
      isHolidayDay,
      displayLocale,
    ],
  );

  useAttendanceListToolbarEffects({
    location,
    filterOpen,
    filterMenuDropdownOpen,
    printDropdownOpen,
    actionDropdownOpen,
    offHolidayDropdownOpen,
    filterMenuRef,
    filterMenuPanelRef,
    printDropdownRef,
    printDropdownPanelRef,
    actionDropdownRef,
    actionDropdownPanelRef,
    offHolidayDropdownRef,
    offHolidayDropdownPanelRef,
    setFilterMenuDropdownOpen,
    setPrintDropdownOpen,
    setActionDropdownOpen,
    setOffHolidayDropdownOpen,
    setFilterOpen,
    setNavbarMobileMenuOpen,
  });

  return (
    <>
      {/* Main Content */}
      <div className="p-2 md:p-4 transition-all duration-300">
        <AttendanceListHeader
          headerTitle={headerTitle}
          headerSubtitle={headerSubtitle}
          selectedDate={selectedDate}
          displayLocale={displayLocale}
          counterpartLinkTo={counterpartLinkTo}
          counterpartLinkLabelKey={counterpartLinkLabelKey}
          counterpartLinkLabelDefault={counterpartLinkLabelDefault}
          tl={tl}
        />

        <AlertMessage alert={alert} />

        <AttendanceUnattendedModal
          showUnattendedPopup={showUnattendedPopup}
          unattendedEmployees={unattendedEmployees}
          closeUnattendedPopup={closeUnattendedPopup}
          unattendedSuppressSessionCheckbox={unattendedSuppressSessionCheckbox}
          setUnattendedSuppressSessionCheckbox={setUnattendedSuppressSessionCheckbox}
          setShowOnlyUnattendedFilter={setShowOnlyUnattendedFilter}
          selectedDate={selectedDate}
          displayLocale={displayLocale}
          tl={tl}
          t={t}
        />

    <AttendanceCompareEmployeesModal
      isOpen={compareEmployeesOpen}
      onClose={() => setCompareEmployeesOpen(false)}
      compareBusy={compareEmployeesBusy}
      result={compareEmployeesResult}
      criteria={compareCriteria}
      onChangeCriteria={setCompareCriteria}
      onCompare={handleCompareEmployeesByDepartment}
      tl={tl}
    />

        <AttendanceExportRangeModal
          isOpen={showExportRangeModal}
          onClose={closeExportRangeModal}
          exportRangeBusy={exportRangeBusy}
          exportRangeFrom={exportRangeFrom}
          exportRangeTo={exportRangeTo}
          onChangeFrom={setExportRangeFrom}
          onChangeTo={setExportRangeTo}
          onConfirmExport={handleExportAttendanceDateRange}
          tl={tl}
        />

        <AttendanceListSearchBranchContext.Provider value={searchBranchValue}>
          <AttendanceListToolbarBranchContext.Provider
            value={toolbarBranchValue}
          >
            <AttendanceListContentBranchContext.Provider
              value={contentBranchValue}
            >
              <AttendanceListToolbarSection />
              <AttendanceListContentSection />
            </AttendanceListContentBranchContext.Provider>
          </AttendanceListToolbarBranchContext.Provider>
        </AttendanceListSearchBranchContext.Provider>
      </div>
    </>
  );
});

export default AttendanceList;
