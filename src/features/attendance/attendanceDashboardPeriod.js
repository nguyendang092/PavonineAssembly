import {
  enumerateDateKeysInclusive,
  getDateKeyByAddDays,
  getFirstDayOfMonthKey,
  getLastDayOfMonthKey,
  parseLocalDateKey,
} from "@/utils/dateKey";

export const DASHBOARD_PERIOD_DAY = "day";
export const DASHBOARD_PERIOD_WEEK = "week";
export const DASHBOARD_PERIOD_MONTH = "month";
export const DASHBOARD_PERIOD_YEAR = "year";

export const DASHBOARD_PERIOD_IDS = [
  DASHBOARD_PERIOD_DAY,
  DASHBOARD_PERIOD_WEEK,
  DASHBOARD_PERIOD_MONTH,
  DASHBOARD_PERIOD_YEAR,
];

function formatDateKeyLocal(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Tuần ISO: thứ Hai → Chủ nhật. */
export function getWeekStartKey(dateKey) {
  const d = parseLocalDateKey(dateKey);
  if (!d) return String(dateKey).slice(0, 10);
  const weekday = d.getDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  d.setDate(d.getDate() + mondayOffset);
  return formatDateKeyLocal(d);
}

export function getWeekEndKey(dateKey) {
  const start = parseLocalDateKey(getWeekStartKey(dateKey));
  if (!start) return String(dateKey).slice(0, 10);
  start.setDate(start.getDate() + 6);
  return formatDateKeyLocal(start);
}

export function getYearStartKey(dateKey) {
  const d = parseLocalDateKey(dateKey);
  if (!d) {
    const y = String(dateKey).slice(0, 4);
    return `${y}-01-01`;
  }
  return `${d.getFullYear()}-01-01`;
}

export function getYearEndKey(dateKey) {
  const d = parseLocalDateKey(dateKey);
  if (!d) {
    const y = String(dateKey).slice(0, 4);
    return `${y}-12-31`;
  }
  return `${d.getFullYear()}-12-31`;
}

export function normalizeDashboardPeriod(raw) {
  const p = String(raw ?? "").trim().toLowerCase();
  return DASHBOARD_PERIOD_IDS.includes(p) ? p : DASHBOARD_PERIOD_DAY;
}

/** Khoảng ngày (bao gồm hai đầu) cho kỳ báo cáo. */
export function getDashboardPeriodRange(period, anchorDateKey) {
  const p = normalizeDashboardPeriod(period);
  switch (p) {
    case DASHBOARD_PERIOD_WEEK:
      return {
        from: getWeekStartKey(anchorDateKey),
        to: getWeekEndKey(anchorDateKey),
      };
    case DASHBOARD_PERIOD_MONTH:
      return {
        from: getFirstDayOfMonthKey(anchorDateKey),
        to: getLastDayOfMonthKey(anchorDateKey),
      };
    case DASHBOARD_PERIOD_YEAR:
      return {
        from: getYearStartKey(anchorDateKey),
        to: getYearEndKey(anchorDateKey),
      };
    default:
      return { from: anchorDateKey, to: anchorDateKey };
  }
}

export function listDashboardPeriodDateKeys(period, anchorDateKey) {
  const { from, to } = getDashboardPeriodRange(period, anchorDateKey);
  return enumerateDateKeysInclusive(from, to);
}

/** Ngày cần tải Firebase (kỳ + xu hướng). */
export function listDashboardFetchDateKeys(period, anchorDateKey) {
  const periodKeys = listDashboardPeriodDateKeys(period, anchorDateKey);
  const trendKeys = listDashboardTrendDateKeys(period, anchorDateKey);
  return [...new Set([...periodKeys, ...trendKeys])].sort();
}

/** 7 ngày liên tiếp bắt đầu từ ngày được chọn (dùng cho biểu đồ xu hướng). */
function listSevenDaysFromAnchor(anchorDateKey) {
  const keys = [];
  for (let i = 0; i <= 6; i += 1) {
    keys.push(getDateKeyByAddDays(anchorDateKey, i));
  }
  return keys;
}

export function listDashboardTrendDateKeys(period, anchorDateKey) {
  const p = normalizeDashboardPeriod(period);
  if (p === DASHBOARD_PERIOD_DAY || p === DASHBOARD_PERIOD_WEEK) {
    return listSevenDaysFromAnchor(anchorDateKey);
  }
  return listDashboardPeriodDateKeys(period, anchorDateKey);
}

function formatShortDayLabel(dateKey, locale = "vi-VN") {
  const d = parseLocalDateKey(dateKey);
  if (!d) return dateKey.slice(5);
  return d.toLocaleDateString(locale, { weekday: "short", day: "2-digit" });
}

function formatMonthLabel(monthKey, locale = "vi-VN") {
  const d = parseLocalDateKey(`${monthKey}-01`);
  if (!d) return monthKey;
  return d.toLocaleDateString(locale, { month: "short", year: "2-digit" });
}

function formatWeekLabel(weekStartKey, locale = "vi-VN") {
  const start = parseLocalDateKey(weekStartKey);
  if (!start) return weekStartKey.slice(5);
  const end = parseLocalDateKey(getWeekEndKey(weekStartKey));
  const fmt = (d) =>
    d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit" });
  return end ? `${fmt(start)}–${fmt(end)}` : fmt(start);
}

function sumTrendRows(rows) {
  return rows.reduce(
    (acc, row) => ({
      onTime: acc.onTime + (row.onTime ?? 0),
      late: acc.late + (row.late ?? 0),
      onLeave: acc.onLeave + (row.onLeave ?? 0),
      absent: acc.absent + (row.absent ?? 0),
      total: acc.total + (row.total ?? 0),
    }),
    { onTime: 0, late: 0, onLeave: 0, absent: 0, total: 0 },
  );
}

function groupDailyByWeek(dailySummaries) {
  const map = new Map();
  for (const row of dailySummaries) {
    const weekStart = getWeekStartKey(row.dateKey);
    if (!map.has(weekStart)) map.set(weekStart, []);
    map.get(weekStart).push(row);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, rows]) => ({
      dateKey: weekStart,
      ...sumTrendRows(rows),
    }));
}

function groupDailyByMonth(dailySummaries) {
  const map = new Map();
  for (const row of dailySummaries) {
    const monthKey = row.dateKey.slice(0, 7);
    if (!map.has(monthKey)) map.set(monthKey, []);
    map.get(monthKey).push(row);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, rows]) => ({
      dateKey: `${monthKey}-01`,
      ...sumTrendRows(rows),
    }));
}

/**
 * @param {Array<{ dateKey: string, onTime: number, late: number, onLeave: number, absent: number, total: number }>} dailySummaries
 */
export function buildDashboardTrendPoints(
  period,
  anchorDateKey,
  dailySummaries,
  locale = "vi-VN",
) {
  const p = normalizeDashboardPeriod(period);
  const byDate = new Map(dailySummaries.map((row) => [row.dateKey, row]));

  if (p === DASHBOARD_PERIOD_DAY) {
    const keys = listDashboardTrendDateKeys(p, anchorDateKey);
    return keys.map((dateKey) => {
      const row = byDate.get(dateKey) ?? {
        onTime: 0,
        late: 0,
        onLeave: 0,
        absent: 0,
        total: 0,
      };
      return {
        dateKey,
        label: formatShortDayLabel(dateKey, locale),
        onTime: row.onTime,
        late: row.late,
        onLeave: row.onLeave,
        absent: row.absent,
        total: row.total,
      };
    });
  }

  const periodKeys = listDashboardPeriodDateKeys(p, anchorDateKey);
  const periodRows = periodKeys.map(
    (dateKey) =>
      byDate.get(dateKey) ?? {
        dateKey,
        onTime: 0,
        late: 0,
        onLeave: 0,
        absent: 0,
        total: 0,
      },
  );

  if (p === DASHBOARD_PERIOD_WEEK) {
    const keys = listDashboardTrendDateKeys(p, anchorDateKey);
    return keys.map((dateKey) => {
      const row = byDate.get(dateKey) ?? {
        onTime: 0,
        late: 0,
        onLeave: 0,
        absent: 0,
        total: 0,
      };
      return {
        dateKey,
        label: formatShortDayLabel(dateKey, locale),
        onTime: row.onTime,
        late: row.late,
        onLeave: row.onLeave,
        absent: row.absent,
        total: row.total,
      };
    });
  }

  if (p === DASHBOARD_PERIOD_MONTH) {
    return groupDailyByWeek(periodRows).map((row) => ({
      dateKey: row.dateKey,
      label: formatWeekLabel(row.dateKey, locale),
      onTime: row.onTime,
      late: row.late,
      onLeave: row.onLeave,
      absent: row.absent,
      total: row.total,
    }));
  }

  return groupDailyByMonth(periodRows).map((row) => ({
    dateKey: row.dateKey,
    label: formatMonthLabel(row.dateKey.slice(0, 7), locale),
    onTime: row.onTime,
    late: row.late,
    onLeave: row.onLeave,
    absent: row.absent,
    total: row.total,
  }));
}

export function flattenPersonDayEmployees(dayResults) {
  const rows = [];
  for (const day of dayResults) {
    for (const emp of day.employees) {
      rows.push({ ...emp, _dashboardDate: day.dateKey });
    }
  }
  return rows;
}

export function dedupeRosterEmployees(dayResults) {
  const byKey = new Map();
  for (const day of dayResults) {
    for (const emp of day.employees) {
      const mnv = String(emp.mnv ?? "").trim();
      const key = mnv || `${String(emp.hoVaTen ?? "").trim()}-${day.dateKey}`;
      const prev = byKey.get(key);
      if (!prev || day.dateKey >= prev.dateKey) {
        byKey.set(key, { dateKey: day.dateKey, emp });
      }
    }
  }
  return Array.from(byKey.values()).map((row) => row.emp);
}

export function formatDashboardPeriodLabel(
  period,
  anchorDateKey,
  locale = "vi-VN",
) {
  const p = normalizeDashboardPeriod(period);
  const { from, to } = getDashboardPeriodRange(p, anchorDateKey);
  const fmt = (key) => {
    const d = parseLocalDateKey(key);
    if (!d) return key;
    return d.toLocaleDateString(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };
  if (from === to) return fmt(from);
  return `${fmt(from)} – ${fmt(to)}`;
}
