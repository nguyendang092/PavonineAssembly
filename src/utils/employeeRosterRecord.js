/**
 * Hai tầng để scale:
 * - employeeProfiles/{mnvChuan}: hồ sơ ổn định (tên, BP, chức vụ, SĐT, trạng thái, …).
 * - attendance/{date}/{firebaseKey}: chỉ dữ liệu theo ngày (stt, mnv, giờ vào/ra, ca, PN…).
 * mergeEmployeeProfileAndDay() gộp khi đọc có profile (chỉ trường trong PROFILE_FIELDS_FOR_ATTENDANCE_MERGE).
 * Màn điểm danh chính thức / thời vụ: dùng sanitizeAttendanceDayNodeForUi — chỉ trường node điểm danh, không alias profile.
 * `gioVao`, `loaiPhep`, `caLamViec`, `trangThaiLamViec` giữ độc lập — không tự gộp / đổi trường khi đọc hay lưu node ngày.
 * Danh mục BP: employeeDepartments/{key}.
 */

export const EMPLOYEE_DEPT_CATALOG_PATH = "employeeDepartments";

/** Hồ sơ nhân viên (key = mnv chuẩn hóa, thường PAVO…). */
export const EMPLOYEE_PROFILES_PATH = "employeeProfiles";

/** Khóa lưu profile: PAVO+MNV nếu MNV chỉ là số; giữ nguyên nếu đã có tiền tố PAVO. */
export function employeeProfileStorageKeyFromMnv(mnvRaw) {
  const s = String(mnvRaw ?? "").trim();
  if (!s) return "";
  const up = s.toUpperCase();
  if (up.startsWith(PAVO_ID_PREFIX)) return normalizeEmployeeCode(up);
  if (/^\d+$/.test(s)) return buildPavoEmployeeId(s);
  return normalizeEmployeeCode(up);
}

export const CANONICAL_EMPLOYEE_STATUS = {
  ACTIVE: "active",
  PROBATION: "probation",
  LEAVE: "leave",
  INACTIVE: "inactive",
};

export const CANONICAL_EMPLOYEE_TYPE = {
  OFFICIAL: "official",
  SEASONAL: "seasonal",
  CONTRACT: "contract",
};

export function normalizeEmployeeCode(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d+$/.test(raw)) {
    const asNumber = Number(raw);
    return Number.isFinite(asNumber) ? String(asNumber) : raw;
  }
  return raw.toUpperCase();
}

export const PAVO_ID_PREFIX = "PAVO";

/** Phần MNV sau tiền tố PAVO (trim, bỏ khoảng trắng, in hoa). */
export function normalizeMnvSuffix(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

/** id lưu Firebase = PAVO + MNV (VD: PAVO001, PAVO12A). */
export function buildPavoEmployeeId(mnvSuffix) {
  const part = normalizeMnvSuffix(mnvSuffix);
  if (!part) return "";
  return `${PAVO_ID_PREFIX}${part}`;
}

/** Lấy phần MNV để hiển thị trong form (bỏ tiền tố PAVO nếu có). */
export function extractMnvSuffixFromStoredId(idOrMnv) {
  const s = String(idOrMnv ?? "").trim().toUpperCase();
  if (s.startsWith(PAVO_ID_PREFIX)) {
    return normalizeMnvSuffix(s.slice(PAVO_ID_PREFIX.length));
  }
  return normalizeMnvSuffix(idOrMnv);
}

/**
 * Excel: cột id đầy đủ PAVO… hoặc chỉ MNV; hoặc cột mnv riêng.
 */
export function resolveExcelBusinessId(idCell, mnvCell) {
  const idRaw = String(idCell ?? "").trim();
  const mnvRaw = String(mnvCell ?? "").trim();
  const up = idRaw.toUpperCase();
  if (up.startsWith(PAVO_ID_PREFIX)) {
    return normalizeEmployeeCode(idRaw);
  }
  if (idRaw) {
    return buildPavoEmployeeId(idRaw);
  }
  if (mnvRaw) {
    return buildPavoEmployeeId(mnvRaw);
  }
  return "";
}

/** RTDB push ids look like -Ox0abcd123... */
export function isLikelyFirebasePushKey(v) {
  const s = String(v ?? "");
  return /^-[A-Za-z0-9_-]{10,}$/.test(s);
}

/**
 * Mã chuẩn để so khớp mnv giữa attendance / profile (PAVO001, hoặc chỉ số "001" → PAVO001).
 */
export function canonicalAttendanceMnvForMatch(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const up = s.toUpperCase();
  if (up.startsWith(PAVO_ID_PREFIX)) return normalizeEmployeeCode(up);
  if (/^\d+$/.test(s)) return buildPavoEmployeeId(s);
  return normalizeEmployeeCode(s);
}

export function businessEmployeeCode(emp) {
  const m = String(emp?.mnv ?? "").trim();
  if (m) return canonicalAttendanceMnvForMatch(m);
  const id = String(emp?.id ?? "").trim();
  if (id && !isLikelyFirebasePushKey(id)) return canonicalAttendanceMnvForMatch(id);
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

export function legacyStatusFromCanonical(status) {
  const s = String(status || "").trim();
  if (s === CANONICAL_EMPLOYEE_STATUS.PROBATION) return "thu_viec";
  if (s === CANONICAL_EMPLOYEE_STATUS.LEAVE) return "tam_nghi";
  if (s === CANONICAL_EMPLOYEE_STATUS.INACTIVE) return "nghi_viec";
  return "dang_lam";
}

/** Hồ sơ roster: đã nghỉ việc (Firebase `nghi_viec` hoặc legacy `inactive`). */
export function isEmployeeResigned(emp) {
  const v =
    emp?.trangThaiLamViec ?? legacyStatusFromCanonical(emp?.status);
  const key = String(v ?? "").trim().toLowerCase();
  return key === "nghi_viec" || key === "inactive";
}

export function canonicalStatusFromLegacy(trangThaiLamViec) {
  const v = String(trangThaiLamViec || "").trim();
  if (v === "thu_viec") return CANONICAL_EMPLOYEE_STATUS.PROBATION;
  if (v === "tam_nghi" || v === "thai_san")
    return CANONICAL_EMPLOYEE_STATUS.LEAVE;
  if (v === "nghi_viec") return CANONICAL_EMPLOYEE_STATUS.INACTIVE;
  return CANONICAL_EMPLOYEE_STATUS.ACTIVE;
}

/**
 * Tên BP hiển thị: có thể tra `employeeDepartments` theo `department` (legacy) hoặc `departmentKey`.
 * Nếu tên trong catalog khác `boPhan` đang lưu (vd. key assy_1 → "assy-1" nhưng ô bộ phận là "assy"),
 * ưu tiên `boPhan` để không đổi bộ phận khi chỉ cập nhật loại phép / giờ vào.
 */
export function resolveDepartmentLabel(emp, catalog) {
  const boPhanRaw = String(emp?.boPhan ?? "").trim();
  const key = String(emp?.department ?? emp?.departmentKey ?? "").trim();
  if (!key || !catalog?.[key]?.name) return boPhanRaw;

  const catalogName = String(catalog[key].name).trim();
  if (
    boPhanRaw &&
    catalogName.toLowerCase() !== boPhanRaw.toLowerCase()
  ) {
    return boPhanRaw;
  }
  return catalogName;
}

/**
 * Suy ra khóa BP trong `employeeDepartments`: ưu tiên khớp **tên** với `boPhan` (nguồn đúng hiển thị),
 * rồi mới legacy `department` / `departmentKey` — tránh key cũ lệch tên (assy_1 vs "assy").
 */
export function inferDepartmentKey(emp, catalog) {
  const bp = String(emp?.boPhan ?? "").trim();
  const entries = Object.entries(catalog || {});
  if (bp && entries.length) {
    const found = entries.find(
      ([, v]) =>
        String(v?.name ?? "")
          .trim()
          .toLowerCase() === bp.toLowerCase(),
    );
    if (found) return found[0];
  }
  const kLegacy = String(emp?.department ?? "").trim();
  if (kLegacy && catalog && catalog[kLegacy]) return kLegacy;
  const kMod = String(emp?.departmentKey ?? "").trim();
  if (kMod && catalog && catalog[kMod]) return kMod;
  if (!bp) return "";
  return slugifyDepartmentKey(bp);
}

/**
 * Khóa lưu `employeeProfiles.departmentKey` khi lưu từ form điểm danh — đồng bộ với `boPhan` + danh mục,
 * không giữ key cũ khi tên BP đã khác (vd. chọn loại phép không được phép làm lệch BP).
 */
export function resolveDepartmentKeyForProfileSave(
  boPhanDisplay,
  existingDepartmentKey,
  catalog,
) {
  const bp = String(boPhanDisplay ?? "").trim();
  const existing = String(existingDepartmentKey ?? "").trim();
  if (!bp) return existing;

  const cat = catalog && typeof catalog === "object" ? catalog : null;
  if (cat && Object.keys(cat).length > 0) {
    const matchByName = Object.entries(cat).find(
      ([, v]) =>
        String(v?.name ?? "")
          .trim()
          .toLowerCase() === bp.toLowerCase(),
    );
    if (matchByName) return matchByName[0];
    if (existing && cat[existing]?.name) {
      const n = String(cat[existing].name).trim();
      if (n.toLowerCase() === bp.toLowerCase()) return existing;
    }
  }

  return slugifyDepartmentKey(bp);
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

/** Merge canonical + legacy for table, filters, permissions (boPhan = display name). */
export function enrichEmployeeRow(emp, catalog) {
  if (!emp || typeof emp !== "object") return emp;
  const code = businessEmployeeCode(emp);
  const mnvDisplay =
    extractMnvSuffixFromStoredId(code) || normalizeMnvSuffix(emp.mnv) || "";
  const joinRaw = emp.ngayVaoLam ?? emp.joinDate;
  const joinNorm = normalizeDateForHtmlInput(joinRaw);
  const out = {
    ...emp,
    mnv: mnvDisplay || String(emp.mnv ?? "").trim() || code,
    hoVaTen: String(emp.name ?? emp.hoVaTen ?? "").trim(),
    chucVu: String(emp.position ?? emp.chucVu ?? "").trim(),
    ngayVaoLam: joinNorm || String(joinRaw ?? "").trim(),
    boPhan: resolveDepartmentLabel(emp, catalog) || String(emp.boPhan ?? "").trim(),
  };
  delete out.ngayThangNamSinh;
  delete out.birthDate;
  return out;
}

/** Trạng thái làm việc lưu Firebase (đồng bộ AttendanceList). */
export const ROSTER_TRANG_THAI_VALUES = Object.freeze([
  "dang_lam",
  "thu_viec",
  "tam_nghi",
  "thai_san",
  "nghi_viec",
]);

/** Giữ nguyên giá trị đã trim — không ép mặc định (tránh ghi sai trạng thái). */
export function normalizeTrangThaiLamViec(value) {
  const t = String(value ?? "").trim();
  if (ROSTER_TRANG_THAI_VALUES.includes(t)) return t;
  return t;
}

/** Hình thức thôi việc (chỉ khi nghỉ việc). */
export const HINH_THUC_NGHI_VIEC = Object.freeze({
  CO_DON: "co_don",
  NGHI_NGANG: "nghi_ngang",
});

export function normalizeHinhThucNghiViec(value) {
  const t = String(value ?? "").trim().toLowerCase();
  if (t === HINH_THUC_NGHI_VIEC.CO_DON || t === "codon") return "co_don";
  if (t === HINH_THUC_NGHI_VIEC.NGHI_NGANG || t === "nghingang")
    return "nghi_ngang";
  return "";
}

/** Ô Excel → co_don | nghi_ngang | "". */
export function hinhThucNghiViecFromExcelCell(raw) {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (!s) return "";
  if (
    s === "co_don" ||
    s === "codon" ||
    s.includes("co don") ||
    s === "with_letter" ||
    s === "formal"
  )
    return "co_don";
  if (
    s === "nghi_ngang" ||
    s === "nghingang" ||
    s.includes("nghi ngang") ||
    s === "abrupt" ||
    s === "no_notice" ||
    s === "quit"
  )
    return "nghi_ngang";
  return normalizeHinhThucNghiViec(raw);
}

/** Ô Excel / form tự do → mã trạng thái lưu Firebase. */
export function trangThaiLamViecFromExcelCell(raw) {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (!s) return "dang_lam";
  if (
    s === "dang_lam" ||
    s === "active" ||
    s === "working" ||
    s === "work" ||
    s === "employed" ||
    s === "current" ||
    s === "yes" ||
    s === "true" ||
    s === "1" ||
    s.includes("dang lam") ||
    s.includes("dang lam viec")
  )
    return "dang_lam";
  if (s === "thu_viec" || s === "probation" || s.includes("thu viec"))
    return "thu_viec";
  if (
    s === "tam_nghi" ||
    s === "leave" ||
    s === "on_leave" ||
    s === "suspension" ||
    s.includes("tam nghi")
  )
    return "tam_nghi";
  if (
    s === "thai_san" ||
    s === "thaisan" ||
    s.includes("thai san") ||
    s === "maternity" ||
    s === "pregnancy" ||
    s.includes("maternity")
  )
    return "thai_san";
  if (
    s === "nghi_viec" ||
    s === "inactive" ||
    s === "stop" ||
    s === "stopped" ||
    s === "quit" ||
    s === "resign" ||
    s === "resigned" ||
    s === "resignation" ||
    s === "terminated" ||
    s === "termination" ||
    s === "retired" ||
    s === "retirement" ||
    s === "layoff" ||
    s === "laid_off" ||
    s === "no" ||
    s === "false" ||
    s === "0" ||
    s.includes("nghi viec")
  )
    return "nghi_viec";
  return normalizeTrangThaiLamViec(raw);
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
  "mvt",
  "maBoPhan",
  "gioiTinh",
];

/**
 * Chỉ các trường được phép lấy từ `employeeProfiles` khi gộp với `attendance/{ngày}` cho UI.
 * Không spread cả object profile — tránh lẫn metadata / trường nội bộ không thuộc điểm danh.
 */
const PROFILE_FIELDS_FOR_ATTENDANCE_MERGE = Object.freeze([
  "hoVaTen",
  "name",
  "boPhan",
  "chucVu",
  "position",
  "ngayVaoLam",
  "joinDate",
  "sdt",
  "trangThaiLamViec",
  "status",
  "chuyenCan",
  "phanQuyen",
  "emailDangNhap",
  "departmentKey",
  "department",
  "type",
  "stt",
  "mnv",
  "ngayNghiViec",
  "hinhThucNghiViec",
  "thaiSanTuNgay",
  "thaiSanDenNgay",
]);

export function pickProfileFieldsForAttendanceMerge(profileRow) {
  if (!profileRow || typeof profileRow !== "object") return {};
  const out = {};
  for (const k of PROFILE_FIELDS_FOR_ATTENDANCE_MERGE) {
    if (Object.prototype.hasOwnProperty.call(profileRow, k)) {
      out[k] = profileRow[k];
    }
  }
  return out;
}

/** Trường form dùng khi build `attendance/{date}` — chỉ node điểm danh (không employeeProfiles). */
export const ATTENDANCE_DAY_FORM_KEYS = Object.freeze([
  "mnv",
  "stt",
  "hoVaTen",
  "boPhan",
  "ngayVaoLam",
  "trangThaiLamViec",
  "gioVao",
  "loaiPhep",
  "gioRa",
  "caLamViec",
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
  "trangThaiLamViec",
  "maBoPhan",
  "boPhan",
  "gioVao",
  "loaiPhep",
  "gioRa",
  "caLamViec",
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
  const code = businessEmployeeCode(emp);
  const mnvDisplay =
    extractMnvSuffixFromStoredId(code) || normalizeMnvSuffix(emp.mnv) || "";
  const out = {
    ...emp,
    mnv: mnvDisplay || String(emp.mnv ?? "").trim() || code,
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
 * Đọc `attendance/{ngày}` hoặc `seasonalAttendance/{ngày}` cho bảng: lọc trường + migrate loại phép legacy + chuẩn MNV/tên.
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

/** Trường không lưu vào attendance/{ngày} (chỉ hồ sơ / legacy). Họ tên, BP nằm trên node ngày. */
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
  "ngayNghiViec",
  "hinhThucNghiViec",
  /** Legacy: từng ghi trên profile — không lưu vào attendance/{ngày}. */
  "thaiSanTuNgay",
  "thaiSanDenNgay",
];

/**
 * employeeProfiles/{mnv}: trường ít đổi theo ngày.
 */
export function buildEmployeeProfileDocument({
  form,
  existingProfile = {},
  departmentDisplayName,
  departmentKey,
}) {
  const businessId = normalizeEmployeeCode(form.businessId ?? form.mnv ?? "");
  const hoVaTen = String(form.hoVaTen ?? form.name ?? "").trim();
  const deptKey = String(departmentKey ?? form.departmentKey ?? "").trim();
  const deptName = String(departmentDisplayName ?? "").trim() || deptKey;

  const joinRaw = String(form.ngayVaoLam ?? form.joinDate ?? "").trim();
  const joinStored = joinRaw
    ? normalizeDateForHtmlInput(joinRaw) || joinRaw
    : undefined;

  const mnvStored =
    extractMnvSuffixFromStoredId(businessId) || businessId || undefined;

  const hasExplicitTrangThai = Object.prototype.hasOwnProperty.call(
    form,
    "trangThaiLamViec",
  );
  const resolvedTrangThai = normalizeTrangThaiLamViec(
    hasExplicitTrangThai
      ? form.trangThaiLamViec ?? legacyStatusFromCanonical(form.status)
      : existingProfile.trangThaiLamViec ??
          legacyStatusFromCanonical(form.status),
  );

  const core = stripUndefined({
    mnv: mnvStored,
    hoVaTen: hoVaTen || undefined,
    boPhan: deptName || undefined,
    departmentKey: deptKey || undefined,
    department: deptKey || undefined,
    chucVu: String(form.chucVu ?? form.position ?? "").trim() || undefined,
    ngayVaoLam: joinStored,
    sdt: String(form.sdt ?? "").trim() || undefined,
    trangThaiLamViec: resolvedTrangThai,
    chuyenCan: String(form.chuyenCan ?? "").trim() || undefined,
    phanQuyen: String(form.phanQuyen ?? "").trim() || undefined,
    emailDangNhap: String(form.emailDangNhap ?? "").trim() || undefined,
  });

  const merged = { ...existingProfile, ...core, updatedAt: Date.now() };

  if (resolvedTrangThai === "thai_san") {
    const hasTu = Object.prototype.hasOwnProperty.call(form, "thaiSanTuNgay");
    const hasDen = Object.prototype.hasOwnProperty.call(
      form,
      "thaiSanDenNgay",
    );
    if (hasTu) {
      const tu = String(form.thaiSanTuNgay ?? "").trim();
      if (tu) merged.thaiSanTuNgay = normalizeDateForHtmlInput(tu) || tu;
      else delete merged.thaiSanTuNgay;
    }
    if (hasDen) {
      const den = String(form.thaiSanDenNgay ?? "").trim();
      if (den)
        merged.thaiSanDenNgay = normalizeDateForHtmlInput(den) || den;
      else delete merged.thaiSanDenNgay;
    }
  } else {
    delete merged.thaiSanTuNgay;
    delete merged.thaiSanDenNgay;
  }

  if (Object.prototype.hasOwnProperty.call(form, "ngayNghiViec")) {
    const resignRaw = String(form.ngayNghiViec ?? "").trim();
    if (resignRaw) {
      merged.ngayNghiViec =
        normalizeDateForHtmlInput(resignRaw) || resignRaw;
    } else {
      delete merged.ngayNghiViec;
    }
  }
  if (Object.prototype.hasOwnProperty.call(form, "hinhThucNghiViec")) {
    const hinhRaw = normalizeHinhThucNghiViec(form.hinhThucNghiViec);
    if (hinhRaw) merged.hinhThucNghiViec = hinhRaw;
    else delete merged.hinhThucNghiViec;
  }

  const sttNum =
    form.stt !== "" && form.stt != null && Number.isFinite(Number(form.stt))
      ? Number(form.stt)
      : existingProfile.stt;
  if (sttNum !== undefined && sttNum !== null && !Number.isNaN(sttNum)) {
    merged.stt = sttNum;
  } else {
    delete merged.stt;
  }
  STRIP_LEGACY_ENGLISH_KEYS.forEach((k) => {
    delete merged[k];
  });
  ATTENDANCE_EXTRA_KEYS.forEach((k) => {
    delete merged[k];
  });
  delete merged.chamCong;
  delete merged.firebaseKey;
  delete merged.ngayThangNamSinh;
  delete merged.birthDate;
  return stripUndefined(merged);
}

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
 * attendance/{date}/{key}: stt + mnv + trường chấm công theo ngày.
 */
export function buildEmployeeAttendanceDayDocument({ form, existing = {} }) {
  const businessId = normalizeEmployeeCode(form.businessId ?? form.mnv ?? "");
  const mnvStored =
    extractMnvSuffixFromStoredId(businessId) || businessId || undefined;
  const sttNum =
    form.stt !== "" && form.stt != null && Number.isFinite(Number(form.stt))
      ? Number(form.stt)
      : existing.stt;

  const extras = stripUndefined({
    hoVaTen: attendanceDayOptionalStringFromForm(form, "hoVaTen"),
    boPhan: attendanceDayOptionalStringFromForm(form, "boPhan"),
    gioVao: attendanceDayOptionalStringFromForm(form, "gioVao"),
    loaiPhep: attendanceDayOptionalStringFromForm(form, "loaiPhep"),
    gioRa: attendanceDayOptionalStringFromForm(form, "gioRa"),
    caLamViec: attendanceDayOptionalStringFromForm(form, "caLamViec"),
    mvt: attendanceDayOptionalStringFromForm(form, "mvt"),
    maBoPhan: attendanceDayOptionalStringFromForm(form, "maBoPhan"),
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
    trangThaiLamViec: Object.prototype.hasOwnProperty.call(
      form,
      "trangThaiLamViec",
    )
      ? String(form.trangThaiLamViec ?? "").trim()
      : undefined,
  });

  const preserved = {};
  const attendancePreserveKeys = [
    ...ATTENDANCE_EXTRA_KEYS,
    "hoVaTen",
    "boPhan",
    "ngayVaoLam",
    "trangThaiLamViec",
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
  return merged;
}

/**
 * Gộp profile + node ngày cho UI / quyền.
 * Chỉ lấy từ profile các key trong `PROFILE_FIELDS_FOR_ATTENDANCE_MERGE`; node ngày (`dayRow`) vẫn ghi đè trùng tên.
 * Legacy: node ngày “dồn” đủ hồ sơ thì ưu tiên overlay từ ngày.
 */
export function mergeEmployeeProfileAndDay(dayRow, profileRow, catalog) {
  if (!dayRow || typeof dayRow !== "object") return dayRow;
  const firebaseKey = dayRow.firebaseKey;
  const rowId = dayRow.id;
  const bundled =
    String(dayRow.hoVaTen ?? dayRow.name ?? "").trim() !== "" ||
    String(dayRow.boPhan ?? "").trim() !== "";

  /** `loaiPhep` chỉ thuộc node ngày `attendance/{date}` — không kế thừa từ employeeProfiles (tránh ghi đè / trộn PN, BGC, …). */
  const profileWithoutLoaiPhep =
    profileRow && typeof profileRow === "object"
      ? (() => {
          const { loaiPhep: _profileLoaiPhepOmit, ...rest } = profileRow;
          return rest;
        })()
      : {};

  /**
   * `boPhan` là tên BP trên hồ sơ; node ngày có thể có bản sao cũ / Excel lệch — không để ngày ghi đè
   * tên BP khi hồ sơ đã có `boPhan` rõ ràng.
   */
  const profileBp = String(profileWithoutLoaiPhep.boPhan ?? "").trim();
  const dayRowForMerge =
    profileRow &&
    profileBp &&
    dayRow &&
    typeof dayRow === "object"
      ? (() => {
          const { boPhan: _dayBoPhanOmit, ...rest } = dayRow;
          return rest;
        })()
      : dayRow;

  const profileSlice = pickProfileFieldsForAttendanceMerge(profileWithoutLoaiPhep);

  let merged;
  if (bundled) {
    merged = profileRow
      ? { ...profileSlice, ...dayRowForMerge }
      : { ...dayRow };
  } else {
    merged = { ...profileSlice, ...dayRowForMerge };
  }
  if (firebaseKey) merged.firebaseKey = firebaseKey;
  if (rowId !== undefined && rowId !== null && merged.id === undefined) {
    merged.id = rowId;
  }
  return enrichEmployeeRow(merged, catalog);
}

