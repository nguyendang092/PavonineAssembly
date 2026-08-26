/**
 * Compatibility entry — Vite/HMR có thể vẫn resolve path cũ sau khi tách folder.
 * Import mới: `@/features/attendance/attendanceTableRow`.
 */
export {
  default,
  getAttendanceGridColumnStart,
  cellClsForAttendanceTable,
  getAttendanceColWidthPercents,
  AttendanceTableColgroup,
  AttendanceTableThead,
} from "./attendanceTableRow/index.js";
