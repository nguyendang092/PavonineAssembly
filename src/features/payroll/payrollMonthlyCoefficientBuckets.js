import {
  getAttendanceWorkingHoursHours,
  getNightShiftPayrollOffHolidayMergedHoursNumeric,
  getNightShiftPayrollOvertimeHoursFromOtMinutes,
  getNightShiftPayrollRegularHoursAndOtMinutes,
  getPayrollDayOvertimeHoursNumeric,
  getPayrollDayShiftOffHolidayMergedHoursNumeric,
  getPayrollHalfDayLeaveWorkedHours,
  isNightShiftCaLamViec,
  roundHoursForPayrollDisplay,
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
import { employeeRegimeWorkingHoursFlags } from "@/features/attendance/employeeRegime";
import { PAYROLL_EMP } from "@/features/payroll/payrollEmployeeFields";

function resolvePayrollMonthlyRegimeFlags(p) {
  return employeeRegimeWorkingHoursFlags(p);
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

  if (strictOffDay) {
    if (night) {
      const m = getNightShiftPayrollOffHolidayMergedHoursNumeric(
        timeIn,
        timeOut,
        shiftCode,
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
    );
    if (parts != null) {
      const reg = Number(parts.regularHours);
      if (Number.isFinite(reg) && reg > 0) {
        lines.push({ coeff: 0.3, hours: reg, key: "nr03" });
      }
      const otH = getNightShiftPayrollOvertimeHoursFromOtMinutes(
        parts.otMinutes,
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
  return String(roundHoursForPayrollDisplay(hours));
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
 * Dòng đầu (hệ số 0): ưu tiên mã phép; không phép thì giờ công (khi tính được).
 * **BGC** (chưa có giờ vào): badge «BGC» — có mặt, giờ bổ sung sau; đã có giờ → số giờ.
 * Ngày off / lễ / **nghỉ bù** và ca đêm luôn `dash` ở dòng này — lớp UI gắn nhãn
 * tương ứng (OFF / NL / NB) qua `payrollMonthMainRowDashMark`; giờ công đẩy
 * sang các dòng hệ số (2.0 cho off & nghỉ bù, 3.0 cho lễ, …) đồng bộ với NL.
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
    // 1/2PN: vẫn có thể đi làm nửa ngày; hiển thị thêm số giờ thực tế trong cùng ô.
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
  /**
   * Ngày nghỉ bù (NB) đồng bộ cơ chế với ngày lễ (NL): dòng chính luôn `dash`
   * → dashMark hiển thị «NB» dù có hay không có giờ công; giờ công tính sang
   * dòng hệ số 2.0 qua nhánh `strictOffDay`.
   */
  if (night || ch.isOffDay || ch.isHolidayDay || ch.isCompensatoryDay) {
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
