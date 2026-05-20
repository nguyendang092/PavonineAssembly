import React, { memo } from "react";
import AttendanceSearchActionsBar from "./AttendanceSearchActionsBar";
import SeasonalKpStreakNotification from "./SeasonalKpStreakNotification";
import AttendanceListDateOffToolbar from "./AttendanceListDateOffToolbar";
import AttendanceBuCongNotificationPanel from "./AttendanceBuCongNotificationPanel";
import AttendanceListFilterMenus from "./AttendanceListFilterMenus";
import AttendanceListActionPrintMenus from "./AttendanceListActionPrintMenus";
import { useAttendanceListToolbarBranch } from "./attendanceListBranchContexts";

/**
 * Thanh công cụ: ngày + OFF/Lễ/NB, tìm kiếm, bù công / streak, bộ lọc, chức năng/In.
 * Dữ liệu lấy từ context (value memo theo nhánh toolbar) để đổi state nhánh content không re-render subtree này.
 */
function AttendanceListToolbarSection() {
  const {
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
    searchTerm,
    setSearchTerm,
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
    showRowModalActions,
    setEmployeeModalRecord,
    setShowEmployeeModal,
    handleDeleteAllData,
    handlePrintOvertimeList,
    handlePrintAttendanceList,
  } = useAttendanceListToolbarBranch();

  return (
    <div
      className={`mb-2 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between ${
        navbarMobileMenuOpen ? "pointer-events-none opacity-0" : ""
      }`}
      aria-hidden={navbarMobileMenuOpen}
    >
      <AttendanceListDateOffToolbar
        user={user}
        userRole={userRole}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        isOffDay={isOffDay}
        isHolidayDay={isHolidayDay}
        isCompensatoryDay={isCompensatoryDay}
        dayOffToolbarButtonTitle={dayOffToolbarButtonTitle}
        offHolidayDropdownOpen={offHolidayDropdownOpen}
        setOffHolidayDropdownOpen={setOffHolidayDropdownOpen}
        offHolidayDropdownRef={offHolidayDropdownRef}
        offHolidayDropdownAnchorRef={offHolidayDropdownAnchorRef}
        offHolidayDropdownPanelRef={offHolidayDropdownPanelRef}
        offHolidayDropdownPlacement={offHolidayDropdownPlacement}
        navbarMobileMenuOpen={navbarMobileMenuOpen}
        monthOffAndHoliday={monthOffAndHoliday}
        monthOffDaysLoading={monthOffDaysLoading}
        setOffDaysModalOpen={setOffDaysModalOpen}
        tl={tl}
      />
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
    </div>
  );
}

export default memo(AttendanceListToolbarSection);
