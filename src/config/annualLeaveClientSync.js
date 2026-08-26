/**
 * Client-side phép năm sync (fallback khi chưa deploy Cloud Function).
 * Set `VITE_CLIENT_ANNUAL_LEAVE_SYNC=false` sau khi CF `syncAnnualLeaveOnAttendanceEmpWrite` đã chạy ổn định.
 */
export function isClientAnnualLeaveSyncEnabled() {
  return import.meta.env.VITE_CLIENT_ANNUAL_LEAVE_SYNC !== "false";
}

/** Chỉ sync client cho root điểm danh chính (không thời vụ / Hàn). */
export function shouldClientSyncAnnualLeaveForAttendanceRoot(attendanceRootPath) {
  return (
    isClientAnnualLeaveSyncEnabled() &&
    attendanceRootPath === "attendance"
  );
}
