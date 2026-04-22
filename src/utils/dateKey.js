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

/** Hôm nay theo lịch máy (local), YYYY-MM-DD — dùng cho chuyên cần / báo cáo theo ngày hiện tại. */
export function getTodayDateKeyLocal() {
  return formatDateKeyLocal(new Date());
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

/** Cộng N ngày theo lịch local (dùng mặc định khoảng nghỉ dài). */
export function getDateKeyByAddDays(dateStr, daysForward = 1) {
  const date = parseLocalDateKey(dateStr);
  if (!date) {
    const fallback = new Date(dateStr);
    if (Number.isNaN(fallback.getTime())) {
      return String(dateStr).slice(0, 10);
    }
    fallback.setDate(fallback.getDate() + daysForward);
    return formatDateKeyLocal(fallback);
  }
  date.setDate(date.getDate() + daysForward);
  return formatDateKeyLocal(date);
}

/** Ngày đầu tháng (YYYY-MM-DD) theo một date key. */
export function getFirstDayOfMonthKey(dateKey) {
  const d = parseLocalDateKey(dateKey);
  if (!d) {
    const m = String(dateKey).match(/^(\d{4}-\d{2})/);
    return m ? `${m[1]}-01` : String(dateKey).slice(0, 10);
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Ngày cuối tháng (YYYY-MM-DD) theo một date key — cùng quy tắc local với `getFirstDayOfMonthKey`. */
export function getLastDayOfMonthKey(dateKey) {
  const d = parseLocalDateKey(dateKey);
  if (!d) {
    const m = String(dateKey).match(/^(\d{4})-(\d{2})/);
    if (!m) return String(dateKey ?? "").slice(0, 10);
    const y = Number(m[1]);
    const mo = Number(m[2]);
    if (!Number.isFinite(y) || !Number.isFinite(mo)) {
      return String(dateKey).slice(0, 10);
    }
    const last = new Date(y, mo, 0);
    return formatDateKeyLocal(last);
  }
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return formatDateKeyLocal(last);
}

/**
 * Liệt kê mọi YYYY-MM-DD từ fromKey đến toKey (bao gồm hai đầu), theo lịch local.
 * Trả về [] nếu sai định dạng hoặc from > to.
 */
export function enumerateDateKeysInclusive(fromKey, toKey) {
  const from = parseLocalDateKey(fromKey);
  const to = parseLocalDateKey(toKey);
  if (!from || !to) return [];
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  if (start.getTime() > end.getTime()) return [];
  const out = [];
  const cur = new Date(start);
  while (cur.getTime() <= end.getTime()) {
    out.push(formatDateKeyLocal(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}
