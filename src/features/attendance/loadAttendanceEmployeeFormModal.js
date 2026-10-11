let attendanceEmployeeFormModalPromise;

/** Một lần tải chunk form điểm danh — dùng chung lazy + prefetch. */
export function loadAttendanceEmployeeFormModal() {
  if (!attendanceEmployeeFormModalPromise) {
    attendanceEmployeeFormModalPromise = import("./AttendanceEmployeeFormModal");
  }
  return attendanceEmployeeFormModalPromise;
}
