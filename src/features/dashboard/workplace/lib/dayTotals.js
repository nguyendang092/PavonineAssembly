import { format, parseISO } from "date-fns";

/** Lượng đạt (không gồm NG) theo ngày — đồng bộ logic CNC / ca. */
export function dayNormalTotal(area, dayArr, idx) {
  if (!dayArr?.[idx]) return 0;
  const { Day, Night } = dayArr[idx];
  if (area === "CNC") {
    return (Day?.normal ?? 0) + (Day?.rework ?? 0);
  }
  return (
    (Day?.normal ?? 0) +
    (Night?.normal ?? 0) +
    (Day?.rework ?? 0) +
    (Night?.rework ?? 0)
  );
}

/** Tổng NG theo ngày — cùng nguồn `bar` (Total_NG trong dataMap). */
export function dayNGTotal(area, dayArr, idx) {
  if (!dayArr?.[idx]) return 0;
  const { Day, Night } = dayArr[idx];
  if (area === "CNC") {
    return (Day?.ng_normal ?? 0) + (Day?.ng_rework ?? 0);
  }
  return (
    (Day?.ng_normal ?? 0) +
    (Night?.ng_normal ?? 0) +
    (Day?.ng_rework ?? 0) +
    (Night?.ng_rework ?? 0)
  );
}

export function formatDayLabelShort(d) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(d))) {
    try {
      return format(parseISO(d), "dd/MM");
    } catch {
      return d;
    }
  }
  try {
    return format(parseISO(d), "dd/MM");
  } catch {
    return String(d).slice(0, 10);
  }
}
