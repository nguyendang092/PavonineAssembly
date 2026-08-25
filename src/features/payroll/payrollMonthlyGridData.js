import { db, ref, get } from "@/services/firebase";
import { isKoreanAttendanceRoot } from "@/features/attendance/attendanceSeasonalStt";
import {
  buildPayrollMonthDayChunkFromRaw,
  buildErrorPayrollMonthDayChunk,
} from "@/features/payroll/buildPayrollDayFromRaw";
import {
  PAYROLL_MONTH_FETCH_BATCH_SIZE,
  PAYROLL_MONTH_FETCH_YIELD_MS,
  PAYROLL_MONTH_DAY_FETCH_BASE_DELAY_MS,
  PAYROLL_MONTH_DAY_FETCH_MAX_RETRY,
  USE_MONTHLY_AGGREGATE_NODE,
} from "@/features/payroll/payrollMonthDataScale";
import {
  attendanceMnvStorageKey,
  businessEmployeeCode,
} from "@/utils/attendanceEmployeeRecord";
import {
  pickBestPayrollContractDateForMonth,
  pickBestPayrollJoinDateForMonth,
  pickPayrollEmployeeProfileDates,
} from "@/features/payroll/payrollEmployeeFields";
import { mixFingerprintHash } from "@/features/payroll/payrollMonthChunksFingerprint";

/** Phân tách MNV và Firebase id khi cùng MNV có nhiều bản ghi. */
export const PAYROLL_MONTH_ROW_ID_SEP = "__";

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function yieldToNextFrame(yieldMs = 0) {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function" && yieldMs <= 0) {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, yieldMs);
    }
  });
}

function applyCanonicalKeysToOneChunk(chunk, indexes) {
  if (!chunk) return;
  const employees = (chunk.employees ?? []).map((emp) => ({
    ...emp,
    monthEmployeeKey: canonicalPayrollMonthRowId(emp, indexes),
  }));
  chunk.employees = employees;
  chunk.byId = new Map(
    employees.map((e) => [normalizePayrollMonthRowIdKey(e.id), e]),
  );
  chunk.byMonthEmployeeKey = buildPayrollMonthByMonthEmployeeKeyMap(employees);
  chunk.rowLookup = buildPayrollMonthChunkRowLookup(employees);
}

/** Chuẩn hóa khóa dòng lưới tháng — tránh lệch number/string (vd. MNV 200611). */
export function normalizePayrollMonthRowIdKey(key) {
  return String(key ?? "").trim();
}

export function parsePayrollMonthRowIdParts(rowId) {
  const s = normalizePayrollMonthRowIdKey(rowId);
  const idx = s.indexOf(PAYROLL_MONTH_ROW_ID_SEP);
  if (idx === -1) return { mnv: s, firebaseId: "" };
  return {
    mnv: s.slice(0, idx),
    firebaseId: s.slice(idx + PAYROLL_MONTH_ROW_ID_SEP.length),
  };
}

/** MNV hiển thị trên lưới tháng (bỏ hậu tố Firebase id). */
export function payrollMonthDisplayMnvFromRowId(rowId, rep) {
  const fromRep = attendanceMnvStorageKey(rep?.mnv ?? rep?.businessId);
  if (fromRep) return fromRep;
  return parsePayrollMonthRowIdParts(rowId).mnv;
}

/** Chuẩn hóa tên bộ phận — dùng chung lọc lưới tháng / bảng ngày. */
export function normalizePayrollDepartment(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

/** Map khóa tra cứu trong chunk ngày — ưu tiên Firebase id, tránh ghi đè trùng MNV. */
export function buildPayrollMonthByMonthEmployeeKeyMap(employees) {
  const map = new Map();
  for (const emp of employees ?? []) {
    const id = normalizePayrollMonthRowIdKey(emp?.id);
    if (id) map.set(id, emp);

    const canonical = normalizePayrollMonthRowIdKey(emp?.monthEmployeeKey);
    if (canonical && !map.has(canonical)) map.set(canonical, emp);

    const mnv = businessEmployeeCode(emp);
    if (mnv && !map.has(mnv)) map.set(mnv, emp);
  }
  return map;
}

/**
 * Sau khi có đủ chunk tháng — gán `monthEmployeeKey` canonical và rebuild index
 * (đồng bộ mọi NV: đổi BP, trùng MNV, thiếu MNV một số ngày).
 */
export function applyPayrollMonthCanonicalKeysToChunks(
  dayChunks,
  { mutateFromIndex = 0, onlyDateKey } = {},
) {
  const list = dayChunks ?? [];
  const indexes = buildPayrollMonthIdentityIndexes(list);

  if (onlyDateKey) {
    const chunk = list.find((c) => c?.dateKey === onlyDateKey);
    if (chunk) applyCanonicalKeysToOneChunk(chunk, indexes);
    return dayChunks;
  }

  const start = Math.max(0, Math.min(mutateFromIndex, list.length));
  for (let i = start; i < list.length; i += 1) {
    applyCanonicalKeysToOneChunk(list[i], indexes);
  }
  return dayChunks;
}

export function isPayrollMonthChunkFetchError(chunk) {
  return chunk?.status === "error";
}

export function insertChunkSortedByDate(chunks, chunk) {
  if (!chunk?.dateKey) return chunks ?? [];
  const next = [...(chunks ?? [])];
  const idx = next.findIndex((c) => c?.dateKey === chunk.dateKey);
  if (idx >= 0) {
    next[idx] = chunk;
    return next;
  }
  const insertAt = next.findIndex((c) => String(c?.dateKey ?? "") > chunk.dateKey);
  if (insertAt === -1) next.push(chunk);
  else next.splice(insertAt, 0, chunk);
  return next;
}

/** Row id lưới tháng bị ảnh hưởng sau patch 1 ngày (summary incremental). */
export function collectAffectedRowIdsFromPatchedChunk(chunk, firebaseKey) {
  const ids = new Set();
  const fbKey = normalizePayrollMonthRowIdKey(firebaseKey);
  if (fbKey) ids.add(fbKey);

  for (const emp of chunk?.employees ?? []) {
    const empId = normalizePayrollMonthRowIdKey(emp?.id);
    if (fbKey && empId !== fbKey) continue;
    if (emp?.monthEmployeeKey) {
      ids.add(normalizePayrollMonthRowIdKey(emp.monthEmployeeKey));
    }
    if (empId) ids.add(empId);
    const mnv = businessEmployeeCode(emp);
    if (mnv) ids.add(mnv);
  }
  return [...ids].filter(Boolean);
}

export async function fetchOneDayWithRetry(
  attendanceRootPath,
  dateKey,
  { signal } = {},
) {
  for (let attempt = 0; attempt <= PAYROLL_MONTH_DAY_FETCH_MAX_RETRY; attempt += 1) {
    if (signal?.aborted) {
      return buildErrorPayrollMonthDayChunk(dateKey, new Error("aborted"));
    }
    try {
      const snap = await get(ref(db, `${attendanceRootPath}/${dateKey}`));
      return stampPayrollMonthChunkAttendanceRootFlags(
        buildPayrollMonthDayChunkFromRaw(snap.val(), dateKey),
        attendanceRootPath,
      );
    } catch (err) {
      if (attempt === PAYROLL_MONTH_DAY_FETCH_MAX_RETRY) {
        return buildErrorPayrollMonthDayChunk(dateKey, err);
      }
      await sleep(PAYROLL_MONTH_DAY_FETCH_BASE_DELAY_MS * 2 ** attempt);
    }
  }
  return buildErrorPayrollMonthDayChunk(dateKey, new Error("fetch failed"));
}

export function countPayrollMonthErrorDays(dayChunks) {
  return (dayChunks ?? []).filter((c) => isPayrollMonthChunkFetchError(c)).length;
}

export function payrollMonthRepResolveBinding(rowId, rep) {
  const { mnv, firebaseId } = parsePayrollMonthRowIdParts(rowId);
  if (!rep && !firebaseId && !mnv) return null;
  return {
    id: firebaseId || (rep?.id != null ? String(rep.id) : ""),
    mnv: mnv || rep?.mnv || rep?.businessId || "",
    businessId: rep?.businessId,
  };
}

/** Hồ sơ gộp từ chunk ngày — không gộp ngày vào làm/HĐ (chunk cuối tháng hay ghi sai). */
const PAYROLL_MONTH_REP_PROFILE_LATEST_KEYS = [
  "hoVaTen",
  "mnv",
  "businessId",
  "mvt",
  "maBoPhan",
];

/** Chỉ lấy từ danh sách NV master khi enrich rep. */
const PAYROLL_MONTH_REP_PROFILE_DATE_KEYS = ["ngayVaoLam", "ngayHopDong"];

function mergePayrollMonthRepProfileFields(out, e, preferLatest) {
  const next = { ...out };
  for (const key of PAYROLL_MONTH_REP_PROFILE_LATEST_KEYS) {
    const v = e[key];
    if (v == null || String(v).trim() === "") continue;
    if (preferLatest) next[key] = v;
    else if (!next[key] || String(next[key]).trim() === "") next[key] = v;
  }
  if (preferLatest && e.id) next.id = e.id;
  else if (!next.id && e.id) next.id = e.id;
  return next;
}

function stripPayrollMonthRepProfileDates(emp) {
  if (!emp) return emp;
  const next = { ...emp };
  for (const key of PAYROLL_MONTH_REP_PROFILE_DATE_KEYS) {
    delete next[key];
  }
  delete next.joinDate;
  delete next.contractDate;
  return next;
}

/** Gộp MNV đã biết trong tháng theo Firebase id — tránh tách 2 dòng khi một ngày thiếu MNV. */
export function buildPayrollMonthFirebaseIdToMnv(dayChunks) {
  const map = new Map();
  for (const chunk of dayChunks ?? []) {
    for (const emp of chunk.employees ?? []) {
      const mnvKey = businessEmployeeCode(emp);
      if (mnvKey && emp.id) map.set(emp.id, mnvKey);
    }
  }
  return map;
}

/** MNV → tập Firebase id (phát hiện trùng MNV khác người). */
export function buildPayrollMonthMnvToFirebaseIds(dayChunks) {
  const map = new Map();
  for (const chunk of dayChunks ?? []) {
    for (const emp of chunk.employees ?? []) {
      const mnv = businessEmployeeCode(emp);
      const fbId = String(emp.id ?? "").trim();
      if (!mnv || !fbId) continue;
      if (!map.has(mnv)) map.set(mnv, new Set());
      map.get(mnv).add(fbId);
    }
  }
  return map;
}

export function buildPayrollMonthIdentityIndexes(dayChunks) {
  return {
    firebaseIdToMnv: buildPayrollMonthFirebaseIdToMnv(dayChunks),
    mnvToFirebaseIds: buildPayrollMonthMnvToFirebaseIds(dayChunks),
  };
}

function normalizePayrollMonthIdentityIndexes(indexes) {
  if (indexes instanceof Map) {
    return {
      firebaseIdToMnv: indexes,
      mnvToFirebaseIds: new Map(),
    };
  }
  return indexes ?? { firebaseIdToMnv: new Map(), mnvToFirebaseIds: new Map() };
}

/** Khóa dòng ổn định — 1 MNV / 1 Firebase id; trùng MNV khác id → tách dòng. */
export function canonicalPayrollMonthRowId(emp, indexes) {
  const { firebaseIdToMnv, mnvToFirebaseIds } =
    normalizePayrollMonthIdentityIndexes(indexes);
  const mnv = businessEmployeeCode(emp);
  const fbId = String(emp?.id ?? "").trim();

  const rowIdForMnv = (mnvKey) => {
    const ids = mnvToFirebaseIds.get(mnvKey);
    if (ids && ids.size > 1 && fbId) {
      return `${mnvKey}${PAYROLL_MONTH_ROW_ID_SEP}${fbId}`;
    }
    return normalizePayrollMonthRowIdKey(mnvKey);
  };

  if (mnv) return rowIdForMnv(mnv);

  const linked = fbId ? firebaseIdToMnv.get(fbId) : "";
  if (linked) return rowIdForMnv(linked);

  return normalizePayrollMonthRowIdKey(emp?.monthEmployeeKey || emp?.id || "");
}

/** Mọi alias có thể tra cứu một NV trong chunk ngày. */
export function payrollMonthEmployeeRowAliases(emp) {
  const keys = new Set();
  const add = (v) => {
    const k = normalizePayrollMonthRowIdKey(v);
    if (k) keys.add(k);
  };
  add(emp?.monthEmployeeKey);
  add(businessEmployeeCode(emp));
  add(attendanceMnvStorageKey(emp?.mnv));
  add(attendanceMnvStorageKey(emp?.businessId));
  add(emp?.id);
  const id = String(emp?.id ?? "").trim();
  if (id.startsWith("emp_")) add(id.slice(4));
  return keys;
}

/** Map đa khóa → dòng NV (MNV / businessId / Firebase id / emp_{mã}). */
export function buildPayrollMonthChunkRowLookup(employees) {
  const lookup = new Map();
  for (const emp of employees ?? []) {
    for (const key of payrollMonthEmployeeRowAliases(emp)) {
      if (!lookup.has(key)) lookup.set(key, emp);
    }
  }
  return lookup;
}

function employeeMatchesPayrollMonthRowBinding(emp, rowId) {
  if (!emp) return false;
  const { mnv, firebaseId } = parsePayrollMonthRowIdParts(rowId);
  if (firebaseId) {
    return normalizePayrollMonthRowIdKey(emp.id) === firebaseId;
  }
  const code = businessEmployeeCode(emp);
  return Boolean(mnv && code === mnv);
}

/**
 * Tìm dòng NV trong chunk ngày — đồng bộ bảng giờ công (Firebase id) và lưới tháng (MNV).
 */
export function resolvePayrollMonthDayEmployee(chunk, rowId, rep) {
  if (!chunk) return null;
  const { mnv, firebaseId } = parsePayrollMonthRowIdParts(rowId);
  const lookup = chunk.rowLookup;
  const byKey = chunk.byMonthEmployeeKey;
  const byId = chunk.byId;

  if (firebaseId) {
    const direct = byId?.get(firebaseId);
    if (direct) return direct;
    const fromLookup = lookup?.get(firebaseId);
    if (
      fromLookup &&
      normalizePayrollMonthRowIdKey(fromLookup.id) === firebaseId
    ) {
      return fromLookup;
    }
  }

  const rowKey = mnv || normalizePayrollMonthRowIdKey(rowId);

  const directRowId = byId?.get(rowKey);
  if (
    directRowId &&
    normalizePayrollMonthRowIdKey(directRowId.id) === rowKey
  ) {
    return directRowId;
  }

  let emp = lookup?.get(rowKey) ?? byKey?.get(rowKey) ?? byId?.get(rowKey);
  if (emp && employeeMatchesPayrollMonthRowBinding(emp, rowId)) return emp;

  const repId = rep?.id != null ? String(rep.id) : "";
  const repMnv = attendanceMnvStorageKey(rep?.mnv);

  if (repId && (!firebaseId || repId === firebaseId)) {
    emp = lookup?.get(repId) ?? byId?.get(repId);
    if (emp && normalizePayrollMonthRowIdKey(emp.id) === repId) {
      if (!firebaseId || firebaseId === repId) return emp;
    }
  }

  if (repMnv && (!mnv || repMnv === mnv)) {
    emp = lookup?.get(repMnv) ?? byKey?.get(repMnv);
    if (emp && employeeMatchesPayrollMonthRowBinding(emp, rowId)) return emp;
    for (const e of chunk.employees ?? []) {
      if (!employeeMatchesPayrollMonthRowBinding(e, rowId)) continue;
      if (businessEmployeeCode(e) === repMnv) return e;
      if (attendanceMnvStorageKey(e.mnv) === repMnv) return e;
    }
  }

  if (repId && (!firebaseId || repId === firebaseId)) {
    for (const e of chunk.employees ?? []) {
      if (
        String(e.id) === repId &&
        employeeMatchesPayrollMonthRowBinding(e, rowId)
      ) {
        return e;
      }
    }
  }

  if (!firebaseId && mnv) {
    for (const e of chunk.employees ?? []) {
      if (employeeMatchesPayrollMonthRowBinding(e, rowId)) return e;
    }
  }

  return null;
}

export function parsePayrollMonthSortableStt(raw) {
  const n = Number(raw);
  if (Number.isFinite(n)) return n;
  const m = String(raw ?? "").match(/-?\d+(\.\d+)?/);
  if (!m) return Number.POSITIVE_INFINITY;
  const parsed = Number(m[0]);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

/** Thứ tự hiển thị lưới tháng / Excel: BP (A→Z), rồi STT. */
export function comparePayrollMonthRowsByDepartment(aRep, bRep) {
  const aDept =
    normalizePayrollDepartment(aRep?.boPhan).toLocaleLowerCase("vi") || "\uffff";
  const bDept =
    normalizePayrollDepartment(bRep?.boPhan).toLocaleLowerCase("vi") || "\uffff";
  const byDept = aDept.localeCompare(bDept, "vi", { sensitivity: "base" });
  if (byDept !== 0) return byDept;
  return (
    parsePayrollMonthSortableStt(aRep?.stt) -
    parsePayrollMonthSortableStt(bRep?.stt)
  );
}

export function collectPayrollMonthSortedEmployeeIds(dayChunks) {
  const indexes = buildPayrollMonthIdentityIndexes(dayChunks);
  const meta = new Map();
  for (const chunk of dayChunks) {
    for (const emp of chunk.employees) {
      const id = canonicalPayrollMonthRowId(emp, indexes);
      const stt = parsePayrollMonthSortableStt(emp.stt);
      const prev = meta.get(id);
      if (!prev) {
        meta.set(id, {
          sttMin: stt,
          boPhan: String(emp.boPhan ?? ""),
          ngayVaoLam: String(emp.ngayVaoLam ?? "").trim(),
        });
      } else {
        meta.set(id, {
          sttMin: Math.min(prev.sttMin, stt),
          boPhan: prev.boPhan || String(emp.boPhan ?? ""),
          ngayVaoLam: prev.ngayVaoLam || String(emp.ngayVaoLam ?? "").trim(),
        });
      }
    }
  }
  return [...meta.keys()];
}

export function payrollMonthRepresentativeEmployee(dayChunks, rowId) {
  let out = null;
  let bestStt = Number.POSITIVE_INFINITY;
  let bestSttRaw = "";
  const boPhanAll = new Set();
  let latestBoPhan = "";
  let latestBoPhanDateKey = "";
  let latestProfileDateKey = "";

  for (const ch of dayChunks) {
    const binding = payrollMonthRepResolveBinding(rowId, out);
    const e = resolvePayrollMonthDayEmployee(ch, rowId, binding);
    if (!e) continue;

    const dk = String(ch.dateKey ?? "");
    const dept = String(e.boPhan ?? "").trim();
    if (dept) {
      boPhanAll.add(dept);
      if (!latestBoPhanDateKey || dk >= latestBoPhanDateKey) {
        latestBoPhanDateKey = dk;
        latestBoPhan = dept;
      }
    }

    const sttN = parsePayrollMonthSortableStt(e.stt);
    if (sttN < bestStt) {
      bestStt = sttN;
      bestSttRaw = e.stt;
    }

    if (!out) {
      out = stripPayrollMonthRepProfileDates(e);
      latestProfileDateKey = dk;
      continue;
    }

    const preferLatestProfile = Boolean(dk && dk >= latestProfileDateKey);
    if (preferLatestProfile && dk > latestProfileDateKey) {
      latestProfileDateKey = dk;
    }
    out = mergePayrollMonthRepProfileFields(out, e, preferLatestProfile);
  }

  if (out) {
    if (bestSttRaw != null && String(bestSttRaw).trim() !== "") {
      out.stt = bestSttRaw;
    }
    if (latestBoPhan) out.boPhan = latestBoPhan;
    out.boPhanAll = [...boPhanAll];
  }
  return out;
}

function collectPayrollMonthProfileDateCandidates(
  dayChunks,
  monthKeys,
  rowId,
  employeeProfile,
  field,
) {
  const candidates = [];
  const add = (raw) => {
    const s = String(raw ?? "").trim();
    if (s) candidates.push(s);
  };

  const fromProfile = pickPayrollEmployeeProfileDates(employeeProfile);
  add(field === "join" ? fromProfile.joinDate : fromProfile.contractDate);

  for (const dk of monthKeys ?? []) {
    const ch = dayChunks?.get?.(dk);
    if (!ch) continue;
    const emp = resolvePayrollMonthDayEmployee(ch, rowId, employeeProfile);
    if (!emp) continue;
    const dayDates = pickPayrollEmployeeProfileDates(emp);
    add(field === "join" ? dayDates.joinDate : dayDates.contractDate);
  }

  return candidates;
}

function mergePayrollMonthRepProfileDatesFromMaster(out, master) {
  const next = { ...out };
  for (const key of PAYROLL_MONTH_REP_PROFILE_DATE_KEYS) {
    const v = master[key];
    if (v == null || String(v).trim() === "") continue;
    next[key] = v;
  }
  return next;
}

/**
 * Gộp ngày vào làm / ngày HĐ từ rep, danh sách NV master và từng dòng điểm danh trong tháng.
 * Dùng trước `buildMonthlyRuleSummary` — tránh thiếu ngày HĐ khiến khối thử việc = khối tổng.
 */
export function resolvePayrollMonthEmployeeProfileForSummary(
  dayChunks,
  monthKeys,
  rowId,
  employeeProfile = {},
) {
  const joinCandidates = collectPayrollMonthProfileDateCandidates(
    dayChunks,
    monthKeys,
    rowId,
    employeeProfile,
    "join",
  );
  const joinDate = pickBestPayrollJoinDateForMonth(joinCandidates, monthKeys);

  const contractCandidates = collectPayrollMonthProfileDateCandidates(
    dayChunks,
    monthKeys,
    rowId,
    employeeProfile,
    "contract",
  );
  const contractDate = pickBestPayrollContractDateForMonth(
    contractCandidates,
    monthKeys,
    joinDate,
  );

  const next = { ...employeeProfile };
  if (joinDate) {
    next.ngayVaoLam = joinDate;
    next.joinDate = joinDate;
  }
  if (contractDate) {
    next.ngayHopDong = contractDate;
    next.contractDate = contractDate;
  }
  return next;
}

/** Bổ sung ngày vào làm / ngày HĐ từ danh sách NV master (PayrollSalaryCalculator / AttendanceList). */
export function buildPayrollMonthMasterEmployeeLookup(masterEmployees) {
  const byKey = new Map();
  const register = (key, emp) => {
    const k = normalizePayrollMonthRowIdKey(key);
    if (k && emp) byKey.set(k, emp);
  };

  for (const emp of masterEmployees ?? []) {
    register(String(emp?.id ?? ""), emp);
    register(businessEmployeeCode(emp), emp);
    for (const alias of payrollMonthEmployeeRowAliases(emp)) {
      register(alias, emp);
    }
  }
  return byKey;
}

/** Khớp NV master với `rowId` lưới tháng — cùng alias như tra cứu chunk ngày. */
export function resolvePayrollMonthMasterEmployee(rowId, rep, lookup) {
  if (!lookup?.size) return null;

  const { mnv, firebaseId } = parsePayrollMonthRowIdParts(rowId);
  const rowKey = normalizePayrollMonthRowIdKey(rowId);
  const keys = new Set([
    firebaseId,
    mnv,
    rowKey,
    attendanceMnvStorageKey(rep?.mnv ?? rep?.businessId),
    businessEmployeeCode(rep),
    rep?.id != null ? String(rep.id) : "",
  ]);
  for (const alias of payrollMonthEmployeeRowAliases(rep ?? {})) {
    keys.add(alias);
  }

  for (const key of keys) {
    const k = normalizePayrollMonthRowIdKey(key);
    if (!k) continue;
    const hit = lookup.get(k);
    if (hit) return hit;
  }
  return null;
}

export function enrichPayrollMonthRepByIdWithMasterEmployees(
  repById,
  masterEmployees,
) {
  if (!repById?.size) return repById;
  if (!Array.isArray(masterEmployees) || !masterEmployees.length) {
    return repById;
  }

  const lookup = buildPayrollMonthMasterEmployeeLookup(masterEmployees);
  if (!lookup.size) return repById;

  const out = new Map();
  for (const [rowId, rep] of repById) {
    const master = resolvePayrollMonthMasterEmployee(rowId, rep, lookup);
    if (!master) {
      out.set(rowId, rep);
      continue;
    }
    const merged = mergePayrollMonthRepProfileFields(rep, master, true);
    out.set(rowId, mergePayrollMonthRepProfileDatesFromMaster(merged, master));
  }
  return out;
}

function payrollMonthEmployeeDepartmentKeys(emp, normalizeDepartmentFn) {
  const norm = normalizeDepartmentFn ?? normalizePayrollDepartment;
  const keys = new Set();
  const add = (raw) => {
    const k = norm(raw);
    if (k) keys.add(k);
  };
  add(emp?.boPhan);
  for (const d of emp?.boPhanAll ?? []) add(d);
  return keys;
}

export function matchesPayrollMonthRowFilter(
  emp,
  { searchTerm, departmentFilter, departmentFilters, normalizeDepartment },
) {
  const normDept = normalizeDepartment ?? normalizePayrollDepartment;
  const selectedDepartments = Array.isArray(departmentFilters)
    ? departmentFilters.filter(Boolean)
    : departmentFilter
      ? [departmentFilter]
      : [];
  if (selectedDepartments.length) {
    const deptKeys = payrollMonthEmployeeDepartmentKeys(emp, normDept);
    const allowed = new Set(
      selectedDepartments.map((d) => normDept(String(d).trim())),
    );
    let matched = false;
    for (const key of allowed) {
      if (deptKeys.has(key)) {
        matched = true;
        break;
      }
    }
    if (!matched) return false;
  }
  const q = searchTerm.trim().toLowerCase();
  if (!q) return true;
  const mnvText = String(emp.mnv ?? emp.businessId ?? "").toLowerCase();
  const deptText = [emp.boPhan, ...(emp.boPhanAll ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    (emp.hoVaTen || "").toLowerCase().includes(q) ||
    mnvText.includes(q) ||
    deptText.includes(q)
  );
}

export function formatPayrollMonthWeekday3(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
}

/** Gắn cờ quy tắc Korean Timesheet lên chunk ngày (fetch + realtime). */
export function stampPayrollMonthChunkAttendanceRootFlags(
  chunk,
  attendanceRootPath = "attendance",
) {
  if (!chunk) return chunk;
  if (isKoreanAttendanceRoot(attendanceRootPath)) {
    chunk.koreanTimesheetRules = true;
  }
  return chunk;
}

async function fetchPayrollMonthDayChunksFromAggregate(
  monthKey,
  attendanceRootPath,
) {
  const monthlyRoot =
    attendanceRootPath === "koreanAttendance"
      ? "koreanAttendanceMonthly"
      : "attendanceMonthly";
  const snap = await get(ref(db, `${monthlyRoot}/${monthKey}`));
  const raw = snap.val() || {};
  const dateKeys = Object.keys(raw).sort();
  if (!dateKeys.length) return null;
  const chunks = dateKeys.map((dateKey) =>
    stampPayrollMonthChunkAttendanceRootFlags(
      buildPayrollMonthDayChunkFromRaw(raw[dateKey], dateKey),
      attendanceRootPath,
    ),
  );
  applyPayrollMonthCanonicalKeysToChunks(chunks, { mutateFromIndex: 0 });
  return chunks;
}

/**
 * Tải dữ liệu `{attendanceRootPath}/{ngày}` cho cả tháng — batch + retry + abort.
 * @param {string} [hooks.attendanceRootPath="attendance"] — `attendance` hoặc `koreanAttendance`
 */
export async function fetchPayrollMonthDayChunks(monthKeys, hooks = {}) {
  const attendanceRootPath = hooks.attendanceRootPath ?? "attendance";
  const signal = hooks.signal;

  if (USE_MONTHLY_AGGREGATE_NODE && monthKeys?.length && !signal?.aborted) {
    try {
      const monthKey = String(monthKeys[0]).slice(0, 7);
      const fast = await fetchPayrollMonthDayChunksFromAggregate(
        monthKey,
        attendanceRootPath,
      );
      if (fast?.length && !signal?.aborted && !hooks.isStale?.()) {
        return fast;
      }
    } catch {
      /* fallback per-day */
    }
  }

  const allChunks = [];
  const batchSize = hooks.batchSize ?? PAYROLL_MONTH_FETCH_BATCH_SIZE;
  const yieldMs = hooks.yieldMs ?? PAYROLL_MONTH_FETCH_YIELD_MS;

  for (let i = 0; i < monthKeys.length; i += batchSize) {
    if (signal?.aborted || hooks.isStale?.()) return null;
    const batchKeys = monthKeys.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batchKeys.map((dateKey) =>
        fetchOneDayWithRetry(attendanceRootPath, dateKey, { signal }),
      ),
    );
    if (signal?.aborted || hooks.isStale?.()) return null;
    const mutateFromIndex = allChunks.length;
    allChunks.push(...batchResults);
    applyPayrollMonthCanonicalKeysToChunks(allChunks, { mutateFromIndex });
    if (hooks.onAfterBatch) {
      hooks.onAfterBatch(i, monthKeys.length, [...allChunks]);
    }
    if (hooks.onFirstBatch && mutateFromIndex === 0 && batchResults.length) {
      hooks.onFirstBatch([...allChunks]);
    }
    if (i + batchSize < monthKeys.length) {
      await yieldToNextFrame(yieldMs);
    }
  }
  if (signal?.aborted || hooks.isStale?.()) return null;
  applyPayrollMonthCanonicalKeysToChunks(allChunks, { mutateFromIndex: 0 });
  return allChunks;
}

/** Fingerprint theo từng NV — patch 1 ngày không invalidate cache summary NV khác. */
export function computePayrollMonthEmployeeFingerprint(
  chunkByDate,
  monthKeys,
  rowId,
  employeeProfile,
) {
  const resolvedProfile = resolvePayrollMonthEmployeeProfileForSummary(
    chunkByDate,
    monthKeys,
    rowId,
    employeeProfile,
  );
  let h = mixFingerprintHash(0, String(rowId ?? ""));
  for (const dk of monthKeys ?? []) {
    const ch = chunkByDate?.get?.(dk);
    if (!ch || ch.status === "error") {
      h = mixFingerprintHash(h, `${dk}|missing`);
      continue;
    }
    h = mixFingerprintHash(
      h,
      `${ch.isOffDay ? 1 : 0}|${ch.isHolidayDay ? 1 : 0}|${ch.isCompensatoryDay ? 1 : 0}`,
    );
    const emp = resolvePayrollMonthDayEmployee(ch, rowId, resolvedProfile);
    if (!emp) {
      h = mixFingerprintHash(h, `${dk}|empty`);
      continue;
    }
    h = mixFingerprintHash(
      h,
      [
        dk,
        emp.gioVao,
        emp.gioRa,
        emp.loaiPhep,
        emp.caLamViec,
        emp.duocNghiBu,
        emp.tangCaTrua,
        emp.tangCaTaiXePhut,
        emp.payrollEarlyOtPaperwork,
        emp.payrollLateOtExcluded,
        emp.payrollNightOtPaperwork,
      ].join("|"),
    );
  }
  return String(h);
}
