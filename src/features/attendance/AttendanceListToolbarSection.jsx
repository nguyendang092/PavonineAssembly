import React, { memo } from "react";
import AttendanceListDateOffToolbar from "./AttendanceListDateOffToolbar";
import AttendanceToolbarSearchCluster from "./AttendanceToolbarSearchCluster";
import { useAttendanceListToolbarBranch } from "./attendanceListBranchContexts";

/**
 * Thanh công cụ: ngày + OFF/Lễ/NB, tìm kiếm, bù công / streak, bộ lọc, chức năng/In.
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
  } = useAttendanceListToolbarBranch();

  return (
    <div className="mb-2 flex flex-col gap-2 sm:mb-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
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
      <div className="min-w-0 sm:flex sm:shrink-0 sm:items-center sm:justify-end">
        <AttendanceToolbarSearchCluster />
      </div>
    </div>
  );
}

export default memo(AttendanceListToolbarSection);
