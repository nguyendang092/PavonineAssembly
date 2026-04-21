import { isAttendanceDayMetaKey } from "./attendanceDayMeta";
import { sanitizeAttendanceDayNodeForUi } from "@/utils/employeeRosterRecord";

/**
 * Chỉ dùng trường điểm danh trên `attendance/{ngày}` — lọc bỏ trường hồ sơ / legacy gắn nhầm trên node.
 * Bỏ qua key meta ngày (`isAttendanceDayMetaKey`).
 */
export function mergeAttendanceDayRowsFromRaw(rawData) {
  if (!rawData || typeof rawData !== "object") return [];
  const arr = Object.entries(rawData)
    .filter(([id]) => !isAttendanceDayMetaKey(id))
    .map(([id, emp]) => sanitizeAttendanceDayNodeForUi(emp, id));
  arr.sort((a, b) => (a.stt || 0) - (b.stt || 0));
  return arr;
}
