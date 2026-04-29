import { isAttendanceActualLeaveType } from "@/features/attendance/attendanceGioVaoTypeOptions";
import { formatAttendanceLeaveTypeColumnDisplay } from "@/features/attendance/attendanceGioVaoTypeOptions";

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
 * **Ca đêm:** chọn `caLamViec` có chữ «đêm» / «night» (giống thống kê combo). Khi
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
 */

const HHMM = /^(\d{1,2}):(\d{2})$/;

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
 * Làm tròn giờ hiển thị bảng lương / xuất Excel: **0,5 giờ** (gần nhất).
 * @param {number} value
 * @returns {number}
 */
export function roundHoursForPayrollDisplay(value) {
  if (!Number.isFinite(value)) return value;
  return Math.round(value * 2 + 1e-9) / 2;
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

/** Phút trên trục tuyến tính: 05:00 đầu tiên **sau** `gioVao` (phút từ 0:00 ngày của dòng). */
function getNightShiftPayrollCutoffEndMinutes(gioVaoMinutes) {
  const a = gioVaoMinutes;
  if (a < NIGHT_SHIFT_PAYROLL_CUTOFF_MIN) return NIGHT_SHIFT_PAYROLL_CUTOFF_MIN;
  return MINUTES_PER_DAY + NIGHT_SHIFT_PAYROLL_CUTOFF_MIN;
}

/**
 * Giờ công ca đêm (tối đa 8) và phút tăng ca sau mốc 05:00 (để × 0.5 / 30p).
 * @returns {{ regularHours: number; otMinutes: number } | null}
 */
export function getNightShiftPayrollRegularHoursAndOtMinutes(
  gioVao,
  gioRa,
  caLamViec,
) {
  if (!isNightShiftCaLamViec(caLamViec)) return null;
  const a = parseHHMMToMinutes(gioVao);
  const b = parseHHMMToMinutes(gioRa);
  if (a == null || b == null) return null;
  const T0 = a;
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

/** TC ca đêm: sau mốc 05:00, floor(phút / 30) × 0.5 — giống block 30 phút. */
export function getNightShiftPayrollOvertimeHoursFromOtMinutes(otMinutes) {
  const m = Number(otMinutes);
  if (!Number.isFinite(m) || m <= 0) return 0;
  return Math.floor(m / 30) * 0.5;
}

/**
 * @returns {number | null} null nếu không phải ca đêm hoặc không tính được.
 */
export function getNightShiftPayrollOvertimeHours(gioVao, gioRa, caLamViec) {
  const parts = getNightShiftPayrollRegularHoursAndOtMinutes(
    gioVao,
    gioRa,
    caLamViec,
  );
  if (parts == null) return null;
  return getNightShiftPayrollOvertimeHoursFromOtMinutes(parts.otMinutes);
}

/** Đồng bộ cờ `nightShift` trong `attendanceComboStats` + dropdown ca làm việc. */
export function isNightShiftCaLamViec(caLamViec) {
  if (caLamViec == null) return false;
  const s = String(caLamViec).trim().toUpperCase().replace(/\s+/g, "");
  // Quy ước mới: chỉ S2 là ca đêm; S1 đi theo logic ca ngày.
  return s === "S2";
}

/**
 * @param {unknown} gioVao
 * @param {unknown} gioRa
 * @param {unknown} [caLamViec] — nếu là ca đêm và ra ≤ vào, tính qua nửa đêm.
 * @returns {number | null}
 */
export function getAttendanceWorkingHoursHours(gioVao, gioRa, caLamViec) {
  const a = parseHHMMToMinutes(gioVao);
  const b = parseHHMMToMinutes(gioRa);
  if (a == null || b == null) return null;

  const night = isNightShiftCaLamViec(caLamViec);
  if (b <= a) {
    if (!night) return null;
    const spanMinutes = MINUTES_PER_DAY - a + b;
    const raw = roundHoursToTenths(spanMinutes / 60);
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
 * @param {unknown} gioVao
 * @param {unknown} gioRa
 * @param {unknown} [caLamViec]
 * @returns {string} Rỗng nếu không tính được.
 */
export function formatAttendanceWorkingHoursLabel(gioVao, gioRa, caLamViec) {
  const h = getAttendanceWorkingHoursHours(gioVao, gioRa, caLamViec);
  if (h == null) return "";
  return `${h}`;
}

/**
 * Ca đêm ngày off/lễ: GC (đến mốc 05:00, tối đa 8h) + TC ca đêm (sau 05:00) — cùng quy tắc ca đêm ngày thường, một số gộp.
 * @returns {number | null}
 */
export function getNightShiftPayrollOffHolidayMergedHoursNumeric(
  gioVao,
  gioRa,
  caLamViec,
) {
  if (!isNightShiftCaLamViec(caLamViec)) return null;
  const parts = getNightShiftPayrollRegularHoursAndOtMinutes(
    gioVao,
    gioRa,
    caLamViec,
  );
  if (parts == null) return null;
  const gc = Number.isFinite(parts.regularHours) ? parts.regularHours : 0;
  const otH = getNightShiftPayrollOvertimeHours(gioVao, gioRa, caLamViec);
  const tc = otH != null && Number.isFinite(otH) ? otH : 0;
  return roundHoursToTenths(gc + tc);
}

/** Ký tự thống nhất cho ô không có số / 0 giờ (tránh lẫn em-dash «—»). */
const PAYROLL_CELL_DASH = "-";

function hasPayrollLeaveType(leaveTypeRaw) {
  return isAttendanceActualLeaveType(leaveTypeRaw);
}

function isHalfPnLeaveType(leaveTypeRaw) {
  return formatAttendanceLeaveTypeColumnDisplay(leaveTypeRaw) === "1/2PN";
}

function hasBothValidAttendanceTimes(gioVao, gioRa) {
  return (
    parseHHMMToMinutes(gioVao) != null && parseHHMMToMinutes(gioRa) != null
  );
}

const HALF_DAY_MORNING_START_MIN = 8 * 60;
const HALF_DAY_NOON_MIN = 12 * 60;
const HALF_DAY_AFTERNOON_END_MIN = 17 * 60;

export function getPayrollHalfDayLeaveWorkedHours(gioVao, gioRa, caLamViec) {
  if (isNightShiftCaLamViec(caLamViec)) return null;
  const a = parseHHMMToMinutes(gioVao);
  const b = parseHHMMToMinutes(gioRa);
  if (a == null || b == null) return null;

  // 1/2PN nghỉ buổi chiều: làm buổi sáng (vào trước 08:00) => 4h cố định.
  if (a < HALF_DAY_MORNING_START_MIN && b > a) return 4;
  // 1/2PN nghỉ buổi sáng: làm buổi chiều (từ 12:00) => 4h cố định.
  if (a >= HALF_DAY_NOON_MIN && b > a) return 4;

  const h = getAttendanceWorkingHoursHours(gioVao, gioRa, caLamViec);
  if (h == null || h <= 0) return null;
  // Luôn chặn trần 4h cho 1/2PN để không xuất hiện 4.5.
  return Math.min(4, h);
}

/** Chuỗi hiển thị ô giờ lương: số → làm tròn 0,5h; 0, rỗng, em-dash → «-». */
function payrollHoursCellDisplay(value) {
  if (value == null) return PAYROLL_CELL_DASH;
  const s = String(value).trim();
  if (s === "" || s === "—") return PAYROLL_CELL_DASH;
  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n)) return s;
  if (n === 0) return PAYROLL_CELL_DASH;
  const r = roundHoursForPayrollDisplay(n);
  if (r === 0) return PAYROLL_CELL_DASH;
  return String(r);
}

/**
 * Cột **Giờ công** (bảng lương).
 * **Ngày off + ca ngày:** «-» — giờ quy đổi nằm ở cột **TC off**.
 * **Ca đêm (không off):** «-» — giờ nằm ở «GC ca đêm» / «TC ca đêm».
 * **Ca đêm + ngày off:** «-» — GC nằm ở «GC ca đêm off».
 */
export function formatPayrollTableWorkingHoursCell(
  gioVao,
  gioRa,
  isOffDay,
  caLamViec,
  leaveTypeRaw,
) {
  if (hasPayrollLeaveType(leaveTypeRaw)) {
    if (isHalfPnLeaveType(leaveTypeRaw) && !isOffDay) {
      const h = getPayrollHalfDayLeaveWorkedHours(gioVao, gioRa, caLamViec);
      if (h != null && h > 0) return payrollHoursCellDisplay(String(h));
    }
    return PAYROLL_CELL_DASH;
  }
  if (isNightShiftCaLamViec(caLamViec)) {
    return PAYROLL_CELL_DASH;
  }
  if (isOffDay) {
    return PAYROLL_CELL_DASH;
  }
  return payrollHoursCellDisplay(
    formatAttendanceWorkingHoursLabel(gioVao, gioRa, caLamViec) ||
      PAYROLL_CELL_DASH,
  );
}

/**
 * Cột **TC off** (ca ngày): chỉ khi **Ngày off** (OFF), không phải ngày lễ — GC + TC gộp (cùng quy tắc như ngày thường, một ô).
 * Ngày lễ (HOLIDAY): «-» — giờ nằm ở cột **Giờ công ngày lễ**.
 */
export function formatPayrollTableOffDayTcCell(
  gioVao,
  gioRa,
  isStrictOffDay,
  caLamViec,
  earlyOtPaperwork,
  leaveTypeRaw,
  lateOtExcluded = false,
) {
  if (hasPayrollLeaveType(leaveTypeRaw)) return PAYROLL_CELL_DASH;
  if (isNightShiftCaLamViec(caLamViec)) {
    return PAYROLL_CELL_DASH;
  }
  if (!isStrictOffDay) {
    return PAYROLL_CELL_DASH;
  }
  const merged = getPayrollDayShiftOffHolidayMergedHoursNumeric(
    gioVao,
    gioRa,
    true,
    false,
    caLamViec,
    earlyOtPaperwork,
    leaveTypeRaw,
    lateOtExcluded,
  );
  return payrollHoursCellDisplay(
    merged == null ? PAYROLL_CELL_DASH : String(merged),
  );
}

/**
 * Cột **Giờ công ngày lễ** — ca ngày, chỉ khi **Ngày lễ** (HOLIDAY). GC + TC gộp một ô.
 */
export function formatPayrollTableHolidayDayWorkingCell(
  gioVao,
  gioRa,
  isHolidayDay,
  caLamViec,
  earlyOtPaperwork,
  leaveTypeRaw,
  lateOtExcluded = false,
) {
  if (hasPayrollLeaveType(leaveTypeRaw)) return PAYROLL_CELL_DASH;
  if (!isHolidayDay || isNightShiftCaLamViec(caLamViec)) {
    return PAYROLL_CELL_DASH;
  }
  const merged = getPayrollDayShiftOffHolidayMergedHoursNumeric(
    gioVao,
    gioRa,
    false,
    true,
    caLamViec,
    earlyOtPaperwork,
    leaveTypeRaw,
    lateOtExcluded,
  );
  return payrollHoursCellDisplay(
    merged == null ? PAYROLL_CELL_DASH : String(merged),
  );
}

/**
 * Cột **Giờ công ca đêm ngày lễ** — GC ca đêm + TC ca đêm gộp (cùng quy tắc ca đêm BT).
 */
export function formatPayrollTableHolidayNightWorkingCell(
  gioVao,
  gioRa,
  isHolidayDay,
  caLamViec,
  leaveTypeRaw,
) {
  if (hasPayrollLeaveType(leaveTypeRaw)) return PAYROLL_CELL_DASH;
  if (!isHolidayDay || !isNightShiftCaLamViec(caLamViec)) {
    return PAYROLL_CELL_DASH;
  }
  const merged = getNightShiftPayrollOffHolidayMergedHoursNumeric(
    gioVao,
    gioRa,
    caLamViec,
  );
  return payrollHoursCellDisplay(
    merged == null ? PAYROLL_CELL_DASH : String(merged),
  );
}

/** Cột «Giờ công ca đêm» — chỉ có số khi `caLamViec` là ca đêm và tính được. */
export function formatPayrollTableNightShiftWorkingCell(
  gioVao,
  gioRa,
  isOffDay,
  caLamViec,
  leaveTypeRaw,
) {
  if (hasPayrollLeaveType(leaveTypeRaw)) return PAYROLL_CELL_DASH;
  if (!isNightShiftCaLamViec(caLamViec)) return PAYROLL_CELL_DASH;
  if (isOffDay) return PAYROLL_CELL_DASH;
  const parts = getNightShiftPayrollRegularHoursAndOtMinutes(
    gioVao,
    gioRa,
    caLamViec,
  );
  if (parts == null) return PAYROLL_CELL_DASH;
  return payrollHoursCellDisplay(`${parts.regularHours}`);
}

/**
 * Cột «GC ca đêm ngày off» — chỉ **Ngày off** (OFF), không phải lễ.
 * Ngày lễ + ca đêm: «-» — GC nằm ở **Giờ công ca đêm ngày lễ**.
 */
export function formatPayrollTableNightShiftOffDayWorkingCell(
  gioVao,
  gioRa,
  isStrictOffDay,
  caLamViec,
  leaveTypeRaw,
) {
  if (hasPayrollLeaveType(leaveTypeRaw)) return PAYROLL_CELL_DASH;
  if (!isNightShiftCaLamViec(caLamViec)) return PAYROLL_CELL_DASH;
  if (!isStrictOffDay) return PAYROLL_CELL_DASH;
  const merged = getNightShiftPayrollOffHolidayMergedHoursNumeric(
    gioVao,
    gioRa,
    caLamViec,
  );
  return payrollHoursCellDisplay(
    merged == null ? PAYROLL_CELL_DASH : String(merged),
  );
}

/** Cột «TC ca đêm» — sau 05:00, 30 phút = 0,5; ngày off/lễ không tách → «-». */
export function formatPayrollTableNightShiftOvertimeCell(
  gioVao,
  gioRa,
  payrollOffLike,
  caLamViec,
  leaveTypeRaw,
) {
  if (hasPayrollLeaveType(leaveTypeRaw)) return PAYROLL_CELL_DASH;
  if (!isNightShiftCaLamViec(caLamViec)) return PAYROLL_CELL_DASH;
  if (payrollOffLike) return PAYROLL_CELL_DASH;
  const h = getNightShiftPayrollOvertimeHours(gioVao, gioRa, caLamViec);
  if (h == null) return PAYROLL_CELL_DASH;
  if (h === 0) return PAYROLL_CELL_DASH;
  return payrollHoursCellDisplay(String(h));
}

/** Mốc bắt đầu tính tăng ca (17:00). */
const OT_PAY_START_MIN = 17 * 60;
/** Chỉ có tăng ca khi giờ ra sau > 17:30 (phút). */
const OT_ELIGIBLE_AFTER_MIN = 17 * 60 + 30;

/** Bảng lương: vào ≤ 06:00 (ca ngày) + có giấy tăng ca → cộng khung 06:00–08:00 vào cột Giờ TC (hệ số lương ×1.5 áp ngoài cột). */
const EARLY_PAPERWORK_CUTOFF_MIN = 6 * 60;
/** Giờ công tăng ca quy đổi vào cột Giờ TC (2h). */
const EARLY_PAPERWORK_OT_HOURS = 2;

/**
 * Giờ tăng ca: từ 17:00 đến giờ ra, cứ 30 phút = 0.5h (làm tròn xuống theo block 30 phút).
 * Chỉ áp dụng khi giờ ra sau 17:30.
 * @param {unknown} gioRa
 * @returns {number | null} null nếu không đọc được giờ ra; 0 nếu không đủ điều kiện TC.
 */
export function getOvertimeHoursFromGioRa(gioRa) {
  const b = parseHHMMToMinutes(gioRa);
  if (b == null) return null;
  if (b <= OT_ELIGIBLE_AFTER_MIN) return 0;
  const minutesFrom17 = b - OT_PAY_START_MIN;
  if (minutesFrom17 <= 0) return 0;
  const blocks = Math.floor(minutesFrom17 / 30);
  return blocks * 0.5;
}

/**
 * Ca ngày, giờ vào ≤ 06:00 — đủ điều kiện hỏi «có giấy tăng ca 06:00–08:00» (bảng lương).
 * Không áp dụng ca đêm (cột TC riêng).
 */
export function isEarlyArrivalFor0600PaperworkOvertime(gioVao, caLamViec) {
  if (isNightShiftCaLamViec(caLamViec)) return false;
  const a = parseHHMMToMinutes(gioVao);
  if (a == null) return false;
  return a <= EARLY_PAPERWORK_CUTOFF_MIN;
}

/**
 * Giờ TC khối ngày (cột «Giờ TC»): tăng ca sau 17:30 + (tùy chọn) 2h khi có giấy và vào ≤ 06:00.
 * Ca ngày: **bắt buộc có giờ ra hợp lệ** mới tính TC (kể cả phần giấy sớm) — tránh có 2h TC khi chưa chấm giờ ra.
 * @param {boolean | undefined} earlyOtPaperwork — `true` nếu user xác nhận có giấy.
 * @param {boolean | undefined} lateOtExcluded — `true` nếu user xác nhận KHONG tinh tang ca sau 17:30.
 * @returns {number | null} null nếu không đọc được giờ ra (ca ngày / ca đêm).
 */
export function getPayrollDayOvertimeHoursNumeric(
  gioVao,
  gioRa,
  isOffDay,
  caLamViec,
  earlyOtPaperwork,
  isHolidayDay = false,
  lateOtExcluded = false,
) {
  if (isNightShiftCaLamViec(caLamViec)) {
    return getOvertimeHoursFromGioRa(gioRa);
  }

  const eveningRaw = getOvertimeHoursFromGioRa(gioRa);
  if (eveningRaw == null) {
    return null;
  }
  const evening = lateOtExcluded === true ? 0 : eveningRaw;
  let early = 0;
  if (
    earlyOtPaperwork === true &&
    isEarlyArrivalFor0600PaperworkOvertime(gioVao, caLamViec)
  ) {
    early = EARLY_PAPERWORK_OT_HOURS;
  }

  return roundHoursToTenths(evening + early);
}

/**
 * Ca ngày, ngày off hoặc lễ: Giờ công BT + TC (chiều / giấy sớm) — một số hiển thị gộp (cột TC off / GC lễ).
 * @returns {number | null}
 */
export function getPayrollDayShiftOffHolidayMergedHoursNumeric(
  gioVao,
  gioRa,
  isStrictOffDay,
  isHolidayDay,
  caLamViec,
  earlyOtPaperwork,
  leaveTypeRaw,
  lateOtExcluded = false,
) {
  if (hasPayrollLeaveType(leaveTypeRaw)) return null;
  if (!isStrictOffDay && !isHolidayDay) return null;
  if (isNightShiftCaLamViec(caLamViec)) return null;
  // OFF/HOLIDAY chỉ tính khi có đủ giờ vào + giờ ra hợp lệ.
  if (!hasBothValidAttendanceTimes(gioVao, gioRa)) return null;
  const h = getAttendanceWorkingHoursHours(gioVao, gioRa, caLamViec);
  const n = getPayrollDayOvertimeHoursNumeric(
    gioVao,
    gioRa,
    isStrictOffDay,
    caLamViec,
    earlyOtPaperwork,
    isHolidayDay,
    lateOtExcluded,
  );
  if (h == null && n == null) return null;
  const gc = h == null ? 0 : h;
  const tc = n == null ? 0 : n;
  return roundHoursToTenths(gc + tc);
}

/**
 * Hiển thị ô Giờ TC (bảng lương — ca ngày có thể cộng TC sớm).
 * Ngày off/lễ (ca ngày): «-» — TC đã gộp vào TC off / GC ngày lễ.
 */
export function formatPayrollDayOvertimeHoursCell(
  gioVao,
  gioRa,
  isOffDay,
  caLamViec,
  earlyOtPaperwork,
  isHolidayDay = false,
  lateOtExcluded = false,
) {
  if (isNightShiftCaLamViec(caLamViec)) {
    return formatOvertimeHoursLabel(gioRa);
  }
  if (isOffDay || isHolidayDay) {
    return PAYROLL_CELL_DASH;
  }
  const n = getPayrollDayOvertimeHoursNumeric(
    gioVao,
    gioRa,
    isOffDay,
    caLamViec,
    earlyOtPaperwork,
    isHolidayDay,
    lateOtExcluded,
  );
  if (n == null) return PAYROLL_CELL_DASH;
  if (n === 0) return PAYROLL_CELL_DASH;
  return payrollHoursCellDisplay(String(n));
}

/**
 * @param {unknown} gioRa
 * @returns {string} «-» nếu không đọc được giờ ra hoặc 0 TC; số nếu có TC.
 */
export function formatOvertimeHoursLabel(gioRa) {
  const h = getOvertimeHoursFromGioRa(gioRa);
  if (h == null) return PAYROLL_CELL_DASH;
  if (h === 0) return PAYROLL_CELL_DASH;
  return payrollHoursCellDisplay(String(h));
}

/**
 * Tổng GC (khối ngày): Giờ công + Giờ TC.
 * Ngày off / lễ (ca ngày): một tổng — đã gộp GC + TC trong TC off / GC lễ (cột Giờ TC ngày off/lễ là «-»).
 * Ca đêm: không cộng khối ngày — dùng «Tổng GC ca đêm».
 */
function payrollTotalDayGcNumeric(
  gioVao,
  gioRa,
  isStrictOffDay,
  isHolidayDay,
  caLamViec,
  earlyOtPaperwork,
  leaveTypeRaw,
  lateOtExcluded = false,
) {
  if (hasPayrollLeaveType(leaveTypeRaw)) {
    if (isHalfPnLeaveType(leaveTypeRaw) && !isStrictOffDay && !isHolidayDay) {
      const h = getPayrollHalfDayLeaveWorkedHours(gioVao, gioRa, caLamViec);
      return roundHoursForPayrollDisplay(h == null ? 0 : h);
    }
    return 0;
  }
  let gc = 0;
  if (!isNightShiftCaLamViec(caLamViec)) {
    const h = getAttendanceWorkingHoursHours(gioVao, gioRa, caLamViec);
    if (isStrictOffDay || isHolidayDay) {
      gc = 0;
    } else {
      gc = h == null ? 0 : h;
    }
  }
  let tc = 0;
  if (!isStrictOffDay && !isHolidayDay) {
    if (!isNightShiftCaLamViec(caLamViec)) {
      const n = getPayrollDayOvertimeHoursNumeric(
        gioVao,
        gioRa,
        false,
        caLamViec,
        earlyOtPaperwork,
        false,
        lateOtExcluded,
      );
      tc = n == null ? 0 : n;
    } else {
      const o = getOvertimeHoursFromGioRa(gioRa);
      tc = o == null ? 0 : o;
    }
  } else if (
    (isStrictOffDay || isHolidayDay) &&
    !isNightShiftCaLamViec(caLamViec)
  ) {
    const merged = getPayrollDayShiftOffHolidayMergedHoursNumeric(
      gioVao,
      gioRa,
      isStrictOffDay,
      isHolidayDay,
      caLamViec,
      earlyOtPaperwork,
      leaveTypeRaw,
      lateOtExcluded,
    );
    return roundHoursForPayrollDisplay(merged == null ? 0 : merged);
  }
  return roundHoursForPayrollDisplay(roundHoursToTenths(gc + tc));
}

export function formatPayrollTableTotalDayGcCell(
  gioVao,
  gioRa,
  isStrictOffDay,
  isHolidayDay,
  caLamViec,
  earlyOtPaperwork,
  leaveTypeRaw,
  lateOtExcluded = false,
) {
  const sum = payrollTotalDayGcNumeric(
    gioVao,
    gioRa,
    isStrictOffDay,
    isHolidayDay,
    caLamViec,
    earlyOtPaperwork,
    leaveTypeRaw,
    lateOtExcluded,
  );
  if (sum === 0) return PAYROLL_CELL_DASH;
  return payrollHoursCellDisplay(String(sum));
}

/** Tổng khối ca đêm: GC + TC (ngày off/lễ = đã gộp trong một cột GC ca đêm off/lễ). */
export function formatPayrollTableTotalNightGcCell(
  gioVao,
  gioRa,
  payrollOffLike,
  caLamViec,
  leaveTypeRaw,
) {
  if (hasPayrollLeaveType(leaveTypeRaw)) return PAYROLL_CELL_DASH;
  if (!isNightShiftCaLamViec(caLamViec)) return PAYROLL_CELL_DASH;
  if (payrollOffLike) {
    const merged = getNightShiftPayrollOffHolidayMergedHoursNumeric(
      gioVao,
      gioRa,
      caLamViec,
    );
    const sum = roundHoursForPayrollDisplay(merged == null ? 0 : merged);
    if (sum === 0) return PAYROLL_CELL_DASH;
    return payrollHoursCellDisplay(String(sum));
  }
  const parts = getNightShiftPayrollRegularHoursAndOtMinutes(
    gioVao,
    gioRa,
    caLamViec,
  );
  const gc =
    parts != null && Number.isFinite(parts.regularHours)
      ? parts.regularHours
      : 0;
  const otH = getNightShiftPayrollOvertimeHours(gioVao, gioRa, caLamViec);
  const tc = otH != null && Number.isFinite(otH) ? otH : 0;
  const sum = roundHoursForPayrollDisplay(roundHoursToTenths(gc + tc));
  if (sum === 0) return PAYROLL_CELL_DASH;
  return payrollHoursCellDisplay(String(sum));
}
