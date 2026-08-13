import React, { memo, useMemo } from "react";
import AttendanceTableRow, {
  AttendanceTableColgroup,
  AttendanceTableThead,
} from "./attendanceTableRow";
import { attendanceTableWrapperMinWidthClass } from "./attendanceListShared";
import { isSeasonalAttendanceRoot, isKoreanAttendanceRoot } from "./attendanceSeasonalStt";
import { useAnnualLeaveBalanceMap } from "@/features/leave/useAnnualLeaveBalanceMap";
import { annualLeaveEmpFirebaseKey } from "@/features/leave/annualLeaveEmpKey";
import {
  annualLeaveYearFromDateKey,
  getDisplayAnnualLeaveBalanceForAttendance,
} from "@/features/leave/annualLeaveBalanceLookup";

function AttendanceListTableSection({
  columnPlan,
  deferredFilteredEmployees,
  rowIndexOffset = 0,
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
  const isKoreanAttendance = isKoreanAttendanceRoot(attendanceRootPath);
  const attendanceLayoutOptions = useMemo(() => {
    const options = {};
    if (isKoreanAttendance) options.koreanAttendanceLayout = true;
    if (isSeasonalAttendance) options.seasonalAttendanceLayout = true;
    return options;
  }, [isKoreanAttendance, isSeasonalAttendance]);
  const attendanceTableMinWidthClass = attendanceTableWrapperMinWidthClass(
    columnPlan,
    attendanceLayoutOptions,
  );
  const annualLeaveYear = annualLeaveYearFromDateKey(selectedDate);
  const scopeEmpKeys = useMemo(
    () =>
      deferredFilteredEmployees
        .map((emp) => annualLeaveEmpFirebaseKey(emp.mnv))
        .filter(Boolean),
    [deferredFilteredEmployees],
  );
  const {
    balanceByMnv: annualLeaveBalanceByMnv,
    yearData: annualLeaveYearData,
  } = useAnnualLeaveBalanceMap(annualLeaveYear, {
    attendanceRootPath,
    throughDateKey: selectedDate,
    scopeEmpKeys,
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
      isKoreanAttendance,
      attendanceDateKey: selectedDate,
      annualLeaveYear,
      annualLeaveYearData,
      annualLeaveThroughDateKey: selectedDate,
      annualLeaveAttendanceRootPath: attendanceRootPath,
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
      isKoreanAttendance,
      annualLeaveYear,
      annualLeaveYearData,
      selectedDate,
      attendanceRootPath,
    ],
  );

  const outerScrollClass =
    columnPlan === "minimal"
      ? "overflow-x-hidden"
      : "overflow-x-auto overscroll-x-contain";

  return (
    <div className="attendance-table-compact min-w-0 w-full max-w-none bg-white">
      <div
        className={`attendance-table-scroll min-w-0 w-full max-w-full ${outerScrollClass}`}
      >
        <table
          className={`w-full max-w-none table-fixed border-collapse ${attendanceTableMinWidthClass}`}
        >
          <AttendanceTableColgroup
            showRowModalActions={showRowModalActions}
            columnPlan={columnPlan}
            layoutOptions={attendanceLayoutOptions}
          />
          <AttendanceTableThead
            tl={tl}
            showRowModalActions={showRowModalActions}
            stickyHeader={true}
            canDeleteRow={canDeleteDayRecord}
            columnPlan={columnPlan}
          />
          <tbody>
            {deferredFilteredEmployees.map((emp, localIdx) => {
              const idx = rowIndexOffset + localIdx;
              const rowKey = emp.id ?? emp.mnv ?? `row-${idx}`;
              const annualLeaveBalance = getDisplayAnnualLeaveBalanceForAttendance(
                emp,
                annualLeaveBalanceByMnv,
              );
              return (
                <AttendanceTableRow
                  key={rowKey}
                  emp={emp}
                  idx={idx}
                  canEdit={canEditByEmpId.get(rowKey) ?? false}
                  annualLeaveBalance={annualLeaveBalance}
                  {...sharedRowProps}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default memo(AttendanceListTableSection);
