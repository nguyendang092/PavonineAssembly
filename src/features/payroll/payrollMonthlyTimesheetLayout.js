/**
 * Cấu trúc cột lưới / xuất Excel bảng chấm công tháng — một nguồn, khớp PayrollMonthlyTimesheetModal.
 */

/** STT + Họ tên + MNV + BP + Hệ số TC */
export const MONTHLY_TIMESHEET_STICKY_COL_COUNT = 5;
/** Độ rộng cột khối chi tiết trên lưới tháng [px]. */
export const PAYROLL_MONTHLY_DETAIL_COL_WIDTH_PX = 56;
/** Độ rộng cột khối chi tiết khi xuất Excel (đơn vị ký tự). */
export const PAYROLL_MONTHLY_DETAIL_COL_EXCEL_WIDTH = 12;
export const MONTH_DETAIL_COLS_PER_BLOCK = 16;
/** Khối tổng — đủ 16 cột (gồm «Ngày thực tế làm việc»). */
export const MONTH_DETAIL_TOTAL_COLS_PER_BLOCK = MONTH_DETAIL_COLS_PER_BLOCK;
/** Khối thử việc / hợp đồng — bỏ cột «Ngày thực tế làm việc». */
export const MONTH_DETAIL_PHASE_COLS_PER_BLOCK = 15;
/** Cột 0–6 trong khối tổng — «NGÀY LÀM VIỆC». */
export const MONTH_DETAIL_WORKDAY_COL_COUNT = 7;
/** Cột ngày làm việc khối thử việc / hợp đồng (không có «Ngày thực tế làm việc»). */
export const MONTH_DETAIL_PHASE_WORKDAY_COL_COUNT = 6;
/** Cột 7–15 — «TĂNG CA (Hrs)» (6 TC + 2 NB + Tổng GC ca đêm). */
export const MONTH_DETAIL_OT_COL_COUNT = 9;
/** Cột SAT.S — đã bỏ khỏi lưới / Excel. */
export const MONTH_DETAIL_SATS_COL_COUNT = 0;
export const DETAIL_GROUP_KEYS = ["total", "trial", "official"];

/** Số cột từng khối chi tiết: tổng 16, thử việc/hợp đồng 15. */
export const MONTHLY_DETAIL_BLOCK_COL_COUNTS = Object.freeze([
  MONTH_DETAIL_TOTAL_COLS_PER_BLOCK,
  MONTH_DETAIL_PHASE_COLS_PER_BLOCK,
  MONTH_DETAIL_PHASE_COLS_PER_BLOCK,
]);

export function monthlyDetailBlockColCount(groupIndex) {
  return (
    MONTHLY_DETAIL_BLOCK_COL_COUNTS[groupIndex] ??
    MONTH_DETAIL_TOTAL_COLS_PER_BLOCK
  );
}

export function monthlyDetailFlatColCount() {
  return MONTHLY_DETAIL_BLOCK_COL_COUNTS.reduce((sum, n) => sum + n, 0);
}

/** Chuyển (khối, cột trong khối) → chỉ số phẳng trong `detailFlat`. */
export function resolveMonthlyDetailFlatIndex(groupIndex, colInBlock) {
  let offset = 0;
  for (let i = 0; i < groupIndex; i++) {
    offset += monthlyDetailBlockColCount(i);
  }
  return offset + colInBlock;
}

/** Chuyển chỉ số phẳng → `{ groupIndex, colInBlock }`. */
export function resolveMonthlyDetailGroupAndCol(flatIdx) {
  let rem = flatIdx;
  for (let g = 0; g < MONTHLY_DETAIL_BLOCK_COL_COUNTS.length; g++) {
    const width = monthlyDetailBlockColCount(g);
    if (rem < width) return { groupIndex: g, colInBlock: rem };
    rem -= width;
  }
  return { groupIndex: 0, colInBlock: 0 };
}

/** Chỉ số cột 0-based — khối chi tiết trên lưới / Excel. */
export function resolveMonthlyDetailBlockStart(layout, groupIndex) {
  if (groupIndex === 1) return layout.trialDetailStart;
  if (groupIndex === 2) return layout.officialDetailStart;
  return layout.totalDetailStart;
}

/** Ghi `detailFlat` vào hàng xuất Excel — cùng map cột với PayrollMonthlyTimesheetModal. */
export function assignMonthlyDetailFlatToExportRow(row, layout, detailFlat) {
  if (!Array.isArray(detailFlat) || !row || !layout) return;
  for (let flatIdx = 0; flatIdx < detailFlat.length; flatIdx += 1) {
    const { groupIndex, colInBlock } = resolveMonthlyDetailGroupAndCol(flatIdx);
    const blockStart = resolveMonthlyDetailBlockStart(layout, groupIndex);
    row[blockStart + colInBlock] = detailFlat[flatIdx];
  }
}

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
    monthlyDetailFlatColCount()
  );
}

/** Chỉ số cột 0-based cho lưới / Excel. */
export function payrollMonthlyTimesheetLayoutOffsets(monthKeyCount) {
  const days = monthKeyCount;
  const leading = MONTHLY_TIMESHEET_STICKY_COL_COUNT;
  const totalBlock = MONTH_DETAIL_TOTAL_COLS_PER_BLOCK;
  const phaseBlock = MONTH_DETAIL_PHASE_COLS_PER_BLOCK;
  return {
    leading,
    days,
    totalDetailStart: leading + days,
    trialDetailStart: leading + days + totalBlock,
    officialDetailStart: leading + days + totalBlock + phaseBlock,
    totalCols: payrollMonthlyTimesheetTotalColCount(monthKeyCount),
  };
}

/** 16 cột chi tiết — dùng chung lưới và Excel. */
export function buildPayrollMonthlyTimesheetDetailHeaders(
  tlPage,
  { includeSoNgayCong = true } = {},
) {
  const headers = [
    tlPage("monthlyRuleColSoNgayCong", "Ngày thực tế làm việc"),
    tlPage("monthlyRuleColWorkDays", "Tổng ngày công (gồm ngày nghỉ có lương)"),
    tlPage("monthlyRuleColUnpaid", "Tổng ngày nghỉ không có lương"),
    tlPage("monthlyRuleColPn", "Phép năm (PN)"),
    tlPage("monthlyRuleColNb", "Nghỉ bù (NB)"),
    tlPage("monthlyRuleColKl", "Nghỉ không lương (KL)"),
    tlPage("monthlyRuleColKp", "Nghỉ không phép (KP)"),
    tlPage("monthlyRuleColCoeff03", "Giờ làm (×0.3)"),
    tlPage("monthlyRuleColCoeff15", "TC ngày thường / TC ca đêm (×1.5)"),
    tlPage("monthlyRuleColCoeff20", "TC ngày off ca ngày (×2.0)"),
    tlPage("monthlyRuleColCoeff27", "TC ca đêm ngày off (×2.7)"),
    tlPage("monthlyRuleColCoeff30", "TC ngày lễ (×3.0)"),
    tlPage("monthlyRuleColCoeff39", "TC đêm ngày lễ (×3.9)"),
    tlPage("monthlyRuleColNbDayCoeff20", "Giờ công ca ngày NB (×2.0)"),
    tlPage("monthlyRuleColNbNightCoeff27", "Giờ công ca đêm NB (×2.7)"),
    tlPage("monthlyRuleColNightShiftTotalHours", "Tổng GC ca đêm"),
  ];
  return includeSoNgayCong ? headers : headers.slice(1);
}

export function buildPayrollMonthlyTimesheetDetailHeadersByGroup(tlPage) {
  const total = buildPayrollMonthlyTimesheetDetailHeaders(tlPage, {
    includeSoNgayCong: true,
  });
  const phase = buildPayrollMonthlyTimesheetDetailHeaders(tlPage, {
    includeSoNgayCong: false,
  });
  return { total, trial: phase, official: phase };
}
