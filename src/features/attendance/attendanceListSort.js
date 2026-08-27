import { getAttendanceSortSttValue } from "./attendanceSeasonalStt";

function compareEmployeesByStt(a, b, seasonal) {
  const aStt = getAttendanceSortSttValue(a, seasonal);
  const bStt = getAttendanceSortSttValue(b, seasonal);
  const aSttNorm = aStt > 0 ? aStt : Number.POSITIVE_INFINITY;
  const bSttNorm = bStt > 0 ? bStt : Number.POSITIVE_INFINITY;
  return aSttNorm - bSttNorm;
}

/** Sắp xếp ổn định theo STT — dùng chung AttendanceList / Firebase reconcile. */
export function sortEmployeesStableAsc(rows, options = {}) {
  const seasonal = options.seasonal === true;
  return [...rows].sort((a, b) => compareEmployeesByStt(a, b, seasonal));
}

/** Sau bộ lọc nâng cao: nhóm theo bộ phận A→Z, cùng bộ phận giữ thứ tự STT. */
export function sortEmployeesByDepartmentAsc(rows, options = {}) {
  const seasonal = options.seasonal === true;
  const locale = options.locale || "vi";
  const collator = new Intl.Collator(locale, {
    sensitivity: "base",
    numeric: true,
  });

  return [...rows].sort((a, b) => {
    const aDept = String(a.boPhan || "").trim();
    const bDept = String(b.boPhan || "").trim();
    if (!aDept && bDept) return 1;
    if (aDept && !bDept) return -1;

    const byDept = collator.compare(aDept, bDept);
    if (byDept !== 0) return byDept;

    return compareEmployeesByStt(a, b, seasonal);
  });
}
