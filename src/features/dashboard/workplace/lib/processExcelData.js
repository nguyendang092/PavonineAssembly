import { parseISO } from "date-fns";
import { getCurrentWeekNumber } from "./constants";

/**
 * Nhóm dòng Excel/Firebase theo tuần_năm và chọn tuần mặc định (logic giữ nguyên WorkplaceDashboard).
 */
export function buildWeekDataFromRows(data, filterYear) {
  const grouped = {};

  data.forEach((row) => {
    let year = filterYear;
    if (row.Year) {
      year = Number(row.Year);
    } else if (row.time_monthday) {
      try {
        const date = parseISO(row.time_monthday);
        year = date.getFullYear();
      } catch {
        year = filterYear;
      }
    }

    if (year !== filterYear) return;

    const week = Number(row["Week"]);
    const weekYear = `${week}_${year}`;

    if (!grouped[weekYear]) grouped[weekYear] = [];
    grouped[weekYear].push(row);
  });

  const currentWeek = getCurrentWeekNumber();
  const defaultWeek = currentWeek;
  const defaultWeekKey = `${defaultWeek}_${filterYear}`;

  const weekKeys = Object.keys(grouped)
    .filter((k) => k.endsWith(`_${filterYear}`))
    .sort((a, b) => Number(a.split("_")[0]) - Number(b.split("_")[0]));

  let selectedWeekKey = defaultWeekKey;
  if (!grouped[defaultWeekKey] && weekKeys.length > 0) {
    selectedWeekKey = weekKeys[weekKeys.length - 1];
  }

  return { grouped, selectedWeekKey };
}
