import {
  formatCoeffHoursForDisplay,
  getPayrollMonthlyCoeffHoursMap,
  getPayrollMonthlyMainRowCell,
  PAYROLL_MONTHLY_SUBROWS,
} from "@/features/payroll/payrollMonthlyCoefficientBuckets";
import { payrollOtDayParamsFromEmp } from "@/features/payroll/payrollOtDayParams";
import {
  PAYROLL_EMP,
  pickPayrollEmployeeProfileDates,
} from "@/features/payroll/payrollEmployeeFields";
import {
  MONTH_DETAIL_COLS_PER_BLOCK,
  MONTHLY_TIMESHEET_COEFF_COL_BY_SUBROW,
} from "@/features/payroll/payrollMonthlyTimesheetLayout";
import { isDuocNghiBuExplicitlyNo } from "@/features/attendance/attendanceDayMeta";
import {
  getNightShiftTotalWindowHours22To05,
  isNightShiftCaLamViec,
  roundHoursForPayrollDisplay,
} from "@/features/attendance/attendanceWorkingHours";
import { normalizeDateForHtmlInput } from "@/utils/attendanceEmployeeRecord";
import { parseLocalDateKey } from "@/utils/dateKey";

/** Ô tổng hợp khối THỜI GIAN LÀM VIỆC — ẩn số 0. */
export function fmtPayrollMonthlySummaryCell(n) {
  return Number.isFinite(n) && roundHoursForPayrollDisplay(n) !== 0
    ? formatCoeffHoursForDisplay(n)
    : " ";
}

/** Chuẩn hóa ngày hồ sơ (ngày vào làm / ngày HĐ) để so sánh với `dateKey` YYYY-MM-DD. */
export function normalizeProfileDateKey(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const norm = normalizeDateForHtmlInput(s);
  return norm || s.slice(0, 10);
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
) {
  const join = normalizeProfileDateKey(joinDateRaw);
  const contract = normalizeProfileDateKey(contractDateRaw);
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
export function isPayrollMonthDayOnOrAfterJoin(dateKey, joinDateRaw) {
  const join = normalizeProfileDateKey(joinDateRaw);
  const dk = String(dateKey ?? "").trim();
  if (!join || !dk) return true;
  return dk >= join;
}

/** Số ngày công chuẩn tháng (trừ CN) từ ngày vào làm; không có ngày vào làm → cả tháng. */
export function countEmployedStandardWorkDaysInMonth(monthKeys, joinDateRaw) {
  let n = 0;
  for (const dk of monthKeys) {
    if (!isPayrollMonthDayOnOrAfterJoin(dk, joinDateRaw)) continue;
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
      monthlyWorkPhaseForDateKey(dk, joinDateRaw, contractDateRaw) === phase
    ) {
      n += 1;
    }
  }
  return n;
}

/**
 * Số ngày công chuẩn tháng (trừ Chủ nhật) — dùng chung cho cả 3 khối cột chi tiết.
 */
export function countMonthlyStandardWorkDays(monthKeys) {
  return countPhaseCalendarWorkDaysInMonth(monthKeys, "", "", null);
}

/**
 * Thứ Bảy được đánh dấu «Ngày off» (không phải lễ / nghỉ bù) — khối SAT.S.
 * @param {string} dateKey
 * @param {{ isOffDay?: boolean, isHolidayDay?: boolean } | null | undefined} ch
 */
export function isPayrollSaturdayOffWorkDay(dateKey, ch) {
  if (!ch?.isOffDay || ch.isHolidayDay) return false;
  const pd = parseLocalDateKey(dateKey);
  return Boolean(pd && pd.getDay() === 6);
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

function leaveExcludedFromIncludedWorkDays(leaveShort) {
  return (
    leaveUnitsByCode(leaveShort, "KL") > 0 ||
    leaveUnitsByCode(leaveShort, "KP") > 0 ||
    leaveUnitsByCode(leaveShort, "NV") > 0
  );
}

function countedLeaveUnitsForWorkDays(leaveShort) {
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
 * - **THỜI GIAN THỬ VIỆC** (`trial`): có ngày HĐ — ngày từ ngày vào làm đến trước ngày HĐ.
 * - **THỜI GIAN HỢP ĐỒNG** (`official`): từ ngày HĐ; không có ngày HĐ → mặc định toàn bộ (từ ngày vào làm).
 * - **Số ngày công chuẩn** (`standardWorkDays`): cùng một giá trị cả tháng cho cả 3 khối.
 */
export function buildMonthlyRuleSummary(
  dayChunks,
  monthKeys,
  id,
  employeeProfile = {},
) {
  const { joinDate, contractDate } =
    pickPayrollEmployeeProfileDates(employeeProfile);
  const join = normalizeProfileDateKey(joinDate);
  const contract = normalizeProfileDateKey(contractDate);
  const hasContract = Boolean(contract);
  const standardWorkDaysCount = countEmployedStandardWorkDaysInMonth(
    monthKeys,
    join,
  );

  const createEmptySummary = () => ({
    workDays: 0,
    workHours: 0,
    unpaidDays: 0,
    pnDays: 0,
    nbDays: 0,
    klDays: 0,
    kpDays: 0,
    coeff03: 0,
    coeff15: 0,
    coeff20: 0,
    coeff27: 0,
    coeff30: 0,
    coeff39: 0,
    sats20: 0,
    sats27: 0,
    /** Thứ Bảy OFF có giờ công — đếm ngày công riêng (hiển thị cột SAT.S). */
    satsWorkDays: 0,
    /** Ca S2: giờ trong khung 22:00–05:00 (tối đa 8h / ngày). */
    nightShiftWindowHours: 0,
    standardWorkDays: standardWorkDaysCount,
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
    if (!isPayrollSaturdayOffWorkDay(dateKey, ch)) return;
    if (!isNightShiftCaLamViec(emp?.caLamViec)) return;
    const h27 = Number(coeffMap.get(2.7) || 0);
    if (h27 > 0) out.sats27 += h27;
  };

  const isNbVisibleForCompDay = (ch, emp) => {
    if (!ch?.isCompensatoryDay) return false;
    if (emp == null) return true;
    return !isDuocNghiBuExplicitlyNo(emp[PAYROLL_EMP.COMP_LEAVE_ALLOWED]);
  };

  const computeHolidayWorkCreditForDash = (ch, coeffSum, emp) => {
    if (ch.isHolidayDay) return 1;
    if (isNbVisibleForCompDay(ch, emp)) return 1;
    return coeffSum > 0 ? 1 : 0;
  };

  const computeIncludedWorkDayCreditForLeave = ({ ch, main, coeffSum }) => {
    /** BGC: có mặt, chưa có giờ vào — vẫn tính 1 ngày công; giờ bổ sung sau. */
    if (main.leaveShort === "BGC") return 1;

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

  const applyDayToSummary = (out, ch, emp, dateKey) => {
    if (!emp) {
      if (ch.isHolidayDay || isNbVisibleForCompDay(ch, null)) out.workDays += 1;
      return;
    }

    const saturdayOff = isPayrollSaturdayOffWorkDay(dateKey, ch);
    const main = getPayrollMonthlyMainRowCell(emp, ch);
    const coeffMap = getPayrollMonthlyCoeffHoursMap(
      payrollOtDayParamsFromEmp(emp, ch),
    );
    const coeffSum = sumPayrollMonthlyCoeffHours(coeffMap);
    const addWorkedHours = (hours) => {
      if (Number.isFinite(hours) && hours > 0) out.workHours += hours;
    };

    if (main.kind === "leave") {
      const pnUnits = leaveUnitsByCode(main.leaveShort, "PN");
      out.pnDays += pnUnits;
      out.nbDays += leaveUnitsByCode(main.leaveShort, "NB");
      out.klDays += leaveUnitsByCode(main.leaveShort, "KL");
      out.kpDays += leaveUnitsByCode(main.leaveShort, "KP");
      addWorkedHours(main.workedHours);

      out.workDays += computeIncludedWorkDayCreditForLeave({
        ch,
        main,
        coeffSum,
      });
    } else if (main.kind === "hours") {
      addWorkedHours(main.hours);
      addWorkedHours(coeffSum);
      out.workDays += 1;
    } else {
      addWorkedHours(coeffSum);
      if (saturdayOff && coeffSum > 0) {
        out.satsWorkDays += 1;
        out.workDays += 1;
      } else {
        out.workDays += computeHolidayWorkCreditForDash(ch, coeffSum, emp);
      }
    }

    addCoeffHoursToTotals(out, coeffMap);
    addSaturdaySatOverlay(out, coeffMap, dateKey, ch, emp);

    const nightH = getNightShiftTotalWindowHours22To05(
      emp[PAYROLL_EMP.TIME_IN],
      emp[PAYROLL_EMP.TIME_OUT],
      emp[PAYROLL_EMP.SHIFT],
    );
    if (Number.isFinite(nightH) && nightH > 0) {
      out.nightShiftWindowHours += nightH;
    }
  };

  for (const dk of monthKeys) {
    const ch = dayChunks.get(dk);
    if (!ch) continue;
    if (!isPayrollMonthDayOnOrAfterJoin(dk, join)) continue;

    const emp = (ch.byMonthEmployeeKey || ch.byId).get(id);
    const phase = monthlyWorkPhaseForDateKey(dk, join, contract);

    applyDayToSummary(total, ch, emp, dk);
    if (hasContract && phase === "trial") {
      applyDayToSummary(trial, ch, emp, dk);
    } else if (phase === "official") {
      applyDayToSummary(official, ch, emp, dk);
    }
  }

  const finalizeSummary = (out) => {
    out.unpaidDays = out.klDays + out.kpDays;
    out.workDays = Math.min(out.workDays, out.standardWorkDays);
  };
  finalizeSummary(total);
  finalizeSummary(trial);
  finalizeSummary(official);
  return { total, trial, official };
}

/** Chỉ số cột trong khối chi tiết (`MONTH_DETAIL_COLS_PER_BLOCK`). */
const DETAIL_COL_SO_NGAY_CONG = 0;
const DETAIL_COL_WORK_HOURS = 1;
const DETAIL_COL_WORK_DAYS = 2;
const DETAIL_COL_NIGHT_SHIFT_HOURS = 3;
const DETAIL_COL_TC_START = 9;
const DETAIL_COL_SATS_WORK_DAYS = 15;

/**
 * 17 cột một khối THỜI GIAN *.
 * - `si === 0`: ngày công + tổng TC (cột 9–14) từ `summary.coeff**` (một nguồn `buildMonthlyRuleSummary`).
 * - `si > 0`: mirror một ô TC tương ứng — cùng giá trị tổng, không tính lại.
 */
function valuesForDetailBlock({
  si,
  summary,
  coeffColBySubrow,
  fmt,
  colsPerBlock,
}) {
  const tcByRow = [
    summary.coeff03,
    summary.coeff15,
    summary.coeff20,
    summary.coeff27,
    summary.coeff30,
    summary.coeff39,
  ];
  return Array.from({ length: colsPerBlock }, (_, idx) => {
    if (si === 0) {
      if (idx === DETAIL_COL_SO_NGAY_CONG) return fmt(summary.standardWorkDays);
      if (idx === DETAIL_COL_WORK_HOURS) return fmt(summary.workHours);
      if (idx === DETAIL_COL_WORK_DAYS) return fmt(summary.workDays);
      if (idx === DETAIL_COL_NIGHT_SHIFT_HOURS) {
        return fmt(summary.nightShiftWindowHours);
      }
      if (idx === 4) return fmt(summary.unpaidDays);
      if (idx === 5) return fmt(summary.pnDays);
      if (idx === 6) return fmt(summary.nbDays);
      if (idx === 7) return fmt(summary.klDays);
      if (idx === 8) return fmt(summary.kpDays);
      if (idx >= DETAIL_COL_TC_START && idx <= DETAIL_COL_TC_START + 5) {
        return fmt(tcByRow[idx - DETAIL_COL_TC_START]);
      }
    }
    const coeffIdx = coeffColBySubrow[si];
    if (coeffIdx != null && idx === DETAIL_COL_TC_START + coeffIdx) {
      return fmt(tcByRow[coeffIdx]);
    }
    if (si === 0 && idx === DETAIL_COL_SATS_WORK_DAYS) {
      const n = summary.satsWorkDays;
      return Number.isFinite(n) && n > 0 ? String(Math.round(n)) : " ";
    }
    if (si === 3 && idx === DETAIL_COL_SATS_WORK_DAYS) {
      return fmt(summary.sats20);
    }
    if (si === 4 && idx === DETAIL_COL_SATS_WORK_DAYS + 1) {
      return fmt(summary.sats27);
    }
    return " ";
  });
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
  colsPerBlock = MONTH_DETAIL_COLS_PER_BLOCK,
}) {
  const total = summaries?.total ?? summaries ?? {};
  const trial = summaries?.trial ?? {};
  const official = summaries?.official ?? {};
  const blockArgs = { si, coeffColBySubrow, fmt, colsPerBlock };
  return [
    ...valuesForDetailBlock({ ...blockArgs, summary: total }),
    ...valuesForDetailBlock({ ...blockArgs, summary: trial }),
    ...valuesForDetailBlock({ ...blockArgs, summary: official }),
  ];
}

/** Ma trận ô chi tiết theo dòng hệ số TC — một lần gọi cho cả NV (lưới / Excel / in). */
export function buildMonthlyDetailMatrixForEmployee(
  summaries,
  options = {},
) {
  const coeffColBySubrow =
    options.coeffColBySubrow ?? MONTHLY_TIMESHEET_COEFF_COL_BY_SUBROW;
  const fmt = options.fmt ?? fmtPayrollMonthlySummaryCell;
  const colsPerBlock = options.colsPerBlock ?? MONTH_DETAIL_COLS_PER_BLOCK;
  return PAYROLL_MONTHLY_SUBROWS.map((_, si) =>
    buildMonthlyDetailFlatValues({
      si,
      summaries,
      coeffColBySubrow,
      fmt,
      colsPerBlock,
    }),
  );
}
