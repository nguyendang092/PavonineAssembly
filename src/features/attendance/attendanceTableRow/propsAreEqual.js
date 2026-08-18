export function propsAreEqual(prev, next) {
  return (
    prev.emp === next.emp &&
    prev.idx === next.idx &&
    prev.showRowModalActions === next.showRowModalActions &&
    prev.columnPlan === next.columnPlan &&
    prev.user === next.user &&
    prev.canEdit === next.canEdit &&
    prev.tl === next.tl &&
    prev.t === next.t &&
    prev.onEdit === next.onEdit &&
    prev.onDelete === next.onDelete &&
    prev.canDeleteRow === next.canDeleteRow &&
    prev.isOffDay === next.isOffDay &&
    prev.isHolidayDay === next.isHolidayDay &&
    prev.isCompensatoryDay === next.isCompensatoryDay &&
    prev.tableVariant === next.tableVariant &&
    prev.isSeasonalAttendance === next.isSeasonalAttendance &&
    prev.isKoreanAttendance === next.isKoreanAttendance &&
    prev.attendanceDateKey === next.attendanceDateKey
  );
}
