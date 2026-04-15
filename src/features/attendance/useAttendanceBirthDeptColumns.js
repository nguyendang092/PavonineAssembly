import { useSyncExternalStore } from "react";

/** Khớp Tailwind `xl` — từ 1280px đầy đủ cột (có ngày sinh + mã BP). */
export const ATTENDANCE_TABLE_XL_MIN = "(min-width: 1280px)";

const BP_HIDE_DEPT = 870;
const BP_MINIMAL = 820;

/**
 * @typedef {"full"|"compact"|"narrow"|"minimal"} AttendanceColumnPlan
 * - full: ≥1280 — đủ cột (gồm ngày sinh, mã BP, bộ phận).
 * - compact: 870–1279 — ẩn ngày sinh + mã BP; vẫn có bộ phận.
 * - narrow: 820–869 — thêm ẩn bộ phận.
 * - minimal: &lt;820 — chỉ MNV, họ tên, giờ vào, ca, (hành động).
 */
export function getAttendanceColumnPlanFromWidth(width) {
  if (width < BP_MINIMAL) return "minimal";
  if (width < BP_HIDE_DEPT) return "narrow";
  if (width < 1280) return "compact";
  return "full";
}

function subscribeResize(onStoreChange) {
  window.addEventListener("resize", onStoreChange);
  return () => window.removeEventListener("resize", onStoreChange);
}

function getWidthSnapshot() {
  return typeof window !== "undefined" ? window.innerWidth : 1280;
}

export function useAttendanceColumnPlan() {
  return useSyncExternalStore(
    subscribeResize,
    () => getAttendanceColumnPlanFromWidth(getWidthSnapshot()),
    () => getAttendanceColumnPlanFromWidth(1280),
  );
}

/** Chỉ true khi viewport ≥ xl (tương thích code cũ dùng tên hook này). */
export function useAttendanceBirthDeptColumns() {
  return useAttendanceColumnPlan() === "full";
}
