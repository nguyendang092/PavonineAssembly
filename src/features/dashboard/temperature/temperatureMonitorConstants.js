/** Ngưỡng cho phép — đồng bộ ChartView. */
export const TEMPERATURE_METRIC_THRESHOLDS = {
  temperature: { min: 17, max: 28, unit: "°C", warnMargin: 1 },
  humidity: { min: 40, max: 75, unit: "%", warnMargin: 3 },
};

export const TEMPERATURE_STATUS = {
  OK: "ok",
  WARN: "warn",
  DANGER: "danger",
  EMPTY: "empty",
};
