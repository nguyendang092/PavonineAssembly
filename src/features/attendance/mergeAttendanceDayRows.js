import { isAttendanceDayMetaKey } from "./attendanceDayMeta";
import { sortEmployeesStableAsc } from "./attendanceListSort";
import { normalizeAttendanceDayRecord } from "./attendanceGioVaoTypeOptions";
import {
  ATTENDANCE_DAY_UI_ROW_KEYS,
  sanitizeAttendanceDayNodeForUi,
} from "@/utils/attendanceEmployeeRecord";

/** Trường ảnh hưởng hiển thị bảng — dùng so sánh giữ chỗ reference khi Firebase đổi 1 NV. */
const ROW_SNAPSHOT_KEYS = ["id", ...ATTENDANCE_DAY_UI_ROW_KEYS];

export function attendanceDayRowSnapshotEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  for (const k of ROW_SNAPSHOT_KEYS) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

/**
 * Parse `attendance/{ngày}` và giữ object cũ cho NV không đổi (giúp React.memo trên hàng).
 */
export function reconcileAttendanceDayRowsFromRaw(
  prevRows,
  rawData,
  options = {},
) {
  const seasonal = options.seasonal === true;
  const prev = prevRows || [];
  if (!rawData || typeof rawData !== "object") {
    return prev.length === 0 ? prev : [];
  }

  const prevById = new Map();
  for (const row of prev) {
    if (row?.id != null) prevById.set(row.id, row);
  }

  const arr = [];
  for (const [id, emp] of Object.entries(rawData)) {
    if (isAttendanceDayMetaKey(id)) continue;
    const next = normalizeAttendanceDayRecord(
      sanitizeAttendanceDayNodeForUi(emp, id),
    );
    const prior = prevById.get(id);
    arr.push(
      prior && attendanceDayRowSnapshotEqual(prior, next) ? prior : next,
    );
  }

  const sorted = sortEmployeesStableAsc(arr, { seasonal });
  arr.length = 0;
  arr.push(...sorted);

  if (
    prev.length === arr.length &&
    prev.every((row, index) => row === arr[index])
  ) {
    return prev;
  }

  return arr;
}

/**
 * Chỉ dùng trường điểm danh trên `attendance/{ngày}` — lọc bỏ trường hồ sơ / legacy gắn nhầm trên node.
 * Bỏ qua key meta ngày (`isAttendanceDayMetaKey`).
 */
export function mergeAttendanceDayRowsFromRaw(rawData, options = {}) {
  return reconcileAttendanceDayRowsFromRaw([], rawData, options);
}
