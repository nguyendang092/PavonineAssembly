import { db, ref, get } from "@/services/firebase";
import { buildPayrollMonthDayChunkFromRaw } from "@/features/payroll/buildPayrollDayFromRaw";
import {
  PAYROLL_MONTH_FETCH_BATCH_SIZE,
  PAYROLL_MONTH_FETCH_YIELD_MS,
} from "@/features/payroll/payrollMonthDataScale";
import {
  attendanceMnvStorageKey,
  businessEmployeeCode,
} from "@/utils/attendanceEmployeeRecord";

/** Phân tách MNV và Firebase id khi cùng MNV có nhiều bản ghi. */
export const PAYROLL_MONTH_ROW_ID_SEP = "__";

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
export function applyPayrollMonthCanonicalKeysToChunks(dayChunks) {
  const indexes = buildPayrollMonthIdentityIndexes(dayChunks);
  for (const chunk of dayChunks ?? []) {
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
  return dayChunks;
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

const PAYROLL_MONTH_REP_PROFILE_LATEST_KEYS = [
  "hoVaTen",
  "mnv",
  "businessId",
  "mvt",
  "maBoPhan",
  "ngayVaoLam",
  "ngayHopDong",
];

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
      out = { ...e };
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
  { searchTerm, departmentFilter, normalizeDepartment },
) {
  const normDept = normalizeDepartment ?? normalizePayrollDepartment;
  const departmentFilterKey = normDept(departmentFilter);
  if (departmentFilterKey) {
    const deptKeys = payrollMonthEmployeeDepartmentKeys(emp, normDept);
    if (!deptKeys.has(departmentFilterKey)) return false;
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

/**
 * Tải dữ liệu `attendance/{ngày}` cho cả tháng — batch 4 ngày/lần.
 */
export async function fetchPayrollMonthDayChunks(monthKeys, hooks = {}) {
  const allChunks = [];
  const batchSize =
    hooks.batchSize ?? PAYROLL_MONTH_FETCH_BATCH_SIZE;
  const yieldMs = hooks.yieldMs ?? PAYROLL_MONTH_FETCH_YIELD_MS;

  for (let i = 0; i < monthKeys.length; i += batchSize) {
    if (hooks.isStale?.()) return null;
    const batchKeys = monthKeys.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batchKeys.map(async (dateKey) => {
        const snap = await get(ref(db, `attendance/${dateKey}`));
        return buildPayrollMonthDayChunkFromRaw(snap.val(), dateKey);
      }),
    );
    if (hooks.isStale?.()) return null;
    const validBatch = batchResults.filter(Boolean);
    allChunks.push(...validBatch);
    applyPayrollMonthCanonicalKeysToChunks(allChunks);
    if (hooks.onAfterBatch) {
      hooks.onAfterBatch(i, monthKeys.length, [...allChunks]);
    }
    if (i === 0 && hooks.onFirstBatch) hooks.onFirstBatch([...allChunks]);
    if (yieldMs > 0 || i + batchSize < monthKeys.length) {
      await new Promise((r) => setTimeout(r, yieldMs));
    }
  }
  applyPayrollMonthCanonicalKeysToChunks(allChunks);
  return allChunks;
}
