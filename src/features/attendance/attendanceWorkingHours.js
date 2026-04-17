/**
 * Giờ công hiển thị trên bảng điểm danh / lương.
 * Ca ngày chuẩn (8h cố định): giờ vào **từ 7:00 đến trước 7:30** (7:01, 7:28, …) và
 * giờ ra **trước 17:30** → **8 giờ công** (không theo chênh lệch đồng hồ).
 * Ngoài khung đó: khoảng giờ giữa hai mốc (làm tròn 0.1), **tối đa 8 giờ**
 * (phần trên 8h không cộng ở đây vì đã tách sang cột giờ tăng ca).
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
 * **GC ca đêm ngày off:** cùng công thức **GC ca đêm**, chỉ hiển thị khi **Ngày off** + **Ca đêm**.
 * **Ngày off + ca ngày:** giờ làm quy đổi hiển thị ở cột **TC off** (cột Giờ công là «-»). **Ngày không off:** giờ công ở cột **Giờ công** như bình thường.
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

/** Bắt đầu khung vào ca sáng (7:00). */
const ARRIVAL_WINDOW_START_MIN = 6 * 60 + 30;
/** Hết khung vào ca sáng: **trước 7:30** (7:00 … 8:00). Đổi hằng nếu công ty cho phép đến 8:00. */
const ARRIVAL_WINDOW_END_EXCLUSIVE_MIN = 8 * 60;
/** Giờ ra trước 17:30: phút b < 17×60+30. */
const BEFORE_1730_MIN = 17 * 60 + 30;

/** Trần giờ công (cột chính); phần vượt quy vào tăng ca. */
const MAX_REGULAR_WORKING_HOURS = 8;

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

/** Đồng bộ cờ `nightShift` trong `attendanceComboStats` + dropdown «Ca đêm». */
export function isNightShiftCaLamViec(caLamViec) {
  if (caLamViec == null) return false;
  const s = String(caLamViec).trim().toLowerCase();
  return (
    s.includes("đêm") || s.includes("dem") || s.includes("night")
  );
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

  if (
    !night &&
    a >= ARRIVAL_WINDOW_START_MIN &&
    a < ARRIVAL_WINDOW_END_EXCLUSIVE_MIN &&
    b < BEFORE_1730_MIN
  ) {
    return MAX_REGULAR_WORKING_HOURS;
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

/** Ký tự thống nhất cho ô không có số / 0 giờ (tránh lẫn em-dash «—»). */
const PAYROLL_CELL_DASH = "-";

/** Chuỗi hiển thị ô giờ lương: 0, rỗng, em-dash → cùng một gạch ngang ASCII. */
function payrollHoursCellDisplay(value) {
  if (value == null) return PAYROLL_CELL_DASH;
  const s = String(value).trim();
  if (s === "" || s === "—") return PAYROLL_CELL_DASH;
  const n = Number(s.replace(",", "."));
  if (Number.isFinite(n) && n === 0) return PAYROLL_CELL_DASH;
  return s;
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
) {
  if (isNightShiftCaLamViec(caLamViec)) {
    return PAYROLL_CELL_DASH;
  }
  if (isOffDay) {
    return PAYROLL_CELL_DASH;
  }
  return payrollHoursCellDisplay(
    formatAttendanceWorkingHoursLabel(gioVao, gioRa, caLamViec) || PAYROLL_CELL_DASH,
  );
}

/**
 * Cột **TC off** (ca ngày): khi **Ngày off** — giờ làm quy đổi (cùng quy tắc điểm danh).
 * Ngày không off hoặc ca đêm: «-» (ca đêm dùng cột GC ca đêm / GC ca đêm off).
 */
export function formatPayrollTableOffDayTcCell(
  gioVao,
  gioRa,
  isOffDay,
  caLamViec,
) {
  if (isNightShiftCaLamViec(caLamViec)) {
    return PAYROLL_CELL_DASH;
  }
  if (!isOffDay) {
    return PAYROLL_CELL_DASH;
  }
  return payrollHoursCellDisplay(
    formatAttendanceWorkingHoursLabel(gioVao, gioRa, caLamViec) || PAYROLL_CELL_DASH,
  );
}

/** Cột «Giờ công ca đêm» — chỉ có số khi `caLamViec` là ca đêm và tính được. */
export function formatPayrollTableNightShiftWorkingCell(
  gioVao,
  gioRa,
  isOffDay,
  caLamViec,
) {
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
 * Cột «GC ca đêm ngày off» — cùng quy tắc `getNightShiftPayrollRegularHoursAndOtMinutes`;
 * chỉ có số khi **Ngày off** và ca đêm (ngày thường hiển thị «-»).
 */
export function formatPayrollTableNightShiftOffDayWorkingCell(
  gioVao,
  gioRa,
  isOffDay,
  caLamViec,
) {
  if (!isNightShiftCaLamViec(caLamViec)) return PAYROLL_CELL_DASH;
  if (!isOffDay) return PAYROLL_CELL_DASH;
  const parts = getNightShiftPayrollRegularHoursAndOtMinutes(
    gioVao,
    gioRa,
    caLamViec,
  );
  if (parts == null) return PAYROLL_CELL_DASH;
  return payrollHoursCellDisplay(`${parts.regularHours}`);
}

/** Cột «TC ca đêm» — sau 05:00, 30 phút = 0,5; không TC / 0 → «-». */
export function formatPayrollTableNightShiftOvertimeCell(
  gioVao,
  gioRa,
  _isOffDay,
  caLamViec,
) {
  if (!isNightShiftCaLamViec(caLamViec)) return PAYROLL_CELL_DASH;
  const h = getNightShiftPayrollOvertimeHours(gioVao, gioRa, caLamViec);
  if (h == null) return PAYROLL_CELL_DASH;
  if (h === 0) return PAYROLL_CELL_DASH;
  return `${h}`;
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
 * @returns {number | null} null nếu không đọc được giờ ra (ca ngày / ca đêm).
 */
export function getPayrollDayOvertimeHoursNumeric(
  gioVao,
  gioRa,
  isOffDay,
  caLamViec,
  earlyOtPaperwork,
) {
  if (isNightShiftCaLamViec(caLamViec)) {
    return getOvertimeHoursFromGioRa(gioRa);
  }
  if (isOffDay) return 0;

  const evening = getOvertimeHoursFromGioRa(gioRa);
  if (evening == null) {
    return null;
  }
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
 * Hiển thị ô Giờ TC (bảng lương — ca ngày có thể cộng TC sớm).
 */
export function formatPayrollDayOvertimeHoursCell(
  gioVao,
  gioRa,
  isOffDay,
  caLamViec,
  earlyOtPaperwork,
) {
  if (isNightShiftCaLamViec(caLamViec)) {
    return formatOvertimeHoursLabel(gioRa);
  }
  const n = getPayrollDayOvertimeHoursNumeric(
    gioVao,
    gioRa,
    isOffDay,
    caLamViec,
    earlyOtPaperwork,
  );
  if (n == null) return PAYROLL_CELL_DASH;
  if (n === 0) return PAYROLL_CELL_DASH;
  return `${n}`;
}

/**
 * @param {unknown} gioRa
 * @returns {string} «-» nếu không đọc được giờ ra hoặc 0 TC; số nếu có TC.
 */
export function formatOvertimeHoursLabel(gioRa) {
  const h = getOvertimeHoursFromGioRa(gioRa);
  if (h == null) return PAYROLL_CELL_DASH;
  if (h === 0) return PAYROLL_CELL_DASH;
  return `${h}`;
}

/**
 * Tổng GC (khối ngày): Giờ công + Giờ TC (+ TC off khi ngày off ca ngày — cùng số giờ, chỉ tách cột).
 * Ca đêm: không cộng phần «Giờ công» (cột đó trống) — dùng «Tổng GC ca đêm».
 */
function payrollTotalDayGcNumeric(gioVao, gioRa, isOffDay, caLamViec, earlyOtPaperwork) {
  let gc = 0;
  if (!isNightShiftCaLamViec(caLamViec)) {
    const h = getAttendanceWorkingHoursHours(gioVao, gioRa, caLamViec);
    if (isOffDay) {
      gc = 0;
    } else {
      gc = h == null ? 0 : h;
    }
  }
  let tc = 0;
  if (!isOffDay) {
    if (!isNightShiftCaLamViec(caLamViec)) {
      const n = getPayrollDayOvertimeHoursNumeric(
        gioVao,
        gioRa,
        isOffDay,
        caLamViec,
        earlyOtPaperwork,
      );
      tc = n == null ? 0 : n;
    } else {
      const o = getOvertimeHoursFromGioRa(gioRa);
      tc = o == null ? 0 : o;
    }
  } else if (!isNightShiftCaLamViec(caLamViec)) {
    const h = getAttendanceWorkingHoursHours(gioVao, gioRa, caLamViec);
    tc = h == null ? 0 : h;
  }
  return roundHoursToTenths(gc + tc);
}

export function formatPayrollTableTotalDayGcCell(
  gioVao,
  gioRa,
  isOffDay,
  caLamViec,
  earlyOtPaperwork,
) {
  const sum = payrollTotalDayGcNumeric(
    gioVao,
    gioRa,
    isOffDay,
    caLamViec,
    earlyOtPaperwork,
  );
  if (sum === 0) return PAYROLL_CELL_DASH;
  return payrollHoursCellDisplay(String(sum));
}

/** Tổng khối ca đêm: GC (đến mốc 05:00) + TC ca đêm (sau mốc 05:00); khớp hai cột GC/TC ca đêm (và GC ca đêm off khi off). */
export function formatPayrollTableTotalNightGcCell(
  gioVao,
  gioRa,
  isOffDay,
  caLamViec,
) {
  if (!isNightShiftCaLamViec(caLamViec)) return PAYROLL_CELL_DASH;
  const parts = getNightShiftPayrollRegularHoursAndOtMinutes(
    gioVao,
    gioRa,
    caLamViec,
  );
  const gc =
    parts != null && Number.isFinite(parts.regularHours) ? parts.regularHours : 0;
  const otH = getNightShiftPayrollOvertimeHours(gioVao, gioRa, caLamViec);
  const tc = otH != null && Number.isFinite(otH) ? otH : 0;
  const sum = roundHoursToTenths(gc + tc);
  if (sum === 0) return PAYROLL_CELL_DASH;
  return payrollHoursCellDisplay(String(sum));
}
