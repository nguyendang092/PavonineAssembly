import {
  ANNUAL_LEAVE_EMP,
  ANNUAL_LEAVE_META_KEY,
  ANNUAL_LEAVE_RTDB_ROOT,
} from "./fields.mjs";
import { roundAnnualLeaveHours } from "./deduction.mjs";
import {
  buildMonthlyRowFromLeaveAggNode,
  loadLeaveAggEmpNode,
} from "./leaveAgg.mjs";

const ANNUAL_LEAVE_ATTENDANCE_MONTH_START_INDEX = 5;

function parseAnnualLeaveNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const t = String(value).trim();
  if (!t || t === "-") return 0;
  const n = Number(t.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function parseAnnualLeaveAdjustment(value) {
  return roundAnnualLeaveHours(parseAnnualLeaveNumber(value));
}

function resolveStoredMonthlyLeaveUsage(raw) {
  const stored = raw?.[ANNUAL_LEAVE_EMP.MONTHLY_LEAVE_USAGE];
  if (!Array.isArray(stored) || stored.length !== 12) return null;
  return stored.map((value) =>
    roundAnnualLeaveHours(parseAnnualLeaveNumber(value)),
  );
}

function mergeStoredAndAttendanceMonthlyUsage(storedValues, attendanceValues) {
  const monthCount = 12;
  const attendance =
    Array.isArray(attendanceValues) && attendanceValues.length === monthCount
      ? attendanceValues
      : Array(monthCount).fill(0);
  const stored =
    Array.isArray(storedValues) && storedValues.length === monthCount
      ? storedValues
      : null;

  return Array.from({ length: monthCount }, (_, idx) => {
    const source =
      idx >= ANNUAL_LEAVE_ATTENDANCE_MONTH_START_INDEX
        ? attendance[idx]
        : stored != null
          ? stored[idx]
          : attendance[idx];
    return roundAnnualLeaveHours(parseAnnualLeaveNumber(source));
  });
}

function sumAnnualLeaveMonthlyUsageValues(monthValues) {
  if (!Array.isArray(monthValues) || monthValues.length === 0) return null;
  return roundAnnualLeaveHours(
    monthValues.reduce(
      (total, value) => total + parseAnnualLeaveNumber(value),
      0,
    ),
  );
}

function resolveHrAnnualLeaveUsed(raw) {
  if (!raw || typeof raw !== "object") return 0;
  if (raw[ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED] != null) {
    return parseAnnualLeaveNumber(raw[ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED]);
  }
  if (raw[ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED] != null) {
    const storedUsed = parseAnnualLeaveNumber(
      raw[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED],
    );
    const storedAttendance = parseAnnualLeaveNumber(
      raw[ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED],
    );
    return roundAnnualLeaveHours(storedUsed - storedAttendance);
  }
  return 0;
}

function resolveAnnualLeaveCurrentYear(row, year) {
  const adjustment = parseAnnualLeaveAdjustment(
    row?.[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_ADJUSTMENT],
  );
  const stored = parseAnnualLeaveNumber(
    row?.[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR],
  );
  return roundAnnualLeaveHours(stored + adjustment);
}

function computeAnnualLeaveTotals(row, year) {
  const annual = resolveAnnualLeaveCurrentYear(row, year);
  const bonus = parseAnnualLeaveNumber(
    row[ANNUAL_LEAVE_EMP.BONUS_ANNUAL_LEAVE_ENV],
  );
  const comp = parseAnnualLeaveNumber(
    row[ANNUAL_LEAVE_EMP.COMPENSATORY_DAY_OFF],
  );
  const hasSplitUsed =
    row[ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED] != null ||
    row[ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED] != null;
  const used = hasSplitUsed
    ? roundAnnualLeaveHours(
        parseAnnualLeaveNumber(row[ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED]) +
          parseAnnualLeaveNumber(
            row[ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED],
          ),
      )
    : parseAnnualLeaveNumber(row[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]);
  const total = roundAnnualLeaveHours(annual + bonus + comp);
  const balance = roundAnnualLeaveHours(total - used);
  return {
    [ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE]: total,
    [ANNUAL_LEAVE_EMP.BALANCE]: balance,
  };
}

function computeLiveAnnualLeaveState(raw, liveAttendanceUsed, year, {
  usedFromMonthlySum = null,
} = {}) {
  const hrUsed = resolveHrAnnualLeaveUsed(raw);
  const attendanceUsed =
    usedFromMonthlySum != null
      ? roundAnnualLeaveHours(usedFromMonthlySum)
      : roundAnnualLeaveHours(liveAttendanceUsed);
  const used =
    usedFromMonthlySum != null
      ? roundAnnualLeaveHours(usedFromMonthlySum)
      : roundAnnualLeaveHours(hrUsed + attendanceUsed);
  const hrUsedForTotals = usedFromMonthlySum != null ? 0 : hrUsed;

  const totals = computeAnnualLeaveTotals(
    {
      ...raw,
      [ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED]: hrUsedForTotals,
      [ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED]: attendanceUsed,
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: used,
    },
    year,
  );

  return {
    hrUsed: hrUsedForTotals,
    attendanceUsed,
    used,
    totalAnnualLeave: totals[ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE],
    balance: totals[ANNUAL_LEAVE_EMP.BALANCE],
    annualLeaveCurrentYear: resolveAnnualLeaveCurrentYear(raw, year),
  };
}

function computePersistStateForRaw(raw, year, attendanceMonthly) {
  const storedMonthly = resolveStoredMonthlyLeaveUsage(raw);
  const monthValues = mergeStoredAndAttendanceMonthlyUsage(
    storedMonthly,
    attendanceMonthly,
  );
  const monthlySum = sumAnnualLeaveMonthlyUsageValues(monthValues);
  const hasStored = storedMonthly != null;
  const hasAttendanceMonthly = Array.isArray(attendanceMonthly);
  const usedFromMonthlySum =
    hasStored || hasAttendanceMonthly ? monthlySum : null;
  const persistMonthValues =
    hasAttendanceMonthly && monthValues.length === 12 ? monthValues : null;

  return {
    state: computeLiveAnnualLeaveState(raw, 0, year, { usedFromMonthlySum }),
    monthValues: persistMonthValues,
  };
}

function needsPersistUpdate(raw, state, { monthValues = null } = {}) {
  const prevUsed = parseAnnualLeaveNumber(
    raw[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED],
  );
  const prevAttendance = parseAnnualLeaveNumber(
    raw[ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED],
  );
  const prevHr = parseAnnualLeaveNumber(
    raw[ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED],
  );
  const prevBalance = parseAnnualLeaveNumber(raw[ANNUAL_LEAVE_EMP.BALANCE]);
  const prevTotal = parseAnnualLeaveNumber(
    raw[ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE],
  );

  if (Array.isArray(monthValues) && monthValues.length === 12) {
    const prevMonthly = resolveStoredMonthlyLeaveUsage(raw);
    const nextMonthly = monthValues.map((value) =>
      roundAnnualLeaveHours(parseAnnualLeaveNumber(value)),
    );
    if (
      !prevMonthly ||
      nextMonthly.some((value, index) => value !== prevMonthly[index])
    ) {
      return true;
    }
  }

  return (
    state.used !== prevUsed ||
    state.attendanceUsed !== prevAttendance ||
    state.hrUsed !== prevHr ||
    state.balance !== prevBalance ||
    state.totalAnnualLeave !== prevTotal ||
    raw[ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED] == null
  );
}

function buildPersistPayload(empKey, raw, state, { monthValues = null } = {}) {
  const payload = {
    id: empKey,
    [ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED]: state.hrUsed,
    [ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED]: state.attendanceUsed,
    [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: state.used,
    [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: state.annualLeaveCurrentYear,
    [ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE]: state.totalAnnualLeave,
    [ANNUAL_LEAVE_EMP.BALANCE]: state.balance,
  };

  if (Array.isArray(monthValues) && monthValues.length === 12) {
    payload[ANNUAL_LEAVE_EMP.MONTHLY_LEAVE_USAGE] = monthValues.map((value) =>
      roundAnnualLeaveHours(parseAnnualLeaveNumber(value)),
    );
  }

  return payload;
}

async function touchAnnualLeaveYearMeta(db, year) {
  const metaRef = db.ref(
    `${ANNUAL_LEAVE_RTDB_ROOT}/${year}/${ANNUAL_LEAVE_META_KEY}`,
  );
  const snap = await metaRef.get();
  if (!snap.exists()) return;
  await metaRef.update({
    updatedAt: new Date().toISOString(),
    updatedBy: "cloud-function",
  });
}

/**
 * Đọc aggregate + tính lại phép năm 1 NV — ghi bằng transaction.
 */
export async function persistAnnualLeaveEmployeeFromAgg(db, { year, empKey }) {
  const empRef = db.ref(`${ANNUAL_LEAVE_RTDB_ROOT}/${year}/${empKey}`);
  const rawSnap = await empRef.get();
  const raw = rawSnap.val();
  if (!raw || typeof raw !== "object") {
    return { applied: false, reason: "no_annual_leave_record" };
  }

  const aggNode = await loadLeaveAggEmpNode(db, year, empKey);
  const attendanceMonthly = buildMonthlyRowFromLeaveAggNode(aggNode);
  const { state, monthValues } = computePersistStateForRaw(
    raw,
    year,
    attendanceMonthly,
  );

  if (!needsPersistUpdate(raw, state, { monthValues })) {
    return { applied: false, reason: "no_change" };
  }

  const payload = buildPersistPayload(empKey, raw, state, { monthValues });
  const tx = await empRef.transaction((current) => {
    if (!current || typeof current !== "object") return undefined;
    const next = computePersistStateForRaw(current, year, attendanceMonthly);
    if (!needsPersistUpdate(current, next.state, { monthValues: next.monthValues })) {
      return undefined;
    }
    return {
      ...current,
      ...buildPersistPayload(empKey, current, next.state, {
        monthValues: next.monthValues,
      }),
    };
  });

  if (tx.committed) {
    await touchAnnualLeaveYearMeta(db, year);
  }

  return { applied: tx.committed, state: payload };
}

export { computePersistStateForRaw, needsPersistUpdate, buildPersistPayload };
