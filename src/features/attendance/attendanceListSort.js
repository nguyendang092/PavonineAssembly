/** Sắp xếp ổn định theo STT — dùng chung AttendanceList / Firebase reconcile. */
export function sortEmployeesStableAsc(rows) {
  return [...rows].sort((a, b) => {
    const aStt = Number(a?.stt);
    const bStt = Number(b?.stt);
    const aSttNorm = Number.isFinite(aStt) ? aStt : Number.POSITIVE_INFINITY;
    const bSttNorm = Number.isFinite(bStt) ? bStt : Number.POSITIVE_INFINITY;
    return aSttNorm - bSttNorm;
  });
}
