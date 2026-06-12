/**
 * Thuật ngữ giờ công / 연장근무 — dùng chung `attendanceList` và `salaryCalc.table`.
 * Một nguồn để đồng bộ VI/KO và tránh lặp key trong locale files.
 */

const workingHoursHintVi =
  "Giờ vào–ra dạng HH:MM. Ca ngày: vào từ 06:00 đến trước 08:00 thì mốc tính là 08:00; vào trước 06:00 giữ giờ chấm thực. Giờ công = min(chênh lệch, 8h); ca đêm: xem cột GC/TC ca đêm.";
const workingHoursHintKo =
  "HH:MM. 주간: 출근 06:00~08:00 미만이면 08:00 기준. 야간(S2)은 야간 근무/연장 열 참고.";

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
  payrollWorkingHoursHint: workingHoursHintVi,
  dayShiftOvertimeHours: "Giờ công tăng ca (×1.5)",
  dayShiftOvertimeHoursHint:
    "Ca ngày (không S2): giờ ra sau 17:30 — tính từ 17:00, 30 phút = 0,5 giờ. Vào ≤ 06:40 có giấy TC → khung 06:00–07:40 (30 phút = 0,5h). Ca đêm: «-».",
  overtimeHours: "Giờ công tăng ca (x1.5)",
  overtimeHoursHint: "Đã thay bằng cột «TC ca ngày (×1.5)» trên bảng lương.",
  offDayOvertimeHours: "Giờ công ngày off (x2.0)",
  offDayOvertimeHoursHint:
    "Cột legacy: không còn dùng cho giờ làm ngày off (giờ đó nằm ở cột Giờ công). Luôn «-».",
  offDayColumn: "Ngày off",
  offDayColumnHint:
    "Khi ngày được đánh dấu «Ngày off» trên Điểm danh: hiển thị OFF.",
  holidayDayColumn: "Ngày lễ",
  holidayDayColumnHint:
    "Khi ngày được đánh dấu «Ngày lễ»: hiển thị HOLIDAY.",
  leaveTypeColumn: "Loại phép",
  workShift: "Ca làm việc",
  holidayDayWorkingHours: "Giờ công ngày lễ (X3.0)",
  payrollOffDayTcHint:
    "Khi «Ngày off» và ca ngày: Giờ công BT + TC chiều/giấy gộp một ô; cột TC ca ngày là «-».",
  payrollHolidayDayWorkingHoursHint:
    "Khi cột ngày lễ là HOLIDAY thì giờ công sẽ hiển thị ở cột giờ công ngày lễ.",
  payrollTotalGcDay: "Tổng GC",
  payrollTotalGcDayHint:
    "Tổng khối ngày: Giờ công + TC ca ngày; ngày off/lễ ca ngày ≈ TC off/GC lễ đã gộp (cột TC ca ngày «-»); không gồm ca đêm.",
  payrollTotalGcNight: "Tổng GC ca đêm",
  payrollTotalGcNightHint:
    "Tổng khối ca đêm: GC + TC; ngày off/lễ ca đêm gộp một số (cột TC ca đêm «-»).",
  holidayNightWorkingHours: "Giờ công ca đêm ngày lễ (X3.9)",
  nightShiftWorkingHours: "Giờ công ca đêm",
  nightShiftWorkingHoursHint:
    "Chỉ khi ca «Ca đêm»: thời lượng từ giờ vào đến mốc 05:00 (05:00 cùng ngày nếu vào trước 05:00, không thì 05:00 ngày hôm sau), tối đa 8 giờ.",
  nightShiftOvertimeHours: "Giờ công tăng ca ca đêm (×1.5)",
  nightShiftOvertimeHoursHint:
    "Ca đêm (S2): phần làm sau mốc 05:00 (ngày hôm sau) — 30 phút = 0,5 giờ. Ngày off/lễ: «-» (gộp ở GC ca đêm off/lễ).",
  nightShiftOffDayWorkingHours: "Giờ công ca đêm ngày OFF (X2.7)",
  nightShiftOffDayWorkingHoursHint:
    "Khi «Ngày off» và ca «Ca đêm»: GC + TC ca đêm gộp (cùng quy tắc mốc 05:00 như ngày thường); cột TC ca đêm «-». Ngày không off thì trống.",
  payrollHolidayNightWorkingHoursHint:
    "Ngày lễ + ca đêm: GC + TC ca đêm gộp; cột TC ca đêm «-»; cột GC ca đêm «-».",
};

export const workforcePayrollSharedKo = {
  workDateDay: "일",
  workDateMonth: "월",
  workDateYear: "년",
  workingHours: "근무시간",
  workingHoursHint: workingHoursHintKo,
  payrollWorkingHoursHint: workingHoursHintKo,
  dayShiftOvertimeHours: "주간 연장 (×1.5)",
  dayShiftOvertimeHoursHint:
    "주간(비 S2): 퇴근 17:30 이후 — 17:00부터 30분당 0.5h. 야간: «-».",
  overtimeHours: "연장근무",
  overtimeHoursHint: "급여 표에서는 «주간 연장 (×1.5)» 열 사용.",
  offDayOvertimeHours: "휴무일 연장 (×2.0)",
  offDayOvertimeHoursHint:
    "레거시 열: 휴무일 근무는 근무시간 열로 이동. 항상 «-».",
  offDayColumn: "휴무일",
  offDayColumnHint: "출근 화면에서 «휴무일»로 지정된 날: OFF 표시.",
  holidayDayColumn: "공휴일",
  holidayDayColumnHint: "«공휴일»로 지정된 날: HOLIDAY 표시.",
  leaveTypeColumn: "휴가 유형",
  workShift: "근무조",
  holidayDayWorkingHours: "공휴일 근무 (×3.0)",
  payrollOffDayTcHint:
    "휴무일+주간: 근무시간+연장을 한 칸에 합산. 연장 열은 «-».",
  payrollHolidayDayWorkingHoursHint:
    "공휴일+주간: 근무시간+연장을 한 칸에 합산. 연장 열은 «-».",
  payrollTotalGcDay: "주간 근무 합계",
  payrollTotalGcDayHint:
    "주간 합계: 근무시간+연장. 휴무·공휴 주간은 한 칸에 합산(연장 열 «-»); 야간 열 제외.",
  payrollTotalGcNight: "야간 근무 합계",
  payrollTotalGcNightHint:
    "야간 합계: 근무+연장. 휴무·공휴 야간은 한 칸에 합산(야간 연장 열 «-»).",
  holidayNightWorkingHours: "공휴일 야간 (×3.9)",
  nightShiftWorkingHours: "야간 근무",
  nightShiftWorkingHoursHint:
    "야간: 출근부터 05:00(당일 05:00 이전 출근이면 당일, 아니면 다음 날 05:00)까지, 최대 8시간.",
  nightShiftOvertimeHours: "야간 연장 (×1.5)",
  nightShiftOvertimeHoursHint:
    "야간(S2): 익일 05:00 이후 — 30분당 0.5h. 휴무/공휴: «-»(합산 열 참고).",
  nightShiftOffDayWorkingHours: "휴무일 야간 (×2.7)",
  nightShiftOffDayWorkingHoursHint:
    "휴무일+야간: 근무+연장 합산. 야간 연장 열 «-». 휴무일이 아니면 비움.",
  payrollHolidayNightWorkingHoursHint:
    "공휴일+야간: 근무+연장 합산. 야간 연장 열 «-», 야간 근무 열 «-».",
};
