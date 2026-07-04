import {
  formatPayrollHoursForDisplay,
  getAttendanceWorkingHoursHours,
  getNightShiftPayrollOffHolidayMergedHoursNumeric,
  getNightShiftPayrollOvertimeHours,
  getNightShiftPayrollRegularHoursAndOtMinutes,
  getPayrollDayOvertimeHoursNumeric,
  getPayrollDayShiftOffHolidayMergedHoursNumeric,
  getPayrollHalfDayLeaveWorkedHours,
  isNightShiftCaLamViec,
  roundHoursToTenths,
} from "@/features/attendance/attendanceWorkingHours";
import {
  formatAttendanceGioVaoDisplay,
  formatAttendanceLeaveTypeColumnForEmployee,
  getAttendanceLeaveTypeBadgeClassName,
  getAttendanceLeaveTypeRaw,
  isAttendanceActualLeaveType,
  isAttendanceBuGioCongType,
  normalizeAttendanceDayRecord,
} from "@/features/attendance/attendanceGioVaoTypeOptions";
import { isDuocNghiBuExplicitlyNo } from "@/features/attendance/attendanceDayMeta";
import { employeeRegimeWorkingHoursFlags } from "@/features/attendance/employeeRegime";
import { payrollOtDayParamsFromMonthChunkEmp } from "@/features/payroll/payrollOtDayParams";
import { PAYROLL_EMP } from "@/features/payroll/payrollEmployeeFields";

/** Trần giờ công dòng chính ngày nghỉ bù — phần vượt sang hệ số TC tương ứng. */
const PAYROLL_MONTH_COMP_MAIN_MAX_HOURS = 8;

function resolvePayrollMonthlyRegimeFlags(p) {
  return employeeRegimeWorkingHoursFlags(p);
}

/** Tổng GC+TC gộp ngày nghỉ bù (đồng bộ bảng ngày off/NB). */
function payrollMonthCompensatoryMergedTotalHours(p) {
  const {
    timeIn,
    timeOut,
    shiftCode,
    payrollEarlyOtPaperwork,
    payrollLateOtExcluded,
    lunchOtHours,
    leaveType,
  } = p;
  const {
    includeTapVuInWorkingHours,
    includeThaiSanInWorkingHours,
    includeTaiXeInWorkingHours,
    includeTaiXeTongInWorkingHours,
  } = resolvePayrollMonthlyRegimeFlags(p);
  const night = isNightShiftCaLamViec(shiftCode);

  if (night) {
    return getNightShiftPayrollOffHolidayMergedHoursNumeric(
      timeIn,
      timeOut,
      shiftCode,
      payrollEarlyOtPaperwork,
    );
  }

  return getPayrollDayShiftOffHolidayMergedHoursNumeric(
    timeIn,
    timeOut,
    true,
    false,
    shiftCode,
    payrollEarlyOtPaperwork,
    leaveType,
    payrollLateOtExcluded,
    includeTapVuInWorkingHours,
    includeThaiSanInWorkingHours,
    includeTaiXeInWorkingHours,
    includeTaiXeTongInWorkingHours,
    lunchOtHours,
  );
}

/** Tách ngày NB: dòng chính ≤8h (gồm TC sớm/chiều gộp), phần dư → hệ số ×2.0 / ×2.7. */
function payrollMonthCompensatoryHourSplit(p) {
  const merged = payrollMonthCompensatoryMergedTotalHours(p);
  if (merged == null || merged <= 0) {
    return { mainHours: null, overflowHours: 0 };
  }
  const main = Math.min(merged, PAYROLL_MONTH_COMP_MAIN_MAX_HOURS);
  const overflow = roundHoursToTenths(Math.max(0, merged - main));
  return {
    mainHours: roundHoursToTenths(main),
    overflowHours: overflow,
  };
}

function payrollMonthCompensatoryRegularMainHours(p) {
  return payrollMonthCompensatoryHourSplit(p).mainHours;
}

function payrollMonthCompensatoryOtCoefficientLines(p) {
  const { overflowHours } = payrollMonthCompensatoryHourSplit(p);
  if (overflowHours <= 0) return [];
  const night = isNightShiftCaLamViec(p.shiftCode);
  return [
    {
      coeff: night ? 2.7 : 2.0,
      hours: overflowHours,
      key: night ? "nb27ov" : "nb20ov",
    },
  ];
}

/**
 * Phân giờ hiển thị theo hệ số lương (bảng chấm công tháng).
 * Không gồm giờ công thường ca ngày (hệ số 0) — chỉ các khối tăng ca / ca đêm / off / lễ đã tách theo quy ước.
 *
 * @param {{
 *   timeIn: unknown,
 *   timeOut: unknown,
 *   isOffDay: boolean,
 *   isHolidayDay: boolean,
 *   isCompensatoryDay?: boolean,
 *   shiftCode: unknown,
 *   payrollEarlyOtPaperwork: boolean | undefined,
 *   payrollLateOtExcluded: boolean | undefined,
 *   lunchOtHours?: unknown,
 *   leaveType?: unknown,
 * }} p
 * @returns {{ coeff: number; hours: number; key: string }[]}
 */
export function getPayrollMonthlyCoefficientLines(p) {
  const {
    timeIn,
    timeOut,
    isOffDay,
    isHolidayDay,
    isCompensatoryDay = false,
    shiftCode,
    payrollEarlyOtPaperwork,
    payrollLateOtExcluded,
    lunchOtHours,
    leaveType,
  } = p;
  const strictOffDay = isOffDay || isCompensatoryDay;
  const {
    includeTapVuInWorkingHours,
    includeThaiSanInWorkingHours,
    includeTaiXeInWorkingHours,
    includeTaiXeTongInWorkingHours,
  } = resolvePayrollMonthlyRegimeFlags(p);
  const night = isNightShiftCaLamViec(shiftCode);
  const lines = [];

  if (isHolidayDay) {
    if (night) {
      const m = getNightShiftPayrollOffHolidayMergedHoursNumeric(
        timeIn,
        timeOut,
        shiftCode,
        payrollEarlyOtPaperwork,
      );
      if (m != null && m > 0) {
        lines.push({ coeff: 3.9, hours: m, key: "nh39" });
      }
      return lines;
    }
    const m = getPayrollDayShiftOffHolidayMergedHoursNumeric(
      timeIn,
      timeOut,
      false,
      true,
      shiftCode,
      payrollEarlyOtPaperwork,
      leaveType,
      payrollLateOtExcluded,
      includeTapVuInWorkingHours,
      includeThaiSanInWorkingHours,
      includeTaiXeInWorkingHours,
      includeTaiXeTongInWorkingHours,
      lunchOtHours,
    );
    if (m != null && m > 0) {
      lines.push({ coeff: 3.0, hours: m, key: "dh30" });
    }
    return lines;
  }

  if (isCompensatoryDay) {
    return payrollMonthCompensatoryOtCoefficientLines(p);
  }

  if (isOffDay) {
    if (night) {
      const m = getNightShiftPayrollOffHolidayMergedHoursNumeric(
        timeIn,
        timeOut,
        shiftCode,
        payrollEarlyOtPaperwork,
      );
      if (m != null && m > 0) {
        lines.push({ coeff: 2.7, hours: m, key: "no27" });
      }
      return lines;
    }
    const m = getPayrollDayShiftOffHolidayMergedHoursNumeric(
      timeIn,
      timeOut,
      true,
      false,
      shiftCode,
      payrollEarlyOtPaperwork,
      leaveType,
      payrollLateOtExcluded,
      includeTapVuInWorkingHours,
      includeThaiSanInWorkingHours,
      includeTaiXeInWorkingHours,
      includeTaiXeTongInWorkingHours,
      lunchOtHours,
    );
    if (m != null && m > 0) {
      lines.push({ coeff: 2.0, hours: m, key: "off20" });
    }
    return lines;
  }

  if (night) {
    const parts = getNightShiftPayrollRegularHoursAndOtMinutes(
      timeIn,
      timeOut,
      shiftCode,
      payrollEarlyOtPaperwork,
    );
    if (parts != null) {
      const reg = Number(parts.regularHours);
      if (Number.isFinite(reg) && reg > 0) {
        lines.push({ coeff: 0.3, hours: reg, key: "nr03" });
      }
      const otH = getNightShiftPayrollOvertimeHours(
        timeIn,
        timeOut,
        shiftCode,
        payrollEarlyOtPaperwork,
      );
      if (Number.isFinite(otH) && otH > 0) {
        /** Đồng bộ cột «TC ca đêm (X1.5)» trên bảng giờ công nhân viên. */
        lines.push({ coeff: 1.5, hours: otH, key: "nt15" });
      }
    }
    return lines;
  }

  /** Đồng bộ cột «TC ca ngày (×1.5)» — chiều + TC sớm (giấy) + TC trưa. */
  const sum15 = getPayrollDayOvertimeHoursNumeric(
    timeIn,
    timeOut,
    strictOffDay,
    shiftCode,
    payrollEarlyOtPaperwork,
    isHolidayDay,
    payrollLateOtExcluded,
    includeTapVuInWorkingHours,
    includeThaiSanInWorkingHours,
    includeTaiXeInWorkingHours,
    includeTaiXeTongInWorkingHours,
    lunchOtHours,
  );
  if (sum15 != null && sum15 > 0) {
    lines.push({ coeff: 1.5, hours: sum15, key: "d15" });
  }
  return lines;
}

/** Thứ tự hiển thị dòng hệ số trong ô (tăng dần). */
const COEFF_SORT = [0.3, 1.5, 2.0, 2.7, 3.0, 3.9];

export function sortPayrollMonthlyCoefficientLines(lines) {
  const rank = (c) => {
    const i = COEFF_SORT.indexOf(c);
    return i === -1 ? 99 : i;
  };
  return [...lines].sort((a, b) => rank(a.coeff) - rank(b.coeff));
}

export function formatCoeffHoursForDisplay(hours) {
  return formatPayrollHoursForDisplay(hours);
}

export function formatCoeffLabel(coeff, displayLocale = "vi-VN") {
  return new Intl.NumberFormat(displayLocale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(coeff);
}

/** 7 dòng / NV: dòng 1 giờ thường + phép; sau đó các hệ số TC. */
export const PAYROLL_MONTHLY_SUBROWS = [
  { key: "main", coeff: null },
  { key: "c03", coeff: 0.3 },
  { key: "c15", coeff: 1.5 },
  { key: "c20", coeff: 2.0 },
  { key: "c27", coeff: 2.7 },
  { key: "c30", coeff: 3.0 },
  { key: "c39", coeff: 3.9 },
];

/**
 * Giờ công thường ngày nghỉ bù trên dòng chính (tối đa 8h).
 * @returns {number | null}
 */
function getPayrollMonthCompensatoryMainRowHours(emp, ch) {
  if (!ch?.isCompensatoryDay) return null;
  if (emp && isDuocNghiBuExplicitlyNo(emp?.duocNghiBu)) return null;
  return payrollMonthCompensatoryRegularMainHours(
    payrollOtDayParamsFromMonthChunkEmp(emp, ch),
  );
}

/**
 * Dòng đầu (hệ số 0): ưu tiên mã phép; không phép thì giờ công (khi tính được).
 * **BGC** (chưa có giờ vào): badge «BGC» — có mặt, giờ bổ sung sau; đã có giờ → số giờ.
 * Ngày off / lễ và ca đêm luôn `dash` ở dòng này — lớp UI gắn nhãn tương ứng.
 * Ngày **nghỉ bù (NB)**: tổng GC+TC gộp tối đa 8h trên dòng chính; phần dư → ×2.0 / ×2.7.
 * @returns {{ kind: "leave"; leaveShort: string; leaveRaw: string; badgeClass: string; workedHours?: number } | { kind: "hours"; hours: number } | { kind: "dash" }}
 */
export function getPayrollMonthlyMainRowCell(emp, ch) {
  const day = normalizeAttendanceDayRecord(emp);
  const leaveRaw = getAttendanceLeaveTypeRaw(day);
  const {
    includeTapVuInWorkingHours,
    includeThaiSanInWorkingHours,
    includeTaiXeInWorkingHours,
    includeTaiXeTongInWorkingHours,
  } = employeeRegimeWorkingHoursFlags(emp);

  if (
    isAttendanceActualLeaveType(leaveRaw, {
      includeTapVuInWorkingHours,
      includeThaiSanInWorkingHours,
    })
  ) {
    const leaveShort = formatAttendanceLeaveTypeColumnForEmployee(emp);
    let workedHours;
    // 1/2PN: vẫn có thể đi làm nửa ngày; `workedHours` dùng tính tổng tháng, không hiển thị trên lưới.
    if (leaveShort === "1/2PN") {
      const night = isNightShiftCaLamViec(emp[PAYROLL_EMP.SHIFT]);
      if (!night) {
        workedHours =
          getPayrollHalfDayLeaveWorkedHours(
            emp[PAYROLL_EMP.TIME_IN],
            emp[PAYROLL_EMP.TIME_OUT],
            emp[PAYROLL_EMP.SHIFT],
            includeTapVuInWorkingHours,
            includeThaiSanInWorkingHours,
            includeTaiXeInWorkingHours,
            includeTaiXeTongInWorkingHours,
          ) ??
          (() => {
            const h = getAttendanceWorkingHoursHours(
              emp[PAYROLL_EMP.TIME_IN],
              emp[PAYROLL_EMP.TIME_OUT],
              emp[PAYROLL_EMP.SHIFT],
              includeTapVuInWorkingHours,
              includeThaiSanInWorkingHours,
              includeTaiXeInWorkingHours,
              includeTaiXeTongInWorkingHours,
            );
            return h != null && h > 0 ? h : undefined;
          })();
      }
    }
    return {
      kind: "leave",
      leaveShort,
      leaveRaw,
      badgeClass: getAttendanceLeaveTypeBadgeClassName(leaveRaw),
      workedHours,
    };
  }
  if (isAttendanceBuGioCongType(leaveRaw)) {
    const night = isNightShiftCaLamViec(emp[PAYROLL_EMP.SHIFT]);
    if (night || ch.isOffDay || ch.isHolidayDay || ch.isCompensatoryDay) {
      const nbHours = getPayrollMonthCompensatoryMainRowHours(emp, ch);
      if (nbHours != null) return { kind: "hours", hours: nbHours };
      return { kind: "dash" };
    }
    const h = getAttendanceWorkingHoursHours(
      emp[PAYROLL_EMP.TIME_IN],
      emp[PAYROLL_EMP.TIME_OUT],
      emp[PAYROLL_EMP.SHIFT],
      includeTapVuInWorkingHours,
      includeThaiSanInWorkingHours,
      includeTaiXeInWorkingHours,
      includeTaiXeTongInWorkingHours,
    );
    if (h != null && h > 0) return { kind: "hours", hours: h };
    return {
      kind: "leave",
      leaveShort: formatAttendanceGioVaoDisplay(leaveRaw),
      leaveRaw,
      badgeClass: getAttendanceLeaveTypeBadgeClassName(leaveRaw),
    };
  }
  const night = isNightShiftCaLamViec(emp[PAYROLL_EMP.SHIFT]);
  if (ch.isCompensatoryDay) {
    const nbHours = getPayrollMonthCompensatoryMainRowHours(emp, ch);
    if (nbHours != null) return { kind: "hours", hours: nbHours };
    return { kind: "dash" };
  }
  if (night || ch.isOffDay || ch.isHolidayDay) {
    return { kind: "dash" };
  }
  const h = getAttendanceWorkingHoursHours(
    emp[PAYROLL_EMP.TIME_IN],
    emp[PAYROLL_EMP.TIME_OUT],
    emp[PAYROLL_EMP.SHIFT],
    includeTapVuInWorkingHours,
    includeThaiSanInWorkingHours,
    includeTaiXeInWorkingHours,
    includeTaiXeTongInWorkingHours,
  );
  if (h == null || h <= 0) return { kind: "dash" };
  return { kind: "hours", hours: h };
}

/**
 * Map hệ số → giờ (một ô / dòng).
 * Đồng bộ cột «TC ca ngày (×1.5)» bảng ngày — không chặn theo loại phép;
 * ngày phép đủ ngày thì `getPayrollDayOvertimeHoursNumeric` tự trả 0/null.
 */
export function getPayrollMonthlyCoeffHoursMap(p) {
  const m = new Map();
  for (const ln of sortPayrollMonthlyCoefficientLines(
    getPayrollMonthlyCoefficientLines(p),
  )) {
    m.set(ln.coeff, ln.hours);
  }
  return m;
}
