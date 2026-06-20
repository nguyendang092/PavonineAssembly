import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import {
  indexAnnualLeaveYearByEmpKey,
  resolveAnnualLeaveEmpFirebaseKey,
} from "./annualLeaveEmpKey";
import {
  computeAnnualLeaveTotals,
  parseAnnualLeaveNumber,
  roundAnnualLeaveHours,
} from "./annualLeaveCalculated";

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
export function computeLiveAnnualLeaveState(raw, liveAttendanceUsed = 0) {
  const attendanceUsed = roundAnnualLeaveHours(liveAttendanceUsed);
  const hrUsed = resolveHrAnnualLeaveUsed(raw);
  const used = roundAnnualLeaveHours(hrUsed + attendanceUsed);

  const totals = computeAnnualLeaveTotals({
    ...raw,
    [ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED]: hrUsed,
    [ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED]: attendanceUsed,
    [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: used,
  });

  return {
    hrUsed,
    attendanceUsed,
    used,
    totalAnnualLeave: totals[ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE],
    balance: totals[ANNUAL_LEAVE_EMP.BALANCE],
  };
}

function assignBalanceEmpKey(map, empKey, balance) {
  if (!empKey) return;
  map[empKey] = balance;
}

/**
 * Map `emp_{mnv}` → BALANCE tính live (HR + quét điểm danh).
 */
export function buildLiveAnnualLeaveBalanceByMnv(yearData, deductionsByEmpKey = {}) {
  const map = {};
  if (!yearData || typeof yearData !== "object") return map;

  const indexed = indexAnnualLeaveYearByEmpKey(yearData);
  for (const [empKey, { raw }] of Object.entries(indexed)) {
    const liveAtt = deductionsByEmpKey[empKey] ?? 0;
    const { balance } = computeLiveAnnualLeaveState(raw, liveAtt);
    assignBalanceEmpKey(map, empKey, balance);
  }

  return map;
}

/** Chuẩn hóa một dòng cho UI — khóa `emp_{mnv}`. */
export function normalizeAnnualLeaveRowLive(id, raw, deductionsByEmpKey = {}) {
  if (!raw || typeof raw !== "object") return null;
  const empKey =
    resolveAnnualLeaveEmpFirebaseKey({ recordId: id, raw }) || id;
  const liveAtt = deductionsByEmpKey[empKey] ?? 0;
  const state = computeLiveAnnualLeaveState(raw, liveAtt);

  return {
    id: empKey,
    ...raw,
    [ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED]: state.hrUsed,
    [ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED]: state.attendanceUsed,
    [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: state.used,
    [ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE]: state.totalAnnualLeave,
    [ANNUAL_LEAVE_EMP.BALANCE]: state.balance,
  };
}
