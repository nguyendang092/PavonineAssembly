import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import {
  indexAnnualLeaveYearByEmpKey,
  resolveAnnualLeaveEmpFirebaseKey,
} from "./annualLeaveEmpKey";
import {
  computeAnnualLeaveTotals,
  listAnnualLeaveCalendarYearMonths,
  parseAnnualLeaveNumber,
  resolveAnnualLeaveCurrentYear,
  roundAnnualLeaveHours,
} from "./annualLeaveCalculated";

/** Chỉ số tháng (0 = Jan) — từ tháng 6 trở đi lấy phép từ điểm danh. */
export const ANNUAL_LEAVE_ATTENDANCE_MONTH_START_INDEX = 5;

/** Phép đã dùng trong tháng (kể cả tháng thử nghiệm chỉ hiển thị). */
export function resolveAnnualLeaveMonthUsageValue(monthDetail) {
  if (!monthDetail) return 0;
  const deduction = monthDetail.totalDeduction ?? 0;
  if (deduction > 0) return deduction;
  const visual =
    (monthDetail.pnCount ?? 0) + (monthDetail.halfPnCount ?? 0) * 0.5;
  return visual > 0 ? roundAnnualLeaveHours(visual) : 0;
}

export function buildAttendanceMonthlyValuesFromUsageDetail(detail, yearMonths) {
  const monthMap = {};
  const list = Array.isArray(detail?.months)
    ? detail.months
    : Object.values(detail?.months ?? {});
  for (const month of list) {
    if (month?.yearMonth) monthMap[month.yearMonth] = month;
  }
  return yearMonths.map((yearMonth) =>
    resolveAnnualLeaveMonthUsageValue(monthMap[yearMonth]),
  );
}

/** Jan–May: Excel/Firebase; từ Jun: điểm danh (fallback điểm danh nếu chưa có Excel). */
export function mergeStoredAndAttendanceMonthlyUsage(
  storedValues,
  attendanceValues,
  attendanceFromMonthIndex = ANNUAL_LEAVE_ATTENDANCE_MONTH_START_INDEX,
) {
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
      idx >= attendanceFromMonthIndex
        ? attendance[idx]
        : stored != null
          ? stored[idx]
          : attendance[idx];
    return roundAnnualLeaveHours(parseAnnualLeaveNumber(source));
  });
}

export function resolveEffectiveMonthlyLeaveUsage(
  raw,
  usageDetail,
  year,
  attendanceMonthly = null,
) {
  const yearMonths = listAnnualLeaveCalendarYearMonths(year);
  const stored = resolveStoredMonthlyLeaveUsage(raw);
  const attendance =
    attendanceMonthly ??
    buildAttendanceMonthlyValuesFromUsageDetail(usageDetail, yearMonths);
  return mergeStoredAndAttendanceMonthlyUsage(stored, attendance);
}

/** Map `emp_{mnv}` → mảng 12 giá trị phép theo tháng (Jan→Dec). */
export function buildAnnualLeaveMonthlyUsageByEmpKey(
  year,
  storedMonthlyByEmpKey = {},
  attendanceMonthlyByEmpKey = {},
  usageDetailByEmpKey = {},
) {
  const yearMonths = listAnnualLeaveCalendarYearMonths(year);
  const monthlyByEmpKey = {};

  const allEmpKeys = new Set([
    ...Object.keys(storedMonthlyByEmpKey ?? {}),
    ...Object.keys(attendanceMonthlyByEmpKey ?? {}),
    ...Object.keys(usageDetailByEmpKey ?? {}),
  ]);

  for (const empKey of allEmpKeys) {
    const stored = storedMonthlyByEmpKey?.[empKey] ?? null;
    const attendance =
      attendanceMonthlyByEmpKey?.[empKey] ??
      buildAttendanceMonthlyValuesFromUsageDetail(
        usageDetailByEmpKey?.[empKey],
        yearMonths,
      );
    monthlyByEmpKey[empKey] = mergeStoredAndAttendanceMonthlyUsage(
      stored,
      attendance,
    );
  }

  return { yearMonths, monthlyByEmpKey };
}

export function resolveStoredMonthlyLeaveUsage(raw) {
  const stored = raw?.[ANNUAL_LEAVE_EMP.MONTHLY_LEAVE_USAGE];
  if (!Array.isArray(stored) || stored.length !== 12) return null;
  return stored.map((value) => roundAnnualLeaveHours(parseAnnualLeaveNumber(value)));
}

/** Map `emp_{mnv}` → mảng 12 phép/tháng từ Firebase (nếu có). */
export function buildStoredMonthlyLeaveUsageByEmpKey(yearData) {
  const map = {};
  if (!yearData || typeof yearData !== "object") return map;

  const indexed = indexAnnualLeaveYearByEmpKey(yearData);
  for (const [empKey, { raw }] of Object.entries(indexed)) {
    const values = resolveStoredMonthlyLeaveUsage(raw);
    if (values) map[empKey] = values;
  }
  return map;
}

/** Tổng phép đã dùng từ 12 cột tháng (Jan→Dec). */
export function sumAnnualLeaveMonthlyUsageValues(monthValues) {
  if (!Array.isArray(monthValues) || monthValues.length === 0) return null;
  return roundAnnualLeaveHours(
    monthValues.reduce(
      (total, value) => total + parseAnnualLeaveNumber(value),
      0,
    ),
  );
}

/**
 * Phép đã dùng do HR (Excel) — không bao gồm PN từ điểm danh.
 * Không suy từ `annualLeaveUsed` − live attendance (dễ lệch khi dữ liệu cũ / theo tháng).
 */
export function resolveHrAnnualLeaveUsed(raw) {
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
    return roundAnnualLeaveHours(Math.max(0, storedUsed - storedAttendance));
  }

  return 0;
}

/**
 * Trạng thái phép năm sau khi tính — dùng cho hiển thị và ghi Firebase.
 * `liveAttendanceUsed` = tổng PN/1/2PN quét từ điểm danh cả năm.
 */
export function computeLiveAnnualLeaveState(
  raw,
  liveAttendanceUsed = 0,
  year = null,
  { usedFromMonthlySum = null } = {},
) {
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
    annualLeaveCurrentYear:
      year != null
        ? resolveAnnualLeaveCurrentYear(raw, year)
        : parseAnnualLeaveNumber(raw[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]),
  };
}

function assignBalanceEmpKey(map, empKey, balance) {
  if (!empKey) return;
  map[empKey] = balance;
}

/**
 * Map `emp_{mnv}` → BALANCE tính live (HR + quét điểm danh).
 */
export function buildLiveAnnualLeaveBalanceByMnv(
  yearData,
  deductionsByEmpKey = {},
  year = null,
  usageDetailByEmpKey = {},
  attendanceMonthlyByEmpKey = {},
) {
  const map = {};
  if (!yearData || typeof yearData !== "object") return map;

  const indexed = indexAnnualLeaveYearByEmpKey(yearData);
  for (const [empKey, { raw }] of Object.entries(indexed)) {
    const storedMonthly = resolveStoredMonthlyLeaveUsage(raw);
    const monthValues = resolveEffectiveMonthlyLeaveUsage(
      raw,
      usageDetailByEmpKey[empKey],
      year,
      attendanceMonthlyByEmpKey[empKey],
    );
    const monthlySum = sumAnnualLeaveMonthlyUsageValues(monthValues);
    const hasStored = storedMonthly != null;
    const hasAttendanceMonthly = attendanceMonthlyByEmpKey[empKey] != null;
    const hasUsageDetail = usageDetailByEmpKey[empKey] != null;
    const usedFromMonthlySum =
      hasStored || hasAttendanceMonthly || hasUsageDetail ? monthlySum : null;
    const liveAtt =
      usedFromMonthlySum ?? (deductionsByEmpKey[empKey] ?? 0);
    const { balance } = computeLiveAnnualLeaveState(raw, liveAtt, year, {
      usedFromMonthlySum,
    });
    assignBalanceEmpKey(map, empKey, balance);
  }

  return map;
}

/** Chuẩn hóa một dòng cho UI — khóa `emp_{mnv}`. */
export function normalizeAnnualLeaveRowLive(
  id,
  raw,
  deductionsByEmpKey = {},
  year = null,
  monthValues = null,
) {
  if (!raw || typeof raw !== "object") return null;
  const empKey =
    resolveAnnualLeaveEmpFirebaseKey({ recordId: id, raw }) || id;
  const liveAtt = deductionsByEmpKey[empKey] ?? 0;
  const resolvedMonthValues =
    monthValues ?? resolveStoredMonthlyLeaveUsage(raw);
  const monthlyUsed = sumAnnualLeaveMonthlyUsageValues(resolvedMonthValues);
  const state = computeLiveAnnualLeaveState(raw, liveAtt, year, {
    usedFromMonthlySum: monthlyUsed,
  });

  return {
    id: empKey,
    ...raw,
    annualLeaveCurrentYearBase: parseAnnualLeaveNumber(
      raw[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR],
    ),
    [ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED]: state.hrUsed,
    [ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED]: state.attendanceUsed,
    [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: state.used,
    [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: state.annualLeaveCurrentYear,
    [ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE]: state.totalAnnualLeave,
    [ANNUAL_LEAVE_EMP.BALANCE]: state.balance,
  };
}
