export function propsAreEqual(prev, next) {
  if (prev.virtualRow !== next.virtualRow) {
    if (!prev.virtualRow || !next.virtualRow) return false;
    if (
      prev.virtualRow.key !== next.virtualRow.key ||
      prev.virtualRow.index !== next.virtualRow.index ||
      prev.virtualRow.start !== next.virtualRow.start ||
      prev.virtualRow.size !== next.virtualRow.size
    ) {
      return false;
    }
  }
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
    prev.measureElementRef === next.measureElementRef &&
    prev.gridTemplateColumns === next.gridTemplateColumns &&
    prev.isOffDay === next.isOffDay &&
    prev.isHolidayDay === next.isHolidayDay &&
    prev.isCompensatoryDay === next.isCompensatoryDay &&
    prev.tableVariant === next.tableVariant &&
    prev.isSeasonalAttendance === next.isSeasonalAttendance &&
    prev.annualLeaveBalanceByMnv === next.annualLeaveBalanceByMnv &&
    prev.annualLeaveYear === next.annualLeaveYear &&
    prev.annualLeaveYearData === next.annualLeaveYearData &&
    prev.annualLeaveThroughDateKey === next.annualLeaveThroughDateKey &&
    prev.annualLeaveAttendanceRootPath === next.annualLeaveAttendanceRootPath
  );
}
