import { format, parseISO, getISOWeek } from "date-fns";

/**
 * Từ `weekData[selectedWeek]` → chartData + dataMap (logic giữ nguyên useEffect WorkplaceDashboard).
 */
export function buildChartFromWeekRows(selectedWeek, weekData) {
  if (!selectedWeek || !weekData[selectedWeek]) {
    return { chartData: null, dataMap: {} };
  }

  const [weekNum, year] = selectedWeek.split("_");

  const rows = weekData[selectedWeek].filter((r) => {
    if (!r.time_monthday) return false;
    try {
      const date = parseISO(r.time_monthday);
      const dateYear = date.getFullYear();
      const dateWeek = getISOWeek(date);
      return dateWeek.toString() === weekNum && dateYear.toString() === year;
    } catch {
      return false;
    }
  });

  const daysSet = new Set();
  rows.forEach((r) => r.time_monthday && daysSet.add(r.time_monthday));
  const days = Array.from(daysSet).sort((a, b) => new Date(a) - new Date(b));
  const areaSet = new Set();
  rows.forEach((r) => r.WorkplaceName && areaSet.add(r.WorkplaceName));
  const areas = Array.from(areaSet);
  const map = {};
  areas.forEach((area) => {
    map[area] = days.map(() => ({
      Day: { normal: 0, rework: 0, ng_normal: 0, ng_rework: 0 },
      Night: { normal: 0, rework: 0, ng_normal: 0, ng_rework: 0 },
    }));
  });

  rows.forEach((row) => {
    const dayIndex = days.indexOf(row.time_monthday);
    const area = row.WorkplaceName;
    const shift = row.WorkingLight || "Day";
    const val = Number(row.Total_Good) || 0;
    const ngVal = Number(row.Total_NG) || 0;
    const type = row.ReworkorNot === "Rework" ? "rework" : "normal";
    const ngType = "ng_" + type;

    if (dayIndex !== -1 && map[area]) {
      map[area][dayIndex][shift][type] = val;
      map[area][dayIndex][shift][ngType] = ngVal;
    }
  });

  if (map["CNC"]) {
    for (let i = 0; i < days.length; i++) {
      const currentDay = map["CNC"][i].Day;
      const nextNight =
        i + 1 < days.length
          ? map["CNC"][i + 1].Night
          : { normal: 0, rework: 0 };
      currentDay.normal += nextNight.normal;
      currentDay.rework += nextNight.rework;
    }
  }

  const filteredAreas = areas.filter((area) =>
    map[area].some(({ Day, Night }) => {
      const ok = Day.normal + Day.rework + Night.normal + Night.rework;
      const ng =
        (Day.ng_normal ?? 0) +
        (Day.ng_rework ?? 0) +
        (Night.ng_normal ?? 0) +
        (Night.ng_rework ?? 0);
      return ok > 0 || ng > 0;
    }),
  );

  const labels = days.map((d) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    try {
      const dateObj = parseISO(d);
      return format(dateObj, "yyyy-MM-dd");
    } catch {
      return d;
    }
  });

  return {
    chartData: { labels, areas: filteredAreas },
    dataMap: map,
  };
}
