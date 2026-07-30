import React, { memo } from "react";
import AttendanceSearchActionsBar from "./AttendanceSearchActionsBar";
import SeasonalKpStreakNotification from "./SeasonalKpStreakNotification";
import AttendanceBuCongNotificationPanel from "./AttendanceBuCongNotificationPanel";
import AttendanceListFilterMenus from "./AttendanceListFilterMenus";
import {
  useAttendanceListSearchBranch,
  useAttendanceListToolbarBranch,
  useAttendanceListFilteredDataBranch,
} from "./attendanceListBranchContexts";
import { isSeasonalAttendanceRoot } from "./attendanceSeasonalStt";

/**
 * Cụm ô tìm + nút — subscribe search + filtered-data context để gõ không re-render filter menus.
 */
function AttendanceToolbarSearchCluster() {
  const { searchTerm, setSearchTerm } = useAttendanceListSearchBranch();
  const {
    filteredEmployees,
    deferredFilteredEmployees,
    buCongEmployees,
    handleExportBuCongExcel,
  } = useAttendanceListFilteredDataBranch();
  const {
    tl,
    t,
    attendanceRootPath,
    navbarMobileMenuOpen,
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
    handleOpenUnattendedPopup,
    setShowOnlyUnattendedFilter,
    expandedSections,
    setExpandedSections,
    filterDepartmentSearch,
    setFilterDepartmentSearch,
    departments,
    allLeaveTypesSelectAllChecked,
    allLeaveTypeFilterValues,
    user,
    userRole,
    selectedDate,
    setAlert,
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
    showKoreanMonthlyTimesheet,
    onOpenMonthlyTimesheet,
    onKoreanExportOneDay,
    onKoreanExportRange,
    tlPayrollPage,
    annualLeaveBalanceEnabled,
    setAnnualLeaveBalanceEnabled,
    showAnnualLeaveBalanceToggle,
  } = useAttendanceListToolbarBranch();

  const buCongPanel = (
    <AttendanceBuCongNotificationPanel
      buCongEmployees={buCongEmployees}
      handleExportBuCongExcel={handleExportBuCongExcel}
      tl={tl}
      t={t}
    />
  );

  return (
    <AttendanceSearchActionsBar
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder={t("attendanceList.searchPlaceholder")}
    >
      {isSeasonalAttendanceRoot(attendanceRootPath) ? (
        <SeasonalKpStreakNotification
          filteredEmployees={deferredFilteredEmployees}
          selectedDate={selectedDate}
          attendanceRootPath={attendanceRootPath}
        />
      ) : showAnnualLeaveBalanceToggle ? (
        <>
          <button
            type="button"
            className={`inline-flex h-8 shrink-0 items-center rounded-md border px-2 text-xs font-semibold transition ${
              annualLeaveBalanceEnabled
                ? "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            }`}
            title={t("attendanceList.annualLeaveBalanceToggleHint", {
              defaultValue: "Bấm để tải cột phép năm (BALANCE) khớp điểm danh.",
            })}
            onClick={() => setAnnualLeaveBalanceEnabled((on) => !on)}
            aria-pressed={annualLeaveBalanceEnabled}
          >
            {annualLeaveBalanceEnabled
              ? t("attendanceList.annualLeaveBalance", {
                  defaultValue: "Phép năm",
                })
              : t("attendanceList.annualLeaveBalanceFetch", {
                  defaultValue: "Lấy phép năm",
                })}
          </button>
          {buCongPanel}
        </>
      ) : (
        buCongPanel
      )}

      <AttendanceListFilterMenus
        tl={tl}
        t={t}
        navbarMobileMenuOpen={navbarMobileMenuOpen}
        filterMenuRef={filterMenuRef}
        filterDropdownAnchorRef={filterDropdownAnchorRef}
        filterMenuPanelRef={filterMenuPanelRef}
        filterMenuDropdownOpen={filterMenuDropdownOpen}
        setFilterMenuDropdownOpen={setFilterMenuDropdownOpen}
        filterDropdownPlacement={filterDropdownPlacement}
        filterOpen={filterOpen}
        setFilterOpen={setFilterOpen}
        loaiPhepFilter={loaiPhepFilter}
        setLoaiPhepFilter={setLoaiPhepFilter}
        joinDateYearFilter={joinDateYearFilter}
        setJoinDateYearFilter={setJoinDateYearFilter}
        joinDateMonthFilter={joinDateMonthFilter}
        setJoinDateMonthFilter={setJoinDateMonthFilter}
        joinDateYearOptions={joinDateYearOptions}
        joinDateMonthOptions={joinDateMonthOptions}
        departmentListFilter={departmentListFilter}
        setDepartmentListFilter={setDepartmentListFilter}
        isQuickNoCheckInActive={isQuickNoCheckInActive}
        handleQuickNoCheckInFilter={handleQuickNoCheckInFilter}
        handleOpenUnattendedPopup={handleOpenUnattendedPopup}
        setShowOnlyUnattendedFilter={setShowOnlyUnattendedFilter}
        setSearchTerm={setSearchTerm}
        expandedSections={expandedSections}
        setExpandedSections={setExpandedSections}
        filterDepartmentSearch={filterDepartmentSearch}
        setFilterDepartmentSearch={setFilterDepartmentSearch}
        departments={departments}
        allLeaveTypesSelectAllChecked={allLeaveTypesSelectAllChecked}
        allLeaveTypeFilterValues={allLeaveTypeFilterValues}
        user={user}
        userRole={userRole}
        selectedDate={selectedDate}
        filteredEmployees={filteredEmployees}
        setAlert={setAlert}
        isUploadingExcel={isUploadingExcel}
        handleUploadExcelWrapper={handleUploadExcelWrapper}
        handleDownloadAttendanceExcelTemplate={
          handleDownloadAttendanceExcelTemplate
        }
        setShowExportRangeModal={setShowExportRangeModal}
        showRowModalActions={showRowModalActions}
        setEmployeeModalRecord={setEmployeeModalRecord}
        setShowEmployeeModal={setShowEmployeeModal}
        handleDeleteAllData={handleDeleteAllData}
        handlePrintOvertimeList={handlePrintOvertimeList}
        handlePrintAttendanceList={handlePrintAttendanceList}
        showKoreanMonthlyTimesheet={showKoreanMonthlyTimesheet}
        onOpenMonthlyTimesheet={onOpenMonthlyTimesheet}
        onKoreanExportOneDay={onKoreanExportOneDay}
        onKoreanExportRange={onKoreanExportRange}
        tlPayrollPage={tlPayrollPage}
      />
    </AttendanceSearchActionsBar>
  );
}

export default memo(AttendanceToolbarSearchCluster);
