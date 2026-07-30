/**
 * Compatibility entry for stale Vite/browser module graphs.
 *
 * New code should import from `@/features/attendance/attendanceTableRow`.
 */
export {
  default,
  getAttendanceGridColumnStart,
  cellClsForAttendanceTable,
  getAttendanceColWidthPercents,
  AttendanceTableColgroup,
  AttendanceTableThead,
} from "./attendanceTableRow/index.js";
