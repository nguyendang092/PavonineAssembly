/**
 * Danh mục loại phép / trạng thái chấm công — **chỉ lưu ở `loaiPhep`** (theo ngày).
 * `gioVao` chỉ còn giờ HH:MM hoặc trống; không còn gắn loại phép vào cột giờ vào.
 * Khi thêm loại mới: cập nhật mảng này + comboStatKey + getAttendanceComboFlags (attendanceComboStats.js).
 */

/** `gioVao` là giờ chấm công (HH:MM) — khi đó không chọn `loaiPhep` trên form. */
export function isAttendanceGioVaoClockTime(value) {
  return /^\d{1,2}:\d{2}(:\d{2})?$/.test(String(value ?? "").trim());
}

export const ATTENDANCE_LOAI_PHEP_OPTIONS = [
  /** Bù giờ công / BGC — `comboStatKey` dùng xuyên suốt thống kê & lương. */
  { value: "Bù giờ công", shortLabel: "BGC", comboStatKey: "buGioCong" },
  { value: "Vào trễ", shortLabel: "VT", comboStatKey: "late" },
  { value: "Phép năm", shortLabel: "PN", comboStatKey: "annualLeave" },
  {
    value: "1/2 Phép năm",
    shortLabel: "1/2PN",
    comboStatKey: "halfAnnualLeave",
  },
  {
    value: "Không lương",
    shortLabel: "KL",
    comboStatKey: "unpaidLeave",
  },
  { value: "Không phép", shortLabel: "KP", comboStatKey: "noPermit" },
  { value: "Thai sản", shortLabel: "TS", comboStatKey: "maternity" },
  { value: "Phép ốm", shortLabel: "PO", comboStatKey: "sickLeave" },
  { value: "Tai nạn", shortLabel: "TN", comboStatKey: "laborAccident" },
  { value: "Phép cưới", shortLabel: "PC", comboStatKey: "weddingLeave" },
  /** `value` = mã lưu DB / in biểu (PT); `shortLabel` = tên hiển thị */
  { value: "Phép tang", shortLabel: "PT", comboStatKey: "funeralLeave" },
  {
    value: "Dưỡng sức",
    shortLabel: "DS",
    comboStatKey: "recuperationLeave",
  },
  {
    value: "Công tác",
    shortLabel: "CT",
    comboStatKey: "annualLeave",
  },
  {
    value: "Nghỉ việc",
    shortLabel: "NV",
    comboStatKey: "resignedLeave",
  },
];

/** Giá trị chuẩn lưu `loaiPhep` cho BGC — hiển thị viết tắt «BGC». */
export const ATTENDANCE_BGC_LOAI_PHEP_VALUE = "Bù giờ công";

/**
 * Alias BGC (loại phép / giờ vào / ghi chú) — gộp về {@link ATTENDANCE_BGC_LOAI_PHEP_VALUE}.
 * Không khớp riêng «Có» (quá ngắn, dễ nhầm).
 */
export function textMatchesAttendanceBuGioCongAlias(raw) {
  const t = String(raw ?? "")
    .trim()
    .replace(/\u00a0/g, " ")
    .normalize("NFKC");
  if (!t) return false;
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) return false;

  const folded = foldGioVaoCompare(t);
  if (folded === foldGioVaoCompare(ATTENDANCE_BGC_LOAI_PHEP_VALUE)) return true;
  if (folded === foldGioVaoCompare("BGC")) return true;
  if (folded === foldGioVaoCompare("Đi làm")) return true;
  if (folded === foldGioVaoCompare("Có đi làm")) return true;

  const compact = folded.replace(/\s/g, "");
  if (compact === "BUGIOCONG" || compact === "CODILAM") return true;
  if (compact.includes("CODILAM")) return true;

  const latin = t
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = latin
    .split(/[^A-Z0-9/]+/)
    .flatMap((x) => x.split("/"))
    .filter(Boolean);
  if (tokens.includes("BGC")) return true;
  if (latin.includes("BU GIO CONG")) return true;
  if (latin.includes("CO DI LAM")) return true;
  if (latin.replace(/\s/g, "").includes("CODILAM")) return true;

  return false;
}

/** Phép tang / PT / FUNERAL — chuẩn hóa & KPI combo. */
export function textMatchesFuneralLeave(raw) {
  const t = String(raw ?? "")
    .trim()
    .replace(/\u00a0/g, " ");
  if (!t) return false;
  const folded = foldGioVaoCompare(t);
  if (
    folded === foldGioVaoCompare("Phép tang") ||
    folded === foldGioVaoCompare("PT")
  ) {
    return true;
  }
  const compact = folded.replace(/\s/g, "");
  if (compact === "PT" || compact === "PHEPTANG") return true;
  const latin = t
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = latin
    .split(/[^A-Z0-9/]+/)
    .flatMap((x) => x.split("/"))
    .filter(Boolean);
  if (tokens.includes("PT")) return true;
  if (latin.includes("PHEP TANG") || latin.includes("FUNERAL")) return true;
  if (latin.replace(/\s/g, "").includes("PHEPTANG")) return true;
  return false;
}

function parseLoaiPhepLatin(raw) {
  const t = String(raw ?? "")
    .trim()
    .replace(/\u00a0/g, " ")
    .normalize("NFKC");
  if (!t) return null;
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) return null;
  const folded = foldGioVaoCompare(t);
  const latin = t
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const compact = folded.replace(/\s/g, "");
  const tokens = latin
    .split(/[^A-Z0-9/]+/)
    .flatMap((x) => x.split("/"))
    .filter(Boolean);
  return { t, folded, latin, compact, tokens };
}

function loaiPhepAliasHasToken(p, ...codes) {
  return codes.some((code) => p.tokens.includes(code));
}

function loaiPhepAliasLatinIncludes(p, ...phrases) {
  return phrases.some((ph) => p.latin.includes(ph));
}

function attendanceLoaiPhepOptionByShortLabel(shortLabel) {
  return (
    ATTENDANCE_LOAI_PHEP_OPTIONS.find((o) => o.shortLabel === shortLabel) ??
    null
  );
}

/** Thứ tự: 1/2PN trước PN; CT (PHEP CONG TAC) trước PN. */
const LOAI_PHEP_EXTENDED_ALIAS_RULES = [
  {
    shortLabel: "1/2PN",
    match: (p) =>
      p.folded === foldGioVaoCompare("1/2 PN") ||
      p.folded === foldGioVaoCompare("1/2PN") ||
      p.compact === "PN1/2" ||
      loaiPhepAliasHasToken(p, "1/2PN") ||
      loaiPhepAliasLatinIncludes(p, "1/2 PHEP NAM", "1/2PHEPNAM"),
  },
  {
    shortLabel: "BGC",
    match: (p) => textMatchesAttendanceBuGioCongAlias(p.t),
  },
  {
    shortLabel: "VT",
    match: (p) =>
      loaiPhepAliasHasToken(p, "VT") ||
      loaiPhepAliasLatinIncludes(p, "VAO TRE"),
  },
  {
    shortLabel: "KL",
    match: (p) =>
      loaiPhepAliasHasToken(p, "KL") ||
      loaiPhepAliasLatinIncludes(p, "KHONG LUONG") ||
      p.compact === "KHONGLUONG",
  },
  {
    shortLabel: "KP",
    match: (p) =>
      loaiPhepAliasHasToken(p, "KP") ||
      loaiPhepAliasLatinIncludes(p, "KHONG PHEP") ||
      p.compact === "KHONGPHEP",
  },
  {
    shortLabel: "TS",
    match: (p) =>
      loaiPhepAliasLatinIncludes(p, "THAI SAN", "THAISAN", "MATERNITY") ||
      p.compact.includes("THAISAN") ||
      (p.tokens.length === 1 && p.tokens[0] === "TS") ||
      p.folded === foldGioVaoCompare("TS"),
  },
  {
    shortLabel: "PO",
    match: (p) =>
      loaiPhepAliasHasToken(p, "PO") ||
      loaiPhepAliasLatinIncludes(p, "PHEP OM", "NGHI OM") ||
      p.compact === "PHEPOM",
  },
  {
    shortLabel: "TN",
    match: (p) =>
      loaiPhepAliasHasToken(p, "TN") ||
      loaiPhepAliasLatinIncludes(p, "TNLD", "TAI NAN") ||
      p.compact.includes("TNLD"),
  },
  {
    shortLabel: "PC",
    match: (p) =>
      loaiPhepAliasHasToken(p, "PC") ||
      loaiPhepAliasLatinIncludes(p, "PHEP CUOI", "PHEPCUOI"),
  },
  {
    shortLabel: "PT",
    match: (p) => textMatchesFuneralLeave(p.t),
  },
  {
    shortLabel: "DS",
    match: (p) =>
      loaiPhepAliasHasToken(p, "DS") ||
      loaiPhepAliasLatinIncludes(p, "DUONG SUC", "DUONGSUC"),
  },
  {
    shortLabel: "CT",
    match: (p) =>
      loaiPhepAliasHasToken(p, "CT") ||
      loaiPhepAliasLatinIncludes(p, "PHEP CONG TAC", "PHEPCONGTAC", "CONG TAC"),
  },
  {
    shortLabel: "PN",
    match: (p) =>
      loaiPhepAliasHasToken(p, "PN") ||
      loaiPhepAliasLatinIncludes(p, "PHEP NAM", "PHEPNAM"),
  },
  {
    shortLabel: "NV",
    match: (p) =>
      loaiPhepAliasHasToken(p, "NV") ||
      loaiPhepAliasLatinIncludes(p, "NGHI VIEC", "NGHIVIEC"),
  },
];

/**
 * Alias legacy (PHEP NAM, KHONG PHEP, …) → option chuẩn.
 * @param {unknown} raw
 * @returns {typeof ATTENDANCE_LOAI_PHEP_OPTIONS[number] | null}
 */
export function matchAttendanceLoaiPhepAliasOption(raw) {
  const p = parseLoaiPhepLatin(raw);
  if (!p) return null;
  for (const rule of LOAI_PHEP_EXTENDED_ALIAS_RULES) {
    if (rule.match(p)) return attendanceLoaiPhepOptionByShortLabel(rule.shortLabel);
  }
  return null;
}

/**
 * Khớp chuỗi với option chuẩn: `rawMatches` rồi alias mở rộng.
 * @param {unknown} raw
 * @returns {typeof ATTENDANCE_LOAI_PHEP_OPTIONS[number] | null}
 */
export function matchAttendanceLoaiPhepOptionIncludingAliases(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  const direct = ATTENDANCE_GIO_VAO_OPTIONS_BY_VALUE_LENGTH.find((o) =>
    rawMatchesAttendanceTypeOption(t, o),
  );
  if (direct) return direct;
  return matchAttendanceLoaiPhepAliasOption(t);
}

/**
 * Chuẩn hóa giá trị lưu `loaiPhep` (alias → `value` đầy đủ trong options).
 */
export function canonicalAttendanceLoaiPhepValue(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  return matchAttendanceLoaiPhepOptionIncludingAliases(t)?.value ?? t;
}

/** `loaiPhep` là 1/2 phép năm — được phép có đồng thời giờ vào. */
export function isAttendanceHalfAnnualLeave(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return false;
  return canonicalAttendanceLoaiPhepValue(t) === "1/2 Phép năm";
}

/** Loại phép được phép đồng thời giờ vào/ra (thống kê chuyên cần, không xóa khi nhập giờ). */
export function isAttendanceLoaiPhepAllowsClockTimes(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return false;
  const canon = canonicalAttendanceLoaiPhepValue(t);
  return canon === "1/2 Phép năm" || canon === "Vào trễ";
}

/** Gập dấu / khoảng trắng — dùng khớp nhập tay, Excel, NBSP */
export function foldGioVaoCompare(s) {
  return String(s ?? "")
    .trim()
    .replace(/\u00a0/g, " ")
    .normalize("NFKC")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Ưu tiên khớp chuỗi dài trước (vd. «1/2 Phép năm» trước «Phép năm»). */
export const ATTENDANCE_GIO_VAO_OPTIONS_BY_VALUE_LENGTH = [
  ...ATTENDANCE_LOAI_PHEP_OPTIONS,
].sort(
  (a, b) =>
    foldGioVaoCompare(b.value).length - foldGioVaoCompare(a.value).length,
);

/**
 * Khớp một chuỗi (Giờ vào / chấm công / …) với một lựa chọn dropdown.
 * Không khớp giờ dạng HH:MM (để tránh nhầm với loại).
 */
export function rawMatchesAttendanceTypeOption(raw, option) {
  const t = String(raw ?? "")
    .trim()
    .replace(/\u00a0/g, " ")
    .normalize("NFKC");
  if (!t) return false;
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) return false;

  const f = foldGioVaoCompare(t);
  const fv = foldGioVaoCompare(option.value);
  if (f === fv) return true;

  const fs = foldGioVaoCompare(option.shortLabel);
  if (f === fs) return true;

  const compact = f.replace(/\s/g, "");
  const compactVal = fv.replace(/\s/g, "");
  if (compact === compactVal) return true;

  const shortTok = fs.replace(/\s/g, "");
  if (shortTok.length < 2) return false;

  const latin = t
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00a0/g, " ");
  const tokens = latin
    .split(/[^A-Z0-9/]+/)
    .flatMap((x) => x.split("/"))
    .filter(Boolean);
  if (tokens.includes(shortTok)) return true;

  if (option.shortLabel === "BGC" && textMatchesAttendanceBuGioCongAlias(t)) {
    return true;
  }

  return false;
}

/**
 * Viết tắt loại phép / trạng thái (cùng quy tắc với cột «Loại phép»).
 * @param {unknown} raw — chuỗi `loaiPhep` hoặc tương đương
 * @returns {string}
 */
export function formatAttendanceGioVaoDisplay(raw) {
  const t = String(raw ?? "")
    .trim()
    .replace(/\u00a0/g, " ");
  if (!t) return "";
  const matched = matchAttendanceLoaiPhepOptionIncludingAliases(t);
  return matched?.shortLabel || t;
}

/** Cột «Thời gian vào»: chỉ HH:MM (không hiển thị loại phép). */
export function formatAttendanceTimeInColumnDisplay(raw) {
  const t = String(raw ?? "")
    .trim()
    .replace(/\u00a0/g, " ");
  if (!t) return "";
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) return t;
  return "";
}

/** Cột «Loại phép»: viết tắt loại / trạng thái; rỗng nếu `gioVao` là giờ HH:MM. */
export function formatAttendanceLeaveTypeColumnDisplay(raw) {
  const t = String(raw ?? "")
    .trim()
    .replace(/\u00a0/g, " ");
  if (!t) return "";
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) return "";
  return formatAttendanceGioVaoDisplay(t);
}

/**
 * Giá trị cột «Loại phép» — **chỉ** từ `loaiPhep`.
 * Tiện ích tùy chọn: tách `loaiPhep` khỏi `gioVao` khi dữ liệu cũ nhập nhầm — pipeline đọc/lưu node ngày không gọi tự động.
 * @param {Record<string, unknown> | null | undefined} emp
 * @returns {string}
 */
export function getAttendanceLeaveTypeRaw(emp) {
  if (emp == null || typeof emp !== "object") return "";
  const normalized = normalizeAttendanceDayRecord(emp);
  return String(normalized.loaiPhep ?? "")
    .trim()
    .replace(/\u00a0/g, " ");
}

/** Chuỗi `loaiPhep` (đã migrate legacy nếu cần) khớp «Không phép» / KP. */
export function isAttendanceLeaveTypeKhongPhep(raw) {
  const t = String(raw ?? "")
    .trim()
    .replace(/\u00a0/g, " ");
  if (!t) return false;
  const matched = ATTENDANCE_GIO_VAO_OPTIONS_BY_VALUE_LENGTH.find((opt) =>
    rawMatchesAttendanceTypeOption(t, opt),
  );
  return matched?.shortLabel === "KP";
}

/** `loaiPhep` khớp BGC — quên chấm công, có mặt; giờ vào bổ sung sau. */
export function isAttendanceBuGioCongType(raw) {
  const t = String(raw ?? "")
    .trim()
    .replace(/\u00a0/g, " ");
  if (!t) return false;
  const matched = ATTENDANCE_GIO_VAO_OPTIONS_BY_VALUE_LENGTH.find((opt) =>
    rawMatchesAttendanceTypeOption(t, opt),
  );
  return matched?.shortLabel === "BGC";
}

/**
 * Chỉ coi là nghỉ thực sự khi không phải các trạng thái vẫn có thể đi làm / tính giờ.
 * `BGC` (Bù giờ công) và `VT` (Vào trễ) không chặn giờ công trên bảng lương.
 */
export function isAttendanceActualLeaveType(
  raw,
  {
    includeTapVuInWorkingHours = false,
    includeThaiSanInWorkingHours = false,
  } = {},
) {
  const t = String(raw ?? "")
    .trim()
    .replace(/\u00a0/g, " ");
  if (!t) return false;
  const matched = ATTENDANCE_GIO_VAO_OPTIONS_BY_VALUE_LENGTH.find((opt) =>
    rawMatchesAttendanceTypeOption(t, opt),
  );
  if (!matched) return true;

  // BGC/VT luôn được coi là "không phải phép" (vẫn tính giờ công).
  if (matched.shortLabel === "BGC" || matched.shortLabel === "VT") return false;

  // Chế độ bao gồm (per employee/day): cho phép TS/NV vẫn tính giờ công.
  if (matched.shortLabel === "TS" && includeThaiSanInWorkingHours) return false;
  if (matched.shortLabel === "NV" && includeTapVuInWorkingHours) return false;

  return true;
}

/**
 * Dữ liệu cũ: loại phép / trạng thái nhập nhầm vào `gioVao` (không phải HH:MM).
 * Gộp sang `loaiPhep` và xóa `gioVao` — gọi khi đọc attendance hoặc trước khi lưu `attendance/{ngày}`.
 * @param {Record<string, unknown> | null | undefined} emp
 * @returns {Record<string, unknown>}
 */
export function applyLegacyGioVaoLeaveMigration(emp) {
  if (emp == null || typeof emp !== "object") return emp;
  const lp = String(emp.loaiPhep ?? "").trim();
  if (lp) {
    const canon = canonicalAttendanceLoaiPhepValue(lp);
    return canon === lp ? emp : { ...emp, loaiPhep: canon };
  }
  const gv = String(emp.gioVao ?? "")
    .trim()
    .replace(/\u00a0/g, " ");
  if (!gv) return emp;
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(gv)) return emp;
  return {
    ...emp,
    loaiPhep: canonicalAttendanceLoaiPhepValue(gv),
    gioVao: "",
  };
}

/**
 * Đồng bộ `gioVao` (giờ HH:MM) và `loaiPhep` — cùng quy tắc form sửa điểm danh.
 * Tránh lệch sau upload lần 2: lần 1 chỉ loại phép, lần 2 thêm giờ vào.
 */
export function reconcileAttendanceGioVaoLoaiPhep(emp) {
  if (emp == null || typeof emp !== "object") return emp;
  const gioVao = String(emp.gioVao ?? "").trim();
  const loaiPhep = String(emp.loaiPhep ?? "").trim();

  if (isAttendanceGioVaoClockTime(gioVao)) {
    if (loaiPhep && !isAttendanceLoaiPhepAllowsClockTimes(loaiPhep)) {
      return { ...emp, loaiPhep: "" };
    }
    return emp;
  }

  if (loaiPhep && !isAttendanceLoaiPhepAllowsClockTimes(loaiPhep)) {
    return { ...emp, gioVao: "", gioRa: "" };
  }

  return emp;
}

/**
 * Chuẩn hóa node điểm danh/ngày: alias → `value` chuẩn (`loaiPhep`);
 * gỡ text loại phép khỏi `gioVao`; ghi chú → `loaiPhep` khi trống.
 */
export function normalizeAttendanceDayRecord(emp, options = {}) {
  if (emp == null || typeof emp !== "object") return emp;
  let next = applyLegacyGioVaoLeaveMigration(emp);
  if (!String(next.loaiPhep ?? "").trim()) {
    for (const key of ["chamCong", "phepNam"]) {
      const raw = String(next[key] ?? "").trim();
      if (!raw) continue;
      const matched = matchAttendanceLoaiPhepOptionIncludingAliases(raw);
      if (matched) {
        next = { ...next, loaiPhep: matched.value };
        break;
      }
    }
  } else {
    const canon = canonicalAttendanceLoaiPhepValue(next.loaiPhep);
    if (canon !== String(next.loaiPhep ?? "").trim()) {
      next = { ...next, loaiPhep: canon };
    }
  }
  if (options.reconcileGioVaoLoaiPhep !== false) {
    next = reconcileAttendanceGioVaoLoaiPhep(next);
  }
  return next;
}

/** Cột «Loại phép» từ bản ghi nhân viên (sau migrate `loaiPhep` đã đủ). */
export function formatAttendanceLeaveTypeColumnForEmployee(emp) {
  return formatAttendanceLeaveTypeColumnDisplay(getAttendanceLeaveTypeRaw(emp));
}

/**
 * Màu chữ loại phép (điểm danh / lương / thống kê):
 * TS — xanh dương; PN & 1/2PN — xanh lá; NV — xám; còn lại — đỏ; không khớp chuẩn — đỏ.
 * @param {unknown} raw — `loaiPhep` hoặc chuỗi tương đương (shortLabel cũng khớp).
 */
export function getAttendanceLeaveTypeColorClassName(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return "text-gray-500 dark:text-gray-400";
  const matched = ATTENDANCE_GIO_VAO_OPTIONS_BY_VALUE_LENGTH.find((opt) =>
    rawMatchesAttendanceTypeOption(t, opt),
  );
  if (!matched) {
    return "text-red-600 dark:text-red-400";
  }
  const sl = matched.shortLabel;
  if (sl === "TS") return "text-blue-600 dark:text-blue-400";
  if (sl === "PN" || sl === "1/2PN") {
    return "text-green-600 dark:text-green-400";
  }
  if (sl === "NV") return "text-gray-600 dark:text-gray-400";
  if (sl === "BGC" || sl === "VT") {
    return "text-amber-700 dark:text-amber-400";
  }
  return "text-red-600 dark:text-red-400";
}

export function getAttendanceLeaveTypeColorClassNameForEmployee(emp) {
  return getAttendanceLeaveTypeColorClassName(getAttendanceLeaveTypeRaw(emp));
}

/**
 * Badge «Phân loại phép» (tóm tắt): nền + chữ + viền theo cùng quy tắc.
 */
export function getAttendanceLeaveTypeBadgeClassName(raw) {
  const t = String(raw ?? "").trim();
  if (!t) {
    return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600";
  }
  const matched = ATTENDANCE_GIO_VAO_OPTIONS_BY_VALUE_LENGTH.find((opt) =>
    rawMatchesAttendanceTypeOption(t, opt),
  );
  if (!matched) {
    return "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800";
  }
  const sl = matched.shortLabel;
  if (sl === "TS") {
    return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800";
  }
  if (sl === "PN" || sl === "1/2PN") {
    return "bg-green-100 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800";
  }
  if (sl === "NV") {
    return "bg-gray-100 text-gray-700 border-gray-300 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600";
  }
  if (sl === "BGC" || sl === "VT") {
    return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800";
  }
  return "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800";
}

/** Badge loại phép — nền đậm hơn (lưới tháng), viền mảnh. */
export function getAttendanceLeaveTypeEmphasisBadgeClassName(raw) {
  const t = String(raw ?? "").trim();
  if (!t) {
    return "bg-slate-300 text-slate-900 border-slate-400 dark:bg-slate-600 dark:text-slate-100 dark:border-slate-500";
  }
  const matched = ATTENDANCE_GIO_VAO_OPTIONS_BY_VALUE_LENGTH.find((opt) =>
    rawMatchesAttendanceTypeOption(t, opt),
  );
  if (!matched) {
    return "bg-red-300 text-red-950 border-red-400 dark:bg-red-900/75 dark:text-red-50 dark:border-red-700";
  }
  const sl = matched.shortLabel;
  if (sl === "TS") {
    return "bg-blue-300 text-blue-950 border-blue-400 dark:bg-blue-900/75 dark:text-blue-50 dark:border-blue-600";
  }
  if (sl === "PN" || sl === "1/2PN") {
    return "bg-green-300 text-green-950 border-green-400 dark:bg-green-900/75 dark:text-green-50 dark:border-green-600";
  }
  if (sl === "NV") {
    return "bg-slate-300 text-slate-900 border-slate-400 dark:bg-slate-600 dark:text-slate-100 dark:border-slate-500";
  }
  if (sl === "BGC" || sl === "VT") {
    return "bg-amber-300 text-amber-950 border-amber-400 dark:bg-amber-900/75 dark:text-amber-50 dark:border-amber-600";
  }
  return "bg-red-300 text-red-950 border-red-400 dark:bg-red-900/75 dark:text-red-50 dark:border-red-700";
}

/** Mã phép dài (vd. 1/2PN) — cỡ chữ nhỏ hơn để vừa ô lưới tháng. */
export function isAttendanceLeaveShortLabelCompact(leaveShort) {
  return String(leaveShort ?? "").trim().toUpperCase() === "1/2PN";
}

export function getAttendanceLeaveTypeCompactBadgeClassName(leaveShort) {
  return isAttendanceLeaveShortLabelCompact(leaveShort)
    ? "!text-[8px] px-px tracking-tight"
    : "";
}

/** Nền cả ô ngày khi có loại phép — đậm hơn badge 1 bậc (lưới tháng). */
export function getAttendanceLeaveTypeEmphasisCellClassName(raw) {
  const t = String(raw ?? "").trim();
  if (!t) {
    return "bg-slate-400 dark:bg-slate-700";
  }
  const matched = ATTENDANCE_GIO_VAO_OPTIONS_BY_VALUE_LENGTH.find((opt) =>
    rawMatchesAttendanceTypeOption(t, opt),
  );
  if (!matched) return "bg-red-400 dark:bg-red-950/80";
  const sl = matched.shortLabel;
  if (sl === "TS") return "bg-blue-400 dark:bg-blue-950/80";
  if (sl === "PN" || sl === "1/2PN") {
    return "bg-green-400 dark:bg-green-950/80";
  }
  if (sl === "NV") return "bg-slate-400 dark:bg-slate-700";
  if (sl === "BGC" || sl === "VT") {
    return "bg-amber-400 dark:bg-amber-950/80";
  }
  return "bg-red-400 dark:bg-red-950/80";
}

/** In A3: badge loại phép — nền đậm, viền mảnh. */
export function getAttendanceLeaveTypeEmphasisPrintStyleAttr(raw, leaveShort) {
  const compact = isAttendanceLeaveShortLabelCompact(leaveShort);
  const fontSize = compact ? "5.5pt" : "6.5pt";
  const pad = compact ? "0 1px" : "1px 3px";
  const base = `display:inline-block;max-width:100%;box-sizing:border-box;white-space:nowrap;padding:${pad};border-radius:2px;font-size:${fontSize};line-height:1;font-weight:700;border:1px solid;`;
  const t = String(raw ?? "").trim();
  if (!t) {
    return `${base}background:#cbd5e1;color:#0f172a;border-color:#94a3b8;`;
  }
  const matched = ATTENDANCE_GIO_VAO_OPTIONS_BY_VALUE_LENGTH.find((opt) =>
    rawMatchesAttendanceTypeOption(t, opt),
  );
  if (!matched) {
    return `${base}background:#fca5a5;color:#450a0a;border-color:#f87171;`;
  }
  const sl = matched.shortLabel;
  if (sl === "TS") {
    return `${base}background:#93c5fd;color:#172554;border-color:#60a5fa;`;
  }
  if (sl === "PN" || sl === "1/2PN") {
    return `${base}background:#86efac;color:#052e16;border-color:#4ade80;`;
  }
  if (sl === "NV") {
    return `${base}background:#cbd5e1;color:#0f172a;border-color:#94a3b8;`;
  }
  if (sl === "BGC" || sl === "VT") {
    return `${base}background:#fcd34d;color:#451a03;border-color:#fbbf24;`;
  }
  return `${base}background:#fca5a5;color:#450a0a;border-color:#f87171;`;
}

/** In A3: nền cả ô ngày khi có loại phép — đậm hơn badge 1 bậc. */
export function getAttendanceLeaveTypeEmphasisPrintCellBg(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return "#94a3b8";
  const matched = ATTENDANCE_GIO_VAO_OPTIONS_BY_VALUE_LENGTH.find((opt) =>
    rawMatchesAttendanceTypeOption(t, opt),
  );
  if (!matched) return "#f87171";
  const sl = matched.shortLabel;
  if (sl === "TS") return "#60a5fa";
  if (sl === "PN" || sl === "1/2PN") return "#4ade80";
  if (sl === "NV") return "#94a3b8";
  if (sl === "BGC" || sl === "VT") return "#fbbf24";
  return "#f87171";
}

/** Màu hex loại phép — khớp cột «Loại phép» / `getAttendanceLeaveTypeColorClassName` (light). */
export function getAttendanceLeaveTypeHexColor(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return "#64748b";
  const matched = ATTENDANCE_GIO_VAO_OPTIONS_BY_VALUE_LENGTH.find((opt) =>
    rawMatchesAttendanceTypeOption(t, opt),
  );
  if (!matched) return "#dc2626";
  const sl = matched.shortLabel;
  if (sl === "TS") return "#2563eb";
  if (sl === "PN" || sl === "1/2PN") return "#16a34a";
  if (sl === "NV") return "#4b5563";
  if (sl === "BGC" || sl === "VT") return "#b45309";
  return "#dc2626";
}

/** In trang (`window.print`): style inline theo cùng quy tắc màu. */
export function getAttendanceLeaveTypePrintStyleAttr(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  const base = "font-weight:bold;";
  return `${base}color:${getAttendanceLeaveTypeHexColor(t)};`;
}

export function getAttendanceLeaveTypePrintStyleAttrForEmployee(emp) {
  return getAttendanceLeaveTypePrintStyleAttr(getAttendanceLeaveTypeRaw(emp));
}

/**
 * Attendance Dashboard (thống kê combo): `comboStatKey` → class chữ giống cột Loại phép.
 * Metric không có trong options (checkedIn, nonStandardTimeIn, nightShift) hoặc KPI `buGioCong`: màu tách biệt.
 */
export function getAttendanceLeaveTypeColorClassNameForComboStatKey(metricKey) {
  if (metricKey === "buGioCong") {
    return "text-amber-700 dark:text-amber-400";
  }
  const opt = ATTENDANCE_LOAI_PHEP_OPTIONS.find(
    (o) => o.comboStatKey === metricKey,
  );
  if (opt) return getAttendanceLeaveTypeColorClassName(opt.shortLabel);
  switch (metricKey) {
    case "checkedIn":
      return "text-emerald-600 dark:text-emerald-400";
    case "nonStandardTimeIn":
      return "text-cyan-600 dark:text-cyan-400";
    case "timeInHashHHMM":
      return "text-orange-600 dark:text-orange-400";
    case "nightShift":
      return "text-indigo-600 dark:text-indigo-400";
    case "wrongDepartment":
      return "text-rose-600 dark:text-rose-400";
    default:
      return "text-slate-600 dark:text-slate-400";
  }
}

export function getAttendanceLeaveTypeBadgeClassNameForComboStatKey(metricKey) {
  if (metricKey === "buGioCong") {
    return "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800";
  }
  const opt = ATTENDANCE_LOAI_PHEP_OPTIONS.find(
    (o) => o.comboStatKey === metricKey,
  );
  if (opt) return getAttendanceLeaveTypeBadgeClassName(opt.shortLabel);
  switch (metricKey) {
    case "checkedIn":
      return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
    case "nonStandardTimeIn":
      return "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800";
    case "timeInHashHHMM":
      return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800";
    case "nightShift":
      return "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800";
    case "wrongDepartment":
      return "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600";
  }
}

/** Màu fill cột Bar (Recharts) — đồng bộ TS / PN / NV / đỏ / … */
export function getAttendanceComboBarFillForMetricKey(metricKey) {
  if (metricKey === "buGioCong") return "#d97706";
  const opt = ATTENDANCE_LOAI_PHEP_OPTIONS.find(
    (o) => o.comboStatKey === metricKey,
  );
  if (opt) {
    const sl = opt.shortLabel;
    if (sl === "TS") return "#2563eb";
    if (sl === "PN" || sl === "1/2PN") return "#16a34a";
    if (sl === "NV") return "#64748b";
    return "#dc2626";
  }
  switch (metricKey) {
    case "checkedIn":
      return "#10b981";
    case "nonStandardTimeIn":
      return "#06b6d4";
    case "timeInHashHHMM":
      return "#f97316";
    case "nightShift":
      return "#6366f1";
    case "wrongDepartment":
      return "#e11d48";
    default:
      return "#94a3b8";
  }
}

/** Giá trị đã gập dấu (để khớp dữ liệu nhập tay / Excel). */
const FOLDED_OPTION_VALUES = ATTENDANCE_LOAI_PHEP_OPTIONS.map((o) =>
  foldGioVaoCompare(o.value),
);

/** Viết tắt / biến thể lưu sẵn trong DB */
const FOLDED_EXTRA_LEAVE_MARKERS = [
  "PN",
  "PO",
  "TS",
  "KL",
  "KP",
  "TN",
  "PC",
  "PT",
  "DS",
  "NV",
  "VT",
  "BGC",
  "PN1/2",
  "1/2PN",
  "1/2 PN",
];

const BU_CONG_LEAVE_FOLDED_SET = new Set();
for (const v of FOLDED_OPTION_VALUES) {
  BU_CONG_LEAVE_FOLDED_SET.add(v);
  BU_CONG_LEAVE_FOLDED_SET.add(v.replace(/\s/g, ""));
}
for (const x of FOLDED_EXTRA_LEAVE_MARKERS) {
  const fx = foldGioVaoCompare(x);
  BU_CONG_LEAVE_FOLDED_SET.add(fx);
  BU_CONG_LEAVE_FOLDED_SET.add(fx.replace(/\s/g, ""));
}

/**
 * `gioVao` là loại phép/trạng thái (không phải giờ) — dùng lọc bù công & tương tự.
 */
export function isGioVaoLeaveOrStatusType(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return false;
  if (/^\d{1,2}:\d{2}/.test(s)) return false;
  const f = foldGioVaoCompare(s);
  if (BU_CONG_LEAVE_FOLDED_SET.has(f)) return true;
  const compact = f.replace(/\s/g, "");
  if (BU_CONG_LEAVE_FOLDED_SET.has(compact)) return true;
  return false;
}
