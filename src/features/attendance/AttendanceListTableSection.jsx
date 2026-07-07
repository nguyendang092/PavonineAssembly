import React, { memo, useEffect, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import AttendanceTableRow, {
  AttendanceTableColgroup,
  AttendanceTableThead,
  ATTENDANCE_VIRTUAL_THRESHOLD,
  AttendanceVirtualHeader,
  getAttendanceGridTemplateColumns,
} from "./attendanceTableRow";
import { attendanceTableWrapperMinWidthClass } from "./attendanceListShared";
import { isSeasonalAttendanceRoot } from "./attendanceSeasonalStt";
import { useAnnualLeaveBalanceMap } from "@/features/leave/useAnnualLeaveBalanceMap";
import { annualLeaveYearFromDateKey } from "@/features/leave/annualLeaveBalanceLookup";

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
  const annualLeaveYear = annualLeaveYearFromDateKey(selectedDate);
  const {
    balanceByMnv: annualLeaveBalanceByMnv,
    yearData: annualLeaveYearData,
  } = useAnnualLeaveBalanceMap(annualLeaveYear, {
    attendanceRootPath,
    throughDateKey: selectedDate,
  });

  const shouldVirtualizeTable =
    deferredFilteredEmployees.length > ATTENDANCE_VIRTUAL_THRESHOLD;

  const tableScrollParentRef = useRef(null);

  const attendanceGridTemplateColumns = useMemo(
    () =>
      getAttendanceGridTemplateColumns(
        showRowModalActions,
        columnPlan,
        "attendance",
      ),
    [showRowModalActions, columnPlan],
  );

  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualizeTable ? deferredFilteredEmployees.length : 0,
    getScrollElement: () => tableScrollParentRef.current,
    estimateSize: () => 32,
    overscan: 12,
  });

  useEffect(() => {
    if (!shouldVirtualizeTable) return;
    rowVirtualizer.measure();
  }, [
    shouldVirtualizeTable,
    deferredFilteredEmployees.length,
    columnPlan,
    showRowModalActions,
    rowVirtualizer,
  ]);

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
      annualLeaveBalanceByMnv,
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

  if (shouldVirtualizeTable) {
    return (
      <div className={`min-w-0 w-full max-w-none bg-white attendance-table-compact ${outerScrollClass}`}>
        <div
          ref={tableScrollParentRef}
          className="attendance-table-scroll max-h-[min(88vh,920px)] w-full min-w-0 max-w-full overflow-y-auto overflow-x-auto overscroll-x-contain"
        >
          <div
            className={`w-full max-w-none ${attendanceTableWrapperMinWidthClass(columnPlan)}`}
            role="table"
          >
            <AttendanceVirtualHeader
              tl={tl}
              showRowModalActions={showRowModalActions}
              gridTemplateColumns={attendanceGridTemplateColumns}
              canDeleteRow={canDeleteDayRecord}
              columnPlan={columnPlan}
              tableVariant="attendance"
            />
            <div
              role="rowgroup"
              className="w-full"
              style={{
                position: "relative",
                height: `${rowVirtualizer.getTotalSize()}px`,
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const emp = deferredFilteredEmployees[virtualRow.index];
                const idx = rowIndexOffset + virtualRow.index;
                const rowKey = emp.id ?? emp.mnv ?? `row-${idx}`;
                return (
                  <AttendanceTableRow
                    key={rowKey}
                    emp={emp}
                    idx={idx}
                    virtualRow={virtualRow}
                    canEdit={canEditByEmpId.get(rowKey) ?? false}
                    measureElementRef={rowVirtualizer.measureElement}
                    gridTemplateColumns={attendanceGridTemplateColumns}
                    {...sharedRowProps}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-w-0 w-full max-w-none bg-white attendance-table-compact ${outerScrollClass}`}>
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
          {deferredFilteredEmployees.map((emp, localIdx) => {
            const idx = rowIndexOffset + localIdx;
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
