import React, { memo } from "react";
import AttendanceListDateOffToolbar from "./AttendanceListDateOffToolbar";
import { useAttendanceListToolbarBranch } from "./attendanceListBranchContexts";

/** Thanh ngày + OFF/Lễ/NB (cụm tìm kiếm render ở `AttendanceList`). */
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
  );
}

export default memo(AttendanceListToolbarSection);
