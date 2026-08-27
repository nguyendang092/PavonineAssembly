import { eachDayOfInterval, endOfMonth, format, getDay } from "date-fns";
import {
  TEMPERATURE_METRIC_THRESHOLDS,
  TEMPERATURE_STATUS,
} from "./temperatureMonitorConstants";

export function listWorkingDaysInMonth(selectedMonth) {
  if (!selectedMonth) return [];
  const start = new Date(`${selectedMonth}-01`);
  if (Number.isNaN(start.getTime())) return [];
  return eachDayOfInterval({ start, end: endOfMonth(start) }).filter(
    (date) => getDay(date) !== 0,
  );
}

export function splitWorkingDays(days) {
  const firstHalf = [];
  const secondHalf = [];
  for (const date of days) {
    const dayNum = Number(format(date, "d"));
    if (dayNum <= 16) firstHalf.push(date);
    else secondHalf.push(date);
  }
  return { firstHalf, secondHalf };
}

export function evaluateMetricStatus(rawValue, { min, max, warnMargin = 0 }) {
  if (rawValue === "" || rawValue == null || rawValue === undefined) {
    return TEMPERATURE_STATUS.EMPTY;
  }
  const num = Number(rawValue);
  if (!Number.isFinite(num)) return TEMPERATURE_STATUS.EMPTY;
  if (num < min || num > max) return TEMPERATURE_STATUS.DANGER;
  if (num < min + warnMargin || num > max - warnMargin) {
    return TEMPERATURE_STATUS.WARN;
  }
  return TEMPERATURE_STATUS.OK;
}

export function evaluateDayStatus(temperatureValue, humidityValue) {
  const tempStatus = evaluateMetricStatus(
    temperatureValue,
    TEMPERATURE_METRIC_THRESHOLDS.temperature,
  );
  const humStatus = evaluateMetricStatus(
    humidityValue,
    TEMPERATURE_METRIC_THRESHOLDS.humidity,
  );
  const statuses = [tempStatus, humStatus];
  if (statuses.includes(TEMPERATURE_STATUS.DANGER)) {
    return TEMPERATURE_STATUS.DANGER;
  }
  if (statuses.includes(TEMPERATURE_STATUS.WARN)) {
    return TEMPERATURE_STATUS.WARN;
  }
  if (statuses.every((s) => s === TEMPERATURE_STATUS.EMPTY)) {
    return TEMPERATURE_STATUS.EMPTY;
  }
  if (statuses.includes(TEMPERATURE_STATUS.EMPTY)) {
    return TEMPERATURE_STATUS.EMPTY;
  }
  return TEMPERATURE_STATUS.OK;
}

export function metricGaugeRatio(rawValue, { min, max }) {
  const num = Number(rawValue);
  if (!Number.isFinite(num)) return 0;
  const span = max - min;
  if (span <= 0) return 0;
  return Math.max(0, Math.min(1, (num - min) / span));
}

export function countFilledDays(data) {
  const temp = data?.temperature ?? {};
  const hum = data?.humidity ?? {};
  const dayKeys = new Set([...Object.keys(temp), ...Object.keys(hum)]);
  let count = 0;
  for (const day of dayKeys) {
    const t = temp[day];
    const h = hum[day];
    if (
      (t !== "" && t != null && t !== undefined) ||
      (h !== "" && h != null && h !== undefined)
    ) {
      count += 1;
    }
  }
  return count;
}

export function summarizeMachineMonth(data, selectedMonth) {
  const days = listWorkingDaysInMonth(selectedMonth);
  let filled = 0;
  let alerts = 0;
  const alertRows = [];

  for (const date of days) {
    const day = format(date, "dd");
    const temp = data?.temperature?.[day];
    const hum = data?.humidity?.[day];
    const hasTemp = temp !== "" && temp != null && temp !== undefined;
    const hasHum = hum !== "" && hum != null && hum !== undefined;
    if (hasTemp || hasHum) filled += 1;

    const status = evaluateDayStatus(temp, hum);
    if (status === TEMPERATURE_STATUS.DANGER) {
      alerts += 1;
      if (alertRows.length < 5) {
        alertRows.push({
          day,
          dateKey: format(date, "yyyy-MM-dd"),
          temperature: temp,
          humidity: hum,
          status,
        });
      }
    } else if (
      status === TEMPERATURE_STATUS.WARN &&
      alertRows.length < 5
    ) {
      alertRows.push({
        day,
        dateKey: format(date, "yyyy-MM-dd"),
        temperature: temp,
        humidity: hum,
        status,
      });
    }
  }

  return { filled, alerts, alertRows };
}

export function computeMonthlyAverages(data, selectedMonth) {
  const days = listWorkingDaysInMonth(selectedMonth);
  let tempSum = 0;
  let tempCount = 0;
  let humSum = 0;
  let humCount = 0;

  for (const date of days) {
    const day = format(date, "dd");
    const t = Number(data?.temperature?.[day]);
    const h = Number(data?.humidity?.[day]);
    if (Number.isFinite(t)) {
      tempSum += t;
      tempCount += 1;
    }
    if (Number.isFinite(h)) {
      humSum += h;
      humCount += 1;
    }
  }

  return {
    temperature:
      tempCount > 0 ? Math.round((tempSum / tempCount) * 10) / 10 : null,
    humidity: humCount > 0 ? Math.round((humSum / humCount) * 10) / 10 : null,
  };
}

export function buildSparklineSeries(data, selectedMonth, maxPoints = 7) {
  const days = listWorkingDaysInMonth(selectedMonth);
  const filled = [];

  for (const date of days) {
    const day = format(date, "dd");
    const temp = data?.temperature?.[day];
    const hum = data?.humidity?.[day];
    if (
      (temp === "" || temp == null) &&
      (hum === "" || hum == null)
    ) {
      continue;
    }
    filled.push({
      day,
      date,
      temperature: temp,
      humidity: hum,
      status: evaluateDayStatus(temp, hum),
    });
  }

  return filled.slice(-maxPoints);
}

export function navBadgeForSummary({ filled, alerts }) {
  if (alerts > 0) return "alert";
  if (filled >= 2) return "done";
  return "todo";
}

export function validateMetricInput(val) {
  if (val === "") return true;
  const num = Number(val);
  if (Number.isNaN(num) || num < 0) return false;
  if (/\./.test(val)) {
    const [, decimal] = val.split(".");
    if (decimal && decimal.length > 2) return false;
  }
  return true;
}

export function countDirtyFields(baseline, draft) {
  let count = 0;
  for (const type of ["temperature", "humidity"]) {
    const base = baseline?.[type] ?? {};
    const next = draft?.[type] ?? {};
    const keys = new Set([...Object.keys(base), ...Object.keys(next)]);
    for (const day of keys) {
      if (String(base[day] ?? "") !== String(next[day] ?? "")) count += 1;
    }
  }
  return count;
}
