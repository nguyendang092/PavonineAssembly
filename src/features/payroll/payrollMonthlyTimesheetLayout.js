/**
 * Cấu trúc cột lưới / xuất Excel bảng chấm công tháng — một nguồn, khớp PayrollMonthlyTimesheetModal.
 */

/** STT + Họ tên + MNV + BP + Hệ số TC */
export const MONTHLY_TIMESHEET_STICKY_COL_COUNT = 5;
export const MONTH_DETAIL_COLS_PER_BLOCK = 17;
export const DETAIL_GROUP_KEYS = ["total", "trial", "official"];

/** Nhãn nhóm SAT.S — lưới / in A3. */
export const PAYROLL_MONTHLY_DETAIL_GROUP_SATS_LABEL = "SAT.S";

/** `si` dòng con → chỉ số cột TC (0..5) trong khối chi tiết (sau cột «Tổng thời gian ca đêm»). */
export const MONTHLY_TIMESHEET_COEFF_COL_BY_SUBROW = {
  1: 0,
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
};

export function payrollMonthlyTimesheetTotalColCount(monthKeyCount) {
  return (
    MONTHLY_TIMESHEET_STICKY_COL_COUNT +
    monthKeyCount +
    DETAIL_GROUP_KEYS.length * MONTH_DETAIL_COLS_PER_BLOCK
  );
}

/** Chỉ số cột 0-based cho lưới / Excel. */
export function payrollMonthlyTimesheetLayoutOffsets(monthKeyCount) {
  const days = monthKeyCount;
  const leading = MONTHLY_TIMESHEET_STICKY_COL_COUNT;
  const block = MONTH_DETAIL_COLS_PER_BLOCK;
  return {
    leading,
    days,
    totalDetailStart: leading + days,
    trialDetailStart: leading + days + block,
    officialDetailStart: leading + days + 2 * block,
    totalCols: payrollMonthlyTimesheetTotalColCount(monthKeyCount),
  };
}

/** 17 cột chi tiết × 3 khối — dùng chung lưới và Excel. */
export function buildPayrollMonthlyTimesheetDetailHeaders(tlPage) {
  return [
    tlPage("monthlyRuleColSoNgayCong", "Ngày công chuẩn"),
    tlPage("monthlyRuleColWorkHours", "Tổng GC thực tế"),
    tlPage("monthlyRuleColWorkDays", "Ngày công thực tế"),
    tlPage("monthlyRuleColNightShiftTotalHours", "Tổng GC ca đêm"),
    tlPage("monthlyRuleColUnpaid", "Tổng ngày nghỉ KL"),
    tlPage("monthlyRuleColPn", "Phép năm (PN)"),
    tlPage("monthlyRuleColNb", "Nghỉ bù (NB)"),
    tlPage("monthlyRuleColKl", "Nghỉ KL (KL)"),
    tlPage("monthlyRuleColKp", "Nghỉ KP (KP)"),
    "Giờ làm (X0.3)",
    "TC ngày thường / TC ca đêm (X1.5)",
    "TC ngày off ca ngày (X2.0)",
    "TC ca đêm ngày off (X2.7)",
    "TC ngày lễ (X3.0)",
    "TC đêm ngày lễ (x3.9)",
    "Sat.S ngày công / (X2.0)",
    "Sat.S (X2.7)",
  ];
}
