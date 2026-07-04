/**
 * Cấu trúc cột lưới / xuất Excel bảng chấm công tháng — một nguồn, khớp PayrollMonthlyTimesheetModal.
 */

/** STT + Họ tên + MNV + BP + Hệ số TC */
export const MONTHLY_TIMESHEET_STICKY_COL_COUNT = 5;
export const MONTH_DETAIL_COLS_PER_BLOCK = 14;
/** Cột 0–6 trong mỗi khối chi tiết — «NGÀY LÀM VIỆC». */
export const MONTH_DETAIL_WORKDAY_COL_COUNT = 7;
/** Cột 7–13 — «TĂNG CA (Hrs)» (gồm 6 cột TC + Tổng GC ca đêm). */
export const MONTH_DETAIL_OT_COL_COUNT = 7;
/** Cột SAT.S — đã bỏ khỏi lưới / Excel. */
export const MONTH_DETAIL_SATS_COL_COUNT = 0;
export const DETAIL_GROUP_KEYS = ["total", "trial", "official"];

/** Nhãn nhóm SAT.S — lưới / in A3. */
export const PAYROLL_MONTHLY_DETAIL_GROUP_SATS_LABEL = "SAT.S";

/** `si` dòng con → chỉ số cột TC (0..5) trong khối chi tiết. */
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

/** 14 cột chi tiết × 3 khối — dùng chung lưới và Excel. */
export function buildPayrollMonthlyTimesheetDetailHeaders(tlPage) {
  return [
    tlPage("monthlyRuleColSoNgayCong", "Ngày công chuẩn"),
    tlPage("monthlyRuleColWorkDays", "Tổng ngày công (gồm ngày nghỉ có lương)"),
    tlPage("monthlyRuleColUnpaid", "Tổng ngày nghỉ không có lương"),
    tlPage("monthlyRuleColPn", "Phép năm (PN)"),
    tlPage("monthlyRuleColNb", "Nghỉ bù (NB)"),
    tlPage("monthlyRuleColKl", "Nghỉ KL (KL)"),
    tlPage("monthlyRuleColKp", "Nghỉ KP (KP)"),
    tlPage("monthlyRuleColCoeff03", "Giờ làm (×0.3)"),
    tlPage("monthlyRuleColCoeff15", "TC ngày thường / TC ca đêm (×1.5)"),
    tlPage("monthlyRuleColCoeff20", "TC ngày off ca ngày (×2.0)"),
    tlPage("monthlyRuleColCoeff27", "TC ca đêm ngày off (×2.7)"),
    tlPage("monthlyRuleColCoeff30", "TC ngày lễ (×3.0)"),
    tlPage("monthlyRuleColCoeff39", "TC đêm ngày lễ (×3.9)"),
    tlPage("monthlyRuleColNightShiftTotalHours", "Tổng GC ca đêm"),
  ];
}
