import {
  getAttendanceWorkingHoursHours,
  getNightShiftPayrollOffHolidayMergedHoursNumeric,
  getNightShiftPayrollOvertimeHoursFromOtMinutes,
  getNightShiftPayrollRegularHoursAndOtMinutes,
  getOvertimeHoursFromGioRa,
  getPayrollDayShiftOffHolidayMergedHoursNumeric,
  getPayrollHalfDayLeaveWorkedHours,
  isEarlyArrivalFor0600PaperworkOvertime,
  isNightShiftCaLamViec,
  roundHoursForPayrollDisplay,
  roundHoursToTenths,
} from "@/features/attendance/attendanceWorkingHours";
import {
  formatAttendanceLeaveTypeColumnForEmployee,
  getAttendanceLeaveTypeBadgeClassName,
  getAttendanceLeaveTypeRaw,
  isAttendanceActualLeaveType,
} from "@/features/attendance/attendanceGioVaoTypeOptions";
/** Đồng bộ với `EARLY_PAPERWORK_OT_HOURS` trong attendanceWorkingHours.js */
const PAYROLL_EARLY_PAPERWORK_OT_HOURS = 2;

/**
 * Phân giờ hiển thị theo hệ số lương (bảng chấm công tháng).
 * Không gồm giờ công thường ca ngày (hệ số 0) — chỉ các khối tăng ca / ca đêm / off / lễ đã tách theo quy ước.
 *
 * @param {{
 *   gioVao: unknown,
 *   gioRa: unknown,
 *   isOffDay: boolean,
 *   isHolidayDay: boolean,
 *   caLamViec: unknown,
 *   payrollEarlyOtPaperwork: boolean | undefined,
 *   payrollLateOtPaperwork: boolean | undefined,
 * }} p
 * @returns {{ coeff: number; hours: number; key: string }[]}
 */
export function getPayrollMonthlyCoefficientLines(p) {
  const {
    gioVao,
    gioRa,
    isOffDay,
    isHolidayDay,
    caLamViec,
    payrollEarlyOtPaperwork,
    payrollLateOtPaperwork,
  } = p;
  const night = isNightShiftCaLamViec(caLamViec);
  const lines = [];

  if (isHolidayDay) {
    if (night) {
      const m = getNightShiftPayrollOffHolidayMergedHoursNumeric(
        gioVao,
        gioRa,
        caLamViec,
      );
      if (m != null && m > 0) {
        lines.push({ coeff: 3.9, hours: m, key: "nh39" });
      }
      return lines;
    }
    const m = getPayrollDayShiftOffHolidayMergedHoursNumeric(
      gioVao,
      gioRa,
      false,
      true,
      caLamViec,
      payrollEarlyOtPaperwork,
      undefined,
      payrollLateOtPaperwork,
    );
    if (m != null && m > 0) {
      lines.push({ coeff: 3.0, hours: m, key: "dh30" });
    }
    return lines;
  }

  if (isOffDay) {
    if (night) {
      const m = getNightShiftPayrollOffHolidayMergedHoursNumeric(
        gioVao,
        gioRa,
        caLamViec,
      );
      if (m != null && m > 0) {
        lines.push({ coeff: 2.7, hours: m, key: "no27" });
      }
      return lines;
    }
    const m = getPayrollDayShiftOffHolidayMergedHoursNumeric(
      gioVao,
      gioRa,
      true,
      false,
      caLamViec,
      payrollEarlyOtPaperwork,
      undefined,
      payrollLateOtPaperwork,
    );
    if (m != null && m > 0) {
      lines.push({ coeff: 2.0, hours: m, key: "off20" });
    }
    return lines;
  }

  if (night) {
    const parts = getNightShiftPayrollRegularHoursAndOtMinutes(
      gioVao,
      gioRa,
      caLamViec,
    );
    if (parts != null) {
      const reg = Number(parts.regularHours);
      if (Number.isFinite(reg) && reg > 0) {
        lines.push({ coeff: 0.3, hours: reg, key: "nr03" });
      }
      const otH = getNightShiftPayrollOvertimeHoursFromOtMinutes(parts.otMinutes);
      if (Number.isFinite(otH) && otH > 0) {
        lines.push({ coeff: 2.0, hours: otH, key: "nt20" });
      }
    }
    return lines;
  }

  const evening = getOvertimeHoursFromGioRa(gioRa);
  let early = 0;
  if (
    payrollEarlyOtPaperwork === true &&
    isEarlyArrivalFor0600PaperworkOvertime(gioVao, caLamViec)
  ) {
    early = PAYROLL_EARLY_PAPERWORK_OT_HOURS;
  }
  const ev = payrollLateOtPaperwork === true ? (evening == null ? 0 : evening) : 0;
  const sum15 = roundHoursToTenths(ev + early);
  if (sum15 > 0) {
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
 * Dòng đầu (hệ số 0): ưu tiên mã phép; không phép thì giờ công ca ngày thường.
 * @returns {{ kind: "leave"; leaveShort: string; leaveRaw: string; badgeClass: string; workedHours?: number } | { kind: "hours"; hours: number } | { kind: "dash" }}
 */
export function getPayrollMonthlyMainRowCell(emp, ch) {
  const leaveRaw = getAttendanceLeaveTypeRaw(emp);
  if (isAttendanceActualLeaveType(leaveRaw)) {
    const leaveShort = formatAttendanceLeaveTypeColumnForEmployee(emp);
    let workedHours;
    // 1/2PN: vẫn có thể đi làm nửa ngày; hiển thị thêm số giờ thực tế trong cùng ô.
    if (leaveShort === "1/2PN") {
      const night = isNightShiftCaLamViec(emp.caLamViec);
      if (!night && !ch.isOffDay && !ch.isHolidayDay) {
        workedHours =
          getPayrollHalfDayLeaveWorkedHours(
            emp.gioVao,
            emp.gioRa,
            emp.caLamViec,
          ) ??
          (() => {
            const h = getAttendanceWorkingHoursHours(
              emp.gioVao,
              emp.gioRa,
              emp.caLamViec,
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
  const night = isNightShiftCaLamViec(emp.caLamViec);
  if (night || ch.isOffDay || ch.isHolidayDay) {
    return { kind: "dash" };
  }
  const h = getAttendanceWorkingHoursHours(
    emp.gioVao,
    emp.gioRa,
    emp.caLamViec,
  );
  if (h == null || h <= 0) return { kind: "dash" };
  return { kind: "hours", hours: h };
}

/** Map hệ số → giờ (một ô / dòng). */
export function getPayrollMonthlyCoeffHoursMap(p) {
  if (isAttendanceActualLeaveType(p?.loaiPhep)) return new Map();

  const m = new Map();
  for (const ln of sortPayrollMonthlyCoefficientLines(
    getPayrollMonthlyCoefficientLines(p),
  )) {
    m.set(ln.coeff, ln.hours);
  }
  return m;
}