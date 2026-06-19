import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";

export function parseAnnualLeaveNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const t = String(value).trim();
  if (!t || t === "-") return 0;
  const n = Number(t.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function roundAnnualLeaveHours(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100 + 1e-9) / 100;
}

/** Tổng phép & tồn — luôn tính lại khi import / hiển thị. */
export function computeAnnualLeaveTotals(row) {
  const annual = parseAnnualLeaveNumber(
    row[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR],
  );
  const bonus = parseAnnualLeaveNumber(
    row[ANNUAL_LEAVE_EMP.BONUS_ANNUAL_LEAVE_ENV],
  );
  const comp = parseAnnualLeaveNumber(
    row[ANNUAL_LEAVE_EMP.COMPENSATORY_DAY_OFF],
  );
  const used = parseAnnualLeaveNumber(row[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]);
  const total = roundAnnualLeaveHours(annual + bonus + comp);
  const balance = roundAnnualLeaveHours(total - used);
  return {
    [ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE]: total,
    [ANNUAL_LEAVE_EMP.BALANCE]: balance,
  };
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** ISO `yyyy-mm-dd` → hiển thị như Excel (vd. 20-Aug-88). */
export function formatAnnualLeaveDisplayDate(iso, { fullYear = false } = {}) {
  if (!iso || typeof iso !== "string") return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const y = Number(m[1]);
  const mon = Number(m[2]);
  const d = Number(m[3]);
  if (!y || !mon || !d) return iso;
  const label = MONTH_LABELS[mon - 1] ?? m[2];
  const yy = fullYear ? String(y) : String(y).slice(-2).padStart(2, "0");
  return `${d}-${label}-${yy}`;
}

export function formatAnnualLeaveDecimal(value) {
  const n = roundAnnualLeaveHours(value);
  return n.toFixed(2);
}
