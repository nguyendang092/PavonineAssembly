import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import { indexAnnualLeaveYearByEmpKey } from "./annualLeaveEmpKey";

/** Dòng nhẹ cho lọc / phân trang — chưa tính balance live. */
export function buildAnnualLeaveManagerEntry(empKey, raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    id: empKey,
    rowNo: raw.rowNo,
    [ANNUAL_LEAVE_EMP.MNV_PREFIX]: raw[ANNUAL_LEAVE_EMP.MNV_PREFIX],
    [ANNUAL_LEAVE_EMP.MNV_SUFFIX]: raw[ANNUAL_LEAVE_EMP.MNV_SUFFIX],
    [ANNUAL_LEAVE_EMP.FULL_NAME]: raw[ANNUAL_LEAVE_EMP.FULL_NAME],
    [ANNUAL_LEAVE_EMP.SUB_DEPARTMENT]: raw[ANNUAL_LEAVE_EMP.SUB_DEPARTMENT],
    _raw: raw,
  };
}

export function buildAnnualLeaveManagerEntriesFromYearData(yearData) {
  return buildAnnualLeaveManagerRowCatalog(yearData).entries;
}

/** Một lần quét yearData → entries + dept index + danh sách bộ phận. */
export function buildAnnualLeaveManagerRowCatalog(yearData) {
  if (!yearData || typeof yearData !== "object") {
    return {
      entries: [],
      deptIndex: new Map(),
      departments: [],
    };
  }

  const indexed = indexAnnualLeaveYearByEmpKey(yearData);
  const entries = [];
  const deptIndex = new Map();
  const deptSet = new Set();

  for (const [empKey, { raw }] of Object.entries(indexed)) {
    const entry = buildAnnualLeaveManagerEntry(empKey, raw);
    if (!entry) continue;
    entries.push(entry);

    const dept = String(entry[ANNUAL_LEAVE_EMP.SUB_DEPARTMENT] ?? "");
    if (dept) deptSet.add(dept);
    if (!deptIndex.has(dept)) deptIndex.set(dept, []);
    deptIndex.get(dept).push(entry);
  }

  entries.sort((a, b) => {
    const na = Number(a.rowNo);
    const nb = Number(b.rowNo);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return String(a.rowNo ?? "").localeCompare(String(b.rowNo ?? ""), undefined, {
      numeric: true,
    });
  });

  return {
    entries,
    deptIndex,
    departments: Array.from(deptSet).sort(),
  };
}

/** Danh sách bộ phận từ Firebase — không phụ thuộc điểm danh live. */
export function listAnnualLeaveManagerDepartmentsFromYearData(yearData) {
  return buildAnnualLeaveManagerRowCatalog(yearData).departments;
}

export function buildAnnualLeaveManagerEntries(yearData) {
  return buildAnnualLeaveManagerEntriesFromYearData(yearData);
}

function matchesAnnualLeaveManagerSearch(entry, q) {
  const name = String(entry[ANNUAL_LEAVE_EMP.FULL_NAME] ?? "").toLowerCase();
  const mnv = String(entry[ANNUAL_LEAVE_EMP.MNV_PREFIX] ?? "").trim();
  return name.includes(q) || mnv.includes(q);
}

/** Lọc nhanh theo MNV / họ tên / bộ phận — dùng cho bảng phép năm. */
export function filterAnnualLeaveManagerRows(
  rows,
  { search = "", deptFilter = "" } = {},
  deptIndex = null,
) {
  if (!rows?.length) return [];
  const q = String(search ?? "")
    .trim()
    .toLowerCase();
  const dept = String(deptFilter ?? "");
  if (!q && !dept) return rows;

  const base =
    dept && deptIndex?.has(dept) ? deptIndex.get(dept) : dept ? [] : rows;

  if (!q) {
    if (dept && !deptIndex?.has(dept)) {
      return rows.filter(
        (row) => row[ANNUAL_LEAVE_EMP.SUB_DEPARTMENT] === dept,
      );
    }
    return base;
  }

  if (dept && deptIndex?.has(dept)) {
    return base.filter((entry) => matchesAnnualLeaveManagerSearch(entry, q));
  }

  return rows.filter((row) => {
    if (dept && row[ANNUAL_LEAVE_EMP.SUB_DEPARTMENT] !== dept) return false;
    return matchesAnnualLeaveManagerSearch(row, q);
  });
}

export function filterAnnualLeaveManagerEntries(
  entries,
  filters = {},
  deptIndex = null,
) {
  return filterAnnualLeaveManagerRows(entries, filters, deptIndex);
}

/** Danh sách bộ phận duy nhất — tính một lần khi `rows` đổi. */
export function listAnnualLeaveManagerDepartments(rows) {
  const set = new Set();
  for (const row of rows ?? []) {
    const dept = row?.[ANNUAL_LEAVE_EMP.SUB_DEPARTMENT];
    if (dept) set.add(String(dept));
  }
  return Array.from(set).sort();
}
