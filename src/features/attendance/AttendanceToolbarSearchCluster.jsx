import React, { memo } from "react";
import AttendanceSearchActionsBar from "./AttendanceSearchActionsBar";
import SeasonalKpStreakNotification from "./SeasonalKpStreakNotification";
import AttendanceBuCongNotificationPanel from "./AttendanceBuCongNotificationPanel";
import AttendanceListFilterMenus from "./AttendanceListFilterMenus";
import AttendanceListActionPrintMenus from "./AttendanceListActionPrintMenus";
import {
  useAttendanceListSearchBranch,
  useAttendanceListToolbarBranch,
  useAttendanceListFilteredDataBranch,
} from "./attendanceListBranchContexts";

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
    user,
    userRole,
    selectedDate,
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
  } = useAttendanceListToolbarBranch();

  return (
    <AttendanceSearchActionsBar
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder={t("attendanceList.searchPlaceholder")}
      layout="three"
      showSearchOnDesktop
    >
      {attendanceRootPath === "seasonalAttendance" ? (
        <SeasonalKpStreakNotification
          filteredEmployees={deferredFilteredEmployees}
          selectedDate={selectedDate}
          attendanceRootPath={attendanceRootPath}
        />
      ) : (
        <AttendanceBuCongNotificationPanel
          buCongEmployees={buCongEmployees}
          handleExportBuCongExcel={handleExportBuCongExcel}
          tl={tl}
          t={t}
        />
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
        setShowOnlyUnattendedFilter={setShowOnlyUnattendedFilter}
        setSearchTerm={setSearchTerm}
        setComboDashboardGroup={setComboDashboardGroup}
        setShowComboChartModal={setShowComboChartModal}
        expandedSections={expandedSections}
        setExpandedSections={setExpandedSections}
        filterDepartmentSearch={filterDepartmentSearch}
        setFilterDepartmentSearch={setFilterDepartmentSearch}
        departments={departments}
        allLeaveTypesSelectAllChecked={allLeaveTypesSelectAllChecked}
        allLeaveTypeFilterValues={allLeaveTypeFilterValues}
      />

      <AttendanceListActionPrintMenus
        user={user}
        userRole={userRole}
        tl={tl}
        t={t}
        selectedDate={selectedDate}
        filteredEmployees={filteredEmployees}
        setAlert={setAlert}
        navbarMobileMenuOpen={navbarMobileMenuOpen}
        actionDropdownOpen={actionDropdownOpen}
        setActionDropdownOpen={setActionDropdownOpen}
        actionDropdownRef={actionDropdownRef}
        actionDropdownAnchorRef={actionDropdownAnchorRef}
        actionDropdownPanelRef={actionDropdownPanelRef}
        actionDropdownPlacement={actionDropdownPlacement}
        printDropdownOpen={printDropdownOpen}
        setPrintDropdownOpen={setPrintDropdownOpen}
        printDropdownRef={printDropdownRef}
        printDropdownAnchorRef={printDropdownAnchorRef}
        printDropdownPanelRef={printDropdownPanelRef}
        printDropdownPlacement={printDropdownPlacement}
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
      />
    </AttendanceSearchActionsBar>
  );
}

export default memo(AttendanceToolbarSearchCluster);
