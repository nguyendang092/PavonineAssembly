import { pickAttendanceEmployeeDayFields } from "@/features/attendance/attendanceEmployeeFields";
import { normalizeDateForHtmlInput } from "@/utils/attendanceEmployeeRecord";

const ISO_PROFILE_DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoProfileDateKey(key) {
  return ISO_PROFILE_DATE_KEY_RE.test(String(key ?? "").trim());
}

function inferYearFromMonthKeys(monthKeys) {
  const dk = monthKeys?.[0];
  if (!dk || dk.length < 4) return null;
  const y = Number(dk.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

/**
 * Chuẩn hóa ngày hồ sơ → `YYYY-MM-DD` để so sánh với `dateKey` lưới tháng.
 * Hỗ trợ `9/7/2026`, `16/7/2026`; không trả chuỗi lỗi kiểu `16/7/2026`.
 */
export function normalizePayrollProfileDateKey(raw, monthKeys = []) {
  const s = String(raw ?? "").trim();
  if (!s) return "";

  const direct = normalizeDateForHtmlInput(s);
  if (direct && isIsoProfileDateKey(direct)) return direct;

  const year = inferYearFromMonthKeys(monthKeys);
  if (!year) return direct && isIsoProfileDateKey(direct) ? direct : "";

  const slash = s.match(/^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2}|\d{4}))?$/);
  if (!slash) return direct && isIsoProfileDateKey(direct) ? direct : "";

  const p1 = Number(slash[1]);
  const p2 = Number(slash[2]);
  let y = year;
  if (slash[3]) {
    const yStr = slash[3];
    y =
      yStr.length === 2
        ? Number(yStr) <= 50
          ? 2000 + Number(yStr)
          : 1900 + Number(yStr)
        : Number(yStr);
  }

  let day = p1;
  let month = p2;
  if (p1 > 12) {
    day = p1;
    month = p2;
  } else if (p2 > 12) {
    day = p2;
    month = p1;
  }

  const pad = (n) => String(n).padStart(2, "0");
  const norm = normalizeDateForHtmlInput(`${y}-${pad(month)}-${pad(day)}`);
  return norm && isIsoProfileDateKey(norm) ? norm : "";
}

/**
 * Khóa trường RTDB / Excel — giữ nguyên (dữ liệu lưu trữ).
 * Dùng hằng để tránh nhầm tên biến tiếng Việt khi đọc/ghi bản ghi.
 */
export const PAYROLL_EMP = {
  STT: "stt",
  MNV: "mnv",
  MVT: "mvt",
  EMPLOYEE_NAME: "hoVaTen",
  GENDER: "gioiTinh",
  DEPT_CODE: "maBoPhan",
  DEPARTMENT: "boPhan",
  JOIN_DATE: "ngayVaoLam",
  CONTRACT_DATE: "ngayHopDong",
  TIME_IN: "gioVao",
  TIME_OUT: "gioRa",
  LUNCH_OT_HOURS: "tangCaTrua",
  /** Phút TC tài xế nhập thủ công — quy đổi tỷ lệ phút/60, cộng vào TC ca ngày. */
  DRIVER_OT_MINUTES: "tangCaTaiXePhut",
  SHIFT: "caLamViec",
  LEAVE_TYPE: "loaiPhep",
  COMP_LEAVE_ALLOWED: "duocNghiBu",
  /** Cờ payroll trên dòng (từ `_meta` hoặc merge) — không phải khóa RTDB trên bản ghi NV. */
  PAYROLL_EARLY_OT_PAPERWORK: "payrollEarlyOtPaperwork",
  PAYROLL_LATE_OT_EXCLUDED: "payrollLateOtExcluded",
  PAYROLL_NIGHT_OT_PAPERWORK: "payrollNightOtPaperwork",
};

/**
 * Tham số ngày chuẩn cho tính GC/TC bảng lương — đồng bộ `payrollOtDayParamsFromEmp`.
 * Đọc từ bản ghi NV qua `PAYROLL_EMP`; cờ OT qua `PAYROLL_EMP.PAYROLL_*`.
 *
 * @typedef {{
 *   timeIn: unknown,
 *   timeOut: unknown,
 *   shiftCode: unknown,
 *   leaveType: unknown,
 *   isOffDay: boolean,
 *   isHolidayDay: boolean,
 *   isCompensatoryDay?: boolean,
 *   payrollEarlyOtPaperwork: boolean | undefined,
 *   payrollLateOtExcluded: boolean | undefined,
 *   payrollNightOtPaperwork: boolean | undefined,
 *   lunchOtHours?: unknown,
 *   driverOtMinutes?: unknown,
 *   includeTapVuInWorkingHours?: boolean,
 *   includeThaiSanInWorkingHours?: boolean,
 *   includeTaiXeInWorkingHours?: boolean,
 *   includeTaiXeTongInWorkingHours?: boolean,
 * }} PayrollOtDayParams
 */

/** Giờ vào/ra + ca + phép từ một dòng payroll (không gộp ngữ cảnh ngày). */
export function pickPayrollEmployeeDayFields(record) {
  return {
    ...pickAttendanceEmployeeDayFields(record),
    payrollEarlyOtPaperwork:
      record?.[PAYROLL_EMP.PAYROLL_EARLY_OT_PAPERWORK],
    payrollLateOtExcluded: record?.[PAYROLL_EMP.PAYROLL_LATE_OT_EXCLUDED],
    payrollNightOtPaperwork: record?.[PAYROLL_EMP.PAYROLL_NIGHT_OT_PAPERWORK],
  };
}

/** Ngày vào làm / ngày HĐ — kiểu nội bộ tiếng Anh cho tính toán payroll. */
export function pickPayrollEmployeeProfileDates(record) {
  if (!record) return { joinDate: "", contractDate: "" };
  return {
    joinDate: record.joinDate ?? record[PAYROLL_EMP.JOIN_DATE] ?? "",
    contractDate:
      record.contractDate ?? record[PAYROLL_EMP.CONTRACT_DATE] ?? "",
  };
}

export function pickPayrollEmployeeJoinDate(record) {
  return pickPayrollEmployeeProfileDates(record).joinDate;
}

/** Cache key fragment — ngày vào làm / ngày HĐ sau khi gộp hồ sơ tháng. */
export function payrollEmployeeProfileDatesFingerprint(record, monthKeys = []) {
  const { joinDate, contractDate } = pickPayrollEmployeeProfileDates(record);
  const j = normalizePayrollProfileDateKey(joinDate, monthKeys);
  const c = normalizePayrollProfileDateKey(contractDate, monthKeys);
  return `${j}|${c}`;
}

function uniqueIsoProfileDateKeys(candidates, monthKeys) {
  const out = new Set();
  for (const raw of candidates ?? []) {
    const iso = normalizePayrollProfileDateKey(raw, monthKeys);
    if (isIsoProfileDateKey(iso)) out.add(iso);
  }
  return [...out];
}

/** Ngày vào làm — lấy sớm nhất trong các nguồn hợp lệ. */
export function pickBestPayrollJoinDateForMonth(candidates, monthKeys = []) {
  const isoKeys = uniqueIsoProfileDateKeys(candidates, monthKeys);
  if (!isoKeys.length) return "";
  return isoKeys.sort()[0];
}

/**
 * Ngày HĐ — ưu tiên ngày trong tháng lưới (sớm nhất sau ngày vào làm),
 * tránh ngày cuối tháng/chunk sau ghi đè (vd. 2026-12-01 thay 16/7).
 */
export function pickBestPayrollContractDateForMonth(
  candidates,
  monthKeys = [],
  joinIso = "",
) {
  const isoKeys = uniqueIsoProfileDateKeys(candidates, monthKeys);
  if (!isoKeys.length) return "";

  const afterJoin = joinIso
    ? isoKeys.filter((d) => d >= joinIso)
    : isoKeys;
  if (!afterJoin.length) return "";

  const monthStart = monthKeys?.[0] ?? "";
  const monthEnd = monthKeys?.[monthKeys.length - 1] ?? "";

  if (monthStart && monthEnd) {
    const inMonth = afterJoin.filter((d) => d >= monthStart && d <= monthEnd);
    if (inMonth.length) return inMonth.sort()[0];

    const afterMonth = afterJoin.filter((d) => d > monthEnd);
    if (afterMonth.length) return afterMonth.sort()[0];

    const beforeMonth = afterJoin.filter((d) => d < monthStart);
    if (beforeMonth.length) return beforeMonth.sort().reverse()[0];
  }

  return afterJoin.sort()[0];
}
