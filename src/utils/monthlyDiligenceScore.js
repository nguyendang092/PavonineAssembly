/**
 * Điểm chuyên cần tháng (%) — theo ngày đang xem trên Điểm danh.
 * Rule mặc định (chỉnh hằng số bên dưới cho khớp quy định công ty):
 * - Ngày kỳ vọng đi làm: Thứ 2 → Thứ 6; Chủ nhật nghỉ; Thứ 7 chỉ tính sau khi loại EXTRA_SATURDAYS_OFF_PER_MONTH
 *   ngày Thứ 7 đầu tiên trong tháng (nghỉ bổ sung theo lịch công ty).
 * - Chỉ tính các ngày từ ngày vào làm (hồ sơ) đến ngày nghỉ việc (nếu có) và không vượt quá
 *   “cuối kỳ tính”: tháng đã qua → hết tháng đó; tháng hiện tại → đến hôm nay (không tính trước ngày chưa tới).
 * - Ngày nghỉ thai sản (TS trong giờ vào / cờ combo): không đưa vào chuyên cần (bỏ qua, không mẫu không tử).
 * - Điểm/ngày: PN, PO, TN đủ chuẩn; KL/KP/vắng khác; trễ giảm hệ số; v.v.
 * - Đi trễ (VT / VÀO TRỄ) = hệ số DAY_SCORE_LATE.
 * - Có dữ liệu nhẹ (có ca / ghi chú giờ vào nhưng không parse được check-in) = DAY_SCORE_PARTIAL.
 * - Vắng không lý do = 0.
 * - Gợi ý OT: cột chấm công có “OT” / “TĂNG CA” → cộng thêm OT_DAY_BONUS (trần 1/ngày).
 */

import { parseLocalDateKey } from "@/utils/dateKey";
import {
  normalizeDateForHtmlInput,
  canonicalAttendanceMnvForMatch,
} from "@/utils/employeeRosterRecord";
import {
  getAttendanceComboFlags,
  normalizeTextValue,
  isMaternityForDiligenceRow,
} from "@/features/attendance/attendanceComboStats";

/** 0–1: hệ số một ngày khi đi trễ nhưng vẫn có mặt */
export const DAY_SCORE_LATE = 0.92;
/** 0–1: có ca / ghi giờ vào nhưng không nhận diện check-in chuẩn */
export const DAY_SCORE_PARTIAL = 0.85;
/** Cộng tối đa mỗi ngày khi có dấu hiệu tăng ca (không vượt 1) */
export const OT_DAY_BONUS = 0.03;

/**
 * Số ngày Thứ 7 trong tháng được coi là nghỉ thêm (không vào mẫu số chuyên cần).
 * Mặc định: 2 Thứ 7 đầu tiên theo lịch tháng — chỉnh nếu HR quy định khác.
 */
export const EXTRA_SATURDAYS_OFF_PER_MONTH = 2;

/**
 * Các YYYY-MM-DD là Thứ 7 và thuộc nhóm “nghỉ thêm” (bỏ khỏi ngày làm kỳ vọng).
 * `monthDateKeys` nên đã sắp xếp tăng dần (như getMonthDateKeysInclusive).
 */
export function getExtraOffSaturdayKeysInMonth(monthDateKeys) {
  const saturdays = (monthDateKeys || []).filter((k) => {
    const d = parseLocalDateKey(k);
    return d && d.getDay() === 6;
  });
  return new Set(saturdays.slice(0, EXTRA_SATURDAYS_OFF_PER_MONTH));
}

/**
 * @param {string} ymd
 * @param {Set<string>} [extraOffSaturdayKeys] — từ getExtraOffSaturdayKeysInMonth; nếu không truyền, mọi Thứ 7 đều là ngày làm (hành vi cũ).
 */
export function isExpectedWorkdayDateKey(ymd, extraOffSaturdayKeys) {
  const d = parseLocalDateKey(ymd);
  if (!d) return false;
  const dow = d.getDay();
  if (dow === 0) return false;
  if (dow === 6) {
    if (extraOffSaturdayKeys?.has(ymd)) return false;
    return true;
  }
  return dow >= 1 && dow <= 5;
}

/**
 * Ngày cuối đưa vào mẫu số chuyên cần (YYYY-MM-DD).
 * Tháng tương lai so với hôm nay → null (không hiển thị %).
 */
export function getMonthlyDiligencePeriodEndKey(selectedYmd, todayYmdLocal) {
  const monthKeys = getMonthDateKeysInclusive(selectedYmd);
  if (!monthKeys.length) return null;
  const selFirst = monthKeys[0];
  const selLast = monthKeys[monthKeys.length - 1];
  const t = String(todayYmdLocal ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  if (t < selFirst) return null;
  if (t > selLast) return selLast;
  return t;
}

export function getMonthDateKeysInclusive(selectedYmd) {
  const d = parseLocalDateKey(selectedYmd);
  if (!d) return [];
  const y = d.getFullYear();
  const m = d.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  const out = [];
  for (let day = 1; day <= lastDay; day++) {
    const mm = String(m + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    out.push(`${y}-${mm}-${dd}`);
  }
  return out;
}

export function findEmpDayRow(dayRoot, empId, mnvRaw) {
  if (!dayRoot || typeof dayRoot !== "object") return null;
  if (dayRoot[empId]) return dayRoot[empId];
  const target = canonicalAttendanceMnvForMatch(mnvRaw);
  if (!target) return null;
  for (const [, row] of Object.entries(dayRoot)) {
    if (!row || typeof row !== "object") continue;
    if (canonicalAttendanceMnvForMatch(row.mnv) === target) return row;
  }
  return null;
}

function hasOvertimeHint(empLike) {
  const c = normalizeTextValue(empLike?.chamCong)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  if (!c) return false;
  return c.includes("OT") || c.includes("TANG CA") || c.includes("TC ");
}

/**
 * Điểm 0–1 cho một ngày (đã là ngày làm việc kỳ vọng).
 * @returns {{ score: number, absent: boolean, late: boolean }}
 */
export function scoreSingleWorkday(empLike) {
  const flags = getAttendanceComboFlags(empLike);
  const gio = normalizeTextValue(empLike?.gioVao);
  const hasCa = normalizeTextValue(empLike?.caLamViec) !== "";

  if (flags.resignedLeave) {
    return { score: 0, absent: true, late: false };
  }

  /** Thai sản (giờ vào / PN / chấm công ngày) — không tính điểm nếu lọt vào scoring. */
  if (isMaternityForDiligenceRow(empLike)) {
    return { score: 0, absent: false, late: false };
  }

  /** Nghỉ có phép / bệnh / TNLD — tính đủ điểm ngày (chỉnh theo quy định công ty). */
  const authorizedLeave =
    flags.annualLeave ||
    flags.laborAccident ||
    flags.sickLeave ||
    flags.funeralLeave ||
    flags.weddingLeave ||
    flags.recuperationLeave;

  /** KL / KP: không tính như ngày đạt chuẩn (có thể đổi hằng số nếu HR quy định khác). */
  if (flags.unpaidLeave || flags.noPermit) {
    return { score: 0, absent: true, late: false };
  }

  if (authorizedLeave) {
    let s = 1;
    if (hasOvertimeHint(empLike)) s = Math.min(1, s + OT_DAY_BONUS);
    return { score: s, absent: false, late: false };
  }

  if (flags.checkedIn) {
    let s = flags.late ? DAY_SCORE_LATE : 1;
    if (hasOvertimeHint(empLike)) s = Math.min(1, s + OT_DAY_BONUS);
    return { score: s, absent: false, late: !!flags.late };
  }

  if (hasCa || gio) {
    return {
      score: DAY_SCORE_PARTIAL,
      absent: false,
      late: false,
    };
  }

  return { score: 0, absent: true, late: false };
}

/**
 * @param {Map<string, object|null>} attendanceByDateKey — attendance/{ngày} snapshot (thiếu key = không có dữ liệu)
 * @param {object} emp — hàng merge (id, mnv, ngayVaoLam, trangThaiLamViec, ngayNghiViec)
 * @param {string[]} monthDateKeys — mọi YYYY-MM-DD trong tháng (vd. getMonthDateKeysInclusive)
 * @param {string|null} periodEndKey — chỉ tính ngày làm việc có dk <= key này (getMonthlyDiligencePeriodEndKey)
 * @returns {{ percent: number, expectedDays: number, absentDays: number, lateDays: number } | null}
 */
export function computeEmployeeMonthDiligence(
  attendanceByDateKey,
  emp,
  monthDateKeys,
  periodEndKey,
) {
  if (!monthDateKeys?.length || !periodEndKey) return null;

  const joinKey =
    normalizeDateForHtmlInput(emp.ngayVaoLam ?? emp.joinDate ?? "") || "";
  const resignKey =
    String(emp.trangThaiLamViec ?? "").trim() === "nghi_viec"
      ? normalizeDateForHtmlInput(emp.ngayNghiViec ?? "") || ""
      : "";

  let weighted = 0;
  let denom = 0;
  let absentDays = 0;
  let lateDays = 0;

  const extraOffSaturdayKeys = getExtraOffSaturdayKeysInMonth(monthDateKeys);

  for (const dk of monthDateKeys) {
    if (dk > periodEndKey) continue;
    if (!isExpectedWorkdayDateKey(dk, extraOffSaturdayKeys)) continue;
    if (joinKey && dk < joinKey) continue;
    if (resignKey && dk > resignKey) continue;

    const root = attendanceByDateKey.get(dk);
    const row = findEmpDayRow(root, emp.id, emp.mnv);
    if (row && isMaternityForDiligenceRow(row)) {
      continue;
    }
    denom += 1;
    if (!row) {
      absentDays += 1;
      continue;
    }
    const { score, absent, late } = scoreSingleWorkday(row);
    weighted += score;
    if (absent) absentDays += 1;
    if (late) lateDays += 1;
  }

  if (denom === 0) return null;

  const ratio = weighted / denom;
  let percent = Math.round(ratio * 1000) / 10;
  percent = Math.min(100, Math.max(0, percent));

  /** Đủ mọi ngày làm việc kỳ vọng, không vắng, không trễ → 100% */
  if (denom > 0 && absentDays === 0 && lateDays === 0 && ratio >= 0.999) {
    percent = 100;
  }

  return {
    percent,
    expectedDays: denom,
    absentDays,
    lateDays,
  };
}
