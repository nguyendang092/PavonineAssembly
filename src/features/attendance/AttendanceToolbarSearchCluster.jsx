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
  } = useAttendanceListToolbarBranch();

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
      />
    </AttendanceSearchActionsBar>
  );
}

export default memo(AttendanceToolbarSearchCluster);
