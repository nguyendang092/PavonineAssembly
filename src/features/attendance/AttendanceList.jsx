import React, { memo, useState, useMemo, useCallback, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useSearchParams } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import AlertMessage from "@/components/ui/AlertMessage";
import AttendanceExportRangeModal from "./AttendanceExportRangeModal";
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
import AttendanceListToolbarSearchCluster from "./AttendanceToolbarSearchCluster";
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
import { useAttendanceCompareEmployees } from "./useAttendanceCompareEmployees";
import {
  AttendanceListToolbarBranchContext,
  AttendanceListContentBranchContext,
  AttendanceListSearchBranchContext,
  AttendanceListFilteredDataBranchContext,
  AttendanceListTableBranchContext,
  AttendanceListComboBranchContext,
} from "./attendanceListBranchContexts";

const AttendanceCompareEmployeesModal = lazy(
  () => import("./AttendanceCompareEmployeesModal"),
);

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

  const {
    compareEmployeesOpen,
    compareEmployeesBusy,
    compareEmployeesResult,
    compareCriteria,
    setCompareCriteria,
    closeCompareEmployees,
    handleCompareEmployeesByDepartment,
    handleOpenCompareEmployees,
  } = useAttendanceCompareEmployees({
    attendanceRootPath,
    selectedDate,
    normalizeDepartment,
    comboProductionDeptOrder,
    comboProductionDeptCatalog,
    setAlert,
    tl,
  });

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

  const filteredDataBranchValue = useMemo(
    () => ({
      filteredEmployees,
      deferredFilteredEmployees,
      buCongEmployees,
      handleExportBuCongExcel,
    }),
    [
      filteredEmployees,
      deferredFilteredEmployees,
      buCongEmployees,
      handleExportBuCongExcel,
    ],
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
      displayLocale,
    ],
  );

  const tableBranchValue = useMemo(
    () => ({
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
      selectedDate,
      displayLocale,
      tl,
    }),
    [
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
      selectedDate,
      displayLocale,
      tl,
    ],
  );

  const comboBranchValue = useMemo(
    () => ({
      selectedDate,
      setSelectedDate,
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
      handleOpenCompareEmployees,
      comboDashboardGroup,
      setComboDashboardGroup,
      tl,
      t,
    }),
    [
      selectedDate,
      setSelectedDate,
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
      handleOpenCompareEmployees,
      comboDashboardGroup,
      setComboDashboardGroup,
      tl,
      t,
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

    {compareEmployeesOpen ? (
      <Suspense
        fallback={
          <div
            className="fixed inset-0 z-[1210] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm"
            aria-busy="true"
          >
            <p className="rounded-lg bg-slate-900/80 px-4 py-2 text-sm text-white">
              {tl("compareEmployeesLoading", "Đang so sánh dữ liệu...")}
            </p>
          </div>
        }
      >
        <AttendanceCompareEmployeesModal
          isOpen
          onClose={closeCompareEmployees}
          compareBusy={compareEmployeesBusy}
          result={compareEmployeesResult}
          criteria={compareCriteria}
          onChangeCriteria={setCompareCriteria}
          onCompare={handleCompareEmployeesByDepartment}
          tl={tl}
        />
      </Suspense>
    ) : null}

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
            <div className="mb-2 flex flex-col gap-2 sm:mb-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
              <AttendanceListToolbarSection />
              <AttendanceListFilteredDataBranchContext.Provider
                value={filteredDataBranchValue}
              >
                <div className="min-w-0 sm:flex sm:shrink-0 sm:items-center sm:justify-end">
                  <AttendanceListToolbarSearchCluster />
                </div>
              </AttendanceListFilteredDataBranchContext.Provider>
            </div>
            <AttendanceListContentBranchContext.Provider
              value={contentBranchValue}
            >
              <AttendanceListTableBranchContext.Provider
                value={tableBranchValue}
              >
                <AttendanceListComboBranchContext.Provider
                  value={comboBranchValue}
                >
                  <AttendanceListContentSection />
                </AttendanceListComboBranchContext.Provider>
              </AttendanceListTableBranchContext.Provider>
            </AttendanceListContentBranchContext.Provider>
          </AttendanceListToolbarBranchContext.Provider>
        </AttendanceListSearchBranchContext.Provider>
      </div>
    </>
  );
});

export default AttendanceList;
