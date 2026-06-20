import React, { memo, useMemo } from "react";
import AttendanceTableRow, {
  AttendanceTableColgroup,
  AttendanceTableThead,
} from "./attendanceTableRow";
import { attendanceTableWrapperMinWidthClass } from "./attendanceListShared";
import { isSeasonalAttendanceRoot } from "./attendanceSeasonalStt";
import { useAnnualLeaveBalanceMap } from "@/features/leave/useAnnualLeaveBalanceMap";
import {
  annualLeaveYearFromDateKey,
} from "@/features/leave/annualLeaveBalanceLookup";

/**
 * Bảng điểm danh — render đủ hàng (không virtual) để tránh chỉ thấy ~10–15 dòng sau tối ưu.
 */
function AttendanceListTableSection({
  columnPlan,
  deferredFilteredEmployees,
  showRowModalActions,
  canDeleteDayRecord,
  tl,
  user,
  canEditEmployee,
  onEdit,
  onDelete,
  isOffDay,
  isHolidayDay,
  isCompensatoryDay,
  t,
  attendanceRootPath = "attendance",
  selectedDate,
}) {
  const isSeasonalAttendance = isSeasonalAttendanceRoot(attendanceRootPath);
  const annualLeaveYear = annualLeaveYearFromDateKey(selectedDate);
  const {
    balanceByMnv: annualLeaveBalanceByMnv,
    usageDetailByEmpKey: annualLeaveUsageDetailByEmpKey,
    yearData: annualLeaveYearData,
  } = useAnnualLeaveBalanceMap(annualLeaveYear, {
    attendanceRootPath,
    throughDateKey: selectedDate,
  });

  const canEditByEmpId = useMemo(() => {
    const map = new Map();
    for (const emp of deferredFilteredEmployees) {
      const id = emp?.id ?? emp?.mnv;
      if (id != null) map.set(id, canEditEmployee(emp));
    }
    return map;
  }, [deferredFilteredEmployees, canEditEmployee]);

  const sharedRowProps = useMemo(
    () => ({
      showRowModalActions,
      user,
      tl,
      t,
      onEdit,
      onDelete,
      canDeleteRow: canDeleteDayRecord,
      columnPlan,
      isOffDay,
      isHolidayDay,
      isCompensatoryDay,
      isSeasonalAttendance,
      annualLeaveBalanceByMnv,
      annualLeaveUsageDetailByEmpKey,
      annualLeaveYear,
      annualLeaveYearData,
    }),
    [
      showRowModalActions,
      user,
      tl,
      t,
      onEdit,
      onDelete,
      canDeleteDayRecord,
      columnPlan,
      isOffDay,
      isHolidayDay,
      isCompensatoryDay,
      isSeasonalAttendance,
      annualLeaveBalanceByMnv,
      annualLeaveUsageDetailByEmpKey,
      annualLeaveYear,
      annualLeaveYearData,
    ],
  );

  return (
    <div
      className={`min-w-0 w-full max-w-none bg-white ${
        columnPlan === "minimal"
          ? "overflow-x-hidden"
          : "overflow-x-auto overscroll-x-contain [scrollbar-gutter:stable]"
      }`}
    >
      <table
        className={`w-full max-w-none table-fixed border-collapse ${attendanceTableWrapperMinWidthClass(columnPlan)}`}
      >
        <AttendanceTableColgroup
          showRowModalActions={showRowModalActions}
          columnPlan={columnPlan}
        />
        <AttendanceTableThead
          tl={tl}
          showRowModalActions={showRowModalActions}
          stickyHeader={true}
          canDeleteRow={canDeleteDayRecord}
          columnPlan={columnPlan}
        />
        <tbody>
          {deferredFilteredEmployees.map((emp, idx) => {
            const rowKey = emp.id ?? emp.mnv ?? `row-${idx}`;
            return (
              <AttendanceTableRow
                key={rowKey}
                emp={emp}
                idx={idx}
                canEdit={canEditByEmpId.get(rowKey) ?? false}
                {...sharedRowProps}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default memo(AttendanceListTableSection);
