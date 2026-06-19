import { attendanceMnvStorageKey } from "@/utils/attendanceEmployeeRecord";
import {
  ANNUAL_LEAVE_EMP,
  ANNUAL_LEAVE_META_KEY,
} from "./annualLeaveFields";
import { computeAnnualLeaveTotals } from "./annualLeaveCalculated";

function trimPart(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function assignBalanceKey(map, rawKey, balance) {
  const key = attendanceMnvStorageKey(rawKey);
  if (!key) return;
  map[key] = balance;
  const lower = key.toLowerCase();
  if (lower !== key) map[lower] = balance;
}

/**
 * Map MNV chuẩn → số dư phép năm (BALANCE) từ snapshot `annualLeave/{year}`.
 * Index theo: ghép prefix+suffix (EMPL CODE), prefix/suffix đơn (nếu thiếu phần kia), và Firebase id.
 */
export function buildAnnualLeaveBalanceByMnv(yearData) {
  const map = {};
  if (!yearData || typeof yearData !== "object") return map;

  for (const [id, raw] of Object.entries(yearData)) {
    if (id === ANNUAL_LEAVE_META_KEY || !raw || typeof raw !== "object") continue;

    const prefix = trimPart(raw[ANNUAL_LEAVE_EMP.MNV_PREFIX]);
    const suffix = trimPart(raw[ANNUAL_LEAVE_EMP.MNV_SUFFIX]);
    const combined = `${prefix}${suffix}`;
    if (!combined && !id) continue;

    const totals = computeAnnualLeaveTotals(raw);
    const balance = totals[ANNUAL_LEAVE_EMP.BALANCE];

    if (combined) assignBalanceKey(map, combined, balance);
    if (prefix && !suffix) assignBalanceKey(map, prefix, balance);
    if (suffix && !prefix) assignBalanceKey(map, suffix, balance);
    if (id) map[id] = balance;
  }

  return map;
}

/**
 * Tra BALANCE theo dòng điểm danh — thử ghép MNV+MVT, MNV, MVT, và khóa Firebase `emp_*`.
 */
export function getAnnualLeaveBalanceForEmployee(emp, balanceByMnv) {
  if (!balanceByMnv || !emp) return null;

  const recordId = trimPart(emp.id);
  if (recordId && balanceByMnv[recordId] != null) {
    return balanceByMnv[recordId];
  }

  const mnv = trimPart(emp.mnv);
  const mvt = trimPart(emp.mvt);
  const candidates = [
    attendanceMnvStorageKey(`${mnv}${mvt}`),
    attendanceMnvStorageKey(mnv),
    attendanceMnvStorageKey(mvt),
  ];

  for (const key of candidates) {
    if (!key) continue;
    const balance = balanceByMnv[key] ?? balanceByMnv[key.toLowerCase()];
    if (balance != null && balance !== undefined) return balance;
  }

  return null;
}

/** @deprecated Prefer `getAnnualLeaveBalanceForEmployee` when `mvt` is available. */
export function getAnnualLeaveBalanceForMnv(mnv, balanceByMnv, mvt = "") {
  return getAnnualLeaveBalanceForEmployee({ mnv, mvt }, balanceByMnv);
}

export function annualLeaveYearFromDateKey(dateKey) {
  if (!dateKey || typeof dateKey !== "string") return new Date().getFullYear();
  const y = Number(dateKey.slice(0, 4));
  return Number.isFinite(y) ? y : new Date().getFullYear();
}
