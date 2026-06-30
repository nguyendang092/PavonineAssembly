/**
 * Thuật ngữ giờ công / 연장근무 — dùng chung `attendanceList` và `salaryCalc.table`.
 * Gợi ý cột (title) ngắn gọn, đồng bộ VI/KO.
 */

const workingHoursHintVi =
  "HH:MM vào–ra. Ca ngày: vào 06–08h → mốc 08h. GC max 8h. Ca đêm: cột GC/TC đêm.";
const workingHoursHintKo =
  "HH:MM. 주간 06–08h 출근 → 08h 기준. GC 최대 8h. 야간은 야간 열 참고.";

/** Ô tìm / lọc — attendance + bảng lương + modal giấy TC. */
export const workforceSearchUiVi = {
  searchPlaceholder: "🔍 Tìm theo tên, MNV, bộ phận…",
  searchPlaceholderPayroll: "Tìm theo tên, MNV, bộ phận…",
  searchFilterPlaceholder: "Lọc theo tên / MNV / bộ phận",
  deptAll: "Tất cả bộ phận",
};

export const workforceSearchUiKo = {
  searchPlaceholder: "🔍 이름·사번·부서 검색…",
  searchPlaceholderPayroll: "이름·사번·부서 검색…",
  searchFilterPlaceholder: "이름 / 사번 / 부서로 필터",
  deptAll: "전체 부서",
};

/** Cột giờ + gợi ý cột — điểm danh & bảng lương. */
export const workforcePayrollSharedVi = {
  workDateDay: "Ngày",
  workDateMonth: "Tháng",
  workDateYear: "Năm",
  workingHours: "Giờ công",
  workingHoursHint: workingHoursHintVi,
  payrollWorkingHoursHint:
    "Ngày thường: GC theo vào–ra. Ngày off: «-» (GC ở TC off).",
  dayShiftOvertimeHours: "Giờ công tăng ca (×1.5)",
  dayShiftOvertimeHoursHint:
    "Ca ngày: TC sau 17:30. TC sớm có giấy ≤06:40. Ca đêm: «-».",
  overtimeHours: "Giờ công tăng ca (x1.5)",
  overtimeHoursHint: "Dùng cột TC ca ngày (×1.5).",
  offDayOvertimeHours: "Giờ công ngày off (x2.0)",
  offDayOvertimeHoursHint: "Cột cũ — luôn «-».",
  offDayColumn: "Ngày off",
  offDayColumnHint: "Ngày off → OFF.",
  holidayDayColumn: "Ngày lễ",
  holidayDayColumnHint: "Ngày lễ → HOLIDAY.",
  leaveTypeColumn: "Loại phép",
  leaveTypeColumnHint: "Loại phép (PN, PO, …).",
  workShift: "Ca làm việc",
  workShiftColumnHint: "Ca S1 ngày / S2 đêm.",
  timeInColumnHint: "Giờ vào HH:MM.",
  gioVaoEditOnlyViaModalHint: "Dùng nút Sửa để nhập.",
  leaveTypeEditViaModalHint: "Dùng nút Sửa để chọn.",
  shiftEditOnlyViaModalHint: "Dùng nút Sửa để chọn ca.",
  shiftEditViaModalHint: "Dùng nút Sửa để chọn ca.",
  annualLeaveBalance: "Phép năm",
  annualLeaveBalanceHint: "Phép còn (BALANCE) — theo MNV.",
  holidayDayWorkingHours: "Giờ công ngày lễ (X3.0)",
  payrollOffDayTcHint: "Off + ca ngày: GC+TC gộp; TC ca ngày «-».",
  payrollHolidayDayWorkingHoursHint: "Lễ + ca ngày: GC+TC gộp; TC ca ngày «-».",
  payrollTotalGcDay: "Tổng GC",
  payrollTotalGcDayHint: "Tổng ca ngày: GC + TC (off/lễ gộp một ô).",
  payrollTotalGcNight: "Tổng GC ca đêm",
  payrollTotalGcNightHint: "Tổng ca đêm: GC + TC (off/lễ gộp một ô).",
  holidayNightWorkingHours: "Giờ công ca đêm ngày lễ (X3.9)",
  nightShiftWorkingHours: "Giờ công ca đêm",
  nightShiftWorkingHoursHint: "Ca đêm: GC 19:40→05:00, max 8h.",
  nightShiftOvertimeHours: "Giờ công tăng ca ca đêm (×1.5)",
  nightShiftOvertimeHoursHint: "Ca đêm: sau 05:00, 30' = 0,5h. Off/lễ: gộp GC đêm.",
  nightShiftOffDayWorkingHours: "Giờ công ca đêm ngày OFF (X2.7)",
  nightShiftOffDayWorkingHoursHint: "Off + ca đêm: GC+TC gộp; TC đêm «-».",
  payrollHolidayNightWorkingHoursHint: "Lễ + ca đêm: GC+TC gộp; TC/GC đêm «-».",
};

export const workforcePayrollSharedKo = {
  workDateDay: "일",
  workDateMonth: "월",
  workDateYear: "년",
  workingHours: "근무시간",
  workingHoursHint: workingHoursHintKo,
  payrollWorkingHoursHint: "평일: 입출근 기준 GC. 휴무일: «-»(휴무 연장 열).",
  dayShiftOvertimeHours: "주간 연장 (×1.5)",
  dayShiftOvertimeHoursHint:
    "주간: 17:30 이후 TC. 조출 서류 ≤06:40. 야간: «-».",
  overtimeHours: "연장근무",
  overtimeHoursHint: "«주간 연장 (×1.5)» 열 사용.",
  offDayOvertimeHours: "휴무일 연장 (×2.0)",
  offDayOvertimeHoursHint: "레거시 — 항상 «-».",
  offDayColumn: "휴무일",
  offDayColumnHint: "휴무일 → OFF.",
  holidayDayColumn: "공휴일",
  holidayDayColumnHint: "공휴일 → HOLIDAY.",
  leaveTypeColumn: "휴가 유형",
  leaveTypeColumnHint: "휴가 유형 (PN, PO, …).",
  workShift: "근무조",
  workShiftColumnHint: "S1 주간 / S2 야간.",
  timeInColumnHint: "출근 HH:MM.",
  gioVaoEditOnlyViaModalHint: "수정 버튼으로 입력.",
  leaveTypeEditViaModalHint: "수정 버튼으로 선택.",
  shiftEditOnlyViaModalHint: "수정 버튼으로 조 선택.",
  shiftEditViaModalHint: "수정 버튼으로 조 선택.",
  annualLeaveBalance: "연차",
  annualLeaveBalanceHint: "잔여 연차(BALANCE) — 사번 매칭.",
  holidayDayWorkingHours: "공휴일 근무 (×3.0)",
  payrollOffDayTcHint: "휴무+주간: GC+TC 합산. 연장 열 «-».",
  payrollHolidayDayWorkingHoursHint: "공휴+주간: GC+TC 합산. 연장 열 «-».",
  payrollTotalGcDay: "주간 근무 합계",
  payrollTotalGcDayHint: "주간 합계: GC+TC (휴무·공휴 한 칸).",
  payrollTotalGcNight: "야간 근무 합계",
  payrollTotalGcNightHint: "야간 합계: GC+TC (휴무·공휴 한 칸).",
  holidayNightWorkingHours: "공휴일 야간 (×3.9)",
  nightShiftWorkingHours: "야간 근무",
  nightShiftWorkingHoursHint: "야간: 19:40→05:00, 최대 8h.",
  nightShiftOvertimeHours: "야간 연장 (×1.5)",
  nightShiftOvertimeHoursHint: "야간: 05:00 이후, 30분=0.5h. 휴무/공휴는 야간 GC.",
  nightShiftOffDayWorkingHours: "휴무일 야간 (×2.7)",
  nightShiftOffDayWorkingHoursHint: "휴무+야간: GC+TC 합산. 야간 연장 «-».",
  payrollHolidayNightWorkingHoursHint: "공휴+야간: GC+TC 합산. 야간 열 «-».",
};
