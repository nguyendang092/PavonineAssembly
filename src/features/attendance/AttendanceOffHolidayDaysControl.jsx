import React, { useCallback, useRef, useState } from "react";
import AttendanceListDateOffToolbar from "./AttendanceListDateOffToolbar";
import AttendanceOffDaysModal from "./AttendanceOffDaysModal";
import { useAttendanceMonthOffDays } from "./useAttendanceMonthOffDays";
import { useAttendanceOffHolidayDropdownPlacement } from "./useAttendanceToolbarDropdownPlacement";

/**
 * Lịch OFF / Lễ / Nghỉ bù — dropdown + modal (Admin/HR chỉnh sửa).
 * Dùng chung cho Điểm danh, Giờ công, Lưới tháng.
 */
export default function AttendanceOffHolidayDaysControl({
  user,
  userRole,
  selectedDate,
  setSelectedDate,
  isOffDay = false,
  isHolidayDay = false,
  isCompensatoryDay = false,
  tl,
  attendanceRootPath = "attendance",
  navbarMobileMenuOpen = false,
  showDateInput = true,
  elevatedOverlay = false,
  onSaved,
  onAlert,
  className = "",
}) {
  const [offDaysModalOpen, setOffDaysModalOpen] = useState(false);
  const [offHolidayDropdownOpen, setOffHolidayDropdownOpen] = useState(false);
  const offHolidayDropdownRef = useRef(null);
  const offHolidayDropdownAnchorRef = useRef(null);
  const offHolidayDropdownPanelRef = useRef(null);

  const closeOffHolidayDropdown = useCallback(() => {
    setOffHolidayDropdownOpen(false);
  }, []);

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
    enabled: offHolidayDropdownOpen || offDaysModalOpen,
  });

  const offHolidayDropdownPlacement = useAttendanceOffHolidayDropdownPlacement(
    offHolidayDropdownOpen,
    offHolidayDropdownAnchorRef,
    closeOffHolidayDropdown,
  );

  const handleSaved = useCallback(
    (affectedDateKeys) => {
      refreshMonthOffDays();
      onSaved?.(affectedDateKeys);
    },
    [refreshMonthOffDays, onSaved],
  );

  if (!user) return null;

  return (
    <>
      <div className={className}>
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
          showDateInput={showDateInput}
          tl={tl}
        />
      </div>
      <AttendanceOffDaysModal
        open={offDaysModalOpen}
        onClose={() => setOffDaysModalOpen(false)}
        selectedDate={selectedDate}
        user={user}
        userRole={userRole}
        tl={tl}
        onSaved={handleSaved}
        onAlert={onAlert}
        attendanceRootPath={attendanceRootPath}
        elevatedOverlay={elevatedOverlay}
      />
    </>
  );
}
