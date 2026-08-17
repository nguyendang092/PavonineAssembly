/**
 * attendance/{date}/{firebaseKey}: dữ liệu điểm danh theo ngày (stt, mnv, giờ vào/ra, ca, PN…).
 * Màn điểm danh: sanitizeAttendanceDayNodeForUi — chỉ trường node ngày.
 */
import {
  canonicalAttendanceLoaiPhepValue,
  isAttendanceGioVaoClockTime,
  isAttendanceLoaiPhepAllowsClockTimes,
  normalizeAttendanceDayRecord,
} from "@/features/attendance/attendanceGioVaoTypeOptions";
import {
  ATTENDANCE_EMP,
  ATTENDANCE_ANNUAL_LEAVE_SYNCED_DEDUCTION,
  ATTENDANCE_ANNUAL_LEAVE_SYNCED_USED,
} from "@/features/attendance/attendanceEmployeeFields";
import { LUNCH_OT_HOUR_OPTIONS } from "@/features/attendance/attendanceWorkingHours";
import { normalizeDateForHtmlInput } from "@/utils/dateHtmlInput";

export { normalizeDateForHtmlInput } from "@/utils/dateHtmlInput";

/**
 * Chuẩn MNV duy nhất: trim, bỏ mọi khoảng trắng; giữ chữ/số/ký tự mã (vd. PAVO123).
 * Không gộp tiền tố, không ép hoa/thường, không ép kiểu số (giữ leading zero nếu có).
 */
export function attendanceMnvStorageKey(mnvRaw) {
  return String(mnvRaw ?? "")
    .trim()
    .replace(/\s+/g, "");
}

/**
 * Khóa con Firebase RTDB: `emp_{mnv}` — đồng bộ upload / thêm NV theo mã.
 * Ký tự không hợp lệ trong path (`. # $ [ ] /`) được thay bằng `_`.
 */
export function attendanceFirebaseKeyFromMnv(mnvNormalized) {
  const m = attendanceMnvStorageKey(mnvNormalized);
  if (!m) return "";
  const safe = m.replace(/[.#$[\]/]/g, "_");
  return `emp_${safe}`;
}

/**
 * Firebase child key + chế độ ghi khi lưu form điểm danh (thêm / sửa).
 * @returns {{ firebaseKey: string; recordId: string; mode: "edit" | "add-create" | "add-merge" } | null}
 */
export function resolveAttendanceFormPersistTarget({
  editAttendanceKey,
  storageKey,
  existingRaw = {},
}) {
  if (editAttendanceKey) {
    return {
      firebaseKey: editAttendanceKey,
      recordId: editAttendanceKey,
      mode: "edit",
    };
  }
  const firebaseKey = attendanceFirebaseKeyFromMnv(storageKey);
  if (!firebaseKey) return null;
  return {
    firebaseKey,
    recordId: firebaseKey,
    mode: existingRaw?.mnv ? "add-merge" : "add-create",
  };
}

/** RTDB push ids look like -Ox0abcd123... */
function isLikelyFirebasePushKey(v) {
  const s = String(v ?? "");
  return /^-[A-Za-z0-9_-]{10,}$/.test(s);
}

/** Khóa Firebase / phép năm dạng `emp_{mnv}`. */
export function isEmpFirebaseKey(key) {
  return String(key ?? "").trim().startsWith("emp_");
}

/** MNV từ khóa `emp_{mnv}` — dùng chung điểm danh, giờ công, phép năm. */
export function mnvFromEmpFirebaseKey(key) {
  const text = String(key ?? "").trim();
  if (!isEmpFirebaseKey(text)) return "";
  return attendanceMnvStorageKey(text.slice(4)) || text.slice(4);
}

/**
 * Khóa lưới giờ công tháng từ khóa `emp_{mnv}` hoặc `mnv__firebaseId`.
 * Điểm danh / phép năm dùng `emp_{mnv}`; lưới tháng tra cứu theo MNV (hoặc mnv__id khi trùng MNV).
 */
export function resolvePayrollMonthRowIdFromEmpKey(empKey) {
  const key = String(empKey ?? "").trim();
  if (!key) return "";
  if (isEmpFirebaseKey(key)) return mnvFromEmpFirebaseKey(key);
  const sep = key.indexOf("__");
  if (sep > 0) return key.slice(0, sep);
  return key;
}

/** Ngược lại: row id lưới giờ công → khóa chuẩn `emp_{mnv}`. */
export function resolveEmpFirebaseKeyFromPayrollMonthRowId(rowId) {
  const mnv = resolvePayrollMonthRowIdFromEmpKey(rowId);
  return mnv ? attendanceFirebaseKeyFromMnv(mnv) : "";
}

/** Khóa chuẩn `emp_{mnv}` từ bản ghi NV (điểm danh / giờ công / phép năm). */
export function resolveEmpFirebaseKeyFromEmployee(emp) {
  if (!emp || typeof emp !== "object") return "";

  const id = String(emp.id ?? emp.firebaseKey ?? "").trim();
  if (isEmpFirebaseKey(id)) return id;

  const code = businessEmployeeCode(emp);
  return code ? attendanceFirebaseKeyFromMnv(code) : "";
}

/** MNV nếu có; không thì businessId; không thì `emp_{mã}` / `id` bản ghi. */
export function businessEmployeeCode(emp) {
  const m = attendanceMnvStorageKey(String(emp?.mnv ?? ""));
  if (m) return m;
  const bid = attendanceMnvStorageKey(
    String(emp?.businessId ?? emp?.[ATTENDANCE_EMP.BUSINESS_ID] ?? ""),
  );
  if (bid) return bid;
  const id = String(emp?.id ?? "").trim();
  if (isEmpFirebaseKey(id)) {
    const fromKey = mnvFromEmpFirebaseKey(id);
    if (fromKey) return fromKey;
  }
  if (id && !isLikelyFirebasePushKey(id)) return id;
  return "";
}

/**
 * Strip undefined (Firebase rejects undefined).
 */
export function stripUndefined(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

const STRIP_LEGACY_ENGLISH_KEYS = [
  "id",
  "name",
  "department",
  "line",
  "position",
  "shift",
  "leader",
  "joinDate",
  "status",
  "type",
];

const ATTENDANCE_EXTRA_KEYS = [
  ATTENDANCE_EMP.TIME_IN,
  ATTENDANCE_EMP.LEAVE_TYPE,
  ATTENDANCE_EMP.TIME_OUT,
  ATTENDANCE_EMP.LUNCH_OT_HOURS,
  ATTENDANCE_EMP.DRIVER_OT_MINUTES,
  ATTENDANCE_EMP.SHIFT,
  "includeTapVuInWorkingHours",
  "includeThaiSanInWorkingHours",
  "includeTaiXeInWorkingHours",
  "includeTaiXeTongInWorkingHours",
  "includeTsNvInWorkingHours", // legacy: "tạp vụ + thai sản" chung
  ATTENDANCE_EMP.MVT,
  ATTENDANCE_EMP.DEPT_CODE,
  ATTENDANCE_EMP.GENDER,
];

/** Trường form dùng khi build `attendance/{date}` — chỉ node điểm danh. */
export const ATTENDANCE_DAY_FORM_KEYS = Object.freeze([
  ATTENDANCE_EMP.MNV,
  ATTENDANCE_EMP.STT,
  ATTENDANCE_EMP.SEASONAL_STT,
  ATTENDANCE_EMP.EMPLOYEE_NAME,
  ATTENDANCE_EMP.DEPARTMENT,
  ATTENDANCE_EMP.JOIN_DATE,
  ATTENDANCE_EMP.CONTRACT_DATE,
  ATTENDANCE_EMP.TIME_IN,
  ATTENDANCE_EMP.LEAVE_TYPE,
  ATTENDANCE_EMP.TIME_OUT,
  ATTENDANCE_EMP.LUNCH_OT_HOURS,
  ATTENDANCE_EMP.DRIVER_OT_MINUTES,
  ATTENDANCE_EMP.SHIFT,
  ATTENDANCE_EMP.COMP_LEAVE_ALLOWED,
  ATTENDANCE_EMP.DEPT_WRONG_FLAG,
  ATTENDANCE_EMP.NAME_YELLOW_BG,
  ATTENDANCE_EMP.LEAVE_TYPE_CHECK,
  ATTENDANCE_EMP.ANNUAL_LEAVE_IMAGE_URL,
  ATTENDANCE_EMP.OT_PAPERWORK_IMAGE_URL,
  "includeTapVuInWorkingHours",
  "includeThaiSanInWorkingHours",
  "includeTaiXeInWorkingHours",
  "includeTaiXeTongInWorkingHours",
  "includeTsNvInWorkingHours", // legacy: "tạp vụ + thai sản" chung
  ATTENDANCE_EMP.MVT,
  ATTENDANCE_EMP.DEPT_CODE,
  ATTENDANCE_EMP.GENDER,
]);

/** Trường được phép trên bản ghi khi đọc UI điểm danh (chính thức / thời vụ) — không trường hồ sơ. */
export const ATTENDANCE_DAY_UI_ROW_KEYS = Object.freeze([
  ATTENDANCE_EMP.STT,
  ATTENDANCE_EMP.SEASONAL_STT,
  ATTENDANCE_EMP.MNV,
  ATTENDANCE_EMP.BUSINESS_ID,
  ATTENDANCE_EMP.MVT,
  ATTENDANCE_EMP.EMPLOYEE_NAME,
  ATTENDANCE_EMP.GENDER,
  ATTENDANCE_EMP.JOIN_DATE,
  ATTENDANCE_EMP.CONTRACT_DATE,
  ATTENDANCE_EMP.DEPT_CODE,
  ATTENDANCE_EMP.DEPARTMENT,
  ATTENDANCE_EMP.TIME_IN,
  ATTENDANCE_EMP.LEAVE_TYPE,
  ATTENDANCE_EMP.TIME_OUT,
  ATTENDANCE_EMP.LUNCH_OT_HOURS,
  ATTENDANCE_EMP.DRIVER_OT_MINUTES,
  ATTENDANCE_EMP.SHIFT,
  ATTENDANCE_EMP.COMP_LEAVE_ALLOWED,
  ATTENDANCE_EMP.DEPT_WRONG_FLAG,
  ATTENDANCE_EMP.NAME_YELLOW_BG,
  ATTENDANCE_EMP.LEAVE_TYPE_CHECK,
  ATTENDANCE_EMP.ANNUAL_LEAVE_IMAGE_URL,
  ATTENDANCE_EMP.OT_PAPERWORK_IMAGE_URL,
  "includeTapVuInWorkingHours",
  "includeThaiSanInWorkingHours",
  "includeTaiXeInWorkingHours",
  "includeTaiXeTongInWorkingHours",
  "includeTsNvInWorkingHours", // legacy: "tạp vụ + thai sản" chung
  ATTENDANCE_EMP.CHAM_CONG,
  ATTENDANCE_EMP.PHEP_NAM,
  ATTENDANCE_ANNUAL_LEAVE_SYNCED_DEDUCTION,
  ATTENDANCE_ANNUAL_LEAVE_SYNCED_USED,
]);

export function pickAttendanceDayFields(raw) {
  if (!raw || typeof raw !== "object") return {};
  const o = {};
  for (const k of ATTENDANCE_DAY_UI_ROW_KEYS) {
    if (Object.prototype.hasOwnProperty.call(raw, k)) {
      o[k] = raw[k];
    }
  }
  return o;
}

/**
 * Chuẩn hóa hiển thị một dòng điểm danh: chỉ từ trường node ngày (không dùng name/position/joinDate alias profile).
 */
function normalizeAttendanceDayRowDisplay(emp) {
  if (!emp || typeof emp !== "object") return emp;
  const mnvDisplay =
    attendanceMnvStorageKey(emp[ATTENDANCE_EMP.MNV]) ||
    String(emp[ATTENDANCE_EMP.MNV] ?? "").trim();
  const out = {
    ...emp,
    [ATTENDANCE_EMP.MNV]: mnvDisplay || String(emp[ATTENDANCE_EMP.MNV] ?? "").trim(),
    [ATTENDANCE_EMP.EMPLOYEE_NAME]: String(
      emp[ATTENDANCE_EMP.EMPLOYEE_NAME] ?? "",
    ).trim(),
    [ATTENDANCE_EMP.JOIN_DATE]: (() => {
      const jr = emp[ATTENDANCE_EMP.JOIN_DATE];
      if (jr === undefined || jr === null || String(jr).trim() === "")
        return "";
      const jn = normalizeDateForHtmlInput(jr);
      return jn || String(jr).trim();
    })(),
    [ATTENDANCE_EMP.DEPARTMENT]: String(emp[ATTENDANCE_EMP.DEPARTMENT] ?? "").trim(),
  };
  delete out.ngayThangNamSinh;
  delete out.birthDate;
  return out;
}

/**
 * Đọc `attendance/{ngày}` hoặc `seasonalAttendance/{ngày}` cho bảng: lọc trường + migrate loại phép legacy + trim MNV/tên.
 */
export function sanitizeAttendanceDayNodeForUi(raw, id) {
  const source =
    raw && typeof raw === "object"
      ? (() => {
          const o = { ...raw };
          /** Legacy: thời vụ từng lưu «ngày vào làm» nhầm key `ngayThangNamSinh`. */
          if (
            !String(o.ngayVaoLam ?? "").trim() &&
            String(o.ngayThangNamSinh ?? "").trim()
          ) {
            o.ngayVaoLam = o.ngayThangNamSinh;
          }
          return o;
        })()
      : {};
  const picked = pickAttendanceDayFields(source);
  const withId = { ...picked, id };
  return normalizeAttendanceDayRowDisplay(withId);
}

/**
 * Chỉ lấy từ `form` các key thuộc node ngày + `businessId` — không trộn profile vào payload lưu điểm danh.
 */
export function formSliceForAttendanceDayDocument(form, overrides = {}) {
  const o = {};
  if (form && typeof form === "object") {
    for (const k of ATTENDANCE_DAY_FORM_KEYS) {
      if (Object.prototype.hasOwnProperty.call(form, k)) {
        o[k] = form[k];
      }
    }
    const bid =
      overrides.businessId ??
      form.businessId ??
      form[ATTENDANCE_EMP.MNV];
    if (bid !== undefined && bid !== null && String(bid).trim() !== "") {
      o.businessId = bid;
    }
  }
  return { ...o, ...overrides };
}

/** Trường legacy / metadata — không lưu vào attendance/{ngày}. Họ tên, BP nằm trên node ngày. */
const PROFILE_ONLY_STRIP_FROM_DAY = [
  "chucVu",
  "sdt",
  "chuyenCan",
  "phanQuyen",
  "emailDangNhap",
  "departmentKey",
  "department",
  "name",
  "position",
  "joinDate",
  "status",
  "type",
  "updatedAt",
  "trangThaiLamViec",
  "ngayNghiViec",
  "hinhThucNghiViec",
  "thaiSanTuNgay",
  "thaiSanDenNgay",
];

/**
 * Chuỗi theo ngày: nếu `form` có property thì dùng giá trị (kể cả `""` để xóa trên Firebase);
 * nếu không có key thì `undefined` — `preserved` + `existing` giữ dữ liệu cũ.
 * Tránh `form.x || undefined` làm mất `""` và khiến merge giữ nhầm giá trị cũ.
 *
 * `gioVao` / `gioRa`: nếu có key nhưng giá trị `null`/`undefined` (sau merge object) thì coi như
 * xóa — trả `""` để không bị nhánh `preserved` giữ nhầm giờ cũ.
 */
function attendanceDayOptionalStringFromForm(form, key) {
  if (!Object.prototype.hasOwnProperty.call(form, key)) return undefined;
  const v = form[key];
  if (v === null || v === undefined) {
    return key === ATTENDANCE_EMP.TIME_IN || key === ATTENDANCE_EMP.TIME_OUT
      ? ""
      : undefined;
  }
  return typeof v === "string" ? v.trim() : String(v);
}

/**
 * MVT / mã BP: form để trống không ghi đè giá trị cũ trên Firebase (tránh mất khi payload thiếu trường / bản ghi slim).
 */
function attendanceDayNonWipingOptionalStringFromForm(form, key) {
  if (!Object.prototype.hasOwnProperty.call(form, key)) return undefined;
  const v = form[key];
  if (v === null || v === undefined) return undefined;
  const s = typeof v === "string" ? v.trim() : String(v).trim();
  return s || undefined;
}

/**
 * attendance/{date}/{key}: stt + mnv + trường chấm công theo ngày.
 */
export function buildEmployeeAttendanceDayDocument({
  form,
  existing = {},
  isSeasonal = false,
}) {
  const mnvStored =
    attendanceMnvStorageKey(form.businessId ?? form.mnv ?? "") || undefined;

  const parseSttNumber = (raw, fallback) => {
    if (raw !== "" && raw != null && Number.isFinite(Number(raw))) {
      return Number(raw);
    }
    return fallback;
  };

  const sttNum = isSeasonal
    ? undefined
    : parseSttNumber(form[ATTENDANCE_EMP.STT], existing[ATTENDANCE_EMP.STT]);
  const sttThoiVuNum = isSeasonal
    ? parseSttNumber(
        Object.prototype.hasOwnProperty.call(form, ATTENDANCE_EMP.SEASONAL_STT)
          ? form[ATTENDANCE_EMP.SEASONAL_STT]
          : form[ATTENDANCE_EMP.STT],
        existing[ATTENDANCE_EMP.SEASONAL_STT],
      )
    : undefined;

  const extras = stripUndefined({
    [ATTENDANCE_EMP.EMPLOYEE_NAME]: attendanceDayOptionalStringFromForm(
      form,
      ATTENDANCE_EMP.EMPLOYEE_NAME,
    ),
    [ATTENDANCE_EMP.DEPARTMENT]: attendanceDayOptionalStringFromForm(
      form,
      ATTENDANCE_EMP.DEPARTMENT,
    ),
    [ATTENDANCE_EMP.TIME_IN]: (() => {
      if (
        !Object.prototype.hasOwnProperty.call(form, ATTENDANCE_EMP.LEAVE_TYPE)
      ) {
        return attendanceDayOptionalStringFromForm(form, ATTENDANCE_EMP.TIME_IN);
      }
      const s = attendanceDayOptionalStringFromForm(
        form,
        ATTENDANCE_EMP.LEAVE_TYPE,
      );
      const canon = s ? canonicalAttendanceLoaiPhepValue(s) : undefined;
      if (canon && !isAttendanceLoaiPhepAllowsClockTimes(canon)) return "";
      return attendanceDayOptionalStringFromForm(form, ATTENDANCE_EMP.TIME_IN);
    })(),
    [ATTENDANCE_EMP.LEAVE_TYPE]: (() => {
      if (
        !Object.prototype.hasOwnProperty.call(form, ATTENDANCE_EMP.LEAVE_TYPE)
      ) {
        return undefined;
      }
      const s = attendanceDayOptionalStringFromForm(
        form,
        ATTENDANCE_EMP.LEAVE_TYPE,
      );
      if (!s) return "";
      const canon = canonicalAttendanceLoaiPhepValue(s);
      if (canon && !isAttendanceLoaiPhepAllowsClockTimes(canon)) {
        return canon;
      }
      const gv = attendanceDayOptionalStringFromForm(
        form,
        ATTENDANCE_EMP.TIME_IN,
      );
      if (gv && isAttendanceGioVaoClockTime(gv)) {
        return canon && isAttendanceLoaiPhepAllowsClockTimes(canon)
          ? canon
          : undefined;
      }
      return canon || "";
    })(),
    [ATTENDANCE_EMP.TIME_OUT]: (() => {
      const s = attendanceDayOptionalStringFromForm(
        form,
        ATTENDANCE_EMP.LEAVE_TYPE,
      );
      const canon = s ? canonicalAttendanceLoaiPhepValue(s) : undefined;
      if (canon && !isAttendanceLoaiPhepAllowsClockTimes(canon)) return "";
      return attendanceDayOptionalStringFromForm(form, ATTENDANCE_EMP.TIME_OUT);
    })(),
    [ATTENDANCE_EMP.SHIFT]: attendanceDayOptionalStringFromForm(
      form,
      ATTENDANCE_EMP.SHIFT,
    ),
    [ATTENDANCE_EMP.COMP_LEAVE_ALLOWED]: attendanceDayOptionalStringFromForm(
      form,
      ATTENDANCE_EMP.COMP_LEAVE_ALLOWED,
    ),
    [ATTENDANCE_EMP.DEPT_WRONG_FLAG]: (() => {
      if (
        !Object.prototype.hasOwnProperty.call(
          form,
          ATTENDANCE_EMP.DEPT_WRONG_FLAG,
        )
      ) {
        return undefined;
      }
      const v = String(form[ATTENDANCE_EMP.DEPT_WRONG_FLAG] ?? "")
        .trim()
        .toUpperCase();
      return v === "YES" ? "YES" : null;
    })(),
    [ATTENDANCE_EMP.NAME_YELLOW_BG]: (() => {
      if (
        !Object.prototype.hasOwnProperty.call(
          form,
          ATTENDANCE_EMP.NAME_YELLOW_BG,
        )
      ) {
        return undefined;
      }
      const v = String(form[ATTENDANCE_EMP.NAME_YELLOW_BG] ?? "")
        .trim()
        .toUpperCase();
      return v === "YES" ? "YES" : null;
    })(),
    [ATTENDANCE_EMP.LEAVE_TYPE_CHECK]: (() => {
      if (
        !Object.prototype.hasOwnProperty.call(
          form,
          ATTENDANCE_EMP.LEAVE_TYPE_CHECK,
        )
      ) {
        return undefined;
      }
      const v = String(form[ATTENDANCE_EMP.LEAVE_TYPE_CHECK] ?? "")
        .trim()
        .toUpperCase();
      return v === "YES" ? "YES" : null;
    })(),
    [ATTENDANCE_EMP.ANNUAL_LEAVE_IMAGE_URL]: attendanceDayOptionalStringFromForm(
      form,
      ATTENDANCE_EMP.ANNUAL_LEAVE_IMAGE_URL,
    ),
    [ATTENDANCE_EMP.OT_PAPERWORK_IMAGE_URL]: attendanceDayOptionalStringFromForm(
      form,
      ATTENDANCE_EMP.OT_PAPERWORK_IMAGE_URL,
    ),
    includeTapVuInWorkingHours: attendanceDayOptionalStringFromForm(
      form,
      "includeTapVuInWorkingHours",
    ),
    includeThaiSanInWorkingHours: attendanceDayOptionalStringFromForm(
      form,
      "includeThaiSanInWorkingHours",
    ),
    includeTaiXeInWorkingHours: attendanceDayOptionalStringFromForm(
      form,
      "includeTaiXeInWorkingHours",
    ),
    includeTaiXeTongInWorkingHours: attendanceDayOptionalStringFromForm(
      form,
      "includeTaiXeTongInWorkingHours",
    ),
    includeTsNvInWorkingHours: attendanceDayOptionalStringFromForm(
      form,
      "includeTsNvInWorkingHours",
    ),
    [ATTENDANCE_EMP.LUNCH_OT_HOURS]: (() => {
      if (
        !Object.prototype.hasOwnProperty.call(
          form,
          ATTENDANCE_EMP.LUNCH_OT_HOURS,
        )
      ) {
        return undefined;
      }
      const s = String(form[ATTENDANCE_EMP.LUNCH_OT_HOURS] ?? "").trim();
      if (!s) return null;
      const n = Number(s);
      if (!Number.isFinite(n) || !LUNCH_OT_HOUR_OPTIONS.includes(n)) return undefined;
      return n;
    })(),
    [ATTENDANCE_EMP.DRIVER_OT_MINUTES]: (() => {
      if (
        !Object.prototype.hasOwnProperty.call(
          form,
          ATTENDANCE_EMP.DRIVER_OT_MINUTES,
        )
      ) {
        return undefined;
      }
      const s = String(form[ATTENDANCE_EMP.DRIVER_OT_MINUTES] ?? "").trim();
      if (!s) return null;
      const n = Number(s);
      if (!Number.isFinite(n) || n < 0) return undefined;
      return Math.floor(n);
    })(),
    [ATTENDANCE_EMP.MVT]: attendanceDayNonWipingOptionalStringFromForm(
      form,
      ATTENDANCE_EMP.MVT,
    ),
    [ATTENDANCE_EMP.DEPT_CODE]: attendanceDayNonWipingOptionalStringFromForm(
      form,
      ATTENDANCE_EMP.DEPT_CODE,
    ),
    [ATTENDANCE_EMP.GENDER]: Object.prototype.hasOwnProperty.call(
      form,
      ATTENDANCE_EMP.GENDER,
    )
      ? form[ATTENDANCE_EMP.GENDER]
      : undefined,
    [ATTENDANCE_EMP.JOIN_DATE]: Object.prototype.hasOwnProperty.call(
      form,
      ATTENDANCE_EMP.JOIN_DATE,
    )
      ? (() => {
          const s = String(form[ATTENDANCE_EMP.JOIN_DATE] ?? "").trim();
          if (!s) return "";
          return normalizeDateForHtmlInput(s) || s;
        })()
      : undefined,
    [ATTENDANCE_EMP.CONTRACT_DATE]: Object.prototype.hasOwnProperty.call(
      form,
      ATTENDANCE_EMP.CONTRACT_DATE,
    )
      ? (() => {
          const s = String(form[ATTENDANCE_EMP.CONTRACT_DATE] ?? "").trim();
          if (!s) return "";
          return normalizeDateForHtmlInput(s) || s;
        })()
      : undefined,
  });

  const preserved = {};
  const attendancePreserveKeys = [
    ...ATTENDANCE_EXTRA_KEYS,
    ATTENDANCE_EMP.EMPLOYEE_NAME,
    ATTENDANCE_EMP.DEPARTMENT,
    ATTENDANCE_EMP.JOIN_DATE,
    ATTENDANCE_EMP.CONTRACT_DATE,
  ];
  attendancePreserveKeys.forEach((k) => {
    if (extras[k] !== undefined) return;
    if (existing[k] !== undefined && existing[k] !== "") {
      preserved[k] = existing[k];
    }
  });

  const merged = {
    [ATTENDANCE_EMP.MNV]: mnvStored,
    ...preserved,
    ...extras,
  };
  delete merged[ATTENDANCE_EMP.CHAM_CONG];
  if (!isSeasonal) {
    if (sttNum !== undefined && sttNum !== null && !Number.isNaN(sttNum)) {
      merged[ATTENDANCE_EMP.STT] = sttNum;
    }
  } else {
    if (
      sttThoiVuNum !== undefined &&
      sttThoiVuNum !== null &&
      !Number.isNaN(sttThoiVuNum)
    ) {
      merged[ATTENDANCE_EMP.SEASONAL_STT] = sttThoiVuNum;
    }
    delete merged[ATTENDANCE_EMP.STT];
  }

  STRIP_LEGACY_ENGLISH_KEYS.forEach((k) => {
    delete merged[k];
  });
  PROFILE_ONLY_STRIP_FROM_DAY.forEach((k) => {
    delete merged[k];
  });

  delete merged.firebaseKey;
  const out = stripUndefined({ ...merged });
  if (
    Object.prototype.hasOwnProperty.call(
      form,
      ATTENDANCE_EMP.DEPT_WRONG_FLAG,
    )
  ) {
    const v = String(form[ATTENDANCE_EMP.DEPT_WRONG_FLAG] ?? "")
      .trim()
      .toUpperCase();
    if (v !== "YES") {
      out[ATTENDANCE_EMP.DEPT_WRONG_FLAG] = null;
    }
  }
  if (
    Object.prototype.hasOwnProperty.call(form, ATTENDANCE_EMP.NAME_YELLOW_BG)
  ) {
    const v = String(form[ATTENDANCE_EMP.NAME_YELLOW_BG] ?? "")
      .trim()
      .toUpperCase();
    if (v !== "YES") {
      out[ATTENDANCE_EMP.NAME_YELLOW_BG] = null;
    }
  }
  if (
    Object.prototype.hasOwnProperty.call(form, ATTENDANCE_EMP.LEAVE_TYPE_CHECK)
  ) {
    const v = String(form[ATTENDANCE_EMP.LEAVE_TYPE_CHECK] ?? "")
      .trim()
      .toUpperCase();
    if (v !== "YES") {
      out[ATTENDANCE_EMP.LEAVE_TYPE_CHECK] = null;
    }
  }
  for (const urlKey of [
    ATTENDANCE_EMP.ANNUAL_LEAVE_IMAGE_URL,
    ATTENDANCE_EMP.OT_PAPERWORK_IMAGE_URL,
  ]) {
    if (!Object.prototype.hasOwnProperty.call(form, urlKey)) continue;
    const v = String(form[urlKey] ?? "").trim();
    if (!v) out[urlKey] = null;
  }
  return out;
}

/**
 * Khi ghi toàn bộ object vào `attendance/{ngày}/{key}` hoặc `seasonalAttendance/...`:
 * `{ ...dayDoc, id }` thay thế node → mất trường không nằm trong `dayDoc` (vd. `businessId`, `chamCong`, `phepNam`).
 * Merge `dayDoc` lên snapshot hiện có — giá trị trong `dayDoc` ghi đè, các trường khác giữ.
 *
 * @param {Record<string, unknown>} existing — từ `get()` trước khi lưu (hoặc {})
 * @param {Record<string, unknown>} dayDoc — payload đã build từ form
 * @param {string} recordId — `id` bản ghi (Firebase key con)
 */
export function mergeAttendanceDayNodeForPersist(existing, dayDoc, recordId) {
  const ex =
    existing && typeof existing === "object" ? { ...existing } : {};
  const d = dayDoc && typeof dayDoc === "object" ? { ...dayDoc } : {};
  delete ex.firebaseKey;
  delete d.firebaseKey;
  const merged = { ...ex, ...d, id: recordId };
  delete merged.ngayThangNamSinh;
  delete merged.birthDate;
  return normalizeAttendanceDayRecord(merged);
}
