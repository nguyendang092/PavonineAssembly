/** Telemetry lưới tháng — gọi analytics nếu có, dev: console.debug. */

function emit(eventName, payload) {
  try {
    if (typeof globalThis?.analytics?.track === "function") {
      globalThis.analytics.track(eventName, payload);
      return;
    }
  } catch {
    /* ignore */
  }
  if (import.meta.env?.DEV) {
    console.debug(`[payroll-month] ${eventName}`, payload);
  }
}

export function trackMonthLoad(payload) {
  emit("payroll_month_load", { ...payload, timestamp: Date.now() });
}

export function trackDayPatch(payload) {
  emit("payroll_day_patch", { ...payload, timestamp: Date.now() });
}
