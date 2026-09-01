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

/**
 * Hiển thị phép năm từ Firebase (`annualLeave/{year}`) — không quét lại cả năm điểm danh khi mở trang.
 * Tính từ điểm danh chỉ khi ghi (Cloud Function / client sync) hoặc bấm «Tính lại».
 * Set `VITE_ANNUAL_LEAVE_LIVE_DISPLAY=true` để bật lại overlay live cũ trên UI.
 */
export function isAnnualLeaveStoredDisplayEnabled() {
  return import.meta.env.VITE_ANNUAL_LEAVE_LIVE_DISPLAY !== "true";
}
