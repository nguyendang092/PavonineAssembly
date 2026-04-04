/**
 * Hai tầng để scale:
 * - employeeProfiles/{mnvChuan}: hồ sơ ổn định (tên, BP, chức vụ, SĐT, trạng thái, …).
 * - attendance/{date}/{firebaseKey}: chỉ dữ liệu theo ngày (stt, mnv, giờ vào/ra, ca, PN…).
 * mergeEmployeeProfileAndDay() gộp khi đọc; bản ghi cũ “dồn một node” vẫn hiển thị được.
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

export function businessEmployeeCode(emp) {
  const m = normalizeEmployeeCode(emp?.mnv);
  if (m) return m;
  const id = String(emp?.id ?? "").trim();
  if (id && !isLikelyFirebasePushKey(id)) return normalizeEmployeeCode(id);
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
  if (v === "tam_nghi") return CANONICAL_EMPLOYEE_STATUS.LEAVE;
  if (v === "nghi_viec") return CANONICAL_EMPLOYEE_STATUS.INACTIVE;
  return CANONICAL_EMPLOYEE_STATUS.ACTIVE;
}

export function resolveDepartmentLabel(emp, catalog) {
  const key = String(emp?.department ?? "").trim();
  if (key && catalog && catalog[key]?.name) return String(catalog[key].name).trim();
  return String(emp?.boPhan ?? "").trim();
}

export function inferDepartmentKey(emp, catalog) {
  const k = String(emp?.department ?? "").trim();
  if (k && catalog && catalog[k]) return k;
  const bp = String(emp?.boPhan ?? "").trim();
  if (!bp) return "";
  const entries = Object.entries(catalog || {});
  const found = entries.find(
    ([, v]) =>
      String(v?.name ?? "")
        .trim()
        .toLowerCase() === bp.toLowerCase(),
  );
  if (found) return found[0];
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
  const birthRaw = emp.ngayThangNamSinh ?? emp.birthDate;
  const joinRaw = emp.ngayVaoLam ?? emp.joinDate;
  const birthNorm = normalizeDateForHtmlInput(birthRaw);
  const joinNorm = normalizeDateForHtmlInput(joinRaw);
  return {
    ...emp,
    mnv: code || emp.mnv,
    hoVaTen: String(emp.name ?? emp.hoVaTen ?? "").trim(),
    chucVu: String(emp.position ?? emp.chucVu ?? "").trim(),
    ngayThangNamSinh:
      birthNorm || String(birthRaw ?? "").trim(),
    ngayVaoLam: joinNorm || String(joinRaw ?? "").trim(),
    boPhan: resolveDepartmentLabel(emp, catalog) || String(emp.boPhan ?? "").trim(),
  };
}

/** Trạng thái làm việc lưu Firebase (đồng bộ AttendanceList). */
export const ROSTER_TRANG_THAI_VALUES = Object.freeze([
  "dang_lam",
  "thu_viec",
  "tam_nghi",
  "nghi_viec",
]);

export function normalizeTrangThaiLamViec(value) {
  const t = String(value ?? "").trim();
  if (ROSTER_TRANG_THAI_VALUES.includes(t)) return t;
  return "dang_lam";
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
    s.includes("dang lam") ||
    s.includes("dang lam viec")
  )
    return "dang_lam";
  if (s === "thu_viec" || s === "probation" || s.includes("thu viec"))
    return "thu_viec";
  if (s === "tam_nghi" || s === "leave" || s.includes("tam nghi"))
    return "tam_nghi";
  if (s === "nghi_viec" || s === "inactive" || s.includes("nghi viec"))
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
  "gioRa",
  "caLamViec",
  "chamCong",
  "pnTon",
  "mvt",
  "maBoPhan",
  "gioiTinh",
];

const PROFILE_ONLY_STRIP_FROM_DAY = [
  "hoVaTen",
  "boPhan",
  "ngayThangNamSinh",
  "chucVu",
  "ngayVaoLam",
  "sdt",
  "trangThaiLamViec",
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

  const birthRaw = String(form.ngayThangNamSinh ?? "").trim();
  const joinRaw = String(form.ngayVaoLam ?? form.joinDate ?? "").trim();
  const birthStored = birthRaw
    ? normalizeDateForHtmlInput(birthRaw) || birthRaw
    : undefined;
  const joinStored = joinRaw
    ? normalizeDateForHtmlInput(joinRaw) || joinRaw
    : undefined;

  const core = stripUndefined({
    mnv: businessId || undefined,
    hoVaTen: hoVaTen || undefined,
    ngayThangNamSinh: birthStored,
    boPhan: deptName || undefined,
    departmentKey: deptKey || undefined,
    department: deptKey || undefined,
    chucVu: String(form.chucVu ?? form.position ?? "").trim() || undefined,
    ngayVaoLam: joinStored,
    sdt: String(form.sdt ?? "").trim() || undefined,
    trangThaiLamViec: normalizeTrangThaiLamViec(
      form.trangThaiLamViec ?? legacyStatusFromCanonical(form.status),
    ),
    chuyenCan: String(form.chuyenCan ?? "").trim() || undefined,
    phanQuyen: String(form.phanQuyen ?? "").trim() || undefined,
    emailDangNhap: String(form.emailDangNhap ?? "").trim() || undefined,
  });

  const merged = { ...existingProfile, ...core, updatedAt: Date.now() };
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
  delete merged.firebaseKey;
  return stripUndefined(merged);
}

/**
 * attendance/{date}/{key}: stt + mnv + trường chấm công theo ngày.
 */
export function buildEmployeeAttendanceDayDocument({ form, existing = {} }) {
  const businessId = normalizeEmployeeCode(form.businessId ?? form.mnv ?? "");
  const sttNum =
    form.stt !== "" && form.stt != null && Number.isFinite(Number(form.stt))
      ? Number(form.stt)
      : existing.stt;

  const extras = stripUndefined({
    gioVao: form.gioVao || undefined,
    gioRa: form.gioRa || undefined,
    caLamViec: form.caLamViec || undefined,
    chamCong: form.chamCong || undefined,
    pnTon: form.pnTon || undefined,
    mvt: form.mvt || undefined,
    maBoPhan: form.maBoPhan || undefined,
    gioiTinh: form.gioiTinh,
  });

  const preserved = {};
  ATTENDANCE_EXTRA_KEYS.forEach((k) => {
    const ex = extras[k];
    const hasForm =
      ex !== undefined &&
      ex !== "" &&
      !(typeof ex === "string" && ex.trim() === "");
    if (!hasForm && existing[k] !== undefined && existing[k] !== "") {
      preserved[k] = existing[k];
    }
  });

  const merged = {
    mnv: businessId || undefined,
    ...preserved,
    ...extras,
  };
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
  return stripUndefined(merged);
}

/**
 * Gộp profile + node ngày cho UI / quyền. Legacy: node ngày đã chứa đủ hồ sơ thì ưu tiên overlay từ ngày.
 */
export function mergeEmployeeProfileAndDay(dayRow, profileRow, catalog) {
  if (!dayRow || typeof dayRow !== "object") return dayRow;
  const firebaseKey = dayRow.firebaseKey;
  const rowId = dayRow.id;
  const bundled =
    String(dayRow.hoVaTen ?? dayRow.name ?? "").trim() !== "" ||
    String(dayRow.boPhan ?? "").trim() !== "";

  let merged;
  if (bundled) {
    merged = profileRow ? { ...profileRow, ...dayRow } : { ...dayRow };
  } else {
    merged = { ...(profileRow || {}), ...dayRow };
  }
  if (firebaseKey) merged.firebaseKey = firebaseKey;
  if (rowId !== undefined && rowId !== null && merged.id === undefined) {
    merged.id = rowId;
  }
  return enrichEmployeeRow(merged, catalog);
}

