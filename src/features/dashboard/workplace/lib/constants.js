import { getISOWeek } from "date-fns";

/** Tuần ISO (khớp cột Week / `getISOWeek` khi lọc dòng) — không dùng tuần “từ 1/1” vì lệch số với dữ liệu. */
export function getCurrentWeekNumber() {
  return getISOWeek(new Date());
}

export const WORKPLACE_YEAR_OPTIONS = [2026, 2025, 2024, 2023];
