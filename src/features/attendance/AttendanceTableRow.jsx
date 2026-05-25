/**
 * Compatibility entry for stale Vite/browser module graphs.
 *
 * New code should import from `@/features/attendance/attendanceTableRow`.
 */
export {
  default,
  ATTENDANCE_VIRTUAL_THRESHOLD,
  getAttendanceGridColumnStart,
  cellClsForAttendanceTable,
  getAttendanceColWidthPercents,
  getAttendanceGridTemplateColumns,
  AttendanceTableColgroup,
  AttendanceVirtualHeader,
  AttendanceTableThead,
} from "./attendanceTableRow/index.js";

