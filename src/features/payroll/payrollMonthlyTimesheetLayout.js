/**
 * Cấu trúc cột lưới / xuất Excel bảng chấm công tháng — một nguồn, khớp PayrollMonthlyTimesheetModal.
 */

export const MONTHLY_TIMESHEET_STICKY_COL_COUNT = 4;
export const MONTH_DETAIL_COLS_PER_BLOCK = 16;
export const DETAIL_GROUP_KEYS = ["total", "trial", "official"];

/** Nhãn nhóm SAT.S trên hàng header 2 (giống lưới). */
export const PAYROLL_MONTHLY_DETAIL_GROUP_SATS_LABEL = "SAT.S";

export function payrollMonthlyTimesheetTotalColCount(monthKeyCount) {
  return (
    MONTHLY_TIMESHEET_STICKY_COL_COUNT +
    monthKeyCount +
    DETAIL_GROUP_KEYS.length * MONTH_DETAIL_COLS_PER_BLOCK
  );
}

/** Chỉ số cột 0-based cho merge / ghi ô. */
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

/** 16 cột chi tiết × 3 khối — dùng chung lưới và Excel. */
export function buildPayrollMonthlyTimesheetDetailHeaders(tlPage) {
  return [
    tlPage("monthlyRuleColSoNgayCong", "Ngày công chuẩn"),
    tlPage("monthlyRuleColWorkHours", "Tổng GC thực tế"),
    tlPage("monthlyRuleColWorkDays", "Ngày công thực tế"),
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
