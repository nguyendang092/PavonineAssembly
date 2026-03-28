/**
 * Chuỗi YYYY-MM-DD từ <input type="date"> — không dùng new Date("YYYY-MM-DD") (parse UTC → lệch ngày theo múi giờ).
 */

export function parseLocalDateKey(dateStr) {
  const m = String(dateStr ?? "")
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (![y, mo, d].every((n) => Number.isFinite(n))) return null;
  const date = new Date(y, mo - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatDateKeyLocal(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Trừ N ngày theo lịch local (đúng “hôm qua” so với selectedDate). */
export function getDateKeyBySubtractDays(dateStr, daysBack = 1) {
  const date = parseLocalDateKey(dateStr);
  if (!date) {
    const fallback = new Date(dateStr);
    if (Number.isNaN(fallback.getTime())) {
      return String(dateStr).slice(0, 10);
    }
    fallback.setDate(fallback.getDate() - daysBack);
    return formatDateKeyLocal(fallback);
  }
  date.setDate(date.getDate() - daysBack);
  return formatDateKeyLocal(date);
}
