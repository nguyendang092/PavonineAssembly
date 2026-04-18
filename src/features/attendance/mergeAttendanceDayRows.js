import { isAttendanceDayMetaKey } from "./attendanceDayMeta";
import {
  mergeEmployeeProfileAndDay,
  employeeProfileStorageKeyFromMnv,
} from "@/utils/employeeRosterRecord";

/**
 * Gộp `attendance/{ngày}` (object) + map hồ sơ → mảng dòng đã sort STT.
 * Bỏ qua key meta ngày (`isAttendanceDayMetaKey`).
 */
export function mergeAttendanceDayRowsFromRaw(rawData, profMap) {
  if (!rawData || typeof rawData !== "object") return [];
  const arr = Object.entries(rawData)
    .filter(([id]) => !isAttendanceDayMetaKey(id))
    .map(([id, emp]) => {
      const pk = employeeProfileStorageKeyFromMnv(emp?.mnv);
      const prof = pk ? profMap[pk] : null;
      return mergeEmployeeProfileAndDay({ ...emp, id }, prof, null);
    });
  arr.sort((a, b) => (a.stt || 0) - (b.stt || 0));
  return arr;
}
