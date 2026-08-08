import { formatPayrollHoursForDisplayHundredths } from "@/features/attendance/attendanceWorkingHours";
import {
  formatCoeffHoursForDisplay,
  getPayrollMonthlyCoeffHoursMap,
  getPayrollMonthlyMainRowCell,
  payrollMonthNightShiftGcHoursMovedToMain,
  PAYROLL_MONTHLY_SUBROWS,
} from "@/features/payroll/payrollMonthlyCoefficientBuckets";
import { payrollOtDayParamsFromMonthChunkEmp } from "@/features/payroll/payrollOtDayParams";
import {
  PAYROLL_EMP,
  isIsoProfileDateKey,
  normalizePayrollProfileDateKey,
  pickPayrollEmployeeProfileDates,
} from "@/features/payroll/payrollEmployeeFields";
import {
  MONTH_DETAIL_COLS_PER_BLOCK,
  MONTHLY_TIMESHEET_COEFF_COL_BY_SUBROW,
  PAYROLL_MONTHLY_NIGHT_SHIFT_ALLOWANCE_VND,
} from "@/features/payroll/payrollMonthlyTimesheetLayout";
import { isCompensatoryNbVisibleForDayContext } from "@/features/attendance/attendanceDayMeta";
import {
  formatAttendanceLeaveTypeColumnDisplay,
  getAttendanceLeaveTypeRaw,
} from "@/features/attendance/attendanceGioVaoTypeOptions";
import {
  getNightShiftTotalWindowHours22To05,
  isNightShiftCaLamViec,
} from "@/features/attendance/attendanceWorkingHours";
import { attendanceAnnualLeaveDeductionForLoaiPhep } from "@/features/leave/annualLeaveBalanceLookup";
import { employeeRegimeWorkingHoursFlags } from "@/features/attendance/employeeRegime";
import { resolveTaiXeTongEffectiveIsOffDay } from "@/features/payroll/taiXeTongPayrollDay";
import { parseLocalDateKey } from "@/utils/dateKey";
import {
  resolvePayrollMonthDayEmployee,
  resolvePayrollMonthEmployeeProfileForSummary,
} from "@/features/payroll/payrollMonthlyGridData";

/** Ô tổng hợp khối THỜI GIAN LÀM VIỆC — ẩn số 0. */
export function fmtPayrollMonthlySummaryCell(n) {
  return Number.isFinite(n) && n > 0 ? formatCoeffHoursForDisplay(n) : " ";
}

/** Ô giờ công / TC khối THỜI GIAN LÀM VIỆC & HỢP ĐỒNG — 2 số thập phân (Korean Timesheet). */
export function fmtPayrollMonthlySummaryHoursCell(n) {
  return Number.isFinite(n) && n > 0
    ? formatPayrollHoursForDisplayHundredths(n)
    : " ";
}

/** Ô đếm ngày phép / nghỉ (PN 0,5 · NB/KL/KP 1). */
export function fmtPayrollMonthlyLeaveDayCell(n) {
  if (!Number.isFinite(n) || n <= 0) return " ";
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return formatCoeffHoursForDisplay(n);
}

/** Ô phụ cấp ca đêm (VND) — số nguyên, có phân tách nghìn. */
export function fmtPayrollMonthlyNightShiftAllowanceCell(n) {
  if (!Number.isFinite(n) || n <= 0) return " ";
  return Math.round(n).toLocaleString("vi-VN");
}

/** @deprecated Dùng `normalizePayrollProfileDateKey`. */
export function normalizeProfileDateKey(raw, monthKeys = []) {
  return normalizePayrollProfileDateKey(raw, monthKeys);
}

/**
 * Giai đoạn làm việc của một ngày trong tháng:
 * - Có ngày HĐ: [ngày vào làm, ngày HĐ) → thử việc; từ ngày HĐ → hợp đồng.
 * - Không có ngày HĐ: mọi ngày (từ ngày vào làm nếu có) → hợp đồng.
 */
export function monthlyWorkPhaseForDateKey(
  dateKey,
  joinDateRaw,
  contractDateRaw,
  monthKeys = [],
) {
  const join = normalizePayrollProfileDateKey(joinDateRaw, monthKeys);
  const contract = normalizePayrollProfileDateKey(contractDateRaw, monthKeys);
  const dk = String(dateKey ?? "").trim();
  if (!dk) return null;

  if (!contract) {
    if (join && dk < join) return null;
    return "official";
  }
  if (join) {
    if (dk >= join && dk < contract) return "trial";
    if (dk >= contract) return "official";
    return null;
  }
  if (dk >= contract) return "official";
  return null;
}

/** Ngày trong tháng có được tính giờ công cho NV (từ ngày vào làm trở đi). */
export function isPayrollMonthDayOnOrAfterJoin(
  dateKey,
  joinDateRaw,
  monthKeys = [],
) {
  const join = normalizePayrollProfileDateKey(joinDateRaw, monthKeys);
  const dk = String(dateKey ?? "").trim();
  if (!join || !dk) return true;
  return dk >= join;
}

/**
 * Ẩn ô lưới tháng / Excel khi ngày < ngày vào làm (kể cả NB, NL, giờ công).
 * Từ ngày vào làm trở đi → hiển thị như bình thường.
 */
export function isPayrollMonthDayCellBeforeJoinWithoutAttendance(
  dateKey,
  joinDateRaw,
  _dayEmp,
  monthKeys = [],
) {
  return !isPayrollMonthDayOnOrAfterJoin(dateKey, joinDateRaw, monthKeys);
}

/** Số ngày công chuẩn từ ngày vào làm (trừ CN) — dùng chốt nghỉ không lương / phép năm. */
export function countEmployedStandardWorkDaysInMonth(
  monthKeys,
  joinDateRaw,
) {
  let n = 0;
  for (const dk of monthKeys) {
    if (!isPayrollMonthDayOnOrAfterJoin(dk, joinDateRaw, monthKeys)) continue;
    const pd = parseLocalDateKey(dk);
    if (pd && pd.getDay() === 0) continue;
    n += 1;
  }
  return n;
}

/** Số ngày công lịch (trừ Chủ nhật) trong tháng thuộc giai đoạn; `phase === null` = cả tháng. */
export function countPhaseCalendarWorkDaysInMonth(
  monthKeys,
  joinDateRaw,
  contractDateRaw,
  phase,
) {
  let n = 0;
  for (const dk of monthKeys) {
    const pd = parseLocalDateKey(dk);
    if (pd && pd.getDay() === 0) continue;
    if (phase == null) {
      n += 1;
    } else if (
      monthlyWorkPhaseForDateKey(
        dk,
        joinDateRaw,
        contractDateRaw,
        monthKeys,
      ) === phase
    ) {
      n += 1;
    }
  }
  return n;
}

/**
 * Số ngày công chuẩn tháng (trừ Chủ nhật) — «Ngày thực tế làm việc» trên lưới tháng.
 * = số ngày trong tháng − số Chủ nhật (không phụ thuộc ngày vào làm).
 */
export function countMonthlyStandardWorkDays(monthKeys) {
  return countPhaseCalendarWorkDaysInMonth(monthKeys, "", "", null);
}

/**
 * Thứ Bảy được đánh dấu «Ngày off» (không phải lễ / nghỉ bù) — khối SAT.S.
 * Tài xế tổng: Thứ 7 như ngày thường → không thuộc SAT.S off.
 * @param {string} dateKey
 * @param {{ isOffDay?: boolean, isHolidayDay?: boolean, dateKey?: string } | null | undefined} ch
 * @param {object | null | undefined} [emp]
 */
export function isPayrollSaturdayOffWorkDay(dateKey, ch, emp = null) {
  if (!ch?.isOffDay || ch.isHolidayDay) return false;
  const pd = parseLocalDateKey(dateKey);
  if (!pd || pd.getDay() !== 6) return false;
  if (emp) {
    const flags = employeeRegimeWorkingHoursFlags(emp);
    const effectiveOff = resolveTaiXeTongEffectiveIsOffDay({
      includeTaiXeTongInWorkingHours: flags.includeTaiXeTongInWorkingHours,
      dateKey: dateKey ?? ch?.dateKey ?? null,
      isOffDay: ch.isOffDay,
    });
    if (!effectiveOff) return false;
  }
  return true;
}

function leaveUnitsByCode(leaveShort, code) {
  const t = String(leaveShort ?? "")
    .trim()
    .toUpperCase();
  const c = String(code ?? "")
    .trim()
    .toUpperCase();
  if (!t || !c) return 0;
  if (t === c) return 1;
  if (t === `1/2${c}` || t === `1/2 ${c}`) return 0.5;
  return 0;
}

/** Đếm PN / NB / KL / KP từ `loaiPhep` — dùng cho cột tổng hợp lưới tháng. */
export function payrollMonthlyLeaveUnitsForEmployee(emp) {
  const leaveRaw = getAttendanceLeaveTypeRaw(emp);
  if (!leaveRaw) {
    return { pn: 0, nb: 0, kl: 0, kp: 0 };
  }
  const leaveShort = formatAttendanceLeaveTypeColumnDisplay(leaveRaw);
  const pn =
    attendanceAnnualLeaveDeductionForLoaiPhep(leaveRaw) ||
    leaveUnitsByCode(leaveShort, "PN");
  return {
    pn,
    nb: leaveUnitsByCode(leaveShort, "NB"),
    kl: leaveUnitsByCode(leaveShort, "KL"),
    kp: leaveUnitsByCode(leaveShort, "KP"),
  };
}

function compensatoryNbUnits(ch, emp) {
  if (!isCompensatoryNbVisibleForDayContext(ch, emp)) return 0;
  if (emp == null) return 1;
  const main = getPayrollMonthlyMainRowCell(emp, ch);
  if (main.kind === "hours" || main.kind === "leave") return 0;
  return 1;
}

function addPayrollMonthlyLeaveColumnCounts(out, emp, ch) {
  if (emp) {
    const leaveRaw = getAttendanceLeaveTypeRaw(emp);
    const leaveShort = leaveRaw
      ? formatAttendanceLeaveTypeColumnDisplay(leaveRaw)
      : "";
    const units = payrollMonthlyLeaveUnitsForEmployee(emp);
    out.pnDays += units.pn;
    out.klDays += units.kl;
    out.kpDays += units.kp;
    out.nbDays += Math.max(units.nb, compensatoryNbUnits(ch, emp));
    out.tsDays += leaveUnitsByCode(leaveShort, "TS");
  } else {
    out.nbDays += compensatoryNbUnits(ch, null);
  }
}

function leaveExcludedFromIncludedWorkDays(leaveShort) {
  return (
    leaveUnitsByCode(leaveShort, "PO") > 0 ||
    leaveUnitsByCode(leaveShort, "KL") > 0 ||
    leaveUnitsByCode(leaveShort, "KP") > 0 ||
    leaveUnitsByCode(leaveShort, "NV") > 0
  );
}

/** Ngày có loại phép này không cộng vào «Tổng ngày công (gồm ngày nghỉ có lương)». */
export function isPayrollMonthLeaveExcludedFromWorkDaysTotal(emp) {
  const leaveRaw = getAttendanceLeaveTypeRaw(emp);
  if (!leaveRaw) return false;
  const leaveShort = formatAttendanceLeaveTypeColumnDisplay(leaveRaw);
  return leaveExcludedFromIncludedWorkDays(leaveShort);
}

/** Phép có lương được cộng vào tổng ngày công — trừ PO, KL, KP (và NV). */
function countedLeaveUnitsForWorkDays(leaveShort) {
  if (leaveExcludedFromIncludedWorkDays(leaveShort)) return 0;
  const codes = ["PN", "TN", "PT", "PC", "NB", "NL", "CT"];
  let total = 0;
  for (const code of codes) total += leaveUnitsByCode(leaveShort, code);
  return total;
}

function sumPayrollMonthlyCoeffHours(coeffMap) {
  let s = 0;
  if (!coeffMap) return s;
  for (const v of coeffMap.values()) {
    if (Number.isFinite(v) && v > 0) s += v;
  }
  return s;
}

/** 1/2PN mặc định 0,5 ngày; đủ giờ làm thực tế thì được tính trọn 1 ngày công. */
const HALF_PN_FULL_DAY_WORKED_HOURS = 4;

/**
 * Tổng hợp 3 khối cột chi tiết tháng:
 * - **THỜI GIAN LÀM VIỆC** (`total`): từ ngày vào làm (nếu có) đến hết tháng.
 * - **THỜI GIAN THỬ VIỆC** (`trial`): có ngày HĐ — chỉ cộng ngày từ ngày vào làm đến trước ngày HĐ; «Tổng ngày công (gồm ngày nghỉ có lương)» = `trial.workDays`.
 * - **THỜI GIAN HỢP ĐỒNG** (`official`): từ ngày HĐ; không có ngày HĐ → mặc định toàn bộ (từ ngày vào làm).
 * - **Ngày thực tế làm việc** (`standardWorkDays`): số ngày tháng − Chủ nhật (cả 3 khối).
 */
export function buildMonthlyRuleSummary(
  dayChunks,
  monthKeys,
  id,
  employeeProfile = {},
) {
  const resolvedProfile = resolvePayrollMonthEmployeeProfileForSummary(
    dayChunks,
    monthKeys,
    id,
    employeeProfile,
  );
  const { joinDate, contractDate } =
    pickPayrollEmployeeProfileDates(resolvedProfile);
  const join = normalizePayrollProfileDateKey(joinDate, monthKeys);
  const contract = normalizePayrollProfileDateKey(contractDate, monthKeys);
  const hasContract = isIsoProfileDateKey(contract);
  const calendarStandardWorkDays = countMonthlyStandardWorkDays(monthKeys);
  const employedStandardWorkDays = countEmployedStandardWorkDaysInMonth(
    monthKeys,
    join,
  );
  const trialStandardWorkDays = countPhaseCalendarWorkDaysInMonth(
    monthKeys,
    join,
    contract,
    "trial",
  );
  const officialStandardWorkDays = countPhaseCalendarWorkDaysInMonth(
    monthKeys,
    join,
    contract,
    "official",
  );

  const createEmptySummary = () => ({
    workDays: 0,
    workHours: 0,
    unpaidDays: 0,
    pnDays: 0,
    nbDays: 0,
    klDays: 0,
    kpDays: 0,
    tsDays: 0,
    coeff03: 0,
    coeff15: 0,
    coeff20: 0,
    coeff27: 0,
    coeff30: 0,
    coeff39: 0,
    nbDayCoeff20: 0,
    nbNightCoeff27: 0,
    sats20: 0,
    sats27: 0,
    /** Thứ Bảy OFF có giờ công — đếm ngày công riêng (hiển thị cột SAT.S). */
    satsWorkDays: 0,
    /** Ca S2: giờ trong khung 22:00–06:00 (ngày hôm sau), tối đa 8h / ngày. */
    nightShiftWindowHours: 0,
    /** Ca S2 — số ngày có ca làm việc (× phụ cấp). */
    nightShiftAllowanceDays: 0,
    standardWorkDays: calendarStandardWorkDays,
  });

  const total = createEmptySummary();
  const trial = createEmptySummary();
  const official = createEmptySummary();

  const addCoeffHoursToTotals = (out, coeffMap) => {
    out.coeff03 += Number(coeffMap.get(0.3) || 0);
    out.coeff15 += Number(coeffMap.get(1.5) || 0);
    out.coeff20 += Number(coeffMap.get(2.0) || 0);
    out.coeff27 += Number(coeffMap.get(2.7) || 0);
    out.coeff30 += Number(coeffMap.get(3.0) || 0);
    out.coeff39 += Number(coeffMap.get(3.9) || 0);
  };

  /**
   * Thứ Bảy OFF: giờ vẫn vào TC off (×2.0) / TC ca đêm off (×2.7);
   * cột SAT.S (×2.7): thêm bản sao giờ khi ca đêm S2.
   */
  const addSaturdaySatOverlay = (out, coeffMap, dateKey, ch, emp) => {
    if (!isPayrollSaturdayOffWorkDay(dateKey, ch, emp)) return;
    if (!isNightShiftCaLamViec(emp?.caLamViec)) return;
    const h27 = Number(coeffMap.get(2.7) || 0);
    if (h27 > 0) out.sats27 += h27;
  };

  const isNbVisibleForCompDay = (ch, emp) =>
    isCompensatoryNbVisibleForDayContext(ch, emp);

  const computeHolidayWorkCreditForDash = (ch, coeffSum, emp) => {
    if (ch.isHolidayDay) return 1;
    if (isNbVisibleForCompDay(ch, emp)) return 1;
    return coeffSum > 0 ? 1 : 0;
  };

  const computeIncludedWorkDayCreditForLeave = ({ ch, main, coeffSum }) => {
    /** BGC: có mặt, chưa có giờ vào — vẫn tính 1 ngày công; giờ bổ sung sau. */
    if (main.leaveShort === "BGC") return 1;

    if (leaveExcludedFromIncludedWorkDays(main.leaveShort)) return 0;

    const workedH =
      Number.isFinite(main.workedHours) && main.workedHours > 0
        ? main.workedHours
        : 0;

    const isHalfPnLeave = main.leaveShort === "1/2PN";
    const dayWorked =
      workedH > 0 &&
      (!isHalfPnLeave || workedH >= HALF_PN_FULL_DAY_WORKED_HOURS)
        ? 1
        : 0;

    let dayLeavePaid = 0;
    if (!leaveExcludedFromIncludedWorkDays(main.leaveShort)) {
      dayLeavePaid = countedLeaveUnitsForWorkDays(main.leaveShort);
    }

    let dayAdd = Math.max(dayWorked, dayLeavePaid);

    if (ch.isHolidayDay && coeffSum <= 0 && dayWorked === 0) {
      dayAdd = Math.max(dayAdd, 1);
    }

    return dayAdd;
  };

  const addNbCompensatoryWorkHours = (out, ch, emp, main, coeffMap) => {
    if (!ch.isCompensatoryDay || !emp) return;
    const night = isNightShiftCaLamViec(
      emp[PAYROLL_EMP.SHIFT] ?? emp.caLamViec,
    );
    let mainH = 0;
    if (
      main.kind === "hours" &&
      Number.isFinite(main.hours) &&
      main.hours > 0
    ) {
      mainH = main.hours;
    } else if (
      main.kind === "leave" &&
      Number.isFinite(main.workedHours) &&
      main.workedHours > 0
    ) {
      mainH = main.workedHours;
    }
    if (night) {
      out.nbNightCoeff27 += mainH + Number(coeffMap.get(2.7) || 0);
    } else {
      out.nbDayCoeff20 += mainH + Number(coeffMap.get(2.0) || 0);
    }
  };

  const applyDayToSummary = (out, ch, emp, dateKey) => {
    addPayrollMonthlyLeaveColumnCounts(out, emp, ch);

    if (!emp) {
      if (ch.isHolidayDay || compensatoryNbUnits(ch, null) > 0)
        out.workDays += 1;
      return;
    }

    const saturdayOff = isPayrollSaturdayOffWorkDay(dateKey, ch, emp);
    const main = getPayrollMonthlyMainRowCell(emp, ch);
    const coeffMap = getPayrollMonthlyCoeffHoursMap(
      payrollOtDayParamsFromMonthChunkEmp(emp, ch),
    );
    const coeffSum = sumPayrollMonthlyCoeffHours(coeffMap);
    const nightGcMoved = payrollMonthNightShiftGcHoursMovedToMain(
      emp,
      ch,
      coeffMap,
    );
    const coeffSumForWorkHours = Math.max(0, coeffSum - nightGcMoved);
    const addWorkedHours = (hours) => {
      if (!Number.isFinite(hours) || hours <= 0) return;
      out.workHours += hours;
    };

    if (main.kind === "leave") {
      if (main.leaveShort === "1/2PN") {
        const offLike = ch.isOffDay || ch.isHolidayDay || ch.isCompensatoryDay;
        if (offLike) {
          /** Giờ nửa ngày + TC (kể cả trưa) đã gộp trong coeff ×2.0 / ×3.0. */
          addWorkedHours(coeffSumForWorkHours);
        } else {
          addWorkedHours(main.workedHours);
          addWorkedHours(coeffSumForWorkHours);
        }
      } else {
        addWorkedHours(main.workedHours);
      }

      out.workDays += computeIncludedWorkDayCreditForLeave({
        ch,
        main,
        coeffSum,
      });
    } else if (main.kind === "hours") {
      addWorkedHours(main.hours);
      addWorkedHours(coeffSumForWorkHours);
      if (!isPayrollMonthLeaveExcludedFromWorkDaysTotal(emp)) {
        out.workDays += 1;
        if (saturdayOff) out.satsWorkDays += 1;
      }
    } else {
      addWorkedHours(coeffSumForWorkHours);
      if (saturdayOff && coeffSumForWorkHours > 0) {
        out.satsWorkDays += 1;
        if (!isPayrollMonthLeaveExcludedFromWorkDaysTotal(emp)) {
          out.workDays += 1;
        }
      } else if (!isPayrollMonthLeaveExcludedFromWorkDaysTotal(emp)) {
        out.workDays += computeHolidayWorkCreditForDash(ch, coeffSum, emp);
      }
    }

    addCoeffHoursToTotals(out, coeffMap);
    addNbCompensatoryWorkHours(out, ch, emp, main, coeffMap);
    addSaturdaySatOverlay(out, coeffMap, dateKey, ch, emp);

    const otParams = payrollOtDayParamsFromMonthChunkEmp(emp, ch);
    const nightH = getNightShiftTotalWindowHours22To05(
      otParams.timeIn,
      otParams.timeOut,
      otParams.shiftCode,
    );
    if (Number.isFinite(nightH) && nightH > 0) {
      out.nightShiftWindowHours += nightH;
    }

    if (
      isNightShiftCaLamViec(emp[PAYROLL_EMP.SHIFT] ?? emp.caLamViec)
    ) {
      out.nightShiftAllowanceDays += 1;
    }
  };

  for (const dk of monthKeys) {
    const ch = dayChunks.get(dk);
    if (!ch) continue;

    const emp = resolvePayrollMonthDayEmployee(ch, id, resolvedProfile);
    if (!isPayrollMonthDayOnOrAfterJoin(dk, join, monthKeys)) continue;

    const phase = monthlyWorkPhaseForDateKey(dk, join, contract, monthKeys);

    applyDayToSummary(total, ch, emp, dk);
    if (hasContract && phase === "trial") {
      applyDayToSummary(trial, ch, emp, dk);
    } else if (phase === "official") {
      applyDayToSummary(official, ch, emp, dk);
    }
  }

  const finalizeSummary = (out, capStandardWorkDays, { syncStandardWorkDays = false } = {}) => {
    if (syncStandardWorkDays) {
      out.standardWorkDays = capStandardWorkDays;
    }
    out.workDays = Math.min(out.workDays, capStandardWorkDays);
    out.unpaidDays = Math.max(0, capStandardWorkDays - out.workDays);
  };
  finalizeSummary(total, employedStandardWorkDays);
  finalizeSummary(trial, trialStandardWorkDays, { syncStandardWorkDays: true });
  finalizeSummary(official, officialStandardWorkDays, {
    syncStandardWorkDays: true,
  });
  return { total, trial, official };
}

/**
 * Hai cột khối TỔNG trên lưới tháng giờ công — dùng kiểm tra +1 phép tháng vào làm.
 * - `standardWorkDays` → «Ngày thực tế làm việc»
 * - `workDays` → «Tổng ngày công (gồm ngày nghỉ có lương)»
 * - `tsDays` → «Số ngày nghỉ thai sản»
 */
export function pickPayrollMonthlyTimesheetTotalWorkColumns(summary) {
  return {
    standardWorkDays: Number(summary?.standardWorkDays) || 0,
    workDays: Number(summary?.workDays) || 0,
    tsDays: Number(summary?.tsDays) || 0,
  };
}

/** +1 phép tháng khi đạt ngưỡng ½ ngày thực tế làm việc (tổng GC hoặc nghỉ TS). */
export function payrollMonthlyJoinMonthMeetsAnnualLeaveAccrual(totalSummary) {
  const { workDays, standardWorkDays, tsDays } =
    pickPayrollMonthlyTimesheetTotalWorkColumns(totalSummary);
  if (standardWorkDays <= 0) return false;
  const halfStandard = standardWorkDays / 2;
  if (tsDays >= halfStandard) return true;
  return workDays >= halfStandard;
}

/** Chỉ số cột trong khối chi tiết (`MONTH_DETAIL_COLS_PER_BLOCK`). */
const DETAIL_COL_SO_NGAY_CONG = 0;
const DETAIL_COL_WORK_DAYS = 1;
const DETAIL_COL_UNPAID = 2;
const DETAIL_COL_PN = 3;
const DETAIL_COL_NB = 4;
const DETAIL_COL_KL = 5;
const DETAIL_COL_KP = 6;
const DETAIL_COL_TC_START = 7;
const DETAIL_COL_NB_DAY_COEFF20 = 13;
const DETAIL_COL_NB_NIGHT_COEFF27 = 14;
const DETAIL_COL_TS_DAYS = 15;
const DETAIL_COL_NIGHT_SHIFT_ALLOWANCE = 16;
const DETAIL_COL_NIGHT_SHIFT_HOURS = 17;

/**
 * 18 cột một khối THỜI GIAN *.
 * - `si === 0`: ngày công + tổng TC (cột 7–12) + NB (13–14) + TS + phụ cấp ca đêm + Tổng GC ca đêm (17).
 * - `si > 0`: mirror một ô TC tương ứng — cùng giá trị tổng, không tính lại.
 */
function formatDetailSummaryHoursCell(fmt, fmtHours, n) {
  return (fmtHours ?? fmt)(n);
}

function valuesForDetailBlock({
  si,
  summary,
  coeffColBySubrow,
  fmt,
  fmtHours = null,
  fmtLeave = fmtPayrollMonthlyLeaveDayCell,
  fmtAllowance = fmtPayrollMonthlyNightShiftAllowanceCell,
  colsPerBlock,
  includeSoNgayCong = true,
}) {
  const tcByRow = [
    summary.coeff03,
    summary.coeff15,
    summary.coeff20,
    summary.coeff27,
    summary.coeff30,
    summary.coeff39,
  ];
  const values = Array.from({ length: colsPerBlock }, (_, idx) => {
    if (si === 0) {
      if (idx === DETAIL_COL_SO_NGAY_CONG) return fmt(summary.standardWorkDays);
      if (idx === DETAIL_COL_WORK_DAYS) return fmt(summary.workDays);
      if (idx === DETAIL_COL_UNPAID) return fmtLeave(summary.unpaidDays);
      if (idx === DETAIL_COL_PN) return fmtLeave(summary.pnDays);
      if (idx === DETAIL_COL_NB) return fmtLeave(summary.nbDays);
      if (idx === DETAIL_COL_KL) return fmtLeave(summary.klDays);
      if (idx === DETAIL_COL_KP) return fmtLeave(summary.kpDays);
      if (idx >= DETAIL_COL_TC_START && idx <= DETAIL_COL_TC_START + 5) {
        return formatDetailSummaryHoursCell(
          fmt,
          fmtHours,
          tcByRow[idx - DETAIL_COL_TC_START],
        );
      }
      if (idx === DETAIL_COL_NB_DAY_COEFF20) {
        return formatDetailSummaryHoursCell(
          fmt,
          fmtHours,
          summary.nbDayCoeff20,
        );
      }
      if (idx === DETAIL_COL_NB_NIGHT_COEFF27) {
        return formatDetailSummaryHoursCell(
          fmt,
          fmtHours,
          summary.nbNightCoeff27,
        );
      }
      if (idx === DETAIL_COL_TS_DAYS) {
        return fmtLeave(summary.tsDays);
      }
      if (idx === DETAIL_COL_NIGHT_SHIFT_ALLOWANCE) {
        return fmtAllowance(
          summary.nightShiftAllowanceDays *
            PAYROLL_MONTHLY_NIGHT_SHIFT_ALLOWANCE_VND,
        );
      }
      if (idx === DETAIL_COL_NIGHT_SHIFT_HOURS) {
        return formatDetailSummaryHoursCell(
          fmt,
          fmtHours,
          summary.nightShiftWindowHours,
        );
      }
    }
    const coeffIdx = coeffColBySubrow[si];
    if (coeffIdx != null && idx === DETAIL_COL_TC_START + coeffIdx) {
      return formatDetailSummaryHoursCell(fmt, fmtHours, tcByRow[coeffIdx]);
    }
    return " ";
  });
  if (!includeSoNgayCong) {
    return values.filter((_, idx) => idx !== DETAIL_COL_SO_NGAY_CONG);
  }
  return values;
}

/**
 * 3 khối (tổng / thử việc / hợp đồng) × `colsPerBlock` cột.
 * `summaries`: `{ total, trial, official }` từ `buildMonthlyRuleSummary`.
 */
export function buildMonthlyDetailFlatValues({
  si,
  summaries,
  coeffColBySubrow = MONTHLY_TIMESHEET_COEFF_COL_BY_SUBROW,
  fmt = fmtPayrollMonthlySummaryCell,
  fmtHours = null,
  fmtLeave = fmtPayrollMonthlyLeaveDayCell,
  fmtAllowance = fmtPayrollMonthlyNightShiftAllowanceCell,
  colsPerBlock = MONTH_DETAIL_COLS_PER_BLOCK,
}) {
  const total = summaries?.total ?? summaries ?? {};
  const trial = summaries?.trial ?? {};
  const official = summaries?.official ?? {};
  const blockArgs = { si, coeffColBySubrow, fmt, fmtLeave, fmtAllowance, colsPerBlock };
  return [
    ...valuesForDetailBlock({
      ...blockArgs,
      summary: total,
      fmtHours,
      includeSoNgayCong: true,
    }),
    ...valuesForDetailBlock({
      ...blockArgs,
      summary: trial,
      includeSoNgayCong: false,
    }),
    ...valuesForDetailBlock({
      ...blockArgs,
      summary: official,
      fmtHours,
      includeSoNgayCong: false,
    }),
  ];
}

/** Ma trận ô chi tiết theo dòng hệ số TC — một lần gọi cho cả NV (lưới / Excel / in). */
export function buildMonthlyDetailMatrixForEmployee(summaries, options = {}) {
  const coeffColBySubrow =
    options.coeffColBySubrow ?? MONTHLY_TIMESHEET_COEFF_COL_BY_SUBROW;
  const fmt = options.fmt ?? fmtPayrollMonthlySummaryCell;
  const fmtHours = options.fmtHours ?? null;
  const fmtLeave = options.fmtLeave ?? fmtPayrollMonthlyLeaveDayCell;
  const fmtAllowance =
    options.fmtAllowance ?? fmtPayrollMonthlyNightShiftAllowanceCell;
  const colsPerBlock = options.colsPerBlock ?? MONTH_DETAIL_COLS_PER_BLOCK;
  return PAYROLL_MONTHLY_SUBROWS.map((_, si) =>
    buildMonthlyDetailFlatValues({
      si,
      summaries,
      coeffColBySubrow,
      fmt,
      fmtHours,
      fmtLeave,
      fmtAllowance,
      colsPerBlock,
    }),
  );
}
