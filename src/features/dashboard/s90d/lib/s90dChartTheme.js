/** Màu và hằng số dùng chung cho biểu đồ báo cáo S90D. */
export const S90D_CHART = Object.freeze({
  ok: "#10b981",
  okLight: "#6ee7b7",
  ng: "#ef4444",
  ngLight: "#fca5a5",
  total: "#6366f1",
  yield: "#0ea5e9",
  yieldTarget: "#94a3b8",
  grid: "#e2e8f0",
  axis: "#64748b",
  text: "#1e293b",
  muted: "#94a3b8",
  panelBg: "#ffffff",
  panelBorder: "#e2e8f0",
  tooltipBg: "#0f172a",
  process: {
    PRESS: "#4f46e5",
    HAIRLINE: "#7c3aed",
    ANODIZING: "#a855f7",
    ASSEMBLY: "#db2777",
  },
  defectPalette: [
    "#6366f1",
    "#8b5cf6",
    "#a855f7",
    "#d946ef",
    "#ec4899",
    "#f43f5e",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#14b8a6",
  ],
});

export function formatS90dChartQty(value, locale = "vi-VN") {
  return Number(value || 0).toLocaleString(locale);
}

export function formatS90dChartPct(value, locale = "vi-VN") {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0.0%";
  return `${num.toLocaleString(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

export function resolveS90dChartLocale(language) {
  return String(language ?? "").startsWith("ko") ? "ko-KR" : "vi-VN";
}
