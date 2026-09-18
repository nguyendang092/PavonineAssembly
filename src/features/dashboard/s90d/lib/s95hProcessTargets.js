import { S95H_PROCESSES } from "./s90dManualEntryReportConfig";

export const S95H_PROCESS_DAILY_TARGETS = Object.freeze({
  PRESS: 120,
  MC: 120,
  HAIRLINE: 120,
  ANODIZING: 100,
  ASSEMBLY: 100,
});

export function resolveS95hProcessDailyTarget(process) {
  const key = String(process ?? "")
    .trim()
    .toUpperCase();
  return S95H_PROCESS_DAILY_TARGETS[key] ?? 0;
}

export function resolveS95hTargetQty(
  process,
  {
    dayCount = 1,
    isTotal = false,
    processes = S95H_PROCESSES,
  } = {},
) {
  const days = Math.max(1, Number(dayCount) || 1);
  if (isTotal) {
    const list = Array.isArray(processes) && processes.length
      ? processes
      : S95H_PROCESSES;
    return list.reduce(
      (sum, item) => sum + resolveS95hProcessDailyTarget(item) * days,
      0,
    );
  }
  return resolveS95hProcessDailyTarget(process) * days;
}

/** Hiệu suất = SL đạt / Mục tiêu * 100. Có thể > 100%. */
export function resolveS95hEfficiencyPct(okQty, targetQty) {
  const target = Number(targetQty);
  if (!target) return null;
  const raw = (Number(okQty) / target) * 100;
  if (!Number.isFinite(raw)) return null;
  return Math.round(raw * 10) / 10;
}

export function formatS95hEfficiencyPct(value) {
  if (value == null || value === "") return "-";
  return `${Number(value).toLocaleString("vi-VN")}%`;
}
