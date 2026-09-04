import {
  calculatePercentage,
  calculateTotal,
} from "@/utils/performanceChartData";

/** Command board palette — 60-30-10 */
export const PERF_THEME = {
  bg: "#0F1720",
  panel: "#16212C",
  panelHeader: "#1C2A37",
  border: "#2A3947",
  text: "#E9EEF2",
  textMuted: "#8CA0B0",
  accent: "#3FA9E0",
  good: "#3FBF7F",
  goodDim: "#1E3D32",
  warn: "#E0A83F",
  warnDim: "#3D3420",
  bad: "#E0623F",
  badDim: "#4A241E",
};

export function resolveAchievementStatus(pct) {
  const value = Number(pct);
  if (!Number.isFinite(value)) {
    return {
      level: "bad",
      labelKey: "performanceChart.statusBad",
      labelDefault: "Nguy cấp",
      color: PERF_THEME.bad,
      bg: PERF_THEME.badDim,
    };
  }
  if (value >= 100) {
    return {
      level: "good",
      labelKey: "performanceChart.statusGood",
      labelDefault: "Đạt tốt",
      color: PERF_THEME.good,
      bg: PERF_THEME.goodDim,
    };
  }
  if (value >= 75) {
    return {
      level: "warn",
      labelKey: "performanceChart.statusWarn",
      labelDefault: "Cần đẩy mạnh",
      color: PERF_THEME.warn,
      bg: PERF_THEME.warnDim,
    };
  }
  return {
    level: "bad",
    labelKey: "performanceChart.statusBad",
    labelDefault: "Nguy cấp",
    color: PERF_THEME.bad,
    bg: PERF_THEME.badDim,
  };
}

export function buildPerformanceKpiSummary(data, currentWeekNumber) {
  const prevWeek = Math.max(1, currentWeekNumber - 1);
  let pctSum = 0;
  let pctCount = 0;
  let goodTeams = 0;
  let cumulativeTotal = 0;
  let cumulativeTarget = 0;
  let weekTotal = 0;

  for (const row of data) {
    const total = calculateTotal(row, currentWeekNumber);
    const pct = Number(calculatePercentage(total, row.target));
    const weekVal = row.weeks[`W${prevWeek}`] || 0;

    cumulativeTotal += total;
    cumulativeTarget += Number(row.target) || 0;
    weekTotal += weekVal;

    if (Number.isFinite(pct)) {
      pctSum += pct;
      pctCount += 1;
      if (pct >= 100) goodTeams += 1;
    }
  }

  const avgPct = pctCount > 0 ? pctSum / pctCount : 0;

  return {
    prevWeek,
    avgPct,
    goodTeams,
    teamCount: data.length,
    cumulativeTotal,
    cumulativeTarget,
    weekTotal,
    avgStatus: resolveAchievementStatus(avgPct),
  };
}
