import { db, ref, get } from "@/services/firebase";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** @param {string} anchorYyyyMmDd */
export function dateKeysInMonth(anchorYyyyMmDd) {
  if (!anchorYyyyMmDd || !DATE_KEY.test(anchorYyyyMmDd)) return [];
  const [y, m] = anchorYyyyMmDd.split("-").map(Number);
  if (!y || !m) return [];
  const days = new Date(y, m, 0).getDate();
  const ms = String(m).padStart(2, "0");
  const out = [];
  for (let d = 1; d <= days; d++) {
    const ds = String(d).padStart(2, "0");
    out.push(`${y}-${ms}-${ds}`);
  }
  return out;
}

/**
 * Đọc ngày off / ngày lễ trong tháng (`_meta.isOffDay` / `_meta.isHolidayDay`).
 * @param {string} anchorYyyyMmDd
 * @returns {Promise<{ off: string[], holiday: string[] }>}
 */
export async function fetchOffAndHolidayDateKeysInMonth(anchorYyyyMmDd) {
  const keys = dateKeysInMonth(anchorYyyyMmDd);
  if (keys.length === 0) return { off: [], holiday: [] };
  const snaps = await Promise.all(
    keys.map((d) => get(ref(db, `attendance/${d}/_meta`))),
  );
  const off = [];
  const holiday = [];
  for (let i = 0; i < keys.length; i++) {
    const meta = snaps[i].val();
    if (!meta || typeof meta !== "object") continue;
    if (meta.isHolidayDay) holiday.push(keys[i]);
    else if (meta.isOffDay) off.push(keys[i]);
  }
  return { off: off.sort(), holiday: holiday.sort() };
}

/**
 * Đọc `attendance/{ngày}/_meta.isOffDay` cho tất cả ngày trong tháng của `anchorYyyyMmDd`.
 * @param {string} anchorYyyyMmDd — bất kỳ ngày YYYY-MM-DD trong tháng cần xem
 * @returns {Promise<string[]>} — các ngày có off, đã sort
 */
export async function fetchOffDayDateKeysInMonth(anchorYyyyMmDd) {
  const { off } = await fetchOffAndHolidayDateKeysInMonth(anchorYyyyMmDd);
  return off;
}

/**
 * Hiển thị gọn trên nút (cùng tháng → chỉ dd/mm; khác tháng → có năm).
 * @param {string[]} keys
 * @param {string} [locale="vi-VN"]
 */
export function formatOffDayDateKeysCompact(keys, locale = "vi-VN") {
  if (!keys.length) return "";
  const ym = keys[0].slice(0, 7);
  const allSameMonth = keys.every((k) => k.slice(0, 7) === ym);
  return keys
    .map((k) => {
      const [y, m, d] = k.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      if (allSameMonth) {
        return dt.toLocaleDateString(locale, {
          day: "2-digit",
          month: "2-digit",
        });
      }
      return dt.toLocaleDateString(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    })
    .join(", ");
}
