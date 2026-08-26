import { endAt, get, query, orderByKey, ref, startAt } from "@/services/firebase";

/** `yyyy-mm` từ `yyyy-mm-dd`. */
export function resolveYearMonthFromDateKey(dateKey) {
  if (!dateKey || typeof dateKey !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  return dateKey.slice(0, 7);
}

/** Khoảng ngày RTDB cho một tháng lịch. */
export function resolveYearMonthDateRange(yearMonth) {
  const text = String(yearMonth ?? "").trim();
  const match = text.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;

  const y = Number(match[1]);
  const mo = Number(match[2]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) {
    return null;
  }

  const lastDay = new Date(y, mo, 0).getDate();
  return {
    startAt: `${text}-01`,
    endAt: `${text}-${String(lastDay).padStart(2, "0")}`,
  };
}

/** Query attendance theo tháng — ~28–31 node ngày, không cả năm. */
export async function loadAttendanceRootForYearMonth(
  db,
  attendanceRootPath,
  yearMonth,
) {
  const range = resolveYearMonthDateRange(yearMonth);
  if (!range) return null;

  const snap = await get(
    query(
      ref(db, attendanceRootPath),
      orderByKey(),
      startAt(range.startAt),
      endAt(range.endAt),
    ),
  );
  return snap.val();
}

/** Một ngày điểm danh — O(1) node ngày. */
export async function loadAttendanceDaySnapshot(
  db,
  attendanceRootPath,
  dateKey,
) {
  if (!dateKey) return null;
  const snap = await get(ref(db, `${attendanceRootPath}/${dateKey}`));
  return snap.val();
}
