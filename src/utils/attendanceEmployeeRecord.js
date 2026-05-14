/**
 * attendance/{date}/{firebaseKey}: dữ liệu điểm danh theo ngày (stt, mnv, giờ vào/ra, ca, PN…).
 * Màn điểm danh: sanitizeAttendanceDayNodeForUi — chỉ trường node ngày.
 * Danh mục BP (tuỳ chọn): employeeDepartments/{key}.
 */
import {
  canonicalAttendanceLoaiPhepValue,
  normalizeAttendanceDayRecord,
} from "@/features/attendance/attendanceGioVaoTypeOptions";

export const EMPLOYEE_DEPT_CATALOG_PATH = "employeeDepartments";

/**
 * MNV trên node điểm danh (`businessId` / `mnv` đã lưu): trim + bỏ khoảng trắng nội bộ.
 * Trả chuỗi rỗng nếu không có mã — dùng validate trước khi lưu form điểm danh.
 */
export function attendanceMnvStorageKey(mnvRaw) {
  return normalizeMnvSuffix(mnvRaw);
}

export function normalizeEmployeeCode(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

/** MNV / mã hiển thị: trim và bỏ khoảng trắng nội bộ (không ép PAVO / in hoa). */
export function normalizeMnvSuffix(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "");
}

/**
 * Excel: ưu tiên cột id, sau đó cột mnv — không gộp tiền tố.
 */
export function resolveExcelBusinessId(idCell, mnvCell) {
  const idRaw = String(idCell ?? "").trim();
  const mnvRaw = String(mnvCell ?? "").trim();
  return idRaw || mnvRaw || "";
}

/** RTDB push ids look like -Ox0abcd123... */
export function isLikelyFirebasePushKey(v) {
  const s = String(v ?? "");
  return /^-[A-Za-z0-9_-]{10,}$/.test(s);
}

/**
 * So khớp MNV giữa các nguồn: trim + bỏ khoảng trắng nội bộ (không tiền tố PAVO).
 */
export function canonicalAttendanceMnvForMatch(raw) {
  return normalizeMnvSuffix(raw);
}

/** MNV nếu có; không thì `id` bản ghi (bỏ qua push key Firebase). */
export function businessEmployeeCode(emp) {
  const m = normalizeMnvSuffix(String(emp?.mnv ?? ""));
  if (m) return m;
  const id = String(emp?.id ?? "").trim();
  if (id && !isLikelyFirebasePushKey(id)) return id;
  return "";
}

export function slugifyDepartmentKey(name) {
  const s = String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  return s || "dept";
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

function pad2(n) {
  return String(n).padStart(2, "0");
}

function ymdFromLocalDate(d) {
  if (!d || Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Chuẩn hoá ngày từ Firebase / Excel / legacy → YYYY-MM-DD cho <input type="date">.
 * Hỗ trợ: ISO YYYY-MM-DD, DD/MM/YYYY, M/D/YY & M/D/YYYY (Excel US), số serial Excel, timestamp ms.
 */
export function normalizeDateForHtmlInput(value) {
  if (value == null || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 1e11) {
      return ymdFromLocalDate(new Date(value));
    }
    if (value > 1 && value < 1000000) {
      const d = new Date((value - 25569) * 86400 * 1000);
      if (!Number.isNaN(d.getTime())) {
        return ymdFromLocalDate(d);
      }
    }
    return "";
  }
  const str = String(value).trim();
  if (!str) return "";
  const iso = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${pad2(Number(iso[2]))}-${pad2(Number(iso[3]))}`;
  }

  const tryYmdParts = (month, day, year) => {
    if (month < 1 || month > 12 || day < 1 || day > 31) return "";
    const d = new Date(year, month - 1, day);
    if (
      d.getFullYear() !== year ||
      d.getMonth() !== month - 1 ||
      d.getDate() !== day
    ) {
      return "";
    }
    return ymdFromLocalDate(d);
  };

  /**
   * M/D/YY, M/D/YYYY (Excel US), D/M/Y (VN): nếu một phần > 12 thì suy ra thứ tự.
   */
  const slash = str.match(
    /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})$/,
  );
  if (slash) {
    const p1 = Number(slash[1]);
    const p2 = Number(slash[2]);
    const yStr = slash[3];
    let year = Number(yStr);
    if (yStr.length === 2) {
      year = year <= 50 ? 2000 + year : 1900 + year;
    }
    if (p1 > 12) {
      const out = tryYmdParts(p2, p1, year);
      if (out) return out;
    }
    if (p2 > 12) {
      const out = tryYmdParts(p1, p2, year);
      if (out) return out;
    }
    const dmyAmb = tryYmdParts(p2, p1, year);
    if (dmyAmb) return dmyAmb;
    const mdyAmb = tryYmdParts(p1, p2, year);
    if (mdyAmb) return mdyAmb;
  }

  const asNum = Number(str);
  if (
    Number.isFinite(asNum) &&
    asNum > 1 &&
    asNum < 1000000 &&
    /^\d+(\.\d+)?$/.test(str)
  ) {
    return normalizeDateForHtmlInput(asNum);
  }
  return "";
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
  "gioVao",
  "loaiPhep",
  "gioRa",
  "caLamViec",
  "includeTapVuInWorkingHours",
  "includeThaiSanInWorkingHours",
  "includeTsNvInWorkingHours", // legacy: "tạp vụ + thai sản" chung
  "mvt",
  "maBoPhan",
  "gioiTinh",
];

/** Trường form dùng khi build `attendance/{date}` — chỉ node điểm danh. */
export const ATTENDANCE_DAY_FORM_KEYS = Object.freeze([
  "mnv",
  "stt",
  "hoVaTen",
  "boPhan",
  "ngayVaoLam",
  "ngayHopDong",
  "gioVao",
  "loaiPhep",
  "gioRa",
  "caLamViec",
  "duocNghiBu",
  "includeTapVuInWorkingHours",
  "includeThaiSanInWorkingHours",
  "includeTsNvInWorkingHours", // legacy: "tạp vụ + thai sản" chung
  "mvt",
  "maBoPhan",
  "gioiTinh",
]);

/** Trường được phép trên bản ghi khi đọc UI điểm danh (chính thức / thời vụ) — không trường hồ sơ. */
export const ATTENDANCE_DAY_UI_ROW_KEYS = Object.freeze([
  "stt",
  "mnv",
  "businessId",
  "mvt",
  "hoVaTen",
  "gioiTinh",
  "ngayVaoLam",
  "ngayHopDong",
  "maBoPhan",
  "boPhan",
  "gioVao",
  "loaiPhep",
  "gioRa",
  "caLamViec",
  "duocNghiBu",
  "includeTapVuInWorkingHours",
  "includeThaiSanInWorkingHours",
  "includeTsNvInWorkingHours", // legacy: "tạp vụ + thai sản" chung
  "chamCong",
  "phepNam",
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
export function normalizeAttendanceDayRowDisplay(emp) {
  if (!emp || typeof emp !== "object") return emp;
  const mnvDisplay =
    normalizeMnvSuffix(emp.mnv) || String(emp.mnv ?? "").trim();
  const out = {
    ...emp,
    mnv: mnvDisplay || String(emp.mnv ?? "").trim(),
    hoVaTen: String(emp.hoVaTen ?? "").trim(),
    ngayVaoLam: (() => {
      const jr = emp.ngayVaoLam;
      if (jr === undefined || jr === null || String(jr).trim() === "")
        return "";
      const jn = normalizeDateForHtmlInput(jr);
      return jn || String(jr).trim();
    })(),
    boPhan: String(emp.boPhan ?? "").trim(),
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
    const bid = overrides.businessId ?? form.businessId ?? form.mnv;
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
    return key === "gioVao" || key === "gioRa" ? "" : undefined;
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
export function buildEmployeeAttendanceDayDocument({ form, existing = {} }) {
  const businessId = normalizeEmployeeCode(form.businessId ?? form.mnv ?? "");
  const mnvStored =
    normalizeMnvSuffix(businessId) || businessId || undefined;
  const sttNum =
    form.stt !== "" && form.stt != null && Number.isFinite(Number(form.stt))
      ? Number(form.stt)
      : existing.stt;

  const extras = stripUndefined({
    hoVaTen: attendanceDayOptionalStringFromForm(form, "hoVaTen"),
    boPhan: attendanceDayOptionalStringFromForm(form, "boPhan"),
    gioVao: attendanceDayOptionalStringFromForm(form, "gioVao"),
    loaiPhep: (() => {
      const s = attendanceDayOptionalStringFromForm(form, "loaiPhep");
      return s ? canonicalAttendanceLoaiPhepValue(s) : undefined;
    })(),
    gioRa: attendanceDayOptionalStringFromForm(form, "gioRa"),
    caLamViec: attendanceDayOptionalStringFromForm(form, "caLamViec"),
    duocNghiBu: attendanceDayOptionalStringFromForm(form, "duocNghiBu"),
    includeTapVuInWorkingHours: attendanceDayOptionalStringFromForm(
      form,
      "includeTapVuInWorkingHours",
    ),
    includeThaiSanInWorkingHours: attendanceDayOptionalStringFromForm(
      form,
      "includeThaiSanInWorkingHours",
    ),
    includeTsNvInWorkingHours: attendanceDayOptionalStringFromForm(
      form,
      "includeTsNvInWorkingHours",
    ),
    mvt: attendanceDayNonWipingOptionalStringFromForm(form, "mvt"),
    maBoPhan: attendanceDayNonWipingOptionalStringFromForm(form, "maBoPhan"),
    gioiTinh: Object.prototype.hasOwnProperty.call(form, "gioiTinh")
      ? form.gioiTinh
      : undefined,
    ngayVaoLam: Object.prototype.hasOwnProperty.call(form, "ngayVaoLam")
      ? (() => {
          const s = String(form.ngayVaoLam ?? "").trim();
          if (!s) return "";
          return normalizeDateForHtmlInput(s) || s;
        })()
      : undefined,
    ngayHopDong: Object.prototype.hasOwnProperty.call(form, "ngayHopDong")
      ? (() => {
          const s = String(form.ngayHopDong ?? "").trim();
          if (!s) return "";
          return normalizeDateForHtmlInput(s) || s;
        })()
      : undefined,
  });

  const preserved = {};
  const attendancePreserveKeys = [
    ...ATTENDANCE_EXTRA_KEYS,
    "hoVaTen",
    "boPhan",
    "ngayVaoLam",
    "ngayHopDong",
  ];
  attendancePreserveKeys.forEach((k) => {
    if (extras[k] !== undefined) return;
    if (existing[k] !== undefined && existing[k] !== "") {
      preserved[k] = existing[k];
    }
  });

  const merged = {
    mnv: mnvStored,
    ...preserved,
    ...extras,
  };
  delete merged.chamCong;
  if (sttNum !== undefined && sttNum !== null && !Number.isNaN(sttNum)) {
    merged.stt = sttNum;
  }

  STRIP_LEGACY_ENGLISH_KEYS.forEach((k) => {
    delete merged[k];
  });
  PROFILE_ONLY_STRIP_FROM_DAY.forEach((k) => {
    delete merged[k];
  });

  delete merged.firebaseKey;
  return stripUndefined({ ...merged });
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
