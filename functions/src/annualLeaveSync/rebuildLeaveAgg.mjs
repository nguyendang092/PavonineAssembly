import {
  ATTENDANCE_LEAVE_AGG_EMP,
  ATTENDANCE_LEAVE_AGG_ROOT,
} from "./fields.mjs";
import { roundAnnualLeaveHours } from "./deduction.mjs";
import { buildAttendanceAnnualLeaveDerivedMaps } from "./attendanceDerivedMaps.mjs";
import {
  buildAttendanceAnnualLeaveUsageDetailByEmpKey,
  serializeAnnualLeaveUsageDetailForLeaveAgg,
} from "./usageDetail.mjs";

function normalizeLeaveAggMonthMap(rawMap) {
  if (!rawMap || typeof rawMap !== "object") return {};
  const out = {};
  for (const [monthKey, value] of Object.entries(rawMap)) {
    if (!/^(0[1-9]|1[0-2])$/.test(monthKey)) continue;
    const rounded = roundAnnualLeaveHours(Number(value ?? 0));
    if (rounded === 0) continue;
    out[monthKey] = rounded;
  }
  return out;
}

function buildLeaveAggEmpNode(monthMap, updatedBy = "cloud-function", usageDetail = null) {
  const deductionByMonth = normalizeLeaveAggMonthMap(monthMap);
  if (!Object.keys(deductionByMonth).length && !usageDetail) return null;

  const node = {
    [ATTENDANCE_LEAVE_AGG_EMP.DEDUCTION_BY_MONTH]: deductionByMonth,
    [ATTENDANCE_LEAVE_AGG_EMP.LAST_UPDATED]: new Date().toISOString(),
    [ATTENDANCE_LEAVE_AGG_EMP.UPDATED_BY]: updatedBy,
  };

  const serializedDetail = serializeAnnualLeaveUsageDetailForLeaveAgg(usageDetail);
  if (serializedDetail) {
    node[ATTENDANCE_LEAVE_AGG_EMP.USAGE_DETAIL] = serializedDetail;
  }

  return node;
}

export async function loadAttendanceForYear(db, year, attendanceRoot = "attendance") {
  const snap = await db
    .ref(attendanceRoot)
    .orderByKey()
    .startAt(`${year}-01-01`)
    .endAt(`${year}-12-31\uf8ff`)
    .get();
  return snap.val();
}

/** Quét attendance một lần — ghi đè `attendanceLeaveAgg/{year}`. */
export async function rebuildLeaveAggYearFromAttendance(
  db,
  { year, attendanceRootData, updatedBy = "cloud-function" },
) {
  const { attendanceMonthlyByEmpKey } = buildAttendanceAnnualLeaveDerivedMaps(
    attendanceRootData,
    year,
  );
  const usageDetailByEmpKey = buildAttendanceAnnualLeaveUsageDetailByEmpKey(
    attendanceRootData,
    year,
  );

  const payload = {};
  for (const [empKey, monthRow] of Object.entries(attendanceMonthlyByEmpKey)) {
    const monthMap = {};
    monthRow.forEach((value, index) => {
      const rounded = roundAnnualLeaveHours(Number(value ?? 0));
      if (rounded === 0) return;
      monthMap[String(index + 1).padStart(2, "0")] = rounded;
    });

    const node = buildLeaveAggEmpNode(
      monthMap,
      updatedBy,
      usageDetailByEmpKey[empKey] ?? null,
    );
    if (node) payload[empKey] = node;
  }

  await db.ref(`${ATTENDANCE_LEAVE_AGG_ROOT}/${year}`).set(payload);
  return { employeeCount: Object.keys(payload).length };
}
