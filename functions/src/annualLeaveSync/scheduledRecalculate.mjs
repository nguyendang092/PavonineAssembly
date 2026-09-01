import { persistAnnualLeaveYearFromAttendance } from "./reconcileYear.mjs";

export function resolveCalendarYearInTimeZone(
  date = new Date(),
  timeZone = "Asia/Ho_Chi_Minh",
) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const yearPart = parts.find((part) => part.type === "year");
  const year = Number(yearPart?.value);
  return Number.isFinite(year) ? year : date.getFullYear();
}

/**
 * Chạy «Tính lại» tự động lúc 00:00 — năm hiện tại theo giờ VN.
 */
export async function runScheduledAnnualLeaveRecalculate(
  db,
  {
    timeZone = "Asia/Ho_Chi_Minh",
    attendanceRoot = "attendance",
    updatedBy = "scheduled-daily",
  } = {},
) {
  const year = resolveCalendarYearInTimeZone(new Date(), timeZone);
  const result = await persistAnnualLeaveYearFromAttendance(db, {
    year,
    attendanceRoot,
    updatedBy,
    rebuildLeaveAgg: true,
  });

  return {
    year,
    timeZone,
    ...result,
  };
}
