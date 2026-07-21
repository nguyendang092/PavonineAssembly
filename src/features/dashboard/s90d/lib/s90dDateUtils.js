import { format, getDaysInMonth, parseISO } from "date-fns";

export function normalizeDateKey(raw) {
  const text = String(raw ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  try {
    return format(parseISO(text), "yyyy-MM-dd");
  } catch {
    return text;
  }
}

export function formatS90dDailyDateLabel(dateKey) {
  try {
    return format(parseISO(dateKey), "MM월 dd일");
  } catch {
    return dateKey;
  }
}

export function formatS90dMonthLabel(referenceDate = new Date()) {
  return format(referenceDate, "yyyy-MM");
}

export function parseMonthKey(monthKey) {
  const [year, month] = String(monthKey ?? "").split("-").map(Number);
  return { year, month: month - 1 };
}

export function formatS90dMonthDisplayLabel(monthKey) {
  const { year, month } = parseMonthKey(monthKey);
  const mm = String(month + 1).padStart(2, "0");
  return `${mm}/${year}`;
}

/** Các ngày trong tháng đã chọn; tháng hiện tại chỉ đến hôm nay. */
export function listMonthDateKeys(monthKey, referenceDate = new Date()) {
  const { year, month } = parseMonthKey(monthKey);
  const daysInMonth = getDaysInMonth(new Date(year, month, 1));
  const isCurrentMonth =
    year === referenceDate.getFullYear() && month === referenceDate.getMonth();
  const lastDay = isCurrentMonth ? referenceDate.getDate() : daysInMonth;

  return Array.from({ length: lastDay }, (_, index) =>
    format(new Date(year, month, index + 1), "yyyy-MM-dd"),
  );
}

/** Tháng có trong localStorage + tháng hiện tại, mới nhất trước. */
export function listMonthKeysFromStore(store, referenceDate = new Date()) {
  const keys = new Set([formatS90dMonthLabel(referenceDate)]);

  for (const dateKey of Object.keys(store ?? {})) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      keys.add(dateKey.slice(0, 7));
    }
  }

  return Array.from(keys).sort((a, b) => b.localeCompare(a));
}

/** Các ngày từ mùng 1 tháng hiện tại → hôm nay (không tạo ngày tương lai). */
export function listCurrentMonthDateKeys(referenceDate = new Date()) {
  return listMonthDateKeys(formatS90dMonthLabel(referenceDate), referenceDate);
}

/** Ngày mặc định khi mở tab công đoạn: hôm nay nếu thuộc tháng, không thì ngày cuối. */
export function pickDefaultDateKey(monthDayKeys, referenceDate = new Date()) {
  if (!monthDayKeys?.length) {
    return format(referenceDate, "yyyy-MM-dd");
  }
  const today = format(referenceDate, "yyyy-MM-dd");
  if (monthDayKeys.includes(today)) return today;
  return monthDayKeys[monthDayKeys.length - 1];
}

export function clampDateKeyToMonth(dateKey, monthDayKeys) {
  if (!monthDayKeys?.length) return dateKey;
  if (monthDayKeys.includes(dateKey)) return dateKey;
  return pickDefaultDateKey(monthDayKeys);
}

export function formatS90dPickerDateLabel(dateKey) {
  try {
    return format(parseISO(dateKey), "dd/MM/yyyy");
  } catch {
    return dateKey;
  }
}
