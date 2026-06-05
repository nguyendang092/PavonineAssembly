import { getAttendanceSortSttValue } from "./attendanceSeasonalStt";

/** Sắp xếp ổn định theo STT — dùng chung AttendanceList / Firebase reconcile. */
export function sortEmployeesStableAsc(rows, options = {}) {
  const seasonal = options.seasonal === true;
  return [...rows].sort((a, b) => {
    const aStt = getAttendanceSortSttValue(a, seasonal);
    const bStt = getAttendanceSortSttValue(b, seasonal);
    const aSttNorm = aStt > 0 ? aStt : Number.POSITIVE_INFINITY;
    const bSttNorm = bStt > 0 ? bStt : Number.POSITIVE_INFINITY;
    return aSttNorm - bSttNorm;
  });
}
