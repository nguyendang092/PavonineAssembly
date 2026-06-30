import { isAttendanceActualLeaveType } from "@/features/attendance/attendanceGioVaoTypeOptions";
import { formatAttendanceLeaveTypeColumnDisplay } from "@/features/attendance/attendanceGioVaoTypeOptions";
import {
  DAY_EARLY_OT_MAX_HOURS,
  DAY_EARLY_PAPERWORK_CUTOFF_MIN,
  dayEarlyPaperworkOvertimeMinutes,
  NIGHT_EARLY_OT_MAX_HOURS,
  nightEarlyPaperworkOvertimeMinutes,
  NIGHT_SHIFT_EARLY_OT_GC_START_MIN,
  NIGHT_SHIFT_EARLY_PAPERWORK_MIN_IN_MIN,
  NIGHT_SHIFT_OFFICIAL_START_MIN,
  sumPaperworkOvertimeSegmentMinutes,
} from "@/features/payroll/payrollEarlyOvertimeWindows";

export {
  NIGHT_SHIFT_EARLY_PAPERWORK_MIN_IN_MIN,
  NIGHT_SHIFT_OFFICIAL_START_MIN,
} from "@/features/payroll/payrollEarlyOvertimeWindows";

/**
 * Giờ công hiển thị trên bảng điểm danh / lương.
 * Ca ngày: chia khung làm việc thành 2 khoảng loại trừ nghỉ trưa `12:00–13:00`:
 * - Sáng: `08:00–12:00`
 * - Chiều: `13:00–17:00`
 *
 * Khi chấm sớm: dùng **mốc vào hiệu lực** để tính thời lượng — **08:00** nếu chấm từ
 * **06:00** đến **trước 08:00**; **trước 06:00** vẫn dùng **giờ chấm thực** (nhưng phần
 * trước 08:00 vẫn bị loại trừ vì không nằm trong khung làm việc).
 *
 * Giờ công = tổng thời lượng (giao thời gian [giờ vào, giờ ra) với các khung làm việc),
 * làm tròn 0.1h, **tối đa 8 giờ** (phần trên 8h không cộng ở đây vì đã tách sang cột giờ tăng ca).
 *
 * **Ca đêm:** `caLamViec` là **S2** (cùng quy tắc `isNightShiftCaLamViec` / thống kê combo). Khi
 * `giờ ra` ≤ `giờ vào` (ví dụ 22:00 → 06:00) hệ thống coi là **qua nửa đêm**:
 * thời lượng = (24h − vào) + ra, trần 8h. Cột **Giờ TC** (tăng ca sau 17:30) vẫn
 * theo quy tắc ngày — ca đêm ra sáng thường không tính TC kiểu đó; cần quy định
 * riêng nếu công ty có phụ cấp ca đêm.
 *
 * **Giờ công ca đêm / TC ca đêm (cột lương riêng):** chỉ khi `caLamViec` là ca đêm.
 * Mốc **05:00** lấy là **05:00 cùng ngày** với giờ vào nếu vào trước 05:00, không thì
 * **05:00 ngày hôm sau**. Giờ công ca đêm = thời lượng từ giờ vào đến **trước** mốc
 * (đến `min(giờ ra, mốc)` trên trục thời gian, có qua đêm), **tối đa 8 giờ** (làm tròn 0.1).
 * Phần làm việc **sau** mốc 05:00: cứ **30 phút = 0,5 giờ** TC ca đêm (làm tròn xuống theo block 30 phút).
 *
 * **Ca đêm ngày off / ngày lễ:** **GC ca đêm** + **TC ca đêm** gộp **một** số (cùng quy tắc mốc 05:00 như ngày thường) — hiển thị ở **GC ca đêm off** / **GC ca đêm ngày lễ**; cột **TC ca đêm** là «-».
 * **Ngày off / ngày lễ + ca ngày:** **Giờ công BT** + **TC chiều/giấy** gộp **một** số ở **TC off** / **GC ngày lễ** (hệ số quy đổi giống nhau — không tách cột Giờ TC).
 * **Ngày không off/lễ:** giờ công / TC như quy tắc khung ca thường.
 *
 * **Chế độ Tạp vụ** (`includeTapVuInWorkingHours`, chỉ **ca ngày**): **ca sáng** **07:00–11:30**
 * (chấm trước 07:00 → mốc vào **07:00**), **tối đa 4,5 giờ**; nghỉ trưa; **ca chiều** **12:30–16:00**,
 * **tối đa 3,5 giờ**. Tổng GC **tối đa 8 giờ**. Sau **16:00** → **Giờ TC** như hiện tại (block 30 phút, có điều kiện sau 16:30).
 *
 * **Chế độ Thai sản** (`includeThaiSanInWorkingHours`, chỉ **ca ngày**, không bật Tạp vụ): GC = thời lượng
 * liên tục từ mốc vào hiệu lực (ca ngày thường) đến **16:00** hoặc giờ ra, **tối đa 8 giờ**; sau **16:00** → TC như trên.
 *
 * **Chế độ Tài xế / Tài xế tổng** (`includeTaiXeInWorkingHours` / `includeTaiXeTongInWorkingHours`, chỉ **ca ngày**):
 * GC liên tục **07:00–19:00** (chấm trước 07:00 → mốc vào **07:00**), **tối đa 8 giờ**; sau **19:00** → TC block 30 phút
 * (chỉ khi giờ ra sau **19:30**), cùng cơ chế ca ngày thường nhưng mốc **19:00**.
 * Ca đêm không đổi.
 *
 * **Tách khỏi thống kê combo** (`getAttendanceComboFlags` trong `attendanceComboStats.js`): GC/TC và
 * dòng chính bảng lương tháng dựa trên `timeIn` / `timeOut` / `leaveType` (RTDB: gioVao/gioRa/loaiPhep) và `isAttendanceActualLeaveType`
 * (`payrollMonthlyCoefficientBuckets`, `hasPayrollLeaveType` trong file này), không đọc cờ KPI combo.
 */

const HHMM = /^(\d{1,2}):(\d{2})(?::\d{2})?$/;

function coerceIncludeWorkingHoursFlag(v) {
  return v === true || String(v ?? "").trim().toUpperCase() === "YES";
}

/** Ca ngày + cờ Tạp vụ hoặc Thai sản: TC chiều từ 16:00 (thay vì 17:00). */
function useTapVuThaiSanDayShiftRules(
  caLamViec,
  includeTapVuInWorkingHours,
  includeThaiSanInWorkingHours,
) {
  if (isNightShiftCaLamViec(caLamViec)) return false;
  return (
    coerceIncludeWorkingHoursFlag(includeTapVuInWorkingHours) ||
    coerceIncludeWorkingHoursFlag(includeThaiSanInWorkingHours)
  );
}

/** Chỉ Tạp vụ (ca ngày): khung sáng/chiều tách nghỉ trưa — không dùng cho Thai sản đơn lẻ. */
function useTapVuOnlyDayShiftRules(caLamViec, includeTapVuInWorkingHours) {
  if (isNightShiftCaLamViec(caLamViec)) return false;
  return coerceIncludeWorkingHoursFlag(includeTapVuInWorkingHours);
}

/** Chỉ Thai sản, không Tạp vụ: GC liên tục đến 16:00 như trước. */
function useThaiSanOnlyDayShiftRules(
  caLamViec,
  includeTapVuInWorkingHours,
  includeThaiSanInWorkingHours,
) {
  if (isNightShiftCaLamViec(caLamViec)) return false;
  if (coerceIncludeWorkingHoursFlag(includeTapVuInWorkingHours)) return false;
  return coerceIncludeWorkingHoursFlag(includeThaiSanInWorkingHours);
}

/** Tài xế hoặc Tài xế tổng (ca ngày). */
function useTaiXeDayShiftRules(
  caLamViec,
  includeTaiXeInWorkingHours,
  includeTaiXeTongInWorkingHours,
) {
  if (isNightShiftCaLamViec(caLamViec)) return false;
  return (
    coerceIncludeWorkingHoursFlag(includeTaiXeInWorkingHours) ||
    coerceIncludeWorkingHoursFlag(includeTaiXeTongInWorkingHours)
  );
}

/**
 * Làm tròn về **0.1 giờ**. Không dùng `Math.round(giờ)` trên số giờ thuần (ví dụ `Math.round(3.5) === 4`).
 * Với số dương: half-up qua `floor(x*10+0.5+ε)/10` — 3.5 giữ là 3.5, không thành 4.
 * @param {number} value
 * @returns {number}
 */
export function roundHoursToTenths(value) {
  if (!Number.isFinite(value)) return value;
  if (value >= 0) return Math.floor(value * 10 + 0.5 + 1e-9) / 10;
  return Math.ceil(value * 10 - 0.5 - 1e-9) / 10;
}

/**
 * Chuỗi hiển thị ô giờ bảng lương — giữ giá trị tính (tối đa 3 số lẻ, vd. 0.833).
 * @param {number} value
 * @returns {string}
 */
export function formatPayrollHoursForDisplay(value) {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return "0";
  const n = Math.round(value * 1000 + 1e-9) / 1000;
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(3).replace(/\.?0+$/, "");
}

/** @param {unknown} s */
export function parseHHMMToMinutes(s) {
  if (s == null) return null;
  const t = String(s).trim();
  const m = HHMM.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (
    !Number.isFinite(h) ||
    !Number.isFinite(min) ||
    h < 0 ||
    h > 23 ||
    min < 0 ||
    min > 59
  ) {
    return null;
  }
  return h * 60 + min;
}

/** Trước mốc này: giữ phút vào thực (không đẩy lên 08:00). */
const DAY_SHIFT_KEEP_ACTUAL_CLOCK_IN_BEFORE_MIN = 6 * 60;
/** Mốc vào hiệu lực khi chấm sớm (06:00 … trước 08:00). */
const DAY_SHIFT_EFFECTIVE_CLOCK_IN_MIN = 8 * 60;

/** Trần giờ công (cột chính); phần vượt quy vào tăng ca. */
const MAX_REGULAR_WORKING_HOURS = 8;

/**
 * Phút vào ca ngày dùng để tính thời lượng: sớm trong [06:00, 08:00) → 08:00;
 * trước 06:00 → giữ giờ chấm.
 * @param {number} clockInMin — phút từ 0:00
 */
function getEffectiveDayShiftClockInMinutes(clockInMin) {
  if (!Number.isFinite(clockInMin)) return clockInMin;
  if (clockInMin < DAY_SHIFT_KEEP_ACTUAL_CLOCK_IN_BEFORE_MIN) return clockInMin;
  if (clockInMin < DAY_SHIFT_EFFECTIVE_CLOCK_IN_MIN)
    return DAY_SHIFT_EFFECTIVE_CLOCK_IN_MIN;
  return clockInMin;
}

const MINUTES_PER_DAY = 24 * 60;

/** Mốc tách giờ công ca đêm / TC ca đêm (05:00). */
const NIGHT_SHIFT_PAYROLL_CUTOFF_MIN = 5 * 60;

/** Khung «Tổng thời gian ca đêm» bảng chấm công tháng: 22:00 → 05:00 (ngày hôm sau). */
const NIGHT_SHIFT_MONTHLY_WINDOW_START_MIN = 22 * 60;
const NIGHT_SHIFT_MONTHLY_WINDOW_END_MIN = 5 * 60;

/** Phút trên trục tuyến tính: 05:00 đầu tiên **sau** `timeIn` (phút từ 0:00 ngày của dòng). */
function getNightShiftPayrollCutoffEndMinutes(timeInMinutes) {
  const a = timeInMinutes;
  if (a < NIGHT_SHIFT_PAYROLL_CUTOFF_MIN) return NIGHT_SHIFT_PAYROLL_CUTOFF_MIN;
  return MINUTES_PER_DAY + NIGHT_SHIFT_PAYROLL_CUTOFF_MIN;
}

/** Ca đêm S2: GC từ 19:40 → 05:00 (tối đa 8h); TC sớm có giấy: 17:40–18:40 + 18:40–19:40. */

/**
 * Giờ công ca đêm (tối đa 8) và phút tăng ca sau mốc 05:00 (để × 0.5 / 30p).
 * Vào trước 19:40: GC từ mốc 19:40; từ 19:40 giữ giờ chấm.
 * @returns {{ regularHours: number; otMinutes: number } | null}
 */
export function getNightShiftPayrollRegularHoursAndOtMinutes(
  timeIn,
  timeOut,
  shiftCode,
  payrollEarlyOtPaperwork = undefined,
) {
  if (!isNightShiftCaLamViec(shiftCode)) return null;
  const a = parseHHMMToMinutes(timeIn);
  const b = parseHHMMToMinutes(timeOut);
  if (a == null || b == null) return null;
  let T0 = a;
  if (a < NIGHT_SHIFT_EARLY_OT_GC_START_MIN) {
    T0 = NIGHT_SHIFT_EARLY_OT_GC_START_MIN;
  }
  const T1 = b <= a ? MINUTES_PER_DAY + b : b;
  if (T1 <= T0) return null;

  const C = getNightShiftPayrollCutoffEndMinutes(a);
  const gcEnd = Math.min(T1, C);
  const regularMinutes = Math.max(0, gcEnd - T0);
  const regularHours = Math.min(
    MAX_REGULAR_WORKING_HOURS,
    roundHoursToTenths(regularMinutes / 60),
  );

  let otMinutes = 0;
  if (T1 > C) otMinutes = T1 - C;

  return { regularHours, otMinutes };
}

/**
 * Tổng thời gian ca đêm (bảng tháng): ca **S2**, giao [giờ vào, giờ ra] với khung **22:00–05:00**, tối đa **8h**.
 * @returns {number} 0 nếu không phải ca đêm hoặc không có giao với khung.
 */
export function getNightShiftTotalWindowHours22To05(timeIn, timeOut, shiftCode) {
  if (!isNightShiftCaLamViec(shiftCode)) return 0;
  const a = parseHHMMToMinutes(timeIn);
  const b = parseHHMMToMinutes(timeOut);
  if (a == null || b == null) return 0;

  const T0 = a;
  const T1 = b <= a ? MINUTES_PER_DAY + b : b;
  if (T1 <= T0) return 0;

  const winStart = NIGHT_SHIFT_MONTHLY_WINDOW_START_MIN;
  const winEnd = MINUTES_PER_DAY + NIGHT_SHIFT_MONTHLY_WINDOW_END_MIN;
  const start = Math.max(T0, winStart);
  const end = Math.min(T1, winEnd);
  const minutes = Math.max(0, end - start);
  if (minutes <= 0) return 0;

  const hours = roundHoursToTenths(minutes / 60);
  return Math.min(MAX_REGULAR_WORKING_HOURS, hours);
}

/** TC ca đêm: sau mốc 05:00, floor(phút / 30) × 0.5 — giống block 30 phút. */
export function getNightShiftPayrollOvertimeHoursFromOtMinutes(otMinutes) {
  const m = Number(otMinutes);
  if (!Number.isFinite(m) || m <= 0) return 0;
  return Math.floor(m / 30) * 0.5;
}

/**
 * @returns {number | null} null nếu không phải ca đêm hoặc không tính được.
 */
export function getNightShiftPayrollOvertimeHours(
  timeIn,
  timeOut,
  shiftCode,
  payrollEarlyOtPaperwork = undefined,
) {
  const parts = getNightShiftPayrollRegularHoursAndOtMinutes(
    timeIn,
    timeOut,
    shiftCode,
    payrollEarlyOtPaperwork,
  );
  if (parts == null) return null;
  const postCutoff = getNightShiftPayrollOvertimeHoursFromOtMinutes(
    parts.otMinutes,
  );
  const earlyNight = getNightShiftEarlyPaperworkOvertimeHours(
    timeIn,
    payrollEarlyOtPaperwork,
    shiftCode,
  );
  return postCutoff + earlyNight;
}

/** Đồng bộ cờ `nightShift` trong `attendanceComboStats` + dropdown ca làm việc. */
export function isNightShiftCaLamViec(shiftCode) {
  if (shiftCode == null) return false;
  const s = String(shiftCode).trim().toUpperCase().replace(/\s+/g, "");
  // Quy ước mới: chỉ S2 là ca đêm; S1 đi theo logic ca ngày.
  return s === "S2";
}

/** Mốc 16:00 — GC chế độ Thai sản (ca ngày, không Tạp vụ). */
const TAP_THAI_DAY_REGULAR_END_MIN = 16 * 60;

/** Tạp vụ — ca sáng 07:00–11:30 (tối đa 4,5h); ca chiều 12:30–16:00 (tối đa 3,5h). */
const TAPVU_MORNING_START_MIN = 7 * 60;
const TAPVU_MORNING_END_MIN = 11 * 60 + 30;
const TAPVU_MORNING_MAX_MIN = Math.floor(4.5 * 60); // 270 phút
const TAPVU_AFTERNOON_START_MIN = 12 * 60 + 30;
const TAPVU_AFTERNOON_END_MIN = 16 * 60;
const TAPVU_AFTERNOON_MAX_MIN = Math.floor(3.5 * 60); // 210 phút

/**
 * Chấm trước 07:00 → mốc vào hiệu lực 07:00 (ca Tạp vụ — ca sáng).
 * @param {number} clockInMin
 */
function getEffectiveTapVuMorningClockInMinutes(clockInMin) {
  if (!Number.isFinite(clockInMin)) return clockInMin;
  if (clockInMin < TAPVU_MORNING_START_MIN) return TAPVU_MORNING_START_MIN;
  return clockInMin;
}

/**
 * Giờ công GC ca ngày — chế độ Tạp vụ (hai khung, loại trừ trưa).
 * @param {number} a — parseHHMMToMinutes(timeIn)
 * @param {number} b — parseHHMMToMinutes(timeOut)
 * @returns {number | null}
 */
function getTapVuDayShiftRegularHoursNumeric(a, b) {
  const aEffMorning = getEffectiveTapVuMorningClockInMinutes(a);
  const mStart = Math.max(aEffMorning, TAPVU_MORNING_START_MIN);
  const mEnd = Math.min(b, TAPVU_MORNING_END_MIN);
  let morningMin = Math.max(0, mEnd - mStart);
  morningMin = Math.min(morningMin, TAPVU_MORNING_MAX_MIN);

  const aftStart = Math.max(a, TAPVU_AFTERNOON_START_MIN);
  const aftEnd = Math.min(b, TAPVU_AFTERNOON_END_MIN);
  let afternoonMin = Math.max(0, aftEnd - aftStart);
  afternoonMin = Math.min(afternoonMin, TAPVU_AFTERNOON_MAX_MIN);

  const totalMinutes = morningMin + afternoonMin;
  if (totalMinutes <= 0) return null;
  const raw = roundHoursToTenths(totalMinutes / 60);
  return Math.min(raw, MAX_REGULAR_WORKING_HOURS);
}

/**
 * TC chiều (Tạp vụ / Thai sản): từ 16:00, block 30 phút; chỉ khi giờ ra sau 16:30.
 * @param {unknown} timeOut
 * @returns {number | null}
 */
export function getTapVuThaiSanOvertimeHoursFromGioRa(timeOut) {
  const TAP_THAI_OT_PAY_START_MIN = 16 * 60;
  const TAP_THAI_OT_ELIGIBLE_AFTER_MIN = 16 * 60 + 30;
  const b = parseHHMMToMinutes(timeOut);
  if (b == null) return null;
  if (b <= TAP_THAI_OT_ELIGIBLE_AFTER_MIN) return 0;
  const minutesFrom16 = b - TAP_THAI_OT_PAY_START_MIN;
  if (minutesFrom16 <= 0) return 0;
  const blocks = Math.floor(minutesFrom16 / 30);
  return blocks * 0.5;
}

/** Tài xế / Tài xế tổng — GC khung 07:00–19:00. */
const TAIXE_REGULAR_START_MIN = 7 * 60;
const TAIXE_REGULAR_END_MIN = 19 * 60;
/** TC sau 19:00 (block 30 phút; chỉ khi giờ ra sau 19:30). */
const TAIXE_OT_PAY_START_MIN = 19 * 60;
const TAIXE_OT_ELIGIBLE_AFTER_MIN = 19 * 60 + 30;

function getEffectiveTaiXeClockInMinutes(clockInMin) {
  if (!Number.isFinite(clockInMin)) return clockInMin;
  if (clockInMin < TAIXE_REGULAR_START_MIN) return TAIXE_REGULAR_START_MIN;
  return clockInMin;
}

function getTaiXeDayShiftRegularHoursNumeric(a, b) {
  const aEff = getEffectiveTaiXeClockInMinutes(a);
  const endCap = Math.min(b, TAIXE_REGULAR_END_MIN);
  if (endCap <= aEff) return null;
  const totalMinutes = endCap - aEff;
  const raw = roundHoursToTenths(totalMinutes / 60);
  return Math.min(raw, MAX_REGULAR_WORKING_HOURS);
}

/**
 * TC ca ngày — Tài xế / Tài xế tổng: từ 19:00, block 30 phút; chỉ khi giờ ra sau 19:30.
 * @param {unknown} timeOut
 * @returns {number | null}
 */
export function getTaiXeOvertimeHoursFromGioRa(timeOut) {
  const b = parseHHMMToMinutes(timeOut);
  if (b == null) return null;
  if (b <= TAIXE_OT_ELIGIBLE_AFTER_MIN) return 0;
  const minutesFrom19 = b - TAIXE_OT_PAY_START_MIN;
  if (minutesFrom19 <= 0) return 0;
  const blocks = Math.floor(minutesFrom19 / 30);
  return blocks * 0.5;
}

function getDayShiftEveningOvertimeHoursFromGioRa(
  timeOut,
  shiftCode,
  includeTapVuInWorkingHours,
  includeThaiSanInWorkingHours,
  includeTaiXeInWorkingHours,
  includeTaiXeTongInWorkingHours,
) {
  if (
    useTaiXeDayShiftRules(
      shiftCode,
      includeTaiXeInWorkingHours,
      includeTaiXeTongInWorkingHours,
    )
  ) {
    return getTaiXeOvertimeHoursFromGioRa(timeOut);
  }
  if (
    useTapVuThaiSanDayShiftRules(
      shiftCode,
      includeTapVuInWorkingHours,
      includeThaiSanInWorkingHours,
    )
  ) {
    return getTapVuThaiSanOvertimeHoursFromGioRa(timeOut);
  }
  return getOvertimeHoursFromGioRa(timeOut);
}

/**
 * @param {unknown} timeIn
 * @param {unknown} timeOut
 * @param {unknown} [shiftCode] — nếu là ca đêm và ra ≤ vào, tính qua nửa đêm.
 * @param {unknown} [includeTapVuInWorkingHours]
 * @param {unknown} [includeThaiSanInWorkingHours]
 * @returns {number | null}
 */
export function getAttendanceWorkingHoursHours(
  timeIn,
  timeOut,
  shiftCode,
  includeTapVuInWorkingHours = false,
  includeThaiSanInWorkingHours = false,
  includeTaiXeInWorkingHours = false,
  includeTaiXeTongInWorkingHours = false,
) {
  const a = parseHHMMToMinutes(timeIn);
  const b = parseHHMMToMinutes(timeOut);
  if (a == null || b == null) return null;

  const night = isNightShiftCaLamViec(shiftCode);
  if (b <= a) {
    if (!night) return null;
    const spanMinutes = MINUTES_PER_DAY - a + b;
    const raw = roundHoursToTenths(spanMinutes / 60);
    return Math.min(raw, MAX_REGULAR_WORKING_HOURS);
  }

  if (!night && useTapVuOnlyDayShiftRules(shiftCode, includeTapVuInWorkingHours)) {
    return getTapVuDayShiftRegularHoursNumeric(a, b);
  }

  if (
    !night &&
    useTaiXeDayShiftRules(
      shiftCode,
      includeTaiXeInWorkingHours,
      includeTaiXeTongInWorkingHours,
    )
  ) {
    return getTaiXeDayShiftRegularHoursNumeric(a, b);
  }

  if (
    !night &&
    useThaiSanOnlyDayShiftRules(
      shiftCode,
      includeTapVuInWorkingHours,
      includeThaiSanInWorkingHours,
    )
  ) {
    const aEff = getEffectiveDayShiftClockInMinutes(a);
    const endCap = Math.min(b, TAP_THAI_DAY_REGULAR_END_MIN);
    if (endCap <= aEff) return null;
    const totalMinutes = endCap - aEff;
    const raw = roundHoursToTenths(totalMinutes / 60);
    return Math.min(raw, MAX_REGULAR_WORKING_HOURS);
  }

  if (!night) {
    const aEff = getEffectiveDayShiftClockInMinutes(a);
    if (b <= aEff) return null;

    // Ca ngày = 2 khung làm việc: 08:00-12:00 và 13:00-17:00 (loại trừ 12:00-13:00).
    const DAY_SHIFT_MORNING_START = 8 * 60;
    const DAY_SHIFT_MORNING_END = 12 * 60;
    const DAY_SHIFT_AFTERNOON_START = 13 * 60;
    const DAY_SHIFT_AFTERNOON_END = 17 * 60;

    const morningMinutes = Math.max(
      0,
      Math.min(b, DAY_SHIFT_MORNING_END) -
        Math.max(aEff, DAY_SHIFT_MORNING_START),
    );
    const afternoonMinutes = Math.max(
      0,
      Math.min(b, DAY_SHIFT_AFTERNOON_END) -
        Math.max(aEff, DAY_SHIFT_AFTERNOON_START),
    );
    const totalMinutes = morningMinutes + afternoonMinutes;
    if (totalMinutes <= 0) return null;

    const raw = roundHoursToTenths(totalMinutes / 60);
    return Math.min(raw, MAX_REGULAR_WORKING_HOURS);
  }

  const raw = roundHoursToTenths((b - a) / 60);
  return Math.min(raw, MAX_REGULAR_WORKING_HOURS);
}

/**
 * @param {unknown} timeIn
 * @param {unknown} timeOut
 * @param {unknown} [shiftCode]
 * @param {unknown} [includeTapVuInWorkingHours]
 * @param {unknown} [includeThaiSanInWorkingHours]
 * @returns {string} Rỗng nếu không tính được.
 */
function formatAttendanceWorkingHoursLabel(
  timeIn,
  timeOut,
  shiftCode,
  includeTapVuInWorkingHours = false,
  includeThaiSanInWorkingHours = false,
  includeTaiXeInWorkingHours = false,
  includeTaiXeTongInWorkingHours = false,
) {
  const h = getAttendanceWorkingHoursHours(
    timeIn,
    timeOut,
    shiftCode,
    includeTapVuInWorkingHours,
    includeThaiSanInWorkingHours,
    includeTaiXeInWorkingHours,
    includeTaiXeTongInWorkingHours,
  );
  if (h == null) return "";
  return `${h}`;
}

/**
 * Ca đêm ngày off/lễ: GC (đến mốc 05:00, tối đa 8h) + TC ca đêm (sau 05:00) — cùng quy tắc ca đêm ngày thường, một số gộp.
 * @returns {number | null}
 */
export function getNightShiftPayrollOffHolidayMergedHoursNumeric(
  timeIn,
  timeOut,
  shiftCode,
  payrollEarlyOtPaperwork = undefined,
) {
  if (!isNightShiftCaLamViec(shiftCode)) return null;
  const parts = getNightShiftPayrollRegularHoursAndOtMinutes(
    timeIn,
    timeOut,
    shiftCode,
    payrollEarlyOtPaperwork,
  );
  if (parts == null) return null;
  const gc = Number.isFinite(parts.regularHours) ? parts.regularHours : 0;
  const otH = getNightShiftPayrollOvertimeHours(
    timeIn,
    timeOut,
    shiftCode,
    payrollEarlyOtPaperwork,
  );
  const tc = otH != null && Number.isFinite(otH) ? otH : 0;
  return roundHoursToTenths(gc + tc);
}

/** Ký tự thống nhất cho ô không có số / 0 giờ (tránh lẫn em-dash «—»). */
const PAYROLL_CELL_DASH = "-";

function hasPayrollLeaveType(
  leaveType,
  includeTapVuInWorkingHours = false,
  includeThaiSanInWorkingHours = false,
  includeTaiXeInWorkingHours = false,
  includeTaiXeTongInWorkingHours = false,
) {
  return isAttendanceActualLeaveType(leaveType, {
    includeTapVuInWorkingHours,
    includeThaiSanInWorkingHours,
  });
}

function isHalfPnLeaveType(leaveType) {
  return formatAttendanceLeaveTypeColumnDisplay(leaveType) === "1/2PN";
}

function hasBothValidAttendanceTimes(timeIn, timeOut) {
  return (
    parseHHMMToMinutes(timeIn) != null && parseHHMMToMinutes(timeOut) != null
  );
}

const HALF_DAY_MORNING_START_MIN = 8 * 60;
const HALF_DAY_NOON_MIN = 12 * 60;
const HALF_DAY_AFTERNOON_END_MIN = 17 * 60;

export function getPayrollHalfDayLeaveWorkedHours(
  timeIn,
  timeOut,
  shiftCode,
  includeTapVuInWorkingHours = false,
  includeThaiSanInWorkingHours = false,
  includeTaiXeInWorkingHours = false,
  includeTaiXeTongInWorkingHours = false,
) {
  if (isNightShiftCaLamViec(shiftCode)) return null;
  const a = parseHHMMToMinutes(timeIn);
  const b = parseHHMMToMinutes(timeOut);
  if (a == null || b == null) return null;

  // 1/2PN nghỉ buổi chiều: làm buổi sáng (vào trước 08:00) => 4h cố định.
  if (a < HALF_DAY_MORNING_START_MIN && b > a) return 4;
  // 1/2PN nghỉ buổi sáng: làm buổi chiều (từ 12:00) => 4h cố định.
  if (a >= HALF_DAY_NOON_MIN && b > a) return 4;

  const h = getAttendanceWorkingHoursHours(
    timeIn,
    timeOut,
    shiftCode,
    includeTapVuInWorkingHours,
    includeThaiSanInWorkingHours,
    includeTaiXeInWorkingHours,
    includeTaiXeTongInWorkingHours,
  );
  if (h == null || h <= 0) return null;
  // Luôn chặn trần 4h cho 1/2PN để không xuất hiện 4.5.
  return Math.min(4, h);
}

/**
 * Khối bảng lương (GC/TC): tham số nội bộ tiếng Anh — `timeIn`, `timeOut`, `shiftCode`,
 * `leaveType`, `payrollEarlyOtPaperwork`, `payrollLateOtExcluded`, `lunchOtHours`;
 * giờ công thường / tăng ca trong tính toán: `regularHours`, `overtimeHours`.
 * Đọc từ bản ghi RTDB qua `PAYROLL_EMP`; gộp ngày qua `payrollOtDayParamsFromEmp`.
 */

/** Chuỗi hiển thị ô giờ lương: số thực (không làm tròn 0,5h); 0, rỗng, em-dash → «-». */
function payrollHoursCellDisplay(value) {
  if (value == null) return PAYROLL_CELL_DASH;
  const s = String(value).trim();
  if (s === "" || s === "—") return PAYROLL_CELL_DASH;
  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n)) return s;
  if (n === 0) return PAYROLL_CELL_DASH;
  return formatPayrollHoursForDisplay(n);
}

/**
 * Cột **Giờ công** (bảng lương).
 * **Ngày off + ca ngày:** «-» — giờ quy đổi nằm ở cột **TC off**.
 * **Ca đêm (không off):** «-» — giờ nằm ở «GC ca đêm» / «TC ca đêm».
 * **Ca đêm + ngày off:** «-» — GC nằm ở «GC ca đêm off».
 */
export function formatPayrollTableWorkingHoursCell(
  timeIn,
  timeOut,
  isOffDay,
  shiftCode,
  leaveType,
  includeTapVuInWorkingHours = false,
  includeThaiSanInWorkingHours = false,
  includeTaiXeInWorkingHours = false,
  includeTaiXeTongInWorkingHours = false,
) {
  if (
    hasPayrollLeaveType(
      leaveType,
      includeTapVuInWorkingHours,
      includeThaiSanInWorkingHours,
    )
  ) {
    if (isHalfPnLeaveType(leaveType) && !isOffDay) {
      const h = getPayrollHalfDayLeaveWorkedHours(
        timeIn,
        timeOut,
        shiftCode,
        includeTapVuInWorkingHours,
        includeThaiSanInWorkingHours,
        includeTaiXeInWorkingHours,
        includeTaiXeTongInWorkingHours,
      );
      if (h != null && h > 0) return payrollHoursCellDisplay(String(h));
    }
    return PAYROLL_CELL_DASH;
  }
  if (isNightShiftCaLamViec(shiftCode)) {
    return PAYROLL_CELL_DASH;
  }
  if (isOffDay) {
    return PAYROLL_CELL_DASH;
  }
  return payrollHoursCellDisplay(
    formatAttendanceWorkingHoursLabel(
      timeIn,
      timeOut,
      shiftCode,
      includeTapVuInWorkingHours,
      includeThaiSanInWorkingHours,
      includeTaiXeInWorkingHours,
      includeTaiXeTongInWorkingHours,
    ) || PAYROLL_CELL_DASH,
  );
}

/**
 * Cột **TC off** (ca ngày): chỉ khi **Ngày off** (OFF), không phải ngày lễ — GC + TC gộp (cùng quy tắc như ngày thường, một ô).
 * Ngày lễ (HOLIDAY): «-» — giờ nằm ở cột **Giờ công ngày lễ**.
 */
export function formatPayrollTableOffDayTcCell(
  timeIn,
  timeOut,
  isStrictOffDay,
  shiftCode,
  payrollEarlyOtPaperwork,
  leaveType,
  payrollLateOtExcluded = false,
  includeTapVuInWorkingHours = false,
  includeThaiSanInWorkingHours = false,
  includeTaiXeInWorkingHours = false,
  includeTaiXeTongInWorkingHours = false,
  lunchOtHours = undefined,
) {
  if (
    hasPayrollLeaveType(
      leaveType,
      includeTapVuInWorkingHours,
      includeThaiSanInWorkingHours,
    ) &&
    !isHalfPnLeaveType(leaveType)
  )
    return PAYROLL_CELL_DASH;
  if (isNightShiftCaLamViec(shiftCode)) {
    return PAYROLL_CELL_DASH;
  }
  if (!isStrictOffDay) {
    return PAYROLL_CELL_DASH;
  }
  const merged = getPayrollDayShiftOffHolidayMergedHoursNumeric(
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
  return payrollHoursCellDisplay(
    merged == null ? PAYROLL_CELL_DASH : String(merged),
  );
}

/**
 * Cột **Giờ công ngày lễ** — ca ngày, chỉ khi **Ngày lễ** (HOLIDAY). GC + TC gộp một ô.
 */
export function formatPayrollTableHolidayDayWorkingCell(
  timeIn,
  timeOut,
  isHolidayDay,
  shiftCode,
  payrollEarlyOtPaperwork,
  leaveType,
  payrollLateOtExcluded = false,
  includeTapVuInWorkingHours = false,
  includeThaiSanInWorkingHours = false,
  includeTaiXeInWorkingHours = false,
  includeTaiXeTongInWorkingHours = false,
  lunchOtHours = undefined,
) {
  if (
    hasPayrollLeaveType(
      leaveType,
      includeTapVuInWorkingHours,
      includeThaiSanInWorkingHours,
    ) &&
    !isHalfPnLeaveType(leaveType)
  )
    return PAYROLL_CELL_DASH;
  if (!isHolidayDay || isNightShiftCaLamViec(shiftCode)) {
    return PAYROLL_CELL_DASH;
  }
  const merged = getPayrollDayShiftOffHolidayMergedHoursNumeric(
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
  return payrollHoursCellDisplay(
    merged == null ? PAYROLL_CELL_DASH : String(merged),
  );
}

/**
 * Cột **Giờ công ca đêm ngày lễ** — GC ca đêm + TC ca đêm gộp (cùng quy tắc ca đêm BT).
 */
export function formatPayrollTableHolidayNightWorkingCell(
  timeIn,
  timeOut,
  isHolidayDay,
  shiftCode,
  leaveType,
  includeTapVuInWorkingHours = false,
  includeThaiSanInWorkingHours = false,
  includeTaiXeInWorkingHours = false,
  includeTaiXeTongInWorkingHours = false,
  payrollEarlyOtPaperwork = undefined,
) {
  if (
    hasPayrollLeaveType(
      leaveType,
      includeTapVuInWorkingHours,
      includeThaiSanInWorkingHours,
    )
  )
    return PAYROLL_CELL_DASH;
  if (!isHolidayDay || !isNightShiftCaLamViec(shiftCode)) {
    return PAYROLL_CELL_DASH;
  }
  const merged = getNightShiftPayrollOffHolidayMergedHoursNumeric(
    timeIn,
    timeOut,
    shiftCode,
    payrollEarlyOtPaperwork,
  );
  return payrollHoursCellDisplay(
    merged == null ? PAYROLL_CELL_DASH : String(merged),
  );
}

/** Cột «Giờ công ca đêm» — chỉ có số khi `shiftCode` là ca đêm và tính được. */
export function formatPayrollTableNightShiftWorkingCell(
  timeIn,
  timeOut,
  isOffDay,
  shiftCode,
  leaveType,
  includeTapVuInWorkingHours = false,
  includeThaiSanInWorkingHours = false,
  includeTaiXeInWorkingHours = false,
  includeTaiXeTongInWorkingHours = false,
  payrollEarlyOtPaperwork = undefined,
) {
  if (
    hasPayrollLeaveType(
      leaveType,
      includeTapVuInWorkingHours,
      includeThaiSanInWorkingHours,
    )
  )
    return PAYROLL_CELL_DASH;
  if (!isNightShiftCaLamViec(shiftCode)) return PAYROLL_CELL_DASH;
  if (isOffDay) return PAYROLL_CELL_DASH;
  const parts = getNightShiftPayrollRegularHoursAndOtMinutes(
    timeIn,
    timeOut,
    shiftCode,
    payrollEarlyOtPaperwork,
  );
  if (parts == null) return PAYROLL_CELL_DASH;
  return payrollHoursCellDisplay(`${parts.regularHours}`);
}

/**
 * Cột «GC ca đêm ngày off» — chỉ **Ngày off** (OFF), không phải lễ.
 * Ngày lễ + ca đêm: «-» — GC nằm ở **Giờ công ca đêm ngày lễ**.
 */
export function formatPayrollTableNightShiftOffDayWorkingCell(
  timeIn,
  timeOut,
  isStrictOffDay,
  shiftCode,
  leaveType,
  includeTapVuInWorkingHours = false,
  includeThaiSanInWorkingHours = false,
  includeTaiXeInWorkingHours = false,
  includeTaiXeTongInWorkingHours = false,
  payrollEarlyOtPaperwork = undefined,
) {
  if (
    hasPayrollLeaveType(
      leaveType,
      includeTapVuInWorkingHours,
      includeThaiSanInWorkingHours,
    )
  )
    return PAYROLL_CELL_DASH;
  if (!isNightShiftCaLamViec(shiftCode)) return PAYROLL_CELL_DASH;
  if (!isStrictOffDay) return PAYROLL_CELL_DASH;
  const merged = getNightShiftPayrollOffHolidayMergedHoursNumeric(
    timeIn,
    timeOut,
    shiftCode,
    payrollEarlyOtPaperwork,
  );
  return payrollHoursCellDisplay(
    merged == null ? PAYROLL_CELL_DASH : String(merged),
  );
}

/** Cột «TC ca đêm» — sau 05:00, 30 phút = 0,5; ngày off/lễ không tách → «-». */
export function formatPayrollTableNightShiftOvertimeCell(
  timeIn,
  timeOut,
  payrollOffLike,
  shiftCode,
  leaveType,
  includeTapVuInWorkingHours = false,
  includeThaiSanInWorkingHours = false,
  includeTaiXeInWorkingHours = false,
  includeTaiXeTongInWorkingHours = false,
  payrollEarlyOtPaperwork = undefined,
) {
  if (
    hasPayrollLeaveType(
      leaveType,
      includeTapVuInWorkingHours,
      includeThaiSanInWorkingHours,
    )
  )
    return PAYROLL_CELL_DASH;
  if (!isNightShiftCaLamViec(shiftCode)) return PAYROLL_CELL_DASH;
  if (payrollOffLike) return PAYROLL_CELL_DASH;
  const h = getNightShiftPayrollOvertimeHours(
    timeIn,
    timeOut,
    shiftCode,
    payrollEarlyOtPaperwork,
  );
  if (h == null) return PAYROLL_CELL_DASH;
  if (h === 0) return PAYROLL_CELL_DASH;
  return payrollHoursCellDisplay(String(h));
}

/** Mốc bắt đầu tính tăng ca (17:00). */
const OT_PAY_START_MIN = 17 * 60;
/** Chỉ có tăng ca khi giờ ra sau > 17:30 (phút). */
const OT_ELIGIBLE_AFTER_MIN = 17 * 60 + 30;

/** Làm tròn tổng phút TC sớm theo khung mốc → giờ (0,1h), giới hạn `maxHours`. */
function earlyPaperworkHoursFromEntry(entryMin, segments, maxHours) {
  const minutes = sumPaperworkOvertimeSegmentMinutes(entryMin, segments);
  if (minutes <= 0) return 0;
  return roundHoursToTenths(Math.min(minutes / 60, maxHours));
}

/**
 * Giờ tăng ca: từ 17:00 đến giờ ra, cứ 30 phút = 0.5h (làm tròn xuống theo block 30 phút).
 * Chỉ áp dụng khi giờ ra sau 17:30.
 * @param {unknown} timeOut
 * @returns {number | null} null nếu không đọc được giờ ra; 0 nếu không đủ điều kiện TC.
 */
export function getOvertimeHoursFromGioRa(timeOut) {
  const b = parseHHMMToMinutes(timeOut);
  if (b == null) return null;
  if (b <= OT_ELIGIBLE_AFTER_MIN) return 0;
  const minutesFrom17 = b - OT_PAY_START_MIN;
  if (minutesFrom17 <= 0) return 0;
  const blocks = Math.floor(minutesFrom17 / 30);
  return blocks * 0.5;
}

/**
 * Ca ngày, giờ vào ≤ 06:40 — đủ điều kiện hỏi «có giấy tăng ca sớm» (bảng lương).
 * Không áp dụng ca đêm (cột TC riêng).
 */
export function isEarlyArrivalFor0600PaperworkOvertime(timeIn, shiftCode) {
  if (isNightShiftCaLamViec(shiftCode)) return false;
  const a = parseHHMMToMinutes(timeIn);
  if (a == null) return false;
  return a <= DAY_EARLY_PAPERWORK_CUTOFF_MIN;
}

/**
 * Ca đêm S2: vào từ 15:00 đến ≤ 18:40 — đủ điều kiện xác nhận giấy TC trước giờ vào chính thức.
 */
export function isEarlyArrivalForNightShiftPaperworkOvertime(timeIn, shiftCode) {
  if (!isNightShiftCaLamViec(shiftCode)) return false;
  const a = parseHHMMToMinutes(timeIn);
  if (a == null) return false;
  return (
    a >= NIGHT_SHIFT_EARLY_PAPERWORK_MIN_IN_MIN &&
    a <= NIGHT_SHIFT_OFFICIAL_START_MIN
  );
}

/** Ca ngày (≤ 06:40) hoặc ca đêm (15:00–18:40) — hiện popup xác nhận giấy TC sớm. */
export function isEarlyArrivalForPaperworkOvertime(timeIn, shiftCode) {
  return (
    isEarlyArrivalFor0600PaperworkOvertime(timeIn, shiftCode) ||
    isEarlyArrivalForNightShiftPaperworkOvertime(timeIn, shiftCode)
  );
}

/**
 * Cờ giấy TC sớm chỉ có hiệu lực khi đủ điều kiện (ca ngày ≤ 06:40 hoặc ca đêm ≤ 18:40).
 * @param {unknown} timeIn
 * @param {unknown} shiftCode
 * @param {boolean | undefined} payrollEarlyOtPaperwork
 * @returns {true | undefined}
 */
export function effectivePayrollEarlyOtPaperwork(
  timeIn,
  shiftCode,
  payrollEarlyOtPaperwork,
) {
  if (payrollEarlyOtPaperwork !== true) return undefined;
  if (!isEarlyArrivalForPaperworkOvertime(timeIn, shiftCode)) return undefined;
  return true;
}

/**
 * TC ca đêm trước giờ vào chính thức: khung mốc 17:40–18:40 / 18:40–19:40 (tối đa 2h), làm tròn 0,1h.
 * @param {unknown} timeIn
 * @param {boolean | undefined} payrollEarlyOtPaperwork
 * @param {unknown} shiftCode
 * @returns {number}
 */
export function getNightShiftEarlyPaperworkOvertimeHours(
  timeIn,
  payrollEarlyOtPaperwork,
  shiftCode,
) {
  if (payrollEarlyOtPaperwork !== true) return 0;
  if (!isEarlyArrivalForNightShiftPaperworkOvertime(timeIn, shiftCode)) return 0;
  const a = parseHHMMToMinutes(timeIn);
  if (a == null) return 0;
  const minutes = nightEarlyPaperworkOvertimeMinutes(a);
  if (minutes <= 0) return 0;
  return roundHoursToTenths(
    Math.min(minutes / 60, NIGHT_EARLY_OT_MAX_HOURS),
  );
}

/**
 * TC sớm (có giấy, vào ≤ 06:40): trước 06:00 → 2 khung (2h); từ 06:00 → 06:40–07:40 (1h).
 * @param {unknown} timeIn
 * @param {boolean | undefined} payrollEarlyOtPaperwork
 * @param {unknown} shiftCode
 * @returns {number}
 */
export function getEarlyPaperworkOvertimeHours(
  timeIn,
  payrollEarlyOtPaperwork,
  shiftCode,
) {
  if (payrollEarlyOtPaperwork !== true) return 0;
  if (!isEarlyArrivalFor0600PaperworkOvertime(timeIn, shiftCode)) return 0;
  const a = parseHHMMToMinutes(timeIn);
  if (a == null) return 0;
  const minutes = dayEarlyPaperworkOvertimeMinutes(a);
  if (minutes <= 0) return 0;
  return roundHoursToTenths(
    Math.min(minutes / 60, DAY_EARLY_OT_MAX_HOURS),
  );
}

/** Giờ TC trưa — chọn thủ công trên form điểm danh (`tangCaTrua`). */
export const LUNCH_OT_HOUR_OPTIONS = Object.freeze([0.5, 0.833, 1, 1.5, 2]);

export function parseLunchOtHours(value) {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return LUNCH_OT_HOUR_OPTIONS.includes(n) ? n : 0;
}

/**
 * Giờ TC khối ngày (cột «Giờ TC»): tăng ca sau 17:30 + (tùy chọn) TC sớm khi có giấy và vào ≤ 06:40.
 * Ca ngày: **bắt buộc có giờ ra hợp lệ** mới tính TC (kể cả phần giấy sớm) — tránh có TC khi chưa chấm giờ ra.
 * @param {boolean | undefined} payrollEarlyOtPaperwork — `true` nếu user xác nhận có giấy.
 * @param {boolean | undefined} payrollLateOtExcluded — `true` nếu user xác nhận KHONG tinh tang ca sau 17:30.
 * @param {unknown} [includeTapVuInWorkingHours]
 * @param {unknown} [includeThaiSanInWorkingHours]
 * @param {unknown} [lunchOtHours] — giờ TC trưa (0.5 / 0.833 / 1 / 1.5 / 2); cộng vào TC off / GC lễ khi gộp.
 * @returns {number | null} null nếu không đọc được giờ ra (ca ngày / ca đêm).
 */
export function getPayrollDayOvertimeHoursNumeric(
  timeIn,
  timeOut,
  isOffDay,
  shiftCode,
  payrollEarlyOtPaperwork,
  isHolidayDay = false,
  payrollLateOtExcluded = false,
  includeTapVuInWorkingHours = false,
  includeThaiSanInWorkingHours = false,
  includeTaiXeInWorkingHours = false,
  includeTaiXeTongInWorkingHours = false,
  lunchOtHours = undefined,
) {
  if (isNightShiftCaLamViec(shiftCode)) {
    return 0;
  }

  const eveningOtHoursRaw = getDayShiftEveningOvertimeHoursFromGioRa(
    timeOut,
    shiftCode,
    includeTapVuInWorkingHours,
    includeThaiSanInWorkingHours,
    includeTaiXeInWorkingHours,
    includeTaiXeTongInWorkingHours,
  );
  if (eveningOtHoursRaw == null) {
    return null;
  }
  const eveningOtHours =
    payrollLateOtExcluded === true ? 0 : eveningOtHoursRaw;
  const earlyOtHours = getEarlyPaperworkOvertimeHours(
    timeIn,
    payrollEarlyOtPaperwork,
    shiftCode,
  );
  const parsedLunchOtHours = parseLunchOtHours(lunchOtHours);
  const paperOtHours = roundHoursToTenths(eveningOtHours + earlyOtHours);

  return paperOtHours + parsedLunchOtHours;
}

/**
 * Ca ngày, ngày off hoặc lễ: Giờ công BT + TC (chiều / giấy sớm) — một số hiển thị gộp (cột TC off / GC lễ).
 * @returns {number | null}
 */
export function getPayrollDayShiftOffHolidayMergedHoursNumeric(
  timeIn,
  timeOut,
  isStrictOffDay,
  isHolidayDay,
  shiftCode,
  payrollEarlyOtPaperwork,
  leaveType,
  payrollLateOtExcluded = false,
  includeTapVuInWorkingHours = false,
  includeThaiSanInWorkingHours = false,
  includeTaiXeInWorkingHours = false,
  includeTaiXeTongInWorkingHours = false,
  lunchOtHours = undefined,
) {
  const halfPn = isHalfPnLeaveType(leaveType);
  if (
    hasPayrollLeaveType(
      leaveType,
      includeTapVuInWorkingHours,
      includeThaiSanInWorkingHours,
    ) &&
    !halfPn
  )
    return null;
  if (!isStrictOffDay && !isHolidayDay) return null;
  if (isNightShiftCaLamViec(shiftCode)) return null;
  // OFF/HOLIDAY chỉ tính khi có đủ giờ vào + giờ ra hợp lệ.
  if (!hasBothValidAttendanceTimes(timeIn, timeOut)) return null;
  const h = halfPn
    ? getPayrollHalfDayLeaveWorkedHours(
        timeIn,
        timeOut,
        shiftCode,
        includeTapVuInWorkingHours,
        includeThaiSanInWorkingHours,
        includeTaiXeInWorkingHours,
        includeTaiXeTongInWorkingHours,
      )
    : getAttendanceWorkingHoursHours(
        timeIn,
        timeOut,
        shiftCode,
        includeTapVuInWorkingHours,
        includeThaiSanInWorkingHours,
        includeTaiXeInWorkingHours,
        includeTaiXeTongInWorkingHours,
      );
  const n = getPayrollDayOvertimeHoursNumeric(
    timeIn,
    timeOut,
    isStrictOffDay,
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
  if (h == null && n == null) return null;
  const regularHours = h == null ? 0 : h;
  const overtimeHours = n == null ? 0 : n;
  return regularHours + overtimeHours;
}

/**
 * Cột **TC ca ngày (×1.5)**: sau 17:30 + giấy TC sớm (ca ngày). Ca đêm S2: «-» (dùng cột TC ca đêm).
 * Ngày off/lễ (ca ngày): «-» — TC đã gộp vào TC off / GC ngày lễ.
 */
export function formatPayrollTableDayShiftOvertimeCell(
  timeIn,
  timeOut,
  isOffDay,
  shiftCode,
  payrollEarlyOtPaperwork,
  isHolidayDay = false,
  payrollLateOtExcluded = false,
  includeTapVuInWorkingHours = false,
  includeThaiSanInWorkingHours = false,
  includeTaiXeInWorkingHours = false,
  includeTaiXeTongInWorkingHours = false,
  isCompensatoryDay = false,
  lunchOtHours = undefined,
) {
  const strictOff = isOffDay || isCompensatoryDay;
  if (isNightShiftCaLamViec(shiftCode)) {
    return PAYROLL_CELL_DASH;
  }
  if (strictOff || isHolidayDay) {
    return PAYROLL_CELL_DASH;
  }
  const n = getPayrollDayOvertimeHoursNumeric(
    timeIn,
    timeOut,
    strictOff,
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
  if (n == null) return PAYROLL_CELL_DASH;
  if (n === 0) return PAYROLL_CELL_DASH;
  return payrollHoursCellDisplay(String(n));
}

/**
 * Tổng GC (khối ngày): Giờ công + Giờ TC.
 * Ngày off / lễ (ca ngày): một tổng — đã gộp GC + TC trong TC off / GC lễ (cột Giờ TC ngày off/lễ là «-»).
 * Ca đêm: không cộng khối ngày — dùng «Tổng GC ca đêm».
 */
function payrollTotalDayGcNumeric(
  timeIn,
  timeOut,
  isStrictOffDay,
  isHolidayDay,
  shiftCode,
  payrollEarlyOtPaperwork,
  leaveType,
  payrollLateOtExcluded = false,
  includeTapVuInWorkingHours = false,
  includeThaiSanInWorkingHours = false,
  includeTaiXeInWorkingHours = false,
  includeTaiXeTongInWorkingHours = false,
  lunchOtHours = undefined,
) {
  if (
    hasPayrollLeaveType(
      leaveType,
      includeTapVuInWorkingHours,
      includeThaiSanInWorkingHours,
    )
  ) {
    if (isHalfPnLeaveType(leaveType) && !isNightShiftCaLamViec(shiftCode)) {
      if (!isStrictOffDay && !isHolidayDay) {
        const h = getPayrollHalfDayLeaveWorkedHours(
          timeIn,
          timeOut,
          shiftCode,
          includeTapVuInWorkingHours,
          includeThaiSanInWorkingHours,
          includeTaiXeInWorkingHours,
          includeTaiXeTongInWorkingHours,
        );
        const regularHours = h == null ? 0 : h;
        const n = getPayrollDayOvertimeHoursNumeric(
          timeIn,
          timeOut,
          false,
          shiftCode,
          payrollEarlyOtPaperwork,
          false,
          payrollLateOtExcluded,
          includeTapVuInWorkingHours,
          includeThaiSanInWorkingHours,
          includeTaiXeInWorkingHours,
          includeTaiXeTongInWorkingHours,
          lunchOtHours,
        );
        const overtimeHours = n == null ? 0 : n;
        return regularHours + overtimeHours;
      }
      const merged = getPayrollDayShiftOffHolidayMergedHoursNumeric(
        timeIn,
        timeOut,
        isStrictOffDay,
        isHolidayDay,
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
      return merged == null ? 0 : merged;
    }
    return 0;
  }
  let regularHours = 0;
  if (!isNightShiftCaLamViec(shiftCode)) {
    const h = getAttendanceWorkingHoursHours(
      timeIn,
      timeOut,
      shiftCode,
      includeTapVuInWorkingHours,
      includeThaiSanInWorkingHours,
      includeTaiXeInWorkingHours,
      includeTaiXeTongInWorkingHours,
    );
    if (isStrictOffDay || isHolidayDay) {
      regularHours = 0;
    } else {
      regularHours = h == null ? 0 : h;
    }
  }
  let overtimeHours = 0;
  if (!isStrictOffDay && !isHolidayDay) {
    if (!isNightShiftCaLamViec(shiftCode)) {
      const n = getPayrollDayOvertimeHoursNumeric(
        timeIn,
        timeOut,
        false,
        shiftCode,
        payrollEarlyOtPaperwork,
        false,
        payrollLateOtExcluded,
        includeTapVuInWorkingHours,
        includeThaiSanInWorkingHours,
        includeTaiXeInWorkingHours,
        includeTaiXeTongInWorkingHours,
        lunchOtHours,
      );
      overtimeHours = n == null ? 0 : n;
    }
  } else if (
    (isStrictOffDay || isHolidayDay) &&
    !isNightShiftCaLamViec(shiftCode)
  ) {
    const merged = getPayrollDayShiftOffHolidayMergedHoursNumeric(
      timeIn,
      timeOut,
      isStrictOffDay,
      isHolidayDay,
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
    return merged == null ? 0 : merged;
  }
  return regularHours + overtimeHours;
}

export function formatPayrollTableTotalDayGcCell(
  timeIn,
  timeOut,
  isStrictOffDay,
  isHolidayDay,
  shiftCode,
  payrollEarlyOtPaperwork,
  leaveType,
  payrollLateOtExcluded = false,
  includeTapVuInWorkingHours = false,
  includeThaiSanInWorkingHours = false,
  includeTaiXeInWorkingHours = false,
  includeTaiXeTongInWorkingHours = false,
  lunchOtHours = undefined,
) {
  const sum = payrollTotalDayGcNumeric(
    timeIn,
    timeOut,
    isStrictOffDay,
    isHolidayDay,
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
  if (sum === 0) return PAYROLL_CELL_DASH;
  return payrollHoursCellDisplay(String(sum));
}

/** Tổng khối ca đêm: GC + TC (ngày off/lễ = đã gộp trong một cột GC ca đêm off/lễ). */
export function formatPayrollTableTotalNightGcCell(
  timeIn,
  timeOut,
  payrollOffLike,
  shiftCode,
  leaveType,
  includeTapVuInWorkingHours = false,
  includeThaiSanInWorkingHours = false,
  includeTaiXeInWorkingHours = false,
  includeTaiXeTongInWorkingHours = false,
  payrollEarlyOtPaperwork = undefined,
) {
  if (
    hasPayrollLeaveType(
      leaveType,
      includeTapVuInWorkingHours,
      includeThaiSanInWorkingHours,
    )
  )
    return PAYROLL_CELL_DASH;
  if (!isNightShiftCaLamViec(shiftCode)) return PAYROLL_CELL_DASH;
  if (payrollOffLike) {
    const merged = getNightShiftPayrollOffHolidayMergedHoursNumeric(
      timeIn,
      timeOut,
      shiftCode,
      payrollEarlyOtPaperwork,
    );
    const sum = merged == null ? 0 : merged;
    if (sum === 0) return PAYROLL_CELL_DASH;
    return payrollHoursCellDisplay(String(sum));
  }
  const parts = getNightShiftPayrollRegularHoursAndOtMinutes(
    timeIn,
    timeOut,
    shiftCode,
    payrollEarlyOtPaperwork,
  );
  const regularHours =
    parts != null && Number.isFinite(parts.regularHours)
      ? parts.regularHours
      : 0;
  const otH = getNightShiftPayrollOvertimeHours(
    timeIn,
    timeOut,
    shiftCode,
    payrollEarlyOtPaperwork,
  );
  const overtimeHours = otH != null && Number.isFinite(otH) ? otH : 0;
  const sum = regularHours + overtimeHours;
  if (sum === 0) return PAYROLL_CELL_DASH;
  return payrollHoursCellDisplay(String(sum));
}
